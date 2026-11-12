const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const DUMP_DIR = '/workspace/nga-dom';
const DUMP_INDEX = path.join(DUMP_DIR, 'index.json');
const present = fs.existsSync(DUMP_INDEX);
const source = fs.readFileSync(path.join(__dirname, '..', 'nga-code-agent-disguise.user.js'), 'utf8');

function neutralize(html) {
    return html.replace(/<script\b([^>]*)>/gi, (m, attrs) => {
        if (/type\s*=/i.test(attrs)) return m.replace(/type\s*=\s*['"][^'"]*['"]/i, 'type="text/plain"');
        return '<script type="text/plain"' + attrs + '>';
    });
}

function loadDump(name, url) {
    const html = neutralize(fs.readFileSync(path.join(DUMP_DIR, name + '.html'), 'utf8'));
    const dom = new JSDOM(html, { url, pretendToBeVisual: true, runScripts: 'dangerously' });
    const { window } = dom;
    const gm = { cad_autopage: false, cad_on: true };
    window.GM_getValue = (key, fallback) => (Object.prototype.hasOwnProperty.call(gm, key) ? gm[key] : fallback);
    window.GM_setValue = (key, value) => { gm[key] = value; };
    window.GM_addStyle = (css) => {
        const style = window.document.createElement('style');
        style.textContent = css;
        (window.document.head || window.document.documentElement).appendChild(style);
    };
    window.__CAD_TEST = true;
    window.fetch = async () => { throw new Error('blocked'); };
    const script = window.document.createElement('script');
    script.textContent = source;
    window.document.documentElement.appendChild(script);
    if (!window.__cad) throw new Error('script did not export test hooks');
    return { window, cad: window.__cad, document: window.document, gm };
}

const maybe = present ? test : test.skip;

maybe('real dumps: thread posts are unique by floor and quotes are clean', () => {
    const index = JSON.parse(fs.readFileSync(DUMP_INDEX, 'utf8'));
    const { cad } = loadDump('thread-47902535-p2', index['thread-47902535-p2']);
    const data = cad.extract();
    assert.equal(data.kind, 'posts');
    const floors = data.posts.map(p => p.floor);
    assert.equal(floors.length, new Set(floors).size);
    assert.ok(data.posts.length >= 10);
    const quoted = data.posts.filter(p => p.quotes && p.quotes.length);
    assert.ok(quoted.length >= 3);
    for (const p of quoted) {
        for (const q of p.quotes) {
            assert.equal(/\+R/.test(q.text + ' ' + q.author), false);
            assert.equal(/\bundefined\b/i.test(q.text + ' ' + (q.time || '')), false);
            assert.notEqual(q.author, 'Reply');
            assert.ok(q.author);
            assert.equal(cad.isUidLabel(q.author), false);
        }
    }
    const floor27 = data.posts.find(p => p.floor === 27);
    assert.ok(floor27);
    assert.equal(floor27.text.includes('Reply to'), false);
    assert.equal(floor27.quotes[0].author.includes('['), false);
    assert.ok(floor27.text.length > 4);
});

maybe('real dumps: search returns only the two real threads', () => {
    const index = JSON.parse(fs.readFileSync(DUMP_INDEX, 'utf8'));
    const { cad } = loadDump('search--7-', index['search--7-']);
    const data = cad.extract();
    assert.equal(data.kind, 'topics');
    assert.equal(data.topics.length, 2);
    assert.equal(data.topics.some(t => /超过限制/.test(t.title)), false);
    assert.ok(data.topics[0].title.length > 4);
    assert.ok(parseInt(data.topics[0].replies, 10) >= 0);
    assert.ok(parseInt(data.topics[1].replies, 10) > 0);
});

maybe('real dumps: board name, reply counts, sidebar and favorites', () => {
    const index = JSON.parse(fs.readFileSync(DUMP_INDEX, 'utf8'));
    const board = loadDump('board--7', index['board--7']);
    const data = board.cad.extract();
    assert.equal(data.kind, 'topics');
    assert.equal(data.board, '网事杂谈');
    assert.equal(board.cad.pageBoardName(), '网事杂谈');
    const withReplies = data.topics.filter(t => parseInt(t.replies, 10) > 0);
    assert.ok(withReplies.length > 10);
    board.cad.boot();
    const side = board.document.querySelector('.cad-side');
    assert.ok(side);
    assert.ok([...side.querySelectorAll('a')].length >= 5);
    assert.match(side.textContent, /网事杂谈/);
    const crumb = board.document.querySelector('.cad-crumb').textContent;
    assert.equal(/网\s+事\s+杂\s+谈/.test(crumb), false);

    const fav = loadDump('fav', index['fav']);
    const favData = fav.cad.extract();
    assert.equal(favData.kind, 'topics');
    assert.equal(favData.topics.length, 6);
    assert.ok(favData.topics.every(t => t.title && t.tid));
    fav.cad.boot();
    const favSide = fav.document.querySelector('.cad-side');
    const favLinks = [...favSide.querySelectorAll('a')].filter(a => /tid=\d+/.test(a.getAttribute('href') || ''));
    assert.ok(favLinks.length >= 6);
});

maybe('real dumps: image thread exposes a thumbnail source', () => {
    const index = JSON.parse(fs.readFileSync(DUMP_INDEX, 'utf8'));
    const { cad } = loadDump('thread-47902131-p1', index['thread-47902131-p1']);
    const data = cad.extract();
    const withImg = data.posts.filter(p => p.imgs && p.imgs.length);
    assert.ok(withImg.length >= 1);
    assert.ok(withImg[0].imgs[0].main);
});
