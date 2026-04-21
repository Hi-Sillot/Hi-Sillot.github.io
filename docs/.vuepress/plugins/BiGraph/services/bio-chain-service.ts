// services/bio-chain-service.ts
import { useBioChainStore } from "../stores/bioChain";
import type { Page } from "../types";
import { debug } from "../utils/debug";
import type { MarkdownLink } from "vuepress/markdown";

const TAG = "BioChainService";

/**
 * 双链构建服务 - 修复链接解析问题
 */
export class BioChainService {
  /**
   * 构建双链映射
   */
  public static async build(pages: Page[], titleGetter?: (page: Page) => string): Promise<void> {
    debug.log(TAG, '开始构建双链映射', { 
      总页面数: pages.length,
      有permalink的页面数: pages.filter(p => p.permalink).length
    });

    try {
      const validPages = this.filterValidPages(pages);
      debug.log(TAG, '有效页面数', validPages.length);

      this.buildBioChainMap(validPages, titleGetter);
      this.processPageLinks(validPages);

      // 输出详细的调试信息
      this.printDetailedStatistics(validPages);
      
      debug.log(TAG, '双链映射构建完成');
    } catch (error) {
      debug.error(TAG, '构建双链映射失败', error);
      throw error;
    }
  }

  /**
   * 过滤有效页面
   */
  private static filterValidPages(pages: Page[]): Page[] {
    const validPages = pages.filter(page => 
      page.permalink && typeof page.permalink === 'string'
    );
    
    debug.log(TAG, '页面过滤结果', {
      总页面: pages.length,
      有效页面: validPages.length,
      无效页面: pages.length - validPages.length
    });

    return validPages;
  }

  /**
   * 构建双链映射
   */
  private static buildBioChainMap(pages: Page[], titleGetter?: (page: Page) => string): void {
    debug.log(TAG, '开始构建生物链映射');
    const bioStore = useBioChainStore();

    // 清空现有映射
    bioStore.bioChainMap = {};

    pages.forEach((page, index) => {
      const title = titleGetter 
        ? titleGetter(page) 
        : page.title || page.filePathRelative || '未命名';

      // 直接使用原始的 permalink 作为键
      const permalink = page.permalink!;
      
      bioStore.bioChainMap[permalink] = {
        title,
        filePathRelative: page.filePathRelative,
        htmlFilePathRelative: page.htmlFilePathRelative,
        permalink: permalink,
        outlink: [],
        backlink: [],
      };

      if (index < 3) {
        debug.log(TAG, `添加页面 ${index + 1}/${pages.length}`, {
          permalink: permalink,
          标题: title,
          文件路径: page.filePathRelative,
          HTML路径: page.htmlFilePathRelative
        });
      }
    });

    debug.log(TAG, '生物链映射构建完成', {
      映射项数: Object.keys(bioStore.bioChainMap).length
    });
  }

  /**
   * 处理页面链接
   */
  private static processPageLinks(pages: Page[]): void {
    debug.log(TAG, '开始处理页面链接');

    let totalLinks = 0;
    let validLinks = 0;
    let resolvedLinks = 0;
    let unresolvedLinks = 0;

    pages.forEach((page, pageIndex) => {
      const sourcePermalink = page.permalink!;
      const links = this.extractValidLinks(page);
      
      totalLinks += page.links?.length || 0;
      validLinks += links.length;

      links.forEach(link => {
        const resolvedPermalink = this.resolveLinkTarget(link.relative, pages);
        if (resolvedPermalink) {
          this.updateLinkRelationships(sourcePermalink, resolvedPermalink);
          resolvedLinks++;
          
          if (resolvedLinks <= 5) { // 只记录前5个解析成功的链接用于调试
            debug.log(TAG, '链接解析成功', {
              源页面: sourcePermalink,
              原始链接: link.relative,
              解析结果: resolvedPermalink
            });
          }
        } else {
          unresolvedLinks++;
          if (unresolvedLinks <= 5) { // 只记录前5个解析失败的链接用于调试
            debug.warn(TAG, '无法解析链接', {
              源页面: sourcePermalink,
              链接目标: link.relative
            });
          }
        }
      });
    });

    debug.log(TAG, '页面链接处理完成', {
      总链接数: totalLinks,
      有效链接数: validLinks,
      成功解析: resolvedLinks,
      解析失败: unresolvedLinks,
      解析率: `${((resolvedLinks / validLinks) * 100).toFixed(1)}%`
    });
  }

  /**
   * 解析链接目标到 permalink
   */
  private static resolveLinkTarget(linkRelative: string, pages: Page[]): string | null {
    if (!linkRelative) return null;

    const bioStore = useBioChainStore();
    
    // 1. 直接检查 permalink 是否存在
    if (bioStore.bioChainMap[linkRelative]) {
      return linkRelative;
    }

    // 2. 检查是否是文件路径
    const filePathMatch = pages.find(page => 
      page.filePathRelative === linkRelative
    );
    if (filePathMatch) {
      return filePathMatch.permalink!;
    }

    // 3. 检查是否是 HTML 文件路径
    const htmlPathMatch = pages.find(page => 
      page.htmlFilePathRelative === linkRelative
    );
    if (htmlPathMatch) {
      return htmlPathMatch.permalink!;
    }

    // 4. 尝试处理常见的路径格式问题
    return this.handleCommonPathIssues(linkRelative, pages);
  }

