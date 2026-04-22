---
url: /develop_notes/b0fsvr8k/index.md
---
## 1. 概述

```bash
mkvmerge [全局选项] {-o 输出文件} [选项1] {文件1} [[选项2] {文件2}] [@选项文件.json]
```

## 2. 描述

此程序从多个媒体文件中获取输入，并将其流（全部或仅选择部分）合并到一个 Matroska™ 文件中；请参阅 Matroska 网站。

**重要提示：**

命令行选项的顺序很重要。如果您是此程序的新用户，请阅读"选项顺序"部分。

### 2.1. 全局选项

| 选项 | 描述 |
|------|------|
| `-v, --verbose` | 增加详细输出 |
| `-q, --quiet` | 抑制状态输出 |
| `-o, --output 文件名` | 写入文件文件名。如果使用分割，则此参数的处理方式略有不同。请参阅 --split 选项的说明 |
| `-w, --webm` | 创建符合 WebM 的文件。如果输出文件名的扩展名为"webm"，也会启用此模式。此模式强制执行若干限制。唯一允许的编解码器是 VP8、VP9 视频和 Opus、Vorbis 音频轨。DocType 头项目更改为"webm" |
| `--title 标题` | 设置输出文件的通用标题，例如电影名称 |
| `--default-language 语言代码` | 设置默认语言代码，用于未通过 --language 选项设置语言且源容器未提供语言的轨道。默认语言代码为 'und'（未确定） |

### 2.2. 段信息处理（全局选项）

| 选项 | 描述 |
|------|------|
| `--segmentinfo 文件名.xml` | 从 XML 文件读取段信息。此文件可包含段系列 UID、段 UID、前一个和下一个段 UID 元素。MKVToolNix 发行版中包含示例文件和 DTD |
| `--segment-uid SID1,SID2,...` | 设置要使用的段 UID。这是一个逗号分隔的 128 位段 UID 列表，采用通常的 UID 形式：带或不带"0x"前缀的十六进制数字，带或不带空格，正好 32 位数字 |

### 2.3. 章节和标签处理（全局选项）

| 选项 | 描述 |
|------|------|
| `--chapter-language 语言代码` | 为每个章节条目写入的 ISO 639-2 语言代码。默认为 'eng' |
| `--chapter-charset 字符集` | 设置用于将简单章节文件转换为 UTF-8 的字符集 |
| `--chapter-sync d[,o[/p]]` | 按以下源文件的章节时间戳调整 d 毫秒。或者，您可以对特殊轨道 ID -2 使用 --sync 选项 |
| `--generate-chapters 模式` | mkvmerge(1) 可以自动创建章节。目前支持以下两种模式：• 'when-appending' – 此模式在开始时创建一个章节，在追加文件时创建一个章节• 'interval:time-spec' – 此模式以给定的时间间隔创建一个章节 |
| `--generate-chapters-name-template 模板` | 设置由 --generate-chapters 选项生成的章节名称的名称模板 |
| `--cue-chapter-name-format 格式` | mkvmerge(1) 支持将 CUE 表作为音频文件的输入来读取章节 |
| `--chapters 文件名` | 从文件文件名读取章节信息 |
| `--global-tags 文件名` | 从文件文件名读取全局标签 |

### 2.4. 通用输出控制（高级全局选项）

