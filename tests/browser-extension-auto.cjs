'use strict';
// Real Chromium + MV3 worker; all account / WhatsApp data below is synthetic.
const fs=require('node:fs'),path=require('node:path'),https=require('node:https'),assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
process.env.PLAYWRIGHT_BROWSERS_PATH=process.env.PLAYWRIGHT_BROWSERS_PATH||'D:\\SuperTranslate\\BrowserTesting';
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),ext=path.join(root,'browser-extension'),out=path.join(root,'outputs','browser-extension');
const testRoot=fs.mkdtempSync(path.join(process.env.PLAYWRIGHT_BROWSERS_PATH,'extension-ui-'));
const checks=[],errors=[];fs.mkdirSync(out,{recursive:true});
function check(name,condition=true){assert.ok(condition,name);checks.push(name);console.log('PASS '+name);}
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const fixture=`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><style>
*{box-sizing:border-box}body{font-family:'Segoe UI','Microsoft YaHei',sans-serif;margin:0;color:#253649;background:#eef2f6}aside{position:absolute;top:54px;bottom:0;left:0;width:280px;background:white;border-right:1px solid #dde5ec;padding:24px}aside h2{font-size:19px;margin:0 0 24px}aside .contact{padding:17px 0;border-bottom:1px solid #eef1f5}aside small{color:#789;display:block;margin-top:7px}.demo{background:#122c49;color:#c9e4ff;padding:14px 24px;font-size:12px;height:54px}#main{position:absolute;left:280px;right:0;top:54px;bottom:0;background:#eef3f8}header{height:72px;background:white;padding:22px;font-weight:600;border-bottom:1px solid #dfe7f1}.messages{padding:30px;width:56%;min-width:280px}article{margin-bottom:24px;max-width:400px;padding:16px;background:white;border-radius:12px;box-shadow:0 1px 3px #0001;font-size:14px}footer{position:absolute;bottom:0;left:0;right:0;padding:20px;background:#fff;display:flex;gap:14px}[contenteditable]{min-height:44px;padding:12px;border:1px solid #ccd9e6;border-radius:8px;flex:1}#send{background:#176652;border:0;color:white;border-radius:8px;padding:10px 22px}
</style></head><body><div class="demo">界面验收环境 · 以下聊天与账号均为模拟数据，未发送真实消息</div><aside><h2>聊天</h2><div class="contact"><b>Demo customer</b><small>Hallo, ist das Produkt verfügbar?</small></div><div class="contact">示例联系人<small>用于检查插件界面布局</small></div></aside><main id="main"><header><span title="Demo customer">Demo customer</span></header><div class="messages"><article data-pre-plain-text="demo"><span class="selectable-text">Hallo, ist das Produkt verfügbar?</span></article></div><footer><div contenteditable="true" role="textbox" aria-label="聊天输入框"></div><button id="send">发送</button></footer></main><script>window.sent=0;document.getElementById('send').onclick=()=>window.sent++;</script></body></html>`;
(async()=>{
  let context,server;
  try{
    // Never touch real Windows certificate stores. This self-signed key exists only in the isolated test folder.
    execFileSync('pwsh.exe',['-NoProfile','-Command',`$r=[System.Security.Cryptography.RSA]::Create(2048);$q=[System.Security.Cryptography.X509Certificates.CertificateRequest]::new('CN=127.0.0.1',$r,[System.Security.Cryptography.HashAlgorithmName]::SHA256,[System.Security.Cryptography.RSASignaturePadding]::Pkcs1);$c=$q.CreateSelfSigned([DateTimeOffset]::UtcNow.AddMinutes(-1),[DateTimeOffset]::UtcNow.AddDays(1));[IO.File]::WriteAllText('${testRoot.replaceAll("'","''")}/cert.pem',$c.ExportCertificatePem());[IO.File]::WriteAllText('${testRoot.replaceAll("'","''")}/key.pem',$r.ExportPkcs8PrivateKeyPem());$c.Dispose();$r.Dispose()`],{stdio:'pipe'});
    let quota=487520,used=12480,mode='active',calls=0,translationDelay=90;const requests=[];
    const token='synthetic-test-session-token-not-a-real-credential';
    const customer=()=>({id:'fixture-customer',username:'demo_customer',status:'active',quota,used,allocatedQuota:500000,plan:'月度套餐',expires:'2030-12-31',parentId:'fixture-parent'});
    server=https.createServer({cert:fs.readFileSync(path.join(testRoot,'cert.pem')),key:fs.readFileSync(path.join(testRoot,'key.pem'))},async(req,res)=>{
      let raw='';for await(const part of req)raw+=part;let body={};try{body=JSON.parse(raw||'{}');}catch{}
      const reply=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(data));};
      if(req.url==='/api/customer-login')return body.password==='fixture-password'?reply(200,{ok:true,token,customer:customer()}):reply(401,{ok:false,error:'invalid'});
      if(req.headers.authorization!==`Bearer ${token}`)return reply(401,{ok:false,error:'unauthorized'});
      if(mode==='expired')return reply(403,{ok:false,error:'expired'});
      if(mode==='disabled')return reply(403,{ok:false,error:'disabled'});
      if(req.url==='/api/customer-heartbeat')return reply(200,{ok:true});
      if(req.url==='/api/customer-usage')return reply(200,{ok:true,...customer()});
      if(req.url==='/api/translate'){
        calls++;requests.push({text:body.text,target:body.target_lang});if(quota<body.text.length)return reply(402,{ok:false,error:'quota_exceeded'});
        quota-=body.text.length;used+=body.text.length;await sleep(translationDelay);
        const translation=/Hallo/.test(body.text)?'你好，请问这个产品有货吗？':body.target_lang==='DE'?'Guten Tag, ich helfe Ihnen gerne.':body.target_lang==='ES'?'Hola, estaré encantado de ayudarle.':'Hello, I am happy to help you.';
        return reply(200,{ok:true,translation,quota,used,charged:body.text.length});
      }
      reply(404,{ok:false,error:'not_found'});
    });
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin=`https://127.0.0.1:${server.address().port}`;
    const testExt=path.join(testRoot,'extension');fs.cpSync(ext,testExt,{recursive:true});
    fs.writeFileSync(path.join(testExt,'cloud-config.js'),`globalThis.ST_CLOUD_ORIGIN=${JSON.stringify(origin)};`);
    const manifest=JSON.parse(fs.readFileSync(path.join(testExt,'manifest.json'),'utf8'));manifest.host_permissions.push(origin+'/*');manifest.content_security_policy.extension_pages=manifest.content_security_policy.extension_pages.replace('connect-src ',`connect-src ${origin} `);fs.writeFileSync(path.join(testExt,'manifest.json'),JSON.stringify(manifest));
    context=await chromium.launchPersistentContext(path.join(testRoot,'profile'),{channel:'chromium',headless:true,args:[`--disable-extensions-except=${testExt}`,`--load-extension=${testExt}`,'--ignore-certificate-errors'],viewport:{width:420,height:850}});
    const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker');const id=new URL(worker.url()).hostname;
    const popup=await context.newPage();popup.on('pageerror',e=>errors.push(e.message));await popup.goto(`chrome-extension://${id}/popup.html`);
    await popup.locator('#login-section').waitFor({state:'visible'});
    check('MV3 service worker loads and login UI initializes');
    check('brand logo loads',await popup.locator('.brand-logo').evaluate(e=>e.complete&&e.naturalWidth===128));
    for(const width of [420,360,320]){await popup.setViewportSize({width,height:850});check(`login no overflow at ${width}`,await popup.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
    await popup.setViewportSize({width:420,height:850});await popup.screenshot({path:path.join(out,'extension-login.png'),fullPage:true});
    await popup.locator('#username').fill('demo_customer');await popup.locator('#password').fill('wrong-password');await popup.locator('#login-button').click();await popup.waitForFunction(()=>document.querySelector('#feedback').textContent.includes('账号或密码'));
    check('incorrect password shows a safe error');check('password immediately cleared',await popup.locator('#password').inputValue()==='');
    await popup.locator('#password').fill('fixture-password');await popup.locator('#remember').check();await popup.locator('#login-button').click();await popup.locator('#account-section').waitFor({state:'visible'});
    check('login + heartbeat reach isolated HTTPS fixture');check('child role survives sanitized status',await popup.locator('#account-role').innerText()==='子账号');
    const storage=await worker.evaluate(async()=>({local:await chrome.storage.local.get(null),session:await chrome.storage.session.get(null)}));
    check('password not persisted',!JSON.stringify(storage).includes('fixture-password'));check('token absent from persistent local storage',!JSON.stringify(storage.local).includes(token));check('remember username only',storage.local.lastUsername==='demo_customer');
    const publicStatus=await popup.evaluate(()=>chrome.runtime.sendMessage({type:'STATUS'}));check('popup status contains no token',!JSON.stringify(publicStatus).includes(token));
    for(const query of ['波兰','pl','Polski']){
      const picker=popup.locator('.st-language-picker').nth(1);await picker.locator('.st-language-trigger').click();await picker.getByRole('combobox').fill(query);check(`language search ${query}`,await picker.getByRole('option').count()===1);await picker.getByRole('combobox').press('Enter');check(`Enter selects ${query}`,await popup.locator('#outgoing').inputValue()==='pl');
    }
    const outgoing=popup.locator('.st-language-picker').nth(1);await outgoing.locator('.st-language-trigger').click();await outgoing.getByRole('combobox').fill('no-such-language');await outgoing.getByRole('combobox').press('Enter');check('empty language result does not change selection',await popup.locator('#outgoing').inputValue()==='pl');await outgoing.getByRole('combobox').press('Escape');check('Escape closes menu',await outgoing.locator('.st-language-menu').isHidden());
    await outgoing.locator('.st-language-trigger').click();await popup.locator('h1').click();check('outside click closes menu',await outgoing.locator('.st-language-menu').isHidden());
    await outgoing.locator('.st-language-trigger').click();await outgoing.getByRole('combobox').fill('English');await outgoing.getByRole('combobox').press('Enter');
    await popup.locator('#enabled').check();await popup.locator('#save').click();await popup.waitForFunction(()=>document.querySelector('#feedback').textContent.includes('已保存'));
    check('saved settings persist in actual MV3 storage',(await worker.evaluate(async()=> (await chrome.storage.local.get('settings')).settings)).enabled===true);
    await popup.screenshot({path:path.join(out,'extension-account.png'),fullPage:true});
    await outgoing.locator('.st-language-trigger').click();await outgoing.getByRole('combobox').fill('de');await popup.screenshot({path:path.join(out,'extension-language-search.png'),fullPage:true});await outgoing.getByRole('combobox').press('Escape');
    await popup.locator('#test-section summary').click();await popup.locator('#sample').fill('你好，很高兴为你服务。');const before=quota;await popup.locator('#test-button').click();await popup.waitForFunction(()=>document.querySelector('#test-result').textContent.includes('Hello'));
    check('trial translation renders',await popup.locator('#test-result').innerText()==='Hello, I am happy to help you.');check('test fixture quota decremented exactly once',before-quota==='你好，很高兴为你服务。'.length&&calls===1);
    const wa=await context.newPage();wa.on('pageerror',e=>errors.push(e.message));
    const autoFixture=fixture.replaceAll('Hallo, ist das Produkt verfügbar?', 'Hallo, ich möchte dieses Produkt kaufen. Können Sie mir bitte sagen, ob es noch verfügbar ist und wie lange die Lieferung nach Deutschland dauert?').replace('<aside>','<aside id="pane-side">').replace('<article data-pre-plain-text="demo">','<article class="message-in" data-id="false_491570001111@c.us_MSG1" data-pre-plain-text="demo">').replace('<button id="send">','<button id="send" aria-label="Send">').replace("window.sent=0;document.getElementById('send').onclick=()=>window.sent++;",`window.sent=0;window.sentTexts=[];window.activePeer='491570001111@c.us';window.nativeNoop=false;window.preventEdit=false;
      function sendNative(){if(window.nativeNoop)return;const editor=document.querySelector('[contenteditable]');const text=editor.innerText.trim();if(!text)return;window.sent++;window.sentTexts.push({text,peer:window.activePeer});const article=document.createElement('article');article.className='message-out';article.dataset.id='true_'+window.activePeer+'_OUT'+window.sent;article.dataset.prePlainText='fixture outgoing';const span=document.createElement('span');span.className='selectable-text';span.textContent=text;article.append(span);document.querySelector('.messages').append(article);editor.textContent='';editor.dispatchEvent(new Event('input',{bubbles:true}));}
      document.getElementById('send').onclick=sendNative;
      window.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing&&e.target.isContentEditable){e.preventDefault();sendNative();}},true);
      window.addEventListener('input',e=>{if(window.preventEdit&&e.target.isContentEditable)e.target.textContent='你好，输入框拒绝替换时不发送。';},true);
      window.switchPeer=(peer,source)=>{window.activePeer=peer;document.querySelector('#main header span').title=peer;document.querySelector('#main header span').textContent=peer;document.querySelector('.messages').replaceChildren();const row=document.createElement('article');row.className='message-in';row.dataset.id='false_'+peer+'_IN1';row.dataset.prePlainText='fixture';const text=document.createElement('span');text.className='selectable-text';text.textContent=source;row.append(text);document.querySelector('.messages').append(row);document.querySelector('[contenteditable]').textContent='';};`);
    await context.route('https://web.whatsapp.com/**',r=>r.fulfill({contentType:'text/html',body:autoFixture}));await wa.setViewportSize({width:1440,height:1000});await wa.goto('https://web.whatsapp.com/');
    await wa.locator('#wat-launcher').waitFor();await wa.locator('#wat-launcher').click();await wa.waitForFunction(()=>document.querySelector('#wat-launcher').textContent.includes('已启用'));
    check('content-script logo loads',await wa.locator('#wat-panel .wat-logo').evaluate(e=>e.complete&&e.naturalWidth>0));check('old branding and engine selection removed',!await wa.locator('#wat-panel').innerText().then(t=>/清晰翻译|DeepSeek|DeepL|选择引擎/.test(t)));
    await wa.locator('.wat-translation button').first().click();await wa.waitForFunction(()=>document.querySelector('.wat-translated').textContent.includes('有货'));
    await wa.locator('#wat-source').fill('你好，很高兴为你服务。');await wa.locator('.wat-primary').click();await wa.waitForFunction(()=>document.querySelector('#wat-output').value.includes('Hello'));
    await wa.getByRole('button',{name:'填入草稿',exact:true}).click();await wa.waitForFunction(()=>document.querySelector('.wat-feedback').textContent.includes('已填入输入框，尚未发送'));
    check('manual fill still updates contenteditable',await wa.locator('[contenteditable]').innerText()==='Hello, I am happy to help you.');check('no synthetic sending',await wa.evaluate(()=>window.sent)===0);
    await wa.screenshot({path:path.join(out,'extension-chat-panel.png'),fullPage:true});
    const panelPicker=wa.locator('#wat-target + .st-language-picker');await panelPicker.locator('.st-language-trigger').click();await panelPicker.getByRole('combobox').fill('Deutsch');await panelPicker.getByRole('combobox').press('Enter');check('chat panel language Enter works',await wa.locator('#wat-target').inputValue()==='de');
    check('target change invalidates prior draft',await wa.getByRole('button',{name:'填入草稿',exact:true}).isDisabled());
    for(const width of [1024,768,390]){await wa.setViewportSize({width,height:850});const bounds=await wa.locator('#wat-panel').boundingBox();check(`panel contained at ${width}`,bounds.x>=0&&bounds.x+bounds.width<=width);}
    const old=fs.readFileSync(path.join(root,'tests','fixtures','legacy-whatsapp-content.js'),'utf8').replaceAll('\r\n','\n'),now=fs.readFileSync(path.join(ext,'content.js'),'utf8').replaceAll('\r\n','\n');
    const fillCode=s=>s.slice(s.indexOf('  async function fillDraft(){'),s.indexOf('  async function translateMessage('));check('legacy fillDraft implementation unchanged byte-for-byte',fillCode(old)===fillCode(now));
    const oldSelector=s=>s.match(/function getEditor\(\).*\n.*function chatKey\(\).*\n/)[0];check('legacy editor and chat selectors unchanged',oldSelector(old)===oldSelector(now));
    // Opt-in native composer tests. All sends below terminate in the synthetic document only.
    await wa.setViewportSize({width:1440,height:1000});const native=wa.locator('[contenteditable]');await native.fill('');
    await popup.locator('#auto-send').check();await popup.locator('#reply-mode').selectOption('follow');await popup.locator('#save').click();
    const shortDetection=await worker.evaluate(()=>new Promise(resolve=>chrome.i18n.detectLanguage('Hallo, ist das Produkt verfügbar?',resolve)));
    check('short text confidence comes from actual Chrome detector',typeof shortDetection.isReliable==='boolean');
    await wa.waitForFunction(()=>!document.querySelector('.wat-live-card').hidden&&document.querySelector('.wat-contact-card>.wat-help').textContent.includes('德语'),null,{timeout:5000}).catch(async e=>{console.log('Composer diagnostic',await wa.locator('#wat-panel').innerText());throw e;});
    check('actual Chrome language detection identifies customer German');
    await popup.locator('#auto').check();await popup.locator('#save').click();await wa.waitForFunction(()=>document.querySelector('.wat-state').textContent.includes('自动翻译'));
    const beforeIncoming=calls;await wa.evaluate(()=>{for(const [direction,id,text]of [['in','AUTO_IN','Hallo, können Sie mir bitte den Preis und die Lieferzeit für dieses Produkt mitteilen?'],['out','AUTO_OUT','This is my own outgoing fixture message.']]){const row=document.createElement('article');row.className='message-'+direction;row.dataset.id=(direction==='in'?'false_':'true_')+window.activePeer+'_'+id;row.dataset.prePlainText='fixture';const span=document.createElement('span');span.className='selectable-text';span.textContent=text;row.append(span);document.querySelector('.messages').append(row);}});
    await wa.waitForFunction(()=>document.querySelector('[data-id$="AUTO_IN"] .wat-translated')?.textContent.includes('有货'));await sleep(400);check('new incoming customer message translates automatically',calls===beforeIncoming+1);check('own outgoing message is excluded from auto-translation',await wa.locator('[data-id$="AUTO_OUT"] .wat-translated').innerText()==='');await popup.locator('#auto').uncheck();await popup.locator('#save').click();
    let priorCalls=calls,priorSent=await wa.evaluate(()=>sent);
    await native.fill('你好，这是自动翻译测试。');await wa.waitForFunction(()=>document.querySelector('.wat-live-card').dataset.phase==='ready');
    check('live preview keeps original input untouched',await native.innerText()==='你好，这是自动翻译测试。');check('follow-customer chooses German',requests.at(-1).target==='DE');
    await wa.screenshot({path:path.join(out,'extension-native-preview.png'),fullPage:true});
    await native.press('Enter');await wa.waitForFunction(()=>document.querySelector('.wat-live-card').dataset.phase==='sent');
    check('Enter sends exactly one translated message',await wa.evaluate(n=>sent===n+1&&sentTexts.at(-1).text==='Guten Tag, ich helfe Ihnen gerne.',priorSent));check('paid preview reused without a second translation request',calls===priorCalls+1);
    await wa.screenshot({path:path.join(out,'extension-native-sent.png'),fullPage:true});
    priorSent=await wa.evaluate(()=>sent);priorCalls=calls;await native.fill('你好，第二条测试消息。');await native.press('Enter');await native.press('Enter');await wa.waitForFunction(n=>sent===n+1,priorSent);await wa.waitForFunction(()=>document.querySelector('.wat-live-card').dataset.phase==='sent');check('rapid Enter before debounce sends once',await wa.evaluate(n=>sent===n+1,priorSent)&&calls===priorCalls+1);
    priorSent=await wa.evaluate(()=>sent);await native.fill('你好，点击发送按钮的测试。');await wa.locator('#send').click();await wa.locator('#send').click();await wa.waitForFunction(n=>sent===n+1,priorSent);await wa.waitForFunction(()=>document.querySelector('.wat-live-card').dataset.phase==='sent');check('double-click sends only once',await wa.evaluate(n=>sent===n+1,priorSent));
    priorSent=await wa.evaluate(()=>sent);await native.fill('输入法测试');await native.dispatchEvent('compositionstart');await native.dispatchEvent('keydown',{key:'Enter',code:'Enter',isComposing:true,bubbles:true});await sleep(180);check('IME candidate Enter does not send',await wa.evaluate(n=>sent===n,priorSent));await native.dispatchEvent('compositionend');await native.press('Shift+Enter');check('Shift Enter stays a newline',await wa.evaluate(n=>sent===n,priorSent));await native.fill('');
    await sleep(130);translationDelay=450;priorSent=await wa.evaluate(()=>sent);await native.fill('这是一条将被修改的草稿。');await native.press('Enter');await sleep(100);await native.fill('这是修改之后的新草稿。');await sleep(550);check('editing while translating cancels old send',await wa.evaluate(n=>sent===n,priorSent));check('new user draft is not overwritten',await native.innerText()==='这是修改之后的新草稿。');await native.fill('');await sleep(600);
    await native.fill('这是一条切换会话前的草稿。');await native.press('Enter');await sleep(100);await wa.locator('#pane-side h2').click();await wa.evaluate(()=>switchPeer('346100002222@c.us','Hola, quisiera saber si este producto está disponible para comprarlo.'));await sleep(600);check('conversation switch cancels in-flight send',await wa.evaluate(n=>sent===n,priorSent));translationDelay=90;
    await wa.waitForFunction(()=>document.querySelector('.wat-contact-card>.wat-help').textContent.includes('西班牙语'));check('second customer has independent Spanish detection');
    const cp=wa.locator('#wat-contact-reply + .st-language-picker');await cp.locator('button.st-language-trigger').click();await cp.getByRole('combobox').fill('Français');await cp.getByRole('combobox').press('Enter');await sleep(150);check('per-customer manual reply target saved',await wa.locator('#wat-contact-reply').inputValue()==='fr');
    await wa.locator('#pane-side h2').click();await wa.evaluate(()=>switchPeer('491570001111@c.us','OK'));await wa.waitForFunction(()=>document.querySelector('.wat-contact-card>.wat-help').textContent.includes('德语'));check('short OK retains first customer German',await wa.locator('#wat-contact-reply').inputValue()==='default');
    await wa.locator('#pane-side h2').click();await wa.evaluate(()=>switchPeer('346100002222@c.us','123 👍'));await wa.waitForFunction(()=>document.querySelector('#wat-contact-reply').value==='fr');check('second customer reply preference survives switching');
    await wa.locator('#pane-side h2').click();await wa.evaluate(()=>switchPeer('491570001111@c.us','OK'));await wa.waitForFunction(()=>document.querySelector('#wat-contact-reply').value==='default');
    // Unknown short-message customer must not silently fall back to English.
    await wa.locator('#pane-side h2').click();await wa.evaluate(()=>switchPeer('390000003333@c.us','OK'));await sleep(150);await native.fill('你好，无法识别语言时不要发送。');await native.press('Enter');await sleep(200);check('unknown language blocks instead of guessing',await wa.evaluate(n=>sent===n,priorSent));await native.fill('');
    await wa.locator('#pane-side h2').click();await wa.evaluate(()=>switchPeer('491570001111@c.us','OK'));await wa.waitForFunction(()=>document.querySelector('.wat-contact-card>.wat-help').textContent.includes('德语'));
    // On-send-only mode must not spend characters while the operator is still typing.
    await popup.locator('#live-preview').uncheck();await popup.locator('#save').click();await sleep(1700);priorCalls=calls;await native.fill('仅在发送时翻译，输入时不扣费。');await sleep(650);check('send-only mode makes no preview translation requests',calls===priorCalls);await native.press('Enter');await wa.waitForFunction(()=>document.querySelector('.wat-live-card').dataset.phase==='sent');check('send-only mode translates and sends on Enter',calls===priorCalls+1);priorSent=await wa.evaluate(()=>sent);await popup.locator('#live-preview').check();await popup.locator('#save').click();await sleep(1700);
    await native.fill('你好，输入框拒绝替换时不发送。');await wa.waitForFunction(()=>document.querySelector('.wat-live-card').dataset.phase==='ready');await wa.evaluate(()=>window.preventEdit=true);await native.press('Enter');await wa.waitForFunction(()=>document.querySelector('#wat-live-status').textContent.includes('无法确认输入框'));check('failed input replacement preserves original and never clicks send',await native.innerText()==='你好，输入框拒绝替换时不发送。'&&await wa.evaluate(n=>sent===n,priorSent));await wa.evaluate(()=>window.preventEdit=false);await native.fill('');
    // A no-op native send remains uncertain; pressing Enter again must not duplicate/retry.
    await wa.evaluate(()=>window.nativeNoop=true);await native.fill('你好，未确认发送结果测试。');await native.press('Enter');await wa.waitForFunction(()=>document.querySelector('.wat-live-card').dataset.phase==='uncertain');priorCalls=calls;await native.press('Enter');await sleep(250);check('unconfirmed native send does not auto-retry',calls===priorCalls&&await wa.evaluate(n=>sent===n,priorSent));await wa.evaluate(()=>window.nativeNoop=false);await native.fill('');
    // Sending revalidates cloud authorization even when a preview was already paid for.
    await native.fill('你好，检查到期后禁止发送。');await wa.waitForFunction(()=>document.querySelector('.wat-live-card').dataset.phase==='ready');mode='expired';await native.press('Enter');await wa.waitForFunction(()=>document.querySelector('#wat-live-status').textContent.includes('到期'));check('expiry after preview blocks sending and preserves Chinese draft',await native.innerText()==='你好，检查到期后禁止发送。'&&await wa.evaluate(n=>sent===n,priorSent));
    mode='active';await popup.reload();await popup.locator('#login-section').waitFor({state:'visible'});await popup.locator('#password').fill('fixture-password');await popup.locator('#login-button').click();await popup.locator('#account-section').waitFor({state:'visible'});await native.fill('');await popup.locator('#enabled').check();await popup.locator('#save').click();await sleep(1700);
    await wa.reload();await wa.locator('#wat-launcher').click();await wa.waitForFunction(()=>document.querySelector('.wat-contact-card>.wat-help').textContent.includes('德语'));check('contact language survives page reload with same account');priorSent=await wa.evaluate(()=>sent);
    quota=0;priorCalls=calls;await native.fill('你好，余额不足的测试。');await native.press('Enter');await wa.waitForFunction(()=>document.querySelector('#wat-live-status').textContent.includes('额度不足'));await native.press('Enter');await sleep(200);check('zero quota blocks original and avoids automatic retry',calls===priorCalls+1&&await wa.evaluate(n=>sent===n,priorSent));
    await native.fill('');await popup.locator('#auto-send').uncheck();await popup.locator('#save').click();await sleep(1700);await native.fill('manual fixture only');await native.press('Enter');check('turning feature off restores native manual sending',await wa.evaluate(n=>sent===n+1,priorSent));
    mode='expired';await popup.locator('#refresh').click();await popup.locator('#login-section').waitFor({state:'visible'});check('expiry disables and signs out extension',(await worker.evaluate(async()=> (await chrome.storage.local.get('settings')).settings)).enabled===false);
    check('expiry clears cached chat preview',await wa.waitForFunction(()=>document.querySelector('#wat-launcher').textContent.includes('请登录')).then(()=>true));
    mode='active';await popup.locator('#password').fill('fixture-password');await popup.locator('#login-button').click();await popup.locator('#account-section').waitFor({state:'visible'});await popup.locator('#logout').click();await popup.locator('#login-section').waitFor({state:'visible'});
    check('logout clears session',(await worker.evaluate(async()=> (await chrome.storage.session.get('cloudSession')).cloudSession))===undefined);
    check('no page JavaScript errors',errors.length===0);
    await context.close();context=null;
    // No login and no translation on production: only public health and denied unauthenticated request.
    context=await chromium.launchPersistentContext(path.join(testRoot,'production-smoke'),{channel:'chromium',headless:true,args:[`--disable-extensions-except=${ext}`,`--load-extension=${ext}`]});
    const liveWorker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker');
    const production=await liveWorker.evaluate(async()=>{try{const h=await fetch('https://supertranslation.carseatcoverspace.com/api/health',{signal:AbortSignal.timeout(15000)}),data=await h.json();const denied=await fetch('https://supertranslation.carseatcoverspace.com/api/translate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:'connection probe',target_lang:'EN-US'}),signal:AbortSignal.timeout(15000)});return {healthStatus:h.status,ok:data.ok===true,storage:data.storage,unauthenticatedStatus:denied.status};}catch(e){return{unverified:true,error:e.name};}});
    fs.writeFileSync(path.join(out,'auto-verification.json'),JSON.stringify({ok:true,at:new Date().toISOString(),scope:'Real Chromium MV3 native-composer tests + real Chrome language detection. Account, translations and WhatsApp transport are isolated fixtures, NOT production sends.',checks,errors,production},null,2));
    console.log(JSON.stringify({ok:true,checks:checks.length,production,artifacts:out},null,2));
  }finally{
    if(context)await context.close();if(server)await new Promise(resolve=>server.close(resolve));
    // Bounded removal of this test's generated cert, copied extension and profiles only.
    const parent=path.resolve(process.env.PLAYWRIGHT_BROWSERS_PATH),target=path.resolve(testRoot);
    if(path.dirname(target)===parent&&path.basename(target).startsWith('extension-ui-'))fs.rmSync(target,{recursive:true,force:true,maxRetries:3,retryDelay:500});
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
