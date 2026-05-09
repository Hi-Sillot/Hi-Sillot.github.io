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

interface ActiveToast {
  key: string
  type: ToastType
  message: string
  detail: string
  count: number
  el: HTMLDivElement
  dismissTimer: ReturnType<typeof setTimeout> | null
}

interface PendingToast {
  type: ToastType
  message: string
  detail?: string
}

class ToastUI {
  private container: HTMLDivElement | null = null
  private enabled: boolean
  private activeToasts: Map<string, ActiveToast> = new Map()
  private pendingQueue: PendingToast[] = []

  constructor(enabled: boolean) {
    this.enabled = enabled
  }

  init(): void {
  }

  initUI(): void {
    if (!this.enabled || typeof document === 'undefined') return
    if (this.container) return

    this.container = document.createElement('div')
    this.container.id = 'chunk-retry-toast-container'
    this.injectStyles()
    document.body.appendChild(this.container)

    for (const item of this.pendingQueue) {
      this.show(item.type, item.message, item.detail)
    }
    this.pendingQueue = []
  }

  show(type: ToastType, message: string, detail?: string): void {
    if (!this.enabled) return

    if (!this.container) {
      this.pendingQueue.push({ type, message, detail })
      return
    }

    const key = type
    const existing = this.activeToasts.get(key)

    if (existing) {
      existing.count++
      existing.message = message
      existing.detail = detail || ''
      this.updateToastDom(existing)
      this.resetDismissTimer(existing)
      return
    }

    const el = document.createElement('div')
    el.className = `chunk-retry-toast chunk-retry-toast--${type}`
    el.dataset.key = key

    el.innerHTML = this.buildInnerHtml(type, message, detail, 1)

    el.addEventListener('click', () => this.dismiss(key))

    this.container.appendChild(el)

    const toast: ActiveToast = { key, type, message, detail: detail || '', count: 1, el, dismissTimer: null }
    this.activeToasts.set(key, toast)

    requestAnimationFrame(() => {
      el.classList.add('chunk-retry-toast--enter')
    })

    this.resetDismissTimer(toast)
  }

  dismiss(key: string): void {
    const toast = this.activeToasts.get(key)
    if (!toast) return

    if (toast.dismissTimer) {
      clearTimeout(toast.dismissTimer)
      toast.dismissTimer = null
    }

    toast.el.classList.remove('chunk-retry-toast--enter')
    toast.el.classList.add('chunk-retry-toast--exit')
    setTimeout(() => {
      toast.el.remove()
      this.activeToasts.delete(key)
    }, 280)
  }

  dismissAll(): void {
    this.pendingQueue = []
    for (const key of this.activeToasts.keys()) {
      this.dismiss(key)
    }
  }

  destroy(): void {
    this.pendingQueue = []
    for (const toast of this.activeToasts.values()) {
      if (toast.dismissTimer) clearTimeout(toast.dismissTimer)
    }
    this.activeToasts.clear()
    if (this.container) {
      this.container.remove()
      this.container = null
    }
    const style = document.getElementById('chunk-retry-toast-styles')
    if (style) style.remove()
  }

  private updateToastDom(toast: ActiveToast): void {
    const { el, type, message, detail, count } = toast
    el.innerHTML = this.buildInnerHtml(type, message, detail, count)
    el.classList.remove('chunk-retry-toast--pulse')
    void el.offsetWidth
    el.classList.add('chunk-retry-toast--pulse')
  }

  private resetDismissTimer(toast: ActiveToast): void {
    if (toast.dismissTimer) {
      clearTimeout(toast.dismissTimer)
    }

    const progressEl = toast.el.querySelector('.chunk-retry-toast__progress') as HTMLDivElement | null
    if (progressEl) {
      progressEl.classList.remove('chunk-retry-toast__progress--active')
      void progressEl.offsetWidth
      progressEl.classList.add('chunk-retry-toast__progress--active')
    }

    const duration = this.getDismissDuration(toast.type)
    if (duration > 0) {
      if (progressEl) {
        progressEl.style.animationDuration = `${duration}ms`
      }
      toast.dismissTimer = setTimeout(() => this.dismiss(toast.key), duration)
    }
  }

  private getDismissDuration(type: ToastType): number {
    switch (type) {
      case 'detect': return 4000
      case 'retrying': return 0
      case 'success': return 3500
      case 'fail': return 6000
      case 'fallback': return 6000
    }
  }

