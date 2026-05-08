import { execSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT = resolve(import.meta.dirname, '..')
const PLUGINS_FILE = resolve(ROOT, 'docs/.vuepress/config.plugins.ts')
const REPORT_FILE = resolve(ROOT, 'test-comparison-report.txt')

const PLUGIN_LINE = 'ChunkRetryPlugin(),'
const PLUGIN_COMMENT = '// ChunkRetryPlugin(),'

function setPluginEnabled(enabled) {
  let content = readFileSync(PLUGINS_FILE, 'utf-8')
  if (enabled) {
    content = content.replace(PLUGIN_COMMENT, PLUGIN_LINE)
    if (!content.includes(PLUGIN_LINE)) {
      throw new Error('Cannot enable plugin: line not found')
    }
  } else {
    content = content.replace(PLUGIN_LINE, PLUGIN_COMMENT)
    if (!content.includes(PLUGIN_COMMENT)) {
      throw new Error('Cannot disable plugin: line not found')
    }
  }
  writeFileSync(PLUGINS_FILE, content)
}

function build() {
  console.log('  Building...')
  execSync('npm run docs:build', { cwd: ROOT, stdio: 'pipe' })
}

function runTests(env) {
  console.log(`  Running E2E tests (${env})...`)
  try {
    const output = execSync(
      `npx playwright test tests/e2e/compare.spec.ts --reporter=list`,
      {
        cwd: ROOT,
        env: { ...process.env, CHUNK_RETRY_PLUGIN: env },
        stdio: 'pipe',
        encoding: 'utf-8',
      },
    )
    return output
  } catch (e) {
    return e.stdout || e.message
  }
}

function extractResults(output) {
  const results = []
  const lines = output.split('\n')
  for (const line of lines) {
    const match = line.match(/\[(.+?)\]\s+(PASS|FAIL)\s*\|\s*recovery=(\d+)ms/)
    if (match) {
      results.push({
        scenario: match[1],
        success: match[2] === 'PASS',
        recoveryTimeMs: parseInt(match[3], 10),
      })
    }
  }
  return results
}

console.log('=== Chunk Retry Plugin A/B Comparison Test ===\n')

const report = []
report.push('=== Chunk Retry Plugin A/B Comparison Test Report ===')
report.push(`Date: ${new Date().toISOString()}`)
report.push('')

console.log('Phase A: Testing WITHOUT plugin (plugin disabled)')
report.push('--- Phase A: WITHOUT plugin ---')
setPluginEnabled(false)
build()
const outputA = runTests('disabled')
const resultsA = extractResults(outputA)
console.log(outputA)
for (const r of resultsA) {
  report.push(`  [${r.scenario}] ${r.success ? 'PASS' : 'FAIL'} | recovery=${r.recoveryTimeMs}ms`)
}
report.push('')

console.log('\nPhase B: Testing WITH plugin (plugin enabled)')
report.push('--- Phase B: WITH plugin ---')
setPluginEnabled(true)
build()
const outputB = runTests('enabled')
const resultsB = extractResults(outputB)
console.log(outputB)
for (const r of resultsB) {
  report.push(`  [${r.scenario}] ${r.success ? 'PASS' : 'FAIL'} | recovery=${r.recoveryTimeMs}ms`)
}
report.push('')

report.push('=== Comparison Summary ===')
const allScenarios = new Set([...resultsA.map(r => r.scenario.replace('-no-plugin', '')), ...resultsB.map(r => r.scenario.replace('-with-plugin', ''))])

report.push('')
report.push(`${'Scenario'.padEnd(40)} | ${'No Plugin'.padEnd(15)} | ${'With Plugin'.padEnd(15)} | Delta`)
report.push('-'.repeat(90))

for (const scenario of allScenarios) {
  const a = resultsA.find(r => r.scenario.includes(scenario) && r.scenario.includes('no-plugin'))
  const b = resultsB.find(r => r.scenario.includes(scenario) && r.scenario.includes('with-plugin'))

  const aResult = a ? (a.success ? 'PASS' : 'FAIL') : 'N/A'
  const bResult = b ? (b.success ? 'PASS' : 'FAIL') : 'N/A'

  const aTime = a ? `${a.recoveryTimeMs}ms` : 'N/A'
  const bTime = b ? `${b.recoveryTimeMs}ms` : 'N/A'

  const delta = a && b ? `${a.success === b.success ? 'SAME' : (b.success && !a.success ? 'FIXED' : 'REGRESSED')}` : 'N/A'

  report.push(`${scenario.padEnd(40)} | ${aResult.padEnd(6)} ${aTime.padEnd(8)} | ${bResult.padEnd(6)} ${bTime.padEnd(8)} | ${delta}`)
}

report.push('')

const aFailCount = resultsA.filter(r => !r.success).length
const bSuccessCount = resultsB.filter(r => r.success).length

if (aFailCount > 0 && bSuccessCount > 0) {
  report.push(`CONCLUSION: Plugin EFFECTIVELY fixes chunk loading failures.`)
  report.push(`  Without plugin: ${aFailCount}/${resultsA.length} scenarios FAILED`)
  report.push(`  With plugin: ${bSuccessCount}/${resultsB.length} scenarios PASSED`)
} else if (aFailCount === 0 && bSuccessCount > 0) {
  report.push(`WARNING: Without plugin, all scenarios passed. Test may not be triggering failures correctly.`)
} else {
  report.push(`INCONCLUSIVE: Could not demonstrate a clear difference.`)
}

const reportText = report.join('\n')
writeFileSync(REPORT_FILE, reportText)
console.log('\n' + reportText)
console.log(`\nReport saved to: ${REPORT_FILE}`)
