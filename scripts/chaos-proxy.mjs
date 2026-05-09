import http from 'node:http'
import { URL } from 'node:url'
import { Transform } from 'node:stream'
import httpProxy from 'http-proxy'
import { WebSocketServer, WebSocket } from 'ws'

const args = process.argv.slice(2)
let targetUrl = 'http://localhost:5858'
let proxyPort = 5859

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--target' && args[i + 1]) { targetUrl = args[++i]; continue }
  if (args[i] === '--port' && args[i + 1]) { proxyPort = parseInt(args[++i], 10); continue }
}

const target = new URL(targetUrl)

const config = {
  enabled: true,
  volatility: {
    failRate: 0,
    truncateRate: 0,
    resetRate: 0,
    targetExtensions: ['.js'],
  },
  dns: {
    enabled: false,
    mode: 'refuse',
    pattern: '/assets/.*\\.js$',
  },
  speed: {
    bandwidth: 0,
    latency: 0,
    jitter: 0,
    burstEnabled: false,
    burstCycle: 10,
    burstSlowDuration: 3,
    burstSlowMultiplier: 10,
  },
}

const stats = {
  total: 0,
  failed: 0,
  truncated: 0,
  delayed: 0,
  polluted: 0,
  throttled: 0,
  startTime: Date.now(),
}

function resetStats() {
  stats.total = 0
  stats.failed = 0
  stats.truncated = 0
  stats.delayed = 0
  stats.polluted = 0
  stats.throttled = 0
  stats.startTime = Date.now()
}

function matchExtension(url, extensions) {
  if (!extensions || extensions.length === 0) return true
  const pathname = new URL(url, 'http://dummy').pathname
  return extensions.some(ext => pathname.endsWith(ext))
}

function matchPattern(url, pattern) {
  if (!pattern) return false
  try {
    const pathname = new URL(url, 'http://dummy').pathname
    const regex = new RegExp(pattern)
    return regex.test(pathname)
  } catch {
    return false
  }
}

class ThrottleStream extends Transform {
  constructor(bytesPerSec) {
    super()
    this.bytesPerSec = bytesPerSec
    this.tokens = bytesPerSec
    this.lastRefill = Date.now()
    this.buffered = []
    this.flushing = false
  }

  _transform(chunk, encoding, callback) {
    if (this.bytesPerSec <= 0) {
      this.push(chunk)
      return callback()
    }

    const now = Date.now()
    const elapsed = now - this.lastRefill
    this.tokens = Math.min(this.bytesPerSec * 2, this.tokens + (elapsed / 1000) * this.bytesPerSec)
    this.lastRefill = now

    this.buffered.push(chunk)
    this._drain(callback)
  }

  _drain(callback) {
    if (this.flushing) return
    this.flushing = true

    const processBuffer = () => {
      if (this.buffered.length === 0) {
        this.flushing = false
        callback()
        return
      }

      const now = Date.now()
      const elapsed = now - this.lastRefill
      this.tokens = Math.min(this.bytesPerSec * 2, this.tokens + (elapsed / 1000) * this.bytesPerSec)
      this.lastRefill = now

      if (this.tokens <= 0) {
        const waitMs = Math.max(10, Math.ceil((-this.tokens / this.bytesPerSec) * 1000))
        setTimeout(processBuffer, waitMs)
        return
      }

      const chunk = this.buffered[0]
      if (chunk.length <= this.tokens) {
        this.tokens -= chunk.length
        this.buffered.shift()
        this.push(chunk)
        processBuffer()
      } else {
        const sendNow = chunk.slice(0, Math.floor(this.tokens))
        const remaining = chunk.slice(Math.floor(this.tokens))
        this.tokens = 0
        this.buffered[0] = remaining
        this.push(sendNow)
        const waitMs = Math.max(10, Math.ceil((remaining.length / this.bytesPerSec) * 1000))
        setTimeout(processBuffer, waitMs)
      }
    }

    processBuffer()
  }

  _flush(callback) {
    callback()
  }
}

function isBurstSlowPeriod() {
  if (!config.speed.burstEnabled) return false
  const cycleSec = config.speed.burstCycle
  const slowSec = config.speed.burstSlowDuration
  const elapsed = (Date.now() / 1000) % cycleSec
  return elapsed < slowSec
}

const proxy = httpProxy.createProxyServer({
  target: target.href,
  changeOrigin: true,
  ws: false,
  followRedirects: true,
  selfHandleResponse: true,
})

proxy.on('proxyReq', (proxyReq, req) => {
  const accept = req.headers['accept'] || ''
  if (accept.includes('text/html')) {
    proxyReq.removeHeader('accept-encoding')
    proxyReq.setHeader('accept-encoding', 'identity')
  }
})

proxy.on('error', (err, req, res) => {
  if (res && !res.headersSent) {
    res.writeHead(502, { 'Content-Type': 'text/plain' })
  }
  if (res && !res.writableEnded) {
    res.end('Bad Gateway: ' + err.message)
  }
})

const INJECT_MARKER = '</body>'
const INJECT_SCRIPT = `<script>document.addEventListener('DOMContentLoaded',function(){var s=document.createElement('script');s.src='/__chaos__/panel.js';document.head.appendChild(s)});</script></body>`

