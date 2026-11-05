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
const {ipcRenderer}=require('electron');
let config={incoming:'zh-CN',outgoing:'en',outgoingLabel:'英语',enabled:true,automatic:false,history:false,translateSend:true,blockChinese:true},lastChat='',lastSnapshot='',observer,timer;
let queued=Promise.resolve(),autoRemaining=0,epoch=0,failures=0,paused=false,pendingCount=0,translatedCount=0,annotation=null;
const entries=new WeakMap(),cache=new Map(),knownPhones=new Map();
let runtimeRows=[],profiles=new Map(),profilesByKey=new Map(),profilesByTitle=new Map(),profilesByPhone=new Map();
// Keep the left conversation list useful even while WhatsApp is still
// hydrating its private React models.  In that short window the rendered row
// often already contains the international number, so country attribution is
// intentionally derived from the visible DOM as a local presentation feature.
const COUNTRY_PREFIXES=Object.freeze([["30","希腊"],["31","荷兰"],["32","比利时"],["33","法国"],["34","西班牙"],["36","匈牙利"],["39","意大利"],["40","罗马尼亚"],["41","瑞士"],["43","奥地利"],["44","英国"],["45","丹麦"],["46","瑞典"],["47","挪威"],["48","波兰"],["49","德国"],["350","直布罗陀"],["351","葡萄牙"],["352","卢森堡"],["353","爱尔兰"],["354","冰岛"],["355","阿尔巴尼亚"],["356","马耳他"],["357","塞浦路斯"],["358","芬兰"],["359","保加利亚"],["370","立陶宛"],["371","拉脱维亚"],["372","爱沙尼亚"],["373","摩尔多瓦"],["374","亚美尼亚"],["375","白俄罗斯"],["376","安道尔"],["377","摩纳哥"],["378","圣马力诺"],["380","乌克兰"],["381","塞尔维亚"],["382","黑山"],["383","科索沃"],["385","克罗地亚"],["386","斯洛文尼亚"],["387","波斯尼亚和黑塞哥维那"],["389","北马其顿"],["420","捷克"],["421","斯洛伐克"],["423","列支敦士登"],["7","俄罗斯"],["20","埃及"],["27","南非"],["211","南苏丹"],["212","摩洛哥"],["213","阿尔及利亚"],["216","突尼斯"],["218","利比亚"],["220","冈比亚"],["221","塞内加尔"],["222","毛里塔尼亚"],["223","马里"],["224","几内亚"],["225","科特迪瓦"],["226","布基纳法索"],["227","尼日尔"],["228","多哥"],["229","贝宁"],["230","毛里求斯"],["231","利比里亚"],["232","塞拉利昂"],["233","加纳"],["234","尼日利亚"],["235","乍得"],["236","中非"],["237","喀麦隆"],["238","佛得角"],["239","圣多美和普林西比"],["240","赤道几内亚"],["241","加蓬"],["242","刚果（布）"],["243","刚果（金）"],["244","安哥拉"],["245","几内亚比绍"],["246","迪戈加西亚"],["248","塞舌尔"],["249","苏丹"],["250","卢旺达"],["251","埃塞俄比亚"],["252","索马里"],["253","吉布提"],["254","肯尼亚"],["255","坦桑尼亚"],["256","乌干达"],["257","布隆迪"],["258","莫桑比克"],["260","赞比亚"],["261","马达加斯加"],["262","留尼汪"],["263","津巴布韦"],["264","纳米比亚"],["265","马拉维"],["266","莱索托"],["267","博茨瓦纳"],["268","斯威士兰"],["269","科摩罗"],["290","圣赫勒拿"],["291","厄立特里亚"],["297","阿鲁巴"],["298","法罗群岛"],["299","格陵兰"],["960","马尔代夫"],["961","黎巴嫩"],["962","约旦"],["963","叙利亚"],["964","伊拉克"],["965","科威特"],["966","沙特阿拉伯"],["967","也门"],["968","阿曼"],["970","巴勒斯坦"],["971","阿联酋"],["972","以色列"],["973","巴林"],["974","卡塔尔"],["975","不丹"],["60","马来西亚"],["61","澳大利亚"],["62","印度尼西亚"],["63","菲律宾"],["64","新西兰"],["65","新加坡"],["66","泰国"],["81","日本"],["82","韩国"],["84","越南"],["86","中国大陆"],["880","孟加拉国"],["886","中国台湾"],["90","土耳其"],["91","印度"],["92","巴基斯坦"],["93","阿富汗"],["94","斯里兰卡"],["95","缅甸"],["98","伊朗"],["992","塔吉克斯坦"],["993","土库曼斯坦"],["994","阿塞拜疆"],["995","格鲁吉亚"],["996","吉尔吉斯斯坦"],["998","乌兹别克斯坦"],["1","美国/加拿大"],["51","秘鲁"],["52","墨西哥"],["53","古巴"],["54","阿根廷"],["55","巴西"],["56","智利"],["57","哥伦比亚"],["58","委内瑞拉"],["500","福克兰群岛"],["501","伯利兹"],["502","危地马拉"],["503","萨尔瓦多"],["504","洪都拉斯"],["505","尼加拉瓜"],["506","哥斯达黎加"],["507","巴拿马"],["508","圣皮埃尔和密克隆"],["509","海地"],["590","瓜德罗普/圣巴泰勒米"],["591","玻利维亚"],["592","圭亚那"],["593","厄瓜多尔"],["594","法属圭亚那"],["595","巴拉圭"],["596","马提尼克"],["597","苏里南"],["598","乌拉圭"],["599","库拉索/荷属加勒比"]] .sort((a,b)=>b[0].length-a[0].length));
let countryObserver=null,countryObserverRoot=null,countryTimer=null;
function headerTitle(){
  const h=main()?.querySelector('header');
  if(!h)return null;
  // WhatsApp changes the header markup frequently.  Keep the stable test id
  // first, then accept the title/dir=auto variants used by the current Web
  // client before falling back to a visible text node in the header.
  return h.querySelector('[data-testid="conversation-info-header-chat-title"]')||
    h.querySelector('[data-testid*="conversation-info-header"]')||
    h.querySelector('span[title]')||
    h.querySelector('span[dir="auto"][title],span[dir="auto"]')||
    h.querySelector('[title]')||
    [...h.querySelectorAll('span,div,h1,h2')].find(el=>isDisplayed(el)&&!el.children.length&&originalName(el));
}
function originalName(el){if(!el)return '';if(el.hasAttribute('title'))return el.getAttribute('title');const copy=el.cloneNode(true);copy.querySelectorAll('.st-display-name').forEach(e=>e.remove());return copy.textContent.trim();}
function main(){return document.querySelector('#main');}
function fallbackChatKey(title){
  const value=String(title||'').replace(/[\u200b\u200c\u200d\ufeff]/g,'').replace(/\s+/g,' ').trim().slice(0,180);
  if(!value||/^(whatsapp|whatsapp web|chats?|聊天|对话)$/i.test(value))return '';
  // A deterministic local key lets the send guard work even when WhatsApp
  // temporarily omits React's serialized chat id. It is deliberately scoped
  // to the title and never leaves the renderer as a network identifier.
  let hash=2166136261;for(let i=0;i<value.length;i++){hash^=value.charCodeAt(i);hash=Math.imul(hash,16777619);}
  return `title:${(hash>>>0).toString(16)}:${value}`;
}
function normalizedChatJid(value){
  const raw=String(value||'').replace(/[\u200b\u200c\u200d\ufeff]/g,'').trim();
  const match=raw.match(/^(?:(?:true|false)_)?([^_]+@(?:c\.us|s\.whatsapp\.net|g\.us|lid))(?:_|$)/);
  return match?match[1].slice(0,240):'';
}
function sameChatKey(left,right){
  const a=String(left||'').trim(),b=String(right||'').trim();
  if(!a||!b)return false;
  if(a===b)return true;
  const na=normalizedChatJid(a),nb=normalizedChatJid(b);
  return !!na&&!!nb&&na===nb;
}
// Keep the externally-visible chat key in its historical/raw form.  The
// workbench hashes this value for notes, per-contact rules, and CRM records;
// changing it to a bare JID would orphan existing entries.  Voice processing
// uses `voiceChatKeyFor` below instead, so message-id suffix churn can no
// longer reset the voice queue.
function voiceChatKeyFor(value){
  const raw=String(value||'').replace(/[\u200b\u200c\u200d\ufeff]/g,'').trim();
  return normalizedChatJid(raw)||raw;
}
function serializedChatId(root){
  const selected=document.querySelector('#pane-side [role="row"][aria-selected="true"],#pane-side [role="row"] [aria-selected="true"],#pane-side [data-testid="cell-frame-container"][aria-selected="true"],#pane-side [data-testid="cell-frame-container"] [aria-selected="true"]');
  // Build the collection conditionally. Spreading a query result obtained from
  // a missing selected row previously made the initial/no-selection scan brittle.
  const selectedCandidates=selected?[selected,...selected.querySelectorAll('[data-id]')]:[];
  for(const el of selectedCandidates){const raw=String(el.getAttribute('data-id')||'').replace(/[\u200b\u200c\u200d\ufeff]/g,'').trim();if(normalizedChatJid(raw))return raw.slice(0,260);}
  // Message data-ids end with a per-message suffix. They are not stable chat
  // identities and must never advance epoch while the customer merely scrolls.
  // Use only the peer portion as a last-resort conversation key.
  if(!root?.querySelectorAll)return'';
  for(const el of root.querySelectorAll('[data-id]')){const raw=String(el.getAttribute('data-id')||'').replace(/[\u200b\u200c\u200d\ufeff]/g,'').trim();if(normalizedChatJid(raw))return raw.slice(0,260);}
  return '';
}
function chat(){
  const m=main(),header=m?.querySelector('header');if(!header)return{key:'',title:'',phone:''};
  const title=(originalName(headerTitle())||header.innerText.split('\n')[0]||'').replace(/\s+/g,' ').trim();
  const rows=[...document.querySelectorAll('#pane-side [role="row"]')];
  const selectedDom=rows.find(row=>row.getAttribute('aria-selected')==='true'||row.querySelector('[aria-selected="true"]'));
  const selectedIndex=selectedDom?rows.indexOf(selectedDom):-1;
  const selected=runtimeRows.find(r=>(selectedIndex>=0&&r.index===selectedIndex)||(r.selected&&r.title===title));
  const id=serializedChatId(m);const serialized=selected?.key||id;
  const jid=serialized||'';
  const phoneMatch=title.match(/^\+\d[\d ()-]{6,24}$/);let phone=phoneMatch?phoneMatch[0]:'';
  if(!phone){const idPhone=jid.match(/^(?:true|false)_([0-9]{6,15})@(?:c\.us|s\.whatsapp\.net)(?:_|$)/);if(idPhone)phone='+'+idPhone[1];}
  const group=/@g\.us(?:_|$)/.test(jid);if(group)phone='';
  const key=jid||(phone?'phone:'+phone.replace(/[^+\d]/g,''):fallbackChatKey(title));
  if(key&&!group&&!phone)phone=selected?.phone||knownPhones.get(key)||'';
  return{key,title,phone,group,voiceKey:voiceChatKeyFor(key)};
}
function profilePhone(){
  // Only inspect a contact-info panel, never message bodies or arbitrary page numbers.
  const panels=[...document.querySelectorAll('[data-testid="contact-info-drawer"], [data-testid="drawer-right"], [role="dialog"], section')].filter(p=>!/群组信息|Group info/i.test(p.innerText)&&/联系人信息|联系信息|Contact info|电话号码|Phone number/i.test(p.innerText));
  const found=new Set();for(const p of panels)for(const el of p.querySelectorAll('span,div,a')){if(el.children.length)continue;const t=(el.textContent||'').trim();if(/^\+\d[\d ()\u00a0-]{6,24}$/.test(t))found.add(t.replace(/[\s()\u00a0-]/g,''));}
  return found.size===1?[...found][0]:'';
}
async function identifyPhone(){
  const before=chat();if(!before.key||before.group)throw new Error('请打开个人聊天；群组不推断单一国家。');if(before.phone)return{phone:before.phone};
  let phone=profilePhone();if(!phone){const target=main()?.querySelector('header [title]');if(!target)throw new Error('找不到联系人资料入口，请手动打开资料后重试。');target.click();for(let i=0;i<12&&!phone;i++){await new Promise(r=>setTimeout(r,250));if(chat().key!==before.key)throw new Error('聊天已变化，停止识别。');phone=profilePhone();}}
  if(phone){knownPhones.set(before.key,phone);scan();return{phone};}throw new Error('联系人资料未显示完整号码。请在软件中手动填写带 + 国际区号的号码。');
}
function annotate(){
  // The left conversation row carries the local alias/note. Do not draw an
  // extra badge into WhatsApp's header: it overlaps the platform controls.
  document.getElementById('st-contact-badge')?.remove();
}
function normalizePhone(value){return String(value||'').replace(/[^\d]/g,'');}
function rowTitle(el){
  const titled=el?.querySelector?.('span[title]');
  if(titled?.getAttribute('title'))return titled.getAttribute('title').trim();
  return [...(el?.querySelectorAll?.('span,div')||[])].map(node=>String(node.textContent||'').replace(/\s+/g,' ').trim()).find(text=>/^\+\d[\d ()-]{6,24}$/.test(text))||'';
}
function extractInternationalPhone(value){
  const raw=String(value||'').replace(/[\u200b\u200c\u200d\ufeff]/g,' ').replace(/\u00a0/g,' ');
  const match=raw.match(/(?:^|[^\d+])(\+\d[\d ().-]{6,24}\d)(?!\d)/);
  if(match)return match[1].replace(/\s+/g,' ').trim();
  const compact=raw.match(/(?:^|[^\d])(00\d[\d ().-]{6,24}\d)(?!\d)/);
  return compact?compact[1].replace(/^00/,'+').replace(/\s+/g,' ').trim():'';
}
function rowPhone(el){
  if(!el)return '';
  const candidates=[];
  for(const node of [el,...(el.querySelectorAll?.('[title],[aria-label]')||[])]){
    candidates.push(node.getAttribute?.('title')||'',node.getAttribute?.('aria-label')||'');
  }
  // Do not scan the complete row preview: a customer's message can itself
  // contain a phone number and would otherwise be mistaken for the contact's
  // identity.  Only the title/label-bearing contact node is eligible.
  const titleNode=el.querySelector?.('span[title], [data-testid="cell-frame-title"]');
  if(titleNode)candidates.push(titleNode.textContent||'');
  for(const candidate of candidates){const phone=extractInternationalPhone(candidate);if(phone)return phone;}
  return '';
}
function countryFromPhone(value){
  const digits=String(value||'').replace(/\D/g,'');if(!digits)return '';
  const normalized=digits.startsWith('00')?digits.slice(2):digits;
  const match=COUNTRY_PREFIXES.find(([prefix])=>normalized.startsWith(prefix));
  return match?match[1]:'';
}
function rowKey(el){
  for(const node of [el,...(el?.querySelectorAll?.('[data-id]')||[])]){
    const value=String(node?.getAttribute?.('data-id')||'').trim();
    if(/^(?:true|false)_[^_]+@(?:c\.us|s\.whatsapp\.net|g\.us|lid)(?:_|$)/.test(value))return value;
  }
  return '';
}
function identityForRow(el,index){
  const title=rowTitle(el),key=rowKey(el),phone=normalizePhone(title);
  // Prefer the stable serialized chat id, then fall back to title/phone. The
  // latter two are needed while WhatsApp is hydrating a newly opened account
  // and its React model is not attached to every visible row yet.
  return runtimeRows.find(item=>key&&sameChatKey(item.key,key))||
    runtimeRows.find(item=>item.index===index&&(!item.title||item.title===title))||
    runtimeRows.find(item=>title&&item.title===title)||
    runtimeRows.find(item=>phone&&normalizePhone(item.phone)===phone)||null;
}
function decorateName(el,name,country){if(!el)return;let label=el.querySelector(':scope > .st-display-name');if(!name&&!country){label?.remove();el.classList.remove('st-name-host');return;}const sourceTitle=originalName(el);el.classList.add('st-name-host');if(!label){label=document.createElement('span');label.className='st-display-name';el.append(label);}label.dataset.stTitle=sourceTitle;const text=(name||sourceTitle)+(country?' ('+country+')':'');if(label.textContent!==text){label.replaceChildren();const alias=document.createElement('span');alias.textContent=name||sourceTitle;alias.style.color=name?'#f04444':'inherit';alias.style.fontWeight=name?'600':'inherit';label.append(alias);if(country){const tag=document.createElement('span');tag.className='custom-country-tag';tag.textContent=' ('+country+')';tag.style.cssText='color:#8696a0;font-size:13px;font-weight:400;margin-left:4px;white-space:nowrap';label.append(tag);}}else{const tag=label.querySelector(':scope > .custom-country-tag');if(country&&!tag){const countryTag=document.createElement('span');countryTag.className='custom-country-tag';countryTag.textContent=' ('+country+')';countryTag.style.cssText='color:#8696a0;font-size:13px;font-weight:400;margin-left:4px;white-space:nowrap';label.append(countryTag);}else if(!country)tag?.remove();}}
function decorateCountryRows(){
  const rows=[...new Set([...document.querySelectorAll('#pane-side [role="row"], #pane-side [role="listitem"], #pane-side [data-testid="cell-frame-container"]')])];
  for(let i=0;i<rows.length;i++){
    const row=rows[i],el=row.querySelector('span[title]')||row.querySelector('[data-testid="cell-frame-title"]')||row.querySelector('span');
    const r=identityForRow(row,i),visibleTitle=rowTitle(row),visiblePhone=rowPhone(row),profile=(r&&profiles.get(r.hash))||(r&&profilesByKey.get(r.key))||profilesByTitle.get(String(visibleTitle||''))||(r?.phone&&profilesByPhone.get(normalizePhone(r.phone)))||profilesByPhone.get(normalizePhone(visiblePhone))||null;
    // Prefer an explicit CRM/runtime country, but fall back to the visible
    // international number so labels do not disappear during account swaps.
    const directCountry=countryFromPhone(rowPhone(row));
    const country=profile?.country||r?.country||directCountry;
    const selectedEl=document.querySelector('#pane-side [aria-selected="true"]');
    const selectedRow=!!selectedEl&&(selectedEl===row||row.contains(selectedEl)||selectedEl.contains(row));
    const localName=profile?.name||(selectedRow&&annotation?.name?annotation.name:'');
    const localNote=profile?.note||(selectedRow&&annotation?.note?annotation.note:'');
    if(!r&&!country&&!localName&&!localNote){const label=el?.querySelector?.(':scope > .st-display-name');if(label&&label.dataset.stTitle!==originalName(el)){label.remove();el.classList.remove('st-name-host');}continue;}
    decorateName(el,localName,country||'');
    let noteEl=row.querySelector(':scope > .st-local-note');
    if(!localNote){noteEl?.remove();continue;}
    if(!noteEl){noteEl=document.createElement('span');noteEl.className='st-local-note';row.append(noteEl);}
    const noteText='本机备注：'+localNote;
    if(noteEl.textContent!==noteText)noteEl.textContent=noteText;
    noteEl.title=noteText;
    noteEl.style.cssText='display:block;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#e5a15a;font:11px/15px "Microsoft YaHei",sans-serif;padding:0 1px;pointer-events:none;';
  }
}
function installCountryObserver(){
  const pane=document.querySelector('#pane-side');if(!pane)return;
  if(countryObserverRoot===pane&&countryObserver)return;
  countryObserver?.disconnect();countryObserverRoot=pane;
  countryObserver=new MutationObserver(()=>{clearTimeout(countryTimer);countryTimer=setTimeout(decorateCountryRows,100);});
  countryObserver.observe(pane,{childList:true,subtree:true,characterData:true});
  decorateCountryRows();
}
function decorate(){
  installCountryObserver();decorateCountryRows();
  const c=chat(),r=runtimeRows.find(r=>sameChatKey(r.key,c.key)),profile=r?profiles.get(r.hash):null;const note=annotation&&sameChatKey(annotation.key,c.key)?annotation:null;
  // Preserve a configured internal alias in the header, but render country
  // attribution exclusively in WhatsApp's left conversation list.
  decorateName(headerTitle(),note?.name||profile?.name||'','');
  const e=editor();if(e){const hint=e.parentElement.querySelector(':scope > [aria-hidden="true"]');if(hint&&!e.innerText.trim()){const value='输入任意语言，实时译为'+(config.outgoingLabel||'英语')+'后仅发送译文';if(hint.textContent!==value)hint.textContent=value;}e.setAttribute('aria-placeholder','输入任意语言，实时译为'+(config.outgoingLabel||'英语')+'后仅发送译文');}
}
ipcRenderer.on('wa:identities',(_,data)=>{
  const next=Array.isArray(data?.rows)?data.rows.filter(item=>item&&typeof item==='object'):[];
  // The host polls while WhatsApp is switching accounts. An intermediate
  // empty/partial response must not erase the last known country labels from
  // the visible list; the next non-empty response reconciles them by key,
  // title, or normalized phone number.
  if(next.length)runtimeRows=next;
  scan();
});
function editor(){
  const root=main();if(!root)return null;
  // WhatsApp occasionally nests a paragraph/span inside the editor and may
  // keep an invisible composer mounted while switching chats. Prefer the
  // visible footer editor, but retain a non-visible fallback during initial
  // page hydration so the first input event can still be observed.
  const preferred=[...root.querySelectorAll('footer [contenteditable="true"][data-tab="10"],footer [contenteditable="true"][role="textbox"]')];
  const visiblePreferred=preferred.find(isDisplayed);if(visiblePreferred)return visiblePreferred;if(preferred[0])return preferred[0];
  const all=[...root.querySelectorAll('[contenteditable="true"][data-tab="10"],[contenteditable="true"][role="textbox"]')];
  const visible=all.find(isDisplayed);return visible||all[0]||null;
}
function isDisplayed(el){
  if(!el?.isConnected)return false;const style=getComputedStyle(el);if(style.display==='none'||style.visibility==='hidden')return false;
  const rect=el.getBoundingClientRect();return rect.width>0&&rect.height>0;
}

