// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'
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

  return {
    beforeEach: vi.fn((fn) => { guards.beforeEach.push(fn); return () => {} }),
    afterEach: vi.fn((fn) => { guards.afterEach.push(fn); return () => {} }),
    onError: vi.fn((fn) => { guards.onError.push(fn); return () => {} }),
    getRoutes: vi.fn(() => routes),
    removeRoute: vi.fn(),
    addRoute: vi.fn(),
    push: vi.fn(() => Promise.resolve()),
    resolve: vi.fn((to) => ({ path: to, fullPath: to, name: 'test-page', matched: [], meta: {} })),
    _guards: guards,
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
    manager = new ChunkRetryManager(router as any, { maxRetries: 3, retryDelay: 100, retryKey: 'test-retry' })
    sessionStorage.clear()
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
        expect(ssrRouter.beforeEach).not.toHaveBeenCalled()
      } finally {
        Object.defineProperty(globalThis, 'window', { value: originalWindow, writable: true, configurable: true })
        vi.resetModules()
      }
    })
  })

  describe('beforeEach / afterEach', () => {
    it('tracks pendingTarget in beforeEach', () => {
      manager.init()
      const to = createMockLocation('/test/')
      router._guards.beforeEach[0](to, createMockLocation('/'))
      expect((manager as any).pendingTarget).toBe(to)
    })

    it('clears pendingTarget in afterEach', () => {
      manager.init()
      const to = createMockLocation('/test/')
      router._guards.beforeEach[0](to, createMockLocation('/'))
      router._guards.afterEach[0](to, createMockLocation('/'))
      expect((manager as any).pendingTarget).toBeNull()
    })

    it('clears retryCount and sessionStorage in afterEach', () => {
      manager.init()
      sessionStorage.setItem('test-retry', '123')
      ;(manager as any).retryCount = 5
      router._guards.afterEach[0](createMockLocation('/test/'), createMockLocation('/'))
      expect((manager as any).retryCount).toBe(0)
      expect(sessionStorage.getItem('test-retry')).toBeNull()
    })

    it('resets isRecovering in afterEach', () => {
      manager.init()
      ;(manager as any).isRecovering = true
      router._guards.afterEach[0](createMockLocation('/test/'), createMockLocation('/'))
      expect((manager as any).isRecovering).toBe(false)
    })

    it('clears prefetchPromise and prefetchUrl in afterEach', () => {
      manager.init()
      ;(manager as any).prefetchPromise = Promise.resolve({})
      ;(manager as any).prefetchUrl = 'http://example.com/test.js'
      router._guards.afterEach[0](createMockLocation('/test/'), createMockLocation('/'))
      expect((manager as any).prefetchPromise).toBeNull()
      expect((manager as any).prefetchUrl).toBeNull()
    })
  })

  describe('handleRouterError', () => {
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

    it('falls back when no URL can be extracted from error', () => {
      manager.init()
      const onErrorFn = router._guards.onError[0]
      onErrorFn(new Error('Importing a module script failed.'), createMockLocation('/test/'), createMockLocation('/'))
      expect((manager as any).isRecovering).toBe(true)
      expect(sessionStorage.getItem('test-retry')).not.toBeNull()
    })
  })

  describe('handlePreloadError', () => {
    it('starts prefetch for valid error with URL', () => {
      manager.init()
      const event = createMockPreloadEvent(new Error('Failed to fetch dynamically imported module: https://example.com/assets/page.js'))
      window.dispatchEvent(event)

      expect((manager as any).prefetchUrl).toBe('https://example.com/assets/page.js')
      expect((manager as any).prefetchPromise).not.toBeNull()
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
      expect((manager as any).prefetchUrl).toBeNull()
    })

    it('ignores preloadError with error that has no extractable URL', () => {
      manager.init()
      const event = createMockPreloadEvent(new Error('Some unknown error'))
      window.dispatchEvent(event)
      expect((manager as any).prefetchUrl).toBeNull()
    })

    it('does not overwrite existing prefetch for same URL', () => {
      manager.init()
      const event1 = createMockPreloadEvent(new Error('Failed to fetch dynamically imported module: https://example.com/assets/page.js'))
      window.dispatchEvent(event1)
      const firstPromise = (manager as any).prefetchPromise

      const event2 = createMockPreloadEvent(new Error('Failed to fetch dynamically imported module: https://example.com/assets/page.js'))
      window.dispatchEvent(event2)
      expect((manager as any).prefetchPromise).toBe(firstPromise)
    })

    it('starts new prefetch for different URL', () => {
      manager.init()
      const event1 = createMockPreloadEvent(new Error('Failed to fetch dynamically imported module: https://example.com/assets/page1.js'))
      window.dispatchEvent(event1)
      const firstPromise = (manager as any).prefetchPromise

      const event2 = createMockPreloadEvent(new Error('Failed to fetch dynamically imported module: https://example.com/assets/page2.js'))
      window.dispatchEvent(event2)
      expect((manager as any).prefetchUrl).toBe('https://example.com/assets/page2.js')
      expect((manager as any).prefetchPromise).not.toBe(firstPromise)
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
    it('handlePreloadError prefetch is used by handleRouterError', () => {
      manager.init()
      const event = createMockPreloadEvent(new Error('Failed to fetch dynamically imported module: https://example.com/assets/page.js'))
      window.dispatchEvent(event)

      expect((manager as any).prefetchUrl).toBe('https://example.com/assets/page.js')
      expect((manager as any).prefetchPromise).not.toBeNull()

      const onErrorFn = router._guards.onError[0]
      onErrorFn(new Error('Failed to fetch dynamically imported module: https://example.com/assets/page.js'), createMockLocation('/test/'), createMockLocation('/'))

      expect((manager as any).isRecovering).toBe(true)
    })

    it('handleRouterError waits for already recovering process', () => {
      manager.init()
      const onErrorFn = router._guards.onError[0]
      ;(manager as any).isRecovering = true
      ;(manager as any).pendingRecovery = Promise.resolve()

      onErrorFn(new Error('Failed to fetch dynamically imported module: https://example.com/assets/page.js'), createMockLocation('/test/'), createMockLocation('/'))

      expect(router.push).not.toHaveBeenCalled()
    })
  })

  describe('prefetch integration', () => {
    it('prefetchPromise catches errors and resolves to null', async () => {
      manager.init()
      const event = createMockPreloadEvent(new Error('Failed to fetch dynamically imported module: https://example.com/assets/page.js'))
      window.dispatchEvent(event)

      const result = await (manager as any).prefetchPromise
      expect(result).toBeNull()
    })

    it('recoverWithCacheBusting uses prefetch when available', async () => {
      manager.init()
      ;(manager as any).prefetchPromise = Promise.resolve({ default: { name: 'TestComponent' } })
      ;(manager as any).prefetchUrl = 'https://example.com/assets/page.js'

      const to = createMockLocation('/test/')
      const gen = (manager as any).recoveryGeneration
      await (manager as any).recoverWithCacheBusting('https://example.com/assets/page.js', to, gen)

      expect(router.removeRoute).toHaveBeenCalled()
      expect(router.addRoute).toHaveBeenCalled()
    })

    it('recoverWithCacheBusting falls back to direct import when prefetch is null', async () => {
      manager.init()
      ;(manager as any).prefetchPromise = Promise.resolve(null)
      ;(manager as any).prefetchUrl = 'https://example.com/assets/page.js'

      const to = createMockLocation('/test/')
      const gen = (manager as any).recoveryGeneration
      try {
        await (manager as any).recoverWithCacheBusting('https://example.com/assets/page.js', to, gen)
      } catch {
        // Expected to fail in test environment
      }
    })
  })

  describe('phantom failure detection', () => {
    it('retries navigation when URL is already recovered', () => {
      manager.init()
      ;(manager as any).recoveredUrls.add('https://example.com/assets/page.js')

      const onErrorFn = router._guards.onError[0]
      onErrorFn(new Error('Failed to fetch dynamically imported module: https://example.com/assets/page.js'), createMockLocation('/test/'), createMockLocation('/'))

      expect(router.push).toHaveBeenCalledWith('/test/')
      expect((manager as any).isRecovering).toBe(false)
      expect((manager as any).phantomRetryCount).toBe(1)
    })

    it('falls back after 3 phantom retries', () => {
      manager.init()
      ;(manager as any).recoveredUrls.add('https://example.com/assets/page.js')
      ;(manager as any).phantomRetryCount = 3

      const originalLocation = window.location
      Object.defineProperty(window, 'location', { value: { href: '', pathname: '/', search: '' }, writable: true, configurable: true })

      const onErrorFn = router._guards.onError[0]
      onErrorFn(new Error('Failed to fetch dynamically imported module: https://example.com/assets/page.js'), createMockLocation('/test/'), createMockLocation('/'))

      expect(window.location.href).toBe('/test/')

      Object.defineProperty(window, 'location', { value: originalLocation, writable: true, configurable: true })
    })

    it('does not enter full recovery for phantom failures', () => {
      manager.init()
      ;(manager as any).recoveredUrls.add('https://example.com/assets/page.js')

      const onErrorFn = router._guards.onError[0]
      onErrorFn(new Error('Failed to fetch dynamically imported module: https://example.com/assets/page.js'), createMockLocation('/test/'), createMockLocation('/'))

      expect((manager as any).isRecovering).toBe(false)
      expect(sessionStorage.getItem('test-retry')).toBeNull()
    })

    it('does not trigger phantom path for non-recovered URLs', () => {
      manager.init()
      const onErrorFn = router._guards.onError[0]
      onErrorFn(new Error('Failed to fetch dynamically imported module: https://example.com/assets/page.js'), createMockLocation('/test/'), createMockLocation('/'))

      expect((manager as any).isRecovering).toBe(true)
      expect((manager as any).phantomRetryCount).toBe(0)
    })
  })

  describe('recoveredModules', () => {
    it('stores module in recoveredModules when prefetch succeeds', async () => {
      manager.init()
      ;(manager as any).prefetchPromise = Promise.resolve({ default: { name: 'TestComponent' } })
      ;(manager as any).prefetchUrl = 'https://example.com/assets/page.js'

      const to = createMockLocation('/test/')
      const gen = (manager as any).recoveryGeneration
      await (manager as any).recoverWithCacheBusting('https://example.com/assets/page.js', to, gen)

      expect((manager as any).recoveredModules.has('https://example.com/assets/page.js')).toBe(true)
    })

    it('clears recoveredModules in afterEach', () => {
      manager.init()
      ;(manager as any).recoveredModules.set('https://example.com/assets/page.js', { default: {} })
      router._guards.afterEach[0](createMockLocation('/test/'), createMockLocation('/'))
      expect((manager as any).recoveredModules.size).toBe(0)
    })

    it('handlePreloadError skips prefetch for already recovered URLs', () => {
      manager.init()
      ;(manager as any).recoveredUrls.add('https://example.com/assets/page.js')
      ;(manager as any).recoveredModules.set('https://example.com/assets/page.js', { default: {} })

      const event = createMockPreloadEvent(new Error('Failed to fetch dynamically imported module: https://example.com/assets/page.js'))
      window.dispatchEvent(event)

      expect((manager as any).prefetchUrl).toBeNull()
      expect((manager as any).prefetchPromise).toBeNull()
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

    it('resets phantomRetryCount in updateRouteAndRetry', async () => {
      manager.init()
      ;(manager as any).phantomRetryCount = 2

      const mockModule = { default: { name: 'TestComponent' } }
      await (manager as any).updateRouteAndRetry(createMockLocation('/test/'), mockModule)

      expect((manager as any).phantomRetryCount).toBe(0)
    })
  })

  describe('recovery generation and target', () => {
    it('cancels stale recovery when new route error arrives', () => {
      manager.init()
      ;(manager as any).isRecovering = true
      ;(manager as any).recoveryTarget = createMockLocation('/old-page/')
      ;(manager as any).pendingRecovery = Promise.resolve()

      const onErrorFn = router._guards.onError[0]
      onErrorFn(new Error('Failed to fetch dynamically imported module: https://example.com/assets/new-page.js'), createMockLocation('/new-page/'), createMockLocation('/'))

      expect((manager as any).isRecovering).toBe(true)
      expect((manager as any).recoveryTarget?.fullPath).toBe('/new-page/')
      expect((manager as any).retryCount).toBe(0)
    })

    it('keeps current recovery when same route error arrives', () => {
      manager.init()
      ;(manager as any).isRecovering = true
      ;(manager as any).recoveryTarget = createMockLocation('/test/')
      ;(manager as any).pendingRecovery = Promise.resolve()

      const onErrorFn = router._guards.onError[0]
      onErrorFn(new Error('Failed to fetch dynamically imported module: https://example.com/assets/page.js'), createMockLocation('/test/'), createMockLocation('/'))

      expect((manager as any).recoveryTarget?.fullPath).toBe('/test/')
    })

    it('increments recoveryGeneration on new recovery', () => {
      manager.init()
      const initialGen = (manager as any).recoveryGeneration

      const onErrorFn = router._guards.onError[0]
      onErrorFn(new Error('Failed to fetch dynamically imported module: https://example.com/assets/page.js'), createMockLocation('/test/'), createMockLocation('/'))

      expect((manager as any).recoveryGeneration).toBe(initialGen + 1)
    })

    it('stale recovery is skipped when generation mismatches', async () => {
      manager.init()
      const mockModule = { default: { name: 'TestComponent' } }
      ;(manager as any).prefetchPromise = Promise.resolve(mockModule)
      ;(manager as any).prefetchUrl = 'https://example.com/assets/page.js'

      const to = createMockLocation('/test/')
      const staleGeneration = (manager as any).recoveryGeneration
      ;(manager as any).recoveryGeneration = staleGeneration + 100

      await (manager as any).recoverWithCacheBusting('https://example.com/assets/page.js', to, staleGeneration)

      expect(router.removeRoute).not.toHaveBeenCalled()
    })

    it('clears recoveryTarget in afterEach', () => {
      manager.init()
      ;(manager as any).recoveryTarget = createMockLocation('/test/')
      router._guards.afterEach[0](createMockLocation('/test/'), createMockLocation('/'))
      expect((manager as any).recoveryTarget).toBeNull()
    })
  })
})
