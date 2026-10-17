const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const path = require('node:path');
const { readFileSync } = require('node:fs');

// Offline browser fixtures: these prove controller behavior, not YouTube API support.
const script = path.join(__dirname, '..', 'youtube-default-quality.user.js');
const A = 'aqz-KE-bpKQ';
const B = 'jNQXAC9IVRw';
let browser;
before(async () => { browser = await chromium.launch({ channel: process.env.X_UI_BROWSER || 'msedge', headless: true }); });
after(async () => { await browser?.close(); });

test('userscript metadata covers YouTube hosts and iframe execution', () => {
    const source = readFileSync(script, 'utf8');
    assert.match(source, /@match\s+\*:\/\/youtube\.com\/\*/);
    assert.match(source, /@match\s+\*:\/\/\*\.youtube\.com\/\*/);
    assert.doesNotMatch(source, /@noframes/);
    for (const grant of ['GM_getValue', 'GM_setValue', 'GM_registerMenuCommand', 'unsafeWindow']) {
        assert.match(source, new RegExp(`@grant\\s+${grant}`));
    }
    assert.doesNotMatch(source, /@grant\s+none/);
});

async function setup(options = {}) {
    const context = await browser.newContext();
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.clock.install();
    await page.route('**/*', route => route.fulfill({
        contentType: 'text/html',
        ...(options.trustedTypes ? { headers: { 'Content-Security-Policy': "require-trusted-types-for 'script'" } } : {}),
        body: '<div id="movie_player" data-test-player><video></video><button class="ytp-settings-button">Settings</button><div class="ytp-settings-menu"><div class="ytp-quality-menu"><button role="menuitemradio" aria-checked="false"><span class="ytp-menuitem-label">1080p60 Premium</span></button><button role="menuitemradio" aria-checked="false"><span class="ytp-menuitem-label">1080p60 <sup>HD</sup></span></button><button role="menuitemradio" aria-checked="false"><span class="ytp-menuitem-label">480p</span></button><button role="menuitemradio" aria-checked="true"><span class="ytp-menuitem-label">Auto</span></button></div></div></div>',
    }));
    await page.goto(`${options.origin || 'https://www.youtube.com'}${options.route || `/watch?v=${A}`}`);
    await page.evaluate(({ A, options }) => {
        window.model = { state: 1, id: A, responseId: A, levels: ['hd2160', 'hd1440', 'hd1080', 'hd720', 'large', 'auto'], ...options };
        window.gmValues = { 'youtube-default-quality.preferred-height': options.preferredHeight ?? 1080 };
        window.gmMenus = new Map();
        window.GM_getValue = (key, fallback) => {
            if (model.storageReadThrows) throw new Error('storage unavailable');
            return key in gmValues ? gmValues[key] : fallback;
        };
        window.GM_setValue = (key, value) => {
            if (model.storageWriteThrows) throw new Error('storage unavailable');
            gmValues[key] = value;
        };
        window.GM_registerMenuCommand = (name, callback) => gmMenus.set(name, callback);
        window.writes = [];
        window.reads = 0;
        window.oldSetterCalls = 0;
        window.nativeActions = 0;
        for (const video of document.querySelectorAll('video')) {
            Object.defineProperty(video, 'readyState', { configurable: true, get: () => model.mediaReady ?? 4 });
            Object.defineProperty(video, 'currentSrc', { configurable: true, get: () => model.mediaSource || 'blob:main' });
        }
        window.settingsClicks = 0;
        window.buses = [];
        document.querySelector('.ytp-settings-button').addEventListener('click', event => {
            settingsClicks += 1;
            const p = document.querySelector('[data-test-player]');
            if (model.firstCloseIgnored && p.classList.contains('ytp-settings-shown')) { model.firstCloseIgnored = false; return; }
            const expanded = !p.classList.contains('ytp-settings-shown');
            p.classList.toggle('ytp-settings-shown', expanded);
            event.currentTarget.setAttribute('aria-expanded', String(expanded));
        });
        for (const [index, item] of [...document.querySelectorAll('[role="menuitemradio"]')].entries()) {
            const quality = ['premium1080', 'hd1080', 'large', 'auto'][index];
            item.addEventListener('click', () => {
                nativeActions += 1;
                if (!model.nativeMisses || nativeActions > model.nativeMisses) model.preferred = quality;
                writes.push({ id: model.id, min: quality, max: quality });
                for (const radio of document.querySelectorAll('[role="menuitemradio"]')) radio.setAttribute('aria-checked', String(radio === item));
            });
        }
        window.menuOpens = 0;
        if (model.lazyNativeMenu) {
            window.pendingQualityMenu = document.querySelector('.ytp-quality-menu');
            pendingQualityMenu.remove();
        }
        window.installPlayer = (replace = false) => {
            let p = document.querySelector('[data-test-player]');
            if (replace) { const next = p.cloneNode(true); p.replaceWith(next); p = next; }
            for (const video of p.querySelectorAll('video')) {
                Object.defineProperty(video, 'readyState', { configurable: true, get: () => model.mediaReady ?? 4 });
                Object.defineProperty(video, 'currentSrc', { configurable: true, get: () => model.mediaSource || 'blob:main' });
            }
            const bus = new Map();
            window.buses.push(bus);
            p.addEventListener = (name, fn) => {
                if (!bus.has(name)) bus.set(name, new Set());
                bus.get(name).add(fn);
            };
            p.removeEventListener = (name, fn) => bus.get(name)?.delete(fn);
            p.getVideoData = () => ({ video_id: model.id, isAd: model.isAd });
            p.getPlayerResponse = () => ({
                videoDetails: { videoId: model.responseId, isLiveContent: model.live, isLive: model.isLive, isUpcoming: model.upcoming },
                playabilityStatus: { status: model.playabilityStatus || 'OK', ...(model.liveStreamability ? { liveStreamability: {} } : {}) },
                microformat: { playerMicroformatRenderer: { liveBroadcastDetails: model.broadcast } },
            });
            p.getAvailableQualityLevels = () => {
                reads += 1;
                if (model.readThrows) throw new Error('not initialized');
                if (model.navigateDuringRead) history.pushState({}, '', `/watch?v=${model.navigateDuringRead}`);
                if (model.replaceDuringRead) { model.replaceDuringRead = false; installPlayer(true); }
                return model.levels;
            };
            p.getPreferredQuality = () => model.preferred || 'auto';
            p.getPlaybackQuality = () => model.playback || 'unknown';
            p.getPlayerState = () => model.state ?? -1;
            if (model.nativeMenu) p.getAvailableQualityData = () => [
                { quality: 'hd1080', qualityLabel: '1080p60 Premium', paygatedQualityDetails: {} },
                { quality: 'hd1080', qualityLabel: '1080p60', isPlayable: true },
                { quality: 'large', qualityLabel: '480p', isPlayable: true },
            ];
            if (model.lazyNativeMenu) p.openSettingsMenuItem = key => {
                if (key !== 'menu_item_video_quality_advanced') throw new Error('wrong native menu key');
                menuOpens += 1;
                p.classList.add('ytp-settings-shown');
                p.querySelector('.ytp-settings-button').setAttribute('aria-expanded', model.staleSettingsAria ? 'false' : 'true');
                if (model.nativeOpenThrows) throw new Error('menu not ready');
                const append = () => p.querySelector('.ytp-settings-menu').append(pendingQualityMenu);
                if (model.lazyMenuAsync) setTimeout(append, 0);
                else append();
                if (model.navigateDuringNativeOpen) {
                    model.id = model.responseId = model.navigateDuringNativeOpen;
                    history.pushState({}, '', `/watch?v=${model.id}`);
                }
            };
            p.setPlaybackQuality = () => { oldSetterCalls += 1; };
            p.setPlaybackQualityRange = (min, max) => {
                writes.push({ id: model.id, min, max });
                if (!model.noAck) model.preferred = min;
                // Deliberately synchronous: exercises reentrant event races.
                for (const fn of bus.get('onPlaybackQualityChange') || []) fn();
                if (model.setterThrows) throw new Error('changed then threw');
            };
            if (model.missingSetter) delete p.setPlaybackQualityRange;
            if (model.noResponseApi) delete p.getPlayerResponse;
            if (model.playerId) { p.id = model.playerId; p.classList.add('html5-video-player'); }
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
    if (options.trustedTypes) await page.evaluate(readFileSync(script, 'utf8'));
    else await page.addScriptTag({ path: script });
    await page.clock.runFor(2_501);
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
    ['missing 1080p falls downward even when higher qualities exist', ['hd2160', 'hd1440', 'hd720', 'auto'], 'hd720'],
    ['rank only actual options even if unsorted', ['medium', 'hd720', 'large', 'auto'], 'hd720'],
    ['future resolution above the ceiling is excluded', ['hd5760', 'hd720', 'auto'], 'hd720'],
    ['opaque future option does not bypass the ceiling', ['futureHighest', 'hd720', 'auto'], 'hd720'],
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

test('trusted quality option activation before readiness yields, including keyboard', async () => {
    for (const keyboard of [false, true]) {
        const { page, context } = await setup({ levels: [] });
        try {
            if (keyboard) await page.getByRole('menuitemradio', { name: '480p', exact: true }).press('Enter');
            else await page.getByRole('menuitemradio', { name: '480p', exact: true }).click();
            await page.evaluate(() => { model.levels = ['hd1080']; model.preferred = 'large'; });
            await signals(page);
            assert.deepEqual(await writes(page), [{ id: A, min: 'large', max: 'large' }]);
            await page.evaluate(id => navigate(id), B);
            await page.clock.runFor(2_501);
            assert.equal((await writes(page)).length, 2);
        } finally { await context.close(); }
    }
});

test('viewing Settings or navigating quality options does not cancel pending automatic selection', async () => {
    const { page, context } = await setup({ levels: [] });
    try {
        await page.getByRole('button', { name: 'Settings', exact: true }).click();
        await page.getByRole('menuitemradio', { name: 'Auto', exact: true }).press('ArrowUp');
        await page.evaluate(() => { model.levels = ['hd1080']; });
        await page.clock.runFor(4_001);
        assert.deepEqual(await writes(page), [{ id: A, min: 'hd1080', max: 'hd1080' }]);
    } finally { await context.close(); }
});

for (const preferred of ['auto', 'hd1080']) {
    test(`already decoding 1080p with preference ${preferred} still gets an explicit setting on every visit`, async () => {
        const { page, context } = await setup({ playback: 'hd1080', preferred });
        try {
            assert.deepEqual(await writes(page), [{ id: A, min: 'hd1080', max: 'hd1080' }]);
            await page.evaluate(id => navigate(id), B);
            await page.clock.runFor(2_501);
            await page.evaluate(id => navigate(id), A);
            await page.clock.runFor(2_501);
            assert.deepEqual((await writes(page)).map(w => w.id), [A, B, A]);
            await signals(page);
            assert.equal((await writes(page)).length, 3);
        } finally { await context.close(); }
    });
}

for (const hidden of [false, true]) {
    test(`Auto 1080p uses an existing ${hidden ? 'hidden' : 'visible'} native option once and updates its checked state`, async () => {
        const { page, context } = await setup({ levels: [], nativeMenu: true, playback: 'hd1080', preferred: 'auto' });
        try {
            await page.evaluate(hidden => {
                if (hidden) document.querySelector('.ytp-settings-menu').style.display = 'none';
                model.levels = ['hd2160', 'hd1080', 'large'];
            }, hidden);
            await page.clock.runFor(4_001);
            assert.deepEqual(await writes(page), [{ id: A, min: 'hd1080', max: 'hd1080' }]);
            assert.equal(await page.evaluate(() => model.preferred), 'hd1080');
            assert.equal(await page.locator('[aria-checked="true"]').textContent(), '1080p60 HD');
            assert.equal(await page.evaluate(() => nativeActions), 1);
            assert.equal(await page.evaluate(() => settingsClicks), 0);
            await signals(page);
            assert.equal((await writes(page)).length, 1);
        } finally { await context.close(); }
    });
}

test('manual Auto remains Auto after native automatic selection, even while decoding 1080p', async () => {
    const { page, context } = await setup({ nativeMenu: true, playback: 'hd1080', preferred: 'auto' });
    try {
        await page.getByRole('menuitemradio', { name: 'Auto', exact: true }).click();
        await signals(page);
        assert.equal(await page.evaluate(() => model.preferred), 'auto');
        assert.equal((await writes(page)).length, 2); // one script choice plus one user choice
    } finally { await context.close(); }
});

test('recommendation/search SPA, playlist/autoplay, history and A-B-A each reset once', async () => {
    const { page, context } = await setup();
    try {
        await page.evaluate(id => navigate(id), B);
        await page.clock.runFor(2_501);
        await page.evaluate(() => { history.back(); });
        await page.waitForURL(`**/watch?v=${A}`);
        await page.evaluate(id => { model.id = model.responseId = id; signal('yt-navigate-finish'); }, A);
        await page.clock.runFor(4_001);
        // Simulate playlist/autoplay: no yt-navigate-start/finish, only media/player events.
        await page.evaluate(id => {
            history.pushState({}, '', `/watch?v=${id}&list=PLexample&index=2`);
            model.id = model.responseId = id;
            playerSignal('onStateChange');
            document.querySelector('video').dispatchEvent(new Event('loadedmetadata'));
        }, B);
        await page.clock.runFor(2_501);
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
        await page.clock.runFor(4_001);
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
        await page.clock.runFor(2_501);
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
        await page.clock.runFor(4_001);
        assert.deepEqual(await writes(page), []); // stale response still identifies A
        await page.evaluate(id => { model.responseId = id; installPlayer(true); signal('yt-player-updated'); }, B);
        await page.clock.runFor(4_001);
        assert.deepEqual(await writes(page), [{ id: B, min: 'hd1080', max: 'hd1080' }]);
    } finally { await context.close(); }
});

test('identity and element are rechecked after reading the quality list', async () => {
    for (const option of [{ navigateDuringRead: B }, { replaceDuringRead: true }]) {
        const { page, context } = await setup(option);
        try {
            assert.deepEqual(await writes(page), []);
            await page.clock.runFor(4_001);
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
        await page.clock.runFor(2_501);
        assert.equal((await writes(page))[0].id, B);
    } finally { await context.close(); }
});

test('readiness getter exceptions recover; setter errors and no acknowledgement never retry', async () => {
    const ready = await setup({ readThrows: true });
    try {
        await ready.page.clock.runFor(2_000);
        await ready.page.evaluate(() => { model.readThrows = false; });
        await ready.page.clock.runFor(4_001);
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

test('ads defer selection until content; live and premieres share the quality policy', async () => {
    const { page, context } = await setup({ isAd: true });
    try {
        await page.clock.runFor(4_000);
        assert.deepEqual(await writes(page), []);
        await page.evaluate(() => { model.isAd = false; document.getElementById('movie_player').classList.add('ad-showing'); });
        await page.clock.runFor(4_001);
        assert.deepEqual(await writes(page), []);
        await page.evaluate(() => document.getElementById('movie_player').classList.remove('ad-showing'));
        await page.clock.runFor(4_001);
        assert.equal((await writes(page)).length, 1);
    } finally { await context.close(); }
    for (const option of [{ live: true }, { upcoming: true }, { liveStreamability: true }]) {
        const fixture = await setup(option);
        try { await signals(fixture.page); assert.equal((await writes(fixture.page)).length, 1); }
        finally { await fixture.context.close(); }
    }
});

for (const [name, options, shouldApply] of [
    ['ended replay with isLiveContent flag', { live: true, broadcast: { isLiveNow: false, endTimestamp: '2026-10-17T01:00:05+00:00' } }, true],
    ['ended replay retaining liveStreamability', { live: true, liveStreamability: true, broadcast: { isLiveNow: false, endTimestamp: '2026-10-17T01:00:05+00:00' } }, true],
    ['live content needs no end timestamp', { live: true, broadcast: { isLiveNow: false } }, true],
    ['active live with end metadata', { live: true, isLive: true, broadcast: { endTimestamp: '2026-10-17T01:00:05+00:00' } }, true],
    ['active live by isLiveNow', { live: true, broadcast: { isLiveNow: true, endTimestamp: '2026-10-17T01:00:05+00:00' } }, true],
    ['upcoming with usable quality options', { live: true, upcoming: true, broadcast: { endTimestamp: '2026-10-17T01:00:05+00:00' } }, true],
    ['active-live flag without isLiveContent', { isLive: true }, true],
    ['offline status does not blacklist usable quality options', { playabilityStatus: 'LIVE_STREAM_OFFLINE' }, true],
]) {
    test(`live classification: ${name}`, async () => {
        const { page, context } = await setup({ ...options, preferred: 'auto', playback: 'hd720' });
        try {
            assert.equal((await writes(page)).length, shouldApply ? 1 : 0);
            if (shouldApply) {
                assert.equal(await page.evaluate(() => model.preferred), 'hd1080');
                await page.evaluate(() => { model.preferred = 'large'; playerSignal('onPlaybackQualityChange'); });
            }
            await signals(page);
            assert.equal((await writes(page)).length, shouldApply ? 1 : 0);
            if (shouldApply) assert.equal(await page.evaluate(() => model.preferred), 'large');
        } finally { await context.close(); }
    });
}

test('replay metadata is not required before applying the default once', async () => {
    const { page, context } = await setup({ live: true, preferred: 'auto', playback: 'hd720' });
    try {
        await page.clock.runFor(2_000);
        assert.equal((await writes(page)).length, 1);
        await page.evaluate(() => { model.broadcast = { isLiveNow: false, endTimestamp: '2026-10-17T01:00:05+00:00' }; });
        await page.clock.runFor(4_001);
        assert.deepEqual(await writes(page), [{ id: A, min: 'hd1080', max: 'hd1080' }]);
        await signals(page);
        assert.equal((await writes(page)).length, 1);
    } finally { await context.close(); }
});

for (const route of [`/shorts/${A}`, `/live/${A}`, `/embed/${A}`, `/v/${A}`, '/playlist?list=PLtest', '/']) {
    test(`all YouTube routes apply the same policy: ${route}`, async () => {
        const { page, context } = await setup({ route, playerId: route.includes('shorts') ? 'shorts-player' : 'movie_player' });
        try {
            assert.deepEqual(await writes(page), [{ id: A, min: 'hd1080', max: 'hd1080' }]);
        } finally { await context.close(); }
    });
}

for (const origin of ['https://youtube.com', 'http://www.youtube.com', 'https://m.youtube.com', 'https://music.youtube.com']) {
    test(`YouTube host coverage: ${origin}`, async () => {
        const { page, context } = await setup({ origin });
        try { assert.equal((await writes(page)).length, 1); }
        finally { await context.close(); }
    });
}

for (const origin of ['https://youtube.com.example.org', 'https://notyoutube.com']) {
    test(`unrelated host is not a YouTube domain: ${origin}`, async () => {
        const { page, context } = await setup({ origin });
        try { assert.deepEqual(await writes(page), []); }
        finally { await context.close(); }
    });
}

test('embedded player may expose identity without the internal response API', async () => {
    const { page, context } = await setup({ route: `/embed/${A}`, noResponseApi: true });
    try { assert.equal((await writes(page)).length, 1); }
    finally { await context.close(); }
});

test('a waiting premiere can start after the bounded readiness window expires', async () => {
    const { page, context } = await setup({ upcoming: true, levels: [], state: -1 });
    try {
        await page.clock.runFor(60_000);
        assert.deepEqual(await writes(page), []);
        await page.evaluate(() => {
            model.levels = ['hd1080', 'hd720'];
            model.state = 1;
            document.querySelector('video').dispatchEvent(new Event('playing'));
        });
        await page.clock.runFor(2_501);
        assert.equal((await writes(page)).length, 1);
        await page.evaluate(() => { model.preferred = 'large'; });
        await signals(page);
        assert.equal((await writes(page)).length, 1);
        assert.equal(await page.evaluate(() => model.preferred), 'large');
    } finally { await context.close(); }
});

test('Shorts chooses the visible player rather than an offscreen duplicate with the same ID', async () => {
    const { page, context } = await setup({ route: `/shorts/${A}`, playerId: 'shorts-player', levels: [] });
    try {
        await page.evaluate(() => {
            const current = document.getElementById('shorts-player');
            const offscreen = document.createElement('div');
            offscreen.id = 'movie_player';
            offscreen.style.cssText = 'position:fixed;top:-10000px;width:100px;height:100px';
            offscreen.getVideoData = () => ({ video_id: model.id });
            offscreen.getPlayerResponse = () => ({ videoDetails: { videoId: model.id } });
            offscreen.getAvailableQualityLevels = () => ['hd1080'];
            offscreen.setPlaybackQualityRange = () => { throw new Error('wrong player selected'); };
            current.before(offscreen);
            model.levels = ['hd1080'];
        });
        await page.clock.runFor(4_001);
        assert.equal((await writes(page)).length, 1);
    } finally { await context.close(); }
});

test('a late player on a route without a video ID is discovered without persistent polling', async () => {
    const { page, context } = await setup({ route: '/', notReady: true });
    try {
        await page.clock.runFor(12_000);
        assert.deepEqual(await writes(page), []);
        await page.evaluate(() => installPlayer());
        await page.clock.runFor(4_001);
        assert.equal((await writes(page)).length, 1);
        await signals(page);
        assert.equal((await writes(page)).length, 1);
    } finally { await context.close(); }
});

for (const pending of [false, true]) {
    test(`routeless player rebuild retains the visit lock (pending=${pending})`, async () => {
        const { page, context } = await setup({ route: '/@channel/live', ...(pending ? { levels: [] } : {}) });
        try {
            await page.evaluate(() => {
                window.detached = document.querySelector('[data-test-player]');
                detached.remove();
                model.preferred = 'large';
                signal('yt-player-updated');
            });
            await page.clock.runFor(3_000);
            await page.evaluate(() => {
                document.body.append(detached);
                model.levels = ['hd1080'];
                installPlayer(true);
                signal('yt-player-updated');
            });
            await page.clock.runFor(4_001);
            assert.equal((await writes(page)).length, 1);
            assert.equal(await page.evaluate(() => model.preferred), pending ? 'hd1080' : 'large');
        } finally { await context.close(); }
    });
}

test('duplicate injection and repeated navigation signals do not duplicate listeners or writes', async () => {
    const { page, context } = await setup({ levels: [] });
    try {
        await page.addScriptTag({ path: script });
        await page.evaluate(() => {
            for (let n = 0; n < 100; n++) { signal('yt-navigate-finish'); playerSignal('onStateChange'); }
            model.levels = ['hd1080'];
        });
        await page.clock.runFor(4_001);
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
        await page.clock.runFor(2_501);
        assert.equal((await writes(page)).length, 1);
        await page.evaluate(() => {
            window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true }));
            window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
        });
        await page.clock.runFor(4_001);
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
        await page.clock.runFor(2_501);
        await page.evaluate(id => {
            model.id = model.responseId = id;
            history.replaceState({}, '', `/watch?v=${id}`);
        }, A);
        await page.clock.runFor(2_501);
        assert.deepEqual((await writes(page)).map(w => w.id), [A, B, A]);
    } finally { await context.close(); }
});

for (const [preferredHeight, levels, expected] of [
    [2160, ['hd4320', 'hd2160', 'hd1440', 'hd1080'], 'hd2160'],
    [2160, ['hd4320', 'hd1440', 'hd1080'], 'hd1440'],
    [1440, ['hd2160', 'hd1080', 'hd720'], 'hd1080'],
    [720, ['hd2160', 'hd1080', 'hd720', 'large'], 'hd720'],
    [720, ['hd1080', 'large', 'medium'], 'large'],
    [480, ['hd1080', 'large', 'medium'], 'large'],
    [360, ['large', 'medium', 'small'], 'medium'],
    [240, ['medium', 'small', 'tiny'], 'small'],
    [144, ['small', 'tiny'], 'tiny'],
    [4320, ['hd5760', 'hd2880', 'hd2160'], 'hd2880'],
]) {
    test(`saved preference ${preferredHeight} selects ${expected} without exceeding the ceiling`, async () => {
        const { page, context } = await setup({ preferredHeight, levels });
        try { assert.deepEqual(await writes(page), [{ id: A, min: expected, max: expected }]); }
        finally { await context.close(); }
    });
}

test('no known option below the ceiling waits finitely without selecting higher or Auto', async () => {
    const { page, context } = await setup({ preferredHeight: 720, levels: ['hd2160', 'hd1080', 'futureUnknown', 'auto'] });
    try {
        await signals(page);
        assert.deepEqual(await writes(page), []);
        assert.ok(await page.evaluate(() => reads) <= 30);
    } finally { await context.close(); }
});

for (const options of [{ preferredHeight: '2160' }, { preferredHeight: 9999 }, { storageReadThrows: true }]) {
    test(`invalid or unavailable saved preference defaults to 1080p: ${JSON.stringify(options)}`, async () => {
        const { page, context } = await setup(options);
        try { assert.deepEqual(await writes(page), [{ id: A, min: 'hd1080', max: 'hd1080' }]); }
        finally { await context.close(); }
    });
}

async function openConfig(page) {
    await page.evaluate(() => gmMenus.get('设置首选清晰度…')());
    return page.locator('#youtube-default-quality-config');
}

test('Tampermonkey menu opens one accessible configuration panel and close/Escape removes it', async () => {
    const { page, context } = await setup();
    try {
        assert.equal(await page.evaluate(() => gmMenus.size), 1);
        const panel = await openConfig(page);
        assert.equal(await panel.getByLabel('首选清晰度').inputValue(), '1080');
        assert.equal(await panel.locator('option').count(), 9);
        await openConfig(page);
        assert.equal(await page.locator('#youtube-default-quality-config').count(), 1);
        await page.keyboard.press('Escape');
        assert.equal(await panel.count(), 0);
        await openConfig(page);
        await panel.getByRole('button', { name: '关闭', exact: true }).click();
        assert.equal(await panel.count(), 0);
    } finally { await context.close(); }
});

test('saving a preference persists it for new visits and other-tab changes without overriding the current video', async () => {
    const { page, context } = await setup();
    try {
        await page.evaluate(() => { model.preferred = 'large'; });
        const panel = await openConfig(page);
        await panel.getByLabel('首选清晰度').selectOption('2160');
        await panel.getByRole('button', { name: '保存', exact: true }).click();
        assert.equal(await page.evaluate(() => gmValues['youtube-default-quality.preferred-height']), 2160);
        await panel.getByRole('button', { name: '关闭', exact: true }).click();
        await signals(page);
        assert.equal((await writes(page)).length, 1);
        assert.equal(await page.evaluate(() => model.preferred), 'large');
        await page.evaluate(id => navigate(id), B);
        await page.clock.runFor(2_501);
        assert.equal((await writes(page)).at(-1).min, 'hd2160');
        // GM storage is shared between tabs/domains; read it on every new visit.
        await page.evaluate(id => { gmValues['youtube-default-quality.preferred-height'] = 720; navigate(id); }, A);
        await page.clock.runFor(2_501);
        assert.equal((await writes(page)).at(-1).min, 'hd720');
        await openConfig(page);
        assert.equal(await panel.getByLabel('首选清晰度').inputValue(), '720');
    } finally { await context.close(); }
});

test('saving during initialization keeps this visit preference snapshot and manual protection', async () => {
    const { page, context } = await setup({ levels: [] });
    try {
        const panel = await openConfig(page);
        await panel.getByLabel('首选清晰度').selectOption('720');
        await panel.getByRole('button', { name: '保存', exact: true }).click();
        await panel.getByRole('button', { name: '关闭', exact: true }).click();
        await page.evaluate(() => { model.levels = ['hd1080', 'hd720']; });
        await page.clock.runFor(4_001);
        assert.equal((await writes(page)).at(-1).min, 'hd1080');
    } finally { await context.close(); }
});

test('configuration storage failure is visible and closing without saving leaves defaults unchanged', async () => {
    const { page, context } = await setup({ storageWriteThrows: true });
    try {
        const panel = await openConfig(page);
        await panel.getByLabel('首选清晰度').selectOption('1440');
        await panel.getByRole('button', { name: '保存', exact: true }).click();
        assert.match(await panel.getByRole('status').innerText(), /保存失败/);
        assert.equal(await page.evaluate(() => gmValues['youtube-default-quality.preferred-height']), 1080);
        await panel.getByRole('button', { name: '关闭', exact: true }).click();
        await openConfig(page);
        assert.equal(await panel.getByLabel('首选清晰度').inputValue(), '1080');
    } finally { await context.close(); }
});

test('save-and-reload persists the chosen height before reloading the same document URL', async () => {
    const { page, context } = await setup();
    try {
        await page.evaluate(() => {
            const original = GM_setValue;
            window.GM_setValue = (key, value) => {
                original(key, value);
                sessionStorage.setItem('test-last-config-write', JSON.stringify({ key, value }));
            };
        });
        const url = page.url();
        const panel = await openConfig(page);
        await panel.getByLabel('首选清晰度').selectOption('1440');
        await Promise.all([
            page.waitForEvent('domcontentloaded'),
            panel.getByRole('button', { name: '保存并刷新', exact: true }).click(),
        ]);
        assert.equal(page.url(), url);
        assert.deepEqual(await page.evaluate(() => JSON.parse(sessionStorage.getItem('test-last-config-write'))), {
            key: 'youtube-default-quality.preferred-height', value: 1440,
        });
        assert.equal(await page.evaluate(() => window.__youtubeDefaultQualityOnceV1__), undefined);
    } finally { await context.close(); }
});


test('configuration opens and saves under YouTube-style Trusted Types enforcement', async () => {
    const { page, context, errors } = await setup({ trustedTypes: true });
    try {
        assert.equal(await page.evaluate(() => {
            try { document.createElement('div').innerHTML = '<b>blocked</b>'; return false; }
            catch { return true; }
        }), true);
        const panel = await openConfig(page);
        await panel.getByLabel('首选清晰度').selectOption('2160');
        await panel.getByRole('button', { name: '保存', exact: true }).click();
        assert.equal(await page.evaluate(() => gmValues['youtube-default-quality.preferred-height']), 2160);
        assert.deepEqual(errors, []);
    } finally { await context.close(); }
});


for (const lazyMenuAsync of [false, true]) {
    test(`lazy native menu is prepared once, fixes Auto 1080p and restores UI (async=${lazyMenuAsync})`, async () => {
        const { page, context, errors } = await setup({ nativeMenu: true, lazyNativeMenu: true,
            lazyMenuAsync, preferred: 'auto', playback: 'hd1080' });
        try {
            await page.clock.runFor(4_001);
            assert.equal(await page.evaluate(() => menuOpens), 1);
            assert.equal(await page.evaluate(() => nativeActions), 1);
            assert.deepEqual(await writes(page), [{ id: A, min: 'hd1080', max: 'hd1080' }]);
            assert.equal(await page.getByRole('menuitemradio', { name: 'Auto', exact: true }).getAttribute('aria-checked'), 'false');
            assert.equal(await page.getByRole('menuitemradio', { name: '1080p60 HD', exact: true }).getAttribute('aria-checked'), 'true');
            assert.equal(await page.locator('.ytp-settings-button').getAttribute('aria-expanded'), 'false');
            assert.equal(await page.locator('[data-yt-default-quality-preparing]').count(), 0);
            assert.deepEqual(errors, []);
            await page.evaluate(() => { model.preferred = 'auto'; });
            await signals(page);
            assert.equal((await writes(page)).length, 1);
            assert.equal(await page.evaluate(() => model.preferred), 'auto');
            assert.equal(await page.evaluate(() => menuOpens), 1);
        } finally { await context.close(); }
    });
}

test('native menu preparation failure restores UI and never loops or falls back to a second quality action', async () => {
    const { page, context } = await setup({ nativeMenu: true, lazyNativeMenu: true, nativeOpenThrows: true });
    try {
        await signals(page);
        assert.equal(await page.evaluate(() => menuOpens), 1);
        assert.deepEqual(await writes(page), []);
        assert.equal(await page.locator('.ytp-settings-button').getAttribute('aria-expanded'), 'false');
        assert.equal(await page.locator('[data-yt-default-quality-preparing]').count(), 0);
    } finally { await context.close(); }
});

test('navigation during menu preparation cannot apply the old video selection to the new video', async () => {
    const { page, context } = await setup({ nativeMenu: true, lazyNativeMenu: true, navigateDuringNativeOpen: B });
    try {
        await page.clock.runFor(4_001);
        assert.deepEqual((await writes(page)).map(x => x.id), [B]);
        assert.equal(await page.locator('[data-yt-default-quality-preparing]').count(), 0);
    } finally { await context.close(); }
});

test('long ads do not consume the main-content opportunity, even if playing arrives before the player state', async () => {
    const { page, context } = await setup({ isAd: true, state: 1 });
    try {
        await page.clock.runFor(60_000);
        assert.deepEqual(await writes(page), []);
        await page.evaluate(() => {
            model.isAd = false;
            model.state = 3;
            document.querySelector('video').dispatchEvent(new Event('playing'));
        });
        await page.clock.runFor(2_501);
        assert.deepEqual(await writes(page), []);
        await page.evaluate(() => { model.state = 1; playerSignal('onStateChange'); });
        await page.clock.runFor(2_501);
        assert.equal((await writes(page)).length, 1);
        await page.evaluate(() => { model.preferred = 'auto'; });
        await signals(page);
        assert.equal((await writes(page)).length, 1);
        assert.equal(await page.evaluate(() => model.preferred), 'auto');
    } finally { await context.close(); }
});

test('manual selection after expiry remains protected when the first content playback starts later', async () => {
    const { page, context } = await setup({ levels: [] });
    try {
        await page.clock.runFor(60_000);
        await page.getByRole('menuitemradio', { name: '480p', exact: true }).click();
        await page.evaluate(() => { model.levels = ['hd1080', 'large']; model.state = 1; playerSignal('onStateChange'); });
        await signals(page);
        assert.deepEqual(await writes(page), [{ id: A, min: 'large', max: 'large' }]);
    } finally { await context.close(); }
});

test('repeated playback events cannot keep extending the main-content readiness window', async () => {
    const { page, context } = await setup({ levels: [], state: 1 });
    try {
        await signals(page);
        assert.ok(await page.evaluate(() => reads) <= 30);
        await page.evaluate(() => { model.levels = ['hd1080']; playerSignal('onStateChange'); });
        await page.clock.runFor(4_001);
        assert.deepEqual(await writes(page), []);
    } finally { await context.close(); }
});


for (const firstCloseIgnored of [false, true]) {
    test(`native popup restoration handles stale aria-expanded and a programmatic latch (${firstCloseIgnored})`, async () => {
        const { page, context } = await setup({ nativeMenu: true, lazyNativeMenu: true,
            staleSettingsAria: true, firstCloseIgnored });
        try {
            assert.equal((await writes(page)).length, 1);
            assert.equal(await page.locator('.ytp-settings-shown').count(), 0);
            assert.equal(await page.evaluate(() => settingsClicks), firstCloseIgnored ? 2 : 1);
            assert.equal(await page.evaluate(() => menuOpens), 1);
            assert.equal(await page.locator('[data-yt-default-quality-preparing]').count(), 0);
        } finally { await context.close(); }
    });
}


for (const nativeMisses of [1, 99]) {
    test(`unacknowledged native Auto clicks retry only within a three-action bound (${nativeMisses})`, async () => {
        const { page, context } = await setup({ nativeMenu: true, preferred: 'auto', nativeMisses });
        try {
            await page.clock.runFor(10_000);
            assert.equal(await page.evaluate(() => nativeActions), nativeMisses === 1 ? 2 : 3);
            assert.equal(await page.evaluate(() => model.preferred), nativeMisses === 1 ? 'hd1080' : 'auto');
            await signals(page);
            await page.clock.runFor(60_000);
            assert.equal(await page.evaluate(() => nativeActions), nativeMisses === 1 ? 2 : 3);
        } finally { await context.close(); }
    });
}

test('manual Auto during native confirmation cancels every pending retry', async () => {
    const { page, context } = await setup({ nativeMenu: true, preferred: 'auto', nativeMisses: 99 });
    try {
        await page.clock.runFor(100);
        assert.equal(await page.evaluate(() => nativeActions), 1);
        await page.getByRole('menuitemradio', { name: 'Auto', exact: true }).press('Enter');
        await signals(page);
        await page.clock.runFor(60_000);
        assert.equal(await page.evaluate(() => nativeActions), 2); // one script click, one user action
    } finally { await context.close(); }
});

test('delayed native acknowledgement ends confirmation without a second selection', async () => {
    const { page, context } = await setup({ nativeMenu: true, preferred: 'auto', nativeMisses: 99 });
    try {
        await page.clock.runFor(100);
        await page.evaluate(() => { model.preferred = 'hd1080'; playerSignal('onPlaybackQualityChange'); });
        await page.clock.runFor(10_000);
        assert.equal(await page.evaluate(() => nativeActions), 1);
    } finally { await context.close(); }
});

test('navigation cancels an unconfirmed native selection before retrying the next video', async () => {
    const { page, context } = await setup({ nativeMenu: true, preferred: 'auto', nativeMisses: 1 });
    try {
        assert.equal(await page.evaluate(() => nativeActions), 1);
        await page.evaluate(id => navigate(id), B);
        await page.clock.runFor(10_000);
        const actions = await writes(page);
        assert.deepEqual(actions.map(action => action.id), [A, B]);
        await signals(page);
        assert.equal(await page.evaluate(() => nativeActions), 2);
    } finally { await context.close(); }
});

test('manual 480p during native confirmation cannot be overridden by a pending retry', async () => {
    const { page, context } = await setup({ nativeMenu: true, preferred: 'auto', nativeMisses: 1 });
    try {
        await page.getByRole('menuitemradio', { name: '480p', exact: true }).press('Enter');
        await signals(page);
        assert.equal(await page.evaluate(() => model.preferred), 'large');
        assert.equal(await page.evaluate(() => nativeActions), 2);
    } finally { await context.close(); }
});


test('available levels before actual media readiness cannot consume the automatic selection', async () => {
    const { page, context } = await setup({ nativeMenu: true, mediaReady: 0 });
    try {
        assert.equal(await page.evaluate(() => nativeActions), 0);
        await page.evaluate(() => { model.mediaReady = 4; playerSignal('onStateChange'); });
        await page.clock.runFor(1_000);
        assert.equal(await page.evaluate(() => nativeActions), 0);
        await page.clock.runFor(4_001);
        assert.equal(await page.evaluate(() => nativeActions), 1);
    } finally { await context.close(); }
});

test('a startup media source replacement restarts stability before the only successful choice', async () => {
    const { page, context } = await setup({ nativeMenu: true, mediaReady: 0 });
    try {
        await page.evaluate(() => { model.mediaReady = 4; playerSignal('onStateChange'); });
        await page.clock.runFor(1_000);
        await page.evaluate(() => { model.mediaSource = 'blob:final'; document.querySelector('video').dispatchEvent(new Event('loadstart')); });
        await page.clock.runFor(1_000);
        assert.equal(await page.evaluate(() => nativeActions), 0);
        await page.clock.runFor(4_001);
        assert.equal(await page.evaluate(() => nativeActions), 1);
    } finally { await context.close(); }
});

test('manual choice while media is initializing cancels the future stable-media selection', async () => {
    const { page, context } = await setup({ nativeMenu: true, mediaReady: 0 });
    try {
        await page.getByRole('menuitemradio', { name: '480p', exact: true }).press('Enter');
        await page.evaluate(() => { model.mediaReady = 4; playerSignal('onStateChange'); });
        await signals(page);
        assert.equal(await page.evaluate(() => nativeActions), 1);
        assert.equal(await page.evaluate(() => model.preferred), 'large');
    } finally { await context.close(); }
});
