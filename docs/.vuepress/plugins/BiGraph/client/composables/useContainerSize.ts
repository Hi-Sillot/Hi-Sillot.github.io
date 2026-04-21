// composables/useContainerSize.ts - 容器尺寸管理

import { ref, nextTick, onMounted, onUnmounted, type Ref } from "vue";
import type { CanvasSize } from "../../types";
import type { LocalGraphOptions, ScreenState } from "../../types/localRelationship";
import { EVENT_NAMES, SIZE_CONFIG } from "../../constants";

/**
 * 容器尺寸管理
 */
export function useContainerSize(
  containerRef: Ref<HTMLElement | null>,
  screenState: Ref<ScreenState>,
  options: Ref<LocalGraphOptions>
) {
  const canvasSize = ref<CanvasSize>({
    width: SIZE_CONFIG.CANVAS.DEFAULT_WIDTH,
    height: SIZE_CONFIG.CANVAS.DEFAULT_HEIGHT,
  });

  let resizeObserver: ResizeObserver | null = null;

  /**
   * 更新容器宽度
   */
  const updateContainerWidth = (): void => {
    if (!containerRef.value) return;

    const parentElement = containerRef.value.parentElement;
    if (!parentElement) return;

    const parentRect = parentElement.getBoundingClientRect();
    const parentStyle = window.getComputedStyle(parentElement);
    const parentPadding = parseFloat(parentStyle.paddingLeft) + parseFloat(parentStyle.paddingRight);

    if (screenState.value.isLargeScreen) {
      // 大屏幕计算逻辑
      if (options.value.graphSize.maxWidth) {
        screenState.value.containerWidth = Math.min(
          options.value.graphSize.maxWidth,
          document.documentElement.clientWidth - parentRect.left - SIZE_CONFIG.CONTAINER.PADDING
        );
      } else {
        screenState.value.containerWidth = document.documentElement.clientWidth - parentRect.left - SIZE_CONFIG.CONTAINER.PADDING;
      }
    } else {
      // 小屏幕计算逻辑
      screenState.value.containerWidth = Math.max(
        SIZE_CONFIG.CONTAINER.MIN_WIDTH,
        parentRect.width - parentPadding - SIZE_CONFIG.CONTAINER.MARGIN
      );
    }

    // 更新 canvasSize
    canvasSize.value = {
      width: screenState.value.containerWidth,
      height: options.value.graphSize.height,
    };
  };

  /**
   * 设置 ResizeObserver
   */
  const setupResizeObserver = (): void => {
    resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.target === containerRef.value) {
          updateContainerWidth();
        }
      }
    });

    if (containerRef.value) {
      resizeObserver.observe(containerRef.value);
    }
  };

  /**
   * 清理 ResizeObserver
   */
  const cleanupResizeObserver = (): void => {
    if (resizeObserver) {
      resizeObserver.disconnect();
    }
  };

  /**
   * 设置窗口 resize 监听
   */
  const setupWindowResizeListener = (): void => {
    window.addEventListener(EVENT_NAMES.RESIZE, updateContainerWidth);
  };

  /**
   * 清理窗口 resize 监听
   */
  const cleanupWindowResizeListener = (): void => {
    window.removeEventListener(EVENT_NAMES.RESIZE, updateContainerWidth);
  };

  onMounted(() => {
    nextTick(() => {
      updateContainerWidth();
      setupResizeObserver();
      setupWindowResizeListener();
    });
  });

  onUnmounted(() => {
    cleanupResizeObserver();
    cleanupWindowResizeListener();
  });

  return {
    canvasSize,
    updateContainerWidth,
  };
}