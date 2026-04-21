// utils/graph-data.ts
import { LocalMapBuilder } from "../builders/local-map-builder";
import type { MapNodeLink } from "../types";
import { debug } from "../utils/debug";

const TAG = "graph-data";

/**
 * 获取图谱数据（统一入口）
 */
export async function getGraphData(currentPath: string): Promise<MapNodeLink> {
  debug.log(TAG, '开始获取图谱数据', { 当前路径: currentPath });
  
  try {
    const startTime = Date.now();
    
    debug.log(TAG, '调用 LocalMapBuilder.generate');
    const data = LocalMapBuilder.generate(currentPath);
    
    const endTime = Date.now();
    debug.log(TAG, 'LocalMapBuilder.generate 执行完成', {
      执行时间: `${endTime - startTime}ms`,
      节点数: data.nodes.length,
      链接数: data.links.length
    });
    
    return data;
  } catch (error) {
    debug.error(TAG, '获取图谱数据失败', error);
    // 返回空数据而不是抛出错误，避免组件卡死
    return { nodes: [], links: [] };
  }
}