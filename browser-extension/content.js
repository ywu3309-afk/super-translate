(() => {
  'use strict';
  if (document.getElementById('wat-launcher')) return;
  let config = { ...WATCore.defaults }, alive = true, timer, revision = 0, currentChat = '', statusBusy = false;
  const entries = new WeakMap();
  let panelResult = null, generation = 0, panelBusy = false;
  const node = (tag, cls, text) => { const e=document.createElement(tag); if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e; };
  const button = (text, action, cls='') => {const b=node('button',cls,text);b.type='button';b.addEventListener('click',action);return b;};
  async function send(message) {
    try { const r=await chrome.runtime.sendMessage(message);if(!r?.ok)throw new Error(r?.error||'扩展后台没有响应。');return r; }
    catch(e) { if(/context invalidated|receiving end|Extension context/i.test(e.message)){alive=false;launcherText.textContent='超级翻译 · 请刷新页面';throw new Error('扩展已更新，请刷新 WhatsApp 页面。');}throw e; }
  }
  const logo=()=>{const img=node('img','wat-logo');img.src=chrome.runtime.getURL('assets/icon-48.png');img.alt='';return img;};
  const launcher=button('',()=>{panel.hidden=!panel.hidden;if(!panel.hidden)refreshStatus();});
  const launcherText=node('span','','超级翻译 · 检查中');launcher.append(logo(),launcherText);
  launcher.id='wat-launcher';launcher.className='wat-owned';launcher.setAttribute('aria-expanded','false');
  launcher.addEventListener('click',()=>launcher.setAttribute('aria-expanded',String(!panel.hidden)));
  const panel=node('section','wat-owned');panel.id='wat-panel';panel.hidden=true;panel.setAttribute('aria-label','超级翻译工作台');
  const top=node('div','wat-top'),brand=node('div','wat-brand');brand.append(node('strong','','超级翻译'),node('small','','SUPER TRANSLATE'));
  const close=button('×',()=>{panel.hidden=true;launcher.setAttribute('aria-expanded','false');launcher.focus();},'wat-close');close.setAttribute('aria-label','关闭翻译工作台');
  top.append(logo(),brand,close);panel.append(top);
  const state=node('p','wat-state','检查翻译状态…');panel.append(state);
  panel.append(button('账号与额度  ↗',async()=>{try{await send({type:'OPTIONS'});}catch(e){state.textContent=e.message;}},'wat-secondary wat-account-link'));
  const steps=node('div','wat-steps');steps.append(node('span','','01  输入原文'),node('span','','02  预览译文'),node('span','','03  填入草稿'));panel.append(steps);
  const sourceLabel=node('label','','你想回复什么？');sourceLabel.htmlFor='wat-source';
  const source=node('textarea');source.id='wat-source';source.rows=3;source.maxLength=3500;source.placeholder='例如：好的，请稍等，我现在帮你查找。';
  panel.append(sourceLabel,source);
  panel.append(button('↙  读取聊天框草稿',()=>{const editor=getEditor();if(!editor){feedback.textContent='未找到当前聊天输入框，请先打开一段聊天。';return;}source.value=editor.innerText.trim();invalidate();},'wat-secondary'));
  const targetLabel=node('label','','回复目标语言');targetLabel.htmlFor='wat-target';const target=node('select');target.id='wat-target';
  for(const [value,label]of Object.entries(WATCore.languages)){const o=node('option','',label);o.value=value;target.append(o);}target.value=config.outgoing;panel.append(targetLabel,target);
  const translateButton=button('生成译文  →',translateDraft,'wat-primary');panel.append(translateButton);
  const outputLabel=node('label','','译文预览');outputLabel.htmlFor='wat-output';const output=node('textarea');output.id='wat-output';output.rows=3;output.placeholder='译文将在这里显示，可核对后编辑';panel.append(outputLabel,output);
  const notes=node('p','wat-help'),feedback=node('p','wat-feedback');feedback.setAttribute('role','status');feedback.setAttribute('aria-live','polite');panel.append(notes);
  const row=node('div','wat-actions');
  const copy=button('复制译文',async()=>{try{if(!output.value.trim())throw new Error('没有可复制的译文。');await navigator.clipboard.writeText(output.value);feedback.textContent='已复制。请核对后手动粘贴、发送。';}catch(e){output.focus();output.select();feedback.textContent='无法自动复制，请按 Ctrl+C 复制已选中的译文。';}});
  const fill=button('填入草稿',fillDraft);copy.disabled=true;fill.disabled=true;row.append(copy,fill);panel.append(row,feedback,node('p','wat-safety','由你确认发送 · 不会自动发送消息'));
  document.body.append(launcher,panel);
  const targetPicker=STLanguagePicker(target);
  // Keep the legacy manual draft flow intact; the native-composer module is an opt-in sibling.
  const manual=node('div','wat-manual');let item=steps;while(item){const next=item.nextSibling;manual.append(item);item=next;}panel.append(manual);
  const contactCard=node('div','wat-contact-card'),detectedLabel=node('p','wat-help','对方语言：等待识别');
  const contactSourceLabel=node('label','','对方语言');contactSourceLabel.htmlFor='wat-contact-source';const contactSource=node('select');contactSource.id='wat-contact-source';
  const replyLabel=node('label','','此联系人的回复语言');replyLabel.htmlFor='wat-contact-reply';const contactReply=node('select');contactReply.id='wat-contact-reply';
  for(const [select,options]of [[contactSource,{auto:'自动识别',...WATCore.languages}],[contactReply,{default:'使用账号设置',follow:'跟随对方语言',...WATCore.languages}]])for(const [value,label]of Object.entries(options)){const option=node('option','',label);option.value=value;select.append(option);}
  contactCard.append(detectedLabel,contactSourceLabel,contactSource,replyLabel,contactReply);panel.insertBefore(contactCard,manual);
  const contactPickers=[STLanguagePicker(contactSource),STLanguagePicker(contactReply)];
  const live=node('div','wat-live-card'),liveTitle=node('strong','','实时发送预览'),liveStatus=node('p','wat-help'),liveText=node('div','wat-live-text'),retry=button('重新预览',()=>WATAutoComposer.retry(),'wat-secondary');
  liveText.id='wat-live-preview';liveStatus.id='wat-live-status';liveStatus.setAttribute('role','status');liveStatus.setAttribute('aria-live','polite');
  live.append(liveTitle,liveStatus,liveText,retry,node('p','wat-safety','在原生聊天框输入 · 按 Enter 或点击发送时发出译文'));panel.insertBefore(live,manual);live.hidden=true;
  const patchLanguage=async patch=>{try{await WATAutoComposer.setPreferences(patch);}catch(e){liveStatus.textContent=e.message;}};
  contactSource.addEventListener('change',()=>patchLanguage({source:contactSource.value}));contactReply.addEventListener('change',()=>patchLanguage({reply:contactReply.value}));
  WATAutoComposer.subscribe(s=>{
    manual.hidden=!!s.settings?.autoSend;live.hidden=!s.settings?.autoSend;
    const code=s.prefs?.source!=='auto'?s.prefs?.source:s.prefs?.detected;
    detectedLabel.textContent=s.chatReady?`对方语言：${WATCore.languages[code]||'待识别，可手动选择'}${s.prefs?.source&&s.prefs.source!=='auto'?'（手动指定）':''}`:'请打开联系人会话以识别语言';
    contactSource.disabled=contactReply.disabled=!s.chatReady||!s.prefs;
    contactSource.value=s.prefs?.source||'auto';contactReply.value=s.prefs?.reply||'default';contactPickers.forEach(p=>p.refresh());
    liveStatus.textContent=s.message;liveText.textContent=s.translation||'在 WhatsApp 原生聊天框输入任意语言，译文会显示在这里。';live.dataset.phase=s.phase;retry.disabled=s.busy;
    if(['error','uncertain'].includes(s.phase)&&s.settings?.autoSend){panel.hidden=false;launcher.setAttribute('aria-expanded','true');}
  });
  function getEditor(){return document.querySelector('#main footer [contenteditable="true"][role="textbox"]');}
  function chatKey(){const h=document.querySelector('#main header');return h ? (h.querySelector('[title]')?.getAttribute('title')||h.innerText.split('\n')[0]||'') : '';}
  function signature(){return JSON.stringify([config.engine,config.incoming,config.tone,config.enabled,config.accountRevision]);}
  function invalidate(){generation++;panelResult=null;output.value='';notes.textContent='';feedback.textContent='';copy.disabled=true;fill.disabled=true;}
  source.addEventListener('input',invalidate);target.addEventListener('change',invalidate);
  output.addEventListener('input',()=>{copy.disabled=!output.value.trim();fill.disabled=!panelResult||!output.value.trim();});
  function visible(e){const r=e.getBoundingClientRect();const footer=document.querySelector('#main footer')?.getBoundingClientRect();const header=document.querySelector('#main header')?.getBoundingClientRect();return r.width>0&&r.height>0&&r.bottom>(header?.bottom||0)&&r.top<(footer?.top||innerHeight)&&r.right>0&&r.left<innerWidth;}
  function messageText(e){return Array.from(e.querySelectorAll('span.selectable-text')).filter(s=>!s.closest('.wat-owned')).map(s=>s.innerText).join('\n').trim();}
  async function translateDraft(){
    if(panelBusy)return;
    const text=source.value.trim();if(!text){feedback.textContent='请先输入要翻译的文字。';return;}
    invalidate();panelBusy=true;translateButton.disabled=true;
    const token=generation,chat=chatKey();feedback.textContent='正在生成译文…';
    try{
      const r=await send({type:'TRANSLATE',text,target:target.value});
      if(token!==generation||chat!==chatKey()){feedback.textContent='输入、语言或聊天已改变，已丢弃过期译文。';return;}
      const cautions=r.cautions||[];
      output.value=r.translation;panelResult=cautions.length?null:{chat,source:text};copy.disabled=!!cautions.length;fill.disabled=!!cautions.length;
      notes.textContent=[...cautions,...r.notes].join(' / ');feedback.textContent=cautions.length?'⚠ 原文有疑似错字，此译文不可直接使用。请核对、编辑上方原文后重译。':`${WATCore.providers[r.engine].label} · 已生成；请核对后手动发送。`;
    }catch(e){feedback.textContent=e.message;}finally{panelBusy=false;translateButton.disabled=false;}
  }
  async function fillDraft(){
    const editor=getEditor();
    if(!panelResult||!editor||panelResult.chat!==chatKey()){feedback.textContent='聊天已切换或输入框不存在，请在当前聊天重新翻译。';return;}
    const existing=editor.innerText.trim();
    if(existing && existing!==panelResult.source){feedback.textContent='输入框中有另一份草稿。为避免覆盖，请先自行清空，或复制译文使用。';return;}
    const value=output.value.trim();if(!value)return;
    editor.focus();const selection=window.getSelection(),range=document.createRange();range.selectNodeContents(editor);selection.removeAllRanges();selection.addRange(range);
    // Browser editing command emits genuine editing events for the framework.
    // Never set innerText and never synthesize Enter or click WhatsApp send.
    const chat=panelResult.chat;
    fill.disabled=true;feedback.textContent='正在核对输入框内容…';
    document.execCommand('insertText',false,value);
    // WhatsApp's editor settles asynchronously; execCommand's boolean is not
    // authoritative. Require two matching rendered-state checks, never resend.
    let stable=0,matched=false;
    for(let i=0;i<12;i++){
      await new Promise(resolve=>setTimeout(resolve,40));
      if(chatKey()!==chat){feedback.textContent='聊天已改变，请检查草稿。没有发送消息。';return;}
      const current=getEditor();
      stable=current&&current.innerText.trim()===value?stable+1:0;
      if(stable>=2){matched=true;break;}
    }
    fill.disabled=!panelResult||!output.value.trim();
    feedback.textContent=matched?'已填入输入框，尚未发送。请在 WhatsApp 内核对并手动发送。':'未能验证填入结果，请检查输入框；可使用“复制译文”手动粘贴。';
  }
  async function translateMessage(el,entry){
    if(entry.pending||!alive)return;
    const text=messageText(el);if(!text)return;
    entry.pending=true;entry.attempted=true;entry.action.disabled=true;entry.out.textContent='翻译中…';
    const rev=revision,key=chatKey();
    try{
      const r=await send({type:'TRANSLATE',text,target:config.incoming});
      if(!el.isConnected||text!==messageText(el)||rev!==revision||key!==chatKey())return;
      const cautions=r.cautions||[];
      entry.out.textContent=(cautions.length?'⚠ 待核对译文：':'')+r.translation;entry.note.textContent=[...cautions,...r.notes].join(' / ');entry.action.textContent='重新翻译';
    }catch(e){if(el.isConnected){entry.out.textContent=e.message;entry.action.textContent='重试翻译';}}
    finally{entry.pending=false;entry.action.disabled=false;}
  }
  function scan(){
    if(!alive)return;
    const footer=document.querySelector('#main footer')?.getBoundingClientRect();
    if(footer&&footer.height>0)panel.style.setProperty('bottom',Math.max(24,innerHeight-footer.top+12)+'px','important');
    if(!document.getElementById('wat-launcher'))document.body.append(launcher,panel);
    const key=chatKey();if(key!==currentChat){currentChat=key;revision++;invalidate();}
    let autoStarted=0;
    for(const el of document.querySelectorAll('#main [data-pre-plain-text]')){
      const text=messageText(el);if(!text)continue;
      let entry=entries.get(el);const sig=signature();
      if(entry&&(!entry.box.isConnected||entry.text!==text||entry.sig!==sig||entry.chat!==key)){entry.box.remove();entries.delete(el);entry=null;}
      if(!entry){
        const box=node('div','wat-owned wat-translation');
        entry={box,text,sig,chat:key,pending:false,attempted:false,out:node('div','wat-translated'),note:node('small','wat-note')};
        entry.action=button(`翻译为${WATCore.languages[config.incoming]||'中文'}`,()=>translateMessage(el,entry));
        entry.edit=button('编辑原文再译',()=>{panel.hidden=false;launcher.setAttribute('aria-expanded','true');source.value=messageText(el);target.value=config.incoming;targetPicker.refresh();invalidate();feedback.textContent='已读取原文。核对后点击“生成译文”，不会改动原始聊天消息。';source.focus();});
        const cautions=WATCore.inspectText(text);entry.note.textContent=cautions.join(' / ');entry.cautious=!!cautions.length;
        box.append(entry.action,entry.edit,entry.out,entry.note);el.append(box);entries.set(el,entry);
      }
      if(config.enabled&&config.auto&&WATAutoComposer.isIncoming(el)&&!entry.attempted&&visible(el)&&autoStarted<2){
        if(entry.cautious){entry.attempted=true;entry.out.textContent='⚠ 原文疑似输入错误，已暂停自动翻译；请编辑原文再译。';}
        else{autoStarted++;translateMessage(el,entry);}
      }
    }
  }
  async function refreshStatus(){
    if(!alive||statusBusy)return;statusBusy=true;
    try{
      const r=await send({type:'STATUS'}),oldSig=signature(),oldOutgoing=config.outgoing;config=r.settings;
      WATAutoComposer.configure(config);
      if(oldSig!==signature()){revision++;invalidate();}
      if(oldOutgoing!==config.outgoing){invalidate();target.value=config.outgoing;targetPicker.refresh();}
      const label=config.enabled?'已启用':r.authenticated?'待启用':'请登录';launcherText.textContent=`超级翻译 · ${label}`;
      state.textContent=`${label} · ${config.auto?'可见消息自动翻译':'逐条点击翻译'} · v${r.version}`;state.classList.toggle('wat-state-active',config.enabled);scan();
    }catch(e){state.textContent=e.message;}finally{statusBusy=false;}
  }
  const observer=new MutationObserver(records=>{
    if(!alive)return;
    if(records.every(r=>r.target instanceof Element && r.target.closest('.wat-owned')))return;
    clearTimeout(timer);timer=setTimeout(scan,250);
  });
  observer.observe(document.body,{subtree:true,childList:true,characterData:true});
  document.addEventListener('scroll',()=>{clearTimeout(timer);timer=setTimeout(scan,200);},true);
  setInterval(refreshStatus,4000);refreshStatus();
})();
