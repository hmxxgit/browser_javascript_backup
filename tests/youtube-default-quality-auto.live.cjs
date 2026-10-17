// Opt-in real YouTube regression: Auto must become a checked fixed 1080p option.
// Run: node tests/youtube-default-quality-auto.live.cjs
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const source = readFileSync(path.join(__dirname, '..', 'youtube-default-quality.user.js'), 'utf8');
const videoId = process.env.YOUTUBE_TEST_VIDEO || 'aqz-KE-bpKQ';
const startupQuality = process.env.YOUTUBE_TEST_START_QUALITY || 'hd1080';
assert.match(startupQuality, /^hd(?:720|1080)$/);
const startupHeight = Number(startupQuality.slice(2));

async function openQuality(page) {
    await page.locator('#movie_player').hover();
    if (await page.locator('.ytp-settings-button').getAttribute('aria-expanded') !== 'true') await page.locator('.ytp-settings-button').click();
    if (!await page.locator('.ytp-quality-menu').isVisible()) {
        await page.locator('.ytp-settings-menu .ytp-menuitem').filter({ hasText: /^Quality/ }).click();
    }
}

const snapshot = async page => {
    const state = await page.evaluate(() => {
    const p = document.getElementById('movie_player');
    return {
        preferred: p.getPreferredQuality(), playback: p.getPlaybackQuality(),
        checked: [...p.querySelectorAll('.ytp-quality-menu [aria-checked="true"]')].map(e => e.textContent.trim()),
        actions: window.autoRegressionActions,
        settingsClicks: window.autoRegressionSettingsClicks,
        settingsExpanded: p.querySelector('.ytp-settings-button')?.getAttribute('aria-expanded'),
        videoId: p.getVideoData().video_id,
        isLiveContent: p.getPlayerResponse().videoDetails.isLiveContent,
        broadcast: p.getPlayerResponse().microformat?.playerMicroformatRenderer?.liveBroadcastDetails,
    };
    });
    state.menuVisible = await page.locator('.ytp-settings-menu').isVisible();
    return state;
};

