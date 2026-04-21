<template>
  <div>
    <div style="height:calc(100vh - 60px);">
      <ClientOnly>
        <component
          v-if="RelationGraphComponent && isMounted"
          :is="RelationGraphComponent"
          ref="graphRef"
          :options="graphOptions"
          :on-node-click="onNodeClick"
          :on-line-click="onLineClick"
        />
        <div v-else>图表加载中...</div>
      </ClientOnly>
    </div>
  </div>
</template>

<script>
import { ClientOnly } from 'vuepress/client'
import { defineComponent, ref, onMounted, nextTick, markRaw } from 'vue'

export default defineComponent({
  name: 'Demo',
  components: {
    ClientOnly
  },
  setup() {
    const isMounted = ref(false)
    const graphRef = ref(null)
    const RelationGraphComponent = ref(null)
    
    const graphOptions = ref({
      defaultJunctionPoint: 'border'
    })
    
    // 动态加载 RelationGraph 组件
    const loadRelationGraph = async () => {
      if (__VUEPRESS_SSR__) return
      
      try {
        const module = await import('relation-graph-vue3')
        RelationGraphComponent.value = markRaw(module.default || module)
        isMounted.value = true
      } catch (error) {
        console.error('Failed to load RelationGraph:', error)
      }
    }
    
    onMounted(async () => {
      if (!__VUEPRESS_SSR__) {
        await loadRelationGraph()
        nextTick(() => {
          showGraph()
        })
      }
    })
    
    const showGraph = () => {
      if (!graphRef.value || !isMounted.value) return
      
      const jsonData = {
        rootId: 'a',
        nodes: [
          { id: 'a', text: 'A', borderColor: 'yellow' },
          { id: 'b', text: 'B', color: '#43a2f1', fontColor: 'yellow' },
          { id: 'c', text: 'C', nodeShape: 1, width: 80, height: 60 },
          { id: 'e', text: 'E', nodeShape: 0, width: 150, height: 150 }
        ],
        lines: [
          { from: 'a', to: 'b', text: 'line1', color: '#43a2f1' },
          { from: 'a', to: 'c', text: 'line2' },
          { from: 'a', to: 'e', text: 'line3' },
          { from: 'b', to: 'e', color: '#67C23A' }
        ]
      }
      
      if (graphRef.value && graphRef.value.setJsonData) {
        graphRef.value.setJsonData(jsonData, (graphInstance) => {
          // Called when the relation-graph is completed
        })
      }
    }
    
    const onNodeClick = (nodeObject, $event) => {
      console.log('onNodeClick:', nodeObject)
    }
    
    const onLineClick = (lineObject, $event) => {
      console.log('onLineClick:', lineObject)
    }
    
    return {
      isMounted,
      graphRef,
      RelationGraphComponent,
      graphOptions,
      onNodeClick,
      onLineClick
    }
  }
})
</script>