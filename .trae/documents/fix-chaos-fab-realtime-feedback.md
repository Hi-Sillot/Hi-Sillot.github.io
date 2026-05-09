# 修复 Chaos FAB 实时反馈 + NProgress 进度条卡住问题

## 问题分析

用户反馈：测试 VuePress 加载进度条卡住时，看不到插件效果，也看不到 chaos 的变化。

### 根因 1：`broadcastState()` 未在请求处理后调用

`chaos-proxy.mjs` 中的 `broadcastState()` 只在两个地方被调用：
- 客户端发送 config 变更消息时（L401）
- 客户端发送 reset-stats 消息时（L405）

**关键缺失**：当服务器拦截/失败请求后（`stats.failed++`、`stats.truncated++` 等），**没有调用 `broadcastState()`**。所以 FAB 上的失败计数、截断计数等不会实时更新，用户看不到任何变化。

### 根因 2：NProgress 进度条卡住时遮盖了插件反馈

VuePress 使用 `@vuepress/plugin-nprogress` 显示顶部进度条：
- `router.beforeEach` → `NProgress.start()` 开始进度条
- `router.afterEach` → `NProgress.done()` 完成进度条

当 chunk 加载失败时，`afterEach` 不会被调用（导航失败），进度条永远卡在中间。此时：
1. 进度条占据了用户注意力，但没有任何恢复提示
2. chunk retry 插件的 toast 消息在右上角，可能被进度条遮挡或不被注意
3. chaos FAB 没有实时更新，用户无法感知网络干扰正在发生

### 根因 3：FAB 缺少"正在干扰中"的实时指示

当前 FAB 只显示预设名称（如"轻度"），但不会在请求被实际拦截时给出即时反馈。用户无法区分"chaos 已开启但当前没有请求被拦截"和"chaos 正在拦截请求"。

## 用户决策

- **NProgress 进度条处理**：进度条变红+减速（而非直接完成/移除），表示加载异常
- **广播频率**：200ms 节流

## 修改计划

### 文件 1：`/workspace/scripts/chaos-proxy.mjs`

#### 1.1 添加 `scheduleBroadcast()` 节流广播

在服务器端，添加节流广播函数，在每个 `stats.xxx++` 后调用：

```js
let broadcastTimer = null
function scheduleBroadcast() {
  if (broadcastTimer) return
  broadcastTimer = setTimeout(() => {
    broadcastState()
    broadcastTimer = null
  }, 200)
}
```

需要修改的位置（所有 `stats.xxx++` 后面添加 `scheduleBroadcast()`）：
- L230 `stats.polluted++` → DNS 污染后
- L254 `stats.failed++` → 503 失败后
- L261 `stats.failed++` → 连接重置后
- L293 `stats.truncated++` → 截断后
- L317 `stats.delayed++` → 延迟后
- L328 `stats.truncated++` → 延迟+截断后
- L347 `stats.throttled++` → 限速后

#### 1.2 FAB 添加"干扰中"闪烁指示

在客户端 `updUI` 函数中，当收到 stats 更新且 `s.failed` 增加时，给 FAB 添加"干扰闪烁"效果。

在 `updUI` 函数中添加：
```js
var prevFailed = 0;
// 在 updUI 内部：
if (s && s.failed > prevFailed) {
  fab.classList.add('interfered');
  setTimeout(function() { fab.classList.remove('interfered'); }, 600);
  fab.classList.add('interfering');
  clearTimeout(fab._interfereTimer);
  fab._interfereTimer = setTimeout(function() { fab.classList.remove('interfering'); }, 3000);
}
if (s) prevFailed = s.failed;
```

#### 1.3 FAB 显示实时干扰状态图标

在 FAB HTML 中添加 ⚡ 干扰指示器：
```html
<span class="fab-interfere" id="fabInterfere">⚡</span>
```

添加 CSS：
```css
#chaos-fab .fab-interfere{display:none;font-size:13px}
#chaos-fab.interfering .fab-interfere{display:inline;animation:chaos-zap .4s ease infinite}
@keyframes chaos-zap{0%,100%{opacity:1}50%{opacity:.3}}
#chaos-fab.interfered{animation:chaos-interfered .6s ease}
@keyframes chaos-interfered{0%{filter:brightness(1)}20%{filter:brightness(2);transform:scale(1.08)}40%{filter:brightness(1.2)}60%{filter:brightness(1.8);transform:scale(1.04)}80%{filter:brightness(1.3)}100%{filter:brightness(1);transform:scale(1)}}
```

### 文件 2：`/workspace/docs/.vuepress/plugins/vuepress-plugin-sillot-chunk-retry/src/core/ChunkRetryManager.ts`

#### 2.1 集成 NProgress — 进度条变红+减速

当 chunk 加载失败被检测到时，将 NProgress 进度条变为红色并减速，表示加载异常。

实现方式：
```ts
private signalNProgressError(): void {
  const nprogress = document.getElementById('nprogress')
  if (!nprogress) return
  const bar = nprogress.querySelector('[role="bar"]') as HTMLElement | null
  if (!bar) return
  bar.style.background = '#f85149'
  bar.style.transition = 'all 2s ease'
  document.documentElement.style.setProperty('--nprogress-color', '#f85149')
}

private restoreNProgress(): void {
  document.documentElement.style.removeProperty('--nprogress-color')
  const nprogress = document.getElementById('nprogress')
  if (!nprogress) return
  const bar = nprogress.querySelector('[role="bar"]') as HTMLElement | null
  if (!bar) return
  bar.style.background = ''
  bar.style.transition = ''
}
```

调用位置：
- `handleChunkFailure` 方法开头调用 `this.signalNProgressError()`
- 恢复成功后（`router.replace` 成功的 then 回调中）调用 `this.restoreNProgress()`
- `fallbackNavigation` 中调用 `this.restoreNProgress()`

#### 2.2 恢复成功后 NProgress 自动处理

当恢复成功并执行 `router.replace()` 时，NProgress 会自动通过 `beforeEach` 重新开始。`afterEach` 会调用 `NProgress.done()` 完成进度条。此时 `restoreNProgress()` 将颜色恢复为正常。

### 文件 3：`/workspace/tests/unit/chunk-retry-manager.test.ts`

#### 3.1 添加 NProgress 集成测试

- 测试 `signalNProgressError` 方法在 chunk 失败时被调用
- 测试 `restoreNProgress` 方法在恢复成功后被调用
- 测试 NProgress bar 的颜色和过渡样式变化

## 修改文件清单

| 文件 | 修改类型 | 说明 |
|------|---------|------|
| `scripts/chaos-proxy.mjs` | 修改 | 添加 `scheduleBroadcast` 200ms 节流广播；FAB 添加干扰闪烁动画和 ⚡ 实时指示器 |
| `docs/.vuepress/plugins/.../ChunkRetryManager.ts` | 修改 | 添加 `signalNProgressError`/`restoreNProgress` 方法；进度条变红+减速 |
| `tests/unit/chunk-retry-manager.test.ts` | 修改 | 添加 NProgress 集成测试 |

## 验证步骤

1. 启动 chaos proxy（5859 端口），选择"轻度"预设
2. 导航到博客页面，观察：
   - FAB 应在请求被拦截时立即闪烁（`interfered` 动画）
   - FAB 失败计数应实时更新（200ms 内）
   - FAB 应显示 ⚡ 干扰指示器（持续 3 秒）
3. 观察 NProgress 进度条：
   - chunk 加载失败时，进度条应变红并减速
   - chunk retry 插件的 toast 应清晰可见
4. 恢复成功后：
   - 进度条颜色恢复正常
   - 页面正常显示
