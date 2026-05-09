# Chaos 代理机制重写 + NProgress 集成修复

## 问题总结

1. **NProgress 进度条无变化**：`signalNProgressError()` 设置的 inline style 被 NProgress 的 trickle 更新覆盖
2. **预设参数未持久化**：localStorage 只保存预设名称，页面刷新后服务端 config 重置为默认（disabled），客户端只恢复按钮高亮
3. **场景模拟脱离实际**：当前只有随机概率失败，缺少真实网络场景模拟
4. **缺少可视化设计目标**：用户无法清晰看到请求级详情和状态级概览

## 设计目标

### 场景模拟

| 场景 | 行为 | 参数 |
|------|------|------|
| 弱网切换 | 周期性正常↔断开，模拟地铁/电梯 | 正常5s → 断开3s，循环 |
| 版本更新 | 首次导航 chunk 必定失败，刷新后成功 | 失败1次后自动恢复 |
| CDN 局部故障 | 指定 URL pattern 的资源失败，其他正常 | pattern + 失败率 |
| 服务器过载 | 所有请求变慢 + 部分超时 | 高延迟 + 超时率 |

### 可视化

- **状态级概览**：FAB 药丸显示当前场景、网络状态（正常/干扰中/恢复中）、失败计数
- **请求级详情**：面板中显示最近的请求日志（URL、状态、耗时、干扰类型），可展开查看

## 修改计划

### 文件 1：`/workspace/scripts/chaos-proxy.mjs` — 重写

#### 1.1 服务端 config 结构扩展

```js
const config = {
  enabled: true,
  scenario: 'off',  // 'off' | 'flaky' | 'version-update' | 'cdn-partial' | 'overload' | 'custom'
  scenarioState: {}, // 场景内部状态（如 flaky 的当前阶段）
  volatility: { ... },  // 保留，custom 模式使用
  dns: { ... },         // 保留
  speed: { ... },       // 保留
}
```

#### 1.2 场景处理逻辑

在请求拦截处，根据 `config.scenario` 选择不同的处理策略：

```js
function handleRequest(req, res, reqUrl) {
  switch (config.scenario) {
    case 'flaky': return handleFlaky(req, res, reqUrl)
    case 'version-update': return handleVersionUpdate(req, res, reqUrl)
    case 'cdn-partial': return handleCdnPartial(req, res, reqUrl)
    case 'overload': return handleOverload(req, res, reqUrl)
    case 'custom': return handleCustom(req, res, reqUrl)  // 现有逻辑
    default: proxy.web(req, res)  // off
  }
}
```

**弱网切换（flaky）**：
- 使用时间周期判断当前阶段：正常期 vs 断开期
- 正常期：所有请求透传
- 断开期：匹配扩展名的请求返回 503
- 通过 `config.scenarioState` 跟踪当前阶段和切换时间

**版本更新（version-update）**：
- 维护一个 `failedUrls` Set
- 首次遇到的 chunk URL 必定失败（503），加入 Set
- 第二次遇到同一 URL（刷新后）正常通过
- 模拟部署新版本后旧 chunk 失效的真实场景

**CDN 局部故障（cdn-partial）**：
- 使用 URL pattern 匹配，匹配的请求按 failRate 失败
- 不匹配的请求正常通过
- 与现有 custom 模式类似，但更直观

**服务器过载（overload）**：
- 所有请求增加高延迟（1-3s）
- 部分请求超时失败（failRate）
- 响应可能被截断

#### 1.3 请求日志

服务端维护最近 50 条请求日志：

```js
const requestLog = []  // { url, method, status, duration, interference, timestamp }
const MAX_LOG = 50
```

每次请求完成后（无论成功/失败/干扰），添加到日志。通过 WebSocket 推送给客户端。

#### 1.4 客户端面板重写

**FAB 药丸**（保持现有设计，增加场景指示）：
- 🔥 + ⚡ + 场景名 + 连接状态 + 失败计数
- 不同场景对应不同颜色主题（已有）
- 干扰时闪烁（已有）

**面板**（重新设计）：

