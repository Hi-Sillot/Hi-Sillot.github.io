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
  scenario: 'off',
  scenarioState: {},
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

const requestLog = []
const MAX_LOG = 50

function resetStats() {
  stats.total = 0
  stats.failed = 0
  stats.truncated = 0
  stats.delayed = 0
  stats.polluted = 0
  stats.throttled = 0
  stats.startTime = Date.now()
  requestLog.length = 0
}

function addLog(entry) {
  requestLog.unshift(entry)
  if (requestLog.length > MAX_LOG) requestLog.length = MAX_LOG
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

function isChunkUrl(url) {
  const pathname = new URL(url, 'http://dummy').pathname
  return pathname.endsWith('.js') || pathname.endsWith('.css')
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

function isFlakyDownPeriod() {
  const cycleSec = (config.scenarioState.flakyCycleSec || 8)
  const downSec = (config.scenarioState.flakyDownSec || 3)
  const elapsed = (Date.now() / 1000) % cycleSec
  return elapsed >= (cycleSec - downSec)
}

const versionUpdateFailedUrls = new Set()

let appReady = false

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
  const isCacheBust = new URL(reqUrl, 'http://dummy').searchParams.has('t') || new URL(reqUrl, 'http://dummy').searchParams.has('_retry')
  const startTime = Date.now()
  const accept = req.headers['accept'] || ''

  if (accept.includes('text/html')) {
    appReady = false
  }

  stats.total++

  if (isCacheBust) {
    proxy.web(req, res)
    return
  }

  if (!appReady && isChunkUrl(reqUrl)) {
    proxy.web(req, res)
    return
  }

  if (config.scenario === 'flaky') {
    if (isFlakyDownPeriod() && isChunkUrl(reqUrl)) {
      stats.failed++
      scheduleBroadcast()
      addLog({ url: reqUrl, method: req.method, status: 503, duration: Date.now() - startTime, interference: '弱网断开', timestamp: Date.now() })
      res.writeHead(503, { 'Content-Type': 'text/plain' })
      res.end('Service Unavailable (flaky network - down period)')
      return
    }
    proxy.web(req, res)
    return
  }

  if (config.scenario === 'version-update') {
    if (isChunkUrl(reqUrl)) {
      const pathname = new URL(reqUrl, 'http://dummy').pathname
      if (!versionUpdateFailedUrls.has(pathname)) {
        versionUpdateFailedUrls.add(pathname)
        stats.failed++
        scheduleBroadcast()
        addLog({ url: reqUrl, method: req.method, status: 503, duration: Date.now() - startTime, interference: '版本更新(旧chunk)', timestamp: Date.now() })
        res.writeHead(503, { 'Content-Type': 'text/plain' })
        res.end('Service Unavailable (stale chunk - version update)')
        return
      }
    }
    proxy.web(req, res)
    return
  }

  if (config.scenario === 'cdn-partial') {
    const pattern = config.scenarioState.cdnPattern || '/assets/.*\\.js$'
    if (matchPattern(reqUrl, pattern)) {
      const failRate = config.scenarioState.cdnFailRate || 0.5
      if (Math.random() < failRate) {
        stats.failed++
        scheduleBroadcast()
        addLog({ url: reqUrl, method: req.method, status: 503, duration: Date.now() - startTime, interference: 'CDN局部故障', timestamp: Date.now() })
        res.writeHead(503, { 'Content-Type': 'text/plain' })
        res.end('Service Unavailable (CDN partial failure)')
        return
      }
    }
    proxy.web(req, res)
    return
  }

  if (config.scenario === 'overload') {
    const latency = config.scenarioState.overloadLatency || 2000
    const failRate = config.scenarioState.overloadFailRate || 0.2
    const truncateRate = config.scenarioState.overloadTruncateRate || 0.15
    const jitter = config.scenarioState.overloadJitter || 1000

    if (isChunkUrl(reqUrl) && Math.random() < failRate) {
      stats.failed++
      scheduleBroadcast()
      addLog({ url: reqUrl, method: req.method, status: 503, duration: Date.now() - startTime, interference: '服务器过载(超时)', timestamp: Date.now() })
      res.writeHead(503, { 'Content-Type': 'text/plain' })
      res.end('Service Unavailable (server overload)')
      return
    }

    const effectiveLatency = latency + Math.floor((Math.random() * 2 - 1) * jitter)
    proxy.web(req, res)

    const origProxyRes = proxy.listeners('proxyRes')
    return
  }

  if (config.dns.enabled && matchPattern(reqUrl, config.dns.pattern)) {
    stats.polluted++
    scheduleBroadcast()
    addLog({ url: reqUrl, method: req.method, status: 502, duration: Date.now() - startTime, interference: 'DNS污染', timestamp: Date.now() })
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
      addLog({ url: reqUrl, method: req.method, status: 503, duration: Date.now() - startTime, interference: '随机失败', timestamp: Date.now() })
      res.writeHead(503, { 'Content-Type': 'text/plain' })
      res.end('Service Unavailable (simulated network failure)')
      return
    }

    if (rand < config.volatility.failRate + config.volatility.resetRate) {
      stats.failed++
      scheduleBroadcast()
      addLog({ url: reqUrl, method: req.method, status: 0, duration: Date.now() - startTime, interference: '连接重置', timestamp: Date.now() })
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
  const isCacheBust = new URL(reqUrl, 'http://dummy').searchParams.has('t') || new URL(reqUrl, 'http://dummy').searchParams.has('_retry')
  const contentType = proxyRes.headers['content-type'] || ''
  const startTime = req._chaosStartTime || Date.now()

  if (contentType.includes('text/html')) {
    injectChaosPanel(proxyRes, res)
    return
  }

  if (!config.enabled || isCacheBust) {
    res.writeHead(proxyRes.statusCode, proxyRes.headers)
    proxyRes.pipe(res)
    return
  }

  if (config.scenario === 'overload' && isChunkUrl(reqUrl)) {
    const latency = config.scenarioState.overloadLatency || 2000
    const jitter = config.scenarioState.overloadJitter || 1000
    const truncateRate = config.scenarioState.overloadTruncateRate || 0.15
    const effectiveLatency = Math.max(0, latency + Math.floor((Math.random() * 2 - 1) * jitter))

    const shouldTruncate = Math.random() < truncateRate
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
          addLog({ url: reqUrl, method: req.method, status: proxyRes.statusCode, duration: Date.now() - startTime, interference: '过载截断', timestamp: Date.now() })
          const cutPoint = Math.floor(body.length * (0.3 + Math.random() * 0.4))
          const headers = { ...originalHeaders }
          delete headers['content-encoding']
          delete headers['content-length']
          delete headers['transfer-encoding']
          res.writeHead(proxyRes.statusCode, headers)
          res.end(body.slice(0, cutPoint))
          return
        }
        stats.delayed++
        scheduleBroadcast()
        addLog({ url: reqUrl, method: req.method, status: proxyRes.statusCode, duration: Date.now() - startTime, interference: '过载延迟', timestamp: Date.now() })
        res.writeHead(proxyRes.statusCode, originalHeaders)
        res.end(body)
      }, effectiveLatency)
    })
    return
  }

  const shouldThrottle = config.speed.bandwidth > 0 || config.speed.latency > 0
  const shouldTruncate = matchExtension(reqUrl, config.volatility.targetExtensions) &&
    Math.random() < config.volatility.truncateRate

  if (shouldTruncate && !shouldThrottle) {
    stats.truncated++
    scheduleBroadcast()
    addLog({ url: reqUrl, method: req.method, status: proxyRes.statusCode, duration: Date.now() - startTime, interference: '截断', timestamp: Date.now() })
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
    appReady,
    log: requestLog.slice(0, 20),
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
    log: requestLog.slice(0, 20),
  }))

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString())
      if (msg.type === 'config') {
        deepMerge(config, msg.config)
        if (config.scenario === 'version-update') {
          versionUpdateFailedUrls.clear()
        }
        appReady = false
        broadcastState()
      }
      if (msg.type === 'reset-stats') {
        resetStats()
        broadcastState()
      }
      if (msg.type === 'ping') {
        broadcastState()
      }
      if (msg.type === 'app-ready') {
        appReady = true
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
#chaos-fab .fab-interfere{display:none;font-size:13px;line-height:1}
#chaos-fab.interfering .fab-interfere{display:inline;animation:chaos-zap .4s ease infinite}
#chaos-fab.interfered{animation:chaos-interfered .6s ease}
#chaos-fab.preset-off{border-color:rgba(139,148,158,.3);background:rgba(22,27,34,.92)}
#chaos-fab.preset-off .fab-preset{color:#8b949e}
#chaos-fab.preset-flaky{border-color:#3fb950;background:rgba(13,31,13,.92);box-shadow:0 0 20px rgba(63,185,80,.25)}
#chaos-fab.preset-flaky .fab-preset{color:#3fb950}
#chaos-fab.preset-flaky .fab-icon{animation:chaos-breathe-green 2s ease-in-out infinite}
#chaos-fab.preset-version-update{border-color:#f85149;background:rgba(31,13,13,.92);box-shadow:0 0 24px rgba(248,81,73,.35)}
#chaos-fab.preset-version-update .fab-preset{color:#f85149}
#chaos-fab.preset-version-update .fab-icon{animation:chaos-breathe-red 1s ease-in-out infinite}
#chaos-fab.preset-cdn-partial{border-color:#a371f7;background:rgba(21,13,31,.92);box-shadow:0 0 20px rgba(163,113,247,.3)}
#chaos-fab.preset-cdn-partial .fab-preset{color:#a371f7}
#chaos-fab.preset-cdn-partial .fab-icon{animation:chaos-breathe-purple 1.8s ease-in-out infinite}
#chaos-fab.preset-overload{border-color:#d29922;background:rgba(31,26,13,.92);box-shadow:0 0 20px rgba(210,153,34,.3)}
#chaos-fab.preset-overload .fab-preset{color:#d29922}
#chaos-fab.preset-overload .fab-icon{animation:chaos-breathe-yellow 1.5s ease-in-out infinite}
#chaos-fab.preset-custom{border-color:#f0883e;background:rgba(22,27,34,.92);box-shadow:0 0 16px rgba(240,136,62,.2)}
#chaos-fab.preset-custom .fab-preset{color:#f0883e}
#chaos-fab.flash{animation:chaos-flash .5s ease}
@keyframes chaos-zap{0%,100%{opacity:1}50%{opacity:.3}}
@keyframes chaos-interfered{0%{filter:brightness(1)}20%{filter:brightness(2);transform:scale(1.08)}40%{filter:brightness(1.2)}60%{filter:brightness(1.8);transform:scale(1.04)}80%{filter:brightness(1.3)}100%{filter:brightness(1);transform:scale(1)}}
@keyframes chaos-flash{0%{transform:scale(1)}25%{transform:scale(1.12);filter:brightness(1.4)}50%{transform:scale(.97)}75%{transform:scale(1.03)}100%{transform:scale(1);filter:brightness(1)}}
@keyframes chaos-breathe-green{0%,100%{transform:scale(1)}50%{transform:scale(1.15);filter:brightness(1.2)}}
@keyframes chaos-breathe-yellow{0%,100%{transform:scale(1)}50%{transform:scale(1.18);filter:brightness(1.3)}}
@keyframes chaos-breathe-red{0%,100%{transform:scale(1)}50%{transform:scale(1.22);filter:brightness(1.4)}}
@keyframes chaos-breathe-purple{0%,100%{transform:scale(1)}50%{transform:scale(1.15);filter:brightness(1.2)}}
#chaos-panel{position:fixed;bottom:88px;right:24px;width:400px;max-height:calc(100vh - 120px);overflow-y:auto;background:#0d1117;border:1px solid #30363d;border-radius:12px;z-index:999998;box-shadow:0 8px 32px rgba(0,0,0,.6);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#c9d1d9;display:none;scrollbar-width:thin;scrollbar-color:#30363d #0d1117}
#chaos-panel.open{display:block}
#chaos-panel *{box-sizing:border-box}
.cp-hdr{padding:14px 16px;border-bottom:1px solid #30363d;display:flex;justify-content:space-between;align-items:center}
.cp-hdr h2{font-size:15px;color:#f0883e;margin:0}
.cp-ws{font-size:11px;color:#8b949e;display:flex;align-items:center;gap:4px}
.cp-dot{width:7px;height:7px;border-radius:50%;display:inline-block}
.cp-dot.on{background:#3fb950}.cp-dot.off{background:#f85149}
.cp-body{padding:12px 16px}
.cp-scenarios{display:flex;gap:6px;margin-bottom:12px;flex-wrap:wrap}
.cp-sbtn{padding:5px 10px;border:1px solid #30363d;background:#161b22;color:#c9d1d9;border-radius:5px;cursor:pointer;font-size:11px;transition:.2s}
.cp-sbtn:hover{border-color:#f0883e;color:#f0883e}
.cp-sbtn.on{background:#f0883e;color:#0d1117;border-color:#f0883e}
.cp-status{display:flex;align-items:center;gap:12px;margin-bottom:12px;padding:10px 12px;background:#161b22;border:1px solid #30363d;border-radius:8px;font-size:12px}
.cp-status-dot{width:10px;height:10px;border-radius:50%;display:inline-block}
.cp-status-dot.ok{background:#3fb950;box-shadow:0 0 6px #3fb950}
.cp-status-dot.err{background:#f85149;box-shadow:0 0 6px #f85149}
.cp-status-dot.warn{background:#d29922;box-shadow:0 0 6px #d29922}
.cp-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:12px}
.cp-st{background:#161b22;border:1px solid #30363d;border-radius:5px;padding:6px 8px;text-align:center}
.cp-stv{font-size:16px;font-weight:700;color:#f0883e;font-variant-numeric:tabular-nums}
.cp-stl{font-size:10px;color:#8b949e}
.cp-log{background:#161b22;border:1px solid #30363d;border-radius:8px;margin-bottom:8px;overflow:hidden;max-height:200px;overflow-y:auto}
.cp-log-hdr{padding:8px 12px;cursor:pointer;display:flex;justify-content:space-between;align-items:center;user-select:none;font-size:13px;font-weight:600}
.cp-log-hdr:hover{background:#1c2128}
.cp-log-body{padding:0 12px 8px}
.cp-log-item{display:flex;align-items:center;gap:6px;padding:4px 0;font-size:11px;border-bottom:1px solid rgba(48,54,61,.3)}
.cp-log-item:last-child{border-bottom:none}
.cp-log-icon{flex-shrink:0;width:16px;text-align:center}
.cp-log-url{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#8b949e}
.cp-log-status{font-weight:700;min-width:28px;text-align:center}
.cp-log-status.s2xx{color:#3fb950}
.cp-log-status.s4xx,.cp-log-status.s5xx{color:#f85149}
.cp-log-status.s0{color:#d29922}
.cp-log-info{color:#6e7681;font-size:10px;min-width:80px;text-align:right}
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
  <div class="cp-scenarios">
    <button class="cp-sbtn" data-s="flaky">📶弱网切换</button>
    <button class="cp-sbtn" data-s="version-update">🔄版本更新</button>
    <button class="cp-sbtn" data-s="cdn-partial">☁️CDN故障</button>
    <button class="cp-sbtn" data-s="overload">📊服务器过载</button>
    <button class="cp-sbtn" data-s="custom">⚙️自定义</button>
    <button class="cp-sbtn" data-s="off">⚪关闭</button>
  </div>
  <div class="cp-status" id="cpStatus"><span class="cp-status-dot ok" id="cpStatusDot"></span><span id="cpStatusText">网络正常</span><span style="flex:1"></span><span>失败: <strong id="csFailed2">0</strong></span><span style="margin-left:8px">总: <strong id="csTotal2">0</strong></span></div>
  <div class="cp-stats">
    <div class="cp-st"><div class="cp-stv" id="csTotal">0</div><div class="cp-stl">总请求</div></div>
    <div class="cp-st"><div class="cp-stv" id="csFailed">0</div><div class="cp-stl">失败</div></div>
    <div class="cp-st"><div class="cp-stv" id="csTrunc">0</div><div class="cp-stl">截断</div></div>
    <div class="cp-st"><div class="cp-stv" id="csDelay">0</div><div class="cp-stl">延迟</div></div>
    <div class="cp-st"><div class="cp-stv" id="csPoll">0</div><div class="cp-stl">DNS污染</div></div>
    <div class="cp-st"><div class="cp-stv" id="csThrot">0</div><div class="cp-stl">限速</div></div>
  </div>
  <div class="cp-log" id="cpLog">
    <div class="cp-log-hdr"><span>📋 请求日志</span><span id="cpLogCount">0</span></div>
    <div class="cp-log-body" id="cpLogBody"></div>
  </div>
  <div class="cp-sec" id="csAdv">
    <div class="cp-shdr" data-sec="csAdv"><span class="cp-stitle">⚙️ 高级设置</span><span class="cp-arr">▶</span></div>
    <div class="cp-sbody">
      <div class="cp-row"><span class="cp-lbl">失败概率</span><input type="range" min="0" max="100" value="0" data-p="volatility.failRate" data-s="0.01"><span class="cp-val" id="v-volatility.failRate">0%</span></div>
      <div class="cp-row"><span class="cp-lbl">截断概率</span><input type="range" min="0" max="100" value="0" data-p="volatility.truncateRate" data-s="0.01"><span class="cp-val" id="v-volatility.truncateRate">0%</span></div>
      <div class="cp-row"><span class="cp-lbl">连接重置</span><input type="range" min="0" max="100" value="0" data-p="volatility.resetRate" data-s="0.01"><span class="cp-val" id="v-volatility.resetRate">0%</span></div>
      <div class="cp-chk"><span class="cp-lbl">目标:</span><label><input type="checkbox" value=".js" data-ext checked>.js</label><label><input type="checkbox" value=".css" data-ext>.css</label><label><input type="checkbox" value=".html" data-ext>.html</label><label><input type="checkbox" value=".woff2" data-ext>.woff2</label></div>
      <div class="cp-row"><span class="cp-lbl">DNS污染</span><label class="cp-sw"><input type="checkbox" id="cpDnsOn"><span class="cp-sl"></span></label></div>
      <div class="cp-row"><span class="cp-lbl">延迟</span><input type="range" min="0" max="5000" value="0" step="50" data-p="speed.latency" data-s="1" data-u="ms"><span class="cp-val" id="v-speed.latency">0ms</span></div>
      <div class="cp-row"><span class="cp-lbl">带宽</span><input type="range" min="0" max="1000" value="0" step="10" data-p="speed.bandwidth" data-s="1024" data-u=" KB/s"><span class="cp-val" id="v-speed.bandwidth">0 KB/s</span></div>
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

  const SCENARIOS={
    'flaky':{enabled:true,scenario:'flaky',scenarioState:{flakyCycleSec:8,flakyDownSec:3},volatility:{failRate:0,truncateRate:0,resetRate:0,targetExtensions:['.js']},dns:{enabled:false,mode:'refuse',pattern:'/assets/.*\\\\\\\\.js$'},speed:{bandwidth:0,latency:0,jitter:0,burstEnabled:false,burstCycle:10,burstSlowDuration:3,burstSlowMultiplier:10}},
    'version-update':{enabled:true,scenario:'version-update',scenarioState:{},volatility:{failRate:0,truncateRate:0,resetRate:0,targetExtensions:['.js']},dns:{enabled:false,mode:'refuse',pattern:'/assets/.*\\\\\\\\.js$'},speed:{bandwidth:0,latency:0,jitter:0,burstEnabled:false,burstCycle:10,burstSlowDuration:3,burstSlowMultiplier:10}},
    'cdn-partial':{enabled:true,scenario:'cdn-partial',scenarioState:{cdnPattern:'/assets/.*\\\\\\\\.js$',cdnFailRate:0.5},volatility:{failRate:0,truncateRate:0,resetRate:0,targetExtensions:['.js']},dns:{enabled:false,mode:'refuse',pattern:'/assets/.*\\\\\\\\.js$'},speed:{bandwidth:0,latency:0,jitter:0,burstEnabled:false,burstCycle:10,burstSlowDuration:3,burstSlowMultiplier:10}},
    'overload':{enabled:true,scenario:'overload',scenarioState:{overloadLatency:2000,overloadFailRate:0.2,overloadTruncateRate:0.15,overloadJitter:1000},volatility:{failRate:0,truncateRate:0,resetRate:0,targetExtensions:['.js']},dns:{enabled:false,mode:'refuse',pattern:'/assets/.*\\\\\\\\.js$'},speed:{bandwidth:0,latency:0,jitter:0,burstEnabled:false,burstCycle:10,burstSlowDuration:3,burstSlowMultiplier:10}},
    'custom':{enabled:true,scenario:'custom',scenarioState:{},volatility:{failRate:.1,truncateRate:0,resetRate:0,targetExtensions:['.js']},dns:{enabled:false,mode:'refuse',pattern:'/assets/.*\\\\\\\\.js$'},speed:{bandwidth:0,latency:200,jitter:100,burstEnabled:false,burstCycle:10,burstSlowDuration:3,burstSlowMultiplier:10}},
    'off':{enabled:false,scenario:'off',scenarioState:{},volatility:{failRate:0,truncateRate:0,resetRate:0,targetExtensions:['.js']},dns:{enabled:false,mode:'refuse',pattern:'/assets/.*\\\\\\\\.js$'},speed:{bandwidth:0,latency:0,jitter:0,burstEnabled:false,burstCycle:10,burstSlowDuration:3,burstSlowMultiplier:10}},
  };
  const SL={'flaky':'弱网切换','version-update':'版本更新','cdn-partial':'CDN故障','overload':'服务器过载','custom':'自定义','off':'关闭'};

  let ws;
  function cWs(){
    const p=location.protocol==='https:'?'wss:':'ws:';
    ws=new WebSocket(p+'//'+location.host+'/__chaos__/ws');
    ws.onopen=()=>{
      document.getElementById('cpDot').className='cp-dot on';
      document.getElementById('cpWs').innerHTML='<span class="cp-dot on" id="cpDot"></span>已连接';
      document.getElementById('fabDot').className='fab-dot on';
      try{
        var sp=localStorage.getItem('__chaos_scenario');
        if(sp&&SCENARIOS[sp]){
          ws.send(JSON.stringify({type:'config',config:SCENARIOS[sp]}));
        }
      }catch(e){}
    };
    ws.onclose=()=>{
      document.getElementById('cpDot').className='cp-dot off';
      document.getElementById('cpWs').innerHTML='<span class="cp-dot off" id="cpDot"></span>已断开';
      document.getElementById('fabDot').className='fab-dot off';
      setTimeout(cWs,2000);
    };
    ws.onmessage=e=>{
      const m=JSON.parse(e.data);
      if(m.type==='state')updUI(m.config,m.stats,m.log,m.appReady);
    };
  }

  var _appReadySent=false;
  function _checkAppReady(){
    if(_appReadySent)return;
    if(window.__chunkRetryReady){
      _appReadySent=true;
      if(ws&&ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify({type:'app-ready'}));
    }
  }
  setInterval(_checkAppReady,500);

  var prevFailed=0;
  var _prevScenario='off';
  function updUI(c,s,log,ar){
    var sk=c.scenario||'off';
    if(!c.enabled)sk='off';
    if(sk!==_prevScenario){
      _prevScenario=sk;
      _appReadySent=false;
    }
    if(ar&&sk!=='off'){
      document.getElementById('cpStatusDot').className='cp-status-dot ok';
      document.getElementById('cpStatusText').textContent='应用就绪 · 干扰中';
    } else if(!ar&&sk!=='off'){
      document.getElementById('cpStatusDot').className='cp-status-dot warn';
      document.getElementById('cpStatusText').textContent='应用加载中...';
    }
    document.getElementById('cpDnsOn').checked=c.dns.enabled;
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
      document.getElementById('csTotal2').textContent=s.total;
      document.getElementById('csFailed2').textContent=s.failed;
      document.getElementById('fabFail').textContent=s.failed;
      if(s.failed>prevFailed){
        fab.classList.add('interfered');
        setTimeout(function(){fab.classList.remove('interfered')},600);
        fab.classList.add('interfering');
        clearTimeout(fab._interfereTimer);
        fab._interfereTimer=setTimeout(function(){fab.classList.remove('interfering')},3000);
        document.getElementById('cpStatusDot').className='cp-status-dot err';
        document.getElementById('cpStatusText').textContent='网络干扰中';
      } else if(s.failed===0&&s.total>0){
        document.getElementById('cpStatusDot').className='cp-status-dot ok';
        document.getElementById('cpStatusText').textContent='网络正常';
      }
      prevFailed=s.failed;
    }
    var sk=c.scenario||'off';
    if(!c.enabled)sk='off';
    var sLabel=SL[sk]||'自定义';
    document.getElementById('fabPreset').textContent=sLabel;
    var prevScenario=fab.dataset.preset;
    if(prevScenario!==sk){
      fab.dataset.preset=sk;
      fab.className='preset-'+sk;
      if(prevScenario!==undefined){
        fab.classList.add('flash');
        setTimeout(function(){fab.classList.remove('flash')},550);
      }
    }
    panel.querySelectorAll('.cp-sbtn').forEach(b=>{
      b.classList.toggle('on',b.dataset.s===sk);
    });
    if(log&&log.length>0){
      document.getElementById('cpLogCount').textContent=log.length;
      var html='';
      log.forEach(function(item){
        var icon=item.status===0?'⚠️':item.status>=500?'❌':item.status>=400?'🚫':'✅';
        var sClass=item.status===0?'s0':item.status>=400?'s4xx':'s2xx';
        var shortUrl=item.url.replace(/^https?:\\/\\/[^/]+/,'');
        if(shortUrl.length>40)shortUrl='...'+shortUrl.slice(-37);
        html+='<div class="cp-log-item"><span class="cp-log-icon">'+icon+'</span><span class="cp-log-url" title="'+item.url+'">'+shortUrl+'</span><span class="cp-log-status '+sClass+'">'+item.status+'</span><span class="cp-log-info">'+item.duration+'ms'+(item.interference?' · '+item.interference:'')+'</span></div>';
      });
      document.getElementById('cpLogBody').innerHTML=html;
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
    else d.textContent=v+u;
  }

  function sendCfg(){
    if(!ws||ws.readyState!==WebSocket.OPEN)return;
    ws.send(JSON.stringify({type:'config',config:{
      enabled:true,
      scenario:'custom',
      scenarioState:{},
      volatility:{
        failRate:parseFloat(panel.querySelector('[data-p="volatility.failRate"]')?.value||0)*0.01,
        truncateRate:parseFloat(panel.querySelector('[data-p="volatility.truncateRate"]')?.value||0)*0.01,
        resetRate:parseFloat(panel.querySelector('[data-p="volatility.resetRate"]')?.value||0)*0.01,
        targetExtensions:Array.from(panel.querySelectorAll('input[data-ext]:checked')).map(e=>e.value),
      },
      dns:{enabled:document.getElementById('cpDnsOn').checked,mode:'refuse',pattern:'/assets/.*\\\\\\\\.js$'},
      speed:{
        bandwidth:parseFloat(panel.querySelector('[data-p="speed.bandwidth"]')?.value||0)*1024,
        latency:parseFloat(panel.querySelector('[data-p="speed.latency"]')?.value||0),
        jitter:0,
        burstEnabled:false,
        burstCycle:10,
        burstSlowDuration:3,
        burstSlowMultiplier:10,
      },
    }}));
  }

  panel.querySelectorAll('input[type="range"]').forEach(el=>{el.addEventListener('input',()=>{updDisp(el);sendCfg()})});
  ['cpDnsOn'].forEach(id=>{
    document.getElementById(id).addEventListener('change',sendCfg);
  });
  panel.querySelectorAll('input[data-ext]').forEach(el=>el.addEventListener('change',sendCfg));
  document.getElementById('cpReset').addEventListener('click',()=>{
    if(ws&&ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify({type:'reset-stats'}));
  });

  panel.querySelectorAll('.cp-sbtn').forEach(b=>{
    b.addEventListener('click',()=>{
      const sc=SCENARIOS[b.dataset.s];if(!sc)return;
      panel.querySelectorAll('.cp-sbtn').forEach(x=>x.classList.remove('on'));
      b.classList.add('on');
      var sk=b.dataset.s;
      document.getElementById('fabPreset').textContent=SL[sk]||'自定义';
      fab.dataset.preset=sk;
      fab.className='preset-'+sk;
      fab.classList.add('flash');
      setTimeout(function(){fab.classList.remove('flash')},550);
      try{localStorage.setItem('__chaos_scenario',sk)}catch(e){}
      if(ws&&ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify({type:'config',config:sc}));
      _appReadySent=false;
      if(sk==='off'){
        document.getElementById('cpStatusDot').className='cp-status-dot ok';
        document.getElementById('cpStatusText').textContent='网络正常';
      }
    });
  });

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
  console.log('  Scenarios:')
  console.log('    📶 弱网切换  - 周期性正常↔断开')
  console.log('    🔄 版本更新  - 首次chunk必定失败')
  console.log('    ☁️  CDN故障  - 部分资源加载失败')
  console.log('    📊 服务器过载 - 高延迟+超时')
  console.log('')
  console.log('  Usage:')
  console.log(`    浏览器打开 http://localhost:${proxyPort} 测试站点`)
  console.log(`    点击右下角 🔥 按钮展开/收起控制面板`)
  console.log('')
})
