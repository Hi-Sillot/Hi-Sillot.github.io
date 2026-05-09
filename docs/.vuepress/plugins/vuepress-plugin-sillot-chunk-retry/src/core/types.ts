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
  push(to: string): Promise<unknown>
  replace(to: string): Promise<unknown>
  resolve(to: string): RouteLocationNormalized
  currentRoute: { value: RouteLocationNormalized }
}

export interface ChunkRetryOptions {
  maxRetries?: number
  retryDelay?: number
  retryKey?: string
  showStatus?: boolean
}