const server = http.createServer((req, res) => {
  if (req.url === '/__chaos__/panel.js') {
    res.writeHead(200, {
      'Content-Type': 'application/javascript',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache',
    })
    res.end(CHAOS_INJECT_SCRIPT())
    return
  }

  if (req.url.startsWith('/__chaos__/api/')) {
    if (req.url === '/__chaos__/api/config') {
      serveJson(res, config)
      return
    }
    if (req.url === '/__chaos__/api/stats') {
      serveJson(res, { ...stats, uptimeSec: Math.floor((Date.now() - stats.startTime) / 1000) })
      return
    }
    if (req.url === '/__chaos__/api/reset-stats' && req.method === 'POST') {
      resetStats()
      serveJson(res, { ok: true })
      return
    }
  }

  if (!config.enabled) {
    proxy.web(req, res)
    return
  }

  const reqUrl = req.url
  const isCacheBust = new URL(reqUrl, 'http://dummy').searchParams.has('t')

  stats.total++

  if (isCacheBust) {
    proxy.web(req, res)
    return
  }

  if (config.dns.enabled && matchPattern(reqUrl, config.dns.pattern)) {
    stats.polluted++
    scheduleBroadcast()
    if (config.dns.mode === 'refuse') {
      res.writeHead(502, { 'Content-Type': 'text/plain' })
      res.end('ERR_CONNECTION_REFUSED (simulated DNS pollution)')
      return
    }
    if (config.dns.mode === 'empty') {
      const ext = new URL(reqUrl, 'http://dummy').pathname.split('.').pop()
      const ct = ext === 'js' ? 'application/javascript' : ext === 'css' ? 'text/css' : 'text/html'
      res.writeHead(200, { 'Content-Type': ct })
      res.end('')
      return
    }
    if (config.dns.mode === 'hijack') {
      res.writeHead(200, { 'Content-Type': 'text/html' })
      res.end('<html><body><h1>DNS Hijacked</h1></body></html>')
      return
    }
  }

  if (matchExtension(reqUrl, config.volatility.targetExtensions)) {
    const rand = Math.random()

    if (rand < config.volatility.failRate) {
      stats.failed++
      scheduleBroadcast()
      res.writeHead(503, { 'Content-Type': 'text/plain' })
      res.end('Service Unavailable (simulated network failure)')
      return
    }

    if (rand < config.volatility.failRate + config.volatility.resetRate) {
      stats.failed++
      scheduleBroadcast()
      res.writeHead(200, { 'Content-Type': 'application/octet-stream' })
      res.write('partial data...')
      res.destroy()
      return
    }
  }

  proxy.web(req, res)
})

proxy.on('proxyRes', (proxyRes, req, res) => {
  const reqUrl = req.url
  const isCacheBust = new URL(reqUrl, 'http://dummy').searchParams.has('t')
  const contentType = proxyRes.headers['content-type'] || ''

  if (contentType.includes('text/html') && !isCacheBust) {
    injectChaosPanel(proxyRes, res)
    return
  }

  if (!config.enabled || isCacheBust) {
    res.writeHead(proxyRes.statusCode, proxyRes.headers)
    proxyRes.pipe(res)
    return
  }

  const shouldThrottle = config.speed.bandwidth > 0 || config.speed.latency > 0
  const shouldTruncate = matchExtension(reqUrl, config.volatility.targetExtensions) &&
    Math.random() < config.volatility.truncateRate

  if (shouldTruncate && !shouldThrottle) {
    stats.truncated++
    scheduleBroadcast()
    const originalBody = []
    proxyRes.on('data', (chunk) => originalBody.push(chunk))
    proxyRes.on('end', () => {
      const full = Buffer.concat(originalBody)
      const cutPoint = Math.floor(full.length * (0.3 + Math.random() * 0.4))
      const headers = { ...proxyRes.headers }
      delete headers['content-encoding']
      delete headers['content-length']
      delete headers['transfer-encoding']
      res.writeHead(proxyRes.statusCode, headers)
      res.end(full.slice(0, cutPoint))
    })
    return
  }

  if (shouldThrottle) {
    const effectiveBandwidth = isBurstSlowPeriod()
      ? Math.max(1, Math.floor(config.speed.bandwidth / config.speed.burstSlowMultiplier))
      : config.speed.bandwidth

    const effectiveLatency = config.speed.latency + Math.floor((Math.random() * 2 - 1) * config.speed.jitter)

    if (effectiveLatency > 0) {
      stats.delayed++
      scheduleBroadcast()
      const originalHeaders = { ...proxyRes.headers }
      const bodyChunks = []
      proxyRes.on('data', (chunk) => bodyChunks.push(chunk))
      proxyRes.on('end', () => {
        const body = Buffer.concat(bodyChunks)

        setTimeout(() => {
          if (res.destroyed) return

          if (shouldTruncate) {
            stats.truncated++
            scheduleBroadcast()
            const cutPoint = Math.floor(body.length * (0.3 + Math.random() * 0.4))
            const headers = { ...originalHeaders }
            delete headers['content-encoding']
            delete headers['content-length']
            delete headers['transfer-encoding']
            res.writeHead(proxyRes.statusCode, headers)
            res.end(body.slice(0, cutPoint))
            return
          }

          res.writeHead(proxyRes.statusCode, originalHeaders)
          res.end(body)
        }, Math.max(0, effectiveLatency))
      })
      return
    }

    if (effectiveBandwidth > 0) {
      stats.throttled++
      scheduleBroadcast()
      const throttle = new ThrottleStream(effectiveBandwidth)
      res.writeHead(proxyRes.statusCode, proxyRes.headers)
      proxyRes.pipe(throttle).pipe(res)
      return
    }
  }

  res.writeHead(proxyRes.statusCode, proxyRes.headers)
  proxyRes.pipe(res)
})

