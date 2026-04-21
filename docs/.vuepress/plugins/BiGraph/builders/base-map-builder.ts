// builders/base-map-builder.ts
import type { MapNodeLink, Node, BioChainMapItem } from "../types";
import { useBioChainStore } from "../stores/bioChain";

/**
 * 图谱构建器基类
 */
abstract class BaseMapBuilder {
  /**
   * 添加节点到图谱
   */
//   protected static addNodeToGraph(graph: MapNodeLink, path: string): void {
// const bioStore = useBioChainStore();
//     const bioItem = bioStore.bioChainMap[path];
//     if (!bioItem) {
//       console.warn(`未找到路径对应的生物链项: ${path}`);
//       return;
//     }

//     const node: Node = {
//       id: path,
//       value: bioItem,
//       linkCount: 0,
//       isCurrent: false,
//       isIsolated: false
//     };

//     graph.nodes.push(node);
//   }

  /**
   * 处理节点的所有链接
   */
//   protected static processNodeLinks(
//     graph: MapNodeLink, 
//     linkSet: Set<string>, 
//     path: string
//   ): void {
// const bioStore = useBioChainStore();
//     const bioItem = bioStore.bioChainMap[path];
//     if (!bioItem) return;

//     // 处理出链
//     this.processLinkType(graph, linkSet, path, bioItem.outlink, 'outlink');
    
//     // 处理入链
//     this.processLinkType(graph, linkSet, path, bioItem.backlink, 'backlink');
//   }

  /**
   * 处理特定类型的链接
   */
//   protected static processLinkType(
//     graph: MapNodeLink,
//     linkSet: Set<string>,
//     currentPath: string,
//     links: string[],
//     linkType: 'outlink' | 'backlink'
//   ): void {
//     links.forEach((link) => {
// const bioStore = useBioChainStore();
//       // 检查链接目标是否存在
//       if (!bioStore.bioChainMap[link]) {
//         console.warn(`链接目标不存在: ${link} (来自 ${currentPath})`);
//         return;
//       }

//       // 确定链接的源和目标
//       const source = linkType === 'outlink' ? currentPath : link;
//       const target = linkType === 'outlink' ? link : currentPath;

//       // 链接去重
//       const linkKey = `${source}->${target}`;
//       if (linkSet.has(linkKey)) {
//         return;
//       }

//       // 检查源节点和目标节点是否都在图谱中
//       const sourceExists = graph.nodes.some(node => node.id === source);
//       const targetExists = graph.nodes.some(node => node.id === target);
      
//       if (!sourceExists || !targetExists) {
//         console.warn(`链接的节点不存在: ${source} -> ${target}`);
//         return;
//       }

//       // 添加链接
//       linkSet.add(linkKey);
//       graph.links.push({ source, target });
//     });
//   }

  /**
   * 更新节点的连接计数
   */
  // protected static updateLinkCounts(graph: MapNodeLink): void {
  //   graph.nodes.forEach((node) => {
  //     node.linkCount = graph.links.filter(link => 
  //       link.source === node.id || link.target === node.id
  //     ).length;
  //     node.isIsolated = node.linkCount === 0;
  //   });
  // }

  /**
   * 设置当前节点标记
   */
  // public static setCurrentNode(graph: MapNodeLink, currentPath: string): void {
  //   graph.nodes.forEach(node => {
  //     node.isCurrent = node.id === currentPath;
  //   });
  // }
}

/**
 * 添加节点到图谱
 */
export const addNodeToGraph = (graph: MapNodeLink, path: string): void => {
  const bioStore = useBioChainStore();
  const bioItem = bioStore.bioChainMap[path];
  if (!bioItem) {
    console.warn(`未找到路径对应的生物链项: ${path}`);
    return;
  }

  const node: Node = {
    id: path,
    value: bioItem,
    linkCount: 0,
    isCurrent: false,
    isIsolated: false
  };

  graph.nodes.push(node);
};

/**
 * 处理节点的所有链接
 */
export const processNodeLinks = (
  graph: MapNodeLink, 
  linkSet: Set<string>, 
  path: string
): void => {
  const bioStore = useBioChainStore();
  const bioItem = bioStore.bioChainMap[path];
  if (!bioItem) return;

  // 处理出链
  processLinkType(graph, linkSet, path, bioItem.outlink, 'outlink');
  
  // 处理入链
  processLinkType(graph, linkSet, path, bioItem.backlink, 'backlink');
};

/**
 * 处理特定类型的链接
 */
export const processLinkType = (
  graph: MapNodeLink,
  linkSet: Set<string>,
  currentPath: string,
  links: string[],
  linkType: 'outlink' | 'backlink'
): void => {
  links.forEach((link) => {
    const bioStore = useBioChainStore();
    // 检查链接目标是否存在
    if (!bioStore.bioChainMap[link]) {
      console.warn(`链接目标不存在: ${link} (来自 ${currentPath})`);
      return;
    }

    // 确定链接的源和目标
    const source = linkType === 'outlink' ? currentPath : link;
    const target = linkType === 'outlink' ? link : currentPath;

    // 链接去重
    const linkKey = `${source}->${target}`;
    if (linkSet.has(linkKey)) {
      return;
    }

    // 检查源节点和目标节点是否都在图谱中
    const sourceExists = graph.nodes.some(node => node.id === source);
    const targetExists = graph.nodes.some(node => node.id === target);
    
    if (!sourceExists || !targetExists) {
      console.warn(`链接的节点不存在: ${source} -> ${target}`);
      return;
    }

    // 添加链接
    linkSet.add(linkKey);
    graph.links.push({ source, target });
  });
};

/**
 * 更新节点的连接计数
 */
export const updateLinkCounts = (graph: MapNodeLink): void => {
  graph.nodes.forEach((node) => {
    node.linkCount = graph.links.filter(link => 
      link.source === node.id || link.target === node.id
    ).length;
    node.isIsolated = node.linkCount === 0;
  });
};

/**
 * 设置当前节点标记
 */
export const setCurrentNode = (graph: MapNodeLink, currentPath: string): void => {
  graph.nodes.forEach(node => {
    node.isCurrent = node.id === currentPath;
  });
};