  private buildInnerHtml(type: ToastType, message: string, detail: string | undefined, count: number): string {
    const icon = this.getIcon(type)
    const badge = count > 1 ? `<span class="chunk-retry-toast__badge">${count}</span>` : ''
    const detailHtml = detail ? `<div class="chunk-retry-toast__detail">${detail}</div>` : ''
    const progressHtml = this.getDismissDuration(type) > 0 ? '<div class="chunk-retry-toast__progress"></div>' : ''

    return `
      <div class="chunk-retry-toast__icon">${icon}</div>
      <div class="chunk-retry-toast__body">
        <div class="chunk-retry-toast__msg">${message}${badge}</div>
        ${detailHtml}
      </div>
      <button class="chunk-retry-toast__close" aria-label="关闭">&times;</button>
      ${progressHtml}
    `
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
#chunk-retry-toast-container{position:fixed;top:16px;right:16px;z-index:999999;display:flex;flex-direction:column;gap:10px;pointer-events:none;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:360px}
.chunk-retry-toast{display:flex;align-items:flex-start;gap:10px;padding:10px 14px;border-radius:10px;background:rgba(22,27,34,.92);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);border:1px solid rgba(48,54,61,.6);color:#c9d1d9;font-size:13px;line-height:1.4;pointer-events:auto;position:relative;overflow:hidden;opacity:0;transform:translateX(30px) scale(.96);transition:opacity .25s ease,transform .25s ease;cursor:default;box-shadow:0 4px 24px rgba(0,0,0,.35)}
.chunk-retry-toast--enter{opacity:1;transform:translateX(0) scale(1)}
.chunk-retry-toast--exit{opacity:0;transform:translateX(30px) scale(.96)}
.chunk-retry-toast--pulse{animation:chunk-retry-pulse .3s ease}
@keyframes chunk-retry-pulse{0%{transform:scale(1)}50%{transform:scale(1.02)}100%{transform:scale(1)}}
.chunk-retry-toast__icon{font-size:16px;line-height:1;flex-shrink:0;margin-top:2px}
.chunk-retry-toast__body{flex:1;min-width:0}
.chunk-retry-toast__msg{font-weight:600;color:#e6edf3;display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.chunk-retry-toast__badge{display:inline-flex;align-items:center;justify-content:center;min-width:18px;height:18px;padding:0 5px;border-radius:9px;font-size:10px;font-weight:700;line-height:1;color:#fff;background:rgba(240,136,62,.85)}
.chunk-retry-toast--detect .chunk-retry-toast__badge{background:rgba(240,136,62,.85)}
.chunk-retry-toast--retrying .chunk-retry-toast__badge{background:rgba(88,166,255,.85)}
.chunk-retry-toast--success .chunk-retry-toast__badge{background:rgba(63,185,80,.85)}
.chunk-retry-toast--fail .chunk-retry-toast__badge{background:rgba(248,81,73,.85)}
.chunk-retry-toast--fallback .chunk-retry-toast__badge{background:rgba(210,153,34,.85)}
.chunk-retry-toast__detail{margin-top:3px;font-size:11px;color:#8b949e;word-break:break-all;opacity:.85}
.chunk-retry-toast__close{position:absolute;top:4px;right:6px;background:none;border:none;color:#484f58;font-size:16px;line-height:1;cursor:pointer;padding:2px 4px;border-radius:4px;transition:color .15s,background .15s}
.chunk-retry-toast__close:hover{color:#c9d1d9;background:rgba(255,255,255,.08)}
.chunk-retry-toast__progress{position:absolute;bottom:0;left:0;height:2px;background:rgba(240,136,62,.6);width:0;border-radius:0 0 10px 10px}
.chunk-retry-toast__progress--active{animation:chunk-retry-progress linear forwards}
@keyframes chunk-retry-progress{from{width:100%}to{width:0%}}
.chunk-retry-toast--detect{border-left:3px solid #f0883e}
.chunk-retry-toast--retrying{border-left:3px solid #58a6ff}
.chunk-retry-toast--success{border-left:3px solid #3fb950;background:rgba(13,31,13,.92);border-color:rgba(27,67,50,.6)}
.chunk-retry-toast--fail{border-left:3px solid #f85149;background:rgba(31,13,13,.92);border-color:rgba(77,27,27,.6)}
.chunk-retry-toast--fallback{border-left:3px solid #d29922;background:rgba(31,26,13,.92);border-color:rgba(77,61,27,.6)}
.chunk-retry-toast--success .chunk-retry-toast__msg{color:#3fb950}
.chunk-retry-toast--fail .chunk-retry-toast__msg{color:#f85149}
.chunk-retry-toast--fallback .chunk-retry-toast__msg{color:#d29922}
.chunk-retry-toast--retrying .chunk-retry-toast__icon{animation:chunk-retry-spin 1.2s linear infinite}
@keyframes chunk-retry-spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}
`
    document.head.appendChild(style)
  }
}

export class ChunkRetryManager {
  private router: RouterLike
  private options: Required<ChunkRetryOptions>
  private pendingRecovery: Promise<void> | null = null
  private retryCount = 0
  private isRecovering = false
  private recoveredModules: Map<string, any> = new Map()
  private recoveryGeneration = 0
  private toast: ToastUI
  private preloadErrorHandler: ((ev: Event) => void) | null = null
  private pendingTarget: RouteLocationNormalized | null = null
  private unhandledRejectionHandler: ((ev: PromiseRejectionEvent) => void) | null = null

  constructor(router: RouterLike, options: ChunkRetryOptions = {}) {
    this.router = router
    this.options = { ...DEFAULT_OPTIONS, ...options }
    this.toast = new ToastUI(this.options.showToast)
  }

  init(): void {
    if (typeof window === 'undefined') return

    this.router.beforeEach((to: RouteLocationNormalized) => {
      this.pendingTarget = to
    })

    this.router.afterEach(() => {
      if (this.isRecovering) return
      this.retryCount = 0
      this.recoveredModules.clear()
      sessionStorage.removeItem(this.options.retryKey)
      this.toast.dismissAll()
    })

    this.router.onError((error: Error, to: RouteLocationNormalized) => {
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
        const module = this.recoveredModules.get(failedUrl)
        const pending = this.pendingTarget
        if (pending && pending.meta) {
          pending.meta._pageChunk = module
        }
        return
      }

      if (this.isRecovering) return

      const target = this.pendingTarget || (this.router.currentRoute.value as RouteLocationNormalized)
      this.handleChunkFailure(error, target)
    }) as (ev: Event) => void

    window.addEventListener('vite:preloadError', this.preloadErrorHandler)

    this.unhandledRejectionHandler = ((event: PromiseRejectionEvent) => {
      if (isDynamicImportError(event.reason)) {
        event.preventDefault()
      }
    }) as (ev: PromiseRejectionEvent) => void

    window.addEventListener('unhandledrejection', this.unhandledRejectionHandler)
  }

  initUI(): void {
    this.toast.initUI()
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
    this.toast.destroy()
  }

  private handleChunkFailure(error: Error, to: RouteLocationNormalized): void {
    const failedUrl = extractFailedUrl(error)
    const shortUrl = this.shortenUrl(failedUrl)

    if (this.isRecovering) {
      if (this.pendingRecovery) {
        this.pendingRecovery.catch(() => this.fallbackNavigation(to))
      }
      return
    }

    this.toast.show('detect', '资源加载失败', shortUrl)

    if (failedUrl && this.recoveredModules.has(failedUrl)) {
      this.applyRecoveredModule(failedUrl)
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
      this.toast.show('retrying', `正在恢复 (${this.retryCount + 1}/${this.options.maxRetries})`, this.shortenUrl(failedUrl))

      const module = await this.retryImportWithCacheBusting(failedUrl)
      this.recoveredModules.set(failedUrl, module)

      if (this.recoveryGeneration !== generation) return

      this.updatePageChunk(to, module)

      this.isRecovering = false
      sessionStorage.removeItem(this.options.retryKey)

      this.toast.show('success', '页面恢复成功', to.fullPath)
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
    const TIMEOUT_MS = 15000
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`import timeout after ${TIMEOUT_MS}ms`)), TIMEOUT_MS)
      import(/* @vite-ignore */ retryUrl).then(
        (mod) => { clearTimeout(timer); resolve(mod) },
        (err) => { clearTimeout(timer); reject(err) },
      )
    })
  }

  private updatePageChunk(to: RouteLocationNormalized, module: any): void {
    const current = this.router.currentRoute.value as RouteLocationNormalized
    if (current.meta && (current.path === to.path || current.fullPath === to.fullPath)) {
      current.meta._pageChunk = module
    } else {
      this.fallbackNavigation(to)
    }
  }

  private applyRecoveredModule(failedUrl: string): void {
    const module = this.recoveredModules.get(failedUrl)
    if (!module) return

    const pending = this.pendingTarget
    if (pending && pending.meta) {
      pending.meta._pageChunk = module
    }
  }

  private fallbackNavigation(to: RouteLocationNormalized): void {
    this.toast.show('fallback', '回退到整页导航', to.fullPath)
    this.isRecovering = false
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
