
::::: tabs

@tab Web

汐洛已经放弃 React 生态，转向使用 Vue 生态。之前使用 React 生态的 [JoyUI](https://mui.com/joy-ui/getting-started/)。
为了兼容汐洛生态，选择进一步缩窄为支持 SSR 的组件库。最后，综合美观等方面考虑，汐洛选择 Naive UI + TDesign + Quasar（[SSR注意](https://www.quasar-cn.cn/start/pick-quasar-flavour)），他们的分工有所不同。由于 Quasar 的接入较为复杂，汐洛 vuepress 站点并未使用，而是计划用于浏览器插件、汐洛绞架插件、汐洛KMP。

Naive UI 的二维码、跑马灯组件存在问题（跑马灯移动端正常）。`tdesign-vue-next` 和 `tdesign-mobile-vue` 公用在SSR场景下无法完美解决，要么动态引入会有水合问题，要么同时引用会有冲突，按需引用太麻烦没试过，因此汐洛只使用表现更好的 `tdesign-mobile-vue` 而不使用 `tdesign-vue-next`。

:::: collapse
- Naive UI + TDesign 统一切换深色模式

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

@tab C\#/.NET

汐洛已经放弃 .NET 生态，但保留在必要时候使用。

:::::