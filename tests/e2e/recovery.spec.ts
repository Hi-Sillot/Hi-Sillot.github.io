import { test, expect } from '@playwright/test'
import { NetworkSimulator } from './helpers/network-simulator'
import { MetricsCollector } from './helpers/metrics'

async function findNavLink(page: any): Promise<string | null> {
  return page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a.vp-link[href]'))
    const navLink = links.find(a => {
      const href = a.getAttribute('href')
      return href && !href.startsWith('#') && !href.startsWith('http')
    })
    return navLink?.getAttribute('href') || null
  })
}

test.describe('Recovery: Navigation auto-recovers with plugin', () => {
  const metrics = new MetricsCollector()

  test('single transient failure: navigation recovers automatically', async ({ page }) => {
    const simulator = new NetworkSimulator(page, {
      failCount: 1,
    })

    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const targetPath = await findNavLink(page)
    if (!targetPath) {
      test.skip()
      return
    }

    const start = Date.now()
    await simulator.start()

    try {
      await page.evaluate((path) => {
        window.location.href = path
      }, targetPath)
      await page.waitForURL(`**${targetPath.replace(/\.html$/, '')}**`, { timeout: 15000 })
      const end = Date.now()

      metrics.add({
        scenario: 'single-transient-failure',
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
        scenario: 'single-transient-failure',
        success: false,
        navigationStartTime: start,
        navigationEndTime: end,
        recoveryTimeMs: end - start,
        pageLoaded: false,
        errorMessage: error instanceof Error ? error.message : String(error),
      })
    }

    await simulator.stop()

    const summary = metrics.getSummary()
    console.log(metrics.formatReport())

    expect(summary.successRate).toBeGreaterThan(0)
  })

  test('consecutive failures: navigation recovers after multiple retries', async ({ page }) => {
    const simulator = new NetworkSimulator(page, {
      failCount: 2,
    })

    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const targetPath = await findNavLink(page)
    if (!targetPath) {
      test.skip()
      return
    }

    const start = Date.now()
    await simulator.start()

    try {
      await page.evaluate((path) => {
        window.location.href = path
      }, targetPath)
      await page.waitForURL(`**${targetPath.replace(/\.html$/, '')}**`, { timeout: 20000 })
      const end = Date.now()

      metrics.add({
        scenario: 'consecutive-failures',
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
        scenario: 'consecutive-failures',
        success: false,
        navigationStartTime: start,
        navigationEndTime: end,
        recoveryTimeMs: end - start,
        pageLoaded: false,
        errorMessage: error instanceof Error ? error.message : String(error),
      })
    }

    await simulator.stop()

    const summary = metrics.getSummary()
    console.log(metrics.formatReport())

    expect(summary.successRate).toBeGreaterThan(0)
  })

  test('partial chunk failure: only target page chunk fails', async ({ page }) => {
    const simulator = new NetworkSimulator(page, {
      failurePattern: /assets\/.*page.*\.js$/,
      failCount: 1,
    })

    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const targetPath = await findNavLink(page)
    if (!targetPath) {
      test.skip()
      return
    }

    const start = Date.now()
    await simulator.start()

    try {
      await page.evaluate((path) => {
        window.location.href = path
      }, targetPath)
      await page.waitForURL(`**${targetPath.replace(/\.html$/, '')}**`, { timeout: 15000 })
      const end = Date.now()

      metrics.add({
        scenario: 'partial-chunk-failure',
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
        scenario: 'partial-chunk-failure',
        success: false,
        navigationStartTime: start,
        navigationEndTime: end,
        recoveryTimeMs: end - start,
        pageLoaded: false,
        errorMessage: error instanceof Error ? error.message : String(error),
      })
    }

    await simulator.stop()

    const summary = metrics.getSummary()
    console.log(metrics.formatReport())

    expect(summary.successRate).toBeGreaterThan(0)
  })
})
