# NGA Code Agent 伪装

把 NGA 论坛页面伪装成 Claude Code / Codex CLI 终端会话的 Tampermonkey 脚本 —— 旁人看来你在用 code agent 调试项目，实际上你在刷论坛。

渲染层基于 Preact + htm（已内联，无外部依赖），全量 diff 渲染，滚动 / 焦点 / 图片加载状态在刷新间自动保留。

## 安装

1. 安装 [Tampermonkey](https://www.tampermonkey.net/) 浏览器扩展
2. 点击安装：[nga-code-agent-disguise.user.js](https://raw.githubusercontent.com/aromaw/nga-code-agent-disguise/main/nga-code-agent-disguise.user.js)

适配站点：`bbs.nga.cn` · `ngabbs.com` · `bbs.ngacn.cc` · `nga.178.com`

## 基本操作

| 按键 | 作用 |
| --- | --- |
| `` ` ``（反引号） | 一键切换伪装 / 原始页面 |
| `?` | 帮助 |
| `t` | 循环切换主题（claude/codex × dark/light） |
| `i` | 聚焦底部输入框 |
| `Tab` | 命令补全（多候选时列出） |
| `↑` / `↓` | 命令历史 |

## 命令（底部输入栏）

```
search: <关键词>      本版搜索（在板块页时自动限定 fid）
search: -g <关键词>   全站搜索
board list            收藏板块列表（页面顶部 boards: 栏也可直接点击切换）
board add [名字]      收藏当前板块
board <n>             跳转到收藏的第 n 个板块
board del <n>         删除收藏
board fid <fid>       按 fid 直达板块
next page / prev page 下一页 / 上一页（帖子与列表通用）
go page <n>           跳到第 n 页
open <n>              打开板块页第 n 帖
ls                    列出当前内容
autopage              无限滚动：滚到底自动抓取下一页，内容接在下方继续滑动
img / op / expand     显示图片 / 只看楼主 / 展开截断
theme / dark / light  主题切换
clear                 清空命令回显
exit                  退出伪装（同 ` 键）
```

## vim 键位（默认开启，`vim` 命令切换）

| 按键 | 作用 |
| --- | --- |
| `j` / `k` | 向下 / 向上滚动 |
| `h` / `l` | 上一页 / 下一页 |
| `gg` / `G` | 顶部 / 底部 |
| 数字前缀 | 如 `5j` 滚动 5 倍行距；板块页 `数字 + Enter` 直接开帖 |
| `/` | 预填 `search: ` 并聚焦输入框 |
| `:` | 聚焦输入框（不会显示冒号） |
| `o` | 板块页预填 `open `，帖子页预填 `search: ` |
| `ctrl+o` | 展开 / 收起截断楼层 |

## 其他特性

- 无限滚动：滚到底自动抓取下一页内容追加在下方（带 ── page N ── 分隔线，到底 / 失败有状态提示），帖子与板块列表通用
- 双风格：Claude Code（欢迎框 + ❯ 提示符）与 Codex CLI（user/codex 对话块 + banner），各含明暗两套配色
- 热点回复单独区块展示，OP 反色徽章，IP 属地显示（nuke.php 接口 + 本地缓存）
- 图片原位渲染（占位 token 插回原文位置），主源失败自动回退备胎链接
- 伪 shell 工作目录随页面变化（`~/boards/xxx`、`~/threads/xxx`），标题栏 / favicon 同步伪装
- 设置（主题、图片、只看楼主、vim、autopage、收藏板块等）全部 GM 持久化
