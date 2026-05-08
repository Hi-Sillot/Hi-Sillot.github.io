# 修复 VuePress 站内跳转失败（动态导入模块错误）Spec

## Why
VuePress 站点在网络波动时，动态导入 chunk 可能失败（`TypeError: Failed to fetch dynamically imported module`），导致站内路由跳转卡住。根据 [WHATWG HTML 规范](https://html.spec.whatwg.org/#fetch-a-single-module-script)，浏览器会**永久缓存失败的动态导入结果**，在 Chromium 中此失败缓存甚至是"粘性的"——刷新页面也无法清除。因此即使网络恢复，同一 URL 的 `import()` 也不会重试，导航持续失败。

## What Changes
- 创建本地 VuePress 插件 `vuepress-plugin-sillot-chunk-retry`，遵循项目现有插件命名和结构规范
- 核心恢复逻辑封装为框架无关的 `ChunkRetryManager` 类，可独立测试
- 实现**两层恢复策略**：第一层缓存破坏重导入（无刷新），第二层定向页面导航（兜底）
- 使用 Playwright 编写自动化测试，模拟网络波动场景，产出可对比可量化的测试报告

## Impact
- Affected code: 新增 `docs/.vuepress/plugins/vuepress-plugin-sillot-chunk-retry/`，修改 `docs/.vuepress/client.ts`（集成插件）、`docs/.vuepress/config.plugins.ts`（注册插件）
- 新增 devDependencies: `@playwright/test`
- 用户体验：站内跳转不再因网络波动而卡住，大多数情况下无需刷新页面即可自动恢复

## ADDED Requirements

### Requirement: 插件化架构
系统 SHALL 将 chunk 重试恢复逻辑封装为独立的 VuePress 本地插件 `vuepress-plugin-sillot-chunk-retry`，遵循项目现有 `vuepress-plugin-sillot-*` 命名和结构规范。

#### Scenario: 插件独立可维护
- **WHEN** 开发者需要修改或调试 chunk 重试逻辑
- **THEN** 所有相关代码集中在 `docs/.vuepress/plugins/vuepress-plugin-sillot-chunk-retry/` 目录下
- **AND** 插件可通过 `config.plugins.ts` 独立启用/禁用

#### Scenario: 核心逻辑框架无关
- **WHEN** 需要在非 VuePress 环境复用重试逻辑
- **THEN** `ChunkRetryManager` 类可独立使用，不依赖 VuePress API

### Requirement: 动态导入失败时优先无刷新恢复
系统 SHALL 在动态导入失败时，优先尝试不刷新页面的方式恢复导航。

#### Scenario: 网络波动导致动态导入失败后自动恢复
- **WHEN** 用户点击站内链接跳转到新页面
- **AND** 因网络波动导致目标页面 chunk 的动态导入失败
- **THEN** 系统自动用带缓存破坏参数的 URL 重新导入该 chunk
- **AND** 重新导入成功后，更新路由组件并重试 SPA 导航
- **AND** 用户无需任何操作即可正常访问目标页面，页面无刷新

#### Scenario: 缓存破坏重导入也失败时兜底恢复
- **WHEN** 系统尝试缓存破坏重导入仍然失败（网络持续不可用）
- **THEN** 系统执行定向页面导航 `location.href` 到用户目标页面
- **AND** 不产生无限重试循环（通过 sessionStorage 标记限制）

### Requirement: 双重失败检测机制
系统 SHALL 同时使用 `vite:preloadError` 事件和 `router.onError` 检测动态导入失败。

#### Scenario: vite:preloadError 先于 router.onError 触发
- **WHEN** Vite 预加载 chunk 失败
- **THEN** `vite:preloadError` 事件触发，系统尝试缓存破坏重导入
- **AND** 调用 `event.preventDefault()` 抑制错误传播

### Requirement: 防止无限重试循环
系统 SHALL 使用 sessionStorage 标记防止恢复操作导致无限循环。

#### Scenario: 恢复操作后页面仍然加载失败
- **WHEN** 系统执行了恢复操作
- **AND** 恢复后页面仍然加载失败
- **THEN** 系统检测到 sessionStorage 中的重试标记，不再重复执行恢复操作
- **AND** 导航成功后清除 sessionStorage 标记

### Requirement: 跟踪用户导航目标
系统 SHALL 在 `router.beforeEach` 中跟踪用户的导航目标，确保恢复时能导航到正确的页面。

#### Scenario: 用户导航到特定页面时 chunk 加载失败
- **WHEN** 用户从页面 A 点击链接导航到页面 B
- **AND** 页面 B 的 chunk 加载失败
- **THEN** 系统恢复时导航到页面 B（而非页面 A 或当前页）

### Requirement: 可对比可量化的自动化测试
系统 SHALL 提供 Playwright 自动化测试，模拟网络波动场景，产出可对比可量化的测试报告。

#### Scenario: 对比有/无插件时的导航恢复能力
- **WHEN** 运行自动化测试
- **THEN** 测试模拟 chunk 请求失败场景
- **AND** 无插件时导航卡住（超时失败）
- **AND** 有插件时导航自动恢复成功
- **AND** 测试报告包含量化指标：恢复成功率、恢复耗时

#### Scenario: 测试覆盖多种失败模式
- **WHEN** 运行自动化测试
- **THEN** 测试覆盖：单次瞬时失败、连续多次失败、部分 chunk 失败等场景
- **AND** 每个场景都有明确的通过/失败判定和量化指标
