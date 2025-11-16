<script lang="ts" setup>
import VPNav from '@theme/Nav/VPNav.vue'
import VPBackToTop from '@theme/VPBackToTop.vue'
import VPFooter from '@theme/VPFooter.vue'
</script>
<template>
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
          <slot name="nav-bar-content-after" />
        </template>
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

      <slot name="custom-content">
        <!-- 插入位置 -->
      </slot>

      <VPBackToTop />
      <VPFooter>
        <template #footer-content>
          <slot name="footer-content" />
        </template>
      </VPFooter>
</template>

<style>
.base-content {
  padding-top: var(--vp-nav-height);
  margin-top: 0.3rem !important;
}
</style>