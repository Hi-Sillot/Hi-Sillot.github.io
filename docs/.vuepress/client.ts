import { defineClientConfig } from "vuepress/client";

import { setupUI } from "./client.components";
import { setupPlugins } from "./client.plugins";
import Clarity from '@microsoft/clarity';
import Layout from "./layouts/Layout.vue";
import AuthorDetail from "./plugins/vuepress-plugin-sillot-author/components/AuthorDetailPage.vue";
import AuthorList from "./plugins/vuepress-plugin-sillot-author/components/AuthorListPage.vue";
import PagefindSearch from "./plugins/vuepress-plugin-sillot-site-design/pagefind/components/PagefindSearch.vue";
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
    PagefindSearch,
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

    router.addRoute({
      path: "/pagefind.html",
      component: PagefindSearch,
      name: "PagefindSearch",
    });

    console.log("页面搜索路由已注册");

    Clarity.init("ub9am2gcgh");
  },
});
