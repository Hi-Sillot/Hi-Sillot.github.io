<!-- components/RelationGraphCanvas.vue -->
<script setup lang="ts">
import * as d3 from "d3";
import { computed, onMounted, onUnmounted, ref, watch, nextTick } from "vue";
import type { CanvasSize, MapLink, MapNodeLink, Node } from "../../types";
import { useTheme } from "../composables/useTheme";
import { useSimulation } from "../composables/useSimulation";
import { DrawingManager } from "../composables/useDrawing";
import { EventHandlers } from "../composables/useEventHandlers";
import { PathUtils } from "../../utils/path-utils";
import { CANVAS_CONFIG } from "../../constants";
import { useBioChainStore } from "../../stores/bioChain";
const bioStore = useBioChainStore();
let TAG = "RelationGraph.vue";
// 日志计数器
let logCounter = 0;
function log(step: string, data?: any) {
  console.log(`${TAG} ${++logCounter}. [${step}]`, data ? data : '');
}

// 定义 emit 事件
const emit = defineEmits<{
  (e: "nodeClick", node: Node): void; // 修改：传递整个节点对象
  (e: "nodeHover", node: Node | null): void; // 添加悬停事件
}>();
// const emit = defineEmits<{
//   (e: "nodeClick", path: string): void;
// }>();

const props = defineProps<{
  data: MapNodeLink | null;  // 修改：允许为 null
  currentPath?: string;
  canvasWidth: number;
  canvasHeight: number;
}>();


// 计算属性 - 修复：处理 null 数据
const effectiveData = computed(() => {
  return props.data || { nodes: [], links: [] };
});

// 工具提示相关响应式数据
const tooltipVisible = ref(false);
const tooltipPosition = ref({ x: 0, y: 0 });
const tooltipContent = ref<Node | null>(null);
const tooltipTimeout = ref<NodeJS.Timeout | null>(null);

// 工具提示方法
const showTooltip = (node: Node, x: number, y: number) => {
  if (tooltipTimeout.value) {
    clearTimeout(tooltipTimeout.value);
    tooltipTimeout.value = null;
  }
  
  tooltipContent.value = node;
  tooltipPosition.value = { x, y };
  tooltipVisible.value = true;
};

const hideTooltip = () => {
  tooltipVisible.value = false;
  tooltipContent.value = null;
  
  if (tooltipTimeout.value) {
    clearTimeout(tooltipTimeout.value);
    tooltipTimeout.value = null;
  }
};

const delayedHideTooltip = () => {
  tooltipTimeout.value = setTimeout(() => {
    hideTooltip();
  }, 300);
};

const handleNodeClick = (node: Node) => {
  log("节点点击", { node: node.id, path: node.id });
  emit("nodeClick", node); // 传递整个节点对象
  // emit("nodeClick", node.id);
  hideTooltip();
};

// 在 RelationGraphCanvas.vue 中添加新的工具类
class TooltipEventHandlers {
  private canvas: HTMLCanvasElement;
  private simulation: d3.Simulation<Node, MapLink>;
  private transform: d3.ZoomTransform;
  private nodes: Node[];
  private links: MapLink[];
  private canvasSize: CanvasSize;
  
  // 回调函数
  private showTooltipFn: (node: Node, x: number, y: number) => void;
  private hideTooltipFn: () => void;
  private delayedHideTooltipFn: () => void;
  private handleNodeClickFn: (node: Node) => void;

  constructor(
    canvas: HTMLCanvasElement,
    simulation: d3.Simulation<Node, MapLink>,
    transform: d3.ZoomTransform,
    nodes: Node[],
    links: MapLink[],
    canvasSize: CanvasSize,
    showTooltipFn: (node: Node, x: number, y: number) => void,
    hideTooltipFn: () => void,
    delayedHideTooltipFn: () => void,
    handleNodeClickFn: (node: Node) => void
  ) {
    this.canvas = canvas;
    this.simulation = simulation;
    this.transform = transform;
    this.nodes = nodes;
    this.links = links;
    this.canvasSize = canvasSize;
    this.showTooltipFn = showTooltipFn;
    this.hideTooltipFn = hideTooltipFn;
    this.delayedHideTooltipFn = delayedHideTooltipFn;
    this.handleNodeClickFn = handleNodeClickFn;

    // 绑定事件处理函数
    this.onMouseMove = this.onMouseMove.bind(this);
  }

  onClick(event: MouseEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // 转换坐标到画布空间
    const transformedX = (x - this.transform.x) / this.transform.k;
    const transformedY = (y - this.transform.y) / this.transform.k;

    // 查找点击的节点
    const clickedNode = this.findNodeAt(transformedX, transformedY);
    
    if (clickedNode) {
      this.handleNodeClickFn(clickedNode);
      event.preventDefault();
      return; // 如果点击了节点，不执行其他逻辑
    }
  }

