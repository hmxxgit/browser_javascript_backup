const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const path = require('node:path');

// Offline browser fixtures: these prove controller behavior, not YouTube API support.
const script = path.join(__dirname, '..', 'youtube-default-quality.user.js');
const A = 'aqz-KE-bpKQ';
const B = 'jNQXAC9IVRw';
let browser;
before(async () => { browser = await chromium.launch({ channel: process.env.X_UI_BROWSER || 'msedge', headless: true }); });
after(async () => { await browser?.close(); });

async function setup(options = {}) {
    const context = await browser.newContext();
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.clock.install();
    await page.route('https://www.youtube.com/**', route => route.fulfill({
        contentType: 'text/html',
        body: '<div id="movie_player"><video></video><button class="ytp-settings-button">Settings</button><div class="ytp-settings-menu"><button>480p</button></div></div>',
    }));
    await page.goto(`https://www.youtube.com/watch?v=${A}`);
    await page.evaluate(({ A, options }) => {
        window.model = { id: A, responseId: A, levels: ['hd2160', 'hd1440', 'hd1080', 'hd720', 'large', 'auto'], ...options };
        window.writes = [];
        window.reads = 0;
        window.oldSetterCalls = 0;
        window.buses = [];
        window.installPlayer = (replace = false) => {
            let p = document.getElementById('movie_player');
            if (replace) { const next = p.cloneNode(true); p.replaceWith(next); p = next; }
            const bus = new Map();
            window.buses.push(bus);
            p.addEventListener = (name, fn) => {
                if (!bus.has(name)) bus.set(name, new Set());
                bus.get(name).add(fn);
            };
            p.removeEventListener = (name, fn) => bus.get(name)?.delete(fn);
            p.getVideoData = () => ({ video_id: model.id, isAd: model.isAd });
            p.getPlayerResponse = () => ({
                videoDetails: { videoId: model.responseId, isLiveContent: model.live, isUpcoming: model.upcoming },
                playabilityStatus: model.liveStreamability ? { liveStreamability: {} } : {},
            });
            p.getAvailableQualityLevels = () => {
                reads += 1;
                if (model.readThrows) throw new Error('not initialized');
                if (model.navigateDuringRead) history.pushState({}, '', `/watch?v=${model.navigateDuringRead}`);
                if (model.replaceDuringRead) { model.replaceDuringRead = false; installPlayer(true); }
                return model.levels;
            };
            p.getPreferredQuality = () => model.preferred || 'auto';
            p.setPlaybackQuality = () => { oldSetterCalls += 1; };
            p.setPlaybackQualityRange = (min, max) => {
                writes.push({ id: model.id, min, max });
                if (!model.noAck) model.preferred = min;
                // Deliberately synchronous: exercises reentrant event races.
                for (const fn of bus.get('onPlaybackQualityChange') || []) fn();
                if (model.setterThrows) throw new Error('changed then threw');
            };
            if (model.missingSetter) delete p.setPlaybackQualityRange;
        };
        if (!model.notReady) installPlayer();
        window.signal = name => document.dispatchEvent(new Event(name));
        window.playerSignal = name => {
            for (const fn of buses.at(-1)?.get(name) || []) fn();
        };
        window.navigate = (id, event = 'yt-navigate-finish') => {
            signal('yt-navigate-start');
            history.pushState({}, '', id ? `/watch?v=${id}` : '/');
            model.id = model.responseId = id;
            model.preferred = 'auto';
            signal(event);
        };
    }, { A, options });
    await page.addScriptTag({ path: script });
    await page.clock.runFor(1);
    return { page, context, errors };
}

const writes = page => page.evaluate(() => window.writes);
async function signals(page) {
    await page.evaluate(() => {
        for (const name of ['onStateChange', 'onPlaybackQualityChange', 'videodatachange']) playerSignal(name);
        for (const name of ['yt-page-data-updated', 'yt-player-updated', 'yt-navigate-finish']) signal(name);
        const video = document.querySelector('video');
        for (const name of ['pause', 'playing', 'seeking', 'seeked', 'loadedmetadata', 'canplay']) video.dispatchEvent(new Event(name));
        document.dispatchEvent(new Event('fullscreenchange'));
        window.dispatchEvent(new Event('focus'));
        window.dispatchEvent(new PopStateEvent('popstate'));
    });
    await page.clock.runFor(60_000);
}

