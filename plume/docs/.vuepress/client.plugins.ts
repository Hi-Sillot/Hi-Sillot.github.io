import type { Router } from 'vuepress/client'
import type { App } from 'vue'
import { createPinia } from "pinia";
import piniaPluginPersistedstate from "pinia-plugin-persistedstate";
import { setup } from "@css-render/vue3-ssr";

// NaiveUI
import { NaiveUI } from "./modules/NaiveUi";

// 作者插件
import { useAuthorStore } from "./plugins/vuepress-plugin-sillot-author/stores/author";

// BiGraph 插件
import { useBioChainStore } from "./plugins/BiGraph/stores/bioChain";
import { TEMP_FILE_NAMES } from "./plugins/BiGraph/constants/index";
import { BioChainService } from "./plugins/BiGraph/services/bio-chain-service";

interface EnhanceContext {
  app: App;
  router: Router;
}

/**
 * 初始化 Pinia 状态管理
 */
export function setupPinia(app: App, isSSR: boolean) {
  const pinia = createPinia();

  if (!isSSR) {
    pinia.use(piniaPluginPersistedstate);
  }

  app.use(pinia);
  return pinia;
}

/**
 * 初始化 NaiveUI
 * ref https://www.naiveui.com/zh-CN/dark/docs/vitepress
 */
export function setupNaiveUI(app: App, isSSR: boolean) {
  if (isSSR) {
    const { collect } = setup(app);
    app.provide("css-render-collect", collect);
  }
  
  app.use(NaiveUI); // https://www.naiveui.com/zh-CN/dark/docs/import-on-demand
}

/**
 * 初始化作者插件
 */
export async function setupAuthorPlugin(app: App, router: Router) {

  // 初始化存储
  const authorStore = useAuthorStore();
  
  try {
    // @ts-ignore
    const authorData = await import("@temp/author-data.ts");
    console.log("@temp/author-data.ts ok", authorData.default);
    authorStore.setAuthors(authorData.default);
  } catch (error) {
    console.warn("作者数据加载失败:", error);
  }

  // 路由守卫处理
  router.beforeEach((to) => {
    if (to.path.startsWith("/authors.html") || (to.path.startsWith("/authors/") && !to.path.endsWith("/"))) {
      // 自动添加尾部斜杠，确保与创建的页面路径一致 authors/a.thml -> authors/a/
      const normalizedPath = to.path.endsWith("/") ? to.path : to.path + "/";
      if (normalizedPath !== to.path) {
        return normalizedPath.replace('.html', '');
      }
    }
  });
  console.log("作者插件初始化完成");
}

/**
 * 初始化 BiGraph 插件
 */
export async function setupBiGraphPlugin() {
  const bioStore = useBioChainStore();
  
  try {
    // @ts-ignore
    const bioData = await import(`./.temp/${TEMP_FILE_NAMES.BIO_TS}.js`);
    console.log(`@temp/${TEMP_FILE_NAMES.BIO_TS}.js ok`, {
      页面数: bioData.pageCount,
      有效页面数: bioData.validPageCount,
    }, bioData.default);
    
    bioStore.BiGraph = bioData.default;
    BioChainService.build(bioStore.BiGraph!.getAllPages());
  } catch (error) {
    console.warn("BiGraph 数据加载失败:", error);
  }
}

/**
 * 初始化所有插件
 */
export async function setupPlugins(context: EnhanceContext) {
  const { app, router } = context;
  //@ts-ignore
  const isSSR = import.meta.env.SSR;

  // 1. 初始化 Pinia
  setupPinia(app, isSSR);

  // 2. 初始化 NaiveUI
  setupNaiveUI(app, isSSR);

  // 3. 初始化作者插件
  await setupAuthorPlugin(app, router);

  // 4. 初始化 BiGraph 插件
  await setupBiGraphPlugin();
}