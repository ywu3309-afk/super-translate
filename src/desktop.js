'use strict';
const {app,BrowserWindow,WebContentsView,ipcMain,session,safeStorage,dialog,Menu,screen,shell}=require('electron');
const path=require('node:path'),fs=require('node:fs'),crypto=require('node:crypto'),os=require('node:os'),{spawn}=require('node:child_process'),{pathToFileURL}=require('node:url');
const {store,phoneInfo,LANGUAGES,DEEPL_TARGETS,LOCAL_TARGET_NAMES}=require('./data');
const {protect,restore,inspectText}=require('./text-core');
const {authStore}=require('./auth');
const scrmProxy=require('./integrations/scrm-proxy');
const scrmProxyTest=require('./integrations/scrm-proxy-test');
const scrmService=require('./scrm-service');
const {createLoginPreferences}=require('./login-preferences');
const {verifyRuntimeDirectory}=require('./runtime-integrity');
const {registry:PLATFORM_REGISTRY}=require('./platforms');
const {createSpeechRuntime,normalizeSpeechTier}=require('./speech-runtime');
const singleInstanceLock=app.requestSingleInstanceLock();
if(!singleInstanceLock){app.quit();}else{app.on('second-instance',()=>{try{if(win&&!win.isDestroyed()){if(win.isMinimized())win.restore();win.show();win.focus();}}catch{}});}
let autoUpdater=null;
try{({autoUpdater}=require('electron-updater'));}catch{}
// `devTools: false` disables the normal DevTools UI, but Chromium command-line
// switches can otherwise expose the packaged renderer over the remote-debugging
// protocol. Strip every supported CDP entry point before app readiness. Keep
// these switches available in development so Playwright fixtures still work.
if(app.isPackaged){
  for(const name of ['remote-debugging-port','remote-debugging-address','remote-debugging-pipe']){
    try{app.commandLine.removeSwitch(name);}catch{}
  }
}
if(process.env.ST_TEST_PROFILE&&!app.isPackaged)app.setPath('userData',process.env.ST_TEST_PROFILE);
let win,db,auth,authSession=null,cloudSession=null,activeView=null,child=null,childKind='',childError='',modelStarting=null,speechRuntime=null,translationTail=Promise.resolve(),currentPlatform='whatsapp';
const translationCache=new Map();let fastTranslationAbort=null;
let currentLiveConfig={incoming:'zh-CN',outgoing:'en',outgoingLabel:'英语',enabled:true,automatic:false,history:false,translateSend:true,blockChinese:true};
// A login renderer is allowed to hand off to the workbench only immediately
// after the main process has accepted credentials.  Do not infer this from a
// cache file: cache files are user-writable and are not an authentication
// boundary.
let loginTransition=false;
let updateDownloadPromise=null,updateState={status:'idle',version:''};
let heartbeatTimer=null,heartbeatInitialTimer=null,heartbeatGeneration=0,heartbeatDrainPromise=null,heartbeatDrainGeneration=0,heartbeatRequestedStatus=null,heartbeatAbortController=null,gpuProbePromise=null,gpuModelCache=null,customerRefreshPromise=null;
const views=new Map(),pending=new Map(),identityRowsByAccount=new Map();let currentAccount='a',enabled=false;
const urls={login:pathToFileURL(path.join(__dirname,'login','index.html')).href,workbench:pathToFileURL(path.join(__dirname,'workbench','index.html')).href};
const DEFAULT_CLOUD_BASE='https://supertranslation.carseatcoverspace.com';
const SPEECH_MODEL_PACKAGE=Object.freeze({
  tier:'basic',label:'初级语音版',version:'1.4.11',target:'D:\\SuperTranslate\\SpeechModel\\funasr-1.4.11',
  archive:Object.freeze({name:'超级翻译-语音转文字AI大模型.zip',size:8166852621,sha256:'89BB226D82B50771FA7543CF779B6AF762731161A2657F9A8D873FA30AC708E8'}),
  volumes:Object.freeze([
    Object.freeze({names:Object.freeze(['20260901-funasr-1.4.11.part1.rar','超级翻译-语音转文字AI大模型.part1.rar']),size:4187593113,sha256:'30A6903318DB568843BEE34A023A718003B34198586A4C3304E41929D62B315C'}),
    Object.freeze({names:Object.freeze(['20260901-funasr-1.4.11.part2.rar','超级翻译-语音转文字AI大模型.part2.rar']),size:3978205510,sha256:'2E537D708DFB9D89F0ABA9269438F9B46F2166474A5033524FC31FD427BBF028'}),
  ]),
});
const WHISPER_MODEL_PACKAGES=Object.freeze({
  advanced:Object.freeze({tier:'advanced',label:'高级多语言版',version:'1.0.0',target:'D:\\SuperTranslate\\SpeechModel\\whisper-multilingual',model:'faster-whisper-small',archive:Object.freeze({name:'超级翻译-高级多语言语音AI-v1.0.0.zip',size:574372988,sha256:'731E265B541B497675DDF4B12499CCD7F1CC6DD401DA9B4E64527F735B2F848A'})}),
  flagship:Object.freeze({tier:'flagship',label:'旗舰高精度版',version:'1.0.0',target:'D:\\SuperTranslate\\SpeechModel\\whisper-multilingual',model:'faster-whisper-large-v3-turbo',archive:Object.freeze({name:'超级翻译-旗舰高精度语音AI-v1.0.0.zip',size:1624375370,sha256:'65FD5A70103EE65E1F9C8F257454A9864C58C959D37E550A12D94259AF154E37'})}),
});
const SPEECH_EXTRACTOR_HASHES=Object.freeze({
  '7z.exe':'C7245E21A7553D9E52D434002A401C77A7CA7D0F245F2311B0DDF16F8F946C6F',
  '7z.dll':'9ED007AA82E440CEB39A6E105BB1D602A9BC59A4946267BA8DE2F220AA15BC06',
});

// Renderer contents are deliberately kept on a very small, explicit origin
// allow-list. Do not use a prefix check here: a look-alike hostname such as
// `web.whatsapp.com.attacker.example` must never be treated as WhatsApp.
function internalURL(value){
  try{
    const parsed=new URL(String(value||''));
    return parsed.protocol==='file:'&&Object.values(urls).includes(parsed.href);
  }catch{return false;}
}
function whatsappURL(value){
  const raw=String(value||'');
  if(fixture&&raw===fixture)return true;
  try{
    const parsed=new URL(raw);
    return parsed.protocol==='https:'&&parsed.hostname==='web.whatsapp.com'&&(parsed.port===''||parsed.port==='443');
  }catch{return false;}
}
function platformURL(platform,value){
  if(platform==='whatsapp'||platform==='whatsapp_multi')return whatsappURL(value);
  const config=PLATFORM_REGISTRY[platform];if(!config)return false;
  try{
    const actual=new URL(String(value||'')),expected=new URL(config.url),host=actual.hostname.toLowerCase();
    if(actual.protocol!=='https:'||(actual.port||'443')!==(expected.port||'443'))return false;
    const allowed=Array.isArray(config.allowedHosts)&&config.allowedHosts.length?config.allowedHosts:[expected.hostname];
    if(!allowed.some(item=>host===String(item).toLowerCase()))return false;
    // OAuth/login redirects may legitimately change path (for example
    // messenger.com -> facebook.com/login.php). Host names remain strictly
    // allow-listed above, so this does not turn navigation into an open proxy.
    return Array.isArray(config.allowedHosts)&&config.allowedHosts.length?true:(actual.pathname===expected.pathname||actual.pathname.startsWith(expected.pathname));
  }catch{return false;}
}
function safeAccountId(value){const id=String(value||'');return /^[A-Za-z0-9_-]{1,100}$/.test(id)?id:'';}

// Proxy profiles are kept in the main-process data store rather than the
// renderer's localStorage.  Credentials are encrypted with Electron's
// platform-backed safeStorage and are never returned through IPC.
const PROXY_PROTOCOLS=Object.freeze(['http','https','socks5']);
function proxyPartition(id,platform='whatsapp'){
  return platform==='whatsapp'&&id==='a'?'persist:whatsapp':platform==='whatsapp'&&id==='b'?'persist:super-wa-'+crypto.createHash('sha256').update(id).digest('hex').slice(0,16):`persist:${id}`;
}
function proxyProfiles(){
  if(!db)return{};
  const value=db.get().proxyProfiles;
  if(!value||typeof value!=='object'||Array.isArray(value)){db.get().proxyProfiles={};return db.get().proxyProfiles;}
  return value;
}
function normalizeFingerprint(source){
  const cfg=source&&typeof source==='object'&&!Array.isArray(source)?source:{};
  const one=(value,allowed,fallback)=>allowed.includes(value)?value:fallback;
  const int=(value,min,max,fallback)=>Number.isInteger(value)?Math.max(min,Math.min(max,value)):fallback;
  const noise=cfg.noise&&typeof cfg.noise==='object'&&!Array.isArray(cfg.noise)?cfg.noise:{};
  const os=['windows','macos','linux'].includes(cfg.os)?cfg.os:'windows';
  const platform=os==='macos'?'MacIntel':os==='linux'?'Linux x86_64':'Win32';
  const languages=Array.isArray(cfg.languages)?cfg.languages.filter(x=>typeof x==='string').slice(0,8):String(cfg.language||'zh-CN,zh').split(',').map(x=>x.trim()).filter(Boolean).slice(0,8);
  return {
    enabled:cfg.enabled===true,
    webrtc:one(cfg.webrtc,['disable_udp','proxy','real','disable'],'disable_udp'),
    geo:one(cfg.geo,['ask','ip','block'],'ask'),
    webgl:one(cfg.webgl,['ip','off','real'],'ip'),
    webgpu:one(cfg.webgpu,['ip','block','real'],'ip'),
    font:one(cfg.font,['default','custom'],'default'),
    timezone:typeof cfg.timezone==='string'?cfg.timezone.slice(0,60):'auto',
    languages,
    platform,
    os,
    width:int(cfg.width,320,7680,1920),
    height:int(cfg.height,240,4320,1080),
    ua:typeof cfg.ua==='string'?cfg.ua.slice(0,300):'',
    gpu:typeof cfg.gpu==='string'?cfg.gpu.slice(0,180):'ANGLE (NVIDIA, NVIDIA GeForce GTX 1660 Direct3D11 vs_5_0 ps_5_0, D3D11)',
    hardwareConcurrency:int(cfg.hardwareConcurrency,1,64,8),
    memory:int(cfg.memory,1,128,8),
    noise:{
      canvas:noise.canvas===true,
      audio:noise.audio===true,
      webgl:noise.webgl===true,
      media:noise.media===true,
      clientRects:noise.clientRects===true,
      speech:noise.speech===true,
    },
    webglVendor:typeof cfg.webglVendor==='string'?cfg.webglVendor.slice(0,120):'Google Inc. (NVIDIA)',
    webglRenderer:typeof cfg.webglRenderer==='string'?cfg.webglRenderer.slice(0,160):'ANGLE (NVIDIA, NVIDIA GeForce GTX 1660 Direct3D11 vs_5_0 ps_5_0, D3D11)',
  };
}
function fingerprintConfig(id){
  const store=db?.get()||{};
  const key=id?String(id):'';
  const per=key&&store.fingerprints&&typeof store.fingerprints==='object'?store.fingerprints[key]:null;
  return normalizeFingerprint(per||store.fingerprint);
}
function proxySecret(value,label){
  const text=String(value??'');
  if(!text)return'';
  if(text.length>256)throw new Error(`${label}长度不能超过 256 个字符。`);
  if(!secureStorageAvailable())throw new Error('Windows 安全存储不可用，无法安全保存代理凭据。');
  return safeStorage.encryptString(text).toString('base64');
}
function readProxySecret(value){
  if(typeof value!=='string'||!value)return'';
  try{return safeStorage.decryptString(Buffer.from(value,'base64')).slice(0,256);}catch{return'';}
}
function proxyHost(value){
  const host=String(value??'').trim();
  // Hostnames, IPv4 and bracketed IPv6 are accepted; URLs, paths and
  // whitespace are rejected so credentials cannot be smuggled into rules.
  if(!host||host.length>253||/[\s\\/@;]/.test(host)||!( /^[A-Za-z0-9.-]+$/.test(host) || /^\[[0-9A-Fa-f:]+\]$/.test(host) ))throw new Error('代理主机格式无效。');
  return host;
}
function normalizeProxyInput(raw,existing={}){
  const protocol=String(raw?.protocol??existing.protocol??'http').trim().toLowerCase();
  if(!PROXY_PROTOCOLS.includes(protocol))throw new Error('代理协议仅支持 HTTP、HTTPS 或 SOCKS5。');
  const enabled=raw?.enabled===undefined?existing.enabled!==false:raw.enabled===true;
  const hostInput=String(raw?.host??existing.host??'').trim();
  if(!enabled&&!hostInput)return{protocol,host:String(existing.host||''),port:Number(existing.port)||0,enabled:false,note:String(raw?.note??existing.note??'').replace(/[\u0000-\u001f\u007f]/g,' ').trim().slice(0,200)};
  const host=proxyHost(hostInput);
  const port=Number(raw?.port??existing.port??0);
  if(!Number.isInteger(port)||port<1||port>65535)throw new Error('代理端口必须是 1–65535 的整数。');
  const note=String(raw?.note??existing.note??'').replace(/[\u0000-\u001f\u007f]/g,' ').trim().slice(0,200);
  return {protocol,host,port,enabled,note};
}
function proxyPublic(id){
  const raw=proxyProfiles()[id]||{};
  return {id,enabled:raw.enabled===true,protocol:PROXY_PROTOCOLS.includes(raw.protocol)?raw.protocol:'http',host:String(raw.host||''),port:Number.isInteger(raw.port)&&raw.port>0?raw.port:'',note:String(raw.note||''),hasUsername:!!raw.usernameEncrypted,hasPassword:!!raw.passwordEncrypted,localIp:localIPv4(),updatedAt:raw.updatedAt||''};
}
function proxyConfigForAccount(id){
  const raw=proxyProfiles()[id]||{};
  if(raw.enabled!==true)return{enabled:false};
  if(!raw.host||!Number.isInteger(raw.port))return{enabled:false};
  return{enabled:true,protocol:raw.protocol,host:raw.host,port:raw.port};
}
function proxyRules(config){
  if(!config?.enabled)return{mode:'direct'};
  const endpoint=`${config.host}:${config.port}`;
  return{mode:'fixed_servers',proxyRules:config.protocol==='socks5'?`socks5=${endpoint}`:`http=${endpoint};https=${endpoint}`,proxyBypassRules:'<local>'};
}
async function applyProxyToSession(id,ses,override){
  if(!ses||typeof ses.setProxy!=='function')return{ok:false,enabled:false};
  const config=override||proxyConfigForAccount(id);
  await ses.setProxy(proxyRules(config));
  return{ok:true,enabled:!!config.enabled};
}
function localIPv4(){
  for(const addresses of Object.values(os.networkInterfaces()))for(const address of addresses||[])if((address.family==='IPv4'||address.family===4)&&!address.internal)return address.address;
  return '未检测到';
}
async function saveProxyProfile(raw){
  const id=safeAccountId(raw?.id);if(!id)throw new Error('服务实例标识无效。');
  const profiles=proxyProfiles(),old=profiles[id]||{},normalized=normalizeProxyInput(raw,old);
  const clear=raw?.clearCredentials===true;
  const username=String(raw?.username??'').trim(),password=String(raw?.password??'');
  const next={...old,...normalized,updatedAt:new Date().toISOString()};
  if(clear){delete next.usernameEncrypted;delete next.passwordEncrypted;}
  if(username)next.usernameEncrypted=proxySecret(username,'代理用户名');
  if(password)next.passwordEncrypted=proxySecret(password,'代理密码');
  profiles[id]=next;db.save();
  const view=views.get(id),ses=view?.webContents?.session||session.fromPartition(proxyPartition(id));
  await applyProxyToSession(id,ses);
  return proxyPublic(id);
}
async function testProxy(raw){
  const id=safeAccountId(raw?.id);if(!id)throw new Error('服务实例标识无效。');
  const existing=proxyProfiles()[id]||{},normalized=normalizeProxyInput(raw,existing),temporary={...normalized,enabled:raw?.enabled!==false};
  const view=views.get(id),ses=view?.webContents?.session||session.fromPartition(proxyPartition(id));
  const restore=proxyConfigForAccount(id);
  try{
    const auth=raw?.username?`${encodeURIComponent(raw.username)}:${encodeURIComponent(raw.password||'')}@`:'';
    const proxyString=`${temporary.protocol}://${auth}${temporary.host}:${temporary.port}`;
    const direct=await scrmProxyTest.test(proxyString,{targetHost:'web.whatsapp.com'});
    if(!direct.ok)throw new Error(`${direct.stage||'proxy'}：${direct.msg||direct.code||'代理无法连接'}`);
    await applyProxyToSession(id,ses,temporary);
    const resolved=await ses.resolveProxy('https://web.whatsapp.com');
    return{ok:true,enabled:temporary.enabled===true,localIp:localIPv4(),route:String(resolved||'').slice(0,180),exitIp:direct.ip||'',exitCountry:direct.country||'',latencyMs:direct.ms||0};
  }catch(error){throw new Error(`代理测试失败：${String(error?.message||error).replace(/\s+/g,' ').slice(0,180)}`);}
  finally{try{await applyProxyToSession(id,ses,restore);}catch{}}
}

