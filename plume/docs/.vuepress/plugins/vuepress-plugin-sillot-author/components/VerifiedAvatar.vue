<template>
  <div class="verified-avatar-wrapper" :style="wrapperStyle">
    <div class="avatar-container" :style="containerStyle" @mouseenter="handleMouseEnter" @mouseleave="handleMouseLeave">
      <!-- 默认图片头像 -->
      <img v-if="avatarType === 'image' && !avatarComponent" :src="processedAvatarUrl" :alt="altText"
        class="avatar-content avatar-image" :class="avatarClass" :style="avatarStyle" @error="handleImageError"
        @load="handleImageLoad" />

      <!-- 第三方组件 -->
      <component v-else-if="avatarComponent" :is="avatarComponent" v-bind="componentProps" class="avatar-content"
        :class="avatarClass" :style="avatarStyle" />

      <!-- 插槽自定义内容 -->
      <div v-else-if="$slots.default" class="avatar-content avatar-custom" :class="avatarClass" :style="avatarStyle">
        <slot></slot>
      </div>

      <!-- 默认文本头像 -->
      <div v-else class="avatar-content avatar-text" :class="avatarClass" :style="avatarStyle">
        {{ avatarText }}
      </div>

      <!-- 认证徽章 -->
      <div v-if="showBadge" class="verified-badge" :class="[
        badgeTypeClass,
        animationClass,
        { 'hover-animation': isHovered },
        { 'badge-with-border': badgeBorder }
      ]" :style="badgeStyle" @click="handleBadgeClick">
        <!-- 图标支持字体图标或图片 -->
        <i v-if="badgeIconType === 'iconfont'" :class="badgeIcon" class="badge-icon-font"></i>
        <img v-else-if="badgeIconType === 'image'" :src="badgeIcon" class="badge-icon-image" />
        <span v-else class="badge-icon-text">{{ badgeIcon }}</span>

        <!-- 徽章工具提示 -->
        <div v-if="showTooltip" class="badge-tooltip">
          {{ tooltipText }}
        </div>
      </div>

      <!-- 加载状态 -->
      <div v-if="loading" class="avatar-loading">
        <div class="loading-spinner"></div>
      </div>

      <!-- 错误状态 -->
      <div v-if="showError" class="avatar-error" :style="avatarStyle">
        <span class="error-text">加载失败</span>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'VerifiedAvatar',

  props: {
    // 头像内容类型
    avatarType: {
      type: String,
      default: 'image',
      validator: (value) => {
        return ['image', 'text', 'component', 'slot'].includes(value);
      }
    },

    // 图片头像相关
    avatarUrl: {
      type: String,
      default: ''
    },

    // 文本头像相关
    avatarText: {
      type: String,
      default: '用户'
    },

    // 第三方组件相关
    avatarComponent: {
      type: [Object, String],
      default: null
    },

    componentProps: {
      type: Object,
      default: () => ({})
    },

    // 通用属性
    altText: {
      type: String,
      default: '用户头像'
    },

    avatarSize: {
      type: [Number, String],
      default: 120
    },

    shape: {
      type: String,
      default: 'circle',
      validator: (value) => {
        return ['circle', 'square'].includes(value);
      }
    },

    // 徽章相关属性
    badgeSize: {
      type: [Number, String],
      default: 32
    },

    badgePosition: {
      type: String,
      default: 'bottom-right',
      validator: (value) => {
        return ['top-left', 'top-right', 'bottom-left', 'bottom-right'].includes(value);
      }
    },

    badgeType: {
      type: String,
      default: 'blue',
      validator: (value) => {
        return ['blue', 'yellow', 'red', 'green', 'purple', 'gold', 'silver', 'custom'].includes(value);
      }
    },

    animationType: {
      type: String,
      default: 'pulse',
      validator: (value) => {
        return ['pulse', 'bounce', 'rotate', 'color-change', 'none'].includes(value);
      }
    },

    badgeColor: {
      type: String,
      default: '#3498db'
    },

    badgeIcon: {
      type: String,
      default: '✓'
    },

    badgeIconType: {
      type: String,
      default: 'text',
      validator: (value) => {
        return ['text', 'image', 'iconfont'].includes(value);
      }
    },

    badgeBorder: {
      type: Boolean,
      default: false
    },

    badgeBorderColor: {
      type: String,
      default: '#ffffff'
    },

    badgeBorderWidth: {
      type: [Number, String],
      default: 2
    },

    showBadge: {
      type: Boolean,
      default: true
    },

    // 样式属性
    borderWidth: {
      type: [Number, String],
      default: 4
    },

    borderColor: {
      type: String,
      default: '#ecf0f1'
    },

    shadow: {
      type: Boolean,
      default: true
    },

    // 功能属性
    showTooltip: {
      type: Boolean,
      default: false
    },

    tooltipText: {
      type: String,
      default: '已验证用户'
    },

    // 状态属性
    loading: {
      type: Boolean,
      default: false
    },

    // SSR相关
    ssrFriendly: {
      type: Boolean,
      default: true
    },

    // 本地图片处理
    isLocalImage: {
      type: Boolean,
      default: false
    }
  },

  data() {
    return {
      isHovered: false,
      imageLoaded: false,
      imageError: false
    };
  },

  computed: {
    wrapperStyle() {
      return {
        display: 'inline-block',
        lineHeight: 0
      };
    },

    containerStyle() {
      const size = this.getPixelValue(this.avatarSize);
      return {
        width: size,
        height: size
      };
    },

    avatarStyle() {
      const borderRadius = this.shape === 'circle' ? '50%' : '4px';
      return {
        width: '100%',
        height: '100%',
        borderRadius,
        border: `${this.getPixelValue(this.borderWidth)} solid ${this.borderColor}`,
        boxShadow: this.shadow ? '0 5px 15px rgba(0, 0, 0, 0.1)' : 'none',
        overflow: 'hidden'
      };
    },

    avatarClass() {
      return {
        'avatar-hover-effect': !this.loading && !this.showError
      };
    },

    badgeTypeClass() {
      return `badge-${this.badgeType}`;
    },

    badgeStyle() {
      const positions = {
        'top-left': { top: '5px', left: '5px' },
        'top-right': { top: '5px', right: '5px' },
        'bottom-left': { bottom: '5px', left: '5px' },
        'bottom-right': { bottom: '5px', right: '5px' }
      };

      // 如果使用自定义颜色，则通过内联样式设置
      const customStyle = this.badgeType === 'custom' ? {
        backgroundColor: this.badgeColor
      } : {};

      return {
        width: this.getPixelValue(this.badgeSize),
        height: this.getPixelValue(this.badgeSize),
        border: this.badgeBorder ? `${this.getPixelValue(this.badgeBorderWidth)} solid ${this.badgeBorderColor}` : 'none',
        ...positions[this.badgePosition],
        ...customStyle
      };
    },

    // 处理本地图片路径
    processedAvatarUrl() {
      if (!this.avatarUrl) return '';

      if (this.isLocalImage && this.avatarUrl.startsWith('@/')) {
        return this.avatarUrl.replace('@/', '');
      }

      return this.avatarUrl;
    },

    // 处理SSR环境下的动画类
    animationClass() {
      if (this.ssrFriendly && typeof window === 'undefined') {
        return '';
      }

      return this.animationType !== 'none' ? this.animationType : '';
    },

    showError() {
      return this.imageError && this.avatarType === 'image' && !this.avatarComponent;
    }
  },

  mounted() {
    if (this.avatarType !== 'image' || this.avatarComponent) {
      this.imageLoaded = true;
    }
  },

  methods: {
    getPixelValue(value) {
      if (typeof value === 'number') {
        return `${value}px`;
      }

      if (typeof value === 'string' && /px|rem|em|%$/.test(value)) {
        return value;
      }

      return `${value}px`;
    },

    handleMouseEnter() {
      this.isHovered = true;
      this.$emit('badge-hover', true);
    },

    handleMouseLeave() {
      this.isHovered = false;
      this.$emit('badge-hover', false);
    },

    handleImageError() {
      this.imageError = true;
      this.imageLoaded = false;
      this.$emit('image-error');
    },

    handleImageLoad() {
      this.imageLoaded = true;
      this.imageError = false;
      this.$emit('image-loaded');
    },

    handleBadgeClick() {
      this.$emit('badge-click');
    }
  }
};
</script>

