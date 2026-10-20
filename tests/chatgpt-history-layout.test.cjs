const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { launchBrowser } = require('./browser.cjs');
const script = path.join(__dirname, '..', 'chatgpt-custom-ui.user.js');

async function fixture(browser) {
    const page = await browser.newPage({ viewport: { width:1280, height:800 } });
    await page.route('https://chatgpt.com/**', route => route.fulfill({ contentType:'text/html', body:`
        <style>
            body { margin:0; } .thread-scroll-container { height:600px; overflow:auto; overflow-anchor:none; }
            .flex { display:flex; flex-direction:column; } .relative { position:relative; }
            .shrink-0 { flex-shrink:0; } .answer { height:1800px; }
            form { position:fixed; bottom:0; height:90px; width:100%; background:white; }
        </style><main><div class="thread-scroll-container">
            <div data-chatgpt-conversation-selection-target="true">
                <div id="total-cache" class="relative shrink-0" style="height:3600px">
                    <div class="flex flex-col">
                        <div id="first-cache" style="height:1800px"><div data-turn-key="first">
                            <div data-user-message-bubble="true">First question</div>
                            <div id="first-answer" class="answer" data-markdown-text-style="assistant-message">Original history answer</div>
                        </div></div>
                        <div id="last-cache" style="height:1800px"><div data-turn-key="last">
                            <div data-user-message-bubble="true">Next question</div>
                            <div id="stream" class="answer" data-markdown-text-style="assistant-message">Streaming answer</div>
                        </div></div>
                    </div>
                </div>
            </div>
        </div><form data-composer-placement="thread" data-chatgpt-composer>
            <textarea id="prompt-textarea"></textarea><button>Send</button>
        </form></main>` }));
    await page.goto('https://chatgpt.com/c/scroll-regression');
    await page.addScriptTag({ path:script });
    await page.waitForFunction(() => document.querySelector('form').dataset.tmChatgptComposer === 'true');
    return page;
}

for (const reverse of [false, true]) {
    test(`streaming respects manual scroll and composer visibility (${reverse ? 'reverse' : 'forward'} flow)`, async () => {
        const browser = await launchBrowser();
        try {
            const page = await fixture(browser);
            await page.evaluate(reverse => {
                const s = document.querySelector('.thread-scroll-container');
                if (reverse) {
                    s.style.display = 'flex'; s.style.flexDirection = 'column-reverse';
                    s.firstElementChild.style.flexShrink = '0';
                }
                // Native changes use the prototype setter. Count only writes
                // made by the userscript, including deferred RAF scroll locks.
                const descriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollTop');
                window.nativeScroll = value => descriptor.set.call(s, value);
                window.scriptScrollWrites = [];
                Object.defineProperty(s, 'scrollTop', {
                    get() { return descriptor.get.call(this); },
                    set(value) { window.scriptScrollWrites.push(value); descriptor.set.call(this, value); }
                });
                window.nativeScroll(reverse ? -900 : 900);
            }, reverse);
            // Showing the composer must not restore a stale scroll position
            // after the page scrolls to the newly submitted question.
            await page.evaluate(reverse => {
                document.dispatchEvent(new MouseEvent('mousemove', { clientY:799, bubbles:true }));
                window.nativeScroll(reverse ? -400 : 1400);
            }, reverse);
            await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
            assert.equal(await page.locator('.thread-scroll-container').evaluate(e => Math.round(e.scrollTop)), reverse ? -400 : 1400);
            assert.deepEqual(await page.evaluate(() => window.scriptScrollWrites), []);

            await page.mouse.click(600, 200); // Hide the composer while reading.
            await page.mouse.move(600, 300);
            const before = await page.locator('.thread-scroll-container').evaluate(e => e.scrollTop);
            await page.mouse.wheel(0, reverse ? -250 : 250);
            await page.waitForFunction(({before, reverse}) => {
                const y = document.querySelector('.thread-scroll-container').scrollTop;
                return reverse ? y < before - 100 : y > before + 100;
            }, { before, reverse });
            const reading = await page.locator('.thread-scroll-container').evaluate(e => e.scrollTop);
            // Native renderer updates its cached sizes on each streamed chunk.
            await page.evaluate(async () => {
                for (let i = 0; i < 20; i++) {
                    const height = 1800 + (i + 1) * 30;
                    document.querySelector('#stream').style.height = height + 'px';
                    document.querySelector('#last-cache').style.height = height + 'px';
                    document.querySelector('#total-cache').style.height = (1800 + height) + 'px';
                    document.querySelector('#stream').append(' chunk ' + i);
                    await new Promise(resolve => requestAnimationFrame(resolve));
                }
            });
            const after = await page.locator('.thread-scroll-container').evaluate(e => e.scrollTop);
            // Reverse flow grows upward; the browser may retain distance from
            // the bottom. In both cases the script must never write scrollTop.
            if (!reverse) assert.ok(Math.abs(after - reading) < 2, `${reading} -> ${after}`);
            assert.deepEqual(await page.evaluate(() => window.scriptScrollWrites), []);
            await page.mouse.wheel(0, reverse ? 250 : -250);
            await page.waitForFunction(({after, reverse}) => {
                const y = document.querySelector('.thread-scroll-container').scrollTop;
                return reverse ? y > after + 100 : y < after - 100;
            }, { after, reverse });
            assert.equal(await page.locator('#first-answer').textContent(), 'Original history answer');
        } finally { await browser.close(); }
    });
}

