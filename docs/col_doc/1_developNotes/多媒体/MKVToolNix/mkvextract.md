---
title: mkvextract
copyright:
  creation: translate
  license: CC-BY-4.0
  source: https://mkvtoolnix.download/doc/mkvextract.html
  author:
    name: mkvtoolnix
    url: https://mkvtoolnix.download/
createTime: 2025/12/20 09:20:48
permalink: /develop_notes/1uzjdw0g/
---

## 1. 概要

```bash
mkvextract {源文件名} {模式1} [选项] [提取规范1] {模式2} [选项] [提取规范2] […]
```

## 2. 描述

此程序用于从 Matroska(tm) 文件中提取特定部分，并将其转换为其他有用的格式。第一个参数是源文件的名称，该文件必须是 Matroska(tm) 文件。
所有其他参数要么是切换到某个特定的提取模式，要么是更改当前活动模式的选项，要么是指定要提取到哪个文件的内容。可以在同一次调用中使用多种模式，允许在单次操作中提取多个内容。大多数选项只能在特定模式下使用，少数选项适用于所有模式。

当前支持提取轨道、标签、附件、章节、CUE 表、时间戳和 Cues。

### 2.1. 通用选项

以下选项在所有模式下均可用，且仅在本节中描述一次。

| 选项 | 描述 |
| :--- | :--- |
| `-f, --parse-fully` | 将解析模式设置为 'full'。默认模式不解析整个文件，而是使用元定位元素来定位源文件中所需的元素。在 99% 的情况下，这已经足够。但对于不包含元定位元素或已损坏的文件，用户可能需要使用此模式。完整扫描文件可能需要几分钟，而快速扫描只需几秒钟。 |
| `--command-line-charset 字符集` | 设置要从命令行给出的字符串进行转换的字符集。默认为系统当前语言环境所指定的字符集。 |
| `--output-charset 字符集` | 设置要输出的字符串所应转换到的字符集。默认为系统当前语言环境所指定的字符集。 |
| `-r, --redirect-output 文件名` | 将所有消息写入文件 `文件名` 而不是控制台。虽然这可以通过输出重定向轻松完成，但在某些情况下需要此选项：当终端在将输出写入文件之前重新解释输出时。通过 `--output-charset` 设置的字符集将得到遵守。 |
| `--no-bom` | 通常，以 UTF 变体创建和编码的文本文件将以字节顺序标记 (BOM) 开头。使用此选项可禁用写入字节顺序标记。 |
| `--flush-on-close` | 告诉程序在关闭为写入而打开的文件时，将缓存中存储的所有数据刷新到存储设备。这可以防止断电时的数据丢失或规避操作系统或驱动程序中的某些问题。缺点是复用需要更长的时间，因为 mkvmerge 将等待所有数据都写入存储后才退出。 |
| `--ui-language 代码` | 强制使用语言代码 `代码` 的翻译（例如，德语翻译使用 'de_DE'）。输入 'list' 作为代码将导致程序输出可用翻译的列表。 |
| `--abort-on-warnings` | 告诉程序在发出第一个警告后中止。程序的退出代码将为 1。 |
| `--debug 主题` | 为特定功能启用调试。此选项仅对开发者有用。 |
| `--engage 功能` | 启用实验性功能。可以使用 `mkvextract --engage list` 请求可用功能的列表。这些功能不适用于正常情况。 |
| `--gui-mode` | 启用 GUI 模式。在此模式下，可以输出特殊格式的行，以告知控制 GUI 正在发生什么。这些消息遵循格式 `#GUI#message`。消息后面可能跟有键值对，如 `#GUI#message#key1=value1#key2=value2…`。消息和键都从不翻译，并且始终以英文输出。 |
| `-v, --verbose` | 启用详细信息输出，并在读取时显示所有重要的 Matroska(tm) 元素。 |
| `-h, --help` | 显示用法信息并退出。 |
| `-V, --version` | 显示版本信息并退出。 |
| `@options-file.json` | 从文件 `options-file` 读取额外的命令行参数。有关此类文件的受支持格式的完整说明，请参阅 mkvmerge(1) 手册页中名为“选项文件”的部分。 |

### 2.2. 轨道提取模式

**语法:** `mkvextract 源文件名 tracks [选项] TID1:目标文件名1 [TID2:目标文件名2 ...]`

以下命令行选项可用于 'tracks' 提取模式中的每个轨道。它们必须出现在轨道规范（见下文）之前。

