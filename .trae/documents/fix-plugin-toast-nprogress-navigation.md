# 插件 Toast 重构 + 移除 NProgress 集成 + 修复恢复跳转

## 问题总结

1. **Toast 干扰性太强**：弹出位置重叠、频率高、持续时间长、与 chaos FAB 功能重叠
2. **NProgress 进度条修改不成功且不合理**：移除这部分
3. **恢复没有跳转成功**：`router.replace()` 后留在当前页面，`patchRouteLoader` 找不到路由键

## 用户决策

- **Toast 替代**：顶部细线条（2px 彩色线条，蓝色=恢复中，绿色=成功，红色=失败）
- **恢复跳转**：先尝试 SPA（router.replace），1 秒后仍在当前页面则降级为 location.href

## 修改计划

### 文件 1：`/workspace/docs/.vuepress/plugins/vuepress-plugin-sillot-chunk-retry/src/core/ChunkRetryManager.ts`

#### 1.1 移除 ToastUI 类，替换为 StatusIndicator

**移除**：整个 ToastUI 类（L30-L241，约 210 行）

**替换为** StatusIndicator 类（约 70 行）：

```ts
class StatusIndicator {
  private bar: HTMLDivElement | null = null
  private timer: ReturnType<typeof setTimeout> | null = null
  private enabled: boolean

  constructor(enabled: boolean) {
    this.enabled = enabled
  }

  initUI(): void {
    if (!this.enabled || typeof document === 'undefined') return
    if (this.bar) return
    this.bar = document.createElement('div')
    this.bar.id = 'chunk-retry-status'
    this.injectStyles()
    document.body.appendChild(this.bar)
  }

  showRecovering(): void {
    if (!this.bar) { this.initUI() }
    if (!this.bar) return
    this.bar.className = 'chunk-retry-status recovering'
    if (this.timer) { clearTimeout(this.timer); this.timer = null }
  }

  showSuccess(): void {
    if (!this.bar) return
    this.bar.className = 'chunk-retry-status success'
    if (this.timer) clearTimeout(this.timer)
    this.timer = setTimeout(() => this.hide(), 1500)
  }

  showFail(): void {
    if (!this.bar) return
    this.bar.className = 'chunk-retry-status fail'
    if (this.timer) clearTimeout(this.timer)
    this.timer = setTimeout(() => this.hide(), 3000)
  }

  hide(): void {
    if (!this.bar) return
    this.bar.className = ''
    if (this.timer) { clearTimeout(this.timer); this.timer = null }
  }

  destroy(): void {
    if (this.timer) clearTimeout(this.timer)
    if (this.bar) { this.bar.remove(); this.bar = null }
    const style = document.getElementById('chunk-retry-status-styles')
    if (style) style.remove()
  }

  private injectStyles(): void {
    const style = document.createElement('style')
    style.id = 'chunk-retry-status-styles'
    style.textContent = `
#chunk-retry-status{position:fixed;top:0;left:0;height:2px;z-index:9999999;pointer-events:none;transition:opacity .5s ease}
#chunk-retry-status.recovering{background:#58a6ff;animation:chunk-retry-progress 3s ease-in-out infinite}
#chunk-retry-status.success{background:#3fb950;width:100%;animation:none}
#chunk-retry-status.fail{background:#f85149;width:100%;animation:none}
@keyframes chunk-retry-progress{0%{width:0}50%{width:70%}100%{width:95%}}
`
    document.head.appendChild(style)
  }
}
```

#### 1.2 更新 ChunkRetryManager 中的 toast 调用

将所有 `this.toast.show(type, msg, detail)` 替换为 StatusIndicator 调用：

| 原 toast 调用 | 新 StatusIndicator 调用 |
|---|---|
| `this.toast.show('detect', '资源加载失败', shortUrl)` | `this.status.showRecovering()` |
| `this.toast.show('retrying', '正在恢复 (n/m)', shortUrl)` | `this.status.showRecovering()` |
| `this.toast.show('success', '页面恢复成功', path)` | `this.status.showSuccess()` |
| `this.toast.show('fail', '恢复失败', shortUrl)` | `this.status.showFail()` |
| `this.toast.show('fallback', '回退到整页导航', path)` | `this.status.showFail()` |
| `this.toast.show('detect', '页面组件加载失败', shortUrl)` | `this.status.showRecovering()` |
| `this.toast.show('retrying', '正在恢复页面组件...', shortUrl)` | `this.status.showRecovering()` |
| `this.toast.show('success', '页面组件恢复成功', shortUrl)` | `this.status.showSuccess()` |
| `this.toast.show('fail', '页面组件恢复失败', shortUrl)` | `this.status.showFail()` |
| `this.toast.dismissAll()` | `this.status.hide()` |

#### 1.3 移除 NProgress 集成

- 移除 `signalNProgressError()` 方法
- 移除 `restoreNProgress()` 方法
- 移除所有调用这两个方法的地方（`handleChunkFailure`、`recoverWithCacheBusting`、`recoverSecondaryChunk`、`fallbackNavigation`）
- 移除 CSS 中的 `#nprogress.chunk-error .bar` 规则

