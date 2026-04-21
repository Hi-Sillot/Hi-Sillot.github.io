// utils/path-utils.ts - 路径处理工具

import path from "path";

/**
 * 路径工具类
 */
export class PathUtils {
  /**
   * 将Markdown路径转换为HTML路径
   */
  public static mdToHtmlPath(mdPath: string): string {
    const parsedLink = path.parse(mdPath);
    if (parsedLink.ext === '.md') {
      return path.format({ ...parsedLink, ext: '.html' });
    }
    return mdPath;
  }

  /**
   * 数组去重
   */
  public static uniqueArray<T>(array: T[]): T[] {
    return [...new Set(array)];
  }

  /**
 * 路径匹配工具函数
 */
public static isPathMatch(routePath: string, nodePath: string | null): boolean {
  if (!nodePath) return false;
  
  const decodedRoutePath = decodeURIComponent(routePath);
  const cleanRoutePath = decodedRoutePath.replace(/\.[^/.]+$/, "");
  const cleanNodePath = nodePath.replace(/\.[^/.]+$/, "");
  
  const normalizedRoutePath = cleanRoutePath.replace(/^\//, "");
  const normalizedNodePath = cleanNodePath.replace(/^\//, "");
  
  return normalizedRoutePath === normalizedNodePath;
}
}