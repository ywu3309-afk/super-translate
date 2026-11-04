'use strict';

const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const crypto=require('node:crypto');
const {spawn}=require('node:child_process');

const DEFAULT_PORT=18080;
const DEFAULT_WINDOWS_ROOT='D:\\SuperTranslate\\SpeechModel\\funasr-1.4.11';
const DEFAULT_WHISPER_ROOT='D:\\SuperTranslate\\SpeechModel\\whisper-multilingual';
const MAX_AUDIO_BYTES=25*1024*1024;
const WHISPER_WORKER_SHA256='3CDF11E57EFDD17DB38979D546A6C490A007346238D4B6D494DE34D369DBE273';
const SENSEVOICE_LANGUAGES=new Set(['zh','zh-CN','zh-TW','yue','en','ja','ko']);
const SPEECH_TIERS=Object.freeze({
  basic:Object.freeze({id:'basic',engine:'sensevoice',label:'初级语音版'}),
  advanced:Object.freeze({id:'advanced',engine:'whisper',label:'高级多语言版'}),
  flagship:Object.freeze({id:'flagship',engine:'whisper',label:'旗舰高精度版'}),
});
const WHISPER_MODEL_CANDIDATES=Object.freeze({
  advanced:Object.freeze(['faster-whisper-small']),
  flagship:Object.freeze(['faster-whisper-large-v3-turbo','faster-whisper-large-v3']),
});

const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));

function compactError(value){
  return String(value||'').replace(/\s+/g,' ').trim().slice(-500);
}

function sha256File(file){
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex').toUpperCase();
}

function firstExistingRoot(explicit=''){
  const candidates=[explicit,process.env.SUPER_TRANSLATE_ASR_ROOT,process.platform==='win32'?DEFAULT_WINDOWS_ROOT:'']
    .map(value=>String(value||'').trim())
    .filter(Boolean);
  return candidates.find(candidate=>fs.existsSync(candidate))||candidates[0]||'';
}

function inspectRoot(rootInput=''){
  const root=firstExistingRoot(rootInput);
  const basePython=path.join(root,'python','cpython-3.12.3-windows-x86_64-none','python.exe');
  const sitePackages=path.join(root,'funasr','.venv','Lib','site-packages');
  const sourceRoot=path.join(root,'funasr');
  const modelCache=path.join(root,'models');
  const senseVoice=path.join(modelCache,'models','iic--SenseVoiceSmall','snapshots','master','model.pt');
  const vad=path.join(modelCache,'models','iic--speech_fsmn_vad_zh-cn-16k-common-pytorch','snapshots','master','model.pt');
  const required={basePython,sitePackages,sourceRoot,modelCache,senseVoice,vad};
  const missing=Object.entries(required).filter(([,value])=>!fs.existsSync(value)).map(([key])=>key);
  return{root,installed:!!root&&!missing.length,missing,paths:required};
}

function firstExistingWhisperRoot(explicit=''){
  const candidates=[explicit,process.env.SUPER_TRANSLATE_WHISPER_ROOT,process.platform==='win32'?DEFAULT_WHISPER_ROOT:'']
    .map(value=>String(value||'').trim())
    .filter(Boolean);
  return candidates.find(candidate=>fs.existsSync(candidate))||candidates[0]||'';
}

function normalizeSpeechTier(value,fallback=''){
  const tier=String(value||'').trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(SPEECH_TIERS,tier)?tier:fallback;
}

