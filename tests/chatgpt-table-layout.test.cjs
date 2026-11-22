const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { launchBrowser } = require('./browser.cjs');

// Reproduces the observed DIL table and its independently scrollable viewport.
// The fixture constrains its native rendered width to the observed 768px; the
// real table uses width:auto with a 768px minimum. Its second column was 53px.
const fixture = `<!doctype html><html><head><meta charset="utf-8"><style>
    * { box-sizing: border-box; }
    body { margin: 0; font: 21px/1.5 sans-serif; }
    main { width: 100%; padding: 0 24px; }
    [data-d-component="table"] { margin-inline: -24px; min-width: calc(100% + 48px); }
    [data-d-table-viewport] { overflow-x: auto; padding-inline: 24px; }
    table { width: min(100%, 768px); min-width: min(100%, 768px); max-width: 100%; border-collapse: collapse; table-layout: auto; }
    th, td { padding: 8px; text-align: left; vertical-align: top; }
    th p, td p { margin: 0; }
</style></head><body><main>
<div data-markdown-text-style="assistant-message"><div data-dil-source-message-id="fixture"><div><div data-dil-response>
    <div data-d-component="table" data-d-column-sizing="auto"><div data-d-table-viewport="true" id="quiz-viewport"><table data-d-column-sizing="auto">
        <thead><tr><th data-d-component="table-cell"><p data-d-component="text"><span data-d-stream-run>选项</span></p></th><th data-d-component="table-cell"><p data-d-component="text"><span id="judgment-heading" data-d-stream-run>判断</span></p></th><th data-d-component="table-cell"><p data-d-component="text"><span data-d-stream-run>原因</span></p></th></tr></thead>
        <tbody><tr><td data-d-component="table-cell"><p data-d-component="text"><span data-d-stream-run>A. 中国革命基本性质的变化</span></p></td><td data-d-component="table-cell"><p data-d-component="text"><span id="wrong" data-d-stream-run>错误</span></p></td><td data-d-component="table-cell"><p data-d-component="text"><span data-d-stream-run>两者都属于资产阶级民主革命，革命性质没有发生根本变化</span></p></td></tr>
        <tr><td data-d-component="table-cell"><p data-d-component="text"><span data-d-stream-run>B. 中国革命主要对象的变化</span></p></td><td data-d-component="table-cell"><p data-d-component="text"><span data-d-stream-run>错误</span></p></td><td data-d-component="table-cell"><p data-d-component="text"><span data-d-stream-run>两者的主要革命对象都是帝国主义和封建主义势力，不能以此作为根本区分标志</span></p></td></tr>
        <tr><td data-d-component="table-cell"><p data-d-component="text"><span data-d-stream-run>C. 中国革命领导阶级的变化</span></p></td><td data-d-component="table-cell"><p data-d-component="text"><strong id="correct" data-d-stream-run>正确</strong></p></td><td data-d-component="table-cell"><p data-d-component="text"><span data-d-stream-run>从资产阶级领导转变为无产阶级领导，是根本标志</span></p></td></tr></tbody>
    </table></div></div>
    <div data-d-component="table"><div data-d-table-viewport="true" id="long-viewport"><table data-d-column-sizing="auto"><tbody><tr><td data-d-component="table-cell"><p data-d-component="text"><span id="long-text" data-d-stream-run>https://example.com/abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyz</span></p></td><td data-d-component="table-cell"><p data-d-component="text">说明</p></td><td data-d-component="table-cell">甲乙</td><td data-d-component="table-cell">丙丁</td><td data-d-component="table-cell">戊己</td><td data-d-component="table-cell">庚辛</td><td data-d-component="table-cell">壬癸</td><td data-d-component="table-cell">示例</td></tr></tbody></table></div></div>
</div></div></div></div>
<table id="other-table"><tbody><tr><td id="other-cell">其他表格</td></tr></tbody></table>
</main></body></html>`;

async function characterRects(page, selector) {
    return page.locator(selector).evaluate(element => {
        const node = element.firstChild;
        return Array.from({ length: node.length }, (_, i) => {
            const range = document.createRange();
            range.setStart(node, i);
            range.setEnd(node, i + 1);
            const rect = range.getBoundingClientRect();
            return { x: rect.x, y: rect.y, right: rect.right };
        });
    });
}

test('DIL table keeps short Chinese judgments readable without breaking narrow layouts', async () => {
    const browser = await launchBrowser();
    try {
        const page = await browser.newPage({ viewport: { width: 1368, height: 900 } });
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.setContent(fixture);
        const original = await characterRects(page, '#wrong');
        assert.ok(original[1].y > original[0].y, 'fixture must reproduce the original two-character wrap');
        await page.evaluate(() => {
            window.GM_getValue = () => JSON.stringify({ messageFontSize: 21 });
        });
        await page.addScriptTag({ path: path.join(__dirname, '..', 'chatgpt-custom-ui.user.js') });

        for (const fontSize of [21, 28]) for (const width of [1368, 375]) {
            await page.evaluate(size => document.documentElement.style.setProperty('--chatgpt-message-font-size', `${size}px`), fontSize);
            await page.setViewportSize({ width, height: 900 });
            for (const selector of ['#judgment-heading', '#wrong', '#correct']) {
                const chars = await characterRects(page, selector);
                assert.equal(chars.length, 2);
                assert.ok(Math.abs(chars[0].y - chars[1].y) < 1, `${selector} wraps at viewport ${width}: ${JSON.stringify(chars)}`);
            }
            const metrics = await page.evaluate(() => {
                const viewport = document.querySelector('#long-viewport');
                const quiz = document.querySelector('#quiz-viewport');
                const quizTable = quiz.querySelector('table');
                const text = document.querySelector('#long-text');
                const range = document.createRange();
                range.selectNodeContents(text);
                const rect = range.getBoundingClientRect();
                const viewportRect = viewport.getBoundingClientRect();
                return {
                    documentWidth: document.documentElement.scrollWidth,
                    viewportWidth: window.innerWidth,
                    scrollWidth: viewport.scrollWidth,
                    clientWidth: viewport.clientWidth,
                    textRight: rect.right - viewportRect.left + viewport.scrollLeft,
                    quizWidth: quiz.getBoundingClientRect().width,
                    tableWidth: quizTable.getBoundingClientRect().width
                };
            });
            assert.ok(metrics.documentWidth <= metrics.viewportWidth + 1, JSON.stringify(metrics));
            assert.ok(metrics.textRight <= metrics.scrollWidth + 1, JSON.stringify(metrics));
            assert.ok(metrics.scrollWidth >= metrics.clientWidth);
            if (width === 1368) assert.ok(Math.abs(metrics.tableWidth - metrics.quizWidth) < 1, JSON.stringify(metrics));
            if (width === 375) {
                assert.ok(metrics.scrollWidth > metrics.clientWidth, JSON.stringify(metrics));
                assert.ok(await page.locator('#long-viewport').evaluate(e => { e.scrollLeft = e.scrollWidth; return e.scrollLeft; }) > 0);
            }
        }
        assert.equal(await page.locator('#other-cell').evaluate(e => getComputedStyle(e).minWidth), '0px');
        assert.deepEqual(errors, []);
    } finally {
        await browser.close();
    }
});
