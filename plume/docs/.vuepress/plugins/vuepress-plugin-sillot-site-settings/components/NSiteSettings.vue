<template>
  <div>
    <n-button style="margin-left: 18px" circle quaternary @click="visible = true">
      <template #icon>
        <n-icon>
          <MenuApplicationIcon />
        </n-icon>
      </template>
    </n-button>

    <n-drawer v-model:show="visible" :width="520" :placement="placement" :resizable="true" display-directive="show">
      <n-drawer-content title="站点设置" closable>
        <n-list>
          <!-- 布局设置 -->
          <n-list-item>
            <template #suffix>
              <n-switch v-model:value="compactLayoutEnabled" @update:value="onLayoutChange" />
            </template>
            <div class="setting-item">
              <div class="setting-label">紧凑布局</div>
              <div class="setting-description">在宽屏设备上启用更紧凑的布局</div>
            </div>
          </n-list-item>

          <!-- 密钥管理 -->
          <n-list-item>
            <template #suffix>
              <n-button type="primary" ghost size="medium" @click="saveKey">保存</n-button>
            </template>
            <div class="setting-item">
              <div class="setting-label">加密密钥</div>
              <n-input v-model:value="encryptionKey" type="password" show-password-on="click" placeholder="请输入加密密钥"
                maxlength="13" show-count clearable>
                <template #prefix>
                  <n-button quaternary circle size="tiny" @click="handleGenerateKey">
                    <template #icon>
                      <n-icon>
                        <RefreshIcon />
                      </n-icon>
                    </template>
                  </n-button>
                </template>
              </n-input>
              <div class="setting-description">用于加解密映射文件，保存仅当前会话存储生效</div>
            </div>
          </n-list-item>

          <!-- 加密映射文件 -->
          <n-list-item>
            <template #suffix>
              <n-upload :file-list="encryptUploadFiles" :default-upload="false" :show-file-list="false" accept=".json"
                @change="handleEncryptUpload">
                <n-button type="primary" ghost size="medium" class="upload-button">上传</n-button>
              </n-upload>
            </template>
            <div class="setting-item">
              <div class="setting-label">加密映射文件</div>
              <div class="setting-description">上传未加密映射文件，使用当前密钥加密后下载</div>
            </div>
          </n-list-item>

          <!-- 导入加密映射 -->
          <n-list-item>
            <template #suffix>
              <n-upload :file-list="importUploadFiles" :default-upload="false" :show-file-list="false" accept=".json"
                @change="handleImportUpload">
                <n-button type="primary" ghost size="medium" class="upload-button">上传</n-button>
              </n-upload>
            </template>
            <div class="setting-item">
              <div class="setting-label">导入加密映射</div>
              <div class="setting-description">从JSON文件导入加密映射配置到站点</div>
            </div>
          </n-list-item>

          <!-- 状态信息 -->
          <n-list-item v-if="statusMessage" class="status-message">
            <div :class="['status-content', statusType]">
              <n-icon>
                <CheckCircleFilledIcon v-if="statusType === 'success'" />
                <ErrorCircleFilledIcon v-else-if="statusType === 'error'" />
                <HelpCircleIcon v-else />
              </n-icon>
              <span>{{ statusMessage }}</span>
            </div>
          </n-list-item>

          <!-- 加密预览 -->
          <n-list-item v-if="encryptionPreview.length > 0">
            <div class="preview-section">
              <div class="preview-header">加密预览（前{{ Math.min(encryptionPreview.length, 5) }}项）</div>
              <div class="preview-items">
                <div v-for="(item, index) in encryptionPreview.slice(0, 5)" :key="index" class="preview-item">
                  <span class="preview-key">{{ item.key }}:</span>
                  <span class="preview-original">{{ item.original }}</span>
                  <span class="preview-arrow">→</span>
                  <span class="preview-encrypted">{{ item.encrypted }}</span>
                </div>
              </div>
            </div>
          </n-list-item>

          <!-- 意码状态信息 -->
          <n-list-item v-if="CedossStore.hasDecryptErrors" class="status-message">
            <div class="status-content error">
              <n-icon>
                <ErrorCircleFilledIcon />
              </n-icon>
              <span>解密错误: {{ CedossStore.getDecryptErrors.length }} 个意码解密失败</span>
            </div>
          </n-list-item>

          <!-- 当前意码统计 -->
          <n-list-item>
            <div class="stats-section">
              <div class="stats-header">意码统计</div>
              <div class="stats-items">
                <div class="stat-item">
                  <span class="stat-label">普通意码:</span>
                  <span class="stat-value">{{ Object.keys(CedossStore.plainCedoss).length }}</span>
                </div>
                <div class="stat-item">
                  <span class="stat-label">加密意码:</span>
                  <span class="stat-value">{{ Object.keys(CedossStore.encryptedCedoss).length }}</span>
                </div>
                <div class="stat-item">
                  <span class="stat-label">解密错误:</span>
                  <span class="stat-value error">{{ CedossStore.getDecryptErrors.length }}</span>
                </div>
              </div>
            </div>
          </n-list-item>
        </n-list>
      </n-drawer-content>
    </n-drawer>
  </div>
