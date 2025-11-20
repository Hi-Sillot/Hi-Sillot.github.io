<!-- layouts/AuthorDetail.vue -->
<script lang="ts" setup>
import { computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthorStore } from '../stores/author'
import Base from '../../../layouts/Base.vue'
import VerifiedAvatar from './VerifiedAvatar.vue'

const route = useRoute()
const authorStore = useAuthorStore()

// 从路由参数获取slug
const slug = computed(() => {
  // 路由参数可能是 :slug 或 catchAll 格式
  if (route.params.slug) {
    return Array.isArray(route.params.slug)
      ? route.params.slug.join('/')
      : route.params.slug
  }

  if (route.params.catchAll) {
    const pathSegments = route.params.catchAll.toString().split('/').filter(Boolean)
    return pathSegments.join('/')
  }

  // 从路径中提取slug
  const path = route.path
  if (path.startsWith('/authors/')) {
    return path.replace('/authors/', '').replace(/\/$/, '')
  }

  return ''
})

// 获取作者数据
const author = computed(() => {
  if (!slug.value) return null
  return authorStore.getAuthorBySlug(slug.value)
})

// 监听路由变化，确保作者数据更新
watch(() => route.path, () => {
  console.log('路由变化，重新获取作者数据:', slug.value)
})

onMounted(() => {
  console.log('AuthorDetail 组件挂载，slug:', slug.value)
  console.log('作者数据:', author.value)
})
</script>

<template>
  <Base>
  <template #custom-content>
    <div class="base-content">
      <!-- 返回按钮 -->
      <div class="back-button">
        <RouterLink to="/authors" class="back-link">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M10 12L6 8L10 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"
              stroke-linejoin="round" />
          </svg>
          返回作者列表
        </RouterLink>
      </div>

      <div v-if="author" class="author-detail">
        <!-- 作者头部信息 -->
        <div class="author-header">
          <div class="avatar-container">
            <VerifiedAvatar avatar-type="slot" :alt-text="author.name" :avatar-size="150" shape="circle"
              :badge-size="36" badge-type="yellow" :show-badge="author.verified" :show-tooltip="true"
              :border-width="10" border-color="#aaaaaa" :shadow="true">
              <img v-if="author.avatar" :src="author.avatar" class="avatar" :alt="author.name" />
              <div v-else class="avatar-placeholder">
                {{ author.name.charAt(0).toUpperCase() }}
              </div>
            </VerifiedAvatar>
          </div>
          <div class="author-info">
            <h1 class="author-name">{{ author.name }}</h1>
            <div class="author-meta">
              <div class="post-count">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path
                    d="M19 3H5C3.89543 3 3 3.89543 3 5V19C3 20.1046 3.89543 21 5 21H19C20.1046 21 21 20.1046 21 19V5C21 3.89543 20.1046 3 19 3Z"
                    stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                  <path d="M8 7H16" stroke="currentColor" stroke-width="2" stroke-linecap="round"
                    stroke-linejoin="round" />
                  <path d="M8 11H16" stroke="currentColor" stroke-width="2" stroke-linecap="round"
                    stroke-linejoin="round" />
                  <path d="M8 15H13" stroke="currentColor" stroke-width="2" stroke-linecap="round"
                    stroke-linejoin="round" />
                </svg>
                <span>{{ author.posts.length }} 篇文章</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 文章列表 -->
        <div class="posts-section">
          <h2 class="section-title">文章列表</h2>
          <div class="posts-list">
            <div v-for="post in author.posts" :key="post.path" class="post-card">
              <RouterLink :to="post.path" class="post-link">
                <div class="post-content">
                  <h3 class="post-title">{{ post.title }}<span class="post-path">{{ post.path }}</span></h3>
                  <div class="post-meta">
                    <span class="post-date">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path
                          d="M19 4H5C3.89543 4 3 4.89543 3 6V20C3 21.1046 3.89543 22 5 22H19C20.1046 22 21 21.1046 21 20V6C21 4.89543 20.1046 4 19 4Z"
                          stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                        <path d="M16 2V6" stroke="currentColor" stroke-width="2" stroke-linecap="round"
                          stroke-linejoin="round" />
                        <path d="M8 2V6" stroke="currentColor" stroke-width="2" stroke-linecap="round"
                          stroke-linejoin="round" />
                        <path d="M3 10H21" stroke="currentColor" stroke-width="2" stroke-linecap="round"
                          stroke-linejoin="round" />
                      </svg>
                      {{ post.date }}
                    </span>
                  </div>
                </div>
                <div class="post-arrow">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M5 12H19" stroke="currentColor" stroke-width="2" stroke-linecap="round"
                      stroke-linejoin="round" />
                    <path d="M12 5L19 12L12 19" stroke="currentColor" stroke-width="2" stroke-linecap="round"
                      stroke-linejoin="round" />
                  </svg>
                </div>
              </RouterLink>
            </div>
          </div>
        </div>
      </div>

      <!-- 作者不存在的情况 -->
      <div v-else class="not-found">
        <div class="not-found-content">
          <div class="not-found-icon">
            <svg width="80" height="80" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M10.29 3.86L1.82 18C1.64538 18.3024 1.55299 18.6453 1.552 19C1.551 19.3547 1.64142 19.6981 1.81445 20C1.98748 20.3019 2.23675 20.5523 2.53773 20.7259C2.83871 20.8994 3.18082 20.9898 3.53 21H20.47C20.8192 20.9898 21.1613 20.8994 21.4623 20.7259C21.7633 20.5523 22.0125 20.3019 22.1856 20C22.3586 19.6981 22.449 19.3547 22.448 19C22.447 18.6453 22.3546 18.3024 22.18 18L13.71 3.86C13.5317 3.56611 13.2807 3.32311 12.9812 3.15447C12.6817 2.98584 12.3438 2.89725 12 2.89725C11.6562 2.89725 11.3183 2.98584 11.0188 3.15447C10.7193 3.32311 10.4683 3.56611 10.29 3.86Z"
                stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
              <path d="M12 9V13" stroke="currentColor" stroke-width="2" stroke-linecap="round"
                stroke-linejoin="round" />
              <path d="M12 17H12.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"
                stroke-linejoin="round" />
            </svg>
          </div>
          <h1>作者 "{{ slug }}" 不存在</h1>
          <p>抱歉，我们找不到您要查找的作者。</p>
          <RouterLink to="/authors" class="back-to-authors">返回作者列表</RouterLink>
        </div>
      </div>
    </div>
  </template>
  </Base>