| 选项 | 描述 |
|------|------|
| `--track-order FID1:TID1,FID2:TID2,...` | 此选项更改输入文件的轨道创建顺序 |
| `--cluster-length 规范` | 限制每个集群中的数据块数量或数据持续时间 |
| `--clusters-in-meta-seek` | 告诉 mkvmerge(1) 在文件末尾创建包含所有集群的元搜索元素 |
| `--timestamp-scale 因子` | 强制时间戳比例因子为因子。有效值范围为 1000..10000000 或特殊值 -1 |
| `--enable-durations` | 为所有块写入持续时间。这将增加文件大小，目前不提供任何附加价值 |
| `--no-date` | 默认情况下，mkvmerge(1) 将"日期"段信息字段设置为多路复用开始的时间和日期。使用此选项，该字段将完全不写入 |
| `--date 时间戳` | 设置写入段信息的 DateUTC 字段。时间戳必须是 ISO 8601 格式 |
| `--disable-lacing` | 禁用所有轨道的交织。这将增加文件大小，特别是如果有许多音频轨道 |
| `--disable-track-statistics-tags` | 通常 mkvmerge(1) 会为每个轨道写入带有统计信息的某些标签 |
| `--disable-language-ietf` | 通常 mkvmerge(1) 除了写入旧的语言元素外，还会在轨道头、章节和标签中写入新的 IETF BCP 47 语言元素 |
| `--normalize-language-ietf 模式` | 启用将所有 IETF BCP 47 语言标签规范化为规范形式或扩展语言子标签形式 |
| `--stop-after-video-ends` | 在主视频轨道结束后停止处理，丢弃其他轨道的任何剩余数据包 |

### 2.5. 文件分割、链接、追加和连接（更多全局选项）

| 选项 | 描述 |
|------|------|
| `--split 规范` | 在给定大小或给定时间后分割输出文件。请注意，轨道只能在关键帧之前分割。因此，分割点可能与用户指定的略有偏差 |
| `--link` | 分割输出文件时将文件相互链接 |
| `--link-to-previous segment-UID` | 将第一个输出文件链接到给定 segment-UID 参数的段 |
| `--link-to-next segment-UID` | 将最后一个输出文件链接到给定 segment-UID 参数的段 |
| `--append-mode 模式` | 确定追加文件时如何计算时间戳 |
| `--append-to SFID1:STID1:DFID1:DTID1[,...]` | 此选项控制另一个轨道追加到哪个轨道 |

### 2.6. 附件支持（更多全局选项）

| 选项 | 描述 |
|------|------|
| `--attachment-description 描述` | 以下附件的纯文本描述。适用于下一个 --attach-file 或 --attach-file-once 选项 |
| `--attachment-mime-type MIME 类型` | 以下附件的 MIME 类型。适用于下一个 --attach-file 或 --attach-file-once 选项 |
| `--attachment-name 名称` | 设置将为此附件存储在输出文件中的名称 |
| `--attach-file 文件名, --attach-file-once 文件名` | 在 Matroska™ 文件内创建文件附件 |
| `--enable-legacy-font-mime-types` | 启用对某些类型字体附件使用旧版 MIME 类型 |

### 2.7. 可用于每个输入文件的选项

