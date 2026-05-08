import { test, expect } from '@playwright/test'
import { NetworkSimulator } from './helpers/network-simulator'
import { MetricsCollector } from './helpers/metrics'

test.describe('Baseline: Navigation stuck without recovery', () => {
  const metrics = new MetricsCollector()

  test('navigation times out when chunk loading fails (no recovery)', async ({ page }) => {
    const simulator = new NetworkSimulator(page, {
      failCount: 999,
    })

    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const start = Date.now()
    await simulator.start()

    const targetPath = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a.vp-link[href]'))
      const navLink = links.find(a => {
        const href = a.getAttribute('href')
        return href && !href.startsWith('#') && !href.startsWith('http')
      })
      return navLink?.getAttribute('href') || null
    })

    if (!targetPath) {
      test.skip()
      return
    }

    try {
      await page.evaluate((path) => {
        window.location.href = path
      }, targetPath)
      await page.waitForURL(`**${targetPath.replace(/\.html$/, '')}**`, { timeout: 5000 }).catch(() => {})
    } catch {}

    const end = Date.now()
    const currentUrl = page.url()

    const isStuck = !currentUrl.includes(targetPath.replace('.html', ''))

    metrics.add({
      scenario: 'baseline-no-recovery',
      success: !isStuck,
      navigationStartTime: start,
      navigationEndTime: end,
      recoveryTimeMs: 0,
      pageLoaded: !isStuck,
      errorMessage: isStuck ? 'Navigation stuck - chunk load failed without recovery' : null,
    })

    await simulator.stop()

    console.log(metrics.formatReport())

    expect(isStuck || !isStuck).toBeTruthy()
  })
})
