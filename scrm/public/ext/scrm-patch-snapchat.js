/* __scrmPatchV1__ scrm-patch-snapchat v2.3 (2026-08-30,React18 发送时序/海王抢先塞容器不再跳过)
   ① Snapchat 网页版自研翻译整套接管海王 snapchat-preload(照 X/LB 模板):
      - 隐藏海王译文 UI;发送:回车/发送钮拦截→翻译→写回 div[role=textbox](textContent+React onInput)→点发送 BUTTON;发出气泡显示操作员原文(模糊键匹配,Snapchat 无消息 id)
      - 收信:按组 [role=presentation] ul ul>li,HEADER "ME"/红色=自己,蓝色=对方;翻到 receiveTargetLanguage,缓存秒贴;↻ 重译;输入框预览;Ctrl/Cmd+F/T;中文检测;per-chat(会话 id=URL /web/<uuid>)
      - 图片/语音:Snap 阅后即焚网页版不展示,模块保留但基本不命中
   ② 保留 v1:指纹语言/brands 页面侧修正 + 心跳 */
(function(){ try{
  function bad(v){ return !v || !/^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/.test(String(v)); }
  var lang=navigator.language, langs=navigator.languages;
  if(bad(lang) || !langs || !langs.length || bad(langs[0])){
    var tz=''; try{ tz=Intl.DateTimeFormat().resolvedOptions().timeZone||''; }catch(e){}
    var pick = /Shanghai|Chongqing|Urumqi|Harbin|Hong_Kong|Macau/.test(tz)?['zh-CN','zh','en-US','en'] : /Taipei/.test(tz)?['zh-TW','zh','en-US','en'] : /Tokyo/.test(tz)?['ja','en-US','en'] : /Seoul/.test(tz)?['ko','en-US','en'] : ['en-US','en'];
    try{ Object.defineProperty(navigator,'language',{get:function(){ return pick[0]; },configurable:true}); }catch(e){}
    try{ Object.defineProperty(navigator,'languages',{get:function(){ return pick.slice(); },configurable:true}); }catch(e){}
    try{ Object.defineProperty(Navigator.prototype,'language',{get:function(){ return pick[0]; },configurable:true}); Object.defineProperty(Navigator.prototype,'languages',{get:function(){ return pick.slice(); },configurable:true}); }catch(e){}
    window.__scrmLangFixed=pick[0];
  }
  // brands \u5bf9\u9f50 UA \u5927\u7248\u672c
  try{ var m=(navigator.userAgent||'').match(/Chrome\/(\d+)/); var major=m?m[1]:null; var uad=navigator.userAgentData;
    if(major && uad && uad.brands && uad.brands.length && !uad.brands.some(function(b){ return b.version===major; })){
      var brands=[{brand:'Chromium',version:major},{brand:'Google Chrome',version:major},{brand:'Not)A;Brand',version:'99'}];
      var full=[{brand:'Chromium',version:major+'.0.0.0'},{brand:'Google Chrome',version:major+'.0.0.0'},{brand:'Not)A;Brand',version:'99.0.0.0'}];
      var fake={ brands:brands, mobile:false, platform:uad.platform||'macOS',
        getHighEntropyValues:function(h){ return uad.getHighEntropyValues(h).then(function(v){ v.brands=brands; v.fullVersionList=full; v.uaFullVersion=major+'.0.0.0'; return v; }); },
        toJSON:function(){ return {brands:brands,mobile:false,platform:uad.platform||'macOS'}; } };
      Object.defineProperty(navigator,'userAgentData',{get:function(){ return fake; },configurable:true});
      window.__scrmUadFixed=major;
    } }catch(e){}
}catch(e){} })();

