import { useDebounceFn, useMediaQuery } from "@vueuse/core";
import { computed, ref, watch } from "vue";
import { useRouter } from "vuepress/client";

export function useDeviceDetection() {
  const isMobile = useMediaQuery("(max-width: 768px)");
  const deviceType = ref(isMobile.value ? "mobile" : "desktop");
  const componentKey = ref(0);
  const router = useRouter();
  // 防抖切换，避免频繁重渲染
  const updateDevice = useDebounceFn(() => {
    const newType = isMobile.value ? "mobile" : "desktop";

    if (deviceType.value !== newType) {
      deviceType.value = newType;
      componentKey.value++;
      router.go(0); // 刷新当前路由
    }
  }, 150);

   // 只在客户端监听变化
  if (typeof window !== 'undefined') {
    watch(isMobile, updateDevice, { immediate: true })
  }

  return {
    isMobile: computed(() => isMobile.value),
    // deviceType: computed(() => deviceType.value),
    componentKey: computed(() => `${isMobile.value ? "mobile" : "desktop"}-${componentKey.value}`),
  };
}
