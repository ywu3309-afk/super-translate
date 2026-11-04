// [NATIVE-RECT] 2026-09-19 fingerprint-inject.js 把 Element.prototype.getBoundingClientRect/getClientRects 包了一层(数值原样、每次新建普通对象,对指纹无作用),
// WhatsApp 虚拟列表滚动时每帧上百次测量都走这层:慢 2.2 倍+大量临时对象(GC 是 CEO 的 8 倍)=滚动"不跟手"根源之一。这里从干净的同源 iframe 取回原生函数装回去
// (preload 不进子帧,子帧里的是未被包装的原生实现);iframe 保留在文档里不移除。安装包里的 fingerprint-inject.js 已同步删掉该段(待发版),届时此处自然跳过。
(function(){
  var tries = 0;
  function restore() {
    try {
      var _bcr = Element.prototype.getBoundingClientRect;
      if (/native code/.test(Function.prototype.toString.call(_bcr))) { window.__scrmNativeRectRestored = 'already'; return true; }
      var root = document.documentElement || document.body; if (!root) return false; // 适配器在 document-start 就跑,DOM 可能还没建
      var f = document.createElement('iframe'); f.setAttribute('aria-hidden', 'true'); f.style.cssText = 'display:none!important;width:0;height:0;border:0;position:absolute;left:-9999px';
      root.appendChild(f);
      var W = f.contentWindow; if (!W || !W.Element) { try { f.remove(); } catch (e) {} return false; }
      var nb = W.Element.prototype.getBoundingClientRect, ng = W.Element.prototype.getClientRects;
      if (nb && /native code/.test(Function.prototype.toString.call(nb))) { Element.prototype.getBoundingClientRect = nb; window.__scrmNativeRectRestored = true; }
      if (ng && /native code/.test(Function.prototype.toString.call(ng))) { Element.prototype.getClientRects = ng; }
      window.__scrmNativeRectFrame = f;
      return true;
    } catch (e) { window.__scrmNativeRectErr = String(e && e.message); return false; }
  }
  (function loop(){ if (restore()) return; if (++tries > 100) return; setTimeout(loop, 100); })();
})();
if (!window.__scrmTranslateV5Loaded) window.__scrmWaTrVer='20261007d'; // [VER] 适配器版本标记(只在本页首次加载时写,补注入不改):健康信标带 v=,可从服务端日志看每台机器实际跑的是哪一版
/* [WA-OBS] 页面变动的公共设施(本文件只此一处):一个 body 级 MutationObserver(子树 childList + characterData;另盯 <html> 的 class/data-theme = 主题切换),每批 records 原样分发给订阅者。
   window.__scrmWaObs = {
     sub(cb)      订阅,cb(records)
     ready(fn)    观察器挂上(body 已在)后调一次 fn;已挂上则立即调
     ours(node)   节点是不是本文件插进页面的(顶栏设备图标 / 列表备注 / 重复粉角标 / 号码遮罩 / 遮罩样式块)
     foreign(rec) 这条 record 里有没有「不是我们自己造成」的变动 —— 订阅者只对它返回 true 的 record 做事,所以任何一段插的节点都不会让自己或别的段重扫
     probes       各段登记的只读自检函数,由 window.__scrmWaSelfCheck() 汇总
   }
   [BATCH1-02] 顶栏设备图标、[BATCH1-03] 列表备注/角标、[BATCH1-08] 号码遮罩都订阅它,各自不建观察器。
   window.__scrmWaSelfCheck():只读自检(不改 DOM、不上报),在真机控制台跑一次,用来核对页面结构假设(列表行/行里的 chat、顶栏名字 span、资料抽屉容器、静音字段形态)。
   本段排在主程序之前:脚本在同一页面被再次执行时(主程序守卫已置位)整段跳过,依赖它的三段也随之跳过 —— 一个页面只跑它首次加载的那一版。 */
