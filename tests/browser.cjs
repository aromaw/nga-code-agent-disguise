// npm install --no-save playwright && npx playwright install chromium
// node --test tests/browser.cjs
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const source = fs.readFileSync(path.join(__dirname, '../nga-code-agent-disguise.user.js'), 'utf8');
let browser;
before(async () => {
  const options = { headless: true };
  if (process.env.CAD_CHROMIUM_MODULE) {
    const imported = require(process.env.CAD_CHROMIUM_MODULE);
    const binary = imported.default || imported;
    options.executablePath = await binary.executablePath();
    options.args = binary.args.filter(arg => !['--single-process', '--disable-web-security', '--allow-running-insecure-content'].includes(arg));
  }
  browser = await chromium.launch(options);
});
after(async () => { await browser?.close(); });
const post = (id, body, uid = '101') => `<div class="forumbox postbox" id="postcontainer${id}"><div class="posterinfo"><a class="author" href="/nuke.php?uid=${uid}">Developer${uid}</a></div><div class="postinfo">#${id} 2026-09-28 10:00</div><div class="postcontent" id="postcontent${id}">${body}</div></div>`;
const fixture = body => `<!doctype html><html><head><meta charset="utf-8"><title>测试主题 - NGA</title></head><body><div id="m_posts"><h1><span class="topic">测试主题</span></h1>${body}</div><div id="m_pbtnbtm"><a href="/read.php?tid=1&page=2">下一页</a></div><textarea id="native-editor"></textarea></body></html>`;
async function pageFor(body, values = {}, url = 'https://bbs.nga.cn/read.php?tid=1') {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  page.errors = [];
  page.on('pageerror', e => page.errors.push(e.message));
  await page.route('**/*', route => {
    const request = route.request();
    if (request.isNavigationRequest()) return route.fulfill({ contentType: 'text/html; charset=utf-8', body: fixture(body) });
    if (request.url().includes('nuke.php')) return route.fulfill({ json: { data: [{ ipLoc: 'local' }] } });
    return route.fulfill({ contentType: 'text/html; charset=utf-8', body: fixture(post(3, '第二页内容')) });
  });
  await page.addInitScript(values => {
    const settings = { cad_autopage: false, ...values };
    window.GM_getValue = (k, d) => k in settings ? settings[k] : d;
    window.GM_setValue = (k, v) => { settings[k] = v; };
    window.GM_addStyle = css => { const el = document.createElement('style'); el.textContent = css; document.documentElement.appendChild(el); };
  }, values);
  // Real document-start execution, before the fixture has been parsed.
  await page.addInitScript(code => {
    if (document.documentElement) (0, eval)(code);
    else new MutationObserver((_, observer) => {
      if (document.documentElement) { observer.disconnect(); (0, eval)(code); }
    }).observe(document, { childList: true });
  }, source);
  await page.goto(url);
  await page.waitForSelector('.cad-real', { timeout: 5000 }).catch(e => { throw new Error(page.errors.join(' | ') || e.message); });
  assert.deepEqual(page.errors, []);
  return page;
}
async function command(page, text) { await page.locator('.cad-real').fill(text); await page.locator('.cad-real').press('Enter'); }
async function close(page) { assert.deepEqual(page.errors, []); await page.context().close(); }

