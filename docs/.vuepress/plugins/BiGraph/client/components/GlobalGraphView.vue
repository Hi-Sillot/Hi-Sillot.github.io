<!-- components/GlobalGraphView.vue -->
<script setup lang="ts">
import { ref, computed, nextTick, onMounted, onUnmounted, watch } from "vue";
import type { CanvasSize, MapLink, MapNodeLink, Node } from "../../types";
import { useRouter } from "vuepress/client";
import RelationGraph from "./RelationGraphCanvas.vue";
import { debug } from "../../utils/debug";
import { useBioChainStore } from "../../stores/bioChain";


const TAG = "GlobalGraphView";

// Store 和 Router
const bioStore = useBioChainStore();
const router = useRouter();

debug.log(TAG, "组件初始化开始", {
  hasBioStore: !!bioStore,
  hasRouter: !!router,
  初始显示状态: bioStore.showGlobalGraph,
  显示节点标签: bioStore.showLabels
});

// Refs
const containerRef = ref<HTMLElement | null>(null);
const graphRef = ref<InstanceType<typeof RelationGraph> | null>(null);
const canvasSize = ref({ width: 800, height: 600 });

// 响应式数据
const isLoading = ref(false);
const hasError = ref(false);
const errorMessage = ref<string | null>(null);


// 计算属性 - 修复：确保 graphData 总是有默认值
const showGlobalGraph = computed(() => bioStore.showGlobalGraph);
const graphData = computed(() => bioStore.globalGraphData || { nodes: [], links: [] });
const isGraphLoading = computed(() => bioStore.isGlobalGraphLoading);
const graphStats = computed(() => {
  const data = graphData.value || { nodes: [], links: [] };
  return {
    nodeCount: data.nodes?.length || 0,
    linkCount: data.links?.length || 0,
    isolatedCount: data.nodes?.filter((n: any) => n.isIsolated)?.length || 0,
    isEmpty: !data.nodes || data.nodes.length === 0
  };
});

debug.log(TAG, "计算属性初始化完成", {
  showGlobalGraph: showGlobalGraph.value,
  hasGraphData: !!bioStore.globalGraphData,
  graphDataNodes: graphStats.value.nodeCount,
  isGraphLoading: isGraphLoading.value
});

// 节点模态窗口相关状态
const nodeModalVisible = ref(false);
const selectedNode = ref<Node | null>(null);
const iframeLoading = ref(false);

/**
 * 处理节点点击 - 打开模态窗口
 */
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

/**
 * 关闭节点模态窗口
 */
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

/**
 * 重新加载数据
 */
const handleReload = async (): Promise<void> => {
  debug.log(TAG, "手动重新加载全局图谱数据");
  try {
    await bioStore.reloadGlobalGraphData();
  } catch (error) {
    debug.error(TAG, "重新加载数据失败", error);
  }
};

/**
 * 更新画布尺寸
 */
const updateCanvasSize = (): void => {
  if (containerRef.value) {
    const rect = containerRef.value.getBoundingClientRect();
    canvasSize.value = {
      width: Math.max(100, Math.floor(rect.width)),
      height: Math.max(100, Math.floor(rect.height))
    };
    
    debug.log(TAG, "画布尺寸更新", canvasSize.value);
    
  }
};

/**
 * 切换节点标签显示状态
 */
const toggleLabels = (): void => {
  bioStore.showLabels = !bioStore.showLabels;
  debug.log(TAG, "切换节点标签显示", { 显示标签: bioStore.showLabels });
};

// 监听器
let resizeObserver: ResizeObserver | null = null;

// 监听显示状态变化
watch(showGlobalGraph, async (newValue, oldValue) => {
  debug.log(TAG, "显示状态变化", { 
    之前: oldValue, 
    现在: newValue 
  });
  
  if (newValue) {
    // 显示全局图谱时加载数据
    debug.log(TAG, "显示全局图谱，开始加载数据");
    isLoading.value = true;
    hasError.value = false;
    errorMessage.value = null;
    
    try {
      await bioStore.loadGlobalGraphData();
      
      // 检查数据是否有效
      if (graphStats.value.nodeCount === 0) {
        debug.warn(TAG, "加载的全局图谱数据为空");
      }
      
      // 数据加载完成后更新UI
      nextTick(() => {
        updateCanvasSize();
      });
      
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "加载失败";
      hasError.value = true;
      errorMessage.value = errorMsg;
      debug.error(TAG, "显示全局图谱时加载数据失败", error);
    } finally {
      isLoading.value = false;
      debug.log(TAG, "全局图谱数据显示处理完成", {
        成功: !hasError.value,
        错误: errorMessage.value,
        节点数: graphStats.value.nodeCount
      });
    }
  } else {
    // 隐藏全局图谱时的清理工作
    debug.log(TAG, "隐藏全局图谱，执行清理工作");
  }
});

