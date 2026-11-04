/* __scrmPatchV1__ scrm-patch-zalo ADAPTER v1 —— Zalo 自研翻译(发送方向:根治逗号截断+预览)。
   Zalo 特性:无 IPC(用直接 fetch https 翻译)、输入框 #richInput 是普通 contenteditable(非 Lexical)、回车发送。 */
(function(){
  'use strict';
  if (window.__scrmZaloTr) return; window.__scrmZaloTr = true;

  var DBG = false;
  function rpt(msg){ if(!DBG) return; try{ (new Image()).src='https://chm123.com/ZTR?d='+encodeURIComponent(String(msg).slice(0,360))+'&t='+(Date.now?Date.now():Math.floor(Math.random()*1e9)); }catch(e){} }
  rpt('adapter v1 loaded');
  // ===== 当前联系人ID(海王 window.utils 暴露,补丁同世界可读)=====
  function activeCid(){ try{ var u=window.utils; return (u&&u.getActiveContactId&&u.getActiveContactId())||''; }catch(e){ return ''; } }
  // 当前会话 key:用 document.title("Zalo - 会话名")里的会话名(稳定、切会话就变;getActiveContactId 不可靠故弃用)。
  // 只在聊天真正打开(有输入框)时才取,登录/列表页返回空。
  // 当前会话ID:照搬海王 Kt —— 从 #chatViewContainer 的 React 内部实例读 conversation.userId(稳定可靠,不闪不依赖可见性)
  function convKey(){ try{
      var e=document.getElementById('chatViewContainer'); if(!e) return '';
      var k=Object.keys(e).find(function(kk){ return kk.indexOf('__reactInternalInstance')===0 || kk.indexOf('__reactFiber')===0; });
      if(!k) return '';
      var uid=null;
      try{ uid=e[k].pendingProps.children[2].props.conversation.userId; }catch(_){}
      if(!uid){ try{ var ch=e[k].pendingProps.children; for(var i=0;i<ch.length;i++){ var c=ch[i]; if(c&&c.props&&c.props.conversation&&c.props.conversation.userId){ uid=c.props.conversation.userId; break; } } }catch(_){} }
      return uid ? 'z:'+uid : '';
    }catch(e){ return ''; } }
  // 稳定发布当前会话 key 到 window,dashboard 通过 exec 读它做"好友独立翻译"的按会话 key。
  setInterval(function(){ try{ var c=convKey(); if(c) window.__scrmActiveContactId=c; }catch(e){} }, 200);

  function _norm(s){ return (s||'').replace(/[​‌‍﻿]/g,'').replace(/\r/g,'').replace(/^\s+|\s+$/g,''); }
  // 读设置面板注入的配置 window.__scrmTrCfg(main.js 从 updateTranslate 注入):目标语言/开关
  function _cfg(){ try{ return window.__scrmTrCfg||{}; }catch(e){ return {}; } }
  // 发送目标语言(照海王 singleContactTranslate 架构):优先读"当前联系人"(convKey React id)的独立语言,
  // 没有才走全局。dashboard 只在改设置时把整张 singleContactTranslate 映射注入 __scrmTrCfg,切好友/切账号时零推送(不闪)。
  function sendTo(){ try{
      var id=convKey(), c=_cfg();
      if(id){ var sct=c.singleContactTranslate && c.singleContactTranslate[id];
        if(sct && (sct.singleContactTranslateOpen||sct.enabled) && (sct.sendTargetLanguage||sct.sendTo)) return sct.sendTargetLanguage||sct.sendTo; }
      // 没有好友独立 → 用"干净全局默认"(zaloGlobalSend,从 localStorage 注入,不受好友日语污染);兜底 sendTargetLanguage
      return c.zaloGlobalSend || c.sendTargetLanguage || c.sendTo || 'en';
    }catch(e){} return 'en'; }
  function recvTo(){ try{ var c=_cfg(); return c.receiveTargetLanguage || c.recvTo || 'zh-CN'; }catch(e){} return 'zh-CN'; }
  function sendEnabled(){ try{ var c=_cfg(); return c.sendTranslateAuto!==false; }catch(e){} return true; }   // 缺省开
  function recvEnabled(){ try{ var c=_cfg(); return c.receiveTranslateAuto!==false; }catch(e){} return true; }
  // 中文检测(设置面板 chineseCheck):开启后,若要发出的内容仍含中文(且目标非中文)→ 阻止发送+警告(照海王)
  function detectOn(){ try{ return _cfg().chineseCheck===true; }catch(e){} return false; }
  function _hasZh(t){ return /[一-鿿]/.test(t||''); }
  /* [TR-FIX-1002B] 本文件共用的规则只在这里定义一次(原 _sig 定义在 260 行附近,和预览/发送分在两处):
     _sig  = 签名:保留所有语言的字母/数字(\p{L}\p{N}),去 emoji/标点/空格。用于「译文与原文是否相同」「输入框里是不是译文」「我方发出原文映射」。
       (旧版只留拉丁+中日文 → 缅甸文/俄文/高棉文等被删光成空签名,原文映射/缓存全撞 → 显示 ":-")
     _safeToSend = 这段文字能不能发出去的唯一判断:目标语言不是中文/日文时,只要还含汉字就不能发(线路把原文原样吐回、
       或翻译没生效时,绝不能把中文发给客户)。回车/发送按钮的翻译发送、「签名相同 → 原样发」捷径、写入后核对,三个出口只调它。
       发送翻译关(用户自己选择原样发)不走它,仍由「中文检测」开关决定。 */
  function _sig(s){ s=String(s==null?'':s); try{ return s.replace(/[^\p{L}\p{N}]+/gu,'').toLowerCase(); }catch(e){ return s.replace(/[^0-9a-zA-Z一-鿿]+/g,'').toLowerCase(); } }
  function _safeToSend(t){ var to=String(sendTo()||'').toLowerCase(); if(to.indexOf('zh')===0||to.indexOf('ja')===0) return true; return !/\p{Script=Han}/u.test(String(t||'')); }
  function _tgtIsZh(){ var to=sendTo(); return !!(to && to.indexOf('zh')===0); }
  /* [TR-ALIGN-1002] 2026-10-02「要不要翻」唯一判断(预览/回车/发送按钮/Ctrl+T 共用,照 TG [TG-ZH-SAME]):
     目标是中文、输入里除汉字外没有别的文字(只有汉字/数字/标点/emoji)→ 不用翻,原样发送;其他一律去翻(CEO 只跳过空文本)。
     原来 containsChinese「不含汉字就原样发」→ 目标中文时打俄文/日文假名/韩文原样发出、目标英文时打俄文也不翻,已删。 */
  function _sendAsIs(src){ return _tgtIsZh() && !/\p{L}/u.test(String(src||'').replace(/\p{Script=Han}/gu,'')); }
  var _ASIS_NOTE='  (已是目标语言,原样发送)';
  var _zhWarnTimer=null;
  function showZhWarn(msg){
    try{
      var old=document.querySelector('.scrm-zh-warn'); if(old) old.remove(); clearTimeout(_zhWarnTimer);
      if(!document.querySelector('#scrm-zh-warn-style')){ var st=document.createElement('style'); st.id='scrm-zh-warn-style';
        st.textContent='@keyframes scrm-shake{0%,100%{transform:translateX(-50%)}25%{transform:translateX(calc(-50% - 5px))}75%{transform:translateX(calc(-50% + 5px))}}'; document.head.appendChild(st); }
      var w=document.createElement('div'); w.className='scrm-zh-warn';
      w.style.cssText='position:fixed;bottom:120px;left:50%;transform:translateX(-50%);background:#ff4444;color:#fff;padding:8px 16px;border-radius:8px;font-size:13px;z-index:99999;box-shadow:0 2px 8px rgba(0,0,0,.3);animation:scrm-shake .3s;';
      w.textContent=msg||'检测到中文,已阻止发送'; document.body.appendChild(w);
      _zhWarnTimer=setTimeout(function(){ w.remove(); }, 3000);
    }catch(e){}
  }
  // 翻译线路(读设置面板 route):谷歌系格式一样直接用;非谷歌(必应/火山/DeepL/有道格式各异)回退谷歌香港
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
  /* [TR-FIX-1002B] _route()=实际请求用的线路(面板值不认识时回退 google2,和 routeBase 同一个来源);缓存键/预览键都用它。
     _ck()=翻译缓存键唯一写法 'v2|线路|目标语言|原文'(内存 _cache 和持久的收信缓存 __zRecvTrans/IndexedDB 共用);
     原来 'v1|语言|原文' / '签名|语言' 不含线路 → 换线路后拿旧线路的缓存,等于没换。旧键自然作废。 */
  function _route(){ try{ return _trRouteOf(_cfg()); }catch(e){} return 'google2'; }
  function routeBase(){ return _trRouteUrl(_route()); }
  function _ck(tl, text){ return 'v2|'+_route()+'|'+(tl||'en')+'|'+text; }
  // 接管海王的"线路名"标签(.real-time-translate-route-name):海王 O 表没有 gemini→回退显示"谷歌香港",我们按真实 route 名覆盖
  function _wantRouteName(){ var nm=_trRouteName(_cfg()); return nm?nm+'实时翻译':''; }

  // ---------- 翻译:直接 fetch(https,完整句无逗号截断),带缓存 ----------
  var _cache={}, _pending={};
  // 解析译文:google 格式 )]}'[[["<全部译文>","<原文>"... 完整译文在第一个 JSON 字符串里(含字面换行,不能 JSON.parse)→ 正则抓(处理转义);兜底 tw-answ-target-text 段
  function _parseTr(d){ if(!d) return '';
    try{ var m2=d.match(/\[\[\["((?:\\.|[^"\\])*)"/); if(m2){ var t=m2[1].replace(/\\u([0-9a-fA-F]{4})/g,function(_,h){return String.fromCharCode(parseInt(h,16));}).replace(/\\n/g,'\n').replace(/\\t/g,'\t').replace(/\\"/g,'"').replace(/\\\\/g,'\\'); if(t) return t; } }catch(e){}
    try{ var segs=[], re=/tw-answ-target-text">([\s\S]*?)<\/span>/g, mm; while((mm=re.exec(d))!==null){ segs.push(mm[1]); } if(segs.length) return segs.join(''); }catch(e){}
    var m=d.match(/tw-answ-target-text">([^<]*)</); return m?m[1]:'';
  }
  function translate(text, tl, force){
    return new Promise(function(resolve){
      text=_norm(text); if(!text){resolve('');return;}
      var key=_ck(tl,text);   // [TR-FIX-1002B] 键含线路
      /* [TR-ALIGN-1002] force=↻重新翻译:不读缓存、不搭别人的在途请求,一定联网;拿到新结果覆盖缓存(原来先删缓存再取,删和读之间被轮询搭上旧请求)。
         force 请求自己单独一个等待队列,结束时只清自己那份,不误伤同键的普通请求。 */
      if(!force && _cache[key]!=null){resolve(_cache[key]);return;}
      var pk=force?('!'+key):key;
      if(_pending[pk]){_pending[pk].push(resolve);return;}
      _pending[pk]=[resolve];
      var done=function(r){ if(r)_cache[key]=r; var qs=_pending[pk]||[]; delete _pending[pk]; qs.forEach(function(f){try{f(r);}catch(e){}}); };
      var async='sl:auto,tl:'+(tl||'en')+',st:'+encodeURIComponent(text.slice(0,400))+',id:'+(Date.now?Date.now():1);
      var url=routeBase()+'/async/translate?async='+encodeURIComponent(async);
      var to=setTimeout(function(){done('');},7000);
      // 用 XHR 而非 fetch:海王在页面劫持了 window.fetch(对发送方向翻译返回空 mock),XHR 通常没被劫持
      try{
        var xhr=new XMLHttpRequest();
        xhr.open('GET', url, true);
        xhr.onreadystatechange=function(){
          if(xhr.readyState!==4) return;
          clearTimeout(to);
          var d=xhr.responseText||'';
          var _r=_parseTr(d);
          rpt('xhr status='+xhr.status+' len='+d.length+' m='+(_r?_r.slice(0,20):'NULL'));
          done(_r?_r.replace(/^\s+|\s+$/g,''):'');
        };
        xhr.onerror=function(){ clearTimeout(to); rpt('xhrERR'); done(''); };
        xhr.send();
      }catch(e){ clearTimeout(to); rpt('xhrThrow '+e.message); done(''); }
    });
  }
  function _trLine(t,tl,tries,force){ return translate(t,tl,force).then(function(r){ if((!r||!r.replace(/\s/g,''))&&(tries||0)<3) return _trLine(t,tl,(tries||0)+1,force); return r; }); }
  // 端点保留换行 → 能一次装下(≤400字)就整段一次翻;超长才按行分块(每块≤400)。大幅减少请求数=提速。
  function translateML(text,tl,force){
    text=_norm(text); if(!text) return Promise.resolve('');
    if(text.length<=400) return _trLine(text,tl,0,force);
    var lines=text.split('\n'), chunks=[], cur='';
    for(var i=0;i<lines.length;i++){ var ln=lines[i]; var next=cur?(cur+'\n'+ln):ln;
      if(next.length>400 && cur!==''){ chunks.push(cur); cur=ln; } else { cur=next; } }
    if(cur!=='') chunks.push(cur);
    return Promise.all(chunks.map(function(c){ return _trLine(c,tl,0,force); })).then(function(rs){return rs.join('\n');});
  }

  // ---------- DOM ----------
  function getComposer(){ try{ var e=document.querySelector('#richInput'); if(e&&e.offsetParent!==null) return e;
    var list=document.querySelectorAll('[contenteditable="true"]'); for(var i=0;i<list.length;i++){ if(list[i].offsetParent!==null) return list[i]; } }catch(e){} return null; }
  function _ctext(el){ try{ if(!el) return '';
      var blocks=el.querySelectorAll(':scope > *');   // 逐块读:每块=一行,单换行拼(innerText 会给段落塞多余换行)
      if(blocks && blocks.length){
        var lines=[];
        for(var i=0;i<blocks.length;i++){ var c=blocks[i].cloneNode(true); try{ c.querySelectorAll('br').forEach(function(br){ if(br.parentNode) br.parentNode.replaceChild(document.createTextNode('\n'), br); }); }catch(e){} lines.push((c.textContent||'').replace(/[\r\n]+$/,'')); }   // 去每块尾部占位换行(空 div 的<br>→避免空行翻倍)
        var jt=lines.join('\n'); if(jt.replace(/\s/g,'')) return _norm(jt);
      }
      var t=(el.innerText!=null&&el.innerText!=='')?el.innerText:(el.textContent||''); return _norm(t);
    }catch(e){ return _norm(el&&el.textContent); } }
  // 发送按钮:扫输入框附近可见的、像"发送"的按钮(Zalo 是纸飞机图标,常在输入区右下)
  function getSendBtn(){
    try{
      var cand=document.querySelectorAll('[title],[aria-label],[data-id]');
      for(var i=0;i<cand.length;i++){ var el=cand[i]; var tt=(el.getAttribute('title')||el.getAttribute('aria-label')||el.getAttribute('data-id')||'').trim();
        if(/^(g[uùử]i|send|gửi tin)/i.test(tt) && !/sticker|file|image|hình|ảnh/i.test(tt) && el.offsetParent!==null) return el; }
    }catch(e){}
    return null;
  }

  // ---------- contenteditable 写入 ----------
  function _selAll(el){ try{ el.focus(); var sel=window.getSelection(); var r=document.createRange(); r.selectNodeContents(el); sel.removeAllRanges(); sel.addRange(r); }catch(e){} }
  function _clear(el){ try{ _selAll(el); document.execCommand('delete'); }catch(e){} }
  // [TR-FIX-1002B] 删除未被调用的 _writeOk(另一套"没有中文=写成功"的判断);写入后核对只认 commitAndSend 里的「签名==译文」
  // 写入:照搬海王 Wt —— set innerHTML 成 Zalo 期望的行结构 + dispatch input(execCommand/粘贴都不稳,这才是正解)
  function _esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
  function setInputText(el, text){
    try{
      var lines=String(text==null?'':text).split('\n'); var last=lines.pop();
      var html='', n=0;
      lines.forEach(function(line){ var idx=n++; html+="<div id='input_line_"+idx+"'><span class='' data-mention='"+_esc(line)+"' id='input_part_"+idx+"' style='white-space: pre-wrap;'>"+_esc(line)+"</span></div>"; });
      html+="<div id='input_line_"+n+"'>"+_esc(last)+"</div>";
      el.innerHTML=html;
      var ev=document.createEvent('HTMLEvents'); ev.initEvent('input',true,true); el.dispatchEvent(ev);
      return true;
    }catch(e){ return false; }
  }
  // 发送:照搬海王 —— 点 .send-btn-chatbar(兜底 div[icon="Sent-msg_24_Line"])。这是 Zalo 真正的发送键,不会误弹文件框。
  var _myClick=false;
  function clickSend(){
    try{ var b=document.querySelector('.send-btn-chatbar')||document.querySelector('div[icon="Sent-msg_24_Line"]');
      if(b){ _myClick=true; try{ b.click(); }catch(e){} setTimeout(function(){_myClick=false;},500); return true; } }catch(e){}
    return false;
  }
  function refocus(){ try{ var c=getComposer(); if(c) c.focus(); }catch(e){} }

  // ---------- 样式:隐藏海王的翻译UI(译文框+预览),界面只显示我方独立元素 ----------
  function _injStyle(){
    try{ if(document.getElementById('__scrmZStyle')||!(document.head||document.body)) return;
      var st=document.createElement('style'); st.id='__scrmZStyle';
      st.textContent='.message-translate-content-wrapper{display:none !important;} .real-time-tranlate-text{display:none !important;} .real-time-translate-route-name{display:none !important;} .real-time-tranlate-content{display:none !important;} ' /* [ZALO-PV] 2026-10-03 预览卡片(用户:"太丑"):照 Discord/LinkedIn/LINE 的样式 —— 左 2px 绿线、上行线路标签、下行译文 14px 正文色,极淡绿底圆角卡片;去掉铅笔图标 */
        +_pvCoreCss('scrm-pv-host',{mode:'flat',lblSel:'.scrm-pv-label',bodySel:'.scrm-pv-host .scrm-pv'})
        +'.scrm-tw{display:block;margin-top:4px;white-space:pre-line;word-break:break-word;} '
        +'.scrm-tw-line{border-top:1px dashed #cfd3d8;margin:4px 0 5px;} '
        +'.scrm-tw-body{display:flex;align-items:flex-start;gap:6px;} '
        +'.scrm-tw-text{flex:1 1 auto;color:#12b76a;font-size:13px;line-height:1.45;word-break:break-word;white-space:pre-line;} '
        +'.scrm-tw-refresh{flex:0 0 auto;cursor:pointer;color:#aab0ba;margin-top:1px;display:inline-flex;align-items:center;user-select:none;transition:color .15s;} '
        +'.scrm-tw-refresh:hover{color:#12b76a;} .scrm-tw-refresh.spin svg{animation:scrm-spin .8s linear infinite;} '
        +'@keyframes scrm-spin{to{transform:rotate(360deg)}} '
        +'.scrm-imgtr-host{position:relative;} '
        +'.scrm-imgtr-btn{position:absolute;top:6px;right:6px;z-index:30;background:rgba(0,0,0,.62);color:#fff;font-size:11px;line-height:1;padding:4px 8px;border-radius:6px;cursor:pointer;display:none;align-items:center;gap:3px;user-select:none;} '
        +'.scrm-imgtr-host:hover .scrm-imgtr-btn{display:inline-flex;} .scrm-imgtr-btn.on{display:inline-flex;} .scrm-imgtr-btn.done{display:inline-flex;background:rgba(18,183,106,.92);} .scrm-imgtr-btn .sp{display:inline-block;width:9px;height:9px;border:1.5px solid #fff;border-top-color:transparent;border-radius:50%;animation:scrm-spin .7s linear infinite;} '
        +'.scrm-imgtr-mask{position:fixed;inset:0;z-index:2147483600;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;} '
        +'.scrm-imgtr-modal{max-width:560px;width:86vw;max-height:78vh;overflow:auto;background:#f4fbf6;color:#0d1117;font-size:14px;line-height:1.65;padding:18px 22px 20px;border-radius:12px;box-shadow:0 12px 44px rgba(0,0,0,.3);white-space:pre-wrap;word-break:break-word;position:relative;} '
        +'.scrm-imgtr-modal .hd{font-size:12px;color:#12b76a;font-weight:600;margin-bottom:8px;padding-bottom:8px;border-bottom:1px dashed #cfd3d8;} '
        +'.scrm-imgtr-close{position:absolute;top:9px;right:12px;cursor:pointer;color:#9aa1ab;font-size:19px;line-height:1;} .scrm-imgtr-close:hover{color:#333;} '
        +'.scrm-imgtr-inline{margin:3px 0 6px;max-width:74%;background:#e9f7ee;color:#0d1117;font-size:12.5px;line-height:1.5;padding:7px 10px;border-radius:8px;white-space:pre-wrap;word-break:break-word;} '
        +'.scrm-imgtr-inline.r{margin-left:auto;} .scrm-imgtr-inline .tx{max-height:96px;overflow:hidden;} '
        +'.scrm-imgtr-inline .more{display:inline-block;margin-top:3px;color:#12b76a;cursor:pointer;font-size:12px;} .scrm-imgtr-inline .more:hover{text-decoration:underline;} '
        +'.scrm-imgtr-lightwrap{position:relative;display:flex;flex-direction:column;align-items:center;gap:12px;} '
        +'.scrm-imgtr-lightimg{max-width:92vw;max-height:84vh;border-radius:8px;box-shadow:0 12px 48px rgba(0,0,0,.5);background:#fff;object-fit:contain;} '
        +'.scrm-imgtr-lighttoggle{background:rgba(255,255,255,.94);color:#0d1117;font-size:13px;font-weight:500;padding:7px 18px;border-radius:18px;cursor:pointer;user-select:none;box-shadow:0 2px 10px rgba(0,0,0,.25);} .scrm-imgtr-lighttoggle:hover{background:#fff;} '
        +'.scrm-voicetr-btn{display:inline-flex;align-items:center;gap:3px;margin-left:6px;background:#12b76a;color:#fff;font-size:11px;line-height:1;padding:3px 8px;border-radius:10px;cursor:pointer;user-select:none;vertical-align:middle;white-space:nowrap;} .scrm-voicetr-btn.on{opacity:.7;} .scrm-voicetr-btn .sp{display:inline-block;width:8px;height:8px;border:1.5px solid #fff;border-top-color:transparent;border-radius:50%;animation:scrm-spin .7s linear infinite;} '
        +'.scrm-voicetr{margin-top:8px;padding-top:7px;border-top:1px dashed rgba(90,100,114,.35);font-size:12.5px;line-height:1.5;white-space:pre-wrap;word-break:break-word;clear:both;width:100%;flex:1 0 100%;box-sizing:border-box;} .scrm-voicetr .og{color:#5a6472;} .scrm-voicetr .tr{margin-top:3px;color:#0d1117;font-weight:500;} .scrm-voicetr .lbl{color:#12b76a;font-size:10.5px;margin-right:4px;font-weight:600;} .scrm-voicetr-rf{cursor:pointer;color:#aab0ba;margin-left:6px;display:inline-flex;vertical-align:middle;transition:color .15s;} .scrm-voicetr-rf:hover{color:#12b76a;} .scrm-voicetr-rf.spin svg{animation:scrm-spin .8s linear infinite;}';
      (document.head||document.body).appendChild(st);
    }catch(e){}
  }
  setInterval(_injStyle, 500); _injStyle();

  // ---------- 预览(我方独立元素 .scrm-pv;海王的 .real-time-tranlate-text 已 CSS 隐藏,不再打架) ----------
  /* [TR-ALIGN-1002] 预览按「目标语言|线路|原文」判断要不要重翻(照 TG [TG-PV-KEY]):原来只在文字变化时才进 onInput → 输入不动、只换语言/线路,预览一直停在旧语言。
     _lastPvKey=最近一次处理的键;_pvDoneKey/_lastOut=预览里已翻好的那条(回车/按钮复用前必须键完全一致,语言或线路变了就当没有);
     _pvShownTo=预览当前对应的「语言|线路」('=' 表示原样发送提示)[TR-FIX-1002B],语言或线路变了先回占位「…」;译文回来时键已变就丢掉。 */
  var _prevTimer=null,_lastPvKey='',_pvDoneKey='',_lastOut='',_pvShownTo='',_wantShow='',_wantTr=false,_composing=false,_pvFailKey='',_pvFailAt=0;   // [TR-FIX-1002B] _pvFailKey/_pvFailAt=上次翻译失败的键和时间(同一句连续失败隔 2 秒再请求)
  function _pvKey(src){ return sendTo()+'|'+_route()+'|'+src; }   // [TR-FIX-1002B] 线路取实际请求用的那个
  function _pvCached(src){ return (_lastOut && _pvDoneKey===_pvKey(src)) ? _lastOut : ''; }
  function _sameSig(a,b){ return _sig(a)===_sig(b); }   // 译文与原文签名相同 = 已是目标语言(签名=全部语言字母数字,见 _sig)
  /* [ZALO-PV] 卡片位置:工具栏(.chat-box-bar)和输入行(.chat-box-input)之间,挂在 .chat-box-input-container 下 —— 原来塞在输入行里面(.chat-input-content),把输入框挤成一行(用户截图)。
     真机结构:.chat-box-input-container > [.chat-box-bar 工具栏, .chat-box-input > .chat-input-container > … > #richInput]。找不到这层(页面改版/测试页)就退回原来的位置。 */
  function _pvHostZ(){
    try{ var tb=getComposer(); if(!tb){ return null; }
      var box=null, before=null;
      var cont=tb.closest&&tb.closest('.chat-box-input-container'); var row=cont&&cont.querySelector(':scope > .chat-box-input');
      if(cont&&row){ box=cont; before=row; }
      else {
        box=tb.closest&&tb.closest('[class*="chatInput"],[class*="chat-input"],[class*="composer"],[class*="input-c"]');
        if(!box){ box=tb.parentNode&&tb.parentNode.parentNode; }
        if(!box) { return null; }
        before=box.firstChild;
      }
      var h=box.querySelector(':scope > .scrm-pv-host');
      if(!h){ var stray=document.querySelectorAll('.scrm-pv-host'); for(var i=0;i<stray.length;i++){ try{ stray[i].remove(); }catch(_){} }   // 旧位置残留的卡片清掉
        h=document.createElement('div'); h.className='scrm-pv-host'; h.innerHTML='<div class="scrm-pv-label"></div><div class="scrm-pv"></div>'; box.insertBefore(h, before); }
      return h;
    }catch(e){ return null; }
  }
  function _ourPv(){ var h=_pvHostZ(); return h?h.querySelector('.scrm-pv'):null; }
  var _backTr=_backTrCore({ backCls:'scrm-pv-host-back', on:function(){ return !!_cfg().backTranslate; }, sendLang:sendTo, backLang:recvTo, translate:function(t,bl){ return translateML(t,bl); } });   /* [BACK-TR] 回译校对:下面写预览正文的地方调 _backTr.update(正文元素, 译文),行为全在上面的 [BACK-TR-CORE] */
  function setPreview(txt, isTr){ _wantShow=txt||''; _wantTr=!!isTr&&_wantShow!==''; _pvSyncZ(); }   /* isTr:这次写的是真译文(回译只认它;关掉发送翻译时写进来的原文不是) */
  function _pvSyncZ(){ try{ var h=_pvHostZ(); if(!h) return;
      var lb=h.querySelector('.scrm-pv-label'); var wl=_wantRouteName()||'\u5b9e\u65f6\u7ffb\u8bd1'; if(lb&&lb.textContent!==wl) lb.textContent=wl;   // 面板还没下发线路名时显示「实时翻译」
      var pe=h.querySelector('.scrm-pv'); if(pe&&(pe.textContent||'')!==_wantShow) pe.textContent=_wantShow; _backTr.update(pe||null, _wantTr?_wantShow:'');
    }catch(e){} }
  setInterval(_pvSyncZ, 300);

  function onInput(){
    try{
      if(_composing){ setPreview('翻译中...'); return; }   // 输入法组字中(拼音未上屏):显示"翻译中...",别把拼音当原文
      var el=getComposer(); if(!el) return;
      var T=_ctext(el);
      if(!T){ _lastPvKey=''; _pvDoneKey=''; _lastOut=''; _pvShownTo=''; _pvFailKey=''; setPreview('\u2026'); return; }   // [PV-IDLE-DOTS] 空输入常驻占位…(全平台一致)
      /* [TR-FIX-1002B] 发送翻译关的判断放到「键没变就不动」之前,并清掉去重键:原来它在提前返回之后,
         关→开时原文/语言/线路都没变 → 直接 return,预览一直停在「原文」,要改一个字才恢复。 */
      if(!sendEnabled()){ if(_prevTimer) clearTimeout(_prevTimer); _lastPvKey=''; _pvShownTo='='; setPreview(T); return; }   // 发送翻译关:回车原样发,预览如实显示原文
      var _tg=sendTo(), _lr=_tg+'|'+_route(), key=_pvKey(T);
      if(key===_lastPvKey) return;                              // [TR-ALIGN-1002] 原文/语言/线路都没变 → 不动
      if(key===_pvFailKey && Date.now()-_pvFailAt<2000) return; // [TR-FIX-1002B] 同一句刚失败过:隔 2 秒再重试(不记 _lastPvKey,到点轮询自然重来)
      _lastPvKey=key;
      if(_prevTimer) clearTimeout(_prevTimer);
      if(_sendAsIs(T)){ _pvShownTo='='; setPreview(T+_ASIS_NOTE); return; }   // [TR-ALIGN-1002] 已是目标语言:原样发送(不联网)
      /* [TR-FIX-1002B] 只有「目标语言或线路」变了(或刚从原样发送提示切过来)才回占位「…」,旧语言/线路的译文不挂着;
         只是原文变了 → 保留上一次的译文直到新结果到达(不每打一个字闪一次)。_pvShownTo 记「语言|线路」。 */
      if(_pvShownTo!==_lr){ _pvShownTo=_lr; setPreview('\u2026'); }
      _prevTimer=setTimeout(function(){
        if(_lastPvKey!==key) return;
        translateML(T, _tg).then(function(tr){
          if(_lastPvKey!==key || _pvKey(_ctext(getComposer()))!==key) return;   // 键变了(改了字/换了语言或线路)→ 丢掉旧结果
          if(tr&&tr.replace(/\s/g,'')&&_safeToSend(tr)){ _pvFailKey=''; _pvDoneKey=key; _lastOut=tr; setPreview(_sameSig(tr,T) ? T+_ASIS_NOTE : tr, !_sameSig(tr,T)); }
          /* [TR-FIX-1002B] 翻译失败(空结果,或过不了 _safeToSend —— 回车也不会发,预览与发送一致):预览明确显示「翻译失败」(不挂着上一句的译文),清掉去重键 → 轮询自动重试(同一句隔 2 秒),重试期间保持「翻译失败」 */
          else { _pvFailKey=key; _pvFailAt=Date.now(); _lastPvKey=''; setPreview('翻译失败'); }
        });
      }, 400);   // 防抖:停止打字400ms才翻译预览,省掉逐字的中间调用(省钱)
    }catch(e){}
  }

  // ---------- 发出气泡"显示原文"(盖掉海王截断的再翻译) ----------
  // [TR-FIX-1002B] _sig 已移到文件开头与 _sendAsIs/_safeToSend 放在一起(只定义一次)
  var _cjk=/[一-鿿]/;
  var _kana=/[぀-ヿ]/;   // 平假名+片假名:有 kana=日语(汉字不能当中文),要翻成中文
  var _hasLetter=/[A-Za-zÀ-ɏЀ-ӿ぀-ヿ가-힯]/;
  // ===== 翻译缓存:内存对象(同步读,绘制前秒填靠它)+ indexedDB 持久层(大容量、异步不卡) =====
  window.__zSentOrig=window.__zSentOrig||{};
  window.__zRecvTrans=window.__zRecvTrans||{};
  var _zdb=null;
  var _zOpened, _zOpen=new Promise(function(r){ _zOpened=r; });   // 开库有了结果(成功或失败)才兑现:清缓存先等它
  function _zIdbPut(pfx,k,v){ try{ if(!_zdb||!k)return; _zdb.transaction('kv','readwrite').objectStore('kv').put(v, pfx+':'+k); }catch(e){} }
  function putSent(k,v){ if(!k)return; window.__zSentOrig[k]=v; _zIdbPut('s',k,v); }
  function putRecv(k,v){ if(!k)return; window.__zRecvTrans[k]=v; _zIdbPut('r',k,v); }
  function saveZOrig(){}   // 兼容旧调用:实际写盘改由 putSent 即时入 idb
  function saveZRecv(){}
  (function(){
    // 一次性迁移老的 localStorage 缓存到内存(别丢)
    try{ var a=localStorage.getItem('scrm_zalo_sent_orig'); if(a){ var o=JSON.parse(a); for(var k in o) window.__zSentOrig[k]=o[k]; } }catch(e){}
    try{ var b=localStorage.getItem('scrm_zalo_recv'); if(b){ var o2=JSON.parse(b); for(var k2 in o2) window.__zRecvTrans[k2]=o2[k2]; } }catch(e){}
    try{
      var req=indexedDB.open('scrm_translate',1);
      req.onupgradeneeded=function(e){ var db=e.target.result; if(!db.objectStoreNames.contains('kv')) db.createObjectStore('kv'); };
      req.onsuccess=function(e){ _zdb=e.target.result; _zdb.onversionchange=function(){ try{ _zdb.close(); }catch(_v){} _zdb=null; }; _zOpened();
        try{ var cur=_zdb.transaction('kv','readonly').objectStore('kv').openCursor();
          cur.onsuccess=function(ev){ var c=ev.target.result; if(!c) return; var kk=c.key;
            if(typeof kk==='string'){ if(kk.charAt(0)==='s'&&kk.charAt(1)===':') window.__zSentOrig[kk.slice(2)]=c.value; else if(kk.charAt(0)==='r'&&kk.charAt(1)===':') window.__zRecvTrans[kk.slice(2)]=c.value; }
            c.continue(); };
        }catch(e){}
        try{ for(var k in window.__zSentOrig) _zIdbPut('s',k,window.__zSentOrig[k]); for(var k2 in window.__zRecvTrans) _zIdbPut('r',k2,window.__zRecvTrans[k2]); }catch(e){}
      };
      req.onerror=function(){ _zOpened();   // idb 不可用 → 退回 localStorage 全量写
        putSent=function(k,v){ if(!k)return; window.__zSentOrig[k]=v; try{localStorage.setItem('scrm_zalo_sent_orig',JSON.stringify(window.__zSentOrig));}catch(e){} };
        putRecv=function(k,v){ if(!k)return; window.__zRecvTrans[k]=v; try{localStorage.setItem('scrm_zalo_recv',JSON.stringify(window.__zRecvTrans));}catch(e){} };
      };
    }catch(e){ _zOpened(); }
  })();
  /* [BATCH1-04] 面板「清空译文缓存」:window.__scrmTrCacheClear() → Promise<{cleared:n}>,永不 reject。
     清三处:句级内存 _cache;收信整条译文 window.__zRecvTrans(内存,同步秒贴靠它);持久层 —— IndexedDB scrm_translate 表 kv 里 r: 前缀的收信译文(等开库有结果后,同一事务游标逐条删并计数),
     IndexedDB 不可用时持久层是 localStorage scrm_zalo_recv(见上面 req.onerror 的退路),删它并数它的条数。s: 前缀的发出原文不是译文,不动。
     n(全平台同一口径)= 持久层里被清掉的译文条数;内存是它的副本,不另计。已显示的译文框/标记一个不删 → 不触发重译。 */
  function _zIdbClearRecv(){ return new Promise(function(resolve){ var fired=false, n=0, to=setTimeout(function(){ fin(); },3000);
    function fin(){ if(!fired){ fired=true; clearTimeout(to); resolve(n); } }
    _zOpen.then(function(){
      if(!_zdb){ try{ var o=JSON.parse(localStorage.getItem('scrm_zalo_recv')||'{}'); if(o&&typeof o==='object') n=Object.keys(o).length; }catch(e){} fin(); return; }
      try{ var tx=_zdb.transaction('kv','readwrite'); var cur=tx.objectStore('kv').openCursor();
        cur.onsuccess=function(ev){ var c=ev.target.result; if(!c) return; var kk=c.key; if(typeof kk==='string'&&kk.charAt(0)==='r'&&kk.charAt(1)===':'){ try{ c.delete(); n++; }catch(_d){} } c.continue(); };
        tx.oncomplete=fin; tx.onerror=tx.onabort=fin;
      }catch(e){ fin(); } }); }); }
  window.__scrmTrCacheClear=function(){
    function mem(){ try{ _cache={}; window.__zRecvTrans={}; }catch(e){} }
    mem();   // 立即生效
    return _zIdbClearRecv().then(function(k){ mem();   // 库刚开时,启动暖载入的游标排在删除事务前面,可能又把旧译文读回内存 → 库清完再清一次
      try{ localStorage.removeItem('scrm_zalo_recv'); }catch(e){} return { cleared:Number(k)||0 }; }, function(){ return { cleared:0 }; }); };
  // 译文直接挂在消息文本(message-text-content)后面 —— 不依赖海王那个每秒被 Zalo 重渲染抹掉/海王重插的框。
  // 按消息去重(t.closest('.chat-message') 内找我们的 .scrm-tw),Zalo 一重渲染观察器立刻重插,间隙趋近0、不闪、不累积。
  var _RFSVG='<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>';
  /* [TR-ALIGN-1002] 唯一贴底规则(照 TG [TG-KEEP-BOTTOM]):我们往消息里插东西(译文/图片译文/语音译文)会把内容撑高——
     插入前该消息所在的滚动容器离底 ≤24px → 插完(微任务里)贴底;否则(往上翻着看/打开会话停在未读处)位置不动。同一轮多次插入只量一次。
     打开/切换会话停在哪由 Zalo 自己决定,这里不再干预(原 PIN-V3:切会话 1.5 秒每帧按到底 + 窗口内插译文也按底,已删)。 */
  var _kbList=null;
  function _scrollBox(el){ try{ for(var p=el&&el.parentElement; p && p!==document.body && p!==document.documentElement; p=p.parentElement){ var oy=getComputedStyle(p).overflowY; if(oy==='auto'||oy==='scroll') return p; } }catch(e){} return null; }
  function _keepBottom(el){ try{
    var sc=_scrollBox(el); if(!sc) return;
    if(_kbList){ for(var i=0;i<_kbList.length;i++){ if(_kbList[i].sc===sc) return; } }
    else { _kbList=[]; Promise.resolve().then(function(){ var l=_kbList; _kbList=null; for(var k=0;k<l.length;k++){ try{ if(l[k].atB&&l[k].sc.isConnected) l[k].sc.scrollTop=l[k].sc.scrollHeight; }catch(e){} } }); }
    _kbList.push({ sc:sc, atB:(sc.scrollHeight-sc.scrollTop-sc.clientHeight)<=24 });
  }catch(e){} }
  function _putTw(t, want, src, target){
    try{ if(want==null || !t || !t.parentNode) return;
      var cm=(t.closest && t.closest('.chat-message')) || t.parentNode;
      var mine=cm.querySelector('.scrm-tw');
      if(!mine){
        mine=document.createElement('div'); mine.className='scrm-tw';
        var line=document.createElement('div'); line.className='scrm-tw-line'; mine.appendChild(line);
        var body=document.createElement('div'); body.className='scrm-tw-body';
        var txt=document.createElement('span'); txt.className='scrm-tw-text'; body.appendChild(txt);
        var rf=document.createElement('span'); rf.className='scrm-tw-refresh'; rf.title='重新翻译'; rf.innerHTML=_RFSVG;
        rf.addEventListener('click', function(ev){ ev.stopPropagation(); ev.preventDefault(); _refreshTw(mine); }, true);
        body.appendChild(rf); mine.appendChild(body);
        _keepBottom(t); t.parentNode.insertBefore(mine, t.nextSibling);   // [TR-ALIGN-1002] 插前在底→插后仍在底
      }
      var txtEl=mine.querySelector('.scrm-tw-text');
      if(txtEl && txtEl.textContent!==want){ _keepBottom(t); txtEl.textContent=want; }
      if(src!=null) mine.__src=src; if(target!=null) mine.__tgt=target;
    }catch(e){}
  }
  // 刷新按钮:按目标语言强制联网重翻,新结果覆盖缓存
  function _refreshTw(mine){
    try{
      var src=mine.__src, target=mine.__tgt||recvTo(); if(!src) return;
      var txtEl=mine.querySelector('.scrm-tw-text'), rf=mine.querySelector('.scrm-tw-refresh');
      var ck=_ck(target,_norm(src));   // [TR-FIX-1002B] 收信缓存键同样含线路 | [TR-ALIGN-1002] 不再先删缓存:translateML(...,true) 一定联网,拿到新结果再覆盖两处缓存(删了没拿到新结果时连旧译文也没了)
      if(rf) rf.className='scrm-tw-refresh spin';
      translateML(src, target, true).then(function(tr){
        if(rf) rf.className='scrm-tw-refresh';
        if(tr&&tr.replace(/\s/g,'')){ var v=tr.replace(/^\s+|\s+$/g,''); putRecv(ck,v); if(txtEl){ _keepBottom(txtEl); txtEl.textContent=v; } }
      });
    }catch(e){}
  }
  function processWraps(syncOnly){
    try{
      var msgs=document.querySelectorAll('div[data-component="message-text-content"]');
      for(var i=0;i<msgs.length;i++){
        var t=msgs[i];
        var btext=(t.textContent||''); if(!btext) continue;
        var bt=_sig(btext);
        var src=(bt && window.__zSentOrig[bt]!=null)?window.__zSentOrig[bt]:btext;   // 我方发出用存的原文,否则用消息文本
        if(!src) continue;
        var target=recvTo();
        if(target && target.indexOf('zh')===0 && _cjk.test(src) && !_kana.test(src)){ _putTw(t, src.replace(/^\s+|\s+$/g,''), src, target); continue; }   // 目标中文且源"纯汉字(非日语)"→直接显示;日语(带kana)照翻
        var ck=_ck(target,_norm(src)); var cz=window.__zRecvTrans[ck];   // [TR-FIX-1002B] 键含线路:换线路后可见消息重新翻
        if(cz!=null){ _putTw(t, cz, src, target); continue; }                        // 缓存命中→瞬间填
        if(!syncOnly && !t.getAttribute('data-z-pending')){                         // 未缓存→翻译(缓存key含目标语言,改语言自动重翻)
          try{ t.setAttribute('data-z-pending','1'); }catch(e){}
          (function(tt,text,key,tg){ translateML(text,tg).then(function(tr){ try{ tt.removeAttribute('data-z-pending'); if(tr&&tr.replace(/\s/g,'')){ var v=tr.replace(/^\s+|\s+$/g,''); putRecv(key,v); _putTw(tt,v,text,tg);} }catch(e){} }); })(t,src,ck,target);
        }
      }
    }catch(e){}
  }
  setInterval(function(){ processWraps(false); }, 250);   // 轮询兜底
  // 容器一变(切换会话/滚动重建):microtask 绘制前先跑缓存同步盖章(零重载),rAF 再跑含异步的
  try{
    var _asyncP=false;
    var _asyncSoon=function(){ if(_asyncP)return; _asyncP=true; var run=function(){ _asyncP=false; processWraps(false); }; if(window.requestAnimationFrame) requestAnimationFrame(run); else setTimeout(run,16); };
    // Zalo 一重渲染就同步从缓存重插译文(绘制前完成→不闪),再异步补未缓存的
    (function(){ var _cb=function(){ try{ processWraps(true); }catch(e){} try{ _pvSyncZ(); }catch(e){} _asyncSoon(); }; var _att=function(){ try{ var root=document.documentElement||document.body||document; if(!root||root.nodeType===undefined){ setTimeout(_att,50); return; } new MutationObserver(_cb).observe(root,{childList:true,subtree:true}); }catch(e){ setTimeout(_att,100); } }; _att(); })();
  }catch(e){}

  // ---------- 发送拦截(回车) ----------
  var _sending=false;
  function commitAndSend(el, tr, orig, tries){
    var ok=setInputText(el, tr);
    setTimeout(function(){
      var cur=_ctext(getComposer());
      if(cur===''){ _sending=false; setTimeout(refocus,120); return; }
      /* [TR-FIX-1002B] 写入后核对只认「输入框内容签名 == 译文签名」(且仍须 _safeToSend)。
         原来还认「≠ 原文签名」:等待的 220~900ms 里用户多打一个字(或写入没生效),框里是「原文+x」→ 也算写成功,把中文发了出去。
         框里还是原文(写入没生效)→ 重写最多 2 次;框里是别的(用户改过)→ 不发,提示重按回车。 */
      var written = _sig(cur) === _sig(tr) && _safeToSend(cur);
      if(written){
        try{ putSent(_sig(cur), orig); }catch(e){}
        rpt('send len='+cur.length);
        clickSend();               // 点海王的 .send-btn-chatbar 发送
        setTimeout(function(){
          var c2=_ctext(getComposer());
          if(c2!=='' && _sig(c2)===_sig(tr)){ clickSend(); }  // 译文还卡着没发出→再点一次
          _sending=false; setTimeout(refocus,150);
        },300);
      } else if(_sig(cur)===_sig(orig) && (tries||0)<2){ commitAndSend(el,tr,orig,(tries||0)+1); }
      else if(_sig(cur)===_sig(orig)){ rpt('write FAILED'); setPreview('译文已就绪,请再按一次回车'); _sending=false; }
      else if(_sig(cur)===_sig(tr)){ setPreview('翻译失败,请重试'); _sending=false; }   // 译文本身过不了 _safeToSend
      else { rpt('box changed while sending'); showZhWarn('输入内容已改动,未发送,请再按一次回车'); _sending=false; }
    }, Math.min(900, 220+Math.floor((tr.length||0)/3)));   // 长文给足粘贴+Zalo处理时间,避免过早重试造成二次写
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
  _scrmQuickInstall({ box: getComposer, read: _ctext, write: setInputText, send: function(){ clickSend(); }, attach: function(file){ var t=function(){ var a=document.querySelector('#chatInput .input-preview-area'); var n=parseInt(((a&&a.querySelector('.input-preview-area-header__count'))||{}).textContent||'',10); return a&&a.offsetParent!==null&&n>0?{cap:null}:null; }; return (function(el, file, ready){ if(!el) return Promise.resolve(null); el.focus(); var dt=new DataTransfer(); dt.items.add(file); el.dispatchEvent(new ClipboardEvent('paste',{clipboardData:dt,bubbles:true,cancelable:true})); var t0=Date.now(); return (function w(){ var r=ready(); if(r) return Promise.resolve(r); if(Date.now()-t0>8000) return Promise.resolve(null); return new Promise(function(x){ setTimeout(x,200); }).then(w); })(); })(getComposer(), file, t); }, pending: function(){ var a=document.querySelector('#chatInput .input-preview-area'); return !!(a&&a.offsetParent!==null&&a.children.length); }, tr: function(t){ return translateML(t, sendTo()); }, to: function(){ return sendTo(); } }); // [QUICK-SEND] 本平台绑定
  /* [TR-ALIGN-1002] 回车/发送按钮共用的发送决定(原来两处各写一遍,且用 containsChinese:不含汉字就原样发 → 预览显示译文、发出去却是原文)。
     ① 关翻译/_sendAsIs → 原样发;② 预览已翻好且「语言|线路|原文」完全一致 → 发预览那条;否则现翻(空结果再试一次);
     ③ 译文与原文签名相同(已是目标语言,如目标日语打「学生」)→ 原样发(原来 tr===ct 当"翻译失败"卡死);④ 翻译失败 → 沿用原处理,不发。 */
  function _sendRaw(el, ct){
    rpt('send-asis len='+ct.length);
    setInputText(el, ct);
    setTimeout(function(){ clickSend();
      setTimeout(function(){ var c2=_ctext(getComposer()); if(c2!==''){ clickSend(); } _sending=false; setTimeout(refocus,150); }, 300);
    }, Math.min(700,180+Math.floor(ct.length/3)));
  }
  function _sendTranslated(el, ct){
    var go=function(tr){ if(!tr||!tr.replace(/\s/g,'')){ rpt('no translation, not sending'); setPreview('翻译失败,请重试'); _sending=false; return; }
      /* [TR-FIX-1002B] 中文保护放在「签名相同 → 原样发」捷径之前,且不再依赖「中文检测」开关(线路把中文原样吐回时签名相同,原来直接发出中文) */
      if(!_safeToSend(tr)){ rpt('zh-check block translated'); if(detectOn()) showZhWarn('译文仍含中文,已阻止发送'); setPreview('翻译失败,请重试'); _sending=false; return; }
      if(_sameSig(tr,ct)){ _sendRaw(el, ct); return; }      // 已是目标语言:原样发(预览此时显示「原文+已是目标语言」)
      commitAndSend(el,tr,ct,0); };
    var cached=_pvCached(ct), tg=sendTo();
    if(cached) go(cached); else translateML(ct,tg).then(function(tr){ if(tr&&tr.replace(/\s/g,'')) go(tr); else translateML(ct,tg).then(go); });
  }
  function handleSend(e){
    if(e.keyCode!==13 || e.shiftKey || e.ctrlKey || e.metaKey || e.altKey) return;
    var el=getComposer(); if(!el) return;
    if(!(e.target===el || (el.contains&&el.contains(e.target)))) return;
    var ct=_ctext(el); if(!ct) return;
    e.preventDefault(); e.stopImmediatePropagation();     // 所有回车都我方接管(避免海王原生发送截断多行)
    if(_sending) return; _sending=true;
    setTimeout(function(){_sending=false;},8000);
    if(detectOn() && !_tgtIsZh() && _hasZh(ct) && !sendEnabled()){  // 中文检测:关翻译却含中文 → 拦下
      rpt('zh-check block asis'); showZhWarn('检测到中文,已阻止发送(请先翻译)'); _sending=false; return;
    }
    if(!sendEnabled() || _sendAsIs(ct)){ _sendRaw(el, ct); return; }   // 发送翻译关 / 已是目标语言 → 不翻,原样整段发 [SAME-LANG]
    rpt('intercept Enter len='+ct.length);               // 翻译→写→发
    _sendTranslated(el, ct);
  }
  window.addEventListener('keydown', handleSend, true);

  // 拦截【发送按钮点击】(不只回车):点按钮也翻译后再发,否则走海王原生会逗号截断
  document.addEventListener('click', function(e){
    try{
      if(_myClick) return;                                     // 我方 clickSend 触发的放行
      var t=e.target; var btn=t && t.closest && t.closest('.send-btn-chatbar, div[icon="Sent-msg_24_Line"]');
      if(!btn) return;
      var el=getComposer(); if(!el) return;
      var ct=_ctext(el); if(!ct) return;
      if(detectOn() && !_tgtIsZh() && _hasZh(ct) && !sendEnabled()){ e.preventDefault(); e.stopImmediatePropagation(); showZhWarn('检测到中文,已阻止发送(请先翻译)'); return; }
      if(!sendEnabled() || _sendAsIs(ct)) return;              // 关翻译/已是目标语言:放行原生点击 [SAME-LANG]
      e.preventDefault(); e.stopImmediatePropagation();        // 拦截点击,翻译后发
      if(_sending) return; _sending=true; setTimeout(function(){_sending=false;},8000);
      _sendTranslated(el, ct);
    }catch(err){}
  }, true);

  // 快捷键:Ctrl+F 发送原文(不翻译);Ctrl+T 只翻译不发送(译文写回输入框供审核/编辑)
  window.addEventListener('keydown', function(e){
    try{
      if(!(e.ctrlKey||e.metaKey) || e.shiftKey || e.altKey) return;
      var k=(e.key||'').toLowerCase(); if(k!=='f' && k!=='t') return;
      var el=getComposer(); if(!el) return;
      if(!(e.target===el || (el.contains&&el.contains(e.target)))) return;
      var ct=_ctext(el); if(!ct) return;
      e.preventDefault(); e.stopImmediatePropagation();
      if(k==='f'){                                         // 发送原文
        if(_sending) return; _sending=true; setTimeout(function(){_sending=false;},8000);
        setInputText(el, ct);
        setTimeout(function(){ clickSend(); setTimeout(function(){ _sending=false; setTimeout(refocus,150); },300); }, Math.min(700,180+Math.floor(ct.length/3)));
      } else {                                             // 只翻译不发送
        if(_sendAsIs(ct)) return;   // [TR-ALIGN-1002] 与预览/发送同一判断
        translateML(ct, sendTo()).then(function(tr){ if(tr&&tr.replace(/\s/g,'')&&!_sameSig(tr,ct)){ setInputText(getComposer(), tr); refocus(); } });
      }
    }catch(err){}
  }, true);

  // 发送键侦察:输入框有文字时,报告输入区靠右的可点击元素(定位真正的发送键)
  setInterval(function(){
    try{
      if(window.__zSendRecon) return;
      var el=getComposer(); if(!el || !_ctext(el)) return;   // 要有文字才扫(发送键此时才出现)
      window.__zSendRecon=1;
      var box=el.closest('[class*="chatInput"],[class*="chat-input"],[class*="composer"],[class*="input-c"]')||(el.parentElement&&el.parentElement.parentElement&&el.parentElement.parentElement.parentElement)||document.body;
      var cr=el.getBoundingClientRect();
      var all=box.querySelectorAll('*'); var rep=[];
      for(var i=0;i<all.length && rep.length<10;i++){ var b=all[i];
        if(b.offsetParent===null) continue;
        var cl=(''+(b.className&&b.className.baseVal!=null?b.className.baseVal:b.className||''));
        var isClick=(b.getAttribute&&(b.getAttribute('role')==='button'))||b.tagName==='BUTTON'||/btn|send|submit|icon/i.test(cl);
        if(!isClick) continue;
        var r=b.getBoundingClientRect();
        if(r.right < cr.right - 20) continue;   // 只要靠右的(发送键在右下)
        rep.push(b.tagName+'|'+cl.slice(0,22)+'|r'+Math.round(r.right)+'w'+Math.round(r.width));
      }
      rpt('SENDBTN box['+(''+(box.className||'-')).slice(0,18)+'] compR'+Math.round(cr.right)+' :: '+rep.join(' # '));
    }catch(e){ rpt('SENDBTNerr '+e.message); }
  }, 500);

  document.addEventListener('input', onInput, true);
  document.addEventListener('paste', function(){ setTimeout(onInput,30); }, true);
  document.addEventListener('compositionstart', function(){ _composing=true; setPreview('翻译中...'); }, true);
  document.addEventListener('compositionend', function(){ _composing=false; _lastPvKey=''; setTimeout(onInput,10); }, true);   // 上屏后清缓存重译
  setInterval(onInput, 300);   // [TR-ALIGN-1002] 轮询每次都进 onInput:原文/目标语言/线路任一变了它自己判断重翻(原来只在文字变化时才进,换语言不重翻);空输入的占位…也由它放

  // ========== 图片翻译(Gemini,照海王:图片右上角"译"按钮 → 译文覆盖层,可切回原图) ==========
  function _imgB64(img){ return new Promise(function(res){ try{
      var src=img.currentSrc||img.src||''; if(!src){res('');return;}
      if(src.indexOf('data:')===0){ res(src); return; }
      fetch(src).then(function(r){ return r.blob(); }).then(function(b){
        var fr=new FileReader(); fr.onload=function(){ res(fr.result); }; fr.onerror=function(){ res(''); }; fr.readAsDataURL(b);
      }).catch(function(){
        try{ var c=document.createElement('canvas'); c.width=img.naturalWidth||img.width; c.height=img.naturalHeight||img.height; c.getContext('2d').drawImage(img,0,0); res(c.toDataURL('image/png')); }catch(e){ res(''); }
      });
    }catch(e){ res(''); } }); }
  function _imgHost(img){ return img.closest('.chat-message') && (img.parentElement) || img.parentElement; }
  function _showImgModal(text){
    try{
      var mask=document.createElement('div'); mask.className='scrm-imgtr-mask';
      var modal=document.createElement('div'); modal.className='scrm-imgtr-modal';
      var hd=document.createElement('div'); hd.className='hd'; hd.textContent='图片译文'; modal.appendChild(hd);
      var body=document.createElement('div'); body.textContent=text; modal.appendChild(body);
      var x=document.createElement('div'); x.className='scrm-imgtr-close'; x.textContent='✕'; modal.appendChild(x);
      mask.appendChild(modal); document.body.appendChild(mask);
      function close(){ try{mask.remove();}catch(e){} document.removeEventListener('keydown',onKey,true); }
      function onKey(e){ if(e.key==='Escape') close(); }
      mask.addEventListener('click',function(e){ if(e.target===mask) close(); },true);
      x.addEventListener('click',function(e){ e.stopPropagation(); close(); },true);
      document.addEventListener('keydown',onKey,true);
    }catch(e){}
  }
  // 点译好的图 → 弹窗放大(照海王);支持在弹窗里切原图/译图
  function _showImgLightbox(renderSrc, img){
    try{
      var mask=document.createElement('div'); mask.className='scrm-imgtr-mask';
      var wrap=document.createElement('div'); wrap.className='scrm-imgtr-lightwrap';
      var im=document.createElement('img'); im.className='scrm-imgtr-lightimg'; im.src=renderSrc; wrap.appendChild(im);
      var origSrc=img && img.__scrmOrigSrc;
      if(origSrc){
        var tg=document.createElement('div'); tg.className='scrm-imgtr-lighttoggle'; tg.textContent='查看原图'; var showing='render';
        tg.addEventListener('click',function(e){ e.stopPropagation();
          if(showing==='render'){ im.src=origSrc; tg.textContent='查看译图'; showing='orig'; }
          else { im.src=renderSrc; tg.textContent='查看原图'; showing='render'; }
        },true);
        wrap.appendChild(tg);
      }
      var x=document.createElement('div'); x.className='scrm-imgtr-close'; x.textContent='✕'; wrap.appendChild(x);
      mask.appendChild(wrap); document.body.appendChild(mask);
      function close(){ try{mask.remove();}catch(e){} document.removeEventListener('keydown',onKey,true); }
      function onKey(e){ if(e.key==='Escape') close(); }
      mask.addEventListener('click',function(e){ if(e.target===mask||e.target===wrap) close(); },true);
      x.addEventListener('click',function(e){ e.stopPropagation(); close(); },true);
      document.addEventListener('keydown',onKey,true);
    }catch(e){}
  }
  // 翻译一张图(调有道,译文渲染回原图),结果 dataURL 缓存在 img.__scrmRenderSrc;返回 Promise<renderDataURL 或 ''>
  var __imgRenderCache={};   // 图片URL+目标语 -> 译图dataURL(跨元素/滚动去重,省有道调用)
  function _imgKey(img){ var s=img.__scrmOrigSrc||img.currentSrc||img.src||''; return (s.indexOf('http')===0)? (recvTo()+'|'+s) : ''; }
  function _imgTranslateRender(img){
    if(img.__scrmRenderSrc) return Promise.resolve(img.__scrmRenderSrc);
    if(img.__scrmRenderPending) return img.__scrmRenderPending;
    var key=_imgKey(img);
    if(key && __imgRenderCache[key]){ img.__scrmRenderSrc=__imgRenderCache[key]; return Promise.resolve(img.__scrmRenderSrc); }
    img.__scrmRenderPending=_imgB64(img).then(function(b64){
      if(!b64){ img.__scrmRenderPending=null; return ''; }
      return new Promise(function(res){
        var xhr=new XMLHttpRequest(); xhr.open('POST','https://chm123.com/api/image-translate-render',true); xhr.setRequestHeader('Content-Type','application/json'); xhr.timeout=60000;
        xhr.onreadystatechange=function(){ if(xhr.readyState!==4) return; img.__scrmRenderPending=null;
          var url=''; try{ var j=JSON.parse(xhr.responseText); if(j.code===0 && j.renderImage) url=j.renderImage; }catch(e){}
          if(url){ img.__scrmRenderSrc=url; if(key) __imgRenderCache[key]=url; } res(url);
        };
        xhr.ontimeout=function(){ img.__scrmRenderPending=null; res(''); };
        xhr.send(JSON.stringify({ image:b64, to:recvTo() }));
      });
    });
    return img.__scrmRenderPending;
  }
  // 切到译图 / 切回原图(保存原 src+srcset,换 src;别被 Zalo 的 srcset 覆盖)
  function _showRender(img,btn){
    if(!img.__scrmOrigSrc){ img.__scrmOrigSrc=img.currentSrc||img.src||''; img.__scrmOrigSrcset=img.getAttribute('srcset')||''; }
    if(img.__scrmRenderSrc){ try{ img.removeAttribute('srcset'); }catch(e){} if(img.src!==img.__scrmRenderSrc) img.src=img.__scrmRenderSrc; }
    img.__scrmShowRender=true; try{ img.style.cursor='zoom-in'; }catch(e){} if(btn){ btn.textContent='原图'; btn.classList.add('done'); }
  }
  function _showOrig(img,btn){
    img.__scrmShowRender=false; try{ img.style.cursor=''; }catch(e){}
    try{ if(img.__scrmOrigSrcset) img.setAttribute('srcset',img.__scrmOrigSrcset); }catch(e){}
    if(img.__scrmOrigSrc && img.src!==img.__scrmOrigSrc) img.src=img.__scrmOrigSrc;
    if(btn){ btn.textContent='译'; btn.classList.remove('done'); }
  }
  // 图片下方常驻显示译文(挂在 .chat-message 之后,避开气泡裁切;截断+查看全部开弹窗)
  function _ensureInline(img){
    try{
      var text=img.__scrmTransText; if(!text) return;
      var msg=(img.closest && img.closest('.chat-message')) || img.parentElement; if(!msg || !msg.parentNode) return;
      var box=img.__scrmInline;
      if(!box || !box.parentNode){
        box=document.createElement('div'); box.className='scrm-imgtr-inline';
        try{ var r=msg.getBoundingClientRect(), pr=msg.parentNode.getBoundingClientRect(); if(r.left-pr.left > pr.width-r.right+pr.right) box.classList.add('r'); }catch(e){}
        var tx=document.createElement('div'); tx.className='tx'; box.appendChild(tx);
        var more=document.createElement('span'); more.className='more'; more.textContent='查看全部'; box.appendChild(more);
        (function(im){ more.addEventListener('click',function(e){ e.stopPropagation(); e.preventDefault(); _showImgModal(im.__scrmTransText||''); }); })(img);
        box.addEventListener('click',function(e){ e.stopPropagation(); });   // 冒泡阶段:子元素"查看全部"先触发,再阻止冒泡到Zalo
        _keepBottom(msg); msg.parentNode.insertBefore(box, msg.nextSibling);   // [TR-ALIGN-1002]
        img.__scrmInline=box;
      }
      var txEl=box.querySelector('.tx'); if(txEl && txEl.textContent!==text){ _keepBottom(box); txEl.textContent=text; }
    }catch(e){}
  }
  function _onImgBtn(img, btn){
    try{
      if(img.__scrmShowRender){ _showOrig(img,btn); return; }          // 正显示译图→切回原图
      if(img.__scrmRenderSrc){ _showRender(img,btn); return; }          // 已翻译过→直接显示译图
      btn.innerHTML='<span class="sp"></span>'; btn.classList.add('on');
      _imgTranslateRender(img).then(function(url){ btn.classList.remove('on');
        if(url){ _showRender(img,btn); } else { btn.textContent='译'; _showImgModal('未识别到文字或翻译失败,请重试'); }
      });
    }catch(e){}
  }
  function _hostBtn(img){ return img.__scrmHost && img.__scrmHost.querySelector('.scrm-imgtr-btn'); }
  // 元素是否在可视区(带200px余量):自动翻译只处理可见的,不翻滚动到的历史(省钱)
  function _inView(el){ try{ var r=el.getBoundingClientRect(); var vh=window.innerHeight||document.documentElement.clientHeight; return r.bottom>-200 && r.top < vh+200 && (r.width>0||r.height>0); }catch(e){ return true; } }
  function _scanImgs(){
    try{
      var autoOn=(_cfg().imageTranslateOpen===true);
      var imgs=document.querySelectorAll('.chat-message img');
      for(var i=0;i<imgs.length;i++){ var img=imgs[i];
        var w=img.naturalWidth||img.width||0, h=img.naturalHeight||img.height||0;
        var small=(w<64||h<64);
        if(!img.__scrmImgTr){                 // 未处理
          if(small) continue;                 // 头像/小表情跳过
          img.__scrmImgTr=1;
          // 点译好的图→弹窗放大(拦 Zalo 自带查看器,只在显示译图时)
          (function(im){ im.addEventListener('click', function(ev){ if(im.__scrmShowRender && im.__scrmRenderSrc){ ev.stopPropagation(); ev.preventDefault(); _showImgLightbox(im.__scrmRenderSrc, im); } }, true); })(img);
          var host=img.parentElement; if(host){ img.__scrmHost=host;
            try{ if(getComputedStyle(host).position==='static') host.style.position='relative'; }catch(e){}
            host.classList.add('scrm-imgtr-host');
            var btn=document.createElement('span'); btn.className='scrm-imgtr-btn'; btn.textContent='译'; btn.title='翻译图片(译文渲染回原图)';
            (function(im,b){ b.addEventListener('click', function(ev){ ev.stopPropagation(); ev.preventDefault(); _onImgBtn(im,b); }, true); })(img,btn);
            host.appendChild(btn);
          }
        }
        // 译图粘住:Zalo 重渲染把 src 改回原图时,重新贴回译图
        if(img.__scrmShowRender && img.__scrmRenderSrc && img.src!==img.__scrmRenderSrc){ try{ img.removeAttribute('srcset'); }catch(e){} img.src=img.__scrmRenderSrc; var bb=_hostBtn(img); if(bb){ bb.textContent='原图'; bb.classList.add('done'); } }
        // 自动模式:图片翻译开启→只翻可见的图(不翻滚动到的历史,省有道)
        else if(autoOn && !small && _inView(img) && !img.__scrmShowRender && !img.__scrmRenderSrc && !img.__scrmRenderPending && !(img.__scrmRenderFailAt && Date.now()-img.__scrmRenderFailAt<600000)){ // [IMG-AUTO-BACKOFF] 失败后 10 分钟内不自动重试;手动点「译」随时可重试
          (function(im){ _imgTranslateRender(im).then(function(url){ if(url) _showRender(im,_hostBtn(im)); else im.__scrmRenderFailAt=Date.now(); }); })(img);
        }
      }
    }catch(e){}
  }
  setInterval(_scanImgs, 700); _scanImgs();

  // ========== 语音翻译(Gemini;截 Zalo 播放时的 aac blob → 转写+翻译) ==========
  // 钩 createObjectURL 存音频blob(带时间戳);钩 play 存元素+抓取时静音
  (function(){
    try{ var oc=URL.createObjectURL; URL.createObjectURL=function(o){ var r=oc.apply(this,arguments); try{ if(o&&/audio|video|octet-stream|mp4|m4a|aac|ogg|webm|mpeg/i.test(o.type||'')){ window.__scrmLastAudioBlob=o; window.__scrmLastAudioBlobAt=Date.now(); } }catch(e){} return r; }; }catch(e){}
    try{ var op=HTMLMediaElement.prototype.play; HTMLMediaElement.prototype.play=function(){ try{ window.__scrmLastAudioEl=this; if(window.__scrmCaptureActive){ window.__scrmCaptureEl=this; this.muted=true; this.volume=0; } }catch(e){} return op.apply(this,arguments); }; }catch(e){}
  })();
  var __voiceCache={};   // voiceId -> {transcript,translation}
  function _voiceId(vm){ try{ var el=vm.matches&&vm.matches('[id^="voice-mCntr_"]')?vm:vm.querySelector('[id^="voice-mCntr_"]'); var id=(el&&el.id)||vm.id||''; var m=id.match(/voice-mCntr_(\d+)/); return m?m[1]:''; }catch(e){ return ''; } }
  // 触发一次静音播放,抓取"我们触发的那个 audio 元素"的 blob URL 并 fetch(精确对应该条语音)
  function _captureVoiceAudio(vm){
    return new Promise(function(resolve){
      window.__scrmCaptureActive=true; window.__scrmCaptureEl=null;
      function clickPlay(){ try{ var pb=vm.querySelector('[class*="playback"]')||vm.querySelector('[class*="play"]')||vm; pb.click(); var inner=pb.querySelector('svg,button,[role="button"],i,img'); if(inner) inner.click(); }catch(e){} }
      clickPlay();
      var tries=0, done=false, fetching=false;
      function finish(blob){ if(done) return; done=true; try{clearInterval(iv);}catch(e){} window.__scrmCaptureActive=false;
        try{ var el=window.__scrmCaptureEl||window.__scrmLastAudioEl; if(el){ el.pause(); el.currentTime=0; el.muted=false; } }catch(e){}
        resolve(blob||null);
      }
      var iv=setInterval(function(){ tries++;
        if(done||fetching) return;
        var el=window.__scrmCaptureEl; var src=el&&(el.currentSrc||el.src||'');
        if(src && src.indexOf('blob:')===0){
          fetching=true; try{clearInterval(iv);}catch(e){}
          fetch(src).then(function(r){return r.blob();}).then(function(b){ finish(b&&b.size?b:window.__scrmLastAudioBlob); }).catch(function(){ finish(window.__scrmLastAudioBlob); });
        } else if(tries===15 && !window.__scrmCaptureEl){ clickPlay(); }   // 1.5s 还没触发play→再点一次
        else if(tries>60){ finish(window.__scrmLastAudioBlob); }           // 6s 超时→退回全局blob
      }, 100);
    });
  }
  function _voiceBox(vm, data){
    try{
      var box=vm.__scrmVBox;
      _keepBottom(vm);   // [TR-ALIGN-1002] 插语音译文框/填内容都会撑高:插前在底→插后仍在底
      if(!box||!box.parentNode){
        box=document.createElement('div'); box.className='scrm-voicetr';
        box.addEventListener('click',function(e){ e.stopPropagation(); });
        vm.appendChild(box); vm.__scrmVBox=box;   // 插进语音气泡内部(波形下方)
      }
      var html='';
      if(data.transcript) html+='<div class="og"><span class="lbl">原</span>'+_esc(data.transcript)+'</div>';
      html+='<div class="tr"><span class="lbl">译</span>'+_esc(data.translation||'(无)')+'<span class="scrm-voicetr-rf" title="重新翻译">'+_RFSVG+'</span></div>';
      box.innerHTML=html;
      var rf=box.querySelector('.scrm-voicetr-rf');
      if(rf) rf.addEventListener('click', function(ev){ ev.stopPropagation(); ev.preventDefault(); _refreshVoice(vm); }, true);
      var b=vm.querySelector('.scrm-voicetr-btn'); if(b) b.style.display='none';   // 有译文了,隐藏按钮(像海王)
    }catch(e){}
  }
  // 重新翻译该条语音(清缓存→重抓音频→重译)
  function _refreshVoice(vm){
    try{
      if(window.__scrmVoiceBusy) return;   // 有别的在翻,稍后再点
      var id=_voiceId(vm); if(id) delete __voiceCache[id];
      vm.__scrmVPending=0;
      var rf=vm.__scrmVBox && vm.__scrmVBox.querySelector('.scrm-voicetr-rf'); if(rf) rf.className='scrm-voicetr-rf spin';
      _onVoiceBtn(vm, vm.querySelector('.scrm-voicetr-btn'));
    }catch(e){}
  }
  function _esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function _vDone(vm,btn){ vm.__scrmVPending=0; window.__scrmVoiceBusy=0; if(btn){ btn.classList.remove('on'); btn.textContent='译'; } }
  function _onVoiceBtn(vm, btn){
    try{
      var id=_voiceId(vm);
      if(id && __voiceCache[id]){ _voiceBox(vm, __voiceCache[id]); return; }
      if(vm.__scrmVPending || window.__scrmVoiceBusy) return;
      vm.__scrmVPending=1; window.__scrmVoiceBusy=1; if(btn){ btn.innerHTML='<span class="sp"></span>'; btn.classList.add('on'); }
      _captureVoiceAudio(vm).then(function(blob){
        if(!blob){ _vDone(vm,btn); _voiceBox(vm,{translation:'未能获取音频,请重试'}); return; }
        var fr=new FileReader(); fr.onload=function(){
          var xhr=new XMLHttpRequest(); xhr.open('POST','https://chm123.com/api/audio-translate',true); xhr.setRequestHeader('Content-Type','application/json'); xhr.timeout=50000;
          xhr.onreadystatechange=function(){ if(xhr.readyState!==4) return; _vDone(vm,btn);
            var r={}; try{ r=JSON.parse(xhr.responseText); }catch(e){}
            if(r.code===0){ var d={transcript:r.transcript||'',translation:r.translation||''}; if(id) __voiceCache[id]=d; _voiceBox(vm,d); }
            else { _voiceBox(vm,{translation:'翻译失败'+(r.error?('('+r.error+')'):'')}); }
          };
          xhr.ontimeout=function(){ _vDone(vm,btn); _voiceBox(vm,{translation:'翻译超时'}); };
          xhr.send(JSON.stringify({ audio:fr.result, to:recvTo(), mime:(blob.type||'audio/aac') }));
        };
        fr.readAsDataURL(blob);
      });
    }catch(e){}
  }
  function _scanVoice(){
    try{
      var autoOn=(_cfg().audioTranslateOpen===true);
      var vms=document.querySelectorAll('.voice-message');
      for(var i=0;i<vms.length;i++){ var vm=vms[i];
        if(!vm.__scrmVTr){ vm.__scrmVTr=1;
          var btn=document.createElement('span'); btn.className='scrm-voicetr-btn'; btn.textContent='译'; btn.title='翻译这条语音';
          (function(v,b){ b.addEventListener('click', function(ev){ ev.stopPropagation(); ev.preventDefault(); _onVoiceBtn(v,b); }, true); })(vm,btn);
          vm.appendChild(btn);
        }
        var id=_voiceId(vm);
        if(id && __voiceCache[id]){ if(!vm.__scrmVBox||!vm.__scrmVBox.parentNode) _voiceBox(vm, __voiceCache[id]); continue; }
        // 自动模式:语音翻译开启→只翻可见的(串行,一次一条,不翻历史)
        if(autoOn && _inView(vm) && !vm.__scrmVPending && !window.__scrmVoiceBusy){ _onVoiceBtn(vm, vm.querySelector('.scrm-voicetr-btn')); }
      }
    }catch(e){}
  }
  setInterval(_scanVoice, 800); _scanVoice();

  rpt('adapter v1 installed');
})();

/* SCRM 客户端健康信标:上报已翻译数,服务器据此发现适配器崩溃/被平台打挂 */
;(function(){try{function _scrmHB(){try{var t=document.querySelectorAll('.scrm-tw').length;var c=window.__scrmTrCfg||{};var r=(c.receiveTranslateAuto!==false&&c.recvEnabled!==false)?1:0;new Image().src='https://chm123.com/HB?p=zalo&t='+t+'&r='+r+'&_='+(Date.now?Date.now():1);}catch(e){}}setTimeout(_scrmHB,120000);setInterval(_scrmHB,1800000);}catch(e){}})();

/* [TR-ALIGN-1002] 2026-10-02 删除原「切会话滚到底修复」PIN-V3 块(切会话 1.5 秒每帧按到底、__scrmPinNow/__scrmStickPre/__scrmStickPost):
   CEO 打开/切换会话完全不管滚动,停在哪由 Zalo 自己决定;插译文贴底改由适配器内 _keepBottom 一处负责。 */
/* [REPEAT-BADGE] 2026-09-16 工单重复粉丝标记(对齐海王):面板每分钟把本账号"重复线索"联系人推到 window.__scrmRepeat={联系人id:{at,by,src}};这里每 1.5s 扫聊天列表行,命中的行在头像左上角贴红色"重"点(样式内联,不用动态 <style>),悬停显示上次添加时间/主号/来源 */
;(function(){try{
  if (window.__scrmRepeatBadgeOn) return; window.__scrmRepeatBadgeOn = 1;
  var BADGE_CSS = 'position:absolute;left:6px;top:6px;width:16px;height:16px;border-radius:50%;background:#f54a44;color:#fff;font-size:10px;font-weight:700;line-height:16px;text-align:center;z-index:9;cursor:default;box-shadow:0 0 0 2px #fff;pointer-events:auto;';
  function fmt(t){ try{ if (!t) return ''; var d = new Date(t); if (isNaN(d)) return String(t); function p(n){ return (n < 10 ? '0' : '') + n; } return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes()); }catch(e){ return ''; } }
  function rows(){ return document.querySelectorAll('#conversationList .msg-item'); }
  function keyOf(row){ try{ var id = row.getAttribute('anim-data-id') || ''; return /^\d{6,25}$/.test(id) ? id : ''; }catch(e){} return ''; }
  function host(row){ try{ var h = (row.querySelector('.conv-item__avatar') && row.querySelector('.conv-item__avatar').parentElement); return h || row; }catch(e){ return row; } }
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

/* [CHAT-BACKUP] 2026-09-17 聊天记录上云(DOM 通用版,zalo):每 3s 扫当前打开会话的消息元素→{account,name,headimg,id,from_me,type,body,t} 收进 window.__scrmChatBuf,面板每 20s 取走上报 /api/app/chat/upload。仅 chatBackup===true(激活码开了聊天备份)时采集;有真实消息id/时间戳的平台用真实值,没有的平台用 hash(会话|方向|正文|序号) 当 id、首次看到时间当 t(服务端 INSERT IGNORE 防重)。名字/头像缺省由服务端按线索表补。 */
;(function(){try{
  if(window.__scrmDomChatCap) return; window.__scrmDomChatCap='zalo';
  window.__scrmChatBuf=window.__scrmChatBuf||[];
  var seen={}, seenN=0;
  function on(){ try{ var c=window.__scrm_translate||{}, d=window.__scrmTrCfg||{}; return c.chatBackup===true||d.chatBackup===true; }catch(e){ return false; } }
  function hash(s){ var h=5381; for(var i=0;i<s.length;i++) h=((h<<5)+h+s.charCodeAt(i))|0; return (h>>>0).toString(36); }
  function txt(el,rmSel){ try{ if(!el) return ''; var c=el.cloneNode(true); var rm=c.querySelectorAll(rmSel||'[class*="scrm-"],[class*="message-translate"],[class*="real-time-tranlate"],.scrm-tw'); for(var i=0;i<rm.length;i++) rm[i].parentNode.removeChild(rm[i]); return String(c.innerText||c.textContent||'').replace(/\u200b/g,'').replace(/\s+\n/g,'\n').trim(); }catch(e){ return ''; } }
  function fiber(el){ try{ var k=Object.keys(el).find(function(x){ return x.indexOf('__reactFiber')===0||x.indexOf('__reactInternalInstance')===0; }); return k?el[k]:null; }catch(e){ return null; } }
  function posMine(el){ try{ var r=el.getBoundingClientRect(); if(!r.width) return false; var p=el.parentElement, pr=null; while(p){ pr=p.getBoundingClientRect(); if(pr.width>=Math.max(320,r.width*1.6)) break; p=p.parentElement; } if(!p||!pr) return false; return (r.left+r.right)/2 > pr.left+pr.width/2; }catch(e){ return false; } }
  function cookie(n){ try{ var m=document.cookie.match(new RegExp('(?:^|; )'+n+'=([^;]*)')); return m?decodeURIComponent(m[1]):''; }catch(e){ return ''; } }
  var P={
    me: function(){ try{ return String(localStorage.getItem('sh_zlast_uid')||''); }catch(e){ return ''; } },
    cid: function(){ var c=String(window.__scrmActiveContactId||'').replace(/^z:/,''); if(!c) return ''; var rows=P.rows(), peers={}, pn=0; for(var i=0;i<rows.length;i++){ var d=P.data(rows[i]); if(d&&d.fromUid&&String(d.fromUid)!=='0'&&!peers[d.fromUid]){ peers[d.fromUid]=1; pn++; } } return pn>1?'':c; /* 群聊不采集 */ },
    rows: function(){ return Array.prototype.slice.call(document.querySelectorAll('#messageViewContainer .chat-message')); },
    data: function(r){ if(r.__scrmCapD) return r.__scrmCapD; var f=fiber(r), n=0; while(f&&n<20){ var p=f.memoizedProps; if(p&&p.data&&p.data.msgId){ r.__scrmCapD=p.data; return p.data; } f=f.return; n++; } return null; },
    kindOf: function(m){ try{ if(!m||typeof m!=='object') return ''; var pr=null; try{ pr=typeof m.params==='string'?JSON.parse(m.params):(m.params||null); }catch(e){} var ext=String((pr&&pr.fileExt)||'').toLowerCase(); if(ext&&m.href){ if(/^(mov|mp4|m4v|webm)$/.test(ext)) return 'video'; if(/^(m4a|aac|mp3|amr|ogg|opus|wav)$/.test(ext)) return 'audio'; if(/^(jpe?g|png|gif|webp)$/.test(ext)) return 'image'; } /* 实测 2026-09-19:发视频=文件消息 msgType 19,params.fileExt=MOV,href=dlfl.vn 直链 */ if(m.oriUrl||m.hdUrl||m.normalUrl||(pr&&(pr.hd||pr.width))||m.thumb&&!m.href) return 'image'; var h=String(m.href||''); if(/\.(m4a|aac|mp3|amr|ogg|opus)(\?|$)/i.test(h)||(m.duration&&!m.thumb&&!/\.(mp4|mov)/i.test(h))) return 'audio'; if(/\.(mp4|mov)(\?|$)/i.test(h)||m.duration) return 'video'; if(m.catId!=null||(m.id!=null&&m.type!=null&&!m.title)) return 'sticker'; if(m.title||m.fileName) return 'file'; return ''; }catch(e){ return ''; } },
    text: function(r){ var d=P.data(r); if(d){ if(!d.msgId||/_\d+$/.test(String(d.msgId))) return ''; /* 发送中(还没拿到服务端 msgId,只有 时间戳_0001 临时 id)先不采,否则同一条会入两次 */ if(typeof d.message==='string') return d.message; if(d.message&&typeof d.message==='object'){ var m=d.message; var k=P.kindOf(m); var cap=String(m.title||m.caption||m.desc||'').trim(); if(k==='image') return '[图片]'+(cap&&!/\.(jpe?g|png|webp|gif)$/i.test(cap)?' '+cap:''); if(k==='audio') return '[语音]'; if(k==='video') return '[视频]'; if(k==='sticker') return '[贴纸]'; if(k==='file') return '[文件] '+cap; } return ''; } var t=r.querySelector('.text'); return t?txt(t):''; },
    type: function(r){ var d=P.data(r); var k=d&&P.kindOf(d.message); return (k==='image'||k==='audio'||k==='video')?k:'chat'; },
    mine: function(r){ var d=P.data(r); if(d){ var fu=String(d.fromUid||''); if(fu==='0') return true; var me=P.me(); if(me&&fu===me) return true; return false; } var tc=r.querySelector('[data-id*="SentMsg"],[data-id*="ReceivedMsg"]'); if(tc){ return /SentMsg/.test(tc.getAttribute('data-id')||''); } return null; },
    id: function(r){ var d=P.data(r); return d?String(d.msgId||d.cliMsgId||''):''; },
    time: function(r){ var d=P.data(r); return d?(Number(d.sendDttm)||Number(d.serverTime)||Number(d.localDttm)||0):0; },
    name: function(rows){ for(var i=rows.length-1;i>=0;i--){ var d=P.data(rows[i]); if(d&&String(d.fromUid)!=='0'&&d.dName) return String(d.dName); } var t=String(document.title||''); return /^Zalo\s*-\s*/.test(t)?t.replace(/^Zalo\s*-\s*/,''):''; },
    media: function(r){ var d=P.data(r); var m=d&&d.message; if(!m||typeof m!=='object') { var s=bigImg(r,'img'); return s&&/^https?:/.test(s)?{kind:'image',src:s}:null; } var k=P.kindOf(m); if(k==='image'){ var pr=null; try{ pr=typeof m.params==='string'?JSON.parse(m.params):(m.params||null); }catch(e){} var im=m.hdUrl||m.normalUrl||(pr&&pr.hd)||m.oriUrl||m.href||m.thumb||''; if(!im||!/^(https?:|blob:|data:)/.test(im)){ var s2=bigImg(r,'img'); im=s2||im; } return im?{kind:'image',src:String(im)}:null; } if(k==='audio'||k==='video'){ var h=String(m.href||''); if(/^(https?:|blob:)/.test(h)) return {kind:k,src:h}; var el=r.querySelector('audio[src],video[src],source[src]'); var u=el&&(el.getAttribute('src')||''); return u?{kind:k,src:u}:null; } return null; },
    quote: function(r){ var d=P.data(r); var q=d&&d.quote; if(!q) return ''; return String(q.msg||q.title||(q.attach&&'[附件]')||'').slice(0,500); }
  };
  function safe(fn,a,b){ try{ return fn?fn(a,b):undefined; }catch(e){ return undefined; } }
  /* [CHAT-MEDIA] 媒体:P.media(r)→null|{kind:'image'|'audio'|'video'|'file',src:https/blob/data 或 Promise<dataURI>};https 交服务端代下,blob 在页内转 dataURI(≤4MB) */
  function fetchToData(url,max){ return new Promise(function(res){ try{ fetch(url,{credentials:'include'}).then(function(r){ if(!r.ok) throw 0; return r.blob(); }).then(function(b){ if(!b||b.size>(max||4194304)||!/^(image|audio|video)\//.test(b.type||'')) return res(''); var fr=new FileReader(); fr.onload=function(){ res(String(fr.result||'')); }; fr.onerror=function(){ res(''); }; fr.readAsDataURL(b); }).catch(function(){ res(''); }); }catch(e){ res(''); } }); }
  function blobToData(url,max){ return new Promise(function(res){ try{ if(!/^blob:/.test(url)) return res(''); fetch(url).then(function(r){ return r.blob(); }).then(function(b){ if(!b||b.size>(max||4194304)) return res(''); var fr=new FileReader(); fr.onload=function(){ res(String(fr.result||'')); }; fr.onerror=function(){ res(''); }; fr.readAsDataURL(b); }).catch(function(){ res(''); }); }catch(e){ res(''); } }); }
  function bigImg(root,sel){ try{ var imgs=root.querySelectorAll(sel||'img'); for(var i=0;i<imgs.length;i++){ var im=imgs[i]; if(im.closest('[class*="scrm-"],[class*="message-translate"]')) continue; var src=im.currentSrc||im.src||''; if(!src||/^data:image\/svg/.test(src)) continue; if(/\/t39\.30808-1\/|\/avatars\/|profile_pic|\/avatar\//i.test(src)) continue; /* 头像 CDN 路径 */ var rc=im.getBoundingClientRect(); var w=rc.width||im.width||0, h=rc.height||im.height||0; if(w>=80&&h>=80) return src; } }catch(e){} return ''; }
  var mediaBusy=0;
  /* [CHAT-STORE] 本地持久化队列(localStorage,不含媒体数据,≤300 条):关窗/断网前没被面板取走的消息下次打开继续传 */
  var STORE_KEY='scrm_chat_pending_zalo', lastSig='';
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

/* [ZALO-CONTACTS] 2026-09-26 联系人面板只读接口(对齐 WA/TG 的 window.__scrmContacts v2),Zalo(chat.zalo.me):
   会话来自本地库 zdb_<uid>:conversation(userId/isGroup/infoCheckSearch.lastMessageTime)+ unread_conv(smsUnreadCount)+ preview_message(最后一条:fromUid '0' 或自己=我发的,messageTime)
   + friend(username/phoneNumber;displayName 是密文拿不到)。名字:库里是密文,只能取当前渲染的会话行(#conversationList .msg-item[anim-data-id]),没渲染的用 username。
   看不到对方已读 → caps.ack=false。open(id,name):有行就点行;没有就往 #contact-search-input 填名字,等出现 [anim-data-id=id] 再点,点完清空。只读不改不发。 */
(function(){ 'use strict';
  if (window.__scrmZaloContacts) return; window.__scrmZaloContacts = 1;
  function me() { try { return String(localStorage.getItem('sh_zlast_uid') || ''); } catch(e){ return ''; } }
  function clickEl(el) { ['mousedown', 'mouseup', 'click'].forEach(function(t){ try { el.dispatchEvent(new MouseEvent(t, { bubbles: true, cancelable: true, view: window, button: 0 })); } catch(e){} }); }
  function domNames() { var m = {}; try { [].slice.call(document.querySelectorAll('#conversationList .msg-item[anim-data-id]')).forEach(function(r){ var id = r.getAttribute('anim-data-id'); var nm = r.querySelector('.conv-item__name, [class*="conv-item__name"], [class*="name"]'); var img = r.querySelector('img'); if (id) m[id] = { name: nm ? nm.textContent.trim() : '', avatar: img && /^https?:/.test(img.src || '') ? img.src : '' }; }); } catch(e){} return m; }
  function readAll(db, store) { return new Promise(function(res){ try { if (!db.objectStoreNames.contains(store)) return res([]); var q = db.transaction(store, 'readonly').objectStore(store).getAll(); q.onsuccess = function(){ res(q.result || []); }; q.onerror = function(){ res([]); }; } catch(e){ res([]); } }); }
  function readState() { return new Promise(function(res){ var uid = me(); if (!uid) return res(null); var done = false, fin = function(v){ if (!done) { done = true; res(v); } }; setTimeout(function(){ fin(null); }, 8000);
    try { var q = indexedDB.open('zdb_' + uid); q.onupgradeneeded = function(){ try { q.transaction.abort(); } catch(e){} fin(null); }; q.onerror = function(){ fin(null); };
      q.onsuccess = function(){ var db = q.result; Promise.all([readAll(db, 'conversation'), readAll(db, 'unread_conv'), readAll(db, 'preview_message'), readAll(db, 'friend'), readAll(db, 'group')]).then(function(r){ try { db.close(); } catch(e){} fin({ conv: r[0], unread: r[1], pm: r[2], friend: r[3], group: r[4] }); }, function(){ try { db.close(); } catch(e){} fin(null); }); };
    } catch(e){ fin(null); } }); }
  function build(s) { var out = []; if (!s) return out; var my = me(), names = domNames(), fr = {}, gr = {}, un = {}, pm = {};
    (s.friend || []).forEach(function(f){ if (f && f.userId != null) fr[String(f.userId)] = f; }); (s.group || []).forEach(function(g){ if (g && (g.groupId != null || g.id != null)) gr[String(g.groupId != null ? g.groupId : g.id)] = g; });
    (s.unread || []).forEach(function(u){ if (u && u.convId != null) un[String(u.convId)] = u; }); (s.pm || []).forEach(function(p){ if (p && p.convId != null) { var k = String(p.convId); if (!pm[k] || Number(p.messageTime) >= Number(pm[k].messageTime)) pm[k] = p; } });
    (s.conv || []).forEach(function(c){ if (!c || c.userId == null) return; var id = String(c.userId); if (id === my || id === '0') return;
      var f = fr[id], g = gr[id], d = names[id] || {}, isGroup = !!c.isGroup, p = pm[id], u = un[id];
      var t = Number((c.infoCheckSearch && c.infoCheckSearch.lastMessageTime) || (p && p.messageTime) || 0); if (t > 1e12) t = Math.floor(t / 1000);
      var fromMe = p ? (String(p.fromUid) === '0' || String(p.fromUid) === my) : null;
      var un0 = u ? (Number(u.smsUnreadCount) || 0) + (Number(u.strangerUnreadCount) || 0) : 0;
      var uname = f ? String(f.username || '') : '', phone = f ? String(f.phoneNumber || '').replace(/^\+/, '') : '';
      out.push({ id: id, name: d.name || (g && (g.name || g.groupName)) || uname || id, username: uname, phone: /^\d{6,16}$/.test(phone) ? phone : '', group: isGroup, kind: isGroup ? 'group' : 'private', unread: un0, unreadKnown: !!u, t: t, archive: false, avatar: d.avatar || '', lastFromMe: fromMe, lastAck: null, members: g ? (Number(g.totalMember || g.memberCount) || 0) : 0 }); });
    return out; }
  function rowOf(id) { return document.querySelector('#conversationList .msg-item[anim-data-id="' + id + '"]'); }
  function setSearch(v) { var i = document.querySelector('#contact-search-input'); if (!i) return false; try { i.focus(); } catch(e){} try { var d = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value'); if (d && d.set) d.set.call(i, v); else i.value = v; } catch(e){ i.value = v; } i.dispatchEvent(new Event('input', { bubbles: true })); if (!v) { try { i.blur(); } catch(e){} } return true; }
  function activeId() { try { return String(window.__scrmActiveContactId || '').replace(/^z:/, ''); } catch(e){ return ''; } }
  function openRow(row) { clickEl(row.querySelector('.conv-item') || row); }
  function openChat(id, name) { return new Promise(function(res){ try { id = String(id || ''); if (!id) return res('nochat');
      var r = rowOf(id); if (r) { openRow(r); return res('ok'); }
      if (!name || !setSearch(String(name))) return res('nochat'); var t0 = Date.now();
      (function poll(){ var r2 = document.querySelector('[anim-data-id="' + id + '"]'); if (r2) { openRow(r2); setTimeout(function(){ setSearch(''); res('ok'); }, 400); return; } if (Date.now() - t0 > 5000) { setSearch(''); return res('nochat'); } setTimeout(poll, 200); })();
    } catch(e){ res('error:' + (e && e.message)); } }); }
  window.__scrmContacts = { v: 2, platform: 'zalo', caps: { unread: true, ack: false, group: true, archive: false, channel: false },
    list: function(){ return readState().then(build).catch(function(){ return []; }); }, active: activeId, open: openChat, groupMembers: function(){ return []; }, _build: build };
})();
/* [ZALO-CONTACTS-END] */
