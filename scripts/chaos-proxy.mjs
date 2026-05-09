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
  ws: true,
  followRedirects: true,
})

proxy.on('error', (err, req, res) => {
  if (res && !res.headersSent) {
    res.writeHead(502, { 'Content-Type': 'text/plain' })
  }
  if (res && !res.writableEnded) {
    res.end('Bad Gateway: ' + err.message)
  }
})

const server = http.createServer((req, res) => {
  if (req.url === '/__chaos__' || req.url === '/__chaos__/') {
    serveControlPanel(req, res)
    return
  }

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
      res.writeHead(503, { 'Content-Type': 'text/plain' })
      res.end('Service Unavailable (simulated network failure)')
      return
    }

    if (rand < config.volatility.failRate + config.volatility.resetRate) {
      stats.failed++
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

  if (!config.enabled || isCacheBust) return

  const shouldThrottle = config.speed.bandwidth > 0 || config.speed.latency > 0
  const shouldTruncate = matchExtension(reqUrl, config.volatility.targetExtensions) &&
    Math.random() < config.volatility.truncateRate

  if (shouldTruncate && !shouldThrottle) {
    stats.truncated++
    const originalBody = []
    proxyRes.on('data', (chunk) => originalBody.push(chunk))
    proxyRes.on('end', () => {
      const full = Buffer.concat(originalBody)
      const cutPoint = Math.floor(full.length * (0.3 + Math.random() * 0.4))
      res.writeHead(proxyRes.statusCode, proxyRes.headers)
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
      const originalHeaders = { ...proxyRes.headers }
      proxyRes.headers['x-chaos-delay'] = String(effectiveLatency)

      setTimeout(() => {
        if (res.destroyed) return

        if (shouldTruncate) {
          stats.truncated++
          const originalBody = []
          proxyRes.on('data', (chunk) => originalBody.push(chunk))
          proxyRes.on('end', () => {
            const full = Buffer.concat(originalBody)
            const cutPoint = Math.floor(full.length * (0.3 + Math.random() * 0.4))
            res.writeHead(proxyRes.statusCode, originalHeaders)
            res.end(full.slice(0, cutPoint))
          })
          return
        }

        if (effectiveBandwidth > 0) {
          stats.throttled++
          const throttle = new ThrottleStream(effectiveBandwidth)
          res.writeHead(proxyRes.statusCode, proxyRes.headers)
          proxyRes.pipe(throttle).pipe(res)
        } else {
          res.writeHead(proxyRes.statusCode, proxyRes.headers)
          proxyRes.pipe(res)
        }
      }, Math.max(0, effectiveLatency))
    } else if (effectiveBandwidth > 0) {
      stats.throttled++
      const throttle = new ThrottleStream(effectiveBandwidth)
      res.writeHead(proxyRes.statusCode, proxyRes.headers)
      proxyRes.pipe(throttle).pipe(res)
    }
  }
})

const wss = new WebSocketServer({ server, path: '/__chaos__/ws' })

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

function serveControlPanel(req, res) {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
  res.end(CONTROL_PANEL_HTML)
}

const CONTROL_PANEL_HTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>🔥 Network Chaos Control Panel</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0d1117; color: #c9d1d9; padding: 20px; }
  .container { max-width: 800px; margin: 0 auto; }
  h1 { color: #f0883e; margin-bottom: 8px; font-size: 24px; }
  .subtitle { color: #8b949e; margin-bottom: 20px; font-size: 14px; }
  .master-toggle { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; padding: 12px 16px; background: #161b22; border: 1px solid #30363d; border-radius: 8px; }
  .master-toggle label { font-size: 16px; font-weight: 600; }
  .switch { position: relative; width: 48px; height: 26px; }
  .switch input { opacity: 0; width: 0; height: 0; }
  .slider { position: absolute; cursor: pointer; inset: 0; background: #30363d; border-radius: 26px; transition: .3s; }
  .slider:before { content: ''; position: absolute; height: 20px; width: 20px; left: 3px; bottom: 3px; background: #c9d1d9; border-radius: 50%; transition: .3s; }
  .switch input:checked + .slider { background: #f0883e; }
  .switch input:checked + .slider:before { transform: translateX(22px); }
  .presets { display: flex; gap: 8px; margin-bottom: 20px; flex-wrap: wrap; }
  .preset-btn { padding: 8px 16px; border: 1px solid #30363d; background: #161b22; color: #c9d1d9; border-radius: 6px; cursor: pointer; font-size: 13px; transition: .2s; }
  .preset-btn:hover { border-color: #f0883e; color: #f0883e; }
  .preset-btn.active { background: #f0883e; color: #0d1117; border-color: #f0883e; }
  .section { background: #161b22; border: 1px solid #30363d; border-radius: 8px; margin-bottom: 16px; overflow: hidden; }
  .section-header { padding: 12px 16px; cursor: pointer; display: flex; justify-content: space-between; align-items: center; user-select: none; }
  .section-header:hover { background: #1c2128; }
  .section-title { font-size: 15px; font-weight: 600; display: flex; align-items: center; gap: 8px; }
  .section-title .icon { font-size: 18px; }
  .section-body { padding: 0 16px 16px; display: none; }
  .section.open .section-body { display: block; }
  .section.open .arrow { transform: rotate(90deg); }
  .arrow { transition: transform .2s; font-size: 12px; color: #8b949e; }
  .control-row { display: flex; align-items: center; justify-content: space-between; margin-top: 12px; }
  .control-label { font-size: 13px; color: #8b949e; min-width: 100px; }
  .control-value { font-size: 13px; color: #f0883e; min-width: 60px; text-align: right; font-variant-numeric: tabular-nums; }
  input[type="range"] { flex: 1; margin: 0 12px; accent-color: #f0883e; height: 4px; }
  input[type="text"], select { background: #0d1117; border: 1px solid #30363d; color: #c9d1d9; padding: 6px 10px; border-radius: 4px; font-size: 13px; }
  input[type="text"] { flex: 1; margin-left: 12px; }
  select { margin-left: 12px; min-width: 140px; }
  .checkbox-row { display: flex; align-items: center; gap: 8px; margin-top: 10px; flex-wrap: wrap; }
  .checkbox-row label { display: flex; align-items: center; gap: 4px; font-size: 13px; color: #8b949e; cursor: pointer; padding: 4px 8px; border: 1px solid #30363d; border-radius: 4px; transition: .2s; }
  .checkbox-row label:has(input:checked) { border-color: #f0883e; color: #f0883e; }
  .checkbox-row input { accent-color: #f0883e; }
  .stats-bar { display: grid; grid-template-columns: repeat(auto-fit, minmax(100px, 1fr)); gap: 8px; margin-bottom: 20px; }
  .stat-card { background: #161b22; border: 1px solid #30363d; border-radius: 6px; padding: 10px 12px; text-align: center; }
  .stat-value { font-size: 20px; font-weight: 700; color: #f0883e; font-variant-numeric: tabular-nums; }
  .stat-label { font-size: 11px; color: #8b949e; margin-top: 2px; }
  .status-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 6px; }
  .status-dot.connected { background: #3fb950; }
  .status-dot.disconnected { background: #f85149; }
  .ws-status { font-size: 12px; color: #8b949e; display: flex; align-items: center; gap: 4px; }
  .reset-btn { padding: 6px 14px; background: #21262d; border: 1px solid #30363d; color: #c9d1d9; border-radius: 4px; cursor: pointer; font-size: 12px; }
  .reset-btn:hover { border-color: #f85149; color: #f85149; }
</style>
</head>
<body>
<div class="container">
  <h1>🔥 Network Chaos Control Panel</h1>
  <div class="subtitle">实时控制网络混沌参数，测试 ChunkRetry 插件表现</div>

  <div class="master-toggle">
    <label class="switch"><input type="checkbox" id="masterEnabled" checked><span class="slider"></span></label>
    <label>混沌代理总开关</label>
    <span class="ws-status" id="wsStatus"><span class="status-dot disconnected" id="wsDot"></span>连接中...</span>
  </div>

  <div class="presets">
    <button class="preset-btn" data-preset="light">🟢 轻度波动</button>
    <button class="preset-btn" data-preset="medium">🟡 中度波动</button>
    <button class="preset-btn" data-preset="heavy">🔴 重度波动</button>
    <button class="preset-btn" data-preset="dns">🟣 DNS污染</button>
    <button class="preset-btn" data-preset="slow">🐢 慢速网络</button>
    <button class="preset-btn" data-preset="burst">⚡ 突发卡顿</button>
    <button class="preset-btn" data-preset="off">⚪ 关闭</button>
  </div>

  <div class="stats-bar">
    <div class="stat-card"><div class="stat-value" id="statTotal">0</div><div class="stat-label">总请求</div></div>
    <div class="stat-card"><div class="stat-value" id="statFailed">0</div><div class="stat-label">失败</div></div>
    <div class="stat-card"><div class="stat-value" id="statTruncated">0</div><div class="stat-label">截断</div></div>
    <div class="stat-card"><div class="stat-value" id="statDelayed">0</div><div class="stat-label">延迟</div></div>
    <div class="stat-card"><div class="stat-value" id="statPolluted">0</div><div class="stat-label">DNS污染</div></div>
    <div class="stat-card"><div class="stat-value" id="statThrottled">0</div><div class="stat-label">限速</div></div>
  </div>

  <div class="section open" id="secVolatility">
    <div class="section-header" onclick="toggleSection('secVolatility')">
      <span class="section-title"><span class="icon">🌊</span> 网络波动</span>
      <span class="arrow">▶</span>
    </div>
    <div class="section-body">
      <div class="control-row">
        <span class="control-label">失败概率</span>
        <input type="range" min="0" max="100" value="0" data-path="volatility.failRate" data-scale="0.01">
        <span class="control-value" id="val-volatility.failRate">0%</span>
      </div>
      <div class="control-row">
        <span class="control-label">截断概率</span>
        <input type="range" min="0" max="100" value="0" data-path="volatility.truncateRate" data-scale="0.01">
        <span class="control-value" id="val-volatility.truncateRate">0%</span>
      </div>
      <div class="control-row">
        <span class="control-label">连接重置</span>
        <input type="range" min="0" max="100" value="0" data-path="volatility.resetRate" data-scale="0.01">
        <span class="control-value" id="val-volatility.resetRate">0%</span>
      </div>
      <div class="checkbox-row">
        <span class="control-label">目标文件:</span>
        <label><input type="checkbox" value=".js" data-ext="true" checked>.js</label>
        <label><input type="checkbox" value=".css" data-ext="true">.css</label>
        <label><input type="checkbox" value=".html" data-ext="true">.html</label>
        <label><input type="checkbox" value=".json" data-ext="true">.json</label>
        <label><input type="checkbox" value=".woff2" data-ext="true">.woff2</label>
      </div>
    </div>
  </div>

  <div class="section" id="secDns">
    <div class="section-header" onclick="toggleSection('secDns')">
      <span class="section-title"><span class="icon">🧪</span> DNS 污染</span>
      <span class="arrow">▶</span>
    </div>
    <div class="section-body">
      <div class="control-row">
        <span class="control-label">启用</span>
        <label class="switch"><input type="checkbox" id="dnsEnabled"><span class="slider"></span></label>
      </div>
      <div class="control-row">
        <span class="control-label">污染模式</span>
        <select id="dnsMode">
          <option value="refuse">拒绝连接 (502)</option>
          <option value="empty">空响应 (200)</option>
          <option value="hijack">DNS劫持</option>
        </select>
      </div>
      <div class="control-row">
        <span class="control-label">匹配正则</span>
        <input type="text" id="dnsPattern" value="/assets/.*\\.js$">
      </div>
    </div>
  </div>

  <div class="section" id="secSpeed">
    <div class="section-header" onclick="toggleSection('secSpeed')">
      <span class="section-title"><span class="icon">🐌</span> 网速变化</span>
      <span class="arrow">▶</span>
    </div>
    <div class="section-body">
      <div class="control-row">
        <span class="control-label">带宽限制</span>
        <input type="range" min="0" max="1000" value="0" step="10" data-path="speed.bandwidth" data-scale="1024" data-unit=" KB/s">
        <span class="control-value" id="val-speed.bandwidth">0 KB/s</span>
      </div>
      <div class="control-row">
        <span class="control-label">延迟</span>
        <input type="range" min="0" max="5000" value="0" step="50" data-path="speed.latency" data-scale="1" data-unit="ms">
        <span class="control-value" id="val-speed.latency">0ms</span>
      </div>
      <div class="control-row">
        <span class="control-label">抖动</span>
        <input type="range" min="0" max="2000" value="0" step="50" data-path="speed.jitter" data-scale="1" data-unit="ms">
        <span class="control-value" id="val-speed.jitter">±0ms</span>
      </div>
      <div class="control-row">
        <span class="control-label">突发卡顿</span>
        <label class="switch"><input type="checkbox" id="burstEnabled"><span class="slider"></span></label>
      </div>
      <div class="control-row">
        <span class="control-label">卡顿周期</span>
        <input type="range" min="3" max="30" value="10" step="1" data-path="speed.burstCycle" data-scale="1" data-unit="s">
        <span class="control-value" id="val-speed.burstCycle">10s</span>
      </div>
      <div class="control-row">
        <span class="control-label">卡顿时长</span>
        <input type="range" min="1" max="15" value="3" step="1" data-path="speed.burstSlowDuration" data-scale="1" data-unit="s">
        <span class="control-value" id="val-speed.burstSlowDuration">3s</span>
      </div>
      <div class="control-row">
        <span class="control-label">卡顿倍率</span>
        <input type="range" min="2" max="100" value="10" step="1" data-path="speed.burstSlowMultiplier" data-scale="1" data-unit="x">
        <span class="control-value" id="val-speed.burstSlowMultiplier">10x</span>
      </div>
    </div>
  </div>

  <div style="text-align:center; margin-top:16px;">
    <button class="reset-btn" id="resetStatsBtn">🔄 重置统计</button>
  </div>
</div>

<script>
let ws
let currentConfig = null

function connectWs() {
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:'
  ws = new WebSocket(proto + '//' + location.host + '/__chaos__/ws')
  ws.onopen = () => {
    document.getElementById('wsDot').className = 'status-dot connected'
    document.getElementById('wsStatus').innerHTML = '<span class="status-dot connected" id="wsDot"></span>已连接'
  }
  ws.onclose = () => {
    document.getElementById('wsDot').className = 'status-dot disconnected'
    document.getElementById('wsStatus').innerHTML = '<span class="status-dot disconnected" id="wsDot"></span>已断开'
    setTimeout(connectWs, 2000)
  }
  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data)
    if (msg.type === 'state') {
      currentConfig = msg.config
      updateUI(msg.config, msg.stats)
    }
  }
}

function updateUI(cfg, st) {
  document.getElementById('masterEnabled').checked = cfg.enabled
  document.getElementById('dnsEnabled').checked = cfg.dns.enabled
  document.getElementById('dnsMode').value = cfg.dns.mode
  document.getElementById('dnsPattern').value = cfg.dns.pattern
  document.getElementById('burstEnabled').checked = cfg.speed.burstEnabled

  document.querySelectorAll('input[type="range"]').forEach(el => {
    const path = el.dataset.path
    if (!path) return
    const scale = parseFloat(el.dataset.scale) || 1
    const parts = path.split('.')
    let val = cfg
    for (const p of parts) val = val?.[p]
    if (val !== undefined) el.value = val / scale
    updateRangeDisplay(el)
  })

  document.querySelectorAll('input[data-ext]').forEach(el => {
    const ext = el.value
    el.checked = cfg.volatility.targetExtensions.includes(ext)
  })

  if (st) {
    document.getElementById('statTotal').textContent = st.total
    document.getElementById('statFailed').textContent = st.failed
    document.getElementById('statTruncated').textContent = st.truncated
    document.getElementById('statDelayed').textContent = st.delayed
    document.getElementById('statPolluted').textContent = st.polluted
    document.getElementById('statThrottled').textContent = st.throttled
  }
}

function updateRangeDisplay(el) {
  const path = el.dataset.path
  if (!path) return
  const scale = parseFloat(el.dataset.scale) || 1
  const unit = el.dataset.unit || ''
  const val = parseFloat(el.value) * scale
  const displayEl = document.getElementById('val-' + path)
  if (!displayEl) return

  if (path === 'volatility.failRate' || path === 'volatility.truncateRate' || path === 'volatility.resetRate') {
    displayEl.textContent = Math.round(val * 100) + '%'
  } else if (path === 'speed.bandwidth') {
    displayEl.textContent = val > 0 ? (val / 1024).toFixed(0) + ' KB/s' : '0 KB/s'
  } else if (path === 'speed.latency' || path === 'speed.jitter') {
    const prefix = path === 'speed.jitter' ? '±' : ''
    displayEl.textContent = prefix + val + unit
  } else {
    displayEl.textContent = val + unit
  }
}

function sendConfig() {
  if (!ws || ws.readyState !== WebSocket.OPEN) return

  const cfg = {
    enabled: document.getElementById('masterEnabled').checked,
    volatility: {
      failRate: parseFloat(document.querySelector('[data-path="volatility.failRate"]')?.value || 0) * 0.01,
      truncateRate: parseFloat(document.querySelector('[data-path="volatility.truncateRate"]')?.value || 0) * 0.01,
      resetRate: parseFloat(document.querySelector('[data-path="volatility.resetRate"]')?.value || 0) * 0.01,
      targetExtensions: Array.from(document.querySelectorAll('input[data-ext]:checked')).map(el => el.value),
    },
    dns: {
      enabled: document.getElementById('dnsEnabled').checked,
      mode: document.getElementById('dnsMode').value,
      pattern: document.getElementById('dnsPattern').value,
    },
    speed: {
      bandwidth: parseFloat(document.querySelector('[data-path="speed.bandwidth"]')?.value || 0) * 1024,
      latency: parseFloat(document.querySelector('[data-path="speed.latency"]')?.value || 0),
      jitter: parseFloat(document.querySelector('[data-path="speed.jitter"]')?.value || 0),
      burstEnabled: document.getElementById('burstEnabled').checked,
      burstCycle: parseFloat(document.querySelector('[data-path="speed.burstCycle"]')?.value || 10),
      burstSlowDuration: parseFloat(document.querySelector('[data-path="speed.burstSlowDuration"]')?.value || 3),
      burstSlowMultiplier: parseFloat(document.querySelector('[data-path="speed.burstSlowMultiplier"]')?.value || 10),
    },
  }

  ws.send(JSON.stringify({ type: 'config', config: cfg }))
}

document.querySelectorAll('input[type="range"]').forEach(el => {
  el.addEventListener('input', () => {
    updateRangeDisplay(el)
    sendConfig()
  })
})

document.getElementById('masterEnabled').addEventListener('change', sendConfig)
document.getElementById('dnsEnabled').addEventListener('change', sendConfig)
document.getElementById('dnsMode').addEventListener('change', sendConfig)
document.getElementById('dnsPattern').addEventListener('change', sendConfig)
document.getElementById('burstEnabled').addEventListener('change', sendConfig)
document.querySelectorAll('input[data-ext]').forEach(el => el.addEventListener('change', sendConfig))
document.getElementById('resetStatsBtn').addEventListener('click', () => {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'reset-stats' }))
})

function toggleSection(id) {
  document.getElementById(id).classList.toggle('open')
}

const PRESETS = {
  light: { enabled: true, volatility: { failRate: 0.1, truncateRate: 0, resetRate: 0, targetExtensions: ['.js'] }, dns: { enabled: false, mode: 'refuse', pattern: '/assets/.*\\\\.js$' }, speed: { bandwidth: 0, latency: 200, jitter: 100, burstEnabled: false, burstCycle: 10, burstSlowDuration: 3, burstSlowMultiplier: 10 } },
  medium: { enabled: true, volatility: { failRate: 0.25, truncateRate: 0.1, resetRate: 0.05, targetExtensions: ['.js'] }, dns: { enabled: false, mode: 'refuse', pattern: '/assets/.*\\\\.js$' }, speed: { bandwidth: 0, latency: 500, jitter: 300, burstEnabled: true, burstCycle: 8, burstSlowDuration: 2, burstSlowMultiplier: 20 } },
  heavy: { enabled: true, volatility: { failRate: 0.5, truncateRate: 0.2, resetRate: 0.1, targetExtensions: ['.js', '.css'] }, dns: { enabled: true, mode: 'refuse', pattern: '/assets/.*\\\\.js$' }, speed: { bandwidth: 51200, latency: 1000, jitter: 500, burstEnabled: true, burstCycle: 6, burstSlowDuration: 3, burstSlowMultiplier: 50 } },
  dns: { enabled: true, volatility: { failRate: 0, truncateRate: 0, resetRate: 0, targetExtensions: ['.js'] }, dns: { enabled: true, mode: 'refuse', pattern: '/assets/.*\\\\.js$' }, speed: { bandwidth: 0, latency: 0, jitter: 0, burstEnabled: false, burstCycle: 10, burstSlowDuration: 3, burstSlowMultiplier: 10 } },
  slow: { enabled: true, volatility: { failRate: 0, truncateRate: 0, resetRate: 0, targetExtensions: ['.js'] }, dns: { enabled: false, mode: 'refuse', pattern: '/assets/.*\\\\.js$' }, speed: { bandwidth: 30720, latency: 800, jitter: 200, burstEnabled: false, burstCycle: 10, burstSlowDuration: 3, burstSlowMultiplier: 10 } },
  burst: { enabled: true, volatility: { failRate: 0.15, truncateRate: 0, resetRate: 0, targetExtensions: ['.js'] }, dns: { enabled: false, mode: 'refuse', pattern: '/assets/.*\\\\.js$' }, speed: { bandwidth: 0, latency: 100, jitter: 50, burstEnabled: true, burstCycle: 8, burstSlowDuration: 2, burstSlowMultiplier: 30 } },
  off: { enabled: false, volatility: { failRate: 0, truncateRate: 0, resetRate: 0, targetExtensions: ['.js'] }, dns: { enabled: false, mode: 'refuse', pattern: '/assets/.*\\\\.js$' }, speed: { bandwidth: 0, latency: 0, jitter: 0, burstEnabled: false, burstCycle: 10, burstSlowDuration: 3, burstSlowMultiplier: 10 } },
}

document.querySelectorAll('.preset-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const preset = PRESETS[btn.dataset.preset]
    if (!preset) return
    document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'))
    btn.classList.add('active')
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'config', config: preset }))
    }
  })
})

connectWs()
</script>
</body>
</html>`

server.on('upgrade', (req, socket, head) => {
  if (req.url === '/__chaos__/ws') {
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req)
    })
    return
  }
  proxy.ws(req, socket, head)
})

server.listen(proxyPort, () => {
  console.log('')
  console.log('  🔥 Network Chaos Proxy Server')
  console.log('')
  console.log(`  Proxy:     http://localhost:${proxyPort} → ${target.href}`)
  console.log(`  Control:   http://localhost:${proxyPort}/__chaos__`)
  console.log('')
  console.log('  Usage:')
  console.log(`    浏览器打开 http://localhost:${proxyPort} 测试站点`)
  console.log(`    控制面板打开 http://localhost:${proxyPort}/__chaos__ 调节参数`)
  console.log('')
})