| 选项 | 描述 |
| :--- | :--- |
| `-c 字符集` | 设置下一个文本字幕轨道要转换到的字符集。仅当下一个轨道 ID 以文本字幕轨道为目标时有效。默认为 UTF-8。 |
| `--blockadd 级别` | 仅保留到此级别的 BlockAdditions。默认是保留所有级别。此选项仅影响某些类型的编解码器，如 WAVPACK4。 |
| `--cuesheet` | 导致 mkvextract(1) 从章节信息和标签数据中为以下轨道提取 CUE 表，并将其写入一个文件，文件名是轨道输出名后附加 '.cue'。 |
| `--raw` | 将原始数据提取到文件中，周围没有任何容器数据。与 `--fullraw` 标志不同，此标志不会导致 `CodecPrivate` 元素的内容被写入文件。此模式适用于所有 CodecID，即使是 mkvextract(1) 本身不支持的编解码器，但生成的文件可能无法使用。 |
| `--fullraw` | 将原始数据提取到文件中，周围没有任何容器数据。如果轨道包含此类头元素，则 `CodecPrivate` 元素的内容将首先写入文件。此模式适用于所有 CodecID，即使是 mkvextract(1) 本身不支持的编解码器，但生成的文件可能无法使用。 |
| `TID:outname` | 如果源文件中存在 ID 为 `TID` 的轨道，则将其提取到文件 `outname` 中。此选项可以多次给出。轨道 ID 与 mkvmerge(1) 的 `--identify` 选项输出的 ID 相同。 |

每个输出名称应只使用一次。例外是 RealAudio 和 RealVideo 轨道。如果您为不同的轨道使用相同的名称，那么这些轨道将保存在同一个文件中。

**示例:**

```bash
$ mkvextract input.mkv tracks 0:video.h264 2:output-two-vobsub-tracks.idx 3:output-two-vobsub-tracks.idx
```

### 2.3. 附件提取模式

**语法:** `mkvextract 源文件名 attachments [选项] AID1:输出名1 [AID2:输出名2 ...]`

| 选项 | 描述 |
| :--- | :--- |
| `AID:outname` | 如果源文件中存在 ID 为 `AID` 的附件，则将其提取到文件 `outname` 中。如果 `outname` 为空，则使用源 Matroska(tm) 文件中附件的名称。此选项可以多次给出。附件 ID 与 mkvmerge(1) 的 `--identify` 选项输出的 ID 相同。 |

### 2.4. 章节提取模式

**语法:** `mkvextract 源文件名 chapters [选项] 输出文件名.xml`

| 选项 | 描述 |
| :--- | :--- |
| `-s, --simple` | 以 OGM 工具使用的简单格式导出章节信息（CHAPTER01=..., CHAPTER01NAME=...）。在此模式下，一些信息必须被丢弃。默认是以 XML 格式输出章节。 |
| `--simple-language 语言` | 如果启用了简单格式，则 mkvextract(1) 将为遇到的每个章节原子只输出一个条目，即使一个章节原子包含多个章节名称。默认情况下，mkvextract(1) 将使用为每个原子找到的第一个章节名称，而不管其语言。使用此选项允许用户在原子包含多个章节名称时确定输出哪些章节名称。语言参数必须是 ISO 639-1 或 ISO 639-2 代码。 |

章节被写入指定的输出文件。默认情况下，使用 mkvmerge(1) 理解的 XML 格式。如果文件中未找到章节，则不会创建输出文件。

### 2.5. 标签提取模式

**语法:** `mkvextract 源文件名 tags [选项] 输出文件名.xml`

| 选项 | 描述 |
| :--- | :--- |
| `-T, --no-track-tags` | 仅导出非轨道特定的标签。 |

标签以 mkvmerge(1) 理解的 XML 格式写入指定的输出文件。如果未找到标签，则不会创建输出文件。

### 2.6. Cue 表提取模式

**语法:** `mkvextract 源文件名 cuesheet [选项] 输出文件名.cue`

Cue 表被写入指定的输出文件。如果未找到章节或标签，则不会创建输出文件。

### 2.7. 时间戳提取模式

**语法:** `mkvextract 源文件名 timestamps_v2 [选项] TID1:目标文件名1 [TID2:目标文件名2 ...]`

| 选项 | 描述 |
| :--- | :--- |
| `TID:outname` | 如果源文件中存在 ID 为 `TID` 的轨道，则将其时间戳提取到文件 `outname` 中。此选项可以多次给出。轨道 ID 与 mkvmerge(1) 的 `--identify` 选项输出的 ID 相同。 |

**示例:**

