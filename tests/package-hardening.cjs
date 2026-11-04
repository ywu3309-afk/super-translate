'use strict';

// Build/package hardening checks.  The static checks run without a build; the
// optional artifact checks inspect the Windows unpacked executable produced by
// electron-builder.  Set ST_REQUIRE_PACKAGED_HARDENING=1 in CI/release checks
// so a stale or missing artifact cannot be mistaken for a hardened build.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const packageFile = path.join(root, 'package.json');
const lockFile = path.join(root, 'package-lock.json');
const desktopFile = path.join(root, 'src', 'desktop.js');
const speechExtractorRoot = path.join(root, 'runtime', '7zip');
const pkg = JSON.parse(fs.readFileSync(packageFile, 'utf8'));
const lock = JSON.parse(fs.readFileSync(lockFile, 'utf8'));
const desktopSource = fs.readFileSync(desktopFile, 'utf8');
const { verifyRuntimeDirectory } = require('../src/runtime-integrity');
const expectedVersion = pkg.version;

const checks = [];
function ok(name, value) {
  assert.ok(value, name);
  checks.push(name);
}

ok(`package.json version is ${expectedVersion}`, pkg.version === expectedVersion);
ok('package-lock root version matches package.json', lock.version === expectedVersion);
ok('package-lock package entry version matches package.json', lock.packages?.['']?.version === expectedVersion);
const readinessBoundary = desktopSource.indexOf("if(process.env.ST_TEST_PROFILE");
const earlyBootstrap = readinessBoundary > 0 ? desktopSource.slice(0, readinessBoundary) : '';
ok('Packaged app strips Chromium debugging switches before readiness', /if\s*\(app\.isPackaged\)/.test(earlyBootstrap) && /app\.commandLine\.removeSwitch\(name\)/.test(earlyBootstrap));
for (const debugSwitch of ['remote-debugging-port', 'remote-debugging-address', 'remote-debugging-pipe']) {
  ok(`Packaged app strips ${debugSwitch}`, earlyBootstrap.includes(`'${debugSwitch}'`));
}
ok('Packaged authorization cannot fall back to a user-writable local administrator', /if\s*\(\s*!app\.isPackaged\s*&&\s*auth\.required\(\)\s*\)/.test(desktopSource));
const nativeBranch = desktopSource.indexOf('if(nativeRuntimeAvailable()){');
const runtimeVerification = desktopSource.indexOf('verifyNativeRuntime();', nativeBranch);
const nativeSpawn = Math.max(desktopSource.indexOf('child=spawn(', nativeBranch), desktopSource.indexOf('processHandle=spawn(', nativeBranch));
ok('Native runtime integrity is verified immediately before its process can spawn', nativeBranch > 0 && runtimeVerification > nativeBranch && nativeSpawn > runtimeVerification);
const runtimeCheck = verifyRuntimeDirectory(path.join(root, 'runtime', 'llama-cpp'));
ok('SHA-256 manifest matches all shipped llama.cpp binaries', runtimeCheck.ok === true && runtimeCheck.files === 23);

const build = pkg.build || {};
ok('ASAR packaging is explicitly enabled', build.asar === true);

const expectedFuses = {
  runAsNode: false,
  enableCookieEncryption: true,
  enableNodeOptionsEnvironmentVariable: false,
  enableNodeCliInspectArguments: false,
  enableEmbeddedAsarIntegrityValidation: true,
  onlyLoadAppFromAsar: true,
  // Keep file:// origin continuity for v0.7.3: current customer settings,
  // internal notes and TrafficCRM IndexedDB were created under that origin.
  // Turning this off requires a tested one-time data migration to a custom
  // protocol; Electron 44 also cannot load these ASAR renderer files without
  // the compatibility fuse.
  grantFileProtocolExtraPrivileges: true,
};
for (const [name, value] of Object.entries(expectedFuses)) {
  ok(`Electron fuse ${name} is ${value ? 'enabled' : 'disabled'}`, build.electronFuses?.[name] === value);
}

