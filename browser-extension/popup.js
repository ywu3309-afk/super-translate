(() => {
  'use strict';
  const $=id=>document.getElementById(id);let state=null,busy=false,webActive=false,optionsTab=false;
  for(const id of ['incoming','outgoing','web-target'])for(const [value,label]of Object.entries(WATCore.languages)){const option=document.createElement('option');option.value=value;option.textContent=label;$(id).append(option);}
  $('web-target').value='zh-CN';
  const pickers=['incoming','outgoing','web-target'].map(id=>STLanguagePicker($(id)));
  const number=value=>value===null?'不限':Number.isSafeInteger(value)?value.toLocaleString('zh-CN'):'—';
  function feedback(message,error=false){$('feedback').textContent=message;$('feedback').classList.toggle('error',error);}
  async function send(message){const response=await chrome.runtime.sendMessage(message);if(!response?.ok)throw new Error(response?.error||'插件后台没有响应，请重新打开插件。');return response;}
  function render(data){
    const initializeLogin=!state||state.authenticated;state=data;const auth=data.authenticated,account=data.account;
    $('version').textContent=`v${data.version}`;$('login-section').hidden=auth;$('account-section').hidden=!auth;$('test-section').hidden=!auth;$('web-section').hidden=!auth;
    $('connection-label').textContent=auth?'云端账号已登录':'登录后开启云端翻译';$('connection-dot').classList.toggle('online',auth);
    $('preferences').disabled=!auth;for(const id of ['incoming','outgoing']){$(id).value=data.settings[id];$(id).disabled=!auth;}pickers.forEach(p=>p.refresh());
    $('enabled').checked=data.settings.enabled;$('auto').checked=data.settings.auto;
    $('auto-send').checked=data.settings.autoSend;$('live-preview').checked=data.settings.livePreview;$('reply-mode').value=data.settings.replyMode;
    $('settings-hint').textContent=auth?'客户语言自动识别；不确定时保留历史语言或请你手动指定。':'登录后即可启用翻译。';
    if(!auth){if(initializeLogin){$('username').value=data.lastUsername||'';$('remember').checked=!!data.lastUsername;}$('test-result').textContent='';$('sample').value='';webActive=false;return;}
    $('account-name').textContent=account.username;$('account-name').title=account.username;$('account-role').textContent=account.role;
    $('remaining').textContent=number(account.quota);$('used').textContent=number(account.used);$('plan').textContent=account.plan;$('expires').textContent=account.expires?`${account.expires} 到期`:'到期日以套餐为准';
    const total=(account.quota||0)+(account.used||0),percent=account.quota===null?0:total>0?Math.min(100,Math.round(account.used/total*100)):100;
    $('quota-bar').style.width=`${percent}%`;$('quota-progress').setAttribute('aria-valuenow',String(percent));$('quota-progress').setAttribute('aria-valuetext',account.quota===null?'不限字符':`已使用 ${percent}%`);$('quota-progress').classList.toggle('warning',percent>=70);
  }
  const webSettings=()=>({target:$('web-target').value,mode:$('web-mode').value,dynamic:$('web-dynamic').checked,subtitles:$('web-subtitles').checked,showToolbar:true});
  const detectOptionsTab=()=>new Promise(resolve=>{
    if(!chrome.tabs?.getCurrent){resolve(false);return;}
    try{chrome.tabs.getCurrent(tab=>{void chrome.runtime.lastError;resolve(!!tab);});}catch{resolve(false);}
  });
  function renderWeb(result){
    if(optionsTab){
      webActive=false;$('web-start').disabled=true;$('web-stop').disabled=true;
      $('web-status').textContent='请从浏览器工具栏的扩展图标打开本面板，再翻译当前网页。';
      return;
    }
    webActive=result?.active===true||result?.status?.enabled===true;
    $('web-start').textContent=webActive?'更新本页翻译':'翻译当前网页';$('web-stop').disabled=!webActive;
    if(result?.settings){$('web-target').value=result.settings.target||$('web-target').value;$('web-mode').value=result.settings.mode==='replace'?'replace':'bilingual';$('web-dynamic').checked=result.settings.dynamic!==false;$('web-subtitles').checked=result.settings.subtitles===true;pickers[2].refresh();}
    const count=Number(result?.status?.translatedUnits)||0;
    $('web-status').textContent=webActive?`当前网页翻译已启用${count?` · 已处理 ${count} 个文本块`:''}。可在页面右上角切换显示或停止。`:'当前网页尚未启用通用翻译。';
  }
  async function refreshWebStatus(){
    if(!state?.authenticated)return;
    if(!optionsTab)optionsTab=await detectOptionsTab();
    if(optionsTab){renderWeb(null);return;}
    try{renderWeb(await send({type:'WEB_ACTION',action:'status'}));}
    catch(error){webActive=false;$('web-stop').disabled=true;$('web-status').textContent=error.message;}
  }
  async function action(button,job){if(busy)return;busy=true;button.disabled=true;feedback('');try{await job();}catch(error){feedback(error.message,true);try{render(await send({type:'STATUS'}));}catch{}}finally{busy=false;button.disabled=false;}}
  $('show-password').addEventListener('click',()=>{const showing=$('password').type==='password';$('password').type=showing?'text':'password';$('show-password').textContent=showing?'隐藏':'显示';$('show-password').setAttribute('aria-label',showing?'隐藏密码':'显示密码');$('show-password').setAttribute('aria-pressed',String(showing));});
  $('login-form').addEventListener('submit',event=>{event.preventDefault();action($('login-button'),async()=>{const password=$('password').value;$('password').value='';$('password').type='password';$('show-password').textContent='显示';$('show-password').setAttribute('aria-label','显示密码');$('show-password').setAttribute('aria-pressed','false');render(await send({type:'LOGIN',username:$('username').value,password,rememberUsername:$('remember').checked}));await refreshWebStatus();feedback('登录成功，请确认语言并启用云端翻译。');});});
  $('logout').addEventListener('click',()=>action($('logout'),async()=>{render(await send({type:'LOGOUT'}));feedback('已退出本插件，云端翻译已停用。');}));
  $('refresh').addEventListener('click',()=>action($('refresh'),async()=>{render(await send({type:'REFRESH_ACCOUNT'}));feedback('已刷新云端额度。');}));
  $('settings-form').addEventListener('submit',event=>{event.preventDefault();action($('save'),async()=>{render(await send({type:'SAVE_SETTINGS',settings:{...WATCore.defaults,enabled:$('enabled').checked,auto:$('auto').checked,autoSend:$('auto-send').checked,livePreview:$('live-preview').checked,replyMode:$('reply-mode').value,incoming:$('incoming').value,outgoing:$('outgoing').value}}));feedback('翻译偏好已保存。');});});
  $('test-form').addEventListener('submit',event=>{event.preventDefault();action($('test-button'),async()=>{$('test-result').textContent='';if(!state?.settings.enabled)throw new Error('请先启用云端翻译并保存。');const response=await send({type:'TRANSLATE',text:$('sample').value,target:state.settings.outgoing});$('test-result').textContent=response.translation;render(await send({type:'STATUS'}));feedback(`试译成功，本次扣除 ${number(response.charged)} 字符。`);});});
  $('web-start').addEventListener('click',()=>action($('web-start'),async()=>{if(await detectOptionsTab()){optionsTab=true;renderWeb(null);throw new Error('请从浏览器工具栏的扩展图标打开本面板。');}if(!state?.settings.enabled)throw new Error('请先启用云端翻译并保存。');renderWeb(await send({type:'WEB_ACTION',action:webActive?'configure':'start',settings:webSettings()}));feedback('当前网页翻译已启用；网页文字会按字符额度计费。');}));
  $('web-stop').addEventListener('click',()=>action($('web-stop'),async()=>{renderWeb(await send({type:'WEB_ACTION',action:'stop'}));feedback('已恢复当前网页原文，并停止字幕翻译。');}));
  detectOptionsTab().then(value=>{optionsTab=value;return send({type:'STATUS'});}).then(data=>{render(data);return refreshWebStatus();},error=>{feedback(error.message,true);$('connection-label').textContent='暂时无法读取账号状态';});
})();
