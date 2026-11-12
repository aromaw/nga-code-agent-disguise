[中文说明](README.zh-CN.md)

# NGA Code Agent Disguise

A Tampermonkey script that shows NGA forum pages (`bbs.nga.cn`, `ngabbs.com`, `bbs.ngacn.cc`, `nga.178.com`) as a Claude Code / Codex CLI session. The rendering layer is Preact and htm, inlined, with no network dependency of its own.

## Install

1. Install [Tampermonkey](https://www.tampermonkey.net/).
2. Open [nga-code-agent-disguise.user.js](https://raw.githubusercontent.com/aromaw/nga-code-agent-disguise/main/nga-code-agent-disguise.user.js).

`@updateURL` and `@downloadURL` point at that same file on `main`.

## Keys

The disguise toggle defaults to `` ` ``. It does not run while a text field is focused, while an IME composition is in progress, or for the key-up that confirms a candidate. `togglekey f2` (or `togglekey ctrl+.` and similar) stores a different shortcut. `togglekey reset` restores the backtick.

| Key | Action |
| --- | --- |
| `` ` `` | Toggle the disguise, outside text fields |
| `Esc` | Close help or a reply draft. Otherwise show a static cover screen. `Esc` or Resume brings the thread back. |
| `Ctrl+[` | Leave the command line |
| `Tab` | Complete a command |
| Up / Down | Command history |

Vim keys are **off** until you run `vim`. With vim off, `t`, `?`, `i`, `j`, `k`, `h`, and `l` do nothing, so reading does not eat keystrokes. With vim on, and focus not in a text field:

| Key | Action |
| --- | --- |
| `j` / `k` | Scroll |
| `h` / `l` | Scroll one screen. They do not change pages. |
| `gg` / `G` | Top / bottom |
| digits | `5j` repeats. On a topic list, digits then Enter open that topic. |
| `/` | Prefill `search: ` |
| `:` or `i` | Focus the command line |
| `o` | Prefill `open ` on a list, or `search: ` in a thread |
| `t` | Cycle the theme |
| `?` | Help |
| `Ctrl+o` | Expand or collapse every post |

`next` and `prev` are what change pages. A page change drops posts that infinite scroll had already appended, which is why `h` and `l` no longer do it.

## Commands

A leading `/` is optional. `/help` and `help` are the same command.

```
help
search: <words>          this board when a fid is known
search: -g <words>       the whole site
board list
board add [name]         fid from the URL, the reply form, or the breadcrumb
board <n>                open favorite n
board fid <fid>          open a board, including a negative fid
board del <n>
next / prev / go page <n> / top
ls / open <n>
reply [text]
reply <floor> [text]
quote <floor> [text]
img / op / expand / vim / autopage / compact / pause
theme / claude / codex / dark / light
togglekey <key>
clear / exit / version / pwd / whoami
```

`img`, `op`, and `autopage` are also buttons in the status bar. The bar shows those flags and `page n of m` when the pager knows `m`. It does not show a fake context meter.

On a page with no thread and no topic list, the screen offers `help`, `board list`, and `board fid`. The favorites row stays visible when it is empty.

`compact` shortens the welcome text. It is off by default, so the hints and the favorites row stay on screen.

`whoami` prints the name from the page header. If that node is missing or it is the logged-out label, the command prints `reader`.

## Reading

- Posts are clipped to 14 lines. Each post has its own expand control. `expand` or `Ctrl+o` opens all of them.
- Images default to a `[image]` button so the page stays text. Click one to load it, or turn `img` on for lazy thumbnails. A failed image tries the link wrapped around it, then hides itself.
- URLs in the post body are links. Links on an NGA host open in this tab. Other links open in a new tab.
- `ls` lists every topic or post already loaded, not a fixed first page of 20.

## Reply and quote

`reply`, `reply <text>`, `reply <floor>`, and `quote <floor>` prepare a post as the user who is already logged in. `reply` with no text opens a multi-line box. Preview shows the body that will be sent. Nothing is submitted until you type `y`. `n` cancels. `edit` returns to the box. `Esc` cancels a pending confirm.

The submit step copies the forum's own reply form (`post.php`), including whatever hidden fields that form already has, and posts it in a hidden iframe so the browser sends the session cookie and uses the form's charset. The script does not ask for a password and does not call any other host. If the form is not on the thread page, `y` loads `post.php?action=reply` for this tid first. NGA's visible error text (login, captcha, permission, and the rest) is printed in the panel. A failed send stays unposted so `y` can retry.

## Development

```sh
npm install
npm test
```

`npm test` runs `node --test tests/disguise.test.js` with jsdom and the HTML fixtures in `tests/fixtures/`. The tests do not contact NGA. Anonymous requests to the live site return 403 from this kind of environment, so the iframe submit, charset handling, and mirror-site DOM differences have not been verified in a browser session.
