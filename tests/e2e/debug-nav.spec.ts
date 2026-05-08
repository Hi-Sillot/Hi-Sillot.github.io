import { test, expect } from '@playwright/test'

test('debug: check what requests are made during navigation', async ({ page }) => {
  const requests: string[] = []
  page.on('request', req => {
    if (req.url().includes('/assets/') && req.url().endsWith('.js')) {
      requests.push(req.url())
    }
  })

  await page.goto('/')
  await page.waitForLoadState('networkidle')
  
  const targetPath = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a.vp-link[href]'))
    const navLink = links.find(a => {
      const href = a.getAttribute('href')
      return href && !href.startsWith('#') && !href.startsWith('http') && !href.startsWith('mailto:') && href !== '/'
    })
    return navLink?.getAttribute('href') || null
  })
  
  console.log('Target path:', targetPath)
  requests.length = 0

  await page.route(/assets\/.*\.js$/, async (route) => {
    const url = route.request().url()
    console.log('INTERCEPTED:', url)
    await route.abort('failed')
  })

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
  console.log('Requests after nav:', requests)
  
  await page.waitForTimeout(2000)
  console.log('Current URL:', page.url())
})
