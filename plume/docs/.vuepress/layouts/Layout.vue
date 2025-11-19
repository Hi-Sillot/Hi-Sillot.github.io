<!-- 文章的默认布局 -->
<script lang="ts" setup>
import { computed, defineAsyncComponent, onMounted, watch } from "vue";
import { Layout } from 'vuepress-theme-plume/client'
import { isMobileDevice } from "../utils/env";
import Backlink from "../plugins/BiGraph/client/components/Backlink.vue";
import LocalGraph from "../plugins/BiGraph/client/components/LocalGraphView.vue";
import GlobalGraph from "../plugins/BiGraph/client/components/GlobalGraphView.vue";
import AuthorLink from "../plugins/vuepress-plugin-sillot-author/components/AuthorLink.vue";
import TSiteSettings from "../plugins/vuepress-plugin-sillot-site-settings/components/TSiteSettings.vue";
import NSiteSettings from "../plugins/vuepress-plugin-sillot-site-settings/components/NSiteSettings.vue";
// https://theme-plume.vuejs.press/guide/api/client/#usedarkmode
import { useDarkMode } from "vuepress-theme-plume/composables";
// <n-config-provider :theme="isDark ? darkTheme : lightTheme"> 包裹 vuepress-theme-plume/client 的 <Layout>
import { darkTheme, lightTheme } from 'naive-ui'
import { useDeviceDetection } from "../plugins/vuepress-plugin-sillot-site-settings/composables/useDeviceDetection";
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
const { isMobile, componentKey } = useDeviceDetection()

const currentComponent = computed(() =>
  isMobile.value ? TSiteSettings : NSiteSettings
)

watch(isDark, (newValue) => {
  updateDarkMode();
});
onMounted(() => {
  updateDarkMode();
});
declare const __RELATIONAL_GRAPH_ENABLE_LOCAL_GRAPH: boolean;
declare const __RELATIONAL_GRAPH_ENABLE_GLOBAL_GRAPH: boolean;
const options = computed(() => {
  return {
    enableLocalGraph: __RELATIONAL_GRAPH_ENABLE_LOCAL_GRAPH,
    enableGlobalGraph: __RELATIONAL_GRAPH_ENABLE_GLOBAL_GRAPH,
  };
});
</script>

<template>
  <n-config-provider :theme="isDark ? darkTheme : lightTheme">
    <n-message-provider>
      <global-graph v-if="options.enableGlobalGraph"></global-graph>
      <Layout>
        <template #doc-footer-before>
          <backlink></backlink>
        </template>
        <template #nav-bar-content-after>
          <ClientOnly>
            <component :is="currentComponent" :key="componentKey" />
          </ClientOnly>
        </template>
        <template #aside-outline-before>
          <local-graph v-if="options.enableLocalGraph"></local-graph>
        </template>
        <template #doc-meta-bottom>
          <AuthorLink></AuthorLink>
        </template>
      </Layout>
    </n-message-provider>
  </n-config-provider>
</template>

<style>
.custom-content {
  width: 100%;
}


/* .aside-container {
  min-width: 300px;
} */
</style>