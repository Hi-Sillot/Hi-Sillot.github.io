<!-- 文章的默认布局 -->
<script lang="ts" setup>
import { computed, onMounted, watch } from "vue";
import { Layout } from 'vuepress-theme-plume/client'
import Backlink from "../plugins/BiGraph/client/components/Backlink.vue";
import LocalGraph from "../plugins/BiGraph/client/components/LocalGraphView.vue";
import GlobalGraph from "../plugins/BiGraph/client/components/GlobalGraphView.vue";
import AuthorLink from "../plugins/vuepress-plugin-sillot-author/components/AuthorLink.vue";
import SiteSettings from "../plugins/vuepress-plugin-sillot-site-settings/components/SiteSettings.vue";
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
  <global-graph v-if="options.enableGlobalGraph"></global-graph>
  <Layout>
    <template #doc-footer-before>
      <backlink></backlink>
    </template>
    <template #nav-bar-content-after>
      <SiteSettings />
    </template>
    <template #aside-outline-before>
      <local-graph v-if="options.enableLocalGraph"></local-graph>
    </template>
    <template #doc-meta-bottom>
      <AuthorLink></AuthorLink>
    </template>
  </Layout>
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