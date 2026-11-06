// Delayed API fixtures only. Exercises the actual Zustand module served by Vite.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
(async () => {
  const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge', headless: true });
  try {
    const page = await browser.newPage();
    await page.goto((process.env.WWMS_WEB_URL || 'http://localhost:5173') + '/login');
    await page.evaluate(async () => { window.fleet = (await import('/src/screens/OPS/store/useDashboardStore.ts')).useDashboardStore; });
    const record = (lat, time) => ({ id: 'audit-boat', name: 'Audit boat', registrationNumber: 'AUDIT', latitude: lat,
      longitude: 80, coordinatesRecordedAtUtc: time, trackerStatus: 'Online' });
    const first = '2026-11-04T01:00:00Z', second = '2026-11-04T01:01:00Z', newest = '2026-11-04T01:02:00Z';
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    let requests = 0;
    await page.route('**/api/operations/vessel-map', async route => {
      const current = ++requests;
      if (current === 1) await gate;
      await route.fulfill({ json: [current === 1 ? record(6, first) : record(7, second)] });
    });
    let requested = page.waitForRequest(r => r.url().endsWith('/api/operations/vessel-map'));
    await page.evaluate(() => { window.oldFleet = window.fleet.getState().loadVessels('fixture'); }); await requested;
    await page.evaluate(() => window.fleet.getState().loadVessels('fixture'));
    release(); await page.evaluate(() => window.oldFleet);
    assert.equal(await page.evaluate(() => window.fleet.getState().vessels[0].lat), 7, 'An old fleet response must not replace a newer response');
    await page.evaluate(update => window.fleet.getState().applyGpsTelemetry(update), {
      boatId: 'audit-boat', latitude: 8, longitude: 80, recordedAtUtc: newest, receivedAtUtc: newest, trackerStatus: 'Online',
    });
    await page.evaluate(() => window.fleet.getState().loadVessels('fixture'));
    assert.equal(await page.evaluate(() => window.fleet.getState().vessels[0].lat), 8, 'A fleet snapshot must not undo more recent SignalR telemetry');
    await page.evaluate(update => window.fleet.getState().applyGpsTelemetry(update), {
      boatId: 'audit-boat', latitude: 6, longitude: 80, recordedAtUtc: first, receivedAtUtc: newest, trackerStatus: 'Online',
    });
    assert.equal(await page.evaluate(() => window.fleet.getState().vessels[0].lat), 8, 'Out-of-order telemetry must not move a vessel backwards');
    console.log('PASS fleet races: delayed snapshots, newer SignalR coordinates, out-of-order telemetry.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
