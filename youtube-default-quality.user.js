// ==UserScript==
// @name         YouTube Default Quality (1080p once per video)
// @namespace    https://github.com/hmxxgit/browser_javascript_backup
// @version      1.1.0
// @description  新视频优先 1080P，否则选实际最高画质；仅设置一次，随后尊重用户选择。
// @match        *://youtube.com/*
// @match        *://*.youtube.com/*
// @run-at       document-start
// @grant        none
// @sandbox      raw
// @license      MIT
// @homepageURL  https://github.com/hmxxgit/browser_javascript_backup
// @supportURL   https://github.com/hmxxgit/browser_javascript_backup/issues
// ==/UserScript==

(() => {
    'use strict';

    if (location.hostname !== 'youtube.com' && !location.hostname.endsWith('.youtube.com')) return;

    // @sandbox raw / @grant none: access the desktop player's page-world methods.
    // Do not use setPlaybackQuality(): it is a no-op in the inspected player.
    const INSTANCE = '__youtubeDefaultQualityOnceV1__';
    if (window[INSTANCE]) return;
    window[INSTANCE] = true;

    const WAIT_MS = 45_000;
    const MAX_PROBES = 30;
    const PLAYER_EVENTS = ['onReady', 'onStateChange', 'onPlaybackQualityChange', 'videodatachange'];
    const PLAYER_SELECTOR = '#movie_player, #shorts-player, .html5-video-player';
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
                bootstrapUrl: location.href, playbackStarted: false };
        }
        // The initial element can exist before YouTube attaches its API. Do not bind
        // the DOM addEventListener and mistake it for the player's event bus.
        bindPlayer(typeof candidate?.getVideoData === 'function' ? candidate : null);
        if (session) schedule(session, 0);
    }

    function chooseQuality(levels) {
        if (!Array.isArray(levels)) return null;
        const available = [...new Set(levels.filter(q => typeof q === 'string' && q && q !== 'auto'))];
        if (available.includes('hd1080')) return 'hd1080';
        // Only rank entries actually returned by this video. hdNNNN also handles
        // future resolutions; do not filter availability through a fixed tier list.
        const legacy = { tiny: 144, small: 240, medium: 360, large: 480, highres: Infinity };
        const height = q => /^hd\d+$/.test(q) ? Number(q.slice(2)) : legacy[q];
        if (available.every(q => height(q) !== undefined)) {
            return available.reduce((best, q) => !best || height(q) > height(best) ? q : best, null);
        }
        // YouTube currently returns highest first. Preserve its ordering if a new
        // opaque quality identifier cannot be ranked; never invent an option.
        return available[0] || null;
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

    function probe(state) {
        if (session !== state || state.phase !== 'waiting' || navigating) return;
        const candidate = findPlayer();
        const detectedId = urlVideoId() || playerVideoId(candidate);
        if (detectedId && detectedId !== state.id) { refresh(); return; }
        if (Date.now() >= state.deadline || state.probes >= MAX_PROBES) {
            finish(state, 'expired');
            console.warn('[YouTube Default Quality] 等待播放器超时，本视频不再自动设置。');
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
                const target = chooseQuality(candidate.getAvailableQualityLevels());
                const option = target ? nativeQualityOption(candidate, target) : null;
                if (target && matches(state, candidate)) {
                    // Lock BEFORE calling: synchronous quality events, errors, or
                    // delayed acknowledgements must never cause a second write.
                    finish(state, 'attempted');
                    // A range-only call can leave the native menu on Auto when
                    // Auto already decodes the target resolution (no quality-change
                    // event occurs). An existing native option applies the fixed
                    // choice AND refreshes its checked state in one action. Hidden
                    // options work too: do not open menus or click Settings.
                    if (option) option.click();
                    else candidate.setPlaybackQualityRange(target, target);
                    // Preference acknowledgement is not proof that decoded frames
                    // already have this resolution. Read only; never fight ABR.
                    if (typeof candidate.getPreferredQuality === 'function' &&
                        candidate.getPreferredQuality() === target &&
                        (!option || option.getAttribute('aria-checked') === 'true')) {
                        state.phase = 'applied';
                    } else {
                        console.warn('[YouTube Default Quality] 已请求画质，未确认首选档位；不重复设置。');
                    }
                    return;
                }
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
        if (session?.phase === 'waiting') finish(session, 'manual');
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
            // A waiting room may have no quality options for hours. Its first
            // actual playback gets one fresh bounded readiness window; manual or
            // completed sessions are never unlocked, and replaying cannot loop it.
            if (name === 'playing' && session?.id && !session.playbackStarted &&
                player?.contains(event.target) && typeof player.getPlayerState === 'function' &&
                player.getPlayerState() === 1) {
                session.playbackStarted = true;
                if (session.phase === 'expired') {
                    session.phase = 'waiting';
                    session.probes = 0;
                    session.deadline = Date.now() + WAIT_MS;
                    schedule(session, 0);
                }
            }
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
