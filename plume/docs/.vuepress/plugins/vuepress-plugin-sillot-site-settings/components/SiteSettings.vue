<!-- 作用范围取决于挂载位置，当挂载到顶栏插槽他是全局的，挂载在页内插槽则仅影响当前页面 -->
<!-- TODO: 紧凑布局在移动端应当隐藏，暂时不做处理 -->
<template>
  <div>
    <t-drawer v-model:visible="visible" attach="body" :mode="mode" :placement="placement" header="站点设置" :footer="null"
      destroy-on-close>
      <t-list>
        <t-list-item>
          紧凑布局
          <template #action>
            <t-switch v-model="checked_1" @change="onChange_1" />
          </template>
        </t-list-item>
      </t-list>
    </t-drawer>
    <t-button style="margin-left: 18px;" shape="circle" variant="text" @click="visible = true">
      <menu-application-icon :stroke-width="2" />
    </t-button>

  </div>
</template>

<script lang="ts" setup>
import { ref, watch, onMounted, onUnmounted } from 'vue';
import { DrawerProps, SwitchProps } from 'tdesign-vue-next';
import { MenuApplicationIcon } from 'tdesign-icons-vue-next';

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