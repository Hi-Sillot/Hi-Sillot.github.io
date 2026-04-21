<!-- components/LocalGraphView.vue -->
<script setup lang="ts">
import { ref, nextTick, onMounted, onUnmounted, watch } from "vue";
import type { CanvasSize, MapLink, MapNodeLink, Node } from "../../types";
import { useRouter } from "vuepress/client";
import RelationGraph from "./RelationGraphCanvas.vue";
import GraphButtons from "./GraphButtons.vue";
import ToggleButton from "./ToggleButton.vue";
import { useGraphData } from "../composables/useGraphData";
import { useGraphOptions } from "../composables/useGraphOptions";
import { useScreenSize } from "../composables/useScreenSize";
import { useContainerSize } from "../composables/useContainerSize";
import { useFullscreen } from "../composables/useFullscreen";
import { useBioChainStore } from "../../stores/bioChain";
import { debug } from "../../utils/debug";

let TAG = "LocalGraphView.vue"
// 日志计数器
let logCounter = 0;
function log(step: string, data?: any) {
  console.log(`[${TAG}] ${++logCounter}. [RelationshipMap] ${step}`, data ? data : '');
}

// Store
const bioStore = useBioChainStore();
const router = useRouter();
log("Store 和 Router 初始化完成", { 
  hasBioStore: !!bioStore, 
  hasRouter: !!router 
});

// Refs
const containerRef = ref<HTMLElement | null>(null);
const fullscreenContainerRef = ref<HTMLElement | null>(null);
const graphRef = ref<InstanceType<typeof RelationGraph> | null>(null);
const fullscreenGraphRef = ref<InstanceType<typeof RelationGraph> | null>(null);

// Composables
const isLoading = ref(false);
const { mapData, error, handleNodeClick, shouldFoldEmptyGraph, reloadData } = useGraphData();
const { options } = useGraphOptions();
const { screenState, toggleExpand, forceUpdateContainerWidth } = useScreenSize();
const { canvasSize } = useContainerSize(containerRef, screenState, options);
const { fullscreenState, toggleFullscreen } = useFullscreen(fullscreenContainerRef, ref(null));

// 添加模态窗口相关状态
const nodeModalVisible = ref(false);
const selectedNode = ref<Node | null>(null);
const iframeLoading = ref(false);

log("Composables 初始化完成", {
  mapData: mapData.value,
  canvasSize: canvasSize.value,
  fullscreenState: fullscreenState.value
});

// 响应式数据
let resizeObserver: ResizeObserver | null = null;
let isMounted = ref(false);

// 节点点击处理 - 打开模态窗口
const handleNodeClickModal = (node: Node): void => {
  debug.log(TAG, "打开节点模态窗口", { 
    节点ID: node.id,
    节点标题: node.value.title
  });
  
  try {
    selectedNode.value = node;
    nodeModalVisible.value = true;
    iframeLoading.value = true;
    debug.log(TAG, "节点模态窗口已打开");
  } catch (error) {
    debug.error(TAG, "打开节点模态窗口失败", error);
  }
};

// 关闭模态窗口
const closeNodeModal = (): void => {
  debug.log(TAG, "关闭节点模态窗口");
  nodeModalVisible.value = false;
  selectedNode.value = null;
  iframeLoading.value = false;
};

/**
 * 在模态窗口中打开页面（路由跳转）
 */
const openNodeInPage = (): void => {
  if (selectedNode.value) {
    debug.log(TAG, "在页面中打开节点", { 
      节点ID: selectedNode.value.id,
      当前路径: router.currentRoute.value.path
    });
    
    try {
      if (selectedNode.value.id && selectedNode.value.id !== router.currentRoute.value.path) {
        router.push(selectedNode.value.id);
        closeNodeModal();
        // 同时关闭全局图谱
        handleClose();
        debug.log(TAG, "页面跳转完成，已关闭模态窗口和全局图谱");
      }
    } catch (error) {
      debug.error(TAG, "页面跳转失败", error);
    }
  }
};

/**
 * 关闭全局图谱 - 修复：使用正确的方法
 */
