<template>
  <n-space vertical>
    <n-spin :show="show">
      <n-alert title="啦啦啦" type="success">
        明天再打开行李箱。宝贝，挂电话啦。
      </n-alert>
      <template #description>
        你不知道你有多幸运
      </template>
    </n-spin>
    <n-button @click="show = !show">
      点击来转圈
    </n-button>
  </n-space>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const show = ref(false)
</script>