</template>

<script lang="ts" setup>
import { ref, onMounted, onUnmounted, watch } from 'vue';
import {
  NButton,
  NDrawer,
  NDrawerContent,
  NList,
  NListItem,
  NSwitch,
  NInput,
  NUpload,
  NIcon,
  useMessage,
  type UploadFileInfo
} from 'naive-ui';
import {
  MenuApplicationIcon,
  RefreshIcon,
  CheckCircleFilledIcon,
  ErrorCircleFilledIcon,
  HelpCircleIcon
} from 'tdesign-icons-vue-next';
import { useCedossStore } from '../../vuepress-plugin-sillot-cedoss/stores/useCedoss';
import { 
  useStatusMessage, 
  useEncryptionKey, 
  useLayoutSettings,
  handleFileUpload, 
  downloadEncryptedFile 
} from '../handler/site-settings';

// 消息提示
const message = useMessage();

// 抽屉相关
const visible = ref(false);
const placement = ref<'right' | 'top' | 'bottom' | 'left'>('right');

// 上传文件
const importUploadFiles = ref<UploadFileInfo[]>([]);
const encryptUploadFiles = ref<UploadFileInfo[]>([]);

// 状态管理
const { statusMessage, statusType, showStatus } = useStatusMessage();
const CedossStore = useCedossStore();

// 布局和加密管理
const { compactLayoutEnabled, toggleLayout, loadLayoutSetting } = useLayoutSettings();
const { encryptionKey, generateKey } = useEncryptionKey(CedossStore.decryptionKey);
const encryptionPreview = ref<Array<{ key: string, original: string, encrypted: string }>>([]);

// 生成随机密钥
const handleGenerateKey = () => {
  generateKey(13, 13);
  showStatus('已生成随机密钥', 'success');
};

// 保存密钥到store
const saveKey = () => {
  if (!encryptionKey.value.trim()) {
    showStatus('请输入有效的密钥', 'error');
    return;
  }

  CedossStore.setDecryptionKey(encryptionKey.value);
  showStatus('密钥已保存并应用', 'success');
};

// 处理加密上传
const handleEncryptUpload = async (data: { file: UploadFileInfo, fileList: UploadFileInfo[] }) => {
  const { file } = data;
  if (!file) return;

  const result = await handleFileUpload(file.file as File, encryptionKey.value, 'encrypt');

  if (result.success) {
    downloadEncryptedFile(result.data!);
    encryptionPreview.value = result.previewItems || [];
    showStatus('加密映射文件已生成并下载（新格式）', 'success');
  } else {
    showStatus(`加密失败: ${result.error}`, 'error');
  }
  
  encryptUploadFiles.value = [];
};