#### 1.4 修复恢复跳转 — 先 SPA 后降级

在 `recoverWithCacheBusting` 和 `handleChunkFailure` 中，`router.replace` 成功后，添加超时检查：

```ts
private async navigateWithFallback(to: RouteLocationNormalized): Promise<void> {
  this.isApplyingModule = true
  try {
    await this.router.replace(to.fullPath)
    this.isApplyingModule = false

    // 检查是否成功导航到目标页面
    await new Promise(resolve => setTimeout(resolve, 1000))
    const currentPath = this.router.currentRoute.value?.path
    if (currentPath !== to.path) {
      // SPA 导航失败，降级为整页刷新
      this.isRecovering = false
      sessionStorage.removeItem(this.options.retryKey)
      location.href = to.fullPath
      return
    }

    this.status.showSuccess()
  } catch {
    this.isApplyingModule = false
    this.status.showFail()
    this.isRecovering = false
    sessionStorage.removeItem(this.options.retryKey)
    location.href = to.fullPath
  }
}
```

#### 1.5 增强 patchRouteLoader 诊断

在 `patchRouteLoader` 中，如果找不到路由键，记录可用的路由键列表到控制台（仅首次）：

```ts
private patchRouteLoader(path: string, module: any): { routeKey: string; originalLoader: () => Promise<any> } | null {
  if (!this.routes) return null
  const routesObj = this.routes.value || this.routes

  let routeKey: string | null = null

  // 1. 使用 resolveRoutePathFn
  if (this.resolveRoutePathFn) {
    try {
      const resolved = this.resolveRoutePathFn(path)
      if (routesObj[resolved] && typeof routesObj[resolved].loader === 'function') {
        routeKey = resolved
      }
    } catch {}
  }

  // 2. 候选匹配
  if (!routeKey) {
    const candidates = [path, path.replace(/\/$/, ''), path + '/', path.replace(/\.html$/, ''), path + '.html']
    for (const key of candidates) {
      if (routesObj[key] && typeof routesObj[key].loader === 'function') {
        routeKey = key
        break
      }
    }
  }

  // 3. 遍历所有路由，找 loader
  if (!routeKey) {
    for (const [key, route] of Object.entries(routesObj)) {
      if (typeof route?.loader === 'function') {
        if (key === path || path.startsWith(key) || key.startsWith(path)) {
          routeKey = key
          break
        }
      }
    }
  }

  // 4. 仍未找到，尝试匹配任何有 loader 的路由（使用路径最相似的）
  if (!routeKey) {
    let bestMatch: string | null = null
    let bestScore = -1
    for (const [key, route] of Object.entries(routesObj)) {
      if (typeof route?.loader !== 'function') continue
      // 计算路径相似度
      const score = this.pathSimilarity(path, key)
      if (score > bestScore) {
        bestScore = score
        bestMatch = key
      }
    }
    if (bestMatch && bestScore > 0) {
      routeKey = bestMatch
    }
  }

  if (!routeKey) return null

  const route = routesObj[routeKey]
  const originalLoader = route.loader
  route.loader = () => Promise.resolve(module)
  return { routeKey, originalLoader }
}

private pathSimilarity(a: string, b: string): number {
  // 简单的路径相似度计算
  const sa = a.replace(/\/$/, '').split('/')
  const sb = b.replace(/\/$/, '').split('/')
  let common = 0
  const minLen = Math.min(sa.length, sb.length)
  for (let i = 0; i < minLen; i++) {
    if (sa[i] === sb[i]) common++
    else break
  }
  return common / Math.max(sa.length, sb.length)
}
```

### 文件 2：`/workspace/tests/unit/chunk-retry-manager.test.ts`

- 移除所有 ToastUI 相关测试（ToastUI 聚合、关闭按钮等）
- 添加 StatusIndicator 测试：showRecovering、showSuccess、showFail、hide、destroy
- 移除 NProgress 集成测试
- 更新 afterEach 测试（不再检查 toast.dismissAll）
- 添加 navigateWithFallback 测试

## 修改文件清单

| 文件 | 修改类型 | 说明 |
|------|---------|------|
| `ChunkRetryManager.ts` | 重构 | ToastUI → StatusIndicator；移除 NProgress；修复恢复跳转 |
| `tests/unit/chunk-retry-manager.test.ts` | 修改 | 更新测试 |

## 验证步骤

1. 启动 chaos proxy，选择"弱网切换"场景
2. 导航到其他页面，观察：
   - 页面顶部应出现蓝色细线条（恢复中）
   - 恢复成功后线条变绿，1.5s 后消失
   - 恢复失败后线条变红，3s 后消失
3. 验证恢复跳转：
   - SPA 导航成功时，页面正常跳转到目标页面
   - SPA 导航失败时，1 秒后降级为整页刷新
4. 验证 NProgress：
   - 进度条不受插件影响，自然完成
