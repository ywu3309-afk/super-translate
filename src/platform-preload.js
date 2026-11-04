'use strict';
;(function(){
  try{
    const arg=process.argv.find(a=>String(a).startsWith('--st-fingerprint='));
    if(!arg)return;
    const cfg=JSON.parse(decodeURIComponent(escape(atob(String(arg).slice('--st-fingerprint='.length)))));
    if(!cfg||cfg.enabled!==true)return;
    const def=(obj,key,value)=>{try{Object.defineProperty(obj,key,{get:()=>value,configurable:true});}catch{}};
    def(navigator,'webdriver',false);
    if(cfg.platform)def(navigator,'platform',String(cfg.platform));
    if(Array.isArray(cfg.languages)&&cfg.languages.length)def(navigator,'languages',Object.freeze(cfg.languages.map(String)));
    if(Number.isInteger(cfg.hardwareConcurrency)&&cfg.hardwareConcurrency>0)def(navigator,'hardwareConcurrency',cfg.hardwareConcurrency);
    if(cfg.webglVendor||cfg.webglRenderer){
      const patch=proto=>{try{const orig=proto.getParameter;proto.getParameter=function(p){if(p===37445&&cfg.webglVendor)return String(cfg.webglVendor);if(p===37446&&cfg.webglRenderer)return String(cfg.webglRenderer);return orig.call(this,p);};}catch{}};
      if(typeof WebGLRenderingContext!=='undefined')patch(WebGLRenderingContext.prototype);
      if(typeof WebGL2RenderingContext!=='undefined')patch(WebGL2RenderingContext.prototype);
    }
    if(cfg.webrtc==='disable'){try{window.RTCPeerConnection=undefined;window.webkitRTCPeerConnection=undefined;}catch{}}
    if(cfg.width||cfg.height){try{Object.defineProperty(screen,'width',{get:()=>Number(cfg.width)||1920,configurable:true});Object.defineProperty(screen,'height',{get:()=>Number(cfg.height)||1080,configurable:true});Object.defineProperty(screen,'availWidth',{get:()=>Number(cfg.width)||1920,configurable:true});Object.defineProperty(screen,'availHeight',{get:()=>Number(cfg.height)||1080,configurable:true});}catch{}}
    if(Number.isInteger(cfg.memory)&&cfg.memory>0)try{def(navigator,'deviceMemory',cfg.memory);}catch{}
    if(cfg.geo==='block'){try{Object.defineProperty(navigator,'geolocation',{get:()=>({getCurrentPosition:(ok,err)=>err&&err({code:1,message:'User denied Geolocation'}),watchPosition:(ok,err)=>{err&&err({code:1,message:'User denied Geolocation'});return 0;},clearWatch(){}}),configurable:true});}catch{}}
    if(cfg.noise&&cfg.noise.clientRects){try{const orig=Element.prototype.getBoundingClientRect;Element.prototype.getBoundingClientRect=function(){const r=orig.call(this);const n=((this.__stN=(this.__stN||0)+1)%7)*0.01;return {x:r.x+n,y:r.y+n,width:r.width+n,height:r.height+n,top:r.top+n,left:r.left+n,right:r.right+n,bottom:r.bottom+n,toJSON:r.toJSON};};}catch{}}
    if(cfg.noise&&cfg.noise.canvas){try{const orig=HTMLCanvasElement.prototype.toDataURL;HTMLCanvasElement.prototype.toDataURL=function(){try{const ctx=this.getContext('2d');if(ctx&&this.width&&this.height){const d=ctx.getImageData(0,0,1,1);d.data[0]=(d.data[0]+1)&255;ctx.putImageData(d,0,0);}}catch{}return orig.apply(this,arguments);};}catch{}}
    if(cfg.noise&&cfg.noise.audio){try{const orig=AudioBuffer.prototype.getChannelData;AudioBuffer.prototype.getChannelData=function(){const a=orig.call(this,arguments[0]);for(let i=0;i<Math.min(16,a.length);i++)a[i]+=((i%3)-1)*1e-7;return a;};}catch{}}
  }catch{}
})();

