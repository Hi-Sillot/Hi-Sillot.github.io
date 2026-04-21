// config-manager.ts - 配置管理

import type { BiGraphConfig, GraphPath } from "../types";
import { DEFAULT_CONFIG } from "../constants/index";

/**
 * 配置管理器
 */
export class ConfigManager {
  private static instance: ConfigManager;
  private _options: BiGraphConfig = {};
  private _graphPath: GraphPath = { target: "" };

  private constructor() {}

  public static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  /**
   * 初始化配置
   */
  public initialize(config: BiGraphConfig): void {
    this._options = config;
  }

  /**
   * 获取合并后的配置
   */
  public getMergedConfig(): Required<BiGraphConfig> {
    return {
      foldEmptyGraph: this._options.foldEmptyGraph ?? DEFAULT_CONFIG.FOLD_EMPTY_GRAPH,
      localGraphDeep: this._options.localGraphDeep ?? DEFAULT_CONFIG.LOCAL_GRAPH_DEEP,
      graphMaxWidth: this._options.graphMaxWidth ?? DEFAULT_CONFIG.GRAPH_MAX_WIDTH,
      graphHeight: this._options.graphHeight ?? DEFAULT_CONFIG.GRAPH_HEIGHT,
      enableGlobalGraph: this._options.enableGlobalGraph ?? DEFAULT_CONFIG.ENABLE_GLOBAL_GRAPH,
      enableLocalGraph: this._options.enableLocalGraph ?? DEFAULT_CONFIG.ENABLE_LOCAL_GRAPH,
      titleGetter: this._options.titleGetter ?? this.defaultTitleGetter,
    };
  }

  /**
   * 更新图谱路径
   */
  public setGraphPath(path: string): void {
    this._graphPath.target = path;
  }

  /**
   * 获取图谱路径
   */
  public getGraphPath(): GraphPath {
    return this._graphPath;
  }

  /**
   * 默认标题获取器
   */
  private defaultTitleGetter(page: any): string {
    return page.title || "";
  }
}