// add to client.ts
import type { Router } from "vuepress/client";
import type { App } from "vue";
import { setup } from "@css-render/vue3-ssr";

// NaiveUI
import { NaiveUI } from "./modules/NaiveUi";
import TestNaiveUi from "./components/TestNaiveUi.vue";
// TDesign
import TDesign from "tdesign-vue-next";
import TestTDesign from "./components/TestTDesign.vue";
// 引入组件库的少量全局样式变量
import "tdesign-vue-next/es/style/index.css";

// 组件
import BannerTopArchived from "./plugins/vuepress-plugin-sillot-block/banner/components/BannerTopArchived.vue";
import BannerTopPrLock from "./plugins/vuepress-plugin-sillot-block/banner/components/BannerTopPrLock.vue";
import BannerTopPrNeed from "./plugins/vuepress-plugin-sillot-block/banner/components/BannerTopPrNeed.vue";
import VSCodeSettingsLink from "./plugins/vuepress-plugin-sillot-inline/components/VSCodeSettingsLink.vue";
import GithubLabel from "./plugins/vuepress-plugin-sillot-inline/components/GithubLabel.vue";
import C from "./plugins/vuepress-plugin-sillot-inline/components/Const.vue";
import TestRelationGraph from "./plugins/vuepress-plugin-sillot-vivime/components/TestRelationGraph.vue";
import IndexMe from "./plugins/vuepress-plugin-sillot-block/banner/components/IndexMe.vue";
import DirectoryLevel from "./plugins/vuepress-plugin-sillot-block/banner/components/DirectoryLevel.vue";
// 模板组件，一般不在 md 中使用，这里使用只是前期开发调试
import SSRComponent from "./components/templates/SSRComponent.vue";
import WebsiteCard from "./plugins/vuepress-plugin-sillot-block/card/WebsiteCard.vue";

interface EnhanceContext {
  app: App;
  router: Router;
}

export const components = {
  BannerTopArchived,
  BannerTopPrLock,
  BannerTopPrNeed,
  VSCodeSettingsLink,
  GithubLabel,
  C,
  TestNaiveUi,
  TestTDesign,
  TestRelationGraph,
  SSRComponent,
  IndexMe,
  DirectoryLevel,
  WebsiteCard,
} as const;

function registerGlobalComponents(app: App) {
  Object.entries(components).forEach(([name, component]) => {
    app.component(name, component);
  });
}

// 或者按需注册特定组件
function registerSpecificComponents(app: App, componentNames: string[]) {
  componentNames.forEach((name) => {
    if (name in components) {
      app.component(name, components[name as keyof typeof components]);
    }
  });
}

/**
 * 初始化 NaiveUI
 * ref https://www.naiveui.com/zh-CN/dark/docs/vitepress
 */
function setupNaiveUI(app: App, isSSR: boolean) {
  if (isSSR) {
    const { collect } = setup(app);
    app.provide("css-render-collect", collect);
  }

  app.use(NaiveUI); // https://www.naiveui.com/zh-CN/dark/docs/import-on-demand
}

/**
 * 初始化 TDesign
 */
function setupTDesign(app: App, isSSR: boolean) {
  app.use(TDesign);
}

/**
 * 初始化所有组件库
 */
export async function setupUI(context: EnhanceContext) {
  const { app, router } = context;
  //@ts-ignore
  const isSSR = import.meta.env.SSR;

  // 初始化 NaiveUI
  setupNaiveUI(app, isSSR);
  // 初始化 TDesign
  setupTDesign(app, isSSR);
  // app.use(TDesign);

  // 注册全局组件，不在 md 中使用则不需注册
  registerGlobalComponents(context.app);
}
