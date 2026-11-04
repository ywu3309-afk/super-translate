'use strict';

// Runtime regression for the production-only Chromium debugger boundary.
// `devTools: false` does not by itself block --remote-debugging-port, so launch
// the packaged executable with the hostile switch and prove that no CDP HTTP
// endpoint becomes reachable. The test uses an isolated profile and never
// opens a WhatsApp chat or contacts the production account service.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const executable = path.join(root, 'dist', 'win-unpacked', '超级翻译.exe');

function reservePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      server.close(error => error ? reject(error) : resolve(port));
    });
  });
}

function probe(port) {
  return new Promise(resolve => {
    const request = http.get({ hostname: '127.0.0.1', port, path: '/json/version', timeout: 600 }, response => {
      response.resume();
      resolve(true);
    });
    request.once('timeout', () => { request.destroy(); resolve(false); });
    request.once('error', () => resolve(false));
  });
}

function delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

(async () => {
  assert.ok(fs.existsSync(executable), 'missing packaged executable; build before the CDP regression test');
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'super-translate-cdp-'));
  const port = await reservePort();
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  const child = spawn(executable, [
    `--user-data-dir=${profile}`,
    `--remote-debugging-port=${port}`,
    '--remote-debugging-address=127.0.0.1'
  ], { env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  const remember = chunk => { output = (output + String(chunk)).slice(-65536); };
  child.stdout.on('data', remember);
  child.stderr.on('data', remember);

  try {
    await delay(1800);
    assert.equal(child.exitCode, null, `packaged app exited during CDP test: ${output}`);
    let exposed = false;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      if (await probe(port)) { exposed = true; break; }
      await delay(450);
    }
    assert.equal(exposed, false, 'packaged app exposed a Chromium remote-debugging endpoint');
    assert.doesNotMatch(output, /DevTools listening on/i, 'packaged app announced a Chromium debugger');
    console.log(JSON.stringify({ ok: true, check: 'packaged Chromium remote debugging rejected' }));
  } finally {
    if (child.exitCode === null) child.kill();
    await Promise.race([
      new Promise(resolve => child.once('exit', resolve)),
      delay(2500)
    ]);
    try { fs.rmSync(profile, { recursive: true, force: true }); } catch {}
  }
})().catch(error => {
  console.error(error?.stack || error);
  process.exitCode = 1;
});
