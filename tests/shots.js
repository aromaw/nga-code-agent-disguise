'use strict';

const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('playwright-core');

const ROOT = path.join(__dirname, '..');
const DUMP_DIR = '/workspace/nga-dom';
const OUT = '/workspace/nga-dev-shots';
const SOURCE = fs.readFileSync(path.join(ROOT, 'nga-code-agent-disguise.user.js'), 'utf8');
const PLACEHOLDER = fs.readFileSync(path.join(__dirname, 'fixtures', 'placeholder.png'));
const INDEX = JSON.parse(fs.readFileSync(path.join(DUMP_DIR, 'index.json'), 'utf8'));
const CHROME = '/usr/bin/google-chrome';

function neutralize(html) {
    return html.replace(/<script\b([^>]*)>/gi, (m, attrs) => {
        if (/type\s*=/i.test(attrs)) return m.replace(/type\s*=\s*['"][^'"]*['"]/i, 'type="text/plain"');
        return '<script type="text/plain"' + attrs + '>';
    });
}

const pages = {
    board: { file: 'board--7', url: INDEX['board--7'] },
    threadP2: { file: 'thread-47902535-p2', url: INDEX['thread-47902535-p2'] },
    threadP1: { file: 'thread-47902535-p1', url: INDEX['thread-47902535-p1'] },
    images: { file: 'thread-47902131-p1', url: INDEX['thread-47902131-p1'] },
    search: { file: 'search--7-', url: INDEX['search--7-'] },
    fav: { file: 'fav', url: INDEX['fav'] },
    fixtureThread: {
        file: null,
        url: 'https://bbs.nga.cn/read.php?tid=9&page=1',
        html: fs.readFileSync(path.join(__dirname, 'fixtures', 'live-nga-thread.html'), 'utf8'),
    },
    fixtureBoard: {
        file: null,
        url: 'https://bbs.nga.cn/thread.php?fid=-7',
        html: fs.readFileSync(path.join(__dirname, 'fixtures', 'live-nga-board.html'), 'utf8'),
    },
};

function htmlFor(key) {
    const p = pages[key];
    if (p.html) return neutralize(p.html);
    return neutralize(fs.readFileSync(path.join(DUMP_DIR, p.file + '.html'), 'utf8'));
}

function startServer() {
    const htmlMap = Object.create(null);
    for (const key of Object.keys(pages)) {
        const u = new URL(pages[key].url);
        htmlMap[u.pathname + u.search] = { key, html: htmlFor(key), url: pages[key].url };
    }
    const server = http.createServer((req, res) => {
        const u = new URL(req.url, 'http://127.0.0.1');
        if (u.pathname === '/placeholder.png') {
            res.writeHead(200, { 'Content-Type': 'image/png', 'Cache-Control': 'no-store' });
            res.end(PLACEHOLDER);
            return;
        }
        if (u.pathname === '/userscript.js') {
            res.writeHead(200, { 'Content-Type': 'application/javascript', 'Cache-Control': 'no-store' });
            res.end(SOURCE);
            return;
        }
        const hit = htmlMap[u.pathname + u.search] || htmlMap[u.pathname];
        if (hit) {
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
            res.end(hit.html);
            return;
        }
        res.writeHead(404);
        res.end('not found');
    });
    return new Promise(resolve => {
        server.listen(0, '127.0.0.1', () => {
            const { port } = server.address();
            resolve({ server, port, origin: 'http://127.0.0.1:' + port });
        });
    });
}

function gmInit(overrides = {}) {
    const values = Object.assign({
        cad_on: true,
        cad_autopage: false,
        cad_img: false,
        cad_expand: false,
        cad_style: 'claude',
        cad_mode: 'dark',
        cad_vim: false,
        cad_compact: false,
    }, overrides);
    return `
        window.__CAD_TEST = true;
        window.__cadGM = ${JSON.stringify(values)};
        window.GM_getValue = (key, fallback) => Object.prototype.hasOwnProperty.call(window.__cadGM, key) ? window.__cadGM[key] : fallback;
        window.GM_setValue = (key, value) => { window.__cadGM[key] = value; };
        window.GM_addStyle = (css) => {
            const s = document.createElement('style');
            s.textContent = css;
            (document.head || document.documentElement).appendChild(s);
        };
        window.fetch = () => Promise.reject(new Error('blocked'));
    `;
}

async function openPage(browser, origin, key, gm, after) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });
    const target = pages[key].url;
    const html = htmlFor(key);

    await page.addInitScript({ content: gmInit(gm) });
    await page.route('**/*', async (route) => {
        const req = route.request();
        const url = req.url();
        if (url.startsWith('data:') || url.startsWith('blob:')) return route.continue();
        let sameDoc = false;
        try {
            const a = new URL(url);
            const b = new URL(target);
            sameDoc = a.host === b.host && a.pathname === b.pathname && (a.search === b.search || req.resourceType() === 'document');
            if (a.host === b.host && a.pathname === b.pathname && req.resourceType() === 'document') sameDoc = true;
        } catch (e) { sameDoc = false; }
        if (sameDoc && req.resourceType() === 'document') {
            return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html });
        }
        if (/\.(png|jpe?g|gif|webp|bmp|avif)(\?|$)/i.test(url) || req.resourceType() === 'image') {
            return route.fulfill({ status: 200, contentType: 'image/png', body: PLACEHOLDER });
        }
        if (url.includes('userscript') || url.endsWith('.user.js')) {
            return route.fulfill({ status: 200, contentType: 'application/javascript', body: SOURCE });
        }
        return route.abort();
    });
    await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.addScriptTag({ content: SOURCE });
    await page.evaluate(async () => {
        if (!window.__cad) throw new Error('no __cad');
        window.__cad.boot();
    });
    await page.waitForSelector('#cad__root .cad-app', { timeout: 8000 });
    await page.waitForTimeout(250);
    if (after) await after(page);
    return page;
}

