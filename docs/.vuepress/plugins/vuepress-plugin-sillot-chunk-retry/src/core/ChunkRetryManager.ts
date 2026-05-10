import type { RouterLike, RouteLocationNormalized, ChunkRetryOptions } from './types'
import { extractFailedUrl } from '../utils/extract-url'
import { isDynamicImportError } from '../utils/is-dynamic-import-error'

const DEFAULT_OPTIONS: Required<ChunkRetryOptions> = {
  maxRetries: 3,
  retryDelay: 1000,
  retryKey: 'chunk-retry-attempted',
  showStatus: true,
}

class StatusIndicator {
  private bar: HTMLDivElement | null = null
  private timer: ReturnType<typeof setTimeout> | null = null
  private enabled: boolean

  constructor(enabled: boolean) {
    this.enabled = enabled
  }

  initUI(): void {
    if (!this.enabled || typeof document === 'undefined') return
    if (this.bar) return
    const existing = document.querySelector('#chunk-retry-status') as HTMLDivElement | null
    if (existing) {
      this.bar = existing
      return
    }
    this.bar = document.createElement('div')
    this.bar.id = 'chunk-retry-status'
    this.injectStyles()
    document.body.appendChild(this.bar)
  }

  showRecovering(): void {
    if (!this.bar) { this.initUI() }
    if (!this.bar) return
    this.bar.className = 'chunk-retry-status recovering'
    if (this.timer) { clearTimeout(this.timer); this.timer = null }
  }

  showSuccess(): void {
    if (!this.bar) return
    this.bar.className = 'chunk-retry-status success'
    if (this.timer) clearTimeout(this.timer)
    this.timer = setTimeout(() => this.hide(), 1500)
  }

  showFail(): void {
    if (!this.bar) return
    this.bar.className = 'chunk-retry-status fail'
    if (this.timer) clearTimeout(this.timer)
    this.timer = setTimeout(() => this.hide(), 3000)
  }

  hide(): void {
    if (!this.bar) return
    this.bar.className = ''
    if (this.timer) { clearTimeout(this.timer); this.timer = null }
  }

  destroy(): void {
    if (this.timer) clearTimeout(this.timer)
    if (this.bar) { this.bar.remove(); this.bar = null }
    const style = document.getElementById('chunk-retry-status-styles')
    if (style) style.remove()
  }

  private injectStyles(): void {
    const style = document.createElement('style')
    style.id = 'chunk-retry-status-styles'
    style.textContent = `
#chunk-retry-status{position:fixed;top:var(--vp-nav-height,64px);left:0;width:100%;height:3px;z-index:9999999;pointer-events:none;opacity:0;transition:opacity .4s ease,background .4s ease}
#chunk-retry-status.recovering{opacity:1;background:#58a6ff;box-shadow:0 0 8px rgba(88,166,255,.6);animation:chunk-retry-pulse 1.5s ease-in-out infinite}
#chunk-retry-status.success{opacity:1;background:#3fb950;box-shadow:0 0 8px rgba(63,185,80,.5);animation:none}
#chunk-retry-status.fail{opacity:1;background:#f85149;box-shadow:0 0 8px rgba(248,81,73,.5);animation:none}
@keyframes chunk-retry-pulse{0%,100%{opacity:1}50%{opacity:.5}}
`
    document.head.appendChild(style)
  }
}

interface LoaderRestore {
  routeKey: string
  originalLoader: () => Promise<any>
}

export class ChunkRetryManager {
  private router: RouterLike
  private options: Required<ChunkRetryOptions>
  private pendingRecovery: Promise<void> | null = null
  private retryCount = 0
  private isRecovering = false
  private recoveredModules: Map<string, any> = new Map()
  private pathModules: Map<string, any> = new Map()
  private recoveryGeneration = 0
  private status: StatusIndicator
  private preloadErrorHandler: ((ev: Event) => void) | null = null
  private pendingTarget: RouteLocationNormalized | null = null
  private unhandledRejectionHandler: ((ev: PromiseRejectionEvent) => void) | null = null
  private routes: Record<string, any> | null = null
  private pendingLoaderRestore: LoaderRestore | null = null
  private isApplyingModule = false
  private resolveRoutePathFn: ((pathname: string, currentPath?: string) => string) | null = null
  private lastRecoveredPath: string | null = null

  constructor(router: RouterLike, options: ChunkRetryOptions = {}) {
    this.router = router
    this.options = { ...DEFAULT_OPTIONS, ...options }
    this.status = new StatusIndicator(this.options.showStatus)
  }

  setRoutes(routes: Record<string, any>): void {
    this.routes = routes
  }

  setResolveRoutePath(fn: (pathname: string, currentPath?: string) => string): void {
    this.resolveRoutePathFn = fn
  }

