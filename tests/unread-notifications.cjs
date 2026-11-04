'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const app=fs.readFileSync(path.join(root,'src','workbench','app.js'),'utf8');
const preload=fs.readFileSync(path.join(root,'src','platform-preload.js'),'utf8');
const desktopPreload=fs.readFileSync(path.join(root,'src','desktop-preload.js'),'utf8');
const desktop=fs.readFileSync(path.join(root,'src','desktop.js'),'utf8');
const css=fs.readFileSync(path.join(root,'src','workbench','app.css'),'utf8');
const checks=[];
function ok(name,value){assert.ok(value,name);checks.push(name);}
ok('Account unread state is persisted on account records',/unreadDataMap\[a\.id\]=unread/.test(app)&&/account\.unread=next/.test(app));
ok('Account cards render stable IDs and unread badges',/account-card-\$\{a\.id\}/.test(app)&&/account-badge/.test(app));
ok('Unread badges clear when switching accounts',/clearAccountUnread\(id\)/.test(app));
ok('Account deletion clears unread state',/delete unreadDataMap\[account\.id\]/.test(app));
ok('Toast uses text nodes rather than message HTML',/node\('div','toast-body',String\(content/.test(app)&&!/toast\.innerHTML/.test(app));
ok('Toast click switches account and auto dismisses',/switchAccount\(accountId\)/.test(app)&&/setTimeout\(\(\)=>\{if\(!item\.isConnected\)/.test(app));
ok('Workbench exposes message and unread IPC listeners',/onAccountMessage/.test(desktopPreload)&&/onAccountUnread/.test(desktopPreload));
ok('Non-WhatsApp Notification events are forwarded',/platform:new-message/.test(preload)&&/NativeNotification/.test(preload));
ok('Main process authenticates platform message events',/ipcMain\.on\('platform:new-message'/.test(desktop)&&/trustedPlatform\(e\)/.test(desktop));
ok('WhatsApp title unread count has a main-process fallback',/lastTitleUnread/.test(desktop)&&/desktop:account-unread/.test(desktop));
ok('Pulse animation and toast styles are packaged',/\.account-button\.has-unread/.test(css)&&/\.msg-toast-container/.test(css)&&/unread-pulse/.test(css));
console.log(JSON.stringify({ok:true,passed:checks.length,checks}));
