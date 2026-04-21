// config/options.ts - 配置管理

import type { BiGraphConfig } from "../types";

/**
 * 配置管理器
 */
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
    return this._options.localGraphDeep || 5;
  }
}

export const optionsManager = OptionsManager.getInstance();
export { optionsManager as options };