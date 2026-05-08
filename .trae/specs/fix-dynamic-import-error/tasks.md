# Tasks

- [ ] Task 1: 创建 useChunkErrorRecovery 组合函数
  - [ ] SubTask 1.1: 在 `docs/.vuepress/` 下创建 `composables/useChunkErrorRecovery.ts` 文件
  - [ ] SubTask 1.2: 实现 `router.beforeEach` 跟踪待导航目标 `pendingTarget`
  - [ ] SubTask 1.3: 实现 `router.afterEach` 清除 `pendingTarget` 和 sessionStorage 标记
  - [ ] SubTask 1.4: 实现 `vite:preloadError` 事件监听器，提取失败 URL 并尝试缓存破坏重导入
  - [ ] SubTask 1.5: 实现缓存破坏重导入逻辑：`import(url + '?t=' + Date.now())`，成功后调用 `event.preventDefault()`
  - [ ] SubTask 1.6: 实现 `router.onError` 处理器，检测动态导入失败错误类型
  - [ ] SubTask 1.7: 实现第一层恢复：缓存破坏重导入成功后，通过 `router.removeRoute` + `router.addRoute` 更新路由组件，然后 `router.push` 重试导航
  - [ ] SubTask 1.8: 实现第二层兜底：若第一层失败，执行 `location.href = pendingTarget.fullPath` 定向导航
  - [ ] SubTask 1.9: 实现 sessionStorage 防循环标记逻辑

- [ ] Task 2: 在 client.ts 中集成 useChunkErrorRecovery
  - [ ] SubTask 2.1: 在 `enhance` 函数中导入并调用 `useChunkErrorRecovery(router)`

# Task Dependencies
- Task 2 依赖 Task 1
