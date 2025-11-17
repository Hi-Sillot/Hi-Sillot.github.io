<template>
  <div class="index-me">
    <div v-if="currentDir" class="index-me-content">
      <h3 v-if="showTitle" class="index-me-title">
        <svg class="small-icon" xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 16 16">
          <path
            d="M.54 3.87.5 3a2 2 0 0 1 2-2h3.672a2 2 0 0 1 1.414.586l.828.828A2 2 0 0 0 9.828 3h3.982a2 2 0 0 1 1.992 2.181l-.637 7A2 2 0 0 1 13.174 14H2.826a2 2 0 0 1-1.991-1.819l-.637-7a1.99 1.99 0 0 1 .342-1.31zM2.19 4a1 1 0 0 0-.996 1.09l.637 7a1 1 0 0 0 .995.91h10.348a1 1 0 0 0 .995-.91l.637-7A1 1 0 0 0 13.81 4H2.19zm4.69-1.707A1 1 0 0 0 6.172 2H2.5a1 1 0 0 0-1 .981l.006.139C1.72 3.042 1.95 3 2.19 3h5.396a1 1 0 0 0 .707-.293z" />
        </svg>
        <span class="split-w"></span>
        文章索引: {{ currentDir }}
      </h3>

      <div class="directory-structure">
        <DirectoryLevel :items="directoryItems" :level="0" :max-level="effectiveMaxLevel"
          :current-path="currentPagePath" />
      </div>
    </div>

    <div v-else class="index-me-error">
      <svg class="small-icon" xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 16 16">
        <path
          d="M8.982 1.566a1.13 1.13 0 0 0-1.96 0L.165 13.233c-.457.778.091 1.767.98 1.767h13.713c.889 0 1.438-.99.98-1.767L8.982 1.566zM8 5c.535 0 .954.462.9.995l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 5.995A.905.905 0 0 1 8 5zm.002 6a1 1 0 1 1 0 2 1 1 0 0 1 0-2z" />
      </svg>
      <span class="split-w"></span>
      无法获取当前目录信息
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vuepress/client'
import type { DirectoryNode } from '../indexMe'

interface Props {
  list?: number
  showTitle?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  list: 1,
  showTitle: true
})

const route = useRoute()
const directoryIndex = ref<Record<string, DirectoryNode>>({})
const directoryTree = ref<DirectoryNode>()

// 计算有效的最大层级
const effectiveMaxLevel = computed(() => {
  const level = Math.max(1, Math.min(5, props.list))
  return level
})

// 获取当前页面路径（确保规范化）
const currentPagePath = computed(() => {
  let path = route.path
  // 确保路径以斜杠结尾（如果是目录）
  if (path.endsWith('.html')) {
    path = path.replace(/\.html$/, '')
  }
  // 如果是目录索引页，确保以斜杠结尾
  if (path.endsWith('/')) {
    return path
  }
  // 检查是否是目录（没有文件扩展名）
  const hasExtension = path.match(/\.[^./]+$/)
  if (!hasExtension) {
    return path + '/'
  }
  return path
})

// 获取当前目录路径
const currentDir = computed(() => {
  const path = currentPagePath.value
  if (!path) return null

  // 如果是目录，直接返回
  if (path.endsWith('/')) {
    return path
  }

  // 否则获取父目录路径
  const lastSlashIndex = path.lastIndexOf('/')
  if (lastSlashIndex === -1) return '/'

  return path.substring(0, lastSlashIndex + 1)
})

// 获取当前目录的子项
const directoryItems = computed(() => {
  if (!directoryIndex.value || !currentDir.value) return []

  const currentDirNode = directoryIndex.value[currentDir.value]
  if (!currentDirNode || !currentDirNode.children) return []

  return currentDirNode.children.map(item => ({
    ...item,
    // 确保目录路径以斜杠结尾
    path: item.type === 'directory' && !item.path.endsWith('/')
      ? item.path + '/'
      : item.path
  }))
})

// 加载目录索引数据
async function loadDirectoryIndex() {
  try {
    // 从临时文件加载目录索引数据
    // @ts-ignore
    const directoryData = await import('@temp/directory-index.ts')
    directoryIndex.value = directoryData.default
    directoryTree.value = directoryData.directoryTree
    console.log('目录索引数据加载成功', directoryTree.value)
  } catch (error) {
    console.warn('无法加载目录索引数据，使用模拟数据', error)
    directoryIndex.value = {}
  }
}


onMounted(() => {
  loadDirectoryIndex()
})
</script>

<style scoped>
.index-me {
  margin: 1.5rem 0;
  border: 1px solid var(--c-border);
  border-radius: 8px;
  padding: 1rem;
  background: var(--c-bg);
}

.index-me-title {
  display: flex;
  align-items: center;
  margin: 0 0 1rem 0;
  font-size: 1.1rem;
  color: var(--c-text);
}

.index-me-error {
  display: flex;
  align-items: center;
  color: var(--c-warning);
  padding: 0.5rem;
}

.small-icon {
  width: 16px;
  height: 16px;
  margin-right: 0.5rem;
}

.split-w {
  margin-right: 0.5rem;
}

.directory-structure {
  font-family: 'SFMono-Regular', 'Consolas', 'Liberation Mono', 'Menlo', monospace;
  font-size: 0.9rem;
}
</style>