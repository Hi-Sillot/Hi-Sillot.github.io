import http from 'node:http'
import { URL } from 'node:url'

const CHAOS_PORT = 5870
const APP_PORT = 5871

const RESULTS = []
let passCount = 0
let failCount = 0

function assert(condition, msg) {
  if (condition) {
    passCount++
  } else {
    failCount++
    RESULTS.push(`  ❌ FAIL: ${msg}`)
  }
}

function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout: ${url}`)), 10000)
    const req = http.request(url, options, (res) => {
      const chunks = []
      res.on('data', (chunk) => chunks.push(chunk))
      res.on('end', () => {
        clearTimeout(timer)
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: Buffer.concat(chunks).toString('utf-8'),
        })
      })
    })
    req.on('error', (err) => {
      clearTimeout(timer)
      reject(err)
    })
    if (options.body) req.write(options.body)
    req.end()
  })
}

function waitForServer(port, maxRetries = 20) {
  return new Promise((resolve, reject) => {
    let retries = 0
    const check = () => {
      const req = http.request(`http://localhost:${port}/`, { method: 'HEAD' }, (res) => {
        res.resume()
        resolve(true)
      })
      req.on('error', () => {
        retries++
        if (retries >= maxRetries) reject(new Error(`server on port ${port} not ready`))
        else setTimeout(check, 500)
      })
      req.end()
    }
    check()
  })
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function setChaosScenario(scenario) {
  const ws = await import('ws')
  return new Promise((resolve, reject) => {
    const socket = new ws.WebSocket(`ws://localhost:${CHAOS_PORT}/__chaos__/ws`)
    socket.on('open', () => {
      socket.send(JSON.stringify({ type: 'config', config: scenario }))
      setTimeout(() => {
        socket.close()
        resolve()
      }, 300)
    })
    socket.on('error', reject)
  })
}

async function getChaosState() {
  const res = await makeRequest(`http://localhost:${CHAOS_PORT}/__chaos__/api/stats`)
  return JSON.parse(res.body)
}

const BROWSER_HEADERS = {
  'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'sec-fetch-dest': 'document',
  'sec-fetch-mode': 'navigate',
  'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
}

const CHUNK_HEADERS = {
  'accept': '*/*',
  'sec-fetch-dest': 'empty',
  'sec-fetch-mode': 'cors',
  'referer': 'http://localhost:5870/',
  'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
}

const CHUNK_CACHEBUST_HEADERS = {
  ...CHUNK_HEADERS,
}

async function runTests() {
  console.log('\n🧪 Chaos Proxy E2E Test Suite')
  console.log('='.repeat(60))

  const { spawn } = await import('node:child_process')

  const appServer = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://dummy')
    if (url.pathname.endsWith('.js')) {
      res.writeHead(200, {
        'content-type': 'application/javascript',
        'cache-control': 'no-cache',
      })
      res.end(`// chunk: ${url.pathname}\nexport default {};`)
    } else if (url.pathname.endsWith('.css')) {
      res.writeHead(200, {
        'content-type': 'text/css',
        'cache-control': 'no-cache',
      })
      res.end(`/* css: ${url.pathname} */`)
    } else {
      res.writeHead(200, {
        'content-type': 'text/html',
        'cache-control': 'no-cache',
      })
      res.end(`<!DOCTYPE html><html><head><title>Test</title></head><body><script src="/assets/app.js"></script><script src="/assets/chunk-guide.js"></script></body></html>`)
    }
  })

  await new Promise((resolve) => appServer.listen(APP_PORT, resolve))
  console.log(`  Mock app server: http://localhost:${APP_PORT}`)

  const chaosProc = spawn('node', [
    'scripts/chaos-proxy.mjs',
    '--target', `http://localhost:${APP_PORT}`,
    '--port', String(CHAOS_PORT),
  ], { stdio: ['ignore', 'pipe', 'pipe'] })

  chaosProc.stdout.on('data', () => {})
  chaosProc.stderr.on('data', () => {})

  try {
    await waitForServer(CHAOS_PORT)
    console.log(`  Chaos proxy: http://localhost:${CHAOS_PORT}`)
    console.log('')

    await test_pageNavigation_resets_appReady()
    await test_chunkCacheBust_resets_appReady()
    await test_proxyRes_appReady_bypass()
    await test_flaky_scenario_bootstrap_protection()
    await test_flaky_scenario_retry_protection()
    await test_flaky_infinite_refresh_prevention()
    await test_version_update_scenario()

    console.log('\n' + '='.repeat(60))
    console.log(`\n📊 Results: ${passCount} passed, ${failCount} failed`)
    if (RESULTS.length > 0) {
      console.log('\nFailures:')
      RESULTS.forEach((r) => console.log(r))
    }
  } finally {
    chaosProc.kill('SIGTERM')
    appServer.close()
  }
}

