---
url: /develop_notes/kci6f5co/index.md
---
## 1. 概述

```bash
mkvpropedit [选项] {源文件名} {操作}
```

## 2. 描述

此程序分析现有的 Matroska™ 文件并修改其某些属性。然后将这些修改写入现有文件。可以更改的属性包括段信息元素（例如标题）和轨道头（例如语言代码、"默认轨道"标志或名称）。

### 选项说明

| 选项 | 描述 |
|------|------|
| `-l, --list-property-names` | 列出所有已知和可编辑的属性名称、其类型（字符串、整数、布尔值等）和简短描述。程序随后退出。因此不必提供源文件名参数 |
| `-p, --parse-mode 模式` | 设置解析模式。参数"模式"可以是"fast"（也是默认值）或"full"。"fast"模式不解析整个文件，而是使用元搜索元素定位源文件的所需元素。在 99% 的情况下，这已经足够。但对于不包含元搜索元素或损坏的文件，用户可能必须设置"full"解析模式。文件的完整扫描可能需要几分钟，而快速扫描只需要几秒钟 |

## 3. 处理轨道和段信息属性的操作

| 选项 | 描述 |
|------|------|
| `-e, --edit 选择器` | 设置所有后续添加、设置和删除操作所操作的 Matroska™ 文件部分（段信息或特定轨道的头）。此选项可以多次使用，以便对多个元素进行修改 |
| `-a, --add 名称=值` | 添加值为值值的属性名称。即使此类属性已存在，也会添加该属性。请注意，大多数属性是唯一的，不能出现多次 |
| `-s, --set 名称=值` | 将属性名称的所有出现设置为值值。如果不存在此类属性，则将添加它 |
| `-d, --delete 名称` | 删除属性名称的所有出现。请注意，某些属性是必需的，不能删除 |

## 4. 处理标签和章节的操作

| 选项 | 描述 |
|------|------|
| `-t, --tags 选择器:文件名` | 用文件名中的标签添加或替换文件中的标签，如果文件名为空则删除它们。mkvpropedit(1) 读取与 mkvmerge(1) 相同的 XML 标签格式 |
| `--add-track-statistics-tags` | 计算文件中所有轨道的统计信息，并为它们添加新的统计标签。如果文件已包含此类标签，则将更新它们 |
| `--delete-track-statistics-tags` | 从文件中删除所有现有的轨道统计标签。如果文件不包含轨道统计标签，则不会修改它 |
| `-c, --chapters 文件名` | 用文件名中的章节添加或替换文件中的章节，如果文件名为空则删除它们。mkvpropedit(1) 读取与 mkvmerge(1) 相同的 XML 和简单章节格式 |

## 5. 处理附件的操作

| 选项 | 描述 |
|------|------|
| `--add-attachment 文件名` | 从文件名添加新附件 |
| `--replace-attachment 选择器:文件名` | 将匹配选择器的一个或多个附件替换为文件文件名 |
| `--update-attachment 选择器` | 设置匹配选择器的一个或多个附件的属性 |
| `--delete-attachment 选择器` | 删除匹配选择器的一个或多个附件 |

### 附件操作选项

| 选项 | 描述 |
|------|------|
| `--attachment-name 名称` | 设置用于以下 --add-attachment 或 --replace-attachment 操作的名称 |
| `--attachment-mime-type mime类型` | 设置用于以下 --add-attachment 或 --replace-attachment 操作的 MIME 类型 |
| `--attachment-description 描述` | 设置用于以下 --add-attachment 或 --replace-attachment 操作的描述 |
| `--enable-legacy-font-mime-types` | 启用对某些类型字体附件使用旧版 MIME 类型 |
| `--disable-language-ietf` | 通常，当用户请求对"language"轨道头属性进行更改时，mkvpropedit(1) 会将相同的更改应用于新的 LanguageIETF 轨道头元素以及旧版 Language 元素 |
| `--normalize-language-ietf 模式` | 启用将所有 IETF BCP 47 语言标签规范化为规范形式、扩展语言子标签形式或关闭 |

## 6. 其他选项

| 选项 | 描述 |
|------|------|
| `--command-line-charset 字符集` | 设置从命令行转换字符串的字符集 |
| `--output-charset 字符集` | 设置要输出字符串的字符集 |
| `-r, --redirect-output 文件名` | 将所有消息写入文件文件名，而不是控制台 |
| `--no-bom` | 禁用写入字节顺序标记（BOM） |
| `--ui-language 代码` | 强制使用语言代码的翻译 |
| `--abort-on-warnings` | 告诉程序在发出第一个警告后中止 |
| `--debug 主题` | 为特定功能启用调试 |
| `--engage 功能` | 启用实验性功能 |
| `--gui-mode` | 启用 GUI 模式 |
| `-v, --verbose` | 详细显示并在读取时显示所有重要的 Matroska™ 元素 |
| `-h, --help` | 显示使用信息并退出 |
| `-V, --version` | 显示版本信息并退出 |
| `@options-file.json` | 从文件 options-file 读取其他命令行参数 |

## 7. 编辑选择器

`--edit` 选项设置所有后续添加、设置和删除操作所操作的 Matroska™ 文件部分（段信息或特定轨道的头）。此选项可以多次使用，以便对多个元素进行修改。

