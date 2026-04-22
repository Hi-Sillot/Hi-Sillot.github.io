---
url: /release_notes/3n62qtji/index.md
---
> 主要内容摘抄自 [VSCode 1.102 发行说明](https://vscode.js.cn/updates/v1_102)，文中“我们”即 VSCode

## [中键点击滚动](https://vscode.js.cn/updates/v1_102#_scroll-on-middle-click)

设置：&#x20;

只需单击或按住鼠标中键（滚轮）并移动即可滚动编辑器。

激活后，光标会变为平移图标，然后向上或向下移动鼠标会使编辑器在该方向上平滑滚动。滚动速度由您将鼠标从初始点击点移动的距离决定。释放鼠标中键或再次单击它可停止滚动并返回标准光标。

## [允许使用 vscode.openFolder 命令打开文件](https://vscode.js.cn/updates/v1_102#_allow-opening-files-when-using-vscodeopenfolder-command)

调用 `vscode.openFolder` 命令的扩展现在可以将 `filesToOpen?: UriComponents[]` 作为选项传递，以选择要在打开的工作区窗口中打开的文件。