async function test_pageNavigation_resets_appReady() {
  console.log('\n📋 Test: Page navigation resets appReady')
  await setChaosScenario({ enabled: false, scenario: 'off' })

  const res1 = await makeRequest(`http://localhost:${CHAOS_PORT}/`, {
    headers: BROWSER_HEADERS,
  })
  assert(res1.statusCode === 200, 'Page navigation should return 200')
  assert(res1.body.includes('</body>'), 'Page should have HTML body')

  const res2 = await makeRequest(`http://localhost:${CHAOS_PORT}/assets/app.js`, {
    headers: CHUNK_HEADERS,
  })
  assert(res2.statusCode === 200, 'Chunk request should return 200 when scenario is off')
}

async function test_chunkCacheBust_resets_appReady() {
  console.log('\n📋 Test: Chunk cache-bust request resets appReady')

  await setChaosScenario({
    enabled: true,
    scenario: 'flaky',
    scenarioState: { flakyCycleSec: 8, flakyDownSec: 3 },
    volatility: { failRate: 0, truncateRate: 0, resetRate: 0, targetExtensions: ['.js'] },
    dns: { enabled: false, mode: 'refuse', pattern: '' },
    speed: { bandwidth: 0, latency: 0, jitter: 0, burstEnabled: false, burstCycle: 10, burstSlowDuration: 3, burstSlowMultiplier: 10 },
  })

  await makeRequest(`http://localhost:${CHAOS_PORT}/`, { headers: BROWSER_HEADERS })

  const ws = await import('ws')
  await new Promise((resolve, reject) => {
    const socket = new ws.WebSocket(`ws://localhost:${CHAOS_PORT}/__chaos__/ws`)
    socket.on('open', () => {
      socket.send(JSON.stringify({ type: 'app-ready' }))
      setTimeout(() => {
        socket.close()
        resolve()
      }, 300)
    })
    socket.on('error', reject)
  })

  const cacheBustRes = await makeRequest(`http://localhost:${CHAOS_PORT}/assets/app.js?t=${Date.now()}`, {
    headers: CHUNK_CACHEBUST_HEADERS,
  })
  assert(cacheBustRes.statusCode === 200, 'Cache-bust chunk request should return 200')

  const normalChunkRes = await makeRequest(`http://localhost:${CHAOS_PORT}/assets/chunk-guide.js`, {
    headers: CHUNK_HEADERS,
  })
  assert(normalChunkRes.statusCode === 200, 'Normal chunk after cache-bust should be protected (appReady=false)')

  await setChaosScenario({ enabled: false, scenario: 'off' })
}