test('native virtualizer owns cached heights even while mounted content is larger', async () => {
    const browser = await launchBrowser();
    try {
        const page = await fixture(browser);
        await page.evaluate(() => {
            document.querySelector('#first-cache').style.height = '60px';
            document.querySelector('#last-cache').style.height = '60px';
            document.querySelector('#total-cache').style.height = '120px';
        });
        assert.equal(Math.round((await page.locator('#first-cache').boundingBox()).height), 60);
        assert.equal(Math.round((await page.locator('#total-cache').boundingBox()).height), 120);
        // CSS must not expand the list beyond the renderer's cached range.
        // The renderer can then mount/unmount history and replace measurements.
        await page.evaluate(() => {
            document.querySelector('#first-cache').style.height = '1800px';
            document.querySelector('#last-cache').style.height = '1800px';
            document.querySelector('#total-cache').style.height = '3600px';
        });
        assert.equal(Math.round((await page.locator('#total-cache').boundingBox()).height), 3600);
        assert.equal(await page.locator('#first-answer').textContent(), 'Original history answer');
        await page.locator('#stream').scrollIntoViewIfNeeded();
        await page.locator('#first-answer').scrollIntoViewIfNeeded();
        assert.equal(await page.locator('#first-answer').isVisible(), true);
    } finally { await browser.close(); }
});

test('a newly submitted turn temporarily protects a previous reply from stale cached heights', async () => {
    const browser = await launchBrowser();
    try {
        const page = await fixture(browser);
        await page.evaluate(() => {
            const firstCache = document.querySelector('#first-cache');
            const totalCache = document.querySelector('#total-cache');
            const turnColumn = totalCache.firstElementChild;

            // Reproduce ChatGPT committing a new question while the previous
            // custom-font reply still has an obsolete 60px cached height.
            firstCache.style.height = '60px';
            totalCache.style.height = '1860px';
            turnColumn.insertAdjacentHTML('beforeend', `
                <div id="third-cache" style="height:60px">
                    <div data-turn-key="third">Third question</div>
                </div>
            `);
        });

        await page.waitForFunction(() =>
            document.querySelector('#first-cache')
                .hasAttribute('data-tm-chatgpt-history-height-guard')
        );

        const firstAnswer = await page.locator('#first-answer').boundingBox();
        const nextTurn = await page.locator('#last-cache').boundingBox();
        assert.ok(
            nextTurn.y >= firstAnswer.y + firstAnswer.height - 1,
            'the next question must follow rather than cover the previous reply'
        );
        assert.equal(await page.locator('#first-answer').isVisible(), true);

        // Once the native virtualizer publishes correct measurements, the
        // temporary overrides disappear instead of permanently owning layout.
        await page.evaluate(() => {
            const firstCache = document.querySelector('#first-cache');
            const firstTurn = firstCache.firstElementChild;
            const totalCache = document.querySelector('#total-cache');
            firstCache.style.height = `${Math.ceil(firstTurn.getBoundingClientRect().height)}px`;
            totalCache.style.height = `${Math.ceil(totalCache.firstElementChild.scrollHeight)}px`;
        });
        await page.waitForFunction(() =>
            !document.querySelector('#first-cache')
                .hasAttribute('data-tm-chatgpt-history-height-guard')
        );
        assert.equal(
            await page.locator('#total-cache').getAttribute('data-tm-chatgpt-history-height-guard'),
            null
        );
    } finally { await browser.close(); }
});

test('streaming the latest reply does not override native virtualizer heights', async () => {
    const browser = await launchBrowser();
    try {
        const page = await fixture(browser);
        await page.evaluate(() => {
            document.querySelector('#last-cache').style.height = '60px';
            document.querySelector('#stream').append(' growing latest reply');
        });
        await page.waitForTimeout(300);
        assert.equal(
            await page.locator('#last-cache').getAttribute('data-tm-chatgpt-history-height-guard'),
            null
        );
    } finally { await browser.close(); }
});

test('legacy scroll compensation yields to wheel, changing content height, and navigation', async () => {
    const browser = await launchBrowser();
    try {
        for (const reason of ['wheel', 'height', 'navigation']) {
            const page = await fixture(browser);
            await page.evaluate(reason => {
                const s = document.querySelector('.thread-scroll-container');
                s.id = 'legacy-scroll'; s.classList.remove('thread-scroll-container');
                s.style.height = '600px'; s.style.overflow = 'auto';
                document.querySelectorAll('[data-turn-key]').forEach(e => e.removeAttribute('data-turn-key'));
                s.scrollTop = 500;
                document.querySelector('main').dispatchEvent(new PointerEvent('pointerdown', { bubbles:true }));
                document.dispatchEvent(new MouseEvent('mousemove', { clientY:799, bubbles:true }));
                if (reason === 'wheel') {
                    // Upward wheel hides the composer; this must not create a
                    // fresh lock after the capture listener cancels the old one.
                    s.dispatchEvent(new WheelEvent('wheel', { deltaY:-100, bubbles:true }));
                } else if (reason === 'height') {
                    document.querySelector('#total-cache').style.height = '4400px';
                } else {
                    history.pushState({}, '', '/c/another-conversation');
                }
                s.scrollTop = 900;
            }, reason);
            await page.evaluate(() => new Promise(resolve => {
                let frames = 6;
                function next() { if (--frames) requestAnimationFrame(next); else resolve(); }
                requestAnimationFrame(next);
            }));
            assert.equal(await page.locator('#legacy-scroll').evaluate(e => Math.round(e.scrollTop)), 900, reason);
            await page.close();
        }
    } finally { await browser.close(); }
});