const handleClose = (): void => {
  debug.log(TAG, "手动关闭全局图谱");
  bioStore.hideGlobalGraphModal();
  // 同时关闭节点模态窗口
  closeNodeModal();
};


// 安全的切换全屏
const safeToggleFullscreen = (): void => {
  log("切换全屏开始", { 
    currentState: fullscreenState.value.isFullscreen,
    hasContainer: !!fullscreenContainerRef.value 
  });
  
  try {
    toggleFullscreen();
    log("切换全屏完成", { 
      newState: fullscreenState.value.isFullscreen 
    });
    
  } catch (error) {
    console.error("切换全屏时出错:", error);
  }
};

// 安全的切换展开状态
const safeToggleExpand = (): void => {
  log("切换展开状态开始", { 
    currentState: screenState.value.isExpanded,
    isLargeScreen: screenState.value.isLargeScreen 
  });
  
  try {
    toggleExpand();
    log("切换展开状态完成", { 
      newState: screenState.value.isExpanded 
    });
    
  } catch (error) {
    console.error("切换展开状态时出错:", error);
  }
};

// 重新加载数据
const handleReload = (): void => {
  log("手动重新加载数据");
  reloadData();
};

// 监听数据加载状态
watch(isLoading, async (newLoading, oldLoading) => {
  log("数据加载状态变化", { 之前: oldLoading, 现在: newLoading });
  
});

// 监听数据变化
watch(mapData, (newData, oldData) => {
  log("图谱数据变化", {
    旧节点数: oldData?.nodes?.length || 0,
    新节点数: newData?.nodes?.length || 0,
    旧链接数: oldData?.links?.length || 0,
    新链接数: newData?.links?.length || 0
  });
}, { deep: true });

// 生命周期
onMounted(() => {
  log("onMounted 开始执行");
  isMounted.value = true;

  try {
    resizeObserver = new ResizeObserver((entries) => {
      log("容器尺寸变化", { 
        entryCount: entries.length,
        isFullscreen: fullscreenState.value.isFullscreen 
      });
      
      for (const entry of entries) {
        if (entry.target === containerRef.value) {
          log("主容器尺寸变化", {
            width: entry.contentRect.width,
            height: entry.contentRect.height
          });
        } else if (entry.target === fullscreenContainerRef.value) {
          log("全屏容器尺寸变化", {
            width: entry.contentRect.width,
            height: entry.contentRect.height
          });
        }
      }
    });

    if (containerRef.value) {
      resizeObserver.observe(containerRef.value);
      log("主容器 ResizeObserver 已监听");
    } else {
      console.warn("主容器引用为空，无法监听尺寸变化");
    }

    log("onMounted 执行完成");
  } catch (error) {
    console.error("onMounted 执行出错:", error);
  }
});

onUnmounted(() => {
  log("onUnmounted 开始执行");
  isMounted.value = false;

  try {
    if (resizeObserver) {
      resizeObserver.disconnect();
      log("ResizeObserver 已断开");
    } else {
      console.warn("ResizeObserver 为 null，无需断开");
    }
    
    log("组件卸载完成");
  } catch (error) {
    console.error("onUnmounted 执行出错:", error);
  }
});

log(`${TAG} 组件初始化完成`);
</script>

