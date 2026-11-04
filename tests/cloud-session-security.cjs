'use strict';

// Regression coverage for the cloud-session boundary.  These tests use only
// loopback fixtures and isolated Electron profiles; no production endpoint,
// real credential, or WhatsApp message is contacted.
const {_electron}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const http=require('node:http');
const os=require('node:os');
const path=require('node:path');

const root=path.resolve(__dirname,'..');
const electronPath=path.join(root,'node_modules','electron','dist','electron.exe');

function json(response,status,payload){
  response.writeHead(status,{'content-type':'application/json','cache-control':'no-store'});
  response.end(JSON.stringify(payload));
}

function startCloud({consumeStatus=200}={}){
  const calls=[];
  const server=http.createServer((request,response)=>{
    let raw='';request.setEncoding('utf8');request.on('data',chunk=>{raw+=chunk;});
    request.on('end',()=>{
      let body={};try{body=JSON.parse(raw||'{}');}catch{}
      calls.push({path:request.url,body});
      if(request.method!=='POST')return json(response,404,{ok:false,error:'not_found'});
      if(request.url==='/api/login'&&body.username==='audit_admin'&&body.password==='AuditPass-123456')return json(response,200,{ok:true,token:'audit-admin-token',admin:{username:'audit_admin',role:'管理员'}});
      if(request.url==='/api/login')return json(response,401,{ok:false,error:'invalid'});
      if(request.url==='/api/customer-login')return json(response,401,{ok:false,error:'invalid'});
      if(request.url==='/api/customer-consume')return json(response,consumeStatus,{ok:false,error:consumeStatus===401?'invalid_token':'revoked'});
      return json(response,404,{ok:false,error:'not_found'});
    });
  });
  return new Promise((resolve,reject)=>{
    server.once('error',reject);
    server.listen(0,'127.0.0.1',()=>resolve({
      base:`http://127.0.0.1:${server.address().port}`,
      calls,
      close:()=>new Promise(done=>server.close(()=>done()))
    }));
  });
}

function startCustomerCloud({consumeStatus}){
  const calls=[];
  const server=http.createServer((request,response)=>{
    let raw='';request.setEncoding('utf8');request.on('data',chunk=>{raw+=chunk;});
    request.on('end',()=>{
      let body={};try{body=JSON.parse(raw||'{}');}catch{}
      calls.push({path:request.url,body});
      if(request.method!=='POST')return json(response,404,{ok:false,error:'not_found'});
      if(request.url==='/api/login')return json(response,401,{ok:false,error:'invalid'});
      if(request.url==='/api/customer-login'&&body.username==='audit_customer'&&body.password==='AuditPass-123456')return json(response,200,{ok:true,token:'audit-customer-token',customer:{username:'audit_customer',plan:'测试套餐',quota:5000,used:0,expires:null,status:'active'}});
      if(request.url==='/api/customer-login')return json(response,401,{ok:false,error:'invalid'});
      if(request.url==='/api/customer-consume')return json(response,consumeStatus,{ok:false,error:consumeStatus===401?'invalid_token':'revoked'});
      return json(response,404,{ok:false,error:'not_found'});
    });
  });
  return new Promise((resolve,reject)=>{
    server.once('error',reject);
    server.listen(0,'127.0.0.1',()=>resolve({
      base:`http://127.0.0.1:${server.address().port}`,
      calls,
      close:()=>new Promise(done=>server.close(()=>done()))
    }));
  });
}

function startSyncCloud(){
  const calls=[];
  const server=http.createServer((request,response)=>{
    let raw='';request.setEncoding('utf8');request.on('data',chunk=>{raw+=chunk;});
    request.on('end',()=>{
      let body={};try{body=JSON.parse(raw||'{}');}catch{}
      calls.push({path:request.url,body});
      if(request.method!=='POST')return json(response,404,{ok:false,error:'not_found'});
      if(request.url==='/api/login')return json(response,401,{ok:false,error:'invalid'});
      if(request.url==='/api/customer-login'&&body.username==='audit_customer'&&body.password==='AuditPass-123456')return json(response,200,{ok:true,token:'audit-sync-token',customer:{username:'audit_customer',plan:'测试套餐',quota:5000,used:0,expires:null,status:'active'}});
      if(request.url==='/api/customer-consume'){
        const amount=Number(body.amount);
        return Number.isSafeInteger(amount)&&amount>0
          ?json(response,200,{ok:true,quota:5000-amount,used:amount})
          :json(response,400,{ok:false,error:'invalid_amount'});
      }
      return json(response,404,{ok:false,error:'not_found'});
    });
  });
  return new Promise((resolve,reject)=>{
    server.once('error',reject);
    server.listen(0,'127.0.0.1',()=>resolve({
      base:`http://127.0.0.1:${server.address().port}`,
      calls,
      close:()=>new Promise(done=>server.close(()=>done()))
    }));
  });
}

