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
