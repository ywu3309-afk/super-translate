/* __scrmPatchV1__ scrm-patch-linebusiness v3 (2026-08-29,探针校准:.chat-reverse=自己/textarea-ex 编辑器/纯中文不白翻;v3.9 原文保留 <br> 换行按行翻;v3.8 ↻ 强制重译+转圈≥0.5s;v3.7 纯中文也贴译文行;v3.6 稳定性:指纹跳过免 cloneNode/滚动容器缓存/占位+封 oninput 阻断海王重复翻译请求)
   ① LINE Business(chat.line.biz)自研翻译整套接管海王 line-business-preload(照 X/TikTok 模板):
      - CSS+JS 隐藏海王译文 UI(.message-translate-content-wrapper/.real-time-tranlate-*),干净接管
      - 发送:回车/发送按钮拦截→翻译成对方语言→写回编辑器(#editor._host.value=[译文]+input 事件,海王同法)→点 #editable-unit input[type=submit]
        发出前记 putSent(译文,原文)(localStorage+IndexedDB scrm_tr_lb),发出气泡下直接显示操作员完整原文
      - 收信气泡(.chat-item-text):翻到 receiveTargetLanguage,缓存秒贴;↻ 重译;输入框预览条;Ctrl/Cmd+F 发原文;Ctrl/Cmd+T 只翻不发;中文检测
      - 好友独立发送翻译:每300ms发布 window.__scrmActiveContactId(海王 utils.getActiveContactId / Vue store),dashboard 四件套读取
      - 图片翻译(/api/image-translate-render)+语音翻译(/api/audio-translate),开关默认开
   ② v2 原样保留:联系人头像/名字修复(window.utils.getActiveContactInfo)+ 原生 select 下拉修复(见文件末尾) */
