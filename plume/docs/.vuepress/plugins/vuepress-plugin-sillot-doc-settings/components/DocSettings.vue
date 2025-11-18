<template>
  <div>
    <t-drawer v-model:visible="visible" attach="body" :mode="mode" :placement="placement" header="页面设置" :footer="null"
      destroy-on-close>
      <t-list>
        <t-list-item>
          紧凑布局（仅当前页面）
          <template #action>
            <t-switch v-model="checked_1" @change="onChange_1" />
          </template>
        </t-list-item>
      </t-list>
    </t-drawer>
    <t-button variant="outline" @click="visible = true">页面设置</t-button>
  </div>
</template>

<script lang="ts" setup>
import { ref, watch, onMounted, onUnmounted } from 'vue';
import { DrawerProps } from 'tdesign-vue-next';
import { SwitchProps } from 'tdesign-vue-next';

const visible = ref(false);
const mode = ref<DrawerProps['mode']>('push');
const placement = ref<DrawerProps['placement']>('right');

const checked_1 = ref(false);
const compactLayoutEnabled = ref(!checked_1.value);

const updateBodyClass = () => {
  if (compactLayoutEnabled.value) {
    document.body.classList.add('compact-layout');
  } else {
    document.body.classList.remove('compact-layout');
  }
};

const onChange_1: SwitchProps['onChange'] = (val) => {
  // 当checked_1为false时，CSS样式生效，反之不生效
  compactLayoutEnabled.value = !val;
  updateBodyClass();
};

// 监听checked_1的变化
watch(checked_1, (newVal) => {
  compactLayoutEnabled.value = !newVal;
  updateBodyClass();
}, { immediate: true });

// 组件挂载时设置初始状态
onMounted(() => {
  updateBodyClass();
});

// 组件卸载时清理
onUnmounted(() => {
  document.body.classList.remove('compact-layout');
});
</script>

<style>
/* 全局样式 */
@media (1400px <=width <=2400px) {
  body.compact-layout {
    --vp-layout-max-width: 94vw !important;
  }

  body.compact-layout .vp-doc-container.has-aside .content-container {
    max-width: 1300px !important;
  }

  body.compact-layout .vp-doc-container:not(.has-sidebar) .container {
    max-width: 1300px !important;
  }
}
</style>