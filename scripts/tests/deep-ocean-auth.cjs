/* Live Identity/API + disposable SQL only. Portal data is outside this auth test's scope. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { chromium, webkit } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

(async () => {
  const baseURL = process.env.RECOVERY_BASE_URL;
  assert.ok(baseURL, 'Run through Browser_LiveDeepOceanAuthentication_LoginRegistrationAndRoleRouting.');
  const engine = process.env.PLAYWRIGHT_ENGINE === 'webkit' ? webkit : chromium;
  const browser = await engine.launch(engine === chromium ? { channel: 'msedge', headless: true } : { headless: true });
  const password = 'OceanAuth#2026!Test';
  const oldPassword = 'BeforeReset#2026!Test';
  const errors = [];
  const roles = { Admin: '/admin', SLTDA: '/sltda', OPS: '/ops', ShoreCrew: '/shore', Wildlife: '/wildlife', ShoreWildlife: '/shore-wildlife', Supervisor: '/supervisor', HarbourOfficer: '/harbour-officer', BoatOwner: '/owner', BoatCrew: '/crew', Passenger: '/passenger' };

  async function createContext() {
    const context = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 } });
    // Real auth calls pass through. Unrelated portal datasets fail safely rather than invoking unregistered fixture services.
    await context.route('**/api/**', route => {
      const request = route.request();
      if (new URL(request.url()).pathname.startsWith('/api/auth/')) return route.continue();
      return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'Portal data is unavailable in the isolated authentication test.' }) });
    });
    await context.route('**/hubs/**', route => route.fulfill({ status: 503, body: '' }));
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    return { context, page };
  }

  async function layout(page, name) {
    for (const width of [320, 360, 390, 430, 768, 1024, 1440, 1920]) {
      await page.setViewportSize({ width, height: 844 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${name}: overflow at ${width}`);
      assert.equal(await page.locator('main.ocean-auth-shell').getAttribute('lang'), 'en');
      assert.equal(await page.getByRole('combobox').count(), 0, `${name}: unexpected language control`);
      assert.equal(await page.locator('.ocean-auth-whale').count(), 1);
      if (process.env.RECOVERY_SCREENSHOT_DIR && [390, 1440].includes(width)) {
        fs.mkdirSync(process.env.RECOVERY_SCREENSHOT_DIR, { recursive: true });
        await page.screenshot({ path: path.join(process.env.RECOVERY_SCREENSHOT_DIR, `auth-${name}-${width}.png`), fullPage: true, animations: 'disabled' });
      }
    }
    await page.setViewportSize({ width: 390, height: 844 });
  }

  async function details(page, values) {
    await page.locator('#signup-username').fill(values.username);
    await page.locator('#signup-full-name').fill('Ocean Authentication Test');
    await page.locator('#signup-nic').fill(values.nic);
    await page.locator('#signup-email').fill(values.email);
    await page.locator('#signup-phone').fill('+94771234567');
  }
  function identity(prefix) {
    const suffix = crypto.randomBytes(5).toString('hex');
    return { username: `ocean-${prefix}-${suffix}`, email: `ocean-${prefix}-${suffix}@example.test`, nic: String(crypto.randomInt(100000000000, 999999999999)) };
  }
  async function passwordFields(page, confirmation = password) {
    await page.waitForLoadState('networkidle');
    await page.locator('#signup-password').fill(password);
    assert.equal(await page.locator('#signup-password').inputValue(), password, 'Password fill persisted');
    await page.locator('#signup-password').press('Tab');
    await page.locator('#signup-confirm-password').fill(confirmation);
    assert.equal(await page.locator('#signup-password').inputValue(), password, 'Password persisted after confirmation');
    await page.locator('#signup-confirm-password').press('Tab');
  }
  async function ensureSession(page, role) {
    const token = await page.evaluate(() => sessionStorage.getItem('whale-watching-refresh-token'));
    assert.ok(token, 'existing refresh-token session storage must be preserved');
    await page.reload();
    await page.waitForURL(url => url.pathname === roles[role]);
    await page.waitForLoadState('networkidle');
    assert.equal(new URL(page.url()).pathname, roles[role]);
  }

  try {
    const { context, page } = await createContext();
    await page.goto('/auth');
    await layout(page, 'entry');
    await page.locator('.ocean-auth-whale').evaluate(element => { element.dataset.identity = 'persistent'; });
    await page.getByRole('link', { name: 'Sign In', exact: true }).click();
    await page.getByRole('heading', { name: 'Welcome back.', exact: true }).waitFor();
    await page.evaluate(() => localStorage.setItem('wwms.passenger.language', 'fr'));
    await layout(page, 'login');
    await page.getByRole('link', { name: 'Create an account', exact: true }).click();
    await page.getByRole('heading', { name: 'Create your account.', exact: true }).waitFor();
    assert.equal(await page.locator('.ocean-auth-whale').getAttribute('data-identity'), 'persistent');
    await layout(page, 'signup-role');
    await page.getByRole('link', { name: 'Sign In', exact: true }).click();
    await page.getByRole('link', { name: 'Forgot password?', exact: true }).click();
    await page.getByRole('heading', { name: 'Lost in the depths?', exact: true }).waitFor();
    assert.equal(await page.locator('.ocean-auth-whale').getAttribute('data-identity'), 'persistent');
    await page.goBack();
    await page.getByRole('heading', { name: 'Welcome back.', exact: true }).waitFor();
    await page.goForward();
    await page.getByRole('heading', { name: 'Lost in the depths?', exact: true }).waitFor();
    await page.goBack();
    assert.equal(await page.evaluate(() => localStorage.getItem('wwms.passenger.language')), 'fr');

    await page.locator('#login-email').fill('admin@recovery-test.example');
    await page.locator('#login-password').fill('Incorrect#2026!Password');
    await page.getByRole('button', { name: 'Show password', exact: true }).click();
    assert.equal(await page.locator('#login-password').getAttribute('type'), 'text');
    assert.equal(await page.locator('#login-password').inputValue(), 'Incorrect#2026!Password');
    await page.getByRole('button', { name: 'Sign In', exact: true }).click();
    await page.getByRole('alert').getByText('Invalid credentials or account state.', { exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Sign In', exact: true }).isEnabled(), true);
    await page.locator('#login-password').fill(oldPassword);
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    let loginCount = 0;
    await page.route('**/api/auth/login', async route => { loginCount++; const response = await route.fetch(); await gate; await route.fulfill({ response }); });
    const loginResponse = page.waitForResponse(response => response.url().endsWith('/api/auth/login'));
    await page.getByRole('button', { name: 'Sign In', exact: true }).evaluate(button => { button.click(); button.click(); });
    try {
      await page.getByRole('button', { name: 'Signing in…', exact: true }).waitFor();
      assert.equal(await page.getByRole('button', { name: 'Signing in…', exact: true }).isDisabled(), true);
    } finally { release(); }
    assert.equal((await loginResponse).status(), 200);
    await page.waitForURL(url => url.pathname === '/admin');
    assert.equal(loginCount, 1);
    await page.unroute('**/api/auth/login');
    await ensureSession(page, 'Admin');
    await context.close();

    // Login still routes each existing account role to its original portal.
    for (const [role, destination] of Object.entries(roles)) {
      if (role === 'Admin') continue;
      const { context: roleContext, page: rolePage } = await createContext();
      await rolePage.goto('/login');
      await rolePage.waitForLoadState('networkidle');
      if (process.env.AUTH_DEBUG) process.stdout.write(`Checking ${role} login.\n`);
      await rolePage.locator('#login-email').fill(`${role.toLowerCase()}@recovery-test.example`);
      await rolePage.locator('#login-password').fill(oldPassword);
      await rolePage.locator('#login-password').press('Tab');
      assert.equal(await rolePage.locator('#login-email').evaluate(element => element.checkValidity()), true, `${role}: invalid email control`);
      assert.equal(await rolePage.locator('#login-password').evaluate(element => element.checkValidity()), true, `${role}: invalid password control`);
      const response = rolePage.waitForResponse(result => result.url().endsWith('/api/auth/login'));
      await rolePage.getByRole('button', { name: 'Sign In', exact: true }).click();
      let result;
      try { result = await response; }
      catch (error) {
        process.stderr.write(`${role}: ${JSON.stringify(await rolePage.locator('form').evaluate(form => ({ valid: form.checkValidity(), busy: form.getAttribute('aria-busy'), controls: [...form.querySelectorAll('input')].map(input => ({ id: input.id, valid: input.validity.valid, length: input.value.length })) })))}\n`);
        throw error;
      }
      assert.equal(result.status(), 200);
      const session = await result.json(); assert.deepEqual(session.roles, [role]);
      await rolePage.waitForURL(url => url.pathname === destination);
      const allowed = await roleContext.request.get(`/test/private/${role}`, { headers: { Authorization: `Bearer ${session.accessToken}` } });
      assert.equal(allowed.status(), 200);
      assert.equal((await roleContext.request.get('/test/private/Admin', { headers: { Authorization: `Bearer ${session.accessToken}` } })).status(), 403);
      await rolePage.waitForLoadState('networkidle');
      await roleContext.close();
    }

    let firstIdentity;
    for (const [role, label] of [['BoatOwner', 'Boat Owner'], ['BoatCrew', 'Crew Member']]) {
      const { context: signupContext, page: signupPage } = await createContext();
      const values = identity(role === 'BoatOwner' ? 'owner' : 'crew');
      if (!firstIdentity) firstIdentity = values;
      await signupPage.goto('/signup');
      await signupPage.getByRole('button', { name: new RegExp(label) }).click();
      await details(signupPage, values);
      if (role === 'BoatOwner') {
        await layout(signupPage, 'signup-details');
        await signupPage.locator('#signup-username').fill('a');
        await signupPage.getByRole('button', { name: 'Continue', exact: true }).click();
        assert.equal(await signupPage.locator('#signup-password').count(), 0);
        await signupPage.locator('#signup-username').fill(values.username);
        await signupPage.locator('#signup-username').fill('bad username');
        await signupPage.getByRole('button', { name: 'Continue', exact: true }).click();
        assert.equal(await signupPage.locator('#signup-password').count(), 0);
        await signupPage.locator('#signup-username').fill(values.username);
        await signupPage.locator('#signup-nic').fill('invalid');
        await signupPage.getByRole('button', { name: 'Continue', exact: true }).click();
        assert.equal(await signupPage.locator('#signup-password').count(), 0);
        await signupPage.locator('#signup-nic').fill(values.nic);
      }
      await signupPage.getByRole('button', { name: 'Continue', exact: true }).click();
      await signupPage.locator('#signup-password').waitFor();
      if (role === 'BoatOwner') {
        await layout(signupPage, 'signup-password');
        await passwordFields(signupPage, 'Different#2026!Password');
        await signupPage.getByRole('button', { name: 'Create Account', exact: true }).click();
        await signupPage.getByRole('alert').getByText('Passwords do not match.', { exact: true }).waitFor();
        await signupPage.locator('#signup-password').fill('weak');
        await signupPage.locator('#signup-confirm-password').fill('weak');
        await signupPage.getByRole('button', { name: 'Create Account', exact: true }).click();
        assert.equal(new URL(signupPage.url()).pathname, '/signup');
      }
      await passwordFields(signupPage);
      await signupPage.getByRole('button', { name: 'Show confirm password', exact: true }).click();
      assert.equal(await signupPage.locator('#signup-confirm-password').getAttribute('type'), 'text');
      await signupPage.locator('#signup-confirm-password').press('Tab');
      assert.deepEqual(await signupPage.locator('form input').evaluateAll(inputs => inputs.filter(input => !input.checkValidity()).map(input => ({ id: input.id, validation: input.validationMessage }))), [], `${role}: valid registration form`);
      let registrations = 0;
      signupPage.on('request', request => { if (request.url().endsWith('/api/auth/register')) registrations++; });
      const response = signupPage.waitForResponse(result => result.url().endsWith('/api/auth/register')).catch(async error => {
        throw new Error(`${role}: ${error.message}\nAlerts: ${await signupPage.getByRole('alert').allTextContents()}`);
      });
      await signupPage.getByRole('button', { name: 'Create Account', exact: true }).evaluate(button => { button.click(); button.click(); });
      const registrationResponse = await response;
      assert.equal(registrationResponse.status(), 202, await registrationResponse.text());
      await signupPage.waitForURL(url => url.pathname === roles[role]);
      assert.equal(registrations, 1);
      await ensureSession(signupPage, role);
      await signupContext.close();
    }

    // A real duplicate-email response is shown inline and leaves registration usable.
    const { context: failureContext, page: failurePage } = await createContext();
    await failurePage.goto('/signup');
    await failurePage.getByRole('button', { name: /Boat Owner/ }).click();
    const duplicate = identity('duplicate'); duplicate.email = firstIdentity.email;
    await details(failurePage, duplicate);
    await failurePage.getByRole('button', { name: 'Continue', exact: true }).click();
    await passwordFields(failurePage);
    const duplicateResponse = failurePage.waitForResponse(result => result.url().endsWith('/api/auth/register'));
    await failurePage.getByRole('button', { name: 'Create Account', exact: true }).click();
    assert.equal((await duplicateResponse).status(), 400);
    await failurePage.getByRole('alert').getByText(/already|taken|associated/i).waitFor();
    assert.equal(await failurePage.getByRole('button', { name: 'Create Account', exact: true }).isEnabled(), true);
    await failurePage.route('**/api/auth/register', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'Registration is temporarily unavailable.' }) }));
    await failurePage.getByRole('button', { name: 'Create Account', exact: true }).click();
    await failurePage.getByRole('alert').getByText('Registration is temporarily unavailable.', { exact: true }).waitFor();
    await failurePage.emulateMedia({ reducedMotion: 'reduce' });
    assert.equal(await failurePage.locator('.ocean-auth-whale').evaluate(element => getComputedStyle(element).animationName), 'none');
    assert.equal(await failurePage.locator('.ocean-auth-whale-outline').evaluate(element => getComputedStyle(element).strokeDashoffset), '0px');
    await failurePage.setViewportSize({ width: 390, height: 360 });
    await failurePage.getByRole('button', { name: 'Create Account', exact: true }).scrollIntoViewIfNeeded();
    assert.equal(await failurePage.getByRole('button', { name: 'Create Account', exact: true }).isVisible(), true);
    await failurePage.goto('/passenger');
    const language = failurePage.getByRole('combobox');
    await language.waitFor(); assert.equal(await language.locator('option').count(), 5);
    await language.selectOption('fr');
    assert.equal(await language.inputValue(), 'fr');
    await failurePage.goto('/login');
    await failurePage.getByRole('heading', { name: 'Welcome back.', exact: true }).waitFor();
    assert.equal(await failurePage.getByRole('combobox').count(), 0);
    assert.equal(await failurePage.evaluate(() => localStorage.getItem('wwms.passenger.language')), 'fr');
    await failureContext.close();
    assert.deepEqual(errors, []);
    process.stdout.write(`${engine === webkit ? 'WebKit' : 'Chromium'}: real login for 11 roles, session restore, both public registrations, duplicate/error handling, visibility, pending guards, persistent whale/navigation, English-only auth, passenger language selector, reduced motion, and eight viewport widths passed.\n`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