// Generic driver for non-WhatsApp services. WhatsApp keeps its own preload
// and its send/intercept implementation is intentionally not touched here.
const {ipcRenderer}=require('electron');
let driver=null,currentPlatform='',config={incoming:'zh-CN',outgoing:'en',outgoingLabel:'英语',enabled:true,automatic:false,history:false,translateSend:true,blockChinese:true};
const openchatSeen=new WeakSet(),incomingSeen=new WeakSet();let incomingArmed=false;
function openchatHidden(text){
  const match=String(text||'').match(/\u2063([\u200b\u200c]+)\u2063/);if(!match)return'';
  const bits=match[1].replace(/\u200b/g,'0').replace(/\u200c/g,'1'),bytes=bits.match(/.{8}/g)||[];
  try{return bytes.map(byte=>String.fromCharCode(parseInt(byte,2))).join('');}catch{return'';}
}
function openchatTail(text){const clean=String(text||'').replace(/[\u200b\u200c\u2063]/g,'').trim();return clean?Array.from(clean).slice(-1).join(''):'';}
let timer=null,task=null,sending=false,state={chat:'',original:'',translation:'',status:'idle'};
let incomingObserver=null,incomingScanTimer=null,incomingActive=0;
const incomingQueue=[],incomingRecords=new WeakMap();
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const chinese=text=>/[\u3400-\u9fff\uf900-\ufaff]/u.test(String(text||''));
const textOf=el=>String(el?.value??el?.innerText??el?.textContent??'').replace(/\u00a0/g,' ').replace(/\s+/g,' ').trim();
const visible=el=>{try{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none';}catch{return false;}};

// Keep the non-WhatsApp notification bridge used by the account unread
// indicator. Only a bounded title/body is forwarded; the main process checks
// the active, allow-listed WebContentsView before displaying it.
try{
  const NativeNotification=globalThis.Notification;
  if(typeof NativeNotification==='function'){
    const ForwardingNotification=function(title,options={}){
      try{ipcRenderer.send('platform:new-message',{sender:String(title||'').slice(0,160),content:String(options?.body||'').slice(0,500),icon:String(options?.icon||'').slice(0,500)});}catch{}
      return new NativeNotification(title,options);
    };
    ForwardingNotification.prototype=NativeNotification.prototype;
    for(const key of ['permission','maxActions']){try{Object.defineProperty(ForwardingNotification,key,{configurable:true,get:()=>NativeNotification[key]});}catch{}}
    if(typeof NativeNotification.requestPermission==='function')ForwardingNotification.requestPermission=(...args)=>NativeNotification.requestPermission(...args);
    globalThis.Notification=ForwardingNotification;
  }
}catch{}

function respond(message,ok=true,data={},error=''){
  if(!message?.id)return;
  ipcRenderer.send('platform:response',{id:String(message.id),ok:!!ok,data:data&&typeof data==='object'?data:{},error:String(error||'').slice(0,300)});
}
function input(){
  const selector=driver?.selectors?.input||'textarea,div[contenteditable="true"]';
  try{return [...document.querySelectorAll(selector)].find(visible)||document.querySelector(selector);}catch{return null;}
}
function contactTitleElement(){
  const selector=driver?.selectors?.contactTitle;if(!selector)return null;
  try{return [...document.querySelectorAll(selector)].find(visible)||document.querySelector(selector);}catch{return null;}
}
function messageContainers(){
  const selector=driver?.selectors?.messages;if(!selector)return [];
  try{
    const all=[...document.querySelectorAll(selector)].filter(visible),set=new Set(all);
    // Some platforms expose both a row and its inner bubble. Keep leaf nodes
    // so the translation card is appended once, never nested twice.
    return all.filter(el=>!all.some(other=>other!==el&&el.contains(other)&&set.has(other))).slice(-120);
  }catch{return [];}
}
function isLoginPage(){
  const title=String(document.title||''),body=String(document.body?.innerText||'').slice(0,3500);
  const loginText=/(?:\blog\s*in\b|\bsign\s*in\b|登录|扫码登录|phone\s*number|enter\s+your\s+phone|create\s+account)/i.test(`${title}\n${body}`);
  // Facebook's home/login markup can expose a generic text input and header
  // span before authentication. A password field plus a login signal is a
  // stronger indicator than those generic selectors and must fail closed.
  if(loginText&&document.querySelector('input[type="password"]'))return true;
  const hasWorkspace=!!input()&&(!!contactTitleElement()||messageContainers().length>0);if(hasWorkspace)return false;
  return loginText;
}
function chat(){
  const titleElement=contactTitleElement(),title=textOf(titleElement)||String(document.title||'')||driver?.name||'当前会话';
  return{key:title.slice(0,180),title:title.slice(0,180),phone:''};
}
function emit(status,extra={}){
  const c=chat();state={...state,status,...extra};
  ipcRenderer.send('platform:composer-preview',{status,chat:c.key,original:state.original,translation:state.translation,error:state.error||'',target:config.outgoing||'en',targetLabel:config.outgoingLabel||'英语',hasChinese:chinese(state.original)});
}
function setValue(el,value){
  el.focus();
  if(el.matches('textarea,input')){
    const proto=Object.getPrototypeOf(el),desc=Object.getOwnPropertyDescriptor(proto,'value');desc?.set?desc.set.call(el,value):el.value=value;
    el.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:value}));return;
  }
  const selection=getSelection(),range=document.createRange();range.selectNodeContents(el);selection.removeAllRanges();selection.addRange(range);
  document.execCommand('insertText',false,value);el.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:value}));
}
async function translateDraft(el,original){
  if(config.enabled===false)throw new Error('翻译功能已关闭，请先开启。');
  const c=chat(),result=await ipcRenderer.invoke('desktop:platform-translate',{text:original,target:config.outgoing||'en',chat:c.key});
  const value=String(result?.translation||'').trim();if(!value)throw new Error('译文为空，已阻止发送。');if(config.blockChinese&&chinese(value))throw new Error('译文仍包含中文，已阻止发送。');return value;
}
function schedule(){
  clearTimeout(timer);const el=input(),original=textOf(el);
  if(!original){state={chat:'',original:'',translation:'',status:'idle'};emit('idle',{original:'',translation:''});return;}
  state={chat:chat().key,original,translation:chinese(original)?'':original,status:chinese(original)?'waiting':'ready'};
  if(!chinese(original)){emit('ready');return;}
  if(config.enabled===false){emit('idle',{error:'翻译功能已关闭。'});return;}
  if(!config.automatic||!config.translateSend){emit(config.blockChinese?'blocked':'idle',{error:config.blockChinese?'请开启翻译后发送。':'自动翻译已关闭。'});return;}
  emit('waiting');timer=setTimeout(async()=>{try{task=translateDraft(el,original);state.translation=await task;state.status='ready';emit('ready');}catch(error){state.status='error';state.error=String(error?.message||'翻译失败').slice(0,240);emit('error');}finally{task=null;}},400);
}
function contactSearchInput(){
  const candidates=[...document.querySelectorAll('input[type="search"],input[placeholder*="Search"],input[placeholder*="搜索"],#side div[contenteditable="true"][role="textbox"],.input-search-input')];
  return candidates.find(el=>visible(el)&&el!==input())||null;
}
async function openContactByText(contact){
  const needle=String(contact||'').replace(/^\+/,'').trim();
  if(!needle)throw new Error('联系人号码为空。');
  const search=contactSearchInput();
  if(!search)throw new Error('找不到当前平台的搜索框。');
  setValue(search,needle);await wait(500);
  const nodes=[...document.querySelectorAll('[role="listitem"],[role="row"],.chatlist-chat,.chat-item,li')];
  const hit=nodes.find(node=>visible(node)&&textOf(node).replace(/\s+/g,' ').includes(needle));
  if(!hit)throw new Error('搜索不到联系人 '+needle+'。');
  hit.click();await wait(700);
  return {ok:true,contact:needle,chat:chat().key};
}
async function sendCurrent(){
  const el=input();if(!el)throw new Error('找不到当前平台输入框。');
  const text=textOf(el).trim();if(!text)throw new Error('当前输入框为空。');
  const selector=driver?.selectors?.sendBtn,button=selector?[...document.querySelectorAll(selector)].find(b=>visible(b)&&!b.disabled):null;
  if(button)button.click();else el.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',code:'Enter',keyCode:13,which:13,bubbles:true,cancelable:true}));
  await wait(350);return{ok:true,sent:text.slice(0,500)};
}