  // 鼠标移动事件处理，用于显示提示
  onMouseMove(event: MouseEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // 转换坐标到画布空间
    const transformedX = (x - this.transform.x) / this.transform.k;
    const transformedY = (y - this.transform.y) / this.transform.k;

    // 查找鼠标下的节点
    const hoveredNode = this.findNodeAt(transformedX, transformedY);
    
    if (hoveredNode) {
      this.showTooltipFn(hoveredNode, event.clientX, event.clientY);
    } else {
      this.delayedHideTooltipFn();
    }
  }

  // 查找指定位置的节点
  private findNodeAt(x: number, y: number, radius: number = 8): Node | null {
    for (const node of this.nodes) {
      if (node.x && node.y)
      {
        const distance = Math.sqrt(Math.pow(node.x - x, 2) + Math.pow(node.y - y, 2));
        if (distance <= radius) {
          return node;
        }
      }
    }
    return null;
  }

  // 缩放事件过滤器
  filterZoomEvent(event: d3.D3ZoomEvent<HTMLCanvasElement, unknown>): boolean {
    return true;
  }

}
// 事件处理
let eventHandlers: TooltipEventHandlers | null = null;

function setupEventListeners(): void {
  log("setupEventListeners 开始", { 
    hasCanvas: !!canvasRef.value, 
    hasSimulation: !!simulation.value 
  });

  if (!canvasRef.value || !simulation.value) return;

  // 创建缩放行为
  const zoom = d3
    .zoom<HTMLCanvasElement, unknown>()
    .scaleExtent(CANVAS_CONFIG.zoomExtent)
    .touchable(true)
    .on("zoom", (event: d3.D3ZoomEvent<HTMLCanvasElement, unknown>) => {
      transform.value = event.transform;
      if (drawingManager) {
        drawingManager.setTransform(transform.value);
      }
      ticked();
    });

  // 设置缩放过滤器
  zoom.filter((event: any) => {
    if (eventHandlers) {
      return eventHandlers.filterZoomEvent(event);
    }
    return true;
  });

  d3.select(canvasRef.value).call(zoom);

  // 创建工具提示事件处理器
  eventHandlers = new TooltipEventHandlers(
    canvasRef.value,
    simulation.value,
    transform.value,
    map_data.value.nodes,
    map_data.value.links,
    canvasSize.value,
    showTooltip,
    hideTooltip,
    delayedHideTooltip,
    handleNodeClick
  );

  // 添加事件监听
  canvasRef.value.addEventListener("click", (e) => eventHandlers!.onClick(e));
  canvasRef.value.addEventListener("mousemove", (e) => eventHandlers!.onMouseMove(e));
  log("事件监听设置完成");
}

log("组件初始化开始", { 
  propsData: props.data, 
  currentPath: props.currentPath,
  canvasSize: { width: props.canvasWidth, height: props.canvasHeight }
});

// 响应式数据
const map_data = ref<MapNodeLink>({ nodes: [], links: [] });
const canvasRef = ref<HTMLCanvasElement | null>(null);
const transform = ref(d3.zoomIdentity);
const hoveredNode = ref<Node | null>(null);
const mouseDownTime = ref(0);
const mouseDownPosition = ref({ x: 0, y: 0 });

log("响应式数据定义完成", { 
  initialMapData: map_data.value,
  hasCanvasRef: !!canvasRef.value
});

// 计算属性
const canvasSize = computed(() => {
  const size = {
    width: props.canvasWidth,
    height: props.canvasHeight,
  };
  log("canvasSize 计算属性", size);
  return size;
});

// 组合式函数
log("开始初始化组合式函数");
const { themeColors, setupThemeObserver } = useTheme();
const { simulation, initializeSimulation, updateForces } = 
  useSimulation(canvasSize.value, map_data.value);
log("组合式函数初始化完成", { 
  hasSimulation: !!simulation.value,
  themeColors: themeColors.value
});

