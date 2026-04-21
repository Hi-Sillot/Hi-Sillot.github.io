import type { BiGraphConfig, GraphPath } from "../types";
import { optionsManager } from "../config/options";

export class ConfigManager {
  private static instance: ConfigManager;
  private _graphPath: GraphPath = { target: "" };

  private constructor() {}

  public static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  public initialize(config: BiGraphConfig): void {
    optionsManager.initialize(config);
  }

  public getMergedConfig(): Required<BiGraphConfig> {
    return optionsManager.getMergedConfig();
  }

  public setGraphPath(path: string): void {
    this._graphPath.target = path;
  }

  public getGraphPath(): GraphPath {
    return this._graphPath;
  }
}