async function sendTranslated(){
  if(sending)return;const el=input(),original=textOf(el);if(!el||!original||!chinese(original))return;
  if(config.enabled===false)return;
  if(!config.translateSend){emit('blocked',{error:'中文发送保护已开启，请开启翻译后发送。'});return;}
  sending=true;clearTimeout(timer);
  try{
    const value=state.translation&&state.original===original?state.translation:await(task||translateDraft(el,original));if(config.blockChinese&&chinese(value))throw new Error('译文仍包含中文，已阻止发送。');
    setValue(el,value);await wait(120);if(textOf(el)!==value)throw new Error('无法确认输入框已接收译文，已阻止发送。');emit('sending',{translation:value});
    const selector=driver?.selectors?.sendBtn,button=selector?[...document.querySelectorAll(selector)].find(b=>visible(b)&&!b.disabled):null;
    if(button)button.click();else el.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',code:'Enter',keyCode:13,which:13,bubbles:true,cancelable:true}));
    await wait(250);state={chat:chat().key,original:'',translation:'',status:'sent'};emit('sent',{original,translation:value});
  }catch(error){state.error=String(error?.message||'发送未完成').slice(0,240);state.status='error';emit('error');}finally{sending=false;}
}
function onInput(event){const el=input();if(el&&(event.target===el||el.contains(event.target))&&!sending)schedule();}
function isSendTarget(target){if(!target?.closest||!driver)return false;const selector=driver.selectors?.sendBtn;try{return !!selector&&!!target.closest(selector);}catch{return false;}}
function intercept(event){
  // The second click/Enter is our deliberate re-send after injection. Let it
  // reach the platform; blocking it here would leave the translated draft in
  // the composer and reproduce the reported "cannot send" symptom.
  if(sending||config.enabled===false)return;const el=input();if(!el)return;const inside=event.target===el||el.contains(event.target)||document.activeElement===el;
  if(event.type==='keydown'&&event.key==='Enter'&&!event.shiftKey&&!event.isComposing&&inside&&chinese(textOf(el))){event.preventDefault();event.stopImmediatePropagation();sendTranslated();}
  else if(event.type==='click'&&isSendTarget(event.target)&&chinese(textOf(el))){event.preventDefault();event.stopImmediatePropagation();sendTranslated();}
}
function connectedSnapshot(){
  const titleElement=contactTitleElement(),containers=messageContainers(),el=input(),connected=!!el&&(!!titleElement||containers.length>0)&&!isLoginPage(),c=chat();
  return{key:connected?c.key:'',title:connected?c.title:'',phone:'',connected,group:false};
}
function scan(message){applyComposerPlaceholder();const snapshot=connectedSnapshot();ipcRenderer.send('platform:snapshot',snapshot);scanIncoming();respond(message,true,snapshot);}

