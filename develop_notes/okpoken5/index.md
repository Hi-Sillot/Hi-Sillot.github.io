---
url: /develop_notes/okpoken5/index.md
---
> https://github.blog/changelog/2021-02-08-github-actions-skip-pull-request-and-push-workflows-with-skip-ci/

GitHub Actions 现在通过在提交消息中查找一些常见关键字来支持跳过 push 和 pull\_request 工作流。

\*\[GitHub Actions 现在通过在提交消息中查找一些常见关键字来支持跳过 push 和 pull\_request 工作流]: GitHub Actions now supports skipping push and pull\_request workflows by looking for some common keywords in your commit message.

如果推送或 PR 的 HEAD 提交中的任何提交消息包含字符串 `[skip ci]` 、 `[ci skip]`、`[no ci]` 、 `[skip actions]` 或 `[actions skip]` 触发的 push 或 pull\_request 事件的工作流将被跳过。\[+jd2938yr1r23t34]

\[+jd2938yr1r23t34]: If any commit message in your push or the HEAD commit of your PR contains the strings `[skip ci]`, `[ci skip]`, `[no ci]`, `[skip actions]`, or `[actions skip]` workflows triggered on the push or pull\_request events will be skipped.
