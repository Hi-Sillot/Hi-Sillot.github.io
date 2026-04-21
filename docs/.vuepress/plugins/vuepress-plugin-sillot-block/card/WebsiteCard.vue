<!-- https://github.com/pengzhanbo/vuepress-theme-plume/blob/e87ae4fc16cd32c9a341539933e45cb05829f359/docs/.vuepress/themes/components/Demos.vue -->

<script setup lang="ts">
import { NIcon, NImage } from 'naive-ui'
import { ImageOutline as ImageOutlineIcon } from '@vicons/ionicons5'

interface Demo {
  name: string
  desc: string
  logo: string
  repo: string
  url: string
  preview: string
}

defineProps<{
  list: Demo[]
}>()

// 检查是否有预览图
const hasPreview = (preview: string) => {
  return preview && preview.trim() !== ''
}
</script>

<template>
  <div class="demos">
    <div v-for="demo in list" :key="demo.url" class="demo-item">
      <div class="demo-img-container">
        <a :href="demo.url" target="_blank" rel="noopener noreferrer">
          <!-- 无预览图的情况 -->
          <div v-if="!hasPreview(demo.preview)" class="no-preview-container">
            <div class="no-preview-content">
              <n-icon :size="48" color="lightGrey">
                <ImageOutlineIcon />
              </n-icon>
              <div class="no-preview-text">暂无预览图</div>
            </div>
          </div>
          
          <!-- 有预览图的情况 -->
          <n-image
            v-else
            lazy
            :src="demo.preview"
            :alt="demo.name"
            object-fit="cover"
            preview-disabled
            class="demo-image"
            :intersection-observer-options="{
              root: null
            }"
          >
            <template #error>
              <div class="error-container">
                <n-icon :size="48" color="lightGrey">
                  <ImageOutlineIcon />
                </n-icon>
              </div>
            </template>
          </n-image>
        </a>
      </div>
      <div class="demo-content">
        <h3 class="demo-title">
          <span v-if="demo.logo" class="logo" :style="`background-image: url(${demo.logo})`" />
          <span class="title">
            <a :href="demo.url" target="_blank" rel="noopener noreferrer" :aria-label="demo.name" :title="demo.name">{{ demo.name }}</a>
          </span>
          <a v-if="demo.repo" :href="demo.repo" class="github" target="_blank" rel="noopener noreferrer" :aria-label="`Link to GitHub: ${demo.name}`">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
            </svg>
          </a>
        </h3>
        <p :title="demo.desc">
          {{ demo.desc }}
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.demos {
  display: grid;
  grid-template-columns: repeat(1, minmax(0, 1fr));
  gap: 20px 16px;
  width: 100%;
}

@media (min-width: 768px) {
  .demos {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.demo-item {
  overflow: hidden;
  border: solid 1px var(--vp-c-divider);
  border-radius: 8px;
  box-shadow: var(--vp-shadow-1);
  transition: var(--vp-t-color);
  transition-property: border;
  display: flex;
  flex-direction: column;
  height: 100%;
}

.demo-item:hover {
  box-shadow: var(--vp-shadow-3);
}

.demo-img-container {
  position: relative;
  width: 100%;
  height: 200px;
  overflow: hidden;
  background-color: var(--vp-c-bg-soft);
  flex-shrink: 0;
}

:deep(.demo-image) {
  width: 100%;
  height: 100%;
}

:deep(.demo-image .n-image) {
  width: 100%;
  height: 100%;
}

:deep(.demo-image .n-image img) {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 1s cubic-bezier(0.19, 1, 0.22, 1);
  transform: scale(1);
}

.demo-item:hover :deep(.demo-image .n-image img) {
  transform: scale(1.05);
}

.demo-content {
  padding: 16px;
  flex-grow: 1;
  display: flex;
  flex-direction: column;
}

.demo-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 0 0 8px 0;
  font-size: 16px;
}

.demo-title .logo {
  display: inline-block;
  width: 20px;
  height: 20px;
  margin-right: 5px;
  background-repeat: no-repeat;
  background-position: center center;
  background-size: cover;
}

.demo-title .title {
  flex: 1 2;
  width: auto;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.demo-title .title a {
  color: var(--vp-c-text-1);
  text-decoration: none;
  font-weight: 600;
}

.demo-title .title a:hover {
  color: var(--vp-c-brand);
}

.demo-title .github {
  display: flex;
  margin-left: 10px;
  color: var(--vp-c-text-2);
  transition: color 0.3s;
}

.demo-title .github:hover {
  color: var(--vp-c-text-1);
}

.demo-title .vpi-social-github {
  display: inline-block;
  width: 20px;
  height: 20px;
}

.demo-content p {
  display: -webkit-box;
  margin: 0;
  overflow: hidden;
  font-size: 14px;
  line-height: 1.5;
  color: var(--vp-c-text-2);
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
  flex-grow: 1;
}

/* 错误状态和无预览状态样式 */
.error-container,
.no-preview-container {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--vp-c-bg-soft);
}


.no-preview-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}


.error-container {
  color: var(--vp-c-text-3);
}


.no-preview-container {
  color: #adb5bd;
}

.no-preview-text {
  font-size: 14px;
  color: #6c757d;
}
</style>