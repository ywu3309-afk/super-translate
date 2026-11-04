'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const model = read('src/workbench/model.js');
const workbench = read('src/workbench/index.html');
const app = read('src/workbench/app.js');
const desktop = read('src/desktop.js');
const wa = read('src/wa-preload.js');
const platform = read('src/platform-preload.js');
const packageJson = read('package.json');

const checks = [
  ['translation master switch is present', 'id="translation-enabled" data-setting="enabled"'],
  ['translation is enabled by default', "enabled:true,automatic:true"],
  ['live config carries the master switch', 'enabled:cfg.enabled!==false'],
  ['workbench disables translation work when off', "effective.enabled!==false&&effective.translateSend"],
  ['WhatsApp blocks translation requests when off', "if(config.enabled===false)throw new Error('翻译功能已关闭，请先开启。')"],
  ['platform blocks translation requests when off', "if(config.enabled===false)throw new Error('翻译功能已关闭，请先开启。')"],
  ['clipboard shortcuts are handled by main process', "const editCommand={c:'copy',x:'cut',v:'paste',a:'selectAll'}[key]"],
  ['clipboard context menu is available', "contents.on('context-menu'"],
  ['electron-builder uses the pinned package manager', '"packageManager": "pnpm@11.25.0"'],
];

for (const [name, fragment] of checks) {
  assert.ok([model, workbench, app, desktop, wa, platform, packageJson].some(source => source.includes(fragment)), name);
}

console.log(JSON.stringify({ok: true, passed: checks.length, checks: checks.map(([name]) => name)}));
