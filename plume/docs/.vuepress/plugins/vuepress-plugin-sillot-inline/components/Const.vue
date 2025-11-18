<template>
  <component :is="tag" v-if="isValidId" class="const-value">
    {{ constValue }}
  </component>
  <component :is="tag" v-else class="const-error" :class="`const-error--${errorMode}`" :title="errorTooltip"
    @click="handleErrorClick">
    <span class="const-error__icon">⚠️</span>
    <span v-if="errorMode === 'verbose'" class="const-error__text">INVALID</span>
  </component>
</template>

<script>
/**
 * @typedef {Object} ConstConfig
 * @property {string} value - 常量值
 * @property {boolean} [encrypt=false] - 是否加密显示
 */

// 常量映射表
const CONST_MAP = {
  'sillotNoteName_yobeCe': { value: '汐洛绞架', encrypt: false },
  'sillotNoteName_doCe': { value: 'Sillot-Gibbet', encrypt: false },
  'syNoteName_CN': { value: '思源笔记', encrypt: false },
  'syNoteName_EN': { value: 'siyuan-note', encrypt: false },
  'sillotMatrixName_yobeCe': { value: '汐洛彖夲肜矩阵', encrypt: true },
  'sillotMatrixName_doCe': { value: 'Sillot T☳Converbenk Matrix', encrypt: true },
  'sillot_yobeCe': { value: '汐洛', encrypt: false },
  'sillot_doCe': { value: 'Sillot', encrypt: false },
  'siow_yobeCe': { value: '司华', encrypt: false },
  'siow_doCe': { value: 'Siow', encrypt: false },
  'hellise_yobeCe': { value: '赫礼斯', encrypt: false },
  'hellise_doCe': { value: 'Hellise', encrypt: false },
  'potter_yobeCe': { value: '叵特', encrypt: false },
  'potter_doCe': { value: 'Potter', encrypt: false },
  'sofill_yobeCe': { value: '沁棘', encrypt: false },
  'sofill_doCe': { value: 'Sofill', encrypt: false },
  'sili_yobeCe': { value: '司丽', encrypt: false },
  'sili_doCe': { value: 'Sili', encrypt: false },
  'winsay_yobeCe': { value: '风颂', encrypt: false },
  'winsay_doCo': { value: 'Winsay', encrypt: false },
  'lnco_yobeCe': { value: '兰可', encrypt: false },
  'lnco_doCe': { value: 'Lnco', encrypt: false }
}

export default {
  name: 'C',
  props: {
    id: {
      type: String,
      required: true,
      validator: (value) => {
        const isValid = Object.prototype.hasOwnProperty.call(CONST_MAP, value)
        if (!isValid && process.env.NODE_ENV !== 'production') {
          console.warn(`[C组件] 无效的常量ID: "${value}"`)
        }
        return true
      }
    },
    tag: {
      type: String,
      default: 'span'
    },
    errorMode: {
      type: String,
      default: 'verbose',
      validator: (value) => ['icon', 'verbose'].includes(value)
    }
  },
  emits: ['error-click'],
  computed: {
    isValidId() {
      return Object.prototype.hasOwnProperty.call(CONST_MAP, this.id)
    },
    constConfig() {
      return CONST_MAP[this.id]
    },
    /** 获取原始常量值 */
    constValue() {
      const config = this.constConfig
      return typeof config === 'string' ? config : config.value
    },
    errorTooltip() {
      return `无效的常量ID: ${this.id}\n点击可复制ID`
    }
  },
  methods: {
    async handleErrorClick() {
      try {
        await navigator.clipboard.writeText(this.id)
        this.$emit('error-click', this.id)
      } catch (err) {
        console.error('复制失败:', err)
      }
    }
  }
}
</script>

<style scoped>
.const-value {
  /* 正常文本样式 */
}

/* 错误状态基础样式 */
.const-error {
  display: inline-flex;
  align-items: center;
  border-radius: 11px;
  cursor: help;
  transition: all 0.2s ease !important;
  animation: breathe 2s ease-in-out infinite !important;
}

/* 呼吸灯动画 */
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

/* 图标模式 - 紧凑闪烁 */
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

/* 详细模式 - 发光呼吸 */
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

/* 点击反馈 */
.const-error:active {
  transform: scale(0.95);
  animation: none;
}

/* 元素样式 */
.const-error__icon {
  line-height: 1;
}
</style>