// 数据验证和清理函数
function validateAndCleanData(data: MapNodeLink): MapNodeLink {
  log("开始数据验证和清理", { 
    inputNodes: data.nodes.length, 
    inputLinks: data.links.length 
  });

  const nodeIds = new Set(data.nodes.map(node => node.id));
  log("节点ID集合", Array.from(nodeIds));

  // 过滤无效链接（指向不存在的节点）
  const validLinks = data.links.filter(link => {
    const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
    const targetId = typeof link.target === 'string' ? link.target : link.target.id;
    
    const sourceExists = nodeIds.has(sourceId);
    const targetExists = nodeIds.has(targetId);
    
    if (!sourceExists || !targetExists) {
      console.warn(`无效链接被过滤: 源节点 ${sourceId} 存在=${sourceExists}, 目标节点 ${targetId} 存在=${targetExists}`);
      return false;
    }
    
    return true;
  });

  log("链接过滤完成", { 
    原始链接数: data.links.length,
    有效链接数: validLinks.length,
    被过滤的链接数: data.links.length - validLinks.length
  });

  return {
    nodes: data.nodes,
    links: validLinks
  };
}

// 路径匹配函数（处理VuePress永久链接）
function findMatchingNode(nodes: Node[], path: string): Node | undefined {
  // 直接匹配
  let node = nodes.find(n => n.id === path || n.value.filePathRelative === path);
  if (node) return node;

  // 尝试处理VuePress永久链接：移除扩展名、处理特殊字符等
  const normalizedPath = path
    .replace(/\.md$/, '')
    .replace(/\//g, '-')
    .toLowerCase();
  
  node = nodes.find(n => {
    const nodePath = n.id.replace(/\.md$/, '').replace(/\//g, '-').toLowerCase();
    return nodePath === normalizedPath;
  });

  if (!node) {
    console.warn(`未找到匹配的节点: ${path}`, { 
      尝试的标准化路径: normalizedPath,
      可用节点: nodes.map(n => n.id) 
    });
  }

  return node;
}

// 初始化数据
function initializeMapData(data: MapNodeLink, currentPath?: string): void {
  log("initializeMapData 开始", { 
    inputData: data, 
    currentPath, 
    currentMapData: map_data.value 
  });

  if (!data) {
    console.warn("TypeError: data is undefined");
    return;
  }

  // 数据验证和清理
  const cleanedData = validateAndCleanData(data);
  const newNodes = JSON.parse(JSON.stringify(cleanedData.nodes));
  const newLinks = JSON.parse(JSON.stringify(cleanedData.links));

  log("数据深拷贝完成", { 
    nodeCount: newNodes.length, 
    linkCount: newLinks.length 
  });

  // 确保链接引用正确的节点对象（而不是ID字符串）
  const nodeMap = new Map(newNodes.map((node: { id: any; }) => [node.id, node]));
  
  const processedLinks = newLinks.map((link: { source: { id: any; }; target: { id: any; }; }) => {
    const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
    const targetId = typeof link.target === 'string' ? link.target : link.target.id;
    
    const sourceNode = nodeMap.get(sourceId);
    const targetNode = nodeMap.get(targetId);
    
    if (!sourceNode || !targetNode) {
      console.error(`链接节点不存在: 源=${sourceId}, 目标=${targetId}`);
      return null;
    }
    
    return {
      ...link,
      source: sourceNode,
      target: targetNode
    };
  }).filter(Boolean) as MapLink[];

  log("链接处理完成", { 
    处理后的链接数: processedLinks.length 
  });

  // 计算连接数
  newNodes.forEach((node: Node) => {
    node.linkCount = processedLinks.reduce((count: number, link: MapLink) => {
      const sourceId = typeof link.source === "string" ? link.source : link.source.id;
      const targetId = typeof link.target === "string" ? link.target : link.target.id;
      return count + (sourceId === node.id || targetId === node.id ? 1 : 0);
    }, 0);
  });

  log("节点连接数计算完成");

  // 标记孤立节点
  newNodes.forEach((node: Node) => {
    node.isCurrent = false;
    node.fx = null;
    node.fy = null;

    node.isIsolated = !processedLinks.some((link: MapLink) => {
      const sourceId = typeof link.source === "string" ? link.source : link.source.id;
      const targetId = typeof link.target === "string" ? link.target : link.target.id;
      return sourceId === node.id || targetId === node.id;
    });

    node.x = canvasSize.value.width / 2;
    node.y = canvasSize.value.height / 2;
  });

  log("孤立节点标记完成");

  // 设置当前节点
  if (currentPath) {
    const currentNode = findMatchingNode(newNodes, currentPath);
    if (currentNode) {
      currentNode.isCurrent = true;
      log("当前节点设置", { currentNode: currentNode.id });
    } else {
      console.warn(`未找到当前路径对应的节点: ${currentPath}`);
    }
  }

  const oldMapData = map_data.value;
  map_data.value = { nodes: newNodes, links: processedLinks };
  
  log("map_data 更新完成", { 
    oldNodeCount: oldMapData.nodes.length,
    newNodeCount: map_data.value.nodes.length,
    oldLinkCount: oldMapData.links.length,
    newLinkCount: map_data.value.links.length
  });
}

// 安全的模拟器初始化函数
function initializeSimulationSafely(nodes: Node[], links: MapLink[]) {
  log("开始安全初始化模拟器", { nodes: nodes.length, links: links.length });
  
  try {
    // 再次验证数据
    const nodeIds = new Set(nodes.map(n => n.id));
    const validLinks = links.filter(link => {
      const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
      const targetId = typeof link.target === 'string' ? link.target : link.target.id;
      return nodeIds.has(sourceId) && nodeIds.has(targetId);
    });

    log("模拟器初始化前的最终验证", {
      原始链接数: links.length,
      有效链接数: validLinks.length
    });

    const sim = initializeSimulation(nodes, validLinks);
    log("模拟器初始化成功");
    return sim;
  } catch (error) {
    console.error("模拟器初始化失败:", error);
    
    // 返回一个最小化的安全模拟器
    const safeSim = d3.forceSimulation(nodes)
      .force("charge", d3.forceManyBody().strength(-100))
      .force("center", d3.forceCenter(canvasSize.value.width / 2, canvasSize.value.height / 2));
    
    log("创建了安全模拟器作为备选方案");
    return safeSim;
  }
}

// 绘制函数
let drawingManager: DrawingManager | null = null;
let tickCount = 0;

function ticked(): void {
  tickCount++;
  if (tickCount <= 5) {
    log(`ticked #${tickCount}`, { 
      hasCanvas: !!canvasRef.value, 
      hasDrawingManager: !!drawingManager,
      nodeCount: map_data.value.nodes.length 
    });
  }

  if (!canvasRef.value || !drawingManager) return;
  
  const context = canvasRef.value.getContext("2d");
  if (!context) return;
  drawingManager.setLabelsVisibility(bioStore.showLabels);
  drawingManager.clearCanvas(canvasSize.value);
  drawingManager.applyTransform();
  drawingManager.drawLinks(map_data.value.links);
  drawingManager.drawNodes(map_data.value.nodes);
  drawingManager.drawLabels(map_data.value.nodes);
  drawingManager.restoreTransform();
}




// 生命周期
onMounted(() => {
  log("onMounted 开始执行");
  
  if (!canvasRef.value) {
    log("canvasRef 为空，中止挂载");
    return;
  }

  const context = canvasRef.value.getContext("2d");
  if (!context) {
    log("获取 canvas 上下文失败");
    return;
  }

  log("Canvas 上下文获取成功");

  // 初始化绘制管理器
  drawingManager = new DrawingManager(context, themeColors.value, transform.value);
  log("DrawingManager 初始化完成");

  // 初始化数据
  log("开始初始化地图数据");
  initializeMapData(effectiveData.value, props.currentPath);

  // 设置主题观察器
  const styleObserver = setupThemeObserver(ticked);
  onUnmounted(() => {
    log("组件卸载，断开主题观察器");
    styleObserver.disconnect();
  });
  log("主题观察器设置完成");

  // 安全初始化模拟器
  log("开始安全初始化模拟器");
  simulation.value = initializeSimulationSafely(map_data.value.nodes, map_data.value.links);
  simulation.value.on("tick", ticked);
  log("模拟器初始化完成", { simulation: simulation.value });

  // 设置事件监听
  log("开始设置事件监听");
  setupEventListeners();

  log("onMounted 执行完成");
});

onUnmounted(() => {
  log("onUnmounted 开始执行");
  if (simulation.value) {
    simulation.value.stop();
    log("模拟器已停止");
  }
  log("组件卸载完成");
});

// 监听器
watch(() => canvasSize.value, (newSize, oldSize) => {
  log("canvasSize 变化", { oldSize, newSize });
  updateForces();
  if (simulation.value) {
    simulation.value.alpha(0.3).restart();
    log("模拟器重启");
  }
});


// 监听器 - 修复：使用 effectiveData
watch([() => effectiveData.value, () => props.currentPath], ([newData, newPath], [oldData, oldPath]) => {
  log("数据或当前路径变化", { 
    oldData, 
    newData, 
    oldPath, 
    newPath,
    currentMapData: map_data.value
  });

  if (!newData) {
    log("新数据为空，跳过更新");
    return;
  }

  log("开始更新地图数据");
  initializeMapData(newData, newPath);
  
  if (simulation.value) {
    // 安全地更新模拟器
    simulation.value.nodes(map_data.value.nodes);
    
    try {
      simulation.value.force("link", 
        d3.forceLink(map_data.value.links)
          .id((d: any) => d.id)
          .distance(100)
      );
      
      simulation.value.alpha(1).restart();
      log("模拟器已更新并重启", { 
        nodeCount: map_data.value.nodes.length,
        linkCount: map_data.value.links.length
      });
    } catch (error) {
      console.error("更新模拟器时出错:", error);
      // 即使出错也继续运行，只是不重启模拟器
    }
  }
});


</script>

<template>
  <div class="relation-graph-container">
    <canvas
      ref="canvasRef"
      :width="canvasSize.width"
      :height="canvasSize.height"
      :style="{
        width: canvasSize.width + 'px',
        height: canvasSize.height + 'px',
      }"
    ></canvas>
    
 <!-- 节点工具提示（仅信息展示，不包含点击功能） -->
    <div
      v-if="tooltipVisible && tooltipContent"
      class="node-tooltip"
      :style="{
        left: tooltipPosition.x + 10 + 'px',
        top: tooltipPosition.y + 10 + 'px',
      }"
      @mouseenter="hideTooltip"
    >
      <div class="tooltip-header">
        <h4 class="tooltip-title">{{ tooltipContent.value.title || tooltipContent.id }}</h4>
        <span class="tooltip-badge" :class="{
          'current': tooltipContent.isCurrent,
          'isolated': tooltipContent.isIsolated
        }">
          {{ tooltipContent.isCurrent ? '当前' : tooltipContent.isIsolated ? '孤立' : '节点' }}
        </span>
      </div>
      
      <div class="tooltip-content">
        <p class="tooltip-path">{{ tooltipContent.id }}</p>
        <p v-if="tooltipContent.linkCount !== undefined" class="tooltip-stats">
          连接数: {{ tooltipContent.linkCount }}
        </p>
        <p class="tooltip-hint">单击节点查看详情</p>
      </div>
      
      <div class="tooltip-arrow"></div>
    </div>
  </div>