```bash
$ mkvextract input.mkv timestamps_v2 1:ts-track1.txt 2:ts-track2.txt
```

### 2.8. Cues 提取模式

**语法:** `mkvextract 源文件名 cues [选项] TID1:目标文件名1 [TID2:目标文件名2 ...]`

| 选项 | 描述 |
| :--- | :--- |
| `TID:destname` | 如果源文件中存在 ID 为 `TID` 的轨道，则将其 Cues 提取到文件 `destname` 中。此选项可以多次给出。轨道 ID 与 mkvmerge(1) 的 `--identify` 选项输出的 ID 相同，而不是 `CueTrack` 元素中包含的数字。 |

输出格式是简单的文本格式：每个 `CuePoint` 元素一行，包含键值对。如果可选元素不存在于 `CuePoint` 中（例如 `CueDuration`），则将输出破折号作为值。

**可能的键:**

| 键 | 描述 |
| :--- | :--- |
| `timestamp` | Cue 点的时间戳，具有纳秒精度。格式为 `HH:MM:SS.nnnnnnnnn`。此元素始终设置。 |
| `duration` | Cue 点的持续时间，具有纳秒精度。格式为 `HH:MM:SS.nnnnnnnnn`。 |
| `cluster_position` | Matroska(tm) 文件内包含所引用元素的簇开始的绝对字节位置。 |

> **注意:**
> 在 Matroska(tm) 文件内部，`CueClusterPosition` 是相对于段的数据起始偏移量的。但是，`mkvextract(1)` 的 cue 提取模式输出的值已经包含了该偏移量，并且是文件开头的绝对偏移量。

| 键 | 描述 |
| :--- | :--- |
| `relative_position` | 簇内 Cue 点所引用的 `BlockGroup` 或 `SimpleBlock` 元素开始的相对字节位置。 |

> **注意:**
> 在 Matroska(tm) 文件内部，`CueRelativePosition` 是相对于簇的数据起始偏移量的。但是，`mkvextract(1)` 的 cue 提取模式输出的值是相对于簇的 ID 的。文件内的绝对位置可以通过将 `cluster_position` 和 `relative_position` 相加来计算。

**示例:**

```bash
$ mkvextract input.mkv cues 1:cues-track1.txt 2:cues-track2.txt
```

## 3. 示例

在同一时间提取章节和标签及其各自的 XML 格式：

```bash
$ mkvextract movie.mkv chapters movie-chapters.xml tags movie-tags.xml
```

同时提取几个轨道及其各自的时间戳：

```bash
$ mkvextract "Another Movie.mkv" tracks 0:video.h265 "1:main audio.aac" "2:director's comments.aac" timestamps_v2 "0:timestamps video.txt" "1:timestamps main audio.txt" "2:timestamps director's comments.txt"
```

以 Ogg/OGM 格式提取章节并将文本字幕轨道重新编码为另一种字符集：

```bash
$ mkvextract "My Movie.mkv" chapters --simple "My Chapters.txt" tracks -c MS-ANSI "2:My Subtitles.srt"
```

## 4. 文本文件及字符集转换

有关 MKVToolNix 套件中的所有工具如何处理字符集转换、输入/输出编码、命令行编码和控制台编码的深入讨论，请参阅 mkvmerge(1) 手册页中名称相同的部分。

## 5. 输出文件格式

关于输出格式的决定基于轨道类型，而不是基于输出文件名使用的扩展名。目前支持以下轨道类型：

