import { spawn } from 'node:child_process'
import http from 'node:http'

const DEV_PORT = 5860
const CHAOS_PORT = 5861

function startProcess(cmd, args, label, color) {
  const proc = spawn(cmd, args, {
    cwd: process.cwd(),
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  const prefix = `\x1b[${color}m[${label}]\x1b[0m `
  proc.stdout.on('data', (data) => {
    data.toString().trim().split('\n').forEach((line) => {
      if (line.trim()) process.stdout.write(prefix + line + '\n')
    })
  })
  proc.stderr.on('data', (data) => {
    data.toString().trim().split('\n').forEach((line) => {
      if (line.trim()) process.stderr.write(prefix + line + '\n')
    })
  })

  proc.on('exit', (code) => {
    process.stdout.write(prefix + `exited with code ${code}\n`)
  })

  return proc
}

async function main() {
  const mode = process.argv[2] || 'dev'

  console.log('')
  console.log('  🦢 汐洛文档开发环境')
  console.log(`  模式: ${mode}`)
  console.log('')

  let vuepressProc, chaosProc

  if (mode === 'dev') {
    console.log(`  启动 VuePress dev server (port ${DEV_PORT})...`)
    vuepressProc = startProcess(
      'npx',
      ['vuepress', 'dev', 'docs', '--port', String(DEV_PORT), '--no-open'],
      'dev',
      '36',
    )

    await new Promise((resolve) => {
      let resolved = false
      const check = (data) => {
        if (!resolved && data.toString().includes('dev server running')) {
          resolved = true
          vuepressProc.stdout.removeListener('data', check)
          setTimeout(resolve, 1000)
        }
      }
      vuepressProc.stdout.on('data', check)
      setTimeout(() => { if (!resolved) { resolved = true; resolve() } }, 60000)
    })

    console.log(`  启动 Chaos Proxy (port ${CHAOS_PORT} → ${DEV_PORT})...`)
    chaosProc = startProcess(
      'node',
      ['scripts/chaos-proxy.mjs', '--target', `http://localhost:${DEV_PORT}`, '--port', String(CHAOS_PORT)],
      'chaos',
      '33',
    )
  } else if (mode === 'dist') {
    console.log('  启动静态文件服务器...')
    vuepressProc = startProcess(
      'node',
      ['scripts/static-server.mjs', String(DEV_PORT)],
      'dist',
      '36',
    )

    await new Promise((r) => setTimeout(r, 1000))

    console.log(`  启动 Chaos Proxy (port ${CHAOS_PORT} → ${DEV_PORT})...`)
    chaosProc = startProcess(
      'node',
      ['scripts/chaos-proxy.mjs', '--target', `http://localhost:${DEV_PORT}`, '--port', String(CHAOS_PORT)],
      'chaos',
      '33',
    )
  } else {
    console.error('  用法: node scripts/dev.mjs [dev|dist]')
    process.exit(1)
  }

  console.log('')
  console.log('  ✅ 服务已启动:')
  console.log(`     站点:  http://localhost:${DEV_PORT}/`)
  console.log(`     Chaos: http://localhost:${CHAOS_PORT}/`)
  console.log('')

  const cleanup = () => {
    console.log('\n  正在停止服务...')
    if (vuepressProc) vuepressProc.kill('SIGTERM')
    if (chaosProc) chaosProc.kill('SIGTERM')
    setTimeout(() => process.exit(0), 1000)
  }

  process.on('SIGINT', cleanup)
  process.on('SIGTERM', cleanup)

  process.on('exit', () => {
    if (vuepressProc) vuepressProc.kill()
    if (chaosProc) chaosProc.kill()
  })
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
