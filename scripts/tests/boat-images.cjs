// Run against Vite with Playwright installed: node scripts/tests/boat-images.cjs
// All API responses are mocked; this does not create or edit real accounts or boats.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const base = process.env.WWMS_WEB_URL || 'http://localhost:5173';
const boatId = '11111111-1111-1111-1111-111111111111';
const tripId = '22222222-2222-2222-2222-222222222222';
const userId = '33333333-3333-3333-3333-333333333333';
const documentId = version => `44444444-4444-4444-4444-${String(version).padStart(12, '0')}`;
const imageUrl = version => `/api/operations/boats/${boatId}/image/${documentId(version)}`;
const date = new Date(Date.now() + 86400000).toISOString();

async function main() {
  const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || undefined });
  try {
    const canvasPage = await browser.newPage();
    const images = await canvasPage.evaluate(() => [16, 24].map(size => {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = size;
      const context = canvas.getContext('2d');
      context.fillStyle = size === 16 ? '#ff0000' : '#0000ff';
      context.fillRect(0, 0, size, size);
      return canvas.toDataURL().split(',')[1];
    }));
    await canvasPage.close();
    const cases = [
      ['BoatOwner', '/owner'], ['BoatOwner', '/owner/boats'],
      ['BoatOwner', `/owner/boats/${boatId}`], ['BoatOwner', '/owner/trips'],
      ['BoatOwner', `/owner/trips/${tripId}`], ['BoatCrew', '/crew/trips'],
      ['BoatCrew', `/crew/trip-info/${tripId}`], ['Admin', '/admin/boats'],
      ['Admin', `/admin/boats/${boatId}`], ['Admin', '/admin/trips'],
      ['ShoreCrew', '/shore'], ['ShoreCrew', '/shore/trips'],
      ['ShoreCrew', `/shore/trips/${tripId}`], ['OPS', '/ops/trips'], ['OPS', '/ops/monitor'], ['OPS', `/ops/trip-info/${tripId}`],
      ['Wildlife', '/wildlife/boats'], ['Wildlife', `/wildlife/boats/${boatId}`],
      ['Wildlife', '/wildlife/trips'], ['ShoreWildlife', '/shore-wildlife'],
      ['ShoreWildlife', `/shore-wildlife/trips/${tripId}`],
    ];
    for (const [role, pathname] of cases) {
      if (process.env.WWMS_TEST_PATH && pathname !== process.env.WWMS_TEST_PATH) continue;
      const context = await browser.newContext();
      let version = 1;
      let authenticatedImages = 0;
      const sockets = new Set();
      const errors = [];
      const jwt = `e30.${Buffer.from(JSON.stringify({ sub: userId, email: 'image-test@example.test', role })).toString('base64url')}.test`;
      const document = () => ({ id: documentId(version), documentType: 'VesselPhotographOrDiagram',
        name: 'Color Aerial Photograph or Diagram of the Vessel', fileName: 'vessel.png',
        contentType: 'image/png', fileSize: 100, uploadedAtUtc: date, status: 'PendingReview',
        version, isCurrent: false, renewalState: 'PendingVerification' });
      const boat = () => ({ id: boatId, ownerId: userId, ownerName: 'Test Owner', name: 'Image Test Boat',
        registrationNumber: 'IMAGE-TEST', registrationDate: '2026-01-01', hullNumber: 'TEST-HULL',
        lengthMeters: 10, widthMeters: 4, maximumSpeedKnots: 20, maximumCapacity: 30, lifeJacketCount: 30,
        isPatrolBoat: false, approval: 'Approved', wildlifeApproval: 'Approved', imageUrl: version ? imageUrl(version) : null,
        documentRequirementsVersion: 2, registrationSubmittedAtUtc: date, documents: version ? [document()] : [] });
      const trip = { id: tripId, boatId, vesselName: 'Image Test Boat', registrationNumber: 'IMAGE-TEST',
        ownerName: 'Test Owner', scheduledDepartureUtc: date, route: 'Test Route', passengerCount: 0,
        type: 'WhaleWatching', status: 'Scheduled', updatedAtUtc: date, crew: [], hasActiveSos: false,
        rescheduleOverride: false };
      await context.addInitScript(() => sessionStorage.setItem('whale-watching-refresh-token', 'test'));
      await context.routeWebSocket('**/hubs/operations*', socket => {
        sockets.add(socket);
        socket.onMessage(message => { if (String(message).includes('"protocol"')) socket.send('{}\x1e'); });
        socket.onClose(() => sockets.delete(socket));
      });
      await context.route('**/hubs/operations/negotiate*', route => route.fulfill({ json: {
        negotiateVersion: 1, connectionId: 'test', connectionToken: 'test',
        availableTransports: [{ transport: 'WebSockets', transferFormats: ['Text', 'Binary'] }],
      } }));
      await context.route('**/api/**', async route => {
        const request = route.request();
        const path = new URL(request.url()).pathname;
        if (!path.startsWith('/api/')) return route.continue();
        const json = value => route.fulfill({ json: value });
        if (path === '/api/auth/refresh') return json({ accessToken: jwt, accessTokenExpiresAtUtc: date,
          refreshToken: 'test', refreshTokenExpiresAtUtc: date, roles: [role] });
        if (path.includes('/image/')) {
          assert.equal(request.headers().authorization, `Bearer ${jwt}`);
          authenticatedImages++;
          const requestedVersion = Number(path.slice(-12));
          return route.fulfill({ contentType: 'image/png', body: Buffer.from(images[requestedVersion - 1], 'base64') });
        }
        if (path.endsWith('/documents') && request.method() === 'POST') {
          assert.match(request.postDataBuffer().toString(), /VesselPhotographOrDiagram/);
          version = 2;
          return json(document());
        }
        if (path === '/api/operations/boats') return json([boat()]);
        if (path === '/api/operations/trips') return json([trip]);
        if (path === '/api/operations/directory') return json({ owners: [{ id: userId, displayName: 'Test Owner', email: 'test@example.test' }], crew: [] });
        if (path === '/api/operations/vessel-map') return json([{ ...boat(), latitude: 5.94, longitude: 80.46,
          trackerStatus: 'Online', certificationApproval: 'Approved', operationalStatus: 'Idle' }]);
        if (path === '/api/shore-wildlife/trips') return json([{ ...trip, boatName: trip.vesselName, registeredPassengers: 0, monitoringStatus: 'Draft', imageUrl: imageUrl(version) }]);
        if (path.startsWith('/api/shore-wildlife/trips/')) return json({ ...trip, tripId, boatName: trip.vesselName,
          tripStatus: trip.status, imageUrl: imageUrl(version), local: { adult: 0, child: 0, small: 0, total: 0 },
          foreign: { adult: 0, child: 0, small: 0, total: 0 }, totalPresent: 0, lastUpdatedUtc: date });
        if (path.endsWith('/attendance')) return json({ summary: { total: 0, present: 0, notPresent: 0, notChecked: 0 }, passengers: [] });
        if (path.endsWith('/tracking-summary')) return json({ tripId, boatId, status: 'NotStarted', route: [], stops: [] });
        if (path.endsWith('/route-history')) return json({ boatId, fromUtc: date, toUtc: date,
          trips: [], unassignedRoutes: [], summary: { totalDistance: 0, distanceUnit: 'km', totalTrips: 0,
            movingDurationSeconds: 0, stopsDurationSeconds: 0, averageSpeed: 0, speedUnit: 'knots' } });
        if (path.includes('/profile')) return route.fulfill({ status: 404, json: { message: 'Optional profile unavailable' } });
        return json([]);
      });
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(base + pathname);
      if (pathname === '/ops/monitor') {
        await page.locator('.maplibregl-marker').filter({ hasText: 'Image Test Boat' }).locator('svg').click();
      }
      const displayed = page.locator('img[src^="blob:"]').first();
      await displayed.waitFor({ state: 'visible', timeout: 20000 }).catch(async error => {
        console.error({ pathname, url: page.url(), errors, body: (await page.locator('body').innerText()).slice(0, 1400), authenticatedImages });
        throw error;
      });
      await page.waitForFunction(() => [...document.images].some(img => img.src.startsWith('blob:') && img.naturalWidth === 16));
      assert.ok(authenticatedImages > 0, `${pathname} should authenticate image requests`);
      if (pathname === `/owner/boats/${boatId}`) {
        const photoRow = page.locator('article').filter({ hasText: 'Color Aerial Photograph or Diagram of the Vessel' });
        await photoRow.locator('input[type=file]').setInputFiles({ name: 'replacement.png', mimeType: 'image/png', buffer: Buffer.from(images[1], 'base64') });
      } else {
        version = 2;
        for (const socket of sockets) socket.send(JSON.stringify({ type: 1, target: 'operationsChanged', arguments: [{ entity: 'boatDocument', boatId }] }) + '\x1e');
      }
      await page.waitForFunction(() => [...document.images].some(img => img.src.startsWith('blob:') && img.naturalWidth === 24), { timeout: 20000 });
      assert.deepEqual(errors, [], pathname);
      console.log(`PASS ${role} ${pathname}: authenticated image and live replacement`);
      if (pathname === '/owner') {
        version = 0;
        for (const socket of sockets) socket.send(JSON.stringify({ type: 1, target: 'operationsChanged', arguments: [{ entity: 'boat', id: boatId }] }) + '\x1e');
        await page.waitForFunction(() => ![...document.images].some(img => img.src.startsWith('blob:')));
        assert.ok(await page.locator('img[src="/boat-placeholder.svg"]').count());
        console.log('PASS no aerial photograph: placeholder');
      }
      await context.close();
    }
  } finally {
    await browser.close();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
