import { LocalMapBuilder } from "../builders/local-map-builder";
import type { MapNodeLink } from "../types";
import { debug } from "../utils/debug";

const TAG = "graph-data";

export function getGraphData(currentPath: string): MapNodeLink {
  debug.log(TAG, '开始获取图谱数据', { 当前路径: currentPath });

  try {
    const data = LocalMapBuilder.generate(currentPath);

    debug.log(TAG, 'LocalMapBuilder.generate 执行完成', {
      节点数: data.nodes.length,
      链接数: data.links.length
    });

    return data;
  } catch (error) {
    debug.error(TAG, '获取图谱数据失败', error);
    return { nodes: [], links: [] };
  }
}