function injectChaosPanel(proxyRes, res) {
  const chunks = []
  proxyRes.on('data', (chunk) => chunks.push(chunk))
  proxyRes.on('end', () => {
    let html = Buffer.concat(chunks).toString('utf-8')
    const idx = html.toLowerCase().lastIndexOf('</body>')
    if (idx !== -1) {
      html = html.slice(0, idx) + INJECT_SCRIPT + html.slice(idx + INJECT_MARKER.length)
    }
    const headers = { ...proxyRes.headers }
    delete headers['content-length']
    delete headers['transfer-encoding']
    res.writeHead(proxyRes.statusCode, headers)
    res.end(html)
  })
}

const wss = new WebSocketServer({ noServer: true })

function broadcastState() {
  const msg = JSON.stringify({
    type: 'state',
    config,
    stats: { ...stats, uptimeSec: Math.floor((Date.now() - stats.startTime) / 1000) },
  })
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) client.send(msg)
  })
}

let broadcastTimer = null
function scheduleBroadcast() {
  if (broadcastTimer) return
  broadcastTimer = setTimeout(() => {
    broadcastState()
    broadcastTimer = null
  }, 200)
}

wss.on('connection', (ws) => {
  ws.send(JSON.stringify({
    type: 'state',
    config,
    stats: { ...stats, uptimeSec: Math.floor((Date.now() - stats.startTime) / 1000) },
  }))

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString())
      if (msg.type === 'config') {
        deepMerge(config, msg.config)
        broadcastState()
      }
      if (msg.type === 'reset-stats') {
        resetStats()
        broadcastState()
      }
    } catch {}
  })
})

function deepMerge(target, source) {
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      if (!target[key]) target[key] = {}
      deepMerge(target[key], source[key])
    } else {
      target[key] = source[key]
    }
  }
}

function serveJson(res, data) {
  res.writeHead(200, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  })
  res.end(JSON.stringify(data))
}

