const { test } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const path = require('node:path');

test('DIL diagrams fit viewport height without clipping or changing other media', async () => {
    const browser = await chromium.launch({ channel: process.env.X_UI_BROWSER || 'msedge', headless: true });
    try {
        const page = await browser.newPage({ viewport: { width: 2560, height: 1080 } });
        // Actual DIL structure: a data-URL img with width:100%, not an inline SVG.
        await page.setContent(`<!doctype html><style>
            body { margin:0; background:#000; color:#fff; }
            main { padding:24px; }
            #card { border:1px solid #444; padding:12px; }
            #heading, #legend, #status, #controls { height:40px; margin:8px 0; }
            img[data-d-component=svg] { aspect-ratio:auto 340 / 240; width:100%; }
        </style><main><div data-dil-message-id="test">
            <div id="card"><div id="heading">Kruskal 算法执行过程</div>
            <img id="graph" data-d-component="svg" alt="算法图">
            <div id="legend">图例</div><div id="status">步骤说明</div>
            <div id="controls"><button id="next">下一步</button><span id="step">1/6</span></div></div>
            <img id="photo" alt="普通照片" width="300" height="900">
            <svg id="math" width="40" height="25"><text y="15">x</text></svg>
            <button><svg id="icon" width="20" height="20"></svg></button>
        </div></main><img id="outside" data-d-component="svg" width="300" height="900">`);
        await page.evaluate(async () => {
            window.diagramSource = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 340 240"><rect width="340" height="240" fill="blue"/><text x="20" y="30">A — B</text></svg>');
            const graph = document.querySelector('#graph');
            graph.src = window.diagramSource;
            await graph.decode();
            for (const id of ['photo', 'outside']) {
                const image = document.getElementById(id);
                image.src = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="300" height="900"></svg>');
                await image.decode();
            }
            document.querySelector('#next').onclick = () => {
                graph.src = window.diagramSource.replace('blue', 'green');
                document.querySelector('#step').textContent = '2/6';
            };
        });
        assert.ok((await page.locator('#graph').boundingBox()).height > 1080);
        await page.addScriptTag({ path: path.join(__dirname, '..', 'chatgpt-custom-ui.user.js') });
        for (const viewport of [
            { width:2560, height:1080 }, { width:1600, height:900 },
            { width:1280, height:720 }, { width:375, height:800 }
        ]) {
            await page.setViewportSize(viewport);
            const graph = await page.locator('#graph').boundingBox();
            const card = await page.locator('#card').boundingBox();
            assert.ok(graph.height <= Math.min(560, Math.max(120, viewport.height - 400)) + 1);
            assert.ok(card.height < viewport.height - 80, JSON.stringify({ viewport, card }));
            assert.ok(graph.width <= viewport.width);
            assert.equal(await page.locator('#graph').evaluate(e => getComputedStyle(e).objectFit), 'contain');
            assert.equal(await page.locator('#graph').getAttribute('src'), await page.evaluate(() => window.diagramSource));
        }
        assert.equal((await page.locator('#photo').boundingBox()).height, 900);
        assert.equal((await page.locator('#outside').boundingBox()).height, 900);
        assert.equal((await page.locator('#math').boundingBox()).height, 25);
        assert.equal((await page.locator('#icon').boundingBox()).height, 20);
        await page.locator('#next').click();
        assert.equal(await page.locator('#step').textContent(), '2/6');
        assert.match(await page.locator('#graph').getAttribute('src'), /green/);
        assert.ok((await page.locator('#graph').boundingBox()).height <= 400);
        // Streamed/SPA diagrams inserted after startup receive the same limit.
        await page.locator('[data-dil-message-id]').evaluate(el => {
            const image = document.querySelector('#graph').cloneNode();
            image.id = 'dynamic'; el.append(image);
        });
        assert.ok((await page.locator('#dynamic').boundingBox()).height <= 400);
    } finally {
        await browser.close();
    }
});
