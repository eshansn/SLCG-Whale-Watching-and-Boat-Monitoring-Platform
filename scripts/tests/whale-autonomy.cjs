const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium, webkit } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const engineName = process.env.PLAYWRIGHT_ENGINE || 'chromium';
const engine = engineName === 'webkit' ? webkit : chromium;
const output = '.runlogs/whale-visible-through-content';
const snap = page => page.locator('.public-ocean-journey').evaluate(el => el.oceanSnapshot());
(async () => {
 fs.mkdirSync(output, { recursive: true });
 const browser = await engine.launch(engine === chromium ? { channel: 'msedge', headless: true } : { headless: true });
 try {
  for (const width of (process.env.WWMS_PUBLIC_WIDTHS || '1440,375,1024').split(',').map(Number)) {
   const context = await browser.newContext({ viewport: { width, height: width < 768 ? 844 : 960 },
     ...(process.env.WWMS_RECORD_WHALE ? { recordVideo: { dir: output, size: { width: 960, height: 640 } } } : {}) });
   const page = await context.newPage(), errors = [], samples = [];
   page.on('pageerror', e => errors.push(e.message));
   await page.goto('http://127.0.0.1:5173');
   await page.locator('.public-ocean-journey[data-renderer="webgl"]').waitFor();
   await page.waitForTimeout(4000);
   const first = await snap(page);
   await page.screenshot({ path: path.join(output, `${engineName}-${width}-home.png`) });
   const nav = await page.locator('nav').evaluate(el => ({ shadow: getComputedStyle(el).boxShadow, image: getComputedStyle(el).backgroundImage, rect: el.getBoundingClientRect().toJSON() }));
   assert.equal(nav.shadow, 'none'); assert.equal(nav.image, 'none');
   await page.evaluate(() => {
     const element = innerWidth < 768 ? document.querySelector('.public-about-water') : document.querySelector('#about');
     const r = element.getBoundingClientRect();
     scrollBy({ top: r.top - (innerWidth < 768 ? 240 : 100), behavior: 'instant' });
   });
   const afterScroll = await snap(page);
   assert.ok(Math.hypot(...afterScroll.position.map((v, i) => v - first.position[i])) <= 1.32 * (afterScroll.elapsed - first.elapsed) + .001);
   for (let i = 0; i < 24; i++) {
    await page.waitForTimeout(1500);
    const s = await snap(page); samples.push(s);
    if ([3, 11, 23].includes(i)) await page.screenshot({ path: path.join(output, `${engineName}-${width}-about-${i}.png`) });
   }
   fs.writeFileSync(path.join(output, `${engineName}-${width}-states.json`), JSON.stringify(samples, null, 2));
   const settled = samples.slice(12);
   assert.ok(settled.some(s => s.steering.destinations >= 3), 'Chooses new destinations while stationary');
   assert.ok(new Set(settled.map(s => s.goal.join(','))).size >= 2, 'Explores stationary water');
   assert.ok(new Set(samples.map(s => s.pose.tailPitch)).size > 10, 'Tail keeps swimming');
   assert.ok(samples.some(s => Math.abs(s.pose.spineYaw[0] - s.pose.spineYaw[11]) > .04), 'Delayed head/body/tail turn in real renderer');
   assert.ok(settled.every(s => s.environment.space === undefined && s.environment.masks === undefined), 'No content avoidance or hiding');
   for (const id of ['gallery', 'contact', 'home']) {
    await page.evaluate(id => document.getElementById(id).scrollIntoView({ behavior: 'instant' }), id);
    await page.waitForTimeout(2500);
    const s = await snap(page);
    assert.ok(s.frames > first.frames && s.navigation === undefined);
    await page.screenshot({ path: path.join(output, `${engineName}-${width}-${id}-return.png`) });
   }
   await page.setViewportSize({ width: width < 768 ? 430 : 1280, height: 740 });
   await page.waitForTimeout(2000);
   const resized = await snap(page);
   assert.ok(resized.position.every(Number.isFinite) && resized.quaternion.every(Number.isFinite));
   assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
   assert.deepEqual(errors, []);
   await context.close();
   console.log(`PASS ${engineName} ${width}: independent exploration without content obstacles/masks, delayed spine turning, transparent navbar, four sections and resize.`);
  }
 } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
