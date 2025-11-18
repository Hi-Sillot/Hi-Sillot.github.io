import { defineClientConfig } from "vuepress/client";

import { setupUI } from "./client.components";
import { setupPlugins } from "./client.plugins";

// 布局
import Layout from "./layouts/Layout.vue";
import AuthorDetail from "./plugins/vuepress-plugin-sillot-author/components/AuthorDetailPage.vue";
import AuthorList from "./plugins/vuepress-plugin-sillot-author/components/AuthorListPage.vue";
// 样式
import "./styles/index.css";

/**
 * vuepress 的 SSR 兼容参考 https://vitepress.dev/zh/guide/ssr-compat
 */
export default defineClientConfig({
  setup() {
  },
  layouts: {
    Layout,
    // 声明自定义布局，否则无法全局使用（布局是在文章 formatter 中使用的，不同于组件在正文使用）
    AuthorList,
    AuthorDetail,
  },
  async enhance({ app, router }) {
    await setupUI({ app, router });
    await setupPlugins({ app, router });

    // 路由注册（因为涉及布局组件，保留在主配置中更清晰）
    router.addRoute({
      path: "/authors.html",
      component: AuthorList,
      name: "AuthorList",
    });

    router.addRoute({
      path: "/authors/:pathMatch(.*)*",
      component: AuthorDetail,
      name: "AuthorDetailCatchAll",
    });

    console.log("作者详情页路由已注册");
  },
});
