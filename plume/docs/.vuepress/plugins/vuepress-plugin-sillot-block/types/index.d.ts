
export interface TagHandler {
  (attrs: Record<string, string>, pluginOptions: any): string;
}

export interface TagHandlers {
  [key: string]: TagHandler;
}

export interface VideoTabConfig {
  title: string;
  code: string;
  height: string;
  autoMini?: boolean;
  attrKey: string;
}

export interface PluginOptions {
  videoTabs?: {
    tabs?: Partial<VideoTabConfig>[]; // 使用 Partial 允许部分配置
  };
}