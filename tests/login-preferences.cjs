'use strict';

// End-to-end login preference coverage.  The account service is an isolated
// loopback fixture; no production host, real credentials, or WhatsApp chat is
// contacted.  The test intentionally never prints the generated password.
const { _electron } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { createLoginPreferences } = require('../src/login-preferences');

const root = path.resolve(__dirname, '..');
const electronPath = path.join(root, 'node_modules', 'electron', 'dist', 'electron.exe');

function startAuthFixture(credentials) {
  let rejectNext = false;
  const calls = [];
  const server = http.createServer((request, response) => {
    const finish = (status, payload) => { response.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' }); response.end(JSON.stringify(payload)); };
    if (request.method !== 'POST') return finish(404, { ok: false });
    let raw = ''; request.setEncoding('utf8'); request.on('data', chunk => { raw += chunk; });
    request.on('end', () => {
      let body = {}; try { body = JSON.parse(raw || '{}'); } catch { return finish(400, { ok: false, error: 'invalid_json' }); }
      calls.push(request.url);
      if (request.url === '/api/login') {
        if (rejectNext) { rejectNext = false; return finish(401, { ok: false, error: 'invalid' }); }
        if (body.username === credentials.username && body.password === credentials.password) return finish(200, { ok: true, token: 'fixture-admin-token', admin: { username: credentials.username, role: '管理员' } });
        return finish(401, { ok: false, error: 'invalid' });
      }
      if (request.url === '/api/customer-login') return finish(401, { ok: false, error: 'invalid' });
      return finish(404, { ok: false });
    });
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve({
      base: `http://127.0.0.1:${server.address().port}`,
      calls,
      rejectNext: () => { rejectNext = true; },
      close: () => new Promise(done => server.close(() => done()))
    }));
  });
}

async function launch(profile, cloudBase) {
  const env = { ...process.env, ST_TEST_PROFILE: profile, ST_CLOUD_BASE: cloudBase, ST_TEST_FIXTURE: '1' };
  delete env.ELECTRON_RUN_AS_NODE;
  return _electron.launch({ executablePath: electronPath, args: [path.join(root, 'src', 'desktop.js')], env });
}