| 选项 | 描述 |
|------|------|
| `-a, --audio-tracks [!]n,m,...` | 复制音频轨道 n、m 等 |
| `-d, --video-tracks [!]n,m,...` | 复制视频轨道 n、m 等 |
| `-s, --subtitle-tracks [!]n,m,...` | 复制字幕轨道 n、m 等 |
| `-b, --button-tracks [!]n,m,...` | 复制按钮轨道 n、m 等 |
| `--track-tags [!]n,m,...` | 复制轨道 n、m 等的标签 |
| `-m, --attachments [!]n[:all\|first],m[:all\|first],...` | 将 ID 为 n、m 等的附件复制到所有或仅第一个输出文件 |
| `-A, --no-audio` | 不从此文件复制任何音频轨道 |
| `-D, --no-video` | 不从此文件复制任何视频轨道 |
| `-S, --no-subtitles` | 不从此文件复制任何字幕轨道 |
| `-B, --no-buttons` | 不从此文件复制任何按钮轨道 |
| `-T, --no-track-tags` | 不从此文件复制任何轨道特定标签 |
| `--no-chapters` | 不从此文件复制章节 |
| `-M, --no-attachments` | 不从此文件复制任何附件 |
| `--no-global-tags` | 不从此文件复制全局标签 |
| `--regenerate-track-uids` | 当此选项用于 Matroska 源文件时，mkvmerge(1) 将创建新的随机唯一轨道 ID，而不是保留文件中现有的 ID |
| `-y, --sync TID:d[,o[/p]]` | 按 d 毫秒调整 ID 为 TID 的轨道的时间戳 |
| `--cues TID:none\|iframes\|all` | 控制为给定轨道创建提示（索引）条目 |
| `--default-track-flag TID[:bool]` | 如果可选参数 bool 设置为 1 或不存在，则设置给定轨道的"默认轨道"标志 |
| `--track-enabled-flag TID[:bool]` | 将给定轨道的"轨道启用"标志设置为给定值 bool（0 或 1；如果未指定则默认为 1） |
| `--forced-display-flag TID[:bool]` | 如果可选参数 bool 设置为 1 或不存在，则设置给定轨道的"强制显示"标志 |
| `--hearing-impaired-flag TID[:bool]` | 如果可选参数 bool 设置为 1 或不存在，则设置给定轨道的"听力受损"标志 |
| `--visual-impaired-flag TID[:bool]` | 如果可选参数 bool 设置为 1 或不存在，则设置给定轨道的"视觉受损"标志 |
| `--text-descriptions-flag TID[:bool]` | 如果可选参数 bool 设置为 1 或不存在，则设置给定轨道的"文本描述"标志 |
| `--original-flag TID[:bool]` | 如果可选参数 bool 设置为 1 或不存在，则设置给定轨道的"原始语言"标志 |
| `--commentary-flag TID[:bool]` | 如果可选参数 bool 设置为 1 或不存在，则设置给定轨道的"评论"标志 |
| `--track-name TID:名称` | 将给定轨道的轨道名称设置为名称 |
| `--language TID:语言` | 设置给定轨道的语言 |
| `-t, --tags TID:文件名` | 从文件文件名读取编号为 TID 的轨道的标签 |
| `--aac-is-sbr TID[:0\|1]` | 告诉 mkvmerge(1) ID 为 TID 的轨道是 SBR AAC（也称为 HE-AAC 或 AAC+） |
| `--audio-emphasis TID:n\|symbolic-name` | 设置 ID 为 TID 的音频轨道的强调 |
| `--reduce-to-core TID` | 某些音频编解码器具有有损核心和可选扩展，实现无损解码 |
| `--remove-dialog-normalization-gain TID` | 某些音频编解码器包含告诉解码器或播放器应用对话标准化增益（通常为负值）的头字段 |
| `--timestamps TID:文件名` | 从文件文件名读取要用于特定轨道 ID 的时间戳 |
| `--default-duration TID:x` | 强制给定轨道的默认持续时间为指定值。还修改轨道的时间戳以匹配默认持续时间 |
| `--fix-bitstream-timing-information TID[:0\|1]` | 通常 mkvmerge(1) 不会更改存储在视频比特流中的定时信息（帧/场率） |
| `--compression TID:n` | 选择用于轨道的压缩方法 |

### 2.8. 仅适用于视频轨道的选项

