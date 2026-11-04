'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { verifyRuntimeDirectory } = require('../src/runtime-integrity');

const root = path.resolve(__dirname, '..');
const shippedRuntime = path.join(root, 'runtime', 'llama-cpp');
const shipped = verifyRuntimeDirectory(shippedRuntime);
assert.equal(shipped.ok, true);
assert.equal(shipped.files, 23, 'manifest must cover every shipped llama.cpp EXE/DLL');

const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'super-translate-runtime-integrity-'));
const manifestFile = path.join(fixture, 'manifest.json');
const digest = value => crypto.createHash('sha256').update(value).digest('hex');
const server = Buffer.from('fixture-server-binary');
const library = Buffer.from('fixture-library-binary');

try {
  fs.writeFileSync(path.join(fixture, 'llama-server.exe'), server);
  fs.writeFileSync(path.join(fixture, 'llama.dll'), library);
  fs.writeFileSync(manifestFile, JSON.stringify({
    version: 1,
    algorithm: 'sha256',
    files: [
      { name: 'llama-server.exe', size: server.length, sha256: digest(server) },
      { name: 'llama.dll', size: library.length, sha256: digest(library) }
    ]
  }));

  assert.equal(verifyRuntimeDirectory(fixture, manifestFile).files, 2, 'valid fixture runtime must pass');
  const tamperedServer = Buffer.from(server); tamperedServer[0] ^= 0xff;
  fs.writeFileSync(path.join(fixture, 'llama-server.exe'), tamperedServer);
  assert.throws(() => verifyRuntimeDirectory(fixture, manifestFile), /完整性/, 'same-size SHA-256 mismatch must be rejected');

  fs.writeFileSync(path.join(fixture, 'llama-server.exe'), server);
  fs.writeFileSync(path.join(fixture, 'unexpected.dll'), 'unexpected');
  assert.throws(() => verifyRuntimeDirectory(fixture, manifestFile), /清单不匹配/, 'unlisted DLL must be rejected');
  console.log(JSON.stringify({ ok: true, shippedFiles: shipped.files, checks: 4 }));
} finally {
  fs.rmSync(fixture, { recursive: true, force: true });
}
