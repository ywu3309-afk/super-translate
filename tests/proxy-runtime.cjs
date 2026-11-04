'use strict';

const {_electron}=require('playwright');
const {authStore}=require('../src/auth');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const assert=require('node:assert/strict');

(async()=>{
  const profile=fs.mkdtempSync(path.join(os.tmpdir(),'st-proxy-runtime-'));
  await authStore(profile).create('proxy_admin','ProxyPass-123456');
  const env={...process.env,ST_TEST_PROFILE:profile,ST_TEST_FIXTURE:'1'};delete env.ELECTRON_RUN_AS_NODE;
  const app=await _electron.launch({executablePath:require('electron'),args:[path.resolve('src/desktop.js')],env});
  try{
    const page=await app.firstWindow();
    await page.fill('#account','proxy_admin');await page.fill('#password','ProxyPass-123456');
    await page.locator('#login-form').evaluate(form=>form.requestSubmit());await page.waitForURL('**/workbench/index.html');
    const initial=await page.evaluate(()=>window.superDesktop.proxySettings('a'));assert.equal(initial.enabled,false);
    await page.evaluate(()=>window.superDesktop.saveProxySettings({id:'a',protocol:'http',host:'127.0.0.1',port:9,enabled:false,username:'secret-user',password:'secret-pass'}));
    const saved=await page.evaluate(()=>window.superDesktop.proxySettings('a'));assert.equal(saved.enabled,false);assert.equal(saved.hasUsername,true);assert.equal(saved.hasPassword,true);assert.equal(saved.username,undefined);assert.equal(saved.password,undefined);
    const tested=await page.evaluate(()=>window.superDesktop.testProxy({id:'a',protocol:'http',host:'127.0.0.1',port:9,enabled:false}));assert.equal(tested.enabled,false);assert.equal(tested.ok,true);
    const enabledTest=await page.evaluate(()=>window.superDesktop.testProxy({id:'a',protocol:'http',host:'127.0.0.1',port:9,enabled:true}));assert.equal(enabledTest.enabled,true);assert.equal(enabledTest.ok,true);assert.match(enabledTest.route,/PROXY|DIRECT/);
    await page.click('[data-tool="proxy"]');await page.waitForSelector('.proxy-settings-card');assert.match(await page.textContent('.proxy-settings-card'),/代理协议/);assert.match(await page.textContent('.proxy-settings-card'),/测试代理/);assert.match(await page.textContent('.proxy-settings-card'),/保存代理设置/);
    console.log(JSON.stringify({ok:true,checks:13,initial,saved:{...saved,localIp:undefined},test:tested,enabledTest}));
  }finally{await app.close();try{fs.rmSync(profile,{recursive:true,force:true});}catch{}}
})().catch(error=>{console.error(error);process.exit(1)});
