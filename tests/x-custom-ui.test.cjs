const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const path = require('node:path');
let browser;
const script = path.join(__dirname, '..', 'x-custom-ui.user.js');
// Offline fixture: emulate X's semantic attributes and inline flex/absolute media layout.
const fixture = `<!doctype html><html><head><style>
body{margin:0;background:#000;color:#eee;display:flex;font:15px system-ui}
header{width:80px;flex-shrink:0}main{width:990px;display:flex}main>div{display:flex;width:990px}
[data-testid=primaryColumn]{width:600px;flex-shrink:0;border:1px solid #333}
[data-testid=sidebarColumn]{width:350px;margin-left:30px;flex-shrink:0}
article{padding:20px;border-bottom:1px solid #333}a{color:#1d9bf0}
[data-testid=tweetPhoto]{position:relative;width:100%;overflow:hidden}
[data-testid=tweetPhoto]>div{padding-bottom:100%;}
[data-testid=tweetPhoto] img{position:absolute;inset:0;width:100%;height:100%}
@media(max-width:999px){main,main>div{width:calc(100vw - 80px)}[data-testid=primaryColumn]{width:100%}[data-testid=sidebarColumn]{display:none}}
</style></head><body><header><nav>
<a href=/home>Home</a><a data-testid=AppTabBar_Explore_Link href=/explore>Explore</a>
<a href=/i/grok>Grok</a><a href=/i/premium_sign_up>Premium</a><a href=/me/communities>Communities</a><a href=/jobs>Jobs</a>
</nav></header><main role=main><div><section data-testid=primaryColumn>
<article data-testid=tweet><p data-testid=tweetText>你好，X 测试 <a href=/tag>链接</a></p>
<button aria-label="Grok actions">Grok</button>
<div data-testid=tweetPhoto><div></div><img alt=photo src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='900' height='900'%3E%3Crect width='900' height='900' fill='steelblue'/%3E%3C/svg%3E"></div>
<div role=group><button>Reply</button><a href=/me/status/1/analytics>100 views</a></div></article>
<input aria-label=Composer></section><aside data-testid=sidebarColumn><input aria-label=Search><aside><a href=/i/premium_sign_up>Subscribe</a></aside>Who to follow</aside></div></main>
<div data-testid=GrokDrawer>Grok drawer</div><div role=dialog id=photo-viewer><img alt=viewer-photo></div>
</body></html>`;
before(async () => { browser = await chromium.launch({ channel: process.env.X_UI_BROWSER || 'msedge', headless: true }); });
after(async () => { await browser?.close(); });
async function setup(saved = '{}', viewport = { width: 1440, height: 1000 }) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('https://x.com/**', route => route.fulfill({ contentType: 'text/html', body: fixture }));
    await page.addInitScript(value => {
        window.GM_getValue = (_, fallback) => sessionStorage.getItem('config') ?? value ?? fallback;
        window.GM_setValue = (_, next) => { if (window.failSave) throw new Error('storage denied'); sessionStorage.setItem('config', next); };
        window.menus = {};
        window.GM_registerMenuCommand = (name, callback) => window.menus[name] = callback;
    }, saved);
    await page.goto('https://x.com/home');
    await page.addScriptTag({ path: script });
    return { context, page, errors };
}
const ui = page => page.locator('#tm-x-custom-ui');
const input = (page, key) => ui(page).locator(`input[name="${key}"]`);
const css = (page, selector, property) => page.locator(selector).first().evaluate((element, key) => getComputedStyle(element)[key], property);
async function open(page) { await page.evaluate(() => window.menus['自定义配置']()); }
async function save(page) { await ui(page).locator('#save').click(); }

test('default layout, dynamic content, config save and persistence across reload', async () => {
    const { page, context, errors } = await setup();
    try {
        assert.equal(await css(page, '[data-testid=sidebarColumn]', 'display'), 'none');
        assert.equal(await css(page, 'nav a[href="/i/grok"]', 'display'), 'none');
        assert.equal(await css(page, '[data-testid=tweetText]', 'fontSize'), '19px');
        assert.equal((await page.locator('[data-testid=primaryColumn]').boundingBox()).width, 900);
        await open(page);
        await input(page, 'textFontSize').fill('24');
        await input(page, 'textColor').fill('#abc');
        await input(page, 'hideRightSidebar').uncheck();
        await save(page);
        assert.equal(await ui(page).locator('#status').innerText(), '已保存并应用。');
        assert.equal(await css(page, '[data-testid=tweetText]', 'fontSize'), '24px');
        assert.equal(await css(page, '[data-testid=tweetText]', 'color'), 'rgb(170, 187, 204)');
        assert.notEqual(await css(page, '[data-testid=sidebarColumn]', 'display'), 'none');
        await ui(page).locator('#close').click();
        await page.evaluate(() => {
            history.pushState({}, '', '/me/status/123');
            const tweet = document.createElement('article');
            tweet.dataset.testid = 'tweet';
            tweet.innerHTML = '<p data-testid="tweetText">New tweet</p><button aria-label="Grok actions">Grok</button>';
            document.querySelector('[data-testid=primaryColumn]').append(tweet);
        });
        assert.equal(await page.locator('[data-testid=tweetText]').last().evaluate(el => getComputedStyle(el).fontSize), '24px');
        await page.reload();
        await page.addScriptTag({ path: script });
        assert.equal(await css(page, '[data-testid=tweetText]', 'fontSize'), '24px');
        assert.deepEqual(errors, []);
    } finally { await context.close(); }
});

