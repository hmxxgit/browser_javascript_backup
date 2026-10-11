// ==UserScript==
// @name         X Custom UI
// @namespace    https://github.com/hmxxgit/browser_javascript_backup
// @version      1.0.3
// @description  X / Twitter 自定义界面：宽度、字体、精简界面和可持久保存的用户配置面板
// @author       hmxxgit
// @license      MIT
// @match        https://x.com/*
// @match        https://twitter.com/*
// @updateURL    https://raw.githubusercontent.com/hmxxgit/browser_javascript_backup/main/x-custom-ui.user.js
// @downloadURL  https://raw.githubusercontent.com/hmxxgit/browser_javascript_backup/main/x-custom-ui.user.js
// @run-at       document-idle
// @noframes
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// ==/UserScript==
(function () {
    'use strict';

    // 用户配置区：可以修改默认值，也可以从 Tampermonkey →「自定义配置」调整。
    // 已保存的配置优先于这里的默认值；在配置面板恢复默认即可重新采用默认值。
    const DEFAULT_CONFIG = {
        enabled: true,
        contentWidth: 900,
        textFontSize: 19,
        textLineHeight: 1.6,
        mediaMaxHeight: 0, // 0 = 不限制；仅限制信息流照片，不改视频与照片查看器。
        textColor: '', // 留空 = 跟随 X；支持 #RGB 或 #RRGGBB。
        linkColor: '',
        hideRightSidebar: true,
        hideGrok: true,
        hidePremium: true,
        hideExplore: false,
        hideCommunities: false,
        hideJobs: false,
        hideViewCounts: false,
        actionsHoverReveal: false,
        showSettingsButton: true
    };
    const STORAGE_KEY = 'xCustomUiConfig';
    const LIMITS = {
        contentWidth: [600, 1800, 10],
        textFontSize: [12, 36, 1],
        textLineHeight: [1, 2.5, 0.1],
        mediaMaxHeight: [0, 1200, 10]
    };
    const GROUPS = [
        ['总开关', [['enabled', '启用界面调整'], ['showSettingsButton', '显示右下角配置按钮']]],
        ['阅读与布局', [
            ['contentWidth', '桌面内容宽度（px）'], ['textFontSize', '推文正文字号（px）'],
            ['textLineHeight', '推文正文行高'], ['mediaMaxHeight', '照片最大高度（px，0 不限制）'],
            ['textColor', '正文颜色（留空跟随 X）'], ['linkColor', '正文链接颜色（留空跟随 X）']
        ]],
        ['界面精简', [
            ['hideRightSidebar', '隐藏右侧推荐栏（搜索仍可从探索进入）'],
            ['hideGrok', '隐藏 Grok 导航、浮窗与推文按钮'], ['hidePremium', '隐藏 Premium 导航与右栏订阅推广'],
            ['hideExplore', '隐藏探索导航'], ['hideCommunities', '隐藏社群导航'], ['hideJobs', '隐藏工作导航'],
            ['hideViewCounts', '隐藏推文浏览量'], ['actionsHoverReveal', '推文操作栏悬停或键盘聚焦时显示']
        ]]
    ];

    function normalizeConfig(value) {
        const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
        const config = { ...DEFAULT_CONFIG };
        for (const [key, fallback] of Object.entries(DEFAULT_CONFIG)) {
            const saved = source[key];
            if (saved === undefined) continue;
            if (typeof fallback === 'boolean') {
                if (typeof saved === 'boolean') config[key] = saved;
            } else if (typeof fallback === 'number') {
                const number = typeof saved === 'number' ? saved :
                    typeof saved === 'string' && saved.trim() ? Number(saved) : NaN;
                if (Number.isFinite(number)) config[key] = Math.min(LIMITS[key][1], Math.max(LIMITS[key][0], number));
            } else if (typeof saved === 'string' && /^(?:|#[\da-f]{3}|#[\da-f]{6})$/i.test(saved.trim())) {
                config[key] = saved.trim();
            }
        }
        return config;
    }

    function loadConfig() {
        try {
            const saved = GM_getValue(STORAGE_KEY, '{}');
            return normalizeConfig(typeof saved === 'string' ? JSON.parse(saved) : saved);
        } catch (error) {
            console.warn('[X Custom UI] 配置读取失败，使用默认值', error);
            return normalizeConfig({});
        }
    }
    let config = loadConfig();
    const style = document.createElement('style');
    style.id = 'tm-x-custom-ui-style';
    document.head.append(style);

    // CSS 自动作用于 X 的 SPA 导航和后来加载的推文；不修改 React 节点或监听整个 DOM。
    // 参考项目的精简界面思路，独立实现；使用语义属性，不依赖混淆的类名。
    function applyConfig() {
        const rules = [];
        if (config.enabled) {
            rules.push(`
                @media (min-width: 1000px) {
                    /* X 的 banner 原本会 flex-grow 填满左侧，必须连同固定导航容器一起约束。 */
                    header[role="banner"] {
                        --tm-x-nav-width: 88px;
                        flex: 0 0 var(--tm-x-nav-width) !important;
                        width: var(--tm-x-nav-width) !important;
                        min-width: 0 !important;
                        align-items: flex-start !important;
                    }
                    header[role="banner"] > div,
                    header[role="banner"] > div > div {
                        width: var(--tm-x-nav-width) !important;
                        max-width: var(--tm-x-nav-width) !important;
                    }
                    main[role="main"] {flex: 1 1 0% !important; min-width: 0 !important; align-items: flex-start !important;}
                    header[role="banner"] + main[role="main"] {margin-left: 0 !important;}
                    main[role="main"] > div {width: 100% !important; max-width: ${config.contentWidth + (config.hideRightSidebar ? 0 : 390)}px !important;}
                    [data-testid="primaryColumn"] {width: min(${config.contentWidth}px, 100%) !important; max-width: ${config.contentWidth}px !important; flex: 1 1 auto !important; min-width: 0 !important;}
                    /* 时间线 section 的父容器另外限制为 600px，主栏变宽不会自动解除。 */
                    [data-testid="primaryColumn"] div:has(> section) {
                        width: 100% !important;
                        max-width: none !important;
                        margin-inline: 0 !important;
                        align-self: stretch !important;
                        box-sizing: border-box !important;
                    }
                }
                @media (min-width: 1265px) {
                    header[role="banner"] {--tm-x-nav-width: 275px;}
                }
                [data-testid="tweetText"] {font-size: ${config.textFontSize}px !important; line-height: ${config.textLineHeight} !important;}
            `);
            if (config.textColor) rules.push(`[data-testid="tweetText"] {color: ${config.textColor} !important;}`);
            if (config.linkColor) rules.push(`[data-testid="tweetText"] a {color: ${config.linkColor} !important;}`);
            if (config.mediaMaxHeight > 0) rules.push(`
                [data-testid="primaryColumn"] [data-testid="tweet"] [data-testid="tweetPhoto"] {
                    max-height: ${config.mediaMaxHeight}px !important; overflow: hidden !important;
                }
                [data-testid="primaryColumn"] [data-testid="tweet"] [data-testid="tweetPhoto"] > div {
                    max-height: ${config.mediaMaxHeight}px !important;
                }
                [data-testid="primaryColumn"] [data-testid="tweet"] [data-testid="tweetPhoto"] img {
                    object-fit: contain !important;
                }
            `);
            const hidden = [];
            if (config.hideRightSidebar) hidden.push('[data-testid="sidebarColumn"]');
            if (config.hideGrok) hidden.push(
                'nav a[href="/i/grok"]', '[data-testid="GrokDrawer"]',
                '[data-testid="tweet"] a[href="/i/grok"]',
                'button[aria-label="Grok actions"]', 'button[aria-label="Grok 操作"]',
                'button[aria-label="Grok 動作"]', '[data-testid="grokImgGen"]',
                '[data-testid="tweet"] [data-testid^="followups_"]'
            );
            if (config.hidePremium) hidden.push('nav a[href^="/i/premium_sign_up"]',
                '[data-testid="sidebarColumn"] aside:has(a[href^="/i/premium_sign_up"])');
            if (config.hideExplore) hidden.push('nav a[data-testid="AppTabBar_Explore_Link"]');
            if (config.hideCommunities) hidden.push('nav a[href$="/communities"]');
            if (config.hideJobs) hidden.push('nav a[href="/jobs"]');
            if (config.hideViewCounts) hidden.push('[data-testid="tweet"] a[href$="/analytics"]');
            if (hidden.length) rules.push(`${hidden.join(',\n')} {display: none !important;}`);
            if (config.actionsHoverReveal) rules.push(`
                @media (hover: hover) and (pointer: fine) {
                    [data-testid="tweet"] [role="group"] {opacity: 0; transition: opacity 150ms;}
                    [data-testid="tweet"]:hover [role="group"],
                    [data-testid="tweet"]:focus-within [role="group"] {opacity: 1;}
                }
                @media (prefers-reduced-motion: reduce) {
                    [data-testid="tweet"] [role="group"] {transition: none;}
                }
            `);
        }
        style.textContent = rules.join('\n');
        settingsButton.hidden = !config.showSettingsButton;
    }

    // Shadow DOM 隔离面板样式，避免影响 X 或被 X 的页面样式覆盖。
    const host = document.createElement('div');
    host.id = 'tm-x-custom-ui';
    const shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = `
        <style>
            :host {all: initial; position: relative; z-index: 2147483647;}
            * {box-sizing: border-box;}
            button, input {font: inherit;}
            button {cursor: pointer; border: 1px solid #4b5563; border-radius: 8px; padding: 8px 12px; background: #272b33; color: #f9fafb;}
            button:focus-visible, input:focus-visible, textarea:focus-visible {outline: 2px solid #38bdf8; outline-offset: 2px;}
            button[hidden] {display: none;}
            #settings {position: fixed; right: 18px; bottom: 100px; z-index: 2147483646; font: 14px system-ui; box-shadow: 0 4px 18px #0006;}
            dialog {width: min(760px, calc(100vw - 24px)); max-height: calc(100dvh - 32px); margin: auto; padding: 0; border: 1px solid #4b5563; border-radius: 14px; background: #202123; color: #f9fafb; font: 14px/1.5 system-ui, sans-serif; color-scheme: dark; overflow: auto;}
            dialog::backdrop {background: #0009;}
            header, footer {position: sticky; background: #202123; padding: 14px 18px; display: flex; align-items: center; gap: 10px; flex-wrap: wrap; z-index: 1;}
            header {top: 0; border-bottom: 1px solid #41444b; justify-content: space-between;}
            footer {bottom: 0; border-top: 1px solid #41444b;}
            h2 {margin: 0; font-size: 18px;}
            p {margin: 12px 18px; color: #b8c1cf;}
            fieldset {margin: 14px 18px; border: 1px solid #41444b; border-radius: 8px; padding: 12px;}
            legend {padding: 0 6px; font-weight: 600;}
            label {display: grid; grid-template-columns: minmax(0, 1fr) 180px; gap: 12px; align-items: center; padding: 8px 0;}
            input:not([type="checkbox"]) {width: 100%; background: #111318; color: #f9fafb; border: 1px solid #4b5563; border-radius: 6px; padding: 7px;}
            input[type="checkbox"] {justify-self: end; width: 18px; height: 18px; accent-color: #1d9bf0;}
            #save {background: #136aa5; margin-left: auto;}
            #status {margin: 0 18px 12px; color: #fcd34d; min-height: 21px;}
            details {margin: 14px 18px;}
            textarea {display: block; width: 100%; min-height: 130px; margin: 10px 0; background: #111318; color: #f9fafb; border: 1px solid #4b5563; border-radius: 6px; font: 12px/1.5 monospace;}
            @media(max-width: 520px) {label {grid-template-columns: 1fr 110px;} header, footer {padding: 10px 12px;} fieldset {margin: 10px;} #settings {right: 10px; bottom: 84px;}}
        </style>
        <button id="settings" type="button" aria-label="打开 X 自定义配置">X UI ⚙</button>
        <dialog aria-labelledby="title">
            <header><h2 id="title">X Custom UI 配置</h2><button id="close" type="button">关闭</button></header>
            <p>保存后立即生效。配置保存在 Tampermonkey 中，升级脚本后仍保留。关闭总开关可恢复原界面。</p>
            <form>
                <div id="fields"></div>
                <details><summary>配置导入 / 导出（JSON）</summary>
                    <textarea id="json" aria-label="JSON 配置" spellcheck="false"></textarea>
                    <button id="export" type="button">导出到文本框</button>
                    <button id="import" type="button">导入到表单</button>
                </details>
                <div id="status" role="status" aria-live="polite"></div>
                <footer><button id="reset" type="button">恢复默认</button><button id="save" type="submit">保存并应用</button></footer>
            </form>
        </dialog>
    `;
    document.body.append(host);
    const settingsButton = shadow.querySelector('#settings');
    const dialog = shadow.querySelector('dialog');
    const form = shadow.querySelector('form');
    const fields = shadow.querySelector('#fields');
    const status = shadow.querySelector('#status');
    let previousFocus;

    for (const [title, entries] of GROUPS) {
        const group = document.createElement('fieldset');
        const legend = document.createElement('legend');
        legend.textContent = title;
        group.append(legend);
        for (const [key, labelText] of entries) {
            const label = document.createElement('label');
            const text = document.createElement('span');
            text.textContent = labelText;
            const input = document.createElement('input');
            input.name = key;
            if (typeof DEFAULT_CONFIG[key] === 'boolean') input.type = 'checkbox';
            else if (LIMITS[key]) {
                input.type = 'number';
                [input.min, input.max, input.step] = LIMITS[key].map(String);
                input.required = true;
            } else {
                input.type = 'text';
                input.placeholder = '#1d9bf0 或留空';
                input.pattern = '(#[0-9a-fA-F]{3}|#[0-9a-fA-F]{6})?';
            }
            label.append(text, input);
            group.append(label);
        }
        fields.append(group);
    }
    function fillForm(value) {
        for (const key of Object.keys(DEFAULT_CONFIG)) {
            const input = form.elements.namedItem(key);
            if (input.type === 'checkbox') input.checked = value[key];
            else input.value = String(value[key]);
        }
    }
    function readForm() {
        return normalizeConfig(Object.fromEntries(Object.keys(DEFAULT_CONFIG).map(key => {
            const input = form.elements.namedItem(key);
            return [key, input.type === 'checkbox' ? input.checked : input.value];
        })));
    }
    function openConfigPanel() {
        if (dialog.open) { dialog.focus(); return; }
        previousFocus = document.activeElement;
        fillForm(config);
        status.textContent = '';
        shadow.querySelector('#json').value = '';
        dialog.showModal();
    }
    dialog.addEventListener('close', () => {
        if (previousFocus && previousFocus.isConnected) previousFocus.focus();
    });
    settingsButton.addEventListener('click', openConfigPanel);
    shadow.querySelector('#close').addEventListener('click', () => dialog.close());
    shadow.querySelector('#reset').addEventListener('click', () => {
        fillForm(normalizeConfig({}));
        status.textContent = '已填入默认值，点击“保存并应用”后生效。';
    });
    form.addEventListener('submit', event => {
        event.preventDefault();
        if (!form.reportValidity()) return;
        const next = readForm();
        try {
            GM_setValue(STORAGE_KEY, JSON.stringify(next));
            config = next;
            applyConfig();
            status.textContent = '已保存并应用。';
        } catch (error) {
            status.textContent = '保存失败，请检查 Tampermonkey 权限后重试。';
            console.error('[X Custom UI] 保存失败', error);
        }
    });
    shadow.querySelector('#export').addEventListener('click', () => {
        if (!form.reportValidity()) return;
        shadow.querySelector('#json').value = JSON.stringify(readForm(), null, 2);
        status.textContent = '已导出当前表单，可复制文本保存。';
    });
    shadow.querySelector('#import').addEventListener('click', () => {
        try {
            const imported = JSON.parse(shadow.querySelector('#json').value);
            if (!imported || typeof imported !== 'object' || Array.isArray(imported)) throw new Error('not an object');
            fillForm(normalizeConfig(imported));
            status.textContent = '已导入到表单（超范围数值已限制），点击保存后生效。';
        } catch (_) { status.textContent = '导入失败：请输入 JSON 对象。'; }
    });
    if (typeof GM_registerMenuCommand === 'function') {
        GM_registerMenuCommand('自定义配置', openConfigPanel);
        GM_registerMenuCommand('恢复默认配置', () => {
            openConfigPanel();
            fillForm(normalizeConfig({}));
            status.textContent = '已填入默认值，点击“保存并应用”后生效。';
        });
    }
    applyConfig();
})();
