'use strict';

const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'src', 'workbench', 'app.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'src', 'workbench', 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'src', 'workbench', 'styles.css'), 'utf8');

const checks = [
  ['Account pin state is normalized and persisted', /a\.pinned=a\.pinned===true/.test(app) && /localStorage\.setItem\(storageKey,JSON\.stringify\(state\)\)/.test(app)],
  ['Context menu exposes pin and unpin actions', /置顶此账号/.test(app) && /取消置顶/.test(app)],
  ['Pinned accounts are rendered before unpinned accounts', /function orderedAccounts\(\)\{return \[\.\.\.state\.accounts\]\.sort\(/.test(app) && /for\(const a of orderedAccounts\(\)\)/.test(app)],
  ['Account cards use stable IDs for drag and drop', /dataTransfer\.setData\('text\/plain',a\.id\)/.test(app) && /reorderAccounts\(e\.dataTransfer\.getData\('text\/plain'\),a\.id\)/.test(app)],
  ['Drag feedback and pinned badge styles are packaged', /\.account-button\.is-dragging/.test(css) && /\.account-button\.is-pinned::after/.test(css) && /\.account-button\.drag-over/.test(css)],
  ['Legacy tool entries are removed', !/data-tool="(?:ai|phrases)"/.test(html) && !/AI 助理|话术库/.test(html)],
  ['Proxy tool is presented as proxy settings', /data-tool="proxy"[^>]*title="代理设置"/.test(html) && /<span>代理设置<\/span>/.test(html) && !/data-action="settings"/.test(html) && /data-tool="settings"[^>]*title="模型设置"/.test(html) && /<span>模型设置<\/span>/.test(html)],
  ['Quick reply panel contains the add-and-save flow', /which==='quick'/.test(app) && /新增快捷回复/.test(app) && /保存快捷回复/.test(app)],
];

const failed = checks.filter(([, ok]) => !ok).map(([name]) => name);
if (failed.length) {
  console.error(JSON.stringify({ ok: false, failed }, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({ ok: true, checks: checks.length, feature: 'account-ordering-pinning' }));
