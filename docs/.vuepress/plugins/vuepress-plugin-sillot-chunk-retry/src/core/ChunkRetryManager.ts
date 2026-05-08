import type { RouterLike, RouteLocationNormalized, ChunkRetryOptions } from './types'
import { extractFailedUrl } from '../utils/extract-url'
import { isDynamicImportError } from '../utils/is-dynamic-import-error'

const DEFAULT_OPTIONS: Required<ChunkRetryOptions> = {
  maxRetries: 3,
  retryDelay: 1000,
  retryKey: 'chunk-retry-attempted',
}

const isClient = typeof window !== 'undefined'

export class ChunkRetryManager {
  private router: RouterLike
  private options: Required<ChunkRetryOptions>
  private pendingTarget: RouteLocationNormalized | null = null
  private retryCount = 0
  private isRecovering = false

  constructor(router: RouterLike, options: ChunkRetryOptions = {}) {
    this.router = router
    this.options = { ...DEFAULT_OPTIONS, ...options }
  }

  init(): void {
    if (!isClient) return

    this.router.beforeEach((to: RouteLocationNormalized) => {
      this.pendingTarget = to
    })

    this.router.afterEach(() => {
      this.pendingTarget = null
      this.retryCount = 0
      this.isRecovering = false
      sessionStorage.removeItem(this.options.retryKey)
    })

    this.router.onError(this.handleRouterError.bind(this))

    window.addEventListener('vite:preloadError', this.handlePreloadError.bind(this) as (ev: Event) => void)
  }

  private handlePreloadError(event: Event & { payload?: Error }): void {
    const error = event.payload
    if (!error) return

    const failedUrl = extractFailedUrl(error)
    if (!failedUrl) return

    event.preventDefault()

    this.retryImportWithCacheBusting(failedUrl).catch(() => {})
  }

  private handleRouterError(error: Error, to: RouteLocationNormalized): void {
    if (!isDynamicImportError(error)) return
    if (this.isRecovering) return
    if (sessionStorage.getItem(this.options.retryKey)) return

    this.isRecovering = true
    sessionStorage.setItem(this.options.retryKey, String(Date.now()))

    const failedUrl = extractFailedUrl(error)

    if (failedUrl && this.retryCount < this.options.maxRetries) {
      this.recoverWithCacheBusting(failedUrl, to)
    } else {
      this.fallbackNavigation(to)
    }
  }

  private async recoverWithCacheBusting(failedUrl: string, to: RouteLocationNormalized): Promise<void> {
    try {
      const module = await this.retryImportWithCacheBusting(failedUrl)
      await this.updateRouteAndRetry(to, module)
    } catch {
      this.retryCount++
      if (this.retryCount < this.options.maxRetries) {
        await new Promise(resolve => setTimeout(resolve, this.options.retryDelay * this.retryCount))
        this.isRecovering = false
        sessionStorage.removeItem(this.options.retryKey)
        this.recoverWithCacheBusting(failedUrl, to)
      } else {
        this.fallbackNavigation(to)
      }
    }
  }

  private async retryImportWithCacheBusting(url: string): Promise<any> {
    const separator = url.includes('?') ? '&' : '?'
    const retryUrl = `${url}${separator}t=${Date.now()}`
    return import(/* @vite-ignore */ retryUrl)
  }

  private async updateRouteAndRetry(to: RouteLocationNormalized, module: any): Promise<void> {
    const targetName = to.name
    if (!targetName) {
      this.fallbackNavigation(to)
      return
    }

    const routes = this.router.getRoutes()
    const matchedRoute = routes.find(r => r.name === targetName)

    if (!matchedRoute) {
      this.fallbackNavigation(to)
      return
    }

    this.router.removeRoute(targetName)

    this.router.addRoute({
      path: matchedRoute.path,
      name: matchedRoute.name,
      component: module.default || module,
      meta: matchedRoute.meta || {},
    })

    await this.router.push(to.fullPath)
  }

  private fallbackNavigation(to: RouteLocationNormalized): void {
    const target = to.fullPath
    if (location.pathname + location.search !== target) {
      location.href = target
    } else {
      location.reload()
    }
  }
}
