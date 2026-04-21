<template>
  <n-form ref="formRef" inline :model="formValue" :rules="rules">
    <n-form-item label="茴香豆的回有几种写法？" path="count">
      <n-input-number v-model:value="formValue.count" />
    </n-form-item>
    <n-form-item>
      <n-button attr-type="button" @click="handleValidateClick">
        作答
      </n-button>
    </n-form-item>
  </n-form>
</template>

<script setup lang="ts">
import type { FormInst, FormItemRule, FormRules } from 'naive-ui'
import { useMessage } from 'naive-ui' // 外层组件需要使用 <n-message-provider> 包裹
import { ref } from 'vue'

const formRef = ref<FormInst | null>(null)
const message = useMessage()
const formValue = ref({
  count: undefined
})

const rules = {
  count: [
    {
      required: true,
      message: '请作答',
      type: 'number',
      trigger: ['input', 'blur']
    },
    {
      trigger: ['input', 'blur'],
      level: 'warning',
      validator(_rule: FormItemRule, value: number) {
        if (value !== 4) {
          return new Error('你确定吗？')
        }
        return true
      }
    }
  ]
} satisfies FormRules

function handleValidateClick(e: MouseEvent) {
  e.preventDefault()
  formRef.value?.validate((errors, { warnings }) => {
    if (errors) {
      console.error(errors)
      message.error('校验未通过')
    }
    else if (warnings) {
      message.warning('校验通过但是留意还有警告')
      console.warn(warnings)
    }
    else {
      message.success('完美')
    }
  })
}
</script>