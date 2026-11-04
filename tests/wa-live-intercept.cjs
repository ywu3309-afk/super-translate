'use strict';
const {_electron}=require('playwright');
const assert=require('node:assert/strict');
const http=require('node:http');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {prepareTestLogin,loginToWorkbench}=require('./login-helper.cjs');

function startTranslator(){
  const requests=[];
  const server=http.createServer(async(req,res)=>{
    let raw='';for await(const chunk of req)raw+=chunk;
    if(req.url==='/health'){res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({ok:true,offline:true}));return;}
    if(req.url!=='/v1/chat/completions'){res.writeHead(404,{'Content-Type':'application/json'});res.end('{}');return;}
    const body=JSON.parse(raw||'{}'),prompt=String(body.messages?.[0]?.content||'');requests.push(prompt);
    if(prompt.includes('翻译失败')){res.writeHead(500,{'Content-Type':'application/json'});res.end(JSON.stringify({error:{message:'fixture translation failure'}}));return;}
    if(prompt.includes('切换会话测试'))await new Promise(resolve=>setTimeout(resolve,800));
    // The fixture deliberately exercises source-language detection: the
    // desktop interceptor must send English and German drafts through the
    // same translation path as Chinese drafts.  The target language is
    // encoded in nativePrompt (for example, “翻译成Italian”), so each
    // assertion below also proves that the selected target reaches the
    // translation backend.
    const translated=prompt.includes('点击发送测试')?'Click send test.':prompt.includes('切换会话测试')?'Chat switch test.':prompt.includes('你好，我的朋友')?'Hello, my friend.':prompt.includes('Japanese target test')&&prompt.includes('翻译成Japanese')?'日本語のテスト':prompt.includes('Hello, how are you?')&&prompt.includes('翻译成Italian')?'Ciao, come stai?':prompt.includes('Guten Tag, ist das Produkt noch verfügbar?')&&prompt.includes('翻译成Spanish')?'Hola, ¿sigue disponible el producto?':'Fixture translation.';
    res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({choices:[{message:{content:translated}}]}));
  });
  return new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',()=>resolve({server,port:server.address().port,requests}));});
}

