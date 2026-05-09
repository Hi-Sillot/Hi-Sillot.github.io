# 修复 Chunk Retry 插件在生产环境下的问题

## 问题总结

用户反馈：轻度 chaos 模式下站点完全无法使用。经过深入排查，发现多个根本性问题。

## 当前状态分析

### 核心发现：VuePress 路由架构

VuePress 2 (vuepress-next) 使用**单一通配符路由**架构：

```javascript
// 生产构建中的路由定义
routes: [{ name: 'vuepress-route', path: '/:catchAll(.*)', components: {} }]
```

所有页面共享这一个路由，页面组件通过 `beforeResolve` 守卫中的 `loader()` 动态加载，结果存储在 `route.meta._pageChunk` 中。

### 问题1：`removeRoute` + `addRoute` 方案完全错误（致命）

当前 `updateRouteAndRetry()` 的逻辑：
1. `router.removeRoute(targetName)` — 删除路由
2. `router.addRoute(newRoute)` — 添加新路由

**问题**：VuePress 只有一个路由 `vuepress-route`，`removeRoute('vuepress-route')` 会删除整个路由，导致**所有页面都无法访问**。即使 `addRoute` 重新添加，也会破坏 VuePress 的 `beforeResolve` 逻辑和 `route.meta._pageChunk` 机制。

这是**轻度模式下完全无法使用的根本原因**。

### 问题2：`vite:preloadError` 的 `preventDefault()` 可能阻止 VuePress 自身恢复

Vite 的 preload helper 代码：
```javascript
function s(e) {
  let t = new Event('vite:preloadError', { cancelable: true });
  t.payload = e;
  window.dispatchEvent(t);
  if (!t.defaultPrevented) throw e;  // 如果没被 preventDefault，重新抛出错误
}
```

调用 `preventDefault()` 后，错误不会 re-throw，但 VuePress 的 `beforeResolve` 中的 `loader()` 已经失败了，`route.meta._pageChunk` 不会被设置，页面会显示空白。

### 问题3：`router.onError` 在 VuePress 中永远不会被调用

Vue Router 5.x 中，`onError` 只在导航守卫（`beforeEach`/`beforeResolve`/`afterEach`）抛出错误时触发。VuePress 的 `beforeResolve` 中 `await loader()` 失败后，错误被 Vite preload helper 的 `.catch(s)` 捕获，不会传播到 `router.onError`。

### 问题4：`beforeEach` 清理 `recoveredModules` 时机错误

将 `recoveredModules.clear()` 从 `afterEach` 移到 `beforeEach` 后，当 `vite:preloadError` 触发时，`beforeEach` 已经执行并清空了恢复状态，导致无法利用已恢复的模块。

### 问题5：Hydration mismatch（已修复但需验证）

Toast 容器在 `enhance()` 阶段注入 DOM 导致 Hydration mismatch。已改为 `onMounted` 延迟注入。

## 修复方案

### 核心策略变更

**放弃 `removeRoute`/`addRoute` 方案**，改为直接修补 VuePress 的 `route.meta._pageChunk`。

VuePress 的页面渲染依赖 `route.meta._pageChunk`，我们只需要：
1. 用 cache-bust URL 重新 import 失败的模块
2. 将结果写入 `route.meta._pageChunk`
3. 触发 Vue 重新渲染（通过 `router.replace()` 或强制响应式更新）

### 具体修改

#### 1. ChunkRetryManager.ts — 重写恢复逻辑

**删除**：`updateRouteAndRetry()` 方法（removeRoute + addRoute 方案）
**删除**：`router.onError` 注册（在 VuePress 中无效）
**删除**：`beforeEach` 中的 `recoveredModules.clear()`

**新增**：`updatePageChunk()` 方法
```typescript
private async updatePageChunk(to: RouteLocationNormalized, module: any): Promise<void> {
  // 直接修补 route.meta._pageChunk
  const route = this.router.currentRoute.value as RouteLocationNormalized
  if (route.meta) {
    route.meta._pageChunk = module
  }
  // 通过 router.replace 触发 Vue 重新渲染
  try {
    await this.router.replace(to.fullPath)
  } catch {
    this.fallbackNavigation(to)
  }
}
```

**修改**：`handleChunkFailure()` — 不再检查 `recoveredUrls`，因为 `beforeEach` 不再清理
**修改**：`afterEach` — 恢复清理 `recoveredModules`/`recoveredUrls`（在导航完成后清理）
**修改**：`vite:preloadError` handler — 移除 `preventDefault()`，改为让错误自然传播，但先保存恢复状态