for (const [name, levels, expected] of [
    ['1080p preferred to 1440p and 4K', ['hd2160', 'hd1440', 'hd1080', 'hd720', 'auto'], 'hd1080'],
    ['720p maximum', ['hd720', 'large', 'medium', 'auto'], 'hd720'],
    ['480p and 360p', ['large', 'medium', 'auto'], 'large'],
    ['no 1080p but higher qualities exist', ['hd2160', 'hd1440', 'hd720', 'auto'], 'hd2160'],
    ['rank only actual options even if unsorted', ['medium', 'hd720', 'large', 'auto'], 'hd720'],
    ['unlisted future resolution', ['hd5760', 'hd2160', 'auto'], 'hd5760'],
    ['opaque future option retains player ordering', ['futureHighest', 'hd720', 'auto'], 'futureHighest'],
    ['auto excluded and duplicate levels accepted', ['auto', 'large', 'large', 'medium'], 'large'],
]) {
    test(name, async () => {
        const { page, context, errors } = await setup({ levels });
        try {
            assert.deepEqual(await writes(page), [{ id: A, min: expected, max: expected }]);
            await signals(page);
            assert.equal((await writes(page)).length, 1);
            assert.equal(await page.evaluate(() => oldSetterCalls), 0);
            assert.deepEqual(errors, []);
        } finally { await context.close(); }
    });
}

for (const manual of ['hd2160', 'large', 'auto']) {
    test(`manual ${manual}, ABR and playback actions never trigger another write`, async () => {
        const { page, context } = await setup();
        try {
            // Native UI behavior is simulated here; controller must not reclaim it.
            await page.evaluate(q => { model.preferred = q; playerSignal('onPlaybackQualityChange'); }, manual);
            await signals(page);
            assert.equal((await writes(page)).length, 1);
            assert.equal(await page.evaluate(() => model.preferred), manual);
        } finally { await context.close(); }
    });
}

test('trusted Settings interaction before readiness yields immediately, including keyboard', async () => {
    for (const keyboard of [false, true]) {
        const { page, context } = await setup({ levels: [] });
        try {
            if (keyboard) await page.getByRole('button', { name: 'Settings', exact: true }).press('Enter');
            else await page.getByRole('button', { name: 'Settings', exact: true }).click();
            await page.evaluate(() => { model.levels = ['hd1080']; model.preferred = 'large'; });
            await signals(page);
            assert.deepEqual(await writes(page), []);
            await page.evaluate(id => navigate(id), B);
            await page.clock.runFor(1);
            assert.equal((await writes(page)).length, 1);
        } finally { await context.close(); }
    }
});

test('recommendation/search SPA, playlist/autoplay, history and A-B-A each reset once', async () => {
    const { page, context } = await setup();
    try {
        await page.evaluate(id => navigate(id), B);
        await page.clock.runFor(1);
        await page.evaluate(() => { history.back(); });
        await page.waitForURL(`**/watch?v=${A}`);
        await page.evaluate(id => { model.id = model.responseId = id; signal('yt-navigate-finish'); }, A);
        await page.clock.runFor(2_001);
        // Simulate playlist/autoplay: no yt-navigate-start/finish, only media/player events.
        await page.evaluate(id => {
            history.pushState({}, '', `/watch?v=${id}&list=PLexample&index=2`);
            model.id = model.responseId = id;
            playerSignal('onStateChange');
            document.querySelector('video').dispatchEvent(new Event('loadedmetadata'));
        }, B);
        await page.clock.runFor(1);
        assert.deepEqual((await writes(page)).map(w => w.id), [A, B, A, B]);
        await signals(page);
        assert.equal((await writes(page)).length, 4);
    } finally { await context.close(); }
});

