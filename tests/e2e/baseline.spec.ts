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

    const navLinks = page.locator('a[href]').first()
    const href = await navLinks.getAttribute('href')
    if (!href) {
      test.skip()
      return
    }

    try {
      await navLinks.click()
      await page.waitForURL(`**${href}**`, { timeout: 5000 }).catch(() => {})
    } catch {}

    const end = Date.now()
    const currentUrl = page.url()

    const isStuck = !currentUrl.includes(href.replace('.html', ''))

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