(function(){ 'use strict';
  if (window.__scrmLbTr) return; window.__scrmLbTr = true;
  var LB_TEXT='.chat-item-text';
  function _cfg(){ try{ return Object.assign({}, window.__scrm_translate||{}, window.__scrmTrCfg||{}); }catch(e){ return {}; } }
  function sendTo(){ try{ var c=_cfg(); var id=(window.__scrmActiveContactId||'');
      if(id){ var sct=c.singleContactTranslate&&c.singleContactTranslate[id]; if(sct&&(sct.singleContactTranslateOpen||sct.enabled)&&(sct.sendTargetLanguage||sct.sendTo)) return sct.sendTargetLanguage||sct.sendTo; }
      return c.linebusinessGlobalSend||c.sendTargetLanguage||c.sendTo||'en'; }catch(e){} return 'en'; }
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
  /* [TR-FIX-1002B] _route()=实际请求用的线路(面板值不认识时回退 google2,和 routeBase 同一个来源);缓存键/预览键/消息指纹都用它。
     _ck()=翻译缓存键唯一写法 'v2|线路|目标语言|原文'(内存 _cache、IndexedDB、整条译文缓存 _full 共用);
     原来 'v1|语言|原文' 不含线路 → 换线路后从内存/IndexedDB 拿回旧线路的译文,等于没换。旧 v1 键自然作废。
     _rk()=收信「语言|线路」,记在消息上判断要不要重贴/重翻。 */
  function _route(){ try{ return _trRouteOf(_cfg()); }catch(e){} return 'google2'; }
  function routeBase(){ return _trRouteUrl(_route()); }
  function _ck(tl,text){ return 'v2|'+_route()+'|'+(tl||'en')+'|'+text; }
  function _rk(){ return recvTo()+'|'+_route(); }
  function _pvLabel(){ return _trRouteName(_cfg())+'\u5b9e\u65f6\u7ffb\u8bd1'; }
  function _norm(s){ return (s||'').replace(/[\u200b\u200c\u200d\ufeff]/g,'').replace(/\r/g,'').replace(/^\s+|\s+$/g,''); }
  function _hasZh(t){ return /[\u4e00-\u9fff]/.test(t||''); }
  function _tgtIsZh(){ var to=sendTo(); return !!(to&&to.indexOf('zh')===0); }
  /* [TR-ALIGN-1002] 要不要翻的唯一判断(对齐 TG [TG-ZH-SAME]):目标是中文、输入里除汉字外没有任何文字(只有汉字/数字/标点/emoji)→ 原样发送。
     预览、回车、发送按钮三处共用。其他情况一律翻译(原来"不含汉字就原样发""只认拉丁字母算外文"→ 目标日语时英文原样发出、目标中文时俄文/假名/韩文原样发出,已删)。 */
  function _sendAsIs(src){ return _tgtIsZh() && !/\p{L}/u.test(String(src||'').replace(/\p{Script=Han}/gu,'')); }
  // [TR-ALIGN-1002] 译文与原文"相同"的签名:去掉所有非字母数字(任何文字都保留,原来只留拉丁/中日韩会把西里尔等删成空串误判相同)
  function _sig(s){ return String(s||'').replace(/[^\p{L}\p{N}]+/gu,'').toLowerCase(); }
  /* [TR-FIX-1002B] 这段文字能不能发出去的唯一判断(回车、发送按钮、「译文与原文相同 → 原样发」捷径都只调它):
     目标语言不是中文/日文时,只要还含汉字就不能发 —— 线路把中文原文原样吐回时,签名相同的捷径原来排在中文检查前面,直接把中文发了出去。 */
  function _safeToSend(t){ var to=String(sendTo()||'').toLowerCase(); if(to.indexOf('zh')===0||to.indexOf('ja')===0) return true; return !/\p{Script=Han}/u.test(String(t||'')); }
  var _ASIS_NOTE='  (\u5df2\u662f\u76ee\u6807\u8bed\u8a00,\u539f\u6837\u53d1\u9001)';

  // ---------- IndexedDB \u6301\u4e45\u5c42 ----------
  var _idb=(function(){
    var DB='scrm_tr_lb', ST='c', db=null, rdy=false, dead=false;
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
  var _FKEY='__scrmLbFull', _SKEY='__scrmLbSentOrig';
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
  var _BKEY='__scrmLbSentById';
  try{ var _bs=localStorage.getItem(_BKEY); if(_bs){ var _bo=JSON.parse(_bs); if(_bo&&typeof _bo==='object') _sentById=_bo; } }catch(e){}
  function _saveById(){ try{ var ks=Object.keys(_sentById); if(ks.length>3000){ for(var i=0;i<ks.length-2000;i++) delete _sentById[ks[i]]; } localStorage.setItem(_BKEY,JSON.stringify(_sentById)); }catch(e){} }
  // \u6a21\u7cca\u952e:\u53bb\u7a7a\u767d/\u6807\u70b9\u3001\u5c0f\u5199\u2014\u2014LINE \u6e32\u67d3\u4f1a\u6539\u52a8\u7a7a\u767d/\u6807\u70b9(\u5b9e\u6d4b\u53d1\u51fa\u8bd1\u6587\u4e0e\u6c14\u6ce1\u6587\u672c\u4e0d\u4e00\u81f4\u5bfc\u81f4\u539f\u6587\u6620\u5c04\u4e0d\u547d\u4e2d)
  function _fkey(s){ try{ return String(s||'').toLowerCase().replace(/[\s\p{P}\p{S}]/gu,''); }catch(e){ return String(s||'').toLowerCase().replace(/[\s!-\/:-@\[-`{-~\u3000-\u303f\uff00-\uffef]/g,''); } }
  function putSent(tr,orig){ if(!tr||!orig) return; _sentOrig[_norm(tr)]=orig; _sentOrig['f|'+_fkey(tr)]=orig; try{ _idb.put('s|'+_norm(tr),orig); }catch(e){} _pendSent.push({tr:_norm(tr),fk:_fkey(tr),orig:orig,at:Date.now()}); _saveFull(); }
  // \u6d88\u606f id:\u6c14\u6ce1\u7956\u5148\u4e0a\u7684 Vue \u6d88\u606f\u6a21\u578b id / data-* \u5c5e\u6027;\u53d6\u4e0d\u5230\u5219\u7a7a(\u9000\u56de\u6309\u8bd1\u6587\u6587\u672c)
  function _item(tc){ try{ return tc.closest('.chat-item')||tc.closest('[class*="chat-item"]:not(.chat-item-text)')||tc.parentElement; }catch(e){ return tc.parentElement; } }
  function _msgId(tc){ try{ var it=_item(tc); if(!it) return '';
      var v=it.__vue__; var p=v&&(v._props||v.$props); var m=p&&(p.message||p.msg||p.item||p.chatMessage||p.model); if(m){ var id=m.id||m.messageId||m.msgId||(m.payload&&(m.payload.id||m.payload.messageId)); if(id) return String(id); }
      var a=it.getAttribute('data-message-id')||it.getAttribute('data-msg-id')||it.getAttribute('data-id')||it.id; return a?String(a):''; }catch(e){ return ''; } }
  function _origFor(tc,src){ var id=_msgId(tc); if(id&&_sentById[id]) return _sentById[id];
    var fk=_fkey(src);
    if(_pendSent.length){ var now=Date.now(); for(var i=_pendSent.length-1;i>=0;i--){ var p=_pendSent[i]; if(now-p.at>120000){ _pendSent.splice(i,1); continue; } if((p.tr===src||p.fk===fk) && _isMine(tc)){ if(id){ _sentById[id]=p.orig; _saveById(); } _pendSent.splice(i,1); return p.orig; } } }
    return _sentOrig[src]||_sentOrig['f|'+fk]||null; }
  window.__lbSentOrig=_sentOrig;

  /* [BATCH1-04] 面板「清空译文缓存」:window.__scrmTrCacheClear() → Promise<{cleared:n}>,永不 reject。
     清三处:句级内存 _cache;整条消息译文 _full 及它在 localStorage __scrmLbFull 的镜像;IndexedDB scrm_tr_lb 表 c(_idb.clearP;表里 s| 发出原文条目只写从不读,随整表清掉)。
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
  /* [TR-ALIGN-1002] force=true(↻ 重新翻译):跳过内存缓存和 IndexedDB 读取,必定走网络,新结果覆盖两处缓存。
     原来 ↻ 只删内存键,translate 又先查 IndexedDB → 拿回旧译文,点了等于没点。强制请求不与普通请求合并(普通的可能正从 IndexedDB 拿旧值)。 */
  function translate(text,tl,force){ return new Promise(function(resolve){
    text=_norm(text); if(!text){ resolve(''); return; }
    var key=_ck(tl,text);   // [TR-FIX-1002B] 键含线路
    var pk=(force?'F|':'')+key;
    if(!force&&_cache[key]!=null){ resolve(_cache[key]); return; }
    if(_pending[pk]){ _pending[pk].push(resolve); return; }
    _pending[pk]=[resolve];
    var done=function(r){ if(r){ _cache[key]=r; try{ _idb.put(key,r); }catch(_p){} var ks=Object.keys(_cache); if(ks.length>6000){ for(var i=0;i<2000;i++) delete _cache[ks[i]]; } } var qs=_pending[pk]||[]; delete _pending[pk]; qs.forEach(function(f){ try{ f(r); }catch(e){} }); };
    var doNetwork=function(){
      var async='sl:auto,tl:'+(tl||'en')+',st:'+encodeURIComponent(text.slice(0,1500))+',id:'+(Date.now?Date.now():1);
      var url=routeBase()+'/async/translate?async='+encodeURIComponent(async);
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
  function _injStyle(){ if(document.getElementById('__scrmLbStyle')||!document.head) return;
    var st=document.createElement('style'); st.id='__scrmLbStyle';
    st.textContent=''
      + '.message-translate-content-wrapper,.message-translate-content,.message-translate-loading,.message-translate-btn,.message-translate-error,.real-time-tranlate-content,.real-time-tranlate-text,[class*="real-time-tranlate"]{display:none !important;} '
      + '.scrm-lb-tw{display:block;width:100%;margin-top:4px;padding-top:4px;border-top:1px dashed rgba(26,127,55,.7);color:#1a7f37;font-size:13px;line-height:1.4;white-space:pre-wrap;word-break:break-word;text-align:left;} '
      + '.scrm-lb-mine .scrm-lb-tw{color:#0b5d27;border-top-color:rgba(0,0,0,.25);} '
      + '@keyframes scrm-lb-spin{to{transform:rotate(360deg)}} .scrm-lb-rf{display:inline-flex;align-items:center;margin-left:6px;vertical-align:middle;cursor:pointer;opacity:.7;transition:opacity .15s;user-select:none;} .scrm-lb-rf:hover{opacity:1;} .scrm-lb-rf.spin svg{animation:scrm-lb-spin .8s linear infinite;} '
      + '.scrm-imgtr-host{position:relative;} .scrm-imgtr-btn{position:absolute;top:6px;right:6px;z-index:30;background:rgba(0,0,0,.62);color:#fff;font-size:11px;line-height:1;padding:4px 8px;border-radius:6px;cursor:pointer;display:none;align-items:center;gap:3px;user-select:none;} .scrm-imgtr-host:hover .scrm-imgtr-btn{display:inline-flex;} .scrm-imgtr-btn.on{display:inline-flex;} .scrm-imgtr-btn.done{display:inline-flex;background:rgba(26,127,55,.92);} .scrm-imgtr-btn .sp{display:inline-block;width:9px;height:9px;border:1.5px solid #fff;border-top-color:transparent;border-radius:50%;animation:scrm-lb-spin .7s linear infinite;} '
      + '.scrm-imgtr-mask{position:fixed;inset:0;z-index:2147483600;background:rgba(0,0,0,.75);display:flex;align-items:center;justify-content:center;cursor:zoom-out;} .scrm-imgtr-lightimg{max-width:92vw;max-height:84vh;border-radius:8px;background:#fff;object-fit:contain;} '
      + '.scrm-lb-vhost{width:100%;box-sizing:border-box;} .scrm-lb-vbtn{display:inline-block;margin-top:6px;background:#1a7f37;color:#fff;font-size:11px;line-height:1;padding:4px 9px;border-radius:10px;cursor:pointer;user-select:none;} .scrm-lb-vbtn.on{opacity:.7;} .scrm-lb-vo{margin-top:6px;padding-top:6px;border-top:1px dashed rgba(120,130,140,.5);font-size:12.5px;line-height:1.5;white-space:pre-wrap;word-break:break-word;text-align:left;} .scrm-lb-vo .og{opacity:.75;} .scrm-lb-vo .tr{margin-top:3px;font-weight:500;} .scrm-lb-vo .lbl{color:#1a7f37;font-size:10.5px;margin-right:2px;font-weight:600;} .scrm-lb-vrf{cursor:pointer;opacity:.7;margin-left:6px;display:inline-flex;vertical-align:middle;} .scrm-lb-vrf:hover{opacity:1;} '
      + _pvCoreCss('scrm-lb-pv',{margin:'4px 0',maxHeight:'26vh'})+'.scrm-lb-pv{width:100%;}';
    document.head.appendChild(st);
  }
  // \u539f\u6587:clone \u6c14\u6ce1\u6587\u672c\u8282\u70b9,\u53bb\u6389\u6211\u65b9\u8bd1\u6587\u6846/\u6d77\u738b\u8bd1\u6587
  // \u539f\u6587:\u514b\u9686\u53bb\u6389\u6211\u65b9/\u6d77\u738b\u8bd1\u6587\u6846;\u2605\u514b\u9686\u8282\u70b9\u672a\u6e32\u67d3,innerText \u4e0d\u6298\u7b97 <br>(\u5b9e\u62a5:\u591a\u6bb5\u539f\u6587\u88ab\u5408\u6210\u4e00\u884c\u7ffb)\u2192 \u624b\u52a8\u628a <br>/\u5757\u7ea7\u5143\u7d20\u6362\u6210 \n
  function _origText(tc){ try{ var c=tc.cloneNode(true); var rm=c.querySelectorAll('.scrm-lb-tw,.message-translate-content-wrapper,[class*="message-translate"]'); for(var j=0;j<rm.length;j++) rm[j].parentNode.removeChild(rm[j]);
      var brs=c.querySelectorAll('br'); for(var k=0;k<brs.length;k++) brs[k].parentNode.replaceChild(document.createTextNode('\n'),brs[k]);
      var blks=c.querySelectorAll('div,p,li'); for(var m=0;m<blks.length;m++){ var b=blks[m]; if(b.previousSibling) b.parentNode.insertBefore(document.createTextNode('\n'),b); }
      var t=(c.textContent||'').replace(/\u00a0/g,' ').replace(/[ \t]+\n/g,'\n').replace(/\n{3,}/g,'\n\n'); return _norm(t); }catch(e){ return ''; } }
  // \u53d1\u51fa/\u6536\u5230:\u7956\u5148 class \u542b me/self/own/right/sent \u2192 \u81ea\u5df1;\u515c\u5e95\u6309\u4f4d\u7f6e(\u53f3\u534a\u8fb9=\u81ea\u5df1)
  // \u63a2\u9488\u5b9e\u6d4b:\u81ea\u5df1\u53d1\u7684\u7956\u5148 .chat.chat-reverse(\u53f3\u4fa7),\u5bf9\u65b9 .chat.chat-secondary(\u5de6\u4fa7);\u515c\u5e95\u6309\u4f4d\u7f6e
  function _isMine(tc){ try{ var ch=tc.closest('.chat'); if(ch){ if(ch.classList.contains('chat-reverse')) return true; if(ch.classList.contains('chat-secondary')) return false; }
    var sc=tc.closest('#content-primary')||document.body; var a=tc.getBoundingClientRect(), b=sc.getBoundingClientRect(); return (a.left+a.right)/2 > (b.left+b.right)/2; }catch(e){ return false; } }
  // \u76ee\u6807\u4e2d\u6587\u4e14\u6d88\u606f\u672c\u8eab\u5c31\u662f\u7eaf\u4e2d\u6587(\u65e0\u62c9\u4e01/\u5047\u540d/\u97e9\u6587/\u6cf0\u6587/\u897f\u91cc\u5c14)\u2192\u4e0d\u7528\u7ffb
  function _skipRecv(src,rto){ try{ return /^zh/i.test(rto||'') && _hasZh(src) && !/[A-Za-z\u00C0-\u024F\u0400-\u04FF\u0E00-\u0E7F\u3040-\u30FF\uAC00-\uD7AF\u0600-\u06FF]/.test(src); }catch(e){ return false; } }
  // ---------- \u6eda\u52a8\u8d34\u5e95:\u8bd1\u6587\u6846\u5728 LINE \u5b9a\u4f4d\u5230\u5e95\u4e4b\u540e\u624d\u63d2\u5165\u4f1a\u628a\u5185\u5bb9\u6491\u9ad8\u2192\u5207\u4f1a\u8bdd\u8dd1\u5230\u6700\u9876(\u7528\u6237\u5b9e\u62a5) ----------
  var _scEl=null;
  function _scroller(){ try{ if(_scEl&&_scEl.isConnected&&_scEl.scrollHeight>_scEl.clientHeight+4) return _scEl; _scEl=null; var tc=document.querySelector(LB_TEXT); var el=tc?tc.parentElement:null; while(el&&el!==document.body){ var cs=getComputedStyle(el); if(/(auto|scroll)/.test(cs.overflowY)&&el.scrollHeight>el.clientHeight+4){ _scEl=el; return el; } el=el.parentElement; }
    var cands=document.querySelectorAll('.chat-messages,.chat-content-wrapper,[class*="chat-scroll"],[class*="message-list"]'); for(var i=0;i<cands.length;i++){ var c=cands[i]; var s2=getComputedStyle(c); if(/(auto|scroll)/.test(s2.overflowY)) return c; } }catch(e){} return null; }
  /* [TR-ALIGN-1002] 2026-10-02 打开/切换会话不再强行滚动(对齐 CEO / TG [TG-KEEP-BOTTOM]):
     删掉了切会话那一整套钉底(点会话列表/会话 ID 变 → 消息区 visibility 隐藏 900ms 每 40ms 拉底、4 秒内每 50ms 拉底、
     全局 scroll 监听 scrollTop<80 就拉底、MutationObserver 里 _stickNow)。原来会把停在未读处/中间的列表硬拽到最底部。
     打开会话停在哪由 LINE 自己决定。只保留两条贴底规则:
       ① 我们往消息里插入内容(译文/语音译文)时 _keepBottom:插入前离底 ≤24px → 插完(微任务)贴底;否则不动;同一轮多次插入只量一次。
       ② 用户自己发送消息后 _stickBottom(短时间跟随到底,用户滚轮上滑/拖滚动条立即停)。
     LINE Business 消息列表是正常方向(底部 = scrollTop 最大),不是 LINE 个人版的 column-reverse。 */
  function _toBottom(){ try{ var sc=_scroller(); if(sc) sc.scrollTop=sc.scrollHeight; }catch(e){} }
  var _kbList=null;
  function _keepBottom(){ try{
    var sc=_scroller(); if(!sc) return;
    if(_kbList){ for(var i=0;i<_kbList.length;i++){ if(_kbList[i].sc===sc) return; } }
    else { _kbList=[]; Promise.resolve().then(function(){ var l=_kbList; _kbList=null; for(var k=0;k<l.length;k++){ try{ if(l[k].atB&&l[k].sc.isConnected) l[k].sc.scrollTop=l[k].sc.scrollHeight; }catch(e){} } }); }
    _kbList.push({ sc:sc, atB:(sc.scrollHeight-sc.scrollTop-sc.clientHeight)<=24 });
  }catch(e){} }
  var _stickT=null, _stickAt=0, _userScrolledAt=0;
  function _stickBottom(ms){ try{ var t0=Date.now(), until=t0+(ms||1500); _stickAt=t0; _toBottom(); if(_stickT) clearInterval(_stickT);
    _stickT=setInterval(function(){ try{ if(Date.now()>until || _userScrolledAt>=_stickAt){ clearInterval(_stickT); _stickT=null; return; } _toBottom(); }catch(e){} },50);
  }catch(e){} }
  document.addEventListener('wheel',function(e){ try{ if(e.deltaY<0) _userScrolledAt=Date.now(); }catch(_){} },{capture:true,passive:true});
  document.addEventListener('mousedown',function(e){ try{ if(!e.isTrusted) return; var sc=_scroller(); if(!sc) return; var r=sc.getBoundingClientRect(); if(e.clientX>=r.right-22&&e.clientY>=r.top&&e.clientY<=r.bottom) _userScrolledAt=Date.now(); }catch(_){} },true); // [NO-BLIND-SNAP] 拖滚动条也算用户滚动(原来只认滚轮)
  function _annotate(tc,want,mine){ try{
    var box=tc.__scrmTw;
    if(!box||!box.parentNode){
      _keepBottom();   // [TR-ALIGN-1002] 插入前量一次是否在底
      box=document.createElement('div'); box.className='scrm-lb-tw';
      var tx=document.createElement('span'); tx.className='scrm-lb-tx'; box.appendChild(tx);
      var rf=document.createElement('span'); rf.className='scrm-lb-rf'; rf.title='\u91cd\u65b0\u7ffb\u8bd1';
      rf.innerHTML='<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>';
      box.appendChild(rf); tc.appendChild(box); tc.__scrmTw=box;
    }
    if(mine) tc.classList.add('scrm-lb-mine'); else tc.classList.remove('scrm-lb-mine');
    var rfb=box.querySelector('.scrm-lb-rf'); if(rfb&&rfb.classList.contains('spin')&&want!=='\u7ffb\u8bd1\u4e2d\u2026'){ var left=500-(Date.now()-(tc.__zRfAt||0)); if(left>0){ (function(b){ setTimeout(function(){ try{ b.classList.remove('spin'); }catch(e){} },left); })(rfb); } else rfb.classList.remove('spin'); }
    var tx2=box.querySelector('.scrm-lb-tx'); if(tx2&&(tx2.textContent||'')!==want){ _keepBottom(); tx2.textContent=want; }   // [TR-ALIGN-1002] 换字前量一次;原来 <60px 且 1.5s 内没手动滚才贴,改为统一规则
    if(want!=='\u7ffb\u8bd1\u4e2d\u2026'){ tc.__zFk=tc.textContent; tc.__zFkTo=_rk(); }   // [TR-FIX-1002B] 指纹记「语言|线路」:换线路后重贴/重翻
    if(!tc.querySelector('.message-translate-content')){ var dm=document.createElement('span'); dm.className='message-translate-content'; dm.style.display='none'; tc.appendChild(dm); tc.__zFk=tc.textContent; }   // \u5360\u4f4d\u8ba9\u6d77\u738b on() \u8df3\u8fc7\u8fd9\u6761(\u5b83\u89c1\u5230 .message-translate-content \u5c31\u4e0d\u518d\u53d1\u7ffb\u8bd1\u8bf7\u6c42,\u7701\u4e00\u534a\u6d41\u91cf\u9632\u9650\u6d41)
  }catch(e){} }
  function processMsgs(){ try{
    _injStyle();
    try{ var hw=document.querySelectorAll('.message-translate-content-wrapper,[class*="message-translate-content"],[class*="real-time-tranlate"]'); for(var hi=0;hi<hw.length;hi++){ if(hw[hi].style.display!=='none') hw[hi].style.setProperty('display','none','important'); } }catch(e){}
    if(!recvEnabled()) return;
    if(_cfg().groupTranslateAuto===false && _isGroup()) return;
    var rto=recvTo(), rk=_rk();
    var tcs=document.querySelectorAll(LB_TEXT);
    for(var i=0;i<tcs.length;i++){ var tc=tcs[i];
      var fk=tc.textContent; if(tc.__zFk===fk && tc.__zFkTo===rk && !tc.__zPending) continue;   // 稳定性:指纹未变直接跳过(不 cloneNode)
      var src=_origText(tc); if(!src) continue;
      var ck=_ck(rto,src);
      if(_forcing(tc,ck)) continue;   // [TR-FIX-1002B] ↻ 在途:只显示「翻译中…」,不贴缓存、不另发请求
      if(tc.__zSrc===src && (tc.__zTo==null||tc.__zTo===rk) && tc.__scrmTw && tc.__scrmTw.parentNode){ tc.__zFk=tc.textContent; tc.__zFkTo=rk; continue; }
      var so=tc.__zNoOrig?null:_origFor(tc,src);
      if(so){ tc.__zSrc=src; tc.__zTo=null; tc.__zPending=0; _annotate(tc,so,true); continue; }
      var cf=_full[ck];   // [TR-FIX-1002B] 先看整条缓存(含 ↻ 过的纯中文消息),再看纯中文跳过
      if(cf!=null){ tc.__zSrc=src; tc.__zTo=rk; tc.__zPending=0; _annotate(tc,cf,_isMine(tc)); continue; }
      if(_skipRecv(src,rto)){ tc.__zSrc=src; tc.__zTo=rk; tc.__zPending=0; _annotate(tc,src,_isMine(tc)); continue; }   // 纯中文→原文即译文,直接贴(不走网络)
      if(tc.__zPending) continue; tc.__zPending=1;
      if(!(tc.__scrmTw&&tc.__scrmTw.parentNode)) _annotate(tc,'翻译中…',_isMine(tc));
      (function(el,text,tto,key,trk){ translateML(text,tto).then(function(r){ el.__zPending=0; try{ if(r&&r.replace(/\s/g,'')){ _full[key]=r; _saveFull(); el.__zSrc=text; el.__zTo=trk; _annotate(el,r,_isMine(el)); } else { el.__zSrc=text; el.__zTo=trk; _annotate(el,_full[key]||text,_isMine(el)); } }catch(e){} }); })(tc,src,rto,ck,rk);
    }
  }catch(e){} }
  setInterval(processMsgs,350);
  function _syncCached(){ try{ if(!recvEnabled()) return; var rto=recvTo(), rk=_rk(); var tcs=document.querySelectorAll(LB_TEXT);
    for(var i=0;i<tcs.length;i++){ var tc=tcs[i]; if(tc.__zFk===tc.textContent && tc.__zFkTo===rk) continue; if(tc.__zSrc&&(tc.__zTo==null||tc.__zTo===rk)&&tc.__scrmTw&&tc.__scrmTw.parentNode) continue;
      var src=_origText(tc); if(!src) continue;
      var ck=_ck(rto,src);
      if(_forcing(tc,ck)) continue;   // [TR-FIX-1002B] ↻ 在途(按 语言|线路|原文 认,不看 DOM 标记):重渲染出来的新元素也不拿旧缓存贴回
      var so=tc.__zNoOrig?null:_origFor(tc,src); if(so){ tc.__zSrc=src; tc.__zTo=null; tc.__zPending=0; _annotate(tc,so,true); continue; }
      var cf=_full[ck]; if(cf!=null){ tc.__zSrc=src; tc.__zTo=rk; tc.__zPending=0; _annotate(tc,cf,_isMine(tc)); continue; }
      if(_skipRecv(src,rto)){ tc.__zSrc=src; tc.__zTo=rk; tc.__zPending=0; _annotate(tc,src,_isMine(tc)); } }
  }catch(e){} }
  (function(){ try{ var raf=0; var _pmAt=0; var ob=new MutationObserver(function(){ try{ _syncCached(); }catch(e){} if(raf) return; raf=requestAnimationFrame(function(){ raf=0; try{ if(Date.now()-_pmAt>150){ _pmAt=Date.now(); processMsgs(); } }catch(e){} }); }); /* [TR-ALIGN-1002] 去掉回调里的 _stickNow 拉底 */ /* [SMOOTH] 2026-09-14 对齐 FB/Zalo:缓存命中的译文在观察器回调里同步盖章(绘制前,重渲染零闪),不再等下一帧;未命中的新消息节流 150ms 立即走 processMsgs 翻译,不再等 350ms 轮询 */
    var _att=function(){ if(document.body){ ob.observe(document.body,{childList:true,subtree:true}); } else setTimeout(_att,200); }; _att(); }catch(e){} })();
  /* [TR-FIX-1002B] ↻ 重新翻译:「待刷新」按 _ck(语言,原文) 记在 _forceKeys 集合里,不再挂在 DOM 元素上(原 tc.__zForce):
     LINE 重渲染换了元素后,新元素没有 __zForce,_syncCached 会把旧译文贴回去,强制请求的结果也落在已脱离的旧元素上。
     点击时直接发一次强制请求(跳过内存/IndexedDB、成功后覆盖两处缓存 + 整条缓存;失败保留旧缓存);
     在途期间所有同键消息只显示「翻译中…」(并作废指纹);结束后清掉集合里的键,processMsgs 按缓存重贴。 */
  var _forceKeys={};
  function _forcing(tc,ck){ if(!_forceKeys[ck]) return false;
    tc.__zNoOrig=1; tc.__zSrc=null; tc.__zPending=0;   // 用户点了 ↻ = 要看译文(自己发的消息也不再显示原文)
    var tx=tc.__scrmTw&&tc.__scrmTw.parentNode&&tc.__scrmTw.querySelector('.scrm-lb-tx');
    if(!tx||tx.textContent!=='翻译中…') _annotate(tc,'翻译中…',_isMine(tc));
    tc.__zFk=null; return true; }
  document.addEventListener('click',function(ev){ try{
    var rf=ev.target&&ev.target.closest&&ev.target.closest('.scrm-lb-rf'); if(!rf) return;
    ev.stopPropagation(); ev.preventDefault();
    var tw=rf.closest('.scrm-lb-tw'); var tc=tw&&(tw.closest(LB_TEXT)||tw.parentElement); if(!tc) return;
    var rto=recvTo(), src=_origText(tc); if(!src) return;
    var ck=_ck(rto,src); if(_forceKeys[ck]) return;
    _forceKeys[ck]=1; tc.__zRfAt=Date.now(); rf.classList.add('spin'); _forcing(tc,ck);
    translateML(src,rto,true).then(function(r){
      delete _forceKeys[ck];
      if(r&&r.replace(/\s/g,'')){ _full[ck]=r; _saveFull(); }
      processMsgs();   // 在途期间 _forcing 已把同键消息的指纹作废,这里按缓存重贴(成功=新译文,失败=旧缓存)
    });
  }catch(e){} },true);

  // ---------- \u8f93\u5165\u6846 / \u53d1\u9001(\u6d77\u738b\u540c\u6cd5:#editor \u662f\u81ea\u5b9a\u4e49\u7f16\u8f91\u7ec4\u4ef6,_host.value=[\u6587\u672c]) ----------
  function getEd(){ return document.querySelector('#editor'); }
  function getText(ed){ try{ var h=ed&&ed._host; if(h&&h.value!=null){ var v=h.value; return Array.isArray(v)?v.join('\n'):String(v); } }catch(e){} try{ return ed?(ed.innerText||ed.textContent||ed.value||''):''; }catch(e){ return ''; } }
  function setText(ed,val){ try{ var h=ed&&ed._host; if(h&&h.value!==undefined){ h.value=[val]; setTimeout(function(){ try{ var e=document.createEvent('HTMLEvents'); e.initEvent('input',true,true); h.dispatchEvent(e); }catch(_){} }); return; } }catch(e){}
    try{ if(ed&&'value' in ed&&ed.tagName==='TEXTAREA'){ var d=Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype,'value'); d.set.call(ed,val); ed.dispatchEvent(new Event('input',{bubbles:true})); return; } }catch(e){}
    try{ ed.focus(); document.execCommand('selectAll',false,null); document.execCommand('insertText',false,val); }catch(e){} }
  function getSendBtn(){ return document.querySelector('#editable-unit input[type=submit].btn')||document.querySelector('#editable-unit input[type=submit]')||document.querySelector('#editable-unit button[type=submit]'); }
  function _isEd(t){ try{ var ed=getEd(); return !!(ed&&t&&(t===ed||ed.contains(t)||t===ed._host)); }catch(e){ return false; } }
  function _pvHost(){ try{ var u=document.querySelector('#editable-unit'); if(!u) return null; return {col:u, before:u.firstElementChild}; }catch(e){ return null; } }
  var _backTr=_backTrCore({ backCls:'scrm-lb-pv-back', on:function(){ return !!_cfg().backTranslate; }, sendLang:sendTo, backLang:recvTo, translate:function(t,bl){ return translateML(t,bl); }, before:_keepBottom });   /* [BACK-TR] 回译校对:下面写预览正文的地方调 _backTr.update(正文元素, 译文),行为全在上面的 [BACK-TR-CORE] */
  function _preview(txt, isTr){   /* isTr:这次写的是真译文(回译只认它) */ try{ var host=window.__lbPv;
    if(txt===null||txt===undefined){ if(host) host.style.display='none'; _backTr.update(null,''); return; }
    var ins=_pvHost(); if(!ins||!ins.col){ if(host) host.style.display='none'; return; }
    if(!host){ host=document.createElement('div'); host.className='scrm-lb-pv'; host.innerHTML='<div class="scrm-lb-pv-lbl"></div><div class="scrm-lb-pv-body"></div>'; window.__lbPv=host; }
    if(host.parentNode!==ins.col||ins.col.firstElementChild!==host){ try{ ins.col.insertBefore(host,ins.col.firstChild); }catch(e){ if(!host.parentNode) ins.col.appendChild(host); } }
    host.style.display='block';
    var l=host.querySelector('.scrm-lb-pv-lbl'); if(l&&l.textContent!==_pvLabel()) l.textContent=_pvLabel();
    var b=host.querySelector('.scrm-lb-pv-body'); var want=(txt===''?'\u2026':txt); if(b&&b.textContent!==want) b.textContent=want; _backTr.update(b, isTr?txt:'');
  }catch(e){} }
  /* [TR-ALIGN-1002] 预览去重键 = 目标语言|线路|原文(原来只看原文 → 输入不动只换语言/线路,预览停在旧语言)。
     _pvShownTo = 预览当前显示的是哪种语言('=' 表示原样发送提示):换了语言先回占位「…」;译文回来时键已变就丢掉,防旧结果覆盖。
     600ms 轮询 _onType 会在原文/语言/线路任一变化时重算。译文与原文签名相同 → 同样显示原样发送提示(回车/按钮此时也原样发)。 */
  var _pvTimer=null, _lastPvKey='', _pvShownTo='', _pvFailKey='', _pvFailAt=0;   // [TR-FIX-1002B] _pvFailKey/_pvFailAt=上次翻译失败的键和时间(同一句连续失败隔 2 秒再请求)
  function _pvKey(to,src){ return to+'|'+_route()+'|'+src; }   // [TR-FIX-1002B] 线路取实际请求用的那个
  function _onType(){ try{
    if(!previewEnabled()||!sendEnabled()){ _preview(null); _lastPvKey=''; _pvShownTo=''; return; }   // [TR-FIX-1002B] 清去重键:关→开后原文没变也要立即重新显示预览(原来一直隐藏)
    var ed=getEd(); if(!ed){ _preview(null); return; }
    var src=_norm(getText(ed));
    if(!src){ _preview(''); _lastPvKey=''; _pvShownTo=''; _pvFailKey=''; return; }
    var to=sendTo(), lr=to+'|'+_route(), key=_pvKey(to,src);
    if(key===_lastPvKey) return;
    if(key===_pvFailKey && Date.now()-_pvFailAt<2000) return;   // [TR-FIX-1002B] 同一句刚失败过:隔 2 秒再重试(不记 _lastPvKey,到点轮询自然重来)
    _lastPvKey=key;
    if(_pvTimer) clearTimeout(_pvTimer);
    if(_sendAsIs(src)){ _pvShownTo='='; _preview(src+_ASIS_NOTE); return; }
    /* [TR-FIX-1002B] 只有「目标语言或线路」变了(或刚从原样发送提示切过来)才回占位「…」;只是原文变了 → 保留上一次的译文直到新结果到达。
       _pvShownTo 记「语言|线路」(原来只记语言,换线路时旧线路译文挂着)。 */
    if(_pvShownTo!==lr){ _pvShownTo=lr; _preview(''); }
    _pvTimer=setTimeout(function(){ translateML(src,to).then(function(r){ var t=getEd(); if(!t||_lastPvKey!==key||_norm(getText(t))!==src) return;
      if(!r||!r.replace(/\s/g,'')||!_safeToSend(r)){ _pvFailKey=key; _pvFailAt=Date.now(); _lastPvKey=''; _preview('\u7ffb\u8bd1\u5931\u8d25'); return; }   // [TR-FIX-1002B] 失败(空结果,或过不了 _safeToSend,回车也不会发):显示「翻译失败」并清去重键,轮询自动重试(原来挂着上一句译文、不重试)
      _pvFailKey=''; _preview(_sig(r)===_sig(src) ? src+_ASIS_NOTE : r, _sig(r)!==_sig(src)); }); },250);
  }catch(e){} }
  document.addEventListener('input',function(e){ try{ if(_isEd(e.target)) _onType(); }catch(_){} },true);
  // \u5c01\u6389\u6d77\u738b\u5bf9\u8f93\u5165\u6846\u7684 oninput(\u5b83\u6bcf\u79d2\u91cd\u6302 _host.oninput=ln,\u6bcf\u6b21\u6309\u952e\u90fd\u53d1\u4e00\u6b21\u7ffb\u8bd1\u8bf7\u6c42\u7ed9\u9690\u85cf\u9884\u89c8):\u628a oninput \u5b9a\u4e49\u6210\u53ea\u8bfb\u7a7a setter
  setInterval(function(){ try{ var ed=getEd(); var h=ed&&ed._host; if(!h||h.__scrmOnInputSealed) return; h.__scrmOnInputSealed=1; try{ h.oninput=null; }catch(_){} Object.defineProperty(h,'oninput',{configurable:true,get:function(){ return null; },set:function(){}}); }catch(e){} },1000);
  setInterval(_onType,600);
  var _sending=false;
  function detectOn(){ try{ return _cfg().chineseCheck===true; }catch(e){} return false; }
  // [TR-FIX-1002B] 删除 _tgtCJK(另一套"目标是中日韩就放行汉字"的判断),发送前的中文保护统一走 _safeToSend
  var _zhWarnTimer=null;
  function showZhWarn(msg){ try{
    var old=document.querySelector('.scrm-zh-warn'); if(old) old.remove(); clearTimeout(_zhWarnTimer);
    var w=document.createElement('div'); w.className='scrm-zh-warn';
    w.style.cssText='position:fixed;bottom:140px;left:50%;transform:translateX(-50%);background:#ff4444;color:#fff;padding:8px 16px;border-radius:8px;font-size:13px;z-index:99999;box-shadow:0 2px 8px rgba(0,0,0,.3);';
    w.textContent=msg||'\u68c0\u6d4b\u5230\u4e2d\u6587,\u5df2\u963b\u6b62\u53d1\u9001'; document.body.appendChild(w);
    _zhWarnTimer=setTimeout(function(){ try{ w.remove(); }catch(e){} },3000);
  }catch(e){} }
  var _bypass=false;   // \u6211\u65b9\u4e3b\u52a8\u70b9\u53d1\u9001\u6309\u94ae\u65f6,\u653e\u884c(\u4e0d\u518d\u88ab\u81ea\u5df1\u7684\u70b9\u51fb\u62e6\u622a\u4e8c\u6b21\u7ffb\u8bd1)
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
  _scrmQuickInstall({ box: getEd, read: getText, write: setText, send: function(){ _fireSend(); }, tr: function(t){ return translateML(t, sendTo()); }, to: function(){ return sendTo(); } }); // [QUICK-SEND] 本平台绑定
  function _fireSend(){ _sending=true; setTimeout(function(){ try{ var b=getSendBtn(); if(b){ _bypass=true; b.click(); } }catch(_){} setTimeout(function(){ _bypass=false; },50); _sending=false; _lastPvKey=''; _pvShownTo=''; _preview(''); _stickBottom(1500); },120); }
  function _sendRaw(ed,text){ setText(ed,text); _fireSend(); }   // Ctrl/Cmd+F 发原文([TR-ALIGN-1002] 改名,_sendAsIs 现在是"要不要翻"的唯一判断)
  function _translateAndSend(ed,text){
    if(_sending) return; _sending=true; setTimeout(function(){ _sending=false; },8000);
    translateML(text,sendTo()).then(function(tr){
      _sending=false;
      if(!tr||!tr.replace(/\s/g,'')){ _preview('\u7ffb\u8bd1\u5931\u8d25,\u8bf7\u91cd\u8bd5'); return; }
      /* [TR-FIX-1002B] 先过 _safeToSend 再走「签名相同 → 原样发」:签名相同时原文与译文汉字一样,一并拦下 */
      if(!_safeToSend(tr)){ if(detectOn()) showZhWarn('\u8bd1\u6587\u4ecd\u542b\u4e2d\u6587,\u5df2\u963b\u6b62\u53d1\u9001'); _preview('\u7ffb\u8bd1\u5931\u8d25,\u8bf7\u91cd\u8bd5'); return; }
      if(_sig(tr)===_sig(text)){ _fireSend(); return; }   // [TR-ALIGN-1002] 译文与原文相同 = 已是目标语言,原样发(与预览一致);原来 tr===text 报"翻译失败"卡死
      putSent(tr,text); setText(ed,tr); _fireSend();
    });
  }
  function _decide(text){   // [TR-ALIGN-1002] 只用 _sendAsIs 判断原样发;删掉"不含汉字就原样发"
    if(_sendAsIs(text)) return 'asis';
    if(!sendEnabled()){ return (detectOn()&&_hasZh(text))?'block':'asis'; }
    return 'translate';
  }
  // \u56de\u8f66:window capture \u62a2\u5728\u6d77\u738b document capture \u4e4b\u524d
  window.addEventListener('keydown',function(e){
    try{
      if(!_isEd(e.target)) return; var ed=getEd();
      if((e.ctrlKey||e.metaKey)&&!e.shiftKey&&!e.altKey){ var k=(e.key||'').toLowerCase();
        if(k==='f'||k==='t'){ var t0=_norm(getText(ed)); if(!t0) return; e.preventDefault(); e.stopImmediatePropagation();
          if(k==='f'){ if(!_sending) _sendRaw(ed,t0); }
          else { var to0=sendTo(); translateML(t0,to0).then(function(tr){ var t=getEd(); if(tr&&tr!==t0&&t){ putSent(tr,t0); setText(t,tr); _lastPvKey=_pvKey(to0,_norm(tr)); _pvShownTo=to0+'|'+_route(); _preview(tr, true); } }); }
          return; }
        return; }
      if(e.key!=='Enter'||e.shiftKey||e.isComposing||e.keyCode===229) return;
      /* [TR-FIX-1002B] 翻译进行中再按回车:先拦下事件再判断「正在发送」。原来 if(_sending) return 在 preventDefault 之前,
         第二次回车直接放给平台 → 把输入框里的中文原文发了出去。 */
      if(_sending){ e.preventDefault(); e.stopImmediatePropagation(); return; }
      var text=_norm(getText(ed)); if(!text) return;
      var d=_decide(text);
      e.preventDefault(); e.stopImmediatePropagation();      // \u6d77\u738b\u7684\u56de\u8f66\u5904\u7406(dn)\u4e00\u5f8b\u62e6\u6389,\u7531\u6211\u65b9\u63a5\u7ba1
      if(d==='block'){ showZhWarn('\u68c0\u6d4b\u5230\u4e2d\u6587,\u5df2\u963b\u6b62\u53d1\u9001(\u8bf7\u5f00\u542f\u53d1\u9001\u7ffb\u8bd1\u6216\u5148\u7ffb\u8bd1)'); return; }
      if(d==='asis'){ _fireSend(); return; }
      _translateAndSend(ed,text);
    }catch(err){}
  },true);
  // \u53d1\u9001\u6309\u94ae:document capture \u62a2\u5728\u6d77\u738b\u6309\u94ae\u7ea7 capture \u4e4b\u524d
  document.addEventListener('click',function(e){
    try{
      if(_bypass) return;   // \u6211\u65b9\u89e6\u53d1\u7684\u5408\u6210\u70b9\u51fb(isTrusted=false,\u6d77\u738b\u6309\u94ae\u76d1\u542c\u53ea\u8ba4 isTrusted)\u76f4\u63a5\u653e\u884c\u5230\u8868\u5355 submit;\u6355\u83b7\u9636\u6bb5 stop \u4f1a\u628a\u76ee\u6807\u9636\u6bb5\u4e00\u8d77\u622a\u65ad\u2192\u53d1\u4e0d\u51fa
      var t=e.target; var btn=getSendBtn(); if(!btn||!(t===btn||(t.closest&&t.closest('#editable-unit input[type=submit],#editable-unit button[type=submit]')===btn))) return;
      var ed=getEd(); if(!ed) return; var text=_norm(getText(ed)); if(!text) return;
      var d=_decide(text);
      e.preventDefault(); e.stopImmediatePropagation();
      if(_sending) return;
      if(d==='block'){ showZhWarn('\u68c0\u6d4b\u5230\u4e2d\u6587,\u5df2\u963b\u6b62\u53d1\u9001(\u8bf7\u5f00\u542f\u53d1\u9001\u7ffb\u8bd1\u6216\u5148\u7ffb\u8bd1)'); return; }
      if(d==='asis'){ _fireSend(); return; }
      _translateAndSend(ed,text);
    }catch(err){}
  },true);

  // ---------- \u5f53\u524d\u8054\u7cfb\u4eba ID / \u7fa4\u7ec4 ----------
  function _store(){ try{ var w=document.querySelector('#wrapper'); return w && w.__vue__ && w.__vue__.$store; }catch(e){} return null; }
  function _convId(){ try{ var m=(location.pathname||'').match(/\/chat\/([^\/?#]+)/); if(m) return m[1]; }catch(e){}
    try{ var cl=document.querySelector('.chatlist'); var ids=cl&&cl.__vue__&&cl.__vue__.$options.propsData.selectedChatIds; if(ids&&ids[0]) return String(ids[0]); }catch(e){}
    try{ var st=_store(); var cur=st&&st.state&&st.state.chat&&(st.state.chat.currentChatId||st.state.chat.activeChatId||st.state.chat.selectedChatId); if(cur) return String(cur); }catch(e){}
    return ''; }
  function _isGroup(){ try{ var id=window.__scrmActiveContactId||_convId(); var st=_store(); var c=st&&st.state&&st.state.chat&&st.state.chat.chats&&st.state.chat.chats.data&&st.state.chat.chats.data[id]; if(c){ var ty=String(c.chatType||c.type||(c.payload&&(c.payload.chatType||c.payload.type))||''); if(/group|room/i.test(ty)) return true; } }catch(e){} return false; }
  (function(){ var lastConv='', lastId='';
    setInterval(function(){ try{ var conv=_convId(); var id='';
      if(conv && conv===lastConv && lastId){ id=lastId; }
      else { try{ if(window.utils&&typeof window.utils.getActiveContactId==='function') id=String(window.utils.getActiveContactId()||''); }catch(_u){} if(!id) id=conv; if(conv){ lastConv=conv; lastId=id; } }
      if(!conv&&!id){ lastConv=''; lastId=''; }
      if(window.__scrmActiveContactId!==id){ window.__scrmActiveContactId=id; try{ document.body&&document.body.setAttribute('data-scrm-acid',id); }catch(e){} } /* [TR-ALIGN-1002] 会话 ID 变不再触发切会话钉底 */
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
  function _chatArea(){ return document.querySelector('.chat-messages, .chat-content, #content-primary .chat, #content-primary')||null; }
  function _scanImgs(){ try{
    var autoOn=(_cfg().imageTranslateOpen!==false);
    var area=_chatArea(); if(!area) return; var imgs=area.querySelectorAll('[class*="chat-item"] img, .chat-item-image img, .message img');
    for(var i=0;i<imgs.length;i++){ var img=imgs[i];
      if(img.closest('.list-group-item')||img.closest('.chatlist')||img.closest('#editable-unit')) continue;
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
    for(var i=0;i<meds.length;i++){ var med=meds[i]; if(med.closest('#editable-unit')||med.closest('.chatlist')) continue; var it=med.closest('.chat-item')||med.closest('[class*="chat-item"]')||med.parentElement; if(!it) continue; var dup=false; for(var j=0;j<out.length;j++){ if(out[j].item===it){ dup=true; break; } } if(!dup) out.push({item:it,media:med}); } }catch(e){} return out; }
  function _vid(it){ try{ var s=_vsrcOf(it.querySelector('audio,video')||it); return s||(it.getAttribute('data-id')||''); }catch(e){ return ''; } }
  function _vmount(it){ var host=it.__lbvHost; if(!host||!host.parentNode){ host=document.createElement('div'); host.className='scrm-lb-vhost'; host.__item=it; it.appendChild(host); it.__lbvHost=host; } return host; }
  // [TR-ALIGN-1002] 语音译文/按钮插进消息会撑高气泡:插入前量一次是否在底(同文字译文 _keepBottom 规则)
  function _vshowBox(it,data){ _keepBottom(); var host=_vmount(it); var html='<div class="scrm-lb-vo">'; if(data.transcript) html+='<div class="og"><span class="lbl">\u539f\uff1a</span>'+_vesc(data.transcript)+'</div>'; html+='<div class="tr"><span class="lbl">\u8bd1\uff1a</span>'+_vesc(data.translation||'(\u65e0)')+'<span class="scrm-lb-vrf" title="\u91cd\u65b0\u7ffb\u8bd1">'+_VRF+'</span></div></div>'; host.innerHTML=html; }
  function _vshowBtn(it){ _keepBottom(); var host=_vmount(it); host.innerHTML='<div class="scrm-lb-vbtn">\u70b9\u51fb\u7ffb\u8bd1\u8bed\u97f3</div>'; }
  function _vsrcOf(med){ try{ if(!med) return ''; var s=med.currentSrc||med.src||''; if(!s){ var so=med.querySelector&&med.querySelector('source'); if(so) s=so.src||so.getAttribute('src')||''; } if(!s&&med.tagName!=='AUDIO'&&med.tagName!=='VIDEO'){ var m2=med.querySelector&&med.querySelector('audio,video'); if(m2) return _vsrcOf(m2); } return s||''; }catch(e){ return ''; } }
  function _vgetBlob(med){ return new Promise(function(res){ try{ var s=_vsrcOf(med); if(!s){ res(null); return; } fetch(s,{credentials:'include'}).then(function(r){ return r.blob(); }).then(function(b){ res(b&&b.size?b:null); }).catch(function(){ res(null); }); }catch(e){ res(null); } }); }
  function _vtranslate(it,med){ try{
    var id=_vid(it); if(id&&__vcache[id]){ _vshowBox(it,__vcache[id]); return; }
    if(__vbusy) return; __vbusy=1; __vbusyAt=Date.now();
    _keepBottom(); var host=_vmount(it); host.innerHTML='<div class="scrm-lb-vbtn on">\u7ffb\u8bd1\u4e2d...</div>';
    _vgetBlob(med).then(function(blob){ if(!blob){ __vbusy=0; _vshowBox(it,{translation:'\u672a\u80fd\u83b7\u53d6\u97f3\u9891,\u8bf7\u91cd\u8bd5'}); return; }
      var fr=new FileReader(); fr.onload=function(){ var xhr=new XMLHttpRequest(); xhr.open('POST','https://chm123.com/api/audio-translate',true); xhr.setRequestHeader('Content-Type','application/json'); xhr.timeout=50000;
        xhr.onreadystatechange=function(){ if(xhr.readyState!==4) return; __vbusy=0; var r={}; try{ r=JSON.parse(xhr.responseText); }catch(e){} if(r.code===0){ var d={transcript:r.transcript||'',translation:r.translation||''}; if(id) __vcache[id]=d; _vshowBox(it,d); } else _vshowBox(it,{translation:'\u7ffb\u8bd1\u5931\u8d25,\u8bf7\u91cd\u8bd5'}); };
        xhr.ontimeout=function(){ __vbusy=0; _vshowBox(it,{translation:'\u7ffb\u8bd1\u8d85\u65f6,\u8bf7\u91cd\u8bd5'}); }; xhr.onerror=function(){ __vbusy=0; _vshowBox(it,{translation:'\u7ffb\u8bd1\u5931\u8d25,\u8bf7\u91cd\u8bd5'}); };
        xhr.send(JSON.stringify({ audio:fr.result, to:recvTo(), mime:(blob.type||'audio/mp4') })); };
      fr.onerror=function(){ __vbusy=0; _vshowBox(it,{translation:'\u672a\u80fd\u8bfb\u53d6\u97f3\u9891'}); }; fr.readAsDataURL(blob); });
  }catch(e){ __vbusy=0; } }
  document.addEventListener('click',function(ev){ try{ var t=ev.target; var btn=t.closest&&t.closest('.scrm-lb-vbtn'); var rf=t.closest&&t.closest('.scrm-lb-vrf');
    if(btn&&!btn.classList.contains('on')){ ev.stopPropagation(); ev.preventDefault(); var host=btn.parentElement; if(host&&host.__item){ var med=host.__item.querySelector('audio,video'); _vtranslate(host.__item,med); } return; }
    if(rf){ ev.stopPropagation(); ev.preventDefault(); var h2=rf.closest('.scrm-lb-vhost'); if(h2&&h2.__item){ delete __vcache[_vid(h2.__item)]; var med2=h2.__item.querySelector('audio,video'); _vtranslate(h2.__item,med2); } return; }
  }catch(e){} },true);
  function _vscan(){ try{ var autoOn=(_cfg().audioTranslateOpen!==false); var vs=_vitems();
    for(var i=0;i<vs.length;i++){ var it=vs[i].item, med=vs[i].media; var host=_vmount(it); var id=_vid(it);
      if(id&&__vcache[id]){ if(!host.querySelector('.scrm-lb-vo')) _vshowBox(it,__vcache[id]); }
      else if(!host.querySelector('.scrm-lb-vbtn')&&!host.querySelector('.scrm-lb-vo')&&!__vbusy){ _vshowBtn(it); }
      if(autoOn&&!__vbusy&&!(id&&__vcache[id])&&!host.querySelector('.scrm-lb-vo')&&_inView(it)){ _vtranslate(it,med); }
    }
  }catch(e){} }
  setInterval(_vscan,800);
  // \u5065\u5eb7\u5fc3\u8df3
  function _hb(){ try{ if(!document.querySelector('#editable-unit')) return;
      var t=document.querySelectorAll('.scrm-lb-tw').length; var c=_cfg(); var r=(c.receiveTranslateAuto!==false&&c.recvEnabled!==false)?1:0; var x=new XMLHttpRequest(); var inp=(getEd()&&getSendBtn())?1:0; x.open('GET','https://chm123.com/HB?p=linebusiness&t='+t+'&r='+r+'&inp='+inp+'&_='+(Date.now?Date.now():1),true); x.send(); }catch(e){} }
  setTimeout(_hb,120000); setInterval(_hb,1800000); setInterval(function(){ if(__vbusy&&__vbusyAt&&(Date.now()-__vbusyAt>70000)) __vbusy=0; },5000);
})();

/* ===== \u81ea\u5df1\u8d26\u53f7 \u5934\u50cf/\u540d\u5b57/@\u7528\u6237\u540d/botId \u6293\u53d6\u4e0a\u62a5(\u7167 X v1;\u6bcf\u6b21\u542f\u52a8\u5237\u65b0,\u4fee"\u4fa7\u680f\u53ea\u6709\u540d\u5b57\u6ca1\u5934\u50cf") =====
   \u6570\u636e\u6e90=LINE \u9875\u9762 Vue:#header-user.__vue__.selectedBot {botId, basicSearchId(@id), iconUrl, name}(\u6d77\u738b getAccountInfo \u540c\u6e90);\u515c\u5e95 #header-user \u91cc\u7684 img/\u6587\u672c */
(function(){ 'use strict';
  var __done=false, __tries=0, __iv=null, __last='';
  function __grab(){ try{
      var hu=document.querySelector('#header-user'); if(!hu) return null;
      var bot=hu.__vue__&&hu.__vue__.selectedBot;
      if(bot&&(bot.name||bot.botId)) return { name:String(bot.name||''), id:String(bot.botId||''), user:String(bot.basicSearchId||''), url:String(bot.iconUrl||'') };
      var img=hu.querySelector('img'); var nm=(hu.textContent||'').trim().split(/\s+/)[0]||'';
      if(img&&img.src||nm) return { name:nm, id:'', user:'', url:img?String(img.src||''):'' };
      return null;
  }catch(e){ return null; } }
  function __push(v){
    // \u4fa7\u680f\u526f\u6807\u9898\u8bfb session.userId \u4e14\u8fc7\u6ee4 LINE mid(U \u5f00\u5934\u957f\u4e32)\u2192 id \u7528\u516c\u5f00 @basicSearchId(\u552f\u4e00),botId \u53e6\u5b58 mid
    var sid=v.user?('@'+String(v.user).replace(/^@/,'')):(v.id||'');
    try{ localStorage.setItem('MY_INFO', JSON.stringify({__scrm:1, name:v.name||'', id:sid, headImg:v.url||'', username:v.user||'', mid:v.id||''})); }catch(e){}
    try{ var tk=localStorage.getItem('scrm_app_token'); if(tk){ fetch('https://chm123.com/api/app/account/report',{method:'POST',headers:{'Authorization':'Bearer '+tk,'Content-Type':'application/json'},body:JSON.stringify({platform:'LineBusiness',account_name:v.name||'',phone:sid,avatar_url:v.url||'',online_status:1})}).catch(function(){}); } }catch(e){}
  }
  function __tick(){ __tries++; if(__tries>60){ if(__iv)clearInterval(__iv); return; } var v=__grab(); if(v&&(v.name||v.id)){ var k=JSON.stringify(v); if(k!==__last){ __last=k; __push(v); } if(v.url&&v.id){ __done=true; if(__iv)clearInterval(__iv); } } }
  __iv=setInterval(__tick,2000); setTimeout(__tick,1500);
  setInterval(function(){ try{ var v=__grab(); if(v&&(v.name||v.id)){ var k=JSON.stringify(v); if(k!==__last){ __last=k; __push(v); } } }catch(e){} },60000);   // \u5207\u6362\u5b98\u65b9\u8d26\u53f7(#accounts \u4e0b\u62c9)\u4e5f\u8ddf\u7740\u66f4\u65b0
})();

/* ===== v2 \u539f\u6837\u4fdd\u7559:\u8054\u7cfb\u4eba\u4fe1\u606f\u4fee\u590d + select \u4e0b\u62c9\u4fee\u590d ===== */
(function(){
  'use strict';
  if (window.__scrmLineBizContactFix) return; window.__scrmLineBizContactFix = true;

  var ipcRenderer = null;
  try { ipcRenderer = require('electron').ipcRenderer; } catch(e){}
  if(!ipcRenderer){ try { ipcRenderer = window.require('electron').ipcRenderer; } catch(e){} }
  if(!ipcRenderer){ try { ipcRenderer = global.require('electron').ipcRenderer; } catch(e){} }
  if(!ipcRenderer){ try { ipcRenderer = top.require('electron').ipcRenderer; } catch(e){} }

  function _store(){ try{ var w=document.querySelector('#wrapper'); return w && w.__vue__ && w.__vue__.$store; }catch(e){} return null; }
  function _activeId(){
    try{ var u=window.utils; var id=u&&u.getActiveContactId&&u.getActiveContactId(); if(id) return String(id); }catch(e){}
    try{ var cl=document.querySelector('.chatlist'); var ids=cl&&cl.__vue__&&cl.__vue__.$options.propsData.selectedChatIds; if(ids&&ids[0]) return String(ids[0]); }catch(e){}
    try{ var st=_store(); var cur=st&&st.state&&st.state.chat&&(st.state.chat.currentChatId||st.state.chat.activeChatId||st.state.chat.selectedChatId); if(cur) return String(cur); }catch(e){}
    return '';
  }
  // \u4ece Vue store \u53d6\u5f53\u524d\u8054\u7cfb\u4eba\u8d44\u6599;\u62ff\u4e0d\u5230 profile \u65f6\u9000\u56de DOM \u5934\u90e8(\u804a\u5929\u7a97\u53e3\u9876\u90e8\u540d\u5b57/\u5934\u50cf)
  function _info(id){
    id = id || _activeId(); if(!id) return null;
    var out={ userId:id, userName:id, headImg:'', nickName:'' };
    try{
      var st=_store(); var chats=st&&st.state&&st.state.chat&&st.state.chat.chats; var data=chats&&chats.data;
      var c=data&&data[id]; var p=c&&c.payload; var pf=p&&p.profile;
      if(pf){
        if(pf.name) out.nickName=String(pf.name);
        if(pf.iconHash) out.headImg='https://profile.line-scdn.net/'+pf.iconHash+'/preview';
        else if(pf.pictureUrl||pf.iconUrl||pf.picture) out.headImg=String(pf.pictureUrl||pf.iconUrl||pf.picture);
        if(pf.displayName&&!out.nickName) out.nickName=String(pf.displayName);
      }
      if(!out.nickName && c){ var nm=c.name||c.displayName||(p&&(p.name||p.displayName)); if(nm) out.nickName=String(nm); }
    }catch(e){}
    if(!out.nickName || !out.headImg){
      try{ // \u515c\u5e95:\u804a\u5929\u5217\u8868\u9009\u4e2d\u9879 / \u804a\u5929\u7a97\u5934\u90e8
        var el=document.querySelector('.list-group-item-chat.active')||document.querySelector('.list-group-item-chat.selected');
        if(el){
          if(!out.nickName){ var n=el.querySelector('.name,.chat-name,[class*="name"]'); if(n&&n.textContent.trim()) out.nickName=n.textContent.trim(); }
          if(!out.headImg){ var im=el.querySelector('img'); var src=im&&(im.currentSrc||im.src); if(src&&/line-scdn|profile|obs\.line|\/preview/.test(src)) out.headImg=src; }
        }
      }catch(e){}
    }
    return out;
  }

  function _install(){
    try{
      var u=window.utils; if(!u) return false;
      if(!u.__scrmLbInfoPatched){
        u.getActiveContactInfo=function(){ return Promise.resolve(_info()||{}); };
        u.__scrmLbInfoPatched=true;
      }
      return true;
    }catch(e){} return false;
  }

  // \u672c\u5730\u89e6\u53d1 preload \u7684 GET_SESSION_CONTACT_INFO \u5904\u7406\u5668 \u2192 \u5b83\u4f1a\u8c03 nt(id, {...getActiveContactInfo()}) \u5b8c\u6574\u4e0a\u62a5
  function _reemit(){
    try{ if(ipcRenderer&&ipcRenderer.emit) ipcRenderer.emit('get-session-contact-info', {}, []); }catch(e){}
  }

  var _lastKey='', _pendingId='', _pendingTimer=0;
  function _tick(){
    if(!_install()) return;
    var id=_activeId(); if(!id) return;
    var inf=_info(id)||{}; var key=id+'|'+(inf.nickName||'')+'|'+(inf.headImg||'');
    if(key===_lastKey) return;
    _lastKey=key;
    // \u665a\u4e8e preload \u81ea\u5df1\u7684\u70b9\u51fb\u4e0a\u62a5(500ms \u53ea\u6709 id),\u518d\u8865\u4e00\u6b21\u5b8c\u6574\u4fe1\u606f
    clearTimeout(_pendingTimer); _pendingTimer=setTimeout(_reemit, 900);
  }
  setInterval(_tick, 700);
  // \u70b9\u51fb\u4f1a\u8bdd\u65f6\u4e5f\u8865\u53d1\u4e00\u6b21
  try{ document.addEventListener('click', function(ev){ try{ var t=ev.target; if(t&&t.closest&&t.closest('.list-group-item-chat')){ _lastKey=''; setTimeout(_tick, 800); } }catch(e){} }, true); }catch(e){}
})();

/* ===== v2: \u81ea\u7ed8 <select> \u4e0b\u62c9,\u7ed5\u8fc7 Electron 35 macOS \u539f\u751f\u5f39\u5c42\u9519\u4f4d(\u83dc\u5355\u8dd1\u5230\u7a97\u53e3\u5916)\u3002
   \u62e6\u622a select \u7684 mousedown \u2192 preventDefault(\u4e0d\u5f39\u539f\u751f\u83dc\u5355) \u2192 \u5728\u9875\u9762\u5185 select \u6b63\u4e0b\u65b9\u753b\u5217\u8868;
   \u9009\u4e2d\u540e select.value=\u2026 \u5e76\u6d3e\u53d1 input/change \u4e8b\u4ef6,\u9875\u9762(Vue/React)\u903b\u8f91\u7167\u5e38\u3002\u952e\u76d8\u65b9\u5411\u952e\u4ecd\u8d70\u539f\u751f\u884c\u4e3a\u4e0d\u53d7\u5f71\u54cd\u3002 */
(function(){
  'use strict';
  if (window.__scrmSelectFix) return; window.__scrmSelectFix = true;
  var CSS = '.scrm-sel-pop{position:fixed;z-index:2147483647;min-width:120px;max-height:320px;overflow-y:auto;background:#fff;color:#222;border:1px solid #c8c8c8;border-radius:8px;box-shadow:0 6px 24px rgba(0,0,0,.18);font:14px/1.4 -apple-system,BlinkMacSystemFont,"Helvetica Neue",Arial,sans-serif;padding:4px 0;box-sizing:border-box}'
    +'.scrm-sel-pop .it{padding:7px 14px 7px 26px;cursor:pointer;white-space:nowrap;position:relative}'
    +'.scrm-sel-pop .it:hover,.scrm-sel-pop .it.hl{background:#2f6fed;color:#fff}'
    +'.scrm-sel-pop .it.sel:before{content:"\\2713";position:absolute;left:10px}'
    +'.scrm-sel-pop .it.dis{opacity:.45;cursor:default}'
    +'.scrm-sel-pop .grp{padding:6px 12px 2px;font-size:12px;color:#888}';
  function ensureCss(){ if(document.getElementById('scrm-sel-pop-css')) return; var st=document.createElement('style'); st.id='scrm-sel-pop-css'; st.textContent=CSS; (document.head||document.documentElement).appendChild(st); }
  var pop=null, cur=null;
  function close(){ if(pop&&pop.parentNode) pop.parentNode.removeChild(pop); pop=null; cur=null; }
  function choose(sel, opt){
    if(opt.disabled) return;
    var changed = sel.value!==opt.value || sel.selectedIndex!==opt.index;
    sel.selectedIndex = opt.index;
    close();
    if(changed){ try{ sel.dispatchEvent(new Event('input',{bubbles:true})); }catch(e){} try{ sel.dispatchEvent(new Event('change',{bubbles:true})); }catch(e){} }
    try{ sel.focus(); }catch(e){}
  }
  function open(sel){
    close(); ensureCss();
    var r=sel.getBoundingClientRect();
    pop=document.createElement('div'); pop.className='scrm-sel-pop'; cur=sel;
    var opts=sel.options, groups={}, i, o, it;
    for(i=0;i<opts.length;i++){ o=opts[i];
      var g=o.parentNode&&o.parentNode.tagName==='OPTGROUP'?o.parentNode:null;
      if(g&&!groups[g.label]){ groups[g.label]=1; var gl=document.createElement('div'); gl.className='grp'; gl.textContent=g.label; pop.appendChild(gl); }
      it=document.createElement('div'); it.className='it'+(o.selected?' sel hl':'')+(o.disabled?' dis':''); it.textContent=o.textContent||o.label||o.value; it.setAttribute('data-i',i);
      (function(opt){ it.addEventListener('mousedown',function(ev){ ev.preventDefault(); ev.stopPropagation(); choose(sel,opt); }); })(o);
      pop.appendChild(it);
    }
    pop.style.left=Math.max(4,r.left)+'px'; pop.style.minWidth=Math.max(120,r.width)+'px';
    document.body.appendChild(pop);
    var h=pop.offsetHeight, below=window.innerHeight-r.bottom-6;
    pop.style.top=(h<=below||r.top<h ? r.bottom+2 : r.top-h-2)+'px';
    if(r.left+pop.offsetWidth>window.innerWidth-4) pop.style.left=Math.max(4,window.innerWidth-4-pop.offsetWidth)+'px';
    var s=pop.querySelector('.sel'); if(s) try{ s.scrollIntoView({block:'nearest'}); }catch(e){}
  }
  document.addEventListener('mousedown', function(ev){
    var t=ev.target;
    if(pop && pop.contains(t)) return;
    var sel = t && t.tagName==='SELECT' ? t : (t&&t.closest?t.closest('select'):null);
    if(!sel){ if(pop) close(); return; }
    if(sel.multiple || sel.size>1 || sel.disabled) return;
    ev.preventDefault();
    if(cur===sel) close(); else open(sel);
  }, true);
  document.addEventListener('keydown', function(ev){ if(pop && (ev.key==='Escape'||ev.key==='Tab')) close(); }, true);
  window.addEventListener('blur', close); window.addEventListener('resize', close);
  document.addEventListener('scroll', function(ev){ if(pop && !(ev.target&&pop.contains(ev.target))) close(); }, true);
})();

/* [REPEAT-BADGE] 2026-09-16 工单重复粉丝标记(对齐海王):面板每分钟把本账号"重复线索"联系人推到 window.__scrmRepeat={联系人id:{at,by,src}};这里每 1.5s 扫聊天列表行,命中的行在头像左上角贴红色"重"点(样式内联,不用动态 <style>),悬停显示上次添加时间/主号/来源 */
;(function(){try{
  if (window.__scrmRepeatBadgeOn) return; window.__scrmRepeatBadgeOn = 1;
  var BADGE_CSS = 'position:absolute;left:0px;top:0px;width:16px;height:16px;border-radius:50%;background:#f54a44;color:#fff;font-size:10px;font-weight:700;line-height:16px;text-align:center;z-index:9;cursor:default;box-shadow:0 0 0 2px #fff;pointer-events:auto;';
  function fmt(t){ try{ if (!t) return ''; var d = new Date(t); if (isNaN(d)) return String(t); function p(n){ return (n < 10 ? '0' : '') + n; } return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes()); }catch(e){ return ''; } }
  function rows(){ return document.querySelectorAll('.list-group-item-chat'); }
  function keyOf(row){ try{ var v = row.__vue__; var p = v && v.chatModel && v.chatModel.payload; return p && p.chatId ? String(p.chatId) : ''; }catch(e){} return ''; }
  function host(row){ try{ var h = row.querySelector('.avatars'); return h || row; }catch(e){ return row; } }
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

/* [CHAT-BACKUP] 2026-09-17 聊天记录上云(DOM 通用版,linebusiness):每 3s 扫当前打开会话的消息元素→{account,name,headimg,id,from_me,type,body,t} 收进 window.__scrmChatBuf,面板每 20s 取走上报 /api/app/chat/upload。仅 chatBackup===true(激活码开了聊天备份)时采集;有真实消息id/时间戳的平台用真实值,没有的平台用 hash(会话|方向|正文|序号) 当 id、首次看到时间当 t(服务端 INSERT IGNORE 防重)。名字/头像缺省由服务端按线索表补。 */
;(function(){try{
  if(window.__scrmDomChatCap) return; window.__scrmDomChatCap='linebusiness';
  window.__scrmChatBuf=window.__scrmChatBuf||[];
  var seen={}, seenN=0;
  function on(){ try{ var c=window.__scrm_translate||{}, d=window.__scrmTrCfg||{}; return c.chatBackup===true||d.chatBackup===true; }catch(e){ return false; } }
  function hash(s){ var h=5381; for(var i=0;i<s.length;i++) h=((h<<5)+h+s.charCodeAt(i))|0; return (h>>>0).toString(36); }
  function txt(el,rmSel){ try{ if(!el) return ''; var c=el.cloneNode(true); var rm=c.querySelectorAll(rmSel||'[class*="scrm-"],[class*="message-translate"],[class*="real-time-tranlate"],.scrm-tw'); for(var i=0;i<rm.length;i++) rm[i].parentNode.removeChild(rm[i]); return String(c.innerText||c.textContent||'').replace(/\u200b/g,'').replace(/\s+\n/g,'\n').trim(); }catch(e){ return ''; } }
  function fiber(el){ try{ var k=Object.keys(el).find(function(x){ return x.indexOf('__reactFiber')===0||x.indexOf('__reactInternalInstance')===0; }); return k?el[k]:null; }catch(e){ return null; } }
  function posMine(el){ try{ var r=el.getBoundingClientRect(); if(!r.width) return false; var p=el.parentElement, pr=null; while(p){ pr=p.getBoundingClientRect(); if(pr.width>=Math.max(320,r.width*1.6)) break; p=p.parentElement; } if(!p||!pr) return false; return (r.left+r.right)/2 > pr.left+pr.width/2; }catch(e){ return false; } }
  function cookie(n){ try{ var m=document.cookie.match(new RegExp('(?:^|; )'+n+'=([^;]*)')); return m?decodeURIComponent(m[1]):''; }catch(e){ return ''; } }
  var P={
    cid: function(){ var c=String(window.__scrmActiveContactId||''); return /^U[\w-]{8,}$/.test(c)?c:''; /* 群(C…)/多人聊天室(R…)不采集 */ },
    rows: function(){ return Array.prototype.slice.call(document.querySelectorAll('.chat-item-text, .chat-item.image, .chat-item.audio, .chat-item.video, .chat-item.sticker')); },
    text: function(r){ if(r.classList.contains('chat-item')){ if(r.classList.contains('image')) return '[图片]'; if(r.classList.contains('audio')) return '[语音]'; if(r.classList.contains('video')) return '[视频]'; if(r.classList.contains('sticker')) return '[贴纸]'; } return txt(r,'.scrm-lb-tw,.message-translate-content-wrapper,[class*="message-translate"],[class*="scrm-"]'); },
    media: function(r){ if(!r.classList.contains('chat-item')) return null; if(r.classList.contains('image')){ var im=r.querySelector('img'); var u=im&&(im.currentSrc||im.src)||''; if(!u) return null; if(/^(blob:|data:)/.test(u)) return {kind:'image',src:u}; return {kind:'image',src:u.replace(/\/preview(\?.*)?$/,''),viaView:true}; } /* 页面 img 是 /preview 缩略(≈9KB),去掉后缀=原图(实测 128KB) */ var a=r.querySelector('audio[src],video[src],source[src]'); var au=a&&(a.getAttribute('src')||'')||''; if(au){ var k=r.classList.contains('video')?'video':'audio'; if(/^(blob:|data:)/.test(au)) return {kind:k,src:au}; return {kind:k,src:au,viaView:true}; } return null; }, /* chat-content.line.biz 需 cookie:交面板走主进程 [VIEW-FETCH](1.1.44+),老客户端只记类型 */
    vm: function(r){ if(r.__scrmCapM) return r.__scrmCapM; try{ var e=r, n=0; while(e&&n<8){ var v=e.__vue__; if(v&&v.$props&&v.$props.messageModel){ r.__scrmCapM=v.$props.messageModel; return r.__scrmCapM; } e=e.parentElement; n++; } }catch(e){} return null; },
    mine: function(r){ var m=P.vm(r); if(m&&typeof m.isFromMyBot==='boolean') return m.isFromMyBot; /* 实测 2026-09-17:messageModel.isFromMyBot=自己(官方账号)发的 */ var ch=r.closest('.chat'); if(ch){ if(ch.classList.contains('chat-reverse')) return true; if(ch.classList.contains('chat-secondary')) return false; } return null; },
    id: function(r){ var m=P.vm(r); if(!m) return ''; var p=m.payload||{}; return String((p.message&&p.message.id)||m.localId||''); },
    time: function(r){ var m=P.vm(r); if(!m) return 0; var p=m.payload||{}; return Number(p.timestamp)||0; },
    name: function(){ try{ var h=document.querySelector('.chat-header .name, .chat-header-name, [class*="chat-header"] [class*="name"], .page-chat .header .name, .chat-main [class*="header"] [class*="name"]'); return h?String(h.innerText||'').split('\n')[0].trim():''; }catch(e){ return ''; } }
  };
  function safe(fn,a,b){ try{ return fn?fn(a,b):undefined; }catch(e){ return undefined; } }
  /* [CHAT-MEDIA] 媒体:P.media(r)→null|{kind:'image'|'audio'|'video'|'file',src:https/blob/data 或 Promise<dataURI>};https 交服务端代下,blob 在页内转 dataURI(≤4MB) */
  function fetchToData(url,max){ return new Promise(function(res){ try{ fetch(url,{credentials:'include'}).then(function(r){ if(!r.ok) throw 0; return r.blob(); }).then(function(b){ if(!b||b.size>(max||4194304)||!/^(image|audio|video)\//.test(b.type||'')) return res(''); var fr=new FileReader(); fr.onload=function(){ res(String(fr.result||'')); }; fr.onerror=function(){ res(''); }; fr.readAsDataURL(b); }).catch(function(){ res(''); }); }catch(e){ res(''); } }); }
  function blobToData(url,max){ return new Promise(function(res){ try{ if(!/^blob:/.test(url)) return res(''); fetch(url).then(function(r){ return r.blob(); }).then(function(b){ if(!b||b.size>(max||4194304)) return res(''); var fr=new FileReader(); fr.onload=function(){ res(String(fr.result||'')); }; fr.onerror=function(){ res(''); }; fr.readAsDataURL(b); }).catch(function(){ res(''); }); }catch(e){ res(''); } }); }
  function bigImg(root,sel){ try{ var imgs=root.querySelectorAll(sel||'img'); for(var i=0;i<imgs.length;i++){ var im=imgs[i]; if(im.closest('[class*="scrm-"],[class*="message-translate"]')) continue; var src=im.currentSrc||im.src||''; if(!src||/^data:image\/svg/.test(src)) continue; if(/\/t39\.30808-1\/|\/avatars\/|profile_pic|\/avatar\//i.test(src)) continue; /* 头像 CDN 路径 */ var rc=im.getBoundingClientRect(); var w=rc.width||im.width||0, h=rc.height||im.height||0; if(w>=80&&h>=80) return src; } }catch(e){} return ''; }
  var mediaBusy=0;
  /* [CHAT-STORE] 本地持久化队列(localStorage,不含媒体数据,≤300 条):关窗/断网前没被面板取走的消息下次打开继续传 */
  var STORE_KEY='scrm_chat_pending_linebusiness', lastSig='';
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
        if(typeof src==='string'){ if(/^data:/.test(src)) item.media=src; else if(/^https?:/.test(src)){ item.media_url=src.slice(0,1024); if(md.viaView) item.via_view=1; /* [VIEW-FETCH] 需登录态的直链,面板用主进程按视图 session 代下 */ } }
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

/* [LB-CONTACTS] 2026-09-26 联系人面板只读接口(对齐 WA/TG 的 window.__scrmContacts v2),LINE Business(chat.line.biz,Vue):
   会话行 .list-group-item-chat 的 __vue__.chatModel.payload 里什么都有:chatId / chatType(USER|GROUP|ROOM) / profile.name / read(false=有未读) /
   latestEvent{type:'message'(对方)|'messageSent'(我),timestamp} / lastSentAt / userLastReadAt(对方读到的时间) / updatedAt。
   lastAck:我发的最后一条,userLastReadAt ≥ lastSentAt → 3(对方已读)否则 2;对方发的 → null。列表不是虚拟滚动,行就是全部会话。
   open(id,name):有行就点行里的链接;没有就往 input.chatlist-search 填名字(它是就地过滤),等行出现再点,点完清空。只读不改不发。 */
(function(){ 'use strict';
  if (window.__scrmLbContacts) return; window.__scrmLbContacts = 1;
  function rows() { return [].slice.call(document.querySelectorAll('.list-group-item-chat')); }
  function payloadOf(row) { try { var m = row.__vue__ && row.__vue__.chatModel; return m && m.payload ? { p: m.payload, m: m } : null; } catch(e){ return null; } }
  function clickEl(el) { ['mousedown', 'mouseup', 'click'].forEach(function(t){ try { el.dispatchEvent(new MouseEvent(t, { bubbles: true, cancelable: true, view: window, button: 0 })); } catch(e){} }); }
  function num(v) { var n = Number(v); return isFinite(n) ? n : 0; }
  function build() { var out = [], seen = {};
    rows().forEach(function(row){ var x = payloadOf(row); if (!x) return; var p = x.p, id = String(p.chatId || ''); if (!id || seen[id]) return; seen[id] = 1;
      var kind = p.chatType === 'USER' ? 'private' : 'group', le = p.latestEvent || {}, fromMe = le.type === 'messageSent' || (le.type == null && !!x.m.isFromMe);
      var sent = num(p.lastSentAt), theirRead = num(p.userLastReadAt), t = num(p.updatedAt) || num(le.timestamp);
      var img = row.querySelector('img'), av = img ? String(img.getAttribute('src') || '') : ''; if (!/^https?:/.test(av)) av = '';
      out.push({ id: id, name: String((p.profile && p.profile.name) || id), username: '', phone: '', group: kind !== 'private', kind: kind, unread: p.read === false ? 1 : 0, unreadKnown: p.read != null, t: t ? Math.floor(t / 1000) : 0, archive: false, avatar: av, lastFromMe: le.type ? fromMe : null, lastAck: (le.type && fromMe) ? (theirRead >= sent && sent > 0 ? 3 : 2) : null, members: 0 }); });
    return out; }
  function rowOf(id) { return rows().find(function(r){ var x = payloadOf(r); return x && String(x.p.chatId) === String(id); }) || null; }
  function setSearch(v) { var i = document.querySelector('input.chatlist-search'); if (!i) return false; try { i.focus(); } catch(e){} try { var d = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value'); if (d && d.set) d.set.call(i, v); else i.value = v; } catch(e){ i.value = v; } i.dispatchEvent(new Event('input', { bubbles: true })); if (!v) { try { i.blur(); } catch(e){} } return true; }
  function activeId() { try { var m = (location.pathname || '').match(/\/chat\/([^\/?#]+)/); return m ? m[1] : ''; } catch(e){ return ''; } }
  function openRow(row) { clickEl(row.querySelector('a.d-flex') || row.querySelector('a') || row); }
  function openChat(id, name) { return new Promise(function(res){ try { id = String(id || ''); if (!id) return res('nochat');
      var r = rowOf(id); if (r) { openRow(r); return res('ok'); }
      if (!name || !setSearch(String(name))) return res('nochat'); var t0 = Date.now();
      (function poll(){ var r2 = rowOf(id); if (r2) { openRow(r2); setTimeout(function(){ setSearch(''); res('ok'); }, 300); return; } if (Date.now() - t0 > 5000) { setSearch(''); return res('nochat'); } setTimeout(poll, 200); })();
    } catch(e){ res('error:' + (e && e.message)); } }); }
  window.__scrmContacts = { v: 2, platform: 'linebusiness', caps: { unread: true, ack: true, group: true, archive: false, channel: false },
    list: function(){ try { return build(); } catch(e){ return []; } }, active: activeId, open: openChat, groupMembers: function(){ return []; }, _build: build };
})();
/* [LB-CONTACTS-END] */

/* [LB-FIT-WIDTH] 2026-09-27 LINE Business 页面自身 #header / #container / #wrapper.fixed 写死 min-width:1120px;右侧面板(联系人等)打开后视图只剩 ~985px,
   页面不会缩,顶栏和聊天区被截掉、底部出横向滚动条(用户截图)。把这三处 min-width 放开,页面按视图宽度排(LINE 自己会把会话列表折成窄栏),
   视图够宽时没有任何影响。样式节点丢了(SPA 换 head 极少见)就补回。 */
(function(){ 'use strict';
  var ID = 'scrm-lb-fit-width', CSS = '#header,#container,#wrapper.fixed{min-width:0!important}';
  function ensure() { try { if (document.getElementById(ID)) return; var head = document.head || document.documentElement; if (!head) return; var st = document.createElement('style'); st.id = ID; st.textContent = CSS; head.appendChild(st); } catch(e){} }
  ensure();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ensure);
  setTimeout(ensure, 3000);
})();
/* [LB-FIT-WIDTH-END] */
