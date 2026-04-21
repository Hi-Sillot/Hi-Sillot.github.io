// utils/path-utils.ts - 路径处理工具

export class PathUtils {
  public static mdToHtmlPath(mdPath: string): string {
    if (mdPath.endsWith('.md')) {
      return mdPath.replace(/\.md$/, '.html');
    }
    return mdPath;
  }

  public static uniqueArray<T>(array: T[]): T[] {
    return [...new Set(array)];
  }

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