  init(): void {
    if (typeof window === 'undefined') return

    window.__chunkRetryReady = true
    try { sessionStorage.removeItem('__chunkRetryCount') } catch {}

    this.router.beforeEach((to: RouteLocationNormalized) => {
      this.pendingTarget = to

      if (this.pathModules.has(to.path) && this.routes) {
        const module = this.pathModules.get(to.path)
        const result = this.patchRouteLoader(to.path, module)
        if (result) {
          this.pendingLoaderRestore = { routeKey: result.routeKey, originalLoader: result.originalLoader }
        }
      }
    })

    this.router.afterEach(() => {
      if (this.pendingLoaderRestore) {
        const { routeKey, originalLoader } = this.pendingLoaderRestore
        this.restoreRouteLoader(routeKey, originalLoader)
        this.pendingLoaderRestore = null
      }

      if (this.isRecovering || this.isApplyingModule) return

      this.retryCount = 0
      this.pathModules.clear()
      sessionStorage.removeItem(this.options.retryKey)
      this.status.hide()

      if (this.lastRecoveredPath !== null) {
        const currentPath = this.router.currentRoute.value?.path
        if (currentPath && currentPath !== this.lastRecoveredPath) {
          this.recoveredModules.clear()
          this.lastRecoveredPath = null
        }
      }
    })

    this.router.onError((error: Error, to: RouteLocationNormalized) => {
      if (this.isApplyingModule) return
      if (!isDynamicImportError(error)) return
      const target = this.pendingTarget || to
      this.handleChunkFailure(error, target)
    })

    this.preloadErrorHandler = ((event: Event & { payload?: Error }) => {
      const error = event.payload
      if (!error) return
      if (!isDynamicImportError(error)) return

      const failedUrl = extractFailedUrl(error)
      if (!failedUrl) return

      event.preventDefault()

      if (this.recoveredModules.has(failedUrl)) {
        this.tryReloadCurrentPage(failedUrl)
        return
      }

      if (this.isRecovering || this.isApplyingModule) return

      this.recoverSecondaryChunk(failedUrl)
    }) as (ev: Event) => void

    window.addEventListener('vite:preloadError', this.preloadErrorHandler)

    this.unhandledRejectionHandler = ((event: PromiseRejectionEvent) => {
      if (isDynamicImportError(event.reason)) {
        event.preventDefault()
      }
    }) as (ev: PromiseRejectionEvent) => void

    window.addEventListener('unhandledrejection', this.unhandledRejectionHandler)

    this.initUI()
  }

  initUI(): void {
    this.status.initUI()
  }

  destroy(): void {
    if (this.preloadErrorHandler) {
      window.removeEventListener('vite:preloadError', this.preloadErrorHandler)
      this.preloadErrorHandler = null
    }
    if (this.unhandledRejectionHandler) {
      window.removeEventListener('unhandledrejection', this.unhandledRejectionHandler)
      this.unhandledRejectionHandler = null
    }
    window.__chunkRetryReady = false
    this.status.destroy()
  }