// WhatsApp's composer is owned by its React tree.  We observe it, but only
// mutate it through execCommand so WhatsApp receives the same beforeinput/input
// chain as a real edit.  Every async result is tied to the exact chat, editor,
// text and target language that created it; a stale result can never be sent.
let composerTimer=null,composerToken=0,composerTask=null,composerTaskFingerprint='';
const composerTranslations=new Map();
let sendTask=null,isSendingTranslated=false,allowNativeSend=false;
let composerState={chat:'',original:'',translated:'',status:'idle',error:'',fingerprint:''};
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const chineseText=text=>/[\u3400-\u9fff\uf900-\ufaff]/u.test(String(text||''));
// `blockChinese` is retained only for compatibility with existing settings.
// It can protect a Chinese source when automatic translation is explicitly
// disabled, but must never reject a translated result: Chinese characters are
// valid output for Chinese targets and also occur in Japanese text.
const cleanDraft=el=>String(el?.innerText||el?.textContent||'').replace(/\u00a0/g,' ').replace(/[\u200b\u200c\u200d\ufeff]/g,'').replace(/\r\n?/g,'\n').trim();
const composerTextMatches=(actual,expected)=>{
  const a=cleanDraft({innerText:actual}),b=cleanDraft({innerText:expected});
  return a===b||a.replace(/\s+/g,' ' )===b.replace(/\s+/g,' ');
};
const composerFingerprint=(chatKey,text)=>JSON.stringify([chatKey,config.outgoing||'en',text]);
function sendComposerPreview(status,data={}){
  const c=chat(),payload={status,chat:data.chat??c.key,original:data.original??composerState.original,translation:data.translation??composerState.translated,error:data.error||'',target:config.outgoing||'en',targetLabel:config.outgoingLabel||'英语',hasChinese:chineseText(data.original??composerState.original)};
  ipcRenderer.send('wa:composer-preview',payload);
}
function resetComposerPreview(emit=true){
  clearTimeout(composerTimer);composerTimer=null;composerToken++;composerTask=null;composerTaskFingerprint='';composerState={chat:'',original:'',translated:'',status:'idle',error:'',fingerprint:''};if(emit)sendComposerPreview('idle',{chat:'',original:'',translation:''});
}
function composerStillCurrent(inputEl,chatKey,text,token){return token===composerToken&&chat().key===chatKey&&!!liveComposer(chatKey,text);}
async function translateComposer(inputEl,text,chatKey){
  if(config.enabled===false)throw new Error('翻译功能已关闭，请先开启。');
  const fingerprint=composerFingerprint(chatKey,text);
  if(composerState.status==='ready'&&composerState.fingerprint===fingerprint&&composerState.translated)return composerState.translated;
  const cacheKey=(config.outgoing||'en')+'|'+text;
  const cached=composerTranslations.get(cacheKey);
  if(cached){composerState={chat:chatKey,original:text,translated:cached,status:'ready',error:'',fingerprint};sendComposerPreview('ready');return cached;}
  if(composerTask&&composerTaskFingerprint===fingerprint)return composerTask;
  const token=++composerToken;composerState={chat:chatKey,original:text,translated:'',status:'translating',error:'',fingerprint};sendComposerPreview('translating');
  const task=(async()=>{
    try{
      const result=await ipcRenderer.invoke('wa:translate',{text,target:config.outgoing||'en',cache:true,fast:true});const translated=String(result?.translation||'').trim();
      if(!composerStillCurrent(inputEl,chatKey,text,token))throw Object.assign(new Error('草稿或聊天已变化，旧译文已丢弃。'),{stale:true});
      if(!translated)throw new Error('翻译结果为空，已阻止发送。');
      composerTranslations.set(cacheKey,translated);if(composerTranslations.size>300)composerTranslations.delete(composerTranslations.keys().next().value);
      composerState={chat:chatKey,original:text,translated,status:'ready',error:'',fingerprint};sendComposerPreview('ready');return translated;
    }catch(error){
      if(!error?.stale&&composerStillCurrent(inputEl,chatKey,text,token)){const message=String(error?.message||'实时翻译失败，已阻止发送。').replace(/^Error invoking remote method[^:]+: /,'').slice(0,260);composerState={chat:chatKey,original:text,translated:'',status:'error',error:message,fingerprint};sendComposerPreview('error',{error:message});}
      throw error;
    }
  })();
  composerTask=task;composerTaskFingerprint=fingerprint;
  try{return await task;}finally{if(composerTask===task){composerTask=null;composerTaskFingerprint='';}}
}
function scheduleComposerTranslation(inputEl){
  clearTimeout(composerTimer);composerTimer=null;const text=cleanDraft(inputEl),c=chat(),chatKey=c.key;
  if(!text){resetComposerPreview();return;}
  // Every non-empty draft follows the same path.  The backend receives the
  // text without a source-language hint and detects English, German, Chinese,
  // or any other supported source language itself.
  const fingerprint=composerFingerprint(chatKey,text);composerToken++;composerState={chat:chatKey,original:text,translated:'',status:'waiting',error:'',fingerprint};
  if(!chatKey){const message='请先打开一个 WhatsApp 聊天。';composerState.status='blocked';composerState.error=message;sendComposerPreview('blocked',{error:message});return;}
  if(config.enabled===false){composerState.status='idle';composerState.translated='';sendComposerPreview('idle',{error:'翻译功能已关闭。'});return;}
  if(config.translateSend===false){composerState.status='idle';composerState.translated='';sendComposerPreview('idle');return;}
  sendComposerPreview('waiting');composerTimer=setTimeout(()=>{composerTimer=null;translateComposer(inputEl,text,chatKey).catch(()=>{});},120);
}
function onComposerInput(event){
  if(isSendingTranslated)return;const inputEl=editor();if(!inputEl||!(event.target===inputEl||inputEl.contains(event.target)))return;scheduleComposerTranslation(inputEl);
}
const sendControlSelector='button,[role="button"],[data-icon="send"],[data-testid="send"],[data-testid="compose-btn-send"]';
function normalizeSendControl(candidate){
  if(!candidate)return null;
  return candidate.matches?.('[data-icon="send"],[data-testid="send"],[data-testid="compose-btn-send"]')?candidate.closest('button,[role="button"]')||candidate:candidate;
}
function isSendControl(button){
  if(!button)return false;const label=String(button.getAttribute?.('aria-label')||'');
  return /发送|send/i.test(label)||button.matches?.('[data-icon="send"],[data-testid="send"],[data-testid="compose-btn-send"]')||!!button.querySelector?.('[data-icon="send"],[data-testid="send"],[data-testid="compose-btn-send"]');
}
function isEnabledControl(button){return !!button&&!button.disabled&&button.getAttribute?.('aria-disabled')!=='true';}
function sendButtonFromTarget(target){
  const candidate=target?.closest?.(sendControlSelector);if(!candidate||!main()?.contains(candidate))return null;
  const button=normalizeSendControl(candidate);return isSendControl(button)&&isEnabledControl(button)&&isDisplayed(button)?button:null;
}
function currentSendButton(inputEl){
  const footer=inputEl?.closest('footer')||main()?.querySelector('footer');if(!footer)return null;
  let fallback=null;for(const candidate of footer.querySelectorAll(sendControlSelector)){const button=normalizeSendControl(candidate);if(!isSendControl(button))continue;if(!fallback)fallback=button;if(isDisplayed(button)&&isEnabledControl(button))return button;}
  // A disabled/hidden clone is not clickable. Returning null makes the caller
  // use the guarded Enter fallback instead of reporting a phantom send.
  return fallback&&isDisplayed(fallback)&&isEnabledControl(fallback)?fallback:null;
}
function stopNativeSend(event){event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();}
function previewSendError(message,inputEl){const text=cleanDraft(inputEl),chatKey=chat().key,fingerprint=composerFingerprint(chatKey,text);composerState={chat:chatKey,original:text,translated:'',status:'error',error:message,fingerprint};sendComposerPreview('error',{error:message});}
function selectComposerContents(inputEl){
  inputEl.focus();
  const selection=window.getSelection?.(),range=document.createRange?.();
  if(!selection||!range)return;
  range.selectNodeContents(inputEl);selection.removeAllRanges();selection.addRange(range);
}
function notifyComposerInput(inputEl,text){
  // execCommand normally emits input itself.  WhatsApp's current editor can
  // re-render before React/Lexical observes that event, so send one explicit
  // input notification after the command as a compatibility bridge.
  try{inputEl.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:text}));}
  catch{inputEl.dispatchEvent(new Event('input',{bubbles:true}));}
}
function clearComposerContents(inputEl){
  inputEl.focus();
  try{document.execCommand('selectAll',false,null);document.execCommand('delete',false,null);}catch{}
  if(cleanDraft(inputEl)){selectComposerContents(inputEl);try{document.execCommand('delete',false,null);}catch{}}
  notifyComposerInput(inputEl,'');
}
function liveComposer(chatKey,expectedText){
  const current=editor();
  if(!current?.isConnected||!isDisplayed(current)||chatKey&&chat().key!==chatKey)return null;
  // Lexical may replace the contenteditable node during reconciliation.  Do
  // not blindly trust a replacement: it must still contain the exact draft
  // we expect (original before replacement, translated after replacement).
  if(expectedText!==undefined&&!composerTextMatches(cleanDraft(current),expectedText))return null;
  return current;
}
async function replaceComposerText(inputEl,translated,chatKey='',original=''){
  let current=liveComposer(chatKey,original)||liveComposer(chatKey),lastObserved='';
  if(!current)throw new Error('WhatsApp 输入框或聊天已变化，已阻止发送。');
  // WhatsApp/Lexical can re-render the composer while the translation request
  // is in flight. Re-translate the draft that is actually present instead of
  // rejecting a valid message because the old DOM text no longer matches.
  if(original!==undefined&&!composerTextMatches(cleanDraft(current),original)){
    const freshText=cleanDraft(current);
    if(!freshText)throw new Error('WhatsApp 输入框内容为空，已阻止发送。');
    original=freshText;
    translated=await translateComposer(current,original,chatKey);
    if(!translated)throw new Error('译文安全检查未通过，已阻止发送。');
  }
  let cleared=false;
  for(let attempt=0;attempt<5;attempt++){
    current=liveComposer(chatKey);if(!current)throw new Error('WhatsApp 输入框或聊天已变化，已阻止发送。');
    lastObserved=cleanDraft(current);
    if(composerTextMatches(lastObserved,translated)){
      await wait(90);current=liveComposer(chatKey,translated);if(current)return current;
      continue;
    }
    if(!cleared&&!composerTextMatches(lastObserved,original)){
      if(!lastObserved)throw new Error('WhatsApp 输入框内容为空，已阻止发送。');
      original=lastObserved;
      translated=await translateComposer(current,original,chatKey);
      if(!translated)throw new Error('译文安全检查未通过，已阻止发送。');
      await wait(80);
      continue;
    }
    // Select-and-replace is unreliable in WhatsApp's Lexical editor for long
    // multiline M3U messages: the caret stays mid-draft and the translation is
    // inserted into the old text. Clear the composer first, then insert.
    clearComposerContents(current);
    cleared=true;
    await wait(60);
    current=liveComposer(chatKey);if(!current)throw new Error('WhatsApp 输入框或聊天已变化，已阻止发送。');
    lastObserved=cleanDraft(current);
    if(lastObserved)selectComposerContents(current);
    const inserted=document.execCommand('insertText',false,translated);
    notifyComposerInput(current,translated);
    await wait(90+attempt*70);
    current=liveComposer(chatKey);if(!current)throw new Error('WhatsApp 输入框或聊天已变化，已阻止发送。');lastObserved=cleanDraft(current);
    // Some Chromium builds report `false` even though the command updated a
    // contenteditable. Trust the observed DOM only after it matches exactly
    // after normalization, rather than trusting the command's boolean.
    if(composerTextMatches(lastObserved,translated)){
      // Give a controlled React/Lexical editor one more frame to settle.  We
      // never send until the translated text remains stable after that frame.
      await wait(90);
      current=liveComposer(chatKey,translated);if(current)return current;
    }
  }
  // Some WhatsApp builds run the composer in a controlled React/Lexical tree
  // where execCommand mutates the DOM briefly and then restores the old value.
  // Ask Electron's focused WebContents to perform one native insertion as a
  // compatibility fallback. This still uses the browser's editing pipeline;
  // we verify the resulting DOM and never send if it remains uncertain.
  current=liveComposer(chatKey,original);if(!current)throw new Error('WhatsApp 输入框或聊天已变化，已阻止发送。');
  selectComposerContents(current);let fallbackError=null;
  try{await ipcRenderer.invoke('wa:insert-text',{chat:chatKey,text:translated});notifyComposerInput(current,translated);await wait(140);current=liveComposer(chatKey,translated);if(current){await wait(90);current=liveComposer(chatKey,translated);if(current)return current;}}catch(error){fallbackError=error;}
  if(fallbackError?.message&&!/No handler registered/i.test(fallbackError.message))throw new Error('无法通过原生输入接口写入译文，已阻止发送。');
  throw new Error('无法确认 WhatsApp 已接收完整译文（输入框状态未稳定），已阻止发送；请重试。');
}
async function doSendTranslated(inputEl){
  if(sendTask)return sendTask;
  const task=(async()=>{
    isSendingTranslated=true;clearTimeout(composerTimer);composerTimer=null;
    const before=chat(),chatKey=before.key,original=cleanDraft(inputEl);
    try{
      if(!chatKey)throw new Error('尚未识别当前聊天，已阻止发送。');
      if(!original)throw new Error('输入框为空，未发送。');
      if(config.translateSend===false)throw new Error('自动翻译发送已关闭。');
      const translated=await translateComposer(inputEl,original,chatKey);
      inputEl=liveComposer(chatKey,original);if(!inputEl)throw new Error('聊天或草稿已变化，已阻止发送。');
      if(!translated)throw new Error('译文安全检查未通过，已阻止发送。');
      composerState={...composerState,status:'replacing'};sendComposerPreview('replacing');inputEl.focus();
      if(document.activeElement!==inputEl)throw new Error('无法聚焦 WhatsApp 输入框，已阻止发送。');
      inputEl=await replaceComposerText(inputEl,translated,chatKey,original);
      if(!inputEl||chat().key!==chatKey)throw new Error('聊天已切换；译文未发送，请检查当前草稿。');
      // replaceComposerText already verified the inserted draft. A second strict
      // check after WhatsApp's React/Lexical repaint can reject valid long,
      // multiline M3U text after URL linkification. Only block an empty draft.
      if(!cleanDraft(inputEl))throw new Error('WhatsApp 输入框为空，已阻止发送。');
      const sendButton=currentSendButton(inputEl);composerState={...composerState,status:'sending'};sendComposerPreview('sending');allowNativeSend=true;
      try{
        if(sendButton)sendButton.click();
        else inputEl.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',code:'Enter',keyCode:13,which:13,bubbles:true,cancelable:true}));
      }finally{allowNativeSend=false;}
      // Never retry automatically: if WhatsApp accepted the click, a retry could
      // duplicate a customer's message.  We only observe whether the draft clears.
      let remaining=translated,emptyPolls=0,draftChanged=false,chatChanged=false;
      for(let i=0;i<10;i++){
        await wait(100);if(chat().key!==chatKey){chatChanged=true;break;}
        const after=editor();if(!after?.isConnected){emptyPolls=0;continue;}
        const observed=cleanDraft(after);
        // A user may start composing the next message immediately after
        // WhatsApp accepts this one.  Do not mistake that new draft for a
        // failed send, and never overwrite its state with the old result.
        if(observed&&!composerTextMatches(observed,translated)){remaining=observed;draftChanged=true;break;}
        remaining=observed;if(!remaining){emptyPolls++;if(emptyPolls>=2)break;}else emptyPolls=0;
      }
      if(draftChanged||chatChanged){composerState={chat:chatKey,original:'',translated:'',status:'sent',error:'',fingerprint:''};sendComposerPreview('sent',{chat:chatKey,original,translation:translated});}
      else if(!remaining&&emptyPolls>=2){composerState={chat:chatKey,original:'',translated:'',status:'sent',error:'',fingerprint:''};sendComposerPreview('sent',{chat:chatKey,original,translation:translated});setTimeout(()=>{if(!cleanDraft(editor()))resetComposerPreview();},650);}
      else{const message='WhatsApp 未确认消息已发送，译文草稿已保留；请检查聊天后再决定是否重试。';composerState={chat:chatKey,original:remaining||translated,translated:remaining||translated,status:'error',error:message,fingerprint:composerFingerprint(chatKey,remaining||translated)};sendComposerPreview('error',{error:message,translation:translated});}
      return{sent:true};
    }catch(error){const message=String(error?.message||'发送未完成。').replace(/^Error invoking remote method[^:]+: /,'').slice(0,260);if(!error?.stale)previewSendError(message,inputEl);return{sent:false,error:message};}
    finally{isSendingTranslated=false;const nextInput=editor(),nextText=cleanDraft(nextInput);if(!nextText)resetComposerPreview();else if(composerState.status!=='error'||composerState.original!==nextText||composerState.chat!==chat().key)scheduleComposerTranslation(nextInput);}
  })();sendTask=task;try{return await task;}finally{if(sendTask===task)sendTask=null;}
}
function interceptComposerSend(event,inputEl){
  if(allowNativeSend)return false;const text=cleanDraft(inputEl);if(!text)return false;
  if(isSendingTranslated){stopNativeSend(event);return true;}
  // Translation is source-language agnostic.  Only an explicitly disabled
  // translate-send setting lets the native WhatsApp send proceed untouched.
  // Keep the historical Chinese safety switch as a compatibility fallback in
  // that disabled mode, but never use it to bypass translation for foreign
  // language drafts.
  if(config.translateSend===false){
    if(config.blockChinese&&chineseText(text)){stopNativeSend(event);previewSendError('中文发送保护已开启；请开启“翻译后发送”。',inputEl);return true;}
    setTimeout(()=>{if(!cleanDraft(editor()))resetComposerPreview();},100);return false;
  }
  stopNativeSend(event);
  doSendTranslated(inputEl).catch(()=>{});return true;
}
function handleComposerKeydown(event){
  if(event.key!=='Enter'||event.shiftKey||event.isComposing||event.keyCode===229)return;const inputEl=editor();if(!inputEl)return;
  const focused=document.activeElement;const inEditor=focused===inputEl||inputEl.contains(focused)||event.target===inputEl||inputEl.contains(event.target);if(!inEditor)return;interceptComposerSend(event,inputEl);
}
function handleComposerClick(event){const button=sendButtonFromTarget(event.target);if(!button)return;const inputEl=editor();if(inputEl)interceptComposerSend(event,inputEl);}
window.addEventListener('keydown',handleComposerKeydown,true);
window.addEventListener('click',handleComposerClick,true);
document.addEventListener('input',onComposerInput,true);

