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
        <i v-if="badgeIconType === 'iconfont'" :class="badgeIcon" class="badge-icon-font" :style="iconStyle"></i>
        <img v-else-if="badgeIconType === 'image'" :src="badgeIcon" class="badge-icon-image" :style="iconStyle" />
        <span v-else class="badge-icon-text" :style="iconStyle">{{ badgeIcon }}</span>

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

    // 图标大小比例 (相对于徽章大小)
    iconScale: {
      type: Number,
      default: 0.6,
      validator: (value) => {
        return value > 0 && value <= 1;
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
    },

    // 移动端适配
    mobileAdaptive: {
      type: Boolean,
      default: true
    },

    // 移动端缩放比例
    mobileScale: {
      type: Number,
      default: 0.8,
      validator: (value) => {
        return value > 0 && value <= 1;
      }
    }
  },

  data() {
    return {
      isHovered: false,
      imageLoaded: false,
      imageError: false,
      isMobile: false,
      windowWidth: 0
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
      const size = this.getAdjustedSize(this.avatarSize);
      return {
        width: size,
        height: size
      };
    },

    avatarStyle() {
      const borderRadius = this.shape === 'circle' ? '50%' : '4px';
      const borderWidth = this.getPixelValue(this.borderWidth);

      return {
        width: '100%',
        height: '100%',
        borderRadius,
        border: `${borderWidth} solid ${this.borderColor}`,
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
      const baseOffset = 5;
      const adjustedOffset = this.isMobile && this.mobileAdaptive ?
        baseOffset * this.mobileScale : baseOffset;

      const positions = {
        'top-left': {
          top: `${adjustedOffset}px`,
          left: `${adjustedOffset}px`
        },
        'top-right': {
          top: `${adjustedOffset}px`,
          right: `${adjustedOffset}px`
        },
        'bottom-left': {
          bottom: `${adjustedOffset}px`,
          left: `${adjustedOffset}px`
        },
        'bottom-right': {
          bottom: `${adjustedOffset}px`,
          right: `${adjustedOffset}px`
        }
      };

      // 调整徽章大小
      const adjustedBadgeSize = this.getAdjustedSize(this.badgeSize);
      const adjustedBorderWidth = this.badgeBorder ?
        this.getPixelValue(this.badgeBorderWidth) : '0';

      // 如果使用自定义颜色，则通过内联样式设置
      const customStyle = this.badgeType === 'custom' ? {
        backgroundColor: this.badgeColor
      } : {};

      return {
        width: adjustedBadgeSize,
        height: adjustedBadgeSize,
        border: this.badgeBorder ?
          `${adjustedBorderWidth} solid ${this.badgeBorderColor}` : 'none',
        ...positions[this.badgePosition],
        ...customStyle
      };
    },

    // 图标样式 - 根据徽章大小自适应
    iconStyle() {
      const badgeSizeNum = this.getNumberValue(this.badgeSize);
      const adjustedBadgeSize = badgeSizeNum * (this.isMobile && this.mobileAdaptive ?
        this.mobileScale : 1);
      const iconSize = adjustedBadgeSize * this.iconScale;

      if (this.badgeIconType === 'image') {
        // 图片图标
        return {
          width: `${iconSize}px`,
          height: `${iconSize}px`
        };
      } else {
        // 文本或字体图标
        return {
          fontSize: `${iconSize}px`,
          lineHeight: `${iconSize}px`
        };
      }
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

    // 检测移动端
    this.checkIfMobile();
    window.addEventListener('resize', this.handleResize);
  },

  beforeDestroy() {
    window.removeEventListener('resize', this.handleResize);
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

    getNumberValue(value) {
      if (typeof value === 'number') {
        return value;
      }

      // 提取数字部分
      const num = parseInt(value, 10);
      return isNaN(num) ? 32 : num;
    },

    // 获取调整后的尺寸（考虑移动端适配）
    getAdjustedSize(value) {
      const numValue = this.getNumberValue(value);
      const adjustedValue = this.isMobile && this.mobileAdaptive ?
        numValue * this.mobileScale : numValue;

      return this.getPixelValue(adjustedValue);
    },

    // 检查是否为移动端
    checkIfMobile() {
      this.windowWidth = window.innerWidth;
      this.isMobile = this.windowWidth <= 768;
    },

    // 处理窗口大小变化
    handleResize() {
      this.checkIfMobile();
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
  position: relative;
}

.avatar-container {
  position: relative;
  display: inline-block;
  width: 100%;
  height: 100%;
}

.avatar-content {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  transition: transform 0.3s ease, opacity 0.3s ease;
}

.avatar-image {
  object-fit: cover;
  width: 100%;
  height: 100%;
}

.avatar-text {
  background: linear-gradient(135deg, #3498db, #9b59b6);
  color: white;
  font-weight: bold;
  font-size: calc(100% - 10px);
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.avatar-custom {
  /* 自定义内容样式 */
  width: 100%;
  height: 100%;
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
  font-weight: bold;
  user-select: none;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
}

.badge-icon-font {
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
}

.badge-icon-image {
  object-fit: contain;
  width: 100%;
  height: 100%;
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

/* 响应式设计 - 移动端适配 */
@media (max-width: 768px) {
  .verified-avatar-wrapper {
    transform: scale(0.9);
    transform-origin: center;
  }

  .avatar-container {
    max-width: 100%;
  }

  .verified-badge {
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
  }

  .badge-tooltip {
    font-size: 11px;
    padding: 4px 8px;
  }

  /* 减少移动端动画强度 */
  .pulse {
    animation-duration: 2.5s;
  }

  .bounce {
    animation-duration: 2s;
  }

  .rotate {
    animation-duration: 4s;
  }

  .color-change {
    animation-duration: 5s;
  }
}

/* 小屏幕手机适配 */
@media (max-width: 480px) {
  .verified-avatar-wrapper {
    transform: scale(0.85);
  }

  .avatar-hover-effect:hover {
    transform: scale(1.03);
  }

  .verified-badge:hover {
    transform: scale(1.05);
  }

  .badge-tooltip {
    display: none;
    /* 在小屏幕上隐藏工具提示 */
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

/* 高DPI屏幕优化 */
@media (-webkit-min-device-pixel-ratio: 2),
(min-resolution: 192dpi) {
  .verified-badge {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  }

  .avatar-image {
    image-rendering: -webkit-optimize-contrast;
    image-rendering: crisp-edges;
  }
}

/* 横屏模式优化 */
@media (max-width: 768px) and (orientation: landscape) {
  .verified-avatar-wrapper {
    transform: scale(0.95);
  }
}
</style>