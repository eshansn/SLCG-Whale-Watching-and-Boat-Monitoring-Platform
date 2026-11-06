// Real WebGL rendering/lifecycle checks. Contact delivery is never exercised here.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium, webkit } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const engineName = process.env.PLAYWRIGHT_ENGINE || 'chromium';
const engine = engineName === 'webkit' ? webkit : chromium;
const base = process.env.WWMS_WEB_URL || 'http://127.0.0.1:5173';
const output = '.runlogs/whale-visible-through-content';
const snapshot = page => page.locator('.public-ocean-journey').evaluate(el => el.oceanSnapshot());

// Sample the live framebuffer in the same RAF as rendering, before the compositor
// clears it. Particles have alpha .14; an animal fragment would exceed .2.
async function verifyAnimalPixels(page, requireAnimal = false) {
  const result = await page.evaluate(async () => {
    const layer = document.querySelector('.public-ocean-journey');
    const canvas = layer.querySelector('canvas');
    const copy = document.createElement('canvas'); copy.width = canvas.width; copy.height = canvas.height;
    const ctx = copy.getContext('2d', { willReadFrequently: true });
    for (let attempt = 0; attempt < 14; attempt++) {
      const sample = await new Promise(resolve => requestAnimationFrame(() => {
        ctx.clearRect(0, 0, copy.width, copy.height); ctx.drawImage(canvas, 0, 0);
        const data = ctx.getImageData(0, 0, copy.width, copy.height).data;
        let animal = 0;
        for (let y = 0; y < copy.height; y += 4) for (let x = 0; x < copy.width; x += 4) {
          if (data[(y * copy.width + x) * 4 + 3] <= 52) continue;
          animal++;
        }
        resolve({ animal });
      }));
      if (sample.animal) return sample;
    }
    return { animal: 0 };
  });
  if (requireAnimal) assert.ok(result.animal > 80, 'Actual whale pixels are rendered');
  return result;
}

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await engine.launch(engine === chromium ? { channel: 'msedge', headless: true } : { headless: true });
  const errors = [], samples = [];
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 960 },
      ...(process.env.WWMS_RECORD_WHALE ? { recordVideo: { dir: output, size: { width: 960, height: 640 } } } : {}) });
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto(base);
    await page.locator('.public-ocean-journey[data-renderer="webgl"]').waitFor();
    const canvas = page.locator('.public-ocean-stage canvas');
    const firstCanvas = await canvas.elementHandle();
    for (let index = 0; index < 6; index++) {
      await page.waitForTimeout(index ? 4800 : 1800);
      const state = await snapshot(page); samples.push(state);
      assert.equal(await firstCanvas.evaluate(el => el.isConnected), true, 'One persistent scene while swimming');
      await verifyAnimalPixels(page, true);
      await page.screenshot({ path: path.join(output, `${engineName}-live-${index}.png`) });
    }
    assert.ok(samples.at(-1).frames - samples[0].frames > 300, 'Continuously renders while page is stationary');
    assert.ok(samples.at(-1).steering.destinations > samples[0].steering.destinations, 'Autonomous destination selection in the real renderer');
    assert.ok(new Set(samples.map(s => s.behavior)).size >= 2, 'Steering-derived behavior changes without a timed state sequence');
    assert.ok(Math.max(...samples.map(s => s.position[2])) - Math.min(...samples.map(s => s.position[2])) > 1, 'Depth changes independently while stationary');
    assert.ok(new Set(samples.map(s => s.quaternion.join(','))).size === samples.length);
    assert.ok(new Set(samples.map(s => s.pose.tailPitch)).size === samples.length);
    const widths = samples.map(s => s.projectedBounds.right - s.projectedBounds.left);
    assert.ok(Math.max(...widths) - Math.min(...widths) > .1, 'Articulated swimming changes the visible silhouette');
    const scrollStates = [];

    for (const id of ['about', 'gallery', 'contact', 'gallery', 'about', 'home']) {
      const before = await snapshot(page);
      await page.evaluate(section => scrollTo({ top: document.getElementById(section).offsetTop - 65, behavior: 'instant' }), id);
      await page.waitForTimeout(250);
      const after = await snapshot(page);
      assert.ok(after.elapsed > before.elapsed, 'Scrolling never scrubs swimming time');
      scrollStates.push(after);
      const dt = after.elapsed - before.elapsed;
      assert.ok(Math.hypot(...after.position.map((value, i) => value - before.position[i])) <= 1.66 * dt + .0001, 'Scrolling cannot reposition the whale');
      const dot = Math.abs(after.quaternion.reduce((sum, value, i) => sum + value * before.quaternion[i], 0));
      assert.ok(2 * Math.acos(Math.min(1, dot)) <= .85 * dt + .0001, 'Scrolling cannot set orientation');
      assert.equal(after.scale, before.scale, 'Scrolling cannot set scale');
      assert.equal(await firstCanvas.evaluate(el => el.isConnected), true, 'Same whale through all sections');
      await verifyAnimalPixels(page);
    }
    assert.ok(scrollStates.every(state => state.navigation === undefined), 'No scroll navigation state exists');
    await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
    await page.waitForTimeout(1500);
    await page.evaluate(() => {
      window.__testOceanHidden = true;
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => window.__testOceanHidden });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    const paused = await snapshot(page);
    await page.waitForTimeout(400);
    assert.equal((await snapshot(page)).frames, paused.frames, 'Hidden tabs cancel rendering');
    await page.evaluate(() => { window.__testOceanHidden = false; document.dispatchEvent(new Event('visibilitychange')); });
    await page.waitForTimeout(180);
    const resumed = await snapshot(page);
    assert.ok(resumed.frames > paused.frames && resumed.elapsed - paused.elapsed < .3, 'Resume without a time jump');
    await canvas.evaluate(el => el.getContext('webgl2').getExtension('WEBGL_lose_context').loseContext());
    await page.locator('.public-ocean-journey[data-renderer="fallback"]').waitFor();
    assert.equal(await canvas.count(), 0, 'Context loss releases the scene and exposes fallback');
    assert.equal(await page.locator('.public-ocean-fallback').evaluate(el => getComputedStyle(el).display), 'block');
    if (process.env.WWMS_RECORD_WHALE) {
      const video = page.video(); await page.close();
      await video.saveAs(path.join(output, 'continuous-swimming.webm'));
    }
    await context.close();

    const reduced = await browser.newContext({ viewport: { width: 375, height: 844 }, reducedMotion: 'reduce' });
    const reducedPage = await reduced.newPage();
    const requested = [];
    reducedPage.on('request', request => { if (/\/OceanWhaleScene[.-]/.test(request.url())) requested.push(request.url()); });
    await reducedPage.goto(base);
    await reducedPage.locator('.public-ocean-journey[data-renderer="reduced"]').waitFor();
    assert.equal(await reducedPage.locator('.public-ocean-stage canvas').count(), 0);
    assert.deepEqual(requested, [], 'Reduced motion skips lazy 3D scene loading');
    assert.equal(await reducedPage.locator('.public-ocean-fallback .ocean-auth-whale').evaluate(el => getComputedStyle(el).animationName), 'none');
    await reducedPage.screenshot({ path: path.join(output, `${engineName}-reduced.png`) });
    await reduced.close();

    const fallback = await browser.newContext({ viewport: { width: 375, height: 844 } });
    await fallback.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function(type, ...args) { return type === 'webgl2' ? null : original.call(this, type, ...args); };
    });
    const fallbackPage = await fallback.newPage();
    await fallbackPage.goto(base);
    await fallbackPage.locator('.public-ocean-journey[data-renderer="fallback"]').waitFor();
    assert.equal(await fallbackPage.locator('.public-ocean-stage canvas').count(), 0);
    assert.ok(parseFloat(await fallbackPage.locator('.ocean-auth-whale-outline').evaluate(el => getComputedStyle(el).strokeDashoffset)) === 0);
    await fallbackPage.getByRole('button', { name: 'Login to Web Portal', exact: true }).click();
    await fallbackPage.waitForURL('**/auth');
    assert.equal(await fallbackPage.locator('.ocean-auth-whale-svg').count(), 1, 'Login remains functional with no WebGL');
    await fallback.close();

    const limited = await browser.newContext({ viewport: { width: 1440, height: 960 }, deviceScaleFactor: 2 });
    await limited.addInitScript(() => Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 4 }));
    const limitedPage = await limited.newPage(); await limitedPage.goto(base);
    await limitedPage.locator('.public-ocean-journey[data-renderer="webgl"]').waitFor();
    await limitedPage.waitForTimeout(1200);
    const quality = (await snapshot(limitedPage)).quality;
    assert.ok(quality.lowDetail && quality.frameRate === 30 && quality.pixelRatio === 1 && quality.particleCount === 24);
    await limited.close();
    assert.deepEqual(errors, [], 'No runtime or shader errors');
    fs.writeFileSync(path.join(output, `${engineName}-live-states.json`), JSON.stringify(samples, null, 2));
    console.log(`PASS ${engineName}: independent idle swimming, natural depth/perspective, no scroll control, actual whale pixels, forward/reverse navigation, hidden/resume, context loss, reduced motion, no-WebGL fallback and low-device limits.`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