  private handleChunkFailure(error: Error, to: RouteLocationNormalized): void {
    const failedUrl = extractFailedUrl(error)

    this.status.showRecovering()

    if (this.isRecovering) {
      if (this.pendingRecovery) {
        this.pendingRecovery.catch(() => this.fallbackNavigation(to))
      }
      return
    }

    if (failedUrl && this.recoveredModules.has(failedUrl)) {
      this.pathModules.set(to.path, this.recoveredModules.get(failedUrl))
      this.lastRecoveredPath = to.path
      this.navigateWithFallback(to)
      return
    }

    if (sessionStorage.getItem(this.options.retryKey)) return

    this.isRecovering = true
    this.recoveryGeneration++
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
      const module = await this.retryImportWithCacheBusting(failedUrl)
      this.recoveredModules.set(failedUrl, module)
      this.pathModules.set(to.path, module)
      this.lastRecoveredPath = to.path

      if (this.recoveryGeneration !== generation) return

      this.isRecovering = false
      sessionStorage.removeItem(this.options.retryKey)

      this.navigateWithFallback(to)
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
        this.status.showFail()
        this.fallbackNavigation(to)
      }
    }
  }

  private async retryImportWithCacheBusting(url: string): Promise<any> {
    const separator = url.includes('?') ? '&' : '?'
    const retryUrl = `${url}${separator}t=${Date.now()}`
    const TIMEOUT_MS = 15000
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`import timeout after ${TIMEOUT_MS}ms`)), TIMEOUT_MS)
      import(/* @vite-ignore */ retryUrl).then(
        (mod) => { clearTimeout(timer); resolve(mod) },
        (err) => { clearTimeout(timer); reject(err) },
      )
    })
  }

  private async recoverSecondaryChunk(failedUrl: string): Promise<void> {
    this.status.showRecovering()

    try {
      const module = await this.retryImportWithCacheBusting(failedUrl)
      this.recoveredModules.set(failedUrl, module)
      this.status.showSuccess()
      this.tryReloadCurrentPage(failedUrl)
    } catch {
      this.status.showFail()
      const currentPath = this.router.currentRoute.value?.fullPath
      if (currentPath) {
        this.fallbackNavigation(this.router.currentRoute.value as RouteLocationNormalized)
      }
    }
  }

  private secondaryReloadTimer: ReturnType<typeof setTimeout> | null = null
  private secondaryReloadCount = 0

  private tryReloadCurrentPage(failedUrl: string): void {
    if (this.secondaryReloadTimer) {
      clearTimeout(this.secondaryReloadTimer)
    }
    this.secondaryReloadCount++
    if (this.secondaryReloadCount > 2) {
      this.secondaryReloadCount = 0
      return
    }
    this.secondaryReloadTimer = setTimeout(() => {
      this.secondaryReloadCount = 0
      const currentPath = this.router.currentRoute.value?.fullPath
      if (currentPath) {
        this.isApplyingModule = true
        this.router.replace(currentPath).then(() => {
          this.isApplyingModule = false
        }).catch(() => {
          this.isApplyingModule = false
        })
      }
    }, 300)
  }

  private async navigateWithFallback(to: RouteLocationNormalized): Promise<void> {
    this.isApplyingModule = true
    try {
      await this.router.replace(to.fullPath)
      this.isApplyingModule = false

      await new Promise(resolve => setTimeout(resolve, 1000))
      const currentPath = this.router.currentRoute.value?.path
      if (currentPath !== to.path) {
        this.isRecovering = false
        sessionStorage.removeItem(this.options.retryKey)
        location.href = to.fullPath
        return
      }

      this.status.showSuccess()
    } catch {
      this.isApplyingModule = false
      this.status.showFail()
      this.isRecovering = false
      sessionStorage.removeItem(this.options.retryKey)
      location.href = to.fullPath
    }
  }

  private patchRouteLoader(path: string, module: any): { routeKey: string; originalLoader: () => Promise<any> } | null {
    if (!this.routes) return null
    const routesObj = this.routes.value || this.routes

    let routeKey: string | null = null

    if (this.resolveRoutePathFn) {
      try {
        const resolved = this.resolveRoutePathFn(path)
        if (routesObj[resolved] && typeof routesObj[resolved].loader === 'function') {
          routeKey = resolved
        }
      } catch { /* fall through */ }
    }

    if (!routeKey) {
      const candidates = [path, path.replace(/\/$/, ''), path + '/', path.replace(/\.html$/, ''), path + '.html']
      for (const key of candidates) {
        const route = routesObj[key]
        if (route && typeof route.loader === 'function') {
          routeKey = key
          break
        }
      }
    }

    if (!routeKey) {
      for (const [key, route] of Object.entries(routesObj)) {
        if (typeof route?.loader === 'function') {
          if (key === path || path.startsWith(key) || key.startsWith(path)) {
            routeKey = key
            break
          }
        }
      }
    }

    if (!routeKey) {
      let bestMatch: string | null = null
      let bestScore = -1
      for (const [key, route] of Object.entries(routesObj)) {
        if (typeof route?.loader !== 'function') continue
        const score = this.pathSimilarity(path, key)
        if (score > bestScore) {
          bestScore = score
          bestMatch = key
        }
      }
      if (bestMatch && bestScore > 0) {
        routeKey = bestMatch
      }
    }

    if (!routeKey) return null

    const route = routesObj[routeKey]
    const originalLoader = route.loader
    route.loader = () => Promise.resolve(module)
    return { routeKey, originalLoader }
  }

  private pathSimilarity(a: string, b: string): number {
    const sa = a.replace(/\/$/, '').split('/')
    const sb = b.replace(/\/$/, '').split('/')
    let common = 0
    const minLen = Math.min(sa.length, sb.length)
    for (let i = 0; i < minLen; i++) {
      if (sa[i] === sb[i]) common++
      else break
    }
    return common / Math.max(sa.length, sb.length)
  }

  private restoreRouteLoader(routeKey: string, originalLoader: () => Promise<any>): void {
    if (!this.routes) return
    const routesObj = this.routes.value || this.routes
    const route = routesObj[routeKey]
    if (route && typeof route.loader === 'function') {
      route.loader = originalLoader
    }
  }

  private fallbackNavigation(to: RouteLocationNormalized): void {
    this.status.showFail()
    this.isRecovering = false
    this.isApplyingModule = false
    sessionStorage.removeItem(this.options.retryKey)
    const target = to.fullPath
    if (location.pathname + location.search !== target) {
      location.href = target
    } else {
      location.reload()
    }
  }

  private shortenUrl(url: string | null): string {
    if (!url) return '(unknown)'
    try {
      const u = new URL(url, location.origin)
      const decoded = decodeURIComponent(u.pathname)
      const parts = decoded.split('/')
      return parts.length > 2 ? '.../' + parts.slice(-2).join('/') : decoded
    } catch {
      try {
        const decoded = decodeURIComponent(url)
        return decoded.length > 50 ? decoded.slice(0, 47) + '...' : decoded
      } catch {
        return url.length > 50 ? url.slice(0, 47) + '...' : url
      }
    }
  }
}
