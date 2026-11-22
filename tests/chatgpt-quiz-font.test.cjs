const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { launchBrowser } = require('./browser.cjs');

const script = fs.readFileSync(path.join(__dirname, '..', 'chatgpt-custom-ui.user.js'), 'utf8');

// This fixture reproduces the observed ChatGPT DIL radio and checkbox label
// structures, including their independent 16px styles and checkbox text spans.
const fixture = `<!doctype html><html><head><meta charset="utf-8"><style>
    body { font: 16px/1.5 sans-serif; }
    .RadioLabel-aEyICO, .Label-ormz6U, #other-label { font-size: 16px; line-height: 26px; }
    #question { font-size: 21px; }
</style></head><body>
<main><div data-markdown-text-style="assistant-message"><div data-dil-response>
    <p id="question">题干</p>
    <div role="radiogroup" data-d-component="radio-group" aria-label="Options">
        <div data-d-component="radio"><label class="RadioLabel-aEyICO" for="radio-a"><div><button id="radio-a" type="button" role="radio" aria-checked="false"></button></div>A. 单选答案</label></div>
    </div>
    <div data-has-label data-orientation="left"><button id="check-a" type="button" role="checkbox" aria-checked="false" data-d-component="checkbox"></button><label class="Label-ormz6U" for="check-a"><span><span data-d-stream-run data-d-text-flow="run">A. 多选答案</span></span></label></div>
    <label id="other-label">其他标签</label>
</div></div></main>
<div data-d-component="radio"><label id="outside-label" class="RadioLabel-aEyICO">回复外的标签</label></div>
<script>
    for (const button of document.querySelectorAll('[role=radio], [role=checkbox]')) {
        button.addEventListener('click', () => button.setAttribute('aria-checked', button.getAttribute('aria-checked') !== 'true'));
    }
</script>
<script>${script.replace(/<\/script/gi, '<\\/script')}</script>
</body></html>`;

async function computed(page, selector, property = 'fontSize') {
    return page.locator(selector).evaluate((element, property) => getComputedStyle(element)[property], property);
}

test('quiz option font is configurable, persists across reload, and preserves interactions', async () => {
    const browser = await launchBrowser();
    try {
        const page = await browser.newPage();
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        page.on('dialog', dialog => dialog.accept());
        await page.addInitScript(() => {
            window.GM_getValue = (key, fallback) => localStorage.getItem(key) ?? fallback;
            window.GM_setValue = (key, value) => localStorage.setItem(key, value);
            window.GM_registerMenuCommand = (name, action) => {
                window.testMenus ??= {};
                window.testMenus[name] = action;
            };
        });
        await page.route('https://chatgpt.com/**', route => route.fulfill({ contentType: 'text/html', body: fixture }));
        await page.goto('https://chatgpt.com/c/quiz-font-test');
        const radio = '[data-d-component="radio-group"] label';
        const checkbox = '[data-d-component="checkbox"] + label';
        assert.equal(await computed(page, radio), '19px');
        assert.equal(await computed(page, checkbox), '19px');
        assert.equal(await computed(page, `${checkbox} [data-d-stream-run]`), '19px');
        assert.equal(await computed(page, '#question'), '19px');
        assert.equal(await computed(page, '#other-label'), '16px');
        assert.equal(await computed(page, '#outside-label'), '16px');

        await page.evaluate(() => window.testMenus['自定义配置']());
        const input = page.locator('[data-chatgpt-custom-ui-config-panel] input[name="quizOptionFontSize"]');
        assert.equal(await input.inputValue(), '19');
        await input.fill('28');
        await Promise.all([
            page.waitForNavigation(),
            page.locator('[data-chatgpt-custom-ui-config-panel] button[type="submit"]').click()
        ]);
        assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('chatgptCustomUiConfig')).quizOptionFontSize), 28);
        assert.equal(await computed(page, radio), '28px');
        assert.equal(await computed(page, checkbox), '28px');
        assert.equal(await computed(page, `${checkbox} [data-d-stream-run]`), '28px');
        assert.equal(await computed(page, '#question'), '19px');
        assert.equal(await computed(page, '#other-label'), '16px');
        assert.equal(await computed(page, '#outside-label'), '16px');
        await page.locator('#radio-a').click();
        await page.locator('#check-a').click();
        assert.equal(await page.locator('#radio-a').getAttribute('aria-checked'), 'true');
        assert.equal(await page.locator('#check-a').getAttribute('aria-checked'), 'true');
        assert.deepEqual(errors, []);
    } finally {
        await browser.close();
    }
});