<template>
  <!-- 主容器，显示在文章右侧 -->
  <div v-if="shouldFoldEmptyGraph" class="relationship-map">

    <!-- 切换按钮 -->
    <ToggleButton
      v-if="screenState.isLargeScreen"
      :is-expanded="screenState.isExpanded"
      @toggle="safeToggleExpand"
    />

    <!-- 图谱容器 -->
    <div
    v-if="screenState.isLargeScreen && screenState.isExpanded"
      ref="containerRef"
      :class="{
        'relationship-map__container--expanded': screenState.isExpanded,
        'relationship-map__container--loading': isLoading,
        'relationship-map__container--error': error
      }"
      :style="
        screenState.isLargeScreen
          ? {
              width: screenState.containerWidth + 'px',
              height: options.graphSize.height + 'px',
            }
          : {}
      "
      class="relationship-map__container"
    >
      <!-- 加载状态 -->
      <div v-if="isLoading" class="relationship-map__loading">
        <div class="relationship-map__spinner"></div>
        <p>加载关系中...</p>
        <button v-if="error" @click="handleReload" class="relationship-map__retry-btn">
          重试
        </button>
      </div>

      <!-- 错误状态 -->
      <div v-else-if="error" class="relationship-map__error">
        <p>{{ error }}</p>
        <button @click="handleReload" class="relationship-map__retry-btn">
          重新加载
        </button>
      </div>

      <!-- 空数据状态 -->
      <div v-else-if="!mapData || !mapData.nodes || mapData.nodes.length === 0" class="relationship-map__empty">
        <p>暂无关系数据</p>
        <button @click="handleReload" class="relationship-map__retry-btn">
          重新加载
        </button>
        <!-- 功能按钮 -->
        <GraphButtons
          :enable-global-graph="options.enableGlobalGraph"
          @fullscreen="safeToggleFullscreen"
          @global="bioStore.showGlobalGraph = true"
          @close="fullscreenState.isFullscreen = false"
          @reload="handleReload"
        />
      </div>

      <!-- 正常状态 -->
      <template v-else>
        <!-- 功能按钮 -->
        <GraphButtons
          :enable-global-graph="options.enableGlobalGraph"
          @fullscreen="safeToggleFullscreen"
          @global="bioStore.showGlobalGraph = true"
          @close="fullscreenState.isFullscreen = false"
          @reload="handleReload"
        />

        <!-- 关系图谱组件 - 修改事件处理 -->
        <RelationGraph
          ref="graphRef"
          :key="'normal-' + canvasSize.width + '-' + canvasSize.height"
          :canvas-height="canvasSize.height"
          :canvas-width="canvasSize.width"
          :current-path="router.currentRoute.value.path"
          :data="mapData"
          @node-click="handleNodeClickModal"
        />
      </template>
    </div>
  </div>

  <!-- 空图状态 -->
  <div v-else class="relationship-map__empty-global">
    <p>暂无关系数据可显示</p>
    <button v-if="error" @click="handleReload" class="relationship-map__retry-btn">
      重新加载
    </button>
  </div>

  <!-- 全屏模式 -->
  <div
    v-if="fullscreenState.isFullscreen"
    class="relationship-map-fullscreen"
    @click.self="fullscreenState.isFullscreen = false"
  >
    <div
      ref="fullscreenContainerRef"
      class="relationship-map-fullscreen__container"
    >
      <!-- 全屏模式功能按钮 -->
      <GraphButtons
        :enable-global-graph="options.enableGlobalGraph"
        @fullscreen="safeToggleFullscreen"
        @global="bioStore.showGlobalGraph = true"
        @close="fullscreenState.isFullscreen = false"
        @reload="handleReload"
      />

      <!-- 全屏关系图谱组件 - 修改事件处理 -->
      <RelationGraph
        v-if="mapData && mapData.nodes && mapData.nodes.length > 0"
        ref="fullscreenGraphRef"
        :key="'fullscreen-' + fullscreenState.canvasSize.width + '-' + fullscreenState.canvasSize.height"
        :canvas-height="fullscreenState.canvasSize.height"
        :canvas-width="fullscreenState.canvasSize.width"
        :current-path="router.currentRoute.value.path"
        :data="mapData"
        @node-click="handleNodeClickModal"
      />
      
      <div v-else class="relationship-map-fullscreen__loading">
        <div v-if="isLoading" class="relationship-map__spinner"></div>
        <p>{{ isLoading ? '加载关系中...' : '暂无关系数据' }}</p>
        <button v-if="error" @click="handleReload" class="relationship-map__retry-btn">
          重新加载
        </button>
      </div>
    </div>
  </div>

  <!-- 节点详情模态窗口 -->
  <div
    v-if="nodeModalVisible"
    class="node-modal"
    @click.self="closeNodeModal"
  >
    <div class="node-modal__content">
      <!-- 模态窗口头部 -->
      <div class="node-modal__header">
        <h3 class="node-modal__title">
          {{ selectedNode?.value.title || selectedNode?.id }}
        </h3>
        <div class="node-modal__actions">
          <button
            v-if="selectedNode"
            @click="openNodeInPage"
            class="node-modal__action-btn"
            title="在新页面中打开"
          >
            📄 当前页面跳转
          </button>
          <button
            @click="closeNodeModal"
            class="node-modal__close-btn"
            title="关闭"
          >
            ✕
          </button>
        </div>
      </div>

      <!-- 节点信息 -->
      <div class="node-modal__info">
        <div class="node-info__item">
          <span class="node-info__label">路径:</span>
          <span class="node-info__value">{{ selectedNode?.id }}</span>
        </div>
        <div v-if="selectedNode?.linkCount !== undefined" class="node-info__item">
          <span class="node-info__label">连接数:</span>
          <span class="node-info__value">{{ selectedNode.linkCount }}</span>
        </div>
        <div class="node-info__item">
          <span class="node-info__label">状态:</span>
          <span
            class="node-info__badge"
            :class="{
              'current': selectedNode?.isCurrent,
              'isolated': selectedNode?.isIsolated
            }"
          >
            {{ selectedNode?.isCurrent ? '当前页面' : selectedNode?.isIsolated ? '孤立节点' : '普通节点' }}
          </span>
        </div>
      </div>

      <!-- iframe 内容 -->
      <div class="node-modal__iframe-container">
        <div v-if="iframeLoading" class="node-modal__loading">
          <div class="loading-spinner"></div>
          <p>加载页面中...</p>
        </div>
        <iframe
          v-if="selectedNode"
          :src="selectedNode.id"
          :key="selectedNode.id"
          @load="iframeLoading = false"
          @error="iframeLoading = false"
          class="node-modal__iframe"
          frameborder="0"
          allowfullscreen
        ></iframe>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 基础样式 */