</template>

<style scoped>
canvas {
  border: 1px solid rgb(60, 60, 67);
  margin: 0;
  border-radius: 5px;
  position: absolute;
  top: 0;
  left: 0;
}

.node-tooltip {
  position: fixed;
  z-index: 1000;
  background: var(--vp-c-bg);
  border: 1px solid var(--vp-c-border);
  border-radius: 8px;
  padding: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  backdrop-filter: blur(10px);
  min-width: 200px;
  max-width: 300px;
  animation: tooltipFadeIn 0.2s ease-out;
  cursor: default; /* 默认光标，不可点击 */
  transition: all 0.2s ease;
}

.node-tooltip:hover {
  box-shadow: 0 6px 25px rgba(0, 0, 0, 0.2);
  transform: translateY(-1px);
}

@keyframes tooltipFadeIn {
  from {
    opacity: 0;
    transform: translateY(5px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.tooltip-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 8px;
  gap: 8px;
}

.tooltip-title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--vp-c-text-1);
  line-height: 1.3;
  word-break: break-word;
}

.tooltip-badge {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 500;
  white-space: nowrap;
  flex-shrink: 0;
}

.tooltip-badge.current {
  background: var(--vp-c-green-soft);
  color: var(--vp-c-green);
}

.tooltip-badge.isolated {
  background: var(--vp-c-yellow-soft);
  color: var(--vp-c-yellow);
}