test('same-video query changes, restart and player rebuild preserve the lock', async () => {
    const { page, context } = await setup();
    try {
        await page.evaluate(() => {
            history.pushState({}, '', `${location.pathname}${location.search}&t=120&list=PLtest`);
            installPlayer(true);
        });
        await signals(page);
        assert.equal((await writes(page)).length, 1);
        assert.equal(await page.evaluate(() => [...buses[0].values()].reduce((n, fns) => n + fns.size, 0)), 0);
    } finally { await context.close(); }
});

test('slow API initialization and initially empty/auto-only lists recover within the bound', async () => {
    const { page, context } = await setup({ notReady: true, levels: ['auto'] });
    try {
        await page.clock.runFor(12_000);
        await page.evaluate(() => installPlayer());
        await page.clock.runFor(4_000);
        assert.deepEqual(await writes(page), []);
        await page.evaluate(() => { model.levels = ['hd720', 'large', 'auto']; });
        await page.clock.runFor(2_001);
        assert.deepEqual(await writes(page), [{ id: A, min: 'hd720', max: 'hd720' }]);
    } finally { await context.close(); }
});

test('expired empty lists cannot be revived by later event storms; next video still works', async () => {
    const { page, context } = await setup({ levels: [] });
    try {
        await page.clock.runFor(60_000);
        const readCount = await page.evaluate(() => reads);
        assert.ok(readCount > 1 && readCount <= 30);
        await page.evaluate(() => { model.levels = ['hd1080']; });
        await signals(page);
        assert.deepEqual(await writes(page), []);
        assert.equal(await page.evaluate(() => reads), readCount);
        await page.evaluate(id => navigate(id), B);
        await page.clock.runFor(1);
        assert.equal((await writes(page)).length, 1);
    } finally { await context.close(); }
});

test('old player/response IDs and pending tasks cannot set quality for the wrong video', async () => {
    const { page, context } = await setup({ levels: [] });
    try {
        await page.evaluate(id => {
            signal('yt-navigate-start');
            history.pushState({}, '', `/watch?v=${id}`);
            model.levels = ['hd1080'];
            signal('yt-navigate-finish');
        }, B);
        await page.clock.runFor(3_001);
        assert.deepEqual(await writes(page), []);
        await page.evaluate(id => { model.id = id; }, B);
        await page.clock.runFor(2_001);
        assert.deepEqual(await writes(page), []); // stale response still identifies A
        await page.evaluate(id => { model.responseId = id; installPlayer(true); signal('yt-player-updated'); }, B);
        await page.clock.runFor(2_001);
        assert.deepEqual(await writes(page), [{ id: B, min: 'hd1080', max: 'hd1080' }]);
    } finally { await context.close(); }
});

test('identity and element are rechecked after reading the quality list', async () => {
    for (const option of [{ navigateDuringRead: B }, { replaceDuringRead: true }]) {
        const { page, context } = await setup(option);
        try {
            assert.deepEqual(await writes(page), []);
            await page.clock.runFor(2_001);
            if (option.replaceDuringRead) assert.equal((await writes(page)).length, 1);
            else assert.deepEqual(await writes(page), []);
        } finally { await context.close(); }
    }
});

test('navigation start cancels pending work before the URL changes', async () => {
    const { page, context } = await setup({ levels: [] });
    try {
        await page.evaluate(() => { signal('yt-navigate-start'); model.levels = ['hd1080']; });
        await page.clock.runFor(10_000);
        assert.deepEqual(await writes(page), []);
        await page.evaluate(id => { history.pushState({}, '', `/watch?v=${id}`); model.id = model.responseId = id; signal('yt-navigate-finish'); }, B);
        await page.clock.runFor(1);
        assert.equal((await writes(page))[0].id, B);
    } finally { await context.close(); }
});