test('invalid saved config, import, validation and reset do not corrupt storage or CSS', async () => {
    const { page, context } = await setup(JSON.stringify({ contentWidth: 999999, textFontSize: 'NaN', hideGrok: 'false', textColor: 'red;display:none', unknown: true }));
    try {
        assert.equal(await css(page, '[data-testid=primaryColumn]', 'maxWidth'), '1800px');
        assert.equal(await css(page, '[data-testid=tweetText]', 'fontSize'), '19px');
        assert.equal(await css(page, 'nav a[href="/i/grok"]', 'display'), 'none');
        await open(page);
        await input(page, 'textFontSize').fill('999');
        await save(page);
        assert.equal(await page.evaluate(() => sessionStorage.getItem('config')), null);
        await ui(page).locator('#reset').click();
        await ui(page).locator('summary').click();
        await ui(page).locator('#json').fill('[1,2]');
        await ui(page).locator('#import').click();
        assert.match(await ui(page).locator('#status').innerText(), /导入失败/);
        await ui(page).locator('#json').fill('{"textFontSize":25,"mediaMaxHeight":-100,"linkColor":"#123456"}');
        await ui(page).locator('#import').click();
        assert.equal(await input(page, 'mediaMaxHeight').inputValue(), '0');
        await ui(page).locator('#export').click();
        assert.equal(JSON.parse(await ui(page).locator('#json').inputValue()).textFontSize, 25);
        await save(page);
        await ui(page).locator('#reset').click();
        assert.equal(await css(page, '[data-testid=tweetText]', 'fontSize'), '25px');
        await save(page);
        assert.equal(await css(page, '[data-testid=tweetText]', 'fontSize'), '19px');
    } finally { await context.close(); }
});

test('disable and storage failure preserve recovery menu and original site styles', async () => {
    const { page, context } = await setup();
    try {
        await open(page);
        await input(page, 'enabled').uncheck();
        await input(page, 'showSettingsButton').uncheck();
        await page.evaluate(() => window.failSave = true);
        await save(page);
        assert.match(await ui(page).locator('#status').innerText(), /保存失败/);
        assert.equal(await css(page, '[data-testid=sidebarColumn]', 'display'), 'none');
        await page.evaluate(() => window.failSave = false);
        await save(page);
        assert.equal(await page.locator('#tm-x-custom-ui-style').textContent(), '');
        assert.equal(await css(page, '[data-testid=tweetText]', 'fontSize'), '15px');
        assert.equal(await css(page, '[data-testid=primaryColumn]', 'width'), '600px');
        assert.equal(await ui(page).locator('#settings').isVisible(), false);
        await ui(page).locator('#close').click();
        await open(page);
        assert.equal(await ui(page).locator('dialog').isVisible(), true);
        await page.keyboard.press('Escape');
        assert.equal(await ui(page).locator('dialog').isVisible(), false);
    } finally { await context.close(); }
});

test('photo limits, view counts and hover actions respect keyboard focus and viewer', async () => {
    const { page, context } = await setup(JSON.stringify({ mediaMaxHeight: 300, hideViewCounts: true, actionsHoverReveal: true }));
    try {
        const photo = page.locator('[data-testid=tweetPhoto]');
        assert.ok((await photo.boundingBox()).height <= 300);
        assert.equal(await css(page, '#photo-viewer img', 'maxHeight'), 'none');
        assert.equal(await css(page, 'a[href$="/analytics"]', 'display'), 'none');
        await page.mouse.move(1400, 0);
        await page.waitForTimeout(180);
        assert.equal(await css(page, '[role=group]', 'opacity'), '0');
        await page.getByRole('button', { name: 'Reply', exact: true }).focus();
        await page.waitForTimeout(180);
        assert.equal(await css(page, '[role=group]', 'opacity'), '1');
    } finally { await context.close(); }
});

test('mobile panel fits viewport, traps keyboard focus, and touch actions stay visible', async () => {
    const { page, context, errors } = await setup('null', { width: 390, height: 844 });
    try {
        await ui(page).locator('#settings').click();
        const box = await ui(page).locator('dialog').boundingBox();
        assert.ok(box.x >= 0 && box.x + box.width <= 390);
        for (let n = 0; n < 30; n++) await page.keyboard.press('Tab');
        assert.equal(await page.evaluate(() => document.querySelector('#tm-x-custom-ui').shadowRoot.querySelector('dialog').contains(document.querySelector('#tm-x-custom-ui').shadowRoot.activeElement)), true);
        await page.keyboard.press('Escape');
        assert.equal(await ui(page).locator('#settings').evaluate(el => el.getRootNode().activeElement === el), true);
        assert.deepEqual(errors, []);
    } finally { await context.close(); }
});

test('corrupt JSON falls back to defaults without runtime errors', async () => {
    const { page, context, errors } = await setup('{broken');
    try {
        assert.equal(await css(page, '[data-testid=tweetText]', 'fontSize'), '19px');
        assert.deepEqual(errors, []);
    } finally { await context.close(); }
});
