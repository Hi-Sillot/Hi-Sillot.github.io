// add to client.ts

import type { App } from 'vue'
// 组件
import BannerTopArchived from "./plugins/vuepress-plugin-sillot-block/banner/components/BannerTopArchived.vue";
import BannerTopPrLock from "./plugins/vuepress-plugin-sillot-block/banner/components/BannerTopPrLock.vue";
import BannerTopPrNeed from "./plugins/vuepress-plugin-sillot-block/banner/components/BannerTopPrNeed.vue";
import VSCodeSettingsLink from "./plugins/vuepress-plugin-sillot-inline/components/VSCodeSettingsLink.vue";
import GithubLabel from "./plugins/vuepress-plugin-sillot-inline/components/GithubLabel.vue";
import C from "./plugins/vuepress-plugin-sillot-inline/components/Const.vue";
import TestNaiveUi from "./components/TestNaiveUi.vue";
import TestRelationGraph from "./plugins/vuepress-plugin-sillot-vivime/components/TestRelationGraph.vue";
// 模板组件，一般不在 md 中使用，这里使用只是前期开发调试
import SSRComponent from "./components/templates/SSRComponent.vue";

export const components = {
  BannerTopArchived,
  BannerTopPrLock,
  BannerTopPrNeed,
  VSCodeSettingsLink,
  GithubLabel,
  C,
  TestNaiveUi,
  TestRelationGraph,
  SSRComponent,
} as const

export function registerGlobalComponents(app: App) {
  Object.entries(components).forEach(([name, component]) => {
    app.component(name, component)
  })
}

// 或者按需注册特定组件
export function registerSpecificComponents(app: App, componentNames: string[]) {
  componentNames.forEach(name => {
    if (name in components) {
      app.component(name, components[name as keyof typeof components])
    }
  })
}

