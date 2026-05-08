import { test, expect } from '@playwright/test'

test('basic navigation without network failure', async ({ page }) => {
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  
  const targetPath = await page.evaluate(() => {
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
  
  console.log('Found target path:', targetPath)
  if (!targetPath) { test.skip(); return }
  
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
  
  await page.waitForTimeout(3000)
  console.log('Current URL:', page.url())
  
  const contentLen = await page.evaluate(() => {
    const main = document.querySelector('.vp-page')
    return main ? main.innerHTML.length : 0
  })
  console.log('Content length:', contentLen)
  
  expect(navResult).toBe('spa-ok')
})
