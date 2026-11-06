// Vite browser checks with delayed fixture responses; no real user data is changed.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const baseURL = process.env.WWMS_WEB_URL || 'http://localhost:5173';
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const failures = [];
  try {
    for (const check of [crewSearch, transferSelection]) {
      try { await check(browser); console.log(`PASS ${check.name}`); }
      catch (error) { failures.push(`${check.name}: ${error.message}`); }
    }
    assert.deepEqual(failures, []);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

async function crewSearch(browser) {
  const context = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 } });
  try {
    const page = await context.newPage(); let release;
    const slow = new Promise(resolve => { release = resolve; });
    const token = `e30.${Buffer.from(JSON.stringify({ sub: 'owner-test', email: 'owner@test.example', role: 'BoatOwner' })).toString('base64url')}.test`;
    await context.addInitScript(() => sessionStorage.setItem('whale-watching-refresh-token', 'fixture'));
    await page.route('**/api/**', async route => {
      const url = new URL(route.request().url()); const p = url.pathname;
      if (!p.startsWith('/api/')) return route.continue();
      if (p === '/api/auth/refresh') return route.fulfill({ json: { accessToken: token, roles: ['BoatOwner'], refreshToken: 'fixture', accessTokenExpiresAtUtc: new Date(Date.now() + 3600000).toISOString() } });
      if (p.endsWith('/owner/crew/search')) {
        const old = url.searchParams.get('query') === 'old'; if (old) await slow;
        return route.fulfill({ json: [{ crewUserId: old ? 'old' : 'new', name: old ? 'Old crew suggestion' : 'New crew suggestion', email: old ? 'old@test.example' : 'new@test.example', position: 'Crew Member' }] });
      }
      return route.fulfill({ json: p.endsWith('/owner/crew') ? [{ assignmentId: 'a', crewUserId: 'c', name: 'Existing crew', position: 'Captain', email: 'existing@test.example', certified: true }] : [] });
    });
    await page.goto('/owner/crew');
    const input = page.getByPlaceholder('Enter certified crew member email'); await input.waitFor();
    const requested = page.waitForRequest(request => request.url().includes('/owner/crew/search?query=old'));
    await input.fill('old'); await requested;
    await input.fill('new'); await page.getByText('New crew suggestion', { exact: true }).waitFor();
    const replied = page.waitForResponse(response => response.url().includes('/owner/crew/search?query=old'));
    release(); await replied; await page.waitForTimeout(100);
    assert.equal(await page.getByText('Old crew suggestion', { exact: true }).count(), 0, 'A stale query must not replace current suggestions');
    await input.fill('');
    assert.equal(await page.getByText('New crew suggestion', { exact: true }).count(), 0);
    const table = page.getByRole('region', { name: 'Current crew members' });
    await table.hover(); await page.mouse.wheel(600, 0); await page.waitForTimeout(150);
    assert.ok(await table.evaluate(el => el.scrollLeft > 0), 'Mobile crew table actions must be reachable by horizontal scrolling');
    await page.getByRole('button', { name: 'View Existing crew information' }).click();
    await page.getByRole('dialog', { name: 'Crew member information' }).waitFor();
  } finally { await context.close(); }
}

async function transferSelection(browser) {
  const page = await browser.newPage({ baseURL }); let release;
  try {
    const slow = new Promise(resolve => { release = resolve; });
    const trip = boat => ({ id: `trip-${boat}`, boatName: `Boat ${boat}`, registrationNumber: boat, ownerName: 'Test Owner', scheduledDepartureUtc: new Date(Date.now() + 86400000).toISOString(), passengerCount: 0, maximumCapacity: 20, crewCount: 0, status: 'Scheduled' });
    await page.route('**/api/operations/transfers/**', async route => {
      const p = new URL(route.request().url()).pathname;
      if (p.includes('/source/')) return route.fulfill({ json: { source: trip('source'), passengers: [], crew: [] } });
      if (p.endsWith('/destination-boats')) return route.fulfill({ json: ['A', 'B'].map(id => ({ id, name: `Boat ${id}`, registrationNumber: id, status: 'Approved', ownerName: 'Test Owner' })) });
      if (p.endsWith('/A/trips')) await slow;
      return route.fulfill({ json: [trip(p.endsWith('/A/trips') ? 'A' : 'B')] });
    });
    await page.goto('/login'); await page.waitForLoadState('networkidle');
    await page.evaluate(async () => {
      const reactModule = await import('/node_modules/.vite/deps/react.js');
      const React = reactModule.default ?? reactModule;
      const client = await import('/node_modules/.vite/deps/react-dom_client.js');
      const { createRoot } = client.default ?? client;
      const { default: Modal } = await import('/src/screens/BoatOwner/TripTransferModal.tsx');
      const host = document.createElement('div'); document.body.append(host);
      createRoot(host).render(React.createElement(Modal, { token: 'fixture', sourceTripId: 'source', onClose() {}, onComplete() {} }));
    });
    const dialog = page.getByRole('dialog'); const search = dialog.locator('input').first();
    await search.fill('Boat');
    const requested = page.waitForRequest(request => request.url().includes('/A/trips'));
    await dialog.getByRole('button', { name: /Boat A/ }).click(); await requested;
    await dialog.getByRole('button', { name: 'Change boat', exact: true }).click();
    await search.fill('Boat'); await dialog.getByRole('button', { name: /Boat B/ }).click();
    await dialog.getByText('Trip trip-B', { exact: true }).waitFor();
    const replied = page.waitForResponse(response => response.url().includes('/A/trips'));
    release(); await replied; await page.waitForTimeout(100);
    assert.equal(await dialog.getByText('Trip trip-A', { exact: true }).count(), 0, 'A late response must not show another boat\'s trips');
    assert.equal(await dialog.getByText('Trip trip-B', { exact: true }).count(), 1);
  } finally { release?.(); await page.close(); }
}
