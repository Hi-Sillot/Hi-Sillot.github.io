<!-- 作用范围取决于挂载位置，当挂载到顶栏插槽他是全局的，挂载在页内插槽则仅影响当前页面 -->
<!-- TODO: 紧凑布局在移动端应当隐藏，暂时不做处理 -->
<template>
  <div>
    <t-drawer v-model:visible="visible" attach="body" :mode="mode" :size="'520px'" :placement="placement" header="站点设置"
      :footer="null" destroy-on-close>
      <t-list>
        <!-- 布局设置 -->
        <t-list-item>
          <template #action>
            <t-switch v-model="compactLayoutEnabled" @change="onLayoutChange" />
          </template>
          <template #default>
            <div class="setting-item">
              <div class="setting-label">紧凑布局</div>
              <div class="setting-description">在宽屏设备上启用更紧凑的布局</div>
            </div>
          </template>
        </t-list-item>

        <!-- 密钥管理 -->
        <t-list-item>
          <template #action>
            <t-button variant="outline" size="medium" @click="saveKey">保存</t-button>
          </template>
          <template #default>
            <div class="setting-item">
              <div class="setting-label">加密密钥</div>
              <t-input v-model="encryptionKey" type="password" placeholder="请输入加密密钥" :maxlength="13" show-limit-number>
                <template #prefix-icon>
                  <lock-on-icon />
                </template>
                <template #suffix>
                  <t-button variant="text" size="medium" @click="generateRandomKey">
                    <refresh-icon />
                  </t-button>
                </template>
              </t-input>
              <div class="setting-description">用于加解密映射文件，保存仅当前会话存储生效</div>
            </div>
          </template>
        </t-list-item>

        <!-- 加密映射文件 -->
        <t-list-item>
          <template #action>
            <t-upload v-model:files="encryptUploadFiles" :auto-upload="false" :show-file-list="false" accept=".json"
              @change="handleEncryptUpload">
            </t-upload>
          </template>
          <template #default>
            <div class="setting-item">
              <div class="setting-label">加密映射文件</div>
              <div class="setting-description">上传未加密映射文件，使用当前密钥加密后下载</div>
            </div>
          </template>
        </t-list-item>

        <!-- 导入加密映射 -->
        <t-list-item>
          <template #action>
            <t-upload v-model:files="importUploadFiles" :auto-upload="false" :show-file-list="false" accept=".json"
              @change="handleImportUpload">
            </t-upload>
          </template>
          <template #default>
            <div class="setting-item">
              <div class="setting-label">导入加密映射</div>
              <div class="setting-description">从JSON文件导入加密映射配置到站点</div>
            </div>
          </template>
        </t-list-item>

        <!-- 状态信息 -->
        <t-list-item v-if="statusMessage" class="status-message">
          <div :class="['status-content', statusType]">
            <t-icon :name="statusIcon" />
            <span>{{ statusMessage }}</span>
          </div>
        </t-list-item>

        <!-- 加密预览 -->
        <t-list-item v-if="encryptionPreview.length > 0">
          <template #default>
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
          </template>
        </t-list-item>

        <!-- 意码状态信息 -->
        <t-list-item v-if="CedossStore.hasDecryptErrors" class="status-message">
          <div class="status-content error">
            <t-icon name="error-circle" />
            <span>解密错误: {{ CedossStore.getDecryptErrors.length }} 个意码解密失败</span>
          </div>
        </t-list-item>

        <!-- 当前意码统计 -->
        <t-list-item>
          <template #default>
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
          </template>
        </t-list-item>
      </t-list>
    </t-drawer>

    <t-button style="margin-left: 18px;" shape="circle" variant="text" @click="visible = true">
      <menu-application-icon :stroke-width="2" />
    </t-button>
  </div>
</template>

<script lang="ts" setup>
import { ref, watch, onMounted, onUnmounted, computed } from 'vue';
import { DrawerProps, SwitchProps, UploadProps, MessagePlugin, UploadFile } from 'tdesign-vue-next';
import { MenuApplicationIcon, RefreshIcon, LockOnIcon } from 'tdesign-icons-vue-next';
import { CedossMap, EncryptedCedossantItem, EncryptedCedoss, useCedossStore } from '../../vuepress-plugin-sillot-inline/stores/useCedoss';


// 抽屉相关
const visible = ref(false);
const mode = ref<DrawerProps['mode']>('push');
const placement = ref<DrawerProps['placement']>('right');

const importUploadFiles = ref<UploadFile[]>([]);
const encryptUploadFiles = ref<UploadFile[]>([]);

// 布局设置
const compactLayoutEnabled = ref(false);

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

// 简单的异或加密函数（与store中保持一致）
const simpleXorCrypt = (str: string, key: string): string => {
  if (!key) return str;
  let result = '';
  for (let i = 0; i < str.length; i++) {
    const keyChar = key.charCodeAt(i % key.length);
    const strChar = str.charCodeAt(i);
    result += String.fromCharCode(strChar ^ keyChar);
  }
  return result;
};

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

// 保存密钥到store
const saveKey = () => {
  if (!encryptionKey.value.trim()) {
    showStatus('请输入有效的密钥', 'error');
    return;
  }

  CedossStore.setDecryptionKey(encryptionKey.value);
  showStatus('密钥已保存并应用', 'success');
};

