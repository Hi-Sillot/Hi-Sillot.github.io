export interface RouteLocationNormalized {
  path: string
  fullPath: string
  name: string | symbol | null | undefined
  matched: Array<{ name?: string | symbol | null }>
  meta: Record<string, unknown>
}

export interface RouterLike {
  beforeEach(guard: (to: RouteLocationNormalized, from: RouteLocationNormalized) => void): () => void
  afterEach(guard: (to: RouteLocationNormalized, from: RouteLocationNormalized) => void): () => void
  onError(handler: (error: Error, to: RouteLocationNormalized, from: RouteLocationNormalized) => void): () => void
  getRoutes(): Array<{
    name?: string | symbol | null
    path: string
    meta: Record<string, unknown>
    components?: Record<string, unknown>
    props?: Record<string, unknown>
  }>
  removeRoute(name: string | symbol): void
  addRoute(route: Record<string, unknown>): void
  push(to: string): Promise<unknown>
  resolve(to: string): RouteLocationNormalized
}

export interface ChunkRetryOptions {
  maxRetries?: number
  retryDelay?: number
  retryKey?: string
  showToast?: boolean
}
