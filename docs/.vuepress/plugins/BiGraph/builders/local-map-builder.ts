// builders/local-map-builder.ts
import type { LocalMapItem, MapNodeLink, QueueItem, Node } from "../types";
import { optionsManager } from "../config/options";
import { useBioChainStore } from "../stores/bioChain";
import { updateLinkCounts } from "./base-map-builder";


/**
 * 本地图谱构建器
 */
export class LocalMapBuilder {
  /**
   * 生成本地图谱
   */
  public static generate(root: string): MapNodeLink {
const bioStore = useBioChainStore();
    // 检查根路径是否存在
    if (!bioStore.bioChainMap[root]) {
      // console.warn(`根路径不存在于映射中: ${root}`);
      return { nodes: [], links: [] };
    }

    const maxDeep = optionsManager.localGraphDeep || 3;
    const localMap: Record<string, LocalMapItem> = {};
    const queue: QueueItem[] = [{ permalink: root, depth: 0 }];
    const visited = new Set<string>();

    this.buildLocalMap(localMap, queue, visited, maxDeep);
    return this.convertToNodeLinkFormat(localMap);
  }

  /**
   * 构建本地映射
   */
  private static buildLocalMap(
    localMap: Record<string, LocalMapItem>,
    queue: QueueItem[],
    visited: Set<string>,
    maxDeep: number
  ): void {
    const bioStore = useBioChainStore();
    let head = 0;

    while (head < queue.length) {
      const { permalink, depth } = queue[head++];

      if (depth > maxDeep || visited.has(permalink)) {
        continue;
      }

      visited.add(permalink);

      if (!this.addNodeToLocalMap(localMap, permalink)) {
        continue;
      }

      const bioItem = bioStore.bioChainMap[permalink];
      if (!bioItem) continue;

      this.processLinks(queue, visited, bioItem.outlink, depth, maxDeep);
      this.processLinks(queue, visited, bioItem.backlink, depth, maxDeep);
    }
  }

  /**
   * 添加节点到本地映射
   */
  private static addNodeToLocalMap(localMap: Record<string, LocalMapItem>, permalink: string): boolean {
const bioStore = useBioChainStore();
    const bioItem = bioStore.bioChainMap[permalink];
    if (!bioItem) {
      console.warn(`无法找到路径对应的生物链项: ${permalink}`);
      return false;
    }

    localMap[permalink] = {
      ...bioItem,
      outlink: [...bioItem.outlink], // 复制数组
      backlink: [...bioItem.backlink] // 复制数组
    };

    return true;
  }

  /**
   * 处理链接
   */
  private static processLinks(
    queue: QueueItem[],
    visited: Set<string>,
    links: string[],
    currentDepth: number,
    maxDeep: number
  ): void {
    const nextDepth = currentDepth + 1;
    const bioStore = useBioChainStore();

    links.forEach((link) => {
      if (!bioStore.bioChainMap[link]) return;

      if (!visited.has(link) && nextDepth <= maxDeep) {
        queue.push({ permalink: link, depth: nextDepth });
      }
    });
  }

  /**
   * 转换为节点-链接格式
   */
  private static convertToNodeLinkFormat(localMap: Record<string, LocalMapItem>): MapNodeLink {
    const nodeLink: MapNodeLink = {
      nodes: [],
      links: [],
    };

    const linkSet = new Set<string>();

    Object.keys(localMap).forEach((key) => {
      const item = localMap[key];
      
      // 创建节点
      const node: Node = {
        id: key,
        value: item,
        linkCount: 0,
        isCurrent: false,
        isIsolated: false
      };
      
      nodeLink.nodes.push(node);

      // 处理出链
      item.outlink.forEach((target) => {
        const linkKey = `${key}->${target}`;
        if (!linkSet.has(linkKey) && localMap[target]) {
          linkSet.add(linkKey);
          nodeLink.links.push({ source: key, target: target });
        }
      });

      // 处理入链
      item.backlink.forEach((source) => {
        const linkKey = `${source}->${key}`;
        if (!linkSet.has(linkKey) && localMap[source]) {
          linkSet.add(linkKey);
          nodeLink.links.push({ source: source, target: key });
        }
      });
    });

    // 更新连接计数
    updateLinkCounts(nodeLink);

    return nodeLink;
  }
}