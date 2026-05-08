# 修复 VuePress 站内跳转失败（动态导入模块错误）Spec

## Why
VuePress 站点在网络波动时，动态导入 chunk 可能失败（`TypeError: Failed to fetch dynamically imported module`），导致站内路由跳转卡住。根据 [WHATWG HTML 规范](https://html.spec.whatwg.org/#fetch-a-single-module-script)，浏览器会**永久缓存失败的动态导入结果**，在 Chromium 中此失败缓存甚至是"粘性的"——刷新页面也无法清除。因此即使网络恢复，同一 URL 的 `import()` 也不会重试，导航持续失败。

## What Changes
- 在客户端增强文件中创建 `useChunkErrorRecovery` 组合函数，实现**两层恢复策略**
- **第一层（无刷新恢复）**：检测动态导入失败 → 用带缓存破坏参数（`?t=timestamp`）的不同 URL 重新导入模块 → 替换路由组件 → 重试 SPA 导航
- **第二层（兜底）**：若第一层失败，执行定向页面导航 `location.href = targetPath`（不是刷新当前页，而是直接导航到用户想去的目标页）
- 使用 `vite:preloadError` 事件 + `router.onError` 双重检测机制
- 使用 `sessionStorage` 标记防止无限重试循环

## Impact
- Affected code: `docs/.vuepress/client.ts`（新增组合函数调用）
- 用户体验：站内跳转不再因网络波动而卡住，大多数情况下无需刷新页面即可自动恢复

## ADDED Requirements

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

#### Scenario: router.onError 捕获导航失败
- **WHEN** Vue Router 导航因动态导入失败
- **THEN** `router.onError` 回调触发，系统尝试恢复导航

### Requirement: 防止无限重试循环
系统 SHALL 使用 sessionStorage 标记防止恢复操作导致无限循环。

#### Scenario: 恢复操作后页面仍然加载失败
- **WHEN** 系统执行了恢复操作（缓存破坏重导入或定向导航）
- **AND** 恢复后页面仍然加载失败
- **THEN** 系统检测到 sessionStorage 中的重试标记，不再重复执行恢复操作
- **AND** 导航成功后清除 sessionStorage 标记

### Requirement: 跟踪用户导航目标
系统 SHALL 在 `router.beforeEach` 中跟踪用户的导航目标，确保恢复时能导航到正确的页面。

#### Scenario: 用户导航到特定页面时 chunk 加载失败
- **WHEN** 用户从页面 A 点击链接导航到页面 B
- **AND** 页面 B 的 chunk 加载失败
- **THEN** 系统恢复时导航到页面 B（而非页面 A 或当前页）
