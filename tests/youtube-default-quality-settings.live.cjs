// Opt-in real Tampermonkey + YouTube check. Uses a NEW disposable profile only.
// TM_EXTENSION_PATH=/absolute/path/to/unpacked/Tampermonkey node tests/youtube-default-quality-settings.live.cjs
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const { readFileSync, mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');

(async () => {
    const extension = process.env.TM_EXTENSION_PATH;
    if (!extension) throw new Error('Set TM_EXTENSION_PATH to an unpacked Tampermonkey directory (not a browser profile).');
    const channel = process.env.X_UI_BROWSER || 'msedge';
    const profile = mkdtempSync(path.join(tmpdir(), 'youtube-quality-settings-'));
    const manifest = JSON.parse(readFileSync(path.join(extension, 'manifest.json'), 'utf8'));
    const source = readFileSync(path.join(__dirname, '..', 'youtube-default-quality.user.js'), 'utf8');
    let context;
    const report = { checkedAt: new Date().toISOString(), tampermonkey: manifest.version, checks: [] };
    try {
        context = await chromium.launchPersistentContext(profile, {
            channel, headless: true, locale: 'en-US', viewport: { width: 1440, height: 1000 },
            args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
        });
        report.browser = context.browser().version();
        const worker = context.serviceWorkers().find(w => w.url().startsWith('chrome-extension://'))
            || await context.waitForEvent('serviceworker', { predicate: w => w.url().startsWith('chrome-extension://') });
        const base = new URL('.', worker.url()).href;
        const extensionId = new URL(base).hostname;
        const manager = await context.newPage();
        // Grant user-script access in this disposable profile, never in a user's profile.
        await manager.goto(channel === 'msedge' ? 'edge://extensions' : 'chrome://extensions');
        await manager.evaluate(id => new Promise((resolve, reject) => {
            chrome.developerPrivate.updateExtensionConfiguration({ extensionId: id, userScriptsAccess: true }, () => {
                if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
                else resolve();
            });
        }), extensionId);
        await manager.goto(base + 'options.html');
        await manager.locator('[title="Create a new script..."]').click();
        await manager.locator('.CodeMirror').waitFor();
        await manager.locator('.CodeMirror').evaluate((node, text) => node.CodeMirror.setValue(text), source);
        // Tampermonkey's editor toolbar may be collapsed; invoke its Save action.
        await manager.locator('button[title="Save"]').evaluate(button => button.click());
        await manager.getByText('YouTube Default Quality (Configurable)', { exact: true }).first().waitFor({ state: 'attached' });
        const page = await context.newPage();
        page.setDefaultTimeout(50_000);
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.bringToFront();
        await page.goto('https://www.youtube.com/watch?v=aqz-KE-bpKQ', { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => document.getElementById('movie_player')?.getPreferredQuality?.() === 'hd1080');
        for (const [height, expected] of [[2160, 'hd2160'], [720, 'hd720'], [4320, 'hd2160']]) {
            const tabs = await worker.evaluate(() => chrome.tabs.query({ url: '*://www.youtube.com/*' }));
            const id = tabs.find(tab => tab.url === page.url()).id;
            const popup = await context.newPage();
            // A popup displayed as a test tab must not replace YouTube as the
            // active tab while Tampermonkey resolves its menu's target.
            await popup.goto(base + 'action.html#' + id, { waitUntil: 'commit' });
            await page.bringToFront();
            await popup.getByText(/设置首选清晰度…/).click();
            await page.bringToFront();
            const panel = page.locator('#youtube-default-quality-config');
            await panel.getByLabel('首选清晰度').selectOption(String(height));
            if (height === 2160) {
                const before = await page.evaluate(() => document.getElementById('movie_player').getPreferredQuality());
                await panel.getByRole('button', { name: '保存', exact: true }).click();
                assert.match(await panel.getByRole('status').innerText(), /已保存/);
                assert.equal(await page.evaluate(() => document.getElementById('movie_player').getPreferredQuality()), before);
                await panel.getByRole('button', { name: '关闭', exact: true }).click();
                await page.reload({ waitUntil: 'domcontentloaded' });
            } else {
                await Promise.all([
                    page.waitForEvent('domcontentloaded'),
                    panel.getByRole('button', { name: '保存并刷新', exact: true }).click(),
                ]);
            }
            if (!popup.isClosed()) await popup.close();
            await page.waitForFunction(() => typeof document.getElementById('movie_player')?.playVideo === 'function');
            await page.evaluate(() => { const p = document.getElementById('movie_player'); p.mute(); p.playVideo(); });
            await page.waitForFunction(q => document.getElementById('movie_player')?.getPreferredQuality?.() === q, expected);
            await page.waitForFunction(h => document.querySelector('#movie_player video')?.videoHeight === h, Number(expected.slice(2)));
            const result = await page.evaluate(() => {
                const p = document.getElementById('movie_player'), v = p.querySelector('video');
                return { id: p.getVideoData().video_id, preferred: p.getPreferredQuality(),
                    levels: p.getAvailableQualityLevels(), width: v.videoWidth, height: v.videoHeight };
            });
            assert.equal(result.id, 'aqz-KE-bpKQ');
            if (height === 4320) assert.ok(!result.levels.includes('hd4320'), '8K must be unavailable to test downward fallback');
            const button = page.locator('#movie_player .ytp-settings-button');
            if (await button.getAttribute('aria-expanded') !== 'true') await button.click();
            if (!await page.locator('#movie_player .ytp-quality-menu').isVisible()) {
                await page.locator('.ytp-settings-menu .ytp-menuitem').filter({ hasText: /^Quality/ }).click();
            }
            const fixedHeight = Number(expected.slice(2));
            await page.waitForFunction(h => [...document.querySelectorAll('#movie_player .ytp-quality-menu [aria-checked="true"]')]
                .some(e => new RegExp(`^${h}p`).test(e.textContent.trim())), fixedHeight);
            result.checked = await page.locator('#movie_player .ytp-quality-menu [aria-checked="true"]').allTextContents();
            assert.ok(!result.checked.some(text => /Auto/.test(text)));
            await page.locator('#movie_player .ytp-panel-back-button:visible').first().click();
            result.qualitySummary = await page.locator('.ytp-settings-menu .ytp-menuitem').filter({ hasText: /^Quality/ }).innerText();
            assert.match(result.qualitySummary.replace(/\s+/g, ' '), new RegExp(`^Quality\\s*${fixedHeight}p`));
            assert.ok(!result.qualitySummary.includes('Auto'));
            await button.click();
            report.checks.push({ savedHeight: height, expected, result });
            console.error(`PASS: Tampermonkey saved ${height}p -> fixed ${expected}, decoded ${result.width}x${result.height}`);
        }
        report.passed = true;
    } catch (error) {
        report.passed = false;
        report.error = error.message;
        process.exitCode = 1;
    } finally {
        if (context) await context.close();
        rmSync(profile, { recursive: true, force: true });
        console.log(JSON.stringify(report, null, 2));
    }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
