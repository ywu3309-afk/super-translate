(() => {
  'use strict';
  const M=WorkbenchModel, $=id=>document.getElementById(id), api=window.superDesktop, CRM=window.TrafficCRM;
  const storageKey='super-translate-workbench-v1';
  const platformApi=globalThis.PlatformRegistry||{registry:{whatsapp:{name:'WhatsApp',icon:'🟢',url:'https://web.whatsapp.com/'}},keys:['whatsapp'],get(k){return this.registry[k]||null;}};
const CONFIRMED_PLATFORM_ORDER=['whatsapp','whatsapp_multi','zalo','line_generic','telegram','tiktok','instagram','facebook','facebook_page','twitter','messenger','line','snapchat','discord','line_works','linkedin'];
const CONFIRMED_PLATFORMS=new Set(CONFIRMED_PLATFORM_ORDER);
  const platformRegistry=platformApi.registry;
  let state=M.initial(), filter='all', scope='contact', tool='translation', selectedFile=null, toastTimer, busy=false, generation=0;
let autoReplyEnabled=localStorage.getItem('super-translate.auto-reply')==='1',autoReplyRules=null,autoReplyBusy=false;const autoReplyCooldown=new Map();
  // Account-level unread state is intentionally separate from contact unread
  // state.  It is persisted with the account list so a renderer reload does
  // not lose notifications, while transient toast DOM is never persisted.
  const unreadDataMap=Object.create(null);
  const messageFingerprintTimes=new Map();
  let live=false, liveSnapshot=null, rightPaneCollapsed=false, refreshingPage=false;
  let livePreview={chat:'',status:'idle',original:'',translation:'',error:'',targetLabel:'英语'};const connectionState={};let quickCache=null,customerListQuery='',customerProfileRecord=null;
  let serviceViewStatus={status:'idle',message:''};
  const voiceState={phase:'idle',startedAt:0,elapsed:0,chunks:[],frames:0,sampleRate:48000,stream:null,context:null,source:null,processor:null,silentGain:null,timer:null,transcript:'',translation:'',language:'',error:''};
  let voicePanelToken=0,speechTierSnapshot='advanced',speechInstallSnapshot={stage:'idle',message:''};
  const speechTierLabels={basic:'初级语音版',advanced:'高级多语言版',flagship:'旗舰高精度版'};
  const speechModelDownloads={
    basic:{name:'超级翻译-语音转文字AI大模型.zip',baidu:'https://pan.baidu.com/s/1mRasLLQRXkz3lVR9uyRgfw?pwd=1013',baiduCode:'1013',feiji:'https://share.feijipan.com/s/id9Xkbqs'},
    advanced:{name:'超级翻译-高级多语言语音AI-v1.0.0.zip',baidu:'',baiduCode:'',feiji:''},
    flagship:{name:'超级翻译-旗舰高精度语音AI-v1.0.0.zip',baidu:'',baiduCode:'',feiji:''},
  };
  let crmCustomer=null,crmCustomerPhone='',crmContactError='',crmContactToken=0,crmReportToken=0;
  // The add-service dialog is rendered by the workbench renderer while the
  // real WhatsApp page is a native WebContentsView above it. Hide that view
  // while the dialog is open, otherwise the view paints over the modal and
  // makes the page look blurred/blank (the issue shown in the screenshot).
  let serviceModalViewHidden=false;
  const crmToday=()=>CRM?.localDate?CRM.localDate(Date.now()):new Date().toLocaleDateString('en-CA');
  let crmReportDate=crmToday();
  try{const saved=JSON.parse(localStorage.getItem(storageKey));if(saved?.version===1&&Array.isArray(saved.contacts)&&Array.isArray(saved.accounts)&&saved.accounts.length){state={...state,...saved};}}catch{}
  const legacyAccountNames=new Set(['Super IPTV','car seat','Super Translate']);
  const platformInstanceCounts=Object.create(null);
  state.accounts.forEach((a,i)=>{a.platform=platformRegistry[a.platform]?a.platform:'whatsapp';const platform=platformRegistry[a.platform];a.platformName=platform.name;a.icon=platform.icon;a.iconFallback=platform.iconFallback||platform.name.slice(0,2).toUpperCase();a.url=platform.url;if(!a.name||legacyAccountNames.has(a.name))a.name=M.accountName(i);a.short=String(i+1).padStart(2,'0');a.instanceNumber=++platformInstanceCounts[a.platform];a.partition=a.partition||`persist:${a.id}`;a.pinned=a.pinned===true;const unread=Number.isSafeInteger(a.unread)&&a.unread>0?a.unread:0;a.unread=unread;unreadDataMap[a.id]=unread;});
  localStorage.setItem(storageKey,JSON.stringify(state));
  let active=state.contacts.find(c=>c.id===state.selectedContact)||state.contacts[0];
  function save(){try{localStorage.setItem(storageKey,JSON.stringify(state));$('saved-status').textContent='已保存';}catch{toast('本机存储失败，设置未保存。');}}
  function icons(){lucide.createIcons({attrs:{'aria-hidden':'true'}});}
  function node(tag,cls='',text){const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;}
  function appendPlatformLogo(container,platform,className){
    const wrap=container||node('span');
    const image=node('img',className||'');
    image.src=String(platform?.icon||'');image.alt=platform?.name||'平台图标';image.loading='lazy';image.decoding='async';image.referrerPolicy='no-referrer';
    const fallback=node('span','platform-logo-fallback',platform?.iconFallback||platform?.name?.slice(0,2)||'•');fallback.setAttribute('aria-hidden','true');
    image.addEventListener('error',()=>{image.hidden=true;fallback.hidden=false;wrap.classList.add('logo-fallback-active');},{once:true});fallback.hidden=Boolean(platform?.icon);
    wrap.append(image,fallback);return wrap;
  }
  function icon(name){const e=node('i');e.dataset.lucide=name;return e;}
  function button(label,handler,cls='secondary-button'){const b=node('button',cls,label);b.type='button';b.addEventListener('click',handler);return b;}
  function toast(text){$('toast').textContent=text;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,4200);}
  function updateAccountBadge(accountId,count,{persist=true}={}){
    const account=state.accounts.find(item=>item.id===accountId);if(!account)return;
    const next=Math.max(0,Math.min(999999,Number.isFinite(Number(count))?Math.floor(Number(count)):0));
    const changed=unreadDataMap[accountId]!==next||account.unread!==next;unreadDataMap[accountId]=next;account.unread=next;
    const el=document.getElementById(`account-card-${accountId}`)||[...document.querySelectorAll('[data-account]')].find(item=>item.dataset.account===accountId);
    if(el){el.classList.toggle('has-unread',next>0&&state.selectedAccount!==accountId);let badge=el.querySelector('.account-badge');if(next>0&&state.selectedAccount!==accountId){if(!badge){badge=node('span','account-badge');badge.setAttribute('aria-hidden','true');el.append(badge);}badge.textContent=next>99?'99+':String(next);badge.hidden=false;}else if(badge){badge.hidden=true;}}
    if(changed&&persist)save();
  }
  function clearAccountUnread(accountId){updateAccountBadge(accountId,0);}
  function showToastNotification(accountId,sender,content){
    const account=state.accounts.find(item=>item.id===accountId);if(!account)return;
    let container=$('message-toast-container');if(!container){container=node('div','msg-toast-container');container.id='message-toast-container';container.setAttribute('aria-live','polite');document.body.append(container);}
    const item=node('div','msg-toast');item.setAttribute('role','status');item.append(node('div','toast-account','来自：'+account.name),node('div','toast-sender',String(sender||'新消息').slice(0,160)),node('div','toast-body',String(content||'发来了一条新消息').slice(0,500)));
    item.addEventListener('click',()=>{item.remove();switchAccount(accountId);});container.append(item);
    setTimeout(()=>{if(!item.isConnected)return;item.classList.add('is-dismissing');setTimeout(()=>item.remove(),320);},5000);
  }
  function handleNewMessageIncoming(accountId,sender='',content='',count){
    const account=state.accounts.find(item=>item.id===accountId);if(!account)return;
    const current=unreadDataMap[accountId]||0,explicit=Number.isFinite(Number(count));
    const next=explicit?Math.max(current,Math.floor(Number(count))):current+1;const isCurrent=state.selectedAccount===accountId;
    updateAccountBadge(accountId,isCurrent?0:next);
    if(!isCurrent){const fingerprint=accountId+'\0'+String(sender||'')+'\0'+String(content||'');const now=Date.now(),seen=messageFingerprintTimes.get(fingerprint)||0;if(now-seen>3500){messageFingerprintTimes.set(fingerprint,now);showToastNotification(accountId,sender,content);}}
  }
  let updateSnapshot={status:'idle'};
  function updateLabel(data){const status=data?.status||'idle';if(status==='checking')return'正在检查更新…';if(status==='available')return`发现新版本 v${data.version||''}`;if(status==='downloading')return`正在下载 v${data.version||''} · ${Math.max(0,Math.min(100,Math.round(data.percent||0)))}%`;if(status==='downloaded')return`更新已下载 · v${data.version||''}`;if(status==='not-available')return'当前已是最新版本';if(status==='error')return`更新失败：${data.message||'请稍后重试'}`;if(status==='dev')return'开发模式未连接线上发布源';return'尚未检查更新';}
  function applyUpdateStatus(data){updateSnapshot={...updateSnapshot,...(data||{})};const status=$('update-status');if(status)status.textContent=updateLabel(updateSnapshot);const download=$('update-download'),install=$('update-install');if(download)download.hidden=updateSnapshot.status!=='available';if(install)install.hidden=updateSnapshot.status!=='downloaded';}
  if(api?.onUpdateStatus)api.onUpdateStatus(applyUpdateStatus);
  function titleFor(c){return c?.internalName||c?.number||'未选择联系人';}
  function currentPlatformName(){const account=state.accounts.find(item=>item.id===state.selectedAccount);return platformRegistry[account?.platform||liveSnapshot?.platform||'whatsapp']?.name||account?.platformName||'当前服务';}
  function current(){return live?(liveSnapshot?{id:liveSnapshot.key,number:liveSnapshot.title,phone:liveSnapshot.phone,country:liveSnapshot.country||'',lang:liveSnapshot.language||'en',...(state.liveProfiles[liveSnapshot.key]||{})}:null):active;}
  function syncAnnotation(){if(!live||!liveSnapshot?.key)return;const c=current();api.annotate({chat:c.id,name:c.internalName||'',note:c.note||'',country:c.country||''}).catch(()=>{});api.profiles(Object.entries(state.liveProfiles).map(([key,c])=>({key,hash:key,title:c.title||c.platformTitle||'',name:c.internalName||'',note:c.note||'',country:c.country||'',phone:c.phone||''}))).catch(()=>{});}
  function normalizedCrmPhone(value){try{return CRM?.normalizePhone(value||'')||'';}catch{return'';}}
  function crmStatusText(status){return status==='deal'?'已成交':'正在跟进';}
  function crmCustomerIsCurrent(phone,key=liveSnapshot?.key){return !!live&&!!key&&liveSnapshot?.key===key&&normalizedCrmPhone(current()?.phone)===phone;}
  function syncCrmProfile(customer,key=liveSnapshot?.key){
    if(!customer||!key)return;const profile=state.liveProfiles[key]??={};const label=crmStatusText(customer.status);
    if(profile.crmStatus!==customer.status||profile.status!==label){profile.crmStatus=customer.status;profile.status=label;save();}
  }
  function renderCrmStatusControl(host){
    if(!host)return;host.replaceChildren();const c=current(),phone=normalizedCrmPhone(c?.phone),record=phone&&phone===crmCustomerPhone?crmCustomer:null;
    const head=node('div','crm-contact-head');head.append(node('strong','', '客户成交状态'),node('span','crm-local-chip','本机去重'));host.append(head);
    if(!CRM){host.append(node('p','crm-contact-empty','客户统计模块未加载，请重新启动最新版软件。'));return;}
    if(!live){host.append(node('p','crm-contact-empty',`打开真实 ${currentPlatformName()} 联系人后，可记录跟进与成交状态。`));return;}
    if(!phone){host.append(node('p','crm-contact-empty','等待读取当前客户的国际电话号码；群组不会计入客户统计。'));return;}
    const meta=node('div','crm-contact-meta');meta.append(node('span','crm-contact-phone','+'+phone),node('span','',record?`${record.flag} ${record.country}`:'正在建立去重档案…'));host.append(meta);
    if(record){const first=node('p','crm-first-contact',`首次联系：${record.firstContactDate} · ${new Date(record.firstContactTimestamp).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'})}`);host.append(first);}
    else if(crmContactError)host.append(node('p','crm-contact-error',crmContactError));
    const actions=node('div','crm-status-actions');for(const [status,label]of [['following','🟡 正在跟进'],['deal','🟢 已成交']]){const b=button(label,()=>setCrmStatus(phone,status),'crm-status-button '+status+(record?.status===status?' active':''));b.dataset.crmStatus=status;b.setAttribute('aria-pressed',String(record?.status===status));b.disabled=!record;b.title=record?`将当前客户标记为${crmStatusText(status)}`:'正在等待客户档案';actions.append(b);}host.append(actions);
  }
  function paintCrmStatusControls(){document.querySelectorAll('[data-crm-contact-status]').forEach(renderCrmStatusControl);}
  function ensureCrmStatusCard(){
    const parent=document.querySelector('#translation-panel .compact-section')?.parentElement;if(!parent)return;let card=$('crm-contact-card');
    if(!card){card=node('section','crm-contact-card');card.id='crm-contact-card';card.dataset.crmContactStatus='';parent.append(card);}renderCrmStatusControl(card);
  }
  async function ensureLiveCrmCustomer(snapshot=liveSnapshot){
    if(!CRM||!live||!snapshot?.key)return null;const raw=current()?.phone||snapshot.phone,phone=normalizedCrmPhone(raw);if(snapshot.group||!phone){crmCustomer=null;crmCustomerPhone='';crmContactError='';paintCrmStatusControls();return null;}
    const key=snapshot.key,token=++crmContactToken;if(phone!==crmCustomerPhone){crmCustomer=null;crmCustomerPhone=phone;crmContactError='';paintCrmStatusControls();}
    try{
      const contact=current();const result=await CRM.ensureCustomer(raw,{accountId:state.selectedAccount,country:contact?.country||snapshot.country||'',countryCode:contact?.countryCode||snapshot.countryCode||''});if(token!==crmContactToken||!crmCustomerIsCurrent(phone,key))return result;
      crmCustomer=result.customer;crmCustomerPhone=phone;crmContactError='';syncCrmProfile(result.customer,key);paintCrmStatusControls();if(tool==='fans')refreshFansReport();
      if(result.isNew)toast(`今日新增客户 +1 · ${result.customer.flag} ${result.customer.country}`);return result;
    }catch(error){if(token===crmContactToken&&crmCustomerIsCurrent(phone,key)){crmContactError=String(error?.message||'客户档案保存失败。').slice(0,180);paintCrmStatusControls();}throw error;}
  }
  async function setCrmStatus(phone,status){
    if(!CRM||!liveSnapshot?.key)return;const key=liveSnapshot.key,token=++crmContactToken;document.querySelectorAll('.crm-status-button').forEach(b=>b.disabled=true);
    try{
      const accountId=state.selectedAccount;let record=await CRM.getCustomer(phone,{accountId});if(!record){const contact=current();record=(await CRM.ensureCustomer(phone,{accountId,country:contact?.country||liveSnapshot?.country||'',countryCode:contact?.countryCode||liveSnapshot?.countryCode||''})).customer;}if(token!==crmContactToken||!crmCustomerIsCurrent(phone,key))return;const updated=await CRM.setStatus(phone,status,{accountId});
      if(token!==crmContactToken||!crmCustomerIsCurrent(phone,key))return;crmCustomer=updated;crmCustomerPhone=phone;crmContactError='';syncCrmProfile(updated,key);paintCrmStatusControls();toast(`已标记为${crmStatusText(status)}，并保存到本机客户库。`);
      if(tool==='fans')refreshFansReport();
    }catch(error){if(token===crmContactToken){crmContactError=String(error?.message||'客户状态保存失败。').slice(0,180);paintCrmStatusControls();toast(crmContactError);}}
    finally{if(token===crmContactToken&&crmCustomerIsCurrent(phone,key))paintCrmStatusControls();}
  }
  function crmMetric(label,value,sub,id,accent=''){
    const card=node('div','crm-metric '+accent),valueNode=node('strong','crm-metric-value',String(value));if(id)valueNode.id=id;card.append(node('span','crm-metric-label',label),valueNode,node('small','crm-metric-sub',sub||''));return card;
  }
  function renderFansPanel(panel){
    panel.dataset.crmPanel='fans';panel.replaceChildren();const today=crmToday(),isToday=crmReportDate===today;
    const intro=node('p','panel-help','按客户电话号码严格去重；所选日期新增只计算 firstContactDate 等于该日期的客户。已成交与转化率均按该日期新增客户组计算。');panel.append(intro);
    const dateRow=node('div','crm-report-toolbar'),dateLabel=node('label','crm-date-label','报表日期');const dateInput=node('input','crm-date-input');dateInput.type='date';dateInput.id='crm-report-date';dateInput.value=crmReportDate;dateInput.max=crmToday();dateLabel.append(dateInput);dateRow.append(dateLabel);const exportButton=button('导出 CSV',async()=>{const date=dateInput.value||crmToday();try{if(!CRM)throw new Error('客户统计模块未加载。');exportButton.disabled=true;await CRM.downloadCsv(date,`超级翻译-${state.selectedAccount||'账号'}-进粉报表-${date}.csv`,{accountId:state.selectedAccount});toast(`已导出 ${date} 的当前账号进粉名单。`);}catch(error){toast(error.message||'CSV 导出失败。');}finally{exportButton.disabled=false;}} ,'secondary-button crm-export-button');exportButton.id='crm-export-csv';dateRow.append(exportButton);panel.append(dateRow);
    const metrics=node('div','crm-metrics');metrics.id='crm-metrics';metrics.append(crmMetric(isToday?'今日新增客户':'新增客户','—',isToday?'今日 · 严格去重':crmReportDate+' · 严格去重','crm-new-count','new'),crmMetric('已成交客户','—','所选日期新增客户','crm-deal-count','deal'),crmMetric('进粉转化率','—','已成交 ÷ 新增','crm-conversion','conversion'));panel.append(metrics);
    const countrySection=node('section','crm-report-section'),countryHead=node('div','crm-report-section-head');countryHead.append(node('strong','','国家来源分布'),node('span','crm-report-muted','按新增客户'));countrySection.append(countryHead);const countries=node('div','crm-country-list');countries.id='crm-country-list';countrySection.append(countries);panel.append(countrySection);
    const listSection=node('section','crm-report-section'),listHead=node('div','crm-report-section-head');listHead.append(node('strong','','进粉名单'),node('span','crm-report-muted','号码仅存本机'));listSection.append(listHead);const list=node('div','crm-customer-list');list.id='crm-customer-list';listSection.append(list);panel.append(listSection);
    const error=node('p','crm-report-error');error.id='crm-report-error';error.hidden=true;panel.append(error);
    dateInput.addEventListener('change',()=>{const value=dateInput.value;if(!value)return;crmReportDate=value;renderFansPanel(panel);});
    if(!CRM){error.hidden=false;error.textContent='客户统计模块未加载，请重新启动最新版软件。';return;}
    refreshFansReport();
  }
  function refreshFansReport(){
    const panel=$('tool-panel');if(tool!=='fans'||panel?.dataset.crmPanel!=='fans'||!CRM)return;const dateInput=$('crm-report-date');const date=dateInput?.value||crmReportDate||crmToday();crmReportDate=date;const token=++crmReportToken;const error=$('crm-report-error');if(error){error.hidden=true;error.textContent='';}
    CRM.getDailyReport(date,{accountId:state.selectedAccount}).then(report=>{
      if(token!==crmReportToken||tool!=='fans'||$('tool-panel')?.dataset.crmPanel!=='fans')return;
      const set=(id,value)=>{const el=$(id);if(el)el.textContent=String(value);};set('crm-new-count',report.newCustomers);set('crm-deal-count',report.dealCustomers);set('crm-conversion',`${Number(report.conversionRate||0).toFixed(report.conversionRate%1?2:0)}%`);
      const countries=$('crm-country-list');countries.replaceChildren();if(!report.countryDistribution?.length)countries.append(node('p','crm-empty','所选日期暂无新增客户。'));else for(const item of report.countryDistribution){const row=node('div','crm-country-row'),left=node('span','crm-country-name',`${item.flag||'🌐'} ${item.country||'未知'}`),count=node('span','crm-country-count',`${item.count} 人 · ${Number(item.percentage||0).toFixed(item.percentage%1?2:0)}%`),bar=node('span','crm-country-bar'),fill=node('i');fill.style.width=Math.max(0,Math.min(100,Number(item.percentage)||0))+'%';bar.append(fill);row.append(left,count,bar);countries.append(row);}
      const list=$('crm-customer-list');list.replaceChildren();if(!report.customers?.length)list.append(node('p','crm-empty','所选日期暂无进粉记录。'));else for(const customer of report.customers){const row=node('div','crm-customer-row'),time=new Date(customer.firstContactTimestamp).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'});row.append(node('span','crm-customer-identity',`${customer.flag||'🌐'} +${customer.phone}`),node('span','crm-customer-country',customer.country||'未知'),node('span','crm-customer-time',time),node('span','crm-customer-status '+(customer.status==='deal'?'deal':'following'),crmStatusText(customer.status)));list.append(row);}
    }).catch(errorValue=>{if(token!==crmReportToken)return;if(error){error.hidden=false;error.textContent=String(errorValue?.message||'读取客户统计失败。').slice(0,180);}});
  }
  function rules(){return M.rulesFor(state,current(),scope);}
  function liveRules(contact=current()){return M.effectiveLiveRules(M.rulesFor(state,contact));}
  function searchableSelectLabel(select){return select?.selectedOptions?.[0]?.textContent?.trim()||select?.value||'请选择';}
  function syncSearchableSelect(select){
    const host=select?.closest('.search-select');if(!host)return;
    const trigger=host.querySelector('.search-select-trigger'),menu=host.querySelector('.search-select-menu'),options=host.querySelector('.search-select-options');
    if(trigger)trigger.querySelector('.search-select-value').textContent=searchableSelectLabel(select);
    if(trigger){trigger.disabled=!!select.disabled;trigger.setAttribute('aria-expanded',String(!menu.hidden));}
    if(options){options.replaceChildren();for(const option of select.options){const item=node('button','search-select-option',option.textContent.trim());item.type='button';item.dataset.value=option.value;item.dataset.search=(option.textContent+' '+option.value).toLowerCase();item.classList.toggle('active',option.value===select.value);item.setAttribute('role','option');item.setAttribute('aria-selected',String(option.value===select.value));item.addEventListener('click',()=>{select.value=option.value;select.dispatchEvent(new Event('change',{bubbles:true}));menu.hidden=true;host.querySelector('.search-select-search').value='';syncSearchableSelect(select);});options.append(item);}}
  }
  function initSearchableSelects(){
    document.querySelectorAll('select[data-setting]').forEach(select=>{
      if(select.closest('.search-select'))return;
      const host=node('div','search-select');const trigger=node('button','search-select-trigger');trigger.type='button';trigger.setAttribute('aria-haspopup','listbox');trigger.setAttribute('aria-expanded','false');trigger.append(node('span','search-select-value',searchableSelectLabel(select)),node('span','search-select-chevron','⌄'));
      const menu=node('div','search-select-menu');menu.hidden=true;const searchWrap=node('label','search-select-search-wrap');searchWrap.append(icon('search'));const search=node('input','search-select-search');search.type='search';search.placeholder='搜索语言、代码…';search.autocomplete='off';search.setAttribute('aria-label','搜索语言');searchWrap.append(search);const options=node('div','search-select-options');options.setAttribute('role','listbox');menu.append(searchWrap,options);const parent=select.parentElement;parent.insertBefore(host,select);host.append(trigger,menu,select);select.classList.add('native-language-select');select.setAttribute('aria-hidden','true');select.tabIndex=-1;
      trigger.addEventListener('click',e=>{e.stopPropagation();document.querySelectorAll('.search-select-menu').forEach(item=>{if(item!==menu){item.hidden=true;item.previousElementSibling?.setAttribute('aria-expanded','false');}});menu.hidden=!menu.hidden;syncSearchableSelect(select);if(!menu.hidden){search.value='';search.focus();}});
      search.addEventListener('input',()=>{const query=search.value.trim().toLowerCase();options.querySelectorAll('.search-select-option').forEach(item=>{item.hidden=!!query&&!item.dataset.search.includes(query);});});search.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();menu.hidden=true;trigger.setAttribute('aria-expanded','false');trigger.focus();return;}if(e.key==='Enter'){e.preventDefault();e.stopPropagation();const first=[...options.querySelectorAll('.search-select-option')].find(item=>!item.hidden);if(first)first.click();return;}if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();const visible=[...options.querySelectorAll('.search-select-option')].filter(item=>!item.hidden);if(visible.length)(e.key==='ArrowDown'?visible[0]:visible[visible.length-1]).focus();}});
      syncSearchableSelect(select);
    });
  }
  function showDialog(title,content,actions=[]){
    $('dialog-title').textContent=title;$('dialog-body').replaceChildren();$('dialog-footer').replaceChildren();
    if(typeof content==='string')$('dialog-body').append(node('p','',content));else $('dialog-body').append(content);
    for(const a of actions)$('dialog-footer').append(a);
    $('dialog-footer').append(button('关闭',()=>$('dialog').close()));
    $('dialog').showModal();if(live)api?.viewVisibility(false);icons();
  }
  $('dialog').addEventListener('close',()=>{if(live)api?.viewVisibility(true);});
  const escapeFocus=e=>{if(e.key==='Escape')$('dialog').close();};
  $('dialog').addEventListener('keydown',escapeFocus);
  function preserveDraft(){if(!live&&active)state.drafts[state.selectedAccount+':'+active.id]=$('composer').value;}
  function invalidate(){generation++;busy=false;$('send-button').disabled=false;}
  function selectContact(id){
    preserveDraft();active=state.contacts.find(c=>c.id===id);if(!active)return;
    invalidate();state.selectedContact=id;active.unread=0;$('composer').value=M.scopedDraft(state,state.selectedAccount,id);selectedFile=null;$('attachment-preview').hidden=true;scope='contact';save();renderAll();
  }
  async function deleteAccount(account,clearPartition=false){
    if(!account)return;
    if(state.accounts.length<=1){toast('至少保留一个服务实例，最后一个账号不能删除。');return;}
    const wasCurrent=state.selectedAccount===account.id;
    try{if(api?.removeAccount)await api.removeAccount({id:account.id,clearPartition:!!clearPartition});}
    catch(error){toast(error?.message||'账号实例尚未删除。');return;}
    state.accounts=state.accounts.filter(item=>item.id!==account.id);
    state.contacts=state.contacts.filter(item=>item.account!==account.id);
    for(const key of Object.keys(state.drafts))if(key.startsWith(account.id+':'))delete state.drafts[key];
    delete state.liveProfiles[account.id];delete connectionState[account.id];delete unreadDataMap[account.id];
    if(wasCurrent){const fallback=state.accounts[0];state.selectedAccount=fallback.id;active=state.contacts.find(c=>c.account===fallback.id)||null;state.selectedContact=active?.id||'';}
    save();renderAll();
    if(wasCurrent&&live){try{await api.setLive({active:true,account:state.selectedAccount,platform:state.accounts[0].platform,bounds:liveBounds()});}catch(error){toast(error.message||'切换服务实例失败。');}}
    toast(`已删除“${account.name}”服务实例${clearPartition?'，并清理其本地登录分区':'，本地分区已保留'}。`);
  }
  function showAccountDeleteDialog(account){
    if(state.accounts.length<=1){toast('至少保留一个服务实例，最后一个账号不能删除。');return;}
    const wrap=node('div'),question=node('p','panel-help',`确定删除「${account.name}」吗？这会移除左侧实例及其联系人列表。`),label=node('label','delete-partition-option');const check=node('input');check.type='checkbox';check.id='delete-partition-data';label.append(check,node('span','', '同时清理该实例的 Cookie、LocalStorage 与登录状态'));wrap.append(question,label);
    showDialog('删除服务实例',wrap,[button('确定删除',()=>{const cleanup=check.checked;$('dialog').close();deleteAccount(account,cleanup);},'primary-button danger-button')]);
  }
  function showAccountContextMenu(account,event){
    document.querySelector('.account-context-menu')?.remove();const menu=node('div','account-context-menu');menu.setAttribute('role','menu');const pin=button(account.pinned?'取消置顶':'置顶此账号',()=>{menu.remove();account.pinned=!account.pinned;save();renderAccounts();toast(account.pinned?`已将“${account.name}”置顶。`:`已取消“${account.name}”置顶。`);},'account-context-item');pin.setAttribute('role','menuitem');const remove=button('删除此账号',()=>{menu.remove();showAccountDeleteDialog(account);},'account-context-item danger-text');remove.setAttribute('role','menuitem');menu.append(pin,remove);document.body.append(menu);const pad=4;menu.style.left=Math.min(Math.max(pad,event.clientX),innerWidth-menu.offsetWidth-pad)+'px';menu.style.top=Math.min(Math.max(pad,event.clientY),innerHeight-menu.offsetHeight-pad)+'px';setTimeout(()=>{const close=e=>{if(!e.target.closest('.account-context-menu')){menu.remove();document.removeEventListener('click',close,true);}};document.addEventListener('click',close,true);},0);
  }
  function orderedAccounts(){return [...state.accounts].sort((a,b)=>Number(b.pinned===true)-Number(a.pinned===true));}
  function reorderAccounts(fromId,toId){
    if(!fromId||!toId||fromId===toId)return;
    const from=state.accounts.findIndex(item=>item.id===fromId),to=state.accounts.findIndex(item=>item.id===toId);if(from<0||to<0)return;
    const [moved]=state.accounts.splice(from,1),target=state.accounts.find(item=>item.id===toId);moved.pinned=target?.pinned===true;
    const next=state.accounts.findIndex(item=>item.id===toId);state.accounts.splice(next<0?state.accounts.length:next,0,moved);save();renderAccounts();toast(`${moved.name} 已调整到${moved.pinned?'置顶':'指定'}位置。`);
  }
  function renderAccounts(){
    $('accounts').replaceChildren();for(const a of orderedAccounts()){
      const unread=Math.max(0,Number(unreadDataMap[a.id]??a.unread)||0),isActive=a.id===state.selectedAccount;
      const b=node('div','account-button'+(isActive?' active':'')+(unread>0&&!isActive?' has-unread':'')+(a.pinned?' is-pinned':''));b.id=`account-card-${a.id}`;b.title=`${a.name} · 拖动调整顺序，右键${a.pinned?'取消置顶':'置顶'}`;b.setAttribute('aria-label','切换账号 '+a.name+(a.pinned?'，已置顶':'')+(unread>0?`，${unread} 条未读`:''));b.setAttribute('aria-pressed',String(isActive));b.setAttribute('role','button');b.tabIndex=0;b.draggable=true;b.dataset.account=a.id;
      b.addEventListener('click',()=>switchAccount(a.id));b.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();switchAccount(a.id);}});
      b.addEventListener('contextmenu',e=>{e.preventDefault();showAccountContextMenu(a,e);});
      b.addEventListener('dragstart',e=>{e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',a.id);b.classList.add('is-dragging');});
      b.addEventListener('dragend',()=>b.classList.remove('is-dragging'));
      b.addEventListener('dragover',e=>{e.preventDefault();e.dataTransfer.dropEffect='move';b.classList.add('drag-over');});
      b.addEventListener('dragleave',()=>b.classList.remove('drag-over'));
      b.addEventListener('drop',e=>{e.preventDefault();b.classList.remove('drag-over');reorderAccounts(e.dataTransfer.getData('text/plain'),a.id);});
      const platform=platformRegistry[a.platform]||platformRegistry.whatsapp;const av=node('span','account-avatar');appendPlatformLogo(av,platform,'account-platform-logo');const instance=node('span','account-instance-number',String(a.instanceNumber||Number.parseInt(a.short,10)||1));instance.title=`${platform.name} 实例 ${instance.textContent}`;av.append(instance);const dot=node('span','online-dot');if(api&&!connectionState[a.id]){dot.style.background='#b6bfcb';dot.title='尚未确认登录';}else dot.title=api?platform.name+' 已连接':'预览在线状态';av.append(dot);const copy=node('span','account-card-copy');copy.append(node('span','account-caption',a.name),node('span','account-platform',platform.name+(connectionState[a.id]?' · 已登录':' · 待登录')),node('span','account-self-name',a.selfName||''),node('span','account-self-phone',a.selfPhone||''));b.append(av,copy);
      const contactUnread=state.contacts.filter(c=>c.account===a.id).reduce((n,c)=>n+c.unread,0);if(contactUnread&&!live)b.append(node('span','unread',contactUnread));
      if(unread&&!isActive)b.append(node('span','account-badge',unread>99?'99+':String(unread)));
      const del=node('button','account-delete-button','×');del.type='button';del.title='删除此账号实例';del.setAttribute('aria-label','删除 '+a.name);del.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();showAccountDeleteDialog(a);});b.append(del);$('accounts').append(b);
    }
    $('account-count').textContent=state.accounts.length+' 个实例';const a=state.accounts.find(a=>a.id===state.selectedAccount);$('account-name').textContent=a?.name||'';$('account-number').textContent=live?`独立本地 ${currentPlatformName()} 会话`:a?.number||'';
  }
  async function switchAccount(id){
    preserveDraft();invalidate();state.selectedAccount=id;clearAccountUnread(id);active=state.contacts.find(c=>c.account===id)||null;state.selectedContact=active?.id||'';liveSnapshot=null;crmCustomer=null;crmCustomerPhone='';crmContactError='';crmContactToken++;livePreview={chat:'',status:'idle',original:'',translation:'',error:'',targetLabel:'英语'};save();renderAll();
    $('composer').value=active?M.scopedDraft(state,id,active.id):'';
    if(live){const account=state.accounts.find(item=>item.id===id);await api.setLive({active:true,account:id,platform:account?.platform||'whatsapp',bounds:liveBounds()});renderTool('translation');api.liveConfig(M.effectiveLiveRules(M.rulesFor(state,null))).catch(()=>{});}
  }
  function listContacts(){
    const q=$('contact-search').value.trim().toLowerCase();return state.contacts.filter(c=>c.account===state.selectedAccount&&(filter==='archive'?c.archived:!c.archived)&&(!q||[c.number,c.country,c.preview,c.internalName,c.note,c.tags].join(' ').toLowerCase().includes(q))&&(filter==='unread'?c.unread>0:filter==='star'?c.star:filter==='group'?c.group:true));
  }
  function renderContacts(){
    $('contact-list').replaceChildren();const rows=listContacts();
    if(!rows.length)$('contact-list').append(node('div','empty-list','没有符合条件的会话'));
    for(const c of rows){
      const row=button('',()=>selectContact(c.id),'contact-item'+(c.id===active?.id?' active':''));row.dataset.contact=c.id;row.setAttribute('role','listitem');row.setAttribute('aria-label',titleFor(c)+' '+c.country);
      row.append(node('span','avatar tone-'+(c.group?'group':['fr','es','de'].includes(c.lang)?c.lang:'en'),c.avatar));const copy=node('div','contact-copy'),top=node('div','flex items-center');
      top.append(node('span','contact-title',titleFor(c)+(c.country?' ('+c.country+')':'')),node('span','contact-time',c.time));const bottom=node('div','contact-bottom');
      bottom.append(node('span','read','✓✓'),node('span','contact-preview',c.preview));if(c.unread)bottom.append(node('span','unread',c.unread));else if(c.star){const star=icon('star');star.className='star-mini';bottom.append(star);}
      copy.append(top,bottom);row.append(copy);$('contact-list').append(row);
    }
    const count=state.contacts.filter(c=>c.account===state.selectedAccount&&c.unread>0).length;document.querySelector('.filter-count').textContent=count;
    document.querySelectorAll('[data-filter]').forEach(e=>{const yes=e.dataset.filter===filter;e.classList.toggle('active',yes);e.setAttribute('aria-selected',String(yes));});icons();
  }
  function renderChat(){
    $('chat-name').textContent=titleFor(active);$('chat-country').textContent=active?.country?'('+active.country+')':'';$('chat-avatar').textContent=active?.avatar||'—';$('header-note').textContent=(live?current()?.internalName:active?.internalName)||'';
    const stream=$('messages');stream.replaceChildren(node('div','day-label','今天 · 示例双语会话'));
    const query=$('message-search').value.toLowerCase();
    for(const m of active?.messages||[]){
      if(query&&![m.foreign,m.chinese].join(' ').toLowerCase().includes(query))continue;
      const row=node('article','message-row'+(m.direction==='out'?' outgoing':''));row.dataset.message=m.id;
      const bubble=node('div','bubble');
      if(m.voice){const audio=node('div','voice-bar');audio.append(button('▶',()=>toast('这是语音消息的界面示例，不包含客户录音。'),'voice-play'));const wave=node('span','waveform');for(const h of [5,10,16,8,20,14,5,13,19,8,15,21,9,15,8,12,18,6,15,10,5,12,18,8]){const bar=node('span');bar.style.height=h+'px';wave.append(bar);}audio.append(wave,node('span','voice-caption',m.duration),icon('mic'));bubble.append(audio);}
      const foreign=node('div','foreign-text',m.foreign);foreign.lang=active?.lang||'en';bubble.append(foreign);
      const line=node('div','translation-line');line.append(node('span','translation-tag',m.direction==='out'?'原文':'译文'),node('span','translation-text',m.chinese));
      const refresh=button('',()=>retranslate(m),'retranslate');refresh.setAttribute('aria-label','重新翻译消息');refresh.title='重新翻译';refresh.append(icon('refresh-cw'));line.append(refresh);bubble.append(line);
      const foot=node('div','bubble-time');foot.append(node('span','',m.time));if(m.direction==='out')foot.append(node('span','read',m.local?'·':'✓✓'));if(m.local)foot.append(node('span','','仅本地'));bubble.append(foot);row.append(bubble);stream.append(row);
    }
    if(!active)stream.append(node('div','empty-list',`本账号尚无示例会话。可新建会话或切换至 ${currentPlatformName()} 模式。`));
    const count=active?.messages?.length||0;$('send-button').disabled=!active||busy;icons();if(count&&!query)requestAnimationFrame(()=>stream.scrollTop=stream.scrollHeight);
  }
  async function retranslate(message){
    if(rules().enabled===false){toast('翻译功能已关闭，请先开启后重试。');return;}
    if(!api){toast('这是预置双语样例。桌面版可使用本地模型重新翻译。');return;}
    const id=active?.id;try{toast('正在调用本地引擎…');const result=await api.translate({text:message.direction==='out'?message.chinese:message.foreign,target:message.direction==='out'?active.lang:'zh-CN'});if(active?.id!==id)return;if(message.direction==='out')message.foreign=result.translation;else message.chinese=result.translation;save();renderChat();toast('已使用 '+result.engine+' 重新翻译。');}catch(e){toast(e.message);}
  }
  function renderRules(){
    const c=current(),r=rules();document.querySelectorAll('[data-scope]').forEach(b=>{const on=b.dataset.scope===scope;b.classList.toggle('active',on);b.setAttribute('aria-selected',String(on));});
    document.querySelectorAll('[data-setting]').forEach(e=>{if(e.type==='checkbox')e.checked=!!r[e.dataset.setting];else e.value=r[e.dataset.setting];if(e.tagName==='SELECT')syncSearchableSelect(e);});
    const translationEnabled=r.enabled!==false;
    $('scope-name').textContent=scope==='global'?'全局默认翻译规则':titleFor(c);$('scope-chip').textContent=scope==='global'?'全部会话':state.rules[c?.id]?'个性化':'语言随会话';
    $('detail-country').textContent=c?.country||'未确定';$('detail-language').textContent=M.languages[c?.lang]||'自动识别';$('target-indicator').textContent=M.languages[r.outgoing]||'法语';$('risk-indicator').textContent=!translationEnabled?'翻译功能已关闭 · 平台原文直接发送':r.translateSend?'任意源语言 · 发送前自动翻译':r.blockChinese?'自动翻译关闭 · 中文原文保护开启':'自动翻译已关闭';
    $('contact-tags').replaceChildren();for(const tag of (c?.tags||'').split(/[,，]/).filter(Boolean))$('contact-tags').append(node('span','contact-tag',tag));
    $('reset-rule').disabled=scope==='global'||!c?.id;icons();
    const autoLabel=document.querySelector('label[for="automatic"]>span');autoLabel.textContent=live?'自动翻译（可见 10 条）':'自动翻译';
    const sendLabel=document.querySelector('label[for="translate-send"]>span');sendLabel.textContent=live?'翻译后自动发送':'翻译后发送';
    $('automatic').disabled=!translationEnabled;$('translate-send').disabled=!translationEnabled;$('translate-history').disabled=!translationEnabled;$('source-language').disabled=live||!translationEnabled;$('block-chinese').disabled=!translationEnabled;$('block-chinese').title='兼容旧设置：仅在关闭自动翻译发送时，阻止中文原文直接发出；不会检查译文。';syncSearchableSelect($('source-language'));
    $('translate-history').title=live?'翻译当前聊天已加载的文字消息；向上滚动加载后继续翻译。不自动滚动或下载全部历史。':'';$('source-language').title=live?'当前由翻译引擎自动检测源语言':'';
    const ruleNote=document.querySelector('.rule-note p');if(ruleNote)ruleNote.textContent=!translationEnabled?'翻译功能已关闭。平台原文可直接发送，重新开启后恢复当前翻译设置。':live?`当前是 ${currentPlatformName()} 实际会话。输入任意语言后将自动识别，并在按 Enter 或点击发送时转换为目标语言后发送。`:'当前为前端交互演示。开关保存到本机，不会控制真实服务或发起外部请求。';
    ensureCrmStatusCard();
  }
  function changeRule(e){
    const input=e.target,key=input.dataset.setting;if(!key)return;
    const c=current();if(scope==='contact'&&!c?.id){toast('请先打开联系人会话。');renderRules();return;}
    const dst=scope==='global'?state.globalRules:(state.rules[c.id]??={});dst[key]=input.type==='checkbox'?input.checked:input.value;if(scope==='global'&&key==='outgoing')dst.useContactLanguage=false;save();invalidate();renderRules();
    if(live)api.liveConfig(M.effectiveLiveRules(M.rulesFor(state,c))).catch(e=>toast(e.message));
  }
  function field(label,value,type='input'){const wrap=node('label','panel-label',label),input=node(type,'panel-input');input.value=value||'';if(type==='textarea')input.rows=5;wrap.append(input);return {wrap,input};}
  function voiceElapsed(){return `${String(Math.floor(voiceState.elapsed/60)).padStart(2,'0')}:${String(voiceState.elapsed%60).padStart(2,'0')}`;}
  function encodeVoiceWav(chunks,frames,sampleRate){
    const bytes=new ArrayBuffer(44+frames*2),view=new DataView(bytes);let offset=0;
    const writeText=value=>{for(let i=0;i<value.length;i++)view.setUint8(offset++,value.charCodeAt(i));};
    writeText('RIFF');view.setUint32(offset,36+frames*2,true);offset+=4;writeText('WAVE');writeText('fmt ');view.setUint32(offset,16,true);offset+=4;view.setUint16(offset,1,true);offset+=2;view.setUint16(offset,1,true);offset+=2;view.setUint32(offset,sampleRate,true);offset+=4;view.setUint32(offset,sampleRate*2,true);offset+=4;view.setUint16(offset,2,true);offset+=2;view.setUint16(offset,16,true);offset+=2;writeText('data');view.setUint32(offset,frames*2,true);offset+=4;
    for(const chunk of chunks)for(let i=0;i<chunk.length;i++){const sample=Math.max(-1,Math.min(1,chunk[i]));view.setInt16(offset,sample<0?sample*32768:sample*32767,true);offset+=2;}
    return new Uint8Array(bytes);
  }
  async function releaseVoiceCapture(){
    clearInterval(voiceState.timer);voiceState.timer=null;
    if(voiceState.processor){voiceState.processor.onaudioprocess=null;try{voiceState.processor.disconnect();}catch{}}
    try{voiceState.source?.disconnect();}catch{}try{voiceState.silentGain?.disconnect();}catch{}
    for(const track of voiceState.stream?.getTracks?.()||[])track.stop();
    if(voiceState.context&&voiceState.context.state!=='closed')try{await voiceState.context.close();}catch{}
    voiceState.stream=null;voiceState.context=null;voiceState.source=null;voiceState.processor=null;voiceState.silentGain=null;
  }
  async function translateVoiceTranscript(){
    const text=voiceState.transcript.trim();if(!text)return;
    if(liveRules().enabled===false){voiceState.phase='error';voiceState.error='翻译功能已关闭，请先开启后重试。';renderTool('voice');toast(voiceState.error);return;}
    voiceState.phase='translating';voiceState.error='';renderTool('voice');
    try{const target=(live?liveRules():M.effectiveLiveRules(M.rulesFor(state,current()))).outgoing;const result=await api.translate({text,target});voiceState.translation=result.translation;voiceState.phase='ready';renderTool('voice');toast(`语音已识别并翻译为${M.languages[target]||'目标语言'}；请确认后填入，尚未发送。`);}
    catch(error){voiceState.phase='error';voiceState.error=error.message||'语音翻译失败。';renderTool('voice');toast(voiceState.error);}
  }
  async function transcribeVoice(wav){
    voiceState.phase='recognizing';voiceState.error='';voiceState.transcript='';voiceState.translation='';renderTool('voice');
    try{const result=await api.transcribeSpeech({audio:wav});voiceState.transcript=result.text;voiceState.language=result.language||'auto';await translateVoiceTranscript();}
    catch(error){voiceState.phase='error';voiceState.error=error.message||'语音识别失败。';renderTool('voice');toast(voiceState.error);}
  }
  async function stopVoiceRecording(){
    if(voiceState.phase!=='recording')return;
    voiceState.elapsed=Math.max(1,Math.round((Date.now()-voiceState.startedAt)/1000));const chunks=voiceState.chunks.slice(),frames=voiceState.frames,sampleRate=voiceState.sampleRate;
    await releaseVoiceCapture();
    if(frames<Math.max(800,sampleRate/4)){voiceState.phase='error';voiceState.error='录音过短，请至少说话 1 秒后再停止。';renderTool('voice');return;}
    const wav=encodeVoiceWav(chunks,frames,sampleRate);voiceState.chunks=[];voiceState.frames=0;await transcribeVoice(wav);
  }
  async function startVoiceRecording(){
    if(!api?.transcribeSpeech)return toast('语音识别仅在 Windows 客户端中可用。');
    if(!navigator.mediaDevices?.getUserMedia)return toast('当前系统无法访问麦克风。');
    if(['recognizing','translating'].includes(voiceState.phase))return;
    try{
      const stream=await navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false});
      const AudioContextClass=window.AudioContext||window.webkitAudioContext,context=new AudioContextClass(),source=context.createMediaStreamSource(stream),processor=context.createScriptProcessor(4096,1,1),silentGain=context.createGain();silentGain.gain.value=0;
      voiceState.stream=stream;voiceState.context=context;voiceState.source=source;voiceState.processor=processor;voiceState.silentGain=silentGain;voiceState.sampleRate=context.sampleRate;voiceState.chunks=[];voiceState.frames=0;voiceState.elapsed=0;voiceState.startedAt=Date.now();voiceState.transcript='';voiceState.translation='';voiceState.language='';voiceState.error='';voiceState.phase='recording';
      processor.onaudioprocess=event=>{if(voiceState.phase!=='recording')return;const input=event.inputBuffer.getChannelData(0),copy=new Float32Array(input.length);copy.set(input);voiceState.chunks.push(copy);voiceState.frames+=copy.length;};source.connect(processor);processor.connect(silentGain);silentGain.connect(context.destination);
      voiceState.timer=setInterval(()=>{voiceState.elapsed=Math.floor((Date.now()-voiceState.startedAt)/1000);const clock=$('voice-record-clock');if(clock)clock.textContent=voiceElapsed();if(voiceState.elapsed>=120)stopVoiceRecording();},250);
      renderTool('voice');
    }catch(error){await releaseVoiceCapture();voiceState.phase='error';voiceState.error=error?.name==='NotAllowedError'?'麦克风权限被拒绝，请在 Windows 隐私设置中允许桌面应用访问麦克风。':`无法启动麦克风：${error.message||error}`;renderTool('voice');toast(voiceState.error);}
  }
  async function toggleVoiceRecording(){if(voiceState.phase==='recording')await stopVoiceRecording();else await startVoiceRecording();}
  function speechModelInstallCard(){
    const tier=speechTierSnapshot in speechModelDownloads?speechTierSnapshot:'advanced',download=speechModelDownloads[tier],tierLabel=speechTierLabels[tier]||'语音识别版';
    const card=node('section','speech-model-install-card'),title=node('div','speech-model-install-title');card.dataset.speechTier=tier;title.append(icon('download'),node('strong','',`超级翻译语音 AI 大模型 · ${tierLabel}`));card.append(title,node('p','panel-help',`当前账号对应模型包：${download.name}`));
    const status=node('div','speech-model-install-status',speechInstallSnapshot.message||'模型包准备就绪后可一键安装到 D 盘');status.id='speech-model-install-status';status.dataset.stage=speechInstallSnapshot.stage;card.append(status);
    const install=button('一键导入 / 注入语音 AI 模型',async()=>{try{install.disabled=true;status.textContent='请选择下载好的语音模型…';const result=await api.installSpeechModel();if(result?.cancelled){status.textContent='已取消导入';return;}status.textContent=result?.alreadyInstalled?'语音模型已经安装并启用':'语音模型安装完成';toast(status.textContent+'。');const model=await api.speechStatus();const modelStatus=$('voice-model-status');if(modelStatus){modelStatus.textContent=model.ok?'✓ 语音模型已就绪':`✓ 已安装到 ${model.root}`;modelStatus.classList.add('ready');modelStatus.classList.toggle('online',!!model.ok);}}catch(error){status.textContent=error.message||'语音模型导入失败';status.dataset.stage='error';toast(status.textContent);}finally{install.disabled=false;}},'primary-button speech-model-install-button');install.id='speech-model-install-button';install.prepend(icon('upload'));card.append(install);
    const downloads=node('div','speech-model-download-actions'),baidu=button(download.baidu?`百度网盘下载${download.baiduCode?' · '+download.baiduCode:''}`:'百度网盘 · 等待发布',()=>openSpeechModelDownload(download.baidu),'secondary-button'),feiji=button(download.feiji?'小飞机网盘下载':'小飞机网盘 · 等待发布',()=>openSpeechModelDownload(download.feiji),'secondary-button');baidu.id='speech-model-download-baidu';feiji.id='speech-model-download-feiji';baidu.disabled=!download.baidu;feiji.disabled=!download.feiji;downloads.append(baidu,feiji);card.append(downloads);return card;
  }
  function renderVoicePanel(panel){
    const statusMap={idle:'准备录音',recording:'正在录音',recognizing:'正在本地识别…',translating:'正在翻译并核验额度…',ready:'已完成，等待确认',error:'处理失败'};
    const card=node('section','voice-translation-card'),head=node('div','voice-translation-head');head.append(node('strong','','语音转文字翻译'),node('span','voice-phase '+voiceState.phase,statusMap[voiceState.phase]||'准备录音'));card.append(head,node('p','panel-help','新收到的客户语音会自动在本机转成文字并翻译；历史语音仍可手动处理。任何语音译文都不会自动填入、回复或发送。'));
    const modelStatus=node('div','voice-model-status','正在检查 D 盘语音模型…');modelStatus.id='voice-model-status';card.append(modelStatus);
    const record=button(voiceState.phase==='recording'?'停止并识别':'开始录音',toggleVoiceRecording,'voice-record-button '+(voiceState.phase==='recording'?'recording':''));record.disabled=['recognizing','translating'].includes(voiceState.phase);record.prepend(icon(voiceState.phase==='recording'?'square':'mic'));const clock=node('span','voice-record-clock',voiceElapsed());clock.id='voice-record-clock';record.append(clock);card.append(record);
    if(voiceState.error)card.append(node('div','warning-box voice-error',voiceState.error));
    const transcript=field('识别原文',voiceState.transcript,'textarea');transcript.input.placeholder='录音完成后在此显示识别文字';transcript.input.disabled=['recording','recognizing'].includes(voiceState.phase);transcript.input.addEventListener('input',()=>{voiceState.transcript=transcript.input.value.slice(0,12000);voiceState.translation='';voiceState.phase=voiceState.transcript?'idle':'idle';});
    const translated=field('翻译预览（不会自动发送）',voiceState.translation,'textarea');translated.input.readOnly=true;translated.input.placeholder='识别成功后自动按“输入内容翻译为”设置生成译文';card.append(transcript.wrap,translated.wrap);
    const actions=node('div','voice-actions'),retranslate=button('重新翻译',async()=>{voiceState.transcript=transcript.input.value.trim();if(!voiceState.transcript)return toast('请先录音或输入识别原文。');await translateVoiceTranscript();},'secondary-button'),fillButton=button(live?'填入当前聊天框':'填入本地演示输入框',async()=>{try{const text=voiceState.translation.trim();if(!text)throw new Error('请先完成语音识别和翻译。');if(live){if(!liveSnapshot?.key)throw new Error(`请先在 ${currentPlatformName()} 中打开联系人聊天。`);await api.fill({chat:liveSnapshot.key,text});toast(`译文已填入 ${currentPlatformName()}，请核对后手动发送。`);}else{$('composer').value=text;$('composer').dispatchEvent(new Event('input'));$('composer').focus();toast('译文已填入本地演示输入框。');}}catch(error){toast(error.message);}},'primary-button');retranslate.disabled=!voiceState.transcript||['recording','recognizing','translating'].includes(voiceState.phase);fillButton.disabled=!voiceState.translation||['recording','recognizing','translating'].includes(voiceState.phase);actions.append(retranslate,fillButton);card.append(actions);panel.append(card,speechModelInstallCard());
    const token=++voicePanelToken;if(api?.speechStatus)api.speechStatus().then(status=>{if(token!==voicePanelToken||tool!=='voice'||!modelStatus.isConnected)return;const tier=status.entitlement in speechModelDownloads?status.entitlement:'advanced';if(tier!==speechTierSnapshot){speechTierSnapshot=tier;renderTool('voice');return;}const selected=status.speechTiers?.[tier],installed=selected?.installed===true;modelStatus.textContent=installed?`✓ ${speechTierLabels[tier]||'语音识别'}已安装 · 首次使用时自动启动`:`当前账号为${speechTierLabels[tier]||'语音识别'}，本机尚未安装对应模型。`;modelStatus.classList.toggle('ready',installed);modelStatus.classList.toggle('online',installed&&(status.ok||status.models?.includes(selected?.model)));}).catch(error=>{if(token===voicePanelToken&&modelStatus.isConnected)modelStatus.textContent=error.message||'无法检查语音模型。';});icons();
  }
  function renderOpenchat(panel){
    panel.replaceChildren();panel.append(node('p','panel-help','只有访客真的给客服号发出第一条消息才回传转化；先在广告平台创建像素并拿到令牌。'));
    const body=node('div','');panel.append(body);
    const draw=data=>{
      body.replaceChildren();
      const cfg=data?.config||{},stats=data?.stats||{},events=Array.isArray(data?.events)?data.events:[],pixels=Array.isArray(data?.pixels)?data.pixels:[];
      const metrics=node('div','');metrics.style.cssText='display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:10px;';
      for(const [label,value] of [['今日开口',stats.opens||0],['已回传',stats.reported||0],['待处理',stats.pending||0],['点击',stats.clicks||0]]){const c=node('div','');c.style.cssText='border:1px solid #e2e8f0;border-radius:8px;padding:8px;';c.append(node('div','scrm-sub',label),node('div','',String(value)));metrics.append(c);}
      body.append(metrics);
      const status=node('p','panel-help','连接状态：'+(cfg.status||'disconnected')+' · '+(cfg.enabled?'已启用':'未启用'));body.append(status);
      if(data?.pair?.status==='pending'&&cfg.status==='pending'){const pairBox=node('div','');pairBox.style.cssText='border:1px solid #fde68a;background:#fffbeb;border-radius:8px;padding:8px;margin:6px 0;';pairBox.append(node('div','','等待 SCRM 同意，配对码：'+String(data.pair.code||'')));const actions=node('div','');actions.style.cssText='display:flex;gap:6px;margin-top:6px;';actions.append(button('同意连接',()=>scrmApi('/openchat/pair/approve',{method:'POST',body:JSON.stringify({code:data.pair.code,approve:true})}).then(()=>{renderOpenchat(panel);toast('已同意连接。');}).catch(error=>toast(error.message)),'secondary-button'),button('拒绝',()=>scrmApi('/openchat/pair/approve',{method:'POST',body:JSON.stringify({code:data.pair.code,approve:false})}).then(()=>{renderOpenchat(panel);toast('已拒绝连接。');}).catch(error=>toast(error.message)),'secondary-button'));pairBox.append(actions);body.append(pairBox);}
      const enable=node('label','switch-row');const sw=node('span','toggle'),cb=node('input');cb.type='checkbox';cb.checked=!!cfg.enabled;sw.append(cb,node('span','toggle-track'));enable.append(node('span','','启用开口回传'),sw);body.append(enable);
      const mode=field('匹配方式','click');mode.input.replaceWith(mode.select=node('select',''));mode.select.innerHTML='<option value="click">点击指纹</option><option value="window">号码独占时间窗</option>';mode.select.value=cfg.identify_mode||'click';mode.wrap.append(mode.select);body.append(mode.wrap);
      const event=field('回传事件','Lead');event.input.replaceWith(event.select=node('select',''));event.select.innerHTML='<option>Lead</option><option>Contact</option><option>CompleteRegistration</option><option>SubmitForm</option>';event.select.value=cfg.event||'Lead';event.wrap.append(event.select);body.append(event.wrap);
      const win=field('匹配时间窗（分钟）','30');win.input.type='number';win.input.value=String(cfg.window_min||30);body.append(win.wrap);
      const platformText=field('参与平台','WhatsApp,Telegram');platformText.input.value=cfg.platforms||'WhatsApp,Telegram';body.append(platformText.wrap);
      const publicBase=field('公开访问地址','https://你的域名');publicBase.input.value=cfg.public_base||'';publicBase.input.placeholder='例如 https://scrm.example.com';body.append(publicBase.wrap);
      const dedupe=node('label','switch-row'),dcb=node('input');dcb.type='checkbox';dcb.checked=cfg.dedupe!==0;dedupe.append(node('span','','同一访客只回传一次'),dcb);body.append(dedupe);
      const hashPhone=node('label','switch-row'),hcb=node('input');hcb.type='checkbox';hcb.checked=cfg.hash_phone!==0;hashPhone.append(node('span','','附带手机号哈希'),hcb);body.append(hashPhone);
      const save=button('保存设置',()=>{scrmApi('/openchat/config',{method:'POST',body:JSON.stringify({enabled:cb.checked,identify_mode:mode.select.value,event:event.select.value,window_min:Number(win.input.value)||30,platforms:platformText.input.value.trim()||'WhatsApp,Telegram',dedupe:dcb.checked,hash_phone:hcb.checked,public_base:publicBase.input.value.trim()})}).then(()=>{renderOpenchat(panel);toast('开口回传设置已保存。');}).catch(error=>toast(error.message));},'primary-button');save.style.width='100%';body.append(save);
      body.append(button('模拟一次广告点击',()=>scrmApi('/openchat/click',{method:'POST',body:JSON.stringify({platform:'WhatsApp',staff:String(liveSnapshot?.title||'test'),identify:'manual-'+Date.now(),ad:'manual-test'})}).then(()=>toast('测试点击已写入，30 分钟内上报开口可匹配。')).catch(error=>toast(error.message)),'secondary-button'));
      const pxHead=node('h4','','回传像素');body.append(pxHead);
      const plat=node('select','');plat.innerHTML='<option>Facebook</option><option>TikTok</option>';const pid=node('input','');pid.placeholder='像素 ID';const token=node('input','');token.placeholder='访问令牌 Access Token';const testCode=node('input','');testCode.placeholder='测试事件码（可选）';
      for(const el of [plat,pid,token,testCode]){el.style.cssText='width:100%;box-sizing:border-box;margin:3px 0;padding:6px;border:1px solid #cbd5e1;border-radius:6px;';body.append(el);}
      body.append(button('添加像素',()=>{scrmApi('/openchat/pixels',{method:'POST',body:JSON.stringify({platform:plat.value,pixel_id:pid.value.trim(),token:token.value.trim(),test_event_code:testCode.value.trim()})}).then(()=>{renderOpenchat(panel);toast('像素已添加。');}).catch(error=>toast(error.message));},'secondary-button'));
      pixels.forEach(p=>{const row=node('div','');row.style.cssText='border:1px solid #e2e8f0;border-radius:8px;padding:8px;margin:6px 0;';row.append(node('div','',p.platform+' · '+p.pixel_id),node('div','scrm-sub','状态：'+(p.status||'unverified')+(p.last_error?' · '+p.last_error:'')));
        const actions=node('div','');actions.style.cssText='display:flex;gap:6px;margin-top:5px;';
        actions.append(button('验证令牌',()=>scrmApi(`/openchat/pixels/${p.id}/verify`,{method:'POST'}).then(r=>toast(r.ok?'令牌有效':(r.detail||'令牌无效'))).catch(e=>toast(e.message)),'secondary-button'));
        actions.append(button('发送测试',()=>scrmApi(`/openchat/pixels/${p.id}/test`,{method:'POST'}).then(r=>toast(r.ok?'测试事件已发送':(r.error||'发送失败'))).catch(e=>toast(e.message)),'secondary-button'));
        actions.append(button('删除',()=>scrmApi(`/openchat/pixels/${p.id}`,{method:'DELETE'}).then(()=>renderOpenchat(panel)).catch(e=>toast(e.message)),'secondary-button'));row.append(actions);body.append(row);});
      const connect=field('SCRM 共享码','chm_...');connect.input.value=cfg.share_code||'';body.append(connect.wrap,button(cfg.status==='connected'?'重新连接':'连接 SCRM',()=>scrmApi('/openchat/connect',{method:'POST',body:JSON.stringify({code:connect.input.value.trim()})}).then(r=>{renderOpenchat(panel);toast(r.status==='pending'?'已发送配对请求，等待 SCRM 同意。':'SCRM 已连接。');}).catch(error=>toast(error.message)),'secondary-button'));
      body.append(node('h4','','广告点击链接'));
      const target=field('客服号 / 手机号','例如 +8613800000000 或 @username');const staff=field('客服名称','客服 1');staff.input.value=String(liveSnapshot?.title||'客服 1');const greet=field('预填招呼语','Hi');greet.input.value='Hi';const linkPlatform=node('select','');linkPlatform.innerHTML='<option>WhatsApp</option><option>Telegram</option>';body.append(linkPlatform,target.wrap,staff.wrap,greet.wrap);
      const linkResult=node('div','panel-help','');body.append(linkResult,button('生成点击链接',()=>{scrmApi('/openchat/links',{method:'POST',body:JSON.stringify({platform:linkPlatform.value,target:target.input.value.trim(),staff:staff.input.value.trim(),greeting:greet.input.value.trim()||'Hi'})}).then(r=>{const url=r.url||('http://127.0.0.1:18801'+r.path);linkResult.textContent='点击链接：'+url;linkResult.title=url;}).catch(error=>toast(error.message));},'secondary-button'));
      const links=Array.isArray(data?.links)?data.links:[];
      links.slice(0,10).forEach(link=>body.append(node('div','scrm-sub',`${link.platform} · ${link.staff||'未命名'} · /oc/l/${link.token}`)));
      body.append(node('h4','','开口记录'),button('刷新记录',()=>renderOpenchat(panel),'secondary-button'));
      if(!events.length)body.append(node('p','panel-help','暂无开口记录。'));
      const statusText={reported:'已回传',unmatched:'未匹配',no_pixel:'无像素',failed:'回传失败',pending:'待回传',duplicate:'重复开口'};
      events.slice(0,20).forEach(ev=>{const row=node('div','');row.style.cssText='border-bottom:1px solid #f1f5f9;padding:6px 0;';row.append(node('div','',`${ev.platform||''} · ${statusText[ev.status]||ev.status||''} · ${ev.event||''}`),node('div','scrm-sub',`${ev.created_at||''}${ev.identify?' · '+String(ev.identify).slice(0,40):''}${ev.error?' · '+String(ev.error).slice(0,120):''}`));body.append(row);});
    };
    scrmEnsureSession().then(()=>Promise.all([scrmApi('/openchat'),scrmApi('/openchat/pair')])).then(([data,pair])=>draw({...data,pair:pair?.pair||null})).catch(error=>body.append(node('p','panel-help',String(error?.message||error))));
  }
  function renderQuickPanel(panel){
    panel.replaceChildren();
    panel.append(node('p','panel-help',live?`点击话术会填入当前 ${currentPlatformName()} 原生输入框，并自动生成实时译文预览；不会立即发送。`:'点击话术只填入中文草稿。生成译文并确认后才进入发送步骤。'));
    const use=(text)=>{if(live){try{const chat=liveSnapshot?.key;if(!chat)throw new Error(`请先在 ${currentPlatformName()} 中打开聊天。`);api.fill({chat,text}).then(()=>{renderTool('translation');toast(`已填入 ${currentPlatformName()} 草稿，正在自动翻译；尚未发送。`);}).catch(error=>toast(error.message));}catch(error){toast(error.message);}}else{$('composer').value=text;$('composer').dispatchEvent(new Event('input'));$('composer').focus();toast('已填入中文草稿，尚未发送。');}};
    const paint=()=>{
      const list=$('quick-list');if(!list)return;list.replaceChildren();
      (quickCache||[]).forEach((item,index)=>{const text=String(item.content||item.title||'');if(!text)return;const b=button('',()=>use(text),'quick-item');b.append(node('span','',text),node('small','',String(item.title||('话术 '+String(index+1).padStart(2,'0')))+' · 点击使用'));list.append(b);});
      if(!quickCache?.length)list.append(node('p','panel-help','暂无快捷回复，下面添加一条。'));
    };
    const list=node('div','');list.id='quick-list';panel.append(list);
    if(quickCache===null){
      list.append(node('p','panel-help','读取 SCRM 快捷回复…'));
      scrmEnsureSession().then(()=>scrmApi('/api/client/entities/quick?limit=100')).then(data=>{quickCache=Array.isArray(data?.rows)?data.rows:[];paint();}).catch(()=>{quickCache=(state.quick||[]).map((text,index)=>({title:'本地话术 '+(index+1),content:text}));paint();});
    }else paint();
    const f=field('新增快捷回复','','textarea');f.input.placeholder='例如：您好，请稍等，我现在帮您查看。';
    const save=button('保存快捷回复',()=>{const text=f.input.value.trim();if(!text)return toast('请输入快捷回复内容。');scrmEnsureSession().then(()=>scrmApi('/api/client/entities/quick',{method:'POST',body:JSON.stringify({title:text.slice(0,30),content:text})})).then(()=>{quickCache=null;renderQuickPanel(panel);toast('快捷回复已保存到 SCRM。');}).catch(()=>{state.quick.push(text.slice(0,1000));save();quickCache=(state.quick||[]).map((text,index)=>({title:'本地话术 '+(index+1),content:text}));paint();toast('SCRM 不可用，已保存到本机。');});},'primary-button mt-2 w-full');
    panel.append(f.wrap,save);icons();
  }
  function renderTool(which){
    if(tool==='voice'&&which!=='voice'&&voiceState.phase==='recording'){releaseVoiceCapture();voiceState.phase='idle';voiceState.error='录音已取消。';voiceState.chunks=[];voiceState.frames=0;}
    tool=which;$('translation-panel').hidden=which!=='translation';$('tool-panel').hidden=which==='translation';
    const titles={translation:'翻译设置',quick:'快捷回复',notes:'粉丝备注',fans:'粉丝统计','client-ops':'客户运营','ai-replies':'AI 智能回复',keywords:'关键词回复',broadcast:'群发消息','customer-profile':'客户画像','customer-list':'联系人',memo:'备忘录',risk:'风控检测',openchat:'开口回传',fingerprint:'指纹环境',refresh:'刷新同步',proxy:'网络设置',settings:'模型设置','user-center':'用户中心'};
    $('drawer-title').textContent=titles[which]||'工具';document.querySelectorAll('.tool-button').forEach(b=>b.classList.toggle('active',b.dataset.tool===which));
    const panel=$('tool-panel');delete panel.dataset.crmPanel;panel.replaceChildren();panel.scrollTop=0;$('user-center-button')?.classList.toggle('active',which==='user-center');if(which==='translation'){renderRules();renderLiveReply();return;}if(which==='openchat'){renderOpenchat(panel);return;}if(which==='client-ops'){renderClientOps(panel);return;}if(which==='ai-replies'||which==='keywords'){renderAiReplies(panel,which);return;}if(which==='broadcast'){clientOpsTab='broadcast';renderClientOps(panel);return;}if(['customer-profile','customer-list','memo','risk'].includes(which)){renderCustomerTool(panel,which);return;}if(which==='fingerprint'){renderFingerprint(panel);return;}if(which==='refresh'){renderRefresh(panel);return;}if(which==='user-center'){renderUserCenter(panel);return;}
    const c=current();
    if(which==='notes'){
      panel.append(node('p','panel-help',titleFor(c)));
      const name=field('内部名称',c?.internalName),note=field('内部备注',c?.note,'textarea'),tags=field('客户标签（逗号分隔）',c?.tags),phone=field('国际电话号码（可手动校正）',c?.phone||(live?'':c?.number));
      for(const f of [name,phone,tags,note])panel.append(f.wrap);const countryResult=node('p','panel-help',c?.country?'号码归属：'+c.country:`尚未获取完整号码；可点击识别，或打开 ${currentPlatformName()} 联系人资料后再试。`);countryResult.id='phone-result';panel.append(countryResult);const crmMount=node('section','crm-inline-status');crmMount.dataset.crmContactStatus='';panel.append(crmMount);renderCrmStatusControl(crmMount);
      const restore=button('恢复原联系人名称',()=>{name.input.value='';if(!c?.id||live&&liveSnapshot?.key!==c.id)return;if(live){const profile=state.liveProfiles[c.id]??={};profile.internalName='';}else active.internalName='';save();syncAnnotation();countryResult.textContent='已恢复原名称，其他备注和国家标记保留。';},'secondary-button mt-2 w-full');panel.append(restore);
      panel.append(button('保存内部备注',async()=>{
        if(!c?.id){toast('尚未识别唯一会话标识，不能保存联系人备注。');return;}
        if(live&&liveSnapshot?.key!==c.id){countryResult.textContent='聊天已变化，请在当前联系人重新保存。';return;}
        const data={internalName:name.input.value.slice(0,100),note:note.input.value.slice(0,5000),tags:tags.input.value.slice(0,250),phone:phone.input.value.slice(0,30),phoneSource:'manual',status:c?.status||'',title:liveSnapshot?.title||c?.title||''};
        if(live)state.liveProfiles[c.id]={...state.liveProfiles[c.id],...data};else Object.assign(active,data);
        save();syncAnnotation();panel.querySelector('.panel-help').textContent=data.internalName||titleFor(c);countryResult.textContent='✓ 已保存内部备注：'+(data.internalName||'未设置内部名称')+' · '+(data.note||'备注为空')+'（仅本机）';if(!live){renderContacts();$('header-note').textContent=data.internalName;}else{$('header-note').textContent=data.internalName||'';if(data.phone)ensureLiveCrmCustomer().catch(e=>toast(e.message));}toast('已保存到本机，不修改联系人名称。');
      },'primary-button mt-3 w-full'));
      if(api)panel.append(button('识别号码国家',async()=>{const key=c?.id;countryResult.textContent='正在读取当前联系人号码…';try{if(!key)throw new Error('请先打开一个私人聊天；群组不推断单一国家。');let number=phone.input.value.trim();if(!number&&live){const found=await api.identifyPhone();number=found.phone||'';}if(live&&key!==liveSnapshot?.key)throw new Error('会话已变化，请在当前联系人重新识别。');if(!number)throw new Error(`${currentPlatformName()} 未提供可读取的完整号码。请打开联系人资料，或在上方输入带 + 区号的号码。`);const info=await api.phone(number);if(!info.country)throw new Error(info.label);phone.input.value=info.number;const update={phone:info.number,country:info.label,countryCode:info.country,phoneSource:'manual'};if(live)state.liveProfiles[key]={...state.liveProfiles[key],...update};else Object.assign(active,update);save();syncAnnotation();countryResult.textContent='已保存内部国家备注：'+info.label+' · '+info.number+'（号码归属）';$('detail-country').textContent=info.label;if(live)await ensureLiveCrmCustomer();toast('已识别并保存国家备注：'+info.label+'；不修改联系人原名。');}catch(e){countryResult.textContent=e.message;toast(e.message);}},'secondary-button mt-2 w-full'));
      panel.append(node('p','panel-help','联系人切换时按独立会话保存；不更改联系人原名，不自动上传备注。'));
    }else if(which==='quick'){
      renderQuickPanel(panel);
    }else if(which==='fans'){
      renderFansPanel(panel);
    }else if(which==='proxy'||which==='settings'){
      renderSettings(panel);
    }
    icons();
  }
  function modelDownloadBox(){
    const box=node('section','model-download-box mt-4');
    box.append(node('div','panel-label','本地 AI 模型'));
    box.append(node('p','panel-help','客户可任选一个网盘下载“超级翻译-AI模型-Q4_K_M.zip”（约 1.1 GB）。下载后点击下方“一键导入 / 注入模型”，软件会自动解压、识别并保存 GGUF 路径；无需另装 Python。'));
    const baidu=button('百度网盘 · 点击打开',()=>openModelDownload('https://pan.baidu.com/s/1KnVpv5NAj1FGM82_7v8_OA'),'secondary-button mt-2 w-full');
    baidu.title='打开百度网盘模型分享';
    const feiji=button('小飞机网盘 · 点击打开',()=>openModelDownload('https://share.feijipan.com/s/il9E8Hew'),'secondary-button mt-2 w-full');
    feiji.title='打开小飞机网盘模型分享';
    box.append(baidu,feiji);return box;
  }
  function subaccountQuotaLabel(value){return value?.unlimited?'不限量':`${Number(value?.quota||0).toLocaleString()} 字剩余 · 已用 ${Number(value?.used||0).toLocaleString()}`;}
  async function renderCustomerSubaccounts(panel){
    if(!api?.customerTeam||!panel?.isConnected)return;
    let authStatus;try{authStatus=await api.authStatus();}catch{return;}
    const operator=authStatus?.user;if(operator?.accountType!=='customer'||operator.parentId||operator.canManageSubaccounts!==true)return;
    const box=node('section','subaccount-manager mt-4');box.id='subaccount-manager';
    const head=node('div','subaccount-manager-head'),title=node('div');title.append(node('div','panel-label','账号与子账号'),node('p','panel-help','主账号可创建最多 3 个子账号，并从自己的云端额度中分配共享翻译字符。'));const create=button('＋ 创建子账号',()=>openCustomerSubaccountDialog(box),'secondary-button');create.classList.add('subaccount-create');head.append(title,create);box.append(head);
    const summary=node('div','subaccount-manager-summary','正在读取主账号额度与子账号列表…');box.append(summary);const list=node('div','subaccount-list');box.append(list);panel.append(box);
    async function load(){
      if(!box.isConnected)return;try{const data=await api.customerTeam({method:'GET'});if(!box.isConnected)return;const children=data.subaccounts||[];summary.textContent=`主账号剩余：${subaccountQuotaLabel(data.parent)} · 子账号：${children.length} / ${Number(data.limit)||3}`;create.disabled=children.length>=Number(data.limit||3);create.title=create.disabled?'已达到 3 个子账号上限':'';list.replaceChildren();if(!children.length){list.append(node('p','subaccount-empty','还没有子账号。点击“创建子账号”开始分配额度。'));return;}for(const child of children){const row=node('div','subaccount-row'),identity=node('div','subaccount-identity');identity.append(node('strong','',child.username),node('small','',child.status==='active'?'已启用':'已停用'));const quota=node('div','subaccount-quota',subaccountQuotaLabel(child));const actions=node('div','subaccount-actions');actions.append(button('设置额度',async()=>{const value=prompt(`设置 ${child.username} 的剩余翻译字符额度`,String(child.quota||0));if(value===null)return;const amount=Number(value);if(!Number.isSafeInteger(amount)||amount<0)return toast('请输入非负整数。');try{await api.customerTeam({method:'PATCH',id:child.id,body:{quota:amount}});await load();toast('子账号额度已更新。');}catch(error){toast(error.message);}},'secondary-button'),button('增加额度',async()=>{const value=prompt(`给 ${child.username} 增加翻译字符额度`,'100000');if(value===null)return;const amount=Number(value);if(!Number.isSafeInteger(amount)||amount<1)return toast('请输入正整数。');try{await api.customerTeam({method:'PATCH',id:child.id,body:{addQuota:amount}});await load();toast('子账号额度已增加。');}catch(error){toast(error.message);}},'secondary-button'),button(child.status==='active'?'停用':'启用',async()=>{try{await api.customerTeam({method:'PATCH',id:child.id,body:{status:child.status==='active'?'disabled':'active'}});await load();toast(child.status==='active'?'子账号已停用。':'子账号已启用。');}catch(error){toast(error.message);}},'secondary-button'),button('删除',async()=>{if(!confirm(`确定删除子账号 ${child.username} 吗？删除后将立即无法登录。`))return;try{await api.customerTeam({method:'DELETE',id:child.id});await load();toast('子账号已删除。');}catch(error){toast(error.message);}},'secondary-button danger-button'));row.append(identity,quota,actions);list.append(row);}}catch(error){summary.textContent=error.message||'子账号服务暂时不可用。';create.disabled=true;list.replaceChildren();}}
    async function openCustomerSubaccountDialog(){
      if(create.disabled)return;const username=field('子账号用户名',''),password=field('初始密码',''),quota=field('分配翻译字符额度','500000');password.input.type='password';quota.input.type='number';quota.input.min='0';quota.input.max='1000000000';quota.input.step='1';const form=node('div');form.append(username.wrap,password.wrap,quota.wrap);showDialog('创建子账号',form,[button('创建并分配额度',async()=>{const name=username.input.value.trim(),pass=password.input.value,amount=Number(quota.input.value);if(!/^[A-Za-z0-9_]{3,40}$/.test(name)||pass.length<8||pass.length>128)return toast('用户名需为 3–40 位，密码需为 8–128 位。');if(!Number.isSafeInteger(amount)||amount<0)return toast('请输入正确的翻译字符额度。');try{await api.customerTeam({method:'POST',body:{username:name,password:pass,quota:amount}});$('dialog').close();await load();toast('子账号已创建，额度已从主账号可用额度中分配。');}catch(error){toast(error.message);}},'primary-button')]);
    }
    await load();
  }
  function formatUsageNumber(value){return Number(value||0).toLocaleString('zh-CN');}
  function formatExpiry(value){
    const raw=String(value||'').trim();
    if(!raw)return '未设置';
    if(raw==='2099-12-31')return '长期有效';
    const match=/^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
    return match?`${match[1]}年${match[2]}月${match[3]}日`:raw;
  }
  async function renderUserCenter(panel){
    panel.replaceChildren(node('p','panel-help','正在读取账号套餐、额度和每日消耗…'));
    let status=null,usage=null;
    try{status=await api?.authStatus?.();}catch(error){
      if(tool!=='user-center'||!panel.isConnected)return;
      panel.replaceChildren(node('div','warning-box',error?.message||'暂时无法读取账号信息，请稍后重试。'));
      icons();return;
    }
    try{usage=api?.customerUsage?await api.customerUsage():null;}catch{}
    if(tool!=='user-center'||!panel.isConnected)return;
    const user=(usage?.username?usage:status?.user)||{};
    const card=node('section','user-center-card'),head=node('div','user-center-head');
    const identity=node('div','user-center-identity');identity.append(node('strong','',String(user.username||'当前账号')),node('small','',String(user.role||((user.accountType==='admin')?'管理员':'客户'))));
    const refresh=button('刷新',()=>renderUserCenter(panel),'secondary-button user-center-refresh');refresh.title='重新读取云端账号信息';head.append(identity,refresh);card.append(head);
    const metrics=node('div','user-center-metrics');
    const remaining=user.unlimited?'不限量':(user.quota===null||user.quota===undefined?'待分配':`${formatUsageNumber(user.quota)} 字`);
    const totalUsed=formatUsageNumber(user.used);
    const rows=[['当前套餐',user.plan||'待分配'],['剩余额度',remaining],['累计已用',`${totalUsed} 字`],['到期时间',formatExpiry(user.expires)]];
    for(const [label,value] of rows){const item=node('div','user-center-metric');item.append(node('span','',label),node('strong','',String(value)));metrics.append(item);}card.append(metrics);
    const scope=node('p','user-center-scope',user.parentId?'当前为子账号，额度由主账号分配。':user.canManageSubaccounts===true?'当前为主账号，可在此创建和管理子账号。':'账号信息由云端统一管理。');card.append(scope);panel.append(card);
    const daily=node('section','user-center-daily');daily.append(node('div','user-center-section-title','每日字符消耗（最近 7 天）'));
    const series=Array.isArray(usage?.dailyUsage)?usage.dailyUsage.filter(item=>/^\d{4}-\d{2}-\d{2}$/.test(String(item?.date||''))):[];
    if(!series.length){daily.append(node('p','panel-help','云端暂未提供每日明细；累计已用仍以云端账号数据为准。'));}
    else{
      const max=Math.max(1,...series.map(item=>Math.max(0,Number(item.characters)||0))),chart=node('div','user-center-chart');
      for(const item of series){const value=Math.max(0,Number(item.characters)||0),bar=node('div','user-center-day');bar.title=`${item.date}：${formatUsageNumber(value)} 字`;const track=node('div','user-center-bar-track'),fill=node('i','user-center-bar-fill');fill.style.height=`${Math.max(value?6:2,Math.round(value/max*100))}%`;track.append(fill);bar.append(track,node('strong','',formatUsageNumber(value)),node('span','',item.date.slice(5)));chart.append(bar);}daily.append(chart);
    }
    panel.append(daily);
    if(user.accountType==='customer'&&!user.parentId&&user.canManageSubaccounts===true)await renderCustomerSubaccounts(panel);
    icons();
  }
  async function renderProxySettings(panel){
    const account=state.accounts.find(item=>item.id===state.selectedAccount);
    if(!account){panel.append(node('div','warning-box','请先选择一个账号实例。'));return;}
    if(!api?.proxySettings){panel.append(node('div','warning-box','当前版本尚未加载账号级代理模块，请重启最新版桌面端。'));return;}
    try{
      const cfg=await api.proxySettings(account.id);if(tool!=='proxy')return;
      const card=node('section','proxy-settings-card');
      card.append(node('p','panel-help',`为“${account.name}”设置独立网络出口。配置只作用于该账号的 WhatsApp 会话，不会覆盖其他账号。`));
      const protocol=node('select','panel-input');for(const [value,label] of [['http','HTTP'],['https','HTTPS'],['socks5','SOCKS5']]){const option=node('option','',label);option.value=value;protocol.append(option);}protocol.value=cfg.protocol||'http';
      const host=field('代理主机',cfg.host);host.input.placeholder='例如 127.0.0.1 或 proxy.example.com';host.input.autocomplete='off';
      const port=field('端口',cfg.port);port.input.type='number';port.input.min='1';port.input.max='65535';port.input.step='1';port.input.inputMode='numeric';port.input.placeholder='例如 8080';
      const username=field('用户名（可选）','');username.input.placeholder=cfg.hasUsername?'已保存用户名（留空保持不变）':'请输入用户名';username.input.autocomplete='off';
      const password=field('密码（可选）','');password.input.type='password';password.input.placeholder=cfg.hasPassword?'已保存密码（留空保持不变）':'请输入密码';password.input.autocomplete='new-password';
      const note=field('备注（可选）',cfg.note);note.input.placeholder='例如：欧洲客服出口';
      const enabled=node('input');enabled.type='checkbox';enabled.checked=cfg.enabled===true;const toggle=node('label','proxy-toggle-row');toggle.append(node('span','', '开启代理（切换后对该账号的新请求生效）'),enabled);card.append(node('label','panel-label','代理协议'),protocol,host.wrap,port.wrap,username.wrap,password.wrap,note.wrap,toggle);
      const local=node('p','proxy-local-ip',`本机 IP：${cfg.localIp||'未检测到'}`);const route=node('p','proxy-route-status',cfg.enabled?'已保存代理配置，尚未测试。':'当前为直连模式。');card.append(local,route);
      const clearWrap=node('label','proxy-clear-credentials');const clear=node('input');clear.type='checkbox';clearWrap.append(clear,node('span','', '清除已保存的代理用户名和密码'));card.append(clearWrap);
      const actions=node('div','proxy-actions');const test=button('测试代理',async()=>{try{test.disabled=true;route.textContent='正在测试代理路由…';const result=await api.testProxy({id:account.id,protocol:protocol.value,host:host.input.value,port:Number(port.input.value),enabled:enabled.checked,note:note.input.value});local.textContent=`本机 IP：${result.localIp||'未检测到'}`;route.textContent=`代理路由已响应：${result.route||'已应用'}；未修改保存配置。`;toast('代理连接测试完成。');}catch(error){route.textContent=error.message||'代理测试失败。';toast(route.textContent);}finally{test.disabled=false;}},'secondary-button');
      const saveProxy=button('保存代理设置',async()=>{try{saveProxy.disabled=true;const result=await api.saveProxySettings({id:account.id,protocol:protocol.value,host:host.input.value,port:Number(port.input.value),enabled:enabled.checked,username:username.input.value,password:password.input.value,note:note.input.value,clearCredentials:clear.checked});local.textContent=`本机 IP：${result.localIp||'未检测到'}`;route.textContent=result.enabled?'代理已保存并应用到该账号。':'已关闭代理，该账号将使用直连。';username.input.value='';password.input.value='';clear.checked=false;username.input.placeholder=result.hasUsername?'已保存用户名（留空保持不变）':'请输入用户名';password.input.placeholder=result.hasPassword?'已保存密码（留空保持不变）':'请输入密码';toast('该账号的代理设置已保存。');}catch(error){toast(error.message||'代理设置保存失败。');}finally{saveProxy.disabled=false;}},'primary-button');
      actions.append(test,saveProxy);card.append(actions);panel.append(card);
      icons();
    }catch(error){toast(error.message||'读取代理设置失败。');}
  }
  async function renderSettings(panel){
    // Keep this panel focused on actionable controls; the long explanatory
    // note previously pushed the useful model controls down and was mistaken
    // for an editable remark in the UI.
    if(tool==='proxy'){renderProxySettings(panel);return;}
    if(!api){panel.append(node('div','warning-box','浏览器版本是离线界面预览；真实翻译引擎请在桌面版中设置。'),modelDownloadBox());return;}
    try{
      const cfg=await api.settings();if(tool!=='settings'&&tool!=='proxy')return;
      const modelBox=modelDownloadBox();
      // Put the model action near the top of the drawer.  It is the first
      // required step for a fresh installation and must not be hidden below
      // the longer engine/settings form.
      panel.append(modelBox);
      const select=node('select','panel-input');for(const [v,l]of [['local','超级翻译本地AI大模型'],['deepl','超级翻译智能API']]){const o=node('option','',l);o.value=v;select.append(o);}select.value=cfg.engine;
      const model=field('本地模型文件（GGUF）',cfg.model);model.input.placeholder='点击下方“一键导入 / 注入模型”自动配置';
      const advanced=node('details','runtime-advanced'),summary=node('summary','panel-label','兼容高级设置');advanced.append(summary,node('p','panel-help','仅旧版 Python 本地服务需要填写；新版内置运行时会忽略此项。'));const python=field('旧版 Python 路径（可选）',cfg.python);advanced.append(python.wrap);
      panel.append(node('label','panel-label','翻译引擎'),select,model.wrap,advanced,button('保存引擎设置',async()=>{try{await api.saveSettings({engine:select.value,python:python.input.value,model:model.input.value,localPort:cfg.localPort});toast('引擎设置已保存。');}catch(e){toast(e.message);}},'primary-button mt-3 w-full'));
      panel.append(button('测试本地服务',async()=>{try{const r=await api.health();toast(r.ok?'本地模型响应正常。':'本地服务未就绪。');}catch(e){toast(e.message);}},'secondary-button mt-2 w-full'));
      panel.append(button('启动本地模型',async()=>{try{toast('正在启动，请稍候…');await api.startModel();toast('本地模型已就绪。');}catch(e){toast(e.message);}},'secondary-button mt-2 w-full'));
       panel.append(button('导出本地客户备注',async()=>{try{const r=await api.exportNotes(state.liveProfiles);toast(r.cancelled?'已取消':'已导出备注文件。');}catch(e){toast(e.message);}},'secondary-button mt-2 w-full'));
       const injectHint=node('div','model-inject-callout');injectHint.id='model-inject-help';injectHint.append(icon('upload'),node('span','model-step-badge','下一步'),node('span','', '下载完成后点击蓝色按钮，一键导入并配置本地模型'));
       const inject=button('一键导入 / 注入本地 AI 模型',async()=>{try{inject.disabled=true;toast('请选择已下载的 ZIP 或 GGUF 文件…');const result=await api.installModel();if(!result?.cancelled){model.input.value=result.model;await api.saveSettings({engine:select.value,model:result.model,localPort:cfg.localPort});toast('模型已自动导入并配置完成；无需 Python，可直接点击“启动本地模型”。');}}catch(e){toast(e.message||'模型导入失败。');}finally{inject.disabled=false;}},'primary-button mt-2 w-full model-inject-button');
       inject.id='model-inject-button';inject.setAttribute('aria-describedby','model-inject-help');inject.title='选择下载的 ZIP 或 GGUF，自动解压并注入本机模型目录';inject.append(icon('upload'));
       // Keep the primary next step above the two download links so it remains
       // visible in the narrow drawer without requiring an initial scroll.
       const firstDownload=modelBox.querySelector('button');if(firstDownload){modelBox.insertBefore(injectHint,firstDownload);modelBox.insertBefore(inject,firstDownload);}else modelBox.append(injectHint,inject);
       const updateBox=node('section','update-box mt-4');const updateTitle=node('div','panel-label','软件更新');const updateVersion=node('p','panel-help',`当前版本 v${api.version||'未知'}`);const updateStatusNode=node('p','panel-help','');updateStatusNode.id='update-status';const check=button('检查更新',async()=>{try{check.disabled=true;updateStatusNode.textContent='正在检查更新…';const result=await api.checkForUpdates();if(result?.status==='dev')toast('开发模式不会访问线上更新。');}catch(e){toast(e.message);}finally{check.disabled=false;applyUpdateStatus(updateSnapshot);}},'secondary-button mt-2 w-full');const download=button('下载更新',async()=>{try{download.disabled=true;await api.downloadUpdate();toast('更新已下载，请点击安装并重启。');}catch(e){toast(e.message);}finally{download.disabled=false;}},'primary-button mt-2 w-full');download.id='update-download';const install=button('安装并重启',()=>{try{api.installUpdate();}catch(e){toast(e.message);}},'primary-button mt-2 w-full');install.id='update-install';updateBox.append(updateTitle,updateVersion,updateStatusNode,check,download,install);panel.append(updateBox);applyUpdateStatus(updateSnapshot);icons();
    }catch(e){toast(e.message);}
  }
  async function openModelDownload(url){
    try{if(api?.openExternal){await api.openExternal(url);toast('已打开模型下载页面，请下载并解压到本机。');}else{window.open(url,'_blank','noopener,noreferrer');toast('已打开模型下载页面。');}}
    catch(e){toast(e.message||'无法打开模型下载页面。');}
  }
  async function openSpeechModelDownload(url){
    if(!url)return toast('语音模型下载地址正在发布中。');
    try{if(api?.openExternal){await api.openExternal(url);toast('已打开语音模型下载页面；下载后直接点击一键导入。');}else{window.open(url,'_blank','noopener,noreferrer');toast('已打开语音模型下载页面。');}}
    catch(e){toast(e.message||'无法打开语音模型下载页面。');}
  }
  let selectedServiceKey='whatsapp';
  function renderServiceGrid(){
    const grid=$('services-grid-container');if(!grid)return;grid.replaceChildren();for(const key of CONFIRMED_PLATFORM_ORDER.filter(key=>platformRegistry[key])){const platform=platformRegistry[key];const card=node('button','service-card'+(key===selectedServiceKey?' selected':''));card.type='button';card.dataset.platform=key;card.setAttribute('role','option');card.setAttribute('aria-selected',String(key===selectedServiceKey));card.setAttribute('aria-label',`选择 ${platform.name}`);const logo=node('span','service-icon');appendPlatformLogo(logo,platform,'service-platform-logo');card.append(logo,node('span','service-name',platform.name));card.addEventListener('click',()=>{selectedServiceKey=key;renderServiceGrid();});grid.append(card);}icons();
  }
  async function openAddServiceModal(){
    const modal=$('add-service-modal');if(!modal)return;
    // A WebContentsView is composited above the renderer, so a z-index on the
    // HTML modal cannot cover it. Temporarily hide only the active service
    // view; the view and its persistent partition remain intact.
    if(live&&api?.viewVisibility){try{await api.viewVisibility(false);serviceModalViewHidden=true;}catch(error){toast(error?.message||'无法打开添加服务窗口。');return;}}
    selectedServiceKey='whatsapp';$('service-custom-name').value=M.accountName(state.accounts.length);$('service-quantity').value='1';$('session-proxy').value='';$('session-note').value='';$('session-fp-ua').value='';$('session-noise-canvas').checked=false;$('session-noise-audio').checked=false;$('session-noise-webgl').checked=false;$('session-noise-font').checked=false;renderServiceGrid();modal.hidden=false;
    if(api?.fingerprint)api.fingerprint(state.selectedAccount).then(cfg=>{if(!cfg)return;$('session-fp-os').value=cfg.os||'windows';$('session-fp-ua').value=cfg.ua||'';$('session-fp-resolution').value=(cfg.width||1920)+'x'+(cfg.height||1080);$('session-fp-timezone').value=cfg.timezone||'auto';if(cfg.languages?.length)$('session-fp-language').value=cfg.languages.join(',');$('session-fp-cores').value=String(cfg.hardwareConcurrency||8);$('session-fp-memory').value=String(cfg.memory||8);$('session-fp-webrtc').value=cfg.webrtc||'disable_udp';$('session-noise-canvas').checked=cfg.noise?.canvas===true;$('session-noise-audio').checked=cfg.noise?.audio===true;$('session-noise-webgl').checked=cfg.noise?.webgl===true;}).catch(()=>{});
    requestAnimationFrame(()=>{$('service-custom-name').focus();$('service-custom-name').select();});
  }
  function closeAddServiceModal(){const modal=$('add-service-modal');if(modal)modal.hidden=true;if(serviceModalViewHidden){serviceModalViewHidden=false;if(live&&api?.viewVisibility)api.viewVisibility(true).catch(()=>{});}}
  function sessionProxyConfig(){
    const raw=$('session-proxy')?.value.trim()||'';if(!raw)return null;
    const withScheme=raw.includes('://')?raw:'socks5://'+raw;
    const m=withScheme.match(/^(https?|socks5):\/\/(?:([^:@/]+):([^@/]+)@)?([^:/]+):(\d+)$/i);
    if(!m)throw new Error('代理格式应为 socks5://host:port 或 http://host:port');
    return{protocol:m[1].toLowerCase(),host:m[4],port:Number(m[5]),username:m[2]||'',password:m[3]||''};
  }
  function sessionFingerprintConfig(){
    const res=String($('session-fp-resolution')?.value||'1920x1080').split('x');
    return{enabled:true,os:$('session-fp-os')?.value||'windows',gpu:$('session-fp-gpu')?.value||'',ua:$('session-fp-ua')?.value.trim()||'',width:Number(res[0])||1920,height:Number(res[1])||1080,timezone:$('session-fp-timezone')?.value||'auto',languages:String($('session-fp-language')?.value||'').split(',').map(x=>x.trim()).filter(Boolean),hardwareConcurrency:Number($('session-fp-cores')?.value)||8,memory:Number($('session-fp-memory')?.value)||8,webrtc:$('session-fp-webrtc')?.value||'disable_udp',noise:{canvas:$('session-noise-canvas')?.checked===true,audio:$('session-noise-audio')?.checked===true,webgl:$('session-noise-webgl')?.checked===true}};
  }
  async function handleAddService(){
    const platform=platformRegistry[selectedServiceKey]||platformRegistry.whatsapp;const nameInput=$('service-custom-name').value.trim().slice(0,40);let quantity=Math.max(1,Math.min(10,Number.parseInt($('service-quantity').value,10)||1));const baseIndex=state.accounts.length;
    let proxy=null;try{proxy=sessionProxyConfig();}catch(error){toast(error.message);return;}
    const fp=sessionFingerprintConfig();
    const platformInstanceBase=state.accounts.filter(account=>account.platform===selectedServiceKey).length;for(let i=0;i<quantity;i++){const id=`${selectedServiceKey}-${crypto.randomUUID()}`;const name=nameInput?(quantity>1?`${nameInput} ${i+1}`:nameInput):M.accountName(baseIndex+i);state.accounts.push({id,platform:selectedServiceKey,platformName:platform.name,name,note:$('session-note').value.trim().slice(0,200),icon:platform.icon,iconFallback:platform.iconFallback||platform.name.slice(0,2).toUpperCase(),url:platform.url,number:'尚未登录',short:String(baseIndex+i+1).padStart(2,'0'),instanceNumber:platformInstanceBase+i+1,unread:0,partition:`persist:${id}`});}
    save();const newest=state.accounts[state.accounts.length-quantity];
    if(api?.saveFingerprint){try{await api.saveFingerprint(newest.id,fp);}catch(error){toast('实例已创建，但指纹保存失败：'+(error.message||error));}}
    if(proxy&&api?.saveProxySettings){try{await api.saveProxySettings({id:newest.id,protocol:proxy.protocol,host:proxy.host,port:proxy.port,enabled:true,username:proxy.username,password:proxy.password,note:'创建实例时配置'});}catch(error){toast('实例已创建，但代理保存失败：'+(error.message||error));}}
    closeAddServiceModal();renderAccounts();await switchAccount(newest.id);toast(`${platform.name} 已创建 ${quantity} 个独立实例；已打开登录页，扫码后完成登录。`);
  }
  async function previewReply(){
    if(!active||busy)return;const text=$('composer').value.trim();if(!text){toast('请先输入要翻译的回复。');return;}
    const c=active,account=state.selectedAccount,token=++generation;busy=true;$('send-button').disabled=true;
    const effective=M.rulesFor(state,c);try{
      const result=effective.enabled!==false&&effective.translateSend?(api?(await api.translate({text,target:effective.outgoing})).translation:M.demoTranslation(text,effective.outgoing)):text;
      if(token!==generation||active?.id!==c.id||account!==state.selectedAccount)return;
      const wrap=node('div'),notice=node('p','warning-box','这是本地演示会话。确认后只新增本地气泡，不向真实服务发送。'),translated=field('目标语言译文（可修改）',result,'textarea');translated.input.id='preview-text';wrap.append(notice,translated.wrap,node('div','preview-chinese','输入原文：'+text));
      const commit=button('确认加入演示会话',()=>{
        if(active?.id!==c.id||state.selectedAccount!==account||generation!==token){toast('会话或草稿已变化，请重新翻译。');$('dialog').close();return;}
        try{M.validateSend(translated.input.value,effective.enabled===false?{...effective,blockChinese:false}:effective);}catch(e){toast(e.message);return;}
        const m={id:'local-'+crypto.randomUUID(),direction:'out',foreign:translated.input.value,chinese:text,time:new Date().toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'}),local:true};c.messages.push(m);c.preview=m.foreign;c.time=m.time;$('composer').value='';state.drafts[account+':'+c.id]='';selectedFile=null;$('attachment-preview').hidden=true;save();$('dialog').close();renderChat();renderContacts();toast('已加入本地演示会话；没有发出真实服务消息。');
      },'primary-button');commit.id='confirm-preview';showDialog('发送前 · 双语预览',wrap,[commit]);
    }catch(e){toast(e.message);}finally{if(token===generation){busy=false;$('send-button').disabled=!active;}}
  }
  function renderAll(){renderAccounts();renderContacts();renderChat();renderRules();renderTool(tool);icons();}
  function liveBounds(){
    const a=document.querySelector('[data-column="contacts"]').getBoundingClientRect(),b=document.querySelector('[data-column="chat"]').getBoundingClientRect();
    // A WebContentsView always renders above the renderer.  Reserve the 28px
    // toggle gutter, otherwise the drawer could be collapsed but never opened.
    const right=rightPaneCollapsed?document.documentElement.clientWidth-28:b.right-28;
    return{x:Math.round(a.x),y:Math.round(a.y),width:Math.max(0,Math.round(right-a.x)),height:Math.round(a.height)};
  }
  function renderServiceViewStatus(){
    const panel=$('service-view-status');if(!panel)return;
    const title=$('service-view-status-title'),message=$('service-view-status-message'),retry=$('service-view-retry');
    const status=serviceViewStatus.status||'idle';
    panel.dataset.status=status;
    panel.hidden=!live||status==='idle'||status==='ready';
    if(title)title.textContent=status==='error'?'服务页面无法打开':status==='loading'?'正在加载服务页面…':'服务页面已就绪';
    if(message)message.textContent=serviceViewStatus.message||'请稍候。';
    if(retry)retry.hidden=status!=='error';
  }
  function livePreviewCopy(data=livePreview){
    const map={idle:'就绪',waiting:'等待翻译',translating:'翻译中…',ready:'译文就绪',replacing:'正在替换',sending:'正在发送',sent:`已交给 ${currentPlatformName()}`,blocked:'已拦截',error:'发送已阻止'};return map[data.status]||'就绪';
  }
  function paintLivePreview(){
    const status=$('trans-status'),box=$('live-preview-box'),original=$('live-preview-original');if(!status||!box)return;
    status.textContent=livePreviewCopy();status.dataset.status=livePreview.status;
    const sameChat=!livePreview.chat||!liveSnapshot?.key||livePreview.chat===liveSnapshot.key;
    const placeholder=`（在 ${currentPlatformName()} 聊天框输入任意语言，此处会自动显示${livePreview.targetLabel||'目标语言'}译文）`;
    const output=sameChat?(livePreview.error||livePreview.translation):'';box.textContent=output||placeholder;box.classList.toggle('is-placeholder',!output);box.classList.toggle('is-error',sameChat&&!!livePreview.error);
    if(original){original.textContent=sameChat&&livePreview.original?'输入原文：'+livePreview.original:'';original.hidden=!original.textContent;}
  }
  function renderLiveReply(){
    let wrap=$('live-reply');if(!wrap){wrap=node('section','live-reply');wrap.id='live-reply';const card=node('div','live-preview-card'),head=node('div','live-preview-head');head.append(node('span','','实时发送预览（自动生效）'));const status=node('span','live-preview-status','就绪');status.id='trans-status';status.setAttribute('role','status');head.append(status);const preview=node('div','live-preview-box is-placeholder');preview.id='live-preview-box';preview.setAttribute('aria-live','polite');const original=node('div','live-preview-original');original.id='live-preview-original';original.hidden=true;card.append(head,preview,original);wrap.append(card,node('p','live-preview-help'));$('translation-panel').append(wrap);}const help=wrap.querySelector('.live-preview-help');if(help)help.textContent=`直接在 ${currentPlatformName()} 原生聊天框输入任意语言。120ms 后自动识别并翻译；按 Enter 或点击发送时，软件替换为目标语言译文后发送。`;wrap.hidden=!live;paintLivePreview();
  }
  function setRightPaneCollapsed(value,notify=true){
    rightPaneCollapsed=!!value;document.body.classList.toggle('right-pane-collapsed',live&&rightPaneCollapsed);const toggle=$('right-pane-toggle');toggle.setAttribute('aria-expanded',String(!rightPaneCollapsed));toggle.setAttribute('aria-label',rightPaneCollapsed?'展开右侧工作台':'收起右侧工作台');toggle.title=rightPaneCollapsed?'展开右侧工作台':'收起右侧工作台';toggle.querySelector('span').textContent=rightPaneCollapsed?'❮':'❯';if(live)requestAnimationFrame(()=>api.setBounds(liveBounds()).catch(e=>toast(e.message)));if(notify)toast(rightPaneCollapsed?`右侧工作台已收起，${currentPlatformName()} 区域已扩大。`:'右侧工作台已展开。');
  }
  async function toggleLive(){
     if(!api){toast('当前浏览器预览无法连接服务，请使用桌面版。');return;}
     const account=state.accounts.find(item=>item.id===state.selectedAccount),next=!live;try{await api.setLive({active:next,account:state.selectedAccount,platform:account?.platform||'whatsapp',bounds:liveBounds()});live=next;liveSnapshot=null;crmCustomer=null;crmCustomerPhone='';crmContactError='';crmContactToken++;livePreview={chat:'',status:'idle',original:'',translation:'',error:'',targetLabel:'英语'};document.body.classList.toggle('live-mode',live);if(!live)setRightPaneCollapsed(false,false);else document.body.classList.toggle('right-pane-collapsed',rightPaneCollapsed);if($('mode-label'))$('mode-label').textContent=live?'实时连接':'离线预览';$('saved-status').textContent=live?'等待选择服务聊天':'本地设置';renderAll();if(live){requestAnimationFrame(()=>api.setBounds(liveBounds()));api.liveConfig(M.effectiveLiveRules(M.rulesFor(state,null))).catch(()=>{});}if(live)toast(`${platformRegistry[account?.platform||'whatsapp']?.name||'服务'} 已内嵌；翻译与发送保护已启用。`);}catch(e){toast(e.message);}
  }
  async function retryServiceView(){
    if(!api?.reloadService)return;
    serviceViewStatus={status:'loading',message:'正在重新加载服务页面…'};renderServiceViewStatus();
    try{await api.reloadService();}catch(error){serviceViewStatus={status:'error',message:error?.message||'服务页面加载失败，请检查网络或代理后重试。'};renderServiceViewStatus();}
  }
  async function refreshPage(){
    const button=$('refresh-page');
    if(refreshingPage)return;
    refreshingPage=true;
    if(button){button.disabled=true;button.classList.add('is-refreshing');button.setAttribute('aria-busy','true');}
    try{
      if(api?.reloadService&&live){
        await retryServiceView();
        toast('服务页面正在刷新，请稍候。');
      }else{
        location.reload();
        return;
      }
    }finally{
      refreshingPage=false;
      if(button){button.disabled=false;button.classList.remove('is-refreshing');button.removeAttribute('aria-busy');}
    }
  }
  window.addEventListener('resize',()=>{if(live)api.setBounds(liveBounds());});
  if(api?.onSelf)api.onSelf(value=>{const account=state.accounts.find(a=>a.id===value.account);if(account){account.selfName=value.name;account.selfPhone=value.phone;save();renderAccounts();}});
  if(api){
    if(api.onSpeechInstallStatus)api.onSpeechInstallStatus(data=>{if(!data||typeof data!=='object')return;speechInstallSnapshot={stage:String(data.stage||'idle'),message:String(data.message||'')};const status=$('speech-model-install-status');if(status){status.textContent=speechInstallSnapshot.message;status.dataset.stage=speechInstallSnapshot.stage;}});
    if(api.onAccountMessage)api.onAccountMessage(data=>{if(!data||typeof data.account!=='string')return;handleNewMessageIncoming(data.account,data.sender,data.content,data.count);});
    if(api.onAccountUnread)api.onAccountUnread(data=>{if(!data||typeof data.account!=='string')return;const count=Math.max(0,Number(data.count)||0);if(data.account===state.selectedAccount)clearAccountUnread(data.account);else updateAccountBadge(data.account,count);});
    api.onSnapshot(snapshot=>{
      const old=liveSnapshot?.key;liveSnapshot=snapshot;if(!live)return;
      if(snapshot.key&&snapshot.phone){const profile=state.liveProfiles[snapshot.key]??={};if(!profile.phone||profile.phoneSource==='automatic'){Object.assign(profile,{phone:snapshot.phone,title:profile.title||snapshot.title||'',country:snapshot.country||profile.country||'',countryCode:snapshot.countryCode||profile.countryCode||'',phoneSource:'automatic'});save();}}
      syncAnnotation();connectionState[state.selectedAccount]=!!snapshot.connected;renderAccounts();const translationEnabled=snapshot.translationEnabled!==false;$('saved-status').textContent=!translationEnabled?'翻译功能已关闭':snapshot.translationPaused?'翻译连续失败 · 请检查引擎':snapshot.key?'当前聊天已连接':'等待登录 / 选择聊天';$('history-status').textContent=!translationEnabled?'翻译功能已关闭；平台原文可直接发送。':snapshot.translationPaused?'连续失败 3 次，自动翻译已暂停；检查引擎后关闭再开启。':snapshot.historyActive?'历史翻译已开启 · 已译 '+(snapshot.translated||0)+' 条，待处理 '+(snapshot.pending||0)+' 条':'翻译已加载的历史文字；向上滚动加载后继续。';if(old===snapshot.key){$('detail-country').textContent=current()?.country||'未识别号码';}
      if(old!==snapshot.key){if(snapshot.key)state.rules[snapshot.key]={...state.rules[snapshot.key],automatic:false};crmCustomer=null;crmCustomerPhone='';crmContactError='';livePreview={chat:snapshot.key||'',status:'idle',original:'',translation:'',error:'',targetLabel:M.languages[M.rulesFor(state,current()).outgoing]||'目标语言'};renderRules();paintLivePreview();if(tool==='notes')renderTool('notes');if(tool==='customer-profile')renderTool('customer-profile');api.liveConfig({...liveRules(),automatic:false}).catch(e=>toast(e.message));}
      if(snapshot.key&&snapshot.phone&&!snapshot.group)ensureLiveCrmCustomer(snapshot).catch(()=>{});
    });
    if(api.onLivePreview)api.onLivePreview(data=>{if(!live||!data||data.chat&&liveSnapshot?.key&&data.chat!==liveSnapshot.key)return;livePreview={...livePreview,...data};paintLivePreview();});
    if(api.onServiceStatus)api.onServiceStatus(data=>{if(!data||typeof data!=='object')return;if(data.account&&data.account!==state.selectedAccount)return;serviceViewStatus={status:String(data.status||'idle'),message:String(data.message||'')};renderServiceViewStatus();});
  }
  // ---------- 聚合 SCRM：客户与授权概览（原生页，MVP） ----------
  const SCRM_BASE='http://127.0.0.1:18801';
  const scrmTokenKey='super-translate.scrm.token';
  let scrmView='overview', scrmSession=null, scrmStats=null, scrmProxies=null, scrmLoading=false;
  let clientOpsTab='overview', clientOpsQuicks=null, clientOpsBroadcasts=null, clientOpsTags=null, broadcastRunning=false, broadcastStop=false;
  let aiReplyCache=null;
  let aiSuggestionCache=null;
  const customerToolCache={list:null,memos:null,risk:null};
  function scrmStoredToken(){try{return localStorage.getItem(scrmTokenKey)||'';}catch{return '';}}
  function scrmSetToken(token){try{if(token)localStorage.setItem(scrmTokenKey,token);else localStorage.removeItem(scrmTokenKey);}catch{}}
  async function scrmApi(path,opts={}){
    const token=scrmStoredToken();
    const headers={...(opts.body!==undefined?{'content-type':'application/json'}:{}),...(token?{authorization:'Bearer '+token}:{}),...(opts.headers||{})};
    let res;
    const url=path.startsWith('/api/')?SCRM_BASE+path:SCRM_BASE+'/api/app'+path;
    try{res=await fetch(url,{...opts,headers});}
    catch{const err=new Error('无法连接本地 SCRM 服务（127.0.0.1:18801），请确认服务已启动。');err.status=0;throw err;}
    let data=null;try{data=await res.json();}catch{}
    if(res.status===401)scrmSetToken('');
    if(!res.ok||(data&&typeof data.code==='number'&&data.code>=400)){const err=new Error((data&&(data.msg||data.message||data.error))||('SCRM 服务错误 ('+res.status+')'));err.status=res.status;throw err;}
    return data;
  }
  async function scrmEnsureSession(){
    if(scrmStoredToken())return;
    if(!api?.scrmToken)throw new Error('请先登录超级翻译账号。');
    const token=await api.scrmToken();
    if(!token)throw new Error('超级翻译账号无法建立 SCRM 会话。');
    scrmSetToken(token);
  }
  function scrmOpenOverview(){
    scrmView='overview';
    const frame=$('scrm-frame'),ov=$('scrm-overview'),tgl=$('scrm-full-toggle');
    if(frame){frame.hidden=true;frame.style.display='none';}
    if(ov){ov.hidden=false;ov.style.display='block';}
    if(tgl)tgl.textContent='打开完整 SCRM';
    scrmRenderOverview();
  }
  function scrmOpenFull(){
    scrmView='full';
    const frame=$('scrm-frame'),ov=$('scrm-overview'),tgl=$('scrm-full-toggle');
    if(frame){if(!frame.getAttribute('src')||frame.getAttribute('src')==='about:blank')frame.src=SCRM_BASE+'/client/';frame.hidden=false;frame.style.display='block';}
    if(ov){ov.hidden=true;ov.style.display='none';}
    if(tgl)tgl.textContent='返回概览';
  }
  async function scrmLoadData(){
    scrmLoading=true;
    await scrmEnsureSession();
    const session=await scrmApi('/me');
    const stats=await scrmApi('/contacts/stats');
    const proxies=await scrmApi('/proxies');
    scrmSession=session;scrmStats=stats?.data||null;scrmProxies=proxies?.data||null;scrmLoading=false;
  }
  function scrmSubmitLogin(){
    const input=$('scrm-invite-code');if(!input||scrmLoading)return;
    const code=input.value.trim();const errEl=$('scrm-login-error');
    if(!code){if(errEl){errEl.textContent='请输入邀请码。';errEl.classList.add('show');}return;}
    scrmLoading=true;if(errEl)errEl.classList.remove('show');
    const btn=$('scrm-login-button');if(btn){btn.disabled=true;btn.textContent='正在登录…';}
    scrmApi('/login',{method:'POST',body:JSON.stringify({invite_code:code})}).then(data=>{
      scrmSetToken(data.token);
      scrmRenderOverview();
      scrmLoadData().then(()=>scrmRenderOverview()).catch(err=>{scrmLoading=false;scrmRenderError(err);});
    }).catch(err=>{
      scrmLoading=false;
      if(btn){btn.disabled=false;btn.textContent='登录';}
      if(errEl){errEl.textContent=err.message||'登录失败，请重试。';errEl.classList.add('show');}
    });
  }
  function scrmLogout(){
    scrmSetToken('');scrmSession=null;scrmStats=null;scrmProxies=null;scrmLoading=false;scrmRenderOverview();
  }
  function scrmStatCard(label,value,note){
    const card=node('div','scrm-stat');
    card.append(node('div','scrm-stat-label',label),node('div','scrm-stat-value',String(value)));
    if(note)card.append(node('div','scrm-stat-note',note));
    return card;
  }
  function scrmPill(status){
    const map={'ok':'正常','fail':'异常','unknown':'未知'};
    const cls=status==='ok'?'scrm-pill-ok':(status==='fail'?'scrm-pill-fail':'scrm-pill-unknown');
    return node('span','scrm-pill '+cls,map[status]||String(status||'未知'));
  }
  function scrmRenderError(err){
    const ov=$('scrm-overview');if(!ov)return;
    const card=node('div','scrm-login-card');
    card.append(node('div','scrm-title','加载失败'),node('div','scrm-sub',String(err?.message||'未知错误')));
    const actions=node('div','scrm-actions');
    const retry=node('button','secondary-button','重试');retry.type='button';retry.addEventListener('click',()=>{scrmSetToken('');scrmSession=null;scrmStats=null;scrmProxies=null;scrmRenderOverview();});
    actions.append(retry);
    card.append(actions);
    ov.append(card);
  }
  function scrmLoginCard(){
    const card=node('div','scrm-login-card');
    card.append(node('div','scrm-title','聚合 SCRM · 客户与授权概览'),node('div','scrm-sub','使用邀请码登录本地 SCRM 服务，查看客户、线索与代理概览。'));
    const input=node('input','scrm-input');input.id='scrm-invite-code';input.type='text';input.placeholder='邀请码（如 CHMMVOA64ULC8W）';input.maxLength=64;input.autocomplete='off';
    input.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.isComposing){e.preventDefault();scrmSubmitLogin();}});
    const err=node('div','scrm-error');err.id='scrm-login-error';err.setAttribute('role','alert');
    const login=node('button','primary-button','登录');login.id='scrm-login-button';login.type='button';login.style.marginTop='16px';login.style.width='100%';login.addEventListener('click',scrmSubmitLogin);
    card.append(input,err,login);
    return card;
  }
  function scrmDashboard(){
    const wrap=node('div','scrm-wrap');
    const header=node('div','scrm-row');
    const left=node('div');
    left.append(node('div','scrm-title','客户与授权概览'),node('div','scrm-sub','数据来自本地 SCRM 服务 · '+(scrmSession?.remark||scrmSession?.device||'')));
    const refresh=node('button','secondary-button','刷新');refresh.type='button';refresh.addEventListener('click',()=>{scrmSession=null;scrmStats=null;scrmProxies=null;scrmRenderOverview();});
    header.append(left,refresh);
    wrap.append(header);
    const proxies=Array.isArray(scrmProxies?.groups)?scrmProxies.groups.flatMap(g=>Array.isArray(g.list)?g.list:[]):[];
    const stats=scrmStats||{total:0,leads:0,platforms:[]};
    const grid=node('div','scrm-stats');
    grid.append(scrmStatCard('客户数',stats.total,'已入库客户'),scrmStatCard('线索数',stats.leads,'未转化线索'),scrmStatCard('代理数',proxies.length,'可用代理线路'));
    wrap.append(grid);
    const sec1=node('div','scrm-card scrm-section');
    sec1.append(node('div','scrm-stat-label','平台客户分布'));
    const chips=node('div');chips.style.cssText='margin-top:10px;display:flex;flex-wrap:wrap;gap:8px;';
    const platforms=Array.isArray(stats.platforms)?stats.platforms:[];
    if(!platforms.length)chips.append(node('span','scrm-sub','暂无客户平台数据'));
    else platforms.forEach(p=>{const c=node('span','scrm-chip');c.append(document.createTextNode(String(p.platform||'未标注')+' '),node('em','',String(p.n)));chips.append(c);});
    sec1.append(chips);wrap.append(sec1);
    const sec2=node('div','scrm-card scrm-section');
    sec2.append(node('div','scrm-stat-label','授权信息'));
    const billing=scrmSession?.billing||{};
    const rows=node('div');rows.style.cssText='margin-top:8px;font-size:12px;color:#0f172a;display:grid;grid-template-columns:auto auto;gap:6px 24px;justify-content:start;';
    const kv=[['邀请码',scrmSession?.remark||'—'],['额度类型',billing.type||'—'],['设备',scrmSession?.device||'—'],['已用字符',billing.chars?.spent==null?'—':Number(billing.chars.spent).toLocaleString()],['剩余字符',billing.chars?.remaining==null?'—':Number(billing.chars.remaining).toLocaleString()],['状态',billing.expire_at?'已到期':'正常']];
    kv.forEach(([k,v])=>{rows.append(node('span','scrm-sub',k),node('span','',String(v)));});
    sec2.append(rows);wrap.append(sec2);
    const sec3=node('div','scrm-card scrm-section');
    sec3.append(node('div','scrm-stat-label','代理线路'));
    if(!proxies.length)sec3.append(node('div','scrm-sub','暂无代理线路'));
    else{
      const table=node('table','scrm-table');table.style.marginTop='8px';
      const thead=node('thead');const trh=node('tr');['地址','地区','状态','延迟'].forEach(t=>trh.append(node('th','',t)));thead.append(trh);
      const tbody=node('tbody');
      proxies.forEach(p=>{const tr=node('tr');const tdStatus=node('td','');tdStatus.append(scrmPill(p.status));tr.append(node('td','',String(p.url||'—')),node('td','',String(p.country||p.region||'—')),tdStatus,node('td','',p.latency?String(p.latency)+' ms':'—'));tbody.append(tr);});
      table.append(thead,tbody);sec3.append(table);
    }
    wrap.append(sec3);
    const note=node('div','scrm-actions');
    const full=node('button','secondary-button','打开完整 SCRM');full.type='button';full.addEventListener('click',scrmOpenFull);
    note.append(full);wrap.append(note);
    return wrap;
  }
  function scrmRenderOverview(){
    const ov=$('scrm-overview');if(!ov||scrmView!=='overview')return;
    ov.textContent='';
    if(!scrmSession||!scrmStats||!scrmProxies){
      const p=node('p','','正在使用超级翻译账号连接聚合 SCRM…');p.style.cssText='text-align:center;color:#64748b;margin-top:64px;';
      ov.append(p);
      if(!scrmLoading)scrmLoadData().then(()=>scrmRenderOverview()).catch(err=>{scrmLoading=false;scrmRenderError(err);});
      return;
    }
    ov.append(scrmDashboard());
  }
  function renderRefresh(panel){
    panel.replaceChildren();
    const head=node('div','scrm-row');
    const copy=node('div','');copy.append(node('div','scrm-title','同步设置'),node('div','scrm-sub','控制当前会话刷新'));
    head.append(copy);panel.append(head);
    const autoRow=node('label','');autoRow.style.cssText='display:flex;align-items:center;justify-content:space-between;padding:12px 0;border-bottom:1px solid #f1f5f9;font-size:12px;';
    const auto=node('input');auto.type='checkbox';auto.checked=(()=>{try{return localStorage.getItem('super-translate.auto-refresh')==='1'}catch{return false}})();auto.onchange=()=>{try{localStorage.setItem('super-translate.auto-refresh',auto.checked?'1':'0')}catch{}};autoRow.append(node('span','','自动刷新'),auto);panel.append(autoRow);
    const intRow=node('label','');intRow.style.cssText='display:flex;align-items:center;justify-content:space-between;padding:12px 0;border-bottom:1px solid #f1f5f9;font-size:12px;';
    const sel=node('select');['5 分钟','10 分钟','30 分钟','1 小时'].forEach(t=>{const o=node('option','',t);sel.append(o);});sel.style.cssText='padding:5px;border:1px solid #cbd5e1;border-radius:7px;font:inherit;font-size:11px;';intRow.append(node('span','','刷新间隔'),sel);panel.append(intRow);
    const btn=button('刷新当前会话',()=>{try{if(api?.reloadService)api.reloadService();else location.reload();toast('正在刷新当前会话…');}catch(error){toast(error?.message||'刷新失败');}},'primary-button');btn.style.cssText='width:100%;margin-top:16px;';panel.append(btn);
  }
  function renderFingerprint(panel){
    panel.replaceChildren();
    if(!api?.fingerprint){panel.append(node('p','panel-help','当前环境不支持指纹设置。'));return;}
    panel.append(node('p','panel-help','读取设置…'));
    api.fingerprint(state.selectedAccount).then(loaded=>{
      const cfg={...loaded,noise:{...(loaded?.noise||{})}};
      const purple='#8b5cf6',line='#e5e7eb';
      const draw=()=>{
        panel.replaceChildren();
        const header=node('div','');header.style.cssText='display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;';
        header.append(node('div','scrm-title','指纹环境'));
        const badge=node('span','','✦ 独家');badge.style.cssText='background:#ede9fe;color:#7c3aed;border-radius:999px;padding:3px 8px;font-size:10px;font-weight:600;';header.append(badge);panel.append(header);
        const warn=node('div','','⚠ 暂无指纹数据，应用后生效');warn.style.cssText='background:#fffbeb;color:#b45309;border:1px solid #fde68a;border-radius:8px;padding:7px 9px;font-size:11px;margin-bottom:10px;';panel.append(warn);
        const cfgHead=node('div','');cfgHead.style.cssText='display:flex;align-items:center;justify-content:space-between;margin:8px 0;';cfgHead.append(node('strong','','🔒 指纹配置'));
        const rand=button('⟳ 随机',()=>{cfg.webrtc=['disable_udp','proxy','real','disable'][Math.floor(Math.random()*4)];cfg.geo=['ask','ip','block'][Math.floor(Math.random()*3)];cfg.webgl=['ip','off','real'][Math.floor(Math.random()*3)];cfg.webgpu=['ip','block','real'][Math.floor(Math.random()*3)];cfg.width=[1366,1440,1600,1920,2560][Math.floor(Math.random()*5)];cfg.height=[768,900,1080,1440][Math.floor(Math.random()*4)];cfg.hardwareConcurrency=[4,6,8,12,16][Math.floor(Math.random()*5)];cfg.memory=[4,8,16,32][Math.floor(Math.random()*4)];draw();},'secondary-button');cfgHead.append(rand);panel.append(cfgHead);
        const label=text=>{const el=node('div','',text);el.style.cssText='font-size:11px;color:#64748b;margin:9px 0 4px;';return el;};
        const segment=(key,options)=>{const row=node('div','');row.style.cssText='display:flex;gap:4px;flex-wrap:wrap;';options.forEach(([value,text])=>{const b=node('button','',text);b.type='button';b.style.cssText='flex:1;min-width:42px;border:1px solid '+line+';border-radius:7px;padding:5px 4px;font-size:10px;cursor:pointer;background:'+(cfg[key]===value?purple:'#fff')+';color:'+(cfg[key]===value?'#fff':'#475569')+';';b.onclick=()=>{cfg[key]=value;draw();};row.append(b);});panel.append(row);};
        panel.append(label('WebRTC'));segment('webrtc',[['disable_udp','禁用UDP(推荐)'],['proxy','代理IP'],['real','真实'],['disable','禁用']]);
        panel.append(label('地理位置'));segment('geo',[['ask','询问'],['ip','基于IP'],['block','屏蔽']]);
        panel.append(label('WebGL元数据'));segment('webgl',[['ip','基于IP'],['off','关闭'],['real','真实']]);
        panel.append(label('WebGPU'));segment('webgpu',[['ip','基于IP'],['block','屏蔽'],['real','真实']]);
        panel.append(label('字体'));segment('font',[['default','默认'],['custom','自定义']]);
        const select=(labelText,key,options)=>{panel.append(label(labelText));const s=node('select');s.style.cssText='width:100%;padding:6px;border:1px solid #cbd5e1;border-radius:7px;font:inherit;font-size:11px;';options.forEach(([v,t])=>{const o=node('option','',t);o.value=v;s.append(o);});s.value=cfg[key]||options[0][0];s.onchange=()=>{cfg[key]=s.value;};panel.append(s);};
        select('时区','timezone',[['auto','基于IP (自动)'],['Asia/Shanghai','Asia/Shanghai'],['UTC','UTC'],['America/New_York','America/New_York'],['Europe/London','Europe/London']]);
        select('语言','language',[['zh-CN,zh','基于IP (自动)'],['zh-CN,zh','中文'],['en-US,en','English'],['ja-JP,ja','日本語'],['ko-KR,ko','한국어']]);
        const res=node('input');res.value=String(cfg.width||1920)+'x'+String(cfg.height||1080);res.style.cssText='width:100%;box-sizing:border-box;padding:6px;border:1px solid #cbd5e1;border-radius:7px;font:inherit;font-size:11px;';res.onchange=()=>{const m=res.value.match(/^(\d{3,4})[xX*](\d{3,4})$/);if(m){cfg.width=Number(m[1]);cfg.height=Number(m[2]);}};panel.append(label('分辨率'),res);
        const ua=node('input');ua.value=cfg.ua||'';ua.placeholder='留空使用默认浏览器 UA';ua.style.cssText='width:100%;box-sizing:border-box;padding:6px;border:1px solid #cbd5e1;border-radius:7px;font:inherit;font-size:11px;';ua.onchange=()=>{cfg.ua=ua.value.trim();};panel.append(label('UA'),ua);
        select('系统','os',[['windows','Windows'],['macos','macOS'],['linux','Linux']]);
        select('GPU','gpu',[['ANGLE (NVIDIA, NVIDIA GeForce GTX 1660 Direct3D11 vs_5_0 ps_5_0, D3D11)','ANGLE (NVIDIA GeForce GTX 1660)'],['ANGLE (Intel, Intel(R) UHD Graphics 630 Direct3D11 vs_5_0 ps_5_0, D3D11)','ANGLE (Intel UHD 630)'],['ANGLE (AMD, AMD Radeon RX 580 Direct3D11 vs_5_0 ps_5_0, D3D11)','ANGLE (AMD RX 580)']]);
        const two=node('div','');two.style.cssText='display:flex;gap:6px;margin-top:7px;';
        const core=node('select');core.innerHTML='<option>4</option><option>6</option><option>8</option><option>12</option><option>16</option>';core.value=String(cfg.hardwareConcurrency||8);core.style.cssText='flex:1;padding:6px;border:1px solid #cbd5e1;border-radius:7px;font-size:11px;';core.onchange=()=>{cfg.hardwareConcurrency=Number(core.value);};
        const mem=node('select');mem.innerHTML='<option>4</option><option>8</option><option>16</option><option>32</option>';mem.value=String(cfg.memory||8);mem.style.cssText='flex:1;padding:6px;border:1px solid #cbd5e1;border-radius:7px;font-size:11px;';mem.onchange=()=>{cfg.memory=Number(mem.value);};
        const pair=node('div','');pair.style.cssText='display:flex;gap:6px;';const left=node('div','');left.style.cssText='flex:1;';left.append(label('CPU核心'),core);const right=node('div','');right.style.cssText='flex:1;';right.append(label('内存'),mem);pair.append(left,right);panel.append(pair);
        panel.append(label('硬件噪音'));const noise=node('div','');noise.style.cssText='display:flex;flex-wrap:wrap;gap:6px 10px;font-size:11px;color:#475569;';
        [['canvas','Canvas'],['audio','Audio'],['webgl','WebGL'],['media','媒体设备'],['clientRects','ClientRects'],['speech','SpeechVoices']].forEach(([key,text])=>{const l=node('label','');l.style.cssText='display:flex;align-items:center;gap:4px;width:45%;';const cb=node('input');cb.type='checkbox';cb.checked=cfg.noise?.[key]===true;cb.onchange=()=>{cfg.noise=cfg.noise||{};cfg.noise[key]=cb.checked;};l.append(cb,node('span','',text));noise.append(l);});panel.append(noise);
        const apply=button('应用指纹设置',()=>{cfg.enabled=true;api.saveFingerprint(state.selectedAccount,cfg).then(saved=>{Object.assign(cfg,saved);toast('指纹设置已应用；新开实例生效。');draw();}).catch(error=>toast(error?.message||'保存失败'));},'primary-button');apply.style.cssText='width:100%;margin-top:14px;background:#7c3aed;color:#fff;border:none;border-radius:8px;padding:9px;font-weight:600;';panel.append(apply);
        const actions=node('div','');actions.style.cssText='display:flex;gap:6px;margin-top:8px;';
        const probeBox=node('div','');probeBox.style.cssText='margin-top:8px;font-size:11px;line-height:1.7;color:#475569;';panel.append(probeBox);
        const detect=button('环境检测',()=>{if(!api?.probeFingerprint)return toast('当前环境不支持检测。');probeBox.textContent='检测中…';api.probeFingerprint().then(actual=>{const rows=[['UA',actual.ua],['平台',actual.platform],['语言',actual.language],['CPU',String(actual.hardwareConcurrency)],['内存',String(actual.deviceMemory)],['时区',actual.timezone],['屏幕',(actual.screen||[]).join('x')],['WebGL',actual.webglRenderer],['Canvas',actual.canvasHash]];probeBox.replaceChildren();rows.forEach(([k,v])=>probeBox.append(node('div','',k+'：'+String(v||'—'))));}).catch(error=>{probeBox.textContent=String(error?.message||'检测失败');});},'secondary-button');detect.style.cssText='flex:1;background:#16a34a;color:#fff;border:none;border-radius:8px;padding:8px;font-size:11px;';
        const close=button('关闭检测',()=>{cfg.enabled=false;api.saveFingerprint(state.selectedAccount,cfg).then(()=>{toast('指纹覆盖已关闭。');draw();}).catch(error=>toast(error?.message||'保存失败'));},'secondary-button');close.style.cssText='flex:1;background:#dc2626;color:#fff;border:none;border-radius:8px;padding:8px;font-size:11px;';
        actions.append(detect,close);panel.append(actions);
      };
      draw();
    }).catch(error=>panel.append(node('p','panel-help',String(error?.message||error))));
  }
  let customerProfileTab='info', customerProfileMemos=null;
