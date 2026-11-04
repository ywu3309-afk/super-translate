/* __scrmPatchV1__ scrm-patch-twitter v7 (2026-08-29)
   ① X 自研翻译整套接管海王 twitter-preload(海王把"Hello, nice to meet you"按逗号截成"Hello"再翻→气泡下只剩"你好",同 IG 老病):
      - CSS+JS 隐藏海王译文 UI(.message-translate-content-wrapper/.real-time-tranlate-*),干净接管
      - 发送:回车拦截→翻译成对方语言→native value setter 填 textarea→点 send 按钮;发出前记 __xSentOrig[译文]=原文(localStorage+IndexedDB)
      - 发出气泡:译文下直接显示操作员原文(原话即100%准确译文,不重译乱DOM,同 WA/IG sentOriginalMap)
      - 收信气泡:翻译到 receiveTargetLanguage,缓存(内存+IndexedDB)秒贴不闪;WA 同款 ↻ 重译按钮
      - 输入框预览:谷歌xx实时翻译 浮条,常驻占位"…"
   ② 自己账号头像/名字/id 抓取上报(v1 原样保留,见文件末尾) */
/* ========== X Google \u767b\u5f55\u6309\u94ae\u547d\u4e2d\u533a\u4fee\u590d(2026-08-29 \u63a2\u9488\u5b9e\u6d4b):
   X \u7528\u900f\u660e\u547d\u4e2d\u5c42 .jf-gsi-hit(absolute,opacity 0)\u76d6\u5728\u81ea\u5df1\u753b\u7684"\u4f7f\u7528 Google \u7ee7\u7eed"\u80f6\u56ca\u4e0a,\u91cc\u9762\u653e Google GSI iframe;
   \u4f46 iframe \u5728\u6211\u4eec\u73af\u5883\u91cc\u88ab\u524d\u9762\u7684\u5360\u4f4d\u5143\u7d20\u9876\u4e0b 38px\u3001\u81ea\u5e26 margin -10px \u2192 \u51e0\u4e4e\u6574\u4e2a\u6389\u5230\u80f6\u56ca\u4e0b\u65b9,\u53ea\u5269\u51e0\u50cf\u7d20\u91cd\u53e0 \u2192 \u70b9\u80f6\u56ca"\u65f6\u597d\u65f6\u574f"\u3002
   \u4fee=iframe \u7edd\u5bf9\u5b9a\u4f4d\u94fa\u6ee1\u547d\u4e2d\u5c42\u3001\u53bb margin\u3001\u9690\u85cf\u9876\u5b83\u7684\u5360\u4f4d\u5143\u7d20;\u6bcf\u79d2\u6821\u6b63\u4e00\u6b21(GSI \u4f1a\u91cd\u6e32\u67d3)\u3002
   \u2461(\u540c\u65e5\u518d\u63a2)\u547d\u4e2d\u5c42 opacity:0 \u2192 \u8de8\u8fdb\u7a0b iframe \u4e0d\u8fdb\u5408\u6210\u5c42,\u70b9\u51fb\u56de\u843d\u7236\u9875\u9762(\u7236\u9875\u6536\u5230 target=IFRAME \u7684 click,GSI \u6536\u4e0d\u5230)\u2192 \u6539 opacity:0.01+translateZ(0) \u5f3a\u5236\u5408\u6210\u3002 ========== */
(function(){ try{
  function inj(){ try{ if(document.getElementById('__scrmXGsiStyle')||!document.head) return; var st=document.createElement('style'); st.id='__scrmXGsiStyle';
    st.textContent='.jf-gsi-hit{overflow:visible !important;opacity:0.01 !important;transform:translateZ(0);will-change:transform;} .jf-gsi-hit iframe[src*="gsi/button"]{opacity:1 !important;} .jf-gsi-hit .S9gUrf-YoZ4jf,.jf-gsi-hit>div{position:absolute !important;inset:0 !important;width:100% !important;height:100% !important;margin:0 !important;padding:0 !important;} .jf-gsi-hit iframe[src*="gsi/button"]{position:absolute !important;top:0 !important;left:0 !important;margin:0 !important;width:100% !important;height:100% !important;} .jf-gsi-hit .S9gUrf-YoZ4jf>div:not(:has(iframe)){display:none !important;}';
    document.head.appendChild(st); }catch(e){} }
  function fix(){ try{ inj(); var ifs=document.querySelectorAll('.jf-gsi-hit iframe[src*="gsi/button"]'); for(var i=0;i<ifs.length;i++){ var f=ifs[i], hit=f.closest('.jf-gsi-hit'); if(!hit) continue;
      var a=f.getBoundingClientRect(), b=hit.getBoundingClientRect(); if(Math.abs(a.top-b.top)>2||Math.abs(a.left-b.left)>2||Math.abs(a.height-b.height)>2){
        f.style.setProperty('position','absolute','important'); f.style.setProperty('top','0','important'); f.style.setProperty('left','0','important'); f.style.setProperty('margin','0','important'); f.style.setProperty('width','100%','important'); f.style.setProperty('height','100%','important');
        var p=f.parentElement; if(p&&p!==hit){ p.style.setProperty('position','absolute','important'); p.style.setProperty('inset','0','important'); p.style.setProperty('width','100%','important'); p.style.setProperty('height','100%','important'); p.style.setProperty('margin','0','important'); }
      } } }catch(e){} }
  setInterval(fix,1000); setTimeout(fix,300);
}catch(e){} })();
/* ========== X Google \u767b\u5f55\u6309\u94ae\u65f6\u597d\u65f6\u574f\u4fee\u590d(2026-08-29 \u63a2\u9488\u5b9e\u8bc1):
   Google GSI \u6309\u94ae\u662f\u8de8\u57df iframe;\u9875\u9762\u9876\u5c42\u5148\u8c03 FedCM navigator.credentials.get({identity,mediation}),Electron \u4e0d\u652f\u6301\u5374\u8981\u6302 ~5s \u624d AbortError,
   \u671f\u95f4 GSI \u5ffd\u7565\u6309\u94ae\u70b9\u51fb\u2192"\u521a\u6253\u5f00\u70b9\u4e0d\u52a8,\u8fc7\u51e0\u79d2\u624d\u80fd\u70b9"\u3002\u4fee=\u8ba9\u9875\u9762\u4e00\u5f00\u59cb\u5c31\u68c0\u6d4b\u4e0d\u5230 FedCM(\u5220 IdentityCredential + identity \u8bf7\u6c42\u7acb\u5373\u62d2\u7edd)\u2192GSI \u76f4\u63a5\u8d70\u5f39\u7a97\u3002 ========== */
(function(){ try{
  try{ if('IdentityCredential' in window){ try{ delete window.IdentityCredential; }catch(e){} try{ Object.defineProperty(window,'IdentityCredential',{value:undefined,configurable:true,writable:true}); }catch(e){} } }catch(e){}
  try{ var cc=navigator.credentials; if(cc&&typeof cc.get==='function'){ var og=cc.get.bind(cc);
    var ng=function(o){ try{ if(o&&(o.identity||o.federated)){ var err; try{ err=new DOMException('FedCM not supported','NotSupportedError'); }catch(e){ err=new Error('FedCM not supported'); err.name='NotSupportedError'; } return Promise.reject(err); } }catch(e){} return og(o); };
    try{ Object.defineProperty(cc,'get',{value:ng,configurable:true,writable:true}); }catch(e){ try{ cc.get=ng; }catch(_){} }
    try{ Object.defineProperty(CredentialsContainer.prototype,'get',{value:ng,configurable:true,writable:true}); }catch(e){} } }catch(e){}
}catch(e){} })();
/* [X-SHADOW] 2026-10-02 X 新版私信(xchat)整块渲染在 [data-testid="xchatEmbedRoute"] 里的开放 shadow root 中:document.querySelector 找不到输入框/消息,
   document 上的监听拿到的 e.target 是宿主元素。私信界面所在的根只由 __scrmXDm() 一处判断(旧版页面返回 document),事件真实目标统一用 __scrmXEvT(e)。 */
