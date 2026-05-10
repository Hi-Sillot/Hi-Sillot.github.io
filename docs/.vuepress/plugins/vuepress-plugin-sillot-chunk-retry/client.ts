import { defineClientConfig, useRoutes, resolveRoutePath } from 'vuepress/client'
import { ChunkRetryManager } from './src/core/ChunkRetryManager'

let manager: ChunkRetryManager | null = null

export default defineClientConfig({
  enhance({ router }) {
    manager = new ChunkRetryManager(router as any)
    manager.init()
  },
  setup() {
    const routes = useRoutes()
    manager?.setRoutes(routes)
    manager?.setResolveRoutePath(resolveRoutePath)
  },
})
