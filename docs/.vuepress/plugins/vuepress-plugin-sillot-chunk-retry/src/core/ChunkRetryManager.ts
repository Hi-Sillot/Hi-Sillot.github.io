import type { RouterLike, RouteLocationNormalized, ChunkRetryOptions } from './types'
import { extractFailedUrl } from '../utils/extract-url'
import { isDynamicImportError } from '../utils/is-dynamic-import-error'

const DEFAULT_OPTIONS: Required<ChunkRetryOptions> = {
  maxRetries: 3,
  retryDelay: 1000,
  retryKey: 'chunk-retry-attempted',
}

export class ChunkRetryManager {
  private router: RouterLike
  private options: Required<ChunkRetryOptions>
  private pendingTarget: RouteLocationNormalized | null = null
  private pendingRecovery: Promise<void> | null = null
  private retryCount = 0
  private isRecovering = false
  private prefetchPromise: Promise<any> | null = null
  private prefetchUrl: string | null = null
  private recoveredUrls: Set<string> = new Set()
  private recoveredModules: Map<string, any> = new Map()
  private phantomRetryCount = 0
  private recoveryGeneration = 0
  private recoveryTarget: RouteLocationNormalized | null = null

  constructor(router: RouterLike, options: ChunkRetryOptions = {}) {
    this.router = router
    this.options = { ...DEFAULT_OPTIONS, ...options }
  }

  init(): void {
    if (typeof window === 'undefined') return

    this.router.beforeEach((to: RouteLocationNormalized) => {
      this.pendingTarget = to
    })

    this.router.afterEach(() => {
      this.pendingTarget = null
      this.retryCount = 0
      this.isRecovering = false
      this.recoveryTarget = null
      this.prefetchPromise = null
      this.prefetchUrl = null
      this.recoveredUrls.clear()
      this.recoveredModules.clear()
      this.phantomRetryCount = 0
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

    if (this.recoveredUrls.has(failedUrl) && this.recoveredModules.has(failedUrl)) {
      return
    }

    if (!this.prefetchUrl || this.prefetchUrl !== failedUrl) {
      this.prefetchUrl = failedUrl
      this.prefetchPromise = this.retryImportWithCacheBusting(failedUrl)
        .then(module => {
          this.recoveredUrls.add(failedUrl)
          this.recoveredModules.set(failedUrl, module)
          return module
        })
        .catch(() => null)
    }
  }

  private handleRouterError(error: Error, to: RouteLocationNormalized): void {
    if (!isDynamicImportError(error)) return

    if (this.isRecovering) {
      if (this.recoveryTarget && this.recoveryTarget.fullPath !== to.fullPath) {
        this.isRecovering = false
        this.pendingRecovery = null
        this.recoveryTarget = null
        this.retryCount = 0
        sessionStorage.removeItem(this.options.retryKey)
      } else {
        if (this.pendingRecovery) {
          this.pendingRecovery.catch(() => this.fallbackNavigation(to))
        }
        return
      }
    }

    const failedUrl = extractFailedUrl(error)

    if (failedUrl && this.recoveredUrls.has(failedUrl)) {
      this.phantomRetryCount++
      if (this.phantomRetryCount <= 3) {
        this.router.push(to.fullPath).catch(() => {
          this.fallbackNavigation(to)
        })
        return
      }
      this.fallbackNavigation(to)
      return
    }

    if (sessionStorage.getItem(this.options.retryKey)) return

    this.isRecovering = true
    this.recoveryGeneration++
    this.recoveryTarget = to
    sessionStorage.setItem(this.options.retryKey, String(Date.now()))

    if (failedUrl && this.retryCount < this.options.maxRetries) {
      this.pendingRecovery = this.recoverWithCacheBusting(failedUrl, to, this.recoveryGeneration)
      this.pendingRecovery.finally(() => { this.pendingRecovery = null })
    } else {
      this.fallbackNavigation(to)
    }
  }

  private async recoverWithCacheBusting(failedUrl: string, to: RouteLocationNormalized, generation: number): Promise<void> {
    try {
      let module: any

      if (this.prefetchPromise && this.prefetchUrl === failedUrl) {
        module = await this.prefetchPromise
        this.prefetchPromise = null
        this.prefetchUrl = null
        if (module) {
          this.recoveredUrls.add(failedUrl)
          this.recoveredModules.set(failedUrl, module)
        }
      }

      if (this.recoveryGeneration !== generation) return

      if (!module) {
        module = await this.retryImportWithCacheBusting(failedUrl)
        this.recoveredUrls.add(failedUrl)
        this.recoveredModules.set(failedUrl, module)
      }

      if (this.recoveryGeneration !== generation) return

      await this.updateRouteAndRetry(to, module)
    } catch {
      if (this.recoveryGeneration !== generation) return

      this.retryCount++
      if (this.retryCount < this.options.maxRetries) {
        const delay = this.options.retryDelay * this.retryCount
        await new Promise(resolve => setTimeout(resolve, delay))
        this.isRecovering = false
        sessionStorage.removeItem(this.options.retryKey)
        await this.recoverWithCacheBusting(failedUrl, to, generation)
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

    const cachedModule = module
    const routeConfig = {
      path: matchedRoute.path,
      name: matchedRoute.name,
      component: () => Promise.resolve(cachedModule),
      meta: matchedRoute.meta || {},
      props: matchedRoute.props ?? true,
    }

    this.router.removeRoute(targetName)
    this.router.addRoute(routeConfig)

    this.isRecovering = false
    sessionStorage.removeItem(this.options.retryKey)
    this.phantomRetryCount = 0

    try {
      await this.router.push(to.fullPath)
    } catch {
      this.fallbackNavigation(to)
    }
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
