import type { Page, Route } from '@playwright/test'

interface NetworkSimulatorOptions {
  failurePattern?: RegExp
  failCount?: number
  failDelay?: number
  intermittentPattern?: number[]
  onlyNewChunks?: boolean
}

export class NetworkSimulator {
  private page: Page
  private options: Required<Omit<NetworkSimulatorOptions, 'intermittentPattern' | 'onlyNewChunks'>>
  private intermittentPattern: number[] | undefined
  private onlyNewChunks: boolean
  private currentFailCount = 0
  private totalRequestCount = 0
  private interceptedRequests: Array<{ url: string; timestamp: number; failed: boolean }> = []
  private loadedUrls: Set<string> = new Set()
  private recordingPhase = true

  constructor(page: Page, options: NetworkSimulatorOptions = {}) {
    this.page = page
    this.intermittentPattern = options.intermittentPattern
    this.onlyNewChunks = options.onlyNewChunks ?? true
    this.options = {
      failurePattern: options.failurePattern ?? /assets\/.*\.js(\?.*)?$/,
      failCount: options.failCount ?? 1,
      failDelay: options.failDelay ?? 0,
    }
  }

  async start(): Promise<void> {
    this.recordingPhase = true
    this.loadedUrls.clear()

    const requests = await this.page.evaluate(() => {
      return performance.getEntriesByType('resource')
        .filter((r: any) => r.initiatorType === 'script' || r.name.includes('/assets/'))
        .map((r: any) => r.name)
    })
    requests.forEach(url => {
      try {
        const urlObj = new URL(url)
        this.loadedUrls.add(urlObj.origin + urlObj.pathname)
      } catch {}
    })

    this.recordingPhase = false

    await this.page.route(this.options.failurePattern, async (route: Route) => {
      const url = route.request().url()
      const urlObj = new URL(url)
      const isCacheBustRetry = urlObj.searchParams.has('t')
      const bareUrl = urlObj.origin + urlObj.pathname

      if (isCacheBustRetry) {
        this.interceptedRequests.push({ url, timestamp: Date.now(), failed: false })
        await route.continue()
        return
      }

      if (this.onlyNewChunks && this.loadedUrls.has(bareUrl)) {
        this.interceptedRequests.push({ url, timestamp: Date.now(), failed: false })
        await route.continue()
        return
      }

      this.totalRequestCount++
      const shouldFail = this.intermittentPattern
        ? this.intermittentPattern.includes(this.totalRequestCount)
        : this.currentFailCount < this.options.failCount

      this.interceptedRequests.push({
        url,
        timestamp: Date.now(),
        failed: shouldFail,
      })

      if (shouldFail) {
        this.currentFailCount++
        if (this.options.failDelay > 0) {
          await new Promise(resolve => setTimeout(resolve, this.options.failDelay))
        }
        await route.abort('failed')
      } else {
        await route.continue()
      }
    })
  }

  async stop(): Promise<void> {
    await this.page.unroute(this.options.failurePattern)
    this.currentFailCount = 0
    this.totalRequestCount = 0
    this.interceptedRequests = []
    this.loadedUrls.clear()
  }

  getInterceptedRequests() {
    return this.interceptedRequests
  }

  getFailedCount() {
    return this.currentFailCount
  }

  getTotalRequestCount() {
    return this.totalRequestCount
  }
}
