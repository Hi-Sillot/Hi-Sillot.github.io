import type { Ref } from "vue";
import type {
  EncryptedCedoss,
  EncryptedCedossantItem,
} from "../../vuepress-plugin-sillot-inline/stores/useCedoss";

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