;(function(){try{
  if (window.__scrmTranslateV5Loaded || window.__scrmWaObs) return;
  var OURS = '.scrm-dev-ico,.scrm-remark,.scrm-repeat-badge,.scrm-mask,#scrm-wa-mask-style';
  function ours(n){ try{ if (n && n.nodeType !== 1) n = n.parentNode; return !!(n && n.nodeType === 1 && n.closest && n.closest(OURS)); }catch(e){ return false; } }
  function foreign(r){ if (ours(r.target)) return false; if (r.type !== 'childList') return true;
    var a = r.addedNodes, d = r.removedNodes, j; for (j = 0; j < a.length; j++) if (!ours(a[j])) return true; for (j = 0; j < d.length; j++) if (!ours(d[j])) return true; return false; }
  var subs = [], waiters = [], mo = null;
  function dispatch(ms){ for (var i = 0; i < subs.length; i++) { try{ subs[i](ms); }catch(e){} } }
  function start(){ if (mo || !document.body) return;
    try{ var m = new MutationObserver(dispatch); m.observe(document.body, { childList: true, subtree: true, characterData: true }); m.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme'] }); mo = m; }catch(e){ return; }
    var w = waiters; waiters = []; for (var i = 0; i < w.length; i++) { try{ w[i](); }catch(e){} } }
  var probes = {};
  window.__scrmWaObs = { sub: function(cb){ if (typeof cb === 'function' && subs.indexOf(cb) < 0) subs.push(cb); }, ready: function(fn){ if (typeof fn !== 'function') return; if (mo) { try{ fn(); }catch(e){} } else waiters.push(fn); }, ours: ours, foreign: foreign, probes: probes };
  window.__scrmWaSelfCheck = function(){ var out = { ver: window.__scrmWaTrVer || '', observer: !!mo, subscribers: subs.length };
    for (var k in probes) { try{ out[k] = probes[k](); }catch(e){ out[k] = { error: String((e && e.message) || e) }; } } return out; };
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
}catch(e){}})();
/* [/WA-OBS] */


// WhatsApp Web 翻译注入脚本 v5 — 性能优化版
// IPC 批量翻译 + 发送翻译预览

(function() {
  'use strict';

  // 防止脚本被注入多次（did-finish-load + 补注入）
  if (window.__scrmTranslateV5Loaded) return;
  window.__scrmTranslateV5Loaded = true;

  window.__scrm_translate = window.__scrm_translate || {
    enabled: true,
    recvEnabled: true,
    sendEnabled: true,
    recvFrom: 'auto',
    recvTo: 'zh-CN',
    sendFrom: 'auto',
    sendTo: 'en',
    groupEnabled: true,
    previewEnabled: true,
    perChatSendEnabled: false,
    chineseDetect: false
  };

  var cfg = window.__scrm_translate;
  // 缓存键: 用"全文长度 + 哈希"而不是前200字符 —— 否则截断消息和其完整版(前200字相同)会撞同一个键, 导致完整消息拿到半截译文
  function _hashStr(s){ var h=0; for(var i=0;i<s.length;i++){ h=((h<<5)-h+s.charCodeAt(i))|0; } return h; }
  /* [TR-FIX-1002B] 缓存键 = 'v2|线路|目标语言|原文(长度.哈希)',内存/localStorage/IndexedDB 共用;线路取 _route(),与请求地址同一个值(原来键里没线路 → 换线路读到旧线路的译文,没真的重翻)。旧 v1 键自然作废。 */
  function _ckey(text, to, route){ var t=(text||'').trim(); return 'v2|' + (route || _route()) + '|' + to + '|' + t.length + '.' + _hashStr(t); }
  // 翻译缓存二级持久层(IndexedDB:容量大/异步;只在内存没命中时查,热路径不动;不可用则静默降级)
  var _idb = (function(){
    var DB='scrm_tr_wa', ST='c', db=null, rdy=false, dead=false;
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
    function getP(k){ return new Promise(function(resolve){
      if(!rdy||dead||!db){ resolve(null); return; }
      var fired=false, to=setTimeout(function(){ if(!fired){ fired=true; resolve(null); } }, 300);
      try{ var r=db.transaction(ST,'readonly').objectStore(ST).get(k);
        r.onsuccess=function(){ if(!fired){ fired=true; clearTimeout(to); resolve(r.result==null?null:r.result); } };
        r.onerror=function(){ if(!fired){ fired=true; clearTimeout(to); resolve(null); } };
      }catch(e){ if(!fired){ fired=true; clearTimeout(to); resolve(null); } }
    }); }
    function put(k, v){ if(!rdy||dead||!db||v==null||v==='') return;
      try{ db.transaction(ST,'readwrite').objectStore(ST).put(v, k); }catch(e){} }
    // [BATCH1-04] 整表清空:等开库有结果 → 同一事务里先 count 再 clear,返回清掉的条数;库不可用/出错/3s 没回都按 0;永不 reject
    function clearP(){ return new Promise(function(resolve){ var fired=false, n=0, to=setTimeout(function(){ fin(0); },3000);
      function fin(v){ if(!fired){ fired=true; clearTimeout(to); resolve(v); } }
      opened.then(function(){ if(!rdy||dead||!db){ fin(0); return; }
        try{ var s=db.transaction(ST,'readwrite').objectStore(ST); var cr=s.count(); cr.onsuccess=function(){ n=cr.result||0; }; var r=s.clear(); r.onsuccess=function(){ fin(n); }; r.onerror=function(){ fin(0); }; }catch(e){ fin(0); } }); }); }
    return { getP:getP, put:put, clearP:clearP };
  })();
  // 翻译缓存持久化到 localStorage（刷新/切换聊天不用重新请求）
  var translateCache = {};
  try {
    var storedCache = localStorage.getItem('scrm_translate_cache_v1');
    if (storedCache) {
      translateCache = JSON.parse(storedCache);
      // 限制缓存大小：最多 5000 条（Opt: 2000→5000）
      var cacheKeys = Object.keys(translateCache);
      if (cacheKeys.length > 5000) {
        var keep = {};
        cacheKeys.slice(-4000).forEach(function(k) { keep[k] = translateCache[k]; });
        translateCache = keep;
      }
    }
  } catch(e) {}
  var cacheWriteTimer = null;
  function saveCacheLater() {
    if (cacheWriteTimer) return;
    cacheWriteTimer = setTimeout(function() {
      cacheWriteTimer = null;
      try { localStorage.setItem('scrm_translate_cache_v1', JSON.stringify(translateCache)); } catch(e) {}
    }, 2000);
  }
  var lastTranslateMs = 0; // 最近一次翻译耗时（ms）

  // ===== 翻译 API =====
  // 独立版: 直接走服务器 /tp/ 通道(由 wrapper 的 fetch override 转成 Node 请求, 绕过 CSP)
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
  /* [TR-FIX-1002B] 线路唯一来源:请求地址、缓存键、预览去重键都用 _route() 的同一个值。
     WA 的缓存键一直用老写法(谷歌香港/新加坡/海外记作 google-hk/google-sg/google,同一服务的几个老名字合成一个):沿用,换写法会让已缓存的译文全部作废、
     重开聊天全部重翻重扣。这几个老名字服务器也认,所以请求地址直接用它;新线路(gemini/deepl/chatgpt 及以后加的)原样,这里不用再改。 */
  var _WA_KEY_ALIAS = { google2:'google-hk', google_hk:'google-hk', google3:'google-sg', google_sg:'google-sg', google_us:'google' };
  function _route() { var r = _trRouteOf(_waCfg()); return _WA_KEY_ALIAS[r] || r; }
  function _tbase(route) { return _trRouteUrl(route || _route()); }
  function _tparse(t) { if (!t) return ''; try { var l = t.replace(/^\)\]\}'[\s]*/, '').split('\n')[0]; var a = JSON.parse(l); if (a && a[0] && a[0].length) { var s = a[0].map(function(g){ return (g && g[0]) ? g[0] : ''; }).join(''); if (s) return s; } } catch(e){} var m = t.match(/<span id="tw-answ-target-text">([\s\S]*?)<\/span>/); return m ? m[1] : ''; }
  // 翻译单行/单段(带缓存)
  // 坏缓存判定:原文单行但译文含换行=Gemini等引擎逐词拆行的脏数据→丢弃重翻(修历史+防未来)
  function _badTr(text, val){ return !!val && val.indexOf('\n') > -1 && String(text).indexOf('\n') === -1; }
  /* [TR-ALIGN-1002] force=↻重新翻译:跳过内存缓存和 IndexedDB 读取,一定联网,新结果覆盖两处缓存(_net 里写回)。
     原来 ↻ 只删内存键,_translateOne 接着查 IndexedDB 又拿回旧译文;多行消息逐行的键也没删。 */
  function _translateOne(text, from, to, force, route) {
    if (!text || !text.trim()) return Promise.resolve(text || ''); // 空行原样保留
    if (!/\p{L}/u.test(text)) return Promise.resolve(text.trim()); // [NUM-TR] 没有任何字母(纯数字/符号)→译文=原文,本地直出不联网
    route = route || _route();
    var key = _ckey(text, to, route);
    if (!force && translateCache[key]) {
      if (!_badTr(text, translateCache[key])) return Promise.resolve(translateCache[key]);   // 内存命中(且非脏):秒填
      try{ delete translateCache[key]; }catch(e){}   // 脏缓存:清掉,往下重翻
    }
    /* [TR-FIX-1002B] force 不再先删内存缓存:联网失败时旧译文要原样保留,成功才由 _net 覆盖(原来先删,失败就丢了) */
    var _net = function(){
      var q = 'sl:' + (from || 'auto') + ',tl:' + to + ',st:' + encodeURIComponent(text) + ',id:1,qc:true,ac:true,_id:tw-async-translate,_pms:s,_fmt:pc';
      var _ac = null, _to = null; try { if (typeof AbortController !== 'undefined') { _ac = new AbortController(); _to = setTimeout(function(){ try { _ac.abort(); } catch(e){} }, 20000); } } catch(e){} // [NET-TIMEOUT 2026-09-15] 请求挂住(无响应)原来永远 pending,消息永远不出译文;20s 超时→按失败处理,清 pending 由下轮重扫重试
      return fetch(_tbase(route) + '/async/translate?async=' + encodeURIComponent(q), _ac ? { signal: _ac.signal } : undefined)
        .then(function(r){ if (_to) clearTimeout(_to); return r.text(); })
        .then(function(t){ var s = _tparse(t); if (s && _badTr(text, s)) s = s.replace(/\s*\n\s*/g, ' ').replace(/^\s+|\s+$/g,'');   // 存前也兜一道:单行原文的译文里若混入换行→合并空格
          if (s) { translateCache[key] = s; saveCacheLater(); try{ _idb.put(key, s); }catch(_p){} } return s || ''; })
        .catch(function(){ if (_to) clearTimeout(_to); return ''; });
    };
    if (force) return _net();
    // 内存没命中 → 查 IndexedDB 持久缓存,命中(且非脏)免网络;脏/不可用/超时→重翻
    return _idb.getP(key).then(function(cached){
      if (cached != null && cached !== '' && !_badTr(text, cached)) { translateCache[key] = cached; return cached; }
      return _net();
    });
  }
  // 限并发地处理数组(每次最多 limit 个), 避免一条多行长消息一次性发几十个请求
  function _mapLimit(items, limit, fn) {
    return new Promise(function(resolve){
      var results = new Array(items.length);
      if (!items.length) return resolve(results);
      var idx = 0, active = 0, done = 0;
      function next(){
        while (active < limit && idx < items.length) {
          (function(i){
            active++;
            Promise.resolve(fn(items[i], i))
              .then(function(r){ results[i] = r; }, function(){ results[i] = ''; })
              .then(function(){ active--; done++; if (done === items.length) resolve(results); else next(); });
          })(idx++);
        }
      }
      next();
    });
  }
  function translateBatch(items) {
    if (!items.length) return Promise.resolve([]);
    return Promise.all(items.map(function(item) {
      var to = item.to || 'zh-CN', route = _route();
      var full = item.text || '';
      var fullKey = _ckey(full, to, route);
      if (translateCache[fullKey] && _badTr(full, translateCache[fullKey])) { try{ delete translateCache[fullKey]; }catch(e){} }   // 脏缓存(逐词坏值)→清掉重翻
      if (!item.force && translateCache[fullKey]) return Promise.resolve(translateCache[fullKey]);
      // 无换行 → 单次翻译
      if (full.indexOf('\n') === -1) return _translateOne(full, item.from, to, item.force, route);
      // 多行 → 逐行翻译(每条最多同时 5 行), 保留换行与空行, 使译文段落与原文一致
      var lines = full.split('\n');
      return _mapLimit(lines, 5, function(ln){ return _translateOne(ln, item.from, to, item.force, route); })
        .then(function(res){
          // [TR-FIX-1002B] 任一非空行没翻出来 = 整段失败:不拿缺行的半截译文去显示/发送,也不写缓存
          for (var li = 0; li < lines.length; li++) { if (lines[li].trim() && !res[li]) return ''; }
          var joined = res.join('\n');
          if (joined.trim()) { translateCache[fullKey] = joined; saveCacheLater(); }
          return joined;
        });
    }));
  }
  var _trCallbacks = {}, _trId = 0;
  window.__scrmTrCallback = function(id, translated) {
    if (_trCallbacks[id]) { _trCallbacks[id](translated || ''); delete _trCallbacks[id]; }
  };

  // ===== 语言检测 =====
  function needsTranslation(text, targetLang) {
    if (!text || text.trim().length < 1) return false;
    var t = text.trim();
    // [NUM-TR] 2026-09-14 用户要求"数字也要有翻译":只跳过完全没有字母/数字的文本(纯标点/emoji);纯数字走 _translateOne 的本地直出(原样当译文,不联网)
    if (!/[\p{L}\p{N}]/u.test(t)) return false;
    // 其他所有文本都翻译（即使已经是目标语言，也显示翻译结果）
    return true;
  }

  // ===============================================
  // ===== 接收翻译（消息气泡下方追加翻译） =====
  // ===============================================

  // [WA-QUOTE-BODY] 引用块(可点击跳回原消息的 role=button,内含 .quoted-mention)自己也带 data-pre-plain-text,且在 DOM 里排在正文前面,
  // 原来 querySelector 先命中它 → 正文容器=引用块 → 翻译出来的是被引用那段。改成:排除引用块后取最后一个(正文在引用之后)。
  function _isQuoteBlock(el) {
    try {
      if (el.closest('[aria-label*="Quoted"],[aria-label*="引用"],[data-testid="quoted-message"],[class*="quoted"]')) return true;
      var btn = el.closest('[role="button"]'); if (btn && btn.querySelector('.quoted-mention')) return true;
      if (el.querySelector && el.querySelector('.quoted-mention') && !el.querySelector('[data-pre-plain-text]')) return true; // 自身就是引用块(内含引用文本且不再嵌套正文容器)
    } catch (e) {}
    return false;
  }
  function _msgTextEl(msgEl) {
    if (msgEl.getAttribute && msgEl.getAttribute('data-pre-plain-text') != null) return msgEl;
    var all = []; try { all = msgEl.querySelectorAll ? Array.prototype.slice.call(msgEl.querySelectorAll('[data-pre-plain-text]')) : []; } catch (e) {}
    var pick = null;
    for (var i = 0; i < all.length; i++) { if (_isQuoteBlock(all[i])) continue; pick = all[i]; }
    // 全是引用块(只有引用块带 data-pre-plain-text 的版本):退回整个 copyable 容器,getMsgText 会把引用块剔掉只留正文;绝不把引用块当正文
    return pick || msgEl.querySelector('.copyable-text') || msgEl;
  }
  // 译文的挂载位置: WhatsApp 里"时间戳meta"绝对定位在"内容列"(相对定位)右下角。
  // 若把译文塞进内容列会撑高它 -> 时间戳掉到底部。所以译文要挂到"内容列的父级"(内容列外面)。
  // 关键: 普通消息和转发/图片消息的层级不一样, 必须按"meta 在哪"自适应判断内容列, 否则会算错一层 ->
  //   host 变成更高的共享祖先, 多条转发消息互相把对方的译文当成"已翻译"而漏翻。
  function _trHost(msgEl) {
    var copyable = _msgTextEl(msgEl);
    if (!copyable) return msgEl;
    // 内容列 = 直接包含 msg-meta(绝对定位时间戳)的那个元素
    var meta = copyable.querySelector && copyable.querySelector('[data-testid="msg-meta"]');
    // meta 在 copyable 内部 -> copyable 自己就是内容列(转发/图片消息); 否则 meta 是兄弟 -> 内容列是 copyable 的父级(普通消息)
    var col = meta ? copyable : (copyable.parentElement || copyable);
    return (col && col.parentElement) || col || copyable || msgEl;
  }
  function _hasTr(msgEl) {
    try { var h = _trHost(msgEl); return !!(h && h.querySelector('.scrm-translated')); } catch (e) { return false; }
  }
  // 统一行压缩: 拆行->去每行首尾空白->丢弃空行->单换行拼回。任何上游产生的多余空行到这里都被清掉。
  // \u89c4\u6574\u6210"\u6bb5\u843d"\u7ed3\u6784(\u5bf9\u9f50\u7ade\u54c1\u7684\u5e72\u51c0\u6392\u7248):
  //   \u6bb5\u843d\u4e4b\u95f4(\u539f\u6587\u6709\u7a7a\u884c\u7684\u5730\u65b9)\u4fdd\u7559\u4e00\u4e2a\u7a7a\u884c; \u6bb5\u843d\u5185\u90e8\u7684\u6362\u884c\u5408\u5e76\u6210\u4e00\u53e5(flow, \u6d88\u9664\u6e90\u6587\u672c\u91cc\u522b\u626d\u7684\u786c\u6362\u884c)\u3002
  // 发送方向轻量归一:保留每个换行(单换行也保留),只规整换行符、去行尾空白、3+空行压成2
  function _lightNorm(t){ if(!t) return t||''; return String(t).replace(/[\r\u2028\u2029]/g,'\n').replace(/[ \t\xa0\u200b]+$/gm,'').replace(/\n{3,}/g,'\n\n').replace(/^\n+|\n+$/g,''); }
  function _compactLines(t){
    if(!t) return t||'';
    var paras = String(t)
      .replace(/[\r\u2028\u2029]/g, '\n')
      .split(/\n[ \t\xa0\u200b]*\n[\s]*/)                                  // \u6309\u7a7a\u884c\u5207\u6210\u6bb5\u843d
      .map(function(p){
        return p.replace(/[ \t\xa0\u200b]*\n[ \t\xa0\u200b]*/g, ' ')       // \u6bb5\u5185\u6362\u884c -> \u7a7a\u683c(\u8fde\u7eed\u6210\u53e5)
                .replace(/[ \t\xa0\u200b]{2,}/g, ' ')                       // \u591a\u4f59\u7a7a\u683c\u538b\u6210\u4e00\u4e2a
                .replace(/^[ \t\xa0\u200b]+|[ \t\xa0\u200b]+$/g, '');       // \u53bb\u6bb5\u843d\u9996\u5c3e\u7a7a\u767d
      })
      .filter(function(p){ return p !== ''; });
    // \u667a\u80fd\u5408\u5e76: \u82e5\u4e0a\u4e00\u6bb5\u4e0d\u4ee5"\u53e5\u672b\u6807\u70b9"\u7ed3\u5c3e, \u8bf4\u660e\u90a3\u4e2a\u7a7a\u884c\u662f\u53e5\u5b50\u4e2d\u95f4\u7684\u522b\u626d\u65ad\u884c(\u4e0d\u662f\u771f\u6bb5\u843d\u5206\u754c) -> \u5408\u5e76\u6210\u4e00\u53e5
    var out = [];
    for (var i = 0; i < paras.length; i++) {
      if (out.length && !/[\u3002\uff01\uff1f!?.\uff09)\]\u3011\u2026\uff1a:\uff1b;"\u201d'\u300f]$/.test(out[out.length-1])) {
        out[out.length-1] += ' ' + paras[i];
      } else {
        out.push(paras[i]);
      }
    }
    return out.join('\n\n');                                              // \u771f\u6bb5\u843d\u4e4b\u95f4\u7559\u4e00\u4e2a\u7a7a\u884c
  }
  function getMsgText(msgEl) {
    var src = _msgTextEl(msgEl);
    // 优先用整段文本容器 [data-testid="selectable-text"]; 找不到就用整个 copyable 清洗。
    // 注意: 不能用 .selectable-text class 兜底 —— WhatsApp 会把正文里的电话号码/链接单独包成 .selectable-text 小 span,
    //       querySelector 会命中那个子 span(只拿到电话号码), 导致正文被误判成"纯数字不用翻"而漏翻。
    // [WA-QUOTE-BODY] 2026-09-19 客户截图:回复(引用)消息翻译出来的是被引用那段,不是自己发的正文。原因:引用块在 DOM 里排在正文前面,
    // querySelector 先命中引用块里的 selectable-text。这里取"不在引用块里"的那个正文节点;兜底整段清洗时也把引用块整个剔掉。
    var _inQuote = function (el) { try { return !!(el.closest && el.closest('[aria-label*="Quoted"],[aria-label*="引用"],[data-testid="quoted-message"],[class*="quoted"]')); } catch (e) { return false; } };
    var textNode = null;
    try {
      if (src.querySelectorAll) { var _cands = src.querySelectorAll('[data-testid="selectable-text"]'); for (var _ci = 0; _ci < _cands.length; _ci++) { if (!_inQuote(_cands[_ci]) && !_cands[_ci].querySelector('.quoted-mention')) { textNode = _cands[_ci]; break; } } }
    } catch (e) {}
    if (!textNode) textNode = src;
    var clone = textNode.cloneNode(true);
    try {
      // 引用块:aria-label/data-testid 标识的容器,或含 .quoted-mention 的可点击块(跳到原消息那个 role=button)
      clone.querySelectorAll('[aria-label*="Quoted"],[aria-label*="引用"],[data-testid="quoted-message"],[class*="quoted"]').forEach(function (el) { if (el.parentNode) el.parentNode.removeChild(el); });
      clone.querySelectorAll('.quoted-mention').forEach(function (el) { var box = el.closest('[role="button"]') || el; if (box.parentNode) box.parentNode.removeChild(box); });
    } catch (e) {}
    try {
      // 剔除: 转发标签(已转发)、图片/媒体、图标svg、我们的译文、可见时间戳meta
      clone.querySelectorAll('[data-testid="forwarded-header"],[data-testid="image-thumb"],[data-testid="media-state-download"],[data-testid="msg-meta"],[data-icon],svg,img,.scrm-translated').forEach(function(el){ if (el.parentNode) el.parentNode.removeChild(el); });
      // 剔除"只含时间"的 span(内联时间戳占位, 不管是否 aria-hidden)
      clone.querySelectorAll('span').forEach(function(el){
        var txt = (el.textContent || '').replace(/[​-‏‪-‮﻿\s]/g, '');
        if (/^\d{1,2}:\d{2}([AP]M)?$/.test(txt)) { if (el.parentNode) el.parentNode.removeChild(el); }
      });
      // 剔除 WhatsApp 长消息的"查看更多/Read more"折叠按钮, 避免被读进正文翻译
      clone.querySelectorAll('[role="button"], span, div').forEach(function(el){
        var tx = (el.textContent || '').trim();
        if (/^(查看更多|閱讀更多|阅读更多|显示更多|Read more|read more)$/.test(tx)) { if (el.parentNode) el.parentNode.removeChild(el); }
      });
      // <br> → 换行(保留原文硬换行; 软折行不是 <br>, 会自然变空格)
      clone.querySelectorAll('br').forEach(function(br){ if (br.parentNode) br.parentNode.replaceChild(document.createTextNode('\n'), br); });
    } catch(e){}
    var t = clone.textContent || '';
    t = t.replace(/[​-‏‪-‮﻿]/g, '');  // 去零宽/方向控制符(否则末尾时间/换行匹配不到)
    t = t.replace(/\s*\d{1,2}:\d{2}(\s*[AP]M)?\s*$/, '');       // 兜底去末尾时间
    t = t.replace(/[ \t]+$/gm, '');                          // 每行去尾部空白
    return _lightNorm(t);  // 保留硬换行(<br>转来的),不再压平

  }

  // 同类消息(相同 className)的左右内边距是一样的 -> 按 className 缓存 getComputedStyle, 避免每条消息都触发重排
  var _hpadCache = {};
  function _hpadCached(el){
    if (!el) return { l:0, r:0 };
    var k = el.className || '_';
    if (_hpadCache[k]) return _hpadCache[k];
    var s = getComputedStyle(el);
    var r = { l:(parseFloat(s.marginLeft)||0)+(parseFloat(s.paddingLeft)||0), r:(parseFloat(s.marginRight)||0)+(parseFloat(s.paddingRight)||0) };
    _hpadCache[k] = r; return r;
  }

  /* [TR-ALIGN-1002] ↻ 真正联网:translateBatch(force) 跳过内存+IndexedDB,新结果覆盖缓存;旧译文留着直到新结果回来(失败也不丢),不再靠拼缓存键去删。 */
  // [TR-FIX-1002B] 「刷新中」按 语言|原文 记在集合里(WA 虚拟列表会换掉 DOM 元素,不挂在元素上),同一条不重复发起
  var _rfSet = {};
  function _refreshMsgTranslation(msgEl, rf) {
    try {
      var t = getMsgText(msgEl), to = cfg.recvTo, k = to + '|' + t; if (!t || _rfSet[k]) return;
      _rfSet[k] = 1;
      if (rf) rf.classList.add('spin');
      var sig = _msgSig(msgEl);
      var end = function(){ delete _rfSet[k]; if (rf) rf.classList.remove('spin'); };
      translateBatch([{ text: t, from: cfg.recvFrom, to: to, force: true }]).then(function(r){
        end();
        var tr = r && r[0]; if (!tr) return;   // 失败:旧译文和旧缓存都留着
        _msgCachePut(sig, tr); addTranslation(msgEl, tr); msgEl.setAttribute('data-scrm-tr', 'done');
      }, end);
    } catch(e){}
  }
  function addTranslation(msgEl, translatedText) {
    if (!translatedText) return;
    translatedText = _lightNorm(translatedText);   // 保留换行(单换行也留),只清多余空行/行尾空白
    var host = _trHost(msgEl);
    var old = host.querySelector('.scrm-translated');
    if (old) { var s = old.querySelector('span'); if ((s ? s.textContent : old.textContent) === translatedText) return; _keepBottom(host); if (s) s.textContent = translatedText; else old.textContent = translatedText; return; }   // [TR-ALIGN-1002] 改译文也会变高
    var transDiv = document.createElement('div');
    transDiv.className = 'scrm-translated';
    // margin-top 收小 -> 虚线更贴近原文行; 文字与虚线间留一点点 padding-top
    transDiv.style.cssText = 'display:block;margin:0;padding:3px 0 0 0;font-size:13.5px;color:#1a7f37;line-height:1.5;word-wrap:break-word;white-space:pre-wrap;border-top:1px dashed #1a7f37;';
    // 译文挂在"内容列"外面, 不继承原文那层的左右内边距 -> 会贴到气泡边。
    // 用实际渲染位置量出"原文文字块相对 host 的左内边距", 译文对齐它, 并保证至少 8px 左右留白(不贴边、更美观)。
    try {
      var copyable = _msgTextEl(msgEl);
      var pad = 8;
      try { var hr = host.getBoundingClientRect(), cr = copyable.getBoundingClientRect(); pad = Math.max(8, Math.round(cr.left - hr.left)); } catch(e2){}
      transDiv.style.paddingLeft = pad + 'px';
      transDiv.style.paddingRight = pad + 'px';
      transDiv.style.boxSizing = 'border-box';
      // 只对"带媒体(图片/视频/语音)"的消息限制宽度: 这类气泡被媒体撑宽, 否则译文会拉满整个气泡不换行。
      var hasMedia = !!(msgEl.querySelector && msgEl.querySelector('[data-testid="image-thumb"],[data-testid="media-content"],[data-testid="audio-play"],[data-testid="voice-note"],video,canvas'));
      var w = copyable && copyable.offsetWidth;
      if (hasMedia && w && w > 40) { transDiv.style.maxWidth = w + 'px'; }
    } catch(e){}
    var textSpan = document.createElement('span');
    textSpan.className = 'scrm-tr-text';
    textSpan.textContent = translatedText;
    transDiv.appendChild(textSpan);
    // 刷新按钮(重新翻译该条,替代原来的 Google "G" 标记)
    if (!document.getElementById('scrm-wa-spin-style')) {
      var _st = document.createElement('style'); _st.id = 'scrm-wa-spin-style';
      _st.textContent = '@keyframes scrm-wa-spin{to{transform:rotate(360deg)}} .scrm-tr-refresh{display:inline-flex;align-items:center;margin-left:6px;vertical-align:middle;cursor:pointer;color:#9aa0a6;transition:color .15s;} .scrm-tr-refresh:hover{color:#1a7f37;} .scrm-tr-refresh.spin svg{animation:scrm-wa-spin .8s linear infinite;}';
      document.head.appendChild(_st);
    }
    var rf = document.createElement('span');
    rf.className = 'scrm-tr-refresh'; rf.title = '重新翻译';
    rf.innerHTML = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>';
    (function(m, b){ b.addEventListener('click', function(ev){ ev.stopPropagation(); ev.preventDefault(); _refreshMsgTranslation(m, b); }, true); })(msgEl, rf);
    transDiv.appendChild(rf);
    // 挂到"内容列的父级"(内容列外面), 不撑高内容列 -> 时间戳留在原文行末, 译文单独一行
    // 滚动锁死修复: 若给"可视区上方"的消息加译文, 增加的高度会把滚动位置顶回去(往上滑被弹回, 来回抖上不去)。
    //   -> 记录加之前的高度和"这条是否在可视区上方", 加完把增加的高度补到 scrollTop, 让可视内容和滚动位置纹丝不动。
    var _sc = _scrollParent(host);
    var _above = false, _h0 = 0;
    // [NO-DOUBLE-ANCHOR] 2026-09-19 滚动"不跟手/被顶一下"的实体:Chromium 自带滚动锚定(overflow-anchor:auto,WA 滚动容器实测为 auto)——可视区上方内容变高时浏览器自动补偿 scrollTop;
    // 这里原来又手动 `scrollTop += 增高`,等于补偿两次,每插一条译文可视内容就往下跳一条译文的高度(实测 5 条译文瞬间跳 235px,CEO/海王不做这个所以不跳)。
    // 现在:容器带锚定就完全交给浏览器,不读布局不改 scrollTop(还省掉每条译文两次 getBoundingClientRect 的强制布局);只有容器 overflow-anchor:none 时才走老的手动补偿。
    var _anchored = true; try { if (_sc) _anchored = (getComputedStyle(_sc).overflowAnchor !== 'none'); } catch(e){}
    if (_sc && !_anchored) {
      try { var _mr = msgEl.getBoundingClientRect(), _cr = _sc.getBoundingClientRect(); _above = _mr.bottom <= _cr.top; _h0 = _sc.scrollHeight; } catch(e){}
    }
    // [STICK-BOTTOM] 插译文前滑条已在底 → 插完仍在底(规则唯一实现见 _keepBottom [TR-ALIGN-1002])
    _keepBottom(host);
    host.appendChild(transDiv);
    if (_sc && !_anchored && _above) {
      try { var _d = _sc.scrollHeight - _h0; if (_d > 0) _sc.scrollTop += _d; } catch(e){}
    }
    // 译文撑高气泡后, 相邻消息会挤在一起 -> 给气泡底部补一点点透明外间距
    try {
      var bubble = msgEl.closest && (msgEl.closest('[data-testid="msg-container"]') || msgEl.closest('.message-in, .message-out'));
      if (bubble) bubble.style.marginBottom = '6px';
    } catch(e){}
  }
  // 找最近的竖向滚动容器(消息列表), 缓存复用(一个聊天里不变, 避免每条译文都 getComputedStyle 遍历)
  var _scCache = null;
  function _scrollParent(el) {
    if (_scCache && document.contains(_scCache) && _scCache.scrollHeight > _scCache.clientHeight + 8) return _scCache;
    _scCache = null;
    var p = el && el.parentElement;
    while (p && p !== document.body) {
      var cs = getComputedStyle(p);
      if ((cs.overflowY === 'auto' || cs.overflowY === 'scroll') && p.scrollHeight > p.clientHeight + 8) { _scCache = p; return p; }
      p = p.parentElement;
    }
    return null;
  }
  /* [TR-ALIGN-1002] 2026-10-02 唯一贴底规则(照 TG [TG-KEEP-BOTTOM]):我们往消息里插东西(译文/语音译文)会把内容撑高——
     插入前该消息所在滚动容器离底 ≤24px,或用户刚点了 WA 自带的「滚动到底部」按钮(1.2 秒内、没再滚轮/触摸)→ 插完(微任务里)贴底;否则位置不动。
     同一轮多次插入只量一次。原来「插前离底≤2px 才贴」[STICK-BOTTOM]、[BTN-BOTTOM] 1.2 秒每帧按底、切会话 1.5 秒每帧按底 [PIN v2] 三套并存,
     现在合成这一处;打开/切换会话停在哪由 WA 自己决定,不再干预。 */
  var _kbList = null, _btnBottomUntil = 0;
  function _keepBottom(el) {
    try {
      var sc = _scrollParent(el); if (!sc) return;
      if (_kbList) { for (var i = 0; i < _kbList.length; i++) { if (_kbList[i].sc === sc) return; } }
      else { _kbList = []; Promise.resolve().then(function(){ var l = _kbList; _kbList = null; for (var k = 0; k < l.length; k++) { try { if (l[k].atB && l[k].sc.isConnected) l[k].sc.scrollTop = l[k].sc.scrollHeight; } catch(e){} } }); }
      _kbList.push({ sc: sc, atB: (sc.scrollHeight - sc.scrollTop - sc.clientHeight) <= 24 || Date.now() < _btnBottomUntil });
    } catch(e){}
  }
  window.__scrmWaKeepBottom = _keepBottom;   // 语音翻译块(另一个闭包)插语音译文时共用这一份
  // [BTN-BOTTOM] WA 自带"滚动到底部"按钮:用户明确要到底 → 1.2 秒内插译文都贴底(WA 滚到底→虚拟列表重建→译文秒加撑高,不贴会停在离底 ~180px);期间滚轮/触摸即作废
  document.addEventListener('click', function(ev){ try{ var t=ev.target; var b=t&&t.closest&&t.closest('button[aria-label="滚动到底部"],button[aria-label="Scroll to bottom"],button[aria-label*="bottom" i]'); if(!b){ var ic=t&&t.closest&&t.closest('[data-icon="ic-chevron-down-wide"],[data-icon="down"]'); if(ic) b=ic.closest('button')||ic; } if(b) _btnBottomUntil=Date.now()+1200; }catch(e){} }, true);
  ['wheel','touchstart'].forEach(function(t){ document.addEventListener(t, function(){ _btnBottomUntil = 0; }, { capture: true, passive: true }); });

  // 滚动状态: 只用来暂停"重活定时器"(flattenPill/扫描), 翻译本身由可视区观察器驱动, 不受这个影响。
  var __scrolling = false, __scrollTimer = null;
  // [SCROLL-JANK-PROBE] 2026-09-19 客户(Windows)反馈滚动不跟手:滚动期间用 rAF 量帧间隔,每 60s 最多打一条 /HB?ev=wa_jank(帧数/超 50ms 帧数/最大/中位),服务器 nginx 日志直接看该机真实卡顿
  var _jk = { gaps: [], loopOn: false, lastSend: 0 };
  function _jankLoop() {
    if (_jk.loopOn) return; _jk.loopOn = true; var last = performance.now();
    (function step() {
      var now = performance.now(); var g = now - last; last = now; if (g > 0 && g < 2000) _jk.gaps.push(g);
      if (__scrolling) { requestAnimationFrame(step); } else { _jk.loopOn = false; _jankReport(); }
    })();
  }
  function _jankReport() {
    try {
      var g = _jk.gaps; if (g.length < 20 || Date.now() - _jk.lastSend < 60000) return;
      var s = g.slice().sort(function (a, b) { return a - b; }); var slow = 0; for (var i = 0; i < g.length; i++) if (g[i] > 50) slow++;
      _jk.lastSend = Date.now(); _jk.gaps = [];
      var q = 'ev=wa_jank&n=' + g.length + '&slow=' + slow + '&max=' + Math.round(s[s.length - 1]) + '&p50=' + Math.round(s[Math.floor(s.length / 2)]) + '&p95=' + Math.round(s[Math.floor(s.length * 0.95)]) + '&os=' + encodeURIComponent((navigator.platform || '').slice(0, 8)) + '&t=' + Date.now();
      var x = new XMLHttpRequest(); x.open('GET', 'https://chm123.com/HB?' + q, true); x.send();
    } catch (e) {}
  }
  function _onScroll() {
    __scrolling = true; window.__scrmScrolling = true; try { _jankLoop(); } catch (e) {} // [EXEC-CACHE] 面板的轮询脚本看到这个旗子直接返回上次结果,不在滚动中干活
    clearTimeout(__scrollTimer);
    __scrollTimer = setTimeout(function(){ __scrolling = false; window.__scrmScrolling = false; }, 160);
  }
  // 译文加载(可视区观察器保证只在可见时调用, 不再需要滚动延迟)
  function applyTr(el, text) { addTranslation(el, text); }

  // 消息队列 — 去重用 data attribute 而非 WeakSet（DOM 重建后仍然可靠）
  var pendingMsgs = [];
  var processTimer = null;
  // processing 已替换为 activeRequests 并发控制
  var flushDelay = 10; // 首次加载用 30ms 快速响应，之后改成 100ms
  setTimeout(function() { flushDelay = 30; }, 60000);

  // 按消息的"快缓存": 用廉价签名(原始文本, 不 clone/不清洗)直接映射到译文。
  // 作用: 虚拟列表滚动反复删/建消息时, 命中快缓存就在绘制前秒加译文, 不做 getMsgText 重活 -> 不闪不卡。
  var msgTrCache = {}, _msgCacheN = 0;
  function _msgSig(msgEl) {
    try { var el = _msgTextEl(msgEl); var tc = (el && el.textContent) || ''; return el ? (tc.length + ':' + tc.slice(0, 220) + '|' + cfg.recvTo) : ''; } catch(e){ return ''; }
  }
  // 写快缓存 + 上限保护: 超过 4000 条整体清空(会从 translateCache 秒级重建, 无损), 防止长会话无限增长
  function _msgCachePut(sig, val) {
    if (!sig) return;
    if (msgTrCache[sig] === undefined) { _msgCacheN++; if (_msgCacheN > 4000) { msgTrCache = {}; _msgCacheN = 1; } }
    msgTrCache[sig] = val;
  }
  /* [BATCH1-04] 面板「清空译文缓存」:window.__scrmTrCacheClear() → Promise<{cleared:n}>,永不 reject。
     清三处:内存 translateCache(及它在 localStorage scrm_translate_cache_v1 的镜像,连同在途的落盘)、按消息签名的快缓存 msgTrCache、IndexedDB scrm_tr_wa 的表 c(_idb.clearP)。
     n(全平台同一口径)= 持久层里被清掉的译文条数 = IndexedDB 表的条数;内存是它的副本,不另计。
     只清数据:已显示的译文框不动、data-scrm-tr=done 不动 → 不触发重译;之后新消息 / ↻ 才重新联网。 */
  window.__scrmTrCacheClear = function(){
    try { translateCache = {}; msgTrCache = {}; _msgCacheN = 0; } catch(e){}
    try { if (cacheWriteTimer) { clearTimeout(cacheWriteTimer); cacheWriteTimer = null; } localStorage.removeItem('scrm_translate_cache_v1'); } catch(e){}
    var p; try { p = _idb.clearP(); } catch(e){ p = Promise.resolve(0); }
    return p.then(function(k){ return { cleared: Number(k) || 0 }; }, function(){ return { cleared: 0 }; });
  };
  // 可视区观察器: 消息一进入可视区(含少量预加载余量)就翻译; 屏幕外的完全不碰。
  // 这样: 已缓存的消息一露头就秒显译文(不像重翻); 不会一次性给一大批屏幕外消息加译文(那是"锁死/抖"的根源)。
  var _visObs = null;
  function _ensureVisObs() {
    if (_visObs) return _visObs;
    _visObs = new IntersectionObserver(function(entries){
      for (var i = 0; i < entries.length; i++) {
        if (entries[i].isIntersecting) { var el = entries[i].target; try { _visObs.unobserve(el); } catch(e){} _translateOneMsg(el); }
      }
    }, { root: null, rootMargin: '800px 0px 800px 0px', threshold: 0 });  // [MOUNT-INSERT] 上下各预翻 800px:没缓存的消息也尽量在滚进视野前就插好译文(缓存命中的已在挂载时同步插)
    return _visObs;
  }
  // 真正翻译一条(在它可见时调用)
  function _translateOneMsg(msgEl) {
    if (!cfg.enabled || !cfg.recvEnabled) return;
    if (_hasTr(msgEl)) { msgEl.setAttribute('data-scrm-tr', 'done'); return; }
    if (msgEl.getAttribute('data-scrm-tr') === 'done') return;
    var sig = _msgSig(msgEl);
    var _text = ''; try { _text = getMsgText(msgEl); } catch(e){}
    // ① 快缓存命中 -> 秒加(脏缓存:原文单行却带换行=逐词坏值→清掉重翻)
    if (sig && msgTrCache[sig] && _badTr(_text, msgTrCache[sig])) { try{ delete msgTrCache[sig]; }catch(e){} }
    if (sig && msgTrCache[sig]) { addTranslation(msgEl, msgTrCache[sig]); msgEl.setAttribute('data-scrm-tr', 'done'); return; }
    // ② 翻译文本缓存命中 -> 加 + 回填快缓存
    try {
      if (!needsTranslation(_text, cfg.recvTo)) { if (_emptyRetry(msgEl, _text)) return; msgEl.setAttribute('data-scrm-tr', 'done'); return; }
      var _ck = _ckey(_text, cfg.recvTo);
      if (translateCache[_ck] && _badTr(_text, translateCache[_ck])) { try{ delete translateCache[_ck]; }catch(e){} }   // 脏缓存→清
      if (translateCache[_ck]) { addTranslation(msgEl, translateCache[_ck]); _msgCachePut(sig, translateCache[_ck]); msgEl.setAttribute('data-scrm-tr', 'done'); return; }
    } catch(e){}
    // ③ 没翻过 -> 联网翻译
    msgEl.setAttribute('data-scrm-tr', 'pending'); msgEl.__scrmPendAt = Date.now();
    msgEl.__scrmSig = sig;
    pendingMsgs.push(msgEl);
    if (!processTimer && activeRequests < MAX_CONCURRENT) processTimer = setTimeout(flushQueue, flushDelay);
  }
  // [EMPTY-RETRY 2026-09-15] 气泡节点先于正文出现时 getMsgText 为空,原来直接标 done=这条永远不翻("有时候卡着不出翻译");正文为空就 600ms 后重排最多 3 次
  function _emptyRetry(el, text) {
    try {
      if (text && text.trim()) return false;
      el.__scrmEmptyTries = (el.__scrmEmptyTries || 0) + 1;
      if (el.__scrmEmptyTries > 3) return false;
      el.removeAttribute('data-scrm-tr');
      setTimeout(function(){ try { if (document.contains(el) && el.getAttribute('data-scrm-tr') !== 'done') queueMessage(el); } catch(e){} }, 600);
      return true;
    } catch(e) { return false; }
  }
  // queueMessage 现在只做"登记观察"(廉价), 具体翻译等它进可视区再做
  function queueMessage(msgEl) {
    if (!cfg.enabled || !cfg.recvEnabled) return;
    if (_hasTr(msgEl)) { msgEl.setAttribute('data-scrm-tr', 'done'); return; }
    var tr = msgEl.getAttribute('data-scrm-tr');
    if (tr === 'pending' || tr === 'done') return;
    // [MOUNT-INSERT] 2026-09-19 对齐海王/CEO:译文已有缓存的消息在节点挂载那一刻(MutationObserver 回调,还没绘制)就同步插入,
    // 不再等它滚进可视区才插——原来滚动时译文在眼皮底下插进去、气泡变高、列表被顶一下,就是"不跟手"的手感来源。没缓存(要联网)的仍等进可视区。
    try {
      var _sig0 = _msgSig(msgEl);
      if (_sig0 && msgTrCache[_sig0]) { var _t0 = ''; try { _t0 = getMsgText(msgEl); } catch (e) {} if (!_badTr(_t0, msgTrCache[_sig0])) { addTranslation(msgEl, msgTrCache[_sig0]); msgEl.setAttribute('data-scrm-tr', 'done'); return; } }
      var _t1 = ''; try { _t1 = getMsgText(msgEl); } catch (e) {}
      if (_t1 && needsTranslation(_t1, cfg.recvTo)) { var _ck1 = _ckey(_t1, cfg.recvTo); var _tv = translateCache[_ck1]; if (_tv && !_badTr(_t1, _tv)) { addTranslation(msgEl, _tv); _msgCachePut(_sig0, _tv); msgEl.setAttribute('data-scrm-tr', 'done'); return; } }
    } catch (e) {}
    try { _ensureVisObs().observe(msgEl); } catch(e){ _translateOneMsg(msgEl); }
  }

  // 点"查看更多/Read more"展开长消息 -> 之前只翻了截断的前半段, 现在清掉旧译文用完整正文重翻
  function _onReadMoreClick(e) {
    try {
      // 判断点的是不是"查看更多"按钮(它文字很短)
      var node = e.target, isMore = false;
      for (var i = 0; i < 5 && node; i++) {
        var tx = (node.textContent || '').trim();
        if (tx.length <= 10 && /(查看更多|閱讀更多|阅读更多|显示更多|Read more|read more|Read More|더 보기|もっと見る)/.test(tx)) { isMore = true; break; }
        node = node.parentElement;
      }
      if (!isMore) return;
      var row = e.target.closest && e.target.closest('[data-id]');
      var msg = row ? (row.querySelector('[data-pre-plain-text]') || row) : (e.target.closest && e.target.closest('[data-pre-plain-text]'));
      if (!msg) return;
      // 展开是异步的, 稍等文本加载完再重翻(150/450ms 两次, 兜底)
      var redo = function() {
        try {
          if (!document.contains(msg)) return;
          var host = _trHost(msg);
          var old = host && host.querySelector('.scrm-translated'); if (old) old.remove();
          msg.removeAttribute('data-scrm-tr');
          _translateOneMsg(msg);
        } catch(err){}
      };
      setTimeout(redo, 150);
      setTimeout(redo, 600);
    } catch(err){}
  }

  var activeRequests = 0;
  var MAX_CONCURRENT = 10;

  function flushQueue() {
    processTimer = null;
    if (!cfg.enabled || !cfg.recvEnabled) return;
    if (!pendingMsgs.length || activeRequests >= MAX_CONCURRENT) return;
    activeRequests++;

    var batch = pendingMsgs.splice(0, 50);
    var toTranslate = [];

    for (var i = 0; i < batch.length; i++) {
      var el = batch[i];
      if (_hasTr(el)) { el.setAttribute('data-scrm-tr', 'done'); continue; }
      if (!document.contains(el)) { el.removeAttribute('data-scrm-tr'); continue; }

      var text = getMsgText(el);
      // needsTranslation false → 标 done，不再入队
      if (!needsTranslation(text, cfg.recvTo)) { if (_emptyRetry(el, text)) continue; el.setAttribute('data-scrm-tr', 'done'); continue; }

      var cacheKey = _ckey(text, cfg.recvTo);
      if (translateCache[cacheKey]) {
        applyTr(el, translateCache[cacheKey]);
        el.setAttribute('data-scrm-tr', 'done'); // Fix: 缓存命中也要标 done
        continue;
      }
      toTranslate.push({ msgEl: el, text: text, from: cfg.recvFrom, to: cfg.recvTo });
    }

    if (!toTranslate.length) {
      activeRequests--;
      if (pendingMsgs.length) processTimer = setTimeout(flushQueue, flushDelay);
      return;
    }

    translateBatch(toTranslate.map(function(item) {
      return { text: item.text, from: item.from, to: item.to };
    })).then(function(results) {
      for (var i = 0; i < toTranslate.length; i++) {
        var tr = results[i];
        if (tr) {
          applyTr(toTranslate[i].msgEl, tr);
          _msgCachePut(toTranslate[i].msgEl.__scrmSig, tr);  // 回填快缓存, 下次滚到不闪
          toTranslate[i].msgEl.setAttribute('data-scrm-tr', 'done');
        } else {
          // Fix: 翻译失败清除 pending，允许下轮重试
          toTranslate[i].msgEl.removeAttribute('data-scrm-tr');
        }
      }
    }).finally(function() {
      activeRequests--; _lastBatchDone = Date.now();
      if (pendingMsgs.length) processTimer = setTimeout(flushQueue, flushDelay);
    });
  }
  // [PENDING-WATCHDOG 2026-09-15] 兜底:pending 超过 45s 没结果的消息重排;并发计数 60s 没有任何批次完成(请求全挂)就清零,防队列永久停摆
  var _lastBatchDone = Date.now();
  setInterval(function(){ try {
    if (!cfg.enabled || !cfg.recvEnabled) return;
    var now = Date.now(), n = 0;
    document.querySelectorAll('[data-scrm-tr="pending"]').forEach(function(el){ if (now - (el.__scrmPendAt || 0) > 45000) { el.removeAttribute('data-scrm-tr'); n++; queueMessage(el); } });
    if (activeRequests > 0 && now - _lastBatchDone > 60000) { activeRequests = 0; _lastBatchDone = now; if (pendingMsgs.length && !processTimer) processTimer = setTimeout(flushQueue, flushDelay); }
    if (n) { try { console.log('[SCRM] watchdog 重排 pending 超时消息', n); } catch(e){} }
  } catch(e){} }, 15000);

  // Observer 挂在 body
  function startObserver() {
    new MutationObserver(function(mutations) {
      for (var i = 0; i < mutations.length; i++) {
        var added = mutations[i].addedNodes;
        for (var j = 0; j < added.length; j++) {
          var node = added[j];
          if (node.nodeType !== 1) continue;
          if (node.matches && node.matches('[data-pre-plain-text]')) {
            queueMessage(node);
          } else if (node.querySelectorAll) {
            var msgs = node.querySelectorAll('[data-pre-plain-text]');
            for (var k = 0; k < msgs.length; k++) queueMessage(msgs[k]);
          }
        }
      }
    }).observe(document.body, { childList: true, subtree: true });
  }

  // 聊天切换检测 + 定期补漏 + 好友独立设置恢复
  var lastChatHeader = '';
  var scanCount = 0;
  function scanCurrentChat() {
    if (__scrolling) return;   // 滚动中不扫描(避免 getMsgText 等重活卡顿)
    var name = getCurrentChatName();
    var switched = (name !== lastChatHeader && name !== '');
    if (switched) {
      lastChatHeader = name;
      // 切会话: 断开可视区观察器, 释放旧会话所有(已被删除的)消息节点引用, 防止长时间累积泄漏。
      // 新会话的可见消息会在下面的扫描里重新登记观察。
      try { if (_visObs) { _visObs.disconnect(); _visObs = null; } } catch(e){}
      if (name) {
        var effectiveTo = getEffectiveSendTo();
        var hasPerChat = !!(perChatSettings[name] && perChatSettings[name].sendTo);
        
        // 通知主进程更新面板
        if (window.__scrmIPC && window.__scrmIPC.notifyChatSwitch) {
          window.__scrmIPC.notifyChatSwitch(name, {
            sendTo: effectiveTo,
            perChatSendEnabled: hasPerChat
          });
        }
        
        updateLangLabel();
        onInputChange();   // [TR-ALIGN-1002] 好友独立语言可能不同:预览按「语言|线路|原文」自己判断要不要重翻
      }
    }

    scanCount++;

    // 切换时多轮扫描（应对 WhatsApp 懒加载），每 5 次（~15秒）也补漏一次
    if (switched || scanCount % 5 === 0) {
      var doScan = function() {
        // Fix: 只扫 :not([data-scrm-tr])，不干扰其他并发 batch 的 pending 状态
        var msgs = document.querySelectorAll('[data-pre-plain-text]:not([data-scrm-tr])');
        for (var i = 0; i < msgs.length; i++) queueMessage(msgs[i]);
        // [WA-ALBUM-CAPTION] 2026-09-19 多图相册(九宫格 +N)的说明文字在有些版本里没有 data-pre-plain-text 包裹→从没进过翻译队列(客户截图:相册下英文原样)。兜底:带图的消息行里找有正文的 selectable-text,把它的容器标成正文元素再入队。
        try {
          var rows = document.querySelectorAll('#main [data-id]');
          for (var r = 0; r < rows.length; r++) { var row = rows[r];
            if (row.querySelector('[data-pre-plain-text]') || !row.querySelector('img')) continue;
            var sp = row.querySelector('span.selectable-text'); if (!sp || sp.closest('.scrm-translated')) continue;
            var tx = (sp.textContent || '').trim(); if (!tx || tx.length < 2 || /^[\d:\s]+$/.test(tx)) continue;
            var holder = sp.parentElement && sp.parentElement !== row ? sp.parentElement : sp;
            if (holder.getAttribute('data-pre-plain-text') == null) holder.setAttribute('data-pre-plain-text', '');
            queueMessage(holder);
          }
        } catch(e){}
      };
      if (switched) {
        // 极速多轮扫描
        requestAnimationFrame(doScan);
        setTimeout(doScan, 50);
        setTimeout(doScan, 150);
        setTimeout(doScan, 300);
        setTimeout(doScan, 600);
        setTimeout(doScan, 1000);
      } else {
        doScan();
      }
    }
  }

  // ===============================================
  // ===== 发送翻译预览 =====
  // ===============================================

  var previewBar = null;
  var previewText = '';
  var previewTimer2 = null;
  var previewGeneration = 0;
  /* [TR-ALIGN-1002] 预览按「目标语言|线路|原文」判断要不要重翻(照 TG [TG-PV-KEY]):原来去重只比原文 → 输入不动、只换语言/线路(含切到有独立语言的好友),预览停在旧语言;
     回车/按钮快路径原来只比 previewOriginal===原文 → 换了语言回车仍发旧语言。
     _lastPvKey=最近一次处理的键;_pvDoneKey/_pvOut=预览里已翻好的那条(复用前键必须完全一致);
     [TR-FIX-1002B] _pvCtx = 预览当前显示内容所属的「语言|线路」('=' 表示原样发送提示):语言或线路一变 → 立即回「翻译中...」;
     只是原文变了 → 保留上一次译文直到新结果到达(不每打一个字闪);结果回来时键已变就丢掉。回车/按钮只用 _pvCached(键完全一致)或现场翻译,不用预览上的旧译文。
     翻译失败 → 预览显示「翻译失败」,同一个键隔 2 秒由轮询自动重试(原来失败只清成「…」,去重键挡住,永远不再重试)。 */
  var _lastPvKey = '', _pvDoneKey = '', _pvOut = '', _pvFailKey = '', _pvFailAt = 0, _pvCtx = '';
  var _ASIS_NOTE = '  (已是目标语言,原样发送)';
  function _pvCtxNow() { return getEffectiveSendTo() + '|' + _route(); }
  function _pvKey(text) { return _pvCtxNow() + '|' + text; }
  function _pvCached(text) { return (_pvOut && _pvDoneKey === _pvKey(text)) ? _pvOut : ''; }
  var cachedInputBox = null;
  var inputBoxCheckTime = 0;
  var lastSentOriginal = null; // unused, kept for compat
  var pendingSentOriginals = []; // 队列：等待匹配的原文 [{original, translated, time}]

  // 全局默认 sendTo（第一次加载时的值，作为"没有独立设置"时的回退）
  var defaultSendTo = cfg.sendTo || 'en';

  // 持久缓存：消息 data-id → 原文（localStorage 持久化，key 是唯一消息ID）
  var sentOriginalMap = {}; // { msgId: originalText }
  try {
    var stored = localStorage.getItem('scrm_sent_originals_v2');
    if (stored) sentOriginalMap = JSON.parse(stored);
  } catch(e) {}

  function saveSentOriginals() {
    try {
      var keys = Object.keys(sentOriginalMap);
      if (keys.length > 500) {
        // 只保留最新 400 条
        var toRemove = keys.slice(0, keys.length - 400);
        for (var i = 0; i < toRemove.length; i++) delete sentOriginalMap[toRemove[i]];
      }
      localStorage.setItem('scrm_sent_originals_v2', JSON.stringify(sentOriginalMap));
    } catch(e) {}
  }

  // 从消息元素获取 WhatsApp 消息 ID
  function getMsgId(msgEl) {
    // 1. 自身或子元素有 data-id
    if (msgEl.dataset && msgEl.dataset.id) return msgEl.dataset.id;
    var inner = msgEl.querySelector('[data-id]');
    if (inner) return inner.dataset.id;
    // 2. 往上找祖先，直到 #main 或 body（WhatsApp row 可能在多层外）
    var p = msgEl.parentElement;
    while (p && p.id !== 'main' && p !== document.body) {
      if (p.dataset && p.dataset.id) return p.dataset.id;
      p = p.parentElement;
    }
    // 3. 用消息文本+时间戳做 fallback key（不持久但当次有效）
    var timeEl = msgEl.querySelector('[data-pre-plain-text]');
    var timeStr = timeEl ? timeEl.getAttribute('data-pre-plain-text') : '';
    var text = getMsgText(msgEl).trim().substring(0, 50);
    if (text) return '_txt_' + text + '_' + timeStr;
    return null;
  }

  // ===== 好友独立翻译设置 =====
  // { "John": { sendTo: "en" }, "田中太郎": { sendTo: "ja" } }
  var perChatSettings = {};
  try {
    var storedChat = localStorage.getItem('scrm_per_chat_settings');
    if (storedChat) perChatSettings = JSON.parse(storedChat);
  } catch(e) {}

  function savePerChatSettings() {
    try { localStorage.setItem('scrm_per_chat_settings', JSON.stringify(perChatSettings)); } catch(e) {}
  }

  function getCurrentChatName() {
    // WhatsApp header 有多个 span[title]，第一个是联系人名/群名
    // 但有时第一个是状态文本，需要过滤
    var spans = document.querySelectorAll('header span[title]');
    for (var i = 0; i < spans.length; i++) {
      var title = spans[i].getAttribute('title') || '';
      // 跳过状态文本
      if (title.indexOf('上线') !== -1) continue;
      if (title.indexOf('点击此处') !== -1) continue;
      if (title.indexOf('在线') !== -1 && title.length < 10) continue;
      if (title.indexOf('离线') !== -1 && title.length < 10) continue;
      if (title.match(/^\d{1,2}:\d{2}/)) continue; // 时间格式
      if (title === '业务账户' || title === '商务账户' || title === '企业账户' || title === '官方账户') continue; // 跳过账户类型标签(会和号码闪)
      if (title.length > 0) return title;
    }
    // 兜底：用第一个 span[title] 的 textContent
    var first = document.querySelector('header span[dir="auto"]');
    if (first) return first.textContent || '';
    return '';
  }
  // 稳定会话id:从消息 data-id 取会话 jid(<fromMe>_<jid>_<msgid>),不随 header/业务账户加载变化
  function getStableChatId() {
    // 优先:WhatsApp 内部 Store 的活动会话 jid(超稳,不随 header 变)
    try {
      var C = null; try { C = window.require && window.require('WAWebCollections'); } catch(e){}
      if (!C) { try { C = window.Store; } catch(e){} }
      if (C && C.Chat) {
        var a = null;
        try { a = C.Chat.getActive && C.Chat.getActive(); } catch(e){}
        if (!a) { try { var arr = C.Chat.getModelsArray ? C.Chat.getModelsArray() : (C.Chat.models || []); a = arr.find(function(c){ return c && c.active; }); } catch(e){} }
        if (a && a.id) { var jid = a.id._serialized || (a.id.toString && a.id.toString()) || ''; if (jid) return jid; }
      }
    } catch(e){}
    return getCurrentChatName();
  }
  window.__scrmWaChatId = getStableChatId;   // [BATCH1-02] 顶栏设备图标用同一个会话 jid 取法

  // 获取当前聊天的 sendTo
  function getEffectiveSendTo() {
    var name = getStableChatId();
    // 好友独立开启:用注入的按好友映射(优先,不被全局推送污染)
    try { var _m = (window.__scrmTrCfg && window.__scrmTrCfg.singleContactTranslate) || {}; if (name && _m[name] && _m[name].sendTo) return _m[name].sendTo; } catch(e){}
    // 否则:用当前全局语言(配置推来的 cfg.sendTo,始终是面板当前值)
    return (cfg && cfg.sendTo) || defaultSendTo;
  }
  // 发布当前联系人名给 dashboard 轮询(厂商 getActiveContactId 对自研适配器无效,照 Zalo 用发布法)
  setInterval(function(){ try{ window.__scrmActiveContactId = getStableChatId()||''; }catch(e){} }, 300);


  // 保存当前聊天的独立设置
  function setPerChatSendTo(lang) {
    var name = getCurrentChatName();
    if (!name) return;
    if (!perChatSettings[name]) perChatSettings[name] = {};
    perChatSettings[name].sendTo = lang;
    savePerChatSettings();
  }

  // [WA-CAPTION-SEND] 2026-09-19 发图片/相册时的"说明"输入框在媒体预览层里(不在 footer,无 data-tab),原来发送翻译只盯主输入框→说明文字原样中文发出去。预览层开着时它优先当作输入框,Enter/发送按钮走同一套翻译再发。
  function _captionEditor() { try {
    var eds = document.querySelectorAll('div[contenteditable="true"][role="textbox"]');
    for (var i = 0; i < eds.length; i++) { var e = eds[i]; if (e.closest('footer') || e.closest('#side') || e.closest('#pane-side') || e.getAttribute('data-tab') === '3') continue; if (e.offsetParent === null) continue; return e; }
  } catch(e){} return null; }
  function getInputBox() {
    // 缓存 500ms，减少 DOM 查询
    var now = Date.now();
    var _cap = _captionEditor(); if (_cap) { cachedInputBox = _cap; inputBoxCheckTime = now; return _cap; }
    if (cachedInputBox && document.contains(cachedInputBox) && now - inputBoxCheckTime < 500) {
      return cachedInputBox;
    }
    cachedInputBox = document.querySelector('div[contenteditable="true"][data-tab="10"]')
        || document.querySelector('div[contenteditable="true"][title="输入消息"]')
        || document.querySelector('div[contenteditable="true"][title="Type a message"]')
        || document.querySelector('footer div[contenteditable="true"]')
        || document.querySelector('div[contenteditable="true"][role="textbox"]');
    inputBoxCheckTime = now;
    return cachedInputBox;
  }

  function getInputText(inputBox) {
    if (!inputBox) return '';
    // 逐块读:Lexical 每个段落块=一行,块内<br>(Shift+Enter)转\n,块之间用【单】换行拼。
    // 不用 innerText —— 它在块级段落之间塞【双】换行(块的 margin),会把单行列表变成双倍行距。
    try {
      var blocks = inputBox.querySelectorAll(':scope > *');
      if (blocks && blocks.length) {
        var lines = [];
        for (var i=0;i<blocks.length;i++) {
          var clone = blocks[i].cloneNode(true);
          try { clone.querySelectorAll('br').forEach(function(br){ if(br.parentNode) br.parentNode.replaceChild(document.createTextNode('\n'), br); }); } catch(e){}
          lines.push(clone.textContent || '');
        }
        var jt = lines.join('\n');
        if (jt.replace(/\s/g,'')) return _lightNorm(jt);
      }
    } catch(e) {}
    var t = inputBox.innerText;
    if (t == null || t === '') return inputBox.textContent || '';
    return _lightNorm(t);

  }

  /* [TR-ALIGN-1002] 2026-10-02「要不要翻」唯一判断(预览/回车/发送按钮共用,照 TG [TG-ZH-SAME]):目标是中文、输入里除汉字外没有别的文字
     (只有汉字/数字/标点/emoji)→ 不用翻,原样发送;其他一律去翻(CEO 只跳过空文本)。
     原来回车/按钮用 containsChinese「不含汉字就放行原生发送」→ 预览显示了译文(目标英文打俄文/西语),回车发出去的却是原文,已删。 */
  function _sendAsIs(src) { var to = String(getEffectiveSendTo() || ''); return to.indexOf('zh') === 0 && !/\p{L}/u.test(String(src || '').replace(/\p{Script=Han}/gu, '')); }
  // 译文与原文是否相同(已是目标语言):签名 = 全部语言的字母数字(\p{L}\p{N}),不只认拉丁/中日韩
  function _sig(s) { return String(s == null ? '' : s).replace(/[^\p{L}\p{N}]+/gu, '').toLowerCase(); }
  function _sameSig(a, b) { return _sig(a) === _sig(b); }
  /* [TR-FIX-1002B]「这段文字能不能发出去」唯一判断:回车/按钮的翻译发送、快捷回复说明、自动回复、预览都只调它。
     目标语言不是中文/日文时,要发出的文字里只要还有汉字 = 翻译失败(或线路原样退回了中文)→ 拦下不发。
     原来「译文与原文签名相同 → 原样发送」的捷径绕过了这道检查(中文检测默认关),线路把中文原样退回时中文就直接发给客户了。 */
  function _safeToSend(text, to) { var t = String(text == null ? '' : text); if (!t.trim()) return false;
    if (/^(zh|ja|yue)/i.test(String(to == null ? getEffectiveSendTo() : to))) return true;
    return !/\p{Script=Han}/u.test(t); }
  var _TR_FAIL = '\u26a0\ufe0f 翻译失败,请重试';

  var warningTimer = null;
  function showChineseWarning(msg) {
    var existing = document.querySelector('.scrm-chinese-warning');
    if (existing) existing.remove();
    clearTimeout(warningTimer);

    var warn = document.createElement('div');
    warn.className = 'scrm-chinese-warning';
    warn.style.cssText = 'position:fixed;bottom:120px;left:50%;transform:translateX(-50%);background:#ff4444;color:#fff;padding:8px 16px;border-radius:8px;font-size:13px;z-index:9999;box-shadow:0 2px 8px rgba(0,0,0,0.3);animation:scrm-shake 0.3s;';
    warn.textContent = msg;
    document.body.appendChild(warn);

    // 加抖动动画
    if (!document.querySelector('#scrm-shake-style')) {
      var style = document.createElement('style');
      style.id = 'scrm-shake-style';
      style.textContent = '@keyframes scrm-shake{0%,100%{transform:translateX(-50%)}25%{transform:translateX(calc(-50% - 5px))}75%{transform:translateX(calc(-50% + 5px))}}';
      document.head.appendChild(style);
    }

    warningTimer = setTimeout(function() { warn.remove(); }, 3000);
  }

  // ===== 语言标签（显示当前聊天的翻译语言）=====
  var langLabel = null;
  var langMap = {
    'en': '🇬🇧 English', 'zh-CN': '🇨🇳 中文', 'zh-TW': '🇹🇼 繁體中文',
    'ja': '🇯🇵 日本語', 'ko': '🇰🇷 한국어', 'vi': '🇻🇳 Tiếng Việt',
    'th': '🇹🇭 ไทย', 'ar': '🇸🇦 العربية', 'es': '🇪🇸 Español',
    'pt': '🇵🇹 Português', 'fr': '🇫🇷 Français', 'de': '🇩🇪 Deutsch',
    'ru': '🇷🇺 Русский', 'id': '🇮🇩 Indonesia', 'ms': '🇲🇾 Melayu'
  };

  function createLangLabel() {
    if (langLabel && document.contains(langLabel)) return langLabel;
    langLabel = document.createElement('div');
    langLabel.className = 'scrm-lang-label';
    langLabel.style.cssText = 'display:none;position:absolute;top:-22px;right:12px;background:#12b76a;color:#fff;font-size:11px;padding:2px 8px;border-radius:10px;z-index:101;white-space:nowrap;pointer-events:none;opacity:0.9;';
    return langLabel;
  }

  function updateLangLabel() {
    // 已按需求移除输入框上的语言标签(🇬🇧 English 悬浮标签)
    if (langLabel) { langLabel.style.display = 'none'; if (langLabel.parentElement) langLabel.parentElement.removeChild(langLabel); }
    var stray = document.querySelector('.scrm-lang-label');
    if (stray && stray.parentElement) stray.parentElement.removeChild(stray);
  }

  /* 配置有两份:__scrm_translate 由主进程/海王通道写(没有 routeName),__scrmTrCfg 由面板 exec 写(有 routeName、线路最新)—— 读名字和线路都合起来看(面板的优先),与其它平台的 _cfg() 一致 */
  function _waCfg(){ try{ return Object.assign({}, window.__scrm_translate||{}, window.__scrmTrCfg||{}); }catch(e){ return {}; } }
  function _waRouteName(){ return _trRouteName(_waCfg()); }   // [TR-ROUTE-CORE] 显示名由面板下发
  function _waUpdateLabel(){ try{ var want=(_waRouteName()||'')+'实时翻译'; var els=document.querySelectorAll('.scrm-preview-label'); for(var i=0;i<els.length;i++){ if(els[i].textContent!==want) els[i].textContent=want; } }catch(e){} }
  setInterval(_waUpdateLabel, 800);
  function _waPvStyle(){ if(document.getElementById('__scrmWaPvStyle')||!document.head) return; var st=document.createElement('style'); st.id='__scrmWaPvStyle'; st.textContent=_pvCoreCss('scrm-send-preview',{mode:'fuse',fuseMargin:'0 12px',maxHeight:'34vh',lblSel:'.scrm-preview-label',bodySel:'.scrm-preview-content',backSel:'.scrm-preview-back'}); document.head.appendChild(st); }
  function createPreviewBar() {
    var bar = document.createElement('div');
    bar.className = 'scrm-send-preview';
    _waPvStyle();   /* [PV-CORE] 卡片样式:fuse 模式,下沿不圆、不留缝,直接坐在白色输入条上(flattenPill 把输入条顶部两角抹平) */
    var labelRow = document.createElement('div');
    labelRow.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:2px;';
    var label = document.createElement('span');
    label.className = 'scrm-preview-label';
    label.textContent = (_waRouteName()||'')+'实时翻译';
    var latency = document.createElement('span');
    latency.className = 'scrm-preview-latency';
    latency.style.cssText = 'font-size:10px;color:#999;';
    latency.textContent = '';
    labelRow.appendChild(label);
    labelRow.appendChild(latency);
    var content = document.createElement('div');
    content.className = 'scrm-preview-content'; content.textContent = '\u2026'; // [PV-IDLE-DOTS]
    bar.appendChild(labelRow);
    bar.appendChild(content);
    return bar;
  }
  // 把白色输入胶囊顶部两角抹平, 和预览卡片无缝相接(卡片下沿方角、无下边框;WhatsApp 的白条和卡片之间留 6px 空隙会看成一条缝 —— 用户截图)
  // 关键: 关掉 border-radius 过渡动画(否则圆角是"慢慢"变平的 -> 缺口慢慢补上), 且这一路上所有白色圆角容器都抹平
  function flattenPill() {
    try {
      var inp = getInputBox();
      var el = inp;
      var hops = 0;
      while (el && el !== document.body && hops < 12) {
        hops++;
        var cs = getComputedStyle(el);
        if (cs.backgroundColor !== 'rgba(0, 0, 0, 0)' && parseInt(cs.borderTopLeftRadius) > 8) {   // 有底色且圆角 >8 的容器都抹(原来只认纯白,深色主题的输入条不抹 → 卡片压在圆角上出缝)
          // 先禁用过渡, 让圆角瞬间变平(而非动画)
          if (el.style.transition !== 'none') el.style.transition = 'none';
          if (el.style.borderTopLeftRadius !== '0px') el.style.borderTopLeftRadius = '0px';
          if (el.style.borderTopRightRadius !== '0px') el.style.borderTopRightRadius = '0px';
          // 不 return: 继续往上, 把嵌套的多层白色圆角容器也一起抹平
        }
        el = el.parentElement;
      }
    } catch (e) {}
  }

  // 监听 footer 重渲染, 输入框一被重建就立刻抹平(不靠轮询, 消除切会话时的缺口)
  // 切会话时 WhatsApp 会替换整个 footer 节点, 所以要检测目标失效后重新挂载
  var _pillObserver = null;
  var _pillTarget = null;
  function watchPillFusion() {
    try {
      var inp = getInputBox();
      var footer = inp && inp.closest ? inp.closest('footer') : null;
      var target = footer || (inp && inp.parentElement) || null;
      if (!target) return;
      // 目标没变且仍在 DOM 中 -> 无需重挂
      if (_pillObserver && _pillTarget === target && document.contains(target)) return;
      if (_pillObserver) { try { _pillObserver.disconnect(); } catch (e) {} }
      _pillTarget = target;
      _pillObserver = new MutationObserver(function() { flattenPill(); });
      _pillObserver.observe(target, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class'] });
      flattenPill();
    } catch (e) {}
  }

  function ensurePreviewBar() {
    // 已在 DOM 中 -> 直接用
    if (previewBar && document.contains(previewBar)) { flattenPill(); return true; }
    var inputBox = getInputBox();
    if (!inputBox) return false;
    // 复用同一个元素(保留"谷歌实时翻译"标题与已有内容, 切会话时只是重新挂载, 不重建 -> 不闪空)
    if (!previewBar) previewBar = createPreviewBar();
    // 只清理"其它"残留(不是我们当前这个)
    document.querySelectorAll('.scrm-send-preview').forEach(function(el) { if (el !== previewBar) el.remove(); });

    // 找 footer
    var footer = inputBox.closest('footer');
    if (footer) {
      footer.insertBefore(previewBar, footer.firstChild);
      flattenPill();
      return true;
    }

    // 兜底：往上找底部容器
    var el = inputBox;
    for (var i = 0; i < 10; i++) {
      var p = el.parentElement;
      if (!p) break;
      if (p.getBoundingClientRect().bottom > window.innerHeight - 80) {
        p.insertBefore(previewBar, el);
        flattenPill();
        return true;
      }
      el = p;
    }
    return false;
  }

  var _backTr=_backTrCore({ backCls:'scrm-preview-back', on:function(){ return !!_waCfg().backTranslate; }, sendLang:getEffectiveSendTo, backLang:function(){ return String(cfg.recvTo||'zh-CN'); }, translate:function(t,bl,to){ return translateBatch([{ text:t, from:to, to:bl }]).then(function(r){ return r&&r[0]; }); } });   /* [BACK-TR] 回译校对:下面写预览正文的地方调 _backTr.update(正文元素, 译文),行为全在上面的 [BACK-TR-CORE] */
  function showPreview(text, ms, isTr) {   /* isTr:这次写的是真译文(回译只认它) */
    previewText = text;
    if (!ensurePreviewBar()) return;
    var content = previewBar.querySelector('.scrm-preview-content');
    if (content) content.textContent = text;
    _backTr.update(content || null, isTr ? text : '');
    var latencyEl = previewBar.querySelector('.scrm-preview-latency');
    if (latencyEl) {
      if (ms && ms > 0) {
        latencyEl.textContent = ms + ' ms';
      } else if (text === '翻译中...') {
        latencyEl.textContent = '';
      } else if (text) {
        latencyEl.textContent = '缓存';
      }
    }
    previewBar.style.display = 'block'; // 常驻: 永远显示预览框
  }

  function hidePreview() {
    previewText = '';
    // 常驻: 不隐藏预览框, 只清空里面的译文
    if (previewBar) { previewBar.style.display = 'block'; var _c = previewBar.querySelector('.scrm-preview-content'); if (_c) _c.textContent = '\u2026'; _backTr.update(_c || null, ''); /* [PV-IDLE-DOTS] 2026-09-16 空输入常驻占位…(对齐 FB/IG/Messenger,用户要求全平台一致) */ var _l = previewBar.querySelector('.scrm-preview-latency'); if (_l) _l.textContent = ''; }
  }
  // 安全网:输入框空了就清预览(发送/清空后可能没触发 input 事件导致残留)
  setInterval(function(){ try{ var _ib=getInputBox(); var _t=_ib?getInputText(_ib):''; if((!_t||!_t.trim()) && previewText){ hidePreview(); } }catch(e){} }, 400);

  function onInputChange() {
    if (!cfg.enabled || !cfg.sendEnabled || !cfg.previewEnabled) { _lastPvKey = ''; _pvCtx = ''; hidePreview(); return; }
    var text = String(getInputText(getInputBox()) || '').trim();
    if (!text) { _lastPvKey = ''; _pvDoneKey = ''; _pvOut = ''; _pvFailKey = ''; _pvCtx = ''; hidePreview(); return; }  // 清空
    var to = getEffectiveSendTo(), ctx = _pvCtxNow(), key = ctx + '|' + text;
    if (key === _lastPvKey && (key !== _pvFailKey || Date.now() - _pvFailAt < 2000)) return;   // 原文/语言/线路都没变 → 不动(失败的隔 2 秒重试)
    _lastPvKey = key; _pvFailKey = '';
    clearTimeout(previewTimer2);
    var gen = ++previewGeneration;
    if (_sendAsIs(text)) { _pvCtx = '='; showPreview(text + _ASIS_NOTE); return; }   // 已是目标语言:原样发送(不联网)
    // [SAME-LANG] 译文与原文签名相同(输入的已是目标语言,如给法语客户直接打法语)→ 显示原文并标注,回车原样发
    // [TR-FIX-1002B] 译文过不了 _safeToSend(目标非中日却仍含汉字)= 翻译失败:预览如实显示失败并重试,与回车实际会拦下一致
    var show = function(tr, ms) { _pvCtx = ctx;
      if (!tr || !_safeToSend(tr, to)) { _pvDoneKey = ''; _pvOut = ''; _pvFailKey = key; _pvFailAt = Date.now(); showPreview(_TR_FAIL); return; }
      _pvDoneKey = key; _pvOut = tr; var asIs = _sameSig(tr, text); showPreview(asIs ? text + _ASIS_NOTE : tr, ms, !asIs); };
    // 缓存命中 → 即时显示(跳过脏缓存:原文单行却带换行=Gemini逐词坏值,清掉往下重翻)
    var cacheKey = _ckey(text, to);
    if (translateCache[cacheKey] && _badTr(text, translateCache[cacheKey])) { try{ delete translateCache[cacheKey]; }catch(e){} }
    if (translateCache[cacheKey]) { show(translateCache[cacheKey]); return; }
    if (_pvCtx !== ctx) { _pvCtx = ''; showPreview('翻译中...'); }   // 换了语言/线路:旧语言的译文不挂着;只改原文则保留上一次译文直到新结果到
    // 防抖 100ms（Opt: 250→100ms）
    previewTimer2 = setTimeout(function() {
      var t0 = Date.now();
      translateBatch([{ text: text, from: cfg.sendFrom, to: to }]).then(function(results) {
        if (gen !== previewGeneration || _lastPvKey !== key) return;   // 键变了 → 丢掉旧结果
        show(results[0], lastTranslateMs || (Date.now() - t0));
      });
    }, 100);
  }

  // 替换输入框内容 — 通过 Electron 原生 API（最可靠）
  function _waLexEditor(inputBox) {
    try {
      var el = document.querySelector('#main .lexical-rich-text-input>div')
            || document.querySelector('.lexical-rich-text-input>div');
      if (el && el.__lexicalEditor) return el.__lexicalEditor;
    } catch(e) {}
    var pr = inputBox;
    for (var k=0; k<5 && pr; k++) { if (pr.__lexicalEditor) return pr.__lexicalEditor; pr = pr.parentElement; }
    return null;
  }
  function setInputText(inputBox, text) {
    if (!inputBox) return Promise.resolve(false);
    text = _lightNorm(text);   // 发送前轻归一(保留换行)
    // 首选:直接操作 Lexical(海王法,setEditorState 整个替换,不追加、不靠合成事件)
    try {
      var editor = _waLexEditor(inputBox);
      if (editor && editor.parseEditorState && editor.setEditorState) {
        var _ls = String(text).split('\n'); var kids = [];
        _ls.forEach(function(ln, ix){ if(ix>0) kids.push({ type:"linebreak", version:1 }); if(ln) kids.push({ detail:0, format:0, mode:"normal", style:"", text:ln, type:"text", version:1 }); });
        var st = editor.parseEditorState({ root:{ children:[{ children:kids, direction:"ltr", format:"", indent:0, type:"paragraph", version:1 }], direction:"ltr", format:"", indent:0, type:"root", version:1 } });
        editor.setEditorState(st);
        try { inputBox.focus(); } catch(e){}
        try { inputBox.dispatchEvent(new Event('input', { bubbles:true })); } catch(e){}
        return Promise.resolve(true);
      }
    } catch(e) {}
    // 兜底:旧的全选+paste([NO-APPEND] 先 selectAll+delete 真清空再贴,合成 Ctrl+A 选不中 Lexical 时 paste 会变追加→译文叠 N 份被发出去)
    inputBox.focus();
    try { document.execCommand('selectAll', false, null); document.execCommand('delete', false, null); } catch(e) {}
    try {
      var sel = window.getSelection(); var r = document.createRange();
      r.selectNodeContents(inputBox); sel.removeAllRanges(); sel.addRange(r);
      inputBox.dispatchEvent(new KeyboardEvent('keydown', { key:'a', code:'KeyA', keyCode:65, which:65, ctrlKey:true, bubbles:true, cancelable:true }));
      var dt = new DataTransfer(); dt.setData('text/plain', text);
      inputBox.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles:true, cancelable:true }));
    } catch(e) {
      try { document.execCommand('selectAll', false, null); document.execCommand('insertText', false, text); } catch(_){}
    }
    return Promise.resolve(true);
  }

  var __scrmSending = false; // 防止 simulateSend 的 Enter 被拦截器二次捕获
  var __scrmBusy = false, __scrmBusyTimer = null; // 翻译发送防重入锁, 杜绝连环发送
  var __scrmClicking = false; // 标记"我们自己触发的发送按钮点击", 供点击拦截器放行
  var __lastEnter = { text: '', time: 0 }; // Enter/按钮 去重, 防双触发发两遍
  function simulateSend(inputBox) {
    __scrmSending = true;
    var opts = { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true };
    inputBox.dispatchEvent(new KeyboardEvent('keydown', opts));
    inputBox.dispatchEvent(new KeyboardEvent('keyup', opts));
    setTimeout(function() { __scrmSending = false; }, 200);
  }

  function setupSendTranslate() {
    // 事件驱动：input/compositionend 立即触发，消除 300ms 轮询延迟
    var boundInputBox = null;
    function attachInputEvents(inputBox) {
      if (!inputBox || inputBox === boundInputBox) return;
      boundInputBox = inputBox;
      inputBox.addEventListener('input', onInputChange, false);
      inputBox.addEventListener('compositionend', onInputChange, false);
    }

    // 兜底轮询（500ms，处理输入框晚加载 & 切换）
    // [TR-ALIGN-1002] 每次都进 onInputChange:原文/目标语言/线路任一变了它自己判断重翻(原来只在文字变化时才进,换语言靠 watchConfigChanges 且被切会话保护期吞掉)
    setInterval(function() {
      var inputBox = getInputBox();
      if (!inputBox) return;
      attachInputEvents(inputBox);
      onInputChange();
    }, 500);

    // 拦截 Enter
    document.addEventListener('keydown', function(e) {
      if (__scrmSending) return; // simulateSend 触发的，放行
      if (!cfg.enabled || !cfg.sendEnabled) return;
      var inputBox = getInputBox();
      if (!inputBox || (e.target !== inputBox && !inputBox.contains(e.target))) return;

      // Ctrl+F → 发原文
      if (e.ctrlKey && e.key === 'f') { hidePreview(); return; }

      // Ctrl+T → 填入翻译不发送
      if (e.ctrlKey && e.key === 't') {
        e.preventDefault(); e.stopPropagation();
        var t = _pvCached(getInputText(inputBox).trim());   // [TR-ALIGN-1002] 只用与当前「语言|线路|原文」对得上的译文(不把预览里的标注写进去)
        if (t) { hidePreview(); setInputText(inputBox, t); }
        return;
      }

      // Enter → 翻译后发送（安全版：替换后回读校验，确认无误才发；替换失败宁可不发也不发错）
      if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey) {
        // 防重入锁: 正在翻译发送中, 直接拦截, 杜绝连环发送
        if (__scrmBusy) { e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); return; }
        var currentText = getInputText(inputBox).trim();
        if (!currentText) return;
        // [TR-ALIGN-1002] 已是目标语言(_sendAsIs,与预览同一判断)→ 放行原生发送;其他都翻译后发
        if (_sendAsIs(currentText)) return;
        // 去重: 1.5秒内相同文本的 Enter 只处理一次(防止 keydown 双触发导致发两遍)
        var _now = Date.now();
        if (currentText === __lastEnter.text && _now - __lastEnter.time < 1500) { e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); return; }
        __lastEnter = { text: currentText, time: _now };
        e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
        translateAndSend(inputBox, currentText, function(){ simulateSend(inputBox); });
        return;
      }
    }, true);

    // 拦截"发送按钮"点击(和 Enter 同样逻辑) —— 之前只拦 Enter, 点发送按钮会绕过翻译直接发原文
    document.addEventListener('click', function(e) {
      if (__scrmClicking) return;            // 我们自己触发的点击, 放行
      if (!cfg.enabled || !cfg.sendEnabled) return;
      var sendBtn = findSendButton();
      if (!sendBtn) return;
      if (!(e.target === sendBtn || sendBtn.contains(e.target) || (e.target.closest && e.target.closest('button,[role="button"]') === sendBtn))) return;
      if (__scrmBusy) { e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); return; }   // [TR-FIX-1002B] 翻译发送进行中:先拦下,不把点击放给 WA
      var inputBox = getInputBox();
      if (!inputBox) return;
      var currentText = getInputText(inputBox).trim();
      if (!currentText || _sendAsIs(currentText)) return;   // [TR-ALIGN-1002] 已是目标语言 -> 放行原生发送
      var _now = Date.now();
      if (currentText === __lastEnter.text && _now - __lastEnter.time < 1500) { e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); return; }
      __lastEnter = { text: currentText, time: _now };
      e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
      translateAndSend(inputBox, currentText, function(){
        var btn = findSendButton();
        if (btn) { __scrmClicking = true; btn.click(); setTimeout(function(){ __scrmClicking = false; }, 250); }
      });
    }, true);
  }

  // 找 WhatsApp 的发送按钮
  function findSendButton() {
    try { if (_captionEditor()) { var ic = Array.prototype.find.call(document.querySelectorAll('[data-icon="wds-ic-send-filled"],[data-icon="send"]'), function(x){ return !x.closest('footer') && x.offsetParent !== null; }); if (ic) return ic.closest('button,[role="button"]') || ic.parentElement; } } catch(e){} // [WA-CAPTION-SEND] 媒体预览层的发送按钮
    return document.querySelector('footer button[aria-label="发送"], footer button[aria-label="Send"]')
        || (function(){ var ic = document.querySelector('footer [data-icon="send"], footer [data-icon="wds-ic-send-filled"], footer [data-testid="send"]'); return ic ? (ic.closest('button,[role="button"]') || ic) : null; })();
  }

  // 翻译 -> 替换输入框 -> 回读校验 -> 确认是译文才真正发送(sendFn); 校验失败绝不发送。
  // 关键: Enter 和发送按钮都已 preventDefault 拦住原生发送, 所以这里不再和 WhatsApp 抢时间(无竞态), 从容替换。
  function translateAndSend(inputBox, currentText, sendFn) {
    if (__scrmBusy) return;
    __scrmBusy = true;
    clearTimeout(__scrmBusyTimer);
    var release = function(){ __scrmBusy = false; };
    __scrmBusyTimer = setTimeout(release, 4000);
    var effTo = getEffectiveSendTo();
    var doReplace = function(textToSend) {
      // [TR-FIX-1002B] 没有译文/译文过不了 _safeToSend → 提示失败,不发(签名相同的原样发送捷径也必须先过这道)
      if (!_safeToSend(textToSend, effTo)) { _lastPvKey = ''; showPreview(_TR_FAIL); release(); return; }
      if (_sameSig(textToSend, currentText)) { // [SAME-LANG] 输入的已是目标语言(签名相同,预览显示「原文+已是目标语言」)→直接原样发送 [TR-ALIGN-1002] 原来逐字相等才算,大小写/标点差一点就把"译文"发出去
        hidePreview(); pendingSentOriginals.push({ original: currentText, translated: textToSend, time: Date.now() }); sendFn(); setTimeout(release, 500); return;
      }
      hidePreview();
      setInputText(inputBox, textToSend).then(function() {
        setTimeout(function() {
          var dom = getInputText(inputBox).trim();
          if (dom === textToSend.trim()) {
            pendingSentOriginals.push({ original: currentText, translated: textToSend, time: Date.now() });
            sendFn();
          }
          // 校验失败 -> 不发送(输入框可能是半成品), 绝不发错/发原文
          setTimeout(release, 500);
        }, 180);
      });
    };
    // 快路径: 预览已是当前文本的译文 [TR-ALIGN-1002] 且语言、线路都对得上(否则当没有,现场按当前语言翻)
    var _pv = _pvCached(currentText);
    if (_pv) { doReplace(_pv); return; }
    // 慢路径: 现场翻译
    showPreview('翻译中...');
    translateBatch([{ text: currentText, from: cfg.sendFrom, to: effTo }]).then(function(results) {
      doReplace((results && results[0]) ? results[0] : '');
    }).catch(function() { release(); });
  }

  /* [QUICK-SEND] 2026-09-24 快捷回复发送入口(面板经 exec 调用,各平台适配器实现同一接口 window.__scrmQuick):
     fill(text)        只填进输入框不发(CEO「输入框展示」)
     send(text, tr)    tr=false 原文直接发;tr=true 按当前好友的发送语言/线路翻译后发(与回车翻译发送同一个 translateAndSend,含中文检测拦截)
     sendItem(item, tr, origin)  图片2/音频3/视频4/图文5(图+说明)/名片6:
        媒体 = 从我们服务器下载文件 → 粘贴给 WhatsApp 自己的发送预览(和业务员 Ctrl+V 贴图同一条路)→ 填说明(图文;tr 时先按好友语言翻译)→ 点预览里的发送;
        名片 = WhatsApp 自己的「发送联系人」(WAWebSendContactsAction),用它的 vcardFromContactModel 按 昵称+号码 生成标准名片。
     都返回 Promise<'ok'|原因>:文字以"输入框被清空"为准;媒体/名片以"聊天里多出一条对应类型的消息"为准(绝不假报成功)。一条发完才返回,面板按顺序逐条发。 */
  (function(){
    var busy = false;
    function run(job){ busy = true; return Promise.resolve().then(job).then(function(r){ busy = false; return r; }, function(e){ busy = false; return 'error:' + (e && e.message); }); } // busy 唯一进出口:任何同步异常也复位(否则这个窗口以后一直"上一条还在发送")
    function waitSent(ib, ms) { return new Promise(function(res){ var t0 = Date.now(); (function chk(){ if (!__scrmBusy && !getInputText(ib).trim()) return res('ok'); if (Date.now() - t0 > ms) return res(__scrmBusy ? 'timeout' : 'notsent'); setTimeout(chk, 120); })(); }); }
    function prep(text) { // 文字写入前的三道门(send/fill 共用):没输入框 noinput;开着发送预览 previewopen(这时 getInputBox 返回的是预览里的说明框,文字会变成业务员那张图的说明并把图发出去);有业务员没发的草稿 notempty(不覆盖、不连草稿一起发)
      if (previewSendBtn()) return Promise.resolve({ err: 'previewopen' });
      var ib = getInputBox(); if (!ib) return Promise.resolve({ err: 'noinput' }); if (getInputText(ib).trim()) return Promise.resolve({ err: 'notempty' });
      return setInputText(ib, text).then(function(){ return new Promise(function(r){ setTimeout(function(){ r(getInputText(ib).trim() === _lightNorm(text).trim() ? { ib: ib } : { ib: ib, err: 'mismatch' }); }, 180); }); });
    }
    var W = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
    function footerBox() { return document.querySelector('footer div[contenteditable="true"]'); } // 聊天输入框本身(不是媒体预览里的说明框)
    function previewSendBtn() { var ic = Array.prototype.find.call(document.querySelectorAll('[data-icon="wds-ic-send-filled"],[data-icon="send"]'), function (x) { return !x.closest('footer') && x.offsetParent !== null; }); return ic ? (ic.closest('button,[role="button"]') || ic.parentElement) : null; }
    function activeChat() { try { return window.require('WAWebChatCollection').ChatCollection.getActive(); } catch (e) { return null; } }
    function lastMsg(chat) { try { var a = chat.msgs.getModelsArray(); return a[a.length - 1] || null; } catch (e) { return null; } }
    function waitNewMsg(chat, before, types, ms) { // 等聊天里出现一条新的、类型对得上的"我发出"的消息
      return new Promise(function (res) { var t0 = Date.now(); (function chk() { var m = lastMsg(chat); if (m && m !== before && m.id && m.id.fromMe && types.indexOf(m.type) >= 0) return res('ok'); if (Date.now() - t0 > ms) return res('notsent'); setTimeout(chk, 200); })(); });
    }
    function trCaption(text) { // 按当前好友的发送语言/线路翻译;中文检测开着且译文还含中文 → 不发(与回车翻译发送同一规则)
      var effTo = getEffectiveSendTo();
      return translateBatch([{ text: text, from: cfg.sendFrom, to: effTo }]).then(function (r) {
        var t = String((r && r[0]) || '').replace(/\s*\(已是目标语言,原样发送\)\s*$/, '').trim(); if (!t) return { err: 'trfail' };
        if (!_safeToSend(t, effTo)) return { err: 'trblocked' };   // [TR-FIX-1002B] 唯一判断
        return { text: t };
      }, function () { return { err: 'trfail' }; });
    }
    var MEDIA_TYPES = { 2: ['image'], 5: ['image'], 4: ['video', 'gif'], 3: ['audio', 'ptt', 'document'] };
    function sendMedia(item, tr, origin) {
      var url = item.data && item.data.url; if (!/^\/qrmedia\/\d+\/[0-9a-f]{64}\.[a-z0-9]+$/.test(String(url || ''))) return Promise.resolve('badurl');
      var ib = footerBox(); if (!ib) return Promise.resolve('noinput'); if (getInputText(ib).trim()) return Promise.resolve('notempty');
      if (previewSendBtn()) return Promise.resolve('previewopen'); // 已经开着一个发送预览(业务员自己在发图),不插手
      var chat = activeChat(); if (!chat) return Promise.resolve('noinput');
      var caption = item.type === 5 ? String(item.content || '').trim() : '';
      var capP = caption && tr ? trCaption(caption) : Promise.resolve({ text: caption });
      return capP.then(function (cap) {
        if (cap.err) return cap.err;
        return fetch(origin + url, { cache: 'force-cache' }).then(function (r) { if (!r.ok) throw new Error('http ' + r.status); return r.blob(); }).then(function (blob) {
          var name = url.split('/').pop(), file = new File([blob], name, { type: blob.type || 'application/octet-stream' });
          var dt = new DataTransfer(); dt.items.add(file); ib.focus();
          ib.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
          var t0 = Date.now();
          return (function waitPreview() { var b = previewSendBtn(); if (b) return Promise.resolve(b); if (Date.now() - t0 > 10000) return Promise.resolve(null); return W(200).then(waitPreview); })();
        }).then(function (btn) {
          if (!btn) return 'nopreview';
          var capBox = _captionEditor();
          var setCap = cap.text && capBox ? setInputText(capBox, cap.text).then(function () { return W(250); }) : Promise.resolve();
          return setCap.then(function () {
            if (cap.text && capBox && getInputText(capBox).trim() !== _lightNorm(cap.text).trim()) return 'mismatch'; // 说明没写对 → 不发(预览留着给业务员看)
            var before = lastMsg(chat); btn = previewSendBtn(); if (!btn) return 'nopreview';
            __scrmClicking = true; try { btn.click(); } finally { setTimeout(function () { __scrmClicking = false; }, 250); } // 我们自己点的发送:不让"发送按钮翻译拦截"再翻一遍
            return waitNewMsg(chat, before, MEDIA_TYPES[item.type], 15000).then(function (r) { // 消息出现后预览要关掉才算这一条完成(下一条要贴进干净的输入框)
              if (r !== 'ok') return r; var t1 = Date.now();
              return (function waitClosed() { if (!previewSendBtn()) return Promise.resolve('ok'); if (Date.now() - t1 > 8000) return Promise.resolve('previewopen'); return W(150).then(waitClosed); })();
            });
          });
        });
      }).catch(function (e) { return 'error:' + (e && e.message); });
    }
    var _sendContacts = null;
    function loadSendContacts() { if (!_sendContacts) _sendContacts = new Promise(function (ok, no) { var t = setTimeout(function () { _sendContacts = null; no(new Error('load timeout')); }, 10000); window.requireLazy(['WAWebSendContactsAction'], function (m) { clearTimeout(t); ok(m.default || m); }); }); return _sendContacts; }
    function sendCard(item, toChat) { // toChat:自动回复指定会话;不传=当前会话
      var d = item.data || {}, phone = String(d.phone || '').replace(/\D/g, ''); if (phone.length < 6) return Promise.resolve('badcard');
      var chat = toChat || activeChat(); if (!chat) return Promise.resolve('noinput');
      return loadSendContacts().then(function (send) {
        var wid = window.require('WAWebWidFactory').createUserWidOrThrow(phone + '@c.us');
        var contact = { id: wid, name: String(d.name || '').trim() || '+' + phone, shortName: '', pushname: '', isMe: false, isBusiness: false }; // 只用来生成名片内容(号码可以不在通讯录里)
        var before = lastMsg(chat);
        return Promise.resolve(send({ chat: chat, contacts: [contact], options: [{ includePhoneNumber: true, includeUsername: false }] })).then(function () { return waitNewMsg(chat, before, ['vcard'], 8000); });
      }).catch(function (e) { return 'error:' + (e && e.message); });
    }
    window.__scrmWaSendCard = function (item, chat) { return sendCard(item, chat); }; // [AUTO-REPLY] 引擎发名片走同一份
    window.__scrmQuick = {
      v: 2,
      sendItem: function (item, tr, origin) {
        if (!item || !item.type) return Promise.resolve('empty');
        if (item.type === 1) return this.send(item.content, tr);
        if (busy || __scrmBusy) return Promise.resolve('busy');
        return run(function(){ return item.type === 6 ? sendCard(item) : sendMedia(item, tr, String(origin || '')); });
      },
      fill: function (text) { // 与 send 同一套门(prep):正在发送 busy、开着预览 previewopen、有草稿 notempty 都不动输入框;写进去的和要填的不一致 → 清掉回 mismatch
        if (busy || __scrmBusy) return Promise.resolve('busy');
        return Promise.resolve().then(function(){ return prep(String(text == null ? '' : text)); }).then(function (p) { if (p.err === 'mismatch') setInputText(p.ib, ''); return p.err || 'ok'; }).catch(function(e){ return 'error:' + (e && e.message); });
      },
      send: function (text, tr) {
        text = String(text || ''); if (!text.trim()) return Promise.resolve('empty');
        if (busy || __scrmBusy) return Promise.resolve('busy');
        return run(function(){ return prep(text).then(function (p) {
          if (p.err) { if (p.err === 'mismatch') setInputText(p.ib, ''); return p.err; } // 写进去的和要发的不一致(半成品)→ 清掉,不发
          if (tr) translateAndSend(p.ib, text.trim(), function(){ simulateSend(p.ib); });
          else simulateSend(p.ib);
          return waitSent(p.ib, tr ? 8000 : 3000);
        }); });
      }
    };
  })();

  /* [AUTO-REPLY] 2026-09-25 关键词自动回复/欢迎语 —— WhatsApp 绑定(引擎核心见下,与 /opt/scrm-api/auto-reply-core.js 逐字相同):
     新消息:自己挂 WAWebCollections.Msg 的 add 事件(与聊天备份的采集互不依赖),只报 isNewMsg 的对方私聊消息;消息 id 记在 localStorage(刷新页面不会把刚收过的再回一遍);
     发送:走 WA 内部 API,不要求会话打开、不动输入框 —— 文字 WAWebSendTextMsgChatAction.sendTextMsgToChat,媒体 WAWebPrepRawMedia.prepRawMedia → MediaPrep.sendToChat(带说明),名片复用快捷回复的 sendCard;
     翻译后发送:按该好友的发送语言(singleContactTranslate 按会话 jid)否则全局发送语言,中文检测规则与回车翻译发送一致。 */
  /* [AUTO-REPLY-CORE v1] 关键词自动回复/欢迎语 引擎核心 —— 唯一来源 /opt/scrm-api/auto-reply-core.js,各平台适配器里这一段必须与它逐字相同(test-auto-reply-core.mjs 检查)。
     在聊天页里跑(和 CEO 一样在 preload 层执行,不依赖面板开着):面板把该账号生效的整包(规则+开关+已欢迎名单,/api/app/ar/bundle)推进来 set(bundle),
     引擎监听平台"收到新消息"事件,命中就按规则排队发送;已欢迎/命中计数放在 take() 里由面板取走上报服务器。
     各平台只提供绑定 B(都接到适配器自己现成的函数):
       account()             本方账号 id(与面板推整包时的 account 一致;对不上就不处理,防止把 A 号的规则用到 B 号)
       onMessage(cb)         收到对方私聊新消息时回调 cb({ chatId, contact, text, ts, first })
                             只报真正新到的(不含打开会话加载的历史)、对方发的、私聊(群/频道/广播/官方号不报);first=这是该联系人在本会话里的第一条消息
       send(chatId, item, tr) 发一条回复内容到指定会话(不要求会话打开,走平台内部 API);tr=翻译后发送;Promise<'ok'|原因>;平台不支持的类型回 'nomedia'
     规则(同 CEO):自己发的/群聊不触发;先欢迎语(该联系人第一条消息 + 没欢迎过 → 多条欢迎语随机选一条,内容全部依次发),再关键词
       (半匹配=消息包含关键词、全匹配=完全一致,不分大小写;命中多条取最长词、同长随机;回复全部 or 随机一条);
       每条之间随机等 delay[min,max] 秒;同一联系人同一条关键词规则 COOL 秒内只回一次(防两边机器人互相刷);同一会话的回复串行,不同会话并行;
       整包过期(面板 STALE 分钟没推新的)也照用最后一份,不因面板卡住就停;bundle.at 变化才替换。 */
  function _scrmAutoReplyInstall(B){
    var COOL = 60000, MAX_QUEUE = 20, BOOT = Date.now();
    var st = { bundle: null, welcomed: {}, cool: {}, queues: {}, out: { welcomed: [], hits: {} }, log: [] };
    var W = function(ms){ return new Promise(function(r){ setTimeout(r, ms); }); };
    var rnd = function(){ return Math.random(); };
    function log(s){ st.log.push(new Date().toISOString().slice(11, 19) + ' ' + s); if (st.log.length > 50) st.log.shift(); }
    /* 已欢迎名单本机也留一份(按账号):面板还没来得及上报服务器就刷新/重开页面,不会把同一个人再欢迎一遍;服务器名单每次整包推来合并 */
    function wKey(){ return 'scrm_ar_welcomed_' + String((st.bundle && st.bundle.account) || B.account() || ''); }
    function loadWelcomed(){ try { var arr = JSON.parse(localStorage.getItem(wKey()) || '[]'); if (Array.isArray(arr)) arr.forEach(function(c){ st.welcomed[String(c)] = 1; }); } catch (e) {} }
    function saveWelcomed(){ try { var ks = Object.keys(st.welcomed); localStorage.setItem(wKey(), JSON.stringify(ks.slice(-5000))); } catch (e) {} }
    function norm(s){ return String(s == null ? '' : s).trim().toLowerCase(); }
    function len(s){ return Array.from(String(s || '').trim()).length; }
    function pickKeyword(text, rules){ // 与服务端 auto-reply-module.pickKeywordRule 同一语义
      var t = norm(text); if (!t) return null;
      var hit = rules.filter(function(r){ var w = norm(r.word); if (!w) return false; return Number(r.match_rule) === 2 ? t === w : t.indexOf(w) >= 0; });
      if (!hit.length) return null;
      var max = 0; hit.forEach(function(r){ max = Math.max(max, len(r.word)); }); var top = hit.filter(function(r){ return len(r.word) === max; });
      return top[Math.floor(rnd() * top.length)] || top[0];
    }
    function rulesOf(kind){ var b = st.bundle; if (!b) return []; return (b.rules || []).filter(function(r){ return Number(r.kind) === kind && Number(r.status) === 1 && Array.isArray(r.items) && r.items.length; }); }
    function on(kind){ var b = st.bundle; if (!b) return false; var k = kind === 1 ? 'keyword_on' : 'welcome_on'; return Number((b.global || {})[k]) !== 0 && Number((b.switch || {})[k]) !== 0; }
    function delayOf(r){ var a = Math.max(0, Number((r.delay || [])[0]) || 0), b = Math.max(a, Number((r.delay || [])[1]) || 0); return Math.round((a + rnd() * (b - a)) * 1000); }
    function handle(m){
      try {
        if (!m || !m.chatId || !st.bundle) return;
        if (st.bundle.account && B.account && String(B.account()) !== String(st.bundle.account)) return; // 整包不是这个号的
        if (m.ts && m.ts * 1000 < BOOT - 60000) return; // 启动前的旧消息(历史加载)不回
        var contact = String(m.contact || m.chatId), jobs = [];
        if (on(2) && m.first && !st.welcomed[contact]) {
          var ws = rulesOf(2); if (ws.length) { var w = ws[Math.floor(rnd() * ws.length)]; st.welcomed[contact] = 1; saveWelcomed(); st.out.welcomed.push(contact); jobs.push({ rule: w, items: w.items.slice() }); log('欢迎 ' + contact + ' ← ' + w.word); }
        }
        if (on(1) && m.text) {
          var r = pickKeyword(m.text, rulesOf(1));
          if (r) { var ck = contact + '|' + r.id, now = Date.now();
            if (!st.cool[ck] || now - st.cool[ck] > COOL) { st.cool[ck] = now; st.out.hits[r.id] = (st.out.hits[r.id] || 0) + 1; var items = Number(r.reply_type) === 2 ? [r.items[Math.floor(rnd() * r.items.length)]] : r.items.slice(); jobs.push({ rule: r, items: items }); log('关键词 ' + contact + ' ← ' + r.word); }
            else log('冷却中 ' + contact + ' ' + r.word); }
        }
        if (jobs.length) enqueue(m.chatId, jobs);
      } catch (e) { log('handle 出错 ' + (e && e.message)); }
    }
    function enqueue(chatId, jobs){ // 同一会话串行:上一条真正发完再发下一条(顺序不乱);队列上限防被刷
      var q = st.queues[chatId] || (st.queues[chatId] = { jobs: [], running: false });
      jobs.forEach(function(j){ if (q.jobs.length < MAX_QUEUE) q.jobs.push(j); });
      if (q.running) return; q.running = true;
      (function next(){
        var j = q.jobs.shift(); if (!j) { q.running = false; delete st.queues[chatId]; return; }
        var i = 0;
        (function item(){
          if (i >= j.items.length) return next();
          var it = j.items[i++];
          W(delayOf(j.rule)).then(function(){ return Promise.resolve(B.send(chatId, it, Number(j.rule.send_rule) === 2)); })
            .then(function(r){ if (r !== 'ok') log('发送 ' + chatId + ' 第 ' + i + ' 条:' + r); }, function(e){ log('发送异常 ' + (e && e.message)); })
            .then(item);
        })();
      })();
    }
    window.__scrmAutoReply = {
      v: 1,
      set: function(bundle){ if (!bundle || typeof bundle !== 'object') return 'bad'; if (st.bundle && bundle.at && st.bundle.at === bundle.at && bundle.account === st.bundle.account) return 'same';
        st.bundle = bundle; loadWelcomed(); (bundle.welcomed || []).forEach(function(c){ st.welcomed[String(c)] = 1; }); return 'ok'; },
      take: function(){ var o = st.out; st.out = { welcomed: [], hits: {} }; return o; }, // 面板取走上报(已欢迎/命中次数)
      state: function(){ return { v: 1, has: !!st.bundle, at: st.bundle && st.bundle.at, account: st.bundle && st.bundle.account, rules: st.bundle ? (st.bundle.rules || []).length : 0, welcomed: Object.keys(st.welcomed).length, queues: Object.keys(st.queues).length, log: st.log.slice(-10) }; },
      _handle: handle, _pick: pickKeyword // 回归用
    };
    B.onMessage(handle);
  }
  /* [/AUTO-REPLY-CORE] */
  ;(function(){ try{
    if (window.__scrmAutoReply) return;
    var SEEN_KEY = 'scrm_ar_seen_wa', seen = {}, seenList = [];
    try { seenList = JSON.parse(localStorage.getItem(SEEN_KEY) || '[]'); if (!Array.isArray(seenList)) seenList = []; seenList.forEach(function(k){ seen[k] = 1; }); } catch(e){ seenList = []; }
    function markSeen(mid){ seen[mid] = 1; seenList.push(mid); if (seenList.length > 500) { var d = seenList.splice(0, seenList.length - 500); d.forEach(function(k){ delete seen[k]; }); } try { localStorage.setItem(SEEN_KEY, JSON.stringify(seenList)); } catch(e){} }
    function me(){ try { var M = window.require('WAWebUserPrefsMeUser'); var u = M.getMaybeMePnUser && M.getMaybeMePnUser(); return u && u.user ? String(u.user).replace(/\D/g, '') : ''; } catch(e){ return ''; } }
    function chatOf(id){ try { return window.require('WAWebChatCollection').ChatCollection.get(id) || null; } catch(e){ return null; } }
    function contactOf(chat){ try { var ct = chat.contact || {}; var pn = (ct.phoneNumber && (ct.phoneNumber.user || String(ct.phoneNumber._serialized || '').split('@')[0])) || ''; if (!pn && chat.id && chat.id.server === 'c.us') pn = chat.id.user; return pn ? String(pn).replace(/\D/g, '') : String((chat.id && chat.id._serialized) || ''); } catch(e){ return ''; } }
    var handlers = [];
    function onAdd(m){ try {
      if (!m || !m.id || m.id.fromMe) return;
      var mid = String(m.id._serialized || m.id.id || ''); if (!mid || seen[mid]) return;
      if (m.isNewMsg !== true && !(Number(m.t) > Date.now() / 1000 - 60)) return; // 不是实时新到的(打开会话加载的历史)不回
      var rem = m.id.remote || m.from; if (!rem || !rem.server || rem.server === 'g.us' || rem.server === 'broadcast' || rem.server === 'newsletter' || rem.user === 'status') return;
      var type = String(m.type || ''); if (!/^(chat|image|video|audio|ptt|document|sticker|location|vcard|gif)$/.test(type)) return;
      var chat = chatOf(rem._serialized || rem) || m.chat || null; if (!chat || chat.isGroup) return;
      var name = (chat.contact && (chat.contact.name || chat.contact.pushname || chat.contact.verifiedName)) || chat.formattedTitle || ''; if (/^(facebook|instagram|whatsapp|meta|facebook business|whatsapp business|meta ai)$/i.test(String(name).trim())) return;
      markSeen(mid);
      var others = 0; try { chat.msgs.getModelsArray().forEach(function(x){ if (x !== m && String((x.id && x.id._serialized) || '') !== mid) others++; }); } catch(e){}
      var ev = { chatId: chat.id._serialized, contact: contactOf(chat), text: type === 'chat' ? String(m.body || '') : String(m.caption || ''), ts: Number(m.t) || 0, first: others === 0 };
      handlers.forEach(function(h){ try { h(ev); } catch(e){} });
    } catch(e){} }
    var hooked = false;
    function hook(){ if (hooked) return; try { var S = window.require && window.require('WAWebCollections'); if (!S || !S.Msg || typeof S.Msg.on !== 'function') return; hooked = true; S.Msg.on('add', onAdd); } catch(e){} }
    hook(); var ht = setInterval(function(){ if (hooked) return clearInterval(ht); hook(); }, 3000);
    function langFor(chat){ try { var m = (window.__scrmTrCfg && window.__scrmTrCfg.singleContactTranslate) || {}; var k = chat.id._serialized; if (m[k] && m[k].sendTo) return m[k].sendTo; } catch(e){} return (cfg && cfg.sendTo) || defaultSendTo; }
    function trText(text, chat){ var to = String(langFor(chat) || ''); if (/^zh/i.test(to) || to.toLowerCase() === 'yue') return Promise.resolve({ text: text });
      return translateBatch([{ text: text, from: cfg.sendFrom, to: to }]).then(function(r){ var t = String((r && r[0]) || '').replace(/\s*\(已是目标语言,原样发送\)\s*$/, '').trim(); if (!t) return { err: 'trfail' }; if (!_safeToSend(t, to)) return { err: 'trblocked' }; /* [TR-FIX-1002B] 唯一判断 */ return { text: t }; }, function(){ return { err: 'trfail' }; }); }
    var MIME = { jpg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', mp3: 'audio/mpeg', m4a: 'audio/mp4', aac: 'audio/aac', ogg: 'audio/ogg', wav: 'audio/wav', weba: 'audio/webm', mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime' }, ORIGIN = 'https://chm123.com';
    function prep(od, opt){ var R = window.require; var mp = R('WAWebPrepRawMedia').prepRawMedia(od, opt); return mp.waitForPrep().then(function(){ return mp; }); }
    function send(chatId, item, tr){
      var chat = chatOf(chatId); if (!chat) return Promise.resolve('nochat'); if (!item || !item.type) return Promise.resolve('empty'); var R = window.require;
      if (item.type === 1) { var text = String(item.content || ''); if (!text.trim()) return Promise.resolve('empty');
        return (tr ? trText(text, chat) : Promise.resolve({ text: text })).then(function(g){ if (g.err) return g.err; return Promise.resolve(R('WAWebSendTextMsgChatAction').sendTextMsgToChat(chat, g.text)).then(function(){ return 'ok'; }); }).catch(function(e){ return 'error:' + (e && e.message); }); }
      if (item.type === 6) return Promise.resolve(window.__scrmWaSendCard ? window.__scrmWaSendCard(item, chat) : 'nomedia');
      var url = String((item.data && item.data.url) || ''); if (!/^\/qrmedia\/\d+\/[0-9a-f]{64}\.[a-z0-9]+$/.test(url)) return Promise.resolve('badurl');
      var cap = item.type === 5 ? String(item.content || '').trim() : '';
      return (cap && tr ? trText(cap, chat) : Promise.resolve({ text: cap })).then(function(c){ if (c.err) return c.err;
        var ac = new AbortController(), tm = setTimeout(function(){ ac.abort(); }, 30000);
        return fetch(ORIGIN + url, { cache: 'force-cache', signal: ac.signal }).then(function(r){ clearTimeout(tm); if (!r.ok) throw new Error('http ' + r.status); return r.blob(); }).then(function(blob){
          var ext = url.slice(url.lastIndexOf('.') + 1), mime = MIME[ext] || blob.type || 'application/octet-stream';
          return R('WAWebMediaOpaqueData').createFromData(blob, mime).then(function(od){ return prep(od, item.type === 3 ? { isAudio: true } : {}).catch(function(){ return prep(od, { asDocument: true }); }); }); // 音频按语音/音频发,平台不认就按文件发
        }).then(function(mp){ return mp.sendToChat({ chat: chat, options: { caption: c.text || '' } }); }).then(function(){ return 'ok'; });
      }).catch(function(e){ return 'error:' + (e && e.message); });
    }
    _scrmAutoReplyInstall({ account: me, onMessage: function(cb){ handlers.push(cb); }, send: send });
    /* [MASS-SEND] 群发消息用同一套发送:面板调度器经 exec 调 window.__scrmSendTo —— listChats() 本账号会话列表(群发对象候选),send(chatId,item,tr) 发一条到指定会话(不要求打开),online() 是否已登录 */
    window.__scrmSendTo = {
      v: 1, account: me,
      online: function(){ try { return !!document.querySelector('#pane-side') && !!me(); } catch(e){ return false; } },
      listChats: function(){ try { var R = window.require; var arr = R('WAWebChatCollection').ChatCollection.getModelsArray(); var PP = null; try { PP = R('WAWebProfilePicThumbCollection').ProfilePicThumbCollection; } catch(e){}
        return arr.filter(function(c){ return c && c.id && c.id.server !== 'broadcast' && c.id.server !== 'newsletter' && c.id.user !== 'status' && c.id.user !== '0'; }).map(function(c){ var ct = c.contact || {}; var pn = (ct.phoneNumber && ct.phoneNumber.user) || (c.id.server === 'c.us' ? c.id.user : ''); var img = ''; try { var p = PP && PP.get(c.id); img = (p && (p.eurl || p.img)) || ''; } catch(e){}
          return { id: c.id._serialized, name: String(c.formattedTitle || c.name || (ct.pushname) || '').replace(/[\u200e\u200f\u202a-\u202e]/g, ''), phone: String(pn || '').replace(/\D/g, ''), group: !!c.isGroup, unread: Number(c.unreadCount) || 0, t: Number(c.t) || 0, archive: !!c.archive, avatar: img, lastFromMe: c.lastReceivedKey ? !!c.lastReceivedKey.fromMe : null, lastAck: (function(){ try { var ms = c.msgs && c.msgs.getModelsArray ? c.msgs.getModelsArray() : null; var last = ms && ms.length ? ms[ms.length - 1] : null; return last ? (Number(last.ack) || 0) : null; } catch(e){ return null; } })(), members: (c.isGroup && c.groupMetadata && c.groupMetadata.participants) ? (Number(c.groupMetadata.participants.length) || 0) : 0, pin: !!c.pin }; }); } catch(e){ return []; } }, // [CONTACTS] 联系人面板多用 lastFromMe + lastAck(最后一条的送达状态:1 已发 2 送达=灰双勾 3 已读=蓝双勾)、members(群成员数)、pin
      send: send
    };
  } catch(e){} })();

  /* [CONTACTS] 联系人面板(对齐 CEO contacts 组件)只读接口:面板经 exec 调 window.__scrmContacts —— list() 会话列表(同 __scrmSendTo.listChats,多带 lastFromMe/members/pin)、
     open(id) 在聊天页打开该会话(WAWebCmd.openChatAt)、active() 当前打开的会话 id、groupMembers(id|'') 群成员(id 空=当前打开的群)。不发消息、不改数据。 */
  (function(){ try {
    var R = function(){ return window.require; };
    var chatOf = function(id){ try { var C = R()('WAWebChatCollection').ChatCollection; return id ? (C.get(id) || null) : ((C.getActive && C.getActive()) || null); } catch(e){ return null; } };
    var clean = function(v){ return String(v || '').replace(/[\u200e\u200f\u202a-\u202e]/g, ''); };
    window.__scrmContacts = {
      v: 2, // v2=list 带 lastAck(面板按版本判断窗口是否旧版)
      list: function(){ return (window.__scrmSendTo && window.__scrmSendTo.listChats) ? window.__scrmSendTo.listChats() : []; },
      active: function(){ var c = chatOf(''); return c && c.id ? c.id._serialized : ''; },
      open: function(id){ try { var c = chatOf(id); if (!c) return 'nochat'; R()('WAWebCmd').Cmd.openChatAt({ chat: c }); return 'ok'; } catch(e){ return 'error:' + (e && e.message); } },
      groupMembers: function(id){ try { var c = chatOf(id); if (!c || !c.isGroup) return []; var md = c.groupMetadata, ps = md && md.participants ? md.participants.getModelsArray() : []; var owner = md && md.owner ? md.owner._serialized : '';
        return ps.map(function(p){ var ct = p.contact || {}; var pn = (ct.phoneNumber && ct.phoneNumber.user) || (p.id && p.id.server === 'c.us' ? p.id.user : ''); return { id: p.id._serialized, phone: String(pn || '').replace(/\D/g, ''), name: clean(ct.name || ct.pushname || ct.verifiedName || ''), admin: !!(p.isAdmin || p.isSuperAdmin), owner: !!(p.isSuperAdmin || (owner && p.id._serialized === owner)) }; }); } catch(e){ return []; } }
    };
  } catch(e){} })();
  /* [CONTACTS-END] */

  // ===== 配置变化监听 =====
  // 当右侧面板切换语言/开关时，立即响应
  var lastCfgSnapshot = JSON.stringify(cfg);
  function watchConfigChanges() {
    var current = JSON.stringify(cfg);
    if (current === lastCfgSnapshot) return;
    var oldCfg = JSON.parse(lastCfgSnapshot);
    lastCfgSnapshot = current;
    // [TR-ALIGN-1002] 删掉「切会话 1 秒保护期直接 return」:快照已更新又 return = 这期间的设置变化全被吞掉;预览重翻改由 onInputChange 按键自己判断,不再需要它

    // sendEnabled 关闭 → 隐藏预览
    if (!cfg.sendEnabled || !cfg.enabled) {
      hidePreview();
    }

    // sendTo 变了 → 更新语言标签(预览由 500ms 轮询的 onInputChange 按「语言|线路|原文」自己重翻)
    if (cfg.sendTo !== oldCfg.sendTo || cfg.sendFrom !== oldCfg.sendFrom) {
      updateLangLabel();
    }

    // recvTo 变了 → 重新翻译所有消息
    if (cfg.recvTo !== oldCfg.recvTo || cfg.recvFrom !== oldCfg.recvFrom) {
      // 清除所有翻译标注 + 复位 data-scrm-tr, 让消息用新语言重新翻译
      var translated = document.querySelectorAll('.scrm-translated');
      for (var i = 0; i < translated.length; i++) translated[i].remove();
      var msgs = document.querySelectorAll('[data-pre-plain-text]');
      for (var i = 0; i < msgs.length; i++) { msgs[i].removeAttribute('data-scrm-tr'); queueMessage(msgs[i]); }
    }

    // recvEnabled 关闭 → 移除所有接收翻译
    if (!cfg.recvEnabled || !cfg.enabled) {
      var translated = document.querySelectorAll('.scrm-translated');
      for (var i = 0; i < translated.length; i++) translated[i].remove();
    }
  }

  // ===============================================
  // ===== 初始化 =====
  // ===============================================

  function init() {
    // [INIT-ONCE 2026-09-08] WhatsApp 页面会重写 window.setInterval/clearInterval(JSScheduler 版),下面 readyCheck 用原生 setInterval 起、
    // 回调里的 clearInterval 已是 WA 版→清不掉→init 每秒重跑:每次 +3 个 document 捕获监听器 +1 个 MutationObserver,开几小时页面必卡死(Windows 尤甚)。
    if (window.__scrmWaInitDone) return; window.__scrmWaInitDone = true;
    console.log('[SCRM] init() 启动, cfg.enabled:', cfg.enabled, 'recvEnabled:', cfg.recvEnabled);
    // 监听滚动(scroll capture + wheel): 滚动时"我的代码全部休眠", 滚完再干活 -> 滚动本身丝滑不卡不跳
    document.addEventListener('scroll', _onScroll, true);
    document.addEventListener('wheel', _onScroll, { capture: true, passive: true });
    // 监听"查看更多/Read more"点击: 长消息被截断时只翻译了前半段, 展开后要重新翻译整条
    document.addEventListener('click', _onReadMoreClick, true);
    startObserver();
    setupSendTranslate();
    // 预览框常驻+输入框顶角抹平: 高频确保(切换聊天/DOM重建后立即恢复无缝融合); 滚动时跳过(强制布局会卡)
    setInterval(function(){ if (__scrolling) return; try{ ensurePreviewBar(); if (previewBar) previewBar.style.display = 'block'; watchPillFusion(); }catch(e){} }, 250);
    watchPillFusion();
    // [PREVIEW-SYNC] 2026-09-14:实测切会话 WhatsApp 会把 #main 换 2~3 次(56ms/219ms/~1.1s 各一次),原来只盯"初始化时 #main 的父级"且等 rAF,父级一换观察器就死,只剩 250ms 轮询→预览框每次切会话都空白 ~250ms 再闪出来(用户报"翻译框切换时空白然后闪一下")。
    // 改:盯 body 子树 childList(回调只做一次 contains 判断,极便宜),footer 一出现就在同一任务里同步把同一个预览框挂回去(MutationObserver 回调在绘制前执行→肉眼看不到空白)。实测切换后首帧即在位。
    (function(){
      try {
        var mo = new MutationObserver(function(){
          try {
            if (previewBar && document.contains(previewBar)) return;
            if (!document.querySelector('#main footer div[contenteditable="true"], footer div[contenteditable="true"]')) return;
            try { cachedInputBox = null; } catch(e0){} // 输入框刚重建,别用 500ms 缓存
            ensurePreviewBar(); if (previewBar) previewBar.style.display = 'block'; watchPillFusion();
          } catch(e){}
        });
        mo.observe(document.body, { childList: true, subtree: true });
      } catch(e){}
    })();
    // header 变化监听（比轮询更快检测聊天切换）
    var headerObserver = new MutationObserver(function() { scanCurrentChat(); });
    var checkHeader = setInterval(function() {
      var header = document.querySelector('header');
      if (header) {
        headerObserver.observe(header, { childList: true, subtree: true, characterData: true });
        clearInterval(checkHeader);
      }
    }, 500);
    // 兜底轮询（headerObserver 主导切换检测，轮询只做补漏）
    setInterval(scanCurrentChat, 500);
    // 每 500ms 检测配置变化（轻量）
    setInterval(watchConfigChanges, 500);
    // 首次扫描 + 多次扫描（WhatsApp 消息可能延迟加载）
    var scanDelays = [1500, 3000, 5000, 8000];
    scanDelays.forEach(function(delay) {
      setTimeout(function() {
        var msgs = document.querySelectorAll('[data-pre-plain-text]');
        var newCount = 0;
        for (var i = 0; i < msgs.length; i++) {
          if (!msgs[i].getAttribute('data-scrm-tr')) { queueMessage(msgs[i]); newCount++; }
        }
        if (newCount > 0) console.log('[SCRM] 扫描(' + delay + 'ms): 新入队', newCount, '条');
        updateLangLabel();
      }, delay);
    });
  }

  // 暴露重新扫描函数供 BrowserView 切换时调用
  window.__scrmRescanMessages = function() {
    // 安全阀：重置可能泄漏的 activeRequests
    if (activeRequests > 0) {
      console.log('[SCRM] 重置 activeRequests:', activeRequests, '→ 0');
      activeRequests = 0;
    }
    var msgs = document.querySelectorAll('[data-pre-plain-text]');
    var count = 0;
    for (var i = 0; i < msgs.length; i++) {
      if (!_hasTr(msgs[i]) && msgs[i].getAttribute('data-scrm-tr') !== 'done') {
        msgs[i].removeAttribute('data-scrm-tr');
        queueMessage(msgs[i]);
        count++;
      }
    }
    console.log('[SCRM] 重新扫描完成，队列新增', count, '条, pendingMsgs:', pendingMsgs.length, 'activeRequests:', activeRequests);
  };

  var __nSetInterval = window.setInterval, __nClearInterval = window.clearInterval; // 抓当前(原生)那一对,配对使用,不受 WA 后续重写影响
  var readyCheck = __nSetInterval(function() {
    if (document.querySelector('#main') || document.querySelector('[data-testid="chat-list"]')) {
      __nClearInterval(readyCheck);
      init();
    }
  }, 1000);
  // [READY-NOGIVEUP 2026-09-15] 原来 30 秒没等到聊天列表就放弃(clearInterval)→新扫码登录的号 WA 首次同步常超过 30 秒,init() 永远不跑,整页无翻译(客户反映"登录后半天不翻译");现在一直等到聊天列表出现为止(每秒一次 querySelector,开销可忽略)
})();

