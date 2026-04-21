<template>
  <a class="vscode-settings-link inline"  :href="`vscode://settings/${id}`" :title="`在 VSCode 中打开 ${id} 设置`">
       <span class="vscode-icon">
      <svg  xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="currentColor"><title>file_type_vscode</title><path d="M29.01,5.03,23.244,2.254a1.742,1.742,0,0,0-1.989.338L2.38,19.8A1.166,1.166,0,0,0,2.3,21.447c.025.027.05.053.077.077l1.541,1.4a1.165,1.165,0,0,0,1.489.066L28.142,5.75A1.158,1.158,0,0,1,30,6.672V6.605A1.748,1.748,0,0,0,29.01,5.03Z" style="fill:#0065a9"></path><path d="M29.01,26.97l-5.766,2.777a1.745,1.745,0,0,1-1.989-.338L2.38,12.2A1.166,1.166,0,0,1,2.3,10.553c.025-.027.05-.053.077-.077l1.541-1.4A1.165,1.165,0,0,1,5.41,9.01L28.142,26.25A1.158,1.158,0,0,0,30,25.328V25.4A1.749,1.749,0,0,1,29.01,26.97Z" style="fill:#007acc"></path><path d="M23.244,29.747a1.745,1.745,0,0,1-1.989-.338A1.025,1.025,0,0,0,23,28.684V3.316a1.024,1.024,0,0,0-1.749-.724,1.744,1.744,0,0,1,1.989-.339l5.765,2.772A1.748,1.748,0,0,1,30,6.6V25.4a1.748,1.748,0,0,1-.991,1.576Z" style="fill:#1f9cf0"></path></svg>
    </span>
    <code class="setting-id">{{ id }}</code>
  </a>
</template>

<script>
export default {
  name: 'VSCodeSettingsLink',
  props: {
    id: {
      type: String,
      required: true
    }
  }
}
</script>

<style scoped>
.vscode-settings-link.inline {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  margin: 0 2px;
  background-color: var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-border);
  border-radius: 6px;
  color: var(--vp-c-text-1);
  text-decoration: none;
  font-size: 13px;
  font-weight: 500;
  transition: all 0.2s ease;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  vertical-align: middle;
  line-height: 1;
  max-width: 100%;
  overflow: hidden;
}

.vscode-settings-link.inline:hover {
  background-color: var(--vp-c-bg-soft-up);
  border-color: var(--vp-c-brand-1);
  color: var(--vp-c-brand-1);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  transform: translateY(-1px);
}

.setting-id {
  background-color: var(--vp-c-default-soft);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: 'Monaco', 'Menlo', 'Consolas', 'Courier New', monospace;
  font-size: 12px;
  color: var(--vp-c-text-2);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 300px;
  transition: all 0.2s ease;
}

.vscode-settings-link.inline:hover .setting-id {
  background-color: var(--vp-c-brand-soft);
  color: var(--vp-c-brand-1);
}

.vscode-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: #0078d7; /* VSCode 品牌蓝色 */
  transition: all 0.2s ease;
}

.vscode-settings-link.inline:hover .vscode-icon {
  color: var(--vp-c-brand-1);
}

.vscode-icon svg {
  width: 14px;
  height: 14px;
}

/* 暗黑模式适配 */
@media (prefers-color-scheme: dark) {
  .vscode-settings-link.inline {
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
  }
  
  .vscode-settings-link.inline:hover {
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  }
  
  .vscode-icon {
    color: #4daafc; /* 暗黑模式下更亮的蓝色 */
  }
}

/* 响应式设计 */
@media (max-width: 680px) {
  .vscode-settings-link.inline {
    padding: 3px 6px;
    font-size: 12px;
    gap: 4px;
  }
  
  .setting-id {
    max-width: 130px;
    font-size: 11px;
    padding: 1px 4px;
  }
  
  .vscode-icon svg {
    width: 12px;
    height: 12px;
  }
}
</style>