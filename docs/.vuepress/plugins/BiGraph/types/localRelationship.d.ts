import type { CanvasSize, MapNodeLink } from "./index";



/**
 * 组件配置选项
 */
export interface LocalGraphOptions {
  foldEmptyGraph: boolean;
  localGraphDeep: number;
  enableGlobalGraph: boolean;
  graphSize: {
    height: number;
    maxWidth: number;
  };
}

/**
 * 屏幕尺寸状态
 */
export interface ScreenState {
  /** 是否为大屏幕 */
  isLargeScreen: boolean;
  /** 容器宽度 */
  containerWidth: number;
  /** 是否展开（小屏幕下使用） */
  isExpanded: boolean;
}

/**
 * 全屏状态
 */
export interface FullscreenState {
  isFullscreen: boolean;
  canvasSize: CanvasSize;
}