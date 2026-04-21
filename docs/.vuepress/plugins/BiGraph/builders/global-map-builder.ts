import type { MapNodeLink, Node } from "../types";
// import { BaseMapBuilder } from "./base-map-builder";
import { debug } from "../utils/debug";
import { useBioChainStore } from "../stores/bioChain";
import { addNodeToGraph, updateLinkCounts } from "./base-map-builder";

const TAG = "GlobalMapBuilder";

/**
 * 全局图谱构建器
 */
export class GlobalMapBuilder {
  /**
   * 构建全局图谱
   */
  public static build(): MapNodeLink {
    debug.log(TAG, "开始构建全局图谱");
    const bioStore = useBioChainStore();

    const graph: MapNodeLink = {
      nodes: [],
      links: [],
    };

    const linkSet = new Set<string>();
    const keys = Object.keys(bioStore.bioChainMap);

    debug.log(TAG, "生物链映射信息", {
      总键数: keys.length,
      示例键: keys.slice(0, 5)
    });

    if (keys.length === 0) {
      debug.error(TAG, "生物链映射为空，无法构建全局图谱");
      return graph;
    }

    // 先添加所有节点
    keys.forEach((path, index) => {
      addNodeToGraph(graph, path);
      if (index < 3) {
        debug.log(TAG, `添加节点 ${index + 1}/${keys.length}`, { 
          路径: path,
          节点标题: bioStore.bioChainMap[path]?.title || '无标题'
        });
      }
    });

    debug.log(TAG, "节点添加完成", { 
      节点数: graph.nodes.length,
      预期节点数: keys.length
    });

    // 检查节点是否成功添加
    if (graph.nodes.length === 0) {
      debug.error(TAG, "没有成功添加任何节点到图谱中");
      // 尝试直接检查 bioChainMap 的内容
      debug.table(TAG, keys.slice(0, 10).map(key => {
        const item = bioStore.bioChainMap[key];
        return {
          键: key,
          标题: item?.title || '无标题',
          出链数: item?.outlink?.length || 0,
          入链数: item?.backlink?.length || 0,
          是否存在: !!item
        };
      }), "前10个生物链项");
    }

    // 然后处理所有链接
    let processedLinks = 0;
    keys.forEach((path, index) => {
      const item = bioStore.bioChainMap[path];
      if (item) {
        processedLinks++;
        this.processNodeLinks(graph, linkSet, path);
        
        if (index < 3) {
          debug.log(TAG, `处理节点链接 ${index + 1}/${keys.length}`, {
            路径: path,
            标题: item.title,
            出链数: item.outlink.length,
            入链数: item.backlink.length
          });
        }
      } else {
        debug.warn(TAG, `跳过不存在的节点`, { 路径: path });
      }
    });

    debug.log(TAG, "链接处理完成", { 
      处理节点数: processedLinks,
      总链接数: graph.links.length,
      去重链接数: linkSet.size,
      链接示例: Array.from(linkSet).slice(0, 3)
    });

    // 更新节点的连接计数
    updateLinkCounts(graph);

    // 统计信息
    const isolatedNodes = graph.nodes.filter(n => n.isIsolated).length;
    const connectedNodes = graph.nodes.filter(n => !n.isIsolated).length;
    
    debug.log(TAG, "全局图谱构建完成", {
      总节点数: graph.nodes.length,
      总链接数: graph.links.length,
      孤立节点数: isolatedNodes,
      连接节点数: connectedNodes,
      连接比例: `${((connectedNodes / graph.nodes.length) * 100).toFixed(1)}%`
    });

    // 输出前5个节点的详细信息用于调试
    debug.table(TAG, 
      graph.nodes.slice(0, 5).map(node => ({
        节点ID: node.id,
        标题: node.value.title,
        连接数: node.linkCount,
        是否孤立: node.isIsolated,
        出链数: node.value.outlink.length,
        入链数: node.value.backlink.length
      })),
      "前5个节点详情"
    );

    // 输出前5个链接的详细信息
    debug.table(TAG, 
      graph.links.slice(0, 5).map(link => {
        const sourceNode = graph.nodes.find(n => n.id === link.source);
        const targetNode = graph.nodes.find(n => n.id === link.target);
        return {
          源节点: link.source,
          源标题: sourceNode?.value.title || '未知',
          目标节点: link.target,
          目标标题: targetNode?.value.title || '未知'
        };
      }),
      "前5个链接详情"
    );

    return graph;
  }

  /**
   * 重写处理节点链接方法，添加更多调试信息
   */
  protected static processNodeLinks(
    graph: MapNodeLink, 
    linkSet: Set<string>, 
    path: string
  ): void {
    const bioStore = useBioChainStore();
    const bioItem = bioStore.bioChainMap[path];
    if (!bioItem) {
      debug.warn(TAG, `处理节点链接时未找到生物链项`, { 路径: path });
      return;
    }

    // 检查当前节点是否在图谱中
    const currentNode = graph.nodes.find(n => n.id === path);
    if (!currentNode) {
      debug.warn(TAG, `节点不在图谱中，跳过链接处理`, { 路径: path });
      return;
    }

    let outlinkProcessed = 0;
    let backlinkProcessed = 0;

    // 处理出链
    bioItem.outlink.forEach((target, index) => {
      if (this.processSingleLink(graph, linkSet, path, target, 'outlink')) {
        outlinkProcessed++;
      }
    });

    // 处理入链
    bioItem.backlink.forEach((source, index) => {
      if (this.processSingleLink(graph, linkSet, path, source, 'backlink')) {
        backlinkProcessed++;
      }
    });

    if (outlinkProcessed > 0 || backlinkProcessed > 0) {
      debug.log(TAG, `节点链接处理统计`, {
        路径: path,
        出链总数: bioItem.outlink.length,
        出链处理成功: outlinkProcessed,
        入链总数: bioItem.backlink.length,
        入链处理成功: backlinkProcessed
      });
    }
  }

  /**
   * 处理单个链接
   */
  private static processSingleLink(
    graph: MapNodeLink,
    linkSet: Set<string>,
    currentPath: string,
    targetPath: string,
    linkType: 'outlink' | 'backlink'
  ): boolean {
    const bioStore = useBioChainStore();
    // 检查链接目标是否存在
    if (!bioStore.bioChainMap[targetPath]) {
      debug.warn(TAG, `链接目标不存在`, { 
        源路径: currentPath, 
        目标路径: targetPath,
        链接类型: linkType
      });
      return false;
    }

    // 确定链接的源和目标
    const source = linkType === 'outlink' ? currentPath : targetPath;
    const target = linkType === 'outlink' ? targetPath : currentPath;

    // 链接去重
    const linkKey = `${source}->${target}`;
    if (linkSet.has(linkKey)) {
      return false;
    }

    // 检查源节点和目标节点是否都在图谱中
    const sourceExists = graph.nodes.some(node => node.id === source);
    const targetExists = graph.nodes.some(node => node.id === target);
    
    if (!sourceExists || !targetExists) {
      debug.warn(TAG, `链接的节点不存在于图谱中`, {
        源节点: source,
        源节点存在: sourceExists,
        目标节点: target,
        目标节点存在: targetExists,
        链接类型: linkType
      });
      return false;
    }

    // 添加链接
    linkSet.add(linkKey);
    graph.links.push({ source, target });
    
    return true;
  }
}