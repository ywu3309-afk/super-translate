'use strict';

// End-to-end contract for the account center: entitlement information must be
// read from the authenticated cloud response and rendered without exposing a
// bearer token to the renderer.
const {_electron}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const http=require('node:http');
const path=require('node:path');

(async()=>{
  const credentials={username:'usage_customer',password:'Usage-Customer-6285'};
  const calls=[];
  const server=http.createServer((request,response)=>{
    const finish=(status,payload)=>{response.writeHead(status,{'content-type':'application/json'});response.end(JSON.stringify(payload));};
    let raw='';request.setEncoding('utf8');request.on('data',chunk=>raw+=chunk);request.on('end',()=>{
      let body={};try{body=JSON.parse(raw||'{}')}catch{}
      calls.push({method:request.method,path:request.url,authorization:request.headers.authorization||''});
      if(request.method==='POST'&&request.url==='/api/login')return finish(401,{ok:false,error:'invalid'});
      if(request.method==='POST'&&request.url==='/api/customer-login'&&body.username===credentials.username&&body.password===credentials.password){
        return finish(200,{ok:true,token:'usage-customer-token',customer:{id:'usage-1',username:credentials.username,role:'客户',accountType:'customer',plan:'全球商务版',quota:876543,used:12345,expires:'2026-12-31',status:'active',parentId:null,canManageSubaccounts:true}});
      }
      if(request.method==='GET'&&request.url==='/api/customer-usage'&&request.headers.authorization==='Bearer usage-customer-token'){
        return finish(200,{ok:true,username:credentials.username,role:'主账号',accountType:'customer',plan:'全球商务版',quota:876543,used:12345,expires:'2026-12-31',dailyUsage:[
          {date:'2026-09-08',characters:120},{date:'2026-09-09',characters:0},{date:'2026-09-10',characters:4567}
        ],canManageSubaccounts:true,parentId:null});
      }
      if(request.method==='GET'&&request.url==='/api/customer-subaccounts'&&request.headers.authorization==='Bearer usage-customer-token'){
        return finish(200,{ok:true,limit:3,used:0,parent:{username:credentials.username},subaccounts:[]});
      }
      return finish(404,{ok:false,error:'not_found'});
    });
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  const profile=fs.mkdtempSync(path.join(require('node:os').tmpdir(),'st-user-center-'));
  const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>!['ELECTRON_RUN_AS_NODE','ST_TEST_PROFILE','ST_CLOUD_BASE','ST_TEST_FIXTURE'].includes(key.toUpperCase())));
  Object.assign(env,{ST_TEST_PROFILE:profile,ST_CLOUD_BASE:`http://127.0.0.1:${server.address().port}`,ST_TEST_FIXTURE:'1'});
  const app=await _electron.launch({executablePath:path.resolve('node_modules/electron/dist/electron.exe'),args:[path.resolve('src/desktop.js')],env});
  try{
    const page=await app.firstWindow();const pageErrors=[];page.on('pageerror',error=>pageErrors.push(error.message));
    await page.fill('#account',credentials.username);await page.fill('#password',credentials.password);
    await page.locator('#login-form').evaluate(form=>form.requestSubmit());await page.waitForURL('**/workbench/index.html');
    await page.waitForFunction(()=>document.body.classList.contains('live-mode'),'real WhatsApp view should be enabled automatically');
    assert.deepEqual(pageErrors,[],'workbench startup must not fall back to a demo page after user-center initialization');
    assert.equal(await page.locator('.contact-column').isVisible(),false,'static demo contact column must remain hidden in desktop runtime');
    await page.click('[data-action="user-center"]');await page.waitForSelector('.user-center-card');
    const text=await page.locator('#tool-panel').textContent();
    assert.match(text,/当前套餐/);assert.match(text,/全球商务版/);
    assert.match(text,/剩余额度/);assert.match(text,/876,543 字/);
    assert.match(text,/累计已用/);assert.match(text,/12,345 字/);
    assert.match(text,/到期时间/);assert.match(text,/2026年12月31日/);
    assert.equal(await page.locator('.user-center-day').count(),3,'每日明细应按云端返回的日期渲染');
    assert.equal(calls.some(call=>call.method==='GET'&&call.path==='/api/customer-usage'&&call.authorization==='Bearer usage-customer-token'),true,'用户中心必须通过主进程鉴权读取云端额度');
    assert.equal(await page.evaluate(()=>Object.keys(window.superDesktop).some(key=>/token/i.test(key))),false,'渲染进程 API 不得暴露 token');
    console.log(JSON.stringify({ok:true,checks:9,dailyBars:3,tokenExposedToRenderer:false,realViewEnabled:true}));
  }finally{
    await app.close().catch(()=>{});await new Promise(resolve=>server.close(resolve));fs.rmSync(profile,{recursive:true,force:true});
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
