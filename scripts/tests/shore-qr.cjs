// Test fixtures simulate cameras/API responses, never real attendance records.
// --live uses the isolated SQL/API harness; only camera hardware is simulated.
const assert = require('node:assert/strict');
const playwright = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { QRCodeWriter, BarcodeFormat } = require('../../apps/web/node_modules/@zxing/library');
const base = (process.env.WWMS_WEB_URL || 'http://localhost:5173').replace(/\/$/, '');
const tripId = process.env.WWMS_SHORE_TRIP_ID || '11111111-1111-1111-1111-111111111111';
const passengerId = '22222222-2222-2222-2222-222222222222';
const userId = '33333333-3333-3333-3333-333333333333';
const qrValue = process.env.WWMS_SHORE_QR || `wwms:passenger:${'A'.repeat(43)}`;
const matrix = new QRCodeWriter().encode(qrValue, BarcodeFormat.QR_CODE, 480, 480, new Map());
const pixels = Array.from({ length: matrix.getHeight() }, (_, y) => Array.from({ length: matrix.getWidth() }, (_, x) => Number(matrix.get(x, y))));
const engine = process.env.PLAYWRIGHT_ENGINE || 'chromium';

async function main() {
  const browser = await playwright[engine].launch({ headless: true, ...(engine === 'chromium' ? { channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge' } : {}) });
  const context = await browser.newContext();
  const errors = [];
  let scans = 0;
  let saves = 0;
  let finalized = false;
  let alreadyProcessed = false;
  const scheduled = new Date(Date.now() + 3600000).toISOString();
  const members = [0, 1].map((index) => ({ passengerId: index ? '44444444-4444-4444-4444-444444444444' : passengerId,
    name: index ? 'Travel Companion' : 'Primary Passenger', passengerReference: `SHORE-REFERENCE-${index}`, phoneNumber: '0701234567', relationship: index ? 'Companion' : 'Primary passenger', status: 'NotChecked' }));
  const group = () => ({ primaryPassengerId: passengerId, primaryPassengerName: 'Primary Passenger', primaryPassengerReference: 'SHORE-REFERENCE-0', tripId,
    boatName: 'Shore Test Boat', registrationNumber: 'SHORE-TEST', scheduledDepartureUtc: scheduled, alreadyProcessed, finalized, members });
  const trip = { id: tripId, boatId: userId, vesselName: 'Shore Test Boat With A Long Vessel Name', registrationNumber: 'SHORE-TEST',
    ownerName: 'Test Boat Owner With A Long Name', scheduledDepartureUtc: scheduled, type: 'WhaleWatching', status: 'Scheduled', shoreApproval: 'Pending',
    passengerCount: 2, crew: [{ crewUserId: userId, name: 'Test Crew', nicNumber: 'TEST-NIC', position: 'Captain', certified: true }], updatedAtUtc: scheduled };
  const live = process.argv.includes('--live');
  if (live) {
    const response = await context.request.post(`${base}/api/auth/login`, { data: { email: 'shorecrew@complaint-test.example', password: 'BrowserTest#2026!Only' } });
    assert.equal(response.status(), 200, 'Live Shore Officer login');
    const auth = await response.json();
    await context.addInitScript(token => { if (!sessionStorage.getItem('whale-watching-refresh-token')) sessionStorage.setItem('whale-watching-refresh-token', token); }, auth.refreshToken);
  } else {
    const jwt = `e30.${Buffer.from(JSON.stringify({ sub: userId, email: 'shore-test@example.test', role: 'ShoreCrew' })).toString('base64url')}.test`;
    await context.addInitScript(() => sessionStorage.setItem('whale-watching-refresh-token', 'test'));
    await context.routeWebSocket('**/hubs/operations*', socket => { socket.onMessage(message => { if (String(message).includes('"protocol"')) socket.send('{}\x1e'); }); });
    await context.route('**/hubs/operations/negotiate*', r => r.fulfill({ json: { negotiateVersion: 1, connectionId: 'test', connectionToken: 'test', availableTransports: [{ transport: 'WebSockets', transferFormats: ['Text', 'Binary'] }] } }));
    await context.route('**/api/**', async r => {
      const request = r.request(); const url = new URL(request.url()); const path = url.pathname;
      if (!path.startsWith('/api/')) return r.continue();
      const json = value => r.fulfill({ json: value });
      if (path === '/api/auth/refresh') return json({ accessToken: jwt, roles: ['ShoreCrew'], refreshToken: 'test', accessTokenExpiresAtUtc: scheduled, refreshTokenExpiresAtUtc: scheduled });
      if (path === '/api/operations/trips') return json([{ ...trip, passengerVerificationFinalizedAtUtc: finalized ? scheduled : null }]);
      if (path === '/api/operations/boats') return json([{ id: userId, name: trip.vesselName, lengthMeters: 15, maximumCapacity: 20, documents: [] }]);
      if (path.endsWith('/attendance/scan')) {
        scans++; await new Promise(resolve => setTimeout(resolve, 250));
        return request.postDataJSON().qrValue === qrValue ? json(group()) : r.fulfill({ status: 400, json: { message: 'Invalid passenger QR code.' } });
      }
      if (path.endsWith('/attendance/search')) return json([{ primaryPassengerId: passengerId, primaryPassengerName: 'Primary Passenger', passengerReference: 'SHORE-REFERENCE-0', memberCount: 2, alreadyProcessed }]);
      if (path.includes('/attendance/groups/')) {
        if (request.method() === 'PUT') { saves++; await new Promise(resolve => setTimeout(resolve, 350)); for (const item of request.postDataJSON().items) members.find(member => member.passengerId === item.passengerId).status = item.status; alreadyProcessed = true; }
        return json(group());
      }
      if (path.endsWith('/attendance/finalize')) finalized = true;
      if (path.includes('/attendance')) return json({ tripId, boatName: trip.vesselName, registrationNumber: trip.registrationNumber,
        scheduledDepartureUtc: scheduled, tripStatus: 'Scheduled', finalizedAtUtc: finalized ? scheduled : null,
        summary: { present: members.filter(m => m.status === 'Present').length, notPresent: 0, notChecked: members.filter(m => m.status === 'NotChecked').length, total: 2 }, passengers: members });
      return json([]);
    });
  }
  await context.addInitScript(rows => {
    window.BarcodeDetector = undefined;
    window.__cameraCalls = []; window.__streams = []; window.__cameraMode = 'denied';
    window.__qrCanvas = () => {
      const canvas = document.createElement('canvas'); canvas.width = rows[0].length; canvas.height = rows.length;
      const ctx = canvas.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.fillStyle = '#000';
      rows.forEach((row, y) => row.forEach((pixel, x) => { if (pixel) ctx.fillRect(x, y, 1, 1); }));
      return canvas;
    };
    if (!navigator.mediaDevices) Object.defineProperty(navigator, 'mediaDevices', { value: {}, configurable: true });
    navigator.mediaDevices.getUserMedia = async constraints => {
      window.__cameraCalls.push(constraints);
      if (window.__cameraMode === 'denied') throw new DOMException('Denied in test', 'NotAllowedError');
      if (window.__cameraMode === 'missing') throw new DOMException('No camera in test', 'NotFoundError');
      if (window.__cameraMode === 'busy') throw new DOMException('Camera busy in test', 'NotReadableError');
      const canvas = window.__qrCanvas();
      if (window.__cameraMode === 'blank' || window.__cameraMode === 'late') canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
      const stream = canvas.captureStream(10); window.__streams.push(stream);
      if (window.__cameraMode === 'late') await new Promise(resolve => setTimeout(resolve, 500));
      return stream;
    };
  }, pixels);
  const page = await context.newPage();
  page.on('pageerror', error => { errors.push(error.message); if (process.env.SHORE_DEBUG) console.error('PAGE ERROR', page.url(), error.stack); });
  // Let initial requests finish before full document navigation. Windows WebKit
  // otherwise reports aborted document requests as access-control page errors.
  const goto = async url => { await page.goto(url); await page.waitForLoadState('networkidle'); };
  const checkLayout = async () => {
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'No horizontal page overflow');
    const clipped = await page.evaluate(() => [...document.querySelectorAll('main button, main input, main select, dialog[open] button, dialog[open] input')].filter(el => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && (r.left < -1 || r.right > innerWidth + 1);
    }).map(el => ({ label: el.getAttribute('aria-label') || el.textContent?.slice(0, 60), width: el.getBoundingClientRect().width, left: el.getBoundingClientRect().left, right: el.getBoundingClientRect().right })));
    if (clipped.length) await page.screenshot({ path: '.runlogs/shore-overflow.png', fullPage: true });
    assert.deepEqual(clipped, [], `Controls fit ${page.url()} at ${page.viewportSize().width}px`);
  };
  const openScanner = async () => {
    await page.getByRole('button', { name: 'Scan Passenger QR', exact: true }).click();
    await page.getByRole('dialog', { name: 'Scan Passenger QR', exact: true }).waitFor();
  };
  const dialog = page.getByRole('dialog', { name: 'Scan Passenger QR', exact: true });
  const closeScanner = async () => { await dialog.getByRole('button', { name: 'Close Scan Passenger QR', exact: true }).click(); };
  try {
    if (!live && !process.env.SHORE_SKIP_LAYOUT) {
      for (const [width, height] of [[320, 568], [375, 812], [430, 932], [768, 1024], [1024, 768], [1440, 900]]) {
        await page.setViewportSize({ width, height });
        for (const path of ['/shore', '/shore/trips', `/shore/trips/${tripId}`, '/shore/settings', '/shore/notifications']) {
          await goto(base + path);
          await page.locator('main').waitFor();
          if (path.includes(tripId)) await page.getByRole('heading', { name: 'Passenger Attendance', exact: true }).waitFor();
          await checkLayout();
        }
        assert.equal(await page.evaluate(() => window.__cameraCalls.length), 0, 'No camera request before Scan QR');
      }
    }
    await page.setViewportSize({ width: 375, height: 812 });
    await goto(`${base}/shore/trips/${tripId}`);
    await page.getByRole('button', { name: 'Scan Passenger QR', exact: true }).waitFor();
    const png = Buffer.from((await page.evaluate(() => window.__qrCanvas().toDataURL('image/png'))).split(',')[1], 'base64');
    await openScanner();
    await dialog.getByRole('alert').filter({ hasText: 'Camera permission was denied' }).waitFor().catch(async error => {
      console.error({ errors, dialog: await dialog.innerText(), camera: await page.evaluate(() => ({ calls: window.__cameraCalls.length, secure: window.isSecureContext, media: !!navigator.mediaDevices })) });
      throw error;
    });
    await page.setViewportSize({ width: 320, height: 360 });
    await dialog.getByLabel('passenger QR value', { exact: false }).scrollIntoViewIfNeeded();
    await checkLayout();
    const modalBounds = await dialog.boundingBox();
    assert(modalBounds && modalBounds.y >= 0 && modalBounds.height <= 344, 'Scanner remains scrollable within a narrow, keyboard-sized viewport');
    await page.setViewportSize({ width: 375, height: 812 });
    await checkLayout();
    await dialog.getByLabel('Upload QR image').setInputFiles({ name: 'passenger-qr.png', mimeType: 'image/png', buffer: png });
    await dialog.waitFor({ state: 'hidden' });
    await page.getByRole('status').filter({ hasText: 'QR validated.' }).waitFor().catch(async error => {
      console.error({ errors, scans, saves, url: page.url(), body: (await page.locator('body').innerText()).slice(0, 1400) });
      throw error;
    });
    if (!live) { assert.equal(scans, 1); assert.equal(saves, 0, 'Decoding never marks attendance'); }
    const member = page.locator('article').filter({ hasText: live ? 'Passenger One' : 'Primary Passenger' });
    await member.getByRole('button', { name: 'Present', exact: true }).click();
    await page.getByRole('button', { name: 'Confirm Attendance', exact: true }).click();
    const review = page.getByRole('dialog', { name: 'Confirm Group Attendance', exact: true });
    await review.waitFor(); await checkLayout();
    await review.getByRole('button', { name: 'Confirm & Save' }).click();
    await page.getByRole('status').filter({ hasText: 'Passenger attendance saved successfully.' }).waitFor();
    if (!live) assert.equal(saves, 1, 'Only one attendance update');
    await openScanner();
    await dialog.getByLabel('passenger QR value', { exact: false }).fill(qrValue);
    await dialog.locator('form').evaluate(form => { form.requestSubmit(); form.requestSubmit(); });
    await dialog.waitFor({ state: 'hidden' });
    await page.getByRole('status').filter({ hasText: 'already been checked' }).waitFor();
    await page.getByLabel('Search registered passengers').fill(live ? 'Passenger' : 'Primary');
    await page.getByRole('button', { name: /passengers · Checked/ }).click();
    await page.getByRole('status').filter({ hasText: 'already been checked' }).waitFor();
    if (live) {
      assert.deepEqual(errors, []);
      console.log(`PASS ${engine} live API/SQL: real QR image decode, trip validation, confirmed attendance save, already checked state, authorized manual lookup`);
      return;
    }
    await openScanner();
    await dialog.getByLabel('passenger QR value', { exact: false }).fill('not-a-passenger-qr');
    await dialog.getByRole('button', { name: 'Validate QR' }).click();
    await dialog.getByRole('alert').filter({ hasText: 'Invalid passenger QR code.' }).waitFor();
    assert.equal(saves, 1);
    await closeScanner();
    for (const [mode, message] of [['missing', 'No camera is available'], ['busy', 'The camera is busy']]) {
      await page.evaluate(mode => { window.__cameraMode = mode; }, mode);
      await openScanner(); await dialog.getByRole('alert').filter({ hasText: message }).waitFor(); await closeScanner();
    }
    if (await page.evaluate(() => typeof HTMLCanvasElement.prototype.captureStream === 'function')) {
      await page.evaluate(() => { window.__cameraMode = 'blank'; });
      await openScanner(); await dialog.getByRole('status').filter({ hasText: 'Scanning…' }).waitFor();
      await dialog.getByRole('button', { name: 'Stop camera' }).click();
      assert(await page.evaluate(() => window.__streams.every(s => s.getTracks().every(t => t.readyState === 'ended'))), 'Stop releases streams');
      await page.evaluate(() => { window.__cameraMode = 'frames'; });
      const before = scans;
      await dialog.getByRole('button', { name: 'Start camera' }).click();
      await dialog.waitFor({ state: 'hidden' });
      assert.equal(scans, before + 1, 'Repeated frames generate one verification request');
      assert(await page.evaluate(() => window.__streams.every(s => s.getTracks().every(t => t.readyState === 'ended'))), 'Successful decode releases streams');
      assert(await page.evaluate(() => window.__cameraCalls.every(c => c.audio === false && c.video.facingMode.ideal === 'environment')), 'Rear camera is preferred');
      await page.evaluate(() => { window.__cameraMode = 'late'; });
      const callCount = await page.evaluate(() => window.__cameraCalls.length);
      await openScanner();
      await page.waitForFunction(count => window.__cameraCalls.length > count, callCount);
      await closeScanner();
      await page.waitForTimeout(650);
      assert(await page.evaluate(() => window.__streams.every(s => s.getTracks().every(t => t.readyState === 'ended'))), 'Late permission response is released after close');
      await page.evaluate(() => { window.__cameraMode = 'blank'; });
      await openScanner(); await dialog.getByRole('status').filter({ hasText: 'Scanning…' }).waitFor();
      await page.evaluate(() => { history.pushState(null, '', '/shore'); dispatchEvent(new PopStateEvent('popstate')); });
      await page.getByRole('heading', { name: /shore-test/i }).waitFor();
      assert(await page.evaluate(() => window.__streams.every(s => s.getTracks().every(t => t.readyState === 'ended'))), 'Unmount releases streams');
      console.log(`PASS ${engine} synthetic camera: rear preference, repeated-frame deduplication, stop/restart, decode/close/unmount cleanup and late-permission cleanup`);
    } else console.log(`NOTE ${engine}: canvas camera streams unavailable; hardware cleanup cases require Chromium or physical-device testing.`);
    await goto(`${base}/shore/trips/${tripId}`);
    const blankPng = Buffer.from((await page.evaluate(() => { const c = document.createElement('canvas'); c.width = c.height = 200; c.getContext('2d').fillRect(0, 0, 200, 200); return c.toDataURL('image/png'); })).split(',')[1], 'base64');
    await openScanner();
    const beforeInvalidImage = scans;
    await dialog.getByLabel('Upload QR image').setInputFiles({ name: 'not-qr.png', mimeType: 'image/png', buffer: blankPng });
    await dialog.getByRole('alert').filter({ hasText: 'No readable QR code was found' }).waitFor();
    assert.equal(scans, beforeInvalidImage, 'Unreadable image never reaches verification API');
    await closeScanner();
    await page.evaluate(() => { window.__savedGetUserMedia = navigator.mediaDevices.getUserMedia; navigator.mediaDevices.getUserMedia = undefined; });
    await openScanner();
    await dialog.getByRole('alert').filter({ hasText: 'This browser does not provide camera access' }).waitFor();
    await closeScanner();
    await page.evaluate(() => { navigator.mediaDevices.getUserMedia = window.__savedGetUserMedia; Object.defineProperty(document, 'permissionsPolicy', { configurable: true, value: { allowsFeature: () => false } }); });
    await openScanner();
    await dialog.getByRole('alert').filter({ hasText: 'permissions policy' }).waitFor();
    await closeScanner();
    await page.evaluate(() => { delete document.permissionsPolicy; });
    await openScanner();
    await dialog.getByRole('button', { name: 'Search passengers instead' }).click();
    await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === 'Search registered passengers');
    await page.getByRole('button', { name: 'Toggle navigation' }).click();
    await page.getByRole('navigation', { name: 'Shore Officer mobile navigation' }).getByRole('link', { name: 'Settings', exact: true }).click();
    await page.waitForURL(base + '/shore/settings');
    assert.equal(await page.getByRole('navigation', { name: 'Shore Officer mobile navigation' }).count(), 0);
    assert.deepEqual(errors, []);
    console.log(`PASS ${engine}: ${process.env.SHORE_SKIP_LAYOUT ? 'scanner-focused rerun' : 'all 5 Shore pages at 320/375/430/768/1024/1440px'}, QR PNG decode, manual validation/lookup, duplicate guards, simulated camera failures, responsive dialogs/navigation`);
  } finally { await context.close(); await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