**关键**：`vite:preloadError` 的处理流程：
1. 收到 `vite:preloadError` 事件
2. **不调用** `preventDefault()` — 让 Vite re-throw 错误
3. 但在 re-throw 之前，启动异步恢复流程
4. 恢复成功后，修补 `route.meta._pageChunk` 并 `router.replace()`
5. 如果恢复失败，`fallbackNavigation()` 执行整页刷新

等等，这有问题。如果 `preventDefault()` 不调用，错误会被 re-throw，导致 unhandled rejection。

**重新思考**：

实际上 `vite:preloadError` 的 `s()` 函数流程是：
```javascript
o.then(e => {
  for (let t of e || [])
    t.status === 'rejected' && s(t.reason);  // preload deps 失败
  return r().catch(s);  // r() 是原始 import()，失败也调用 s()
})
```

`s()` dispatches `vite:preloadError`，如果没被 preventDefault 就 throw。这个 throw 发生在 `K()` (即 `__vitePreload`) 返回的 Promise 的链中。

VuePress 的 `beforeResolve` 中：
```javascript
e.beforeResolve(async (to, from) => {
  if (to.path !== from.path || from === START) {
    let t = resolveRouteData(to.fullPath);
    let n = await t.loader();  // 这里调用 K() => import()
    to.meta = { ...t.meta, _pageChunk: n };
  }
})
```

当 `t.loader()` 中的 `K()` 失败时：
- 如果 `preventDefault()` 被调用：`K()` 返回一个 rejected promise（因为 `s()` 不 throw），`await t.loader()` 会抛出错误
- 如果 `preventDefault()` 没被调用：`s()` throw，同样 `K()` 返回 rejected promise

无论哪种方式，`beforeResolve` 中的 `await` 都会抛出错误。Vue Router 会将这个错误传播给 `router.onError` 的处理器... 等等，让我再确认。

实际上 Vue Router 5.x 的行为是：
- `beforeResolve` 中抛出的错误 → 触发 `router.onError`
- 但之前测试发现 `router.onError` 不被调用...

让我重新分析。在 VuePress 的 `beforeResolve` 中，`await t.loader()` 失败后，错误会传播到 Vue Router 的导航系统中。Vue Router 5.x 应该会调用 `onError` 回调。

但之前的测试表明 `onError` 不被调用。这可能是因为 Vite preload helper 的 `.catch(s)` 已经捕获了错误，`s()` 中的 throw 是在 Promise 链中，不是在 `beforeResolve` 的同步代码中。

让我重新理解 `K()` 的行为：
```javascript
K(()=>import('./page.js'), [dep1, dep2])
```
展开后：
```javascript
__vitePreload(
  () => import('./page.js'),  // r: 原始 import 函数
  [dep1, dep2]                // i: deps 列表
)
```

`K()` 返回一个 Promise。当 `import('./page.js')` 失败时：
1. `r()` 返回 rejected promise
2. `.catch(s)` 捕获，调用 `s(error)`
3. `s()` dispatches `vite:preloadError`
4. 如果没被 preventDefault，`s()` throw error
5. `.catch(s)` 的返回值是 rejected promise
6. `K()` 返回这个 rejected promise

所以 `await t.loader()` 确实会抛出错误。但 `beforeResolve` 是 async 函数，它返回 rejected promise。Vue Router 会处理这个 rejected promise。

Vue Router 5.x 的 `beforeResolve` 错误处理：
- 如果 `beforeResolve` guard 返回 rejected promise 或 false，导航被中止
- 错误会通过 `router.onError` 通知

所以 `router.onError` **应该**被调用！但之前的测试表明它不被调用...

可能的原因：VuePress 的 `beforeResolve` 实现可能有 try-catch 包裹，或者 Vue Router 5.0.6 有不同的行为。

**无论如何，核心修复策略不变**：放弃 `removeRoute`/`addRoute`，改为修补 `route.meta._pageChunk`。

### 修改文件清单

#### `/workspace/docs/.vuepress/plugins/vuepress-plugin-sillot-chunk-retry/src/core/ChunkRetryManager.ts`

