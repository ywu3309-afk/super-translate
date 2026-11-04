'use strict';
importScripts('core.js','cloud-config.js','cloud-client.js');
const cloud=STCloudClient.create(ST_CLOUD_ORIGIN),inflight=new Map();
let lifecycle=0,loginBusy=false,heartbeatBusy=false,active=0,queueSequence=0;
let storageTail=Promise.resolve();
// Translation jobs share one provider/account quota, but foreground WhatsApp
// sends must always jump ahead of background page/subtitle work.  The queue
// remains intentionally small and in-memory; page text is never persisted.
const queue=[];
// A session-scoped capability is issued only after the user presses the
// explicit "翻译当前网页" button.  It prevents an arbitrary injected page
// from turning the extension into a general cloud proxy.
const webSessions=new Map();
const WEB_SESSION_TTL=30*60*1000;
const WEB_NONCE_RE=/^[A-Za-z0-9_-]{24,128}$/;
const serialStore=job=>{const result=storageTail.then(job);storageTail=result.catch(()=>{});return result;};
const ready=(async()=>{
  await chrome.storage.local.setAccessLevel({accessLevel:'TRUSTED_CONTEXTS'});
  await chrome.storage.session.setAccessLevel({accessLevel:'TRUSTED_CONTEXTS'});
  const current=await chrome.storage.local.get(['settings','deviceId']);
  if(!(await chrome.storage.session.get('cloudSession')).cloudSession)current.settings={...current.settings,enabled:false,auto:false};
  await chrome.storage.local.set({settings:WATCore.normalizeSettings(current.settings),deviceId:/^[a-f0-9]{64}$/.test(current.deviceId||'')?current.deviceId:Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('')});
  await chrome.storage.session.remove(['deeplKey','deepseekKey']);
  await chrome.storage.local.remove(['deeplKey','deepseekKey']);
  await loadWebSessions();
})();
function senderKind(sender) {
  if(sender.id!==chrome.runtime.id)return'';
  try {
    const url=new URL(sender.url);
    if(url.protocol==='chrome-extension:'&&url.hostname===chrome.runtime.id&&url.pathname==='/popup.html')return'ui';
    if(url.origin==='https://web.whatsapp.com'&&sender.tab&&sender.frameId===0)return'wa';
    // Generic-page requests are accepted only from a top-level HTTP(S) tab.
    // The active-tab capability nonce is checked asynchronously before any
    // cloud translation is allowed (see validateWebSender below).
    if((url.protocol==='https:'||url.protocol==='http:')&&sender.tab&&sender.frameId===0&&url.hostname!=='web.whatsapp.com'&&!url.hostname.endsWith('.whatsapp.com'))return'web';
  }catch{}
  return'';
}
const session=async()=> (await chrome.storage.session.get('cloudSession')).cloudSession||null;
const settings=async()=> WATCore.normalizeSettings((await chrome.storage.local.get('settings')).settings);
const webTarget=value=>typeof value==='string'&&Object.hasOwn(WATCore.languages,value) ? value : null;
function cleanWebSettings(raw={}) {
  const target=webTarget(raw.target)||'en';
  return {target,mode:raw.mode==='replace'?'replace':'bilingual',dynamic:raw.dynamic!==false,subtitles:raw.subtitles===true,showToolbar:raw.showToolbar!==false};
}
function mergeWebSettings(previous={},patch={}) {
  return cleanWebSettings({...previous,...(patch&&typeof patch==='object'?patch:{})});
}
function validWebUrl(raw) {
  try {
    const url=new URL(String(raw||''));
    return (url.protocol==='https:'||url.protocol==='http:')&&!url.username&&!url.password&&url.hostname!=='web.whatsapp.com'&&!url.hostname.endsWith('.whatsapp.com');
  } catch { return false; }
}
function newWebNonce() {
  const bytes=new Uint8Array(24);crypto.getRandomValues(bytes);
  return Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
}
async function persistWebSessions() {
  const serial={};
  for(const [tabId,record] of webSessions)serial[String(tabId)]={...record};
  await chrome.storage.session.set({webSessions:serial});
}
async function loadWebSessions() {
  try {
    const stored=(await chrome.storage.session.get('webSessions')).webSessions||{};
    for(const [tabId,record] of Object.entries(stored)){
      if(!record||!WEB_NONCE_RE.test(String(record.nonce||''))||!validWebUrl(record.url)||Number(record.expiresAt||0)<=Date.now())continue;
      webSessions.set(String(tabId),{...record,tabId:String(tabId)});
    }
  } catch {}
}
async function getWebSession(tabId) {
  const key=String(tabId),cached=webSessions.get(key);
  if(cached&&cached.expiresAt>Date.now())return cached;
  if(cached){webSessions.delete(key);persistWebSessions().catch(()=>{});}
  try {
    const stored=(await chrome.storage.session.get('webSessions')).webSessions||{},record=stored[key];
    if(record&&record.expiresAt>Date.now()&&WEB_NONCE_RE.test(String(record.nonce||''))&&validWebUrl(record.url)){const normalized={...record,tabId:key};webSessions.set(key,normalized);return normalized;}
  } catch {}
  return null;
}
async function clearWebSession(tabId,notifyPage=false) {
  const key=String(tabId),record=webSessions.get(key)||await getWebSession(key);
  if(notifyPage&&record&&chrome.tabs?.sendMessage){try{await chrome.tabs.sendMessage(Number(tabId),{type:'WEB_STOP',version:1,nonce:record.nonce},{frameId:0});}catch{}}
  webSessions.delete(key);await persistWebSessions();
}
async function clearWebSessionIfNonce(tabId,nonce) {
  const key=String(tabId),record=await getWebSession(key);
  if(!record||record.nonce!==nonce)return false;
  webSessions.delete(key);await persistWebSessions();return true;
}
async function validateWebSender(sender,msg) {
  if(!sender?.tab||sender.frameId!==0||!Number.isInteger(sender.tab.id))throw new Error('不允许的网页调用来源。');
  if(!validWebUrl(sender.url))throw new Error('当前网页不支持通用翻译。');
  const record=await getWebSession(sender.tab.id);
  if(!record||typeof msg?.webNonce!=='string'||msg.webNonce!==record.nonce)throw new Error('网页翻译授权已失效，请从插件菜单重新启用。');
  let origin='';try{origin=new URL(sender.url).origin;}catch{}
  if(origin!==record.origin||String(sender.url||'')!==record.url)throw new Error('网页已跳转，旧翻译任务已取消。');
  return record;
}
async function activeWebTab() {
  if(!chrome.tabs?.query)throw new Error('当前浏览器不支持网页翻译。');
  const queried=await chrome.tabs.query({active:true,lastFocusedWindow:true}),tab=queried?.[0];
  if(!tab||!Number.isInteger(tab.id)||!validWebUrl(tab.url))throw new Error('请先打开一个普通 HTTP(S) 网页，再点击“翻译当前网页”。');
  return tab;
}
function cleanAccount(raw) {
  const count=v=>v===null?null:Number.isSafeInteger(v)&&v>=0?v:0;
  return {id:String(raw.id||'').slice(0,100),username:String(raw.username||'').slice(0,40),quota:count(raw.quota),used:count(raw.used),allocatedQuota:count(raw.allocatedQuota),plan:String(raw.plan||'未配置').slice(0,50),expires:raw.expires?String(raw.expires).slice(0,10):null,speechTier:['basic','advanced','flagship'].includes(raw.speechTier)?raw.speechTier:'basic',parentId:raw.parentId?String(raw.parentId).slice(0,100):null,role:raw.parentId?'子账号':'主账号'};
}
async function status(kind) {
  const [auth,prefs,local]=await Promise.all([session(),settings(),chrome.storage.local.get('lastUsername')]);
  return {ok:true,version:chrome.runtime.getManifest().version,settings:{...prefs,enabled:!!auth&&prefs.enabled,accountRevision:auth?.id||'signed-out'},authenticated:!!auth,...(kind==='ui'?{account:auth?cleanAccount(auth.account):null,lastUsername:String(local.lastUsername||'').slice(0,40),heartbeatStatus:auth?.heartbeatStatus||'',cloudOrigin:ST_CLOUD_ORIGIN}:{})};
}
async function current(auth) {return auth&&(await session())?.id===auth.id;}
async function updateSession(auth,patch) {
  return serialStore(async()=>{const stored=await session();if(!stored||stored.id!==auth.id)return false;await chrome.storage.session.set({cloudSession:{...stored,...patch}});return true;});
}
async function endSession(id) {
  let tabs=[],ended=false;
  await serialStore(async()=>{const stored=await session();if(id&&stored?.id!==id)return;tabs=[...webSessions.values()].map(record=>({tabId:record.tabId,nonce:record.nonce}));ended=true;await chrome.storage.session.remove(['cloudSession','sendTickets','webSessions']);webSessions.clear();await chrome.alarms.clear('cloud-heartbeat');const prefs=await settings();await chrome.storage.local.set({settings:{...prefs,enabled:false,auto:false}});});
  if(ended)for(const record of tabs)if(chrome.tabs?.sendMessage)try{await chrome.tabs.sendMessage(Number(record.tabId),{type:'WEB_STOP',version:1,nonce:record.nonce},{frameId:0});}catch{}
}
async function stopAllWebSessions() {
  const records=[...webSessions.values()].map(record=>({tabId:record.tabId,nonce:record.nonce}));
  webSessions.clear();await chrome.storage.session.remove('webSessions');
  for(const record of records)if(chrome.tabs?.sendMessage)try{await chrome.tabs.sendMessage(Number(record.tabId),{type:'WEB_STOP',version:1,nonce:record.nonce},{frameId:0});}catch{}
}
async function requireAuth() {const auth=await session();if(!auth)throw new Error('请先打开插件设置，登录超级翻译客户账号。');return auth;}
async function accountRequest(auth,path,options) {
  try {
    const result=await cloud.request(path,{...options,token:auth.token});
    if(!await current(auth))throw new Error('账号已切换或退出，旧请求结果已丢弃。');
    return result;
  }catch(error){if(error.status===401||['disabled','expired'].includes(error.code))await endSession(auth.id);throw error;}
}
async function heartbeatPayload() {
  const {deviceId}=await chrome.storage.local.get('deviceId');
  return {deviceId,hostname:'浏览器扩展',platform:/Edg\//.test(navigator.userAgent)?'edge-extension':'chrome-extension',arch:'',cpu:'',gpu:'',appVersion:chrome.runtime.getManifest().version,modelStatus:'unavailable',modelRuntime:'cloud-api',modelLatencyMs:null};
}
async function heartbeat(force=false) {
  await ready;const auth=await session();if(!auth||heartbeatBusy||!force&&(auth.nextHeartbeatAt||0)>Date.now())return;
  heartbeatBusy=true;
  try{await accountRequest(auth,'/api/customer-heartbeat',{body:await heartbeatPayload()});await updateSession(auth,{heartbeatStatus:'已上报',heartbeatFailures:0,nextHeartbeatAt:Date.now()+55000});}
  catch(error){const failures=(auth.heartbeatFailures||0)+1;await updateSession(auth,{heartbeatStatus:error.message,heartbeatFailures:failures,nextHeartbeatAt:Date.now()+Math.min(15,2**Math.min(failures,4))*60000});if(force)throw error;}
  finally{heartbeatBusy=false;}
}
chrome.alarms.onAlarm.addListener(alarm=>{if(alarm.name==='cloud-heartbeat')heartbeat().catch(()=>{});});
chrome.tabs?.onUpdated?.addListener((tabId,changeInfo)=>{
  if(!changeInfo.url)return;
  (async()=>{await ready;const record=await getWebSession(tabId);if(record&&changeInfo.url!==record.url)await clearWebSession(tabId,true);})().catch(()=>{});
});
chrome.tabs?.onRemoved?.addListener(tabId=>{(async()=>{await ready;if(await getWebSession(tabId))await clearWebSession(tabId,false);})().catch(()=>{});});
async function login(msg) {
  if(loginBusy)throw new Error('正在登录，请稍候。');
  if(await session())throw new Error('请先退出当前账号，再登录其他账号。');
  const username=typeof msg.username==='string'?msg.username.trim():'',password=msg.password;
  if(!/^[A-Za-z0-9_]{3,40}$/.test(username)||typeof password!=='string'||password.length<8||password.length>128)throw new Error('请输入客户账号和 8–128 位密码。');
  loginBusy=true;const revision=++lifecycle;
  try{
    const response=await cloud.request('/api/customer-login',{body:{username,password}});
    if(typeof response.token!=='string'||response.token.length<20||response.token.length>4096||!response.customer?.id||response.customer.status!=='active')throw new STCloudClient.CloudError('invalid_response');
    if(revision!==lifecycle)throw new Error('登录已取消。');
    await cloud.request('/api/customer-heartbeat',{token:response.token,body:await heartbeatPayload()});
    await serialStore(async()=>{
      if(revision!==lifecycle)throw new Error('登录已取消。');
      await chrome.storage.session.set({cloudSession:{id:crypto.randomUUID(),token:response.token,account:cleanAccount(response.customer),heartbeatStatus:'已上报',heartbeatFailures:0,nextHeartbeatAt:Date.now()+55000}});
      await chrome.storage.local.set({lastUsername:msg.rememberUsername===true?username:''});
      await chrome.alarms.create('cloud-heartbeat',{periodInMinutes:1});
    });
    return status('ui');
  }finally{loginBusy=false;}
}
async function refresh() {
  const auth=await requireAuth();await heartbeat(true);
  const usage=await accountRequest(auth,'/api/customer-usage');
  await updateSession(auth,{account:cleanAccount({...auth.account,...usage})});return status('ui');
}
async function limited(job,priority=50) {
  priority=Number(priority)||0;
  if(queue.length>=80){
    const lowest=queue.at(-1);
    if(!lowest||priority<=lowest.priority)throw new Error('翻译队列已满，请稍后重试。');
    queue.pop().reject(new Error('后台网页翻译已暂停，以优先处理客服发送。'));
  }
  if(active>=1){
    await new Promise((resolve,reject)=>{
      queue.push({resolve,reject,priority,order:++queueSequence});
      queue.sort((a,b)=>b.priority-a.priority||a.order-b.order);
    });
  }else active++;
  try{return await job();}finally{const next=queue.shift();if(next)next.resolve();else active--;}
}
async function translate(msg,kind='wa') {
  const auth=await requireAuth(),prefs=await settings();
  if(!prefs.enabled)throw new Error('请先在插件设置中启用云端翻译。');
  if(typeof msg.text!=='string'||!msg.text.trim()||msg.text.length>3500||!Object.hasOwn(WATCore.targets,msg.target))throw new Error('请输入 1–3500 个字符，并选择支持的目标语言。');
  if(msg.context!==undefined&&(!Array.isArray(msg.context)||msg.context.length))throw new Error('当前云端路线不附带聊天上下文，请关闭上下文选项。');
  const protectedText=WATCore.protect(msg.text.trim());if(protectedText.text.length>3500)throw new Error('保护链接与数字后的文字超过云端限制，请分段翻译。');
  const compose=msg.purpose==='compose';
  if(compose&&(!prefs.autoSend||!/^[-a-zA-Z0-9]{10,80}$/.test(msg.draftId||'')))throw new Error('请启用发送前自动翻译。');
  const key=JSON.stringify([auth.id,msg.text,msg.target,compose?msg.draftId:'manual']);if(inflight.has(key))return inflight.get(key);
  const priority=compose?100:kind==='wa'?70:50;
  const promise=limited(async()=>{
    if(!await current(auth)||(await settings()).enabled!==true)throw new Error('账号或设置已变化，待处理翻译已取消。');
    const result=await accountRequest(auth,'/api/translate',{body:{text:protectedText.text,target_lang:WATCore.targets[msg.target]}});
    if(typeof result.translation!=='string'||result.translation.length>30000)throw new STCloudClient.CloudError('invalid_response');
    await updateSession(auth,{account:cleanAccount({...auth.account,quota:result.quota,used:result.used})});
    if(!await current(auth)||(await settings()).enabled!==true)throw new Error('账号或设置已变化，旧译文已丢弃。已提交的请求可能已扣费，请刷新额度。');
    const translation=WATCore.restore(result.translation,protectedText.values);
    let sendTicket;
    if(compose){sendTicket=crypto.randomUUID();await serialStore(async()=>{if(!await current(auth))throw new Error('登录已改变。');const {sendTickets={}}=await chrome.storage.session.get('sendTickets');const entries=Object.entries(sendTickets).filter(([,v])=>v.expires>Date.now()).slice(-19);entries.push([sendTicket,{session:auth.id,draftId:msg.draftId,target:msg.target,expires:Date.now()+120000}]);await chrome.storage.session.set({sendTickets:Object.fromEntries(entries)});});}
    return {ok:true,translation,engine:'cloud',notes:[],cautions:WATCore.inspectText(msg.text),detected:'auto',charged:Number(result.charged)||0,...(sendTicket?{sendTicket}:{})};
  },priority);
  inflight.set(key,promise);try{return await promise;}finally{inflight.delete(key);}
}
async function webTranslate(msg,sender) {
  const record=await validateWebSender(sender,msg),auth=await requireAuth(),prefs=await settings();
  if(!prefs.enabled)throw new Error('请先在插件设置中启用云端翻译。');
  if(msg?.version!==1||typeof msg.jobId!=='string'||!/^[A-Za-z0-9_-]{8,128}$/.test(msg.jobId))throw new Error('网页翻译任务标识无效。');
  if(!['page','selection','subtitle'].includes(msg.scope))throw new Error('不支持的网页翻译范围。');
  if(typeof msg.text!=='string'||!msg.text.trim()||msg.text.length>3000)throw new Error('网页文字需为 1–3000 个字符。');
  const target=webTarget(msg.target);if(!target)throw new Error('不支持的网页目标语言。');
  // Recheck navigation and the capability immediately before the provider
  // request.  A late response is also discarded by validateWebSender below.
  if(record.expiresAt<=Date.now())throw new Error('网页翻译授权已过期，请重新启用。');
  const protectedText=WATCore.protect(msg.text.trim());
  if(protectedText.text.length>3500)throw new Error('保护链接与数字后的文字超过云端限制，请分段翻译。');
  const key=JSON.stringify([auth.id,'web',record.tabId,record.nonce,msg.scope,msg.text,target]);
  if(inflight.has(key))return inflight.get(key);
  const priority=msg.scope==='subtitle'?35:msg.scope==='selection'?30:10;
  const promise=limited(async()=>{
    if(!await current(auth)||(await settings()).enabled!==true)throw new Error('账号或设置已变化，待处理翻译已取消。');
    await validateWebSender(sender,msg);
    const result=await accountRequest(auth,'/api/translate',{body:{text:protectedText.text,target_lang:WATCore.targets[target]}});
    if(typeof result.translation!=='string'||result.translation.length>30000)throw new STCloudClient.CloudError('invalid_response');
    await updateSession(auth,{account:cleanAccount({...auth.account,quota:result.quota,used:result.used})});
    await validateWebSender(sender,msg);
    return {ok:true,jobId:msg.jobId,translation:WATCore.restore(result.translation,protectedText.values),engine:'cloud',charged:Number(result.charged)||0,quota:result.quota,used:result.used};
  },priority);
  inflight.set(key,promise);try{return await promise;}finally{inflight.delete(key);}
}
async function injectWebTab(tab,rawSettings={}) {
  await requireAuth();const prefs=await settings();if(!prefs.enabled)throw new Error('请先启用云端翻译并保存设置。');
  const key=String(tab.id),url=new URL(tab.url);
  let record=await getWebSession(tab.id);
  const reusable=!!record&&record.url===tab.url&&record.origin===url.origin;
  if(record&&!reusable){await clearWebSession(tab.id,true);record=null;}
  const config=cleanWebSettings(rawSettings);
  record=reusable
    ?{...record,settings:config,expiresAt:Date.now()+WEB_SESSION_TTL}
    :{tabId:key,nonce:newWebNonce(),origin:url.origin,url:tab.url,settings:config,expiresAt:Date.now()+WEB_SESSION_TTL};
  webSessions.set(key,record);await persistWebSessions();
  const configure=type=>chrome.tabs.sendMessage(tab.id,{type,version:1,nonce:record.nonce,settings:{...config,enabled:true,webNonce:record.nonce}},{frameId:0});
  try {
    // A repeated start (including after an MV3 worker restart) must keep the
    // page's existing nonce.  Try the already-injected controller first so a
    // transient popup status failure cannot strand the old page capability.
    if(reusable){
      try{
        const response=await configure('WEB_CONFIGURE');
        if(response?.ok)return {ok:true,tabId:tab.id,url:tab.url,status:response,settings:config};
      }catch{}
    }
    await chrome.scripting.insertCSS({target:{tabId:tab.id,frameIds:[0]},files:['web.css']});
    await chrome.scripting.executeScript({target:{tabId:tab.id,frameIds:[0]},files:['web-subtitles.js','web-content.js']});
    let response=await configure(reusable?'WEB_CONFIGURE':'WEB_REKEY');
    // Storage is authoritative after a worker restart.  If an injected page
    // somehow retained a different old nonce, explicitly stop that local
    // state and atomically adopt the stored nonce rather than minting again.
    if(reusable&&!response?.ok)response=await configure('WEB_REKEY');
    if(!response?.ok)throw new Error(response?.error||'网页翻译脚本未响应。');
    return {ok:true,tabId:tab.id,url:tab.url,status:response,settings:config};
  } catch(error) {
    // Never let a stale failed start delete a newer capability.  Existing
    // reusable records are retained so a short-lived receiver failure can be
    // retried with the same nonce and without orphaning the active page.
    if(!reusable)await clearWebSessionIfNonce(tab.id,record.nonce);throw error;
  }
}
async function webAction(msg) {
  const action=String(msg?.action||'');
  const tab=await activeWebTab();
  if(action==='start')return injectWebTab(tab,msg.settings);
  const record=await getWebSession(tab.id);
  if(action==='status'){
    if(!record)return {ok:true,tabId:tab.id,url:tab.url,active:false};
    if(tab.url!==record.url){await clearWebSession(tab.id,true);return {ok:true,tabId:tab.id,url:tab.url,active:false};}
    try{const response=await chrome.tabs.sendMessage(tab.id,{type:'WEB_STATUS',version:1,nonce:record.nonce},{frameId:0});return {ok:true,tabId:tab.id,url:tab.url,active:response?.enabled===true,status:response,settings:record.settings};}
    catch{return {ok:true,tabId:tab.id,url:tab.url,active:false,settings:record.settings};}
  }
  if(action==='stop'){await clearWebSession(tab.id,true);return {ok:true,tabId:tab.id,url:tab.url,active:false};}
  if(action==='configure'){
    if(!record)throw new Error('请先点击“翻译当前网页”。');
    if(tab.url!==record.url){await clearWebSession(tab.id,true);throw new Error('网页已跳转，请重新点击“翻译当前网页”。');}
    const next=mergeWebSettings(record.settings,msg.settings);record.settings=next;record.expiresAt=Date.now()+WEB_SESSION_TTL;await persistWebSessions();
    const response=await chrome.tabs.sendMessage(tab.id,{type:'WEB_CONFIGURE',version:1,nonce:record.nonce,settings:{...next,enabled:true,webNonce:record.nonce}},{frameId:0});
    return {ok:true,tabId:tab.id,url:tab.url,active:true,status:response,settings:next};
  }
  throw new Error('未知网页翻译操作。');
}
// Only language preferences are persisted; chat identifiers are hashed and message text is never stored.
async function chatPreferences(msg,detect=false){
  const auth=await requireAuth();
  if(typeof msg.chatKey!=='string'||!msg.chatKey||msg.chatKey.length>200)throw new Error('当前会话标识尚未确认。');
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(auth.account.id+'\0'+msg.chatKey));
  const key=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
  let detected='';
  if(detect){
    if(typeof msg.text!=='string'||msg.text.length>3500)throw new Error('无法识别该消息语言。');
    const text=msg.text.replace(/https?:\/\/\S+|\S+@\S+|\d+/g,' ').trim();
    if((text.match(/\p{L}/gu)||[]).length>=12){
      const result=await new Promise((resolve,reject)=>chrome.i18n.detectLanguage(text,result=>chrome.runtime.lastError?reject(new Error('语言识别暂不可用。')):resolve(result)));
      const best=result.languages?.[0],code=String(best?.language||'').toLowerCase();
      const language=code==='zh'||code==='zh-cn'?'zh-CN':code==='zh-tw'?'zh-TW':code.split('-')[0];
      if(result.isReliable&&best?.percentage>=70&&Object.hasOwn(WATCore.languages,language))detected=language;
    }
  }
  return serialStore(async()=>{
    if(!await current(auth))throw new Error('登录已改变，已丢弃语言识别结果。');
    const {chatLanguages={}}=await chrome.storage.local.get('chatLanguages');
    const prefs={source:'auto',reply:'default',detected:'',...chatLanguages[key]};
    if(detected)prefs.detected=detected;
    if(msg.patch&&!detect){for(const field of ['source','reply']){const value=msg.patch[field];if(value!==undefined){const valid=Object.hasOwn(WATCore.languages,value)||(field==='source'?value==='auto':['default','follow'].includes(value));if(!valid)throw new Error('不支持的会话语言。');prefs[field]=value;}}}
    if(detected||msg.patch){prefs.updatedAt=Date.now();const entries=Object.entries(chatLanguages).filter(([k])=>k!==key).sort((a,b)=>(a[1].updatedAt||0)-(b[1].updatedAt||0)).slice(-499);entries.push([key,prefs]);await chrome.storage.local.set({chatLanguages:Object.fromEntries(entries)});}
    return {ok:true,prefs,detected};
  });
}
async function authorizeSend(msg){
  const auth=await requireAuth(),prefs=await settings();
  if(!prefs.enabled||!prefs.autoSend||msg.accountRevision!==auth.id)throw new Error('账号或翻译设置已变化，已阻止发送。');
  await serialStore(async()=>{const {sendTickets={}}=await chrome.storage.session.get('sendTickets');const ticket=sendTickets[msg.sendTicket];if(!ticket||ticket.session!==auth.id||ticket.draftId!==msg.draftId||ticket.target!==msg.target||ticket.expires<Date.now())throw new Error('译文发送凭证已失效，请修改原文或重新预览。');delete sendTickets[msg.sendTicket];await chrome.storage.session.set({sendTickets});});
  // Revalidate with the cloud even when reusing an already-paid preview. No second translation / deduction.
  await accountRequest(auth,'/api/customer-heartbeat',{body:await heartbeatPayload()});
  if(!await current(auth))throw new Error('登录已改变，已阻止发送。');
  return status('wa');
}
chrome.runtime.onMessage.addListener((msg,sender,respond)=>{
  const kind=senderKind(sender);
  if(!kind){respond({ok:false,error:'不允许的调用来源。'});return false;}
  (async()=>{
    await ready;
    if(msg?.type==='STATUS')return status(kind);
    if(msg?.type==='OPTIONS'){await chrome.runtime.openOptionsPage();return {ok:true};}
    if(msg?.type==='TRANSLATE'){
      if(kind!=='ui'&&kind!=='wa')throw new Error('网页只能使用受限的网页翻译接口。');
      return translate(msg,kind);
    }
    if(kind==='web'&&msg?.type==='WEB_TRANSLATE_TEXT')return webTranslate(msg,sender);
    if(kind==='web'&&msg?.type==='WEB_REVOKE'){
      await validateWebSender(sender,msg);await clearWebSession(sender.tab.id,false);return {ok:true,active:false};
    }
    if(kind==='web')throw new Error('此网页请求不受支持。');
    if(kind==='wa'&&msg?.type==='CHAT_PREFS')return chatPreferences(msg);
    if(kind==='wa'&&msg?.type==='DETECT_LANGUAGE')return chatPreferences(msg,true);
    if(kind==='wa'&&msg?.type==='AUTHORIZE_SEND')return authorizeSend(msg);
    if(kind!=='ui')throw new Error('此操作只能在插件账号设置页执行。');
    if(msg?.type==='LOGIN')return login(msg);
    if(msg?.type==='LOGOUT'){lifecycle++;await endSession();return status('ui');}
    if(msg?.type==='REFRESH_ACCOUNT')return refresh();
    if(msg?.type==='WEB_ACTION')return webAction(msg);
    if(msg?.type==='SAVE_SETTINGS'){
      const next=WATCore.normalizeSettings({...msg.settings,engine:'cloud'});if(next.enabled)await requireAuth();
      await serialStore(async()=>{if(next.enabled&&!await session())throw new Error('登录已退出，请重新登录。');await chrome.storage.local.set({settings:next});});
      if(!next.enabled)await stopAllWebSessions();return status('ui');
    }
    throw new Error('未知请求。');
  })().then(respond,error=>respond({ok:false,error:error.message||'请求失败。',...(error.code?{code:error.code}:{})}));
  return true;
});
