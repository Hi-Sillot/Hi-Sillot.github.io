<!-- DirectoryLevel 子组件（用于递归渲染） -->
<template>
  <ul class="directory-level" :class="`level-${level}`">
    <li v-for="item in sortedItems" :key="item.path" class="directory-item">
      <!-- 文件或目录链接 -->
      <RouterLink 
        v-if="item.type === 'file'"
        :to="normalizeLink(item.path, item.type)"
        class="item-link"
        :class="{ 'current': isCurrentPage(item.path) }"
      >
        <span class="item-icon">📄</span>
        {{ item.title || item.name }}
      </RouterLink>
      
      <div v-else class="directory-folder">
        <!-- 目录 -->
        <div class="folder-header" @click="toggleFolder(item.path)">
          <span class="item-icon">{{ isExpanded(item.path) ? '📂' : '📁' }}</span>
          <RouterLink 
            :to="normalizeLink(item.path, item.type)"
            class="folder-name"
            @click.stop
          >
            {{ item.title || item.name }}/
          </RouterLink>
          <span v-if="hasChildren(item)" class="expand-icon">
            {{ isExpanded(item.path) ? '▼' : '▶' }}
          </span>
          <span v-else class="empty-indicator">•</span>
        </div>
        
        <!-- 子目录内容 -->
        <div v-if="hasChildren(item) && isExpanded(item.path)" class="folder-content">
          <DirectoryLevel 
            :items="item.children!"
            :level="level + 1"
            :max-level="maxLevel"
            :current-path="currentPath"
          />
        </div>
      </div>
    </li>
  </ul>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import type { DirectoryNode } from '../indexMe'

interface Props {
  items: DirectoryNode[]
  level: number
  maxLevel: number
  currentPath: string
}

const props = defineProps<Props>()

// 展开/折叠状态
const expandedFolders = ref<Set<string>>(new Set())

// 排序后的项目
const sortedItems = computed(() => {
  return [...props.items].sort((a, b) => {
    if (a.type !== b.type) {
      return a.type === 'directory' ? -1 : 1
    }
    return (a.title || a.name).localeCompare(b.title || b.name)
  })
})

// 规范化链接路径
function normalizeLink(path: string, type: 'file' | 'directory'): string {
  // 确保目录路径以斜杠结尾
  if (type === 'directory' && !path.endsWith('/')) {
    return path + '/'
  }
  // 文件路径保持不变
  return path
}

// 检查是否是当前页面
function isCurrentPage(itemPath: string): boolean {
  const normalizedItemPath = normalizeLink(itemPath, 'file')
  const normalizedCurrentPath = props.currentPath.endsWith('/') 
    ? props.currentPath 
    : props.currentPath + '/'
  return normalizedItemPath === normalizedCurrentPath
}

// 检查目录是否有子项
function hasChildren(item: DirectoryNode): boolean {
  return !!item.children && item.children.length > 0
}

// 检查目录是否展开
function isExpanded(path: string): boolean {
  return expandedFolders.value.has(path) && props.level < props.maxLevel - 1
}

// 切换目录展开状态
function toggleFolder(path: string) {
  if (expandedFolders.value.has(path)) {
    expandedFolders.value.delete(path)
  } else {
    expandedFolders.value.add(path)
  }
}
</script>

<style scoped>
.directory-level {
  list-style: none;
  padding: 0;
  margin: 0;
}

.directory-level.level-0 {
  padding-left: 0;
}

.directory-level.level-1 {
  padding-left: 1rem;
}

.directory-level.level-2 {
  padding-left: 2rem;
}

.directory-level.level-3 {
  padding-left: 3rem;
}

.directory-level.level-4 {
  padding-left: 4rem;
}

.directory-level.level-5 {
  padding-left: 5rem;
}

.directory-item {
  margin: 0.25rem 0;
}

.item-link {
  display: flex;
  align-items: center;
  padding: 0.25rem 0.5rem;
  text-decoration: none;
  color: var(--c-text);
  border-radius: 4px;
  transition: background-color 0.2s;
}

.item-link:hover {
  background-color: var(--c-bg-light);
}

.item-link.current {
  background-color: var(--c-brand-light);
  color: var(--c-brand);
  font-weight: 600;
}

.directory-folder {
  cursor: pointer;
}

.folder-header {
  display: flex;
  align-items: center;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  transition: background-color 0.2s;
}

.folder-header:hover {
  background-color: var(--c-bg-light);
}

.item-icon {
  margin-right: 0.5rem;
  width: 1rem;
  text-align: center;
}

.folder-name {
  font-weight: 600;
  color: var(--c-brand);
  text-decoration: none;
}

.folder-name:hover {
  text-decoration: underline;
}

.expand-icon {
  margin-left: auto;
  font-size: 0.8rem;
  color: var(--c-text-light);
}

.empty-indicator {
  margin-left: auto;
  color: var(--c-text-light);
  font-size: 0.8rem;
}

.folder-content {
  border-left: 2px solid var(--c-border-light);
  margin-left: 0.5rem;
}
</style>