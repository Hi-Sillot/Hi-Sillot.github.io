<template>
  <component :is="tag" v-if="isValidId" class="const-value" :class="{ 'const-value--encrypted': isEncrypted }">
    {{ displayValue }}
  </component>
  <component :is="tag" v-else class="const-error" :class="`const-error--${errorMode}`" :title="errorTooltip"
    @click="handleErrorClick">
    <span class="const-error__icon">⚠️</span>
    <span v-if="errorMode === 'verbose'" class="const-error__text">INVALID</span>
  </component>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useCedossStore } from '../stores/useCedoss'

interface Props {
  id: string
  tag?: string
  errorMode?: 'icon' | 'verbose'
  forceEncryptStyle?: boolean
}

interface Emits {
  (e: 'error-click', id: string): void
}

const props = withDefaults(defineProps<Props>(), {
  tag: 'span',
  errorMode: 'verbose',
  forceEncryptStyle: false
})

const emit = defineEmits<Emits>()

const store = useCedossStore()

/**
 * 检查意码ID是否有效
 */
const isValidId = computed(() => store.hasCedossant(props.id))

/**
 * 获取意码值
 */
const constValue = computed(() => {
  const value = store.constValue(props.id)
  return value || `MISSING:${props.id}`
})

/**
 * 判断是否为加密意码
 * 适配新的加密数据结构 { value: string, encrypted: true, algorithm?: string }
 */
const isEncrypted = computed(() => {
  // 如果强制加密样式，直接返回true
  if (props.forceEncryptStyle) return true
  
  // 检查是否为加密意码
  return store.isEncrypted(props.id)
})

/**
 * 显示的值
 */
const displayValue = computed(() => {
  const value = constValue.value
  
  // 如果是解密失败的值，显示错误提示
  if (value && value.startsWith('DECRYPT_FAILED:')) {
    return `[解密失败:${props.id}]`
  }
  
  // 如果是缺失的值，显示缺失提示
  if (value && value.startsWith('MISSING:')) {
    return `[缺失:${props.id}]`
  }
  
  return value
})

/**
 * 错误提示工具
 */
const errorTooltip = computed(() => {
  const value = constValue.value
  
  if (value && value.startsWith('DECRYPT_FAILED:')) {
    return `意码解密失败: ${props.id}\n请检查密钥是否正确`
  }
  
  if (value && value.startsWith('MISSING:')) {
    return `意码不存在: ${props.id}`
  }
  
  return `无效的意码ID: ${props.id}\n点击可复制ID`
})

/**
 * 处理错误点击（复制ID）
 */
const handleErrorClick = async (): Promise<void> => {
  try {
    await navigator.clipboard.writeText(props.id)
    emit('error-click', props.id)
  } catch (err) {
    console.error('复制失败:', err)
  }
}


/**
 * 组件挂载时尝试加载本地数据
 */
onMounted(() => {
  store.loadFromLocalStorage()
  store.loadKeyFromURL()
})
</script>

<style scoped>
.const-value {
  /* 正常文本样式 */
  transition: all 0.3s ease;
}

/* 加密文本样式 */
.const-value--encrypted {
  position: relative;
  border-radius: 4px;
  padding: 2px 6px;
  margin: 0 2px;
  border: 1px dashed #ccc;
  font-family: 'Courier New', monospace;
  font-weight: 600;
}

/* .const-value--encrypted::before {
  content: '🔒';
  font-size: 0.8em;
  margin-right: 4px;
  opacity: 0.6;
} */

.const-value--encrypted:hover {
  border-color: #1890ff;
  box-shadow: 0 0 8px rgba(24, 144, 255, 0.2);
}

/* 错误状态样式保持不变 */
.const-error {
  display: inline-flex;
  align-items: center;
  border-radius: 11px;
  cursor: help;
  transition: all 0.2s ease !important;
  animation: breathe 2s ease-in-out infinite !important;
}

@keyframes breathe {

  0%,
  100%,
  60% {
    opacity: 0.8;
  }

  10% {
    opacity: 0.7;
    transform: scale(0.98);
  }

  30% {
    opacity: 0.9;
    transform: scale(0.96);
  }
}

.const-error--icon {
  color: #e53e3e;
  padding: 0 2px;
  transform-origin: center;
}

.const-error--icon:hover {
  animation-duration: 4s;
  border-radius: 3px;
}

.const-error--icon .const-error__icon {
  filter: drop-shadow(0 0 2px #e53e3e);
  font-size: 0.95em;
}

.const-error--verbose {
  color: #f38028;
  margin: 1px 4px;
  padding: 1px 9px;
  font-size: 0.85em;
  font-weight: 500;
}

.const-error--verbose:hover {
  animation-duration: 4s;
  border: 1.5px dashed #e53e3e;
  box-shadow: 0 0 12px rgba(229, 62, 62, 0.5);
}

.const-error--verbose .const-error__icon {
  margin-right: 4px;
}

.const-error__text {
  line-height: 1.4;
}

.const-error:active {
  transform: scale(0.95);
  animation: none;
}

.const-error__icon {
  line-height: 1;
}
</style>