// Browser fixtures only: production dashboard APIs and business rules remain unchanged.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium, webkit } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const engine = process.env.PLAYWRIGHT_ENGINE === 'webkit' ? webkit : chromium;
const baseURL = process.env.WWMS_WEB_URL || 'http://localhost:5173';
const date = hours => new Date(Date.now() + hours * 3600000).toISOString();
const guid = n => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;

(async () => {
  const browser = await engine.launch(engine === chromium ? { channel: 'msedge', headless: true } : { headless: true });
  const failures = [];
  async function screenshot(page, label) {
    if (!process.env.WWMS_DASHBOARD_SCREENSHOTS) return;
    fs.mkdirSync(process.env.WWMS_DASHBOARD_SCREENSHOTS, { recursive: true });
    await page.screenshot({ path: path.join(process.env.WWMS_DASHBOARD_SCREENSHOTS, `${label}.png`), fullPage: true, animations: 'disabled' });
  }
  async function fixture(role) {
    const portal = role === 'BoatOwner' ? 'owner' : 'crew';
    const userId = portal === 'owner' ? guid(1) : guid(2);
    const context = await browser.newContext({ baseURL, viewport: { width: 1440, height: 960 } });
    const page = await context.newPage();
    page.on('pageerror', error => failures.push(`${portal}: ${error.message}`));
    const sockets = new Set(); const unexpected = []; let mode = 'normal'; let loading = false;
    const member = { crewUserId: guid(2), name: 'Ruwan Silva', position: 'Coxswain', certified: true };
    const boats = [1, 2, 3, 4].map((n, index) => ({ id: guid(n + 10), ownerId: guid(1), ownerName: 'Ayesha Perera', name: ['Ocean Pearl', 'Blue Horizon', 'Sea Venture', 'Coral Way'][index], registrationNumber: `SL-WW-${n}`, maximumCapacity: 40, lengthMeters: 15, widthMeters: 4, maximumSpeedKnots: 20, lifeJacketCount: 45, approval: 'Approved', wildlifeApproval: 'Approved', isPatrolBoat: false, documents: [], registrationDate: '2026-01-01', hullNumber: `H-${n}`, documentRequirementsVersion: 2 }));
    const makeTrip = (n, boat, status, hours) => ({ id: guid(n), boatId: boat.id, vesselName: boat.name, registrationNumber: boat.registrationNumber, ownerName: boat.ownerName, status, scheduledDepartureUtc: date(hours), updatedAtUtc: date(-1), route: 'Mirissa offshore route', passengerCount: 24, type: 'WhaleWatching', crew: [member], hasActiveSos: false, rescheduleOverride: false });
    const trips = [makeTrip(101, boats[1], 'Scheduled', 24), makeTrip(102, boats[1], 'Scheduled', 48), makeTrip(103, boats[2], 'Ongoing', -1), makeTrip(104, boats[0], 'Completed', -48), makeTrip(105, boats[0], 'Declined', -24), makeTrip(106, boats[1], 'NeedsReschedule', -20), makeTrip(107, boats[2], 'Scheduled', -.75)];
    const token = `e30.${Buffer.from(JSON.stringify({ sub: userId, email: `${portal}@dashboard-test.example`, role })).toString('base64url')}.test`;
    await context.addInitScript(() => sessionStorage.setItem('whale-watching-refresh-token', 'dashboard-fixture'));
    await context.routeWebSocket('**/hubs/operations*', socket => { sockets.add(socket); socket.onMessage(message => { if (String(message).includes('"protocol"')) socket.send('{}\x1e'); }); socket.onClose(() => sockets.delete(socket)); });
    await context.route('**/hubs/operations/negotiate*', route => route.fulfill({ json: { negotiateVersion: 1, connectionId: 'dashboard', connectionToken: 'dashboard', availableTransports: [{ transport: 'WebSockets', transferFormats: ['Text', 'Binary'] }] } }));
    await context.route('**/api/**', async route => {
      const p = new URL(route.request().url()).pathname;
      if (!p.startsWith('/api/')) return route.continue(); // Vite also serves /src/api modules.
      const json = data => route.fulfill({ json: data });
      if (p === '/api/auth/refresh') return json({ accessToken: token, accessTokenExpiresAtUtc: date(24), refreshToken: 'dashboard-fixture', refreshTokenExpiresAtUtc: date(48), roles: [role] });
      if (p === `/api/${portal}/profile`) return json({ id: userId, displayName: role === 'BoatOwner' ? 'Ayesha Perera' : 'Ruwan Silva', userName: portal, email: `${portal}@dashboard-test.example`, hasProfilePhoto: false, certified: true, position: 'Coxswain' });
      if (p.endsWith('/profile/photo')) return route.fulfill({ status: 404 });
      if (p === '/api/operations/boats' || p === '/api/operations/trips') {
        while (loading) await new Promise(resolve => setTimeout(resolve, 20));
        if (mode === 'error') return route.fulfill({ status: 503, json: { title: 'Operations temporarily unavailable.' } });
        return json(mode === 'empty' ? [] : p.endsWith('boats') ? boats : trips);
      }
      // Existing destination screens may fetch their own data during navigation checks.
      if (p.startsWith('/api/operations/') || p.startsWith(`/api/${portal}/`)) return json([]);
      unexpected.push(p);
      return route.fulfill({ status: 404 });
    });
    const notify = () => { for (const socket of sockets) socket.send(JSON.stringify({ type: 1, target: 'operationsChanged', arguments: [{ entity: 'trip', id: guid(101) }] }) + '\x1e'); };
    return { context, page, portal, trips, unexpected, notify, setMode: value => { mode = value; }, setLoading: value => { loading = value; } };
  }

  try {
    // Compare the actual login whale with the reused dashboard SVG and animation.
    const login = await browser.newPage({ baseURL });
    await login.goto('/login');
    await login.locator('.ocean-auth-whale-outline').waitFor();
    const loginPath = await login.locator('.ocean-auth-whale-outline').getAttribute('d');
    const loginAnimation = await login.locator('.ocean-auth-whale').evaluate(el => getComputedStyle(el).animationName);
    await login.close();

    for (const role of ['BoatOwner', 'BoatCrew']) {
      const test = await fixture(role); const { page, portal } = test;
      test.setLoading(true); await page.goto(`/${portal}`);
      await page.getByText(portal === 'owner' ? 'Loading your boats\u2026' : 'Loading assignments\u2026', { exact: true }).waitFor();
      test.setLoading(false);
      await page.getByRole('heading', { name: portal === 'owner' ? 'Ayesha Perera' : 'Ruwan Silva', exact: true }).waitFor();
      if (portal === 'owner') {
        await page.getByRole('heading', { name: 'My Boats', exact: true }).waitFor();
        await page.getByRole('heading', { name: 'Ongoing Trips', exact: true }).waitFor();
        // The profile and static headings can render before the independently loaded operations data.
        await page.getByRole('button', { name: 'Open Ocean Pearl details', exact: true }).waitFor();
        assert.equal(await page.locator('[aria-label="My boats"] article').count(), 4);
        assert.equal(await page.getByRole('button', { name: 'Info', exact: true }).count(), 0); // Boat-specific accessible names retained.
        await page.getByRole('button', { name: 'View Sea Venture trip', exact: true }).waitFor();
      } else {
        await page.getByRole('heading', { name: 'Upcoming Trips', exact: true }).waitFor();
        // Preserve the original status calculation, including past/declined assignments.
        await page.getByText('5 scheduled', { exact: true }).waitFor();
        assert.equal(await page.locator('article').count(), 5);
        await page.getByRole('button', { name: /Ongoing Trip/ }).waitFor();
      }
      assert.equal(await page.locator('.ocean-auth-whale-outline').getAttribute('d'), loginPath);
      assert.equal(await page.locator('.ocean-auth-whale').evaluate(el => getComputedStyle(el).animationName), loginAnimation);
      assert.equal(await page.locator('.ocean-auth-whale').getAttribute('aria-hidden'), 'true');
      assert.equal(await page.locator('.ocean-dashboard, .recharts-wrapper').count(), 0);
      assert.equal(await page.getByRole('button', { name: /start trip/i }).count(), 0);

      for (const width of [360, 390, 430, 768, 1024, 1440, 1920]) {
        await page.setViewportSize({ width, height: 960 });
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${portal}: overflow at ${width}`);
        const columns = await page.locator(portal === 'owner' ? '[aria-label="My boats"]' : '.crew-dashboard-content').evaluate(el => getComputedStyle(el).gridTemplateColumns);
        if (portal === 'owner') assert.equal(columns.split(' ').length, width < 768 ? 1 : 2, `Original boat columns at ${width}`);
        else assert.ok(await page.locator('.crew-dashboard-content').evaluate(el => el.getBoundingClientRect().width <= 672), 'Original compact crew width');
        // The drawn whale stays clear of the profile, headings and header buttons.
        const clear = await page.locator('.ocean-auth-whale-outline').evaluate(el => {
          const whale = el.getBoundingClientRect();
          const controls = document.querySelectorAll('.ocean-polish header button, .owner-dashboard-welcome h1, .owner-dashboard-welcome p, .owner-dashboard-welcome img, .crew-dashboard-welcome');
          return [...controls].every(control => { const b = control.getBoundingClientRect(); return whale.right <= b.left || whale.left >= b.right || whale.bottom <= b.top || whale.top >= b.bottom; });
        });
        assert.equal(clear, true, `${portal}: whale obstructs content at ${width}`);
        if ([390, 1440].includes(width)) await screenshot(page, `${portal}-${width}`);
      }
      await page.setViewportSize({ width: 390, height: 844 });
      await page.getByRole('button', { name: 'Open menu', exact: true }).click();
      const menu = page.locator('aside'); await menu.waitFor();
      assert.equal(await page.evaluate(() => document.body.style.overflow), 'hidden');
      assert.deepEqual(await menu.locator('nav button').allTextContents(), portal === 'owner' ? ['Dashboard', 'Profile', 'My Crew', 'My Boats', 'My Trips', 'Settings'] : ['Dashboard', 'Profile', 'My Trips', 'Settings']);
      await menu.getByRole('button', { name: 'Close menu', exact: true }).click();
      assert.equal(await page.evaluate(() => document.body.style.overflow), '');

      // Original detail buttons still route to their existing screens.
      await page.getByRole('button', { name: portal === 'owner' ? 'Open Ocean Pearl details' : /Ongoing Trip/ }).click();
      await page.waitForURL(url => url.pathname === (portal === 'owner' ? `/owner/boats/${guid(11)}` : `/crew/trip-info/${guid(103)}`));
      await page.goto(`/${portal}`);
      await page.getByRole('heading', { name: portal === 'owner' ? 'Ayesha Perera' : 'Ruwan Silva', exact: true }).waitFor();
      // Existing notifications routing is preserved.
      await page.getByRole('button', { name: portal === 'owner' ? 'Open notifications' : 'Notifications', exact: true }).click();
      await page.waitForURL(url => url.pathname === `/${portal}/notifications`);
      await page.goto(`/${portal}`);
      await page.getByRole('heading', { name: portal === 'owner' ? 'Ayesha Perera' : 'Ruwan Silva', exact: true }).waitFor();

      test.trips.find(trip => trip.id === guid(103)).status = 'Completed'; test.notify();
      if (portal === 'owner') await page.getByRole('heading', { name: 'Schedule New Trips', exact: true }).waitFor();
      else await page.getByText('Your next active assignment will sail in here.', { exact: true }).waitFor();
      test.setMode('error'); test.notify();
      await page.getByText('Operations temporarily unavailable.', { exact: true }).waitFor();
      test.setMode('empty'); test.notify();
      if (portal === 'owner') {
        await page.getByRole('heading', { name: 'Register New Boats', exact: true }).waitFor();
        await page.getByRole('button', { name: 'Register Boat', exact: true }).waitFor();
        await page.getByRole('button', { name: 'Schedule Trip', exact: true }).waitFor();
      } else await page.getByText('No upcoming trips assigned.', { exact: true }).waitFor();
      await page.emulateMedia({ reducedMotion: 'reduce' });
      assert.equal(await page.locator('.ocean-auth-whale').evaluate(el => getComputedStyle(el).animationName), 'none');
      assert.equal(await page.locator('.ocean-auth-whale-outline').evaluate(el => getComputedStyle(el).strokeDashoffset), '0px');
      await screenshot(page, `${portal}-empty`);
      if (portal === 'crew') {
        await page.goto('/crew/trips');
        await page.getByRole('heading', { name: 'My Trips', exact: true }).waitFor();
        assert.equal(await page.locator('.ocean-polish, .ocean-auth-whale').count(), 0, 'Other crew screens retain their existing theme');
      }
      assert.deepEqual(test.unexpected, []);
      await test.context.close();
    }
    assert.deepEqual(failures, []);
    console.log('PASS: original layouts, login whale reuse, 7 viewport widths, unobstructed content, original actions/navigation, SignalR refresh, loading/error/empty states, reduced motion, other crew screens unchanged.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
