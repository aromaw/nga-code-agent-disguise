const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const source = fs.readFileSync(path.join(__dirname, '..', 'nga-code-agent-disguise.user.js'), 'utf8');
const threadHtml = fs.readFileSync(path.join(__dirname, 'fixtures', 'thread.html'), 'utf8');
const listHtml = fs.readFileSync(path.join(__dirname, 'fixtures', 'thread-list.html'), 'utf8');
const emptyHtml = '<!doctype html><html><head><title>Empty - NGA</title></head><body><p>home</p><textarea id="native"></textarea></body></html>';

function load(html, url, values = {}) {
    const dom = new JSDOM(html, { url, pretendToBeVisual: true, runScripts: 'dangerously' });
    const { window } = dom;
    const gm = { cad_autopage: false, ...values };
    window.GM_getValue = (key, fallback) => (Object.prototype.hasOwnProperty.call(gm, key) ? gm[key] : fallback);
    window.GM_setValue = (key, value) => { gm[key] = value; };
    window.GM_addStyle = () => {};
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
    // node:test evaluates window.eval outside the page realm, so the classic script element is the reliable loader.
    const script = window.document.createElement('script');
    script.textContent = source;
    window.document.documentElement.appendChild(script);
    if (!window.__cad) throw new Error('script did not export test hooks');
    return { window, gm, cad: window.__cad, document: window.document };
}

function keydown(window, type, init, target) {
    const event = new window.KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
    (target || window.document.body).dispatchEvent(event);
    return event;
}

function fakeKey(extra) {
    return {
        key: '',
        code: '',
        keyCode: 0,
        isComposing: false,
        ctrlKey: false,
        metaKey: false,
        altKey: false,
        shiftKey: false,
        defaultPrevented: false,
        preventDefault() { this.defaultPrevented = true; },
        stopPropagation() {},
        stopImmediatePropagation() {},
        currentTarget: { value: 'hello', blur() {} },
        ...extra,
    };
}

test('extracts a topic list and ls keeps every row', async () => {
    const { cad, document } = load(listHtml, 'https://bbs.nga.cn/thread.php?fid=485', { cad_on: true });
    const data = cad.extract();
    assert.equal(data.kind, 'topics');
    assert.equal(data.board, 'Watercooler');
    assert.equal(data.topics.length, 21);
    assert.equal(data.topics[20].title, 'Topic 21');
    assert.equal(data.topics[0].replies, '1');
    assert.equal(cad.pageFid(), '485');
    cad.boot();
    await cad.runCmd('ls');
    const panel = document.querySelector('.cad-panel').textContent;
    assert.match(panel, /21 topics/);
    assert.match(panel, /Topic 21/);
    assert.doesNotMatch(panel, /command not found/);
});

test('extracts thread text, breaks, quotes, lazy images, pid and breadcrumb fid', () => {
    const { cad } = load(threadHtml, 'https://bbs.nga.cn/read.php?tid=9&page=2');
    const data = cad.extract();
    assert.equal(data.kind, 'posts');
    assert.equal(data.title, 'Test thread');
    const post = data.posts[0];
    assert.equal(post.floor, 1);
    assert.equal(post.pid, '555');
    assert.equal(post.uid, '101');
    assert.equal(post.name, 'Alice');
    assert.match(post.text, /alpha\nbeta/);
    assert.match(post.text, /https:\/\/example\.com\/a/);
    assert.match(post.text, /\[smile\]/);
    assert.match(post.text, /%%IMG0%%/);
    assert.match(post.text, / {2}run\(\)/);
    assert.equal(post.imgs.length, 1);
    assert.equal(post.imgs[0].main, 'https://img.nga.178.com/attachments/a.jpg');
    assert.equal(post.text.includes('quoted'), false);
    assert.match(post.quotes[0].text, /quoted\nbit/);
    assert.equal(data.posts[1].floor, 2);
    assert.equal(data.posts[1].pid, '556');
    assert.equal(cad.pageFid(), '-7');
    assert.equal(cad.pageBoardName(), 'Whirlpool');
    const detached = new JSDOM('<div id="m_nav"><a class="nav_link" href="/thread.php?fid=-12">Other</a></div>').window.document;
    assert.equal(cad.pageFid(detached), '-12');
});

test('command parsing accepts a leading slash and vim defaults off', async () => {
    const { cad, document, gm } = load(emptyHtml, 'https://bbs.nga.cn/', { cad_on: true });
    assert.equal(cad.store.vim, false);
    assert.equal(cad.normalizeCommand('/help'), 'help');
    assert.equal(cad.normalizeCommand('  : /search: words'), 'search: words');
    cad.boot();
    assert.match(document.body.textContent, /board fid/);
    await cad.runCmd('/help');
    const panel = document.querySelector('.cad-panel').textContent;
    assert.match(panel, /quote <floor>/);
    assert.match(panel, /leading \/ is optional/);
    assert.doesNotMatch(panel, /command not found/);
    await cad.runCmd('board add');
    assert.match(document.querySelector('.cad-panel').textContent, /No board id/);
    assert.equal(gm.cad_boards, undefined);
    const style = cad.store.style;
    keydown(document.defaultView, 'keydown', { key: 't' });
    keydown(document.defaultView, 'keydown', { key: '?' });
    assert.equal(cad.store.style, style);
    assert.doesNotMatch(document.querySelector('.cad-panel').textContent, /quote <floor>/);
});

