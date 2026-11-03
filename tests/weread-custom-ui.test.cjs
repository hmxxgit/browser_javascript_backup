const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { launchBrowser } = require('./browser.cjs');

const script = path.join(__dirname, '..', 'weread-custom-ui.user.js');
const fixture = `<!doctype html><html><head><style>
body { margin: 0; background: white; color: #222; }
.readerContent > .app_content { max-width: 1000px; margin: auto; }
.readerChapterContent { margin: 0 100px; }
.readerTopBar { position: fixed; top: 0; }
.readerControls { position: fixed; width: 48px; }
.wr_horizontalReader .readerChapterContent_container { display:flex; }
.wr_horizontalReader .readerChapterContent { position:relative; }
.wr_horizontalReader .readerControls { position:absolute; }
.preRenderContent p { font: 18px/1.5 serif; }
</style></head><body><div class="readerContent"><div class="app_content">
<div class="readerTopBar"></div><div class="readerChapterContent"><div class="preRenderContent" id="preRenderContents">
<p><span>阅读测试</span></p></div><div class="readerControls"></div></div></div></div></body></html>`;
let browser;
before(async () => { browser = await launchBrowser(); });
after(async () => { await browser?.close(); });

async function setup(saved, viewport = { width: 1440, height: 900 }) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('https://weread.qq.com/web/reader/**', route => route.fulfill({ contentType: 'text/html', body: fixture }));
    await page.addInitScript(initial => {
        if (!sessionStorage.getItem('initialized')) {
            sessionStorage.setItem('initialized', '1');
            if (initial !== undefined) sessionStorage.setItem('settings', JSON.stringify(initial));
        }
        window.GM_getValue = (_, fallback) => JSON.parse(sessionStorage.getItem('settings') || 'null') ?? fallback;
        window.GM_setValue = (_, value) => {
            if (window.failSave) throw new Error('storage denied');
            sessionStorage.setItem('settings', JSON.stringify(value));
        };
        window.GM_registerMenuCommand = (name, callback) => { window.openSettings = callback; };
    }, saved);
    await page.addInitScript({ path: script });
    await page.goto('https://weread.qq.com/web/reader/test');
    return { context, page, errors };
}
const ui = page => page.locator('#weread-custom-ui');
const field = (page, name) => ui(page).locator(`[name="${name}"]`);
const style = (page, selector, property) => page.locator(selector).first().evaluate((el, prop) => getComputedStyle(el)[prop], property);
async function setRange(page, name, value) {
    await field(page, name).evaluate((input, next) => {
        input.value = next;
        input.dispatchEvent(new Event('input', { bubbles: true }));
    }, String(value));
}
async function save(page) {
    await Promise.all([page.waitForNavigation(), ui(page).getByRole('button', { name: '保存并刷新' }).click()]);
}

test('saved settings affect the input to the reading engine and survive a reload', async () => {
    const { page, context, errors } = await setup();
    try {
        assert.equal(await style(page, '.preRenderContent p span', 'fontSize'), '21px');
        assert.equal(await style(page, '.preRenderContent p span', 'lineHeight'), '39.9px');
        await ui(page).getByRole('button', { name: '阅读设置' }).click();
        await setRange(page, 'width', 1200);
        await setRange(page, 'fontSize', 26);
        await setRange(page, 'lineHeight', 2.4);
        await field(page, 'customColors').check();
        await field(page, 'background').fill('#f6ecd7');
        await field(page, 'textColor').fill('#564322');
        await save(page);
        assert.equal(await style(page, '.preRenderContent p span', 'fontSize'), '26px');
        assert.equal(await style(page, '.preRenderContent p span', 'lineHeight'), '62.4px');
        assert.equal(await style(page, '.preRenderContent p span', 'color'), 'rgb(86, 67, 34)');
        assert.equal(await style(page, '.readerChapterContent', 'backgroundColor'), 'rgb(246, 236, 215)');
        assert.ok(Math.abs((await page.locator('.readerChapterContent').boundingBox()).width - 1200) <= 1);
        await page.reload();
        assert.equal(await style(page, '.preRenderContent p span', 'lineHeight'), '62.4px');
        assert.deepEqual(errors, []);
    } finally { await context.close(); }
});

test('invalid colors do not save, and disabling restores the original page styles', async () => {
    const { page, context, errors } = await setup();
    try {
        await ui(page).getByRole('button', { name: '阅读设置' }).click();
        await field(page, 'customColors').check();
        await field(page, 'background').fill('red');
        await ui(page).getByRole('button', { name: '保存并刷新' }).click();
        assert.match(await ui(page).locator('.status').innerText(), /六位/);
        assert.equal(await page.evaluate(() => sessionStorage.getItem('settings')), null);
        await field(page, 'background').fill('#f6ecd7');
        await page.evaluate(() => { window.failSave = true; });
        await ui(page).getByRole('button', { name: '保存并刷新' }).click();
        assert.match(await ui(page).locator('.status').innerText(), /保存失败/);
        assert.equal(await page.evaluate(() => sessionStorage.getItem('settings')), null);
        await page.evaluate(() => { window.failSave = false; });
        await field(page, 'enabled').uncheck();
        await save(page);
        assert.equal(await style(page, '.preRenderContent p', 'fontSize'), '18px');
        assert.equal(await page.locator('#weread-custom-ui-style').textContent(), '');
        await page.evaluate(() => window.openSettings());
        assert.equal(await ui(page).getByRole('dialog').isVisible(), true);
        await ui(page).getByRole('button', { name: '恢复默认' }).click();
        assert.equal(await field(page, 'enabled').isChecked(), true);
        assert.equal(await field(page, 'customColors').isChecked(), false);
        await save(page);
        assert.equal(await style(page, '.preRenderContent p', 'fontSize'), '21px');
        assert.deepEqual(errors, []);
    } finally { await context.close(); }
});

test('malformed saved values are bounded; narrow and double-column layouts remain usable', async () => {
    const { page, context, errors } = await setup({ width: 90000, fontSize: 0, lineHeight: 9, background: 'red;display:none', customColors: true }, { width: 390, height: 844 });
    try {
        assert.equal(await style(page, '.preRenderContent p', 'fontSize'), '14px');
        assert.equal(await style(page, '.preRenderContent p', 'lineHeight'), '42px');
        assert.equal(await style(page, '.readerChapterContent', 'backgroundColor'), 'rgb(247, 241, 227)');
        await ui(page).getByRole('button', { name: '阅读设置' }).click();
        const panel = await ui(page).getByRole('dialog').boundingBox();
        assert.ok(panel.x >= 0 && panel.x + panel.width <= 390);
        await page.setViewportSize({ width: 1440, height: 900 });
        await page.evaluate(() => {
            const root = document.querySelector('.readerContent');
            root.className = 'wr_horizontalReader';
            root.firstElementChild.className = 'wr_horizontalReader_app_content';
        });
        assert.equal(await style(page, '.readerControls', 'right'), '-60px');
        assert.deepEqual(errors, []);
    } finally { await context.close(); }
});
