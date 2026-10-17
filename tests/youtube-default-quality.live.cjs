// Opt-in integration check against real, public YouTube pages (not part of npm test).
// Run: node tests/youtube-default-quality.live.cjs
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const { readFileSync } = require('node:fs');

const script = path.join(__dirname, '..', 'youtube-default-quality.user.js');
const video = 'aqz-KE-bpKQ';
const lowVideo = 'jNQXAC9IVRw';
const snapshot = page => page.evaluate(() => {
    const p = document.getElementById('movie_player');
    const media = p?.querySelector('video');
    return {
        url: location.href, id: p?.getVideoData?.().video_id,
        levels: p?.getAvailableQualityLevels?.(), preferred: p?.getPreferredQuality?.(),
        playback: p?.getPlaybackQuality?.(), width: media?.videoWidth, height: media?.videoHeight,
        responseId: p?.getPlayerResponse?.()?.videoDetails?.videoId,
        isLive: p?.getPlayerResponse?.()?.videoDetails?.isLiveContent,
        isUpcoming: p?.getPlayerResponse?.()?.videoDetails?.isUpcoming,
        liveStreamability: !!p?.getPlayerResponse?.()?.playabilityStatus?.liveStreamability,
        isAd: p?.getVideoData?.()?.isAd, adClass: p?.classList.contains('ad-showing'),
        setter: typeof p?.setPlaybackQualityRange,
        writes: window.qualityWrites, events: window.qualityEvents,
        playerScript: [...document.scripts].map(s => s.src).find(s => /\/player\/.*\/base\.js/.test(s)),
    };
});

async function nativeQuality(page, label) {
    await page.locator('#movie_player').hover();
    const menu = page.locator('.ytp-settings-menu');
    if (!await menu.isVisible()) await page.locator('.ytp-settings-button').click();
    if (!await page.locator('.ytp-quality-menu').isVisible()) {
        await page.locator('.ytp-settings-menu .ytp-menuitem').filter({ hasText: /^Quality/ }).click();
    }
    await page.locator('.ytp-quality-menu .ytp-menuitem').filter({ hasText: label }).click();
    // Some current player builds return to the main menu instead of closing it.
    if (await menu.isVisible()) await page.locator('.ytp-settings-button').click();
}

