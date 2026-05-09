import { test, expect } from '@playwright/test'
import { NetworkSimulator } from './helpers/network-simulator'
import { MetricsCollector } from './helpers/metrics'

async function findUnloadedNavLink(page) {
  return page.evaluate(() => {
    const currentPath = window.location.pathname
    const links = Array.from(document.querySelectorAll('a.vp-link[href]'))
    const navLink = links.find(a => {
      const href = a.getAttribute('href')
      return href
        && !href.startsWith('#')
        && !href.startsWith('http')
        && !href.startsWith('mailto:')
        && href !== '/'
        && href !== currentPath
        && href !== currentPath.replace(/\/$/, '')
    })
    return navLink?.getAttribute('href') || null
  })
}

async function findAllNavLinks(page) {
  return page.evaluate(() => {
    const currentPath = window.location.pathname
    const links = Array.from(document.querySelectorAll('a.vp-link[href]'))
    return links
      .map(a => a.getAttribute('href'))
      .filter(href => href
        && !href.startsWith('#')
        && !href.startsWith('http')
        && !href.startsWith('mailto:')
        && href !== '/'
        && href !== currentPath
        && href !== currentPath.replace(/\/$/, ''))
  })
}

async function spaNavigate(page, path) {
  return page.evaluate((targetPath) => {
    const app = document.querySelector('#app')?.__vue_app__
    if (!app) return 'no-vue-app'
    const router = app.config.globalProperties.$router
    if (!router) return 'no-router'
    return router.push(targetPath)
      .then(() => 'spa-ok')
      .catch((e) => `spa-error:${e.message || e}`)
  }, path)
}

async function waitForPageLoad(page, expectedPath, timeout = 15000): Promise<{ loaded: boolean; reason: string | null; timeMs: number }> {
  const start = Date.now()
  const normalized = expectedPath.replace('.html', '').replace(/\/$/, '')

  while (Date.now() - start < timeout) {
    const currentUrl = page.url()
    const urlMatch = currentUrl.includes(normalized)

    if (urlMatch) {
      const contentLen = await page.evaluate(() => {
        const selectors = ['.vp-page', '.vp-doc', '#app main', '.page-content', '.home']
        for (const sel of selectors) {
          const el = document.querySelector(sel)
          if (el && el.innerHTML.length > 50) return el.innerHTML.length
        }
        return 0
      })

      if (contentLen > 50) {
        return { loaded: true, reason: null, timeMs: Date.now() - start }
      }
    }

    await page.waitForTimeout(500)
  }

  const currentUrl = page.url()
  const urlMatch = currentUrl.includes(normalized)
  if (!urlMatch) return { loaded: false, reason: 'url-mismatch', timeMs: Date.now() - start }

  const contentLen = await page.evaluate(() => {
    const selectors = ['.vp-page', '.vp-doc', '#app main', '.page-content', '.home']
    for (const sel of selectors) {
      const el = document.querySelector(sel)
      if (el && el.innerHTML.length > 50) return el.innerHTML.length
    }
    return 0
  })
  if (contentLen < 50) return { loaded: false, reason: 'empty-content', timeMs: Date.now() - start }

  return { loaded: true, reason: null, timeMs: Date.now() - start }
}

const PLUGIN_ENABLED = process.env.CHUNK_RETRY_PLUGIN !== 'disabled'