test('does not swallow keys in fields or during IME composition', async () => {
    const off = load(emptyHtml, 'https://bbs.nga.cn/', { cad_on: false });
    const { window, document, cad } = off;
    const area = document.querySelector('#native');
    const typed = keydown(window, 'keydown', { key: '`', code: 'Backquote' }, area);
    assert.equal(typed.defaultPrevented, false);
    assert.equal(cad.store.on, false);

    const box = document.createElement('input');
    document.body.appendChild(box);
    const inInput = keydown(window, 'keydown', { key: '`', code: 'Backquote' }, box);
    assert.equal(inInput.defaultPrevented, false);
    assert.equal(cad.store.on, false);

    const editable = document.createElement('div');
    editable.setAttribute('contenteditable', 'true');
    document.body.appendChild(editable);
    const inEditable = keydown(window, 'keydown', { key: '`', code: 'Backquote' }, editable);
    assert.equal(inEditable.defaultPrevented, false);
    assert.equal(cad.store.on, false);

    const composing = keydown(window, 'keydown', { key: '`', code: 'Backquote', isComposing: true });
    assert.equal(composing.defaultPrevented, false);
    assert.equal(cad.store.on, false);

    const ime = fakeKey({ key: '`', code: 'Backquote', keyCode: 229, target: document.body });
    cad.onGlobalKey(ime);
    assert.equal(ime.defaultPrevented, false);
    assert.equal(cad.store.on, false);

    const onBody = keydown(window, 'keydown', { key: '`', code: 'Backquote' });
    assert.equal(onBody.defaultPrevented, true);
    assert.equal(cad.store.on, true);

    const live = load(emptyHtml, 'https://bbs.nga.cn/', { cad_on: true });
    live.cad.boot();
    const input = live.document.querySelector('.cad-real');
    const duringIme = fakeKey({ key: 'Process', code: 'Backquote', keyCode: 229, currentTarget: input });
    live.cad.onInputKey(duringIme);
    assert.equal(duringIme.defaultPrevented, false);
    assert.equal(live.cad.store.on, true);

    live.cad.noteCompositionEnd();
    const trailingEnter = fakeKey({ key: 'Enter', keyCode: 13, currentTarget: { value: 'nihao', blur() {} } });
    live.cad.onInputKey(trailingEnter);
    assert.equal(live.cad.getPanel(), null);
    assert.equal(live.cad.store.on, true);
    await new Promise(resolve => setTimeout(resolve, 150));

    const toggle = keydown(live.window, 'keydown', { key: '`', code: 'Backquote' }, input);
    assert.equal(toggle.defaultPrevented, true);
    assert.equal(live.cad.store.on, false);
});

test('vim h scrolls and does not change pages', () => {
    const { window, cad } = load(threadHtml, 'https://bbs.nga.cn/read.php?tid=9&page=2', { cad_on: true, cad_vim: true });
    cad.boot();
    const before = window.location.href;
    keydown(window, 'keydown', { key: 'h' });
    assert.equal(window.location.href, before);
    assert.equal(cad.store.vim, true);
});

test('board add reads fid from the breadcrumb and indexes do not steal explicit fids', async () => {
    const { cad, gm } = load(threadHtml, 'https://bbs.nga.cn/read.php?tid=9&page=2', { cad_on: true });
    cad.boot();
    await cad.runCmd('board add');
    assert.equal(JSON.stringify(gm.cad_boards), JSON.stringify([{ fid: '-7', name: 'Whirlpool' }]));
    assert.equal(JSON.stringify(cad.resolveBoardOp('1')), JSON.stringify({ type: 'index', index: 0, fid: '-7' }));
    assert.equal(JSON.stringify(cad.resolveBoardOp('-7')), JSON.stringify({ type: 'fid', fid: '-7' }));
    assert.equal(JSON.stringify(cad.resolveBoardOp('485')), JSON.stringify({ type: 'fid', fid: '485' }));
});