// 监听数据变化
watch(graphData, (newData, oldData) => {
  debug.log(TAG, "图谱数据变化", {
    旧节点数: oldData?.nodes?.length || 0,
    新节点数: newData?.nodes?.length || 0,
    旧链接数: oldData?.links?.length || 0,
    新链接数: newData?.links?.length || 0
  });
  
  if (newData && newData.nodes && newData.nodes.length > 0) {
    nextTick(() => {
      updateCanvasSize();
    });
  }
});

// 监听加载状态
watch(isGraphLoading, (newLoading, oldLoading) => {
  debug.log(TAG, "加载状态变化", { 
    之前: oldLoading, 
    现在: newLoading 
  });
});

// 生命周期
onMounted(() => {
  debug.log(TAG, "组件挂载", bioStore.globalGraphData);
  
  // 重要修复：确保组件挂载时不会自动显示
  if (showGlobalGraph.value === true) {
    debug.warn(TAG, "组件挂载时发现全局图谱已显示，正在重置状态");
    bioStore.hideGlobalGraphModal();
  }
  
  // 设置 ResizeObserver 监听容器尺寸变化
  resizeObserver = new ResizeObserver(() => {
    updateCanvasSize();
  });
  
  if (containerRef.value) {
    resizeObserver.observe(containerRef.value);
    debug.log(TAG, "ResizeObserver 已监听容器");
  }
  
  // 初始更新尺寸
  updateCanvasSize();
});

onUnmounted(() => {
  debug.log(TAG, "组件卸载");
  
  if (resizeObserver) {
    resizeObserver.disconnect();
    debug.log(TAG, "ResizeObserver 已断开");
  }
  // 清理节点模态窗口状态
  closeNodeModal();
});

debug.log(TAG, "组件初始化完成");
</script>