(async () => {
    const browser = await chromium.launch({ channel: process.env.X_UI_BROWSER || 'msedge', headless: true });
    const report = { browser: browser.version(), checkedAt: new Date().toISOString(), videoId, startupQuality, checks: [] };
    try {
        for (const existingMenu of [true, false]) {
            const context = await browser.newContext({ locale: 'en-US', viewport: { width: 1920, height: 1080 } });
            const page = await context.newPage();
            page.setDefaultTimeout(45_000);
            try {
                await page.goto(`https://www.youtube.com/watch?v=${videoId}`, { waitUntil: 'domcontentloaded' });
                await page.waitForFunction(() => document.getElementById('movie_player')?.getAvailableQualityLevels?.().includes('hd1080'));
                await page.evaluate(startupQuality => {
                    const p = document.getElementById('movie_player');
                    p.setPlaybackQualityRange(startupQuality, startupQuality);
                    p.playVideo();
                }, startupQuality);
                await page.waitForFunction(height => document.querySelector('#movie_player video').videoHeight === height, startupHeight);
                await page.evaluate(() => {
                    const p = document.getElementById('movie_player');
                    p.pauseVideo();
                    // Prepare the exact reported state, independent of ABR's choice
                    // of startup resolution. This is setup, before script injection.
                    p.setPlaybackQualityRange('auto', 'auto');
                });
                await page.waitForFunction(quality => {
                    const p = document.getElementById('movie_player');
                    return p.getPreferredQuality() === 'auto' && p.getPlaybackQuality() === quality;
                }, startupQuality);
                if (existingMenu) {
                    await openQuality(page);
                    assert.match((await snapshot(page)).checked[0], /^Auto/);
                    await page.locator('.ytp-settings-button').click();
                } else {
                    assert.equal(await page.locator('.ytp-quality-menu').count(), 0);
                }
                await page.evaluate(() => {
                    const p = document.getElementById('movie_player');
                    window.autoRegressionActions = [];
                    window.autoRegressionSettingsClicks = 0;
                    const range = p.setPlaybackQualityRange;
                    p.setPlaybackQualityRange = function (...args) {
                        autoRegressionActions.push({ kind: 'range', args });
                        return range.apply(this, args);
                    };
                    document.addEventListener('click', event => {
                        if (event.isTrusted) return;
                        if (event.target.closest?.('.ytp-settings-button')) autoRegressionSettingsClicks += 1;
                        const option = event.target.closest?.('#movie_player .ytp-quality-menu [role="menuitemradio"]');
                        if (option) autoRegressionActions.push({ kind: 'native', label: option.textContent.trim() });
                    }, true);
                });
                const before = await snapshot(page);
                await page.evaluate(source);
                await page.waitForFunction(() => document.getElementById('movie_player').getPreferredQuality() === 'hd1080');
                const after = await snapshot(page);
                assert.equal(after.actions.length, 1);
                assert.equal(after.settingsClicks, 0);
                assert.notEqual(after.settingsExpanded, 'true');
                assert.equal(after.settingsExpanded, before.settingsExpanded);
                assert.equal(after.actions[0].kind, existingMenu ? 'native' : 'range');
                // Auto may already have queued a lower format during setup. Let
                // the fixed request finish decoding before checking the menu;
                // some player experiments temporarily check the decoded format.
                await page.evaluate(() => document.getElementById('movie_player').playVideo());
                await page.waitForFunction(() => {
                    const p = document.getElementById('movie_player');
                    return p.getPlaybackQuality() === 'hd1080' && p.querySelector('video').videoHeight === 1080;
                });
                await openQuality(page);
                await page.waitForFunction(() => [...document.querySelectorAll('.ytp-quality-menu [aria-checked="true"]')]
                    .some(e => /^1080p/.test(e.textContent.trim())));
                const fixed = await snapshot(page);
                assert.match(fixed.checked[0], /^1080p/);
                assert.ok(!fixed.checked.some(label => /^Auto/.test(label)));
                report.checks.push({ check: `Auto ${startupHeight}p becomes fixed 1080p (${existingMenu ? 'existing hidden menu' : 'menu not initialized'})`, before, after, fixed });
                console.error(`PASS: Auto ${startupHeight}p becomes fixed 1080p (${existingMenu ? 'hidden native option' : 'range before menu initialization'})`);

                await page.locator('.ytp-quality-menu [role="menuitemradio"]').filter({ hasText: /^Auto/ }).click();
                await page.evaluate(() => {
                    const p = document.getElementById('movie_player');
                    document.dispatchEvent(new Event('yt-navigate-finish'));
                    document.querySelector('#movie_player video').dispatchEvent(new Event('loadedmetadata'));
                    p.playVideo();
                    p.pauseVideo();
                });
                await page.waitForFunction(() => document.getElementById('movie_player').getPlayerState() === 2);
                const manual = await snapshot(page);
                assert.equal(manual.preferred, 'auto');
                assert.equal(manual.actions.length, 1);
                report.checks.push({ check: `manual Auto remains respected (${existingMenu ? 'native' : 'range'} path)`, result: manual });
                console.error('PASS: manual Auto remains respected');
            } catch (error) {
                report.lastState = await snapshot(page).catch(() => null);
                throw error;
            } finally { await context.close(); }
        }
        if (process.env.YOUTUBE_TEST_VIDEO) {
            const context = await browser.newContext({ locale: 'en-US', viewport: { width: 1920, height: 1080 } });
            const page = await context.newPage();
            page.setDefaultTimeout(45_000);
            try {
                // Exact reported URL, fresh context and document-start execution:
                // no warmup quality requests or artificial precondition this time.
                await page.addInitScript({ content: source });
                await page.goto(`https://www.youtube.com/watch?v=${videoId}`, { waitUntil: 'domcontentloaded' });
                await page.waitForFunction(() => document.getElementById('movie_player')?.getPreferredQuality?.() === 'hd1080');
                await page.evaluate(() => document.getElementById('movie_player').playVideo());
                await page.waitForFunction(() => document.querySelector('#movie_player video').videoHeight === 1080);
                await openQuality(page);
                await page.waitForFunction(() => [...document.querySelectorAll('.ytp-quality-menu [aria-checked="true"]')]
                    .some(e => /^1080p/.test(e.textContent.trim())));
                const result = await snapshot(page);
                assert.equal(result.videoId, videoId);
                assert.equal(result.preferred, 'hd1080');
                report.checks.push({ check: 'reported video starts at fixed 1080p with document-start injection', result });
                console.error('PASS: reported video starts at fixed 1080p with document-start injection');
            } catch (error) {
                report.lastState = await snapshot(page).catch(() => null);
                throw error;
            } finally { await context.close(); }
        }
        report.passed = true;
    } catch (error) {
        report.passed = false;
        report.error = error.message;
        process.exitCode = 1;
    } finally {
        console.log(JSON.stringify(report, null, 2));
        await browser.close();
    }
})();
