'use strict';
const {_electron}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const http=require('node:http');
const path=require('node:path');

(async()=>{
  let requestBody=null;
  const server=http.createServer((request,response)=>{
    if(request.method!=='POST'||request.url!=='/api/register'){
      response.writeHead(404,{'content-type':'application/json'});response.end('{"ok":false}');return;
    }
    let raw='';request.setEncoding('utf8');request.on('data',chunk=>raw+=chunk);request.on('end',()=>{
      requestBody=JSON.parse(raw);response.writeHead(200,{'content-type':'application/json'});response.end(JSON.stringify({ok:true,message:'注册成功，请等待管理员分配套餐。'}));
    });
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  const {port}=server.address();
  const profile=path.resolve('../register-profile-'+Date.now());
  const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>!['ELECTRON_RUN_AS_NODE','ST_TEST_PROFILE','ST_CLOUD_BASE'].includes(key.toUpperCase())));
  Object.assign(env,{ST_TEST_PROFILE:profile,ST_CLOUD_BASE:`http://127.0.0.1:${port}`});
  const electronPath=path.resolve('node_modules/electron/dist/electron.exe');
  const app=await _electron.launch({executablePath:electronPath,args:['.'],env});
  try{
    const page=await app.firstWindow();await page.waitForLoadState('domcontentloaded');
    const register=page.locator('#register');
    assert.equal(await register.isVisible(),true,'管理员登录模式必须显示注册入口');
    await register.click();assert.equal(await page.locator('#register-dialog').evaluate(node=>node.open),true);
    const username='client_'+Date.now(),secret='RegisterOnly-6285';
    await page.locator('#register-account').fill(username);await page.locator('#register-password').fill(secret);await page.locator('#register-confirm').fill(secret);await page.locator('#submit-register').click();
    await page.waitForFunction(()=>!document.querySelector('#register-dialog').open);
    assert.deepEqual(requestBody,{username,password:secret},'注册表单必须调用 /api/register');
    assert.equal(await page.locator('#login-title').textContent(),'登录','注册成功后保持统一登录入口');
    assert.equal(await page.locator('#account').inputValue(),username,'注册成功后必须回填用户名');
    assert.equal(await page.locator('#password').inputValue(),'','不能把注册密码回填到登录框');
    assert.equal(await page.locator('#register-password').inputValue(),'','注册密码必须从 DOM 清空');
    assert.equal(await page.locator('#register-confirm').inputValue(),'','确认密码必须从 DOM 清空');
    assert.equal(fs.existsSync(path.join(profile,'local-admin-v1.json')),false,'注册不能改写本地管理员凭据');
    assert.equal(fs.existsSync(path.join(profile,'cloud-license-v1.json')),false,'注册不能伪造已登录客户会话');
    assert.equal(await register.isVisible(),true,'统一登录入口仍须显示注册入口');
    console.log(JSON.stringify({ok:true,endpoint:'/api/register',registerVisibleInBothModes:true,usernameBackfilled:true,passwordCleared:true,localCredentialsUntouched:true}));
  }finally{
    await app.close().catch(()=>{});await new Promise(resolve=>server.close(resolve));fs.rmSync(profile,{recursive:true,force:true});
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
