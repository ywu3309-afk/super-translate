/* __scrmPatchV1__ scrm-patch-tg ADAPTER v1 —— Telegram Web A(web.telegram.org/a/, React)自研翻译。
   起步:配置 + 收信文字翻译(改语言自动重翻)。发送/图片/语音后续加。
   DOM:消息=.Message(发出=.own),正文=.text-content;活跃会话=URL hash #<chatId>;输入=.ProseMirror */
(function(){
  'use strict';
  if (window.__scrmTgTr) return; window.__scrmTgTr = true;

  try{ window.__scrmTgPatchVer='20261007b'; }catch(e){}
  function _norm(s){ return (s||'').replace(/[​‌‍﻿]/g,'').replace(/\r/g,'').replace(/^\s+|\s+$/g,''); }
  function _cfg(){ try{ return Object.assign({}, window.__scrm_translate||{}, window.__scrmTrCfg||{}); }catch(e){ return {}; } }
  // 活跃会话ID:优先海王utils(若在),兜底解析URL hash(TG Web A 会话=#<chatId>;海王preload已禁用后走这条)
  function _activeCid(){ try{ var u=window.utils; var v=(u&&u.getActiveContactId&&u.getActiveContactId())||''; if(v) return String(v); }catch(e){}
    try{ var h=(location.hash||'').replace(/^#\/?/,''); var m=h.match(/^-?\d+/); if(m) return m[0]; }catch(e){} return ''; }
  // 把活跃联系人写到共享 DOM 属性,让 dashboard exec(主世界)读到(绕过 contextIsolation)
  setInterval(function(){ try{ var b=document.body; if(b){ var c=_activeCid()||''; if(b.getAttribute('data-scrm-acid')!==c) b.setAttribute('data-scrm-acid', c); } }catch(e){} }, 300);
  function sendTo(){ var c=_cfg();
    try{ var id=_activeCid(); if(id){ var sct=c.singleContactTranslate&&c.singleContactTranslate[id]; if(sct&&(sct.singleContactTranslateOpen||sct.enabled)&&(sct.sendTargetLanguage||sct.sendTo)) return sct.sendTargetLanguage||sct.sendTo; } }catch(e){}
    return c.tgGlobalSend || c.sendTargetLanguage || c.sendTo || 'en';   /* [TR-GLOBAL-NOW] 全局发送语言以 tgGlobalSend(面板保存的全局值)为准:面板推的 sendTargetLanguage 会被好友独立语言污染;面板保存时会立即注入 tgGlobalSend,不再要等轮询 */
  }
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
  /* [TR-FIX-1002B] 线路唯一来源:请求地址、翻译缓存键、预览去重键都用 _route() 的同一个值(原来缓存键里没有线路 → 换线路仍读到旧线路的译文,不会真的重翻) */
  function _route(){ try{ return _trRouteOf(_cfg()); }catch(e){} return 'google2'; }
  function routeBase(route){ return _trRouteUrl(route||_route()); }

  // ---------- 翻译引擎(照 LINE:XHR 绕海王 fetch 劫持,google JSON 完整句解析)----------
  // 缓存对象:页面上已有 globalThis.__scrmTgCache 就用它(当前没有任何 wrapper 提供;test-tg-* 回归靠它预置和中途注入缓存),否则纯内存 + 下面的 localStorage 镜像
  var _cache=(typeof globalThis!=='undefined'&&globalThis.__scrmTgCache)?globalThis.__scrmTgCache:{}, _pending={};
  /* 2026-08-29 \u7f13\u5b58\u6301\u4e45\u5316(localStorage,TG \u9875\u9762\u4e0a\u4e0b\u6587\u7edd\u4e0d\u80fd\u78b0 IndexedDB):wrapper \u65e9\u5f00 IDB \u6a21\u5757\u5df2\u64a4,\u7eaf\u5185\u5b58\u91cd\u542f\u5168\u91cd\u7ffb\u2192\u5b58 localStorage,\u542f\u52a8\u56de\u704c(\u4ec5\u5f53\u65e0 wrapper \u5171\u4eab\u7f13\u5b58\u65f6) */
  var _LSK='__scrmTgTrCache', _lsSaveT=null;
  try{ if(!(typeof globalThis!=='undefined'&&globalThis.__scrmTgCache)){ var _ls=localStorage.getItem(_LSK); if(_ls){ var _lo=JSON.parse(_ls); if(_lo&&typeof _lo==='object'){ for(var _lk in _lo){ if(_cache[_lk]==null) _cache[_lk]=_lo[_lk]; } } } } }catch(e){}
  function _saveCache(){ try{ if(_lsSaveT) return; _lsSaveT=setTimeout(function(){ _lsSaveT=null; try{ var ks=Object.keys(_cache); var start=ks.length>3000?ks.length-3000:0; var o={}; for(var i=start;i<ks.length;i++){ o[ks[i]]=_cache[ks[i]]; } localStorage.setItem(_LSK, JSON.stringify(o)); }catch(e){} },1500); }catch(e){} }
  /* [BATCH1-04] 面板「清空译文缓存」:window.__scrmTrCacheClear() → Promise<{cleared:n}>,永不 reject。
     清两处:内存 _cache(就地逐键删,不换引用)+ 它在 localStorage __scrmTgTrCache 的镜像(连同在途的 1.5s 落盘)。热补丁绝不为译文自己开 IndexedDB 库(会搞坏 TG 发送),译文的持久层只有这份镜像。
     n(全平台同一口径)= 持久层里被清掉的译文条数 = 镜像的条数;内存是它的副本,不另计。已显示的译文框/标记一个不删 → 不触发重译。 */
  window.__scrmTrCacheClear=function(){ var n=0;
    try{ var _m=JSON.parse(localStorage.getItem(_LSK)||'{}'); if(_m&&typeof _m==='object') n=Object.keys(_m).length; }catch(e){}
    try{ for(var k in _cache){ if(Object.prototype.hasOwnProperty.call(_cache,k)) delete _cache[k]; } }catch(e){}
    try{ if(_lsSaveT){ clearTimeout(_lsSaveT); _lsSaveT=null; } localStorage.removeItem(_LSK); }catch(e){}
    return Promise.resolve({ cleared:n }); };
  function _parseTr(d){ if(!d) return '';
    try{ var m2=d.match(/\[\[\["((?:\\.|[^"\\])*)"/); if(m2){ var t=m2[1].replace(/\\u([0-9a-fA-F]{4})/g,function(_,h){return String.fromCharCode(parseInt(h,16));}).replace(/\\n/g,'\n').replace(/\\t/g,'\t').replace(/\\"/g,'"').replace(/\\\\/g,'\\'); if(t) return t; } }catch(e){}
    try{ var segs=[], re=/tw-answ-target-text">([\s\S]*?)<\/span>/g, mm; while((mm=re.exec(d))!==null){ segs.push(mm[1]); } if(segs.length) return segs.join(''); }catch(e){}
    var m=d.match(/tw-answ-target-text">([^<]*)</); return m?m[1]:'';
  }
  /* [TG-TR-KEEPALIVE] 2026-10-02 翻译慢的根因:每次请求都新建加密连接(用户网络走 VPN 隧道,握手 1.2~2 秒;复用已有连接 0.17 秒)。
     Node 默认连接池空闲 5 秒就关 → 打字停一下再打,每次都重新握手。改:翻译专用长连接池,空闲 55 秒内复用(服务器 nginx 保持 75 秒);
     点进输入框/按键时手上没有可用连接,就先发一个 HEAD 把连接建好(不翻译、不计费)。收消息翻译和发送预览共用这一个池。 */
  var _trAgents={}, _warming=false;
  function _trLib(url){ var p=url.indexOf('https:')===0?'https':'http', lib=require(p);
    if(!(p in _trAgents)){ try{ _trAgents[p]=new lib.Agent({ keepAlive:true, keepAliveMsecs:20000, timeout:55000 }); }catch(e){ _trAgents[p]=undefined; } }
    return { lib:lib, agent:_trAgents[p] }; }
  function _trWarm(){ try{
    if(_warming) return;
    var base=routeBase(), t=_trLib(base), a=t.agent; if(!a) return;
    var has=function(m){ for(var k in m){ if(m[k]&&m[k].length) return true; } return false; };
    if(has(a.freeSockets)||has(a.sockets)) return;   // 已有连接(空闲或正在用)
    var u=new URL(base); _warming=true;
    var end=function(){ _warming=false; };
    var r=t.lib.request({ protocol:u.protocol, hostname:u.hostname, port:u.port||undefined, path:'/favicon.ico', method:'HEAD', agent:a, timeout:7000 }, function(res){ res.on('end',end); res.on('error',end); res.resume(); });
    r.on('error',end); r.on('timeout',function(){ try{ r.destroy(); }catch(e){} end(); }); r.end();
  }catch(e){ _warming=false; } }
  /* [TR-FIX-1002B] 缓存键 = 'v2|线路|目标语言|原文'(内存/localStorage/wrapper 落库共用这一个键;旧 v1 键自然作废)。 */
  function _ckey(route, tl, text){ return 'v2|'+route+'|'+(tl||'en')+'|'+text; }
  /* [TR-FIX-1002B] force=↻重新翻译:不读缓存、不复用在途请求,一定联网;成功才覆盖缓存,失败时旧译文原样保留(不先删)。 */
  function translate(text, tl, force){
    return new Promise(function(resolve){
      text=_norm(text); if(!text){resolve('');return;}
      var route=_route(), key=_ckey(route, tl, text);
      if(!force){
        if(_cache[key]!=null){resolve(_cache[key]);return;}
        if(_pending[key]){_pending[key].push(resolve);return;}
        _pending[key]=[resolve];
      }
      var done=function(r){ if(r){ _cache[key]=r; try{_saveCache();}catch(_s){} var _ks=Object.keys(_cache); if(_ks.length>20000){ for(var _i=0;_i<4000;_i++) delete _cache[_ks[_i]]; } }
        if(force){ resolve(r); return; }
        var qs=_pending[key]||[]; delete _pending[key]; qs.forEach(function(f){try{f(r);}catch(e){}}); };
      var url; try{ var async='sl:auto,tl:'+(tl||'en')+',st:'+encodeURIComponent(Array.from(text).slice(0,1500).join(''))+',id:'+(Date.now?Date.now():1);   // 按字符截(按 UTF-16 截会把 emoji 切半 → encodeURIComponent 抛错,这条 key 的等待队列永远不清)
        url=routeBase(route)+'/async/translate?async='+encodeURIComponent(async); }catch(_e){ done(''); return; }
      var to=setTimeout(function(){done('');},7000);
      // TG 的 CSP 拦跨域 XHR/fetch → 用 Node https(preload 上下文,绕过页面 CSP)
      try{
        var _t=_trLib(url);
        var req=_t.lib.get(url, {timeout:7000, agent:_t.agent}, function(res){ var d=''; try{res.setEncoding('utf8');}catch(e){} res.on('data',function(c){d+=c;}); res.on('end',function(){ clearTimeout(to); var _r=_parseTr(d); done(_r?_r.replace(/^\s+|\s+$/g,''):''); }); });
        req.on('error',function(){ clearTimeout(to); done(''); });
        req.on('timeout',function(){ try{req.destroy();}catch(e){} clearTimeout(to); done(''); });
      }catch(e){ clearTimeout(to); done(''); }
    });
  }
  function _trLine(t,tl,tries,force){ return translate(t,tl,force).then(function(r){ if((!r||!r.replace(/\s/g,''))&&(tries||0)<3) return _trLine(t,tl,(tries||0)+1,force); return r; }); }
  /* [TR-FIX-1002B] 多行:任一非空行没翻出来 = 整段失败(返回 ''),绝不拿半截译文去显示/发送 */
  function translateML(text,tl,force){
    text=_norm(text); if(!text) return Promise.resolve('');
    if(text.indexOf('\n')===-1) return _trLine(text,tl,0,force);
    var lines=text.split('\n');
    return Promise.all(lines.map(function(ln){ var t=_norm(ln); return t?_trLine(t,tl,0,force):Promise.resolve(''); })).then(function(rs){
      for(var i=0;i<lines.length;i++){ if(_norm(lines[i]) && !(rs[i]&&rs[i].replace(/\s/g,''))) return ''; }
      return rs.join('\n'); });
  }

  // ---------- 收信文字翻译 ----------
  var _cjk=/[一-鿿]/, _hasLetter=/[a-zA-ZÀ-ɏͰ-῿฀-๿가-힣぀-ヿ]/;
  function _injStyle(){ if(document.getElementById('__scrmTgStyle')||!document.head) return;
    var st=document.createElement('style'); st.id='__scrmTgStyle';
    st.textContent=''
      // 隐藏海王原生翻译UI(译文框/预览/图片翻译/AI工具菜单)——干净接管
      +'.message-translate-content-wrapper,.message-translate-content,.message-translate-loading,.message-translate-btn,.message-translate-error,.translate-content-result,.translate-content-origin,.translate-error-message,.image-translate-action,.image-translate-btn,.image-translate-loading,.image-translate-action-list,.action-translate-text{display:none !important;} '
      // 我方译文样式
      +'.scrm-tg-tw{display:block;margin-top:4px;padding-top:4px;border-top:1px dashed #1a7f37;color:#1a7f37;font-size:14px;line-height:1.4;white-space:pre-wrap;word-break:break-word;} .scrm-tg-rf{cursor:pointer;margin-left:6px;color:#8a96a3;user-select:none;display:inline-flex;align-items:center;vertical-align:middle;} .scrm-tg-rf:hover{color:#1a7f37;}';
    document.head.appendChild(st);
  }
  // 隐藏海王"AI工具/翻译图片内文字"菜单项(文本匹配,菜单项动态生成无固定class)
  function _hideHaiwangMenu(){ try{
    var items=document.querySelectorAll('.MenuItem,[class*="MenuItem"],[role="menuitem"]');
    for(var i=0;i<items.length;i++){ var t=(items[i].textContent||'').trim();
      if(t==='AI工具'||t==='翻译图片内文字'||t==='翻译图片内的文字'){ items[i].style.display='none'; }
    }
  }catch(e){} }
  function _msgText(tc){ try{
    var clone=tc.cloneNode(true);
    var junk=clone.querySelectorAll('.MessageMeta,[class*="MessageMeta"],[class*="message-meta"],.Reactions,[class*="reaction"],.scrm-tg-tw,[class*="message-translate"],time');
    for(var i=0;i<junk.length;i++){ try{ junk[i].remove(); }catch(e){} }
    /* 2026-08-29 \u6362\u884c:textContent \u4e22 <br> \u2192 \u591a\u884c\u5408\u6210\u4e00\u884c\u9001\u7ffb,\u8bd1\u6587\u4e0d\u6362\u884c;\u628a <br> \u6362\u6210 \\n(\u8bd1\u6587\u6846 pre-wrap,translateML \u9010\u884c\u7ffb\u518d\u62fc) */
    try{ var brs=clone.querySelectorAll('br'); for(var b=0;b<brs.length;b++){ try{ brs[b].parentNode.replaceChild(document.createTextNode('\n'), brs[b]); }catch(_b){} } }catch(_e){}
    return _norm(clone.textContent||'').replace(/\n{3,}/g,'\n\n');
  }catch(e){ return _norm(tc.textContent||''); } }
  /* [TG-KEEP-BOTTOM] 2026-10-02 往消息里加东西(译文/语音译文)会把气泡撑高:插入前正停在最底部 → 插完仍贴底;
     不在底部(往上翻着看,或 TG 打开会话时停在「未读消息」那里)→ 位置不动。打开会话停在哪由 TG 自己决定(有未读停第一条未读、右下角出带数字的↓按钮,同官方/CEO),这里不再干预。
     同一轮连续插入只量一次,插完(微任务)统一贴一次底。 */
  var _kbList=null;
  function _keepBottom(el){ try{
    var sc=el&&el.closest&&el.closest('.MessageList'); if(!sc) return;
    if(_kbList){ for(var i=0;i<_kbList.length;i++){ if(_kbList[i].sc===sc) return; } }
    else { _kbList=[]; Promise.resolve().then(function(){ var l=_kbList; _kbList=null; for(var k=0;k<l.length;k++){ try{ if(l[k].atB&&l[k].sc.isConnected) l[k].sc.scrollTop=l[k].sc.scrollHeight; }catch(e){} } }); }
    _kbList.push({ sc:sc, atB:(sc.scrollHeight-sc.scrollTop-sc.clientHeight)<=24 });
  }catch(e){} }
  function _annotate(tc, want){ try{
    // 去重:整条消息里只留一个译文框(TG React 重渲染会残留旧的)
    var msg=(tc.closest&&tc.closest('.Message'))||tc;
    var all=msg.querySelectorAll('.scrm-tg-tw'); var mine=null;
    for(var i=0;i<all.length;i++){ if(!mine) mine=all[i]; else { try{all[i].remove();}catch(e){} } }
    if(!mine||!mine.parentNode){
      mine=document.createElement('div'); mine.className='scrm-tg-tw';
      var tx=document.createElement('span'); tx.className='scrm-tg-tx'; mine.appendChild(tx);
      var rf=document.createElement('span'); rf.className='scrm-tg-rf'; rf.innerHTML='<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>'; rf.title='重新翻译'; mine.appendChild(rf);
      _keepBottom(tc); tc.appendChild(mine);
    }
    tc.__scrmTw=mine;
    var tx2=mine.querySelector('.scrm-tg-tx'); if(tx2&&(tx2.textContent||'')!==want){ _keepBottom(tc); tx2.textContent=want; }
  }catch(e){} }
  // 可视区观察器(学WA):消息进可视区才翻,长会话不再每500ms全量翻=省API省性能。observer不可用则降级为立即翻
  var _visObs=null, _visObsBad=false;
  function _ensureVisObs(){ if(_visObs||_visObsBad) return _visObs;
    try{ _visObs=new IntersectionObserver(function(entries){ for(var k=0;k<entries.length;k++){ var e=entries[k]; if(!e.isIntersecting) continue; var el=e.target; try{ _visObs.unobserve(el); el.__zObs=0; }catch(_u){} _tgTrOne(el); } }, { rootMargin:'900px 0px' } /* 提前 900px 预取,滚动到时译文已就绪 */); }
    catch(e){ _visObsBad=true; _visObs=null; }
    return _visObs; }
  // 翻一条消息(进可视区时调):同步命中秒贴,否则异步翻
  /* [TR-FIX-1002B] ↻ 强制刷新中的消息:按「目标语言|原文」记在集合里(TG 重渲染会换掉 DOM 元素,不能挂在元素上)。
     在集合里的消息,三处贴译文入口(_tgTrOne/processMsgs/观察器 run)都不去贴旧缓存,等新结果回来。 */
  var _rfSet={};
  function _rfKey(tl, src){ return (tl||'')+'|'+src; }
  // 三处入口共用:缓存命中就贴上(返回 true);正在 ↻ 刷新的也算已处理(保持「翻译中…」);否则返回 false 交给联网
  function _applySync(tc, src, rto){
    if(_rfSet[_rfKey(rto,src)]) return true;
    var r=_syncTr(src,rto); if(!r) return false;
    tc.__zSrc=src; tc.__zTo=rto; tc.__zPending=0; _annotate(tc,r); return true;
  }
  function _tgTrOne(tc){ try{
    if(!recvEnabled()||!tc||!tc.isConnected) return;
    var _rto=recvTo(); var src=_msgText(tc); if(!src||src.length<1) return;
    if(tc.__zSrc===src && (tc.__zTo==null||tc.__zTo===_rto)) return;
    if(_applySync(tc,src,_rto)) return;
    if(tc.__zPending) return; tc.__zPending=1;
    translateML(src,_rto).then(function(r){ tc.__zPending=0; try{ if(r&&r.replace(/\s/g,'')){ tc.__zSrc=src; tc.__zTo=_rto; _annotate(tc,r); } }catch(e){} });
  }catch(e){} }
  function processMsgs(){ try{
    _injStyle(); _hideHaiwangMenu();
    // JS 强制隐藏海王原生译文(CSS !important 被海王更晚的样式盖过,inline important 最高优先级)
    try{ var hw=document.querySelectorAll('.message-translate-content-wrapper,[class*="message-translate-content"],[class*="message-translate-loading"],[class*="message-translate-btn"],.audio-translate,.audio-translate-btn,[class*="audio-translate"]'); for(var hi=0;hi<hw.length;hi++){ if((hw[hi].style.display!=='none')) hw[hi].style.setProperty('display','none','important'); } }catch(e){}
    if(!recvEnabled()) return;
    var _rto=recvTo();
    var tcs=document.querySelectorAll('.Message .text-content');   // 收+发都翻译标注(发出消息也显示阅读语言译文,照海王)
    for(var i=0;i<tcs.length;i++){ var tc=tcs[i];
      var src=_msgText(tc); if(!src||src.length<1) continue;
      if(tc.__zSrc===src && (tc.__zTo==null || tc.__zTo===_rto)){ continue; }
      // ① 同步命中缓存→秒贴译文,不走异步(切好友DOM重建后翻过的消息不闪。学WA同步贴)
      if(_applySync(tc,src,_rto)) continue;
      // ② 未命中→登记可视区观察,进可视区才翻(长会话省API省性能);observer不可用→立即翻(降级兜底)
      var _obs=_ensureVisObs();
      if(_obs){ if(!tc.__zObs){ tc.__zObs=1; try{ _obs.observe(tc); }catch(e){ _tgTrOne(tc); } } }
      else { _tgTrOne(tc); }
    }
  }catch(e){} }
  setInterval(processMsgs, 500);
  /* 2026-08-29 \u5207\u597d\u53cb\u4e1d\u6ed1(\u5bf9\u9f50 X/Messenger):MutationObserver \u5fae\u4efb\u52a1\u5728\u7ed8\u5236\u524d\u540c\u5e27\u628a\u7f13\u5b58\u547d\u4e2d\u7684\u8bd1\u6587\u8d34\u4e0a,\u4e0d\u7b49 500ms \u8f6e\u8be2\u2192\u6ca1\u6709"\u5148\u539f\u6587\u540e\u8bd1\u6587"\u7a7a\u6863;\u672a\u547d\u4e2d\u7684\u4ecd\u4ea4\u7ed9\u8f6e\u8be2/\u53ef\u89c6\u533a\u89c2\u5bdf\u5668\u8054\u7f51 */
  (function(){
    function run(){ try{ if(!recvEnabled()) return; var rto=recvTo(); var tcs=document.querySelectorAll('.Message .text-content');
      for(var i=0;i<tcs.length;i++){ var tc=tcs[i]; if(tc.__zSrc&&(tc.__zTo==null||tc.__zTo===rto)&&tc.__scrmTw&&tc.__scrmTw.isConnected) continue;
        var src=_msgText(tc); if(!src) continue; if(!_applySync(tc,src,rto) && !tc.__zObs && !tc.__zPending){ /* [TG-FAST-QUEUE] 2026-09-14:缓存未命中的新节点(翻历史时 TG 一次挂载一片)原来要等 500ms 轮询才登记可视区观察→再联网,译文晚 1~1.5s 才出现像"刷新";改为 DOM 一变就立刻登记(对齐 FB 的即时扫描) */ try{ var _o=_ensureVisObs(); if(_o){ tc.__zObs=1; _o.observe(tc); } else { _tgTrOne(tc); } }catch(_q){} } }
    }catch(e){} }
    function attach(){ try{ var root=document.body||document.documentElement; if(!root){ setTimeout(attach,200); return; }
      /* [TG-SYNC-BEFORE-MEASURE] 2026-10-02 在观察器回调里【立即】贴缓存译文,不再推迟一个微任务。
         Telegram 一帧内按微任务依次:插消息 DOM → 量列表高度 → 设滚动位置(fasterdom 的 mutate/measure/mutate)。
         原来推迟的 run 正好排在"量"和"设"之间:Telegram 量到的是没译文的高度,设下去时内容已被译文撑高,
         打开会话就停在离底部"这批译文总高度"的地方(实测量 3406、设时 4351,离底 884)。立即贴 → Telegram 量到的就是带译文的真实高度。
         我们自己贴译文引起的变化会再触发一次回调,run 发现都已贴好就什么也不做。 */
      new MutationObserver(run).observe(root,{childList:true,subtree:true}); }catch(e){ setTimeout(attach,500); } }
    attach();
  })();
  // 客户端健康信标:上报"找到消息数 vs 已翻译数"(只发计数),服务器据此发现适配器被平台更新打挂
  function _hb(){ try{
    var f=document.querySelectorAll('.Message .text-content').length;
    var t=document.querySelectorAll('.scrm-tg-tw').length;
    var r=recvEnabled()?1:0;
    new Image().src='https://chm123.com/HB?p=tg&f='+f+'&t='+t+'&r='+r+'&_='+(Date.now?Date.now():1);
  }catch(e){} }
  setTimeout(_hb, 120000); setInterval(_hb, 1800000);   // 2min 首报 + 每30min
  /* 2026-08-29 \u5b66\u6d77\u738b:\u63a5\u5165\u6001/\u672a\u8bfb\u6570\u79d2\u7ea7\u53d1\u5e03\u5230 body \u5c5e\u6027(\u6d77\u738b TG preload \u5df2\u7981,\u5b83\u7684 send-account-offline \u4e0d\u518d\u6765) \u2192 dashboard \u6bcf\u79d2\u8bfb data-scrm-online/unread \u66f4\u65b0\u4fa7\u680f\u70b9+\u89d2\u6807+\u4e0a\u62a5 */
  function _tgState(){ try{
    var st='0';
    if(document.querySelector('#auth-qr-form,#auth-phone-number-form,#auth-code-form,#auth-password-form,.auth-form,.Auth')) st='auth';
    else { var hasList=!!document.querySelector('.chat-list,#LeftColumn .ChatList,.ChatFolders,#LeftColumn'); var conn=false;
      try{ var cs=document.querySelector('.ConnectionState,[class*="ConnectionState"],.connecting'); if(cs&&cs.offsetParent!==null) conn=true; }catch(e){}
      if(!conn){ try{ var lh=document.querySelector('#LeftColumn .left-header,#LeftColumn header'); var tx=lh?(lh.textContent||''):''; if(/Connecting|Waiting for network|Updating|\u6b63\u5728\u8fde\u63a5|\u7b49\u5f85\u7f51\u7edc|\u8fde\u63a5\u4e2d|\u66f4\u65b0\u4e2d/.test(tx)) conn=true; }catch(e){} }
      if(navigator.onLine===false) conn=true;
      st=(hasList&&!conn)?'1':'0'; }
    var un=0; try{ var m=(document.title||'').match(/^\((\d+)\)/); if(m) un=parseInt(m[1],10)||0; }catch(e){}
    if(!un){ try{ var bs=document.querySelectorAll('.ChatBadge .unread,.ChatBadge-transition .unread,.badge.unread'); for(var i=0;i<bs.length;i++){ if(bs[i].closest('.chat-item-archive,.Archive')) continue; /* [TG-UNREAD-ARCHIVE] 2026-10-04 「已归档」那一行的角标不算(标题 "(N)" 本身不含归档,这里是没标题时的兜底);.chat-item-archive 是 Web A 源码 Archive.tsx 的固定类,.Archive 是老版本 */ var n=parseInt((bs[i].textContent||'').replace(/\D/g,''),10); if(n>0&&n<100000) un+=n; } }catch(e){} }
    var b=document.body; if(b){ if(b.getAttribute('data-scrm-online')!==st) b.setAttribute('data-scrm-online',st); var us=String(un); if(b.getAttribute('data-scrm-unread')!==us) b.setAttribute('data-scrm-unread',us); }
  }catch(e){} }
  setInterval(_tgState, 1000); setTimeout(_tgState, 1500);

  document.addEventListener('click', function(ev){ try{
    var rf=ev.target&&ev.target.closest&&ev.target.closest('.scrm-tg-rf'); if(!rf) return;
    ev.stopPropagation(); ev.preventDefault();
    var tw=rf.closest('.scrm-tg-tw'); var tc=tw&&tw.parentElement; if(!tc) return;
    /* [TR-FIX-1002B] ↻ 真联网:原来只清 __zSrc,轮询/观察器马上又从缓存把旧译文贴回去,等于没刷新。
       现在:按「语言|原文」登记刷新中 → 强制联网(不读缓存)→ 成功覆盖缓存;失败保留旧缓存。结束后撤销登记,让这条(含重渲染后的新元素)按缓存重贴。 */
    var src=_msgText(tc), rto=recvTo(), k=_rfKey(rto,src); if(!src||_rfSet[k]) return;
    _rfSet[k]=1;
    var tx=tw.querySelector('.scrm-tg-tx'); if(tx) tx.textContent='翻译中…';
    translateML(src, rto, true).then(function(){
      delete _rfSet[k];
      var tcs=document.querySelectorAll('.Message .text-content');
      for(var i=0;i<tcs.length;i++){ if(tcs[i].__zSrc===src){ tcs[i].__zSrc=null; } }
      tc.__zSrc=null; processMsgs();
    });
  }catch(e){} }, true);

  // ================= 发送翻译(打字→预览→回车发译文,照 WA/Zalo)=================
  function sendEnabled(){ try{ var c=_cfg(); return c.sendTranslateAuto!==false && c.sendEnabled!==false; }catch(e){} return true; }
  function previewEnabled(){ try{ var c=_cfg(); return c.translatePreview!==false && c.previewEnabled!==false; }catch(e){} return true; }
  function detectOn(){ try{ return _cfg().chineseCheck===true; }catch(e){} return false; }
  function _tgtIsZh(){ var to=sendTo(); return !!(to && to.indexOf('zh')===0); }
  /* [TG-ZH-SAME] 2026-10-02 发送目标是中文、输入里除汉字外没有别的文字(只有汉字/数字/标点/emoji)→ 不用翻,原样发送。
     预览、回车、发送按钮三处共用这一个判断;预览照 WhatsApp [SAME-LANG] 显示原文并标注(原来只显示占位「…」,看着像没翻译)。
     原判断只认拉丁字母算外文 → 目标中文时打俄文/日文假名/韩文/泰文也被当成"不用翻"原样发出,一并改正。 */
  function _sendAsIs(src){ return _tgtIsZh() && !/\p{L}/u.test(String(src||'').replace(/\p{Script=Han}/gu,'')); }
  /* [TR-FIX-1002B] 「这段文字能不能发出去」唯一判断:回车、发送按钮、写入后核对、预览都只调它。
     目标语言不是中文/日文时,要发出的文字里只要还有汉字 = 翻译失败(或线路原样退回了中文),一律拦下,绝不把中文发给客户。 */
  function _safeToSend(text){ var t=String(text==null?'':text); if(!t.replace(/\s/g,'')) return false;
    if(/^(zh|ja|yue)/i.test(String(sendTo()||''))) return true;
    return !/\p{Script=Han}/u.test(t); }
  // 签名:只比字母数字(全部语言),换行空格标点差异不算
  function _sig(s){ return String(s==null?'':s).replace(/[^\p{L}\p{N}]+/gu,'').toLowerCase(); }
  var _TR_FAIL='翻译失败,请重试';
  function _tgInput(){ try{ var m=document.getElementById('editable-message-text-modal'); if(m&&m.offsetParent!==null) return m; }catch(e){} /* [TG-CAPTION-SEND] 2026-09-19 发图/相册的 Send Photo 弹窗里说明框是 #editable-message-text-modal,原来只盯主输入框→说明原样中文发出 */ return document.getElementById('editable-message-text') || document.querySelector('#editable-message-text, .input-message-input[contenteditable], [contenteditable="true"].form-control'); }
  /* [TG-READ-EMOJI] 输入框里的 emoji 是 <img alt="👍">(innerText/textContent 都读不到):逐节点读,img 取 alt、br/段落换行。否则纯 emoji 的快捷回复写进去核对成"没写对"(mismatch)发不出,翻译发送也会把 emoji 丢掉 */
  function _tgReadNode(n){ if(n.nodeType===3) return n.data; if(n.nodeType!==1) return ''; if(_tgIsMention(n)) return ' '; /* [TG-MENTION] 提及不算正文 */ var t=n.tagName; if(t==='BR') return '\n'; if(t==='IMG') return n.getAttribute('alt')||''; var s=''; for(var i=0;i<n.childNodes.length;i++) s+=_tgReadNode(n.childNodes[i]); if(t==='P'||t==='DIV') s+='\n'; return s; }
  function _tgInputText(){ try{ var el=_tgInput(); if(!el) return ''; var s=''; for(var i=0;i<el.childNodes.length;i++) s+=_tgReadNode(el.childNodes[i]); return _norm(s); }catch(e){ return ''; } }
  function _tgSetInput(text){ try{ var el=_tgInput(); if(!el) return false; el.focus();
    var sel=window.getSelection(); sel.removeAllRanges(); var r=document.createRange(); r.selectNodeContents(el); sel.addRange(r);
    document.execCommand('insertText', false, String(text==null?'':text)); return true;
  }catch(e){ return false; } }
  /* [TG-MENTION] 2026-10-02 @人(用户报"TG 无法@人"):Telegram 选中成员后在输入框插一个提及节点(不可编辑的头像卡 + 名字,发出去带提及实体,对方才收到 @ 通知)。
     原来:①成员列表开着时按回车(=选人)被我方当"发送"拦下去翻译 → 选不上人;②读输入框把头像 alt + 名字当正文 → 名字被翻译、中文名触发"中文不发出";
     ③发送时整框替换成纯文字译文 → 提及节点被删,对方收不到 @。
     现在:建议列表(成员/表情/命令,.rich-editor-tooltips-host.is-suggestion)开着时回车交给 Telegram;读输入框时提及节点不算正文(当一个空格);
     有提及时只翻译提及之间的文字段,逐段原地替换,提及节点原样保留。快捷回复整框写入(_tgSetInput)不变。 */
  function _tgIsMention(n){ try{ return n.nodeType===1 && !!n.querySelector && !!n.querySelector(':scope > [contenteditable="false"] [data-peer-id]'); }catch(e){ return false; } }
  function _tgHasMention(){ try{ var el=_tgInput(); return !!(el && el.querySelector('[contenteditable="false"] [data-peer-id]')); }catch(e){ return false; } }
  /* 建议列表(成员/表情/命令…)是否开着且有可选项 —— 回车此时是"选中"。以编辑器自己的建议状态为准(Telegram 富文本编辑器每种建议一个插件状态,
     键名 rich…Suggestion$,active=正在建议):选完人状态立刻变 false,列表还在淡出也不会误判(原来只看列表高度,淡出期间的回车被当"选中"放过 → 原文直接发出)。
     还要列表里真有可选项:@ 了个不存在的名字时 active 但列表空,回车是发送,要走翻译。拿不到编辑器状态(旧版网页)才退回看列表。 */
  function _tgSuggestItems(){ try{ var hs=document.querySelectorAll('.rich-editor-tooltips-host.is-suggestion'); for(var i=0;i<hs.length;i++){ if(hs[i].getBoundingClientRect().height>0 && hs[i].querySelector('[role="button"]')) return true; } }catch(e){} return false; }
  function _tgSuggestOpen(){ try{ var el=_tgInput(), st=el&&el.editor&&el.editor.state;
      if(st){ var on=false; Object.keys(st).forEach(function(k){ if(/Suggestion\$$/.test(k) && st[k] && st[k].active===true) on=true; }); return on && _tgSuggestItems(); }
    }catch(e){} return _tgSuggestItems(); }
  // 输入框里被提及/换行隔开的文字段(文档顺序,只留有字的段):{nodes:[文本节点/emoji 图], text}
  function _tgRuns(){ var runs=[], cur=null, el=_tgInput(); if(!el) return runs;
    var add=function(n,t){ if(!cur){ cur={nodes:[],text:''}; runs.push(cur); } cur.nodes.push(n); cur.text+=t; };
    var walk=function(n){ if(n.nodeType===3){ add(n,n.data); return; } if(n.nodeType!==1) return;
      if(_tgIsMention(n)){ cur=null; return; } var t=n.tagName; if(t==='BR'){ cur=null; return; } if(t==='IMG'){ add(n,n.getAttribute('alt')||''); return; }
      for(var i=0;i<n.childNodes.length;i++) walk(n.childNodes[i]); if(t==='P'||t==='DIV') cur=null; };
    for(var i=0;i<el.childNodes.length;i++) walk(el.childNodes[i]);
    return runs.filter(function(r){ return _norm(r.text); }); }
  // 一段文字的选区:从第一个非空白字符起、到段末(含段尾空白),两端都落在文字节点内部 → 插入的译文留在这段里,不会粘进相邻的提及节点。
  // 段首空白不动;段尾空白随译文一起写回(只选到最后一个字的话,浏览器会把紧挨提及的那个空格当多余空白删掉,译文和下一个名字粘在一起)
  function _tgRunRange(r){ var rg=document.createRange(), ns=r.nodes, i, n, k, s=false, last=ns[ns.length-1];
    for(i=0;i<ns.length&&!s;i++){ n=ns[i]; if(n.nodeType===3){ k=n.data.search(/\S/); if(k>=0){ rg.setStart(n,k); s=true; } } else { rg.setStartBefore(n); s=true; } }
    if(last.nodeType===3) rg.setEnd(last,last.data.length); else rg.setEndAfter(last);
    return s ? rg : null; }
  // 按段写回:第 i 段换成 outs[i],从后往前、每次重新取段(编辑器写完会重画节点),提及节点不动。全部写对才返回 true
  function _tgWriteRuns(outs){ try{ var el=_tgInput(); if(!el) return false; el.focus();
    outs=outs.map(function(o){ return String(o==null?'':o).replace(/\s*\n\s*/g,' '); });   // 一段本来就是一行:译文里的换行会多拆出一段,段数对不上就核对失败、也写不回原文
    if(_tgRuns().length!==outs.length) return false;
    for(var i=outs.length-1;i>=0;i--){ var r=_tgRuns()[i]; if(!r) return false; var rg=_tgRunRange(r); if(!rg) return false;
      var sel=window.getSelection(); sel.removeAllRanges(); sel.addRange(rg);
      document.execCommand('insertText', false, String(outs[i])+((r.text.match(/\s*$/)||[''])[0].replace(/\u00a0/g,' '))); }
    try{ var sel2=window.getSelection(), end=document.createRange(); end.selectNodeContents(el); end.collapse(false); sel2.removeAllRanges(); sel2.addRange(end); }catch(_c){}   // 光标放回末尾(从后往前写完光标停在第一段后面,接着打字会插到中间)
    var now=_tgRuns(); if(now.length!==outs.length) return false;
    for(var j=0;j<outs.length;j++){ if(_sig(now[j].text)!==_sig(outs[j])) return false; }
    return true; }catch(e){ return false; } }
  /* 有提及时各段的译文(发送、Ctrl+T、预览共用):已是目标语言的段原样;有缓存同步给;否则联网翻。失败的段为 '' */
  function _tgRunsSrc(){ return _tgRuns().map(function(r){ return _norm(r.text); }); }
  function _tgRunsHits(srcs, to){ return srcs.map(function(t){ return _sendAsIs(t) ? t : _syncTr(t, to); }); }
  function _tgRunsTranslate(srcs, to){ var hits=_tgRunsHits(srcs, to); return Promise.all(srcs.map(function(t,i){ return hits[i]!==null ? hits[i] : translateML(t, to).then(null, function(){ return ''; }); })); }
  function _tgRunsGood(outs){ for(var i=0;i<outs.length;i++){ if(!outs[i] || !_safeToSend(outs[i])) return false; } return true; }
  /* 把译文写进各段:写前输入框变了 → 'changed'(不覆盖业务员新打的字);译文不合格/写入核对失败 → 写回原文段,'fail';成功 'ok' */
  function _tgRunsApply(srcs, outs, before){ if(_tgInputText()!==before) return 'changed'; if(!_tgRunsGood(outs)) return 'fail'; if(!_tgWriteRuns(outs)){ _tgWriteRuns(srcs); return 'fail'; } return 'ok'; }
  /* ⚠️TG发送铁律(2026-08-27三轮实证,别再走弯路):
     ①原生发送按钮已死(空壳零代码时真点也不发=海王preload/Telegram自身问题,非我方)
     ②合成回车被 Telegram 校验 isTrusted 拒收 ③b.click()同理无效
     ④window.utils.sendTextMsg 是假成功(内部依赖 window.curActions,现为 undefined,静默失败)
     → 唯一能发的通道 = 用户真实按下的回车:在 keydown 捕获里【同步】把输入框换成缓存译文,然后放行该真实事件 */
  // 同步查缓存译文(预览打字时已翻好):整段(按行)全命中才返回,否则null。镜像translateML的分行逻辑
  function _syncTr(text, tl){ try{
    text=_norm(text); if(!text) return null;
    var route=_route();   /* [TR-FIX-1002B] 与 translate 同一个 _ckey */
    if(text.indexOf('\n')===-1){ var v=_cache[_ckey(route,tl,text)]; return (v&&v.replace(/\s/g,''))?v:null; }
    var lines=text.split('\n'), out=[];
    for(var i=0;i<lines.length;i++){ var t=_norm(lines[i]); if(!t){ out.push(''); continue; } var v2=_cache[_ckey(route,tl,t)]; if(!(v2&&v2.replace(/\s/g,''))) return null; out.push(v2); }
    return out.join('\n');
  }catch(e){ return null; } }
  // 隐藏海王发送预览UI
  function _hideTgSendUI(){ try{ ['.real-time-tranlate-text','.real-time-translate-text','.real-time-translate','[class*="real-time-tranlate"]'].forEach(function(s){ var els=document.querySelectorAll(s); for(var i=0;i<els.length;i++){ if(!els[i].closest('.scrm-tg-pv')) els[i].style.display='none'; } }); }catch(e){} }
  // 找输入框的白色圆角容器(composer 盒子)
  function _tgBox(){ try{ var input=_tgInput(); if(!input) return null; var el=input, hop=0;
    while(el && hop<10){ try{ var cs=getComputedStyle(el); var bg=cs.backgroundColor||''; if((parseFloat(cs.borderRadius)||0)>=10 && bg && bg.indexOf('rgba(0, 0, 0, 0)')<0 && bg!=='transparent'){ return el; } }catch(e){} el=el.parentElement; hop++; }
    return input.parentElement;
  }catch(e){ return null; } }
  // 我方译文预览(融进 composer 盒子顶部,绿色左边框,照 WA/Zalo)
  // txt: null=隐藏; ''=常驻显示占位"…"; 其它=显示译文
  /* [TG-PV-FOOTER] 2026-10-02 Telegram 新版输入区浮在消息上面,消息列表底部留白 = 底部区 .middle-column-footer 的实际高度(Telegram 用 ResizeObserver 量它)。
     预览框原来塞在输入框盒子(高度被 Telegram 锁住)里,只会向上溢出、底部区不变高 → 最后几条消息被挡。
     现在主输入框时把预览放进 .middle-column-footer 本身(输入框正上方,占一整行):底部区真的变高,Telegram 自己就把消息往上让。
     发图说明弹窗(不在底部区)仍放在输入框盒子里。 */
  function _tgFooter(){ try{ var inp=_tgInput(); return inp && inp.closest ? inp.closest('.middle-column-footer') : null; }catch(e){ return null; } }
  var _backTr=_backTrCore({ backCls:'scrm-tg-pv-back', on:function(){ return !!_cfg().backTranslate; }, sendLang:sendTo, backLang:recvTo, translate:function(t,bl){ return translateML(t,bl); } });   /* [BACK-TR] 回译校对:下面写预览正文的地方调 _backTr.update(正文元素, 译文),行为全在上面的 [BACK-TR-CORE] */
  function _tgPreview(txt, isTr){ try{   /* isTr:这次写的是真译文(回译只认它) */
    var foot=_tgFooter(); var box=foot||_tgBox(); var host=window.__scrmTgPv;
    if(txt===null||txt===undefined||!box){ if(host){ host.classList.remove('scrm-pv-on'); } return; }
    try{ if(getComputedStyle(box).display.indexOf('flex')>=0) box.style.flexWrap='wrap'; }catch(e){}
    if(!host||host.parentNode!==box){
      if(host&&host.parentNode) try{host.parentNode.removeChild(host);}catch(e){}
      host=document.createElement('div'); host.className='scrm-tg-pv'; window.__scrmTgPv=host;
      box.insertBefore(host, box.firstChild);
    }
    if(!host.firstChild){ host.style.cssText='flex:0 0 100%;order:-1;box-sizing:border-box;'; host.innerHTML='<div class="scrm-tg-pv-lbl"></div><div class="scrm-tg-pv-body"></div>'; }
    host.classList.toggle('scrm-tg-pv-card', !!foot); // 在底部区里是独立的一张卡片:[TG-PV-FUSE] 顶部圆角+无底边,贴在输入框药丸(.Composer)上,药丸上两角由 ~ 选择器抹平(只在卡片显示 .scrm-pv-on 时;隐藏时药丸恢复圆角;对齐 WA);在输入框盒子里沿用盒子背景
    host.classList.add('scrm-pv-on');
    /* 标签/正文只在变了才写(原来每次 innerHTML 整块重建,空输入时 350ms 轮询 = 每 350ms 销毁重建一次卡片节点) */
    var _lbl=host.firstChild, _bd=host.querySelector('.scrm-tg-pv-body'), _wl=_trRouteName(_cfg())+'实时翻译', _wb=(txt===''?'…':txt);
    if(_lbl.textContent!==_wl) _lbl.textContent=_wl;
    if(_bd.textContent!==_wb) _bd.textContent=_wb; _backTr.update(_bd, isTr?txt:'');
  }catch(e){} }
  function _injSendStyle(){ if(document.getElementById('__scrmTgSendStyle')||!document.head) return;
    var st=document.createElement('style'); st.id='__scrmTgSendStyle';
    st.textContent=_pvCoreCss('scrm-tg-pv',{gate:true,margin:'6px 0 4px',maxHeight:'34vh',mode:'fuse',variant:'.scrm-tg-pv-card',fuse:'~ .Composer',dark:'html.theme-dark'});   /* [TG-PV-FUSE] 在底部区(.scrm-tg-pv-card)才贴在药丸 .Composer 上;显隐 .scrm-pv-on */
    document.head.appendChild(st);
  }
  /* [TG-PV-KEY] 2026-10-02 预览按「目标语言+线路+原文」判断要不要重翻(原来只看原文 → 输入不动、只换目标语言,预览一直停在旧语言)。
     [TR-FIX-1002B] _pvCtx = 预览当前显示内容所属的「语言|线路」('=' 表示原样发送提示):语言或线路一变 → 立即回占位「…」;
     只是原文变了 → 保留上一次译文直到新结果到达(不每打一个字闪「…」);结果回来时键已变就丢掉。回车/发送一律按当前原文+语言+线路取译文(_syncTr),不用预览上的旧译文。
     翻译失败(或译文过不了 _safeToSend)→ 显示「翻译失败」,同一个键隔 2 秒由轮询自动重试(原来失败就一直挂着上一句的译文,去重键又挡住重试)。
     关预览/关发送翻译/没输入框时清掉去重键 → 再打开时立即恢复预览(原来键没变直接 return,预览一直不出来)。 */
  var _pvTimer=null, _lastPvKey='', _pvFailKey='', _pvFailAt=0, _pvCtx='';
  function _pvShow(ctx, r){ _pvCtx=ctx; if(r && _safeToSend(r)) _tgPreview(r, true); else { _pvFailKey=_lastPvKey; _pvFailAt=Date.now(); _tgPreview('翻译失败'); } }
  function _onType(){ try{
    _injSendStyle(); _hideTgSendUI();
    if(!previewEnabled()||!sendEnabled()){ _tgPreview(null); _lastPvKey=''; _pvCtx=''; return; }   // 关预览→隐藏
    if(!_tgInput()){ _tgPreview(null); _lastPvKey=''; _pvCtx=''; return; }                          // 没输入框(没进会话)→隐藏
    var src=_tgInputText();
    if(!src){ _tgPreview(''); _lastPvKey=''; _pvCtx=''; return; }    // 空→常驻显示占位"…"
    var to=sendTo(), ctx=to+'|'+_route(), key=ctx+'|'+src;
    if(key===_lastPvKey && (key!==_pvFailKey || Date.now()-_pvFailAt<2000)) return;
    _lastPvKey=key; _pvFailKey='';
    if(_pvTimer) clearTimeout(_pvTimer);
    if(_sendAsIs(src)){ _pvCtx='='; _tgPreview(src+'  (已是目标语言,原样发送)'); return; }
    if(_tgHasMention()){   // [TG-MENTION] 有提及:和发送一样逐段翻(发送时各段直接命中缓存,一次回车就发),预览显示各段译文
      var rs=_tgRunsSrc(), rh=_tgRunsHits(rs, to), join=function(o){ return _tgRunsGood(o) ? o.join(' ') : ''; };
      if(rh.every(function(h){ return h!==null; })){ _pvShow(ctx, join(rh)); return; }
      if(_pvCtx!==ctx){ _pvCtx=''; _tgPreview(''); }
      _pvTimer=setTimeout(function(){ _tgRunsTranslate(rs, to).then(function(o){ if(_lastPvKey===key && _tgInputText()===src) _pvShow(ctx, join(o)); }); }, 250);
      return;
    }
    var hit=_syncTr(src,to); if(hit!==null){ _pvShow(ctx,hit); return; }   // 缓存命中:同步显示,与回车实际写入的是同一条
    if(_pvCtx!==ctx){ _pvCtx=''; _tgPreview(''); }
    _pvTimer=setTimeout(function(){ translateML(src, to).then(function(r){ if(_lastPvKey===key && _tgInputText()===src) _pvShow(ctx,r); }); }, 250);
  }catch(e){} }
  ['focusin','keydown'].forEach(function(t){ document.addEventListener(t, function(ev){ try{ var el=_tgInput(); if(el && (ev.target===el || (el.contains&&el.contains(ev.target)))) _trWarm(); }catch(e){} }, true); });   // [TG-TR-KEEPALIVE] 准备打字就先把连接建好
  document.addEventListener('input', function(ev){ try{ var el=_tgInput(); if(el && (ev.target===el || (el.contains&&el.contains(ev.target)))) _onType(); }catch(e){} }, true);
  setInterval(_onType, 350);   // 轮询兜底(ProseMirror 有时不触发 input 事件)
  // 回车发送:发译文(预览开)
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
  _scrmQuickInstall({ box: _tgInput, read: function(){ return _tgInputText(); }, write: function(el, t){ return _tgSetInput(t); }, send: function(){}, key: function(on){ window.__scrmTgEnter = on ? 1 : 0; }, attach: function(file){ var m=function(){ var e=document.getElementById('editable-message-text-modal'); return e&&e.offsetParent!==null?{cap:e}:null; }; return (function(el, file, ready){ if(!el) return Promise.resolve(null); el.focus(); var dt=new DataTransfer(); dt.items.add(file); el.dispatchEvent(new ClipboardEvent('paste',{clipboardData:dt,bubbles:true,cancelable:true})); var t0=Date.now(); return (function w(){ var r=ready(); if(r) return Promise.resolve(r); if(Date.now()-t0>8000) return Promise.resolve(null); return new Promise(function(x){ setTimeout(x,200); }).then(w); })(); })(document.getElementById('editable-message-text'), file, m); }, pending: function(){ var e=document.getElementById('editable-message-text-modal'); if(e&&e.offsetParent!==null) return true; return !!document.querySelector('.Modal.closing, .Modal.shown.not-open'); /* 发出后附件弹窗还在淡出(closing)时仍吃掉回车:淡完才算待发区清空,否则连发时下一条的回车被它吞掉 */ }, settled: function(){ var own=document.querySelectorAll('.Message.own'); if(own.length<=(window.__scrmQkOwn||0)) return false; return !document.querySelector('.Message.own .MessageOutgoingStatus .Transition_slide-active .icon-message-pending'); }, mark: function(){ window.__scrmQkOwn=document.querySelectorAll('.Message.own').length; }, tr: function(t){ return translateML(t, sendTo()); }, to: function(){ return sendTo(); } }); // [QUICK-SEND] 本平台绑定
  /* [TR-FIX-1002B] 回车与发送按钮共用的唯一发送出口(原来两份几乎一样的代码)。TG 机制不变:只有用户真实的回车/点击能发 → 能发时同步把输入框换成译文再放行这次真实事件。
     A2:翻译进行中(_tgBusy)再按回车/点发送 → 先 preventDefault+stopImmediatePropagation 拦下,再说别的,事件绝不放给 Telegram。
     A3:翻译失败(空/出错/过不了 _safeToSend)→ 不往输入框写任何东西、不设「已就绪」,提示「翻译失败,请重试」。原来失败时把原文当译文填回并标就绪,下一次回车就把中文发出去了。
     写入后核对:输入框内容签名 ≠ 译文签名 → 拦下不发。 */
  var _tgBusy=0;
  function _block(ev){ try{ ev.preventDefault(); ev.stopPropagation(); ev.stopImmediatePropagation(); }catch(e){} }
  function _writeChecked(text){ _tgSetInput(text); return _sig(_tgInputText())===_sig(text); }
  /* [TG-MENTION] 有提及时的发送:各段缓存都命中 → 同步逐段换成译文、放行这次真实回车;否则拦下 → 逐段翻译 → 写入核对 → 标就绪 → 提示再按一次。规则与 _sendGate 相同(_safeToSend、写后核对、失败写回原文段)。 */
  function _tgMentionSend(ev, againMsg){
    var to=sendTo(), srcs=_tgRunsSrc(); if(!srcs.length) return;   // 只有提及、没有文字:原样发
    var hits=_tgRunsHits(srcs, to), before=_tgInputText();
    if(hits.every(function(h){ return h!==null; })){   // 各段都有缓存:同步写入后放行这次真实回车
      if(_tgRunsApply(srcs, hits, before)!=='ok'){ _block(ev); showZhWarn(_TR_FAIL); return; }
      _tgPreview(''); _lastPvKey=''; return;
    }
    _block(ev); _tgBusy=1;
    _tgRunsTranslate(srcs, to).then(function(outs){ _tgBusy=0;
      var r=_tgRunsApply(srcs, outs, before); if(r==='changed') return;   // 翻译期间改了输入框:不覆盖
      if(r!=='ok'){ showZhWarn(_TR_FAIL); return; }
      window.__scrmTgReady=_norm(_tgInputText()); _tgPreview(''); _lastPvKey='';
      showZhWarn(againMsg);
    }, function(){ _tgBusy=0; showZhWarn(_TR_FAIL); });
  }
  function _sendGate(ev, againMsg){
    if(_tgBusy){ _block(ev); return; }
    if(!sendEnabled()) return;
    var src=_tgInputText(); if(!src) return;
    // 中文检测:目标非中文却含中文→拦截
    if(detectOn() && !_tgtIsZh() && /[一-鿿]/.test(src)){ _block(ev); showZhWarn('检测到中文,已阻止发送'); return; }
    if(_sendAsIs(src)) return;   // 已是目标语言:原样发,放行
    // ⚠️2026-08-27实证:合成回车被isTrusted拒/b.click按钮死/sendTextMsg假成功(curActions空)。
    // 唯一能发的=用户这次【真实】回车/点击 → 同步换译文后放行它。别再改回合成事件/API/按钮
    if(window.__scrmTgReady && _norm(src)===window.__scrmTgReady){ window.__scrmTgReady=null; if(!_safeToSend(src)){ _block(ev); showZhWarn(_TR_FAIL); return; } _tgPreview(''); _lastPvKey=''; return; }
    if(_tgHasMention()){ _tgMentionSend(ev, againMsg); return; }   // [TG-MENTION] 只翻提及之间的文字,提及保留
    var to=sendTo(), hit=_syncTr(src, to);
    if(hit!==null){
      if(!_safeToSend(hit)){ _block(ev); showZhWarn(_TR_FAIL); return; }
      if(!_writeChecked(hit)){ _block(ev); _tgSetInput(src); showZhWarn(_TR_FAIL); return; }
      _tgPreview(''); _lastPvKey=''; return;   // 换完放行真实事件 → 发出译文
    }
    // 缓存未命中(预览还没翻完):拦下→翻译→成功才填入并标记就绪→提示再按一次
    _block(ev); _tgBusy=1;
    var fin=function(r){ _tgBusy=0;
      if(_tgInputText()!==src) return;   // 翻译期间业务员改了输入框:不覆盖
      if(!r || !_safeToSend(r)){ showZhWarn(_TR_FAIL); return; }
      if(!_writeChecked(r)){ _tgSetInput(src); showZhWarn(_TR_FAIL); return; }
      window.__scrmTgReady=_norm(_tgInputText()); _tgPreview(''); _lastPvKey='';
      showZhWarn(againMsg);
    };
    translateML(src, to).then(fin, function(){ fin(''); });
  }
  document.addEventListener('keydown', function(ev){ try{
    if(window.__scrmTgEnter) return;                       // 我方触发的回车,放行
    var el=_tgInput(); if(!el) return;
    var inInput = ev.target===el || (el.contains&&el.contains(ev.target));
    if(!inInput) return;
    // Ctrl+F 发原文,Ctrl+T 只翻不发
    if((ev.ctrlKey||ev.metaKey) && (ev.key==='f'||ev.key==='F')){ return; }  // 原文直接发,放行
    if((ev.ctrlKey||ev.metaKey) && (ev.key==='t'||ev.key==='T')){ ev.preventDefault(); ev.stopPropagation(); if(_tgHasMention()){ var rs=_tgRunsSrc(), b0=_tgInputText(); if(rs.length) _tgRunsTranslate(rs, sendTo()).then(function(outs){ var r=_tgRunsApply(rs, outs, b0); if(r==='ok') _tgPreview(''); else if(r==='fail') showZhWarn(_TR_FAIL); }); return; } var s=_tgInputText(); if(s) translateML(s,sendTo()).then(function(r){ if(r){ _tgSetInput(r); _tgPreview(''); } else showZhWarn(_TR_FAIL); }); return; }
    if(ev.key!=='Enter'||ev.shiftKey||ev.isComposing) return;
    if(_tgSuggestOpen()) return;   // [TG-MENTION] 成员/表情/命令列表开着:回车是"选中",交给 Telegram
    _sendGate(ev, '已翻译,再按一次回车发送');
  }catch(e){ } }, true);
  // 点发送按钮:与回车同一出口——同步换译文后【放行真实点击】。海王preload已禁用(它以前拦按钮才导致按钮死)
  document.addEventListener('click', function(ev){ try{
    var btn=ev.target && ev.target.closest && ev.target.closest('.Button.send,button.send,[aria-label="Send Message"],[aria-label="Send"],.send-message-button,.modal-dialog .Button.primary,.Modal .Button.primary'); /* [TG-CAPTION-SEND] 弹窗里的 Send 按钮 */
    if(!btn) return;
    _sendGate(ev, '已翻译,再点一次发送');
  }catch(e){ } }, true);
  function showZhWarn(msg){ try{ var d=document.createElement('div'); d.textContent=msg; d.style.cssText='position:fixed;bottom:80px;left:50%;transform:translateX(-50%);z-index:2147483647;background:rgba(220,38,38,.96);color:#fff;font-size:13px;padding:9px 16px;border-radius:8px;'; document.body.appendChild(d); setTimeout(function(){ try{d.remove();}catch(e){} },2600); }catch(e){} }
  setInterval(_hideTgSendUI, 700);

  // ================= 图片翻译(有道渲染回原图,hover【译】,照 LINE)=================
  ;(function(){
    var IMGAPI='https://chm123.com';
    function imgRecvTo(){ return (window.__scrmTrCfg||{}).receiveTargetLanguage || (window.__scrm_translate||{}).recvTo || 'zh-CN'; }
    function imgAutoOn(){ return (window.__scrmTrCfg||{}).imageTranslateOpen!==false; }  // 默认开
    var __cache={};
    function _style(){ if(document.getElementById('scrm-tgimg-style')||!document.head) return;
      var st=document.createElement('style'); st.id='scrm-tgimg-style';
      st.textContent='.scrm-tgimg-host{position:relative;} .scrm-tgimg-btn{position:absolute;top:6px;left:6px;z-index:30;background:rgba(0,0,0,.6);color:#fff;font-size:12px;font-weight:600;padding:4px 8px;border-radius:7px;cursor:pointer;display:none;user-select:none;} .scrm-tgimg-host:hover .scrm-tgimg-btn{display:inline-flex;} .scrm-tgimg-btn.done{display:inline-flex;background:rgba(26,127,55,.95);} '
        +'.scrm-tgimg-lb{position:fixed;inset:0;z-index:2147483600;background:rgba(0,0,0,.86);display:flex;align-items:center;justify-content:center;flex-direction:column;} .scrm-tgimg-lb img{max-width:92vw;max-height:82vh;object-fit:contain;} .scrm-tgimg-lb .b{margin-top:14px;background:rgba(255,255,255,.16);color:#fff;padding:8px 18px;border-radius:8px;cursor:pointer;} .scrm-tgimg-x{position:fixed;top:18px;right:26px;color:#fff;font-size:32px;cursor:pointer;z-index:2147483601;}';
      document.head.appendChild(st);
    }
    function _b64(img){ return new Promise(function(res){ try{
      var src=img.__scrmOrig||img.currentSrc||img.src||''; if(!src){res('');return;}
      if(src.indexOf('data:')===0){res(src);return;}
      fetch(src).then(function(r){return r.blob();}).then(function(b){ var fr=new FileReader(); fr.onload=function(){res(fr.result);}; fr.onerror=function(){res('');}; fr.readAsDataURL(b); }).catch(function(){
        try{ var c=document.createElement('canvas'); c.width=img.naturalWidth; c.height=img.naturalHeight; c.getContext('2d').drawImage(img,0,0); res(c.toDataURL('image/png')); }catch(e){res('');}
      });
    }catch(e){res('');} }); }
    function _cap(dataUrl,max){ return new Promise(function(res){ try{ var im=new Image(); im.onload=function(){ var w=im.naturalWidth,h=im.naturalHeight; if(Math.max(w,h)<=max){res(dataUrl);return;} var sc=max/Math.max(w,h); var c=document.createElement('canvas'); c.width=Math.round(w*sc); c.height=Math.round(h*sc); c.getContext('2d').drawImage(im,0,0,c.width,c.height); res(c.toDataURL('image/jpeg',0.92)); }; im.onerror=function(){res(dataUrl);}; im.src=dataUrl; }catch(e){res(dataUrl);} }); }
    // 本地渲染(中清·兜底):没 msgId 或桥失败时用聊天里那张图直接喂有道
    function _renderLocal(img){
      var key=imgRecvTo()+'|'+(img.currentSrc||img.src||'').slice(0,120); if(__cache[key]){ img.__renderSrc=__cache[key]; return Promise.resolve(img.__renderSrc); }
      return _b64(img).then(function(b64){ if(!b64){return '';} return _cap(b64,2200).then(function(capped){ return new Promise(function(res){
        try{
          var https=require('https'); var U=require('url').URL||require('url'); var u=new U(IMGAPI+'/api/image-translate-render');
          var body=JSON.stringify({image:capped,to:imgRecvTo()});
          var req=https.request({hostname:u.hostname,path:u.pathname,method:'POST',headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(body)},timeout:60000}, function(rr){ var d=''; try{rr.setEncoding('utf8');}catch(e){} rr.on('data',function(c){d+=c;}); rr.on('end',function(){ var url=''; try{var j=JSON.parse(d); if(j.code===0&&j.renderImage)url=j.renderImage;}catch(e){} if(url){img.__renderSrc=url;__cache[key]=url;} res(url); }); });
          req.on('error',function(){res('');}); req.on('timeout',function(){try{req.destroy();}catch(e){} res('');});
          req.write(body); req.end();
        }catch(e){ res(''); }
      }); }); });
    }
    // 全清渲染(对齐 LINE):从 msgId 走宿主桥→主世界读 tt-media 全清图→有道 render→回传 URL(串行,单槽)
    var __imgBusy=0, __imgBusyAt=0;
    function _imgMsgId(img){ try{ var m=img.closest&&img.closest('.Message'); return (m&&m.getAttribute('data-message-id'))||''; }catch(e){ return ''; } }
    function _render(img){
      if(img.__renderSrc) return Promise.resolve(img.__renderSrc);
      if(img.__renderP) return img.__renderP;
      var mid=_imgMsgId(img);
      if(!mid){ img.__renderP=_renderLocal(img); img.__renderP.then(function(){img.__renderP=null;}); return img.__renderP; }
      img.__renderP=new Promise(function(res){
        var start=Date.now();
        (function wait(){
          if(__imgBusy && (Date.now()-__imgBusyAt<70000)){ if(Date.now()-start>120000){ img.__renderP=null; res(''); return; } setTimeout(wait,400); return; }
          __imgBusy=1; __imgBusyAt=Date.now();
          var reqId='i'+Date.now()+'_'+Math.floor(Math.random()*100000);
          try{ document.body.removeAttribute('data-scrm-ires'); }catch(e){}
          try{ document.body.setAttribute('data-scrm-ireq', reqId+'|'+mid+'|'+(_activeCid()||'')+'|'+imgRecvTo()); }catch(e){}
          var waited=0;
          var iv=setInterval(function(){ try{ waited+=350;
            var r=document.body.getAttribute('data-scrm-ires')||'';
            if(r && r.indexOf(reqId+'|')===0){ clearInterval(iv); __imgBusy=0;
              try{ document.body.removeAttribute('data-scrm-ires'); document.body.removeAttribute('data-scrm-ireq'); }catch(e){}
              var obj={}; try{obj=JSON.parse(r.slice(reqId.length+1));}catch(e){}
              var url=(obj&&obj.render)||''; img.__renderP=null;
              if(url){ img.__renderSrc=url; var key=imgRecvTo()+'|'+(img.currentSrc||img.src||'').slice(0,120); __cache[key]=url; res(url); }
              else { _renderLocal(img).then(function(u2){ res(u2); }); }   // 桥失败→本地中清兜底
              return;
            }
            if(waited>60000){ clearInterval(iv); __imgBusy=0; try{document.body.removeAttribute('data-scrm-ireq');}catch(e){} img.__renderP=null; _renderLocal(img).then(function(u2){res(u2);}); }
          }catch(e){} }, 350);
        })();
      });
      return img.__renderP;
    }
    function _showRender(img,btn){ if(!img.__scrmOrig) img.__scrmOrig=img.currentSrc||img.src||''; if(img.__renderSrc){ try{img.removeAttribute('srcset');}catch(e){} if(img.src!==img.__renderSrc)img.src=img.__renderSrc; } img.__showR=true; try{img.style.cursor='zoom-in';}catch(e){} if(btn){btn.textContent='原图';btn.classList.add('done');} }
    function _showOrig(img,btn){ img.__showR=false; try{img.style.cursor='';}catch(e){} if(img.__scrmOrig&&img.src!==img.__scrmOrig)img.src=img.__scrmOrig; if(btn){btn.textContent='译';btn.classList.remove('done');} }
    function _lb(renderUrl,origUrl){ var lb=document.createElement('div');lb.className='scrm-tgimg-lb'; var x=document.createElement('div');x.className='scrm-tgimg-x';x.innerHTML='&times;'; var im=document.createElement('img');im.src=renderUrl; var tg=document.createElement('div');tg.className='b';tg.textContent='看原图';var sh='r'; tg.addEventListener('click',function(e){e.stopPropagation(); if(sh==='r'){im.src=origUrl;tg.textContent='看译文';sh='o';}else{im.src=renderUrl;tg.textContent='看原图';sh='r';}}); function close(){try{lb.remove();}catch(e){}try{x.remove();}catch(e){}} x.addEventListener('click',close);lb.addEventListener('click',function(e){if(e.target===lb)close();}); lb.appendChild(im);lb.appendChild(tg);document.body.appendChild(lb);document.body.appendChild(x); }
    function _onBtn(img,btn){ try{ if(img.__showR){_showOrig(img,btn);return;} if(img.__renderSrc){_showRender(img,btn);return;} btn.textContent='…';btn.classList.add('done'); _render(img).then(function(url){ if(url){_showRender(img,btn);}else{btn.textContent='译';btn.classList.remove('done');} }); }catch(e){} }
    function _scan(){ try{ _style(); var auto=imgAutoOn();
      var imgs=document.querySelectorAll('.Message .media-inner img, .Message .media-photo img, .Message img[src^="blob:"], .Message img[src^="http"]');
      for(var i=0;i<imgs.length;i++){ var img=imgs[i]; var w=img.naturalWidth||img.width, h=img.naturalHeight||img.height; if(w<64||h<64) continue;
        if(!img.__scrmTr){ img.__scrmTr=1;
          // 点击拦截改到文档级 capture(见下方 _imgGuard),避免 TG 用 pointerdown 抢先打开原生灯箱=原文
          var host=img.parentElement; if(host){ img.__host=host; try{if(getComputedStyle(host).position==='static')host.style.position='relative';}catch(e){} host.classList.add('scrm-tgimg-host');
            var btn=document.createElement('span'); btn.className='scrm-tgimg-btn'; btn.textContent='译'; (function(im,b){b.addEventListener('click',function(ev){ev.stopPropagation();ev.preventDefault();_onBtn(im,b);},true);})(img,btn); host.appendChild(btn);
          }
        }
        if(img.__showR&&img.__renderSrc&&img.src!==img.__renderSrc){ try{img.removeAttribute('srcset');}catch(e){} img.src=img.__renderSrc; }
      }
    }catch(e){} }
    // 文档级 capture 拦截:译图的 pointerdown/mousedown 直接拦(阻止 TG 原生灯箱=原文),click 开我们的灯箱(译图+看原图)
    function _renderedImgAt(t){ try{ var host=t&&t.closest&&t.closest('.scrm-tgimg-host'); if(!host) return null; var im=host.querySelector('img'); if(im&&im.__showR&&im.__renderSrc) return im; }catch(e){} return null; }
    ['pointerdown','mousedown','pointerup','mouseup','dblclick'].forEach(function(ty){
      document.addEventListener(ty, function(ev){ try{ if(ev.target&&ev.target.closest&&ev.target.closest('.scrm-tgimg-btn')) return; if(_renderedImgAt(ev.target)){ ev.stopPropagation(); ev.preventDefault(); } }catch(e){} }, true);
    });
    document.addEventListener('click', function(ev){ try{
      if(ev.target&&ev.target.closest&&ev.target.closest('.scrm-tgimg-btn')) return;   // 译/原图按钮放行
      var im=_renderedImgAt(ev.target); if(im){ ev.stopPropagation(); ev.preventDefault(); _lb(im.__renderSrc, im.__scrmOrig||im.src); }
    }catch(e){} }, true);
    setInterval(_scan,800); _scan();
  })();

  // ================= 语音翻译(海王 downloadMedia 拿音频→/api/audio-translate,Node https 绕 CSP,对齐 LINE 原/译 UI)=================
  ;(function(){
    var API='https://chm123.com';
    var _RF='<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>';
    var __vcache={}, __vbusy=0, __vbusyAt=0;
    function _vesc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
    function _vAutoOn(){ return false; }   // TG 语音:不自动翻,常驻「点击翻译」按钮,手动点才翻(用户要求)
    function _vInView(el){ try{ var r=el.getBoundingClientRect(); var vh=window.innerHeight||document.documentElement.clientHeight; return r.bottom>0 && r.top<vh && (r.width>0||r.height>0); }catch(e){ return false; } }
    function _vinject(){ if(document.getElementById('scrm-tvo-style')||!document.head) return;
      var st=document.createElement('style'); st.id='scrm-tvo-style';
      st.textContent=''
        +'.scrm-tvo{width:100%;box-sizing:border-box;margin-top:7px;padding:7px 12px 3px 12px;border-top:1px dashed #1a7f37;font-size:13px;line-height:1.5;white-space:pre-wrap;word-break:break-word;color:#1a7f37;} '
        +'.scrm-tvo .og{color:#1a7f37;} .scrm-tvo .tr{margin-top:4px;color:#1a7f37;font-weight:500;} .scrm-tvo .lbl{margin-right:2px;} '
        +'.scrm-tvo-rf{cursor:pointer;color:#8a96a3;margin-left:6px;display:inline-flex;vertical-align:middle;} .scrm-tvo-rf:hover{color:#1a7f37;} '
        +'.scrm-tvo-btn{display:block;width:100%;box-sizing:border-box;margin-top:9px;padding:9px 14px;text-align:center;background:#0a7cff;color:#fff;font-size:14px;font-weight:600;line-height:1.2;border-radius:10px;cursor:pointer;user-select:none;} .scrm-tvo-btn:hover{opacity:.92;} .scrm-tvo-btn.on{opacity:.6;} .scrm-tvo-sep{border-top:1px dashed #1a7f37;margin-top:8px;padding-top:1px;}';
      document.head.appendChild(st);
    }
    // TG 语音气泡 = .Message 里含 .voice-duration 的 .Audio(排除音乐/文件)
    function _vwraps(){ var out=[]; try{
      var auds=document.querySelectorAll('.Message .Audio');
      for(var i=0;i<auds.length;i++){ if(auds[i].querySelector('.voice-duration')) out.push(auds[i]); }
    }catch(e){} return out; }
    function _vid(wrap){ try{ var e=wrap.closest('[data-message-id]'); return (e&&e.getAttribute('data-message-id'))||''; }catch(e){ return ''; } }
    function _vmount(wrap){ var host=wrap.__tvoHost;
      if(!host||!host.parentNode){
        host=document.createElement('div'); host.style.cssText='width:100%;box-sizing:border-box;'; host.__wrap=wrap;
        var box=wrap.closest('.message-content')||wrap.parentElement||wrap;   // 挂到气泡内容底部,波形下方
        box.appendChild(host); wrap.__tvoHost=host;
      }
      return host;
    }
    function _vshowBtn(wrap){ var host=_vmount(wrap); if(!host) return; _keepBottom(host); host.innerHTML='<div class="scrm-tvo-sep"></div><div class="scrm-tvo-btn">点击翻译</div>'; }
    function _vshowBox(wrap,data){ var host=_vmount(wrap); if(!host) return;
      var html='<div class="scrm-tvo">';
      if(data.transcript) html+='<div class="og"><span class="lbl">原：</span>'+_vesc(data.transcript)+'</div>';
      html+='<div class="tr"><span class="lbl">译：</span>'+_vesc(data.translation||'(无)')+'<span class="scrm-tvo-rf" title="重新翻译">'+_RF+'</span></div></div>';
      _keepBottom(host); host.innerHTML=html;
    }
    function _vdbg(s){ /* 生产:no-op(调试期改成 appendFileSync('/tmp/scrm-tg-voice2.txt',...)) */ }
    function _vOn(){ return _cfg().audioTranslateOpen!==false; }   // 「语音翻译开启」开关(默认开=显示按钮)
    // 拿音频:适配器在隔离世界够不到主世界的 curActions/webpack(现版 TG 也不往 window 暴露)。
    // → DOM 属性桥:适配器写 body[data-scrm-vreq]=reqId|msgId|cid|to;宿主(app-main.html)400ms 轮询里
    //   用 <webview>.executeJavaScript 进 guest 主世界跑海王式 downloadMedia 拿 base64→同源 POST /api/audio-translate
    //   →回写 body[data-scrm-vres]=reqId|{transcript,translation};适配器轮询读回渲染。
    function _vreqTranslate(id, wrap){
      var reqId='v'+Date.now()+'_'+Math.floor(Math.random()*100000);
      try{ document.body.removeAttribute('data-scrm-vres'); }catch(e){}
      try{ document.body.setAttribute('data-scrm-vreq', reqId+'|'+id+'|'+(_activeCid()||'')+'|'+recvTo()); }catch(e){}
      _vdbg('VREQ set '+reqId+' id='+id+' cid='+(_activeCid()||'')+' to='+recvTo());
      var waited=0, seen=0;
      var iv=setInterval(function(){ try{
        waited+=350;
        var res=document.body.getAttribute('data-scrm-vres')||'';
        if(res&&!seen){ seen=1; _vdbg('VRES got(prefix='+(res.indexOf(reqId+'|')===0)+') '+res.slice(0,80)); }
        if(res && res.indexOf(reqId+'|')===0){
          clearInterval(iv); __vbusy=0;
          try{ document.body.removeAttribute('data-scrm-vres'); document.body.removeAttribute('data-scrm-vreq'); }catch(e){}
          var obj={}; try{ obj=JSON.parse(res.slice(reqId.length+1)); }catch(e){}
          if(obj && !obj.err && (obj.transcript||obj.translation)){ var dd={transcript:obj.transcript||'',translation:obj.translation||''}; if(id)__vcache[id]=dd; _vshowBox(wrap,dd); }
          else { _vdbg('vdl err '+((obj&&obj.err)||'empty')); _vshowBox(wrap,{translation:'未能获取音频,请重试'}); }
          return;
        }
        if(waited>60000){ clearInterval(iv); __vbusy=0; try{document.body.removeAttribute('data-scrm-vreq');}catch(e){} _vshowBox(wrap,{translation:'翻译超时,请重试'}); }
      }catch(e){} }, 350);
    }
    function _vtranslate(wrap){ try{
      var id=_vid(wrap);
      if(id&&__vcache[id]){ _vshowBox(wrap,__vcache[id]); return; }
      if(!id){ _vshowBox(wrap,{translation:'未能获取音频,请重试'}); return; }
      if(__vbusy) return; __vbusy=1; __vbusyAt=Date.now();
      var host=_vmount(wrap); if(host) host.innerHTML='<div class="scrm-tvo-btn on">翻译中...</div>';
      _vreqTranslate(id, wrap);   // 走宿主 DOM 桥拿音频+翻译
    }catch(e){ __vbusy=0; } }
    document.addEventListener('click', function(ev){
      var t=ev.target; var btn=t.closest&&t.closest('.scrm-tvo-btn'); var rf=t.closest&&t.closest('.scrm-tvo-rf');
      if(btn && !btn.classList.contains('on')){ ev.stopPropagation(); ev.preventDefault(); var host=btn.parentElement; if(host&&host.__wrap) _vtranslate(host.__wrap); return; }
      if(rf){ ev.stopPropagation(); ev.preventDefault(); var h2=rf.closest('.scrm-tvo')&&rf.closest('.scrm-tvo').parentElement; if(h2&&h2.__wrap){ var id2=_vid(h2.__wrap); if(id2) delete __vcache[id2]; _vtranslate(h2.__wrap); } return; }
    }, true);
    function _vscan(){ try{
      if(!_vOn()) return;   // 「语音翻译开启」关→不显示按钮/译框
      _vinject();
      var wraps=_vwraps();
      for(var i=0;i<wraps.length;i++){ var wrap=wraps[i];
        var host=_vmount(wrap); if(!host) continue;
        var id=_vid(wrap);
        if(id&&__vcache[id]){ if(!host.querySelector('.scrm-tvo')) _vshowBox(wrap,__vcache[id]); }
        else if(!host.querySelector('.scrm-tvo-btn')&&!host.querySelector('.scrm-tvo')&&!__vbusy){ _vshowBtn(wrap); }
        // TG 语音:常驻「点击翻译」按钮,手动点才翻(不自动翻,用户要求)
      }
    }catch(e){} }
    setInterval(_vscan,800); _vscan();
    setInterval(function(){ if(__vbusy && __vbusyAt && (Date.now()-__vbusyAt>70000)){ __vbusy=0; } },5000);
  })();
})();

/* [REPEAT-BADGE] 2026-09-16 工单重复粉丝标记(对齐海王):面板每分钟把本账号"重复线索"联系人推到 window.__scrmRepeat={联系人id:{at,by,src}};这里每 1.5s 扫聊天列表行,命中的行在头像左上角贴红色"重"点(样式内联,不用动态 <style>),悬停显示上次添加时间/主号/来源 */
;(function(){try{
  if (window.__scrmRepeatBadgeOn) return; window.__scrmRepeatBadgeOn = 1;
  var BADGE_CSS = 'position:absolute;left:2px;top:2px;width:16px;height:16px;border-radius:50%;background:#f54a44;color:#fff;font-size:10px;font-weight:700;line-height:16px;text-align:center;z-index:9;cursor:default;box-shadow:0 0 0 2px #fff;pointer-events:auto;';
  function fmt(t){ try{ if (!t) return ''; var d = new Date(t); if (isNaN(d)) return String(t); function p(n){ return (n < 10 ? '0' : '') + n; } return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes()); }catch(e){ return ''; } }
  function rows(){ return document.querySelectorAll('.chat-list .ListItem.Chat.private, .chat-list .ListItem.private'); }
  function keyOf(row){ try{ var a = row.querySelector('a[href^="#"]'); var id = a ? String(a.getAttribute('href') || '').replace(/^#/, '') : (row.getAttribute('data-peer-id') || ''); return /^\d+$/.test(id) ? id : ''; }catch(e){} return ''; }
  function host(row){ try{ var h = row.querySelector('.Avatar'); return h || row; }catch(e){ return row; } }
  function tick(){ try{
    var map = window.__scrmRepeat; var on = !!map;
    var rs = rows();
    for (var i = 0; i < rs.length; i++) { var row = rs[i]; var h = host(row); var old = h.querySelector('.scrm-repeat-badge') || row.querySelector('.scrm-repeat-badge');
      if (!on) { if (old) old.remove(); continue; }
      var k = keyOf(row); var hit = k && map[k];
      if (hit) { if (!old) { var b = document.createElement('div'); b.className = 'scrm-repeat-badge'; b.style.cssText = BADGE_CSS; b.textContent = '重'; if (getComputedStyle(h).position === 'static') h.style.position = 'relative'; h.appendChild(b); old = b; }
        var tip = '工单重复粉丝标记\n上次添加时间：' + fmt(hit.at) + '\n上次添加主号：' + (hit.by || '') + (hit.src ? '\n来源：' + hit.src : ''); if (old.title !== tip) old.title = tip; }
      else if (old) old.remove(); }
  }catch(e){} }
  setInterval(tick, 1500);
}catch(e){}})();

/* [CHAT-BACKUP] 2026-09-17 聊天记录上云(TG):每 30s 读 IndexedDB tt-data 的 tt-global-state.messages.byChatId,只取私聊(users.byId 里 userTypeRegular、非 bot、非 777000/自己),30 天内、每会话记水位 id 只取新的,收进 window.__scrmChatBuf;面板每 20s 取走上报。仅 __scrm_translate.chatBackup===true 时采集。 */
;(function(){try{
  if (window.__scrmTgChatBackup) return; window.__scrmTgChatBackup = 1;
  window.__scrmChatBuf = window.__scrmChatBuf || [];
  var wm = {}; // chatId -> max msg id 已收
  var seenKeys = {}; window.__scrmTgSeen = seenKeys; /* [CHAT-STORE] */
  var STORE_KEY = 'scrm_chat_pending_telegram', lastSig = '';
  function strip(m){ var o = {}; for (var k in m) { if (k !== 'media') o[k] = m[k]; } return o; }
  function persist(){ try { var b = window.__scrmChatBuf || []; var sig = b.length + '|' + (b.length ? b[b.length - 1].id : ''); if (sig === lastSig) return; lastSig = sig; localStorage.setItem(STORE_KEY, JSON.stringify(b.slice(-300).map(strip))); } catch(e){} }
  function restore(){ try { var raw = localStorage.getItem(STORE_KEY); if (!raw) return; var arr = JSON.parse(raw); if (!Array.isArray(arr)) return; arr.forEach(function(m){ if (m && m.id && m.account && !seenKeys[m.account + '|' + m.id]) { seenKeys[m.account + '|' + m.id] = 1; window.__scrmChatBuf.push(m); } }); } catch(e){} }
  restore(); setInterval(persist, 3000);
  function on(){ try { var c = window.__scrm_translate || window.__scrmTrCfg || {}; return c.chatBackup === true; } catch(e){ return false; } }
  function bodyOf(c){ try { if (!c) return ''; if (c.text && c.text.text) return String(c.text.text); if (c.photo) return '[图片]' ; if (c.video) return '[视频]'; if (c.voice) return '[语音]'; if (c.audio) return '[音频]'; if (c.document) return '[文件]'; if (c.sticker) return '[贴纸]'; if (c.location) return '[位置]'; if (c.contact) return '[名片]'; return ''; } catch(e){ return ''; } }
  function scan(){ try {
    if (!on()) return;
    var r = indexedDB.open('tt-data');
    r.onupgradeneeded = function(){ try{ r.transaction.abort(); }catch(e){} };
    r.onsuccess = function(){ try {
      var db = r.result; var st = db.objectStoreNames.contains('store') ? 'store' : (db.objectStoreNames.contains('globalState') ? 'globalState' : null); if (!st) { db.close(); return; }
      var q = db.transaction(st, 'readonly').objectStore(st).get('tt-global-state');
      q.onsuccess = function(){ try {
        var g = q.result; db.close(); if (!g || !g.messages || !g.users) return;
        var me = String(g.currentUserId || ''); var by = g.users.byId || {}; var byChat = g.messages.byChatId || {}; var minT = Date.now() / 1000 - 30 * 86400;
        var buf = window.__scrmChatBuf;
        Object.keys(byChat).forEach(function(cid){
          if (!/^\d+$/.test(cid) || cid === me || cid === '777000') return; var u = by[cid]; if (!u || (u.type && u.type !== 'userTypeRegular') || u.isSupport || u.isSelf) return;
          var ids = Object.keys((byChat[cid] || {}).byId || {}).map(Number).filter(function(x){ return x > (wm[cid] || 0); }).sort(function(a, b){ return a - b; }); if (!ids.length) return;
          var name = ((u.firstName || '') + ' ' + (u.lastName || '')).trim() || ((u.usernames && u.usernames[0] && u.usernames[0].username) || u.username || cid);
          var mx = wm[cid] || 0;
          ids.forEach(function(id){ var m = byChat[cid].byId[id]; if (!m) return; mx = Math.max(mx, id); var t = Number(m.date) || 0; if (t < minT) return; var body = bodyOf(m.content); if (!body) return;
            var item = { account: cid, name: name, headimg: '', id: String(id), from_me: m.isOutgoing ? 1 : 0, type: (m.content && m.content.text) ? 'chat' : (m.content && m.content.photo ? 'image' : m.content && m.content.voice ? 'audio' : m.content && m.content.video ? 'video' : 'media'), body: body.slice(0, 4000), t: t };
            try { var ri = m.replyInfo || {}; var rid = ri.replyToMsgId || m.replyToMessageId; if (rid && byChat[cid].byId[rid]) { var qb = bodyOf(byChat[cid].byId[rid].content); if (qb) item.quote = qb.slice(0, 500); } } catch(e){} /* [CHAT-MEDIA] 引用 */
            try { if (m.isEdited || (Number(m.editDate) || 0) > 0) item.edited = 1; } catch(e){}
            if (!(seenKeys[cid + '|' + id])) { seenKeys[cid + '|' + id] = 1; buf.push(item); } });
          wm[cid] = mx;
        });
        if (buf.length > 3000) buf.splice(0, buf.length - 3000);
      } catch(e){ try{ db.close(); }catch(_){} } };
      q.onerror = function(){ try{ db.close(); }catch(_){} };
    } catch(e){} };
    r.onerror = function(){};
  } catch(e){} }
  setTimeout(scan, 15000); setInterval(scan, 30000);
}catch(e){}})();

/* [TG-MEDIA-DL] 2026-09-18 TG 语音/原图/视频落盘(替代只能拿 DOM 缩略图的 CHAT-MEDIA-DOM):TG 网页版 Service Worker 有下载通道 /a/download/<hash>(照 CEO 钩内部 downloadMedia 的效果,但不用改主程序):
   photo<id>?size=y=原图 / document<id>=语音 ogg·视频 mp4。每 45s 扫本地状态:私聊、7 天内、主采集已记过的消息,按消息 id 下载→dataURI→推 __scrmChatBuf(服务端对已存在的行只补 media_url)。≤4MB、并发 2、5 分钟最多 20 个、done 集合落 localStorage 防重开重下。 */
;(function(){try{
  if (window.__scrmTgMediaDl) return; window.__scrmTgMediaDl = 1;
  function on(){ try { var c = window.__scrm_translate || {}, d = window.__scrmTrCfg || {}; return c.chatBackup === true || d.chatBackup === true; } catch(e){ return false; } }
  var DONE_KEY = 'scrm_tg_media_done', done = {};
  try { (JSON.parse(localStorage.getItem(DONE_KEY) || '[]') || []).forEach(function(k){ done[k] = 1; }); } catch(e){}
  function saveDone(){ try { var ks = Object.keys(done); if (ks.length > 600) { ks.slice(0, ks.length - 600).forEach(function(k){ delete done[k]; }); ks = Object.keys(done); } localStorage.setItem(DONE_KEY, JSON.stringify(ks)); } catch(e){} }
  var busy = 0, stamps = [];
  function allowed(){ var now = Date.now(); stamps = stamps.filter(function(x){ return now - x < 300000; }); return busy < 2 && stamps.length < 20; }
  function hashOf(c){ if (!c) return null; if (c.photo && c.photo.id) return { url: '/a/download/photo' + c.photo.id + '?size=y', kind: 'image', body: '[图片]', size: 0 }; if (c.voice && c.voice.id) return { url: '/a/download/document' + c.voice.id, kind: 'audio', body: '[语音]', size: Number(c.voice.size) || 0 }; if (c.video && c.video.id) return { url: '/a/download/document' + c.video.id, kind: 'video', body: '[视频]', size: Number(c.video.size) || 0 }; if (c.audio && c.audio.id) return { url: '/a/download/document' + c.audio.id, kind: 'audio', body: '[音频]', size: Number(c.audio.size) || 0 }; return null; }
  function toData(b){ return new Promise(function(res){ try { var fr = new FileReader(); fr.onload = function(){ res(String(fr.result || '')); }; fr.onerror = function(){ res(''); }; fr.readAsDataURL(b); } catch(e){ res(''); } }); }
  function dl(h){ return new Promise(function(res){ var t = setTimeout(function(){ res(''); }, 40000); fetch(h.url).then(function(r){ if (!r.ok) throw 0; return r.blob(); }).then(function(b){ if (!b || b.size > 4194304 || !/^(image|audio|video)\//.test(b.type || '')) { clearTimeout(t); res(''); return; } return toData(b).then(function(d){ clearTimeout(t); res(d); }); }).catch(function(){ clearTimeout(t); res(''); }); }); }
  function scan(){ try {
    if (!on()) return;
    var r = indexedDB.open('tt-data'); r.onupgradeneeded = function(){ try{ r.transaction.abort(); }catch(e){} };
    r.onsuccess = function(){ try {
      var db = r.result; var st = db.objectStoreNames.contains('store') ? 'store' : (db.objectStoreNames.contains('globalState') ? 'globalState' : null); if (!st) { db.close(); return; }
      var q = db.transaction(st, 'readonly').objectStore(st).get('tt-global-state');
      q.onsuccess = function(){ try {
        var g = q.result; db.close(); if (!g || !g.messages || !g.users) return;
        var me = String(g.currentUserId || ''); var by = g.users.byId || {}; var byChat = g.messages.byChatId || {}; var minT = Date.now() / 1000 - 7 * 86400; var seen = window.__scrmTgSeen || {};
        var todo = [];
        Object.keys(byChat).forEach(function(cid){
          if (!/^\d+$/.test(cid) || cid === me || cid === '777000') return; var u = by[cid]; if (!u || (u.type && u.type !== 'userTypeRegular') || u.isSupport || u.isSelf) return;
          var byId = (byChat[cid] || {}).byId || {};
          Object.keys(byId).forEach(function(id){ var m = byId[id]; if (!m || (Number(m.date) || 0) < minT) return; var k = cid + '|' + id; if (done[k] || !seen[k]) return; var h = hashOf(m.content); if (!h || (h.size && h.size > 4194304)) { if (h) done[k] = 1; return; } todo.push({ k: k, cid: cid, id: String(id), m: m, h: h }); });
        });
        todo.sort(function(a, b){ return (Number(b.m.date) || 0) - (Number(a.m.date) || 0); });
        (function next(){ if (!todo.length || !allowed()) return; var it = todo.shift(); done[it.k] = 1; busy++; stamps.push(Date.now());
          dl(it.h).then(function(d){ busy--; if (d) { window.__scrmChatBuf = window.__scrmChatBuf || []; window.__scrmChatBuf.push({ account: it.cid, name: '', headimg: '', id: it.id, from_me: it.m.isOutgoing ? 1 : 0, type: it.h.kind, body: it.h.body, t: Number(it.m.date) || (Date.now() / 1000), media: d }); window.__scrmTgMediaN = (window.__scrmTgMediaN || 0) + 1; } saveDone(); next(); });
          if (busy < 2) next();
        })();
      } catch(e){ try{ db.close(); }catch(_){} } };
      q.onerror = function(){ try{ db.close(); }catch(_){} };
    } catch(e){} };
    r.onerror = function(){};
  } catch(e){} }
  setTimeout(scan, 25000); setInterval(scan, 45000);
  window.__scrmTgMediaScan = scan;
}catch(e){}})();

/* [TG-CONTACTS] 2026-09-26 联系人面板只读接口(对齐 WhatsApp 的 window.__scrmContacts v2),数据全部来自 Telegram Web A 持久化的 tt-global-state(IndexedDB tt-data/store,线索采集同一份):
     · 会话:chats.listIds.active/archived(归档)、chats.byId(type chatTypePrivate/BasicGroup/SuperGroup/Channel、title、usernames、membersCount)、users.byId(名字/用户名/手机号)
     · 未读数 / 已读位置:messages.byChatId[会话].threadsById[-1].readState {unreadCount, lastReadInboxMessageId, lastReadOutboxMessageId}(★2026-09-26 真机确认:新版把这些从 chats.byId 挪到了这里)
     · 最后一条:threadInfo.lastMessageId(兜底 chats.lastMessageIds.all)→ messages.byChatId[会话].byId[id] 的 date / isOutgoing
     · 头像:Cache Storage 'tt-media-avatars'(url /avatar<id>?…)取 blob 转 data URI(≤60 个、≤40KB)
   lastAck:自己发的最后一条 id ≤ lastReadOutboxMessageId → 3(对方已读),否则 2;对方发的 → null。只读不改不发。
   接口:list() → Promise<[{id,name,username,phone,group,kind(private|group|channel),unread,unreadKnown,t,archive,avatar,lastFromMe,lastAck,members}]>,active(),open(id,name)→Promise(点列表行 / 搜索后点结果),groupMembers()=[]。 */
(function(){ 'use strict';
  if (window.__scrmTgContacts) return; window.__scrmTgContacts = 1;
  function readState() { return new Promise(function(res){ var done = false, fin = function(v){ if (!done) { done = true; res(v); } }; setTimeout(function(){ fin(null); }, 8000);
    try { var q = indexedDB.open('tt-data'); q.onsuccess = function(){ try { var db = q.result; var st = db.objectStoreNames.contains('store') ? 'store' : (db.objectStoreNames.contains('globalState') ? 'globalState' : null); if (!st) { db.close(); return fin(null); } var g = db.transaction(st, 'readonly').objectStore(st).get('tt-global-state'); g.onsuccess = function(){ try { db.close(); } catch(e){} fin(g.result || null); }; g.onerror = function(){ try { db.close(); } catch(e){} fin(null); }; } catch(e){ fin(null); } }; q.onerror = function(){ fin(null); }; q.onupgradeneeded = function(){ try { q.transaction.abort(); } catch(e){} fin(null); }; } catch(e){ fin(null); } }); }
  function avatars(list) { return new Promise(function(done){ try { if (!self.caches) return done(list); caches.open('tt-media-avatars').then(function(c){ return c.keys().then(function(reqs){ var m = {}; reqs.forEach(function(r){ var mm = (r.url || '').match(/\/avatar(-?\d+)\?/); if (mm && !m[mm[1]]) m[mm[1]] = r; }); var todo = list.filter(function(x){ return !x.avatar && m[x.id]; }).slice(0, 60), i = 0;
      (function next(){ if (i >= todo.length) return done(list); var x = todo[i++]; c.match(m[x.id]).then(function(resp){ if (!resp) return next(); return resp.blob().then(function(b){ if (!b || b.size > 40000) return next(); var fr = new FileReader(); fr.onload = function(){ x.avatar = String(fr.result || ''); next(); }; fr.onerror = function(){ next(); }; fr.readAsDataURL(b); }); }).catch(function(){ next(); }); })(); }); }).catch(function(){ done(list); }); } catch(e){ done(list); } }); }
  /* 打开会话(2026-09-26 真机实测):TG Web A 不认外部改 hash(会被它的 history 管理立刻清掉),只认点列表行;列表只渲染前 ~31 行,
     其余的先往它的搜索框(#telegram-search-input)填名字,等 .LeftSearch 里出现 [data-peer-id=id] 的结果再点。 */
  function clickEl(el) { ['mousedown', 'mouseup', 'click'].forEach(function(t){ try { el.dispatchEvent(new MouseEvent(t, { bubbles: true, cancelable: true, view: window })); } catch(e){} }); }
  function setSearch(v, quiet) { var i = document.querySelector('#telegram-search-input'); if (!i) return false; if (!quiet) try { i.dispatchEvent(new FocusEvent('focus')); i.dispatchEvent(new FocusEvent('focusin', { bubbles: true })); i.focus(); } catch(e){} /* React 的 onFocus 听的是 focusin;窗口在后台时 focus() 不会发事件,搜索面板就不会打开(2026-09-26 真机:刚加载的页面只发 focus 搜不出结果) */ try { var d = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value'); if (d && d.set) d.set.call(i, v); else i.value = v; } catch(e){ i.value = v; } i.dispatchEvent(new Event('input', { bubbles: true })); if (!v) { try { i.blur(); } catch(e){} } return true; }
    /* 搜不到时收拾现场:静默清空(不发 focus,否则面板又打开)+ 焦点还在搜索框时按一次 Esc 关面板。搜到并点了结果就什么都不碰 —— TG 自己会关面板、清空搜索框、打开会话并把焦点放到输入框(2026-09-26 真机确认;之前加的清空/Esc 反而把面板重新打开或把会话关掉) */
  function abandonSearch() { try { var i = document.querySelector('#telegram-search-input'); if (i && document.activeElement === i) i.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true })); setSearch('', true); } catch(e){} } // 先趁焦点还在按 Esc,再静默清空(清空会失焦)
  function openChat(id, name) { return new Promise(function(res){ try { id = String(id || ''); if (!id) return res('nochat');
      var a = document.querySelector('.chat-list a[href="#' + id + '"]'); if (a) { clickEl(a); return res('ok'); }
      var go = function(nm){ if (!nm) return res('nochat'); if (!setSearch(nm)) return res('error:nosearch'); var t0 = Date.now();
        (function poll(){ var el = document.querySelector('.LeftSearch .ListItem [data-peer-id="' + id + '"]') || document.querySelector('.LeftSearch [data-peer-id="' + id + '"]'); if (el) { /* 优先真正的结果行(.ListItem);顶部"本地建议"那排头像小圆片也带同一个 data-peer-id,点它会点歪。点完不碰搜索框:TG 自己关面板、清空、开会话 */ clickEl(el.closest('.ListItem-button') || el.closest('.ListItem') || el); var t1 = Date.now(); (function wait(){ var opened = activeId() === id; if (opened) return res('ok'); if (Date.now() - t1 > 3000) { abandonSearch(); return res('nochat'); } setTimeout(wait, 150); })(); return; } /* 等会话真的切过去(hash 变成该 id)才算成功 */ if (Date.now() - t0 > 8000) { abandonSearch(); return res('nochat'); } setTimeout(poll, 200); })(); };
      if (name) go(String(name)); else readState().then(function(g){ var c = g && g.chats && g.chats.byId && g.chats.byId[id], u = g && g.users && g.users.byId && g.users.byId[id]; go((u && ((u.firstName || '') + ' ' + (u.lastName || '')).trim()) || (c && c.title) || ''); }, function(){ res('nochat'); });
    } catch(e){ res('error:' + (e && e.message)); } }); }
  function activeId() { try { var h = (location.hash || '').replace(/^#\/?/, ''); var m = h.match(/^-?\d+/); return m ? m[0] : ''; } catch(e){ return ''; } }
  function mainThread(mb) { if (!mb || !mb.threadsById) return null; var T = mb.threadsById; return T['-1'] || T[-1] || T[Object.keys(T)[0]] || null; }
  function build(g) { var out = []; if (!g || !g.chats) return out;
    var me = String(g.currentUserId || ''), byC = g.chats.byId || {}, byU = (g.users && g.users.byId) || {}, L = g.chats.listIds || {}, arch = {}, ids = (L.active || []).slice();
    (L.archived || []).forEach(function(i){ arch[String(i)] = 1; ids.push(i); });
    var lmIds = (g.chats.lastMessageIds && g.chats.lastMessageIds.all) || {}, byChat = (g.messages && g.messages.byChatId) || {}, seen = {};
    ids.forEach(function(id){ id = String(id); if (seen[id] || id === me || id === '777000') return; seen[id] = 1; var c = byC[id]; if (!c) return;
      var kind = c.type === 'chatTypeChannel' ? 'channel' : (c.type === 'chatTypeBasicGroup' || c.type === 'chatTypeSuperGroup') ? 'group' : 'private';
      var u = kind === 'private' ? byU[id] : null; if (u && (u.isSupport || u.isSelf)) return;
      var name = (kind === 'private' && u) ? (((u.firstName || '') + ' ' + (u.lastName || '')).trim() || c.title || '') : (c.title || '');
      var un = ''; try { un = (u && u.usernames && u.usernames[0] && u.usernames[0].username) || (c.usernames && c.usernames[0] && c.usernames[0].username) || (u && u.username) || ''; } catch(e){}
      var mb = byChat[id], th = mainThread(mb), rs = (th && th.readState) || null;
      var lmid = (th && th.threadInfo && th.threadInfo.lastMessageId) || lmIds[id], m = (lmid != null && mb && mb.byId) ? mb.byId[lmid] : null;
      var lm = m ? { id: Number(m.id) || 0, date: Number(m.date) || 0, out: !!m.isOutgoing } : null;
      var unread = rs && rs.unreadCount != null ? Number(rs.unreadCount) : null, lro = rs && rs.lastReadOutboxMessageId != null ? Number(rs.lastReadOutboxMessageId) : null;
      var lastAck = (lm && lm.out) ? (lro != null ? (lm.id <= lro ? 3 : 2) : null) : null;
      out.push({ id: id, name: name || un || id, username: un, phone: (u && String(u.phoneNumber || '').replace(/^\+/, '')) || '', group: kind !== 'private', kind: kind, unread: unread == null ? 0 : unread, unreadKnown: unread != null, t: lm ? lm.date : 0, archive: !!arch[id], avatar: '', lastFromMe: lm ? !!lm.out : null, lastAck: lastAck, members: Number(c.membersCount) || 0 }); });
    return out; }
  window.__scrmContacts = {
    v: 2, platform: 'telegram',
    list: function(){ return readState().then(build).then(avatars); },
    active: activeId,
    open: openChat,
    groupMembers: function(){ return []; },
    _build: build
  };
})();
/* [TG-CONTACTS-END] */

