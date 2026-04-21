<!-- layouts/AuthorList.vue -->
<script lang="ts" setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthorStore } from '../stores/author'
import Base from '../../../layouts/Base.vue'

const route = useRoute()
const authorStore = useAuthorStore()

// 从Pinia获取作者数据
const authors = computed(() =>  authorStore.allAuthors)
</script>

<template>
  <Base>
    <template #custom-content>
      <div class="author-list-page base-content">
        <!-- 页面标题和描述 -->
        <div class="page-header">
          <h1 class="page-title">编辑列表</h1>
          <p class="page-description">探索我们优秀的编辑团队，发现更多精彩内容</p>
        </div>

        <!-- 作者统计 -->
        <div class="authors-stats">
          <div class="stat-item">
            <span class="stat-number">{{ authors.length }}</span>
            <span class="stat-label">位署名编辑</span>
          </div>
          <div class="stat-item">
            <span class="stat-number">{{ authors.reduce((total, author) => total + author.posts.length, 0) }}</span>
            <span class="stat-label">篇署名文章</span>
          </div>
        </div>

        <!-- 作者网格 -->
        <div class="author-list">
          <router-link 
            v-for="author in authors"
            :key="author.slug"
            :to="`/authors/${author.slug}`"
            class="author-card"
          >
            <!-- 作者头像 -->
            <div class="author-avatar-container">
              <img v-if="author.avatar" :src="author.avatar" class="author-avatar" :alt="author.name" />
              <div v-else class="author-avatar-placeholder">
                {{ author.name.charAt(0).toUpperCase() }}
              </div>
              <div class="post-count-badge">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M19 3H5C3.89543 3 3 3.89543 3 5V19C3 20.1046 3.89543 21 5 21H19C20.1046 21 21 20.1046 21 19V5C21 3.89543 20.1046 3 19 3Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  <path d="M8 7H16" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  <path d="M8 11H16" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  <path d="M8 15H13" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                <span>{{ author.posts.length }}</span>
              </div>
            </div>

            <!-- 作者信息 -->
            <div class="author-info">
              <h3 class="author-name">{{ author.name }}</h3>
              <!-- <p class="author-bio" v-if="author.bio">{{ author.bio }}</p>
              <p class="author-bio" v-else>这位作者还没有添加个人简介</p> -->
            </div>

            <!-- 悬停效果箭头 -->
            <div class="card-arrow">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M5 12H19" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M12 5L19 12L12 19" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
          </router-link>
        </div>

        <!-- 空状态 -->
        <div v-if="authors.length === 0" class="empty-state">
          <div class="empty-icon">
            <svg width="80" height="80" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M20 21V19C20 17.9391 19.5786 16.9217 18.8284 16.1716C18.0783 15.4214 17.0609 15 16 15H8C6.93913 15 5.92172 15.4214 5.17157 16.1716C4.42143 16.9217 4 17.9391 4 19V21" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M12 11C14.2091 11 16 9.20914 16 7C16 4.79086 14.2091 3 12 3C9.79086 3 8 4.79086 8 7C8 9.20914 9.79086 11 12 11Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <h3>暂无作者</h3>
          <p>当前还没有作者信息，请稍后再试</p>
        </div>
      </div>
    </template>
  </Base>
</template>