// Incoming customer voice messages are handled independently from the proven
// composer/send path above. Existing history remains manual. New incoming
// voices rendered after the current chat is established are processed through
// one serial queue, so detached WhatsApp audio players cannot steal each
// other's source URL. Nothing is ever inserted, replied or sent automatically.
const voiceEntries=new WeakMap();
const VOICE_SOURCE_LIMIT=15*1024*1024,VOICE_WAV_LIMIT=25*1024*1024,VOICE_DURATION_LIMIT=120,VOICE_SAMPLE_RATE=16000;
const WHATSAPP_MEDIA_EVENT='SUPER_TRANSLATE_WHATSAPP_MEDIA_PLAY_V1';
const WHATSAPP_MEDIA_CAPTURE_EVENT='SUPER_TRANSLATE_WHATSAPP_MEDIA_CAPTURE_V1';
const WHATSAPP_MEDIA_CAPTURE_ACK_EVENT='SUPER_TRANSLATE_WHATSAPP_MEDIA_CAPTURE_ACK_V1';
let latestVoiceMedia={src:'',at:0,token:''},voiceCaptureSequence=0,voiceCaptureTail=Promise.resolve();
let voiceChatKey='',voiceAutoReadyAt=0,knownVoiceKeys=new Set(),voiceAutoQueue=Promise.resolve(),voiceAutoJobs=new Map();
function acceptedVoiceSource(value){
  const raw=String(value||'').trim();if(!raw)return'';let parsed;try{parsed=new URL(raw,location.href);}catch{return'';}
  const localFixture=location.protocol==='file:'&&parsed.protocol==='http:'&&['127.0.0.1','localhost'].includes(parsed.hostname);
  if(localFixture)return parsed.href;
  if(parsed.protocol==='blob:'&&parsed.origin===location.origin)return parsed.href;
  if(parsed.protocol==='data:'&&/^data:audio\//i.test(raw))return raw;
  if(parsed.protocol==='https:'&&(parsed.hostname==='web.whatsapp.com'||parsed.hostname.endsWith('.whatsapp.net')||parsed.hostname.endsWith('.whatsapp.com')))return parsed.href;
  return'';
}
window.addEventListener('message',event=>{
  if(event.source!==window||event.data?.type!==WHATSAPP_MEDIA_EVENT)return;
  if(location.protocol!=='file:'&&event.origin!==location.origin)return;
  const src=acceptedVoiceSource(event.data?.src),token=String(event.data?.token||'');if(src)latestVoiceMedia={src,at:Date.now(),token};
},true);
function stableVoiceId(value){const key=String(value||'').replace(/[\u200b\u200c\u200d\ufeff]/g,'').trim();return key&&key.length<=300&&/[A-Za-z0-9]/.test(key)?key:'';}
function voiceMessageIdHost(root){
  if(!root)return null;
  if(stableVoiceId(root.getAttribute?.('data-id')))return root;
  const container=root.querySelector?.('[data-testid="msg-container"][data-id],[data-testid^="conv-msg-"][data-id]');
  if(container&&stableVoiceId(container.getAttribute('data-id')))return container;
  const content=root.querySelector?.('[data-pre-plain-text]'),anchored=content?.closest?.('[data-id]');
  if(anchored&&root.contains(anchored)&&stableVoiceId(anchored.getAttribute('data-id')))return anchored;
  const whatsappId=root.querySelector?.('[data-id^="false_"],[data-id^="true_"]');
  return whatsappId&&stableVoiceId(whatsappId.getAttribute('data-id'))?whatsappId:null;
}
function voiceMessageExplicitKey(root){
  const host=voiceMessageIdHost(root),value=stableVoiceId(host?.getAttribute?.('data-id'));if(value)return value;
  const testHost=root?.matches?.('[data-testid^="conv-msg-"]')?root:root?.querySelector?.('[data-testid^="conv-msg-"]'),testId=String(testHost?.getAttribute?.('data-testid')||'');
  return stableVoiceId(testId.replace(/^conv-msg-/,''));
}
function voiceMessageKey(root){return voiceMessageExplicitKey(root)||stableVoiceId(root?.getAttribute?.('data-st-voice-key'));}
const VOICE_PRIMARY_SLIDER_SELECTOR='[role="slider"],input[type="range"]';
const VOICE_PRIMARY_CONTROL_SELECTOR='button[aria-label*="语音"],button[aria-label*="voice" i],button[aria-label*="audio" i],[role="button"][aria-label*="语音"],[role="button"][aria-label*="voice" i],[role="button"][aria-label*="audio" i]';
const VOICE_PRIMARY_ICON_SELECTOR='[data-icon*="audio" i],[data-testid*="audio" i]';
const VOICE_PRIMARY_STATUS_SELECTOR='audio,[data-icon*="ptt" i],[data-testid*="ptt" i],[aria-label="语音消息"],[aria-label*="voice message" i]';
function voicePrimarySignals(root){
  if(!root)return[];
  const select=selector=>{const nodes=[];if(root.matches?.(selector))nodes.push(root);for(const node of root.querySelectorAll?.(selector)||[])if(!nodes.includes(node))nodes.push(node);return nodes;};
  const sliders=select(VOICE_PRIMARY_SLIDER_SELECTOR);if(sliders.length)return sliders;
  // Prefer icon-backed controls over aria labels. WhatsApp adds a label only
  // to the player that was most recently clicked; using labels first would
  // make a five-message group collapse back to one unit after voice 1 plays.
  const iconControls=[];for(const icon of select(VOICE_PRIMARY_ICON_SELECTOR)){const control=icon.closest?.('button,[role="button"],[tabindex="0"]'),anchor=control&&(control===root||root.contains(control))?control:icon;if(!iconControls.includes(anchor))iconControls.push(anchor);}if(iconControls.length)return iconControls;
  const controls=select(VOICE_PRIMARY_CONTROL_SELECTOR);return controls.length?controls:select(VOICE_PRIMARY_STATUS_SELECTOR);
}
function voiceUnitCount(root){return voicePrimarySignals(root).length;}
function isolateVoiceUnitRoot(node,boundary){
  if(!node||!boundary||!boundary.contains(node)&&node!==boundary)return null;
  // Current WhatsApp can group several consecutive bubbles under one
  // .message-in wrapper. Keep walking upward only while the candidate still
  // contains exactly one player/progress unit; the last such ancestor is the
  // individual bubble, even when WhatsApp removed every legacy message id.
  let current=node.nodeType===1?node:node.parentElement,best=null;
  for(;current;current=current.parentElement){
    const count=voiceUnitCount(current);if(count===1)best=current;else if(count>1)break;
    if(current===boundary)break;
  }
  return best&&best!==boundary?best:voiceUnitCount(boundary)===1?boundary:null;
}
function narrowGroupedVoiceRoot(node,candidate){return voiceUnitCount(candidate)>1?isolateVoiceUnitRoot(node,candidate):candidate;}
function findVoiceMessageRoot(node){
  if(!node)return null;
  // Start from the message container and walk outward to its own identity.
  // A directional wrapper can contain multiple adjacent bubbles; choosing it
  // first collapses those bubbles onto the first descendant data-id.
  const container=node.closest?.('[data-testid="msg-container"],[data-testid^="conv-msg-"]');
  if(container){
    for(let current=container;current&&current!==main();current=current.parentElement){
      const directId=stableVoiceId(current.getAttribute?.('data-id')),testId=String(current.getAttribute?.('data-testid')||'');
      if(directId||testId.startsWith('conv-msg-'))return narrowGroupedVoiceRoot(node,current);
    }
    return narrowGroupedVoiceRoot(node,container);
  }
  const content=node.closest?.('[data-pre-plain-text]');if(content){const idHost=content.closest?.('[data-id]');return narrowGroupedVoiceRoot(node,idHost||content);}
  const directional=node.closest?.('.message-in,.message-out,[data-st-direction="in"],[data-st-direction="out"]');
  if(directional)return narrowGroupedVoiceRoot(node,directional);
  const idHost=node.closest?.('[data-id]');
  if(idHost&&(idHost.querySelector?.('[data-pre-plain-text]')||idHost.querySelector?.('[data-icon="tail-in"],[data-testid="tail-in"],[data-icon="tail-out"],[data-testid="tail-out"]')))return narrowGroupedVoiceRoot(node,idHost);
  return null;
}
function explicitVoiceDirection(root,key){
  if(!root)return'';
  const outgoing=!!root.closest?.('.message-out,[data-st-direction="out"]')||!!root.querySelector?.('[data-icon="tail-out"],[data-testid="tail-out"]')||String(key||'').startsWith('true_');
  const incoming=!!root.closest?.('.message-in,[data-st-direction="in"]')||!!root.querySelector?.('[data-icon="tail-in"],[data-testid="tail-in"]')||String(key||'').startsWith('false_');
  return outgoing&&incoming?'conflict':outgoing?'out':incoming?'in':'';
}
function groupedVoiceDirection(root){
  // Live WhatsApp renders one conv-msg per bubble, but only the FIRST bubble
  // of a same-direction sibling group has a tail. Inherit direction, never
  // identity, from that bounded group. Do not search the conversation list.
  const selector='[data-testid^="conv-msg-"]',message=root?.matches?.(selector)?root:root?.closest?.(selector);
  if(!message)return'';
  const boundary='#main,main,[data-testid="conversation-panel-messages"],[role="log"],[role="list"],[role="grid"],[tabindex="0"]';
  for(let group=message.parentElement,depth=0;group&&depth<6;group=group.parentElement,depth++){
    if(group.matches(boundary))return'';
    const messages=[...group.querySelectorAll(selector)];if(messages.length<2)continue;
    // Every immediate message-bearing branch must contain exactly one row.
    // A container of whole groups is not itself a message group.
    const branches=[...group.children].map(child=>child.matches(selector)?[child]:[...child.querySelectorAll(selector)]).filter(items=>items.length);
    if(branches.length!==messages.length||branches.some(items=>items.length!==1))return'';
    const first=messages[0];
    if(!first.querySelector('[data-icon="tail-in"],[data-testid="tail-in"],[data-icon="tail-out"],[data-testid="tail-out"]'))return'';
    const direction=explicitVoiceDirection(first,voiceMessageExplicitKey(first));
    if(direction!=='in'&&direction!=='out')return'';
    if(messages.some(item=>{const own=explicitVoiceDirection(item,voiceMessageExplicitKey(item));return own&&own!==direction;}))return'';
    return direction;
  }
  return'';
}
function isIncomingVoice(root,key){
  const direction=explicitVoiceDirection(root,key||voiceMessageExplicitKey(root));
  return (direction||groupedVoiceDirection(root))==='in';
}
const VOICE_SIGNAL_SELECTOR='audio,[data-icon*="audio" i],[data-testid*="audio" i],[data-icon*="ptt" i],[data-testid*="ptt" i],button[aria-label*="语音"],button[aria-label*="voice" i],button[aria-label*="audio" i],[role="slider"],input[type="range"],[aria-label="语音消息"],[aria-label*="voice message" i]';
function hasVoiceSignal(root){return !!root?.querySelector?.(VOICE_SIGNAL_SELECTOR);}
function voiceFallbackHash(value){let hash=2166136261;for(const char of String(value||'')){hash^=char.codePointAt(0);hash=Math.imul(hash,16777619);}return(hash>>>0).toString(36);}
function voiceFallbackSignature(root){
  const clone=root.cloneNode(true);clone.querySelectorAll?.('.st-voice-translation,script,style').forEach(node=>node.remove());
  const clean=value=>String(value||'').replace(/[\u200b\u200c\u200d\ufeff]/g,'').replace(/\s+/g,' ').trim().slice(0,500);
  const meta=[...clone.querySelectorAll?.('[data-testid="msg-meta"],[data-pre-plain-text],time,[title],[aria-label]')||[]].map(node=>{
    let label=String(node.getAttribute?.('aria-label')||'').replace(/播放|暂停|play|pause/ig,'voice');
    return clean([node.getAttribute?.('data-pre-plain-text'),node.getAttribute?.('datetime'),node.getAttribute?.('title'),label,node.textContent].filter(Boolean).join(':'));
  }).filter(Boolean).slice(0,24).join('|');
  const structure=[clone,...clone.querySelectorAll?.('*')||[]].slice(0,80).map(node=>`${String(node.tagName||'').toLowerCase()}:${clean(node.getAttribute?.('role'))}:${clean(String(node.getAttribute?.('data-testid')||'').replace(/audio-play|audio-pause/ig,'audio-control'))}:${clean(String(node.getAttribute?.('data-icon')||'').replace(/audio-play|audio-pause/ig,'audio-control'))}`).join(',');
  const direction=root.matches?.('.message-out,[data-st-direction="out"]')||root.closest?.('.message-out,[data-st-direction="out"]')?'out':'in';
  return voiceFallbackHash([direction,clean(clone.textContent),meta,structure].join('\n'));
}
function assignVoiceFallbackKeys(roots){
  const groups=new Map();
  for(const root of roots){if(voiceMessageExplicitKey(root))continue;const current=String(root.getAttribute?.('data-st-voice-key')||''),match=current.match(/^st-voice-fallback-([a-z0-9]+)-\d+$/),signature=match?.[1]||voiceFallbackSignature(root);if(!groups.has(signature))groups.set(signature,[]);groups.get(signature).push(root);}
  for(const [signature,items] of groups){
    const prefix=`st-voice-fallback-${signature}-`,reserved=new Set();
    for(const root of items){const current=String(root.getAttribute?.('data-st-voice-key')||'');if(current.startsWith(prefix)){const occurrence=Number(current.slice(prefix.length));if(Number.isSafeInteger(occurrence)&&occurrence>0)reserved.add(occurrence);}}
    let overflow=reserved.size?Math.max(...reserved)+1:items.length+1;
    items.forEach((root,index)=>{const current=String(root.getAttribute?.('data-st-voice-key')||'');if(current.startsWith(prefix))return;let occurrence=index+1;if(reserved.has(occurrence)){while(reserved.has(overflow))overflow++;occurrence=overflow++;}reserved.add(occurrence);root.setAttribute('data-st-voice-key',`${prefix}${occurrence}`);});
  }
}
function resetVoiceTracking(chatKey){
  voiceChatKey=String(chatKey||'');knownVoiceKeys=new Set();voiceAutoJobs=new Map();voiceAutoReadyAt=Date.now()+1000;
  if(!voiceChatKey)return;
  for(const root of voiceRoots()){const key=voiceMessageKey(root);if(key)knownVoiceKeys.add(key);}
}
function voiceRoots(){
  const container=main();if(!container)return[];const candidates=[],seen=new Set(),accept=root=>{if(!root||seen.has(root)||!hasVoiceSignal(root)||!isIncomingVoice(root,voiceMessageExplicitKey(root)))return;seen.add(root);candidates.push(root);};
  for(const signal of container.querySelectorAll(VOICE_SIGNAL_SELECTOR))accept(findVoiceMessageRoot(signal));
  // Current WhatsApp releases regularly rename the play icon/test id. Walking
  // bounded message roots as a fallback catches slider-only voice bubbles. Do
  // not treat an arbitrary descendant data-id as the message identity: current
  // players reuse internal ids across several adjacent voice rows.
  for(const candidate of container.querySelectorAll('.message-in,.message-out,[data-st-direction="in"],[data-st-direction="out"],[data-testid="msg-container"],[data-testid^="conv-msg-"]'))accept(findVoiceMessageRoot(candidate));
  assignVoiceFallbackKeys(candidates);const roots=[],seenKeys=new Set();for(const root of candidates){const key=voiceMessageKey(root);if(!key||seenKeys.has(key))continue;seenKeys.add(key);roots.push(root);}return roots;
}
function voiceAudio(root){return root?.querySelector?.('audio')||null;}
function voiceAudioSource(audio){return String(audio?.currentSrc||audio?.src||audio?.querySelector?.('source[src]')?.src||'').trim();}
function voiceMount(root){return root?.querySelector?.('[data-testid="msg-container"]')||root?.querySelector?.('[data-pre-plain-text]')||root?.querySelector?.('.copyable-text')||root;}
// The WhatsApp player is global (often detached from the message bubble), so
// two simultaneous reads would race on the bridge's single capture token.
// Serialize only the short arm/play/capture section; ASR and translation stay
// outside this lock and can continue using the per-message queue semantics.
function withVoiceCaptureLock(task){
  const previous=voiceCaptureTail;let release;
  voiceCaptureTail=new Promise(resolve=>{release=resolve;});
  return previous.catch(()=>{}).then(task).finally(()=>release());
}
function voicePlayControl(root){
  const icon=root?.querySelector?.('[data-icon="audio-play"],[data-icon="audio-pause"],[data-testid*="audio-play"]'),iconButton=icon?.closest?.('button,[role="button"]');if(iconButton)return iconButton;
  const controls=[...(root?.querySelectorAll?.('button,[role="button"]')||[])].filter(button=>!button.classList?.contains('st-voice-action'));
  const labelled=controls.find(button=>/(?:播放|暂停).*语音消息|(?:play|pause).*voice message/i.test(String(button.getAttribute?.('aria-label')||'')));if(labelled)return labelled;
  // Some current WhatsApp voice rows expose only an audio-progress slider and
  // remove the old play icon/test-id. Once the message root has already been
  // positively identified as a voice bubble, select the nearest non-menu
  // button in the slider row as the media trigger.
  const slider=root?.querySelector?.('[role="slider"],input[type="range"]');
  if(!slider)return null;
  let scope=slider.parentElement;
  for(let depth=0;scope&&scope!==root&&depth<4;depth++,scope=scope.parentElement){
    const nearby=[...(scope.querySelectorAll?.('button,[role="button"]')||[])].find(button=>!button.classList?.contains('st-voice-action')&&!/(?:菜单|menu|更多|more|表情|emoji|回应|react)/i.test(String(button.getAttribute?.('aria-label')||'')));
    if(nearby)return nearby;
  }
  return controls.find(button=>!/(?:菜单|menu|更多|more|表情|emoji|回应|react)/i.test(String(button.getAttribute?.('aria-label')||'')))||null;
}
function voiceStillCurrent(entry,chatKey,token){const current=chat();return entry.root.isConnected&&entry.key===voiceMessageKey(entry.root)&&voiceChatKeyFor(current.key)===chatKey&&epoch===token;}
function encodeVoicePcm(samples,sampleRate=VOICE_SAMPLE_RATE){
  const bytes=new ArrayBuffer(44+samples.length*2),view=new DataView(bytes);const write=(offset,value)=>{for(let i=0;i<value.length;i++)view.setUint8(offset+i,value.charCodeAt(i));};
  write(0,'RIFF');view.setUint32(4,36+samples.length*2,true);write(8,'WAVE');write(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,sampleRate,true);view.setUint32(28,sampleRate*2,true);view.setUint16(32,2,true);view.setUint16(34,16,true);write(36,'data');view.setUint32(40,samples.length*2,true);
  for(let i=0,offset=44;i<samples.length;i++,offset+=2){const sample=Math.max(-1,Math.min(1,samples[i]));view.setInt16(offset,sample<0?sample*0x8000:sample*0x7fff,true);}return bytes;
}
async function decodeIncomingVoice(bytes){
  const AudioContextClass=window.AudioContext||window.webkitAudioContext,OfflineClass=window.OfflineAudioContext||window.webkitOfflineAudioContext;
  if(!AudioContextClass||!OfflineClass)throw new Error('当前客户端无法解码这条语音，请更新超级翻译。');
  const context=new AudioContextClass();let decoded;
  try{decoded=await context.decodeAudioData(bytes.slice(0));}catch{throw new Error('WhatsApp 语音尚未完整加载，请先播放一次后重试。');}finally{try{await context.close();}catch{}}
  if(!Number.isFinite(decoded.duration)||decoded.duration<0.2)throw new Error('语音过短或文件不完整。');
  if(decoded.duration>VOICE_DURATION_LIMIT)throw new Error('单条语音最长支持 120 秒，请让客户分段发送。');
  const frames=Math.max(1,Math.ceil(decoded.duration*VOICE_SAMPLE_RATE)),offline=new OfflineClass(1,frames,VOICE_SAMPLE_RATE),source=offline.createBufferSource();source.buffer=decoded;source.connect(offline.destination);source.start(0);const rendered=await offline.startRendering(),wav=encodeVoicePcm(rendered.getChannelData(0));
  if(wav.byteLength>VOICE_WAV_LIMIT)throw new Error('语音转换后超过 25 MB，无法识别。');return wav;
}
async function readIncomingVoice(entry){
  let audio=voiceAudio(entry.root),source=acceptedVoiceSource(voiceAudioSource(audio));
  const existingSource=source,play=voicePlayControl(entry.root);
  if(play){
    // Prefer a URL emitted by this explicit play operation. If the bridge is
    // unavailable, retain a pre-existing DOM source as a compatibility
    // fallback rather than breaking already-loaded WhatsApp voice rows.
    let captured='';try{captured=await withVoiceCaptureLock(async()=>{
      const started=Date.now(),captureToken=`${started.toString(36)}-${(++voiceCaptureSequence).toString(36)}`;
      const announce=token=>window.postMessage({type:WHATSAPP_MEDIA_CAPTURE_EVENT,token},location.origin==='null'?'*':location.origin);
      const armCapture=()=>new Promise(resolve=>{let settled=false;const finish=value=>{if(settled)return;settled=true;clearTimeout(timer);window.removeEventListener('message',onMessage,true);resolve(value);},onMessage=event=>{if(event.source===window&&event.data?.type===WHATSAPP_MEDIA_CAPTURE_ACK_EVENT&&event.data?.token===captureToken)finish(true);},timer=setTimeout(()=>finish(false),1000);window.addEventListener('message',onMessage,true);announce(captureToken);});
      let capturedSource='';
      const capture=async(rounds=40)=>{for(let i=0;i<rounds&&!capturedSource;i++){await wait(200);audio=voiceAudio(entry.root);const observed=acceptedVoiceSource(voiceAudioSource(audio));if(observed&&observed!==existingSource)capturedSource=observed;if(!capturedSource&&latestVoiceMedia.token===captureToken&&latestVoiceMedia.at>=started-50)capturedSource=acceptedVoiceSource(latestVoiceMedia.src);}};
      try{
        latestVoiceMedia={src:'',at:0,token:''};
        const armed=await armCapture();
        if(!armed&&!existingSource)throw new Error('语音播放器桥接未就绪，请重试。');
        play.click();await capture();
        // In a few current voice-row shapes the first click only initializes an
        // unlabeled control and changes it into a real "play voice" button. If
        // no per-operation URL was emitted, trigger that initialized button
        // once more before falling back to an already-loaded source.
        const retry=voicePlayControl(entry.root),retryLabel=String(retry?.getAttribute?.('aria-label')||'');
        if(!capturedSource&&retry&&/(?:播放).*语音消息|play.*voice message/i.test(retryLabel)){retry.click();await capture();}
      }finally{announce('');}
      try{audio=voiceAudio(entry.root);if(audio)audio.pause();else{const pause=voicePlayControl(entry.root);if(/(?:暂停).*语音消息|pause.*voice message/i.test(String(pause?.getAttribute?.('aria-label')||'')))pause.click();}}catch{}
      return capturedSource;
    });}catch(error){if(!existingSource)throw error;}
    if(captured)source=captured;else if(!source)source=existingSource;
  }
  if(!source)throw new Error('尚未取得语音文件，请先点击 WhatsApp 播放按钮加载语音后重试。');
  let parsed;try{parsed=new URL(source,location.href);}catch{throw new Error('语音文件地址无效。');}
  const localFixture=location.protocol==='file:'&&parsed.protocol==='http:'&&['127.0.0.1','localhost'].includes(parsed.hostname);
  if(!['blob:','data:','https:'].includes(parsed.protocol)&&!localFixture)throw new Error('语音来源不受支持。');
  let response,bytes;try{response=await fetch(parsed.href,{credentials:'include'});if(!response.ok)throw new Error(`HTTP ${response.status}`);const announced=Number(response.headers.get('content-length')||0);if(announced>VOICE_SOURCE_LIMIT)throw new Error('语音文件超过 15 MB。');bytes=await response.arrayBuffer();}catch(error){throw new Error(`无法读取这条语音：${error.message||error}`);}
  if(!bytes.byteLength||bytes.byteLength>VOICE_SOURCE_LIMIT)throw new Error('语音文件为空或超过 15 MB。');return decodeIncomingVoice(bytes);
}
function paintVoiceEntry(entry){
  entry.button.disabled=entry.busy;entry.button.textContent=entry.busy?(entry.automatic?'自动处理中…':'处理中…'):entry.translation?'重新翻译':entry.transcript?'翻译为中文':'转文字并翻译';entry.status.textContent=entry.statusText||'';entry.result.replaceChildren();
  if(entry.transcript){const original=document.createElement('div');original.className='st-voice-original';original.textContent='识别原文：'+entry.transcript;entry.result.append(original);}
  if(entry.translation){const translated=document.createElement('div');translated.className='st-voice-chinese';translated.textContent='中文译文：'+entry.translation;entry.result.append(translated);}
  if(entry.error){const error=document.createElement('div');error.className='st-voice-error';error.textContent=entry.error;entry.result.append(error);}
}
function ensureVoiceEntry(root,key){
  let entry=voiceEntries.get(root);
  if(entry&&entry.key!==key){entry.box.remove();voiceEntries.delete(root);entry=null;}
  if(!entry){
    const box=document.createElement('div');box.className='st-voice-translation';const line=document.createElement('div');line.className='st-voice-line';const button=document.createElement('button');button.type='button';button.className='st-voice-action';const status=document.createElement('small');status.className='st-voice-status';const result=document.createElement('div');result.className='st-voice-result';line.append(button,status);box.append(line,result);entry={root,key,box,button,status,result,busy:false,automatic:false,autoQueued:false,cacheChecked:false,cacheLoading:false,transcript:'',translation:'',language:'auto',error:'',statusText:'本地转写 · 手动触发'};const captured=entry;button.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();translateIncomingVoice(captured,false);});voiceEntries.set(root,entry);paintVoiceEntry(entry);setTimeout(()=>restoreVoiceEntry(entry),600);
  }
  const mount=voiceMount(root);if(mount&&entry.box.parentElement!==mount)mount.append(entry.box);
  return entry;
}
function currentVoiceEntry(key){
  const root=voiceRoots().find(candidate=>voiceMessageKey(candidate)===key);return root?ensureVoiceEntry(root,key):null;
}
async function restoreVoiceEntry(entry){
  if(entry.cacheChecked||entry.cacheLoading||entry.busy)return;entry.cacheLoading=true;const chatKey=chat().voiceKey||voiceChatKeyFor(chat().key),token=epoch;
  try{const cached=await ipcRenderer.invoke('wa:voice-cache-get',{chat:chatKey,message:entry.key});if(!voiceStillCurrent(entry,chatKey,token))return;entry.transcript=String(cached?.transcript||'');entry.translation=String(cached?.translation||'');entry.language=String(cached?.language||'auto');if(entry.translation)entry.statusText='已从本机恢复';else if(entry.transcript)entry.statusText='原文已识别，等待翻译';}
  catch{}finally{entry.cacheLoading=false;entry.cacheChecked=true;if(entry.root.isConnected)paintVoiceEntry(entry);}
}
async function translateIncomingVoice(entry,automatic=false){
  if(config.enabled===false){entry.error='翻译功能已关闭，请先开启。';entry.statusText='翻译功能已关闭';if(entry.root.isConnected)paintVoiceEntry(entry);return false;}
  if(entry.busy)return;const chatKey=chat().voiceKey||voiceChatKeyFor(chat().key),token=epoch;if(!chatKey)return;entry.busy=true;entry.automatic=automatic;entry.error='';if(entry.translation)entry.translation='';
  try{
    if(!entry.transcript){entry.statusText='正在读取客户语音…';paintVoiceEntry(entry);const wav=await readIncomingVoice(entry);if(!voiceStillCurrent(entry,chatKey,token))throw Object.assign(new Error('聊天已变化，旧语音结果已丢弃。'),{stale:true});entry.statusText='本地模型正在识别…';paintVoiceEntry(entry);const recognized=await ipcRenderer.invoke('wa:speech-transcribe',{chat:chatKey,message:entry.key,audio:wav});if(!voiceStillCurrent(entry,chatKey,token))throw Object.assign(new Error('聊天已变化，旧语音结果已丢弃。'),{stale:true});entry.transcript=String(recognized?.transcript||'').trim();entry.language=String(recognized?.language||'auto');if(!entry.transcript)throw new Error('没有识别到有效语音。');
    }
    entry.statusText='正在翻译为中文…';paintVoiceEntry(entry);const translated=await ipcRenderer.invoke('wa:translate',{text:entry.transcript,target:'zh-CN'});if(!voiceStillCurrent(entry,chatKey,token))throw Object.assign(new Error('聊天已变化，旧译文已丢弃。'),{stale:true});entry.translation=String(translated?.translation||'').trim();if(!entry.translation)throw new Error('翻译结果为空。');await ipcRenderer.invoke('wa:voice-cache-save',{chat:chatKey,message:entry.key,transcript:entry.transcript,translation:entry.translation,language:entry.language});entry.statusText=automatic?'已自动转写并翻译 · 不会自动发送':'已完成 · 不会自动发送';return true;
  }catch(error){if(!error?.stale){entry.error=String(error?.message||'语音识别失败。').replace(/^Error invoking remote method[^:]+: /,'').slice(0,260);entry.statusText=automatic?'自动处理失败 · 可点击重试':'处理失败';}return false;}
  finally{entry.busy=false;entry.automatic=false;if(entry.root.isConnected)paintVoiceEntry(entry);}
}
function queueIncomingVoice(key){
  const queuedChatKey=voiceChatKey,queuedEpoch=epoch,jobKey=queuedEpoch+'\0'+queuedChatKey+'\0'+key;if(!key||!queuedChatKey||voiceAutoJobs.has(jobKey))return;
  voiceAutoJobs.set(jobKey,'queued');const initial=currentVoiceEntry(key);if(initial){initial.autoQueued=true;initial.statusText='新客户语音 · 等待自动转写';paintVoiceEntry(initial);}
  voiceAutoQueue=voiceAutoQueue.catch(()=>{}).then(async()=>{
    let entry=null,outcome='stale';
    try{
      await wait(900);if((chat().voiceKey||voiceChatKeyFor(chat().key))!==queuedChatKey||voiceChatKey!==queuedChatKey||epoch!==queuedEpoch)return;
      entry=currentVoiceEntry(key);if(!entry){outcome='retry';return;}voiceAutoJobs.set(jobKey,'running');entry.autoQueued=true;
      await restoreVoiceEntry(entry);entry=currentVoiceEntry(key);if(!entry){outcome='retry';return;}if(entry.translation){outcome='done';return;}
      const completed=await translateIncomingVoice(entry,true);outcome=completed?'done':voiceStillCurrent(entry,queuedChatKey,queuedEpoch)?'failed':'retry';
    }finally{
      if(entry)entry.autoQueued=false;
      const sameChat=(chat().voiceKey||voiceChatKeyFor(chat().key))===queuedChatKey&&voiceChatKey===queuedChatKey&&epoch===queuedEpoch;
      if(sameChat&&outcome==='retry'){voiceAutoJobs.delete(jobKey);knownVoiceKeys.delete(key);setTimeout(scan,0);}
      else if(sameChat&&(outcome==='done'||outcome==='failed'))voiceAutoJobs.set(jobKey,outcome);
      else voiceAutoJobs.delete(jobKey);
    }
  });
}
function decorateIncomingVoiceMessages(){
  const current=chat().voiceKey||voiceChatKeyFor(chat().key);if(current!==voiceChatKey)resetVoiceTracking(current);
  for(const root of voiceRoots()){
    const key=voiceMessageKey(root);if(!key)continue;const entry=ensureVoiceEntry(root,key),newVoice=!knownVoiceKeys.has(key)&&Date.now()>=voiceAutoReadyAt;
    // Keys first observed during the one-second chat warm-up remain eligible.
    // Marking them known here would silently consume a real newly-arrived voice.
    if(newVoice){knownVoiceKeys.add(key);queueIncomingVoice(key);}else if(knownVoiceKeys.has(key)&&entry.autoQueued&&!entry.box.isConnected)ensureVoiceEntry(root,key);
  }
}
function messageText(el){return [...el.querySelectorAll('span.selectable-text')].filter(s=>!s.closest('.st-translation')).map(s=>s.innerText).join('\n').trim();}
function visible(el){const r=el.getBoundingClientRect();const top=main()?.querySelector('header')?.getBoundingClientRect().bottom||0;const bottom=main()?.querySelector('footer')?.getBoundingClientRect().top||innerHeight;return r.width>0&&r.height>0&&r.bottom>top&&r.top<bottom;}
function style(){if(document.getElementById('st-inline-style'))return;const s=document.createElement('style');s.id='st-inline-style';s.textContent='.st-name-host{font-size:0!important}.st-display-name{font-size:13px;line-height:1.4}.st-translation{border-top:1px dashed #bfd4c2;margin-top:5px;padding:4px 0 2px;color:#597c62;font:12px/1.55 "Segoe UI","Microsoft YaHei",sans-serif;white-space:pre-wrap}.st-translation button{font:11px "Segoe UI","Microsoft YaHei",sans-serif;color:#5793d3;background:none;border:0;padding:0 3px;cursor:pointer}.st-translation small{font-size:11px;color:#96a7a0}.st-translation .st-text{display:block;max-width:650px}.st-translation .st-error{color:#af6949}.st-voice-translation{border-top:1px dashed #9fd6c2;margin-top:6px;padding:6px 0 2px;font:12px/1.55 "Segoe UI","Microsoft YaHei",sans-serif;max-width:650px}.st-voice-line{display:flex;align-items:center;gap:7px;flex-wrap:wrap}.st-voice-action{border:1px solid #54b995;border-radius:14px;background:#eafaf4;color:#087a59;padding:3px 9px;font:600 11px "Segoe UI","Microsoft YaHei",sans-serif;cursor:pointer}.st-voice-action:hover{background:#dff7ed}.st-voice-action:disabled{opacity:.65;cursor:wait}.st-voice-status{color:#7c948b;font-size:10px}.st-voice-result{margin-top:4px;white-space:pre-wrap;word-break:break-word}.st-voice-original{color:#526c65}.st-voice-chinese{margin-top:2px;color:#087a59;font-weight:600}.st-voice-error{margin-top:2px;color:#b45c4b}';document.head?.append(s);}
function translateOne(el,entry,automatic=false){
  if(config.enabled===false){entry.output.textContent='翻译功能已关闭，请先开启。';entry.output.classList.add('st-error');entry.button.textContent='翻译为中文';return;}
  if(entry.busy)return;entry.busy=true;entry.attempted=true;entry.button.disabled=true;entry.output.textContent='等待翻译…';const key=chat().key,text=messageText(el),target=config.incoming,token=epoch,cacheKey=JSON.stringify([key,text,target]);pendingCount++;
  queued=queued.catch(()=>{}).then(async()=>{
    const valid=()=>el.isConnected&&key===chat().key&&text===messageText(el)&&token===epoch&&config.enabled!==false&&(!automatic||!paused&&(config.history||config.automatic));
    try{if(!valid()){entry.attempted=false;entry.output.textContent='';return;}entry.output.textContent='翻译中…';let value=automatic?cache.get(cacheKey):null;if(!value){const r=await ipcRenderer.invoke('wa:translate',{text,target});value=r.translation;cache.set(cacheKey,value);if(cache.size>1000)cache.delete(cache.keys().next().value);}if(!valid()){entry.attempted=false;entry.output.textContent='';return;}failures=0;entry.output.classList.remove('st-error');entry.output.textContent='译文：'+value;entry.button.textContent='重新翻译';entry.done=true;translatedCount++;}
    catch(e){if(valid()){failures++;if(automatic&&failures>=3)paused=true;entry.output.classList.add('st-error');entry.output.textContent=String(e.message).replace(/^Error invoking remote method[^:]+: /,'').slice(0,250);entry.button.textContent='重试';}}
    finally{entry.busy=false;entry.button.disabled=false;pendingCount--;if(automatic)await new Promise(r=>setTimeout(r,250));scan();}
  });
}
const openchatSeen=new WeakSet(),openchatContacts=new Set(),incomingSeen=new WeakSet(),outgoingSeen=new WeakSet(),unanswered=new Map();let openchatArmed=false,incomingArmed=false;
function openchatHidden(text){
  const match=String(text||'').match(/\u2063([\u200b\u200c]+)\u2063/);if(!match)return'';
  const bits=match[1].replace(/\u200b/g,'0').replace(/\u200c/g,'1'),bytes=bits.match(/.{8}/g)||[];
  try{return bytes.map(byte=>String.fromCharCode(parseInt(byte,2))).join('');}catch{return'';}
}
function openchatTail(text){const clean=String(text||'').replace(/[\u200b\u200c\u2063]/g,'').trim();return clean?Array.from(clean).slice(-1).join(''):'';}
function maybeOpenchat(el,c,text){
  if(!openchatArmed||!c?.key||openchatContacts.has(c.key))return;
  if(el.closest?.('.message-out,[data-st-direction="out"]'))return;
  openchatContacts.add(c.key);
  const phone=String(c.phone||knownPhones.get(c.key)||String(c.key||'').match(/\d{7,15}/)?.[0]||'').replace(/[^\d]/g,'');
  try{ipcRenderer.invoke('desktop:openchat-open',{platform:'WhatsApp',staff:String(c.title||''),phone,identify:openchatHidden(text),fingerprint:openchatTail(text),event:''}).catch(()=>{});}catch{}
}
function scan(){
  style();let c=chat();const chatChanged=c.key?(!lastChat||!sameChatKey(c.key,lastChat)):!!lastChat;if(chatChanged){lastChat=c.key;config.automatic=false;config.history=false;autoRemaining=0;epoch++;paused=false;failures=0;translatedCount=0;resetComposerPreview();resetVoiceTracking(c.voiceKey||voiceChatKeyFor(c.key));}
  if(c.key&&!c.phone&&!c.group){const phone=profilePhone();if(phone){knownPhones.set(c.key,phone);c=chat();}}annotate();decorate();decorateIncomingVoiceMessages();
  let count=0;for(const el of document.querySelectorAll('#main [data-pre-plain-text]')){
    const text=messageText(el);if(!text)continue;count++;
    if(!incomingArmed)incomingSeen.add(el);
    else if(!el.closest?.('.message-out')&&!incomingSeen.has(el)){incomingSeen.add(el);try{ipcRenderer.send('wa:incoming-message',{chat:c.key,title:String(c.title||''),text});}catch{}for(const [key,timer] of unanswered){if(key.startsWith(c.key+'|')){clearTimeout(timer);unanswered.delete(key);}}}
    if(!outgoingSeen.has(el)){outgoingSeen.add(el);if(incomingArmed&&el.closest?.('.message-out')&&c.key){const key=c.key+'|'+Date.now()+'-'+Math.random().toString(36).slice(2);const timer=setTimeout(()=>{unanswered.delete(key);try{ipcRenderer.send('wa:risk-alert',{type:'read-no-reply',text:messageText(el).slice(0,300)});}catch{}},300000);unanswered.set(key,timer);}}
    if(!openchatArmed)openchatSeen.add(el);
    else if(!openchatSeen.has(el)){openchatSeen.add(el);maybeOpenchat(el,c,text);}
    let entry=entries.get(el);
    if(entry&&(!entry.box.isConnected||entry.text!==text)){if(entry.text&&/deleted|已删除|此消息|此訊息|this message was deleted/i.test(text)){try{ipcRenderer.send('wa:risk-alert',{type:'revoke',text:entry.text});}catch{}}entry.box.remove();entries.delete(el);entry=null;}
    if(!entry){const box=document.createElement('div');box.className='st-translation';const button=document.createElement('button');button.type='button';button.textContent='翻译为中文';const output=document.createElement('span');output.className='st-text';const hint=document.createElement('small');hint.textContent='超级翻译 · 点击翻译';box.append(button,output,hint);entry={box,button,output,text,busy:false,attempted:false};const captured=entry;button.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();translateOne(el,captured);});el.append(box);entries.set(el,entry);}
    if(config.enabled!==false&&!paused&&c.key&&!entry.attempted&&/\p{L}/u.test(text)&&(config.history||config.automatic&&visible(el)&&autoRemaining>0)){if(!config.history)autoRemaining--;translateOne(el,entry,true);}
  }
  openchatArmed=true;incomingArmed=true;
  const snapshot={...c,messages:count,connected:!!document.querySelector('#pane-side'),historyActive:config.history,translationEnabled:config.enabled!==false,translationPaused:paused||config.enabled===false,pending:pendingCount,translated:translatedCount};const serialized=JSON.stringify(snapshot);if(serialized!==lastSnapshot){lastSnapshot=serialized;ipcRenderer.send('wa:snapshot',snapshot);}
}
async function openContactByText(contact){
  const needle=String(contact||'').replace(/^\+/,'').trim();if(!needle)throw new Error('联系人号码为空。');
  const search=[...document.querySelectorAll('#side [contenteditable="true"][role="textbox"],#side input[type="search"],#side input[placeholder]')].find(el=>el.offsetParent!==null);
  if(!search)throw new Error('找不到 WhatsApp 搜索框。');
  search.focus();document.execCommand('selectAll',false,null);document.execCommand('insertText',false,needle);
  await new Promise(r=>setTimeout(r,700));
  const rows=[...document.querySelectorAll('#pane-side [role="listitem"],#pane-side [role="row"]')];
  const hit=rows.find(row=>String(row.innerText||'').replace(/\s+/g,' ').includes(needle));
  if(!hit)throw new Error('搜索不到联系人 '+needle+'。');
  hit.click();await new Promise(r=>setTimeout(r,700));
  return {ok:true,contact:needle,chat:chat().key};
}
async function sendCurrent(){
  const button=document.querySelector('footer span[data-icon="send"], footer button[aria-label*="Send"], footer button[aria-label*="发送"]');
  if(!button)throw new Error('找不到 WhatsApp 发送按钮。');
  const target=button.closest('button')||button;target.click();await new Promise(r=>setTimeout(r,600));
  return {ok:true};
}
ipcRenderer.on('wa:command',async(_,command)=>{
  try{
    if(command.op==='snapshot'){lastSnapshot='';scan();return;}
    if(command.op==='identify-phone'){const data=await identifyPhone();ipcRenderer.send('wa:response',{id:command.id,ok:true,data});return;}
     if(command.op==='profiles'){
       const items=Array.isArray(command.profiles)?command.profiles.filter(p=>p&&typeof p==='object'):[];
       profiles=new Map(items.map(p=>[p.hash,p]));profilesByKey=new Map(items.filter(p=>p.key).map(p=>[p.key,p]));profilesByTitle=new Map(items.filter(p=>p.title).map(p=>[String(p.title),p]));profilesByPhone=new Map(items.map(p=>[normalizePhone(p.phone),p]).filter(([phone])=>phone));
       decorate();ipcRenderer.send('wa:response',{id:command.id,ok:true});return;
     }
    if(command.op==='annotate'){if(command.chat!==chat().key)throw new Error('聊天已变化。');annotation={key:command.chat,...command.annotation};annotate();decorate();ipcRenderer.send('wa:response',{id:command.id,ok:true});return;}
    if(command.op==='config'){scan();const changed=config.incoming!==command.config.incoming;const flags=config.enabled!==command.config.enabled||config.automatic!==command.config.automatic||config.history!==command.config.history;const composerChanged=config.enabled!==command.config.enabled||config.outgoing!==command.config.outgoing||config.translateSend!==command.config.translateSend||config.blockChinese!==command.config.blockChinese;config={...config,...command.config};composerTranslations.clear();if(changed||flags){epoch++;paused=false;failures=0;autoRemaining=config.enabled!==false&&config.automatic?10:0;for(const el of document.querySelectorAll('#main [data-pre-plain-text]')){const entry=entries.get(el);if(entry){if(changed||!entry.done)entry.attempted=false;if(changed||config.enabled===false){entry.done=false;entry.output.textContent='';entry.button.textContent=config.incoming==='zh-CN'?'翻译为中文':'翻译';}}}}if(composerChanged){resetComposerPreview(false);const inputEl=editor();if(cleanDraft(inputEl))scheduleComposerTranslation(inputEl);else resetComposerPreview();}scan();ipcRenderer.send('wa:response',{id:command.id,ok:true});return;}
    if(command.op==='open-contact'){const data=await openContactByText(command.contact);ipcRenderer.send('wa:response',{id:command.id,ok:true,data});return;}
    if(command.op==='send'){const data=await sendCurrent();ipcRenderer.send('wa:response',{id:command.id,ok:true,data});return;}
    if(command.op==='fill'){
      const c=chat();if(!c.key||c.key!==command.chat)throw new Error('当前聊天已变化，已阻止填入。');const e=editor();if(!e)throw new Error('找不到当前聊天输入框。');if(e.innerText.trim())throw new Error('WhatsApp 输入框已有草稿，未覆盖。');
      if(typeof command.text!=='string'||!command.text.trim()||command.text.length>6000)throw new Error('译文格式无效。');e.focus();if(chat().key!==command.chat)throw new Error('会话已变化。');document.execCommand('insertText',false,command.text);
      let stable=0;for(let i=0;i<14;i++){await new Promise(r=>setTimeout(r,100));if(chat().key!==command.chat)throw new Error('会话已变化，请检查草稿；没有发送消息。');stable=editor()?.innerText.trim()===command.text.trim()?stable+1:0;if(stable>=2)break;}
      if(stable<2)throw new Error('无法确认填入结果，请检查 WhatsApp 输入框。');ipcRenderer.send('wa:response',{id:command.id,ok:true,data:{filled:true,sent:false}});return;
    }
    throw new Error('未知操作。');
  }catch(e){ipcRenderer.send('wa:response',{id:command.id,ok:false,error:e.message});}
});
window.addEventListener('DOMContentLoaded',()=>{scan();const inputEl=editor();if(cleanDraft(inputEl))scheduleComposerTranslation(inputEl);observer=new MutationObserver(records=>{if(records.every(r=>r.target.parentElement?.closest('.st-translation,.st-voice-translation')||r.target.closest?.('.st-translation,.st-voice-translation')))return;clearTimeout(timer);timer=setTimeout(scan,300);});observer.observe(document.body,{childList:true,subtree:true,characterData:true});setInterval(scan,1500);});
