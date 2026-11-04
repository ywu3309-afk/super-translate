/* __scrmPatchV1__ scrm-patch-tiktok ADAPTER v1 —— TikTok(Business Suite)私信自研翻译。
   TikTok=BrowserView,聊天在同源 iframe(src含 /messages)里;适配器在顶层跑、操作 iframe.contentDocument、配置从顶层 window.__scrmTrCfg 读。
   消息:div[class*="DivChatItemWrapper"] > ... > div[class*="DivTextContainer"] > p[class*="PText"](原文);海王原生译文=.message-translate-content-wrapper(撤掉换我们的)。
   引擎:页面内 XHR 直连 chm123.com(适配器在页面主世界跑,没有 require;TikTok CSP 放行 chm123.com)。[TR-ALIGN-1002] 原注释写"Node https"与实际不符,已改。 */
(function(){
  'use strict';
  if (window.__scrmTtTr) return; window.__scrmTtTr = true;

  function ifrDoc(){ try{
    // TikTok 2026-08改版:聊天直接在顶层文档(不再iframe)→顶层有聊天DOM就用顶层
    try{ if(document.querySelector('[data-e2e="message-input-area"]') || document.querySelector('div[class*="DivChatItemWrapper"]')) return document; }catch(e){}
    var fs=document.querySelectorAll('iframe'); for(var i=0;i<fs.length;i++){ if(/\/messages/.test(fs[i].src||'')){ try{ if(fs[i].contentDocument&&fs[i].contentDocument.body) return fs[i].contentDocument; }catch(e){} } } }catch(e){} return null; }
  function _norm(s){ return (s||'').replace(/[​‌‍﻿]/g,'').replace(/\r/g,'').replace(/^\s+|\s+$/g,''); }
  function _cfg(){ try{ return Object.assign({}, window.__scrm_translate||{}, window.__scrmTrCfg||{}); }catch(e){ return {}; } }
  function recvTo(){ var c=_cfg(); return c.receiveTargetLanguage || c.recvTo || 'zh-CN'; }
  function recvEnabled(){ try{ var c=_cfg(); return c.receiveTranslateAuto!==false && c.recvEnabled!==false; }catch(e){} return true; }
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
  function _hasZh(t){ return /[\u4e00-\u9fff]/.test(t||''); }
  function _hanOk(tl){ return /^(zh|ja|yue)/i.test(String(tl||'')); }   // 目标语言本身就写汉字(中文/日文/粤语)

  // ---------- 翻译引擎(页面内 XHR;google JSON 完整句解析,照 TG)----------
  var _cache={}, _pending={}, _full={};   // _full: 整条消息译文持久缓存(recvTo|原文→译文),切会话同步贴回不闪
  // 译文缓存持久化到 localStorage(www.tiktok.com 同源共享):重启后秒贴不重翻→第一次打开不闪(对齐 WA)
  var _FKEY='__scrmTtFull';
  try{ var _fs=window.localStorage.getItem(_FKEY); if(_fs){ var _fo=JSON.parse(_fs); if(_fo&&typeof _fo==='object') _full=_fo; } }catch(e){}
  var _fSaveT=null;
  function _saveFull(){ try{ if(_fSaveT) return; _fSaveT=setTimeout(function(){ _fSaveT=null; try{
    var ks=Object.keys(_full); if(ks.length>4000){ for(var i=0;i<ks.length-3000;i++) delete _full[ks[i]]; }  // 封顶,留最近~3000条
    window.localStorage.setItem(_FKEY, JSON.stringify(_full));
  }catch(e){} }, 1500); }catch(e){} }
  // 翻译缓存持久层(IndexedDB:句级缓存重启不丢/大容量/异步;不可用则静默降级为纯内存)
  var _idb = (function(){
    var DB='scrm_tr_tt', ST='c', db=null, rdy=false, dead=false;
    var _opened, opened=new Promise(function(r){ _opened=r; });   // 开库有了结果(成功或失败)才兑现:clearP 先等它,库还在打开时点清空也不会漏
    try{
      var rq = indexedDB.open(DB, 1);
      rq.onupgradeneeded = function(e){ try{ var d=e.target.result; if(!d.objectStoreNames.contains(ST)) d.createObjectStore(ST); }catch(_u){} };
      rq.onsuccess = function(e){ db=e.target.result; rdy=true; db.onversionchange=function(){ try{ db.close(); }catch(_v){} db=null; rdy=false; dead=true; }; try{ _trim(20000); }catch(_s){} _opened(); };
      rq.onerror = function(){ dead=true; _opened(); };
    }catch(e){ dead=true; _opened(); }
    function _trim(max){ if(!rdy||dead||!db) return;
      try{ var s=db.transaction(ST,'readwrite').objectStore(ST); var cr=s.count();
        cr.onsuccess=function(){ var n=cr.result; if(n>max){ var del=n-Math.floor(max*0.75); var c=s.openCursor();
          c.onsuccess=function(ev){ var cur=ev.target.result; if(cur&&del>0){ try{cur.delete();}catch(_d){} del--; cur.continue(); } }; } };
      }catch(e){} }
    function get(k, cb){ if(!rdy||dead||!db){ cb(null); return; }
      var fired=false, to=setTimeout(function(){ if(!fired){ fired=true; cb(null); } }, 300);
      try{ var r=db.transaction(ST,'readonly').objectStore(ST).get(k);
        r.onsuccess=function(){ if(!fired){ fired=true; clearTimeout(to); cb(r.result==null?null:r.result); } };
        r.onerror=function(){ if(!fired){ fired=true; clearTimeout(to); cb(null); } };
      }catch(e){ if(!fired){ fired=true; clearTimeout(to); cb(null); } } }
    function put(k, v){ if(!rdy||dead||!db||v==null||v==='') return;
      try{ db.transaction(ST,'readwrite').objectStore(ST).put(v, k); }catch(e){} }
    // [BATCH1-04] 整表清空:等开库有结果 → 同一事务里先 count 再 clear,返回清掉的条数;库不可用/出错/3s 没回都按 0;永不 reject
    function clearP(){ return new Promise(function(resolve){ var fired=false, n=0, to=setTimeout(function(){ fin(0); },3000);
      function fin(v){ if(!fired){ fired=true; clearTimeout(to); resolve(v); } }
      opened.then(function(){ if(!rdy||dead||!db){ fin(0); return; }
        try{ var s=db.transaction(ST,'readwrite').objectStore(ST); var cr=s.count(); cr.onsuccess=function(){ n=cr.result||0; }; var r=s.clear(); r.onsuccess=function(){ fin(n); }; r.onerror=function(){ fin(0); }; }catch(e){ fin(0); } }); }); }
    return { get:get, put:put, clearP:clearP };
  })();
  /* [BATCH1-04] 面板「清空译文缓存」:window.__scrmTrCacheClear() → Promise<{cleared:n}>,永不 reject。
     清三处:句级内存 _cache;整条消息译文 _full 及它在 localStorage __scrmTtFull 的镜像;IndexedDB scrm_tr_tt 表 c(_idb.clearP;表里 s| 发出原文条目只写从不读,随整表清掉)。
     n(全平台同一口径)= 持久层里被清掉的译文条数 = IndexedDB 表的条数;内存和 localStorage 镜像是副本,不另计。
     已显示的译文框/标记一个不删,之后新消息 / ↻ 才重新联网(不触发重译)。 */
  window.__scrmTrCacheClear=function(){
    try{ _cache={}; _full={}; localStorage.removeItem(_FKEY); }catch(e){}
    var p; try{ p=_idb.clearP(); }catch(e){ p=Promise.resolve(0); }
    return p.then(function(k){ return { cleared:Number(k)||0 }; }, function(){ return { cleared:0 }; }); };
  function _parseTr(d){ if(!d) return '';
    try{ var m2=d.match(/\[\[\["((?:\\.|[^"\\])*)"/); if(m2){ var t=m2[1].replace(/\\u([0-9a-fA-F]{4})/g,function(_,h){return String.fromCharCode(parseInt(h,16));}).replace(/\\n/g,'\n').replace(/\\t/g,'\t').replace(/\\"/g,'"').replace(/\\\\/g,'\\'); if(t) return t; } }catch(e){}
    try{ var segs=[], re=/tw-answ-target-text">([\s\S]*?)<\/span>/g, mm; while((mm=re.exec(d))!==null){ segs.push(mm[1]); } if(segs.length) return segs.join(''); }catch(e){}
    var m=d.match(/tw-answ-target-text">([^<]*)</); return m?m[1]:'';
  }
  /* [TR-ALIGN-1002] force=true(↻ 重新翻译):跳过内存缓存和 IndexedDB 读取,必定走网络,新结果覆盖两处缓存。
     原来 ↻ 去删 _cache[rto+'|'+src],键拼错(实际键是 'v1|'+语言+'|'+原文),IndexedDB 也没管 → 点了拿回旧译文。强制请求不与普通请求合并。 */
  function translate(text, tl, force){
    return new Promise(function(resolve){
      text=_norm(text); if(!text){resolve('');return;}
      var rt=_route(), key='v2|'+rt+'|'+(tl||'en')+'|'+text;   // [TR-FIX-1002B] 缓存键 = v2|线路|目标语言|原文,线路与下面实际请求用的是同一个 rt(旧 v1 缓存自然作废)
      var pk=(force?'F|':'')+key;
      if(!force&&_cache[key]!=null){resolve(_cache[key]);return;}
      if(_pending[pk]){_pending[pk].push(resolve);return;}
      _pending[pk]=[resolve];
      // [TR-FIX-1002B] 目标不是中/日却仍含汉字 = 线路回显原文/没翻出来:不进缓存(否则重试永远从缓存拿回这条失败结果)
      var done=function(r){ if(r && (_hanOk(tl)||!_hasZh(r))){ _cache[key]=r; try{_idb.put(key,r);}catch(_p){} var _ks=Object.keys(_cache); if(_ks.length>6000){ for(var _i=0;_i<2000;_i++) delete _cache[_ks[_i]]; } } var qs=_pending[pk]||[]; delete _pending[pk]; qs.forEach(function(f){try{f(r);}catch(e){}}); };
      var doNetwork=function(){
        var async='sl:auto,tl:'+(tl||'en')+',st:'+encodeURIComponent(text.slice(0,1500))+',id:'+(Date.now?Date.now():1);
        var url=routeBase(rt)+'/async/translate?async='+encodeURIComponent(async);
        var to=setTimeout(function(){done('');},8000);
        // 适配器在页面主世界(无 require),走 XHR(TikTok CSP 放行 chm123.com;若将来收紧→热更改桥接)
        try{
          var xhr=new XMLHttpRequest(); xhr.open('GET', url, true); xhr.timeout=8000;
          xhr.onreadystatechange=function(){ if(xhr.readyState!==4) return; clearTimeout(to); var _r=_parseTr(xhr.responseText||''); done(_r?_r.replace(/^\s+|\s+$/g,''):''); };
          xhr.ontimeout=function(){ clearTimeout(to); done(''); };
          xhr.onerror=function(){ clearTimeout(to); done(''); };
          xhr.send();
        }catch(e){ clearTimeout(to); done(''); }
      };
      if(force){ doNetwork(); return; }
      // 先查 IndexedDB 持久缓存,命中免网络;不可用/超时立即回退
      _idb.get(key, function(cached){
        if(cached!=null && cached!=='') done(cached);
        else doNetwork();
      });
    });
  }
  function _trLine(t,tl,tries,force){ return translate(t,tl,force).then(function(r){ if((!r||!r.replace(/\s/g,''))&&(tries||0)<3) return _trLine(t,tl,(tries||0)+1,force); return r; }); }
  function translateML(text,tl,force){
    text=_norm(text); if(!text) return Promise.resolve('');
    if(text.indexOf('\n')===-1) return _trLine(text,tl,0,force);
    return Promise.all(text.split('\n').map(function(ln){ var t=_norm(ln); return t?_trLine(t,tl,0,force):Promise.resolve(''); })).then(function(rs){return rs.join('\n');});
  }

  // ---------- 收信文字翻译(操作 iframe 文档)----------
  function _injStyle(d){ if(!d||d.getElementById('__scrmTtStyle')||!d.head) return;
    var st=d.createElement('style'); st.id='__scrmTtStyle';
    st.textContent=''
      + '.message-translate-content-wrapper,.message-translate-content,.message-translate-loading,.message-translate-btn,.message-translate-error,.real-time-tranlate-content,.real-time-tranlate-text,[class*="real-time-tranlate"]{display:none !important;} '
      + '.scrm-tt-tw{display:block;margin-top:4px;padding-top:4px;border-top:1px dashed #1a7f37;color:#1a7f37;font-size:12px;line-height:1.4;white-space:pre-wrap;word-break:break-word;} '
      + '@keyframes scrm-tt-spin{to{transform:rotate(360deg)}} .scrm-tt-rf{display:inline-flex;align-items:center;margin-left:6px;vertical-align:middle;cursor:pointer;color:#9aa0a6;transition:color .15s;user-select:none;} .scrm-tt-rf:hover{color:#1a7f37;} .scrm-tt-rf.spin svg{animation:scrm-tt-spin .8s linear infinite;}';
    d.head.appendChild(st);
  }
  function _origText(tc){ try{
    var p=tc.querySelector('p[class*="PText"]')||tc.querySelector('p');
    return _norm(p?(p.textContent||''):'');
  }catch(e){ return ''; } }
  /* [TR-ALIGN-1002] 往消息里插译文会撑高气泡:插入前该滚动容器离底 ≤24px → 插完(微任务)贴底;否则不动(往上翻着看/停在中间不被拽)。
     同一轮多次插入只量一次(对齐 TG _keepBottom)。TikTok 消息列表是正常方向(底部 = scrollTop 最大)。 */
  var _kbList=null;
  function _keepBottom(){ try{
    var sc=_ttMsgScroller(); if(!sc) return;
    if(_kbList){ for(var i=0;i<_kbList.length;i++){ if(_kbList[i].sc===sc) return; } }
    else { _kbList=[]; Promise.resolve().then(function(){ var l=_kbList; _kbList=null; for(var k=0;k<l.length;k++){ try{ if(l[k].atB&&l[k].sc.isConnected) l[k].sc.scrollTop=l[k].sc.scrollHeight; }catch(e){} } }); }
    _kbList.push({ sc:sc, atB:_atBottom(sc) });
  }catch(e){} }
  function _atBottom(sc){ return (sc.scrollHeight-sc.scrollTop-sc.clientHeight)<=24; }   // [TR-FIX-1002B] 唯一的「在底部」判断(插译文、预览变高共用)
  function _annotate(tc, want){ try{
    var mine=tc.__scrmTw;
    if(!mine||!mine.parentNode){
      _keepBottom();
      var d=tc.ownerDocument;
      mine=d.createElement('div'); mine.className='scrm-tt-tw';
      var tx=d.createElement('span'); tx.className='scrm-tt-tx'; mine.appendChild(tx);
      var rf=d.createElement('span'); rf.className='scrm-tt-rf'; rf.title='重新翻译';
      rf.innerHTML='<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>';
      mine.appendChild(rf);
      tc.appendChild(mine); tc.__scrmTw=mine;
    }
    var tx2=mine.querySelector('.scrm-tt-tx'); if(tx2&&(tx2.textContent||'')!==want){ _keepBottom(); tx2.textContent=want; }
    var rfb=mine.querySelector('.scrm-tt-rf'); if(rfb&&rfb.classList.contains('spin')) rfb.classList.remove('spin');   // 重译完成→停转
  }catch(e){} }
  /* [TR-FIX-1002B] ↻ 的「待强制刷新」按 收信语言|原文 记在这个集合里,不挂在 DOM 元素上:
     原来打在元素的 __zForce 上,TikTok 一重渲染(换了新元素)标记就丢 → _syncCached 立刻用整条缓存把旧译文贴回去,↻ 等于没点。
     结果回来(成功或失败)时清掉;失败时缓存保持原样(translate 只在拿到新结果时才覆盖缓存,从不先删)。 */
  var _forceKeys={};
  function processMsgs(){ try{
    var d=ifrDoc(); if(!d) return;
    _injStyle(d);
    // JS 强制隐藏海王原生译文(CSS 被更晚样式盖过时兜底)
    try{ var hw=d.querySelectorAll('.message-translate-content-wrapper,[class*="message-translate-content"],[class*="real-time-tranlate"]'); for(var hi=0;hi<hw.length;hi++){ if(hw[hi].style.display!=='none') hw[hi].style.setProperty('display','none','important'); } }catch(e){}
    if(!recvEnabled()) return;
    var _rto=recvTo();
    var tcs=d.querySelectorAll('div[class*="DivTextContainer"]');
    for(var i=0;i<tcs.length;i++){ var tc=tcs[i];
      var src=_origText(tc); if(!src||src.length<1) continue;
      if(src.indexOf('isn’t supported')>=0 || src.indexOf("isn't supported")>=0) continue;  // 不支持的消息类型跳过
      // 本元素已标注且语言一致且译文框还在→跳过
      var frc=!!_forceKeys[_rto+'|'+src];
      if(!frc && tc.__zSrc===src && (tc.__zTo==null || tc.__zTo===_rto) && tc.__scrmTw && tc.__scrmTw.parentNode) continue;
      // 持久缓存命中→立刻同步贴回(切会话DOM重渲染时不重翻、不闪,对齐 WA/Zalo/LINE/TG)
      var cf=frc?null:_full[_rto+'|'+src];   // [TR-ALIGN-1002] ↻ 强制时不用整条缓存,结果回来再覆盖
      if(cf!=null){ tc.__zSrc=src; tc.__zTo=_rto; tc.__zPending=0; _annotate(tc, cf); continue; }
      if(tc.__zPending) continue; tc.__zPending=1;
      (function(el,text,tto,frc){ translateML(text,tto,frc).then(function(r){ el.__zPending=0; if(frc) delete _forceKeys[tto+'|'+text]; try{ if(r&&r.replace(/\s/g,'')){ _full[tto+'|'+text]=r; _saveFull(); el.__zSrc=text; el.__zTo=tto; _annotate(el, r); } else if(frc){ _annotate(el, _full[tto+'|'+text]||'翻译失败,请重试'); } }catch(e){} }); })(tc,src,_rto,frc);
    }
  }catch(e){} }
  setInterval(processMsgs, 350);
  // 极快同步贴字:只对"缓存命中"的消息贴译文(纯查表,不联网/不查样式),在绘制前跑→译文与消息同一帧出现,不闪
  function _syncCached(d){ try{ if(!recvEnabled()) return; var rto=recvTo();
    var tcs=d.querySelectorAll('div[class*="DivTextContainer"]');
    for(var i=0;i<tcs.length;i++){ var tc=tcs[i];
      if(tc.__zSrc && (tc.__zTo==null||tc.__zTo===rto) && tc.__scrmTw && tc.__scrmTw.parentNode) continue;
      var p=tc.querySelector('p[class*="PText"]')||tc.querySelector('p'); var src=p?_norm(p.textContent||''):''; if(!src) continue;
      if(_forceKeys[rto+'|'+src]) continue;   // [TR-FIX-1002B] ↻ 强制重译中:不拿缓存贴回(按 语言|原文 判断,元素重渲染也认得)
      var cf=_full[rto+'|'+src]; if(cf!=null){ tc.__zSrc=src; tc.__zTo=rto; tc.__zPending=0; _annotate(tc, cf); }
    }
  }catch(e){} }
  // MutationObserver:消息一插入,绘制前(rAF)同步贴缓存命中的译文→无"先原文后译文"空档;未命中的交给 350ms 轮询联网翻译
  function _bindObs(){ try{ var d=ifrDoc(); if(!d||d.__scrmTtObs||!d.body) return; d.__scrmTtObs=1; var V=d.defaultView;
    var raf=0, _pmAt=0; var ob=new (V.MutationObserver||window.MutationObserver)(function(){ try{ _syncCached(d); }catch(e){} /* [SMOOTH] 2026-09-14 回调里同步盖章(绘制前),不等下一帧 */
      try{ var _h=window.__ttPv; if(window.__ttPvLast!=null && (!_h||!_h.isConnected) && _ttEditable()) _ttPreview(window.__ttPvLast, window.__ttPvLastTr); }catch(e){} /* [PREVIEW-SYNC] 切会话 TikTok 重建输入区→预览框被扔掉,原来等 400ms 轮询才挂回=空白闪一下;改为 DOM 一变就在绘制前同步挂回 */
      if(raf) return;
      raf=(V.requestAnimationFrame?V.requestAnimationFrame(function(){ raf=0; try{ if(Date.now()-_pmAt>150){ _pmAt=Date.now(); processMsgs(); } }catch(e){} }):setTimeout(function(){ raf=0; try{ processMsgs(); }catch(e){} },16)); /* 未命中的新消息节流 150ms 立即翻,不等 350ms 轮询 */
    });
    ob.observe(d.body, {childList:true, subtree:true});
  }catch(e){} }
  setInterval(_bindObs, 1500);
  // ↻ 重译(事件绑在 iframe 文档)
  function _bindRf(){ var d=ifrDoc(); if(!d||d.__scrmTtRf) return; d.__scrmTtRf=1;
    d.addEventListener('click', function(ev){ try{
      var rf=ev.target&&ev.target.closest&&ev.target.closest('.scrm-tt-rf'); if(!rf) return;
      ev.stopPropagation(); ev.preventDefault();
      var tw=rf.closest('.scrm-tt-tw'); var tc=tw&&tw.parentElement;
      if(tc){
        // [TR-FIX-1002B] 待刷新记在 _forceKeys(语言|原文):processMsgs 走 translateML(...,force) 真联网,_syncCached 期间不贴旧值,结果覆盖缓存;元素被重渲染换掉也照样生效
        var src0=_origText(tc); if(src0) _forceKeys[recvTo()+'|'+src0]=1;
        tc.__zSrc=null; tc.__zTo=null; tc.__zPending=0; var tx=tw.querySelector('.scrm-tt-tx'); if(tx) tx.textContent='翻译中…';
        try{ rf.classList.add('spin'); }catch(e){}   // 转起来,重译完成在 _annotate 里停 }
      }
    }catch(e){} }, true);
  }
  setInterval(_bindRf, 1500);

  // ================= 发送翻译(DraftJS,回车发送,操作 iframe)=================
  function sendEnabled(){ try{ var c=_cfg(); return c.sendTranslateAuto!==false && c.sendEnabled!==false; }catch(e){} return true; }
  function previewEnabled(){ try{ var c=_cfg(); return c.translatePreview!==false && c.previewEnabled!==false; }catch(e){} return true; }
  function detectOn(){ try{ return _cfg().chineseCheck===true; }catch(e){} return false; }
  function _activeCid(){ try{ var d=ifrDoc(); if(d){
      var u=d.querySelector('[data-e2e="chat-uniqueid"]'); var v=u&&_norm(u.textContent||''); if(v) return v;
      var n=d.querySelector('[data-e2e="dm-new-chat-nickname"]')||d.querySelector('[data-e2e="top-chat-nickname"]'); v=n&&_norm(n.textContent||''); if(v) return v;
    } }catch(e){}
    try{ var uu=window.utils; return (uu&&uu.getActiveContactId&&uu.getActiveContactId())||''; }catch(e){} return '';
  }
  // 发布当前联系人给面板轮询读(照 WA/Zalo;顶层 window.utils.getActiveContactId 对 iframe 聊天返回固定值,不可用)
  setInterval(function(){ try{ window.__scrmActiveContactId = _activeCid()||''; }catch(e){} }, 300);
  function sendTo(){ var c=_cfg();
    try{ var id=_activeCid(); if(id){ var sct=c.singleContactTranslate&&c.singleContactTranslate[id];
      // 诊断(每5s一次):看 per-chat 有没有推到适配器、命中没
      if(sct&&(sct.singleContactTranslateOpen||sct.enabled)&&(sct.sendTargetLanguage||sct.sendTo)) return sct.sendTargetLanguage||sct.sendTo; } }catch(e){}
    return c.tiktokGlobalSend || c.sendTargetLanguage || c.sendTo || 'en';
  }
  function _sendToIsZh(){ var to=sendTo(); return !!(to && to.indexOf('zh')===0); }
  /* [TR-ALIGN-1002] 要不要翻的唯一判断(对齐 TG [TG-ZH-SAME]):目标是中文、输入里除汉字外没有任何文字(只有汉字/数字/标点/emoji)→ 原样发送。
     预览、回车、发送按钮三处共用。其他情况一律翻译(原来"目标中文且没有拉丁字母就原样发"→ 俄文/日文假名/韩文被原样发出,已删)。 */
  function _sendAsIs(src){ return _sendToIsZh() && !/\p{L}/u.test(String(src||'').replace(/\p{Script=Han}/gu,'')); }
  // [TR-ALIGN-1002] 译文与原文"相同"的签名:去掉所有非字母数字(任何文字都保留)
  function _sig(s){ return String(s||'').replace(/[^\p{L}\p{N}]+/gu,'').toLowerCase(); }
  var _ASIS_NOTE='  (已是目标语言,原样发送)';
  /* [TR-FIX-1002B] 发送安全的唯一判断(回车、发送按钮、写入后核对、预览都只调这里):
     原来「译文签名与原文相同 → 原样发送」的捷径不查中文:线路限流/Gemini 出错把原文原样回显时,中文被当成"已是目标语言"直接发给客户。
     _safeToSend(text):目标语言不是中/日时,准备发出的文字里只要还有汉字,一律不发。
     _sendText(src, r):翻译结果 r 实际要发的文字 —— 失败/空 → null;签名与原文相同 → 原文;再过 _safeToSend,不过 → null。 */
  function _safeToSend(text){ return _hanOk(sendTo()) || !_hasZh(text); }
  function _sendText(src, r){ if(!(r&&String(r).replace(/\s/g,''))) return null; var out=_sig(r)===_sig(src)?src:r; return _safeToSend(out)?out:null; }
  function _ttEditable(){ var d=ifrDoc(); if(!d) return null; var a=d.querySelector('[data-e2e="message-input-area"]'); if(!a) return null; if(a.getAttribute('contenteditable')==='true') return a; return a.querySelector('.public-DraftEditor-content,[contenteditable="true"]')||a; }
  function _ttInputText(){ try{ var e=_ttEditable(); if(!e) return ''; return _norm(e.innerText||e.textContent||''); }catch(e){ return ''; } }
  // [TT-DRAFT-API] 2026-09-18 TikTok 编辑器是 DraftJS:execCommand('insertText') 只改 DOM 不改 DraftJS 内部状态(实测文字会翻倍、删不掉,发送时用的是内部状态→客户看到预览是英文、发出去还是中文,甚至把聊天面板搞崩"出错了")。
  // 正解:从输入框 React fiber 往上找 {editorState,onChange},用 EditorState.push(ContentState.createFromText(译文)) + moveFocusToEnd 走 onChange 换内容,DOM 由状态渲染,两边永远一致。execCommand 只做兜底。
  function _ttDraftProps(){ try{ var e=_ttEditable(); if(!e) return null; var k=Object.keys(e).find(function(x){ return x.indexOf('__reactFiber')===0||x.indexOf('__reactInternalInstance')===0; }); var fb=e[k], n=0;
    while(fb&&n<40){ var p=fb.memoizedProps; if(p&&p.editorState&&p.editorState.getCurrentContent&&typeof p.onChange==='function') return p; fb=fb.return; n++; } }catch(e){} return null; }
  function _ttSetInput(text){ try{ var e=_ttEditable(); if(!e) return false; var d=e.ownerDocument; var s=String(text==null?'':text);
    try{ var p=_ttDraftProps(); if(p){ var es=p.editorState, ES=es.constructor, CS=es.getCurrentContent().constructor; if(ES&&typeof ES.push==='function'&&CS&&typeof CS.createFromText==='function'){ var ns=ES.push(es, CS.createFromText(s), 'insert-characters'); if(typeof ES.moveFocusToEnd==='function') ns=ES.moveFocusToEnd(ns); p.onChange(ns); try{ e.focus(); }catch(_){} return true; } } }catch(_e){}
    e.focus();
    var sel=d.getSelection(); sel.removeAllRanges(); var r=d.createRange(); r.selectNodeContents(e); sel.addRange(r);
    d.execCommand('insertText', false, s); return true;
  }catch(e){ return false; } }
  function _ttFireEnter(e){ try{ var W=e.ownerDocument.defaultView; window.__ttEnter=1;
    ['keydown','keypress','keyup'].forEach(function(ty){ e.dispatchEvent(new W.KeyboardEvent(ty,{key:'Enter',code:'Enter',keyCode:13,which:13,bubbles:true,cancelable:true})); });
    setTimeout(function(){ window.__ttEnter=0; }, 300);
  }catch(e){} }
  function _ttFindSendBtn(){ try{ var d=ifrDoc(); if(!d) return null;
    var sel=['[data-e2e="message-send"]','[data-e2e="chat-send"]','[data-e2e*="send"]','button[aria-label*="Send"]','button[aria-label*="send"]','[aria-label*="发送"]'];
    for(var i=0;i<sel.length;i++){ var b=d.querySelector(sel[i]); if(b && b.offsetParent!==null) return b.closest('button,[role="button"]')||b; }
    // 兜底:输入区往上找容器,再找里面最靠右的可见 svg 按钮
    var area=d.querySelector('[data-e2e="message-input-area"]'); if(!area) return null;
    var box=area; for(var k=0;k<5&&box.parentElement;k++){ box=box.parentElement; var cand=box.querySelectorAll('button,[role="button"],svg'); if(cand.length){ var best=null,bx=-1; for(var j=0;j<cand.length;j++){ var c=cand[j]; if(c.offsetParent===null) continue; var rr=c.getBoundingClientRect(); if(rr.width<8||rr.width>80) continue; if(rr.left>bx){ bx=rr.left; best=c.closest('button,[role="button"]')||c; } } if(best) return best; } }
    return null;
  }catch(e){ return null; } }
  function _ttClickSend(btn){ try{ var d=btn.ownerDocument, W=d.defaultView; window.__ttEnter=1;
    ['pointerdown','mousedown','pointerup','mouseup','click'].forEach(function(ty){ try{ btn.dispatchEvent(new W.MouseEvent(ty,{bubbles:true,cancelable:true,view:W})); }catch(_e){} });
    setTimeout(function(){ window.__ttEnter=0; }, 300);
  }catch(e){} }
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
  _scrmQuickInstall({ box: _ttEditable, read: function(){ return _ttInputText(); }, write: function(el, t){ return _ttSetInput(t); }, send: function(){ var b=_ttFindSendBtn(); if(b) _ttClickSend(b); else _ttFireEnter(_ttEditable()); }, tr: function(t){ return translateML(t, sendTo()); }, to: function(){ return sendTo(); } }); // [QUICK-SEND] 本平台绑定
  function _ttDoSend(){ var e=_ttEditable(); if(!e) return;
    var b=_ttFindSendBtn();
    if(b){ _ttClickSend(b); setTimeout(function(){ if(_ttInputText()){ _ttFireEnter(e); } }, 160); }   // 点了还没清空→再补回车
    else { _ttFireEnter(e); }
  }
  function _pvLabel(){ return _trRouteName(_cfg())+'实时翻译'; }
  // 预览=在流内插入(对齐 WA):从输入框往上找第一个 flex-column 容器(=dm-new-chat-bottom),把预览作为"输入框那一支"的前一个兄弟插进去。
  // 预览一出现→底部区变高→上方消息滚动区(flex:1)自然变矮,不推挤已有消息=不跳;比 position:fixed 浮层+padding 那套稳,也不再有 padding→重排死循环风险。
  function _ttInflowHost(d){ try{ var a=d.querySelector('[data-e2e="message-input-area"]'); if(!a) return null; var V=d.defaultView, el=a;
    for(var i=0;i<6&&el;i++){ var p=el.parentElement; if(!p) break;
      try{ if(V.getComputedStyle(p).flexDirection==='column') return {col:p, before:el}; }catch(e){}
      el=p; }
    return null;
  }catch(e){ return null; } }
  function _ttInjSendStyle(d){ if(!d||d.getElementById('__scrmTtSendStyle')||!d.head) return; var st=d.createElement('style'); st.id='__scrmTtSendStyle'; st.textContent=/* [TT-PV] 2026-10-03 预览卡片方案D;[TT-PV-FUSE] 同日对齐 WA:卡片上两角圆角、无底边、与输入框(DivInputAreaContainer,8px 圆角灰底)同宽贴合,输入框上两角由 ~ 选择器抹平(TikTok 类名带哈希,只认 DivInputAreaContainer 后缀;只在卡片显示(.scrm-pv-on)时生效,卡片隐藏时输入框恢复原样);输入框灰边常显(TikTok 原来只在聚焦时换类加 0.2 灰边,用户要固定显示),四边都显示——卡片与输入框之间要有一条灰线(用户 10-03 明确要求) */_pvCoreCss('scrm-tt-pv',{gate:true,mode:'fuse',radius:'8px',fuse:'~ * [class*="DivInputAreaContainer"]',fuseExtra:'border-color:rgba(22,24,35,0.2) !important;',maxHeight:'26vh'})+'.scrm-tt-pv{flex:0 0 auto;width:auto;}'; d.head.appendChild(st); }
  /* [TR-FIX-1002B] 预览框变高会把上方消息区压矮:原来每次 _ttPreview 都调 __ttPvBottom 拉底(离底 <140px 就拉到底),输入框空时轮询每 400ms 调一次
     → 往上翻了 30~139px 看消息的人每 400ms 被拽回底部。现在:内容/位置真有变化才动;动之前量一次是否在底(≤24px,同插译文的唯一规则),
     改完预览高度确实变了且原来在底 → 贴底;否则一律不动。删掉 __ttPvBottom/_ttScrollBottom(140px 规则)。 */
  var _backTr=_backTrCore({ backCls:'scrm-tt-pv-back', on:function(){ return !!_cfg().backTranslate; }, sendLang:sendTo, backLang:recvTo, translate:function(t,bl){ return translateML(t,bl); }, before:_keepBottom });   /* [BACK-TR] 回译校对:下面写预览正文的地方调 _backTr.update(正文元素, 译文),行为全在上面的 [BACK-TR-CORE] */
  function _ttPreview(txt, isTr){ try{   /* isTr:这次写的是真译文(回译只认它) */ var d=ifrDoc(); if(!d) return; _ttInjSendStyle(d);
    var host=window.__ttPv;
    if(txt===null||txt===undefined){ if(host){ host.classList.remove('scrm-pv-on'); } return; }
    var ins=_ttInflowHost(d); if(!ins){ if(host){ host.classList.remove('scrm-pv-on'); } return; }
    if(!host||host.ownerDocument!==d){ if(host&&host.parentNode)try{host.parentNode.removeChild(host);}catch(e){} host=d.createElement('div'); host.className='scrm-tt-pv'; window.__ttPv=host; }
    window.__ttPvLast=txt; window.__ttPvLastTr=!!isTr;
    var _lbl=host.querySelector('.scrm-tt-pv-lbl'), _bd=host.querySelector('.scrm-tt-pv-body'), _wl=_pvLabel(), _wb=(txt===''?'…':txt);
    var moved=(host.parentNode!==ins.col || host.nextElementSibling!==ins.before);
    if(!moved && host.classList.contains('scrm-pv-on') && _lbl && _bd && _lbl.textContent===_wl && _bd.textContent===_wb) return;   // 没有任何变化:不碰 DOM、不碰滚动
    var sc=_ttMsgScroller(), atB=!!(sc&&_atBottom(sc)), h0=(host.isConnected&&host.classList.contains('scrm-pv-on'))?host.offsetHeight:0;
    // 放到输入框那一支之前(在流内,只放一次/位置变了才移)
    if(moved){ try{ ins.col.insertBefore(host, ins.before); }catch(e){ if(!host.parentNode) ins.col.appendChild(host); } }
    host.classList.add('scrm-pv-on');
    // [PREVIEW-SYNC] 2026-09-14 不再每次整块 innerHTML 重写(每 400ms 重画一次=闪);只在标签/内容变化时改字
    if(!_lbl||!_bd){ host.innerHTML='<div class="scrm-tt-pv-lbl"></div><div class="scrm-tt-pv-body"></div>'; _lbl=host.querySelector('.scrm-tt-pv-lbl'); _bd=host.querySelector('.scrm-tt-pv-body'); }
    if(_lbl.textContent!==_wl) _lbl.textContent=_wl;
    if(_bd.textContent!==_wb) _bd.textContent=_wb; _backTr.update(_bd, isTr?txt:'');
    if(atB && host.offsetHeight!==h0 && sc.isConnected) sc.scrollTop=sc.scrollHeight;
  }catch(e){} }
  /* [TR-FIX-1002B] 预览与实际发送一致:
     ① 目标语言或线路变化 → 预览立即回占位「…」,直到新结果到达(原来只比语言,换线路时还挂着旧线路的译文);
        只改了原文 → 保留上一次的译文直到新结果到达(不每打一个字闪一次「…」)。新结果到达时键已变就丢弃。
        _ttPvShownLR = 预览当前显示的是哪个「语言|线路」的结果('=' 表示原样发送提示)。
     ② 翻译失败(空/出错/仍含中文,判断同发送 _sendText)→ 预览显示「翻译失败」并清掉去重键,之后的轮询自动重试
        (原来 !r 直接 return:上一句的译文一直挂着、去重键又挡住重试)。同一句连续失败,两次请求至少隔 2 秒。
     ③ 关了预览/发送翻译时清掉去重键,重新打开后预览立即恢复(原来键没变 → 一直隐藏)。
     回车/发送按钮不用预览上的结果,一律按当前原文+语言+线路重新取(translate 走同一缓存键)。 */
  var _ttPvTimer=null, _ttLastPvKey='', _ttPvShownLR='', _ttPvFailKey='', _ttPvFailAt=0;
  function _ttPvKey(src){ return sendTo()+'|'+_route()+'|'+src; }   // 线路取 _route(),与翻译请求同一个值
  function _ttPvFailed(src,msg){ _ttLastPvKey=''; _ttPvShownLR=''; _ttPvFailKey=_ttPvKey(src); _ttPvFailAt=Date.now(); _ttPreview(msg); }   // 预览失败与发送失败共用
  function _onType(){ try{
    if(!previewEnabled()||!sendEnabled()){ _ttPreview(null); _ttLastPvKey=''; return; }   // 关预览→隐藏
    if(!_ttEditable()){ _ttPreview(null); return; }                                   // 没进会话→隐藏
    var src=_ttInputText();
    if(!src){ _ttPreview(''); _ttLastPvKey=''; return; }                              // 空→常驻占位"…"(对齐 WA/Zalo/LINE/TG)
    var to=sendTo(), lr=to+'|'+_route(), key=lr+'|'+src;
    if(key===_ttLastPvKey) return;
    if(key===_ttPvFailKey && Date.now()-_ttPvFailAt<2000) return;   // 同一句刚失败:隔 2 秒再请求
    _ttLastPvKey=key;
    if(_ttPvTimer) clearTimeout(_ttPvTimer);
    if(_sendAsIs(src)){ _ttPvFailKey=''; _ttPvShownLR='='; _ttPreview(src+_ASIS_NOTE); return; }
    if(_ttPvShownLR && _ttPvShownLR!==lr){ _ttPvShownLR=''; _ttPreview(''); }   // 换了语言/线路:先回占位
    _ttPvTimer=setTimeout(function(){ translateML(src, to).then(function(r){ if(_ttLastPvKey!==key||_ttInputText()!==src) return;
      var out=_sendText(src,r); if(out==null){ _ttPvFailed(src,'翻译失败'); return; }
      _ttPvFailKey=''; _ttPvShownLR=(out===src?'=':lr); _ttPreview(out===src?src+_ASIS_NOTE:out, out!==src); }); }, 250);
  }catch(e){} }
  // [TT-SEND-ONE] 发送前的判断只写一份:回车和点发送按钮共用,否则两条路各写一遍必然跑偏
  //   'pass'    = 不该我方管,放行原生(没开翻译 / 空 / 目标是中文且没有外文)
  //   'block'   = 中文检测开着且译前含中文,拦下不发
  //   'handled' = 我方接管:翻译完写回输入框再发
  function _ttSendDecide(src){
    if(!sendEnabled()) return 'pass';
    if(!src) return 'pass';
    if(detectOn() && !_sendToIsZh() && _hasZh(src)) return 'block';
    if(_sendAsIs(src)) return 'pass';   // [TR-ALIGN-1002] 已是目标语言→原样发(与预览同一判断)
    return 'handled';
  }
  /* [TR-FIX-1002B] 翻译后发送:要发的文字只由 _sendText 决定(失败/空/仍含中文 → 不发,提示「翻译失败,请重试」);
     写入后核对:输入框签名 == 要发的文字签名、且过 _safeToSend 才点发送,否则不发(DraftJS 写入没生效时,框里还是中文原文)。
     失败回调原来调用已删除的 fallbackSend → ReferenceError,静默不发也不提示;现在同样提示失败。
     _ttSending 一直保持到真正点了发送(原来译文写进框、90ms 后才发,这段时间再按回车会把译文当原文再翻一遍)。 */
  var _ttSending = 0;
  function _ttTranslateAndSend(src){
    if(_ttSending) return; _ttSending = 1;
    var done = function(){ _ttSending = 0; };
    setTimeout(done, 8000);   // 兜底:翻译挂了也别一直锁着
    var fail = function(){ done(); _ttPvFailed(src,'翻译失败,请重试'); };   // 不发,框里原文保留
    translateML(src, sendTo()).then(function(r){
      var out=_sendText(src,r);
      if(out==null){ fail(); return; }
      if(out!==src) _ttSetInput(out);   // 译文与原文相同(预览显示"原样发送")→ 输入框不动,原样发
      setTimeout(function(){ try{
        var cur=_ttInputText();
        if(_sig(cur)!==_sig(out)||!_safeToSend(cur)){ done(); _ttPvFailed(src,'写入失败,请重试'); return; }
        _ttPreview(null); _ttLastPvKey=''; _ttDoSend(); done();
      }catch(e){ fail(); } }, out!==src?90:0);
    }, fail);
  }

  function _bindSend(){ var d=ifrDoc(); if(!d||d.__ttSendBound) return; d.__ttSendBound=1;
    var _ttKH = function(ev){ try{
      if(ev.__ttKH) return; ev.__ttKH=1;   // window+document双层注册,同一事件只处理一次
      if(window.__ttEnter) return;
      var e=_ttEditable(); if(!e) return;
      var inInput = ev.target===e || (e.contains&&e.contains(ev.target));
      if(!inInput) return;
      if((ev.ctrlKey||ev.metaKey) && (ev.key==='f'||ev.key==='F')) return;   // Ctrl+F 原文直发
      if((ev.ctrlKey||ev.metaKey) && (ev.key==='t'||ev.key==='T')){ ev.preventDefault(); ev.stopPropagation(); var s=_ttInputText(); if(s) translateML(s,sendTo()).then(function(r){ if(r){ _ttSetInput(r); _ttPreview(null); } }); return; }
      if(ev.key!=='Enter'||ev.shiftKey||ev.isComposing) return;
      var src=_ttInputText();
      var act=_ttSendDecide(src);
      if(act==='pass') return;
      ev.preventDefault(); ev.stopPropagation();
      if(act==='block') return;
      _ttTranslateAndSend(src);
    }catch(e){} };
    d.addEventListener('keydown', _ttKH, true);
    try{ (d.defaultView||window).addEventListener('keydown', _ttKH, true); }catch(e){}   // TikTok新页面可能在window层拦Enter→window capture抢先

    // [TT-CLICK-SEND] 拦【点发送按钮】:原来只拦了回车,鼠标点那个纸飞机会把原文直接发出去(用户实测)。
    // pointerdown/mousedown 也一起拦,是因为按钮若绑在 mousedown 上,只拦 click 就来不及了;真正动作只在 click 做一次。
    var _ttCH = function(ev){ try{
      if(ev.__ttCH) return; ev.__ttCH=1;          // window+document 双层注册,同一事件只处理一次
      if(window.__ttEnter) return;                // 我方 _ttClickSend 派发的合成点击,放行
      var t=ev.target; if(!t) return;
      var btn=_ttFindSendBtn();
      // 真实页面上发送键是 <svg data-e2e="dm-new-send-btn">(不是 button),点到的可能是里面的 <path>,
      // 所以既比 _ttFindSendBtn 找到的那个元素,也用 data-e2e 兜一层
      var onBtn = !!(btn && (t===btn || (btn.contains && btn.contains(t)))) || !!(t.closest && t.closest('[data-e2e*="send"]'));
      if(!onBtn) return;
      var src=_ttInputText();
      var act=_ttSendDecide(src);
      if(act==='pass') return;                    // 放行原生点击
      ev.preventDefault(); ev.stopPropagation(); if(ev.stopImmediatePropagation) ev.stopImmediatePropagation();
      if(act==='block') return;
      if(ev.type!=='click') return;               // 三个事件都拦,只在 click 上真正执行一次
      _ttTranslateAndSend(src);
    }catch(e){} };
    ['pointerdown','mousedown','click'].forEach(function(ty){
      d.addEventListener(ty, _ttCH, true);
      try{ (d.defaultView||window).addEventListener(ty, _ttCH, true); }catch(e){}
    });
    d.addEventListener('input', function(ev){ try{ var e=_ttEditable(); if(e&&(ev.target===e||(e.contains&&e.contains(ev.target)))) _onType(); }catch(e){} }, true);
  }
  setInterval(_bindSend, 1500);

  setInterval(_onType, 400);   // 轮询兜底(DraftJS input 事件有时不触发)

  // [TR-FIX-1002B] 预览变高的贴底改在 _ttPreview 里按 24px 规则处理(原 140px 的 _ttScrollBottom 已删)
  // 暴力扫描找"含消息气泡且真会滚"的容器(TikTok 用无class自定义滚动,标准 overflowY 找不到);缓存,失效才重扫
  function _ttMsgScroller(){ try{ var d=ifrDoc(); if(!d) return null;
    var c=window.__ttSc; if(c&&c.ownerDocument===d&&c.isConnected) return c;   // 缓存固定:找到就一直用(除非断开/换会话)
    // 从消息气泡往上走(最多12层)找真正的滚动容器——O(层数),不再全页扫 div 逐个读 scrollHeight(那会每个 div 强制同步重排→CPU打满卡死)
    var item=d.querySelector('div[class*="DivChatItemWrapper"]'); if(!item) return null;
    var el=item.parentElement, V=d.defaultView, hop=0;
    while(el&&el!==d.body&&hop<12){ try{
      var cs=V.getComputedStyle(el), oy=cs.overflowY;
      if((oy==='auto'||oy==='scroll'||oy==='overlay') && (el.scrollHeight-el.clientHeight)>40){ window.__ttSc=el; return el; }
    }catch(e){} el=el.parentElement; hop++; }
    return null;
  }catch(e){ return null; } }
  // 找消息溢出容器(不管当前可不可滚——坏状态下消息太少不可滚,_ttMsgScroller 会返回 null,这里靠 overflowY 也能找到)
  function _ttOverflowHost(){ try{ var d=ifrDoc(); if(!d) return null; var item=d.querySelector('div[class*="DivChatItemWrapper"]'); if(!item) return null;
    var el=item.parentElement, V=d.defaultView, hop=0;
    while(el&&el!==d.body&&hop<12){ try{ var oy=V.getComputedStyle(el).overflowY; if(oy==='auto'||oy==='scroll'||oy==='overlay') return el; }catch(e){} el=el.parentElement; hop++; }
    return null;
  }catch(e){ return null; } }
  // TikTok 懒加载:进会话有时只加载最近几条,不够填满视口→贴底布局把消息顶到底、上方留白,早期记录要多次进入才补载。
  // 检测到"消息不够填满"时,模拟向上滚动手势 promote TikTok 去加载更早的消息。
  // [NUDGE-LIMIT] 2026-09-18 客户反馈切好友整个聊天区闪/跳:原来切会话后 4s 内每 200ms 都催一次(合成 wheel + scrollTop=0 + 假 scroll 事件),消息不满屏的会话被连催 20 次=肉眼可见的抖动。
  // 改:每次切会话最多催 2 次、间隔≥1s、只发 wheel(不再改 scrollTop/派发 scroll 事件);催过 2 次还不满屏就是本来消息就少,不再动它。
  var _ttNudgeN=0, _ttNudgeAt=0;
  function _ttLoadMore(){ try{ var d=ifrDoc(); if(!d) return; var host=_ttOverflowHost(); if(!host) return; var V=d.defaultView;
    if(host.scrollHeight > host.clientHeight + 120) return;               // 已能滚=已填满,无需 nudge
    if(!d.querySelectorAll('div[class*="DivChatItemWrapper"]').length) return;
    var now=Date.now(); if(_ttNudgeN>=2 || now-_ttNudgeAt<1000) return; _ttNudgeN++; _ttNudgeAt=now;
    try{ host.dispatchEvent(new V.WheelEvent('wheel',{deltaY:-800,deltaMode:0,bubbles:true,cancelable:true})); }catch(e){}
  }catch(e){} }
  /* [TR-ALIGN-1002] 2026-10-02 打开/切换会话不再强行滚动(对齐 CEO / TG):删掉切会话后 4 秒钉底窗口
     (前 1.5s 每 200ms 无条件拉到底、之后离底 <200px 跟拉,以及只为它服务的滚轮/拖滚动条监听)。打开会话停在哪由 TikTok 自己决定。
     只保留:切会话后 4 秒内消息不够填满时 _ttLoadMore 催 TikTok 加载更早消息(它自己限 2 次、间隔 ≥1s、只发 wheel,不改 scrollTop)。 */
  var _ttLastCid='', _ttNudgeUntil=0;
  setInterval(function(){ try{ var c=_activeCid(); if(c&&c!==_ttLastCid){ _ttLastCid=c; _ttNudgeUntil=Date.now()+4000; _ttNudgeN=0; _ttNudgeAt=0; } }catch(e){} }, 300);
  setInterval(function(){ try{ if(Date.now()<_ttNudgeUntil) _ttLoadMore(); }catch(e){} }, 200);

  // 客户端健康信标
  function _hb(){ try{ var d=ifrDoc(); var t=d?d.querySelectorAll('.scrm-tt-tw').length:0; var c=_cfg(); var r=(c.receiveTranslateAuto!==false&&c.recvEnabled!==false)?1:0; new Image().src='https://chm123.com/HB?p=tt&t='+t+'&r='+r+'&_='+(Date.now?Date.now():1); }catch(e){} }
  setTimeout(_hb,120000); setInterval(_hb,1800000);
})();

/* [CHAT-BACKUP] 2026-09-17 聊天记录上云(DOM 通用版,tiktok):每 3s 扫当前打开会话的消息元素→{account,name,headimg,id,from_me,type,body,t} 收进 window.__scrmChatBuf,面板每 20s 取走上报 /api/app/chat/upload。仅 chatBackup===true(激活码开了聊天备份)时采集;有真实消息id/时间戳的平台用真实值,没有的平台用 hash(会话|方向|正文|序号) 当 id、首次看到时间当 t(服务端 INSERT IGNORE 防重)。名字/头像缺省由服务端按线索表补。 */
;(function(){try{
  if(window.__scrmDomChatCap) return; window.__scrmDomChatCap='tiktok';
  window.__scrmChatBuf=window.__scrmChatBuf||[];
  var seen={}, seenN=0;
  function on(){ try{ var c=window.__scrm_translate||{}, d=window.__scrmTrCfg||{}; return c.chatBackup===true||d.chatBackup===true; }catch(e){ return false; } }
  function hash(s){ var h=5381; for(var i=0;i<s.length;i++) h=((h<<5)+h+s.charCodeAt(i))|0; return (h>>>0).toString(36); }
  function txt(el,rmSel){ try{ if(!el) return ''; var c=el.cloneNode(true); var rm=c.querySelectorAll(rmSel||'[class*="scrm-"],[class*="message-translate"],[class*="real-time-tranlate"],.scrm-tw'); for(var i=0;i<rm.length;i++) rm[i].parentNode.removeChild(rm[i]); return String(c.innerText||c.textContent||'').replace(/\u200b/g,'').replace(/\s+\n/g,'\n').trim(); }catch(e){ return ''; } }
  function fiber(el){ try{ var k=Object.keys(el).find(function(x){ return x.indexOf('__reactFiber')===0||x.indexOf('__reactInternalInstance')===0; }); return k?el[k]:null; }catch(e){ return null; } }
  function posMine(el){ try{ var r=el.getBoundingClientRect(); if(!r.width) return false; var p=el.parentElement, pr=null; while(p){ pr=p.getBoundingClientRect(); if(pr.width>=Math.max(320,r.width*1.6)) break; p=p.parentElement; } if(!p||!pr) return false; return (r.left+r.right)/2 > pr.left+pr.width/2; }catch(e){ return false; } }
  function cookie(n){ try{ var m=document.cookie.match(new RegExp('(?:^|; )'+n+'=([^;]*)')); return m?decodeURIComponent(m[1]):''; }catch(e){ return ''; } }
  var P={
    doc: function(){ try{ if(document.querySelector('div[class*="DivChatItemWrapper"]')||document.querySelector('[data-e2e="message-input-area"]')) return document; var fs=document.querySelectorAll('iframe'); for(var i=0;i<fs.length;i++){ if(/\/messages/.test(fs[i].src||'')){ try{ if(fs[i].contentDocument&&fs[i].contentDocument.body) return fs[i].contentDocument; }catch(e){} } } }catch(e){} return null; },
    cid: function(){ var d=P.doc(); if(!d) return ''; var u=d.querySelector('[data-e2e="chat-uniqueid"]'); var v=u&&String(u.textContent||'').trim(); if(v) return v; var n=d.querySelector('[data-e2e="dm-new-chat-nickname"]')||d.querySelector('[data-e2e="top-chat-nickname"]'); v=n&&String(n.textContent||'').trim(); return v||''; },
    rows: function(){ var d=P.doc(); return d?Array.prototype.slice.call(d.querySelectorAll('[data-e2e="dm-new-chat-item"]')):[]; },
    text: function(r){ var tc=r.querySelector('div[class*="DivTextContainer"]'); if(tc){ var p=tc.querySelector('p[class*="PText"]')||tc.querySelector('p'); var t=p?String(p.textContent||'').trim():txt(tc); if(/isn.t supported/i.test(t)||/不支持此消息类型/.test(t)) return '[附件]'; return t; } var w=r.querySelector('[data-e2e="dm-warning"]'); if(w&&/不支持|not supported/i.test(r.innerText||'')) return '[附件]'; if(r.querySelector('img[class*="Img"],div[class*="DivImage"],img')) return '[图片]'; if(r.querySelector('video')) return '[视频]'; return ''; },
    mine: function(r){ var h=r.querySelector('div[class*="DivMessageHorizontalContainer"]'); if(h){ var d=P.doc(); var cs=(d&&d.defaultView||window).getComputedStyle(h); if(cs.flexDirection==='row-reverse') return true; if(cs.flexDirection==='row') return false; } return null; },
    id: function(r){ var p=r.parentElement; var ix=(p&&p.getAttribute('data-index'))||r.getAttribute('data-index')||''; return ix&&ix.length>8?ix:''; },
    name: function(){ var d=P.doc(); if(!d) return ''; var n=d.querySelector('[data-e2e="dm-new-chat-nickname"]')||d.querySelector('[data-e2e="top-chat-nickname"]'); return n?String(n.textContent||'').trim():''; },
    quote: function(r){ try{ var q=r.querySelector('[class*="ReplyTextContent"],[class*="ReplyContent"],[class*="QuoteContent"]'); if(!q){ var sn=r.querySelector('[class*="SenderNameContainer"]'); if(sn&&/回复|replied|Reply/i.test(sn.textContent||'')&&sn.nextElementSibling&&!/DivMessageHorizontalContainer/.test(sn.nextElementSibling.className||'')) q=sn.nextElementSibling; } return q?String(q.innerText||'').trim().slice(0,500):''; }catch(e){ return ''; } }, /* 实测 2026-09-19:回复=行内先 "你回复了"(SenderNameContainer)再引用文本容器,再正文 */
    media: function(r){ var s=bigImg(r,'img'); if(s&&/^https?:/.test(s)&&!/avatar/i.test(s)) return {kind:'image',src:s}; var v=r.querySelector('video[src],video source[src]'); var vu=v&&(v.getAttribute('src')||''); if(vu&&/^https?:/.test(vu)) return {kind:'video',src:vu}; return null; }
  };
  function safe(fn,a,b){ try{ return fn?fn(a,b):undefined; }catch(e){ return undefined; } }
  /* [CHAT-MEDIA] 媒体:P.media(r)→null|{kind:'image'|'audio'|'video'|'file',src:https/blob/data 或 Promise<dataURI>};https 交服务端代下,blob 在页内转 dataURI(≤4MB) */
  function fetchToData(url,max){ return new Promise(function(res){ try{ fetch(url,{credentials:'include'}).then(function(r){ if(!r.ok) throw 0; return r.blob(); }).then(function(b){ if(!b||b.size>(max||4194304)||!/^(image|audio|video)\//.test(b.type||'')) return res(''); var fr=new FileReader(); fr.onload=function(){ res(String(fr.result||'')); }; fr.onerror=function(){ res(''); }; fr.readAsDataURL(b); }).catch(function(){ res(''); }); }catch(e){ res(''); } }); }
  function blobToData(url,max){ return new Promise(function(res){ try{ if(!/^blob:/.test(url)) return res(''); fetch(url).then(function(r){ return r.blob(); }).then(function(b){ if(!b||b.size>(max||4194304)) return res(''); var fr=new FileReader(); fr.onload=function(){ res(String(fr.result||'')); }; fr.onerror=function(){ res(''); }; fr.readAsDataURL(b); }).catch(function(){ res(''); }); }catch(e){ res(''); } }); }
  function bigImg(root,sel){ try{ var imgs=root.querySelectorAll(sel||'img'); for(var i=0;i<imgs.length;i++){ var im=imgs[i]; if(im.closest('[class*="scrm-"],[class*="message-translate"]')) continue; var src=im.currentSrc||im.src||''; if(!src||/^data:image\/svg/.test(src)) continue; if(/\/t39\.30808-1\/|\/avatars\/|profile_pic|\/avatar\//i.test(src)) continue; /* 头像 CDN 路径 */ var rc=im.getBoundingClientRect(); var w=rc.width||im.width||0, h=rc.height||im.height||0; if(w>=80&&h>=80) return src; } }catch(e){} return ''; }
  var mediaBusy=0;
  /* [CHAT-STORE] 本地持久化队列(localStorage,不含媒体数据,≤300 条):关窗/断网前没被面板取走的消息下次打开继续传 */
  var STORE_KEY='scrm_chat_pending_tiktok', lastSig='';
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

/* [TT-CONTACTS] 2026-09-26 联系人面板只读接口(对齐 WA/TG 的 window.__scrmContacts v2),TikTok 私信(tiktok.com/messages,React 虚拟列表):
   会话行 [data-e2e="dm-new-conversation-item"][data-conv-id]:昵称 [data-e2e=dm-new-conversation-nickname]、头像 img、未读角标 [class*=DivAvatarBadge]、
   摘要 [class*=SpanInfoExtract]("昵称: 内容",You: 开头=我发的)、时间 [class*=SpanInfoTime](21:47 / Yesterday / 9/20 折算成秒)。
   会话 id:私聊是 "0:1:<uid甲>:<uid乙>"(两个 uid 里不是自己的那个=对方 uid),群是纯数字。列表只渲染可见的 ~33 行,list() 把容器临时拉到内容总高让它一次渲染全部行(不滚动)。
   open(id):有行就点行(选中后 aria-selected=true);没有就滚动列表找到再点(私信页没有会话搜索)。看不到对方已读 → caps.ack=false。只读不改不发。 */
(function(){ 'use strict';
  if (window.__scrmTtContacts) return; window.__scrmTtContacts = 1;
  var ROW = '[data-e2e="dm-new-conversation-item"]';
  /* 个人号在 tiktok.com/messages 主页面;商业号(Business Suite)在 /business-suite/messages,会话列表在同源 iframe(/messages?scene=business)里,且会话 id 挂在外层 [data-conversation-id] 上 */
  function docs() { var out = [document]; try { [].slice.call(document.querySelectorAll('iframe')).forEach(function(f){ try { if (f.contentDocument && f.contentDocument.body) out.push(f.contentDocument); } catch(e){} }); } catch(e){} return out; }
  function convId(el) { var id = el.getAttribute('data-conv-id'); if (!id) { var w = el.closest('[data-conversation-id]'); id = w ? w.getAttribute('data-conversation-id') : ''; } return String(id || ''); }
  function rows() { var out = []; docs().forEach(function(d){ [].slice.call(d.querySelectorAll(ROW)).forEach(function(r){ if (convId(r)) out.push(r); }); }); return out; }
  function clickEl(el) { ['mousedown', 'mouseup', 'click'].forEach(function(t){ try { el.dispatchEvent(new MouseEvent(t, { bubbles: true, cancelable: true, view: window, button: 0 })); } catch(e){} }); }
  function scroller() { var r = rows()[0]; var el = r && r.parentElement; var win = (r && r.ownerDocument && r.ownerDocument.defaultView) || window; var gcs = (win && win.getComputedStyle) ? function(e){ return win.getComputedStyle(e); } : function(e){ return getComputedStyle(e); }; while (el && el.tagName !== 'BODY') { var cs = gcs(el); if (/(auto|scroll)/.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 5) return el; el = el.parentElement; } return null; }
  function parseTime(txt) { txt = String(txt || '').trim(); if (!txt) return 0; var now = new Date(), y = now.getFullYear(), m;
    if ((m = /^(\d{1,2}):(\d{2})$/.exec(txt))) { var d0 = new Date(y, now.getMonth(), now.getDate(), +m[1], +m[2]); if (d0.getTime() > now.getTime() + 300000) d0 = new Date(d0.getTime() - 86400000); return Math.floor(d0.getTime() / 1000); } /* 只有时分=今天;比现在还晚说明是别的时区的"今天",按昨天算 */
    if (/^yesterday$/i.test(txt) || /^昨天$/.test(txt)) { var d = new Date(y, now.getMonth(), now.getDate() - 1); return Math.floor(d.getTime() / 1000); }
    if ((m = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/.exec(txt))) { var yy = m[3] ? (m[3].length === 2 ? 2000 + +m[3] : +m[3]) : y; return Math.floor(new Date(yy, +m[1] - 1, +m[2]).getTime() / 1000); }
    if ((m = /^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})$/.exec(txt))) return Math.floor(new Date(+m[1], +m[2] - 1, +m[3]).getTime() / 1000);
    var p = Date.parse(txt); return p ? Math.floor(p / 1000) : 0; }
  function rowInfo(row) { var id = convId(row); if (!id) return null;
    var nm = row.querySelector('[data-e2e="dm-new-conversation-nickname"]'), name = nm ? nm.textContent.trim() : '';
    var badge = row.querySelector('[class*="DivAvatarBadge"]'), unread = badge ? (parseInt(String(badge.textContent || '').replace(/\D/g, ''), 10) || 0) : 0;
    var ex = row.querySelector('[class*="SpanInfoExtract"]'), extract = ex ? ex.textContent.trim() : '', tm = row.querySelector('[class*="SpanInfoTime"]'), t = parseTime(tm ? tm.textContent : '');
    var img = row.querySelector('img'), av = img ? String(img.getAttribute('src') || '') : '';
    var fromMe = null, pm = /^([^:：]{1,40})[:：]/.exec(extract); if (pm) fromMe = /^(you|你|您)$/i.test(pm[1].trim());
    var parts = id.split(':'), uid = ''; if (parts.length === 4) { var my = mine(); uid = parts[2] === my ? parts[3] : (parts[3] === my ? parts[2] : ''); }
    return { id: id, name: name || id, username: '', phone: '', uid: uid, group: parts.length !== 4, kind: parts.length !== 4 ? 'group' : 'private', unread: unread, unreadKnown: true, t: t, archive: false, avatar: /^https?:/.test(av) ? av : '', lastFromMe: fromMe, lastAck: null, members: 0 }; }
  /* 自己的 uid:私聊会话 id 里出现次数最多的那个(每个私聊都带自己) */
  var _mine = '';
  function mine() { if (_mine) return _mine; var cnt = {}; rows().forEach(function(r){ var p = convId(r).split(':'); if (p.length === 4) { cnt[p[2]] = (cnt[p[2]] || 0) + 1; cnt[p[3]] = (cnt[p[3]] || 0) + 1; } }); var best = '', n = 1; Object.keys(cnt).forEach(function(k){ if (cnt[k] > n) { n = cnt[k]; best = k; } }); if (n >= 2) _mine = best; return _mine; }
  /* 商业版(Business Suite)的 iframe 只有 ~650px 宽,TikTok 把列表渲染成折叠模式(只有头像,没有名字/摘要/时间;参与者状态里也只有自己)。
     真机验证:把 iframe 临时拉宽到 1400px,~1s 后就渲染成完整行,读完恢复原宽。为了不老闪:名字按会话 id 缓存,只有出现没见过的会话时才拉宽一次。 */
  var nameCache = {};
  function collapsedFrame() { var r = rows()[0]; if (!r) return null; var d = r.ownerDocument; if (d === document) return null; if (r.querySelector('[data-e2e="dm-new-conversation-nickname"]')) return null; var f = [].slice.call(document.querySelectorAll('iframe')).find(function(x){ try { return x.contentDocument === d; } catch(e){ return false; } }); return f || null; }
  function needWiden() { var f = collapsedFrame(); if (!f) return null; var unknown = rows().some(function(r){ var id = convId(r); return id && !nameCache[id]; }); return unknown ? f : null; }
  function withFullRows(fn) { var f = needWiden(); if (!f) return Promise.resolve(false);
    var els = [f, f.parentElement].filter(Boolean), old = els.map(function(e){ return { w: e.style.width, mw: e.style.minWidth }; });
    els.forEach(function(e){ e.style.width = '1400px'; e.style.minWidth = '1400px'; });
    return new Promise(function(res){ setTimeout(function(){ try { fn(); } finally { els.forEach(function(e, i){ e.style.width = old[i].w; e.style.minWidth = old[i].mw; }); } res(true); }, 1000); }); }
  /* 虚拟列表只渲染可见行。以前靠把列表滚一遍收齐,用户看得见滚动条乱跑(2026-09-27 用户反馈);现在把滚动容器临时拉到内容总高度,虚拟列表一次把全部行渲染出来,scrollTop 不动,读完立刻恢复高度(真机 TikTok:33 行 → 216 行 → 33 行,~0.6s) */
  function withAllRows(fn) { var sc = scroller(); if (!sc) return Promise.resolve(fn());
    var old = { h: sc.style.height, mh: sc.style.maxHeight }, total = sc.scrollHeight; if (!(total > sc.clientHeight + 5)) return Promise.resolve(fn());
    sc.style.height = total + 'px'; sc.style.maxHeight = 'none';
    return new Promise(function(res){ setTimeout(function(){ var out; try { out = fn(); } finally { sc.style.height = old.h; sc.style.maxHeight = old.mh; } res(out); }, 600); }); }
  function collect() { return new Promise(function(res){ var got = {}, order = [];
    var take = function(){ rows().forEach(function(r){ var i = rowInfo(r); if (!i) return; var c = nameCache[i.id]; if (i.name && i.name !== i.id) nameCache[i.id] = { name: i.name, t: i.t, lastFromMe: i.lastFromMe }; else if (c) { if (c.name) i.name = c.name; if (!i.t) i.t = c.t; if (i.lastFromMe == null) i.lastFromMe = c.lastFromMe; } if (!got[i.id]) { got[i.id] = i; order.push(i.id); } }); };
    var fin = function(){ res(order.map(function(k){ var x = got[k]; if (!x.uid && x.kind === 'private') { var p = x.id.split(':'), my = mine(); x.uid = p[2] === my ? p[3] : (p[3] === my ? p[2] : ''); } return x; })); };
    withFullRows(take).then(function(widened){ take(); if (widened) order.forEach(function(id){ if (!nameCache[id]) nameCache[id] = { name: '', t: got[id].t, lastFromMe: got[id].lastFromMe }; }); /* 拉宽过一次的会话都记住,拿不到名字的也不再反复拉宽 */
      return withAllRows(take); }).then(fin, fin); }); }
  function rowOf(id) { return rows().find(function(r){ return convId(r) === String(id); }) || null; }
  function activeId() { try { var r = rows().find(function(x){ return x.getAttribute('aria-selected') === 'true' || /selected|active/i.test(String(x.className)); }); return r ? convId(r) : ''; } catch(e){ return ''; } }
  function openChat(id) { return new Promise(function(res){ try { id = String(id || ''); if (!id) return res('nochat');
      var r = rowOf(id); if (r) { clickEl(r); return res('ok'); }
      withAllRows(function(){ var r2 = rowOf(id); if (r2) { try { r2.scrollIntoView({ block: 'center' }); } catch(e){} clickEl(r2); return true; } return false; }).then(function(ok){ res(ok ? 'ok' : 'nochat'); }, function(){ res('nochat'); });
    } catch(e){ res('error:' + (e && e.message)); } }); }
  window.__scrmContacts = { v: 2, platform: 'tiktok', caps: { unread: true, ack: false, group: true, archive: false, channel: false },
    list: function(){ return collect().catch(function(e){ try { window.__scrmTtContactsErr = String(e && e.stack || e); } catch(x){} return []; }); }, active: activeId, open: openChat, groupMembers: function(){ return []; }, _rowInfo: rowInfo, _parseTime: parseTime, _rows: rows, _collapsed: collapsedFrame, _mine: mine };
})();
/* [TT-CONTACTS-END] */