/* [SELF-INFO] */ // ===== SCRM 自研账号信息读取 v2 (window.require WAWebCollections) =====
// 稳定拿自己账号的 pushname/头像:WhatsApp 页面 webpack 内 window.require('WAWebCollections') 得真 Store,
// 从 Conn(自己账号) + Contact(自己那条)读 pushname。不建垫片、不碰海王 window.Store。
(function(){
  if (window.__scrmSelfInfoV2) return;
  window.__scrmSelfInfoV2 = true;
  var ipc = null;
  try { ipc = require('electron').ipcRenderer; } catch(e) {}

  function getStore() {
    try {
      if (typeof window.require === 'function') {
        var st = window.require('WAWebCollections');
        if (st && st.Contact) return st;
      }
    } catch(e) {}
    return null;
  }
  function getWid() {
    try { return (localStorage.getItem('last-wid-md') || '').replace(/"/g, '').split(':')[0]; } catch(e) { return ''; }
  }
  function isPhone(x){ if(!x)return true; var t=String(x).replace(/[\u200e\u200f\u202a-\u202e\s]/g,''); return /^[+]?\d+$/.test(t); }
  // 自己账号号码/名字的唯一实现:phone 先 MePnUser 再 last-wid-md(纯数字);name = Conn.pushname(非号码才算)。
  // window.__scrmWaSelf() 给 [BATCH1-01] 状态对象用([BATCH1-08] 脱敏读 __scrmWaState.phone);不走下面 readSelf 那条全模块扫描的重路径。
  function selfPhone(){ var p = ''; try { var M = window.require('WAWebUserPrefsMeUser'); var u = M && ((M.getMaybeMePnUser && M.getMaybeMePnUser()) || (M.getMaybeMeUser && M.getMaybeMeUser())); if (u && u.user) p = String(u.user).replace(/\D/g, ''); } catch(e) {} if (!p) p = getWid().replace(/\D/g, ''); return p; }
  function selfName(){ try { var cm = window.require('WAWebConnModel'); if (cm && cm.Conn && cm.Conn.pushname && !isPhone(cm.Conn.pushname)) return String(cm.Conn.pushname); } catch(e) {} return ''; }
  window.__scrmWaSelf = function(){ return { phone: selfPhone(), name: selfName() }; };

  function readSelf() {
    var wid = getWid() || selfPhone();   // last-wid-md 原值(上报格式不变);没有时用 selfPhone(MePnUser 优先,不会拿到 LID)
    var name = selfName();
    // 兜底:全模块扫非号码 pushname
    if (isPhone(name)) {
      try {
        // ★ 只枚举一次全模块并缓存:webpackChunk.push 很重(实例化所有模块)且会永久累积到 chunk 数组,
        //   之前每次 tick 都 push 一条随机 id → 一夜累积几百条 → 内存泄漏 2.8GB + CPU 每分钟重编译全模块卡死主线程。
        //   固定 id + 全局缓存 mo,保证每个渲染进程生命周期内只做一次;后续 tick 复用缓存(模块是单例,pushname 后来加载也能读到)。
        if (!window.__scrmWaMo) {
          // ★ 必须等 WA 启动完成(聊天列表出现)才强制实例化全模块;启动中途做会破坏 WhatsApp Web 新版初始化→永远卡在加载页(2026-08-14 实测)
          if (!document.querySelector('#pane-side,[data-testid="chat-list"],[aria-label="Chat list"]')) throw new Error('wa-not-booted');
          window.__scrmWaMo = {};
          var _mo0 = window.__scrmWaMo;
          (window.webpackChunkbuild || window.webpackChunkwhatsapp_web_client).push([['scrmn_self'], {}, function(e){ Object.keys(e.m).forEach(function(n){ try { _mo0[n] = e(n); } catch(_){} }); }]);
        }
        var mo = window.__scrmWaMo;
        for (var k in mo) { var m = mo[k]; if (!m || typeof m !== 'object') continue;
          if (m.Conn && typeof m.Conn.pushname === 'string' && m.Conn.pushname && !isPhone(m.Conn.pushname)) { name = m.Conn.pushname; break; }
        }
      } catch(e) {}
    }
    return { wid: wid, name: isPhone(name) ? '' : name };
  }

  var tries = 0;
  function tick() {
    var info = readSelf();
    if (info && info.name) {
      // 通过海王同款 IPC 通道上报(app-main.html 的 send-account-info 接收器会写进 wa_name)
      try {
        if (ipc) {
          var partition = (function(){ try { var a = process.argv.find(function(x){ return x.indexOf('--scrm-session-id=') === 0; }); return a ? a.slice(18) : ''; } catch(e) { return ''; } })();
          ipc.send('message-proxy', ['send-account-info', {
            appType: 'whatsapp',
            partition: partition || info.wid,
            sessionId: partition || '',
            accountInfo: { userId: info.wid, userName: info.name, nickName: info.name, displayName: info.name }
          }]);
        }
      } catch(e) {}
      setTimeout(tick, 120000); // 拿到后每2分钟对账(改名跟进)
    } else {
      setTimeout(tick, (++tries < 40) ? 6000 : 60000);
    }
  }
  // 等 WhatsApp Web 启动完成(聊天列表出现)再开始读账号——此时 window.require 主方法可用,不会走到危险的 webpack 兜底
  (function _waitBoot(n){
    try{ if (document.querySelector('#pane-side,[data-testid="chat-list"],[aria-label="Chat list"]')) { setTimeout(tick, 800); return; } }catch(e){}
    if ((n||0) < 300) setTimeout(function(){ _waitBoot((n||0)+1); }, 1000);
    else setTimeout(tick, 800);   // 兜底:5分钟还没检测到也开始,别永久不上报账号名
  })(0);
})();
/* [/SELF-INFO] */

;(function(){ // WhatsApp 图片翻译 v5:全屏看图器左上角绿色「翻译图片」按钮(点→原地换译文渲染图+原图切换)。有道渲染,按分辨率稳定选图,零侵入不糊
  if (window.__scrmWaImgV2) return; window.__scrmWaImgV2 = 1;
  var API = 'https://chm123.com';
  function _cfg(){ return window.__scrmTrCfg || {}; }
  function recvTo(){ var t = window.__scrm_translate || {}; return t.recvTo || _cfg().receiveTargetLanguage || 'zh-CN'; }
  function imgOn(){ return _cfg().imageTranslateOpen !== false; }
  var __rcache = {};

  function _inject(){
    if (document.getElementById('scrm-imgtr-style')) return;
    var st = document.createElement('style'); st.id = 'scrm-imgtr-style';
    st.textContent = ''
      + '.scrm-wv-btn{position:fixed;top:70px;left:24px;z-index:2147483647;pointer-events:auto;background:rgba(18,183,106,.96);color:#fff;font-size:14px;font-weight:500;padding:8px 16px;border-radius:8px;cursor:pointer;user-select:none;display:none;align-items:center;gap:6px;box-shadow:0 3px 12px rgba(0,0,0,.35);transition:background .15s;}'
      + '.scrm-wv-btn:hover{background:#0ea865;}'
      + '.scrm-wv-btn .sp{display:inline-block;width:11px;height:11px;border:2px solid #fff;border-top-color:transparent;border-radius:50%;animation:scrm-imgtr-spin .7s linear infinite;}'
      + '@keyframes scrm-imgtr-spin{to{transform:rotate(360deg)}}';
    document.head.appendChild(st);
  }

  function _imgB64(img){ return new Promise(function(res){ try{
    var src = img.currentSrc || img.src || ''; if (!src){ res(''); return; }
    if (src.indexOf('data:') === 0){ res(src); return; }
    fetch(src).then(function(r){ return r.blob(); }).then(function(b){
      var fr = new FileReader(); fr.onload = function(){ res(fr.result); }; fr.onerror = function(){ res(''); }; fr.readAsDataURL(b);
    }).catch(function(){
      try{ var c = document.createElement('canvas'); c.width = img.naturalWidth||img.width; c.height = img.naturalHeight||img.height; c.getContext('2d').drawImage(img,0,0); res(c.toDataURL('image/png')); }catch(e){ res(''); }
    });
  }catch(e){ res(''); } }); }

  function _capImage(dataUrl, maxDim){ return new Promise(function(res){ try{
    var im = new Image();
    im.onload = function(){ var w=im.naturalWidth, h=im.naturalHeight; if (Math.max(w,h) <= maxDim){ res(dataUrl); return; }
      var sc = maxDim/Math.max(w,h); var c=document.createElement('canvas'); c.width=Math.round(w*sc); c.height=Math.round(h*sc);
      c.getContext('2d').drawImage(im,0,0,c.width,c.height); res(c.toDataURL('image/jpeg',0.92)); };
    im.onerror = function(){ res(dataUrl); }; im.src = dataUrl;
  }catch(e){ res(dataUrl); } }); }

  // 渲染译文图,resolve(dataURL) 或 ''(失败)
  function _render(im){ return new Promise(function(res){
    var orig = im.currentSrc || im.src || '';
    var key = recvTo() + '|' + orig.slice(0,90);
    if (__rcache[key]){ res(__rcache[key]); return; }
    _imgB64(im).then(function(b64){ if (!b64){ res(''); return; }
      _capImage(b64, 1600).then(function(capped){
        var xhr = new XMLHttpRequest(); xhr.open('POST', API + '/api/image-translate-render', true);
        xhr.setRequestHeader('Content-Type','application/json'); xhr.timeout = 60000;
        xhr.onreadystatechange = function(){ if (xhr.readyState !== 4) return;
          var url=''; try{ var j=JSON.parse(xhr.responseText); if (j.code===0 && j.renderImage) url=j.renderImage; }catch(e){}
          if (url) __rcache[key]=url; res(url);
        };
        xhr.ontimeout = function(){ res(''); };
        xhr.onerror = function(){ res(''); };
        xhr.send(JSON.stringify({ image: capped, to: recvTo() }));
      });
    });
  }); }

  // 找看图器里的大图:排除聊天缩略图(#main 内),在显示够大且居中的图里按分辨率(naturalWidth)选 —— 稳定不闪、避开被放大的低清占位图
  function _viewerBigImg(){
    if(!document.querySelector('#pane-side')) return null; /* [IMG-GATE 2026-09-08] 未登录(扫码页)不挂翻译图片按钮 */
    var main = document.getElementById('main');
    var imgs = document.querySelectorAll('img'); var best = null, bn = -1;
    var vw = window.innerWidth||1, vh = window.innerHeight||1;
    for (var i=0;i<imgs.length;i++){ var im=imgs[i];
      if (main && main.contains(im)) continue;
      var r = im.getBoundingClientRect();
      if (Math.min(r.width,r.height) < 160) continue;
      if (r.width*r.height < vw*vh*0.14) continue;
      var cx = r.left + r.width/2; if (Math.abs(cx - vw/2) > vw*0.34) continue;
      var nw = im.naturalWidth||0;
      if (nw > bn){ bn=nw; best=im; }
    }
    return best;
  }
  var _vbtn = null, _curView = null;
  function _ensureVBtn(){
    if (_vbtn && _vbtn.parentNode) return _vbtn;
    _vbtn = document.createElement('div'); _vbtn.className='scrm-wv-btn'; _vbtn.innerHTML='<span>译</span> 翻译图片';
    _vbtn.addEventListener('click', function(e){ e.stopPropagation(); e.preventDefault(); _onViewerBtn(); }, true);
    document.body.appendChild(_vbtn); return _vbtn;
  }
  function _setV(txt, spin){ if (_vbtn) _vbtn.innerHTML = (spin?'<span class="sp"></span> ':'') + txt; }
  function _onViewerBtn(){
    var img = _curView; if (!img) return;
    if (img.__wvShow){ if (img.__wvOrig) img.src = img.__wvOrig; img.__wvShow=false; _setV('翻译图片'); return; }
    if (img.__wvRender){ if (!img.__wvOrig) img.__wvOrig = img.currentSrc||img.src; img.src = img.__wvRender; img.__wvShow=true; _setV('原图'); return; }
    if (!img.__wvOrig) img.__wvOrig = img.currentSrc||img.src||'';
    _setV('翻译中...', true);
    _render(img).then(function(url){
      if (url){ img.__wvRender=url; img.src=url; img.__wvShow=true; _setV('原图'); }   // 成功就直接换图
      else { _setV('翻译失败,点重试'); }
    });
  }
  function _scanViewer(){
    try{ _inject();
      var img = imgOn() ? _viewerBigImg() : null;
      if (img){ if (img!==_curView){ _curView=img; } var b=_ensureVBtn(); b.style.display='flex';
        if (img.__wvShow) _setV('原图');
        else { var tx=_vbtn.textContent||''; if (tx.indexOf('翻译中')<0 && tx.indexOf('失败')<0) _setV('翻译图片'); }
      } else { if (_vbtn) _vbtn.style.display='none'; _curView=null; }
    }catch(e){}
  }

  function _boot(){ _inject(); setInterval(_scanViewer, 500); _scanViewer(); }
  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded', _boot); else _boot();
})();

;(function(){ // WhatsApp 语音翻译 v6(照海王:插在波形控件下方·气泡内·虚线样式)
  if (window.__scrmWaVoiceV6) return; window.__scrmWaVoiceV6 = 1;
  var API = 'https://chm123.com';
  function _cfg(){ return window.__scrmTrCfg || {}; }
  function recvTo(){ var t = window.__scrm_translate || {}; return t.recvTo || _cfg().receiveTargetLanguage || 'zh-CN'; }
  (function(){
    try{ var oc=URL.createObjectURL; URL.createObjectURL=function(o){ var r=oc.apply(this,arguments); try{ if(o&&/audio|ogg|opus|webm|mp4|m4a|octet|mpeg/i.test(o.type||'')){ window.__waLastAudioBlob=o; window.__waLastAudioAt=Date.now(); } }catch(e){} return r; }; }catch(e){}
    try{ var op=HTMLMediaElement.prototype.play; HTMLMediaElement.prototype.play=function(){ try{ window.__waLastAudioEl=this; if(window.__waCapturing && (Date.now()-(window.__waCaptureAt||0)<8000)){ this.muted=true; this.volume=0; } }catch(e){} return op.apply(this,arguments); }; }catch(e){}
  })();
  function _inject(){
    if (document.head && !document.getElementById('scrm-wvo6-style')){
      var st=document.createElement('style'); st.id='scrm-wvo6-style';
      st.textContent = ''
        + '.scrm-wvo6{width:100%;box-sizing:border-box;margin-top:6px;padding-top:6px;border-top:1px dashed rgba(0,0,0,.2);font-size:13px;line-height:1.55;white-space:pre-wrap;word-break:break-word;}'
        + '.scrm-wvo6 .og{color:#1a7f37;} .scrm-wvo6 .tr{margin-top:6px;padding-top:6px;padding-bottom:16px;border-top:1px dashed rgba(0,0,0,.2);color:#1a7f37;font-weight:500;} .scrm-wvo6 .lbl{margin-right:4px;} .scrm-wvo6-rf{cursor:pointer;color:#8a96a3;margin-left:6px;display:inline-flex;vertical-align:middle;} .scrm-wvo6-rf:hover{color:#1a7f37;}'
        + '.scrm-wvo6-btn{display:block;width:100%;box-sizing:border-box;margin-top:10px;padding:5px 10px;text-align:center;background:#0a7cff;color:#fff;font-size:13px;font-weight:500;border-radius:8px;cursor:pointer;user-select:none;margin-bottom:16px;} .scrm-wvo6-btn:hover{opacity:.92;} .scrm-wvo6-btn.on{opacity:.6;} .scrm-wvo6-sep{border-top:1px dashed rgba(0,0,0,.2);margin-top:6px;}';
      document.head.appendChild(st);
    }
  }
  var _RF='<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>';
  function _esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function _pb(w){ return w.querySelector('[aria-label="播放语音消息"]')||w.querySelector('[aria-label="暂停语音消息"]'); }
  // 最小的"含播放键"元素=波形控件
  function _wave(sp){ var p=sp; for(var i=0;i<10&&p;i++){ if(p.querySelector&&_pb(p)) return p; p=p.parentElement; } return null; }
  var __vcache={};
  function _vid(sp){ try{ var row=sp.closest('[data-id]'); var id=row?(row.getAttribute('data-id')||''):''; return id.slice(-44); }catch(e){ return ''; } }
  // 在波形控件后面插入我们的元素(气泡内,波形下方)
  function _mount(sp){ var wf=_wave(sp); if(!wf) return null;
    var arow=wf, pr=wf.parentElement;
    for(var i=0;i<6&&pr;i++){ var cs=getComputedStyle(pr); if(cs.display==='flex'&&pr.querySelector('img')){ arow=pr; break; } pr=pr.parentElement; }
    var host=arow.__wvoHost;
    if(!host||!host.parentNode){ host=document.createElement('div'); host.style.width='100%'; host.__sp=sp; arow.parentNode.insertBefore(host, arow.nextSibling); arow.__wvoHost=host; }
    return host;
  }
  function _capture(w){
    return new Promise(function(resolve){
      window.__waCapturing=true; window.__waCaptureAt=Date.now(); var startAt=Date.now(); var pb=_pb(w);
      if(pb){ try{ pb.click(); }catch(e){} }
      var tries=0;
      var iv=setInterval(function(){ tries++;
        var blob=window.__waLastAudioBlob, at=window.__waLastAudioAt||0;
        if(blob&&at>=startAt-500){ clearInterval(iv); window.__waCapturing=false; try{ var el=window.__waLastAudioEl; if(el){ el.pause(); el.currentTime=0; el.muted=false; } }catch(e){} try{ var pz=w.querySelector('[aria-label="暂停语音消息"]'); if(pz) pz.click(); }catch(e){} resolve(blob); }
        else if(tries>55){ clearInterval(iv); window.__waCapturing=false; var el2=window.__waLastAudioEl; try{ if(el2){ el2.pause(); el2.muted=false; } }catch(e){} var url=el2&&el2.src; if(url&&url.indexOf('blob:')===0){ fetch(url).then(function(r){return r.blob();}).then(resolve).catch(function(){resolve(null);}); } else resolve(null); }
      },100);
    });
  }
  /* [TR-FIX-1002B] 贴底只在真正改内容的地方量:原来 _mount 里每次都调 _keepBottom,而 _scan 每 800ms 对每条语音都调 _mount
     → 离底 1~24px 的用户每 800ms 被拽到底。现在 _mount 只负责找/建挂载点,改内容统一走 _fill(先量再改)。 */
  function _fill(sp, html){ var host=_mount(sp); if(!host) return; if(host.innerHTML===html) return;
    try{ if(window.__scrmWaKeepBottom) window.__scrmWaKeepBottom(host); }catch(e){}
    host.innerHTML=html; }
  function _showBox(sp,data){
    var html='<div class="scrm-wvo6">';
    if(data.transcript) html+='<div class="og"><span class="lbl">原：</span>'+_esc(data.transcript)+'</div>';
    html+='<div class="tr"><span class="lbl">译：</span>'+_esc(data.translation||'(无)')+'<span class="scrm-wvo6-rf" title="重新翻译">'+_RF+'</span></div></div>';
    _fill(sp, html);
  }
  function _showBtn(sp){ _fill(sp, '<div class="scrm-wvo6-sep"></div><div class="scrm-wvo6-btn">点击翻译</div>'); }
  function _translate(sp){
    try{
      var id=_vid(sp);
      if(id&&__vcache[id]){ _showBox(sp,__vcache[id]); return; }
      if(window.__waVoiceBusy) return;
      window.__waVoiceBusy=1; window.__waBusyAt=Date.now(); _fill(sp, '<div class="scrm-wvo6-btn on">翻译中...</div>');
      var w=_wave(sp);
      _capture(w).then(function(blob){
        function done(){ window.__waVoiceBusy=0; }
        if(!blob){ done(); _showBox(sp,{translation:'未能获取音频,请重试'}); return; }
        var fr=new FileReader(); fr.onload=function(){
          var xhr=new XMLHttpRequest(); xhr.open('POST',API+'/api/audio-translate',true); xhr.setRequestHeader('Content-Type','application/json'); xhr.timeout=50000;
          xhr.onreadystatechange=function(){ if(xhr.readyState!==4) return; done();
            var r={}; try{ r=JSON.parse(xhr.responseText); }catch(e){}
            if(r.code===0){ var d={transcript:r.transcript||'',translation:r.translation||''}; if(id) __vcache[id]=d; _showBox(sp,d); }
            else _showBox(sp,{translation:'翻译失败'+(r.error?('('+r.error+')'):'')});
          };
          xhr.ontimeout=function(){ done(); _showBox(sp,{translation:'翻译超时'}); };
          xhr.send(JSON.stringify({ audio:fr.result, to:recvTo(), mime:(blob.type||'audio/ogg') }));
        };
        fr.readAsDataURL(blob);
      });
    }catch(e){}
  }
  document.addEventListener('click', function(ev){
    var t=ev.target; var btn=t.closest&&t.closest('.scrm-wvo6-btn'); var rf=t.closest&&t.closest('.scrm-wvo6-rf');
    if(btn && !btn.classList.contains('on')){ ev.stopPropagation(); ev.stopImmediatePropagation(); ev.preventDefault(); var h=btn.closest('div'); var host=btn.parentElement; if(host&&host.__sp) _translate(host.__sp); return; }
    if(rf){ ev.stopPropagation(); ev.stopImmediatePropagation(); ev.preventDefault(); var host2=rf.closest('.scrm-wvo6')&&rf.closest('.scrm-wvo6').parentElement; if(host2&&host2.__sp){ var id=_vid(host2.__sp); if(id) delete __vcache[id]; _translate(host2.__sp); } return; }
  }, true);
  function _scan(){ try{
    _inject();
    var spans=document.querySelectorAll('[aria-label="语音消息"]');
    for(var i=0;i<spans.length;i++){ var sp=spans[i];
      if(!sp.closest('#main')||sp.closest('footer')) continue;
      if(!_wave(sp)) continue;
      var host=_mount(sp); if(!host) continue;
      try{ var _wf=_wave(sp); var _pr=_wf&&_wf.parentElement; for(var _k=0;_k<6&&_pr;_k++){ var _cs=getComputedStyle(_pr); if(_cs.display==="flex"&&_pr.querySelector("img")){ _pr.style.alignItems="flex-start"; break; } _pr=_pr.parentElement; } }catch(e){}
      var id=_vid(sp);
      if(id&&__vcache[id]){ if(!host.querySelector('.scrm-wvo6')) _showBox(sp,__vcache[id]); }
      else if(!host.querySelector('.scrm-wvo6-btn')&&!host.querySelector('.scrm-wvo6')&&!window.__waVoiceBusy){ _showBtn(sp); }
    }
  }catch(e){} }
  function _boot(){ _inject(); setInterval(_scan,800); _scan(); setInterval(function(){ if(window.__waVoiceBusy && window.__waBusyAt && (Date.now()-window.__waBusyAt>70000)){ window.__waVoiceBusy=0; window.__waCapturing=false; } }, 5000); }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',_boot); else _boot();
})();

/* SCRM 客户端健康信标:上报已翻译数,服务器据此发现适配器崩溃/被平台打挂 */
;(function(){try{
if (window.__scrmWaHB) return; window.__scrmWaHB = 1;   // 脚本被补注入时不再多起一个心跳定时器
/* [HB-V2 2026-09-15] 健康信标升级:原来只报 .scrm-tr 数(t=0 分不清"没开会话"和"有消息不翻译"),两个大 bug 在线上跑了很久监控都没响。现在报:i=init 是否跑过(30s 放弃那类)、m=可见消息数、ms=有外文正文却没译文的条数、pd=pending 数、pa=最老 pending 秒数、s=账号 wid 的短哈希(不传明文号码);2 分钟首报、之后每 10 分钟;服务端 translate-health.sh 按 m>0&&(i=0||ms>=3||pa>60) 记告警 */
function _scrmHB(){try{
  var c=window.__scrmTrCfg||{};var r=(c.receiveTranslateAuto!==false&&c.recvEnabled!==false)?1:0;
  var els=document.querySelectorAll('[data-pre-plain-text]');var m=els.length,ms=0,pd=0,pa=0,now=Date.now();
  for(var i=0;i<m;i++){var el=els[i];var st=el.getAttribute('data-scrm-tr')||'';if(st==='pending'){pd++;var a=Math.round((now-(el.__scrmPendAt||now))/1000);if(a>pa)pa=a;}
    var host=el.closest('[data-id]')||el;if(host.querySelector('.scrm-translated'))continue;
    try{var rc=el.getBoundingClientRect();if(rc.bottom<0||rc.top>innerHeight||rc.height===0)continue;}catch(e){} // 只数视口内的:视口外的按设计本来就不翻(滚到才翻),不算漏译(2026-09-16 A 号实测 5 条"漏译"全是滚出视口的旧消息=误报)
    var tx='';try{tx=(el.textContent||'').trim();}catch(e){}
    if(tx&&/\p{L}/u.test(tx)&&!/^[\u4e00-\u9fff\s\d\p{P}\p{S}]+$/u.test(tx))ms++;}
  var t=document.querySelectorAll('.scrm-translated').length;var ini=window.__scrmWaInitDone?1:0;
  var sid='';try{var w=(localStorage.getItem('last-wid-md')||'').replace(/"/g,'').split(':')[0];if(w){var h=0;for(var k=0;k<w.length;k++){h=((h<<5)-h)+w.charCodeAt(k);h|=0;}sid=(h>>>0).toString(36);}}catch(e){}
  new Image().src='https://chm123.com/HB?p=wa&t='+t+'&r='+r+'&i='+ini+'&m='+m+'&ms='+ms+'&pd='+pd+'&pa='+pa+'&s='+sid+'&v='+(window.__scrmWaTrVer||'')+'&_='+now;
}catch(e){}}
setTimeout(_scrmHB,120000);setInterval(_scrmHB,600000);
}catch(e){}})();

/* [TR-ALIGN-1002] 2026-10-02 删除原「切会话滚到底修复 v2」块(30ms 轮询发现切会话 → 1.5 秒每帧按到底、__scrmWaPinBottom):
   CEO 打开/切换会话完全不管滚动,停在哪(含未读处)由 WA 自己决定。[BTN-BOTTOM] 与插译文贴底已合并到适配器内 _keepBottom 一处。 */

/* [REPEAT-BADGE] 2026-09-16 工单重复粉丝标记(对齐海王)+ [BATCH1-03] 列表行备注,共用一次行扫描:
   · 重复粉:面板每分钟把本账号"重复线索"联系人推到 window.__scrmRepeat = { 手机号: { at, by, src } };命中的行在头像左上角打红色"重"点,悬停显示上次添加时间/主号/来源。
   · 备注:面板推 window.__scrmRemarks = { 备注键: 备注 },键按 会话 jid(c.id._serialized)→ 手机号@c.us → 纯手机号 依次查;空串/null 视为无备注;清洗成一行、最长 60 字。
     每行名字(第一个 span[title][dir=auto])后插 <span class="scrm-remark">,颜色跟 WA 主题变量 var(--WDS-content-deemphasized)。
   · 推送口只有「直接赋值」:这两个属性是 setter(channel),一赋值就重扫,并自动给 __scrmRepeatVer / __scrmRemarksVer 打时间戳。
   · 行对应的 chat:从名字 span 起向上找第一个带 React fiber 的节点,再沿 return 最多 30 层找 memoizedProps.chat(新版 WA 行 id 是 @lid,手机号取 chat.contact.phoneNumber.user)。
   · 驱动:订阅 [WA-OBS](只认 #pane-side 里的变动和 #pane-side 自身的挂载)+ ChatCollection add/remove/change:formattedTitle/change:name + 两个 setter;80ms 内连发合并成一次,扫一遍可见行。没有定时扫描。
   · 样式内联到元素上(此块 document-start 就跑,动态 <style> 不一定挂得上)。
   行选择器 cellsOf / 名字 span titleOf / chat 取法 chatOf / setter 通道 channel 只此一份,经 window.__scrmWaList / window.__scrmWaChannel 给 [BATCH1-08] 用。window.__scrmWaListRefresh() 立即扫一遍(回归用)。 */
;(function(){try{
  var OBS = window.__scrmWaObs; if (!OBS || window.__scrmWaRepeatBadge) return; window.__scrmWaRepeatBadge = 1;
  var SI = window.setInterval, CI = window.clearInterval; // 抓原生那一对配对使用(WA 稍后会重写 setInterval/clearInterval,见 [INIT-ONCE])
  var BADGE_CSS = 'position:absolute;left:6px;top:6px;width:16px;height:16px;border-radius:50%;background:#f54a44;color:#fff;font-size:10px;font-weight:700;line-height:16px;text-align:center;z-index:9;cursor:default;box-shadow:0 0 0 2px #fff;pointer-events:auto;';
  var REMARK_CSS = 'flex:none;margin-left:6px;max-width:45%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;font-weight:400;line-height:1.4;color:var(--WDS-content-deemphasized,#8696a0);pointer-events:none;';
  function fiberOf(n){ try{ var fk = Object.keys(n).find(function(k){ return k.indexOf('__reactFiber') === 0; }); return fk ? n[fk] : null; }catch(e){ return null; } }
  // 行 → { chat, depth }:depth = 从带 fiber 的节点沿 return 走了几层才遇到 chat(自检用);找不到回 null
  function chatAt(cell){ try{ var f = null; for (var n = titleOf(cell) || cell; n && !f; n = (n === cell) ? null : n.parentElement) f = fiberOf(n); var i = 0; while (f && i < 30) { var p = f.memoizedProps; if (p && p.chat && p.chat.id) return { chat: p.chat, depth: i }; f = f.return; i++; } }catch(e){} return null; }
  function chatOf(cell){ var r = chatAt(cell); return r ? r.chat : null; }
  function cellsOf(){ try{ var cells = document.querySelectorAll('#pane-side [data-testid="cell-frame-container"]'); if (!cells.length) cells = document.querySelectorAll('#pane-side [role="listitem"]'); return cells; }catch(e){ return []; } }
  function titleOf(cell){ try{ return cell.querySelector('span[title][dir="auto"]:not(.scrm-remark)') || cell.querySelector('span[title]:not(.scrm-remark)'); }catch(e){ return null; } }
  function keyOf(chat){ try{ var ct = chat.contact || {}; var pn = ''; try{ pn = (ct.phoneNumber && (ct.phoneNumber.user || String(ct.phoneNumber._serialized || '').split('@')[0])) || ''; }catch(e){} if (!pn && chat.id && chat.id.server === 'c.us') pn = chat.id.user; return String(pn || '').replace(/^\+/, ''); }catch(e){ return ''; } }
  function jidOf(chat){ try{ return String((chat.id && chat.id._serialized) || ''); }catch(e){ return ''; } }
  function fmt(t){ try{ if (!t) return ''; var d = new Date(t); if (isNaN(d)) return String(t); function p(n){ return (n < 10 ? '0' : '') + n; } return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes()); }catch(e){ return ''; } }
  function remarkOf(chat){ try{ var map = window.__scrmRemarks; if (!map || typeof map !== 'object') return ''; var jid = jidOf(chat), pn = keyOf(chat); var v = jid ? map[jid] : null; if (v == null && pn) { v = map[pn + '@c.us']; if (v == null) v = map[pn]; } return v == null ? '' : String(v).replace(/\s+/g, ' ').trim().slice(0, 60); }catch(e){ return ''; } }
  function paintBadge(cell, chat, map){ var old = cell.querySelector('.scrm-repeat-badge');
    var k = (map && chat) ? keyOf(chat) : ''; var hit = k && map[k];
    if (!hit) { if (old) old.remove(); return; }
    if (!old) { old = document.createElement('div'); old.className = 'scrm-repeat-badge'; old.style.cssText = BADGE_CSS; old.textContent = '重'; if (!cell.style.position && getComputedStyle(cell).position === 'static') cell.style.position = 'relative'; cell.appendChild(old); }
    var tip = '工单重复粉丝标记\n上次添加时间：' + fmt(hit.at) + '\n上次添加主号：' + (hit.by || '') + (hit.src ? '\n来源：' + hit.src : ''); if (old.title !== tip) old.title = tip; }
  // 备注节点紧跟名字 span 之后;行被复用成别的会话 → 文字跟着换;没备注 → 摘掉
  function paintRemark(cell, chat){ var old = cell.querySelector('.scrm-remark'); var text = chat ? remarkOf(chat) : '';
    if (!text) { if (old) old.remove(); return; }
    var ttl = titleOf(cell); if (!ttl || !ttl.parentNode) { if (old) old.remove(); return; }
    if (!old || old.previousElementSibling !== ttl) { if (old) old.remove(); old = document.createElement('span'); old.className = 'scrm-remark'; old.style.cssText = REMARK_CSS; ttl.parentNode.insertBefore(old, ttl.nextSibling); }
    if (old.textContent !== text) old.textContent = text; }
  var scanning = false, timer = null;
  function scan(){ if (scanning) return; scanning = true; try{
    var map = window.__scrmRepeat; if (!map || typeof map !== 'object') map = null;
    var cells = cellsOf();
    for (var i = 0; i < cells.length; i++) { var cell = cells[i]; var chat = chatOf(cell); paintBadge(cell, chat, map); paintRemark(cell, chat); }
  }catch(e){} scanning = false; }
  function schedule(){ if (timer) return; timer = setTimeout(function(){ timer = null; scan(); }, 80); }
  function inPane(n){ try{ if (n && n.nodeType !== 1) n = n.parentNode; return !!(n && n.nodeType === 1 && n.closest && n.closest('#pane-side')); }catch(e){ return false; } }
  function onMut(ms){ for (var i = 0; i < ms.length; i++) { var r = ms[i]; if (r.type === 'attributes' || !OBS.foreign(r)) continue;
    if (inPane(r.target)) { schedule(); return; }
    var a = r.addedNodes; for (var j = 0; j < a.length; j++) { var n = a[j]; if (n.nodeType === 1 && (n.id === 'pane-side' || (n.querySelector && n.querySelector('#pane-side')))) { schedule(); return; } } } }
  var hooked = false;
  function hook(){ if (hooked) return; try{ var C = window.require && window.require('WAWebChatCollection'); C = C && C.ChatCollection; if (!C || typeof C.on !== 'function') return; ['add', 'remove', 'change:formattedTitle', 'change:name'].forEach(function(ev){ C.on(ev, schedule); }); hooked = true; }catch(e){} }
  // setter 通道:channel(name, ver, cb) —— 把 window[name] 改成 setter,一赋值就调 cb(不传用本块的 schedule);ver 非空时同时给 window[ver] 打时间戳。已是 setter / 不可配置 → 回 false
  function channel(name, ver, cb){ try{ var cur = window[name]; var d = Object.getOwnPropertyDescriptor(window, name); if (d && (d.set || d.configurable === false)) return false;
    Object.defineProperty(window, name, { configurable: true, enumerable: true, get: function(){ return cur; }, set: function(v){ cur = v; if (ver) { try{ window[ver] = Date.now(); }catch(e){} } (cb || schedule)(); } }); return true; }catch(e){ return false; } }
  channel('__scrmRepeat', '__scrmRepeatVer'); channel('__scrmRemarks', '__scrmRemarksVer');
  window.__scrmWaChannel = channel; window.__scrmWaList = { cells: cellsOf, titleOf: titleOf, chatOf: chatOf };
  window.__scrmWaListRefresh = function(){ if (timer) { clearTimeout(timer); timer = null; } scan(); };
  OBS.sub(onMut); OBS.ready(schedule);
  hook(); var bt = SI(function(){ try{ hook(); if (hooked) CI(bt); }catch(e){} }, 1000);   // 只等 ChatCollection 模块就绪,挂上即停
  OBS.probes.list = function(){ var cells = cellsOf(), withTitle = 0, withChat = 0, depthMax = -1, lid = 0;
    for (var i = 0; i < cells.length; i++) { if (titleOf(cells[i])) withTitle++; var r = chatAt(cells[i]); if (r) { withChat++; if (r.depth > depthMax) depthMax = r.depth; if (/@lid$/.test(jidOf(r.chat))) lid++; } }
    return { paneSide: !!document.querySelector('#pane-side'), rowSelector: document.querySelector('#pane-side [data-testid="cell-frame-container"]') ? 'cell-frame-container' : 'role=listitem',
      listRows: cells.length, rowsWithTitle: withTitle, rowsWithChat: withChat, rowsLid: lid, chatFiberDepthMax: depthMax, collectionHooked: hooked,
      remarks: document.querySelectorAll('#pane-side .scrm-remark').length, badges: document.querySelectorAll('#pane-side .scrm-repeat-badge').length }; };
}catch(e){}})();
/* [/BATCH1-03] */

/* [CHAT-BACKUP] 2026-09-17 聊天记录上云(对齐 CEO"聊天记录":仅私聊,群聊/广播/频道不传):
   监听 WAWebCollections.Msg 的 add 事件(新消息 + 打开会话时加载的历史都会触发),按 30 天内、type 为文本/媒体 收进 window.__scrmChatBuf,
   面板每 20s 取走并 POST /api/app/chat/upload。只有面板下发 __scrm_translate.chatBackup===true(激活码开了"聊天备份")才采集。
   [CHAT-MEDIA] 图片/语音/视频/动图走 WAWebDownloadManager.downloadAndMaybeDecrypt 解密下载(≤4MB,每 5 分钟最多 20 个)转 dataURI 随消息上传;引用消息(quotedMsg)、编辑(latestEditMsgKey)、撤回(type=revoked)一并带上;
   [CHAT-STORE] 未取走的消息(不含媒体)存 localStorage,重开继续传。 */
;(function(){try{
  if (window.__scrmWaChatBackup) return; window.__scrmWaChatBackup = 1;
  window.__scrmChatBuf = window.__scrmChatBuf || [];
  var seen = {}, seenN = 0, MEDIA = { image: '[图片]', video: '[视频]', ptt: '[语音]', audio: '[音频]', document: '[文件]', sticker: '[贴纸]', location: '[位置]', vcard: '[名片]', gif: '[动图]' };
  var DL_KIND = { image: 'image', ptt: 'audio', audio: 'audio', video: 'video', gif: 'video' };
  function on(){ try { var c = window.__scrm_translate || {}, d = window.__scrmTrCfg || {}; return c.chatBackup === true || d.chatBackup === true; } catch(e){ return false; } }
  function phoneOf(chat){ try { var ct = chat.contact || {}; var pn = (ct.phoneNumber && (ct.phoneNumber.user || String(ct.phoneNumber._serialized || '').split('@')[0])) || ''; if (!pn && chat.id && chat.id.server === 'c.us') pn = chat.id.user; return String(pn || '').replace(/^\+/, ''); } catch(e){ return ''; } }
  var dlBusy = 0, dlStamps = [];
  function dlAllowed(){ var now = Date.now(); dlStamps = dlStamps.filter(function(x){ return now - x < 300000; }); return dlBusy < 2 && dlStamps.length < 20; }
  function dl(m){ return new Promise(function(res){ try {
    if (!m.mediaKey || !m.directPath || (Number(m.size) || 0) > 4194304) return res('');
    var DM = window.require('WAWebDownloadManager').downloadManager; var qpl = new Proxy({}, { get: function(){ return function(){ return qpl; }; } }); // downloadQpl 只是性能日志对象,给个空桩
    var t = setTimeout(function(){ res(''); }, 25000);
    var args = { directPath: m.directPath, encFilehash: m.encFilehash, filehash: m.filehash, mediaKey: m.mediaKey, mediaKeyTimestamp: m.mediaKeyTimestamp, type: m.type, mimetype: m.mimetype, downloadQpl: qpl, signal: (new AbortController()).signal }; // 不传 downloadOrigin:自己发的消息带 'chat' 会被 type-validator 拒(实测),不传两边都过
    DM.downloadAndMaybeDecrypt(args).catch(function(){ return DM.downloadAndMaybeDecrypt(Object.assign({ downloadOrigin: 'chat' }, args)); })
      .then(function(buf){ clearTimeout(t); try { var u8 = new Uint8Array(buf); var bin = ''; for (var i = 0; i < u8.length; i += 8192) bin += String.fromCharCode.apply(null, u8.subarray(i, i + 8192)); res('data:' + String(m.mimetype || 'application/octet-stream').split(';')[0] + ';base64,' + btoa(bin)); } catch(e){ res(''); } })
      .catch(function(){ clearTimeout(t); res(''); });
  } catch(e){ res(''); } }); }
  function quoteOf(m){ try { var q = m.quotedMsg; if (!q) return ''; var qt = String(q.type || ''); if (qt === 'chat') return String(q.body || '').slice(0, 500); return (MEDIA[qt] || '') + (q.caption ? ' ' + q.caption : ''); } catch(e){ return ''; } }
  function push(m){ try {
    if (!on() || !m || !m.id) return; var mid = String(m.id.id || m.id._serialized || ''); if (!mid || seen[mid]) return;
    var rem = m.id.remote || (m.from && m.id.fromMe ? m.to : m.from); if (!rem || !rem.server || rem.server === 'g.us' || rem.server === 'broadcast' || rem.server === 'newsletter' || rem.user === 'status') return;
    var t = Number(m.t) || 0; if (!t || t < Date.now() / 1000 - 30 * 86400) return;
    var type = String(m.type || ''); var body = '', otype = 'chat';
    if (type === 'chat') body = String(m.body || ''); else if (MEDIA[type]) { body = MEDIA[type] + (m.caption ? ' ' + m.caption : ''); otype = DL_KIND[type] || 'chat'; } else if (type === 'revoked') { body = '[消息已撤回]'; otype = 'revoked'; } else return;
    if (!body.trim()) return;
    var S = window.require('WAWebCollections'); var chat = S.Chat.get(rem) || (m.chat) || null; if (!chat || chat.isGroup) return;
    var pn = phoneOf(chat); if (!pn) return;
    var name = (chat.contact && (chat.contact.name || chat.contact.pushname || chat.contact.verifiedName)) || chat.formattedTitle || chat.name || '';
    if (/^(facebook|instagram|whatsapp|meta|facebook business|whatsapp business|meta ai)$/i.test(String(name).trim())) return;
    var img = ''; try { var PP = window.require('WAWebProfilePicThumbCollection').ProfilePicThumbCollection; var p = PP && PP.get(chat.id); img = (p && (p.eurl || p.img)) || ''; } catch(e){}
    seen[mid] = 1; if (++seenN > 20000) { seen = {}; seenN = 0; }
    var item = { account: pn, name: String(name || '').replace(/[‎‏‪-‮]/g, ''), headimg: img, id: mid, from_me: m.id.fromMe ? 1 : 0, type: otype, body: body.slice(0, 4000), t: t };
    var q = quoteOf(m); if (q) item.quote = q;
    try { if (m.latestEditMsgKey || m.isEdited) item.edited = 1; } catch(e){}
    var buf = window.__scrmChatBuf; if (buf.length > 3000) buf.splice(0, buf.length - 3000);
    if (DL_KIND[type] && dlAllowed() && t > Date.now() / 1000 - 7 * 86400) { dlBusy++; dlStamps.push(Date.now()); // 7 天内的媒体才下载原件,更早的只记占位
      dl(m).then(function(d){ dlBusy--; if (d && d.length < 5800000) item.media = d; (window.__scrmChatBuf || []).push(item); }, function(){ dlBusy--; (window.__scrmChatBuf || []).push(item); });
      return; }
    buf.push(item);
  } catch(e){} }
  /* [CHAT-STORE] */
  var STORE_KEY = 'scrm_chat_pending_whatsapp', lastSig = '';
  function strip(m){ var o = {}; for (var k in m) { if (k !== 'media') o[k] = m[k]; } return o; }
  function persist(){ try { var b = window.__scrmChatBuf || []; var sig = b.length + '|' + (b.length ? b[b.length - 1].id : ''); if (sig === lastSig) return; lastSig = sig; localStorage.setItem(STORE_KEY, JSON.stringify(b.slice(-300).map(strip))); } catch(e){} }
  function restore(){ try { var raw = localStorage.getItem(STORE_KEY); if (!raw) return; var arr = JSON.parse(raw); if (!Array.isArray(arr)) return; arr.forEach(function(m){ if (m && m.id && !seen[m.id]) { seen[m.id] = 1; seenN++; window.__scrmChatBuf.push(m); } }); } catch(e){} }
  restore(); setInterval(persist, 3000);
  var hooked = false;
  function hook(){ try { if (hooked) return; var S = window.require && window.require('WAWebCollections'); if (!S || !S.Msg || typeof S.Msg.on !== 'function') return; hooked = true;
    S.Msg.on('add', function(m){ push(m); });
    setTimeout(function(){ try { S.Msg.getModelsArray().forEach(push); } catch(e){} }, 3000);
  } catch(e){} }
  var lastOn = false;
  setInterval(function(){ try { if (!hooked) hook(); var o = on(); if (hooked && o && (!lastOn || Date.now() % 60000 < 5000)) { var S = window.require('WAWebCollections'); S.Msg.getModelsArray().forEach(push); } lastOn = o; } catch(e){} }, 5000); hook();
}catch(e){}})();

/* [BATCH1-01] 常驻状态对象 window.__scrmWaState(未读数口径):
   { loggedIn, unread:{ user, group, muted, archived }, pushname, phone, updatedAt }
   口径:只数会话集合(WAWebChatCollection.getModelsArray),排除 broadcast/newsletter/status/0@c.us;unreadCount 为 -1(有未读但没计数)记 1,≤0 不计;
   四桶互斥:归档(archive)→archived;否则静音(mute.isMuted / mute.expiration / muteExpiration,-1 永久,>now 生效中)→muted;否则群(isGroup)→group;其余→user。
   维护:首次全量初算;之后挂 ChatCollection 的 add/remove/reset/change:unreadCount/change:archive/change:mute/change:muteExpiration 事件,50ms 内连发合并成一次整表重算
   (会话几百条,重算 <1ms;不做逐条加减,免得漂移)。一个 10s 定时器管三件事:刷新 pushname/phone/loggedIn;事件还没挂上(模块未就绪/没有 on)时重算;挂上后距上次重算超过 60s 再对账一次(静音到期没有事件)。
   号码/名字调 [SELF-INFO] 的 window.__scrmWaSelf()(唯一实现);loggedIn = 有号码且聊天列表在。
   window.__scrmWaStateRefresh() 立即重算并返回对象(面板/回归用)。 */
;(function(){try{
  if (window.__scrmWaStateV1) return; window.__scrmWaStateV1 = 1;
  var SI = window.setInterval;
  var st = window.__scrmWaState = { loggedIn: false, unread: { user: 0, group: 0, muted: 0, archived: 0 }, pushname: '', phone: '', updatedAt: 0 };
  var EVENTS = ['add', 'remove', 'reset', 'change:unreadCount', 'change:archive', 'change:mute', 'change:muteExpiration'];
  function col(){ try{ var C = window.require && window.require('WAWebChatCollection'); return (C && C.ChatCollection) || null; }catch(e){ return null; } }
  function models(C){ try{ return typeof C.getModelsArray === 'function' ? C.getModelsArray() : (C._models || C.models || []); }catch(e){ return []; } }
  function countable(c){ try{ var id = c && c.id; if (!id) return false; var u = String(id.user || ''); return id.server !== 'broadcast' && id.server !== 'newsletter' && u !== 'status' && u !== '0'; }catch(e){ return false; } }
  function expOn(x){ var n = Number(x); if (!n) return false; return n === -1 || n > Date.now() / 1000; }
  function muted(c){ try{ var m = c.mute; if (m) { if (typeof m.isMuted === 'function') return !!m.isMuted(); if (typeof m.isMuted === 'boolean') return m.isMuted; if (m.expiration != null) return expOn(m.expiration); } if (c.muteExpiration != null) return expOn(c.muteExpiration); }catch(e){} return false; }
  function num(c){ var u = Number(c.unreadCount); if (u === -1) return 1; return u > 0 ? u : 0; }
  function self(){
    var s = null; try{ s = window.__scrmWaSelf ? window.__scrmWaSelf() : null; }catch(e){} s = s || {};
    var list = false; try{ list = !!document.querySelector('#pane-side,[data-testid="chat-list"],[aria-label="Chat list"]'); }catch(e){}
    st.phone = String(s.phone || ''); if (s.name) st.pushname = String(s.name); st.loggedIn = !!(st.phone && list); st.updatedAt = Date.now();
  }
  var hooked = false, timer = null, lastFull = 0;
  function recalc(){ var C = col(); if (!C) return false; var u = { user: 0, group: 0, muted: 0, archived: 0 }, arr = models(C);
    for (var i = 0; i < arr.length; i++) { var c = arr[i]; if (!c || !countable(c)) continue; var k = num(c); if (!k) continue;
      if (c.archive) u.archived += k; else if (muted(c)) u.muted += k; else if (c.isGroup) u.group += k; else u.user += k; }
    st.unread = u; st.updatedAt = lastFull = Date.now(); return true; }
  function schedule(){ if (timer) return; timer = setTimeout(function(){ timer = null; try{ recalc(); }catch(e){} }, 50); }
  function hook(){ if (hooked) return; var C = col(); if (!C || typeof C.on !== 'function') return; try{ for (var i = 0; i < EVENTS.length; i++) C.on(EVENTS[i], schedule); hooked = true; }catch(e){} }
  function tick(){ try{ self(); hook(); if (!hooked || Date.now() - lastFull > 60000) recalc(); }catch(e){} }
  window.__scrmWaStateRefresh = function(){ try{ self(); hook(); recalc(); }catch(e){} return st; };
  tick(); SI(tick, 10000);
  // 只读自检:事件是否挂上、会话数、静音字段在真机上的形态(各形态各有多少个会话)
  if (window.__scrmWaObs) window.__scrmWaObs.probes.state = function(){ var C = col(), arr = C ? models(C) : [], shape = { isMutedBool: 0, isMutedFn: 0, muteExpiration: 0, chatMuteExpiration: 0, none: 0 }, mutedNow = 0, archived = 0;
    for (var i = 0; i < arr.length; i++) { var c = arr[i]; if (!c) continue; var m = c.mute;
      if (m && typeof m.isMuted === 'function') shape.isMutedFn++; else if (m && typeof m.isMuted === 'boolean') shape.isMutedBool++; else if (m && m.expiration != null) shape.muteExpiration++; else if (c.muteExpiration != null) shape.chatMuteExpiration++; else shape.none++;
      if (muted(c)) mutedNow++; if (c.archive) archived++; }
    return { collectionHooked: hooked, hasOn: !!(C && typeof C.on === 'function'), chats: arr.length, mutedNow: mutedNow, archived: archived, muteShape: shape, loggedIn: st.loggedIn, hasPhone: !!st.phone, unread: st.unread }; };
}catch(e){}})();
/* [/BATCH1-01] */

/* [BATCH1-02] 客户设备类型:按消息 id 判(真机核对过的 WhatsApp 各端 id 规律)。
   devOf(id):长 32 或 21 → android;3EB0 开头且长 20/22 → desktop(网页版/桌面版);3A/5E 开头且长 20 → iphone;长 18 → desktop;其它 → 空(不显示)。
     长度 32 先判:Android 的 32 位随机十六进制可以以任何两位开头(含 3A/3E/5E)。
   ① 数据:WAWebCollections.Msg 的 add 事件 + 挂钩那一刻集合里已有的消息,把联系人最近一次识别到的设备记到 window.__scrmContactDevice[jid] = 'iphone'|'android'|'desktop'(线索上报由面板读这个对象)。
      只认对方发来的真实消息:自己发的不计;系统/通知类不计(isNotification === true,或 type 属于 e2e_notification / notification / notification_template / gp2 / call_log / protocol / ciphertext / revoked);
      群消息记到发言人(participant / author)名下,拿不到发言人就不计 —— 群、广播、频道的 jid 本身从不入表;按消息时间 t 取最新,晚到的历史消息不覆盖更新的。
   ② 展示:聊天顶栏 #main header 联系人名字 span 前面一个 16px 图标 <i class="scrm-dev-ico" data-dev="iphone|android|desktop" title="…">(内联 SVG,固定色值,深浅主题都看得清):
      desktop = Chrome 式三色圆标(title「web浏览器」),iphone = 手机轮廓(title「iPhone」),android = 小机器人(title「Android」)。一个联系人一个图标;没识别到不插、不占位。
      用 <i> 不用 <span>:取会话名的 getCurrentChatName() 扫的是 header span[title],带 title 的 span 会被当成会话名。
      当前会话 jid 取主程序的 getStableChatId()(window.__scrmWaChatId)。
   ③ 驱动:订阅 [WA-OBS],顶栏子树有变动(换聊天:#main 重建、只换 header 节点、header 晚一拍才挂上、或只改文字)80ms 内合并后刷新一次;__scrmContactDevice 有变化时也刷新。没有定时刷新。
      幂等:顶栏最多一个图标,设备没变不动、变了就地换、没识别到或找不到名字 span 就摘掉。
   window.__scrmDeviceOf(id) 单条判定;window.__scrmWaDeviceRefresh() 立即刷新并返回当前 data-dev(回归用)。 */
;(function(){try{
  var OBS = window.__scrmWaObs; if (!OBS || window.__scrmWaDeviceV1) return; window.__scrmWaDeviceV1 = 1;
  var SI = window.setInterval, CI = window.clearInterval;
  var dev = window.__scrmContactDevice = window.__scrmContactDevice || {}, devAt = {};
  function devOf(id){ id = String(id || ''); var n = id.length; if (n === 32 || n === 21) return 'android'; if (/^3EB0/.test(id) && (n === 20 || n === 22)) return 'desktop'; if (/^(3A|5E)/.test(id) && n === 20) return 'iphone'; if (n === 18) return 'desktop'; return ''; }
  window.__scrmDeviceOf = devOf;
  var SYS = /^(e2e_notification|notification|notification_template|gp2|call_log|protocol|ciphertext|revoked)$/;
  function jidOf(m){ try{ var id = m.id || {}; var w = id.participant || m.author || id.remote || m.from; var s = w ? String(w._serialized || w) : ''; return /@(g\.us|broadcast|newsletter)$/.test(s) ? '' : s; }catch(e){ return ''; } }
  function onAdd(m){ try{ if (!m || !m.id || m.id.fromMe || m.isNotification === true || SYS.test(String(m.type || ''))) return; var d = devOf(m.id.id); if (!d) return; var jid = jidOf(m); if (!jid) return;
    var t = Number(m.t) || 0; if (devAt[jid] != null && t < devAt[jid]) return; devAt[jid] = t; if (dev[jid] !== d) { dev[jid] = d; schedule(); } }catch(e){} }
  var hooked = false;
  function hook(){ if (hooked) return; try{ var S = window.require && window.require('WAWebCollections'); if (!S || !S.Msg || typeof S.Msg.on !== 'function') return; hooked = true; S.Msg.on('add', onAdd);
    var arr = typeof S.Msg.getModelsArray === 'function' ? S.Msg.getModelsArray() : []; for (var i = 0; i < arr.length; i++) onAdd(arr[i]); }catch(e){} }
  // ---- 顶栏图标 ----
  var ICON = {
    desktop: { title: 'web浏览器', svg: '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><circle cx="8" cy="8" r="7.5" fill="#fff"/>'
      + '<circle cx="8" cy="8" r="5.25" fill="none" stroke="#DB4437" stroke-width="4.5" stroke-dasharray="11 22" transform="rotate(-150 8 8)"/>'
      + '<circle cx="8" cy="8" r="5.25" fill="none" stroke="#F4B400" stroke-width="4.5" stroke-dasharray="11 22" transform="rotate(90 8 8)"/>'
      + '<circle cx="8" cy="8" r="5.25" fill="none" stroke="#0F9D58" stroke-width="4.5" stroke-dasharray="11 22" transform="rotate(-30 8 8)"/>'
      + '<circle cx="8" cy="8" r="3.4" fill="#fff"/><circle cx="8" cy="8" r="2.6" fill="#4285F4"/></svg>' },
    iphone: { title: 'iPhone', svg: '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><rect x="3.75" y="0.75" width="8.5" height="14.5" rx="2.2" fill="#fff" stroke="#5f6c76" stroke-width="1.5"/>'
      + '<rect x="6" y="2.2" width="4" height="1.2" rx="0.6" fill="#5f6c76"/><rect x="6.5" y="12.6" width="3" height="1.1" rx="0.55" fill="#5f6c76"/></svg>' },
    android: { title: 'Android', svg: '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M3 7.6a5 5 0 0 1 10 0z" fill="#3DDC84"/>'
      + '<path d="M4.3 3.6 3.3 2.1M11.7 3.6l1-1.5" stroke="#3DDC84" stroke-width="1.1" stroke-linecap="round"/><circle cx="6.1" cy="6" r=".75" fill="#fff"/><circle cx="9.9" cy="6" r=".75" fill="#fff"/>'
      + '<rect x="3" y="8.3" width="10" height="5.2" rx="1.2" fill="#3DDC84"/><rect x="1" y="8.3" width="1.5" height="4.2" rx=".75" fill="#3DDC84"/><rect x="13.5" y="8.3" width="1.5" height="4.2" rx=".75" fill="#3DDC84"/>'
      + '<rect x="5" y="13.2" width="1.5" height="2" rx=".75" fill="#3DDC84"/><rect x="9.5" y="13.2" width="1.5" height="2" rx=".75" fill="#3DDC84"/></svg>' }
  };
  var ICO_CSS = 'display:inline-flex;align-items:center;flex:none;width:16px;height:16px;margin-right:6px;vertical-align:middle;line-height:0;font-style:normal;cursor:default;';
  function curJid(){ try{ var f = window.__scrmWaChatId; return typeof f === 'function' ? String(f() || '') : ''; }catch(e){ return ''; } }
  function headerTitle(){ try{ var h = document.querySelector('#main header'); if (!h) return null; return h.querySelector('span[dir="auto"][title]') || h.querySelector('span[dir="auto"]'); }catch(e){ return null; } }
  function refresh(){ try{ var h = document.querySelector('#main header'); var old = h && h.querySelector('.scrm-dev-ico'); var ttl = headerTitle(); var jid = curJid(); var d = (ttl && jid && dev[jid] && ICON[dev[jid]]) ? dev[jid] : '';
    if (!d) { if (old) old.remove(); return ''; }
    if (old && old.parentNode === ttl.parentNode && old.nextSibling === ttl) { if (old.getAttribute('data-dev') !== d) { old.setAttribute('data-dev', d); old.setAttribute('title', ICON[d].title); old.innerHTML = ICON[d].svg; } return d; }
    if (old) old.remove(); var i = document.createElement('i'); i.className = 'scrm-dev-ico'; i.setAttribute('data-dev', d); i.setAttribute('title', ICON[d].title); i.style.cssText = ICO_CSS; i.innerHTML = ICON[d].svg; ttl.parentNode.insertBefore(i, ttl); return d; }catch(e){ return ''; } }
  var timer = null;
  function schedule(){ if (timer) return; timer = setTimeout(function(){ timer = null; refresh(); }, 80); }
  function inHeader(n){ try{ if (n && n.nodeType !== 1) n = n.parentNode; return !!(n && n.nodeType === 1 && n.closest && n.closest('#main header')); }catch(e){ return false; } }
  function onMut(ms){ for (var i = 0; i < ms.length; i++) { var r = ms[i]; if (r.type === 'attributes' || !OBS.foreign(r)) continue;
    if (inHeader(r.target)) { schedule(); return; }
    var a = r.addedNodes; for (var j = 0; j < a.length; j++) { var n = a[j]; if (n.nodeType === 1 && (n.id === 'main' || inHeader(n) || (n.querySelector && n.querySelector('#main header')))) { schedule(); return; } } } }
  window.__scrmWaDeviceRefresh = function(){ if (timer) { clearTimeout(timer); timer = null; } return refresh(); };
  OBS.sub(onMut); OBS.ready(schedule);
  hook(); var ht = SI(function(){ try{ hook(); if (hooked) CI(ht); }catch(e){} }, 1000);   // 只等 Msg 集合模块就绪,挂上即停
  OBS.probes.device = function(){ var h = document.querySelector('#main header'), ttl = headerTitle(), jid = curJid(), spans = [];
    if (h) { var ss = h.querySelectorAll('span[dir="auto"],span[title]'); for (var i = 0; i < ss.length && spans.length < 6; i++) { if (OBS.ours(ss[i])) continue; spans.push({ dir: ss[i].getAttribute('dir') || '', hasTitle: ss[i].hasAttribute('title'), text: String(ss[i].textContent || '').slice(0, 24) }); } }
    var ico = h && h.querySelector('.scrm-dev-ico');
    return { chatId: jid, hasHeader: !!h, headerTitleText: ttl ? String(ttl.textContent || '').slice(0, 40) : '', headerTitleHasTitleAttr: !!(ttl && ttl.hasAttribute('title')), headerSpans: spans,
      device: jid ? (dev[jid] || '') : '', icon: ico ? ico.getAttribute('data-dev') : '', iconBeforeTitle: !!(ico && ttl && ico.nextSibling === ttl), msgHooked: hooked, knownContacts: Object.keys(dev).length }; };
}catch(e){}})();
/* [/BATCH1-02] */

/* [BATCH1-08] 页内脱敏(客户手机号打码):面板下发 window.__scrmTrCfg.dataMask===true 时,把页面上"以号码示人"的客户手机号打码,规则与服务端一致:
   数字只留末 2 位(纯数字串上 ≡ 服务端 String(v).replace(/\d(?=\d{2})/g,'*');显示文本带空格/横线时按"整串数字只留末 2 位"算,格式字符原样)。
   「是号码」:文本去掉 ‎‏、空格、+ - ( ) 后匹配 ^\+?\d{7,16}$;自己账号的号码不打码(读 __scrmWaState.phone)。
   做法:不改 DOM 文本、不改 title —— 给节点加一个覆盖层 <span class="scrm-mask">(绝对定位铺满、继承字号/颜色/行高;背景取最近一层有底色的祖先的 computed 背景色,只在新建覆盖层和主题切换时算),
   打码后的文本放在它的 data-m 属性、由 #scrm-wa-mask-style 的 ::after content:attr(data-m) 画出来,所以节点的 textContent/innerText/title 一律不变(按名字/title 取会话键的其它功能不受影响);覆盖层自带 title="" 压住悬停提示。
   覆盖三处:① 聊天顶栏 #main header 里显示号码的叶子节点;② 资料抽屉等侧边容器里的号码叶子节点 —— 容器 = 从 #main 逐层往上走到(含)它与聊天列表 #pane-side 的公共祖先为止,每一层里既不装 #main 也不装聊天列表的兄弟节点(抽屉与 #main 同级、与 #main 同在一层包裹里、#main 单独被包,三种层级都覆盖);
   ③ 聊天列表行里以号码当名字的行(行/名字 span 用 [BATCH1-03] 的 window.__scrmWaList)。
   不处理:群聊顶栏"成员 A, 成员 B, 你"的逗号串、群消息气泡上的发言人号码标签、列表行最后一条预览里的号码、消息正文。
   复制出口(开着时才挂,关掉即摘;只此一处 hookCopy):
     a) document 捕获期的 copy 监听:只替换「选区 ∩ 打码节点」那一截 —— 先按 Range 偏移对位;选区止于号码中间时那一截必在选区文本末尾;整个节点都在选区里时按节点原文替换。选区里其它文字一个字不动。
        (选区文本取 Selection.toString(),它在块之间会多出换行、不含不可选文字,和 Range 偏移不一定对得上,所以有后两条。)
     b) navigator.clipboard.writeText 包一层(WA 自带的「复制电话号码」这类菜单走它,不触发 copy 事件):写入的整段文本命中号码规则才打码,其它原样。
   驱动:订阅 [WA-OBS](任何非自己造成的变动 → 80ms 内合并后扫一遍三处;<html> class/data-theme 变 = 主题切换 → 顺带重算背景色);__scrmTrCfg 一赋值即扫(用 [BATCH1-03] 的 window.__scrmWaChannel 把属性改成 setter)。没有定时器。
   dataMask 变回 false → 覆盖层全部移除、节点 position 还原、两个复制出口摘掉。
   window.__scrmWaMaskRefresh() 立即扫一遍并返回当前打码节点数、window.__scrmMaskText(v) 打码函数(回归用)。 */
;(function(){try{
  var OBS = window.__scrmWaObs; if (!OBS || window.__scrmWaMaskV1) return; window.__scrmWaMaskV1 = 1;
  var MASK_CSS = 'position:absolute;left:0;top:0;right:0;bottom:0;z-index:1;overflow:hidden;user-select:none;-webkit-user-select:none;cursor:inherit;';
  var masked = [];   // 当前被打码的节点(各自里面有一个 .scrm-mask),不重复
  function on(){ try{ var c = window.__scrmTrCfg; return !!(c && c.dataMask === true); }catch(e){ return false; } }
  function maskText(v){ var s = String(v == null ? '' : v), d = (s.match(/\d/g) || []).length, i = 0; return s.replace(/\d/g, function(c){ i++; return (d - i) >= 2 ? '*' : c; }); }
  function isPhone(t){ var s = String(t || '').replace(/[‎‏\s+\-()]/g, ''); return /^\+?\d{7,16}$/.test(s); }
  function ownPhone(){ try{ var p = window.__scrmWaState && window.__scrmWaState.phone; return p ? String(p).replace(/\D/g, '') : ''; }catch(e){ return ''; } }
  function maskable(t){ if (!isPhone(t)) return false; var own = ownPhone(); return !(own && String(t).replace(/\D/g, '') === own); }   // 是号码且不是自己的
  function rawText(el){ var s = ''; try{ for (var c = el.firstChild; c; c = c.nextSibling) if (c.nodeType === 3) s += c.nodeValue; }catch(e){} return s; }   // 只取节点自己的文字,覆盖层(空元素)不算
  function isMask(n){ return !!(n && n.nodeType === 1 && n.classList && n.classList.contains('scrm-mask')); }
  function isLeaf(el){ try{ for (var c = el.firstElementChild; c; c = c.nextElementSibling) if (!isMask(c)) return false; return true; }catch(e){ return false; } }
  function bgOf(el){ try{ for (var p = el; p && p !== document.documentElement; p = p.parentElement) { var c = getComputedStyle(p).backgroundColor; if (c && c !== 'transparent' && !/^rgba\([^)]*,\s*0\s*\)$/.test(c)) return c; } }catch(e){} return 'var(--WDS-background-default,#fff)'; }
  function css(){ try{ if (!document.head || document.getElementById('scrm-wa-mask-style')) return; var s = document.createElement('style'); s.id = 'scrm-wa-mask-style';
    s.textContent = '.scrm-mask::after{content:attr(data-m);display:block;font:inherit;color:inherit;line-height:inherit;letter-spacing:inherit;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}'; document.head.appendChild(s); }catch(e){} }
  // 顶栏 + 侧边容器(见段首 ②)
  function roots(){ var out = []; try{ var main = document.querySelector('#main'); if (!main) return out; var h = main.querySelector('header'); if (h) out.push(h);
    var side = document.querySelector('#pane-side'); if (!side) return out;
    for (var cur = main; cur.parentElement; cur = cur.parentElement) { var p = cur.parentElement;
      for (var c = p.firstElementChild; c; c = c.nextElementSibling) { if (c === cur || c.contains(side)) continue; out.push(c); }
      if (p.contains(side)) break; } }catch(e){} return out; }
  function leavesIn(root, test){ var out = []; try{ var all = root.querySelectorAll('*'); for (var i = 0; i < all.length; i++) { var el = all[i]; if (isMask(el) || /^(INPUT|TEXTAREA|SCRIPT|STYLE|svg|IMG)$/i.test(el.tagName)) continue; if (isLeaf(el) && test(rawText(el))) out.push(el); } }catch(e){} return out; }
  function candidates(){ var out = [];
    roots().forEach(function(root){ out = out.concat(leavesIn(root, maskable)); });
    try{ var L = window.__scrmWaList, cells = L.cells();
      for (var j = 0; j < cells.length; j++) { var ttl = L.titleOf(cells[j]); if (ttl && isLeaf(ttl) && maskable(rawText(ttl)) && out.indexOf(ttl) < 0) out.push(ttl); } }catch(e){}
    return out; }
  function maskOf(el){ try{ for (var c = el.firstElementChild; c; c = c.nextElementSibling) if (isMask(c)) return c; }catch(e){} return null; }
  function paint(el, rebg){ var m = maskOf(el), fresh = !m;
    if (fresh) { m = document.createElement('span'); m.className = 'scrm-mask'; m.setAttribute('title', ''); m.setAttribute('aria-hidden', 'true'); m.style.cssText = MASK_CSS;
      try{ if (el.__scrmMaskPos === undefined) { var pos = getComputedStyle(el).position; if (!pos || pos === 'static') { el.__scrmMaskPos = el.style.position || ''; el.style.position = 'relative'; } } }catch(e){}
      el.appendChild(m); if (masked.indexOf(el) < 0) masked.push(el); }
    var t = maskText(rawText(el)); if (m.getAttribute('data-m') !== t) m.setAttribute('data-m', t);
    if (fresh || rebg) m.style.background = bgOf(el); }
  function unpaint(el){ try{ var m; while ((m = maskOf(el))) el.removeChild(m); if (el.__scrmMaskPos !== undefined) { el.style.position = el.__scrmMaskPos; delete el.__scrmMaskPos; } }catch(e){} }
  // 选区 r 与节点 n 文字的交集:part = 交集串;off = 它在 Range 文本里的偏移;at = 它在节点原文里的偏移;tail = 选区止于该节点内部;不相交 → null
  function overlap(r, n){ try{ var nr = document.createRange(); nr.selectNodeContents(n);
    if (r.compareBoundaryPoints(Range.END_TO_START, nr) >= 0 || r.compareBoundaryPoints(Range.START_TO_END, nr) <= 0) return null;
    var x = document.createRange(), tail = r.compareBoundaryPoints(Range.END_TO_END, nr) < 0;
    if (r.compareBoundaryPoints(Range.START_TO_START, nr) > 0) x.setStart(r.startContainer, r.startOffset); else x.setStart(nr.startContainer, nr.startOffset);
    if (tail) x.setEnd(r.endContainer, r.endOffset); else x.setEnd(nr.endContainer, nr.endOffset);
    var pre = document.createRange(); pre.setStart(r.startContainer, r.startOffset); pre.setEnd(x.startContainer, x.startOffset);
    var head = document.createRange(); head.setStart(nr.startContainer, nr.startOffset); head.setEnd(x.startContainer, x.startOffset);
    return { part: x.toString(), off: pre.toString().length, at: head.toString().length, tail: tail }; }catch(e){ return null; } }
  function onCopy(e){ try{ if (!on() || !masked.length) return; var sel = null, txt = ''; try{ sel = window.getSelection(); txt = sel ? String(sel) : ''; }catch(_e){}
    var tgt = e.target && (e.target.nodeType === 1 ? e.target : e.target.parentElement); var hits = [];
    for (var i = 0; i < masked.length; i++) { var n = masked[i], got = null;
      try{ for (var k = 0; sel && k < sel.rangeCount && !got; k++) got = overlap(sel.getRangeAt(k), n); }catch(_c){}
      if (!got && tgt && (n === tgt || n.contains(tgt))) got = { part: '', off: -1, at: 0, tail: false };
      if (got) { got.n = n; hits.push(got); } }
    if (!hits.length) return; var out = txt;
    if (!txt) out = hits.map(function(h){ return maskText(rawText(h.n)); }).join('\n');
    else hits.forEach(function(h){ var raw = rawText(h.n), m = maskText(raw), L = h.part.length, pos = -1;   // 打码不改长度,前面换过的不影响后面的偏移
      if (L && h.off >= 0 && raw.substr(h.at, L) === h.part) { if (out.substr(h.off, L) === h.part) pos = h.off; else if (h.tail && out.slice(-L) === h.part) pos = out.length - L; }
      if (pos >= 0) out = out.slice(0, pos) + m.substr(h.at, L) + out.slice(pos + L);
      else if (raw && out.indexOf(raw) >= 0) out = out.split(raw).join(m); });
    if (out === txt) return;
    e.clipboardData.setData('text/plain', out); e.preventDefault(); }catch(_x){} }
  var clipOrig = null, clipOwn = false;
  function clipWrite(t){ try{ if (on() && typeof t === 'string' && maskable(t)) t = maskText(t); }catch(e){} return clipOrig.call(this, t); }
  var copyOn = false, timer = null, themeDirty = false;
  // 两个复制出口的挂/摘只此一处
  function hookCopy(want){ if (want === copyOn) return;
    try{ if (want) document.addEventListener('copy', onCopy, true); else document.removeEventListener('copy', onCopy, true); }catch(e){}
    try{ var cb = navigator.clipboard;
      if (cb && want && !clipOrig && typeof cb.writeText === 'function') { clipOwn = Object.prototype.hasOwnProperty.call(cb, 'writeText'); clipOrig = cb.writeText; cb.writeText = clipWrite; }
      else if (cb && !want && clipOrig && cb.writeText === clipWrite) { if (clipOwn) cb.writeText = clipOrig; else delete cb.writeText; clipOrig = null; } }catch(e){}
    copyOn = want; }
  function scan(){ var want = on(); if (!want && !masked.length) { hookCopy(false); return; }
    var rebg = themeDirty; themeDirty = false;
    var keep = want ? candidates() : [];
    for (var i = masked.length - 1; i >= 0; i--) { var el = masked[i]; if (keep.indexOf(el) < 0 || !document.contains(el)) { unpaint(el); masked.splice(i, 1); } }
    if (want) { css(); for (var j = 0; j < keep.length; j++) paint(keep[j], rebg); }
    hookCopy(want); }
  function schedule(){ if (timer) return; timer = setTimeout(function(){ timer = null; scan(); }, 80); }
  function onMut(ms){ var hit = false; for (var i = 0; i < ms.length; i++) { var r = ms[i]; if (r.type === 'attributes') { themeDirty = true; hit = true; } else if (!hit && OBS.foreign(r)) hit = true; } if (hit) schedule(); }
  window.__scrmWaMaskRefresh = function(){ if (timer) { clearTimeout(timer); timer = null; } scan(); return masked.length; };
  window.__scrmMaskText = maskText;
  OBS.sub(onMut); try{ window.__scrmWaChannel('__scrmTrCfg', '', schedule); }catch(e){}
  OBS.ready(scan);
  OBS.probes.mask = function(){ var main = document.querySelector('#main'), side = document.querySelector('#pane-side'), rs = roots(), list = [], depth = -1;
    if (main && side) { depth = 0; for (var t = main; t.parentElement && !t.parentElement.contains(side); t = t.parentElement) depth++; }
    for (var i = 0; i < rs.length; i++) { var c = rs[i]; list.push({ tag: c.tagName.toLowerCase(), id: c.id || '', cls: String(c.className && c.className.baseVal !== undefined ? c.className.baseVal : (c.className || '')).slice(0, 40), elements: c.querySelectorAll('*').length, phoneLeaves: leavesIn(c, isPhone).length }); }
    return { dataMask: on(), masked: masked.length, hasMain: !!main, hasPaneSide: !!side, mainWrapDepth: depth, drawerRoots: Math.max(0, rs.length - ((main && main.querySelector('header')) ? 1 : 0)), roots: list,
      copyHooked: copyOn, clipboardWrapped: !!clipOrig, ownPhoneKnown: !!ownPhone() }; };
}catch(e){}})();
/* [/BATCH1-08] */
/* [WA-PRIV] WhatsApp 隐私两项(面板 WhatsApp「翻译设置」里的开关 → 配置 hideTyping / rejectCalls → 页内 window.__scrmTrCfg,默认都关;对本机所有 WhatsApp 账号生效)。
   v2(2026-10-07 重做):没有任何轮询。两件事都是"WhatsApp 自己要做某个动作的那一刻"现读开关:
   ① 隐藏「正在输入」:WhatsApp 自己没有这个设置。给它上报输入状态的两个函数(WAWebChatStateBridge.sendChatStateComposing 打字 /
      sendChatStateRecording 录音)各包一层:开关开着就不上报(对方那边没有提示),关着原样放行;拨开关立即生效。
      「停止输入」(sendChatStatePaused)不拦:它只会让对方的提示消失。包完回读核对,确实换上了才算数。
   ② 自动拒接来电:WhatsApp 网页版自带通话。当前通话变了,通话集合发 change:activeCall(当前通话 = 集合上的 activeCall);电话对象状态变化发 change:state
      (事件名取自 WAWebVoipEventConstants,不写死)。收到事件时:开关开着、是来电(isCallIncoming)、不是自己拨出的 → 走界面上「拒绝」按钮
      同一条官方路径 getVoipStackInterface().rejectCall(),不自己拼信令。同一通只拒一次;官方方法报错则 1 秒后看它是否还在响、还是不是当前通话,再试一次。
      对方看到"已拒绝",聊天里照常留一条未接来电。
   等 WhatsApp 模块就绪:和本文件 [BATCH1-03] 同一写法 —— 每秒试一次,挂上即停,不限次(扫码页停多久都行);两件事各等各的;
      定时器用同一时刻抓下来的 setInterval / clearInterval 配对(WhatsApp 之后会改写这两个函数,不配对会清不掉)。
   不做的(已告知用户):隐藏在线 / 隐藏已读 —— WhatsApp 手机端「设置 → 隐私」本来就有。
   window.__scrmWaPriv() 返回当前状态(回归 / 排查用)。 */
;(function(){try{
  if (window.__scrmWaPrivV1 || window.__scrmWaPrivV2) return; window.__scrmWaPrivV2 = 1;   /* 页面里已经跑着上一版(热更注入到没重载的页面):不叠第二套,等页面重载再换 */
  var SI = window.setInterval, CI = window.clearInterval;
  var st = { typingWrapped: false, typingBlocked: 0, callHooked: false, rejected: 0, rejectErr: '', lastCall: '' };
  function cfg(){ try{ return window.__scrmTrCfg || {}; }catch(e){ return {}; } }
  function req(n){ try{ return window.require ? window.require(n) : null; }catch(e){ return null; } }

  /* 两个函数要么都包上、要么都不动(只成一个就还原:否则下一秒重试会在包装外面再套一层,越套越深) */
  function wrapTyping(){
    var B = req('WAWebChatStateBridge'); if (!B) return false;
    if (B.__scrmPriv) return true;
    var keys = ['sendChatStateComposing', 'sendChatStateRecording'], orig = {}, done = [];
    for (var i = 0; i < keys.length; i++) { (function(k){ var f = B[k]; if (typeof f !== 'function') return; orig[k] = f;
      var w = function(){ if (cfg().hideTyping === true) { st.typingBlocked++; return Promise.resolve(); } return f.apply(this, arguments); };
      try { B[k] = w; } catch (e) {} if (B[k] === w) done.push(k); })(keys[i]); }
    if (done.length !== keys.length) { done.forEach(function(k){ try { B[k] = orig[k]; } catch (e) {} }); return false; }   /* 这版 WhatsApp 变了:状态里如实显示没包上 */
    B.__scrmPriv = 1; return true;
  }

  /* 来电:每通电话(对象)只订阅一次状态变化、只拒一次 —— 标记记在电话对象自己身上(两通电话交替也不会重复订阅 / 重复拒接) */
  function ringing(call){ try{ return !!call && !call.outgoing && req('WAWebVoipCallStateUtils').isCallIncoming(call.getState ? call.getState() : call.state); }catch(e){ return false; } }
  function reject(cc, call, second){
    st.lastCall = String(call.id || '');
    Promise.resolve(req('WAWebVoipStackInterface').getVoipStackInterface()).then(function(stack){
      if (!stack || stack.type !== 'web' || typeof stack.rejectCall !== 'function') throw new Error('stack:' + (stack && stack.type));
      if (cc.activeCall !== call || !ringing(call)) return false;   /* 官方的拒接不带参数,拒的是"当前那通":动手前再确认当前通话就是这一通、而且还在响 */
      return Promise.resolve(stack.rejectCall()).then(function(){ return true; });
    }).then(function(did){ if (did) { st.rejected++; st.rejectErr = ''; } }, function(e){
      st.rejectErr = String(e && e.message || e).slice(0, 120);
      if (!second) setTimeout(function(){ try{ if (cfg().rejectCalls === true && cc.activeCall === call && ringing(call)) reject(cc, call, true); }catch(e2){} }, 1000);
    });
  }
  function onCall(cc, call, evState){ try{
      if (!call || typeof call !== 'object') return;
      if (!call.__scrmPrivSub && typeof call.on === 'function') { call.__scrmPrivSub = 1; call.on(evState, function(){ onCall(cc, call, evState); }); }   /* 先成为当前通话、稍后才进入响铃状态的情况 */
      if (call.__scrmPrivDone || cfg().rejectCalls !== true || cc.activeCall !== call || !ringing(call)) return;
      call.__scrmPrivDone = 1; reject(cc, call, false);
    }catch(e){ st.rejectErr = String(e && e.message || e).slice(0, 120); } }
  function hookCalls(){
    var C = req('WAWebCallCollection'), E = req('WAWebVoipEventConstants'); var cc = C && (C.CallCollection || C.default || C);
    if (!cc || typeof cc.on !== 'function' || !E || typeof E.getChangeEvent !== 'function' || !req('WAWebVoipCallStateUtils') || !req('WAWebVoipStackInterface')) return false;
    var evState = E.getChangeEvent(E.VoipCallModelEvents.STATE);
    cc.on(E.getChangeEvent(E.VoipCallCollectionEvents.ACTIVE_CALL), function(){ onCall(cc, cc.activeCall, evState); });   /* 不依赖事件带的参数:当前通话以集合上的 activeCall 为准 */
    onCall(cc, cc.activeCall, evState);   /* 挂上的这一刻已经有电话在响(通话模块晚就绪 / 页面在响铃中途重载)*/
    return true;
  }

  /* 两件事各等各的模块,互不拖累(这个账号的页面里某一半模块始终没有,另一半照常挂上并停掉自己的等待) */
  function wait(key, fn){ try{ st[key] = fn(); }catch(e){} if (st[key]) return; var t = SI(function(){ try{ st[key] = fn(); if (st[key]) CI(t); }catch(e){} }, 1000); }
  wait('typingWrapped', wrapTyping); wait('callHooked', hookCalls);
  window.__scrmWaPriv = function(){ return { hideTyping: cfg().hideTyping === true, typingWrapped: st.typingWrapped, typingBlocked: st.typingBlocked,
    rejectCalls: cfg().rejectCalls === true, callHooked: st.callHooked, rejected: st.rejected, rejectErr: st.rejectErr, lastCall: st.lastCall }; };
}catch(e){}})();
/* [/WA-PRIV] */
