'use strict';

// The llama.cpp runtime is installed outside app.asar because Windows must
// execute/load the EXE and DLL files directly.  Its integrity manifest remains
// inside the ASAR integrity boundary and every binary is verified immediately
// before the server is spawned.
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_MANIFEST = path.join(__dirname, 'runtime-integrity.json');
const BINARY_EXTENSION = /\.(?:exe|dll)$/i;
const SHA256 = /^[a-f0-9]{64}$/;

function readManifest(file = DEFAULT_MANIFEST) {
  const value = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!value || value.version !== 1 || value.algorithm !== 'sha256' || !Array.isArray(value.files) || !value.files.length || value.files.length > 256) {
    throw new Error('运行时完整性清单无效。');
  }
  const seen = new Set();
  const files = value.files.map(entry => {
    const name = String(entry?.name || '');
    const key = name.toLowerCase();
    if (path.basename(name) !== name || !BINARY_EXTENSION.test(name) || seen.has(key) || !Number.isSafeInteger(entry?.size) || entry.size < 1 || !SHA256.test(String(entry?.sha256 || ''))) {
      throw new Error('运行时完整性清单无效。');
    }
    seen.add(key);
    return { name, key, size: entry.size, sha256: entry.sha256 };
  });
  return files.sort((a, b) => a.key.localeCompare(b.key));
}

function digestFile(file, expectedSize) {
  const descriptor = fs.openSync(file, 'r');
  try {
    const before = fs.fstatSync(descriptor);
    if (!before.isFile() || before.size !== expectedSize) throw new Error('运行时文件大小不匹配。');
    const hash = crypto.createHash('sha256');
    const buffer = Buffer.allocUnsafe(1024 * 1024);
    let offset = 0;
    while (offset < before.size) {
      const count = fs.readSync(descriptor, buffer, 0, Math.min(buffer.length, before.size - offset), offset);
      if (count < 1) throw new Error('运行时文件读取不完整。');
      hash.update(buffer.subarray(0, count));
      offset += count;
    }
    const after = fs.fstatSync(descriptor);
    if (after.size !== before.size || after.mtimeMs !== before.mtimeMs) throw new Error('运行时文件在校验期间发生变化。');
    return hash.digest('hex');
  } finally {
    fs.closeSync(descriptor);
  }
}

function verifyRuntimeDirectory(directory, manifestFile = DEFAULT_MANIFEST) {
  const root = path.resolve(directory);
  if (!fs.statSync(root).isDirectory()) throw new Error('本地运行时目录无效。');
  const expected = readManifest(manifestFile);
  const actualEntries = fs.readdirSync(root, { withFileTypes: true })
    .filter(entry => BINARY_EXTENSION.test(entry.name));
  const actualNames = actualEntries.map(entry => entry.name.toLowerCase()).sort();
  const expectedNames = expected.map(entry => entry.key);
  if (actualNames.length !== expectedNames.length || actualNames.some((name, index) => name !== expectedNames[index])) {
    throw new Error('本地运行时文件清单不匹配。');
  }
  for (const entry of expected) {
    const full = path.join(root, entry.name);
    const metadata = fs.lstatSync(full);
    if (!metadata.isFile() || metadata.isSymbolicLink()) throw new Error('本地运行时文件类型无效。');
    const actualHash = digestFile(full, entry.size);
    const matches = crypto.timingSafeEqual(Buffer.from(actualHash, 'hex'), Buffer.from(entry.sha256, 'hex'));
    if (!matches) throw new Error('本地运行时完整性校验失败。');
  }
  return { ok: true, algorithm: 'sha256', files: expected.length };
}

module.exports = { verifyRuntimeDirectory, readManifest, DEFAULT_MANIFEST };
