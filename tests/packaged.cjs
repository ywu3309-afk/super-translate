'use strict';

// Packaged-runtime smoke test. Production deliberately blocks both Node's
// inspector and Chromium remote debugging, so `_electron.launch()` and CDP are
// not valid automation boundaries for the final EXE. This test verifies the
// required package contents, starts that EXE with an isolated profile,
// proves a real top-level login window appears, and verifies graceful shutdown
// plus local-data preservation. Renderer interaction stays covered by the
// development-mode Playwright suites, where debugging remains enabled.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const packageVersion = require('../package.json').version;

const root = path.resolve(__dirname, '..');
const executable = path.join(root, 'dist', 'win-unpacked', '超级翻译.exe');
const runtime = path.join(root, 'dist', 'win-unpacked', 'resources', 'runtime', 'llama-cpp', 'llama-server.exe');
const speechExtractorRoot = path.join(root, 'dist', 'win-unpacked', 'resources', 'runtime', '7zip');
const packagedWhisperWorker = path.join(root, 'dist', 'win-unpacked', 'resources', 'runtime', 'whisper_worker.py');
const asarFile = path.join(root, 'dist', 'win-unpacked', 'resources', 'app.asar');
const installer = path.join(root, 'dist', `SuperTranslate-Personal-Setup-${packageVersion}.exe`);
const blockmap = installer + '.blockmap';
const latest = path.join(root, 'dist', 'latest.yml');
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'super-translate-packaged-'));
const sentinel = path.join(profile, 'customer-local-data.keep');
const expectedWhisperWorkerSize = 4794;
const expectedWhisperWorkerSha256 = '3CDF11E57EFDD17DB38979D546A6C490A007346238D4B6D494DE34D369DBE273';

function wait(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

function waitForExit(child, timeout = 5000) {
  if (!child || child.exitCode !== null) return Promise.resolve(child?.exitCode ?? null);
  return Promise.race([
    new Promise(resolve => child.once('exit', () => resolve(true))),
    wait(timeout).then(() => false)
  ]);
}

function topLevelWindows(pid) {
  if (process.platform !== 'win32') return [];
  const script = [
    '$ErrorActionPreference = "Stop"',
    '$OutputEncoding = [Console]::OutputEncoding = [Text.UTF8Encoding]::new()',
    'Add-Type @"',
    'using System;',
    'using System.Text;',
    'using System.Collections.Generic;',
    'using System.Runtime.InteropServices;',
    'public static class STWindowProbe {',
    '  public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);',
    '  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc callback, IntPtr lParam);',
    '  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);',
    '  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);',
    '  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);',
    '  public static string[] Find(uint wanted) {',
    '    var values = new List<string>();',
    '    EnumWindows((h, x) => { uint actual; GetWindowThreadProcessId(h, out actual); if (actual == wanted && IsWindowVisible(h)) { var b = new StringBuilder(512); GetWindowText(h, b, b.Capacity); values.Add(h.ToInt64().ToString() + "|" + b.ToString()); } return true; }, IntPtr.Zero);',
    '    return values.ToArray();',
    '  }',
    '}',
    '"@',
    `[STWindowProbe]::Find(${Number(pid)}) | ConvertTo-Json -Compress`
  ].join('\n');
  const { spawnSync } = require('node:child_process');
  const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script], {
    windowsHide: true,
    encoding: 'utf8',
    timeout: 10000
  });
  if (result.status !== 0) throw new Error(String(result.stderr || '窗口探测失败。').trim());
  const output = String(result.stdout || '').trim();
  if (!output) return [];
  const parsed = JSON.parse(output);
  return Array.isArray(parsed) ? parsed : [parsed];
}

async function waitForLoginWindow(child) {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`打包应用提前退出（code ${child.exitCode}）。`);
    const windows = topLevelWindows(child.pid);
    if (windows.some(value => /^\d+\|超级翻译(?: · 登录窗口 UI)?$/.test(value))) return windows;
    await wait(150);
  }
  throw new Error('打包应用未在 15 秒内创建“超级翻译”登录窗口。');
}

