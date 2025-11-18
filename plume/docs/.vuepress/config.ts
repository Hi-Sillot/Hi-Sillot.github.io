/**
 * 查看以下文档了解主题配置
 * - @see https://theme-plume.vuejs.press/config/intro/ 配置说明
 * - @see https://theme-plume.vuejs.press/config/theme/ 主题配置项
 *
 * 请注意，对此文件的修改都会重启 vuepress 服务。
 * 部分配置项的更新没有必要重启 vuepress 服务，建议请在 `.vuepress/config.ts` 文件中配置
 *
 * 特别的，请不要在两个配置文件中重复配置相同的项，当前文件的配置项会被覆盖
 */

import { viteBundler } from "@vuepress/bundler-vite";
import { defineUserConfig } from "vuepress";
import { plumeTheme } from "vuepress-theme-plume";
import MyPlugins from "./config.plugins"


export default defineUserConfig({
  port: 5858,
  base: "/", // https://theme-plume.vuejs.press/guide/deployment/#github-pages
  lang: "zh-CN",
  title: "汐洛 🦢",
  description: "平平淡淡才是真",

  head: [
    // 配置站点图标
    ["link", { rel: "icon", type: "image/ico", href: "../assets/icon.ico" }],
  ],

  bundler: viteBundler({
    viteOptions: {
      server: {
        allowedHosts: true,
        // allowedHosts: ['pc.sc']
      },
      ssr: {
        noExternal: ["naive-ui", "date-fns", "vueuc"], // 'date-fns', 'vueuc' 是 naive-ui 的依赖
      },
    },
    devServer: {
      // 关键配置：为所有响应添加CORS头
      headers: {
        "Access-Control-Allow-Origin": "*", // 允许所有源跨域
      },
    },
  }),
  shouldPrefetch: false, // 站点较大，页面数量较多时，不建议启用

  plugins: MyPlugins,

  // 在构建开始时，顺序在 plugins 之后
  onInitialized: (app) => {
    if (process.env.NODE_ENV === "production") {
      // console.log('开始执行构建时任务')
    }
  },

  // 现在任何带有 `.snippet.md` 扩展名的文件都不会呈现为页面
  pagePatterns: ["**/*.md", "!**/*.snippet.md", "!.vuepress", "!node_modules"],

  theme: plumeTheme({
    /* 添加您的部署域名, 有助于 SEO, 生成 sitemap */
    hostname: "https://sillot.hwd.deno.net/",

    /* 文档仓库配置，用于 editLink */
    docsRepo: "https://github.com/Hi-Sillot/docs",
    docsDir: "plume/docs",
    docsBranch: "main",

    /* 页内信息 */
    editLink: true,
    lastUpdated: {},
    contributors: {
      mode: "block",
    },
    changelog: {
      maxCount: 10,
    },

    plugins: {
      // 如果您在此处直接声明为 true，则表示开发环境和生产环境都启用该功能
      git: true, // 项目大到感知强烈时禁用
      // git: process.env.NODE_ENV === 'production'
    },

    /**
     * 编译缓存，加快编译速度
     * @see https://theme-plume.vuejs.press/config/basic/#cache
     */
    cache: "filesystem",

    /**
     * 为 markdown 文件自动添加 frontmatter 配置
     * @see https://theme-plume.vuejs.press/config/basic/#autofrontmatter
     */
    autoFrontmatter: {
      permalink: true, // 是否生成永久链接
      createTime: true, // 是否生成创建时间
      title: true, // 是否生成标题
    },

    /* 本地搜索, 默认启用 */
    search: false, //{ provider: 'local' },

    /**
     * Algolia DocSearch
     * 启用此搜索需要将 本地搜索 search 设置为 false
     * @see https://theme-plume.vuejs.press/config/plugins/search/#algolia-docsearch
     */
    // search: {
    //   provider: 'algolia',
    //   appId: '',
    //   apiKey: '',
    //   indices: [''],
    // },

    /**
     * Shiki 代码高亮
     * @see https://theme-plume.vuejs.press/config/plugins/code-highlight/
     */
    codeHighlighter: {
      // twoslash: true, // 启用 twoslash
      whitespace: true, // 启用 空格/Tab 高亮
      lineNumbers: true, // 启用行号
    },

    /* 文章字数统计、阅读时间，设置为 false 则禁用 */
    readingTime: {},

    /**
     * markdown
     * @see https://theme-plume.vuejs.press/config/markdown/
     */
    markdown: {
      include: {}, // 启用引入其他 markdown 文件内容
      codeTree: true, // 启用代码目录树
      abbr: true, // 启用 abbr 语法  *[label]: content
      annotation: true, // 启用 annotation 语法  [+label]: content
      pdf: true, // 启用 PDF 嵌入 @[pdf](/xxx.pdf)
      caniuse: true, // 启用 caniuse 语法  @[caniuse](feature_name)
      plot: true, // 启用隐秘文本语法 !!xxxx!!
      bilibili: true, // 启用嵌入 BiliBILI视频 语法 @[BiliBILI](bid)
      acfun: true, // 启用嵌入 acfun视频 语法 @[acfun](aid)
      youtube: true, // 启用嵌入 youtube视频 语法 @[youtube](video_id)
      artPlayer: true, // 启用嵌入 artPlayer 本地视频 语法 @[artPlayer](url)
      audioReader: true, // 启用嵌入音频朗读功能 语法 @[audioReader](url)
      icon: { provider: "iconify" }, // 启用内置图标语法  ::icon-name::
      table: true, // 启用表格增强容器语法 ::: table
      codepen: true, // 启用嵌入 codepen 语法 @[codepen](user/slash)
      replit: true, // 启用嵌入 replit 语法 @[replit](user/repl-name)
      codeSandbox: true, // 启用嵌入 codeSandbox 语法 @[codeSandbox](id)
      jsfiddle: true, // 启用嵌入 jsfiddle 语法 @[jsfiddle](user/id)
      npmTo: ["pnpm", "yarn", "npm", "bun", "deno"], // 启用 npm-to 容器  ::: npm-to
      demo: true, // 启用 demo 容器  ::: demo
      repl: { // 启用 代码演示容器
        go: true, // ::: go-repl
        rust: true, // ::: rust-repl
        kotlin: true, // ::: kotlin-repl
        python: true, // ::: python-repl
      },
      math: { // 启用数学公式
        type: "katex",
      },
      chartjs: true, // 启用 chart.js
      echarts: true, // 启用 ECharts
      mermaid: true, // 启用 mermaid
      flowchart: true, // 启用 flowchart
      image: {
        figure: true, // 启用 figure
        lazyload: true, // 启用图片懒加载
        mark: true, // 启用图片标记
        size: true, // 启用图片大小
      },
      // include: true,      // 在 Markdown 文件中导入其他 markdown 文件内容
      imageSize: "local", // 启用 自动填充 图片宽高属性，避免页面抖动
      mark: "lazy", // 马克笔滚动到可视区域后再播放动画
    },

    /**
     * 水印
     * @see https://theme-plume.vuejs.press/guide/features/watermark/
     */
    // watermark: true,

    /**
     * 评论 comments
     * @see https://theme-plume.vuejs.press/guide/features/comments/
     */
    comment: {
      provider: "Giscus", // "Artalk" | "Giscus" | "Twikoo" | "Waline"
      comment: true,
      repo: "Hi-Sillot/docs",
      repoId: "R_kgDOQSDvwg",
      category: "Announcements",
      categoryId: "DIC_kwDOQSDvws4CxmPy",
      mapping: "pathname",
      strict: true,
      reactionsEnabled: true,
      inputPosition: "top",
      lazyLoading: true,
    },
    /**
     * 资源链接替换
     * @see https://theme-plume.vuejs.press/guide/features/replace-assets/
     */
    // replaceAssets: 'https://cdn.example.com',

    /**
     * 加密功能
     * @see https://theme-plume.vuejs.press/guide/features/encryption/
     */
    // encrypt: {},
  }),

  // 组件覆写
  alias: {},
});
