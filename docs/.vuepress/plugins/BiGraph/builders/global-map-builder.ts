import type { MapNodeLink, Node } from "../types";
import { debug } from "../utils/debug";
import { useBioChainStore } from "../stores/bioChain";
import { addNodeToGraph, updateLinkCounts } from "./base-map-builder";

const TAG = "GlobalMapBuilder";

export class GlobalMapBuilder {
  public static build(): MapNodeLink {
    debug.log(TAG, "开始构建全局图谱");
    const bioStore = useBioChainStore();

    const graph: MapNodeLink = {
      nodes: [],
      links: [],
    };

    const linkSet = new Set<string>();
    const keys = Object.keys(bioStore.bioChainMap);

    if (keys.length === 0) {
      debug.error(TAG, "生物链映射为空，无法构建全局图谱");
      return graph;
    }

    keys.forEach((path) => {
      addNodeToGraph(graph, path);
    });

    if (graph.nodes.length === 0) {
      debug.error(TAG, "没有成功添加任何节点到图谱中");
      return graph;
    }

    const nodeIndex = new Map<string, Node>();
    graph.nodes.forEach((n) => nodeIndex.set(n.id, n));

    keys.forEach((path) => {
      const item = bioStore.bioChainMap[path];
      if (item) {
        this.processNodeLinks(graph, linkSet, path, nodeIndex);
      }
    });

    updateLinkCounts(graph);

    const isolatedNodes = graph.nodes.filter(n => n.isIsolated).length;
    const connectedNodes = graph.nodes.length - isolatedNodes;

    debug.log(TAG, "全局图谱构建完成", {
      总节点数: graph.nodes.length,
      总链接数: graph.links.length,
      孤立节点数: isolatedNodes,
      连接节点数: connectedNodes,
      连接比例: graph.nodes.length > 0
        ? `${((connectedNodes / graph.nodes.length) * 100).toFixed(1)}%`
        : "0%"
    });

    return graph;
  }

  protected static processNodeLinks(
    graph: MapNodeLink,
    linkSet: Set<string>,
    path: string,
    nodeIndex: Map<string, Node>
  ): void {
    const bioStore = useBioChainStore();
    const bioItem = bioStore.bioChainMap[path];
    if (!bioItem) return;

    if (!nodeIndex.has(path)) return;

    bioItem.outlink.forEach((target) => {
      this.processSingleLink(graph, linkSet, path, target, 'outlink', nodeIndex);
    });

    bioItem.backlink.forEach((source) => {
      this.processSingleLink(graph, linkSet, path, source, 'backlink', nodeIndex);
    });
  }

  private static processSingleLink(
    graph: MapNodeLink,
    linkSet: Set<string>,
    currentPath: string,
    targetPath: string,
    linkType: 'outlink' | 'backlink',
    nodeIndex: Map<string, Node>
  ): boolean {
    const bioStore = useBioChainStore();
    if (!bioStore.bioChainMap[targetPath]) return false;

    const source = linkType === 'outlink' ? currentPath : targetPath;
    const target = linkType === 'outlink' ? targetPath : currentPath;

    const linkKey = `${source}->${target}`;
    if (linkSet.has(linkKey)) return false;

    if (!nodeIndex.has(source) || !nodeIndex.has(target)) return false;

    linkSet.add(linkKey);
    graph.links.push({ source, target });
    return true;
  }
}