1. **删除** `updateRouteAndRetry()` 方法
2. **新增** `updatePageChunk()` 方法 — 直接修改 `route.meta._pageChunk`
3. **修改** `recoverWithCacheBusting()` — 成功后调用 `updatePageChunk()` 而非 `updateRouteAndRetry()`
4. **修改** `init()`：
   - 保留 `beforeEach`（仅存储 `pendingTarget`，不清理 `recoveredModules`）
   - 修改 `afterEach`：恢复清理 `recoveredModules`/`recoveredUrls`
   - 保留 `router.onError` 注册（可能对某些场景有效）
   - 修改 `vite:preloadError` handler：**不调用** `preventDefault()`，改为在恢复成功后通过 `router.replace` 重新导航
5. **修改** `handleChunkFailure()` — 当 URL 已恢复时，直接修补 `_pageChunk` 并 `router.replace()`
6. **修改** `types.ts` — `RouterLike` 接口可能需要调整

#### `/workspace/docs/.vuepress/plugins/vuepress-plugin-sillot-chunk-retry/src/core/types.ts`

- `RouteLocationNormalized` 的 `meta` 类型需要支持 `_pageChunk`

#### `/workspace/docs/.vuepress/plugins/vuepress-plugin-sillot-chunk-retry/client.ts`

- 保持当前结构（`enhance` + `setup`/`onMounted`），无需修改

#### `/workspace/tests/unit/chunk-retry-manager.test.ts`

- 更新测试以匹配新的恢复逻辑
- 删除 `updateRouteAndRetry` 相关测试
- 新增 `updatePageChunk` 相关测试

#### `/workspace/scripts/chaos-proxy.mjs`

- 无需修改（预设持久化已修复）

### 恢复流程（修改后）

1. 用户点击链接 → Vue Router 导航
2. `beforeEach` 存储 `pendingTarget`
3. `beforeResolve` 中 `loader()` 调用 `K(()=>import(url), deps)`
4. Chaos proxy 拦截请求返回 503
5. `K()` 内部 `import()` 失败 → `.catch(s)` → `s()` dispatches `vite:preloadError`
6. 我们的 handler 收到事件，**不调用 preventDefault**
7. `s()` re-throw 错误 → `K()` 返回 rejected promise
8. `await t.loader()` 抛出错误 → `beforeResolve` 返回 rejected promise
9. Vue Router 中止导航，可能触发 `router.onError`
10. 我们的 `handleChunkFailure` 启动恢复：
    a. `show('detect', ...)` — 显示检测 toast
    b. `retryImportWithCacheBusting(failedUrl)` — 用 `?t=timestamp` 重新 import
    c. 成功后：`recoveredUrls.add(failedUrl)` + `recoveredModules.set(failedUrl, module)`
    d. `updatePageChunk(to, module)` — 修补 `route.meta._pageChunk = module`
    e. `router.replace(to.fullPath)` — 重新导航到目标页面
11. 第二次导航时，`beforeResolve` 再次调用 `loader()`
12. 这次 `loader()` 中的 `import()` 可能再次失败（如果 chaos 仍在拦截）
13. 但 `vite:preloadError` handler 检测到 `recoveredUrls.has(failedUrl)`，直接修补 `_pageChunk`

**等等，这有问题**。第二次 `router.replace(to.fullPath)` 会再次触发 `beforeResolve`，再次调用 `loader()`。如果 chaos 仍在拦截，`loader()` 又会失败。

**更好的方案**：不依赖 `router.replace` 重新导航，而是直接修补当前路由的 `_pageChunk`，然后强制 Vue 重新渲染。

但 VuePress 的页面组件是通过 `L(()=>i.value.default)` 读取 `_pageChunk.default` 的，如果 `_pageChunk` 是响应式的，修改它就会自动触发重新渲染。

让我检查 VuePress 的实现：
```javascript
let i = se((e, n) => ({
  get() { return e(), t.currentRoute.value.meta._pageChunk },
  set(e) { t.currentRoute.value.meta._pageChunk = e; n() }
}))
```

`se` 是 Vue 的 `customRef`！所以 `_pageChunk` 是响应式的。直接修改 `route.meta._pageChunk` 就会触发 Vue 重新渲染！

**最终方案**：

恢复成功后：
1. `recoveredModules.set(failedUrl, module)`
2. 直接设置 `router.currentRoute.value.meta._pageChunk = module`
3. 不需要 `router.replace()`，Vue 会自动重新渲染

但如果当前路由不是目标路由（导航被中止了），还需要 `router.replace()` 来恢复到目标路由。

**完整流程**：

