// Opt-in real-site coverage across player surfaces; no account/extension installed.
// Run: node tests/youtube-default-quality-surfaces.live.cjs
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const source = readFileSync(path.join(__dirname, '..', 'youtube-default-quality.user.js'), 'utf8');

const inspect = () => {
    const candidates = [...document.querySelectorAll('#movie_player,#shorts-player,.html5-video-player')];
    const p = candidates.find(p => p.getVideoData?.()?.video_id && p.getAvailableQualityLevels?.()?.length);
    if (!p) return null;
    const r = p.getPlayerResponse?.();
    const v = p.querySelector('video');
    return { url: location.href, id: p.getVideoData().video_id,
        levels: p.getAvailableQualityLevels(), preferred: p.getPreferredQuality?.(),
        playback: p.getPlaybackQuality?.(), width: v?.videoWidth, height: v?.videoHeight,
        isLive: p.getVideoData().isLive, isLiveNow: r?.microformat?.playerMicroformatRenderer?.liveBroadcastDetails?.isLiveNow,
        isLiveContent: r?.videoDetails?.isLiveContent };
};

(async () => {
    const browser = await chromium.launch({ channel: process.env.X_UI_BROWSER || 'msedge', headless: true });
    const report = { browser: browser.version(), checkedAt: new Date().toISOString(), checks: [] };
    const cases = [
        { name: 'reported replay', url: 'https://www.youtube.com/watch?v=Gt4_60l-mDc', id: 'Gt4_60l-mDc' },
        { name: 'active live on a channel URL', url: 'https://www.youtube.com/@LofiGirl/live', live: true },
        { name: 'Shorts', url: 'https://www.youtube.com/shorts/sUZe3nd-3AY', id: 'sUZe3nd-3AY' },
        { name: 'embedded iframe', embed: true, id: 'aqz-KE-bpKQ' },
    ];
    try {
        for (const entry of cases) {
            const context = await browser.newContext({ locale: 'en-US', viewport: { width: 1440, height: 1000 } });
            const page = await context.newPage();
            page.setDefaultTimeout(45_000);
            let target = page;
            try {
                // Injects into every frame like a userscript without @noframes.
                // The runtime host guard prevents execution on the parent fixture.
                await context.addInitScript({ content: source });
                if (entry.embed) {
                    await page.route('https://example.org/quality-test', route => route.fulfill({
                        contentType: 'text/html', body: '<iframe width="1280" height="720" allow="autoplay; fullscreen" src="https://www.youtube.com/embed/aqz-KE-bpKQ?enablejsapi=1&origin=https%3A%2F%2Fexample.org"></iframe>',
                    }));
                    await page.goto('https://example.org/quality-test', { waitUntil: 'domcontentloaded' });
                    target = page.frames().find(frame => frame.url().startsWith('https://www.youtube.com/embed/'))
                        || await page.waitForEvent('framenavigated', {
                            predicate: frame => frame.url().startsWith('https://www.youtube.com/embed/'),
                        });
                    assert.ok(target, 'YouTube embed frame exists');
                    assert.equal(await page.evaluate(() => window.__youtubeDefaultQualityOnceV1__), undefined);
                    // Embeds defer stream formats until playback is requested.
                    // Start muted playback before waiting for the script's choice.
                    await target.waitForFunction(() => typeof document.querySelector('.html5-video-player')?.playVideo === 'function');
                    await target.evaluate(() => {
                        const p = document.querySelector('.html5-video-player');
                        p.mute();
                        p.playVideo();
                    });
                } else await page.goto(entry.url, { waitUntil: 'domcontentloaded' });
                await target.waitForFunction(() => [...document.querySelectorAll('#movie_player,#shorts-player,.html5-video-player')]
                    .some(p => p.getVideoData?.()?.video_id && p.getPreferredQuality?.() === 'hd1080'), null, { timeout: 50_000 });
                await target.evaluate(() => {
                    const p = [...document.querySelectorAll('#movie_player,#shorts-player,.html5-video-player')]
                        .find(p => p.getPreferredQuality?.() === 'hd1080');
                    p.mute?.();
                    p.playVideo();
                });
                await target.waitForFunction(() => [...document.querySelectorAll('video')].some(v =>
                    Math.min(v.videoWidth, v.videoHeight) >= 1080), null, { timeout: 45_000 });
                const result = await target.evaluate(inspect);
                assert.equal(result.preferred, 'hd1080');
                assert.ok(result.levels.includes('hd1080'));
                if (entry.id) assert.equal(result.id, entry.id);
                if (entry.live) assert.ok(result.isLive || result.isLiveNow);
                report.checks.push({ check: entry.name, result });
                console.error(`PASS: ${entry.name}`);
            } catch (error) {
                report.failedCase = entry.name;
                report.lastState = await (target || page).evaluate(inspect).catch(() => null);
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