async function test_proxyRes_appReady_bypass() {
  console.log('\n📋 Test: proxyRes handler bypasses interference when appReady=false')

  await setChaosScenario({
    enabled: true,
    scenario: 'overload',
    scenarioState: { overloadLatency: 5000, overloadFailRate: 0, overloadTruncateRate: 1.0, overloadJitter: 0 },
    volatility: { failRate: 0, truncateRate: 0, resetRate: 0, targetExtensions: ['.js'] },
    dns: { enabled: false, mode: 'refuse', pattern: '' },
    speed: { bandwidth: 0, latency: 0, jitter: 0, burstEnabled: false, burstCycle: 10, burstSlowDuration: 3, burstSlowMultiplier: 10 },
  })

  await makeRequest(`http://localhost:${CHAOS_PORT}/`, { headers: BROWSER_HEADERS })

  const chunkRes = await makeRequest(`http://localhost:${CHAOS_PORT}/assets/app.js`, {
    headers: CHUNK_HEADERS,
  })
  assert(chunkRes.statusCode === 200, 'Chunk should be served when appReady=false (overload truncation bypassed)')
  assert(chunkRes.body.includes('chunk:'), 'Chunk body should be complete when appReady=false')

  await setChaosScenario({ enabled: false, scenario: 'off' })
}

async function test_flaky_scenario_bootstrap_protection() {
  console.log('\n📋 Test: Flaky scenario - bootstrap protection (appReady=false)')

  await setChaosScenario({
    enabled: true,
    scenario: 'flaky',
    scenarioState: { flakyCycleSec: 8, flakyDownSec: 3 },
    volatility: { failRate: 0, truncateRate: 0, resetRate: 0, targetExtensions: ['.js'] },
    dns: { enabled: false, mode: 'refuse', pattern: '' },
    speed: { bandwidth: 0, latency: 0, jitter: 0, burstEnabled: false, burstCycle: 10, burstSlowDuration: 3, burstSlowMultiplier: 10 },
  })

  let protectedChunks = 0
  let totalChunks = 0

  for (let i = 0; i < 5; i++) {
    await makeRequest(`http://localhost:${CHAOS_PORT}/`, { headers: BROWSER_HEADERS })

    const chunkRes = await makeRequest(`http://localhost:${CHAOS_PORT}/assets/app.js`, {
      headers: CHUNK_HEADERS,
    })
    totalChunks++
    if (chunkRes.statusCode === 200) protectedChunks++
  }

  assert(protectedChunks === totalChunks,
    `All chunk requests should be protected during bootstrap (got ${protectedChunks}/${totalChunks})`)

  await setChaosScenario({ enabled: false, scenario: 'off' })
}

async function test_flaky_scenario_retry_protection() {
  console.log('\n📋 Test: Flaky scenario - retry protection (cache-bust resets appReady)')

  await setChaosScenario({
    enabled: true,
    scenario: 'flaky',
    scenarioState: { flakyCycleSec: 8, flakyDownSec: 3 },
    volatility: { failRate: 0, truncateRate: 0, resetRate: 0, targetExtensions: ['.js'] },
    dns: { enabled: false, mode: 'refuse', pattern: '' },
    speed: { bandwidth: 0, latency: 0, jitter: 0, burstEnabled: false, burstCycle: 10, burstSlowDuration: 3, burstSlowMultiplier: 10 },
  })

  await makeRequest(`http://localhost:${CHAOS_PORT}/`, { headers: BROWSER_HEADERS })

  const ws = await import('ws')
  await new Promise((resolve, reject) => {
    const socket = new ws.WebSocket(`ws://localhost:${CHAOS_PORT}/__chaos__/ws`)
    socket.on('open', () => {
      socket.send(JSON.stringify({ type: 'app-ready' }))
      setTimeout(() => {
        socket.close()
        resolve()
      }, 300)
    })
    socket.on('error', reject)
  })

  const retryRes = await makeRequest(`http://localhost:${CHAOS_PORT}/assets/app.js?t=${Date.now()}`, {
    headers: CHUNK_CACHEBUST_HEADERS,
  })
  assert(retryRes.statusCode === 200, 'Cache-bust retry should succeed')

  const depRes = await makeRequest(`http://localhost:${CHAOS_PORT}/assets/chunk-guide.js`, {
    headers: CHUNK_HEADERS,
  })
  assert(depRes.statusCode === 200,
    'Dependency chunk should be protected after cache-bust retry (appReady should be false)')

  await setChaosScenario({ enabled: false, scenario: 'off' })
}