1. 导航失败后，`router.currentRoute.value` 仍然是源路由（因为导航被中止）
2. 我们需要：a) 修补目标路由的 meta，b) 重新导航到目标路由
3. 但 `router.replace(to.fullPath)` 会再次触发 `beforeResolve`，再次调用 `loader()`
4. `loader()` 再次失败...

**解决方案**：在 `beforeResolve` 中拦截，如果 `recoveredModules` 中已有该路由的模块，直接使用它。

但 `beforeResolve` 是 VuePress 注册的，我们无法修改它的行为...

**更好的解决方案**：在 `vite:preloadError` 中调用 `preventDefault()`，阻止错误 re-throw。然后：
1. `K()` 返回的 promise 仍然会 reject（因为 `s()` 中 throw 后被 `.catch(s)` 捕获，但 `.catch()` 返回的仍然是 rejected promise）

等等，让我重新分析 `s()` 的行为：

```javascript
function s(e) {
  let t = new Event('vite:preloadError', { cancelable: true });
  t.payload = e;
  window.dispatchEvent(t);
  if (!t.defaultPrevented) throw e;
}
```

如果 `preventDefault()` 被调用：
- `s()` 不 throw，正常返回 `undefined`
- `.catch(s)` 返回 resolved promise（值为 `undefined`）
- 但 `K()` 的返回值就变成了 `undefined` 而不是模块对象

如果 `preventDefault()` 没被调用：
- `s()` throw error
- `.catch(s)` 返回 rejected promise
- `K()` 返回 rejected promise

**关键**：无论哪种方式，`K()` 都不会返回正确的模块对象。`beforeResolve` 中的 `await t.loader()` 要么得到 `undefined`，要么抛出错误。

**最终最终方案**：

1. `vite:preloadError` 中调用 `preventDefault()` — 阻止 unhandled rejection
2. 启动异步恢复流程
3. 恢复成功后，将模块存入 `recoveredModules`
4. 调用 `router.replace(to.fullPath)` 重新导航
5. 在 `beforeEach` 中，检查是否有已恢复的模块
6. 如果有，在 `beforeResolve` 之前修补路由 meta... 但我们无法修改 VuePress 的 `beforeResolve`

**真正的解决方案**：注册我们自己的 `beforeResolve` 守卫，在 VuePress 的守卫之前执行，如果检测到已恢复的模块，直接设置 `to.meta._pageChunk` 并跳过 VuePress 的 loader。

但 Vue Router 的 `beforeResolve` 守卫是按注册顺序执行的，如果我们的守卫在 VuePress 之前注册，我们可以：
1. 检查 `recoveredModules` 中是否有目标路由对应的模块
2. 如果有，设置 `to.meta._pageChunk = module`，然后 `return true`（但这不会阻止后续守卫执行）

问题是 VuePress的 `beforeResolve` 仍然会执行并调用 `loader()`...

**换一个思路**：不用 `beforeResolve`，而是直接在恢复成功后：
1. 设置 `router.currentRoute.value.meta._pageChunk = module`（如果当前路由已经是目标路由）
2. 或者使用 `router.replace()` + 在 `vite:preloadError` handler 中检测已恢复的 URL，直接返回已恢复的模块

等等！`vite:preloadError` handler 中，如果我们已经恢复了该 URL，可以：
1. 调用 `preventDefault()`
2. 但 `K()` 仍然会返回 rejected/undefined...

**根本问题**：我们无法从外部修改 `K()` 的返回值。`K()` 是 Vite preload helper，它的返回值决定了 `loader()` 的结果。

**最终方案（真正可行）**：

使用 **路由拦截 + 模块缓存** 的方式：

1. 在 `vite:preloadError` 中调用 `preventDefault()`
2. 异步恢复模块
3. 恢复成功后，将模块存入全局缓存（`window.__chunkRetryCache`）
4. 调用 `router.replace(to.fullPath)` 重新导航
5. **关键**：在 `enhance()` 阶段，monkey-patch `router.resolve` 或注册一个 `beforeResolve` 守卫
6. 在 `beforeResolve` 中，如果目标路由有缓存的模块，直接设置 `to.meta._pageChunk` 并返回
7. 但 VuePress 的 `beforeResolve` 仍然会执行...

**最终最终最终方案**：

直接修补 `window` 上的 `import` 函数？不，这太 hacky 了。

**最简单可行的方案**：

1. `vite:preloadError` 中调用 `preventDefault()` — 阻止 unhandled rejection
2. 启动异步恢复
3. 恢复成功后，直接修改 `router.currentRoute.value.meta._pageChunk = module`
4. 由于 `_pageChunk` 是 `customRef`，修改它会触发 Vue 重新渲染
5. 不需要 `router.replace()`，因为当前路由可能已经是目标路由（取决于 Vue Router 如何处理失败的导航）