.tooltip-badge:not(.current):not(.isolated) {
  background: var(--vp-c-gray-soft);
  color: var(--vp-c-text-2);
}

.tooltip-content {
  margin-bottom: 8px;
}

.tooltip-path {
  margin: 0 0 6px 0;
  font-size: 11px;
  color: var(--vp-c-text-2);
  word-break: break-all;
  line-height: 1.2;
}

.tooltip-stats {
  margin: 0 0 6px 0;
  font-size: 12px;
  color: var(--vp-c-text-3);
}

.tooltip-hint {
  margin: 0;
  font-size: 11px;
  color: var(--vp-c-brand);
  font-style: italic;
}

.tooltip-arrow {
  position: absolute;
  top: -5px;
  left: 20px;
  width: 10px;
  height: 10px;
  background: var(--vp-c-bg);
  border-left: 1px solid var(--vp-c-border);
  border-top: 1px solid var(--vp-c-border);
  transform: rotate(45deg);
}

/* 响应式调整 */
@media (max-width: 768px) {
  .node-tooltip {
    max-width: 250px;
    padding: 10px;
  }
  
  .tooltip-title {
    font-size: 13px;
  }
}

</style>
<style>
/* 将父容器 z-index 设为大于1，避免当前页面一些元素干扰 */
.aside-container {
  z-index: 20; /* 大于 artplayer 浮窗 */
}
</style>