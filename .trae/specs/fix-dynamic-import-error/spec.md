# 修复 VuePress 站内跳转失败（动态导入模块错误）Spec

## Why
VuePress 站点部署新版本后，用户浏览器中缓存的旧 HTML 引用了已被删除的旧 chunk 文件，导致动态导入失败（`TypeError: Failed to fetch dynamically imported module`），站内路由跳转就会失败。用户必须手动刷新页面才能恢复，体验极差。

## What Changes
- 在客户端增强文件中添加 `vite:preloadError` 事件监听器，当动态导入失败时自动刷新页面
- 在 Vue Router 上添加 `onError` 处理，捕获路由导航中的动态导入错误并自动刷新
- 在 Vite 构建配置中添加 `chunkFileNames` 策略，避免浏览器扩展（如广告拦截器）误拦截 chunk 文件

## Impact
- Affected code: `docs/.vuepress/client.ts`、`docs/.vuepress/config.ts`
- 用户体验：站内跳转不再因版本更新而失败，自动刷新恢复

## ADDED Requirements

### Requirement: 动态导入失败自动恢复
系统 SHALL 在动态导入模块失败时自动刷新页面，而不是让用户看到空白或错误页面。

#### Scenario: 版本更新后用户点击站内链接
- **WHEN** 站点部署新版本后，用户点击站内链接跳转
- **AND** 旧 chunk 文件已被删除，动态导入失败
- **THEN** 系统自动刷新页面，加载新版本的 HTML 和 chunk 文件
- **AND** 用户无需手动操作即可正常访问目标页面

#### Scenario: 网络不稳定导致动态导入失败
- **WHEN** 用户网络不稳定，动态导入请求失败
- **THEN** 系统自动刷新页面重试加载

### Requirement: Vue Router 导航错误处理
系统 SHALL 在 Vue Router 导航过程中捕获动态导入错误，并自动刷新页面恢复。

#### Scenario: 路由导航中动态导入失败
- **WHEN** 用户通过 Vue Router 导航到新页面
- **AND** 页面组件的动态导入失败
- **THEN** 系统捕获错误并自动刷新页面

### Requirement: 避免 chunk 文件名被浏览器扩展拦截
系统 SHALL 在构建时为 chunk 文件使用不含广告/追踪关键词的文件名，避免被浏览器扩展误拦截。

#### Scenario: 用户使用广告拦截器浏览站点
- **WHEN** 用户浏览器安装了广告拦截器
- **THEN** chunk 文件不会被拦截，站点正常加载