```
┌─ 🔥 Chaos Panel ──── [已连接 ●] ─┐
│                                     │
│  场景选择:                          │
│  [弱网切换] [版本更新] [CDN故障]    │
│  [服务器过载] [自定义] [关闭]       │
│                                     │
│  ┌─ 状态概览 ──────────────────┐   │
│  │  ● 正常  |  失败: 3  |  总: 12 │   │
│  └──────────────────────────────┘   │
│                                     │
│  ┌─ 请求日志 (最近) ───────────┐   │
│  │  ❌ /assets/app-xxx.js  503  │   │
│  │     120ms  失败(模拟)        │   │
│  │  ✅ /assets/style-xxx.css    │   │
│  │     45ms  正常               │   │
│  │  ⏳ /assets/page-xxx.js      │   │
│  │     1200ms  延迟(模拟)       │   │
│  └──────────────────────────────┘   │
│                                     │
│  ┌─ 高级设置 ▶ ────────────────┐   │
│  │  (现有 volatility/dns/speed) │   │
│  └──────────────────────────────┘   │
│                                     │
│  [🔄 重置统计]                      │
└─────────────────────────────────────┘
```

#### 1.5 预设持久化修复

在 `ws.onopen` 中，从 localStorage 读取预设名称，立即发送对应配置：

```js
ws.onopen = () => {
  // ...existing dot update...
  try {
    var sp = localStorage.getItem('__chaos_preset');
    if (sp && SCENARIOS[sp]) {
      ws.send(JSON.stringify({type: 'config', config: SCENARIOS[sp]}));
    }
  } catch(e) {}
};
```

移除页面底部的旧恢复代码（只恢复按钮高亮的代码）。

#### 1.6 NProgress 错误状态 CSS

在注入的 CSS 中添加：

```css
#nprogress.chunk-error .bar {
  background: #f85149 !important;
  transition: all 2s ease !important;
  height: 3px !important;
}
```

#### 1.7 客户端 NProgress 错误状态控制

在 `updUI` 中，当检测到新的失败请求时，给 `#nprogress` 添加 `chunk-error` class：

```js
if (s && s.failed > prevFailed) {
  var np = document.getElementById('nprogress');
  if (np) np.classList.add('chunk-error');
}
```

当场景切换为 off 或重置统计时，移除 `chunk-error` class。

### 文件 2：`/workspace/docs/.vuepress/plugins/vuepress-plugin-sillot-chunk-retry/src/core/ChunkRetryManager.ts`

#### 2.1 修复 signalNProgressError — 使用 CSS class

```ts
private signalNProgressError(): void {
  document.documentElement.style.setProperty('--nprogress-c', '#f85149')
  const nprogress = document.getElementById('nprogress')
  if (nprogress) nprogress.classList.add('chunk-error')
}

private restoreNProgress(): void {
  document.documentElement.style.removeProperty('--nprogress-c')
  const nprogress = document.getElementById('nprogress')
  if (nprogress) nprogress.classList.remove('chunk-error')
}
```

#### 2.2 在 ToastUI 的 injectStyles 中添加 NProgress 错误样式

```css
#nprogress.chunk-error .bar {
  background: #f85149 !important;
  transition: all 2s ease !important;
  height: 3px !important;
}
```

使用 `!important` 覆盖 NProgress 的 inline style。

### 文件 3：`/workspace/tests/unit/chunk-retry-manager.test.ts`

#### 3.1 更新 NProgress 测试

- `signalNProgressError` 测试：验证添加 `chunk-error` class（而非修改 inline style）
- `restoreNProgress` 测试：验证移除 `chunk-error` class

## 修改文件清单

| 文件 | 修改类型 | 说明 |
|------|---------|------|
| `scripts/chaos-proxy.mjs` | 重写 | 场景模拟、请求日志、面板重设计、持久化修复、NProgress CSS |
| `docs/.vuepress/plugins/.../ChunkRetryManager.ts` | 修改 | signalNProgressError/restoreNProgress 改用 CSS class；injectStyles 添加样式 |
| `tests/unit/chunk-retry-manager.test.ts` | 修改 | 更新 NProgress 测试 |

## 验证步骤

1. 启动 chaos proxy，选择"弱网切换"场景
2. 验证 FAB 显示场景名称和对应颜色
3. 导航到其他页面，观察：
   - 正常期：页面正常加载
   - 断开期：chunk 请求失败，NProgress 变红，toast 显示恢复提示
   - 恢复期：chunk retry 插件自动恢复，NProgress 恢复正常
4. 刷新页面，验证预设持久化：场景自动恢复
5. 查看面板中的请求日志：每个请求的状态、耗时、干扰类型
6. 切换到"版本更新"场景：首次导航 chunk 必定失败，刷新后成功
7. 切换到"CDN 局部故障"场景：只有匹配 pattern 的资源失败
8. 切换到"服务器过载"场景：所有请求变慢，部分超时
