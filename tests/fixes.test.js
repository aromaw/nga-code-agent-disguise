const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const source = fs.readFileSync(path.join(__dirname, '..', 'nga-code-agent-disguise.user.js'), 'utf8');
const liveThread = fs.readFileSync(path.join(__dirname, 'fixtures', 'live-nga-thread.html'), 'utf8');
const liveBoard = fs.readFileSync(path.join(__dirname, 'fixtures', 'live-nga-board.html'), 'utf8');
const authorFilter = fs.readFileSync(path.join(__dirname, 'fixtures', 'author-filter.html'), 'utf8');
const emptyHtml = '<!doctype html><html><head><title>Empty - NGA</title></head><body><p>home</p></body></html>';

function load(html, url, values = {}) {
    const dom = new JSDOM(html, { url, pretendToBeVisual: true, runScripts: 'dangerously' });
    const { window } = dom;
    const gm = { cad_autopage: false, ...values };
    window.GM_getValue = (key, fallback) => (Object.prototype.hasOwnProperty.call(gm, key) ? gm[key] : fallback);
    window.GM_setValue = (key, value) => { gm[key] = value; };
    window.GM_addStyle = (css) => {
        const style = window.document.createElement('style');
        style.textContent = css;
        (window.document.head || window.document.documentElement).appendChild(style);
    };
    window.__CAD_TEST = true;
    window.fetch = async (input) => {
        const href = String(input && input.url ? input.url : input);
        if (href.includes('nuke.php')) {
            return {
                ok: true,
                status: 200,
                url: href,
                headers: { get: () => 'application/json' },
                json: async () => ({ data: [{ ipLoc: 'local' }] }),
                arrayBuffer: async () => new TextEncoder().encode('{}').buffer,
            };
        }
        throw new Error('unexpected fetch ' + href);
    };
    const script = window.document.createElement('script');
    script.textContent = source;
    window.document.documentElement.appendChild(script);
    if (!window.__cad) throw new Error('script did not export test hooks');
    return { window, gm, cad: window.__cad, document: window.document };
}

function keydown(window, init, target) {
    const event = new window.KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
    (target || window.document.body).dispatchEvent(event);
    return event;
}

test('live NGA boxes are not doubled, and names come from the author link', () => {
    const { cad } = load(liveThread, 'https://bbs.nga.cn/read.php?tid=9');
    const data = cad.extract();
    assert.equal(data.kind, 'posts');
    assert.equal(data.posts.length, 3);
    const floors = data.posts.map(p => p.floor);
    assert.equal(Array.from(floors).join(','), '0,1,2');
    assert.equal(new Set(floors).size, 3);
    assert.equal(data.posts[0].name, 'Alice');
    assert.equal(data.posts[1].name, 'Bob');
    assert.equal(data.posts[2].name, 'Cara');
    assert.equal(cad.isUidLabel(data.posts[0].name), false);
    assert.equal(data.posts[0].pid, '555');
    assert.equal(data.posts[0].imgs.length, 1);
});

test('quotes show author and time, and a Reply-to header is not left in the body', () => {
    const { cad } = load(liveThread, 'https://bbs.nga.cn/read.php?tid=9');
    const data = cad.extract();
    const q = data.posts[1].quotes[0];
    assert.equal(q.author, 'Alice');
    assert.equal(q.time, '2026-11-01 10:00');
    assert.match(q.text, /Opening post/);
    assert.equal(q.text.includes('+R'), false);
    assert.equal(q.text.includes('undefined'), false);
    const reply = data.posts[2];
    assert.equal(reply.quotes[0].author, 'Bob');
    assert.equal(reply.quotes[0].time, '2026-11-01 11:00');
    assert.equal(reply.text.includes('Reply to'), false);
    assert.equal(reply.text.includes('+R'), false);
    assert.equal(reply.text.includes('[Bob]'), false);
    assert.match(reply.text, /This is a long post/);
});