| 选项 | 描述 |
| :--- | :--- |
| `A_AAC/MPEG2/*, A_AAC/MPEG4/*, A_AAC` | 所有 AAC 文件将被写入一个 AAC 文件，每个数据包前带有 ADTS 头。ADTS 头将不包含已弃用的 emphasis 字段。 |
| `A_AC3, A_EAC3` | 这些将被提取为原始 AC-3 文件。 |
| `A_ALAC` | ALAC 轨道被写入 CAF 文件。 |
| `A_DTS` | 这些将被提取为原始 DTS 文件。 |
| `A_FLAC` | FLAC 轨道被写入原始 FLAC 文件。 |
| `A_MPEG/L2` | MPEG-1 Audio Layer II 流将被提取为原始 MP2 文件。 |
| `A_MPEG/L3` | 这些将被提取为原始 MP3 文件。 |
| `A_OPUS` | Opus(tm) 轨道被写入 OggOpus(tm) 文件。 |
| `A_PCM/INT/LIT, A_PCM/INT/BIG` | 原始 PCM 数据将被写入 WAV 文件。大端整数数据将在处理过程中转换为小端数据。 |
| `A_REAL/*` | RealAudio(tm) 轨道被写入 RealMedia(tm) 文件。 |
| `A_TRUEHD, A_MLP` | 这些将被提取为原始 TrueHD/MLP 文件。 |
| `A_TTA1` | TrueAudio(tm) 轨道被写入 TTA 文件。请注意，由于 Matroska(tm) 的时间戳精度有限，提取的文件头将有两个字段有所不同：`data_length`（文件中的总样本数）和 `CRC`。 |
| `A_VORBIS` | Vorbis 音频将被写入 OggVorbis(tm) 文件中。 |
| `S_HDMV/PGS` | PGS 字幕将被写为 SUP 文件。 |
| `S_HDMV/TEXTST` | TextST 字幕将被写为 mkvmerge(1) 和 mkvextract(1) 发明的特殊文件格式。 |
| `S_KATE` | Kate(tm) 流将在 Ogg(tm) 容器内写入。 |
| `S_TEXT/SSA, S_TEXT/ASS, S_ASS` | SSA 和 ASS 文本字幕将分别被写为 SSA/ASS 文件。 |
| `S_TEXT/UTF8, S_TEXT/ASCII` | 简单文本字幕将被写为 SRT 文件。 |
| `S_VOBSUB` | VobSub(tm) 字幕将被写为 SUB 文件，并附带有各自的 IDX 文件。 |
| `S_TEXT/USF` | USF 文本字幕将被写为 USF 文件。 |
| `S_TEXT/WEBVTT` | WebVTT 字幕将被写为 WebVTT 文件。 |
| `V_MPEG1, V_MPEG2` | MPEG-1 和 MPEG-2 视频轨道将被写入 MPEG 基本流。 |
| `V_MPEG4/ISO/AVC` | H.264 / AVC 视频轨道被写入 H.264 基本流，可以进一步用例如 GPAC(tm) 包中的 MP4Box(tm) 处理。 |
| `V_MPEG4/ISO/HEVC` | H.265 / HEVC 视频轨道被写入 H.265 基本流，可以进一步用例如 GPAC(tm) 包中的 MP4Box(tm) 处理。 |
| `V_MS/VFW/FOURCC` | 具有此 CodecID 的固定 FPS 视频轨道将被写入 AVI 文件。 |
| `V_REAL/*` | RealVideo(tm) 轨道被写入 RealMedia(tm) 文件。 |
| `V_THEORA` | Theora(tm) 流将被写入 Ogg(tm) 容器中。 |
| `V_VP8, V_VP9` | VP8 / VP9 轨道被写入 IVF 文件。 |
| `Tags` | 标签被转换为 XML 格式。此格式与 mkvmerge(1) 支持读取的格式相同。 |
| `Attachments` | 附件按原样写入输出文件。不进行任何转换。 |
| `Chapters` | 章节被转换为 XML 格式。此格式与 mkvmerge(1) 支持读取的格式相同。或者，可以输出简化的 OGM 样式版本。 |
| `Timestamps` | 时间戳首先被排序，然后以符合时间戳 v2 格式的文件输出，准备好提供给 mkvmerge(1)。不支持提取到其他格式（v1、v3 和 v4）。 |

## 6. 退出代码

mkvextract(1) 以以下三种退出代码之一退出：
*   **0** -- 此退出代码表示提取已成功完成。
*   **1** -- 在这种情况下，mkvextract(1) 至少输出了一个警告，但提取继续进行。警告以文本 'Warning:' 为前缀。根据所涉及的问题，生成的文件可能正常也可能不正常。敦促用户检查警告和生成的文件。
*   **2** -- 在发生错误后使用此退出代码。mkvextract(1) 在输出错误消息后立即中止。错误消息范围从错误的命令行参数到读/写错误或损坏的文件。

## 7. 环境变量

mkvextract(1) 使用确定系统语言环境的默认变量（例如 `LANG` 和 `LC_*` 系列）。附加变量：

| 选项 | 描述 |
| :--- | :--- |
| `MKVEXTRACT_DEBUG`, `MKVTOOLNIX_DEBUG` 及其缩写 `MTX_DEBUG` | 其内容被视为已通过 `--debug` 选项传递。 |
| `MKVEXTRACT_ENGAGE`, `MKVTOOLNIX_ENGAGE` 及其缩写 `MTX_ENGAGE` | 其内容被视为已通过 `--engage` 选项传递。 |

---

*注意：本文档基于 mkvinfo 的官方手册，已翻译为中文并使用 Markdown 格式进行美化。*
