'use strict';

const { _electron } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');

(async () => {
  const root = path.resolve(__dirname, '..');
  const credentials = { username: 'heartbeat_customer', password: 'Heartbeat-Customer-6285' };
  const heartbeats = [];
  const server = http.createServer((request, response) => {
    const finish = (status, payload) => {
      response.writeHead(status, { 'content-type': 'application/json' });
      response.end(JSON.stringify(payload));
    };
    let raw = '';
    request.setEncoding('utf8');
    request.on('data', (chunk) => { raw += chunk; });
    request.on('end', () => {
      let body = {};
      try { body = JSON.parse(raw || '{}'); } catch { return finish(400, { ok: false }); }
      if (request.url === '/api/login') return finish(401, { ok: false, error: 'invalid' });
      if (request.url === '/api/customer-login') {
        if (body.username !== credentials.username || body.password !== credentials.password) return finish(401, { ok: false });
        return finish(200, {
          ok: true,
          token: 'heartbeat-customer-session-token',
          customer: {
            id: 'heartbeat-customer', username: credentials.username, plan: 'test', speechTier: 'advanced',
            quota: 500000, used: 0, expires: '2099-12-31', status: 'active',
          },
        });
      }
      if (request.url === '/api/customer-heartbeat') {
        heartbeats.push({ authorization: request.headers.authorization || '', body, at: Date.now() });
        return finish(200, { ok: true, device: { id: body.deviceId } });
      }
      return finish(404, { ok: false });
    });
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'st-customer-heartbeat-'));
  const localPort = await new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const port = probe.address().port;
      probe.close((error) => (error ? reject(error) : resolve(port)));
    });
  });
  fs.writeFileSync(path.join(profile, 'workspace-v2.json'), JSON.stringify({
    settings: { localPort },
  }));
  // Occupy the configured port with an invalid health response so this test
  // cannot accidentally observe a developer's unrelated local model service.
  const localProbe = http.createServer((_request, response) => {
    response.writeHead(404, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ ok: false }));
  });
  await new Promise((resolve, reject) => {
    localProbe.once('error', reject);
    localProbe.listen(localPort, '127.0.0.1', resolve);
  });
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => (
    !['ELECTRON_RUN_AS_NODE', 'ST_TEST_PROFILE', 'ST_CLOUD_BASE', 'ST_TEST_FIXTURE'].includes(key.toUpperCase())
  )));
  Object.assign(env, {
    ST_TEST_PROFILE: profile,
    ST_CLOUD_BASE: `http://127.0.0.1:${server.address().port}`,
    ST_TEST_FIXTURE: '1',
  });
  const app = await _electron.launch({
    executablePath: require('electron'),
    args: [path.join(root, 'src', 'desktop.js')],
    env,
  });
  try {
    const page = await app.firstWindow();
    await page.waitForLoadState('domcontentloaded');
    const logIn = async () => {
      await page.locator('#account').fill(credentials.username);
      await page.locator('#password').fill(credentials.password);
      await page.locator('#login-form').evaluate((form) => form.requestSubmit());
      await page.waitForURL('**/workbench/index.html');
    };

    // The first delayed report must be cancellable when the user signs out
    // before the 500 ms initial heartbeat delay expires.
    await logIn();
    await page.evaluate(() => window.superDesktop.window('login'));
    await page.waitForURL('**/login/index.html');
    await page.waitForTimeout(900);
    assert.equal(heartbeats.length, 0, 'sign-out cancels the delayed initial heartbeat');

    await logIn();
    const deadline = Date.now() + 10000;
    while (!heartbeats.length && Date.now() < deadline) await page.waitForTimeout(100);
    assert.equal(heartbeats.length, 1, 'customer login emits one immediate heartbeat');

    const report = heartbeats[0];
    assert.equal(report.authorization, 'Bearer heartbeat-customer-session-token');
    assert.match(report.body.deviceId, /^[a-f0-9]{64}$/);
    assert.ok(typeof report.body.hostname === 'string' && report.body.hostname.length <= 80);
    assert.ok(typeof report.body.platform === 'string' && report.body.platform.length <= 40);
    assert.ok(typeof report.body.arch === 'string' && report.body.arch.length <= 20);
    assert.ok(typeof report.body.cpu === 'string' && report.body.cpu.length <= 120);
    // GPU is best-effort.  On hosts without a reliable Windows WMI/CIM
    // result it is intentionally blank rather than a fabricated model name.
    assert.ok(typeof report.body.gpu === 'string' && report.body.gpu.length <= 120);
    assert.match(report.body.appVersion, /^\d+\.\d+\.\d+/);
    assert.equal(report.body.modelStatus, 'offline', 'missing local model is not reported as ready');
    assert.equal(report.body.modelLatencyMs, null);
    assert.ok(!Object.prototype.hasOwnProperty.call(report.body, 'username'));
    assert.ok(!Object.prototype.hasOwnProperty.call(report.body, 'password'));
    assert.ok(!Object.prototype.hasOwnProperty.call(report.body, 'token'));
    assert.ok(!Object.values(report.body).some((value) => String(value).includes(profile)), 'local paths are not reported');

    console.log(JSON.stringify({
      ok: true,
      checks: 16,
      cancellableInitialTimer: true,
      singleImmediateReport: true,
      hardwareSummary: true,
      offlineModelHonest: true,
      credentialSafe: true,
    }));
  } finally {
    await app.close().catch(() => {});
    await new Promise((resolve) => server.close(resolve));
    await new Promise((resolve) => localProbe.close(resolve));
    fs.rmSync(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
