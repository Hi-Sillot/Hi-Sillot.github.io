<script lang="ts" setup>
import {computed} from "vue";
import { Layout } from 'vuepress-theme-plume/client'
import Backlink from "../plugins/BiGraph/client/components/Backlink.vue";
import LocalGraph from "../plugins/BiGraph/client/components/LocalGraphView.vue";
import GlobalGraph from "../plugins/BiGraph/client/components/GlobalGraphView.vue";
import AuthorLink from "../plugins/vuepress-plugin-sillot-author/components/AuthorLink.vue";
import DocSettings from "../plugins/vuepress-plugin-sillot-doc-settings/components/DocSettings.vue";


declare const __RELATIONAL_GRAPH_ENABLE_LOCAL_GRAPH: boolean;
declare const __RELATIONAL_GRAPH_ENABLE_GLOBAL_GRAPH: boolean;
const options = computed(() => {
  return {
    enableLocalGraph: __RELATIONAL_GRAPH_ENABLE_LOCAL_GRAPH,
    enableGlobalGraph: __RELATIONAL_GRAPH_ENABLE_GLOBAL_GRAPH,
  };
});
</script>

<template>
  <global-graph v-if="options.enableGlobalGraph"></global-graph>
  <Layout>
    <template #doc-footer-before>
      <backlink></backlink>
    </template>
     <template #aside-top>
      <DocSettings/>
    </template>
    <template #aside-outline-before>
      <local-graph v-if="options.enableLocalGraph"></local-graph>
    </template>
    <template #doc-meta-bottom>
      <AuthorLink></AuthorLink>
    </template>
  </Layout>
</template>

<style>
.custom-content {
  width: 100%;
}


/* .aside-container {
  min-width: 300px;
} */

</style>