function startLocalTranslation(){
  const server=http.createServer((request,response)=>{
    if(request.method==='GET'&&request.url==='/health')return json(response,200,{status:'ok',offline:true,runtime:'fixture'});
    if(request.method==='POST'&&(request.url==='/v1/chat/completions'||request.url==='/translate')){
      if(request.url==='/translate')return json(response,200,{translation:'hello'});
      return json(response,200,{choices:[{message:{content:'hello'}}]});
    }
    return json(response,404,{ok:false});
  });
  return new Promise((resolve,reject)=>{
    server.once('error',reject);
    server.listen(0,'127.0.0.1',()=>resolve({
      port:server.address().port,
      close:()=>new Promise(done=>server.close(()=>done()))
    }));
  });
}

async function launch(profile,cloudBase,extra={}){
  const env={...process.env,ST_TEST_PROFILE:profile,ST_CLOUD_BASE:cloudBase,ST_TEST_FIXTURE:'1',...extra};
  delete env.ELECTRON_RUN_AS_NODE;
  return _electron.launch({executablePath:electronPath,args:[path.join(root,'src','desktop.js')],env});
}

async function login(page,username,password){
  await page.locator('#account').fill(username);
  await page.locator('#password').fill(password);
  await page.locator('#login-form').evaluate(form=>form.requestSubmit());
  await page.waitForURL('**/workbench/index.html');
}

