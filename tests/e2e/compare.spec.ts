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

const PLUGIN_ENABLED = process.env.CHUNK_RETRY_PLUGIN !== 'disabled'

test.describe(`${PLUGIN_ENABLED ? 'WITH' : 'WITHOUT'} plugin: SPA navigation chunk failure`, () => {
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

    try {
      await page.waitForURL(`**${targetPath.replace(/\.html$/, '').replace(/\/$/, '')}**`, { timeout: 15000 })
      const end = Date.now()

      metrics.add({
        scenario: `single-transient-${PLUGIN_ENABLED ? 'with-plugin' : 'no-plugin'}`,
        success: true,
        navigationStartTime: start,
        navigationEndTime: end,
        recoveryTimeMs: end - start,
        pageLoaded: true,
        errorMessage: null,
      })
    } catch (error) {
      const end = Date.now()
      metrics.add({
        scenario: `single-transient-${PLUGIN_ENABLED ? 'with-plugin' : 'no-plugin'}`,
        success: false,
        navigationStartTime: start,
        navigationEndTime: end,
        recoveryTimeMs: end - start,
        pageLoaded: false,
        errorMessage: `${navResult} | ${error instanceof Error ? error.message : String(error)}`,
      })
    }

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

    try {
      await page.waitForURL(`**${targetPath.replace(/\.html$/, '').replace(/\/$/, '')}**`, { timeout: 20000 })
      const end = Date.now()

      metrics.add({
        scenario: `consecutive-${PLUGIN_ENABLED ? 'with-plugin' : 'no-plugin'}`,
        success: true,
        navigationStartTime: start,
        navigationEndTime: end,
        recoveryTimeMs: end - start,
        pageLoaded: true,
        errorMessage: null,
      })
    } catch (error) {
      const end = Date.now()
      metrics.add({
        scenario: `consecutive-${PLUGIN_ENABLED ? 'with-plugin' : 'no-plugin'}`,
        success: false,
        navigationStartTime: start,
        navigationEndTime: end,
        recoveryTimeMs: end - start,
        pageLoaded: false,
        errorMessage: `${navResult} | ${error instanceof Error ? error.message : String(error)}`,
      })
    }

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

    await page.waitForTimeout(8000)

    const currentUrl = page.url()
    const urlChanged = currentUrl.includes(targetPath.replace('.html', '').replace(/\/$/, ''))

    const pageContent = await page.evaluate(() => {
      const main = document.querySelector('.vp-page')
      return main ? main.innerHTML.length : 0
    })

    const end = Date.now()

    const actuallyLoaded = urlChanged && pageContent > 100

    metrics.add({
      scenario: `persistent-${PLUGIN_ENABLED ? 'with-plugin' : 'no-plugin'}`,
      success: actuallyLoaded,
      navigationStartTime: start,
      navigationEndTime: end,
      recoveryTimeMs: actuallyLoaded ? end - start : 0,
      pageLoaded: actuallyLoaded,
      errorMessage: actuallyLoaded ? null : `Navigation stuck or page empty after persistent failure | ${navResult} | urlChanged=${urlChanged} contentLen=${pageContent}`,
    })

    await simulator.stop()
    console.log(metrics.formatReport())

    if (!PLUGIN_ENABLED) {
      expect(metrics.getSummary().failureCount).toBeGreaterThan(0)
    }
  })
})