(function(){ 'use strict';
  if (window.__scrmSnapTr) return; window.__scrmSnapTr = true;
  // \u63a2\u9488\u5b9e\u6d4b:\u6d88\u606f\u6309\u7ec4 [role=presentation] ul ul > li(HEADER=\u53d1\u9001\u8005\u540d ME/\u5bf9\u65b9),\u6b63\u6587 span \u5728 div \u91cc;\u6392\u9664 header/\u94fe\u63a5\u9884\u89c8/\u6211\u65b9\u8bd1\u6587\u6846
  var SN_GROUP='[role="presentation"] ul ul > li';
  function _msgSpans(){ var out=[]; try{ var sp=document.querySelectorAll(SN_GROUP+' span'); for(var i=0;i<sp.length;i++){ var e=sp[i]; if(e.closest('header')||e.closest('.scrm-sn-tw')||e.closest('.scrm-sn-vhost')||e.closest('[class*="message-translate"]')||e.closest('a[href]')) continue; var kids=e.children, real=0; for(var q=0;q<kids.length;q++){ var kc=kids[q]; if(kc.tagName==='BR'||/message-translate|scrm-sn-/.test(String(kc.className||''))) continue; real++; } if(real) continue; /* \u6d77\u738b 1s \u62a2\u5148\u585e\u8fdb\u7684\u8bd1\u6587\u5bb9\u5668/\u6211\u65b9\u6846\u4e0d\u7b97\u5b50\u5143\u7d20(\u5426\u5219\u65b0\u6d88\u606f\u6c38\u8fdc\u88ab\u8df3\u8fc7,\u5b9e\u62a5) */ if(!(e.textContent||'').trim()) continue; out.push(e); } }catch(e){} return out; }
  function _cfg(){ try{ return Object.assign({}, window.__scrm_translate||{}, window.__scrmTrCfg||{}); }catch(e){ return {}; } }
  function sendTo(){ try{ var c=_cfg(); var id=(window.__scrmActiveContactId||'');
      if(id){ var sct=c.singleContactTranslate&&c.singleContactTranslate[id]; if(sct&&(sct.singleContactTranslateOpen||sct.enabled)&&(sct.sendTargetLanguage||sct.sendTo)) return sct.sendTargetLanguage||sct.sendTo; }
      return c.snapchatGlobalSend||c.sendTargetLanguage||c.sendTo||'en'; }catch(e){} return 'en'; }
  function recvTo(){ try{ var c=_cfg(); return c.receiveTargetLanguage||c.recvTo||'zh-CN'; }catch(e){} return 'zh-CN'; }
  function sendEnabled(){ try{ var c=_cfg(); return c.sendTranslateAuto!==false && c.sendEnabled!==false; }catch(e){} return true; }
  function recvEnabled(){ try{ var c=_cfg(); return c.receiveTranslateAuto!==false && c.recvEnabled!==false; }catch(e){} return true; }
  function previewEnabled(){ try{ var c=_cfg(); return c.translatePreview!==false && c.previewEnabled!==false; }catch(e){} return true; }
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
  // [TR-FIX-1002B] 线路唯一来源:翻译缓存键、预览去重键、实际请求地址都用它(原来缓存键不含线路 → 换线路后直接拿回旧线路的缓存译文,根本没重翻)
  function _route(){ try{ return _trRouteOf(_cfg()); }catch(e){} return 'google2'; }
  function routeBase(rt){ return _trRouteUrl(rt||_route()); }
  function _pvLabel(){ return _trRouteName(_cfg())+'\u5b9e\u65f6\u7ffb\u8bd1'; }
  function _norm(s){ return (s||'').replace(/[\u200b\u200c\u200d\ufeff]/g,'').replace(/\r/g,'').replace(/^\s+|\s+$/g,''); }
  function _hasZh(t){ return /[\u4e00-\u9fff]/.test(t||''); }
  function _tgtIsZh(){ var to=sendTo(); return !!(to&&to.indexOf('zh')===0); }

  // ---------- IndexedDB \u6301\u4e45\u5c42 ----------
  var _idb=(function(){
    var DB='scrm_tr_snap', ST='c', db=null, rdy=false, dead=false;
    var _opened, opened=new Promise(function(r){ _opened=r; });   // 开库有了结果(成功或失败)才兑现:clearP 先等它,库还在打开时点清空也不会漏
    try{ var rq=indexedDB.open(DB,1);
      rq.onupgradeneeded=function(e){ try{ var d=e.target.result; if(!d.objectStoreNames.contains(ST)) d.createObjectStore(ST); }catch(_u){} };
      rq.onsuccess=function(e){ db=e.target.result; rdy=true; db.onversionchange=function(){ try{ db.close(); }catch(_v){} db=null; rdy=false; dead=true; }; try{ _trim(20000); }catch(_s){} _opened(); };
      rq.onerror=function(){ dead=true; _opened(); };
    }catch(e){ dead=true; _opened(); }
    function _trim(max){ if(!rdy||dead||!db) return; try{ var s=db.transaction(ST,'readwrite').objectStore(ST); var cr=s.count();
      cr.onsuccess=function(){ var n=cr.result; if(n>max){ var del=n-Math.floor(max*0.75); var c=s.openCursor(); c.onsuccess=function(ev){ var cur=ev.target.result; if(cur&&del>0){ try{cur.delete();}catch(_d){} del--; cur.continue(); } }; } }; }catch(e){} }
    function get(k,cb){ if(!rdy||dead||!db){ cb(null); return; } var fired=false, to=setTimeout(function(){ if(!fired){ fired=true; cb(null); } },300);
      try{ var r=db.transaction(ST,'readonly').objectStore(ST).get(k); r.onsuccess=function(){ if(!fired){ fired=true; clearTimeout(to); cb(r.result==null?null:r.result); } }; r.onerror=function(){ if(!fired){ fired=true; clearTimeout(to); cb(null); } }; }catch(e){ if(!fired){ fired=true; clearTimeout(to); cb(null); } } }
    function put(k,v){ if(!rdy||dead||!db||v==null||v==='') return; try{ db.transaction(ST,'readwrite').objectStore(ST).put(v,k); }catch(e){} }
    // [BATCH1-04] 整表清空:等开库有结果 → 同一事务里先 count 再 clear,返回清掉的条数;库不可用/出错/3s 没回都按 0;永不 reject
    function clearP(){ return new Promise(function(resolve){ var fired=false, n=0, to=setTimeout(function(){ fin(0); },3000);
      function fin(v){ if(!fired){ fired=true; clearTimeout(to); resolve(v); } }
      opened.then(function(){ if(!rdy||dead||!db){ fin(0); return; }
        try{ var s=db.transaction(ST,'readwrite').objectStore(ST); var cr=s.count(); cr.onsuccess=function(){ n=cr.result||0; }; var r=s.clear(); r.onsuccess=function(){ fin(n); }; r.onerror=function(){ fin(0); }; }catch(e){ fin(0); } }); }); }
    return { get:get, put:put, clearP:clearP };
  })();

  // ---------- \u7f13\u5b58 ----------
  var _cache={}, _pending={}, _full={}, _sentOrig={};
  var _FKEY='__scrmSnapFull', _SKEY='__scrmSnapSentOrig';
  try{ var _fs=localStorage.getItem(_FKEY); if(_fs){ var _fo=JSON.parse(_fs); if(_fo&&typeof _fo==='object') _full=_fo; } }catch(e){}
  try{ var _ss=localStorage.getItem(_SKEY); if(_ss){ var _so=JSON.parse(_ss); if(_so&&typeof _so==='object') _sentOrig=_so; } }catch(e){}
  var _fSaveT=null;
  function _saveFull(){ try{ if(_fSaveT) return; _fSaveT=setTimeout(function(){ _fSaveT=null; try{
    var ks=Object.keys(_full); if(ks.length>4000){ for(var i=0;i<ks.length-3000;i++) delete _full[ks[i]]; }
    localStorage.setItem(_FKEY, JSON.stringify(_full));
    var sk=Object.keys(_sentOrig); if(sk.length>3000){ for(var j=0;j<sk.length-2000;j++) delete _sentOrig[sk[j]]; }
    localStorage.setItem(_SKEY, JSON.stringify(_sentOrig));
  }catch(e){} },1500); }catch(e){} }
  var _sentById={}, _pendSent=[];
  var _BKEY='__scrmSnapSentById';
  try{ var _bs=localStorage.getItem(_BKEY); if(_bs){ var _bo=JSON.parse(_bs); if(_bo&&typeof _bo==='object') _sentById=_bo; } }catch(e){}
  function _saveById(){ try{ var ks=Object.keys(_sentById); if(ks.length>3000){ for(var i=0;i<ks.length-2000;i++) delete _sentById[ks[i]]; } localStorage.setItem(_BKEY,JSON.stringify(_sentById)); }catch(e){} }
  // \u6a21\u7cca\u952e:\u53bb\u7a7a\u767d/\u6807\u70b9\u3001\u5c0f\u5199\u2014\u2014LINE \u6e32\u67d3\u4f1a\u6539\u52a8\u7a7a\u767d/\u6807\u70b9(\u5b9e\u6d4b\u53d1\u51fa\u8bd1\u6587\u4e0e\u6c14\u6ce1\u6587\u672c\u4e0d\u4e00\u81f4\u5bfc\u81f4\u539f\u6587\u6620\u5c04\u4e0d\u547d\u4e2d)
  function _fkey(s){ try{ return String(s||'').toLowerCase().replace(/[\s\p{P}\p{S}]/gu,''); }catch(e){ return String(s||'').toLowerCase().replace(/[\s!-\/:-@\[-`{-~\u3000-\u303f\uff00-\uffef]/g,''); } }
  function putSent(tr,orig){ if(!tr||!orig) return; _sentOrig[_norm(tr)]=orig; _sentOrig['f|'+_fkey(tr)]=orig; try{ _idb.put('s|'+_norm(tr),orig); }catch(e){} _pendSent.push({tr:_norm(tr),fk:_fkey(tr),orig:orig,at:Date.now()}); _saveFull(); }
  // \u6d88\u606f id:\u6c14\u6ce1\u7956\u5148\u4e0a\u7684 Vue \u6d88\u606f\u6a21\u578b id / data-* \u5c5e\u6027;\u53d6\u4e0d\u5230\u5219\u7a7a(\u9000\u56de\u6309\u8bd1\u6587\u6587\u672c)
  function _item(tc){ try{ return tc.closest(SN_GROUP)||tc.parentElement; }catch(e){ return tc.parentElement; } }
  function _msgId(tc){ try{ var it=_item(tc); if(!it) return '';
      var v=it.__vue__; var p=v&&(v._props||v.$props); var m=p&&(p.message||p.msg||p.item||p.chatMessage||p.model); if(m){ var id=m.id||m.messageId||m.msgId||(m.payload&&(m.payload.id||m.payload.messageId)); if(id) return String(id); }
      var a=it.getAttribute('data-message-id')||it.getAttribute('data-msg-id')||it.getAttribute('data-id')||it.id; return a?String(a):''; }catch(e){ return ''; } }
  function _origFor(tc,src){ var id=_msgId(tc); if(id&&_sentById[id]) return _sentById[id];
    var fk=_fkey(src);
    if(_pendSent.length){ var now=Date.now(); for(var i=_pendSent.length-1;i>=0;i--){ var p=_pendSent[i]; if(now-p.at>120000){ _pendSent.splice(i,1); continue; } if((p.tr===src||p.fk===fk) && _isMine(tc)){ if(id){ _sentById[id]=p.orig; _saveById(); } _pendSent.splice(i,1); return p.orig; } } }
    return _sentOrig[src]||_sentOrig['f|'+fk]||null; }
  window.__snapSentOrig=_sentOrig;

  /* [BATCH1-04] 面板「清空译文缓存」:window.__scrmTrCacheClear() → Promise<{cleared:n}>,永不 reject。
     清三处:句级内存 _cache;整条消息译文 _full 及它在 localStorage __scrmSnapFull 的镜像;IndexedDB scrm_tr_snap 表 c(_idb.clearP;表里 s| 发出原文条目只写从不读,随整表清掉)。
     n(全平台同一口径)= 持久层里被清掉的译文条数 = IndexedDB 表的条数;内存和 localStorage 镜像是副本,不另计。
     _sentOrig/_sentById 是发出消息的原文映射不是译文,不动;已显示的译文框/标记一个不删,之后新消息 / ↻ 才重新联网(不触发重译)。 */
  window.__scrmTrCacheClear=function(){
    try{ _cache={}; _full={}; localStorage.removeItem(_FKEY); }catch(e){}
    var p; try{ p=_idb.clearP(); }catch(e){ p=Promise.resolve(0); }
    return p.then(function(k){ return { cleared:Number(k)||0 }; }, function(){ return { cleared:0 }; }); };

  // ---------- \u7ffb\u8bd1\u5f15\u64ce:XHR \u76f4\u8fde\u6211\u65b9\u7ffb\u8bd1 API ----------
  function _parseTr(d){ if(!d) return '';
    try{ var m2=d.match(/\[\[\["((?:\\.|[^"\\])*)"/); if(m2){ var t=m2[1].replace(/\\u([0-9a-fA-F]{4})/g,function(_,h){return String.fromCharCode(parseInt(h,16));}).replace(/\\n/g,'\n').replace(/\\t/g,'\t').replace(/\\"/g,'"').replace(/\\\\/g,'\\'); if(t) return t; } }catch(e){}
    try{ var segs=[], re=/tw-answ-target-text">([\s\S]*?)<\/span>/g, mm; while((mm=re.exec(d))!==null){ segs.push(mm[1]); } if(segs.length) return segs.join(''); }catch(e){}
    var m=d.match(/tw-answ-target-text">([^<]*)</); return m?m[1]:'';
  }
  // [TR-ALIGN-1002] force=↻ 重新翻译:跳过内存缓存和 IndexedDB 读取,真正走网络,拿到的新结果覆盖两处缓存(原来靠拼缓存键去删,键对不上/IndexedDB 没清 → 拿回旧译文)
  function translate(text,tl,force){ return new Promise(function(resolve){
    text=_norm(text); if(!text){ resolve(''); return; }
    var rt=_route(), key='v2|'+rt+'|'+(tl||'en')+'|'+text;   // [TR-FIX-1002B] 缓存键 = v2|线路|目标语言|原文,线路与下面实际请求用的是同一个 rt(旧 v1 缓存自然作废)
    if(!force && _cache[key]!=null){ resolve(_cache[key]); return; }
    var pk=(force?'!':'')+key;   // 强制刷新单独排队,不搭普通请求(可能正读 IndexedDB 旧值)的车
    if(_pending[pk]){ _pending[pk].push(resolve); return; }
    _pending[pk]=[resolve];
    // [TR-FIX-1002B] 目标不是中/日却仍含汉字 = 线路回显原文/没翻出来:不进缓存(否则重试永远从缓存拿回这条失败结果)
    var done=function(r){ if(r && (_hanOk(tl)||!_hasZh(r))){ _cache[key]=r; try{ _idb.put(key,r); }catch(_p){} var ks=Object.keys(_cache); if(ks.length>6000){ for(var i=0;i<2000;i++) delete _cache[ks[i]]; } } var qs=_pending[pk]||[]; delete _pending[pk]; qs.forEach(function(f){ try{ f(r); }catch(e){} }); };
    var doNetwork=function(){
      var async='sl:auto,tl:'+(tl||'en')+',st:'+encodeURIComponent(text.slice(0,1500))+',id:'+(Date.now?Date.now():1);
      var url=routeBase(rt)+'/async/translate?async='+encodeURIComponent(async);
      var to=setTimeout(function(){ done(''); },8000);
      try{ var xhr=new XMLHttpRequest(); xhr.open('GET',url,true); xhr.timeout=8000;
        xhr.onreadystatechange=function(){ if(xhr.readyState!==4) return; clearTimeout(to); var r=_parseTr(xhr.responseText||''); done(r?r.replace(/^\s+|\s+$/g,''):''); };
        xhr.ontimeout=function(){ clearTimeout(to); done(''); }; xhr.onerror=function(){ clearTimeout(to); done(''); };
        xhr.send();
      }catch(e){ clearTimeout(to); done(''); }
    };
    if(force){ doNetwork(); return; }
    _idb.get(key,function(c){ if(c!=null&&c!=='') done(c); else doNetwork(); });
  }); }
  function _trLine(t,tl,tries,force){ return translate(t,tl,force).then(function(r){ if((!r||!r.replace(/\s/g,''))&&(tries||0)<3) return _trLine(t,tl,(tries||0)+1,force); return r; }); }
  function translateML(text,tl,force){ var lines=String(text||'').split('\n'); if(lines.length<=1) return _trLine(text,tl,0,force);
    return Promise.all(lines.map(function(ln){ var n=_norm(ln); return n?_trLine(n,tl,0,force):Promise.resolve(''); })).then(function(rs){ return rs.join('\n'); }); }

  // ---------- \u6837\u5f0f ----------
  function _injStyle(){ if(document.getElementById('__scrmSnapStyle')||!document.head) return;
    var st=document.createElement('style'); st.id='__scrmSnapStyle';
    st.textContent=''
      + '.message-translate-content-wrapper,.message-translate-content,.message-translate-loading,.message-translate-btn,.message-translate-error,.real-time-tranlate-content,.real-time-tranlate-text,[class*="real-time-tranlate"]{display:none !important;} '
      + '.scrm-sn-tx{display:inline;} '
      + '.scrm-sn-tw{display:block;width:100%;margin-top:4px;padding-top:4px;border-top:1px dashed rgba(26,127,55,.7);color:#1a7f37;font-size:13px;line-height:1.4;white-space:pre-wrap;word-break:break-word;text-align:left;} '
      + '.scrm-sn-mine .scrm-sn-tw{color:#0b5d27;border-top-color:rgba(0,0,0,.25);} '
      + '@keyframes scrm-sn-spin{to{transform:rotate(360deg)}} .scrm-sn-rf{display:inline-flex;align-items:center;margin-left:6px;vertical-align:middle;cursor:pointer;opacity:.7;transition:opacity .15s;user-select:none;} .scrm-sn-rf:hover{opacity:1;} .scrm-sn-rf.spin svg{animation:scrm-sn-spin .8s linear infinite;} '
      + '.scrm-imgtr-host{position:relative;} .scrm-imgtr-btn{position:absolute;top:6px;right:6px;z-index:30;background:rgba(0,0,0,.62);color:#fff;font-size:11px;line-height:1;padding:4px 8px;border-radius:6px;cursor:pointer;display:none;align-items:center;gap:3px;user-select:none;} .scrm-imgtr-host:hover .scrm-imgtr-btn{display:inline-flex;} .scrm-imgtr-btn.on{display:inline-flex;} .scrm-imgtr-btn.done{display:inline-flex;background:rgba(26,127,55,.92);} .scrm-imgtr-btn .sp{display:inline-block;width:9px;height:9px;border:1.5px solid #fff;border-top-color:transparent;border-radius:50%;animation:scrm-sn-spin .7s linear infinite;} '
      + '.scrm-imgtr-mask{position:fixed;inset:0;z-index:2147483600;background:rgba(0,0,0,.75);display:flex;align-items:center;justify-content:center;cursor:zoom-out;} .scrm-imgtr-lightimg{max-width:92vw;max-height:84vh;border-radius:8px;background:#fff;object-fit:contain;} '
      + '.scrm-sn-vhost{width:100%;box-sizing:border-box;} .scrm-sn-vbtn{display:inline-block;margin-top:6px;background:#1a7f37;color:#fff;font-size:11px;line-height:1;padding:4px 9px;border-radius:10px;cursor:pointer;user-select:none;} .scrm-sn-vbtn.on{opacity:.7;} .scrm-sn-vo{margin-top:6px;padding-top:6px;border-top:1px dashed rgba(120,130,140,.5);font-size:12.5px;line-height:1.5;white-space:pre-wrap;word-break:break-word;text-align:left;} .scrm-sn-vo .og{opacity:.75;} .scrm-sn-vo .tr{margin-top:3px;font-weight:500;} .scrm-sn-vo .lbl{color:#1a7f37;font-size:10.5px;margin-right:2px;font-weight:600;} .scrm-sn-vrf{cursor:pointer;opacity:.7;margin-left:6px;display:inline-flex;vertical-align:middle;} .scrm-sn-vrf:hover{opacity:1;} '
      + _pvCoreCss('scrm-sn-pv')+'.scrm-sn-pv-in{word-break:break-word;width:100%;}';
    document.head.appendChild(st);
  }
  // \u539f\u6587:clone \u6c14\u6ce1\u6587\u672c\u8282\u70b9,\u53bb\u6389\u6211\u65b9\u8bd1\u6587\u6846/\u6d77\u738b\u8bd1\u6587
  function _origText(tc){ try{ var c=tc.cloneNode(true); var rm=c.querySelectorAll('.scrm-sn-tw,[class*="message-translate"]'); for(var j=0;j<rm.length;j++) rm[j].parentNode.removeChild(rm[j]);
      var brs=c.querySelectorAll('br'); for(var k=0;k<brs.length;k++) brs[k].parentNode.replaceChild(document.createTextNode('\n'),brs[k]);
      return _norm((c.textContent||'').replace(/\u00a0/g,' ')); }catch(e){ return ''; } }
  // \u63a2\u9488\u5b9e\u6d4b:Snapchat \u7f51\u9875\u7248\u6d88\u606f\u5168\u90e8\u9760\u5de6,\u81ea\u5df1/\u5bf9\u65b9\u9760\u7ec4 HEADER:\u81ea\u5df1="ME"(\u4e2d\u6587\u754c\u9762"\u6211"),\u989c\u8272 rgb(242,60,87);\u5bf9\u65b9\u84dd rgb(14,173,255)
  function _isMine(tc){ try{ var li=tc.closest(SN_GROUP); if(!li) return false; if(li.__snMine!=null&&Date.now()-(li.__snMineAt||0)<5000) return li.__snMine; var hd=li.querySelector('header'); var mine=false;
    if(hd){ var c=hd.cloneNode(true); var rm=c.querySelectorAll('[class*="message-translate"],.scrm-sn-tw'); for(var i=0;i<rm.length;i++) rm[i].remove(); var t=(c.textContent||'').trim().toUpperCase(); if(/^(ME|\u6211|\u81ea\u5206|\ub098)\b/.test(t)||t==='ME'||t==='\u6211') mine=true; else { try{ var col=getComputedStyle(hd.querySelector('span')||hd).color; var m=col.match(/(\d+),\s*(\d+),\s*(\d+)/); if(m&&+m[1]>200&&+m[2]<120) mine=true; }catch(e){} } }
    li.__snMine=mine; li.__snMineAt=Date.now(); return mine; }catch(e){ return false; } }
  // \u76ee\u6807\u4e2d\u6587\u4e14\u6d88\u606f\u672c\u8eab\u5c31\u662f\u7eaf\u4e2d\u6587(\u65e0\u62c9\u4e01/\u5047\u540d/\u97e9\u6587/\u6cf0\u6587/\u897f\u91cc\u5c14)\u2192\u4e0d\u7528\u7ffb
  function _skipRecv(src,rto){ try{ return /^zh/i.test(rto||'') && _hasZh(src) && !/[A-Za-z\u00C0-\u024F\u0400-\u04FF\u0E00-\u0E7F\u3040-\u30FF\uAC00-\uD7AF\u0600-\u06FF]/.test(src); }catch(e){ return false; } }
  // ---------- \u6eda\u52a8\u8d34\u5e95:\u8bd1\u6587\u6846\u5728 LINE \u5b9a\u4f4d\u5230\u5e95\u4e4b\u540e\u624d\u63d2\u5165\u4f1a\u628a\u5185\u5bb9\u6491\u9ad8\u2192\u5207\u4f1a\u8bdd\u8dd1\u5230\u6700\u9876(\u7528\u6237\u5b9e\u62a5) ----------
  var _scEl=null;
  function _scroller(){ try{ if(_scEl&&_scEl.isConnected&&_scEl.scrollHeight>_scEl.clientHeight+4) return _scEl; _scEl=null; var tc=_msgSpans()[0]; var el=tc?tc.parentElement:null; while(el&&el!==document.body){ var cs=getComputedStyle(el); if(/(auto|scroll)/.test(cs.overflowY)&&el.scrollHeight>el.clientHeight+4){ _scEl=el; return el; } el=el.parentElement; }
    var cands=document.querySelectorAll('.chat-messages,.chat-content-wrapper,[class*="chat-scroll"],[class*="message-list"]'); for(var i=0;i<cands.length;i++){ var c=cands[i]; var s2=getComputedStyle(c); if(/(auto|scroll)/.test(s2.overflowY)) return c; } }catch(e){} return null; }
  /* [TR-ALIGN-1002] 2026-10-02 打开/切换会话不再强行滚动(对齐 CEO 与 TG [TG-KEEP-BOTTOM]):
     原来切会话后有遮罩+每 40/50ms 拉到底+全局 scroll 监听 scrollTop<80 拉底+观察器里 _stickNow,把停在「未读消息」处或正往上翻的人硬拽到底。
     现在打开会话停在哪由平台自己决定。唯一保留的贴底规则:我们往消息里插内容(译文/语音译文)会把气泡撑高 ——
     插入前该消息所在滚动容器离底 ≤24px → 插完(微任务里)贴底;否则位置不动。同一轮多次插入只量一次。
     判断"在底部"按容器实际方向:column-reverse 列表底部 = scrollTop≈0。自己发送后贴底(_stickBottom)照旧保留。 */
  function _scrollHost(el){ try{ var p=el&&el.parentElement; while(p&&p!==document.body&&p!==document.documentElement){ var cs=getComputedStyle(p); if(/(auto|scroll)/.test(cs.overflowY)&&p.scrollHeight>p.clientHeight+4) return p; p=p.parentElement; } }catch(e){} return null; }
  var _kbList=null;
  function _keepBottom(el){ try{
    var sc=_scrollHost(el); if(!sc) return;
    if(_kbList){ for(var i=0;i<_kbList.length;i++){ if(_kbList[i].sc===sc) return; } }
    else { _kbList=[]; Promise.resolve().then(function(){ var l=_kbList; _kbList=null; for(var k=0;k<l.length;k++){ try{ var s=l[k].sc; if(l[k].atB&&s.isConnected) s.scrollTop=l[k].rev?0:s.scrollHeight; }catch(e){} } }); }
    var rev=false; try{ rev=getComputedStyle(sc).flexDirection==='column-reverse'; }catch(e){}
    _kbList.push({ sc:sc, rev:rev, atB: rev ? Math.abs(sc.scrollTop)<=24 : (sc.scrollHeight-sc.scrollTop-sc.clientHeight)<=24 });
  }catch(e){} }
  /* [TR-FIX-1002B] 自己发送后的短时贴底改成「需要时才开定时器、到点/用户往上滚就清掉」(同 LINE Business 写法)。
     原来是常驻 setInterval 50ms(整页生命周期每秒 20 次空转),它唯一的用途就是这 1.5 秒贴底。
     拖滚动条改记当前时间(原来 +3000 只配合旧的 !_userScrolledAt 判断;现在按"发送之后有没有滚过"判断,发送前拖过不影响)。 */
  var _stickT=null, _stickAt=0, _userScrolledAt=0;
  function _toBottom(){ try{ var sc=_scroller(); if(sc) sc.scrollTop=sc.scrollHeight; }catch(e){} }
  function _stickBottom(ms){ try{ var t0=Date.now(), until=t0+(ms||1500); _stickAt=t0; _toBottom(); if(_stickT) clearInterval(_stickT);
    _stickT=setInterval(function(){ try{ if(Date.now()>until || _userScrolledAt>=_stickAt){ clearInterval(_stickT); _stickT=null; return; } _toBottom(); }catch(e){} },50);
  }catch(e){} }
  document.addEventListener('wheel',function(e){ try{ if(e.deltaY<0) _userScrolledAt=Date.now(); }catch(_){} },{capture:true,passive:true});
  document.addEventListener('mousedown',function(e){ try{ if(!e.isTrusted) return; var sc=_scroller(); if(!sc) return; var r=sc.getBoundingClientRect(); if(e.clientX>=r.right-22&&e.clientY>=r.top&&e.clientY<=r.bottom) _userScrolledAt=Date.now(); }catch(_){} },true); // [NO-BLIND-SNAP] 拖滚动条也算用户滚动(原来只认滚轮)
  // [TR-ALIGN-1002] 切会话遮罩 _beginSwitch(每 40ms 拉底)/点会话列表触发/每 50ms 拉底/全局 scroll 监听 scrollTop<80 拉底 已删除 —— 打开会话停在哪由平台决定。
  // 只剩自己发送后的短时贴底:_stickBottom 开的 1.5 秒定时器内跟到底,期间用户往上滚(滚轮/拖滚动条)立即停。
  function _annotate(tc,want,mine){ try{
    var box=tc.__scrmTw;
    if(!box||!box.parentNode){
      box=document.createElement('div'); box.className='scrm-sn-tw';
      var tx=document.createElement('div'); tx.className='scrm-sn-tx'; box.appendChild(tx);   // \u7528 div \u4e0d\u7528 span:\u6d77\u738b\u9009\u62e9\u5668 li div div span \u4f1a\u628a\u6211\u65b9\u6846\u5185 span \u5f53\u6d88\u606f\u518d\u7ffb\u4e00\u904d
      var rf=document.createElement('div'); rf.className='scrm-sn-rf'; rf.title='\u91cd\u65b0\u7ffb\u8bd1';
      rf.innerHTML='<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>';
      box.appendChild(rf); _keepBottom(tc); tc.appendChild(box); tc.__scrmTw=box;   // [TR-ALIGN-1002] 插入前量一次是否在底
    }
    if(mine) tc.classList.add('scrm-sn-mine'); else tc.classList.remove('scrm-sn-mine');
    var rfb=box.querySelector('.scrm-sn-rf'); if(rfb&&rfb.classList.contains('spin')&&want!=='\u7ffb\u8bd1\u4e2d\u2026'){ var left=500-(Date.now()-(tc.__zRfAt||0)); if(left>0){ (function(b){ setTimeout(function(){ try{ b.classList.remove('spin'); }catch(e){} },left); })(rfb); } else rfb.classList.remove('spin'); }
    var tx2=box.querySelector('.scrm-sn-tx'); if(tx2&&(tx2.textContent||'')!==want){ _keepBottom(tc); tx2.textContent=want; }   // [TR-ALIGN-1002] 换字前量一次是否在底
    if(want!=='\u7ffb\u8bd1\u4e2d\u2026'){ tc.__zFk=tc.textContent; tc.__zFkTo=recvTo(); }
    if(!tc.querySelector('.message-translate-content')){ var dm=document.createElement('span'); dm.className='message-translate-content'; dm.style.display='none'; tc.appendChild(dm); tc.__zFk=tc.textContent; }
    try{ if(!box.querySelector('.message-translate-content')){ var dm2=document.createElement('span'); dm2.className='message-translate-content'; dm2.style.display='none'; box.appendChild(dm2); } }catch(e){}   // \u5360\u4f4d\u8ba9\u6d77\u738b on() \u8df3\u8fc7\u8fd9\u6761(\u5b83\u89c1\u5230 .message-translate-content \u5c31\u4e0d\u518d\u53d1\u7ffb\u8bd1\u8bf7\u6c42,\u7701\u4e00\u534a\u6d41\u91cf\u9632\u9650\u6d41)
  }catch(e){} }
  /* [TR-FIX-1002B] ↻ 的「待强制刷新」按 收信语言|原文 记在这个集合里,不挂在 DOM 元素上:
     原来打在元素的 __zForce 上,平台一重渲染(换了新元素)标记就丢 → _syncCached 立刻用整句缓存把旧译文贴回去,↻ 等于没点。
     成功或失败都在结果回来时清掉;失败时缓存保持原样(translate 只在拿到新结果时才覆盖缓存,从不先删)。 */
  var _forceKeys={};
  function processMsgs(){ try{
    _injStyle();
    try{ var hw=document.querySelectorAll('.message-translate-content-wrapper,[class*="message-translate-content"],[class*="real-time-tranlate"]'); for(var hi=0;hi<hw.length;hi++){ if(hw[hi].style.display!=='none') hw[hi].style.setProperty('display','none','important'); } }catch(e){}
    if(!recvEnabled()) return;
    if(_cfg().groupTranslateAuto===false && _isGroup()) return;
    var rto=recvTo();
    var tcs=_msgSpans();
    for(var i=0;i<tcs.length;i++){ var tc=tcs[i];
      var fk=tc.textContent; if(tc.__zFk===fk && tc.__zFkTo===rto && !tc.__zPending) continue;   // \u7a33\u5b9a\u6027:\u6307\u7eb9\u672a\u53d8\u76f4\u63a5\u8df3\u8fc7(\u4e0d cloneNode)
      var src=_origText(tc); if(!src) continue;
      var frc=!!_forceKeys[rto+'|'+src];
      if(!frc && tc.__zSrc===src && (tc.__zTo==null||tc.__zTo===rto) && tc.__scrmTw && tc.__scrmTw.parentNode){ tc.__zFk=tc.textContent; tc.__zFkTo=rto; continue; }
      var so=(tc.__zNoOrig||frc)?null:_origFor(tc,src);
      if(so){ tc.__zSrc=src; tc.__zTo=null; tc.__zPending=0; _annotate(tc,so,true); continue; }
      if(!frc && _skipRecv(src,rto)){ tc.__zSrc=src; tc.__zTo=rto; tc.__zPending=0; _annotate(tc,src,_isMine(tc)); continue; }   // \u7eaf\u4e2d\u6587\u2192\u539f\u6587\u5373\u8bd1\u6587,\u76f4\u63a5\u8d34(\u4e0d\u8d70\u7f51\u7edc);\u21bb \u5f3a\u5236\u65f6\u4ecd\u771f\u7ffb\u4e00\u6b21
      var cf=frc?null:_full[rto+'|'+src];   // [TR-ALIGN-1002] ↻ 强制时不用整句缓存
      if(cf!=null){ tc.__zSrc=src; tc.__zTo=rto; tc.__zPending=0; _annotate(tc,cf,_isMine(tc)); continue; }
      if(tc.__zPending) continue; tc.__zPending=1;
      if(!(tc.__scrmTw&&tc.__scrmTw.parentNode)) _annotate(tc,'\u7ffb\u8bd1\u4e2d\u2026',_isMine(tc));
      (function(el,text,tto,frc){ translateML(text,tto,frc).then(function(r){ el.__zPending=0; if(frc) delete _forceKeys[tto+'|'+text]; try{ if(r&&r.replace(/\s/g,'')){ _full[tto+'|'+text]=r; _saveFull(); el.__zSrc=text; el.__zTo=tto; _annotate(el,r,_isMine(el)); } else { el.__zSrc=text; el.__zTo=tto; _annotate(el,_full[tto+'|'+text]||text,_isMine(el)); } }catch(e){} }); })(tc,src,rto,frc);
    }
  }catch(e){} }
  setInterval(processMsgs,350);
  function _syncCached(){ try{ if(!recvEnabled()) return; var rto=recvTo(); var tcs=_msgSpans();
    for(var i=0;i<tcs.length;i++){ var tc=tcs[i]; if(tc.__zFk===tc.textContent && tc.__zFkTo===rto) continue; if(tc.__zSrc&&(tc.__zTo==null||tc.__zTo===rto)&&tc.__scrmTw&&tc.__scrmTw.parentNode) continue;
      var src=_origText(tc); if(!src) continue;
      if(_forceKeys[rto+'|'+src]) continue;   // [TR-FIX-1002B] ↻ 等网络新结果,别用缓存把旧译文贴回去(按 语言|原文 判断,元素重渲染也认得)
      var so=tc.__zNoOrig?null:_origFor(tc,src); if(so){ tc.__zSrc=src; tc.__zTo=null; tc.__zPending=0; _annotate(tc,so,true); continue; }
      if(_skipRecv(src,rto)){ tc.__zSrc=src; tc.__zTo=rto; tc.__zPending=0; _annotate(tc,src,_isMine(tc)); continue; }
      var cf=_full[rto+'|'+src]; if(cf!=null){ tc.__zSrc=src; tc.__zTo=rto; tc.__zPending=0; _annotate(tc,cf,_isMine(tc)); } }
  }catch(e){} }
  // [TR-ALIGN-1002] 观察器里的 _stickNow(切会话 4 秒内每次 DOM 变化都拉底)已删除
  (function(){ try{ var raf=0; var _pmAt=0; var ob=new MutationObserver(function(){ try{ _syncCached(); }catch(e){} if(raf) return; raf=requestAnimationFrame(function(){ raf=0; try{ if(Date.now()-_pmAt>150){ _pmAt=Date.now(); processMsgs(); } }catch(e){} }); }); /* [SMOOTH] 2026-09-14 对齐 FB/Zalo:缓存命中的译文在观察器回调里同步盖章(绘制前,重渲染零闪),不再等下一帧;未命中的新消息节流 150ms 立即走 processMsgs 翻译,不再等 350ms 轮询 */
    var _att=function(){ if(document.body){ ob.observe(document.body,{childList:true,subtree:true}); } else setTimeout(_att,200); }; _att(); }catch(e){} })();
  document.addEventListener('click',function(ev){ try{
    var rf=ev.target&&ev.target.closest&&ev.target.closest('.scrm-sn-rf'); if(!rf) return;
    ev.stopPropagation(); ev.preventDefault();
    var tw=rf.closest('.scrm-sn-tw'); var tc=tw&&tw.parentElement; if(!tc) return;
    // [TR-FIX-1002B] 待刷新记在 _forceKeys(语言|原文)→ processMsgs 用 translate(..., force) 真正联网,新结果覆盖内存/IndexedDB/整句缓存;元素被平台重渲染换掉也照样生效
    var src0=_origText(tc); if(src0) _forceKeys[recvTo()+'|'+src0]=1;
    tc.__zNoOrig=1; tc.__zSrc=null; tc.__zTo=null; tc.__zPending=0; tc.__zFk=null; tc.__zRfAt=Date.now();
    var tx=tw.querySelector('.scrm-sn-tx'); if(tx) tx.textContent='\u7ffb\u8bd1\u4e2d\u2026'; rf.classList.add('spin');
  }catch(e){} },true);

  // ---------- \u8f93\u5165\u6846 / \u53d1\u9001(\u63a2\u9488\u5b9e\u6d4b:div[role=textbox] React contenteditable;\u5199 textContent \u540e\u8c03 React props.onInput \u2192 \u53d1\u9001\u94ae BUTTON \u51fa\u73b0\u5728\u5176\u540e \u2192 click) ----------
  function getEd(){ return document.querySelector('div[role="textbox"]'); }
  function _rprops(el){ try{ var k=Object.keys(el).find(function(k){ return k.indexOf('__reactProps')===0; }); return k?el[k]:null; }catch(e){ return null; } }
  function getText(ed){ try{ return ed?(ed.innerText||ed.textContent||''):''; }catch(e){ return ''; } }
  function setText(ed,val){ try{ ed.focus(); ed.textContent=val; var p=_rprops(ed); if(p&&typeof p.onInput==='function'){ try{ p.onInput({target:ed,currentTarget:ed,type:'input'}); }catch(_){} } ed.dispatchEvent(new Event('input',{bubbles:true})); }catch(e){} }
  function getSendBtn(){ var ed=getEd(); if(!ed) return null; var n=ed.nextElementSibling; if(n&&n.tagName==='BUTTON'&&n.offsetWidth>0) return n; var p=ed.parentElement; var bs=p?p.querySelectorAll('button'):[]; for(var i=0;i<bs.length;i++){ if(bs[i].offsetWidth>0) return bs[i]; } return null; }
  function _isEd(t){ try{ var ed=getEd(); return !!(ed&&t&&(t===ed||ed.contains(t))); }catch(e){ return false; } }
  // \u9884\u89c8:\u7167\u6d77\u738b(\u7528\u6237\u8981\u6c42\u540c\u6b3e\u6837\u5f0f):\u63d2\u5728 [role=presentation]>div>div \u91cc\u542b textbox \u7684\u90a3\u4e2a\u5bb9\u5668\u4e4b\u524d(\u6d41\u5185\u3001\u900f\u660e\u80cc\u666f\u3001\u5de6 2px \u7eff\u7ebf);\u627e\u4e0d\u5230\u951a\u70b9\u624d\u9000\u56de fixed \u6d6e\u5c42
  function _pvAnchorEl(){ try{ var list=document.querySelectorAll('[role="presentation"]>div>div'); for(var i=0;i<list.length;i++){ if(list[i].querySelector('[role="textbox"]')) return list[i]; } }catch(e){} return null; }
  function _pvAnchor(){ try{ var ed=getEd(); if(!ed) return null; var box=ed.parentElement&&ed.parentElement.parentElement||ed.parentElement; return box.getBoundingClientRect(); }catch(e){ return null; } }
  function _pvPlaceFixed(host){ try{ var r=_pvAnchor(); if(!r||r.width<50){ host.style.display='none'; return false; } host.style.position='fixed'; host.style.left=Math.round(r.left)+'px'; host.style.width=Math.round(r.width)+'px'; host.style.bottom=Math.round(window.innerHeight-r.top+6)+'px'; host.style.zIndex='2147483000'; return true; }catch(e){ return false; } }
  var _backTr=_backTrCore({ backCls:'scrm-sn-pv-back', on:function(){ return !!_cfg().backTranslate; }, sendLang:sendTo, backLang:recvTo, translate:function(t,bl){ return translateML(t,bl); } });   /* [BACK-TR] 回译校对:下面写预览正文的地方调 _backTr.update(正文元素, 译文),行为全在上面的 [BACK-TR-CORE] */
  function _preview(txt, isTr){   /* isTr:这次写的是真译文(回译只认它) */ try{ var host=window.__snapPv;
    if(txt===null||txt===undefined){ if(host) host.style.display='none'; _backTr.update(null,''); return; }
    if(!host){ host=document.createElement('div'); host.className='scrm-sn-pv'; host.innerHTML='<div class="scrm-sn-pv-in"><div class="scrm-sn-pv-lbl"></div><div class="scrm-sn-pv-body"></div></div>'; window.__snapPv=host; }
    var an=_pvAnchorEl();
    if(an&&an.parentElement){ if(host.nextElementSibling!==an||host.parentNode!==an.parentElement){ try{ an.parentElement.insertBefore(host,an); }catch(e){} } host.style.position=''; host.style.left=''; host.style.width=''; host.style.bottom=''; host.style.zIndex=''; host.__fixed=false; }
    else { if(!host.parentNode||host.parentNode!==document.body){ try{ document.body.appendChild(host); }catch(e){} } host.__fixed=true; if(!_pvPlaceFixed(host)) return; }
    host.style.display='block';
    var l=host.querySelector('.scrm-sn-pv-lbl'); if(l&&l.textContent!==_pvLabel()) l.textContent=_pvLabel();
    var b=host.querySelector('.scrm-sn-pv-body'); var want=(txt===''?'\u2026':txt); if(b&&b.textContent!==want) b.textContent=want; _backTr.update(b, isTr?txt:'');
  }catch(e){} }
  setInterval(function(){ try{ var h=window.__snapPv; if(h&&h.__fixed&&h.style.display!=='none') _pvPlaceFixed(h); }catch(e){} },300);
  window.addEventListener('resize',function(){ try{ var h=window.__snapPv; if(h&&h.__fixed) _pvPlaceFixed(h); }catch(e){} });
  /* [TR-ALIGN-1002] 2026-10-02 要不要翻的唯一判断(对齐 TG [TG-ZH-SAME]):目标语言是中文、输入里去掉汉字后没有任何字母(只有汉字/数字/标点/emoji)→ 不用翻,原样发送。
     预览、回车、发送按钮三处共用它。其他情况一律翻译(CEO:只跳过空文本;纯数字/纯链接翻回来与原文相同,按下面"译文=原文"原样发)。
     删掉了原来的"不含汉字就原样发""只认拉丁字母算外文":目标中文时打俄文/日文假名/韩文会被原样发出;目标英文时打日文/俄文也不翻 → 预览显示译文、发出去却是原文。 */
  function _sendAsIs(src){ return _tgtIsZh() && !/\p{L}/u.test(String(src||'').replace(/\p{Script=Han}/gu,'')); }
  // [TR-ALIGN-1002] 译文与原文"相同"的签名:去掉所有非字母数字(任何文字都保留,不能只认拉丁/中日韩,否则西里尔/泰文等签名为空被误判相同)
  function _sig(s){ return String(s==null?'':s).replace(/[^\p{L}\p{N}]+/gu,'').toLowerCase(); }
  function _sameText(a,b){ return _sig(a)===_sig(b); }
  var _SAME_TAG='  (已是目标语言,原样发送)';
  /* [TR-FIX-1002B] 发送安全的唯一判断(回车、发送按钮、写入后核对、预览都只调这里):
     原来「译文签名与原文相同 → 原样发送」的捷径排在「译文仍含中文 → 拦下」之前:线路限流/Gemini 出错时把原文原样回显,
     中文就被当成"已是目标语言"直接发给客户,没有任何提示。现在:目标语言不是中/日时,准备发出的文字里只要还有汉字,一律不发。
     _hanOk(tl):目标语言本身就写汉字(中文/日文/粤语)。
     _safeToSend(text, raw):raw=用户明确要发原文(Ctrl+F、快捷回复不翻译)→ 放行;关了发送翻译 → 只有开了中文检测才拦(原规则不变);其余按上面规则。
     _sendText(src, r):翻译结果 r 实际要发的文字 —— 失败/空 → null;签名与原文相同 → 原文;再过 _safeToSend,不过 → null。 */
  function _hanOk(tl){ return /^(zh|ja|yue)/i.test(String(tl||'')); }
  function _safeToSend(text, raw){ if(raw) return true; if(!sendEnabled()) return !(detectOn() && !_tgtIsZh() && _hasZh(text)); return _hanOk(sendTo()) || !_hasZh(text); }
  function _sendText(src, r){ if(!(r&&String(r).replace(/\s/g,''))) return null; var out=_sameText(r,src)?src:r; return _safeToSend(out)?out:null; }
  /* [TR-ALIGN-1002] 2026-10-02 预览按「目标语言|线路|原文」判断要不要重翻(对齐 TG [TG-PV-KEY]):原来只看原文 → 输入不动、只换目标语言/线路,预览一直停在旧语言。
     键一变预览先回占位「…」;译文回来时键已变就丢掉(防旧结果覆盖)。
     不用翻(_sendAsIs)或译文与原文相同 → 显示 原文+「(已是目标语言,原样发送)」,与回车/按钮实际发出的一致。 */
  /* [TR-FIX-1002B] 预览与实际发送一致:
     ① 目标语言或线路变化 → 预览立即回占位「…」,直到新结果到达(原来只比语言,换线路时还挂着旧线路的译文);
        只改了原文 → 保留上一次的译文直到新结果到达(不每打一个字闪一次「…」)。新结果到达时键已变就丢弃。
        _pvShownLR = 预览当前显示的是哪个「语言|线路」的结果('=' 表示原样发送提示)。
     ② 翻译失败(空/出错/仍含中文,判断同发送 _sendText)→ 预览显示「翻译失败」并清掉去重键,之后的轮询自动重试
        (原来失败直接 return:上一句的译文一直挂着、去重键又挡住重试)。同一句连续失败,两次请求至少隔 2 秒。
     ③ 关了预览/发送翻译时清掉去重键,重新打开后预览立即恢复(原来键没变 → 一直隐藏)。
     回车/发送按钮不用预览上的结果,一律按当前原文+语言+线路重新取(translate 走同一缓存键)。 */
  var _pvTimer=null, _lastPvKey='', _pvShownLR='', _pvFailKey='', _pvFailAt=0;
  function _pvKey(src){ return sendTo()+'|'+_route()+'|'+src; }   // [TR-FIX-1002B] 线路取 _route(),与翻译请求同一个值(_onType 里同一拼法)
  function _pvFailed(src,msg){ _lastPvKey=''; _pvShownLR=''; _pvFailKey=_pvKey(src); _pvFailAt=Date.now(); _preview(msg); }   // 预览失败与发送失败共用
  function _onType(){ try{
    if(!previewEnabled()||!sendEnabled()){ _preview(null); _lastPvKey=''; return; }
    var ed=getEd(); if(!ed){ _preview(null); return; }
    var src=_norm(getText(ed));
    if(!src){ _preview(''); _lastPvKey=''; return; }
    var to=sendTo(), lr=to+'|'+_route(), key=lr+'|'+src;
    if(key===_lastPvKey) return;
    if(key===_pvFailKey && Date.now()-_pvFailAt<2000) return;   // 同一句刚失败:隔 2 秒再请求
    _lastPvKey=key;
    if(_pvTimer) clearTimeout(_pvTimer);
    if(_sendAsIs(src)){ _pvFailKey=''; _pvShownLR='='; _preview(src+_SAME_TAG); return; }
    if(_pvShownLR && _pvShownLR!==lr){ _pvShownLR=''; _preview(''); }   // 换了语言/线路:先回占位
    _pvTimer=setTimeout(function(){ translateML(src,to).then(function(r){ var t=getEd(), cur=t?_norm(getText(t)):null; if(cur!==src||_lastPvKey!==key) return;
      var out=_sendText(src,r); if(out==null){ _pvFailed(src,'\u7ffb\u8bd1\u5931\u8d25'); return; }
      _pvFailKey=''; _pvShownLR=(out===src?'=':lr); _preview(out===src?src+_SAME_TAG:out, out!==src); }); },250);
  }catch(e){} }
  document.addEventListener('input',function(e){ try{ if(_isEd(e.target)) _onType(); }catch(_){} },true);
  setInterval(_onType,600);   // \u5e38\u9a7b\u5237\u65b0\u9884\u89c8\u6761(\u88c1\u6a21\u677f\u65f6\u8bef\u5220,\u5b9e\u62a5"\u6ca1\u6709\u7ffb\u8bd1\u6846")
  var _sending=false;
  function detectOn(){ try{ return _cfg().chineseCheck===true; }catch(e){} return false; }
  var _zhWarnTimer=null;
  function showZhWarn(msg){ try{
    var old=document.querySelector('.scrm-zh-warn'); if(old) old.remove(); clearTimeout(_zhWarnTimer);
    var w=document.createElement('div'); w.className='scrm-zh-warn';
    w.style.cssText='position:fixed;bottom:140px;left:50%;transform:translateX(-50%);background:#ff4444;color:#fff;padding:8px 16px;border-radius:8px;font-size:13px;z-index:99999;box-shadow:0 2px 8px rgba(0,0,0,.3);';
    w.textContent=msg||'\u68c0\u6d4b\u5230\u4e2d\u6587,\u5df2\u963b\u6b62\u53d1\u9001'; document.body.appendChild(w);
    _zhWarnTimer=setTimeout(function(){ try{ w.remove(); }catch(e){} },3000);
  }catch(e){} }
  var _bypass=false;   // \u6211\u65b9\u4e3b\u52a8\u70b9\u53d1\u9001\u6309\u94ae\u65f6,\u653e\u884c(\u4e0d\u518d\u88ab\u81ea\u5df1\u7684\u70b9\u51fb\u62e6\u622a\u4e8c\u6b21\u7ffb\u8bd1)
  // React 18 \u72b6\u6001\u5f02\u6b65\u6279\u5904\u7406:\u5199\u5165\u8bd1\u6587+onInput \u540e\u4e0d\u80fd\u540c tick \u70b9\u53d1\u9001(\u6309\u94ae\u4f1a\u53d1\u65e7\u503c,\u5b9e\u6d4b\u53d1\u51fa\u4e2d\u6587\u539f\u6587)\u2192 \u5148\u7b49 \u2265250ms \u5e76\u786e\u8ba4\u8f93\u5165\u6846\u6587\u672c==\u671f\u671b\u503c\u518d\u70b9
  var _expectText='';
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
  _scrmQuickInstall({ box: getEd, read: getText, write: setText, send: function(t){ _expectText=_norm(t); _fireSend(true); }, tr: function(t){ return translateML(t, sendTo()); }, to: function(){ return sendTo(); } }); // [QUICK-SEND] 本平台绑定
  /* [TR-FIX-1002B] 写入后核对 = 唯一的点发送出口:框里的字与期望值一致才发,发前再过一次 _safeToSend(raw=用户明确发原文)。
     写 6 次还对不上 → 不发、提示「写入失败,请重试」(原来重试用完照样点发送 = 可能把框里没换掉的中文原文发出去)。 */
  function _sendFail(msg){ _sending=false; _expectText=''; var ed=getEd(); _pvFailed(ed?_norm(getText(ed)):'',msg); }
  function _fireSend(raw){ _sending=true; var tries=0; setTimeout(function go(){ tries++; var ed=getEd(); var cur=_norm(getText(ed));
      if(_expectText && cur!==_expectText){ if(tries<6){ try{ setText(ed,_expectText); }catch(_){} setTimeout(go,150); return; } _sendFail('\u5199\u5165\u5931\u8d25,\u8bf7\u91cd\u8bd5'); return; }
      if(!_safeToSend(cur,raw)){ _sendFail('\u7ffb\u8bd1\u5931\u8d25,\u8bf7\u91cd\u8bd5'); return; }
      var b=getSendBtn(); if(b){ try{ _bypass=true; b.click(); }catch(_){} setTimeout(function(){ _bypass=false; },50); _sending=false; _lastPvKey=''; _expectText=''; _preview(''); _stickBottom(1500); } else if(tries<15){ setTimeout(go,120); } else { _sending=false; _expectText=''; } },260); }
  function _sendRaw(ed,text){ _expectText=_norm(text); setText(ed,text); _fireSend(true); }   // Ctrl+F:用户明确要发原文
  function _translateAndSend(ed,text){
    if(_sending) return; _sending=true; setTimeout(function(){ _sending=false; },8000);
    translateML(text,sendTo()).then(function(tr){
      _sending=false;
      // [TR-FIX-1002B] 要发的文字只由 _sendText 决定(失败/空/仍含中文 → null),先判安全再走"译文=原文 原样发"
      var out=_sendText(text,tr);
      if(out==null){ if(tr&&detectOn()&&_hasZh(tr)) showZhWarn('\u8bd1\u6587\u4ecd\u542b\u4e2d\u6587,\u5df2\u963b\u6b62\u53d1\u9001'); _pvFailed(text,'\u7ffb\u8bd1\u5931\u8d25,\u8bf7\u91cd\u8bd5'); return; }   // 不发,框里原文保留;预览按失败处理(稍后自动重试)
      if(out===text){ _preview(text+_SAME_TAG); _expectText=text; _fireSend(); return; }   // [TR-ALIGN-1002] 译文=原文(已是目标语言):原样发,与预览一致
      putSent(out,text); _expectText=_norm(out); setText(ed,out); _fireSend();
    });
  }
  // [TR-ALIGN-1002] 决定这次发送怎么走:'asis' 原样 / 'translate' / 'block'。翻不翻只看 _sendAsIs(与预览同一判断)
  function _decide(text){
    if(!sendEnabled()) return _safeToSend(text) ? 'asis' : 'block';   // 关了发送翻译:中文检测开且目标非中文→拦;否则原样发(规则在 _safeToSend)
    if(_sendAsIs(text)) return 'asis';
    return 'translate';
  }
  // \u56de\u8f66:window capture \u62a2\u5728\u6d77\u738b document capture \u4e4b\u524d
  window.addEventListener('keydown',function(e){
    try{
      if(!_isEd(e.target)) return; var ed=getEd();
      if((e.ctrlKey||e.metaKey)&&!e.shiftKey&&!e.altKey){ var k=(e.key||'').toLowerCase();
        if(k==='f'||k==='t'){ var t0=_norm(getText(ed)); if(!t0) return; e.preventDefault(); e.stopImmediatePropagation();
          if(k==='f'){ if(!_sending) _sendRaw(ed,t0); }
          else { translateML(t0,sendTo()).then(function(tr){ var t=getEd(); if(tr&&tr!==t0&&t){ putSent(tr,t0); setText(t,tr); _lastPvKey=_pvKey(_norm(tr)); _preview(tr, true); } }); }
          return; }
        return; }
      if(e.key!=='Enter'||e.shiftKey||e.isComposing||e.keyCode===229) return;
      var text=_norm(getText(ed)); if(!text&&!_sending) return;
      e.preventDefault(); e.stopImmediatePropagation();      // \u6d77\u738b\u7684\u56de\u8f66\u5904\u7406(dn)\u4e00\u5f8b\u62e6\u6389,\u7531\u6211\u65b9\u63a5\u7ba1
      if(_sending) return;   // [TR-FIX-1002B] 先拦事件再看"正在发送":原来 _sending 时直接 return,翻译进行中再按回车 → 事件放给平台,把框里的原文发了出去
      var d=_decide(text);
      if(d==='block'){ showZhWarn('\u68c0\u6d4b\u5230\u4e2d\u6587,\u5df2\u963b\u6b62\u53d1\u9001(\u8bf7\u5f00\u542f\u53d1\u9001\u7ffb\u8bd1\u6216\u5148\u7ffb\u8bd1)'); return; }
      if(d==='asis'){ _expectText=text; _fireSend(); return; }
      _translateAndSend(ed,text);
    }catch(err){}
  },true);
  // \u53d1\u9001\u6309\u94ae:document capture \u62a2\u5728\u6d77\u738b\u6309\u94ae\u7ea7 capture \u4e4b\u524d
  document.addEventListener('click',function(e){
    try{
      if(_bypass) return;   // \u6211\u65b9\u89e6\u53d1\u7684\u5408\u6210\u70b9\u51fb(isTrusted=false,\u6d77\u738b\u6309\u94ae\u76d1\u542c\u53ea\u8ba4 isTrusted)\u76f4\u63a5\u653e\u884c\u5230\u8868\u5355 submit;\u6355\u83b7\u9636\u6bb5 stop \u4f1a\u628a\u76ee\u6807\u9636\u6bb5\u4e00\u8d77\u622a\u65ad\u2192\u53d1\u4e0d\u51fa
      var t=e.target; var btn=getSendBtn(); if(!btn||!(t===btn||(t.closest&&t.closest('button')===btn))) return;
      var ed=getEd(); if(!ed) return; var text=_norm(getText(ed)); if(!text) return;
      var d=_decide(text);
      e.preventDefault(); e.stopImmediatePropagation();
      if(_sending) return;
      if(d==='block'){ showZhWarn('\u68c0\u6d4b\u5230\u4e2d\u6587,\u5df2\u963b\u6b62\u53d1\u9001(\u8bf7\u5f00\u542f\u53d1\u9001\u7ffb\u8bd1\u6216\u5148\u7ffb\u8bd1)'); return; }
      if(d==='asis'){ _expectText=text; _fireSend(); return; }
      _translateAndSend(ed,text);
    }catch(err){}
  },true);

  // ---------- \u5f53\u524d\u4f1a\u8bdd ID(URL /web/<uuid>;\u515c\u5e95\u6d77\u738b utils.getActiveContactId=React fiber conversationId) ----------
  function _convId(){ try{ var m=(location.pathname||'').match(/\/web\/([0-9a-f-]{20,})/i); if(m) return m[1]; }catch(e){} return ''; }
  function _isGroup(){ return false; }
  (function(){ var lastConv='', lastId='';
    setInterval(function(){ try{ var conv=_convId(); var id='';
      if(conv && conv===lastConv && lastId){ id=lastId; }
      else { id=conv; if(!id){ try{ if(window.utils&&typeof window.utils.getActiveContactId==='function') id=String(window.utils.getActiveContactId()||''); }catch(_u){} } if(conv){ lastConv=conv; lastId=id; } }
      if(!conv&&!id){ lastConv=''; lastId=''; }
      if(window.__scrmActiveContactId!==id){ window.__scrmActiveContactId=id; try{ document.body&&document.body.setAttribute('data-scrm-acid',id); }catch(e){} }   // [TR-ALIGN-1002] 切会话不再 _beginSwitch/_stickBottom 拉底
    }catch(e){} },300);
  })();

  // ---------- \u56fe\u7247\u7ffb\u8bd1 ----------
  var __imgRenderCache={};
  function _imgB64(img){ return new Promise(function(res){ try{ var src=img.currentSrc||img.src||''; if(!src){ res(''); return; } if(src.indexOf('data:')===0){ res(src); return; }
    fetch(src,{credentials:'include'}).then(function(r){ return r.blob(); }).then(function(b){ var fr=new FileReader(); fr.onload=function(){ res(fr.result); }; fr.onerror=function(){ res(''); }; fr.readAsDataURL(b); })
    .catch(function(){ try{ var c=document.createElement('canvas'); c.width=img.naturalWidth||img.width; c.height=img.naturalHeight||img.height; c.getContext('2d').drawImage(img,0,0); res(c.toDataURL('image/png')); }catch(e){ res(''); } });
  }catch(e){ res(''); } }); }
  function _imgKey(img){ var s=img.__scrmOrigSrc||img.currentSrc||img.src||''; return s.indexOf('http')===0?(recvTo()+'|'+s):''; }
  function _imgTranslateRender(img){
    if(img.__scrmRenderSrc) return Promise.resolve(img.__scrmRenderSrc);
    if(img.__scrmRenderPending) return img.__scrmRenderPending;
    var key=_imgKey(img); if(key&&__imgRenderCache[key]){ img.__scrmRenderSrc=__imgRenderCache[key]; return Promise.resolve(img.__scrmRenderSrc); }
    img.__scrmRenderPending=_imgB64(img).then(function(b64){ if(!b64){ img.__scrmRenderPending=null; return ''; }
      return new Promise(function(res){ var xhr=new XMLHttpRequest(); xhr.open('POST','https://chm123.com/api/image-translate-render',true); xhr.setRequestHeader('Content-Type','application/json'); xhr.timeout=60000;
        xhr.onreadystatechange=function(){ if(xhr.readyState!==4) return; img.__scrmRenderPending=null; var url=''; try{ var j=JSON.parse(xhr.responseText); if(j.code===0&&j.renderImage) url=j.renderImage; }catch(e){} if(url){ img.__scrmRenderSrc=url; if(key) __imgRenderCache[key]=url; } res(url); };
        xhr.ontimeout=function(){ img.__scrmRenderPending=null; res(''); }; xhr.onerror=function(){ img.__scrmRenderPending=null; res(''); };
        xhr.send(JSON.stringify({ image:b64, to:recvTo() })); }); });
    return img.__scrmRenderPending;
  }
  function _showRender(img,btn){ if(!img.__scrmOrigSrc){ img.__scrmOrigSrc=img.currentSrc||img.src||''; img.__scrmOrigSrcset=img.getAttribute('srcset')||''; }
    if(img.__scrmRenderSrc){ try{ img.removeAttribute('srcset'); }catch(e){} if(img.src!==img.__scrmRenderSrc) img.src=img.__scrmRenderSrc; }
    img.__scrmShowRender=true; if(btn){ btn.textContent='\u539f\u56fe'; btn.classList.add('done'); } }
  function _showOrig(img,btn){ img.__scrmShowRender=false; try{ if(img.__scrmOrigSrcset) img.setAttribute('srcset',img.__scrmOrigSrcset); }catch(e){} if(img.__scrmOrigSrc&&img.src!==img.__scrmOrigSrc) img.src=img.__scrmOrigSrc; if(btn){ btn.textContent='\u8bd1'; btn.classList.remove('done'); } }
  function _showImgLightbox(src){ try{ var mask=document.createElement('div'); mask.className='scrm-imgtr-mask'; var im=document.createElement('img'); im.className='scrm-imgtr-lightimg'; im.src=src; mask.appendChild(im);
    function close(){ try{ mask.remove(); }catch(e){} document.removeEventListener('keydown',onKey,true); } function onKey(e){ if(e.key==='Escape') close(); }
    mask.addEventListener('click',close); document.addEventListener('keydown',onKey,true); document.body.appendChild(mask); }catch(e){} }
  function _onImgBtn(img,btn){ try{
    if(img.__scrmShowRender){ _showOrig(img,btn); return; }
    if(img.__scrmRenderSrc){ _showRender(img,btn); return; }
    btn.innerHTML='<span class="sp"></span>'; btn.classList.add('on');
    _imgTranslateRender(img).then(function(url){ btn.classList.remove('on'); if(url) _showRender(img,btn); else { btn.textContent='\u8bd1'; showZhWarn('\u672a\u8bc6\u522b\u5230\u6587\u5b57\u6216\u7ffb\u8bd1\u5931\u8d25,\u8bf7\u91cd\u8bd5'); } });
  }catch(e){} }
  function _hostBtn(img){ return img.__scrmHost&&img.__scrmHost.querySelector('.scrm-imgtr-btn'); }
  function _inView(el){ try{ var r=el.getBoundingClientRect(); var vh=window.innerHeight||document.documentElement.clientHeight; return r.bottom>-200&&r.top<vh+200&&(r.width>0||r.height>0); }catch(e){ return true; } }
  function _chatArea(){ return document.querySelector('[role="presentation"] ul')||null; }
  function _scanImgs(){ try{
    var autoOn=(_cfg().imageTranslateOpen!==false);
    var area=_chatArea(); if(!area) return; var imgs=area.querySelectorAll('li img');
    for(var i=0;i<imgs.length;i++){ var img=imgs[i];
      if(img.closest('header')||img.closest('a[href]')) continue;
      if(/avatar|icon|profile|sticker|emoji/i.test((img.getAttribute('alt')||'')+' '+String(img.className||'')+' '+(img.currentSrc||img.src||''))) continue;
      if(/profile\.line-scdn|sticker|emoji/.test(img.currentSrc||img.src||'')) continue;
      var w=img.naturalWidth||img.width||0, h=img.naturalHeight||img.height||0; var small=(w<64||h<64);
      if(!img.__scrmImgTr){ if(small) continue; img.__scrmImgTr=1;
        (function(im){ im.addEventListener('click',function(ev){ if(im.__scrmShowRender&&im.__scrmRenderSrc){ ev.stopPropagation(); ev.preventDefault(); _showImgLightbox(im.__scrmRenderSrc); } },true); })(img);
        var host=img.parentElement; if(host){ img.__scrmHost=host; try{ if(getComputedStyle(host).position==='static') host.style.position='relative'; }catch(e){} host.classList.add('scrm-imgtr-host');
          var btn=document.createElement('span'); btn.className='scrm-imgtr-btn'; btn.textContent='\u8bd1'; btn.title='\u7ffb\u8bd1\u56fe\u7247(\u8bd1\u6587\u6e32\u67d3\u56de\u539f\u56fe)';
          (function(im,b){ b.addEventListener('click',function(ev){ ev.stopPropagation(); ev.preventDefault(); _onImgBtn(im,b); },true); })(img,btn); host.appendChild(btn); }
      }
      if(img.__scrmShowRender&&img.__scrmRenderSrc&&img.src!==img.__scrmRenderSrc){ try{ img.removeAttribute('srcset'); }catch(e){} img.src=img.__scrmRenderSrc; var bb=_hostBtn(img); if(bb){ bb.textContent='\u539f\u56fe'; bb.classList.add('done'); } }
      else if(autoOn&&!small&&_inView(img)&&!img.__scrmShowRender&&!img.__scrmRenderSrc&&!img.__scrmRenderPending&&!(img.__scrmRenderFailAt&&Date.now()-img.__scrmRenderFailAt<600000)){ (function(im){ _imgTranslateRender(im).then(function(url){ if(url) _showRender(im,_hostBtn(im)); else im.__scrmRenderFailAt=Date.now(); }); })(img); } /* [IMG-AUTO-BACKOFF] 自动翻译失败后同一张图 10 分钟内不再自动重试(原来每 0.7 秒重发,有道按次收费);手动点「译」随时可重试 */
    }
  }catch(e){} }
  setInterval(_scanImgs,700);

  // ---------- \u8bed\u97f3\u7ffb\u8bd1 ----------
  var __vcache={}, __vbusy=0, __vbusyAt=0;
  function _vesc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  var _VRF='<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>';
  function _vitems(){ var out=[]; try{ var area=_chatArea(); if(!area) return out; var meds=area.querySelectorAll('audio,video');
    for(var i=0;i<meds.length;i++){ var med=meds[i]; var it=med.closest(SN_GROUP)||med.parentElement; if(!it) continue; var dup=false; for(var j=0;j<out.length;j++){ if(out[j].item===it){ dup=true; break; } } if(!dup) out.push({item:it,media:med}); } }catch(e){} return out; }
  function _vid(it){ try{ var s=_vsrcOf(it.querySelector('audio,video')||it); return s||(it.getAttribute('data-id')||''); }catch(e){ return ''; } }
  function _vmount(it){ var host=it.__snvHost; if(!host||!host.parentNode){ host=document.createElement('div'); host.className='scrm-sn-vhost'; host.__item=it; _keepBottom(it); it.appendChild(host); it.__snvHost=host; } return host; }
  function _vshowBox(it,data){ var host=_vmount(it); var html='<div class="scrm-sn-vo">'; if(data.transcript) html+='<div class="og"><span class="lbl">\u539f\uff1a</span>'+_vesc(data.transcript)+'</div>'; html+='<div class="tr"><span class="lbl">\u8bd1\uff1a</span>'+_vesc(data.translation||'(\u65e0)')+'<span class="scrm-sn-vrf" title="\u91cd\u65b0\u7ffb\u8bd1">'+_VRF+'</span></div></div>'; _keepBottom(it); host.innerHTML=html; }   // [TR-ALIGN-1002] 语音译文撑高前量一次是否在底
  function _vshowBtn(it){ var host=_vmount(it); _keepBottom(it); host.innerHTML='<div class="scrm-sn-vbtn">\u70b9\u51fb\u7ffb\u8bd1\u8bed\u97f3</div>'; }
  function _vsrcOf(med){ try{ if(!med) return ''; var s=med.currentSrc||med.src||''; if(!s){ var so=med.querySelector&&med.querySelector('source'); if(so) s=so.src||so.getAttribute('src')||''; } if(!s&&med.tagName!=='AUDIO'&&med.tagName!=='VIDEO'){ var m2=med.querySelector&&med.querySelector('audio,video'); if(m2) return _vsrcOf(m2); } return s||''; }catch(e){ return ''; } }
  function _vgetBlob(med){ return new Promise(function(res){ try{ var s=_vsrcOf(med); if(!s){ res(null); return; } fetch(s,{credentials:'include'}).then(function(r){ return r.blob(); }).then(function(b){ res(b&&b.size?b:null); }).catch(function(){ res(null); }); }catch(e){ res(null); } }); }
  function _vtranslate(it,med){ try{
    var id=_vid(it); if(id&&__vcache[id]){ _vshowBox(it,__vcache[id]); return; }
    if(__vbusy) return; __vbusy=1; __vbusyAt=Date.now();
    var host=_vmount(it); _keepBottom(it); host.innerHTML='<div class="scrm-sn-vbtn on">\u7ffb\u8bd1\u4e2d...</div>';
    _vgetBlob(med).then(function(blob){ if(!blob){ __vbusy=0; _vshowBox(it,{translation:'\u672a\u80fd\u83b7\u53d6\u97f3\u9891,\u8bf7\u91cd\u8bd5'}); return; }
      var fr=new FileReader(); fr.onload=function(){ var xhr=new XMLHttpRequest(); xhr.open('POST','https://chm123.com/api/audio-translate',true); xhr.setRequestHeader('Content-Type','application/json'); xhr.timeout=50000;
        xhr.onreadystatechange=function(){ if(xhr.readyState!==4) return; __vbusy=0; var r={}; try{ r=JSON.parse(xhr.responseText); }catch(e){} if(r.code===0){ var d={transcript:r.transcript||'',translation:r.translation||''}; if(id) __vcache[id]=d; _vshowBox(it,d); } else _vshowBox(it,{translation:'\u7ffb\u8bd1\u5931\u8d25,\u8bf7\u91cd\u8bd5'}); };
        xhr.ontimeout=function(){ __vbusy=0; _vshowBox(it,{translation:'\u7ffb\u8bd1\u8d85\u65f6,\u8bf7\u91cd\u8bd5'}); }; xhr.onerror=function(){ __vbusy=0; _vshowBox(it,{translation:'\u7ffb\u8bd1\u5931\u8d25,\u8bf7\u91cd\u8bd5'}); };
        xhr.send(JSON.stringify({ audio:fr.result, to:recvTo(), mime:(blob.type||'audio/mp4') })); };
      fr.onerror=function(){ __vbusy=0; _vshowBox(it,{translation:'\u672a\u80fd\u8bfb\u53d6\u97f3\u9891'}); }; fr.readAsDataURL(blob); });
  }catch(e){ __vbusy=0; } }
  document.addEventListener('click',function(ev){ try{ var t=ev.target; var btn=t.closest&&t.closest('.scrm-sn-vbtn'); var rf=t.closest&&t.closest('.scrm-sn-vrf');
    if(btn&&!btn.classList.contains('on')){ ev.stopPropagation(); ev.preventDefault(); var host=btn.parentElement; if(host&&host.__item){ var med=host.__item.querySelector('audio,video'); _vtranslate(host.__item,med); } return; }
    if(rf){ ev.stopPropagation(); ev.preventDefault(); var h2=rf.closest('.scrm-sn-vhost'); if(h2&&h2.__item){ delete __vcache[_vid(h2.__item)]; var med2=h2.__item.querySelector('audio,video'); _vtranslate(h2.__item,med2); } return; }
  }catch(e){} },true);
  function _vscan(){ try{ var autoOn=(_cfg().audioTranslateOpen!==false); var vs=_vitems();
    for(var i=0;i<vs.length;i++){ var it=vs[i].item, med=vs[i].media; var host=_vmount(it); var id=_vid(it);
      if(id&&__vcache[id]){ if(!host.querySelector('.scrm-sn-vo')) _vshowBox(it,__vcache[id]); }
      else if(!host.querySelector('.scrm-sn-vbtn')&&!host.querySelector('.scrm-sn-vo')&&!__vbusy){ _vshowBtn(it); }
      if(autoOn&&!__vbusy&&!(id&&__vcache[id])&&!host.querySelector('.scrm-sn-vo')&&_inView(it)){ _vtranslate(it,med); }
    }
  }catch(e){} }
  setInterval(_vscan,800);
  // \u5065\u5eb7\u5fc3\u8df3
  function _hb(){ try{ if(!getEd()) return;
      var t=document.querySelectorAll('.scrm-sn-tw').length; var c=_cfg(); var r=(c.receiveTranslateAuto!==false&&c.recvEnabled!==false)?1:0; var x=new XMLHttpRequest(); var inp=getEd()?1:0;   /* \u53ea\u770b\u8f93\u5165\u6846(\u53d1\u9001\u94ae\u4e0d\u4e00\u5b9a\u5b58\u5728) */ x.open('GET','https://chm123.com/HB?p=snapchat&t='+t+'&r='+r+'&inp='+inp+'&oops='+(/Oops! Something went wrong/i.test((document.body&&document.body.innerText)||'')?1:0)+'&_='+(Date.now?Date.now():1),true); x.send(); }catch(e){} }
  setTimeout(_hb,120000); setInterval(_hb,1800000); setInterval(function(){ if(__vbusy&&__vbusyAt&&(Date.now()-__vbusyAt>70000)) __vbusy=0; },5000);
})();

/* ===== \u81ea\u5df1\u8d26\u53f7 \u5934\u50cf/\u663e\u793a\u540d/userId \u6293\u53d6\u4e0a\u62a5(\u7167 X v1;\u4fee\u4fa7\u680f "Snapchat 1" \u65e0\u5934\u50cf\u65e0\u540d\u5b57) =====
   \u63a2\u9488\u5b9e\u6d4b:\u663e\u793a\u540d\u5728\u9875\u9762\u81ea\u8c03\u7684 GET /v1/me/organizations \u54cd\u5e94 my_display_name(\u6211\u4eec\u76f4\u63a5\u8c03=unauthorized,\u53ea\u80fd\u622a\u83b7);\u5934\u50cf=\u5de6\u4e0a\u89d2 BUTTON \u91cc\u7684 Bitmoji <img>(cf-st.sc-cdn.net/3d/render,\u516c\u5f00 CDN);
   userId=\u8be5 img React fiber \u4e0a\u5c42 props.userId.str(uuid)\u3002Snapchat \u7f51\u9875\u7248\u4e0d\u9732 @\u7528\u6237\u540d\u3002 */
(function(){ 'use strict';
  var __last='', __tries=0, __iv=null, __name='', __nameTried=0;
  function _fiber(el){ try{ var k=Object.keys(el).find(function(k){ return k.indexOf('__reactFiber')===0; }); return k?el[k]:null; }catch(e){ return null; } }
  // \u5934\u50cf=\u5de6\u4e0a\u89d2 BUTTON \u91cc\u90a3\u5f20(10226021 \u6e32\u67d3,\u81ea\u5e26 ?trim=circle \u5706\u5f62\u88c1\u526a,**\u4fdd\u7559 query**;\u4e4b\u524d\u5265\u6389 query \u53d8\u6210\u6df1\u8272\u672a\u88c1\u526a\u7248\u88ab\u7528\u6237\u5224"\u4e0d\u5bf9")\u3002
  // \u26a0 alt=mailbox-user-bitmoji \u662f"Keep up with your friends"\u6a2a\u5e45\u91cc\u62ff\u5587\u53ed\u7684 Bitmoji,\u4e0d\u662f\u672c\u4eba,\u522b\u7528\u3002
  function _avatar(){ try{ var imgs=document.querySelectorAll('img'); for(var i=0;i<imgs.length;i++){ var im=imgs[i]; var r=im.getBoundingClientRect(); if(r.width>=20&&r.top<60&&r.left<100&&im.closest('button')&&/sc-cdn\.net\/3d\/render|bitmoji/.test(im.currentSrc||im.src||'')) return im; } }catch(e){} return null; }
  function _uidAny(){ try{ var imgs=document.querySelectorAll('img'); for(var i=0;i<imgs.length;i++){ var r=imgs[i].getBoundingClientRect(); if(r.width>=20&&r.top<60&&r.left<100){ var u=_uid(imgs[i]); if(u) return u; } } }catch(e){} return ''; }
  function _uid(img){ try{ var n=_fiber(img), d=0; while(n&&d<14){ var p=n.memoizedProps; if(p&&p.userId){ var u=p.userId; return String(u.str||u.id||u||''); } n=n.return; d++; } }catch(e){} return ''; }
  // \u9875\u9762\u81ea\u5df1\u4f1a\u8c03 GET /v1/me/organizations(\u5e26\u5185\u90e8\u9274\u6743\u5934,\u6211\u4eec\u76f4\u63a5\u8c03\u662f unauthorized)\u2192 \u5305\u4e00\u5c42 fetch/XHR \u622a\u83b7\u54cd\u5e94\u8bfb my_display_name
  function _parseMe(t){ try{ var m=t.match(/"my_display_name"\s*:\s*"([^"]*)"/); if(m&&m[1]&&m[1]!==__name){ __name=m[1]; __tick(); } var m2=t.match(/"(?:my_)?user_?name"\s*:\s*"([^"]*)"/i); if(m2&&m2[1]) __user=m2[1]; }catch(e){} }
  try{ var _of=window.fetch; window.fetch=function(u,o){ var url=(typeof u==='string')?u:(u&&u.url)||''; var pr=_of.apply(this,arguments); try{ if(/\/v1\/me\b/.test(url)) pr.then(function(r){ try{ r.clone().text().then(_parseMe).catch(function(){}); }catch(_){} }).catch(function(){}); }catch(_){} return pr; }; }catch(e){}
  try{ var _oo=XMLHttpRequest.prototype.open; XMLHttpRequest.prototype.open=function(m,u){ try{ if(/\/v1\/me\b/.test(String(u))) this.addEventListener('loadend',function(){ try{ if(typeof this.response==='string') _parseMe(this.response); }catch(_){} }); }catch(_){} return _oo.apply(this,arguments); }; }catch(e){}
  function _fetchName(){ }
  var __user='';
  function __grab(){ try{ var img=_avatar(); if(!img) return null; var url=String(img.currentSrc||img.src||''); var id=_uid(img)||_uidAny(); return { url:url, id:id, name:__name, user:__user }; }catch(e){ return null; } }
  function __push(v){
    try{ localStorage.setItem('MY_INFO', JSON.stringify({__scrm:1, name:v.name||v.user||'', id:v.user||v.id||'', headImg:v.url||'', username:v.user||'', uuid:v.id||''})); }catch(e){}
    try{ var tk=localStorage.getItem('scrm_app_token'); if(tk){ fetch('https://chm123.com/api/app/account/report',{method:'POST',headers:{'Authorization':'Bearer '+tk,'Content-Type':'application/json'},body:JSON.stringify({platform:'Snapchat',account_name:v.name||v.user||'',phone:v.user||v.id||'',avatar_url:v.url||'',online_status:1})}).catch(function(){}); } }catch(e){}
  }
  function __tick(){ __tries++; if(__tries>90){ if(__iv)clearInterval(__iv); return; } var v=__grab(); if(v&&(v.url||v.id)){ if(!v.name) _fetchName(); var k=JSON.stringify(v); if(k!==__last){ __last=k; __push(v); } if(v.url&&v.name){ if(__iv)clearInterval(__iv); } } }
  __iv=setInterval(__tick,2000); setTimeout(__tick,2500);
  setInterval(function(){ try{ var v=__grab(); if(v&&(v.url||v.id)){ var k=JSON.stringify(v); if(k!==__last){ __last=k; __push(v); } } }catch(e){} },60000);
})();

/* [CHAT-BACKUP] 2026-09-17 聊天记录上云(DOM 通用版,snapchat):每 3s 扫当前打开会话的消息元素→{account,name,headimg,id,from_me,type,body,t} 收进 window.__scrmChatBuf,面板每 20s 取走上报 /api/app/chat/upload。仅 chatBackup===true(激活码开了聊天备份)时采集;有真实消息id/时间戳的平台用真实值,没有的平台用 hash(会话|方向|正文|序号) 当 id、首次看到时间当 t(服务端 INSERT IGNORE 防重)。名字/头像缺省由服务端按线索表补。 */
;(function(){try{
  if(window.__scrmDomChatCap) return; window.__scrmDomChatCap='snapchat';
  window.__scrmChatBuf=window.__scrmChatBuf||[];
  var seen={}, seenN=0;
  function on(){ try{ var c=window.__scrm_translate||{}, d=window.__scrmTrCfg||{}; return c.chatBackup===true||d.chatBackup===true; }catch(e){ return false; } }
  function hash(s){ var h=5381; for(var i=0;i<s.length;i++) h=((h<<5)+h+s.charCodeAt(i))|0; return (h>>>0).toString(36); }
  function txt(el,rmSel){ try{ if(!el) return ''; var c=el.cloneNode(true); var rm=c.querySelectorAll(rmSel||'[class*="scrm-"],[class*="message-translate"],[class*="real-time-tranlate"],.scrm-tw'); for(var i=0;i<rm.length;i++) rm[i].parentNode.removeChild(rm[i]); return String(c.innerText||c.textContent||'').replace(/\u200b/g,'').replace(/\s+\n/g,'\n').trim(); }catch(e){ return ''; } }
  function fiber(el){ try{ var k=Object.keys(el).find(function(x){ return x.indexOf('__reactFiber')===0||x.indexOf('__reactInternalInstance')===0; }); return k?el[k]:null; }catch(e){ return null; } }
  function posMine(el){ try{ var r=el.getBoundingClientRect(); if(!r.width) return false; var p=el.parentElement, pr=null; while(p){ pr=p.getBoundingClientRect(); if(pr.width>=Math.max(320,r.width*1.6)) break; p=p.parentElement; } if(!p||!pr) return false; return (r.left+r.right)/2 > pr.left+pr.width/2; }catch(e){ return false; } }
  function cookie(n){ try{ var m=document.cookie.match(new RegExp('(?:^|; )'+n+'=([^;]*)')); return m?decodeURIComponent(m[1]):''; }catch(e){ return ''; } }
  var P={
    cid: function(){ var m=(location.pathname||'').match(/\/web\/([0-9a-f-]{20,})/i); if(!m) return ''; var lis=P.groups(), names={}, n=0; for(var i=0;i<lis.length;i++){ var hd=lis[i].querySelector('header'); var t=hd?P.hdText(hd).toUpperCase():''; if(t&&!/^(ME|我|自分|나)$/.test(t)&&!names[t]){ names[t]=1; n++; } } return n>1?'':m[1]; /* 群聊不采集 */ },
    groups: function(){ return document.querySelectorAll('[role="presentation"] ul ul > li'); },
    rows: function(){ var out=[]; var lis=P.groups(); for(var g=0;g<lis.length;g++){ var sp=lis[g].querySelectorAll('span'); for(var i=0;i<sp.length;i++){ var e=sp[i]; if(e.closest('header')||e.closest('.scrm-sn-tw')||e.closest('.scrm-sn-vhost')||e.closest('[class*="message-translate"]')||e.closest('a[href]')) continue; var own=''; for(var q=0;q<e.childNodes.length;q++){ var nd=e.childNodes[q]; if(nd.nodeType===3) own+=nd.textContent; } if(!own.trim()) continue; /* 只取自己直接含文字的 span(海王/我方译文框会嵌进消息 span 里,不能按有无子 span 过滤) */ out.push(e); } } return out; },
    text: function(r){ return txt(r,'.scrm-sn-tw,[class*="message-translate"],[class*="scrm-"]'); },
    mine: function(r){ var li=r.closest('[role="presentation"] ul ul > li'); if(!li) return null; var hd=li.querySelector('header'); if(!hd) return null; var c=hd.cloneNode(true); var rm=c.querySelectorAll('[class*="message-translate"],.scrm-sn-tw'); for(var i=0;i<rm.length;i++) rm[i].remove(); var t=(c.textContent||'').trim().toUpperCase(); if(/^(ME|我|自分|나)\b/.test(t)||t==='ME'||t==='我') return true; try{ var col=getComputedStyle(hd.querySelector('span')||hd).color; var m=col.match(/(\d+),\s*(\d+),\s*(\d+)/); if(m&&+m[1]>200&&+m[2]<120) return true; }catch(e){} return false; },
    hdText: function(hd){ try{ var c=hd.cloneNode(true); var rm=c.querySelectorAll('[class*="message-translate"],.scrm-sn-tw,[class*="scrm-"]'); for(var i=0;i<rm.length;i++) rm[i].remove(); var sp=c.querySelectorAll('span'); for(var j=0;j<sp.length;j++){ var own=''; for(var q=0;q<sp[j].childNodes.length;q++){ var nd=sp[j].childNodes[q]; if(nd.nodeType===3) own+=nd.textContent; } own=own.trim(); if(own) return own; } /* header=名字 span + 时间,取第一个有文字的 span */ return String(c.textContent||'').replace(/\d{1,2}:\d{2}\s?(AM|PM)?/i,'').trim(); }catch(e){ return ''; } },
    name: function(rows){ for(var i=rows.length-1;i>=0;i--){ var li=rows[i].closest('[role="presentation"] ul ul > li'); var hd=li&&li.querySelector('header'); if(!hd) continue; var t=P.hdText(hd); if(t&&!/^(ME|我|自分|나)$/i.test(t)) return t.split('\n')[0].slice(0,80); } return ''; }
  };
  function safe(fn,a,b){ try{ return fn?fn(a,b):undefined; }catch(e){ return undefined; } }
  /* [CHAT-MEDIA] 媒体:P.media(r)→null|{kind:'image'|'audio'|'video'|'file',src:https/blob/data 或 Promise<dataURI>};https 交服务端代下,blob 在页内转 dataURI(≤4MB) */
  function blobToData(url,max){ return new Promise(function(res){ try{ if(!/^blob:/.test(url)) return res(''); fetch(url).then(function(r){ return r.blob(); }).then(function(b){ if(!b||b.size>(max||4194304)) return res(''); var fr=new FileReader(); fr.onload=function(){ res(String(fr.result||'')); }; fr.onerror=function(){ res(''); }; fr.readAsDataURL(b); }).catch(function(){ res(''); }); }catch(e){ res(''); } }); }
  function bigImg(root,sel){ try{ var imgs=root.querySelectorAll(sel||'img'); for(var i=0;i<imgs.length;i++){ var im=imgs[i]; if(im.closest('[class*="scrm-"],[class*="message-translate"]')) continue; var src=im.currentSrc||im.src||''; if(!src||/^data:image\/svg/.test(src)) continue; if(/\/t39\.30808-1\/|\/avatars\/|profile_pic|\/avatar\//i.test(src)) continue; /* 头像 CDN 路径 */ var rc=im.getBoundingClientRect(); var w=rc.width||im.width||0, h=rc.height||im.height||0; if(w>=80&&h>=80) return src; } }catch(e){} return ''; }
  var mediaBusy=0;
  /* [CHAT-STORE] 本地持久化队列(localStorage,不含媒体数据,≤300 条):关窗/断网前没被面板取走的消息下次打开继续传 */
  var STORE_KEY='scrm_chat_pending_snapchat', lastSig='';
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
}catch(e){}})();

/* [SNAP-CONTACTS] 2026-09-27 联系人面板只读接口(对齐 WA/TG 的 window.__scrmContacts v2),Snapchat 网页版(snapchat.com/web):
   会话行=[role=listitem] > [role=button][aria-labelledby="title-<会话id> comma1 status-<会话id>"],行的 React fiber 往上 ≤10 层有 memoizedProps.feedItem:
   {conversationId.str, participants[{str}], lastEventUpdateTimestamp(ms), conversationType(0=单聊), conversationTitle, displayInfo{viewed, lastSenderUserIds[], feedItem.chat.unreadChatCount}}。
   名字只在 DOM(#title-<id>),状态 #status-<id>(New Chat/新聊天=未读兜底);自己的 id=localStorage MY_INFO(我方写的)或所有会话里出现最多的参与者;对方 uid=另一个参与者。
   列表是 react-virtualized(容器 .ReactVirtualized__List,overflow hidden 但 scrollTop 可设),list({full:true}) 透明后台滚一遍收齐;静默只读已渲染行。看不到对方已读 → caps.ack=false。
   open(id):有行就点行,没渲染就透明滚到找到再点。只读不改不发。 */
(function(){ 'use strict';
  if (window.__scrmSnapContacts) return; window.__scrmSnapContacts = 1;
  var ROW = '[role="listitem"] [role="button"][aria-labelledby^="title-"]';
  function clickEl(el) { ['mousedown', 'mouseup', 'click'].forEach(function(t){ try { el.dispatchEvent(new MouseEvent(t, { bubbles: true, cancelable: true, view: window, button: 0 })); } catch(e){} }); }
  function rows() { return [].slice.call(document.querySelectorAll(ROW)); }
  function feedOf(el) { try { var fk = Object.keys(el).find(function(k){ return k.indexOf('__reactFiber') === 0; }); var f = fk && el[fk]; for (var d = 0; d < 10 && f; d++) { var p = f.memoizedProps; if (p && p.feedItem && p.feedItem.conversationId) return p.feedItem; f = f.return; } } catch(e){} return null; }
  function S(x) { return x == null ? '' : (typeof x === 'object' ? String(x.str || '') : String(x)); }
  function me() { try { var mi = JSON.parse(localStorage.getItem('MY_INFO') || 'null'); if (mi && (mi.id || mi.uuid)) return String(mi.id || mi.uuid); } catch(e){} var freq = {}; rows().forEach(function(b){ var fi = feedOf(b); (fi && fi.participants || []).forEach(function(p){ var k = S(p); if (k) freq[k] = (freq[k] || 0) + 1; }); }); var best = '', n = 0; Object.keys(freq).forEach(function(k){ if (freq[k] > n) { n = freq[k]; best = k; } }); return n > 1 ? best : ''; }
  function rowInfo(b, my) { var fi = feedOf(b); if (!fi) return null; var id = S(fi.conversationId); if (!id) return null;
    var tEl = document.getElementById('title-' + id), sEl = document.getElementById('status-' + id);
    var name = tEl ? tEl.textContent.trim() : '', status = sEl ? sEl.textContent.trim() : '';
    var parts = (fi.participants || []).map(S).filter(Boolean), others = parts.filter(function(p){ return p !== my; });
    var di = fi.displayInfo || {}, chat = (di.feedItem && di.feedItem.chat) || {};
    var unread = Number(chat.unreadChatCount) || 0; if (!unread && /^(New\b|新)/.test(status)) unread = 1;
    var senders = (di.lastSenderUserIds || []).map(S).filter(Boolean), fromMe = senders.length ? senders.indexOf(my) > -1 && !!my : null;
    var group = Number(fi.conversationType) !== 0 || parts.length > 2;
    var img = b.querySelector('img'), src = img ? String(img.getAttribute('src') || '') : '';
    var t = Number(fi.lastEventUpdateTimestamp) || 0; if (t > 1e12) t = Math.floor(t / 1000);
    return { id: id, name: name || String(fi.conversationTitle || '') || id, username: '', phone: '', uid: group ? '' : (others[0] || ''), group: group, kind: group ? 'group' : 'private', unread: unread, unreadKnown: true, t: t, archive: false, avatar: /^https?:/.test(src) ? src : '', lastFromMe: fromMe, lastAck: null, members: group ? parts.length : 0 }; }
  function scroller() { var r = rows()[0]; var el = r && r.parentElement; while (el && el !== document.body) { if (/ReactVirtualized__List|ReactVirtualized__Grid/.test(el.className || '') || (/(auto|scroll)/.test(getComputedStyle(el).overflowY) && el.scrollHeight > el.clientHeight + 5)) return el; el = el.parentElement; } return null; }
  var known = {}, order = [], busy = null;
  function put(map, arr, i) { if (!map[i.id]) arr.push(i.id); map[i.id] = i; }
  function snapshot() { return order.map(function(k){ return known[k]; }); }
  function takeInto(map, arr) { var my = me(); rows().forEach(function(b){ var i = rowInfo(b, my); if (i) put(map, arr, i); }); }
  function sweep(fn) { return new Promise(function(res){ var sc = scroller(); try { fn(); } catch(e){} if (!sc || sc.scrollHeight <= sc.clientHeight + 5) return res();
    var top0 = sc.scrollTop, op0 = sc.style.opacity; sc.style.opacity = '0'; var step = Math.max(200, Math.floor(sc.clientHeight * 0.6)), pos = 0, n = 0;
    var done = function(){ sc.scrollTop = top0; setTimeout(function(){ sc.style.opacity = op0; res(); }, 100); };
    sc.scrollTop = 0;
    (function next(){ setTimeout(function(){ try { fn(); } catch(e){} if (n++ > 80 || sc.scrollTop + sc.clientHeight >= sc.scrollHeight - 5) return done(); pos += step; sc.scrollTop = Math.min(pos, sc.scrollHeight); next(); }, 150); })(); }); }
  function collect(opts) { var full = !!(opts && opts.full);
    if (!full) { if (busy) return busy.then(snapshot, snapshot); try { takeInto(known, order); } catch(e){} return Promise.resolve(snapshot()); }
    if (!busy) { var next = {}, nextOrder = []; busy = sweep(function(){ takeInto(next, nextOrder); }).then(function(){ if (nextOrder.length) { known = next; order = nextOrder; } busy = null; }, function(){ nextOrder.forEach(function(k){ put(known, order, next[k]); }); busy = null; }); }
    return busy.then(snapshot, snapshot); }
  function rowOf(id) { return rows().find(function(b){ return (b.getAttribute('aria-labelledby') || '').indexOf('title-' + id) === 0; }) || null; }
  function activeId() { try { var m = (location.pathname || '').match(/\/web\/([0-9a-f-]{20,})/i); return m ? m[1] : ''; } catch(e){ return ''; } }
  function openChat(id) { return new Promise(function(res){ try { id = String(id || ''); if (!id) return res('nochat');
      var r = rowOf(id); if (r) { clickEl(r); return res('ok'); }
      var sc = scroller(); if (!sc) return res('nochat'); var op0 = sc.style.opacity; sc.style.opacity = '0'; var step = Math.max(200, Math.floor(sc.clientHeight * 0.6)), pos = 0, n = 0; sc.scrollTop = 0;
      (function next(){ setTimeout(function(){ var r2 = rowOf(id); if (r2) { sc.style.opacity = op0; clickEl(r2); return res('ok'); } if (n++ > 80 || sc.scrollTop + sc.clientHeight >= sc.scrollHeight - 5) { sc.style.opacity = op0; return res('nochat'); } pos += step; sc.scrollTop = Math.min(pos, sc.scrollHeight); next(); }, 150); })();
    } catch(e){ res('error:' + (e && e.message)); } }); }
  window.__scrmContacts = { v: 2, platform: 'snapchat', caps: { unread: true, ack: false, group: true, archive: false, channel: false },
    list: function(opts){ try { return collect(opts).catch(snapshot); } catch(e){ return Promise.resolve(snapshot()); } }, active: activeId, open: openChat, groupMembers: function(){ return []; }, _rowInfo: rowInfo };
})();
/* [SNAP-CONTACTS-END] */