// Production builds must not expose Chromium's debugger or convenient
// keyboard entry points. Development and Playwright fixture runs retain
// DevTools so the application remains debuggable before packaging.
function hardenWebContents(contents){
  if(!contents)return;
  contents.on('before-input-event',(event,input={})=>{
    const key=String(input.key||'').toLowerCase();
    const modifiers=new Set(Array.isArray(input.modifiers)?input.modifiers.map(value=>String(value).toLowerCase()):[]);
    const ctrlOrMeta=!!input.control||!!input.meta||modifiers.has('control')||modifiers.has('ctrl')||modifiers.has('meta');
    const shift=!!input.shift||modifiers.has('shift');
    if(input.type==='keyDown'&&ctrlOrMeta){
      const editCommand={c:'copy',x:'cut',v:'paste',a:'selectAll'}[key];
      if(editCommand&&typeof contents[editCommand]==='function'){event.preventDefault();contents[editCommand]();return;}
    }
    if(!app.isPackaged)return;
    const blocked=key==='f12'||(ctrlOrMeta&&shift&&['i','j','c'].includes(key))||(ctrlOrMeta&&key==='u');
    if(blocked)event.preventDefault();
  });
  contents.on('context-menu',(_event,params={})=>{
    const template=[];
    if(params.isEditable){template.push({role:'cut'},{role:'copy'},{role:'paste'},{type:'separator'});}
    else if(params.selectionText){template.push({role:'copy'},{type:'separator'});}
    template.push({role:'selectAll'});
    if(template.length)Menu.buildFromTemplate(template).popup({window:BrowserWindow.fromWebContents(contents)||win});
  });
  if(app.isPackaged){
    contents.on('devtools-opened',()=>{try{contents.closeDevTools();}catch{}});
    try{contents.closeDevTools();}catch{}
  }
}

// WhatsApp's current voice player creates a detached HTMLAudioElement. The
// renderer therefore cannot discover it with document.querySelector('audio').
// Install a tiny main-world bridge that reports only the source URL at the
// moment an audio element starts playing. wa-preload.js accepts the event only
// during the explicit per-message read operation and validates the URL before
// fetching it. This never starts playback and never sends a chat message.
const WHATSAPP_MEDIA_EVENT='SUPER_TRANSLATE_WHATSAPP_MEDIA_PLAY_V1';
const WHATSAPP_MEDIA_CAPTURE_EVENT='SUPER_TRANSLATE_WHATSAPP_MEDIA_CAPTURE_V1';
const WHATSAPP_MEDIA_CAPTURE_ACK_EVENT='SUPER_TRANSLATE_WHATSAPP_MEDIA_CAPTURE_ACK_V1';
function installWhatsAppMediaBridge(contents){
  if(!contents||contents.isDestroyed())return Promise.resolve(false);
  const source=`(()=>{
    if(globalThis.__superTranslateWhatsAppMediaBridgeV1)return true;
    const proto=globalThis.HTMLMediaElement?.prototype,descriptor=proto&&Object.getOwnPropertyDescriptor(proto,'play'),original=descriptor?.value;
    if(typeof original!=='function')return false;
    let captureToken='',captureUntil=0;
    window.addEventListener('message',event=>{
      if(event.source!==window||event.data?.type!==${JSON.stringify(WHATSAPP_MEDIA_CAPTURE_EVENT)})return;
      if(location.protocol!=='file:'&&event.origin!==location.origin)return;
      const token=String(event.data?.token||'');
      if(token&&!/^[A-Za-z0-9._:-]{1,120}$/.test(token))return;
      captureToken=token;captureUntil=token?Date.now()+15000:0;
      if(token)try{window.postMessage({type:${JSON.stringify(WHATSAPP_MEDIA_CAPTURE_ACK_EVENT)},token},location.origin==='null'?'*':location.origin);}catch{}
    },true);
    const notify=media=>{
      const token=Date.now()<=captureUntil?captureToken:'';
      let attempts=0;
      const sample=()=>{
        const src=String(media?.currentSrc||media?.src||'');
        if(src){try{window.postMessage({type:${JSON.stringify(WHATSAPP_MEDIA_EVENT)},src,at:Date.now(),token},location.origin==='null'?'*':location.origin);}catch{}return;}
        if(attempts++<20)setTimeout(sample,25);
      };
      sample();
    };
    const wrapped=new Proxy(original,{apply(target,thisArg,args){if(String(thisArg?.tagName||'').toUpperCase()==='AUDIO')notify(thisArg);return Reflect.apply(target,thisArg,args);}});
    Object.defineProperty(proto,'play',{...descriptor,value:wrapped});
    Object.defineProperty(globalThis,'__superTranslateWhatsAppMediaBridgeV1',{value:true,configurable:false,enumerable:false,writable:false});
    return true;
  })()`;
  return contents.executeJavaScript(source,false).catch(()=>false);
}