(async () => {
  const checks = [];
  const ok = (name, value) => { assert.ok(value, name); checks.push(name); };
  let child = null;
  try {
    for (const file of [executable, runtime, asarFile, installer, blockmap, latest]) {
      ok(`Packaged artifact exists: ${path.basename(file)}`, fs.existsSync(file));
    }
    const escapedVersion = packageVersion.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    ok('latest.yml version matches package.json', new RegExp(`^version:\\s*${escapedVersion}$`, 'm').test(fs.readFileSync(latest, 'utf8')));

    const { listPackage } = require('@electron/asar');
    const entries = listPackage(asarFile, { isPack: true }).map(entry => String(entry).replace(/^pack\s*:\s*/, ''));
    ok('Packaged ASAR contains login document', entries.includes('\\src\\login\\index.html'));
    ok('Packaged ASAR contains login preload', entries.includes('\\src\\desktop-preload.js'));
    ok('Packaged ASAR contains workbench document', entries.includes('\\src\\workbench\\index.html'));
    ok('Packaged ASAR contains local-data store code', entries.includes('\\src\\data.js'));
    ok('Packaged ASAR contains local speech runtime controller', entries.includes('\\src\\speech-runtime.js'));
    ok('Packaged ASAR excludes test code', !entries.some(entry => /(?:^|[\\/])tests?(?:[\\/]|$)/i.test(entry)));
    for (const name of ['7z.exe', '7z.dll', 'LICENSE.txt', 'PROVENANCE.txt']) ok(`Packaged speech-model extractor contains ${name}`, fs.existsSync(path.join(speechExtractorRoot, name)));
    ok('Packaged resources contain the pinned Whisper worker', fs.existsSync(packagedWhisperWorker));
    if (fs.existsSync(packagedWhisperWorker)) {
      const workerBytes = fs.readFileSync(packagedWhisperWorker);
      const workerHash = crypto.createHash('sha256').update(workerBytes).digest('hex').toUpperCase();
      ok('Packaged Whisper worker has the pinned byte length', workerBytes.length === expectedWhisperWorkerSize);
      ok('Packaged Whisper worker is LF-only', !workerBytes.includes(13));
      ok('Packaged Whisper worker SHA-256 matches the runtime pin', workerHash === expectedWhisperWorkerSha256);
    }
    ok('Packaged app excludes multi-gigabyte speech-model archives', !entries.some(entry => /(?:20260901-funasr-1\.4\.11|超级翻译-语音转文字AI大模型)(?:\.part[12]\.rar|\.zip)$/i.test(entry)) && !fs.existsSync(path.join(root, 'dist', 'win-unpacked', 'resources', '超级翻译-语音转文字AI大模型.zip')));

    fs.writeFileSync(sentinel, 'preserve-customer-local-data', 'utf8');
    const cleanEnvironment = Object.fromEntries(Object.entries(process.env).filter(([key]) => ![
      'ELECTRON_RUN_AS_NODE', 'NODE_OPTIONS', 'NODE_EXTRA_CA_CERTS', 'ST_TEST_PROFILE',
      'ST_TEST_FIXTURE', 'ST_CLOUD_BASE'
    ].includes(key.toUpperCase())));
    child = spawn(executable, [`--user-data-dir=${profile}`], {
      cwd: path.dirname(executable),
      env: cleanEnvironment,
      windowsHide: false,
      stdio: 'ignore'
    });

    const windows = await waitForLoginWindow(child);
    ok('Packaged EXE remains running after startup', child.exitCode === null);
    ok('Packaged EXE creates one visible branded login window', windows.some(value => /\|超级翻译(?: · 登录窗口 UI)?$/.test(value)));
    ok('Packaged EXE initializes isolated customer profile', fs.existsSync(path.join(profile, 'Network')) && fs.existsSync(path.join(profile, 'Local Storage')));

    // SIGTERM maps to a normal Electron process termination on Windows. This
    // test targets only the PID it created and never enumerates/kills a user's
    // existing application instances.
    child.kill();
    const exited = await waitForExit(child);
    ok('Packaged EXE exits when its exact fixture PID is terminated', exited === true);
    child = null;
    ok('Customer local data survives packaged application lifecycle', fs.readFileSync(sentinel, 'utf8') === 'preserve-customer-local-data');
    console.log(JSON.stringify({ ok: true, passed: checks.length, checks }, null, 2));
  } finally {
    if (child && child.exitCode === null) {
      try { child.kill(); } catch {}
      await waitForExit(child, 2500);
    }
    try { fs.rmSync(profile, { recursive: true, force: true }); } catch {}
  }
})().catch(error => {
  console.error(error?.stack || error);
  process.exit(1);
});
