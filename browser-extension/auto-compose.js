(() => {
  'use strict';
  if(globalThis.WATAutoComposer)return;
  const listeners=new Set();let settings=null,chat='',prefs=null,prefsError='',lastDetection='',nav=0,revision=0;
  let debounce,scanTimer,pending=null,preview=null,errorKey='',lastDraft='',busy=false,injecting=false,dispatched=false,expected='',bypass=null,composing=false,compositionEnd=0,statusBusy=false;
  let display={phase:'idle',message:'在 WhatsApp 聊天框输入任意语言即可预览译文。',translation:''};
  const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const mainRoot=()=>document.getElementById('main');
  const displayed=e=>{
    if(!e?.isConnected)return false;
    const style=getComputedStyle(e);if(style.display==='none'||style.visibility==='hidden')return false;
    const rect=e.getBoundingClientRect();return rect.width>0&&rect.height>0;
  };
  // WhatsApp has used several composer variants (role="textbox", data-tab,
  // and a plain contenteditable) over the last few releases. Prefer the
  // visible footer editor but retain a hydration-time fallback so the first
  // input event is not lost while React is mounting the composer.
  const editor=()=>{
    const root=mainRoot();if(!root)return null;
    const selectors=['footer [contenteditable="true"][role="textbox"]','footer [contenteditable="true"][data-tab="10"]','footer [contenteditable="true"]','[contenteditable="true"][role="textbox"]'];
    const seen=new Set(),candidates=[];
    for(const selector of selectors)for(const element of root.querySelectorAll(selector))if(!seen.has(element)){seen.add(element);candidates.push(element);}
    return candidates.find(displayed)||candidates[0]||null;
  };
  // innerText can contain NBSP/zero-width characters inserted by WhatsApp's
  // Lexical editor. Normalize those presentation characters before comparing
  // drafts; otherwise a valid translated result can be discarded as stale.
  const textOf=e=>String(e?.innerText??e?.textContent??'').replace(/\u00a0/g,' ').replace(/[\u200b-\u200d\ufeff]/g,'').replace(/\r\n?/g,'\n').trim();
  // Keep this expression non-global: jidFromValue() reads the first capture
  // group. A global RegExp makes String#match return the complete match only,
  // which silently broke bare JIDs such as "491...@c.us" after a WhatsApp DOM
  // update.
  const JID_RE=/([^_\s@]+@(?:c\.us|s\.whatsapp\.net|g\.us|lid|newsletter))(?:_|$)/i;
  function jidFromValue(value){
    const raw=String(value??'').replace(/[\u200b-\u200d\ufeff]/g,'').trim();if(!raw)return'';
    // The current Web client normally emits true_/false_ prefixes, but some
    // builds expose a bare JID or put it in a data-testid/aria-label. Accept
    // all of those forms and return only the stable conversation JID.
    const direct=raw.match(/^(?:true|false)_([^_\s@]+@(?:c\.us|s\.whatsapp\.net|g\.us|lid|newsletter))(?:_|$)/i);
    const match=direct||raw.match(JID_RE);
    const jid=(direct?.[1]||match?.[1]||'').toLowerCase();
    return /^(?:status|broadcast)@/.test(jid)?'':jid;
  }
  function jidFromOwnAttributes(node){
    if(!node?.getAttribute)return'';
    for(const attr of ['data-id','data-chat-id','data-jid','data-testid','aria-label','title']){
      const jid=jidFromValue(node.getAttribute(attr));if(jid)return jid;
    }
    return'';
  }
  function jidFromNode(root){
    if(!root)return'';
    const nodes=[root,...(root.querySelectorAll?.('[data-id],[data-chat-id],[data-jid],[data-testid],[aria-label],[title]')||[])];
    for(const node of nodes){
      const jid=jidFromOwnAttributes(node);if(jid)return jid;
    }
    return'';
  }
  const cleanLabel=value=>String(value??'').replace(/[\u200b-\u200d\ufeff]/g,'').replace(/\u00a0/g,' ').replace(/\s+/g,' ').trim();
  function phoneFromLabel(value){
    // Prefer the number itself over the complete header line. WhatsApp often
    // appends the last-seen time (for example "... 04:32"), which otherwise
    // gets swallowed by a permissive phone-number expression.
    let raw=cleanLabel(value).replace(/\s+\d{1,2}:\d{2}(?:\s|$).*$/,'');
    const candidates=raw.match(/(?:\+\s*\d[\d\s().-]*\d|00\s*\d[\d\s().-]*\d)/g)||[];
    for(const candidate of candidates){
      let digits=candidate.replace(/\D/g,'');
      if(candidate.trim().startsWith('00'))digits=digits.replace(/^00/,'');
      if(digits.length>=7&&digits.length<=15)return`+${digits}`;
    }
    return'';
  }
  function phoneFromNode(root,includeText=false){
    if(!root)return'';
    const nodes=[root,...(root.querySelectorAll?.('[title],[aria-label]')||[])];
    for(const node of nodes){
      const values=[node.getAttribute?.('title'),node.getAttribute?.('aria-label')];
      if(includeText&&node.children?.length===0)values.push(node.textContent);
      for(const value of values){
        const phone=phoneFromLabel(value);if(phone)return phone;
      }
    }
    return'';
  }
  function headerCandidates(){
    const header=mainRoot()?.querySelector('header');if(!header)return[];
    const values=[],seen=new Set();
    const add=value=>{const clean=cleanLabel(value);if(clean&&!seen.has(clean)){seen.add(clean);values.push(clean);}};
    // The title node is the stable contact identity in current WhatsApp Web;
    // data-testid variants cover older and localized builds.
    for(const selector of ['[data-testid*="conversation-info-header-chat-title"]','[data-testid*="conversation-info-header"]','[title]','[aria-label]']){
      for(const node of header.querySelectorAll(selector)){
        add(node.getAttribute?.('title'));add(node.getAttribute?.('aria-label'));
        if(node.children?.length===0)add(node.textContent);
      }
    }
    add(header.innerText||header.textContent);
    return values;
  }
  function headerLabel(){
    const candidates=headerCandidates();
    return candidates.find(value=>phoneFromLabel(value))||candidates.find(value=>!/(?:^(?:whatsapp(?: web)?|chats?|聊天|对话|搜索|search|call|video call|语音通话|视频通话|more|更多)$)/i.test(value)&&value.length<=160)||candidates[0]||'';
  }
  function headerPhone(){
    for(const value of headerCandidates()){const phone=phoneFromLabel(value);if(phone)return phone;}
    return'';
  }
  function stableTitleKey(value){
    const title=String(value||'').replace(/\s+/g,' ').trim();
    if(!title||/^(?:whatsapp(?: web)?|chats?|聊天|对话)$/i.test(title))return'';
    let hash=2166136261;for(let i=0;i<title.length;i++){hash^=title.charCodeAt(i);hash=Math.imul(hash,16777619);}
    return`title:${(hash>>>0).toString(16)}`;
  }
  function selectedRow(){
    const pane=document.querySelector('#pane-side');if(!pane)return null;
    const explicit=[...pane.querySelectorAll('[aria-selected="true"],[aria-current="true"],[data-selected="true"]')];
    const classSelected=[...pane.querySelectorAll('[role="row"].selected,[role="listitem"].selected,[data-testid="cell-frame-container"].selected')];
    return [...explicit,...classSelected].find(row=>jidFromNode(row)||phoneFromNode(row))||null;
  }
  function messageDirection(node){
    const root=mainRoot();
    for(let p=node;p&&p!==root;p=p.parentElement){
      const id=p.getAttribute?.('data-id')||p.getAttribute?.('data-chat-id')||'';
      if(/^false_/i.test(id))return'incoming';
      if(/^true_/i.test(id))return'outgoing';
      if(p.classList?.contains('message-in'))return'incoming';
      if(p.classList?.contains('message-out'))return'outgoing';
    }
    return'unknown';
  }
  function contact(){
    const root=mainRoot();if(!root||!root.querySelector('header')||!editor())return'';
    // 1) The selected conversation row is the most authoritative surface and
    // remains available even when the message list has no data-id attributes.
    const row=selectedRow(),rowJid=jidFromNode(row);if(rowJid)return rowJid;
    const rowPhone=phoneFromNode(row);if(rowPhone)return`phone:${rowPhone}`;
    // 2) Header attributes and message data-id values cover older/newer Web
    // markup. Do not require every message to share the same exact attribute;
    // choose the first stable JID and strip message suffixes.
    const header=root.querySelector('header'),headerJid=jidFromNode(header);if(headerJid)return headerJid;
    const incoming=[],neutral=[],outgoing=[];
    for(const node of root.querySelectorAll('[data-id],[data-chat-id],[data-jid],[data-pre-plain-text]')){
      const jid=jidFromOwnAttributes(node);if(!jid)continue;
      const direction=messageDirection(node);
      if(direction==='incoming')incoming.push(jid);else if(direction==='outgoing')outgoing.push(jid);else neutral.push(jid);
    }
    const unique=values=>{const result=[...new Set(values)];return result.length===1?result[0]:'';};
    // Never select a JID that only appears on our own true_ messages. In
    // one-to-one chats WhatsApp normally embeds the peer JID in both message
    // directions; if an incoming JID conflicts with every outgoing JID, the
    // header/phone fallback below is safer than guessing. In group chats the
    // outgoing message ID may refer to the group while an incoming descendant
    // can expose a participant, so prefer the shared identity where possible.
    const incomingJid=unique(incoming),outgoingJid=unique(outgoing),neutralJid=unique(neutral);
    if(incomingJid&&(!outgoingJid||incomingJid===outgoingJid))return incomingJid;
    if(neutralJid&&(!outgoingJid||neutralJid===outgoingJid)&&(!incomingJid||neutralJid===incomingJid))return neutralJid;
    // 3) Number-only headers are common for unsaved customers. Use a stable
    // phone key, which is still account-scoped and hashed before persistence.
    const phone=headerPhone();if(phone)return`phone:${phone}`;
    // 4) Finally keep named contacts usable while WhatsApp hydrates its
    // private model. The key is a local FNV hash, not the raw display name.
    return stableTitleKey(headerLabel());
  }
  function isIncoming(e){for(let p=e;p&&p.id!=='main';p=p.parentElement){if(p.classList.contains('message-out'))return false;if(p.classList.contains('message-in'))return true;const id=p.getAttribute('data-id')||'';if(/^false_/.test(id))return true;if(/^true_/.test(id))return false;}return false;}
  function sendButton(){const footer=document.querySelector('#main footer');if(!footer)return null;const icon=footer.querySelector('[data-icon="send"],[data-icon="wds-ic-send-filled"],[data-testid="compose-btn-send"],[data-testid="send"]');const button=icon?.closest('button,[role="button"]')||footer.querySelector('button[aria-label="Send"],button[aria-label="发送"],[role="button"][aria-label="Send"],[role="button"][aria-label="发送"]');if(!button||!footer.contains(button)||button.disabled||button.getAttribute('aria-disabled')==='true'||button.getBoundingClientRect().width===0)return null;return button;}
  const target=()=>{if(!prefs)return'';if(prefs.reply!=='default'&&prefs.reply!=='follow')return prefs.reply;if(prefs.reply==='default'&&settings?.replyMode==='fixed')return settings.outgoing;return prefs.source!=='auto'?prefs.source:prefs.detected||'';};
  const settingKey=s=>JSON.stringify([s?.enabled,s?.autoSend,s?.livePreview,s?.replyMode,s?.outgoing,s?.accountRevision]);
  const draftKey=()=>JSON.stringify([chat,nav,settingKey(settings),target(),textOf(editor())]);
  async function send(msg){const response=await chrome.runtime.sendMessage(msg);if(!response?.ok)throw new Error(response?.error||'插件后台没有响应，已阻止发送。');return response;}
  function emit(phase,message,translation=''){display={phase,message,translation};notify();}
  function notify(){const state={...display,settings,chatReady:!!chat,prefs,target:target(),busy};for(const fn of listeners)fn(state);}
  function invalidate(){revision++;clearTimeout(debounce);preview=null;pending=null;errorKey='';lastDraft='';}
  async function refresh(){if(statusBusy)return;statusBusy=true;try{const result=await send({type:'STATUS'});configure(result.settings);}catch(e){if(settings?.autoSend)emit('error',e.message);}finally{statusBusy=false;}}
  function configure(next){
    const old=settings;settings=next;
    if(settingKey(old)!==settingKey(next)){invalidate();if(old?.accountRevision!==next.accountRevision){chat='';prefs=null;lastDetection='';}scan();}
    notify();
  }
  async function loadPrefs(key,account){
    try{const result=await send({type:'CHAT_PREFS',chatKey:key});if(chat!==key||settings?.accountRevision!==account)return;prefs=result.prefs;prefsError='';invalidate();scan();}
    catch(e){if(chat===key&&settings?.accountRevision===account){prefsError=e.message;emit('error',e.message);}}
  }
  function incomingText(e){return [...e.querySelectorAll('span.selectable-text')].filter(n=>!n.closest('.wat-owned')).map(n=>n.innerText).join('\n').trim();}
  async function detectLatest(){
    if(!chat||!prefs||!settings?.enabled)return;
    const rows=[...document.querySelectorAll('#main [data-pre-plain-text]')].filter(isIncoming),row=rows.at(-1);if(!row)return;
    // A trailing "OK" / emoji should not hide useful incoming text already visible in this same conversation.
    const text=rows.slice(-3).map(incomingText).filter(Boolean).join('\n').slice(-3500);if(!text)return;
    const key=chat+'\0'+text;if(lastDetection===key)return;lastDetection=key;
    const currentChat=chat,account=settings.accountRevision;
    try{const result=await send({type:'DETECT_LANGUAGE',chatKey:chat,text});if(chat!==currentChat||settings.accountRevision!==account||lastDetection!==key)return;
      // A detection response must not overwrite manual changes made while it was pending.
      const before=target();prefs={...prefs,detected:result.prefs.detected};if(before!==target()){invalidate();scan();}else notify();
    }catch{ /* Keep last reliable language; do not retry on every DOM mutation. */ }
  }
  function scan(){
    const key=contact();if(key!==chat){chat=key;prefs=null;prefsError='';lastDetection='';invalidate();if(key&&settings?.accountRevision&&settings.accountRevision!=='signed-out')loadPrefs(key,settings.accountRevision);}
    detectLatest();
    if(!settings?.autoSend){notify();return;}
    if(injecting||dispatched){notify();return;}
    const current=draftKey();if(current!==lastDraft){invalidate();lastDraft=current;
      if(!textOf(editor()))emit('idle','在 WhatsApp 聊天框输入任意语言即可预览译文。');
      else if(!chat)emit('blocked','尚未确认当前联系人，请打开有聊天记录的联系人会话。');
      else if(!prefs)emit('blocked',prefsError||'正在读取当前联系人的语言设置…');
      else if(!target())emit('blocked','暂未可靠识别对方语言，请在上方指定语言后发送。');
      else if(!settings.enabled)emit('blocked','云端翻译未启用或账号已退出，已阻止原文发送。');
      else if(settings.livePreview&&!composing)debounce=setTimeout(()=>getPreview().catch(()=>{}),400);
      else emit('idle','按 Enter 或点击发送时翻译；不会提前发送原文。');
    }else notify();
  }
  function snapshot(){return {editor:editor(),chat:contact(),nav,revision,text:textOf(editor()),target:target(),settings:settingKey(settings),accountRevision:settings?.accountRevision,draftId:crypto.randomUUID()};}
  function valid(s,content=s.text){return s.revision===revision&&s.nav===nav&&s.editor===editor()&&s.chat===contact()&&s.target===target()&&s.settings===settingKey(settings)&&textOf(editor())===content&&!document.hidden;}
  async function getPreview(){
    if(!settings?.enabled||!settings.autoSend)throw new Error('请登录并启用云端翻译和发送前自动翻译。');
    const s=snapshot(),key=draftKey();
    if(!s.editor||!s.chat||!s.text||!s.target)throw new Error('请确认当前联系人、原文和目标语言。');
    if(errorKey===key)throw new Error('上次请求未成功，请先检查额度，再点击“重新预览”。');
    if(preview&&preview.key===key&&preview.expires>Date.now())return preview;
    if(pending?.key===key)return pending.promise;
    emit('translating','正在翻译，请稍候…');
    const promise=(async()=>{try{const result=await send({type:'TRANSLATE',purpose:'compose',text:s.text,target:s.target,draftId:s.draftId});
      if(!valid(s))throw new Error('原文、联系人或语言已改变，旧译文已丢弃。');
      if(result.cautions?.length)throw new Error(result.cautions.join(' / '));
      if(!result.sendTicket||!result.translation?.trim())throw new Error('译文或发送凭证不完整，已阻止发送。');
      preview={key,s,translation:result.translation.trim(),ticket:result.sendTicket,expires:Date.now()+110000};emit('ready','译文已就绪 · 由你按回车或点击发送',preview.translation);return preview;
    }catch(e){if(s.revision===revision){errorKey=key;emit('error',e.message);}throw e;}finally{if(pending?.promise===promise)pending=null;}})();pending={key,promise};return promise;
  }
  function outgoingIds(){return new Set([...document.querySelectorAll('#main [data-id^="true_"]')].map(e=>e.getAttribute('data-id')));}
  async function requestSend(){
    if(busy)return;busy=true;notify();clearTimeout(debounce);
    let item,s,clicked=false;
    try{
      scan();clearTimeout(debounce);item=await getPreview();s=item.s;if(!valid(s))throw new Error('会话或原文已改变，已取消发送。');
      emit('authorizing','正在确认账号授权…',item.translation);
      const approval=await send({type:'AUTHORIZE_SEND',sendTicket:item.ticket,draftId:s.draftId,target:s.target,accountRevision:s.accountRevision});
      if(settingKey(approval.settings)!==s.settings){configure(approval.settings);throw new Error('账号或设置已变化，已取消发送。');}
      if(!valid(s))throw new Error('会话或原文已改变，已取消发送。');
      if(!sendButton())throw new Error('未找到当前聊天的发送按钮，原文已保留。');
      injecting=true;expected=item.translation;emit('replacing','正在将译文填入聊天框…',item.translation);
      s.editor.focus();const selection=getSelection(),range=document.createRange();range.selectNodeContents(s.editor);selection.removeAllRanges();selection.addRange(range);
      document.execCommand('insertText',false,item.translation);
      let stable=0;for(let i=0;i<15;i++){await delay(40);if(!valid(s,item.translation))break;if(++stable>=2)break;}
      if(stable<2||!valid(s,item.translation))throw new Error('无法确认输入框已正确替换，未触发发送。');
      const button=sendButton();if(!button)throw new Error('发送按钮已变化，未触发发送。');
      const previous=outgoingIds();injecting=false;dispatched=true;clicked=true;preview=null;emit('sending','译文已交给 WhatsApp，正在检查页面结果…',item.translation);
      bypass=button;try{button.click();}finally{bypass=null;}
      let observed=false;
      for(let i=0;i<30;i++){await delay(50);if(s.chat!==contact()||s.nav!==nav)break;
        const message=[...document.querySelectorAll('#main [data-id^="true_"]')].find(e=>!previous.has(e.getAttribute('data-id'))&&[...e.querySelectorAll('span.selectable-text')].filter(n=>!n.closest('.wat-owned')).map(n=>n.innerText).join('\n').trim()===item.translation);
        if(message&&!textOf(editor())){observed=true;break;}
      }
      if(observed)emit('sent','页面已出现译文消息；送达状态请看 WhatsApp 消息标记。',item.translation);
      else{errorKey=draftKey();emit('uncertain','发送结果尚未确认，请先检查聊天记录；不会自动重发。',item.translation);}
    }catch(e){
      if(!clicked&&s&&injecting&&s.chat===contact()&&s.editor===editor()&&textOf(editor())===item.translation){
        // Restore only our own replacement in the unchanged conversation. Never overwrite a newer user draft.
        expected=s.text;s.editor.focus();const selection=getSelection(),range=document.createRange();range.selectNodeContents(s.editor);selection.removeAllRanges();selection.addRange(range);document.execCommand('insertText',false,s.text);
      }
      preview=null;errorKey=draftKey();emit('error',e.message);
    }finally{injecting=false;dispatched=false;expected='';busy=false;lastDraft=draftKey();notify();}
  }
  const stop=e=>{e.preventDefault();e.stopImmediatePropagation();};
  const inEditor=e=>{const el=editor();return el&&(el===e.target||el.contains(e.target));};
  const intercept=()=>settings===null||settings.autoSend;
  window.addEventListener('keydown',e=>{
    const button=sendButton(),onButton=button&&(button===e.target||button.contains(e.target));
    if(!intercept()||!(inEditor(e)||onButton))return;
    if(e.key!=='Enter'&&!(onButton&&e.key===' '))return;
    if(!onButton&&e.shiftKey)return;
    if(!onButton&&(e.isComposing||composing||e.keyCode===229)){e.stopImmediatePropagation();return;}
    if(!onButton&&Date.now()-compositionEnd<100){stop(e);return;}
    stop(e);if(e.repeat)return;requestSend();
  },{capture:true});
  for(const type of ['keypress','keyup'])window.addEventListener(type,e=>{if(intercept()&&inEditor(e)&&e.key==='Enter'&&!e.shiftKey&&!e.isComposing&&!composing)stop(e);},{capture:true});
  window.addEventListener('click',e=>{const button=sendButton();if(!button||!(e.target===button||button.contains(e.target)))return;if(bypass===button&&!e.isTrusted){bypass=null;return;}if(!intercept())return;stop(e);requestSend();},{capture:true});
  for(const type of ['pointerdown','mousedown'])window.addEventListener(type,e=>{const button=sendButton();if(intercept()&&button&&(e.target===button||button.contains(e.target)))e.stopImmediatePropagation();},{capture:true});
  window.addEventListener('input',e=>{if(!inEditor(e))return;if(injecting&&textOf(editor())===expected)return;if(dispatched&&!textOf(editor()))return;invalidate();scan();},{capture:true});
  window.addEventListener('compositionstart',e=>{if(inEditor(e)){composing=true;clearTimeout(debounce);}},true);
  window.addEventListener('compositionend',e=>{if(inEditor(e)){composing=false;compositionEnd=Date.now();invalidate();scan();}},true);
  window.addEventListener('pointerdown',e=>{if(e.target instanceof Element&&e.target.closest('#pane-side')){nav++;invalidate();}},true);
  document.addEventListener('visibilitychange',()=>{if(document.hidden){nav++;invalidate();}});
  function observe(){if(!document.body)return;new MutationObserver(records=>{if(records.every(r=>(r.target instanceof Element?r.target:r.target.parentElement)?.closest('.wat-owned')))return;clearTimeout(scanTimer);scanTimer=setTimeout(scan,80);}).observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['data-id','title']});scan();}
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',observe,{once:true}):observe();
  globalThis.WATAutoComposer={configure,isIncoming,subscribe(fn){listeners.add(fn);notify();return()=>listeners.delete(fn);},async setPreferences(patch){if(!chat)throw new Error('请先打开联系人会话。');const key=chat,account=settings?.accountRevision;const result=await send({type:'CHAT_PREFS',chatKey:key,patch});if(chat===key&&settings?.accountRevision===account){prefs=result.prefs;invalidate();scan();}},retry(){if(busy)return;invalidate();scan();clearTimeout(debounce);getPreview().catch(e=>emit('error',e.message));}};
  refresh();setInterval(refresh,1500);
})();
