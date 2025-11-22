---
title: console
createTime: 2025/11/22 19:27:13
permalink: /develop_notes/4ne9gq4c/
---
### console.group()

console.group 可以分组显示输出日志

```
 console.group('=== onCopy Debug ===')
  console.log('1. Initial markdownContent:', markdownContent.value?.length || 0)
  console.log('2. Clipboard API supported:', !!navigator.clipboard)
```