// 处理加密上传 - 加密用户上传的映射文件并下载（使用新格式）
const handleEncryptUpload: UploadProps['onChange'] = async (files) => {
  if (!files || files.length === 0) return;

  const file = files[0];
  if (!file.raw) return;

  // 检查密钥
  if (!encryptionKey.value.trim()) {
    showStatus('请先设置加密密钥', 'error');
    encryptUploadFiles.value = [];
    return;
  }

  try {
    const text = await readFileAsText(file.raw);
    const mappingData = JSON.parse(text) as CedossMap;

    // 使用新格式加密映射数据 { value: string, encrypted: true, algorithm: string }
    const encryptedData: EncryptedCedoss = {};
    const previewItems: Array<{ key: string, original: string, encrypted: string }> = [];

    for (const [key, value] of Object.entries(mappingData)) {
      if (typeof value === 'string') {
        const encryptedValue = simpleXorCrypt(value, encryptionKey.value);
        // 使用新格式
        encryptedData[key] = {
          value: encryptedValue,
          encrypted: true,
          algorithm: "xor"
        };
        previewItems.push({
          key,
          original: value.length > 20 ? value.substring(0, 20) + '...' : value,
          encrypted: encryptedValue.length > 20 ? encryptedValue.substring(0, 20) + '...' : encryptedValue
        });
      }
    }

    // 更新预览
    encryptionPreview.value = previewItems;

    // 创建加密文件并下载
    const blob = new Blob([JSON.stringify(encryptedData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `encrypted-mapping-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showStatus('加密映射文件已生成并下载（新格式）', 'success');
  } catch (error) {
    console.error('加密失败:', error);
    showStatus('加密失败，请检查文件格式', 'error');
  } finally {
    // 清空上传文件列表
    encryptUploadFiles.value = [];
  }
};

// 类型守卫函数，检查是否为加密数据项
const isEncryptedCedossantItem = (value: any): value is EncryptedCedossantItem => {
  return value && typeof value === 'object' && 'value' in value;
};


// 处理导入上传 - 只接受严格格式的加密文件
const handleImportUpload: UploadProps['onChange'] = async (files) => {
  if (!files || files.length === 0) return;

  const file = files[0];
  if (!file.raw) return;

  try {
    const text = await readFileAsText(file.raw);
    const encryptedData = JSON.parse(text);

    // 严格验证：必须符合 EncryptedCedoss 接口
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
    // 清空上传文件列表：通过清空绑定的响应式数组实现
    importUploadFiles.value = [];
  }
};


// 严格的加密意码数据验证
const isValidEncryptedCedoss = (data: any): data is EncryptedCedoss => {
  if (!data || typeof data !== 'object') return false;

  for (const key in data) {
    const item = data[key];

    // 每个项必须符合 EncryptedCedossantItem 接口
    if (!item || typeof item !== 'object') return false;
    if (typeof item.value !== 'string') return false;
    if (item.encrypted !== true) return false;

    // 可选算法字段检查
    if (item.algorithm && typeof item.algorithm !== 'string') return false;
  }

  return true;
};

// 读取文件为文本
const readFileAsText = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.readAsText(file);
  });
};

// 布局设置变化
const onLayoutChange = (val: boolean) => {
  updateBodyClass();
  saveLayoutSetting();
  showStatus(val ? '紧凑布局已启用' : '紧凑布局已禁用', 'info');
};

// 更新body类
const updateBodyClass = () => {
  if (compactLayoutEnabled.value) {
    document.body.classList.add('compact-layout');
  } else {
    document.body.classList.remove('compact-layout');
  }
};

// 初始化状态
const initializeState = () => {
  // 从store加载当前密钥
  encryptionKey.value = CedossStore.decryptionKey;

  // 从localStorage加载布局设置
  const savedLayout = localStorage.getItem('compactLayoutEnabled');
  if (savedLayout !== null) {
    compactLayoutEnabled.value = savedLayout === 'true';
  }

  updateBodyClass();
};

// 保存布局设置到localStorage
const saveLayoutSetting = () => {
  localStorage.setItem('compactLayoutEnabled', compactLayoutEnabled.value.toString());
};

// 监听布局变化
watch(compactLayoutEnabled, () => {
  updateBodyClass();
  saveLayoutSetting();
});
// 监听 store 密钥变化
watch(() => CedossStore.decryptionKey, (newKey) => {
  encryptionKey.value = newKey;
});

// 组件挂载时设置初始状态
onMounted(() => {
   // 初始化 store
  CedossStore.initializeFromStorage();
  initializeState();
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

:deep(.t-list-item__action) {
  display: flex;
  align-items: center;
  gap: 8px;
}

:deep(.t-upload) {
  display: inline-block;
}
</style>

<style>
/* 全局样式 - 紧凑布局 */
@media (1400px <=width <=2400px) {
  body.compact-layout {
    --vp-layout-max-width: 94vw !important;
  }

  body.compact-layout .vp-doc-container.has-aside .content-container {
    max-width: 1300px !important;
  }

  body.compact-layout .vp-doc-container:not(.has-sidebar) .container {
    max-width: 1300px !important;
  }
}
</style>