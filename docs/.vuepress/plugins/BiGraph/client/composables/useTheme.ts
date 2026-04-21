// composables/useTheme.ts - 主题颜色管理

import { ref, onMounted, onUnmounted } from "vue";
import type { ThemeColors } from "../../types/";

/**
 * 主题颜色管理
 */
export function useTheme() {
  const themeColors = ref<ThemeColors>({
    accent: "",
    text: "",
    cssVariableName: { accent: "", text: "" },
  });

  function initThemeColors(): void {
    const root = getComputedStyle(document.documentElement);

    // 获取accent颜色
    if (root.getPropertyValue("--vp-c-accent").trim()) {
      themeColors.value.accent = root.getPropertyValue("--vp-c-accent").trim();
      themeColors.value.cssVariableName.accent = "--vp-c-accent";
    } else if (root.getPropertyValue("--theme-color").trim()) {
      themeColors.value.accent = root.getPropertyValue("--theme-color").trim();
      themeColors.value.cssVariableName.accent = "--theme-color";
    } else {
      themeColors.value.accent = "#299764";
      themeColors.value.cssVariableName.accent = "";
    }

    // 获取text颜色
    if (root.getPropertyValue("--vp-c-text").trim()) {
      themeColors.value.text = root.getPropertyValue("--vp-c-text").trim();
      themeColors.value.cssVariableName.text = "--vp-c-text";
    } else if (root.getPropertyValue("--text-color").trim()) {
      themeColors.value.text = root.getPropertyValue("--text-color").trim();
      themeColors.value.cssVariableName.text = "--text-color";
    } else {
      themeColors.value.text = "#000000";
      themeColors.value.cssVariableName.text = "";
    }
  }

  function setupThemeObserver(callback: () => void): MutationObserver {
    const styleObserver = new MutationObserver(() => {
      const root = getComputedStyle(document.documentElement);
      let shouldUpdate = false;
      
      if (themeColors.value.cssVariableName.accent) {
        const newAccent = root
          .getPropertyValue(themeColors.value.cssVariableName.accent)
          .trim();
        if (newAccent !== themeColors.value.accent) {
          shouldUpdate = true;
        }
      }

      if (themeColors.value.cssVariableName.text) {
        const newText = root
          .getPropertyValue(themeColors.value.cssVariableName.text)
          .trim();
        if (newText !== themeColors.value.text) {
          shouldUpdate = true;
        }
      }

      if (shouldUpdate) {
        initThemeColors();
        callback();
      }
    });

    styleObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["style", "class", "data-theme"],
    });

    return styleObserver;
  }

  onMounted(initThemeColors);

  return {
    themeColors,
    initThemeColors,
    setupThemeObserver,
  };
}