<template>
  <n-input-otp v-model:value="value" gap="0"  size="large">
    <template #default="{ index, ...inputProps }">
      <n-input
        v-bind="inputProps"
        :style="index === 0 ? '' : 'margin-left: 6px;'"
      />
      <span v-if="index === 1" style="padding-left: 6px">-</span>
      <span v-if="index === 3" style="padding-left: 6px">-</span>
    </template>
  </n-input-otp>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const value = ref('654321'.split(''))
</script>