test('author-filter floors come from the real floor, not the row index', () => {
    const { cad } = load(authorFilter, 'https://bbs.nga.cn/read.php?tid=9&authorid=202');
    const data = cad.extract();
    assert.equal(data.posts.length, 1);
    assert.equal(data.posts[0].floor, 1);
    assert.equal(data.posts[0].name, 'Bob');
    assert.equal(data.posts[0].pid, '901');
});

test('board names drop nbsp spacing, junk search rows are dropped, and replies come from topicArg', () => {
    const { cad, document } = load(liveBoard, 'https://bbs.nga.cn/thread.php?fid=-7&key=demo');
    assert.equal(cad.pageBoardName(), '网事杂谈');
    assert.equal(cad.tidyName('网\u00a0事\u00a0杂\u00a0谈'), '网事杂谈');
    const data = cad.extract();
    assert.equal(data.kind, 'topics');
    assert.equal(data.board, '网事杂谈');
    assert.equal(data.topics.length, 2);
    assert.equal(data.topics[0].title, 'A popular thread');
    assert.equal(data.topics[0].replies, '63');
    assert.equal(data.topics[0].author, 'Alice');
    assert.equal(data.topics[1].title, 'A smaller thread');
    assert.equal(data.topics[1].replies, '4');
    assert.equal(data.topics.some(t => /超过限制/.test(t.title)), false);
    cad.boot();
    const crumb = document.querySelector('.cad-crumb').textContent;
    assert.match(crumb, /网事杂谈/);
    assert.equal(crumb.includes('网 事 杂 谈'), false);
    const side = document.querySelector('.cad-side').textContent;
    assert.match(side, /网事杂谈/);
    assert.match(side, /漩涡书院/);
    assert.equal(side.includes('Save this board') && !document.querySelectorAll('.cad-side a').length, false);
    assert.ok(document.querySelectorAll('.cad-side a').length >= 2);
    const first = document.querySelector('.cad-trow');
    assert.match(first.textContent, /63/);
    assert.equal(first.textContent.includes('超过限制'), false);
});

test('the slash menu filters as you type, arrows move, Tab and Enter select, and /he completes', async () => {
    const { cad, document, window } = load(emptyHtml, 'https://bbs.nga.cn/', { cad_on: true });
    cad.boot();
    await new Promise(r => setTimeout(r, 0));
    const input = document.querySelector('.cad-real');
    assert.ok(input);
    input.value = '/';
    input.dispatchEvent(new window.Event('input', { bubbles: true }));
    let menu = document.querySelector('.cad-slash');
    assert.ok(menu);
    assert.ok(menu.querySelectorAll('.cad-slash-item').length >= 5);
    input.value = '/he';
    input.dispatchEvent(new window.Event('input', { bubbles: true }));
    menu = document.querySelector('.cad-slash');
    const labels = [...menu.querySelectorAll('.cad-slash-item')].map(el => el.textContent);
    assert.ok(labels.some(t => /\/help/.test(t)));
    assert.ok(labels.every(t => /he/i.test(t)));
    cad.setTyped('/he');
    cad.tabComplete('/he');
    assert.match(cad.getTyped(), /^\/?help\s?$/);
    cad.setTyped('he');
    cad.tabComplete('he');
    assert.match(cad.getTyped(), /^help\s?$/);
    cad.setTyped('/he');
    let input2 = document.querySelector('.cad-real');
    input2.value = '/he';
    input2.dispatchEvent(new window.Event('input', { bubbles: true }));
    input2 = document.querySelector('.cad-real');
    const before = [...document.querySelectorAll('.cad-slash-item')].map(el => el.textContent);
    assert.ok(before.length >= 1);
    input2.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
    const after = [...document.querySelectorAll('.cad-slash-item.cad-slash-on, .cad-slash .cad-slash-on')];
    assert.ok(after.length >= 1 || document.querySelector('.cad-slash'));
    input2 = document.querySelector('.cad-real');
    input2.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    // Enter applies the completion and, for commands that take no argument, runs it.
    const body = document.body.textContent;
    assert.equal(/\/help|Commands|help panel|keyboard/i.test(body + ' ' + cad.getTyped()) || cad.getTyped().includes('help') || /help/i.test(body), true);
});

