'use strict';
// Regression coverage for controlled React/Lexical composer replacement.  The
// fixture is offline and never opens or sends a real WhatsApp conversation.
const {_electron}=require('playwright');
const assert=require('node:assert/strict');
const http=require('node:http');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {prepareTestLogin,loginToWorkbench}=require('./login-helper.cjs');
const root=path.resolve(__dirname,'..');

function startTranslator(){
  const requests=[];
  const server=http.createServer(async(req,res)=>{
    let raw='';for await(const chunk of req)raw+=chunk;
    res.setHeader('content-type','application/json');
    if(req.url==='/health')return res.end(JSON.stringify({ok:true,offline:true}));
    if(req.url!=='/v1/chat/completions')return (res.statusCode=404,res.end('{}'));
    let body={};try{body=JSON.parse(raw||'{}');}catch{}
    const prompt=String(body.messages?.[0]?.content||'');requests.push(prompt);
    if(prompt.includes('翻译期间重建'))await new Promise(resolve=>setTimeout(resolve,700));
    const translation=prompt.includes('翻译期间重建')?'Rebuilt during translation.':prompt.includes('插入期间重建')?'Rebuilt during insertion.':'Dynamic fixture translation.';
    res.end(JSON.stringify({choices:[{message:{content:translation}}]}));
  });
  return new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',()=>resolve({server,port:server.address().port,requests}));});
}

(async()=>{
  const mock=await startTranslator();
  const profile=fs.mkdtempSync(path.join(os.tmpdir(),'super-translate-wa-rebuild-'));
  fs.writeFileSync(path.join(profile,'workspace-v2.json'),JSON.stringify({settings:{engine:'local',localPort:mock.port}},null,2));
  const login=await prepareTestLogin(profile);
  const env={...process.env,ST_TEST_PROFILE:profile,ST_TEST_FIXTURE:'1',ST_CLOUD_BASE:login.cloudBase};delete env.ELECTRON_RUN_AS_NODE;
  const app=await _electron.launch({executablePath:require('electron'),args:[path.join(root,'src','desktop.js')],env});
  try{
    const page=await app.firstWindow();await page.waitForLoadState('domcontentloaded');
    await loginToWorkbench(page,login);
    await page.waitForFunction(()=>document.body.classList.contains('live-mode'));
    let wa=null;for(let i=0;i<30&&!wa;i++){wa=app.windows().find(candidate=>candidate.url().includes('wa-fixture.html'));if(!wa)await page.waitForTimeout(100);}
    assert.ok(wa,'WhatsApp fixture view was not created');await wa.waitForSelector('#composer');
    await page.locator('#outgoing-language').selectOption('en');
    // Replace the fixture send handler with one that always resolves the
    // current composer, matching a React-controlled WhatsApp toolbar.
    await wa.evaluate(()=>{
      const button=document.querySelector('#send'),replacement=button.cloneNode(true);button.replaceWith(replacement);
      replacement.addEventListener('click',()=>{const composer=document.querySelector('#composer'),text=String(composer?.innerText||'').trim();if(!text)return;window.sentMessages.push(text);window.sentCount++;composer.replaceChildren();composer.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'deleteContentBackward'}));});
      window.replaceFixtureComposer=(text)=>{const old=document.querySelector('#composer'),next=old.cloneNode(false);next.id='composer';next.textContent=text;old.replaceWith(next);next.focus();};
      window.rebuildOnTranslated=false;window.didRebuild=false;
      document.addEventListener('input',event=>{if(!window.rebuildOnTranslated||window.didRebuild)return;const composer=document.querySelector('#composer');if(composer&&String(composer.innerText||'').trim()==='Rebuilt during insertion.'){
        window.didRebuild=true;window.replaceFixtureComposer(composer.innerText);
      }},false);
    });

    // 1) The editor node is replaced while the translation request is in
    // flight.  The result must still be accepted for the same chat/draft.
    await wa.locator('#composer').fill('翻译期间重建');
    await wa.waitForTimeout(130);
    await wa.evaluate(()=>window.replaceFixtureComposer('翻译期间重建'));
    await page.waitForFunction(()=>document.querySelector('#live-preview-box')?.textContent==='Rebuilt during translation.',null,{timeout:6000});
    await wa.locator('#composer').press('Enter');
    await wa.waitForFunction(()=>window.sentCount===1,null,{timeout:6000});
    assert.deepEqual(await wa.evaluate(()=>window.sentMessages.slice()),['Rebuilt during translation.'],'replacement during translation must send translated text only');

    // 2) The editor node is replaced immediately after the translated text is
    // inserted.  The send must target the replacement, not the detached node.
    await wa.locator('#composer').fill('插入期间重建');
    await page.waitForFunction(()=>document.querySelector('#live-preview-box')?.textContent==='Rebuilt during insertion.',null,{timeout:6000});
    await wa.evaluate(()=>{window.rebuildOnTranslated=true;window.didRebuild=false;});
    await wa.locator('#composer').press('Enter');
    await wa.waitForFunction(()=>window.sentCount===2,null,{timeout:6000});
    assert.deepEqual(await wa.evaluate(()=>window.sentMessages.slice()),['Rebuilt during translation.','Rebuilt during insertion.'],'replacement during insertion must send translated text only');
    assert.equal(await wa.evaluate(()=>window.didRebuild),true,'fixture must exercise dynamic replacement path');
    assert.equal(await wa.evaluate(()=>document.querySelector('#composer').innerText.trim()),'','composer should clear after sending replacement');
    console.log(JSON.stringify({ok:true,checks:['editor replacement during translation accepted','editor replacement during insertion retargeted','translated text only','composer cleared'],requests:mock.requests.length},null,2));
  }finally{
    await app.close().catch(()=>{});await new Promise(resolve=>mock.server.close(resolve));await login.closeCloud().catch(()=>{});try{fs.rmSync(profile,{recursive:true,force:true});}catch{}
  }
})().catch(error=>{console.error(error);process.exit(1);});