<style scoped>
.verified-avatar-wrapper {
  display: inline-block;
}

.avatar-container {
  position: relative;
  display: inline-block;
}

.avatar-content {
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.3s ease, opacity 0.3s ease;
}

.avatar-image {
  object-fit: cover;
}

.avatar-text {
  background: linear-gradient(135deg, #3498db, #9b59b6);
  color: white;
  font-weight: bold;
  font-size: calc(100% - 10px);
}

.avatar-custom {
  /* 自定义内容样式 */
}

.avatar-hover-effect:hover {
  transform: scale(1.05);
  opacity: 0.9;
}

.verified-badge {
  position: absolute;
  border-radius: 50%;
  display: flex;
  justify-content: center;
  align-items: center;
  box-shadow: 0 3px 10px rgba(0, 0, 0, 0.2);
  z-index: 10;
  cursor: pointer;
  transition: transform 0.2s ease;
}

.verified-badge:hover {
  transform: scale(1.1);
}

.badge-icon-text {
  color: white;
  font-size: calc(100% - 4px);
  font-weight: bold;
  user-select: none;
}

.badge-icon-font {
  color: white;
  font-size: calc(100% - 4px);
}

.badge-icon-image {
  width: 70%;
  height: 70%;
  object-fit: contain;
}

/* 徽章边框样式 */
.badge-with-border {
  box-shadow: 0 3px 10px rgba(0, 0, 0, 0.2), 0 0 0 2px rgba(255, 255, 255, 0.8);
}

.badge-tooltip {
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 5px 10px;
  border-radius: 4px;
  font-size: 12px;
  white-space: nowrap;
  margin-bottom: 8px;
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.3s, visibility 0.3s;
  z-index: 20;
}

.badge-tooltip::after {
  content: '';
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  border: 5px solid transparent;
  border-top-color: rgba(0, 0, 0, 0.8);
}

.verified-badge:hover .badge-tooltip {
  opacity: 1;
  visibility: visible;
}

.avatar-loading {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.8);
  border-radius: inherit;
  z-index: 5;
}

