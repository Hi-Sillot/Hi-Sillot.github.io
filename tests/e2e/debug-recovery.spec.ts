import { test, expect } from '@playwright/test'

test('debug: full recovery flow with plugin', async ({ page }) => {
  await page.goto('/')
  await page.waitForLoadState('networkidle')

  const consoleMessages: string[] = []
  page.on('console', msg => {
    consoleMessages.push(`[${msg.type()}] ${msg.text()}`)
  })

  const targetPath = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a.vp-link[href]'))
    const navLink = links.find(a => {
      const href = a.getAttribute('href')
      return href && !href.startsWith('#') && !href.startsWith('http') && !href.startsWith('mailto:') && href !== '/'
    })
    return navLink?.getAttribute('href') || null
  })
  
  console.log('Target path:', targetPath)
  if (!targetPath) { test.skip(); return }

  let failCount = 0
  await page.route(/assets\/.*\.js$/, async (route) => {
    const url = route.request().url()
    failCount++
    if (failCount <= 1) {
      console.log(`ABORTING request #${failCount}:`, url)
      await route.abort('failed')
    } else {
      console.log(`ALLOWING request #${failCount}:`, url)
      await route.continue()
    }
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
  
  console.log('Initial navigation result:', navResult)

  await page.waitForTimeout(5000)
  
  const currentUrl = page.url()
  console.log('Current URL after 5s:', currentUrl)

  const pageState = await page.evaluate(() => {
    const main = document.querySelector('.vp-page')
    const content = document.querySelector('.vp-doc')
    return {
      url: window.location.href,
      pathname: window.location.pathname,
      hasMainContent: !!main,
      mainContentLength: main ? main.innerHTML.length : 0,
      hasDocContent: !!content,
      docContentLength: content ? content.innerHTML.length : 0,
      title: document.title,
    }
  })
  console.log('Page state:', JSON.stringify(pageState, null, 2))
  console.log('Console messages:', consoleMessages.filter(m => m.includes('error') || m.includes('Error') || m.includes('chunk') || m.includes('retry') || m.includes('ChunkRetry')).join('\n'))

  await page.unroute(/assets\/.*\.js$/)
})