  /**
   * 处理常见的路径问题
   */
  private static handleCommonPathIssues(linkRelative: string, pages: Page[]): string | null {
    const bioStore = useBioChainStore();
    
    // 尝试添加/移除前导斜杠
    const variations = [
      linkRelative,
      linkRelative.startsWith('/') ? linkRelative.substring(1) : '/' + linkRelative,
    ];

    // 尝试处理 .md 扩展名
    if (linkRelative.endsWith('.md')) {
      variations.push(linkRelative.replace(/\.md$/, ''));
    } else {
      variations.push(linkRelative + '.md');
    }

    // 尝试处理 index 文件
    if (linkRelative.endsWith('/index')) {
      variations.push(linkRelative.replace(/\/index$/, ''));
      variations.push(linkRelative.replace(/\/index$/, '/'));
    }

    if (linkRelative.endsWith('/index.md')) {
      variations.push(linkRelative.replace(/\/index\.md$/, ''));
      variations.push(linkRelative.replace(/\/index\.md$/, '/'));
    }

    // 检查所有变体
    for (const variation of variations) {
      if (bioStore.bioChainMap[variation]) {
        debug.log(TAG, '通过路径变体解析链接', {
          原始链接: linkRelative,
          使用变体: variation
        });
        return variation;
      }
      
      // 也检查页面列表中的其他路径
      const pageMatch = pages.find(page => 
        page.permalink === variation ||
        page.filePathRelative === variation ||
        page.htmlFilePathRelative === variation
      );
      if (pageMatch) {
        return pageMatch.permalink!;
      }
    }

    return null;
  }

  /**
   * 提取有效链接
   */
  private static extractValidLinks(page: Page): MarkdownLink[] {
    return (page.links || []).filter(link => 
      link && link.relative && typeof link.relative === 'string'
    );
  }

  /**
   * 更新链接关系
   */
  private static updateLinkRelationships(sourcePermalink: string, targetPermalink: string): void {
    const bioStore = useBioChainStore();
    try {
      // 确保源节点存在
      if (!bioStore.bioChainMap[sourcePermalink]) {
        debug.warn(TAG, `源节点不存在: ${sourcePermalink}`);
        return;
      }

      // 确保目标节点存在
      if (!bioStore.bioChainMap[targetPermalink]) {
        debug.warn(TAG, `目标节点不存在: ${targetPermalink}`);
        return;
      }

      // 避免自引用
      if (sourcePermalink === targetPermalink) {
        return;
      }

      // 更新正向链接
      const sourceItem = bioStore.bioChainMap[sourcePermalink]!;
      if (!sourceItem.outlink.includes(targetPermalink)) {
        sourceItem.outlink.push(targetPermalink);
      }

      // 更新反向链接
      const targetItem = bioStore.bioChainMap[targetPermalink]!;
      if (!targetItem.backlink.includes(sourcePermalink)) {
        targetItem.backlink.push(sourcePermalink);
      }

    } catch (error) {
      debug.error(TAG, `更新链接关系失败: ${sourcePermalink} -> ${targetPermalink}`, error);
    }
  }

  /**
   * 打印详细统计信息
   */
  private static printDetailedStatistics(pages: Page[]): void {
    const bioStore = useBioChainStore();
    const map = bioStore.bioChainMap;
    const keys = Object.keys(map);
    
    let totalOutlinks = 0;
    let totalBacklinks = 0;
    let nodesWithLinks = 0;

    // 收集所有链接用于分析
    const allLinks = new Map<string, {source: string, target: string}[]>();

    keys.forEach(key => {
      const item = map[key];
      totalOutlinks += item.outlink.length;
      totalBacklinks += item.backlink.length;
      
      if (item.outlink.length > 0 || item.backlink.length > 0) {
        nodesWithLinks++;
      }

      // 记录出链
      item.outlink.forEach(target => {
        if (!allLinks.has(key)) {
          allLinks.set(key, []);
        }
        allLinks.get(key)!.push({source: key, target});
      });
    });

    // 检查潜在的重复或冲突
    const linkCounts = new Map<string, number>();
    allLinks.forEach((links, source) => {
      links.forEach(link => {
        const linkKey = `${link.source}->${link.target}`;
        linkCounts.set(linkKey, (linkCounts.get(linkKey) || 0) + 1);
      });
    });

    const duplicateLinks = Array.from(linkCounts.entries())
      .filter(([_, count]) => count > 1)
      .map(([link]) => link);

    debug.log(TAG, '双链构建详细统计', {
      总节点数: keys.length,
      有链接的节点数: nodesWithLinks,
      孤立节点数: keys.length - nodesWithLinks,
      总出链数: totalOutlinks,
      总入链数: totalBacklinks,
      重复链接数: duplicateLinks.length
    });

    // 输出一些示例用于调试
    if (keys.length > 0) {
      debug.table(TAG, 
        keys.slice(0, 5).map(key => {
          const item = map[key];
          return {
            permalink: key,
            标题: item.title,
            文件路径: item.filePathRelative,
            出链数: item.outlink.length,
            入链数: item.backlink.length,
            出链示例: item.outlink.slice(0, 3),
            入链示例: item.backlink.slice(0, 3)
          };
        }),
        "前5个节点详情"
      );
    }

    if (duplicateLinks.length > 0) {
      debug.warn(TAG, '发现重复链接', duplicateLinks.slice(0, 10));
    }
  }
}