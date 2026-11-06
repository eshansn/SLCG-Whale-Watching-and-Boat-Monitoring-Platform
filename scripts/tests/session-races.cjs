// Uses the real auth module through Vite; all authentication responses are fixtures.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const key = 'whale-watching-refresh-token';
const auth = user => ({ accessToken: `e30.${Buffer.from(JSON.stringify({ sub: user, email: `${user}@test.example`, role: 'BoatOwner' })).toString('base64url')}.test`, roles: ['BoatOwner'], refreshToken: `${user}-refresh`, accessTokenExpiresAtUtc: new Date(Date.now() + 3600000).toISOString(), refreshTokenExpiresAtUtc: new Date(Date.now() + 86400000).toISOString() });
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage();
    let release; let gate; let status = 200; let count = 0; let invalidLogin = false;
    const hold = () => { gate = new Promise(resolve => { release = resolve; }); };
    await page.route('**/api/auth/refresh', async route => { count++; await gate; await route.fulfill({ status, json: status === 200 ? auth('rotated') : {} }); });
    await page.route('**/api/auth/login', async route => { await gate; await route.fulfill({ json: invalidLogin ? { ...auth('invalid'), accessToken: 'invalid' } : auth('new-user') }); });
    await page.goto((process.env.WWMS_WEB_URL || 'http://localhost:5173') + '/login');
    await page.waitForLoadState('networkidle');
    await page.evaluate(async () => { window.authModule = await import('/src/auth/authApi.ts'); });
    const seed = () => page.evaluate(key => sessionStorage.setItem(key, 'seed-refresh'), key);
    const saved = () => page.evaluate(key => sessionStorage.getItem(key), key);

    hold(); await seed();
    let requested = page.waitForRequest(r => r.url().endsWith('/api/auth/refresh'));
    await page.evaluate(() => { window.pendingAuth = window.authModule.refreshSession(); }); await requested;
    await page.evaluate(() => window.authModule.clearSession()); release();
    await page.evaluate(() => window.pendingAuth);
    assert.equal(await saved(), null, 'Late refresh must not resurrect a logged-out session');

    hold(); await seed(); status = 401;
    requested = page.waitForRequest(r => r.url().endsWith('/api/auth/refresh'));
    await page.evaluate(() => { window.pendingAuth = window.authModule.refreshSession(); }); await requested;
    // Let a new login finish while the previous refresh remains held.
    const oldRelease = release; gate = undefined;
    await page.evaluate(() => window.authModule.login({ email: 'new-user@test.example', password: 'fixture-only' }));
    oldRelease(); await page.evaluate(() => window.pendingAuth);
    assert.equal(await saved(), 'new-user-refresh', 'An old 401 must not clear a newer login');

    hold(); await seed(); status = 200; count = 0;
    requested = page.waitForRequest(r => r.url().endsWith('/api/auth/refresh'));
    await page.evaluate(() => { window.pendingAuth = Promise.all([window.authModule.refreshSession(), window.authModule.refreshSession()]); }); await requested;
    release(); await page.evaluate(() => window.pendingAuth);
    assert.equal(count, 1, 'Concurrent refresh calls must share one token rotation');

    hold(); requested = page.waitForRequest(r => r.url().endsWith('/api/auth/login'));
    await page.evaluate(() => { window.pendingAuth = window.authModule.login({ email: 'new-user@test.example', password: 'fixture-only' }).catch(() => null); }); await requested;
    await page.evaluate(() => window.authModule.clearSession()); release(); await page.evaluate(() => window.pendingAuth);
    assert.equal(await saved(), null, 'Late login must respect logout');

    gate = undefined; invalidLogin = true; await seed();
    await page.evaluate(() => window.authModule.login({ email: 'invalid@test.example', password: 'fixture-only' }).catch(() => null));
    assert.equal(await saved(), 'seed-refresh', 'Invalid access tokens must not replace a valid saved session');
    console.log('PASS auth races: late refresh/login after logout, stale 401 after new login, shared refresh rotation, invalid response storage.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
