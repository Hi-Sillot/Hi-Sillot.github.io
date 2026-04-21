import type { Markdown } from "vuepress/markdown";
import type { PluginOptions, TagHandlers, VideoTabConfig } from "../types";
import { BuildLogger } from "../../build-logger";

const logger = new BuildLogger("SillotTabs");


export function extendSillotVideoTabs(
  md: Markdown,
  options: PluginOptions = {},
) {
  const tagHandlers: TagHandlers = {
    "video-tabs": (attrs, opts) => handleVideoTabs(attrs, opts),
  };

  md.core.ruler.before("normalize", "sillot-tabs", (state) => {
    const sillotCommentRegex = /<!--\s*sillot-([\w-]+)([\s\S]*?)-->/g;

    state.src = state.src.replace(
      sillotCommentRegex,
      (match, tagName, attrsStr) => {
        logger.log(`发现标签: ${tagName}`);

        const handler = tagHandlers[tagName];
        if (!handler) {
          logger.warn(`未找到处理器: ${tagName}`);
          return match;
        }

        const attrs = parseAttrs(attrsStr);
        // console.log(`[SillotTabs] 解析后的属性对象:`, attrs);

        const result = handler(attrs, options);
        // console.log(`[SillotTabs] 替换结果:`, result);
        return result;
      },
    );

    return true;
  });
}


/**
 * 工具函数：解析标签属性字符串为对象
 */
export function parseAttrs(attrsStr: string): Record<string, string> {
  const attrs: Record<string, string> = {};

  const attrRegex = /(\w+)=["']([^"']*)["']/g;

  const cleanAttrsStr = attrsStr
    .replace(/\n\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // console.log(`[SillotTabs] 清理后的属性字符串: "${cleanAttrsStr}"`);

  let match;
  while ((match = attrRegex.exec(cleanAttrsStr))) {
    const [, key, value] = match;
    if (key && value) {
      attrs[key] = value.trim();
      // console.log(`[SillotTabs] 解析属性: ${key} = "${attrs[key]}"`);
    }
  }

  return attrs;
}

/**
 * 处理视频标签，支持可选和重复项
 */
export function handleVideoTabs(
  attrs: Record<string, string>,
  pluginOptions: PluginOptions = {},
): string {
  // console.log(`[SillotTabs] 处理视频标签，接收属性:`, attrs);

  // 定义完整的默认平台配置（包含 attrKey）
  const defaultTabs: VideoTabConfig[] = [
    {
      title: "ArtPlayer",
      code: "artPlayer",
      height: "400px",
      autoMini: false, // 自动迷你存在兼容问题
      attrKey: "ap",
    },
    {
      title: "AcFun",
      code: "acfun",
      height: "432px",
      attrKey: "ac",
    },
    {
      title: "BiliBili",
      code: "bilibili",
      height: "432px",
      attrKey: "bb",
    },
  ];

  // 修复：深度合并配置，确保 attrKey 不被覆盖
  const userTabs = pluginOptions.videoTabs?.tabs || [];
  const mergedTabs: VideoTabConfig[] = defaultTabs.map((defaultTab) => {
    // 查找用户配置中对应的平台
    const userTab = userTabs.find((t) => t.code === defaultTab.code);
    if (userTab) {
      // 合并配置，但确保 attrKey 不被覆盖
      return {
        ...defaultTab, // 默认配置（包含 attrKey）
        ...userTab, // 用户配置
        attrKey: defaultTab.attrKey, // 强制保留默认的 attrKey
      };
    }
    return defaultTab;
  });

  const config = {
    tabs: mergedTabs,
  };

  // console.log(`[SillotTabs] 合并后的平台配置:`, config.tabs);

  const { active = config.tabs[0]?.title || "" } = attrs;

  logger.log(`active 属性值: "${active}"`);

  // 1. 筛选有效的视频平台（对应的属性值不为空）
  const validTabs = config.tabs.filter((tab) => {
    if (!tab || !tab.attrKey) {
      logger.warn("无效的平台配置:", tab);
      return false;
    }

    const value = attrs[tab.attrKey];
    const isValid = value && value.trim() !== "";
    logger.log(
      `检查平台 ${tab.attrKey} (${tab.title}): 值="${value}", 有效=${isValid}`,
    );
    return isValid;
  });

  logger.log(
    `有效平台数量: ${validTabs.length}`,
    validTabs.map((t) => t.title),
  );

  // 2. 检查合法性：至少需要2个有效视频才能生成tabs
  if (validTabs.length < 2) {
    logger.warn(
      `视频数量不足（${validTabs.length}个），需要至少2个视频才能生成标签页`,
    );
    return `<!-- 视频数量不足（${validTabs.length}个），需要至少2个视频才能生成标签页 -->`;
  }

  // 3. 生成Tabs格式的Markdown
  let markdown = "::: tabs\n\n";

  validTabs.forEach((tab: VideoTabConfig, index: number) => {
    if (!tab || !tab.attrKey) {
      logger.warn("跳过无效的平台:", tab);
      return;
    }

    const isActive = tab.title === active || (index === 0 && !active);
    const tabTitle = `${tab.title}`;

    markdown += `${isActive ? "@tab:active " : "@tab "}${tabTitle}\n\n`;

    // 处理重复项
    const videoValues = attrs[tab.attrKey].split(",").map((v) => v.trim())
      .filter((v) => v);

    videoValues.forEach((videoValue, videoIndex) => {
      switch (tab.code) {
        case "artPlayer":
          const autoMiniAttr = tab.autoMini ? " auto-mini" : "";
          markdown +=
            `@[artPlayer height="${tab.height}"${autoMiniAttr}](${videoValue})\n\n`;
          break;
        case "acfun":
          markdown += `@[acfun height="${tab.height}"](${videoValue})\n\n`;
          break;
        case "bilibili":
          markdown += `@[bilibili height="${tab.height}"](${videoValue})\n\n`;
          break;
        default:
          markdown += `<!-- 未支持的视频类型: ${tab.code} -->\n\n`;
      }
    });
  });

  markdown += ":::";
  return markdown;
}
