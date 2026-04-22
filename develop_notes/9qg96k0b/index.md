---
url: /develop_notes/9qg96k0b/index.md
---
## 1. MKV 文件总体结构

MKV 是基于 **EBML**（Extensible Binary Meta Language，可扩展二进制元语言）的。EBML 是参考 XML 实现的用于存储二进制数据的格式。

### EBML 基础

EBML 的最基础构成单位是 **EBML Element**，通过多个 EBML Element 构成一个 Document。其结构定义如下：

```go
typedef struct {
	vint ID; 			// EBML-ID
	vint size; 			// size of element
	char data[size]; 	// data
} EBML_ELEMENT;
```

其中，`data` 可以是二进制数据，也可以是其他 EBML Element。

**vint**（Variable Length Integer，可变长度无符号整型）比传统 32/64 位整型更节省空间。它由三部分构成：`VINT_WIDTH`、`VINT_MARKER`、`VINT_DATA`。

* **VINT\_MARKER**：二进制数据中第一个 `1` 的位置。
* **VINT\_WIDTH**：在 `VINT_MARKER` 之前的 `0` 的个数，`VINT_WIDTH + 1` 表示 vint 占用的字节数。
  **示例**：MKV 文件开头的字节 `42 82 88 6d 61 74 72 6f 73 6b 61` 是一个完整的 DocType Element。
* `0x282` 是 EBML-ID (`42 82` -> `0100 0010` `1000 0010`，字节数为2)。
* `0x8` 是 Element-size (`88` -> `1000 1000`，字节数为1，值为8)。
* 后面8个字节是字符串 `"matroska"`。

### MKV 整体结构

从总体结构来看，MKV 主要包括以下几个部分：

1. **Header**：包含 EBML 版本信息和类型。
2. **Meta Seek Information**：用于定位文件其他部分的索引信息（可选）。
3. **Segment Information**：包含文件相关的基本信息，如标题、时长、唯一ID等。
4. **Track**：包含音视频轨道信息，如编码方式、分辨率、采样率等。
5. **Chapters**：章节信息，用于预设播放点。
6. **Clusters**：主要包含每个轨道的音频帧和视频帧数据。
7. **Cueing Data**：包含所有关键帧的索引信息，用于播放时快速定位。
8. **Attachment**：用于附加文件，如封面、字体等。
9. **Tagging**：包含文件和轨道相关的元数据标签，类似 MP3 的 ID3 tag。

> **注意**：EBML 是分层的。位于 Level `n` 的元素只能包含 Level `n+1` 的元素。Matroska 最顶层的是 Level 0 的元素，主要有两个：**EBML Header** 和 **Segment**。

***

## 2. EBML Header

EBML Header 位于 MKV 文件开头，是 Level 0 元素之一，主要包含以下 Level 1 元素：

| Element Name | L | EBML ID | Ma | Mu | Rng | Default | T | 1 | 2 | 3 | 4 | W | Description |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **EBML Header** | | | | | | | | | | | | |
| EBML | 0 | `[1A][45][DF][A3]` | \* | \* | - | - | m | \* | \* | \* | \* | \* | Set the EBML characteristics of the data to follow. Each EBML document has to start with this. |
| EBMLVersion | 1 | `[42][86]` | \* | - | - | 1 | u | \* | \* | \* | \* | \* | The version of EBML parser used to create the file. |
| EBMLReadVersion | 1 | `[42][F7]` | \* | - | - | 1 | u | \* | \* | \* | \* | \* | The minimum EBML version a parser has to support to read this file. |
| EBMLMaxIDLength | 1 | `[42][F2]` | \* | - | - | 4 | u | \* | \* | \* | \* | \* | The maximum length of the IDs you'll find in this file (4 or less in Matroska). |
| EBMLMaxSizeLength | 1 | `[42][F3]` | \* | - | - | 8 | u | \* | \* | \* | \* | \* | The maximum length of the sizes you'll find in this file (8 or less in Matroska). |
| DocType | 1 | `[42][82]` | \* | - | - | matroska | s | \* | \* | \* | \* | \* | A string that describes the type of document that follows this EBML header. 'matroska' in our case or 'webm' for webm files. |
| DocTypeVersion | 1 | `[42][87]` | \* | - | - | 1 | u | \* | \* | \* | \* | \* | The version of DocType interpreter used to create the file. |
| DocTypeReadVersion | 1 | `[42][85]` | \* | - | - | 1 | u | \* | \* | \* | \* | \* | The minimum DocType version an interpreter has to support to read this file. |

**表头说明**:

* **L**: Level
* **Ma**: Mandatory (`*` means mandatory)
* **Mu**: Multiple (`*` means can appear multiple times)
* **Rng**: Range
* **T**: Type (`m`: Master, `u`: unsigned int, `s`: string, `8`: UTF-8, `b`: binary, `f`: float, `d`: date)
* **1,2,3,4**: Included in Matroska version
* **W**: Used in WebM

