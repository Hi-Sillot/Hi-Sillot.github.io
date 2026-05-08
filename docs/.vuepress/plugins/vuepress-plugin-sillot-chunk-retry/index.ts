import type { Plugin } from '@vuepress/core'
import { getDirname, path } from 'vuepress/utils'

const __dirname = getDirname(import.meta.url)

const TAG = 'vuepress-plugin-sillot-chunk-retry'

export default (): Plugin => ({
  name: TAG,
  clientConfigFile: path.resolve(__dirname, './client.ts'),
})

export { ChunkRetryManager } from './src/core/ChunkRetryManager'
