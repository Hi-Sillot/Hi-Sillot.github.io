---
url: /publish/wc1jyjg4/index.md
---
# Bridge 产物测试

本文档用于测试 VuePress → Obsidian Bridge 产物拉取和预览一致性。

## CSS 变量桥接

以下元素用于验证 CSS 变量是否正确桥接：

### 品牌色

### 背景色

### 文本色

### 边框色

## 语法处理器测试

### 基础容器

::: info
这是一个 **info** 容器，用于一般提示信息。
:::

::: tip
这是一个 **tip** 容器，用于有用的小技巧。
:::

::: warning
这是一个 **warning** 容器，用于警告信息。
:::

::: danger
这是一个 **danger** 容器，用于危险操作警告。
:::

::: note
这是一个 **note** 容器，用于备注信息。
:::

::: important 自定义标题
这是一个带**自定义标题**的 important 容器。
:::

::: caution
这是一个 **caution** 容器，用于谨慎操作提示。
:::

### details / collapse

::: details 点击展开
这是 details 容器的隐藏内容，默认折叠。

* 列表项 1
* 列表项 2
  :::

::: collapse 默认展开
这是 collapse 容器，默认展开显示内容。
:::

### tabs 语法

::: tabs
@tab 选项卡 A
选项卡 A 的内容，支持 **Markdown** 格式。
@tab 选项卡 B
选项卡 B 的内容。

@tab:active 默认激活
这个选项卡默认激活（使用 `@tab:active`）。
:::

### code-tabs 语法

::: code-tabs
@tab JavaScript
console.log("Hello from JS");

console.log("Hello from JS");
@tab TypeScript
console.log("Hello from TS");
@tab Python
print("Hello from Python")
:::

### video-tabs 语法

::: video-tabs
@tab B站
视频内容占位
@tab YouTube
视频内容占位
:::

### cedoss 语法

::: cedoss
这是一个 cedoss 容器，包含意码引用：\[\[testid]] 和 \[\[another]]。
:::

::: cedoss
多行内容测试：

第一行引用 \[\[abc]]，第二行引用 \[\[xyz]]。

最后一行没有引用。
:::

## 嵌套容器测试

### 容器内嵌套列表

::: info 嵌套列表测试
容器内支持嵌套列表：

1. 第一项
   * 子项 A
   * 子项 B
2. 第二项
   * 子项 C
     :::

### 容器内嵌套代码块

::: tip 代码块测试
容器内支持代码块：

```javascript
const greeting = "Hello, Sillot!";
console.log(greeting);
```

:::

### details 内嵌套容器

::: details 嵌套容器
展开后可以看到嵌套的 info 容器：

:::: info
这是 details 内嵌套的 info 容器。
::::
:::

### tabs 内嵌套内容

::: tabs
@tab 富文本
支持 **加粗**、*斜体*、`代码` 等格式。

* 列表项 1
* 列表项 2

@tab 链接测试
[Obsidian 官网](https://obsidian.md)

[VuePress 官网](https://vuepress.vuejs.org/)
:::

## 残缺语法测试

### 缺少闭合标记

::: warning 缺少闭合
这个容器没有闭合标记，应该显示警告提示。
:::

### 空容器

::: info 空容器
:::

### 无效容器类型

::: unknown-type 自定义类型
这是一个未知类型的容器，应渲染为通用容器。
:::

### 空开标记

:::
没有指定容器类型
:::

## 路径映射验证

Bridge 产物中的 `path-map.json` 应包含以下路径：

| 预期路径 | 说明 |
|---|---|
| `/sillot_guides/` | 指南目录 |
| `/blog/` | 博客目录 |
| `/col_doc/1_developNotes/` | 开发笔记目录 |
| `/col_doc/2_releaseNotes/` | 发布笔记目录 |

## Bridge 版本检查

当前 Bridge 版本应与站点构建时间一致，可通过插件 DevPanel 查看。。
