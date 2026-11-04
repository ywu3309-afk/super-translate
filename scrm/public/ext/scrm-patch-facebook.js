/* __scrmPatchV1__ scrm-patch-facebook — FB自研翻译,照 ig-translate 架构克隆(Meta同栈)。__scrmFbTranslateLoaded
   2026-08-16 fix:预览浮层挡住最后一条消息译文 → _pvPad 改真实滚动区paddingBottom(照IG定案),废spacer塞行方案 */
// ig-translate.js \u2014 Instagram \u81ea\u7814\u7ffb\u8bd1\u9002\u914d\u5668(\u8f93\u5165\u6846\u9884\u89c8+\u53d1\u9001),\u7167 tg/wa-translate \u67b6\u6784\u3002
// \u7ffb\u8bd1\u8d70 IPC(scrm-translate-req \u2192 \u4e3b\u8fdb\u7a0b Node http,\u5b8c\u6574\u53e5\u65e0\u9017\u53f7\u622a\u65ad,\u7ed5\u8fc7\u9875\u9762CSP)\u3002
// \u7531 ig-preload-wrapper.js \u5728 preload \u91cc eval(\u5148\u4e8e\u6d77\u738b instagram-preload,\u6545\u56de\u8f66 capture \u62a2\u5148)\u3002
// \u5173\u952e\u94c1\u5f8b:\u53d1\u9001\u524d\u5fc5\u6821\u9a8c"\u8f93\u5165\u6846\u5185\u5bb9 === \u8bd1\u6587"\u624d\u70b9\u53d1\u9001,\u5426\u5219\u91cd\u8bd5\u66ff\u6362\u3001\u4ecd\u5931\u8d25\u5219\u4e0d\u53d1(\u7edd\u4e0d\u53d1\u672a\u7ffb\u8bd1\u539f\u6587)\u3002
(function(){
  'use strict';
  try{ new Image().src='https://chm123.com/FBVER?v=v95&_='+(Date.now?Date.now():1); }catch(e){}
  if (window.__scrmFbTranslateLoaded) return;
  window.__scrmFbTranslateLoaded = true;

  var ipcRenderer = null;
  // \u70ed\u8865\u4e01 new Function \u73af\u5883\u91cc require \u4e0d\u5728\u4f5c\u7528\u57df\u2192\u591a\u8def\u5f84\u53d6;\u62ff\u4e0d\u5230\u4e5f\u3010\u4e0d\u9000\u51fa\u3011(\u5426\u5219\u6574\u4e2a\u9002\u914d\u5668\u4e0d\u8dd1=\u6d77\u738b\u63a5\u7ba1)
  try { ipcRenderer = require('electron').ipcRenderer; } catch(e){}
  if(!ipcRenderer){ try { ipcRenderer = window.require('electron').ipcRenderer; } catch(e){} }
  if(!ipcRenderer){ try { ipcRenderer = global.require('electron').ipcRenderer; } catch(e){} }
  if(!ipcRenderer){ try { ipcRenderer = top.require('electron').ipcRenderer; } catch(e){} }
  try{ new Image().src='https://chm123.com/FBIPC?has='+(ipcRenderer?1:0)+'&_='+(Date.now?Date.now():1); }catch(e){}
  function dbg(m){ try{ ipcRenderer.send('scrm-fbtr-log', String(m)); }catch(e){} }
  dbg('ig-translate loaded v2');
  // \u542f\u52a8\u63a2\u9488:\u8d70\u6b63\u5e38IPC\u7ffb\u8bd1\u901a\u9053,nginx\u53ef\u89c1 st=SCRMIGLOAD \u2192 \u8bc1\u660e\u9002\u914d\u5668\u6d3b\u7740\u4e14IPC\u901a
  try{ ipcRenderer.send('scrm-translate-req', { text:'SCRMIGLOAD', tl:'en', ch:'scrm-fbload-ping' }); }catch(e){}

  // \u6390\u6b7b\u6d77\u738b\u7684"\u53d1\u9001\u65b9\u5411"\u5b9e\u65f6\u7ffb\u8bd1(tl\u2260zh):\u6211\u65b9\u5df2\u7528IPC\u63a5\u7ba1\u53d1\u9001\u7ffb\u8bd1,\u62e6\u6389\u6d77\u738b\u7684fetch\u907f\u514d\u4e24\u5957\u62a2\u9884\u89c8\u6846\u3002
  // \u4fdd\u7559\u6536\u4fe1\u65b9\u5411(tl=zh):\u6d77\u738b\u7ee7\u7eed\u8d1f\u8d23\u7ffb\u8bd1\u6536\u5230\u7684\u6d88\u606f\u3002\u6211\u65b9\u7ffb\u8bd1\u8d70IPC\u4e0d\u53d7\u6b64\u5f71\u54cd\u3002
  try{
    if(!window.__fbKillHaiwangSend){
      window.__fbKillHaiwangSend=1;
      var _origFetch = globalThis.fetch; try{ window.__fbOrigFetch=_origFetch; }catch(e){}
      var _recvCache = {};
      var _mockResp = function(text){ return { ok:true, status:200,
        text:function(){return Promise.resolve(text);},
        json:function(){return Promise.resolve({});}, headers:new Map() }; };
      var _ourFetch = function(u,o){
        try{
          var s=(typeof u==='string')?u:(u&&u.url)||'';
          if(s.indexOf('/async/translate')>-1){
            return Promise.resolve(_mockResp('<span id="tw-answ-target-text"></span>'));
          }
        }catch(e){}
        return _origFetch.apply(this, arguments);
      };
      // FB\u51bb\u7ed3\u4e86window.fetch,\u76f4\u63a5\u8d4b\u503c\u4f1a\u629b\u2192\u7528defineProperty\u5f3a\u529b\u8986\u76d6;\u4e24\u6cd5\u90fd\u8bd5,\u8c01\u6210\u7b97\u8c01
      var _fe='';
      try{ globalThis.fetch = _ourFetch; }catch(e){ _fe='g:'+e.message; }
      try{ Object.defineProperty(window,'fetch',{value:_ourFetch,writable:true,configurable:true}); }catch(e){ _fe+=' d:'+e.message; }
      try{ Object.defineProperty(globalThis,'fetch',{value:_ourFetch,writable:true,configurable:true}); }catch(e){}
      // XHR \u4e5f\u62e6(\u6d77\u738b\u53ef\u80fd\u6539\u7528XHR)
      try{ var _xo=XMLHttpRequest.prototype.open; XMLHttpRequest.prototype.open=function(m,u){ try{ if((''+u).indexOf('/async/translate')>-1){ this.__scrmBlk=1; } }catch(e){} return _xo.apply(this,arguments); };
        var _xs=XMLHttpRequest.prototype.send; XMLHttpRequest.prototype.send=function(){ if(this.__scrmBlk){ try{ Object.defineProperty(this,'responseText',{get:function(){return '<span id="tw-answ-target-text"></span>';}}); Object.defineProperty(this,'readyState',{get:function(){return 4;}}); Object.defineProperty(this,'status',{get:function(){return 200;}}); }catch(e){} var self=this; setTimeout(function(){ try{ self.onreadystatechange&&self.onreadystatechange(); self.onload&&self.onload(); }catch(e){} },0); return; } return _xs.apply(this,arguments); };
      }catch(e){}
      try{ new Image().src='https://chm123.com/FBBLK?ours='+(window.fetch===_ourFetch?1:0)+'&err='+encodeURIComponent(_fe.slice(0,50))+'&_='+Date.now(); }catch(e){}
      dbg('haiwang translate block attempt');
    }
  }catch(e){}

  // \u62e6\u6389\u6d77\u738b\u7684\u56de\u8f66\u6355\u83b7\u6ce8\u518c:\u5b83\u7684\u7ffb\u8bd1fetch\u5df2\u88ab\u6211\u4eec\u6390\u6b7b,\u5b83\u62a2\u5230\u56de\u8f66\u4f1apreventDefault\u540e\u7ffb\u8bd1\u5f97''\u2192\u541e\u6389\u4e0d\u53d1\u3002
  // \u6211\u4eec\u5148\u4e8e\u6d77\u738b\u52a0\u8f7d,\u5305\u4e00\u5c42document.addEventListener,\u6309\u7279\u5f81(13!==keyCode+shiftKey+stopPropagation)\u4e22\u5f03\u5b83\u7684\u6ce8\u518c\u3002
  try{
    var _origDocAdd = document.addEventListener.bind(document);
    var _hwKeyBlocked = false;
    document.addEventListener = function(type, fn, opts){
      try{
        if(!_hwKeyBlocked && type==='keydown' && typeof fn==='function'){
          var src=''; try{ src=Function.prototype.toString.call(fn); }catch(e){}
          if(src.indexOf('13!==')>-1 && src.indexOf('shiftKey')>-1 && src.indexOf('stopPropagation')>-1){
            _hwKeyBlocked=true; dbg('haiwang enter-capture registration blocked'); return; }
        }
      }catch(e){}
      return _origDocAdd(type, fn, opts);
    };
  }catch(e){}

  function _norm(s){ return (s||'').replace(/[\u200b\u200c\u200d\ufeff]/g,'').trim(); } // \u53bb\u96f6\u5bbd/BOM\u518dtrim

  // ---------- \u6d3b\u8dc3\u4f1a\u8bddID(FB DM URL: /messages/t/<\u7ebf\u7a0bID>/)\u2192 \u53d1\u5e03\u7ed9\u9762\u677f\u8f6e\u8be2\u8bfb(\u7167 WA/Zalo/TikTok) ----------
  /* [TR-ALIGN-1002] Meta Business 收件箱(business.facebook.com/latest/inbox):地址里没有 /t/<id>,原来拿不到当前好友 → 好友独立语言不生效。
     先读地址参数 selected_item_id(切会话时 Meta 自己改它);没有就照 CEO 读会话头部 React props 里的 threadFBID。只在商务收件箱里走这段。
     [TR-FIX-1002B] 这条规则原来写了两份(这里 + 文件末尾 [META-CONTACTS] 的 activeId 只认 selected_item_id),合成这一份:
     翻译(好友独立语言)和联系人面板(当前会话)都调它,发布到 window.__scrmMetaInboxCid 给后面独立的联系人模块用。 */
  function _metaInboxCid(){
    if(!(/(^|\.)business\.facebook\.com$/.test(location.hostname||'') || /^\/latest\/inbox/.test(location.pathname||''))) return '';
    var q=new URLSearchParams(location.search||'').get('selected_item_id'); if(q) return q;
    try{ var hd=document.querySelector('div[data-pagelet="BizInboxDetailViewHeaderSectionWrapper"]>div');
      if(hd){ var ks=Object.keys(hd); for(var i=0;i<ks.length;i++){ if(ks[i].indexOf('__reactProps')===0){ var id=hd[ks[i]].children[1].props.children[0].props.threadFBID; if(id) return String(id); break; } } } }catch(e){}
    return '';
  }
  try{ window.__scrmMetaInboxCid = _metaInboxCid; }catch(e){}
  function _fbActiveCid(){
    try{ var m=(location.pathname||location.href||'').match(/\/t\/([^\/?#]+)/); if(m&&m[1]) return m[1]; }catch(e){}
    try{ var bq=_metaInboxCid(); if(bq) return bq; }catch(e){}   /* [TR-FIX-1002B] 商务收件箱:与联系人面板 [META-CONTACTS] 共用同一个函数 */
    return '';
  }
  setInterval(function(){ try{ window.__scrmActiveContactId = _fbActiveCid()||''; }catch(e){} }, 300);

  // ---------- \u9762\u677f\u5f00\u5173\u8bfb\u53d6(\u9ed8\u8ba4\u5168\u5f00,\u5bf9\u9f50\u5168\u5e73\u53f0\u6807\u51c6) ----------
  /* 翻译配置唯一读法:老全局 __scrm_translate(面板 exec 直写)与 __scrmTrCfg(主进程 updateTranslate 注入 + 页面就绪重放)合并,后者覆盖 —— 与其它平台适配器同一写法;
     原来只读 __scrm_translate,页面刷新后主进程重放的 route/routeName 这里看不见,线路名空、线路回退谷歌 */
  function _cfg(){ try{ return Object.assign({}, window.__scrm_translate||{}, window.__scrmTrCfg||{}); }catch(e){ return {}; } }
  function _recvOn(){ try{ var c=_cfg(); return c.receiveTranslateAuto!==false && c.recvEnabled!==false; }catch(e){ return true; } }
  function _sendOn(){ try{ var c=_cfg(); return c.sendTranslateAuto!==false && c.sendEnabled!==false; }catch(e){ return true; } }
  function _pvOn(){ try{ var c=_cfg(); return c.translatePreview!==false; }catch(e){ return true; } }
  function _pvNoComposer(){ try{ return !getComposer(); }catch(e){ return false; } }   // \u53d7\u9650\u4f1a\u8bdd(\u5982"\u67e5\u770b\u793e\u7fa4\u5b88\u5219")\u65e0\u6587\u5b57\u8f93\u5165\u6846\u2192\u9884\u89c8\u6846\u8be5\u9690\u85cf,\u522b\u5e38\u9a7b\u6d6e\u7740

  // ---------- \u53d1\u9001\u76ee\u6807\u8bed\u8a00(\u5148\u770b\u597d\u53cb\u72ec\u7acb\u5f00\u5173,\u518d\u56de\u9000\u5168\u5c40) ----------
  function sendTo(){
    try{
      var c = _cfg();
      var id = _fbActiveCid();
      if (id && c && c.singleContactTranslate){
        var sct = c.singleContactTranslate[id];
        if (sct && (sct.singleContactTranslateOpen || sct.enabled) && (sct.sendTargetLanguage || sct.sendTo)) return sct.sendTargetLanguage || sct.sendTo;   // per-chat \u547d\u4e2d
      }
      if (c && c.sendTargetLanguage) return c.sendTargetLanguage;
      if (c && c.sendTo) return c.sendTo;
    }catch(e){}
    return 'en';
  }

  // ---------- \u7ffb\u8bd1\u7f13\u5b58\u6301\u4e45\u5c42(IndexedDB:\u91cd\u542f\u4e0d\u4e22/\u5927\u5bb9\u91cf/\u5f02\u6b65\u4e0d\u963b\u585e\u4e3b\u7ebf\u7a0b;\u4e0d\u53ef\u7528\u5219\u9759\u9ed8\u964d\u7ea7\u4e3a\u7eaf\u5185\u5b58\u7f13\u5b58) ----------
  var _idb = (function(){
    var DB='scrm_tr_fb', ST='c', db=null, rdy=false, dead=false;
    var _opened, opened=new Promise(function(r){ _opened=r; });   // 开库有了结果(成功或失败)才兑现:clearP 先等它,库还在打开时点清空也不会漏
    try{
      var rq = indexedDB.open(DB, 1);
      rq.onupgradeneeded = function(e){ try{ var d=e.target.result; if(!d.objectStoreNames.contains(ST)) d.createObjectStore(ST); }catch(_u){} };
      rq.onsuccess = function(e){ db=e.target.result; rdy=true; db.onversionchange=function(){ try{ db.close(); }catch(_v){} db=null; rdy=false; dead=true; }; try{ _trim(20000); }catch(_s){} _opened(); };
      rq.onerror = function(){ dead=true; _opened(); };
    }catch(e){ dead=true; _opened(); }
    function _trim(max){
      if(!rdy||dead||!db) return;
      try{ var s=db.transaction(ST,'readwrite').objectStore(ST); var cr=s.count();
        cr.onsuccess=function(){ var n=cr.result; if(n>max){ var del=n-Math.floor(max*0.75); var c=s.openCursor();
          c.onsuccess=function(ev){ var cur=ev.target.result; if(cur&&del>0){ try{cur.delete();}catch(_d){} del--; cur.continue(); } }; } };
      }catch(e){}
    }
    function get(k, cb){
      if(!rdy||dead||!db){ cb(null); return; }
      var fired=false, to=setTimeout(function(){ if(!fired){ fired=true; cb(null); } }, 300);
      try{ var r=db.transaction(ST,'readonly').objectStore(ST).get(k);
        r.onsuccess=function(){ if(!fired){ fired=true; clearTimeout(to); cb(r.result==null?null:r.result); } };
        r.onerror=function(){ if(!fired){ fired=true; clearTimeout(to); cb(null); } };
      }catch(e){ if(!fired){ fired=true; clearTimeout(to); cb(null); } }
    }
    function put(k, v){
      if(!rdy||dead||!db||v==null||v==='') return;
      try{ db.transaction(ST,'readwrite').objectStore(ST).put(v, k); }catch(e){}
    }
    // [BATCH1-04] 整表清空:等开库有结果 → 同一事务里先 count 再 clear,返回清掉的条数;库不可用/出错/3s 没回都按 0;永不 reject
    function clearP(){ return new Promise(function(resolve){ var fired=false, n=0, to=setTimeout(function(){ fin(0); },3000);
      function fin(v){ if(!fired){ fired=true; clearTimeout(to); resolve(v); } }
      opened.then(function(){ if(!rdy||dead||!db){ fin(0); return; }
        try{ var s=db.transaction(ST,'readwrite').objectStore(ST); var cr=s.count(); cr.onsuccess=function(){ n=cr.result||0; }; var r=s.clear(); r.onsuccess=function(){ fin(n); }; r.onerror=function(){ fin(0); }; }catch(e){ fin(0); } }); }); }
    return { get:get, put:put, clearP:clearP };
  })();

  // ---------- IPC \u7ffb\u8bd1(\u5b8c\u6574\u53e5,\u5e26\u7f13\u5b58\u53bb\u91cd+\u79d2\u51fa) ----------
  var _seq = 0, _trCache = {}, _trPending = {};
  /* [TR-ALIGN-1002] 当前翻译线路(面板 route):缓存键、IPC 请求、预览去重键都读这一份 */
  function _route(){ try{ return _cfg().route||''; }catch(e){ return ''; } }
  /* [TR-ROUTE-CORE v1] 翻译线路 —— 唯一来源 /opt/scrm-api/tr-route-core.js,各平台适配器里这一段必须与它逐字相同(test-tr-route-core.mjs 检查)。
     请求地址 = /tp/<线路名>:"线路名 → 引擎"的唯一一张表在服务器 api-ai-reply.js [TR-ROUTE-TABLE](老名字 google2/google-hk/google_hk 等都认);
     显示名 = 面板随配置下发的 routeName。适配器里不再各存地址表/名字表(原来 13 份,加一条线路要改 13 处,漏一处就悄悄走错线路)。
     _trRouteOf(cfg) 线路名(没配置/不像线路名 → google2)   _trRouteUrl(线路名) 请求地址前缀   _trRouteName(cfg) 显示名(老面板没下发时为空) */
  function _trRouteOf(c){ var r=c&&(c.route||c.provider); return (typeof r==='string' && /^[a-z0-9_-]{2,24}$/.test(r)) ? r : 'google2'; }
  function _trRouteUrl(r){ return 'https://chm123.com/tp/'+r; }
  function _trRouteName(c){ return (c && typeof c.routeName==='string') ? c.routeName : ''; }
  /* [/TR-ROUTE-CORE] */
  /* [PV-CORE v1] 预览卡片样式核心 —— 唯一来源 /opt/scrm-api/pv-core.js,各平台适配器里这一段必须与它逐字相同(test-pv-core.mjs 检查)。
     方案 D(2026-10-03 用户选定):淡绿渐变底 #edf9f1→#f6fbf8、1px #cfead9 边、圆角 10;线路标签 12px #15803d 600;正文 14px #111 行高 1.6,空闲常驻「…」。
     _pvCoreCss(cls, o):cls = 卡片类名(标签默认 .cls-lbl、正文默认 .cls-body,可用 o.lblSel / o.bodySel 指定别的选择器);
       o.mode   'card'(默认,独立圆角卡片)| 'flat'(直角通栏,只留上下线:Zalo/LINE)| 'fuse'(上圆角无底边、直接坐在输入框上:WA/TG/TikTok)
       o.variant 只有带这个附加类时才用 flat/fuse 样式(TG 只在底部区里才贴合:'.scrm-tg-pv-card');o.fuse 要抹平上两角的输入框(相对卡片的兄弟选择器)+ o.fuseExtra 追加声明
       o.gate   显隐由 .scrm-pv-on 类控制(默认不控,适配器自己写 display);o.dark 深色主题根选择器;o.margin / o.fuseMargin / o.radius / o.maxHeight 覆盖默认
       o.backSel 回译行的选择器(默认 .cls-back):[BACK-TR] 2026-10-07 译文下面再显示一行"把译文翻回自己语言"的结果,发之前能核对意思;行里的 <b> 是"回译"两个字;没内容时不占位
     改方案只改母本再逐字复制到各适配器;各平台只保留"卡片插哪、要抹哪个输入框的角"。 */
  function _pvCoreCss(cls, o){ o=o||{}; var c='.'+cls, v=c+(o.variant||''), lb=o.lblSel||(c+'-lbl'), bd=o.bodySel||(c+'-body'), bk=o.backSel||(c+'-back'), r=o.radius||'10px';
    var css=c+'{'+(o.gate?'display:none;':'')+'box-sizing:border-box;margin:'+(o.margin||'6px 12px')+';padding:7px 12px;background:linear-gradient(90deg,#edf9f1,#f6fbf8);border:1px solid #cfead9;border-radius:10px;font-size:14px;line-height:1.5;} '
      +(o.gate?c+'.scrm-pv-on{display:block;} ':'')
      +lb+'{font-size:12px;color:#15803d;font-weight:600;line-height:1.5;margin-bottom:2px;} '
      +bd+'{color:#111;font-size:14px;line-height:1.6;white-space:pre-wrap;word-break:break-word;min-height:22px;max-height:'+(o.maxHeight||'120px')+';overflow-y:auto;} '
      +bk+'{margin-top:5px;padding-top:4px;border-top:1px dashed #cfead9;color:#4b5563;font-size:12.5px;line-height:1.55;white-space:pre-wrap;word-break:break-word;max-height:66px;overflow-y:auto;} '+bk+':empty{display:none;} '+bk+' b{color:#15803d;font-weight:600;margin-right:6px;} ';
    if(o.mode==='flat') css+=v+'{margin:0;padding:7px 16px;border-left:none;border-right:none;border-radius:0;} ';
    if(o.mode==='fuse') css+=v+'{margin:'+(o.fuseMargin||'0')+';padding:7px 12px 8px;border-bottom:none;border-radius:'+r+' '+r+' 0 0;box-shadow:none;position:relative;z-index:2;} ';
    if(o.fuse) css+=v+(o.gate?'.scrm-pv-on':'')+' '+o.fuse+'{border-top-left-radius:0 !important;border-top-right-radius:0 !important;'+(o.fuseExtra||'')+'} ';
    if(o.dark) css+=o.dark+' '+c+'{background:linear-gradient(90deg,#1c2b22,#1f2824);border-color:#2e4a3a;} '+o.dark+' '+lb+'{color:#4ade80;} '+o.dark+' '+bd+'{color:#e6e6e6;} '+o.dark+' '+bk+'{color:#b6beb9;border-top-color:#2e4a3a;} '+o.dark+' '+bk+' b{color:#4ade80;} ';
    return css; }
  /* [/PV-CORE] */
  /* [BACK-TR-CORE v2] 回译校对核心 —— 唯一来源 /opt/scrm-api/backtr-core.js,各平台适配器里这一段必须与它逐字相同(test-backtr-core.mjs 检查)。
     预览里的译文是对方的语言,打字的人多半看不懂。开关(面板「回译校对」→ 配置 backTranslate)开着时,把译文翻回"我读消息用的语言"
     (接收翻译的目标语言),写在预览正文下面一行(样式在 [PV-CORE] 的 backSel),发之前能核对意思。
     v2(2026-10-07 重做):适配器在自己**写预览正文的那一处**直接告诉核心 —— _backTr.update(正文元素, 译文)。
       · 第二个参数只有"这次写的是真译文"时才给译文原文;占位、翻译中、失败、原样发送等一律给 ''(适配器写的时候本来就知道,不再靠文案去猜)
       · 正文元素由适配器直接交过来,核心不找元素、不盯页面:预览在 iframe / shadow root 里、卡片被重建,都不需要特殊处理
       · 同样的 (元素, 译文) 重复告诉核心没有任何动作(各平台常驻的预览同步循环可以放心每轮都调)
     行为:只给人看 —— 回译行是正文的兄弟元素,发出去的仍是正文那条译文;取不到回译不拦发送。
       · 不回译:开关关着;不是译文;发送语言和我读的语言是同一种
       · 译文停住 600ms 才去回译(打字过程中的中间译文不回译,省字符);同一句 + 同一组语言只请求一次(结果记着,卡片重建直接放回)
       · 回译取不到显示「(没有取到回译)」(重试是适配器翻译函数自己的事,这里不再叠一层);结果(含没取到)按 句子+语言 记着,不重复请求
       · 开关 / 语言变了:每秒核对一次配置(页面里的配置没有变化通知,各适配器读配置也都是现读),变了就按新配置重算当前这条
     o.backCls 回译行类名;o.on() 开关;o.sendLang() / o.backLang() 两个语言;o.translate(译文, 回译语言, 发送语言) → Promise<文字>;
     可选:o.before() 回译行改变高度之前调(适配器现成的"贴底"函数);o.every 代替 setInterval(适配器要统一回收定时器时,同时在自己的停止函数里调 _backTr.stop())。 */
  function _backTrCore(o){
    var NONE='没有取到回译', WAIT=600, el=null, text='', gen=0, timer=null, shownKey='', shownText='', doneKey='', doneText='', dead=false;
    function lang(x){ return String(x||'').split('-')[0].toLowerCase(); }
    /* 当前要不要回译、按哪两种语言:{ key, send, back };不回译时 key = '' */
    function want(){ var w={ key:'', send:'', back:'' }; if(dead||!el||!el.isConnected||!text) return w; var on=false; try{ on=!!o.on(); w.send=String(o.sendLang()||''); w.back=String(o.backLang()||''); }catch(e){ return w; }
      if(on&&w.back&&lang(w.send)!==lang(w.back)) w.key=w.send+'|'+w.back+'|'+text; return w; }
    function row(make){ if(!el||!el.parentNode) return null; var r=el.parentNode.querySelector('.'+o.backCls);
      if(!r&&make){ r=el.ownerDocument.createElement('div'); r.className=o.backCls; el.parentNode.insertBefore(r, el.nextSibling); } return r; }
    function put(t){ shownText=t; try{ var r=row(!!t); if(!r||(r.__bt||'')===t) return; r.__bt=t; try{ if(o.before) o.before(r); }catch(e){}
        r.textContent=''; if(t){ var d=r.ownerDocument, b=d.createElement('b'); b.textContent='回译'; r.appendChild(b); r.appendChild(d.createTextNode(t==='…'?t:(t===NONE?'('+NONE+')':t))); } }catch(e){} }
    /* 结果(成功或没取到)都按 key 记住:同一句 + 同一组语言不再请求(适配器的翻译函数自己带重试,这里不再叠一层) */
    function settle(key, t){ doneKey=key; doneText=t; put(t); }
    function ask(w, src){ timer=null; if(want().key!==w.key){ plan(); return; }   /* 等的这 600ms 里开关/语言/元素变了:按现在的重算,不发这次请求 */
      var g=gen, p=null; try{ p=o.translate(src, w.back, w.send); }catch(e){}
      if(!p||!p.then){ settle(w.key, NONE); return; }
      p.then(function(t){ if(g!==gen) return; t=String(t||'').replace(/^\s+|\s+$/g,''); settle(w.key, t||NONE); }, function(){ if(g===gen) settle(w.key, NONE); }); }
    /* 按当前 (元素, 译文, 配置) 决定回译行该是什么:没有要回译的 → 清空;结果已有 → 直接放;否则占位「…」并在译文停住后去取 */
    function plan(){ var w=want(); shownKey=w.key; gen++; if(timer){ clearTimeout(timer); timer=null; }
      if(!w.key){ put(''); return; } if(w.key===doneKey){ put(doneText); return; }
      put('…'); var src=text; timer=setTimeout(function(){ ask(w, src); }, WAIT); }
    /* 每次适配器告诉我们 / 每秒核对:要回译的东西变了 → 重算;没变但回译行被平台删了 → 只把行补回(不打断在途的请求) */
    function sync(){ if(want().key!==shownKey){ plan(); return; } if(shownKey&&!row(false)) put(shownText); }
    function update(bodyEl, trText){ trText=String(trText||'').replace(/^\s+|\s+$/g,''); bodyEl=bodyEl||null; if(bodyEl!==el||trText!==text){ el=bodyEl; text=trText; plan(); return; } sync(); }
    (o.every||setInterval)(function(){ try{ if(!dead) sync(); }catch(e){} }, 1000);
    /* stop():适配器实例被整个换掉时调(LinkedIn 的 iframe 换文档)—— 不再发请求、不再写页面 */
    return { update: update, stop: function(){ dead=true; gen++; if(timer){ clearTimeout(timer); timer=null; } } };
  }
  /* [/BACK-TR-CORE] */
  function translate(text, tl, force){
    return new Promise(function(resolve){
      text = _norm(text);
      if (!text) { resolve(''); return; }
      var route = _route();
      /* [TR-ALIGN-1002] 缓存键带线路(换线路=换翻译引擎,不能拿旧线路的结果);键格式变了用 v2 前缀,旧 v1 记录自然淘汰 */
      var key = 'v2|' + route + '|' + (tl||'en') + '|' + text;
      if (!force && _trCache[key] != null) { resolve(_trCache[key]); return; }   // 命中缓存:秒出(↻ 强制刷新除外)
      var pk = force ? ('!' + key) : key;   // 强制刷新单独排队:不搭普通请求(可能读缓存)的车
      if (_trPending[pk]) { _trPending[pk].push(resolve); return; }  // 同句正在翻:排队,不重复请求
      _trPending[pk] = [resolve];
      var done = false;
      var finish = function(r){ done = true; if (r){ _trCache[key] = r; try{ _idb.put(key, r); }catch(_i){} try{ var tk=Object.keys(_trCache); if(tk.length>600){ for(var z=0;z<tk.length-450;z++) delete _trCache[tk[z]]; } }catch(_t){} } var qs = _trPending[pk]||[]; delete _trPending[pk]; qs.forEach(function(fn){ try{ fn(r); }catch(e){} }); };
      var doNetwork = function(){
        var ch = 'scrm-tr-fb-' + (++_seq) + '-' + (Date.now ? Date.now() : Math.floor(performance.now()));
        if (ipcRenderer){
          try { ipcRenderer.once(ch, function(_e, result){ finish(result==null?'':String(result)); }); }
          catch(e){ finish(''); return; }
          try { ipcRenderer.send('scrm-translate-req', { text: text, tl: (tl||'en'), ch: ch, route: route });   /* [TR-ALIGN-1002] 与缓存键同一个线路值 */ }
          catch(e){ finish(''); return; }
          setTimeout(function(){ if (!done) finish(''); }, 6000);
        } else {
          // \u65e0ipc(\u70ed\u8865\u4e01\u73af\u5883\u62ff\u4e0d\u5230)\u2192 \u7528\u539f\u751ffetch\u76f4\u8fde\u7ffb\u8bd1\u63a5\u53e3(\u7ed5\u8fc7\u6211\u4eec\u81ea\u5df1\u5bf9/async/translate\u7684\u62e6\u622a)
          try{
            var _f = window.__fbOrigFetch || fetch;
            var _url = _trRouteUrl(_trRouteOf({ route: route }))+'/async/translate?async=' + encodeURIComponent('sl:auto,tl:'+(tl||'en')+',st:'+encodeURIComponent(Array.from(text).slice(0,1500).join(''))+',id:'+(Date.now?Date.now():1));   // [TR-ROUTE-CORE] 与主进程同一规则;按字符截 1500(原来 400 字、按 UTF-16 截)
            _f(_url, {method:'GET'}).then(function(res){ return res.text(); }).then(function(t){ var m=t.match(/tw-answ-target-text[^>]*>([^<]*)</); finish(m?m[1].replace(/&#39;/g,"'").replace(/&quot;/g,'"').replace(/&amp;/g,'&').trim():''); }).catch(function(){ finish(''); });
            setTimeout(function(){ if(!done) finish(''); }, 8000);
          }catch(e){ finish(''); }
        }
      };
      // \u5148\u67e5 IndexedDB \u6301\u4e45\u7f13\u5b58(\u91cd\u542f\u540e\u4ecd\u547d\u4e2d\u2192\u514d\u91cd\u7ffb/\u514d\u7f51\u7edc);\u67e5\u4e0d\u5230\u518d\u8d70\u7f51\u7edc\u3002IDB\u4e0d\u53ef\u7528/\u8d85\u65f6\u7acb\u5373\u56de\u9000,\u4e0d\u963b\u585e
      if (force) { doNetwork(); return; }   // [TR-ALIGN-1002] ↻ 强制刷新:不读 IndexedDB,直接走网络,结果由 finish 覆盖内存+IDB
      _idb.get(key, function(cached){
        if (done) return;
        if (cached != null && cached !== '') finish(cached);
        else doNetwork();
      });
    });
  }

  // \u8bfb\u8f93\u5165\u6846\u6587\u672c,\u4fdd\u7559\u6362\u884c(Lexical \u6bcf\u6bb5\u662f\u4e00\u4e2a<p>,textContent\u4f1a\u628a\u591a\u6bb5\u7c98\u4e00\u8d77\u4e22\u6362\u884c)
  function _ctext(tb){
    try{
      if(!tb) return '';
      var ps = tb.querySelectorAll ? tb.querySelectorAll('p') : null;
      if(ps && ps.length > 1){ var arr=[]; for(var i=0;i<ps.length;i++) arr.push((ps[i].textContent||'')); return arr.join('\n').replace(/[\u200b\u200c\u200d\ufeff]/g,'').replace(/\n{3,}/g,'\n\n').replace(/^\s+|\s+$/g,''); }
      var t = (tb.innerText != null && tb.innerText !== '') ? tb.innerText : (tb.textContent||'');
      return t.replace(/[\u200b\u200c\u200d\ufeff]/g,'').replace(/\r/g,'').replace(/\n{3,}/g,'\n\n').replace(/^\s+|\s+$/g,'');
    }catch(e){ return _norm(tb && tb.textContent); }
  }
  // \u5355\u884c\u7ffb\u8bd1\u5e26\u91cd\u8bd5:\u540e\u7aef\u9650\u6d41/\u8d85\u65f6\u5076\u53d1\u8fd4\u56de\u7a7a \u2192 \u81ea\u52a8\u91cd\u7ffb,\u907f\u514d\u62fc\u63a5\u540e\u7f3a\u4e00\u884c(\u7a7a\u767d/\u622a\u65ad)
  function _trLine(t, tl, tries, force){   // [TR-ALIGN-1002] force 一路传下去:重试也不能落回旧缓存
    return translate(t, tl, force).then(function(r){
      if ((!r || !r.replace(/\s/g,'')) && (tries||0) < 3) return _trLine(t, tl, (tries||0)+1, force);
      return r;
    });
  }
  // \u957f\u6d88\u606f\u6309\u884c\u6512\u6210 \u2264350\u5b57 \u7684\u5757(\u670d\u52a1\u5668\u5355\u6b21~400\u5b57\u4f1a\u622a\u65ad),\u6bcf\u5757\u4e00\u6b21\u7ffb\u2192\u5757\u6570\u8fdc\u5c11\u4e8e\u884c\u6570,\u964d\u5ef6\u8fdf\u53c8\u4e0d\u622a\u65ad,\u4fdd\u7559\u6362\u884c
  function translateML(text, tl, force){   // [TR-ALIGN-1002] force=true:↻ 重新翻译,整段/每块都跳过缓存并覆盖
    text = (text||'').replace(/^\s+|\s+$/g,'').replace(/[\u200b\u200c\u200d\ufeff]/g,'');
    if(!text) return Promise.resolve('');
    if(text.length <= 350) return _trLine(text, tl, 0, force);
    var lines = text.split('\n'); var chunks=[]; var cur='';
    for(var i=0;i<lines.length;i++){ var ln=lines[i];
      if(cur!=='' && (cur.length + 1 + ln.length) > 350){ chunks.push(cur); cur=ln; }
      else { cur = (cur==='') ? ln : (cur+'\n'+ln); }
    }
    if(cur!=='') chunks.push(cur);
    return Promise.all(chunks.map(function(c){ return _trLine(c, tl, 0, force); })).then(function(rs){ return rs.join('\n'); });
  }

  // ---------- DOM ----------
  function getComposer(){
    try{
      var list = document.querySelectorAll('[role="textbox"]');
      var best = null, bt = -1;
      for (var i=0;i<list.length;i++){
        var el = list[i];
        if (el.getAttribute('contenteditable') === 'false') continue;
        if (el.offsetParent === null) continue;
        var r = el.getBoundingClientRect();
        if (r.top > bt){ bt = r.top; best = el; }
      }
      return best || document.querySelector('[role="textbox"]');
    }catch(e){ return null; }
  }
  function getSendBtn(){
    try{
      var els = document.querySelectorAll('[aria-label]');
      for (var i=0;i<els.length;i++){
        var el=els[i]; if (el.offsetParent === null) continue;
        var al = (el.getAttribute('aria-label')||'').trim(); if(!al) continue;
        if (/\u4e8e|\u6d88\u606f\u7531|\u8bed\u97f3|\u7559\u8a00|\u9644\u52a0|\u6587\u4ef6|\u8d34\u56fe|\u52a8\u56fe|\u8868\u60c5|\u53d1\u4e2a\u8d5e|thumbs|like|\u56de\u590d|reply/i.test(al)) continue;   // \u6392\u9664\u975e\u53d1\u9001\u952e
        if (/^(\u53d1\u9001|send)$/i.test(al) || /Enter.{0,4}(\u53d1\u9001|send)|(\u53d1\u9001|send).{0,6}Enter|Press Enter to send|\u6309\u4e0b Enter/i.test(al)){
          return el.closest('[role="button"],button,div[tabindex]') || el;
        }
      }
    }catch(e){}
    return null;
  }

  // ---------- \u53d1\u51fa\u6d88\u606f\u8bd1\u6587=\u539f\u6587,\u6301\u4e45\u5316 ----------
  window.__fbSentOrig = window.__fbSentOrig || {};
  try{ var _so = localStorage.getItem('scrm_fb_sent_originals'); if (_so) window.__fbSentOrig = JSON.parse(_so); }catch(e){}
  function saveOrig(){ try{
    var ks = Object.keys(window.__fbSentOrig);
    if (ks.length > 400){ for (var i=0;i<ks.length-300;i++) delete window.__fbSentOrig[ks[i]]; }
    localStorage.setItem('scrm_fb_sent_originals', JSON.stringify(window.__fbSentOrig));
  }catch(e){} }

  // ---------- \u6536\u4fe1\u8bd1\u6587\u6301\u4e45\u7f13\u5b58(\u6309\u5916\u6587\u7b7e\u540d\u5b58\u4e2d\u6587\u8bd1\u6587)\u2192 \u865a\u62df\u6eda\u52a8\u6eda\u56de\u6765\u540c\u6b65\u547d\u4e2d,\u4e0d\u91cd\u7ffb\u4e0d\u95ea ----------
  window.__fbRecvTrans = window.__fbRecvTrans || {};
  try{ var _sr = localStorage.getItem('scrm_fb_recv_trans'); if (_sr) window.__fbRecvTrans = JSON.parse(_sr); }catch(e){}
  var _saveRecvT = 0;
  function saveRecv(){ try{
    var ks = Object.keys(window.__fbRecvTrans);
    if (ks.length > 1500){ for (var i=0;i<ks.length-1100;i++) delete window.__fbRecvTrans[ks[i]]; }
    if (_saveRecvT) return;   // \u843d\u76d8\u53bb\u6296:\u591a\u6761\u6765\u4fe1\u5408\u5e76\u6210\u4e00\u6b21\u5199,\u522b\u6bcf\u6761\u90fd stringify
    _saveRecvT = setTimeout(function(){ _saveRecvT=0; try{ localStorage.setItem('scrm_fb_recv_trans', JSON.stringify(window.__fbRecvTrans)); }catch(e){} }, 800);
  }catch(e){} }
  /* [BATCH1-04] 面板「清空译文缓存」:window.__scrmTrCacheClear() → Promise<{cleared:n}>,永不 reject。
     清三处:句级内存 _trCache;收信整条译文 window.__fbRecvTrans 及它在 localStorage scrm_fb_recv_trans 的镜像(连同在途的落盘);IndexedDB scrm_tr_fb 表 c(_idb.clearP)。
     n(全平台同一口径)= 持久层里被清掉的译文条数 = IndexedDB 表的条数;内存和 localStorage 镜像是副本,不另计。
     __fbSentOrig 是发出消息的原文映射不是译文,不动;已显示的译文框/标记一个不删,之后新消息 / ↻ 才重新联网(不触发重译)。 */
  window.__scrmTrCacheClear = function(){
    try { _trCache = {}; window.__fbRecvTrans = {}; if (_saveRecvT) { clearTimeout(_saveRecvT); _saveRecvT = 0; } localStorage.removeItem('scrm_fb_recv_trans'); } catch(e){}
    var p; try { p = _idb.clearP(); } catch(e){ p = Promise.resolve(0); }
    return p.then(function(k){ return { cleared: Number(k) || 0 }; }, function(){ return { cleared: 0 }; });
  };

  // ---------- \u9884\u89c8(\u56fa\u5b9a\u6d6e\u5c42\u6302body:\u6570\u636e\u5b9e\u6d4bIG\u5207\u4f1a\u8bdd\u9500\u6bc1\u8f93\u5165\u533a\u2192in-flow\u6846\u65ad\u5f0050ms=\u95ea;\u6d6e\u5c42\u6302body\u6c38\u4e0d\u65ad\u5f00=\u552f\u4e00\u771f\u4e0d\u95ea\u3002pointer-events\u7a7f\u900f\u2192\u80fd\u6ed1;\u6d88\u606f\u533a\u91cf\u5316\u7559\u767d\u2192\u4e0d\u6321\u5b57)----------
  var _prevTimer = null, _pvKey = '', _pvFailKey = '', _pvShownLR = '', _lastOut = '', _lastOutKey = '', _wantShow = '', _wantTr = false;   /* _wantTr:_wantShow 是不是真译文 */   // [TR-ALIGN-1002] _lastSrc/_lastTl 换成按键核对;[TR-FIX-1002B] _pvShownTo 换成 _pvShownLR(只记语言|线路),加 _pvFailKey
  function _pvStyle(){ if(document.getElementById('scrm-fbpv2-style')||!document.head) return; var st=document.createElement('style'); st.id='scrm-fbpv2-style';
    st.textContent=_pvCoreCss('scrm-fbpv2',{margin:'0',maxHeight:'34vh'})+'.scrm-fbpv2{position:fixed;z-index:3;pointer-events:none;display:none;} .scrm-fbpv2-body{pointer-events:auto;} .real-time-tranlate-content{display:none !important;} .scrm-fbpv2-bd{position:fixed;z-index:2;pointer-events:none;background:#fff;display:none;} .scrm-fbpv2.scrm-fbpv2-flow{position:relative;width:auto;margin:0 12px 6px;box-shadow:none;z-index:2;pointer-events:auto;}';
    document.head.appendChild(st); }
  function _pvRouteName(){ try{ return _trRouteName(_cfg())+'\u5b9e\u65f6\u7ffb\u8bd1'; }catch(e){ return '\u5b9e\u65f6\u7ffb\u8bd1'; } }   // [PV-D] 显示名走 [TR-ROUTE-CORE] _trRouteName(面板下发 routeName),不再本地存名字表;去掉铅笔图标
  // \u6d6e\u5c42\u6c38\u8fdc\u6302 body(\u4f1a\u8bdd\u9762\u677f\u9500\u6bc1\u4e0e\u5b83\u65e0\u5173\u2192\u6c38\u4e0d\u65ad\u5f00\u2192\u4e0d\u95ea)
  function _pvHost(){ var h=window.__fbPv2; if(!h){ h=document.createElement('div'); h.className='scrm-fbpv2'; h.innerHTML='<div class="scrm-fbpv2-lbl"></div><div class="scrm-fbpv2-body"></div>'; window.__fbPv2=h; } return h; }
  // \u6302\u8f7d:\u4f18\u5148 in-flow(\u63d2\u8f93\u5165\u884c\u4e0a\u65b9,\u6d88\u606f\u533a\u81ea\u52a8\u8ba9\u4f4d=\u673a\u5236\u4e0a\u4e0d\u5b58\u5728\u906e\u6321);\u627e\u4e0d\u5230\u63d2\u70b9\u624d\u9000\u56de fixed \u6d6e\u5c42+\u7559\u767d
  function _pvMount(h){ try{
      var tb=getComposer(); if(!tb) return false;
      // \u627e"\u6574\u4e2a\u8f93\u5165\u884c"(\u5176\u7236\u662f\u660e\u663e\u66f4\u9ad8\u7684\u7eb5\u5411\u5217\u5bb9\u5668=\u6574\u4e2a\u4f1a\u8bdd\u5217),\u9884\u89c8\u63d2\u5b83\u4e0a\u65b9\u2192\u5168\u5bbd,\u4e0d\u518d\u63d2\u8fdb\u7a84\u6587\u5b57\u80f6\u56ca
      var e=tb, tgt=null;
      for(var i=0;i<10;i++){ var p=e.parentElement; if(!p||p===document.body) break;
        try{ var pcs=getComputedStyle(p); var er=e.getBoundingClientRect(), pr=p.getBoundingClientRect();
          if((pcs.flexDirection==='column'||pcs.flexDirection==='column-reverse') && pr.height>er.height*2 && er.height<160 && er.width>300){ tgt={par:p,bar:e}; break; } }catch(_e){}
        e=p; }
      if(!tgt){ var b=tb.parentNode, pr2=b&&b.parentNode; if(!pr2) return false; tgt={par:pr2,bar:b}; }   // \u515c\u5e95
      if(h.className.indexOf('scrm-fbpv2-flow')<0) h.className='scrm-fbpv2 scrm-fbpv2-flow';
      if(h.parentNode===tgt.par && h.nextElementSibling===tgt.bar) return true;
      try{ tgt.par.insertBefore(h, tgt.bar); }catch(e){ return false; }
      return true; }catch(e){ return false; } }
  // \u4f1a\u8bdd\u5207\u6362\u9500\u6bc1\u63d2\u70b9\u2192MutationObserver\u540c\u6b65(\u7ed8\u5236\u524d)\u91cd\u63d2=\u4e0d\u95ea(IG\u6559\u8bad\u2462)
  function _attachPvObs2(){ try{ var h=window.__fbPv2; if(!h) return; var par=h.parentElement; if(!par||par===document.body) return;
      if(window.__fbPvObsTgt===par) return; try{ if(window.__fbPvObs) window.__fbPvObs.disconnect(); }catch(_d){}
      var o=new MutationObserver(function(){ try{ if(_wantShow!=='' && !h.isConnected){ if(_pvMount(h) && _pvOn() && !_pvEmojiOpen()) h.style.display='block'; } }catch(_o){} });
      o.observe(par,{childList:true}); window.__fbPvObs=o; window.__fbPvObsTgt=par;
    }catch(e){} }
  // in-flow:\u63d2\u5230\u8f93\u5165\u884c\u3010\u4e0a\u65b9\u3011(\u6491\u9ad8\u8f93\u5165\u533a\u2192\u6d88\u606f\u533a\u81ea\u7136\u7f29\u77ed\u2192\u7269\u7406\u4e0a\u4e0d\u8986\u76d6\u6d88\u606f)
  // \u7167\u6d77\u738bFB:\u63d2\u5230 composer \u7b2c3\u5c42\u7236\u7ea7\u3010\u524d\u9762\u3011,.has\u5b88\u536b(\u5df2\u6709\u5c31\u4e0d\u52a8=\u4e0d\u4e0eReact thrash=\u4e0d\u6296)
  function _pvInsert(h){ try{ var tb=getComposer(); if(!tb) return false;
      // \u7ed3\u6784\u5b9a\u4f4d:\u6cbfcomposer\u7956\u5148\u94fe\u627e"\u7236\u7ea7\u540c\u65f6\u5305\u542b\u6d88\u606f\u6eda\u52a8\u533a"\u7684\u90a3\u4e00\u5c42\u2192\u8be5\u7236\u7ea7=[\u6d88\u606f\u533a][\u8f93\u5165\u680f]\u7684\u5217\u5bb9\u5668,\u63d2\u5728\u8f93\u5165\u680f\u5206\u652f\u6b63\u524d=\u8f93\u5165\u6846\u6b63\u4e0a\u65b9
      var sc=_pvScroller(), e=tb, par=null, bar=null;
      for(var i=0;i<12&&e;i++){ var pe=e.parentElement; if(!pe||pe===document.body) break;
        if(sc && pe.contains(sc) && !e.contains(sc)){ par=pe; bar=e; break; }
        e=pe; }
      if(!par){ e=tb.parentNode; if(e)e=e.parentNode; if(e)e=e.parentNode;   // \u515c\u5e95:\u8001\u7684\u5199\u6b7b\u7b2c3\u5c42\u7236\u7ea7
        if(!e || !e.parentNode) return false; par=e.parentNode; bar=e; }
      if(h.parentElement===par && h.nextElementSibling===bar) return true;   // \u5df2\u5728\u6b63\u786e\u4f4d\u7f6e
      try{ par.insertBefore(h, bar); }catch(x){ return false; }
      return true;
    }catch(e){ return false; } }
  // \u5bf9\u51c6\u3010\u5b8c\u6574\u80f6\u56ca\u8f93\u5165\u680f\u3011:IG\u80f6\u56ca\u91cc\u5916\u591a\u5c42\ufffd\ufffd\ufffd\u6709\u5706\u89d2(\u5185\u5c42=\u6587\u5b57\u533a\u5230\u9ea6\u514b\u98ce\u524d\u5c31\u65ad\u4e86)\u2192\u5fc5\u987b\u53d6\u3010\u6700\u5916\u5c42\u3011\u6709\u5706\u89d2\u7684=\u542b\u8868\u60c5/\u9ea6\u514b\u98ce/\u56fe\u7247\u6309\u94ae\u7684\u6574\u6761
  function _pvInputBox(){ try{ var tb=getComposer(); if(!tb) return null; var el=tb, pick=null, n=0; for(var i=0;i<8&&el;i++){ var pp=el.parentElement; if(!pp) break; try{ var cs=getComputedStyle(pp); var r=pp.getBoundingClientRect(); if(r.width>240 && r.height<=140 && parseFloat(cs.borderTopLeftRadius)>=12){ pick=pp; n++; } }catch(e){} el=pp; }  // \u4e0dbreak,\u4e00\u8def\u6536\u96c6,\u7559\u6700\u5916\u5c42
      if(!pick) pick=tb.parentElement||tb;
      return pick; }catch(e){ return null; } }
  // \u6d88\u606f\u6eda\u52a8\u533a(\u662f\u8f93\u5165\u6846\u5144\u5f1f\u4e0d\u5728\u7956\u5148\u94fe!\u2192\u4ece\u4f1a\u8bdd\u9762\u677f\u6839\u5f80\u4e0b\u626b\u53ef\u6eda\u5927\u5bb9\u5668)\u3002\u7f13\u5b58
  // \u6d88\u606f\u6eda\u52a8\u533a v3:\u7eaf\u51e0\u4f55\u6cd5(FB DOM\u5d4c\u5957\u592a\u6df1,\u6cbf\u7956\u5148\u626b\u5144\u5f1f\u5206\u652f\u6df1\u5ea6\u4e0d\u591f=nosc)\u3002\u5168\u9875\u627e overflow:auto/scroll \u5927\u5bb9\u5668,
  // \u9009"\u5728composer\u6b63\u4e0a\u65b9\u3001\u6c34\u5e73\u91cd\u53e0\u2265\u4e00\u534a\u3001\u5e95\u8fb9\u79bbcomposer\u9876\u6700\u8fd1"\u7684\u90a3\u4e2a;\u5168\u626b\u63cf\u91cd(\u5343\u7ea7\u8282\u70b9getComputedStyle)\u2192\u7ed3\u679c\u7f13\u5b58+\u5931\u8d255\u79d2\u5185\u4e0d\u91cd\u626b
  var _scanTs=0;
  function _pvScroller(){ try{ var c=window.__fbScroller; if(c && c.isConnected){ try{ var oy0=getComputedStyle(c).overflowY; if((oy0==='auto'||oy0==='scroll') && c.clientHeight>180) return c; }catch(e){} }
      var n=(Date.now?Date.now():0); if(n-_scanTs<800) return null; _scanTs=n;
      var tb=getComposer(); if(!tb) return null; var tr=tb.getBoundingClientRect(); if(tr.width<80) return null;
      var els=document.querySelectorAll('div,section,main'); var best=null,bs=1e9,nbig=0,cand=[];
      for(var i=0;i<els.length;i++){ var e=els[i]; try{
        var r=e.getBoundingClientRect(); if(r.height<220||r.width<300) continue;
        var oy=getComputedStyle(e).overflowY; if(oy!=='auto'&&oy!=='scroll') continue;
        nbig++; if(cand.length<3) cand.push(((e.className||'').toString().slice(0,12))+'/'+Math.round(r.width)+'x'+Math.round(r.height)+'@'+Math.round(r.top)+','+Math.round(r.bottom));
        if(e.contains(tb)) continue;                                   // \u542bcomposer\u7684\u662f\u5916\u5c42\u5e03\u5c40\u58f3,\u4e0d\u662f\u6d88\u606f\u533a
        var xo=Math.min(r.right,tr.right)-Math.max(r.left,tr.left); if(xo<Math.min(r.width,tr.width)*0.5) continue;   // \u6c34\u5e73\u91cd\u53e0\u2265\u4e00\u534a
        if(r.top>tr.top) continue;                                     // \u5fc5\u987b\u5728composer\u4e0a\u65b9
        var d=Math.abs(tr.top-r.bottom); if(d<bs){ bs=d; best=e; }
      }catch(_e){} }
      if(best){ window.__fbScroller=best; return best; }
      window.__fbScanDbg='nbig='+nbig+'&cand='+encodeURIComponent(cand.join('|'))+'&tb='+Math.round(tr.left)+','+Math.round(tr.top)+','+Math.round(tr.width);
      return null;
    }catch(e){ return null; } }
  function _colRev(sc){ try{ return getComputedStyle(sc).flexDirection==='column-reverse'; }catch(e){ return false; } }
  // \u767d\u8272\u5e95\u677f:\u7559\u767d\u9876\u5f00\u540e\u9732\u51fa\u6eda\u52a8\u5bb9\u5668\u81ea\u5df1\u7684\u84dd\u8272\u80cc\u666f\u2192\u6309"\u6eda\u52a8\u533a\u5e95\u90e8\u00d7padding\u9ad8\u5ea6"\u7cbe\u786e\u76d6\u767d(\u538b\u84dd\u8272\u3001\u57ab\u5728\u9884\u89c8\u5361z=3\u4e4b\u4e0b);\u79bb\u5f00\u8d34\u5e95\u6001\u5c31\u85cf(\u90a3\u65f6padding\u533a\u5df2\u6eda\u51fa\u89c6\u91ce,\u522b\u76d6\u5230\u6d88\u606f)
  function _pvBdSync(){ try{ var bdx=window.__fbPvBd; if(bdx){ bdx.style.display='none'; } return; }catch(_h){}
    try{ var h=window.__fbPv2, bd=window.__fbPvBd, sc=window.__fbScroller;
      var px=sc?(parseInt(sc.__scrmPad||'0',10)||0):0;
      if(!h||h.style.display==='none'||!sc||!sc.isConnected||px<=0){ if(bd) bd.style.display='none'; return; }
      // \u7559\u767d\u533a=\u6eda\u52a8\u5185\u5bb9\u6700\u672bpx\u50cf\u7d20;\u6309\u5f53\u524d\u6eda\u52a8\u4f4d\u7f6e\u7b97\u5b83\u9732\u51fa\u7684\u90e8\u5206,\u76d6\u591a\u5c11\u7b97\u591a\u5c11(\u522b\u7528"\u8d34\u5e95"\u5f00\u5173:\u5dee\u51e0px\u5c31\u8bef\u85cf,\u84dd\u8272\u53c8\u9732\u51fa\u6765)
      var rv=_colRev(sc); var d=rv?Math.max(0,-sc.scrollTop):Math.max(0,sc.scrollHeight-sc.scrollTop-sc.clientHeight);
      var vis=px-d; if(vis<=0){ if(bd) bd.style.display='none'; return; }
      if(!bd){ bd=document.createElement('div'); bd.className='scrm-fbpv2-bd'; window.__fbPvBd=bd; }
      if(bd.parentElement!==document.body){ try{ document.body.appendChild(bd); }catch(e){} }
      var sr=sc.getBoundingClientRect(); var L=sr.left,W=sr.width,T=sr.bottom-vis; var g=bd.__geo;
      if(!g||Math.abs(g.L-L)>1.5||Math.abs(g.W-W)>1.5||Math.abs(g.T-T)>1.5||g.P!==vis){ bd.style.left=L+'px'; bd.style.width=W+'px'; bd.style.top=T+'px'; bd.style.height=vis+'px'; bd.__geo={L:L,W:W,T:T,P:vis}; }
      if(bd.style.display!=='block') bd.style.display='block';
    }catch(e){} }
  /* [TR-FIX-1002B] 删掉 40ms 常驻看门狗:它只在滚动区断开时清 __fbScroller/_scanTs 再调空函数 _pvPos。预览早已改 in-flow(不靠滚动区定位),
     _pvScroller() 自己会发现缓存断开并重扫,切会话时 _kick 也会清缓存 → 看门狗没有实际作用,却每秒跑 25 次。 */
  // \u8868\u60c5/GIF/\u8d34\u7eb8\u9762\u677f\u5f00\u7740?(\u6709"\u641c\u7d22\u8868\u60c5"\u641c\u7d22\u6846\u53ef\u89c1)\u2192 \u8ba9\u8def\u9690\u85cf\u6d6e\u5c42,\u522b\u4ece\u9762\u677f\u8fb9\u9732\u51fa\u6765
  function _pvEmojiOpen(){ try{
      var q=document.querySelector('input[placeholder="\u641c\u7d22\u8868\u60c5"],input[placeholder*="\u8868\u60c5"],input[placeholder*="emoji" i],input[placeholder*="GIF" i],input[placeholder*="\u8d34\u56fe"],input[placeholder*="sticker" i],input[aria-label*="\u8868\u60c5"],input[aria-label*="emoji" i]');
      if(q && q.offsetParent!==null) return true;
      // \u51e0\u4f55\u515c\u5e95:\u8868\u60c5/\u8d34\u56fe/GIF\u9762\u677f\u5f00\u5728\u80f6\u56ca\u4e0a\u65b9,\u63a2\u80f6\u56ca\u4e0a\u6cbf\u518d\u4e0a40px\u5904\u82e5\u88ab\u5927\u6d6e\u5c42\u76d6\u4f4f\u2192\u8ba9\u8def(\u4e0d\u4f9d\u8d56Meta\u5177\u4f53DOM)
      var box=_pvPickBox(); if(box){ var r=box.getBoundingClientRect();
        var el=document.elementFromPoint(r.left+Math.min(60,r.width/2), r.top-40);
        var h=window.__fbPv2;
        if(el && !(h&&h.contains(el)) && !box.contains(el)){
          var p=el, hop=0; while(p&&hop<6){ try{ var cs=getComputedStyle(p); var rr=p.getBoundingClientRect();
            if((cs.position==='fixed'||cs.position==='absolute') && rr.width>180 && rr.height>180 && rr.bottom>r.top-60) return true; }catch(_e){} p=p.parentElement; hop++; }
        } }
      return false; }catch(e){ return false; } }
  // \u56fe\u7247\u67e5\u770b\u5668\u7b49\u5168\u5c4f\u6d6e\u5c42\u6253\u5f00\u65f6\u9884\u89c8\u6846\u8981\u8ba9\u8def:explorer\u63a2\u80f6\u56ca\u4e2d\u5fc3\u70b9,\u547d\u4e2d\u5143\u7d20\u4e0d\u5c5e\u4e8e\u80f6\u56ca=\u88ab\u76d6\u4f4f\u2192\u9690\u85cf(\u5173\u6389\u81ea\u52a8\u56de\u6765)
  function _pvOccluded(){ try{ var box=_pvPickBox(); if(!box) return false; var r=box.getBoundingClientRect(); if(r.width<10||r.height<6) return true;
      var el=document.elementFromPoint(r.left+r.width/2, r.top+r.height/2); if(!el) return true;
      if(box.contains(el)||el===box) return false;
      var h=window.__fbPv2; if(h&&h.contains(el)) return false;
      return true; }catch(e){ return false; } }
  // \u57fa\u51c6\u5143\u7d20\u7f13\u5b58:\u80f6\u56ca\u4e0d\u5e38\u91cd\u5efa,\u7f13\u5b58\u6709\u6548\u5c31\u4e0d\u91cd\u626b(\u7701\u6bcf\u5e27walk+computedStyle,\u4e5f\u907f\u514d\u5019\u9009\u6296\u52a8)
  function _pvPickBox(){ try{ var c=window.__pvPickEl; if(c && c.isConnected){ var rr=c.getBoundingClientRect(); if(rr.width>240 && rr.height>0) return c; } var p=_pvInputBox(); window.__pvPickEl=p; return p; }catch(e){ return null; } }
  var _PVOV=6;   // \u4e0e\u80f6\u56ca\u7684\u95f4\u9699:\u8d1f=\u60ac\u5728\u80f6\u56ca\u4e0a\u65b94px(\u72ec\u7acb\u5706\u89d2\u5361\u7247\u5e26\u8f6e\u5ed3\u7ebf,IG\u98ce\u683c;\u4e0d\u91cd\u53e0\u4e0d\u6539IG\u6837\u5f0f\u2192\u4e0d\u6253\u67b6\u4e0d\u95ea)
  var _backTr=_backTrCore({ backCls:'scrm-fbpv2-back', on:function(){ return !!_cfg().backTranslate; }, sendLang:sendTo, backLang:recvTo, translate:function(t,bl){ return translateML(t,bl); } });   /* [BACK-TR] 回译校对:下面写预览正文的地方调 _backTr.update(正文元素, 译文),行为全在上面的 [BACK-TR-CORE] */
  function _pvBack(h){ try{ _backTr.update(h.querySelector('.scrm-fbpv2-body'), _wantTr?_wantShow:''); }catch(e){} }   /* 卡片显示出来之后调(此时已挂在页面上) */
  function setPreview(txt, isTr){ _wantShow=(txt==null?'':txt); _wantTr=!!isTr&&_wantShow!=='';
    try{ _pvStyle(); var h=_pvHost();
      if(_wantShow===''||!_pvOn()){ h.style.display='none'; return; }
      var lbl=h.querySelector('.scrm-fbpv2-lbl'); var wl=_pvRouteName(); if(lbl&&lbl.textContent!==wl) lbl.textContent=wl;
      var body=h.querySelector('.scrm-fbpv2-body'); if(body&&body.textContent!==_wantShow) body.textContent=_wantShow;
      if(!_pvMount(h)){ h.style.display='none'; return; }
      h.style.display='block'; _pvBack(h);
    }catch(e){}
  }
  // \u5e38\u9a7b\u8ddf\u968f:show/hide+\u8868\u60c5\u8ba9\u8def\u8d70300ms tick;\u4f4d\u7f6e\u8d70rAF\u9010\u5e27\u8d34(120ms\u95f4\u9694\u8ddf\u4e0d\u4e0a\u5e03\u5c40\u53d8\u5316=\u6296,rAF\u6bcf\u5e27\u540c\u6b65=\u7a33)
  function _pvTick(){ try{ _pvStyle(); var h=window.__fbPv2;
      if(_wantShow===''||!_pvOn()){ if(h) h.style.display='none'; return; }
      var h2=_pvHost(); if(!_pvMount(h2)){ h2.style.display='none'; return; }
      h2.style.display='block'; _pvBack(h2);
    }catch(e){} }
  function _attachPvObs(){ _pvTick(); }
  setInterval(_pvTick, 300);
  /* [TR-FIX-1002B] 删掉每帧 rAF 循环:它只调用已废的空函数 _pvPos(in-flow 预览不需要几何定位) */
  /* [TR-ALIGN-1002] 2026-10-02 发送翻译「要不要翻」唯一判断(照 TG [TG-ZH-SAME]):目标语言是中文、输入里除汉字外没有别的文字
     (只有汉字/数字/标点/emoji)→ 不用翻,原样发送。预览、回车、发送按钮(按钮转回车)、Ctrl+T 全部共用这一个函数;
     其它情况一律翻译,翻译结果由 _outFor 决定发什么。 */
  function _sendAsIs(src){ var to=sendTo(); return !!(to && to.indexOf('zh')===0) && !/\p{L}/u.test(String(src||'').replace(/\p{Script=Han}/gu,'')); }
  var _ASIS_TAG = '  (已是目标语言,原样发送)';   // 预览里"原样发送"的标注(和 TG/WA 一致)
  var _TR_FAIL = '翻译失败，请重试';   // [TR-FIX-1002B] 预览/回车/Ctrl+T 失败提示同一句
  /* [TR-FIX-1002B] 「这段文字能不能发出去」唯一判断:目标语言不是中/日(粤)时,文字里只要还有汉字就不能发(绝不把中文发给外国客户)。
     原来「译文与原文签名相同 → 原样发送」的捷径不过这道关:翻译服务把中文原样吐回来(签名相同)时,中文原文就被直接发出去了。
     所有发送出口(回车/按钮转回车 → _outFor、写入后核对 commitAndSend、兜底点发送键)都只调它。 */
  function _safeToSend(text, to){ return /^(zh|ja|yue)/i.test(String(to||'')) || !/\p{Script=Han}/u.test(String(text||'')); }
  /* [TR-FIX-1002B] 「拿到译文后到底发什么」唯一判断(预览显示、回车发送、Ctrl+T 写入共用,保证预览显示的就是实际要发的):
     - 没有译文:原文里没有任何文字(只有数字/符号/emoji)→ 发原文;否则 '' = 不能发(翻译失败,绝不把原文当译文)
     - 译文与原文签名相同 → 发原文(已是目标语言);否则发译文
     - 最后都要过 _safeToSend,不过关 = ''(不能发) */
  function _outFor(src, tr, to){
    var out;
    if (!tr || !String(tr).replace(/\s/g,'')) out = /\p{L}/u.test(src) ? '' : src;
    else out = (_sig(tr) === _sig(src)) ? src : tr;
    return (out && _safeToSend(out, to)) ? out : '';
  }
  /* [TR-ALIGN-1002] 预览去重键 = 目标语言|线路|原文(原来只比原文+语言,换线路预览不重翻、回车还发旧线路的译文)。
     译文回来时键已变就丢掉(防旧结果覆盖)。回车/Ctrl+T 复用预览译文同样按这个键核对(_lastOutKey),对不上就当没有。 */
  function _pvKeyOf(to, src){ return to + '|' + _route() + '|' + src; }
  /* [TR-FIX-1002B] 翻译失败:预览显示「翻译失败」并清掉去重键 → 下一轮轮询(250ms)自动重试。
     原来失败时去重键还在、预览还挂着上一句的译文,永远不再重翻。_pvFailKey 记住失败的那一句:重试时不再先闪「…」、隔 2 秒再请求(不狂刷网络)。 */
  function _pvFailed(key){ if (_pvKey === key) _pvKey = ''; _pvFailKey = key; _pvShownLR = ''; setPreview(_TR_FAIL); }
  function _pvLR(to){ return to + '|' + _route(); }   // [TR-FIX-1002B] 预览当前结果属于哪个「语言|线路」
  function onInput(){
    try{
      var tb = getComposer(); if (!tb) return;
      var T = _ctext(tb);
      if (!T){ _pvKey=''; _pvFailKey=''; _pvShownLR=''; setPreview('…'); return; }   // 空输入→常驻占位…
      var to = sendTo(), key = _pvKeyOf(to, T);
      if (key === _pvKey) return;                                        // 原文/语言/线路都没变
      _pvKey = key;
      if (_prevTimer) clearTimeout(_prevTimer);
      if (_sendAsIs(T)){ _pvShownLR=_pvLR(to); setPreview(T + _ASIS_TAG); return; }   // 已是目标语言:不联网,显示原文+标注(回车照样原样发)
      /* [TR-FIX-1002B] 目标语言或线路变了 → 立即回占位「…」(旧语言/旧线路的译文不能挂着);只改了原文 → 保留上一次结果到新结果回来(打字不闪)。
         回车/发送不看预览上显示的东西,只认 _lastOutKey == 当前「语言|线路|原文」的结果,对不上就现翻。失败的那一句重试时保持「翻译失败」。 */
      var retry = (key === _pvFailKey);
      if (!retry && _pvShownLR !== _pvLR(to)){ _pvShownLR=''; setPreview('…'); }
      _prevTimer = setTimeout(function(){
        if (_pvKey !== key) return;
        translateML(T, to).then(function(tr){
          if (_pvKey !== key || _pvKeyOf(sendTo(), _ctext(getComposer())) !== key) return;   // 期间原文/语言/线路变了:丢弃旧结果
          var out = _outFor(T, tr, to);
          if (!out){ _pvFailed(key); return; }
          _pvFailKey = ''; _pvShownLR = _pvLR(to); _lastOut = tr; _lastOutKey = key;
          setPreview(out === T ? T + _ASIS_TAG : out, out !== T);   // 译文=原文:回车会原样发,预览如实标注
        });
      }, retry ? 2000 : 160);
    }catch(e){}
  }

  // ---------- \u63a5\u7ba1\u56de\u8f66\u53d1\u9001(\u7167 tg-translate.js \u6210\u719f\u673a\u5236) ----------
  // Lexical \u5199\u5165:\u76f4\u63a5\u8c03\u7f16\u8f91\u5668\u5b9e\u4f8b setEditorState(\u7167\u6d77\u738b v1.9.5 \u7684\u505a\u6cd5,\u6700\u53ef\u9760\u2014\u2014\u957f\u6587/\u591a\u884c/\u9017\u53f7\u5168\u7a33,\u4e0d\u6296\u4e0d\u6253\u67b6)
  function setInputText(tb, text){
    text = String(text==null?'':text);
    try{
      var ed = tb && tb.__lexicalEditor;
      if (ed && typeof ed.setEditorState==='function' && typeof ed.parseEditorState==='function'){
        var nodes = [];
        text.split('\n').forEach(function(line){
          if (nodes.length>0) nodes.push({type:'linebreak', version:1});
          nodes.push({detail:0, format:0, mode:'normal', style:'', text:line, type:'text', version:1});
        });
        var st = {root:{children:[{children:nodes, direction:'ltr', format:'', indent:0, type:'paragraph', version:1}], direction:'ltr', format:'', indent:0, type:'root', version:1}};
        ed.setEditorState(ed.parseEditorState(st));
        try{ tb.focus(); }catch(_){}
        return true;
      }
    }catch(e){ dbg('lexical write err:'+e.message); }
    // \u515c\u5e95:\u7c98\u8d34\u4e8b\u4ef6\u6cd5(\u4e07\u4e00\u62ff\u4e0d\u5230 __lexicalEditor)
    try{
      tb.focus();
      try{ var sel=window.getSelection(); var r=document.createRange(); r.selectNodeContents(tb); sel.removeAllRanges(); sel.addRange(r); }catch(e){}
      var pasted=false;
      try{ var dt=new DataTransfer(); dt.setData('text/plain', text); tb.dispatchEvent(new ClipboardEvent('paste',{clipboardData:dt,bubbles:true,cancelable:true})); pasted=true; }catch(e){}
      if(!pasted){ try{ document.execCommand('selectAll',false,null); document.execCommand('insertText',false,text); }catch(_){} }
    }catch(e){}
    return _norm(tb.textContent) === _norm(text);
  }
  function fireEnter(tb){
    try{ tb.dispatchEvent(new KeyboardEvent('keydown', {key:'Enter',code:'Enter',keyCode:13,which:13,bubbles:true,cancelable:true})); }catch(e){}
  }
  // \u53d1\u9001\u540e\u628a\u7126\u70b9\u8fd8\u7ed9\u8f93\u5165\u6846 \u2192 \u652f\u6301\u8fde\u7eed\u6253\u5b57\u3002Lexical \u5149\u6807\u4e22\u5931\u65f6\u5355\u7eaf DOM focus() \u4e0d\u591f,
  // \u5fc5\u987b\u8c03 Lexical \u7f16\u8f91\u5668\u5b9e\u4f8b\u81ea\u5df1\u7684 focus() \u628a\u9009\u533a\u653e\u56de\u7f16\u8f91\u5668(\u5426\u5219\u8981\u9f20\u6807\u518d\u70b9\u4e00\u4e0b\u624d\u80fd\u6253\u5b57)\u3002\u591a\u6b21\u91cd\u8bd5\u515c\u4f4f send \u540e\u7684\u5f02\u6b65\u6e05\u7a7a\u3002
  function _doFocus(){
    try{
      var c=getComposer(); if(!c) return;
      try{ c.focus(); }catch(_){}
      try{ var ed=c.__lexicalEditor; if(ed && typeof ed.focus==='function') ed.focus(); }catch(_){}
    }catch(e){}
  }
  function refocus(){ _doFocus(); setTimeout(_doFocus, 120); setTimeout(_doFocus, 320); }
  var _sending = false;
  function _rawSendNow(tb){
    var b=getSendBtn();
    if (b){ try{ _myClick=true; b.click(); }catch(_e){} setTimeout(function(){ _myClick=false; }, 150); }
    else { window.__fbSendingEnter=1; fireEnter(tb); setTimeout(function(){ window.__fbSendingEnter=0; }, 250); }
    _sending=false; setTimeout(refocus, 120);
  }
  function _sb(step, extra){}   // \u53d1\u9001\u6d41\u8c03\u8bd5\u4fe1\u6807\u5df2\u5b8c\u6210\u4f7f\u547d,\u9759\u9ed8(\u6bcf\u6b21\u53d1\u6d88\u606f\u6253\u4e00\u53d1,\u63a8\u5168\u5ba2\u6237=\u566a\u97f3)
  var _strip = function(s){ return (s||'').replace(/[\u200b\u200c\u200d\ufeff\s]/g,''); };
  // \u5f52\u4e00\u5316\u7b7e\u540d:\u53bb emoji/\u6807\u70b9/\u7a7a\u683c,\u53ea\u7559\u5b57\u6bcd\u6570\u5b57\u6c49\u5b57 \u2014\u2014 \u7528\u4f5c\u53d1\u51fa\u6d88\u606f\u7684\u7a33\u5b9a key(IG \u628a emoji \u6e32\u67d3\u6210\u56fe\u7247,
  // \u6c14\u6ce1 textContent \u8bfb\u4e0d\u5230 emoji,\u6545\u4e0d\u80fd\u7528\u539f\u59cb\u6587\u672c\u5f53 key,\u5426\u5219\u5339\u914d miss\u3002\u5b58/\u67e5\u4e24\u7aef\u90fd\u7528\u5b83,\u5929\u7136\u4e00\u81f4)\u3002
  var _sig = function(s){ return String(s==null?'':s).replace(/[^\p{L}\p{N}]+/gu,'').toLowerCase(); };   /* [TR-ALIGN-1002] 原来只留拉丁/数字/汉字/假名/韩文 → 俄文/泰文/阿拉伯文等签名为空串,"译文=原文"误判成立把原文发出去;改为任何文字的字母+数字 */
  /* [TR-FIX-1002B] 写入后核对:只认「输入框内容签名 == 译文签名」且 _safeToSend 通过才发送(原来只看"已不是原文",
     框里是别的东西——比如写入失败留下的半截/平台改写过的文字——也会被发出去);对不上就重写,3 次仍不对 → 提示,不发。 */
  function commitAndSend(tb, tr, orig, tries, to){
    setInputText(tb, tr);
    var delay = Math.min(180, 60 + Math.floor((tr.length||0)/12));   // Lexical setEditorState 是同步的,给个小余量即可(丝滑)
    setTimeout(function(){
      var cur = _ctext(getComposer());
      if (cur === ''){ _sb('curEmpty'); _sending = false; setTimeout(refocus, 120); return; }   // 已空=可能已发出,不误报失败
      if (_sig(cur) === _sig(tr) && _safeToSend(cur, to)){
        try{ window.__fbSentOrig[_sig(cur)] = orig; saveOrig(); }catch(e){}
        window.__fbSendingEnter = 1;   // 标记这个Enter是我方发送用,handleSend放行
        _sb('fired');
        fireEnter(getComposer());
        setTimeout(function(){
          var c2 = _ctext(getComposer());
          _sb('post','&sent='+(c2===''?1:0));
          if (c2 !== '' && _sig(c2) === _sig(tr) && _safeToSend(c2, to)){ var b = getSendBtn(); if (b){ try{ _myClick=true; b.click(); setTimeout(function(){_myClick=false;},150); }catch(e){} } }  // 兜底点发送键(同样只认译文)
          setTimeout(function(){ window.__fbSendingEnter = 0; }, 250);
          _sending = false;
          setTimeout(refocus, 120);
        }, 120);
      } else if ((tries||0) < 2){
        commitAndSend(tb, tr, orig, (tries||0)+1, to);    // 框里不是译文=没写进去,再试(长文本多给一次)
      } else {
        _sb('pastefail'); dbg('paste failed'); setPreview(_TR_FAIL); _sending = false;   // [TR-FIX-1002B] 不发、不设"已就绪"
      }
    }, delay);
  }
  /* [QUICK-SEND-CORE v7] 快捷回复发送核心 —— 唯一来源 /opt/scrm-api/quick-send-core.js,各平台适配器里这一段必须与它逐字相同(test-quick-send-core.mjs 检查)。
     面板经 exec 调 window.__scrmQuick:fill(text) 只填不发;send(text, tr) 原文/翻译后发送;返回 Promise<'ok'|原因>。
     各平台只提供绑定 B(都接到适配器自己现成的函数,不另写一套):
       box()          当前聊天输入框            read(el)       输入框里的文字
       write(el, t)   写入(可返回 Promise)      send(t)        触发发送(必须走适配器"我方发送"放行通道,不被自己的回车/按钮翻译拦截再翻一遍)
       tr(t)          按当前好友发送语言翻译(Promise<string>)   to()           当前发送目标语言
       key(on)        (可选)平台只认真实按键时(Telegram):send 写好核对、等目标框(聊天框/说明框)真拿到焦点后 key(true) 放行下一次回车并返回 'needkey',
                      由面板对该窗口发系统级回车,再调 after() 等输入框清空(key(false) 收旗);2 秒拿不到焦点 → 'nofocus'(回车会打到别处,不发)
       attach(file)   (可选,有它才支持图片/音频/视频/图文)把文件交给平台自己的发送预览/待发区,等它出现;
                      返回 Promise<{ cap: 说明框或 null(说明写在聊天输入框)}>,预览没出现返回 null
       pending()      (配合 attach)预览/待发区里还有没发出的文件
       mark()         (可选,配合 settled)发送前记下"当前自己消息数",settled 据此判"这条已出现";
       settled()      (可选)已发出的消息都真正发送完成(不在上传中)。平台会并行上传时(Telegram)必须有:
                      否则后一条先传完会排到前面;连发时每条等它为真才算这一条完成,60 秒还在传 → 'uploading',停下不发后面的
     sendItem(item, tr, origin):文字=send;媒体=从我们服务器下载 → attach → 写说明(图文;tr 时先翻)→ 发送 → 等输入框和待发区都清空才算发出;
       平台没有 attach 或是名片 → 'nomedia'(面板明确提示不支持,不猜)。
     稳定性:busy 只在一条 Promise 链里置位/复位,平台函数当场抛异常也走同一出口(否则 busy 永远 true,这个窗口以后都报"上一条还在发送");
       needkey 之后 busy 一直保持到 after()/cancel()/30 秒兜底,面板按键失败必须调 cancel()(收旗+清掉写进去的内容);
       文字和媒体都先看待发区(业务员自己拖了图开着预览时,快捷文字会写进图片说明框把他的图带出去)→ previewopen;
       "写对了"的比对:字母数字汉字签名相同;内容只有 emoji/标点时签名为空 → 退回比对原文;
       媒体下载 30 秒超时,单条总时长有界。
     规则:输入框有业务员草稿 → notempty 不动;写进去的和要发的不一致 → 清掉不发(mismatch);目标语言是中文不翻;
     目标不是中日韩而译文仍含汉字 → 视为翻译失败拦下(trblocked);发送以"输入框被清空"为准,5 秒没清空 = notsent(绝不假报成功)。 */
  function _scrmQuickInstall(B){
    var busy = false;
    var W = function(ms){ return new Promise(function(r){ setTimeout(r, ms); }); };
    var sig = function(s){ return String(s == null ? '' : s).replace(/[^\p{L}\p{N}]+/gu, '').toLowerCase(); }; // 只比字母数字汉字(emoji 渲染成图片、换行空格差异不影响)
    var same = function(got, want){ var w = sig(want); return w ? sig(got) === w : String(got || '').trim() === String(want || '').trim(); }; // 纯 emoji/标点内容签名为空,退回比原文
    var txt = function(){ try { var el = B.box(); return el ? String(B.read(el) || '').trim() : ''; } catch (e) { return ''; } };
    var toZh = function(){ var t = String(B.to() || '').toLowerCase(); return t.indexOf('zh') === 0 || t === 'yue'; };
    var toCJK = function(){ return /^(zh|ja|ko|yue)/.test(String(B.to() || '').toLowerCase()); };
    var pend = function(){ try { return !!(B.pending && B.pending()); } catch (e) { return false; } };
    function waitEmpty(ms){ var t0 = Date.now(); return (function chk(){ if (!txt() && !pend()) return Promise.resolve('ok'); if (Date.now() - t0 > ms) return Promise.resolve('notsent'); return W(150).then(chk); })(); }
    function waitSettled(r){ if (r !== 'ok' || !B.settled) return Promise.resolve(r); var t0 = Date.now(); return (function chk(){ var ok = true; try { ok = !!B.settled(); } catch (e) {} if (ok) return Promise.resolve('ok'); if (Date.now() - t0 > 60000) return Promise.resolve('uploading'); return W(250).then(chk); })(); }
    function trText(text){ // 翻译 + 译文仍含汉字(目标非中日韩)拦下;目标中文不翻
      if (toZh()) return Promise.resolve({ text: text });
      return Promise.resolve(B.tr(text)).then(function(t){
        t = String(t == null ? '' : t).trim(); if (!t) return { err: 'trfail' };
        if (!toCJK() && /[\u4e00-\u9fff]/.test(t)) return { err: 'trblocked' };
        return { text: t };
      }, function(){ return { err: 'trfail' }; });
    }
    function writeCheck(el, text){ // 写入并等到框里真是这段文字(有的平台写入是异步的:Discord 先全选再贴、LINE Business 下一拍才派发)
      var t0;
      return Promise.resolve(B.write(el, text)).then(function(){ t0 = Date.now(); return (function ready(){ if (same(B.read(el) || '', text)) return true; if (Date.now() - t0 > 1500) return false; return W(100).then(ready); })(); });
    }
    function clearBox(el){ try { return Promise.resolve(B.write(el || B.box(), '')); } catch (e) { return Promise.resolve(); } }
    function fetchTimeout(url, ms){ var ac = typeof AbortController === 'function' ? new AbortController() : null; var t = setTimeout(function(){ if (ac) ac.abort(); }, ms); return fetch(url, { cache: 'force-cache', signal: ac ? ac.signal : undefined }).then(function(r){ clearTimeout(t); return r; }, function(e){ clearTimeout(t); throw e; }); }
    var FNAME = { 2: 'image', 3: 'audio', 4: 'video', 5: 'image' };
    var MIME = { jpg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', mp3: 'audio/mpeg', m4a: 'audio/mp4', aac: 'audio/aac', ogg: 'audio/ogg', wav: 'audio/wav', weba: 'audio/webm', mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime' };
    var keyTimer = null;
    function arm(on){ try { if (B.key) B.key(on); } catch (e) {} clearTimeout(keyTimer); if (on) keyTimer = setTimeout(function(){ disarm(); }, 30000); }
    function run(job){ // busy 的唯一进出口:job 里任何同步异常/拒绝都在这里复位;返回 needkey 时 busy 保持到 after()/cancel()/30s 兜底
      busy = true;
      return Promise.resolve().then(job).then(function(r){ if (r !== 'needkey') busy = false; return r; }, function(e){ busy = false; return 'error:' + (e && e.message); });
    }
    function disarm(){ arm(false); busy = false; }
    function mark(){ try { if (B.mark) B.mark(); } catch (e) {} }
    function focusWait(el){ // 只认真实按键的平台:回车打在焦点所在的框上,要等目标框真的拿到焦点(Telegram 附件预览开出来后过一拍才把焦点给说明框,早发回车就打到空的聊天框上=没发,20 秒后才报 notsent)
      var t0 = Date.now();
      return (function chk(){ var d = typeof document !== 'undefined' ? document : null; if (!d || d.activeElement === el) return Promise.resolve(true); try { el.focus(); } catch (e) {} if (Date.now() - t0 > 2000) return Promise.resolve(false); return W(100).then(chk); })();
    }
    function needKey(el, onFail){ return focusWait(el).then(function(f){ if (!f) return onFail(); arm(true); return 'needkey'; }); }
    window.__scrmQuick = {
      v: 7,
      after: function(){ return waitEmpty(20000).then(function(r){ disarm(); return waitSettled(r); }); },
      cancel: function(){ return Promise.resolve().then(function(){ disarm(); return clearBox(); }).then(function(){ return 'ok'; }, function(){ return 'ok'; }); }, // 面板发不出真实按键时:收旗、清掉写进去的内容
      fill: function(text){ return Promise.resolve().then(function(){ var el = B.box(); if (!el) return 'noinput'; if (busy) return 'busy'; if (txt()) return 'notempty'; if (pend()) return 'previewopen'; return writeCheck(el, String(text == null ? '' : text)).then(function(ok){ if (ok) return 'ok'; return clearBox(el).then(function(){ return 'mismatch'; }); }); }).catch(function(e){ return 'error:' + (e && e.message); }); },
      send: function(text, tr){
        text = String(text == null ? '' : text); if (!text.trim()) return Promise.resolve('empty');
        if (busy) return Promise.resolve('busy');
        var el = B.box(); if (!el) return Promise.resolve('noinput');
        if (txt()) return Promise.resolve('notempty');
        if (pend()) return Promise.resolve('previewopen'); // 业务员自己开着发图预览:文字会写进说明框,把他的图带出去
        return run(function(){
          var get = tr ? trText(text) : Promise.resolve({ text: text });
          return get.then(function(g){
            if (g.err) return g.err;
            return writeCheck(el, g.text).then(function(ok){
              if (!ok) return clearBox(el).then(function(){ return 'mismatch'; });
              mark();
              if (B.key) return needKey(el, function(){ return clearBox(el).then(function(){ return 'nofocus'; }); }); // 目标框拿不到焦点:回车会打到别处,清掉不发
              B.send(g.text);
              return waitEmpty(5000).then(waitSettled);
            });
          });
        });
      },
      sendItem: function(item, tr, origin){
        if (!item || !item.type) return Promise.resolve('empty');
        if (item.type === 1) return this.send(item.content, tr);
        if (!B.attach || item.type === 6) return Promise.resolve('nomedia');
        var url = String((item.data && item.data.url) || ''); if (!/^\/qrmedia\/\d+\/[0-9a-f]{64}\.[a-z0-9]+$/.test(url)) return Promise.resolve('badurl');
        if (busy) return Promise.resolve('busy');
        if (!B.box()) return Promise.resolve('noinput');
        if (txt()) return Promise.resolve('notempty');
        if (pend()) return Promise.resolve('previewopen'); // 待发区已有业务员自己放的文件,不插手
        var cap = item.type === 5 ? String(item.content || '').trim() : '';
        return run(function(){
          var capP = cap && tr ? trText(cap) : Promise.resolve({ text: cap });
          return capP.then(function(c){
          if (c.err) return c.err;
          return fetchTimeout(String(origin || '') + url, 30000).then(function(r){ if (!r.ok) throw new Error('http ' + r.status); return r.blob(); }).then(function(blob){
            var ext = url.slice(url.lastIndexOf('.') + 1), file = new File([blob], FNAME[item.type] + '.' + ext, { type: MIME[ext] || blob.type || 'application/octet-stream' }); // MIME 按后缀定(响应头若是 octet-stream,TG 会当"文件"而不是"照片"发)
            return Promise.resolve(B.attach(file));
          }).then(function(a){
            if (!a) return 'nopreview';
            var capBox = a.cap || B.box();
            var w = c.text ? writeCheck(capBox, c.text) : Promise.resolve(true);
            return w.then(function(ok){
              if (!ok) return 'mismatch'; // 说明没写对:不发,预览留给业务员自己处理
              mark();
              if (B.key) return needKey(capBox, function(){ return 'nofocus'; }); // 说明框拿不到焦点:不发,预览留给业务员自己处理
              B.send(c.text);
              return waitEmpty(20000).then(waitSettled); // 大文件上传要时间:输入框和待发区都清空、平台显示发送完成才算发出
            });
          });
          });
        });
      }
    };
  }
  /* [/QUICK-SEND-CORE] */
  _scrmQuickInstall({ box: getComposer, read: _ctext, write: setInputText, send: function(){ _rawSendNow(getComposer()); }, tr: function(t){ return translateML(t, sendTo()); }, to: function(){ return sendTo(); } }); // [QUICK-SEND] 本平台绑定
  function handleSend(e){
    if (e.keyCode !== 13 || e.shiftKey || e.ctrlKey || e.metaKey) return;
    if (window.__fbSendingEnter) return;   // \u6211\u65b9\u53d1\u9001\u6d3e\u53d1\u7684Enter \u2192 \u653e\u884c\u539f\u751f\u53d1\u9001
    var tb = getComposer();
    if (!tb) return;
    if (!(e.target === tb || (tb.contains && tb.contains(e.target)) || (e.target && e.target.closest && e.target.closest('[role="textbox"]')))) return;
    var ct = _ctext(tb);
    if (!ct) return;
    _sb('enter','&n='+ct.length+'&tl='+encodeURIComponent(sendTo())+'&trust='+(e.isTrusted?1:0)+'&son='+(_sendOn()?1:0));
    if (!_sendOn()){   // \u53d1\u9001\u7ffb\u8bd1\u5f00\u5173\u5173=\u539f\u6587\u76f4\u53d1(\u4ecd\u8d70\u6a21\u62df\u70b9\u51fb,\u7ed5\u6d77\u738b\u541e\u56de\u8f66)
      e.preventDefault(); e.stopImmediatePropagation();
      if (_sending) return; _sending = true; setTimeout(function(){ _sending = false; }, 8000);
      _rawSendNow(tb); return;
    }
    // \u7edf\u4e00\u63a5\u7ba1\u6240\u6709\u56de\u8f66,\u6309"\u68c0\u6d4b\u8bed\u8a00\u2192\u76ee\u6807\u8bed\u8a00"\u8bed\u4e49:\u5148\u62ff\u8bd1\u6587(\u547d\u4e2d\u9884\u89c8\u7f13\u5b58=\u96f6\u5ef6\u8fdf),
    // \u8bd1\u6587\u2260\u539f\u6587\u2192\u5199\u5165\u8bd1\u6587\u53d1\u9001;\u8bd1\u6587=\u539f\u6587(\u5df2\u662f\u76ee\u6807\u8bed\u8a00/\u7eafemoji\u6570\u5b57)\u2192\u539f\u6837\u53d1\u3002
    // \u4e0d\u518d\u53ea\u8ba4"\u542b\u4e2d\u6587\u624d\u7ffb"\u2014\u2014\u8001\u89c4\u5219\u4f1a\u628a\u6cf0\u8bed\u539f\u6587\u539f\u6837\u53d1\u51fa\u53bb(\u76ee\u6807\u660e\u660e\u662f\u97e9\u8bed)\u3002
    e.preventDefault(); e.stopImmediatePropagation();
    if (_sending) return;
    _sending = true;
    setTimeout(function(){ _sending = false; }, 8000);   // \u5b89\u5168\u9600:\u4efb\u4f55\u5361\u6b7b8\u79d2\u540e\u81ea\u52a8\u590d\u4f4d,\u4e0d\u6c38\u4e45\u9501\u6b7b
    var rawSend = function(){ _rawSendNow(tb); };
    var _to = sendTo(), _key = _pvKeyOf(_to, ct);   // [TR-ALIGN-1002] 本次发送的语言+线路,翻译/复用预览都用它
    if (_sendAsIs(ct)){ rawSend(); return; }        // [TR-ALIGN-1002] 已是目标语言:原样发(与预览同一判断,不联网)
    var onTr = function(tr){
      var out = _outFor(ct, tr, _to);   // [TR-FIX-1002B] 发什么/能不能发:与预览同一个判断
      if (!out){ dbg('no translation, NOT sending'); _pvFailed(_key); _sending = false; return; }   // 失败:不发、不写原文,预览提示并自动重试
      if (out === ct){ _sb('sameraw'); rawSend(); return; }   // 已是目标语言(已过 _safeToSend)→原样发
      _sb('trok','&n='+out.length); commitAndSend(tb, out, ct, 0, _to);
    };
    var cached = (_lastOutKey === _key) ? _lastOut : '';   // [TR-ALIGN-1002] 预览译文必须是同一原文+语言+线路才复用
    if (cached) onTr(cached);
    else translateML(ct, _to).then(function(tr){
      if (tr && tr.replace(/\s/g,'')) onTr(tr);
      else translateML(ct, _to).then(onTr);   // 重试一次
    });
  }
  window.addEventListener('keydown', handleSend, true);
  // \u5feb\u6377\u952e(\u7167WA):Ctrl+F=\u53d1\u9001\u539f\u6587(\u4e0d\u7ffb\u8bd1);Ctrl+T=\u53ea\u7ffb\u8bd1\u4e0d\u53d1\u9001(\u8bd1\u6587\u5199\u5165\u8f93\u5165\u6846)
  window.addEventListener('keydown', function(e){
    try{
      if(!e.ctrlKey || e.shiftKey || e.metaKey || e.altKey) return;
      var k=(e.key||'').toLowerCase(); if(k!=='f'&&k!=='t') return;
      var tb=getComposer(); if(!tb) return;
      if(!(e.target===tb || (tb.contains&&tb.contains(e.target)) || (e.target&&e.target.closest&&e.target.closest('[role="textbox"]')))) return;
      var ct=_ctext(tb); if(!ct) return;
      e.preventDefault(); e.stopImmediatePropagation();
      if(k==='f'){ if(_sending) return; _sending=true; setTimeout(function(){_sending=false;},8000); _rawSendNow(tb); return; }
      if(_sendAsIs(ct)) return;   // [TR-ALIGN-1002] 已是目标语言:不用翻
      var _to=sendTo();
      var fill=function(tr){ try{ var out=_outFor(ct, tr, _to); if(!out) setPreview(_TR_FAIL); else if(out!==ct) setInputText(tb,out); }catch(_e){} };   // [TR-FIX-1002B] 与回车同一判断
      var cached=(_lastOutKey===_pvKeyOf(_to, ct))?_lastOut:'';
      if(cached) fill(cached); else translateML(ct,_to).then(fill);
    }catch(_e){}
  }, true);

  // \u62e6\u622a\u53d1\u9001\u6309\u94ae\u70b9\u51fb:\u542b\u4e2d\u6587\u65f6\u4e0d\u8ba9\u539f\u751f\u76f4\u63a5\u53d1\u4e2d\u6587,\u8f6c\u6210\u56de\u8f66\u8d70\u7ffb\u8bd1\u6d41\u7a0b(\u548cEnter\u4e00\u81f4)
  var _myClick = false;
  document.addEventListener('click', function(e){
    try{
      if(_myClick) return;                        // \u6211\u65b9\u81ea\u5df1\u70b9\u7684(\u53d1\u82f1\u6587),\u653e\u884c
      var sb = getSendBtn(); if(!sb) return;
      var t = e.target;
      if(!(t===sb || (sb.contains && sb.contains(t)) || (t && t.closest && t.closest('[aria-label]')===sb))) return;
      var tb = getComposer(); if(!tb) return;
      var ct = _ctext(tb);
      if(!ct) return;
      e.preventDefault(); e.stopImmediatePropagation();
      tb.focus();
      tb.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',code:'Enter',keyCode:13,which:13,bubbles:true,cancelable:true}));  // \u7edf\u4e00\u8f6c\u56de\u8f66\u2192handleSend\u51b3\u5b9a\u7ffb\u8bd1\u6216\u539f\u6837\u53d1
    }catch(err){}
  }, true);

  document.addEventListener('input', onInput, true);   // \u6253\u5b57\u89e6\u53d1
  document.addEventListener('paste', function(){ setTimeout(onInput, 30); }, true);  // \u7c98\u8d34\u89e6\u53d1
  // 变化轮询兜底:粘贴/拖入/任何方式改了输入框、或只换了目标语言/线路都能重翻;输入框空了强制回占位
  // [TR-ALIGN-1002] 原来只在"文字变了"或"已有译文且语言变了"时才调 onInput(换线路不重翻、译文没回来前换语言也不重翻);
  // 现在每轮都交给 onInput,它按「语言|线路|原文」键自己判断有没有变化,没变直接返回
  setInterval(onInput, 250);

  // ---------- \u6536\u53d1\u4e24\u4e2a\u65b9\u5411\u7684\u7ffb\u8bd1\u90fd\u81ea\u7814:\u4fdd\u8bc1\u6bcf\u4e2a\u7ffb\u8bd1\u6846\u663e\u793a"\u5b8c\u6574\u4e2d\u6587" ----------
  // \u7edf\u4e00\u89c4\u5219:\u53d6\u8be5\u6d88\u606f\u8981\u7ffb\u8bd1\u7684\u539f\u6587(\u4f18\u5148 wrapper \u7684 origintext,\u515c\u5e95\u4e0a\u4e00\u6761\u6c14\u6ce1\u6587\u672c)\u2014\u2014
  //   \u2460 \u6211\u65b9\u53d1\u51fa(\u7b7e\u540d\u547d\u4e2d __fbSentOrig)\u2192 \u76f4\u63a5\u7528\u5b58\u7684\u4e2d\u6587\u539f\u6587(\u6700\u7cbe\u51c6);
  //   \u2461 \u539f\u6587\u5df2\u662f\u4e2d\u6587 \u2192 \u76f4\u63a5\u663e\u793a(\u6211\u65b9\u5e26\u4e2d\u6587\u539f\u6587\u7684\u53d1\u51fa / \u4e2d\u6587\u6765\u4fe1);
  //   \u2462 \u539f\u6587\u662f\u5916\u6587(\u5ba2\u6237\u6765\u4fe1)\u2192 \u6211\u65b9\u8d70 IPC \u73b0\u7ffb\u6210\u5b8c\u6574\u4e2d\u6587(\u9010\u884c,\u65e0\u9017\u53f7\u622a\u65ad),\u5f02\u6b65\u7ffb\u5b8c\u76d6\u7ae0\u3002
  // \u547d\u4e2d\u5373\u628a\u7ed3\u679c\u76d6\u5230 data-scrm-orig \u5e76\u7ed9\u8bd1\u6587\u683c\u6302 MutationObserver \u77ac\u65f6\u9489\u6b7b \u2192 \u6d77\u738b\u4e00\u8986\u5199\u7acb\u523b\u6062\u590d,\u6d88\u706d\u6c14\u6ce1\u91cc\u7684\u95ea\u3002
  var _cjk=/[\u4e00-\u9fff]/;
  var _hasLetter=/[A-Za-z\u00c0-\u024f\u0370-\u03ff\u0400-\u04ff\u0530-\u058f\u0600-\u06ff\u0900-\u097f\u0e00-\u0e7f\u3040-\u30ff\uac00-\ud7af]/;
  // \u63a5\u6536\u76ee\u6807\u8bed\u8a00:\u8bfb\u9762\u677f\u914d\u7f6e(\u522b\u5199\u6b7b\u4e2d\u6587);\u6539\u8bed\u8a00\u2192\u7f13\u5b58key\u53d8\u2192\u81ea\u52a8\u91cd\u7ffb
  function recvTo(){ try{ var c=_cfg(); return (c&&(c.receiveTargetLanguage||c.recvTo))||'zh-CN'; }catch(e){ return 'zh-CN'; } }
  // src \u662f\u5426\u5df2\u662f\u76ee\u6807\u8bed\u8a00\u2192\u514d\u7ffb(\u4ec5\u4e2d\ufffd\ufffd\u76ee\u6807\u6709\u53ef\u9760\u68c0\u6d4b:\u662f\u4e2d\u6587\u4e14\u65e0\u5916\u6587\u5b57\u6bcd;\u5176\u5b83\u76ee\u6807\u65e0\u53ef\u9760\u68c0\u6d4b\u2192\u4e00\u5f8b\u7ffb,Google \u540c\u8bed\u8a00\u8fd4\u56de\u539f\u6587)
  function _isTargetLang(src, tl){ if(src && !_hasLetter.test(src) && !_cjk.test(src) && /[0-9]/.test(src)) return true; /* [NUM-TR] 2026-09-14 纯数字/符号=语言无关,当作已是目标语言原样显示译文行(用户要求数字也要有翻译;原来"有字母或汉字才翻"把 111 直接跳过) */ if((tl||'').indexOf('zh')===0) return _cjk.test(src) && !_hasLetter.test(src); return false; }
  // \u7ed9\u67d0\u4e2a wrapper \u7684\u8bd1\u6587\u683c\u6302\u89c2\u5bdf\u5668:\u6d77\u738b\u4e00\u6539\u5c31\u7acb\u523b\u6062\u590d\u6210\u6211\u65b9 data-scrm-orig(\u77ac\u65f6,\u4e0d\u7b49\u8f6e\u8be2=\u4e0d\u95ea)
  // \u9489\u6b7b\u89c2\u5bdf\u5668\u76ef\u3010\u6574\u4e2a wrapper \u5b50\u6811\u3011(\u4e0d\u662f\u5185\u5bb9\u5143\u7d20):\u6d77\u738b\u6eda\u52a8\u91cd\u6e32\u65f6\u4f1a\u628a .message-translate-content \u6574\u4e2a\u6362\u6389,
  // \u76ef\u5185\u5bb9\u5143\u7d20\u4f1a\u88ab\u6362\u6389\u540e\u5931\u6548;\u76ef wrapper \u5219\u8fde\u5143\u7d20\u66ff\u6362\u90fd\u80fd\u5728\u7ed8\u5236\u524d microtask \u6293\u56de \u2192 \u5f7b\u5e95\u4e0d\u95ea\u4e0d\u91cd\u8f7d\u3002
  function _pinWrap(w){
    try{
      if(w.__scrmPin) return; w.__scrmPin = 1;
      var restore = function(){ try{
        var o=w.getAttribute('data-scrm-orig'); if(o==null) return;
        var mc=w.querySelector('.message-translate-content');
        if(mc && (mc.textContent||'')!==o){ _keepBottom(mc); mc.textContent=o; }   // [TR-KEEP-BOTTOM-FBIG] 译文写进框的统一出口
      }catch(e){} };
      new MutationObserver(restore).observe(w, {childList:true, subtree:true, characterData:true});
      restore();
    }catch(e){}
  }
  function _injLineStyle(){
    try{ if((document.head||document.body)){
      var stl=document.getElementById('__scrmFbLineStyle');
      if(!stl){ stl=document.createElement('style'); stl.id='__scrmFbLineStyle'; (document.head||document.body).appendChild(stl); }
      // \u26a0\ufe0f\u7edd\u4e0d\u80fd\u7ed9messages_table\u585e::after/\u5b50\u5143\u7d20:FB\u865a\u62df\u5316\u9760\u6d4b\u5bb9\u5668\u5185\u5bb9\u9ad8\u5ea6\u51b3\u5b9a\u6e32\u67d3\u54ea\u4e9b\u884c,\u585e\u4e86\u4f1a\u628a\u6536\u5230\u7684\u6d88\u606f\u5224\u6210"\u4e0d\u53ef\u89c1"\u76f4\u63a5\u4e0d\u6e32\u67d3(v68\u4e8b\u6545)
      var __want='.message-translate-content{white-space:pre-line !important;color:#12b76a !important;} .message-translate-content-wrapper.scrm-dk .message-translate-content{color:#ffffff !important;} [class*="real-time-tranlate"]{color:#12b76a !important;border-color:#12b76a !important;} .scrm-fb-rxoff .message-translate-content-wrapper{display:none !important;}';
      if(stl.textContent!==__want) stl.textContent=__want;
    } }catch(e){}
  }
  // syncOnly=true:\u53ea\u7528\u7f13\u5b58(__fbSentOrig/__fbRecvTrans)\u540c\u6b65\u76d6\u7ae0,\u4e0d\u53d1 IPC \u2014\u2014 \u4f9b microtask \u5728"\u7ed8\u5236\u524d"\u62a2\u8986\u76d6,
  //   \u6d77\u738b\u6eda\u52a8\u91cd\u5efa\u65f6\ufffd\ufffd\ufffd\ufffd\ufffd\ufffd\ufffd\u6b65\ufffd\ufffd\ufffd\ufffd\ufffd\u7684"\u7ffb\u8bd1\u4e2d..."\u6839\u672c\u6765\u4e0d\u53ca\u753b\u5c31\u88ab\u6211\u65b9\u7f13\u5b58\u5185\u5bb9\u66ff\u6389 = \u5f7b\u5e95\u4e0d\u95ea\u4e0d\u91cd\u8f7d\u3002
  // syncOnly=false:\u542b\u5f02\u6b65 IPC,\u5904\u7406\u5168\u65b0\u672a\u7f13\u5b58\u7684\u6765\u4fe1\u3002
  // \u6211\u65b9\u81ea\u5efa\u7ffb\u8bd1\u6846(\u7167\u6d77\u738b\u6a21\u677f/\u6837\u5f0f),\u53ea\u5bf9"\u7f13\u5b58\u91cc\u5df2\u6709\u8bd1\u6587"\u7684\u6d88\u606f\u79d2\u586b \u2192 \u6eda\u52a8\u91cd\u6302\u65f6\u96f6\u7a7a\u6863\u3001\u4e0d\u91cd\u8f7d\u3002
  //   \u6d77\u738b kt \u626b\u63cf\u5668\u89c1\u8fd9\u884c\u5df2\u6709 .message-translate-content \u5c31\u8df3\u8fc7,\u4e0d\u518d\u6162\u541e\u541e\u8865\u8bd1\u6587(\u6d88\u706d\u91cd\u8f7d\u7a7a\u6863)\u3002
  //   \u9996\u6b21\u672a\u7f13\u5b58\u7684\u4ecd\u7531\u6d77\u738b\u7ffb,\u7ffb\u5b8c\u5b58\u7f13\u5b58,\u4e0b\u6b21\u6eda\u52a8\u5f52\u6211\u65b9\u79d2\u586b\u3002
  var MSG_SEL='[role="row"] span[dir="auto"]';   // \u8001\u9009\u62e9\u5668,\u4ec5\u515c\u5e95
  // \u6d77\u738b\u540c\u6b3e\u4f5c\u7528\u57df:FB\u6d88\u606f\u533a\u81ea\u5e26 data-scope="messages_table",\u5929\u7136\u6392\u9664\u5de6\u4fa7\u4f1a\u8bdd\u5217\u8868(2026-08-17\u4ece\u6d77\u738bfacebook-preload.js\u6252\u7684)
  function _msgEls(){ try{ var a=document.querySelectorAll('[data-scope="messages_table"] div[dir="auto"]'); if(a.length) return a; }catch(e){} try{ return document.querySelectorAll(MSG_SEL); }catch(e){ return []; } }
  // ---------- \u8bd1\u6587\u5237\u65b0\u6309\u94ae(WA\u540c\u6b3eSVG:\u7070#9aa0a6/\u60ac\u505c\u7eff#1a7f37/\u7ffb\u8bd1\u4e2d\u65cb\u8f6c)+\u6211\u65b9\u91cd\u7ffb(\u6d77\u738b$_btnClick\u5df2\u5e9f,\u5b83\u7ffb\u8bd1\u88ab\u6390\u70b9\u4e86\u4f1a\u6e05\u7a7a\u8bd1\u6587) ----------
  function _rfStyle(){ if(document.getElementById('scrm-fbrf-style')||!document.head) return; var st=document.createElement('style'); st.id='scrm-fbrf-style';
    st.textContent='@keyframes scrm-fb-spin{to{transform:rotate(360deg)}} .scrm-fbrf{display:inline-flex;align-items:center;margin-left:6px;vertical-align:middle;cursor:pointer;color:#9aa0a6;transition:color .15s;} .scrm-fbrf:hover{color:#1a7f37;} .scrm-fbrf.spin svg{animation:scrm-fb-spin .8s linear infinite;}';
    document.head.appendChild(st); }
  var _RF_SVG='<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>';
  function _fbRetranslate(btn){
    try{
      var w = btn.closest ? btn.closest('.message-translate-content-wrapper') : null; if(!w) return;
      var mc = w.querySelector('.message-translate-content'); if(!mc) return;
      try{ btn.classList.add('spin'); }catch(e){}
      var src=''; var ot=w.getAttribute('originText')||w.getAttribute('origintext')||'';
      if(ot){ try{ src=decodeURIComponent(ot); }catch(e){ src=ot; } }
      if(!src){ var bub=w.previousElementSibling; src=bub?(bub.textContent||''):''; }
      if(!src){ try{ btn.classList.remove('spin'); }catch(e){} return; }
      var rto=recvTo(); var sg=_sig(src); var key=sg?(rto+'|'+sg):'';
      if(key){ try{ delete window.__fbRecvTrans[key]; }catch(e){} }
      // [TR-ALIGN-1002] ↻ 强制刷新:translateML(...,true) 跳过内存+IndexedDB 直接走网络,并用新结果覆盖两处缓存(原来按 'v1|tl|文本' 拼键打标记,长文分块的键对不上→仍拿旧译文)
      var _rtT0=Date.now();
      w.removeAttribute('data-scrm-orig'); w.setAttribute('data-scrm-pending','1');   // \u9632processWraps\u7528\u65e7\u7f13\u5b58\u76d6\ufffd\ufffd\ufffd\u6765
      mc.textContent='\u7ffb\u8bd1\u4e2d\u2026';
      translateML(src, rto, true).then(function(zh){ var _wait=Math.max(0,600-(Date.now()-_rtT0)); setTimeout(function(){   /* \u8f6c\u5708\u81f3\u5c11 600ms,\u8ba9\u7528\u6237\u770b\u5f97\u89c1\u5237\u65b0\u53d1\u751f\u4e86 */
        try{
          try{ btn.classList.remove('spin'); }catch(e){}
          w.removeAttribute('data-scrm-pending');
          if(zh && zh.replace(/\s/g,'')){ var v=zh.replace(/^\s+|\s+$/g,''); if(key){ window.__fbRecvTrans[key]=v; saveRecv(); } w.setAttribute('data-scrm-orig', v); w.setAttribute('data-scrm-tl', rto); mc.textContent=v; }
          // \u5931\u8d25:\u7559\u7ed9 processWraps \u5f02\u6b65\u8def\u5f84\u81ea\u7136\u91cd\u8bd5
        }catch(e){}
      }, _wait); });
    }catch(e){}
  }
  document.addEventListener('click', function(e){ try{ var b=e.target && e.target.closest && e.target.closest('.scrm-fbrf,.message-translate-btn'); if(b){ e.preventDefault(); e.stopImmediatePropagation(); _fbRetranslate(b); } }catch(_e){} }, true);
  try{ Object.defineProperty(window,'$_btnClick',{ value:function(el){ _fbRetranslate(el); }, writable:false, configurable:false }); }catch(e){}   // \u6d77\u738bonload\u665a\u4e8e\u6211\u4eec,\u5b83\u7684\u8d4b\u503c\u4f1a\u9759\u9ed8\u5931\u8d25

  var _wrapStyle='font-weight:400;font-size:12px;color:#12b76a;border-top:1px dashed #c7cdd6;margin-top:4px;padding-top:4px;white-space:normal;';
  function _mkWrap(origText, chinese, isRecv, tl){
    var w=document.createElement('div');
    w.className='message-translate-content-wrapper'+(isRecv?' scrm-recv':'');
    w.setAttribute('style',_wrapStyle);
    try{ w.setAttribute('originText', encodeURIComponent(origText)); }catch(e){}
    w.setAttribute('data-scrm-orig', chinese);
    w.setAttribute('data-scrm-self', '1');   // \u6807\u8bb0:\u8fd9\u662f\u6211\u65b9\u81ea\u5efa\u7684\u6846(\u533a\u5206\u6d77\u738b\u5efa\u7684)
    if(isRecv&&tl) w.setAttribute('data-scrm-tl', tl);   // \u6536\u4fe1\u8bd1\u6587\u6807\u8bb0\u76ee\u6807\u8bed\u8a00\u2192\u6539\u8bed\u8a00\u65f6\u8bc6\u522b\u8fc7\u671f\u91cd\u7ffb
    var c=document.createElement('div');
    c.className='message-translate-content'; c.setAttribute('tabindex','-1');
    var _dk0=false;   // \u9ed8\u8ba4\u7eff(\u6536\u4fe1\u6700\u5e38\u89c1);\u6e32\u67d3\u540e\u7531 _applyColor \u6309\u6c14\u6ce1\u5b9e\u9645\u4eae\u5ea6\u6821\u6b63(\u6df1\u84dd\u6c14\u6ce1\u2192\u767d)
    c.setAttribute('style','display:inline-block;word-break: break-word;white-space:pre-line;');   // \u7167\u6d77\u738b:\u5185\u5c42\u4e0d\u8bbecolor,\u7ee7\u627f\u5916\u5c42wrapper
    try{ w.style.borderTopColor=_dk0?'rgba(255,255,255,0.4)':'#c7cdd6'; }catch(_e){}
    c.textContent=chinese; w.appendChild(c);
    _rfStyle();
    var b=document.createElement('div');
    b.className='scrm-fbrf'; b.setAttribute('title','\u91cd\u65b0\u7ffb\u8bd1'); b.innerHTML=_RF_SVG;
    w.appendChild(b);
    return w;
  }
  /* [TR-KEEP-BOTTOM-FBIG] 2026-10-02 往消息里插内容(译文框 / 译文回来换字)的唯一贴底规则(与 X/Snapchat/Discord/TG 同一写法):
     插入前该消息所在滚动容器离底 ≤24px → 插完(微任务里)贴底;否则位置不动;同一轮多次插入只量一次;按容器实际方向判断(column-reverse 底部 = scrollTop≈0)。
     原来本平台插译文完全不管滚动:打开会话平台先滚到底,译文随后插进来把最后几条撑到可视区下面(真机实测 FB 打开会话离底 101/290px)。 */
  function _scrollHost(el){ try{ var p=el&&el.parentElement; while(p&&p!==document.body&&p!==document.documentElement){ var cs=getComputedStyle(p); if(/(auto|scroll)/.test(cs.overflowY)&&p.scrollHeight>p.clientHeight+4) return p; p=p.parentElement; } }catch(e){} return null; }
  var _kbList=null;
  function _keepBottom(el){ try{
    /* [TR-FIX-1002B] 同一批(同一轮同步插入,微任务前)只找一次滚动容器、只量一次:el 落在本批已量过的容器里就直接返回,
       不再逐个元素走祖先链 getComputedStyle + 读 scrollHeight(上一个框刚插进去,每读一次都强制重排,切会话 280ms 突发里一帧插几十个框=几十次重排) */
    if(_kbList){ for(var i=0;i<_kbList.length;i++){ if(_kbList[i].sc.contains(el)) return; } }
    var sc=_scrollHost(el); if(!sc) return;
    if(!_kbList){ _kbList=[]; Promise.resolve().then(function(){ var l=_kbList; _kbList=null; for(var k=0;k<l.length;k++){ try{ var s=l[k].sc; if(l[k].atB&&s.isConnected) s.scrollTop=l[k].rev?0:s.scrollHeight; }catch(e){} } }); }
    var rev=false; try{ rev=getComputedStyle(sc).flexDirection==='column-reverse'; }catch(e){}
    _kbList.push({ sc:sc, rev:rev, atB: rev ? Math.abs(sc.scrollTop)<=24 : (sc.scrollHeight-sc.scrollTop-sc.clientHeight)<=24 });
  }catch(e){} }
  function ensureWraps(){
    try{
      var els=_msgEls();
      for(var i=0;i<els.length;i++){
        var e=els[i]; var txt=e.textContent||''; if(!txt.trim()) continue;
        if(e.closest && e.closest('a[href],[role="navigation"]')) continue;   // \u8df3\u8fc7\u94fe\u63a5/\u5bfc\u822a;\u26a0\ufe0f\u522b\u52a0[aria-label="\u804a\u5929"]\u2014\u2014FB\u804a\u5929\u4e3b\u5bb9\u5668\u5916\u5c42\u4e5f\u5e26\u5b83,\u4f1a\u628a\u6574\u4e2a\u6d88\u606f\u533a\u5168\u8bef\u6740(2026-08-17\u5b9e\u9524:els=84\u5168\u8df3\u8fc7wr=0)
        var nx=e.nextElementSibling;
        if(nx && nx.classList && nx.classList.contains('message-translate-content-wrapper')){
          if(nx.getAttribute('data-scrm-self')==='1') continue;   // \u6211\u65b9\u7684\u6846,\u8df3\u8fc7
          try{ nx.remove(); }catch(_r){}   // \u6d77\u738b\u7684\u6846\u2192\u5220\u6389,\u4e0b\u9762\u5efa\u6211\u4eec\u81ea\u5df1\u7684
        }
        var row=e.closest?e.closest('[role="presentation"]'):null;
        if(row){ try{ row.querySelectorAll('.message-translate-content-wrapper:not([data-scrm-self="1"])').forEach(function(hw){ hw.remove(); }); }catch(_h){}
          if(row.querySelector('.message-translate-content-wrapper[data-scrm-self="1"]')) continue; }   // \u672c\u884c\u5df2\u6709\u6211\u65b9\u8bd1\u6587
        var sg=_sig(txt); var want=null, isRecv=false; var _rto=recvTo(); window.__fbEwSeen=(window.__fbEwSeen||0)+1;
        if(_isTargetLang(txt,_rto)){ want=txt.replace(/^\s+|\s+$/g,''); isRecv=true; }   // \u26a0\ufe0f\u5df2\u662f\u76ee\u6807\u8bed\u8a00\u2192\u4e5f\u5efa\u81ea\u5df1\u7684self\u6846(\u539f\u6837\u663e\u793a)\u3002\u5426\u5219\u5220\u6389\u6d77\u738b\u6846\u5374\u4e0d\u5efa=\u6d77\u738b\u6bcf\u62cd\u91cd\u5efa\u2192\u65e0\u9650\u5220\u5efa=\u4e00\u76f4\u95ea(2026-08-17\u6839\u6cbb)
        else { var rz=sg?window.__fbRecvTrans[_rto+'|'+sg]:null; if(rz!=null){ want=rz; isRecv=true; } }  // \u5bf9\u9f50WA:\u6bcf\u6761\u90fd\u7ffb\u6210\u63a5\u6536\u76ee\u6807\u8bed\u8a00(\u4e0d\u5206\u53d1\u51fa/\u6536\u5230),\u7f13\u5b58\u547d\u4e2d
        if(want!=null){
          window.__fbEwHit=(window.__fbEwHit||0)+1;
          try{ var w=_mkWrap(txt, want, isRecv, _rto); if(e.parentNode){ _keepBottom(e); e.parentNode.insertBefore(w, e.nextSibling); } _pinWrap(w); _applyColor(w); }catch(x){}
        } else if(sg && !_isTargetLang(txt,_rto) && (_hasLetter.test(txt)||_cjk.test(txt))){
          // \u672a\u7f13\u5b58\u7684\u5916\u6587\u6765\u4fe1 \u2192 \u6211\u65b9\u81ea\u5efa\u6846(\u7ffb\u8bd1\u4e2d\u2026)+ IPC \u73b0\u7ffb,\u4e0d\u518d\u7b49\u6d77\u738b\u9996\u8bd1(\u64a4\u6d77\u738b\u7b2c1\u6b65)
          window.__fbEwMiss=(window.__fbEwMiss||0)+1; try{ window.__fbMissSample=(txt||'').slice(0,24); }catch(_ms){}
          try{ var w2=_mkWrap(txt, '\u7ffb\u8bd1\u4e2d\u2026', true, _rto); if(e.parentNode){ _keepBottom(e); e.parentNode.insertBefore(w2, e.nextSibling); } _pinWrap(w2); _applyColor(w2);
            (function(wrap, text, key, tl){ translateML(text, tl).then(function(zh){ try{ if(zh&&zh.replace(/\s/g,'')){ var v=zh.replace(/^\s+|\s+$/g,''); window.__fbRecvTrans[key]=v; saveRecv(); wrap.setAttribute('data-scrm-orig', v); wrap.setAttribute('data-scrm-tl', tl); var _mc=wrap.querySelector('.message-translate-content'); if(_mc){ _keepBottom(wrap); _mc.textContent=v; } _pinWrap(wrap); } }catch(_e){} }); })(w2, txt, _rto+'|'+sg, _rto);
          }catch(x){}
        }
      }
    }catch(e){}
  }

  window.__fbDark = window.__fbDark || {};
  // \u72ec\u7acb\u6837\u5f0f\u6ce8\u5165\u5668:FB\u9891\u7e41\u91cd\u6e32\u67d3head\u4f1a\u79fb\u9664\u6211\u4eec\u7684<style>,\u6bcf2\u79d2\u8865\u56de\u6765(\u8bd1\u6587\u989c\u8272\u5168\u9760\u8fd9\u4e2aCSS !important)
  function _fbEnsureStyle(){ try{
    if(document.getElementById('__scrmFbColorStyle')) return;
    var el=document.createElement('style'); el.id='__scrmFbColorStyle';
    el.textContent='.message-translate-content{color:#12b76a !important;white-space:pre-line !important;} .message-translate-content-wrapper.scrm-dk .message-translate-content{color:#ffffff !important;} [class*="real-time-tranlate"]{color:#12b76a !important;border-color:#12b76a !important;} .scrm-fb-rxoff .message-translate-content-wrapper{display:none !important;}';
    (document.head||document.documentElement||document.body).appendChild(el);
  }catch(e){} }
  setInterval(_fbEnsureStyle, 2000); _fbEnsureStyle();
  // \u72ec\u7acb\u4e0a\u8272\u5faa\u73af:\u4e0a\u8272\u4e0d\u80fd\u88ab\u63a5\u6536\u5f00\u5173(\u6d77\u738b\u53ef\u80fd\u5173\u4e86)\u65e9\u9000\u6321\u4f4f \u2192 \u5355\u72ec\u8dd1,\u7ed9\u6240\u6709\u8bd1\u6587\u6846\u6309\u6c14\u6ce1\u4eae\u5ea6\u4e0a\u8272
  setInterval(function(){ try{ var ws=document.querySelectorAll('.message-translate-content-wrapper'); for(var i=0;i<ws.length;i++){ _applyColor(ws[i]); } }catch(e){} }, 300);   // \u7167\u6d77\u738b:\u4e0a\u8272\u8bbe\u5916\u5c42wrapper
  function _fbForceColor(mc, col){ try{ mc.style.setProperty('color', col, 'important'); }catch(e){} }
  function _applyColor(w){ try{ var mc=w.querySelector('.message-translate-content'); if(!mc) return;
      // \u7167IG:\u6df1/\u6d45\u5224\u65ad\u5b58\u3010\u5168\u5c40 window.__fbDark,\u6309\u6c14\u6ce1\u6587\u5b57\u505akey\u3011\u2192\u5207\u4f1a\u8bdd\u8bd1\u6587\u6846\u91cd\u5efa\u65f6\u540c\u6587\u5b57\u76f4\u63a5\u547d\u4e2d\u7f13\u5b58,\u989c\u8272\u77ac\u95f4\u5c31\u4f4d\u4e0d\u91cd\u7b97=\u4e0d\u95ea(\u6839\u6cbb)\u3002\u6302w\u5143\u7d20\u4e0a\u7684\u7f13\u5b58\u968f\u9500\u6bc1\u4e22\u5931\u624d\u662f\u95ea\u7684\u6839\u56e0\u3002
      var bt=(w.previousElementSibling&&w.previousElementSibling.textContent)||''; var k=bt?_dkKey(bt):'';
      var dk=k?window.__fbDark[k]:undefined;
      if(dk===undefined){ var r=_bubbleBgInfo(w);
        if(r.found){ dk=r.dark; if(k){ window.__fbDark[k]=dk; try{ var dks=Object.keys(window.__fbDark); if(dks.length>1200){ for(var z=0;z<dks.length-900;z++) delete window.__fbDark[dks[z]]; } }catch(_d){} } }
        else if(w.__scrmColApplied!=null){ return; }          // \u6ca1\u6d4b\u5230\u4f46\u5df2\u4e0a\u8fc7\u8272\u2192\u4fdd\u6301,\u522b\u95ea\u56de\u7eff
        else { dk=false; }                                    // \u4ece\u6ca1\u4e0a\u8fc7\u8272\u4e14\u6ca1\u7f13\u5b58\u2192\u6682\u7eff,\u4e0d\u5199\u5168\u5c40\u7f13\u5b58,\u4e0b\u8f6e\u518d\u6d4b
      }
      var _col=dk?'#ffffff':'#12b76a';
      if(w.__scrmColApplied===_col) return;                    // \u989c\u8272\u672a\u53d8\u2192\u4e0d\u91cd\u7ed8
      w.__scrmColApplied=_col;
      w.style.setProperty('color', _col, 'important');
      w.style.setProperty('-webkit-text-fill-color', _col, 'important');
      try{ mc.style.setProperty('-webkit-text-fill-color', _col, 'important'); mc.style.setProperty('color', _col, 'important'); }catch(_m){}
      w.style.borderTopColor=(dk?'rgba(255,255,255,0.4)':'#c7cdd6');
    }catch(e){} }
  // \u5f80\u4e0a\u627e\u771f\u6c14\u6ce1\u80cc\u666f:\u8df3\u8fc7\u900f\u660e\u548c\u8fd1\u767d(\u9875\u9762\u5e95),\u547d\u4e2d\u7684\u6309\u4eae\u5ea6<140\u5224\u6df1\u8272
  function _bubbleBgInfo(w){ try{ var el=w, hop=0, V=(w.ownerDocument||document).defaultView||window;
      while(el&&hop<10){ var bg=V.getComputedStyle(el).backgroundColor; var m=bg&&bg.match(/rgba?\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)\s*(?:,\s*([0-9.]+))?/);
        if(m){ var a=(m[4]===undefined)?1:parseFloat(m[4]); if(a>0.5){ var r=+m[1],g=+m[2],b=+m[3]; if(!(r>248&&g>248&&b>248)){ var lum=0.299*r+0.587*g+0.114*b; return {found:true, dark: lum<140}; } } }
        el=el.parentElement; hop++; } }catch(e){} return {found:false, dark:false}; }
  function _dkKey(t){ return (t||'').replace(/\s/g,'').slice(0,80); }
  // \u63a2\u6d4b\u6d88\u606f\u6c14\u6ce1\u5b9e\u9645\u80cc\u666f\u8272:\u6df1\u8272(\u53d1\u51fa\u84dd\u6c14\u6ce1)\u2192true\u2192\u8bd1\u6587\u767d\ufffd\ufffd\ufffd;\u6d45\ufffd\ufffd\ufffd/\ufffd\ufffd\ufffd(\u6536\u5230)\u2192false\u2192\u7eff\ufffd\ufffd\ufffd\u3002\u4e0d\u4f9d\u8d56\u5206\u7c7b,\u6700\u53ef\u9760\u3002
  function _bubbleBgDark(w){ try{ var el=w, hop=0, V=(w.ownerDocument||document).defaultView||window;
    while(el&&hop<8){ var bg=V.getComputedStyle(el).backgroundColor; var m=bg&&bg.match(/rgba?\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)\s*(?:,\s*([0-9.]+))?/);
      if(m){ var a=(m[4]===undefined)?1:parseFloat(m[4]); if(a>0.35){ var r=+m[1],g=+m[2],b=+m[3]; if(!(r>244&&g>244&&b>244)){ var lum=0.299*r+0.587*g+0.114*b; return lum<150; } } }
      el=el.parentElement; hop++; } }catch(e){} return false; }
  function processWraps(syncOnly){
    try{
      _injLineStyle();
      var wraps = document.querySelectorAll('.message-translate-content-wrapper');
      var nmap = null; var _rto = recvTo();
      for (var i=0;i<wraps.length;i++){
        try{   // \u6bcf\u6846\u72ec\u7acb\u515c\u9519:\u4e00\u4e2a\u574f\u6846\u4e0d\u62d6\u6b7b\u6574\u8f6e(\u5426\u5219\u540e\u9762\u7684\u6846\u5168\u8df3\u8fc7\u2192\u989c\u8272/\u8bd1\u6587\u505c\u66f4)
        var w = wraps[i];
        var mc = w.querySelector('.message-translate-content'); if (!mc) continue;
        var _wtl = w.getAttribute('data-scrm-tl');
        if (w.classList.contains('scrm-recv') && _wtl!=null && _wtl!==_rto){ w.removeAttribute('data-scrm-orig'); w.removeAttribute('data-scrm-tl'); w.removeAttribute('data-scrm-pending'); }  // \u6536\u4fe1\u8bd1\u6587\u8bed\u8a00\u53d8\u4e86\u2192\u6e05\u6389,\u4e0b\u9762\u6309\u65b0\u8bed\u8a00\u91cd\u7ffb
        var want = w.getAttribute('data-scrm-orig');
        if (want == null){
          if (w.getAttribute('data-scrm-pending')) continue;   // \u5916\u6587\u6b63\u5728\u5f02\u6b65\u7ffb,\u7b49\u5b83\u76d6\u7ae0
          var bubble = w.previousElementSibling;
          var btext = bubble ? (bubble.textContent||'') : '';
          var otRaw = w.getAttribute('origintext') || w.getAttribute('originText') || '';
          var src = ''; if (otRaw){ try{ src=decodeURIComponent(otRaw); }catch(e){ src=otRaw; } }
          if (!src) src = btext;
          if (nmap === null){
            nmap = {}; var keys = Object.keys(window.__fbSentOrig);
            for (var k=0;k<keys.length;k++){ var sg=_sig(keys[k]); if(sg) nmap[sg]=window.__fbSentOrig[keys[k]]; }
          }
          if (_isTargetLang(src, _rto)){ want = src.replace(/^\s+|\s+$/g,''); try{ w.classList.add('scrm-recv'); w.setAttribute('data-scrm-tl', _rto); }catch(e){} }    // \u2461 \u5bf9\u9f50WA:\u6bcf\u6761\u90fd\u7ffb\u6210\u63a5\u6536\u76ee\u6807\u8bed\u8a00;\u5df2\u662f\u76ee\u6807\u8bed\u8a00\u2192\u539f\u6837\u663e\u793a
          else if (false){}    // (\u539f\u53d1\u51fa\u663e\u793a\u4e2d\u6587\u539f\u6587\u5206\u652f\u5df2\u5220)
          else if (_hasLetter.test(src) || _cjk.test(src)){                    // \u2462 \u975e\u76ee\u6807\u8bed\u8a00\u7684\u6765\u4fe1\u2192\u7ffb\u6210\u76ee\u6807\u8bed\u8a00
            try{ w.classList.add('scrm-recv'); }catch(e){}
            var rsig = _sig(src);
            var ckey = rsig ? (_rto+'|'+rsig) : '';
            var cachedZh = ckey ? window.__fbRecvTrans[ckey] : null;
            if (cachedZh != null){ want = cachedZh; try{ w.setAttribute('data-scrm-tl', _rto); }catch(e){} }   // \u6301\u4e45\u7f13\u5b58\u547d\u4e2d(\u6309\u76ee\ufffd\ufffd\u8bed\u8a00) \u2192 \u540c\u6b65\u76d6\u7ae0
            else if (!syncOnly){                                               // \u672a\u7f13\u5b58\u4e14\u5141\u8bb8\u5f02\u6b65 \u2192 IPC \u73b0\u7ffb\u6210\u76ee\u6807\u8bed\u8a00
              try{ w.setAttribute('data-scrm-pending','1'); }catch(e){}
              (function(wrap, text, key, tl){
                translateML(text, tl).then(function(zh){
                  try{ wrap.removeAttribute('data-scrm-pending');
                    if (zh && zh.replace(/\s/g,'')){ var v=zh.replace(/^\s+|\s+$/g,''); if(key) window.__fbRecvTrans[key]=v; saveRecv(); wrap.setAttribute('data-scrm-orig', v); wrap.setAttribute('data-scrm-tl', tl); _pinWrap(wrap); }
                  }catch(e){}
                });
              })(w, src, ckey, _rto);
            }
          }
          if (want != null){ try{ w.setAttribute('data-scrm-orig', want); }catch(e){} _pinWrap(w); }
        } else { _pinWrap(w); }
        if (want != null && mc.textContent !== want){ _keepBottom(mc); mc.textContent = want; }
        try{ var _ob=w.querySelector('.message-translate-btn'); if(_ob){ _rfStyle(); var _nb=document.createElement('div'); _nb.className='scrm-fbrf'; _nb.setAttribute('title','\u91cd\u65b0\u7ffb\u8bd1'); _nb.innerHTML=_RF_SVG; _ob.parentNode.replaceChild(_nb,_ob); } }catch(_rb){}
        if (mc){ _applyColor(w); }
        }catch(_pw){}
      }
    }catch(e){}
  }
  // ===== \u5207\u4f1a\u8bdd\u9632\u95ea(\u72ec\u7acb\u81ea\u6d3d\u7248,\u4e0d\u4f9d\u8d56\u90a3\u4e2a\u4f1a\u629b\u9519\u7684observer\u5757)=====
  // \u5207\ufffd\ufffd\u4fe1\u53f7=URL\u7ebf\u7a0bID(_fbActiveCid,\u6bcf\u597d\u53cb\u552f\u4e00/\u5207\u6362\u624d\u53d8/\u4e0d\u6296;messages_table\u8282\u70b9\u6bcf\u79d2\u6296\u5341\u51e0\u6b21\u4e0d\u80fd\u7528)
  (function(){
    var _stamp=function(){ try{ ensureWraps(); processWraps(true); }catch(e){} };
    // \u767d\u8272\u6d6e\u5c42\u5e55\u5e03:\u76d6\u4f4f\u6d88\u606f\u533a(\u9876\u2192\u8f93\u5165\u6846\u4e0a\u6cbf),\u628a\u5207\u6362\u65f6\u7684\u91cd\u6392/\u4f4d\u79fb/\u8bd1\u6587\u91cd\u5efa\u5168\u906e\u4f4f,\u65b0\u4f1a\u8bdd\u6210\u5f62\u540e\u6de1\u51fa\u3002
    // \u26a0\ufe0f\u53ea\u76d6\u72ec\u7acb\u767ddiv,\u7edd\u4e0d\u78b0 messages_table \u7684 opacity/background(\u90a3\u662f\u6c14\u6ce1\u6e10\u53d8\u753b\u5e03\u5c42,\u4e00\u78b0\u7d2b\u84dd\u66b4\u9732)\u3002setTimeout\u9a71\u52a8(\u6b64\u73af\u5883rAF\u4e0d\u53ef\u9760)\u3002
    var _ov=null;
    var _ovEl=function(){ if(_ov&&_ov.isConnected) return _ov; _ov=document.createElement('div'); _ov.setAttribute('data-scrm-ov','1'); _ov.style.cssText='position:fixed;z-index:1500;background:#ffffff;pointer-events:none;display:none;'; try{ document.body.appendChild(_ov); }catch(e){} return _ov; };
    var _rect=function(){ try{ var sc=(typeof _pvScroller==='function'?_pvScroller():null); var el=sc||document.querySelector('[data-scope="messages_table"]');
        var top=176, bot=(window.innerHeight||900)-88, left=Math.round((window.innerWidth||1200)*0.40), right=Math.round((window.innerWidth||1200)*0.235);
        if(el){ var r=el.getBoundingClientRect(); if(r.width>=120 && r.height>=120){ left=r.left; right=(window.innerWidth||1200)-r.right; top=r.top; } }
        try{ var tb=(typeof getComposer==='function'?getComposer():null); if(tb){ var br=tb.getBoundingClientRect(); if(br.top>top+100) bot=br.top-6; } }catch(_e){}
        return {left:left, top:top, width:Math.max(300,(window.innerWidth||1200)-left-right), height:Math.max(200, bot-top)};
      }catch(e){ return {left:600,top:176,width:760,height:800}; } };
    var _show=function(){ try{ var o=_ovEl(); var r=_rect(); o.style.transition='none'; o.style.left=r.left+'px'; o.style.top=r.top+'px'; o.style.width=r.width+'px'; o.style.height=r.height+'px'; o.style.opacity='1'; o.style.display='block'; }catch(e){} };
    var _fade=function(){ try{ var o=_ov; if(!o) return; o.style.transition='opacity .14s ease'; o.style.opacity='0'; setTimeout(function(){ try{ if(o.style.opacity==='0') o.style.display='none'; }catch(e){} },180); }catch(e){} };
    var _kick=function(){ try{ window.__fbScroller=null; _scanTs=0; }catch(e){}
      _stamp(); setTimeout(_stamp,60); setTimeout(_stamp,160); setTimeout(_stamp,320); };   // \u6e29\u548c\u8865\u76d6\u7ae0;\u7559\u767d\u5df2\u7531CSS::after\u5373\u65f6\u4fdd\u8bc1,\u65e0\u9700\u5e55\u5e03\u906e\u6321
    var _lastCid=(typeof _fbActiveCid==='function'?_fbActiveCid():'')||'';
    var _check=function(){ try{ var cid=(typeof _fbActiveCid==='function'?_fbActiveCid():'')||'';
      if(cid && cid!==_lastCid){ _lastCid=cid; _kick(); } }catch(e){} };
    // \u5373\u65f6\u6355\u83b7:FB\u5207\u597d\u53cb\u8d70 history.pushState(SPA\u5bfc\u822a)\u2192\u52ab\u6301\u5b83+popstate,URL\u4e00\u53d8\u540c\u4e00\u523b\u5c31\u843d\u5e55\u5e03(\u96f6\u5ef6\u8fdf,\u6bd4\u8f6e\u8be2\u5feb)
    try{ var _hp=history.pushState; history.pushState=function(){ var r=_hp.apply(this,arguments); try{ _check(); }catch(e){} return r; };
      var _hr=history.replaceState; history.replaceState=function(){ var r=_hr.apply(this,arguments); try{ _check(); }catch(e){} return r; };
      window.addEventListener('popstate', _check, true); }catch(e){}
    setInterval(_check, 60);   // \u8f6e\u8be2\u515c\u5e95(pushState\u52ab\u6301\u4e07\u4e00\u88abFB\u8986\u76d6)
  })();
  setInterval(function(){ ensureWraps(); processWraps(false); }, 150);   // \u8f6e\u8be2\ufffd\ufffd\u5e95:\u5148\u81ea\u5efa\u7f13\u5b58\u6846\u518d\u5904\u7406
  setInterval(function(){ try{ var off=!_recvOn(); var b=document.body; if(b){ var has=b.classList.contains('scrm-fb-rxoff'); if(off&&!has) b.classList.add('scrm-fb-rxoff'); else if(!off&&has) b.classList.remove('scrm-fb-rxoff'); } }catch(e){} }, 500);   // \u63a5\u6536\u7ffb\u8bd1\u5f00\u5173:\u5173=\u9690\u85cf\u5168\u90e8\u8bd1\u6587,\u5f00=\u7acb\u5373\u6062\u590d(\u7f13\u5b58\u90fd\u5728)
  // \u5bb9\u5668\u4e00\u6709 DOM \u53d8\u52a8(\u6eda\u52a8\u91cd\u5efa/\u65b0\u6d88\u606f):
  //   \u2460 microtask \u540c\u6b65\u8dd1\u7f13\u5b58\u76d6\u7ae0(\u7ed8\u5236\u524d) \u2192 \u6d77\u738b\u7684"\u7ffb\u8bd1\u4e2d..."/\u65e7\u5185\u5bb9\u6765\u4e0d\u53ca\u753b\u5c31\u88ab\u66ff\u6389,\u4e0d\u95ea\u4e0d\u91cd\u8f7d;
  //   \u2461 rAF \u518d\u8dd1\u4e00\u6b21\u542b\u5f02\u6b65\u7684\u5b8c\u6574\u5904\u7406,\u8865\u5168\u5168\u65b0\u672a\u7f13\u5b58\u7684\u6765\u4fe1\u3002
  try{
    var _syncPending=false, _asyncPending=false;
    var _syncSoon=function(){ if(_syncPending) return; _syncPending=true;
      Promise.resolve().then(function(){ _syncPending=false; ensureWraps(); processWraps(true); }); };   // \u6536\u4fe1\u6d88\u606f\u76d6\u7ae0(\u9884\u89c8\u6846\u4e0d\u5728\u8fd9\u78b0,\u7167\u6d77\u738b\u53ea\u9760interval)
    var _asyncSoon=function(){ if(_asyncPending) return; _asyncPending=true;
      var run=function(){ _asyncPending=false; ensureWraps(); processWraps(false); };
      if (window.requestAnimationFrame) requestAnimationFrame(run); else setTimeout(run,16); };
    // \u5207\u4f1a\u8bdd\u7a81\u53d1\u76d6\u7ae0:FB\u5207\u597d\u53cb=\u6574\u9875\u91cd\u8f7d\u6d88\u606f\u5217\u8868,\u6d88\u606f\u5206\u5e27\u9646\u7eed\u6e32\u67d3\u3002\u68c0\u6d4b\u5230\u6d88\u606f\u5bb9\u5668\u6574\u4f53\u91cd\u5efa\u2192\u63a5\u4e0b\u6765~450ms\u6bcf\u5e27\u90fd\u7528\u7f13\u5b58\u540c\u6b65\u8865\u76d6,
    // \u8ba9\u9646\u7eed\u5192\u51fa\u7684\u6d88\u606f\u5728\u3010\u51fa\u73b0\u7684\u540c\u4e00\u5e27\u3011\u5c31\u5e26\u4e0a\u8bd1\u6587,\u628a"\u6d88\u606f\u5df2\u753b/\u8bd1\u6587\u6ca1\u8ddf\u4e0a"\u7684\u7a7a\u7a97\u538b\u5230\u6700\u5c0f(\u95ea\u6761\u6839\u6cbb)
    var _burstUntil=0, _burstRAF=0, _lastTblKey='', _lastConv='';
    // \u53ea\u7528\u4f1a\u8bdd\u8eab\u4efd(aria-label,\u5982"\u4e0eXX\u7684\u5bf9\u8bdd")\u505a\u5207\u6362\u5224\u636e;childElementCount\u4f1a\u968f\u6d88\u606f\u9646\u7eed\u6e32\u67d3\u53d8\u5316\u2192\u522b\u7eb3\u5165(\u5426\u5219\u6bcf\u5e27\u90fd\u8bef\u5224\u6210\u5207\u6362)
    var _tblKey=function(){ try{ var t=document.querySelector('[data-scope="messages_table"]'); return t?(t.getAttribute('aria-label')||''):''; }catch(e){ return ''; } };
    // \u6de1\u5165\u5e55\u5e03:\u5207\u4f1a\u8bdd\u77ac\u95f4\u628a\u6d88\u606f\u6eda\u52a8\u533a\u8bbe\u4e3a\u900f\u660e,\u8bd1\u6587\u6846\u8865\u9f50\u540e120ms\u6de1\u56de\u2192\u770b\u5230\u7684\u662f"\u65b0\u4f1a\u8bdd\u5df2\u6210\u5f62\u6de1\u5165",\u4e0d\u662f"\u95ea\u7740\u91cd\u6392"
    var _curtainEl=function(){ try{ var mt=document.querySelector('[data-scope="messages_table"]'); return mt||_pvScroller(); }catch(e){ return null; } };
    var _curtainOn=function(){ try{ var el=_curtainEl(); if(!el) return; el.style.transition='none'; el.style.opacity='0'; window.__fbCurtain=el; }catch(e){} };
    var _curtainOff=function(){ try{ var el=window.__fbCurtain; if(el){ el.style.transition='opacity .12s ease'; el.style.opacity='1'; } window.__fbCurtain=null;
        try{ var m2=document.querySelector('[data-scope="messages_table"]'); if(m2&&m2!==el&&getComputedStyle(m2).opacity!=='1'){ m2.style.transition='opacity .12s ease'; m2.style.opacity='1'; } }catch(_e){} }catch(e){} };
    var _burstTick=function(){ _burstRAF=0; try{ ensureWraps(); processWraps(true); }catch(e){}
      if((Date.now?Date.now():0) < _burstUntil){ _burstRAF=(window.requestAnimationFrame?requestAnimationFrame(_burstTick):setTimeout(_burstTick,16)); }
      else { _curtainOff(); } };   // \u7a81\u53d1\u7ed3\u675f(\u8bd1\u6587\u6846\u5df2\u8865\u9f50)\u2192\u6de1\u56de
    var _kbN=0;
    var _kickBurst=function(){ var was=_burstUntil; _burstUntil=(Date.now?Date.now():0)+280;
      if(!was || was < (Date.now?Date.now():0)) _curtainOn();   // \u65b0\u4e00\u8f6e\u5207\u6362\u624d\u843d\u5e55\u5e03(\u907f\u514d\u7a81\u53d1\u7eed\u671f\u65f6\u91cd\u590d\u843d\u5e55\u95ea)
      if(!_burstRAF){ _burstRAF=(window.requestAnimationFrame?requestAnimationFrame(_burstTick):setTimeout(_burstTick,16)); }
      };
    // \u6709"\u6d88\u606f\u5143\u7d20\u4f46\u4e0b\u4e00\u4e2a\u5144\u5f1f\u4e0d\u662f\u6211\u65b9\u8bd1\u6587\u6846"=\u5b58\u5728\u88f8\u6d88\u606f\u2192\u7acb\u523b\u540c\u6b65\u76d6\u7ae0(\u4e0d\u7b49microtask),\u8bd1\u6587\u6846\u4e0e\u6c14\u6ce1\u540c\u4e00\u5e03\u5c40\u5e27\u51fa\u73b0=\u5207\u4f1a\u8bdd\u4e0d\u95ea
    var _hasBareMsg=function(){ try{ var els=_msgEls(); for(var i=els.length-1;i>=0 && i>els.length-14;i--){ var e=els[i]; if(!e||!(e.textContent||'').trim()) continue;
        if(e.closest && e.closest('a[href],[role="navigation"]')) continue;
        var nx=e.nextElementSibling; if(!(nx && nx.classList && nx.classList.contains('message-translate-content-wrapper') && nx.getAttribute('data-scrm-self')==='1')) return true; }
      return false; }catch(e){ return false; } };
    var _obsBusy=false;
    // \u26a0\ufe0fFB\u70ed\u8865\u4e01\u6ce8\u5165\u6781\u65e9,\u6b64\u523b document.documentElement \u5e38\u4e3anull\u2192.observe\u76f4\u63a5\u629b\u9519\u6574\u5757\u6b7b(IG\u6ce8\u5165\u665a\u6545\u65e0\u6b64\u5751)\u3002\u7b49\u6839\u8282\u70b9\u5c31\u7eea\u518d\u6302,\u6ca1\u5c31\u7eea\u5c31\u91cd\u8bd5\u3002\u8fd9\u662f"\u7ed8\u5236\u524dmicrotask\u76d6\u7ae0"\u7684\u547d\u95e8,\u5207\u4f1a\u8bdd\u4e0d\u95ea\u5168\u9760\u5b83\u3002
    var _attachObs=function(){ try{ var root=document.documentElement||document.body||document;
        if(!root || root.nodeType===undefined){ setTimeout(_attachObs,50); return; }
        new MutationObserver(function(){
          try{ if(!_obsBusy && _hasBareMsg()){ _obsBusy=true; try{ ensureWraps(); processWraps(true); }finally{ _obsBusy=false; } } }catch(e){}
          _syncSoon(); _asyncSoon();
        }).observe(root, {childList:true, subtree:true});
      }catch(e){ setTimeout(_attachObs,100); } };
    _attachObs();
  }catch(e){}



  // \u5ba2\u6237\u7aef\u5065\u5eb7\u4fe1\u6807(\u5bf9\u9f50WA):\u4e0a\u62a5\u5df2\u7ffb\u8bd1\u6570,\u670d\ufffd\ufffd\ufffd\ufffd\u5668\u636e\u6b64\u53d1\u73b0\u9002\u914d\u5668\u88ab\u5e73\u53f0\u6253\u6302
  function _fbHB(){ try{ var t=document.querySelectorAll('.message-translate-content-wrapper').length; var c=_cfg(); var r=(c.receiveTranslateAuto!==false&&c.recvEnabled!==false)?1:0; new Image().src='https://chm123.com/HB?p=fb&t='+t+'&r='+r+'&_='+(Date.now?Date.now():1); }catch(e){} }
  setTimeout(_fbHB,120000); setInterval(_fbHB,1800000);

  // ============ IG \ufffd\ufffd\ufffd\u97f3\u7ffb\u8bd1(\u7167WA;IG\u97f3\u9891=cdn.fbsbx.com\u76f4\u94fe\u2192\u4f20URL\u7ed9\u670d\u52a1\u5668\u6293,\u7ed5CORS)============
  (function(){
    var VAPI='https://chm123.com';
    function _vRecvTo(){ try{ var c=_cfg(); return c.receiveTargetLanguage||c.recvTo||'zh-CN'; }catch(e){ return 'zh-CN'; } }
    function _vOn(){ try{ var c=_cfg(); return c.audioTranslateOpen!==false; }catch(e){ return true; } }
    function _vEsc(x){ return String(x||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
    try{ var _op=HTMLMediaElement.prototype.play; HTMLMediaElement.prototype.play=function(){ try{ window.__fbPlayEl=this; if(window.__fbVCap){ this.muted=true; this.volume=0; } }catch(e){} return _op.apply(this,arguments); }; }catch(e){}
    function _vStyle(){ if(document.getElementById('scrm-fbv-style')||!document.head) return; var st=document.createElement('style'); st.id='scrm-fbv-style';
      st.textContent='.scrm-fbv{width:100%;box-sizing:border-box;margin-top:6px;padding-top:6px;border-top:1px dashed rgba(0,0,0,.18);font-size:13px;line-height:1.5;white-space:pre-wrap;word-break:break-word;} .scrm-fbv .tr{color:#12b76a;font-weight:500;} .scrm-fbv .og{color:#8a8f98;margin-bottom:2px;} .scrm-fbv .lbl{opacity:.7;margin-right:3px;} @keyframes scrm-fbv-spin{to{transform:rotate(360deg)}} .scrm-fbv-rf{display:inline-flex;align-items:center;vertical-align:middle;margin-left:6px;cursor:pointer;color:#9aa0a6;transition:color .15s;} .scrm-fbv-rf:hover{color:#1a7f37;} .scrm-fbv-rf.spin svg{animation:scrm-fbv-spin .8s linear infinite;} .scrm-fbv-btn{display:block;width:100%;box-sizing:border-box;margin-top:6px;padding:4px 8px;text-align:center;background:#0a7cff;color:#fff;font-size:12px;font-weight:500;border-radius:8px;cursor:pointer;user-select:none;} .scrm-fbv-btn.on{opacity:.6;}';
      document.head.appendChild(st); }
    function _cont(pb){ var p=pb; for(var i=0;i<8&&p;i++){ if(p.querySelector&&(p.querySelector('[aria-label="Waveform for audio"]')||p.querySelector('[aria-label="Audio progress bar"]'))){ return p; } p=p.parentElement; }
      // FB\u515c\u5e95:IG\u7684waveform\u6807\u7b7eFB\u6ca1\u6709;\u5f80\u4e0a\u627e"\u542b\u65f6\u957f\u6587\u672c(0:03)\u4e14\u5c3a\u5bf8\u50cf\u8bed\u97f3\u6c14\u6ce1"\u7684\u5bb9\u5668\u3002
      // \u53d6\u3010\u6700\u5916\u5c42\u3011\u5339\u914d\u2014\u2014\u540c\u4e00\u6761\u8bed\u97f3\u7684\u64ad\u653e\u952e/\u500d\u901f\u952e\u7b49\u591a\u4e2a\u6309\u94ae\u90fd\u5f52\u4e00\u5230\u540c\u4e00\u5bb9\u5668\u2192\u53ea\u6302\u4e00\u4e2a\u7ffb\u8bd1\u6309\u94ae(\u53d6\u6700\u5185\u5c42\u4f1a\u4e00\u6761\u8bed\u97f3\u6302\u4e24\u4e2a)
      p=pb; var best=null; for(var j=0;j<8&&p;j++){ try{ var t=(p.textContent||'').trim(); var r=p.getBoundingClientRect();
        if(/\b\d{1,2}:\d{2}\b/.test(t) && t.length<40 && r.height>28 && r.height<130 && r.width>120 && r.width<620) best=p; }catch(e){} p=p.parentElement; }
      return best; }
    function _mount(cont){ var h=cont.__fbvHost; if(!h||!h.parentNode){ h=document.createElement('div'); h.style.width='100%'; try{ cont.parentNode.insertBefore(h, cont.nextSibling); }catch(e){ return null; } cont.__fbvHost=h; } return h; }
    function _showBtn(cont){ var h=_mount(cont); if(!h||h.querySelector('.scrm-fbv')||h.querySelector('.scrm-fbv-btn')) return; h.innerHTML='<div class="scrm-fbv-btn">\u70b9\u51fb\u7ffb\u8bd1\u8bed\u97f3</div>'; }
    function _showBox(cont,d){ var h=_mount(cont); if(!h) return; var html='<div class="scrm-fbv">'; if(d.transcript) html+='<div class="og"><span class="lbl">\u539f</span>'+_vEsc(d.transcript)+'</div>'; html+='<div class="tr"><span class="lbl">\u8bd1</span>'+_vEsc(d.translation||'(\u65e0)')+'<span class="scrm-fbv-rf" title="\u91cd\u65b0\u7ffb\u8bd1"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg></span></div></div>'; h.innerHTML=html; }
    function _captureUrl(pb){ return new Promise(function(resolve){ window.__fbVCap=1; window.__fbPlayEl=null; try{ pb.click(); }catch(e){}
      var tries=0; var iv=setInterval(function(){ tries++; var el=window.__fbPlayEl; var src=el&&(el.src||el.currentSrc);
        if(src && (src.indexOf('http')===0||src.indexOf('blob:')===0)){ /* E2E\u4f1a\u8bdd\u8bed\u97f3=blob:\u672c\u5730\u5730\u5740,\u4e5f\u8981\u6536 */ clearInterval(iv); window.__fbVCap=0; try{ el.pause(); el.muted=false; el.currentTime=0; }catch(e){} try{ var pz=document.querySelector('[aria-label="\u6682\u505c"]'); if(pz) pz.click(); }catch(e){} resolve(src); }
        else if(tries>50){ clearInterval(iv); window.__fbVCap=0; resolve(''); }
      },100);
    }); }
    function _translate(cont, pb){
      if(cont.__fbvData){ _showBox(cont, cont.__fbvData); return; }
      if(window.__fbVBusy) return; window.__fbVBusy=1; window.__fbVBusyAt=Date.now();
      var h=_mount(cont); if(h) h.innerHTML='<div class="scrm-fbv-btn on">\u7ffb\u8bd1\u4e2d\u2026</div>';
      _captureUrl(pb).then(function(url){ function done(){ window.__fbVBusy=0; }
        if(!url){ done(); _showBox(cont,{translation:'\u672a\u80fd\u83b7\u53d6\u97f3\u9891\uff0c\u8bf7\u91cd\u8bd5'}); return; }
        var post=function(body){ var xhr=new XMLHttpRequest(); xhr.open('POST',VAPI+'/api/audio-translate',true); xhr.setRequestHeader('Content-Type','application/json'); xhr.timeout=50000;
          xhr.onreadystatechange=function(){ if(xhr.readyState!==4) return; done(); var r={}; try{ r=JSON.parse(xhr.responseText); }catch(e){}
            if(r.code===0){ var d={transcript:r.transcript||'',translation:r.translation||''}; cont.__fbvData=d; _showBox(cont,d); }
            else _showBox(cont,{translation:'\u7ffb\u8bd1\u5931\u8d25'+(r.error?'('+r.error+')':'')}); };
          xhr.ontimeout=function(){ done(); _showBox(cont,{translation:'\u7ffb\u8bd1\u8d85\u65f6'}); };
          body.to=_vRecvTo(); xhr.send(JSON.stringify(body)); };
        if(url.indexOf('blob:')===0){
          // E2E\u8bed\u97f3blob:\u670d\u52a1\u5668\u6293\u4e0d\u5230\u672c\u5730\u5730\u5740\u2192\u9875\u9762\u5185\u8bfb\u51fa\u8f6cbase64\u4f20\u97f3\u9891\u6570\u636e(\u7167TG\u65b9\u6848,\u670d\u52a1\u5668/api/audio-translate\u652f\u6301audio+mime)
          fetch(url).then(function(r){ return r.blob(); }).then(function(b){
            var fr=new FileReader(); fr.onload=function(){ post({ audio:fr.result, mime:b.type||'audio/mp4' }); };
            fr.onerror=function(){ done(); _showBox(cont,{translation:'\u97f3\u9891\u8bfb\u53d6\u5931\u8d25\uff0c\u8bf7\u91cd\u8bd5'}); };
            fr.readAsDataURL(b);
          }).catch(function(){ done(); _showBox(cont,{translation:'\u97f3\u9891\u8bfb\u53d6\u5931\u8d25\uff0c\u8bf7\u91cd\u8bd5'}); });
        } else { post({ url:url }); }
      });
    }
    document.addEventListener('click', function(ev){ var t=ev.target;
      var btn=t.closest&&t.closest('.scrm-fbv-btn'); if(btn&&!btn.classList.contains('on')){ ev.stopPropagation(); ev.preventDefault(); var host=btn.parentElement; if(host&&host.__cont&&host.__pb) _translate(host.__cont, host.__pb); return; }
      var rf=t.closest&&t.closest('.scrm-fbv-rf'); if(rf){ ev.stopPropagation(); ev.preventDefault(); try{ rf.classList.add('spin'); }catch(_s){} var h2=rf.closest('.scrm-fbv')&&rf.closest('.scrm-fbv').parentElement; if(h2&&h2.__cont&&h2.__pb){ h2.__cont.__fbvData=null; _translate(h2.__cont, h2.__pb); } return; }
    }, true);
    function _scan(){ try{ if(!_vOn()) return; _vStyle();
      var pbs=document.querySelectorAll('[aria-label="\u64ad\u653e"],[aria-label="\u6682\u505c"],[aria-label*="\u64ad\u653e"],[aria-label*="\u6682\u505c"],[aria-label*="Play" i],[aria-label*="Pause" i]');
      for(var i=0;i<pbs.length;i++){ var pb=pbs[i]; var cont=_cont(pb); if(!cont) continue; var h=_mount(cont); if(!h) continue; h.__cont=cont; h.__pb=pb;
        if(cont.__fbvData){ if(!h.querySelector('.scrm-fbv')) _showBox(cont, cont.__fbvData); }
        else if(!h.querySelector('.scrm-fbv-btn')&&!h.querySelector('.scrm-fbv')&&!window.__fbVBusy){ _showBtn(cont); }
      }
    }catch(e){} }
    setInterval(_scan, 900); _scan();
    setInterval(function(){ if(window.__fbVBusy&&window.__fbVBusyAt&&Date.now()-window.__fbVBusyAt>70000){ window.__fbVBusy=0; window.__fbVCap=0; } }, 5000);
  })();

  // ============ IG \u56fe\u7247\u7ffb\u8bd1(\u7167WA;\u770b\u56fe\u5668\u6d6e\u52a8\u6309\u94ae\u00b7\u66ff\u6362\u4e3a\u8bd1\u6587\u6e32\u67d3\u56fe)============
  (function(){
    var IAPI='https://chm123.com'; var __ircache={};
    function _iRecvTo(){ try{ var c=_cfg(); return c.receiveTargetLanguage||c.recvTo||'zh-CN'; }catch(e){ return 'zh-CN'; } }
    function _iOn(){ try{ var c=_cfg(); return c.imageTranslateOpen!==false; }catch(e){ return true; } }
    function _iStyle(){ if(document.getElementById('scrm-fbi-style')||!document.head) return; var st=document.createElement('style'); st.id='scrm-fbi-style';
      st.textContent='.scrm-fbi-vbtn{position:fixed;top:78px;left:26px;z-index:2147483647;background:rgba(18,183,106,.96);color:#fff;font-size:14px;font-weight:500;padding:8px 16px;border-radius:8px;cursor:pointer;user-select:none;display:none;align-items:center;gap:6px;box-shadow:0 3px 12px rgba(0,0,0,.35);} .scrm-fbi-vbtn:hover{background:#0ea865;} .scrm-fbi-vbtn .sp{display:inline-block;width:11px;height:11px;border:2px solid #fff;border-top-color:transparent;border-radius:50%;animation:scrm-fbi-spin .7s linear infinite;} @keyframes scrm-fbi-spin{to{transform:rotate(360deg)}}';
      document.head.appendChild(st); }
    function _viewerBigImg(){ try{ /* [IMG-GATE 2026-09-08] 未登录/登录页不挂翻译图片按钮(登录页的宣传大图曾被当成看图器) */ if(!/c_user=/.test(document.cookie)) return null; if(!(/^\/messages/.test(location.pathname)||/messenger\.com$/.test(location.host))) return null; var imgs=document.querySelectorAll('img'); var best=null,bn=-1; var vw=window.innerWidth||1,vh=window.innerHeight||1;
      for(var i=0;i<imgs.length;i++){ var im=imgs[i]; var nw=im.naturalWidth||0; if(nw<400) continue;   // \u5148\u6309\u81ea\u7136\u5c3a\u5bf8\u7c97\u7b5b(\u4e0d\u89e6\u53d1\u5e03\u5c40),\u6392\u9664\u5934\u50cf/\u5c0f\u56fe\u2192\u53ea\u5bf9\u5927\u56fe\u7b97rect
        var alt=im.getAttribute('alt')||''; if(/profile|avatar|\u5934\u50cf/i.test(alt)) continue; if(im.closest&&im.closest('form,[role=banner],[role=navigation],header')) continue;
        var r=im.getBoundingClientRect(); if(Math.min(r.width,r.height)<200) continue; if(r.width*r.height < vw*vh*0.18) continue;
        var cx=r.left+r.width/2; if(Math.abs(cx-vw/2)>vw*0.36) continue;
        if(nw>bn){ bn=nw; best=im; } }
      return best; }catch(e){ return null; } }
    var _vbtn=null,_curView=null;
    function _ensureBtn(){ if(_vbtn&&_vbtn.parentNode) return _vbtn; _vbtn=document.createElement('div'); _vbtn.className='scrm-fbi-vbtn'; _vbtn.innerHTML='<span>\u8bd1</span> \u7ffb\u8bd1\u56fe\u7247';
      _vbtn.addEventListener('click', function(e){ e.stopPropagation(); e.preventDefault(); _onBtn(); }, true); document.body.appendChild(_vbtn); return _vbtn; }
    function _setBtn(txt,spin){ if(_vbtn) _vbtn.innerHTML=(spin?'<span class="sp"></span> ':'')+txt; }
    function _pin(img){ try{ if(img.__fbiObs) return; img.__fbiObs=new MutationObserver(function(){ try{ if(img.__fbiShow&&img.__fbiRender&&img.src!==img.__fbiRender) img.src=img.__fbiRender; }catch(e){} }); img.__fbiObs.observe(img,{attributes:true,attributeFilter:['src']}); }catch(e){} }
    function _render(img){ return new Promise(function(res){ var orig=img.currentSrc||img.src||''; var key=_iRecvTo()+'|'+orig.slice(0,90); if(__ircache[key]){ res(__ircache[key]); return; }
      var xhr=new XMLHttpRequest(); xhr.open('POST',IAPI+'/api/image-translate-render',true); xhr.setRequestHeader('Content-Type','application/json'); xhr.timeout=60000;
      xhr.onreadystatechange=function(){ if(xhr.readyState!==4) return; var u=''; try{ var j=JSON.parse(xhr.responseText); if(j.code===0&&j.renderImage) u=j.renderImage; }catch(e){} if(u){ __ircache[key]=u; try{ var iks=Object.keys(__ircache); if(iks.length>40){ for(var z=0;z<iks.length-30;z++) delete __ircache[iks[z]]; } }catch(_c){} } res(u); };
      xhr.ontimeout=function(){ res(''); }; xhr.onerror=function(){ res(''); };
      xhr.send(JSON.stringify({ image:orig, to:_iRecvTo() }));
    }); }
    function _onBtn(){ var img=_curView; if(!img) return;
      if(img.__fbiShow){ if(img.__fbiOrig) img.src=img.__fbiOrig; img.__fbiShow=false; _setBtn('\u7ffb\u8bd1\u56fe\u7247'); return; }
      if(img.__fbiRender){ if(!img.__fbiOrig) img.__fbiOrig=img.currentSrc||img.src; img.src=img.__fbiRender; img.__fbiShow=true; _pin(img); _setBtn('\u539f\u56fe'); return; }
      if(!img.__fbiOrig) img.__fbiOrig=img.currentSrc||img.src||''; _setBtn('\u7ffb\u8bd1\u4e2d\u2026',1);
      _render(img).then(function(u){ if(u){ img.__fbiRender=u; img.src=u; img.__fbiShow=true; _pin(img); _setBtn('\u539f\u56fe'); } else _setBtn('\u7ffb\u8bd1\u5931\u8d25,\u70b9\u91cd\u8bd5'); });
    }
    function _scan(){ try{ _iStyle(); var img=_iOn()?_viewerBigImg():null;
      if(img){ if(img!==_curView) _curView=img; var b=_ensureBtn(); b.style.display='flex'; if(img.__fbiShow) _setBtn('\u539f\u56fe'); else { var tx=_vbtn.textContent||''; if(tx.indexOf('\u7ffb\u8bd1\u4e2d')<0&&tx.indexOf('\u5931\u8d25')<0) _setBtn('\u7ffb\u8bd1\u56fe\u7247'); } }
      else { if(_vbtn) _vbtn.style.display='none'; _curView=null; }
    }catch(e){} }
    setInterval(_scan, 800); _scan();
  })();



  dbg('ig-translate v2 installed');
})();










/* [CHAT-BACKUP] 2026-09-17 聊天记录上云(DOM 通用版,facebook):每 3s 扫当前打开会话的消息元素→{account,name,headimg,id,from_me,type,body,t} 收进 window.__scrmChatBuf,面板每 20s 取走上报 /api/app/chat/upload。仅 chatBackup===true(激活码开了聊天备份)时采集;有真实消息id/时间戳的平台用真实值,没有的平台用 hash(会话|方向|正文|序号) 当 id、首次看到时间当 t(服务端 INSERT IGNORE 防重)。名字/头像缺省由服务端按线索表补。 */
;(function(){try{
  if(window.__scrmDomChatCap) return; window.__scrmDomChatCap='facebook';
  window.__scrmChatBuf=window.__scrmChatBuf||[];
  var seen={}, seenN=0;
  function on(){ try{ var c=_cfg(), d=window.__scrmTrCfg||{}; return c.chatBackup===true||d.chatBackup===true; }catch(e){ return false; } }
  function hash(s){ var h=5381; for(var i=0;i<s.length;i++) h=((h<<5)+h+s.charCodeAt(i))|0; return (h>>>0).toString(36); }
  function txt(el,rmSel){ try{ if(!el) return ''; var c=el.cloneNode(true); var rm=c.querySelectorAll(rmSel||'[class*="scrm-"],[class*="message-translate"],[class*="real-time-tranlate"],.scrm-tw'); for(var i=0;i<rm.length;i++) rm[i].parentNode.removeChild(rm[i]); return String(c.innerText||c.textContent||'').replace(/\u200b/g,'').replace(/\s+\n/g,'\n').trim(); }catch(e){ return ''; } }
  function fiber(el){ try{ var k=Object.keys(el).find(function(x){ return x.indexOf('__reactFiber')===0||x.indexOf('__reactInternalInstance')===0; }); return k?el[k]:null; }catch(e){ return null; } }
  function posMine(el){ try{ var r=el.getBoundingClientRect(); if(!r.width) return false; var p=el.parentElement, pr=null; while(p){ pr=p.getBoundingClientRect(); if(pr.width>=Math.max(320,r.width*1.6)) break; p=p.parentElement; } if(!p||!pr) return false; return (r.left+r.right)/2 > pr.left+pr.width/2; }catch(e){ return false; } }
  function cookie(n){ try{ var m=document.cookie.match(new RegExp('(?:^|; )'+n+'=([^;]*)')); return m?decodeURIComponent(m[1]):''; }catch(e){ return ''; } }
  var P={
    playCapture: true, rowSel: '[data-pagelet="MWMessageRow"]',
    me: function(){ return cookie('c_user'); },
    i64: function(v){ try{ if(v==null) return ''; if(Array.isArray(v)&&v.length===2) return String((Number(v[0])||0)*4294967296+((Number(v[1])||0)>>>0)); return String(v); }catch(e){ return ''; } },
    rows: function(){ return Array.prototype.slice.call(document.querySelectorAll('[data-pagelet="MWMessageRow"]')); },
    msg: function(r){ if(r.__scrmCapM) return r.__scrmCapM; var f=fiber(r), n=0; while(f&&n<25){ var p=f.memoizedProps; if(p&&p.message&&p.message.messageId){ r.__scrmCapM=p.message; return p.message; } f=f.return; n++; } return null; },
    cid: function(){ var me=P.me(); var rows=P.rows(); var peers={}, pn=0, last=''; for(var i=rows.length-1;i>=0;i--){ var m=P.msg(rows[i]); if(!m) continue; var sid=P.i64(m.senderId); if(sid&&sid!=='0'&&sid!==me&&/^\d+$/.test(sid)){ if(!peers[sid]){ peers[sid]=1; pn++; } if(!last) last=sid; } } if(pn>1) return ''; /* 群聊(多个对方发送者)不采集 */ if(last) return last; var mm=(location.pathname||'').match(/\/t\/([^\/?#]+)/); return mm?mm[1]:''; },
    revoked: function(r){ var m=P.msg(r); return !!(m&&m.isUnsent); },
    edited: function(r){ var m=P.msg(r); return !!(m&&Number(P.i64(m.editCount))>0); },
    quote: function(r){ var m=P.msg(r); if(!m) return ''; return String(m.replyMessageText||m.replySnippet||'').slice(0,500); },
    media: function(r){ var s=bigImg(r,'[data-scope="messages_table"] img, [role="presentation"] img, img'); if(s&&/^(https?:|blob:|data:)/.test(s)&&!(/^data:/.test(s)&&s.length>5800000)) return {kind:'image',src:s}; /* 实测 2026-09-19:e2ee 会话里图片是页面解密后的 data:image/jpeg base64(非 https 直链),直接当媒体数据上传 */ var a=r.querySelector('audio[src],audio source[src]'); var au=a&&(a.getAttribute('src')||''); if(au&&/^https?:/.test(au)) return {kind:'audio',src:au}; var v=r.querySelector('video[src],video source[src]'); var vu=v&&(v.getAttribute('src')||''); if(vu&&/^https?:/.test(vu)) return {kind:'video',src:vu}; return null; },
    text: function(r){ var m=P.msg(r); if(!m||/E2EE_THREAD_DESCRIPTION/.test(String(m.messageId||''))) return ''; if(m.isUnsent) return '[消息已撤回]'; var ds=r.querySelectorAll('[data-scope="messages_table"] div[dir="auto"]'), o=[]; for(var i=0;i<ds.length;i++){ var e=ds[i]; if(e.closest('.message-translate-content-wrapper,[class*="scrm-"]')) continue; if(e.querySelector('[dir="auto"]')) continue; var t=txt(e,'.message-translate-content-wrapper,[class*="scrm-"],[class*="message-translate"]'); if(t) o.push(t); } var s=o.join('\n').trim(); if(s) return s; var lo=P.dct(m); if(lo===4) return '[语音]'; /* displayedContentTypes 低位:1=文本 4=语音(实测) */ if(bigImg(r,'img')) return '[图片]'; if(r.querySelector('video')) return '[视频]'; if(r.querySelector('[aria-label="播放"],[aria-label="Play"],[aria-label*="音频"],[aria-label*="Audio" i]')) return '[语音]'; if(lo&&lo!==1) return '[附件]'; return ''; },
    dct: function(m){ try{ var d=m&&m.displayedContentTypes; if(Array.isArray(d)) return Number(d[1])||0; return Number(d)||0; }catch(e){ return 0; } },
    type: function(r){ var m=P.msg(r); if(!m) return 'chat'; if(P.dct(m)===4) return 'audio'; return 'chat'; },
    mine: function(r){ var m=P.msg(r); if(!m) return null; var sid=P.i64(m.senderId); if(!sid||sid==='0') return null; return sid===P.me(); },
    id: function(r){ var m=P.msg(r); return m?String(m.messageId||P.i64(m.offlineThreadingId)||''):''; },
    time: function(r){ var m=P.msg(r); if(!m) return 0; var t=Number(P.i64(m.timestampMs))||0; return t>1e12&&t<4e12?t:0; },
    name: function(){ try{ var h=document.querySelector('[data-pagelet="MWInboxDetail_MessageList_Header"] h2, [data-pagelet="MWInboxDetail_MessageList_Header"] h1, [data-pagelet="MWInboxDetail_MessageList_Header"] span[dir="auto"]'); var t=h?String(h.innerText||'').split('\n')[0].trim():''; if(t) return t; var dt=String(document.title||''); return /\|/.test(dt)?dt.split('|')[0].trim():''; }catch(e){ return ''; } }
  };
  function safe(fn,a,b){ try{ return fn?fn(a,b):undefined; }catch(e){ return undefined; } }
  /* [CHAT-MEDIA] 媒体:P.media(r)→null|{kind:'image'|'audio'|'video'|'file',src:https/blob/data 或 Promise<dataURI>};https 交服务端代下,blob 在页内转 dataURI(≤4MB) */
  function fetchToData(url,max){ return new Promise(function(res){ try{ fetch(url,{credentials:'include'}).then(function(r){ if(!r.ok) throw 0; return r.blob(); }).then(function(b){ if(!b||b.size>(max||4194304)||!/^(image|audio|video)\//.test(b.type||'')) return res(''); var fr=new FileReader(); fr.onload=function(){ res(String(fr.result||'')); }; fr.onerror=function(){ res(''); }; fr.readAsDataURL(b); }).catch(function(){ res(''); }); }catch(e){ res(''); } }); }
  function blobToData(url,max){ return new Promise(function(res){ try{ if(!/^blob:/.test(url)) return res(''); fetch(url).then(function(r){ return r.blob(); }).then(function(b){ if(!b||b.size>(max||4194304)) return res(''); var fr=new FileReader(); fr.onload=function(){ res(String(fr.result||'')); }; fr.onerror=function(){ res(''); }; fr.readAsDataURL(b); }).catch(function(){ res(''); }); }catch(e){ res(''); } }); }
  function bigImg(root,sel){ try{ var imgs=root.querySelectorAll(sel||'img'); for(var i=0;i<imgs.length;i++){ var im=imgs[i]; if(im.closest('[class*="scrm-"],[class*="message-translate"]')) continue; var src=im.currentSrc||im.src||''; if(!src||/^data:image\/svg/.test(src)) continue; if(/\/t39\.30808-1\/|\/avatars\/|profile_pic|\/avatar\//i.test(src)) continue; /* 头像 CDN 路径 */ var rc=im.getBoundingClientRect(); var w=rc.width||im.width||0, h=rc.height||im.height||0; if(w>=80&&h>=80) return src; } }catch(e){} return ''; }
  var mediaBusy=0;
  /* [CHAT-STORE] 本地持久化队列(localStorage,不含媒体数据,≤300 条):关窗/断网前没被面板取走的消息下次打开继续传 */
  var STORE_KEY='scrm_chat_pending_facebook', lastSig='';
  function ls(){ try{ var L=window.localStorage; if(L&&typeof L.getItem==='function') return L; }catch(e){} return null; }
  function strip(m){ var o={}; for(var k in m){ if(k!=='media') o[k]=m[k]; } return o; }
  function persist(){ try{ var L=ls(); if(!L) return; var b=window.__scrmChatBuf||[]; var sig=b.length+'|'+(b.length?b[b.length-1].id:''); if(sig===lastSig) return; lastSig=sig; L.setItem(STORE_KEY, JSON.stringify(b.slice(-300).map(strip))); }catch(e){} }
  function restore(){ try{ var L=ls(); if(!L) return; var raw=L.getItem(STORE_KEY); if(!raw) return; var arr=JSON.parse(raw); if(!Array.isArray(arr)||!arr.length) return; var b=window.__scrmChatBuf; arr.forEach(function(m){ if(m&&m.id&&m.account){ var key=m.account+'|'+m.id; if(!seen[key]){ seen[key]=1; seenN++; b.push(m); } } }); }catch(e){} }
  try{ restore(); }catch(e){}
  setInterval(persist,3000);
  function tick(){ try{
    if(!on()) return;
    var cid=String(safe(P.cid)||'').trim(); if(!cid) return;
    var rows=safe(P.rows)||[]; if(!rows.length) return;
    var name=String(safe(P.name,rows)||'').trim().slice(0,255); var head=String(safe(P.head,rows)||'').slice(0,4000);
    var cnt={}, buf=window.__scrmChatBuf, added=0;
    for(var i=0;i<rows.length;i++){ var r=rows[i]; if(!r) continue;
      var fk=r.__scrmCapK; if(fk&&seen[fk]){ if(r.__scrmCapN) cnt[r.__scrmCapN]=(cnt[r.__scrmCapN]||0)+1; continue; } /* 已收过的行也要参与同文本计数,否则后来的同样正文消息序号撞车被当重复丢掉 */
      var text=String(safe(P.text,r)||'').trim(); if(!text) continue;
      var mine=safe(P.mine,r); if(mine==null) mine=posMine(r); mine=mine?1:0;
      var id=String(safe(P.id,r)||'');
      if(!id){ var k=mine+'|'+text; cnt[k]=(cnt[k]||0)+1; id='h'+hash(cid+'|'+k)+'.'+cnt[k]; r.__scrmCapN=k; }
      var key=cid+'|'+id; r.__scrmCapK=key; if(seen[key]) continue; seen[key]=1; seenN++;
      var t=Number(safe(P.time,r))||0; if(!t) t=Date.now()/1000; if(t>1e12) t=t/1000;
      var ty=String(safe(P.type,r)||'chat');
      var item={account:cid,name:name,headimg:head,id:id.slice(0,120),from_me:mine,type:ty,body:text.slice(0,4000),t:t};
      var q=safe(P.quote,r); if(q) item.quote=String(q).slice(0,1000);
      if(safe(P.edited,r)) item.edited=1;
      if(safe(P.revoked,r)){ item.type='revoked'; item.body='[消息已撤回]'; }
      var md=item.type==='revoked'?null:safe(P.media,r);
      if(md&&md.src&&mediaBusy<3){ item.type=md.kind||'image'; var src=md.src;
        if(typeof src==='string'&&/^blob:/.test(src)) src=blobToData(src);
        if(typeof src==='string'){ if(/^data:/.test(src)) item.media=src; else if(/^https?:/.test(src)) item.media_url=src.slice(0,1024); }
        else if(src&&typeof src.then==='function'){ mediaBusy++; added++; (function(item,src){ var done=false; var fin=function(d){ if(done) return; done=true; mediaBusy--; if(d&&/^data:/.test(d)&&d.length<5800000) item.media=d; (window.__scrmChatBuf||[]).push(item); }; src.then(fin,function(){ fin(''); }); setTimeout(function(){ fin(''); },25000); })(item,src); continue; }
      }
      buf.push(item); added++;
    }
    if(seenN>20000){ seen={}; seenN=0; }
    if(buf.length>3000) buf.splice(0,buf.length-3000);
    window.__scrmChatCapStat={cid:cid,rows:rows.length,added:added,total:(window.__scrmChatCapStat&&window.__scrmChatCapStat.total||0)+added,t:Date.now()}; /* 巡检用:视图里看 __scrmChatCapStat */
  }catch(e){ try{ window.__scrmChatCapErr=String(e&&e.message||e); }catch(_){} } }
  setInterval(tick,3000);
  window.__scrmChatCapTick=tick;
  /* [PLAY-CAPTURE] 端到端加密平台(FB/Messenger/IG)的语音没有直链,只有用户点播放时页面才解出 blob:钩 HTMLMediaElement.play,把 blob 读成 dataURI,配到最近一次点击所在的消息行,补一条带 media 的同 id 记录(服务端对已存在行只补 media_url)。 */
  if(P.playCapture&&P.rowSel&&!window.__scrmPlayCap){ window.__scrmPlayCap=1; try{
    var lastRow=null;
    document.addEventListener('pointerdown',function(e){ try{ var r=e.target&&e.target.closest&&e.target.closest(P.rowSel); if(r) lastRow=r; }catch(_){} },true);
    var op=HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play=function(){ var el=this; try{ var src=el.currentSrc||el.src||''; var row=lastRow; if(on()&&row&&/^(blob:|https?:)/.test(src)&&!el.__scrmCapDone){ el.__scrmCapDone=1; var cid=String(safe(P.cid)||'').trim(); var id=String(safe(P.id,row)||''); if(cid&&id){ var mk=function(kind,d,u){ var t=Number(safe(P.time,row))||0; if(!t) t=Date.now()/1000; if(t>1e12) t=t/1000; var it={account:cid,name:String(safe(P.name,[row])||''),headimg:'',id:id.slice(0,120),from_me:(function(){ var m=safe(P.mine,row); return m==null?(posMine(row)?1:0):(m?1:0); })(),type:kind,body:kind==='video'?'[视频]':'[语音]',t:t}; if(d) it.media=d; else it.media_url=u; (window.__scrmChatBuf=window.__scrmChatBuf||[]).push(it); }; if(/^https?:/.test(src)){ mk(el.tagName==='VIDEO'?'video':'audio',null,src.slice(0,1024)); } /* IG 语音=cdn.fbsbx.com 直链,交服务端代下 */ else blobToData(src,4194304).then(function(d){ if(!d||!/^data:(audio|video)\//.test(d)) return; mk(/^data:video/.test(d)?'video':'audio',d,null); }); } } }catch(_){} return op.apply(el,arguments); };
  }catch(e){} }
}catch(e){}})();

/* [FB-CONTACTS] 2026-09-26 联系人面板只读接口(对齐 WA/TG 的 window.__scrmContacts v2),Facebook / Messenger(同一套 Lightspeed 线程列表):
   会话行 [data-pagelet="MWThreadListThreadListRow"] 的 React fiber memoizedProps.thread:threadKey / threadType / threadName / folderName(inbox|archived…)/
   lastActivityTimestampMs / lastReadWatermarkTimestampMs(我读到哪)/ snippetSenderContactId(最后一条谁发的)。I64 字段是 [hi,lo] → BigInt。
   未读 = 最后一条不是我发的且 lastRead < lastActivity;对方是否已读列表上没有 → caps.ack=false。行是虚拟渲染的,list() 会把列表滚一遍收齐再还原。
   open(id,name):有行就点行里的链接(/t/<id>/);没有就往左栏搜索框(input[type=search])填名字,等出现带 /t/<id>/ 的链接再点,点完清空。只读不改不发。 */
(function(){ 'use strict';
  if (/(^|\.)business\.facebook\.com$/i.test(location.hostname || '')) return; /* Meta Business Suite 由下面的 [META-CONTACTS] 管 */
  if (window.__scrmFbContacts) return; window.__scrmFbContacts = 1;
  var ROW = '[data-pagelet="MWThreadListThreadListRow"]';
  function I64(v) { try { if (Array.isArray(v) && v.length === 2) return (BigInt(v[0]) * 4294967296n + BigInt(v[1] >>> 0)).toString(); } catch(e){} return v == null ? '' : String(v); }
  function me() { try { return (document.cookie.match(/c_user=(\d+)/) || [])[1] || ''; } catch(e){ return ''; } }
  function clickEl(el) { ['mousedown', 'mouseup', 'click'].forEach(function(t){ try { el.dispatchEvent(new MouseEvent(t, { bubbles: true, cancelable: true, view: window, button: 0 })); } catch(e){} }); }
  function threadOf(row) { try { var fk = Object.keys(row).find(function(k){ return k.indexOf('__reactFiber') === 0; }); var f = row[fk]; for (var d = 0; d < 40 && f; d++) { var p = f.memoizedProps; if (p && p.thread) return p.thread; f = f.return; } } catch(e){} return null; }
  function isOneToOne(th) { try { var U = window.require && window.require('LSMessagingThreadTypeUtil'); var tt = th.threadType; if (U) return !!((U.isOneToOne && U.isOneToOne(tt)) || (U.isArmadilloSecureOneToOne && U.isArmadilloSecureOneToOne(tt))); } catch(e){} var k = I64(th.threadKey); return !!(k && k.length <= 16 && !/^-/.test(k) && Number(I64(th.threadType)) < 2) || String(I64(th.threadType)) === '15'; }
  function rows() { return [].slice.call(document.querySelectorAll(ROW)); }
  function rowInfo(row) { var th = threadOf(row); if (!th) return null; var key = I64(th.threadKey); if (!key) return null;
    var my = me(), sender = I64(th.snippetSenderContactId), lastAct = Number(I64(th.lastActivityTimestampMs)) || 0, lastRead = Number(I64(th.lastReadWatermarkTimestampMs)) || 0;
    var a = row.querySelector('a[href]'), href = a ? a.getAttribute('href') : '', nameEl = row.querySelector('span[dir="auto"]'), img = row.querySelector('img');
    var fromMe = sender ? sender === my : null, one = isOneToOne(th);
    return { id: key, name: String(th.threadName || (nameEl && nameEl.textContent) || key).trim(), username: '', phone: '', group: !one, kind: one ? 'private' : 'group', unread: (fromMe === false && lastAct > lastRead) ? 1 : 0, unreadKnown: true, t: lastAct ? Math.floor(lastAct / 1000) : 0, archive: !!(th.folderName && th.folderName !== 'inbox'), avatar: img && /^https?:/.test(img.src || '') ? img.src : '', lastFromMe: fromMe, lastAck: null, members: 0, href: href }; }
  function scroller() { var r = rows()[0]; var el = r && r.parentElement; while (el && el !== document.body) { var cs = getComputedStyle(el); if (/(auto|scroll)/.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 5) return el; el = el.parentElement; } return null; }
  function collect() { return new Promise(function(res){ var got = {}, order = [];
    var take = function(){ rows().forEach(function(r){ var i = rowInfo(r); if (i && !got[i.id]) { got[i.id] = i; order.push(i.id); } }); };
    take(); var sc = scroller(); if (!sc) return res(order.map(function(k){ return got[k]; }));
    var top0 = sc.scrollTop, step = Math.max(200, sc.clientHeight - 60), pos = 0, n = 0;
    (function next(){ pos += step; if (pos > sc.scrollHeight + step || n++ > 40) { sc.scrollTop = top0; return setTimeout(function(){ res(order.map(function(k){ return got[k]; })); }, 150); } sc.scrollTop = pos; setTimeout(function(){ take(); next(); }, 250); })(); }); }
  function linkOf(id) { return document.querySelector('a[href*="/t/' + id + '/"]') || document.querySelector('a[href*="/t/' + id + '"]'); }
  function searchInput() { return document.querySelector('input[type="search"]') || document.querySelector('input[aria-label*="Messenger"]') || document.querySelector('input[placeholder*="Messenger"]'); }
  function setSearch(v) { var i = searchInput(); if (!i) return false; try { i.focus(); } catch(e){} try { var d = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value'); if (d && d.set) d.set.call(i, v); else i.value = v; } catch(e){ i.value = v; } i.dispatchEvent(new Event('input', { bubbles: true })); if (!v) { try { i.blur(); } catch(e){} } return true; }
  function activeId() { try { var m = (location.pathname || '').match(/\/t\/(\d+)/); return m ? m[1] : ''; } catch(e){ return ''; } }
  function openChat(id, name) { return new Promise(function(res){ try { id = String(id || ''); if (!id) return res('nochat');
      var a = linkOf(id); if (a) { clickEl(a); return res('ok'); }
      if (!name || !setSearch(String(name))) return res('nochat'); var t0 = Date.now();
      (function poll(){ var a2 = linkOf(id); if (a2) { clickEl(a2); setTimeout(function(){ setSearch(''); res('ok'); }, 400); return; } if (Date.now() - t0 > 6000) { setSearch(''); return res('nochat'); } setTimeout(poll, 250); })();
    } catch(e){ res('error:' + (e && e.message)); } }); }
  window.__scrmContacts = { v: 2, platform: 'facebook', caps: { unread: true, ack: false, group: true, archive: true, channel: false },
    list: function(){ return collect().catch(function(){ return []; }); }, active: activeId, open: openChat, groupMembers: function(){ return []; }, _rowInfo: rowInfo };
})();
/* [FB-CONTACTS-END] */

/* [META-CONTACTS] 2026-09-27 联系人面板只读接口(对齐 WA/TG 的 window.__scrmContacts v2),Meta Business Suite 收件箱(business.facebook.com/latest/inbox):
   这个视图走 facebook-preload → 加载的是 scrm-patch-facebook.js,所以本段只在 business.facebook.com 生效(普通 Facebook/Messenger 由上面的 [FB-CONTACTS] 管)。
   会话行=[data-surface*="thread_list/thread_row"],行的 React fiber 往上 ≤14 层有 memoizedProps.thread:
   {threadID("user:<fbid>"), threadFBID, title, snippet(字符串或 React 元素 props.children), timestamp(ms), isRead, isGroupThread, commPlatform(MESSENGER/INSTAGRAM/WHATSAPP), participantProfileURIs[头像], isPinned}。
   点行=往上找第一个带 onClick 的 DOM 节点点它。列表是 react-window 虚拟滚动、滚到底再拉更多(onRequestMoreRows),list({full:true}) 透明后台滚一遍收齐(到底后等高度不再涨);静默只读已渲染行。
   看不到对方已读 → caps.ack=false。open(id):有行就点行,没渲染就透明滚到找到再点。只读不改不发。 */
(function(){ 'use strict';
  if (!/(^|\.)business\.facebook\.com$/i.test(location.hostname || '')) return;
  if (window.__scrmMetaContacts) return; window.__scrmMetaContacts = 1;
  var ROW = '[data-surface*="thread_list/thread_row"]';
  function clickEl(el) { ['mousedown', 'mouseup', 'click'].forEach(function(t){ try { el.dispatchEvent(new MouseEvent(t, { bubbles: true, cancelable: true, view: window, button: 0 })); } catch(e){} }); }
  function rows() { return [].slice.call(document.querySelectorAll(ROW)); }
  function fiberOf(el) { try { var fk = Object.keys(el).find(function(k){ return k.indexOf('__reactFiber') === 0; }); return fk ? el[fk] : null; } catch(e){ return null; } }
  function threadOf(row) { var f = fiberOf(row); for (var d = 0; d < 14 && f; d++) { var p = f.memoizedProps; if (p && p.thread && (p.thread.threadID || p.thread.threadFBID)) return p.thread; if (p && 'itemCount' in p) break; f = f.return; } return null; }
  function clickTarget(row) { var f = fiberOf(row); for (var d = 0; d < 14 && f; d++) { var p = f.memoizedProps; if (p && typeof p.onClick === 'function' && f.stateNode && f.stateNode.nodeType === 1) return f.stateNode; if (p && 'itemCount' in p) break; f = f.return; } return row; }
  function textOf(x) { if (x == null) return ''; if (typeof x === 'string' || typeof x === 'number') return String(x); if (Array.isArray(x)) return x.map(textOf).join(''); if (typeof x === 'object' && x.props) return textOf(x.props.children); return ''; }
  function rowInfo(row) { var th = threadOf(row); if (!th) return null; var id = String(th.threadFBID || String(th.threadID || '').replace(/^[a-z]+:/i, '') || ''); if (!id) return null;
    var snippet = textOf(th.snippet).trim(), fromMe = snippet ? /^(你|您|You)[:：]/.test(snippet) : null;
    var t = Number(th.timestamp) || 0; if (t > 1e12) t = Math.floor(t / 1000);
    var av = (th.participantProfileURIs || [])[0] || '', img = row.querySelector('img'), src = av || (img ? String(img.getAttribute('src') || '') : '');
    var group = !!th.isGroupThread;
    return { id: id, name: String(th.title || '').trim() || id, username: '', phone: '', channel: String(th.commPlatform || '').toLowerCase(), uid: id, group: group, kind: group ? 'group' : 'private', unread: th.isRead === false ? 1 : 0, unreadKnown: typeof th.isRead === 'boolean', t: t, archive: false, avatar: /^https?:/.test(src) ? src : '', lastFromMe: fromMe, lastAck: null, members: 0, pin: !!th.isPinned }; }
  function scroller() { var r = rows()[0]; var el = r && r.parentElement; while (el && el !== document.body) { var cs = getComputedStyle(el); if (/(auto|scroll)/.test(cs.overflowY) && el.scrollHeight > el.clientHeight - 1) return el; el = el.parentElement; } return null; }
  var known = {}, order = [], busy = null;
  function put(map, arr, i) { if (!map[i.id]) arr.push(i.id); map[i.id] = i; }
  function snapshot() { return order.map(function(k){ return known[k]; }); }
  function takeInto(map, arr) { rows().forEach(function(r){ var i = rowInfo(r); if (i) put(map, arr, i); }); }
  function sweep(fn) { return new Promise(function(res){ var sc = scroller(); try { fn(); } catch(e){} if (!sc || sc.scrollHeight <= sc.clientHeight + 5) return res();
    var top0 = sc.scrollTop, op0 = sc.style.opacity; sc.style.opacity = '0'; var step = Math.max(200, Math.floor(sc.clientHeight * 0.6)), pos = 0, n = 0, lastH = 0, same = 0;
    var done = function(){ sc.scrollTop = top0; setTimeout(function(){ sc.style.opacity = op0; res(); }, 100); };
    sc.scrollTop = 0;
    (function next(){ setTimeout(function(){ try { fn(); } catch(e){} if (n++ > 80) return done(); var atBottom = sc.scrollTop + sc.clientHeight >= sc.scrollHeight - 5; if (atBottom) { if (sc.scrollHeight === lastH) { if (++same >= 4) return done(); } else { same = 0; lastH = sc.scrollHeight; } sc.scrollTop = sc.scrollHeight; return setTimeout(next, 500); } pos += step; sc.scrollTop = Math.min(pos, sc.scrollHeight); next(); }, 150); })(); }); }
  function collect(opts) { var full = !!(opts && opts.full);
    if (!full) { if (busy) return busy.then(snapshot, snapshot); try { takeInto(known, order); } catch(e){} return Promise.resolve(snapshot()); }
    if (!busy) { var next = {}, nextOrder = []; busy = sweep(function(){ takeInto(next, nextOrder); }).then(function(){ if (nextOrder.length) { known = next; order = nextOrder; } busy = null; }, function(){ nextOrder.forEach(function(k){ put(known, order, next[k]); }); busy = null; }); }
    return busy.then(snapshot, snapshot); }
  function rowOf(id) { return rows().find(function(r){ var i = rowInfo(r); return i && i.id === String(id); }) || null; }
  function activeId() { try { return (window.__scrmMetaInboxCid && window.__scrmMetaInboxCid()) || ''; } catch(e){ return ''; } }   /* [TR-FIX-1002B] 与翻译共用 _metaInboxCid(同一优先级:selected_item_id → threadFBID) */
  function openChat(id) { return new Promise(function(res){ try { id = String(id || ''); if (!id) return res('nochat');
      var r = rowOf(id); if (r) { clickEl(clickTarget(r)); return res('ok'); }
      var sc = scroller(); if (!sc) return res('nochat'); var op0 = sc.style.opacity; sc.style.opacity = '0'; var step = Math.max(200, Math.floor(sc.clientHeight * 0.6)), pos = 0, n = 0; sc.scrollTop = 0;
      (function next(){ setTimeout(function(){ var r2 = rowOf(id); if (r2) { sc.style.opacity = op0; clickEl(clickTarget(r2)); return res('ok'); } if (n++ > 80 || sc.scrollTop + sc.clientHeight >= sc.scrollHeight - 5) { sc.style.opacity = op0; return res('nochat'); } pos += step; sc.scrollTop = Math.min(pos, sc.scrollHeight); next(); }, 150); })();
    } catch(e){ res('error:' + (e && e.message)); } }); }
  window.__scrmContacts = { v: 2, platform: 'meta', caps: { unread: true, ack: false, group: true, archive: false, channel: false },
    list: function(opts){ try { return collect(opts).catch(snapshot); } catch(e){ return Promise.resolve(snapshot()); } }, active: activeId, open: openChat, groupMembers: function(){ return []; }, _rowInfo: rowInfo };
})();
/* [META-CONTACTS-END] */
