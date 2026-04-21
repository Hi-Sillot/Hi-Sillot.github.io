// plugins/vuepress-plugin-sillot-author/index.ts

import type { Page, Plugin } from "@vuepress/core";
import { createPage } from "vuepress/core";
import type { Markdown } from "vuepress/markdown";
import type { AuthorConfig, AuthorInfo, PostMeta } from "./types";
import { useAuthorStore } from "./stores/author";
import { BuildLogger } from "../build-logger";

let TAG = "vuepress-plugin-sillot-author";
const logger = new BuildLogger(TAG);
const authorMap = new Map<string, AuthorConfig>();

/**
 * 插件入口
 * 添加页面ref: https://v2.vuepress.vuejs.org/zh/advanced/cookbook/adding-extra-pages.html#%E6%B7%BB%E5%8A%A0%E9%BB%98%E8%AE%A4%E7%9A%84%E4%B8%BB%E9%A1%B5
 */
export default (): Plugin => ({
  name: TAG, // 插件名称

  async onInitialized(app) {
    logger.log("开始处理作者数据...");

    let processedCount = 0;

    app.pages.forEach((page: Page) => {
      const frontmatter = page.frontmatter as { author?: unknown };

      // 安全类型转换（处理多种格式）
      const authors: AuthorInfo[] = [];
      if (Array.isArray(frontmatter.author)) {
        authors.push(
          ...frontmatter.author.filter((a) => typeof a === "object"),
        );
      } else if (typeof frontmatter.author === "object") {
        authors.push(frontmatter.author as AuthorInfo);
      } else if (typeof frontmatter.author === "string") {
        authors.push({
          name: frontmatter.author,
          slug: frontmatter.author.toLowerCase().replace(/\s+/g, "-"),
        });
      }

      // 调试输出（输出到构建终端）
      if (authors.length > 0) {
        logger.log(
          `在页面 ${page.path} 中发现 ${authors.length} 位作者`,
        );
        authors.forEach((a) => {
          logger.log(`  作者: ${a.name} (${a.slug})`);
        });
      }

      authors.forEach((author) => {
        const slug = author.slug ||
          author.name.toLowerCase().replace(/\s+/g, "-");
        const postMeta: PostMeta = {
          title: page.title || "Untitled",
          path: page.path,
          date: String(page.data.frontmatter.createTime) || page.date,
        };

        if (!authorMap.has(slug)) {
          authorMap.set(slug, {
            ...author,
            slug, // 确保slug存在
            posts: [postMeta],
          });
        } else {
          authorMap.get(slug)!.posts.push(postMeta);
        }
        processedCount++;
      });
    });
    logger.log(`共处理 ${processedCount} 位作者关联`);

     // 为每个作者创建虚拟页面
    const authorPages: Page[] = [];
    
    for (const [slug, authorConfig] of authorMap) {
      try {
        const virtualPage = await createPage(app, {
          path: `/authors/${slug}/`,
          frontmatter: {
            title: authorConfig.name,
            layout: 'AuthorDetail',
            permalink: `/authors/${slug}/`,
            author: authorConfig, // 将作者数据存入 frontmatter
          },
          // 简单的 Markdown 内容，实际上会被组件覆写
          content: `# ${authorConfig.name}\n\n这是 ${authorConfig.name} 的作者页面。`,
        });
        authorPages.push(virtualPage);
        logger.log(`创建虚拟作者页面: /authors/${slug}/`);
      } catch (error) {
        logger.error(`创建作者页面失败 (${slug}):`, error);
      }
    }
    const virtualPage_authors = await createPage(app, {
          path: `/authors/`,
          frontmatter: {
            title: 'Authors',
            layout: 'AuthorList',
            permalink: `/authors/`,
          },
          // 简单的 Markdown 内容，实际上会被组件覆写
          content: `# 作者页面\n\n这是作者页面。`,
        });
        authorPages.push(virtualPage_authors);
        logger.log("创建虚拟作者页面: /authors/");
    // 一次性添加所有虚拟页面
    app.pages.push(...authorPages);
    logger.log(`已添加 ${authorMap.size} 个虚拟作者页面`);

    // 写入TS格式的临时文件
    await app.writeTemp(
      "author-data.ts",
      `import type { AuthorConfig } from '../plugins/vuepress-plugin-sillot-author/types';\n` +
        `export default ${
          JSON.stringify(Object.fromEntries(authorMap))
        } as Record<string, AuthorConfig>;`,
    );

    logger.log("作者数据已写入临时文件");
  },

});

