'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'desktop.js'), 'utf8');
const required = [
  ['DOM-ready fallback makes the service view visible', "v.webContents.on('dom-ready',()=>{installWhatsAppMediaBridge(v.webContents).catch(()=>{});markViewReady();})"],
  ['main-frame navigation starts the bounded loading state', "v.webContents.on('did-start-navigation',(details)=>{if(!details?.isMainFrame||details.isInPlace)return;"],
  ['did-stop-loading fallback makes the service view visible', "v.webContents.on('did-stop-loading',()=>{if(!v.__superTranslateLoadFailed)markViewReady();})"],
  ['ready fallback rejects unknown or blank documents', '!platformURL(platform,v.webContents.getURL())'],
  ['service view load timeout is bounded', 'v===activeView&&!v.__superTranslateReady&&!v.__superTranslateLoadFailed'],
  ['service view load failures remain retryable', 'failViewLoad(`${config.name} 登录页面加载失败，请检查网络或代理后重试。`)'],
  ['non-WhatsApp platform initialization is sent once', '!v.__superTranslateInitialized&&!v.webContents.isDestroyed()'
  ]
];

for (const [name, fragment] of required) assert.ok(source.includes(fragment), name);
assert.ok(source.includes('v.__superTranslateInitialized=true'), 'non-WhatsApp initialization is marked complete');
assert.ok(source.includes('setTimeout(()=>{if(v===activeView'), 'service view timeout is scheduled');
console.log(JSON.stringify({ ok: true, passed: required.length, checks: required.map(([name]) => name) }));