function inspectWhisperRoot(rootInput='',asrRootInput='',tierInput='advanced'){
  const root=firstExistingWhisperRoot(rootInput),asr=inspectRoot(asrRootInput);
  const sitePackages=path.join(root,'site-packages');
  const bundledPython=path.join(root,'python','python.exe');
  const python=fs.existsSync(bundledPython)?bundledPython:asr.paths.basePython;
  const modelRoot=path.join(root,'models');
  const inspectTier=tier=>{
    const names=[...(WHISPER_MODEL_CANDIDATES[tier]||[])];
    if(tier==='advanced')names.push('model');
    const candidates=names.map(name=>name==='model'?path.join(root,'model'):path.join(modelRoot,name));
    const modelDir=candidates.find(candidate=>fs.existsSync(path.join(candidate,'model.bin')))||candidates[0]||'';
    return{tier,installed:!!modelDir&&fs.existsSync(path.join(modelDir,'model.bin')),modelDir,model:path.basename(modelDir||names[0]||'')};
  };
  const tiers={advanced:inspectTier('advanced'),flagship:inspectTier('flagship')};
  const requestedTier=normalizeSpeechTier(tierInput,'advanced')==='flagship'?'flagship':'advanced',selected=tiers[requestedTier];
  const required={python,sitePackages,model:path.join(selected.modelDir||'', 'model.bin'),fasterWhisper:path.join(sitePackages,'faster_whisper','__init__.py'),ctranslate2:path.join(sitePackages,'ctranslate2','__init__.py')};
  const missing=Object.entries(required).filter(([,value])=>!fs.existsSync(value)).map(([key])=>key);
  return{root,installed:!!root&&!missing.length,missing,tier:requestedTier,modelDir:selected.modelDir,model:selected.model,tiers,paths:{...required,modelDir:selected.modelDir}};
}

function audioBuffer(value){
  if(Buffer.isBuffer(value))return value;
  if(value instanceof ArrayBuffer)return Buffer.from(value);
  if(ArrayBuffer.isView(value))return Buffer.from(value.buffer,value.byteOffset,value.byteLength);
  if(value&&Array.isArray(value.data))return Buffer.from(value.data);
  throw new Error('录音数据格式无效。');
}