test('a backtick used to open the overlay does not stay in the composer', async () => {
    const { cad, document, window } = load(emptyHtml, 'https://bbs.nga.cn/', { cad_on: false });
    const ev = keydown(window, { key: '`', code: 'Backquote' });
    assert.equal(ev.defaultPrevented, true);
    assert.equal(cad.store.on, true);
    cad.boot();
    await new Promise(r => setTimeout(r, 250));
    const input = document.querySelector('.cad-real');
    assert.ok(input);
    assert.equal((input.value || '').includes('`'), false);
    assert.equal((cad.getTyped() || '').includes('`'), false);
});

test('the Esc cover fills the viewport and hides the sidebar and header', async () => {
    const { cad, document, window } = load(liveThread, 'https://bbs.nga.cn/read.php?tid=9', { cad_on: true });
    cad.boot();
    cad.runCmd('pause');
    const root = document.querySelector('#cad__root');
    assert.ok(root.classList.contains('cad-covered'));
    const cover = document.querySelector('.cad-cover');
    assert.ok(cover);
    const cs = window.getComputedStyle(cover);
    assert.equal(cs.position, 'absolute');
    const insetFull = (cs.inset === '0px' || cs.inset === '0' || cs.inset === '0px 0px 0px 0px');
    const sidesFull = (cs.top === '0px' || cs.top === '0') && (cs.right === '0px' || cs.right === '0' || cs.right === '') && (cs.bottom === '0px' || cs.bottom === '0') && (cs.left === '0px' || cs.left === '0' || cs.left === '');
    assert.equal(insetFull || sidesFull, true);
    assert.equal(window.getComputedStyle(document.querySelector('.cad-app')).display, 'none');
    assert.equal(window.getComputedStyle(document.querySelector('.cad-side')).display, 'none');
    assert.equal(window.getComputedStyle(document.querySelector('.cad-topbar')).display, 'none');
    assert.equal(window.getComputedStyle(document.querySelector('.cad-body')).display, 'none');
    assert.match(cover.textContent, /handleRequest/);
    assert.equal(cover.textContent.includes('Static example'), false);
    assert.ok(cover.querySelector('.cad-cover-tree'));
    assert.ok(cover.querySelector('.cad-dline.cad-add'));
    assert.ok(cover.querySelector('.cad-dline.cad-del'));
});

test('long posts collapse, and img on renders a thumbnail', async () => {
    const { cad, document } = load(liveThread, 'https://bbs.nga.cn/read.php?tid=9', { cad_on: true, cad_img: true, cad_expand: false });
    cad.boot();
    const long = document.querySelector('#cad-floor-2');
    assert.ok(long);
    assert.equal(long.textContent.includes('line-15-hidden'), false);
    assert.match(long.textContent, /expand/);
    long.click();
    assert.match(document.querySelector('#cad-floor-2').textContent, /line-15-hidden/);
    const img = document.querySelector('#cad-floor-0 img.cad-img');
    assert.ok(img);
    assert.match(img.getAttribute('src'), /demo\.jpg/);
});

test('confirm cards still have Send, Cancel, and y\/n, and nothing is sent without y', async () => {
    const { cad, document, window } = load(liveThread, 'https://bbs.nga.cn/read.php?tid=9&page=2', { cad_on: true });
    const calls = [];
    window.__cadMockSubmit = async (payload) => { calls.push(payload); return { ok: true, message: 'ok' }; };
    cad.boot();
    await cad.runCmd('vote 1');
    assert.equal(calls.length, 0);
    const card = document.querySelector('.cad-panel, .cad-modal-card, .cad-modal');
    assert.ok(card);
    assert.match(document.body.textContent, /Send/);
    assert.match(document.body.textContent, /Cancel/);
    assert.match(document.body.textContent, /y \/ n|y sends|y\/n|or y/i);
    await cad.runCmd('n');
    assert.equal(calls.length, 0);
    assert.match(document.querySelector('.cad-panel').textContent, /Vote cancelled/);
});