.relationship-map {
  width: 100%;
  position: relative;
}

.relationship-map__debug {
  font-size: 10px;
  color: #666;
  background: #f0f0f0;
  padding: 4px 8px;
  border-radius: 4px;
  margin-bottom: 8px;
  font-family: monospace;
}

/* 加载状态样式 */
.relationship-map__loading,
.relationship-map-fullscreen__loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--vp-c-text-2);
  gap: 12px;
}

.relationship-map__spinner {
  width: 24px;
  height: 24px;
  border: 2px solid var(--vp-c-border);
  border-top: 2px solid var(--vp-c-brand);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* 错误状态样式 */
.relationship-map__error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--vp-c-red);
  gap: 12px;
  text-align: center;
}

/* 空状态样式 */
.relationship-map__empty,
.relationship-map__empty-global {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  color: var(--vp-c-text-2);
  gap: 12px;
  text-align: center;
}

.relationship-map__empty-global {
  min-height: 200px;
}

/* 重试按钮样式 */
.relationship-map__retry-btn {
  padding: 6px 12px;
  background: var(--vp-c-brand);
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  transition: background-color 0.3s;
}

.relationship-map__retry-btn:hover {
  background: var(--vp-c-brand-dark);
}

/* 图谱容器样式 */
.relationship-map__container {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
  border: 1px solid var(--vp-c-border);
  border-radius: 8px;
  background: var(--vp-c-bg-soft);
  min-height: 200px;
}

.relationship-map__container--loading {
  background: var(--vp-c-bg-soft);
}

.relationship-map__container--error {
  border-color: var(--vp-c-red);
}

/* 全屏模式样式 */
.relationship-map-fullscreen {
  position: fixed;
  z-index: 1000;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
}

.relationship-map-fullscreen__container {
  position: relative;
  z-index: 1001;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 90%;
  height: 90%;
  border-radius: 12px;
  background-color: var(--vp-c-bg);
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
}



  .relationship-map__toggle-btn,
   .relationship-map__container {
    width: 96%;
    border: none !important;
   }

  .relationship-map__btn--fullscreen {
    right: 24px;
  }

  canvas {
    position: relative !important;
  }

.relationship-map__toggle-btn:not(:hover),
.relationship-map:not(:hover) .graph-buttons {
  opacity: 0 !important;
}
.relationship-map:has(.graph-buttons:hover) canvas {
  filter: blur(3.3px);
}

/* 确保全屏模式下按钮始终显示 */
.relationship-map-fullscreen .graph-buttons {
  opacity: 1 !important;
  pointer-events: auto !important;
}