**问题**：导航失败后，`router.currentRoute.value` 是源路由还是目标路由？

在 Vue Router 5.x 中，如果 `beforeResolve` 抛出错误，导航被中止，`currentRoute` 保持为源路由。所以 `router.currentRoute.value` 仍然是源路由，不是目标路由。

**解决方案**：恢复成功后，先 `router.push(to.fullPath)` 重新导航。这次导航会再次触发 `beforeResolve`，再次调用 `loader()`。但如果 chaos 仍在拦截，`loader()` 又会失败。

**但**：我们的 `retryImportWithCacheBusting` 使用了 `?t=timestamp`，chaos proxy 对带 `?t` 的请求是放行的。所以如果第一次恢复成功（cache-bust 请求通过），模块已经加载到内存中。第二次 `router.push` 时，`loader()` 中的 `import()` 请求的是原始 URL（不带 `?t`），chaos 可能仍然拦截它。

**最终方案**：

1. 恢复成功后，将模块存入 `recoveredModules`
2. `router.push(to.fullPath)` 重新导航
3. 在 `vite:preloadError` handler 中，如果 `recoveredModules` 中有该 URL 的模块：
   a. 调用 `preventDefault()`
   b. 但 `K()` 仍然返回 undefined/rejected...
   c. 这意味着 `beforeResolve` 中的 `await t.loader()` 得到 undefined
   d. `to.meta._pageChunk = undefined`，页面显示空白

**这行不通**。`preventDefault()` 只能阻止 re-throw，不能改变 `K()` 的返回值。

**真正的根本解决方案**：

我们需要在 `loader()` 层面拦截。VuePress 的 `loader()` 实际上是：
```javascript
K(async () => {
  let { default: e } = await import('./page.js');
  return { default: e };
}, __vite__mapDeps([0]))
```

如果 `import('./page.js')` 失败，`K()` 的 `.catch(s)` 捕获错误。`s()` dispatches `vite:preloadError`。

**方案A**：在 `vite:preloadError` handler 中，如果已有恢复的模块，我们无法改变 `K()` 的返回值，但可以：
- 不调用 `preventDefault()`，让错误传播
- 在 `router.onError` 中捕获错误
- 然后 `router.push(to.fullPath)` 重新导航
- 但 `loader()` 仍然会失败...

**方案B**：Monkey-patch `K()` 函数（即 `__vitePreload`），在它失败时返回已恢复的模块。

这是最可靠的方案：
```javascript
const originalPreload = window.__vitePreload;
if (originalPreload) {
  window.__vitePreload = function(preloadFn, deps) {
    return originalPreload.call(this, preloadFn, deps).catch(error => {
      const failedUrl = extractFailedUrl(error);
      if (failedUrl && recoveredModules.has(failedUrl)) {
        return recoveredModules.get(failedUrl);
      }
      throw error;
    });
  };
}
```

这样当 `loader()` 中的 `K()` 失败时，如果已有恢复的模块，直接返回它，`beforeResolve` 就能正常完成。

**但问题**：`__vitePreload` 是通过 ES module import 的，不是 `window` 上的全局变量。我们无法从外部 monkey-patch 它。

**方案C**：在 `enhance()` 阶段，通过 `router.beforeResolve` 守卫拦截，在 VuePress 的守卫之前执行。如果检测到已恢复的模块，直接设置 `to.meta._pageChunk` 并 `return true`。

但问题是 VuePress 的 `beforeResolve` 仍然会执行。除非我们能让它跳过...

实际上，Vue Router 的 `beforeResolve` 守卫是按注册顺序执行的。如果我们的守卫返回 `true`，后续守卫仍然会执行。如果我们的守卫返回 `false`，导航被中止。

**方案D**：在 `enhance()` 中注册 `beforeResolve`，如果检测到已恢复的模块，设置 `to.meta._pageChunk`，然后 VuePress 的 `beforeResolve` 检测到 `to.meta._pageChunk` 已经存在，可能会跳过 `loader()` 调用。

让我看 VuePress 的 `beforeResolve` 代码：
```javascript
e.beforeResolve(async (to, from) => {
  if (to.path !== from.path || from === START) {
    let t = resolveRouteData(to.fullPath);
    let n = await t.loader();
    to.meta = { ...t.meta, _pageChunk: n };
  } else {
    to.meta = from.meta;
  }
})
```