// 处理导入上传
const handleImportUpload = async (data: { file: UploadFileInfo, fileList: UploadFileInfo[] }) => {
  const { file } = data;
  if (!file) return;

  const result = await handleFileUpload(file.file as File, encryptionKey.value, 'import');

  if (result.success) {
    CedossStore.loadEncryptedCedoss(result.data);
    showStatus(`成功导入 ${Object.keys(result.data).length} 个加密意码`, 'success');
  } else {
    showStatus(`导入失败: ${result.error}`, 'error');
  }
  
  importUploadFiles.value = [];
};

// 布局设置变化
const onLayoutChange = (val: boolean) => {
  toggleLayout(val);
  showStatus(val ? '紧凑布局已启用' : '紧凑布局已禁用', 'info');
};

// 监听 store 密钥变化
watch(() => CedossStore.decryptionKey, (newKey) => {
  encryptionKey.value = newKey;
});

// 组件挂载时设置初始状态
onMounted(() => {
  CedossStore.initializeFromStorage();
  loadLayoutSetting();
  encryptionKey.value = CedossStore.decryptionKey;
});

// 组件卸载时清理
onUnmounted(() => {
  document.body.classList.remove('compact-layout');
});
</script>

<style scoped>
.setting-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.setting-label {
  font-weight: 500;
  color: var(--td-text-color-primary);
}

.setting-description {
  font-size: 12px;
  color: var(--td-text-color-placeholder);
  line-height: 1.4;
}

.status-message {
  margin-top: 16px;
  padding: 12px;
  border-radius: 6px;
}

.status-content {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
}

.status-content.success {
  color: var(--td-success-color);
  background-color: var(--td-success-color-1);
  padding: 8px 12px;
  border-radius: 4px;
}

.status-content.error {
  color: var(--td-error-color);
  background-color: var(--td-error-color-1);
  padding: 8px 12px;
  border-radius: 4px;
}

.status-content.info {
  color: var(--td-brand-color);
  background-color: var(--td-brand-color-1);
  padding: 8px 12px;
  border-radius: 4px;
}

.preview-section {
  width: 100%;
  border: 1px solid var(--td-border-level-1-color);
  border-radius: 6px;
  padding: 12px;
  background-color: var(--td-bg-color-container);
}

.preview-header {
  font-weight: 500;
  margin-bottom: 8px;
  color: var(--td-text-color-secondary);
  font-size: 14px;
}

.preview-items {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.preview-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  font-family: 'Courier New', monospace;
}

.preview-key {
  color: var(--td-brand-color);
  font-weight: 500;
  min-width: 80px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.preview-original {
  color: var(--td-success-color);
  max-width: 100px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.preview-arrow {
  color: var(--td-text-color-placeholder);
}

.preview-encrypted {
  color: var(--td-warning-color);
  max-width: 100px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.stats-section {
  width: 100%;
  border: 1px solid var(--td-border-level-1-color);
  border-radius: 6px;
  padding: 12px;
  background-color: var(--td-bg-color-container);
}

.stats-header {
  font-weight: 500;
  margin-bottom: 8px;
  color: var(--td-text-color-secondary);
  font-size: 14px;
}

.stats-items {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.stat-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
}

.stat-label {
  color: var(--td-text-color-secondary);
}

.stat-value {
  color: var(--td-success-color);
  font-weight: 500;
}

.stat-value.error {
  color: var(--td-error-color);
}

.upload-button {
  margin-top: 8px;
}

@media (min-width: 1400px) and (max-width: 2400px) {
  :global(body.compact-layout) {
    --vp-layout-max-width: 94vw !important;
  }

  :global(body.compact-layout .vp-doc-container.has-aside .content-container) {
    max-width: 1300px !important;
  }

  :global(body.compact-layout .vp-doc-container:not(.has-sidebar) .container) {
    max-width: 1300px !important;
  }
}
</style>