***

## 3. Segment

除了 EBML Header，MKV 中其它部分都包含在 **Segment** 中。Segment 的 ID 是 `[18][53][80][67]`，位于 Level 0，包含了所有 Level 1 的元素。

### Meta Seek Info

一个快速索引的信息（可选），包含一个 `SeekHead` 及多个 `Seek Entry`。

| Element Name | L | EBML ID | Ma | Mu | Rng | Default | T | 1 | 2 | 3 | 4 | W | Description |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **SeekHead** | 1 | `[11][4D][9B][74]` | - | \* | - | - | m | \* | \* | \* | \* | \* | Contains the position of other Top-Level Elements. |
| **Seek** | 2 | `[4D][BB]` | \* | \* | - | - | m | \* | \* | \* | \* | \* | Contains a single seek entry to an EBML Element. |
| SeekID | 3 | `[53][AB]` | \* | - | - | - | b | \* | \* | \* | \* | \* | The binary ID corresponding to the Element name. |
| SeekPosition | 3 | `[53][AC]` | \* | - | - | - | u | \* | \* | \* | \* | \* | The position of the Element in the Segment in octets (0 = first level 1 Element). |

### Segment Info

包含文件识别信息（如 `SegmentUID`）和 `Duration` 字段。

| Element Name | L | EBML ID | Ma | Mu | Rng | Default | T | 1 | 2 | 3 | 4 | W | Description |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **Info** | 1 | `[15][49][A9][66]` | \* | \* | - | - | m | \* | \* | \* | \* | \* | Contains miscellaneous general information and statistics on the file. |
| SegmentUID | 2 | `[73][A4]` | - | - | not 0 | - | b | \* | \* | \* | \* | | A randomly generated unique ID to identify the current segment between many others (128 bits). |
| TimecodeScale | 2 | `[2A][D7][B1]` | \* | - | - | 1000000 | u | \* | \* | \* | \* | \* | Timestamp scale in nanoseconds (1.000.000 means all timestamps in the Segment are expressed in milliseconds). |
| Duration | 2 | `[44][89]` | - | - | > 0 | - | f | \* | \* | \* | \* | \* | Duration of the segment (based on TimecodeScale). |
| Title | 2 | `[7B][A9]` | - | - | - | - | 8 | \* | \* | \* | \* | | General name of the segment. |
| MuxingApp | 2 | `[4D][80]` | \* | - | - | - | 8 | \* | \* | \* | \* | \* | Muxing application or library ("libmatroska-0.4.3"). |
| WritingApp | 2 | `[57][41]` | \* | - | - | - | 8 | \* | \* | \* | \* | \* | Writing application ("mkvmerge-0.3.3"). |

### Track

包含音视频轨道的基本信息，每个 `TrackEntry` 代表一条轨道。

| Element Name | L | EBML ID | Ma | Mu | Rng | Default | T | 1 | 2 | 3 | 4 | W | Description |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **Tracks** | 1 | `[16][54][AE][6B]` | - | \* | - | - | m | \* | \* | \* | \* | \* | A Top-Level Element of information with many tracks described. |
| **TrackEntry** | 2 | `[AE]` | \* | \* | - | - | m | \* | \* | \* | \* | \* | Describes a track with all Elements. |
| TrackNumber | 3 | `[D7]` | \* | - | not 0 | - | u | \* | \* | \* | \* | \* | The track number as used in the Block Header. |
| TrackUID | 3 | `[73][C5]` | \* | - | not 0 | - | u | \* | \* | \* | \* | \* | A unique ID to identify the Track. |
| TrackType | 3 | `[83]` | \* | - | 1-254 | - | u | \* | \* | \* | \* | \* | A set of track types (1: video, 2: audio, 3: complex, 0x10: logo, 0x11: subtitle, 0x12: buttons, 0x20: control). |
| Name | 3 | `[53][6E]` | - | - | - | - | 8 | \* | \* | \* | \* | \* | A human-readable track name. |
| Language | 3 | `[22][B5][9C]` | - | - | - | eng | s | \* | \* | \* | \* | \* | Specifies the language of the track. |
| CodecID | 3 | `[86]` | \* | - | - | - | s | \* | \* | \* | \* | \* | An ID corresponding to the codec. |
| **Video** | 3 | `[E0]` | - | - | - | - | m | \* | \* | \* | \* | \* | Video settings. |
| PixelWidth | 4 | `[B0]` | \* | - | not 0 | - | u | \* | \* | \* | \* | \* | Width of the encoded video frames in pixels. |
| PixelHeight | 4 | `[BA]` | \* | - | not 0 | - | u | \* | \* | \* | \* | \* | Height of the encoded video frames in pixels. |
| **Audio** | 3 | `[E1]` | - | - | - | - | m | \* | \* | \* | \* | \* | Audio settings. |
| SamplingFrequency | 4 | `[B5]` | \* | - | > 0 | 8000.0 | f | \* | \* | \* | \* | \* | Sampling frequency in Hz. |
| Channels | 4 | `[9F]` | \* | - | not 0 | 1 | u | \* | \* | \* | \* | \* | Numbers of channels in the track. |

