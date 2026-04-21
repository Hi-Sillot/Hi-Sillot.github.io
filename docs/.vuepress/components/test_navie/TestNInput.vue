<template>
  <n-form>
    <n-form-item label="默认表现">
      <n-input default-value="🌷🏳️‍🌈" show-count :maxlength="12" />
    </n-form-item>
    <n-form-item label="正确表现">
      <n-input
        default-value="🌷🏳️‍🌈"
        show-count
        :maxlength="12"
        :count-graphemes="countGraphemes"
      />
    </n-form-item>
  </n-form>
</template>

<script setup lang="ts">
import GraphemeSplitter from 'grapheme-splitter'

const splitter = new GraphemeSplitter()
const countGraphemes = (value: string) => splitter.countGraphemes(value)
</script>