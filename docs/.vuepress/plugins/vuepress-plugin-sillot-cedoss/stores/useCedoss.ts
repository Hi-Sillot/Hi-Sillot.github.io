// stores/useCedoss.ts
import { defineStore } from "pinia";

// 组别类型定义
export type CedossGroup = "原码组" | "转码组" | "引码组";

// 需要加密的字段类型
export type EncryptableField =
  | "standardCode" // 标码
  | "ancientStandardCode" // 古标码
  | "simplifiedStandardCode" // 简标码
  | "affix" // 缀
  | "relatedWords" // 关联词
  | "liaisonSpelling" // 联拼
  | "pinyin" // 拼音
  | "chineseMeaning" // 汉意
  | "tableAttribute"; // 表属

// 完整的意码项接口
export interface CedossantItem {
  // 基础字段
  standardCode: string; // 标码（需要加密）
  code: string; // 编码（不加密，作为ID）

  // 扩展字段
  symbolicCode?: string; // 彖码（不加密）
  ancientStandardCode?: string; // 古标码（需要加密）
  ancientCode?: string; // 古编码（不加密）
  simplifiedStandardCode?: string; // 简标码（需要加密）
  simplifiedCode?: string; // 简编码（不加密）
  simplifiedAncientCode?: string; // 简古编码（不加密）
  affix?: string; // 缀（需要加密）
  relatedWords?: string; // 关联词（需要加密）
  group: CedossGroup; // 组别（不加密）
  liaisonSpelling: string; // 联拼（需要加密）
  pinyin: string; // 拼音（需要加密）
  chineseMeaning?: string; // 汉意（需要加密）
  prefixUsage: boolean; // 前缀使用（不加密）
  standaloneUsage: boolean; // 单列使用（不加密）
  suffixUsage: boolean; // 后缀使用（不加密）
  tableAttribute?: string; // 表属（需要加密）

  // 元数据字段
  createdAt?: string; // 创建时间（不加密）
  updatedAt?: string; // 更新时间（不加密）
  description?: string; // 描述信息（不加密）
}

// 意码映射接口（向后兼容）
export type CedossMap = {
  [key: string]: string;
};

// 加密数据项接口（新格式，字段级加密）
export interface EncryptedCedossantItem {
  // 基础不加密字段
  code: string;
  group: CedossGroup;
  prefixUsage: boolean;
  standaloneUsage: boolean;
  suffixUsage: boolean;
  createdAt?: string;
  updatedAt?: string;

  // 可选的不加密字段
  symbolicCode?: string;
  ancientCode?: string;
  simplifiedCode?: string;
  simplifiedAncientCode?: string;
  description?: string;

  // 加密字段（存储加密后的值）
  encryptedData: {
    standardCode?: string; // 加密的标码
    ancientStandardCode?: string; // 加密的古标码
    simplifiedStandardCode?: string; // 加密的简标码
    affix?: string; // 加密的缀
    relatedWords?: string; // 加密的关联词
    liaisonSpelling?: string; // 加密的联拼
    pinyin?: string; // 加密的拼音
    chineseMeaning?: string; // 加密的汉意
    tableAttribute?: string; // 加密的表属
  };

  // 加密元数据
  encrypted: true;
  algorithm: string;
  version: string;
  encryptedFields: EncryptableField[]; // 记录哪些字段被加密了
}

// 加密数据接口
export interface EncryptedCedoss {
  [key: string]: EncryptedCedossantItem;
}

// Store 状态接口
interface CedossState {
  encryptedCedoss: EncryptedCedoss;
  decryptionKey: string;
  decryptErrors: Set<string>;
  plainCedossants: { [key: string]: CedossantItem };
}

