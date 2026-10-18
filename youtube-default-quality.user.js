// ==UserScript==
// @name         YouTube Default Quality (Configurable)
// @namespace    https://github.com/hmxxgit/browser_javascript_backup
// @version      2.4.0
// @description  可配置首选画质，不足时向下匹配；进入视频强制固定档位，不使用 Auto。
// @author       hmxxgit
// @match        *://youtube.com/*
// @match        *://*.youtube.com/*
// @match        *://youtube-nocookie.com/*
// @match        *://*.youtube-nocookie.com/*
// @run-at       document-start
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @grant        unsafeWindow
// @sandbox      raw
// @license      MIT
// @homepageURL  https://github.com/hmxxgit/browser_javascript_backup
// @supportURL   https://github.com/hmxxgit/browser_javascript_backup/issues
// @updateURL    https://raw.githubusercontent.com/hmxxgit/browser_javascript_backup/main/youtube-default-quality.user.js
// @downloadURL  https://raw.githubusercontent.com/hmxxgit/browser_javascript_backup/main/youtube-default-quality.user.js
// ==/UserScript==

(() => {
    'use strict';

    const host = location.hostname;
    if (host !== 'youtube.com' && host !== 'youtube-nocookie.com' &&
        !host.endsWith('.youtube.com') && !host.endsWith('.youtube-nocookie.com')) return;

    // Keep player calls in the page world even when GM permissions are enabled.
    const window = typeof unsafeWindow === 'object' ? unsafeWindow : globalThis.window;
    const document = window.document;
    const Element = window.Element;
    const HTMLVideoElement = window.HTMLVideoElement;
    // Do not use setPlaybackQuality(): it is a no-op in the inspected player.
    const INSTANCE = '__youtubeDefaultQualityOnceV1__';
    if (window[INSTANCE]) return;

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
    const WAIT_MS = 45_000;
    const MAX_PROBES = 30;
    // YouTube's SPA router normally emits both navigation events. A cancelled
    // or interrupted navigation must not leave the visit paused forever.
    const NAVIGATION_TIMEOUT_MS = 15_000;
    const LEGACY_QUALITY_HEIGHTS = { tiny: 144, small: 240, medium: 360, large: 480, highres: 2160 };
    const REAPPLY_MENU_LABEL = '重新应用画质（覆盖本视频手动选择）';
    const RETRY_HINT = '可在 Tampermonkey 菜单选择“重新应用画质”重试。';
    const PLAYER_EVENTS = ['onReady', 'onStateChange', 'onPlaybackQualityChange', 'videodatachange'];
    const PLAYER_SELECTOR = '#movie_player, #shorts-player, .html5-video-player';
    // Memory belongs to this document only. A full reload of the same video
    // starts a fresh session using the saved preference, even after a manual choice.
    let session = null;
    let player = null;
    let timer = null;
    let navigationWatchdog = null;
    let navigating = false;
    let suspended = false;
    let refreshQueued = false;

    // Player and DOM notifications often arrive in one burst. Navigation and
    // manual input still cancel synchronously; discovery is coalesced per task.
    function requestRefresh() {
        if (suspended || refreshQueued) return;
        refreshQueued = true;
        queueMicrotask(() => {
            refreshQueued = false;
            if (!suspended) refresh();
        });
    }

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
            candidates = candidates.filter(candidate => playerVideoId(candidate) === expected);
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

    function startNavigation() {
        navigating = true;
        cancelTimer();
        session?.menu?.restore?.();
        if (navigationWatchdog !== null) clearTimeout(navigationWatchdog);
        navigationWatchdog = setTimeout(() => {
            navigationWatchdog = null;
            if (!navigating) return;
            navigating = false;
            console.warn('[YouTube Default Quality] 未收到导航结束事件；已恢复待命。' + RETRY_HINT);
            refresh();
        }, NAVIGATION_TIMEOUT_MS);
    }

    function endNavigation() {
        navigating = false;
        if (navigationWatchdog !== null) clearTimeout(navigationWatchdog);
        navigationWatchdog = null;
    }

    function finish(state, phase) {
        if (session !== state) return;
        state.phase = state.manualOverride ? 'manual' : phase;
        state.readyMedia = null;
        state.pendingNative = null;
        cancelTimer();
        state.menu?.restore?.();
        state.menu = null;
    }

    function bindPlayer(next) {
        if (player === next) return;
        if (player && typeof player.removeEventListener === 'function') {
            for (const name of PLAYER_EVENTS) {
                try { player.removeEventListener(name, requestRefresh); } catch { /* disposed player */ }
            }
        }
        player = next;
        if (player && typeof player.addEventListener === 'function') {
            for (const name of PLAYER_EVENTS) {
                try { player.addEventListener(name, requestRefresh); } catch { /* not ready yet */ }
            }
        }
    }

    function schedule(state, delay) {
        if (session !== state || state.manualOverride || state.phase !== 'waiting' ||
            suspended || navigating || timer !== null) return;
        timer = setTimeout(() => {
            timer = null;
            probe(state);
        }, Math.max(0, Math.min(delay, state.deadline - Date.now())));
    }

    // One state per consecutive active video, not a permanent map of viewed IDs.
    // A -> B -> A runs again; seek, replay, fullscreen and URL parameters keep A locked.
    function refresh() {
        if (suspended) return;
        const candidate = findPlayer();
        // Channel/home players can disappear briefly during rebuilding. Retain
        // the same visit's lock until a different ID or page is observed.
        const id = urlVideoId() || playerVideoId(candidate) ||
            (session?.bootstrapUrl === location.href ? session.id : null);
        if (!session || id !== session.id || (!id && session.bootstrapUrl !== location.href)) {
            const bootstrapManual = session && !session.id && session.manualOverride &&
                session.manualPlayer === candidate && session.bootstrapUrl === location.href;
            cancelTimer();
            session?.menu?.restore?.();
            // A null-ID bootstrap also has a bound: discover delayed players on
            // channel/playlist/home pages without requiring a /watch URL first.
            session = { id, phase: bootstrapManual ? 'manual' : 'waiting', manualOverride: !!bootstrapManual,
                probes: 0, deadline: Date.now() + WAIT_MS,
                bootstrapUrl: location.href, playbackStarted: false, preferredHeight: readPreference() };
        }
        // The initial element can exist before YouTube attaches its API. Do not bind
        // the DOM addEventListener and mistake it for the player's event bus.
        bindPlayer(typeof candidate?.getVideoData === 'function' ? candidate : null);
        noticeContentPlayback(session, candidate);
        if (session) schedule(session, 0);
    }

    // Explicit recovery path: a visit that expired, was manually locked or lost
    // a navigation event can be restarted without reloading the page.
    function reapplyCurrent() {
        if (suspended) return;
        if (!session) { refresh(); return; }
        session.menu?.restore?.();
        session.menu = null;
        session.manualOverride = false;
        session.phase = 'waiting';
        session.probes = 0;
        session.deadline = Date.now() + WAIT_MS;
        session.readyMedia = null;
        session.pendingNative = null;
        session.playbackStarted = false;
        session.menuAttempts = 0;
        session.nativeAttempts = 0;
        endNavigation();
        cancelTimer();
        refresh();
        if (session) schedule(session, 0);
    }

    function qualityHeight(level) {
        if (typeof level !== 'string') return 0;
        if (/^hd\d+$/.test(level)) return Number(level.slice(2));
        return LEGACY_QUALITY_HEIGHTS[level] || 0;
    }

    function chooseQuality(levels, preferredHeight) {
        if (!Array.isArray(levels)) return null;
        // Rank actual options only. Unknown IDs cannot safely be placed below a
        // user-selected ceiling, so do not guess or silently choose a higher tier.
        const available = [...new Set(levels.filter(q =>
            qualityHeight(q) > 0 && qualityHeight(q) <= preferredHeight))];
        return available.reduce((best, q) =>
            !best || qualityHeight(q) > qualityHeight(best) ? q : best, null);
    }

    function normalizeLabel(text) {
        return text.replace(/\s+/g, ' ').trim();
    }

    // Recognise quality choices without relying on the desktop-only
    // `.ytp-quality-menu` container, so manual picks on other player surfaces
    // still hand control back to the user.
    function qualityLabels(candidate) {
        const labels = new Set(['auto', '自动']);
        try {
            const data = candidate?.getAvailableQualityData?.();
            if (Array.isArray(data)) {
                for (const item of data) {
                    if (item && typeof item.qualityLabel === 'string') {
                        labels.add(normalizeLabel(item.qualityLabel));
                    }
                }
            }
        } catch { /* the container match below still covers the desktop menu */ }
        try {
            for (const level of candidate?.getAvailableQualityLevels?.() || []) {
                const height = qualityHeight(level);
                if (height > 0) labels.add(`${height}p`);
            }
        } catch { /* a disposed player cannot contribute labels */ }
        return labels;
    }

    function qualityMenuItem(target) {
        const item = target.closest?.('[role="menuitemradio"]');
        if (!item || item.getAttribute('aria-disabled') === 'true') return null;
        const owner = item.closest(PLAYER_SELECTOR);
        if (!owner) return null;
        // The desktop quality panel is unambiguous; only fall back to label
        // matching for players that use a different container.
        if (item.closest('.ytp-quality-menu')) return item;
        const label = item.querySelector('.ytp-menuitem-label');
        const text = normalizeLabel((label || item).textContent || '').toLowerCase();
        if (!text) return null;
        for (const known of qualityLabels(owner)) {
            const lower = known.toLowerCase();
            if (text === lower || text.startsWith(`${lower} `)) return item;
        }
        return /^(auto|自动)(\s*\([^)]*\))?$/i.test(text) ? item : null;
    }

    function isAutoMenuItem(item) {
        const label = item.querySelector('.ytp-menuitem-label') || item;
        const text = normalizeLabel(label.textContent || '');
        return /^(auto|自动)(\s*\([^)]*\))?$/i.test(text);
    }

    // getPreferredQuality() can report the requested fixed tier while YouTube's
    // own Settings summary still says "Auto". Read the user-visible summary so
    // a false positive does not end the visit on Auto.
    function qualitySummaryText(candidate) {
        const menu = candidate.querySelector('.ytp-settings-menu');
        if (!menu) return null;
        for (const item of menu.querySelectorAll('.ytp-menuitem')) {
            if (item.closest('.ytp-quality-menu')) continue;
            const content = item.querySelector('.ytp-menuitem-content');
            const text = normalizeLabel(content?.textContent || '');
            if (!text) continue;
            // Match only "Auto" with an optional resolution suffix, or a
            // resolution label. Do not mistake captions such as "Auto-translate"
            // for the Quality summary.
            if (/^(auto|自动)(?:\s*\([^)]*\))?$/i.test(text) ||
                /^\d{3,4}p(?:\d{2})?(?:\s|$)/i.test(text)) return text;
        }
        return null;
    }

    function nativeCheckedQuality(candidate) {
        const checked = candidate.querySelector('.ytp-quality-menu [role="menuitemradio"][aria-checked="true"]');
        if (!checked) return null;
        const label = checked.querySelector('.ytp-menuitem-label') || checked;
        return normalizeLabel(label.textContent || '');
    }

    // null means the summary is not available yet; true/false is authoritative.
    function summaryMatches(summary, target) {
        if (summary === null) return null;
        if (/^(auto|自动)(?:\s|\(|$)/i.test(summary)) return false;
        const height = qualityHeight(target);
        return height > 0 ? summary.toLowerCase().includes(`${height}p`) : true;
    }

    function matches(state, candidate) {
        const expected = urlVideoId();
        if (session !== state || state.manualOverride || !state.id || state.phase !== 'waiting' ||
            suspended || navigating ||
            (expected && expected !== state.id) || findPlayer() !== candidate || !candidate.isConnected) return false;
        // URL alone is unsafe during SPA navigation. Require player identity and
        // also check response identity when exposed (not all embeds expose it).
        const responseId = typeof candidate.getPlayerResponse === 'function' ?
            candidate.getPlayerResponse()?.videoDetails?.videoId : null;
        const data = candidate.getVideoData();
        return (data?.video_id || data?.videoId) === state.id && (!responseId || responseId === state.id) &&
            !candidate.classList.contains('ad-showing') && !candidate.classList.contains('ad-interrupting') &&
            !data?.isAd;
    }

    function nativeQualityOption(candidate, target) {
        if (typeof candidate.getAvailableQualityData !== 'function') return null;
        const data = candidate.getAvailableQualityData();
        if (!Array.isArray(data)) return null;
        // Match current, playable, non-paygated labels exactly. Do not guess a menu
        // index, translate "Auto", or accidentally choose an enhanced-bitrate tier.
        const labels = new Set(data.filter(q => q && typeof q === 'object' &&
            q.quality === target && q.isPlayable === true &&
            !q.paygatedQualityDetails && typeof q.qualityLabel === 'string').map(q => normalizeLabel(q.qualityLabel)));
        for (const item of candidate.querySelectorAll('.ytp-quality-menu [role="menuitemradio"]')) {
            if (item.closest(PLAYER_SELECTOR) !== candidate) continue;
            if (item.getAttribute('aria-disabled') === 'true') continue;
            const label = item.querySelector('.ytp-menuitem-label')?.cloneNode(true);
            if (!label) continue;
            // HD/4K/HDR badges are presentation, not part of qualityLabel.
            for (const badge of label.querySelectorAll('sup')) badge.remove();
            if (labels.has(normalizeLabel(label.textContent))) return item;
        }
        return null;
    }

    // An internal range request can leave the native menu on Auto. Lazily build
    // YouTube's OWN quality menu, then select its actual fixed option. The
    // advanced-menu command was checked in the current player source and UI.
    function prepareNativeSelection(state, candidate, target) {
        let preparation = state.menu;
        if (preparation && (preparation.player !== candidate || preparation.target !== target)) {
            preparation.restore?.();
            state.menu = preparation = null;
        }
        const existing = nativeQualityOption(candidate, target);
        if (existing) {
            if (preparation) preparation.phase = 'ready';
            return { option: existing, restore: () => preparation?.restore?.() };
        }
        const button = candidate.querySelector('.ytp-settings-button');
        if (typeof candidate.getAvailableQualityData !== 'function' ||
            typeof candidate.openSettingsMenuItem !== 'function' || !button) {
            if (typeof candidate.getAvailableQualityData === 'function') {
                const data = candidate.getAvailableQualityData();
                const entries = Array.isArray(data) ? data.filter(q => q?.quality === target) : [];
                // A fallback must not bypass an explicit unplayable/paygated tier.
                if (entries.length && !entries.some(q => q.isPlayable === true && !q.paygatedQualityDetails)) {
                    return { unavailable: true };
                }
            }
            return { option: null, restore() {} }; // guarded Range fallback
        }
        if (preparation?.phase === 'pending') {
            if (Date.now() < preparation.deadline) return { waiting: true };
            preparation.phase = 'failed';
            preparation.restore?.();
            preparation.nextAt = Date.now() + 500;
        }
        if (preparation?.nextAt > Date.now()) return { waiting: true };
        if ((state.menuAttempts || 0) >= 2) return { unavailable: true };
        const isExpanded = () => candidate.classList.contains('ytp-settings-shown') ||
            button.getAttribute('aria-expanded') === 'true';
        // An already-open Settings panel belongs to the user, but it must not
        // block the fixed selection. openSettingsMenuItem switches that panel
        // to the quality list; leave the panel open and never steal its focus.
        const userPanel = isExpanded();
        preparation = state.menu = { player: candidate, target, phase: 'preparing', userPanel };
        state.menuAttempts = (state.menuAttempts || 0) + 1;
        const previousFocus = document.activeElement;
        const attribute = 'data-yt-default-quality-preparing';
        const previousAttribute = candidate.getAttribute(attribute);
        const style = document.createElement('style');
        style.textContent = `[${attribute}] .ytp-settings-menu{visibility:hidden!important}`;
        if (!userPanel) {
            candidate.setAttribute(attribute, '');
            candidate.append(style);
        }
        let restored = false;
        preparation.restore = () => {
            if (restored) return;
            restored = true;
            try {
                const expected = urlVideoId();
                const sameContent = session === state && candidate.isConnected &&
                    (!expected || expected === state.id) && playerVideoId(candidate) === state.id;
                // Restore only our untouched popup while it still belongs to the
                // old content. Navigation-start/pagehide may clean it before the
                // identity changes; a replacement/new identity is never toggled.
                if (sameContent && !state.manualOverride && !preparation.userInteraction &&
                    !preparation.userPanel) {
                    for (let n = 0; n < 2 && isExpanded(); n++) button.click();
                }
            } catch {
                // A disposed popup must not prevent style/listener cleanup.
            } finally {
                style.remove();
                if (previousAttribute === null) candidate.removeAttribute(attribute);
                else candidate.setAttribute(attribute, previousAttribute);
                if (!preparation.userInteraction && !preparation.focusMoved &&
                    !preparation.userPanel &&
                    !state.manualOverride && !navigating && !suspended &&
                    session === state && candidate.isConnected &&
                    (!urlVideoId() || urlVideoId() === state.id) && playerVideoId(candidate) === state.id &&
                    previousFocus?.isConnected && document.activeElement !== previousFocus) {
                    try { previousFocus.focus(); } catch { /* disposed focus target */ }
                }
            }
        };
        try {
            candidate.openSettingsMenuItem('menu_item_video_quality_advanced');
            if (!matches(state, candidate)) {
                preparation.phase = 'failed'; preparation.restore();
                return { waiting: true };
            }
            const option = nativeQualityOption(candidate, target);
            if (option) {
                preparation.phase = 'ready';
                return { option, restore: preparation.restore };
            }
            // Keep the lazily built native panel alive for a bounded async read;
            // closing it immediately can destroy options before they are built.
            preparation.phase = 'pending';
            preparation.deadline = Date.now() + 1_500;
            return { waiting: true };
        } catch {
            preparation.phase = 'failed';
            preparation.restore();
            preparation.nextAt = Date.now() + 500;
            return { waiting: true };
        }
    }

    function noticeContentPlayback(state, candidate) {
        if (!state || state.manualOverride || state.playbackStarted || !state.id || suspended || navigating ||
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
        if (session !== state || state.manualOverride || state.phase !== 'waiting' || suspended || navigating) return;
        const candidate = findPlayer();
        const detectedId = urlVideoId() || playerVideoId(candidate);
        if (detectedId && detectedId !== state.id) { refresh(); return; }
        noticeContentPlayback(state, candidate);
        if (candidate?.classList.contains('ad-showing') || candidate?.classList.contains('ad-interrupting')) state.readyMedia = null;
        if (Date.now() >= state.deadline || state.probes >= MAX_PROBES) {
            finish(state, 'expired');
            if (state.id) console.warn('[YouTube Default Quality] 本轮等待超时；首次主视频播放仍可触发一次就绪检查。' + RETRY_HINT);
            return;
        }
        state.probes += 1;
        const retryDelay = Math.min(500 * (2 ** (state.probes - 1)), 2_000);
        bindPlayer(typeof candidate?.getVideoData === 'function' ? candidate : null);
        try {
            if (typeof candidate?.getVideoData === 'function' && candidate.getVideoData()?.isAd) state.readyMedia = null;
            if (typeof candidate?.getVideoData === 'function' &&
                typeof candidate.getAvailableQualityLevels === 'function' &&
                matches(state, candidate) &&
                !candidate.classList.contains('ad-showing') &&
                !candidate.classList.contains('ad-interrupting') &&
                !candidate.getVideoData()?.isAd) {
                // The quality list and video ID can be ready BEFORE YouTube
                // replaces its startup controller, which resets fixed quality to
                // Auto. Wait for actual media readiness and a stable source first.
                const video = candidate.querySelector('video.html5-main-video') || candidate.querySelector('video');
                const playbackState = candidate.getPlayerState?.();
                if (!video || video.readyState < 2 || ![1, 2].includes(playbackState)) {
                    state.readyMedia = null;
                    schedule(state, retryDelay); return;
                }
                const source = video.currentSrc;
                if (!state.readyMedia || state.readyMedia.player !== candidate ||
                    state.readyMedia.video !== video || state.readyMedia.source !== source) {
                    state.readyMedia = { player: candidate, video, source, since: Date.now() };
                }
                if (Date.now() - state.readyMedia.since < 2_000) {
                    schedule(state, Math.max(500, 2_000 - (Date.now() - state.readyMedia.since))); return;
                }
                // One policy for every content type: live, premiere, replay,
                // Shorts and embeds. Only actual quality availability matters.
                // A native click can run while YouTube is still replacing its
                // content controller. Verify both the preferred quality and the
                // user-visible Settings summary before declaring success.
                if (state.pendingNative) {
                    const pending = state.pendingNative;
                    if (Date.now() < pending.checkAt) {
                        schedule(state, pending.checkAt - Date.now()); return;
                    }
                    const preference = typeof candidate.getPreferredQuality === 'function' ?
                        candidate.getPreferredQuality() : null;
                    const summaryOk = summaryMatches(qualitySummaryText(candidate), pending.target);
                    const checkedOk = summaryMatches(nativeCheckedQuality(candidate), pending.target);
                    const mismatch = summaryOk === false || checkedOk === false;
                    if (preference === pending.target && !mismatch) {
                        finish(state, 'applied'); return;
                    }
                    if (state.nativeAttempts >= 3 ||
                        (preference !== 'auto' && preference !== pending.target)) {
                        finish(state, 'attempted');
                        console.warn('[YouTube Default Quality] 未确认固定画质' +
                            (mismatch ? '（界面仍显示 Auto）' : '') +
                            '；已停止有限尝试。' + RETRY_HINT);
                        return;
                    }
                    // The UI still shows Auto or a different tier even though the
                    // preferred quality looks fixed; prepare the native menu again.
                    state.pendingNative = null;
                }
                const target = chooseQuality(candidate.getAvailableQualityLevels(), state.preferredHeight);
                if (!target || !matches(state, candidate)) { schedule(state, retryDelay); return; }
                const selection = prepareNativeSelection(state, candidate, target);
                if (selection.unavailable) { finish(state, 'expired'); return; }
                if (selection.waiting) {
                    schedule(state, state.menu?.phase === 'pending' ?
                        Math.min(retryDelay, Math.max(0, state.menu.deadline - Date.now())) : retryDelay);
                    return;
                }
                try {
                    // Menus may initialize through synchronous player callbacks.
                    // Revalidate both identity and actual availability afterwards.
                    if (chooseQuality(candidate.getAvailableQualityLevels(), state.preferredHeight) !== target) {
                        schedule(state, retryDelay); return;
                    }
                    if (!matches(state, candidate)) { schedule(state, retryDelay); return; }
                    if (selection.option && (!selection.option.isConnected ||
                        selection.option.closest(PLAYER_SELECTOR) !== candidate)) {
                        schedule(state, retryDelay); return;
                    }
                    // Block synchronous player events during the action. A
                    // failed native Auto selection may wait for confirmation;
                    // range calls and thrown actions are never repeated.
                    state.phase = 'attempted';
                    cancelTimer();
                    if (selection.option) {
                        state.nativeAttempts = (state.nativeAttempts || 0) + 1;
                        selection.option.click();
                        if (session !== state || state.manualOverride || suspended || navigating) return;
                        // getPreferredQuality() may report the fixed target while
                        // the native menu still says Auto. Defer the verdict to a
                        // delayed check that also reads the visible summary.
                        state.phase = 'waiting';
                        state.pendingNative = { target, checkAt: Date.now() + 1_000 };
                        schedule(state, 1_000);
                        return;
                    }
                    if (typeof candidate.setPlaybackQualityRange !== 'function') {
                        finish(state, 'attempted'); return;
                    }
                    candidate.setPlaybackQualityRange(target, target);
                    if (session !== state || state.manualOverride || suspended || navigating) return;
                    const preference = typeof candidate.getPreferredQuality === 'function' ?
                        candidate.getPreferredQuality() : null;
                    if (preference === target) {
                        finish(state, 'applied');
                    } else {
                        finish(state, 'attempted');
                        console.warn('[YouTube Default Quality] 已请求画质，未确认首选档位；不重复设置。' + RETRY_HINT);
                    }
                    return;
                } finally { selection.restore(); }
            }
        } catch (error) {
            // A setter may mutate and then throw. Retrying it could override a user
            // choice, so only read/readiness failures are eligible for retries.
            if (state.phase !== 'waiting') {
                finish(state, 'attempted');
                console.warn('[YouTube Default Quality] 设置接口异常；为保护手动选择，不再重试。' + RETRY_HINT, error);
                return;
            }
        }
        schedule(state, retryDelay);
    }

    function yieldToUser(event) {
        if (!event.isTrusted || suspended || !(event.target instanceof Element)) return;
        const pending = session?.menu;
        const owner = event.target.closest(PLAYER_SELECTOR);
        const settingsTarget = event.target.closest('.ytp-settings-menu, .ytp-settings-button');
        // A user can focus Search or another control while a menu is being built.
        // Remember that focus moved, but only a settings interaction aborts the
        // preparation; unrelated input must not spend one of its two attempts.
        if (pending?.phase === 'pending') {
            pending.focusMoved = true;
            if (owner === pending.player && settingsTarget) {
                pending.userInteraction = true;
                pending.restore?.();
                pending.phase = 'failed';
                pending.nextAt = Date.now() + 500;
            }
        }
        if (event.type === 'keydown' && !['Enter', ' ', 'Spacebar'].includes(event.key)) return;
        if (event.type === 'pointerdown' && event.button !== 0) return;
        const option = qualityMenuItem(event.target);
        if (!option) return;
        const optionOwner = option.closest(PLAYER_SELECTOR);
        if (!optionOwner) return;
        // Pointer/keyboard interaction during our async preparation belongs to the
        // user. Remove temporary hiding without toggling or stealing their focus.
        if (session?.menu?.player === optionOwner && settingsTarget) {
            session.menu.userInteraction = true;
            session.menu.focusMoved = true;
            session.menu.restore?.();
            if (session.menu.phase === 'pending') {
                session.menu.phase = 'failed';
                session.menu.nextAt = Date.now() + 500;
            }
        }
        const expected = urlVideoId();
        const ownerId = playerVideoId(optionOwner);
        if (expected && ownerId && expected !== ownerId) return;
        refresh();
        // Even before APIs attach, an actual choice on the current URL must win.
        // A known different player's choice must never lock the new URL's visit.
        if (!session || (expected ? session.id !== expected :
            ownerId ? session.id !== ownerId : optionOwner !== findPlayer())) return;
        if (isAutoMenuItem(option)) {
            // The configured policy is always a fixed height. Auto is never a
            // terminal choice, even when selected manually: re-apply the default.
            session.menu?.restore?.();
            session.menu = null;
            session.manualOverride = false;
            session.phase = 'waiting';
            session.probes = 0;
            session.deadline = Date.now() + WAIT_MS;
            session.readyMedia = null;
            session.pendingNative = null;
            session.nativeAttempts = 0;
            session.menuAttempts = 0;
            cancelTimer();
            schedule(session, 600);
            console.info('[YouTube Default Quality] 已忽略 Auto，将重新应用固定画质。' + RETRY_HINT);
            return;
        }
        session.manualOverride = true;
        if (!session.id) session.manualPlayer = optionOwner;
        finish(session, 'manual');
    }

    if (typeof GM_registerMenuCommand === 'function') {
        try {
            GM_registerMenuCommand('设置首选清晰度…', openConfig, { accessKey: 'q', clickedFrame: true });
            GM_registerMenuCommand(REAPPLY_MENU_LABEL, reapplyCurrent, { accessKey: 'r', clickedFrame: true });
        } catch (error) {
            // A menu failure must not prevent the quality controller from starting.
            console.warn('[YouTube Default Quality] 菜单命令注册失败。', error);
        }
    }

    for (const name of ['pointerdown', 'click', 'keydown']) {
        document.addEventListener(name, yieldToUser, true);
    }
    document.addEventListener('yt-navigate-start', startNavigation);
    document.addEventListener('yt-navigate-finish', () => {
        endNavigation();
        refresh();
    });
    for (const name of ['DOMContentLoaded', 'yt-page-data-updated', 'yt-player-updated']) {
        document.addEventListener(name, requestRefresh);
    }
    // Media events do not bubble. Capture them to notice a new/rebuilt player,
    // including playlist/autoplay transitions. Terminal sessions never write again.
    for (const name of ['loadstart', 'loadedmetadata', 'canplay', 'playing']) {
        document.addEventListener(name, event => {
            if (!(event.target instanceof HTMLVideoElement)) return;
            const owner = event.target.closest(PLAYER_SELECTOR);
            if (!owner) return;
            if (owner !== player) { requestRefresh(); return; }
            if (name === 'loadstart' && session?.phase === 'waiting') session.readyMedia = null;
            requestRefresh();
        }, true);
    }
    window.addEventListener('popstate', requestRefresh);
    // Chromium's committed-entry event also covers pushState/replaceState without
    // patching History, in case a transition omits YouTube's navigation events.
    window.navigation?.addEventListener('currententrychange', requestRefresh);
    window.addEventListener('pageshow', () => { suspended = false; endNavigation(); refresh(); });
    window.addEventListener('pagehide', () => {
        suspended = true; cancelTimer(); endNavigation(); session?.menu?.restore?.(); bindPlayer(null);
    });
    window[INSTANCE] = Object.freeze({
        version: '2.4.0',
        // Read-only troubleshooting snapshot; never exposes GM storage or controls.
        get state() { return session ? { id: session.id, phase: session.phase,
            probes: session.probes, nativeAttempts: session.nativeAttempts || 0,
            manualOverride: session.manualOverride, menuPhase: session.menu?.phase || 'idle',
            menuAttempts: session.menuAttempts || 0, navigating, timerPending: timer !== null } : null; },
    });
    refresh();
})();