test('hidden/detached content preserves br, paragraphs, code indentation and quotes', async () => {
  const page = await pageFor(post(0, '第一行<br>第二行<p>段落</p><pre>if (ready) {\n  execute();\n}</pre><div class="quote">引用一<br>引用二</div>'));
  const text = await page.locator('.cad-text').innerText();
  assert.match(text, /第一行\n第二行/); assert.match(text, /\n段落\n/); assert.match(text, /\n  execute\(\);/);
  assert.match(await page.locator('.cad-qline').innerText(), /引用一\n引用二/);
  await close(page);
});
test('lazy image survives placeholder src and toggles without losing original data', async () => {
  const page = await pageFor(post(0, 'before<img src="about:blank" data-src="https://img.test/photo.png">after'));
  assert.match(await page.locator('.cad-text').innerText(), /before\[image\]after/);
  await command(page, 'img');
  assert.equal(await page.locator('.cad-img').getAttribute('src'), 'https://img.test/photo.png');
  await command(page, 'img'); assert.equal(await page.locator('.cad-img').count(), 0);
  await close(page);
});
test('Esc hides content and preserves scroll, draft, focus and DOM; backquote does not reveal page under cover', async () => {
  const page = await pageFor(Array.from({ length: 30 }, (_, i) => post(i, '正文内容<br>第二行')).join(''));
  await page.locator('.cad-real').fill('unfinished');
  await page.evaluate(() => { window.savedBody = document.querySelector('.cad-body'); savedBody.scrollTop = 380; });
  const scroll = await page.locator('.cad-body').evaluate(el => el.scrollTop);
  await page.locator('.cad-real').press('Escape');
  assert.equal(await page.locator('.cad-body').isVisible(), false);
  assert.equal(await page.locator('.cad-cover').isVisible(), true);
  await page.keyboard.press('Backquote');
  assert.equal(await page.locator('html').evaluate(el => el.classList.contains('cad-on')), true);
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('.cad-body').evaluate(el => el === window.savedBody), true);
  assert.equal(await page.locator('.cad-body').evaluate(el => el.scrollTop), scroll);
  assert.equal(await page.locator('.cad-real').inputValue(), 'unfinished');
  assert.equal(await page.locator('.cad-real').evaluate(el => el === document.activeElement), true);
  await close(page);
});
test('IME Enter does not execute and editable native fields keep the backquote', async () => {
  const page = await pageFor(post(0, '正文'));
  await page.locator('.cad-real').fill('exit');
  await page.locator('.cad-real').dispatchEvent('keydown', { key: 'Enter', isComposing: true, bubbles: true });
  assert.equal(await page.locator('.cad-real').inputValue(), 'exit');
  await page.locator('.cad-real').press('Backquote');
  assert.equal(await page.locator('.cad-real').isVisible(), false);
  await page.locator('#native-editor').fill('编辑正文');
  await page.locator('#native-editor').press('Backquote');
  assert.equal(await page.locator('.cad-real').isVisible(), false);
  await close(page);
});
test('source text changes refresh without structural changes; individual expand keeps other replies collapsed', async () => {
  const long = Array.from({ length: 25 }, (_, i) => `line-${i}`).join('<br>');
  const page = await pageFor(post(0, long) + post(1, long, '202'));
  await page.locator('.cad-expand').first().click();
  assert.match(await page.locator('.cad-text').first().innerText(), /line-24/);
  assert.doesNotMatch(await page.locator('.cad-text').nth(1).innerText(), /line-24/);
  await page.evaluate(() => document.querySelector('#postcontent1').firstChild.textContent = 'UPDATED');
  await page.waitForFunction(() => document.querySelectorAll('.cad-text')[1].textContent.includes('UPDATED'));
  assert.match(await page.locator('.cad-text').first().innerText(), /line-24/);
  await close(page);
});
test('late page request cannot append after OP mode changes', async () => {
  const page = await pageFor(post(0, 'first') + post(1, 'second', '202'));
  let release;
  await page.route('**/read.php?tid=1&page=2', async route => {
    await new Promise(r => { release = r; });
    try { await route.fulfill({ contentType: 'text/html; charset=utf-8', body: fixture(post(3, 'STALE_RESPONSE', '303')) }); } catch {}
  });
  const request = page.waitForRequest(r => r.url().includes('page=2'));
  await command(page, 'autopage'); await request;
  await command(page, 'op');
  release();
  await page.waitForTimeout(400);
  assert.doesNotMatch(await page.locator('.cad-body').innerText(), /STALE_RESPONSE/);
  await close(page);
});
test('HTTP failure shows retry; secondary thread page does not label its first reply OP', async () => {
  const page = await pageFor(post(20, 'not the original author', '202'), {}, 'https://bbs.nga.cn/read.php?tid=1&page=2');
  assert.equal(await page.locator('.cad-op').count(), 0);
  await page.route('**/read.php?tid=1&page=2', route => route.fulfill({ status: 503, body: 'Unavailable' }));
  await command(page, 'autopage');
  await page.getByText('加载下一页失败 · 点击重试').waitFor();
  await close(page);
});
test('four themes render and narrow screen stays inside viewport', async () => {
  const page = await pageFor(post(0, 'normal content'));
  for (const style of ['claude', 'codex']) for (const mode of ['dark', 'light']) {
    await command(page, style); await command(page, mode);
    assert.equal(await page.locator('#cad__root').evaluate((el, cls) => el.classList.contains(cls), `cad-${style}`), true);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.locator('#cad__root').evaluate(el => el.scrollWidth <= el.clientWidth), true);
  if (process.env.CAD_SCREENSHOT_DIR) {
    const dir = process.env.CAD_SCREENSHOT_DIR; fs.mkdirSync(dir, { recursive: true });
    await page.setViewportSize({ width: 1280, height: 800 });
    await command(page, 'claude'); await command(page, 'dark'); await command(page, 'clear');
    await page.locator('.cad-real').evaluate(el => el.blur());
    await page.screenshot({ path: path.join(dir, 'terminal.png') });
    await page.keyboard.press('Escape'); await page.screenshot({ path: path.join(dir, 'cover.png') });
  }
  await close(page);
});

test('appended page preserves line breaks, deduplicates by floor instead of reused DOM ids, and toggles images', async () => {
  const page = await pageFor(post(0, 'first'));
  await page.route('**/read.php?tid=1&page=2', route => route.fulfill({
    contentType: 'text/html; charset=utf-8',
    body: fixture(post(2, 'APPENDED<br>next line<img src="about:blank" data-src="https://img.test/appended.png">', '202')).replaceAll('postcontainer2', 'postcontainer0').replaceAll('postcontent2', 'postcontent0')
  }));
  await command(page, 'autopage');
  await page.waitForFunction(() => document.querySelector('.cad-body').textContent.includes('APPENDED'));
  await command(page, 'autopage');
  assert.match(await page.locator('.cad-text').nth(1).innerText(), /APPENDED\nnext line\[image\]/);
  await command(page, 'img');
  assert.equal(await page.locator('.cad-img').getAttribute('src'), 'https://img.test/appended.png');
  await close(page);
});

test('topic list aligns long titles and retains links in compact and detailed modes', async () => {
  const page = await pageFor(post(0, 'initial'));
  await page.evaluate(() => {
    document.querySelector('#m_posts').outerHTML = `<div id="m_threads"><div class="topicrow"><div class="c1">42</div><div class="c2"><a class="topic" href="/read.php?tid=8">${'很长的主题标题 '.repeat(15)}</a></div><div class="c3"><a class="author">author</a></div></div></div>`;
  });
  await page.locator('.cad-tlink').waitFor();
  assert.equal(await page.locator('.cad-tlink').getAttribute('href'), 'https://bbs.nga.cn/read.php?tid=8');
  await command(page, 'codex');
  assert.match(await page.locator('.cad-body').innerText(), /Inspect the workspace index/);
  assert.doesNotMatch(await page.locator('.cad-body').innerText(), /index的帖子/);
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 844 });
    assert.equal(await page.locator('.cad-body').evaluate(el => el.scrollWidth <= el.clientWidth), true);
  }
  await command(page, 'compact');
  assert.match(await page.locator('.cad-body').innerText(), /列出板块/);
  await close(page);
});