.loading-spinner {
  width: 30px;
  height: 30px;
  border: 3px solid #f3f3f3;
  border-top: 3px solid #3498db;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }

  100% {
    transform: rotate(360deg);
  }
}

.avatar-error {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f8f9fa;
  color: #6c757d;
  border-radius: inherit;
}

.error-text {
  font-size: 12px;
}

/* 认证类型背景颜色 */
.badge-blue {
  background-color: #3498db;
  /* 蓝V */
}

.badge-yellow {
  background-color: #f1c40f;
  /* 黄V */
}

.badge-red {
  background-color: #e74c3c;
  /* 红V */
}

.badge-green {
  background-color: #2ecc71;
  /* 绿V */
}

.badge-purple {
  background-color: #9b59b6;
  /* 紫V */
}

.badge-gold {
  background-color: #ffd700;
  /* 金V */
}

.badge-silver {
  background-color: #c0c0c0;
  /* 银V */
}

/* 动画效果 */
.pulse {
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0% {
    transform: scale(1);
    box-shadow: 0 0 0 0 rgba(0, 0, 0, 0.3);
  }

  70% {
    transform: scale(1.05);
    box-shadow: 0 0 0 8px rgba(0, 0, 0, 0);
  }

  100% {
    transform: scale(1);
    box-shadow: 0 0 0 0 rgba(0, 0, 0, 0);
  }
}

.bounce {
  animation: bounce 1.5s infinite;
}

@keyframes bounce {

  0%,
  100% {
    transform: translateY(0);
  }

  50% {
    transform: translateY(-5px);
  }
}

.rotate {
  animation: rotate 3s linear infinite;
}

@keyframes rotate {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}

.color-change {
  animation: colorChange 4s infinite alternate;
}

@keyframes colorChange {
  0% {
    background-color: #3498db;
  }

  25% {
    background-color: #2ecc71;
  }

  50% {
    background-color: #e74c3c;
  }

  75% {
    background-color: #f39c12;
  }

  100% {
    background-color: #9b59b6;
  }
}

/* 悬停时的动画增强 */
.hover-animation.pulse {
  animation-duration: 1s;
}

.hover-animation.bounce {
  animation-duration: 0.8s;
}

.hover-animation.rotate {
  animation-duration: 1.5s;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .verified-badge {
    width: 24px !important;
    height: 24px !important;
  }

  .badge-icon-text {
    font-size: 12px;
  }

  .badge-icon-font {
    font-size: 12px;
  }
}

/* 减少动画设置（为偏好减少运动的用户） */
@media (prefers-reduced-motion: reduce) {

  .pulse,
  .bounce,
  .rotate,
  .color-change {
    animation: none;
  }

  .avatar-hover-effect:hover {
    transform: none;
  }

  .loading-spinner {
    animation: none;
    border-top-color: #f3f3f3;
  }
}
</style>