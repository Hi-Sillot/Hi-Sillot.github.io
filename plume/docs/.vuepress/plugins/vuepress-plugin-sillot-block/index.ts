// plugins/vuepress-plugin-sillot-block/index.ts

import type { Plugin } from "@vuepress/core";
import type { Markdown } from "vuepress/markdown";
import { extendSillotVideoTabs, handleVideoTabs, parseAttrs } from "./tabs/sillot-video-tabs";
import { initIndexMe } from "./banner/indexMe";

let TAG = "vuepress-plugin-sillot-block";

/**
 * 插件入口
 */
export default (options: PluginOptions = {}): Plugin => {
  console.log(`[${TAG}] 插件加载成功`, JSON.stringify(options));
  return {
    name: "vuepress-plugin-sillot-tabs", // 插件名称

    async onInitialized(app) {
      initIndexMe(app);
    },

    extendsMarkdown: (md: Markdown) => {
      extendSillotVideoTabs(md, options);
    },
  };
};
