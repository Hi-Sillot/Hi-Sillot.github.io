<template>
  <n-space>
    <n-qr-code :value="text" type="canvas" />
    <n-qr-code :value="text" type="svg" />
  </n-space>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const text = ref('雨淋湿了天空')
</script>