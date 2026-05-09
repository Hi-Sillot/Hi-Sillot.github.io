import type { RouterLike, RouteLocationNormalized, ChunkRetryOptions } from './types'
import { extractFailedUrl } from '../utils/extract-url'
import { isDynamicImportError } from '../utils/is-dynamic-import-error'

const DEFAULT_OPTIONS: Required<ChunkRetryOptions> = {
  maxRetries: 3,
  retryDelay: 1000,
  retryKey: 'chunk-retry-attempted',
  showToast: true,
}

type ToastType = 'detect' | 'retrying' | 'success' | 'fail' | 'fallback'

interface ToastEntry {
  type: ToastType
  message: string
  detail?: string
  id: number
}

class ToastUI {
  private container: HTMLDivElement | null = null
  private counter = 0
  private enabled: boolean

  constructor(enabled: boolean) {
    this.enabled = enabled
  }

  init(): void {
    if (!this.enabled || typeof document === 'undefined') return

    this.container = document.createElement('div')
    this.container.id = 'chunk-retry-toast-container'
    this.injectStyles()
    document.body.appendChild(this.container)
  }

  show(type: ToastType, message: string, detail?: string): void {
    if (!this.enabled || !this.container) return

    const id = ++this.counter
    const entry: ToastEntry = { type, message, detail, id }

    const el = document.createElement('div')
    el.className = `chunk-retry-toast chunk-retry-toast--${type}`
    el.dataset.id = String(id)

    const icon = this.getIcon(type)
    el.innerHTML = `
      <div class="chunk-retry-toast__icon">${icon}</div>
      <div class="chunk-retry-toast__body">
        <div class="chunk-retry-toast__msg">${message}</div>
        ${detail ? `<div class="chunk-retry-toast__detail">${detail}</div>` : ''}
      </div>
      <div class="chunk-retry-toast__progress"></div>
    `

    this.container.appendChild(el)

    requestAnimationFrame(() => {
      el.classList.add('chunk-retry-toast--enter')
    })

    const duration = type === 'success' ? 3000 : type === 'fail' || type === 'fallback' ? 5000 : 0
    if (duration > 0) {
      const progress = el.querySelector('.chunk-retry-toast__progress') as HTMLDivElement
      if (progress) {
        progress.style.animationDuration = `${duration}ms`
        progress.classList.add('chunk-retry-toast__progress--active')
      }
      setTimeout(() => this.dismiss(id), duration)
    }

    return
  }

  dismiss(id: number): void {
    if (!this.container) return
    const el = this.container.querySelector(`[data-id="${id}"]`) as HTMLDivElement
    if (!el) return
    el.classList.add('chunk-retry-toast--exit')
    setTimeout(() => el.remove(), 300)
  }

  dismissAll(): void {
    if (!this.container) return
    const toasts = this.container.querySelectorAll('.chunk-retry-toast')
    toasts.forEach(el => {
      ;(el as HTMLDivElement).classList.add('chunk-retry-toast--exit')
      setTimeout(() => el.remove(), 300)
    })
  }

  private getIcon(type: ToastType): string {
    switch (type) {
      case 'detect': return '⚡'
      case 'retrying': return '🔄'
      case 'success': return '✅'
      case 'fail': return '❌'
      case 'fallback': return '🔀'
    }
  }

