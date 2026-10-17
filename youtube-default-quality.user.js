// ==UserScript==
// @name         YouTube Default Quality (Configurable)
// @namespace    https://github.com/hmxxgit/browser_javascript_backup
// @version      2.1.0
// @description  可配置首选画质，不足时向下匹配；每个视频仅设置一次，随后尊重用户选择。
// @match        *://youtube.com/*
// @match        *://*.youtube.com/*
// @run-at       document-start
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @grant        unsafeWindow
// @sandbox      raw
// @license      MIT
// @homepageURL  https://github.com/hmxxgit/browser_javascript_backup
// @supportURL   https://github.com/hmxxgit/browser_javascript_backup/issues
// ==/UserScript==

(() => {
    'use strict';

    if (location.hostname !== 'youtube.com' && !location.hostname.endsWith('.youtube.com')) return;

    // Keep player calls in the page world even when GM permissions are enabled.
    const window = typeof unsafeWindow === 'object' ? unsafeWindow : globalThis.window;
    const document = window.document;
    const Element = window.Element;
    const HTMLVideoElement = window.HTMLVideoElement;
    // Do not use setPlaybackQuality(): it is a no-op in the inspected player.
    const INSTANCE = '__youtubeDefaultQualityOnceV1__';
    if (window[INSTANCE]) return;
    window[INSTANCE] = true;

    const PREFERENCE_KEY = 'youtube-default-quality.preferred-height';
    const QUALITY_CHOICES = [4320, 2160, 1440, 1080, 720, 480, 360, 240, 144];
    const qualityLabel = height => ({ 4320: '8K（4320P）', 2160: '4K（2160P）' }[height] || `${height}P`);
    function readPreference() {
        try {
            const height = typeof GM_getValue === 'function' ? GM_getValue(PREFERENCE_KEY, 1080) : 1080;
            return QUALITY_CHOICES.includes(height) ? height : 1080;
        } catch { return 1080; }
    }

    // Created only from the Tampermonkey menu; no persistent page button.
    let configHost = null;
    function openConfig() {
        if (!document.body) { document.addEventListener('DOMContentLoaded', openConfig, { once: true }); return; }
        if (configHost?.isConnected) { configHost.shadowRoot.querySelector('select').focus(); return; }
        const previousFocus = document.activeElement;
        configHost = document.createElement('div');
        configHost.id = 'youtube-default-quality-config';
        const host = configHost;
        const shadow = configHost.attachShadow({ mode: 'open' });
        // YouTube enforces Trusted Types: build DOM nodes rather than assigning
        // HTML strings or creating a permissive policy on the site's behalf.
        function element(tag, text, attributes = {}) {
            const node = document.createElement(tag);
            if (text) node.textContent = text;
            for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
            return node;
        }
        const style = element('style');
        style.textContent = `
            :host{all:initial} dialog{box-sizing:border-box;width:min(440px,calc(100vw - 32px));max-height:calc(100vh - 32px);overflow:auto;border:1px solid #555;border-radius:16px;padding:24px;background:#202124;color:#f1f1f1;font:15px/1.6 system-ui,sans-serif;color-scheme:dark}
            dialog::backdrop{background:#0009} h2{font-size:21px;margin:0 0 16px} label{display:block} select{width:100%;margin:8px 0;padding:9px;border:1px solid #777;border-radius:8px;font:inherit} p{color:#ccc;margin:12px 0} .actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:16px} button{border:1px solid #777;border-radius:8px;padding:8px 12px;font:inherit;cursor:pointer} button[type=submit]{background:#8ab4f8;color:#111;border-color:#8ab4f8} [role=status]{min-height:24px;color:#ffd580}
        `;
        const dialog = element('dialog', '', { 'aria-labelledby': 'title' });
        const form = element('form');
        const select = element('select', '', { id: 'quality', name: 'quality' });
        const status = element('div', '', { role: 'status', 'aria-live': 'polite' });
        const actions = element('div', '', { class: 'actions' });
        actions.append(element('button', '保存', { type: 'submit' }),
            element('button', '保存并刷新', { type: 'button', id: 'reload' }),
            element('button', '关闭', { type: 'button', id: 'cancel' }));
        form.append(element('h2', 'YouTube 默认画质', { id: 'title' }),
            element('label', '首选清晰度', { for: 'quality' }), select,
            element('p', '优先选择设定档位；没有时，向下选择实际可用的最高画质，不向上匹配。'),
            element('p', '保存后从下一个视频或刷新后生效；当前视频的手动选择保持不变。'),
            status, actions);
        dialog.append(form);
        shadow.append(style, dialog);
        for (const height of QUALITY_CHOICES) {
            const option = document.createElement('option');
            option.value = String(height);
            option.textContent = qualityLabel(height);
            select.append(option);
        }
        select.value = String(readPreference());
        function save(reload) {
            const height = Number(select.value);
            if (!QUALITY_CHOICES.includes(height)) { status.textContent = '请选择有效的清晰度。'; return; }
            try {
                if (typeof GM_setValue !== 'function') throw new Error('GM_setValue unavailable');
                GM_setValue(PREFERENCE_KEY, height);
                status.textContent = `已保存 ${qualityLabel(height)}，下一个视频或刷新后生效。`;
                if (reload) window.location.reload();
            } catch { status.textContent = '保存失败，请检查 Tampermonkey 权限后重试。'; }
        }
        shadow.querySelector('form').addEventListener('submit', event => { event.preventDefault(); save(false); });
        shadow.querySelector('#reload').addEventListener('click', () => save(true));
        function cleanup() {
            if (!host.isConnected) return;
            host.remove();
            if (configHost === host) configHost = null;
            if (previousFocus?.isConnected) previousFocus.focus();
        }
        function closeConfig() { dialog.close(); cleanup(); }
        shadow.querySelector('#cancel').addEventListener('click', closeConfig);
        dialog.addEventListener('cancel', event => { event.preventDefault(); closeConfig(); });
        dialog.addEventListener('close', cleanup);
        document.body.append(configHost);
        dialog.showModal();
        select.focus();
    }
    if (typeof GM_registerMenuCommand === 'function') {
        GM_registerMenuCommand('设置首选清晰度…', openConfig, { accessKey: 'q', clickedFrame: true });
    }

    const WAIT_MS = 45_000;
    const MAX_PROBES = 30;
    const PLAYER_EVENTS = ['onReady', 'onStateChange', 'onPlaybackQualityChange', 'videodatachange'];
    const PLAYER_SELECTOR = '#movie_player, #shorts-player, .html5-video-player';
    // Memory belongs to this document only. A full reload of the same video
    // starts a fresh session using the saved preference, even after a manual choice.
    let session = null;
    let player = null;
    let timer = null;
    let navigating = false;

    function urlVideoId() {
        const url = new URL(location.href);
        const id = url.pathname === '/watch' ? url.searchParams.get('v') :
            /^\/(?:shorts|live|embed|v)\/([\w-]{11})(?:\/|$)/.exec(url.pathname)?.[1];
        return /^[\w-]{11}$/.test(id || '') ? id : null;
    }

    function playerVideoId(candidate) {
        try {
            const data = candidate?.getVideoData?.();
            const id = data?.video_id || data?.videoId;
            return /^[\w-]{11}$/.test(id || '') ? id : null;
        } catch { return null; }
    }

    function findPlayer() {
        let candidates = [...document.querySelectorAll(PLAYER_SELECTOR)];
        const expected = urlVideoId();
        if (expected) {
            const matching = candidates.filter(candidate => playerVideoId(candidate) === expected);
            if (matching.length) candidates = matching;
        }
        // Shorts can keep off-screen players around. Prefer the visible player
        // that is actually playing; URL identity still guards stale/preloaded IDs.
        const visible = candidates.filter(candidate => {
            const rect = candidate.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.right > 0 &&
                rect.top < innerHeight && rect.left < innerWidth && getComputedStyle(candidate).visibility !== 'hidden';
        });
        return visible.find(candidate => {
            const video = candidate.querySelector('video');
            return video && !video.paused;
        }) || visible.find(candidate => typeof candidate.getVideoData === 'function') ||
            visible[0] || (candidates.length === 1 ? candidates[0] : null);
    }

    function cancelTimer() {
        if (timer !== null) clearTimeout(timer);
        timer = null;
    }

    function finish(state, phase) {
        if (session !== state) return;
        state.phase = phase;
        cancelTimer();
    }

    function bindPlayer(next) {
        if (player === next) return;
        if (player && typeof player.removeEventListener === 'function') {
            for (const name of PLAYER_EVENTS) {
                try { player.removeEventListener(name, refresh); } catch { /* disposed player */ }
            }
        }
        player = next;
        if (player && typeof player.addEventListener === 'function') {
            for (const name of PLAYER_EVENTS) {
                try { player.addEventListener(name, refresh); } catch { /* not ready yet */ }
            }
        }
    }

    function schedule(state, delay) {
        if (session !== state || state.phase !== 'waiting' || navigating || timer !== null) return;
        timer = setTimeout(() => {
            timer = null;
            probe(state);
        }, Math.max(0, Math.min(delay, state.deadline - Date.now())));
    }

    // One state per consecutive active video, not a permanent map of viewed IDs.
    // A -> B -> A runs again; seek, replay, fullscreen and URL parameters keep A locked.
    function refresh() {
        const candidate = findPlayer();
        // Channel/home players can disappear briefly during rebuilding. Retain
        // the same visit's lock until a different ID or page is observed.
        const id = urlVideoId() || playerVideoId(candidate) ||
            (session?.bootstrapUrl === location.href ? session.id : null);
        if (!session || id !== session.id || (!id && session.bootstrapUrl !== location.href)) {
            cancelTimer();
            // A null-ID bootstrap also has a bound: discover delayed players on
            // channel/playlist/home pages without requiring a /watch URL first.
            session = { id, phase: 'waiting', probes: 0, deadline: Date.now() + WAIT_MS,
                bootstrapUrl: location.href, playbackStarted: false, preferredHeight: readPreference() };
        }
        // The initial element can exist before YouTube attaches its API. Do not bind
        // the DOM addEventListener and mistake it for the player's event bus.
        bindPlayer(typeof candidate?.getVideoData === 'function' ? candidate : null);
        noticeContentPlayback(session, candidate);
        if (session) schedule(session, 0);
    }

    function chooseQuality(levels, preferredHeight) {
        if (!Array.isArray(levels)) return null;
        const legacy = { tiny: 144, small: 240, medium: 360, large: 480 };
        const height = q => /^hd\d+$/.test(q) ? Number(q.slice(2)) : legacy[q];
        // Rank actual options only. Unknown IDs cannot safely be placed below a
        // user-selected ceiling, so do not guess or silently choose a higher tier.
        const available = [...new Set(levels.filter(q => typeof q === 'string' &&
            height(q) > 0 && height(q) <= preferredHeight))];
        return available.reduce((best, q) => !best || height(q) > height(best) ? q : best, null);
    }

    function matches(state, candidate) {
        const expected = urlVideoId();
        if (session !== state || !state.id || state.phase !== 'waiting' || navigating ||
            (expected && expected !== state.id) || findPlayer() !== candidate || !candidate.isConnected) return false;
        // URL alone is unsafe during SPA navigation. Require player identity and
        // also check response identity when exposed (not all embeds expose it).
        const responseId = typeof candidate.getPlayerResponse === 'function' ?
            candidate.getPlayerResponse()?.videoDetails?.videoId : null;
        return playerVideoId(candidate) === state.id && (!responseId || responseId === state.id);
    }

    function nativeQualityOption(candidate, target) {
        if (typeof candidate.getAvailableQualityData !== 'function') return null;
        const data = candidate.getAvailableQualityData();
        if (!Array.isArray(data)) return null;
        const normalize = text => text.replace(/\s+/g, ' ').trim();
        // Match current, playable, non-paygated labels exactly. Do not guess a menu
        // index, translate "Auto", or accidentally choose an enhanced-bitrate tier.
        const labels = new Set(data.filter(q => q.quality === target && q.isPlayable !== false &&
            !q.paygatedQualityDetails && typeof q.qualityLabel === 'string').map(q => normalize(q.qualityLabel)));
        for (const item of candidate.querySelectorAll('.ytp-quality-menu [role="menuitemradio"]')) {
            if (item.getAttribute('aria-disabled') === 'true') continue;
            const label = item.querySelector('.ytp-menuitem-label')?.cloneNode(true);
            if (!label) continue;
            // HD/4K/HDR badges are presentation, not part of qualityLabel.
            for (const badge of label.querySelectorAll('sup')) badge.remove();
            if (labels.has(normalize(label.textContent))) return item;
        }
        return null;
    }

    // An internal range request can leave the native menu on Auto. Lazily build
    // YouTube's OWN quality menu once, then select its actual fixed option. The
    // advanced-menu command was checked in the current player source and UI.
    function prepareNativeSelection(state, candidate, target) {
        const existing = nativeQualityOption(candidate, target);
        if (existing) return { option: existing, restore() {} };
        const button = candidate.querySelector('.ytp-settings-button');
        if (typeof candidate.openSettingsMenuItem !== 'function' || !button) {
            return { option: null, restore() {} }; // players without this native UI
        }
        if (state.menuPrepared) return { waiting: true, restore() {} };
        state.menuPrepared = true;
        // The programmatic advanced-menu command can show the popup before the
        // gear's aria-expanded is updated. The player's shown class is authoritative.
        const isExpanded = () => candidate.classList.contains('ytp-settings-shown') ||
            button.getAttribute('aria-expanded') === 'true';
        const expanded = isExpanded();
        const previousFocus = document.activeElement;
        const attribute = 'data-yt-default-quality-preparing';
        const previousAttribute = candidate.getAttribute(attribute);
        const style = document.createElement('style');
        style.textContent = `[${attribute}] .ytp-settings-menu{visibility:hidden!important}`;
        candidate.setAttribute(attribute, '');
        candidate.append(style);
        const restore = () => {
            try {
                if (candidate.isConnected && playerVideoId(candidate) === state.id) {
                    // The first click can merely release YouTube's programmatic
                    // popup latch. At most two UI toggles; neither writes quality.
                    for (let n = 0; n < 2 && isExpanded() !== expanded; n++) button.click();
                }
            } finally {
                style.remove();
                if (previousAttribute === null) candidate.removeAttribute(attribute);
                else candidate.setAttribute(attribute, previousAttribute);
                if (previousFocus?.isConnected && document.activeElement !== previousFocus) previousFocus.focus();
            }
        };
        try {
            candidate.openSettingsMenuItem('menu_item_video_quality_advanced');
            const option = nativeQualityOption(candidate, target);
            if (option) return { option, restore };
            // Some player versions construct options asynchronously. Retry READS
            // only; never repeatedly open menus or issue an extra range request.
            restore();
            return { waiting: true, restore() {} };
        } catch (error) { restore(); throw error; }
    }

    function noticeContentPlayback(state, candidate) {
        if (!state || state.playbackStarted || !state.id || navigating ||
            !['waiting', 'expired'].includes(state.phase)) return;
        try {
            if (playerVideoId(candidate) !== state.id ||
                candidate.classList.contains('ad-showing') || candidate.classList.contains('ad-interrupting') ||
                candidate.getVideoData()?.isAd || candidate.getPlayerState?.() !== 1) return;
            // Ad playback must not consume this opportunity. Check API events too:
            // native `playing` may fire before getPlayerState() reports main content.
            state.playbackStarted = true;
            state.phase = 'waiting';
            state.probes = 0;
            state.deadline = Date.now() + WAIT_MS;
        } catch { /* a disposed / not-yet-ready player cannot unlock anything */ }
    }

    function probe(state) {
        if (session !== state || state.phase !== 'waiting' || navigating) return;
        const candidate = findPlayer();
        const detectedId = urlVideoId() || playerVideoId(candidate);
        if (detectedId && detectedId !== state.id) { refresh(); return; }
        noticeContentPlayback(state, candidate);
        if (Date.now() >= state.deadline || state.probes >= MAX_PROBES) {
            finish(state, 'expired');
            if (state.id) console.warn('[YouTube Default Quality] 本轮等待超时；首次主视频播放仍可触发一次就绪检查。');
            return;
        }
        state.probes += 1;
        const retryDelay = Math.min(500 * (2 ** (state.probes - 1)), 2_000);
        bindPlayer(typeof candidate?.getVideoData === 'function' ? candidate : null);
        try {
            if (typeof candidate?.getVideoData === 'function' &&
                typeof candidate.getAvailableQualityLevels === 'function' &&
                typeof candidate.setPlaybackQualityRange === 'function' &&
                matches(state, candidate) &&
                !candidate.classList.contains('ad-showing') &&
                !candidate.classList.contains('ad-interrupting') &&
                !candidate.getVideoData()?.isAd) {
                // One policy for every content type: live, premiere, replay,
                // Shorts and embeds. Only actual quality availability matters.
                const target = chooseQuality(candidate.getAvailableQualityLevels(), state.preferredHeight);
                if (!target || !matches(state, candidate)) { schedule(state, retryDelay); return; }
                const selection = prepareNativeSelection(state, candidate, target);
                if (selection.waiting) { schedule(state, retryDelay); return; }
                try {
                    if (!matches(state, candidate)) { schedule(state, retryDelay); return; }
                    // Lock before the ONLY quality action. Native menu creation is
                    // readiness work, not a successful quality setting.
                    finish(state, 'attempted');
                    if (selection.option) selection.option.click();
                    else candidate.setPlaybackQualityRange(target, target);
                    // Preference acknowledgement is not proof that decoded frames
                    // already have this resolution. Read only; never fight ABR.
                    if (typeof candidate.getPreferredQuality === 'function' &&
                        candidate.getPreferredQuality() === target &&
                        (!selection.option || selection.option.getAttribute('aria-checked') === 'true')) {
                        state.phase = 'applied';
                    } else {
                        console.warn('[YouTube Default Quality] 已请求画质，未确认首选档位；不重复设置。');
                    }
                    return;
                } finally { selection.restore(); }
            }
        } catch (error) {
            // A setter may mutate and then throw. Retrying it could override a user
            // choice, so only read/readiness failures are eligible for retries.
            if (state.phase !== 'waiting') {
                console.warn('[YouTube Default Quality] 设置接口异常；为保护手动选择，不再重试。', error);
                return;
            }
        }
        schedule(state, retryDelay);
    }

    function yieldToUser(event) {
        if (!event.isTrusted || !(event.target instanceof Element)) return;
        const option = event.target.closest('.ytp-quality-menu [role="menuitemradio"]');
        if (!option || option.getAttribute('aria-disabled') === 'true') return;
        if (event.type === 'keydown' && !['Enter', ' ', 'Spacebar'].includes(event.key)) return;
        if (event.type === 'pointerdown' && event.button !== 0) return;
        refresh();
        if (!player?.contains(option)) return;
        // Opening Settings, viewing Auto (1080p), or moving keyboard focus is not
        // a manual quality choice. Only activating a quality option yields control.
        if (session && ['waiting', 'expired'].includes(session.phase)) finish(session, 'manual');
    }

    for (const name of ['pointerdown', 'click', 'keydown']) {
        document.addEventListener(name, yieldToUser, true);
    }
    document.addEventListener('yt-navigate-start', () => {
        navigating = true;
        cancelTimer();
    });
    document.addEventListener('yt-navigate-finish', () => {
        navigating = false;
        refresh();
    });
    for (const name of ['DOMContentLoaded', 'yt-page-data-updated', 'yt-player-updated']) {
        document.addEventListener(name, refresh);
    }
    // Media events do not bubble. Capture them to notice a new/rebuilt player,
    // including playlist/autoplay transitions. Terminal sessions never write again.
    for (const name of ['loadstart', 'loadedmetadata', 'canplay', 'playing']) {
        document.addEventListener(name, event => {
            if (!(event.target instanceof HTMLVideoElement)) return;
            refresh();
        }, true);
    }
    window.addEventListener('popstate', refresh);
    // Chromium's committed-entry event also covers pushState/replaceState without
    // patching History, in case a transition omits YouTube's navigation events.
    window.navigation?.addEventListener('currententrychange', refresh);
    window.addEventListener('pageshow', () => { navigating = false; refresh(); });
    window.addEventListener('pagehide', () => { cancelTimer(); bindPlayer(null); });
    refresh();
})();
