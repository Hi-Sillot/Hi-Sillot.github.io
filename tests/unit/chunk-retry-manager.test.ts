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
    manager = new ChunkRetryManager(router as any, { maxRetries: 3, retryDelay: 100, retryKey: 'test-retry', showStatus: false })
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

    it('does NOT clear state in afterEach when isApplyingModule is true', () => {
      manager.init()
      ;(manager as any).isApplyingModule = true
      ;(manager as any).retryCount = 5
      sessionStorage.setItem('test-retry', '123')
      ;(manager as any).recoveredModules.set('https://example.com/assets/page.js', { default: {} })
      ;(manager as any).pathModules.set('/test/', { default: {} })

      router._guards.afterEach[0](createMockLocation('/test/'), createMockLocation('/'))

      expect((manager as any).retryCount).toBe(5)
      expect((manager as any).pathModules.size).toBe(1)
      expect((manager as any).recoveredModules.size).toBe(1)
    })

    it('preserves recoveredModules when navigating to the same recovered path', () => {
      manager.init()
      ;(manager as any).lastRecoveredPath = '/test/'
      ;(manager as any).recoveredModules.set('https://example.com/assets/page.js', { default: {} })
      router._setCurrentRoute(createMockLocation('/test/'))

      router._guards.afterEach[0](createMockLocation('/test/'), createMockLocation('/'))

      expect((manager as any).recoveredModules.size).toBe(1)
    })

    it('clears recoveredModules when navigating away from recovered path', () => {
      manager.init()
      ;(manager as any).lastRecoveredPath = '/test/'
      ;(manager as any).recoveredModules.set('https://example.com/assets/page.js', { default: {} })
      router._setCurrentRoute(createMockLocation('/other-page/'))

      router._guards.afterEach[0](createMockLocation('/other-page/'), createMockLocation('/test/'))

      expect((manager as any).recoveredModules.size).toBe(0)
      expect((manager as any).lastRecoveredPath).toBeNull()
    })
  })

  describe('beforeEach', () => {
    it('stores pendingTarget from beforeEach', () => {
      manager.init()
      const target = createMockLocation('/other-page/', 'other-page')
      router._guards.beforeEach[0](target, createMockLocation('/test/'))
      expect((manager as any).pendingTarget).toBe(target)
    })

    it('does not trigger recovery from vite:preloadError when no cached module', () => {
      manager.init()
      const target = createMockLocation('/other-page/', 'other-page')
      router._guards.beforeEach[0](target, createMockLocation('/test/'))

      const event = createMockPreloadEvent(new Error('Failed to fetch dynamically imported module: https://example.com/assets/page.js'))
      window.dispatchEvent(event)

      expect((manager as any).isRecovering).toBe(false)
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
    it('triggers secondary chunk recovery for preload errors', () => {
      manager.init()
      const recoverSpy = vi.spyOn(manager as any, 'recoverSecondaryChunk')
      const event = createMockPreloadEvent(new Error('Failed to fetch dynamically imported module: https://example.com/assets/page.js'))
      window.dispatchEvent(event)

      expect(event.defaultPrevented).toBe(true)
      expect(recoverSpy).toHaveBeenCalledWith('https://example.com/assets/page.js')
      recoverSpy.mockRestore()
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

    it('tries reload when URL already in recoveredModules', () => {
      manager.init()
      const mockModule = { default: { name: 'TestComponent' } }
      ;(manager as any).recoveredModules.set('https://example.com/assets/page.js', mockModule)
      const reloadSpy = vi.spyOn(manager as any, 'tryReloadCurrentPage')

      const event = createMockPreloadEvent(new Error('Failed to fetch dynamically imported module: https://example.com/assets/page.js'))
      window.dispatchEvent(event)

      expect(reloadSpy).toHaveBeenCalledWith('https://example.com/assets/page.js')
      reloadSpy.mockRestore()
    })

    it('does not start recovery when isRecovering is true', () => {
      manager.init()
      ;(manager as any).isRecovering = true
      const recoverSpy = vi.spyOn(manager as any, 'recoverSecondaryChunk')

      const event = createMockPreloadEvent(new Error('Failed to fetch dynamically imported module: https://example.com/assets/page.js'))
      window.dispatchEvent(event)

      expect(recoverSpy).not.toHaveBeenCalled()
      recoverSpy.mockRestore()
    })

    it('does not start recovery when isApplyingModule is true', () => {
      manager.init()
      ;(manager as any).isApplyingModule = true
      const recoverSpy = vi.spyOn(manager as any, 'recoverSecondaryChunk')

      const event = createMockPreloadEvent(new Error('Failed to fetch dynamically imported module: https://example.com/assets/page.js'))
      window.dispatchEvent(event)

      expect(recoverSpy).not.toHaveBeenCalled()
      recoverSpy.mockRestore()
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

  describe('beforeEach route loader patching', () => {
    it('patches route loader in beforeEach when pathModules has entry', async () => {
      manager.init()
      const mockModule = { default: { name: 'TestComponent' } }
      ;(manager as any).pathModules.set('/test/', mockModule)
      const mockRoutes = {
        '/test/': { loader: () => Promise.resolve({ old: true }) }
      }
      ;(manager as any).routes = mockRoutes

      const to = createMockLocation('/test/')
      router._guards.beforeEach[0](to, createMockLocation('/'))

      await expect(mockRoutes['/test/'].loader()).resolves.toBe(mockModule)
      expect((manager as any).pendingLoaderRestore).toBeTruthy()
      expect((manager as any).pendingLoaderRestore.routeKey).toBe('/test/')
    })

    it('uses resolveRoutePathFn to find route key', async () => {
      manager.init()
      const mockModule = { default: { name: 'TestComponent' } }
      ;(manager as any).pathModules.set('/test/', mockModule)
      const mockRoutes = {
        '/resolved-test/': { loader: () => Promise.resolve({ old: true }) }
      }
      ;(manager as any).routes = mockRoutes
      ;(manager as any).resolveRoutePathFn = (pathname: string) => '/resolved-test/'

      const to = createMockLocation('/test/')
      router._guards.beforeEach[0](to, createMockLocation('/'))

      await expect(mockRoutes['/resolved-test/'].loader()).resolves.toBe(mockModule)
      expect((manager as any).pendingLoaderRestore.routeKey).toBe('/resolved-test/')
    })

    it('falls back to candidate matching when resolveRoutePathFn fails', async () => {
      manager.init()
      const mockModule = { default: { name: 'TestComponent' } }
      ;(manager as any).pathModules.set('/test/', mockModule)
      const mockRoutes = {
        '/test/': { loader: () => Promise.resolve({ old: true }) }
      }
      ;(manager as any).routes = mockRoutes
      ;(manager as any).resolveRoutePathFn = () => { throw new Error('not available') }

      const to = createMockLocation('/test/')
      router._guards.beforeEach[0](to, createMockLocation('/'))

      await expect(mockRoutes['/test/'].loader()).resolves.toBe(mockModule)
      expect((manager as any).pendingLoaderRestore).toBeTruthy()
    })

    it('does not patch when pathModules has no entry', () => {
      manager.init()
      const mockRoutes = {
        '/test/': { loader: () => Promise.resolve({ old: true }) }
      }
      ;(manager as any).routes = mockRoutes

      const to = createMockLocation('/test/')
      router._guards.beforeEach[0](to, createMockLocation('/'))

      expect((manager as any).pendingLoaderRestore).toBeNull()
    })
  })

  describe('afterEach loader restore', () => {
    it('restores original route loader in afterEach using routeKey', () => {
      manager.init()
      const originalLoader = () => Promise.resolve({ old: true })
      ;(manager as any).pendingLoaderRestore = { routeKey: '/test/', originalLoader }
      const mockRoutes = {
        '/test/': { loader: () => Promise.resolve({ patched: true }) }
      }
      ;(manager as any).routes = mockRoutes

      router._guards.afterEach[0](createMockLocation('/test/'), createMockLocation('/'))

      expect(mockRoutes['/test/'].loader).toBe(originalLoader)
      expect((manager as any).pendingLoaderRestore).toBeNull()
    })
  })

  describe('isApplyingModule guard', () => {
    it('router.onError is ignored when isApplyingModule is true', () => {
      manager.init()
      ;(manager as any).isApplyingModule = true

      const onErrorFn = router._guards.onError[0]
      const error = new Error('Failed to fetch dynamically imported module: https://example.com/assets/page.js')
      onErrorFn(error, createMockLocation('/test/'), createMockLocation('/'))

      expect((manager as any).isRecovering).toBe(false)
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
      expect((defaultManager as any).options.showStatus).toBe(true)
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
    it('preloadError does not trigger recovery - only onError does', () => {
      manager.init()
      const event = createMockPreloadEvent(new Error('Failed to fetch dynamically imported module: https://example.com/assets/page.js'))
      window.dispatchEvent(event)

      expect((manager as any).isRecovering).toBe(false)

      const onErrorFn = router._guards.onError[0]
      onErrorFn(new Error('Failed to fetch dynamically imported module: https://example.com/assets/page.js'), createMockLocation('/test/'), createMockLocation('/'))

      expect((manager as any).isRecovering).toBe(true)
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

  describe('StatusIndicator', () => {
    let statusRouter: ReturnType<typeof createMockRouter>
    let statusManager: ChunkRetryManager

    beforeEach(() => {
      statusRouter = createMockRouter()
      statusManager = new ChunkRetryManager(statusRouter as any, { maxRetries: 3, retryDelay: 100, retryKey: 'status-test', showStatus: true })
      sessionStorage.clear()
      document.body.innerHTML = ''
      document.head.innerHTML = ''
    })

    afterEach(() => {
      statusManager.destroy()
      document.body.innerHTML = ''
      document.head.innerHTML = ''
    })

    it('creates status bar element on initUI', () => {
      statusManager.init()
      statusManager.initUI()
      expect(document.querySelector('#chunk-retry-status')).not.toBeNull()
    })

    it('creates status styles on initUI', () => {
      statusManager.init()
      statusManager.initUI()
      expect(document.querySelector('#chunk-retry-status-styles')).not.toBeNull()
    })

    it('does not create status bar on init alone', () => {
      statusManager.init()
      expect(document.querySelector('#chunk-retry-status')).toBeNull()
    })

    it('does not create UI when showStatus is false', () => {
      const noStatusManager = new ChunkRetryManager(statusRouter as any, { showStatus: false })
      noStatusManager.init()
      noStatusManager.initUI()
      expect(document.querySelector('#chunk-retry-status')).toBeNull()
      noStatusManager.destroy()
    })

    it('showRecovering sets recovering className', () => {
      statusManager.init()
      statusManager.initUI()
      const status = (statusManager as any).status
      status.showRecovering()
      const bar = document.querySelector('#chunk-retry-status') as HTMLDivElement
      expect(bar.className).toBe('chunk-retry-status recovering')
    })

    it('showSuccess sets success className', () => {
      statusManager.init()
      statusManager.initUI()
      const status = (statusManager as any).status
      status.showSuccess()
      const bar = document.querySelector('#chunk-retry-status') as HTMLDivElement
      expect(bar.className).toBe('chunk-retry-status success')
    })

    it('showFail sets fail className', () => {
      statusManager.init()
      statusManager.initUI()
      const status = (statusManager as any).status
      status.showFail()
      const bar = document.querySelector('#chunk-retry-status') as HTMLDivElement
      expect(bar.className).toBe('chunk-retry-status fail')
    })

    it('hide clears className', () => {
      statusManager.init()
      statusManager.initUI()
      const status = (statusManager as any).status
      status.showRecovering()
      status.hide()
      const bar = document.querySelector('#chunk-retry-status') as HTMLDivElement
      expect(bar.className).toBe('')
    })

    it('showSuccess auto-hides after 1.5s', async () => {
      vi.useFakeTimers()
      statusManager.init()
      statusManager.initUI()
      const status = (statusManager as any).status
      status.showSuccess()
      const bar = document.querySelector('#chunk-retry-status') as HTMLDivElement
      expect(bar.className).toBe('chunk-retry-status success')

      vi.advanceTimersByTime(1500)
      expect(bar.className).toBe('')
      vi.useRealTimers()
    })

    it('showFail auto-hides after 3s', async () => {
      vi.useFakeTimers()
      statusManager.init()
      statusManager.initUI()
      const status = (statusManager as any).status
      status.showFail()
      const bar = document.querySelector('#chunk-retry-status') as HTMLDivElement
      expect(bar.className).toBe('chunk-retry-status fail')

      vi.advanceTimersByTime(3000)
      expect(bar.className).toBe('')
      vi.useRealTimers()
    })

    it('destroy removes bar element and styles', () => {
      statusManager.init()
      statusManager.initUI()
      expect(document.querySelector('#chunk-retry-status')).not.toBeNull()
      expect(document.querySelector('#chunk-retry-status-styles')).not.toBeNull()

      statusManager.destroy()
      expect(document.querySelector('#chunk-retry-status')).toBeNull()
      expect(document.querySelector('#chunk-retry-status-styles')).toBeNull()
    })

    it('status.hide is called in afterEach when not recovering', () => {
      statusManager.init()
      statusManager.initUI()
      const status = (statusManager as any).status
      const hideSpy = vi.spyOn(status, 'hide')

      statusRouter._guards.afterEach[0](createMockLocation('/test/'), createMockLocation('/'))

      expect(hideSpy).toHaveBeenCalled()
      hideSpy.mockRestore()
    })
  })

  describe('navigateWithFallback', () => {
    it('calls router.replace and shows success when path matches', async () => {
      vi.useFakeTimers()
      manager.init()
      const to = createMockLocation('/test/')
      router._setCurrentRoute(to)

      const promise = (manager as any).navigateWithFallback(to)

      await vi.advanceTimersByTimeAsync(0)
      await vi.advanceTimersByTimeAsync(1000)
      await promise

      expect(router.replace).toHaveBeenCalledWith('/test/')
      expect((manager as any).isApplyingModule).toBe(false)
      vi.useRealTimers()
    })

    it('falls back to location.href when path does not match after 1s', async () => {
      vi.useFakeTimers()
      manager.init()
      const to = createMockLocation('/target/')
      router._setCurrentRoute(createMockLocation('/current/'))

      const promise = (manager as any).navigateWithFallback(to)

      await vi.advanceTimersByTimeAsync(0)
      await vi.advanceTimersByTimeAsync(1000)
      await promise

      expect(router.replace).toHaveBeenCalledWith('/target/')
      vi.useRealTimers()
    })

    it('falls back to location.href when router.replace throws', async () => {
      manager.init()
      const to = createMockLocation('/test/')
      router._setCurrentRoute(to)

      const replaceError = new Error('Navigation failed')
      router.replace = vi.fn(() => Promise.reject(replaceError))

      const statusSpy = vi.spyOn((manager as any).status, 'showFail')

      await (manager as any).navigateWithFallback(to)

      expect(statusSpy).toHaveBeenCalled()
      expect((manager as any).isRecovering).toBe(false)
      expect((manager as any).isApplyingModule).toBe(false)
      statusSpy.mockRestore()
    })

    it('sets isApplyingModule during navigation', async () => {
      vi.useFakeTimers()
      manager.init()
      const to = createMockLocation('/test/')
      router._setCurrentRoute(to)

      let applyingDuringNav = false
      router.replace = vi.fn(async () => {
        applyingDuringNav = (manager as any).isApplyingModule
      })

      const promise = (manager as any).navigateWithFallback(to)

      await vi.advanceTimersByTimeAsync(0)
      await vi.advanceTimersByTimeAsync(1000)
      await promise

      expect(applyingDuringNav).toBe(true)
      vi.useRealTimers()
    })
  })

  describe('pathSimilarity', () => {
    it('returns 1 for identical paths', () => {
      manager.init()
      expect((manager as any).pathSimilarity('/test/', '/test/')).toBe(1)
    })

    it('returns 0 for paths with no common segments', () => {
      manager.init()
      expect((manager as any).pathSimilarity('aaa', 'bbb')).toBe(0)
    })

    it('returns low score for different paths sharing only root', () => {
      manager.init()
      const score = (manager as any).pathSimilarity('/aaa/', '/bbb/')
      expect(score).toBeLessThan(1)
      expect(score).toBeGreaterThan(0)
    })

    it('returns partial score for partially matching paths', () => {
      manager.init()
      const score = (manager as any).pathSimilarity('/blog/post/', '/blog/other/')
      expect(score).toBeGreaterThan(0)
      expect(score).toBeLessThan(1)
    })

    it('handles trailing slashes', () => {
      manager.init()
      const score = (manager as any).pathSimilarity('/test', '/test/')
      expect(score).toBeGreaterThan(0)
    })
  })
})