它没有检查 `to.meta._pageChunk` 是否已存在，总是调用 `loader()`。所以我们无法通过预设 `_pageChunk` 来跳过 `loader()`。

**方案E（最终方案）**：使用 `router.afterEach` + 响应式修补

1. `vite:preloadError` 中调用 `preventDefault()` — 阻止 unhandled rejection
2. 启动异步恢复
3. 恢复成功后，将模块存入 `recoveredModules`
4. 调用 `router.replace(to.fullPath)` 重新导航
5. 这次导航中，`beforeResolve` 再次调用 `loader()`
6. `loader()` 再次失败，再次触发 `vite:preloadError`
7. 我们的 handler 检测到 `recoveredModules.has(failedUrl)`
8. **关键**：此时我们不再启动新的恢复流程，而是：
   a. 调用 `preventDefault()`
   b. 但 `K()` 仍然返回 undefined...

**还是不行**。`preventDefault()` 不能改变 `K()` 的返回值。

**方案F（真正最终方案）**：放弃在 `vite:preloadError` 中 `preventDefault()`，改为全局 unhandledrejection 捕获 + 恢复后整页刷新

1. 不调用 `preventDefault()`，让错误自然传播
2. 注册 `window.addEventListener('unhandledrejection', ...)` 防止控制台报错
3. 恢复成功后，执行 `location.href = to.fullPath` 整页刷新
4. 刷新后，浏览器从服务器重新加载所有资源，此时 chaos 可能已经不再拦截

这是最简单可靠的方案，但用户体验不好（整页刷新）。

**方案G（平衡方案）**：`preventDefault()` + 恢复后修补 `_pageChunk` + `router.replace` + 在 `beforeEach` 中清除 `isRecovering` 标记

1. `vite:preloadError` 中调用 `preventDefault()` — 阻止 re-throw
2. `K()` 返回 undefined（因为 `.catch(s)` 返回 resolved promise with undefined）
3. `beforeResolve` 中 `await t.loader()` 得到 undefined
4. `to.meta = { ...t.meta, _pageChunk: undefined }` — 页面显示空白
5. 但导航成功完成（没有错误抛出），`afterEach` 被调用
6. `afterEach` 中 `dismissAll()` 清除 toast
7. 此时 `router.currentRoute.value` 是目标路由，但 `_pageChunk` 是 undefined
8. 异步恢复成功后，直接修改 `router.currentRoute.value.meta._pageChunk = module`
9. 由于 `_pageChunk` 是 customRef，修改触发 Vue 重新渲染
10. 页面正常显示！

**这个方案可行！** 关键点是：
- `preventDefault()` 让 `K()` 不 throw，返回 undefined
- `beforeResolve` 正常完成（虽然 `_pageChunk` 是 undefined）
- 导航成功，`currentRoute` 更新为目标路由
- 恢复成功后，修补 `_pageChunk`，Vue 自动重新渲染

但有一个问题：在恢复期间（几秒钟），页面会显示空白，因为 `_pageChunk` 是 undefined。

**优化**：在恢复期间显示一个加载状态。

### 最终方案总结

1. **`vite:preloadError` handler**：调用 `preventDefault()`，阻止 re-throw
2. **异步恢复**：用 cache-bust URL 重新 import
3. **恢复成功后**：直接修改 `router.currentRoute.value.meta._pageChunk = module`
4. **Vue 自动重新渲染**：因为 `_pageChunk` 是 customRef
5. **删除 `removeRoute`/`addRoute`**：不再需要
6. **删除 `router.onError`**：在 VuePress 中无效
7. **保留 `beforeEach`**：仅存储 `pendingTarget`
8. **`afterEach`**：清理恢复状态 + dismissAll
9. **Toast**：在 `onMounted` 后初始化（已修复 Hydration mismatch）

## 验证步骤

1. 运行单元测试：`npx vitest run tests/unit/`
2. 构建站点：`npm run docs:build`
3. 启动服务器：`node scripts/static-server.mjs` + `node scripts/chaos-proxy.mjs`
4. 在 5859 端口测试轻度模式：
   - 点击不同页面链接，验证页面能正常加载
   - 触发 chunk 失败后，验证 toast 显示和自动恢复
   - 恢复后验证页面内容正确显示
5. 验证 5858 端口（原始端口）没有 chaos panel
6. 验证预设模式选中态在刷新后恢复
