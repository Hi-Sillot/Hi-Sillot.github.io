// plugins/vuepress-plugin-sillot-cedoss/index.ts

import type { Plugin } from "@vuepress/core";
import type { Markdown } from "vuepress/markdown";
import { handleCedossContainer } from "./handler/cedoss-container";
import { BuildLogger } from "../build-logger";

let TAG = "vuepress-plugin-sillot-cedoss";
const logger = new BuildLogger(TAG);

export default (): Plugin => {
  logger.log("插件加载成功");
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
