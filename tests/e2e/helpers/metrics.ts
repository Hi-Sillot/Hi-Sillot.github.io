export interface NavigationMetrics {
  scenario: string
  success: boolean
  navigationStartTime: number
  navigationEndTime: number
  recoveryTimeMs: number
  pageLoaded: boolean
  errorMessage: string | null
}

export class MetricsCollector {
  private metrics: NavigationMetrics[] = []

  add(metric: NavigationMetrics) {
    this.metrics.push(metric)
  }

  getMetrics(): NavigationMetrics[] {
    return this.metrics
  }

  getSummary(): {
    totalScenarios: number
    successCount: number
    failureCount: number
    successRate: number
    avgRecoveryTimeMs: number
    maxRecoveryTimeMs: number
    minRecoveryTimeMs: number
  } {
    const successes = this.metrics.filter(m => m.success)
    const failures = this.metrics.filter(m => !m.success)
    const recoveryTimes = successes.map(m => m.recoveryTimeMs).filter(t => t > 0)

    return {
      totalScenarios: this.metrics.length,
      successCount: successes.length,
      failureCount: failures.length,
      successRate: this.metrics.length > 0 ? successes.length / this.metrics.length : 0,
      avgRecoveryTimeMs: recoveryTimes.length > 0 ? recoveryTimes.reduce((a, b) => a + b, 0) / recoveryTimes.length : 0,
      maxRecoveryTimeMs: recoveryTimes.length > 0 ? Math.max(...recoveryTimes) : 0,
      minRecoveryTimeMs: recoveryTimes.length > 0 ? Math.min(...recoveryTimes) : 0,
    }
  }

  formatReport(): string {
    const summary = this.getSummary()
    const lines = [
      '=== Chunk Retry E2E Test Report ===',
      `Total Scenarios: ${summary.totalScenarios}`,
      `Success: ${summary.successCount} | Failure: ${summary.failureCount}`,
      `Success Rate: ${(summary.successRate * 100).toFixed(1)}%`,
      `Recovery Time: avg=${summary.avgRecoveryTimeMs.toFixed(0)}ms, min=${summary.minRecoveryTimeMs}ms, max=${summary.maxRecoveryTimeMs}ms`,
      '',
      '--- Details ---',
    ]

    for (const m of this.metrics) {
      lines.push(
        `[${m.scenario}] ${m.success ? 'PASS' : 'FAIL'} | recovery=${m.recoveryTimeMs}ms | pageLoaded=${m.pageLoaded} | error=${m.errorMessage ?? 'none'}`
      )
    }

    return lines.join('\n')
  }
}
