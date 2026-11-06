// Invoked by ContactTests against an isolated real API with a fake SMTP sender. Never sends mail.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
(async () => {
  assert.ok(process.env.WWMS_CONTACT_TEST_URL, 'Run through ContactTests, not a real deployment.');
  const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto(process.env.WWMS_CONTACT_TEST_URL + '/#contact');
    const form = page.locator('#contact form');
    let submissions = 0; page.on('request', request => { if (new URL(request.url()).pathname === '/api/contact') submissions++; });
    await form.getByRole('button', { name: 'Submit', exact: true }).click();
    assert.equal(submissions, 0, 'Empty fields must be rejected before sending');
    await form.getByRole('textbox', { name: 'Your name', exact: true }).fill('Visitor');
    await form.getByRole('textbox', { name: 'Your email address', exact: true }).fill('visitor@example.test');
    await form.getByRole('textbox', { name: 'Your inquiry or feedback', exact: true }).fill('Inquiry');
    await form.getByRole('button', { name: 'Submit', exact: true }).click();
    await form.getByRole('status').filter({ hasText: 'Your inquiry has been sent.' }).waitFor();
    assert.equal(await form.getByRole('textbox', { name: 'Your name', exact: true }).inputValue(), '');
    await page.request.post(process.env.WWMS_CONTACT_TEST_URL + '/test/contact-fail');
    await page.setViewportSize({ width: 1440, height: 960 });
    await form.getByRole('textbox', { name: 'Your name', exact: true }).fill('Visitor');
    await form.getByRole('textbox', { name: 'Your email address', exact: true }).fill('visitor@example.test');
    await form.getByRole('textbox', { name: 'Your inquiry or feedback', exact: true }).fill('Inquiry');
    await form.getByRole('button', { name: 'Submit', exact: true }).click();
    await form.getByRole('alert').filter({ hasText: 'could not be sent' }).waitFor();
    assert.equal(await form.getByRole('textbox', { name: 'Your inquiry or feedback', exact: true }).inputValue(), 'Inquiry');
    assert.equal(submissions, 2); assert.deepEqual(errors, []);
    console.log('PASS public Contact: real API, validation, mobile/desktop, success, SMTP failure, retained inputs, no real mail.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
