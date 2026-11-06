// Regression for restored free swimming, overlay removal and scroll independence.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium, webkit } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const engineName = process.env.PLAYWRIGHT_ENGINE || 'chromium';
const engine = engineName === 'webkit' ? webkit : chromium;
const output = '.runlogs/whale-autonomy';
const widths = (process.env.WWMS_PUBLIC_WIDTHS || '375,768,1440').split(',').map(Number);
const state = page => page.locator('.public-ocean-journey').evaluate(el => el.oceanSnapshot());
const frames = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
function continuous(before, after) {
  const dt = after.elapsed - before.elapsed;
  assert.ok(dt >= 0 && after.frames >= before.frames, 'Swimming clock/frames never rewind');
  assert.ok(Math.hypot(...after.position.map((v, i) => v - before.position[i])) <= 1.66 * dt + .0001, 'No scroll-controlled position/depth jump');
  assert.ok(Math.hypot(...after.velocity.map((v, i) => v - before.velocity[i])) <= 1.351 * dt + .0001, 'No scroll-controlled acceleration/reversal');
  const dot = Math.abs(after.quaternion.reduce((sum, v, i) => sum + v * before.quaternion[i], 0));
  assert.ok(2 * Math.acos(Math.min(1, dot)) <= .85 * dt + .0001, 'No scroll-controlled orientation change');
  assert.equal(after.scale, before.scale, 'No scroll-controlled scale');
  assert.deepEqual(after.rendered.position, after.position, 'Actual model follows the free swimmer');
  assert.deepEqual(after.rendered.quaternion, after.quaternion);
  assert.equal(after.navigation, undefined);
}
async function animalPixels(page) {
  return page.evaluate(async () => {
    const canvas = document.querySelector('.public-ocean-stage canvas');
    const copy = document.createElement('canvas'); copy.width = canvas.width; copy.height = canvas.height;
    const ctx = copy.getContext('2d', { willReadFrequently: true });
    for (let attempt = 0; attempt < 12; attempt++) {
      const count = await new Promise(resolve => requestAnimationFrame(() => {
        ctx.clearRect(0, 0, copy.width, copy.height); ctx.drawImage(canvas, 0, 0);
        const data = ctx.getImageData(0, 0, copy.width, copy.height).data;
        let total = 0; for (let i = 3; i < data.length; i += 16) if (data[i] > 52) total++;
        resolve(total);
      }));
      if (count) return count;
    }
    return 0;
  });
}
(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await engine.launch(engine === chromium ? { channel: 'msedge', headless: true } : { headless: true });
  const results = [];
  try {
    for (const width of widths) {
      const height = width < 768 ? 844 : 960;
      const context = await browser.newContext({ viewport: { width, height } });
      await context.addInitScript(() => {
        window.__whaleScrollListeners = new Set();
        const add = window.addEventListener.bind(window), remove = window.removeEventListener.bind(window);
        window.addEventListener = (type, listener, options) => {
          if (type === 'scroll' && /PublicOceanJourney|OceanWhaleScene/.test(new Error().stack || '')) window.__whaleScrollListeners.add(listener);
          return add(type, listener, options);
        };
        window.removeEventListener = (type, listener, options) => { window.__whaleScrollListeners.delete(listener); return remove(type, listener, options); };
      });
      const page = await context.newPage(), errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(process.env.WWMS_WEB_URL || 'http://127.0.0.1:5173');
      await page.evaluate(() => document.fonts.ready);
      await page.locator('.public-ocean-journey[data-renderer="webgl"]').waitFor();
      await page.waitForFunction(() => document.querySelector('.public-ocean-journey').oceanSnapshot().frames > 10);
      assert.equal(await page.evaluate(() => window.__whaleScrollListeners.size), 0, 'No whale scroll listener');
      const overlays = await page.evaluate(() => ['#home', '.public-home-content', '#about', '.public-about-copy', '.public-about-water'].flatMap(selector => {
        const node = document.querySelector(selector), css = getComputedStyle(node), issues = [];
        if (css.backgroundImage !== 'none' || css.backgroundColor !== 'rgba(0, 0, 0, 0)') issues.push('covering background');
        if (css.maskImage !== 'none' || css.backdropFilter !== 'none') issues.push('mask/filter');
        for (const pseudo of ['::before', '::after']) {
          if (!['none', 'normal'].includes(getComputedStyle(node, pseudo).content)) issues.push(pseudo);
        }
        return issues.map(issue => selector + ':' + issue);
      }));
      assert.deepEqual(overlays, [], 'No Home/About overlays or replacements');
      assert.notEqual(await page.locator('.public-ocean-site').evaluate(el => getComputedStyle(el).backgroundImage), 'none', 'Actual Deep Ocean background remains');
      const initial = await state(page); await page.waitForTimeout(1700); const idle = await state(page);
      assert.ok(await animalPixels(page) > 30, 'Whale initially occupies visible Home water');
      continuous(initial, idle);
      assert.ok(Math.hypot(...idle.position.map((v, i) => v - initial.position[i])) > .08, 'Free locomotion while stationary');
      for (const key of ['bodyBend', 'tailPitch', 'finPitch']) assert.notEqual(initial.pose[key], idle.pose[key], key + ' remains animated');
      const positions = await page.evaluate(() => {
        const top = id => document.getElementById(id).getBoundingClientRect().top + scrollY;
        const water = document.querySelector('.public-about-water').getBoundingClientRect();
        return { home: 0, about: innerWidth < 768 ? (water.top + water.bottom) / 2 + scrollY - innerHeight / 2 : top('about') - innerHeight * .08,
          gallery: top('gallery') - innerHeight * .25, contact: top('contact') - innerHeight * .1,
          aboutStart: top('about'), galleryStart: top('gallery'), end: document.documentElement.scrollHeight - innerHeight,
          pageHeight: document.documentElement.scrollHeight };
      });
      const samples = [];
      for (let scroll = 0; scroll < positions.galleryStart - height * .55; scroll += 100) {
        const before = await state(page);
        await page.evaluate(top => scrollTo({ top, behavior: 'instant' }), scroll); await frames(page);
        const after = await state(page); continuous(before, after);
        // Sudden content movement may temporarily occlude the animal while it
        // steers clear. Layout never teleports its physical position.
        samples.push(after);
      }
      for (const section of ['home', 'contact', 'gallery', 'about', 'home', 'end', 'about']) {
        const before = await state(page);
        await page.evaluate(top => scrollTo({ top, behavior: 'instant' }), positions[section]); await frames(page);
        const after = await state(page); continuous(before, after); samples.push(after);
        assert.equal(await page.locator('.public-ocean-journey').getAttribute('data-active'), 'true', 'Scrolling never stops swimming');
      }
      for (const section of ['home', 'about', 'gallery', 'contact']) {
        await page.evaluate(top => scrollTo({ top, behavior: 'instant' }), positions[section]); await frames(page);
        assert.ok((await state(page)).frames > 0, 'Swimming continues at ' + section);
        await page.locator('nav').evaluate(el => Promise.all(el.getAnimations({ subtree: true }).map(animation => animation.finished.catch(() => undefined))));
        await page.screenshot({ path: path.join(output, `${engineName}-${width}-${section}.png`) });
      }
      const beforeResize = await state(page);
      await page.setViewportSize({ width: width < 768 ? 1024 : 430, height: 667 }); await frames(page);
      const resized = await state(page);
      assert.ok(resized.elapsed >= beforeResize.elapsed && resized.position.every(Number.isFinite) && resized.scale > 0);
      await page.setViewportSize({ width, height }); await frames(page);
      await page.locator('#home').evaluate(el => Promise.all(el.getAnimations({ subtree: true })
        .filter(animation => animation.effect?.getTiming().iterations !== Infinity).map(animation => animation.finished.catch(() => undefined))));
      assert.equal(await page.evaluate(() => document.documentElement.scrollHeight), positions.pageHeight, 'No layout shift');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      assert.equal(await page.evaluate(() => window.__whaleScrollListeners.size), 0);
      assert.deepEqual(errors, []);
      results.push({ width, height, initial, idle, samples });
      console.log(`PASS ${engineName} ${width}px: visible initial swimming, no scroll listeners/control, continuous forward/reverse/fast scroll, no Home/About overlays, preserved backgrounds, responsive resize.`);
      await context.close();
    }
    fs.writeFileSync(path.join(output, `${engineName}-free-states.json`), JSON.stringify(results, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
