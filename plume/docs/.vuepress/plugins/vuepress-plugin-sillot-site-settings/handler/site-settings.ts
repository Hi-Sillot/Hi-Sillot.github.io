// handler/site-settings.ts

import { readonly, ref, type Ref } from "vue";
import type {
  CedossMap,
  EncryptedCedoss,
  EncryptedCedossantItem,
} from "../../vuepress-plugin-sillot-cedoss/stores/useCedoss";

/**
 * 严格的加密意码数据验证
 */
export const isValidEncryptedCedoss = (data: any): data is EncryptedCedoss => {
  if (!data || typeof data !== "object") return false;

  for (const key in data) {
    const item = data[key];

    // 每个项必须符合 EncryptedCedossantItem 接口
    if (!item || typeof item !== "object") return false;
    if (typeof item.value !== "string") return false;
    if (item.encrypted !== true) return false;

    // 可选算法字段检查
    if (item.algorithm && typeof item.algorithm !== "string") return false;
  }

  return true;
};

/**
 * 读取文件为文本
 */
export const readFileAsText = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = () => reject(new Error("文件读取失败"));
    reader.readAsText(file);
  });
};

/**
 * 简单的异或加密函数（与store中保持一致）
 */
export const simpleXorCrypt = (str: string, key: string): string => {
  if (!key) return str;
  let result = "";
  for (let i = 0; i < str.length; i++) {
    const keyChar = key.charCodeAt(i % key.length);
    const strChar = str.charCodeAt(i);
    result += String.fromCharCode(strChar ^ keyChar);
  }
  return result;
};

// 类型守卫函数，检查是否为加密数据项
export const isEncryptedCedossantItem = (
  value: any,
): value is EncryptedCedossantItem => {
  return value && typeof value === "object" && "value" in value;
};

/**
 * 生成随机密钥的工具函数
 * @param minLength 最小字符数（默认13）
 * @param maxLength 最大字符数（默认13，即固定长度）
 * @returns 生成的随机密钥字符串
 */
export const generateRandomKey = (
  minLength: number = 13,
  maxLength: number = 13,
): string => {
  // 参数验证
  if (minLength <= 0 || maxLength <= 0) {
    throw new Error("最小和最大字符数必须大于0");
  }

  if (minLength > maxLength) {
    // 交换最小和最大值
    [minLength, maxLength] = [maxLength, minLength];
  }

  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
  const length = minLength === maxLength
    ? minLength
    : Math.floor(Math.random() * (maxLength - minLength + 1)) + minLength;

  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return result;
};

/**
 * 验证密钥是否符合要求
 * @param key 要验证的密钥
 * @param minLength 最小长度要求
 * @param maxLength 最大长度要求
 * @returns 验证结果
 */
