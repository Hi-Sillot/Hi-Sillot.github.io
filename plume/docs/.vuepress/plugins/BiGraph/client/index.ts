/**
 * @fileOverview index.ts
 * @author erduotong
 */
import { getDirname, path } from "vuepress/utils";
import type { App, Page, Plugin } from "vuepress/core";
import { BiGraphConfig } from "../types";
import { ConfigManager } from "./config-manager";
import { BioChainService } from "../services/bio-chain-service";
import { debug } from "../utils/debug";
import { GlobalMapBuilder } from "../builders/global-map-builder";
import { TempFileWriter } from "./temp-file-writer";

const __dirname = getDirname(import.meta.url);
export let options: BiGraphConfig = {};
const graph_path = { target: "" };
const TAG = "vuepress-plugin-BiGraph";

/**
 * 双链图谱插件入口
 */
const BiGraph = (config: BiGraphConfig = {}): Plugin => ({
  // return {
  name: TAG,

  /**
   * 应用初始化完成时的钩子
   */
  async onInitialized(app) {
    debug.log(TAG, "onInitialized 开始", {
      pageCount: app.pages.length,
      appInfo: {
        base: app.options.base,
        dest: app.options.dest,
        temp: app.dir.temp(),
      },
    });

    // 持久化到本地，应当只在构建时执行
    // TODO

    // 写入临时文件
    await TempFileWriter.writeTempFile(app);
  },

  // 在页面准备完成后构建双链数据
  onPrepared: async (app: App) => {
    debug.log(TAG, "onPrepared 开始", {
      pageCount: app.pages.length,
    });
  },

  /**
   * 站点生成完成时的钩子
   */
  onGenerated: async (app: App) => {
    // console.log("站点生成完成时的钩子");
  },
  /**
   * 定义客户端变量
   */
  // define: VariableInjector.getInjectedVariables(),
  define: {
    __RELATIONAL_GRAPH_FOLD_EMPTY_GRAPH: config.foldEmptyGraph || false,
    __RELATIONAL_GRAPH_LOCAL_GRAPH_DEEP: config.localGraphDeep || 5,
    __RELATIONAL_GRAPH_MAX_WIDTH: config.graphMaxWidth || Infinity,
    __RELATIONAL_GRAPH_HEIGHT: config.graphHeight || 300,
    __RELATIONAL_GRAPH_ENABLE_GLOBAL_GRAPH:
      config.enableGlobalGraph !== undefined ? config.enableGlobalGraph : true,
    __RELATIONAL_GRAPH_ENABLE_LOCAL_GRAPH: config.enableLocalGraph !== undefined
      ? config.enableLocalGraph
      : true,
    // __RELATIONAL_GRAPH_GRAPH_PATH: graph_path,
  },
  // };
});

export default BiGraph;
