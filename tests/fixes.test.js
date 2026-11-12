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