export const validateKey = (
  key: string,
  minLength: number = 1,
  maxLength: number = 100,
): boolean => {
  if (typeof key !== "string") return false;
  if (key.length < minLength || key.length > maxLength) return false;

  // 可选：添加字符集验证
  const validChars = /^[A-Za-z0-9!@#$%^&*]+$/;
  return validChars.test(key);
};


/**
 * 加密映射数据的核心逻辑
 * @param mappingData 原始映射数据
 * @param encryptionKey 加密密钥
 * @param previewLength 预览文本长度（默认15）
 * @returns 加密后的数据和预览项
 */
export const encryptMappingData = (
  mappingData: CedossMap,
  encryptionKey: string,
  previewLength: number = 15,
): {
  encryptedData: EncryptedCedoss;
  previewItems: Array<{ key: string; original: string; encrypted: string }>;
} => {
  const encryptedData: EncryptedCedoss = {};
  const previewItems: Array<{ key: string; original: string; encrypted: string }> = [];

  for (const [key, value] of Object.entries(mappingData)) {
    if (typeof value === "string") {
      const encryptedValue = simpleXorCrypt(value, encryptionKey);
      // 使用新格式
      encryptedData[key] = {
        value: encryptedValue,
        encrypted: true,
        algorithm: "xor",
      };
      previewItems.push({
        key,
        original: value.length > previewLength
          ? value.substring(0, previewLength) + "..."
          : value,
        encrypted: encryptedValue.length > previewLength
          ? encryptedValue.substring(0, previewLength) + "..."
          : encryptedValue,
      });
    }
  }

  return { encryptedData, previewItems };
};

/**
 * 下载加密文件的通用逻辑
 * @param encryptedData 加密后的数据
 * @param filename 文件名（不包含日期部分）
 */
export const downloadEncryptedFile = (
  encryptedData: EncryptedCedoss,
  filename: string = "encrypted-mapping",
): void => {
  const blob = new Blob([JSON.stringify(encryptedData, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}-${new Date().toISOString().split("T")[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

/**
 * 处理文件上传的通用逻辑
 * @param file 上传的文件
 * @param encryptionKey 加密密钥（用于加密操作）
 * @param operationType 操作类型：'encrypt' | 'import'
 * @returns 操作结果
 */
export const handleFileUpload = async (
  file: File,
  encryptionKey: string,
  operationType: "encrypt" | "import",
): Promise<{
  success: boolean;
  data?: any;
  previewItems?: Array<{ key: string; original: string; encrypted: string }>;
  error?: string;
}> => {
  try {
    const text = await readFileAsText(file);
    const fileData = JSON.parse(text);

    if (operationType === "encrypt") {
      if (!encryptionKey.trim()) {
        throw new Error("请先设置加密密钥");
      }

      const { encryptedData, previewItems } = encryptMappingData(
        fileData,
        encryptionKey,
      );

      return {
        success: true,
        data: encryptedData,
        previewItems,
      };
    } else {
      // import 操作
      if (!isValidEncryptedCedoss(fileData)) {
        throw new Error("文件格式不符合加密意码标准");
      }

      return {
        success: true,
        data: fileData,
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "未知错误",
    };
  }
};

/**
 * 状态消息管理
 */
export const useStatusMessage = () => {
  const statusMessage = ref("");
  const statusType = ref<"success" | "error" | "info">("info");

  const showStatus = (
    message: string,
    type: "success" | "error" | "info" = "info",
    duration: number = 3000,
  ): void => {
    statusMessage.value = message;
    statusType.value = type;

    if (duration > 0) {
      setTimeout(() => {
        statusMessage.value = "";
      }, duration);
    }
  };

  const clearStatus = (): void => {
    statusMessage.value = "";
  };

  return {
    statusMessage: readonly(statusMessage),
    statusType: readonly(statusType),
    showStatus,
    clearStatus,
  };
};

/**
 * 布局设置管理
 */
export const useLayoutSettings = () => {
  const compactLayoutEnabled = ref(false);

  const updateBodyClass = (): void => {
    if (compactLayoutEnabled.value) {
      document.body.classList.remove("compact-layout");
    } else {
      document.body.classList.add("compact-layout");
    }
  };

  const saveLayoutSetting = (): void => {
    localStorage.setItem(
      "compactLayoutEnabled",
      compactLayoutEnabled.value.toString(),
    );
  };

  const loadLayoutSetting = (): void => {
    const savedLayout = localStorage.getItem("compactLayoutEnabled");
    if (savedLayout !== null) {
      compactLayoutEnabled.value = savedLayout === "true";
    }
    updateBodyClass();
  };

  const toggleLayout = (value: boolean): void => {
    compactLayoutEnabled.value = value;
    updateBodyClass();
    saveLayoutSetting();
  };

  return {
    compactLayoutEnabled,
    updateBodyClass,
    saveLayoutSetting,
    loadLayoutSetting,
    toggleLayout,
  };
};

/**
 * 密钥管理
 */
export const useEncryptionKey = (initialKey: string = "") => {
  const encryptionKey = ref(initialKey);

  const generateKey = (minLength: number = 13, maxLength: number = 13): void => {
    encryptionKey.value = generateRandomKey(minLength, maxLength);
  };

  const validateCurrentKey = (minLength: number = 1, maxLength: number = 100): boolean => {
    return validateKey(encryptionKey.value, minLength, maxLength);
  };

  return {
    encryptionKey,
    generateKey,
    validateCurrentKey,
  };
};

// 预览项类型定义
export interface PreviewItem {
  key: string;
  original: string;
  encrypted: string;
}