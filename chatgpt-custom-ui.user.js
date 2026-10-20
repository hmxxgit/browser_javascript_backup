// ==UserScript==
// @name         ChatGPT Custom UI
// @namespace    https://gist.github.com/hmxxgit
// @version      1.4.57
// @description  ChatGPT 自定义界面：输入框自动隐藏、底部箭头智能显示、鼠标自动隐藏等
// @author       hmxxgit
// @homepageURL  https://github.com/hmxxgit/browser_javascript_backup
// @supportURL   https://github.com/hmxxgit/browser_javascript_backup/issues
// @match        https://chatgpt.com/*
// @match        https://chat.openai.com/*
// @updateURL    https://raw.githubusercontent.com/hmxxgit/browser_javascript_backup/main/chatgpt-custom-ui.user.js
// @downloadURL  https://raw.githubusercontent.com/hmxxgit/browser_javascript_backup/main/chatgpt-custom-ui.user.js
// @run-at       document-idle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        GM_registerMenuCommand
// ==/UserScript==
(function () {
    "use strict";

    /* =========================================================
       用户配置区

       只需要改这里的值。
       不想调整就保持默认，效果和原脚本一致。
       ========================================================= */

    const CONFIG_STORAGE_KEY = "chatgptCustomUiConfig";

    const DEFAULT_CONFIG = {

        /* 页面宽度 */
        contentWidth: 2400,
        composerWidth: 2400,
        userBubbleMaxWidth: 75,

        /* 字体大小 */
        messageFontSize: 19,
        messageLineHeight: 1.5,
        inputFontSize: 19,
        codeFontSize: 15,
        h1Size: 33,
        h2Size: 28,
        h3Size: 24,
        userMessageFontSize: 18,
        userMessageLineHeight: 1.5,

        /* 颜色设置，留空表示不覆盖 ChatGPT 原本颜色 */
        assistantTextColor: "",
        assistantBoldColor: "#ffc107",
        assistantH1Color: "#ef4444",
        assistantH2Color: "#3b82f6",
        assistantH3Color: "#22c55e",
        userTextColor: "",

        /* 右上角按钮 */
        topRightActionsHoverReveal: true,

        /* 输入框自动隐藏 */
        composerTriggerHeight: 100,
        composerTransitionTime: 150,
        composerHideTranslateY: 35,
        composerInitialHideDelay: 800,
        composerMaxParentLevels: 24,
        composerScrollLockFrames: 4,

        /* 底部箭头 */
        bottomArrowEnabled: true,
        bottomArrowHideDelay: 1100,
        bottomArrowFadeDuration: 160,
        bottomArrowBottomThreshold: 8,
        bottomArrowInitialDelay: 800,
        bottomArrowMouseMoveThreshold: 2,

        /* 鼠标静止自动隐藏 */
        cursorHideDelay: 4000,
        cursorMoveThreshold: 1
    };

    /*
     * 数值配置的合理范围。
     *
     * 配置面板输入和 normalizeConfig 载入都会经过 clampConfigNumber，
     * 避免负数或极端值被写进 CSS 变量，产生无效样式。
     */
    const CONFIG_NUMBER_LIMITS = {
        contentWidth: { min: 320, max: 10000 },
        composerWidth: { min: 320, max: 10000 },
        userBubbleMaxWidth: { min: 20, max: 100 },
        messageFontSize: { min: 8, max: 96 },
        messageLineHeight: { min: 0.8, max: 4 },
        inputFontSize: { min: 8, max: 96 },
        codeFontSize: { min: 8, max: 96 },
        h1Size: { min: 8, max: 160 },
        h2Size: { min: 8, max: 160 },
        h3Size: { min: 8, max: 160 },
        userMessageFontSize: { min: 8, max: 96 },
        userMessageLineHeight: { min: 0.8, max: 4 },
        composerTriggerHeight: { min: 0, max: 2000 },
        composerTransitionTime: { min: 0, max: 5000 },
        composerHideTranslateY: { min: 0, max: 1000 },
        composerInitialHideDelay: { min: 0, max: 60000 },
        composerMaxParentLevels: { min: 24, max: 100 },
        composerScrollLockFrames: { min: 0, max: 120 },
        bottomArrowHideDelay: { min: 0, max: 60000 },
        bottomArrowFadeDuration: { min: 0, max: 5000 },
        bottomArrowBottomThreshold: { min: 0, max: 200 },
        bottomArrowInitialDelay: { min: 0, max: 60000 },
        bottomArrowMouseMoveThreshold: { min: 0, max: 200 },
        cursorHideDelay: { min: 200, max: 600000 },
        cursorMoveThreshold: { min: 0, max: 200 }
    };

    function clampConfigNumber(key, value) {
        const limits =
            CONFIG_NUMBER_LIMITS[key];

        if (!limits) {
            return Math.max(0, value);
        }

        return Math.min(
            limits.max,
            Math.max(limits.min, value)
        );
    }

    const USER_CONFIG = loadUserConfig();

    /*
     * 版本横幅：方便在控制台确认当前运行的是哪个版本。
     * 修改脚本后如果内容没有变化，说明浏览器里跑的还不是新版。
     */
    console.log(
        "[ChatGPT Custom UI] v" +
        (typeof GM_info !== "undefined" && GM_info.script
            ? GM_info.script.version
            : "dev") +
        " 已加载"
    );



    registerConfigMenu();

    function loadUserConfig() {
        try {
            const savedConfigText =
                typeof GM_getValue === "function"
                    ? GM_getValue(CONFIG_STORAGE_KEY, "{}")
                    : "{}";

            const savedConfig =
                JSON.parse(savedConfigText);

            return normalizeConfig(savedConfig);
        }

        catch (error) {
            return normalizeConfig({});
        }
    }

    function normalizeConfig(savedConfig) {
        const normalizedConfig = {
            ...DEFAULT_CONFIG
        };

        for (const [key, defaultValue] of Object.entries(DEFAULT_CONFIG)) {
            if (!(key in savedConfig)) continue;

            const savedValue = savedConfig[key];

            if (isColorConfigKey(key)) {
                normalizedConfig[key] =
                    normalizeColorValue(savedValue);

                continue;
            }

            if (typeof defaultValue === "number") {
                normalizedConfig[key] =
                    clampConfigNumber(
                        key,
                        parseConfigNumber(savedValue, defaultValue)
                    );

                continue;
            }

            if (typeof defaultValue === "boolean") {
                normalizedConfig[key] =
                    parseConfigBoolean(savedValue, defaultValue);

                continue;
            }

            normalizedConfig[key] =
                String(savedValue);
        }

        return normalizedConfig;
    }

    function parseConfigNumber(value, fallbackValue) {
        if (typeof value === "number" && Number.isFinite(value)) {
            return value;
        }

        const parsedValue =
            Number.parseFloat(String(value).trim());

        return Number.isFinite(parsedValue)
            ? parsedValue
            : fallbackValue;
    }

    function parseConfigBoolean(value, fallbackValue) {
        if (typeof value === "boolean") return value;
        if (value === "true" || value === "1" || value === 1) return true;
        if (value === "false" || value === "0" || value === 0) return false;
        return fallbackValue;
    }

    function saveUserConfig(nextConfig) {
        if (typeof GM_setValue !== "function") return false;

        try {
            GM_setValue(CONFIG_STORAGE_KEY, JSON.stringify(nextConfig));
            return true;
        }

        catch (error) {
            console.error("[ChatGPT Custom UI] 保存配置失败", error);
            return false;
        }
    }

    function resetUserConfig() {
        if (typeof GM_deleteValue !== "function") {
            alert("无法恢复默认配置：脚本管理器未提供存储权限。");
            return;
        }

        try {
            GM_deleteValue(CONFIG_STORAGE_KEY);
        }

        catch (error) {
            console.error("[ChatGPT Custom UI] 恢复默认配置失败", error);
            alert("恢复默认配置失败，请检查脚本管理器权限。");
            return;
        }

        alert("ChatGPT Custom UI 已恢复默认配置，刷新页面后生效。");
        location.reload();
    }

    function registerConfigMenu() {
        if (typeof GM_registerMenuCommand !== "function") return;

        GM_registerMenuCommand("自定义配置", openConfigPanel);
        GM_registerMenuCommand("恢复默认配置", resetUserConfig);
    }

    function openConfigPanel() {
        const existingPanel =
            document.querySelector("[data-chatgpt-custom-ui-config-panel='true']");

        if (existingPanel) {
            existingPanel.remove();
            return;
        }

        const panel = document.createElement("div");
        panel.setAttribute("data-chatgpt-custom-ui-config-panel", "true");

        panel.innerHTML = `
            <div class="tm-cui-panel">
                <div class="tm-cui-header">
                    <strong>ChatGPT Custom UI 配置</strong>
                    <button type="button" data-action="close">关闭</button>
                </div>
                <form class="tm-cui-form">
                    ${createConfigFieldsHtml()}
                    <div class="tm-cui-actions">
                        <span class="tm-cui-secondary-actions">
                            <button type="button" data-action="reset">恢复默认</button>
                            <button type="button" data-action="copy-config">复制配置</button>
                            <button type="button" data-action="download-config">下载配置</button>
                        </span>
                        <button type="submit">保存并刷新</button>
                    </div>
                </form>
            </div>
        `;

        const style = document.createElement("style");
        style.textContent = `
            [data-chatgpt-custom-ui-config-panel="true"] {
                position: fixed;
                inset: 0;
                z-index: 2147483647;
                display: flex;
                justify-content: center;
                align-items: center;
                background: rgba(0, 0, 0, 0.55);
                color: #f7f7f7;
                font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            }

            [data-chatgpt-custom-ui-config-panel="true"] .tm-cui-panel {
                width: min(760px, calc(100vw - 32px));
                max-height: min(820px, calc(100vh - 32px));
                overflow: auto;
                background: #202123;
                border: 1px solid rgba(255, 255, 255, 0.16);
                border-radius: 10px;
                box-shadow: 0 24px 80px rgba(0, 0, 0, 0.45);
            }

            [data-chatgpt-custom-ui-config-panel="true"] .tm-cui-header,
            [data-chatgpt-custom-ui-config-panel="true"] .tm-cui-actions {
                position: sticky;
                background: #202123;
                display: flex;
                justify-content: space-between;
                align-items: center;
                gap: 12px;
                padding: 14px 18px;
            }

            [data-chatgpt-custom-ui-config-panel="true"] .tm-cui-header {
                top: 0;
                border-bottom: 1px solid rgba(255, 255, 255, 0.12);
            }

            [data-chatgpt-custom-ui-config-panel="true"] .tm-cui-actions {
                bottom: 0;
                border-top: 1px solid rgba(255, 255, 255, 0.12);
            }

            [data-chatgpt-custom-ui-config-panel="true"] .tm-cui-secondary-actions {
                display: flex;
                gap: 10px;
                align-items: center;
            }

            [data-chatgpt-custom-ui-config-panel="true"] .tm-cui-form {
                display: grid;
                gap: 14px;
            }

            [data-chatgpt-custom-ui-config-panel="true"] fieldset {
                margin: 0 18px;
                padding: 14px;
                border: 1px solid rgba(255, 255, 255, 0.14);
                border-radius: 8px;
            }

            [data-chatgpt-custom-ui-config-panel="true"] legend {
                padding: 0 6px;
                color: #ffffff;
                font-weight: 650;
            }

            [data-chatgpt-custom-ui-config-panel="true"] label:not(.tm-cui-color-toggle),
            [data-chatgpt-custom-ui-config-panel="true"] .tm-cui-config-row {
                display: grid;
                grid-template-columns: minmax(160px, 1fr) minmax(240px, 320px);
                align-items: center;
                gap: 12px;
                margin: 10px 0;
                color: #e8e8e8;
                font-size: 14px;
            }

            [data-chatgpt-custom-ui-config-panel="true"] .tm-cui-input-wrap {
                display: grid;
                grid-template-columns: minmax(0, 1fr) minmax(48px, auto);
                align-items: center;
                gap: 8px;
            }

            [data-chatgpt-custom-ui-config-panel="true"] input {
                width: 100%;
                box-sizing: border-box;
                border: 1px solid rgba(255, 255, 255, 0.2);
                border-radius: 6px;
                background: #111214;
                color: #ffffff;
                padding: 8px 10px;
                font: inherit;
            }

            [data-chatgpt-custom-ui-config-panel="true"] input[type="color"] {
                min-height: 42px;
                padding: 4px;
            }

            [data-chatgpt-custom-ui-config-panel="true"] .tm-cui-color-wrap {
                display: grid;
                grid-template-columns: minmax(56px, auto) minmax(0, 1fr) minmax(82px, auto);
                align-items: center;
                gap: 10px;
            }

            [data-chatgpt-custom-ui-config-panel="true"] .tm-cui-switch-wrap {
                display: flex;
                align-items: center;
                justify-content: flex-start;
                gap: 10px;
            }

            [data-chatgpt-custom-ui-config-panel="true"] .tm-cui-color-toggle {
                display: inline-flex;
                align-items: center;
                gap: 6px;
                color: rgba(255, 255, 255, 0.82);
                font-size: 13px;
                cursor: pointer;
            }

            [data-chatgpt-custom-ui-config-panel="true"] .tm-cui-color-enabled {
                appearance: auto;
                accent-color: #10a37f;
                width: 16px;
                height: 16px;
                margin: 0;
                padding: 0;
                cursor: pointer;
            }

            [data-chatgpt-custom-ui-config-panel="true"] .tm-cui-unit {
                color: rgba(255, 255, 255, 0.68);
                font-size: 13px;
                white-space: nowrap;
            }

            [data-chatgpt-custom-ui-config-panel="true"] button {
                border: 1px solid rgba(255, 255, 255, 0.18);
                border-radius: 6px;
                background: #2f3033;
                color: #ffffff;
                padding: 8px 12px;
                font: inherit;
                cursor: pointer;
            }

            [data-chatgpt-custom-ui-config-panel="true"] button[type="submit"] {
                background: #10a37f;
                border-color: #10a37f;
            }
        `;

        panel.appendChild(style);
        document.documentElement.appendChild(panel);

        panel.addEventListener("click", event => {
            if (event.target === panel) {
                panel.remove();
            }
        });

        panel.querySelector("[data-action='close']").addEventListener("click", () => {
            panel.remove();
        });

        panel.querySelector("[data-action='reset']").addEventListener("click", resetUserConfig);

        panel.querySelector("[data-action='copy-config']").addEventListener("click", () => {
            copyCurrentPanelConfig(panel);
        });

        panel.querySelector("[data-action='download-config']").addEventListener("click", () => {
            downloadCurrentPanelConfig(panel);
        });

        panel.querySelectorAll("input[type='color'][data-color-key]").forEach(colorInput => {
            colorInput.addEventListener("input", () => {
                enableColorInput(panel, colorInput.dataset.colorKey);
            });

            colorInput.addEventListener("change", () => {
                enableColorInput(panel, colorInput.dataset.colorKey);
            });
        });

        panel.querySelector("form").addEventListener("submit", event => {
            event.preventDefault();

            if (!event.currentTarget.reportValidity()) return;

            const nextConfig = readConfigFromForm(event.currentTarget);
            if (!saveUserConfig(nextConfig)) {
                alert("配置保存失败，请检查脚本管理器权限。");
                return;
            }

            alert("配置已保存，页面将刷新后生效。");
            location.reload();
        });
    }

    function enableColorInput(panel, key) {
        const checkbox =
            panel.querySelector(`input[name="${key}Enabled"]`);

        if (!checkbox) return;

        checkbox.checked = true;
    }

    function readConfigFromForm(form) {
        const formData = new FormData(form);
        const nextConfig = {};

        for (const [key, defaultValue] of Object.entries(DEFAULT_CONFIG)) {
            const value = formData.get(key);

            if (isColorConfigKey(key)) {
                nextConfig[key] =
                    formData.get(`${key}Enabled`) === "on"
                        ? normalizeColorValue(value)
                        : "";

                continue;
            }

            if (typeof defaultValue === "number") {
                nextConfig[key] =
                    clampConfigNumber(
                        key,
                        parseConfigNumber(value, defaultValue)
                    );

                continue;
            }

            if (typeof defaultValue === "boolean") {
                nextConfig[key] =
                    formData.get(key) === "on";

                continue;
            }

            nextConfig[key] =
                String(value);
        }

        return nextConfig;
    }

    function getCurrentPanelConfigText(panel) {
        const form = panel.querySelector("form");
        const currentConfig = readConfigFromForm(form);
        return JSON.stringify(currentConfig, null, 4);
    }

    async function copyCurrentPanelConfig(panel) {
        const configText = getCurrentPanelConfigText(panel);
        await copyTextToClipboard(configText);
    }

    function downloadCurrentPanelConfig(panel) {
        const configText = getCurrentPanelConfigText(panel);

        downloadTextFile(
            "chatgpt-custom-ui-config.json",
            configText
        );

        alert("当前配置已下载为 JSON 文件。");
    }

    async function copyTextToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            alert("当前配置已复制到剪贴板。");
        }

        catch (error) {
            window.prompt(
                "浏览器没有允许自动复制，请手动复制下面的 JSON：",
                text
            );
        }
    }

    function downloadTextFile(filename, text) {
        const blob = new Blob(
            [text],
            {
                type: "application/json;charset=utf-8"
            }
        );

        const url =
            URL.createObjectURL(blob);

        const link =
            document.createElement("a");

        link.href = url;
        link.download = filename;
        link.style.display = "none";

        document.body.appendChild(link);
        link.click();
        link.remove();

        window.setTimeout(
            () => {
                URL.revokeObjectURL(url);
            },
            1000
        );
    }

    function createConfigFieldsHtml() {
        const groups = [
            {
                title: "页面宽度",
                fields: [
                    ["contentWidth", "主界面宽度", "px"],
                    ["composerWidth", "输入框宽度", "px"],
                    ["userBubbleMaxWidth", "用户气泡宽度", "%"]
                ]
            },
            {
                title: "字体大小",
                fields: [
                    ["messageFontSize", "回复正文字体", "px"],
                    ["messageLineHeight", "回复正文行距", "倍"],
                    ["inputFontSize", "输入框字体", "px"],
                    ["codeFontSize", "代码字体", "px"],
                    ["h1Size", "一级标题", "px"],
                    ["h2Size", "二级标题", "px"],
                    ["h3Size", "三级标题", "px"],
                    ["userMessageFontSize", "用户提问字体", "px"],
                    ["userMessageLineHeight", "用户提问行距", "倍"]
                ]
            },
            {
                title: "颜色设置",
                fields: [
                    ["assistantTextColor", "回复正文颜色", "颜色"],
                    ["assistantBoldColor", "回复加粗颜色", "颜色"],
                    ["assistantH1Color", "一级标题颜色", "颜色"],
                    ["assistantH2Color", "二级标题颜色", "颜色"],
                    ["assistantH3Color", "三级标题颜色", "颜色"],
                    ["userTextColor", "用户提问颜色", "颜色"]
                ]
            },
            {
                title: "右上角按钮",
                fields: [
                    ["topRightActionsHoverReveal", "右上角按钮透明悬停显示", "开关"]
                ]
            },
            {
                title: "输入框自动隐藏",
                fields: [
                    ["composerTriggerHeight", "底部触发距离", "px"],
                    ["composerTransitionTime", "动画时间", "ms"],
                    ["composerHideTranslateY", "隐藏下移距离", "px"],
                    ["composerInitialHideDelay", "初始化延迟", "ms"],
                    ["composerMaxParentLevels", "查找父级层数", "层"],
                    ["composerScrollLockFrames", "滚动锁定帧数", "帧"]
                ]
            },
            {
                title: "底部箭头",
                fields: [
                    ["bottomArrowEnabled", "显示底部箭头", "开关"],
                    ["bottomArrowHideDelay", "隐藏延迟", "ms"],
                    ["bottomArrowFadeDuration", "淡入淡出时间", "ms"],
                    ["bottomArrowBottomThreshold", "底部容差", "px"],
                    ["bottomArrowInitialDelay", "初始化延迟", "ms"],
                    ["bottomArrowMouseMoveThreshold", "鼠标移动阈值", "px"]
                ]
            },
            {
                title: "鼠标隐藏",
                fields: [
                    ["cursorHideDelay", "隐藏延迟", "ms"],
                    ["cursorMoveThreshold", "移动阈值", "px"]
                ]
            }
        ];

        return groups.map(group => `
            <fieldset>
                <legend>${escapeHtml(group.title)}</legend>
                ${group.fields.map(([key, label, unit]) => createConfigFieldHtml(key, label, unit)).join("")}
            </fieldset>
        `).join("");
    }

    function createConfigFieldHtml(key, label, unit) {
        const value =
            USER_CONFIG[key] ??
            DEFAULT_CONFIG[key];

        if (isColorConfigKey(key)) {
            return createColorConfigFieldHtml(key, label, value);
        }

        if (typeof DEFAULT_CONFIG[key] === "boolean") {
            return createBooleanConfigFieldHtml(key, label, value);
        }

        const type =
            typeof DEFAULT_CONFIG[key] === "number"
                ? "number"
                : "text";

        const inputStep =
            Number.isInteger(DEFAULT_CONFIG[key])
                ? "1"
                : "any";

        const limits =
            CONFIG_NUMBER_LIMITS[key];

        const rangeAttributes =
            type === "number" && limits
                ? ` min="${limits.min}" max="${limits.max}"`
                : "";

        return `
            <label>
                <span>${escapeHtml(label)}</span>
                <span class="tm-cui-input-wrap">
                    <input name="${escapeHtml(key)}" type="${type}" step="${inputStep}"${rangeAttributes}${type === "number" ? " required" : ""} value="${escapeHtml(String(value))}">
                    <span class="tm-cui-unit">${escapeHtml(unit)}</span>
                </span>
            </label>
        `;
    }

    function createColorConfigFieldHtml(key, label, value) {
        const enabled =
            isValidColorValue(value);

        const colorValue =
            enabled
                ? value
                : document.documentElement.classList.contains("dark")
                    ? "#ffffff"
                    : "#0d0d0d";

        return `
            <div class="tm-cui-config-row">
                <span>${escapeHtml(label)}</span>
                <span class="tm-cui-color-wrap">
                    <label class="tm-cui-color-toggle">
                        <input class="tm-cui-color-enabled" name="${escapeHtml(key)}Enabled" type="checkbox" ${enabled ? "checked" : ""}>
                        启用
                    </label>
                    <input name="${escapeHtml(key)}" data-color-key="${escapeHtml(key)}" type="color" value="${escapeHtml(colorValue)}">
                    <span class="tm-cui-unit">启用后覆盖</span>
                </span>
            </div>
        `;
    }

    function createBooleanConfigFieldHtml(key, label, value) {
        return `
            <div class="tm-cui-config-row">
                <span>${escapeHtml(label)}</span>
                <span class="tm-cui-switch-wrap">
                    <label class="tm-cui-color-toggle">
                        <input class="tm-cui-color-enabled" name="${escapeHtml(key)}" type="checkbox" ${value ? "checked" : ""}>
                        启用
                    </label>
                    <span class="tm-cui-unit">${DEFAULT_CONFIG[key] ? "默认开启" : "默认关闭"}</span>
                </span>
            </div>
        `;
    }

    function isColorConfigKey(key) {
        return key.endsWith("Color");
    }

    function normalizeColorValue(value) {
        const colorValue =
            String(value).trim();

        return isValidColorValue(colorValue)
            ? colorValue
            : "";
    }

    function isValidColorValue(value) {
        return /^#[0-9a-fA-F]{6}$/.test(
            String(value).trim()
        );
    }

    function escapeHtml(value) {
        return String(value ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll("\"", "&quot;")
            .replaceAll("'", "&#039;");
    }



    applyUserConfigCssVariables();
    injectConfiguredColorCss();

    function applyUserConfigCssVariables() {
        const rootStyle = document.documentElement.style;

        rootStyle.setProperty("--chatgpt-content-width", `${USER_CONFIG.contentWidth}px`);
        rootStyle.setProperty("--chatgpt-composer-width", `${USER_CONFIG.composerWidth}px`);
        rootStyle.setProperty("--chatgpt-message-font-size", `${USER_CONFIG.messageFontSize}px`);
        rootStyle.setProperty("--chatgpt-message-line-height", String(USER_CONFIG.messageLineHeight));
        rootStyle.setProperty("--chatgpt-input-font-size", `${USER_CONFIG.inputFontSize}px`);
        rootStyle.setProperty("--chatgpt-code-font-size", `${USER_CONFIG.codeFontSize}px`);
        rootStyle.setProperty("--chatgpt-h1-size", `${USER_CONFIG.h1Size}px`);
        rootStyle.setProperty("--chatgpt-h2-size", `${USER_CONFIG.h2Size}px`);
        rootStyle.setProperty("--chatgpt-h3-size", `${USER_CONFIG.h3Size}px`);
        rootStyle.setProperty("--chatgpt-user-message-font-size", `${USER_CONFIG.userMessageFontSize}px`);
        rootStyle.setProperty("--chatgpt-user-message-line-height", String(USER_CONFIG.userMessageLineHeight));
        rootStyle.setProperty("--chatgpt-user-bubble-max-width", `${USER_CONFIG.userBubbleMaxWidth}%`);
    }

    function injectConfiguredColorCss() {
        const rules = [];

        // 同时支持旧 Markdown 和新版 DIL 渲染器；限定消息范围，
        // 不把输入框、工具按钮或用户消息中的加粗误当成回复。
        const assistantScopes = [
            'main [data-message-author-role="assistant"]',
            'main [data-markdown-text-style="assistant-message"]'
        ];
        const userScopes = [
            'main [data-message-author-role="user"]',
            'main [data-user-message-bubble="true"]'
        ];
        const scopedSelectors = (scopes, targets) => scopes.flatMap(
            scope => targets.map(target => target ? `${scope} ${target}` : scope)
        ).join(",\n");

        addColorRule(
            rules,
            USER_CONFIG.assistantTextColor,
            scopedSelectors(assistantScopes, [
                "", "p", "li", "ol", "ul", "blockquote", "table", "th", "td",
                ".markdown", ".prose",
                // DIL 的普通文字可能自带颜色，不能仅依赖根节点继承。
                ':where([data-d-component="text"]:not([data-d-inline]))'
            ])
        );

        addColorRule(
            rules,
            USER_CONFIG.assistantBoldColor,
            scopedSelectors(assistantScopes, [
                "strong", "b", '[data-d-default-strong]', '[data-d-weight="bold"]'
            ])
        );

        for (const [tag, color] of [
            ["h1", USER_CONFIG.assistantH1Color],
            ["h2", USER_CONFIG.assistantH2Color],
            ["h3", USER_CONFIG.assistantH3Color]
        ]) {
            addColorRule(rules, color, scopedSelectors(assistantScopes, [tag]));

            // 标题中的加粗仍使用标题颜色；流式文字和内联文字继承标题。
            if (isValidColorValue(color)) {
                rules.push(`${scopedSelectors(assistantScopes, [
                    `${tag} strong`, `${tag} b`, `${tag} [data-d-text-flow]`
                ])} { color: inherit !important; }`);
            }
        }

        addColorRule(
            rules,
            USER_CONFIG.userTextColor,
            scopedSelectors(userScopes, ["", "p", "a", "span"])
        );

        if (rules.length === 0) return;

        const style = document.createElement("style");
        style.setAttribute("data-tm-chatgpt-configured-colors", "true");
        style.textContent = rules.join("\n\n");
        document.documentElement.appendChild(style);
    }

    function addColorRule(rules, color, selector) {
        const colorValue =
            normalizeColorValue(color);

        if (!colorValue) return;

        rules.push(`
            ${selector} {
                color: ${colorValue} !important;
            }
        `);
    }



    /* ==================== 整合 CSS：页面排版与字体 ==================== */

    injectIntegratedLayoutCss();

    function injectIntegratedLayoutCss() {
        const style = document.createElement("style");
        style.setAttribute("data-tm-chatgpt-integrated-layout-css", "true");
        style.textContent = "/* =========================================================\n   ChatGPT 网页版自定义样式\n   =========================================================\n\n   本 CSS 只负责：\n\n   1. 聊天正文宽度\n   2. 底部输入框宽度\n   3. 聊天正文字体\n   4. 输入框字体\n   5. 标题字体\n   6. 代码字体\n   7. 表格、长链接等排版\n\n   注意：\n\n   输入框自动隐藏、\n   阅读状态底部透明、\n   ChatGPT can make mistakes 提示隐藏\n\n   全部交给 Tampermonkey 脚本处理。\n\n   Stylus 不再控制：\n   opacity\n   transform\n   display\n   background\n   box-shadow\n\n   这样可以避免两个脚本互相冲突。\n   ========================================================= */\n\n\n\n/* =========================================================\n   一、参数区\n   =========================================================\n\n   所有默认值都在脚本顶部的 DEFAULT_CONFIG 里，\n   实际生效值由 applyUserConfigCssVariables() 以内联变量写入。\n   修改请改 DEFAULT_CONFIG，或使用“自定义配置”面板。\n   ========================================================= */\n\n/* 参数区 CSS 变量由 applyUserConfigCssVariables() 内联注入，此处不再重复声明。 */\n\n\n\n/* =========================================================\n   二、聊天正文区域加宽\n   ========================================================= */\n\n\n/*\n * ChatGPT 内部很多容器使用 max-w-* 限制宽度。\n *\n * 这里统一覆盖。\n */\nmain [class*=\"max-w-\"],\nmain .mx-auto {\n\n    max-width: var(--chatgpt-content-width) !important;\n}\n\n\n\n/*\n * 新版 ChatGPT 每条消息通常都有：\n *\n * data-message-author-role=\"assistant\"\n * data-message-author-role=\"user\"\n *\n * 直接调整消息区域宽度。\n */\nmain [data-message-author-role] {\n\n    max-width: var(--chatgpt-content-width) !important;\n}\n\n\n\n/*\n * 兼容部分旧版 / 特殊页面结构。\n */\nmain article {\n\n    max-width: var(--chatgpt-content-width) !important;\n}\n\n\n\n/* =========================================================\n   三、底部输入框宽度\n   =========================================================\n\n   注意：\n\n   这里只改宽度。\n\n   不修改：\n   opacity\n   transform\n   display\n   background\n   box-shadow\n\n   因为这些状态现在由 Tampermonkey 负责。\n   ========================================================= */\n\n\n/*\n * Tampermonkey 已经识别出来的真正输入框。\n *\n * 这个选择器优先级最高、最准确。\n */\nform[data-tm-chatgpt-composer=\"true\"] {\n\n    max-width: var(--chatgpt-composer-width) !important;\n}\n\n\n\n/*\n * ChatGPT 新版可能使用 composer 标记。\n *\n * 作为 Tampermonkey 标记尚未建立时的兜底。\n */\nmain [data-testid=\"composer\"],\nmain [class*=\"composer\"] {\n\n    max-width: var(--chatgpt-composer-width) !important;\n}\n\n\n\n/*\n * 普通 form 作为最后兜底。\n *\n * 不设置任何显示/隐藏效果。\n */\nmain form {\n\n    max-width: var(--chatgpt-composer-width) !important;\n}\n\n\n\n/* =========================================================\n   四、聊天正文普通字体\n   ========================================================= */\n\n\n/*\n * 普通段落和列表。\n *\n * p\n * = 普通段落\n *\n * li\n * = 列表项目\n *\n * ol\n * = 有序列表\n *\n * ul\n * = 无序列表\n *\n * blockquote\n * = 引用\n *\n * table / th / td\n * = 表格\n */\n\nmain [data-message-author-role] p,\nmain [data-message-author-role] li,\nmain [data-message-author-role] ol,\nmain [data-message-author-role] ul,\nmain [data-message-author-role] blockquote,\nmain [data-message-author-role] table,\nmain [data-message-author-role] th,\nmain [data-message-author-role] td,\n\nmain article p,\nmain article li,\nmain article ol,\nmain article ul,\nmain article blockquote,\nmain article table,\nmain article th,\nmain article td {\n\n    font-size:\n        var(--chatgpt-message-font-size)\n        !important;\n\n    line-height:\n        var(--chatgpt-message-line-height)\n        !important;\n}\n\n\n\n/* =========================================================\n   五、Markdown / Prose 容器字体\n   =========================================================\n\n   ChatGPT 回答正文通常会被包在 Markdown / Prose 容器中。\n\n   这里作为字体设置的第二层保障。\n   ========================================================= */\n\nmain [data-message-author-role] .markdown,\nmain [data-message-author-role] .prose,\n\nmain article .markdown,\nmain article .prose {\n\n    font-size:\n        var(--chatgpt-message-font-size)\n        !important;\n\n    line-height:\n        var(--chatgpt-message-line-height)\n        !important;\n}\n\n\n\n/* =========================================================\n   六、一级标题 H1\n   ========================================================= */\n\nmain [data-message-author-role] h1,\nmain article h1 {\n\n    font-size:\n        var(--chatgpt-h1-size)\n        !important;\n\n    line-height:\n        1.35\n        !important;\n}\n\n\n\n/* =========================================================\n   七、二级标题 H2\n   ========================================================= */\n\nmain [data-message-author-role] h2,\nmain article h2 {\n\n    font-size:\n        var(--chatgpt-h2-size)\n        !important;\n\n    line-height:\n        1.4\n        !important;\n}\n\n\n\n/* =========================================================\n   八、三级标题 H3\n   ========================================================= */\n\nmain [data-message-author-role] h3,\nmain article h3 {\n\n    font-size:\n        var(--chatgpt-h3-size)\n        !important;\n\n    line-height:\n        1.45\n        !important;\n}\n\n\n\n/* =========================================================\n   九、代码块\n   ========================================================= */\n\n\n/*\n * pre\n *\n * 整个代码块外层。\n *\n * width: 100%\n * → 尽量占满正文区域。\n *\n * overflow-x: auto\n * → 一行代码太长时出现横向滚动，\n *   不会把整个网页撑宽。\n */\n\nmain pre {\n\n    width:\n        100%\n        !important;\n\n    max-width:\n        100%\n        !important;\n\n    font-size:\n        var(--chatgpt-code-font-size)\n        !important;\n\n    line-height:\n        1.55\n        !important;\n\n    overflow-x:\n        auto\n        !important;\n}\n\n\n\n/*\n * code\n *\n * 控制真正的代码文字。\n *\n * 包括：\n *\n * `行内代码`\n *\n * 和整块代码里的文字。\n */\n\nmain code,\nmain pre code {\n\n    font-size:\n        var(--chatgpt-code-font-size)\n        !important;\n}\n\n\n\n/* =========================================================\n   十、输入框字体\n   ========================================================= */\n\n\n/*\n * textarea\n *\n * 兼容旧版输入框。\n *\n *\n * [contenteditable=\"true\"]\n *\n * 兼容新版富文本输入框。\n */\n\nmain textarea,\n\nmain [contenteditable=\"true\"],\n\nmain [data-testid=\"composer\"] textarea,\n\nmain [class*=\"composer\"] textarea,\n\nform[data-tm-chatgpt-composer=\"true\"] textarea,\n\nform[data-tm-chatgpt-composer=\"true\"]\n[contenteditable=\"true\"] {\n\n    font-size:\n        var(--chatgpt-input-font-size)\n        !important;\n\n    line-height:\n        1.5\n        !important;\n}\n\n\n\n/* =========================================================\n   十一、表格\n   ========================================================= */\n\n\n/*\n * 表格内容很宽时允许横向滚动，\n * 防止整个页面被撑开。\n */\n\nmain table {\n\n    max-width:\n        100%\n        !important;\n}\n\n\n\n/* =========================================================\n   十二、防止长文字撑坏布局\n   ========================================================= */\n\n\n/*\n * 很长的网址、\n * 很长的英文字符串、\n * 随机字符串，\n *\n * 如果一行放不下，\n * 允许浏览器自动换行。\n */\n\nmain p,\nmain li,\nmain blockquote {\n\n    overflow-wrap:\n        anywhere\n        !important;\n}\n\n\n\n/* =========================================================\n   十三、图片和媒体防止超出正文\n   ========================================================= */\n\nmain [data-message-author-role] img,\nmain article img,\n\nmain [data-message-author-role] video,\nmain article video {\n\n    max-width:\n        100%\n        !important;\n\n    height:\n        auto\n        !important;\n}\n\n\n\n/* =========================================================\n   十四、与 Tampermonkey 自动隐藏脚本的兼容说明\n   =========================================================\n\n   下面这些样式，本 Stylus CSS 故意不设置：\n\n   opacity\n   transform\n   pointer-events\n   display\n   visibility\n\n   background\n   background-image\n   box-shadow\n   filter\n   backdrop-filter\n\n\n   原因：\n\n   Tampermonkey 脚本目前负责：\n\n   1. 输入框隐藏\n   2. 输入框弹出\n   3. 鼠标离开输入框立即隐藏\n   4. 阅读状态底部透明\n   5. 隐藏：\n      ChatGPT can make mistakes.\n      Check important info.\n\n   因此：\n\n   Stylus = 页面排版\n\n   Tampermonkey = 输入框动态行为\n\n   两者职责分离，避免互相冲突。\n   ========================================================= */\n\n\n/* =========================================================\n   用户提问字体大小\n   ========================================================= */\n\n/* 只调整你自己发送的消息 */\nmain [data-message-author-role=\"user\"],\nmain [data-message-author-role=\"user\"] * {\n    font-size: var(--chatgpt-user-message-font-size) !important;\n    line-height: var(--chatgpt-user-message-line-height) !important;\n}\n\n\n/* =========================================================\n   用户提问气泡宽度\n   ========================================================= */\n\n/* 整个用户消息容器靠右 */\nmain [data-message-author-role=\"user\"] {\n    display: flex !important;\n    justify-content: flex-end !important;\n    min-width: 0 !important;\n}\n\n\n/* 用户提问气泡本身限制宽度 */\nmain [data-message-author-role=\"user\"] > div {\n    max-width: var(--chatgpt-user-bubble-max-width) !important;\n    width: fit-content !important;\n    min-width: 0 !important;\n    box-sizing: border-box !important;\n    overflow-wrap: anywhere !important;\n    word-break: break-word !important;\n}\n\n\n/* 用户提问中的长链接 / 长字符串正常换行 */\nmain [data-message-author-role=\"user\"] p,\nmain [data-message-author-role=\"user\"] a,\nmain [data-message-author-role=\"user\"] span {\n    max-width: 100% !important;\n    min-width: 0 !important;\n    overflow-wrap: anywhere !important;\n    word-break: break-word !important;\n}\n";
        /*
         * 旧整合样式里的通配 max-w-/mx-auto 规则过宽；在同一 style 末尾
         * 撤销它，并只对白名单正文宽度类和消息容器应用配置宽度。
         */
        style.textContent += `
            main [class*="max-w-"],
            main .mx-auto {
                max-width: revert !important;
            }

            main :is(
                [class~="max-w-2xl"],
                [class~="max-w-3xl"],
                [class~="max-w-4xl"],
                [class~="max-w-5xl"],
                [class~="max-w-6xl"],
                [class~="max-w-7xl"]
            ),
            main [data-message-author-role],
            main article {
                max-width: var(--chatgpt-content-width) !important;
            }
        `;

        document.documentElement.appendChild(style);
    }


    // ChatGPT 新版消息没有 data-message-author-role / article。
    // 只补齐对应排版选择器，沿用上面的用户配置变量。
    const modernMessageStyle = document.createElement("style");
    modernMessageStyle.setAttribute("data-tm-chatgpt-modern-message-css", "true");
    modernMessageStyle.textContent = `
        main [data-markdown-text-style="assistant-message"],
        main [data-markdown-text-style="assistant-message"] p,
        main [data-markdown-text-style="assistant-message"] li,
        main [data-markdown-text-style="assistant-message"] ol,
        main [data-markdown-text-style="assistant-message"] ul,
        main [data-markdown-text-style="assistant-message"] blockquote,
        main [data-markdown-text-style="assistant-message"] table,
        main [data-markdown-text-style="assistant-message"] th,
        main [data-markdown-text-style="assistant-message"] td {
            font-size: var(--chatgpt-message-font-size) !important;
            line-height: var(--chatgpt-message-line-height) !important;
        }

        main [data-markdown-text-style="assistant-message"] h1 {
            font-size: var(--chatgpt-h1-size) !important;
            line-height: 1.35 !important;
        }
        main [data-markdown-text-style="assistant-message"] h2 {
            font-size: var(--chatgpt-h2-size) !important;
            line-height: 1.4 !important;
        }
        main [data-markdown-text-style="assistant-message"] h3 {
            font-size: var(--chatgpt-h3-size) !important;
            line-height: 1.45 !important;
        }

        main [data-user-message-bubble="true"],
        main [data-user-message-bubble="true"] * {
            font-size: var(--chatgpt-user-message-font-size) !important;
            line-height: var(--chatgpt-user-message-line-height) !important;
        }
        main [data-user-message-bubble="true"] {
            max-width: var(--chatgpt-user-bubble-max-width) !important;
            width: fit-content !important;
        }

        main [data-markdown-text-style="assistant-message"] img,
        main [data-markdown-text-style="assistant-message"] video {
            max-width: 100% !important;
            height: auto !important;
        }
    `;
    // 保留源码换行。新版 ChatGPT 用 whitespace-pre-wrap 类表示用户开启
    // 换行，不能用固定的 white-space 覆盖原生按钮；内部高亮继承 pre。
    // 旧版没有该标记时默认不折行，超长行由 pre 横向滚动。
    modernMessageStyle.textContent += `
        main pre {
            box-sizing: border-box !important;
            min-width: 0 !important;
            white-space: pre !important;
            overflow-wrap: normal !important;
            word-break: normal !important;
        }

        main pre.whitespace-pre-wrap {
            white-space: pre-wrap !important;
            overflow-wrap: anywhere !important;
        }

        main pre code,
        main pre code * {
            white-space: inherit !important;
            overflow-wrap: inherit !important;
            word-break: inherit !important;
        }

        main pre code {
            max-width: none !important;
        }

        /* DIL 将算法图渲染为 img，而非页面中的 svg 节点。
         * 正文加宽时 width:100% 会按比例把图撑到数屏高。
         * 限制图高并用 contain 完整显示，为标题、图例和操作区留出空间；
         * 不限制普通照片、公式、视频或按钮图标。
         */
        [data-dil-message-id] img[data-d-component="svg"],
        main [data-message-author-role] img[data-d-component="svg"] {
            max-width: 100% !important;
            width: 100% !important;
            height: auto !important;
            max-height: clamp(120px, calc(100dvh - 400px), 560px) !important;
            object-fit: contain !important;
        }
    `;
    document.documentElement.appendChild(modernMessageStyle);

    /*
     * 新版 ChatGPT 会给每轮消息和整个虚拟列表写入缓存高度。自定义字体、
     * 行距或正文宽度改变实际排版后，提交下一问的瞬间，上一轮的缓存高度
     * 偶尔仍是旧值，后续问题便会覆盖旧回复；刷新页面会因重新测量而恢复。
     *
     * 永久用 CSS 覆盖这些高度会破坏原生虚拟列表和滚动定位。这里只在“已有
     * 下一轮且上一轮内容确实高于缓存”时加临时 min-height；原生缓存追上后
     * 立即撤销，让 ChatGPT 继续拥有正常的虚拟化与滚动行为。
     */
    const HISTORY_GUARD_ATTRIBUTE = "data-tm-chatgpt-history-height-guard";
    const HISTORY_GUARD_HEIGHT = "--tm-chatgpt-history-min-height";
    const HISTORY_GUARD_TOLERANCE = 2;
    let historyGuardScheduled = false;
    let historyGuardTimers = [];
    const historyGuardObservers = new WeakMap();

    const historyGuardStyle = document.createElement("style");
    historyGuardStyle.setAttribute("data-tm-chatgpt-history-guard-css", "true");
    historyGuardStyle.textContent = `
        [${HISTORY_GUARD_ATTRIBUTE}="true"] {
            min-height: var(${HISTORY_GUARD_HEIGHT}) !important;
        }
    `;
    document.documentElement.appendChild(historyGuardStyle);

    function getInlinePixelHeight(element) {
        const match = element?.style?.height?.match(/^([0-9]+(?:\.[0-9]+)?)px$/);
        return match ? Number(match[1]) : null;
    }

    function clearHistoryHeightGuard(element) {
        if (!element) return;
        historyGuardObservers.get(element)?.disconnect();
        historyGuardObservers.delete(element);
        element.removeAttribute(HISTORY_GUARD_ATTRIBUTE);
        element.style.removeProperty(HISTORY_GUARD_HEIGHT);
    }

    function setHistoryHeightGuard(element, height) {
        const guardedHeight = `${Math.ceil(height)}px`;
        if (element.style.getPropertyValue(HISTORY_GUARD_HEIGHT) !== guardedHeight) {
            element.style.setProperty(HISTORY_GUARD_HEIGHT, guardedHeight);
        }
        if (element.getAttribute(HISTORY_GUARD_ATTRIBUTE) !== "true") {
            element.setAttribute(HISTORY_GUARD_ATTRIBUTE, "true");
        }

        if (!historyGuardObservers.has(element)) {
            const observer = new MutationObserver(scheduleHistoryHeightGuard);
            observer.observe(element, { attributes: true, attributeFilter: ["style"] });
            historyGuardObservers.set(element, observer);
        }
    }

    function reconcileHistoryHeightGuards() {
        const conversation = document.querySelector(
            'main [data-chatgpt-conversation-selection-target="true"]'
        );
        const turns = conversation
            ? Array.from(conversation.querySelectorAll("[data-turn-key]"))
            : [];

        const activeGuards = document.querySelectorAll(
            `[${HISTORY_GUARD_ATTRIBUTE}="true"]`
        );
        activeGuards.forEach(element => {
            if (!conversation?.contains(element)) clearHistoryHeightGuard(element);
        });

        if (turns.length < 2) {
            activeGuards.forEach(clearHistoryHeightGuard);
            return;
        }

        let guardedTurn = false;
        for (const turn of turns.slice(0, -1)) {
            const cache = turn.parentElement;
            if (!cache || cache.children.length !== 1 || cache.firstElementChild !== turn) {
                if (cache?.hasAttribute(HISTORY_GUARD_ATTRIBUTE)) {
                    clearHistoryHeightGuard(cache);
                }
                continue;
            }

            const cachedHeight = getInlinePixelHeight(cache);
            const contentHeight = turn.getBoundingClientRect().height;
            if (cachedHeight === null || contentHeight <= 0) {
                clearHistoryHeightGuard(cache);
                continue;
            }

            if (cachedHeight + HISTORY_GUARD_TOLERANCE < contentHeight) {
                setHistoryHeightGuard(cache, contentHeight);
                guardedTurn = true;
            }
            else {
                clearHistoryHeightGuard(cache);
            }
        }

        const turnColumn = turns[0].parentElement?.parentElement;
        const totalCache = turnColumn?.parentElement;
        if (!guardedTurn) {
            if (totalCache?.hasAttribute(HISTORY_GUARD_ATTRIBUTE)) {
                clearHistoryHeightGuard(totalCache);
            }
            return;
        }

        const totalCachedHeight = getInlinePixelHeight(totalCache);
        if (!turnColumn || totalCachedHeight === null) return;

        const contentHeight = Math.max(
            turnColumn.getBoundingClientRect().height,
            turnColumn.scrollHeight
        );
        if (totalCachedHeight + HISTORY_GUARD_TOLERANCE < contentHeight) {
            setHistoryHeightGuard(totalCache, contentHeight);
        }
        else {
            clearHistoryHeightGuard(totalCache);
        }
    }

    function scheduleHistoryHeightGuard() {
        if (historyGuardScheduled) return;
        historyGuardScheduled = true;
        requestAnimationFrame(() => requestAnimationFrame(() => {
            historyGuardScheduled = false;
            reconcileHistoryHeightGuards();
        }));

        historyGuardTimers.forEach(clearTimeout);
        historyGuardTimers = [250, 1000, 2500].map(delay =>
            setTimeout(reconcileHistoryHeightGuards, delay)
        );
    }


    /*
     * =========================================================
     * ChatGPT Custom UI v1.4.57
     *
     * 模块 1：输入框自动隐藏 + 首页常显 + 控件保护 + 删除免责声明
     * 模块 2：跳到底部箭头智能显示
     * 模块 3：右上角按钮透明悬停显示
     * 模块 4：鼠标静止 4 秒自动隐藏
     *
     * 这一版优先保持三个原脚本的行为不变。
     * 各模块仍使用自己的局部作用域，因此同名变量/函数不会冲突。
     * =========================================================
     */

    const sharedMouseMoveHandlers = [];

    document.addEventListener(
        "mousemove",
        event => {
            for (const handler of sharedMouseMoveHandlers) {
                try {
                    handler(event);
                }

                catch (error) {
                    console.error(
                        "[ChatGPT Custom UI] mousemove handler failed",
                        error
                    );
                }
            }
        },
        { passive: true }
    );

    function onSharedMouseMove(handler) {
        sharedMouseMoveHandlers.push(handler);
    }

    const sharedMutationHandlers = [];

    const sharedMutationObserver =
        new MutationObserver(
            mutationRecords => {
                for (const handler of sharedMutationHandlers) {
                    try {
                        handler(mutationRecords);
                    }

                    catch (error) {
                        console.error(
                            "[ChatGPT Custom UI] mutation handler failed",
                            error
                        );
                    }
                }
            }
        );

    if (document.body || document.documentElement) {
        sharedMutationObserver.observe(
            document.body ||
                document.documentElement,
            {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: [
                    "aria-label",
                    "title",
                    "data-testid",
                    "role"
                ]
            }
        );
    }

    function onSharedMutation(handler) {
        sharedMutationHandlers.push(handler);
    }

    onSharedMutation(mutationRecords => {
        const turnAdded = mutationRecords.some(record =>
            Array.from(record.addedNodes || []).some(node =>
                node.nodeType === Node.ELEMENT_NODE && (
                    node.matches?.("[data-turn-key]") ||
                    node.querySelector?.("[data-turn-key]")
                )
            )
        );

        if (turnAdded) scheduleHistoryHeightGuard();
    });

    document.addEventListener("submit", scheduleHistoryHeightGuard, true);

    const sharedRouteChangeHandlers = [];

    function getSharedRouteKey() {
        return location.pathname + location.search + location.hash;
    }

    let sharedLastRoute = getSharedRouteKey();

    setInterval(
        () => {
            if (document.hidden) {
                return;
            }

            const nextRoute = getSharedRouteKey();

            if (nextRoute === sharedLastRoute) {
                return;
            }

            sharedLastRoute = nextRoute;

            for (const handler of sharedRouteChangeHandlers) {
                try {
                    handler(sharedLastRoute);
                }

                catch (error) {
                    console.error(
                        "[ChatGPT Custom UI] route handler failed",
                        error
                    );
                }
            }
        },
        300
    );

    function onSharedRouteChange(handler) {
        sharedRouteChangeHandlers.push(handler);

        try {
            handler(sharedLastRoute);
        }

        catch (error) {
            console.error(
                "[ChatGPT Custom UI] initial route handler failed",
                error
            );
        }
    }



    /* ==================== 模块 1：输入框 ==================== */

(function () {
    "use strict";


    /* =========================================================
       一、参数区
       ========================================================= */


    /*
     * 具体对话页：
     * 鼠标距离浏览器底部多少像素以内时显示输入框。
     *
     * 80  = 比较靠下
     * 100 = 当前推荐
     * 120 = 更容易触发
     * 150 = 很容易触发
     *
     * 首页不受这个参数影响：
     * 首页输入框始终显示。
     */
    const TRIGGER_HEIGHT = USER_CONFIG.composerTriggerHeight;


    /*
     * 输入框显示 / 隐藏动画时间。
     * 单位：毫秒。
     */
    const TRANSITION_TIME = USER_CONFIG.composerTransitionTime;


    /*
     * 输入框隐藏时视觉向下移动多少像素。
     *
     * 这里只使用 transform，
     * 不改变正文布局高度。
     */
    const HIDE_TRANSLATE_Y = USER_CONFIG.composerHideTranslateY;


    /*
     * 页面加载后再次初始化的延迟。
     */
    const INITIAL_HIDE_DELAY = USER_CONFIG.composerInitialHideDelay;


    /*
     * 从 composer 向外最多检查多少层。
     *
     * 用于寻找底部 Dock / 背景 / 渐变层。
     */
    const MAX_PARENT_LEVELS = USER_CONFIG.composerMaxParentLevels;


    /*
     * ChatGPT 2026-10 的新版页面在 composer 与真正的 sticky Dock
     * 之间又增加了多层 wrapper。用户设置里的旧默认值 10 仍用于兼容，
     * 但结构识别必须至少检查 24 层，否则最外层的 ::before 渐变不会被
     * 标记，输入框隐藏后会在页面底部留下大块黑色阴影。
     */
    const STRUCTURE_SCAN_LIMIT = MAX_PARENT_LEVELS;


    /*
     * 输入框状态变化以后，
     * 连续多少帧恢复滚动位置。
     *
     * 用于降低回复末尾的正文上下跳动。
     */
    const SCROLL_LOCK_FRAMES = USER_CONFIG.composerScrollLockFrames;


    /*
     * 要永久删除的免责声明。
     */
    const DISCLAIMER_TEXT =
        "chatgpt can make mistakes. check important info.";

    // 新版文案加入了 “is AI and”；仍只匹配完整提示，避免误删普通正文。
    function isDisclaimerText(text) {
        const normalized = normalizeText(text);
        return normalized === DISCLAIMER_TEXT
            || normalized === "chatgpt is ai and can make mistakes. check important info.";
    }



    /* =========================================================
       二、状态变量
       ========================================================= */

    let currentComposer = null;

    let currentDock = null;

    let currentScroller = null;

    /*
     * 新版会话页会先挂载 composer，随后才挂载内部的
     * .thread-scroll-container。初次只能回退到 document 时，
     * 不能把这个回退结果永久缓存。
     */
    let currentScrollerIsFallback = false;

    let observerScheduled = false;

    let pendingMutationRecords = [];

    /*
     * 后台标签页里 requestAnimationFrame 会被暂停，
     * pendingMutationRecords 可能一直累积。
     * 设一个上限，超出时丢弃最旧的记录，避免内存无限增长。
     */
    const MAX_PENDING_MUTATION_RECORDS = 4000;

    let lastMouseY = null;

    let scrollLockGeneration = 0;


    document.addEventListener(
        "tm:cancel-composer-scroll-lock",
        () => {

            scrollLockGeneration += 1;
        }
    );

    let composerVisible = false;

    let lastMarkedComposer = null;

    let lastRoute = getSharedRouteKey();

    let composerRevealSuppressed = false;

    let lastScrollerUpgradeProbeAt = 0;

    const SCROLLER_UPGRADE_PROBE_INTERVAL = 500;



    /* =========================================================
       三、页面类型判断
       ========================================================= */


    /*
     * ChatGPT 具体会话有两种 URL：
     *
     * /c/{conversationId}
     * /g/{gptOrProjectId}/c/{conversationId}
     *
     * 首页 /、GPT / Project 页面本身（/g/{id}）
     * 不是具体会话。
     */
    function isConversationPage() {

        const pathname =
            location.pathname;

        return (
            /^\/c\/[^/]+\/?$/.test(
                pathname
            ) ||
            /^\/g\/[^/]+\/c\/[^/]+\/?$/.test(
                pathname
            )
        );
    }


    /*
     * 只有具体会话页面启用自动隐藏。
     *
     * 首页 / 新建聊天页面：
     * 输入框始终显示。
     */
    function shouldAutoHideComposer() {

        return isConversationPage();
    }



    /* =========================================================
       四、注入 CSS
       ========================================================= */

    const style =
        document.createElement("style");


    style.textContent = `

        /* =====================================================
           B. 对话阅读模式：
           隐藏整个 composer form
           =====================================================

           显示与隐藏只改变 opacity / transform / pointer-events。
           Footer、sticky spacer 和滚动间距始终保留原生尺寸。
           flex-col-reverse 滚动容器中改变占位高度，即使恢复相同
           scrollTop 也会移动正文；保持布局不变才能避免文字起伏。
           隐藏态底板由 E 区透明化，正文不会被黑色背景遮住。
           ===================================================== */

        body:not(.tm-chatgpt-composer-visible)
        form[data-tm-chatgpt-composer="true"] {

            opacity:
                0
                !important;

            transform:
                translateY(${HIDE_TRANSLATE_Y}px)
                !important;

            pointer-events:
                none
                !important;

            visibility:
                hidden
                !important;

            transition:
                opacity ${TRANSITION_TIME}ms ease,
                transform ${TRANSITION_TIME}ms ease,
                visibility 0s linear ${TRANSITION_TIME}ms
                !important;
        }



        /* =====================================================
           C. composer 显示
           ===================================================== */

        body.tm-chatgpt-composer-visible
        form[data-tm-chatgpt-composer="true"] {

            opacity:
                1
                !important;

            visibility:
                visible
                !important;

            transform:
                translateY(0)
                !important;

            pointer-events:
                auto
                !important;

            transition:
                opacity ${TRANSITION_TIME}ms ease,
                transform ${TRANSITION_TIME}ms ease,
                visibility 0s linear 0s
                !important;
        }



        /* =====================================================
           D. 明确保护 ChatGPT 原生交互控件
           =====================================================

           当 composer 显示时：

           button
           input
           textarea
           contenteditable

           都必须恢复正常显示和交互。

           这包括：

           + 附件按钮
           麦克风
           语音按钮
           模型按钮
           发送按钮
           其他原生工具按钮
           ===================================================== */

        body.tm-chatgpt-composer-visible
        form[data-tm-chatgpt-composer="true"] button,

        body.tm-chatgpt-composer-visible
        form[data-tm-chatgpt-composer="true"] input,

        body.tm-chatgpt-composer-visible
        form[data-tm-chatgpt-composer="true"] textarea,

        body.tm-chatgpt-composer-visible
        form[data-tm-chatgpt-composer="true"] [contenteditable="true"] {

            opacity:
                1
                !important;

            visibility:
                visible
                !important;

            pointer-events:
                auto
                !important;
        }



        /* =====================================================
           E. 阅读模式：
           清除底部背景 / 渐变 / 阴影
           ===================================================== */

        body:not(.tm-chatgpt-composer-visible)
        [data-tm-chatgpt-clear-layer="true"] {

            background-color:
                transparent
                !important;

            background-image:
                none
                !important;

            box-shadow:
                none
                !important;

            filter:
                none
                !important;

            backdrop-filter:
                none
                !important;

            -webkit-backdrop-filter:
                none
                !important;

            mask-image:
                none
                !important;

            -webkit-mask-image:
                none
                !important;
        }



        body:not(.tm-chatgpt-composer-visible)
        [data-tm-chatgpt-clear-layer="true"]::before,

        body:not(.tm-chatgpt-composer-visible)
        [data-tm-chatgpt-clear-layer="true"]::after {

            background-color:
                transparent
                !important;

            background-image:
                none
                !important;

            box-shadow:
                none
                !important;

            filter:
                none
                !important;

            backdrop-filter:
                none
                !important;

            -webkit-backdrop-filter:
                none
                !important;

            mask-image:
                none
                !important;

            -webkit-mask-image:
                none
                !important;
        }



        /*
         * 只清理 Dock 本身及其伪元素。
         * 不能使用 [data-tm-chatgpt-dock] *：共享对话的 DIL 图表、
         * 进度条和状态条也可能位于该容器后代中，清空所有后代背景
         * 会让这些彩色可视化全部变成页面底色。
         */
        body:not(.tm-chatgpt-composer-visible)
        [data-tm-chatgpt-dock="true"],

        body:not(.tm-chatgpt-composer-visible)
        [data-tm-chatgpt-dock="true"]::before,

        body:not(.tm-chatgpt-composer-visible)
        [data-tm-chatgpt-dock="true"]::after {

            background-color:
                transparent
                !important;

            background-image:
                none
                !important;

            box-shadow:
                none
                !important;

            filter:
                none
                !important;

            backdrop-filter:
                none
                !important;

            -webkit-backdrop-filter:
                none
                !important;

            mask-image:
                none
                !important;

            -webkit-mask-image:
                none
                !important;
        }



        /*
         * 新版 ChatGPT 把覆盖正文的底部淡出遮罩放在稳定的
         * #thread-bottom-container 上，并用哈希类名的
         * *_threadFooterContentFade 生成背景或伪元素。
         *
         * 这里只清理该 Footer 本身及其伪元素，绝不选择其后代，
         * 因而不会再次清空 DIL 图表、进度条或区间条的颜色。
         */
        body:not(.tm-chatgpt-composer-visible)
        #thread-bottom-container,

        body:not(.tm-chatgpt-composer-visible)
        #thread-bottom-container::before,

        body:not(.tm-chatgpt-composer-visible)
        #thread-bottom-container::after,

        body:not(.tm-chatgpt-composer-visible)
        [class*="_threadFooterContentFade"],

        body:not(.tm-chatgpt-composer-visible)
        [class*="_threadFooterContentFade"]::before,

        body:not(.tm-chatgpt-composer-visible)
        [class*="_threadFooterContentFade"]::after {

            background-color:
                transparent
                !important;

            background-image:
                none
                !important;

            box-shadow:
                none
                !important;

            filter:
                none
                !important;

            backdrop-filter:
                none
                !important;

            -webkit-backdrop-filter:
                none
                !important;

            mask-image:
                none
                !important;

            -webkit-mask-image:
                none
                !important;
        }



        /*
         * Footer 的黑色淡出层也可能由内部 wrapper 的背景或伪元素
         * 绘制。消息正文与 DIL 图表并不在 #thread-bottom-container
         * 内，因此可以在 composer 隐藏时清理这里的 div / form，
         * 同时避免再次影响正文中的彩色条形组件。
         */
        body:not(.tm-chatgpt-composer-visible)
        #thread-bottom-container div,

        body:not(.tm-chatgpt-composer-visible)
        #thread-bottom-container form,

        body:not(.tm-chatgpt-composer-visible)
        #thread-bottom-container div::before,

        body:not(.tm-chatgpt-composer-visible)
        #thread-bottom-container div::after,

        body:not(.tm-chatgpt-composer-visible)
        #thread-bottom-container form::before,

        body:not(.tm-chatgpt-composer-visible)
        #thread-bottom-container form::after {

            background-color:
                transparent
                !important;

            background-image:
                none
                !important;

            box-shadow:
                none
                !important;

            filter:
                none
                !important;

            backdrop-filter:
                none
                !important;

            -webkit-backdrop-filter:
                none
                !important;

            mask-image:
                none
                !important;

            -webkit-mask-image:
                none
                !important;
        }



        /*
         * 新版 Footer 不再使用 #thread-bottom-container，而是
         * data-thread-scroll-footer。黑色底板是 composer 的兄弟节点，
         * 不在 composer 的祖先清理链中。只清理 Footer 自身及其
         * 直接 aria-hidden 装饰层（含伪元素），避免影响正文图表。
         */
        body:not(.tm-chatgpt-composer-visible)
        [data-tm-chatgpt-scroller="true"] > [data-thread-scroll-footer="true"],

        body:not(.tm-chatgpt-composer-visible)
        [data-tm-chatgpt-scroller="true"] > [data-thread-scroll-footer="true"]::before,

        body:not(.tm-chatgpt-composer-visible)
        [data-tm-chatgpt-scroller="true"] > [data-thread-scroll-footer="true"]::after,

        body:not(.tm-chatgpt-composer-visible)
        [data-tm-chatgpt-scroller="true"] > [data-thread-scroll-footer="true"] > [aria-hidden="true"],

        body:not(.tm-chatgpt-composer-visible)
        [data-tm-chatgpt-scroller="true"] > [data-thread-scroll-footer="true"] > [aria-hidden="true"]::before,

        body:not(.tm-chatgpt-composer-visible)
        [data-tm-chatgpt-scroller="true"] > [data-thread-scroll-footer="true"] > [aria-hidden="true"]::after {

            background: transparent !important;
            box-shadow: none !important;
            filter: none !important;
            backdrop-filter: none !important;
            -webkit-backdrop-filter: none !important;
            mask-image: none !important;
            -webkit-mask-image: none !important;
        }



        /*
         * 2026-10 新版把底部渐变移到了 thread content 内：
         *
         * thread-scroll-container
         *   -> thread content
         *      -> sticky bottom spacer
         *         -> bg-gradient-to-t
         *
         * 这层是 composer dock 的兄弟分支，不在 dock 后代中，
         * 因而上面的通用清理规则覆盖不到。仅在 composer 隐藏时
         * 清除这块原生渐变，显示输入框时保留 ChatGPT 默认效果。
         */
        body:not(.tm-chatgpt-composer-visible)
        [data-tm-chatgpt-scroller="true"]
        [aria-hidden="true"].sticky.bottom-0
        >
        [aria-hidden="true"].bg-gradient-to-t.from-surface {

            background-color:
                transparent
                !important;

            background-image:
                none
                !important;

            box-shadow:
                none
                !important;

            filter:
                none
                !important;

            backdrop-filter:
                none
                !important;

            -webkit-backdrop-filter:
                none
                !important;
        }

    `;


    document.documentElement.appendChild(
        style
    );


    /* =========================================================
       五、文本标准化
       ========================================================= */

    function normalizeText(text) {

        return (
            text
                ?.replace(/\s+/g, " ")
                .trim()
                .toLowerCase()
            ||
            ""
        );
    }



    /* =========================================================
       六、判断元素里面有没有重要交互控件
       =========================================================

       这是 v13 的关键保护机制。

       一个容器只要包含这些东西，
       就绝对不能因为删除免责声明而 remove()。
       ========================================================= */

    function containsProtectedControls(
        element
    ) {

        if (!element) {
            return false;
        }


        const selector =
            [
                "button",
                "input",
                "textarea",
                "select",
                '[contenteditable="true"]',
                '[role="button"]',
                '[role="textbox"]',
                "svg",
                "img",
                "picture",
                "canvas"
            ].join(",");


        /*
         * 注意：
         *
         * querySelector 只会匹配 descendants，
         * 匹配不到 element 自己。
         *
         * 所以必须同时用 matches 判断 element 自身
         * 是否就是交互控件 / 图标。
         */
        return (
            !!element.matches?.(selector)
            ||
            !!element.querySelector?.(selector)
        );
    }



    /* =========================================================
       八、永久删除免责声明
       =========================================================

       旧版问题：

       旧脚本会：

       免责声明元素
             ↓
       向上寻找最多 4 层
             ↓
       只要 parent.textContent 仍然是免责声明
             ↓
       整个 parent.remove()

       但 "+"、麦克风等图标按钮通常没有文字。

       因此：

       一个容器可能包含：

       [+] + 免责声明

       但它的 textContent 仍然只有免责声明。

       旧代码就可能把 "+" 所在的父容器一起删掉。

       ---------------------------------------------------------

       新逻辑：

       1. 找到最小的免责声明文字元素，兼容新旧完整文案。
       2. 用 display:none 隐藏，保留 React 管理的节点。
       3. 绝不隐藏包含 button / input / editor 的容器。
       4. 继续扫描其他匹配项，兼容同时挂载多个底部提示。
       ========================================================= */

    function removeDisclaimerFromRoot(
        root
    ) {

        if (!root) return false;

        const candidates = [];
        let hidden = false;

        if (
            root.nodeType === Node.TEXT_NODE
        ) {

            if (
                !isDisclaimerText(root.nodeValue)
            ) {

                return false;
            }

            return removeDisclaimerFromRoot(root.parentElement);
        }

        if (
            root.nodeType !== Node.ELEMENT_NODE
        ) {

            return false;
        }

        if (
            root.matches?.(
                "small, p, span, div, a"
            )
        ) {

            candidates.push(
                root
            );
        }

        root
            .querySelectorAll?.(
                "small, p, span, div, a"
            )
            .forEach(
                element => {

                    candidates.push(
                        element
                    );
                }
            );


        for (
            const element
            of candidates
        ) {

            // 消息正文可能恰好复述免责声明；只清理页脚/非消息区域。
            if (
                element.closest?.(
                    '[data-message-author-role], article, [data-turn-key]'
                )
            ) {
                continue;
            }

            /*
             * 免责声明清理绝不进入 composer / dock 结构：
             *
             * 无论 candidate 是 composer 自己、
             * composer 的祖先 wrapper，
             * 还是 composer 内部的元素，
             * 都直接跳过。
             *
             * 保护 + 附件按钮、麦克风、Instant、
             * 发送按钮等原生控件。
             */
            if (
                element === currentComposer
                ||
                element === currentDock
                ||
                (
                    currentComposer
                    &&
                    currentComposer.isConnected
                    &&
                    (
                        element.contains?.(
                            currentComposer
                        )
                        ||
                        currentComposer.contains?.(
                            element
                        )
                    )
                )
                ||
                (
                    currentDock
                    &&
                    currentDock.isConnected
                    &&
                    (
                        element.contains?.(
                            currentDock
                        )
                        ||
                        currentDock.contains?.(
                            element
                        )
                    )
                )
            ) {

                continue;
            }


            const text =
                normalizeText(
                    element.textContent
                );


            if (
                !isDisclaimerText(text)
            ) {
                continue;
            }


            /*
             * -------------------------------------------------
             * 第一步：
             * 找最小匹配节点。
             * -------------------------------------------------
             *
             * 如果它有某个子元素本身也正好等于免责声明，
             * 则继续往下找，
             * 避免删除过大的外层容器。
             */

            let target =
                element;


            let foundSmaller =
                true;


            while (foundSmaller) {

                foundSmaller =
                    false;


                for (
                    const child
                    of target.children
                ) {

                    if (
                        isDisclaimerText(child.textContent)
                    ) {

                        target =
                            child;


                        foundSmaller =
                            true;


                        break;
                    }
                }
            }


            /*
             * -------------------------------------------------
             * 第二步：
             * 如果 target 自己包含交互控件，
             * 绝对不能删除整个 target。
             * -------------------------------------------------
             */

            if (
                containsProtectedControls(
                    target
                )
            ) {

                /*
                 * 尝试只隐藏纯提示文本所在的无控件元素。
                 */
                const walker =
                    document.createTreeWalker(
                        target,
                        NodeFilter.SHOW_TEXT
                    );


                const textNodes =
                    [];


                let node;


                while (
                    (
                        node =
                            walker.nextNode()
                    )
                ) {

                    if (
                        isDisclaimerText(node.nodeValue)
                    ) {

                        textNodes.push(
                            node
                        );
                    }
                }


                textNodes.forEach(
                    textNode => {

                        const parent = textNode.parentElement;
                        if (parent && !containsProtectedControls(parent)) {
                            parent.style.setProperty("display", "none", "important");
                        }
                    }
                );


                hidden = true;
                continue;
            }



            /*
             * -------------------------------------------------
             * 第三步：
             * target 没有交互控件，
             * 可以安全隐藏最小免责声明元素。
             * -------------------------------------------------
             */

            // 保留 React 管理的节点，避免 hydration / 后续更新因节点被删除而崩溃。
            target.style.setProperty("display", "none", "important");

            hidden = true;
        }


        return hidden;
    }


    function removeDisclaimer() {

        const mainEl = document.querySelector('main');

        removeModernDisclaimerFromRoot(mainEl);

        return removeDisclaimerFromRoot(
            mainEl
        );
    }

    function removeModernDisclaimerFromRoot(root) {
        if (!root || root.nodeType !== Node.ELEMENT_NODE) return;

        const selector = 'div[data-markdown-copy="exclude"]';
        const candidates = root.matches(selector)
            ? [root]
            : root.querySelectorAll(selector);

        for (const element of candidates) {
            if (
                element.isConnected &&
                element.closest("main") &&
                isDisclaimerText(element.textContent) &&
                !containsProtectedControls(element)
            ) {
                element.style.setProperty("display", "none", "important");
            }
        }
    }

    function removeCookiePreferencesFromRoot(root) {
        if (!root || root.nodeType !== Node.ELEMENT_NODE) return;

        const buttons = root.matches("button")
            ? [root]
            : root.querySelectorAll("button");

        for (const button of buttons) {
            if (
                button.isConnected &&
                button.closest("main") &&
                normalizeText(button.textContent) === "cookie preferences"
            ) {
                // 保留 React 管理的节点，避免后续 patch/unmount 抛错。
                button.style.setProperty("display", "none", "important");
            }
        }
    }

    function removeCookiePreferences() {
        removeCookiePreferencesFromRoot(document.querySelector("main"));
    }

    function removeDisclaimerFromMutations(
        mutationRecords
    ) {

        let removed =
            false;


        for (
            const record
            of mutationRecords
        ) {

            for (
                const node
                of record.addedNodes
            ) {

                /*
                 * streaming 期间这个函数每一帧都会执行。
                 *
                 * 免责声明只存在于聊天正文里。
                 *
                 * 新增节点在 composer 内部时跳过；
                 * 新增节点是 composer / dock 的祖先 wrapper 时
                 * （React 整块重建的情况）同样跳过，
                 * 绝不扫描 composer 周边结构。
                 */
                if (
                    node.nodeType ===
                        Node.ELEMENT_NODE
                    &&
                    (
                        (
                            currentComposer
                            &&
                            currentComposer.isConnected
                            &&
                            (
                                currentComposer.contains(
                                    node
                                )
                                ||
                                node.contains?.(
                                    currentComposer
                                )
                            )
                        )
                        ||
                        (
                            currentDock
                            &&
                            currentDock.isConnected
                            &&
                            (
                                currentDock.contains(
                                    node
                                )
                                ||
                                node.contains?.(
                                    currentDock
                                )
                            )
                        )
                    )
                ) {

                    continue;
                }


                /*
                 * 纯文本节点直接比对，零成本。
                 */
                if (
                    node.nodeType ===
                    Node.TEXT_NODE
                ) {

                    if (
                        isDisclaimerText(node.nodeValue)
                    ) {

                        removed = removeDisclaimerFromRoot(node.parentElement) || removed;
                    }


                    continue;
                }


                if (
                    node.nodeType !==
                    Node.ELEMENT_NODE
                ) {

                    continue;
                }


                /*
                 * 粗过滤：
                 *
                 * 只对整个新增子树做一次 textContent 读取。
                 * 不含相关关键词的子树（streaming 时的绝大多数
                 * mutation）直接跳过，不进入细粒度全量扫描。
                 */
                const subtreeText =
                    node.textContent
                    ||
                    "";

                const lowerSubtreeText =
                    subtreeText.toLowerCase();


                /*
                 * 旧版免责声明。
                 */
                if (
                    subtreeText.length >=
                        DISCLAIMER_TEXT.length
                    &&
                    lowerSubtreeText.includes(
                        "mistakes"
                    )
                ) {

                    if (
                        removeDisclaimerFromRoot(
                            node
                        )
                    ) {

                        removed =
                            true;
                    }


                    /*
                     * 新版免责声明文本同样包含 "mistakes"。
                     */
                    removeModernDisclaimerFromRoot(
                        node
                    );
                }


                /*
                 * Cookie preferences 按钮。
                 */
                if (
                    lowerSubtreeText.includes(
                        "cookie preferences"
                    )
                ) {

                    removeCookiePreferencesFromRoot(
                        node
                    );
                }
            }
        }


        return removed;
    }



    /* =========================================================
       九、寻找真正的正文滚动容器
       ========================================================= */

    function findScrollContainer() {

        const docScroller =
            document.scrollingElement;

        /*
         * 2026-10 新版 ChatGPT 的稳定滚动根。
         * 它使用 flex-col-reverse，scrollTop 在离开底部后为负值。
         * 优先使用原生语义类，避免页面初次渲染时误缓存 <html>。
         */
        const nativeThreadScroller =
            document.querySelector(
                ".thread-scroll-container"
            );


        if (
            nativeThreadScroller
            &&
            nativeThreadScroller.scrollHeight >
                nativeThreadScroller.clientHeight + 20
        ) {

            document
                .querySelectorAll(
                    '[data-tm-chatgpt-scroller="true"]'
                )
                .forEach(element => {
                    if (element !== nativeThreadScroller) {
                        element.removeAttribute(
                            "data-tm-chatgpt-scroller"
                        );
                    }
                });


            nativeThreadScroller.setAttribute(
                "data-tm-chatgpt-scroller",
                "true"
            );


            currentScroller =
                nativeThreadScroller;


            currentScrollerIsFallback =
                false;


            return nativeThreadScroller;
        }

        const message =
            document.querySelector(
                [
                    '[data-message-author-role]',
                    '[data-markdown-text-style="assistant-message"]',
                    '[data-user-message-bubble="true"]'
                ].join(",")
            );


        if (message) {

            let parent =
                message.parentElement;


            while (
                parent &&
                parent !== document.body
            ) {

                const computed =
                    getComputedStyle(
                        parent
                    );


                const overflowY =
                    computed.overflowY;


                const scrollable =
                    (
                        overflowY === "auto"
                        ||
                        overflowY === "scroll"
                        ||
                        overflowY === "overlay"
                    )
                    &&
                    parent.scrollHeight >
                    parent.clientHeight + 20;


                if (scrollable) {

                    parent.setAttribute?.(
                        "data-tm-chatgpt-scroller",
                        "true"
                    );


                    currentScroller =
                        parent;


                    currentScrollerIsFallback =
                        false;


                    return parent;
                }


                parent =
                    parent.parentElement;
            }
        }


        const candidates =
            document.querySelectorAll(
                "main div"
            );


        let bestCandidate =
            null;


        let bestScrollableHeight =
            0;


        for (
            const element
            of candidates
        ) {

            const computed =
                getComputedStyle(
                    element
                );


            const overflowY =
                computed.overflowY;


            const scrollable =
                (
                    overflowY === "auto"
                    ||
                    overflowY === "scroll"
                )
                &&
                element.scrollHeight >
                element.clientHeight + 20;


            if (!scrollable) {
                continue;
            }


            /*
             * 只接受真正包含消息的滚动容器。
             * 否则短会话时可能选中侧边栏等
             * 与正文无关的可滚动区域。
             */
            if (
                !element.querySelector(
                    [
                        '[data-message-author-role]',
                        '[data-markdown-text-style="assistant-message"]',
                        '[data-user-message-bubble="true"]'
                    ].join(",")
                )
            ) {
                continue;
            }


            const scrollableHeight =
                element.scrollHeight -
                element.clientHeight;


            if (
                scrollableHeight >
                bestScrollableHeight
            ) {

                bestScrollableHeight =
                    scrollableHeight;


                bestCandidate =
                    element;
            }
        }


        const scroller =
            bestCandidate
            ||
            docScroller;


        if (scroller) {

            scroller.setAttribute?.(
                "data-tm-chatgpt-scroller",
                "true"
            );
        }


        currentScroller =
            scroller;


        currentScrollerIsFallback =
            scroller === docScroller;


        return scroller;
    }


    function getScrollContainer(
        forceRefresh = false
    ) {

        if (
            !forceRefresh
            &&
            currentScrollerIsFallback
            &&
            document.querySelector(
                ".thread-scroll-container"
            )
        ) {

            forceRefresh = true;
        }

        if (
            !forceRefresh
            &&
            currentScroller
            &&
            (
                currentScroller ===
                    document.scrollingElement
                ||
                currentScroller.isConnected
            )
        ) {

            return currentScroller;
        }


        return findScrollContainer();
    }



    /* =========================================================
       十、记录当前滚动状态
       ========================================================= */

    function captureScrollState() {

        const scroller =
            getScrollContainer();


        if (!scroller) {
            return null;
        }

        // 新版会话由原生虚拟列表维护滚动和高度。输入框只改透明度与
        // transform，不影响文档流；回写旧 scrollTop 会与流式输出、
        // 原生定位和用户滚轮竞争。仅旧版页面保留显隐时的短暂补偿。
        if (scroller.matches?.('.thread-scroll-container') ||
            scroller.querySelector?.('[data-turn-key]')) {
            return null;
        }

        return {

            scroller,

            scrollTop:
                scroller.scrollTop,

            scrollLeft:
                scroller.scrollLeft,
            scrollHeight: scroller.scrollHeight,
            pathname: location.pathname
        };
    }



    /* =========================================================
       十一、恢复滚动状态
       ========================================================= */

    function restoreScrollState(
        state
    ) {

        if (
            !state
            ||
            !state.scroller
            || !state.scroller.isConnected
            || state.pathname !== location.pathname
            || state.scrollHeight !== state.scroller.scrollHeight
        ) {
            return;
        }


        try {

            state.scroller.scrollTop =
                state.scrollTop;


            state.scroller.scrollLeft =
                state.scrollLeft;
        }

        catch (error) {

            /*
             * React 动态替换 DOM 时忽略。
             */
        }
    }



    /* =========================================================
       十二、多帧锁定滚动位置
       ========================================================= */

    function lockScrollPosition(
        state,
        remainingFrames =
            SCROLL_LOCK_FRAMES,
        generation =
            null
    ) {

        if (generation === null) {

            scrollLockGeneration += 1;


            generation =
                scrollLockGeneration;
        }

        if (
            !state
            ||
            remainingFrames <= 0
        ) {
            return;
        }


        requestAnimationFrame(
            () => {

                if (
                    generation !==
                    scrollLockGeneration
                ) {

                    return;
                }

                restoreScrollState(
                    state
                );


                lockScrollPosition(
                    state,
                    remainingFrames - 1,
                    generation
                );
            }
        );
    }



    /* =========================================================
       十三、显示输入框
       ========================================================= */

    // 用户开始滚动、拖动滚动条、输入或发送时，旧版补偿也必须立即让位。
    for (const eventName of ['wheel', 'touchstart', 'pointerdown', 'keydown', 'submit']) {
        document.addEventListener(eventName, () => { scrollLockGeneration += 1; },
            { capture: true, passive: true });
    }

    function showComposer() {

        if (currentComposer?.isConnected) {
            currentComposer.inert = false;
            currentComposer.removeAttribute("inert");
            currentComposer.removeAttribute("aria-hidden");
        }

        /*
         * 已经显示时不做任何事：
         *
         * 不重复 add class，
         * 也不重复触发 scroll lock。
         */
        if (composerVisible && document.body.classList.contains(
            "tm-chatgpt-composer-visible"
        )) {
            return;
        }


        const scrollState =
            captureScrollState();


        document.body.classList.add(
            "tm-chatgpt-composer-visible"
        );


        composerVisible =
            true;


        lockScrollPosition(
            scrollState
        );
    }



    /* =========================================================
       十四、隐藏输入框
       ========================================================= */

    function hideComposer(preserveScroll = true, suppressReveal = false) {

        // 点击/滚动隐藏后，DOM 更新不能复用发送时的底部鼠标位置来重新显示。
        // 只有下一次真实鼠标移动到触发区才允许 reveal。
        lastMouseY = null;

        if (suppressReveal) {
            composerRevealSuppressed = true;
        }

        /*
         * 首页永远不能隐藏。
         */
        if (
            !shouldAutoHideComposer()
        ) {

            showComposer();

            return;
        }


        if (!composerVisible) {
            if (currentComposer?.isConnected) {
                if (currentComposer.contains(document.activeElement)) {
                    document.activeElement?.blur?.();
                }

                currentComposer.inert = true;
                currentComposer.setAttribute("inert", "");
                currentComposer.setAttribute("aria-hidden", "true");
            }

            if (
                document.body.classList.contains(
                    "tm-chatgpt-composer-visible"
                )
            ) {

                document.body.classList.remove(
                    "tm-chatgpt-composer-visible"
                );
            }


            return;
        }


        const scrollState = preserveScroll ? captureScrollState() : null;


        composerVisible =
            false;

        if (currentComposer?.isConnected) {
            if (currentComposer.contains(document.activeElement)) {
                document.activeElement?.blur?.();
            }

            currentComposer.inert = true;
            currentComposer.setAttribute("inert", "");
            currentComposer.setAttribute("aria-hidden", "true");
        }


        document.body.classList.remove(
            "tm-chatgpt-composer-visible"
        );


        lockScrollPosition(
            scrollState
        );
    }



    /* =========================================================
       十五、根据鼠标位置控制输入框
       ========================================================= */

    function updateComposerByMousePosition(
        clientY
    ) {

        /*
         * 首页：
         * 永久显示。
         */
        if (
            !shouldAutoHideComposer()
        ) {

            showComposer();

            return;
        }


        /*
         * 进入具体会话后，
         * 如果暂时不知道鼠标位置：
         * 保持当前状态，不强制隐藏。
         *
         * 隐藏只允许由「点击 composer 外部」触发。
         */
        if (
            clientY === null
            ||
            clientY === undefined
        ) {

            return;
        }


        const distanceToBottom =
            window.innerHeight -
            clientY;

        if (distanceToBottom > TRIGGER_HEIGHT) {
            composerRevealSuppressed = false;
            return;
        }

        if (composerRevealSuppressed) return;


        /*
         * 单向 reveal：
         * 仅在鼠标进入底部触发区域时显示 composer。
         *
         * 鼠标离开触发区域、移动到正文或页面顶部，
         * 都不能隐藏 composer —— mousemove
         * 只有显示 composer 的权限。
         */
        if (
            distanceToBottom <=
            TRIGGER_HEIGHT
        ) {

            showComposer();
        }
    }



    /* =========================================================
       十六、寻找真正的 composer form
       ========================================================= */

    function findComposer() {

        /*
         * 2026-10 新版提供了稳定的原生 composer 标记。
         * 先用它锁定会话输入框，避免未来页面出现其它带编辑器的 form
         * 时误选搜索框或弹窗表单。
         */
        const nativeComposer = findNativeThreadComposer();
        if (nativeComposer) return nativeComposer;

        const forms =
            document.querySelectorAll(
                "form"
            );


        for (
            const form
            of forms
        ) {

            const textarea =
                form.querySelector(
                    "textarea"
                );


            const editable =
                form.querySelector(
                    '[contenteditable="true"]'
                );


            if ((textarea || editable) && isRenderedComposer(form)) {

                return form;
            }
        }


        return null;
    }


    function isRenderedComposer(form) {
        if (!form?.isConnected || form.closest('[hidden]')) return false;

        // 脚本会给隐藏的 composer 自身加 inert；只有祖先 inert 才表示旧页面树。
        const inertRoot = form.closest('[inert]');
        if (inertRoot && inertRoot !== form) return false;

        const rect = form.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
    }

    function findNativeThreadComposer() {
        return Array.from(document.querySelectorAll(
            'form[data-composer-placement="thread"][data-chatgpt-composer]'
        )).find(isRenderedComposer) || null;
    }

    function getComposer(
        forceRefresh = false
    ) {

        if (
            !forceRefresh
            &&
            currentComposer
            &&
            isRenderedComposer(currentComposer)
        ) {

            return currentComposer;
        }

        // 仅在缓存失效、路由变化或 mutation 明确带来新 form 时做布局探测。
        const nativeComposer = findNativeThreadComposer();
        if (nativeComposer && nativeComposer !== currentComposer) {
            currentComposer = nativeComposer;
            return nativeComposer;
        }


        const composer =
            findComposer();


        currentComposer =
            composer;


        return composer;
    }



    /* =========================================================
       十七、清除旧标记
       ========================================================= */

    function clearOldMarks(
        nextComposer = null,
        nextDock = null
    ) {

        document.querySelectorAll('[data-tm-chatgpt-composer="true"]')
            .forEach(element => {
                if (element !== nextComposer) {
                    element.removeAttribute("data-tm-chatgpt-composer");
                }
            });

        document
            .querySelectorAll(
                '[data-tm-chatgpt-clear-layer="true"]'
            )
            .forEach(
                element => {

                    if (
                        element === nextComposer
                        ||
                        element === nextDock
                    ) {

                        return;
                    }

                    element.removeAttribute(
                        "data-tm-chatgpt-clear-layer"
                    );
                }
            );


        document
            .querySelectorAll(
                '[data-tm-chatgpt-dock="true"]'
            )
            .forEach(
                element => {

                    if (
                        element === nextDock
                    ) {

                        return;
                    }

                    element.removeAttribute(
                        "data-tm-chatgpt-dock"
                    );
                }
            );
    }



    /* =========================================================
       十八、寻找 composer Dock
       ========================================================= */

    function findComposerDock(
        composer
    ) {

        let element =
            composer.parentElement;


        let bestCandidate =
            composer;


        let level =
            0;


        while (
            element
            &&
            level <
            STRUCTURE_SCAN_LIMIT
        ) {

            if (
                element === document.body
                ||
                element ===
                document.documentElement
            ) {
                break;
            }


            const computed =
                getComputedStyle(
                    element
                );


            const rect =
                element
                    .getBoundingClientRect();


            const nearBottom =
                Math.abs(
                    window.innerHeight -
                    rect.bottom
                ) < 150;


            const dockSized =
                rect.height > 0
                &&
                rect.height <= Math.max(
                    360,
                    window.innerHeight * 0.65
                );


            /*
             * 全页 main / 会话正文也常与视口底部对齐，
             * 只有尺寸符合底部输入区的候选才能作为 Dock。
             */


            if (
                dockSized
                &&
                (
                    computed.position === "fixed"
                    ||
                    computed.position === "sticky"
                )
            ) {

                bestCandidate =
                    element;


                break;
            }


            if (
                nearBottom
                &&
                dockSized
            ) {

                bestCandidate =
                    element;
            }


            element =
                element.parentElement;


            level++;
        }


        if (
            !bestCandidate
            ||
            !canMarkClearLayer(bestCandidate)
        ) {
            return null;
        }


        return bestCandidate;
    }



    /* =========================================================
       十九、判断一个层是否可以进行视觉清理
       =========================================================

       这里不删除任何元素。

       只是决定是否加：

       data-tm-chatgpt-clear-layer

       即使里面有按钮也没关系，因为这里只在
       composer 隐藏状态清除背景和阴影。

       但是不会：
       display:none
       remove()
       visibility:hidden
       ========================================================= */

    function canMarkClearLayer(
        element
    ) {

        if (!element) {
            return false;
        }


        if (
            element === document.body
            ||
            element ===
            document.documentElement
        ) {
            return false;
        }


        const rect =
            element.getBoundingClientRect();


        if (
            rect.height > Math.max(
                360,
                window.innerHeight * 0.65
            )
        ) {

            return false;
        }


        return true;
    }


    /* =========================================================
       二十、标记 composer 结构
       ========================================================= */

    function markComposerStructure(
        composer,
        forceRefresh = false
    ) {

        if (
            !forceRefresh
            &&
            composer === lastMarkedComposer
            &&
            composer.isConnected
            &&
            currentDock
            &&
            currentDock.isConnected
            &&
            composer.getAttribute(
                "data-tm-chatgpt-composer"
            )
            ===
            "true"
        ) {

            return;
        }


        /*
         * 真正 composer form。
         */
        if (
            composer.getAttribute(
                "data-tm-chatgpt-composer"
            )
            !==
            "true"
        ) {

            composer.setAttribute(
                "data-tm-chatgpt-composer",
                "true"
            );
        }


        const dock =
            (
                !forceRefresh
                &&
                composer === lastMarkedComposer
                &&
                currentDock
                &&
                currentDock.isConnected
            )
                ? currentDock
                : findComposerDock(
                    composer
                );


        clearOldMarks(
            composer,
            canMarkClearLayer(dock)
                ? dock
                : null
        );


        if (dock && canMarkClearLayer(dock)) {

            if (
                dock.getAttribute(
                    "data-tm-chatgpt-dock"
                )
                !==
                "true"
            ) {

                dock.setAttribute(
                    "data-tm-chatgpt-dock",
                    "true"
                );
            }


            currentDock =
                dock;
        }

        else {

            /*
             * dock 为空或落在 body / documentElement 上时，
             * 不标记并清空缓存，
             * 否则会清空整页后代的背景和滤镜。
             */
            currentDock =
                null;
        }


        let element =
            composer;


        let level =
            0;


        while (
            element
            &&
            level <
            STRUCTURE_SCAN_LIMIT
        ) {

            if (
                !canMarkClearLayer(
                    element
                )
            ) {

                break;
            }


            if (
                element.getAttribute(
                    "data-tm-chatgpt-clear-layer"
                )
                !==
                "true"
            ) {

                element.setAttribute(
                    "data-tm-chatgpt-clear-layer",
                    "true"
                );
            }


            if (
                dock
                &&
                element === dock
            ) {

                break;
            }


            element =
                element.parentElement;


            level++;
        }


        lastMarkedComposer =
            composer;
    }



    /* =========================================================
       二十一、统一更新当前页面状态
       ========================================================= */

    function updatePageState() {

        /*
         * 首页 / 新建聊天：
         * 永远显示 composer。
         */
        if (
            !shouldAutoHideComposer()
        ) {

            showComposer();

            return;
        }


        /*
         * 具体会话：
         * 按鼠标高度控制。
         */
        updateComposerByMousePosition(
            lastMouseY
        );
    }



    /* =========================================================
       二十二、初始化 / 更新 composer
       ========================================================= */

    function setupComposer() {

        return refreshComposer(
            {
                forceComposer: true,
                forceScroller: true,
                forceStructure: true,
                scanDisclaimer: true
            }
        );
    }


    function refreshComposer(
        {
            forceComposer = false,
            forceScroller = false,
            forceStructure = false,
            scanDisclaimer = false
        } = {}
    ) {

        if (scanDisclaimer) {

            removeDisclaimer();
            removeCookiePreferences();
        }


        const composer =
            getComposer(
                forceComposer
            );


        if (!composer) {
            return;
        }


        getScrollContainer(
            forceScroller
        );


        markComposerStructure(
            composer,
            forceStructure
        );

        if (document.body.classList.contains("tm-chatgpt-composer-visible")) {
            composer.inert = false;
            composer.removeAttribute("inert");
            composer.removeAttribute("aria-hidden");
        }

        else {
            composer.inert = true;
            composer.setAttribute("inert", "");
            composer.setAttribute("aria-hidden", "true");
        }


        updatePageState();
    }



    /* =========================================================
       二十三、监听鼠标移动
       ========================================================= */

    onSharedMouseMove(
        event => {

            // 箭头及其 SVG 属于独立滚动控件，悬停时不触发输入框。
            if (event.target?.closest?.(
                '[data-tm-scroll-bottom-button="true"].tm-scroll-bottom-visible'
            )) {
                lastMouseY = null;
                return;
            }

            lastMouseY =
                event.clientY;


            updatePageState();
        }
    );



    /* =========================================================
       二十四-C、监听滚轮滚动（向上滚动隐藏输入框）
       ========================================================= */

    document.addEventListener(
        "wheel",

        event => {

            if (!shouldAutoHideComposer()) {
                return;
            }

            if (!composerVisible) {
                return;
            }

            const target = event.target;

            // 滚轮发生在输入框内部时，绝对不隐藏（保护打字/编辑）
            if (
                currentComposer?.contains(target)
                || currentDock?.contains(target)
            ) {
                return;
            }

            // 仅向上滚动（deltaY < 0）时隐藏
            if (event.deltaY < 0) {
                // 滚轮默认动作尚未执行，不能锁回动作前的 scrollTop。
                hideComposer(false, true);
            }
        },

        {
            passive: true
        }
    );



    /* =========================================================
       二十四、鼠标离开网页
       ========================================================= */

    document.addEventListener(
        "mouseleave",

        () => {

            lastMouseY =
                null;


            /*
             * 首页：
             * 保持 composer 显示。
             */
            if (
                !shouldAutoHideComposer()
            ) {

                showComposer();
            }


            /*
             * 对话页：
             * 鼠标离开网页本身不触发隐藏。
             *
             * 隐藏只允许由「点击 composer 外部」触发。
             */
        }
    );



    /* =========================================================
       二十四-B、点击 composer 外部隐藏
       =========================================================

       行为规则：

       mousemove 只有显示 composer 的权限，
       没有隐藏 composer 的权限。

       只有「点击 composer 外部」才能隐藏 composer。

       点击 composer 自身或其内部任意控件：
       textarea
       contenteditable
       发送按钮
       附件按钮
       + 按钮
       麦克风
       语音按钮
       模型选择器
       工具按钮
       其他原生控件

       都不会隐藏。

       使用捕获阶段的 pointerdown 而不是 click：
       触发更早，也不会被新版正文层的 stopPropagation 拦截。

       首页 / 新建聊天：
       composer 始终显示，点击外部不隐藏。
       ========================================================= */

    document.addEventListener(
        "pointerdown",

        event => {

            if (!shouldAutoHideComposer()) {
                return;
            }

            const target =
                event.target instanceof Element
                    ? event.target
                    : event.target?.parentElement;

            if (!target) {
                return;
            }

            // 点击时先标记当前真正的表单，不依赖上一次路由刷新时的缓存。
            const composer = getComposer();
            if (composer) markComposerStructure(composer);

            // 1. 点击输入框内部 → 不隐藏
            if (composer?.contains(target) || currentDock?.contains(target)) return;

            // Portal 浮层挂在 body 下，但仍属于 composer 的交互流程。
            if (target.closest(
                '[role="dialog"], [role="menu"], [role="listbox"], ' +
                '[aria-modal="true"], [data-radix-popper-content-wrapper]'
            )) {
                return;
            }

            // 2. 点击聊天正文区域（main）
            const mainEl = document.querySelector('main');
            if (mainEl && mainEl.contains(target)) {
                // 如果点击的是链接、按钮、输入框等交互元素，不隐藏（避免打断操作）
                if (
                    target.closest('a') ||
                    target.closest('button') ||
                    target.closest('[role="button"]') ||
                    target.closest('input') ||
                    target.closest('textarea')
                ) {
                    return;
                }
                // 否则点击正文文字、空白、代码、图片等 → 隐藏
                hideComposer(true, true);
                return;
            }

            // 3. 点击其他区域（侧边栏、顶部导航等）也隐藏
            hideComposer(true, true);
        },
        {
            passive: true,
            capture: true
        }
    );



    /* =========================================================
       二十五、监听页面动态更新
       ========================================================= */

    onSharedMutation(
        mutationRecords => {

            for (
                const record
                of mutationRecords
            ) {

                pendingMutationRecords.push(
                    record
                );
            }


            if (
                pendingMutationRecords.length >
                MAX_PENDING_MUTATION_RECORDS
            ) {

                pendingMutationRecords.splice(
                    0,
                    pendingMutationRecords.length -
                        MAX_PENDING_MUTATION_RECORDS
                );
            }


            if (
                observerScheduled
            ) {
                return;
            }


            observerScheduled =
                true;


            requestAnimationFrame(
                () => {

                    observerScheduled =
                        false;


                    const recordsToProcess =
                        pendingMutationRecords;


                    pendingMutationRecords =
                        [];


                    removeDisclaimerFromMutations(
                        recordsToProcess
                    );


                    /*
                     * SPA 路由变化。
                     */
                    let routeChanged =
                        false;


                    const nextRoute = getSharedRouteKey();

                    if (nextRoute !== lastRoute) {

                        lastRoute = nextRoute;


                        routeChanged =
                            true;


                        updatePageState();
                    }


                    /*
                     * 缓存仍然有效时，
                     * 绝不重新执行：
                     *
                     * findComposer()
                     * findScrollContainer()
                     * findComposerDock()
                     * markComposerStructure()
                     *
                     * streaming 期间普通正文更新
                     * 只走下面的轻量 fast path。
                     */
                    // 即使旧节点仍连接，也要检测晚挂载的新会话表单。
                    const composerCandidateAdded = recordsToProcess.some(record =>
                        Array.from(record.addedNodes || []).some(node =>
                            node.nodeType === Node.ELEMENT_NODE
                            && (
                                node.matches?.('form[data-composer-placement="thread"][data-chatgpt-composer]')
                                || node.querySelector?.('form[data-composer-placement="thread"][data-chatgpt-composer]')
                            )
                        )
                    );

                    const composerBeforeRefresh = currentComposer;
                    const liveComposer = getComposer(composerCandidateAdded);
                    const composerAlive =
                        !!liveComposer && liveComposer === composerBeforeRefresh;


                    const scrollerAlive =
                        currentScroller &&
                        (
                            currentScroller ===
                                document.scrollingElement
                            ||
                            currentScroller.isConnected
                        );


                    const nativeScroller = currentScrollerIsFallback
                        ? document.querySelector(".thread-scroll-container")
                        : null;
                    const now = performance.now();
                    const scrollerNeedsUpgrade =
                        currentScrollerIsFallback
                        && nativeScroller
                        && nativeScroller.scrollHeight > nativeScroller.clientHeight + 20
                        && now - lastScrollerUpgradeProbeAt >= SCROLLER_UPGRADE_PROBE_INTERVAL;

                    if (scrollerNeedsUpgrade) {
                        lastScrollerUpgradeProbeAt = now;
                    }


                    const structureAlive =
                        composerAlive &&
                        lastMarkedComposer ===
                            currentComposer &&
                        currentComposer.getAttribute(
                            "data-tm-chatgpt-composer"
                        ) ===
                            "true" &&
                        currentDock &&
                        currentDock.isConnected;


                    if (routeChanged) {

                        refreshComposer(
                            {
                                forceComposer: true,
                                forceScroller: true,
                                forceStructure: true,
                                scanDisclaimer: true
                            }
                        );


                        return;
                    }


                    if (
                        !composerAlive
                        ||
                        !scrollerAlive
                        ||
                        scrollerNeedsUpgrade
                        ||
                        !structureAlive
                    ) {

                        /*
                         * composer 被 React 替换 / 删除，
                         * 或首次还没找到时，
                         * 只重新执行真正失效的部分。
                         */
                        refreshComposer(
                            {
                                forceComposer:
                                    !composerAlive,
                                forceScroller:
                                    !scrollerAlive
                                    ||
                                    scrollerNeedsUpgrade,
                                forceStructure:
                                    !structureAlive,
                                scanDisclaimer:
                                    false
                            }
                        );


                        return;
                    }


                    /*
                     * 普通 streaming 更新：
                     * 只同步页面状态。
                     */
                    updatePageState();
                }
            );
        }
    );



    /* =========================================================
       二十六、轻量 URL 变化检测
       ========================================================= */

    onSharedRouteChange(
        route => {
            lastRoute = route;


            requestAnimationFrame(
                () => {

                    refreshComposer(
                        {
                            forceComposer: true,
                            forceScroller: true,
                            forceStructure: true,
                            scanDisclaimer: true
                        }
                    );
                }
            );
        }
    );

    document.addEventListener("visibilitychange", () => {
        if (document.hidden) return;

        pendingMutationRecords = [];
        requestAnimationFrame(() => {
            refreshComposer({
                forceComposer: true,
                forceScroller: true,
                forceStructure: true,
                scanDisclaimer: true
            });
        });
    });



    /* =========================================================
       二十七、窗口大小变化
       ========================================================= */

    window.addEventListener(
        "resize",

            () => {

            getScrollContainer(
                true
            );


            if (
                currentComposer &&
                currentComposer.isConnected
            ) {

                markComposerStructure(
                    currentComposer,
                    true
                );
            }


            updatePageState();
        },

        {
            passive: true
        }
    );



    /* =========================================================
       二十八、首次初始化
       ========================================================= */

    removeDisclaimer();
    removeCookiePreferences();


    setupComposer();



    /* =========================================================
       二十九、延迟再次初始化
       ========================================================= */

    setTimeout(
        () => {

            removeDisclaimer();
            removeCookiePreferences();


            setupComposer();


            updatePageState();

        },
        INITIAL_HIDE_DELAY
    );

})();

    /* ==================== 模块 2：底部箭头 ==================== */

(function () {
    "use strict";


    /* =========================================================
       一、参数区
       ========================================================= */


    const BOTTOM_ARROW_ENABLED = USER_CONFIG.bottomArrowEnabled;


    /*
     * 停止操作多久以后隐藏箭头。
     *
     * “操作”包括：
     *
     * - 触控板上下滑
     * - 鼠标滚轮
     * - 鼠标移动
     *
     * 单位：毫秒
     *
     * 推荐：
     *
     * 300 = 很快消失
     * 500 = 推荐
     * 700 = 稍微停留久一点
     * 1000 = 停留 1 秒
     */
    const HIDE_DELAY = USER_CONFIG.bottomArrowHideDelay;


    /*
     * 箭头淡入 / 淡出动画时间。
     *
     * 单位：毫秒
     */
    const FADE_DURATION = USER_CONFIG.bottomArrowFadeDuration;


    /*
     * 判断“已经到最底部”的容差。
     *
     * 因为浏览器滚动值可能存在小数误差，
     * 所以不用严格等于 0。
     */
    const BOTTOM_THRESHOLD = USER_CONFIG.bottomArrowBottomThreshold;


    /*
     * 页面加载以后多久初始化。
     *
     * 单位：毫秒
     */
    const INITIAL_DELAY = USER_CONFIG.bottomArrowInitialDelay;


    /*
     * 鼠标移动多少像素以后，
     * 才认为是真正发生了鼠标移动。
     *
     * 这样可以避免鼠标非常轻微的抖动
     * 一直刷新隐藏计时器。
     *
     * 推荐：
     *
     * 0 = 任何移动都算
     * 2 = 推荐
     * 4 = 稍微明显移动才算
     */
    const MOUSE_MOVE_THRESHOLD = USER_CONFIG.bottomArrowMouseMoveThreshold;

    /*
     * 鼠标移动事件可能非常密集。
     * 这里限制由 mousemove 触发的箭头状态更新频率，
     * 避免每个像素移动都读滚动位置、切 class、重置定时器。
     */
    const MOUSE_ACTIVITY_INTERVAL = 80;


    const UPWARD_SCROLL_KEYS =
        new Set([
            "ArrowUp",
            "PageUp",
            "Home"
        ]);


    const DOWNWARD_SCROLL_KEYS =
        new Set([
            "ArrowDown",
            "PageDown",
            "End",
            " "
        ]);



    /* =========================================================
       二、状态变量
       ========================================================= */


    /*
     * 自动隐藏定时器。
     */
    let hideTimer = null;


    /*
     * 当前识别到的 ChatGPT “跳到底部”按钮。
     */
    let currentButton = null;


    /*
     * ChatGPT 正文真正的滚动容器。
     */
    let currentScroller = null;


    /*
     * 页面尚未渲染出消息时会暂时回退到 document.scrollingElement。
     * 这个回退不能永久缓存，否则 SPA 页面稍后挂载内部滚动容器后，
     * isAtBottom() 会一直读取错误的滚动根。
     */
    let currentScrollerIsFallback = false;
    let lastFallbackScrollerScanAt = 0;
    let currentScrollerUsesReverseFlow = false;


    /*
     * 用“距离页底”而不是直接用 scrollTop 判断方向。
     * 这样普通滚动容器和 column-reverse 容器都能统一处理：
     * 距离变小 = 向下翻；距离变大 = 向上翻。
     */
    let lastDistanceToBottom = null;


    /* -1 = 最近向上翻；0 = 无显示意图；1 = 最近向下翻。 */
    let lastScrollDirection = 0;


    const FALLBACK_SCROLLER_RESCAN_INTERVAL = 1000;


    /*
     * MutationObserver 节流。
     */
    let observerScheduled = false;


    /*
     * 记录上一次鼠标坐标。
     *
     * 用于判断鼠标是否真正移动。
     */
    let lastMouseX = null;
    let lastMouseY = null;

    let lastMouseActivityAt = 0;
    let mouseActivityTimer = null;



    /* =========================================================
       三、注入 CSS
       ========================================================= */


    const style =
        document.createElement("style");


    style.textContent = `

        /* =====================================================
           被脚本识别出来的“跳到底部”按钮
           ===================================================== */

        [data-tm-scroll-bottom-button="true"] {

            /* 仅移动按钮，不改变 Footer 布局；保留原生 translate 的水平居中。 */
            translate: 0 calc(-1 * var(--tm-scroll-arrow-lift, 48px)) !important;

            transition:
                opacity ${FADE_DURATION}ms ease,
                visibility ${FADE_DURATION}ms ease
                !important;
        }



        /* =====================================================
           向上滚动时把原生向下箭头旋转为向上箭头
           ===================================================== */

        [data-tm-scroll-bottom-button="true"] svg {

            transition:
                transform ${FADE_DURATION}ms ease
                !important;
        }


        [data-tm-scroll-bottom-button="true"]
        [data-tm-scroll-direction-icon="true"] {

            display:
                inline-block;

            transition:
                transform ${FADE_DURATION}ms ease
                !important;
        }


        [data-tm-scroll-bottom-button="true"][data-tm-scroll-direction="up"] svg,
        [data-tm-scroll-bottom-button="true"][data-tm-scroll-direction="up"]
        [data-tm-scroll-direction-icon="true"] {

            transform:
                rotate(180deg)
                !important;
        }



        /* =====================================================
           隐藏状态
           ===================================================== */

        [data-tm-scroll-bottom-button="true"]:not(.tm-scroll-bottom-visible),
        [data-tm-scroll-bottom-button="true"].tm-scroll-bottom-hidden {

            opacity:
                0
                !important;

            visibility:
                hidden
                !important;

            pointer-events:
                none
                !important;
        }



        /* =====================================================
           用户关闭底部箭头时，始终不显示
           ===================================================== */

        [data-tm-scroll-bottom-button="true"].tm-scroll-bottom-disabled,
        [data-tm-scroll-bottom-disabled="true"] {

            display:
                none
                !important;

            opacity:
                0
                !important;

            visibility:
                hidden
                !important;

            pointer-events:
                none
                !important;
        }



        /* =====================================================
           React 重建后残留的重复箭头
           ===================================================== */

        [data-tm-scroll-bottom-duplicate="true"],
        .tm-scroll-bottom-duplicate {

            display:
                none
                !important;

            opacity:
                0
                !important;

            visibility:
                hidden
                !important;

            pointer-events:
                none
                !important;
        }



        /* =====================================================
           显示状态
           ===================================================== */

        [data-tm-scroll-bottom-button="true"].tm-scroll-bottom-visible {

            opacity:
                1
                !important;

            visibility:
                visible
                !important;

            pointer-events:
                auto
                !important;
        }

    `;


    document.documentElement.appendChild(
        style
    );


    /*
     * 在文档捕获阶段优先接管“向上”按钮。
     * 这比按钮自身或 React 委托的 click 处理更早执行，
     * 可确保原生“跳到底部”动作不会覆盖“跳到顶部”。
     */
    document.addEventListener(
        "click",
        event => {

            const target =
                event.target;


            const button =
                target?.closest?.(
                    '[data-tm-scroll-bottom-button="true"]'
                );


            if (!button) {

                return;
            }


            document.dispatchEvent(
                new CustomEvent(
                    "tm:cancel-composer-scroll-lock"
                )
            );


            if (
                button.getAttribute(
                    "data-tm-scroll-direction"
                ) !== "up"
            ) {

                return;
            }


            event.preventDefault();


            event.stopImmediatePropagation();


            button.blur();


            scrollToTop();
        },
        true
    );



    /* =========================================================
       四、寻找真正的 ChatGPT 聊天滚动容器
       ========================================================= */


    function findScrollContainer() {

        /*
         * 优先从一条聊天消息开始，
         * 向上找真正能够纵向滚动的祖先。
         *
         * 比遍历整个页面猜哪个 div 是正文要稳定一些。
         */

        const message =
            document.querySelector(
                [
                    '[data-message-author-role]',
                    '[data-markdown-text-style="assistant-message"]',
                    '[data-user-message-bubble="true"]'
                ].join(",")
            );


        if (message) {

            let parent =
                message.parentElement;


            while (
                parent &&
                parent !== document.body
            ) {

                const computed =
                    getComputedStyle(
                        parent
                    );


                const overflowY =
                    computed.overflowY;


                const scrollable =
                    (
                        overflowY === "auto" ||
                        overflowY === "scroll" ||
                        overflowY === "overlay"
                    )
                    &&
                    parent.scrollHeight >
                    parent.clientHeight + 20;


                if (scrollable) {

                    currentScroller =
                        parent;


                    currentScrollerIsFallback =
                        false;


                    currentScrollerUsesReverseFlow =
                        computed.flexDirection ===
                        "column-reverse";


                    return parent;
                }


                parent =
                    parent.parentElement;
            }
        }



        /*
         * 有些 ChatGPT 版本直接使用 document 滚动。
         */
        currentScroller =
            document.scrollingElement;


        currentScrollerIsFallback =
            true;


        currentScrollerUsesReverseFlow =
            false;


        lastFallbackScrollerScanAt =
            Date.now();


        return currentScroller;
    }


    /*
     * 带缓存的滚动容器获取：
     *
     * streaming 期间 MutationObserver / scroll 高频触发，
     * 只要当前容器节点还连着 DOM（没有被 React 替换），
     * 就绝不重新执行 findScrollContainer() 的遍历。
     */
    function getScrollContainer() {

        if (
            currentScrollerIsFallback
            &&
            Date.now() - lastFallbackScrollerScanAt >=
                FALLBACK_SCROLLER_RESCAN_INTERVAL
        ) {

            return findScrollContainer();
        }

        if (
            currentScroller
            &&
            (
                currentScroller ===
                    document.scrollingElement
                ||
                currentScroller.isConnected
            )
        ) {

            return currentScroller;
        }


        return findScrollContainer();
    }



    /* =========================================================
       五、判断当前是不是已经到最底部
       ========================================================= */


    function getDistanceToBottom() {

        const scroller =
            getScrollContainer();


        if (!scroller) {

            return null;
        }


        const distanceToBottom =
            currentScrollerUsesReverseFlow
                ? Math.max(
                    0,
                    -scroller.scrollTop
                )
                : scroller.scrollHeight
                    -
                    scroller.clientHeight
                    -
                    scroller.scrollTop;


        return Math.max(
            0,
            distanceToBottom
        );
    }


    function isAtBottom() {

        const distanceToBottom =
            getDistanceToBottom();


        return (
            distanceToBottom !== null
            &&
            distanceToBottom <=
                BOTTOM_THRESHOLD
        );
    }


    function getDistanceToTop() {

        const scroller =
            getScrollContainer();


        if (!scroller) {

            return null;
        }


        const maxScrollDistance =
            Math.max(
                0,
                scroller.scrollHeight -
                    scroller.clientHeight
            );


        return currentScrollerUsesReverseFlow
            ? Math.max(
                0,
                maxScrollDistance +
                    scroller.scrollTop
            )
            : Math.max(
                0,
                scroller.scrollTop
            );
    }


    function isAtTop() {

        const distanceToTop =
            getDistanceToTop();


        return (
            distanceToTop !== null
            &&
            distanceToTop <=
                BOTTOM_THRESHOLD
        );
    }


    function scrollToTop() {

        const scroller =
            getScrollContainer();


        if (!scroller) {

            return;
        }


        const top =
            currentScrollerUsesReverseFlow
                ? -Math.max(
                    0,
                    scroller.scrollHeight -
                        scroller.clientHeight
                )
                : 0;


        /*
         * 直接赋值比 scrollTo() 更适合这里：
         * 某些经过框架包装的滚动容器会忽略 scrollTo({ top })，
         * 而 scrollTop 能可靠地完成即时跳转。
         */
        document.dispatchEvent(
            new CustomEvent(
                "tm:cancel-composer-scroll-lock"
            )
        );


        scroller.scrollTop =
            top;


        lastDistanceToBottom =
            getDistanceToBottom();


        lastScrollDirection =
            0;


        cancelHideTimer();


        hideButton();
    }


    function syncScrollDirectionBaseline() {

        lastDistanceToBottom =
            getDistanceToBottom();
    }



    /* =========================================================
       六、寻找 ChatGPT 原生“跳到底部”箭头
       ========================================================= */


    function findScrollBottomButton() {

        const buttons =
            Array.from(
                document.querySelectorAll(
                    "button, [role='button']"
                )
            );


        /*
         * 第一层：明确属性匹配。
         *
         * aria-label / title / data-testid /
     * aria-describedby 中匹配“scroll to bottom”的按钮，
         * 直接认定为 ChatGPT 原生“跳到底部”按钮，
         * 不再依赖尺寸 / 位置 / border-radius
         * 等几何猜测。
         *
         * 只需要保证：
         *
         * - 按钮还在 DOM 中
         * - 不是 composer 内部控件
         * - 实际有可见尺寸（排除被隐藏的旧副本）
         */
        let explicitCandidate =
            null;


        let explicitCandidateDistance =
            Infinity;


        for (
            const button
            of buttons
        ) {

            if (
                !button.isConnected
            ) {

                continue;
            }


            if (
                isComposerControl(
                    button
                )
            ) {

                continue;
            }


            const rect =
                button.getBoundingClientRect();


            if (
                rect.width <= 0 ||
                rect.height <= 0
            ) {

                continue;
            }


            if (
                hasExplicitScrollLabel(
                    button
                )
            ) {

                /*
                 * React 偶尔会同时保留新旧两个带明确标签的箭头。
                 * 真正当前使用的按钮通常最靠近视口底部；不要按 DOM
                 * 顺序直接返回第一个，否则可能选中上方的残留副本。
                 */
                const distanceToViewportBottom =
                    Math.abs(
                        window.innerHeight -
                        rect.bottom
                    );


                if (
                    distanceToViewportBottom <
                    explicitCandidateDistance
                ) {

                    explicitCandidate =
                        button;


                    explicitCandidateDistance =
                        distanceToViewportBottom;
                }
            }
        }


        if (explicitCandidate) {

            return explicitCandidate;
        }


        /*
         * composer form 只查找一次，
         * 供后续每个候选按钮做位置排除。
         */
        const composerForm =
            document.querySelector(
                'form[data-tm-chatgpt-composer="true"]'
            );


        let bestCandidate =
            null;


        let bestScore =
            -Infinity;


        /*
         * 第二层：没有任何明确标签时的
         * 几何启发式兜底。
         *
         * 仍然按照：
         *
         * - 尺寸接近小圆按钮
         * - 位于页面下半部分
         * - 包含 SVG
         * - 水平靠近正文中心
         * - 靠近浏览器底部
         * - 圆角较大
         *
         * 综合评分，选出最像的一个。
         */
        for (
            const button
            of buttons
        ) {

            if (
                !button.isConnected
            ) {
                continue;
            }


            /*
             * composer 里的原生控件
             * （+ 附件按钮 / 麦克风 / Instant / 发送按钮等）
             * 一律位于 form 内部，
             * 绝不能当成“跳到底部”按钮。
             */
            if (
                button.closest?.(
                    "form"
                )
            ) {

                continue;
            }


            /*
             * 带明确非滚动标签、或位于消息/代码块内部的按钮，
             * 不允许进入几何评分。否则窄窗口下代码块的
             * “自动换行 / 复制”按钮会被误当成底部箭头。
             */
            if (
                isProtectedNonScrollControl(
                    button
                )
            ) {

                continue;
            }


            const rect =
                button.getBoundingClientRect();


            /*
             * 排除没有尺寸的元素。
             */
            if (
                rect.width <= 0 ||
                rect.height <= 0
            ) {
                continue;
            }


            /*
             * ChatGPT 的按钮大致是圆形小按钮。
             */
            if (
                rect.width < 24 ||
                rect.width > 80 ||
                rect.height < 24 ||
                rect.height > 80
            ) {
                continue;
            }


            /*
             * 宽高应该比较接近。
             */
            if (
                Math.abs(
                    rect.width -
                    rect.height
                ) > 18
            ) {
                continue;
            }


            /*
             * 一般位于页面下半部分。
             */
            if (
                rect.top <
                window.innerHeight * 0.42
            ) {
                continue;
            }


            /*
             * 原生按钮通常包含 SVG。
             */
            const hasSvg =
                !!button.querySelector(
                    "svg"
                );


            /*
             * 水平上通常靠近 ChatGPT 正文的中心。
             */
            const centerX =
                rect.left +
                rect.width / 2;


            const horizontalDistance =
                Math.abs(
                    centerX -
                    window.innerWidth / 2
                );


            /*
             * 距离浏览器底部的距离。
             */
            const verticalDistance =
                Math.abs(
                    window.innerHeight -
                    rect.bottom
                );


            let score =
                0;


            if (hasSvg) {

                score += 30;
            }


            /*
             * 越接近水平中间越加分。
             */
            score -=
                horizontalDistance * 0.03;


            /*
             * 越靠近下方越加分。
             */
            score -=
                verticalDistance * 0.02;


            /*
             * 圆角很大的按钮更像目标。
             */
            const computed =
                getComputedStyle(
                    button
                );


            const radius =
                parseFloat(
                    computed.borderRadius
                ) || 0;


            if (
                radius >=
                Math.min(
                    rect.width,
                    rect.height
                ) * 0.35
            ) {

                score += 10;
            }


            /*
             * 有些版本 + 按钮位于 form 外的工具层里。
             *
             * 用与 composer form 的纵向位置重叠来排除：
             * 真正的“跳到底部”按钮悬在 composer 上方，
             * 它的中心不会落入 composer 的纵向范围内。
             *
             * 带 scroll / bottom 标签的按钮
             * 已经在第一层被直接返回，
             * 不会走到这里。
             */
            if (
                buttonOverlapsComposer(
                    button,
                    composerForm
                )
            ) {

                continue;
            }



            if (
                score >
                bestScore
            ) {

                bestScore =
                    score;


                bestCandidate =
                    button;
            }
        }


        return bestCandidate;
    }


    /*
     * 判断按钮的纵向中心是否落在 composer form 的纵向范围内。
     *
     * 用于排除 form 外工具层里的 + 附件按钮等控件。
     *
     * 只在真正的全量扫描时调用（低频），
     * 不在每帧热路径上调用。
     */
    function buttonOverlapsComposer(
        button,
        composerForm
    ) {

        if (
            !composerForm
            ||
            !document.documentElement.contains(
                composerForm
            )
        ) {

            return false;
        }


        const rect =
            button.getBoundingClientRect();


        const composerRect =
            composerForm.getBoundingClientRect();


        const centerY =
            (
                rect.top
                +
                rect.bottom
            )
            /
            2;


        return (
            centerY >=
                composerRect.top
            &&
            centerY <=
                composerRect.bottom
        );
    }


    /*
     * 判断一个按钮是不是 composer 里的原生控件。
     *
     * + 附件按钮 / 麦克风 / Instant / 发送按钮等
     * 都位于 ChatGPT 的 composer form 内部，
     * 绝不能把它们当成“跳到底部”按钮来隐藏。
     *
     * 这里只做零布局的 DOM 结构判断，
     * 在每帧热路径上不会触发 reflow。
     */
    function isComposerControl(
        button
    ) {

        if (
            !button
            ||
            !button.isConnected
        ) {

            return false;
        }


        return !!button.closest?.(
            "form"
        );
    }



    /* ---------------------------------------------------------
       disabled 模式辅助函数

       用户关闭底部箭头（BOTTOM_ARROW_ENABLED === false）时，
       这些函数负责：

       1. 用稳定的原生属性优先识别按钮
       2. 只检查 MutationObserver 新增的子树
       3. 找到后立即永久隐藏，不允许闪现
       --------------------------------------------------------- */

    /*
     * 收集按钮的可访问性文本：
     *
     * - aria-label
     * - title
     * - data-testid
     * - aria-describedby 指向的元素文本
     */
    function getButtonAccessibilityText(
        button
    ) {

        const parts =
            [];


        for (
            const attribute
            of [
                "aria-label",
                "title",
                "data-testid"
            ]
        ) {

            const value =
                button.getAttribute(
                    attribute
                );


            if (value) {

                parts.push(
                    value
                );
            }
        }


        const describedBy =
            button.getAttribute(
                "aria-describedby"
            );


        if (describedBy) {

            for (
                const id
                of describedBy.split(
                    /\s+/
                )
            ) {

                if (!id) {
                    continue;
                }


                const target =
                    document.getElementById(
                        id
                    );


                if (
                    target
                    &&
                    target.textContent
                ) {

                    parts.push(
                        target.textContent
                    );
                }
            }
        }


        return parts
            .join(" ")
            .toLowerCase();
    }


    /*
     * 是否带明确的“scroll to bottom”标签。
     *
     * 这是识别 ChatGPT 原生“跳到底部”按钮
     * 最可靠的特征，优先于一切几何猜测。
     */
    const SCROLL_LABEL_PATTERNS = [

        /* 英文 */
        /(^|[\s_-])scroll(?:[\s_-]+to)?[\s_-]+bottom([\s_-]|$)/,
        /(^|[\s_-])scroll(?:[\s_-]+to)?[\s_-]+top([\s_-]|$)/,

        /* 中文 */
        /滚动?到?(最)?底部/,
        /滚动?到?(最)?顶部/,

        /* 日文 */
        /一番下/,
        /最下部/,

        /* 韩文 */
        /맨\s*아래/,

        /* 法文 */
        /aller\s+(en|au)\s+bas/,
        /défiler.*(bas|fin)/,

        /* 德文 */
        /nach\s+unten/,
        /zum\s+(ende|schluss)/,

        /* 西班牙文 */
        /ir\s+al\s+(final|fondo)/,

        /* 葡萄牙文 */
        /(ir\s+para\s+o\s+fim|rolar\s+para\s+baixo)/,

        /* 俄文 */
        /(прокрутить\s+вниз|в\s+конец)/
    ];


    function hasExplicitScrollLabel(
        button
    ) {

        const text =
            getButtonAccessibilityText(
                button
            );


        return SCROLL_LABEL_PATTERNS.some(
            pattern => pattern.test(text)
        );
    }


    /*
     * 新版代码块的“自动换行 / 复制”按钮同样是：
     * - 小尺寸
     * - 接近圆形
     * - 内含 SVG
     * - 可能出现在页面下半部分
     *
     * 在窄窗口下，仅靠几何特征会误判。明确带有其它
     * 可访问性标签的按钮，以及消息正文 / 代码块内部的按钮，
     * 都不能进入几何兜底。
     *
     * 真正带有 Scroll to bottom 标签的按钮会在调用本函数前
     * 被 hasExplicitScrollLabel() 命中，因此不会被这里排除。
     */
    function isProtectedNonScrollControl(
        button
    ) {

        if (
            getButtonAccessibilityText(
                button
            )
        ) {

            return true;
        }


        return !!button.closest?.(
            [
                "[data-message-author-role]",
                '[data-markdown-text-style="assistant-message"]',
                '[data-user-message-bubble="true"]',
                "article",
                "pre",
                "code"
            ].join(",")
        );
    }


    /*
     * 没有任何明确标签时，
     * 用几何特征兜底判断一个按钮
     * 是否像 ChatGPT 原生“跳到底部”按钮。
     *
     * 注意：
     *
     * 这里的条件比 enabled 模式的评分更严格，
     * 因为 disabled 模式会永久隐藏按钮。
     *
     * 宁可漏掉一次（有 10 秒兜底自愈补上），
     * 也不能误杀其它 UI 控件。
     */
    function matchesScrollButtonGeometry(
        button,
        composerForm
    ) {

        const rect =
            button.getBoundingClientRect();


        /*
         * 必须有实际可见尺寸。
         */
        if (
            rect.width <= 0 ||
            rect.height <= 0
        ) {

            return false;
        }


        /*
         * 小尺寸接近方形的按钮。
         */
        if (
            rect.width < 24 ||
            rect.width > 80 ||
            rect.height < 24 ||
            rect.height > 80
        ) {

            return false;
        }


        if (
            Math.abs(
                rect.width -
                rect.height
            ) > 18
        ) {

            return false;
        }


        /*
         * 位于页面下半部分。
         */
        if (
            rect.top <
            window.innerHeight * 0.42
        ) {

            return false;
        }


        /*
         * 原生按钮内部包含 SVG 箭头。
         */
        if (
            !button.querySelector(
                "svg"
            )
        ) {

            return false;
        }


        /*
         * 圆角接近圆形。
         */
        const computed =
            getComputedStyle(
                button
            );


        const radius =
            parseFloat(
                computed.borderRadius
            ) || 0;


        if (
            radius <
            Math.min(
                rect.width,
                rect.height
            ) * 0.35
        ) {

            return false;
        }


        /*
         * 不能落在 composer 的纵向范围内
         * （保护 form 外工具层里的 + 按钮等）。
         */
        if (
            buttonOverlapsComposer(
                button,
                composerForm
            )
        ) {

            return false;
        }


        return true;
    }


    /*
     * disabled 模式下判断一个按钮
     * 是不是 ChatGPT 原生“跳到底部”按钮：
     *
     * 1. composer 内部控件永远排除
     * 2. 明确标签优先
     * 3. 几何特征兜底
     */
    function isScrollBottomButton(
        button,
        composerForm
    ) {

        if (
            !button
            ||
            !button.isConnected
        ) {

            return false;
        }


        /*
         * + 附件按钮 / 麦克风 / Instant / 发送按钮
         * 等 composer 内部控件绝不处理。
         */
        if (
            isComposerControl(
                button
            )
        ) {

            return false;
        }


        if (
            hasExplicitScrollLabel(
                button
            )
        ) {

            return true;
        }


        if (
            isProtectedNonScrollControl(
                button
            )
        ) {

            return false;
        }


        return matchesScrollButtonGeometry(
            button,
            composerForm
        );
    }


    function hideDuplicateScrollBottomButton(
        button
    ) {

        if (!button) {

            return;
        }


        button.setAttribute(
            "data-tm-scroll-bottom-button",
            "true"
        );


        button.setAttribute(
            "data-tm-scroll-bottom-duplicate",
            "true"
        );


        button.classList.remove(
            "tm-scroll-bottom-visible"
        );


        button.classList.add(
            "tm-scroll-bottom-hidden",
            "tm-scroll-bottom-duplicate"
        );
    }


    function reconcileScrollBottomButtons(
        activeButton
    ) {

        if (!activeButton) {

            return;
        }


        activeButton.removeAttribute(
            "data-tm-scroll-bottom-duplicate"
        );


        activeButton.classList.remove(
            "tm-scroll-bottom-duplicate"
        );


        const composerForm =
            document.querySelector(
                'form[data-tm-chatgpt-composer="true"]'
            );


        const buttons =
            document.querySelectorAll(
                "button"
            );


        for (
            const button
            of buttons
        ) {

            if (button === activeButton) {

                continue;
            }


            if (
                isScrollBottomButton(
                    button,
                    composerForm
                )
            ) {

                hideDuplicateScrollBottomButton(
                    button
                );
            }
        }
    }


    /*
     * 永久隐藏一个“跳到底部”按钮。
     *
     * CSS 里已有：
     *
     * .tm-scroll-bottom-disabled
     *
     * display: none !important
     *
     * 只要标记上就永远不显示。
     */
    function disableScrollBottomButton(
        button
    ) {

        if (!button) {

            return;
        }


        button.setAttribute(
            "data-tm-scroll-bottom-button",
            "true"
        );


        button.setAttribute(
            "data-tm-scroll-bottom-disabled",
            "true"
        );


        button.classList.add(
            "tm-scroll-bottom-disabled",
            "tm-scroll-bottom-hidden"
        );


        button.classList.remove(
            "tm-scroll-bottom-visible"
        );
    }


    /*
     * disabled 模式下扫描全页，
     * 把当前所有符合特征的按钮全部永久隐藏。
     *
     * 只在低频场景调用：
     *
     * - 脚本启动
     * - 初始化延迟结束
     * - 10 秒兜底自愈
     * - resize
     *
     * 不在 streaming 高频路径上调用。
     */
    function disableAllScrollBottomButtons() {

        if (BOTTOM_ARROW_ENABLED) {

            return;
        }


        const composerForm =
            document.querySelector(
                'form[data-tm-chatgpt-composer="true"]'
            );


        const buttons =
            document.querySelectorAll(
                "button"
            );


        for (
            const button
            of buttons
        ) {

            if (
                isScrollBottomButton(
                    button,
                    composerForm
                )
            ) {

                disableScrollBottomButton(
                    button
                );
            }
        }
    }


    /*
     * disabled 模式下处理 MutationObserver
     * 的 addedNodes：
     *
     * - 普通正文 streaming 只新增文本节点 → 零成本
     * - 真正新增 button → 只检查新增子树里的按钮
     * - 找到“跳到底部”按钮 → 同一批微任务内立即隐藏
     *
     * 不重新扫描整个 document。
     */
    function processAddedNodes(
        mutationRecords
    ) {

        for (
            const record
            of mutationRecords
        ) {

            const addedNodes =
                record.addedNodes;


            if (
                !addedNodes
                ||
                addedNodes.length === 0
            ) {

                continue;
            }


            for (
                const node
                of addedNodes
            ) {

                /*
                 * 只处理元素节点。
                 *
                 * 用 nodeType 而不是 instanceof Element：
                 * Tampermonkey 沙箱里跨 realm 的
                 * instanceof 判断可能失效，
                 * nodeType 对任意 Node 都可靠。
                 */
                if (
                    node.nodeType !== 1
                ) {

                    continue;
                }


                /*
                 * 新增节点本身是 button，
                 * 或者新增子树里包含 button，
                 * 才继续检查。
                 */
                const candidateButtons =
                    node.tagName === "BUTTON"
                        ? [node]
                        : node.querySelectorAll(
                            "button"
                        );


                if (
                    candidateButtons.length === 0
                ) {

                    continue;
                }


                /*
                 * composer form 只查找一次。
                 */
                const composerForm =
                    document.querySelector(
                        'form[data-tm-chatgpt-composer="true"]'
                    );


                for (
                    const button
                    of candidateButtons
                ) {

                    if (
                        isScrollBottomButton(
                            button,
                            composerForm
                        )
                    ) {

                        disableScrollBottomButton(
                            button
                        );
                    }
                }
            }
        }
    }


    /*
     * 清理被误标的按钮：
     *
     * 移除 data-tm-scroll-bottom-button 属性
     * 和 hidden / visible / disabled 类，
     * 让被误隐藏的原生按钮恢复原样。
     */
    function cleanupCurrentButton() {

        if (!currentButton) {
            return;
        }


        currentButton.style.removeProperty("--tm-scroll-arrow-lift");

        currentButton.removeAttribute(
            "data-tm-scroll-bottom-button"
        );


        currentButton.removeAttribute(
            "data-tm-scroll-bottom-disabled"
        );


        currentButton.removeAttribute(
            "data-tm-scroll-bottom-duplicate"
        );


        const originalScrollLabel =
            currentButton.getAttribute(
                "data-tm-original-scroll-label"
            );


        if (originalScrollLabel) {

            currentButton.setAttribute(
                "aria-label",
                originalScrollLabel
            );
        }


        currentButton.removeAttribute(
            "data-tm-original-scroll-label"
        );


        currentButton.removeAttribute(
            "data-tm-scroll-direction"
        );


        currentButton.classList.remove(
            "tm-scroll-bottom-hidden",
            "tm-scroll-bottom-visible",
            "tm-scroll-bottom-disabled",
            "tm-scroll-bottom-duplicate"
        );
    }



    /* =========================================================
       七、给箭头绑定悬停事件
       ========================================================= */


    function setButtonDirection(
        button,
        direction
    ) {

        if (!button) {

            return;
        }


        button.setAttribute(
            "data-tm-scroll-direction",
            direction
        );


        if (
            !button.hasAttribute(
                "data-tm-original-scroll-label"
            )
        ) {

            button.setAttribute(
                "data-tm-original-scroll-label",
                button.getAttribute(
                    "aria-label"
                ) || "Scroll to bottom"
            );
        }


        button.setAttribute(
            "aria-label",
            direction === "up"
                ? "Scroll to top"
                : button.getAttribute(
                    "data-tm-original-scroll-label"
                ) || "Scroll to bottom"
        );
    }


    function isAtDirectionalBoundary() {

        return lastScrollDirection < 0
            ? isAtTop()
            : isAtBottom();
    }


    /*
     * 箭头底边始终高于输入框触发区 32px，且与 Footer 顶部间隔 48px。
     * 加回上次位移以测量原生位置，避免多次刷新造成累计上移。
     */
    function positionScrollArrow(button) {
        if (!button || !BOTTOM_ARROW_ENABLED) return;

        const rect = button.getBoundingClientRect();
        if (rect.height <= 0) return;

        const previousLift = parseFloat(
            getComputedStyle(button).getPropertyValue("--tm-scroll-arrow-lift") || "48"
        );
        const nativeBottom = rect.bottom + previousLift;
        const footer = button.closest('[data-thread-scroll-footer="true"], #thread-bottom-container, #thread-bottom');
        const footerTop = footer
            ? footer.getBoundingClientRect().top
            : window.innerHeight;
        const safeBottom = Math.min(
            window.innerHeight - USER_CONFIG.composerTriggerHeight - 32,
            footerTop - 48
        );
        const lift = Math.max(0, nativeBottom - safeBottom);
        if (Math.abs(lift - previousLift) > 0.5) {
            button.style.setProperty("--tm-scroll-arrow-lift", `${lift}px`);
        }
    }


    function bindButtonHoverEvents(
        button
    ) {

        /*
         * 防止重复绑定。
         */
        if (
            button.dataset
                .tmScrollBottomHoverBound
            ===
            "true"
        ) {

            return;
        }


        button.dataset
            .tmScrollBottomHoverBound =
            "true";



        /* -----------------------------------------------------
           鼠标进入箭头
           -----------------------------------------------------

           重新给用户一个完整的点击时间窗口，
           但鼠标静止后仍然自动隐藏。
           ----------------------------------------------------- */

        button.addEventListener(
            "mouseenter",
            () => {

                /*
                 * 只要没到底部就显示，并重新开始一次倒计时。
                 */
                if (
                    lastScrollDirection !== 0
                    &&
                    !isAtDirectionalBoundary()
                ) {

                    showButton();


                    scheduleHide();
                }
            }
        );



        /* -----------------------------------------------------
           鼠标离开箭头
           -----------------------------------------------------

           从此时重新开始自动隐藏倒计时。
           ----------------------------------------------------- */

        button.addEventListener(
            "mouseleave",
            () => {

                /*
                 * 已经到底就马上隐藏。
                 */
                if (isAtBottom()) {

                    hideButton();

                    return;
                }


                /*
                 * 否则重新开始计时。
                 */
                scheduleHide();
            }
        );


    }



    /* =========================================================
       八、识别并标记按钮
       ========================================================= */


    function setupButton(
        forceRescan = false
    ) {

        /*
         * streaming / 滚动期间 setupButton 会被高频调用
         * （observer 每帧、scroll 事件、showButton / hideButton）。
         *
         * 当前按钮节点仍然连着 DOM（React 没有替换它），
         * 并且不是 composer 内部控件时，
         * 直接复用，绝不重新执行 findScrollBottomButton()
         * 的全页按钮扫描。
         *
         * resize / 兜底自愈等明确需要重新核对时，
         * 传入 forceRescan = true。
         */
        if (
            !forceRescan
            &&
            currentButton
            &&
            currentButton.isConnected
            &&
            !isComposerControl(
                currentButton
            )
        ) {

            return currentButton;
        }


        /*
         * 缓存命中的却是 composer 内部控件
         * （例如 + 附件按钮被误当成“跳到底部”按钮）：
         *
         * 立即清理标记和隐藏类，恢复按钮原样，
         * 然后重新扫描。
         */
        if (
            currentButton
            &&
            isComposerControl(
                currentButton
            )
        ) {

            cleanupCurrentButton();


            currentButton =
                null;
        }


        const button =
            findScrollBottomButton();


        /*
         * 没有找到真正的“跳到底部”按钮：
         * 误标的按钮已经清理完毕，直接返回 null。
         */
        if (!button) {

            if (currentButton) {

                cleanupCurrentButton();


                currentButton =
                    null;
            }


            return null;
        }



        /*
         * ChatGPT 可能因为 React 更新重新创建按钮。
         */
        if (
            button !==
            currentButton
        ) {

            if (currentButton) {
                cleanupCurrentButton();
            }

            currentButton =
                button;


            currentButton.setAttribute(
                "data-tm-scroll-bottom-button",
                "true"
            );


            if (!BOTTOM_ARROW_ENABLED) {

                disableScrollBottomButton(
                    currentButton
                );


                return currentButton;
            }


            /*
             * 新按钮重新绑定悬停事件。
             */
            bindButtonHoverEvents(
                currentButton
            );


            /*
             * React 可能在滚动过程中才创建按钮。
             * 新按钮只继承最近一次滚动方向的显示意图，
             * 其他情况一律先隐藏，避免原生默认样式闪现。
             */
            if (
                lastScrollDirection !== 0
                &&
                !isAtDirectionalBoundary()
            ) {

                setButtonDirection(
                    currentButton,
                    lastScrollDirection < 0
                        ? "up"
                        : "down"
                );

                currentButton.classList.remove(
                    "tm-scroll-bottom-hidden"
                );


                currentButton.classList.add(
                    "tm-scroll-bottom-visible"
                );
            }

            else {

                currentButton.classList.remove(
                    "tm-scroll-bottom-visible"
                );


                currentButton.classList.add(
                    "tm-scroll-bottom-hidden"
                );
            }
        }


        positionScrollArrow(currentButton);

        reconcileScrollBottomButtons(
            currentButton
        );


        if (!BOTTOM_ARROW_ENABLED) {

            disableScrollBottomButton(
                button
            );
        }


        return currentButton;
    }


    /*
     * 按钮还没出现（或刚被 React 替换）时的
     * 兜底重试间隔。
     *
     * 单位：毫秒。
     */
    const BUTTON_RESCAN_INTERVAL = 250;


    let lastButtonScanAt = null;


    /*
     * 带缓存 + 节流的按钮获取：
     *
     * observer 每一帧都会触发。
     *
     * 按钮节点还在时直接复用；
     * 按钮还没找到时，
     * 兜底重试最多每 250ms 扫描一次，
     * 避免输入 / streaming 期间
     * 高频执行全页按钮扫描。
     */
    function getCurrentButton() {

        if (
            currentButton
            &&
            currentButton.isConnected
            &&
            !isComposerControl(
                currentButton
            )
        ) {

            return currentButton;
        }


        /*
         * 缓存的是 composer 内部控件（+ 被误选）：
         * 立即清理，让被误隐藏的按钮恢复原样。
         */
        if (
            currentButton
            &&
            isComposerControl(
                currentButton
            )
        ) {

            cleanupCurrentButton();


            currentButton =
                null;
        }


        const now =
            Date.now();


        if (
            lastButtonScanAt !== null
            &&
            now - lastButtonScanAt <
                BUTTON_RESCAN_INTERVAL
        ) {

            return currentButton;
        }


        lastButtonScanAt =
            now;


        return setupButton();
    }



    /* =========================================================
       九、取消自动隐藏计时
       ========================================================= */


    function cancelHideTimer() {

        if (hideTimer) {

            clearTimeout(
                hideTimer
            );


            hideTimer =
                null;
        }
    }



    /* =========================================================
       十、显示箭头
       ========================================================= */


    function showButton() {

        /*
         * 用户关闭底部箭头：
         *
         * 无论谁调用 showButton 都绝不显示。
         *
         * disabled 模式下的隐藏由
         * processAddedNodes /
         * disableAllScrollBottomButtons 负责，
         * 这里不做任何事。
         */
        if (!BOTTOM_ARROW_ENABLED) {

            return;
        }


        if (
            lastScrollDirection === 0
            ||
            isAtDirectionalBoundary()
        ) {

            hideButton();

            return;
        }


        /*
         * 通过 getCurrentButton() 获取，
         * 复用它的缓存与 250ms 节流，
         * 避免滚轮/触控板高频触发全页按钮扫描。
         */
        const button =
            getCurrentButton();


        if (!button) {

            return;
        }


        positionScrollArrow(button);

        setButtonDirection(
            button,
            lastScrollDirection < 0
                ? "up"
                : "down"
        );


        button.classList.remove(
            "tm-scroll-bottom-hidden"
        );


        button.classList.add(
            "tm-scroll-bottom-visible"
        );
    }



    /* =========================================================
       十一、隐藏箭头
       ========================================================= */


    function hideButton() {


        const button =
            getCurrentButton();


        if (!button) {

            return;
        }


        button.classList.remove(
            "tm-scroll-bottom-visible"
        );


        button.classList.add(
            "tm-scroll-bottom-hidden"
        );
    }



    /* =========================================================
       十二、安排自动隐藏
       ========================================================= */


    function scheduleHide() {

        /*
         * 用户关闭底部箭头：
         * 不需要任何自动隐藏计时。
         */
        if (!BOTTOM_ARROW_ENABLED) {

            return;
        }


        cancelHideTimer();


        hideTimer =
            setTimeout(
                () => {

                    hideTimer =
                        null;


                    lastScrollDirection =
                        0;


                    hideButton();

                },
                HIDE_DELAY
            );
    }



    /* =========================================================
       十三、处理向下滚动
       ========================================================= */


    function handleDownwardScroll() {

        /*
         * 用户关闭底部箭头：
         * 任何滚动都不应该触发 show 行为。
         */
        if (!BOTTOM_ARROW_ENABLED) {

            return;
        }


        lastScrollDirection =
            1;


        /*
         * 到底部：
         *
         * 箭头始终隐藏。
         */
        if (isAtBottom()) {

            lastScrollDirection =
                0;


            cancelHideTimer();


            hideButton();


            return;
        }


        /*
         * 只有向下滚动时，箭头才出现。
         */
        showButton();


        /*
         * 每次向下滚动都重新开始隐藏倒计时。
         */
        scheduleHide();
    }


    function handleUpwardScroll() {

        if (!BOTTOM_ARROW_ENABLED) {

            return;
        }


        lastScrollDirection =
            -1;


        if (isAtTop()) {

            lastScrollDirection =
                0;


            cancelHideTimer();


            hideButton();


            return;
        }


        showButton();


        scheduleHide();
    }


    function handleMouseActivity() {
        if (!BOTTOM_ARROW_ENABLED) {
            return;
        }

        /*
         * 鼠标移动只能延长一个已经显示的箭头，
         * 不能自行把箭头唤出。这样向上滚动隐藏后，
         * 移动鼠标也不会让它重新出现。
         */
        if (
            !currentButton
            ||
            !currentButton.classList.contains(
                "tm-scroll-bottom-visible"
            )
        ) {

            return;
        }

        const now = Date.now();
        const elapsed = now - lastMouseActivityAt;

        if (elapsed >= MOUSE_ACTIVITY_INTERVAL) {
            lastMouseActivityAt = now;
            scheduleHide();
            return;
        }

        if (mouseActivityTimer !== null) {
            return;
        }

        mouseActivityTimer = setTimeout(
            () => {
                mouseActivityTimer = null;
                lastMouseActivityAt = Date.now();
                scheduleHide();
            },
            MOUSE_ACTIVITY_INTERVAL - elapsed
        );
    }



    /* =========================================================
       十四、滚动事件
       ========================================================= */


    function handleScroll() {

        /*
         * 用户关闭底部箭头：
         * 不需要处理任何滚动显示逻辑。
         */
        if (!BOTTOM_ARROW_ENABLED) {

            return;
        }


        const distanceToBottom =
            getDistanceToBottom();


        if (distanceToBottom === null) {

            return;
        }


        const previousDistance =
            lastDistanceToBottom;


        lastDistanceToBottom =
            distanceToBottom;


        /* 滚到底部：立刻隐藏。 */
        if (
            distanceToBottom <=
                BOTTOM_THRESHOLD
        ) {

            lastScrollDirection =
                0;


            cancelHideTimer();


            hideButton();


            return;
        }


        /* 向上远离页底：显示向上箭头。 */
        if (
            previousDistance !== null
            &&
            distanceToBottom >
                previousDistance + 0.5
        ) {

            handleUpwardScroll();


            return;
        }


        /*
         * 距离页底变小，说明用户正在向下翻。
         */
        if (
            previousDistance !== null
            &&
            distanceToBottom <
                previousDistance - 0.5
        ) {

            handleDownwardScroll();
        }
    }

    function isEventInChatScroller(target) {
        if (!(target instanceof Element)) return true;

        const scroller = getScrollContainer();
        if (!scroller) return false;

        if (scroller === document.scrollingElement) {
            const main = document.querySelector("main");
            return !main || main.contains(target);
        }

        return scroller === target || scroller.contains(target);
    }



    /* =========================================================
       十五、监听 ChatGPT 正文滚动
       ========================================================= */


    document.addEventListener(
        "scroll",
        event => {

            /*
             * 用户关闭底部箭头：
             * 连滚动容器都不用找，
             * 直接跳过所有显示逻辑。
             */
            if (!BOTTOM_ARROW_ENABLED) {

                return;
            }


            const scroller =
                getScrollContainer();


            if (!scroller) {

                return;
            }


            /*
             * 如果真正正文滚动的是内部 div，
             * 只处理那个 div 的 scroll。
             */
            if (
                scroller !==
                    document.scrollingElement
                &&
                event.target !==
                    scroller
            ) {

                return;
            }


            handleScroll();
        },
        {
            passive: true,
            capture: true
        }
    );



    /* =========================================================
       十六、监听触控板 / 鼠标滚轮
       ========================================================= */


    document.addEventListener(
        "wheel",
        event => {

            if (!BOTTOM_ARROW_ENABLED) {

                return;
            }

            if (event.deltaY === 0) {

                return;
            }

            if (!isEventInChatScroller(event.target)) return;


            /*
             * 向上滚动显示向上箭头，向下滚动显示向下箭头。
             * scroll 事件随后还会用实际“距页底”变化复核方向。
             */
            if (event.deltaY < 0) {

                handleUpwardScroll();


                return;
            }


            handleDownwardScroll();
        },
        {
            passive: true
        }
    );



    /* =========================================================
       十七、监听鼠标移动
       =========================================================

       鼠标移动只延长已经显示的箭头倒计时，
       不会在没有滚动时自行唤出箭头。
       ========================================================= */


    onSharedMouseMove(
        event => {

            /*
             * 禁用态不读取坐标，也不创建鼠标活动定时器。
             */
            if (!BOTTOM_ARROW_ENABLED) {

                return;
            }

            /*
             * 第一次获取坐标。
             */
            if (
                lastMouseX === null ||
                lastMouseY === null
            ) {

                lastMouseX =
                    event.clientX;


                lastMouseY =
                    event.clientY;


                handleMouseActivity();


                return;
            }


            const deltaX =
                Math.abs(
                    event.clientX -
                    lastMouseX
                );


            const deltaY =
                Math.abs(
                    event.clientY -
                    lastMouseY
                );


            lastMouseX =
                event.clientX;


            lastMouseY =
                event.clientY;


            /*
             * 很小的鼠标抖动不算真正活动。
             */
            if (
                deltaX <
                    MOUSE_MOVE_THRESHOLD
                &&
                deltaY <
                    MOUSE_MOVE_THRESHOLD
            ) {

                return;
            }


            handleMouseActivity();
        }
    );



    /* =========================================================
       十八、鼠标离开浏览器
       ========================================================= */


    document.addEventListener(
        "mouseleave",
        () => {

            if (!BOTTOM_ARROW_ENABLED) {

                return;
            }

            lastMouseX =
                null;


            lastMouseY =
                null;


            /*
             * 鼠标离开网页以后，
             * 正常开始隐藏倒计时。
             */
            scheduleHide();
        }
    );



    /* =========================================================
       十九、监听键盘滚动
       =========================================================

       顺便兼容：

       PageUp
       PageDown
       Home
       End
       ↑
       ↓
       Space
       ========================================================= */


    document.addEventListener(
        "keydown",
        event => {

            if (!BOTTOM_ARROW_ENABLED) {

                return;
            }

            /*
             * 用户正在输入文字时不要处理。
             */
            const target =
                event.target;


            if (
                target?.tagName ===
                    "INPUT"
                ||
                target?.tagName ===
                    "TEXTAREA"
                ||
                target?.isContentEditable
            ) {

                return;
            }

            if (
                target instanceof Element
                && target !== document.body
                && target !== document.documentElement
                && !isEventInChatScroller(target)
            ) {
                return;
            }


            const scrollsUp =
                UPWARD_SCROLL_KEYS.has(
                    event.key
                )
                ||
                (
                    event.key === " "
                    &&
                    event.shiftKey
                );


            if (scrollsUp) {

                handleUpwardScroll();


                return;
            }


            if (
                DOWNWARD_SCROLL_KEYS.has(
                    event.key
                )
            ) {

                handleDownwardScroll();
            }
        },
        {
            passive: true
        }
    );



    /* =========================================================
       二十、监听 ChatGPT DOM 动态变化
       ========================================================= */


    onSharedMutation(
        mutationRecords => {

            /*
             * 用户关闭底部箭头：
             *
             * 不走 rAF 节流，
             * 直接在同一批微任务里
             * 处理新增子树中的按钮并立即隐藏，
             * 避免出现
             * “先显示 0.5～2.5 秒再消失”的闪现。
             */
            if (!BOTTOM_ARROW_ENABLED) {

                processAddedNodes(
                    mutationRecords
                );


                return;
            }


            if (
                observerScheduled
            ) {

                return;
            }


            observerScheduled =
                true;


            requestAnimationFrame(
                () => {

                    observerScheduled =
                        false;


                    /*
                     * ChatGPT 可能重新创建滚动容器 /
                     * 跳到底部按钮。
                     *
                     * 只有缓存节点断开（被 React 替换）
                     * 时才真正重新查找，
                     * streaming 期间不重复全页扫描。
                     */
                    getScrollContainer();


                    const addedButton =
                        mutationRecords.some(
                            record =>
                                Array.from(
                                    record.addedNodes || []
                                ).some(
                                    node =>
                                        node.nodeType === 1
                                        &&
                                        (
                                            node.matches?.(
                                                "button, [role='button']"
                                            )
                                            ||
                                            node.querySelector?.(
                                                "button, [role='button']"
                                            )
                                        )
                                )
                        );


                    if (addedButton) {

                        setupButton(
                            true
                        );
                    }


                    else {

                        getCurrentButton();
                    }


                    /*
                     * 到底就确保隐藏。
                     */
                    if (isAtBottom()) {

                        lastScrollDirection =
                            0;


                        cancelHideTimer();


                        hideButton();
                    }
                }
            );
        }
    );


    /*
     * SPA 切换后即使旧滚动节点仍连接在 DOM 中，也重新确认当前会话的
     * 滚动容器和箭头，避免继续使用上一条对话留下的缓存。
     */
    onSharedRouteChange(
        () => {

            currentScroller =
                null;


            currentScrollerIsFallback =
                false;


            currentScrollerUsesReverseFlow =
                false;


            lastDistanceToBottom =
                null;


            lastScrollDirection =
                0;


            requestAnimationFrame(
                () => {

                    findScrollContainer();


                    setupButton(
                        true
                    );


                    syncScrollDirectionBaseline();


                    hideButton();
                }
            );
        }
    );


    /*
     * 用户关闭底部箭头：
     *
     * 脚本启动时立即扫描一次页面中
     * 已经存在的“跳到底部”按钮并全部隐藏，
     * 覆盖“直接打开已有长对话”的场景。
     *
     * 之后新增的按钮交给 MutationObserver
     * 的 addedNodes 即时处理。
     */
    if (!BOTTOM_ARROW_ENABLED) {

        disableAllScrollBottomButtons();
    }



    /* =========================================================
       二十-B、兜底自愈
       =========================================================

       isConnected 缓存能覆盖 React 替换按钮的绝大多数情况，
       但极端情况下旧节点仍连着 DOM，而真正的按钮已经变化
       （例如按钮重新挂载、候选评分随布局变化）。

       这里每 10 秒重新核对一次标记，保证最终一致，
       同时避免 streaming 期间逐帧执行全页按钮扫描。
       ========================================================= */

    const BUTTON_SELF_HEAL_INTERVAL = 10000;


    setInterval(
        () => {

            /*
             * 用户关闭底部箭头：
             *
             * 兜底自愈改为全页核对一遍，
             * 把所有漏网的“跳到底部”按钮全部隐藏，
             * 覆盖：
             *
             * - 属性更新但没有新增节点的按钮
             * - SPA 切换 conversation 后重新挂载的按钮
             */
            if (!BOTTOM_ARROW_ENABLED) {
                if (document.hidden) {
                    return;
                }

                disableAllScrollBottomButtons();


                return;
            }


            if (!document.hidden) {
                setupButton(
                    true
                );
            }
        },
        BUTTON_SELF_HEAL_INTERVAL
    );



    /* =========================================================
       二十一、窗口大小变化
       ========================================================= */


    window.addEventListener(
        "resize",
        () => {

            /*
             * 用户关闭底部箭头：
             *
             * resize / SPA 布局变化后
             * 重新核对一遍所有按钮并隐藏。
             */
            if (!BOTTOM_ARROW_ENABLED) {

                disableAllScrollBottomButtons();


                return;
            }


            findScrollContainer();


            setupButton(
                true
            );


            syncScrollDirectionBaseline();


            if (isAtBottom()) {

                lastScrollDirection =
                    0;


                cancelHideTimer();


                hideButton();
            }

        },
        {
            passive: true
        }
    );



    /* =========================================================
       二十二、首次初始化
       ========================================================= */


    setTimeout(
        () => {

            /*
             * 用户关闭底部箭头：
             *
             * 初始化延迟结束后再扫描一遍，
             * 覆盖延迟期间出现的按钮。
             *
             * 其余 enabled 模式的初始化逻辑
             * （滚动容器 / 悬停事件 / 自动隐藏计时）
             * 完全不需要运行。
             */
            if (!BOTTOM_ARROW_ENABLED) {

                disableAllScrollBottomButtons();


                return;
            }


            findScrollContainer();


            setupButton();


            syncScrollDirectionBaseline();


            /*
             * 页面刚打开时，
             * 如果用户没有进行操作，
             * 箭头默认隐藏。
             */
            cancelHideTimer();


            hideButton();

        },
        INITIAL_DELAY
    );

})();

    /* ==================== 模块 3：右上角按钮透明悬停显示 ==================== */

(function () {
    "use strict";

    const OLD_MIRROR_ID = "tm-chatgpt-left-top-action-mirrors";
    const ACTION_ATTR = "data-tm-chatgpt-top-action";
    const HIDDEN_ATTR = "data-tm-chatgpt-hidden-top-action";
    const FRAME_ATTR = "data-tm-chatgpt-hidden-top-action-frame";
    const TOP_ACTION_MUTATION_SELECTOR = [
        `[${HIDDEN_ATTR}='true']`,
        `[${FRAME_ATTR}='true']`
    ].join(",");
    const TOP_ACTION_BUTTON_SELECTOR = "button, [role='button']";

    const SCAN_DELAY = 700;
    const SELF_HEAL_INTERVAL = 10000;
    let scanTimer = null;
    let scanPending = false;
    let currentShareButton = null;
    let currentMoreButton = null;
    let currentTopActionFrame = null;

    removeOldMirrorButtons();

    if (!USER_CONFIG.topRightActionsHoverReveal) {
        cleanupTopActionHoverReveal();
        return;
    }

    injectTopActionHoverRevealStyle();

    onSharedMutation(mutationRecords => {
        /*
         * 已经有一个待执行的扫描时，
         * 不再遍历这一批 mutation 的子树，
         * 把每个 700ms 窗口内的子树扫描限制为一次。
         */
        if (shouldScanTopActions(mutationRecords)) {
            if (scanTimer !== null) {
                scanPending = true;
                return;
            }

            scheduleScan();
        }
    });

    window.addEventListener("resize", scheduleScan, { passive: true });
    window.addEventListener("popstate", scheduleScan, { passive: true });

    scheduleScan();
    setTimeout(markOriginalButtons, SCAN_DELAY * 2);

    /*
     * 新对话开启是 SPA 内部跳转，不刷新页面。
     *
     * React 重渲染后，之前标记过的按钮/容器会被替换成新节点，
     * 这里跟随路径变化立即补扫几次，
     * 让新对话刚出来时右上角按钮就进入透明状态。
     */
    onSharedRouteChange(() => {
        markOriginalButtons();
        setTimeout(markOriginalButtons, SCAN_DELAY);
        setTimeout(markOriginalButtons, SCAN_DELAY * 2);
    });

    /*
     * 兜底自愈：
     *
     * MutationObserver 存在漏网的情况（例如旧标记节点还留在 DOM 里、
     * 新按钮没有被标记），这里定期重新核对一次标记，保证最终一致。
     */
    setInterval(() => {
        if (document.hidden) return;
        markOriginalButtons();
    }, SELF_HEAL_INTERVAL);

    function removeOldMirrorButtons() {
        document.getElementById(OLD_MIRROR_ID)?.remove();
        document.querySelector("[data-tm-chatgpt-top-action-mirror-css]")?.remove();
    }

    function cleanupTopActionHoverReveal() {
        document.querySelector("[data-tm-chatgpt-top-action-hover-css]")?.remove();

        document
            .querySelectorAll("[data-tm-chatgpt-hidden-top-action='true']")
            .forEach(element => {
                element.removeAttribute("data-tm-chatgpt-top-action");
                element.removeAttribute("data-tm-chatgpt-hidden-top-action");
            });

        document
            .querySelectorAll("[data-tm-chatgpt-hidden-top-action-frame='true']")
            .forEach(element => {
                element.removeAttribute("data-tm-chatgpt-hidden-top-action-frame");
            });
    }

    function injectTopActionHoverRevealStyle() {
        if (document.querySelector("[data-tm-chatgpt-top-action-hover-css]")) return;

        const style = document.createElement("style");
        style.setAttribute("data-tm-chatgpt-top-action-hover-css", "true");
        style.textContent = `
            [data-tm-chatgpt-hidden-top-action="true"] {
                opacity: 0 !important;
                transition: opacity 120ms ease !important;
            }

            [data-tm-chatgpt-hidden-top-action-frame="true"] {
                opacity: 0 !important;
                visibility: visible !important;
                pointer-events: auto !important;
                background: var(--main-surface-primary, var(--surface-primary, rgba(32, 33, 35, 0.96))) !important;
                background-color: var(--main-surface-primary, var(--surface-primary, rgba(32, 33, 35, 0.96))) !important;
                box-shadow: 0 10px 32px rgba(0, 0, 0, 0.45) !important;
                border-color: transparent !important;
                transition: opacity 120ms ease !important;
            }

            [data-tm-chatgpt-hidden-top-action-frame="true"]:hover,
            [data-tm-chatgpt-hidden-top-action-frame="true"]:focus-within {
                opacity: 1 !important;
                background: var(--main-surface-primary, var(--surface-primary, rgba(32, 33, 35, 0.96))) !important;
                background-color: var(--main-surface-primary, var(--surface-primary, rgba(32, 33, 35, 0.96))) !important;
            }

            [data-tm-chatgpt-hidden-top-action-frame="true"]:hover [data-tm-chatgpt-hidden-top-action="true"],
            [data-tm-chatgpt-hidden-top-action-frame="true"]:focus-within [data-tm-chatgpt-hidden-top-action="true"] {
                opacity: 1 !important;
            }

            /*
             * frame 探测失败时的兜底：
             * 即使没有找到公共父容器，
             * 鼠标移到按钮上也能重新显示，
             * 避免按钮变成“看不见却仍可点击”的幽灵控件。
             */
            [data-tm-chatgpt-hidden-top-action="true"]:hover,
            [data-tm-chatgpt-hidden-top-action="true"]:focus-visible {
                opacity: 1 !important;
            }
        `;
        document.documentElement.appendChild(style);
    }

    function scheduleScan() {
        if (scanTimer !== null) return;
        scanTimer = setTimeout(() => {
            scanTimer = null;
            markOriginalButtons();

            if (scanPending) {
                scanPending = false;
                scheduleScan();
            }
        }, SCAN_DELAY);
    }

    function shouldScanTopActions(mutationRecords) {
        for (const record of mutationRecords) {
            if (
                record.type === "attributes"
                && record.target?.matches?.(TOP_ACTION_BUTTON_SELECTOR)
                && isInConversationTopRight(record.target)
            ) {
                return true;
            }

            if (
                record.target?.nodeType === Node.ELEMENT_NODE &&
                record.target.closest?.(TOP_ACTION_MUTATION_SELECTOR)
            ) {
                return true;
            }

            if (
                nodesContainTopAction(record.addedNodes) ||
                nodesContainTopAction(record.removedNodes)
            ) {
                return true;
            }
        }

        return false;
    }

    function nodesContainTopAction(nodes) {
        for (const node of nodes) {
            if (node.nodeType !== Node.ELEMENT_NODE) continue;

            if (node.matches?.(TOP_ACTION_MUTATION_SELECTOR)) return true;

            const buttons = node.matches?.(TOP_ACTION_BUTTON_SELECTOR)
                ? [node]
                : Array.from(node.querySelectorAll?.(TOP_ACTION_BUTTON_SELECTOR) || []);

            if (buttons.some(isInConversationTopRight)) return true;
        }

        return false;
    }

    function markOriginalButtons() {
        clearStaleMarks();

        const shareButton = getLiveMarkedButton("share") || findTopActionButton("share");
        const moreButton = getLiveMarkedButton("more") || findTopActionButton("more");

        markButton(shareButton, "share");
        markButton(moreButton, "more");
        markTopActionFrame(shareButton, moreButton);
    }

    function markButton(button, type) {
        if (!button) return;
        const newlyMarked = !button.hasAttribute(HIDDEN_ATTR);
        button.setAttribute(ACTION_ATTR, type);
        button.setAttribute(HIDDEN_ATTR, "true");

        if (type === "share") {
            currentShareButton = button;
        }

        else if (type === "more") {
            currentMoreButton = button;
        }

        if (newlyMarked) {
            console.log(`[ChatGPT Custom UI] 右上角按钮已透明化：${type}`);
        }
    }

    /*
     * 只在“仍然可见、仍在右上角”的情况下才复用之前的标记，
     * 否则返回 null，让 findTopActionButton 去搜当前真正的按钮。
     */
    function getLiveMarkedButton(type) {
        const cachedButton =
            type === "share"
                ? currentShareButton
                : currentMoreButton;

        if (
            cachedButton &&
            document.documentElement.contains(cachedButton) &&
            isLiveButtonMark(cachedButton)
        ) {
            return cachedButton;
        }

        const button = document.querySelector(`[${ACTION_ATTR}="${type}"]`);
        if (!button || !document.documentElement.contains(button)) return null;
        if (!isLiveButtonMark(button)) return null;

        if (type === "share") {
            currentShareButton = button;
        }

        else if (type === "more") {
            currentMoreButton = button;
        }

        return button;
    }

    /*
     * 清理失效的旧标记。
     *
     * 之前标记过的按钮被 React 替换后，
     * 旧节点（通常已隐藏或已不属于当前对话）可能还留在 DOM 里，
     * 会挡住对当前真正按钮的搜索。
     */
    function clearStaleMarks() {
        document
            .querySelectorAll(`[${HIDDEN_ATTR}="true"]`)
            .forEach(element => {
                if (isLiveButtonMark(element)) return;
                if (element === currentShareButton) currentShareButton = null;
                if (element === currentMoreButton) currentMoreButton = null;
                element.removeAttribute(ACTION_ATTR);
                element.removeAttribute(HIDDEN_ATTR);
            });

        document
            .querySelectorAll(`[${FRAME_ATTR}="true"]`)
            .forEach(element => {
                if (isLiveFrameMark(element)) return;
                if (element === currentTopActionFrame) currentTopActionFrame = null;
                element.removeAttribute(FRAME_ATTR);
            });
    }

    function isLiveButtonMark(element) {
        return (
            isVisibleButton(element) &&
            isInConversationTopRight(element)
        );
    }

    function isLiveFrameMark(element) {
        const rect = element.getBoundingClientRect();
        const topThreshold = Math.min(160, Math.max(70, window.innerHeight * 0.15));
        const rightThreshold = Math.min(540, Math.max(220, window.innerWidth * 0.16));

        return (
            rect.top >= 0 &&
            rect.top < topThreshold &&
            rect.right > window.innerWidth - rightThreshold &&
            element.querySelector(`[${HIDDEN_ATTR}="true"]`) !== null
        );
    }

    function findTopActionButton(type) {
        const buttons = Array
            .from(document.querySelectorAll("button, [role='button']"))
            .filter(isInConversationTopRight)
            .filter(isVisibleButton);

        if (type === "share") {
            return buttons.find(isShareButton) || null;
        }

        const moreByLabel = buttons.find(isMoreButton);
        if (moreByLabel) return moreByLabel;

        return null;
    }

    function isVisibleButton(button) {
        const rect = button.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return false;

        const style = window.getComputedStyle(button);
        return style.display !== "none" && style.visibility !== "hidden";
    }

    function markTopActionFrame(...buttons) {
        const validButtons = buttons.filter(Boolean);
        if (validButtons.length === 0) return;

        if (
            currentTopActionFrame &&
            isLiveFrameMark(currentTopActionFrame) &&
            validButtons.every(button => currentTopActionFrame.contains(button))
        ) {
            return;
        }

        const frame = findSharedTopRightFrame(validButtons);
        if (!frame) return;

        /*
         * 迁移到新 frame 之前，先摘掉旧 frame 的标记，
         * 避免旧节点残留黑色悬停块。
         */
        if (
            currentTopActionFrame &&
            currentTopActionFrame !== frame
        ) {
            currentTopActionFrame.removeAttribute(FRAME_ATTR);
        }

        frame.setAttribute(FRAME_ATTR, "true");
        currentTopActionFrame = frame;
    }

    function findSharedTopRightFrame(buttons) {
        const ancestors = [];
        let current = buttons[0].parentElement;
        const topThreshold = Math.min(160, Math.max(70, window.innerHeight * 0.15));
        const rightThreshold = Math.min(540, Math.max(220, window.innerWidth * 0.16));

        while (current && current !== document.body) {
            const rect = current.getBoundingClientRect();
            if (rect.top >= 0 && rect.top < topThreshold && rect.right > window.innerWidth - rightThreshold) {
                ancestors.push(current);
            }
            current = current.parentElement;
        }

        return ancestors.find(element => {
            const rect = element.getBoundingClientRect();
            const hasEveryButton = buttons.every(button => element.contains(button));
            return hasEveryButton && rect.width <= 360 && rect.height <= 90;
        }) || null;
    }

    function isInConversationTopRight(button) {
        const rect = button.getBoundingClientRect();
        const topThreshold = Math.min(150, Math.max(60, window.innerHeight * 0.13));
        const rightThreshold = Math.min(500, Math.max(200, window.innerWidth * 0.15));

        return (
            rect.top >= 0 &&
            rect.top < topThreshold &&
            rect.right > window.innerWidth - rightThreshold &&
            rect.left < window.innerWidth
        );
    }

    function getButtonLabels(button) {
        return [
            button.innerText,
            button.getAttribute("aria-label"),
            button.getAttribute("title"),
            button.getAttribute("data-testid")
        ]
            .filter(Boolean)
            .map(value => normalizeText(value));
    }

    function isShareButton(button) {
        const labels = getButtonLabels(button);
        return labels.some(label => [
            "share",
            "share conversation",
            "分享",
            "分享对话",
            "share-button"
        ].includes(label));
    }

    function isMoreButton(button) {
        const labels = getButtonLabels(button);
        return labels.some(label => [
            "more",
            "more options",
            "conversation options",
            "更多",
            "更多选项",
            "菜单",
            "conversation-options"
        ].includes(label));
    }
})();

    /* ==================== 模块 4：鼠标自动隐藏 ==================== */

(function () {
    "use strict";

    /* =========================================================
       鼠标静止自动隐藏
       原脚本 v2.0
       ========================================================= */

    const HIDE_DELAY = USER_CONFIG.cursorHideDelay;
    const MOVE_THRESHOLD = USER_CONFIG.cursorMoveThreshold;
    const HIDE_TIMER_RESTART_INTERVAL = 250;

    let hideTimer = null;
    let lastMouseX = null;
    let lastMouseY = null;
    let lastHideTimerRestartAt = 0;

    if (!document.querySelector("[data-tm-chatgpt-cursor-css]")) {
        const style = document.createElement("style");
        style.setAttribute("data-tm-chatgpt-cursor-css", "true");
        style.textContent = `
            html.tm-chatgpt-cursor-hidden,
            html.tm-chatgpt-cursor-hidden * {
                cursor: none !important;
            }
        `;
        document.documentElement.appendChild(style);
    }

    /*
     * 以 documentElement 上的 class 作为唯一状态来源，
     * 避免布尔值与真实 DOM 状态脱钩后永久失效。
     */
    function isCursorHidden() {
        return document.documentElement.classList.contains("tm-chatgpt-cursor-hidden");
    }

    function showCursor() {
        if (!isCursorHidden()) return;
        document.documentElement.classList.remove("tm-chatgpt-cursor-hidden");
    }

    function hideCursor() {
        if (isCursorHidden()) return;
        document.documentElement.classList.add("tm-chatgpt-cursor-hidden");
    }

    function clearHideTimer() {
        if (hideTimer === null) return;
        clearTimeout(hideTimer);
        hideTimer = null;
    }

    function restartHideTimer(force = false) {
        const now = Date.now();

        if (
            !force &&
            hideTimer !== null &&
            now - lastHideTimerRestartAt < HIDE_TIMER_RESTART_INTERVAL
        ) {
            return;
        }

        lastHideTimerRestartAt = now;
        clearHideTimer();
        hideTimer = setTimeout(() => {
            hideTimer = null;
            hideCursor();
        }, HIDE_DELAY);
    }

    function handlePointerMovement() {
        showCursor();
        restartHideTimer();
    }

    onSharedMouseMove(event => {
        if (lastMouseX === null || lastMouseY === null) {
            lastMouseX = event.clientX;
            lastMouseY = event.clientY;
            handlePointerMovement();
            return;
        }

        const deltaX = Math.abs(event.clientX - lastMouseX);
        const deltaY = Math.abs(event.clientY - lastMouseY);

        lastMouseX = event.clientX;
        lastMouseY = event.clientY;

        if (deltaX < MOVE_THRESHOLD && deltaY < MOVE_THRESHOLD) return;
        handlePointerMovement();
    });

    document.addEventListener("mouseleave", () => {
        clearHideTimer();
        showCursor();
        lastMouseX = null;
        lastMouseY = null;
    });

    document.addEventListener("mouseenter", event => {
        lastMouseX = event.clientX;
        lastMouseY = event.clientY;
        showCursor();
        restartHideTimer(true);
    });

    window.addEventListener("focus", () => {
        lastMouseX = null;
        lastMouseY = null;
        showCursor();
        restartHideTimer(true);
    });

    window.addEventListener("blur", () => {
        clearHideTimer();
        showCursor();
        lastMouseX = null;
        lastMouseY = null;
    });

    showCursor();
    restartHideTimer(true);
})();
})();
