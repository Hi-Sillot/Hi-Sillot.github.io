import type { Page, Route } from '@playwright/test'

interface NetworkSimulatorOptions {
  failurePattern?: RegExp
  failCount?: number
  failDelay?: number
  intermittentPattern?: number[]
}

export class NetworkSimulator {
  private page: Page
  private options: Required<Omit<NetworkSimulatorOptions, 'intermittentPattern'>>
  private intermittentPattern: number[] | undefined
  private currentFailCount = 0
  private totalRequestCount = 0
  private interceptedRequests: Array<{ url: string; timestamp: number; failed: boolean }> = []

  constructor(page: Page, options: NetworkSimulatorOptions = {}) {
    this.page = page
    this.intermittentPattern = options.intermittentPattern
    this.options = {
      failurePattern: options.failurePattern ?? /assets\/.*\.js$/,
      failCount: options.failCount ?? 1,
      failDelay: options.failDelay ?? 0,
    }
  }

  async start(): Promise<void> {
    await this.page.route(this.options.failurePattern, async (route: Route) => {
      this.totalRequestCount++
      const shouldFail = this.intermittentPattern
        ? this.intermittentPattern.includes(this.totalRequestCount)
        : this.currentFailCount < this.options.failCount

      this.interceptedRequests.push({
        url: route.request().url(),
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