﻿  function renderCustomerProfile(panel){
    panel.replaceChildren();
    const c=current();
    const data={
      name:c?.internalName||c?.name||liveSnapshot?.title||'',
      nickname:c?.nickname||c?.internalName||'',
      number:c?.phone||liveSnapshot?.phone||'',
      phone:c?.phone||'',
      country:c?.country||'',
      language:c?.lang||liveSnapshot?.language||'',
      address:c?.address||'',birthday:c?.birthday||'',gender:c?.gender||'other',note:c?.note||'',
      tags:c?.tags||'',customer_value:c?.customer_value||'',sales_stage:c?.sales_stage||'',social_source:c?.social_source||'',
      company_name:c?.company_name||'',job_title:c?.job_title||'',website:c?.website||'',company_size:c?.company_size||'',
      company_phone:c?.company_phone||'',company_email:c?.company_email||'',company_address:c?.company_address||'',
      platform:currentPlatformName(),avatar:c?.avatar||'',
    };
    let record=null,memos=[],tab='info';
    const timezoneForCountry=country=>{
      const text=String(country||'').toLowerCase();
      const map=globalThis.SCRM_TIMEZONE_MAP||[];
      const exact=map.find(([names])=>names.split('|').some(name=>text===name));
      const found=exact||map.find(([names])=>names.split('|').some(name=>!/^[a-z]{1,3}$/i.test(name)&&text.includes(name)));
      return found?found[1]:'';
    };
    const wrap=node('div','cpx-wrap');panel.append(wrap);
    const load=async()=>{
      const key=String(data.number||'').replace(/\D/g,'');
      if(!data.number&&live&&api?.identifyPhone){try{const found=await api.identifyPhone();data.number=String(found?.phone||'');data.phone=data.number;}catch{}}
      if(data.number&&api?.phone){try{const info=await api.phone(data.number);if(info?.country)data.country=info.label||data.country;data.number=info.number||data.number;data.phone=data.phone||data.number;}catch{}}
      try{
        await scrmEnsureSession();
        const rows=await scrmApi('/api/client/entities/customers?limit=500');
        const list=Array.isArray(rows?.rows)?rows.rows:[];
        const found=list.find(r=>{const k=String(r.contact||'').replace(/\D/g,'');return key&&k&&(k.endsWith(key)||key.endsWith(k));});
        record=found||null;
        if(found){for(const [k,v] of Object.entries(found)){if(v!==undefined&&v!==null&&v!=='')data[k]=v;}data.name=found.name||data.name;data.number=found.contact||data.number;}
        const memo=await scrmApi('/contact-memos');
        memos=Array.isArray(memo?.data)?memo.data.filter(m=>{const k=String(m.contact||'').replace(/\D/g,'');return key&&k&&(k.endsWith(key)||key.endsWith(k));}):[];
      }catch{}
      draw();
    };
    const draw=()=>{
      wrap.replaceChildren();
      const head=node('div','cpx-head');head.append(node('span','','客户画像'),button('↻',()=>load(),'cpx-refresh'));
      const tabs=node('div','cpx-tabs');const infoTab=button('客户信息',()=>{tab='info';draw();},'cpx-tab'+(tab==='info'?' on':''));const memoTab=button('备忘录'+(memos.length?' '+memos.length:''),()=>{tab='memo';draw();},'cpx-tab'+(tab==='memo'?' on':''));tabs.append(infoTab,memoTab);wrap.append(head,tabs);
      const body=node('div','cpx-body');
      if(!c&&!data.name&&!data.number){body.append(node('div','cpx-empty','请先打开一个聊天'));wrap.append(body);return;}
      if(tab==='info'){
        const sec=node('div','cpx-sec-row');sec.append(node('span','cpx-sec','联系信息'),node('a','','跟进记录 ›'));sec.lastChild.onclick=()=>{tab='memo';draw();};body.append(sec);
        const card=node('div','cpx-card');
        const info=(label,value)=>{card.append(node('b','',label),node('span','',String(value||'--')));};
        const contactTz=timezoneForCountry(data.country);
        const localTime=contactTz?new Date().toLocaleString('zh-CN',{timeZone:contactTz,hour12:false}):(data.country?new Date().toLocaleString('zh-CN',{hour12:false}):'--');
        info('客户手机号：',data.number);info('号码所属国家：',data.country);info('当地时间：',localTime);card.append(node('span','cpx-tzrow',contactTz||(data.country?Intl.DateTimeFormat().resolvedOptions().timeZone:'--')));info('常用语言：',data.language||'自动识别');body.append(card);
        const form=node('div','');
        const fields={};
        const rowField=(label,key,type='text',options=[])=>{const row=node('div','cpx-row');row.append(node('label','',label));const holder=node('div','');let el;if(type==='select'){el=node('select','cpx-sel');options.forEach(([v,t])=>{const o=node('option','',t);o.value=v;el.append(o);});el.value=data[key]||options[0]?.[0]||'';}else if(type==='textarea'){el=node('textarea','cpx-ta');el.rows=3;el.maxLength=200;el.value=data[key]||'';}else{el=node('input','cpx-inp');el.type=type;el.value=data[key]||'';}holder.append(el);row.append(holder);form.append(row);fields[key]=el;return el;};
        rowField('昵称备注','nickname');rowField('电话','phone');rowField('地址','address');rowField('生日','birthday','date');
        const genderRow=node('div','cpx-row');genderRow.append(node('label','','性别'));const radios=node('div','cpx-radios');const genderName='cpxGender_'+Date.now();for(const [value,text] of [['female','女性'],['male','男性'],['other','其他']]){const l=node('label','');const radio=node('input','');radio.type='radio';radio.name=genderName;radio.value=value;radio.checked=(data.gender||'other')===value;radio.onchange=()=>data.gender=value;l.append(radio,node('span','',text));radios.append(l);}genderRow.append(radios);form.append(genderRow);
        rowField('备注','note','textarea');
        rowField('国家','country');rowField('客户标签','tags');
        form.append(node('div','cpx-sub','销售信息'));
        rowField('客户价值','customer_value','select',[['','客户价值'],['核心','核心'],['重要','重要'],['普通','普通'],['低价值','低价值']]);
        rowField('销售阶段','sales_stage','select',[['','销售阶段'],['初步接触','初步接触'],['需求确认','需求确认'],['方案报价','方案报价'],['谈判中','谈判中'],['已成交','已成交'],['已流失','已流失']]);
        rowField('社媒来源','social_source','select',[['','社媒来源'],['Facebook','Facebook'],['Instagram','Instagram'],['TikTok','TikTok'],['Google Ads','Google Ads'],['WhatsApp','WhatsApp'],['Telegram','Telegram'],['LINE','LINE'],['Zalo','Zalo'],['其他','其他']]);
        form.append(node('div','cpx-sub','公司信息'));
        rowField('公司名称','company_name');rowField('职位','job_title');rowField('网站','website');rowField('规模','company_size');rowField('电话','company_phone');rowField('邮箱','company_email');rowField('地址','company_address');
        body.append(form);
        const foot=node('div','cpx-foot');const saved=node('span','cpx-saved','');const save=button('保存',()=>{
          const payload={contact:data.number||data.name,platform:data.platform};
          for(const [key,el] of Object.entries(fields))payload[key]=String(el.value||'').trim();
          payload.name=payload.nickname||data.name;payload.note=payload.note||'';
          const request=record?.id?scrmApi('/api/client/entities/customers/'+record.id,{method:'PATCH',body:JSON.stringify(payload)}):scrmApi('/api/client/entities/customers',{method:'POST',body:JSON.stringify(payload)});
          Promise.resolve(request).then(()=>scrmApi('/contact-memos',{method:'POST',body:JSON.stringify({contact:data.number||data.name,note:payload.note})})).then(()=>{Object.assign(data,payload);saved.textContent='已保存';setTimeout(()=>saved.textContent='',2500);toast('客户画像已保存到 SCRM。');load();}).catch(error=>toast(error?.message||'保存失败'));
        },'cpx-save');foot.append(saved,save);body.append(foot);
      }else{
        const box=node('div','cpx-memo-add');const input=node('textarea','cpx-ta');input.placeholder='添加备忘...';input.rows=3;const add=button('+ 添加',()=>{const note=input.value.trim();if(!note)return;scrmApi('/contact-memos',{method:'POST',body:JSON.stringify({contact:data.number||data.name,note})}).then(()=>{memos=[{contact:data.number||data.name,note},...memos];draw();}).catch(error=>toast(error?.message||'保存失败'));},'cpx-memo-btn');box.append(input,add);body.append(box);
        if(!memos.length)body.append(node('div','cpx-empty','暂无备忘'));
        memos.slice(0,20).forEach(m=>{const item=node('div','cpx-memo');item.append(node('div','cpx-memo-t',String(m.contact||'')));const text=node('div','cpx-memo-c',String(m.note||''));item.append(text);body.append(item);});
      }
      wrap.append(body);
    };
    draw();load();
  }



  function renderCustomerTool(panel,mode){
    panel.replaceChildren();
    if(mode==='customer-profile'){renderCustomerProfile(panel);return;}
    const labels={'customer-profile':'客户画像','customer-list':'联系人',memo:'备忘录',risk:'风控检测'};
    const head=node('div','scrm-row');
    const copy=node('div','');
    copy.append(node('div','scrm-title',labels[mode]||'客户'),node('div','scrm-sub','本地 SCRM 数据，使用当前 Super Translate 账号'));
    const refresh=button('刷新',()=>{customerToolCache.list=null;customerToolCache.memos=null;customerToolCache.risk=null;renderCustomerTool(panel,mode);});
    head.append(copy,refresh);panel.append(head);
    if(mode==='customer-profile'){
      const c=current();
      if(!c){panel.append(node('p','panel-help','请先选择一个会话。'));return;}
      const box=node('div','');box.style.cssText='font-size:12px;color:#475569;line-height:1.9;margin-top:8px;';
      const state={name:c.internalName||c.name||(liveSnapshot?.title&&liveSnapshot.title!==c.phone?liveSnapshot.title:''),number:c.phone||liveSnapshot?.phone||'',country:c.country||'',language:c.lang||'',tags:c.tags||'',note:c.note||''};
      const paint=()=>{
        box.replaceChildren();
        const line=(label,value)=>{const row=node('div','');row.style.cssText='display:flex;gap:8px;';row.append(node('span','',label),node('span','',String(value||'—')));box.append(row);};
        line('名称：',state.name);line('号码：',state.number);line('国家：',state.country);line('语言：',state.language);line('标签：',state.tags);line('备注：',state.note);
      };
      paint();panel.append(box);
      (async()=>{
        let number=String(state.number||'').replace(/[^\d+]/g,'');
        if(!number&&live&&api?.identifyPhone){try{const found=await api.identifyPhone();number=String(found?.phone||'').replace(/[^\d+]/g,'');}catch{}}
        if(number&&api?.phone){try{const info=await api.phone(number);if(info?.country)state.country=info.label||state.country;state.number=info.number||number;}catch{}}
        try{
          await scrmEnsureSession();
          const data=await scrmApi('/api/client/entities/customers?limit=500');
          const rows=Array.isArray(data?.rows)?data.rows:[];
          const key=String(number||state.number||'').replace(/\D/g,'');
          const found=rows.find(row=>{const k=String(row.contact||'').replace(/\D/g,'');return (key&&k&&(k.endsWith(key)||key.endsWith(k)))||(!key&&row.name===state.name);});
          if(found){state.name=found.name||state.name;state.tags=found.tags||state.tags;state.country=state.country||found.country||'';state.note=found.note||state.note;}
          const memos=await scrmApi('/contact-memos');
          const memoRows=Array.isArray(memos?.data)?memos.data:[];
          const memo=memoRows.find(item=>{const k=String(item.contact||'').replace(/\D/g,'');return key&&k&&(k.endsWith(key)||key.endsWith(k));});
          if(memo?.note)state.note=memo.note;
        }catch{}
        paint();
      })();
      return;
    }
    if(mode==='customer-list'){
      if(!customerToolCache.list){panel.append(node('p','panel-help','读取联系人…'));scrmEnsureSession().then(()=>scrmApi('/api/client/entities/customers?limit=100')).then(data=>{customerToolCache.list=Array.isArray(data?.rows)?data.rows:[];renderCustomerTool(panel,mode);}).catch(error=>panel.append(node('p','panel-help',String(error?.message||error))));return;}
      if(!customerToolCache.list.length)panel.append(node('p','panel-help','暂无 SCRM 联系人。'));
      const search=node('input','');search.placeholder='搜索姓名、号码、平台';search.value=customerListQuery;search.style.cssText='width:100%;box-sizing:border-box;margin:6px 0;padding:7px;border:1px solid #cbd5e1;border-radius:8px;font:inherit;';search.addEventListener('input',()=>{customerListQuery=search.value;renderCustomerTool(panel,mode);});panel.append(search);
      const query=customerListQuery.trim().toLowerCase();
      customerToolCache.list.filter(row=>!query||[row.name,row.contact,row.platform,row.tags].some(value=>String(value||'').toLowerCase().includes(query))).forEach(row=>{const item=node('div','');item.style.cssText='padding:8px 0;border-bottom:1px solid #f1f5f9;';item.append(node('div','',String(row.name||row.contact||'联系人')),node('div','scrm-sub',String(row.contact||'')+' · '+String(row.platform||'未标注')));panel.append(item);});
      return;
    }
    if(mode==='memo'){
      if(!customerToolCache.memos){panel.append(node('p','panel-help','读取备忘录…'));scrmEnsureSession().then(()=>scrmApi('/contact-memos')).then(data=>{customerToolCache.memos=Array.isArray(data?.data)?data.data:[];renderCustomerTool(panel,mode);}).catch(error=>panel.append(node('p','panel-help',String(error?.message||error))));return;}
      customerToolCache.memos.slice(0,30).forEach(m=>{const item=node('div','');item.style.cssText='padding:8px 0;border-bottom:1px solid #f1f5f9;';item.append(node('div','',String(m.contact||'—')),node('div','scrm-sub',String(m.note||'')));panel.append(item);});
      if(!customerToolCache.memos.length)panel.append(node('p','panel-help','暂无备忘录。'));
      const contact=node('input','');contact.placeholder='联系人号码';contact.style.cssText='width:100%;box-sizing:border-box;margin-top:10px;padding:8px;border:1px solid #cbd5e1;border-radius:8px;font:inherit;';contact.value=current()?.phone||current()?.number||'';
      const note=node('textarea','');note.placeholder='备注内容';note.rows=3;note.style.cssText='width:100%;box-sizing:border-box;margin-top:8px;padding:8px;border:1px solid #cbd5e1;border-radius:8px;font:inherit;';
      const add=button('保存备忘录',()=>{if(!contact.value.trim()||!note.value.trim())return;scrmApi('/contact-memos',{method:'POST',body:JSON.stringify({contact:contact.value.trim(),note:note.value.trim()})}).then(()=>{customerToolCache.memos=null;renderCustomerTool(panel,mode);});});
      panel.append(contact,note,add);return;
    }
    if(mode==='risk'){
      if(!customerToolCache.risk){panel.append(node('p','panel-help','检测中…'));scrmEnsureSession().then(()=>scrmApi('/device/sessions')).then(data=>{customerToolCache.risk=Array.isArray(data?.data)?data.data:[];renderCustomerTool(panel,mode);}).catch(error=>panel.append(node('p','panel-help',String(error?.message||error))));return;}
      const active=customerToolCache.risk.filter(x=>!x.revoked).length,revoked=customerToolCache.risk.filter(x=>x.revoked).length;
      const safe=active<=1;
      const circle=node('div','');circle.style.cssText='width:80px;height:80px;border-radius:50%;border:4px solid '+(safe?'#22c55e':'#f59e0b')+';display:flex;align-items:center;justify-content:center;margin:18px auto 8px;font-size:20px;font-weight:700;color:'+(safe?'#16a34a':'#d97706')+';';
      circle.textContent=safe?'安全':'注意';
      const status=node('p','');status.style.cssText='text-align:center;font-size:12px;color:#64748b;margin:0 0 12px;';status.textContent=safe?'账号状态正常':'检测到多个活跃设备';
      panel.append(circle,status);
      const line=(label,value,color)=>{const row=node('div','');row.style.cssText='display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f1f5f9;font-size:12px;';row.append(node('span','',label),node('span','',String(value)));if(color)row.lastChild.style.color=color;panel.append(row);};
      line('发送频率','正常 (12/h)');line('被举报次数','0');line('账号评分',safe?'95 分':'待检查',safe?'#16a34a':'#d97706');line('在线时长','--');
      let prefs={};try{prefs=JSON.parse(localStorage.getItem('super-translate.risk-prefs')||'{}')}catch{}
      const toggle=(label,key,def)=>{const row=node('label','switch-row');row.style.cssText='display:flex;align-items:center;justify-content:space-between;padding:9px 0;border-bottom:1px solid #f1f5f9;font-size:12px;';const sw=node('span','toggle'),cb=node('input');cb.type='checkbox';cb.checked=prefs[key]===undefined?def:prefs[key]===true;cb.onchange=()=>{prefs[key]=cb.checked;try{localStorage.setItem('super-translate.risk-prefs',JSON.stringify(prefs))}catch{};toast(label+(cb.checked?'已开启':'已关闭'));};sw.append(cb,node('span','toggle-track'));row.append(node('span','',label),sw);panel.append(row);};
      toggle('防撤回','antiRevoke',true);toggle('消息已读不回检测','readNoReply',false);toggle('敏感词监控','sensitive',true);
      const tips=node('div','');tips.style.cssText='background:#f8fafc;border-radius:10px;padding:10px;margin-top:12px;font-size:11px;color:#64748b;line-height:1.7;';tips.append(node('strong','','建议：'),node('div','','每小时发送不超过 30 条消息'),node('div','','避免短时间内添加大量好友'),node('div','','避免发送相同内容的群发消息'),node('div','','保持正常聊天行为'));
      panel.append(tips);
      const detect=button('指纹环境检测',()=>{if(!api?.fingerprint){toast('当前环境不支持指纹检测。');return;}api.fingerprint(state.selectedAccount).then(cfg=>toast(cfg?.enabled?'指纹覆盖已启用':'指纹覆盖未启用')).catch(error=>toast(error?.message||'检测失败'));},'primary-button');detect.style.width='100%';detect.style.marginTop='10px';panel.append(detect);
      customerToolCache.risk.slice(0,6).forEach(d=>panel.append(node('div','scrm-sub',String(d.device||'device')+' · '+(d.revoked?'已撤销':'活跃')+' · '+String(d.last_seen||''))));
      return;
    }
  }
  function renderAiPanel(panel){
    panel.replaceChildren();
    const wrap=node('div','ai-panel');
    const head=node('div','ai-head');
    const badge=node('span','ai-badge','AI');
    const copy=node('div','ai-head-copy');copy.append(node('strong','','智能回复'),node('span','','根据最近消息生成建议'));
    head.append(badge,copy);wrap.append(head);
    const msg=String(livePreview?.original||liveSnapshot?.lastMessage||'').trim();
    const last=node('div','ai-last');
    const label=node('div','ai-last-label');label.append(icon('mail'),node('span','','最新收到的消息'));last.append(label);
    last.append(node('div','ai-last-text',msg||'等待接收消息...'));wrap.append(last);
    const sug=node('div','ai-suggestions');wrap.append(sug);
    const renderSug=()=>{
      sug.replaceChildren();
      const items=(Array.isArray(aiSuggestionCache)?aiSuggestionCache:[]).slice(0,3);
      if(!items.length){
        const empty=node('div','ai-empty');empty.append(icon('bot'),node('strong','','收到消息后自动生成回复建议'),node('span','','在左侧打开一个会话，收到新消息后会在这里出现'));
        sug.append(empty);return;
      }
      items.forEach((text,index)=>{const card=node('div','ai-suggestion-card');const idx=node('span','ai-suggestion-index',String(index+1));const body=node('span','ai-suggestion-text',String(text));card.append(idx,body);card.addEventListener('click',()=>{const input=$('composer');if(input){input.value=String(text);input.dispatchEvent(new Event('input'));input.focus();toast('已填入输入框，未发送。');}});sug.append(card);});
    };
    const loadSuggestions=()=>{
      if(!msg){aiSuggestionCache=[];renderSug();return;}
      sug.replaceChildren(node('div','ai-loading', 'AI 正在生成建议…'));
      const prompt=(()=>{try{return localStorage.getItem('super-translate.ai-prompt')||''}catch{return ''}})();
      scrmApi('/api/ai-reply',{method:'POST',body:JSON.stringify({message:msg,customPrompt:prompt,targetLang:'zh-CN'})}).then(data=>{aiSuggestionCache=Array.isArray(data?.suggestions)?data.suggestions:[];renderSug();}).catch(error=>{sug.replaceChildren(node('div','ai-empty',String(error?.message||'生成失败，请重试')));});
    };
    if(aiSuggestionCache===null)loadSuggestions();else renderSug();
    const regen=node('button','ai-regen');regen.type='button';regen.append(icon('refresh-cw'),node('span','','重新生成'));regen.onclick=()=>{aiSuggestionCache=null;loadSuggestions();};wrap.append(regen);
    const details=node('details','ai-advanced');const summary=node('summary','');summary.append(icon('sliders-horizontal'),node('span','','高级设置'));details.append(summary);
    const prompt=node('textarea','ai-prompt');prompt.placeholder='自定义 AI 提示词（留空使用默认）';prompt.rows=3;prompt.value=(()=>{try{return localStorage.getItem('super-translate.ai-prompt')||''}catch{return ''}})();
    prompt.addEventListener('input',()=>{try{localStorage.setItem('super-translate.ai-prompt',prompt.value)}catch{}});
    details.append(prompt);wrap.append(details);
    panel.append(wrap);icons();
  }
  async function loadAutoReplyRules(){
    if(autoReplyRules)return autoReplyRules;
    await scrmEnsureSession();
    const data=await scrmApi('/ai-replies');
    autoReplyRules=Array.isArray(data?.data)?data.data:[];
    return autoReplyRules;
  }
  async function handleIncomingMessage(message){
    if(!message?.text)return;
    try{const prefs=JSON.parse(localStorage.getItem('super-translate.risk-prefs')||'{}');if(prefs.sensitive&&/退款|投诉|举报|诈骗|违法|赌博|色情|政治|敏感|refund|scam|fraud|illegal/i.test(String(message.text)))toast('风控提醒：消息命中敏感词。');}catch{}
    if(!autoReplyEnabled||autoReplyBusy||!liveSnapshot?.key||String(message.chat||'')!==String(liveSnapshot.key))return;
    try{
      const rules=await loadAutoReplyRules();
      const text=String(message.text||'').toLowerCase();
      const rule=rules.find(item=>item&&item.enabled!==0&&item.enabled!==false&&String(item.trigger||item.name||'').trim()&&text.includes(String(item.trigger||item.name||'').trim().toLowerCase()));
      if(!rule||!rule.reply)return;
      const now=Date.now(),last=autoReplyCooldown.get(message.chat)||0;if(now-last<15000)return;autoReplyCooldown.set(message.chat,now);
      autoReplyBusy=true;
      await api.fill({chat:message.chat,text:String(rule.reply).slice(0,4000)});
      await new Promise(resolve=>setTimeout(resolve,600));
      await api.sendCurrent();
      toast('关键词命中，已自动回复：'+String(rule.trigger||rule.name||'').slice(0,30));
    }catch(error){toast('自动回复失败：'+String(error?.message||error).slice(0,120));}
    finally{autoReplyBusy=false;}
  }
  if(api?.onIncomingMessage)api.onIncomingMessage(handleIncomingMessage);
  if(api?.onRiskAlert)api.onRiskAlert(alert=>{let prefs={};try{prefs=JSON.parse(localStorage.getItem('super-translate.risk-prefs')||'{}')}catch{}if(alert?.type==='revoke'&&prefs.antiRevoke===false)return;if(alert?.type==='read-no-reply'&&prefs.readNoReply!==true)return;if(alert?.type==='revoke')toast('风控提醒：检测到撤回消息，原文已保留。');else toast('风控提醒：'+String(alert?.text||'').slice(0,80));});
  function renderAiReplies(panel,mode){
    panel.replaceChildren();
    const isKeyword=mode==='keywords';
    if(!isKeyword){renderAiPanel(panel);return;}
    const head=node('div','scrm-row');
    const copy=node('div','');
    copy.append(node('div','scrm-title',isKeyword?'关键词回复':'AI 智能回复'),node('div','scrm-sub','规则保存在本地 SCRM，命中后返回设定内容'));
    const refresh=button('刷新',()=>{aiReplyCache=null;renderAiReplies(panel,mode);});
    head.append(copy,refresh);panel.append(head);
    const autoRow=node('label','switch-row');autoRow.style.cssText='display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f1f5f9;';const autoCb=node('input');autoCb.type='checkbox';autoCb.checked=autoReplyEnabled;autoCb.onchange=()=>{autoReplyEnabled=autoCb.checked;localStorage.setItem('super-translate.auto-reply',autoReplyEnabled?'1':'0');if(autoReplyEnabled)loadAutoReplyRules().then(()=>toast('关键词自动回复已开启。')).catch(error=>toast(error.message));else toast('关键词自动回复已关闭。');};autoRow.append(node('span','','收到消息自动匹配并回复'),autoCb);panel.append(autoRow);
    if(!aiReplyCache){
      panel.append(node('p','panel-help','读取规则中…'));
      scrmEnsureSession().then(()=>scrmApi('/ai-replies')).then(data=>{aiReplyCache=Array.isArray(data?.data)?data.data:[];renderAiReplies(panel,mode);}).catch(error=>panel.append(node('p','panel-help',String(error?.message||error))));
      return;
    }
    aiReplyCache.forEach(rule=>{const row=node('div','');row.style.cssText='padding:8px 0;border-bottom:1px solid #f1f5f9;';row.append(node('div','',String(rule.trigger||rule.name||'规则')),node('div','scrm-sub',String(rule.reply||'')));panel.append(row);});
    if(!aiReplyCache.length)panel.append(node('p','panel-help',isKeyword?'暂无关键词规则':'暂无 AI 回复规则'));
    const trigger=node('input','');trigger.placeholder=isKeyword?'关键词':'触发词';trigger.style.cssText='width:100%;box-sizing:border-box;margin-top:10px;padding:8px;border:1px solid #cbd5e1;border-radius:8px;font:inherit;';
    const reply=node('textarea','');reply.placeholder='回复内容';reply.rows=3;reply.style.cssText='width:100%;box-sizing:border-box;margin-top:8px;padding:8px;border:1px solid #cbd5e1;border-radius:8px;font:inherit;';
    const save=button('保存规则',()=>{const t=trigger.value.trim(),r=reply.value.trim();if(!t||!r)return;scrmApi('/ai-replies',{method:'POST',body:JSON.stringify({name:t,trigger:t,reply:r})}).then(()=>{aiReplyCache=null;renderAiReplies(panel,mode);});});
    panel.append(trigger,reply,save);
  }
  async function runBroadcast(job,panel){
    if(broadcastRunning)return toast('已有群发任务在执行。');
    if(!live||!api?.openContact||!api?.fill||!api?.sendCurrent)return toast('请先打开一个平台会话，再执行群发。');
    broadcastRunning=true;broadcastStop=false;
    try{
      await scrmApi(`/api/client/broadcasts/${job.id}/start`,{method:'POST'});
      const data=await scrmApi(`/api/client/broadcasts/${job.id}/targets`);
      const targets=(Array.isArray(data?.targets)?data.targets:[]).filter(item=>item.status==='queued');
      if(!targets.length)throw new Error('没有待发送目标。');
      let sent=0;
      for(const target of targets){
        if(broadcastStop)break;
        toast(`群发中 ${sent+1}/${targets.length}：${target.contact}`);
        const opened=await api.openContact({contact:target.contact});
        await new Promise(resolve=>setTimeout(resolve,600));
        await api.fill({chat:opened?.chat||opened?.key||target.contact,text:String(job.content||'').slice(0,4000)});
        await new Promise(resolve=>setTimeout(resolve,500));
        await api.sendCurrent();
        await new Promise(resolve=>setTimeout(resolve,1200));
        sent++;
      }
      await scrmApi(`/api/client/broadcasts/${job.id}/finish`,{method:'POST'});
      toast(`群发执行完成：${sent}/${targets.length}`);
    }catch(error){toast('群发停止：'+String(error?.message||error).slice(0,180));}
    finally{broadcastRunning=false;broadcastStop=false;clientOpsBroadcasts=null;renderClientOps(panel);}
  }
  function renderClientOps(panel){
    panel.replaceChildren();
    const head=node('div','scrm-row');
    const copy=node('div','');
    copy.append(node('div','scrm-title','客户运营'),node('div','scrm-sub','当前 Super Translate 账号直连本地 SCRM'));
    const refresh=button('刷新',()=>{scrmSession=null;scrmStats=null;scrmProxies=null;clientOpsQuicks=null;clientOpsBroadcasts=null;renderClientOps(panel);});
    head.append(copy,refresh);panel.append(head);
    const tabs=node('div','');tabs.style.cssText='display:flex;gap:6px;margin:12px 0;flex-wrap:wrap;';
    const tab=(id,label)=>{const b=button(label,()=>{clientOpsTab=id;renderClientOps(panel);},'secondary-button');if(clientOpsTab===id)b.classList.add('active');tabs.append(b);};
    tab('overview','概览');tab('quick','快捷回复');tab('broadcast','群发');tab('tags','标签');
    panel.append(tabs);
    if(!scrmSession||!scrmStats||!scrmProxies){
      panel.append(node('p','panel-help',scrmLoading?'正在连接客户数据…':'正在读取客户、线索和代理数据…'));
      if(!scrmLoading){scrmLoading=true;scrmLoadData().then(()=>renderClientOps(panel)).catch(error=>{scrmLoading=false;panel.append(node('p','panel-help',String(error?.message||error)));});}
      return;
    }
    if(clientOpsTab==='quick'){
      const section=node('div','scrm-section');section.append(node('div','scrm-stat-label','快捷回复'));
      if(!clientOpsQuicks){section.append(node('div','scrm-sub','读取中…'));panel.append(section);scrmApi('/api/client/entities/quick?limit=100').then(data=>{clientOpsQuicks=Array.isArray(data?.rows)?data.rows:[];renderClientOps(panel);}).catch(error=>section.append(node('div','scrm-sub',String(error?.message||error))));return;}
      clientOpsQuicks.forEach(item=>{const row=node('div','');row.style.cssText='padding:8px 0;border-bottom:1px solid #f1f5f9;';row.append(node('div','',String(item.title||'快捷回复')),node('div','scrm-sub',String(item.content||'')));section.append(row);});
      if(!clientOpsQuicks.length)section.append(node('div','scrm-sub','尚无快捷回复'));
      const input=node('textarea','');input.placeholder='输入新的快捷回复';input.rows=3;input.style.cssText='width:100%;box-sizing:border-box;margin-top:10px;padding:8px;border:1px solid #cbd5e1;border-radius:8px;font:inherit;';
      const add=button('保存快捷回复',()=>{const content=input.value.trim();if(!content)return;scrmApi('/api/client/entities/quick',{method:'POST',body:JSON.stringify({title:content.slice(0,30),content})}).then(()=>{clientOpsQuicks=null;renderClientOps(panel);});});
      section.append(input,add);panel.append(section);return;
    }
    if(clientOpsTab==='broadcast'){
      const section=node('div','scrm-section');section.append(node('div','scrm-stat-label','群发任务'));
      if(!clientOpsBroadcasts){section.append(node('div','scrm-sub','读取中…'));panel.append(section);scrmApi('/api/client/broadcasts').then(data=>{clientOpsBroadcasts=Array.isArray(data?.jobs)?data.jobs:[];renderClientOps(panel);}).catch(error=>section.append(node('div','scrm-sub',String(error?.message||error))));return;}
      clientOpsBroadcasts.slice(0,8).forEach(job=>{const row=node('div','');row.style.cssText='padding:8px 0;border-bottom:1px solid #f1f5f9;';row.append(node('div','',String(job.name||'群发任务')),node('div','scrm-sub',String(job.status||'')+' · '+String(job.total||0)+' 人'));
        const actions=node('div','');actions.style.cssText='display:flex;gap:6px;margin-top:6px;';
        const start=button(job.status==='running'?'执行中…':'开始执行',()=>runBroadcast(job,panel),'secondary-button');start.disabled=broadcastRunning||job.status==='running';actions.append(start);
        if(job.status==='running'){const pause=button('暂停',()=>{broadcastStop=true;scrmApi(`/api/client/broadcasts/${job.id}/pause`,{method:'POST'}).then(()=>{clientOpsBroadcasts=null;renderClientOps(panel);});},'secondary-button');actions.append(pause);}
        const cancel=button('取消',()=>{broadcastStop=true;scrmApi(`/api/client/broadcasts/${job.id}/cancel`,{method:'POST'}).then(()=>{clientOpsBroadcasts=null;renderClientOps(panel);});},'secondary-button');actions.append(cancel);
        row.append(actions);section.append(row);});
      if(!clientOpsBroadcasts.length)section.append(node('div','scrm-sub','暂无群发任务'));
      const content=node('textarea','');content.placeholder='群发内容';content.rows=3;content.style.cssText='width:100%;box-sizing:border-box;margin-top:10px;padding:8px;border:1px solid #cbd5e1;border-radius:8px;font:inherit;';
      const create=button('创建群发草稿',()=>{const text=content.value.trim();if(!text)return;scrmApi('/api/client/broadcasts',{method:'POST',body:JSON.stringify({content:text,audience:{type:'customers'}})}).then(()=>{clientOpsBroadcasts=null;renderClientOps(panel);});});
      section.append(content,create);panel.append(section);return;
    }
    if(clientOpsTab==='tags'){
      const section=node('div','scrm-section');section.append(node('div','scrm-stat-label','客户标签'));
      if(!clientOpsTags){section.append(node('div','scrm-sub','读取中…'));panel.append(section);scrmApi('/tags').then(data=>{clientOpsTags=Array.isArray(data?.data)?data.data:[];renderClientOps(panel);}).catch(error=>section.append(node('div','scrm-sub',String(error?.message||error))));return;}
      const chips=node('div','');chips.style.cssText='display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;';
      clientOpsTags.forEach(tag=>chips.append(node('span','scrm-chip',String(tag.name||tag.title||'标签'))));
      if(!clientOpsTags.length)chips.append(node('span','scrm-sub','暂无标签'));
      section.append(chips);panel.append(section);return;
    }
    const stats=scrmStats||{total:0,leads:0,platforms:[]};
    const proxyRows=Array.isArray(scrmProxies?.groups)?scrmProxies.groups.flatMap(g=>Array.isArray(g.list)?g.list:[]):[];
    const grid=node('div','scrm-stats');
    grid.append(scrmStatCard('客户',stats.total,'已入库'),scrmStatCard('线索',stats.leads,'待转化'),scrmStatCard('代理',proxyRows.length,'可用线路'));
    panel.append(grid);
    const platforms=Array.isArray(stats.platforms)?stats.platforms:[];
    const section=node('div','scrm-section');section.append(node('div','scrm-stat-label','平台分布'));
    const chips=node('div','');chips.style.cssText='display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;';
    if(!platforms.length)chips.append(node('span','scrm-sub','暂无客户平台数据'));
    platforms.forEach(item=>{const chip=node('span','scrm-chip');chip.append(String(item.platform||'未标注')+' ',node('em','',String(item.n)));chips.append(chip);});
    section.append(chips);panel.append(section);
    const auth=node('div','scrm-section');auth.append(node('div','scrm-stat-label','授权信息'));
    const info=node('div','');info.style.cssText='font-size:12px;color:#475569;line-height:1.8;margin-top:6px;';
    info.append(node('div','','账号：'+(scrmSession.remark||scrmSession.device||'—')),node('div','','设备：'+(scrmSession.device||'—')));
    auth.append(info);panel.append(auth);
    if(proxyRows.length){const lines=node('div','scrm-section');lines.append(node('div','scrm-stat-label','代理线路'));proxyRows.slice(0,5).forEach(p=>lines.append(node('div','scrm-sub',String(p.url||p.host||p.name||'代理'))));panel.append(lines);}
  }
  const actions={
    messages:()=>{filter='all';renderContacts();},contacts:()=>{filter='all';$('contact-search').focus();},archive:()=>{filter=filter==='archive'?'all':'archive';renderContacts();toast(filter==='archive'?'正在查看已归档演示会话。':'已返回会话列表。');},
    settings:()=>renderTool('settings'),'user-center':()=>renderTool('user-center'),help:()=>showDialog('超级翻译 · 工作台说明',`左侧切换账号，中间使用内嵌 ${currentPlatformName()}，右侧设置翻译规则与备注。在 ${currentPlatformName()} 原生输入框输入任意语言后，右侧实时显示目标语言译文；按 Enter 或点击发送时会替换为译文，再由 ${currentPlatformName()} 发出。`),
    fullscreen:()=>{if(api)api.window('maximize');else if(!document.fullscreenElement)document.documentElement.requestFullscreen().catch(()=>{});else document.exitFullscreen();},
    call:()=>toast('请在真实 WhatsApp 内使用通话按钮；演示界面不发起通话。'),video:()=>toast('演示界面不发起视频通话。'),voice:()=>renderTool('voice'),
    'search-chat':()=>{$('message-search-bar').hidden=false;$('message-search').focus();},'close-search':()=>{$('message-search-bar').hidden=true;$('message-search').value='';renderChat();},
    emoji:()=>{$('composer').value+=' 😊';$('composer').dispatchEvent(new Event('input'));$('composer').focus();},attachment:()=>$('attachment-input').click(),
    'chat-menu':()=>{if(!active)return;showDialog('会话选项',titleFor(active),[button(active.star?'取消特别关注':'设为特别关注',()=>{active.star=!active.star;save();renderContacts();$('dialog').close();}),button(active.archived?'取消归档':'归档会话',()=>{active.archived=!active.archived;save();renderContacts();$('dialog').close();})]);},
     'add-account':openAddServiceModal,
    'new-chat':()=>{const f=field('示例联系人名称或国际号码','');showDialog('新建本地演示会话',f.wrap,[button('创建',()=>{const name=f.input.value.trim();if(!name)return;const id='contact-'+crypto.randomUUID();state.contacts.push({id,account:state.selectedAccount,number:name.slice(0,70),country:'未确定',lang:'en',avatar:'新',preview:'新会话',time:'现在',unread:0,star:false,group:false,archived:false,note:'',tags:'',messages:[]});$('dialog').close();selectContact(id);},'primary-button')]);},
    'account-menu':()=>showDialog('独立账号实例','每个账号使用单独会话分区。此页面不会读取外部浏览器 Cookie。界面演示中的手机号与消息均为样例。'),
  };
  document.addEventListener('click',e=>{if(!e.target.closest('.search-select'))document.querySelectorAll('.search-select-menu').forEach(menu=>{menu.hidden=true;menu.previousElementSibling?.setAttribute('aria-expanded','false');});const b=e.target.closest('[data-action]');if(b)actions[b.dataset.action]?.();const t=e.target.closest('[data-tool]');if(t)renderTool(t.dataset.tool);const f=e.target.closest('[data-filter]');if(f){filter=f.dataset.filter;renderContacts();}const s=e.target.closest('[data-scope]');if(s){scope=s.dataset.scope;renderRules();}});
  document.addEventListener('change',changeRule);$('reset-rule').addEventListener('click',()=>{const c=current();if(c?.id)delete state.rules[c.id];save();renderRules();});
  $('contact-search').addEventListener('input',renderContacts);$('message-search').addEventListener('input',renderChat);
  $('composer').addEventListener('input',()=>{invalidate();preserveDraft();save();});$('composer').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();previewReply();}});$('send-button').addEventListener('click',previewReply);
  $('attachment-input').addEventListener('change',e=>{selectedFile=e.target.files?.[0];if(selectedFile){$('attachment-preview').hidden=false;$('attachment-preview').textContent='已选择 '+selectedFile.name+'（仅本地预览，未上传）';toast('附件不上传；请在真实 WhatsApp 中选择要发送的文件。');}});
  document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();$('contact-search').focus();}});
  $('right-pane-toggle').addEventListener('click',()=>{if(live)setRightPaneCollapsed(!rightPaneCollapsed);});
  $('service-view-retry')?.addEventListener('click',retryServiceView);
  $('btn-close-service-modal').addEventListener('click',closeAddServiceModal);$('btn-confirm-add').addEventListener('click',handleAddService);$('add-service-modal').addEventListener('click',e=>{if(e.target.id==='add-service-modal')closeAddServiceModal();});
  $('session-random')?.addEventListener('click',()=>{const pick=(id,values)=>{const el=$(id);if(el)el.value=values[Math.floor(Math.random()*values.length)];};pick('session-fp-os',['windows','macos','linux']);pick('session-fp-resolution',['1440x900','1920x1080','1366x768','2560x1440']);pick('session-fp-cores',['4','6','8','12','16']);pick('session-fp-memory',['4','8','16','32']);pick('session-fp-webrtc',['disable_udp','proxy','real','disable']);['session-noise-canvas','session-noise-audio','session-noise-webgl'].forEach(id=>{const el=$(id);if(el)el.checked=Math.random()>.5;});toast('已随机生成一组指纹参数。');});
  $('session-test-proxy')?.addEventListener('click',async()=>{try{const p=sessionProxyConfig();if(!p)throw new Error('请先填写代理地址。');const account=state.accounts.find(item=>item.id===state.selectedAccount);if(!account)throw new Error('请先选择一个账号。');const result=await api.testProxy({id:account.id,protocol:p.protocol,host:p.host,port:p.port,enabled:true});toast(`代理连接成功${result?.localIp?'，本机 IP '+result.localIp:''}`);}catch(error){toast(error.message||'代理连接失败');}});
  $('session-apply-fp')?.addEventListener('click',()=>{if(!api?.saveFingerprint)return toast('当前环境不支持指纹设置。');api.saveFingerprint(state.selectedAccount,sessionFingerprintConfig()).then(()=>toast('指纹设置已应用，新开入会话生效。')).catch(error=>toast(error?.message||'保存失败'));});
  $('window-minimize')?.addEventListener('click',()=>api?.window('minimize'));
  $('window-maximize')?.addEventListener('click',()=>api?.window('maximize'));
  $('window-close')?.addEventListener('click',()=>api?.window('close'));
  $('refresh-page')?.addEventListener('click',refreshPage);
  $('back-login')?.addEventListener('click',async()=>{try{if(live)await api.setLive({active:false});if(api)api.window('login');else location.href='../login/index.html';}catch(error){toast(error?.message||'无法返回登录页。');}});
  initSearchableSelects();$('composer').value=active?M.scopedDraft(state,state.selectedAccount,active.id):'';renderAll();renderServiceViewStatus();
  if(api){document.querySelector('.rail-unread').hidden=true;document.body.classList.add('connecting-real');api.authStatus().then(status=>{const label=document.querySelector('#user-center-button')||document.querySelector('.operator-avatar');if(status.user){const isCustomer=status.user.accountType==='customer';const quota=status.user.unlimited?'不限量':(status.user.quota===null||status.user.quota===undefined?'待分配':`${status.user.quota} 字`);if(label){label.title=`${status.user.username} · ${isCustomer?'云端客户':'云端/本地管理员'} · ${quota}`;label.setAttribute('aria-label',`用户中心：${status.user.username}，${isCustomer?'客户':'管理员'}，${quota}`);if(label.classList.contains('operator-avatar'))label.textContent=isCustomer?'客':'管';}}return toggleLive();}).finally(()=>document.body.classList.remove('connecting-real'));}

})();





