'use strict';

const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const http=require('node:http');
const assert=require('node:assert/strict');
const {_electron}=require('playwright');
const {inspectRoot,DEFAULT_WINDOWS_ROOT}=require('../src/speech-runtime');

(async()=>{
  if(process.platform!=='win32'){console.log('speech-ui: skipped (Windows-only model package)');return;}
  const model=inspectRoot(process.env.SUPER_TRANSLATE_ASR_ROOT||DEFAULT_WINDOWS_ROOT);
  assert.equal(model.installed,true,`speech model is incomplete: ${model.missing.join(', ')}`);
  const wav=path.join(model.root,'super-translate-runtime','speech-test.wav');
  assert.equal(fs.existsSync(wav),true,'run test:speech-runtime once to create the WAV fixture');
  const calls=[];
  const credentials={username:'speech_customer',password:'Speech-Customer-6285'};
  const reply=(response,status,payload)=>{response.writeHead(status,{'content-type':'application/json'});response.end(JSON.stringify(payload));};
  const server=http.createServer((request,response)=>{let raw='';request.on('data',chunk=>raw+=chunk);request.on('end',()=>{let body={};try{body=JSON.parse(raw||'{}');}catch{}calls.push({url:request.url,body,authorization:request.headers.authorization||''});if(request.url==='/api/login')return reply(response,401,{ok:false,error:'invalid'});if(request.url==='/api/customer-login'&&body.username===credentials.username&&body.password===credentials.password)return reply(response,200,{ok:true,token:'speech-token',customer:{id:'speech-1',username:credentials.username,plan:'monthly',speechTier:'basic',quota:500000,used:0,expires:'2099-12-31',status:'active'}});if(request.url==='/api/speech-authorize'&&request.headers.authorization==='Bearer speech-token')return reply(response,200,{ok:true,speechTier:'basic',engine:'sensevoice',model:'sensevoice'});if(request.url==='/api/translate'&&request.headers.authorization==='Bearer speech-token')return reply(response,200,{ok:true,translation:'Business hours are from 9 a.m. to 5 p.m.',charged:String(body.text||'').length,quota:499986,used:14});return reply(response,404,{ok:false,error:'not_found'});});});
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  const profile=fs.mkdtempSync(path.join(os.tmpdir(),'st-speech-ui-'));
  const env={...process.env,ST_TEST_PROFILE:profile,ST_CLOUD_BASE:`http://127.0.0.1:${server.address().port}`,ST_TEST_FIXTURE:'1',SUPER_TRANSLATE_ASR_ROOT:model.root};delete env.ELECTRON_RUN_AS_NODE;
  const app=await _electron.launch({executablePath:require('electron'),args:[path.resolve('src/desktop.js'),'--use-fake-device-for-media-stream',`--use-file-for-fake-audio-capture=${wav}`],env});
  try{
    const page=await app.firstWindow();
    await page.fill('#account',credentials.username);await page.fill('#password',credentials.password);await page.locator('#login-form').evaluate(form=>form.requestSubmit());await page.waitForURL('**/workbench/index.html');
    await page.waitForFunction(()=>document.querySelector('#saved-status')?.textContent==='当前聊天已连接');const wa=app.windows().find(candidate=>candidate.url().includes('wa-fixture.html'));assert.ok(wa,'fixture WebContentsView was not found');await wa.waitForSelector('#composer');
    await page.evaluate(()=>{const select=document.getElementById('outgoing-language');select.value='en';select.dispatchEvent(new Event('change',{bubbles:true}));});
    await page.click('[data-tool="voice"]');await page.waitForSelector('.voice-translation-card');await page.waitForSelector('.speech-model-install-card');await page.waitForFunction(()=>/已安装|已就绪/.test(document.querySelector('#voice-model-status')?.textContent||''));
    assert.match(await page.textContent('.voice-translation-card'),/语音转文字翻译/);assert.match(await page.textContent('#voice-model-status'),/初级语音版已安装|初级语音版已就绪/);
    assert.match(await page.textContent('.speech-model-install-card'),/超级翻译语音 AI 大模型/);assert.equal(await page.textContent('#speech-model-install-button'),'一键导入 / 注入语音 AI 模型');
    assert.equal(await page.locator('#speech-model-download-baidu').isEnabled(),true);assert.match(await page.textContent('#speech-model-download-baidu'),/1013/);assert.equal(await page.locator('#speech-model-download-feiji').isEnabled(),true);
    await page.click('#speech-model-install-button');await page.waitForFunction(()=>/已经安装并启用|安装完成/.test(document.querySelector('#speech-model-install-status')?.textContent||''));
    assert.match(await page.textContent('#speech-model-install-status'),/已经安装并启用|安装完成/);
    await page.click('[data-tool="proxy"]');const settingsText=await page.textContent('#tool-panel');for(const removed of ['推荐文件：Hy-MT2-1.8B-Q4_K_M.gguf','DeepL 云端代理已启用','已内置 llama.cpp 本地运行时'])assert.equal(settingsText.includes(removed),false,`removed technical copy is still visible: ${removed}`);
    await page.click('[data-tool="voice"]');await page.waitForSelector('.voice-translation-card');
    await page.evaluate(()=>window.superDesktop.saveSettings({engine:'deepl'}));
    await page.click('.voice-record-button');await page.waitForFunction(()=>document.querySelector('.voice-record-button')?.classList.contains('recording'));await page.waitForTimeout(6500);await page.click('.voice-record-button');
    await page.waitForFunction(()=>document.querySelector('.voice-phase')?.classList.contains('ready'),null,{timeout:150000});
    const transcript=await page.locator('.voice-translation-card textarea').nth(0).inputValue(),translated=await page.locator('.voice-translation-card textarea').nth(1).inputValue();
    assert.match(transcript,/早上九点/);
    assert.equal(translated,'Business hours are from 9 a.m. to 5 p.m.');
    assert.equal(calls.filter(call=>call.url==='/api/translate').length,1);
    assert.ok(calls.filter(call=>call.url==='/api/speech-authorize').length>=1);
    await page.getByRole('button',{name:'填入当前聊天框'}).click();await wa.waitForFunction(expected=>document.querySelector('#composer')?.innerText.trim()===expected,translated);assert.equal(await wa.evaluate(()=>window.sentCount),0,'voice translation must not auto-send');
    fs.mkdirSync(path.resolve('outputs'),{recursive:true});await page.screenshot({path:path.resolve('outputs','voice-translation-panel.png'),fullPage:true});
    console.log(JSON.stringify({ok:true,checks:10,transcript,translation:translated,filledWithoutSending:true,screenshot:path.resolve('outputs','voice-translation-panel.png')},null,2));
  }finally{
    await app.close();await new Promise(resolve=>server.close(resolve));try{fs.rmSync(profile,{recursive:true,force:true});}catch{}
  }
})().catch(error=>{console.error(error);process.exit(1);});
