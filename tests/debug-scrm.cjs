'use strict';
const { _electron } = require('playwright');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { prepareTestLogin, loginToWorkbench, startCloudDeclineServer } = require('./login-helper.cjs');
const root = path.resolve(__dirname, '..');

(async () => {
  const cloud = await startCloudDeclineServer();
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'super-translate-dbg-'));
  const login = await prepareTestLogin(profile);
  const env = { ...process.env, ST_TEST_PROFILE: profile, ST_TEST_FIXTURE: '1', ST_CLOUD_BASE: cloud.base };
  delete env.ELECTRON_RUN_AS_NODE;
  const app = await _electron.launch({ executablePath: require('electron'), args: [path.join(root, 'src', 'desktop.js')], env });
  const page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  await loginToWorkbench(page, login);
  console.log('URL:', page.url());
  console.log('scrmStatus:', JSON.stringify(await page.evaluate(() => window.superDesktop.scrmStatus())));
  const scrmTokenRaw = await page.evaluate(() => {
    try { return window.superDesktop.scrmToken().then(t => 'token=' + (typeof t) + ':' + String(t).slice(0, 24) + '...').catch(e => 'REJECT: ' + e.message); } catch (e) { return 'THROW: ' + e.message; }
  });
  console.log('scrmToken direct:', await scrmTokenRaw);
  await page.locator('[data-action="scrm"]').first().click();
  await page.waitForTimeout(8000);
  const ov = await page.evaluate(() => {
    const el = document.getElementById('scrm-overview');
    return { hidden: el.hidden, html: el.innerHTML.slice(0, 1500), text: el.innerText.slice(0, 600) };
  });
  console.log('overview.hidden:', ov.hidden);
  console.log('overview.text:', JSON.stringify(ov.text));
  console.log('overview.html:', ov.html);
  const stored = await page.evaluate(() => localStorage.getItem('super-translate.scrm.token') || '(empty)');
  console.log('stored token:', stored.slice(0, 40));
  // probe service from node side
  const net = require('node:net');
  const probe = await new Promise(resolve => {
    const s = net.createConnection(18801, '127.0.0.1', () => { s.end('GET /client/ HTTP/1.1\r\nHost: 127.0.0.1\r\n\r\n'); });
    let buf = '';
    s.on('data', d => buf += d);
    s.on('close', () => resolve(buf.slice(0, 300)));
    s.on('error', e => resolve('CONN_ERR: ' + e.message));
    setTimeout(() => resolve('TIMEOUT: ' + buf.slice(0, 300)), 3000);
  });
  console.log('port probe:', JSON.stringify(probe));
  await app.close();
  await cloud.close();
})().catch(e => { console.error(e.stack || e); process.exit(1); });