| 选项 | 描述 |
|------|------|
| `-f, --fourcc TID:FourCC` | 强制 FourCC 为指定值。仅适用于 'MS 兼容模式'中的视频轨道 |
| `--display-dimensions TID:宽度x高度` | Matroska™ 文件包含两个值，设置播放器应在播放时缩放图像的显示属性：显示宽度和显示高度 |
| `--aspect-ratio TID:比率\|宽度/高度` | Matroska™ 文件包含两个值，设置播放器应在播放时缩放图像的显示属性 |
| `--aspect-ratio-factor TID:因子\|n/d` | 设置宽高比的另一种方法是指定因子 |
| `--cropping TID:左,上,右,下` | 将视频轨道的像素裁剪参数设置为给定值 |
| `--color-matrix-coefficients TID:n` | 设置用于从红色、绿色和蓝色原色导出亮度和色度值的视频的矩阵系数 |
| `--color-bits-per-channel TID:n` | 设置颜色通道的编码位数。值为 0 表示位数未指定 |
| `--chroma-subsample TID:水平,垂直` | 对于每个未水平/垂直移除的像素，从 Cr 和 Cb 通道中移除的像素量 |
| `--cb-subsample TID:水平,垂直` | 对于每个未水平/垂直移除的像素，从 Cb 通道中移除的像素量 |
| `--chroma-siting TID:水平,垂直` | 设置色度水平/垂直定位方式（0：未指定，1：顶部对齐，2：一半） |
| `--color-range TID:n` | 设置颜色范围的裁剪（0：未指定，1：广播范围，2：完整范围（无裁剪），3：由 MatrixCoefficients/TransferCharacteristics 定义） |
| `--color-transfer-characteristics TID:n` | 视频的传递特性 |
| `--color-primaries TID:n` | 设置视频的原色 |
| `--max-content-light TID:n` | 设置单个像素的最大亮度（最大内容光级别），单位为坎德拉/平方米（cd/m²） |
| `--max-frame-light TID:n` | 设置单个完整帧的最大亮度（最大帧平均光级别），单位为坎德拉/平方米（cd/m²） |
| `--chromaticity-coordinates TID:红色-x,红色-y,绿色-x,绿色-y,蓝色-x,蓝色-y` | 按 CIE 1931 定义设置红色/绿色/蓝色色度坐标 |
| `--white-color-coordinates TID:x,y` | 按 CIE 1931 定义设置白色色度坐标 |
| `--max-luminance TID:浮点数` | 设置最大亮度，单位为坎德拉/平方米（cd/m²） |
| `--min-luminance TID:浮点数` | 设置最小亮度，单位为坎德拉/平方米（cd/m²） |
| `--projection-type TID:方法` | 设置使用的视频投影方法 |
| `--projection-private TID:数据` | 设置仅适用于特定投影的私有数据 |
| `--projection-pose-yaw TID:浮点数` | 指定投影的偏航旋转 |
| `--projection-pose-pitch TID:浮点数` | 指定投影的俯仰旋转 |
| `--projection-pose-roll TID:浮点数` | 指定投影的滚转旋转 |
| `--field-order TID:n` | 设置 ID 为 TID 的视频轨道的场顺序 |
| `--stereo-mode TID:n\|symbolic-name` | 设置 ID 为 TID 的视频轨道的立体模式 |

### 2.9. 仅适用于文本字幕轨道的选项

| 选项 | 描述 |
|------|------|
| `--sub-charset TID:字符集` | 为给定轨道 ID 的 UTF-8 字幕设置字符集转换 |

### 2.10. 其他选项

| 选项 | 描述 |
|------|------|
| `-i, --identify 文件名` | 将让 mkvmerge(1) 探查单个文件并报告其类型、文件中包含的轨道及其轨道 ID |
| `-J 文件名` | 这是"--identification-format json --identify 文件名"的便捷别名 |
| `-F, --identification-format 格式` | 确定 --identify 选项使用的输出格式 |
| `--probe-range-percentage 百分比` | 文件类型（如 MPEG 程序和传输流（.vob、.m2ts））需要解析一定量的数据才能检测文件中包含的所有轨道 |
| `--list-audio-emphasis` | 列出 --audio-emphasis 选项的所有有效数字及其对应的符号名称 |
| `--list-languages` | 列出所有语言及其可用于 --language 选项的 ISO 639-2 代码 |
| `--list-stereo-modes` | 列出 --stereo-mode 选项的所有有效数字及其对应的符号名称 |
| `-l, --list-types` | 列出支持的输入文件类型 |
| `--priority 优先级` | 设置 mkvmerge(1) 运行的进程优先级 |
| `--command-line-charset 字符集` | 设置从命令行转换字符串的字符集 |
| `--output-charset 字符集` | 设置要输出字符串的字符集 |
| `-r, --redirect-output 文件名` | 将所有消息写入文件文件名，而不是控制台 |
| `--no-bom` | 通常，以 UTF 变体之一创建和编码的文本文件将以字节顺序标记（BOM）开头 |
| `--flush-on-close` | 告诉程序在关闭用于写入的文件时将内存中缓存的所有数据刷新到存储 |
| `--ui-language 代码` | 强制使用语言代码的翻译（例如，德语翻译使用 'de\_DE'） |
| `--abort-on-warnings` | 告诉程序在发出第一个警告后中止 |
| `--deterministic-seed 种子` | 如果使用相同版本的 mkvmerge(1) 与相同的源文件、相同的选项集和相同的种子，则启用创建字节相同的文件 |
| `--debug 主题` | 为特定功能启用调试。此选项仅对开发人员有用 |
| `--engage 功能` | 启用实验性功能 |
| `--gui-mode` | 启用 GUI 模式 |
| `@options-file.json` | 从文件 options-file 读取其他命令行参数 |
| `--capabilities` | 列出关于已编译的可选功能的信息并退出 |
| `-h, --help` | 显示使用信息并退出 |
| `-V, --version` | 显示版本信息并退出 |

