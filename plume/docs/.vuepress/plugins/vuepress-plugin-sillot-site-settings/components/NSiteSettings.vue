<template>
  <div>
    <n-button style="margin-left: 18px" circle quaternary @click="visible = true">
      <template #icon>
        <n-icon>
          <MenuApplicationIcon />
        </n-icon>
      </template>
    </n-button>

    <n-drawer v-model:show="visible" :width="550" :placement="placement" :resizable="true" display-directive="show">
      <n-drawer-content title="站点设置" closable>
        <n-list>
          <!-- 布局设置 -->
          <n-list-item>
            <template #suffix>
              <n-switch v-model:value="compactLayoutEnabled" @update:value="onLayoutChange" />
            </template>
            <div class="setting-item">
              <div class="setting-label">紧凑布局</div>
              <div class="setting-description">启用更紧凑的布局显示更多信息</div>
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
              <div class="preview-header">
                加密预览（前{{ Math.min(encryptionPreview.length, 5) }}项）
                <n-tag size="small" type="info" class="preview-stats">
                  {{ encryptionStats.encryptedFields }}/{{ encryptionStats.totalFields }} 字段已加密
                </n-tag>
              </div>
              <div class="preview-items">
                <div v-for="(item, index) in encryptionPreview.slice(0, 5)" :key="index" class="preview-item">
                  <div class="preview-row">
                    <span class="preview-key">{{ item.key }}:</span>
                    <span class="preview-original">{{ item.original }}</span>
                    <span class="preview-arrow">→</span>
                    <span class="preview-encrypted">{{ item.encrypted }}</span>
                  </div>
                  <div v-if="getEncryptedFields(item.key)" class="preview-fields">
                    <n-tag v-for="field in getEncryptedFields(item.key)" :key="field" size="tiny" type="info">
                      {{ field }}
                    </n-tag>
                  </div>
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
                <div class="stat-item">
                  <span class="stat-label">加密字段:</span>
                  <span class="stat-value info">{{ encryptionStats.encryptedFields }}/{{ encryptionStats.totalFields
                    }}</span>
                </div>
              </div>
            </div>
          </n-list-item>

          <!-- 字段级加密信息 -->
          <n-list-item v-if="Object.keys(CedossStore.encryptedCedoss).length > 0">
            <div class="encryption-info">
              <div class="encryption-header">字段级加密信息</div>
              <div class="encryption-stats">
                <n-progress type="circle" :percentage="Math.round(encryptionStats.encryptionRatio * 100)"
                  :stroke-width="10" :width="60" class="progress-circle" />
                <div class="stats-details">
                  <div class="stat-detail">
                    <span class="detail-label">总加密字段:</span>
                    <span class="detail-value">{{ encryptionStats.encryptedFields }}</span>
                  </div>
                  <div class="stat-detail">
                    <span class="detail-label">总可加密字段:</span>
                    <span class="detail-value">{{ encryptionStats.totalFields }}</span>
                  </div>
                  <div class="stat-detail">
                    <span class="detail-label">加密比例:</span>
                    <span class="detail-value">{{ Math.round(encryptionStats.encryptionRatio * 100) }}%</span>
                  </div>
                </div>
              </div>
              <div class="common-fields">
                <div class="fields-title">常用加密字段:</div>
                <div class="fields-list">
                  <n-tag v-for="field in commonEncryptedFields" :key="field" size="small" type="primary">
                    {{ getFieldDisplayName(field) }}
                  </n-tag>
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
import { ref, onMounted, onUnmounted, watch, computed } from 'vue';
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
  NTag,
  NProgress,
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
  downloadEncryptedFile,
  getEncryptionStats,
  type EncryptableField
} from '../handler/site-settings';

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

// 加密统计信息
const encryptionStats = computed(() => {
  return getEncryptionStats(CedossStore.encryptedCedoss);
});

// 常用加密字段
const commonEncryptedFields = computed(() => {
  const fields: EncryptableField[] = [];
  const encryptedCedoss = CedossStore.encryptedCedoss;

  if (Object.keys(encryptedCedoss).length === 0) return fields;

  // 统计字段出现频率
  const fieldCount: Record<string, number> = {};
  Object.values(encryptedCedoss).forEach(item => {
    item.encryptedFields.forEach(field => {
      fieldCount[field] = (fieldCount[field] || 0) + 1;
    });
  });

  // 返回出现频率最高的前5个字段
  return Object.entries(fieldCount)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([field]) => field as EncryptableField);
});

