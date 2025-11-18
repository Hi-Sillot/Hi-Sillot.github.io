<template>
  <div class="navbar-settings">
    <!-- 触发按钮 - 适配顶栏样式 -->
    <t-button class="navbar-trigger" variant="text" size="small" @click="visible = true">
      <menu-application-icon />
    </t-button>

    <!-- 设置面板 -->
    <t-popup v-model:visible="visible" placement="bottom" :overlay-style="{ backgroundColor: 'rgba(0, 0, 0, 0.6)' }"
      destroy-on-close>
      <div class="navbar-settings-panel">
        <!-- 标题栏 -->
        <div class="panel-header">
          <div class="panel-title">站点设置</div>
          <t-button variant="text" size="small" @click="visible = false">
            <close-icon />
          </t-button>
        </div>

        <!-- 内容区域 -->
        <div class="panel-content">
          <!-- 密钥管理 -->
          <div class="setting-card">
            <div class="card-header">
              <lock-on-icon class="card-icon" />
              <span class="card-title">加密设置</span>
            </div>

            <div class="setting-item">
              <div class="item-label">加密密钥</div>
              <div class="item-control">
                <t-input v-model="encryptionKey" type="password" placeholder="请输入加密密钥" :maxlength="13" clearable>
                  <template #suffix>
                    <t-button variant="text" size="small" @click="generateRandomKey">
                      <refresh-icon />
                    </t-button>
                  </template>
                </t-input>
              </div>
              <div class="item-description">用于加解密映射文件，保存仅当前会话存储生效</div>
              <t-button block theme="primary" size="medium" @click="saveKey" class="save-btn">保存密钥</t-button>
            </div>
          </div>

          <!-- 文件操作 -->
          <div class="setting-card">
            <div class="card-header">
              <file-icon class="card-icon" />
              <span class="card-title">文件操作</span>
            </div>

            <div class="action-buttons">
              <t-button block variant="outline" size="medium" @click="handleEncryptClick" class="action-btn">
                <upload-icon class="btn-icon" />
                加密映射文件
              </t-button>

              <t-button block variant="outline" size="medium" @click="handleImportClick" class="action-btn">
                <download-icon class="btn-icon" />
                导入加密映射
              </t-button>
            </div>
          </div>

          <!-- 状态信息 -->
          <div v-if="statusMessage" class="status-message" :class="statusType">
            <t-icon :name="statusIcon" />
            <span>{{ statusMessage }}</span>
          </div>

          <!-- 意码统计 -->
          <div class="setting-card">
            <div class="card-header">
              <chart-icon class="card-icon" />
              <span class="card-title">意码统计</span>
            </div>

            <div class="stats-grid">
              <div class="stat-item">
                <div class="stat-value">{{ Object.keys(CedossStore.plainCedoss).length }}</div>
                <div class="stat-label">普通意码</div>
              </div>
              <div class="stat-item">
                <div class="stat-value">{{ Object.keys(CedossStore.encryptedCedoss).length }}</div>
                <div class="stat-label">加密意码</div>
              </div>
              <div class="stat-item" :class="{ 'has-error': CedossStore.getDecryptErrors.length > 0 }">
                <div class="stat-value">{{ CedossStore.getDecryptErrors.length }}</div>
                <div class="stat-label">解密错误</div>
              </div>
            </div>

            <div v-if="CedossStore.hasDecryptErrors" class="error-notice">
              <t-icon name="error-circle" />
              <span>{{ CedossStore.getDecryptErrors.length }} 个意码解密失败</span>
            </div>
          </div>

          <!-- 加密预览 -->
          <div v-if="encryptionPreview.length > 0" class="setting-card">
            <div class="card-header">
              <view-list-icon class="card-icon" />
              <span class="card-title">加密预览</span>
            </div>

            <div class="preview-list">
              <div v-for="(item, index) in encryptionPreview.slice(0, 3)" :key="index" class="preview-item">
                <div class="preview-original">
                  <span class="preview-label">原值:</span>
                  <span class="preview-text">{{ item.original }}</span>
                </div>
                <div class="preview-encrypted">
                  <span class="preview-label">加密:</span>
                  <span class="preview-text">{{ item.encrypted }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </t-popup>

    <!-- 隐藏的文件输入 -->
    <input ref="encryptFileInput" type="file" accept=".json" style="display: none" @change="handleEncryptUpload">
    <input ref="importFileInput" type="file" accept=".json" style="display: none" @change="handleImportUpload">
  </div>
</template>

<script lang="ts" setup>
import { ref, computed, onMounted } from 'vue';
import {
  MenuApplicationIcon,
  RefreshIcon,
  LockOnIcon,
  CloseIcon,
  UploadIcon,
  DownloadIcon,
  FileIcon,
  ChartIcon,
  ViewListIcon
} from 'tdesign-icons-vue-next';
import { useCedossStore } from '../../vuepress-plugin-sillot-inline/stores/useCedoss';
import { isValidEncryptedCedoss, readFileAsText, simpleXorCrypt } from '../handler/site-settings';

// 弹出层可见性
const visible = ref(false);

// 文件输入引用
const encryptFileInput = ref<HTMLInputElement>();
const importFileInput = ref<HTMLInputElement>();

// 加密相关
const CedossStore = useCedossStore();
const encryptionKey = ref('');
const encryptionPreview = ref<Array<{ key: string, original: string, encrypted: string }>>([]);

// 状态消息
const statusMessage = ref('');
const statusType = ref<'success' | 'error' | 'info'>('info');

// 状态图标
const statusIcon = computed(() => {
  switch (statusType.value) {
    case 'success': return 'check-circle';
    case 'error': return 'error-circle';
    default: return 'help-circle';
  }
});

// 显示状态消息
const showStatus = (message: string, type: 'success' | 'error' | 'info' = 'info', duration: number = 3000) => {
  statusMessage.value = message;
  statusType.value = type;

  if (duration > 0) {
    setTimeout(() => {
      statusMessage.value = '';
    }, duration);
  }
};

// 生成随机密钥
const generateRandomKey = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let result = '';
  for (let i = 0; i < 16; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  encryptionKey.value = result;
  showStatus('已生成随机密钥', 'success');
};

// 保存密钥
const saveKey = () => {
  if (!encryptionKey.value.trim()) {
    showStatus('请输入有效的密钥', 'error');
    return;
  }

  CedossStore.setDecryptionKey(encryptionKey.value);
  showStatus('密钥已保存并应用', 'success');
};

// 处理加密文件点击
const handleEncryptClick = () => {
  if (!encryptionKey.value.trim()) {
    showStatus('请先设置加密密钥', 'error');
    return;
  }
  encryptFileInput.value?.click();
};

// 处理导入文件点击
const handleImportClick = () => {
  importFileInput.value?.click();
};

// 处理加密上传
const handleEncryptUpload = async (event: Event) => {
  const input = event.target as HTMLInputElement;
  if (!input.files || input.files.length === 0) return;

  const file = input.files[0];

  try {
    const text = await readFileAsText(file);
    const mappingData = JSON.parse(text);

    // 加密数据
    const encryptedData: any = {};
    const previewItems: Array<{ key: string, original: string, encrypted: string }> = [];

    for (const [key, value] of Object.entries(mappingData)) {
      if (typeof value === 'string') {
        const encryptedValue = simpleXorCrypt(value, encryptionKey.value);
        encryptedData[key] = {
          value: encryptedValue,
          encrypted: true,
          algorithm: "xor"
        };
        previewItems.push({
          key,
          original: value.length > 15 ? value.substring(0, 15) + '...' : value,
          encrypted: encryptedValue.length > 15 ? encryptedValue.substring(0, 15) + '...' : encryptedValue
        });
      }
    }

    // 更新预览
    encryptionPreview.value = previewItems;

    // 下载加密文件
    const blob = new Blob([JSON.stringify(encryptedData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `encrypted-mapping-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showStatus('加密映射文件已生成并下载', 'success');
  } catch (error) {
    console.error('加密失败:', error);
    showStatus('加密失败，请检查文件格式', 'error');
  } finally {
    // 清空文件输入
    if (input) input.value = '';
  }
};

// 处理导入上传
const handleImportUpload = async (event: Event) => {
  const input = event.target as HTMLInputElement;
  if (!input.files || input.files.length === 0) return;

  const file = input.files[0];

  try {
    const text = await readFileAsText(file);
    const encryptedData = JSON.parse(text);

    // 验证数据格式
    if (!isValidEncryptedCedoss(encryptedData)) {
      throw new Error('文件格式不符合加密意码标准');
    }

    // 加载到store
    CedossStore.loadEncryptedCedoss(encryptedData);
    showStatus(`成功导入 ${Object.keys(encryptedData).length} 个加密意码`, 'success');

  } catch (error) {
    console.error('导入失败:', error);
    showStatus(`导入失败: ${error}`, 'error');
  } finally {
    // 清空文件输入
    if (input) input.value = '';
  }
};


// 初始化状态
const initializeState = () => {
  encryptionKey.value = CedossStore.decryptionKey;
};

// 组件挂载时初始化
onMounted(() => {
  CedossStore.initializeFromStorage();
  initializeState();
});
</script>

<style scoped>
.navbar-settings {
  display: inline-flex;
  align-items: center;
}

/* 顶栏触发按钮样式 */
.navbar-trigger {
  padding: 4px 8px;
  margin: 0;
  border: none;
  background: transparent !important;
}

.navbar-trigger:hover {
  background: rgba(0, 0, 0, 0.04) !important;
}

.navbar-trigger :deep(svg) {
  font-size: 20px;
  color: var(--td-text-color-primary);
}

/* 设置面板样式 */
.navbar-settings-panel {
  background: var(--td-bg-color-container);
  border-radius: 16px 16px 0 0;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--td-border-level-1-color);
  position: sticky;
  top: 0;
  background: inherit;
  z-index: 1;
}

.panel-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--td-text-color-primary);
}

.panel-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.setting-card {
  background: var(--td-bg-color-container);
  border-radius: 12px;
  padding: 16px;
  border: 1px solid var(--td-border-level-1-color);
}

.card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
}

.card-icon {
  color: var(--td-brand-color);
  font-size: 18px;
}

.card-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--td-text-color-primary);
}

.setting-item {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.item-label {
  font-size: 14px;
  font-weight: 500;
  color: var(--td-text-color-primary);
}

.item-description {
  font-size: 12px;
  color: var(--td-text-color-placeholder);
  line-height: 1.4;
}

.save-btn {
  margin-top: 8px;
}

.action-buttons {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.btn-icon {
  font-size: 16px;
}

.stats-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 12px;
  margin-bottom: 12px;
}

.stat-item {
  text-align: center;
  padding: 12px 8px;
  background: var(--td-bg-color-secondarycontainer);
  border-radius: 8px;
}

.stat-item.has-error {
  background: var(--td-error-color-1);
}

.stat-value {
  font-size: 18px;
  font-weight: 600;
  color: var(--td-brand-color);
  margin-bottom: 4px;
}

.stat-item.has-error .stat-value {
  color: var(--td-error-color);
}

.stat-label {
  font-size: 12px;
  color: var(--td-text-color-placeholder);
}

.error-notice {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: var(--td-error-color-1);
  border-radius: 6px;
  font-size: 12px;
  color: var(--td-error-color);
}

.preview-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.preview-item {
  padding: 12px;
  background: var(--td-bg-color-secondarycontainer);
  border-radius: 8px;
  border-left: 3px solid var(--td-brand-color);
}

.preview-original,
.preview-encrypted {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
}

.preview-label {
  color: var(--td-text-color-placeholder);
  min-width: 30px;
}

.preview-text {
  color: var(--td-text-color-primary);
  font-family: 'Courier New', monospace;
  word-break: break-all;
}

.status-message {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  border-radius: 8px;
  font-size: 14px;
}

.status-message.success {
  background: var(--td-success-color-1);
  color: var(--td-success-color);
}

.status-message.error {
  background: var(--td-error-color-1);
  color: var(--td-error-color);
}

.status-message.info {
  background: var(--td-brand-color-1);
  color: var(--td-brand-color);
}

/* 响应式调整 */
@media (max-width: 768px) {
  .panel-content {
    padding: 12px 16px;
  }

  .setting-card {
    padding: 12px;
  }

  .stats-grid {
    gap: 8px;
  }

  .stat-value {
    font-size: 16px;
  }

  .navbar-trigger {
    padding: 4px 6px;
  }

  .navbar-trigger :deep(svg) {
    font-size: 18px;
  }
}

/* 针对顶栏的特定样式调整 */
:deep(.t-navbar) .navbar-settings {
  margin-left: auto;
  margin-right: 8px;
}

/* 确保在顶栏中正确对齐 */
:deep(.t-navbar__content) {
  display: flex;
  align-items: center;
}
</style>