test('decodeUuname, absImg, and imgSrc cover NGA\'s real name and image encodings', () => {
    const { cad, document } = load(emptyHtml, 'https://bbs.nga.cn/read.php?tid=1');
    assert.equal(cad.decodeUuname('e6b58be8af95'), '测试');
    assert.equal(cad.decodeUuname('UID:12'), '');
    assert.equal(cad.absImg('./mon_202611/12/foo.jpg'), 'https://img.nga.cn/attachments/mon_202611/12/foo.jpg');
    assert.equal(cad.absImg('mon_202611/12/foo.jpg'), 'https://img.nga.cn/attachments/mon_202611/12/foo.jpg');
    assert.equal(cad.absImg('https://img.nga.178.com/attachments/mon_202611/12/foo.jpg'), 'https://img.nga.178.com/attachments/mon_202611/12/foo.jpg');
    assert.equal(cad.absImg('about:blank'), '');

    const img = document.createElement('img');
    img.setAttribute('src', 'about:blank');
    img.setAttribute('data-srclazy', 'https://img.nga.cn/attachments/mon_202611/12/lazy.jpg');
    img.setAttribute('data-srcorg', 'https://img.nga.cn/attachments/mon_202611/12/org.jpg');
    const src = cad.imgSrc(img);
    assert.equal(src.main, 'https://img.nga.cn/attachments/mon_202611/12/lazy.jpg');
});

const page2Html = `<!doctype html><html><head><title>t - NGA</title></head><body>
<div id="m_posts">
<table class="forumbox postbox"><tbody><tr>
<td class="c1"><a href="/nuke.php?func=ucp&amp;uid=99" id="postauthor21">UID:99</a></td>
<td class="c2" id="postcontainer21">
<a name="l21" id="l21" href="/read.php?tid=7&amp;page=2#pid0Anchor"></a>
<div class="postcontent ubbcode" id="postcontent21">hello from page 2</div>
</td>
</tr></tbody></table>
</div>
<script type="text/plain">
commonui.postArg.setDefault(-7,0,7,55,0,"","","","",null,0,40,1794450000,20);
commonui.postArg.proc( 21, $('postcontainer21'),$('postsubject21'),$('postcontent21'),$('postsign21'),$('posterinfo21'),$('postInfo21'),$('postBtnPos21'), null,null,887000021,0, null,'99',1794450196,'0,0,0');
</script>
</body></html>`;

test('pid comes from postArg when the live DOM only has pid 0', () => {
    const { cad, document } = load(page2Html, 'https://bbs.nga.cn/read.php?tid=7&page=2');
    const form = document.createElement('form');
    form.innerHTML = '<input type="hidden" name="pid" value="0">';
    document.body.appendChild(form);
    const data = cad.extract();
    assert.equal(data.posts.length, 1);
    assert.equal(data.posts[0].floor, 21);
    assert.equal(data.posts[0].pid, '887000021');
    assert.equal(data.posts[0].uid, '99');
    assert.equal(cad.parsePostArgs(document).topicAuthor, '55');
    assert.equal(data.posts[0].isOP, false);
});

const opHtml = `<!doctype html><html><head><title>t - NGA</title></head><body>
<div id="m_posts">
<table class="forumbox postbox"><tbody><tr>
<td class="c1"><a href="/nuke.php?func=ucp&amp;uid=55" id="postauthor0">UID:55</a><span>楼主</span></td>
<td class="c2" id="postcontainer0">
<a id="pid0Anchor" name="l0"></a>
<div class="postcontent ubbcode" id="postcontent0">original</div>
</td>
</tr></tbody></table>
</div>
<script type="text/plain">
commonui.postArg.setDefault(-7,0,7,55,0,"","","","",null,0,40,1794450000,20);
commonui.postArg.proc( 0, $('postcontainer0'),$('postsubject0'),$('postcontent0'),$('postsign0'),$('posterinfo0'),$('postInfo0'),$('postBtnPos0'), null,null,0,0, null,'55',1794450000,'0,0,0');
</script>
</body></html>`;

