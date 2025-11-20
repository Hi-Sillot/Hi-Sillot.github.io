// plugins/vuepress-plugin-sillot-cedoss/index.ts

import type { Plugin } from "@vuepress/core";
import type { Markdown } from "vuepress/markdown";
import { handleCedossContainer } from "./handler/cedoss-container";

let TAG = "vuepress-plugin-sillot-cedoss";

/**
 * 插件入口
 */
export default (): Plugin => {
  console.log(`[${TAG}] 插件加载成功`);
  return {
    name: TAG, // 插件名称

    async onInitialized(app) {
      //
    },

    extendsMarkdown: (md: Markdown) => {
      // 方案1：使用最小版本（最可靠）
      handleCedossContainer(md, {
        debug: false,
        removeContainerMarkers: true,
      });
    },
  };
};