(async () => {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'super-translate-login-preferences-'));
  const credentials = { username: `pref_${crypto.randomBytes(8).toString('hex')}`, password: `P-${crypto.randomBytes(24).toString('base64url')}` };
  const fixture = await startAuthFixture(credentials);
  const checks = [];
  const ok = (name, value) => { assert.ok(value, name); checks.push(name); };
  const preferenceFile = path.join(profile, 'login-preferences-v2.json');
  let app;
  try {
    const fakeFile = fs.mkdtempSync(path.join(os.tmpdir(), 'super-translate-login-pref-unit-'));
    const fakeStorage = { isEncryptionAvailable: () => true, encryptString: value => Buffer.from(`enc:${value}`), decryptString: value => value.toString().slice(4) };
    const boundary = createLoginPreferences(fakeFile, fakeStorage);
    boundary.save({ username: 'boundary_user', password: 'Boundary-Password', remember: false, autoLogin: true });
    ok('Privileged save refuses remember=false and writes no credential file', !fs.existsSync(boundary.file));
    const oldId = boundary.save({ username: 'old_account', password: 'Old-Boundary-Password', accountType: 'customer', remember: true, autoLogin: false }).id;
    const newId = boundary.save({ username: 'new_account', password: 'New-Boundary-Password', accountType: 'customer', remember: true, autoLogin: true }).id;
    const accountList = boundary.list();
    ok('Multiple remembered accounts are retained instead of overwritten', accountList.accounts.length === 2 && accountList.accounts.some(item => item.id === oldId) && accountList.accounts.some(item => item.id === newId));
    ok('Saved-account list never returns passwords or encrypted blobs', !JSON.stringify(accountList).includes('Boundary-Password') && !JSON.stringify(accountList).includes('encryptedPassword'));
    ok('Only one remembered account owns automatic login', accountList.accounts.filter(item => item.autoLogin).length === 1 && accountList.accounts.find(item => item.autoLogin).id === newId);
    ok('A selected old account decrypts only on explicit get', boundary.get(oldId).password === 'Old-Boundary-Password');
    boundary.save({ username: 'selected_without_auto', password: 'Selected-Boundary-Password', accountType: 'customer', remember: true, autoLogin: false });
    boundary.disableAutoLogin();
    ok('Explicit logout disables auto-login for every remembered identity', boundary.list().accounts.every(item => item.autoLogin === false));
    boundary.remove(newId);
    ok('Removing one remembered account preserves the others', boundary.list().accounts.length === 2 && boundary.get(oldId).saved === true);
    fs.rmSync(fakeFile, { recursive: true, force: true });

    app = await launch(profile, fixture.base);
    let page = await app.firstWindow();
    await page.waitForLoadState('domcontentloaded');
    ok('Unauthenticated entry shortcut is removed', await page.locator('#enter-workbench').count() === 0);
    ok('Remember-password control is present', await page.locator('#remember-login').count() === 1);
    ok('Auto-login control is present', await page.locator('#auto-login').count() === 1);
    ok('Auto-login starts dependent on remember-password', await page.locator('#auto-login').isDisabled());

    await page.locator('#account').fill(credentials.username);
    await page.locator('#password').fill(credentials.password);
    // The visual checkbox input is intentionally visually hidden and the
    // adjacent span draws the control. Click the associated labels, as a
    // user would, rather than asking Playwright to click the 1px input
    // underneath the decorative span.
    await page.locator('label[for="remember-login"]').click();
    await page.locator('label[for="auto-login"]').click();
    await page.locator('#login-form').evaluate(form => form.requestSubmit());
    await page.waitForURL('**/workbench/index.html');
    ok('Remember and auto-login preferences survive accepted login', fs.existsSync(preferenceFile));
    const stored = JSON.parse(fs.readFileSync(preferenceFile, 'utf8'));
    ok('Saved preference marks auto-login without plaintext password', stored.version === 2 && stored.accounts.length === 1 && stored.accounts[0].autoLogin === true && stored.accounts[0].encryptedPassword && !JSON.stringify(stored).includes(credentials.password));

    await app.close(); app = null;
    app = await launch(profile, fixture.base);
    page = await app.firstWindow();
    await page.waitForURL('**/login/index.html');
    await page.waitForURL('**/workbench/index.html', { timeout: 8000 });
    ok('Automatic login enters the workbench on the next launch', true);
    ok('Automatic login makes one bounded admin request', fixture.calls.filter(pathname => pathname === '/api/login').length === 2);

    await app.close(); app = null;
    fixture.rejectNext();
    app = await launch(profile, fixture.base);
    page = await app.firstWindow();
    await page.waitForURL('**/login/index.html');
    await page.waitForFunction(() => /自动登录失败/.test(document.querySelector('#form-status')?.textContent || ''), null, { timeout: 8000 });
    const callsAfterFailure = fixture.calls.length;
    await page.waitForTimeout(900);
    ok('Automatic-login failure stays on login without a retry loop', page.url().includes('/login/index.html') && fixture.calls.length === callsAfterFailure);
    const disabledRecord = JSON.parse(fs.readFileSync(preferenceFile, 'utf8'));
    ok('Automatic-login failure disables only the auto-login bit', disabledRecord.accounts.length === 1 && disabledRecord.accounts[0].autoLogin === false);
    await page.locator('label[for="remember-login"]').click(); await page.waitForTimeout(150);
    ok('Unchecking remember-password keeps existing saved accounts until explicit removal', fs.existsSync(preferenceFile));
    await page.locator('#clear-saved-login').click(); await page.waitForTimeout(150);
    ok('Explicit removal deletes the selected encrypted preference', !fs.existsSync(preferenceFile));

    console.log(JSON.stringify({ ok: true, passed: checks.length, checks }));
  } finally {
    await app?.close().catch(() => {});
    await fixture.close().catch(() => {});
    try { fs.rmSync(profile, { recursive: true, force: true }); } catch {}
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