## 3. 用法

对于每个文件，用户可以选择 mkvmerge(1) 应该采用哪些轨道。它们都被放入用 -o 指定的文件中。可以使用 -l 选项获取已知（和支持的）源格式列表。

**重要提示：**

命令行选项的顺序很重要。如果您是此程序的新用户，请阅读"选项顺序"部分。

## 4. 选项顺序

选项输入的顺序对于某些选项很重要。选项分为两类：

1. **影响整个程序且不与任何输入文件绑定的选项**。这些包括但不限于 --command-line-charset、--output 或 --title。这些可以出现在命令行的任何位置。
2. **影响单个输入文件或输入文件中单个轨道的选项**。这些选项都适用于命令行上的以下输入文件。适用于同一输入文件（或来自同一输入文件的轨道）的所有选项可以按任何顺序编写，只要它们都出现在该输入文件名之前。

选项从左到右处理。如果在同一范围内多次出现某个选项，则将使用最后一次出现。

## 5. 示例

### 基本用法

假设您有一个名为 MyMovie.avi 的文件和一个单独的音频文件，例如 'MyMovie.wav'。首先，您需要将音频编码为 OggVorbis™：

```bash
$ oggenc -q4 -oMyMovie.ogg MyMovie.wav
```

几分钟后，您可以加入视频和音频：

```bash
$ mkvmerge -o MyMovie-with-sound.mkv MyMovie.avi MyMovie.ogg
```

如果您的 AVI 已经包含音频轨道，那么它也会被复制（如果 mkvmerge(1) 支持该音频格式）。要避免这种情况，只需：

```bash
$ mkvmerge -o MyMovie-with-sound.mkv -A MyMovie.avi MyMovie.ogg
```

### 添加更多音轨

经过一些考虑后，您又提取了另一个音轨，例如导演评论或另一种语言的 'MyMovie-add-audio.wav'。再次编码并加入：

```bash
$ oggenc -q4 -oMyMovie-add-audio.ogg MyMovie-add-audio.wav
$ mkvmerge -o MM-complete.mkv MyMovie-with-sound.mkv MyMovie-add-audio.ogg
```

相同的结果可以通过以下方式实现：

```bash
$ mkvmerge -o MM-complete.mkv -A MyMovie.avi MyMovie.ogg MyMovie-add-audio.ogg
```

### 同步音轨

如果您需要同步音轨，可以轻松完成。首先找出 Vorbis 轨道的轨道 ID：

```bash
$ mkvmerge --identify outofsync.ogg
```

现在您可以在以下命令中使用该 ID：

```bash
$ mkvmerge -o goodsync.mkv -A source.avi -y 12345:200 outofsync.ogg
```

这将在 ID 为 12345 的音轨开头添加 200 毫秒的静音。

### 处理不同步的音轨

某些电影开始时正确同步，但慢慢不同步。对于这类电影，您可以指定一个延迟因子，该因子应用于所有时间戳——不会添加或删除数据。因此，如果该因子设置得太大或太小，您将得到糟糕的结果。

### 设置语言代码

如果您想为给定轨道指定语言，这很容易完成。首先找出您语言的 ISO 639-2 代码。mkvmerge(1) 可以为您列出所有这些代码：