async function cacheTamperCheck(checks){
  const profile=fs.mkdtempSync(path.join(os.tmpdir(),'super-translate-cache-security-'));
  const cloud=await startCloud();
  let app=null;
  try{
    app=await launch(profile,cloud.base);
    let page=await app.firstWindow();
    await login(page,'audit_admin','AuditPass-123456');
    await app.close();app=null;

    const cacheFile=path.join(profile,'cloud-license-v1.json');
    assert.equal(fs.existsSync(cacheFile),true,'successful cloud login should create encrypted queue metadata');
    const record=JSON.parse(fs.readFileSync(cacheFile,'utf8'));
    assert.equal(record.version,3,'cloud cache must use the non-authoritative v3 envelope');
    assert.equal(typeof record.encryptedSession,'string','cloud cache payload must be encrypted');
    // Simulate a user editing all old plaintext entitlement fields.  The
    // process must not turn this into an authenticated/unlimited session.
    record.accountType='admin';record.role='管理员';record.quota=null;record.unlimited=true;record.status='active';record.expires=null;record.cachedAt=Date.now();
    fs.writeFileSync(cacheFile,JSON.stringify(record));
  }finally{
    await app?.close().catch(()=>{});
    await cloud.close().catch(()=>{});
  }

  // The cloud is intentionally unavailable on the next launch.  A cache-only
  // process must remain on the login page and protected IPC must reject.
  app=await launch(profile,'http://127.0.0.1:1');
  try{
    const page=await app.firstWindow();await page.waitForLoadState('domcontentloaded');
    const status=await page.evaluate(()=>window.superDesktop.authStatus());
    checks.push(['tampered cache does not restore cloud session',status.user===null]);
    await assert.rejects(page.evaluate(()=>window.superDesktop.settings()),/请先登录超级翻译账号/);
    checks.push(['protected IPC rejects cache-only login page',true]);
    const loginUrl=page.url();
    await page.evaluate(()=>{location.href=location.href.replace(/\/login\/index\.html(?:[#?].*)?$/,'/workbench/index.html');});
    await page.waitForTimeout(350);
    checks.push(['renderer direct navigation cannot reach workbench',page.url()===loginUrl]);
    await page.evaluate(()=>window.superDesktop.window('workbench'));
    await page.waitForTimeout(350);
    checks.push(['unauthenticated window handoff is rejected',page.url().includes('/login/index.html')]);
  }finally{
    await app.close().catch(()=>{});
    try{fs.rmSync(profile,{recursive:true,force:true});}catch{}
  }
}

async function consumeAuthCheck(statusCode,checks){
  const profile=fs.mkdtempSync(path.join(os.tmpdir(),`super-translate-consume-${statusCode}-`));
  const cloud=await startCustomerCloud({consumeStatus:statusCode});
  const local=await startLocalTranslation();
  let app=null;
  try{
    app=await launch(profile,cloud.base);
    const page=await app.firstWindow();
    await login(page,'audit_customer','AuditPass-123456');
    const validate=await page.evaluate(async()=>{
      try{await window.superDesktop.cloudValidate('audit-code');return{ok:true};}
      catch(error){return{ok:false,error:String(error?.message||error)}}
    });
    checks.push([`${statusCode} customer cannot invoke administrator license validation`,validate.ok===false&&/仅云端管理员/.test(validate.error)&&!cloud.calls.some(call=>call.path==='/api/validate-license')]);
    await page.evaluate(port=>window.superDesktop.saveSettings({engine:'local',localPort:port}),local.port);
    const result=await page.evaluate(async()=>{
      try{await window.superDesktop.translate({text:'hello',target:'en'});return{ok:true};}
      catch(error){return{ok:false,error:String(error?.message||error)}}
    });
    checks.push([`${statusCode} from quota endpoint blocks translation`,result.ok===false&&/云端登录已失效/.test(result.error)]);
    const after=await page.evaluate(()=>window.superDesktop.authStatus());
    checks.push([`${statusCode} invalidates the cloud session`,after.user===null]);
  }finally{
    await app?.close().catch(()=>{});
    await cloud.close().catch(()=>{});
    await local.close().catch(()=>{});
    try{fs.rmSync(profile,{recursive:true,force:true});}catch{}
  }
}

async function offlinePendingCheck(checks){
  const profile=fs.mkdtempSync(path.join(os.tmpdir(),'super-translate-offline-pending-'));
  const firstCloud=await startSyncCloud();
  const local=await startLocalTranslation();
  let app=null;
  try{
    app=await launch(profile,firstCloud.base);
    let page=await app.firstWindow();
    await login(page,'audit_customer','AuditPass-123456');
    await page.evaluate(port=>window.superDesktop.saveSettings({engine:'local',localPort:port}),local.port);
    await firstCloud.close();
    const offline=await page.evaluate(()=>window.superDesktop.translate({text:'hello',target:'en'}));
    checks.push(['temporary cloud outage uses bounded offline billing queue',offline.offline===true]);
    await app.close();app=null;

    const secondCloud=await startSyncCloud();
    try{
      app=await launch(profile,secondCloud.base);
      page=await app.firstWindow();
      await login(page,'audit_customer','AuditPass-123456');
      await page.evaluate(port=>window.superDesktop.saveSettings({engine:'local',localPort:port}),local.port);
      const synced=await page.evaluate(()=>window.superDesktop.translate({text:'x',target:'en'}));
      const consume=secondCloud.calls.find(call=>call.path==='/api/customer-consume');
      checks.push(['offline pending amount survives restart and is reconciled',synced.offline===false&&consume?.body?.amount===6]);
    }finally{
      await app?.close().catch(()=>{});app=null;
      await secondCloud.close().catch(()=>{});
    }
  }finally{
    await app?.close().catch(()=>{});
    await firstCloud.close().catch(()=>{});
    await local.close().catch(()=>{});
    try{fs.rmSync(profile,{recursive:true,force:true});}catch{}
  }
}

(async()=>{
  const checks=[];
  await cacheTamperCheck(checks);
  await offlinePendingCheck(checks);
  await consumeAuthCheck(401,checks);
  await consumeAuthCheck(403,checks);
  for(const [name,value] of checks)assert.ok(value,name);
  console.log(JSON.stringify({ok:true,passed:checks.length,checks:checks.map(([name])=>name)}));
})().catch(error=>{console.error(error);process.exitCode=1;});
