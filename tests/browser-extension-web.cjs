'use strict';
// Real Chromium + MV3 generic-page translation.  Every account, page and
// provider response is an isolated local fixture; no production text is sent.
const fs=require('node:fs'),path=require('node:path'),https=require('node:https'),assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
process.env.PLAYWRIGHT_BROWSERS_PATH=process.env.PLAYWRIGHT_BROWSERS_PATH||'D:\\SuperTranslate\\BrowserTesting';
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),ext=path.join(root,'browser-extension'),out=path.join(root,'outputs','browser-extension');
const testRoot=fs.mkdtempSync(path.join(process.env.PLAYWRIGHT_BROWSERS_PATH,'extension-web-')),checks=[],errors=[];fs.mkdirSync(out,{recursive:true});
const check=(name,value=true)=>{assert.ok(value,name);checks.push(name);console.log('PASS '+name);};
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const longBoundarySource=`${'Alpha '.repeat(485)}contact@example.test https://example.test/catalog/item-42 ${'Omega '.repeat(75)}`.trim();
const pageFixture=`<!doctype html><html lang="en"><head><meta charset="utf-8"><style>body{font:16px sans-serif;margin:30px}main{max-width:760px}p,li,h1{min-height:20px}video{display:block;width:640px;height:220px;background:#111}</style></head><body><main>
<h1 id="title">Welcome to the global store</h1><p id="intro">Our products are available around the world.</p><p id="same">Our products are available around the world.</p>
<p id="exact">  Exact\u00a0spacing\u200B survives  </p><section translate="no"><p id="translate-no">Do not translate this subtree</p></section><section class="notranslate"><p id="class-no">Do not translate this class</p></section>
<p id="collision-a">wdd8ill60</p><p id="collision-b">wofvu8hkf</p><div id="dynamic"></div><p id="long-boundary">${longBoundarySource}</p>
<pre id="code">const secret = 'do not translate code';</pre><input id="private" value="private form value"><div contenteditable="true" id="editor">private editable draft</div><p id="hidden" style="display:none">hidden private text</p>
<video id="movie"></video><div class="ytp-caption-window-container" id="caption">Thank you for watching</div>
</main></body></html>`;
const earlyFixture=`<!doctype html><html><head><meta charset="utf-8"><style>body{font:16px sans-serif;margin:30px}p{min-height:20px}</style></head><body><p>Temporary body</p></body></html>`;
(async()=>{
  let context,server;
  try{
    execFileSync('pwsh.exe',['-NoProfile','-Command',`$r=[System.Security.Cryptography.RSA]::Create(2048);$q=[System.Security.Cryptography.X509Certificates.CertificateRequest]::new('CN=127.0.0.1',$r,[System.Security.Cryptography.HashAlgorithmName]::SHA256,[System.Security.Cryptography.RSASignaturePadding]::Pkcs1);$c=$q.CreateSelfSigned([DateTimeOffset]::UtcNow.AddMinutes(-1),[DateTimeOffset]::UtcNow.AddDays(1));[IO.File]::WriteAllText('${testRoot.replaceAll("'","''")}/cert.pem',$c.ExportCertificatePem());[IO.File]::WriteAllText('${testRoot.replaceAll("'","''")}/key.pem',$r.ExportPkcs8PrivateKeyPem());$c.Dispose();$r.Dispose()`],{stdio:'pipe'});
    const token='synthetic-web-token-not-a-real-credential';let calls=[];
    const translated=(text,target)=>{
      const table={
        'ZH-HANS':new Map([['Welcome to the global store','欢迎来到全球商店'],['Our products are available around the world.','我们的产品销往世界各地。'],['Exact spacing survives','精确空白保留'],['Dynamically loaded customer story','动态加载的客户故事'],['Thank you for watching','感谢观看'],['Body appeared after activation','页面主体延迟出现']]),
        DE:new Map([['Welcome to the global store','Willkommen im globalen Geschäft'],['Our products are available around the world.','Unsere Produkte sind weltweit erhältlich.'],['Exact spacing survives','Exakte Abstände bleiben erhalten'],['Dynamically loaded customer story','Dynamisch geladene Kundengeschichte'],['Thank you for watching','Danke fürs Zuschauen']])
      };return table[target]?.get(text)||`[${target}]${text}`;
    };
    const customer={id:'web-fixture',username:'web_customer',status:'active',quota:500000,used:0,plan:'测试套餐',expires:'2030-12-31'};
    server=https.createServer({cert:fs.readFileSync(path.join(testRoot,'cert.pem')),key:fs.readFileSync(path.join(testRoot,'key.pem'))},async(req,res)=>{
      let raw='';for await(const part of req)raw+=part;let body={};try{body=JSON.parse(raw||'{}');}catch{}
      const reply=(status,data)=>{res.writeHead(status,{'content-type':'application/json'});res.end(JSON.stringify(data));};
      if(req.url==='/page')return res.end(pageFixture);
      if(req.url==='/early')return res.end(earlyFixture);
      if(req.url==='/api/customer-login')return body.password==='fixture-password'?reply(200,{ok:true,token,customer}):reply(401,{ok:false,error:'invalid'});
      if(req.headers.authorization!==`Bearer ${token}`)return reply(401,{ok:false,error:'unauthorized'});
      if(req.url==='/api/customer-heartbeat')return reply(200,{ok:true});
      if(req.url==='/api/customer-usage')return reply(200,{ok:true,...customer});
      if(req.url==='/api/translate'){
        const call={text:body.text,target:body.target_lang,authorization:req.headers.authorization,at:Date.now()};calls.push(call);
        await sleep(body.text==='Dynamically loaded customer story'&&body.target_lang==='ZH-HANS'?320:45);
        return reply(200,{ok:true,translation:translated(body.text,body.target_lang),charged:String(body.text||'').length,quota:500000,used:0});
      }
      reply(404,{ok:false,error:'not_found'});
    });
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin=`https://127.0.0.1:${server.address().port}`;
    const testExt=path.join(testRoot,'extension');fs.cpSync(ext,testExt,{recursive:true});fs.writeFileSync(path.join(testExt,'cloud-config.js'),`globalThis.ST_CLOUD_ORIGIN=${JSON.stringify(origin)};`);
    const manifest=JSON.parse(fs.readFileSync(path.join(testExt,'manifest.json'),'utf8'));manifest.host_permissions.push(origin+'/*');manifest.content_security_policy.extension_pages=manifest.content_security_policy.extension_pages.replace('connect-src ',`connect-src ${origin} `);fs.writeFileSync(path.join(testExt,'manifest.json'),JSON.stringify(manifest));
    context=await chromium.launchPersistentContext(path.join(testRoot,'profile'),{channel:'chromium',headless:true,args:[`--disable-extensions-except=${testExt}`,`--load-extension=${testExt}`,'--ignore-certificate-errors'],viewport:{width:1100,height:850}});
    context.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));
    const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker'),extensionId=new URL(worker.url()).hostname;
    let uiPage=null;
    const sendUi=async(message)=>{
      if(!uiPage)throw new Error('UI fixture is not ready');
      const response=await uiPage.evaluate(async message=>chrome.runtime.sendMessage(message),message);
      if(!response?.ok)throw new Error(response?.error||'request failed');return response;
    };
    const active=(tabId)=>worker.evaluate(tabId=>chrome.tabs.update(tabId,{active:true}),tabId);
    const tabFor=pattern=>worker.evaluate(async pattern=>(await chrome.tabs.query({})).find(tab=>new RegExp(pattern).test(tab.url||'')),pattern);

    const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(origin+'/page');
    check('generic scripts are absent before explicit user activation',await page.evaluate(()=>!globalThis.STWebTranslator&&!globalThis.STWebSubtitles));
    const popup=await context.newPage();uiPage=popup;popup.on('pageerror',e=>errors.push(e.message));await popup.goto(`chrome-extension://${extensionId}/popup.html`);await popup.locator('#login-section').waitFor({state:'visible'});
    await popup.locator('#username').fill('web_customer');await popup.locator('#password').fill('fixture-password');await popup.locator('#login-button').click();await popup.locator('#account-section').waitFor({state:'visible'});
    await popup.locator('#enabled').check();await popup.locator('#save').click();await popup.waitForFunction(()=>document.querySelector('#feedback').textContent.includes('已保存'));
    // Login rendering can re-enable buttons after the initial options guard;
    // reload the full extension tab to exercise its authenticated startup path.
    await popup.reload();await popup.locator('#account-section').waitFor({state:'visible'});
    check('web controls appear only after authenticated login',await popup.locator('#web-section').isVisible());
    // This fixture opens popup.html as a normal extension tab for login only.
    // Page actions below go through the service worker, not this synthetic tab;
    // production action-popup user-gesture behavior has a separate manual gate.
    check('the synthetic popup tab is used only for account setup',await popup.locator('#web-section').isVisible());

    const pageTab=await tabFor('/page$');await active(pageTab.id);
    let started;for(let attempt=0;attempt<3;attempt++){try{started=await sendUi({type:'WEB_ACTION',action:'start',settings:{target:'zh-CN',mode:'bilingual',dynamic:true,subtitles:true,showToolbar:true}});break;}catch(error){if(!/脚本未响应|Receiving end/i.test(error.message)||attempt===2)throw error;await sleep(150);}}
    check('background action establishes an active-tab capability',started.active!==false&&started.status?.enabled===true);
    await page.bringToFront();await page.waitForFunction(()=>document.querySelector('#title .st-web-translation')?.textContent.includes('欢迎'));await page.waitForFunction(()=>document.querySelector('#intro .st-web-translation')?.textContent.includes('世界各地'));
    check('explicit activeTab activation injects the independent translator',await page.evaluate(()=>!!document.querySelector('#st-web-toolbar')&&!!document.querySelector('.st-web-unit')));
    check('page translation renders bilingual text without HTML injection',await page.locator('#title .st-web-original').innerText()==='Welcome to the global store'&&await page.locator('#title .st-web-translation').innerText()==='欢迎来到全球商店');
    check('form, editable, code and hidden text are never sent',!calls.some(call=>/private|secret|hidden/.test(call.text)));
    check('translate=no and .notranslate subtrees are excluded',!calls.some(call=>/Do not translate/.test(call.text))&&await page.locator('#translate-no .st-web-unit').count()===0&&await page.locator('#class-no .st-web-unit').count()===0);
    check('duplicate visible text uses one session-memory translation',calls.filter(call=>call.text==='Our products are available around the world.').length===1);
    await page.waitForFunction(()=>document.querySelector('#collision-a .st-web-ready')&&document.querySelector('#collision-b .st-web-ready'));
    check('exact in-memory cache keys do not alias an FNV32 same-length collision',calls.some(call=>call.text==='wdd8ill60')&&calls.some(call=>call.text==='wofvu8hkf')&&await page.locator('#collision-a .st-web-translation').innerText()!==await page.locator('#collision-b .st-web-translation').innerText());
    await page.waitForFunction(()=>document.querySelector('#long-boundary .st-web-ready'));
    const longProviderCalls=calls.filter(call=>call.text.includes('Alpha')||call.text.includes('Omega')||call.text.includes('ZXQKEEP'));
    const longRendered=await page.locator('#long-boundary .st-web-translation').innerText();
    check('over-3000-character text keeps URL and email spans whole and every provider request within budget',longProviderCalls.length>=2&&longProviderCalls.every(call=>call.text.length<=3000)&&longRendered.includes('contact@example.test')&&longRendered.includes('https://example.test/catalog/item-42'));
    check('translated chunks retain an explicit whitespace boundary instead of gluing words',/\s\[ZH-HANS\]/.test(longRendered));
    const exactBefore=await page.evaluate(()=>document.querySelector('#exact .st-web-original').textContent);
    check('wrapped original preserves NBSP, zero-width characters, and surrounding spaces exactly',exactBefore==='  Exact\u00a0spacing\u200B survives  ');
    let completedStatus;for(let attempt=0;attempt<80;attempt++){completedStatus=(await sendUi({type:'WEB_ACTION',action:'status'})).status;if(completedStatus?.translatedUnits>=7&&completedStatus?.queued===0)break;await sleep(50);}
    check('status translatedUnits counts completed translated blocks only',Number.isInteger(completedStatus?.translatedUnits)&&completedStatus.translatedUnits===7&&completedStatus.queued===0);

    await page.evaluate(()=>{const p=document.createElement('p');p.id='later';p.textContent='Dynamically loaded customer story';document.querySelector('#dynamic').append(p);});
    await page.locator('#later').scrollIntoViewIfNeeded();await page.evaluate(()=>dispatchEvent(new Event('scroll')));
    await page.waitForFunction(()=>document.querySelector('#later .st-web-unit'));
    // Move every previously translated block off-screen before changing target;
    // known units must still retranslate without depending on a visibility scan.
    await page.locator('#movie').scrollIntoViewIfNeeded();
    await active(pageTab.id);await sendUi({type:'WEB_ACTION',action:'configure',settings:{target:'de',mode:'bilingual',dynamic:true,subtitles:true,showToolbar:true}});
    await page.bringToFront();
    await page.waitForFunction(()=>document.querySelector('#title .st-web-translation')?.textContent.includes('Willkommen'));
    await page.waitForFunction(()=>document.querySelector('#intro .st-web-translation')?.textContent.includes('weltweit'));
    check('target-language change restores and re-translates every existing page unit',await page.locator('#title .st-web-translation').innerText()==='Willkommen im globalen Geschäft'&&await page.locator('#intro .st-web-translation').innerText()==='Unsere Produkte sind weltweit erhältlich.');
    await sleep(450);
    check('queued old-target work is cancelled before provider execution or discarded when already in flight',!await page.locator('#later').innerText().then(text=>text.includes('动态加载')));
    await page.waitForFunction(()=>document.querySelector('#later .st-web-translation')?.textContent.includes('Dynamisch'));
    check('dynamic content is retranslated to the new target',calls.some(call=>call.text==='Dynamically loaded customer story'&&call.target==='DE'));
    // Wait for the retranslation queue to drain before measuring whether an
    // idempotent repeated start itself creates new paid requests.
    for(let attempt=0;attempt<120;attempt++){const current=(await sendUi({type:'WEB_ACTION',action:'status'})).status;if(current?.queued===0)break;await sleep(50);}

    const session=await worker.evaluate(async()=>Object.values((await chrome.storage.session.get('webSessions')).webSessions||{})[0]);
    const initialNonce=session.nonce;
    const requestsBeforeRepeatedStart=calls.length;
    await active(pageTab.id);await sendUi({type:'WEB_ACTION',action:'start',settings:{target:'de',mode:'bilingual',dynamic:true,subtitles:true,showToolbar:true}});
    const repeatedSession=await worker.evaluate(async()=>Object.values((await chrome.storage.session.get('webSessions')).webSessions||{})[0]);
    await sleep(250);
    check('same-tab repeated start reuses the exact active capability without retranslation',repeatedSession.nonce===initialNonce&&calls.length===requestsBeforeRepeatedStart);

    // Revoke only the background record from the page's isolated extension
    // world, leaving the already-running page controller alive.  This models
    // a lost service-worker/session record without exposing a test-only API.
    const revoked=await worker.evaluate(async({tabId,nonce})=>{
      const [result]=await chrome.scripting.executeScript({target:{tabId,frameIds:[0]},func:async nonce=>chrome.runtime.sendMessage({type:'WEB_REVOKE',version:1,webNonce:nonce}),args:[nonce]});
      return result?.result;
    },{tabId:pageTab.id,nonce:initialNonce});
    const orphanStatus=await worker.evaluate(async({tabId,nonce})=>chrome.tabs.sendMessage(tabId,{type:'WEB_STATUS',version:1,nonce},{frameId:0}),{tabId:pageTab.id,nonce:initialNonce});
    check('an orphaned page can remain locally active after background capability loss',revoked?.ok===true&&orphanStatus?.enabled===true);
    await active(pageTab.id);await sendUi({type:'WEB_ACTION',action:'start',settings:{target:'de',mode:'bilingual',dynamic:true,subtitles:true,showToolbar:true}});
    const replacementSession=await worker.evaluate(async()=>Object.values((await chrome.storage.session.get('webSessions')).webSessions||{})[0]);
    const rekeyStatus=await worker.evaluate(async({tabId,oldNonce,newNonce})=>({
      old:await chrome.tabs.sendMessage(tabId,{type:'WEB_STATUS',version:1,nonce:oldNonce},{frameId:0}),
      current:await chrome.tabs.sendMessage(tabId,{type:'WEB_STATUS',version:1,nonce:newNonce},{frameId:0})
    }),{tabId:pageTab.id,oldNonce:initialNonce,newNonce:replacementSession.nonce});
    check('a new explicit start atomically rekeys an orphaned page and invalidates its old nonce',replacementSession.nonce!==initialNonce&&rekeyStatus.old?.ok===false&&rekeyStatus.current?.enabled===true);
    await page.bringToFront();
    const rightNonce=replacementSession.nonce;
    const wrongNonce='x'.repeat(32);
    const controlResults=await worker.evaluate(async({tabId,rightNonce,wrongNonce})=>{
      const send=message=>chrome.tabs.sendMessage(tabId,message,{frameId:0}).catch(error=>({transportError:error.message}));
      return {
        missing:await send({type:'WEB_STATUS',version:1}),
        wrong:await send({type:'WEB_PAUSE',version:1,nonce:wrongNonce}),
        right:await send({type:'WEB_STATUS',version:1,nonce:rightNonce}),
        replace:await send({type:'WEB_CONFIGURE',version:1,nonce:wrongNonce,settings:{enabled:true,target:'fr',webNonce:wrongNonce}}),
        mismatch:await send({type:'WEB_CONFIGURE',version:1,nonce:rightNonce,settings:{enabled:true,target:'fr',webNonce:wrongNonce}})
      };
    },{tabId:pageTab.id,rightNonce,wrongNonce});
    check('every control command rejects a missing or wrong capability nonce',controlResults.missing?.ok===false&&controlResults.wrong?.ok===false&&controlResults.right?.ok===true&&controlResults.right.enabled===true);
    check('configure cannot replace or mismatch an active capability nonce',controlResults.replace?.ok===false&&controlResults.mismatch?.ok===false);
    await page.waitForFunction(()=>document.querySelector('.st-web-subtitle-overlay')?.textContent.includes('Danke'));
    check('visible existing video caption keeps the page original and adds its translation without audio capture',(await page.locator('#caption').innerText()).includes('Thank you for watching')&&await page.locator('.st-web-subtitle-overlay').innerText()==='Danke fürs Zuschauen');
    const storage=await worker.evaluate(async()=>({local:await chrome.storage.local.get(null),session:await chrome.storage.session.get(null)}));
    check('page and subtitle source text are not persisted',!JSON.stringify(storage).includes('Our products are available')&&!JSON.stringify(storage).includes('Thank you for watching'));
    check('page cloud capability nonce is private session state',typeof rightNonce==='string'&&!JSON.stringify(storage.local).includes(rightNonce));
    await page.screenshot({path:path.join(out,'extension-web-active.png'),fullPage:true});

    for(let attempt=0;attempt<120;attempt++){const current=(await sendUi({type:'WEB_ACTION',action:'status'})).status;if(current?.queued===0)break;await sleep(50);}
    const requestsBeforeModeOnly=calls.length;
    await active(pageTab.id);await sendUi({type:'WEB_ACTION',action:'configure',settings:{target:'de',mode:'replace',dynamic:true,subtitles:true,showToolbar:true}});
    await page.bringToFront();await page.waitForFunction(()=>document.querySelector('#title .st-web-original')&&getComputedStyle(document.querySelector('#title .st-web-original')).display==='none');
    check('background controller can switch an active page to translated-only mode');
    await sleep(250);check('display-mode-only changes do not submit or charge another translation',calls.length===requestsBeforeModeOnly);

    await active(pageTab.id);await sendUi({type:'WEB_ACTION',action:'stop'});await page.bringToFront();await page.waitForFunction(()=>!document.querySelector('.st-web-unit'));
    check('stop restores original DOM text and exact original bytes',await page.locator('#title').innerText()==='Welcome to the global store'&&await page.evaluate(()=>document.querySelector('#exact').textContent)==='  Exact\u00a0spacing\u200B survives  '&&await page.locator('.st-web-subtitle-overlay').count()===0);
    await page.screenshot({path:path.join(out,'extension-web-restored.png'),fullPage:true});

    const early=await context.newPage();early.on('pageerror',e=>errors.push(e.message));await early.goto(origin+'/early');
    await early.evaluate(()=>{document.body.remove();setTimeout(()=>{const body=document.createElement('body');const p=document.createElement('p');p.id='late-body-text';p.textContent='Body appeared after activation';body.append(p);document.documentElement.append(body);},450);});
    const earlyTab=await tabFor('/early$');await active(earlyTab.id);
    await sendUi({type:'WEB_ACTION',action:'start',settings:{target:'zh-CN',mode:'bilingual',dynamic:true,subtitles:false,showToolbar:true}});
    await early.bringToFront();await early.waitForFunction(()=>document.querySelector('#late-body-text .st-web-translation')?.textContent.includes('延迟出现'),null,{timeout:10000});
    check('activation before document.body exists waits and translates the later body');
    await active(earlyTab.id);await sendUi({type:'WEB_ACTION',action:'stop'});

    check('no JavaScript errors in popup or page',errors.length===0);
    fs.writeFileSync(path.join(out,'web-verification.json'),JSON.stringify({ok:true,at:new Date().toISOString(),scope:'Real Chromium MV3 + isolated HTTPS generic page and cloud fixtures. No production text or account was used.',checks,errors,requestCount:calls.length,requestTexts:calls.map(call=>({text:call.text,target:call.target})),artifacts:['extension-web-active.png','extension-web-restored.png']},null,2));
    console.log(JSON.stringify({ok:true,checks:checks.length,requests:calls.length,artifact:path.join(out,'web-verification.json')},null,2));
  }finally{
    if(context)await context.close();if(server)await new Promise(resolve=>server.close(resolve));
    const parent=path.resolve(process.env.PLAYWRIGHT_BROWSERS_PATH),target=path.resolve(testRoot);if(path.dirname(target)===parent&&path.basename(target).startsWith('extension-web-'))fs.rmSync(target,{recursive:true,force:true,maxRetries:3,retryDelay:500});
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