// 字段显示名称映射
const fieldDisplayNames: Record<EncryptableField, string> = {
  standardCode: '标码',
  ancientStandardCode: '古标码',
  simplifiedStandardCode: '简标码',
  affix: '缀',
  relatedWords: '关联词',
  liaisonSpelling: '联拼',
  pinyin: '拼音',
  chineseMeaning: '汉意',
  tableAttribute: '表属'
};

// 获取字段显示名称
const getFieldDisplayName = (field: EncryptableField): string => {
  return fieldDisplayNames[field] || field;
};

// 获取加密字段列表
const getEncryptedFields = (key: string): string[] => {
  const encryptedItem = CedossStore.encryptedCedoss[key];
  if (!encryptedItem) return [];

  return encryptedItem.encryptedFields.map(field => getFieldDisplayName(field));
};

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

    // 更新加密预览
    if (result.previewItems) {
      encryptionPreview.value = result.previewItems;
    }
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

// 监听加密数据变化，更新预览
watch(() => CedossStore.encryptedCedoss, (newEncryptedCedoss) => {
  // 如果有解密密钥，尝试更新预览
  if (CedossStore.decryptionKey && Object.keys(newEncryptedCedoss).length > 0) {
    updateEncryptionPreview();
  }
}, { deep: true });

// 更新加密预览
const updateEncryptionPreview = async () => {
  try {
    const previewItems: Array<{ key: string, original: string, encrypted: string }> = [];
    const fullItems = CedossStore.fullMergedCedossants;

    Object.keys(CedossStore.encryptedCedoss).slice(0, 5).forEach(key => {
      const item = fullItems[key];
      if (item) {
        const encryptedItem = CedossStore.encryptedCedoss[key];
        const encryptedValue = encryptedItem.encryptedData.standardCode || '';

        previewItems.push({
          key,
          original: item.standardCode.length > 20
            ? item.standardCode.substring(0, 20) + '...'
            : item.standardCode,
          encrypted: encryptedValue.length > 20
            ? encryptedValue.substring(0, 20) + '...'
            : encryptedValue
        });
      }
    });

    encryptionPreview.value = previewItems;
  } catch (error) {
    console.warn('更新加密预览失败:', error);
  }
};

// 组件挂载时设置初始状态
onMounted(() => {
  CedossStore.initializeFromStorage();
  loadLayoutSetting();
  encryptionKey.value = CedossStore.decryptionKey;

  // 初始化加密预览
  if (CedossStore.decryptionKey && Object.keys(CedossStore.encryptedCedoss).length > 0) {
    updateEncryptionPreview();
  }
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
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 500;
  margin-bottom: 8px;
  color: var(--td-text-color-secondary);
  font-size: 14px;
}

.preview-stats {
  font-size: 10px;
}

.preview-items {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.preview-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px;
  background-color: var(--td-bg-color-secondarycontainer);
  border-radius: 4px;
}

.preview-row {
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

.preview-fields {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
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
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
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

.stat-value.info {
  color: var(--td-brand-color);
}

.upload-button {
  margin-top: 8px;
}

.encryption-info {
  width: 100%;
  border: 1px solid var(--td-border-level-1-color);
  border-radius: 6px;
  padding: 12px;
  background-color: var(--td-bg-color-container);
}

.encryption-header {
  font-weight: 500;
  margin-bottom: 12px;
  color: var(--td-text-color-secondary);
  font-size: 14px;
}

.encryption-stats {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 12px;
}

.progress-circle {
  flex-shrink: 0;
}

.stats-details {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
}

.stat-detail {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
}

.detail-label {
  color: var(--td-text-color-secondary);
}

.detail-value {
  color: var(--td-brand-color);
  font-weight: 500;
}

.common-fields {
  border-top: 1px solid var(--td-border-level-1-color);
  padding-top: 8px;
}

.fields-title {
  font-size: 12px;
  color: var(--td-text-color-secondary);
  margin-bottom: 6px;
}

.fields-list {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
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

@media (max-width: 768px) {
  .stats-items {
    grid-template-columns: 1fr;
  }

  .encryption-stats {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }

  .preview-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
}
</style>