async function shot(page, name) {
    const dest = path.join(OUT, name + '.png');
    await page.screenshot({ path: dest, fullPage: false });
    console.log('wrote', dest);
    return dest;
}

async function main() {
    fs.mkdirSync(OUT, { recursive: true });
    const { server, origin } = await startServer();
    const browser = await chromium.launch({
        executablePath: CHROME,
        headless: true,
        args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--font-render-hinting=medium'],
    });
    try {
        // 1. Board
        {
            const page = await openPage(browser, origin, 'board', {});
            await shot(page, 'board');
            await page.close();
        }
        // 2. Thread p2, scrolled to quotes (floors 23-27)
        {
            const page = await openPage(browser, origin, 'threadP2', {}, async (p) => {
                await p.evaluate(() => {
                    const el = document.getElementById('cad-floor-23')
                        || document.getElementById('cad-floor-24')
                        || document.getElementById('cad-floor-27');
                    if (el) el.scrollIntoView({ block: 'start' });
                });
                await p.waitForTimeout(200);
            });
            await shot(page, 'thread-p2-quotes');
            await page.close();
        }
        // 3. Image thread, img on — floor 8 has many lazy thumbs (was only "1")
        {
            const page = await openPage(browser, origin, 'images', { cad_img: true }, async (p) => {
                await p.evaluate(() => {
                    const el = document.getElementById('cad-floor-8')
                        || document.getElementById('cad-floor-4')
                        || document.querySelector('.cad-img');
                    if (el) el.scrollIntoView({ block: 'start' });
                });
                await p.waitForTimeout(300);
            });
            await shot(page, 'image-thread-img-on');
            await page.close();
        }
        // 4. Long-post collapse (sanitized fixture, predictable)
        {
            const page = await openPage(browser, origin, 'fixtureThread', { cad_img: true, cad_expand: false }, async (p) => {
                await p.evaluate(() => {
                    const el = document.getElementById('cad-floor-2');
                    if (el) el.scrollIntoView({ block: 'center' });
                });
                await p.waitForTimeout(200);
            });
            await shot(page, 'long-post-collapse');
            await page.close();
        }
        // 5. Help
        {
            const page = await openPage(browser, origin, 'threadP2', {}, async (p) => {
                await p.evaluate(() => window.__cad.runCmd('help'));
                await p.waitForTimeout(200);
            });
            await shot(page, 'help');
            await page.close();
        }
        // 6. Slash menu open
        {
            const page = await openPage(browser, origin, 'threadP2', {}, async (p) => {
                const input = p.locator('.cad-real');
                await input.click();
                await input.fill('/');
                await p.waitForSelector('.cad-slash', { timeout: 4000 });
                await p.waitForTimeout(150);
            });
            await shot(page, 'slash-menu');
            await page.close();
        }
        // 7. Confirm card
        {
            const page = await openPage(browser, origin, 'threadP2', {}, async (p) => {
                const ok = await p.evaluate(async () => {
                    const data = window.__cad.extract();
                    const p23 = (data.posts || []).find(x => x.floor === 23) || (data.posts || [])[1] || (data.posts || [])[0];
                    if (!p23) return false;
                    await window.__cad.runCmd('vote ' + p23.floor);
                    return true;
                });
                if (!ok) throw new Error('no post to vote');
                await p.waitForTimeout(200);
            });
            await shot(page, 'confirm-card');
            await page.close();
        }
        // 8. Light theme
        {
            const page = await openPage(browser, origin, 'threadP2', { cad_mode: 'light' }, async (p) => {
                await p.evaluate(() => {
                    const el = document.getElementById('cad-floor-23') || document.getElementById('cad-floor-24');
                    if (el) el.scrollIntoView({ block: 'start' });
                });
                await p.waitForTimeout(200);
            });
            await shot(page, 'light-theme');
            await page.close();
        }
        // 9. Esc cover
        {
            const page = await openPage(browser, origin, 'threadP2', {}, async (p) => {
                await p.evaluate(() => window.__cad.runCmd('pause'));
                await p.waitForSelector('.cad-cover', { timeout: 4000 });
                await p.waitForTimeout(150);
            });
            await shot(page, 'esc-cover');
            await page.close();
        }
        // bonus: fav sidebar, search, fixture board (useful for visual QA)
        {
            const page = await openPage(browser, origin, 'fav', {
                cad_recent: [{ tid: '111111', title: 'A recent thread', href: '/read.php?tid=111111' }],
            });
            await shot(page, 'favorites');
            await page.close();
        }
        {
            const page = await openPage(browser, origin, 'threadP2', {}, async (p) => {
                await p.evaluate(async () => { await window.__cad.runCmd('op'); });
                await p.waitForTimeout(250);
            });
            await shot(page, 'op-mode-p2');
            await page.close();
        }
        {
            const page = await openPage(browser, origin, 'search', {});
            await shot(page, 'search');
            await page.close();
        }
    } finally {
        await browser.close();
        server.close();
    }
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
