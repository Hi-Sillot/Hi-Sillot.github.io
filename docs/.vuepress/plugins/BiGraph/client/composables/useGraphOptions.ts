// composables/useGraphOptions.ts - 图谱选项管理

import { computed } from "vue";
import type { LocalGraphOptions } from "../../types/localRelationship";
// import { __RELATIONAL_GRAPH_ENABLE_GLOBAL_GRAPH, __RELATIONAL_GRAPH_FOLD_EMPTY_GRAPH, __RELATIONAL_GRAPH_HEIGHT, __RELATIONAL_GRAPH_LOCAL_GRAPH_DEEP, __RELATIONAL_GRAPH_MAX_WIDTH } from "../../types";
export declare const __RELATIONAL_GRAPH_FOLD_EMPTY_GRAPH: boolean;
export declare const __RELATIONAL_GRAPH_LOCAL_GRAPH_DEEP: number;
export declare const __RELATIONAL_GRAPH_HEIGHT: number;
export declare const __RELATIONAL_GRAPH_MAX_WIDTH: number;
export declare const __RELATIONAL_GRAPH_ENABLE_GLOBAL_GRAPH: boolean;

/**
 * 图谱选项管理
 */
export function useGraphOptions() {
  /**
   * 计算图谱选项
   */
  const options = computed((): LocalGraphOptions => {
    return {
      foldEmptyGraph: __RELATIONAL_GRAPH_FOLD_EMPTY_GRAPH,
      localGraphDeep: __RELATIONAL_GRAPH_LOCAL_GRAPH_DEEP,
      enableGlobalGraph: __RELATIONAL_GRAPH_ENABLE_GLOBAL_GRAPH,
      graphSize: {
        height: __RELATIONAL_GRAPH_HEIGHT,
        maxWidth: __RELATIONAL_GRAPH_MAX_WIDTH,
      },
    };
  });

  return {
    options,
  };
}