```bash
$ mkvmerge --list-languages
```

在列表中搜索您需要的语言。假设您已将两个音轨放入 Matroska™ 文件中，并希望设置它们的语言代码，且它们的轨道 ID 为 2 和 3。这可以通过以下方式完成：

```bash
$ mkvmerge -o with-lang-codes.mkv --language 2:ger --language 3:dut without-lang-codes.mkv
```

### 关闭压缩

关闭输入文件的压缩：

```bash
$ mkvmerge -o no-compression.mkv --compression -1:none MyMovie.avi --compression -1:none mymovie.srt
```

## 6. 轨道 ID

### 6.1. 常规轨道 ID

mkvmerge(1) 的某些选项需要轨道 ID 来指定应将哪些选项应用于哪些轨道。这些轨道 ID 在解复用当前输入文件时由读取器打印，或者如果使用 --identify 选项调用 mkvmerge(1) 时打印。

不要混淆放置在输出 MKV 文件中的轨道的轨道 ID 与输入文件的轨道 ID。只有输入文件轨道 ID 用于需要这些值的选项。

另请注意，每个输入文件都有自己的一组轨道 ID。

轨道 ID 的分配方式如下：

* **AVI 文件**：视频轨道的 ID 为 0。音频轨道的 ID 从 1 开始按升序排列。
* **AAC、AC-3、MP3、SRT 和 WAV 文件**：该文件中的唯一"轨道"的 ID 为 0。
* **大多数其他文件**：轨道 ID 按文件中找到轨道的顺序分配，从 0 开始。

描述中包含 'TID' 的选项使用轨道 ID。以下选项也使用轨道 ID：--audio-tracks、--video-tracks、--subtitle-tracks、--button-tracks 和 --track-tags。

### 6.2. 特殊轨道 ID

有几个 ID 具有特殊含义，不会出现在标识输出中。

特殊轨道 ID '-1' 是通配符，将给定开关应用于从输入文件读取的所有轨道。

特殊轨道 ID '-2' 指的是源文件中的章节。目前只有 --sync 选项使用此特殊 ID。作为 --sync -2:… 选项的替代方案，可以使用 --chapter-sync … 选项。

## 7. 语言处理

Matroska™ 支持两种不同类型的语言元素：旧的、已弃用的"Language"元素，包含 ISO 639-2 alpha 3 代码，以及新的"LanguageIETF"标签，包含 IETF BCP 47 语言标签。mkvmerge(1) 的所有接受语言的选项都接受 BCP 47 语言标签。

当以 JSON 模式标识文件时，现有的"LanguageIETF"轨道头元素将作为 language\_ietf 轨道属性输出。

## 8. 文本文件和字符集转换

### 8.1. 简介

Matroska™ 文件中的所有文本都以 UTF-8 编码。这意味着 mkvmerge(1) 必须将其读取的每个文本文件以及命令行上给出的每个文本从一个字符集转换为 UTF-8。

### 8.2. 字节顺序标记（BOM）

以 BOM 开头的文本文件已经是某种 UTF 表示的编码。mkvmerge(1) 支持以下五种模式：UTF-8、UTF-16 Little 和 Big Endian、UTF-32 Little 和 Big Endian。带有 BOM 的文本文件会自动转换为 UTF-8。

### 8.3. Linux 和类 Unix 系统（包括 macOS）

在类 Unix 系统上，mkvmerge(1) 使用 setlocale(3) 系统调用，后者又使用环境变量 LANG、LC\_ALL 和 LC\_CTYPE。

### 8.4. Windows

在 Windows 上，用于转换文本文件的默认字符集由 GetACP() 系统调用确定。

## 9. 选项文件

选项文件是 mkvmerge(1) 可以从中读取其他命令行参数的文件。这可以用于规避 shell 或操作系统在执行外部程序时的某些限制。

选项文件的名称本身必须以 '@' 字符为前缀作为命令行参数指定。

## 10. 文件链接