</template>

<style scoped>
.base-content {
  max-width: 900px;
  margin: 0 auto;
  padding: var(--vp-nav-height) 1.5rem;
}

/* 返回按钮样式 */
.back-button {
  margin-bottom: 2rem;
}

.back-link {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--vp-c-text-2);
  text-decoration: none;
  font-weight: 500;
  transition: color 0.3s ease;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  background-color: var(--vp-c-bg-soft);
}

.back-link:hover {
  color: var(--vp-c-brand);
  background-color: var(--vp-c-bg-soft-up);
}

/* 作者详情样式 */
.author-detail {
  animation: fadeIn 0.5s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.author-header {
  display: flex;
  align-items: center;
  gap: 2rem;
  margin-bottom: 3rem;
  padding: 2rem;
  background: linear-gradient(135deg, var(--vp-c-bg-soft) 0%, var(--vp-c-bg-soft-down) 100%);
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
}

.avatar-container {
  position: relative;
}

.avatar {
  width: 120px;
  height: 120px;
  border-radius: 50%;
  object-fit: cover;
  border: 4px solid white;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.1);
}

.avatar-placeholder {
  width: 120px;
  height: 120px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--vp-c-brand) 0%, var(--vp-c-brand-dark) 100%);
  font-size: 3rem;
  font-weight: bold;
  border: 2px dashed #ffffff58;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.1);
}

.author-info {
  flex: 1;
}

.author-name {
  font-size: 2.5rem;
  font-weight: 700;
  margin: 0 0 1rem 0;
  color: var(--vp-c-text-1);
  line-height: 1.2;
}

.author-meta {
  display: flex;
  gap: 1.5rem;
}

.post-count {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--vp-c-text-2);
  font-weight: 500;
}

/* 文章列表样式 */
.posts-section {
  margin-top: 2rem;
}

.section-title {
  font-size: 1.5rem;
  font-weight: 600;
  margin-bottom: 1.5rem;
  color: var(--vp-c-text-1);
  padding-bottom: 0.5rem;
  border-bottom: 2px solid var(--vp-c-brand);
  display: inline-block;
}

.posts-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.post-card {
  background: var(--vp-c-bg-soft);
  border-radius: 10px;
  overflow: hidden;
  transition: all 0.3s ease;
  border: 1px solid var(--vp-c-border);
}

.post-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.08);
  border-color: var(--vp-c-brand-light);
}

.post-link {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  text-decoration: none;
  color: inherit;
  transition: background-color 0.2s ease;
}

.post-link:hover {
  background-color: var(--vp-c-bg-soft-up);
}

.post-content {
  flex: 1;
}

.post-title {
  font-size: 1.2rem;
  font-weight: 600;
  margin: 0 0 0.5rem 0;
  color: var(--vp-c-text-1);
  transition: color 0.2s ease;
}

.post-path {
  color: var(--vp-c-text-2);
  margin-left: 10px;
  font-size: 0.8rem;
  font-weight: 300;
}

.post-link:hover .post-title {
  color: var(--vp-c-brand);
}

.post-meta {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.post-date {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.9rem;
  color: var(--vp-c-text-2);
}

.post-arrow {
  color: var(--vp-c-text-3);
  transition: transform 0.3s ease, color 0.3s ease;
}

.post-link:hover .post-arrow {
  transform: translateX(3px);
  color: var(--vp-c-brand);
}

/* 未找到作者样式 */
.not-found {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 50vh;
  text-align: center;
  animation: fadeIn 0.5s ease;
}

.not-found-content {
  max-width: 500px;
  padding: 2rem;
}

.not-found-icon {
  margin-bottom: 1.5rem;
  color: var(--vp-c-text-3);
}

.not-found h1 {
  font-size: 2rem;
  margin-bottom: 1rem;
  color: var(--vp-c-text-1);
}

.not-found p {
  color: var(--vp-c-text-2);
  margin-bottom: 2rem;
  line-height: 1.6;
}

.back-to-authors {
  display: inline-block;
  padding: 0.75rem 1.5rem;
  background-color: var(--vp-c-brand);
  color: white;
  text-decoration: none;
  border-radius: 6px;
  font-weight: 500;
  transition: background-color 0.3s ease, transform 0.2s ease;
}

.back-to-authors:hover {
  background-color: var(--vp-c-brand-dark);
  transform: translateY(-2px);
}

/* 响应式设计 */
@media (max-width: 768px) {
  .base-content {
    padding: 1rem;
  }

  .author-header {
    flex-direction: column;
    text-align: center;
    gap: 1.5rem;
    padding: 1.5rem;
  }

  .author-name {
    font-size: 2rem;
  }

  .author-meta {
    justify-content: center;
  }

  .post-link {
    flex-direction: column;
    align-items: flex-start;
    gap: 1rem;
  }

  .post-arrow {
    align-self: flex-end;
  }
}
</style>