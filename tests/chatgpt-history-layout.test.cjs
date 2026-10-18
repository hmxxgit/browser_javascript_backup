const { test } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const path = require('node:path');

test('mounted history keeps its full height when a new question reuses stale turn measurements', async () => {
    const browser = await chromium.launch({ channel: process.env.X_UI_BROWSER || 'msedge', headless: true });
    try {
        const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
        // Structure observed in the live ChatGPT transcript: total cache ->
        // flex column -> per-turn cache -> data-turn-key -> user and assistant.
        await page.setContent(`<style>
            body { margin:0; } .thread-scroll-container { height:700px; overflow:auto; }
            .flex { display:flex; flex-direction:column; } .relative { position:relative; }
            .shrink-0 { flex-shrink:0; } .question { height:60px; }
            .answer { height:1800px; background:#123; color:white; }
        </style><main><div class="thread-scroll-container">
            <div data-chatgpt-conversation-selection-target="true">
                <div id="total-cache" class="relative shrink-0" style="height:120px">
                    <div class="flex flex-col">
                        <div id="first-cache" style="height:60px">
                            <div data-turn-key="first"><div class="question">First question</div>
                                <div id="first-answer" class="answer" data-markdown-text-style="assistant-message">Original answer</div>
                            </div>
                        </div>
                        <div id="second-cache" style="height:60px">
                            <div data-turn-key="second"><div class="question">Second question</div></div>
                        </div>
                    </div>
                </div>
                <form data-composer-placement="thread" data-chatgpt-composer><textarea id="prompt-textarea"></textarea></form>
            </div>
        </div></main>`);
        const original = await page.locator('#first-answer').elementHandle();
        const firstBefore = await page.locator('#first-answer').boundingBox();
        const secondBefore = await page.locator('[data-turn-key="second"]').boundingBox();
        assert.ok(secondBefore.y < firstBefore.y + firstBefore.height, 'baseline reproduces overlapping history');
        await page.addScriptTag({ path: path.join(__dirname, '..', 'chatgpt-custom-ui.user.js') });

        async function assertHistoryLayout() {
            const first = await page.locator('[data-turn-key="first"]').boundingBox();
            const second = await page.locator('[data-turn-key="second"]').boundingBox();
            const total = await page.locator('#total-cache').boundingBox();
            assert.ok(second.y >= first.y + first.height - 1, 'next question follows the whole previous response');
            assert.ok(total.y + total.height >= second.y + second.height - 1, 'scroll range includes all mounted turns');
            assert.equal(await original.evaluate(e => e.isConnected && e.textContent), 'Original answer');
        }
        await assertHistoryLayout();
        // Streaming inserts a long answer, followed by another question while
        // React still has the previous small height measurements.
        await page.evaluate(() => {
            document.querySelector('[data-turn-key="second"]').insertAdjacentHTML('beforeend', '<div class="answer">Second answer</div>');
            document.querySelector('#second-cache').insertAdjacentHTML('afterend', '<div style="height:60px"><div data-turn-key="third"><div class="question">Third question</div></div></div>');
        });
        await assertHistoryLayout();
        const second = await page.locator('[data-turn-key="second"]').boundingBox();
        const third = await page.locator('[data-turn-key="third"]').boundingBox();
        assert.ok(third.y >= second.y + second.height - 1);
        await page.locator('[data-turn-key="third"]').scrollIntoViewIfNeeded();
        await page.locator('#first-answer').scrollIntoViewIfNeeded();
        assert.equal(await page.locator('#first-answer').isVisible(), true);
        // Empty virtualizer placeholders retain their reserved height; mounting
        // a transcript must not expand unrelated containers or forms.
        await page.evaluate(() => {
            document.querySelector('#total-cache > div').insertAdjacentHTML('beforeend', '<div id="empty" style="height:400px"></div>');
        });
        assert.equal((await page.locator('#empty').boundingBox()).height, 400);
        assert.equal(await page.locator('#first-cache').getAttribute('style'), 'height:60px');
        for (const width of [375, 2560]) {
            await page.setViewportSize({ width, height:900 });
            await assertHistoryLayout();
        }
    } finally {
        await browser.close();
    }
});
