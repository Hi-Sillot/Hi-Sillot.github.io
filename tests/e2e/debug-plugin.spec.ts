import { test, expect } from '@playwright/test'

test('debug: verify plugin loads and handles errors in production build', async ({ page }) => {
  page.on('console', (msg) => {
    if (msg.type() === 'log' || msg.type() === 'error' || msg.type() === 'warning') {
      console.log(`[BROWSER ${msg.type()}]`, msg.text())
    }
  })

  page.on('pageerror', (error) => {
    console.log('[BROWSER PAGE ERROR]', error.message)
  })

  await page.goto('/')
  await page.waitForLoadState('networkidle')

  const pluginCheck = await page.evaluate(() => {
    const app = document.querySelector('#app')?.__vue_app__
    if (!app) return 'no-vue-app'

    const router = app.config.globalProperties.$router
    if (!router) return 'no-router'

    const listeners = window.__chunkRetryDebug || 'no-debug-flag'

    return {
      hasVue: true,
      hasRouter: true,
      debugFlag: listeners,
      routerHooks: {
        beforeEach: (router as any).beforeEach ? 'yes' : 'no',
        afterEach: (router as any).afterEach ? 'yes' : 'no',
        onError: (router as any).onError ? 'yes' : 'no',
      }
    }
  })

  console.log('Plugin check:', JSON.stringify(pluginCheck, null, 2))

  let interceptedCount = 0
  await page.route(/assets\/.*\.js$/, async (route) => {
    interceptedCount++
    const url = route.request().url()
    console.log(`[ROUTE] #${interceptedCount} ${url}`)

    if (interceptedCount <= 1) {
      console.log(`[ROUTE] ABORTING #${interceptedCount}`)
      await route.abort('failed')
    } else {
      console.log(`[ROUTE] CONTINUING #${interceptedCount}`)
      await route.continue()
    }
  })

  const targetPath = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a.vp-link[href]'))
    const navLink = links.find(a => {
      const href = a.getAttribute('href')
      return href && !href.startsWith('#') && !href.startsWith('http') && href !== '/'
    })
    return navLink?.getAttribute('href') || null
  })

  console.log('Target path:', targetPath)

  if (!targetPath) {
    await page.unroute(/assets\/.*\.js$/)
    test.skip()
    return
  }

  const navResult = await page.evaluate((targetPath) => {
    const app = document.querySelector('#app')?.__vue_app__
    if (!app) return 'no-vue-app'
    const router = app.config.globalProperties.$router
    if (!router) return 'no-router'
    return router.push(targetPath)
      .then(() => 'spa-ok')
      .catch((e) => `spa-error:${e.message || e}`)
  }, targetPath)

  console.log('Navigation result:', navResult)

  await page.waitForTimeout(5000)

  console.log('Intercepted count:', interceptedCount)
  console.log('Current URL:', page.url())

  await page.unroute(/assets\/.*\.js$/)
})
