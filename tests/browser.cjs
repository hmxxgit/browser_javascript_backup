const { chromium } = require('playwright');

function getLaunchOptions(overrides = {}) {
    const options = { headless: true, ...overrides };
    const channel = process.env.X_UI_BROWSER || (!process.env.CI ? 'msedge' : '');
    if (channel) options.channel = channel;
    return options;
}

function launchBrowser(overrides) {
    return chromium.launch(getLaunchOptions(overrides));
}

module.exports = { getLaunchOptions, launchBrowser };