<style scoped>
.author-list-page {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem 1.5rem;
  animation: fadeIn 0.5s ease;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

/* 页面标题区域 */
.page-header {
  text-align: center;
  margin-bottom: 3rem;
  padding: 2rem 0;
}

.page-title {
  font-size: 2.5rem;
  font-weight: 700;
  margin-bottom: 1rem;
  color: var(--vp-c-text-1);
  background: linear-gradient(135deg, var(--vp-c-brand) 0%, var(--vp-c-brand-light) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.page-description {
  font-size: 1.1rem;
  color: var(--vp-c-text-2);
  max-width: 600px;
  margin: 0 auto;
  line-height: 1.6;
}

/* 统计信息 */
.authors-stats {
  display: flex;
  justify-content: center;
  gap: 3rem;
  margin-bottom: 3rem;
  padding: 1.5rem;
  background: var(--vp-c-bg-soft);
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.stat-number {
  font-size: 2.5rem;
  font-weight: 700;
  color: var(--vp-c-brand);
  line-height: 1;
}

.stat-label {
  font-size: 0.9rem;
  color: var(--vp-c-text-2);
  font-weight: 500;
}

/* 作者列表网格 */
.author-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 1.5rem;
}

.author-card {
  display: flex;
  flex-direction: column;
  background: var(--vp-c-bg-soft);
  border-radius: 12px;
  padding: 1.5rem;
  cursor: pointer;
  transition: all 0.3s ease;
  text-decoration: none;
  color: inherit;
  border: 1px solid var(--vp-c-border);
  position: relative;
  overflow: hidden;
}

.author-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: linear-gradient(90deg, var(--vp-c-brand) 0%, var(--vp-c-brand-light) 100%);
  transform: scaleX(0);
  transform-origin: left;
  transition: transform 0.3s ease;
}

.author-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
  border-color: var(--vp-c-brand-light);
}

.author-card:hover::before {
  transform: scaleX(1);
}

/* 作者头像区域 */
.author-avatar-container {
  position: relative;
  margin-bottom: 1rem;
  align-self: center;
}

.author-avatar {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  object-fit: cover;
  border: 3px solid white;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  transition: transform 0.3s ease;
}

.author-card:hover .author-avatar {
  transform: scale(1.05);
}

.author-avatar-placeholder {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--vp-c-brand) 0%, var(--vp-c-brand-light) 100%);
  color: white;
  font-size: 2rem;
  font-weight: bold;
  border: 3px solid white;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.post-count-badge {
  position: absolute;
  bottom: 0;
  right: 0;
  display: flex;
  align-items: center;
  gap: 0.25rem;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  padding: 0.25rem 0.5rem;
  border-radius: 20px;
  font-size: 0.8rem;
  font-weight: 600;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  border: 1px solid var(--vp-c-border);
}

/* 作者信息 */
.author-info {
  flex: 1;
  text-align: center;
}

.author-name {
  font-size: 1.3rem;
  font-weight: 600;
  margin: 0 0 0.75rem 0;
  color: var(--vp-c-text-1);
  transition: color 0.2s ease;
}

.author-card:hover .author-name {
  color: var(--vp-c-brand);
}

.author-bio {
  font-size: 0.9rem;
  color: var(--vp-c-text-2);
  line-height: 1.5;
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* 卡片箭头 */
.card-arrow {
  position: absolute;
  top: 1.5rem;
  right: 1.5rem;
  color: var(--vp-c-text-3);
  transition: all 0.3s ease;
  opacity: 0;
  transform: translateX(-10px);
}

.author-card:hover .card-arrow {
  opacity: 1;
  transform: translateX(0);
}

/* 空状态 */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 2rem;
  text-align: center;
}

.empty-icon {
  margin-bottom: 1.5rem;
  color: var(--vp-c-text-3);
}

.empty-state h3 {
  font-size: 1.5rem;
  margin-bottom: 1rem;
  color: var(--vp-c-text-1);
}

.empty-state p {
  color: var(--vp-c-text-2);
  max-width: 400px;
  line-height: 1.6;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .author-list-page {
    padding: 1rem;
  }
  
  .page-title {
    font-size: 2rem;
  }
  
  .authors-stats {
    flex-direction: column;
    gap: 1.5rem;
    padding: 1rem;
  }
  
  .author-list {
    grid-template-columns: 1fr;
    gap: 1rem;
  }
  
  .author-card {
    padding: 1.25rem;
  }
}

@media (min-width: 1200px) {
  .author-list {
    grid-template-columns: repeat(3, 1fr);
  }
}
</style>