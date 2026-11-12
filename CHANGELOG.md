# Changelog

## 4.1.2

Favorite titles and author names were garbled or missing because NGA serves GBK, and some fetches decoded the body as UTF-8.

### Fixed

- Every fetch now decodes the body with `TextDecoder('gbk')` via `arrayBuffer`, using the response charset or an HTML meta tag as a hint. UTF-8 is only kept when it decodes cleanly. The favor-page fetch, ucp GETs, authorid pages, notifications, and next-page loads all share this path. Calling `response.text()` or `response.json()` is no longer used for NGA responses.
- The ucp name GET follows NGA's own `__API.userInfo`: `/nuke.php?__lib=ucp&__act=get&lite=js&uid=`, then `/nuke.php?__lib=ucp&__act=get&uid=&__output=8` if the first body does not parse. `__output=11` JSON may be prefixed with `window.script_muti_get_var_store=`; that prefix is stripped before `JSON.parse`. Requests are GET only, with `credentials: 'include'`, one at a time, and still at most one successful cache write per uid.

### Added

- Hidden command `debug names` (not in the slash menu). It prints how many authors are resolved vs. unresolved, then for the first unresolved uid: the attempted URL, HTTP status, content-type, the first 300 characters of the decoded body, and the parse error if any.

## 4.1.1

Fixes from a logged-in live test of 4.1.0. Parsing follows NGA's own `commonui.postArg`, attachment lists, and user-info data.

### Fixed

- Quote and vote cards no longer show `pid 0` on later pages. Reply pids come from `commonui.postArg.proc`, which survives NGA's hydration. A non-zero DOM pid is preferred over a parent form's `pid=0`. The original post is genuinely pid 0 and stays that way.
- Author names that the dump stores as `UID:…` are resolved from `commonui.userInfo` (including hex-encoded `uuname`), from a later hydrated `a.author` / `#postauthorN`, and, if those are still empty, from a read-only same-origin GET to NGA's ucp endpoint (`nuke.php?__act=get&__lib=ucp`). Names are cached; at most one GET is sent per uid; nothing is POSTed.
- With `img on`, floors that only showed leftover numerals ("3", "4") now show thumbnails. Sources are `data-srclazy` / `data-srcorg`, `[img]` BBCode (including `./mon_…` paths), and `ubbcode.attach.load`. Relative paths get the `https://img.nga.cn/attachments/` prefix.
- `op` on a page that has no original-poster posts uses `postArg.setDefault`'s topic-author uid (`tAid`) and fetches NGA's `authorid` view. The status counts visible OP posts only. It no longer shows an empty list, "End of pages", and a thread-wide count.
- The sidebar's Favorites list comes from a cached, read-only GET of `thread.php?favor=1`. Recent threads are labeled Recent, and are not mixed into Favorites.
- A quote shows the original time when that time is in the markup or in `postArg` on the same page. The main column is 110ch on wide screens (was 92ch).

### Added

- Tests for postArg pids after a hydrated DOM, ucp name fetching, lazy and BBCode images, `op` on page 2, and the Favorites / Recent split.

## 4.1.0

Parsing follows the live NGA DOM. The overlay was tested against saved logged-in pages, and the boss-key cover, slash menu, and sidebar are the ones those pages need.

### Fixed

- Posts were counted twice: the parser read both `table.forumbox.postbox` and the nested `td#postcontainerN`. It now keeps one box per floor.
- Author names are taken from the author link, quote `userlink`s, and `commonui.userInfo` when that object holds a real name. Bare numeric leftovers from a `UID:` label are not used as a display name. Names that NGA itself has not hydrated stay as `UID:…` until the page fills them in.
- Quote headers show the quoted author and the time when the page has one. A "Reply to + R by [name]" line that is not wrapped in `.quote` is treated as a quote. `+R`, empty brackets, a leftover timestamp, and a leading zero-width space are stripped from the body.
- The sidebar lists the current board, that board's sub-forums, saved boards, favorites from the favor page, and recent threads. It no longer picks up every forum link on the page. The board name drops NGA's spaced-out `&nbsp;` letters (`网事杂谈`, not `网 事 杂 谈`). Horizontal overflow is clipped.
- The Esc cover is a full-viewport editor: a file tree, tabs, a numbered diff, and a status bar. The sidebar and the top bar are hidden while it is up.
- Typing `/` opens a command menu that filters as you type. Arrow keys move, Enter selects (and runs a command that takes no argument), Tab completes `/he` to `/help`.
- Search drops the placeholder rows titled `帖子发布或回复时间超过限制`. Reply counts come from `commonui.topicArg.add`, not from the unhydrated `0` in the table cell.
- Author-filter floors come from `lN`, `postcontainerN`, and `postauthorN`, not from the row index, so floor 1 is `#1`.
- The backtick that opens the overlay is not inserted into the composer.
- Post text and metadata are larger and higher-contrast.

