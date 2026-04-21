// temp-file-writer.ts - 重构版本
import type { App } from "vuepress/core";
import fs from "fs-extra";
import path from "path";
import { TEMP_FILE_NAMES } from "../constants/index";
import { debug } from "../utils/debug";

const TAG = "TempFileWriter";

/**
 * 临时文件写入器 - 重构版本
 */
export class TempFileWriter {
  /**
   * 写入图谱临时文件
   * VuePress 开发和构建过程中都会加载临时文件
   */
  public static async writeTempFile(app: App): Promise<void> {
    debug.log(TAG, "开始写入项目文件", {
      appTempDir: app.dir.temp(),
      appDestDir: app.dir.dest(),
    });

    try {
      let fileName = path.join(app.dir.temp(), `${TEMP_FILE_NAMES.BIO_TS}.js`);
      const content = this.generateBioFileContent(app.pages);
      await app.writeTemp(fileName, content);
      debug.log(TAG, "临时文件写入成功", {
        tempPath: fileName,
      });
    } catch (error) {
      debug.error(TAG, "写入项目文件失败", error);
      throw error;
    }
  }

  /**
   * 生成临时文件内容 - 增强版本
   */
  private static generateBioFileContent(pages: any[]): string {
    debug.log(TAG, "生成临时文件内容", {
      页面数: pages.length,
      // 示例页面: pages.slice(0, 3).map(p => ({
      //   path: p.path,
      //   title: p.title,
      //   permalink: p.permalink,
      //   linksCount: p.links?.length || 0
      // }))
    });

    // 过滤有效页面（有 permalink 的页面）
    const validPages = pages.filter((page) =>
      page.permalink && typeof page.permalink === "string"
    );

    const pagesData = validPages.map((page) => ({
      path: page.path,
      title: page.title || "未命名",
      filePathRelative: page.filePathRelative,
      htmlFilePathRelative: page.htmlFilePathRelative,
      permalink: page.permalink,
      links: (page.links || []).map((link: any) => ({
        raw: link.raw,
        absolute: link.absolute,
        relative: link.relative,
      })),
    }));

    return `// 自动生成的双链图谱数据文件
// 生成时间: ${new Date().toISOString()}
// 页面总数: ${pages.length}，有效页面: ${validPages.length}

export const pages = ${JSON.stringify(pagesData, null, 2)};

export const pageCount = ${pages.length};
export const validPageCount = ${validPages.length};

// 工具函数
export const getPageByPath = (path) => pages.find(p => p.path === path);
export const getPageByPermalink = (permalink) => pages.find(p => p.permalink === permalink);
export const getAllPages = () => pages;
export const getPageCount = () => pageCount;
export const getValidPageCount = () => validPageCount;

// 统计信息
export const stats = {
  totalPages: ${pages.length},
  validPages: ${validPages.length},
  totalLinks: ${
      pages.reduce((sum, page) => sum + (page.links?.length || 0), 0)
    },
  pagesWithLinks: ${
      pages.filter((page) => page.links && page.links.length > 0).length
    }
};

console.log('BiGraph: 数据文件加载完成', {
  总页面数: pageCount,
  有效页面数: validPageCount,
  统计信息: stats
});

// 默认导出
export default {
  pages,
  pageCount,
  validPageCount,
  getPageByPath,
  getPageByPermalink,
  getAllPages,
  getPageCount,
  getValidPageCount,
  stats
};
`;
  }

  /**
   * 检查临时文件是否存在
   */
  public static async checkTempFileExists(app: App): Promise<boolean> {
    try {
      // 检查项目根目录的临时文件
      let fileName = path.join(app.dir.temp(), `${TEMP_FILE_NAMES.BIO_TS}.js`);
      const exists = await fs.pathExists(fileName);

      debug.log(TAG, "检查临时文件存在性", {
        path: fileName,
        exists,
      });

      return exists;
    } catch (error) {
      debug.error(TAG, "检查临时文件失败", error);
      return false;
    }
  }
}