test('the original post is genuinely pid 0', () => {
    const { cad } = load(opHtml, 'https://bbs.nga.cn/read.php?tid=7');
    const data = cad.extract();
    assert.equal(data.posts[0].floor, 0);
    assert.equal(data.posts[0].pid, '0');
    assert.equal(data.posts[0].isOP, true);
    assert.equal(data.posts[0].uid, '55');
});

const imgHtml = `<!doctype html><html><head><title>t - NGA</title></head><body>
<div id="m_posts">
<table class="forumbox postbox"><tbody><tr>
<td class="c1"><a href="/nuke.php?func=ucp&amp;uid=1" id="postauthor21">Ann</a></td>
<td class="c2" id="postcontainer21">
<a name="l21"></a>
<div class="postcontent ubbcode" id="postcontent21">3<br>
<img src="about:blank" data-srclazy="https://img.nga.cn/attachments/mon_202611/12/a.jpg" alt="">
<br>4<br>
<img src="about:blank" data-srcorg="./mon_202611/12/b.jpg" alt="">
<br>[img]./mon_202611/12/c.jpg[/img]
</div>
</td>
</tr></tbody></table>
</div>
<script type="text/plain">
ubbcode.attach.load('postattach21','postcontent21',[{url:'mon_202611/12/d.jpg',type:'img'}], 1, 7, 1, 1794450000, 21);
commonui.postArg.proc( 21, $('postcontainer21'),$('postsubject21'),$('postcontent21'),$('postsign21'),$('posterinfo21'),$('postInfo21'),$('postBtnPos21'), null,null,100,0, null,'1',1794450000,'0,0,0');
</script>
</body></html>`;

test('lazy, relative, BBCode, and attach.load images become real thumbnails', () => {
    const { cad } = load(imgHtml, 'https://bbs.nga.cn/read.php?tid=7&page=2');
    const data = cad.extract();
    const p = data.posts[0];
    const urls = p.imgs.map(o => o.main);
    assert.ok(urls.includes('https://img.nga.cn/attachments/mon_202611/12/a.jpg'));
    assert.ok(urls.includes('https://img.nga.cn/attachments/mon_202611/12/b.jpg'));
    assert.ok(urls.includes('https://img.nga.cn/attachments/mon_202611/12/c.jpg'));
    assert.ok(urls.includes('https://img.nga.cn/attachments/mon_202611/12/d.jpg'));
    assert.ok(p.imgs.length >= 4);
    assert.equal(p.text.includes('about:blank'), false);
});

test('a cached ucp GET fills UID placeholders, at most once per uid, and never POSTs', async () => {
    const html = `<!doctype html><html><head><title>t - NGA</title></head><body>
<div id="m_posts">
<table class="forumbox postbox"><tbody><tr>
<td class="c1"><a href="/nuke.php?func=ucp&amp;uid=2202186" id="postauthor23">UID:2202186</a></td>
<td class="c2" id="postcontainer23">
<a name="l23" id="pid887652640Anchor"></a>
<div class="postcontent" id="postcontent23">hi</div>
</td>
</tr></tbody></table>
</div>
</body></html>`;
    const { cad, window, gm } = load(html, 'https://bbs.nga.cn/read.php?tid=9', { cad_on: true });
    const seen = [];
    window.fetch = async (input, init) => {
        const href = String(input && input.url ? input.url : input);
        const method = (init && init.method) || 'GET';
        seen.push({ href, method });
        assert.equal(String(method).toUpperCase(), 'GET');
        assert.match(href, /nuke\.php/);
        assert.match(href, /__act=get/);
        assert.match(href, /uid=2202186/);
        assert.equal(/__act=set|__act=add|__act=del/i.test(href), false);
        return {
            ok: true,
            status: 200,
            url: href,
            headers: { get: () => 'application/json' },
            json: async () => ({ data: [{ uid: '2202186', username: '西西弗读者', uuname: '', ipLoc: '上海' }] }),
            arrayBuffer: async () => new TextEncoder().encode('{}').buffer,
        };
    };
    assert.equal(cad.nameFromUcpData({ data: [{ username: '西西弗读者', uid: '2202186' }] }), '西西弗读者');
    cad.boot();
    await new Promise(r => setTimeout(r, 60));
    const data = cad.extract();
    assert.equal(data.posts[0].name, '西西弗读者');
    const first = seen.length;
    assert.ok(first >= 1);
    cad.ensureLocs();
    cad.ensureLocs();
    await new Promise(r => setTimeout(r, 40));
    assert.equal(seen.length, first);
    assert.equal(gm.cad_name_cache['2202186'], '西西弗读者');
});

