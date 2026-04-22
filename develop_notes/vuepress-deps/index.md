---
url: /develop_notes/vuepress-deps/index.md
---
## 依赖更新问题

### bun update -i 会把 VuePress 从 v2 降级到 v1

**现象**：运行 `bun run up`（即 `bun update -i`）后，`vuepress` 从 `2.0.0-rc.26` 变成 `1.9.10`，导致 `docs:dev` 启动报错 `Cannot find module 'markdown-it-emoji/lib/data/full.json'`。

**根因**：npm registry 的 `latest` 标签指向 v1 稳定版（`1.9.10`），而 VuePress v2 还是 rc 阶段。根据 semver 规范，预发布版本（`2.0.0-rc.26`）优先级低于正式版本（`1.9.10`），所以 `bun update -i` 把 `1.9.10` 当作"最新版本"推荐升级。

这不仅是 `vuepress` 本身的问题，`@vuepress/bundler-vite`、`@vuepress/plugin-*` 等生态插件同样受影响——它们的 npm `latest` 标签也指向了过旧的 rc 版本。

### 解决方案：使用安全更新脚本

项目提供了 `bun run up:safe` 命令，替代 `bun run up`。脚本执行三步：

1. **查询 + 自动升级受保护包**：从 npm registry 查询最新 rc 版本，直接写入 `package.json` 和 `overrides`
2. **bun update**：更新非受保护包（如 `@vueuse/core`、`mermaid` 等）
3. **验证 + 修复**：检查 `bun update` 是否把受保护包降级了，如果是则自动恢复

受保护包列表定义在 `scripts/safe-update.mjs` 的 `PROTECTED_PACKAGES` 中，包括 `vuepress`、`@vuepress/bundler-vite`、`@vuepress/plugin-*`、`vue`、`vuepress-theme-plume`。

### 三层防护机制

| 层级 | 方式 | 作用 |
|------|------|------|
| 第一层 | 精确版本号 | VuePress 生态依赖不使用 `^` 前缀，锁定精确版本 |
| 第二层 | `package.json` 的 `overrides` | 强制覆盖整个依赖树的版本解析，防止传递依赖引入不兼容版本 |
| 第三层 | `safe-update.mjs` 脚本 | 防止 `bun update` 降级受保护包，并自动升级到最新 rc |

### overrides 的必要性

即使 `package.json` 中的直接依赖版本正确，`overrides` 仍然不可省略。因为传递依赖可能声明了不兼容的版本范围（如某个子依赖要求 `"vuepress": "^1.0.0"`），没有 `overrides` 的话 bun 可能同时安装 v1 和 v2 两个版本，导致运行时崩溃。

### 手动升级 VuePress 生态依赖

如果需要手动升级 VuePress 生态依赖，必须**同时更新三个地方**：

1. `devDependencies` 中的版本号
2. `overrides` 中的版本号
3. `scripts/safe-update.mjs` 中 `PROTECTED_PACKAGES` 的最低版本

然后运行 `bun install` 重新解析依赖。

### 常用命令

```sh
# 安全更新（推荐）
bun run up:safe

# 交互式更新（注意不要选择 VuePress 生态的降级项）
bun run up

# 清除缓存后启动开发服务器
bun run docs:dev-clean
```