### Chapters

为媒体文件添加章节目录信息（如片头、片尾）。ID 为 `[10][43][A7][70]`。

### Clusters

包含所有的音视频数据，由多个 `Cluster` 构成。每个 `Cluster` 包含一个或多个 `BlockGroup` 或 `SimpleBlock`，音视频数据交织存储。

| Element Name | L | EBML ID | Ma | Mu | Rng | Default | T | 1 | 2 | 3 | 4 | W | Description |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **Cluster** | 1 | `[1F][43][B6][75]` | - | \* | - | - | m | \* | \* | \* | \* | \* | The Top-Level Element containing the (monolithic) Block structure. |
| Timecode | 2 | `[E7]` | \* | - | - | - | u | \* | \* | \* | \* | \* | Absolute timestamp of the cluster (based on TimecodeScale). |
| **SimpleBlock** | 2 | `[A3]` | - | \* | - | - | b | | \* | \* | \* | \* | Similar to Block but without all the extra information, mostly used to reduced overhead. |
| **BlockGroup** | 2 | `[A0]` | - | \* | - | - | m | \* | \* | \* | \* | \* | Basic container of information containing a single Block and information specific to that Block. |
| **Block** | 3 | `[A1]` | \* | - | - | - | b | \* | \* | \* | \* | \* | Block containing the actual data to be rendered and a timestamp relative to the Cluster Timecode. |

### Cueing Data

关键帧的索引表，用于实现快速 seek。

| Element Name | L | EBML ID | Ma | Mu | Rng | Default | T | 1 | 2 | 3 | 4 | W | Description |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **Cues** | 1 | `[1C][53][BB][6B]` | - | - | - | - | m | \* | \* | \* | \* | \* | A Top-Level Element to speed seeking access. |
| **CuePoint** | 2 | `[BB]` | \* | \* | - | - | m | \* | \* | \* | \* | \* | Contains all information relative to a seek point in the Segment. |
| CueTime | 3 | `[B3]` | \* | - | - | - | u | \* | \* | \* | \* | \* | Absolute timestamp according to the Segment time base. |
| **CueTrackPositions** | 3 | `[B7]` | \* | \* | - | - | m | \* | \* | \* | \* | \* | Contain positions for different tracks corresponding to the timestamp. |
| CueTrack | 4 | `[F7]` | \* | - | not 0 | - | u | \* | \* | \* | \* | \* | The track for which a position is given. |
| CueClusterPosition | 4 | `[F1]` | \* | - | - | - | u | \* | \* | \* | \* | \* | The position of the Cluster containing the required Block. |

### Attachment & Tagging

* **Attachment**: 用于附加任何类型的文件，如封面、字体等。
* **Tagging**: 包含文件和轨道相关的 Tag，如作者、歌手等信息。

***

## 4. 关于其他问题的概述

* **如何找到对应的音频流、视频流、字幕流？**
  > 在 MKV 文件的 **Track** 部分，每个 `TrackEntry` 都是一个独立的音频流、视频流或字幕流。通过解析这部分可以知道当前容器中的多媒体格式。
* **如何确定该容器的节目播放时长？**
  > **Segment Info** 部分中的 `Duration` 字段，可以直接读取节目时长。
* **MKV容器是否支持seek？有哪些辅助信息？**
  > 是的，MKV 的索引表保存在 **Cues** 部分，可以通过里面提供的关键帧索引表实现快速 seek。
* **哪里可以找到该容器格式最标准的文档资料？**
  > Matroska 是开源的，可以通过 <https://www.matroska.org/> 直接访问其标准文档。
* **有哪些可用的工具，方便分析容器格式异常或者错误？**
  > 比较常用的工具是 **mkvtoolnix**，其他工具可以在 Matroska 官方下载页面找到。

***

## 5. 总结和参考资料

MKV 是一个相对复杂的容器格式，但在理解了 EBML 的基本原则和其分层结构后，通过顺序解析就可以完成大部分工作。

**主要参考资料**:

* [Matroska Official Website](https://www.matroska.org/)
* [Matroska Specifications](https://www.matroska.org/technical/specs/index.html)
* [Wiki - Matroska](https://en.wikipedia.org/wiki/Matroska)