function resolveCloudBase(){
  if(app.isPackaged||!process.env.ST_CLOUD_BASE)return DEFAULT_CLOUD_BASE;
  try{
    const parsed=new URL(String(process.env.ST_CLOUD_BASE).trim());
    const localHttp=parsed.protocol==='http:'&&['127.0.0.1','localhost','::1'].includes(parsed.hostname);
    if(parsed.protocol!=='https:'&&!localHttp)throw new Error();
    return parsed.origin;
  }catch{return DEFAULT_CLOUD_BASE;}
}
const CLOUD_BASE=resolveCloudBase();
const cloudEndpoint=pathname=>new URL(pathname,CLOUD_BASE+'/').href;
const fixture=(()=>{
  if(app.isPackaged||!process.env.ST_TEST_FIXTURE)return'';
  const file=process.env.ST_TEST_FIXTURE==='voice'?'wa-voice-fixture.html':'wa-fixture.html';
  const target=new URL(pathToFileURL(path.join(__dirname,'..','tests',file)).href);
  if(file==='wa-voice-fixture.html'&&/^https?:\/\/127\.0\.0\.1(?::\d+)?\/voice\.wav$/.test(String(process.env.ST_TEST_VOICE_AUDIO||'')))target.searchParams.set('audio',process.env.ST_TEST_VOICE_AUDIO);
  return target.href;
})();
function updateStatus(status,extra={}){updateState={...updateState,status,...extra};if(win&&!win.isDestroyed())win.webContents.send('desktop:update-status',{...updateState,currentVersion:app.getVersion()});}
function serviceViewStatus(status,extra={}){if(win&&!win.isDestroyed())win.webContents.send('desktop:service-status',{status,...extra});}
function updateErrorMessage(error){return String(error?.message||error||'更新检查失败。').replace(/\s+/g,' ').slice(0,240);}
function setupAutoUpdater(){
  if(!autoUpdater)return;
  autoUpdater.autoDownload=false;autoUpdater.autoInstallOnAppQuit=false;
  autoUpdater.on('checking-for-update',()=>updateStatus('checking'));
  autoUpdater.on('update-available',info=>updateStatus('available',{version:String(info?.version||''),releaseDate:info?.releaseDate||'',notes:info?.releaseNotes||''}));
  autoUpdater.on('update-not-available',info=>updateStatus('not-available',{version:String(info?.version||app.getVersion())}));
  autoUpdater.on('download-progress',p=>updateStatus('downloading',{version:updateState.version,percent:Number(p?.percent||0),transferred:Number(p?.transferred||0),total:Number(p?.total||0)}));
  autoUpdater.on('update-downloaded',info=>updateStatus('downloaded',{version:String(info?.version||updateState.version||''),percent:100}));
  autoUpdater.on('error',error=>updateStatus('error',{message:updateErrorMessage(error)}));
}
async function checkForUpdates(){
  if(!autoUpdater)return{ok:false,status:'unavailable',message:'更新组件未安装。'};
  if(!app.isPackaged){updateStatus('dev',{message:'开发模式不检查线上更新。'});return{ok:true,status:'dev',version:app.getVersion()};}
  try{const result=await autoUpdater.checkForUpdates();const info=result?.updateInfo||{};return{ok:true,status:updateState.status,version:String(info.version||updateState.version||app.getVersion())};}
  catch(error){const message=updateErrorMessage(error);updateStatus('error',{message});throw new Error(message);}
}
async function downloadUpdate(){
  if(!autoUpdater)throw new Error('更新组件未安装。');
  if(!app.isPackaged)throw new Error('开发模式不能下载线上更新。');
  if(updateDownloadPromise)return updateDownloadPromise;
  updateDownloadPromise=autoUpdater.downloadUpdate().then(()=>({ok:true,status:'downloaded'})).catch(error=>{const message=updateErrorMessage(error);updateStatus('error',{message});throw new Error(message);}).finally(()=>{updateDownloadPromise=null;});
  return updateDownloadPromise;
}
function installUpdate(){
  if(!autoUpdater)throw new Error('更新组件未安装。');
  if(updateState.status!=='downloaded')throw new Error('请先下载更新。');
  setImmediate(()=>autoUpdater.quitAndInstall(false,true));return{ok:true};
}
function psQuote(value){return "'"+String(value).replace(/'/g,"''")+"'";}
function runPowerShell(command,timeout=15*60*1000){
  return new Promise((resolve,reject)=>{
    const childProcess=spawn('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-Command',command],{windowsHide:true,stdio:['ignore','ignore','pipe']});
    let errorText='';const timer=setTimeout(()=>{childProcess.kill();reject(new Error('模型解压超时，请确认压缩包完整后重试。'));},timeout);
    childProcess.stderr.on('data',chunk=>{errorText+=String(chunk).slice(0,2000);});
    childProcess.once('error',error=>{clearTimeout(timer);reject(error);});
    childProcess.once('exit',code=>{clearTimeout(timer);if(code===0)resolve();else reject(new Error(errorText.trim()||'模型压缩包解压失败。'));});
  });
}
function findGguf(root){
  const found=[];
  function visit(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const full=path.join(dir,entry.name);if(entry.isDirectory())visit(full);else if(entry.isFile()&&path.extname(entry.name).toLowerCase()==='.gguf')found.push(full);}}
  visit(root);return found;
}
async function importModel(){
  const picked=await dialog.showOpenDialog(win,{title:'选择模型压缩包或 GGUF 文件',properties:['openFile'],filters:[{name:'超级翻译模型',extensions:['zip','gguf']}]});
  if(picked.canceled||!picked.filePaths[0])return{cancelled:true};
  const source=path.resolve(picked.filePaths[0]),root=path.join(app.getPath('userData'),'models');fs.mkdirSync(root,{recursive:true});
  let modelPath;const ext=path.extname(source).toLowerCase();
  if(ext==='.gguf'){modelPath=path.join(root,path.basename(source));fs.copyFileSync(source,modelPath);}
  else if(ext==='.zip'){
    const staging=path.join(root,'.staging-'+crypto.randomUUID());fs.mkdirSync(staging,{recursive:true});
    try{await runPowerShell(`$ErrorActionPreference='Stop'; Expand-Archive -LiteralPath ${psQuote(source)} -DestinationPath ${psQuote(staging)} -Force`);const files=findGguf(staging);if(!files.length)throw new Error('压缩包内没有找到 .gguf 模型文件。');const preferred=files.find(file=>/Q4_K_M/i.test(path.basename(file)))||files[0];modelPath=path.join(root,path.basename(preferred));fs.copyFileSync(preferred,modelPath);}finally{fs.rmSync(staging,{recursive:true,force:true});}
  }else throw new Error('请选择 .zip 或 .gguf 模型文件。');
  const settings=db.get().settings;settings.model=modelPath;db.save();return{ok:true,model:modelPath,file:path.basename(modelPath)};
}
function speechExtractorRoot(){return path.join(app.isPackaged?process.resourcesPath:path.join(__dirname,'..'),'runtime','7zip');}
function fileSha256(file){return new Promise((resolve,reject)=>{const hash=crypto.createHash('sha256'),stream=fs.createReadStream(file);stream.on('error',reject);stream.on('data',chunk=>hash.update(chunk));stream.on('end',()=>resolve(hash.digest('hex').toUpperCase()));});}
function runHiddenBinary(executable,args,timeout=30*60*1000){
  return new Promise((resolve,reject)=>{const processHandle=spawn(executable,args,{windowsHide:true,stdio:['ignore','ignore','pipe'],cwd:path.dirname(executable)});let errorText='';const timer=setTimeout(()=>{try{processHandle.kill();}catch{}reject(new Error('语音模型解压超时，请确认压缩包完整并重试。'));},timeout);processHandle.stderr?.on('data',chunk=>{errorText=(errorText+String(chunk)).slice(-5000);});processHandle.once('error',error=>{clearTimeout(timer);reject(error);});processHandle.once('exit',code=>{clearTimeout(timer);code===0?resolve():reject(new Error(errorText.replace(/\s+/g,' ').trim().slice(-600)||`语音模型解压失败（退出码 ${code}）。`));});});
}
function speechInstallProgress(stage,message){if(win&&!win.isDestroyed())win.webContents.send('desktop:speech-install-status',{stage,message:String(message||'').slice(0,160)});}
function safeSpeechRemove(value,parent){const target=path.resolve(value),root=path.resolve(parent);if(path.dirname(target)!==root||target===root)throw new Error('语音模型临时目录无效。');fs.rmSync(target,{recursive:true,force:true});}
function ensureSpeechFreeSpace(parent,gigabytes){const free=fs.statfsSync(parent);if(BigInt(free.bavail)*BigInt(free.bsize)<BigInt(gigabytes)*1024n*1024n*1024n)throw new Error(`D 盘可用空间不足 ${gigabytes} GB，请清理空间后重试。`);}
async function verifySpeechExtractor(){const extractorRoot=speechExtractorRoot(),extractor=path.join(extractorRoot,'7z.exe');for(const[name,expected]of Object.entries(SPEECH_EXTRACTOR_HASHES)){const file=path.join(extractorRoot,name);if(!fs.existsSync(file)||await fileSha256(file)!==expected)throw new Error('内置模型解压组件完整性校验失败，请重新安装最新版超级翻译。');}return extractor;}
async function verifySpeechPackage(directory){
  const files=[];for(const expected of SPEECH_MODEL_PACKAGE.volumes){const file=expected.names.map(name=>path.join(directory,name)).find(candidate=>fs.existsSync(candidate)&&fs.statSync(candidate).isFile());if(!file)throw new Error(`模型包缺少 ${expected.names[0]}，请重新下载完整模型包。`);const actualSize=fs.statSync(file).size;if(actualSize!==expected.size)throw new Error(`${path.basename(file)} 大小不正确，请重新下载。`);files.push(file);}
  speechInstallProgress('verifying','正在校验语音模型分卷 1 / 2…');if(await fileSha256(files[0])!==SPEECH_MODEL_PACKAGE.volumes[0].sha256)throw new Error('语音模型分卷 1 校验失败，请重新下载。');
  speechInstallProgress('verifying','正在校验语音模型分卷 2 / 2…');if(await fileSha256(files[1])!==SPEECH_MODEL_PACKAGE.volumes[1].sha256)throw new Error('语音模型分卷 2 校验失败，请重新下载。');return files;
}
async function installBasicSpeechModel(){
  if(process.platform!=='win32')throw new Error('语音模型一键安装目前仅支持 Windows。');
  const testTarget=!app.isPackaged?String(process.env.ST_TEST_SPEECH_INSTALL_TARGET||'').trim():'';
  const target=path.resolve(testTarget||SPEECH_MODEL_PACKAGE.target),parent=path.dirname(target),already=speechRuntime.inspectRoot(target);
  if(already.installed&&path.resolve(already.root)===target){const settings=db.get().settings;settings.asrModel=target;db.save();speechInstallProgress('ready','语音模型已安装并启用。');return{ok:true,alreadyInstalled:true,model:target};}
  const testPackage=!app.isPackaged?String(process.env.ST_TEST_SPEECH_PACKAGE||'').trim():'';
  const selected=testPackage?{canceled:false,filePaths:[testPackage]}:await dialog.showOpenDialog(win,{title:'选择下载好的超级翻译语音 AI 大模型',properties:['openFile'],filters:[{name:'超级翻译语音 AI 大模型',extensions:['zip','rar','json']} ]});if(selected.canceled||!selected.filePaths[0])return{cancelled:true};
  const picked=path.resolve(selected.filePaths[0]),base=path.basename(picked).toLowerCase();if(base.endsWith('.part2.rar'))throw new Error('请选择模型 ZIP 或 part1.rar；软件会自动完成后续安装。');fs.mkdirSync(parent,{recursive:true});
  const staging=path.join(parent,'.speech-staging-'+crypto.randomUUID()),backup=path.join(parent,'.speech-backup-'+crypto.randomUUID()),packageStaging=path.join(parent,'.speech-package-'+crypto.randomUUID());let movedOld=false,movedNew=false,packageExtracted=false;
  try{
    const extractor=await verifySpeechExtractor();let packageDirectory=path.dirname(picked);
    if(path.extname(base)==='.zip'){
      ensureSpeechFreeSpace(parent,26);const archive=SPEECH_MODEL_PACKAGE.archive,stat=fs.statSync(picked);if(!stat.isFile()||stat.size!==archive.size)throw new Error('语音模型 ZIP 大小不正确，请重新下载。');speechInstallProgress('verifying','正在校验下载的语音模型…');if(await fileSha256(picked)!==archive.sha256)throw new Error('语音模型 ZIP 校验失败，请重新下载。');fs.mkdirSync(packageStaging,{recursive:true});packageExtracted=true;speechInstallProgress('extracting-package','正在准备语音模型安装包…');await runHiddenBinary(extractor,['x','-y','-aoa','-bso0','-bsp0',picked,`-o${packageStaging}`]);packageDirectory=packageStaging;
    }else ensureSpeechFreeSpace(parent,18);
    const archives=await verifySpeechPackage(packageDirectory);fs.mkdirSync(staging,{recursive:true});
    speechInstallProgress('extracting','正在自动解压语音模型，请勿关闭软件…');await runHiddenBinary(extractor,['x','-y','-aoa','-bso0','-bsp0',archives[0],`-o${staging}`]);
    const configFile=path.join(staging,'funasr','.venv','pyvenv.cfg'),vendorBackup=configFile+'.vendor-original';if(!fs.existsSync(configFile))throw new Error('语音模型包结构不完整，缺少 Python 环境配置。');if(!fs.existsSync(vendorBackup))fs.copyFileSync(configFile,vendorBackup);const portableHome=path.join(target,'python','cpython-3.12.3-windows-x86_64-none');let configText=fs.readFileSync(configFile,'utf8');configText=/^home\s*=.*$/mi.test(configText)?configText.replace(/^home\s*=.*$/mi,'home = '+portableHome):'home = '+portableHome+'\r\n'+configText;fs.writeFileSync(configFile,configText,'utf8');
    const staged=speechRuntime.inspectRoot(staging);if(!staged.installed)throw new Error(`语音模型解压不完整：${staged.missing.join('、')}`);speechRuntime.stop();
    if(fs.existsSync(target)){fs.renameSync(target,backup);movedOld=true;}fs.renameSync(staging,target);movedNew=true;const installed=speechRuntime.inspectRoot(target);if(!installed.installed)throw new Error('语音模型安装后校验失败。');const settings=db.get().settings;settings.asrModel=target;db.save();if(movedOld&&fs.existsSync(backup))safeSpeechRemove(backup,parent);speechInstallProgress('ready','语音模型已安装到 D 盘并完成启用。');return{ok:true,model:target,version:SPEECH_MODEL_PACKAGE.version};
  }catch(error){
    if(movedNew&&fs.existsSync(target))safeSpeechRemove(target,parent);if(movedOld&&fs.existsSync(backup)&&!fs.existsSync(target))fs.renameSync(backup,target);if(fs.existsSync(staging))safeSpeechRemove(staging,parent);speechInstallProgress('error',error.message||'语音模型安装失败。');throw error;
  }finally{if(packageExtracted&&fs.existsSync(packageStaging))safeSpeechRemove(packageStaging,parent);}
}
async function installWhisperSpeechModel(tier){
  const spec=WHISPER_MODEL_PACKAGES[tier];if(!spec)throw new Error('当前账号的语音版本无效。');
  if(process.platform!=='win32')throw new Error('语音模型一键安装目前仅支持 Windows。');
  const testTarget=!app.isPackaged?String(process.env.ST_TEST_SPEECH_INSTALL_TARGET||'').trim():'';
  const target=path.resolve(testTarget||spec.target),parent=path.dirname(target),settings=db.get().settings,already=speechRuntime.inspectWhisperRoot(target,settings.asrModel,tier);
  if(already.installed&&path.resolve(already.root)===target){speechInstallProgress('ready',`${spec.label}模型已安装并启用。`);return{ok:true,alreadyInstalled:true,model:target,tier,version:spec.version};}
  const testPackage=!app.isPackaged?String(process.env.ST_TEST_SPEECH_PACKAGE||'').trim():'';
  const selected=testPackage?{canceled:false,filePaths:[testPackage]}:await dialog.showOpenDialog(win,{title:`选择下载好的${spec.label}模型包`,properties:['openFile'],filters:[{name:`超级翻译${spec.label}模型包`,extensions:['zip']}]});
  if(selected.canceled||!selected.filePaths[0])return{cancelled:true};
  const picked=path.resolve(selected.filePaths[0]),archive=spec.archive,stat=fs.statSync(picked);if(path.extname(picked).toLowerCase()!=='.zip'||!stat.isFile())throw new Error(`请选择 ${archive.name}。`);if(stat.size!==archive.size)throw new Error(`${spec.label}模型包大小不正确，请重新下载。`);
  fs.mkdirSync(parent,{recursive:true});ensureSpeechFreeSpace(parent,tier==='flagship'?6:3);speechInstallProgress('verifying',`正在校验${spec.label}模型包…`);if(await fileSha256(picked)!==archive.sha256)throw new Error(`${spec.label}模型包校验失败，请重新下载。`);
  const extractor=await verifySpeechExtractor(),staging=path.join(parent,'.speech-staging-'+crypto.randomUUID()),backup=path.join(parent,'.speech-backup-'+crypto.randomUUID());let movedOld=false,movedNew=false;
  try{
    fs.mkdirSync(staging,{recursive:true});speechInstallProgress('extracting',`正在安装${spec.label}模型，请勿关闭软件…`);await runHiddenBinary(extractor,['x','-y','-aoa','-bso0','-bsp0',picked,`-o${staging}`]);
    const manifestFile=path.join(staging,'manifest.json');if(!fs.existsSync(manifestFile))throw new Error('语音模型包结构不完整，缺少版本清单。');let manifest;try{manifest=JSON.parse(fs.readFileSync(manifestFile,'utf8'));}catch{throw new Error('语音模型包版本清单无效。');}
    if(manifest?.speechTier!==tier||manifest?.model!==spec.model||manifest?.packageVersion!==spec.version)throw new Error('语音模型包与当前账号版本不匹配。');
    const staged=speechRuntime.inspectWhisperRoot(staging,settings.asrModel,tier);if(!staged.installed||staged.model!==spec.model)throw new Error(`语音模型解压不完整：${staged.missing.join('、')}`);
    speechRuntime.stop();if(fs.existsSync(target)){fs.renameSync(target,backup);movedOld=true;}fs.renameSync(staging,target);movedNew=true;
    const installed=speechRuntime.inspectWhisperRoot(target,settings.asrModel,tier);if(!installed.installed||installed.model!==spec.model)throw new Error('语音模型安装后校验失败。');
    if(movedOld){
      const models=path.join(target,'models');fs.mkdirSync(models,{recursive:true});
      for(const name of ['faster-whisper-small','faster-whisper-large-v3-turbo','faster-whisper-large-v3']){const previous=path.join(backup,'models',name),destination=path.join(models,name);if(fs.existsSync(previous)&&!fs.existsSync(destination))fs.renameSync(previous,destination);}
      safeSpeechRemove(backup,parent);movedOld=false;
    }
    speechInstallProgress('ready',`${spec.label}模型已安装到 D 盘并完成启用。`);return{ok:true,model:target,tier,version:spec.version};
  }catch(error){
    if(movedNew&&fs.existsSync(target))safeSpeechRemove(target,parent);if(movedOld&&fs.existsSync(backup)&&!fs.existsSync(target))fs.renameSync(backup,target);if(fs.existsSync(staging))safeSpeechRemove(staging,parent);speechInstallProgress('error',error.message||'语音模型安装失败。');throw error;
  }
}
async function installSpeechModel(){
  const testTier=!app.isPackaged?normalizeSpeechTier(process.env.ST_TEST_SPEECH_TIER):'',entitlement=testTier?{speechTier:testTier}:await authorizeSpeech(),tier=normalizeSpeechTier(entitlement.speechTier);
  if(!tier)throw new Error('无法确认当前账号的语音版本。');
  return tier==='basic'?installBasicSpeechModel():installWhisperSpeechModel(tier);
}
function trusted(event){
  try{
    const sender=event?.sender,frame=event?.senderFrame;
    return !!win&&!win.isDestroyed()&&!!sender&&!sender.isDestroyed()&&sender===win.webContents&&frame===sender.mainFrame&&internalURL(frame.url)&&sender.getURL()===frame.url;
  }catch{return false;}
}
function cloudSessionActive(){
  if(!cloudSession||(cloudSession.accountType!=='customer'&&cloudSession.accountType!=='admin'))return false;
  if(cloudSession.status&&cloudSession.status!=='active')return false;
  if(cloudSession.expires&&String(cloudSession.expires)<new Date().toISOString().slice(0,10))return false;
  return true;
}
function deviceFingerprint(){return crypto.createHash('sha256').update([os.hostname(),os.platform(),os.arch(),os.cpus()?.[0]?.model||'',app.getPath('userData')].join('\0')).digest('hex')}
function customerSessionPayload(extra={}){return{sessionVersion:1,deviceId:deviceFingerprint(),...extra}}
function applyCustomerSessionGrant(data){
  if(!cloudSession||cloudSession.accountType!=='customer')return false;
  const token=typeof data?.accessToken==='string'?data.accessToken:(typeof data?.token==='string'?data.token:'');
  if(!token)return false;
  cloudSession.token=token;
  if(typeof data?.refreshToken==='string'&&data.refreshToken)cloudSession.refreshToken=data.refreshToken;
  cloudSession.accessExpiresAt=Number.isSafeInteger(data?.accessExpiresAt)?data.accessExpiresAt:0;
  cloudSession.refreshIdleExpiresAt=Number.isSafeInteger(data?.refreshIdleExpiresAt)?data.refreshIdleExpiresAt:0;
  cloudSession.refreshAbsoluteExpiresAt=Number.isSafeInteger(data?.sessionAbsoluteExpiresAt)?data.sessionAbsoluteExpiresAt:(Number.isSafeInteger(data?.refreshExpiresAt)?data.refreshExpiresAt:0);
  return true;
}
async function refreshCustomerSession(){
  if(!cloudSession||cloudSession.accountType!=='customer'||!cloudSession.refreshToken)return false;
  if(customerRefreshPromise)return customerRefreshPromise;
  const session=cloudSession;
  customerRefreshPromise=(async()=>{
    try{
      const response=await fetch(cloudEndpoint('/api/customer-session/refresh'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(customerSessionPayload({refreshToken:session.refreshToken,rotationRequestId:crypto.randomUUID()})),signal:AbortSignal.timeout(10000)});
      const data=await response.json().catch(()=>({}));
      if(!response.ok||!data?.ok){if(response.status===401||response.status===403)invalidateCloudSession();return false;}
      if(cloudSession!==session)return false;
      if(!applyCustomerSessionGrant(data))return false;
      saveCloudCache();
      return true;
    }catch{return false;}
    finally{customerRefreshPromise=null;}
  })();
  return customerRefreshPromise;
}
async function ensureCustomerAccess(){
  if(!cloudSession||cloudSession.accountType!=='customer')return true;
  if(!cloudSession.token)return false;
  if(cloudSession.accessExpiresAt&&Date.now()<cloudSession.accessExpiresAt-60000)return true;
  if(cloudSession.refreshToken)return refreshCustomerSession();
  return true;
}
function cleanHardwareValue(value,max=120){return String(value??'').replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim().slice(0,max)}
function detectGpuModel(){
  if(gpuModelCache!==null)return Promise.resolve(gpuModelCache);
  if(gpuProbePromise)return gpuProbePromise;
  // The CPU model is already reported separately.  Do not invent a GPU name
  // when the platform probe is unavailable or returns no reliable result.
  if(process.platform!=='win32'){gpuModelCache='';return Promise.resolve(gpuModelCache);}
  gpuProbePromise=new Promise(resolve=>{
    let settled=false,output='',timer=null,probe=null;
    const finish=value=>{if(settled)return;settled=true;if(timer)clearTimeout(timer);const names=String(value||'').split(/\r?\n/).map(item=>cleanHardwareValue(item)).filter(Boolean).slice(0,3);gpuModelCache=names.join(' / ');gpuProbePromise=null;resolve(gpuModelCache)};
    try{
      const executable=process.env.SystemRoot?path.join(process.env.SystemRoot,'System32','WindowsPowerShell','v1.0','powershell.exe'):'powershell.exe';
      const command="$ErrorActionPreference='SilentlyContinue'; $items=Get-CimInstance -ClassName Win32_VideoController; if(-not $items){$items=Get-WmiObject -Class Win32_VideoController}; $items | Select-Object -ExpandProperty Name";
      probe=spawn(executable,['-NoLogo','-NoProfile','-NonInteractive','-Command',command],{windowsHide:true,stdio:['ignore','pipe','ignore']});
      probe.stdout?.on('data',chunk=>{output=(output+String(chunk)).slice(0,2048)});
      probe.once('error',()=>finish(''));probe.once('close',()=>finish(output));timer=setTimeout(()=>{try{probe.kill()}catch{}finish('')},2500);
    }catch{finish('')}
  });
  return gpuProbePromise;
}
async function reportCustomerHeartbeat(requestedStatus=null,expectedGeneration=heartbeatGeneration){
  const session=cloudSession,generation=expectedGeneration;
  if(session?.accountType!=='customer'||!cloudSessionActive()||!session.token)return;
  if(!(await ensureCustomerAccess())||cloudSession!==session)return;
  const controller=new AbortController();heartbeatAbortController=controller;
  const abortTimer=setTimeout(()=>controller.abort(),8000);
  try{
    const started=Date.now();let modelStatus='offline',modelRuntime='',modelLatencyMs=null;
    const explicitStatus=['ready','offline','starting','error','stopped','unavailable'].includes(String(requestedStatus||''));
    if(!explicitStatus)try{const result=await health();if(generation!==heartbeatGeneration||cloudSession!==session||controller.signal.aborted)return;modelStatus='ready';modelRuntime=cleanHardwareValue(result.runtime||childKind,40);modelLatencyMs=Date.now()-started;}catch{}
    else {modelStatus=String(requestedStatus);if(modelStatus==='ready'){modelRuntime=cleanHardwareValue(childKind,40);modelLatencyMs=null;}}
    if(generation!==heartbeatGeneration||cloudSession!==session||controller.signal.aborted)return;
    const cpus=os.cpus()||[],cpu=cleanHardwareValue(cpus[0]?.model),gpu=await detectGpuModel();
    if(generation!==heartbeatGeneration||cloudSession!==session||controller.signal.aborted)return;
    const body={deviceId:deviceFingerprint(),hostname:cleanHardwareValue(os.hostname(),80),platform:cleanHardwareValue(`${os.platform()} ${os.release()}`,40),arch:cleanHardwareValue(os.arch(),20),cpu,gpu:cleanHardwareValue(gpu),appVersion:cleanHardwareValue(app.getVersion(),30),modelStatus,modelRuntime,modelLatencyMs};
    const response=await fetch(cloudEndpoint('/api/customer-heartbeat'),{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${session.token}`},body:JSON.stringify(body),signal:controller.signal});
    if(generation!==heartbeatGeneration||cloudSession!==session)return;
    if(response.status===401||response.status===403){
      if(await refreshCustomerSession())return;
      invalidateCloudSession();return;
    }
    // A heartbeat is telemetry, not a reason to start a reconnect loop.  Any
    // other non-2xx response is left for the next bounded interval attempt.
    if(!response.ok)return;
  }catch{}finally{
    clearTimeout(abortTimer);
    if(heartbeatAbortController===controller)heartbeatAbortController=null;
  }
}
function requestCustomerHeartbeat(status=null){
  if(cloudSession?.accountType!=='customer'||!cloudSessionActive()||!cloudSession.token)return;
  // Explicit lifecycle states are latest-wins.  This prevents a stop() event
  // queued just before a successful model start from masking the ready state.
  if(status!==null&&status!==undefined)heartbeatRequestedStatus=String(status);
  const generation=heartbeatGeneration;
  if(heartbeatDrainPromise&&heartbeatDrainGeneration===generation)return;
  heartbeatDrainGeneration=generation;
  const drain=(async()=>{
    while(generation===heartbeatGeneration&&cloudSession?.accountType==='customer'&&cloudSessionActive()&&cloudSession.token){
      const requested=heartbeatRequestedStatus;heartbeatRequestedStatus=null;
      await reportCustomerHeartbeat(requested,generation);
      if(heartbeatRequestedStatus===null)break;
    }
  })();
  heartbeatDrainPromise=drain;
  drain.finally(()=>{
    if(heartbeatDrainPromise===drain)heartbeatDrainPromise=null;
    if(generation===heartbeatGeneration&&heartbeatRequestedStatus!==null&&cloudSession?.accountType==='customer')requestCustomerHeartbeat();
  }).catch(()=>{});
}
function startCustomerHeartbeat(){
  stopCustomerHeartbeat();if(cloudSession?.accountType!=='customer')return;
  const generation=heartbeatGeneration;heartbeatInitialTimer=setTimeout(()=>{heartbeatInitialTimer=null;if(generation===heartbeatGeneration)requestCustomerHeartbeat()},500);
  heartbeatTimer=setInterval(()=>{if(generation===heartbeatGeneration)requestCustomerHeartbeat()},60000);heartbeatTimer.unref?.();
}
function stopCustomerHeartbeat(){
  heartbeatGeneration++;if(heartbeatInitialTimer){clearTimeout(heartbeatInitialTimer);heartbeatInitialTimer=null;}if(heartbeatTimer){clearInterval(heartbeatTimer);heartbeatTimer=null;}heartbeatRequestedStatus=null;if(heartbeatAbortController){try{heartbeatAbortController.abort();}catch{}heartbeatAbortController=null;}
}
function access(){return !!authSession||cloudSessionActive();}
function handler(name,fn,publicEndpoint=false){ipcMain.handle(name,async(e,...args)=>{if(!trusted(e))throw new Error('来源不允许。');if(!publicEndpoint&&!access())throw new Error('请先登录超级翻译账号。');return fn(...args);});}
function bridgeHandler(name,fn){ipcMain.handle(name,async(e,...args)=>{const sender=e.sender;const known=[...views.values()].some(view=>view?.webContents===sender)||activeView?.webContents===sender;if(!known)throw new Error('来源不允许。');return fn(...args);});}
// Login preferences contain a decrypted password only in the login renderer
// while it is being filled.  Keep all preference operations restricted to the
// login document; the workbench has no reason to read them.
function loginHandler(name,fn){ipcMain.handle(name,async(e,...args)=>{if(!trusted(e)||e.senderFrame.url!==urls.login)throw new Error('来源不允许。');return fn(...args);});}
function isWA(wc){
  try{return !!wc&&[...views.values()].some(v=>v.webContents===wc)&&!wc.isDestroyed()&&whatsappURL(wc.getURL());}
  catch{return false;}
}
function isPlatformView(wc,platform=currentPlatform){
  try{const view=[...views.values()].find(v=>v.webContents===wc);return !!view&&!wc.isDestroyed()&&view.stPlatform===platform&&platformURL(platform,wc.getURL());}
  catch{return false;}
}
function trustedWA(event){
  try{
    const sender=event?.sender,frame=event?.senderFrame;
    return !!sender&&!sender.isDestroyed()&&frame===sender.mainFrame&&isWA(sender)&&whatsappURL(frame.url)&&sender.getURL()===frame.url;
  }catch{return false;}
}
function trustedPlatform(event){
  try{const sender=event?.sender,frame=event?.senderFrame,view=[...views.values()].find(v=>v.webContents===sender);return !!sender&&!sender.isDestroyed()&&frame===sender.mainFrame&&view&&isPlatformView(sender,view.stPlatform)&&platformURL(view.stPlatform,frame.url)&&sender.getURL()===frame.url;}
  catch{return false;}
}
function requireString(text,max=3500){if(typeof text!=='string'||!text.trim()||text.length>max)throw new Error(`请输入 1–${max} 个字符。`);return text;}
function localPort(){const value=Number(db?.get?.().settings?.localPort||31948);return Number.isInteger(value)&&value>=1024&&value<=65535?value:31948;}
function localBase(){return `http://127.0.0.1:${localPort()}`;}
function runtimeRoot(){return path.join(app.isPackaged?process.resourcesPath:path.join(__dirname,'..'),'runtime');}
function nativeServerPath(){return path.join(runtimeRoot(),'llama-cpp','llama-server.exe');}
function nativeRuntimeAvailable(){return process.platform==='win32'&&process.arch==='x64'&&fs.existsSync(nativeServerPath());}
function verifyNativeRuntime(){
  try{return verifyRuntimeDirectory(path.join(runtimeRoot(),'llama-cpp'));}
  catch{throw new Error('本地 AI 运行时完整性校验失败，请重新安装最新版超级翻译。');}
}
function normalizeHealth(data){
  if(data?.status==='ok')return{...data,ok:true,offline:true,runtime:'llama.cpp'};
  if(data?.ok===true&&data?.offline===true)return{...data,runtime:'python'};
  return null;
}
const health=async()=>{try{const r=await fetch(`${localBase()}/health`,{signal:AbortSignal.timeout(3500)});const data=normalizeHealth(await r.json().catch(()=>({})));if(!r.ok||!data)throw new Error();if(data.runtime)childKind=childKind||data.runtime;return data;}catch{throw new Error('本地模型未就绪，请在连接设置中启动本地服务。');}};
let cloudCacheFile='',voiceCacheFile='',loginPreferences=null;
const incomingVoiceCache=new Map(),incomingVoiceJobs=new Map();
// The cloud cache is deliberately *not* an authentication/session store.  A
// file under the user's profile can be edited by that user, so plaintext
// role/quota/status fields must never be used to grant access.  The only
// value we retain is an encrypted, bounded offline-usage queue which can be
// reconciled after a fresh server login.
const CLOUD_CACHE_VERSION=3;
const MAX_OFFLINE_PENDING=50000;
const OFFLINE_GRACE_MS=30*60*1000;
function secureStorageAvailable(){try{return safeStorage.isEncryptionAvailable()===true;}catch{return false;}}
function loadIncomingVoiceCache(){
  incomingVoiceCache.clear();
  if(!voiceCacheFile||!secureStorageAvailable()||!fs.existsSync(voiceCacheFile))return;
  try{
    const encrypted=Buffer.from(fs.readFileSync(voiceCacheFile,'utf8').trim(),'base64');
    const parsed=JSON.parse(safeStorage.decryptString(encrypted));
    if(parsed?.version!==1||!Array.isArray(parsed.entries))throw new Error('invalid voice cache');
    for(const item of parsed.entries.slice(-500)){
      if(!item||typeof item.key!=='string'||!/^[a-f0-9]{64}$/.test(item.key))continue;
      const transcript=String(item.transcript||'').slice(0,6000),translation=String(item.translation||'').slice(0,6000);
      if(!transcript)continue;
      incomingVoiceCache.set(item.key,{transcript,translation,language:String(item.language||'auto').slice(0,20),engine:String(item.engine||'').slice(0,30),tier:normalizeSpeechTier(item.tier),model:String(item.model||'').slice(0,100),updatedAt:Number(item.updatedAt)||Date.now()});
    }
  }catch{try{fs.rmSync(voiceCacheFile,{force:true});}catch{}}
}
function saveIncomingVoiceCache(){
  if(!voiceCacheFile||!secureStorageAvailable())return;
  const entries=[...incomingVoiceCache.entries()].map(([key,value])=>({key,...value})).sort((a,b)=>a.updatedAt-b.updatedAt).slice(-500);
  incomingVoiceCache.clear();for(const item of entries){const{key,...value}=item;incomingVoiceCache.set(key,value);}
  const encrypted=safeStorage.encryptString(JSON.stringify({version:1,entries})).toString('base64'),temporary=voiceCacheFile+'.tmp';
  fs.writeFileSync(temporary,encrypted,{encoding:'utf8',mode:0o600});fs.renameSync(temporary,voiceCacheFile);
}
function normalizedWhatsAppChat(value){
  const raw=String(value||'').replace(/[\u200b\u200c\u200d\ufeff]/g,'').trim();
  const match=raw.match(/^(?:(?:true|false)_)?([^_]+@(?:c\.us|s\.whatsapp\.net|g\.us|lid))(?:_|$)/);
  return match?match[1].slice(0,240):'';
}
function sameWhatsAppChat(left,right){
  const a=String(left||'').trim(),b=String(right||'').trim();if(!a||!b)return false;if(a===b)return true;
  const na=normalizedWhatsAppChat(a),nb=normalizedWhatsAppChat(b);return !!na&&!!nb&&na===nb;
}
function voiceCacheHash(account,chat,message){return crypto.createHash('sha256').update(String(account)+'\0'+String(chat)+'\0'+String(message)).digest('hex');}
function voiceCacheLookup(location){
  if(!location)return null;
  const keys=[location.key,...(Array.isArray(location.legacyKeys)?location.legacyKeys:[])];
  for(const key of keys){const value=incomingVoiceCache.get(key);if(value)return value;}
  return null;
}
function incomingVoiceLocation(input={}){
  if(!activeView||!activeView.stAccountId||!activeView.stKey?.raw)throw new Error('请先打开一个 WhatsApp 联系人会话。');
  const chat=String(input.chat||''),message=String(input.message||''),activeRaw=String(activeView.stKey.raw||'');
  // The preload sends the stable/bare JID for voice work while the snapshot
  // still retains WhatsApp's historical raw serialized id. Treat those forms
  // as the same conversation, but keep exact matching for title fallbacks.
  if(!chat||!sameWhatsAppChat(chat,activeRaw))throw new Error('聊天已变化，已停止识别。');
  if(!message||message.length>300||!/[A-Za-z0-9]/.test(message))throw new Error('语音消息标识无效。');
  const stableChat=normalizedWhatsAppChat(chat)||chat;
  const key=voiceCacheHash(activeView.stAccountId,stableChat,message);
  const legacyKeys=[voiceCacheHash(activeView.stAccountId,chat,message),voiceCacheHash(activeView.stAccountId,activeRaw,message)].filter(value=>value!==key);
  return{chat,message,key,legacyKeys};
}
function clearCloudCache(){
  if(!cloudCacheFile)return;
  try{fs.rmSync(cloudCacheFile,{force:true});}catch{}
}
function boundedQuota(value){
  if(value===null)return null;
  return Number.isSafeInteger(value)&&value>=0?value:null;
}
function boundedUsed(value){
  return Number.isSafeInteger(value)&&value>=0?value:0;
}
function publicCloudSession(value=cloudSession){
  if(!value)return null;
  const accountType=value.accountType==='admin'?'admin':'customer';
  const quota=boundedQuota(value.quota);
  return{username:String(value.username||''),role:String(value.role||''),plan:value.plan==null?null:String(value.plan),speechTier:normalizeSpeechTier(value.speechTier,accountType==='admin'?'flagship':'advanced'),quota,used:boundedUsed(value.used),expires:value.expires||null,status:value.status||'active',accountType,unlimited:value.unlimited===true||quota===null,parentId:value.parentId||null,allocatedQuota:boundedUsed(value.allocatedQuota),canManageSubaccounts:value.canManageSubaccounts===true,deviceLimit:value.accountType==='admin'&&value.unlimitedDevices===true?null:(Number.isSafeInteger(value.deviceLimit)&&value.deviceLimit>0?value.deviceLimit:null),unlimitedDevices:value.accountType==='admin'&&value.unlimitedDevices===true,subaccountLimit:3,subaccountCount:Math.max(0,Number(value.subaccountCount)||0)};
}
function readCloudPending(username){
  if(!cloudCacheFile||!secureStorageAvailable())return{pending:0,offlineSince:0};
  try{
    const record=JSON.parse(fs.readFileSync(cloudCacheFile,'utf8'));
    if(!record||record.version!==CLOUD_CACHE_VERSION||typeof record.encryptedSession!=='string'||record.encryptedSession.length>8192)throw new Error('invalid cache');
    const payload=JSON.parse(safeStorage.decryptString(Buffer.from(record.encryptedSession,'base64')));
    const cachedUser=String(payload?.username||'').trim();
    const requested=String(username||'').trim();
    const pending=Number(payload?.pending||0),offlineSince=Number(payload?.offlineSince||0);
    if(!cachedUser||!requested||cachedUser.toLowerCase()!==requested.toLowerCase()||typeof payload.token!=='string'||!payload.token||!Number.isSafeInteger(pending)||pending<0||pending>MAX_OFFLINE_PENDING)throw new Error('invalid cache');
    if(pending>0&&(!Number.isSafeInteger(offlineSince)||offlineSince<=0||Date.now()-offlineSince>OFFLINE_GRACE_MS))throw new Error('expired cache');
    return{pending,offlineSince};
  }catch{clearCloudCache();return{pending:0,offlineSince:0};}
}
function saveCloudCache(){
  if(!cloudCacheFile||!cloudSession?.token||!secureStorageAvailable()){if(cloudCacheFile)clearCloudCache();return;}
  const pending=Number(cloudSession.pending||0),offlineSince=Number(cloudSession.offlineSince||0);
  if(!Number.isSafeInteger(pending)||pending<0||pending>MAX_OFFLINE_PENDING){clearCloudCache();return;}
  let encryptedSession;
  try{
    encryptedSession=safeStorage.encryptString(JSON.stringify({token:String(cloudSession.token),username:String(cloudSession.username||''),pending,offlineSince})).toString('base64');
  }catch{clearCloudCache();return;}
  const record={version:CLOUD_CACHE_VERSION,username:String(cloudSession.username||''),encryptedSession,cachedAt:Date.now()};
  fs.mkdirSync(path.dirname(cloudCacheFile),{recursive:true});const temporary=cloudCacheFile+'.'+crypto.randomUUID()+'.tmp';
  try{fs.writeFileSync(temporary,JSON.stringify(record,null,2),{encoding:'utf8',mode:0o600});fs.renameSync(temporary,cloudCacheFile);}catch{try{fs.rmSync(temporary,{force:true});}catch{} }
}
function loginCredentials(input){
  const username=String(input?.username||'').trim(),password=input?.password;
  if(!username||username.length>80||typeof password!=='string'||!password||password.length>128)throw new Error('请输入正确的账号和密码。');
  return{username,password};
}
async function cloudLoginRequest(pathname,credentials){
  try{
    const response=await fetch(cloudEndpoint(pathname),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(credentials),signal:AbortSignal.timeout(10000)});
    const data=await response.json().catch(()=>({}));return{response,data};
  }catch(error){return{networkError:error};}
}
function acceptCloudAdmin(data,username){
  const serverUsername=String(data?.admin?.username||'').trim(),token=data?.token;
  if(typeof token!=='string'||!token||token.length>4096||!data?.admin||!serverUsername||serverUsername.toLowerCase()!==String(username).toLowerCase())throw new Error('云端管理员登录响应无效，请稍后重试。');
  const status=String(data.admin.status||'active').toLowerCase();
  if(status==='disabled')throw new Error('管理员账号已停用。');
  if(status!=='active')throw new Error('管理员账号当前不可用。');
  if(data.admin.used!=null&&(!Number.isSafeInteger(data.admin.used)||data.admin.used<0))throw new Error('云端管理员登录响应无效，请稍后重试。');
  const quota=boundedQuota(data.admin.quota),unlimited=data.admin.id==='root'||data.admin.unlimited===true||(data.admin.unlimited!==false&&data.admin.quota==null);
  if(!unlimited&&data.admin.quota!==null&&quota===null)throw new Error('云端管理员登录响应无效，请稍后重试。');
  stopCustomerHeartbeat();authSession=null;cloudSession={token,username:serverUsername,role:String(data.admin.role||'管理员'),accountType:'admin',plan:String(data.admin.plan||'子账号'),speechTier:normalizeSpeechTier(data.admin.speechTier,'flagship'),quota:unlimited?null:quota,used:boundedUsed(data.admin.used),deviceLimit:unlimited?null:(Number.isSafeInteger(data.admin.deviceLimit)&&data.admin.deviceLimit>0?data.admin.deviceLimit:1),unlimitedDevices:unlimited||data.admin.unlimitedDevices===true,pending:0,offlineSince:0,expires:null,status:'active',unlimited,cachedAt:Date.now()};loginTransition=true;saveCloudCache();
  return{ok:true,accountType:'admin',user:publicCloudSession()};
}
function acceptCloudCustomer(data,username,previous=null){
  const serverUsername=String(data?.customer?.username||'').trim(),token=String(data?.accessToken||data?.token||'');
  if(typeof token!=='string'||!token||token.length>4096||!data?.customer||!serverUsername||serverUsername.toLowerCase()!==String(username).toLowerCase())throw new Error('云端客户登录响应无效，请稍后重试。');
  const status=String(data.customer.status||'active').toLowerCase();
  if(status==='pending')throw new Error('账号已注册，正在等待管理员分配套餐。');
  if(status==='disabled')throw new Error('账号已停用，请联系管理员。');
  if(status==='expired')throw new Error('账号授权已过期，请联系管理员续费。');
  if(status!=='active')throw new Error('账号当前不可用，请联系管理员。');
  const expires=data.customer.expires==null?null:String(data.customer.expires);
  if(expires&&!/^\d{4}-\d{2}-\d{2}$/.test(expires))throw new Error('云端客户登录响应无效，请稍后重试。');
  if(expires&&expires<new Date().toISOString().slice(0,10))throw new Error('账号授权已过期，请联系管理员续费。');
  if(!Number.isSafeInteger(data.customer.used)||data.customer.used<0)throw new Error('云端客户登录响应无效，请稍后重试。');
  const quota=boundedQuota(data.customer.quota),used=boundedUsed(data.customer.used);
  if(data.customer.quota!==null&&quota===null)throw new Error('云端客户登录响应无效，请稍后重试。');
  const cachedPending=readCloudPending(serverUsername);
  const previousPending=Number.isSafeInteger(previous?.pending)&&previous.pending>=0&&previous.pending<=MAX_OFFLINE_PENDING?previous.pending:null;
  const pending=previousPending===null?cachedPending.pending:previousPending;
  const previousOfflineSince=Number.isSafeInteger(previous?.offlineSince)&&previous.offlineSince>0?previous.offlineSince:0;
  const offlineSince=pending>0?(previousPending===null?cachedPending.offlineSince:previousOfflineSince):0;
  authSession=null;cloudSession={token,refreshToken:'',accessExpiresAt:0,refreshIdleExpiresAt:0,refreshAbsoluteExpiresAt:0,username:serverUsername,role:String(data.customer.role||'客户'),accountType:'customer',plan:data.customer.plan==null?null:String(data.customer.plan),speechTier:normalizeSpeechTier(data.customer.speechTier,'advanced'),quota,used,pending,offlineSince,expires,status,unlimited:quota===null,parentId:data.customer.parentId||null,allocatedQuota:boundedUsed(data.customer.allocatedQuota),canManageSubaccounts:data.customer.canManageSubaccounts===true||!data.customer.parentId,subaccountCount:Math.max(0,Number(data.customer.subaccountCount)||0),cachedAt:Date.now()};applyCustomerSessionGrant(data);loginTransition=true;saveCloudCache();startCustomerHeartbeat();
  return{ok:true,accountType:'customer',user:publicCloudSession(),customer:publicCloudSession()};
}
function customerLoginError(result){
  const error=result?.data?.error;
  if(error==='pending')return'账号已注册，正在等待管理员分配套餐。';
  if(error==='disabled')return'账号已停用，请联系管理员。';
  if(error==='expired')return'账号授权已过期，请联系管理员续费。';
  return'';
}
async function loginCloudCustomer(input){
  const baseCredentials=loginCredentials(input),previous=cloudSession?.accountType==='customer'&&cloudSession.username?.toLowerCase()===baseCredentials.username.toLowerCase()?cloudSession:null;
  const credentials=customerSessionPayload(baseCredentials);
  const result=await cloudLoginRequest('/api/customer-login',credentials);
  if(result.networkError)throw new Error('无法连接云端账号服务，请检查网络后重试。');
  if(result.response.ok&&result.data?.ok)return acceptCloudCustomer(result.data,credentials.username,previous);
  const message=customerLoginError(result);if(message)throw new Error(message);
  throw new Error(result.response.status>=500?'云端账号服务暂时不可用，请稍后重试。':'账号或密码不正确。');
}
async function loginAccount(input){
  const credentials=loginCredentials(input);
  // Cloud accounts are authoritative across computers.  Only fall back to the
  // legacy machine-local administrator after both cloud account types decline.
  const adminResult=await cloudLoginRequest('/api/login',credentials);
  if(adminResult.response?.ok&&adminResult.data?.ok)return acceptCloudAdmin(adminResult.data,credentials.username);
  // Do not stop on a disabled administrator response: a customer record may
  // legitimately use the same username in older deployments.  Let the
  // customer endpoint decide first, then surface the admin-specific status.
  const adminDisabled=adminResult.response?.status===403&&adminResult.data?.error==='disabled';
  const previous=cloudSession?.accountType==='customer'&&cloudSession.username?.toLowerCase()===credentials.username.toLowerCase()?cloudSession:null;
  const customerResult=await cloudLoginRequest('/api/customer-login',customerSessionPayload(credentials));
  if(customerResult.response?.ok&&customerResult.data?.ok)return acceptCloudCustomer(customerResult.data,credentials.username,previous);
  const customerMessage=customerLoginError(customerResult);if(customerMessage)throw new Error(customerMessage);
  if(adminDisabled)throw new Error('管理员账号已停用。');
  // Machine-local administrator records are retained only for isolated
  // development fixtures. In a packaged customer build they would be a
  // user-writable entitlement bypass, so production authorization is always
  // decided by the cloud account service.
  if(!app.isPackaged&&auth.required()){
    try{stopCustomerHeartbeat();authSession=await auth.login(credentials.username,credentials.password);cloudSession=null;loginTransition=true;clearCloudCache();return{ok:true,accountType:'local-admin',user:authSession};}catch{}
  }
  if(adminResult.networkError||customerResult.networkError)throw new Error('无法连接云端账号服务，请检查网络后重试。');
  if((adminResult.response?.status||0)>=500||(customerResult.response?.status||0)>=500)throw new Error('云端账号服务暂时不可用，请稍后重试。');
  throw new Error('账号或密码不正确。');
}
function invalidateCloudSession(){
  // A 401/403 or an explicit expired/disabled response is authoritative. Do
  // not keep using a stale bearer token or its cached quota after revocation.
  stopCustomerHeartbeat();cloudSession=null;loginTransition=false;clearCloudCache();
}
function cloudQuotaFailure(error){
  return error==='quota_exceeded'||error==='insufficient_quota'||error==='quota-exceeded';
}
function offlineConsume(amount,finite){
  const now=Date.now(),since=Number(cloudSession.offlineSince||0)||now,pending=Number(cloudSession.pending||0);
  if(now-since>OFFLINE_GRACE_MS)throw new Error('云端额度服务暂时不可用，离线额度保护已暂停，请联网后重试。');
  if(pending+amount>MAX_OFFLINE_PENDING)throw new Error('云端额度尚未同步，已达到离线保护上限，请联网后重试。');
  if(finite&&cloudSession.quota<amount)throw new Error('云端翻译额度不足，请联系管理员充值或升级套餐。');
  cloudSession.offlineSince=since;cloudSession.pending=pending+amount;
  if(finite)cloudSession.quota-=amount;
  cloudSession.used=boundedUsed(cloudSession.used)+amount;saveCloudCache();
  return{offline:true};
}
async function consumeCloud(amount){
  if(!cloudSession)return;
  if(!Number.isSafeInteger(amount)||amount<1)return;
  if(cloudSession.accountType==='admin'&&cloudSession.unlimited)return;
  if(!['customer','admin'].includes(cloudSession.accountType))throw new Error('云端登录状态无效，请重新登录。');
  if(!(await ensureCustomerAccess()))throw new Error('云端登录已失效，请重新登录。');
  if(!cloudSessionActive()){invalidateCloudSession();throw new Error('云端登录已失效，请重新登录。');}
  const finite=cloudSession.quota!==null;
  if(finite&&!Number.isSafeInteger(cloudSession.quota))throw new Error('云端额度数据无效，请重新登录。');
  if(finite&&cloudSession.quota<amount)throw new Error('云端翻译额度不足，请联系管理员充值或升级套餐。');
  if(typeof cloudSession.token!=='string'||!cloudSession.token)throw new Error('云端登录已失效，请重新登录。');
  const pending=Number(cloudSession.pending||0);
  if(!Number.isSafeInteger(pending)||pending<0||pending>MAX_OFFLINE_PENDING)throw new Error('本地额度同步状态无效，请重新登录。');
  const sendAmount=amount+pending;
  if(!Number.isSafeInteger(sendAmount))throw new Error('本次翻译字数过大，请分段后重试。');
  let response,data;
  try{
    response=await fetch(cloudEndpoint('/api/customer-consume'),{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${cloudSession.token}`},body:JSON.stringify({amount:sendAmount}),signal:AbortSignal.timeout(8000)});
    data=await response.json().catch(()=>({}));
  }catch{
    // A temporary network outage may use a small, visible, time-bounded local
    // queue. This is intentionally not used for an HTTP auth/revocation
    // response, which is handled below and fails closed.
    return offlineConsume(amount,finite);
  }
  const error=String(data?.error||'').toLowerCase();
  if(response.status>=500)return offlineConsume(amount,finite);
  if(!response.ok||!data?.ok){
    if(cloudQuotaFailure(error)||response.status===409||response.status===429)throw new Error('云端翻译额度不足，请联系管理员充值或升级套餐。');
    if(response.status===401||response.status===403||['unauthorized','invalid_token','token_expired','expired','disabled','revoked'].includes(error)){
      invalidateCloudSession();throw new Error(error==='expired'?'账号授权已过期，请联系管理员续费。':'云端登录已失效，请重新登录。');
    }
    throw new Error('云端额度同步失败，请检查网络后重试。');
  }
  const nextQuota=boundedQuota(data.quota),nextUsed=boundedUsed(data.used);
  if((data.quota!==null&&nextQuota===null)||!Number.isSafeInteger(data.used)||data.used<0)throw new Error('云端额度响应无效，请重新登录。');
  cloudSession.quota=nextQuota;cloudSession.used=nextUsed;cloudSession.pending=0;cloudSession.offlineSince=0;saveCloudCache();
  return{offline:false};
}
function preflightCloud(amount){
  if(!Number.isSafeInteger(amount)||amount<1||!cloudSession)return;
  if(cloudSession.accountType==='admin'&&cloudSession.unlimited)return;
  if(!['customer','admin'].includes(cloudSession.accountType))throw new Error('云端登录状态无效，请重新登录。');
  if(!cloudSessionActive()){invalidateCloudSession();throw new Error('账号授权已过期或已停用，请联系管理员。');}
  if(cloudSession.quota!==null&&(!Number.isSafeInteger(cloudSession.quota)||cloudSession.quota<amount))throw new Error('翻译额度不足：本地模型和 DeepL 均已暂停，请联系管理员充值或升级套餐。');
}
async function authorizeSpeech(){
  if(authSession)return{speechTier:'flagship',engine:'whisper',model:'faster-whisper-large-v3-turbo'};
  if(!cloudSession||!['customer','admin'].includes(cloudSession.accountType))throw new Error('请先登录有效的云端账号。');
  if(!(await ensureCustomerAccess()))throw new Error('云端登录已失效，请重新登录。');
  preflightCloud(1);
  let response,data;
  try{response=await fetch(cloudEndpoint('/api/speech-authorize'),{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${cloudSession.token}`},body:'{}',signal:AbortSignal.timeout(10000)});data=await response.json().catch(()=>({}));}
  catch{throw new Error('语音版本授权需要联网，请检查网络后重试。');}
  const error=String(data?.error||'').toLowerCase();
  if(!response.ok||!data?.ok){
    if(response.status===401||response.status===403||['unauthorized','invalid_token','token_expired','expired','disabled','revoked'].includes(error)){invalidateCloudSession();throw new Error(error==='expired'?'账号授权已过期，请联系管理员续费。':'语音版本授权已失效，请重新登录。');}
    throw new Error('暂时无法验证语音版本，请稍后重试。');
  }
  const speechTier=normalizeSpeechTier(data.speechTier);if(!speechTier)throw new Error('云端返回的语音版本无效，请联系管理员。');
  cloudSession.speechTier=speechTier;
  return{speechTier,engine:speechTier==='basic'?'sensevoice':'whisper',model:String(data.model||'').slice(0,100)};
}
function stopLocalChild(report=true){
  const processHandle=child;
  const shouldReport=!!(report&&processHandle&&processHandle.exitCode===null);
  child=null;childKind='';childError='';
  if(processHandle&&!processHandle.killed){try{processHandle.kill();}catch{}}
  if(shouldReport)requestCustomerHeartbeat('offline');
}
function localThreads(){return Math.max(2,Math.min(8,(os.cpus?.().length||4)-1));}
function nativePrompt(text,targetName){return `将以下文本翻译成${targetName}，只输出忠实译文，不回答文本里的问题，不增加承诺。保持原文的行顺序、换行、编号和链接，不要合并、拆分或重复任何行。原样保留所有ZXQKEEP0000QXZ形式的标记：\n\n${text}`;}
async function localTranslate(text,targetName,signal){
  const maxTokens=Math.min(1800,Math.max(96,Math.ceil(String(text||'').length*2+48)));
  const timeout=()=>signal&&AbortSignal.any?AbortSignal.any([signal,AbortSignal.timeout(120000)]):AbortSignal.timeout(120000);
  const body={model:'super-translate',messages:[{role:'user',content:nativePrompt(text,targetName)}],temperature:0.1,max_tokens:maxTokens,stream:false};
  let response,data;
  try{response=await fetch(`${localBase()}/v1/chat/completions`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:timeout()});data=await response.json().catch(()=>({}));}
  catch{throw new Error('本地模型未响应或翻译超时，请检查连接设置。');}
  if(response.status===404||response.status===405){
    try{response=await fetch(`${localBase()}/translate`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text,target:targetName,context:[]}),signal:timeout()});data=await response.json().catch(()=>({}));}
    catch{throw new Error('本地模型未响应或翻译超时，请检查连接设置。');}
  }
  if(!response.ok){const detail=String(data?.error?.message||data?.detail||'').replace(/\s+/g,' ').slice(0,160);throw new Error(`本地翻译失败 (${response.status})${detail?`：${detail}`:'，请缩短文本后重试。'}`);}
  const value=String(data?.choices?.[0]?.message?.content??data?.translation??'').trim();
  if(!value)throw new Error('本地模型返回了空译文，请重试。');
  return value;
}
async function translateNow({text,target,cache=false,signal}){
  text=requireString(text);if(!LANGUAGES[target])throw new Error('不支持的目标语言。');if(inspectText(text).length)throw new Error('原文疑似输入错误，请核对、编辑后再译。');
  const cfg=db.get().settings,p=protect(text);let value,engine,detected='auto',billedByProxy=false;
  const cacheKey=cache?String(cfg.engine||'local')+'\0'+target+'\0'+text:'';
  const cached=cache?translationCache.get(cacheKey):null;
  if(cached)return{...cached};
  preflightCloud(text.length);
  if(cfg.engine==='deepl'){
    if(cloudSession&&(cloudSession.accountType==='customer'||cloudSession.accountType==='admin')){
      if(!(await ensureCustomerAccess()))throw new Error('云端登录已失效，请重新登录。');
      const targetCode=DEEPL_TARGETS[target];if(!targetCode)throw new Error('DeepL 暂不支持该目标语言，请切换本地模型。');
      let r,data;try{r=await fetch(cloudEndpoint('/api/translate'),{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${cloudSession.token}`},body:JSON.stringify({text:p.text,target_lang:targetCode}),signal:AbortSignal.timeout(45000)});data=await r.json().catch(()=>({}));}catch{throw new Error('云端翻译服务暂时不可用，请稍后重试。');}
      const error=String(data?.error||'').toLowerCase();if(!r.ok||!data?.ok){if(error==='quota_exceeded')throw new Error('翻译额度不足：本地模型和 DeepL 均已暂停，请联系管理员充值或升级套餐。');throw new Error('云端翻译服务暂时不可用，请稍后重试。');}value=String(data.translation||'').trim();detected='auto';engine='DeepL（云端代理）';billedByProxy=true;cloudSession.quota=boundedQuota(data.quota);cloudSession.used=boundedUsed(data.used);cloudSession.pending=0;cloudSession.offlineSince=0;saveCloudCache();
    }else{
      if(!cfg.deeplEncrypted||!safeStorage.isEncryptionAvailable())throw new Error('尚未设置 DeepL API Key。');
    const key=safeStorage.decryptString(Buffer.from(cfg.deeplEncrypted,'base64'));
    const url=key.endsWith(':fx')?'https://api-free.deepl.com/v2/translate':'https://api.deepl.com/v2/translate';
    // Explicit capability map verified against DeepL's current catalogue;
    // never derive provider codes by blindly upper-casing UI values.
    // https://developers.deepl.com/docs/getting-started/supported-languages
    const targetCode=DEEPL_TARGETS[target];if(!targetCode)throw new Error('DeepL 暂不支持该目标语言，请切换本地模型。');
    const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`DeepL-Auth-Key ${key}`},body:JSON.stringify({text:[p.text],target_lang:targetCode,preserve_formatting:true}),signal:AbortSignal.timeout(45000)});
    if(!r.ok)throw new Error(r.status===400?'DeepL 拒绝了该目标语言或请求参数，请切换本地模型或检查语言设置。':r.status===403?'DeepL 密钥认证失败。':r.status===456?'DeepL 额度不足。':`DeepL 请求失败 (${r.status})。`);
    const data=await r.json();value=data.translations?.[0]?.text;detected=data.translations?.[0]?.detected_source_language||'auto';engine='DeepL';
    }
  }else{
    const targetName=LOCAL_TARGET_NAMES[target];
    value=await localTranslate(p.text,targetName,signal);engine=childKind==='python'?'Hy-MT2 本地（Python）':'Hy-MT2 本地（llama.cpp）';
  }
  const billing=billedByProxy?null:await consumeCloud(text.length);
  const result={translation:restore(value,p.values),engine,detected,quota:cloudSession?.quota??null,offline:!!billing?.offline};
  if(cache)translationCache.set(cacheKey,result);if(translationCache.size>500)translationCache.delete(translationCache.keys().next().value);
  return {...result};
}
function translate(input){
  if(input?.fast){
    try{fastTranslationAbort?.abort();}catch{}
    const controller=new AbortController();fastTranslationAbort=controller;
    const task=translateNow({...input,signal:controller.signal}).finally(()=>{if(fastTranslationAbort===controller)fastTranslationAbort=null;});
    return task;
  }
  const task=translationTail.then(()=>translateNow(input));translationTail=task.catch(()=>{});return task;
}
function boundedBounds(raw){const [width,height]=win.getContentSize();if(!raw||!['x','y','width','height'].every(k=>Number.isFinite(raw[k])))throw new Error('区域参数无效。');const x=Math.max(0,Math.round(raw.x)),y=Math.max(0,Math.round(raw.y));return{x,y,width:Math.max(0,Math.min(Math.round(raw.width),width-x)),height:Math.max(0,Math.min(Math.round(raw.height),height-y))};}
async function requestView(op,data={}){
  if(!activeView||!isPlatformView(activeView.webContents,currentPlatform))throw new Error(`请先打开${PLATFORM_REGISTRY[currentPlatform]?.name||'服务'}。`);const id=crypto.randomUUID(),wc=activeView.webContents,channel=currentPlatform==='whatsapp'||currentPlatform==='whatsapp_multi'?'wa':'platform';
  return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{pending.delete(id);reject(new Error('服务页面未响应，请确认已打开聊天。'));},6000);pending.set(id,{wc,resolve,reject,timer,channel});wc.send(`${channel}:command`,{id,op,...data});});
}
async function createView(accountInput){
  const id=safeAccountId(typeof accountInput==='string'?accountInput:accountInput?.id);if(!id)throw new Error('服务实例标识无效。');
  const requested=typeof accountInput==='object'?String(accountInput.platform||''):'';const platform=PLATFORM_REGISTRY[requested]?requested:(id==='a'||id==='b'?'whatsapp':id.split('-')[0]&&PLATFORM_REGISTRY[id.split('-')[0]]?id.split('-')[0]:'whatsapp');const config=PLATFORM_REGISTRY[platform];
  let v=views.get(id);if(v){if(v.stPlatform!==platform)throw new Error('服务实例平台不能在运行中更改。');return v;}
  // Keep the two original WhatsApp partitions stable for existing users; all
  // newly-created instances derive a unique persistent partition from id.
  const partition=proxyPartition(id,platform);
  const ses=session.fromPartition(partition);ses.setPermissionRequestHandler((wc,p,cb)=>cb(false));ses.setPermissionCheckHandler(()=>false);
  const fp=fingerprintConfig(id);
  const ua=(fp.ua&&fp.ua.trim())||`Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${process.versions.chrome} Safari/537.36`;ses.setUserAgent(ua);
  await applyProxyToSession(id,ses);
  if(!ses.__superTranslateProxyLoginBound){
    Object.defineProperty(ses,'__superTranslateProxyLoginBound',{value:true,configurable:false});
    const accountId=id;
    ses.on('login',(event,webContents,request,authInfo,callback)=>{
      const config=proxyConfigForAccount(accountId);
      if(!authInfo?.isProxy||!config.enabled||authInfo.host!==config.host||String(authInfo.port||'')!==String(config.port))return callback();
      const raw=proxyProfiles()[accountId]||{},username=readProxySecret(raw.usernameEncrypted),password=readProxySecret(raw.passwordEncrypted);
      if(username||password){event.preventDefault();callback(username,password);}else callback();
    });
  }
  v=new WebContentsView({webPreferences:{partition,preload:path.join(__dirname,platform==='whatsapp'||platform==='whatsapp_multi'?'wa-preload.js':'platform-preload.js'),additionalArguments:[`--st-fingerprint=${Buffer.from(JSON.stringify(fp)).toString('base64')}`],contextIsolation:true,nodeIntegration:false,sandbox:true,webSecurity:true,allowRunningInsecureContent:false,webviewTag:false,devTools:!app.isPackaged,spellcheck:false}});
  v.stAccountId=id;v.stPlatform=platform;v.stPartition=partition;v.__superTranslateReady=false;v.__superTranslateLoadFailed=false;v.__superTranslateInitialized=false;v.__superTranslateLoadTimer=null;hardenWebContents(v.webContents);v.webContents.setZoomFactor(0.85);v.webContents.setUserAgent(ua);
  // Meta and a few other services complete sign-in in a popup. Keep the
  // popup capability, but only for the same explicit platform host allow-list
  // used by will-navigate/will-redirect; unknown origins remain blocked.
  v.webContents.setWindowOpenHandler(details=>platformURL(platform,details?.url)?{action:'allow'}:{action:'deny'});
  const blockForeignNavigation=(event,url)=>{if(!platformURL(platform,url))event.preventDefault();};v.webContents.on('will-navigate',blockForeignNavigation);v.webContents.on('will-redirect',blockForeignNavigation);
  const clearViewLoadTimer=()=>{if(v.__superTranslateLoadTimer){clearTimeout(v.__superTranslateLoadTimer);v.__superTranslateLoadTimer=null;}};
  const failViewLoad=message=>{clearViewLoadTimer();v.__superTranslateLoadFailed=true;v.__superTranslateReady=false;if(!v.webContents.isDestroyed())v.setVisible(false);if(v===activeView)serviceViewStatus('error',{account:id,platform,message});};
  const scheduleViewLoadTimeout=()=>{clearViewLoadTimer();v.__superTranslateLoadTimer=setTimeout(()=>{if(v===activeView&&!v.__superTranslateReady&&!v.__superTranslateLoadFailed)failViewLoad(`${config.name} 登录页面加载超时，请检查网络或代理后重试。`);},20000);};
  const markViewReady=()=>{if(v.__superTranslateLoadFailed||v.webContents.isDestroyed()||!platformURL(platform,v.webContents.getURL()))return;clearViewLoadTimer();v.__superTranslateReady=true;if(v===activeView){v.setVisible(true);serviceViewStatus('ready',{account:id,platform});}if(platform!=='whatsapp'&&platform!=='whatsapp_multi'&&!v.__superTranslateInitialized&&!v.webContents.isDestroyed()){v.__superTranslateInitialized=true;v.webContents.send('platform:command',{op:'init',platform,id,driver:{name:config.name,selectors:config.selectors},config:{...currentLiveConfig}});}};
  if(platform==='whatsapp'||platform==='whatsapp_multi'){
    v.webContents.on('dom-ready',()=>{installWhatsAppMediaBridge(v.webContents).catch(()=>{});markViewReady();});
    let reading=false,lastTitleUnread=-1;const reader=fs.readFileSync(path.join(__dirname,'wa-runtime-reader.js'),'utf8');
    const clock=setInterval(async()=>{if(reading||v!==activeView||!enabled||!isWA(v.webContents))return;reading=true;try{const title=await v.webContents.getTitle().catch(()=>''),match=String(title||'').match(/^\((\d+)\)/),count=match?Math.min(999999,Number(match[1])||0):0;if(count!==lastTitleUnread){const previous=lastTitleUnread;lastTitleUnread=count;win?.webContents.send('desktop:account-unread',{account:id,count,source:'title',increased:previous>=0&&count>previous});}const data=await v.webContents.executeJavaScript(reader);const observed=(data.rows||[]).slice(0,100).map((r,index)=>{const phone=String(r.phone||'');const info=phoneInfo(phone);const identity=String(r.key||r.title||`row:${index}`);return{...r,hash:crypto.createHash('sha256').update(id+'\0'+identity).digest('hex'),country:info.country==='CN'?'中国大陆':info.country?info.label:'',countryCode:info.country||''};});if(observed.length)identityRowsByAccount.set(id,observed);const rows=observed.length?observed:(identityRowsByAccount.get(id)||[]);v.webContents.send('wa:identities',{rows});if(data.self){win?.webContents.send('desktop:self',{account:id,name:String(data.self.name||'').slice(0,100),phone:phoneInfo(data.self.phone).number});if(v.stOpenedSelf){v.stOpenedSelf=false;await v.webContents.executeJavaScript("document.querySelector('button[aria-label=\"对话\"],button[aria-label=\"聊天\"],button[aria-label=\"Chats\"]')?.click()");}}else if(data.canReadSelf&&!v.stSelfAttempted){v.stSelfAttempted=true;v.stOpenedSelf=true;await v.webContents.executeJavaScript("document.querySelector('button[aria-label=\"个人主页\"],button[aria-label=\"Profile\"]')?.click()");}}catch{}finally{reading=false;}},1200);v.webContents.once('destroyed',()=>clearInterval(clock));
  }else{
    v.webContents.on('dom-ready',markViewReady);
  }
  v.webContents.on('did-start-navigation',(details)=>{if(!details?.isMainFrame||details.isInPlace)return;v.__superTranslateReady=false;v.__superTranslateLoadFailed=false;v.__superTranslateInitialized=false;scheduleViewLoadTimeout();if(v===activeView){v.setVisible(false);serviceViewStatus('loading',{account:id,platform,message:`正在加载 ${config.name} 登录页面…`});}});
  v.webContents.on('did-finish-load',markViewReady);
  v.webContents.on('did-stop-loading',()=>{if(!v.__superTranslateLoadFailed)markViewReady();});
  v.webContents.on('did-fail-load',(_event,_errorCode,_errorDescription,_validatedURL,isMainFrame)=>{if(!isMainFrame)return;failViewLoad(`${config.name} 登录页面加载失败，请检查网络或代理后重试。`);});
  v.webContents.on('render-process-gone',()=>failViewLoad(`${config.name} 登录页面异常退出，请重试。`));
  v.webContents.once('destroyed',()=>{clearViewLoadTimer();if(views.get(id)===v)views.delete(id);});views.set(id,v);scheduleViewLoadTimeout();v.webContents.loadURL((fixture&&(platform==='whatsapp'||platform==='whatsapp_multi'))?fixture:config.url).catch(()=>failViewLoad(`${config.name} 登录页面加载失败，请检查网络或代理后重试。`));return v;
}
async function destroyView(id,clearPartition=false){
  const safeId=safeAccountId(id);if(!safeId)throw new Error('服务实例标识无效。');const view=views.get(safeId);if(!view){if(db){const profiles=proxyProfiles();if(Object.prototype.hasOwnProperty.call(profiles,safeId)){delete profiles[safeId];db.save();}}return{ok:true,removed:false};}
  if(activeView===view){try{view.webContents.send(view.stPlatform==='whatsapp'||view.stPlatform==='whatsapp_multi'?'wa:command':'platform:command',{op:'config',config:{automatic:false,history:false}});}catch{}try{win?.contentView.removeChildView(view);}catch{}activeView=null;enabled=false;}
  views.delete(safeId);identityRowsByAccount.delete(safeId);const wc=view.webContents,partition=view.stPartition;try{if(!wc.isDestroyed())wc.close();}catch{}
  if(clearPartition&&partition){try{await session.fromPartition(partition).clearStorageData();}catch{}}
  if(db){const profiles=proxyProfiles();if(Object.prototype.hasOwnProperty.call(profiles,safeId)){delete profiles[safeId];db.save();}}
  return{ok:true,removed:true,partitionCleared:!!clearPartition};
}
function showWorkbench(){if(!access())return;win.setMinimumSize(1100,700);const area=screen.getDisplayMatching(win.getBounds()).workAreaSize;win.setSize(Math.min(1480,area.width),Math.min(900,area.height));win.center();win.loadURL(urls.workbench);win.webContents.once('did-finish-load',()=>{if(app.isPackaged)setTimeout(()=>checkForUpdates().catch(()=>{}),2500);});}
function showLogin(){
  // Returning from the workbench is an explicit sign-out.  Keep the optional
  // remembered account, but turn off auto-login so the user can actually stay
  // on the login screen and choose another account next time.
  try{loginPreferences?.disableAutoLogin();}catch{}
  stopCustomerHeartbeat();authSession=null;cloudSession=null;loginTransition=false;clearCloudCache();
  if(activeView){activeView.webContents.send('wa:command',{op:'config',config:{automatic:false,history:false}});win.contentView.removeChildView(activeView);}
  activeView=null;enabled=false;win.setMinimumSize(700,450);win.setSize(880,560);win.center();win.loadURL(urls.login);
}
function create(){
  win=new BrowserWindow({width:880,height:560,minWidth:700,minHeight:450,frame:false,backgroundColor:'#e9f2ff',title:'超级翻译',icon:path.join(__dirname,'icon.ico'),show:false,webPreferences:{preload:path.join(__dirname,'desktop-preload.js'),contextIsolation:true,nodeIntegration:false,sandbox:true,webSecurity:true,allowRunningInsecureContent:false,webviewTag:false,devTools:!app.isPackaged}});
  // Only the trusted local workbench renderer may access the microphone. All
  // embedded service partitions keep their separate deny-all permission
  // handlers, so WhatsApp/Telegram/Facebook cannot request microphone access
  // through this capability.
  const mainSession=win.webContents.session;
  const allowAudio=(contents,permission,details={})=>{
    const mediaTypes=Array.isArray(details.mediaTypes)?details.mediaTypes:(details.mediaType?[String(details.mediaType)]:[]);
    return contents===win?.webContents&&permission==='media'&&contents.getURL()===urls.workbench&&mediaTypes.includes('audio')&&!mediaTypes.includes('video');
  };
  mainSession.setPermissionRequestHandler((contents,permission,callback,details)=>callback(allowAudio(contents,permission,details)));
  mainSession.setPermissionCheckHandler((contents,permission,_origin,details)=>allowAudio(contents,permission,details));
  hardenWebContents(win.webContents);
  win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  // Login and workbench documents are switched only by the main process via
  // showLogin()/showWorkbench(). Any navigation or redirect requested by a
  // renderer (including a same-file URL with a query/hash) is rejected.
  win.webContents.on('will-navigate',event=>event.preventDefault());
  win.webContents.on('will-redirect',event=>event.preventDefault());
  win.once('ready-to-show',()=>win.show());
  win.on('closed',()=>{for(const v of views.values())if(!v.webContents.isDestroyed())v.webContents.close();views.clear();activeView=null;win=null;});win.loadURL(urls.login);
}
app.whenReady().then(()=>{
  Menu.setApplicationMenu(null);setupAutoUpdater();db=store(app.getPath('userData'));auth=authStore(app.getPath('userData'));loginPreferences=createLoginPreferences(app.getPath('userData'),safeStorage);speechRuntime=createSpeechRuntime();cloudCacheFile=path.join(app.getPath('userData'),'cloud-license-v1.json');voiceCacheFile=path.join(app.getPath('userData'),'incoming-voice-cache-v1.bin');loadIncomingVoiceCache();
  try{scrmService.start();}catch(error){console.error('[scrm] start failed',error);}
  // Never restore a cloud session from this file.  It is intentionally only a
  // bounded encrypted queue for offline billing; credentials in
  // login-preferences drive the one-shot automatic server login in the login
  // renderer.  This prevents stale/revoked accounts or edited metadata from
  // satisfying access() on a fresh process.
  try{
    const record=JSON.parse(fs.readFileSync(cloudCacheFile,'utf8'));
    if(record?.version!==CLOUD_CACHE_VERSION||typeof record.encryptedSession!=='string')clearCloudCache();
  }catch(error){if(fs.existsSync(cloudCacheFile))clearCloudCache();}
  handler('desktop:auth-status',()=>({required:!app.isPackaged&&auth.required(),user:authSession||publicCloudSession(),realWhatsApp:true}),true);
  handler('scrm:status',()=>scrmService.status(),true);
  handler('scrm:token',async()=>{
    if(!access())throw new Error('请先登录超级翻译账号。');
    if(cloudSession?.accountType==='customer'&&!(await ensureCustomerAccess()))throw new Error('云端账号会话已失效，请重新登录。');
    const user=cloudSession||authSession;
    if(!user?.username)throw new Error('请先登录超级翻译账号。');
    return scrmService.ensureSession(user.username);
  },true);
  handler('desktop:fingerprint-probe',async()=>{
    if(!activeView||activeView.webContents.isDestroyed())throw new Error('请先打开一个平台会话。');
    return activeView.webContents.executeJavaScript(`(async()=>{const gl=document.createElement('canvas').getContext('webgl');const dbg=gl&&gl.getExtension('WEBGL_debug_renderer_info');const c=document.createElement('canvas');c.width=160;c.height=40;const ctx=c.getContext('2d');ctx.textBaseline='top';ctx.font='14px Arial';ctx.fillStyle='#f60';ctx.fillRect(0,0,160,40);ctx.fillStyle='#069';ctx.fillText('fingerprint',4,8);const data=c.toDataURL();let hash=0;for(let i=0;i<data.length;i++)hash=(hash*31+data.charCodeAt(i))>>>0;return{ua:navigator.userAgent,platform:navigator.platform,language:navigator.language,languages:[...(navigator.languages||[])],hardwareConcurrency:navigator.hardwareConcurrency||0,deviceMemory:navigator.deviceMemory||0,timezone:Intl.DateTimeFormat().resolvedOptions().timeZone,screen:[screen.width,screen.height],webglVendor:dbg?gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL):'',webglRenderer:dbg?gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL):'',canvasHash:String(hash)};})()`);
  });
  ipcMain.on('wa:risk-alert',(e,payload)=>{if(!activeView||e.sender!==activeView.webContents||!trustedWA(e)||!win)return;win.webContents.send('desktop:risk-alert',{type:String(payload?.type||'risk'),text:String(payload?.text||'').slice(0,2000)});});
  handler('desktop:openchat-open',async input=>{
    if(!access())throw new Error('请先登录超级翻译账号。');
    const user=cloudSession||authSession;if(!user?.username)throw new Error('请先登录超级翻译账号。');
    const token=await scrmService.ensureSession(user.username);
    const response=await fetch(`http://127.0.0.1:${scrmService.port}/api/app/openchat/open`,{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+token},body:JSON.stringify(input||{}),signal:AbortSignal.timeout(12000)});
    return response.json().catch(()=>({ok:false,error:'SCRM 响应无效'}));
  });
  const bridgeCache=new Map();
  bridgeHandler('scrm-bridge:exec',(prefix,id,script)=>{
    const view=views.get(safeAccountId(id));if(!view)throw new Error('会话未打开。');
    if(typeof script!=='string'||script.length>200000)throw new Error('脚本格式无效。');
    return view.webContents.executeJavaScript(script,true);
  });
  bridgeHandler('scrm-bridge:capture',async(prefix,id)=>{
    const view=views.get(safeAccountId(id));if(!view)throw new Error('会话未打开。');
    const image=await view.webContents.capturePage();return{ok:true,dataUrl:'data:image/png;base64,'+image.toPNG().toString('base64')};
  });
  bridgeHandler('scrm-bridge:set-proxy',async(prefix,id,proxy)=>{
    const view=views.get(safeAccountId(id));if(!view)throw new Error('会话未打开。');
    const parsed=scrmProxy.resolve(proxy);if(parsed.kind==='invalid'||parsed.kind==='empty')throw new Error(parsed.reason||'代理无效');
    const ses=view.webContents.session;await ses.setProxy(parsed.kind==='relay'?{proxyRules:`socks5://${parsed.host}:${parsed.port}`}:{proxyRules:parsed.rules||`${parsed.protocol}://${parsed.host}:${parsed.port}`});return{ok:true};
  });
  bridgeHandler('scrm-bridge:test-proxy',(_prefix,proxy)=>scrmProxyTest.test(String(proxy||''),{targetHost:'web.whatsapp.com'}));
  bridgeHandler('scrm-bridge:cache-get',key=>bridgeCache.get(String(key))??null);
  bridgeHandler('scrm-bridge:cache-set',(key,value)=>{bridgeCache.set(String(key),value);return{ok:true};});
  bridgeHandler('scrm-bridge:cache-remove',key=>{bridgeCache.delete(String(key));return{ok:true};});
  bridgeHandler('scrm-bridge:http-get',url=>new Promise((resolve,reject)=>{
    const parsed=new URL(String(url));if(!['http:','https:'].includes(parsed.protocol))return reject(new Error('协议不支持'));
    const lib=parsed.protocol==='https:'?require('node:https'):require('node:http');
    const req=lib.get(parsed,{timeout:8000},res=>{let data='';res.setEncoding('utf8');res.on('data',chunk=>{if(data.length<2_000_000)data+=chunk;});res.on('end',()=>resolve({ok:true,status:res.statusCode,text:data}));});
    req.on('timeout',()=>req.destroy(new Error('请求超时')));req.on('error',reject);
  }));
  bridgeHandler('scrm-bridge:fp-get',(_platform,id)=>fingerprintConfig(id));
  bridgeHandler('scrm-bridge:fp-save',(platform,id,cfg)=>{const store=db.get();store.fingerprints=store.fingerprints&&typeof store.fingerprints==='object'?store.fingerprints:{};store.fingerprints[String(id||platform)]=normalizeFingerprint(cfg);db.save();return fingerprintConfig(id||platform);});
  handler('fingerprint:get',id=>fingerprintConfig(id));
  handler('fingerprint:save',input=>{
    const source=input&&typeof input==='object'&&!Array.isArray(input)?input:{};
    const id=source.id?String(source.id):'';
    const raw=source.config&&typeof source.config==='object'?source.config:source;
    const store=db.get();
    if(id){store.fingerprints=store.fingerprints&&typeof store.fingerprints==='object'?store.fingerprints:{};store.fingerprints[id]=normalizeFingerprint(raw);}
    else store.fingerprint=normalizeFingerprint(raw);
    db.save();return fingerprintConfig(id);
  });
  loginHandler('desktop:list-saved-logins',()=>loginPreferences.list());
  loginHandler('desktop:get-saved-login',id=>loginPreferences.get(id));
  loginHandler('desktop:save-login-preference',input=>loginPreferences.save(input));
  loginHandler('desktop:remove-saved-login',id=>loginPreferences.remove(id));
  loginHandler('desktop:clear-saved-login',()=>loginPreferences.clear());
  loginHandler('desktop:disable-auto-login',id=>loginPreferences.disableAutoLogin(id));
  handler('desktop:cloud-validate',async code=>{
    // License validation changes entitlement state and is an administrator
    // operation. A customer (or a legacy local-only session) must not be able
    // to use this IPC as a cloud-account oracle.
    if(cloudSession?.accountType!=='admin')throw new Error('仅云端管理员可以验证授权码。');
    if(typeof code!=='string'||code.length>200)throw new Error('授权码格式无效。');
    const r=await fetch(cloudEndpoint('/api/validate-license'),{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${cloudSession.token}`},body:JSON.stringify({code:code.trim()}),signal:AbortSignal.timeout(10000)});
    const data=await r.json().catch(()=>({}));
    if(!r.ok||!data.ok)throw new Error(data.error==='license_expired'?'授权已过期。':data.error==='license_disabled'?'授权已禁用。':'授权码无效。');
    return data;
  });
  handler('desktop:cloud-customer-register',async input=>{
    const username=String(input?.username||'').trim(),password=input?.password;
    if(!/^[A-Za-z0-9_]{3,40}$/.test(username))throw new Error('用户名需为 3–40 位字母、数字或下划线。');
    if(typeof password!=='string'||password.length<8||password.length>128)throw new Error('密码长度需为 8–128 位。');
    let response,data;
    try{response=await fetch(cloudEndpoint('/api/register'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password}),signal:AbortSignal.timeout(10000)});data=await response.json().catch(()=>({}));}
    catch{throw new Error('无法连接账号服务，请检查网络后重试。');}
    if(!response.ok||!data.ok){if(response.status===409)throw new Error('用户名已存在，请更换用户名。');if(response.status===400)throw new Error(String(data.error||'用户名或密码格式不正确。').slice(0,120));throw new Error(String(data.error||'注册失败，请稍后重试。').slice(0,120));}
    return{ok:true,username,message:String(data.message||'注册成功，请等待管理员分配套餐。').slice(0,160)};
  },true);
  handler('desktop:open-register-page',()=>shell.openExternal(cloudEndpoint('/register.html')).then(()=>({ok:true})),true);
   handler('desktop:cloud-customer-login',loginCloudCustomer,true);
   handler('desktop:customer-usage',async()=>{
     if(cloudSession?.accountType!=='customer')return{ok:true,...publicCloudSession(),dailyUsage:[],dailyUsageSupported:false};
     let response,data;
     try{response=await fetch(cloudEndpoint('/api/customer-usage'),{headers:{Authorization:`Bearer ${cloudSession.token}`},signal:AbortSignal.timeout(10000)});data=await response.json().catch(()=>({}));}
     catch{throw new Error('无法连接云端额度服务，请检查网络后重试。');}
     if(!response.ok||!data?.ok){if(data?.error==='expired')throw new Error('账号授权已过期，请联系管理员续费。');if(data?.error==='disabled')throw new Error('账号已停用，请联系管理员。');throw new Error('云端额度服务暂时不可用，请稍后重试。');}
     const quota=boundedQuota(data.quota),used=boundedUsed(data.used),allocatedQuota=boundedUsed(data.allocatedQuota);
     if(data.quota!==null&&quota===null)throw new Error('云端额度数据无效，请重新登录。');
     cloudSession.quota=quota;cloudSession.used=used;cloudSession.allocatedQuota=allocatedQuota;cloudSession.plan=data.plan==null?cloudSession.plan:String(data.plan);cloudSession.expires=data.expires==null?null:String(data.expires);cloudSession.parentId=data.parentId||null;cloudSession.canManageSubaccounts=data.canManageSubaccounts===true;cloudSession.subaccountCount=Math.max(0,Number(data.subaccountCount)||0);saveCloudCache();
     const dailyUsage=Array.isArray(data.dailyUsage)?data.dailyUsage.slice(0,31).map(item=>({date:String(item?.date||'').slice(0,10),characters:boundedUsed(item?.characters)})).filter(item=>/^\d{4}-\d{2}-\d{2}$/.test(item.date)):[];
     return{ok:true,...publicCloudSession(),dailyUsage,dailyUsageSupported:dailyUsage.length>0};
   });
   handler('desktop:customer-team',async input=>{
    if(cloudSession?.accountType!=='customer')throw new Error('只有客户主账号可以管理子账号。');
    const method=String(input?.method||'GET').toUpperCase(),id=input?.id?encodeURIComponent(String(input.id)):'',pathName='/api/customer-subaccounts'+(id?'/'+id:''),body=input?.body;
    if(!['GET','POST','PATCH','DELETE'].includes(method))throw new Error('子账号操作无效。');
    if((method==='POST'||method==='PATCH')&&(!body||typeof body!=='object'))throw new Error('子账号参数无效。');
    const options={method,headers:{'Content-Type':'application/json',Authorization:`Bearer ${cloudSession.token}`},signal:AbortSignal.timeout(10000)};if(body!==undefined)options.body=JSON.stringify(body);
    let response,data;try{response=await fetch(cloudEndpoint(pathName),options);data=await response.json().catch(()=>({}));}catch{throw new Error('无法连接云端子账号服务，请检查网络后重试。');}
    if(!response.ok||!data?.ok){const messages={subaccount_limit_reached:'主账号最多创建 3 个子账号。',parent_quota_exceeded:'主账号剩余额度不足，无法分配给子账号。',quota_below_used:'新额度不能低于子账号已使用字符数。',subaccount_parent_required:'当前账号不是主账号，不能管理子账号。',user_exists:'用户名已存在，请更换用户名。',subaccount_not_found:'子账号不存在或已删除。',quota_exceeded:'子账号翻译额度不足。',disabled:'账号已停用。',expired:'账号授权已过期。'};throw new Error(messages[data?.error]||String(data?.error||'子账号操作失败。').slice(0,160));}
    if(data.parent){cloudSession.quota=boundedQuota(data.parent.quota);cloudSession.used=boundedUsed(data.parent.used);cloudSession.allocatedQuota=boundedUsed(data.parent.allocatedQuota);cloudSession.subaccountCount=Math.max(0,Number(data.used)||Number(data.parent.subaccountCount)||0);saveCloudCache();}
    return data;
  });
  // One button works on a clean computer too: identify a cloud administrator
  // first, then a cloud customer, and only then use the legacy local admin.
  ipcMain.on('desktop:app-version',(event)=>{if(trusted(event))event.returnValue=app.getVersion();});
  handler('desktop:login',loginAccount,true);
  handler('desktop:check-updates',checkForUpdates);
  handler('desktop:download-update',downloadUpdate);
  handler('desktop:install-update',installUpdate);
  handler('desktop:open-external',raw=>{
    const value=String(raw||'').trim();
    const allowed=['https://pan.baidu.com/','https://share.feijipan.com/'];
    if(!allowed.some(prefix=>value.startsWith(prefix)))throw new Error('只允许打开已配置的模型下载地址。');
    return shell.openExternal(value).then(()=>({ok:true}));
  });
  handler('desktop:install-model',importModel);
  handler('desktop:install-speech-model',installSpeechModel);
  ipcMain.on('desktop:window',(event,action)=>{
    if(!trusted(event))return;
    if(action==='minimize')win.minimize();
    else if(action==='maximize'){win.isMaximized()?win.unmaximize():win.maximize();}
    else if(action==='close')win.close();
    else if(action==='workbench'){
      // The login page may request the hand-off only once, immediately after
      // a successful credential check.  A stale/cache-only process has no
      // transition token and cannot jump straight into the workbench.
      const fromLogin=event.senderFrame.url===urls.login;
      if(fromLogin&&!loginTransition)return;
      if(!access())return;
      if(fromLogin)loginTransition=false;
      showWorkbench();
    }else if(action==='login')showLogin();
  });
  handler('desktop:translate',translate);handler('desktop:health',health);handler('desktop:phone',value=>phoneInfo(String(value).slice(0,32)));
  handler('desktop:settings',()=>{const s=db.get().settings;return{engine:s.engine,python:s.python,model:s.model,asrModel:s.asrModel,localPort:localPort(),nativeRuntime:nativeRuntimeAvailable(),cloudDeepLProxy:true,hasKey:!app.isPackaged&&!!s.deeplEncrypted};});
  handler('desktop:proxy-settings',id=>{const safe=safeAccountId(id);if(!safe)throw new Error('服务实例标识无效。');return proxyPublic(safe);});
  handler('desktop:save-proxy-settings',saveProxyProfile);
  handler('desktop:test-proxy',testProxy);
  handler('desktop:save-settings',raw=>{if(!raw||!['local','deepl'].includes(raw.engine))throw new Error('引擎参数无效。');const s=db.get().settings;s.engine=raw.engine;for(const key of ['python','model','asrModel'])if(typeof raw[key]==='string'&&raw[key].length<1024)s[key]=raw[key];if(Number.isInteger(raw.localPort)&&raw.localPort>=1024&&raw.localPort<=65535)s.localPort=raw.localPort;if(!app.isPackaged&&raw.key){if(typeof raw.key!=='string'||raw.key.length>300)throw new Error('密钥格式无效。');if(!safeStorage.isEncryptionAvailable())throw new Error('Windows 安全存储不可用，未保存密钥。');s.deeplEncrypted=safeStorage.encryptString(raw.key.trim()).toString('base64');}db.save();return{ok:true};});
  handler('desktop:speech-status',async()=>({...await speechRuntime.status(db.get().settings.asrModel),entitlement:normalizeSpeechTier(cloudSession?.speechTier,cloudSession?.accountType==='admin'||authSession?'flagship':'advanced')}));
  handler('desktop:speech-start',async()=>{const entitlement=await authorizeSpeech();return speechRuntime.startTier(entitlement.speechTier,db.get().settings.asrModel);});
  handler('desktop:speech-transcribe',async input=>{const entitlement=await authorizeSpeech();return speechRuntime.transcribe({...input,engine:entitlement.engine,tier:entitlement.speechTier},db.get().settings.asrModel);});
  handler('desktop:start-model',async()=>{
    try{const ready=await health();requestCustomerHeartbeat('ready');return ready;}catch{}if(modelStarting)return modelStarting;
    modelStarting=(async()=>{
      const cfg=db.get().settings,model=String(cfg.model||'').trim();
      if(!model||!fs.existsSync(model)||!fs.statSync(model).isFile()||path.extname(model).toLowerCase()!=='.gguf')throw new Error('未找到 GGUF 模型文件，请先点击“一键导入 / 注入模型”。');
      stopLocalChild();
      let executable,args,kind;
      if(nativeRuntimeAvailable()){
        // extraResources are executable files outside app.asar. Verify every
        // shipped EXE/DLL against the ASAR-protected manifest immediately
        // before spawn so a replaced runtime is never executed.
        verifyNativeRuntime();
        executable=nativeServerPath();kind='native';args=['--model',model,'--host','127.0.0.1','--port',String(localPort()),'--ctx-size','4096','--threads',String(localThreads()),'--n-gpu-layers','0','--parallel','1','--alias','super-translate'];
      }else if(process.platform==='win32'&&cfg.python&&fs.existsSync(cfg.python)&&fs.existsSync(path.join(runtimeRoot(),'local_server.py'))){
        executable=cfg.python;kind='python';args=[path.join(runtimeRoot(),'local_server.py')];
      }else if(process.platform!=='win32'){
        throw new Error('当前系统暂不支持内置本地运行时，请使用 Windows x64 客户端。');
      }else{
        throw new Error('本地运行时组件缺失，请重新安装最新版超级翻译。');
      }
      childKind=kind;childError='';let failed=false;let output='';
      const processHandle=spawn(executable,args,{windowsHide:true,cwd:path.dirname(executable),stdio:['ignore','pipe','pipe'],env:{...process.env,ST_MODEL:model,ST_PORT:String(localPort())}});
      child=processHandle;requestCustomerHeartbeat('starting');
      const remember=chunk=>{output=(output+String(chunk)).slice(-3000);if(child===processHandle)childError=output.trim();};processHandle.stdout?.on('data',remember);processHandle.stderr?.on('data',remember);
      processHandle.once('error',e=>{if(child!==processHandle)return;failed=true;childError=String(e.message||e);requestCustomerHeartbeat('offline');});processHandle.once('exit',()=>{if(child!==processHandle)return;failed=true;requestCustomerHeartbeat('offline');});
      for(let i=0;i<60;i++){
        await new Promise(r=>setTimeout(r,1500));
        if(!failed){try{const ready=await health();requestCustomerHeartbeat('ready');return ready;}catch{}}
        if(failed)break;
      }
      const detail=childError.replace(/\s+/g,' ').slice(-240);
      stopLocalChild();
      if(detail)throw new Error(`本地模型进程启动失败：${detail}`);
      throw new Error('模型仍未就绪，请确认 GGUF 文件完整后重试。');
    })().finally(()=>modelStarting=null);return modelStarting;
  });
  handler('desktop:live',async ({active,account,platform,bounds}={})=>{if(!active){if(activeView){try{activeView.webContents.send(activeView.stPlatform==='whatsapp'||activeView.stPlatform==='whatsapp_multi'?'wa:command':'platform:command',{op:'config',config:{automatic:false,history:false}});}catch{}win.contentView.removeChildView(activeView);}activeView=null;enabled=false;serviceViewStatus('idle');return{ok:true};}const id=safeAccountId(account);if(!id)throw new Error('服务实例标识无效。');const key=platform===undefined?(id==='a'||id==='b'?'whatsapp':'whatsapp'):String(platform);if(!PLATFORM_REGISTRY[key])throw new Error('不支持的服务平台。');if(activeView){try{activeView.webContents.send(activeView.stPlatform==='whatsapp'||activeView.stPlatform==='whatsapp_multi'?'wa:command':'platform:command',{op:'config',config:{automatic:false,history:false}});}catch{}win.contentView.removeChildView(activeView);}currentAccount=id;currentPlatform=key;activeView=await createView({id,platform:key});win.contentView.addChildView(activeView);activeView.setBounds(boundedBounds(bounds));activeView.setVisible(activeView.__superTranslateReady===true);if(!activeView.__superTranslateReady)serviceViewStatus('loading',{account:id,platform:key,message:`正在加载 ${PLATFORM_REGISTRY[key].name} 登录页面…`});enabled=true;const selected=activeView;const cachedIdentities=identityRowsByAccount.get(id);if((key==='whatsapp'||key==='whatsapp_multi')&&cachedIdentities?.length)setTimeout(()=>{if(selected===activeView&&!selected.webContents.isDestroyed())selected.webContents.send('wa:identities',{rows:cachedIdentities});},250);setTimeout(()=>{if(selected===activeView&&!selected.webContents.isDestroyed())selected.webContents.send(key==='whatsapp'||key==='whatsapp_multi'?'wa:command':'platform:command',{op:'snapshot'});},500);return{ok:true,platform:key,partition:activeView.stPartition};});
  handler('desktop:warm-accounts',async items=>{
    if(!Array.isArray(items))throw new Error('账号列表无效。');
    const results=[];
    for(const item of items.slice(0,30)){
      const id=safeAccountId(item?.id),platform=String(item?.platform||'whatsapp');
      if(!id||!PLATFORM_REGISTRY[platform]){results.push({id:item?.id,logged:false,error:'账号无效'});continue;}
      try{
        const v=await createView({id,platform});
        if(v!==activeView)v.setVisible(false);
        for(let i=0;i<40&&!v.__superTranslateReady;i++)await new Promise(resolve=>setTimeout(resolve,250));
        let pane=false;
        try{pane=await v.webContents.executeJavaScript("!!document.querySelector('#pane-side')",true);}catch{}
        results.push({id,logged:!!pane,ready:!!v.__superTranslateReady});
      }catch(error){results.push({id,logged:false,error:String(error?.message||error).slice(0,200)});}
    }
    return{accounts:results};
  });
  handler('desktop:reload-view',async()=>{if(!activeView||!activeView.webContents||activeView.webContents.isDestroyed())throw new Error('服务登录页面尚未打开。');activeView.__superTranslateReady=false;activeView.setVisible(false);serviceViewStatus('loading',{account:activeView.stAccountId,platform:activeView.stPlatform,message:`正在重新加载 ${PLATFORM_REGISTRY[activeView.stPlatform]?.name||'服务'} 登录页面…`});activeView.webContents.reload();return{ok:true};});
  handler('desktop:remove-account',input=>destroyView(input?.id,input?.clearPartition===true));
  handler('desktop:bounds',bounds=>{if(activeView)activeView.setBounds(boundedBounds(bounds));return{ok:true};});handler('desktop:visibility',visible=>{if(activeView)activeView.setVisible(!!visible);return{ok:true};});
  handler('desktop:identify-phone',()=>requestView('identify-phone'));
  handler('desktop:profiles',items=>{if(!Array.isArray(items)||items.length>5000)throw new Error('备注数量无效');return requestView('profiles',{profiles:items.map(i=>({hash:String(i.hash||'').slice(0,64),name:String(i.name||'').slice(0,100),note:String(i.note||'').slice(0,500),country:String(i.country||'').slice(0,60),phone:String(i.phone||'').slice(0,32)}))});});
  handler('desktop:annotate',input=>{if(!activeView?.stKey||activeView.stKey.hash!==input.chat)throw new Error('当前聊天已变化。');return requestView('annotate',{chat:activeView.stKey.raw,annotation:{name:String(input.name||'').slice(0,100),note:String(input.note||'').slice(0,500),country:String(input.country||'').slice(0,60)}});});
  handler('desktop:live-config',cfg=>{currentLiveConfig={incoming:LANGUAGES[cfg.incoming]?cfg.incoming:'zh-CN',outgoing:LANGUAGES[cfg.outgoing]?cfg.outgoing:'en',outgoingLabel:LANGUAGES[cfg.outgoing]||'英语',enabled:cfg.enabled!==false,automatic:!!cfg.automatic,history:!!cfg.history,translateSend:cfg.translateSend!==false,blockChinese:cfg.blockChinese!==false};return requestView('config',{config:{...currentLiveConfig}});});
  handler('desktop:fill',({chat,text})=>{if(currentPlatform==='whatsapp'||currentPlatform==='whatsapp_multi'){if(!activeView?.stKey||activeView.stKey.hash!==chat)throw new Error('当前聊天已变化，已阻止填入。');}requireString(text,6000);return requestView('fill',{chat:activeView?.stKey?.raw||chat,text});});
  ipcMain.handle('desktop:platform-translate',async(e,input)=>{if(!access()||!trustedPlatform(e)||!activeView||activeView.webContents!==e.sender||currentPlatform==='whatsapp'||currentPlatform==='whatsapp_multi')throw new Error('非活动服务页面。');return translate(input);});
  handler('desktop:open-contact',contact=>requestView('open-contact',{contact:String(contact||'').slice(0,200)}));
  handler('desktop:send-current',()=>requestView('send'));
  handler('desktop:export',async data=>{if(!data||typeof data!=='object'||JSON.stringify(data).length>500000)throw new Error('备注数据过大或无效。');if(activeView)activeView.setVisible(false);try{const result=await dialog.showSaveDialog(win,{title:'导出本地客户备注',defaultPath:'超级翻译-客户备注.json',filters:[{name:'JSON',extensions:['json']}]});if(result.canceled)return{cancelled:true};fs.writeFileSync(result.filePath,JSON.stringify({version:1,contacts:data},null,2),'utf8');return{ok:true};}finally{if(activeView)activeView.setVisible(true);}});
  ipcMain.on('wa:response',(e,r)=>{const p=pending.get(r?.id);if(!p||p.channel!=='wa'||p.wc!==e.sender||!trustedWA(e))return;clearTimeout(p.timer);pending.delete(r.id);r.ok?p.resolve(r.data||{ok:true}):p.reject(new Error(String(r.error||'操作未完成').slice(0,300)));});
  ipcMain.on('platform:response',(e,r)=>{const p=pending.get(r?.id);if(!p||p.channel!=='platform'||p.wc!==e.sender||!trustedPlatform(e))return;clearTimeout(p.timer);pending.delete(r.id);r.ok?p.resolve(r.data||{ok:true}):p.reject(new Error(String(r.error||'操作未完成').slice(0,300)));});
  ipcMain.on('platform:new-message',(e,payload)=>{
    if(!activeView||e.sender!==activeView.webContents||!trustedPlatform(e)||!enabled||!win||!payload||typeof payload!=='object')return;
    const sender=String(payload.sender||'').slice(0,160),content=String(payload.content||'').slice(0,500);if(!sender&&!content)return;
    win.webContents.send('desktop:account-message',{account:activeView.stAccountId||currentAccount,sender,content});
  });
  ipcMain.on('platform:incoming-message',(e,payload)=>{
    if(!activeView||e.sender!==activeView.webContents||!trustedPlatform(e)||!enabled||!win||!payload||typeof payload!=='object')return;
    const text=String(payload.text||'').slice(0,2000);if(!text)return;
    win.webContents.send('desktop:incoming-message',{account:activeView.stAccountId||currentAccount,platform:currentPlatform,chat:String(payload.chat||''),title:String(payload.title||'').slice(0,160),text});
  });
  ipcMain.on('wa:incoming-message',(e,payload)=>{
    if(!activeView||e.sender!==activeView.webContents||!trustedWA(e)||!enabled||!win||!payload||typeof payload!=='object')return;
    const text=String(payload.text||'').slice(0,2000);if(!text)return;
    win.webContents.send('desktop:incoming-message',{account:activeView.stAccountId||currentAccount,platform:currentPlatform,chat:String(payload.chat||''),title:String(payload.title||'').slice(0,160),text});
  });
  ipcMain.on('platform:snapshot',(e,snapshot)=>{if(!activeView||e.sender!==activeView.webContents||!trustedPlatform(e)||!enabled||!win||!snapshot||typeof snapshot.title!=='string')return;const raw=String(snapshot.key||snapshot.title).slice(0,300),connected=!!snapshot.connected&&!!raw,key=connected?crypto.createHash('sha256').update(currentAccount+'\0'+raw).digest('hex'):'';activeView.stKey=connected?{raw,hash:key}:null;const phone=phoneInfo(snapshot.phone||'');win.webContents.send('desktop:snapshot',{key,title:connected?snapshot.title.slice(0,150):'',phone:phone.number,country:phone.country?phone.label:'',language:'en',group:!!snapshot.group,messages:Number(snapshot.messages)||0,connected,platform:currentPlatform,countryCode:phone.country||'',historyActive:false,translationEnabled:true,translationPaused:false,translated:0,pending:0});});
  ipcMain.on('platform:composer-preview',(e,payload)=>{if(!activeView||e.sender!==activeView.webContents||!trustedPlatform(e)||!enabled||!win||!payload||typeof payload!=='object')return;const raw=typeof payload.chat==='string'?payload.chat.slice(0,300):'',key=raw?crypto.createHash('sha256').update(currentAccount+'\0'+raw).digest('hex'):'';const allowed=new Set(['idle','waiting','translating','ready','replacing','sending','sent','blocked','error']),status=allowed.has(payload.status)?payload.status:'idle';win.webContents.send('desktop:live-preview',{chat:key,status,original:String(payload.original||'').slice(0,6000),translation:String(payload.translation||'').slice(0,6000),error:String(payload.error||'').slice(0,300),target:LANGUAGES[payload.target]?payload.target:'en',targetLabel:String(payload.targetLabel||LANGUAGES[payload.target]||'英语').slice(0,40),hasChinese:!!payload.hasChinese});});
  ipcMain.on('wa:snapshot',(e,snapshot)=>{if(!activeView||e.sender!==activeView.webContents||!trustedWA(e)||!enabled||!win||!snapshot||typeof snapshot.title!=='string')return;const phone=phoneInfo(snapshot.phone||'');const key=snapshot.key?crypto.createHash('sha256').update(currentAccount+'\0'+snapshot.key).digest('hex'):'';activeView.stKey={raw:snapshot.key||'',hash:key};win.webContents.send('desktop:snapshot',{key,title:snapshot.title.slice(0,150),phone:phone.number,country:phone.country?phone.label:'',language:phone.language||'en',group:!!snapshot.group,messages:Number(snapshot.messages)||0,connected:!!snapshot.connected,countryCode:phone.country||'',historyActive:!!snapshot.historyActive,translationEnabled:snapshot.translationEnabled!==false,translationPaused:!!snapshot.translationPaused,translated:Number(snapshot.translated)||0,pending:Number(snapshot.pending)||0});});
  ipcMain.on('wa:composer-preview',(e,payload)=>{
    if(!activeView||e.sender!==activeView.webContents||!trustedWA(e)||!enabled||!win||!payload||typeof payload!=='object')return;
    const rawChat=typeof payload.chat==='string'?payload.chat.slice(0,300):'',key=rawChat?crypto.createHash('sha256').update(currentAccount+'\0'+rawChat).digest('hex'):'';
    const allowed=new Set(['idle','waiting','translating','ready','replacing','sending','sent','blocked','error']),status=allowed.has(payload.status)?payload.status:'idle';
    win.webContents.send('desktop:live-preview',{chat:key,status,original:String(payload.original||'').slice(0,6000),translation:String(payload.translation||'').slice(0,6000),error:String(payload.error||'').slice(0,300),target:LANGUAGES[payload.target]?payload.target:'en',targetLabel:String(payload.targetLabel||LANGUAGES[payload.target]||'英语').slice(0,40),hasChinese:!!payload.hasChinese});
  });
  // Native insertion fallback for WhatsApp builds whose controlled editor
  // ignores or immediately reverts document.execCommand('insertText'). The
  // request can only come from the active WhatsApp WebContentsView and the
  // supplied chat key is checked against the last runtime snapshot when one
  // is available. The preload still verifies the DOM before any send.
  ipcMain.handle('wa:insert-text',async(e,input)=>{
    if(!access()||!trustedWA(e)||!activeView||activeView.webContents!==e.sender)throw new Error('非活动 WhatsApp 页面。');
    // The translated text may legitimately contain Han characters (Chinese
    // targets and Japanese both do).  The renderer verifies exact, stable DOM
    // replacement before sending, so do not infer safety from a script range.
    const text=requireString(input?.text,6000);
    const chatKey=typeof input?.chat==='string'?input.chat:'';if(chatKey&&activeView.stKey?.raw&&activeView.stKey.raw!==chatKey)throw new Error('聊天已变化，已拒绝原生插入。');
    if(typeof e.sender.insertText!=='function')throw new Error('当前 Electron 版本不支持原生文本插入。');
    await e.sender.insertText(text);return{ok:true};
  });
  ipcMain.handle('wa:voice-cache-get',async(e,input)=>{
    if(!access()||!trustedWA(e)||!activeView||activeView.webContents!==e.sender)throw new Error('非活动 WhatsApp 页面。');
    const location=incomingVoiceLocation(input),cached=voiceCacheLookup(location);
    return cached?{...cached}:{transcript:'',translation:'',language:'auto'};
  });
  ipcMain.handle('wa:speech-transcribe',async(e,input)=>{
    if(!access()||!trustedWA(e)||!activeView||activeView.webContents!==e.sender)throw new Error('非活动 WhatsApp 页面。');
    const location=incomingVoiceLocation(input),cached=voiceCacheLookup(location);
    if(cached?.transcript)return{...cached,cached:true};
    if(incomingVoiceJobs.has(location.key))return incomingVoiceJobs.get(location.key);
    const job=(async()=>{
      const entitlement=await authorizeSpeech();
      const result=await speechRuntime.transcribe({audio:input?.audio,engine:entitlement.engine,tier:entitlement.speechTier},db.get().settings.asrModel);
      incomingVoiceLocation(input);
      const value={transcript:String(result.text||'').slice(0,6000),translation:'',language:String(result.language||'auto').slice(0,20),engine:String(result.engine||entitlement.engine).slice(0,30),tier:normalizeSpeechTier(result.tier,entitlement.speechTier),model:String(result.model||entitlement.model||'').slice(0,100),updatedAt:Date.now()};
      incomingVoiceCache.set(location.key,value);saveIncomingVoiceCache();return{...value,cached:false};
    })().finally(()=>incomingVoiceJobs.delete(location.key));
    incomingVoiceJobs.set(location.key,job);return job;
  });
  ipcMain.handle('wa:voice-cache-save',async(e,input)=>{
    if(!access()||!trustedWA(e)||!activeView||activeView.webContents!==e.sender)throw new Error('非活动 WhatsApp 页面。');
    const location=incomingVoiceLocation(input),transcript=requireString(input?.transcript,6000),translation=requireString(input?.translation,6000);
    const previous=voiceCacheLookup(location)||{},value={...previous,transcript,translation,language:String(input?.language||'auto').slice(0,20),updatedAt:Date.now()};
    incomingVoiceCache.set(location.key,value);saveIncomingVoiceCache();return{ok:true};
  });
  ipcMain.handle('wa:translate',async(e,input)=>{if(!access()||!trustedWA(e)||!activeView||activeView.webContents!==e.sender)throw new Error('非活动 WhatsApp 页面。');return translate(input);});
  create();app.on('activate',()=>{if(!BrowserWindow.getAllWindows().length)create();});
  if(process.env.ST_TELEGRAM_PILOT==='1'){
    const logFile=path.join(app.getPath('userData'),'telegram-pilot.log');
    const log=message=>{try{fs.appendFileSync(logFile,new Date().toISOString()+' '+message+'\n');}catch{}};
    const pilot=new BrowserWindow({width:1280,height:900,title:'Telegram 适配器试点',webPreferences:{preload:path.join(__dirname,'integrations','telegram-pilot-preload.js'),contextIsolation:true,nodeIntegration:false,sandbox:false,webSecurity:true}});
    views.set('pilot-tg',{webContents:pilot.webContents,stPlatform:'telegram'});
    pilot.webContents.on('console-message',(_event,level,message,line,source)=>{log(`[console:${level}] ${source}:${line} ${message}`);});
    pilot.webContents.on('did-fail-load',(_event,code,description,url,isMainFrame)=>{if(isMainFrame)log(`[fail] ${code} ${description} ${url}`);});
    pilot.webContents.on('render-process-gone',(_event,details)=>log('[gone] '+JSON.stringify(details)));
    pilot.webContents.on('did-finish-load',async()=>{try{const info=await pilot.webContents.executeJavaScript("({tg:typeof window.__scrm_tg,ipc:typeof window.__scrm_ipc,fp:typeof window.__scrm_fp,cache:typeof window.__scrm_cache,adapter:window.__scrm_pilot_loaded===true})");log('[bridge] '+JSON.stringify(info));const echo=await pilot.webContents.executeJavaScript("window.__scrm_tg.exec('pilot-tg','1+1')");log('[exec] '+JSON.stringify(echo));}catch(error){log('[bridge-error] '+String(error?.message||error));}});
    pilot.loadURL('https://web.telegram.org/k/').then(()=>log('[loaded] https://web.telegram.org/k/')).catch(error=>log('[load-error] '+String(error?.message||error)));
  }
  if(process.env.ST_AUTOLOGIN_SAVED==='1'){
    const savedList=loginPreferences.list();
    const savedId=savedList?.selectedId||savedList?.accounts?.[0]?.id;
    const saved=savedId?loginPreferences.get(savedId):null;
    if(saved?.username&&saved?.password){
      loginAccount({username:saved.username,password:saved.password,accountType:saved.accountType}).then(()=>{loginTransition=true;showWorkbench();setTimeout(()=>{try{win?.webContents.executeJavaScript("document.querySelector('[data-tool=\\\"ai-replies\\\"]')?.click()",true);}catch{}},1600);}).catch(error=>console.error('[saved-login]',error));
    }
  }
});
app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit();});
app.on('before-quit',()=>{stopCustomerHeartbeat();stopLocalChild(false);speechRuntime?.stop();for(const p of pending.values()){clearTimeout(p.timer);p.reject(new Error('软件正在关闭。'));}pending.clear();});

