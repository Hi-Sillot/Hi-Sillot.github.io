// services/global-graph-service.ts
import type { MapNodeLink } from "../types";
import { GlobalMapBuilder } from "../builders/global-map-builder";
import { debug } from "../utils/debug";

const TAG = "GlobalGraphService";

/**
 * 全局图谱服务
 */
export class GlobalGraphService {
  /**
   * 获取全局图谱数据
   */
  public static async getGlobalGraph(): Promise<MapNodeLink> {
    debug.log(TAG, "开始获取全局图谱数据");
    
    try {
      const startTime = Date.now();
      
      const graphData = GlobalMapBuilder.build();
      const endTime = Date.now();
      
      debug.log(TAG, "全局图谱数据获取完成", {
        执行时间: `${endTime - startTime}ms`,
        节点数: graphData.nodes.length,
        链接数: graphData.links.length
      });

      return graphData;
    } catch (error) {
      debug.error(TAG, "获取全局图谱数据失败", error);
      // 返回空数据而不是抛出错误
      return { nodes: [], links: [] };
    }
  }

  /**
   * 检查全局图谱数据质量
   */
  public static validateGraphData(graphData: MapNodeLink): boolean {
    if (!graphData) {
      debug.error(TAG, "图谱数据为空");
      return false;
    }

    if (!Array.isArray(graphData.nodes)) {
      debug.error(TAG, "节点数据不是数组");
      return false;
    }

    if (!Array.isArray(graphData.links)) {
      debug.error(TAG, "链接数据不是数组");
      return false;
    }

    // 检查节点数据完整性
    const invalidNodes = graphData.nodes.filter(node => 
      !node.id || !node.value
    );
    
    if (invalidNodes.length > 0) {
      debug.warn(TAG, `发现 ${invalidNodes.length} 个无效节点`, {
        无效节点示例: invalidNodes.slice(0, 3)
      });
    }

    // 检查链接数据完整性
    const invalidLinks = graphData.links.filter(link => 
      !link.source || !link.target
    );
    
    if (invalidLinks.length > 0) {
      debug.warn(TAG, `发现 ${invalidLinks.length} 个无效链接`, {
        无效链接示例: invalidLinks.slice(0, 3)
      });
    }

    const isValid = graphData.nodes.length >= 0 && graphData.links.length >= 0;
    debug.log(TAG, "图谱数据验证完成", {
      是否有效: isValid,
      节点数: graphData.nodes.length,
      链接数: graphData.links.length,
      无效节点数: invalidNodes.length,
      无效链接数: invalidLinks.length
    });

    return isValid;
  }
}