function createSpeechRuntime(options={}){
  const port=Number.isInteger(options.port)?options.port:DEFAULT_PORT;
  const host='127.0.0.1';
  const baseUrl=`http://${host}:${port}`;
  let child=null,starting=null,lastError='',lastOutput='',activeRoot='';
  let whisperChild=null,whisperStarting=null,whisperStartingKey='',whisperReady=null,whisperBuffer='',whisperSequence=0,whisperActiveKey='';
  const whisperPending=new Map();

  function remember(chunk){
    lastOutput=(lastOutput+String(chunk||'')).slice(-6000);
  }

  async function health(){
    try{
      const response=await fetch(`${baseUrl}/health`,{signal:AbortSignal.timeout(2500)});
      const data=await response.json().catch(()=>({}));
      if(!response.ok||data?.status!=='ok')return{ok:false,status:'offline'};
      return{ok:true,status:'ready',device:String(data.device||''),models:Array.isArray(data.models_loaded)?data.models_loaded.map(String):[],port,host};
    }catch{return{ok:false,status:'offline',port,host};}
  }

  function processEnv(info){
    const pythonPath=[info.paths.sitePackages,info.paths.sourceRoot,process.env.PYTHONPATH||''].filter(Boolean).join(path.delimiter);
    const executablePath=[path.dirname(info.paths.basePython),path.join(info.paths.sourceRoot,'.venv','Scripts'),process.env.PATH||''].filter(Boolean).join(path.delimiter);
    return{
      ...process.env,
      MODELSCOPE_CACHE:info.paths.modelCache,
      HF_HOME:info.paths.modelCache,
      HF_HUB_OFFLINE:'1',
      TRANSFORMERS_OFFLINE:'1',
      PYTHONNOUSERSITE:'1',
      PYTHONUTF8:'1',
      PYTHONPATH:pythonPath,
      PATH:executablePath,
    };
  }

  function whisperWorkerPath(){
    if(options.whisperWorker)return path.resolve(options.whisperWorker);
    const packaged=process.resourcesPath?path.join(process.resourcesPath,'runtime','whisper_worker.py'):'';
    if(packaged&&fs.existsSync(packaged))return packaged;
    return path.join(__dirname,'..','runtime','whisper_worker.py');
  }

  function rejectWhisperPending(message){
    for(const request of whisperPending.values()){clearTimeout(request.timer);request.reject(new Error(message));}
    whisperPending.clear();
  }

  function handleWhisperLine(raw){
    let data;try{data=JSON.parse(raw);}catch{return;}
    if(data?.event==='ready'){whisperReady=data;return;}
    if(data?.event==='fatal'){lastError=compactError(data.error||'Whisper 服务启动失败');rejectWhisperPending(lastError);return;}
    if(!Number.isInteger(data?.id))return;
    const request=whisperPending.get(data.id);if(!request)return;
    clearTimeout(request.timer);whisperPending.delete(data.id);
    if(data.ok)request.resolve(data);else request.reject(new Error(compactError(data.error||'Whisper 识别失败')));
  }

  function stopWhisper(message='Whisper 本地服务已停止。'){
    const running=whisperChild;whisperChild=null;whisperReady=null;whisperActiveKey='';whisperBuffer='';
    if(running&&!running.killed){try{running.stdin?.write(JSON.stringify({id:++whisperSequence,op:'stop'})+'\n');}catch{}try{running.kill();}catch{}}
    rejectWhisperPending(message);
  }

  async function startWhisper(asrRootInput='',tierInput='advanced'){
    const info=inspectWhisperRoot(options.whisperRoot||'',asrRootInput,tierInput),key=path.resolve(info.modelDir||'').toLowerCase();
    if(whisperChild&&!whisperChild.killed&&whisperReady&&whisperActiveKey===key)return{...whisperReady,root:info.root,model:info.model,tier:info.tier};
    if(whisperStarting){
      if(whisperStartingKey===key)return whisperStarting;
      await whisperStarting.catch(()=>{});
      return startWhisper(asrRootInput,tierInput);
    }
    whisperStarting=(async()=>{
      if(!info.installed){const label=SPEECH_TIERS[info.tier].label;throw new Error(`${label}模型未完整安装（缺少组件：${info.missing.join('、')}）。`);}
      const worker=whisperWorkerPath();if(!fs.existsSync(worker))throw new Error('Whisper 本地服务脚本缺失，请重新安装最新版超级翻译。');
      if(sha256File(worker)!==WHISPER_WORKER_SHA256)throw new Error('Whisper 本地服务脚本完整性校验失败，请重新安装最新版超级翻译。');
      if(whisperChild)stopWhisper('正在切换语音识别模型。');
      whisperReady=null;whisperBuffer='';lastError='';
      const pythonPath=[info.paths.sitePackages,process.env.PYTHONPATH||''].filter(Boolean).join(path.delimiter);
      const env={...process.env,PYTHONPATH:pythonPath,PYTHONNOUSERSITE:'1',PYTHONUTF8:'1',HF_HUB_OFFLINE:'1',TRANSFORMERS_OFFLINE:'1'};
      const spawned=spawn(info.paths.python,[worker,'--model-dir',info.modelDir,'--device','cpu','--compute-type','int8'],{windowsHide:true,stdio:['pipe','pipe','pipe'],env,cwd:info.root});
      whisperChild=spawned;whisperActiveKey=key;
      let exited=false;
      spawned.stdout?.on('data',chunk=>{whisperBuffer+=String(chunk);let index;while((index=whisperBuffer.indexOf('\n'))>=0){const line=whisperBuffer.slice(0,index).trim();whisperBuffer=whisperBuffer.slice(index+1);if(line)handleWhisperLine(line);}});
      spawned.stderr?.on('data',remember);
      spawned.once('error',error=>{lastError=compactError(error?.message||error);exited=true;if(whisperChild===spawned)stopWhisper(lastError);});
      spawned.once('exit',(code,signal)=>{if(code!==0&&code!==null)lastError=compactError(lastOutput||`Whisper 退出码 ${code}${signal?`，信号 ${signal}`:''}`);exited=true;if(whisperChild===spawned){whisperChild=null;whisperReady=null;whisperActiveKey='';rejectWhisperPending(lastError||'Whisper 本地服务已退出。');}});
      for(let attempt=0;attempt<120;attempt++){
        await delay(250);if(whisperReady)return{...whisperReady,root:info.root,model:info.model,tier:info.tier};if(exited)break;
      }
      if(whisperChild===spawned)stopWhisper(lastError||'Whisper 本地服务启动超时。');
      throw new Error(lastError||'Whisper 本地服务在 30 秒内未就绪。');
    })().finally(()=>{whisperStarting=null;whisperStartingKey='';});
    whisperStartingKey=key;
    return whisperStarting;
  }

  function whisperRequest(payload,timeout=180000){
    if(!whisperChild||whisperChild.killed||!whisperChild.stdin?.writable)throw new Error('Whisper 本地服务未启动。');
    const id=++whisperSequence;
    return new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{whisperPending.delete(id);reject(new Error('Whisper 识别超时，请缩短语音后重试。'));},timeout);
      whisperPending.set(id,{resolve,reject,timer});
      whisperChild.stdin.write(JSON.stringify({id,...payload})+'\n','utf8',error=>{if(!error)return;clearTimeout(timer);whisperPending.delete(id);reject(error);});
    });
  }

  async function transcribeWhisper(bytes,input,rootInput,tierInput='advanced'){
    const tier=normalizeSpeechTier(tierInput,'advanced'),info=inspectWhisperRoot(options.whisperRoot||'',rootInput,tier);
    if(!info.installed)throw new Error(`${SPEECH_TIERS[tier].label}模型尚未安装，请先安装对应语音模型。`);
    const ready=await startWhisper(rootInput,tier),tempRoot=path.join(os.tmpdir(),'super-translate-whisper');
    fs.mkdirSync(tempRoot,{recursive:true});const file=path.join(tempRoot,crypto.randomUUID()+'.wav');
    try{
      fs.writeFileSync(file,bytes,{flag:'wx'});
      const language=typeof input.language==='string'&&/^(?:auto|[a-z]{2,3}(?:-[A-Z]{2})?)$/.test(input.language)?input.language:'auto';
      const data=await whisperRequest({op:'transcribe',file,language});
      const text=String(data.text||'').trim();if(!text)throw new Error('没有识别到有效语音，请靠近麦克风后重试。');
      return{text:text.slice(0,6000),language:String(data.language||language).slice(0,20),duration:Number(data.duration)||0,segments:Array.isArray(data.segments)?data.segments.slice(0,500):[],model:String(ready.model||info.model),engine:'whisper',tier,languageProbability:Number(data.languageProbability)||0};
    }finally{try{fs.rmSync(file,{force:true});}catch{}}
  }

  async function start(rootInput=''){
    const existing=await health();
    if(existing.ok)return{...existing,root:activeRoot||firstExistingRoot(rootInput),reused:true};
    if(starting)return starting;
    starting=(async()=>{
      const info=inspectRoot(rootInput);
      if(!info.installed){
        const detail=info.root?`缺少组件：${info.missing.join('、')}`:'尚未选择语音模型目录';
        throw new Error(`语音模型未完整安装到 D 盘（${detail}）。`);
      }
      activeRoot=info.root;lastError='';lastOutput='';
      if(child&&!child.killed){try{child.kill();}catch{}}
      const args=['-m','funasr.bin.server','--model','sensevoice','--device','cuda','--host',host,'--port',String(port)];
      child=spawn(info.paths.basePython,args,{
        cwd:info.paths.sourceRoot,
        windowsHide:true,
        stdio:['ignore','pipe','pipe'],
        env:processEnv(info),
      });
      let exited=false;
      child.stdout?.on('data',remember);
      child.stderr?.on('data',remember);
      child.once('error',error=>{lastError=compactError(error?.message||error);exited=true;});
      child.once('exit',(code,signal)=>{if(code!==0&&code!==null)lastError=compactError(lastOutput||`退出码 ${code}${signal?`，信号 ${signal}`:''}`);exited=true;child=null;});
      for(let attempt=0;attempt<120;attempt++){
        await delay(1000);
        const ready=await health();
        if(ready.ok)return{...ready,root:activeRoot,reused:false};
        if(exited)break;
      }
      const detail=compactError(lastError||lastOutput);
      if(child&&!child.killed){try{child.kill();}catch{}}
      child=null;
      throw new Error(detail?`语音识别服务启动失败：${detail}`:'语音识别服务在 2 分钟内未就绪。');
    })().finally(()=>{starting=null;});
    return starting;
  }

  async function startTier(tierInput='basic',rootInput=''){
    const tier=normalizeSpeechTier(tierInput,'basic');
    if(tier==='basic')return{...(await start(rootInput)),tier,engine:'sensevoice'};
    return{...(await startWhisper(rootInput,tier)),ok:true,status:'ready',tier,engine:'whisper'};
  }

  async function status(rootInput=''){
    const info=inspectRoot(rootInput);
    const whisper=inspectWhisperRoot(options.whisperRoot||'',rootInput,'advanced'),flagship=inspectWhisperRoot(options.whisperRoot||'',rootInput,'flagship');
    const live=await health();
    const models=[...(live.models||[])];for(const candidate of [whisper,flagship])if(candidate.installed&&!models.includes(candidate.model))models.push(candidate.model);
    return{...live,models,installed:info.installed,root:info.root,missing:info.missing,model:'sensevoice',whisperInstalled:whisper.installed,whisperRoot:whisper.root,whisperModel:whisper.model,whisperMissing:whisper.missing,flagshipInstalled:flagship.installed,flagshipModel:flagship.model,flagshipMissing:flagship.missing,speechTiers:{basic:{...SPEECH_TIERS.basic,installed:info.installed},advanced:{...SPEECH_TIERS.advanced,installed:whisper.installed,model:whisper.model},flagship:{...SPEECH_TIERS.flagship,installed:flagship.installed,model:flagship.model}},lastError:compactError(lastError)};
  }

  async function transcribe(input={},rootInput=''){
    const bytes=audioBuffer(input.audio);
    if(bytes.length<44)throw new Error('录音过短或文件不完整，请重新录制。');
    if(bytes.length>MAX_AUDIO_BYTES)throw new Error('录音超过 25 MB，请缩短后重试。');
    if(bytes.toString('ascii',0,4)!=='RIFF'||bytes.toString('ascii',8,12)!=='WAVE')throw new Error('仅接受软件生成的 WAV 录音。');
    const language=typeof input.language==='string'?input.language:'auto',requestedTier=normalizeSpeechTier(input.tier),whisper=inspectWhisperRoot(options.whisperRoot||'',rootInput,'advanced');
    const explicitWhisper=input.engine==='whisper'||requestedTier==='advanced'||requestedTier==='flagship',explicitSenseVoice=input.engine==='sensevoice'||requestedTier==='basic';
    const needsWhisper=explicitWhisper||!explicitSenseVoice&&whisper.installed&&(language==='auto'||!SENSEVOICE_LANGUAGES.has(language));
    if(needsWhisper)return transcribeWhisper(bytes,input,rootInput,requestedTier==='flagship'?'flagship':'advanced');
    if(!whisper.installed&&!explicitSenseVoice&&language!=='auto'&&!SENSEVOICE_LANGUAGES.has(language))throw new Error(`当前初级语音版不支持 ${language} 语音，请升级高级多语言版。`);
    await start(rootInput);
    const form=new FormData();
    form.append('file',new Blob([bytes],{type:'audio/wav'}),'super-translate-recording.wav');
    form.append('model','sensevoice');
    form.append('response_format','verbose_json');
    if(typeof input.language==='string'&&/^[a-z]{2,3}(?:-[A-Z]{2})?$/.test(input.language))form.append('language',input.language);
    let response,data;
    try{
      response=await fetch(`${baseUrl}/v1/audio/transcriptions`,{method:'POST',body:form,signal:AbortSignal.timeout(120000)});
      data=await response.json().catch(()=>({}));
    }catch(error){throw new Error(`语音识别请求失败：${compactError(error?.message||error)}`);}
    if(!response.ok)throw new Error(`语音识别失败 (${response.status})：${compactError(data?.detail||data?.error||'本地服务拒绝请求')}`);
    const text=String(data?.text||'').trim();
    if(!text)throw new Error('没有识别到有效语音，请靠近麦克风后重试。');
    return{text:text.slice(0,6000),language:String(data?.language||'auto').slice(0,20),duration:Number(data?.duration)||0,segments:Array.isArray(data?.segments)?data.segments.slice(0,500):[],model:'sensevoice',engine:'sensevoice',tier:'basic'};
  }

  function stop(){
    if(child&&!child.killed){try{child.kill();}catch{}}
    stopWhisper('语音识别服务已停止。');
    child=null;starting=null;whisperStarting=null;whisperStartingKey='';
  }

  return{start,startTier,status,transcribe,stop,inspectRoot,inspectWhisperRoot};
}

module.exports={createSpeechRuntime,inspectRoot,inspectWhisperRoot,firstExistingRoot,firstExistingWhisperRoot,normalizeSpeechTier,SPEECH_TIERS,DEFAULT_PORT,DEFAULT_WINDOWS_ROOT,DEFAULT_WHISPER_ROOT};