test('readiness getter exceptions recover; setter errors and no acknowledgement never retry', async () => {
    const ready = await setup({ readThrows: true });
    try {
        await ready.page.clock.runFor(2_000);
        await ready.page.evaluate(() => { model.readThrows = false; });
        await ready.page.clock.runFor(2_001);
        assert.equal((await writes(ready.page)).length, 1);
    } finally { await ready.context.close(); }
    for (const option of [{ setterThrows: true }, { noAck: true }, { missingSetter: true }]) {
        const { page, context, errors } = await setup(option);
        try {
            await signals(page);
            assert.equal((await writes(page)).length, option.missingSetter ? 0 : 1);
            assert.deepEqual(errors, []);
        } finally { await context.close(); }
    }
});

test('ads defer selection until content; live and premieres are excluded', async () => {
    const { page, context } = await setup({ isAd: true });
    try {
        await page.clock.runFor(4_000);
        assert.deepEqual(await writes(page), []);
        await page.evaluate(() => { model.isAd = false; document.getElementById('movie_player').classList.add('ad-showing'); });
        await page.clock.runFor(2_001);
        assert.deepEqual(await writes(page), []);
        await page.evaluate(() => document.getElementById('movie_player').classList.remove('ad-showing'));
        await page.clock.runFor(2_001);
        assert.equal((await writes(page)).length, 1);
    } finally { await context.close(); }
    for (const option of [{ live: true }, { upcoming: true }, { liveStreamability: true }]) {
        const fixture = await setup(option);
        try { await signals(fixture.page); assert.deepEqual(await writes(fixture.page), []); }
        finally { await fixture.context.close(); }
    }
});

test('leaving watch releases state; Shorts/embed/playlist pages do not receive writes', async () => {
    const { page, context } = await setup({ levels: [] });
    try {
        for (const route of [`/shorts/${A}`, `/embed/${A}`, '/playlist?list=PLtest', '/']) {
            await page.evaluate(route => { history.pushState({}, '', route); model.levels = ['hd1080']; signal('yt-navigate-finish'); }, route);
            await page.clock.runFor(2_001);
        }
        assert.deepEqual(await writes(page), []);
        await page.evaluate(id => navigate(id), A);
        await page.clock.runFor(1);
        assert.equal((await writes(page)).length, 1);
    } finally { await context.close(); }
});

test('duplicate injection and repeated navigation signals do not duplicate listeners or writes', async () => {
    const { page, context } = await setup({ levels: [] });
    try {
        await page.addScriptTag({ path: script });
        await page.evaluate(() => {
            for (let n = 0; n < 100; n++) { signal('yt-navigate-finish'); playerSignal('onStateChange'); }
            model.levels = ['hd1080'];
        });
        await page.clock.runFor(2_001);
        assert.equal((await writes(page)).length, 1);
        assert.equal(await page.evaluate(() => Math.max(...[...buses[0].values()].map(fns => fns.size))), 1);
    } finally { await context.close(); }
});

test('pagehide stops pending tasks and pageshow resumes a pending visit after navigation suspension', async () => {
    const { page, context } = await setup({ levels: [] });
    try {
        await page.evaluate(() => {
            signal('yt-navigate-start');
            window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true }));
            model.levels = ['hd1080'];
        });
        await page.clock.runFor(5_000);
        assert.deepEqual(await writes(page), []);
        await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })));
        await page.clock.runFor(1);
        assert.equal((await writes(page)).length, 1);
        await page.evaluate(() => {
            window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true }));
            window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
        });
        await page.clock.runFor(2_001);
        assert.equal((await writes(page)).length, 1);
    } finally { await context.close(); }
});

test('committed URL changes are detected without any YouTube or media events', async () => {
    const { page, context } = await setup();
    try {
        await page.evaluate(id => {
            model.id = model.responseId = id;
            history.pushState({}, '', `/watch?v=${id}`);
        }, B);
        await page.clock.runFor(1);
        await page.evaluate(id => {
            model.id = model.responseId = id;
            history.replaceState({}, '', `/watch?v=${id}`);
        }, A);
        await page.clock.runFor(1);
        assert.deepEqual((await writes(page)).map(w => w.id), [A, B, A]);
    } finally { await context.close(); }
});