### Added

- jsdom tests for the live markup (`tests/fixes.test.js`, sanitized fixtures) and a dump harness (`tests/dumps.test.js`) that runs when `/workspace/nga-dom` is present.
- `npm run shots` takes Playwright screenshots of the overlay against those dumps.

## 4.0.0

The overlay is a desktop chat app, not a terminal. Parsing follows live NGA markup.

### Changed

- Left sidebar for boards and bookmarks, main pane for the thread, top bar for the board, title, page, and sort or filter pills, and a multi-line composer with a Send button.
- Slash chips insert real commands (`/help`, `/reply`, `/board`, and the rest). `boards` runs `board list`.
- Help and previews sit in the scrolling main pane. Confirm is a card with Send and Cancel, and `y` / `n` still work.
- The Esc cover is a dark code-review session. Backtick does not toggle while the composer is focused. Opening the overlay focuses the composer.
- Post text drops a leading indent. Quotes show author and time, not `+R` or `undefined`. Recommend scores keep a minus sign. Long posts collapse by line count and by length.

### Fixed

- Pid comes from `pid…Anchor` and `pid=` links, including links beside the post.
- `author` and `op` are separate. `author off` clears the author filter and turns `op` off.
- `user` shows the name from the page or from `nuke.php` ucp data, plus a profile link.
- `bookmark list` links open the thread. Bookmark actions ignore the favorites-list URL.
- Cancel copy names the action (`Bookmark cancelled`, `Vote cancelled`, `New thread cancelled`).

## 3.1.0

A cleaner terminal shell, and more of the forum inside it.

### Changed

- Reading text sits in a 92-character column. Posts are cards: floor, author, time, recommend count, a quote bar, and an expand row. Click a collapsed post to open it.
- A hint row above the prompt lists `help`, `reply`, `quote`, `post`, `search:`, `boards`, `sort`, and `noti`. Tab still completes.

### Added

- `sort reply` and `sort post` follow the board's own sort links, or `order_by=lastpostdesc` / `order_by=postdatedesc`.
- `floor <n>` scrolls to a loaded floor, or opens the page that should contain it (20 floors per page, or the floor's pid when it is already loaded).
- `author <uid|name>` and `author off` use NGA's `authorid` filter. `op` is still the original-poster toggle.
- `user [uid|name]` prints the uid, location, loaded floors, and a profile link. Author names show the same tip on hover.
- `post [title]` starts a new thread. `vote <floor>` recommends a floor. `bookmark`, `unbookmark`, and `bookmark list` save a thread. Each of those waits for `y`.
- `noti` reads the notification link on the page, or `nuke.php?func=noti`, and lists the threads it finds.

## 3.0.0

Reading and replies. The disguise is usable with the keyboard, and a reply is posted only after an explicit confirm, through the forum's own form.

### Added

- `reply` and `quote` compose a post, show a preview, and submit only after `y`. The request is the page's own `post.php` form, including its hidden fields. NGA's error text is shown in the terminal.
- Per-post expand, click-to-open images, lazy thumbnails when images are on, and clickable URLs in post bodies.
- Help and other command output sit in a panel above the prompt instead of being appended under a long thread.
- The status bar shows image, original-poster, infinite-scroll, and page state.
- An idle page offers `help`, `board list`, and `board fid`. The favorites bar stays visible when it is empty.
- `board add` reads the board id from the URL, the reply form, or the breadcrumb.
- A leading `/` is accepted on commands, so `/help` works.
- `togglekey` changes the disguise shortcut. `Esc` covers the screen with a static example. `compact` shortens the chrome.
- jsdom tests and saved HTML fixtures for extraction, commands, keys, board ids, and reply payloads.

### Fixed

- The Esc cover hides the thread, prompt, and reply panel inside the shell wrapper.
- That wrapper is a full-height column, so a long thread scrolls and the prompt stays on screen.
- A next-page fetch that hits the 15s deadline shows the retry state instead of staying on "Loading".

### Changed

- Version 3.0.0. `@author` and `@namespace` are this repository. `@updateURL` and `@downloadURL` point at `main`.
- Vim keys default to off. While they are on, `h` and `l` scroll the terminal and do not change pages.
- Single-letter shortcuts do not run while vim is off, inside a text field, or during IME composition.
- `whoami` uses the name in the page header, or `reader` when that name is not there.
- `ls` lists every loaded topic and post.
- User-visible script text and code comments are English. `README.md` is English and `README.zh-CN.md` is Chinese.

### Ported from draft PR #1

Input-method guards, the Esc cover, trimmed `compact` hints (default off), per-post expand, lazy-image extraction, stable post ids, author-page overlap, cancellable page fetches, a private Preact scope, remounting the overlay, and a startup guard if the input never appears.