function installTranslationStyles(){
  if(document.getElementById('st-platform-translation-style'))return;
  const style=document.createElement('style');style.id='st-platform-translation-style';
  style.textContent='.st-platform-translation{display:block;margin-top:4px;padding:3px 6px;border-top:1px dashed rgba(100,130,150,.35);font:12px/1.45 system-ui,sans-serif;color:#527b68;background:rgba(235,247,239,.72);white-space:pre-wrap;overflow-wrap:anywhere}.st-platform-translation-label{margin-right:5px;color:#6c91a7;font-size:11px}.st-platform-translation-text{color:#365e4c}.st-platform-translation.manual{cursor:pointer;color:#477f9d;background:rgba(238,246,255,.8)}.st-platform-translation.manual:hover{background:rgba(225,239,255,.95)}.st-platform-translation.manual .st-platform-translation-label{color:#4f86b5}.st-platform-translation.manual .st-platform-translation-button{color:#3f8ec9;text-decoration:underline;font-size:11px}.st-composer-hint:empty::before{content:attr(data-st-placeholder);color:#8696a0;pointer-events:none}';
  (document.head||document.documentElement).append(style);
}
function applyComposerPlaceholder(){
  const el=input();if(!el)return;
  const text='输入任意语言，实时译为'+(config.outgoingLabel||'英语')+'后仅发送译文';
  try{if('placeholder'in el)el.placeholder=text;}catch{}
  el.setAttribute('aria-placeholder',text);
  el.setAttribute('data-st-placeholder',text);
  if(el.isContentEditable)el.classList.add('st-composer-hint');
}
function messageText(container){
  const selector=driver?.selectors?.messageText;let el=null;if(selector){try{el=[...container.querySelectorAll(selector)].find(visible)||container.querySelector(selector);}catch{}}
  const value=textOf(el||container).replace(/\s+/g,' ').trim();if(!value||value.length<2||value.length>2000||!/[\p{L}\p{N}]/u.test(value))return'';return value;
}
function shouldTranslateIncoming(text){
  const target=String(config.incoming||'zh-CN').toLowerCase();if(target.startsWith('zh'))return /[A-Za-zÀ-ÿА-Яа-я一-龥]/u.test(text)&&!chinese(text);return chinese(text);
}
function cardFor(container){return [...container.children].find(child=>child.classList?.contains('st-platform-translation'))||null;}
function queueIncoming(container,text){const previous=incomingRecords.get(container);if(previous?.source===text||previous?.pending)return;const record={source:text,pending:true};incomingRecords.set(container,record);incomingQueue.push({container,text,record});processIncomingQueue();}
let manualClickBound=false;
function bindManualClick(){
  if(manualClickBound)return;manualClickBound=true;
  document.addEventListener('click',event=>{
    const card=event.target?.closest?.('.st-platform-translation.manual');if(!card)return;
    event.preventDefault();event.stopPropagation();
    const container=card.parentElement,text=card.dataset.source;
    if(container&&text)translateManual(container,text,card);
  },true);
}
function manualCard(container,text){
  installTranslationStyles();bindManualClick();let card=cardFor(container);
  if(card&&card.dataset.source===text&&card.classList.contains('manual'))return card;
  if(!card){card=document.createElement('div');container.append(card);}
  card.className='st-platform-translation manual';card.dataset.source=text;
  const label=document.createElement('span');label.className='st-platform-translation-label';label.textContent=(String(config.incoming||'').startsWith('zh')?'翻译为中文':'翻译');
  const button=document.createElement('span');button.className='st-platform-translation-button';button.textContent='超级翻译 · 点击翻译';
  card.replaceChildren(label,button);
  return card;
}
async function translateManual(container,text,card){
  if(!card?.isConnected)return;
  card.replaceChildren(document.createTextNode('正在翻译…'));
  try{
    const result=await ipcRenderer.invoke('desktop:platform-translate',{text,target:config.incoming||'zh-CN',chat:chat().key});
    const value=String(result?.translation||'').trim();
    if(!value||!card.isConnected)throw new Error('译文为空');
    card.className='st-platform-translation';card.dataset.source=text;
    const label=document.createElement('span');label.className='st-platform-translation-label';label.textContent='译文';
    const body=document.createElement('span');body.className='st-platform-translation-text';body.textContent=value;
    card.replaceChildren(label,body);
  }catch(error){
    if(!card.isConnected)return;
    card.className='st-platform-translation manual';card.dataset.source=text;
    const label=document.createElement('span');label.className='st-platform-translation-label';label.textContent='翻译失败';
    const button=document.createElement('span');button.className='st-platform-translation-button';button.textContent='点击重试';
    card.replaceChildren(label,button);
  }
}
function processIncomingQueue(){
  while(incomingActive<2&&incomingQueue.length){const job=incomingQueue.shift();incomingActive++;
    (async()=>{try{if(config.enabled===false)return;
      const result=await ipcRenderer.invoke('desktop:platform-translate',{text:job.text,target:config.incoming||'zh-CN',chat:chat().key}),value=String(result?.translation||'').trim();
      if(value&&job.container.isConnected&&messageText(job.container)===job.text){installTranslationStyles();let card=cardFor(job.container);if(!card){card=document.createElement('div');card.className='st-platform-translation';job.container.append(card);}card.replaceChildren();const label=document.createElement('span');label.className='st-platform-translation-label';label.textContent='译文';const body=document.createElement('span');body.className='st-platform-translation-text';body.textContent=value;card.append(label,body);job.record.translation=value;}
    }catch{}finally{job.record.pending=false;incomingActive--;processIncomingQueue();}})();
  }
}
function scanIncoming(){
  if(config.enabled===false||!driver?.selectors?.messages)return;
  for(const container of messageContainers()){
    const text=messageText(container);
    if(!text||!shouldTranslateIncoming(text)||cardFor(container))continue;
    const outgoing=!!container.closest?.('[data-st-direction="out"],.message-out,.own,.out');
    if(!incomingArmed)incomingSeen.add(container);
    else if(!outgoing&&!incomingSeen.has(container)){incomingSeen.add(container);try{ipcRenderer.send('platform:incoming-message',{chat:chat().key,title:String(chat().title||''),text});}catch{}}
    if(!openchatSeen.has(container)){
      openchatSeen.add(container);
      try{ipcRenderer.invoke('desktop:openchat-open',{platform:currentPlatform||'WhatsApp',staff:String(chat().title||''),phone:String(chat().phone||''),identify:openchatHidden(text),fingerprint:openchatTail(text),event:''}).catch(()=>{});}catch{}
    }
    if(config.automatic||config.history)queueIncoming(container,text);
    else manualCard(container,text);
  }
}
function installIncomingObserver(){
  if(incomingObserver||!document.body)return;incomingObserver=new MutationObserver(()=>{clearTimeout(incomingScanTimer);incomingScanTimer=setTimeout(scanIncoming,180);});incomingObserver.observe(document.body,{subtree:true,childList:true,characterData:true});scanIncoming();
}

