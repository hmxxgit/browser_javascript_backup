const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { launchBrowser } = require('./browser.cjs');

const script = path.join(__dirname, '..', 'chatgpt-custom-ui.user.js');

async function createPage(browser, url = 'https://chatgpt.com/c/regression', answerHeight = 2400, includeHiddenScroller = false) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const hiddenScrollerMarkup = includeHiddenScroller
        ? '<div class="thread-scroll-container" id="hidden-thread-scroller" style="height:0;width:0;overflow:hidden"><div data-thread-scroll-footer="true"><div aria-hidden="true"></div></div></div>'
        : '';
    await page.route('https://chatgpt.com/**', route => route.fulfill({
        contentType: 'text/html',
        body: `
            <style>
                body { margin: 0; }
                aside { position: fixed; left: 0; top: 0; width: 220px; height: 800px; overflow: auto; }
                main { margin-left: 220px; min-height: 800px; }
                .thread-scroll-container { height: 600px; overflow-y: auto; }
                #content { height: ${answerHeight}px; }
                #thread-footer { position: sticky; bottom: 0; height: 80px; background: linear-gradient(transparent, black); box-shadow: 0 -20px 30px black; }
                #thread-footer > [aria-hidden="true"] { position: absolute; inset: 0; background: #000; box-shadow: 0 -20px 30px #000; }
                #sticky-gradient { position: sticky; bottom: 0; height: 80px; }
                #thread-gradient { position: absolute; inset: 0; background: linear-gradient(transparent, #000); box-shadow: 0 -20px 30px #000; }
                #dock { position: fixed; left: 220px; right: 0; bottom: 0; height: 100px; background: linear-gradient(transparent, black); box-shadow: 0 -20px 30px black; }
                form { width: 700px; height: 80px; }
                #scroll-button { position: fixed; right: 40px; bottom: 120px; width: 40px; height: 40px; }
                #portal { position: fixed; left: 300px; top: 120px; z-index: 20; }
            </style>
            <aside id="sidebar"><div style="height:1600px">Sidebar</div></aside>
            <main>
                ${hiddenScrollerMarkup}
                <div class="thread-scroll-container" id="active-thread-scroller">
                    <div id="content" data-message-author-role="assistant">Answer</div>
                    <div id="thread-footer" data-thread-scroll-footer="true"><div aria-hidden="true"></div></div>
                    <div id="sticky-gradient" class="sticky bottom-0" aria-hidden="true"><div id="thread-gradient" class="bg-gradient-to-t from-surface" aria-hidden="true"></div></div>
                </div>
                <div id="dock">
                    <form data-composer-placement="thread" data-chatgpt-composer>
                        <textarea id="prompt-textarea"></textarea><button>Send</button>
                    </form>
                </div>
                <button id="scroll-button" aria-label="Scroll to bottom"><svg></svg></button>
            </main>
            <div id="portal" role="menu"><button id="menu-item">Model option</button></div>
        `
    }));
    await page.goto(url);
    await page.addScriptTag({ path: script });
    await page.waitForFunction(() => document.querySelector('form').dataset.tmChatgptComposer === 'true');
    return page;
}

test('clears the native thread footer shadow before the first answer overflows', async () => {
    const browser = await launchBrowser();
    try {
        const page = await createPage(browser, 'https://chatgpt.com/c/short-first-answer', 120);
        await page.waitForFunction(() => document.querySelector('form')?.dataset.tmChatgptComposer === 'true');

        const state = await page.evaluate(() => {
            const scroller = document.querySelector('.thread-scroll-container');
            const footer = document.querySelector('[data-thread-scroll-footer="true"]');
            const footerStyle = getComputedStyle(footer);
            return {
                contentFits: scroller.scrollHeight <= scroller.clientHeight + 20,
                nativeScrollerMarked: scroller.dataset.tmChatgptScroller === 'true',
                footerIsNativeScrollerChild: footer.parentElement === scroller,
                footerBackgroundImage: footerStyle.backgroundImage,
                footerBoxShadow: footerStyle.boxShadow
            };
        });

        assert.deepEqual(state, {
            contentFits: true,
            nativeScrollerMarked: true,
            footerIsNativeScrollerChild: true,
            footerBackgroundImage: 'none',
            footerBoxShadow: 'none'
        });
    } finally {
        await browser.close();
    }
});

