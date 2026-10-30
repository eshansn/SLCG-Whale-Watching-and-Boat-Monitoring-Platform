/* Live API + disposable SQL database + fake SMTP only; launched by PasswordRecoveryTests. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium, webkit } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

(async () => {
  const baseURL = process.env.RECOVERY_BASE_URL;
  assert.ok(baseURL, 'Run through Browser_LivePasswordRecovery_MobileDesktopAndEnglishOnlyFlow.');
  const engine = process.env.PLAYWRIGHT_ENGINE === 'webkit' ? webkit : chromium;
  const browser = await engine.launch(engine === chromium ? { channel: 'msedge', headless: true } : { headless: true });
  const context = await browser.newContext({ baseURL, viewport: { width: 375, height: 812 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  let sends = 0;
  page.on('request', request => { if (request.url().endsWith('/api/auth/forgot-password')) sends++; });
  const post = (endpoint, body) => context.request.post(`/api/auth/${endpoint}`, { data: body });
  const inbox = async role => {
    assert.equal((await context.request.post('/test/process-mail')).status(), 200);
    const result = await (await context.request.get(`/test/inbox/${role}`)).json();
    assert.match(result.code, /^[0-9]{6}$/); return result.code;
  };
  const layout = async () => {
    const stage = await page.locator('#recovery-email').count() ? 'email' : await page.locator('#recovery-code-0').count() ? 'code' : await page.locator('#recovery-password').count() ? 'password' : 'success';
    for (const width of [320, 360, 375, 390, 430, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 812 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `overflow at ${width}`);
      assert.equal(await page.getByRole('combobox').count(), 0, `${stage}: no language dropdown at ${width}`);
      assert.equal(await page.locator('select, [aria-label*="language" i]').count(), 0);
      assert.equal(await page.locator('main').getAttribute('lang'), 'en');
      if (process.env.RECOVERY_SCREENSHOT_DIR && [375, 1440].includes(width)) {
        fs.mkdirSync(process.env.RECOVERY_SCREENSHOT_DIR, { recursive: true });
        await page.screenshot({ path: path.join(process.env.RECOVERY_SCREENSHOT_DIR, `recovery-${stage}-${width}.png`), fullPage: true, animations: 'disabled' });
      }
    }
    await page.setViewportSize({ width: 375, height: 812 });
  };
  const start = async email => {
    await page.locator('#recovery-email').fill(email);
    const response = page.waitForResponse(r => r.url().endsWith('/api/auth/forgot-password'));
    // Two immediate clicks must still result in a single request.
    await page.getByRole('button', { name: 'Send Verification Code', exact: true }).evaluate(button => { button.click(); button.click(); });
    const result = await response; assert.equal(result.status(), 202);
    const payload = await result.json();
    await page.locator('#recovery-code-0').waitFor(); return payload;
  };
  try {
    await page.goto('/login');
    await page.evaluate(() => localStorage.setItem('wwms.passenger.language', 'ru'));
    await page.getByRole('link', { name: 'Forgot password?' }).click();
    assert.equal(new URL(page.url()).pathname, '/forgot-password');
    await page.getByRole('heading', { name: 'Lost in the depths?', exact: true }).waitFor();
    await page.locator('.ocean-auth-whale').evaluate(element => { element.dataset.preserved = 'yes'; });
    await page.waitForTimeout(4000); // Allow the one-time outline drawing to finish before preview captures.
    await layout();
    const before = await (await post('login', { email: 'admin@recovery-test.example', password: 'BeforeReset#2026!Test' })).json();
    await page.evaluate(token => sessionStorage.setItem('whale-watching-refresh-token', token), before.refreshToken);
    const accepted = await start('ADMIN@recovery-test.example');
    assert.equal(sends, 1);
    assert.equal(await page.getByRole('button', { name: /Resend code in/ }).isDisabled(), true);
    assert.equal(await page.locator('.ocean-auth-whale').getAttribute('data-preserved'), 'yes');
    assert.equal((await post('resend-reset-otp', { recoveryId: accepted.recoveryId })).status(), 429);
    let code = await inbox('Admin');
    await layout();
    // Numeric entry advances focus; backspace and arrow keys move between the six inputs.
    await page.locator('#recovery-code-0').focus();
    await page.keyboard.type('12');
    assert.equal(await page.locator('#recovery-code-2').evaluate(element => document.activeElement === element), true);
    await page.keyboard.press('Backspace');
    assert.equal(await page.locator('#recovery-code-1').inputValue(), '');
    await page.keyboard.press('ArrowLeft');
    assert.equal(await page.locator('#recovery-code-0').evaluate(element => document.activeElement === element), true);
    await page.locator('#recovery-code-0').fill(code === '000000' ? '000001' : '000000');
    await page.getByRole('button', { name: 'Verify code', exact: true }).click();
    await page.getByRole('alert').getByText(/invalid, expired/).waitFor();
    // Move both independent clocks without waiting a minute during the test.
    await page.clock.install(); await context.request.post('/test/advance/61'); await page.clock.fastForward(61_000);
    // A failed resend must not restart the countdown or claim acceptance.
    await page.route('**/api/auth/resend-reset-otp', route => route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
    await page.getByRole('button', { name: 'Resend code', exact: true }).click();
    await page.getByRole('alert').getByText(/temporarily unavailable/).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Resend code', exact: true }).isEnabled(), true);
    await page.unroute('**/api/auth/resend-reset-otp');
    const resend = page.waitForResponse(r => r.url().endsWith('/api/auth/resend-reset-otp'));
    await page.getByRole('button', { name: 'Resend code', exact: true }).click();
    assert.equal((await resend).status(), 202);
    const replacement = await inbox('Admin'); assert.notEqual(code, replacement); code = replacement;
    // Complete-code paste from any digit fills all six boxes, including leading zeroes.
    await page.locator('#recovery-code-2').evaluate((element, value) => {
      const data = new DataTransfer(); data.setData('text/plain', value);
      element.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
    }, code);
    assert.equal((await page.locator('.ocean-auth-otp-digit').evaluateAll(elements => elements.map(element => element.value))).join(''), code);
    await page.getByRole('button', { name: 'Verify code', exact: true }).click();
    await page.locator('#recovery-password').waitFor();
    await layout();
    await page.locator('#recovery-password').fill('AfterReset#2026!Test');
    await page.locator('#recovery-confirmation').fill('DoesNotMatch#2026!Test');
    await page.getByRole('button', { name: 'Reset password', exact: true }).click();
    await page.getByRole('alert').getByText('Passwords do not match.').waitFor();
    await page.getByRole('button', { name: 'Show new password', exact: true }).click();
    assert.equal(await page.locator('#recovery-password').getAttribute('type'), 'text');
    await page.locator('#recovery-confirmation').fill('AfterReset#2026!Test');
    const reset = page.waitForResponse(r => r.url().endsWith('/api/auth/reset-password'));
    await page.getByRole('button', { name: 'Reset password', exact: true }).click();
    assert.equal((await reset).status(), 200);
    await page.getByRole('heading', { name: 'You’re back on course', exact: true }).waitFor();
    await layout();
    assert.equal(await page.evaluate(() => sessionStorage.getItem('whale-watching-refresh-token')), null);
    const browserState = await page.evaluate(() => JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage } }));
    assert.equal(browserState.includes(code), false);
    assert.equal(browserState.includes('resetAuthorization'), false);
    assert.equal(new URL(page.url()).search, '');
    assert.equal((await post('login', { email: 'admin@recovery-test.example', password: 'BeforeReset#2026!Test' })).status(), 401);
    const after = await (await post('login', { email: 'admin@recovery-test.example', password: 'AfterReset#2026!Test' })).json();
    assert.deepEqual(after.roles, ['Admin']);
    assert.equal((await context.request.get('/test/private/Admin', { headers: { Authorization: `Bearer ${after.accessToken}` } })).status(), 200);
    assert.equal((await context.request.get('/test/private/OPS', { headers: { Authorization: `Bearer ${after.accessToken}` } })).status(), 403);
    await page.getByRole('link', { name: 'Return to Sign In', exact: true }).click();
    await page.getByRole('link', { name: 'Forgot password?' }).click();
    await start('ops@recovery-test.example');
    await context.request.post('/test/advance/601'); await page.clock.fastForward(601_000);
    await page.getByText('This code has expired. Request a new code.').waitFor();
    assert.equal(await page.getByRole('button', { name: 'Verify code', exact: true }).isDisabled(), true);
    assert.equal(await page.getByRole('button', { name: 'Resend code', exact: true }).isEnabled(), true);
    await page.getByRole('button', { name: 'Start a new request', exact: true }).click();
    assert.equal(await page.locator('#recovery-email').inputValue(), '');
    assert.equal(await page.locator('#recovery-code-0').count(), 0);
    for (const language of ['fr', 'de', 'ru', 'zh-CN', 'en']) {
      await page.evaluate(value => localStorage.setItem('wwms.passenger.language', value), language);
      await page.reload();
      await page.getByRole('heading', { name: 'Lost in the depths?', exact: true }).waitFor();
      assert.equal(await page.getByRole('combobox').count(), 0);
      assert.equal(await page.evaluate(() => localStorage.getItem('wwms.passenger.language')), language);
      await page.setViewportSize({ width: 320, height: 568 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, language);
    }
    await page.emulateMedia({ reducedMotion: 'reduce' });
    assert.equal(await page.locator('.ocean-auth-whale').evaluate(element => getComputedStyle(element).animationName), 'none');
    assert.equal(await page.locator('.ocean-auth-whale-outline').evaluate(element => getComputedStyle(element).strokeDashoffset), '0px');
    // A network failure leaves the form usable and exposes no response internals.
    await page.route('**/api/auth/forgot-password', route => route.abort('failed'));
    await page.locator('#recovery-email').fill('ops@recovery-test.example');
    await page.getByRole('button', { name: 'Send Verification Code', exact: true }).click();
    await page.getByRole('alert').getByText(/Check your connection/).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Send Verification Code', exact: true }).isEnabled(), true);
    // Preview the real backend template with a synthetic code, without sending any email.
    const emailPreview = await context.newPage();
    await emailPreview.goto('/test/email-preview');
    for (const width of [320, 375, 430, 768, 1440]) {
      await emailPreview.setViewportSize({ width, height: 900 });
      assert.equal(await emailPreview.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `email overflow at ${width}`);
      assert.equal(await emailPreview.locator('script, link[rel="stylesheet"], img').count(), 0);
      await emailPreview.getByText('000042', { exact: true }).waitFor();
      if (process.env.RECOVERY_SCREENSHOT_DIR && [375, 1440].includes(width))
        await emailPreview.screenshot({ path: path.join(process.env.RECOVERY_SCREENSHOT_DIR, `recovery-email-template-${width}.png`), fullPage: true });
    }
    await emailPreview.close();
    assert.deepEqual(errors, []);
    process.stdout.write(`${engine === webkit ? 'WebKit' : 'Chromium'}: live recovery, resend/failure, six-box entry/paste, reset, login, role boundaries, cancellation, English-only screens, preserved portal language preferences, reduced motion, network errors, and eight viewport sizes passed.\n`);
  } finally { await context.close(); await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