<template>
  <!-- 全局图谱遮罩层 -->
  <div
    v-if="showGlobalGraph"
    class="global-graph-mask"
    @click.self="handleClose"
  >
    <div
      ref="containerRef"
      class="global-graph-container"
    >
      <!-- 关闭按钮 - 修复：确保事件绑定正确 -->
      <button class="global-graph-close" @click="handleClose" title="关闭全局图谱">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M18 6L6 18M6 6l12 12" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </button>

      <!-- 加载状态 -->
      <div v-if="isGraphLoading || isLoading" class="global-graph-loading">
        <div class="loading-spinner"></div>
        <p>加载全局图谱中...</p>
        <div class="loading-details" v-if="graphStats.nodeCount > 0">
          <p>已加载节点: {{ graphStats.nodeCount }}</p>
          <p>已加载链接: {{ graphStats.linkCount }}</p>
        </div>
      </div>

      <!-- 错误状态 -->
      <div v-else-if="hasError || bioStore.globalGraphError" class="global-graph-error">
        <div class="error-icon">⚠️</div>
        <p class="error-title">全局图谱加载失败</p>
        <p class="error-message">{{ errorMessage || bioStore.globalGraphError }}</p>
        <button @click="handleReload" class="retry-button">重新加载</button>
      </div>

      <!-- 空数据状态 -->
      <div v-else-if="graphStats.isEmpty" class="global-graph-empty">
        <div class="empty-icon">📊</div>
        <p class="empty-title">暂无全局图谱数据</p>
        <p class="empty-message">可能是数据尚未生成或生成过程中出现错误</p>
        <button @click="handleReload" class="retry-button">重新加载</button>
      </div>

      <!-- 正常状态 -->
      <div v-else class="global-graph-content">
        <!-- 图谱信息栏 -->
        <div class="graph-info-panel">
          <div class="graph-stats">
            <span class="stat-item">节点: {{ graphStats.nodeCount }}</span>
            <span class="stat-item">链接: {{ graphStats.linkCount }}</span>
            <span class="stat-item"> 
              孤立节点: {{ graphStats.isolatedCount }}
            </span>
          </div>
          <div class="graph-actions">
            <!-- 新增：标签显示切换按钮 -->
            <button 
              @click="toggleLabels" 
              class="action-button" 
              :title="bioStore.showLabels ? '隐藏节点标签' : '显示节点标签'"
              :class="{ 'active': bioStore.showLabels }"
            >
              {{ bioStore.showLabels ? '🏷️' : '🔲' }}
            </button>
            <button @click="handleReload" class="action-button" title="重新加载数据">
              🔄
            </button>
          </div>
        </div>

        <!-- 关系图谱组件 - 修改：使用节点模态窗口 -->
        <RelationGraph
          ref="graphRef"
          :key="'global-graph-' + canvasSize.width + '-' + canvasSize.height"
          :canvas-height="canvasSize.height"
          :canvas-width="canvasSize.width"
          :current-path="router.currentRoute.value.path"
          :data="graphData"
          :show-labels="bioStore.showLabels"
          @node-click="handleNodeClickModal"
        />
      </div>
    </div>
  </div>

  <!-- 节点详情模态窗口 -->
  <div
    v-if="nodeModalVisible && showGlobalGraph"
    class="global-node-modal"
    @click.self="closeNodeModal"
  >
    <div class="global-node-modal__content">
      <!-- 模态窗口头部 -->
      <div class="global-node-modal__header">
        <h3 class="global-node-modal__title">
          {{ selectedNode?.value.title || selectedNode?.id }}
        </h3>
        <div class="global-node-modal__actions">
          <button
            v-if="selectedNode"
            @click="openNodeInPage"
            class="global-node-modal__action-btn"
            title="在新页面中打开"
          >
            📄 当前页面跳转
          </button>
          <button
            @click="closeNodeModal"
            class="global-node-modal__close-btn"
            title="关闭"
          >
            ✕
          </button>
        </div>
      </div>

      <!-- 节点信息 -->
      <div class="global-node-modal__info">
        <div class="global-node-info__item">
          <span class="global-node-info__label">路径:</span>
          <span class="global-node-info__value">{{ selectedNode?.id }}</span>
        </div>
        <div v-if="selectedNode?.linkCount !== undefined" class="global-node-info__item">
          <span class="global-node-info__label">连接数:</span>
          <span class="global-node-info__value">{{ selectedNode.linkCount }}</span>
        </div>
        <div class="global-node-info__item">
          <span class="global-node-info__label">状态:</span>
          <span
            class="global-node-info__badge"
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
      <div class="global-node-modal__iframe-container">
        <div v-if="iframeLoading" class="global-node-modal__loading">
          <div class="loading-spinner"></div>
          <p>加载页面中...</p>
        </div>
        <iframe
          v-if="selectedNode"
          :src="selectedNode.id"
          :key="selectedNode.id"
          @load="iframeLoading = false"
          @error="iframeLoading = false"
          class="global-node-modal__iframe"
          frameborder="0"
          allowfullscreen
        ></iframe>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 新增：激活状态的按钮样式 */
.action-button.active {
  background: var(--vp-c-brand-soft);
  border-color: var(--vp-c-brand);
  color: var(--vp-c-brand);
}

/* 样式保持不变，与之前相同 */
.global-graph-mask {
  position: fixed;
  z-index: 10000;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.global-graph-container {
  position: relative;
  width: 95vw;
  height: 95vh;
  max-width: 1400px;
  max-height: 900px;
  background: var(--vp-c-bg);
  border-radius: 12px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  overflow: hidden;
  animation: scaleIn 0.3s ease;
}

@keyframes scaleIn {
  from { 
    opacity: 0;
    transform: scale(0.9);
  }
  to { 
    opacity: 1;
    transform: scale(1);
  }
}

.global-graph-close {
  position: absolute;
  z-index: 10;
  top: 16px;
  right: 16px;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-border);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  color: var(--vp-c-text-1);
}

.global-graph-close:hover {
  background: var(--vp-c-bg-soft);
  transform: scale(1.05);
  border-color: var(--vp-c-brand);
}

.global-graph-content {
  width: 100%;
  height: 100%;
  position: relative;
}

.graph-info-panel {
  position: absolute;
  top: 16px;
  left: 16px;
  z-index: 5;
  background: rgba(var(--vp-c-bg-soft), 0.9);
  backdrop-filter: blur(10px);
  border: 1px solid var(--vp-c-border);
  border-radius: 8px;
  padding: 12px 16px;
  display: flex;
  align-items: center;
  gap: 16px;
  font-size: 14px;
}

.graph-stats {
  display: flex;
  gap: 16px;
  color: var(--vp-c-text-2);
}

.stat-item {
  font-weight: 500;
}

.graph-actions {
  display: flex;
  gap: 8px;
}

.action-button {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--vp-c-bg);
  border: 1px solid var(--vp-c-border);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 14px;
}

