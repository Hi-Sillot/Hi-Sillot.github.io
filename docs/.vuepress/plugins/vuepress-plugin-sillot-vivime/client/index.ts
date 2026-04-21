import { getDirname, path } from 'vuepress/utils'

const __dirname = getDirname(import.meta.url)

import { defineClientConfig } from 'vuepress/client'

export default defineClientConfig({
  enhance({ app, router, siteData }) {},
  setup() {},
  layouts: {},
  rootComponents: [],
})