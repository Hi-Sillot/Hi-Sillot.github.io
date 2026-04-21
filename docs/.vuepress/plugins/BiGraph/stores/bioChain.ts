// stores/bioChain.ts
import { defineStore } from "pinia";
import type { BiGraphConfig, BioChainMapItem, MapNodeLink, Page, BiGraph } from "../types/index";
import { BioChainService } from "../services/bio-chain-service";
import { debug } from "../utils/debug";
import { GlobalGraphService } from "../services/global-graph-service";

const TAG = "useBioChainStore";

let options: BiGraphConfig = {};

export const useBioChainStore = defineStore("bioChain", {
  persist: true, // 启用持久化存储
  state: () => ({
    BiGraph: null as BiGraph | null,
    // 全局图谱状态
    showGlobalGraph: false,
    globalGraphData: null as MapNodeLink | null,
    isGlobalGraphLoading: false,
    globalGraphError: null as string | null,
    // 新增：节点标签显示控制
    showLabels: true as boolean,
    
    // 双链核心映射表
    bioChainMap: {} as Record<string, BioChainMapItem>,
    
    // 页面级数据存储
    pageData: {} as Record<string, {
      outlink: { title: string; link: string }[];
      backlink: { title: string; link: string }[];
      localMap: MapNodeLink | undefined;
    }>,
  }),

  getters: {
    // 获取指定页面数据
    getPageData: (state) => (filePath: string) => state.pageData[filePath],
    
    // 获取双链映射项
    getBioChainItem: (state) => (filePath: string) => state.bioChainMap[filePath],
    
    // 获取全局图谱数据（确保不返回 null）
    getGlobalMap: (state) => {
      return state.globalGraphData || { nodes: [], links: [] };
    },
    
    // 全局图谱统计信息
    globalGraphStats: (state) => {
      const data = state.globalGraphData || { nodes: [], links: [] };
      return {
        nodeCount: data.nodes?.length || 0,
        linkCount: data.links?.length || 0,
        isolatedCount: data.nodes?.filter((n: any) => n.isIsolated)?.length || 0,
        isEmpty: !data.nodes || data.nodes.length === 0
      };
    },
  },

  actions: {
    // 初始化存储
    initialize(config: BiGraphConfig) {
      options = config;
      console.log(TAG, "BioChain Store 初始化完成", config);
    },
    
    // 设置全局图谱数据
    setGlobalGraphData(data: MapNodeLink) {
      this.globalGraphData = data;
      this.isGlobalGraphLoading = false;
      this.globalGraphError = null;
    },
    
    // 设置加载状态
    setGlobalGraphLoading(loading: boolean) {
      this.isGlobalGraphLoading = loading;
      if (loading) {
        this.globalGraphError = null;
      }
    },
    
    // 设置错误信息
    setGlobalGraphError(error: string) {
      this.globalGraphError = error;
      this.isGlobalGraphLoading = false;
    },
    
    // 更新页面数据
    updatePageData(filePath: string, data: {
      outlink: { title: string; link: string }[];
      backlink: { title: string; link: string }[];
      localMap?: MapNodeLink;
    }) {
      this.pageData[filePath] = {
        ...data,
        localMap: data.localMap || undefined
      };
    },
    
    // 更新双链映射
    updateBioChainMap(filePath: string, item: BioChainMapItem) {
      this.bioChainMap[filePath] = item;
    },
    
    // 显示/隐藏全局图谱
    toggleGlobalGraph(show?: boolean) {
      this.showGlobalGraph = show !== undefined ? show : !this.showGlobalGraph;
    },
    
    // 清除所有数据
    clearAllData() {
      this.globalGraphData = null;
      this.bioChainMap = {};
      this.pageData = {};
      this.isGlobalGraphLoading = false;
      this.globalGraphError = null;
    },

    /**
     * 构建双链数据 - 简化版本
     */
    async buildBioChain(pages: Page[]) {
      try {
        debug.log(TAG, "开始构建双链数据", { 页面数: pages.length });
        await BioChainService.build(pages);
        
        debug.log(TAG, "双链数据构建完成", {
          映射项数: Object.keys(this.bioChainMap).length
        });
      } catch (error) {
        debug.error(TAG, "构建双链数据失败", error);
        throw error;
      }
    },

    /**
     * 显示全局图谱模态框
     */
    showGlobalGraphModal() {
      debug.log(TAG, "显示全局图谱模态框");
      this.showGlobalGraph = true;
      
      // 如果还没有数据或数据有问题，自动加载
      if (!this.globalGraphData || this.globalGraphStats.isEmpty) {
        debug.log(TAG, "全局图谱数据为空或无效，自动加载");
        this.loadGlobalGraphData();
      }
    },

    /**
     * 隐藏全局图谱模态框
     */
    hideGlobalGraphModal() {
      debug.log(TAG, "隐藏全局图谱模态框");
      this.showGlobalGraph = false;
    },

    /**
     * 加载全局图谱数据 - 简化版本
     */
    async loadGlobalGraphData(): Promise<void> {
  if (this.isGlobalGraphLoading) {
    debug.log(TAG, "全局图谱数据正在加载中，跳过重复加载");
    return;
  }

  debug.log(TAG, "开始加载全局图谱数据");
  this.isGlobalGraphLoading = true;
  this.globalGraphError = null;

  try {
    // 实际调用全局图谱服务获取数据
    const data = await GlobalGraphService.getGlobalGraph();
    
    // 验证数据
    if (data && Array.isArray(data.nodes) && Array.isArray(data.links)) {
      this.globalGraphData = data;
      debug.log(TAG, "全局图谱数据加载成功", {
        节点数: data.nodes.length,
        链接数: data.links.length
      });
    } else {
      throw new Error("全局图谱数据格式无效");
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "未知错误";
    this.globalGraphError = errorMsg;
    debug.error(TAG, "加载全局图谱数据失败", error);
  } finally {
    this.isGlobalGraphLoading = false;
    debug.log(TAG, "全局图谱数据加载完成");
  }
},

    /**
     * 重新加载全局图谱数据
     */
    async reloadGlobalGraphData(): Promise<void> {
      debug.log(TAG, "手动重新加载全局图谱数据");
      this.globalGraphData = null;
      await this.loadGlobalGraphData();
    },

    /**
     * 更新页面链接数据
     */
    updatePageLinks(filePath: string, outlink: any[], backlink: any[]) {
      if (!this.pageData[filePath]) {
        this.pageData[filePath] = {
          outlink: [],
          backlink: [],
          localMap: undefined
        };
      }
      
      this.pageData[filePath].outlink = outlink;
      this.pageData[filePath].backlink = backlink;
      
      debug.log(TAG, "页面链接数据已更新", {
        文件路径: filePath,
        出链数: outlink.length,
        入链数: backlink.length
      });
    },

    /**
     * 重置状态（用于调试和测试）
     */
    reset() {
      debug.log(TAG, "重置 store 状态");
      this.showGlobalGraph = false;
      this.globalGraphData = null;
      this.isGlobalGraphLoading = false;
      this.globalGraphError = null;
      this.bioChainMap = {};
      this.pageData = {};
    }
  }
});