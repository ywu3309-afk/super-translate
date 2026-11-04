'use strict';

const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const http=require('node:http');
const assert=require('node:assert/strict');
const {_electron}=require('playwright');
const {inspectRoot,DEFAULT_WINDOWS_ROOT}=require('../src/speech-runtime');

(async()=>{
  if(process.platform!=='win32'){console.log('incoming-voice: skipped (Windows-only model package)');return;}
  const json=(response,status,payload,extra={})=>{response.writeHead(status,{'content-type':'application/json','cache-control':'no-store',...extra});response.end(JSON.stringify(payload));};
  const speechFixture=process.env.ST_TEST_SPEECH_SERVER==='1';
  let model,wav,speechServer=null,speechFixtureRoot='',speechTranscriptions=0;const speechRequests=[];
  if(speechFixture){
    speechFixtureRoot=fs.mkdtempSync(path.join(os.tmpdir(),'st-incoming-voice-model-'));model={root:speechFixtureRoot};wav=path.join(__dirname,'german-reference.wav');
    assert.equal(fs.existsSync(wav),true,'repository WAV fixture is missing');
    speechServer=http.createServer((request,response)=>{
      if(request.method==='GET'&&request.url==='/health')return json(response,200,{status:'ok',device:'ci-fixture',models_loaded:['sensevoice']});
      if(request.method==='POST'&&request.url==='/v1/audio/transcriptions'){
        let bytes=0;request.on('error',()=>{});request.on('data',chunk=>bytes+=chunk.length);request.on('end',()=>{speechTranscriptions++;speechRequests.push({bytes,contentType:String(request.headers['content-type']||'')});json(response,200,{text:'早上9点到下午5点是营业时间',language:'zh',duration:1.2,segments:[]});});return;
      }
      request.resume();return json(response,404,{error:'not_found'});
    });
    await new Promise((resolve,reject)=>{speechServer.once('error',reject);speechServer.listen(18080,'127.0.0.1',resolve);});
  }else{
    model=inspectRoot(process.env.SUPER_TRANSLATE_ASR_ROOT||DEFAULT_WINDOWS_ROOT);wav=path.join(model.root,'super-translate-runtime','speech-test.wav');
    assert.equal(model.installed,true,`speech model is incomplete: ${model.missing.join(', ')}`);assert.equal(fs.existsSync(wav),true,'run test:speech-runtime once to create the WAV fixture');
  }
  const audio=fs.readFileSync(wav),calls=[],audioFetches=[],credentials={username:'incoming_voice_customer',password:'Incoming-Voice-6285'};let failNextVoiceTranslation=false;
  const server=http.createServer((request,response)=>{
    if(request.url.startsWith('/voice.wav')){audioFetches.push(request.url);response.writeHead(200,{'content-type':'audio/wav','content-length':audio.length,'access-control-allow-origin':'*','cache-control':'no-store'});response.end(audio);return;}
    let raw='';request.on('data',chunk=>raw+=chunk);request.on('end',()=>{let body={};try{body=JSON.parse(raw||'{}');}catch{}calls.push({url:request.url,body,authorization:request.headers.authorization||''});
      if(request.url==='/api/login')return json(response,401,{ok:false,error:'invalid'});
      if(request.url==='/api/customer-login'&&body.username===credentials.username&&body.password===credentials.password)return json(response,200,{ok:true,token:'incoming-voice-token',customer:{id:'incoming-voice-1',username:credentials.username,plan:'monthly',speechTier:'advanced',quota:500000,used:0,expires:'2099-12-31',status:'active'}});
      if(request.url==='/api/speech-authorize'&&request.headers.authorization==='Bearer incoming-voice-token')return json(response,200,speechFixture?{ok:true,speechTier:'basic',engine:'sensevoice',model:'sensevoice'}:{ok:true,speechTier:'advanced',engine:'whisper',model:'faster-whisper-small'});
      if(request.url==='/api/translate'&&request.headers.authorization==='Bearer incoming-voice-token'){
        if(failNextVoiceTranslation&&/ZXQKEEP\d+QXZ/.test(String(body.text||''))){failNextVoiceTranslation=false;return json(response,503,{ok:false,error:'injected_voice_translation_failure'});}
        return json(response,200,{ok:true,translation:String(body.text||''),charged:String(body.text||'').length,quota:499986,used:14});
      }
      return json(response,404,{ok:false,error:'not_found'});
    });
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  const base=`http://127.0.0.1:${server.address().port}`,profile=fs.mkdtempSync(path.join(os.tmpdir(),'st-incoming-voice-'));
  const env={...process.env,ST_TEST_PROFILE:profile,ST_CLOUD_BASE:base,ST_TEST_FIXTURE:'voice',ST_TEST_VOICE_AUDIO:`${base}/voice.wav`,SUPER_TRANSLATE_ASR_ROOT:model.root};delete env.ELECTRON_RUN_AS_NODE;
  const app=await _electron.launch({executablePath:require('electron'),args:[path.resolve('src/desktop.js')],env});
  const checks=[];const ok=(name,value)=>{assert.ok(value,name);checks.push(name);};
  try{
    const page=await app.firstWindow();await page.fill('#account',credentials.username);await page.fill('#password',credentials.password);await page.locator('#login-form').evaluate(form=>form.requestSubmit());await page.waitForURL('**/workbench/index.html');
    await page.waitForFunction(()=>document.querySelector('#saved-status')?.textContent==='当前聊天已连接');await page.evaluate(()=>window.superDesktop.saveSettings({engine:'deepl'}));
    const wa=app.windows().find(candidate=>candidate.url().includes('wa-voice-fixture.html'));assert.ok(wa,'incoming voice fixture WebContentsView was not found');const waPageErrors=[];wa.on('pageerror',error=>waPageErrors.push(String(error?.message||error)));await wa.waitForSelector('#incoming-voice-root .st-voice-action');
    ok('Current WhatsApp detached-audio bridge is installed in the page world',await wa.evaluate(()=>window.__superTranslateWhatsAppMediaBridgeV1===true));
    ok('Current WhatsApp fixture has no discoverable DOM audio element',await wa.locator('audio').count()===0);
    ok('All incoming historical voice bubbles receive a manual action despite duplicate internal player ids',await wa.locator('.st-voice-action').count()===3&&await wa.locator('#incoming-voice-root .st-voice-action').textContent()==='转文字并翻译');
    ok('Duplicate internal player ids do not collapse distinct WhatsApp messages',await wa.locator('[data-id="shared-internal-audio-player"]').count()===2&&await wa.locator('#incoming-voice-HIST-SHARED-001 .st-voice-action, #incoming-voice-HIST-SHARED-002 .st-voice-action').count()===2);
    await app.evaluate(({ipcMain})=>{globalThis.__stVoiceSnapshots=[];ipcMain.on('wa:snapshot',(_event,snapshot)=>{globalThis.__stVoiceSnapshots.push({key:String(snapshot?.key||''),voiceKey:String(snapshot?.voiceKey||''),title:String(snapshot?.title||''),connected:!!snapshot?.connected});});});
    const forceVoiceSnapshot=async()=>{
      let before=await app.evaluate(()=>globalThis.__stVoiceSnapshots.length),lastTargetId=0;
      for(let attempt=0;attempt<3;attempt++){
        lastTargetId=await app.evaluate(({webContents})=>{const target=webContents.getAllWebContents().find(candidate=>candidate.getURL().includes('wa-voice-fixture.html'));if(!target)throw new Error('incoming voice fixture WebContents was not found in the main process');target.send('wa:command',{op:'snapshot'});return target.id;});
        const snapshots=await app.evaluate(async before=>{const deadline=Date.now()+1500;while(globalThis.__stVoiceSnapshots.length<=before&&Date.now()<deadline)await new Promise(resolve=>setTimeout(resolve,25));return globalThis.__stVoiceSnapshots.slice(before);},before);
        if(snapshots.length)return snapshots.at(-1);
        before=await app.evaluate(()=>globalThis.__stVoiceSnapshots.length);await wa.waitForTimeout(150);
      }
      assert.fail(`forced wa:command snapshot produced no wa:snapshot event (webContents ${lastTargetId})`);
    };
    const setChatProbe=async(direction,suffix)=>{await wa.evaluate(([value,tail])=>window.setChatProbeId(value,tail),[direction,suffix]);await wa.waitForTimeout(400);};
    await setChatProbe('false','FIRST');const firstSnapshot=await forceVoiceSnapshot();
    ok('External chat id keeps the historical raw serialized key',firstSnapshot.key==='false_8613282655871@c.us_FIRST_probe');
    ok('Voice chat id strips direction and per-message suffix',firstSnapshot.voiceKey==='8613282655871@c.us');
    await setChatProbe('false','SECOND');const secondSnapshot=await forceVoiceSnapshot();
    ok('Changing only the message suffix keeps the voice chat key stable',secondSnapshot.key!==firstSnapshot.key&&secondSnapshot.voiceKey===firstSnapshot.voiceKey);
    await setChatProbe('true','THIRD');const trueDirectionSnapshot=await forceVoiceSnapshot();
    ok('Outgoing-style serialized ids normalize to the same voice peer key',trueDirectionSnapshot.key!==firstSnapshot.key&&trueDirectionSnapshot.voiceKey===firstSnapshot.voiceKey);
    await wa.evaluate(()=>window.setSelectedRow(true,'false_999999999999@c.us_selected'));await wa.waitForTimeout(400);const selectedRowSnapshot=await forceVoiceSnapshot();
    ok('A selected row raw serialized id takes precedence over message ids',selectedRowSnapshot.key==='false_999999999999@c.us_selected'&&selectedRowSnapshot.voiceKey==='999999999999@c.us');
    await wa.evaluate(()=>window.setSelectedRow(false));await wa.waitForTimeout(400);const noSelectionSnapshot=await forceVoiceSnapshot();
    ok('No selected row is handled without a preload page error',noSelectionSnapshot.key==='true_8613282655871@c.us_THIRD_probe'&&noSelectionSnapshot.voiceKey==='8613282655871@c.us'&&waPageErrors.length===0);
    await wa.evaluate(()=>{window.setSelectedRow(false);const probe=document.getElementById('chat-message-id-probe');probe.setAttribute('data-id','not-a-chat-id');document.body.append(document.createTextNode(''));});await wa.waitForTimeout(400);const malformedSnapshot=await forceVoiceSnapshot();
    ok('Malformed serialized ids fall back to the deterministic phone key',malformedSnapshot.key==='phone:+8613282655871'&&waPageErrors.length===0);
    await setChatProbe('false','BASE');await wa.evaluate(()=>window.setSelectedRow(true));await wa.waitForTimeout(400);
    ok('Voice action is mounted inside the current msg-container',await wa.locator('#incoming-voice-root [data-testid="msg-container"] > .st-voice-translation').count()===1);
    ok('Outgoing voice bubbles never receive a voice action',await wa.locator('.outgoing .st-voice-action').count()===0);
    ok('Ordinary incoming text bubbles never receive a voice action',await wa.locator('[data-id="C9FDE48FE7115E213B10"] .st-voice-action').count()===0);
    const preloadSource=fs.readFileSync(path.resolve('src/wa-preload.js'),'utf8');
    const directionFunctions=preloadSource.slice(preloadSource.indexOf('function stableVoiceId'),preloadSource.indexOf('const VOICE_PRIMARY_SLIDER_SELECTOR'))+preloadSource.slice(preloadSource.indexOf('function explicitVoiceDirection'),preloadSource.indexOf('const VOICE_SIGNAL_SELECTOR'));
    const directionChecks=await wa.evaluate(source=>new Function(source+`
      const root=document.createElement('div'),checks={};
      const msg=(id,tail='')=>'<div><div role="row" tabindex="-1"><div data-testid="conv-msg-'+id+'"><div data-testid="msg-container">'+(tail?'<span data-icon="tail-'+tail+'"></span>':'')+'<div role="slider"></div></div></div></div></div>';
      const select=id=>root.querySelector('[data-testid="conv-msg-'+id+'"]');
      root.innerHTML='<div>'+msg('first','in')+msg('next')+'</div>';
      checks.inheritIncoming=isIncomingVoice(select('next'),'');
      root.innerHTML='<div>'+msg('first','out')+msg('next')+'</div>';
      checks.rejectOutgoing=!isIncomingVoice(select('next'),'');
      root.innerHTML='<div>'+msg('first','in')+msg('next')+msg('last','out')+'</div>';
      checks.rejectMixedGroup=!isIncomingVoice(select('next'),'');
      root.innerHTML='<div>'+msg('first')+msg('next')+'</div>';
      checks.rejectMissingTail=!isIncomingVoice(select('next'),'');
      root.innerHTML='<div tabindex="0">'+msg('first','in')+msg('next')+'</div>';
      checks.stopAtList=!isIncomingVoice(select('next'),'');
      root.innerHTML='<div><div>'+msg('first','in')+msg('first2')+'</div><div>'+msg('next')+'</div></div>';
      checks.rejectWholeGroups=!isIncomingVoice(select('next'),'');
      root.innerHTML=msg('false_123@c.us_MESSAGE');
      checks.acceptSerializedIncoming=isIncomingVoice(select('false_123@c.us_MESSAGE'),'');
      root.innerHTML=msg('true_123@c.us_MESSAGE');
      checks.rejectSerializedOutgoing=!isIncomingVoice(select('true_123@c.us_MESSAGE'),'');
      root.innerHTML=msg('true_123@c.us_MESSAGE','in');
      checks.rejectConflictingId=!isIncomingVoice(select('true_123@c.us_MESSAGE'),'');
      return checks;
    `)(),directionFunctions);
    for(const [name,passed] of Object.entries(directionChecks))ok('Direction boundary: '+name,passed);
    await wa.evaluate(()=>window.rebuildIncomingVoice());await wa.waitForFunction(()=>document.querySelectorAll('.st-voice-action').length===3&&document.querySelector('#incoming-voice-root .st-voice-action'));
    ok('Virtual-list DOM rebuild restores exactly one action for each of three incoming messages',await wa.locator('.st-voice-action').count()===3);
    await wa.evaluate(()=>{window.__mediaEvents=[];window.addEventListener('message',event=>{if(String(event.data?.type||'').includes('SUPER_TRANSLATE_WHATSAPP_MEDIA'))window.__mediaEvents.push({type:event.data.type,src:event.data.src||'',token:event.data.token||''});},true);});
    await wa.locator('#incoming-voice-root .st-voice-action').click();
    try{await wa.waitForFunction(()=>Boolean(document.querySelector('.st-voice-chinese')?.textContent.trim()),null,{timeout:60000});}
    catch(error){console.error('incoming-voice diagnostic',JSON.stringify({status:await wa.locator('.st-voice-status').textContent().catch(()=>''),failure:await wa.locator('.st-voice-error').textContent().catch(()=>''),mediaEvents:await wa.evaluate(()=>window.__mediaEvents||[]),bridge:await wa.evaluate(()=>({bridge:window.__superTranslateWhatsAppMediaBridgeV1,proto:String(HTMLMediaElement.prototype.play).slice(0,100)})),calls},null,2));throw error;}
    ok('Detached page audio stays outside the document after the explicit click',await wa.locator('audio').count()===0);
    ok('Media capture bridge acknowledges the per-message token before playback',await wa.evaluate(()=>{const events=window.__mediaEvents||[],ack=events.find(event=>event.type==='SUPER_TRANSLATE_WHATSAPP_MEDIA_CAPTURE_ACK_V1'),media=events.find(event=>event.type==='SUPER_TRANSLATE_WHATSAPP_MEDIA_PLAY_V1');return !!ack?.token&&media?.token===ack.token;}));
    const transcript=await wa.locator('.st-voice-original').textContent(),translation=await wa.locator('.st-voice-chinese').textContent(),voiceTranslations=()=>calls.filter(call=>call.url==='/api/translate'&&/ZXQKEEP\d+QXZ/.test(String(call.body?.text||'')));
    ok('Authorized speech pipeline transcribed the selected customer message',/早上[九9].*下午[五5]/.test(transcript)&&(!speechFixture||speechTranscriptions===1));
    ok('Recognized text was translated to Chinese',translation.startsWith('中文译文：')&&/[时時]间|時間/.test(translation));
    ok('One explicit translation request was billed through the cloud proxy',voiceTranslations().length===1);
    ok('Incoming voice workflow never sends a reply',await wa.evaluate(()=>window.sentCount)===0);
    ok('Result explicitly states that it will not auto-send',/不会自动发送/.test(await wa.locator('#incoming-voice-root .st-voice-status').textContent()));
    await wa.evaluate(()=>{window.__mediaEvents=[];for(const button of document.querySelectorAll('#incoming-voice-HIST-SHARED-001 .st-voice-action,#incoming-voice-HIST-SHARED-002 .st-voice-action'))button.click();});
    await wa.waitForFunction(()=>document.querySelectorAll('#incoming-voice-HIST-SHARED-001 .st-voice-chinese,#incoming-voice-HIST-SHARED-002 .st-voice-chinese').length===2,null,{timeout:120000});
    ok('Concurrent manual voice clicks are serialized through distinct capture tokens',await wa.evaluate(()=>{const media=(window.__mediaEvents||[]).filter(event=>event.type==='SUPER_TRANSLATE_WHATSAPP_MEDIA_PLAY_V1'&&/HIST-SHARED-/.test(event.src));return media.length>=2&&new Set(media.map(event=>event.token)).size>=2&&['HIST-SHARED-001','HIST-SHARED-002'].every(id=>media.some(event=>event.src.includes(`message=${id}`)));}));
    ok('Concurrent manual voice capture still never sends a reply',await wa.evaluate(()=>window.sentCount)===0);
    await wa.waitForTimeout(1200);
    await wa.evaluate(()=>{
      window.appendIncomingVoice('NEW-VOICE-001',true);
      window.appendIncomingVoice('NEW-VOICE-002',false,true);
      window.appendIncomingVoice('NEW-VOICE-003',false,true);
    });
    await wa.waitForFunction(()=>document.querySelectorAll('[id^="incoming-voice-NEW-VOICE-"] .st-voice-action').length===3);
    await wa.evaluate(()=>{window.rebuildVoiceContainer('incoming-voice-NEW-VOICE-002');window.rebuildVoiceRoot('incoming-voice-NEW-VOICE-003');});
    await wa.waitForFunction(()=>document.querySelectorAll('[id^="incoming-voice-NEW-VOICE-"] .st-voice-action').length===3);
    ok('Slider-only current WhatsApp voice shape is detected',await wa.locator('#incoming-voice-NEW-VOICE-001 .st-voice-action').count()===1);
    ok('Replacing only the inner msg-container reattaches the existing voice card',await wa.locator('#incoming-voice-NEW-VOICE-002 [data-testid="msg-container"] > .st-voice-translation').count()===1);
    ok('Replacing an entire queued voice root preserves one voice card for that message key',await wa.locator('#incoming-voice-NEW-VOICE-003 .st-voice-action').count()===1);
    try{await wa.waitForFunction(()=>document.querySelectorAll('[id^="incoming-voice-NEW-VOICE-"] .st-voice-chinese').length===3,null,{timeout:180000});}
    catch(error){console.error('automatic incoming-voice diagnostic',JSON.stringify({entries:await wa.locator('.st-voice-translation').evaluateAll(nodes=>nodes.map(node=>({status:node.querySelector('.st-voice-status')?.textContent||'',error:node.querySelector('.st-voice-error')?.textContent||'',translated:node.querySelector('.st-voice-chinese')?.textContent||''}))),calls},null,2));throw error;}
    ok('Three consecutive new customer voices are automatically transcribed and translated',await wa.locator('[id^="incoming-voice-NEW-VOICE-"] .st-voice-chinese').count()===3);
    ok('Automatic voice jobs survive inner and whole-root virtual-list rebuilds',await wa.locator('#incoming-voice-NEW-VOICE-001 .st-voice-chinese, #incoming-voice-NEW-VOICE-002 .st-voice-chinese, #incoming-voice-NEW-VOICE-003 .st-voice-chinese').count()===3);
    ok('Automatic voice jobs are serialized and each translation is billed once',voiceTranslations().length===6);
    ok('Every uncached voice obtains a fresh cloud speech entitlement',calls.filter(call=>call.url==='/api/speech-authorize').length===6);
    ok('Each queued message fetched its own captured media URL',new Set(audioFetches.filter(url=>/message=NEW-VOICE-/.test(url))).size===3&&['NEW-VOICE-001','NEW-VOICE-002','NEW-VOICE-003'].every(id=>audioFetches.some(url=>url.includes(`message=${id}`))));
    ok('Automatic voice workflow still never sends a reply',await wa.evaluate(()=>window.sentCount)===0);
    const automaticStatuses=await wa.locator('[id^="incoming-voice-NEW-VOICE-"] .st-voice-status').allTextContents();
    ok('Every automatic result explicitly says it will not send',automaticStatuses.every(text=>/已自动转写并翻译.*不会自动发送/.test(text)));
    const liveSharedIds=['LIVE-SHARED-001','LIVE-SHARED-002','LIVE-SHARED-003','LIVE-SHARED-004','LIVE-SHARED-005'];
    await wa.evaluate(ids=>window.appendLiveSharedVoiceGroup(...ids),liveSharedIds);
    await wa.waitForFunction(()=>document.querySelectorAll('#live-shared-directional-wrapper .st-voice-action').length===5,null,{timeout:15000});
    ok('Five live-style voices inside one shared directional wrapper receive separate actions',await wa.locator('#live-shared-directional-wrapper .st-voice-action').count()===5);
    await wa.evaluate(()=>window.rebuildVoiceRoot('incoming-voice-LIVE-SHARED-003'));
    try{await wa.waitForFunction(()=>document.querySelectorAll('#live-shared-directional-wrapper .st-voice-chinese').length===5,null,{timeout:90000});}
    catch(error){console.error('live-shared voice diagnostic',JSON.stringify({entries:await wa.locator('#live-shared-directional-wrapper > .fixture-message').evaluateAll(nodes=>nodes.map(node=>({id:node.id,key:node.getAttribute('data-st-voice-key')||'',status:node.querySelector('.st-voice-status')?.textContent||'',error:node.querySelector('.st-voice-error')?.textContent||'',translated:node.querySelector('.st-voice-chinese')?.textContent||'',buttonLabel:node.querySelector('.fixture-play')?.getAttribute('aria-label')||'',icon:node.querySelector('[data-icon]')?.getAttribute('data-icon')||''}))),audioFetches,calls,speechTranscriptions},null,2));throw error;}
    ok('Live-style fallback message keys survive a whole-root rebuild',await wa.locator('#incoming-voice-LIVE-SHARED-003 .st-voice-chinese').count()===1);
    ok('Five consecutive live-style customer voices are all transcribed and translated once',await wa.locator('#live-shared-directional-wrapper .st-voice-chinese').count()===5&&voiceTranslations().length===11&&calls.filter(call=>call.url==='/api/speech-authorize').length===11);
    ok('Live-style voices use distinct media and never send a reply',new Set(audioFetches.filter(url=>/message=LIVE-SHARED-/.test(url))).size===5&&liveSharedIds.every(id=>audioFetches.some(url=>url.includes(`message=${id}`)))&&await wa.evaluate(()=>window.sentCount)===0);
    const tailIds=Array.from({length:5},(_,i)=>`TAIL-IN-${i+1}`);
    await wa.evaluate(ids=>{
      window.appendTailOnlyVoiceGroup('out',ids.map(id=>id.replace('IN','OUT')));
      window.appendTailOnlyVoiceGroup('unknown',ids.map(id=>id.replace('IN','UNKNOWN')));
      window.appendTailOnlyVoiceGroup('in',ids);
    },tailIds);
    await wa.waitForFunction(()=>document.querySelectorAll('#tail-only-in .st-voice-action').length===5,null,{timeout:15000});
    ok('Live-DOM-shape fixture: all five independent tail-only incoming siblings receive actions',await wa.locator('#tail-only-in .st-voice-action').count()===5);
    ok('Live-DOM-shape fixture: outgoing and unknown groups never inherit incoming direction across the list',await wa.locator('#tail-only-out .st-voice-action, #tail-only-unknown .st-voice-action').count()===0);
    await wa.evaluate(()=>window.rebuildVoiceRoot('incoming-voice-TAIL-IN-3'));
    await wa.waitForFunction(()=>document.querySelectorAll('#tail-only-in .st-voice-chinese').length===5,null,{timeout:90000});
    ok('Live-DOM-shape fixture: all five tail-only incoming voices are automatically processed once',voiceTranslations().length===16&&calls.filter(call=>call.url==='/api/speech-authorize').length===16);
    ok('Live-DOM-shape fixture: separate message identities capture five separate media URLs',new Set(audioFetches.filter(url=>/message=TAIL-IN-/.test(url))).size===5);
    ok('Live-DOM-shape fixture: no outgoing or unknown voice audio is ever fetched',!audioFetches.some(url=>/message=TAIL-(?:OUT|UNKNOWN)-/.test(url)));
    await wa.evaluate(()=>window.rebuildVoiceRoot('incoming-voice-TAIL-IN-4'));
    await wa.waitForFunction(()=>!!document.querySelector('#incoming-voice-TAIL-IN-4 .st-voice-chinese'),null,{timeout:15000});
    ok('Live-DOM-shape fixture: rebuilding a tail-less bubble restores its result without duplicate billing',voiceTranslations().length===16&&await wa.locator('#tail-only-in .st-voice-action').count()===5);
    ok('Live-DOM-shape fixture: voice translation never sends a reply',await wa.evaluate(()=>window.sentCount)===0);
    failNextVoiceTranslation=true;await wa.evaluate(()=>window.appendIncomingVoice('FAIL-VOICE-001'));
    await wa.waitForFunction(()=>document.querySelector('#incoming-voice-FAIL-VOICE-001 .st-voice-error'),null,{timeout:90000});
    await wa.evaluate(()=>window.appendIncomingVoice('AFTER-FAIL-VOICE-001'));
    await wa.waitForFunction(()=>document.querySelector('#incoming-voice-AFTER-FAIL-VOICE-001 .st-voice-chinese'),null,{timeout:90000});
    ok('A failed automatic voice does not poison the following queue',await wa.locator('#incoming-voice-FAIL-VOICE-001 .st-voice-error').count()===1&&await wa.locator('#incoming-voice-AFTER-FAIL-VOICE-001 .st-voice-chinese').count()===1);
    ok('The failed automatic voice remains manually retryable',await wa.locator('#incoming-voice-FAIL-VOICE-001 .st-voice-action').textContent()==='翻译为中文');
    ok('Failure-continuation workflow still never sends a reply',await wa.evaluate(()=>window.sentCount)===0);
    const cacheFile=path.join(profile,'incoming-voice-cache-v1.bin'),cacheText=fs.readFileSync(cacheFile,'utf8');
    ok('Voice result cache is encrypted at rest',!cacheText.includes('营业时间')&&!cacheText.includes('早上九点'));
    await wa.reload();await wa.waitForFunction(()=>Boolean(document.querySelector('#incoming-voice-root .st-voice-chinese')?.textContent.trim()),null,{timeout:15000});
    ok('Reload restores the exact message result from local cache',await wa.locator('#incoming-voice-root .st-voice-chinese').textContent()===translation);
    ok('Cache restore does not repeat ASR billing or translation',voiceTranslations().length===18&&(!speechFixture||speechTranscriptions===18&&speechRequests.length===18&&speechRequests.every(request=>request.bytes>audio.length&&/^multipart\/form-data;\s*boundary=/i.test(request.contentType))));
    fs.mkdirSync(path.resolve('outputs'),{recursive:true});const screenshot=path.resolve('outputs','incoming-voice-translation.png');await wa.screenshot({path:screenshot,fullPage:true});
    console.log(JSON.stringify({ok:true,checks:checks.length,passed:checks,transcript,translation,neverSent:true,speechFixture,screenshot},null,2));
  }finally{await app.close().catch(()=>{});await new Promise(resolve=>server.close(resolve));if(speechServer)await new Promise(resolve=>speechServer.close(resolve));try{fs.rmSync(profile,{recursive:true,force:true});}catch{}if(speechFixtureRoot)try{fs.rmSync(speechFixtureRoot,{recursive:true,force:true});}catch{}}
})().catch(error=>{console.error(error);process.exit(1);});
