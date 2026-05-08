# Tasks

- [x] Task 1: 创建 vuepress-plugin-sillot-chunk-retry 插件骨架
  - [x] SubTask 1.1: 创建 `docs/.vuepress/plugins/vuepress-plugin-sillot-chunk-retry/` 目录结构
  - [x] SubTask 1.2: 创建插件入口 `index.ts`，导出 VuePress Plugin 对象（name、clientConfigFile 等）
  - [x] SubTask 1.3: 创建客户端入口 `client.ts`，使用 `defineClientConfig` 在 `enhance` 中初始化 `ChunkRetryManager`

- [x] Task 2: 实现核心 ChunkRetryManager 类
  - [x] SubTask 2.1: 创建 `src/core/ChunkRetryManager.ts`，框架无关的恢复逻辑核心类
  - [x] SubTask 2.2: 实现 `init(router)` 方法：注册 `beforeEach`/`afterEach`/`onError` 钩子，注册 `vite:preloadError` 监听
  - [x] SubTask 2.3: 实现 `beforeEach` 跟踪 `pendingTarget`
  - [x] SubTask 2.4: 实现 `afterEach` 清除 `pendingTarget` 和 sessionStorage 标记
  - [x] SubTask 2.5: 实现 `vite:preloadError` 处理：提取失败 URL → 缓存破坏重导入 → `event.preventDefault()`
  - [x] SubTask 2.6: 实现 `router.onError` 处理：识别动态导入失败错误类型
  - [x] SubTask 2.7: 实现第一层恢复：缓存破坏重导入 → `router.removeRoute` + `router.addRoute` 更新组件 → `router.push` 重试
  - [x] SubTask 2.8: 实现第二层兜底：`location.href = pendingTarget.fullPath` 定向导航
  - [x] SubTask 2.9: 实现 sessionStorage 防循环标记逻辑
  - [x] SubTask 2.10: 为 ChunkRetryManager 编写单元测试（vitest），测试 URL 提取、错误识别、防循环等逻辑

- [x] Task 3: 集成插件到 VuePress 项目
  - [x] SubTask 3.1: 在 `config.plugins.ts` 中注册 `vuepress-plugin-sillot-chunk-retry` 插件
  - [x] SubTask 3.2: 从 `client.ts` 中移除手动初始化代码（改为插件自动初始化）

- [x] Task 4: 创建 Playwright 自动化测试
  - [x] SubTask 4.1: 安装 `@playwright/test` 依赖，创建 `playwright.config.ts`
  - [x] SubTask 4.2: 创建测试辅助工具：`tests/e2e/helpers/network-simulator.ts`，封装 Playwright 的 `page.route()` 实现网络波动模拟
  - [x] SubTask 4.3: 创建基准测试 `tests/e2e/baseline.spec.ts`：无插件时 chunk 加载失败导致导航卡住
  - [x] SubTask 4.4: 创建恢复测试 `tests/e2e/recovery.spec.ts`：有插件时 chunk 加载失败后自动恢复
  - [x] SubTask 4.5: 创建多场景测试：单次瞬时失败、连续多次失败、部分 chunk 失败
  - [x] SubTask 4.6: 实现量化指标采集：恢复成功率、恢复耗时，输出可对比的测试报告
  - [x] SubTask 4.7: 在 `package.json` 中添加 `test:e2e` 脚本

# Task Dependencies
- Task 2 依赖 Task 1（需要插件骨架目录结构）
- Task 3 依赖 Task 1 和 Task 2（插件完成后才能集成）
- Task 4 依赖 Task 3（需要集成后的构建产物才能运行 E2E 测试）
- SubTask 2.10（单元测试）可与 SubTask 2.7-2.9 并行
