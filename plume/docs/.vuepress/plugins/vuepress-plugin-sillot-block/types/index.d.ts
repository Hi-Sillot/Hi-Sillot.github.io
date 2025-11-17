
interface TagHandler {
  (attrs: Record<string, string>, pluginOptions: any): string;
}

interface TagHandlers {
  [key: string]: TagHandler;
}

interface VideoTabConfig {
  title: string;
  code: string;
  height: string;
  autoMini?: boolean;
  attrKey: string;
}

interface PluginOptions {
  videoTabs?: {
    tabs?: Partial<VideoTabConfig>[]; // 使用 Partial 允许部分配置
  };
}