/* 全屏模式容器悬停时保持按钮显示 */
.relationship-map-fullscreen__container:hover .graph-buttons {
  opacity: 1 !important;
}

</style>


/* 全局样式，不受 scoped 限制 */
<style>
.vp-content:has(.relationship-map-fullscreen) {
  z-index: 9999 !important;
}
.vp-content:has(.relationship-map-fullscreen) .graph-btn--fullscreen {
  display: none;
}
.vp-content:has(.relationship-map-fullscreen) .graph-btn--close {
  display: block;
}
.vp-content:not(:has(.relationship-map-fullscreen)) .graph-btn--fullscreen {
  display: block;
}
.vp-content:not(:has(.relationship-map-fullscreen)) .graph-btn--close {
  display: none;
}
.graph-btn {
  border: none !important;
}
.aside {
  max-width: 260px !important;
}
.aside-container {
  width: 260px !important;
}
 .vp-content.has-sidebar[data-v-aff1f022] {
    padding-right: calc((100vw - var(--vp-layout-max-width)) / 10);
    padding-left: calc((100vw - var(--vp-layout-max-width)) / 10 + var(--vp-sidebar-width));
  }


  /* 节点模态窗口样式 */
.node-modal {
  position: fixed;
  z-index: 10001; /* 确保在全局图谱之上 */
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  animation: modalFadeIn 0.3s ease;
}

@keyframes modalFadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.node-modal__content {
  background: var(--vp-c-bg);
  border-radius: 2px;
  width: 64vw;
  height: calc(86vh - 30px);
  min-width: 650px;
  max-width: 1000px;
  margin-right: -400px;
  margin-top: 30px;
  display: flex;
  flex-direction: column;
  animation: modalScaleIn 0.3s ease;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

@keyframes modalScaleIn {
  from {
    opacity: 0;
    transform: scale(0.9);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.node-modal__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid var(--vp-c-border);
  background: var(--vp-c-bg-soft);
  border-radius: 12px 12px 0 0;
}

.node-modal__title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--vp-c-text-1);
  max-width: 60%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.node-modal__actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.node-modal__action-btn {
  padding: 5px 15px;
  padding-right: 10px;
  background: var(--vp-c-brand);
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.node-modal__action-btn:hover {
  background: var(--vp-c-brand-dark);
}

.node-modal__close-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-border);
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}

.node-modal__close-btn:hover {
  background: var(--vp-c-red-soft);
  border-color: var(--vp-c-red);
  color: var(--vp-c-red);
}

.node-modal__info {
  padding: 16px 24px;
  background: var(--vp-c-bg-soft);
  border-bottom: 1px solid var(--vp-c-border);
}

.node-info__item {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
}

.node-info__item:last-child {
  margin-bottom: 0;
}

.node-info__label {
  font-weight: 500;
  color: var(--vp-c-text-2);
  min-width: 60px;
  font-size: 12px;
}

.node-info__value {
  color: var(--vp-c-text-1);
  font-size: 12px;
  word-break: break-all;
}

.node-info__badge {
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
}

.node-info__badge.current {
  background: var(--vp-c-green-soft);
  color: var(--vp-c-green);
}

.node-info__badge.isolated {
  background: var(--vp-c-yellow-soft);
  color: var(--vp-c-yellow);
}

.node-info__badge:not(.current):not(.isolated) {
  background: var(--vp-c-gray-soft);
  color: var(--vp-c-text-2);
}

.node-modal__iframe-container {
  flex: 1;
  position: relative;
  min-height: 0; /* 重要：允许iframe容器收缩 */
}

.node-modal__loading {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: var(--vp-c-bg-soft);
  z-index: 1;
}

.node-modal__iframe {
  width: 100%;
  height: 100%;
  border: none;
  border-radius: 0 0 12px 12px;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .node-modal__content {
    width: 95vw;
    height: 95vh;
    margin: 10px;
  }
  
  .node-modal__header {
    padding: 16px;
    flex-direction: column;
    gap: 12px;
    align-items: stretch;
  }
  
  .node-modal__title {
    max-width: 100%;
    text-align: center;
  }
  
  .node-modal__info {
    padding: 12px 16px;
  }
}
</style>