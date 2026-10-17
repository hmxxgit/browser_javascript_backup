// ==UserScript==
// @name         YouTube Default Quality (1080p once per video)
// @namespace    https://github.com/hmxxgit/browser_javascript_backup
// @version      1.0.1
// @description  新视频优先 1080P，否则选实际最高画质；仅设置一次，随后尊重用户选择。
// @match        https://www.youtube.com/*
// @run-at       document-start
// @grant        none
// @sandbox      raw
// @noframes
// @license      MIT
// @homepageURL  https://github.com/hmxxgit/browser_javascript_backup
// @supportURL   https://github.com/hmxxgit/browser_javascript_backup/issues
// ==/UserScript==

(() => {
    'use strict';

    // @sandbox raw / @grant none: access the desktop player's page-world methods.
    // Do not use setPlaybackQuality(): it is a no-op in the inspected player.
    const INSTANCE = '__youtubeDefaultQualityOnceV1__';
    if (window[INSTANCE]) return;
    window[INSTANCE] = true;

    const WAIT_MS = 45_000;
    const MAX_PROBES = 30;
    const PLAYER_EVENTS = ['onReady', 'onStateChange', 'onPlaybackQualityChange', 'videodatachange'];
    let session = null;
    let player = null;
    let timer = null;
    let navigating = false;

    function watchId() {
        const url = new URL(location.href);
        const id = url.searchParams.get('v');
        // Deliberately exclude Shorts, embeds, previews and a bare /playlist page.
        return url.pathname === '/watch' && /^[\w-]{11}$/.test(id || '') ? id : null;
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

    // One state per consecutive watch visit, not a permanent map of all viewed IDs.
    // A -> B -> A runs again; seek, replay, fullscreen and URL parameters keep A locked.
    function refresh() {
        const id = watchId();
        if (id !== session?.id) {
            cancelTimer();
            session = id ? { id, phase: 'waiting', probes: 0, deadline: Date.now() + WAIT_MS } : null;
        }
        const candidate = id ? document.getElementById('movie_player') : null;
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
        if (session !== state || state.phase !== 'waiting' || navigating || watchId() !== state.id ||
            document.getElementById('movie_player') !== candidate || !candidate.isConnected) return false;
        // URL alone is unsafe during SPA navigation: the old player may still be
        // present. Require both player data and response to identify the new video.
        return candidate.getVideoData()?.video_id === state.id &&
            candidate.getPlayerResponse()?.videoDetails?.videoId === state.id;
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
        if (watchId() !== state.id) { refresh(); return; }
        if (Date.now() >= state.deadline || state.probes >= MAX_PROBES) {
            finish(state, 'expired');
            console.warn('[YouTube Default Quality] 等待播放器超时，本视频不再自动设置。');
            return;
        }
        state.probes += 1;
        const candidate = document.getElementById('movie_player');
        bindPlayer(typeof candidate?.getVideoData === 'function' ? candidate : null);
        try {
            if (typeof candidate?.getVideoData === 'function' &&
                typeof candidate.getPlayerResponse === 'function' &&
                typeof candidate.getAvailableQualityLevels === 'function' &&
                typeof candidate.setPlaybackQualityRange === 'function' &&
                matches(state, candidate) &&
                !candidate.classList.contains('ad-showing') &&
                !candidate.classList.contains('ad-interrupting') &&
                !candidate.getVideoData()?.isAd) {
                const response = candidate.getPlayerResponse();
                // Live/premiere/ad behavior is not verified; leave those to YouTube.
                if (response.videoDetails.isLiveContent || response.videoDetails.isUpcoming ||
                    response.playabilityStatus?.liveStreamability) {
                    finish(state, 'unsupported');
                    return;
                }
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
        schedule(state, Math.min(500 * (2 ** (state.probes - 1)), 2_000));
    }

    function yieldToUser(event) {
        if (!event.isTrusted || !(event.target instanceof Element)) return;
        const option = event.target.closest('#movie_player .ytp-quality-menu [role="menuitemradio"]');
        if (!option || option.getAttribute('aria-disabled') === 'true') return;
        if (event.type === 'keydown' && !['Enter', ' ', 'Spacebar'].includes(event.key)) return;
        if (event.type === 'pointerdown' && event.button !== 0) return;
        refresh();
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
            if (event.target instanceof HTMLVideoElement && event.target.closest('#movie_player')) refresh();
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
