// composables/useFullscreen.ts - 全屏功能管理

import { ref, nextTick, onUnmounted, type Ref } from "vue";
import type { FullscreenState } from "../../types/localRelationship";
import { SIZE_CONFIG, EVENT_NAMES } from "../../constants";

/**
 * 全屏功能管理
 */
export function useFullscreen(
  fullscreenContainerRef: Ref<HTMLElement | null>,
  resizeObserver: Ref<ResizeObserver | null>
) {
  const fullscreenState = ref<FullscreenState>({
    isFullscreen: false,
    canvasSize: {
      width: 800,
      height: 600,
    },
  });

  /**
   * 更新全屏尺寸
   */
  const updateFullscreenSize = (): void => {
    if (fullscreenContainerRef.value) {
      const rect = fullscreenContainerRef.value.getBoundingClientRect();
      fullscreenState.value.canvasSize = {
        width: Math.floor(rect.width),
        height: Math.floor(rect.height),
      };
    }
  };

  /**
   * 设置全屏监听
   */
  const setupFullscreenListeners = (): void => {
    if (fullscreenState.value.isFullscreen) {
      window.addEventListener(EVENT_NAMES.RESIZE, updateFullscreenSize);
      
      nextTick(() => {
        if (fullscreenContainerRef.value) {
          updateFullscreenSize();
          if (resizeObserver.value) {
            resizeObserver.value.observe(fullscreenContainerRef.value);
          }
        }
      });
    } else {
      window.removeEventListener(EVENT_NAMES.RESIZE, updateFullscreenSize);
      if (fullscreenContainerRef.value && resizeObserver.value) {
        resizeObserver.value.unobserve(fullscreenContainerRef.value);
      }
    }
  };

  /**
   * 切换全屏状态
   */
  const toggleFullscreen = (): void => {
    fullscreenState.value.isFullscreen = !fullscreenState.value.isFullscreen;
    setupFullscreenListeners();
  };

  onUnmounted(() => {
    if (fullscreenState.value.isFullscreen) {
      window.removeEventListener(EVENT_NAMES.RESIZE, updateFullscreenSize);
    }
  });

  return {
    fullscreenState,
    updateFullscreenSize,
    toggleFullscreen,
    setupFullscreenListeners,
  };
}