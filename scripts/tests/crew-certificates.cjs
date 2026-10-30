/* Uses the live controllers and disposable SQL database from the .NET browser fixture. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium, webkit } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

(async () => {
  const engine = process.env.PLAYWRIGHT_ENGINE === 'webkit' ? webkit : chromium;
  const browser = await engine.launch(engine === chromium ? { channel: 'msedge', headless: true } : { headless: true });
  const baseURL = process.env.WWMS_WEB_URL;
  const crewId = process.env.WWMS_CERTIFICATE_CREW_ID;
  assert.ok(baseURL && crewId);
  const errors = [];
  async function signedIn(role) {
    const context = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/login'); await page.waitForLoadState('networkidle');
    await page.locator('#login-email').fill(`${role.toLowerCase()}@complaint-test.example`);
    await page.locator('#login-password').fill('BrowserTest#2026!Only');
    await page.locator('#login-password').press('Tab');
    const response = page.waitForResponse(r => r.url().endsWith('/api/auth/login'));
    await page.getByRole('button', { name: 'Sign In', exact: true }).click();
    const session = await (await response).json();
    await page.waitForURL(url => url.pathname !== '/login');
    return { context, page, token: session.accessToken };
  }
  try {
    const admin = await signedIn('Admin');
    const detail = `/admin/crew/${crewId}`;
    await admin.page.goto(detail);
    await admin.page.getByText('Certificate Missing', { exact: true }).waitFor();
    await admin.page.getByText('Manual review required. Existing approval is retained.', { exact: true }).waitFor();
    assert.equal(await admin.page.getByRole('button', { name: 'Approve', exact: true }).isDisabled(), true);
    assert.equal(await admin.page.getByRole('button', { name: 'Decline', exact: true }).isEnabled(), true);
    for (const [id, status] of [[process.env.WWMS_UNAVAILABLE_CREW_ID, 'Unavailable'], [process.env.WWMS_INVALID_CREW_ID, 'Invalid']]) {
      await admin.page.goto(`/admin/crew/${id}`);
      await admin.page.getByText(`Certificate ${status} — Re-upload Required`, { exact: true }).waitFor();
      assert.equal(await admin.page.getByRole('button', { name: 'Approve', exact: true }).isDisabled(), true);
      assert.equal(await admin.page.getByRole('button', { name: 'Decline', exact: true }).isEnabled(), true);
    }
    await admin.page.goto('/admin/manage-boat-crew');
    await admin.page.getByRole('checkbox', { name: /Show approved crew requiring certificate review/ }).check();
    await admin.page.getByRole('row').filter({ hasText: 'Test BoatCrew' }).waitFor();
    await admin.page.getByText('Manual review required', { exact: true }).waitFor();

    const approvalPath = `/api/operations/crew/${crewId}/approval`;
    const reject = await admin.context.request.patch(approvalPath, { headers: { Authorization: `Bearer ${admin.token}` }, data: { approval: 'Rejected' } });
    assert.equal(reject.status(), 204);
    const crew = await signedIn('BoatCrew');
    await crew.page.goto('/crew/profile');
    const input = crew.page.locator('input[type=file][accept*=pdf]');
    await input.waitFor({ state: 'attached' });
    await crew.page.waitForFunction(() => !document.querySelector('input[type=file][accept*=pdf]')?.disabled);
    await input.setInputFiles({ name: 'bad.pdf', mimeType: 'application/pdf', buffer: Buffer.from('invalid') });
    await crew.page.getByRole('alert').filter({ hasText: /does not match/ }).waitFor({ timeout: 5000 }).catch(async error => {
      throw new Error(`${error.message}\nAlerts: ${await crew.page.getByRole('alert').allTextContents()}`);
    });
    const bytes = Buffer.from(process.env.WWMS_TEST_CERTIFICATE_PDF, 'base64');
    const file = { name: 'browser-certificate.pdf', mimeType: 'application/pdf', buffer: bytes };
    await crew.page.route('**/api/crew/profile/certificates', async route => {
      if (route.request().method() === 'POST') return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'Certificate storage temporarily unavailable.' }) });
      return route.continue();
    });
    await input.setInputFiles(file);
    await crew.page.getByRole('alert').filter({ hasText: /storage temporarily unavailable/ }).waitFor({ timeout: 5000 }).catch(async error => {
      throw new Error(`${error.message}\nAlerts: ${await crew.page.getByRole('alert').allTextContents()}`);
    });
    await crew.page.unroute('**/api/crew/profile/certificates');
    const uploadedResponse = crew.page.waitForResponse(r => r.url().endsWith('/api/crew/profile/certificates') && r.request().method() === 'POST');
    await input.setInputFiles(file);
    const uploaded = await (await uploadedResponse).json();
    await crew.page.getByRole('status').getByText(/Certificate uploaded/).waitFor();
    // Real browser encoders supply valid image fixtures for every existing image type.
    for (const [type, extension] of [['image/png', 'png'], ['image/jpeg', 'jpg'], ['image/webp', 'webp']]) {
      const encoded = await crew.page.evaluate(type => {
        const canvas = document.createElement('canvas'); canvas.width = 24; canvas.height = 24;
        const context = canvas.getContext('2d'); context.fillStyle = '#115577'; context.fillRect(0, 0, 24, 24);
        return canvas.toDataURL(type);
      }, type);
      const imageBytes = encoded.startsWith(`data:${type};`) ? Buffer.from(encoded.split(',')[1], 'base64')
        : type === 'image/webp' ? Buffer.from('UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA', 'base64') : null;
      assert.ok(imageBytes, `${type}: no image fixture available`);
      const image = await crew.context.request.post('/api/crew/profile/certificates', {
        headers: { Authorization: `Bearer ${crew.token}` },
        multipart: { certificate: { name: `image-certificate.${extension}`, mimeType: type, buffer: imageBytes } },
      });
      assert.equal(image.status(), 200, `${type}: ${await image.text()}`);
    }
    await admin.page.goto(detail);
    await admin.page.getByText('Certificate Available', { exact: true }).waitFor();
    assert.equal(await admin.page.getByRole('button', { name: 'Approve', exact: true }).isEnabled(), true);
    const downloadEvent = admin.page.waitForEvent('download');
    await admin.page.getByRole('button', { name: /browser-certificate.pdf/ }).click();
    const download = await downloadEvent;
    assert.equal(download.suggestedFilename(), 'browser-certificate.pdf');
    assert.deepEqual(fs.readFileSync(await download.path()), bytes);
    const approved = admin.page.waitForResponse(r => r.url().endsWith(approvalPath) && r.request().method() === 'PATCH');
    await admin.page.getByRole('button', { name: 'Approve', exact: true }).click();
    assert.equal((await approved).status(), 204);
    const audit = await admin.context.request.get('/api/admin/crew', { headers: { Authorization: `Bearer ${admin.token}` } });
    assert.equal((await audit.json()).find(m => m.id === crewId).certified, true);
    assert.ok(uploaded.id);
    await admin.context.close(); await crew.context.close();

    const wildlife = await signedIn('Wildlife');
    await wildlife.page.goto(`/wildlife/crew/${crewId}`);
    await wildlife.page.getByText('Certificate Available', { exact: true }).waitFor();
    assert.equal(await wildlife.page.getByRole('button', { name: 'Approve', exact: true }).isEnabled(), true);
    await wildlife.page.getByRole('button', { name: /browser-certificate.pdf/ }).waitFor();
    if (process.env.RECOVERY_SCREENSHOT_DIR) {
      fs.mkdirSync(process.env.RECOVERY_SCREENSHOT_DIR, { recursive: true });
      await wildlife.page.screenshot({ path: path.join(process.env.RECOVERY_SCREENSHOT_DIR, 'crew-certificate-mobile.png'), fullPage: true });
    }
    await wildlife.context.close();
    assert.deepEqual(errors, []);
    console.log('PASS: legacy audit, mandatory certificate UI, upload failure/retry, private download, live approval, and Wildlife certificate access.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