ipcRenderer.on('platform:command',(_,message={})=>{try{
  if(message.op==='init'){driver=message.driver||null;currentPlatform=String(message.platform||'');for(const container of messageContainers()){openchatSeen.add(container);incomingSeen.add(container);}incomingArmed=true;config={...config,...(message.config||{})};installTranslationStyles();installIncomingObserver();applyComposerPlaceholder();scan(message);}
  else if(message.op==='config'){config={...config,...(message.config||{})};applyComposerPlaceholder();if(config.enabled===false){clearTimeout(timer);state={chat:'',original:'',translation:'',status:'idle'};emit('idle',{error:'翻译功能已关闭。'});}scanIncoming();respond(message,true,{ok:true});}
  else if(message.op==='snapshot')scan(message);
  else if(message.op==='fill'){const el=input();if(!el)throw new Error('找不到当前平台输入框。');setValue(el,String(message.text||''));emit('ready',{original:textOf(el),translation:''});respond(message,true,{ok:true});}
  else if(message.op==='open-contact'){openContactByText(message.contact).then(data=>respond(message,true,data)).catch(error=>respond(message,false,{},String(error?.message||error)));}
  else if(message.op==='send'){sendCurrent().then(data=>respond(message,true,data)).catch(error=>respond(message,false,{},String(error?.message||error)));}
  else respond(message,false,{},'未知的平台命令。');
}catch(error){respond(message,false,{},String(error?.message||'平台命令失败。'));}});

window.addEventListener('keydown',intercept,true);window.addEventListener('click',intercept,true);document.addEventListener('input',onInput,true);
setInterval(()=>{if(driver){scan();installIncomingObserver();}},1800);
