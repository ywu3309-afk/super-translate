'use strict';

// Cross-computer login contract.  The fixture intentionally starts with no
// local-admin record: cloud administrators and customers must still be able
// to enter the workbench.  Passwords and bearer tokens are never printed.
const {_electron}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const http=require('node:http');
const path=require('node:path');

(async()=>{
  const calls=[];
  const credentials={
    admin:{username:'cloud_admin',password:'CloudAdmin-6285'},
    customer:{username:'cloud_customer',password:'CloudCustomer-6285'},
    pending:{username:'pending_customer',password:'Pending-6285'}
  };
  const server=http.createServer((request,response)=>{
    const finish=(status,payload)=>{response.writeHead(status,{'content-type':'application/json'});response.end(JSON.stringify(payload));};
    if(request.method!=='POST'){return finish(404,{ok:false});}
    let raw='';request.setEncoding('utf8');request.on('data',chunk=>raw+=chunk);request.on('end',()=>{
      let body={};try{body=JSON.parse(raw||'{}');}catch{return finish(400,{ok:false,error:'invalid_json'});}
      const username=String(body.username||'');calls.push({path:request.url,username});
      if(request.url==='/api/login'){
        if(username===credentials.admin.username&&body.password===credentials.admin.password)return finish(200,{ok:true,token:'admin-session-token',admin:{username,role:'管理员',quota:null,used:0,unlimited:true,deviceLimit:null,unlimitedDevices:true}});
        return finish(401,{ok:false,error:'invalid'});
      }
      if(request.url==='/api/customer-login'){
        if(username===credentials.pending.username)return finish(403,{ok:false,error:'pending'});
        if(username===credentials.customer.username&&body.password===credentials.customer.password)return finish(200,{ok:true,token:'customer-session-token',customer:{id:'customer-1',username,plan:'测试套餐',quota:1200,used:0,expires:null,status:'active'}});
        return finish(401,{ok:false,error:'invalid'});
      }
      return finish(404,{ok:false});
    });
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  const port=server.address().port;
  const profile=path.resolve('../cloud-login-profile-'+Date.now());
  const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>!['ELECTRON_RUN_AS_NODE','ST_TEST_PROFILE','ST_CLOUD_BASE','ST_TEST_FIXTURE'].includes(key.toUpperCase())));
  Object.assign(env,{ST_TEST_PROFILE:profile,ST_CLOUD_BASE:`http://127.0.0.1:${port}`,ST_TEST_FIXTURE:'1'});
  const electronPath=path.resolve('node_modules/electron/dist/electron.exe');
  const app=await _electron.launch({executablePath:electronPath,args:[path.resolve('src/desktop.js')],env});
  const checks=[];const ok=(name,value)=>{assert.ok(value,name);checks.push(name);};
  const localCredentials=path.join(profile,'local-admin-v1.json');
  try{
    const page=await app.firstWindow();await page.waitForLoadState('domcontentloaded');
    ok('No local administrator is required on a new computer',!fs.existsSync(localCredentials));

    // Default login mode auto-detects and accepts a cloud administrator.
    await page.locator('#account').fill(credentials.admin.username);await page.locator('#password').fill(credentials.admin.password);await page.locator('#login-form').evaluate(form=>form.requestSubmit());
    await page.waitForURL('**/workbench/index.html');
    const adminStatus=await page.evaluate(()=>window.superDesktop.authStatus());
    ok('Cloud administrator login succeeds without local credentials',adminStatus.user?.accountType==='admin');
    ok('Cloud administrator receives unlimited quota',adminStatus.user?.unlimited===true&&adminStatus.user?.quota===null);
    ok('Cloud administrator is not device limited',adminStatus.user?.unlimitedDevices===true&&adminStatus.user?.deviceLimit===null);
    ok('Administrator login uses cloud endpoint',calls.some(call=>call.path==='/api/login'&&call.username===credentials.admin.username));

    // Return to the login page, then use the same default button for a cloud
    // customer.  The client tries /api/login first and then customer-login.
    await page.locator('#back-login').click();await page.waitForURL('**/login/index.html');
    await page.locator('#account').fill(credentials.customer.username);await page.locator('#password').fill(credentials.customer.password);await page.locator('#login-form').evaluate(form=>form.requestSubmit());
    await page.waitForURL('**/workbench/index.html');
    const customerStatus=await page.evaluate(()=>window.superDesktop.authStatus());
    ok('Unified login auto-detects cloud customer',customerStatus.user?.accountType==='customer');
    ok('Customer quota is preserved',customerStatus.user?.quota===1200&&customerStatus.user?.unlimited===false);
    ok('Customer fallback reaches customer-login',calls.some(call=>call.path==='/api/customer-login'&&call.username===credentials.customer.username));

    // The same unified login entry also surfaces pending customer feedback.
    await page.locator('#back-login').click();await page.waitForURL('**/login/index.html');
    await page.locator('#account').fill(credentials.pending.username);await page.locator('#password').fill(credentials.pending.password);await page.locator('#login-form').evaluate(form=>form.requestSubmit());
    await page.waitForTimeout(250);ok('Pending customer receives actionable status',await page.locator('#form-status').textContent()==='账号已注册，正在等待管理员分配套餐。');

    // Invalid credentials must not create a local admin or enter the workbench.
    await page.locator('#account').fill('unknown_account');await page.locator('#password').fill('Wrong-6285');await page.locator('#login-form').evaluate(form=>form.requestSubmit());
    await page.waitForTimeout(250);ok('Invalid cloud credentials remain on login page',page.url().includes('/login/index.html')&&/账号或密码不正确/.test(await page.locator('#form-status').textContent()));
    ok('Cloud login tests never create local administrator credentials',!fs.existsSync(localCredentials));
    console.log(JSON.stringify({ok:true,passed:checks.length,checks,requests:calls.map(call=>call.path+':'+call.username)}));
  }finally{
    await app.close().catch(()=>{});await new Promise(resolve=>server.close(resolve));fs.rmSync(profile,{recursive:true,force:true});
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
