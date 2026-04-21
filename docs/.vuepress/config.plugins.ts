// add to config.ts

import { revealJsPlugin } from "@vuepress/plugin-revealjs"; // 在你的 VuePress 中添加幻灯片
import { slimsearchPlugin } from "@vuepress/plugin-slimsearch";
import BiGraph from "./plugins/BiGraph/client/index";
import AuthorPlugin from "./plugins/vuepress-plugin-sillot-author";
import SiteDesign from "./plugins/vuepress-plugin-sillot-site-design";
import SillotBlockPlugin from "./plugins/vuepress-plugin-sillot-block";
import vuepressPluginSillotCedoss from "./plugins/vuepress-plugin-sillot-cedoss";
import ObsidianBridgePlugin from "./plugins/vuepress-plugin-sillot-obsidian-bridge";
import { Jieba } from "@node-rs/jieba";
import { dict } from "@node-rs/jieba/dict.js";

// Initialize Jieba with the default dictionary
const jieba = Jieba.withDict(dict);

export default [
  vuepressPluginSillotCedoss(),
  // 注册Sillot标签插件（传入自定义配置）
  SillotBlockPlugin({
    videoTabs: {},
  }),
  ObsidianBridgePlugin(),
  AuthorPlugin(),
  SiteDesign(),
  BiGraph({
    localGraphDeep: 20,
    foldEmptyGraph: false, // 无链接时不隐藏，方便打开全局图
    graphMaxWidth: 250,
    graphHeight: 220,
  }),
  revealJsPlugin({
    // 插件选项
  }),
  // 分词构建后也生效，docs:preview 未生效可能是缓存问题
  // 2025年12月13日更新后error TypeError: Cannot read properties of undefined (reading 'lang')，暂时懒得排查，反正静态搜索都差强人意
  // slimsearchPlugin({
  //   indexContent: true,
  //   suggestion: true,
  //   indexOptions: {
  //     tokenize: (text, fieldName) => {
  //       return fieldName === "id" ? [text] : jieba.cut(text, true);
  //     },
  //   },
  //   customFields: [
  //     {
  //       name: "author",
  //       //@ts-ignore
  //       getter: (page) => page.frontmatter.author,
  //       formatter: "作者：$content",
  //     },
  //   ],
  // }),
];
