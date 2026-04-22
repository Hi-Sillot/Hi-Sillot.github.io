// stores/bioChain.ts
import { ref } from "vue";
import { defineStore } from "pinia";
import type { BiGraphConfig, BioChainMapItem, MapNodeLink, Page, BiGraph } from "../types/index";
import { BioChainService } from "../services/bio-chain-service";
import { debug } from "../utils/debug";
import { GlobalGraphService } from "../services/global-graph-service";

const TAG = "useBioChainStore";

let options: BiGraphConfig = {};

export const useBioChainStore = defineStore("bioChain", () => {
  const BiGraph = ref<BiGraph | null>(null);
  const showGlobalGraph = ref(false);
  const globalGraphData = ref<MapNodeLink | null>(null);
  const isGlobalGraphLoading = ref(false);
  const globalGraphError = ref<string | null>(null);
  const showLabels = ref(true);
  const bioChainMap = ref<Record<string, BioChainMapItem>>({});
  const pageData = ref<Record<string, {
    outlink: { title: string; link: string }[];
    backlink: { title: string; link: string }[];
    localMap: MapNodeLink | undefined;
  }>>({});

  const getPageData = (filePath: string) => pageData.value[filePath];
  const getBioChainItem = (filePath: string) => bioChainMap.value[filePath];
  const getGlobalMap = () => globalGraphData.value || { nodes: [], links: [] };
  const globalGraphStats = () => {
    const data = globalGraphData.value || { nodes: [], links: [] };
    return {
      nodeCount: data.nodes?.length || 0,
      linkCount: data.links?.length || 0,
      isolatedCount: data.nodes?.filter((n: any) => n.isIsolated)?.length || 0,
      isEmpty: !data.nodes || data.nodes.length === 0
    };
  };

  function initialize(config: BiGraphConfig) {
    options = config;
    console.log(TAG, "BioChain Store 初始化完成", config);
  }

  function setGlobalGraphData(data: MapNodeLink) {
    globalGraphData.value = data;
    isGlobalGraphLoading.value = false;
    globalGraphError.value = null;
  }

  function setGlobalGraphLoading(loading: boolean) {
    isGlobalGraphLoading.value = loading;
    if (loading) {
      globalGraphError.value = null;
    }
  }

  function setGlobalGraphError(error: string) {
    globalGraphError.value = error;
    isGlobalGraphLoading.value = false;
  }

  function updatePageData(filePath: string, data: {
    outlink: { title: string; link: string }[];
    backlink: { title: string; link: string }[];
    localMap?: MapNodeLink;
  }) {
    pageData.value[filePath] = {
      ...data,
      localMap: data.localMap || undefined
    };
  }

  function updateBioChainMap(filePath: string, item: BioChainMapItem) {
    bioChainMap.value[filePath] = item;
  }

  function toggleGlobalGraph(show?: boolean) {
    showGlobalGraph.value = show !== undefined ? show : !showGlobalGraph.value;
  }

  function clearAllData() {
    globalGraphData.value = null;
    bioChainMap.value = {};
    pageData.value = {};
    isGlobalGraphLoading.value = false;
    globalGraphError.value = null;
  }

  async function buildBioChain(pages: Page[]) {
    try {
      debug.log(TAG, "开始构建双链数据", { 页面数: pages.length });
      await BioChainService.build(pages);

      debug.log(TAG, "双链数据构建完成", {
        映射项数: Object.keys(bioChainMap.value).length
      });
    } catch (error) {
      debug.error(TAG, "构建双链数据失败", error);
      throw error;
    }
  }

  function showGlobalGraphModal() {
    debug.log(TAG, "显示全局图谱模态框");
    showGlobalGraph.value = true;

    if (!globalGraphData.value || globalGraphData.value.nodes.length === 0) {
      debug.log(TAG, "全局图谱数据为空或无效，自动加载");
      globalGraphData.value = null;
      loadGlobalGraphData();
    }
  }

  function hideGlobalGraphModal() {
    debug.log(TAG, "隐藏全局图谱模态框");
    showGlobalGraph.value = false;
  }

  async function loadGlobalGraphData(): Promise<void> {
    if (isGlobalGraphLoading.value) {
      debug.log(TAG, "全局图谱数据正在加载中，跳过重复加载");
      return;
    }

    debug.log(TAG, "开始加载全局图谱数据");
    isGlobalGraphLoading.value = true;
    globalGraphError.value = null;

    try {
      const data = await GlobalGraphService.getGlobalGraph();

      if (data && Array.isArray(data.nodes) && Array.isArray(data.links)) {
        globalGraphData.value = data;
        debug.log(TAG, "全局图谱数据加载成功", {
          节点数: data.nodes.length,
          链接数: data.links.length
        });
      } else {
        throw new Error("全局图谱数据格式无效");
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "未知错误";
      globalGraphError.value = errorMsg;
      debug.error(TAG, "加载全局图谱数据失败", error);
    } finally {
      isGlobalGraphLoading.value = false;
      debug.log(TAG, "全局图谱数据加载完成");
    }
  }

  async function reloadGlobalGraphData(): Promise<void> {
    debug.log(TAG, "手动重新加载全局图谱数据");
    globalGraphData.value = null;
    await loadGlobalGraphData();
  }

  function updatePageLinks(filePath: string, outlink: any[], backlink: any[]) {
    if (!pageData.value[filePath]) {
      pageData.value[filePath] = {
        outlink: [],
        backlink: [],
        localMap: undefined
      };
    }

    pageData.value[filePath].outlink = outlink;
    pageData.value[filePath].backlink = backlink;

    debug.log(TAG, "页面链接数据已更新", {
      文件路径: filePath,
      出链数: outlink.length,
      入链数: backlink.length
    });
  }

  function reset() {
    debug.log(TAG, "重置 store 状态");
    showGlobalGraph.value = false;
    globalGraphData.value = null;
    isGlobalGraphLoading.value = false;
    globalGraphError.value = null;
    bioChainMap.value = {};
    pageData.value = {};
  }

  return {
    BiGraph,
    showGlobalGraph,
    globalGraphData,
    isGlobalGraphLoading,
    globalGraphError,
    showLabels,
    bioChainMap,
    pageData,
    getPageData,
    getBioChainItem,
    getGlobalMap,
    globalGraphStats,
    initialize,
    setGlobalGraphData,
    setGlobalGraphLoading,
    setGlobalGraphError,
    updatePageData,
    updateBioChainMap,
    toggleGlobalGraph,
    clearAllData,
    buildBioChain,
    showGlobalGraphModal,
    hideGlobalGraphModal,
    loadGlobalGraphData,
    reloadGlobalGraphData,
    updatePageLinks,
    reset
  };
});