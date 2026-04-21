<template>
  <div class="ssr-wrapper">
    <!-- SSR 回退内容（可选） -->
    <div v-if="showSsrFallback && $ssrContext" class="ssr-fallback">
      <slot name="ssr-fallback">
        <!-- 默认 SSR 回退内容 -->
        <p>交互式内容将在客户端激活后显示</p>
      </slot>
    </div>

    <!-- 客户端渲染内容 -->
    <ClientOnly>
      <!-- 加载状态 -->
      <div v-if="!isReady" class="client-loading">
        <slot name="loading">
          <!-- 默认加载状态 -->
          <div class="default-loading">组件加载中...</div>
        </slot>
      </div>

      <!-- 错误状态 -->
      <div v-else-if="loadError" class="client-error">
        <slot name="error" :error="loadError">
          <!-- 默认错误显示 -->
          <div class="default-error">
            <p>组件加载失败</p>
            <button @click="retryLoad">重试</button>
          </div>
        </slot>
      </div>

      <!-- 动态组件渲染 -->
      <component
        v-else-if="dynamicComponent"
        :is="dynamicComponent"
        ref="componentRef"
        v-bind="resolvedProps"
        v-on="resolvedListeners"
      >
        <!-- 传递插槽内容 -->
        <template v-for="(_, slotName) in $slots" #[slotName]="slotProps">
          <slot :name="slotName" v-bind="slotProps" />
        </template>
      </component>
    </ClientOnly>
  </div>
</template>

<script>
import { ClientOnly } from 'vuepress/client'
import { defineComponent, ref, onMounted, nextTick, markRaw, computed, watch } from 'vue'

export default defineComponent({
  name: 'SsrCompatibleComponent',
  
  components: {
    ClientOnly
  },

  props: {
    /**
     * 动态组件导入函数
     * 示例: () => import('your-component-library')
     */
    componentImporter: {
      type: Function,
      required: true
    },

    /**
     * 传递给动态组件的属性
     */
    componentProps: {
      type: Object,
      default: () => ({})
    },

    /**
     * 传递给动态组件的事件监听器
     */
    componentListeners: {
      type: Object,
      default: () => ({})
    },

    /**
     * 组件加载超时时间（毫秒）
     */
    timeout: {
      type: Number,
      default: 10000
    },

    /**
     * 是否显示 SSR 回退内容
     */
    showSsrFallback: {
      type: Boolean,
      default: true
    },

    /**
     * 是否在挂载后自动初始化
     */
    autoInitialize: {
      type: Boolean,
      default: true
    }
  },

  emits: [
    /**
     * 组件加载完成
     */
    'loaded',

    /**
     * 组件加载错误
     */
    'error',

    /**
     * 组件实例就绪
     */
    'instance-ready',

    /**
     * 重试加载
     */
    'retry'
  ],

  setup(props, { emit, expose, slots }) {
    // ========== 响应式状态 ==========
    const isMounted = ref(false)
    const isReady = ref(false)
    const loadError = ref(null)
    const dynamicComponent = ref(null)
    const componentRef = ref(null)
    const isLoading = ref(false)
    const loadTimeout = ref(null)

    // ========== 计算属性 ==========
    const isSsr = computed(() => __VUEPRESS_SSR__)
    
    const resolvedProps = computed(() => ({
      ...props.componentProps,
      // 可以在这里添加一些通用属性
    }))

    const resolvedListeners = computed(() => ({
      ...props.componentListeners,
      // 可以在这里添加一些通用事件监听器
    }))

    // ========== 核心方法 ==========
    
    /**
     * 加载动态组件
     */
    const loadComponent = async () => {
      if (isSsr.value) return

      try {
        isLoading.value = true
        loadError.value = null

        // 设置加载超时
        loadTimeout.value = setTimeout(() => {
          if (!isReady.value) {
            const error = new Error('Component load timeout')
            handleLoadError(error)
          }
        }, props.timeout)

        // 执行导入函数
        const module = await props.componentImporter()
        const component = module.default || module

        if (!component) {
          throw new Error('Component import returned null or undefined')
        }

        // 标记为非响应式，避免性能问题
        dynamicComponent.value = markRaw(component)
        isReady.value = true
        emit('loaded', component)

        clearTimeout(loadTimeout.value)
        loadTimeout.value = null

      } catch (error) {
        handleLoadError(error)
      } finally {
        isLoading.value = false
      }
    }

    /**
     * 处理加载错误
     */
    const handleLoadError = (error) => {
      console.error('Component load failed:', error)
      loadError.value = error
      isReady.value = false
      emit('error', error)
      
      if (loadTimeout.value) {
        clearTimeout(loadTimeout.value)
        loadTimeout.value = null
      }
    }

    /**
     * 重试加载
     */
    const retryLoad = () => {
      emit('retry')
      loadComponent()
    }

    /**
     * 手动初始化组件
     * 当 autoInitialize 为 false 时使用
     */
    const initialize = async (initData) => {
      if (!isMounted.value) {
        console.warn('Component not mounted yet')
        return
      }
      await loadComponent()
      
      // 如果有初始化数据，传递给组件实例
      if (initData && componentRef.value) {
        nextTick(() => {
          if (componentRef.value && typeof componentRef.value.initialize === 'function') {
            componentRef.value.initialize(initData)
          }
        })
      }
    }

    /**
     * 获取组件实例
     */
    const getInstance = () => {
      return componentRef.value
    }

    // ========== 生命周期 ==========
    onMounted(async () => {
      if (isSsr.value) return

      isMounted.value = true

      if (props.autoInitialize) {
        await loadComponent()
      }

      // 监听组件引用变化
      watch(componentRef, (newRef) => {
        if (newRef) {
          emit('instance-ready', newRef)
        }
      }, { immediate: true })
    })

    // 清理超时定时器
    const cleanup = () => {
      if (loadTimeout.value) {
        clearTimeout(loadTimeout.value)
        loadTimeout.value = null
      }
    }

    // ========== 暴露给模板引用 ==========
    expose({
      initialize,
      retry: retryLoad,
      getInstance,
      isReady,
      isLoading,
      hasError: computed(() => !!loadError.value)
    })

    // ========== 返回模板数据 ==========
    return {
      // 状态
      isReady,
      loadError,
      dynamicComponent,
      componentRef,
      
      // 计算属性
      resolvedProps,
      resolvedListeners,
      showSsrFallback: computed(() => props.showSsrFallback && isSsr.value),
      
      // 方法
      retryLoad
    }
  }
})
</script>

<style scoped>
.ssr-wrapper {
  position: relative;
  min-height: 100px; /* 避免布局抖动 */
}

.ssr-fallback {
  padding: 20px;
  background: #f5f5f5;
  border-radius: 4px;
  text-align: center;
  color: #666;
}

.client-loading,
.client-error {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 200px;
  padding: 20px;
}

.default-loading {
  text-align: center;
  color: #666;
}

.default-error {
  text-align: center;
  color: #d63031;
}

.default-error button {
  margin-top: 10px;
  padding: 8px 16px;
  background: #d63031;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.default-error button:hover {
  background: #c23616;
}
</style>