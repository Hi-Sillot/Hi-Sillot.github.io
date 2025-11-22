<!-- 带顶栏的基础布局，包含导航栏、内容、底部等元素。提供自定义页面使用 -->
<script lang="ts" setup>
//@ts-ignore
import VPBackToTop from '@theme/VPBackToTop.vue'
//@ts-ignore
import VPNav from '@theme/Nav/VPNav.vue'
//@ts-ignore
import VPFooter from '@theme/VPFooter.vue'
import { computed, defineAsyncComponent, onMounted, watch } from "vue";
import { useDeviceDetection } from "../plugins/vuepress-plugin-sillot-site-settings/composables/useDeviceDetection";
import TSiteSettings from "../plugins/vuepress-plugin-sillot-site-settings/components/TSiteSettings.vue";
import NSiteSettings from "../plugins/vuepress-plugin-sillot-site-settings/components/NSiteSettings.vue";
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
</script>
<template>
  <n-config-provider :theme="isDark ? darkTheme : lightTheme">
    <n-message-provider>
      <VPNav>
        <template #nav-bar-title-before>
          <slot name="nav-bar-title-before" />
        </template>
        <template #nav-bar-title-after>
          <slot name="nav-bar-title-after" />
        </template>
        <template #nav-bar-content-before>
          <slot name="nav-bar-content-before" />
        </template>
        <template #nav-bar-content-after>
          <ClientOnly>
            <component :is="currentComponent" :key="componentKey" />
          </ClientOnly>
        </template>
        <!-- <template #nav-bar-content-after>
      <slot name="nav-bar-content-after" />
    </template> -->
        <template #nav-bar-menu-before>
          <slot name="nav-bar-menu-before" />
        </template>
        <template #nav-bar-menu-after>
          <slot name="nav-bar-menu-after" />
        </template>
        <template #nav-screen-content-before>
          <slot name="nav-screen-content-before" />
        </template>
        <template #nav-screen-content-after>
          <slot name="nav-screen-content-after" />
        </template>
        <template #nav-screen-menu-before>
          <slot name="nav-screen-menu-before" />
        </template>
        <template #nav-screen-menu-after>
          <slot name="nav-screen-menu-after" />
        </template>
      </VPNav>

      <div class="custom-content-container">
        <slot name="custom-content">
          <!-- 插入位置 -->
        </slot>
      </div>

      <VPBackToTop />
      <VPFooter>
        <template #footer-content>
          <slot name="footer-content" />
        </template>
      </VPFooter>
    </n-message-provider>
  </n-config-provider>
</template>

<style scoped>
.custom-content-container {
  padding-top: var(--vp-nav-height);
  margin-top: 0.3rem !important;
  min-height: 580px;
}
</style>