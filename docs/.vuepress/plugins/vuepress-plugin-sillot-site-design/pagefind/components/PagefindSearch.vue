<template>
  <Base>
  <template #custom-content>
    <div class="pagefind-search">
      <link href="/pagefind/pagefind-ui.css" rel="stylesheet">

      <div id="search"></div>
    </div>
  </template>
  </Base>
</template>

<script lang="ts" setup>
import { onMounted } from 'vue'
import Base from '../../../../layouts/Base.vue'

// 检查字符是否为中文字符
const isChineseChar = (char: string) => {
  const chineseCharRegex = /[\u4e00-\u9fff]/;
  return chineseCharRegex.test(char);
}

// 处理搜索词
const processTerm = (term: string) => {
  // 在中文字符之间添加空格（忽略已有空格）
  // 使用正则表达式匹配中文字符，并在它们之间添加空格
  // 但确保不会在已有空格的位置重复添加
  term = term.replace(/([^\s])([^\s])/g, (match: any, p1: string, p2: string) => {
    // 如果两个字符都是中文，在它们之间添加空格
    if (isChineseChar(p1) && isChineseChar(p2)) {
      return p1 + ' ' + p2;
    }
    return match;
  });

  // 合并多个连续空格为一个
  term = term.replace(/\s+/g, ' ').trim();

  return term;
}

onMounted(() => {
  // 动态加载 Pagefind UI
  const script = document.createElement('script');
  script.src = '/pagefind/pagefind-ui.js';
  script.onload = () => {
    //@ts-ignore
    new window.PagefindUI({
      element: "#search",
      showSubResults: true,
      autofocus: true,
      translations: {
        zero_results: "未找到 [SEARCH_TERM] 的相关结果。我们使用空格分隔了搜索词中的中文，但并不完美，特别是长文本。"
      },
      processTerm: processTerm
    });
  };
  document.head.appendChild(script);
})


</script>

<style scoped>
.pagefind-search {
  max-width: 1300px;
  margin: 0 auto;
  padding: 2rem;
}

/* https://pagefind.app/docs/ui-usage/#customising-the-styles */

/* Pagefind UI 样式变量 */
:global(:root) {
  --pagefind-ui-scale: 1;
  --pagefind-ui-primary: #034ad8;
  --pagefind-ui-text: #393939;
  --pagefind-ui-background: #ffffff95;
  --pagefind-ui-border: #eeeeeec7;
  --pagefind-ui-tag: #eeeeeed3;
  --pagefind-ui-border-width: 2px;
  --pagefind-ui-border-radius: 8px;
  --pagefind-ui-image-border-radius: 8px;
  --pagefind-ui-image-box-ratio: 3 / 2;
  --pagefind-ui-font: sans-serif;
}

/* 适配 data-theme="dark" 的暗黑主题 */
:global(html[data-theme="dark"]:root) {
  --pagefind-ui-primary: #eeeeee;
  --pagefind-ui-text: #eeeeee;
  --pagefind-ui-background: #3537436b !important;
  --pagefind-ui-border: #282715;
  --pagefind-ui-tag: #282415;
}
</style>