test('marks the visible thread scroller when ChatGPT leaves a zero-sized duplicate first', async () => {
    const browser = await launchBrowser();
    try {
        const page = await createPage(
            browser,
            'https://chatgpt.com/c/duplicate-hidden-scroller',
            120,
            true
        );

        const state = await page.evaluate(() => {
            const hiddenScroller = document.querySelector('#hidden-thread-scroller');
            const activeScroller = document.querySelector('#active-thread-scroller');
            const footer = activeScroller.querySelector('[data-thread-scroll-footer="true"]');
            const decoration = footer.querySelector('[aria-hidden="true"]');
            const decorationStyle = getComputedStyle(decoration);

            return {
                hiddenScrollerSize: [
                    hiddenScroller.getBoundingClientRect().width,
                    hiddenScroller.getBoundingClientRect().height
                ],
                hiddenScrollerMarked: hiddenScroller.dataset.tmChatgptScroller === 'true',
                activeScrollerMarked: activeScroller.dataset.tmChatgptScroller === 'true',
                footerIsActiveScrollerChild: footer.parentElement === activeScroller,
                decorationBackground: decorationStyle.backgroundColor,
                decorationBackgroundImage: decorationStyle.backgroundImage,
                decorationBoxShadow: decorationStyle.boxShadow
            };
        });

        assert.deepEqual(state, {
            hiddenScrollerSize: [0, 0],
            hiddenScrollerMarked: false,
            activeScrollerMarked: true,
            footerIsActiveScrollerChild: true,
            decorationBackground: 'rgba(0, 0, 0, 0)',
            decorationBackgroundImage: 'none',
            decorationBoxShadow: 'none'
        });
    } finally {
        await browser.close();
    }
});

test('keeps native footer and sticky gradient layers clear while the composer is visible', async () => {
    const browser = await launchBrowser();
    try {
        const page = await createPage(browser, 'https://chatgpt.com/c/short-first-answer', 120);

        await page.evaluate(() => {
            const form = document.querySelector('form');
            document.body.classList.add('tm-chatgpt-composer-visible');
            form.inert = false;
            form.removeAttribute('inert');
            form.removeAttribute('aria-hidden');
        });

        const state = await page.evaluate(() => {
            const form = document.querySelector('form');
            const footerDecoration = document.querySelector('#thread-footer > [aria-hidden="true"]');
            const gradient = document.querySelector('#thread-gradient');
            const footerStyle = getComputedStyle(footerDecoration);
            const gradientStyle = getComputedStyle(gradient);
            return {
                composerVisibility: getComputedStyle(form).visibility,
                footerDecorationBackground: footerStyle.backgroundColor,
                footerDecorationBackgroundImage: footerStyle.backgroundImage,
                footerDecorationBoxShadow: footerStyle.boxShadow,
                stickyGradientBackgroundImage: gradientStyle.backgroundImage,
                stickyGradientBoxShadow: gradientStyle.boxShadow
            };
        });

        assert.deepEqual(state, {
            composerVisibility: 'visible',
            footerDecorationBackground: 'rgba(0, 0, 0, 0)',
            footerDecorationBackgroundImage: 'none',
            footerDecorationBoxShadow: 'none',
            stickyGradientBackgroundImage: 'none',
            stickyGradientBoxShadow: 'none'
        });
    } finally {
        await browser.close();
    }
});

