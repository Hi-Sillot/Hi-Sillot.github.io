// stores/useCedoss.ts
import { defineStore } from "pinia";

// 意码配置接口
export interface CedossConfig {
  value: string;
  encrypt?: boolean;
}

// 意码映射接口
export interface CedossMap {
  [key: string]: string | CedossConfig;
}

// 加密数据项接口
export interface EncryptedCedossantItem {
  value: string;
  encrypted: true; // 明确标识这是加密内容
  algorithm?: string; // 可选：加密算法标识
}

// 加密数据接口
export interface EncryptedCedoss {
  [key: string]: EncryptedCedossantItem;
}

// Store 状态接口
interface CedossState {
  encryptedCedoss: EncryptedCedoss;
  decryptionKey: string;
  decryptErrors: Set<string>; // 记录解密错误的意码ID
}

// 改进的异或加密/解密函数
function simpleXorCrypt(str: string, key: string): string {
  if (!key || !str) return str;

  try {
    // 检查是否是base64编码的字符串（加密数据通常会被编码）
    let decodedStr = str;
    if (
      !str.includes("�") && /^[A-Za-z0-9+/=]*$/.test(str) &&
      str.length % 4 === 0
    ) {
      try {
        decodedStr = atob(str);
      } catch (e) {
        // 如果不是base64，使用原字符串
      }
    }

    let result = "";
    for (let i = 0; i < decodedStr.length; i++) {
      const keyChar = key.charCodeAt(i % key.length);
      const strChar = decodedStr.charCodeAt(i);
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

export const useCedossStore = defineStore("constants", {
  state: (): CedossState => ({
    encryptedCedoss: {},
    decryptionKey: "",
    decryptErrors: new Set(), // 记录解密失败的意码ID
  }),

  // 添加 hydrate 选项来自动从 sessionStorage 恢复状态
  hydrate(state) {
    if (typeof window !== "undefined") {
      // 从 localStorage 加载加密意码（数据可以持久化）
      try {
        const storedCedoss = localStorage.getItem("encryptedCedoss");
        if (storedCedoss) {
          state.encryptedCedoss = JSON.parse(storedCedoss);
        }
      } catch (error) {
        console.warn("从 localStorage 加载加密意码失败:", error);
      }

      // 从 sessionStorage 加载解密密钥（会话级存储）
      try {
        const storedKey = sessionStorage.getItem("cedossDecryptionKey");
        if (storedKey) {
          state.decryptionKey = storedKey;
        }
      } catch (error) {
        console.warn("从 sessionStorage 加载解密密钥失败:", error);
      }
    }
  },

  getters: {
    /**
     * 普通意码映射
     */
    plainCedoss(): CedossMap {
      return {
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
    },

    /**
     * 获取合并后的意码映射（包含普通意码和解密后的加密意码）
     */
    mergedCedoss(state): CedossMap {
      state.decryptErrors.clear();
      if (!state.decryptionKey) {
        return this.plainCedoss;
      }

      const decryptedCedoss: CedossMap = {};
      Object.keys(state.encryptedCedoss).forEach((key) => {
        const encryptedItem = state.encryptedCedoss[key];

        // 只有明确标记为加密的内容才进行解密
        if (encryptedItem.encrypted) {
          try {
            const decryptedValue = simpleXorCrypt(
              encryptedItem.value,
              state.decryptionKey,
            );

            if (this.isValidDecryptedValue(decryptedValue)) {
              decryptedCedoss[key] = decryptedValue;
            } else {
              console.warn(`解密结果无效: ${key}`);
              state.decryptErrors.add(key);
            }
          } catch (error) {
            console.warn(`解密意码失败 ${key}:`, error);
            state.decryptErrors.add(key);
          }
        } else {
          // 如果不是加密内容，直接使用原始值
          decryptedCedoss[key] = encryptedItem.value;
        }
      });

      return { ...this.plainCedoss, ...decryptedCedoss };
    },

    /**
     * 验证解密后的值是否有效
     */
    isValidDecryptedValue(): (value: string) => boolean {
      return (value: string) => {
        if (!value || typeof value !== "string") return false;

        // 检查是否包含控制字符（除换行符和制表符外）
        if (
          /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(value.replace(/[\n\t]/g, ""))
        ) {
          return false;
        }

        // 检查是否是明显的乱码
        if (value.includes("�") || value.includes("��")) {
          return false;
        }

        // 检查长度是否合理（加密文本解密后不应过长）
        if (value.length > 1000) {
          return false;
        }

        return true;
      };
    },

    /**
     * 获取意码值
     */
    constValue: (state) => (id: string) => {
      const store = useCedossStore();
      const allCedoss = store.mergedCedoss;

      if (!Object.prototype.hasOwnProperty.call(allCedoss, id)) {
        return undefined;
      }

      // 检查是否是解密失败的意码
      if (state.decryptErrors.has(id)) {
        return `DECRYPT_FAILED:${id}`;
      }

      const value = allCedoss[id];
      return typeof value === "string" ? value : value.value;
    },

    /**
     * 检查意码ID是否存在且可正常访问
     */
    hasCedossant: (state) => (id: string): boolean => {
      const store = useCedossStore();
      const allCedoss = store.mergedCedoss;

      const exists = Object.prototype.hasOwnProperty.call(allCedoss, id);
      if (!exists) return false;

      // 如果存在但解密失败，返回false
      if (state.decryptErrors.has(id)) {
        return false;
      }

      return true;
    },

    /**
     * 检查意码是否加密
     */
    isEncrypted: (state) => (id: string): boolean => {
      const store = useCedossStore();

      // 检查加密意码中的加密标记
      const encryptedItem = state.encryptedCedoss[id];
      if (encryptedItem && encryptedItem.encrypted) {
        return true;
      }

      // 检查普通意码的配置
      const plainCedoss = store.plainCedoss[id];
      if (
        plainCedoss && typeof plainCedoss === "object" && plainCedoss.encrypt
      ) {
        return true;
      }

      return false;
    },

    /**
     * 检查是否有解密错误
     */
    hasDecryptErrors: (state) => {
      return state.decryptErrors.size > 0;
    },

    /**
     * 获取解密错误的意码ID列表
     */
    getDecryptErrors: (state) => {
      return Array.from(state.decryptErrors);
    },
  },

  actions: {
    /**
     * 设置解密密钥
     */
    setDecryptionKey(key: string): void {
      this.decryptionKey = key;
      // 清空解密错误记录
      this.decryptErrors.clear();

      // 保存到 sessionStorage（会话级存储，标签页关闭后清除）
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
          url.searchParams.set("key", btoa(encodeURIComponent(key))); // 先编码再base64
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
        // 加载加密意码（持久化存储）
        const storedCedoss = localStorage.getItem("encryptedCedoss");
        if (storedCedoss) {
          this.encryptedCedoss = JSON.parse(storedCedoss);
        }

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
     * 清除会话数据（登出时调用）
     */
    clearSessionData(): void {
      if (typeof window !== "undefined") {
        sessionStorage.removeItem("cedossDecryptionKey");
      }
      this.decryptionKey = "";
      this.decryptErrors.clear();
    },

    /**
     * 安全清除所有数据（包括持久化数据）
     */
    clearAllData(): void {
      this.clearSessionData();
      this.encryptedCedoss = {};

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
      // 检查是否有解密错误
      return !this.hasDecryptErrors;
    },

    /**
     * 加载加密意码数据
     * @param {EncryptedCedoss} data 加密意码数据
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
     * 加密并添加意码
     */
    encryptAndAddCedossant(
      key: string,
      value: string,
      encryptionKey: string,
    ): void {
      if (!encryptionKey) {
        throw new Error("加密密钥不能为空");
      }

      const encryptedValue = simpleXorCrypt(value, encryptionKey);

      this.encryptedCedoss[key] = {
        value: encryptedValue,
        encrypted: true,
        algorithm: "xor", // 标识加密算法
      };

      if (typeof window !== "undefined") {
        localStorage.setItem(
          "encryptedCedoss",
          JSON.stringify(this.encryptedCedoss),
        );
      }
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
        if (item.encrypted !== true) {
          throw new Error(`意码 ${key} 缺少加密标识`);
        }
        if (typeof item.value !== "string") {
          throw new Error(`意码 ${key} 的值必须是字符串`);
        }
        // 添加算法字段验证
        if (item.algorithm && typeof item.algorithm !== "string") {
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
  },
});

// 导出类型
export type CedossStore = ReturnType<typeof useCedossStore>;
