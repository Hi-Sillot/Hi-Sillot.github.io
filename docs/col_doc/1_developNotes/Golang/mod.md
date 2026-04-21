---
title: mode
createTime: 2025/11/09 16:12:29
permalink: /develop_notes/mkup4ddd/
---
## 为什么某个包会被包含在模块依赖中

```bash
go mod why github.com/mitchellh/reflectwalk # 这个命令会显示一个依赖链
```

## `checksum mismatch` 问题

使用代理时有概率遇到，比如：

```log
go: github.com/OpenListTeam/OpenList/v4/internal/fuse imports
        github.com/winfsp/cgofuse/fuse: github.com/winfsp/cgofuse@v1.6.0: verifying module: checksum mismatch
        downloaded: h1:1KsCph+bQkKPS33bFyh4/9TDGf6jVTE0OcglSL0OnyM=
        sum.golang.org: h1:re3W+HTd0hj4fISPBqfsrwyvPFpzqhDu8doJ9nOPDB0=
```

我看网上教程都是清理缓存更换代理之类的，但是没必要这么麻烦，直接临时禁用校验并直接下载出问题的包即可：

```bash
GOPROXY=direct GOSUMDB=off go mod download github.com/winfsp/cgofuse@v1.6.0
```

```powershell
$env:GOPROXY="direct"; $env:GOSUMDB="off"; go mod download github.com/winfsp/cgofuse@v1.6.0
```