.action-button:hover {
  background: var(--vp-c-bg-soft);
  border-color: var(--vp-c-brand);
}

/* 加载状态样式 */
.global-graph-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--vp-c-text-2);
  gap: 16px;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid transparent;
  border-top: 3px solid var(--vp-c-brand);
  border-right: 3px solid var(--vp-c-brand);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.loading-details {
  text-align: center;
  font-size: 12px;
  color: var(--vp-c-text-3);
}

/* 错误状态样式 */
.global-graph-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--vp-c-red);
  gap: 16px;
  text-align: center;
  padding: 40px;
}

.error-icon {
  font-size: 48px;
  margin-bottom: 8px;
}

.error-title {
  font-size: 18px;
  font-weight: 600;
  margin: 0;
}

.error-message {
  color: var(--vp-c-text-2);
  margin: 0;
  max-width: 400px;
  line-height: 1.5;
}

/* 空状态样式 */
.global-graph-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--vp-c-text-3);
  gap: 16px;
  text-align: center;
  padding: 40px;
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 8px;
}

.empty-title {
  font-size: 18px;
  font-weight: 600;
  margin: 0;
}

.empty-message {
  margin: 0;
  max-width: 400px;
  line-height: 1.5;
}

/* 重试按钮 */
.retry-button {
  padding: 8px 16px;
  background: var(--vp-c-brand);
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  transition: background-color 0.2s;
  margin-top: 8px;
}

.retry-button:hover {
  background: var(--vp-c-brand-dark);
}

/* 响应式设计 */
@media (max-width: 768px) {
  .global-graph-container {
    width: 100vw;
    height: 100vh;
    border-radius: 0;
    max-width: none;
    max-height: none;
  }
  
  .graph-info-panel {
    top: 8px;
    left: 8px;
    right: 8px;
    flex-direction: column;
    gap: 8px;
  }
  
  .graph-stats {
    justify-content: space-around;
    width: 100%;
  }
}


/* 节点模态窗口样式 */
.global-node-modal {
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

.global-node-modal__content {
  background: var(--vp-c-bg);
  border-radius: 12px;
  width: 90vw;
  height: 90vh;
  max-width: 1200px;
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

.global-node-modal__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid var(--vp-c-border);
  background: var(--vp-c-bg-soft);
  border-radius: 12px 12px 0 0;
}

.global-node-modal__title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--vp-c-text-1);
  max-width: 60%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.global-node-modal__actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.global-node-modal__action-btn {
  padding: 6px 12px;
  background: var(--vp-button-alt-bg);
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.global-node-modal__action-btn:hover {
  background: var(--vp-button-alt-active-bg);
}

.global-node-modal__close-btn {
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

.global-node-modal__close-btn:hover {
  background: var(--vp-c-red-soft);
  border-color: var(--vp-c-red);
  color: var(--vp-c-red);
}

.global-node-modal__info {
  padding: 16px 24px;
  background: var(--vp-c-bg-soft);
  border-bottom: 1px solid var(--vp-c-border);
}

.global-node-info__item {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
}

.global-node-info__item:last-child {
  margin-bottom: 0;
}

.global-node-info__label {
  font-weight: 500;
  color: var(--vp-c-text-2);
  min-width: 60px;
  font-size: 12px;
}

.global-node-info__value {
  color: var(--vp-c-text-1);
  font-size: 12px;
  word-break: break-all;
}

.global-node-info__badge {
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
}

.global-node-info__badge.current {
  background: var(--vp-c-green-soft);
  color: var(--vp-c-green);
}

.global-node-info__badge.isolated {
  background: var(--vp-c-yellow-soft);
  color: var(--vp-c-yellow);
}

.global-node-info__badge:not(.current):not(.isolated) {
  background: var(--vp-c-gray-soft);
  color: var(--vp-c-text-2);
}

.global-node-modal__iframe-container {
  flex: 1;
  position: relative;
  min-height: 0; /* 重要：允许iframe容器收缩 */
}

.global-node-modal__loading {
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

.global-node-modal__iframe {
  width: 100%;
  height: 100%;
  border: none;
  border-radius: 0 0 12px 12px;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .global-node-modal__content {
    width: 95vw;
    height: 95vh;
    margin: 10px;
  }
  
  .global-node-modal__header {
    padding: 16px;
    flex-direction: column;
    gap: 12px;
    align-items: stretch;
  }
  
  .global-node-modal__title {
    max-width: 100%;
    text-align: center;
  }
  
  .global-node-modal__info {
    padding: 12px 16px;
  }
}
</style>