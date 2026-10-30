// Browser regression fixtures are isolated from the running API/database.
// WWMS_TRACKING_TRIP_ID selects a live, disposable SQL/API harness check instead.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const base = (process.env.WWMS_WEB_URL || 'http://localhost:5173').replace(/\/$/, '');
const boatId = '22222222-2222-2222-2222-222222222222';
const userId = '33333333-3333-3333-3333-333333333333';
const start = '2026-01-01T02:00:00Z';
const end = '2026-01-01T03:00:00Z';
const point = (latitude, longitude, recordedAtUtc) => ({ latitude, longitude, recordedAtUtc });
const route = [point(5.95, 80.4, start), point(5.96, 80.42, '2026-01-01T02:30:00Z'), point(5.98, 80.45, end)];
const blankStyle = { version: 8, sources: {}, layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#e8eef5' } }] };

async function main() {
  const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge' });
  try {
    if (process.env.WWMS_TRACKING_TRIP_ID) {
      const context = await browser.newContext();
      try {
        const response = await context.request.post(`${base}/api/auth/login`, { data: {
          email: 'sltda@complaint-test.example', password: 'BrowserTest#2026!Only',
        } });
        assert.equal(response.status(), 200);
        const auth = await response.json();
        await context.addInitScript(token => {
          if (!sessionStorage.getItem('whale-watching-refresh-token')) sessionStorage.setItem('whale-watching-refresh-token', token);
        }, auth.refreshToken);
        // Only basemap graphics are stubbed. GPS, passengers, login and authorization use live APIs.
        await context.route('https://basemaps.cartocdn.com/**', r => r.fulfill({ json: blankStyle }));
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', e => errors.push(e.message));
        await page.goto(`${base}/sltda/monitoring-trips/${process.env.WWMS_TRACKING_TRIP_ID}`);
        const panel = page.getByRole('region', { name: 'Trip GPS history' });
        await panel.getByText('Start', { exact: true }).waitFor();
        await panel.getByText('End', { exact: true }).waitFor();
        await panel.getByText('1h 0m 0s', { exact: true }).waitFor();
        await panel.getByText('5.95000, 80.40000', { exact: true }).waitFor();
        await panel.getByText('5.98000, 80.45000', { exact: true }).waitFor();
        await page.getByRole('link', { name: /Passenger One/ }).getByLabel('Sri Lanka flag').waitFor();
        assert.deepEqual(errors, []);
        console.log('PASS live SLTDA: authenticated trip GPS route, start/end, recorded duration, participant flag');
      } finally { await context.close(); }
      return;
    }
    const context = await browser.newContext();
    const errors = [];
    let failures = true;
    const counts = new Map();
    const jwt = `e30.${Buffer.from(JSON.stringify({ sub: userId, email: 'test@example.test', role: 'SLTDA' })).toString('base64url')}.test`;
    const participants = ['LK', ' ru ', 'de', 'CN', 'France', null, 'ZZ'].map((countryCode, index) => ({
      passengerId: `p${index}`, name: `Passenger ${index}`, countryCode, registeredAtUtc: start, attendance: 'Present',
    }));
    const trip = id => ({ id, boatId, boatName: `Boat ${id}`, registrationNumber: 'TEST', ownerName: 'Operator', route: 'Whale watching',
      scheduledDepartureUtc: start, actualDepartureUtc: id === 'scheduled' ? null : start,
      actualArrivalUtc: ['ongoing', 'scheduled', 'missing-end'].includes(id) ? null : end,
      status: id === 'ongoing' ? 'Ongoing' : id === 'scheduled' ? 'Scheduled' : 'Completed', registeredPassengers: 21 });
    const summary = id => ({ tripId: id, boatId, status: id === 'ongoing' ? 'Active' : 'Completed', startedAtUtc: start, endedAtUtc: end,
      routeLength: 6.48, routeLengthUnit: 'km', speedUnit: 'knots', stops: [],
      // Deliberately unrelated current boat position must never become a historical endpoint.
      currentPosition: point(50, 100, '2026-02-01T00:00:00Z'),
      route: id === 'empty' ? [] : id === 'single' ? [route[0]] : id === 'invalid' ? [
        ...route.toReversed(), point(91, 80, start), point(null, 80, start), point(5, 181, start), point(5, 80, 'invalid'),
        point(5, 80, '2025-12-31T00:00:00Z'), point(5, 80, '2026-01-01T04:00:00Z'),
      ] : route.toReversed(),
    });
    await context.addInitScript(() => sessionStorage.setItem('whale-watching-refresh-token', 'test'));
    await context.route('https://basemaps.cartocdn.com/**', r => r.fulfill({ json: blankStyle }));
    await context.routeWebSocket('**/hubs/operations*', socket => {
      socket.onMessage(message => { if (String(message).includes('"protocol"')) socket.send('{}\x1e'); });
    });
    await context.route('**/hubs/operations/negotiate*', r => r.fulfill({ json: {
      negotiateVersion: 1, connectionId: 'test', connectionToken: 'test', availableTransports: [{ transport: 'WebSockets', transferFormats: ['Text', 'Binary'] }],
    } }));
    await context.route('**/api/**', async r => {
      const url = new URL(r.request().url());
      const path = url.pathname;
      if (!path.startsWith('/api/')) return r.continue();
      const json = value => r.fulfill({ json: value });
      if (path === '/api/auth/refresh') return json({ accessToken: jwt, roles: ['SLTDA'], refreshToken: 'test',
        accessTokenExpiresAtUtc: new Date(Date.now() + 3600000).toISOString(), refreshTokenExpiresAtUtc: end });
      if (path.endsWith('/unread-count')) return json({ unread: 0 });
      if (path.startsWith('/api/passenger-monitoring/trips/')) {
        const id = path.split('/')[4];
        if (path.endsWith('/tracking-summary')) {
          counts.set(id, (counts.get(id) || 0) + 1);
          if (id === 'failure' && failures) return r.fulfill({ status: 503, json: { message: 'GPS temporarily unavailable.' } });
          if (id === 'loading') await new Promise(resolve => setTimeout(resolve, 500));
          return json(id === 'mismatch' ? { ...summary(id), boatId: 'wrong-boat' } : summary(id));
        }
        return json({ trip: trip(id), participants: { items: participants, total: 21, page: Number(url.searchParams.get('page') || 1), pageSize: 20 } });
      }
      if (path === '/api/passenger-monitoring/passengers') return json({ items: participants.map(p => ({ ...p, id: p.passengerId,
        passengerType: p.countryCode == null ? 'local' : 'foreign', identificationNumber: 'TEST', phoneNumber: '', createdAtUtc: start, tripCount: 1, complaintCount: 0, inquiryCount: 0 })), total: 21, page: 1, pageSize: 20 });
      return json([]);
    });
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(e.message));
    const navigate = async id => {
      await page.evaluate(pathname => { history.pushState(null, '', pathname); dispatchEvent(new PopStateEvent('popstate')); }, `/sltda/monitoring-trips/${id}`);
      await page.getByRole('heading', { name: `Boat ${id}`, exact: true }).waitFor();
    };
    const panel = page.getByRole('region', { name: 'Trip GPS history' });
    await page.goto(`${base}/sltda/monitoring-trips/completed`);
    await panel.getByText('Start', { exact: true }).waitFor();
    await panel.getByText('End', { exact: true }).waitFor();
    await panel.getByText('1h 0m 0s', { exact: true }).waitFor();
    await panel.getByText('5.95000, 80.40000', { exact: true }).waitFor();
    await panel.getByText('5.98000, 80.45000', { exact: true }).waitFor();
    assert.equal(await panel.getByText('Boat completed', { exact: true }).count(), 0, 'No current-boat marker on completed route');
    assert.equal(await page.locator('canvas.maplibregl-canvas').count(), 1);
    for (const [index, country] of ['Sri Lanka', 'Russia', 'Germany', 'China', 'France'].entries()) {
      await page.getByRole('link', { name: new RegExp(`Passenger ${index}`) }).getByLabel(`${country} flag`).waitFor();
    }
    for (const index of [5, 6]) await page.getByRole('link', { name: new RegExp(`Passenger ${index}`) }).getByLabel('Country not recorded').waitFor();
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await page.getByText('21 records · Page 2 of 2', { exact: true }).waitFor();
    assert.equal(counts.get('completed'), 1, 'Pagination reuses the GPS request');
    await navigate('ongoing');
    await panel.getByText('Start', { exact: true }).waitFor();
    await panel.getByText('Boat ongoing', { exact: true }).waitFor();
    assert.equal(await panel.getByText('End', { exact: true }).count(), 0, 'Ongoing trips have no final endpoint');
    await panel.getByText('In progress', { exact: true }).waitFor();
    for (const id of ['empty', 'scheduled', 'missing-end']) {
      await navigate(id);
      await panel.getByRole('status').filter({ hasText: 'No GPS tracker installed' }).waitFor();
      assert.equal(await panel.locator('canvas.maplibregl-canvas').count(), 1, 'Empty trips keep an interactive basemap');
      assert.equal(await panel.locator('.maplibregl-marker').count(), 0, 'No invented positions or routes');
      const bounds = await panel.locator('canvas.maplibregl-canvas').boundingBox();
      assert(bounds && bounds.height >= 360, 'Empty map has a visible viewport');
      await panel.getByRole('button', { name: 'Zoom in', exact: true }).click();
    }
    await navigate('single');
    await panel.getByText('Only one GPS point is available. A route cannot be drawn yet.', { exact: true }).waitFor();
    await navigate('invalid');
    await panel.getByText('5.95000, 80.40000', { exact: true }).waitFor();
    await panel.getByText('5.98000, 80.45000', { exact: true }).waitFor();
    await panel.getByText('End', { exact: true }).waitFor();
    await navigate('failure');
    await panel.getByRole('alert').filter({ hasText: 'GPS temporarily unavailable.' }).waitFor();
    failures = false;
    await panel.getByRole('button', { name: 'Retry GPS route' }).click();
    await panel.getByText('End', { exact: true }).waitFor();
    await navigate('mismatch');
    await panel.getByRole('alert').filter({ hasText: 'Tracking information does not match this trip.' }).waitFor();
    await navigate('loading');
    await panel.getByRole('status').filter({ hasText: 'Loading GPS route' }).waitFor();
    await panel.getByText('End', { exact: true }).waitFor();
    await page.setViewportSize({ width: 390, height: 844 });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await page.goto(`${base}/sltda/passengers`);
    await page.getByRole('link', { name: /Passenger 1$/, exact: true }).getByLabel('Russia flag').waitFor();
    const missingCountry = page.getByRole('row').filter({ hasText: 'Passenger 5' });
    await missingCountry.getByLabel('Country not recorded').waitFor();
    assert.equal(await missingCountry.locator('img').count(), 0, 'No nationality is inferred from local classification');
    await page.getByLabel('Search passengers').fill('Passenger');
    await page.waitForURL(url => url.searchParams.get('search') === 'Passenger');
    await page.getByLabel('Country code', { exact: true }).fill('RU');
    await page.waitForURL(url => url.searchParams.get('country') === 'RU');
    await page.getByLabel('Sort passengers').selectOption('name');
    await page.waitForURL(url => url.searchParams.get('sort') === 'name');
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await page.waitForURL(url => url.searchParams.get('page') === '2');
    assert.deepEqual(errors, []);
    console.log('PASS SLTDA map: completed/ongoing/empty/one/invalid/missing-end/mismatched trips, errors/retry/loading, navigation, GPS request reuse, mobile');
    console.log('PASS flags: LK/RU/DE/CN/FR, missing/invalid fallback, trip and monitoring lists, search/filter/sort/pagination');
    await context.close();
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