// Keep app code in an explicit allowlist.  Runtime/model binaries are copied
// as extraResources on purpose; they must not turn into a broad app source
// glob.  In particular, tests, VCS metadata and source maps stay out of ASAR.
const files = Array.isArray(build.files) ? build.files : [];
ok('Build uses an explicit app file allowlist', files.length > 0);
ok('Build allowlist excludes VCS metadata', !files.some(pattern => /(?:^|[\\/])\.git(?:[\\/]|$)/i.test(String(pattern))));
ok('Build allowlist excludes tests', !files.some(pattern => /(?:^|[\\/])tests?(?:[\\/]|$)/i.test(String(pattern))));
ok('Build allowlist explicitly excludes source maps', files.some(pattern => /^!.*\.map(?:$|[?])/i.test(String(pattern))));
ok('Build includes runtime integrity verifier inside ASAR', files.includes('src/runtime-integrity.js'));
ok('Build includes runtime SHA-256 manifest inside ASAR', files.includes('src/runtime-integrity.json'));
ok('llama.cpp remains an external runtime resource', Array.isArray(build.extraResources) && build.extraResources.some(item => String(item?.from || '') === 'runtime/llama-cpp'));
ok('7-Zip speech-model extractor remains an external runtime resource', Array.isArray(build.extraResources) && build.extraResources.some(item => String(item?.from || '') === 'runtime/7zip'));
ok('Whisper worker remains an external runtime resource', Array.isArray(build.extraResources) && build.extraResources.some(item => String(item?.from || '') === 'runtime/whisper_worker.py'));
ok('Whisper worker hash is pinned inside ASAR-protected code', /WHISPER_WORKER_SHA256='[A-F0-9]{64}'/.test(fs.readFileSync(path.join(root, 'src', 'speech-runtime.js'), 'utf8')));
const speechExtractorHashes = {
  '7z.exe': 'C7245E21A7553D9E52D434002A401C77A7CA7D0F245F2311B0DDF16F8F946C6F',
  '7z.dll': '9ED007AA82E440CEB39A6E105BB1D602A9BC59A4946267BA8DE2F220AA15BC06',
};
const crypto = require('node:crypto');
for (const [name, expected] of Object.entries(speechExtractorHashes)) {
  const file = path.join(speechExtractorRoot, name);
  ok(`Speech-model extractor ${name} exists`, fs.existsSync(file));
  ok(`Speech-model extractor ${name} SHA-256 matches`, crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex').toUpperCase() === expected);
}
ok('Speech-model extractor license is bundled', fs.existsSync(path.join(speechExtractorRoot, 'LICENSE.txt')));
ok('Speech-model extractor provenance is bundled', fs.existsSync(path.join(speechExtractorRoot, 'PROVENANCE.txt')));

async function inspectPackagedArtifact() {
  // Existing dist output can legitimately belong to an older release while
  // static checks are being run.  Artifact inspection is therefore explicit;
  // release CI sets ST_REQUIRE_PACKAGED_HARDENING=1 after building v0.7.3.
  if (process.env.ST_REQUIRE_PACKAGED_HARDENING !== '1' && process.env.ST_CHECK_PACKAGED_HARDENING !== '1') {
    return { skipped: true, reason: 'set ST_CHECK_PACKAGED_HARDENING=1 to inspect dist' };
  }
  const executable = path.join(root, 'dist', 'win-unpacked', '超级翻译.exe');
  const asar = path.join(root, 'dist', 'win-unpacked', 'resources', 'app.asar');
  const required = process.env.ST_REQUIRE_PACKAGED_HARDENING === '1';
  if (!fs.existsSync(executable) || !fs.existsSync(asar)) {
    if (required) {
      throw new Error('缺少 dist/win-unpacked 硬化产物；请先运行 npm run build -- --publish never。');
    }
    return { skipped: true };
  }

  // @electron/fuses exposes the authoritative fuse-wire reader.  Compare the
  // numeric wire states rather than parsing human-oriented CLI output.
  const { getCurrentFuseWire, FuseV1Options } = require('@electron/fuses');
  const wire = await getCurrentFuseWire(executable);
  ok('Packaged executable contains a v1 Electron fuse wire', wire?.version === '1');
  for (const [name, value] of Object.entries(expectedFuses)) {
    const index = FuseV1Options[name === 'runAsNode' ? 'RunAsNode'
      : name === 'enableCookieEncryption' ? 'EnableCookieEncryption'
      : name === 'enableNodeOptionsEnvironmentVariable' ? 'EnableNodeOptionsEnvironmentVariable'
      : name === 'enableNodeCliInspectArguments' ? 'EnableNodeCliInspectArguments'
      : name === 'enableEmbeddedAsarIntegrityValidation' ? 'EnableEmbeddedAsarIntegrityValidation'
      : name === 'onlyLoadAppFromAsar' ? 'OnlyLoadAppFromAsar'
      : 'GrantFileProtocolExtraPrivileges'];
    // FuseState is intentionally not part of @electron/fuses' public export;
    // v1 stores ENABLE/DISABLE as the ASCII bytes for "1"/"0".
    const expectedState = (value ? '1' : '0').charCodeAt(0);
    ok(`Packaged fuse ${name} matches config`, wire?.[index] === expectedState);
  }

  ok('Packaged app contains app.asar', fs.statSync(asar).isFile());
  const packagedSpeechExtractorRoot = path.join(root, 'dist', 'win-unpacked', 'resources', 'runtime', '7zip');
  for (const [name, expected] of Object.entries(speechExtractorHashes)) {
    const file = path.join(packagedSpeechExtractorRoot, name);
    ok(`Packaged speech-model extractor ${name} exists`, fs.existsSync(file));
    ok(`Packaged speech-model extractor ${name} SHA-256 matches`, fs.existsSync(file) && crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex').toUpperCase() === expected);
  }
  ok('Packaged speech-model extractor license exists', fs.existsSync(path.join(packagedSpeechExtractorRoot, 'LICENSE.txt')));
  ok('Packaged speech-model extractor provenance exists', fs.existsSync(path.join(packagedSpeechExtractorRoot, 'PROVENANCE.txt')));
  const { listPackage } = require('@electron/asar');
  const entries = listPackage(asar, { isPack: true });
  ok('Packaged ASAR excludes source maps', !entries.some(entry => /\.map$/i.test(String(entry))));
  ok('Packaged ASAR excludes test files', !entries.some(entry => /(?:^|[\\/])tests?(?:[\\/]|$)/i.test(String(entry))));
  ok('Packaged ASAR protects runtime integrity verifier', entries.some(entry => /(?:^|[\\/])src[\\/]runtime-integrity\.js$/i.test(String(entry))));
  ok('Packaged ASAR protects runtime SHA-256 manifest', entries.some(entry => /(?:^|[\\/])src[\\/]runtime-integrity\.json$/i.test(String(entry))));
  // electron-builder embeds an ELECTRONASAR integrity resource in the Windows
  // executable.  The resource is UTF-16 encoded by the PE resource writer;
  // checking both marker and algorithm catches builds that silently skipped it.
  const executableText = fs.readFileSync(executable).toString('utf16le');
  ok('Packaged executable embeds ASAR integrity metadata', executableText.includes('ELECTRONASAR') && executableText.includes('SHA256'));
  return { skipped: false };
}

(async () => {
  const artifact = await inspectPackagedArtifact();
  console.log(JSON.stringify({ ok: true, version: pkg.version, checks: checks.length, artifact }, null, 2));
})().catch(error => {
  console.error(error?.stack || error);
  process.exitCode = 1;
});
