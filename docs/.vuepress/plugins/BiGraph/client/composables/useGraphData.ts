// composables/useGraphData.ts
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { usePageData, usePageFrontmatter } from "vuepress/client";
import { useRouter } from "vue-router";
import type { MapNodeLink } from "../../types";
import { getGraphData } from "../../utils/graph-data";
import { debug } from "../../utils/debug";

const TAG = "useGraphData";

/**
 * 图谱数据管理
 */
export function useGraphData() {
  debug.log(TAG, "开始初始化 useGraphData");

  const router = useRouter();
  const page = usePageData();
  const frontmatter = usePageFrontmatter();

  const mapData = ref<MapNodeLink>({ nodes: [], links: [] });
  const isLoading = ref(false);
  const error = ref<string | null>(null);
  const retryCount = ref(0);
  const maxRetries = 3;
  const isLoaded = ref(false);
  let loadGeneration = 0;

  debug.log(TAG, "组合式函数初始化完成", {
    当前路径: page.value.path,
    路由: !!router,
    页面数据: !!page,
    前置数据: !!frontmatter,
  });

  /**
   * 初始化数据加载器
   */
  const initialize = async (): Promise<boolean> => {
    if (isLoaded.value) {
      debug.log(TAG, "数据已加载，跳过初始化");
      return true;
    }

    debug.log(TAG, "开始初始化数据加载器");
    isLoading.value = true;
    error.value = null;

    try {
      // 这里可以添加数据加载器的初始化逻辑
      isLoaded.value = true;
      debug.log(TAG, "数据加载器初始化成功");
      return true;
    } catch (err) {
      error.value = err instanceof Error ? err.message : "初始化失败";
      debug.error(TAG, "数据加载器初始化失败", err);
      return false;
    } finally {
      isLoading.value = false;
    }
  };

  /**
   * 加载图谱数据
   */
  const loadGraphData = async (): Promise<void> => {
    debug.log(TAG, "开始加载图谱数据", {
      当前路径: page.value.path,
      重试次数: retryCount.value,
      加载状态: isLoading.value,
    });

    const currentGeneration = ++loadGeneration;

    if (isLoading.value) {
      debug.log(TAG, "数据正在加载中，跳过重复加载");
      return;
    }

    isLoading.value = true;
    error.value = null;

    try {
      debug.log(TAG, "调用 getGraphData 获取数据");
      const data = await getGraphData(page.value.path);

      if (currentGeneration !== loadGeneration) {
        debug.log(TAG, "加载已被新请求取代，丢弃结果");
        return;
      }

      debug.log(TAG, "getGraphData 返回数据", {
        数据是否存在: !!data,
        节点数: data?.nodes?.length || 0,
        链接数: data?.links?.length || 0,
      });

      if (data && data.nodes && data.links) {
        mapData.value = data;
        error.value = null;
        debug.log(TAG, "图谱数据设置成功", {
          节点数: data.nodes.length,
          链接数: data.links.length,
        });
      } else {
        throw new Error("获取的数据格式不正确");
      }
    } catch (err) {
      if (currentGeneration !== loadGeneration) return;

      const errorMsg = err instanceof Error ? err.message : "未知错误";
      error.value = errorMsg;
      debug.error(TAG, "加载图谱数据失败", {
        错误: errorMsg,
        重试次数: retryCount.value,
      });

      if (retryCount.value < maxRetries) {
        retryCount.value++;
        const delay = 1000 * retryCount.value;
        debug.log(TAG, `准备重试 (${retryCount.value}/${maxRetries})`, {
          延迟: delay,
        });
        setTimeout(() => loadGraphData(), delay);
      } else {
        mapData.value = { nodes: [], links: [] };
        debug.log(TAG, "达到最大重试次数，设置空数据");
      }
    } finally {
      if (currentGeneration === loadGeneration) {
        isLoading.value = false;
      }
      debug.log(TAG, "数据加载完成", {
        成功: !error.value,
        错误信息: error.value,
        数据状态: {
          节点数: mapData.value.nodes.length,
          链接数: mapData.value.links.length,
        },
      });
    }
  };

  /**
   * 处理节点点击
   */
  const handleNodeClick = (path: string): void => {
    debug.log(TAG, "处理节点点击", {
      点击路径: path,
      当前路径: router.currentRoute.value.path,
      路由对象: !!router,
    });

    try {
      if (path && path !== router.currentRoute.value.path) {
        debug.log(TAG, "执行路由跳转", { 目标路径: path });
        router.push(path);
      } else {
        debug.log(TAG, "点击的是当前节点或路径无效，跳过跳转");
      }
    } catch (err) {
      debug.error(TAG, "节点点击处理失败", err);
    }
  };

  /**
   * 是否应该折叠空图谱
   */
  const shouldFoldEmptyGraph = computed(() => {
    const hasData = mapData.value.nodes && mapData.value.nodes.length > 0;
    const shouldShow = frontmatter.value.localGraph !== false;

    debug.log(TAG, "检查是否应该折叠空图谱", {
      有数据: hasData,
      应该显示: shouldShow,
      节点数: mapData.value.nodes?.length || 0,
      前置数据: frontmatter.value,
    });

    return hasData || shouldShow;
  });

  /**
   * 重新加载数据
   */
  const reloadData = (): void => {
    debug.log(TAG, "手动重新加载数据");
    retryCount.value = 0;
    loadGraphData();
  };

  // 监听路由变化重新加载数据
  const unwatch = router.afterEach((to, from) => {
    if (to.path !== from.path) {
      debug.log(TAG, "检测到路由变化，重新加载数据", {
        从: from.path,
        到: to.path,
      });
      retryCount.value = 0;
      loadGraphData();
    }
  });

  onMounted(() => {
    debug.log(TAG, "onMounted 钩子执行");
    initialize().then((success) => {
      if (success) {
        loadGraphData();
      } else {
        debug.error(TAG, "初始化失败，跳过数据加载");
      }
    });
  });

  onUnmounted(() => {
    debug.log(TAG, "onUnmounted 钩子执行");
    unwatch();
  });

  debug.log(TAG, "useGraphData 初始化完成，返回响应式数据");

  return {
    mapData,
    isLoading,
    error,
    handleNodeClick,
    shouldFoldEmptyGraph,
    reloadData,
  };
}
