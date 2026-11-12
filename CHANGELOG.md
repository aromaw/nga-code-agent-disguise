# Changelog

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
