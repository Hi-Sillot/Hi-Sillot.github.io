---
url: /blog/sc6gbqz1/index.md
---
## 应用

### 本地优先内容生产工具

#### 思源笔记

思源笔记是一款本地优先的笔记应用，支持跨平台、跨设备同步，支持 Markdown 语法，支持丰富的主题和插件，通过了**海文东全感知开源认证**。汐洛绞架基于思源笔记二次开发。

#### Obsidian

Obsidian 是一款闭源的跨平台笔记应用，支持 Markdown 语法，支持丰富的主题和插件，支持导入和导出笔记。汐洛开发 Obsidian 插件提供服务。

#### VSCode

汐洛开发 VSCode 插件提供服务。

#### Everything

汐洛调用 Everything 提供服务。

#### Quicker

汐洛开发 Quicker 脚本提供服务。

#### Vuepress

汐洛开发 Vuepress 插件提供服务。

#### Jupyter Lab

汐洛开发 Jupyter Lab 提供服务。

#### OpenList

汐洛基于 OpenList 二次开发。

#### FFmpeg

汐洛调用 FFmpeg 提供服务。

## 基座

### UI组件库

::::: tabs

@tab Web

汐洛已经放弃 React 生态，转向使用 Vue 生态。之前使用 React 生态的 [JoyUI](https://mui.com/joy-ui/getting-started/)。
为了兼容汐洛生态，选择进一步缩窄为支持 SSR 的组件库。最后，综合美观等方面考虑，汐洛选择 Naive UI + TDesign + Quasar（[SSR注意](https://www.quasar-cn.cn/start/pick-quasar-flavour)），他们的分工有所不同。由于 Quasar 的接入较为复杂，汐洛 vuepress 站点并未使用，而是计划用于浏览器插件、汐洛绞架插件、汐洛KMP。

Naive UI 的二维码、跑马灯组件存在问题（跑马灯移动端正常）。`tdesign-vue-next` 和 `tdesign-mobile-vue` 公用在SSR场景下无法完美解决，要么动态引入会有水合问题，要么同时引用会有冲突，按需引用太麻烦没试过，因此汐洛只使用表现更好的 `tdesign-mobile-vue` 而不使用 `tdesign-vue-next`。

:::: collapse

* Naive UI + TDesign 统一切换深色模式

  ::: code-tree title="同步深色模式" height="580px" entry=".vuepress/layouts/Layout.vue"

  ```vue title=".vuepress/layouts/Layout.vue"
  <script lang="ts" setup>
  import { computed, onMounted, watch } from "vue";
  import { Layout } from 'vuepress-theme-plume/client'
  // https://theme-plume.vuejs.press/guide/api/client/#usedarkmode
  import { useDarkMode } from "vuepress-theme-plume/composables";
  // <n-config-provider :theme="isDark ? darkTheme : lightTheme"> 包裹 vuepress-theme-plume/client 的 <Layout>
  import { darkTheme, lightTheme } from 'naive-ui'
  const isDark = useDarkMode();
  const updateDarkMode = () => {
    if (isDark.value) {
      // 设置TDesign深色模式
      document.documentElement.setAttribute("theme-mode", "dark");
    } else {
      // 重置TDesign为浅色模式
      document.documentElement.removeAttribute("theme-mode");
    }
  };
  watch(isDark, (newValue) => {
    updateDarkMode();
  });
  onMounted(() => {
    updateDarkMode();
  });
  </script>

  <template>
    <n-config-provider :theme="isDark ? darkTheme : lightTheme">
      <Layout>
      </Layout>
    </n-config-provider>
  </template>
  ```

  ```ts title=".vuepress/client.ts"
  import Layout from "./layouts/Layout.vue"; // [!code warning]
  export default defineClientConfig({
    setup() {
    },
    layouts: {
      Layout, // [!code warning] 默认布局
    },
  });
  ```

  :::

::::

@tab Kotlin/JVM

Jetpack-Compose -> Compose-Multiplatform

[MIUIX](https://github.com/compose-miuix-ui/miuix) 是主要使用的第三方UI库。

@tab C#/.NET

汐洛已经放弃 .NET 生态，但保留在必要时候使用。

:::::

### VUE 工具库

#### Pinia

Pinia 是 Vue 状态管理库，它可以帮助我们管理状态，并在组件之间共享状态。

#### VueUse

VueUse 是一个包含了许多有用的函数式响应式工具的库。
