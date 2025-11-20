<template>
  <component :is="tag" v-if="isValidId" class="const-value" :class="constClasses" :title="constTooltip">
    <a v-if="!unlink" :href="constLink" class="const-link" @click.prevent="handleLinkClick">
      {{ displayValue }}
    </a>
    <span v-else>{{ displayValue }}</span>
  </component>

  <component :is="tag" v-else class="const-error" :class="`const-error--${errorMode}`" :title="errorTooltip"
    @click="handleErrorClick">
    <span class="const-error__icon">⚠️</span>
    <span v-if="errorMode === 'verbose'" class="const-error__text">{{ id }}</span>
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
  unlink?: boolean // 是否显示为纯文本（不显示链接）
  showHint?: boolean // 是否显示协议链接提示
}

interface Emits {
  (e: 'error-click', id: string): void
  (e: 'link-click', id: string, value: string): void
}

const props = withDefaults(defineProps<Props>(), {
  tag: 'span',
  errorMode: 'verbose',
  forceEncryptStyle: false,
  unlink: false, // 默认显示为链接
  showHint: true // 默认显示协议链接
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
 */
const isEncrypted = computed(() => {
  if (props.forceEncryptStyle) return true
  return store.isEncrypted(props.id)
})

/**
 * 显示的值（解码后的实际值）
 */
const displayValue = computed(() => {
  const value = constValue.value

  if (value && value.startsWith('DECRYPT_FAILED:')) {
    return `解密失败:${props.id}`
  }

  if (value && value.startsWith('MISSING:')) {
    return `缺失:${props.id}`
  }

  return value
})

/**
 * 意码链接
 */
const constLink = computed(() => {
  return `sillot://cedoss?id=${encodeURIComponent(props.id)}`
})

/**
 * 是否显示协议链接提示
 */
const showDecodeHint = computed(() => {
  return props.showHint && !props.unlink
})

/**
 * 意码CSS类
 */
const constClasses = computed(() => ({
  'const-value--encrypted': isEncrypted.value,
  'const-value--linked': !props.unlink,
  'const-value--plain': props.unlink
}))

/**
 * 意码提示信息
 */
const constTooltip = computed(() => {
  const value = constValue.value
  const tips = []

  if (isEncrypted.value) {
    tips.push('🔒 加密意码')
    if (!props.unlink) {
      tips.push('点击查看详情')
    }
  } else {
    tips.push('📄 普通意码')
  }

  if (value && value.startsWith('DECRYPT_FAILED:')) {
    tips.push('解密失败，请检查密钥')
  }

  return tips.join('\n')
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
 * 处理链接点击
 */
const handleLinkClick = (): void => {
  emit('link-click', props.id, constValue.value)

  // 可以在这里添加自定义的链接处理逻辑
  console.log('意码链接点击:', props.id, constValue.value)

  // 示例：打开新窗口或执行其他操作
  // window.open(constLink.value, '_blank')
}

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
  transition: all 0.3s ease;
  display: inline-block;
}

/* 链接样式 */
.const-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  text-decoration: none;
  color: inherit;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 4px;
  transition: all 0.2s ease;
}

.const-link:hover {
  background-color: var(--td-brand-color-1);
  color: var(--td-brand-color);
}

.const-link__hint {
  font-size: 0.85em;
  color: var(--td-text-color-placeholder);
  font-family: 'Courier New', monospace;
  margin-left: 4px;
}

/* 加密文本样式 */
.const-value--encrypted .const-link {
  border: 1px dashed var(--td-border-level-2-color);
  font-family: 'Courier New', monospace;
  background-color: var(--td-bg-color-secondarycontainer);
}

.const-value--encrypted .const-link:hover {
  border-color: var(--td-brand-color);
  box-shadow: 0 0 8px rgba(24, 144, 255, 0.2);
  background-color: var(--td-brand-color-1);
}

.const-value--encrypted {
  color: var(--td-warning-color);
}

/* 纯文本样式 */
.const-value--plain {
  padding: 2px 4px;
}

.const-value--plain.const-value--encrypted {
  border: 1px dashed #ccc;
  border-radius: 4px;
  background-color: #f8f9fa;
  font-family: 'Courier New', monospace;
  padding: 2px 6px;
}

/* 错误状态样式 */
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
  }

  30% {
    opacity: 0.9;
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

.const-error:active {
  transform: scale(0.95);
  animation: none;
}

.const-error__icon {
  line-height: 1;
}

/* 响应式调整 */
@media (max-width: 768px) {
  .const-link {
    padding: 1px 4px;
    font-size: 0.9em;
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
  }

  .const-link__hint {
    font-size: 0.75em;
    margin-left: 0;
  }
}

/* 深色模式支持 */
@media (prefers-color-scheme: dark) {
  .const-value--encrypted .const-link {
    background-color: var(--td-bg-color-container);
    border-color: var(--td-border-level-1-color);
  }

  .const-value--plain.const-value--encrypted {
    background-color: var(--td-bg-color-secondarycontainer);
  }
}
</style>