import type { BiGraphConfig } from "../types";
import { DEFAULT_CONFIG } from "../constants/index";

class OptionsManager {
  private static instance: OptionsManager;
  private _options: BiGraphConfig = {};

  private constructor() {}

  public static getInstance(): OptionsManager {
    if (!OptionsManager.instance) {
      OptionsManager.instance = new OptionsManager();
    }
    return OptionsManager.instance;
  }

  public initialize(config: BiGraphConfig): void {
    this._options = config;
  }

  public get options(): BiGraphConfig {
    return this._options;
  }

  public get localGraphDeep(): number {
    return this._options.localGraphDeep ?? DEFAULT_CONFIG.LOCAL_GRAPH_DEEP;
  }

  public getMergedConfig(): Required<BiGraphConfig> {
    return {
      foldEmptyGraph: this._options.foldEmptyGraph ?? DEFAULT_CONFIG.FOLD_EMPTY_GRAPH,
      localGraphDeep: this._options.localGraphDeep ?? DEFAULT_CONFIG.LOCAL_GRAPH_DEEP,
      graphMaxWidth: this._options.graphMaxWidth ?? DEFAULT_CONFIG.GRAPH_MAX_WIDTH,
      graphHeight: this._options.graphHeight ?? DEFAULT_CONFIG.GRAPH_HEIGHT,
      enableGlobalGraph: this._options.enableGlobalGraph ?? DEFAULT_CONFIG.ENABLE_GLOBAL_GRAPH,
      enableLocalGraph: this._options.enableLocalGraph ?? DEFAULT_CONFIG.ENABLE_LOCAL_GRAPH,
      titleGetter: this._options.titleGetter ?? ((page: any) => page.title || ""),
    };
  }
}

export const optionsManager = OptionsManager.getInstance();
export { optionsManager as options };
