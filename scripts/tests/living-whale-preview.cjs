// Capture real-time poses for human review; never advances or replaces the scene clock.
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
(async () => {
  const output = '.runlogs/whale-free-swim'; fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
    page.on('pageerror', e => console.error(e));
    page.on('console', m => { if (m.type() === 'error') console.error(m.text()); });
    await page.goto(process.env.WWMS_WEB_URL || 'http://127.0.0.1:5173');
    await page.locator('.public-ocean-journey[data-renderer="webgl"]').waitFor();
    const samples = [];
    for (let i = 0; i < 5; i++) {
      await page.waitForTimeout(i ? 3800 : 1500);
      samples.push(await page.locator('.public-ocean-journey').evaluate(el => el.oceanSnapshot()));
      await page.screenshot({ path: path.join(output, `desktop-idle-${i}.png`) });
    }
    for (const section of ['about', 'gallery', 'contact']) {
      await page.evaluate(id => scrollTo({ top: document.getElementById(id).offsetTop - 65, behavior: 'instant' }), section);
      await page.waitForTimeout(6500);
      samples.push(await page.locator('.public-ocean-journey').evaluate(el => el.oceanSnapshot()));
      await page.screenshot({ path: path.join(output, `desktop-${section}.png`) });
    }
    await page.setViewportSize({ width: 375, height: 844 });
    await page.goto(process.env.WWMS_WEB_URL || 'http://127.0.0.1:5173');
    await page.locator('.public-ocean-journey[data-renderer="webgl"]').waitFor();
    await page.waitForTimeout(2500);
    await page.screenshot({ path: path.join(output, 'mobile-home.png') });
    samples.push(await page.locator('.public-ocean-journey').evaluate(el => el.oceanSnapshot()));
    fs.writeFileSync(path.join(output, 'preview-state.json'), JSON.stringify(samples, null, 2));
    console.log(samples.map(s => ({ behavior: s.behavior, elapsed: s.elapsed,
      position: s.position, bounds: s.projectedBounds, quality: s.quality })));
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
