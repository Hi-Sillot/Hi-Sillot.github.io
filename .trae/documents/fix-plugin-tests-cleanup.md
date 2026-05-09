# 插件修复计划：Toast重构 + NProgress移除 + 恢复跳转

## 概要

ChunkRetryManager.ts 已完成重写（ToastUI→StatusIndicator、移除NProgress、添加navigateWithFallback），但测试文件和chaos-proxy仍残留旧代码。本计划清理残留并验证。

## 当前状态分析

### 已完成
- `ChunkRetryManager.ts`：StatusIndicator 替换 ToastUI ✅、NProgress 集成移除 ✅、navigateWithFallback 添加 ✅

### 待处理
1. **测试文件过时**：仍包含 NProgress integration（L523-582）和 ToastUI aggregation（L602-753）测试，缺少 StatusIndicator 和 navigateWithFallback 测试
2. **chaos-proxy.mjs 残留 NProgress 代码**：CSS 规则（L632）和 4 处 DOM 操作（L811-812, L816-817, L896-897, L914-915）
3. **`showToast` 选项名误导**：已改为 StatusIndicator，选项名应改为 `showStatus`

## 具体变更

### 1. 更新测试文件
**文件**: `/workspace/tests/unit/chunk-retry-manager.test.ts`

- **删除** `NProgress integration` 整个 describe 块（L523-582）
- **删除** `ToastUI aggregation` 整个 describe 块（L602-753）
- **新增** `StatusIndicator` describe 块：
  - initUI 创建 `#chunk-retry-status` div 和 `#chunk-retry-status-styles` style
  - showRecovering 设置 className 为 `chunk-retry-status recovering`
  - showSuccess 设置 className 为 `chunk-retry-status success`，1.5s 后 hide
  - showFail 设置 className 为 `chunk-retry-status fail`，3s 后 hide
  - hide 清空 className
  - destroy 移除 DOM 元素
  - showToast=false 时不创建 UI
- **新增** `navigateWithFallback` describe 块：
  - router.replace 成功且路径匹配 → showSuccess
  - router.replace 成功但路径不匹配 → 1s 后 location.href 降级
  - router.replace 抛异常 → location.href 降级 + showFail
- **更新** afterEach 测试：将 `toast.dismissAll` 相关断言替换为 `status.hide` 相关断言
- **更新** beforeEach：`showToast: false` → `showStatus: false`

### 2. 清理 chaos-proxy.mjs NProgress 残留
**文件**: `/workspace/scripts/chaos-proxy.mjs`

- **删除** CSS 规则：`#nprogress.chunk-error .bar{...}`（L632）
- **删除** 4 处 NProgress DOM 操作代码：
  - L811-812：`var np=document.getElementById('nprogress');if(np)np.classList.add('chunk-error');`
  - L816-817：`var np2=document.getElementById('nprogress');if(np2)np2.classList.remove('chunk-error');`
  - L896-897：`var np=document.getElementById('nprogress');if(np)np.classList.remove('chunk-error');`
  - L914-915：`var np=document.getElementById('nprogress');if(np)np.classList.remove('chunk-error');`

### 3. 重命名 showToast → showStatus
**文件**:
- `/workspace/docs/.vuepress/plugins/vuepress-plugin-sillot-chunk-retry/src/core/types.ts`：`showToast` → `showStatus`
- `/workspace/docs/.vuepress/plugins/vuepress-plugin-sillot-chunk-retry/src/core/ChunkRetryManager.ts`：`showToast` → `showStatus`（DEFAULT_OPTIONS 和 StatusIndicator 构造）
- `/workspace/tests/unit/chunk-retry-manager.test.ts`：所有 `showToast` → `showStatus`

### 4. 构建并验证
- 运行单元测试：`npx vitest run tests/unit/chunk-retry-manager.test.ts`
- 修复任何测试失败
- 构建项目验证无编译错误

## 假设与决策
- StatusIndicator 的 `enabled` 参数由 `showStatus` 选项控制，默认 `true`
- chaos-proxy 中移除 NProgress 操作后，chunk-error 状态仅由 StatusIndicator 表达
- `showToast` → `showStatus` 是破坏性变更，但此插件尚未发布，无需兼容

## 验证步骤
1. `npx vitest run tests/unit/chunk-retry-manager.test.ts` 全部通过
2. 项目构建无错误
3. chaos-proxy 启动后 HTML 中无 NProgress 相关代码