// 改进的异或加密/解密函数
function simpleXorCrypt(str: string, key: string): string {
  if (!key || !str) return str;

  try {
    let result = "";
    for (let i = 0; i < str.length; i++) {
      const keyChar = key.charCodeAt(i % key.length);
      const strChar = str.charCodeAt(i);
      result += String.fromCharCode(strChar ^ keyChar);
    }

    // 验证解密结果是否为有效文本
    if (result.includes("�") || /[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(result)) {
      throw new Error("解密结果包含无效字符");
    }

    return result;
  } catch (error) {
    console.warn("解密失败:", error);
    throw error;
  }
}

// 需要加密的字段列表
const ENCRYPTABLE_FIELDS: EncryptableField[] = [
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

// 验证联拼格式（只能是小写英文字符）
function validateLiaisonSpelling(spelling: string): boolean {
  return /^[a-z]*$/.test(spelling);
}

// 验证组别格式
function validateGroup(group: string): group is CedossGroup {
  return group === "原码组" || group === "转码组" || group === "引码组";
}

// 默认的意码项创建函数
function createDefaultCedossantItem(
  code: string,
  standardCode: string,
): CedossantItem {
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
}

// 加密单个字段的值
function encryptFieldValue(
  value: string | undefined,
  key: string,
): string | undefined {
  if (!value) return undefined;
  return simpleXorCrypt(value, key);
}

// 解密单个字段的值
function decryptFieldValue(
  value: string | undefined,
  key: string,
): string | undefined {
  if (!value) return undefined;
  return simpleXorCrypt(value, key);
}

// 加密意码项的指定字段
function encryptCedossantItem(
  item: CedossantItem,
  encryptionKey: string,
): EncryptedCedossantItem {
  const encryptedData: EncryptedCedossantItem["encryptedData"] = {};
  const encryptedFields: EncryptableField[] = [];

  // 加密需要加密的字段
  ENCRYPTABLE_FIELDS.forEach((field) => {
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
  const encryptedItem: EncryptedCedossantItem = {
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

  return encryptedItem;
}

// 解密密意码项
function decryptCedossantItem(
  encryptedItem: EncryptedCedossantItem,
  decryptionKey: string,
): CedossantItem {
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
}

export const useCedossStore = defineStore("constants", {
  state: (): CedossState => ({
    encryptedCedoss: {},
    decryptionKey: "",
    decryptErrors: new Set(),
    plainCedossants: {},
  }),

  hydrate(state) {
    if (typeof window !== "undefined") {
      try {
        // 从 localStorage 加载加密意码
        const storedCedoss = localStorage.getItem("encryptedCedoss");
        if (storedCedoss) {
          state.encryptedCedoss = JSON.parse(storedCedoss);
        }

        // 从 sessionStorage 加载解密密钥
        const storedKey = sessionStorage.getItem("cedossDecryptionKey");
        if (storedKey) {
          state.decryptionKey = storedKey;
        }

        // 初始化普通意码的完整数据
        state.plainCedossants = initializePlainCedossants();
      } catch (error) {
        console.warn("从存储初始化失败:", error);
      }
    }
  },

  getters: {
    /**
     * 普通意码映射（向后兼容）
     */
    plainCedoss(): CedossMap {
      const result: CedossMap = {};
      Object.keys(this.plainCedossants).forEach((key) => {
        result[key] = this.plainCedossants[key].standardCode;
      });
      return result;
    },

    /**
     * 获取完整的普通意码项映射
     */
    fullPlainCedossants(): { [key: string]: CedossantItem } {
      return this.plainCedossants;
    },

    /**
     * 获取合并后的意码映射（包含普通意码和解密后的加密意码）
     */
    mergedCedoss(state): CedossMap {
      state.decryptErrors.clear();
      const result: CedossMap = { ...this.plainCedoss };

      if (!state.decryptionKey) {
        return result;
      }

      Object.keys(state.encryptedCedoss).forEach((key) => {
        const encryptedItem = state.encryptedCedoss[key];

        try {
          // 处理新格式（字段级加密）
          const decryptedItem = decryptCedossantItem(
            encryptedItem,
            state.decryptionKey,
          );
          if (this.validateCedossantItem(decryptedItem)) {
            result[key] = decryptedItem.standardCode;
          } else {
            throw new Error("解密后的意码项验证失败");
          }
        } catch (error) {
          console.warn(`解密意码失败 ${key}:`, error);
          state.decryptErrors.add(key);
          result[key] = `DECRYPT_FAILED:${key}`;
        }
      });

      return result;
    },

    /**
     * 获取完整的意码项映射（包含所有字段）
     */
    fullMergedCedossants(state): { [key: string]: CedossantItem } {
      const result: { [key: string]: CedossantItem } = {
        ...this.plainCedossants,
      };

      if (!state.decryptionKey) {
        return result;
      }

      Object.keys(state.encryptedCedoss).forEach((key) => {
        if (state.decryptErrors.has(key)) return;

        const encryptedItem = state.encryptedCedoss[key];

        try {
          const decryptedItem = decryptCedossantItem(
            encryptedItem,
            state.decryptionKey,
          );
          if (!this.validateCedossantItem(decryptedItem)) {
            throw new Error("意码项验证失败");
          }

          result[key] = decryptedItem;
        } catch (error) {
          console.warn(`获取完整意码项失败 ${key}:`, error);
          state.decryptErrors.add(key);
        }
      });

      return result;
    },

    /**
     * 验证解密后的值是否有效
     */
    isValidDecryptedValue(): (value: string) => boolean {
      return (value: string) => {
        if (!value || typeof value !== "string") return false;

        if (
          /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(value.replace(/[\n\t]/g, ""))
        ) {
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
    },

    /**
     * 验证意码项格式
     */
    validateCedossantItem(): (item: any) => item is CedossantItem {
      return (item: any): item is CedossantItem => {
        if (!item || typeof item !== "object") return false;

        // 必需字段验证
        if (typeof item.standardCode !== "string" || !item.standardCode) {
          return false;
        }
        if (typeof item.code !== "string" || !item.code) return false;
        if (!validateGroup(item.group)) return false;
        if (typeof item.liaisonSpelling !== "string") return false;
        if (typeof item.pinyin !== "string") return false;
        if (typeof item.prefixUsage !== "boolean") return false;
        if (typeof item.standaloneUsage !== "boolean") return false;
        if (typeof item.suffixUsage !== "boolean") return false;

        // 验证联拼格式
        if (!validateLiaisonSpelling(item.liaisonSpelling)) return false;

        return true;
      };
    },

    /**
     * 获取意码值（兼容旧接口）
     */
    constValue(): (id: string) => string | undefined {
      return (id: string) => {
        const allCedoss = this.mergedCedoss;

        if (!Object.prototype.hasOwnProperty.call(allCedoss, id)) {
          return undefined;
        }

        if (this.decryptErrors.has(id)) {
          return `DECRYPT_FAILED:${id}`;
        }

        return allCedoss[id];
      };
    },

    /**
     * 获取完整的意码项
     */
    cedossantItem(): (id: string) => CedossantItem | undefined {
      return (id: string) => {
        const fullItems = this.fullMergedCedossants;
        return fullItems[id];
      };
    },

    /**
     * 检查意码ID是否存在且可正常访问
     */
    hasCedossant(): (id: string) => boolean {
      return (id: string) => {
        const allCedoss = this.mergedCedoss;

        const exists = Object.prototype.hasOwnProperty.call(allCedoss, id);
        if (!exists) return false;

        if (this.decryptErrors.has(id)) {
          return false;
        }

        return true;
      };
    },

    /**
     * 检查意码是否加密
     */
    isEncrypted(): (id: string) => boolean {
      return (id: string) => {
        return Object.prototype.hasOwnProperty.call(this.encryptedCedoss, id);
      };
    },

    /**
     * 检查是否有解密错误
     */
    hasDecryptErrors(): boolean {
      return this.decryptErrors.size > 0;
    },

    /**
     * 获取解密错误的意码ID列表
     */
    getDecryptErrors(): string[] {
      return Array.from(this.decryptErrors);
    },

    /**
     * 获取所有意码的统计信息
     */
    cedossStats(): {
      total: number;
      encrypted: number;
      errors: number;
      byGroup: Record<CedossGroup, number>;
    } {
      const fullItems = this.fullMergedCedossants;
      const stats = {
        total: Object.keys(fullItems).length,
        encrypted: Object.keys(this.encryptedCedoss).length,
        errors: this.decryptErrors.size,
        byGroup: { "原码组": 0, "转码组": 0, "引码组": 0 } as Record<
          CedossGroup,
          number
        >,
      };

      Object.values(fullItems).forEach((item) => {
        if (stats.byGroup[item.group] !== undefined) {
          stats.byGroup[item.group]++;
        }
      });

      return stats;
    },

    /**
     * 获取加密字段统计
     */
    encryptionStats(): {
      totalFields: number;
      encryptedFields: number;
      encryptionRatio: number;
    } {
      let totalFields = 0;
      let encryptedFields = 0;

      Object.values(this.encryptedCedoss).forEach((item) => {
        totalFields += ENCRYPTABLE_FIELDS.length;
        encryptedFields += item.encryptedFields.length;
      });

      return {
        totalFields,
        encryptedFields,
        encryptionRatio: totalFields > 0 ? encryptedFields / totalFields : 0,
      };
    },
  },

  actions: {
    /**
     * 设置解密密钥
     */
    setDecryptionKey(key: string): void {
      this.decryptionKey = key;
      this.decryptErrors.clear();

      if (typeof window !== "undefined") {
        try {
          if (key) {
            sessionStorage.setItem("cedossDecryptionKey", key);
          } else {
            sessionStorage.removeItem("cedossDecryptionKey");
          }
        } catch (error) {
          console.warn("保存密钥到 sessionStorage 失败:", error);
        }
      }

      // 可选：将密钥保存到URL参数
      if (typeof window !== "undefined") {
        const url = new URL(window.location.href);
        if (key) {
          url.searchParams.set("key", btoa(encodeURIComponent(key)));
        } else {
          url.searchParams.delete("key");
        }
        window.history.replaceState({}, "", url);
      }
    },

    /**
     * 从存储初始化状态
     */
    initializeFromStorage(): void {
      if (typeof window === "undefined") return;

      try {
        // 加载加密意码
        const storedCedoss = localStorage.getItem("encryptedCedoss");
        if (storedCedoss) {
          this.encryptedCedoss = JSON.parse(storedCedoss);
        }

        // 初始化普通意码
        this.plainCedossants = initializePlainCedossants();

        // 从 URL 参数加载密钥（优先）
        this.loadKeyFromURL();

        // 如果 URL 中没有密钥，尝试从 sessionStorage 加载
        if (!this.decryptionKey) {
          const storedKey = sessionStorage.getItem("cedossDecryptionKey");
          if (storedKey) {
            this.decryptionKey = storedKey;
          }
        }
      } catch (error) {
        console.warn("从存储初始化失败:", error);
      }
    },

    /**
     * 清除会话数据
     */
    clearSessionData(): void {
      if (typeof window !== "undefined") {
        sessionStorage.removeItem("cedossDecryptionKey");
      }
      this.decryptionKey = "";
      this.decryptErrors.clear();
    },

    /**
     * 安全清除所有数据
     */
    clearAllData(): void {
      this.clearSessionData();
      this.encryptedCedoss = {};
      this.plainCedossants = {};

      if (typeof window !== "undefined") {
        localStorage.removeItem("encryptedCedoss");
      }
    },

    /**
     * 从URL参数加载密钥
     */
    loadKeyFromURL(): void {
      if (typeof window === "undefined") return;

      const urlParams = new URLSearchParams(window.location.search);
      const keyFromUrl = urlParams.get("key");
      if (keyFromUrl) {
        try {
          this.decryptionKey = decodeURIComponent(atob(keyFromUrl));
        } catch (error) {
          console.warn("URL中的密钥格式错误");
        }
      }
    },

    /**
     * 验证密钥是否正确
     */
    validateKey(): boolean {
      return !this.hasDecryptErrors;
    },

    /**
     * 加载加密意码数据
     */
    loadEncryptedCedoss(data: EncryptedCedoss): void {
      this.encryptedCedoss = data;
      this.decryptErrors.clear();

      if (typeof window !== "undefined") {
        localStorage.setItem("encryptedCedoss", JSON.stringify(data));
      }
    },

    /**
     * 从localStorage加载加密意码
     */
    loadFromLocalStorage(): void {
      if (typeof window === "undefined") return;

      try {
        const stored = localStorage.getItem("encryptedCedoss");
        if (stored) {
          this.encryptedCedoss = JSON.parse(stored);
          this.decryptErrors.clear();
        }
      } catch (error) {
        console.warn("从localStorage加载加密意码失败:", error);
      }
    },

    /**
     * 加密并添加意码项（使用字段级加密）
     */
    encryptAndAddCedossant(item: CedossantItem, encryptionKey: string): void {
      if (!encryptionKey) {
        throw new Error("加密密钥不能为空");
      }

      // 验证意码项格式
      if (!this.validateCedossantItem(item)) {
        throw new Error("意码项格式不正确");
      }

      // 更新更新时间
      item.updatedAt = new Date().toISOString();

      // 使用字段级加密
      const encryptedItem = encryptCedossantItem(item, encryptionKey);
      this.encryptedCedoss[item.code] = encryptedItem;

      if (typeof window !== "undefined") {
        localStorage.setItem(
          "encryptedCedoss",
          JSON.stringify(this.encryptedCedoss),
        );
      }
    },

    /**
     * 添加强意码项（不加密）
     */
    addPlainCedossant(item: CedossantItem): void {
      if (!this.validateCedossantItem(item)) {
        throw new Error("意码项格式不正确");
      }

      // 更新更新时间
      item.updatedAt = new Date().toISOString();
      if (!item.createdAt) {
        item.createdAt = item.updatedAt;
      }

      this.plainCedossants[item.code] = item;
    },

    /**
     * 更新意码项
     */
    updateCedossant(item: CedossantItem, encryptionKey?: string): void {
      if (!this.validateCedossantItem(item)) {
        throw new Error("意码项格式不正确");
      }

      item.updatedAt = new Date().toISOString();

      if (encryptionKey && this.isEncrypted(item.code)) {
        // 更新加密的意码项
        this.encryptAndAddCedossant(item, encryptionKey);
      } else if (this.plainCedossants[item.code]) {
        // 更新普通意码项
        this.plainCedossants[item.code] = item;
      } else {
        throw new Error(`意码项 ${item.code} 不存在`);
      }
    },

    /**
     * 删除意码项
     */
    removeCedossant(code: string): void {
      if (this.encryptedCedoss[code]) {
        delete this.encryptedCedoss[code];
        if (typeof window !== "undefined") {
          localStorage.setItem(
            "encryptedCedoss",
            JSON.stringify(this.encryptedCedoss),
          );
        }
      }

      if (this.plainCedossants[code]) {
        delete this.plainCedossants[code];
      }

      this.decryptErrors.delete(code);
    },

    /**
     * 上传并加载加密意码文件
     */
    async uploadEncryptedFile(file: File): Promise<EncryptedCedoss> {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const data = JSON.parse(
              e.target?.result as string,
            ) as EncryptedCedoss;

            // 验证数据格式
            this.validateEncryptedCedoss(data);
            this.loadEncryptedCedoss(data);
            resolve(data);
          } catch (error) {
            reject(new Error("文件格式错误或验证失败"));
          }
        };
        reader.onerror = () => reject(new Error("文件读取失败"));
        reader.readAsText(file);
      });
    },

    /**
     * 验证加密意码数据格式
     */
    validateEncryptedCedoss(data: any): data is EncryptedCedoss {
      if (typeof data !== "object" || data === null) {
        throw new Error("数据必须是对象");
      }

      for (const key in data) {
        const item = data[key];
        if (!item || typeof item !== "object") {
          throw new Error(`意码 ${key} 格式错误`);
        }

        // 验证新格式
        if (item.encrypted !== true) {
          throw new Error(`意码 ${key} 缺少加密标识`);
        }
        if (!item.encryptedData || typeof item.encryptedData !== "object") {
          throw new Error(`意码 ${key} 的加密数据格式错误`);
        }
        if (!Array.isArray(item.encryptedFields)) {
          throw new Error(`意码 ${key} 的加密字段列表格式错误`);
        }
        if (typeof item.algorithm !== "string") {
          throw new Error(`意码 ${key} 的算法标识必须是字符串`);
        }
      }

      return true;
    },

    /**
     * 清空加密意码数据
     */
    clearEncryptedCedoss(): void {
      this.encryptedCedoss = {};
      if (typeof window !== "undefined") {
        localStorage.removeItem("encryptedCedoss");
      }
    },

    /**
     * 导出加密意码数据
     */
    exportEncryptedCedoss(): string {
      return JSON.stringify(this.encryptedCedoss, null, 2);
    },

    /**
     * 导出所有意码数据（包含完整字段）
     */
    exportAllCedossants(): string {
      const allData = {
        plainCedossants: this.plainCedossants,
        encryptedCedoss: this.encryptedCedoss,
        metadata: {
          exportTime: new Date().toISOString(),
          totalItems: Object.keys(this.fullMergedCedossants).length,
          version: "2.0",
          encryptionStats: this.encryptionStats,
        },
      };
      return JSON.stringify(allData, null, 2);
    },
  },
});

/**
 * 初始化普通意码的完整数据
 */
function initializePlainCedossants(): { [key: string]: CedossantItem } {
  const legacyCedoss: CedossMap = {
    "sillotNoteName_yobeCe": "汐洛绞架",
    "sillotNoteName_doCe": "Sillot-Gibbet",
    "syNoteName_CN": "思源笔记",
    "syNoteName_EN": "siyuan-note",
    "sillot_yobeCe": "汐洛",
    "sillot_doCe": "Sillot",
    "siow_yobeCe": "司华",
    "siow_doCe": "Siow",
    "hellise_yobeCe": "赫礼斯",
    "hellise_doCe": "Hellise",
    "potter_yobeCe": "叵特",
    "potter_doCe": "Potter",
    "sofill_yobeCe": "沁棘",
    "sofill_doCe": "Sofill",
    "sili_yobeCe": "司丽",
    "sili_doCe": "Sili",
    "winsay_yobeCe": "风颂",
    "winsay_doCo": "Winsay",
    "lnco_yobeCe": "兰可",
    "lnco_doCe": "Lnco",
  };

  const result: { [key: string]: CedossantItem } = {};

  Object.keys(legacyCedoss).forEach((key) => {
    result[key] = createDefaultCedossantItem(key, legacyCedoss[key]);
  });

  return result;
}

// 导出类型
export type CedossStore = ReturnType<typeof useCedossStore>;
export type { CedossState };
export { ENCRYPTABLE_FIELDS };
