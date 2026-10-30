// Read-only staff audit. Uses the same validation/projection as the approval endpoint.
// Credentials remain local; neither credentials nor certificate bytes/names are printed.
const fs = require('node:fs');
const path = require('node:path');

(async () => {
  const local = fs.existsSync(path.resolve('.env')) ? fs.readFileSync(path.resolve('.env'), 'utf8') : '';
  function setting(name) {
    const value = process.env[name] ?? local.split(/\r?\n/).find(line => line.startsWith(`${name}=`))?.slice(name.length + 1).trim();
    return value?.replace(/^(['"])(.*)\1$/, '$2');
  }
  const baseURL = process.env.WWMS_API_URL || 'http://localhost:8080';
  const email = setting('INITIAL_ADMIN_EMAIL');
  const password = setting('INITIAL_ADMIN_PASSWORD');
  if (!email || !password) throw new Error('Set INITIAL_ADMIN_EMAIL and INITIAL_ADMIN_PASSWORD locally for an authorized staff audit.');
  const login = await fetch(`${baseURL}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }),
  });
  if (!login.ok) throw new Error(`Staff sign-in failed (${login.status}). No audit performed.`);
  const { accessToken } = await login.json();
  const response = await fetch(`${baseURL}/api/admin/crew`, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!response.ok) throw new Error(`Crew audit failed (${response.status}).`);
  const crew = await response.json();
  if (crew.some(member => !member.certificate)) throw new Error('Deploy the certificate validation API before auditing.');
  const approved = crew.filter(member => member.certified);
  console.log(JSON.stringify({
    auditedAtUtc: new Date().toISOString(), crewAccounts: crew.length, approvedCrew: approved.length,
    approvedByCertificateStatus: Object.fromEntries(['Missing', 'Unavailable', 'Invalid', 'Valid'].map(status => [status, approved.filter(member => member.certificate.status === status).length])),
    manualReview: approved.filter(member => !member.certificate.canApprove).map(member => ({ crewId: member.id, certificateStatus: member.certificate.status })),
  }, null, 2));
})().catch(error => { console.error(error.message); process.exitCode = 1; });
