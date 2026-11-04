'use strict';

const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const desktop = fs.readFileSync(path.join(root, 'src', 'desktop.js'), 'utf8');
const preload = fs.readFileSync(path.join(root, 'src', 'desktop-preload.js'), 'utf8');
const app = fs.readFileSync(path.join(root, 'src', 'workbench', 'app.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'src', 'workbench', 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'src', 'workbench', 'styles.css'), 'utf8');

const checks = [
  ['Proxy profiles are stored by account in the main process', /proxyProfiles\(\)/.test(desktop) && /saveProxyProfile/.test(desktop)],
  ['Proxy credentials use safeStorage encryption', /safeStorage\.encryptString/.test(desktop) && /safeStorage\.decryptString/.test(desktop) && /usernameEncrypted/.test(desktop) && /passwordEncrypted/.test(desktop)],
  ['Renderer IPC never receives proxy secrets', /hasUsername/.test(desktop) && /hasPassword/.test(desktop) && !/username:\s*readProxySecret/.test(desktop) && !/password:\s*readProxySecret/.test(desktop)],
  ['Each account session applies its own proxy rules', /proxyPartition\(id,platform\)/.test(desktop) && /await applyProxyToSession\(id,ses\)/.test(desktop) && /session\.fromPartition\(proxyPartition\(id\)/.test(desktop)],
  ['Deleting an account removes its saved proxy profile', /delete profiles\[safeId\]/.test(desktop) && /destroyView\(input\?\.id/.test(desktop)],
  ['Proxy authentication is handled only for the configured proxy host', /authInfo\?\.isProxy/.test(desktop) && /authInfo\.host!==config\.host/.test(desktop)],
  ['Proxy settings, save and test methods are exposed to the workbench', /proxySettings:id=>invoke\('proxy-settings',id\)/.test(preload) && /saveProxySettings:input=>invoke\('save-proxy-settings',input\)/.test(preload) && /testProxy:input=>invoke\('test-proxy',input\)/.test(preload)],
  ['Proxy settings UI contains protocol, host, port, test and save controls', /代理协议/.test(app) && /代理主机/.test(app) && /端口/.test(app) && /测试代理/.test(app) && /保存代理设置/.test(app)],
  ['Proxy settings and model settings are visible tool entries', /data-tool="proxy"[^>]*title="代理设置"/.test(html) && /<span>代理设置<\/span>/.test(html) && /data-tool="settings"[^>]*title="模型设置"/.test(html) && /<span>模型设置<\/span>/.test(html)],
  ['Proxy panel has scoped account and status styling', /\.proxy-settings-card/.test(css) && /\.proxy-route-status/.test(css) && /\.proxy-actions/.test(css)],
];

const failed = checks.filter(([, ok]) => !ok).map(([name]) => name);
if (failed.length) {
  console.error(JSON.stringify({ ok: false, failed }, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({ ok: true, checks: checks.length, feature: 'per-account-proxy-settings' }));
