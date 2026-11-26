// Read-only deployment checks, with an optional real operations-account login.
const assert = require('node:assert/strict');
const base = (process.env.WWMS_WEB_URL || 'http://127.0.0.1:5173').replace(/\/$/, '');
async function request(path, status, options) {
  const response = await fetch(base + path, { ...options, signal: AbortSignal.timeout(15000) });
  assert.equal(response.status, status, path);
  return response;
}
async function websocket(token) {
  const url = new URL(base + '/hubs/operations');
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.searchParams.set('access_token', token);
  await new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    const timer = setTimeout(() => finish(new Error('SignalR handshake timed out')), 15000);
    let done = false;
    function finish(error) {
      if (done) return;
      done = true;
      clearTimeout(timer);
      socket.close();
      if (error) reject(error); else resolve();
    }
    socket.addEventListener('open', () => socket.send('{"protocol":"json","version":1}\x1e'));
    socket.addEventListener('message', event => {
      try { assert.deepEqual(JSON.parse(String(event.data).split('\x1e')[0]), {}); finish(); }
      catch { finish(new Error('SignalR handshake failed')); }
    });
    socket.addEventListener('error', () => finish(new Error('WebSocket connection failed')));
    socket.addEventListener('close', () => { if (!done) finish(new Error('WebSocket closed before handshake')); });
  });
}
(async () => {
  const home = await request('/', 200);
  assert.match(home.headers.get('content-type'), /text\/html/);
  const html = await home.text();
  for (const path of ['/login', '/shore/trips/docker-smoke'])
    assert.equal(await (await request(path, 200)).text(), html, 'SPA deep links use the built app');
  const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^"?#]+\.(?:js|css))"/g)].map(match => match[1]);
  assert.ok(assets.some(path => path.endsWith('.js')), 'Built JavaScript is referenced');
  assert.ok(assets.some(path => path.endsWith('.css')), 'Built CSS is referenced');
  for (const path of assets)
    assert.doesNotMatch((await request(path, 200)).headers.get('content-type'), /text\/html/);
  await request('/assets/docker-smoke-missing.js', 404);
  console.log('PASS frontend, built assets and refreshed portal URLs');
  for (const path of ['/health/live', '/health/ready'])
    assert.equal(await (await request(path, 200)).text(), 'Healthy');
  await request('/api/operations/boats', 401);
  await request('/api/admin/staff', 401);
  await request('/hubs/operations/negotiate?negotiateVersion=1', 401, { method: 'POST' });
  console.log('PASS database readiness, API proxy and realtime access control');
  const email = process.env.WWMS_TEST_EMAIL, password = process.env.WWMS_TEST_PASSWORD;
  assert.equal(Boolean(email), Boolean(password), 'Set both test credentials');
  if (email) {
    const auth = await (await request('/api/auth/login', 200, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }),
    })).json();
    assert.ok(auth.accessToken && auth.roles.length);
    await request('/api/operations/boats', 200, { headers: { Authorization: `Bearer ${auth.accessToken}` } });
    await websocket(auth.accessToken);
    console.log('PASS real login, authenticated data and SignalR WebSocket through the frontend');
  } else console.log('SKIP authenticated checks: set WWMS_TEST_EMAIL and WWMS_TEST_PASSWORD for an operations account');
  if (process.env.PLAYWRIGHT_MODULE) {
    const { chromium } = require(process.env.PLAYWRIGHT_MODULE);
    const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge', headless: true });
    try {
      const page = await browser.newPage(), errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(base + '/login');
      await page.locator('input[type="email"]').waitFor();
      await page.locator('input[type="password"]').waitFor();
      assert.deepEqual(errors, []);
      console.log('PASS built login page renders in the browser');
    } finally { await browser.close(); }
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