(async()=>{
  const mock=await startTranslator(),profile=fs.mkdtempSync(path.join(os.tmpdir(),'super-translate-wa-live-'));
  fs.writeFileSync(path.join(profile,'workspace-v2.json'),JSON.stringify({settings:{engine:'local',localPort:mock.port}},null,2));
  const login=await prepareTestLogin(profile);
  const env={...process.env,ST_TEST_PROFILE:profile,ST_TEST_FIXTURE:'1',ST_CLOUD_BASE:login.cloudBase};delete env.ELECTRON_RUN_AS_NODE;
  const app=await _electron.launch({executablePath:require('electron'),args:[path.resolve('src/desktop.js')],env});
  const checks=[];const ok=(name,value)=>{assert.ok(value,name);checks.push(name);};
  try{
    const page=await app.firstWindow();await page.waitForLoadState('domcontentloaded');await loginToWorkbench(page,login);await page.waitForFunction(()=>document.body.classList.contains('live-mode'));
    await page.waitForFunction(()=>document.querySelector('#saved-status')?.textContent==='当前聊天已连接');
    const wa=app.windows().find(candidate=>candidate.url().includes('wa-fixture.html'));assert.ok(wa,'fixture WebContentsView was not found');await wa.waitForSelector('#composer');
    await page.locator('#outgoing-language').selectOption('en');await page.waitForTimeout(150);
    ok('Manual live reply textareas removed',await page.locator('#live-source,#live-output').count()===0);
    ok('Realtime preview card rendered',await page.locator('#live-preview-box').count()===1);

    await wa.locator('#composer').fill('你好，我的朋友');
    await page.waitForFunction(()=>document.querySelector('#live-preview-box')?.textContent==='Hello, my friend.',null,{timeout:5000});
    ok('400ms composer translation reaches sidebar preview',await page.locator('#trans-status').getAttribute('data-status')==='ready');
    await wa.locator('#composer').press('Enter');
    await wa.waitForFunction(()=>window.sentCount===1,null,{timeout:5000});
    let sent=await wa.evaluate(()=>window.sentMessages.slice());
    ok('Enter sends translated text only',sent[0]==='Hello, my friend.'&&!/[\u3400-\u9fff]/u.test(sent[0]));

    await wa.locator('#composer').fill('点击发送测试');
    await page.waitForFunction(()=>document.querySelector('#live-preview-box')?.textContent==='Click send test.',null,{timeout:5000});
    await wa.locator('#send').evaluate(button=>{button.click();button.click();});
    await wa.waitForFunction(()=>window.sentCount===2,null,{timeout:5000});await wa.waitForTimeout(350);
    sent=await wa.evaluate(()=>window.sentMessages.slice());
    ok('Captured send-button click does not recurse or duplicate',sent.length===2&&sent[1]==='Click send test.');

    await wa.locator('#composer').fill('翻译失败');await wa.locator('#composer').press('Enter');
    await page.waitForFunction(()=>document.querySelector('#trans-status')?.dataset.status==='error',null,{timeout:5000});
    ok('Translation error blocks the untranslated source instead of leaking it',await wa.evaluate(()=>window.sentCount===2&&document.querySelector('#composer').innerText.trim()==='翻译失败'));

    // A Chinese/Japanese target may legitimately contain Han characters.
    // Keep the old blockChinese preference enabled and prove the translation
    // is accepted rather than misclassified as an untranslated Chinese draft.
    await page.locator('#outgoing-language').selectOption('ja');await page.waitForTimeout(180);
    await wa.locator('#composer').fill('Japanese target test');
    await page.waitForFunction(()=>document.querySelector('#live-preview-box')?.textContent==='日本語のテスト',null,{timeout:5000});
    await wa.locator('#composer').press('Enter');await wa.waitForFunction(()=>window.sentCount===3,null,{timeout:5000});
    sent=await wa.evaluate(()=>window.sentMessages.slice());ok('Japanese translation with Han characters is accepted and sent',sent[2]==='日本語のテスト');

    await page.locator('#outgoing-language').selectOption('en');await page.waitForTimeout(180);

    await wa.locator('#composer').fill('切换会话测试');await wa.locator('#composer').press('Enter');await wa.waitForTimeout(100);
    await wa.evaluate(()=>window.setFixtureChat('+49 151 0000 0202','false_4915100000202@c.us_switched'));await wa.waitForTimeout(1100);
    ok('Chat switch invalidates in-flight translation and blocks send',await wa.evaluate(()=>window.sentCount===3));
    // The stale source draft is intentionally preserved after a chat switch.
    // Clear it explicitly before starting an independent source-language case.
    await wa.locator('#composer').fill('');

    // Source-language agnostic outgoing translation: an English draft is
    // translated to Italian, then a German draft is translated to Spanish.
    // Neither draft contains Chinese, so a Chinese-only gate would let the
    // native text leak through; these checks catch that regression.
    await page.locator('#outgoing-language').selectOption('it');await page.waitForTimeout(180);
    await wa.locator('#composer').fill('Hello, how are you?');
    await page.waitForFunction(()=>document.querySelector('#live-preview-box')?.textContent==='Ciao, come stai?',null,{timeout:5000});
    ok('English source previews Italian translation',await page.locator('#trans-status').getAttribute('data-status')==='ready');
    await wa.locator('#composer').press('Enter');await wa.waitForFunction(()=>window.sentCount===4,null,{timeout:5000});
    sent=await wa.evaluate(()=>window.sentMessages.slice());ok('English source sends Italian translation',sent[3]==='Ciao, come stai?');

    await page.locator('#outgoing-language').selectOption('es');await page.waitForTimeout(180);
    await wa.locator('#composer').fill('Guten Tag, ist das Produkt noch verfügbar?');
    await page.waitForFunction(()=>document.querySelector('#live-preview-box')?.textContent==='Hola, ¿sigue disponible el producto?',null,{timeout:5000});
    ok('German source previews Spanish translation',await page.locator('#trans-status').getAttribute('data-status')==='ready');
    await wa.locator('#send').click();await wa.waitForFunction(()=>window.sentCount===5,null,{timeout:5000});
    sent=await wa.evaluate(()=>window.sentMessages.slice());ok('German source sends Spanish translation from the native send button',sent[4]==='Hola, ¿sigue disponible el producto?');

    // Backward-compatible opt-out: when translateSend is disabled, foreign
    // drafts retain native WhatsApp behavior while the legacy Chinese-source
    // guard still prevents an accidental untranslated Chinese send.
    await page.locator('#translate-send').uncheck();await page.waitForTimeout(250);
    await wa.locator('#composer').fill('Native English while translation is off');await wa.locator('#composer').press('Enter');await wa.waitForFunction(()=>window.sentCount===6,null,{timeout:5000});
    sent=await wa.evaluate(()=>window.sentMessages.slice());ok('Disabled automatic translation preserves native foreign-language send',sent[5]==='Native English while translation is off');
    await wa.locator('#composer').fill('中文原文保护测试');await wa.locator('#composer').press('Enter');await page.waitForFunction(()=>document.querySelector('#trans-status')?.dataset.status==='error',null,{timeout:5000});
    ok('Legacy Chinese-source guard remains scoped to disabled translation',await wa.evaluate(()=>window.sentCount===6&&document.querySelector('#composer').innerText.trim()==='中文原文保护测试'));
    await wa.locator('#composer').fill('');await page.locator('#translate-send').check();await page.waitForTimeout(250);

    const widthBefore=await wa.evaluate(()=>innerWidth);await page.locator('#right-pane-toggle').click();await page.waitForFunction(()=>document.body.classList.contains('right-pane-collapsed'));await page.waitForTimeout(450);const widthAfter=await wa.evaluate(()=>innerWidth);
    ok('Collapsing drawer expands actual WhatsApp WebContentsView bounds',widthAfter>widthBefore+240);
    ok('Collapsed toggle remains available in reserved native-view gutter',await page.locator('#right-pane-toggle').isVisible());
    await page.locator('#right-pane-toggle').click();await page.waitForTimeout(350);ok('Drawer expands again',!await page.evaluate(()=>document.body.classList.contains('right-pane-collapsed')));

    ok('Debounce avoided excessive translation requests',mock.requests.filter(text=>text.includes('你好，我的朋友')).length===1);
    console.log(JSON.stringify({ok:true,passed:checks.length,checks},null,2));
  }finally{
    await app.close().catch(()=>{});await new Promise(resolve=>mock.server.close(resolve));await login.closeCloud().catch(()=>{});fs.rmSync(profile,{recursive:true,force:true});
  }
})().catch(error=>{console.error(error);process.exit(1);});
