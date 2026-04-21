// composables/useScreenSize.ts - 屏幕尺寸管理

import { onMounted, onUnmounted, ref } from "vue";
import { BREAKPOINTS, EVENT_NAMES } from "../../constants";
import type { ScreenState } from "../../types/localRelationship";

let TAG = "useScreenSize.ts";

function log(step: string, data?: any) {
  console.log(
    `${TAG} [useScreenSize] ${step}`,
    data ? data : "",
  );
}

/**
 * 屏幕尺寸管理
 */
export function useScreenSize() {
  log("开始初始化 useScreenSize");

  const screenState = ref<ScreenState>({
    isLargeScreen: false,
    containerWidth: 0,
    isExpanded: false, // 添加缺失的属性
  });

  let mediaQuery: MediaQueryList | null = null;
  let resizeObserver: ResizeObserver | null = null;

  /**
   * 更新屏幕尺寸状态
   */
  const updateScreenSize = (): void => {
    const wasLargeScreen = screenState.value.isLargeScreen;
    screenState.value.isLargeScreen =
      window.matchMedia(`(min-width: ${BREAKPOINTS.LARGE_SCREEN}px)`).matches;

    log("更新屏幕尺寸状态", {
      之前是大屏幕: wasLargeScreen,
      现在是大屏幕: screenState.value.isLargeScreen,
      窗口宽度: window.innerWidth,
      断点: BREAKPOINTS.LARGE_SCREEN,
    });

    // 如果是大屏幕，自动展开
    if (screenState.value.isLargeScreen && !screenState.value.isExpanded) {
      screenState.value.isExpanded = true;
      log("大屏幕自动展开");
    }

    // 如果是小屏幕且当前是展开状态，但应该收起
    if (!screenState.value.isLargeScreen && screenState.value.isExpanded) {
      // 这里可以根据需要决定是否自动收起
      // screenState.value.isExpanded = false;
    }
  };

  /**
   * 更新容器宽度
   */
  const updateContainerWidth = (): void => {
    const container = document.querySelector(".relationship-map__container");
    if (container) {
      const oldWidth = screenState.value.containerWidth;
      screenState.value.containerWidth = container.clientWidth;

      if (oldWidth !== screenState.value.containerWidth) {
        log("容器宽度更新", {
          旧宽度: oldWidth,
          新宽度: screenState.value.containerWidth,
        });
      }
    }
  };

  /**
   * 切换展开状态
   */
  const toggleExpand = (): void => {
    const oldState = screenState.value.isExpanded;
    screenState.value.isExpanded = !screenState.value.isExpanded;

    log("切换展开状态", {
      之前状态: oldState,
      新状态: screenState.value.isExpanded,
      是否大屏幕: screenState.value.isLargeScreen,
    });

    // 更新容器宽度
    setTimeout(updateContainerWidth, 100);
  };

  /**
   * 设置媒体查询监听
   */
  const setupMediaQueryListener = (): void => {
    try {
      mediaQuery = window.matchMedia(
        `(min-width: ${BREAKPOINTS.LARGE_SCREEN}px)`,
      );
      mediaQuery.addEventListener(EVENT_NAMES.CHANGE, updateScreenSize);
      log("媒体查询监听器设置完成");
    } catch (error) {
      console.error("设置媒体查询监听器失败:", error);
    }
  };

  /**
   * 设置容器尺寸监听
   */
  const setupContainerObserver = (): void => {
    try {
      resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          if (entry.target.classList.contains("relationship-map__container")) {
            updateContainerWidth();
          }
        }
      });

      // 监听容器尺寸变化
      const container = document.querySelector(".relationship-map__container");
      if (container) {
        resizeObserver.observe(container);
        log("容器尺寸监听器设置完成");
      } else {
        console.warn("未找到关系图谱容器，无法监听尺寸变化");

        // 延迟重试
        setTimeout(() => {
          const retryContainer = document.querySelector(
            ".relationship-map__container",
          );
          if (retryContainer && resizeObserver) {
            resizeObserver.observe(retryContainer);
            log("延迟重试: 容器尺寸监听器设置完成");
          }
        }, 500);
      }
    } catch (error) {
      console.error("设置容器尺寸监听器失败:", error);
    }
  };

  /**
   * 清理媒体查询监听
   */
  const cleanupMediaQueryListener = (): void => {
    if (mediaQuery) {
      mediaQuery.removeEventListener(EVENT_NAMES.CHANGE, updateScreenSize);
      log("媒体查询监听器已清理");
    }
  };

  /**
   * 清理容器尺寸监听
   */
  const cleanupContainerObserver = (): void => {
    if (resizeObserver) {
      resizeObserver.disconnect();
      log("容器尺寸监听器已清理");
    }
  };

  /**
   * 强制更新容器宽度
   */
  const forceUpdateContainerWidth = (): void => {
    log("强制更新容器宽度");
    updateContainerWidth();
  };

  onMounted(() => {
    log("useScreenSize onMounted 开始");

    try {
      // 初始更新
      updateScreenSize();
      updateContainerWidth();

      // 设置监听器
      setupMediaQueryListener();

      // 延迟设置容器监听，确保DOM已渲染
      setTimeout(() => {
        setupContainerObserver();
      }, 100);

      // 添加窗口大小变化监听
      window.addEventListener("resize", updateScreenSize);

      log("useScreenSize onMounted 完成", {
        是否大屏幕: screenState.value.isLargeScreen,
        容器宽度: screenState.value.containerWidth,
        是否展开: screenState.value.isExpanded,
      });
    } catch (error) {
      console.error("useScreenSize onMounted 执行失败:", error);
    }
  });

  onUnmounted(() => {
    log("useScreenSize onUnmounted 开始");

    try {
      cleanupMediaQueryListener();
      cleanupContainerObserver();
      window.removeEventListener("resize", updateScreenSize);
      log("useScreenSize onUnmounted 完成");
    } catch (error) {
      console.error("useScreenSize onUnmounted 执行失败:", error);
    }
  });

  return {
    screenState,
    updateScreenSize,
    toggleExpand,
    forceUpdateContainerWidth,
    cleanupMediaQueryListener,
    cleanupContainerObserver,
  };
}
