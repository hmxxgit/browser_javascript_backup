// Opt-in real-site check: manual choices last until a full document reload.
// Run: node tests/youtube-default-quality-reload.live.cjs
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const source = readFileSync(path.join(__dirname, '..', 'youtube-default-quality.user.js'), 'utf8');
const videoId = process.env.YOUTUBE_TEST_VIDEO || 'aqz-KE-bpKQ';
assert.match(videoId, /^[\w-]{11}$/);

async function openQuality(page) {
    await page.locator('#movie_player').hover();
    if (await page.locator('.ytp-settings-button').getAttribute('aria-expanded') !== 'true') {
        await page.locator('.ytp-settings-button').click();
    }
    if (!await page.locator('.ytp-quality-menu').isVisible()) {
        await page.locator('.ytp-settings-menu .ytp-menuitem').filter({ hasText: /^Quality/ }).click();
    }
}

(async () => {
    const browser = await chromium.launch({ channel: process.env.X_UI_BROWSER || 'msedge', headless: true });
    const context = await browser.newContext({ locale: 'en-US', viewport: { width: 1920, height: 1080 } });
    const page = await context.newPage();
    page.setDefaultTimeout(50_000);
    const report = { browser: browser.version(), checkedAt: new Date().toISOString(), checks: [] };
    try {
        await page.addInitScript({ content: source });
        const url = `https://www.youtube.com/watch?v=${videoId}`;
        await page.goto(url, { waitUntil: 'domcontentloaded' });
        // Auto is no longer a terminal manual choice in 2.4.0; the base live
        // test covers that policy. Reload is checked with a fixed manual tier.
        for (const [label, preferred] of [['480p', 'large']]) {
            report.phase = `${label}: initial fixed quality`;
            await page.waitForFunction(() => document.getElementById('movie_player')?.getPreferredQuality?.() === 'hd1080');
            await openQuality(page);
            report.phase = `${label}: native option activation`;
            // Trusted keyboard activation avoids menu-animation geometry races.
            await page.locator('.ytp-quality-menu [role="menuitemradio"]').filter({ hasText: new RegExp(`^${label}`) }).press('Enter');
            report.phase = `${label}: manual preference`;
            await page.waitForFunction(quality => document.getElementById('movie_player').getPreferredQuality() === quality, preferred);
            await page.evaluate(() => {
                const p = document.getElementById('movie_player');
                p.mute();
                p.playVideo();
                document.dispatchEvent(new Event('yt-navigate-finish'));
                p.querySelector('video').dispatchEvent(new Event('loadedmetadata'));
                window.__reloadQualityVisit = 'before reload';
            });
            assert.equal(await page.evaluate(() => document.getElementById('movie_player').getPreferredQuality()), preferred);
            // Real reload of the exact same URL and ID, with page-world globals reset.
            await page.reload({ waitUntil: 'domcontentloaded' });
            assert.equal(page.url(), url);
            assert.equal(await page.evaluate(() => window.__reloadQualityVisit), undefined);
            // Reload can leave this headless player unstarted. Request playback
            // before expecting its stream formats, as on the embed surface.
            await page.waitForFunction(() => typeof document.getElementById('movie_player')?.playVideo === 'function');
            await page.evaluate(() => { const p = document.getElementById('movie_player'); p.mute(); p.playVideo(); });
            report.phase = `${label}: fixed quality after reload`;
            await page.waitForFunction(() => document.getElementById('movie_player')?.getPreferredQuality?.() === 'hd1080');
            report.phase = `${label}: decoded 1080p after reload`;
            await page.waitForFunction(() => document.querySelector('#movie_player video')?.videoHeight === 1080);
            await openQuality(page);
            report.phase = `${label}: checked native option after reload`;
            await page.waitForFunction(() => [...document.querySelectorAll('.ytp-quality-menu [aria-checked="true"]')]
                .some(e => /^1080p/.test(e.textContent.trim())));
            const result = await page.evaluate(() => {
                const p = document.getElementById('movie_player');
                const v = p.querySelector('video');
                return { id: p.getVideoData().video_id, preferred: p.getPreferredQuality(),
                    width: v.videoWidth, height: v.videoHeight,
                    checked: [...p.querySelectorAll('.ytp-quality-menu [aria-checked="true"]')].map(e => e.textContent.trim()) };
            });
            assert.equal(result.id, videoId);
            report.checks.push({ check: `manual ${label} respected before reload, fixed 1080p after reload`, result });
            console.error(`PASS: manual ${label} then same-video reload restores fixed 1080p`);
        }
        report.passed = true;
        delete report.phase;
    } catch (error) {
        report.passed = false;
        report.error = error.message;
        report.lastState = await page.evaluate(() => {
            const p = document.getElementById('movie_player');
            const v = p?.querySelector('video');
            return { url: location.href, preferred: p?.getPreferredQuality?.(), playback: p?.getPlaybackQuality?.(),
                id: p?.getVideoData?.()?.video_id, levels: p?.getAvailableQualityLevels?.(), classes: p?.className,
                installed: window.__youtubeDefaultQualityOnceV1__,
                state: p?.getPlayerState?.(), width: v?.videoWidth, height: v?.videoHeight,
                text: document.querySelector('.ytp-error-content-wrap')?.textContent };
        }).catch(() => null);
        process.exitCode = 1;
    } finally {
        console.log(JSON.stringify(report, null, 2));
        await browser.close();
    }
})();
