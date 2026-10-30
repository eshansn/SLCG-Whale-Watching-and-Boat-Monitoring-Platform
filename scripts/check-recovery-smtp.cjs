// Checks Gmail STARTTLS/authentication only. Never sends a message or prints credentials.
// Run from the repository with: node scripts/check-recovery-smtp.cjs
const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const tls = require('node:tls');

function reply(socket, command) {
  return new Promise((resolve, reject) => {
    let buffer = '';
    const cleanup = () => { socket.off('data', data); socket.off('error', error); socket.off('close', close); };
    const error = () => { cleanup(); reject(new Error('SMTP connection failed.')); };
    const close = () => { cleanup(); reject(new Error('SMTP connection closed unexpectedly.')); };
    const data = chunk => {
      buffer += chunk.toString('utf8');
      if (buffer.length > 32768) { error(); return; }
      const lines = buffer.split('\r\n');
      if (lines.length < 2) return;
      const last = lines[lines.length - 2];
      if (/^[0-9]{3} /.test(last)) { cleanup(); resolve({ code: Number(last.slice(0, 3)), text: buffer }); }
    };
    socket.on('data', data); socket.once('error', error); socket.once('close', close);
    if (command) socket.write(command + '\r\n');
  });
}

(async () => {
  let socket;
  let timer;
  let stage = 'configuration';
  let status;
  try {
    const content = fs.readFileSync(path.resolve(__dirname, '../.env'), 'utf8');
    const config = {};
    for (const line of content.split(/\r?\n/)) {
      const match = /^(SMTP_[A-Z_]+)=(.*)$/.exec(line);
      if (match) config[match[1]] = match[2].trim().replace(/^(['"])(.*)\1$/, '$2');
    }
    const host = config.SMTP_HOST || 'smtp.gmail.com';
    const port = Number(config.SMTP_PORT || 587);
    const username = config.SMTP_USERNAME || '';
    const password = (config.SMTP_APP_PASSWORD || '').replaceAll(' ', '');
    if (host !== 'smtp.gmail.com' || port !== 587 || !/^[^\s@]+@[^\s@]+$/.test(username) || password.length !== 16)
      throw new Error('Incomplete Gmail configuration.');
    const expect = (response, expected) => { status = response.code; if (response.code !== expected) throw new Error('Unexpected SMTP response.'); return response; };
    stage = 'connection';
    socket = net.createConnection({ host, port });
    timer = setTimeout(() => socket.destroy(new Error('Timeout')), 20_000);
    expect(await reply(socket), 220);
    const capabilities = expect(await reply(socket, 'EHLO wwms.local'), 250);
    if (!/STARTTLS/i.test(capabilities.text)) throw new Error('STARTTLS unavailable.');
    stage = 'STARTTLS';
    expect(await reply(socket, 'STARTTLS'), 220);
    socket = tls.connect({ socket, servername: host, rejectUnauthorized: true, minVersion: 'TLSv1.2' });
    await new Promise((resolve, reject) => { socket.once('secureConnect', resolve); socket.once('error', reject); });
    if (!socket.authorized) throw new Error('TLS certificate validation failed.');
    expect(await reply(socket, 'EHLO wwms.local'), 250);
    stage = 'authentication';
    expect(await reply(socket, 'AUTH PLAIN ' + Buffer.from('\0' + username + '\0' + password).toString('base64')), 235);
    stage = 'disconnect';
    expect(await reply(socket, 'QUIT'), 221);
    process.stdout.write('Gmail STARTTLS and SMTP authentication succeeded. No email was sent.\n');
  } catch {
    process.stderr.write(`Gmail SMTP check failed during ${stage}${status ? ` (last SMTP status ${status})` : ''}. No email was sent.\n`);
    process.exitCode = 1;
  } finally { clearTimeout(timer); socket?.destroy(); }
})();