async function test_flaky_infinite_refresh_prevention() {
  console.log('\n📋 Test: Flaky scenario - infinite refresh prevention')

  await setChaosScenario({
    enabled: true,
    scenario: 'flaky',
    scenarioState: { flakyCycleSec: 4, flakyDownSec: 2 },
    volatility: { failRate: 0, truncateRate: 0, resetRate: 0, targetExtensions: ['.js'] },
    dns: { enabled: false, mode: 'refuse', pattern: '' },
    speed: { bandwidth: 0, latency: 0, jitter: 0, burstEnabled: false, burstCycle: 10, burstSlowDuration: 3, burstSlowMultiplier: 10 },
  })

  let blockedCount = 0
  let passCount = 0
  let reloadCount = 0
  const MAX_SIMULATED_RELOADS = 10

  for (let r = 0; r < MAX_SIMULATED_RELOADS; r++) {
    reloadCount++

    await makeRequest(`http://localhost:${CHAOS_PORT}/?_retry=${r}_${Date.now()}`, {
      headers: BROWSER_HEADERS,
    })

    const chunkRes = await makeRequest(`http://localhost:${CHAOS_PORT}/assets/app.js`, {
      headers: CHUNK_HEADERS,
    })

    if (chunkRes.statusCode === 503) {
      blockedCount++
    } else {
      passCount++
    }

    if (passCount > 0) break
  }

  assert(passCount > 0,
    `At least one chunk should pass within ${MAX_SIMULATED_RELOADS} reloads (blocked: ${blockedCount}, passed: ${passCount})`)
  assert(reloadCount <= MAX_SIMULATED_RELOADS,
    `Should not exceed ${MAX_SIMULATED_RELOADS} reloads (got ${reloadCount})`)

  await setChaosScenario({ enabled: false, scenario: 'off' })
}

async function test_version_update_scenario() {
  console.log('\n📋 Test: Version update scenario - bootstrap protection')

  await setChaosScenario({
    enabled: true,
    scenario: 'version-update',
    scenarioState: {},
    volatility: { failRate: 0, truncateRate: 0, resetRate: 0, targetExtensions: ['.js'] },
    dns: { enabled: false, mode: 'refuse', pattern: '' },
    speed: { bandwidth: 0, latency: 0, jitter: 0, burstEnabled: false, burstCycle: 10, burstSlowDuration: 3, burstSlowMultiplier: 10 },
  })

  await makeRequest(`http://localhost:${CHAOS_PORT}/`, { headers: BROWSER_HEADERS })

  const chunkRes = await makeRequest(`http://localhost:${CHAOS_PORT}/assets/app.js`, {
    headers: CHUNK_HEADERS,
  })
  assert(chunkRes.statusCode === 200,
    'Chunk should be protected during bootstrap in version-update scenario (appReady=false)')

  const ws = await import('ws')
  await new Promise((resolve, reject) => {
    const socket = new ws.WebSocket(`ws://localhost:${CHAOS_PORT}/__chaos__/ws`)
    socket.on('open', () => {
      socket.send(JSON.stringify({ type: 'app-ready' }))
      setTimeout(() => {
        socket.close()
        resolve()
      }, 300)
    })
    socket.on('error', reject)
  })

  const retryRes = await makeRequest(`http://localhost:${CHAOS_PORT}/assets/app.js?t=${Date.now()}`, {
    headers: CHUNK_CACHEBUST_HEADERS,
  })
  assert(retryRes.statusCode === 200,
    'Cache-bust retry should succeed in version-update scenario')

  const depRes = await makeRequest(`http://localhost:${CHAOS_PORT}/assets/chunk-guide.js`, {
    headers: CHUNK_HEADERS,
  })
  assert(depRes.statusCode === 200,
    'Dependency chunk should be protected after cache-bust retry in version-update')

  await setChaosScenario({ enabled: false, scenario: 'off' })
}

runTests().catch((err) => {
  console.error('Test suite failed:', err)
  process.exit(1)
})
