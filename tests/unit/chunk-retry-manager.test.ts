// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ChunkRetryManager } from '../../docs/.vuepress/plugins/vuepress-plugin-sillot-chunk-retry/src/core/ChunkRetryManager'
import type { RouterLike, RouteLocationNormalized } from '../../docs/.vuepress/plugins/vuepress-plugin-sillot-chunk-retry/src/core/types'

function createMockRouter(options?: { routes?: Array<any> }) {
  const guards: { beforeEach: Function[]; afterEach: Function[]; onError: Function[] } = {
    beforeEach: [],
    afterEach: [],
    onError: [],
  }

  const routes = options?.routes ?? [
    { name: 'test-page', path: '/test/', meta: {}, components: { default: {} }, props: true },
  ]

  const currentRoute = { value: { path: '/test/', fullPath: '/test/', name: 'test-page', matched: [], meta: {} } }

  return {
    beforeEach: vi.fn((fn) => { guards.beforeEach.push(fn); return () => {} }),
    afterEach: vi.fn((fn) => { guards.afterEach.push(fn); return () => {} }),
    onError: vi.fn((fn) => { guards.onError.push(fn); return () => {} }),
    getRoutes: vi.fn(() => routes),
    removeRoute: vi.fn(),
    addRoute: vi.fn(),
    push: vi.fn(() => Promise.resolve()),
    replace: vi.fn(() => Promise.resolve()),
    resolve: vi.fn((to) => ({ path: to, fullPath: to, name: 'test-page', matched: [], meta: {} })),
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
    it('clears retryCount in afterEach', () => {
      manager.init()
      sessionStorage.setItem('test-retry', '123')
      ;(manager as any).retryCount = 5
      router._guards.afterEach[0](createMockLocation('/test/'), createMockLocation('/'))
      expect((manager as any).retryCount).toBe(0)
      expect(sessionStorage.getItem('test-retry')).toBeNull()
    })

    it('clears recoveredUrls and recoveredModules in afterEach', () => {
      manager.init()
      ;(manager as any).recoveredUrls.add('https://example.com/assets/page.js')
      ;(manager as any).recoveredModules.set('https://example.com/assets/page.js', { default: {} })
      router._guards.afterEach[0](createMockLocation('/test/'), createMockLocation('/'))
      expect((manager as any).recoveredUrls.size).toBe(0)
      expect((manager as any).recoveredModules.size).toBe(0)
    })

    it('records lastNavigationTime in afterEach', () => {
      manager.init()
      const before = Date.now()
      router._guards.afterEach[0](createMockLocation('/test/'), createMockLocation('/'))
      const after = Date.now()
      expect((manager as any).lastNavigationTime).toBeGreaterThanOrEqual(before)
      expect((manager as any).lastNavigationTime).toBeLessThanOrEqual(after)
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

    it('triggers recovery for Safari dynamic import error', () => {
      manager.init()
      const onErrorFn = router._guards.onError[0]
      onErrorFn(new Error('Importing a module script failed.'), createMockLocation('/test/'), createMockLocation('/'))
      expect((manager as any).isRecovering).toBe(true)
    })

    it('triggers recovery for component resolution error', () => {
      manager.init()
      const onErrorFn = router._guards.onError[0]
      onErrorFn(new Error("Couldn't resolve component at /page"), createMockLocation('/test/'), createMockLocation('/'))
      expect((manager as any).isRecovering).toBe(true)
    })

    it('skips if already recovering', () => {
      manager.init()
      const onErrorFn = router._guards.onError[0]
      ;(manager as any).isRecovering = true
      ;(manager as any).pendingRecovery = Promise.resolve()
      sessionStorage.setItem('test-retry', '123')
      onErrorFn(new Error('Failed to fetch dynamically imported module: https://example.com/assets/page.js'), createMockLocation('/test/'), createMockLocation('/'))
      expect(router.push).not.toHaveBeenCalled()
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

    it('does NOT call event.preventDefault', () => {
      manager.init()
      const event = createMockPreloadEvent(new Error('Failed to fetch dynamically imported module: https://example.com/assets/page.js'))
      window.dispatchEvent(event)
      expect(event.defaultPrevented).toBe(false)
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

    it('skips already recovered URLs', () => {
      manager.init()
      ;(manager as any).recoveredUrls.add('https://example.com/assets/page.js')
      ;(manager as any).recoveredModules.set('https://example.com/assets/page.js', { default: {} })

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

  describe('fallbackNavigation', () => {
    it('attempts fallback when route has no name', () => {
      manager.init()
      const onErrorFn = router._guards.onError[0]
      onErrorFn(new Error('Failed to fetch dynamically imported module: https://example.com/assets/page.js'), createMockLocation('/test/', null), createMockLocation('/'))
      expect((manager as any).isRecovering).toBe(true)
    })

    it('attempts fallback when route name not found in router', () => {
      const customRouter = createMockRouter({ routes: [] })
      const customManager = new ChunkRetryManager(customRouter as any, { maxRetries: 3, retryDelay: 100, retryKey: 'test-retry' })
      customManager.init()
      sessionStorage.clear()

      const onErrorFn = customRouter._guards.onError[0]
      onErrorFn(new Error('Failed to fetch dynamically imported module: https://example.com/assets/page.js'), createMockLocation('/test/'), createMockLocation('/'))
      expect((customManager as any).isRecovering).toBe(true)
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

  describe('coordination between handlers', () => {
    it('preloadError triggers recovery that router.onError would also trigger', () => {
      manager.init()
      const event = createMockPreloadEvent(new Error('Failed to fetch dynamically imported module: https://example.com/assets/page.js'))
      window.dispatchEvent(event)

      expect((manager as any).isRecovering).toBe(true)

      const onErrorFn = router._guards.onError[0]
      onErrorFn(new Error('Failed to fetch dynamically imported module: https://example.com/assets/page.js'), createMockLocation('/test/'), createMockLocation('/'))

      expect(router.push).not.toHaveBeenCalled()
    })

    it('handleChunkFailure waits for already recovering process', () => {
      manager.init()
      const onErrorFn = router._guards.onError[0]
      ;(manager as any).isRecovering = true
      ;(manager as any).pendingRecovery = Promise.resolve()

      onErrorFn(new Error('Failed to fetch dynamically imported module: https://example.com/assets/page.js'), createMockLocation('/test/'), createMockLocation('/'))

      expect(router.push).not.toHaveBeenCalled()
    })
  })

  describe('recovered URL reuse', () => {
    it('retries navigation when URL is already recovered', () => {
      manager.init()
      ;(manager as any).recoveredUrls.add('https://example.com/assets/page.js')
      ;(manager as any).recoveredModules.set('https://example.com/assets/page.js', { default: {} })

      const onErrorFn = router._guards.onError[0]
      onErrorFn(new Error('Failed to fetch dynamically imported module: https://example.com/assets/page.js'), createMockLocation('/test/'), createMockLocation('/'))

      expect(router.push).toHaveBeenCalledWith('/test/')
      expect((manager as any).isRecovering).toBe(false)
    })

    it('does not enter full recovery for already recovered URLs', () => {
      manager.init()
      ;(manager as any).recoveredUrls.add('https://example.com/assets/page.js')
      ;(manager as any).recoveredModules.set('https://example.com/assets/page.js', { default: {} })

      const onErrorFn = router._guards.onError[0]
      onErrorFn(new Error('Failed to fetch dynamically imported module: https://example.com/assets/page.js'), createMockLocation('/test/'), createMockLocation('/'))

      expect((manager as any).isRecovering).toBe(false)
      expect(sessionStorage.getItem('test-retry')).toBeNull()
    })

    it('does not trigger reuse for non-recovered URLs', () => {
      manager.init()
      const onErrorFn = router._guards.onError[0]
      onErrorFn(new Error('Failed to fetch dynamically imported module: https://example.com/assets/page.js'), createMockLocation('/test/'), createMockLocation('/'))

      expect((manager as any).isRecovering).toBe(true)
    })
  })

  describe('updateRouteAndRetry component pattern', () => {
    it('uses Promise.resolve wrapper for component', async () => {
      manager.init()
      const mockModule = { default: { name: 'TestComponent', template: '<div>test</div>' } }

      await (manager as any).updateRouteAndRetry(createMockLocation('/test/'), mockModule)

      expect(router.addRoute).toHaveBeenCalledWith(
        expect.objectContaining({
          component: expect.any(Function),
        })
      )

      const addRouteCall = (router.addRoute as any).mock.calls[0][0]
      const componentFn = addRouteCall.component
      const result = componentFn()
      expect(result).toBeInstanceOf(Promise)
      const resolved = await result
      expect(resolved).toBe(mockModule)
    })

    it('uses router.replace instead of router.push', async () => {
      manager.init()
      const mockModule = { default: { name: 'TestComponent' } }
      await (manager as any).updateRouteAndRetry(createMockLocation('/test/'), mockModule)

      expect(router.replace).toHaveBeenCalledWith('/test/')
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
      ;(manager as any).recoveredUrls.add('https://example.com/assets/page.js')
      ;(manager as any).recoveredModules.set('https://example.com/assets/page.js', { default: {} })

      const to = createMockLocation('/test/')
      const staleGeneration = (manager as any).recoveryGeneration
      ;(manager as any).recoveryGeneration = staleGeneration + 100

      await (manager as any).recoverWithCacheBusting('https://example.com/assets/page.js', to, staleGeneration)

      expect(router.removeRoute).not.toHaveBeenCalled()
    })
  })
})
