import * as d3 from "d3";
import type { Node, MapLink } from "../types";

/**
 * 默认配置常量
 */
export const DEFAULT_CONFIG = {
  FOLD_EMPTY_GRAPH: false,
  LOCAL_GRAPH_DEEP: 5,
  GRAPH_MAX_WIDTH: Infinity,
  GRAPH_HEIGHT: 300,
  ENABLE_GLOBAL_GRAPH: true,
  ENABLE_LOCAL_GRAPH: true,
};

/**
 * 临时文件名称
 */
export const TEMP_FILE_NAMES = {
  BIO_TS: "BioGraph",
};

/**
 * 注入的全局变量名称
 */
export const INJECTED_VARIABLES = {
  FOLD_EMPTY_GRAPH: "__RELATIONAL_GRAPH_FOLD_EMPTY_GRAPH",
  LOCAL_GRAPH_DEEP: "__RELATIONAL_GRAPH_LOCAL_GRAPH_DEEP",
  MAX_WIDTH: "__RELATIONAL_GRAPH_MAX_WIDTH",
  HEIGHT: "__RELATIONAL_GRAPH_HEIGHT",
  ENABLE_GLOBAL_GRAPH: "__RELATIONAL_GRAPH_ENABLE_GLOBAL_GRAPH",
  ENABLE_LOCAL_GRAPH: "__RELATIONAL_GRAPH_ENABLE_LOCAL_GRAPH",
};


export const CANVAS_CONFIG = {
  defaultWidth: 300,
  defaultHeight: 300,
  nodeRadius: 5,
  nodePadding: 5,
  zoomExtent: [0.1, 10] as [number, number],
  nodeClickRadius: 15,
  hoverNodeRadius: 8,
};

export const STYLE_CONFIG = {
  link: {
    color: "#aaa",
    normalOpacity: 0.3,
    highlightOpacity: 1,
  },
  node: {
    normalOpacity: 0.3,
    highlightOpacity: 0.8,
  },
  text: {
    font: "12px 'Microsoft YaHei', 'Heiti SC', 'SimHei', -apple-system, sans-serif",
    offset: 20,
    minScale: 0.5,
    maxScale: 1.5,
  },
  currentNode: {
    strokeWidth: 2,
  },
};

export const FORCE_CONFIG = {
  // 链接力配置
  link: {
    distance: 100,  // 调整连接线的距离
    strength: 0.5
  },
  // 电荷力配置（节点间排斥力）
  charge: {
    distanceMin: 10,
    distanceMax: 400,
    strength: (d: Node) => { return -30 - 180 * (d.linkCount-1 || 0) }  // 根据连接数调整电荷力 负值表示排斥
  },
  // 碰撞力配置
  collision: {
    radius: 30,  // 调整碰撞半径
    strength: 0.7,
  },
  // X轴中心力配置
  x_strength: (d: any) => {return d.isIsolated ? 0.005 : 0.1}, // 减小孤立节点的X轴中心力
  // Y轴中心力配置
  y_strength: (d: any) => {return d.isIsolated ? 0.005 : 0.1}, // 减小孤立节点的Y轴中心力
  // 模拟参数
  simulation: {
    alphaDecay: 0.006, // alpha衰减率，控制模拟停止速度
    alphaMin: 0.01, // 设置alphaMin，避免无限刷新
    velocityDecay: 0.5, // 调整速度衰减，使得节点移动更平滑
    restart: {
      alpha: 1,
      alphaTarget: 0.3,
      watchAlpha: 0.3,
      dataChangeAlpha: 1,
      dragEndAlphaTarget: 0,
      dragEndAlpha: 0.3,
    },
  },
};


/**
 * 响应式断点配置
 */
export const BREAKPOINTS = {
  LARGE_SCREEN: 1440,
};

/**
 * 尺寸配置
 */
export const SIZE_CONFIG = {
  CANVAS: {
    DEFAULT_WIDTH: 300,
    DEFAULT_HEIGHT: 300,
    FULLSCREEN_PADDING: 0.09, // 9% 边距
  },
  CONTAINER: {
    MIN_WIDTH: 300,
    PADDING: 40,
    MARGIN: 20,
  },
};

/**
 * CSS 类名常量
 */
export const CLASS_NAMES = {
  CONTAINER: "relationship-map__container",
  CONTAINER_EXPANDED: "relationship-map__container--expanded",
  TOGGLE_BUTTON: "relationship-map__toggle-btn",
  BUTTON: "relationship-map__btn",
  BUTTON_FULLSCREEN: "relationship-map__btn--fullscreen",
  BUTTON_GLOBAL: "relationship-map__btn--global",
  BUTTON_CLOSE: "relationship-map__btn--close",
  FULLSCREEN: "relationship-map-fullscreen",
  FULLSCREEN_CONTAINER: "relationship-map-fullscreen__container",
};

/**
 * 事件名称常量
 */
export const EVENT_NAMES = {
  NODE_CLICK: "nodeClick",
  RESIZE: "resize",
  CHANGE: "change",
};