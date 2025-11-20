// handler/site-settings.ts

import { readonly, type Ref, ref } from "vue";
import type {
  CedossantItem,
  CedossMap,
  EncryptableField,
  EncryptedCedoss,
  EncryptedCedossantItem,
} from "../../vuepress-plugin-sillot-cedoss/stores/useCedoss";

/**
 * 严格的加密意码数据验证（适配新格式）
 */
export const isValidEncryptedCedoss = (data: any): data is EncryptedCedoss => {
  if (!data || typeof data !== "object") return false;

  for (const key in data) {
    const item = data[key];

    // 每个项必须符合新的 EncryptedCedossantItem 接口
    if (!item || typeof item !== "object") return false;
    if (item.encrypted !== true) return false;

    // 新格式验证：必须包含 encryptedData 对象
    if (!item.encryptedData || typeof item.encryptedData !== "object") {
      return false;
    }

    // 必须包含加密字段列表
    if (!Array.isArray(item.encryptedFields)) return false;

    // 必需的基础字段
    if (typeof item.code !== "string") return false;
    if (!["原码组", "转码组", "引码组"].includes(item.group)) return false;
    if (typeof item.prefixUsage !== "boolean") return false;
    if (typeof item.standaloneUsage !== "boolean") return false;
    if (typeof item.suffixUsage !== "boolean") return false;

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

// 类型守卫函数，检查是否为加密数据项（适配新格式）
export const isEncryptedCedossantItem = (
  value: any,
): value is EncryptedCedossantItem => {
  return value &&
    typeof value === "object" &&
    value.encrypted === true &&
    value.encryptedData &&
    Array.isArray(value.encryptedFields);
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

  const validChars = /^[A-Za-z0-9!@#$%^&*]+$/;
  return validChars.test(key);
};

/**
 * 创建默认的意码项（适配新格式）
 */
export const createDefaultCedossantItem = (
  code: string,
  standardCode: string,
): CedossantItem => {
  const timestamp = new Date().toISOString();
  return {
    standardCode,
    code,
    group: "原码组",
    liaisonSpelling: code.toLowerCase().replace(/[^a-z]/g, ""),
    pinyin: "",
    prefixUsage: false,
    standaloneUsage: true,
    suffixUsage: false,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
};

/**
 * 加密单个字段的值
 */
export const encryptFieldValue = (
  value: string | undefined,
  key: string,
): string | undefined => {
  if (!value) return undefined;
  return simpleXorCrypt(value, key);
};

/**
 * 解密单个字段的值
 */
export const decryptFieldValue = (
  value: string | undefined,
  key: string,
): string | undefined => {
  if (!value) return undefined;
  return simpleXorCrypt(value, key);
};

/**
 * 加密意码项为新的字段级加密格式
 */
export const encryptCedossantItem = (
  item: CedossantItem,
  encryptionKey: string,
): EncryptedCedossantItem => {
  const encryptedData: EncryptedCedossantItem["encryptedData"] = {};
  const encryptedFields: EncryptableField[] = [];

  // 需要加密的字段列表
  const encryptableFields: EncryptableField[] = [
    "standardCode",
    "ancientStandardCode",
    "simplifiedStandardCode",
    "affix",
    "relatedWords",
    "liaisonSpelling",
    "pinyin",
    "chineseMeaning",
    "tableAttribute",
  ];

  // 加密需要加密的字段
  encryptableFields.forEach((field) => {
    const value = (item as any)[field];
    if (value !== undefined && value !== null && value !== "") {
      const encryptedValue = encryptFieldValue(String(value), encryptionKey);
      if (encryptedValue) {
        encryptedData[field] = encryptedValue;
        encryptedFields.push(field);
      }
    }
  });

  // 构建加密后的意码项
  return {
    // 不加密的字段直接复制
    code: item.code,
    group: item.group,
    prefixUsage: item.prefixUsage,
    standaloneUsage: item.standaloneUsage,
    suffixUsage: item.suffixUsage,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,

    // 可选的不加密字段
    symbolicCode: item.symbolicCode,
    ancientCode: item.ancientCode,
    simplifiedCode: item.simplifiedCode,
    simplifiedAncientCode: item.simplifiedAncientCode,
    description: item.description,

    // 加密的数据
    encryptedData,

    // 加密元数据
    encrypted: true,
    algorithm: "xor",
    version: "2.0",
    encryptedFields,
  };
};

/**
 * 解密密意码项（新格式）
 */
export const decryptCedossantItem = (
  encryptedItem: EncryptedCedossantItem,
  decryptionKey: string,
): CedossantItem => {
  const decryptedItem: CedossantItem = {
    // 复制不加密的字段
    code: encryptedItem.code,
    group: encryptedItem.group,
    prefixUsage: encryptedItem.prefixUsage,
    standaloneUsage: encryptedItem.standaloneUsage,
    suffixUsage: encryptedItem.suffixUsage,
    createdAt: encryptedItem.createdAt,
    updatedAt: encryptedItem.updatedAt,

    // 可选的不加密字段
    symbolicCode: encryptedItem.symbolicCode,
    ancientCode: encryptedItem.ancientCode,
    simplifiedCode: encryptedItem.simplifiedCode,
    simplifiedAncientCode: encryptedItem.simplifiedAncientCode,
    description: encryptedItem.description,

    // 初始化需要加密的字段
    standardCode: "",
    liaisonSpelling: "",
    pinyin: "",
  };

  // 解密加密的字段
  encryptedItem.encryptedFields.forEach((field) => {
    const encryptedValue = encryptedItem.encryptedData[field];
    if (encryptedValue) {
      try {
        const decryptedValue = decryptFieldValue(encryptedValue, decryptionKey);
        if (decryptedValue) {
          (decryptedItem as any)[field] = decryptedValue;
        }
      } catch (error) {
        console.warn(`解密字段 ${field} 失败:`, error);
        throw new Error(`字段 ${field} 解密失败`);
      }
    }
  });

  return decryptedItem;
};

/**
 * 加密映射数据的核心逻辑（适配新格式）
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
  const previewItems: Array<
    { key: string; original: string; encrypted: string }
  > = [];

  for (const [key, value] of Object.entries(mappingData)) {
    if (typeof value === "string") {
      // 创建完整的意码项
      const cedossantItem = createDefaultCedossantItem(key, value);

      // 使用新格式加密
      const encryptedItem = encryptCedossantItem(cedossantItem, encryptionKey);
      encryptedData[key] = encryptedItem;

      // 创建预览项（只显示标码的加密）
      const encryptedStandardCode = encryptedItem.encryptedData.standardCode ||
        "";
      previewItems.push({
        key,
        original: value.length > previewLength
          ? value.substring(0, previewLength) + "..."
          : value,
        encrypted: encryptedStandardCode.length > previewLength
          ? encryptedStandardCode.substring(0, previewLength) + "..."
          : encryptedStandardCode,
      });
    }
  }

  return { encryptedData, previewItems };
};

/**
 * 下载加密文件的通用逻辑
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
 * 处理文件上传的通用逻辑（适配新格式）
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

      // 验证数据格式
      if (typeof fileData !== "object" || fileData === null) {
        throw new Error("文件格式错误：必须是JSON对象");
      }

      // 检查是否是旧格式（简单键值对）
      const firstValue = Object.values(fileData)[0];
      const isLegacyFormat = typeof firstValue === "string";

      let cedossMap: CedossMap = {};

      if (isLegacyFormat) {
        // 旧格式：直接使用
        cedossMap = fileData;
      } else {
        // 新格式：提取标码字段
        cedossMap = {};
        Object.keys(fileData).forEach((key) => {
          const item = fileData[key];
          if (item && typeof item === "object" && item.standardCode) {
            cedossMap[key] = item.standardCode;
          }
        });
      }

      const { encryptedData, previewItems } = encryptMappingData(
        cedossMap,
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
 * 验证解密后的值是否有效
 */
export const isValidDecryptedValue = (value: string): boolean => {
  if (!value || typeof value !== "string") return false;

  if (/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(value.replace(/[\n\t]/g, ""))) {
    return false;
  }

  if (value.includes("�") || value.includes("��")) {
    return false;
  }

  if (value.length > 10000) {
    return false;
  }

  return true;
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
      document.body.classList.add("compact-layout");
    } else {
      document.body.classList.remove("compact-layout");
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
    compactLayoutEnabled: readonly(compactLayoutEnabled),
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

  const generateKey = (
    minLength: number = 13,
    maxLength: number = 13,
  ): void => {
    encryptionKey.value = generateRandomKey(minLength, maxLength);
  };

  const validateCurrentKey = (
    minLength: number = 1,
    maxLength: number = 100,
  ): boolean => {
    return validateKey(encryptionKey.value, minLength, maxLength);
  };

  return {
    encryptionKey: encryptionKey,
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

/**
 * 获取加密字段统计信息
 */
export const getEncryptionStats = (encryptedData: EncryptedCedoss) => {
  let totalFields = 0;
  let encryptedFields = 0;

  Object.values(encryptedData).forEach((item) => {
    totalFields += 9; // 固定的9个可加密字段
    encryptedFields += item.encryptedFields.length;
  });

  return {
    totalFields,
    encryptedFields,
    encryptionRatio: totalFields > 0 ? encryptedFields / totalFields : 0,
  };
};

/**
 * 验证意码项格式
 */
export const validateCedossantItem = (item: any): item is CedossantItem => {
  if (!item || typeof item !== "object") return false;

  // 必需字段验证
  if (typeof item.standardCode !== "string" || !item.standardCode) return false;
  if (typeof item.code !== "string" || !item.code) return false;
  if (!["原码组", "转码组", "引码组"].includes(item.group)) return false;
  if (typeof item.liaisonSpelling !== "string") return false;
  if (typeof item.pinyin !== "string") return false;
  if (typeof item.prefixUsage !== "boolean") return false;
  if (typeof item.standaloneUsage !== "boolean") return false;
  if (typeof item.suffixUsage !== "boolean") return false;

  // 验证联拼格式
  if (!/^[a-z]*$/.test(item.liaisonSpelling)) return false;

  return true;
};

// 导出类型
export type { EncryptableField };
