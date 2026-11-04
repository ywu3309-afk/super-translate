'use strict';

const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

function guardPath() {
  const packaged = path.join(process.resourcesPath || '', 'guard', 'guard.exe');
  if (process.resourcesPath && fs.existsSync(packaged)) return packaged;
  return path.join(__dirname, '..', 'native', 'guard.exe');
}

function available() {
  try { return fs.existsSync(guardPath()); } catch { return false; }
}

function run(request, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const exe = guardPath();
    if (!fs.existsSync(exe)) return reject(new Error('native guard is not installed'));
    const child = spawn(exe, [], { windowsHide: true, stdio: ['pipe', 'pipe', 'ignore'] });
    let out = '';
    let done = false;
    const timer = setTimeout(() => {
      if (done) return;
      done = true;
      try { child.kill(); } catch {}
      reject(new Error('native guard timeout'));
    }, timeoutMs);
    child.stdout.on('data', chunk => { out = (out + String(chunk)).slice(0, 64 * 1024); });
    child.once('error', error => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      reject(error);
    });
    child.once('close', code => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      let data = null;
      try { data = JSON.parse(out.trim()); } catch {}
      if (!data) return reject(new Error(`native guard exited ${code}`));
      if (!data.ok) return reject(new Error(String(data.error || 'native guard rejected the request')));
      resolve(data);
    });
    child.stdin.end(JSON.stringify(request));
  });
}

function machineCode() {
  return run({ op: 'machine' }).then(data => data.machine);
}

function verifyLicense(file) {
  return run({ op: 'verify', file });
}

function login(directory, username, password) {
  return run({ op: 'login', dir: directory, username, password }).then(data => ({
    username: data.username,
    role: data.role || 'administrator',
  }));
}

module.exports = { available, machineCode, verifyLicense, login, guardPath };
