// Public website visual/workflow regression. Contact responses are fixtures; no mail is sent.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium, webkit } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.WWMS_WEB_URL || 'http://localhost:5173';
const engine = process.env.PLAYWRIGHT_ENGINE === 'webkit' ? webkit : chromium;
const widths = (process.env.WWMS_PUBLIC_WIDTHS || '320,375,430,768,1024,1440,1920').split(',').map(Number);
const output = process.env.WWMS_PUBLIC_SCREENSHOTS || '.runlogs/whale-autonomy';
const baseline = process.env.WWMS_PUBLIC_BASELINE ? JSON.parse(fs.readFileSync(process.env.WWMS_PUBLIC_BASELINE, 'utf8')) : null;
const expectedPhotos = ['gallery-1.jpg', 'gallery-2.jpg', 'gallery-3.png', 'gallery-4.jpg', 'gallery-5.jpg'];
const frames = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const jump = async (page, top) => { await page.evaluate(y => window.scrollTo({ top: y, behavior: 'instant' }), top); await frames(page); };

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await engine.launch(engine === chromium ? { channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge', headless: true } : { headless: true });
  try {
    for (const width of widths) {
      const context = await browser.newContext({ viewport: { width, height: width < 768 ? 844 : 960 } });
      await context.addInitScript(() => {
        const debug = window.__publicOceanDebug = { listeners: new Set(), frames: 0 };
        const add = window.addEventListener.bind(window), remove = window.removeEventListener.bind(window);
        const raf = window.requestAnimationFrame.bind(window);
        window.addEventListener = (type, listener, options) => {
          if (type === 'scroll' && /PublicOceanJourney|OceanWhaleScene/.test(new Error().stack || '')) debug.listeners.add(listener);
          return add(type, listener, options);
        };
        window.removeEventListener = (type, listener, options) => { if (type === 'scroll') debug.listeners.delete(listener); return remove(type, listener, options); };
        window.requestAnimationFrame = callback => { if (new Error().stack?.includes('PublicOceanJourney')) debug.frames++; return raf(callback); };
      });
      const page = await context.newPage();
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      page.on('console', message => {
        if (message.type() === 'error' && !message.text().includes('503 (Service Unavailable)')) errors.push(message.text());
      });
      const oldImageRequests = [];
      page.on('request', request => { if (/\/(Hero\.png|about\.jpg|contact\.png|contacttexture\.png)(\?|$)/i.test(new URL(request.url()).pathname)) oldImageRequests.push(request.url()); });
      await page.goto(base + '/');
      await page.evaluate(() => document.fonts.ready);
      await page.locator('.public-ocean-journey[data-renderer="webgl"]').waitFor();
      await page.waitForFunction(() => document.querySelector('.public-ocean-journey').oceanSnapshot().frames > 12);
      assert.equal(await page.locator('.public-ocean-stage canvas').count(), 1, 'One persistent 3D scene');
      assert.equal(await page.locator('.public-ocean-journey').getAttribute('aria-hidden'), 'true');
      assert.equal(await page.locator('.public-ocean-stage canvas').evaluate(el => getComputedStyle(el).pointerEvents), 'none');
      assert.equal(await page.locator('.public-ocean-journey').evaluate(el => getComputedStyle(el).zIndex), '0');
      assert.equal(await page.locator('.public-ocean-site > main').evaluate(el => getComputedStyle(el).zIndex), '1');
      assert.deepEqual(oldImageRequests, [], 'Removed public background images must not be requested');
      const snapshot = await page.evaluate(() => {
        const normalize = value => value.replace(/\s+/g, ' ').trim();
        return {
          content: ['home', 'about', 'gallery', 'contact'].map(id => ({ id,
            copy: [...document.querySelectorAll(`#${id} h1, #${id} h2, #${id} p, #${id} button`)].map(el => {
              const clone = el.cloneNode(true); clone.querySelectorAll('br').forEach(node => node.replaceWith(' '));
              return normalize(clone.textContent);
            }),
          })),
          photos: [...document.querySelectorAll('#gallery [style]')].map(el => el.style.backgroundImage).filter(Boolean),
          footer: normalize(document.querySelector('footer').textContent),
          footerLinks: [...document.querySelectorAll('footer a')].map(el => [normalize(el.textContent), el.getAttribute('href')]),
          form: [...document.querySelectorAll('#contact input, #contact textarea')].map(el => [el.name, el.type, el.placeholder, el.maxLength]),
        };
      });
      assert.deepEqual(snapshot.photos.map(source => source.match(/gallery-[^"')]+/)[0]), [...expectedPhotos, ...expectedPhotos]);
      if (baseline) {
        for (const key of ['content', 'photos', 'form']) assert.deepEqual(snapshot[key], baseline[key], `Preserved ${key}`);
        // Footer labels remain; social arrows are now icons and every organization is linked.
        const labels = await page.locator('footer h4,footer p,footer li').allTextContents();
        for (const label of labels) assert.ok(baseline.footer.includes(label.replace(/\s+/g, ' ').trim()), 'Preserved footer copy');
      }
      assert.equal(await page.locator('footer a[href="#"]').count(), 0, 'No placeholder footer destinations');
      assert.equal(await page.locator('footer li a[href^="https://"]').count(), 12, 'All related organizations are linked');
      const whalePath = await page.locator('.public-ocean-journey .ocean-auth-whale-outline').getAttribute('d');
      if (baseline) assert.equal(whalePath, baseline.whalePath, 'Static fallback retains actual login whale path');

      const positions = await page.evaluate(() => {
        const top = selector => document.querySelector(selector).getBoundingClientRect().top + scrollY;
        const water = document.querySelector('.public-about-water').getBoundingClientRect();
        return { home: 0, about: innerWidth < 768 ? water.top + scrollY + water.height / 2 - innerHeight * .5 : top('#about') - innerHeight * .08,
          gallery: top('#gallery') - innerHeight * .25, contact: top('#contact') - innerHeight * .1,
          end: document.documentElement.scrollHeight - innerHeight, height: document.documentElement.scrollHeight };
      });
      const idleBefore = await page.locator('.public-ocean-journey').evaluate(el => el.oceanSnapshot());
      await page.waitForTimeout(1500);
      const idleAfter = await page.locator('.public-ocean-journey').evaluate(el => el.oceanSnapshot());
      assert.ok(idleAfter.frames > idleBefore.frames + 10, 'Continuous rendering without scrolling');
      assert.ok(idleAfter.elapsed > idleBefore.elapsed + .5, 'Autonomous clock advances');
      assert.notDeepEqual(idleAfter.pose, idleBefore.pose, 'Body, tail and fins move while stationary');
      assert.notDeepEqual(idleAfter.quaternion, idleBefore.quaternion, 'Real 3D orientation changes');
      assert.ok(idleAfter.geometry.bodyVertices > 600);
      assert.equal(idleAfter.quality.lowDetail, width < 768);
      if (width < 768) assert.ok(idleAfter.quality.frameRate <= 30 && idleAfter.quality.pixelRatio <= 1);
      for (const section of ['home', 'about', 'gallery', 'contact']) {
        const beforeScroll = await page.locator('.public-ocean-journey').evaluate(el => el.oceanSnapshot());
        await jump(page, positions[section]);
        const afterScroll = await page.locator('.public-ocean-journey').evaluate(el => el.oceanSnapshot());
        const dt = afterScroll.elapsed - beforeScroll.elapsed;
        assert.ok(Math.hypot(...afterScroll.position.map((value, i) => value - beforeScroll.position[i])) <= 1.66 * dt + .0001, 'Scrolling cannot jump the free swimmer');
        assert.equal(afterScroll.scale, beforeScroll.scale, 'Scrolling cannot set whale scale');
        await page.waitForTimeout(3000);
        const state = await page.locator('.public-ocean-journey').evaluate(el => el.oceanSnapshot());
        assert.ok(state.frames > 12 && state.elapsed > 0, 'Live scene at ' + section);
        assert.equal(state.navigation, undefined, 'No scroll navigation controller');
        assert.equal(state.environment.masks, undefined, 'No content-based shader cutouts');
        assert.equal(state.environment.space, undefined, 'No content obstacles or reserved regions');
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `No horizontal overflow: ${section} at ${width}px`);
        assert.equal(await page.evaluate(() => document.documentElement.scrollHeight), positions.height, 'Whale does not shift page layout');
        if ([375, 1440].includes(width)) {
          await page.locator('nav').evaluate(el => Promise.all(el.getAnimations({ subtree: true }).map(animation => animation.finished.catch(() => undefined))));
          await page.screenshot({ path: path.join(output, `${process.env.PLAYWRIGHT_ENGINE || 'chromium'}-${width}-${section}.png`) });
        }
      }
      for (const section of ['gallery', 'about']) {
        const before = await page.locator('.public-ocean-journey').evaluate(el => el.oceanSnapshot());
        await jump(page, positions[section]);
        const after = await page.locator('.public-ocean-journey').evaluate(el => el.oceanSnapshot());
        assert.ok(after.elapsed >= before.elapsed, 'Reverse scroll never rewinds the swimming clock');
        const dt = after.elapsed - before.elapsed;
        assert.ok(Math.hypot(...after.position.map((value, i) => value - before.position[i])) <= 1.66 * dt + .0001, 'Reverse scrolling cannot reposition the whale');
        assert.equal(after.scale, before.scale);
      }
      await jump(page, positions.end);
      assert.equal(await page.locator('.public-ocean-journey').getAttribute('data-active'), 'true', 'Swimming continues at the footer');

      if ([375, 1440].includes(width)) await page.screenshot({ path: path.join(output, `${process.env.PLAYWRIGHT_ENGINE || 'chromium'}-${width}-footer.png`) });

      if (width >= 768) {
        const photo = page.locator('#gallery [style*="gallery-1"]:visible');
        await photo.scrollIntoViewIfNeeded();
        const photoWidth = await photo.evaluate(el => el.getBoundingClientRect().width);
        await photo.hover();
        await page.waitForFunction(before => document.querySelector('#gallery .md\\:flex [style*="gallery-1"]').getBoundingClientRect().width > before * 1.4, photoWidth);
      } else assert.equal(await page.locator('#gallery [style*="gallery-"]:visible').count(), 5);

      await jump(page, positions.contact);
      for (const name of ['About', 'Gallery', 'Contact', 'Home']) {
        const navigation = width < 768 ? page.locator('#public-mobile-navigation') : page.locator('nav');
        if (width < 768) await page.getByRole('button', { name: 'Open menu', exact: true }).click();
        await navigation.evaluate(el => Promise.all(el.getAnimations({ subtree: true }).map(animation => animation.finished.catch(() => undefined))));
        const link = navigation.getByRole('link', { name, exact: true });
        assert.equal(await link.evaluate(el => {
          const r = el.getBoundingClientRect();
          return document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)?.closest('a') === el;
        }), true, `${name} navigation is not clipped at ${width}px`);
        await link.click();
        await page.waitForFunction(id => Math.abs(scrollY - (document.querySelector('#' + id).getBoundingClientRect().top + scrollY)) < 3, name.toLowerCase());
      }
      if ([375, 1440].includes(width)) {
        await context.route('https://www.facebook.com/**', route => route.fulfill({ status: 200, body: '<title>Footer destination fixture</title>' }));
        const popupPromise = context.waitForEvent('page');
        await page.locator('footer a[href^="https://www.facebook.com/"]').click();
        const popup = await popupPromise;
        await popup.waitForURL('https://www.facebook.com/share/1GvU3cb2ij/?mibextid=wwXIfr');
        assert.equal(new URL(page.url()).pathname, '/', 'External footer link preserves the public page');
        await popup.close();
      }

      await page.emulateMedia({ reducedMotion: 'reduce' });
      await jump(page, 0);
      await page.locator('.public-ocean-journey[data-renderer="reduced"]').waitFor();
      assert.equal(await page.locator('.public-ocean-stage canvas').count(), 0, 'Reduced motion releases GPU resources');
      const still = await page.locator('.public-ocean-fallback').evaluate(el => el.style.cssText);
      assert.equal(await page.locator('.public-ocean-fallback .ocean-auth-whale').evaluate(el => getComputedStyle(el).animationName), 'none');
      await jump(page, positions.gallery);
      assert.equal(await page.locator('.public-ocean-fallback').evaluate(el => el.style.cssText), still, 'Reduced motion keeps a static Home illustration');
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      await jump(page, 0);
      await page.locator('.public-ocean-journey[data-renderer="webgl"]').waitFor();

      if ([375, 1440].includes(width)) {
        let fail = true, requests = 0;
        await page.route('**/api/contact', async route => { requests++; await route.fulfill({ status: fail ? 503 : 200, json: {
          message: fail ? 'Your inquiry could not be sent. Please try again later.' : 'Your inquiry has been sent. Thank you for contacting us.',
        } }); });
        const form = page.locator('#contact form');
        await form.getByRole('textbox', { name: 'Your name', exact: true }).fill('Public visual fixture');
        await form.getByRole('textbox', { name: 'Your email address', exact: true }).fill('visual@example.test');
        await form.getByRole('textbox', { name: 'Your inquiry or feedback', exact: true }).fill('Preserve the working Contact flow.');
        await form.getByRole('button', { name: 'Submit', exact: true }).click();
        await form.getByRole('alert').waitFor();
        assert.equal(await form.getByRole('textbox', { name: 'Your inquiry or feedback', exact: true }).inputValue(), 'Preserve the working Contact flow.');
        fail = false;
        await form.getByRole('button', { name: 'Submit', exact: true }).click();
        await form.getByRole('status').waitFor();
        assert.equal(await form.getByRole('textbox', { name: 'Your name', exact: true }).inputValue(), '');
        assert.equal(requests, 2);
      }

      await jump(page, 0);
      await page.evaluate(() => window.__lastOceanSnapshot = document.querySelector('.public-ocean-journey').oceanSnapshot);
      await page.getByRole('button', { name: 'Login to Web Portal', exact: true }).click();
      await page.waitForURL('**/auth');
      await page.locator('.public-ocean-journey').waitFor({ state: 'detached' });
      await page.waitForFunction(() => window.__lastOceanSnapshot().disposed === true);
      await page.waitForFunction(() => window.__publicOceanDebug.listeners.size === 0);
      assert.equal(await page.locator('.public-ocean-journey').count(), 0);
      assert.equal(await page.evaluate(() => window.__lastOceanSnapshot().disposed), true, 'Scene disposed on route exit');
      assert.equal(await page.evaluate(() => window.__publicOceanDebug.listeners.size), 0, 'Journey scroll listener cleaned up on route exit');
      assert.equal(await page.locator('.ocean-auth-whale-outline').getAttribute('d'), whalePath, 'Login whale unchanged');
      assert.equal(await page.locator('.ocean-auth-whale-svg').getAttribute('viewBox'), '0 0 640 360');
      assert.notEqual(await page.locator('.ocean-auth-whale').evaluate(el => getComputedStyle(el).animationName), 'none');
      await page.goBack();
      await page.locator('.public-ocean-journey[data-renderer="webgl"]').waitFor();
      await page.waitForFunction(() => window.__publicOceanDebug.listeners.size === 0);
      assert.equal(await page.locator('.public-ocean-stage canvas').count(), 1);
      assert.equal(await page.evaluate(() => window.__publicOceanDebug.listeners.size), 0, 'No whale scroll listener after route re-entry');
      assert.deepEqual(errors, [], `Browser errors at ${width}px`);
      console.log(`PASS ${process.env.PLAYWRIGHT_ENGINE || 'chromium'} ${width}px: four sections, independent forward/reverse scroll, gallery, navigation, reduced motion, living 3D/cleanup, login, preserved content.`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