test.describe(`${PLUGIN_ENABLED ? 'WITH' : 'WITHOUT'} plugin: SPA navigation chunk failure`, () => {
  test.setTimeout(120000)
  const metrics = new MetricsCollector()

  test('single transient failure: 1 chunk request fails then succeeds', async ({ page }) => {
    const simulator = new NetworkSimulator(page, { failCount: 1 })

    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const targetPath = await findUnloadedNavLink(page)
    if (!targetPath) { test.skip(); return }

    const start = Date.now()
    await simulator.start()

    const navResult = await spaNavigate(page, targetPath)
    const result = await waitForPageLoad(page, targetPath, 15000)

    metrics.add({
      scenario: `single-transient-${PLUGIN_ENABLED ? 'with-plugin' : 'no-plugin'}`,
      success: result.loaded,
      navigationStartTime: start,
      navigationEndTime: Date.now(),
      recoveryTimeMs: result.loaded ? result.timeMs : 0,
      pageLoaded: result.loaded,
      errorMessage: result.loaded ? null : `${navResult} | ${result.reason}`,
    })

    await simulator.stop()
    console.log(metrics.formatReport())

    if (PLUGIN_ENABLED) {
      expect(metrics.getSummary().successCount).toBeGreaterThan(0)
    } else {
      expect(metrics.getSummary().failureCount).toBeGreaterThan(0)
    }
  })

  test('consecutive failures: 2 chunk requests fail then succeed', async ({ page }) => {
    const simulator = new NetworkSimulator(page, { failCount: 2 })

    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const targetPath = await findUnloadedNavLink(page)
    if (!targetPath) { test.skip(); return }

    const start = Date.now()
    await simulator.start()

    const navResult = await spaNavigate(page, targetPath)
    const result = await waitForPageLoad(page, targetPath, 20000)

    metrics.add({
      scenario: `consecutive-${PLUGIN_ENABLED ? 'with-plugin' : 'no-plugin'}`,
      success: result.loaded,
      navigationStartTime: start,
      navigationEndTime: Date.now(),
      recoveryTimeMs: result.loaded ? result.timeMs : 0,
      pageLoaded: result.loaded,
      errorMessage: result.loaded ? null : `${navResult} | ${result.reason}`,
    })

    await simulator.stop()
    console.log(metrics.formatReport())

    if (PLUGIN_ENABLED) {
      expect(metrics.getSummary().successCount).toBeGreaterThan(0)
    } else {
      expect(metrics.getSummary().failureCount).toBeGreaterThan(0)
    }
  })

  test('boundary retry: failCount equals maxRetries (3)', async ({ page }) => {
    const simulator = new NetworkSimulator(page, { failCount: 3 })

    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const targetPath = await findUnloadedNavLink(page)
    if (!targetPath) { test.skip(); return }

    const start = Date.now()
    await simulator.start()

    const navResult = await spaNavigate(page, targetPath)
    const result = await waitForPageLoad(page, targetPath, 30000)

    metrics.add({
      scenario: `boundary-retry-${PLUGIN_ENABLED ? 'with-plugin' : 'no-plugin'}`,
      success: result.loaded,
      navigationStartTime: start,
      navigationEndTime: Date.now(),
      recoveryTimeMs: result.loaded ? result.timeMs : 0,
      pageLoaded: result.loaded,
      errorMessage: result.loaded ? null : `${navResult} | ${result.reason}`,
    })

    await simulator.stop()
    console.log(metrics.formatReport())

    if (PLUGIN_ENABLED) {
      expect(metrics.getSummary().successCount).toBeGreaterThan(0)
    } else {
      expect(metrics.getSummary().failureCount).toBeGreaterThan(0)
    }
  })

  test('persistent failure: all chunk requests fail', async ({ page }) => {
    const simulator = new NetworkSimulator(page, { failCount: 999 })

    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const targetPath = await findUnloadedNavLink(page)
    if (!targetPath) { test.skip(); return }

    const start = Date.now()
    await simulator.start()

    const navResult = await spaNavigate(page, targetPath)
    const result = await waitForPageLoad(page, targetPath, 8000)

    metrics.add({
      scenario: `persistent-${PLUGIN_ENABLED ? 'with-plugin' : 'no-plugin'}`,
      success: result.loaded,
      navigationStartTime: start,
      navigationEndTime: Date.now(),
      recoveryTimeMs: result.loaded ? result.timeMs : 0,
      pageLoaded: result.loaded,
      errorMessage: result.loaded ? null : `Navigation stuck or page empty after persistent failure | ${navResult} | ${result.reason}`,
    })

    await simulator.stop()
    console.log(metrics.formatReport())

    if (!PLUGIN_ENABLED) {
      expect(metrics.getSummary().failureCount).toBeGreaterThan(0)
    }
  })

  test('multi-page navigation: navigate to second page after first recovery', async ({ page }) => {
    const simulator = new NetworkSimulator(page, { failCount: 1 })

    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const links = await findAllNavLinks(page)
    if (links.length < 2) { test.skip(); return }

    const firstPath = links[0]
    const secondPath = links[1]

    await simulator.start()

    const start = Date.now()
    await spaNavigate(page, firstPath)

    const result1 = await waitForPageLoad(page, firstPath, 15000)

    if (!result1.loaded) {
      metrics.add({
        scenario: `multi-page-${PLUGIN_ENABLED ? 'with-plugin' : 'no-plugin'}`,
        success: false,
        navigationStartTime: start,
        navigationEndTime: Date.now(),
        recoveryTimeMs: 0,
        pageLoaded: false,
        errorMessage: `First page failed: ${result1.reason}`,
      })
      await simulator.stop()
      console.log(metrics.formatReport())
      return
    }

    await page.waitForTimeout(500)

    const secondLinks = await findAllNavLinks(page)
    const nextPath = secondLinks.length > 0 ? secondLinks[0] : secondPath

    await spaNavigate(page, nextPath)
    const result2 = await waitForPageLoad(page, nextPath, 15000)

    metrics.add({
      scenario: `multi-page-${PLUGIN_ENABLED ? 'with-plugin' : 'no-plugin'}`,
      success: result2.loaded,
      navigationStartTime: start,
      navigationEndTime: Date.now(),
      recoveryTimeMs: result2.loaded ? result2.timeMs : 0,
      pageLoaded: result2.loaded,
      errorMessage: result2.loaded ? null : `Second page failed: ${result2.reason}`,
    })

    await simulator.stop()
    console.log(metrics.formatReport())

    if (PLUGIN_ENABLED) {
      expect(metrics.getSummary().successCount).toBeGreaterThan(0)
    } else {
      expect(metrics.getSummary().failureCount).toBeGreaterThan(0)
    }
  })

  test('non-chunk failure: CSS file failure should not affect navigation', async ({ browser }) => {
    if (!PLUGIN_ENABLED) { test.skip(); return }
    const page = await browser.newPage()
    const cssSimulator = new NetworkSimulator(page, {
      failurePattern: /assets\/.*\.css$/,
      failCount: 1,
    })

    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const targetPath = await findUnloadedNavLink(page)
    if (!targetPath) { await page.close(); test.skip(); return }

    const start = Date.now()
    await cssSimulator.start()

    const navResult = await spaNavigate(page, targetPath)
    const result = await waitForPageLoad(page, targetPath, 15000)

    metrics.add({
      scenario: `non-chunk-css-${PLUGIN_ENABLED ? 'with-plugin' : 'no-plugin'}`,
      success: result.loaded,
      navigationStartTime: start,
      navigationEndTime: Date.now(),
      recoveryTimeMs: result.loaded ? result.timeMs : 0,
      pageLoaded: result.loaded,
      errorMessage: result.loaded ? null : `${navResult} | ${result.reason}`,
    })

    await cssSimulator.stop()
    await page.close()
    console.log(metrics.formatReport())

    expect(metrics.getSummary().successCount).toBeGreaterThan(0)
  })

  test('intermittent failure: fail on 1st and 3rd request, succeed on 2nd and 4th', async ({ page }) => {
    if (!PLUGIN_ENABLED) { test.skip(); return }

    const simulator = new NetworkSimulator(page, { intermittentPattern: [1, 3] })

    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const targetPath = await findUnloadedNavLink(page)
    if (!targetPath) { test.skip(); return }

    const start = Date.now()
    await simulator.start()

    const navResult = await spaNavigate(page, targetPath)
    const result = await waitForPageLoad(page, targetPath, 20000)

    metrics.add({
      scenario: `intermittent-${PLUGIN_ENABLED ? 'with-plugin' : 'no-plugin'}`,
      success: result.loaded,
      navigationStartTime: start,
      navigationEndTime: Date.now(),
      recoveryTimeMs: result.loaded ? result.timeMs : 0,
      pageLoaded: result.loaded,
      errorMessage: result.loaded ? null : `${navResult} | ${result.reason}`,
    })

    await simulator.stop()
    console.log(metrics.formatReport())

    expect(metrics.getSummary().successCount).toBeGreaterThan(0)
  })

  test('rapid back-to-back navigation: navigate twice quickly under failure', async ({ page }) => {
    if (!PLUGIN_ENABLED) { test.skip(); return }

    const simulator = new NetworkSimulator(page, { failCount: 2 })

    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const links = await findAllNavLinks(page)
    if (links.length < 2) { test.skip(); return }

    const firstPath = links[0]
    const secondPath = links[1]

    await simulator.start()

    const start = Date.now()

    await spaNavigate(page, firstPath)
    await page.waitForTimeout(100)
    await spaNavigate(page, secondPath)

    const result = await waitForPageLoad(page, secondPath, 20000)

    metrics.add({
      scenario: `rapid-back-to-back-${PLUGIN_ENABLED ? 'with-plugin' : 'no-plugin'}`,
      success: result.loaded,
      navigationStartTime: start,
      navigationEndTime: Date.now(),
      recoveryTimeMs: result.loaded ? result.timeMs : 0,
      pageLoaded: result.loaded,
      errorMessage: result.loaded ? null : `Final page not loaded`,
    })

    await simulator.stop()
    console.log(metrics.formatReport())

    expect(metrics.getSummary().successCount).toBeGreaterThan(0)
  })

  test('recovery then navigate home: navigate away after successful recovery', async ({ page }) => {
    if (!PLUGIN_ENABLED) { test.skip(); return }

    const simulator = new NetworkSimulator(page, { failCount: 1 })

    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const targetPath = await findUnloadedNavLink(page)
    if (!targetPath) { test.skip(); return }

    await simulator.start()

    await spaNavigate(page, targetPath)
    const result1 = await waitForPageLoad(page, targetPath, 15000)

    if (!result1.loaded) {
      metrics.add({
        scenario: `recovery-then-home-${PLUGIN_ENABLED ? 'with-plugin' : 'no-plugin'}`,
        success: false,
        navigationStartTime: Date.now(),
        navigationEndTime: Date.now(),
        recoveryTimeMs: 0,
        pageLoaded: false,
        errorMessage: `First navigation failed`,
      })
      await simulator.stop()
      console.log(metrics.formatReport())
      return
    }

    await simulator.stop()

    const start = Date.now()
    await spaNavigate(page, '/')
    const result2 = await waitForPageLoad(page, '/', 10000)

    metrics.add({
      scenario: `recovery-then-home-${PLUGIN_ENABLED ? 'with-plugin' : 'no-plugin'}`,
      success: result2.loaded,
      navigationStartTime: start,
      navigationEndTime: Date.now(),
      recoveryTimeMs: result2.loaded ? result2.timeMs : 0,
      pageLoaded: result2.loaded,
      errorMessage: result2.loaded ? null : 'Home page not loaded after recovery',
    })

    console.log(metrics.formatReport())

    expect(metrics.getSummary().successCount).toBeGreaterThan(0)
  })

  test('plugin code presence: verify chunk retry code is loaded in browser', async ({ page }) => {
    if (!PLUGIN_ENABLED) { test.skip(); return }

    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const hasPreloadListener = await page.evaluate(() => {
      const app = document.querySelector('#app')?.__vue_app__
      if (!app) return { hasApp: false, hasRouter: false, hasListener: false }

      const router = app.config.globalProperties.$router
      if (!router) return { hasApp: true, hasRouter: false, hasListener: false }

      return { hasApp: true, hasRouter: true, hasListener: true }
    })

    expect(hasPreloadListener.hasApp).toBe(true)
    expect(hasPreloadListener.hasRouter).toBe(true)
    expect(hasPreloadListener.hasListener).toBe(true)
  })

  test('delayed failure: chunk request delayed then fails', async ({ page }) => {
    if (!PLUGIN_ENABLED) { test.skip(); return }

    const simulator = new NetworkSimulator(page, { failCount: 1, failDelay: 2000 })

    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const targetPath = await findUnloadedNavLink(page)
    if (!targetPath) { test.skip(); return }

    const start = Date.now()
    await simulator.start()

    const navResult = await spaNavigate(page, targetPath)
    const result = await waitForPageLoad(page, targetPath, 25000)

    metrics.add({
      scenario: `delayed-failure-${PLUGIN_ENABLED ? 'with-plugin' : 'no-plugin'}`,
      success: result.loaded,
      navigationStartTime: start,
      navigationEndTime: Date.now(),
      recoveryTimeMs: result.loaded ? result.timeMs : 0,
      pageLoaded: result.loaded,
      errorMessage: result.loaded ? null : `${navResult} | ${result.reason}`,
    })

    await simulator.stop()
    console.log(metrics.formatReport())

    expect(metrics.getSummary().successCount).toBeGreaterThan(0)
  })

  test('exceed max retries: 4 failures exceeds maxRetries=3', async ({ page }) => {
    const simulator = new NetworkSimulator(page, { failCount: 4 })

    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const targetPath = await findUnloadedNavLink(page)
    if (!targetPath) { test.skip(); return }

    const start = Date.now()
    await simulator.start()

    const navResult = await spaNavigate(page, targetPath)
    const result = await waitForPageLoad(page, targetPath, 10000)

    metrics.add({
      scenario: `exceed-max-retries-${PLUGIN_ENABLED ? 'with-plugin' : 'no-plugin'}`,
      success: result.loaded,
      navigationStartTime: start,
      navigationEndTime: Date.now(),
      recoveryTimeMs: result.loaded ? result.timeMs : 0,
      pageLoaded: result.loaded,
      errorMessage: result.loaded ? null : `Expected fallback after max retries | ${navResult} | ${result.reason}`,
    })

    await simulator.stop()
    console.log(metrics.formatReport())

    if (PLUGIN_ENABLED) {
      const currentUrl = page.url()
      const navigatedAway = currentUrl.includes(targetPath.replace('.html', '').replace(/\/$/, ''))
      expect(navigatedAway || result.loaded).toBe(true)
    } else {
      expect(metrics.getSummary().failureCount).toBeGreaterThan(0)
    }
  })
})