test('reply and quote build the native form payload and wait for y', async () => {
    const loaded = load(threadHtml, 'https://bbs.nga.cn/read.php?tid=9&page=2', { cad_on: true });
    const { cad, document } = loaded;
    const calls = [];
    loaded.window.__cadMockSubmit = async (payload) => {
        calls.push(payload);
        return { ok: false, message: 'NGA: too fast' };
    };
    cad.boot();
    await cad.runCmd('whoami');
    assert.match(document.querySelector('.cad-panel').textContent, /alice — name taken from this NGA page header/);

    await cad.runCmd('reply hello from the terminal');
    assert.equal(calls.length, 0);
    let panel = document.querySelector('.cad-panel').textContent;
    assert.match(panel, /Submit this reply\?/);
    assert.match(panel, /hello from the terminal/);
    assert.match(panel, /token/);
    assert.doesNotMatch(panel, /abc123/);
    await cad.runCmd('n');
    assert.equal(calls.length, 0);
    assert.match(document.querySelector('.cad-panel').textContent, /Reply cancelled/);

    await cad.runCmd('quote 1 hello');
    assert.equal(calls.length, 0);
    await cad.runCmd('y');
    assert.equal(calls.length, 1);
    const fields = Object.fromEntries(calls[0].fields.map(field => [field.name, field.value]));
    assert.equal(fields.token, 'abc123');
    assert.equal(fields.tid, '9');
    assert.equal(fields.fid, '-7');
    assert.equal(fields.pid, '555');
    assert.equal(fields.action, 'reply');
    assert.match(fields.post_content, /^\[quote\]\[pid=555,9,1\]Reply\[\/pid\]/);
    assert.match(fields.post_content, /Alice/);
    assert.match(fields.post_content, /hello$/);
    assert.match(document.querySelector('.cad-panel').textContent, /NGA: too fast/);
    assert.match(document.querySelector('.cad-panel').textContent, /was not posted/);

    const direct = cad.buildReplyPayload(cad.findReplyForm(document), {
        text: 'direct',
        quote: { pid: '556', floor: 2, author: 'Bob', uid: '202', text: 'line-00' },
        tid: '9',
        fid: '-7',
    });
    const directFields = Object.fromEntries(direct.fields.map(field => [field.name, field.value]));
    assert.equal(directFields.pid, '556');
    assert.match(directFields.post_content, /\[pid=556,9,2\]/);
    assert.equal(direct.action, '/post.php?action=reply');
    assert.equal(direct.acceptCharset, 'GBK');

    const rejected = cad.interpretReplyResponse({
        ok: true,
        status: 200,
        url: 'https://bbs.nga.cn/post.php',
        text: '<html><body><div class="error">错误：验证码错误</div></body></html>',
    });
    assert.equal(rejected.ok, false);
    assert.match(rejected.message, /验证码错误/);
    const login = cad.interpretReplyResponse({ ok: true, status: 200, url: '', text: '<p>请先登录</p>' });
    assert.equal(login.ok, false);
    assert.match(login.message, /not logged in/);
    const ok = cad.interpretReplyResponse({ ok: true, status: 200, url: '', text: '<p>发帖完毕</p>' });
    assert.equal(ok.ok, true);
});

test('reading: links, per-post expand, image toggle, help panel and real status', async () => {
    const { cad, document } = load(threadHtml, 'https://bbs.nga.cn/read.php?tid=9&page=2', { cad_on: true });
    const segments = cad.linkifySegments('see https://example.com/a. next');
    assert.equal(JSON.stringify(segments.map(segment => segment.value)), JSON.stringify(['see ', 'https://example.com/a', '.', ' next']));
    cad.boot();
    const body = document.querySelector('#cad__body').textContent;
    assert.match(body, /alpha/);
    assert.match(body, /beta/);
    assert.equal(body.includes('%%IMG'), false);
    assert.equal(document.querySelectorAll('img.cad-img').length, 0);
    assert.ok(document.querySelector('a[href="https://example.com/a"]'));
    const status = document.querySelector('.cad-statusbar').textContent;
    assert.match(status, /img off/);
    assert.match(status, /op off/);
    assert.match(status, /autopage off/);
    assert.match(status, /page 2 of 3/);
    assert.doesNotMatch(status, /accept edits|94% context/);

    const expand = document.querySelector('.cad-expand');
    assert.match(expand.textContent, /expand/);
    assert.equal(document.querySelector('#cad__body').textContent.includes('line-15-hidden'), false);
    expand.click();
    assert.match(document.querySelector('#cad__body').textContent, /line-15-hidden/);

    const imageButton = [...document.querySelectorAll('#cad__body button')].find(button => button.textContent === '[image]');
    assert.ok(imageButton);
    imageButton.click();
    assert.equal(document.querySelectorAll('img.cad-img').length, 1);

    document.querySelector('[data-flag="img"]').click();
    assert.match(document.querySelector('.cad-statusbar').textContent, /img on/);
    assert.ok(document.querySelectorAll('img.cad-img').length >= 1);

    await cad.runCmd('/help');
    const panel = document.querySelector('.cad-panel');
    assert.ok(panel);
    assert.match(panel.textContent, /quote <floor>/);
    assert.equal(document.querySelector('#cad__body').textContent.includes('quote <floor>'), false);
});
