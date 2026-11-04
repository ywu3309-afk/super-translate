'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const crypto=require('node:crypto');
const {_electron}=require('playwright');
const {prepareTestLogin,loginToWorkbench}=require('./login-helper.cjs');
const {inspectRoot}=require('../src/speech-runtime');

const root=path.resolve(__dirname,'..');
const archive='D:\\SuperTranslate\\SpeechModel-Release\\超级翻译-语音转文字AI大模型.zip';
const parent='D:\\SuperTranslate';
const target=path.join(parent,`.speech-install-verification-${process.pid}-${Date.now()}`);
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'st-speech-install-'));
const temporaryNames=()=>new Set(fs.readdirSync(parent).filter(name=>/^\.speech-(?:package|staging|backup)-/.test(name)));
const sha256=file=>new Promise((resolve,reject)=>{const hash=crypto.createHash('sha256'),stream=fs.createReadStream(file);stream.on('error',reject);stream.on('data',chunk=>hash.update(chunk));stream.on('end',()=>resolve(hash.digest('hex').toUpperCase()));});
const before=temporaryNames();

(async()=>{
  if(process.platform!=='win32'){console.log('speech-install: skipped (Windows only)');return;}
  assert.equal(fs.existsSync(archive),true,'uploaded speech-model ZIP fixture is missing');
  assert.equal(fs.statSync(archive).size,8166852621,'speech-model ZIP size changed');
  assert.equal(await sha256(archive),'89BB226D82B50771FA7543CF779B6AF762731161A2657F9A8D873FA30AC708E8','speech-model ZIP hash changed');
  const login=await prepareTestLogin(profile);let app;
  try{
    const env={...process.env,ST_TEST_PROFILE:profile,ST_TEST_FIXTURE:'1',ST_CLOUD_BASE:login.cloudBase,ST_TEST_SPEECH_TIER:'basic',ST_TEST_SPEECH_PACKAGE:archive,ST_TEST_SPEECH_INSTALL_TARGET:target};delete env.ELECTRON_RUN_AS_NODE;
    app=await _electron.launch({executablePath:require('electron'),args:[path.join(root,'src','desktop.js')],env});const page=await app.firstWindow();await loginToWorkbench(page,login);
    await page.evaluate(()=>{window.__speechInstallStatuses=[];window.superDesktop.onSpeechInstallStatus(value=>window.__speechInstallStatuses.push(value));});
    const result=await page.evaluate(()=>window.superDesktop.installSpeechModel());
    assert.equal(result.ok,true);assert.equal(result.alreadyInstalled,undefined);assert.equal(path.resolve(result.model),path.resolve(target));
    const installed=inspectRoot(target);assert.equal(installed.installed,true,`installed model incomplete: ${installed.missing.join(', ')}`);
    const config=fs.readFileSync(path.join(target,'funasr','.venv','pyvenv.cfg'),'utf8');assert.match(config,new RegExp(`^home\\s*=\\s*${path.join(target,'python','cpython-3.12.3-windows-x86_64-none').replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}$`,'mi'));
    const statuses=await page.evaluate(()=>window.__speechInstallStatuses);assert.ok(statuses.some(item=>item.stage==='verifying'));assert.ok(statuses.some(item=>item.stage==='extracting-package'));assert.ok(statuses.some(item=>item.stage==='extracting'));assert.equal(statuses.at(-1)?.stage,'ready');
    console.log(JSON.stringify({ok:true,target,installed:installed.installed,statuses:statuses.map(item=>item.stage)},null,2));
  }finally{
    if(app)await app.close().catch(()=>{});await login.closeCloud().catch(()=>{});try{fs.rmSync(profile,{recursive:true,force:true});}catch{}
    if(fs.existsSync(target)&&path.dirname(path.resolve(target))===path.resolve(parent))fs.rmSync(target,{recursive:true,force:true});
    const after=temporaryNames();for(const name of after)if(!before.has(name))throw new Error(`installer left temporary directory behind: ${name}`);
  }
})().catch(error=>{console.error(error?.stack||error);process.exit(1);});
