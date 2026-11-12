[English](README.md)

# NGA Code Agent 伪装

Tampermonkey 脚本。把 NGA（`bbs.nga.cn`、`ngabbs.com`、`bbs.ngacn.cc`、`nga.178.com`）显示成 Claude Code 或 Codex CLI。

![Claude 主题下的帖子](docs/screenshots/thread-dark.png)

## 安装

1. 安装 [Tampermonkey](https://www.tampermonkey.net/)。
2. 打开 [nga-code-agent-disguise.user.js](https://raw.githubusercontent.com/aromaw/nga-code-agent-disguise/main/nga-code-agent-disguise.user.js)。

`@updateURL` 和 `@downloadURL` 指向 `main` 上的这个文件。

## 阅读

标题、楼层、作者、时间和推荐数分开显示。引用靠一条强调色的边。长楼层先显示 14 行，点击卡片或 `expand N more lines` 展开。图片默认是 `[image]`，点开一张，或用 `img` 打开懒加载缩略图。正文里的 URL 可以点。正文栏大约 92 个字符宽，宽屏幕不会把行拉得很长。提示符和状态栏留在屏幕上。

提示符上方有一排常用命令。`Tab` 补全其余命令。回复、新帖、收藏和投票都要先输入 `y` 才会发出。

## 按键

反引号 `` ` `` 切换伪装。文本框里、输入法组字时、以及确认候选词的那一下，都不会触发。`togglekey f2` 可以换成别的键。`togglekey reset` 恢复反引号。

| 按键 | 作用 |
| --- | --- |
| `` ` `` | 在文本框之外切换伪装 |
| `Esc` | 先关掉帮助或草稿，否则显示静态遮屏。再按 `Esc` 或 Resume 回来 |
| `Ctrl+[` | 离开命令行 |
| `Tab` | 补全 |
| 上 / 下 | 命令历史 |
| 点击被折叠的楼层 | 展开这一层 |

`vim` 默认关闭。打开之后，并且焦点不在文本框里：`j`/`k` 滚动，`h`/`l` 滚动一屏且不翻页，`gg`/`G` 到顶或到底，数字后按 Enter 打开列表里的帖子，`/` 预填搜索，`:` 或 `i` 聚焦命令行，`o` 预填 `open` 或 `search:`，`t` 切换主题，`?` 打开帮助，`Ctrl+o` 展开全部楼层。

翻页用 `next` 和 `prev`。

## 命令

前面的 `/` 可有可无。

```
help
ls                         列出已加载的帖子或楼层
open <n>                   打开版块列表里的第 n 帖
next · prev · go page <n> · top
floor <n>                  滚到这一层，或打开它所在的页
sort reply · sort post     按最新回复，或按最新发布
search: <词>               能确定 fid 时搜本版
search: -g <词>            全站
op                         只看楼主，并继续往后接楼主页
author <uid|名字>          用 authorid 只看这个人
author off
board list · board add [名字] · board <n> · board del <n> · board fid <fid>
bookmark · unbookmark      收藏或取消收藏当前帖。需要 y
bookmark list              本机记下的帖子，以及 NGA 的收藏页
reply [正文]
reply <楼层> [正文]
quote <楼层> [正文]
post [标题]                在当前版块发新帖。需要 y
vote <楼层>                推荐这一层。需要 y
user [uid|名字]            uid、属地、本页楼层、资料链接
whoami
noti                       从页面上的通知链接，或通知页，列出帖子
img · expand · vim · autopage · compact · pause
theme · claude · codex · dark · light · togglekey <键>
y · n · edit               发送、取消，或回到预览前的编辑
clear · exit · version · pwd
```

会改论坛数据的命令，优先用页面上已有的表单或链接。页面上没有时，才向论坛自己的地址提交：回复和新帖走 `post.php`，收藏走 `nuke.php` 的 `topic_favor`，投票走 `post_recommend`，通知和收藏列表走 `nuke.php?func=noti` 或 `thread.php?favor=1`。这些在输入 `y` 之前都不会发出。脚本不索取密码。

## 开发

```sh
npm install
npm test
```

`npm test` 运行 `node --test tests/disguise.test.js`，使用 jsdom 和 `tests/fixtures/`。测试不访问 NGA。收藏、投票、发新帖和通知没有在正式站上验证过。