function CHAOS_INJECT_SCRIPT() {
  return `(function(){
  if(window.__chaosPanelLoaded) return;
  window.__chaosPanelLoaded=true;

  const S=document.createElement('style');
  S.textContent=\`
#chaos-fab{position:fixed;bottom:24px;right:24px;height:40px;border-radius:20px;border:2px solid rgba(139,148,158,.3);cursor:pointer;z-index:999999;box-shadow:0 4px 16px rgba(0,0,0,.4);transition:all .35s cubic-bezier(.4,0,.2,1);display:flex;align-items:center;gap:8px;padding:0 14px 0 10px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:rgba(22,27,34,.92);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);color:#c9d1d9}
#chaos-fab:hover{transform:scale(1.06)}
#chaos-fab .fab-icon{font-size:18px;line-height:1;transition:transform .3s}
#chaos-fab .fab-info{display:flex;align-items:center;gap:7px;font-size:12px;font-weight:700;white-space:nowrap;letter-spacing:.3px}
#chaos-fab .fab-preset{transition:color .3s}
#chaos-fab .fab-sep{opacity:.3;font-weight:300}
#chaos-fab .fab-stat{display:flex;align-items:center;gap:3px;opacity:.9}
#chaos-fab .fab-dot{width:8px;height:8px;border-radius:50%;display:inline-block;transition:background .3s,box-shadow .3s}
#chaos-fab .fab-dot.on{background:#3fb950;box-shadow:0 0 6px #3fb950}
#chaos-fab .fab-dot.off{background:#f85149;box-shadow:0 0 6px #f85149}
#chaos-fab.preset-off{border-color:rgba(139,148,158,.3);background:rgba(22,27,34,.92)}
#chaos-fab.preset-off .fab-preset{color:#8b949e}
#chaos-fab.preset-light{border-color:#3fb950;background:rgba(13,31,13,.92);box-shadow:0 0 20px rgba(63,185,80,.25)}
#chaos-fab.preset-light .fab-preset{color:#3fb950}
#chaos-fab.preset-light .fab-icon{animation:chaos-breathe-green 2s ease-in-out infinite}
#chaos-fab.preset-medium{border-color:#d29922;background:rgba(31,26,13,.92);box-shadow:0 0 20px rgba(210,153,34,.3)}
#chaos-fab.preset-medium .fab-preset{color:#d29922}
#chaos-fab.preset-medium .fab-icon{animation:chaos-breathe-yellow 1.5s ease-in-out infinite}
#chaos-fab.preset-heavy{border-color:#f85149;background:rgba(31,13,13,.92);box-shadow:0 0 24px rgba(248,81,73,.35)}
#chaos-fab.preset-heavy .fab-preset{color:#f85149}
#chaos-fab.preset-heavy .fab-icon{animation:chaos-breathe-red 1s ease-in-out infinite}
#chaos-fab.preset-dns{border-color:#a371f7;background:rgba(21,13,31,.92);box-shadow:0 0 20px rgba(163,113,247,.3)}
#chaos-fab.preset-dns .fab-preset{color:#a371f7}
#chaos-fab.preset-dns .fab-icon{animation:chaos-breathe-purple 1.8s ease-in-out infinite}
#chaos-fab.preset-slow{border-color:#58a6ff;background:rgba(13,20,31,.92);box-shadow:0 0 20px rgba(88,166,255,.25)}
#chaos-fab.preset-slow .fab-preset{color:#58a6ff}
#chaos-fab.preset-slow .fab-icon{animation:chaos-breathe-blue 2.5s ease-in-out infinite}
#chaos-fab.preset-burst{border-color:#f0883e;background:rgba(31,20,13,.92);box-shadow:0 0 20px rgba(240,136,62,.3)}
#chaos-fab.preset-burst .fab-preset{color:#f0883e}
#chaos-fab.preset-burst .fab-icon{animation:chaos-burst .8s ease-in-out infinite}
#chaos-fab.preset-custom{border-color:#f0883e;background:rgba(22,27,34,.92);box-shadow:0 0 16px rgba(240,136,62,.2)}
#chaos-fab.preset-custom .fab-preset{color:#f0883e}
#chaos-fab.flash{animation:chaos-flash .5s ease}
#chaos-fab .fab-interfere{display:none;font-size:13px;line-height:1}
#chaos-fab.interfering .fab-interfere{display:inline;animation:chaos-zap .4s ease infinite}
#chaos-fab.interfered{animation:chaos-interfered .6s ease}
@keyframes chaos-zap{0%,100%{opacity:1}50%{opacity:.3}}
@keyframes chaos-interfered{0%{filter:brightness(1)}20%{filter:brightness(2);transform:scale(1.08)}40%{filter:brightness(1.2)}60%{filter:brightness(1.8);transform:scale(1.04)}80%{filter:brightness(1.3)}100%{filter:brightness(1);transform:scale(1)}}
@keyframes chaos-flash{0%{transform:scale(1)}25%{transform:scale(1.12);filter:brightness(1.4)}50%{transform:scale(.97)}75%{transform:scale(1.03)}100%{transform:scale(1);filter:brightness(1)}}
@keyframes chaos-breathe-green{0%,100%{transform:scale(1)}50%{transform:scale(1.15);filter:brightness(1.2)}}
@keyframes chaos-breathe-yellow{0%,100%{transform:scale(1)}50%{transform:scale(1.18);filter:brightness(1.3)}}
@keyframes chaos-breathe-red{0%,100%{transform:scale(1)}50%{transform:scale(1.22);filter:brightness(1.4)}}
@keyframes chaos-breathe-purple{0%,100%{transform:scale(1)}50%{transform:scale(1.15);filter:brightness(1.2)}}
@keyframes chaos-breathe-blue{0%,100%{transform:scale(1)}50%{transform:scale(1.1);filter:brightness(1.15)}}
@keyframes chaos-burst{0%,100%{transform:scale(1)}15%{transform:scale(1.25);filter:brightness(1.5)}30%{transform:scale(.9)}45%{transform:scale(1.1)}60%{transform:scale(1)}}
#chaos-panel{position:fixed;bottom:88px;right:24px;width:380px;max-height:calc(100vh - 120px);overflow-y:auto;background:#0d1117;border:1px solid #30363d;border-radius:12px;z-index:999998;box-shadow:0 8px 32px rgba(0,0,0,.6);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#c9d1d9;display:none;scrollbar-width:thin;scrollbar-color:#30363d #0d1117}
#chaos-panel.open{display:block}
#chaos-panel *{box-sizing:border-box}
.cp-hdr{padding:14px 16px;border-bottom:1px solid #30363d;display:flex;justify-content:space-between;align-items:center}
.cp-hdr h2{font-size:15px;color:#f0883e;margin:0}
.cp-ws{font-size:11px;color:#8b949e;display:flex;align-items:center;gap:4px}
.cp-dot{width:7px;height:7px;border-radius:50%;display:inline-block}
.cp-dot.on{background:#3fb950}.cp-dot.off{background:#f85149}
.cp-body{padding:12px 16px}
.cp-master{display:flex;align-items:center;gap:10px;margin-bottom:12px;padding:10px 12px;background:#161b22;border:1px solid #30363d;border-radius:8px}
.cp-master label{font-size:13px;font-weight:600}
.cp-sw{position:relative;width:40px;height:22px;flex-shrink:0}
.cp-sw input{opacity:0;width:0;height:0;position:absolute}
.cp-sl{position:absolute;cursor:pointer;inset:0;background:#30363d;border-radius:22px;transition:.3s}
.cp-sl:before{content:'';position:absolute;height:16px;width:16px;left:3px;bottom:3px;background:#c9d1d9;border-radius:50%;transition:.3s}
.cp-sw input:checked+.cp-sl{background:#f0883e}
.cp-sw input:checked+.cp-sl:before{transform:translateX(18px)}
.cp-presets{display:flex;gap:6px;margin-bottom:12px;flex-wrap:wrap}
.cp-pbtn{padding:5px 10px;border:1px solid #30363d;background:#161b22;color:#c9d1d9;border-radius:5px;cursor:pointer;font-size:11px;transition:.2s}
.cp-pbtn:hover{border-color:#f0883e;color:#f0883e}
.cp-pbtn.on{background:#f0883e;color:#0d1117;border-color:#f0883e}
.cp-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:12px}
.cp-st{background:#161b22;border:1px solid #30363d;border-radius:5px;padding:6px 8px;text-align:center}
.cp-stv{font-size:16px;font-weight:700;color:#f0883e;font-variant-numeric:tabular-nums}
.cp-stl{font-size:10px;color:#8b949e}
.cp-sec{background:#161b22;border:1px solid #30363d;border-radius:8px;margin-bottom:8px;overflow:hidden}
.cp-shdr{padding:8px 12px;cursor:pointer;display:flex;justify-content:space-between;align-items:center;user-select:none}
.cp-shdr:hover{background:#1c2128}
.cp-stitle{font-size:13px;font-weight:600;display:flex;align-items:center;gap:6px}
.cp-sbody{padding:0 12px 10px;display:none}
.cp-sec.open .cp-sbody{display:block}
.cp-sec.open .cp-arr{transform:rotate(90deg)}
.cp-arr{transition:transform .2s;font-size:10px;color:#8b949e}
.cp-row{display:flex;align-items:center;justify-content:space-between;margin-top:8px}
.cp-lbl{font-size:12px;color:#8b949e;min-width:70px}
.cp-val{font-size:12px;color:#f0883e;min-width:50px;text-align:right;font-variant-numeric:tabular-nums}
.cp-row input[type="range"]{flex:1;margin:0 8px;accent-color:#f0883e;height:3px}
.cp-row input[type="text"],.cp-row select{background:#0d1117;border:1px solid #30363d;color:#c9d1d9;padding:4px 8px;border-radius:3px;font-size:12px}
.cp-row input[type="text"]{flex:1;margin-left:8px}
.cp-row select{margin-left:8px;min-width:120px}
.cp-chk{display:flex;align-items:center;gap:6px;margin-top:8px;flex-wrap:wrap}
.cp-chk label{display:flex;align-items:center;gap:3px;font-size:11px;color:#8b949e;cursor:pointer;padding:3px 6px;border:1px solid #30363d;border-radius:3px;transition:.2s}
.cp-chk label:has(input:checked){border-color:#f0883e;color:#f0883e}
.cp-chk input{accent-color:#f0883e}
.cp-reset{display:block;margin:8px auto 0;padding:5px 12px;background:#21262d;border:1px solid #30363d;color:#c9d1d9;border-radius:4px;cursor:pointer;font-size:11px}
.cp-reset:hover{border-color:#f85149;color:#f85149}
\`;
  document.head.appendChild(S);

  const fab=document.createElement('button');
  fab.id='chaos-fab';
  fab.title='Network Chaos Panel';
  fab.innerHTML='<span class="fab-icon">🔥</span><span class="fab-interfere" id="fabInterfere">⚡</span><span class="fab-info"><span class="fab-dot off" id="fabDot"></span><span class="fab-preset" id="fabPreset">--</span><span class="fab-sep">|</span><span class="fab-stat">❌<span id="fabFail">0</span></span></span>';
  document.body.appendChild(fab);

  const panel=document.createElement('div');
  panel.id='chaos-panel';
  panel.innerHTML=\`
<div class="cp-hdr"><h2>🔥 Chaos Panel</h2><span class="cp-ws" id="cpWs"><span class="cp-dot off" id="cpDot"></span>连接中</span></div>
<div class="cp-body">
  <div class="cp-master"><label class="cp-sw"><input type="checkbox" id="cpOn" checked><span class="cp-sl"></span></label><label>混沌代理</label></div>
  <div class="cp-presets">
    <button class="cp-pbtn" data-p="light">🟢轻度</button>
    <button class="cp-pbtn" data-p="medium">🟡中度</button>
    <button class="cp-pbtn" data-p="heavy">🔴重度</button>
    <button class="cp-pbtn" data-p="dns">🟣DNS</button>
    <button class="cp-pbtn" data-p="slow">🐢慢速</button>
    <button class="cp-pbtn" data-p="burst">⚡突发</button>
    <button class="cp-pbtn" data-p="off">⚪关闭</button>
  </div>
  <div class="cp-stats">
    <div class="cp-st"><div class="cp-stv" id="csTotal">0</div><div class="cp-stl">总请求</div></div>
    <div class="cp-st"><div class="cp-stv" id="csFailed">0</div><div class="cp-stl">失败</div></div>
    <div class="cp-st"><div class="cp-stv" id="csTrunc">0</div><div class="cp-stl">截断</div></div>
    <div class="cp-st"><div class="cp-stv" id="csDelay">0</div><div class="cp-stl">延迟</div></div>
    <div class="cp-st"><div class="cp-stv" id="csPoll">0</div><div class="cp-stl">DNS污染</div></div>
    <div class="cp-st"><div class="cp-stv" id="csThrot">0</div><div class="cp-stl">限速</div></div>
  </div>
  <div class="cp-sec open" id="csVol">
    <div class="cp-shdr" data-sec="csVol"><span class="cp-stitle">🌊 网络波动</span><span class="cp-arr">▶</span></div>
    <div class="cp-sbody">
      <div class="cp-row"><span class="cp-lbl">失败概率</span><input type="range" min="0" max="100" value="0" data-p="volatility.failRate" data-s="0.01"><span class="cp-val" id="v-volatility.failRate">0%</span></div>
      <div class="cp-row"><span class="cp-lbl">截断概率</span><input type="range" min="0" max="100" value="0" data-p="volatility.truncateRate" data-s="0.01"><span class="cp-val" id="v-volatility.truncateRate">0%</span></div>
      <div class="cp-row"><span class="cp-lbl">连接重置</span><input type="range" min="0" max="100" value="0" data-p="volatility.resetRate" data-s="0.01"><span class="cp-val" id="v-volatility.resetRate">0%</span></div>
      <div class="cp-chk"><span class="cp-lbl">目标:</span><label><input type="checkbox" value=".js" data-ext checked>.js</label><label><input type="checkbox" value=".css" data-ext>.css</label><label><input type="checkbox" value=".html" data-ext>.html</label><label><input type="checkbox" value=".woff2" data-ext>.woff2</label></div>
    </div>
  </div>
  <div class="cp-sec" id="csDns">
    <div class="cp-shdr" data-sec="csDns"><span class="cp-stitle">🧪 DNS 污染</span><span class="cp-arr">▶</span></div>
    <div class="cp-sbody">
      <div class="cp-row"><span class="cp-lbl">启用</span><label class="cp-sw"><input type="checkbox" id="cpDnsOn"><span class="cp-sl"></span></label></div>
      <div class="cp-row"><span class="cp-lbl">模式</span><select id="cpDnsMode"><option value="refuse">拒绝(502)</option><option value="empty">空响应(200)</option><option value="hijack">DNS劫持</option></select></div>
      <div class="cp-row"><span class="cp-lbl">正则</span><input type="text" id="cpDnsPat" value="/assets/.*\\\\.js$"></div>
    </div>
  </div>
  <div class="cp-sec" id="csSpd">
    <div class="cp-shdr" data-sec="csSpd"><span class="cp-stitle">🐌 网速变化</span><span class="cp-arr">▶</span></div>
    <div class="cp-sbody">
      <div class="cp-row"><span class="cp-lbl">带宽</span><input type="range" min="0" max="1000" value="0" step="10" data-p="speed.bandwidth" data-s="1024" data-u=" KB/s"><span class="cp-val" id="v-speed.bandwidth">0 KB/s</span></div>
      <div class="cp-row"><span class="cp-lbl">延迟</span><input type="range" min="0" max="5000" value="0" step="50" data-p="speed.latency" data-s="1" data-u="ms"><span class="cp-val" id="v-speed.latency">0ms</span></div>
      <div class="cp-row"><span class="cp-lbl">抖动</span><input type="range" min="0" max="2000" value="0" step="50" data-p="speed.jitter" data-s="1" data-u="ms"><span class="cp-val" id="v-speed.jitter">±0ms</span></div>
      <div class="cp-row"><span class="cp-lbl">突发卡顿</span><label class="cp-sw"><input type="checkbox" id="cpBurst"><span class="cp-sl"></span></label></div>
      <div class="cp-row"><span class="cp-lbl">周期</span><input type="range" min="3" max="30" value="10" step="1" data-p="speed.burstCycle" data-s="1" data-u="s"><span class="cp-val" id="v-speed.burstCycle">10s</span></div>
      <div class="cp-row"><span class="cp-lbl">时长</span><input type="range" min="1" max="15" value="3" step="1" data-p="speed.burstSlowDuration" data-s="1" data-u="s"><span class="cp-val" id="v-speed.burstSlowDuration">3s</span></div>
      <div class="cp-row"><span class="cp-lbl">倍率</span><input type="range" min="2" max="100" value="10" step="1" data-p="speed.burstSlowMultiplier" data-s="1" data-u="x"><span class="cp-val" id="v-speed.burstSlowMultiplier">10x</span></div>
    </div>
  </div>
  <button class="cp-reset" id="cpReset">🔄 重置统计</button>
</div>
\`;
  document.body.appendChild(panel);

  fab.onclick=()=>{panel.classList.toggle('open')};

  panel.querySelectorAll('.cp-shdr').forEach(h=>{
    h.onclick=()=>{document.getElementById(h.dataset.sec).classList.toggle('open')}
  });

  let ws;
  function cWs(){
    const p=location.protocol==='https:'?'wss:':'ws:';
    ws=new WebSocket(p+'//'+location.host+'/__chaos__/ws');
    ws.onopen=()=>{document.getElementById('cpDot').className='cp-dot on';document.getElementById('cpWs').innerHTML='<span class="cp-dot on" id="cpDot"></span>已连接';document.getElementById('fabDot').className='fab-dot on'};
    ws.onclose=()=>{document.getElementById('cpDot').className='cp-dot off';document.getElementById('cpWs').innerHTML='<span class="cp-dot off" id="cpDot"></span>已断开';document.getElementById('fabDot').className='fab-dot off';setTimeout(cWs,2000)};
    ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.type==='state')updUI(m.config,m.stats)};
  }

  var prevFailed=0;
  function updUI(c,s){
    document.getElementById('cpOn').checked=c.enabled;
    document.getElementById('cpDnsOn').checked=c.dns.enabled;
    document.getElementById('cpDnsMode').value=c.dns.mode;
    document.getElementById('cpDnsPat').value=c.dns.pattern;
    document.getElementById('cpBurst').checked=c.speed.burstEnabled;
    panel.querySelectorAll('input[type="range"]').forEach(el=>{
      const p=el.dataset.p;if(!p)return;
      const sc=parseFloat(el.dataset.s)||1;
      let v=c;for(const k of p.split('.'))v=v?.[k];
      if(v!==undefined)el.value=v/sc;
      updDisp(el);
    });
    panel.querySelectorAll('input[data-ext]').forEach(el=>{el.checked=c.volatility.targetExtensions.includes(el.value)});
    if(s){
      document.getElementById('csTotal').textContent=s.total;
      document.getElementById('csFailed').textContent=s.failed;
      document.getElementById('csTrunc').textContent=s.truncated;
      document.getElementById('csDelay').textContent=s.delayed;
      document.getElementById('csPoll').textContent=s.polluted;
      document.getElementById('csThrot').textContent=s.throttled;
      document.getElementById('fabFail').textContent=s.failed;
      if(s.failed>prevFailed){
        fab.classList.add('interfered');
        setTimeout(function(){fab.classList.remove('interfered')},600);
        fab.classList.add('interfering');
        clearTimeout(fab._interfereTimer);
        fab._interfereTimer=setTimeout(function(){fab.classList.remove('interfering')},3000);
      }
      prevFailed=s.failed;
    }
    var presetKey='custom';
    if(!c.enabled) presetKey='off';
    else if(c.volatility.failRate===.1&&c.speed.latency===200) presetKey='light';
    else if(c.volatility.failRate===.25&&c.speed.latency===500) presetKey='medium';
    else if(c.volatility.failRate===.5&&c.dns.enabled) presetKey='heavy';
    else if(c.dns.enabled&&c.volatility.failRate===0) presetKey='dns';
    else if(c.speed.bandwidth>0&&c.volatility.failRate===0&&!c.dns.enabled) presetKey='slow';
    else if(c.speed.burstEnabled&&c.volatility.failRate>0) presetKey='burst';
    var presetLabel=PL[presetKey]||'自定义';
    document.getElementById('fabPreset').textContent=presetLabel;
    var prevPreset=fab.dataset.preset;
    if(prevPreset!==presetKey){
      fab.dataset.preset=presetKey;
      fab.className='preset-'+presetKey;
      if(prevPreset!==undefined){
        fab.classList.add('flash');
        setTimeout(function(){fab.classList.remove('flash')},550);
      }
    }
  }

  function updDisp(el){
    const p=el.dataset.p;if(!p)return;
    const sc=parseFloat(el.dataset.s)||1;
    const u=el.dataset.u||'';
    const v=parseFloat(el.value)*sc;
    const d=document.getElementById('v-'+p);if(!d)return;
    if(p.includes('failRate')||p.includes('truncateRate')||p.includes('resetRate'))d.textContent=Math.round(v*100)+'%';
    else if(p==='speed.bandwidth')d.textContent=v>0?(v/1024).toFixed(0)+' KB/s':'0 KB/s';
    else if(p==='speed.jitter')d.textContent='±'+v+u;
    else d.textContent=v+u;
  }

  function sendCfg(){
    if(!ws||ws.readyState!==WebSocket.OPEN)return;
    ws.send(JSON.stringify({type:'config',config:{
      enabled:document.getElementById('cpOn').checked,
      volatility:{
        failRate:parseFloat(panel.querySelector('[data-p="volatility.failRate"]')?.value||0)*0.01,
        truncateRate:parseFloat(panel.querySelector('[data-p="volatility.truncateRate"]')?.value||0)*0.01,
        resetRate:parseFloat(panel.querySelector('[data-p="volatility.resetRate"]')?.value||0)*0.01,
        targetExtensions:Array.from(panel.querySelectorAll('input[data-ext]:checked')).map(e=>e.value),
      },
      dns:{enabled:document.getElementById('cpDnsOn').checked,mode:document.getElementById('cpDnsMode').value,pattern:document.getElementById('cpDnsPat').value},
      speed:{
        bandwidth:parseFloat(panel.querySelector('[data-p="speed.bandwidth"]')?.value||0)*1024,
        latency:parseFloat(panel.querySelector('[data-p="speed.latency"]')?.value||0),
        jitter:parseFloat(panel.querySelector('[data-p="speed.jitter"]')?.value||0),
        burstEnabled:document.getElementById('cpBurst').checked,
        burstCycle:parseFloat(panel.querySelector('[data-p="speed.burstCycle"]')?.value||10),
        burstSlowDuration:parseFloat(panel.querySelector('[data-p="speed.burstSlowDuration"]')?.value||3),
        burstSlowMultiplier:parseFloat(panel.querySelector('[data-p="speed.burstSlowMultiplier"]')?.value||10),
      },
    }}));
  }

  panel.querySelectorAll('input[type="range"]').forEach(el=>{el.addEventListener('input',()=>{updDisp(el);sendCfg()})});
  ['cpOn','cpDnsOn','cpDnsMode','cpDnsPat','cpBurst'].forEach(id=>{
    document.getElementById(id).addEventListener('change',sendCfg);
  });
  panel.querySelectorAll('input[data-ext]').forEach(el=>el.addEventListener('change',sendCfg));
  document.getElementById('cpReset').addEventListener('click',()=>{if(ws&&ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify({type:'reset-stats'}))});

  const PR={
    light:{enabled:true,volatility:{failRate:.1,truncateRate:0,resetRate:0,targetExtensions:['.js']},dns:{enabled:false,mode:'refuse',pattern:'/assets/.*\\\\\\\\.js$'},speed:{bandwidth:0,latency:200,jitter:100,burstEnabled:false,burstCycle:10,burstSlowDuration:3,burstSlowMultiplier:10}},
    medium:{enabled:true,volatility:{failRate:.25,truncateRate:.1,resetRate:.05,targetExtensions:['.js']},dns:{enabled:false,mode:'refuse',pattern:'/assets/.*\\\\\\\\.js$'},speed:{bandwidth:0,latency:500,jitter:300,burstEnabled:true,burstCycle:8,burstSlowDuration:2,burstSlowMultiplier:20}},
    heavy:{enabled:true,volatility:{failRate:.5,truncateRate:.2,resetRate:.1,targetExtensions:['.js','.css']},dns:{enabled:true,mode:'refuse',pattern:'/assets/.*\\\\\\\\.js$'},speed:{bandwidth:51200,latency:1000,jitter:500,burstEnabled:true,burstCycle:6,burstSlowDuration:3,burstSlowMultiplier:50}},
    dns:{enabled:true,volatility:{failRate:0,truncateRate:0,resetRate:0,targetExtensions:['.js']},dns:{enabled:true,mode:'refuse',pattern:'/assets/.*\\\\\\\\.js$'},speed:{bandwidth:0,latency:0,jitter:0,burstEnabled:false,burstCycle:10,burstSlowDuration:3,burstSlowMultiplier:10}},
    slow:{enabled:true,volatility:{failRate:0,truncateRate:0,resetRate:0,targetExtensions:['.js']},dns:{enabled:false,mode:'refuse',pattern:'/assets/.*\\\\\\\\.js$'},speed:{bandwidth:30720,latency:800,jitter:200,burstEnabled:false,burstCycle:10,burstSlowDuration:3,burstSlowMultiplier:10}},
    burst:{enabled:true,volatility:{failRate:.15,truncateRate:0,resetRate:0,targetExtensions:['.js']},dns:{enabled:false,mode:'refuse',pattern:'/assets/.*\\\\\\\\.js$'},speed:{bandwidth:0,latency:100,jitter:50,burstEnabled:true,burstCycle:8,burstSlowDuration:2,burstSlowMultiplier:30}},
    off:{enabled:false,volatility:{failRate:0,truncateRate:0,resetRate:0,targetExtensions:['.js']},dns:{enabled:false,mode:'refuse',pattern:'/assets/.*\\\\\\\\.js$'},speed:{bandwidth:0,latency:0,jitter:0,burstEnabled:false,burstCycle:10,burstSlowDuration:3,burstSlowMultiplier:10}},
  };
  const PL={light:'轻度',medium:'中度',heavy:'重度',dns:'DNS',slow:'慢速',burst:'突发',off:'关闭'};
  panel.querySelectorAll('.cp-pbtn').forEach(b=>{
    b.addEventListener('click',()=>{
      const pr=PR[b.dataset.p];if(!pr)return;
      panel.querySelectorAll('.cp-pbtn').forEach(x=>x.classList.remove('on'));
      b.classList.add('on');
      var pk=b.dataset.p;
      document.getElementById('fabPreset').textContent=PL[pk]||'自定义';
      fab.dataset.preset=pk;
      fab.className='preset-'+pk;
      fab.classList.add('flash');
      setTimeout(function(){fab.classList.remove('flash')},550);
      try{localStorage.setItem('__chaos_preset',pk)}catch(e){}
      if(ws&&ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify({type:'config',config:pr}));
    });
  });

  try{var sp=localStorage.getItem('__chaos_preset');if(sp){var sb=panel.querySelector('.cp-pbtn[data-p="'+sp+'"]');if(sb){sb.classList.add('on');document.getElementById('fabPreset').textContent=PL[sp]||'自定义';fab.dataset.preset=sp;fab.className='preset-'+sp}}}catch(e){}

  cWs();
  })();`
}

server.on('upgrade', (req, socket, head) => {
  if (req.url === '/__chaos__/ws') {
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req)
    })
  } else {
    proxy.ws(req, socket, head)
  }
})

server.listen(proxyPort, () => {
  console.log('')
  console.log('  🔥 Network Chaos Proxy Server')
  console.log('')
  console.log(`  Proxy:     http://localhost:${proxyPort} → ${target.href}`)
  console.log(`  Panel:     页面右下角 🔥 悬浮按钮`)
  console.log('')
  console.log('  Usage:')
  console.log(`    浏览器打开 http://localhost:${proxyPort} 测试站点`)
  console.log(`    点击右下角 🔥 按钮展开/收起控制面板`)
  console.log('')
})
