# Tasks

- [ ] Task 1: 在 client.ts 中添加 vite:preloadError 事件监听器
  - [ ] SubTask 1.1: 在 `enhance` 函数中添加 `window.addEventListener('vite:preloadError', ...)` 监听器
  - [ ] SubTask 1.2: 在事件回调中调用 `event.preventDefault()` 阻止默认错误抛出，然后调用 `window.location.reload()` 刷新页面
  - [ ] SubTask 1.3: 添加防抖逻辑，避免短时间内多次刷新（例如 5 秒内只刷新一次）

- [ ] Task 2: 在 client.ts 中添加 Vue Router onError 处理
  - [ ] SubTask 2.1: 在 `enhance` 函数中添加 `router.onError()` 处理动态导入失败
  - [ ] SubTask 2.2: 判断错误类型是否为动态导入失败（检查 error.message 包含 "Failed to fetch dynamically imported module" 或 "Importing a module script failed"）
  - [ ] SubTask 2.3: 匹配到动态导入错误时，使用 `window.location.href = to.fullPath` 进行完整页面加载

- [ ] Task 3: 在 config.ts 中配置 chunkFileNames 避免浏览器扩展拦截
  - [ ] SubTask 3.1: 在 `viteBundler` 的 `viteOptions.build.rollupOptions.output` 中配置 `chunkFileNames`，使用不含广告/追踪关键词的命名模式

# Task Dependencies
- Task 2 独立于 Task 1，两者可并行实现
- Task 3 独立于 Task 1 和 Task 2
