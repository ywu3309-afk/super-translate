const fs=require('fs'),path=require('path');
const here=path.resolve('.'),src=path.join(here,'src');
fs.mkdirSync(path.join(src,'workbench'),{recursive:true});fs.mkdirSync(path.join(src,'login'),{recursive:true});
// src/workbench and src/login are the canonical, tested runtimes.  Do not
// overwrite either directory from the older standalone UI previews: doing so
// could silently restore the removed unauthenticated entry point, roll back
// encrypted login preferences, or erase CRM/WhatsApp behavior before release.
const loginHtml=fs.readFileSync(path.join(src,'login','index.html'),'utf8');
const loginJs=fs.readFileSync(path.join(src,'login','app.js'),'utf8');
if(/enter-workbench|免账号进入工作台/.test(loginHtml+'\n'+loginJs))throw new Error('登录页仍包含未认证工作台入口，请先移除后再同步。');
if(!/remember-login/.test(loginHtml)||!/auto-login/.test(loginHtml))throw new Error('登录页缺少记住密码/自动登录控件。');
// Keep release/version/publish metadata in package.json authoritative.  This
// helper only synchronizes UI source files; it must never silently downgrade a
// release or remove the embedded llama.cpp runtime from the package.
