# Changelog

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
