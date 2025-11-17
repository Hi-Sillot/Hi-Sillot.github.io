// add to config.ts
import { llmsPlugin } from "@vuepress/plugin-llms"; // 为你的站点添加 llms.txt，以提供对 LLM 友好的内容。https://ecosystem.vuejs.press/zh/plugins/ai/llms.html
import { revealJsPlugin } from "@vuepress/plugin-revealjs"; // 在你的 VuePress 中添加幻灯片
import { slimsearchPlugin } from "@vuepress/plugin-slimsearch";
import BiGraph from "./plugins/BiGraph/client/index";
import AuthorPlugin from "./plugins/vuepress-plugin-sillot-author";
import SillotBlockPlugin from "./plugins/vuepress-plugin-sillot-block";
import { Jieba } from "@node-rs/jieba";
import { dict } from "@node-rs/jieba/dict.js";

// Initialize Jieba with the default dictionary
const jieba = Jieba.withDict(dict);

export default [
    llmsPlugin({
      // 配置项
    }),
    // 注册Sillot标签插件（传入自定义配置）
    SillotBlockPlugin({
      videoTabs: {},
    }),
    AuthorPlugin(),
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
    slimsearchPlugin({
      indexContent: true,
      suggestion: true,
      indexOptions: {
        tokenize: (text, fieldName) => {
          return fieldName === "id" ? [text] : jieba.cut(text, true);
        },
      },
      customFields: [
        {
          name: "author",
          //@ts-ignore
          getter: (page) => page.frontmatter.author,
          formatter: "作者：$content",
        },
      ],
    }),
  ]