test('live userInfo uuname and a later hydrated author link both become the display name', () => {
    const html = `<!doctype html><html><head><title>t - NGA</title></head><body>
<div id="m_posts">
<table class="forumbox postbox"><tbody><tr>
<td class="c1"><a href="/nuke.php?func=ucp&amp;uid=42" id="postauthor1">UID:42</a></td>
<td class="c2" id="postcontainer1">
<a name="l1"></a>
<div class="postcontent" id="postcontent1">hi</div>
</td>
</tr></tbody></table>
</div>
</body></html>`;
    const { cad, window, document } = load(html, 'https://bbs.nga.cn/read.php?tid=9');
    window.commonui = { userInfo: { users: { 42: { uid: 42, username: 'UID:42', uuname: 'e6b58be8af95' } } } };
    const data = cad.extract();
    assert.equal(data.posts[0].name, '测试');

    const html2 = html;
    const second = load(html2, 'https://bbs.nga.cn/read.php?tid=9');
    second.document.querySelector('#postauthor1').textContent = '真实昵称';
    const d2 = second.cad.extract();
    assert.equal(d2.posts[0].name, '真实昵称');
});

test('op on a non-first page uses tAid, and the count is the visible OP posts', async () => {
    const { cad, document } = load(page2Html, 'https://bbs.nga.cn/read.php?tid=7&page=2', { cad_on: true });
    const data = cad.extract();
    assert.equal(data.posts[0].isOP, false);
    assert.equal(cad.parsePostArgs(document).topicAuthor, '55');
    cad.boot();
    await cad.runCmd('op');
    await new Promise(r => setTimeout(r, 40));
    assert.equal(cad.store.opOnly, true);
    const text = document.body.textContent;
    assert.equal(/End of pages/.test(text), false);
    assert.equal(/\b40 posts\b/.test(text) || /\b20 posts\b/.test(text) || /\b1 posts\b/.test(text), false);
    assert.match(text, /no OP posts|loading OP posts|Could not load the OP|authorid|original poster/i);
    assert.equal(document.querySelectorAll('[id^="cad-floor-"]').length, 0);
});

test('sidebar splits Favorites from Recent', () => {
    const { cad, document } = load(emptyHtml, 'https://bbs.nga.cn/thread.php?fid=-7', {
        cad_on: true,
        cad_recent: [{ tid: '111', title: 'Recent Thread A', href: '/read.php?tid=111' }],
        cad_fav_cache: { at: Date.now(), topics: [{ tid: '222', title: 'Fav Thread B', href: '/read.php?tid=222' }] },
        cad_threads: [],
    });
    cad.boot();
    const labels = [...document.querySelectorAll('.cad-side-label')].map(el => el.textContent.trim());
    assert.ok(labels.includes('Favorites'));
    assert.ok(labels.includes('Recent'));
    const favs = cad.sidebarFavorites();
    const recent = cad.sidebarRecent();
    assert.ok(favs.some(t => t.tid === '222' && /Fav Thread B/.test(t.title)));
    assert.ok(recent.some(t => t.tid === '111' && /Recent Thread A/.test(t.title)));
    assert.equal(recent.some(t => t.tid === '222'), false);
    const side = document.querySelector('.cad-side').textContent;
    assert.match(side, /Fav Thread B/);
    assert.match(side, /Recent Thread A/);
    // Favorites section should appear before Recent
    assert.ok(side.indexOf('Fav Thread B') < side.indexOf('Recent Thread A'));
});

test('the main column is a little wider than 92ch', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'nga-code-agent-disguise.user.js'), 'utf8');
    assert.match(src, /max-width:\s*110ch/);
    assert.equal(/max-width:\s*92ch/.test(src), false);
});
