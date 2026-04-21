<!-- components/ToggleButton.vue - 切换按钮组件 -->
<script setup lang="ts">
defineProps<{
  isExpanded: boolean;
}>();

defineEmits<{
  (e: "toggle"): void;
}>();
</script>

<template>
  <button
    class="relationship-map__toggle-btn"
    @click="$emit('toggle')"
  >
    {{ isExpanded ? "折叠图谱 ▼" : "展开图谱 ▶" }}
  </button>
</template>

<style scoped>
.relationship-map__toggle-btn {
  font-size: 14px;
  font-weight: 600;
  display: block;
  width: 100%;
  margin-bottom: 8px;
  padding: 8px 8px 8px 16px;
  cursor: pointer;
  text-align: left;
  color: var(--vp-c-text-1);
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  background: var(--vp-c-bg-mute);
}
</style>