### 7.1. 段信息

段信息可以使用以下三个词之一选择：'info'、'segment\_info' 或 'segmentinfo'。它包含段标题或段 UID 等属性。

### 7.2. 轨道头

轨道头可以使用稍微更复杂的选择器选择。所有变体都以 'track:' 开头。轨道头属性包括语言代码、"默认轨道"标志或轨道名称等元素。

| 选项 | 描述 |
|------|------|
| `track:n` | 如果参数 n 是数字，则选择第 n 个轨道 |
| `track:tn` | 如果参数以单个字符 t 后跟 n 开头，则选择特定轨道类型的第 n 个轨道 |
| `track:=uid` | 如果参数以 '=' 后跟数字 uid 开头，则选择轨道 UID 元素等于给定 uid 的轨道 |
| `track:@number` | 如果参数以 '@' 后跟数字 number 开头，则选择轨道号元素等于此数字的轨道 |

### 7.3. 注意事项

由于轨道编辑选择器的性质，可能多个选择器实际上匹配相同的轨道头。在这种情况下，这些编辑选择器的所有操作将组合并按它们在命令行上给出的顺序执行。

## 8. 附件选择器

附件选择器与两个操作 --replace-attachment 和 --delete-attachment 一起使用。它可以具有以下四种形式之一：

1. **按附件 ID 选择**：在此形式中，选择器只是一个数字，即 mkvmerge(1) 标识命令输出的附件 ID
2. **按附件 UID（唯一 ID）选择**：在此形式中，选择器是等号后跟数字 uid，即 mkvmerge(1) 详细标识命令输出的附件唯一 ID
3. **按附件名称选择**：在此形式中，选择器是字面词 name: 后跟现有附件的名称
4. **按 MIME 类型选择**：在此形式中，选择器是字面词 mime-type: 后跟现有附件的 MIME 类型

## 9. 语言处理

mkvpropedit(1) 默认情况下尝试做正确的事情。因此，对语言属性的更改将导致 mkvpropedit(1) 将相同的更改应用于新的"LanguageIETF"元素以及旧版"Language"元素。
此外，还有一个名为 language-ietf 的新轨道头属性，可以设置或删除。对此属性的更改仅适用于新的"LanguageIETF"轨道头元素。

## 10. 示例

### 基本编辑示例

```bash
# 设置段标题并修改音频和字幕轨道的语言代码
$ mkvpropedit movie.mkv --edit info --set "title=The movie" --edit track:a1 --set language=fre --edit track:a2 --set language=ita
# 从第一个字幕轨道删除"默认轨道"标志并为第二个设置
$ mkvpropedit movie.mkv --edit track:s1 --set flag-default=0 --edit track:s2 --set flag-default=1
```

### 标签操作示例

```bash
# 替换文件中第二个字幕轨道的标签
$ mkvpropedit movie.mkv --tags track:s2:new-subtitle-tags.xml
# 删除所有标签
$ mkvpropedit movie.mkv --tags all:
```

### 章节操作示例

```bash
# 替换文件中的章节
$ mkvpropedit movie.mkv --chapters new-chapters.xml
# 删除所有章节
$ mkvpropedit movie.mkv --chapters ''
```

### 附件操作示例

```bash
# 添加字体文件 (Arial.ttf) 作为附件
$ mkvpropedit movie.mkv --add-attachment Arial.ttf
# 添加字体文件并提供详细信息
$ mkvpropedit movie.mkv --attachment-name Arial.ttf --attachment-description 'The Arial font as a TrueType font' --attachment-mime-type application/x-truetype-font --add-attachment 89719823.ttf
# 替换附件
$ mkvpropedit movie.mkv --attachment-name Arial.ttf --attachment-description 'The Arial font as a TrueType font' --replace-attachment name:Comic.ttf:Arial.ttf
# 删除第二个附件
$ mkvpropedit movie.mkv --delete-attachment 2
# 按 MIME 类型删除所有附加字体
$ mkvpropedit movie.mkv --delete-attachment mime-type:application/x-truetype-font
```

## 11. 退出代码

mkvpropedit(1) 以以下三种退出代码之一退出：
| 退出代码 | 含义 |
|---------|------|
| **0** | 此退出代码表示修改已成功完成 |
| **1** | 在这种情况下，mkvpropedit(1) 已输出至少一个警告，但修改确实继续了。警告以文本 'Warning:' 为前缀 |
| **2** | 发生错误时使用此退出代码。mkvpropedit(1) 在输出错误消息后立即中止 |

## 12. 环境变量

mkvpropedit(1) 使用确定系统区域设置的默认变量（例如 LANG 和 LC\_\* 系列）。

### 附加变量

| 变量 | 描述 |
|------|------|
| `MKVPROPEDIT_DEBUG, MKVTOOLNIX_DEBUG` 及其简短形式 `MTX_DEBUG` | 内容被视为已通过 `--debug` 选项传递 |
| `MKVPROPEDIT_ENGAGE, MKVTOOLNIX_ENGAGE` 及其简短形式 `MTX_ENGAGE` | 内容被视为已通过 `--engage` 选项传递 |

***

*注意：本文档基于 mkvpropedit 的官方手册，已翻译为中文并使用 Markdown 格式进行美化。*
