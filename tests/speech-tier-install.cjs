'use strict';

const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {_electron}=require('playwright');
const {createSpeechRuntime,inspectWhisperRoot}=require('../src/speech-runtime');
const {prepareTestLogin,loginToWorkbench}=require('./login-helper.cjs');

const root=path.resolve(__dirname,'..');
const parent='D:\\SuperTranslate';
const packageRoot='D:\\SuperTranslate\\SpeechPackages';
const packages={
  advanced:{file:path.join(packageRoot,'超级翻译-高级多语言语音AI-v1.0.0.zip'),size:574372988,sha256:'731E265B541B497675DDF4B12499CCD7F1CC6DD401DA9B4E64527F735B2F848A',model:'faster-whisper-small'},
  flagship:{file:path.join(packageRoot,'超级翻译-旗舰高精度语音AI-v1.0.0.zip'),size:1624375370,sha256:'65FD5A70103EE65E1F9C8F257454A9864C58C959D37E550A12D94259AF154E37',model:'faster-whisper-large-v3-turbo'},
};
const target=path.join(parent,`.speech-tier-install-verification-${process.pid}-${Date.now()}`);
const mismatchTarget=path.join(parent,`.speech-tier-mismatch-verification-${process.pid}-${Date.now()}`);
const temporaryNames=()=>new Set(fs.readdirSync(parent).filter(name=>/^\.speech-(?:package|staging|backup)-/.test(name)));
const sha256=file=>new Promise((resolve,reject)=>{const hash=crypto.createHash('sha256'),stream=fs.createReadStream(file);stream.on('error',reject);stream.on('data',chunk=>hash.update(chunk));stream.on('end',()=>resolve(hash.digest('hex').toUpperCase()));});
const before=temporaryNames();

async function runInstaller(tier,archive,installTarget=target){
  const profile=fs.mkdtempSync(path.join(os.tmpdir(),`st-speech-${tier}-install-`));
  const login=await prepareTestLogin(profile);let app;
  try{
    const env={...process.env,ST_TEST_PROFILE:profile,ST_TEST_FIXTURE:'1',ST_CLOUD_BASE:login.cloudBase,ST_TEST_SPEECH_TIER:tier,ST_TEST_SPEECH_PACKAGE:archive,ST_TEST_SPEECH_INSTALL_TARGET:installTarget};delete env.ELECTRON_RUN_AS_NODE;
    app=await _electron.launch({executablePath:require('electron'),args:[path.join(root,'src','desktop.js')],env});
    const page=await app.firstWindow();await loginToWorkbench(page,login);
    await page.evaluate(()=>{window.__speechInstallStatuses=[];window.superDesktop.onSpeechInstallStatus(value=>window.__speechInstallStatuses.push(value));});
    try{return{result:await page.evaluate(()=>window.superDesktop.installSpeechModel()),statuses:await page.evaluate(()=>window.__speechInstallStatuses)};}
    catch(error){return{error,statuses:await page.evaluate(()=>window.__speechInstallStatuses)};}
  }finally{
    if(app)await app.close().catch(()=>{});await login.closeCloud().catch(()=>{});try{fs.rmSync(profile,{recursive:true,force:true});}catch{}
  }
}

async function transcribe(tier){
  const runtime=createSpeechRuntime({whisperRoot:target,whisperWorker:path.join(root,'runtime','whisper_worker.py')});
  try{return await runtime.transcribe({audio:fs.readFileSync(path.join(root,'tests','german-reference.wav')),engine:'whisper',tier,language:'de'});}
  finally{runtime.stop();}
}

(async()=>{
  if(process.platform!=='win32'){console.log('speech-tier-install: skipped (Windows only)');return;}
  for(const [tier,spec] of Object.entries(packages)){
    assert.equal(fs.existsSync(spec.file),true,`${tier} speech package is missing`);
    assert.equal(fs.statSync(spec.file).size,spec.size,`${tier} speech package size changed`);
    assert.equal(await sha256(spec.file),spec.sha256,`${tier} speech package hash changed`);
  }

  let attempt=await runInstaller('flagship',packages.advanced.file,mismatchTarget);
  assert.ok(attempt.error,'advanced package must not satisfy flagship entitlement');
  assert.match(String(attempt.error?.message||attempt.error),/大小不正确|不匹配/);
  assert.equal(fs.existsSync(mismatchTarget),false,'mismatched package must not create an installed model');

  attempt=await runInstaller('advanced',packages.flagship.file,mismatchTarget);
  assert.ok(attempt.error,'flagship package must not satisfy advanced entitlement');
  assert.match(String(attempt.error?.message||attempt.error),/大小不正确|不匹配/);
  assert.equal(fs.existsSync(mismatchTarget),false,'mismatched package must not create an installed model');

  const advancedInstall=await runInstaller('advanced',packages.advanced.file);
  assert.equal(advancedInstall.result?.ok,true);assert.equal(advancedInstall.result?.tier,'advanced');assert.equal(advancedInstall.statuses.at(-1)?.stage,'ready');
  let inspected=inspectWhisperRoot(target,'','advanced');assert.equal(inspected.installed,true,`advanced install incomplete: ${inspected.missing.join(', ')}`);assert.equal(inspected.model,packages.advanced.model);
  let recognized=await transcribe('advanced');assert.equal(recognized.model,packages.advanced.model);assert.equal(recognized.language,'de');assert.match(recognized.text,/Guten Tag/i);

  const flagshipInstall=await runInstaller('flagship',packages.flagship.file);
  assert.equal(flagshipInstall.result?.ok,true);assert.equal(flagshipInstall.result?.tier,'flagship');assert.equal(flagshipInstall.statuses.at(-1)?.stage,'ready');
  inspected=inspectWhisperRoot(target,'','flagship');assert.equal(inspected.installed,true,`flagship install incomplete: ${inspected.missing.join(', ')}`);assert.equal(inspected.model,packages.flagship.model);
  assert.equal(inspectWhisperRoot(target,'','advanced').installed,true,'installing flagship must preserve the advanced model');
  recognized=await transcribe('flagship');assert.equal(recognized.model,packages.flagship.model);assert.equal(recognized.language,'de');assert.match(recognized.text,/Guten Tag/i);

  fs.rmSync(path.join(target,'models',packages.advanced.model),{recursive:true,force:true});
  assert.equal(inspectWhisperRoot(target,'','advanced').installed,false,'advanced model removal precondition failed');
  const reinstallAdvanced=await runInstaller('advanced',packages.advanced.file);
  assert.equal(reinstallAdvanced.result?.ok,true);assert.equal(reinstallAdvanced.result?.tier,'advanced');
  assert.equal(inspectWhisperRoot(target,'','advanced').installed,true,'advanced reinstall failed');
  assert.equal(inspectWhisperRoot(target,'','flagship').installed,true,'installing advanced must preserve the flagship model');

  console.log(JSON.stringify({ok:true,target,tiers:['advanced','flagship'],mismatchedPackagesBlocked:true,germanRecognition:true,crossTierPreservation:true},null,2));
})().finally(()=>{
  for(const value of [target,mismatchTarget])if(fs.existsSync(value)&&path.dirname(path.resolve(value))===path.resolve(parent))fs.rmSync(value,{recursive:true,force:true});
  const after=temporaryNames();for(const name of after)if(!before.has(name))throw new Error(`installer left temporary directory behind: ${name}`);
}).catch(error=>{console.error(error?.stack||error);process.exit(1);});
