const { test } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const path = require('node:path');

test('code uses available width, scrolls long lines, and preserves source newlines', async () => {
    const browser = await chromium.launch({ channel: process.env.X_UI_BROWSER || 'msedge', headless: true });
    try {
        const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
        await page.setContent(`<!doctype html><style>
            body { margin: 0; }
            main { padding: 24px; }
            pre { padding: 20px; background: #333; color: white; }
            pre code { display: block; max-width: 400px; }
            pre, pre code, pre code span { white-space: pre-wrap; overflow-wrap: anywhere; word-break: break-all; }
            #inline { white-space: normal; }
        </style><main><article><div data-message-author-role="assistant">
            <p>正文 <code id="inline">inline code</code></p>
            <pre id="wide"><code><span></span></code></pre>
            <pre id="long"><code></code></pre>
            <pre id="source"><code></code></pre>
        </div></article><div data-markdown-text-style="assistant-message" id="modern"></div></main>`);
        const source = 'for (int w = FirstNeighbor(G, v);\n     w >= 0;\n     w = NextNeighbor(G, v, w)) {\n    // keep this comment on its own line\n    DFS(G, w);\n}';
        await page.evaluate(source => {
            document.querySelector('#wide span').textContent = 'for (int w = FirstNeighbor(G, v); w >= 0; w = NextNeighbor(G, v, w)) {';
            document.querySelector('#long code').textContent = 'x'.repeat(600);
            document.querySelector('#source code').textContent = source;
        }, source);
        const lines = selector => page.locator(selector).evaluate(el => {
            const range = document.createRange();
            range.selectNodeContents(el);
            return new Set(Array.from(range.getClientRects(), rect => rect.top)).size;
        });
        // Reproduce a narrow inner code area within a wide outer box before the fix.
        assert.ok(await lines('#wide span') > 1);
        await page.addScriptTag({ path: path.join(__dirname, '..', 'chatgpt-custom-ui.user.js') });
        assert.equal(await lines('#wide span'), 1);
        assert.equal(await lines('#long code'), 1);
        assert.equal(await lines('#source code'), source.split('\n').length);
        assert.equal(await page.locator('#source code').textContent(), source);
        assert.equal(await page.locator('#inline').evaluate(el => getComputedStyle(el).whiteSpace), 'normal');
        if (process.env.CHATGPT_UI_SCREENSHOT) {
            await page.screenshot({ path: process.env.CHATGPT_UI_SCREENSHOT, fullPage: true });
        }

        // SPA/streaming insertion receives the same rules without rewriting source text.
        await page.locator('#modern').evaluate(el => {
            const pre = document.createElement('pre');
            pre.innerHTML = '<code><span></span></code>';
            pre.querySelector('span').textContent = 'dynamic '.repeat(100);
            el.append(pre);
        });
        assert.equal(await lines('#modern span'), 1);
        // Real ChatGPT toggles whitespace-pre-wrap on pre, including existing
        // blocks and syntax spans. The userscript must respect both states.
        await page.locator('#long').evaluate(el => el.classList.add('whitespace-pre-wrap'));
        assert.ok(await lines('#long code') > 1);
        assert.equal(await page.locator('#long code').evaluate(el => getComputedStyle(el).whiteSpace), 'pre-wrap');
        await page.locator('#modern pre').evaluate(el => el.classList.add('whitespace-pre-wrap'));
        assert.ok(await lines('#modern span') > 1);
        assert.equal(await page.locator('#modern span').evaluate(el => getComputedStyle(el).whiteSpace), 'pre-wrap');
        await page.locator('#long').evaluate(el => el.classList.remove('whitespace-pre-wrap'));
        await page.locator('#modern pre').evaluate(el => el.classList.remove('whitespace-pre-wrap'));
        assert.equal(await lines('#modern span'), 1);
        for (const width of [1600, 600, 375]) {
            await page.setViewportSize({ width, height: 1000 });
            assert.equal(await lines('#long code'), 1);
            const dimensions = await page.locator('#long').evaluate(el => ({
                client: el.clientWidth, scroll: el.scrollWidth,
                page: document.documentElement.scrollWidth, viewport: innerWidth
            }));
            assert.ok(dimensions.scroll > dimensions.client);
            assert.ok(dimensions.page <= dimensions.viewport, JSON.stringify(dimensions));
        }
    } finally {
        await browser.close();
    }
});
