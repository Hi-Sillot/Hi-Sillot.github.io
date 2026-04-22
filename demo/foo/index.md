---
url: /demo/foo/index.md
---
[bar](./bar.md)

::: tabs

@tab ArtPlayer

@[artPlayer height="400px" auto-mini](https://artplayer.org/assets/sample/video.mp4)

@tab AcFun

@[acfun height="432px"](ac47421657)

@tab:active Bilibili

@[bilibili height="432px"](BV1ZMNQziEGd)

:::

6

6

6

6

6

6

6

6

6

6

### 三级标题

这是 foo.snippet.md 文件中的内容。

::: info
提示容器包括的内容
:::

这里是被 `<!-- region snippet -->` 包裹的内容。

通过 `<!-- @include: ./foo.snippet.md#snippet -->` 来引入。

::: tabs

@tab ArtPlayer

@[artPlayer height="400px" auto-mini](https://artplayer.org/assets/sample/video.mp4)

@tab AcFun

@[acfun height="432px"](ac47421657)

@tab:active Bilibili

@[bilibili height="432px"](BV1ZMNQziEGd)

:::

::: info
提示容器包括的内容
:::
