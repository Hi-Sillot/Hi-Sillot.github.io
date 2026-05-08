import type { Page, Route } from '@playwright/test'

interface NetworkSimulatorOptions {
  failurePattern?: RegExp
  failCount?: number
  failDelay?: number
}

export class NetworkSimulator {
  private page: Page
  private options: Required<NetworkSimulatorOptions>
  private currentFailCount = 0
  private interceptedRequests: Array<{ url: string; timestamp: number }> = []

  constructor(page: Page, options: NetworkSimulatorOptions = {}) {
    this.page = page
    this.options = {
      failurePattern: /assets\/.*\.js$/,
      failCount: options.failCount ?? 1,
      failDelay: options.failDelay ?? 0,
    }
  }

  async start(): Promise<void> {
    await this.page.route(this.options.failurePattern, async (route: Route) => {
      this.interceptedRequests.push({
        url: route.request().url(),
        timestamp: Date.now(),
      })

      if (this.currentFailCount < this.options.failCount) {
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
  }

  getInterceptedRequests() {
    return this.interceptedRequests
  }

  getFailedCount() {
    return this.currentFailCount
  }
}
