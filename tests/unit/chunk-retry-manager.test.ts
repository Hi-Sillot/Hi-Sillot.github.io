// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ChunkRetryManager } from '../../docs/.vuepress/plugins/vuepress-plugin-sillot-chunk-retry/src/core/ChunkRetryManager'
import type { RouterLike, RouteLocationNormalized } from '../../docs/.vuepress/plugins/vuepress-plugin-sillot-chunk-retry/src/core/types'

function createMockRouter() {
  const guards: { beforeEach: Function[]; afterEach: Function[]; onError: Function[] } = {
    beforeEach: [],
    afterEach: [],
    onError: [],
  }

  const currentRoute = { value: { path: '/test/', fullPath: '/test/', name: 'test-page', matched: [], meta: {} } }

  return {
    beforeEach: vi.fn((fn) => { guards.beforeEach.push(fn); return () => {} }),
    afterEach: vi.fn((fn) => { guards.afterEach.push(fn); return () => {} }),
    onError: vi.fn((fn) => { guards.onError.push(fn); return () => {} }),
    push: vi.fn(() => Promise.resolve()),
    replace: vi.fn(() => Promise.resolve()),
    currentRoute,
    _guards: guards,
    _setCurrentRoute(route: any) {
      currentRoute.value = route
    },
  }
}

function createMockLocation(path: string, name: string | symbol | null = 'test-page'): RouteLocationNormalized {
  return { path, fullPath: path, name, matched: [], meta: {} }
}

function createMockPreloadEvent(error: Error): Event & { payload?: Error } {
  const event = new Event('vite:preloadError', { cancelable: true }) as Event & { payload?: Error }
  event.payload = error
  return event
}

