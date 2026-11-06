// Read-only HTTP probes: no real account login, emails, registrations, or operational mutations.
const assert = require('node:assert/strict');
const base = process.env.WWMS_AUDIT_API_URL || 'http://127.0.0.1:8080';
(async () => {
  const checks = [
    ['/health/live', 200], ['/health/ready', 200], ['/api/operations/boats', 401],
    ['/api/admin/staff', 401], ['/api/passenger-monitoring/passengers', 401],
    ['/api/passenger/session/trip', 401], ['/api/passenger/session/party', 401],
    ['/api/passenger/session/qr', 401], ['/api/passenger/session/boat-location', 401],
    ['/api/passenger/trips/audit-nonexistent-invitation', 404],
  ];
  for (const [path, status] of checks) {
    const response = await fetch(base + path, { signal: AbortSignal.timeout(10000) });
    assert.equal(response.status, status, path);
    console.log(`PASS GET ${path}: ${status}`);
  }
  for (const origin of ['https://untrusted-audit.invalid', 'http://localhost:5173']) {
    const response = await fetch(base + '/health/live', { headers: { Origin: origin }, signal: AbortSignal.timeout(10000) });
    assert.equal(response.headers.get('access-control-allow-origin'), origin.startsWith('http://localhost:') ? origin : null);
    console.log(`PASS CORS ${origin.startsWith('http://localhost:') ? 'configured origin accepted' : 'untrusted origin excluded'}`);
  }
  const response = await fetch(base + '/hubs/operations/negotiate?negotiateVersion=1', { method: 'POST', signal: AbortSignal.timeout(10000) });
  assert.equal(response.status, 401);
  console.log('PASS unauthenticated SignalR negotiation: 401');
})().catch(error => { console.error(error); process.exitCode = 1; });
