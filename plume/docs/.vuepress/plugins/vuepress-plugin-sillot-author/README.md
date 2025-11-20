## TODO

* [ ] 机构类型（仅认证主体）
* [ ] 组织类型
* [ ] 认证个体
* [ ] 与Artalk联动

组件库：Naive UI

中后台：Nave UI Pro


### 头像v认证使用示例

1. 基本使用 - 远程图片

```vue
<template>
  <VerifiedAvatar
    avatar-type="image"
    avatar-url="https://example.com/avatar.jpg"
    :avatar-size="150"
    :badge-size="36"
    badge-position="bottom-right"
    animation-type="pulse"
    badge-color="#3498db"
    badge-icon="✓"
    :show-badge="true"
  />
</template>
```

2. 本地图片

```vue
<template>
  <VerifiedAvatar
    avatar-type="image"
    :avatar-url="require('@/assets/avatar.jpg')"
    :is-local-image="true"
    :avatar-size="120"
  />
</template>
```

3. 文本头像

```vue
<template>
  <VerifiedAvatar
    avatar-type="text"
    avatar-text="用户"
    :avatar-size="100"
    shape="circle"
  />
</template>
```

4. 使用第三方组件 (如Element UI)

```vue
<template>
  <VerifiedAvatar
    avatar-type="component"
    :avatar-component="elAvatar"
    :component-props="{
      size: 120,
      src: 'https://example.com/avatar.jpg',
      shape: 'circle'
    }"
    :avatar-size="120"
  />
</template>

<script>
import { ElAvatar } from 'element-ui';

export default {
  components: {
    ElAvatar
  },
  data() {
    return {
      elAvatar: ElAvatar
    };
  }
};
</script>
```

5. 使用插槽自定义内容

```vue
<template>
  <VerifiedAvatar
    avatar-type="slot"
    :avatar-size="120"
  >
    <div class="custom-avatar">
      <i class="custom-avatar-icon"></i>
      <span>自定义头像</span>
    </div>
  </VerifiedAvatar>
</template>

<style>
.custom-avatar {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
}
</style>
```

6. 完整功能示例

```vue
<template>
  <VerifiedAvatar
    avatar-type="image"
    :avatar-url="user.avatar"
    :alt-text="user.name"
    :avatar-size="150"
    shape="circle"
    :badge-size="36"
    badge-position="bottom-right"
    animation-type="pulse"
    badge-color="#3498db"
    badge-icon="✓"
    :show-badge="user.verified"
    :show-tooltip="true"
    tooltip-text="官方认证用户"
    :border-width="4"
    border-color="#ecf0f1"
    :shadow="true"
    :loading="avatarLoading"
    :ssr-friendly="true"
    @badge-hover="onBadgeHover"
    @badge-click="onBadgeClick"
    @image-error="onImageError"
    @image-loaded="onImageLoaded"
  />
</template>

<script>
export default {
  data() {
    return {
      user: {
        name: '张三',
        avatar: 'https://example.com/avatar.jpg',
        verified: true
      },
      avatarLoading: false
    };
  },
  methods: {
    onBadgeHover(isHovered) {
      console.log('徽章悬停:', isHovered);
    },
    onBadgeClick() {
      console.log('徽章被点击');
    },
    onImageError() {
      console.error('头像加载失败');
      // 可以设置默认头像
    },
    onImageLoaded() {
      console.log('头像加载成功');
    }
  }
};
</script>
```