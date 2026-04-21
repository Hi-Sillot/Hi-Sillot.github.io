<!-- components/GraphButtons.vue - 图谱按钮组件 -->
<script setup lang="ts">
// 日志计数器
let logCounter = 0;
function log(step: string, data?: any) {
  console.log(`${++logCounter}. [GraphButtons] ${step}`, data ? data : '');
}

log("GraphButtons 组件开始初始化");

defineProps<{
  enableGlobalGraph: boolean;
}>();

const emit = defineEmits<{
  (e: "fullscreen"): void;
  (e: "global"): void;
  (e: "close"): void;
  (e: "reload"): void;
}>();

// 方法
const handleFullscreen = (): void => {
  log("全屏按钮点击");
  emit("fullscreen");
};

const handleGlobal = (): void => {
  log("全局图谱按钮点击");
  emit("global");
};

const handleClose = (): void => {
  log("关闭按钮点击");
  emit("close");
};

const handleReload = (): void => {
  log("重新加载按钮点击");
  emit("reload");
};

log("GraphButtons 组件初始化完成");
</script>

<template>
  <div class="graph-buttons">
    <!-- 重新加载按钮 -->
    <button
      class="graph-btn graph-btn--reload"
      @click="handleReload"
      title="重新加载图谱"
    >
      <svg fill="none" height="20" stroke-width="1.5" viewBox="0 0 24 24" width="20" xmlns="http://www.w3.org/2000/svg">
        <path d="M21.1679 8C19.6247 4.46819 16.1006 2 12 2C6.81465 2 2.5511 5.94668 2.04938 11" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M17 8H21.4C21.7314 8 22 7.73137 22 7.4V3" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M2.83209 16C4.37531 19.5318 7.89942 22 12 22C17.1853 22 21.4489 18.0533 21.9506 13" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M7 16H2.6C2.26863 16 2 16.2686 2 16.6V21" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </button>

    <!-- 全局图谱按钮 -->
    <button
      v-if="enableGlobalGraph"
      class="graph-btn graph-btn--global"
      @click="handleGlobal"
      title="查看全局图谱"
    >
      <svg class="svg-icon lucide-git-fork" fill="none" height="20" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" viewBox="0 0 24 24" width="20" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="18" r="3"></circle>
        <circle cx="6" cy="6" r="3"></circle>
        <circle cx="18" cy="6" r="3"></circle>
        <path d="M18 9v2c0 .6-.4 1-1 1H7c-.6 0-1-.4-1-1V9"></path>
        <path d="M12 12v3"></path>
      </svg>
    </button>

    <!-- 全屏按钮 -->
    <button
      class="graph-btn graph-btn--fullscreen"
      @click="handleFullscreen"
      title="全屏显示"
    >
      <svg fill="none" height="20" stroke-width="1.5" viewBox="0 0 24 24" width="20" xmlns="http://www.w3.org/2000/svg">
        <path d="M6.00005 19L19 5.99996M19 5.99996V18.48M19 5.99996H6.52005" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </button>

    <!-- 关闭按钮 -->
    <button
      class="graph-btn graph-btn--close"
      @click="handleClose"
      title="关闭全屏"
    >
      <svg fill="none" height="20" stroke-width="1.5" viewBox="0 0 24 24" width="20" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M15 16L9 8" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M9 16L15 8" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </button>
  </div>
</template>

<style scoped>
.graph-buttons {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 1000;
  display: flex;
  gap: 6px;
  align-items: center;
  padding: 6px;
  border-radius: 8px;
  background: rgba(var(--vp-c-bg), 0.9);
  backdrop-filter: blur(8px);
  border: 1px solid var(--vp-c-border);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  
  /* 默认隐藏 */
  opacity: 0;
  transform: translateY(-10px) scale(0.95);
  pointer-events: none;
}

/* 当父容器悬停时显示按钮 */
.relationship-map__container:hover .graph-buttons,
.relationship-map-fullscreen__container .graph-buttons {
  opacity: 1;
  transform: translateY(0) scale(1);
  pointer-events: auto;
}

/* 按钮悬停时保持显示 */
.graph-buttons:hover {
  opacity: 1 !important;
  transform: translateY(0) scale(1) !important;
  pointer-events: auto !important;
}

.graph-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  padding: 0;
  cursor: pointer;
  transition: all 0.2s ease;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  color: var(--vp-c-text-2);
  opacity: 0.8;
}

.graph-btn:hover {
  transform: translateY(-2px) scale(1.05);
  border-color: var(--vp-c-border);
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-1);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
  opacity: 1;
}

.graph-btn:active {
  transform: translateY(0) scale(1);
}

.graph-btn svg {
  width: 18px;
  height: 18px;
  transition: all 0.2s ease;
}

/* 特定按钮样式 */
.graph-btn--reload:hover {
  color: var(--vp-c-green);
  border-color: var(--vp-c-green);
}

.graph-btn--global:hover {
  color: var(--vp-c-blue);
  border-color: var(--vp-c-blue);
}

.graph-btn--fullscreen:hover {
  color: var(--vp-c-brand);
  border-color: var(--vp-c-brand);
}

.graph-btn--close:hover {
  color: var(--vp-c-red);
  border-color: var(--vp-c-red);
}

/* 响应式调整 */
@media (max-width: 768px) {
  .graph-buttons {
    top: 8px;
    right: 8px;
    gap: 4px;
    padding: 4px;
  }
  
  .graph-btn {
    width: 32px;
    height: 32px;
  }
  
  .graph-btn svg {
    width: 16px;
    height: 16px;
  }
  
  /* 移动端触摸设备优化 */
  .relationship-map__container .graph-buttons {
    opacity: 0.3; /* 移动端不完全隐藏，保持可点击性 */
    transform: scale(0.9);
  }
}

/* 暗色主题优化 */
@media (prefers-color-scheme: dark) {
  .graph-buttons {
    background: rgba(var(--vp-c-bg), 0.95);
    border-color: var(--vp-c-border);
  }
  
  .graph-btn:hover {
    background: rgba(var(--vp-c-bg-soft), 0.8);
  }
}

/* 动画关键帧 */
@keyframes buttonSlideIn {
  from {
    opacity: 0;
    transform: translateY(-20px) scale(0.8);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.graph-buttons {
  animation: buttonSlideIn 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards;
}

/* 确保按钮在容器内正确显示 */
.relationship-map__container .graph-buttons,
.relationship-map-fullscreen__container .graph-buttons {
  position: absolute;
  top: 12px;
  right: 12px;
}

/* 防止按钮被画布覆盖 */
.relationship-map__container,
.relationship-map-fullscreen__container {
  position: relative;
  z-index: 1;
}

.relationship-map__container canvas,
.relationship-map-fullscreen__container canvas {
  z-index: 0;
}
</style>