Matroska™ 支持文件链接，这简单地表示特定文件是当前文件的前驱或后继。更准确地说，链接的不是文件，而是 Matroska™ 段。

## 11. 默认值

Matroska™ 规范规定某些元素具有默认值。通常，如果元素的值等于其默认值，则不会写入文件以节省空间。

## 12. 附件

也许您还想将一些照片与 Matroska™ 文件一起保存，或者您正在使用 SSA 字幕，需要一个非常罕见的 TrueType™ 字体。在这些情况下，您可以将这些文件附加到 Matroska™ 文件中。

## 13. 章节

### 13.1. 简单章节格式

此格式由以 'CHAPTERxx=' 和 'CHAPTERxxNAME=' 开头的行对组成。第一行包含开始时间戳，第二行包含标题。

### 13.2. 基于 XML 的章节格式

基于 XML 的章节格式支持 Matroska™ 章节功能的所有功能。

### 13.3. 从蓝光光盘读取章节

如果 MKVToolNix 使用 libdvdread™ 库编译，mkvmerge(1) 可以从未加密的蓝光光盘读取章节。

### 13.4. 从 DVD 读取章节

mkvmerge(1) 可以从 DVD 读取章节。

## 14. 标签

### 14.1. 简介

Matroska™ 的标签系统类似于其他容器使用的系统：一组 KEY=VALUE 对。但是，在 Matroska™ 中，这些标签也可以嵌套，并且 KEY 和 VALUE 都是它们自己的元素。

### 14.2. 标签的范围

Matroska™ 标签不会自动应用于整个文件。

### 14.3. 示例

假设您想为从 AVI 读取的视频轨道添加标签。mkvmerge --identify file.avi 告诉您视频轨道的 ID（不要将此 ID 与 UID 混淆！）为 0。

## 15. 段信息

使用段信息 XML 文件，可以设置 Matroska™ 文件的"段信息"头字段中的某些值。

## 16. Matroska 文件布局

Matroska™ 文件布局相当灵活。mkvmerge(1) 将以预定义的方式呈现文件。生成的文件如下所示：

```
[EBML 头] [段 {元搜索 #1} [段信息] [轨道信息] {附件} {章节} [集群 1] {集群 2} ... {集群 n} {提示} {元搜索 #2} {标签}]
```

## 17. 外部时间戳文件

mkvmerge(1) 允许用户自己选择特定轨道的时间戳。

### 17.1. 时间戳文件格式 v1

此格式以版本行开始。第二行声明默认的每秒帧数。所有后续行包含三个逗号分隔的数字：开始帧（0 是第一帧）、结束帧和此范围内的帧数。

### 17.2. 时间戳文件格式 v2

在此格式中，每行包含对应帧的时间戳。此时间戳必须以毫秒精度给出。

### 17.3. 时间戳文件格式 v3

在此格式中，每行包含以秒为单位的持续时间，后跟可选的每秒帧数。

### 17.4. 时间戳文件格式 v4

此格式与 v2 格式相同。唯一的区别是时间戳不必排序。

## 18. 退出代码

mkvmerge(1) 以以下三种退出代码之一退出：

* **0** - 此退出代码表示多路复用已成功完成。
* **1** - 在这种情况下，mkvmerge(1) 已输出至少一个警告，但多路复用确实继续了。
* **2** - 发生错误时使用此退出代码。mkvmerge(1) 在输出错误消息后立即中止。

## 19. 环境变量

mkvmerge(1) 使用确定系统区域设置的默认变量（例如 LANG 和 LC\_\* 系列）。

| 变量 | 描述 |
|------|------|
| `MKVMERGE_DEBUG, MKVTOOLNIX_DEBUG 和其简短形式 MTX_DEBUG` | 内容被视为已通过 --debug 选项传递 |
| `MKVMERGE_ENGAGE, MKVTOOLNIX_ENGAGE 和其简短形式 MTX_ENGAGE` | 内容被视为已通过 --engage 选项传递 |

***

*注意：本文档基于 mkvmerge 的官方手册，已翻译为中文并使用 Markdown 格式进行美化。*
