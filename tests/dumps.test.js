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

maybe('real dumps: postArg supplies real pids after anchors are gone, and floor 0 may be pid 0', () => {
    const index = JSON.parse(fs.readFileSync(DUMP_INDEX, 'utf8'));
    const p2 = loadDump('thread-47902535-p2', index['thread-47902535-p2']);
    const args = p2.cad.parsePostArgs(p2.document);
    assert.equal(args.topicAuthor, '67364685');
    assert.equal(args.topicTid, '47902535');
    assert.equal(args.byFloor[23].pid, '887652640');
    assert.equal(args.byFloor[20].pid, '887652554');
    const weird = Object.keys(args.byFloor).filter(k => /e\+/.test(k) || Number(k) > 10000);
    assert.equal(weird.length, 0);

    const data = p2.cad.extract();
    const f23 = data.posts.find(p => p.floor === 23);
    const f20 = data.posts.find(p => p.floor === 20);
    assert.equal(f23.pid, '887652640');
    assert.equal(f20.pid, '887652554');
    for (const p of data.posts) {
        if (p.floor !== 0) assert.notEqual(String(p.pid), '0', 'reply floor ' + p.floor + ' should not be pid 0');
    }
    const quoted = data.posts.find(p => p.quotes && p.quotes.some(q => q.pid === '887652554'));
    assert.ok(quoted, 'a quote of floor 20 should carry its pid');
    const q = quoted.quotes.find(q => q.pid === '887652554');
    assert.ok(q.time, 'quote time comes from postArg when the original is on the page');
    assert.match(q.time, /2026-11-12/);

    // Simulate live hydration: anchors disappear, a parent form carries pid=0.
    p2.document.querySelectorAll('[id*="pid" i], [name*="pid" i]').forEach(el => {
        el.removeAttribute('id');
        el.removeAttribute('name');
    });
    p2.document.querySelectorAll('a[href*="pid"], a[href*="topid"]').forEach(a => a.setAttribute('href', '/read.php?tid=47902535'));
    p2.document.querySelectorAll('[onclick*="pid"]').forEach(el => el.removeAttribute('onclick'));
    const form = p2.document.createElement('form');
    form.innerHTML = '<input type="hidden" name="pid" value="0"><input type="hidden" name="tid" value="47902535">';
    p2.document.body.appendChild(form);
    const after = p2.cad.extract();
    assert.equal(after.posts.find(p => p.floor === 23).pid, '887652640');
    assert.equal(after.posts.find(p => p.floor === 20).pid, '887652554');
    assert.equal(after.posts.some(p => p.floor !== 0 && String(p.pid) === '0'), false);

    const p1 = loadDump('thread-47902535-p1', index['thread-47902535-p1']);
    const d1 = p1.cad.extract();
    const floor0 = d1.posts.find(p => p.floor === 0);
    assert.ok(floor0);
    assert.equal(floor0.pid, '0');
    assert.equal(floor0.isOP, true);
    assert.equal(floor0.uid, '67364685');
});

maybe('real dumps: image posts expose every attachment, not leftover numerals', () => {
    const index = JSON.parse(fs.readFileSync(DUMP_INDEX, 'utf8'));
    const { cad } = loadDump('thread-47902131-p1', index['thread-47902131-p1']);
    const data = cad.extract();
    const expect = { 4: 10, 8: 8, 14: 4, 15: 8 };
    for (const [floor, n] of Object.entries(expect)) {
        const p = data.posts.find(x => String(x.floor) === String(floor));
        assert.ok(p, 'floor ' + floor);
        assert.ok(p.imgs.length >= n, 'floor ' + floor + ' imgs ' + p.imgs.length + ' < ' + n);
        for (const img of p.imgs) {
            assert.match(img.main, /^https:\/\/img\.nga\.(cn|178\.com)\/attachments\//);
            assert.match(img.main, /\.(jpe?g|png|gif|webp)/i);
        }
    }
});

maybe('real dumps: op on a later page uses setDefault tAid and does not show an empty End of pages with a wrong count', async () => {
    const index = JSON.parse(fs.readFileSync(DUMP_INDEX, 'utf8'));
    const { cad, document } = loadDump('thread-47902535-p2', index['thread-47902535-p2']);
    const data = cad.extract();
    assert.equal(data.posts.some(p => p.isOP), false);
    assert.equal(cad.parsePostArgs(document).topicAuthor, '67364685');
    cad.boot();
    await cad.runCmd('op');
    await new Promise(r => setTimeout(r, 40));
    assert.equal(cad.store.opOnly, true);
    const floors = [...document.querySelectorAll('[id^="cad-floor-"]')];
    assert.equal(floors.length, 0, 'page 2 has no OP cards');
    const text = document.body.textContent;
    assert.equal(/End of pages/.test(text), false);
    assert.equal(/\b192 posts\b/.test(text), false);
    assert.equal(/\b14 posts\b/.test(text), false);
    assert.match(text, /OP only|OP posts|authorid|original poster/i);
    assert.equal(/\bno OP posts|\bloading OP posts|Could not load the OP|Loading the original poster|Loading the authorid/i.test(text), true);
});

maybe('real dumps: sidebar labels real favorites and recent threads separately', () => {
    const index = JSON.parse(fs.readFileSync(DUMP_INDEX, 'utf8'));
    const fav = loadDump('fav', index['fav']);
    fav.cad.boot();
    const labels = [...fav.document.querySelectorAll('.cad-side-label')].map(el => el.textContent.trim());
    assert.ok(labels.includes('Favorites'));
    assert.ok(labels.includes('Recent'));
    const favs = fav.cad.sidebarFavorites();
    assert.ok(favs.length >= 6);
    assert.ok(favs.every(t => t.tid && t.title));
    const favTids = new Set(favs.map(t => t.tid));
    for (const t of fav.cad.sidebarRecent()) {
        assert.equal(favTids.has(t.tid), false);
    }
});