(function(){ if(window.__scrmXDm) return; var host=null;
  window.__scrmXDm=function(){ try{
    if(host&&host.isConnected&&host.shadowRoot) return host.shadowRoot; host=null;
    var r=document.querySelector('[data-testid="xchatEmbedRoute"]');   // 实测:这个元素自己就是 shadow 宿主
    if(r&&r.shadowRoot){ if(r.shadowRoot.querySelector('[data-testid="dm-container"]')) host=r; return r.shadowRoot; }
    return document;
  }catch(e){ return document; } };
  window.__scrmXEvT=function(e){ try{ var p=e.composedPath&&e.composedPath(); if(p&&p.length) return p[0]; }catch(_){} return e.target; };
})();
(function(){ 'use strict';
  var _dm=window.__scrmXDm, _evT=window.__scrmXEvT;
  /* [INIT-ONCE] 同其他平台:防补丁被重复执行时 setInterval/监听翻倍 */
  if (window.__scrmXTr) return; window.__scrmXTr = true;
  var TW_TEXT='[data-testid="dm-conversation-content"] [data-testid*="message-text"], [data-testid="dm-conversation-scroller"] [data-testid*="message-text"]';
  function _cfg(){ try{ return Object.assign({}, window.__scrm_translate||{}, window.__scrmTrCfg||{}); }catch(e){ return {}; } }
  function sendTo(){ try{ var c=_cfg(); var id=(window.__scrmActiveContactId||'');
      if(id){ var sct=c.singleContactTranslate&&c.singleContactTranslate[id]; if(sct&&(sct.singleContactTranslateOpen||sct.enabled)&&(sct.sendTargetLanguage||sct.sendTo)) return sct.sendTargetLanguage||sct.sendTo; }
      return c.twitterGlobalSend||c.sendTargetLanguage||c.sendTo||'en'; }catch(e){} return 'en'; }
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

  // ---------- IndexedDB \u6301\u4e45\u5c42(\u53e5\u7ea7\u8bd1\u6587\u7f13\u5b58 + \u53d1\u51fa\u539f\u6587\u6620\u5c04),\u4e0d\u53ef\u7528\u9759\u9ed8\u964d\u7ea7 ----------
  var _idb=(function(){
    var DB='scrm_tr_x', ST='c', db=null, rdy=false, dead=false;
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
  var _cache={}, _pending={}, _full={}, _sentOrig={};   // _full: recvTo|\u539f\u6587\u2192\u8bd1\u6587 ; _sentOrig: \u53d1\u51fa\u8bd1\u6587\u2192\u64cd\u4f5c\u5458\u539f\u6587
  var _FKEY='__scrmXFull', _SKEY='__scrmXSentOrig';
  try{ var _fs=localStorage.getItem(_FKEY); if(_fs){ var _fo=JSON.parse(_fs); if(_fo&&typeof _fo==='object') _full=_fo; } }catch(e){}
  try{ var _ss=localStorage.getItem(_SKEY); if(_ss){ var _so=JSON.parse(_ss); if(_so&&typeof _so==='object') _sentOrig=_so; } }catch(e){}
  var _fSaveT=null;
  function _saveFull(){ try{ if(_fSaveT) return; _fSaveT=setTimeout(function(){ _fSaveT=null; try{
    var ks=Object.keys(_full); if(ks.length>4000){ for(var i=0;i<ks.length-3000;i++) delete _full[ks[i]]; }
    localStorage.setItem(_FKEY, JSON.stringify(_full));
    var sk=Object.keys(_sentOrig); if(sk.length>3000){ for(var j=0;j<sk.length-2000;j++) delete _sentOrig[sk[j]]; }
    localStorage.setItem(_SKEY, JSON.stringify(_sentOrig));
  }catch(e){} },1500); }catch(e){} }
  var _sentById={}, _pendSent=[];   // _sentById: \u6d88\u606fid\u2192\u539f\u6587(\u540c\u4e00\u8bd1\u6587\u53d1\u591a\u6b21\u4e5f\u4e0d\u4e32);_pendSent: \u521a\u53d1\u51fa\u5f85\u7ed1\u5b9a {tr,orig,at}
  var _BKEY='__scrmXSentById';
  try{ var _bs=localStorage.getItem(_BKEY); if(_bs){ var _bo=JSON.parse(_bs); if(_bo&&typeof _bo==='object') _sentById=_bo; } }catch(e){}
  function _saveById(){ try{ var ks=Object.keys(_sentById); if(ks.length>3000){ for(var i=0;i<ks.length-2000;i++) delete _sentById[ks[i]]; } localStorage.setItem(_BKEY,JSON.stringify(_sentById)); }catch(e){} }
  function putSent(tr,orig){ if(!tr||!orig) return; _sentOrig[_norm(tr)]=orig; try{ _idb.put('s|'+_norm(tr),orig); }catch(e){} _pendSent.push({tr:_norm(tr),orig:orig,at:Date.now()}); _saveFull(); }
  function _msgId(tc){ try{ var m=(tc.getAttribute('data-testid')||'').match(/^message-text-(.+)$/); return m?m[1]:''; }catch(e){ return ''; } }
  // \u53d6\u8be5\u6c14\u6ce1\u7684\u64cd\u4f5c\u5458\u539f\u6587:\u5148\u6309\u6d88\u606fid,\u518d\u6309\u8bd1\u6587\u6587\u672c(\u5e76\u987a\u624b\u628a pending \u7ed1\u5230 id)
  function _origFor(tc,src){ var id=_msgId(tc); if(id&&_sentById[id]) return _sentById[id];
    if(_pendSent.length){ var now=Date.now(); for(var i=_pendSent.length-1;i>=0;i--){ var p=_pendSent[i]; if(now-p.at>120000){ _pendSent.splice(i,1); continue; } if(p.tr===src && id && _isMine(tc)){ _sentById[id]=p.orig; _pendSent.splice(i,1); _saveById(); return p.orig; } } }
    return _sentOrig[src]||null; }
  window.__xSentOrig=_sentOrig;

  /* [BATCH1-04] 面板「清空译文缓存」:window.__scrmTrCacheClear() → Promise<{cleared:n}>,永不 reject。
     清三处:句级内存 _cache;整条消息译文 _full 及它在 localStorage __scrmXFull 的镜像;IndexedDB scrm_tr_x 表 c(_idb.clearP;表里 s| 发出原文条目只写从不读,随整表清掉)。
     n(全平台同一口径)= 持久层里被清掉的译文条数 = IndexedDB 表的条数;内存和 localStorage 镜像是副本,不另计。
     _sentOrig/_sentById 是发出消息的原文映射不是译文,不动;已显示的译文框/标记一个不删,之后新消息 / ↻ 才重新联网(不触发重译)。 */
  window.__scrmTrCacheClear=function(){
    try{ _cache={}; _full={}; localStorage.removeItem(_FKEY); }catch(e){}
    var p; try{ p=_idb.clearP(); }catch(e){ p=Promise.resolve(0); }
    return p.then(function(k){ return { cleared:Number(k)||0 }; }, function(){ return { cleared:0 }; }); };

  // ---------- \u7ffb\u8bd1\u5f15\u64ce:XHR \u76f4\u8fde\u6211\u65b9\u7ffb\u8bd1 API(X CSP \u653e\u884c chm123.com,\u5b9e\u6d4b) ----------
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
  // \u591a\u884c:\u9010\u884c\u7ffb\u8bd1\u4fdd\u7559\u6362\u884c;\u7a7a\u884c\u539f\u6837
  function translateML(text,tl,force){ var lines=String(text||'').split('\n'); if(lines.length<=1) return _trLine(text,tl,0,force);
    return Promise.all(lines.map(function(ln){ var n=_norm(ln); return n?_trLine(n,tl,0,force):Promise.resolve(''); })).then(function(rs){ return rs.join('\n'); }); }

  // ---------- \u6837\u5f0f:\u9690\u85cf\u6d77\u738b\u8bd1\u6587 UI + \u6211\u65b9\u8bd1\u6587\u6846/\u9884\u89c8 ----------
  /* 样式要同时放进 document 和私信所在的 shadow root(shadow 里不吃外面的样式) */
  function _injStyle(){ _injStyleTo(document.head); var r=_dm(); if(r!==document) _injStyleTo(r); }
  function _injStyleTo(target){ if(!target||(target.querySelector&&target.querySelector('#__scrmXStyle'))) return;
    var st=document.createElement('style'); st.id='__scrmXStyle';
    st.textContent=''
      + '.message-translate-content-wrapper,.message-translate-content,.message-translate-loading,.message-translate-btn,.message-translate-error,.real-time-tranlate-content,.real-time-tranlate-text,[class*="real-time-tranlate"]{display:none !important;} '
      + '.scrm-x-tw{display:block;width:100%;margin-top:4px;padding-top:4px;border-top:1px dashed rgba(26,127,55,.7);color:#1a7f37;font-size:13px;line-height:1.4;white-space:pre-wrap;word-break:break-word;text-align:left;} '
      + '.scrm-x-mine > .scrm-x-tw{color:#1a7f37;border-top-color:rgba(26,127,55,.7);} ' /* [X-TR-COLOR] 2026-09-15 用户要求自己发的译文颜色与来信一致(深绿),不再用浅绿 */
      + '@keyframes scrm-x-spin{to{transform:rotate(360deg)}} .scrm-x-rf{display:inline-flex;align-items:center;margin-left:6px;vertical-align:middle;cursor:pointer;opacity:.7;transition:opacity .15s;user-select:none;} .scrm-x-rf:hover{opacity:1;} .scrm-x-rf.spin svg{animation:scrm-x-spin .8s linear infinite;} '
      + '.scrm-imgtr-host{position:relative;} .scrm-imgtr-btn{position:absolute;top:6px;right:6px;z-index:30;background:rgba(0,0,0,.62);color:#fff;font-size:11px;line-height:1;padding:4px 8px;border-radius:6px;cursor:pointer;display:none;align-items:center;gap:3px;user-select:none;} .scrm-imgtr-host:hover .scrm-imgtr-btn{display:inline-flex;} .scrm-imgtr-btn.on{display:inline-flex;} .scrm-imgtr-btn.done{display:inline-flex;background:rgba(26,127,55,.92);} .scrm-imgtr-btn .sp{display:inline-block;width:9px;height:9px;border:1.5px solid #fff;border-top-color:transparent;border-radius:50%;animation:scrm-x-spin .7s linear infinite;} '
      + '.scrm-imgtr-mask{position:fixed;inset:0;z-index:2147483600;background:rgba(0,0,0,.75);display:flex;align-items:center;justify-content:center;cursor:zoom-out;} .scrm-imgtr-lightimg{max-width:92vw;max-height:84vh;border-radius:8px;background:#fff;object-fit:contain;} '
      + '.scrm-x-vhost{width:100%;box-sizing:border-box;} .scrm-x-vbtn{display:inline-block;margin-top:6px;background:#1a7f37;color:#fff;font-size:11px;line-height:1;padding:4px 9px;border-radius:10px;cursor:pointer;user-select:none;} .scrm-x-vbtn.on{opacity:.7;} .scrm-x-vo{margin-top:6px;padding-top:6px;border-top:1px dashed rgba(120,130,140,.5);font-size:12.5px;line-height:1.5;white-space:pre-wrap;word-break:break-word;text-align:left;} .scrm-x-vo .og{opacity:.75;} .scrm-x-vo .tr{margin-top:3px;font-weight:500;} .scrm-x-vo .lbl{color:#1a7f37;font-size:10.5px;margin-right:2px;font-weight:600;} .scrm-x-vrf{cursor:pointer;opacity:.7;margin-left:6px;display:inline-flex;vertical-align:middle;} .scrm-x-vrf:hover{opacity:1;} '
      + _pvCoreCss('scrm-x-pv',{maxHeight:'26vh'})+'.scrm-x-pv{width:auto;}';
    target.appendChild(st);
  }
  // \u539f\u6587=\u6c14\u6ce1\u5185 span[dir=auto](\u6392\u9664\u65f6\u95f4\u6233 span[aria-hidden] \u548c\u6211\u65b9\u8bd1\u6587\u6846);\u515c\u5e95 clone \u53bb\u6846\u53d6 textContent
  function _origText(tc){ try{ var sp=tc.querySelectorAll('span[dir="auto"]'), out=[]; for(var i=0;i<sp.length;i++){ if(sp[i].closest('.scrm-x-tw')||sp[i].closest('[aria-hidden="true"]')) continue; out.push(sp[i].textContent||''); } return out.length?_norm(out.join('\n')):'';
    var c=tc.cloneNode(true); var rm=c.querySelectorAll('.scrm-x-tw,.message-translate-content-wrapper,[class*="message-translate"],[aria-hidden="true"]'); for(var j=0;j<rm.length;j++) rm[j].parentNode.removeChild(rm[j]); return _norm(c.textContent||''); }catch(e){ return ''; } }
  // \u53d1\u51fa/\u6536\u5230:X \u81ea\u5df1\u6c14\u6ce1 class \u5e26 justify-end + bg-chat-accent;\u515c\u5e95\u6309\u4f4d\u7f6e(\u53f3\u534a\u8fb9=\u81ea\u5df1)
  function _isMine(tc){ try{ var cn=String(tc.className||''); if(/bg-chat-accent/.test(cn)) return true; if(/bg-gray-50|bg-gray-|justify-start/.test(cn)) return false; /* [X-TR-COLOR] 2026-09-15 来信灰泡也带 justify-end(时间戳布局),原来据此判成"我发的"→译文用浅绿(白底看不见);改看底色:bg-chat-accent=我发的,bg-gray=来信 */
    var sc=tc.closest('[data-testid="dm-message-scroller"]')||tc.closest('[data-testid="dm-conversation-content"]')||document.body; var a=tc.getBoundingClientRect(), b=sc.getBoundingClientRect(); return (a.left+a.right)/2 > (b.left+b.right)/2; }catch(e){ return false; } }
  /* [TR-ALIGN-1002] 2026-10-02 往消息里插内容(译文/语音译文)的唯一贴底规则(与 Snapchat/Discord 同一模板、对齐 TG [TG-KEEP-BOTTOM]):
     X 本来没有切会话拉底(打开会话停在哪由 X 自己决定,这里不干预);原来插入译文完全不管滚动 → 停在最底部时译文把最后一条撑高,底部被挡住。
     现在:插入前该消息所在滚动容器离底 ≤24px → 插完(微任务里)贴底;否则位置不动。同一轮多次插入只量一次。判断"在底部"按容器实际方向(column-reverse 底部 = scrollTop≈0)。 */
  function _scrollHost(el){ try{ var p=el&&el.parentElement; while(p&&p!==document.body&&p!==document.documentElement){ var cs=getComputedStyle(p); if(/(auto|scroll)/.test(cs.overflowY)&&p.scrollHeight>p.clientHeight+4) return p; p=p.parentElement; } }catch(e){} return null; }
  var _kbList=null;
  function _keepBottom(el){ try{
    var sc=_scrollHost(el); if(!sc) return;
    if(_kbList){ for(var i=0;i<_kbList.length;i++){ if(_kbList[i].sc===sc) return; } }
    else { _kbList=[]; Promise.resolve().then(function(){ var l=_kbList; _kbList=null; for(var k=0;k<l.length;k++){ try{ var s=l[k].sc; if(l[k].atB&&s.isConnected) s.scrollTop=l[k].rev?0:s.scrollHeight; }catch(e){} } }); }
    var rev=false; try{ rev=getComputedStyle(sc).flexDirection==='column-reverse'; }catch(e){}
    _kbList.push({ sc:sc, rev:rev, atB: rev ? Math.abs(sc.scrollTop)<=24 : (sc.scrollHeight-sc.scrollTop-sc.clientHeight)<=24 });
  }catch(e){} }
  function _annotate(tc,want,mine){ try{
    var box=tc.__scrmTw;
    if(!box||!box.parentNode){
      box=document.createElement('div'); box.className='scrm-x-tw';
      var tx=document.createElement('span'); tx.className='scrm-x-tx'; box.appendChild(tx);
      var rf=document.createElement('span'); rf.className='scrm-x-rf'; rf.title='\u91cd\u65b0\u7ffb\u8bd1';
      rf.innerHTML='<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>';
      box.appendChild(rf); var host=tc.firstElementChild||tc; _keepBottom(tc); host.appendChild(box); tc.__scrmTw=box;   // [TR-ALIGN-1002] 插入前量一次是否在底
    }
    if(mine) tc.classList.add('scrm-x-mine'); else { tc.classList.remove('scrm-x-mine'); try{ var _anc=tc.parentElement,_h=0; while(_anc&&_h<12){ if(_anc.classList&&_anc.classList.contains('scrm-x-mine')&&_anc.querySelectorAll('.scrm-x-tw').length>1) _anc.classList.remove('scrm-x-mine'); _anc=_anc.parentElement; _h++; } }catch(e){} } // [X-TR-COLOR] 来信:顺手清掉误挂在共用祖先上的 mine 标记
    var rfb=box.querySelector('.scrm-x-rf'); if(rfb&&rfb.classList.contains('spin')) rfb.classList.remove('spin');
    var tx2=box.querySelector('.scrm-x-tx'); if(tx2&&(tx2.textContent||'')!==want){ _keepBottom(tc); tx2.textContent=want; }   // [TR-ALIGN-1002] 换字前量一次是否在底
  }catch(e){} }
  /* [TR-FIX-1002B] ↻ 的「待强制刷新」按 收信语言|原文 记在这个集合里,不挂在 DOM 元素上:
     原来打在元素的 __zForce 上,平台一重渲染(换了新元素)标记就丢 → _syncCached 立刻用整句缓存把旧译文贴回去,↻ 等于没点。
     成功或失败都在结果回来时清掉;失败时缓存保持原样(translate 只在拿到新结果时才覆盖缓存,从不先删)。 */
  var _forceKeys={};
  function processMsgs(){ try{
    _injStyle();
    try{ var hw=_dm().querySelectorAll('.message-translate-content-wrapper,[class*="message-translate-content"],[class*="real-time-tranlate"]'); for(var hi=0;hi<hw.length;hi++){ if(hw[hi].style.display!=='none') hw[hi].style.setProperty('display','none','important'); } }catch(e){}
    if(!recvEnabled()) return;
    if(_cfg().groupTranslateAuto===false && _isGroup()) return;
    var rto=recvTo();
    var tcs=_dm().querySelectorAll(TW_TEXT);
    for(var i=0;i<tcs.length;i++){ var tc=tcs[i];
      var src=_origText(tc); if(!src) continue;
      var frc=!!_forceKeys[rto+'|'+src];
      if(!frc && tc.__zSrc===src && (tc.__zTo==null||tc.__zTo===rto) && tc.__scrmTw && tc.__scrmTw.parentNode) continue;
      // \u2460 \u53d1\u51fa\u7684\u8bd1\u6587\u2192\u663e\u793a\u64cd\u4f5c\u5458\u539f\u6587(\u4e0d\u91cd\u8bd1)
      var so=(tc.__zNoOrig||frc)?null:_origFor(tc,src);
      if(so){ tc.__zSrc=src; tc.__zTo=null; tc.__zPending=0; _annotate(tc,so,true); continue; }
      // \u2461 \u7f13\u5b58\u547d\u4e2d\u2192\u79d2\u8d34
      var cf=frc?null:_full[rto+'|'+src];   // [TR-ALIGN-1002] ↻ 强制时不用整句缓存
      if(cf!=null){ tc.__zSrc=src; tc.__zTo=rto; tc.__zPending=0; _annotate(tc,cf,_isMine(tc)); continue; }
      if(tc.__zPending) continue; tc.__zPending=1;
      if(!(tc.__scrmTw&&tc.__scrmTw.parentNode)) _annotate(tc,'\u7ffb\u8bd1\u4e2d\u2026',_isMine(tc));
      (function(el,text,tto,frc){ translateML(text,tto,frc).then(function(r){ el.__zPending=0; if(frc) delete _forceKeys[tto+'|'+text]; try{ if(r&&r.replace(/\s/g,'')){ _full[tto+'|'+text]=r; _saveFull(); el.__zSrc=text; el.__zTo=tto; _annotate(el,r,_isMine(el)); } }catch(e){} }); })(tc,src,rto,frc);
    }
  }catch(e){} }
  setInterval(processMsgs,350);
  function _syncCached(){ try{ if(!recvEnabled()) return; var rto=recvTo(); var tcs=_dm().querySelectorAll(TW_TEXT);
    for(var i=0;i<tcs.length;i++){ var tc=tcs[i]; if(tc.__zSrc&&(tc.__zTo==null||tc.__zTo===rto)&&tc.__scrmTw&&tc.__scrmTw.parentNode) continue;
      var src=_origText(tc); if(!src) continue;
      if(_forceKeys[rto+'|'+src]) continue;   // [TR-FIX-1002B] ↻ 等网络新结果,别用缓存把旧译文贴回去(按 语言|原文 判断,元素重渲染也认得)
      var so=tc.__zNoOrig?null:_origFor(tc,src); if(so){ tc.__zSrc=src; tc.__zTo=null; tc.__zPending=0; _annotate(tc,so,true); continue; }
      var cf=_full[rto+'|'+src]; if(cf!=null){ tc.__zSrc=src; tc.__zTo=rto; tc.__zPending=0; _annotate(tc,cf,_isMine(tc)); } }
  }catch(e){} }
  (function(){ try{ var raf=0; var _pmAt=0; var ob=new MutationObserver(function(){ try{ window.__scrmXObShadow&&window.__scrmXObShadow(); _syncCached(); }catch(e){} if(raf) return; raf=requestAnimationFrame(function(){ raf=0; try{ if(Date.now()-_pmAt>150){ _pmAt=Date.now(); processMsgs(); } }catch(e){} }); }); /* [SMOOTH] 2026-09-14 对齐 FB/Zalo:缓存命中的译文在观察器回调里同步盖章(绘制前,重渲染零闪),不再等下一帧;未命中的新消息节流 150ms 立即走 processMsgs 翻译,不再等 350ms 轮询 */
    var _obRoot=null; window.__scrmXObShadow=function(){ try{ var r=_dm(); if(r!==document&&r!==_obRoot){ _obRoot=r; ob.observe(r,{childList:true,subtree:true}); } }catch(e){} };   // 私信 shadow root 里的变化 document.body 上的观察器看不到
    var _att=function(){ if(document.body){ ob.observe(document.body,{childList:true,subtree:true}); window.__scrmXObShadow(); } else setTimeout(_att,200); }; _att(); }catch(e){} })();
  // \u21bb \u91cd\u8bd1
  document.addEventListener('click',function(ev){ try{
    var et=_evT(ev); var rf=et&&et.closest&&et.closest('.scrm-x-rf'); if(!rf) return;
    ev.stopPropagation(); ev.preventDefault();
    var tw=rf.closest('.scrm-x-tw'); var tc=tw&&(tw.closest('[data-testid*="message-text"]')||tw.parentElement); if(!tc) return;
    // [TR-FIX-1002B] 待刷新记在 _forceKeys(语言|原文)→ processMsgs 用 translate(..., force) 真正联网,新结果覆盖各级缓存;元素被 X 重渲染换掉也照样生效
    var src0=_origText(tc); if(src0) _forceKeys[recvTo()+'|'+src0]=1;
    tc.__zNoOrig=1; tc.__zSrc=null; tc.__zTo=null; tc.__zPending=0;
    var tx=tw.querySelector('.scrm-x-tx'); if(tx) tx.textContent='\u7ffb\u8bd1\u4e2d\u2026'; rf.classList.add('spin');
  }catch(e){} },true);

  // ---------- \u8f93\u5165\u6846 / \u53d1\u9001 ----------
  function getTa(){ return _dm().querySelector('[data-testid="dm-composer-textarea"]'); }
  function setTextarea(ta,val){ try{ var d=Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype,'value'); d.set.call(ta,val); ta.dispatchEvent(new Event('input',{bubbles:true})); }catch(e){} }
  function getSendBtn(){ var b=_dm().querySelector('button[data-testid="dm-composer-send-button"]'); if(b) return b;
    var comp=_dm().querySelector('[data-testid="dm-composer-container"]'); if(!comp) return null; var btns=comp.querySelectorAll('[role="button"],button');
    for(var i=0;i<btns.length;i++){ var lbl=(btns[i].getAttribute('aria-label')||btns[i].getAttribute('data-testid')||'').toLowerCase(); if(/send|\u53d1\u9001/.test(lbl)) return btns[i]; } return btns.length?btns[btns.length-1]:null; }
  // \u9884\u89c8:\u63d2\u5728 composer \u5bb9\u5668\u4e4b\u524d(\u6d41\u5185,\u540c WA/TikTok)
  // \u9884\u89c8\u63d2\u5728 composer \u5185\u5c42 flex-col(file-input \u7684\u7236\u7ea7)\u6700\u524d\u9762:composer \u662f absolute bottom-0 \u6d6e\u5c42,\u52a0\u9ad8\u81ea\u52a8\u5f80\u4e0a\u957f,\u4e0d\u52a8\u6d88\u606f\u533a
  function _pvHost(){ try{ var c=_dm().querySelector('[data-testid="dm-composer-container"]'); if(!c) return null;
    var fi=c.querySelector('[data-testid="dm-composer-file-input"]'); var col=fi?fi.parentElement:(c.firstElementChild&&c.firstElementChild.firstElementChild)||c.firstElementChild||c;
    return {col:col, before:col.firstElementChild};
  }catch(e){ return null; } }
  var _backTr=_backTrCore({ backCls:'scrm-x-pv-back', on:function(){ return !!_cfg().backTranslate; }, sendLang:sendTo, backLang:recvTo, translate:function(t,bl){ return translateML(t,bl); } });   /* [BACK-TR] 回译校对:下面写预览正文的地方调 _backTr.update(正文元素, 译文),行为全在上面的 [BACK-TR-CORE] */
  function _preview(txt, isTr){   /* isTr:这次写的是真译文(回译只认它) */ try{ var host=window.__xPv;
    if(txt===null||txt===undefined){ if(host) host.style.display='none'; _backTr.update(null,''); return; }
    var ins=_pvHost(); if(!ins||!ins.col){ if(host) host.style.display='none'; return; }
    if(!host){ host=document.createElement('div'); host.className='scrm-x-pv'; host.innerHTML='<div class="scrm-x-pv-lbl"></div><div class="scrm-x-pv-body"></div>'; window.__xPv=host; }
    if(host.parentNode!==ins.col||ins.col.firstElementChild!==host){ try{ ins.col.insertBefore(host,ins.col.firstChild); }catch(e){ if(!host.parentNode) ins.col.appendChild(host); } }
    host.style.display='block';
    var l=host.querySelector('.scrm-x-pv-lbl'); if(l&&l.textContent!==_pvLabel()) l.textContent=_pvLabel();
    var b=host.querySelector('.scrm-x-pv-body'); var want=(txt===''?'\u2026':txt); if(b&&b.textContent!==want) b.textContent=want; _backTr.update(b, isTr?txt:'');
  }catch(e){} }
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
    var ta=getTa(); if(!ta){ _preview(null); return; }
    var src=_norm(ta.value);
    if(!src){ _preview(''); _lastPvKey=''; return; }
    var to=sendTo(), lr=to+'|'+_route(), key=lr+'|'+src;
    if(key===_lastPvKey) return;
    if(key===_pvFailKey && Date.now()-_pvFailAt<2000) return;   // 同一句刚失败:隔 2 秒再请求
    _lastPvKey=key;
    if(_pvTimer) clearTimeout(_pvTimer);
    if(_sendAsIs(src)){ _pvFailKey=''; _pvShownLR='='; _preview(src+_SAME_TAG); return; }
    if(_pvShownLR && _pvShownLR!==lr){ _pvShownLR=''; _preview(''); }   // 换了语言/线路:先回占位
    _pvTimer=setTimeout(function(){ translateML(src,to).then(function(r){ var t=getTa(), cur=t?_norm(t.value):null; if(cur!==src||_lastPvKey!==key) return;
      var out=_sendText(src,r); if(out==null){ _pvFailed(src,'\u7ffb\u8bd1\u5931\u8d25'); return; }
      _pvFailKey=''; _pvShownLR=(out===src?'=':lr); _preview(out===src?src+_SAME_TAG:out, out!==src); }); },250);
  }catch(e){} }
  document.addEventListener('input',function(e){ try{ var t=_evT(e); if(t&&t.getAttribute&&t.getAttribute('data-testid')==='dm-composer-textarea') _onType(); }catch(_){} },true);
  setInterval(_onType,600);
  // ---------- \u53d1\u9001\u65b9\u5411:\u56de\u8f66/\u53d1\u9001\u6309\u94ae\u62e6\u622a \u2192 \u7ffb\u8bd1 \u2192 \u586b \u2192 \u53d1;Ctrl+F \u53d1\u539f\u6587;Ctrl+T \u53ea\u7ffb\u4e0d\u53d1;\u4e2d\u6587\u68c0\u6d4b ----------
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
  _scrmQuickInstall({ box: getTa, read: function(el){ return el.value; }, write: setTextarea, send: function(){ _fireSend(getTa(),true); }, tr: function(t){ return translateML(t, sendTo()); }, to: function(){ return sendTo(); } }); // [QUICK-SEND] 本平台绑定
  /* [TR-FIX-1002B] 唯一的点发送出口:发前核对框里的字(_expect 有值时必须一致),再过一次 _safeToSend(raw=用户明确发原文)。
     我方合成点击用 _bypass 放行(原来靠 _sending=true 时点击监听直接 return 放行,这个 return 同时把翻译进行中用户的真实点击也放给了 X)。 */
  var _bypass=false;
  function _sendFail(msg){ _sending=false; var t=getTa(); _pvFailed(t?_norm(t.value):'',msg); }
  function _fireSend(ta,raw,expect){ _sending=true; setTimeout(function(){ var t=getTa()||ta, cur=t?_norm(t.value):'';
      if(expect!=null && cur!==_norm(expect)){ _sendFail('\u5199\u5165\u5931\u8d25,\u8bf7\u91cd\u8bd5'); return; }
      if(!_safeToSend(cur,raw)){ _sendFail('\u7ffb\u8bd1\u5931\u8d25,\u8bf7\u91cd\u8bd5'); return; }
      try{ var b=getSendBtn(); if(b){ _bypass=true; b.click(); } }catch(_){} _bypass=false; _sending=false; _lastPvKey=''; _preview(''); },80); }
  function _sendRaw(ta,text){ setTextarea(ta,text); _fireSend(ta,true,text); }   // Ctrl+F:用户明确要发原文
  // \u7ffb\u8bd1\u540e\u53d1\u9001(\u56de\u8f66\u4e0e\u53d1\u9001\u6309\u94ae\u5171\u7528)
  function _translateAndSend(ta,text){
    if(_sending) return; _sending=true; setTimeout(function(){ _sending=false; },8000);
    translateML(text,sendTo()).then(function(tr){
      _sending=false;
      // [TR-FIX-1002B] 要发的文字只由 _sendText 决定(失败/空/仍含中文 → null),先判安全再走"译文=原文 原样发"
      var out=_sendText(text,tr);
      if(out==null){ if(tr&&detectOn()&&_hasZh(tr)) showZhWarn('\u8bd1\u6587\u4ecd\u542b\u4e2d\u6587,\u5df2\u963b\u6b62\u53d1\u9001'); _pvFailed(text,'\u7ffb\u8bd1\u5931\u8d25,\u8bf7\u91cd\u8bd5'); return; }   // 不发,框里原文保留;预览按失败处理(稍后自动重试)
      if(out===text){ _preview(text+_SAME_TAG); _fireSend(ta,false,text); return; }   // [TR-ALIGN-1002] 译文=原文(已是目标语言):原样发,与预览一致
      putSent(out,text); setTextarea(ta,out); _fireSend(ta,false,out);
    });
  }
  // [TR-ALIGN-1002] 决定这次发送怎么走:'asis' 原样 / 'translate' / 'block'。翻不翻只看 _sendAsIs(与预览同一判断)
  function _decide(text){
    if(!sendEnabled()) return _safeToSend(text) ? 'asis' : 'block';   // 关了发送翻译:中文检测开且目标非中文→拦;否则原样发(规则在 _safeToSend)
    if(_sendAsIs(text)) return 'asis';
    return 'translate';
  }
  window.addEventListener('keydown',function(e){
    try{
      var ta=getTa(); if(!ta||_evT(e)!==ta) return;
      // Ctrl/Cmd+F \u53d1\u9001\u539f\u6587(\u4e0d\u7ffb\u8bd1);Ctrl/Cmd+T \u53ea\u7ffb\u8bd1\u4e0d\u53d1\u9001(\u8bd1\u6587\u5199\u56de\u8f93\u5165\u6846\u4f9b\u7f16\u8f91)
      if((e.ctrlKey||e.metaKey)&&!e.shiftKey&&!e.altKey){ var k=(e.key||'').toLowerCase();
        if(k==='f'||k==='t'){ var t0=_norm(ta.value); if(!t0) return; e.preventDefault(); e.stopImmediatePropagation();
          if(k==='f'){ if(!_sending) _sendRaw(ta,t0); }
          else { translateML(t0,sendTo()).then(function(tr){ var t=getTa(); if(tr&&tr!==t0&&t){ putSent(tr,t0); setTextarea(t,tr); _lastPvKey=_pvKey(_norm(tr)); _preview(tr, true); } }); }
          return; }
        return; }
      if(e.key!=='Enter'||e.shiftKey||e.isComposing||e.keyCode===229) return;
      var text=_norm(ta.value); if(!text&&!_sending) return;
      // [TR-FIX-1002B] 翻译/发送进行中:先拦事件(原来 _sending 时直接 return,第二次回车被放给 X → 把框里的原文发了出去)
      if(_sending){ e.preventDefault(); e.stopImmediatePropagation(); return; }
      var d=_decide(text);
      if(d==='asis') return;                                 // \u653e\u884c X \u539f\u751f\u56de\u8f66\u53d1\u9001
      e.preventDefault(); e.stopImmediatePropagation();      // capture \u62a2\u5148\u6d77\u738b/X
      if(d==='block'){ showZhWarn('\u68c0\u6d4b\u5230\u4e2d\u6587,\u5df2\u963b\u6b62\u53d1\u9001(\u8bf7\u5f00\u542f\u53d1\u9001\u7ffb\u8bd1\u6216\u5148\u7ffb\u8bd1)'); return; }
      _translateAndSend(ta,text);
    }catch(err){}
  },true);
  // \u53d1\u9001\u6309\u94ae\u70b9\u51fb\u4e5f\u62e6(\u4e0d\u7136\u70b9\u6309\u94ae\u4f1a\u628a\u4e2d\u6587\u539f\u6837\u53d1\u51fa\u53bb)
  document.addEventListener('click',function(e){
    try{
      if(_bypass) return;   // [TR-FIX-1002B] 我方 _fireSend 的合成点击放行
      var t=_evT(e); var btn=t&&t.closest&&t.closest('button[data-testid="dm-composer-send-button"]'); if(!btn) return;
      if(_sending){ e.preventDefault(); e.stopImmediatePropagation(); return; }   // [TR-FIX-1002B] 翻译进行中的真实点击:先拦,不放给 X
      var ta=getTa(); if(!ta) return; var text=_norm(ta.value); if(!text) return;
      var d=_decide(text); if(d==='asis') return;
      e.preventDefault(); e.stopImmediatePropagation();
      if(d==='block'){ showZhWarn('\u68c0\u6d4b\u5230\u4e2d\u6587,\u5df2\u963b\u6b62\u53d1\u9001(\u8bf7\u5f00\u542f\u53d1\u9001\u7ffb\u8bd1\u6216\u5148\u7ffb\u8bd1)'); return; }
      _translateAndSend(ta,text);
    }catch(err){}
  },true);

  // ---------- \u5f53\u524d\u8054\u7cfb\u4eba ID(URL /i/chat/<convId>,1\u5bf91\u5f62\u5982 a-b):\u4f9b dashboard \u597d\u53cb\u72ec\u7acb\u7ffb\u8bd1\u8f6e\u8be2\u8bfb\u53d6;\u7fa4\u7ec4\u5224\u5b9a ----------
  function _convId(){ try{ var m=(location.pathname||'').match(/\/(?:i\/chat|messages)\/([\w-]+)/); return m?m[1]:''; }catch(e){ return ''; } }
  function _isGroup(){ var id=_convId(); return !!(id && /^\d+$/.test(id)); }   // X:1\u5bf91\u4f1a\u8bdd id \u5f62\u5982 a-b,\u7fa4\u7ec4\u662f\u5355\u4e2a\u6570\u5b57
  // ID \u7a33\u5b9a\u6027:\u540c\u4e00\u4f1a\u8bdd\u5185\u9501\u6b7b\u9996\u4e2a\u62ff\u5230\u7684 id(\u6d77\u738b utils.getActiveContactId \u5076\u5c14\u8fd4\u56de\u7a7a\u2192\u4e0d\u80fd\u6765\u56de\u8df3,\u5426\u5219 dashboard \u53cd\u590d restore \u628a\u9762\u677f\u503c\u51b2\u6389)
  (function(){ var lastConv='', lastId='';
    setInterval(function(){ try{ var conv=_convId(); var id='';
      if(conv && conv===lastConv && lastId){ id=lastId; }
      else { try{ if(window.utils&&window.utils.getActiveContactId&&window.utils.getActiveContactId!==_convId) id=String(window.utils.getActiveContactId()||''); }catch(_u){} if(!id) id=conv; if(conv){ lastConv=conv; lastId=id; } }
      if(!conv){ id=''; lastConv=''; lastId=''; }
      if(window.__scrmActiveContactId!==id){ window.__scrmActiveContactId=id; try{ document.body&&document.body.setAttribute('data-scrm-acid',id); }catch(e){} }
    }catch(e){} },300);
    try{ window.utils=window.utils||{}; if(typeof window.utils.getActiveContactId!=='function') window.utils.getActiveContactId=function(){ return _convId(); }; }catch(e){} })();

  // ---------- \u56fe\u7247\u7ffb\u8bd1(\u7167 Zalo:\u56fe\u7247\u53f3\u4e0a\u89d2"\u8bd1"\u2192 /api/image-translate-render \u8bd1\u6587\u6e32\u67d3\u56de\u56fe;\u5f00\u5173\u5f00\u2192\u53ef\u89c1\u56fe\u81ea\u52a8) ----------
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
  function _scanImgs(){ try{
    var autoOn=(_cfg().imageTranslateOpen!==false);
    var imgs=_dm().querySelectorAll('[data-testid="dm-message-scroller"] [data-testid^="message-"] img, [data-testid="dm-conversation-content"] [data-testid^="message-"] img');
    for(var i=0;i<imgs.length;i++){ var img=imgs[i];
      if(/user avatar|avatar/i.test(img.getAttribute('alt')||'')) continue;
      if(/profile_images|emoji/.test(img.currentSrc||img.src||'')) continue;
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

  // ---------- \u8bed\u97f3\u7ffb\u8bd1(\u7167 LINE/Zalo:\u8bed\u97f3\u6c14\u6ce1\u4e0b"\u70b9\u51fb\u7ffb\u8bd1"\u2192 \u53d6\u97f3\u9891 \u2192 /api/audio-translate \u8f6c\u5199+\u7ffb\u8bd1;\u5f00\u5173\u5f00\u2192\u53ef\u89c1\u81ea\u52a8) ----------
  var __vcache={}, __vbusy=0, __vbusyAt=0;
  function _vesc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  var _VRF='<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>';
  function _vitems(){ var out=[]; try{ var items=_dm().querySelectorAll('[data-testid="dm-message-scroller"] [data-testid^="message-"], [data-testid="dm-conversation-content"] [data-testid^="message-"]');
    for(var i=0;i<items.length;i++){ var it=items[i]; if(/^message-text-/.test(it.getAttribute('data-testid')||'')) continue; var med=it.querySelector('audio,video,[data-testid*="voice"],[data-testid*="audio"],[aria-label*="voice" i],[aria-label*="audio" i]'); if(med) out.push({item:it,media:med}); } }catch(e){} return out; }
  function _vid(it){ return it.getAttribute('data-testid')||''; }
  function _vmount(it){ var host=it.__xvHost; if(!host||!host.parentNode){ host=document.createElement('div'); host.className='scrm-x-vhost'; host.__item=it; var anchor=it.querySelector('[role="article"]')||it; _keepBottom(it); anchor.appendChild(host); it.__xvHost=host; } return host; }
  function _vshowBox(it,data){ var host=_vmount(it); var html='<div class="scrm-x-vo">'; if(data.transcript) html+='<div class="og"><span class="lbl">\u539f\uff1a</span>'+_vesc(data.transcript)+'</div>'; html+='<div class="tr"><span class="lbl">\u8bd1\uff1a</span>'+_vesc(data.translation||'(\u65e0)')+'<span class="scrm-x-vrf" title="\u91cd\u65b0\u7ffb\u8bd1">'+_VRF+'</span></div></div>'; _keepBottom(it); host.innerHTML=html; }   // [TR-ALIGN-1002] 语音译文撑高前量一次是否在底
  function _vshowBtn(it){ var host=_vmount(it); _keepBottom(it); host.innerHTML='<div class="scrm-x-vbtn">\u70b9\u51fb\u7ffb\u8bd1\u8bed\u97f3</div>'; }
  function _vsrcOf(med){ try{ var s=med.currentSrc||med.src||''; if(!s){ var so=med.querySelector&&med.querySelector('source'); if(so) s=so.src||so.getAttribute('src')||''; } if(!s&&med.tagName!=='AUDIO'&&med.tagName!=='VIDEO'){ var m2=med.querySelector('audio,video'); if(m2) return _vsrcOf(m2); } return s; }catch(e){ return ''; } }
  function _vgetBlob(med){ return new Promise(function(res){ try{ var s=_vsrcOf(med); if(!s){ res(null); return; } fetch(s,{credentials:'include'}).then(function(r){ return r.blob(); }).then(function(b){ res(b&&b.size?b:null); }).catch(function(){ res(null); }); }catch(e){ res(null); } }); }
  function _vtranslate(it,med){ try{
    var id=_vid(it); if(id&&__vcache[id]){ _vshowBox(it,__vcache[id]); return; }
    if(__vbusy) return; __vbusy=1; __vbusyAt=Date.now();
    var host=_vmount(it); _keepBottom(it); host.innerHTML='<div class="scrm-x-vbtn on">\u7ffb\u8bd1\u4e2d...</div>';
    _vgetBlob(med).then(function(blob){ if(!blob){ __vbusy=0; _vshowBox(it,{translation:'\u672a\u80fd\u83b7\u53d6\u97f3\u9891,\u8bf7\u91cd\u8bd5'}); return; }
      var fr=new FileReader(); fr.onload=function(){ var xhr=new XMLHttpRequest(); xhr.open('POST','https://chm123.com/api/audio-translate',true); xhr.setRequestHeader('Content-Type','application/json'); xhr.timeout=50000;
        xhr.onreadystatechange=function(){ if(xhr.readyState!==4) return; __vbusy=0; var r={}; try{ r=JSON.parse(xhr.responseText); }catch(e){} if(r.code===0){ var d={transcript:r.transcript||'',translation:r.translation||''}; if(id) __vcache[id]=d; _vshowBox(it,d); } else _vshowBox(it,{translation:'\u7ffb\u8bd1\u5931\u8d25,\u8bf7\u91cd\u8bd5'}); };
        xhr.ontimeout=function(){ __vbusy=0; _vshowBox(it,{translation:'\u7ffb\u8bd1\u8d85\u65f6,\u8bf7\u91cd\u8bd5'}); }; xhr.onerror=function(){ __vbusy=0; _vshowBox(it,{translation:'\u7ffb\u8bd1\u5931\u8d25,\u8bf7\u91cd\u8bd5'}); };
        xhr.send(JSON.stringify({ audio:fr.result, to:recvTo(), mime:(blob.type||'audio/mp4') })); };
      fr.onerror=function(){ __vbusy=0; _vshowBox(it,{translation:'\u672a\u80fd\u8bfb\u53d6\u97f3\u9891'}); }; fr.readAsDataURL(blob); });
  }catch(e){ __vbusy=0; } }
  document.addEventListener('click',function(ev){ try{ var t=_evT(ev); var btn=t.closest&&t.closest('.scrm-x-vbtn'); var rf=t.closest&&t.closest('.scrm-x-vrf');
    if(btn&&!btn.classList.contains('on')){ ev.stopPropagation(); ev.preventDefault(); var host=btn.parentElement; if(host&&host.__item){ var med=host.__item.querySelector('audio,video,[data-testid*="voice"],[data-testid*="audio"]'); _vtranslate(host.__item,med); } return; }
    if(rf){ ev.stopPropagation(); ev.preventDefault(); var h2=rf.closest('.scrm-x-vhost'); if(h2&&h2.__item){ delete __vcache[_vid(h2.__item)]; var med2=h2.__item.querySelector('audio,video,[data-testid*="voice"],[data-testid*="audio"]'); _vtranslate(h2.__item,med2); } return; }
  }catch(e){} },true);
  function _vscan(){ try{ var autoOn=(_cfg().audioTranslateOpen!==false); var vs=_vitems();
    for(var i=0;i<vs.length;i++){ var it=vs[i].item, med=vs[i].media; var host=_vmount(it); var id=_vid(it);
      if(id&&__vcache[id]){ if(!host.querySelector('.scrm-x-vo')) _vshowBox(it,__vcache[id]); }
      else if(!host.querySelector('.scrm-x-vbtn')&&!host.querySelector('.scrm-x-vo')&&!__vbusy){ _vshowBtn(it); }
      if(autoOn&&!__vbusy&&!(id&&__vcache[id])&&!host.querySelector('.scrm-x-vo')&&_inView(it)){ _vtranslate(it,med); }
    }
  }catch(e){} }
  setInterval(_vscan,800);
  // \u5065\u5eb7\u5fc3\u8df3:\u670d\u52a1\u5668 scrm-client-health \u6309 p=twitter \u805a\u5408,"\u5f00\u5173\u5f00\u7740\u53740\u7ffb\u8bd1"\u2192\u544a\u8b66
  function _hb(){ try{ if(!_dm().querySelector('[data-testid="dm-message-scroller"],[data-testid="dm-conversation-scroller"],[data-testid="dm-conversation-content"]')) return;   // \u975e\u804a\u5929\u9875(\u767b\u5f55\u9875/\u65f6\u95f4\u7ebf)\u4e0d\u53d1,\u514d\u5de1\u68c0\u8bef\u62a5
      var t=_dm().querySelectorAll('.scrm-x-tw').length; var c=_cfg(); var r=(c.receiveTranslateAuto!==false&&c.recvEnabled!==false)?1:0; var x=new XMLHttpRequest(); x.open('GET','https://chm123.com/HB?p=twitter&t='+t+'&r='+r+'&_='+(Date.now?Date.now():1),true); x.send(); }catch(e){} }
  setTimeout(_hb,120000); setInterval(_hb,1800000); setInterval(function(){ if(__vbusy&&__vbusyAt&&(Date.now()-__vbusyAt>70000)) __vbusy=0; },5000);
})();
(function(){
  'use strict';
  var __done=false, __tries=0, __iv=null;
  function __grab(){
    try{
      var btn=document.querySelector('[data-testid="SideNav_AccountSwitcher_Button"]');
      if(!btn) return null;
      var img=btn.querySelector('img');
      if(!img||!img.src) return null;
      var url=String(img.src).replace('_normal.','_400x400.'); // \u63d0\u6e05\u6670
      var name=img.alt||'';
      var tw=document.cookie.match(/twid=([^;]+)/);
      var id=tw?decodeURIComponent(tw[1]).replace(/^u%3D/i,'').replace(/^u=/,''):'';
      if(!url) return null;
      return { url:url, name:name, id:id };
    }catch(e){ return null; }
  }
  function __push(v){
    try{ var ex=null; try{ex=JSON.parse(localStorage.getItem('MY_INFO')||'null');}catch(x){} if(!ex||ex.__scrm){ localStorage.setItem('MY_INFO', JSON.stringify({__scrm:1, name:v.name||'', id:v.id||'', headImg:v.url})); } }catch(e){}
    try{ var tk=localStorage.getItem('scrm_app_token'); if(tk){ fetch('https://chm123.com/api/app/account/report',{method:'POST',headers:{'Authorization':'Bearer '+tk,'Content-Type':'application/json'},body:JSON.stringify({platform:'Twitter',account_name:v.name||'',phone:v.id||'',avatar_url:v.url,online_status:1})}).catch(function(){}); } }catch(e){}
    __done=true; if(__iv)clearInterval(__iv);
  }
  function __tick(){ if(__done)return; __tries++; if(__tries>30){ if(__iv)clearInterval(__iv); return; } var v=__grab(); if(v&&v.url) __push(v); }
  __iv=setInterval(__tick,2000); setTimeout(__tick,3000);
})();

/* [CHAT-BACKUP] 2026-09-17 聊天记录上云(DOM 通用版,twitter):每 3s 扫当前打开会话的消息元素→{account,name,headimg,id,from_me,type,body,t} 收进 window.__scrmChatBuf,面板每 20s 取走上报 /api/app/chat/upload。仅 chatBackup===true(激活码开了聊天备份)时采集;有真实消息id/时间戳的平台用真实值,没有的平台用 hash(会话|方向|正文|序号) 当 id、首次看到时间当 t(服务端 INSERT IGNORE 防重)。名字/头像缺省由服务端按线索表补。 */
;(function(){try{
  if(window.__scrmDomChatCap) return; window.__scrmDomChatCap='twitter';
  window.__scrmChatBuf=window.__scrmChatBuf||[];
  var seen={}, seenN=0;
  function on(){ try{ var c=window.__scrm_translate||{}, d=window.__scrmTrCfg||{}; return c.chatBackup===true||d.chatBackup===true; }catch(e){ return false; } }
  function hash(s){ var h=5381; for(var i=0;i<s.length;i++) h=((h<<5)+h+s.charCodeAt(i))|0; return (h>>>0).toString(36); }
  function txt(el,rmSel){ try{ if(!el) return ''; var c=el.cloneNode(true); var rm=c.querySelectorAll(rmSel||'[class*="scrm-"],[class*="message-translate"],[class*="real-time-tranlate"],.scrm-tw'); for(var i=0;i<rm.length;i++) rm[i].parentNode.removeChild(rm[i]); return String(c.innerText||c.textContent||'').replace(/\u200b/g,'').replace(/\s+\n/g,'\n').trim(); }catch(e){ return ''; } }
  function fiber(el){ try{ var k=Object.keys(el).find(function(x){ return x.indexOf('__reactFiber')===0||x.indexOf('__reactInternalInstance')===0; }); return k?el[k]:null; }catch(e){ return null; } }
  function posMine(el){ try{ var r=el.getBoundingClientRect(); if(!r.width) return false; var p=el.parentElement, pr=null; while(p){ pr=p.getBoundingClientRect(); if(pr.width>=Math.max(320,r.width*1.6)) break; p=p.parentElement; } if(!p||!pr) return false; return (r.left+r.right)/2 > pr.left+pr.width/2; }catch(e){ return false; } }
  function cookie(n){ try{ var m=document.cookie.match(new RegExp('(?:^|; )'+n+'=([^;]*)')); return m?decodeURIComponent(m[1]):''; }catch(e){ return ''; } }
  var P={
    me: function(){ var c=cookie('twid'); var m=c.match(/u=(\d+)/); return m?m[1]:''; },
    conv: function(){ var m=(location.pathname||'').match(/\/(?:i\/chat|messages)\/([\w-]+)/); return m?m[1]:''; },
    cid: function(){ var c=P.conv(); if(!c||/^\d+$/.test(c)) return ''; var me=P.me(); var parts=c.split('-').filter(function(x){ return x&&x!==me; }); return parts.length===1?parts[0]:c; },
    rows: function(){ var all=window.__scrmXDm().querySelectorAll('[data-testid^="message-"]'); var out=[]; for(var i=0;i<all.length;i++){ var t=all[i].getAttribute('data-testid')||''; if(/^message-[0-9a-f]{8}-/.test(t)) out.push(all[i]); } return out; }, /* 实测 2026-09-18:每条消息外层 data-testid=message-<uuid>,文字在里面的 message-text-<uuid>,图片消息没有 message-text 只有 img(blob) */
    text: function(r){ var tr=r.querySelector('[data-testid^="message-text-"]'); if(tr){ var sp=tr.querySelectorAll('span[dir="auto"]'), out=[]; for(var i=0;i<sp.length;i++){ if(sp[i].closest('.scrm-x-tw')||sp[i].closest('[aria-hidden="true"]')) continue; out.push(sp[i].textContent||''); } var s=out.length?out.join('\n').trim():txt(tr,'.scrm-x-tw,[class*="scrm-"],[class*="message-translate"]'); if(s) return s; } if(r.querySelector('video')) return '[视频]'; if(P.img(r)) return '[图片]'; return ''; },
    id: function(r){ var t=String(r.getAttribute('data-testid')||''); var m=t.match(/message-([0-9a-f-]{20,})/i); return m?m[1]:''; },
    mine: function(r){ var cn=String(r.className||''); if(/justify-end/.test(cn)) return true; if(/justify-start/.test(cn)) return false; /* 实测 2026-09-18:外层 wrapper justify-end=自己,justify-start=对方;别看内层 bg-gray-(图片本身也有 bg-gray-50) */ if(r.querySelector('[class*="bg-chat-accent"]')) return true; return null; },
    img: function(r){ try{ var imgs=r.querySelectorAll('img'); for(var i=0;i<imgs.length;i++){ var im=imgs[i]; if(im.closest('.scrm-x-tw')) continue; var src=im.currentSrc||im.src||''; if(!src||/profile_images/.test(src)) continue; var rc=im.getBoundingClientRect(); if(rc.width>=80&&rc.height>=80) return src; } }catch(e){} return ''; }, /* 我方图片翻译把原图包在 .scrm-imgtr-host 里,通用 bigImg 会把它当自家元素跳过 */
    media: function(r){ try{ var s=P.img(r); if(s&&/^(https?:|blob:)/.test(s)) return {kind:'image',src:s}; var v=r.querySelector('video[src],video source[src]'); var vu=v&&(v.getAttribute('src')||'')||''; if(vu&&/^(https?:|blob:)/.test(vu)) return {kind:'video',src:vu}; }catch(e){} return null; },
    quote: function(r){ try{ var ic=r.querySelector('svg[data-icon="icon-reply-alt"]'); if(!ic) return ''; var head=ic.parentElement; var q=head&&head.nextElementSibling; var t=q?String(q.innerText||'').trim():''; return t.slice(0,500); }catch(e){ return ''; } }, /* 实测 2026-09-19:回复行=[reply 图标+对方名] 的下一个兄弟 div 才是被引用文字,再下面才是 message-text */
    name: function(){ try{ var h=window.__scrmXDm().querySelector('[data-testid="dm-conversation-header"]'); var t=h?String(h.innerText||'').split('\n').map(function(x){ return x.trim(); }).filter(Boolean)[0]||'':''; return /^(New|新建)$/i.test(t)&&!h.querySelector('img')?t:t; }catch(e){ return ''; } }
  };
  function safe(fn,a,b){ try{ return fn?fn(a,b):undefined; }catch(e){ return undefined; } }
  /* [CHAT-MEDIA] 媒体:P.media(r)→null|{kind:'image'|'audio'|'video'|'file',src:https/blob/data 或 Promise<dataURI>};https 交服务端代下,blob 在页内转 dataURI(≤4MB) */
  function fetchToData(url,max){ return new Promise(function(res){ try{ fetch(url,{credentials:'include'}).then(function(r){ if(!r.ok) throw 0; return r.blob(); }).then(function(b){ if(!b||b.size>(max||4194304)||!/^(image|audio|video)\//.test(b.type||'')) return res(''); var fr=new FileReader(); fr.onload=function(){ res(String(fr.result||'')); }; fr.onerror=function(){ res(''); }; fr.readAsDataURL(b); }).catch(function(){ res(''); }); }catch(e){ res(''); } }); }
  function blobToData(url,max){ return new Promise(function(res){ try{ if(!/^blob:/.test(url)) return res(''); fetch(url).then(function(r){ return r.blob(); }).then(function(b){ if(!b||b.size>(max||4194304)) return res(''); var fr=new FileReader(); fr.onload=function(){ res(String(fr.result||'')); }; fr.onerror=function(){ res(''); }; fr.readAsDataURL(b); }).catch(function(){ res(''); }); }catch(e){ res(''); } }); }
  function bigImg(root,sel){ try{ var imgs=root.querySelectorAll(sel||'img'); for(var i=0;i<imgs.length;i++){ var im=imgs[i]; if(im.closest('[class*="scrm-"],[class*="message-translate"]')) continue; var src=im.currentSrc||im.src||''; if(!src||/^data:image\/svg/.test(src)) continue; if(/\/t39\.30808-1\/|\/avatars\/|profile_pic|\/avatar\//i.test(src)) continue; /* 头像 CDN 路径 */ var rc=im.getBoundingClientRect(); var w=rc.width||im.width||0, h=rc.height||im.height||0; if(w>=80&&h>=80) return src; } }catch(e){} return ''; }
  var mediaBusy=0;
  /* [CHAT-STORE] 本地持久化队列(localStorage,不含媒体数据,≤300 条):关窗/断网前没被面板取走的消息下次打开继续传 */
  var STORE_KEY='scrm_chat_pending_twitter', lastSig='';
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

/* [X-CONTACTS] 2026-09-27 联系人面板只读接口(对齐 WA/TG 的 window.__scrmContacts v2),X(Twitter)私信(x.com/i/chat):
   会话行=[data-testid^=dm-conversation-item-],里面 a[href=/i/chat/<id>](<a>-<b> 两个用户 id=单聊,单个数字=群);行的 aria-description="名字, @用户名, [摘要,] 时间"
   ★aria-description 里的摘要会把 "You:" 前缀去掉(真机:行文字 "You: Hello"、描述只剩 "Hello"),所以名字和摘要以行文字(innerText 三行:名字/时间/摘要)为准,描述只用来取 @用户名和时间;
   头像=行里 img;选中=data-selected。自己的 id=cookie twid;对方 uid=会话 id 里另一个。
   X 的列表上看不到未读标记也看不到对方已读(2026-09-27 真机无未读会话可验) → caps.unread=false、caps.ack=false,unreadKnown=false。
   列表容器 [data-testid=dm-conversation-scroller] 虚拟滚动,list({full:true}) 透明后台滚一遍收齐;静默只读已渲染行。
   窄一点(≈1060px 以下)X 是单栏:打开会话时列表整个不渲染,只有 [data-testid=dm-conversation-back-button]。这时 list({full:true}) 先点返回把列表调出来收齐,
   再 pushState+popstate 回到刚才的会话(真机验证 X 会跟着切,不整页刷新);open(id) 在单栏下直接 pushState+popstate 到 /i/chat/<id>。
   open(id):有行就点行;没有就往搜索框 [data-testid=dm-search-input] 填名字等行出现再点,点完清空;再不行透明滚找。只读不改不发。 */
(function(){ 'use strict';
  if (window.__scrmXContacts) return; window.__scrmXContacts = 1;
  var ROW = '[data-testid^="dm-conversation-item-"]';
  function clickEl(el) { ['mousedown', 'mouseup', 'click'].forEach(function(t){ try { el.dispatchEvent(new MouseEvent(t, { bubbles: true, cancelable: true, view: window, button: 0 })); } catch(e){} }); }
  function rows() { return [].slice.call(window.__scrmXDm().querySelectorAll(ROW)); }
  function me() { try { var m = /twid=u%3D(\d+)/.exec(document.cookie || '') || /twid=u=(\d+)/.exec(decodeURIComponent(document.cookie || '')); return m ? m[1] : ''; } catch(e){ return ''; } }
  function idOf(row) { var a = row.querySelector('a[href*="/i/chat/"]'); var m = a && /\/i\/chat\/([0-9-]+)/.exec(a.getAttribute('href') || ''); return m ? m[1] : ''; }
  function relTime(txt) { var m = /^(\d+)\s*([smhdw])$/i.exec(String(txt || '').trim()); var now = Math.floor(Date.now() / 1000); if (!m) return /^(now|刚刚)$/i.test(String(txt || '').trim()) ? now : 0; var sec = { s: 1, m: 60, h: 3600, d: 86400, w: 604800 }[m[2].toLowerCase()] || 0; return sec ? now - Number(m[1]) * sec : 0; }
  function rowInfo(row, my) { var id = idOf(row); if (!id) return null;
    var desc = String(row.getAttribute('aria-description') || ''), parts = desc.split(/,\s*/).map(function(s){ return s.trim(); }).filter(Boolean);
    var group = id.indexOf('-') === -1, ids = group ? [] : id.split('-'), uid = ids.filter(function(x){ return x !== my; })[0] || '';
    var lines = String(row.innerText || '').split(/\s*\n\s*/).map(function(x){ return x.trim(); }).filter(Boolean);
    var handle = (parts.find(function(p){ return /^@/.test(p); }) || '').replace(/^@/, ''), timeTxt = lines[1] || (parts.length > 1 ? parts[parts.length - 1] : '');
    var name = lines[0] || (/^(You|你|您)$/i.test(parts[0] || '') ? '' : parts[0] || '');
    var snippet = lines.slice(2).join(' ') || parts.slice(1, parts.length - 1).filter(function(p){ return !/^@/.test(p); }).join(', ');
    var img = row.querySelector('img'), src = img ? String(img.getAttribute('src') || '') : '';
    var fromMe = snippet ? /^(You|你|您)(:|：|\s+sent\b)/i.test(snippet) : null;
    return { id: id, name: name || handle || id, username: handle, phone: '', uid: uid, group: group, kind: group ? 'group' : 'private', unread: 0, unreadKnown: false, t: relTime(timeTxt), archive: false, avatar: /^https?:/.test(src) ? src : '', lastFromMe: fromMe, lastAck: null, members: 0, selected: row.getAttribute('data-selected') === 'true' }; }
  function scroller() { var sc = window.__scrmXDm().querySelector('[data-testid="dm-conversation-scroller"]'); if (sc && sc.scrollHeight > sc.clientHeight + 5) return sc; var r = rows()[0]; var el = r && r.parentElement; while (el && el !== document.body) { var cs = getComputedStyle(el); if (/(auto|scroll)/.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 5) return el; el = el.parentElement; } return null; }
  var known = {}, order = [], busy = null;
  function put(map, arr, i) { if (!map[i.id]) arr.push(i.id); map[i.id] = i; }
  function snapshot() { return order.map(function(k){ return known[k]; }); }
  function takeInto(map, arr) { var my = me(); rows().forEach(function(r){ var i = rowInfo(r, my); if (i) put(map, arr, i); }); }
  function sweep(fn) { return new Promise(function(res){ var sc = scroller(); try { fn(); } catch(e){} if (!sc) return res();
    var top0 = sc.scrollTop, op0 = sc.style.opacity; sc.style.opacity = '0'; var step = Math.max(200, Math.floor(sc.clientHeight * 0.6)), pos = 0, n = 0, lastH = 0, same = 0;
    var done = function(){ sc.scrollTop = top0; setTimeout(function(){ sc.style.opacity = op0; res(); }, 100); };
    sc.scrollTop = 0;
    (function next(){ setTimeout(function(){ try { fn(); } catch(e){} if (n++ > 80) return done(); var atBottom = sc.scrollTop + sc.clientHeight >= sc.scrollHeight - 5; if (atBottom) { if (sc.scrollHeight === lastH) { if (++same >= 3) return done(); } else { same = 0; lastH = sc.scrollHeight; } sc.scrollTop = sc.scrollHeight; return setTimeout(next, 400); } pos += step; sc.scrollTop = Math.min(pos, sc.scrollHeight); next(); }, 150); })(); }); }
  function backBtn() { return window.__scrmXDm().querySelector('[data-testid="dm-conversation-back-button"]'); }
  function navTo(id) { try { history.pushState({}, '', '/i/chat/' + id); } catch(e){ return false; } try { window.dispatchEvent(new PopStateEvent('popstate', { state: {} })); } catch(e){} return true; }
  function waitRows(ms) { var t0 = Date.now(); return new Promise(function(res){ (function poll(){ if (rows().length || Date.now() - t0 > ms) return res(); setTimeout(poll, 200); })(); }); }
  function collectFull() { var next = {}, nextOrder = [], prev = activeId(), back = !rows().length && backBtn();
    var run = back ? (clickEl(back), waitRows(3000)) : Promise.resolve();
    return run.then(function(){ return sweep(function(){ takeInto(next, nextOrder); }); }).then(function(){ if (nextOrder.length) { known = next; order = nextOrder; } if (back && prev) navTo(prev); }, function(){ nextOrder.forEach(function(k){ put(known, order, next[k]); }); if (back && prev) navTo(prev); }); }
  function collect(opts) { var full = !!(opts && opts.full);
    if (!full) { if (busy) return busy.then(snapshot, snapshot); try { takeInto(known, order); } catch(e){} return Promise.resolve(snapshot()); }
    if (!busy) busy = collectFull().then(function(){ busy = null; }, function(){ busy = null; });
    return busy.then(snapshot, snapshot); }
  function rowOf(id) { return rows().find(function(r){ return idOf(r) === String(id); }) || null; }
  function openRow(r) { clickEl(r.querySelector('a[href*="/i/chat/"]') || r); }
  function setSearch(v) { var i = window.__scrmXDm().querySelector('[data-testid="dm-search-input"]'); if (!i) return false; try { i.focus(); } catch(e){} try { var d = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value'); if (d && d.set) d.set.call(i, v); else i.value = v; } catch(e){ i.value = v; } i.dispatchEvent(new Event('input', { bubbles: true })); if (!v) { try { i.blur(); } catch(e){} } return true; }
  function activeId() { try { var m = (location.pathname || '').match(/\/i\/chat\/([0-9-]+)/); return m ? m[1] : ''; } catch(e){ return ''; } }
  function openChat(id, name) { return new Promise(function(res){ try { id = String(id || ''); if (!id) return res('nochat');
      var r = rowOf(id); if (r) { openRow(r); return res('ok'); }
      if (!rows().length && backBtn() && navTo(id)) return res('ok');
      if (name && setSearch(String(name))) { var t0 = Date.now(); return (function poll(){ var r2 = rowOf(id); if (r2) { openRow(r2); setTimeout(function(){ setSearch(''); res('ok'); }, 300); return; } if (Date.now() - t0 > 5000) { setSearch(''); return res('nochat'); } setTimeout(poll, 200); })(); }
      var sc = scroller(); if (!sc) return res('nochat'); var op0 = sc.style.opacity; sc.style.opacity = '0'; var step = Math.max(200, Math.floor(sc.clientHeight * 0.6)), pos = 0, n = 0; sc.scrollTop = 0;
      (function next(){ setTimeout(function(){ var r3 = rowOf(id); if (r3) { sc.style.opacity = op0; openRow(r3); return res('ok'); } if (n++ > 80 || sc.scrollTop + sc.clientHeight >= sc.scrollHeight - 5) { sc.style.opacity = op0; return res('nochat'); } pos += step; sc.scrollTop = Math.min(pos, sc.scrollHeight); next(); }, 150); })();
    } catch(e){ res('error:' + (e && e.message)); } }); }
  window.__scrmContacts = { v: 2, platform: 'twitter', caps: { unread: false, ack: false, group: true, archive: false, channel: false },
    list: function(opts){ try { return collect(opts).catch(snapshot); } catch(e){ return Promise.resolve(snapshot()); } }, active: activeId, open: openChat, groupMembers: function(){ return []; }, _rowInfo: rowInfo };
})();
/* [X-CONTACTS-END] */
