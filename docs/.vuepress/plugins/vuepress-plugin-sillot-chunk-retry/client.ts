import { defineClientConfig } from 'vuepress/client'
import { ChunkRetryManager } from './src/core/ChunkRetryManager'

export default defineClientConfig({
  enhance({ router }) {
    const manager = new ChunkRetryManager(router as any)
    manager.init()
  },
})
