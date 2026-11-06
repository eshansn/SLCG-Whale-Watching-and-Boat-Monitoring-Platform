// Checks real composited pixels, not only canvas geometry or transparent CSS.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium, webkit } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const engineName = process.env.PLAYWRIGHT_ENGINE || 'chromium';
const output = '.runlogs/whale-visible-through-content';
const state = page => page.locator('.public-ocean-journey').evaluate(el => el.oceanSnapshot());
async function pixelDifference(page, visible, hidden) {
 return page.evaluate(async ([a,b]) => {
  const load = source => new Promise(resolve => { const img = new Image(); img.onload = () => resolve(img); img.src = 'data:image/png;base64,' + source; });
  const [one,two] = await Promise.all([load(a),load(b)]);
  const canvas = document.createElement('canvas'); canvas.width = one.width; canvas.height = one.height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.drawImage(one,0,0); const first = context.getImageData(0,0,canvas.width,canvas.height).data;
  context.clearRect(0,0,canvas.width,canvas.height); context.drawImage(two,0,0);
  const second = context.getImageData(0,0,canvas.width,canvas.height).data;
  let changed = 0;
  for (let i = 0; i < first.length; i += 4) {
   if (Math.max(Math.abs(first[i]-second[i]),Math.abs(first[i+1]-second[i+1]),Math.abs(first[i+2]-second[i+2])) > 12) changed++;
  }
  return changed;
 }, [visible.toString('base64'),hidden.toString('base64')]);
}
(async () => {
 fs.mkdirSync(output, { recursive: true });
 const engine = engineName === 'webkit' ? webkit : chromium;
 const browser = await engine.launch(engineName === 'chromium' ? { channel: 'msedge', headless: true } : { headless: true });
 const results = [];
 try {
  for (const width of (process.env.WWMS_PUBLIC_WIDTHS || '375,1440').split(',').map(Number)) {
   const context = await browser.newContext({ viewport: { width, height: width < 768 ? 844 : 960 } });
   await context.addInitScript(() => { let seed = 7; Math.random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296); });
   const page = await context.newPage(), errors = [];
   page.on('pageerror', e => errors.push(e.message));
   await page.goto('http://127.0.0.1:5173');
   await page.locator('.public-ocean-journey[data-renderer="webgl"]').waitFor();
   await page.evaluate(() => document.fonts.ready);
   await page.waitForTimeout(600);
   const initial = await state(page), canvas = page.locator('.public-ocean-stage canvas');
   assert.equal(await canvas.evaluate(el => getComputedStyle(el).pointerEvents), 'none');
   const styled = await page.evaluate(() => {
    const issues = new Set();
    for (const node of document.querySelectorAll('main h1,main h2,main p,footer h4,footer p,nav,#public-mobile-navigation')) {
     for (let el = node; el && !el.classList.contains('public-ocean-site'); el = el.parentElement) {
      const css = getComputedStyle(el);
      if (css.backgroundImage !== 'none' || css.backgroundColor !== 'rgba(0, 0, 0, 0)' || css.backdropFilter !== 'none' || css.maskImage !== 'none') issues.add(el.className || el.tagName);
     }
    }
    return [...issues];
   });
   assert.deepEqual(styled, [], 'Content and navbar have no covering backgrounds, filters or masks');
   for (const [name,selector] of [['home-heading','#home h1'],['home-paragraph','#home p'],['about-heading','#about h2'],['about-paragraph','#about p'],['gallery-paragraph','#gallery p'],['contact-heading','#contact h2']]) {
    let changed = 0, attempts = 0;
    for (; attempts < 20; attempts++) {
     const before = await state(page);
     await page.locator(selector).first().evaluate((el, bounds) => {
      const r = el.getBoundingClientRect(), middle = (bounds.top + bounds.bottom) / 2;
      scrollTo({ top: scrollY + r.top + r.height / 2 - middle, behavior: 'instant' });
     }, before.projectedBounds);
     await page.waitForTimeout(120);
     const boxes = await page.locator(selector).evaluateAll(elements => elements.map(el => {
      const r=el.getBoundingClientRect(); return { x: Math.max(0,r.left), y: Math.max(0,r.top), width: Math.min(innerWidth,r.right)-Math.max(0,r.left), height: Math.min(innerHeight,r.bottom)-Math.max(0,r.top) };
     }));
     const s = await state(page);
     for (const box of boxes.filter(b => b.width > 2 && b.height > 2)) {
      if (box.x >= s.projectedBounds.right || box.x+box.width <= s.projectedBounds.left) continue;
      const visible = await page.screenshot({ clip: box });
      await canvas.evaluate(el => { el.style.visibility = 'hidden'; });
      const hidden = await page.screenshot({ clip: box });
      await canvas.evaluate(el => { el.style.removeProperty('visibility'); });
      changed = Math.max(changed, await pixelDifference(page, visible, hidden));
      if (changed > 100) break;
     }
     if (changed > 100) break;
     await page.waitForTimeout(600);
    }
    assert.ok(changed > 100, `${name}: whale body remains visibly composited through text area at ${width}px (pixels=${changed})`);
    await page.screenshot({ path: path.join(output, `${engineName}-${width}-${name}.png`) });
    results.push({ width, name, changed, attempts });
   }
   const final = await state(page);
   assert.ok(final.elapsed > initial.elapsed && final.frames > initial.frames && final.steering.destinations >= 1);
   assert.equal(final.environment.masks, undefined); assert.equal(final.environment.space, undefined);
   assert.notDeepEqual(final.pose, initial.pose);
   assert.deepEqual(errors, []);
   console.log(`PASS ${engineName} ${width}: actual composited whale pixels behind Home/About headings and paragraphs, Gallery caption and Contact heading; transparent navbar; unchanged text interaction.`);
   await context.close();
  }
  fs.writeFileSync(path.join(output, `${engineName}-text-pixels.json`), JSON.stringify(results,null,2));
 } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
