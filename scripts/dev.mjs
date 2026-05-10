import { spawn } from 'node:child_process'

const APP_PORT = 5858
const CHAOS_PORT = 5860

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

  let appProc, chaosProc

  if (mode === 'dev') {
    console.log(`  启动 VuePress dev server (port ${APP_PORT})...`)
    appProc = startProcess(
      'npx',
      ['vuepress', 'dev', 'docs', '--port', String(APP_PORT), '--no-open'],
      'dev',
      '36',
    )

    await new Promise((resolve) => {
      let resolved = false
      const check = (data) => {
        if (!resolved && data.toString().includes('dev server running')) {
          resolved = true
          appProc.stdout.removeListener('data', check)
          setTimeout(resolve, 1000)
        }
      }
      appProc.stdout.on('data', check)
      setTimeout(() => { if (!resolved) { resolved = true; resolve() } }, 60000)
    })

    console.log(`  启动 Chaos Proxy (port ${CHAOS_PORT} → ${APP_PORT})...`)
    chaosProc = startProcess(
      'node',
      ['scripts/chaos-proxy.mjs', '--target', `http://localhost:${APP_PORT}`, '--port', String(CHAOS_PORT)],
      'chaos',
      '33',
    )
  } else if (mode === 'dist') {
    console.log(`  启动静态文件服务器 (port ${APP_PORT})...`)
    appProc = startProcess(
      'node',
      ['scripts/static-server.mjs', String(APP_PORT)],
      'dist',
      '36',
    )

    await new Promise((r) => setTimeout(r, 1000))

    console.log(`  启动 Chaos Proxy (port ${CHAOS_PORT} → ${APP_PORT})...`)
    chaosProc = startProcess(
      'node',
      ['scripts/chaos-proxy.mjs', '--target', `http://localhost:${APP_PORT}`, '--port', String(CHAOS_PORT)],
      'chaos',
      '33',
    )
  } else {
    console.error('  用法: node scripts/dev.mjs [dev|dist]')
    process.exit(1)
  }

  console.log('')
  console.log('  ✅ 服务已启动:')
  console.log(`     预览:  http://localhost:${CHAOS_PORT}/  (含 Chaos Panel)`)
  console.log(`     原始:  http://localhost:${APP_PORT}/  (无干扰)`)
  console.log('')

  const cleanup = () => {
    console.log('\n  正在停止服务...')
    if (appProc) appProc.kill('SIGTERM')
    if (chaosProc) chaosProc.kill('SIGTERM')
    setTimeout(() => process.exit(0), 1000)
  }

  process.on('SIGINT', cleanup)
  process.on('SIGTERM', cleanup)

  process.on('exit', () => {
    if (appProc) appProc.kill()
    if (chaosProc) chaosProc.kill()
  })
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