describe('ChunkRetryManager', () => {
  let router: ReturnType<typeof createMockRouter>
  let manager: ChunkRetryManager

  beforeEach(() => {
    router = createMockRouter()
    manager = new ChunkRetryManager(router as any, { maxRetries: 3, retryDelay: 100, retryKey: 'test-retry', showToast: false })
    sessionStorage.clear()
  })

  afterEach(() => {
    manager.destroy()
  })

  describe('init', () => {
    it('registers router hooks on init', () => {
      manager.init()
      expect(router.beforeEach).toHaveBeenCalled()
      expect(router.afterEach).toHaveBeenCalled()
      expect(router.onError).toHaveBeenCalled()
    })

    it('registers vite:preloadError listener on window', () => {
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener')
      manager.init()
      expect(addEventListenerSpy).toHaveBeenCalledWith('vite:preloadError', expect.any(Function))
      addEventListenerSpy.mockRestore()
    })

    it('registers unhandledrejection listener on window', () => {
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener')
      manager.init()
      expect(addEventListenerSpy).toHaveBeenCalledWith('unhandledrejection', expect.any(Function))
      addEventListenerSpy.mockRestore()
    })

    it('does not init on SSR (no window)', async () => {
      const originalWindow = globalThis.window
      try {
        Object.defineProperty(globalThis, 'window', { value: undefined, writable: true, configurable: true })
        vi.resetModules()
        const { ChunkRetryManager: SSRChunkRetryManager } = await import('../../docs/.vuepress/plugins/vuepress-plugin-sillot-chunk-retry/src/core/ChunkRetryManager')
        const ssrRouter = createMockRouter()
        const ssrManager = new SSRChunkRetryManager(ssrRouter as any)
        ssrManager.init()
        expect(ssrRouter.afterEach).not.toHaveBeenCalled()
      } finally {
        Object.defineProperty(globalThis, 'window', { value: originalWindow, writable: true, configurable: true })
        vi.resetModules()
      }
    })
  })

  describe('afterEach', () => {
    it('clears retryCount in afterEach when not recovering', () => {
      manager.init()
      sessionStorage.setItem('test-retry', '123')
      ;(manager as any).retryCount = 5
      router._guards.afterEach[0](createMockLocation('/test/'), createMockLocation('/'))
      expect((manager as any).retryCount).toBe(0)
      expect(sessionStorage.getItem('test-retry')).toBeNull()
    })

    it('clears recoveredModules in afterEach when not recovering', () => {
      manager.init()
      ;(manager as any).recoveredModules.set('https://example.com/assets/page.js', { default: {} })
      router._guards.afterEach[0](createMockLocation('/test/'), createMockLocation('/'))
      expect((manager as any).recoveredModules.size).toBe(0)
    })

    it('does NOT clear state in afterEach when isRecovering is true', () => {
      manager.init()
      ;(manager as any).isRecovering = true
      ;(manager as any).retryCount = 5
      sessionStorage.setItem('test-retry', '123')
      ;(manager as any).recoveredModules.set('https://example.com/assets/page.js', { default: {} })

      router._guards.afterEach[0](createMockLocation('/test/'), createMockLocation('/'))

      expect((manager as any).retryCount).toBe(5)
      expect(sessionStorage.getItem('test-retry')).toBe('123')
      expect((manager as any).recoveredModules.size).toBe(1)
    })
  })

  describe('beforeEach', () => {
    it('stores pendingTarget from beforeEach', () => {
      manager.init()
      const target = createMockLocation('/other-page/', 'other-page')
      router._guards.beforeEach[0](target, createMockLocation('/test/'))
      expect((manager as any).pendingTarget).toBe(target)
    })

    it('uses pendingTarget in vite:preloadError handler', () => {
      manager.init()
      const target = createMockLocation('/other-page/', 'other-page')
      router._guards.beforeEach[0](target, createMockLocation('/test/'))

      const event = createMockPreloadEvent(new Error('Failed to fetch dynamically imported module: https://example.com/assets/page.js'))
      window.dispatchEvent(event)

      expect((manager as any).isRecovering).toBe(true)
    })
  })

  describe('handleChunkFailure via router.onError', () => {
    it('ignores non-dynamic-import errors', () => {
      manager.init()
      const onErrorFn = router._guards.onError[0]
      onErrorFn(new Error('Network request failed'), createMockLocation('/test/'), createMockLocation('/'))
      expect((manager as any).isRecovering).toBe(false)
    })

    it('triggers recovery for Chrome dynamic import error', () => {
      manager.init()
      const onErrorFn = router._guards.onError[0]
      onErrorFn(new Error('Failed to fetch dynamically imported module: https://example.com/assets/page.js'), createMockLocation('/test/'), createMockLocation('/'))
      expect((manager as any).isRecovering).toBe(true)
      expect(sessionStorage.getItem('test-retry')).not.toBeNull()
    })

    it('triggers recovery for Firefox dynamic import error', () => {
      manager.init()
      const onErrorFn = router._guards.onError[0]
      onErrorFn(new Error('error loading dynamically imported module: https://example.com/assets/page.js'), createMockLocation('/test/'), createMockLocation('/'))
      expect((manager as any).isRecovering).toBe(true)
    })

    it('falls back for Safari dynamic import error (no URL to retry)', () => {
      manager.init()
      const onErrorFn = router._guards.onError[0]
      const fallbackSpy = vi.spyOn(manager as any, 'fallbackNavigation')
      onErrorFn(new Error('Importing a module script failed.'), createMockLocation('/test/'), createMockLocation('/'))
      expect(fallbackSpy).toHaveBeenCalledWith(createMockLocation('/test/'))
      fallbackSpy.mockRestore()
    })

    it('falls back for component resolution error (no URL to retry)', () => {
      manager.init()
      const onErrorFn = router._guards.onError[0]
      const fallbackSpy = vi.spyOn(manager as any, 'fallbackNavigation')
      onErrorFn(new Error("Couldn't resolve component at /page"), createMockLocation('/test/'), createMockLocation('/'))
      expect(fallbackSpy).toHaveBeenCalledWith(createMockLocation('/test/'))
      fallbackSpy.mockRestore()
    })

    it('skips if already recovering', () => {
      manager.init()
      const onErrorFn = router._guards.onError[0]
      ;(manager as any).isRecovering = true
      ;(manager as any).pendingRecovery = Promise.resolve()
      sessionStorage.setItem('test-retry', '123')
      onErrorFn(new Error('Failed to fetch dynamically imported module: https://example.com/assets/page.js'), createMockLocation('/test/'), createMockLocation('/'))
      expect(router.replace).not.toHaveBeenCalled()
    })

    it('skips if sessionStorage has retry key', () => {
      manager.init()
      sessionStorage.setItem('test-retry', '123')
      const onErrorFn = router._guards.onError[0]
      onErrorFn(new Error('Failed to fetch dynamically imported module: https://example.com/assets/page.js'), createMockLocation('/test/'), createMockLocation('/'))
      expect((manager as any).isRecovering).toBe(false)
    })
  })

  describe('handleChunkFailure via vite:preloadError', () => {
    it('triggers recovery for valid preload error with URL', () => {
      manager.init()
      const event = createMockPreloadEvent(new Error('Failed to fetch dynamically imported module: https://example.com/assets/page.js'))
      window.dispatchEvent(event)

      expect((manager as any).isRecovering).toBe(true)
      expect(sessionStorage.getItem('test-retry')).not.toBeNull()
    })

    it('calls event.preventDefault to suppress Vite re-throw', () => {
      manager.init()
      const event = createMockPreloadEvent(new Error('Failed to fetch dynamically imported module: https://example.com/assets/page.js'))
      window.dispatchEvent(event)
      expect(event.defaultPrevented).toBe(true)
    })

    it('ignores preloadError without payload', () => {
      manager.init()
      const event = new Event('vite:preloadError', { cancelable: true }) as Event & { payload?: Error }
      window.dispatchEvent(event)
      expect((manager as any).isRecovering).toBe(false)
    })

    it('ignores preloadError with error that has no extractable URL', () => {
      manager.init()
      const event = createMockPreloadEvent(new Error('Some unknown error'))
      window.dispatchEvent(event)
      expect((manager as any).isRecovering).toBe(false)
    })

    it('applies recovered module when URL already in recoveredModules', () => {
      manager.init()
      const mockModule = { default: { name: 'TestComponent' } }
      ;(manager as any).recoveredModules.set('https://example.com/assets/page.js', mockModule)

      const event = createMockPreloadEvent(new Error('Failed to fetch dynamically imported module: https://example.com/assets/page.js'))
      window.dispatchEvent(event)

      expect((manager as any).isRecovering).toBe(false)
    })

    it('uses router.currentRoute.value as target route', () => {
      manager.init()
      router._setCurrentRoute(createMockLocation('/develop_notes/'))

      const event = createMockPreloadEvent(new Error('Failed to fetch dynamically imported module: https://example.com/assets/notes.js'))
      window.dispatchEvent(event)

      expect((manager as any).isRecovering).toBe(true)
    })
  })

  describe('unhandledrejection', () => {
    it('prevents default for dynamic import errors', () => {
      manager.init()
      const handler = (manager as any).unhandledRejectionHandler
      const event = { reason: new Error('Failed to fetch dynamically imported module: https://example.com/assets/page.js'), preventDefault: vi.fn() }
      handler(event)
      expect(event.preventDefault).toHaveBeenCalled()
    })

    it('does not prevent default for non-import errors', () => {
      manager.init()
      const handler = (manager as any).unhandledRejectionHandler
      const event = { reason: new Error('Some other error'), preventDefault: vi.fn() }
      handler(event)
      expect(event.preventDefault).not.toHaveBeenCalled()
    })
  })

  describe('updatePageChunk', () => {
    it('sets _pageChunk on current route when path matches', () => {
      manager.init()
      const mockModule = { default: { name: 'TestComponent' } }
      const to = createMockLocation('/test/')
      router._setCurrentRoute(to)

      ;(manager as any).updatePageChunk(to, mockModule)

      expect(router.currentRoute.value.meta._pageChunk).toBe(mockModule)
    })

    it('sets _pageChunk on current route when fullPath matches but path differs', () => {
      manager.init()
      const mockModule = { default: { name: 'TestComponent' } }
      const to = createMockLocation('/test/')
      to.path = '/test'
      to.fullPath = '/test/'
      router._setCurrentRoute({ path: '/test/', fullPath: '/test/', name: 'test-page', matched: [], meta: {} })

      ;(manager as any).updatePageChunk(to, mockModule)

      expect(router.currentRoute.value.meta._pageChunk).toBe(mockModule)
    })

    it('calls router.replace when current path does not match target', () => {
      manager.init()
      const mockModule = { default: { name: 'TestComponent' } }
      const to = createMockLocation('/other-page/')
      router._setCurrentRoute(createMockLocation('/test/'))

      ;(manager as any).updatePageChunk(to, mockModule)

      expect(router.replace).toHaveBeenCalledWith('/other-page/')
    })
  })

  describe('applyRecoveredModule', () => {
    it('sets _pageChunk on current route meta', () => {
      manager.init()
      const mockModule = { default: { name: 'TestComponent' } }
      ;(manager as any).recoveredModules.set('https://example.com/assets/page.js', mockModule)
      router._setCurrentRoute(createMockLocation('/test/'))

      ;(manager as any).applyRecoveredModule('https://example.com/assets/page.js')

      expect(router.currentRoute.value.meta._pageChunk).toBe(mockModule)
    })

    it('does nothing if module not found', () => {
      manager.init()
      router._setCurrentRoute(createMockLocation('/test/'))

      ;(manager as any).applyRecoveredModule('https://example.com/assets/nonexistent.js')

      expect(router.currentRoute.value.meta._pageChunk).toBeUndefined()
    })

    it('navigates to pending target when it differs from current route', () => {
      manager.init()
      const mockModule = { default: { name: 'TestComponent' } }
      ;(manager as any).recoveredModules.set('https://example.com/assets/page.js', mockModule)
      router._setCurrentRoute(createMockLocation('/test/'))
      const pendingTarget = createMockLocation('/other-page/')
      ;(manager as any).pendingTarget = pendingTarget

      ;(manager as any).applyRecoveredModule('https://example.com/assets/page.js')

      expect(router.currentRoute.value.meta._pageChunk).toBe(mockModule)
      expect(pendingTarget.meta._pageChunk).toBe(mockModule)
      expect(router.replace).toHaveBeenCalledWith('/other-page/')
    })
  })

  describe('recovery generation', () => {
    it('increments recoveryGeneration on new recovery', () => {
      manager.init()
      const initialGen = (manager as any).recoveryGeneration

      const onErrorFn = router._guards.onError[0]
      onErrorFn(new Error('Failed to fetch dynamically imported module: https://example.com/assets/page.js'), createMockLocation('/test/'), createMockLocation('/'))

      expect((manager as any).recoveryGeneration).toBe(initialGen + 1)
    })

    it('stale recovery is skipped when generation mismatches', async () => {
      manager.init()
      const to = createMockLocation('/test/')
      const staleGeneration = (manager as any).recoveryGeneration
      ;(manager as any).recoveryGeneration = staleGeneration + 100

      await (manager as any).recoverWithCacheBusting('https://example.com/assets/page.js', to, staleGeneration)

      expect(router.replace).not.toHaveBeenCalled()
    })
  })

  describe('custom options', () => {
    it('uses custom maxRetries', () => {
      const customManager = new ChunkRetryManager(router as any, { maxRetries: 1, retryDelay: 50, retryKey: 'custom-key' })
      customManager.init()
      expect((customManager as any).options.maxRetries).toBe(1)
    })

    it('uses custom retryKey', () => {
      const customManager = new ChunkRetryManager(router as any, { maxRetries: 3, retryDelay: 100, retryKey: 'my-custom-key' })
      customManager.init()
      expect((customManager as any).options.retryKey).toBe('my-custom-key')
    })

    it('uses default options when none provided', () => {
      const defaultManager = new ChunkRetryManager(router as any)
      defaultManager.init()
      expect((defaultManager as any).options.maxRetries).toBe(3)
      expect((defaultManager as any).options.retryDelay).toBe(1000)
      expect((defaultManager as any).options.retryKey).toBe('chunk-retry-attempted')
    })
  })

  describe('shortenUrl', () => {
    it('decodes URL-encoded Chinese characters in pathname', () => {
      manager.init()
      const result = (manager as any).shortenUrl('https://example.com/assets/git%20tag%20%E5%92%8C%20branch-DjchU1y6.js')
      expect(result).toBe('.../assets/git tag 和 branch-DjchU1y6.js')
    })

    it('decodes URL-encoded spaces in pathname', () => {
      manager.init()
      const result = (manager as any).shortenUrl('https://example.com/assets/my%20page-abc.js')
      expect(result).toBe('.../assets/my page-abc.js')
    })

    it('returns (unknown) for null URL', () => {
      manager.init()
      const result = (manager as any).shortenUrl(null)
      expect(result).toBe('(unknown)')
    })

    it('shortens long pathnames to last two segments', () => {
      manager.init()
      const result = (manager as any).shortenUrl('https://example.com/some/deep/path/assets/page-abc.js')
      expect(result).toBe('.../assets/page-abc.js')
    })

    it('handles relative URLs with encoded characters', () => {
      manager.init()
      const result = (manager as any).shortenUrl('/assets/%E4%B8%AD%E6%96%87-page.js')
      expect(result).toBe('.../assets/中文-page.js')
    })
  })

  describe('coordination between handlers', () => {
    it('preloadError triggers recovery that router.onError would also trigger', () => {
      manager.init()
      const event = createMockPreloadEvent(new Error('Failed to fetch dynamically imported module: https://example.com/assets/page.js'))
      window.dispatchEvent(event)

      expect((manager as any).isRecovering).toBe(true)

      const onErrorFn = router._guards.onError[0]
      onErrorFn(new Error('Failed to fetch dynamically imported module: https://example.com/assets/page.js'), createMockLocation('/test/'), createMockLocation('/'))

      expect(router.replace).not.toHaveBeenCalled()
    })

    it('handleChunkFailure waits for already recovering process', () => {
      manager.init()
      const onErrorFn = router._guards.onError[0]
      ;(manager as any).isRecovering = true
      ;(manager as any).pendingRecovery = Promise.resolve()

      onErrorFn(new Error('Failed to fetch dynamically imported module: https://example.com/assets/page.js'), createMockLocation('/test/'), createMockLocation('/'))

      expect(router.replace).not.toHaveBeenCalled()
    })
  })

  describe('destroy', () => {
    it('removes vite:preloadError listener', () => {
      manager.init()
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener')
      manager.destroy()
      expect(removeEventListenerSpy).toHaveBeenCalledWith('vite:preloadError', expect.any(Function))
      removeEventListenerSpy.mockRestore()
    })

    it('removes unhandledrejection listener', () => {
      manager.init()
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener')
      manager.destroy()
      expect(removeEventListenerSpy).toHaveBeenCalledWith('unhandledrejection', expect.any(Function))
      removeEventListenerSpy.mockRestore()
    })
  })

  describe('ToastUI aggregation', () => {
    let toastRouter: ReturnType<typeof createMockRouter>
    let toastManager: ChunkRetryManager

    beforeEach(() => {
      toastRouter = createMockRouter()
      toastManager = new ChunkRetryManager(toastRouter as any, { maxRetries: 3, retryDelay: 100, retryKey: 'toast-test', showToast: true })
      sessionStorage.clear()
      document.body.innerHTML = ''
      document.head.innerHTML = ''
    })

    afterEach(() => {
      toastManager.destroy()
      document.body.innerHTML = ''
      document.head.innerHTML = ''
    })

    it('creates toast container on initUI', () => {
      toastManager.init()
      toastManager.initUI()
      expect(document.querySelector('#chunk-retry-toast-container')).not.toBeNull()
    })

    it('creates toast styles on initUI', () => {
      toastManager.init()
      toastManager.initUI()
      expect(document.querySelector('#chunk-retry-toast-styles')).not.toBeNull()
    })

    it('does not create toast container on init alone', () => {
      toastManager.init()
      expect(document.querySelector('#chunk-retry-toast-container')).toBeNull()
    })

    it('queues toasts before initUI and flushes after', () => {
      toastManager.init()

      ;(toastManager as any).toast.show('detect', '排队消息', 'url1')
      expect(document.querySelectorAll('.chunk-retry-toast').length).toBe(0)

      toastManager.initUI()

      const toasts = document.querySelectorAll('.chunk-retry-toast--detect')
      expect(toasts.length).toBe(1)
      expect(toasts[0].textContent).toContain('排队消息')
    })

    it('aggregates same-type toasts with count badge', () => {
      toastManager.init()
      toastManager.initUI()

      ;(toastManager as any).toast.show('detect', '第一次', 'url1')
      ;(toastManager as any).toast.show('detect', '第二次', 'url2')

      const toasts = document.querySelectorAll('.chunk-retry-toast--detect')
      expect(toasts.length).toBe(1)

      const badge = toasts[0].querySelector('.chunk-retry-toast__badge')
      expect(badge).not.toBeNull()
      expect(badge?.textContent).toBe('2')
    })

    it('does not show badge when count is 1', () => {
      toastManager.init()
      toastManager.initUI()

      ;(toastManager as any).toast.show('detect', '检测', 'url1')

      const toasts = document.querySelectorAll('.chunk-retry-toast--detect')
      expect(toasts.length).toBe(1)

      const badge = toasts[0].querySelector('.chunk-retry-toast__badge')
      expect(badge).toBeNull()
    })

    it('keeps different types as separate toasts', () => {
      toastManager.init()
      toastManager.initUI()

      ;(toastManager as any).toast.show('detect', '检测', 'url1')
      ;(toastManager as any).toast.show('retrying', '恢复中', 'url1')

      const allToasts = document.querySelectorAll('.chunk-retry-toast')
      expect(allToasts.length).toBe(2)
    })

    it('updates message on aggregated toast', () => {
      toastManager.init()
      toastManager.initUI()

      ;(toastManager as any).toast.show('detect', '第一次', 'url1')
      ;(toastManager as any).toast.show('detect', '第二次', 'url2')

      const toasts = document.querySelectorAll('.chunk-retry-toast--detect')
      expect(toasts.length).toBe(1)
      expect(toasts[0].textContent).toContain('第二次')
    })

    it('adds pulse animation on update', () => {
      toastManager.init()
      toastManager.initUI()

      ;(toastManager as any).toast.show('detect', '第一次', 'url1')
      ;(toastManager as any).toast.show('detect', '第二次', 'url2')

      const toast = document.querySelector('.chunk-retry-toast--detect')
      expect(toast?.classList.contains('chunk-retry-toast--pulse')).toBe(true)
    })

    it('dismissAll clears all toasts', async () => {
      toastManager.init()
      toastManager.initUI()

      ;(toastManager as any).toast.show('detect', '检测', 'url1')
      ;(toastManager as any).toast.show('retrying', '恢复中', 'url1')

      const beforeCount = document.querySelectorAll('.chunk-retry-toast').length
      expect(beforeCount).toBe(2)

      ;(toastManager as any).toast.dismissAll()

      await new Promise(resolve => setTimeout(resolve, 350))

      const activeToasts = (toastManager as any).toast.activeToasts
      expect(activeToasts.size).toBe(0)
    })

    it('dismissAll is called in afterEach', async () => {
      toastManager.init()
      toastManager.initUI()

      ;(toastManager as any).toast.show('detect', '检测', 'url1')

      toastRouter._guards.afterEach[0](createMockLocation('/test/'), createMockLocation('/'))

      await new Promise(resolve => setTimeout(resolve, 350))

      const activeToasts = (toastManager as any).toast.activeToasts
      expect(activeToasts.size).toBe(0)
    })

    it('has close button', () => {
      toastManager.init()
      toastManager.initUI()

      ;(toastManager as any).toast.show('detect', '检测', 'url1')

      const closeBtn = document.querySelector('.chunk-retry-toast__close')
      expect(closeBtn).not.toBeNull()
    })
  })
})
