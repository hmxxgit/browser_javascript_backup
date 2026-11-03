// ==UserScript==
// @name         微信读书阅读样式
// @namespace    https://github.com/hmxxgit/browser_javascript_backup
// @version      1.0.1
// @description  自定义微信读书网页版的正文宽度、字号、行距与颜色。
// @author       hmxxgit
// @homepageURL  https://github.com/hmxxgit/browser_javascript_backup
// @supportURL   https://github.com/hmxxgit/browser_javascript_backup/issues
// @match        https://weread.qq.com/web/reader/*
// @updateURL    https://raw.githubusercontent.com/hmxxgit/browser_javascript_backup/main/weread-custom-ui.user.js
// @downloadURL  https://raw.githubusercontent.com/hmxxgit/browser_javascript_backup/main/weread-custom-ui.user.js
// @run-at       document-start
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// ==/UserScript==

(function () {
    'use strict';

    const STORAGE_KEY = 'wereadCustomUiConfig';
    const DEFAULTS = Object.freeze({
        enabled: true,
        width: 1000,
        fontSize: 21,
        lineHeight: 1.9,
        customColors: false,
        background: '#f7f1e3',
        textColor: '#302a22',
    });

    function bounded(value, fallback, min, max) {
        const number = Number(value);
        return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
    }

    function validColor(value, fallback) {
        return typeof value === 'string' && /^#[\da-f]{6}$/i.test(value) ? value.toLowerCase() : fallback;
    }

    function normalize(value) {
        if (typeof value === 'string') {
            try { value = JSON.parse(value); } catch (_) { value = null; }
        }
        const config = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
        return {
            enabled: typeof config.enabled === 'boolean' ? config.enabled : DEFAULTS.enabled,
            width: Math.round(bounded(config.width, DEFAULTS.width, 360, 1600)),
            fontSize: Math.round(bounded(config.fontSize, DEFAULTS.fontSize, 14, 40)),
            lineHeight: Math.round(bounded(config.lineHeight, DEFAULTS.lineHeight, 1.2, 3) * 10) / 10,
            customColors: typeof config.customColors === 'boolean' ? config.customColors : DEFAULTS.customColors,
            background: validColor(config.background, DEFAULTS.background),
            textColor: validColor(config.textColor, DEFAULTS.textColor),
        };
    }

    let config;
    try { config = normalize(GM_getValue(STORAGE_KEY, null)); }
    catch (_) { config = normalize(null); }

    // 实测滚动模式为 #preRenderContents，双栏为 #preRenderContent；两者都属于
    // .readerChapterContent .preRenderContent，且在排版完成后生成文字层与 canvas。
    // 样式必须先应用到预排版容器和正文块；不要覆盖段内 span，以保留书籍自身格式。
    // 纵向工具栏是 .readerContent 的直接子项，双栏工具栏则位于 .readerChapterContent 内。
    function buildReaderCss(settings) {
        if (!settings.enabled) return '';
        const width = settings.width;
        let css = `
            .readerContent > .app_content {
                width: calc(100% - 144px) !important;
                max-width: ${width + 80}px !important;
            }
            .readerContent .readerChapterContent {
                margin-left: 40px !important;
                margin-right: 40px !important;
            }
            .wr_horizontalReader .readerChapterContent {
                width: calc(100% - 144px) !important;
                max-width: ${width}px !important;
                margin-left: auto !important;
                margin-right: auto !important;
            }
            .readerTopBar {
                width: calc(100% - 144px) !important;
                max-width: ${width + 80}px !important;
            }
            .readerContent > .readerControls,
            .wr_horizontalReader .readerChapterContent > .readerControls {
                left: auto !important;
                right: 12px !important;
                margin-left: 0 !important;
            }
            .wr_horizontalReader .readerChapterContent > .readerControls { right: -60px !important; }
            .readerChapterContent .preRenderContent,
            .readerChapterContent .preRenderContent :is(p, li, blockquote) {
                font-size: ${settings.fontSize}px !important;
                line-height: ${settings.lineHeight} !important;
            }
            @media (max-width: 700px) {
                .readerContent > .app_content,
                .readerTopBar { width: 100% !important; }
                .readerContent .readerChapterContent {
                    margin-left: 20px !important;
                    margin-right: 20px !important;
                }
                .wr_horizontalReader .readerChapterContent {
                    width: calc(100% - 40px) !important;
                }
                .wr_horizontalReader .readerChapterContent > .readerControls { right: 4px !important; }
            }
        `;
        if (settings.customColors) {
            css += `
                html, body, #app, #routerView,
                .readerContent, .readerContent > .app_content,
                .wr_horizontalReader, .wr_horizontalReader_app_content,
                .readerChapterContent_container, .readerChapterContent,
                .readerTopBar, .readerTopBar_inner,
                .renderTargetContainer, .renderTargetContent,
                .page, .page_left, .page_right {
                    background-color: ${settings.background} !important;
                    background-image: none !important;
                }
                .readerChapterContent .preRenderContent,
                .readerChapterContent .preRenderContent *,
                .readerChapterContent [data-wr-role="text"],
                .readerTopBar_title_link, .readerTopBar_title_chapter, .readerTopBar_link,
                .renderTargetPageInfo_header, .renderTargetPageInfo_header *,
                .renderTarget_pager_button {
                    color: ${settings.textColor} !important;
                }
                .renderTarget_pager_button { border-color: ${settings.textColor} !important; }
            `;
        }
        return css;
    }

    const readerStyle = document.createElement('style');
    readerStyle.id = 'weread-custom-ui-style';
    readerStyle.textContent = buildReaderCss(config);
    const styleTarget = document.head || document.documentElement;
    if (styleTarget) styleTarget.appendChild(readerStyle);
    else {
        const observer = new MutationObserver(() => {
            if (!document.documentElement) return;
            (document.head || document.documentElement).appendChild(readerStyle);
            observer.disconnect();
        });
        observer.observe(document, { childList: true });
    }

    function mountPanel() {
        if (!document.body || document.getElementById('weread-custom-ui')) return;
        const host = document.createElement('div');
        host.id = 'weread-custom-ui';
        const root = host.attachShadow({ mode: 'open' });
        root.innerHTML = `
            <style>
                :host { all: initial; font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif; }
                * { box-sizing: border-box; }
                button, input { font: inherit; }
                button { cursor: pointer; }
                .launcher {
                    position: fixed; left: 18px; bottom: 18px; z-index: 2147483646;
                    padding: 9px 13px; border: 0; border-radius: 22px;
                    color: #fff; background: #315b49; box-shadow: 0 3px 14px #0003;
                    font-size: 13px; line-height: 1.2;
                }
                .panel {
                    position: fixed; left: 18px; bottom: 64px; z-index: 2147483647;
                    width: min(340px, calc(100vw - 36px)); max-height: calc(100vh - 84px);
                    overflow: auto; padding: 18px; color: #202a25; background: #fff;
                    border: 1px solid #dce4df; border-radius: 14px;
                    box-shadow: 0 12px 36px #0003; font-size: 14px; line-height: 1.45;
                }
                .panel[hidden] { display: none; }
                .heading { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
                h2 { margin: 0; font-size: 16px; }
                .close { border: 0; background: transparent; font-size: 22px; line-height: 1; color: #53635b; }
                .check { display: flex; align-items: center; gap: 8px; margin: 10px 0; }
                .row { margin: 15px 0; }
                .row label { display: flex; justify-content: space-between; gap: 10px; }
                input[type=range] { width: 100%; margin: 8px 0 0; accent-color: #315b49; }
                .color-row { display: flex; align-items: center; gap: 9px; margin: 10px 0; }
                .color-row label { flex: 1; }
                input[type=text] { width: 112px; padding: 6px 8px; border: 1px solid #c6d0ca; border-radius: 6px; }
                .swatch { width: 20px; height: 20px; border: 1px solid #aab8af; border-radius: 50%; }
                .hint { color: #617067; font-size: 12px; margin: 12px 0; }
                .status { color: #b42318; min-height: 1.4em; font-size: 12px; }
                .actions { display: flex; justify-content: space-between; gap: 8px; margin-top: 8px; }
                .actions button { border-radius: 7px; padding: 8px 12px; }
                .reset { color: #315b49; background: #fff; border: 1px solid #b4c4ba; }
                .save { color: #fff; background: #315b49; border: 1px solid #315b49; }
                :focus-visible { outline: 2px solid #1a8056; outline-offset: 2px; }
            </style>
            <button class="launcher" type="button" aria-expanded="false">阅读设置</button>
            <section class="panel" role="dialog" aria-label="微信读书阅读设置" hidden>
                <div class="heading"><h2>阅读样式</h2><button class="close" type="button" aria-label="关闭设置">×</button></div>
                <label class="check"><input type="checkbox" name="enabled"> 启用自定义排版</label>
                <div class="row"><label for="width">正文宽度 <output for="width"></output></label><input id="width" name="width" type="range" min="360" max="1600" step="20"></div>
                <div class="row"><label for="fontSize">正文字号 <output for="fontSize"></output></label><input id="fontSize" name="fontSize" type="range" min="14" max="40" step="1"></div>
                <div class="row"><label for="lineHeight">行间距 <output for="lineHeight"></output></label><input id="lineHeight" name="lineHeight" type="range" min="1.2" max="3" step="0.1"></div>
                <label class="check"><input type="checkbox" name="customColors"> 自定义背景与文字颜色</label>
                <div class="color-row"><label for="background">背景颜色</label><span class="swatch" data-swatch="background"></span><input id="background" name="background" type="text" maxlength="7" spellcheck="false" aria-label="背景颜色"></div>
                <div class="color-row"><label for="textColor">文字颜色</label><span class="swatch" data-swatch="textColor"></span><input id="textColor" name="textColor" type="text" maxlength="7" spellcheck="false" aria-label="文字颜色"></div>
                <p class="hint">颜色填写六位色值，如 #f7f1e3。保存后自动刷新，宽度会适应较窄的窗口。</p>
                <div class="status" role="status" aria-live="polite"></div>
                <div class="actions"><button class="reset" type="button">恢复默认</button><button class="save" type="button">保存并刷新</button></div>
            </section>
        `;
        document.body.appendChild(host);
        const $ = selector => root.querySelector(selector);
        const field = name => $(`[name="${name}"]`);
        const panel = $('.panel');
        const launcher = $('.launcher');
        const status = $('.status');

        function syncDisplay() {
            for (const [key, suffix] of [['width', 'px'], ['fontSize', 'px'], ['lineHeight', '倍']]) {
                $(`output[for="${key}"]`).textContent = `${field(key).value} ${suffix}`;
            }
            for (const key of ['background', 'textColor']) {
                const color = validColor(field(key).value, '');
                $(`[data-swatch="${key}"]`).style.backgroundColor = color || 'transparent';
            }
        }

        function fillForm(settings) {
            for (const key of ['enabled', 'customColors']) field(key).checked = settings[key];
            for (const key of ['width', 'fontSize', 'lineHeight', 'background', 'textColor']) field(key).value = settings[key];
            status.textContent = '';
            syncDisplay();
        }

        function setOpen(open) {
            panel.hidden = !open;
            launcher.setAttribute('aria-expanded', String(open));
            if (open) { fillForm(config); $('.close').focus(); }
            else launcher.focus();
        }
        launcher.addEventListener('click', () => setOpen(panel.hidden));
        $('.close').addEventListener('click', () => setOpen(false));
        panel.addEventListener('keydown', event => { if (event.key === 'Escape') setOpen(false); });
        root.addEventListener('input', syncDisplay);
        $('.reset').addEventListener('click', () => fillForm(DEFAULTS));
        $('.save').addEventListener('click', () => {
            if (field('customColors').checked) {
                for (const key of ['background', 'textColor']) {
                    if (!validColor(field(key).value, '')) {
                        status.textContent = '请输入六位十六进制颜色，例如 #f7f1e3。';
                        field(key).focus();
                        return;
                    }
                }
            }
            const next = normalize({
                enabled: field('enabled').checked,
                width: field('width').value,
                fontSize: field('fontSize').value,
                lineHeight: field('lineHeight').value,
                customColors: field('customColors').checked,
                background: field('background').value,
                textColor: field('textColor').value,
            });
            try { GM_setValue(STORAGE_KEY, next); }
            catch (_) { status.textContent = '保存失败，请检查脚本管理器的存储权限。'; return; }
            config = next;
            location.reload();
        });
        if (typeof GM_registerMenuCommand === 'function') {
            GM_registerMenuCommand('阅读设置', () => setOpen(true));
        }
    }

    if (document.body) mountPanel();
    else document.addEventListener('DOMContentLoaded', mountPanel, { once: true });
})();