(async () => {
    const browser = await chromium.launch({ channel: process.env.X_UI_BROWSER || 'msedge', headless: true });
    const context = await browser.newContext({ locale: 'en-US', viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage();
    page.setDefaultTimeout(30_000);
    const report = { browser: browser.version(), checkedAt: new Date().toISOString(), checks: [] };
    const record = (check, result) => {
        report.checks.push({ check, result });
        console.error(`PASS: ${check}`);
    };
    try {
        await page.goto(`https://www.youtube.com/watch?v=${video}`, { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => document.getElementById('movie_player')?.getAvailableQualityLevels?.().includes('hd1080'));
        // Test instrumentation only: count the controller's calls. Native menu
        // changes use YouTube's internal controller, rather than this exported API.
        await page.evaluate(() => {
            window.qualityWrites = [];
            window.qualityEvents = {};
            for (const name of ['yt-navigate-start', 'yt-navigate-finish', 'yt-page-data-updated', 'yt-player-updated']) {
                document.addEventListener(name, () => { qualityEvents[name] = (qualityEvents[name] || 0) + 1; });
            }
            const p = document.getElementById('movie_player');
            const original = p.setPlaybackQualityRange;
            p.setPlaybackQualityRange = function (...args) {
                qualityWrites.push({ id: this.getVideoData().video_id, args });
                return original.apply(this, args);
            };
        });
        // DevTools execution, not a DOM <script> insertion (YouTube enforces
        // Trusted Types). Actual Tampermonkey installation is a separate check.
        await page.evaluate(readFileSync(script, 'utf8'));
        await page.waitForFunction(() => document.getElementById('movie_player').getPreferredQuality() === 'hd1080');
        assert.equal((await snapshot(page)).writes.length, 1);
        record('initial 4K/1440p/1080p video selects 1080p', await snapshot(page));
        await page.evaluate(() => document.getElementById('movie_player').playVideo());
        await page.waitForFunction(() => document.getElementById('movie_player').getPlayerState() === 1);
        await page.waitForFunction(() => document.querySelector('#movie_player video').videoHeight === 1080, null, { timeout: 45_000 });
        record('decoded frames reach 1080p', await snapshot(page));
        await nativeQuality(page, /^2160p/);
        // Quality switches can rebuild the menu while buffering. Wait for the
        // actual format transition before reopening it for the 480p check.
        await page.waitForFunction(() => {
            const p = document.getElementById('movie_player');
            return p.getPreferredQuality() === 'hd2160' && p.getPlayerState() === 1 &&
                p.querySelector('video').videoHeight === 2160;
        }, null, { timeout: 45_000 });
        assert.equal((await snapshot(page)).writes.length, 1);
        record('native 4K choice retained', await snapshot(page));
        await nativeQuality(page, /^480p/);
        await page.waitForFunction(() => document.getElementById('movie_player').getPreferredQuality() === 'large');
        await page.locator('.ytp-play-button').click();
        await page.locator('.ytp-play-button').click();
        await page.evaluate(() => { document.querySelector('#movie_player video').currentTime = 40; });
        await page.locator('.ytp-fullscreen-button').click();
        await page.locator('.ytp-fullscreen-button').click();
        assert.equal((await snapshot(page)).writes.length, 1);
        assert.equal((await snapshot(page)).preferred, 'large');
        record('native 480p choice survives pause/play, seek and fullscreen', await snapshot(page));

        // Follow an actual rendered recommendation with a duration badge. Do not
        // synthesize undocumented navigation commands or choose a live badge.
        await page.waitForFunction(id => [...document.querySelectorAll('a[href^="/watch?v="]')].some(a =>
            a.getBoundingClientRect().height > 0 && /\d:\d{2}/.test(a.innerText) && !a.href.includes(id)), video);
        const recommendation = await page.evaluate(id => [...document.querySelectorAll('a[href^="/watch?v="]')].find(a =>
            a.getBoundingClientRect().height > 0 && /\d:\d{2}/.test(a.innerText) && !a.href.includes(id)).getAttribute('href'), video);
        const nextId = new URL(recommendation, 'https://www.youtube.com').searchParams.get('v');
        await page.locator(`a[href=${JSON.stringify(recommendation)}]:visible`).first().click();
        await page.waitForFunction(id => location.search.includes(id) && document.getElementById('movie_player')?.getVideoData?.().video_id === id, nextId);
        // Allow the controller's complete 45s readiness/ad window, rather than
        // declaring failure at Playwright's shorter default timeout.
        await page.waitForFunction(() => window.qualityWrites.length === 2, null, { timeout: 50_000 });
        const next = await snapshot(page);
        assert.equal(next.preferred, next.levels.includes('hd1080') ? 'hd1080' : next.levels.find(q => q !== 'auto'));
        record('real recommendation click applies policy through SPA navigation', next);
        await page.goBack({ waitUntil: 'domcontentloaded' });
        await page.waitForFunction(id => document.getElementById('movie_player')?.getVideoData?.().video_id === id && document.getElementById('movie_player').getPreferredQuality() === 'hd1080', video);
        assert.equal((await snapshot(page)).writes.length, 3);
        record('browser back reapplies 1080p for previous video', await snapshot(page));
        // Independent document-start injection, like the userscript metadata.
        // Separate context prevents prior native/script quality preferences from
        // contaminating the document-start initialization checks.
        const freshContext = await browser.newContext({ locale: 'en-US' });
        const fresh = await freshContext.newPage();
        await fresh.addInitScript({ path: script });
        await fresh.goto(`https://www.youtube.com/watch?v=${lowVideo}`, { waitUntil: 'domcontentloaded' });
        await fresh.waitForFunction(() => {
            const p = document.getElementById('movie_player');
            const levels = p?.getAvailableQualityLevels?.();
            return levels?.some(q => q !== 'auto') && p.getPreferredQuality() === levels.find(q => q !== 'auto');
        });
        const low = await snapshot(fresh);
        assert.ok(!low.levels.includes('hd1080'));
        record('document-start low-resolution video selects actual maximum', low);
        await fresh.goto(`https://www.youtube.com/watch?v=${video}`, { waitUntil: 'domcontentloaded' });
        await fresh.waitForFunction(() => document.getElementById('movie_player')?.getPreferredQuality?.() === 'hd1080');
        record('document-start injection waits for real player initialization', await snapshot(fresh));
        await freshContext.close();
        report.passed = true;
    } catch (error) {
        report.passed = false;
        report.error = error.message;
        report.lastState = await snapshot(page).catch(() => null);
        report.menu = await page.locator('.ytp-settings-menu').innerText({ timeout: 1_000 }).catch(() => null);
        process.exitCode = 1;
    } finally {
        console.log(JSON.stringify(report, null, 2));
        await context.close();
        await browser.close();
    }
})();
