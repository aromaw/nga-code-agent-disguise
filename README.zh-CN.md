[English](README.md)

# NGA Code Agent 伪装

Tampermonkey 脚本。把 NGA 论坛页面（`bbs.nga.cn`、`ngabbs.com`、`bbs.ngacn.cc`、`nga.178.com`）显示成 Claude Code / Codex CLI 会话。渲染层是内联的 Preact 和 htm，脚本自己不依赖外部网络。

## 安装

1. 安装 [Tampermonkey](https://www.tampermonkey.net/)。
2. 打开 [nga-code-agent-disguise.user.js](https://raw.githubusercontent.com/aromaw/nga-code-agent-disguise/main/nga-code-agent-disguise.user.js)。

`@updateURL` 和 `@downloadURL` 指向 `main` 上的同一个文件。

## 按键

伪装开关默认是反引号 `` ` ``。焦点在文本框里、输入法正在组字、以及确认候选词的那一下，都不会触发。`togglekey f2`（或 `togglekey ctrl+.` 这类组合）可以换成别的键。`togglekey reset` 恢复反引号。

| 按键 | 作用 |
| --- | --- |
| `` ` `` | 在文本框之外切换伪装 |
| `Esc` | 先关掉帮助或回复草稿；否则显示一张静态遮屏。再按 `Esc` 或 Resume 回到帖子。 |
| `Ctrl+[` | 离开命令行 |
| `Tab` | 补全命令 |
| 上 / 下 | 命令历史 |

Vim 键位**默认关闭**，输入 `vim` 才打开。关闭时 `t`、`?`、`i`、`j`、`k`、`h`、`l` 都不会生效，阅读时不会被单字母打断。打开之后，且焦点不在文本框里：

| 按键 | 作用 |
| --- | --- |
| `j` / `k` | 滚动 |
| `h` / `l` | 滚动一屏。它们不翻页。 |
| `gg` / `G` | 顶部 / 底部 |
| 数字 | `5j` 重复滚动。版块列表里，数字后按 Enter 打开对应帖子。 |
| `/` | 预填 `search: ` |
| `:` 或 `i` | 聚焦命令行 |
| `o` | 列表页预填 `open `，帖子页预填 `search: ` |
| `t` | 循环主题 |
| `?` | 帮助 |
| `Ctrl+o` | 展开或收起全部楼层 |

真正翻页的是 `next` 和 `prev`。翻页会丢掉无限滚动已经接在下面的内容，所以 `h` 和 `l` 不再做这件事。

## 命令

命令前面的 `/` 可有可无。`/help` 和 `help` 是同一条命令。

```
help
search: <词>             能确定 fid 时搜本版
search: -g <词>          全站
board list
board add [名字]         fid 来自网址、回帖表单或面包屑
board <n>                打开第 n 个收藏
board fid <fid>          按 fid 打开版块，可以是负数
board del <n>
next / prev / go page <n> / top
ls / open <n>
reply [正文]
reply <楼层> [正文]
quote <楼层> [正文]
img / op / expand / vim / autopage / compact / pause
theme / claude / codex / dark / light
togglekey <键>
clear / exit / version / pwd / whoami
```

状态栏上的 `img`、`op`、`autopage` 也可以直接点。状态栏显示这几项，以及分页条能算出总页数时的 `page n of m`。不再显示假的上下文百分比。

没有帖子也没有版块列表的页面会给出 `help`、`board list` 和 `board fid`。收藏栏在空的时候也还在。

`compact` 缩短欢迎文字。默认关闭，所以提示和收藏栏留在屏幕上。

`whoami` 读取页面头部里的用户名。找不到，或者那个位置是未登录的字样，就显示 `reader`。

## 阅读

- 楼层默认显示 14 行。每一层可以单独展开。`expand` 或 `Ctrl+o` 展开全部。
- 图片默认是 `[image]` 按钮，页面保持文字。点一个就加载那一张；`img` 打开后用懒加载缩略图。主图失败会试外层链接，再失败就隐藏。
- 正文里的 URL 可以点。NGA 域名在当前标签打开，其他链接开新标签。
- `ls` 列出已经加载的全部帖子或楼层，不再只给前 20 条。

## 回复和引用

`reply`、`reply <正文>`、`reply <楼层>` 和 `quote <楼层>` 用当前已经登录的身份准备一帖。不带正文的 `reply` 打开多行输入。预览里是将要发出的正文。输入 `y` 之前不会提交。`n` 取消。`edit` 回到编辑。`Esc` 取消待确认的回复。

提交时复制页面自己的回帖表单（`post.php`），连同表单里已有的隐藏字段，放到隐藏 iframe 里提交，由浏览器带上会话 cookie 并按表单的字符集编码。脚本不索取密码，也不请求别的网站。帖子页上没有表单时，`y` 会先打开这个 tid 的 `post.php?action=reply`。NGA 页面上能看见的错误（未登录、验证码、权限等）会显示在面板里。失败的话帖子没有发出去，可以再按 `y` 重试。

## 开发

```sh
npm install
npm test
```

`npm test` 运行 `node --test tests/disguise.test.js`，用 jsdom 和 `tests/fixtures/` 里的 HTML。测试不访问 NGA。这类环境里对正式站的匿名请求会 403，所以 iframe 提交、字符集，以及镜像站的 DOM 差异，还没有在真实浏览器会话里验证过。
