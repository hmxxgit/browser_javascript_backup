const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { launchBrowser } = require('./browser.cjs');

test('hides both disclaimer variants without removing React nodes on load and SPA insertion while preserving controls', async () => {
    const browser = await launchBrowser();
    try {
        const page = await browser.newPage();
        const oldText = 'ChatGPT can make mistakes. Check important info.';
        const newText = 'ChatGPT is AI and can make mistakes. Check important info.';
        await page.setContent(`<main>
            <article>
                <p id="body">Discussion: ${newText} Please verify.</p>
                <p id="exact-message">${oldText}</p>
            </article>
            <div id="legacy"><span>${oldText}</span></div>
            <div id="modern" data-markdown-copy="exclude">${newText}</div>
            <div id="controls"><button id="attach"><svg></svg></button><span>${newText}</span></div>
            <form data-composer-placement="thread" data-chatgpt-composer>
                <textarea id="prompt-textarea"></textarea><button id="send">Send</button>
            </form>
        </main>`);
        await page.addScriptTag({ path: path.join(__dirname, '..', 'chatgpt-custom-ui.user.js') });
        await page.waitForFunction(() => getComputedStyle(document.querySelector('#modern')).display === 'none');
        assert.equal(await page.locator('#legacy span').isVisible(), false);
        assert.equal(await page.locator('#controls span').isVisible(), false);
        assert.equal(await page.locator('#attach, #send, #prompt-textarea').count(), 3);
        assert.match(await page.locator('#body').textContent(), /Please verify/);
        assert.equal(await page.locator('#exact-message').isVisible(), true);

        for (const text of [oldText, newText]) {
            // The modern footer splits the sentence across nested elements and a link.
            await page.evaluate(text => {
                const footer = document.createElement('div');
                footer.id = 'dynamic-disclaimer';
                footer.dataset.markdownCopy = 'exclude';
                const sentence = document.createElement('span');
                sentence.textContent = text.replace(' Check important info.', '');
                const link = document.createElement('a');
                link.textContent = ' Check important info.';
                footer.append(sentence, link);
                document.querySelector('main').append(footer);
            }, text);
            await page.waitForFunction(() => getComputedStyle(document.querySelector('#dynamic-disclaimer')).display === 'none');
            await page.locator('#dynamic-disclaimer').evaluate(el => el.remove());
        }
        assert.equal(await page.locator('#attach, #send, #prompt-textarea').count(), 3);
    } finally {
        await browser.close();
    }
});
