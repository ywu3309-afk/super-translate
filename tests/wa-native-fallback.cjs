'use strict';
// Regression test for the Electron WebContents.insertText fallback. The
// isolated-world override makes execCommand('insertText') return false; this
// simulates WhatsApp builds whose controlled editor rejects the DOM command.
const {_electron}=require('playwright');
const assert=require('node:assert/strict');
const http=require('node:http');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {prepareTestLogin,loginToWorkbench}=require('./login-helper.cjs');
const root=path.resolve(__dirname,'..');
(async()=>{
  const source=fs.readFileSync(path.join(root,'src/desktop.js'),'utf8');
  assert.match(source,/wa:insert-text/,'desktop native insertion IPC handler is required');
  assert.match(source,/insertText\(text\)/,'desktop handler must call WebContents.insertText');
  const server=http.createServer(async(req,res)=>{
    let raw='';for await(const chunk of req)raw+=chunk;
    res.setHeader('content-type','application/json');
    if(req.url==='/health')return res.end(JSON.stringify({ok:true,offline:true}));
    if(req.url==='/v1/chat/completions')return res.end(JSON.stringify({choices:[{message:{content:'Fallback works.'}}]}));
    res.statusCode=404;return res.end('{}');
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  const profile=fs.mkdtempSync(path.join(os.tmpdir(),'super-translate-native-fallback-'));
  fs.writeFileSync(path.join(profile,'workspace-v2.json'),JSON.stringify({settings:{engine:'local',localPort:server.address().port}},null,2));
  const login=await prepareTestLogin(profile);
  const env={...process.env,ST_TEST_PROFILE:profile,ST_TEST_FIXTURE:'1',ST_CLOUD_BASE:login.cloudBase};delete env.ELECTRON_RUN_AS_NODE;
  const app=await _electron.launch({executablePath:require('electron'),args:[path.join(root,'src','desktop.js')],env});
  try{
    const page=await app.firstWindow();await page.waitForLoadState('domcontentloaded');
    await loginToWorkbench(page,login);
    await page.waitForFunction(()=>document.body.classList.contains('live-mode'));
    // WebContentsView is represented as a Page by Playwright's Electron API.
    // Wait briefly for the native view to be created after setLive().
    let wa=null;for(let i=0;i<20&&!wa;i++){wa=app.windows().find(candidate=>candidate.url().includes('wa-fixture.html'));if(!wa)await page.waitForTimeout(100);}
    assert.ok(wa,'WhatsApp fixture view was not created');await wa.waitForSelector('#composer');
    const target=await app.evaluate(({webContents})=>webContents.getAllWebContents().map(w=>({id:w.id,url:w.getURL()})).find(w=>w.url.includes('wa-fixture.html')));
    assert.ok(target,'WhatsApp WebContents was not found');
    await app.evaluate(({webContents},id)=>{
      const wc=webContents.fromId(id);
      // 999 is Electron's default isolated-world id used by the preload.
      return wc.executeJavaScriptInIsolatedWorld(999,[{code:`(()=>{const original=Document.prototype.execCommand;Document.prototype.execCommand=function(command,...args){if(command==='insertText')return false;return original.call(this,command,...args)}})()`}]);
    },target.id);
    await wa.locator('#composer').fill('你好');await wa.locator('#composer').press('Enter');
    await wa.waitForFunction(()=>window.sentCount===1,null,{timeout:10000});
    const sent=await wa.evaluate(()=>window.sentMessages.slice());
    assert.deepEqual(sent,['Fallback works.'],'native IPC fallback must send translated text only');
    assert.equal(await wa.evaluate(()=>document.querySelector('#composer').innerText.trim()),'','composer should be cleared after fallback send');
    console.log(JSON.stringify({ok:true,checks:['execCommand failure invokes native insertText fallback','fallback sends translation only','composer clears after send']},null,2));
  }finally{await app.close().catch(()=>{});await new Promise(resolve=>server.close(resolve));await login.closeCloud().catch(()=>{});try{fs.rmSync(profile,{recursive:true,force:true});}catch{}}
})().catch(error=>{console.error(error);process.exit(1)});
