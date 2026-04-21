import type { Page, Plugin } from "@vuepress/core";
import { createPage } from "vuepress/core";
import type { Markdown } from "vuepress/markdown";
import { BuildLogger } from "../build-logger";

let TAG = "vuepress-plugin-sillot-site-design";
const logger = new BuildLogger(TAG);

/**
 * 插件入口
 * 添加页面ref: https://v2.vuepress.vuejs.org/zh/advanced/cookbook/adding-extra-pages.html#%E6%B7%BB%E5%8A%A0%E9%BB%98%E8%AE%A4%E7%9A%84%E4%B8%BB%E9%A1%B5
 */
export default (): Plugin => ({
  name: TAG, // 插件名称

  async onInitialized(app) {
    // 创建虚拟页面
    const virtualPage_pagefind = await createPage(app, {
      path: `/pagefind/`,
      frontmatter: {
        title: "PageFind",
        layout: "PagefindSearch",
        permalink: `/pagefind/`,
      },
      // 简单的 Markdown 内容，实际上会被组件覆写
      content: `# 搜索页面\n\n这是搜索页面。`,
    });
    logger.log("创建虚拟页面: /pagefind/");
    app.pages.push(virtualPage_pagefind);

    // 为所有页面注入 Pagefind 过滤器
    app.pages.forEach((page: Page) => {
      if (page.frontmatter) {
        const filterHTML = createPagefindFilters(page.frontmatter);

        if (filterHTML) {
          // 在页面内容开头注入过滤器 HTML
          page.content = filterHTML + page.content;

          logger.log(`为页面 ${page.path} 注入 Pagefind 过滤器`);
        }
      }
    });
  },
});

/**
 * 创建 Pagefind 过滤器 HTML
 * TODO: 过滤器没研究明白，有空再探索吧 https://pagefind.app/docs/filtering/
 */
function createPagefindFilters(frontmatter: Record<string, any>): string {
  const filters: string[] = [];

  // 作者过滤器
  if (frontmatter.author) {
    filters.push(
      `<span data-pagefind-filter="author">${frontmatter.author}</span>`,
    );
  }

  // 标签过滤器
  if (frontmatter.tags && Array.isArray(frontmatter.tags)) {
    frontmatter.tags.forEach((tag: string) => {
      filters.push(`<span data-pagefind-filter="tag">${tag}</span>`);
    });
  }

  // 分类过滤器
  if (frontmatter.category) {
    filters.push(
      `<span data-pagefind-filter="category">${frontmatter.category}</span>`,
    );
  }

  // 日期过滤器
  if (frontmatter.date) {
    filters.push(
      `<span data-pagefind-filter="date">${frontmatter.date}</span>`,
    );
  }

  // 自定义字段过滤器
  if (frontmatter.customField) {
    filters.push(
      `<span data-pagefind-filter="custom">${frontmatter.customField}</span>`,
    );
  }

  if (filters.length > 0) {
    return `<div style="display: none;">${filters.join("")}</div>`;
  }

  return "";
}
