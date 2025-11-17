// plugins/vuepress-plugin-sillot-block/index.ts

import type { Plugin } from "@vuepress/core";
import type { Markdown } from "vuepress/markdown";
import { handleVideoTabs, parseAttrs } from "./tabs/sillot-video-tabs";



/**
 * 插件入口
 */
export default (options: PluginOptions = {}): Plugin => {
  console.log("[SillotTabs] 插件加载成功", JSON.stringify(options));
  return {
    name: "vuepress-plugin-sillot-tabs",  // 插件名称

    extendsMarkdown: (md: Markdown) => {
      const tagHandlers: TagHandlers = {
        "video-tabs": (attrs, opts) => handleVideoTabs(attrs, opts),
      };

      md.core.ruler.before('normalize', 'sillot-tabs', (state) => {
        const sillotCommentRegex = /<!--\s*sillot-([\w-]+)([\s\S]*?)-->/g;
        
        state.src = state.src.replace(sillotCommentRegex, (match, tagName, attrsStr) => {
          console.log(`[SillotTabs] 发现标签: ${tagName}`);
          
          const handler = tagHandlers[tagName];
          if (!handler) {
            console.warn(`[SillotTabs] 未找到处理器: ${tagName}`);
            return match;
          }

          const attrs = parseAttrs(attrsStr);
          console.log(`[SillotTabs] 解析后的属性对象:`, attrs);
          
          const result = handler(attrs, options);
          console.log(`[SillotTabs] 替换结果:`, result);
          return result;
        });
        
        return true;
      });
    },
  };
};