test('starting a new conversation hides the composer and clears its footer shadow', async () => {
    const browser = await launchBrowser();
    try {
        const page = await createPage(browser, 'https://chatgpt.com/');

        await page.mouse.move(640, 795);
        await page.waitForFunction(() => document.body.classList.contains('tm-chatgpt-composer-visible'));

        await page.evaluate(() => history.pushState({}, '', '/c/first-turn'));
        await page.waitForFunction(() => !document.body.classList.contains('tm-chatgpt-composer-visible'));
        await page.waitForFunction(() => getComputedStyle(document.querySelector('form')).visibility === 'hidden');

        const state = await page.evaluate(() => {
            const form = document.querySelector('form');
            const dockStyle = getComputedStyle(document.querySelector('#dock'));
            return {
                formVisibility: getComputedStyle(form).visibility,
                formInert: form.inert,
                dockBackgroundImage: dockStyle.backgroundImage,
                dockBoxShadow: dockStyle.boxShadow
            };
        });

        assert.deepEqual(state, {
            formVisibility: 'hidden',
            formInert: true,
            dockBackgroundImage: 'none',
            dockBoxShadow: 'none'
        });
    } finally {
        await browser.close();
    }
});

test('composer keeps portal and dock interactions, suppresses immediate reveal, and is unfocusable while hidden', async () => {
    const browser = await launchBrowser();
    try {
        const page = await createPage(browser);

        await page.mouse.move(640, 795);
        await page.waitForFunction(() => document.body.classList.contains('tm-chatgpt-composer-visible'));
        await page.locator('#menu-item').dispatchEvent('pointerdown');
        assert.equal(await page.evaluate(() => document.body.classList.contains('tm-chatgpt-composer-visible')), true);

        await page.evaluate(() => {
            document.querySelector('#content').dispatchEvent(new PointerEvent('pointerdown', {
                bubbles: true,
                clientY: 760
            }));
            document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientY: 761 }));
        });
        await page.waitForTimeout(200);
        assert.equal(await page.evaluate(() => document.body.classList.contains('tm-chatgpt-composer-visible')), false);

        const hiddenState = await page.evaluate(() => {
            const textarea = document.querySelector('#prompt-textarea');
            textarea.focus();
            const form = textarea.closest('form');
            return {
                focused: document.activeElement === textarea,
                visibility: getComputedStyle(form).visibility,
                inert: form.inert
            };
        });
        assert.deepEqual(hiddenState, { focused: false, visibility: 'hidden', inert: true });

        await page.mouse.move(640, 500);
        await page.mouse.move(640, 795);
        await page.waitForFunction(() => document.body.classList.contains('tm-chatgpt-composer-visible'));
        await page.locator('#dock').dispatchEvent('pointerdown', { clientX: 1000, clientY: 790 });
        assert.equal(await page.evaluate(() => document.body.classList.contains('tm-chatgpt-composer-visible')), true);
    } finally {
        await browser.close();
    }
});

test('sidebar wheel does not activate the conversation scroll arrow', async () => {
    const browser = await launchBrowser();
    try {
        const page = await createPage(browser);
        await page.waitForFunction(() => document.querySelector('#scroll-button').dataset.tmScrollBottomButton === 'true');
        await page.evaluate(() => {
            const scroller = document.querySelector('.thread-scroll-container');
            scroller.scrollTop = 900;
        });
        await page.waitForTimeout(100);
        await page.evaluate(() => {
            const button = document.querySelector('#scroll-button');
            button.removeAttribute('data-tm-scroll-direction');
            button.classList.remove('tm-scroll-bottom-visible');
            document.querySelector('#sidebar').dispatchEvent(new WheelEvent('wheel', {
                bubbles: true,
                deltaY: -300
            }));
        });
        await page.waitForTimeout(50);
        assert.equal(await page.locator('#scroll-button').getAttribute('data-tm-scroll-direction'), null);
        assert.equal(await page.locator('#scroll-button').evaluate(el => el.classList.contains('tm-scroll-bottom-visible')), false);

        await page.evaluate(() => {
            document.querySelector('.thread-scroll-container').dispatchEvent(new WheelEvent('wheel', {
                bubbles: true,
                deltaY: -300
            }));
        });
        await page.waitForFunction(() => document.querySelector('#scroll-button').dataset.tmScrollDirection === 'up');
    } finally {
        await browser.close();
    }
});
