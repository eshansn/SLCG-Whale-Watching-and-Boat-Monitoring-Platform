// Run against Vite. API fixtures never modify the running database.
// Optional --live verifies an existing complaint using WWMS_TEST_EMAIL/PASSWORD.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const base = process.env.WWMS_WEB_URL || 'http://localhost:5173';
const id = '11111111-1111-1111-1111-111111111111';
const timestamp = new Date().toISOString();

async function main() {
  const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge' });
  try {
    if (process.argv.includes('--live')) {
      assert(process.env.WWMS_TEST_EMAIL && process.env.WWMS_TEST_PASSWORD, 'Live check requires test login credentials.');
      const context = await browser.newContext();
      try {
        const login = await context.request.post(`${base}/api/auth/login`, {
          data: { email: process.env.WWMS_TEST_EMAIL, password: process.env.WWMS_TEST_PASSWORD },
        });
        assert.equal(login.status(), 200, 'Live login');
        const auth = await login.json();
        const list = await context.request.get(`${base}/api/complaint-workflow`, { headers: { Authorization: `Bearer ${auth.accessToken}` } });
        assert.equal(list.status(), 200);
        const records = await list.json();
        assert(records.items.length > 0, 'Live check needs an existing complaint; it does not create records.');
        await context.addInitScript(token => {
          if (!sessionStorage.getItem('whale-watching-refresh-token')) sessionStorage.setItem('whale-watching-refresh-token', token);
        }, auth.refreshToken);
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        const authoritiesLoaded = () => page.waitForResponse(response => new URL(response.url()).pathname === '/api/complaint-workflow/authorities' && response.status() < 400).catch(() => null);
        const firstLoad = authoritiesLoaded();
        await page.goto(`${base}/${auth.roles.includes('Admin') ? 'admin' : 'sltda'}/complaints/${records.items[0].id}`);
        await page.getByRole('heading', { name: 'Handling timeline', exact: true }).waitFor();
        await page.getByRole('heading', { name: 'Review and coordinate', exact: true }).waitFor();
        assert(await firstLoad, `Authority request failed: ${page.url()}, errors: ${errors.join('; ')}`);
        await page.getByRole('heading', { name: 'Authority assignments', exact: true }).waitFor();
        assert.equal(await page.getByRole('checkbox', { name: /^(Admin|OPS)$/ }).count(), 0, 'Live selector hides internal roles');
        const slcg = page.getByRole('checkbox', { name: 'SLCG', exact: true });
        if (await slcg.count()) {
          await slcg.check();
          await page.getByText('Receiving authorities: SLCG', { exact: true }).waitFor();
        }
        const refreshed = authoritiesLoaded();
        await page.reload();
        assert(await refreshed, `Authority refresh failed: ${page.url()}, errors: ${errors.join('; ')}`);
        await page.getByRole('heading', { name: 'Handling timeline', exact: true }).waitFor();
        assert.deepEqual(errors, [], 'Opening and refreshing a real complaint must not crash');
        console.log('PASS live complaint: detail, SLCG authority display, and refresh; no record changes');
      } finally { await context.close(); }
      return;
    }

    for (const role of ['SLTDA', 'Admin']) {
      for (const grouped of [false, true]) {
        const context = await browser.newContext();
        try {
          const jwt = `e30.${Buffer.from(JSON.stringify({ sub: id, email: 'complaint-test@example.test', role })).toString('base64url')}.test`;
          const errors = [];
          let submitted;
          let assignedRoleIds = [];
          let inactiveOps = false;
          const authorities = grouped ? [
            { id: 'SLCG', name: 'SLCG', activeUsers: 2, roleIds: ['admin', 'ops'] },
            { id: 'wildlife', name: 'Wildlife', activeUsers: 1, roleIds: ['wildlife'] },
          ] : [
            { id: 'admin', name: 'Admin', activeUsers: 1 },
            { id: 'ops', name: 'OPS', activeUsers: 1 },
            { id: 'wildlife', name: 'Wildlife', activeUsers: 1 },
          ];
          authorities.push({ id: 'inactive', name: 'Inactive authority', activeUsers: 0 });
          await context.addInitScript(() => sessionStorage.setItem('whale-watching-refresh-token', 'test'));
          await context.routeWebSocket('**/hubs/operations*', socket => {
            socket.onMessage(message => { if (String(message).includes('"protocol"')) socket.send('{}\x1e'); });
          });
          await context.route('**/hubs/operations/negotiate*', route => route.fulfill({ json: {
            negotiateVersion: 1, connectionId: 'test', connectionToken: 'test',
            availableTransports: [{ transport: 'WebSockets', transferFormats: ['Text', 'Binary'] }],
          } }));
          await context.route('**/api/**', async route => {
            const path = new URL(route.request().url()).pathname;
            if (!path.startsWith('/api/')) return route.continue();
            const json = value => route.fulfill({ json: value });
            if (path === '/api/auth/refresh') return json({ accessToken: jwt, roles: [role], refreshToken: 'test',
              accessTokenExpiresAtUtc: new Date(Date.now() + 3600000).toISOString(), refreshTokenExpiresAtUtc: timestamp });
            if (path.endsWith('/unread-count')) return json({ unread: 0 });
            if (path.endsWith('/authorities')) return json(inactiveOps ? authorities.map(a => ({ ...a, activeUsers: a.name === 'OPS' || a.name === 'SLCG' ? 0 : a.activeUsers })) : authorities);
            if (path === '/api/complaint-workflow') return json({ items: [], total: 0, page: 1, pageSize: 20 });
            if (path.endsWith('/actions')) {
              submitted = route.request().postDataJSON();
              return json({ message: 'Complaint action recorded.' });
            }
            if (path === `/api/complaint-workflow/${id}`) return json({
              complaint: { id, reference: `WWMS-${id}`, kind: 'Complaint', type: 'Safety', message: 'Test complaint',
                version: id, status: 'Submitted', passengerId: id, passengerName: 'Test Passenger', tripId: id,
                boatName: 'Test boat', ownerName: 'Test Owner', registrationNumber: 'TEST', tripStatus: 'Completed',
                tripDate: timestamp, createdAtUtc: timestamp, updatedAtUtc: timestamp, evidence: [] },
              assignments: assignedRoleIds.map(authorityRoleId => ({ id: `assignment-${authorityRoleId}`, authorityRoleId, authority: grouped ? 'SLCG' : authorityRoleId === 'admin' ? 'Admin' : 'OPS', status: 'Responded',
                forwardedBy: 'Test Officer', forwardedAtUtc: timestamp, updatedAtUtc: timestamp, canRespond: false })),
              timeline: [], canMonitor: true, allowedStatuses: ['UnderReview'],
            });
            return json([]);
          });
          const page = await context.newPage();
          page.on('pageerror', error => errors.push(error.message));
          const pathname = `/${role.toLowerCase()}/complaints/${id}`;
          await page.goto(base + pathname);
          await page.getByRole('checkbox', { name: 'SLCG', exact: true }).waitFor().catch(async error => {
            console.error({ errors, url: page.url(), body: (await page.locator('body').innerText()).slice(0, 1800) });
            throw error;
          });
          assert.equal(await page.getByRole('checkbox', { name: 'SLCG', exact: true }).count(), 1, 'Only one SLCG recipient');
          assert.equal(await page.getByRole('checkbox', { name: /^(Admin|OPS)$/ }).count(), 0, 'Internal roles are hidden');
          assert.equal(await page.getByRole('checkbox', { name: 'Inactive authority' }).count(), 0, 'Inactive authority is excluded');
          await page.getByRole('checkbox', { name: 'SLCG', exact: true }).check();
          await page.getByText('Receiving authorities: SLCG', { exact: true }).waitFor();
          await page.getByRole('button', { name: 'Confirm forwarding', exact: true }).click();
          await page.getByRole('status').filter({ hasText: 'Complaint action recorded.' }).waitFor();
          assert.equal(submitted.action, 'forward');
          assert.deepEqual(submitted.authorityRoleIds, ['admin', 'ops'], 'One SLCG selection forwards to both roles');
          assert.equal(submitted.version, id);
          assert.match(submitted.requestId, /^[0-9a-f-]{36}$/);
          await page.reload();
          await page.getByRole('checkbox', { name: 'Wildlife', exact: true }).waitFor();
          assignedRoleIds = ['admin'];
          await page.reload();
          await page.getByRole('checkbox', { name: 'SLCG', exact: true }).check();
          await page.getByRole('button', { name: 'Confirm forwarding', exact: true }).click();
          await page.getByRole('status').filter({ hasText: 'Complaint action recorded.' }).waitFor();
          assert.deepEqual(submitted.authorityRoleIds, ['ops'], 'Complete a partial SLCG referral without duplicating an assignment');
          assert.equal(await page.locator('article strong').filter({ hasText: /^(Admin|OPS)$/ }).count(), 0, 'Legacy assignment labels use SLCG');
          assignedRoleIds = ['admin', 'ops'];
          await page.reload();
          await page.getByRole('checkbox', { name: 'Wildlife', exact: true }).waitFor();
          assert.equal(await page.getByRole('checkbox', { name: 'SLCG', exact: true }).count(), 0, 'Fully assigned SLCG is excluded');
          assignedRoleIds = [];
          inactiveOps = true;
          await page.reload();
          await page.getByRole('checkbox', { name: 'Wildlife', exact: true }).waitFor();
          assert.equal(await page.getByRole('checkbox', { name: 'SLCG', exact: true }).count(), 0, 'SLCG requires both receiving roles to be active');
          await page.setViewportSize({ width: 390, height: 844 });
          assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Mobile viewport fits');
          await page.getByRole('link', { name: 'Complaints and inquiries', exact: true }).click();
          await page.waitForURL(base + `/${role.toLowerCase()}/complaints`);
          assert.deepEqual(errors, [], 'No uncaught rendering errors');
          console.log(`PASS ${role}: ${grouped ? 'grouped' : 'legacy'} authorities, filtering, forwarding, refresh, mobile, back navigation`);
        } finally { await context.close(); }
      }
    }
  } finally { await browser.close(); }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