  private injectStyles(): void {
    const style = document.createElement('style')
    style.id = 'chunk-retry-toast-styles'
    style.textContent = `
#chunk-retry-toast-container{position:fixed;top:16px;right:16px;z-index:999999;display:flex;flex-direction:column;gap:8px;pointer-events:none;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:380px}
.chunk-retry-toast{display:flex;align-items:flex-start;gap:10px;padding:12px 16px;border-radius:8px;background:#1c2128;border:1px solid #30363d;color:#c9d1d9;font-size:13px;line-height:1.4;pointer-events:auto;position:relative;overflow:hidden;opacity:0;transform:translateX(40px);transition:opacity .3s,transform .3s}
.chunk-retry-toast--enter{opacity:1;transform:translateX(0)}
.chunk-retry-toast--exit{opacity:0;transform:translateX(40px)}
.chunk-retry-toast__icon{font-size:18px;line-height:1;flex-shrink:0;margin-top:1px}
.chunk-retry-toast__body{flex:1;min-width:0}
.chunk-retry-toast__msg{font-weight:600;color:#e6edf3}
.chunk-retry-toast__detail{margin-top:3px;font-size:11px;color:#8b949e;word-break:break-all}
.chunk-retry-toast__progress{position:absolute;bottom:0;left:0;height:2px;background:#f0883e;width:0;border-radius:0 0 8px 8px}
.chunk-retry-toast__progress--active{animation:chunk-retry-progress linear forwards}
@keyframes chunk-retry-progress{from{width:100%}to{width:0%}}
.chunk-retry-toast--detect{border-left:3px solid #f0883e}
.chunk-retry-toast--retrying{border-left:3px solid #58a6ff}
.chunk-retry-toast--success{border-left:3px solid #3fb950;background:#0d1f0d;border-color:#1b4332}
.chunk-retry-toast--fail{border-left:3px solid #f85149;background:#1f0d0d;border-color:#4d1b1b}
.chunk-retry-toast--fallback{border-left:3px solid #d29922;background:#1f1a0d;border-color:#4d3d1b}
.chunk-retry-toast--success .chunk-retry-toast__msg{color:#3fb950}
.chunk-retry-toast--fail .chunk-retry-toast__msg{color:#f85149}
.chunk-retry-toast--fallback .chunk-retry-toast__msg{color:#d29922}
.chunk-retry-toast--retrying .chunk-retry-toast__icon{animation:chunk-retry-spin 1s linear infinite}
@keyframes chunk-retry-spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}
`
    document.head.appendChild(style)
  }
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
  private toast: ToastUI

  constructor(router: RouterLike, options: ChunkRetryOptions = {}) {
    this.router = router
    this.options = { ...DEFAULT_OPTIONS, ...options }
    this.toast = new ToastUI(this.options.showToast)
  }

  init(): void {
    if (typeof window === 'undefined') return

    this.toast.init()

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
      this.toast.dismissAll()
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
    const shortUrl = this.shortenUrl(failedUrl)

    this.toast.show('detect', '检测到资源加载失败', shortUrl)

    if (failedUrl && this.recoveredUrls.has(failedUrl)) {
      this.phantomRetryCount++
      if (this.phantomRetryCount <= 3) {
        this.toast.show('retrying', `幻影重试 (${this.phantomRetryCount}/3)`, shortUrl)
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

      this.toast.show('retrying', `正在恢复 (第 ${this.retryCount + 1} 次)`, this.shortenUrl(failedUrl))

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

      this.toast.show('success', '页面恢复成功！', `${to.fullPath}`)
    } catch {
      if (this.recoveryGeneration !== generation) return

      this.retryCount++
      if (this.retryCount < this.options.maxRetries) {
        const delay = this.options.retryDelay * this.retryCount
        this.toast.show('retrying', `恢复失败，${delay}ms 后重试 (${this.retryCount}/${this.options.maxRetries})`, this.shortenUrl(failedUrl))
        await new Promise(resolve => setTimeout(resolve, delay))
        this.isRecovering = false
        sessionStorage.removeItem(this.options.retryKey)
        await this.recoverWithCacheBusting(failedUrl, to, generation)
      } else {
        this.toast.show('fail', `恢复失败 (已重试 ${this.options.maxRetries} 次)`, this.shortenUrl(failedUrl))
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
    this.toast.show('fallback', '回退到整页导航', `${to.fullPath}`)
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
      const parts = u.pathname.split('/')
      return parts.length > 2 ? '.../' + parts.slice(-2).join('/') : u.pathname
    } catch {
      return url.length > 50 ? url.slice(0, 47) + '...' : url
    }
  }
}
