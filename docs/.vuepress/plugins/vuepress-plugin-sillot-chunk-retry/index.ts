import type { Plugin } from '@vuepress/core'
import { path } from '@vuepress/utils'

const TAG = 'vuepress-plugin-sillot-chunk-retry'

export default (): Plugin => ({
  name: TAG,
  clientConfigFile: path.resolve(__dirname, './client.ts'),
})
