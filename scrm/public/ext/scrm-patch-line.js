/* __scrmPatchV1__ scrm-patch-line ADAPTER v2 —— Line 自研翻译(照 Zalo 框架)。v2:线路/Gemini+按联系人独立+中文检测+关调试。
   Line 特性:输入框是 <textarea-ex> Web Component(shadow DOM 内 textarea),写入 el.value=[text],发送=合成回车(海王 gn 法)。 */
(function(){
  'use strict';
  if (window.__scrmLineTr) return; window.__scrmLineTr = true;
  // [A兜底] 主世界缺海王 window.utils.getActiveContactId → dashboard检测不到切好友(好友独立翻译"一开全开")。用URL补上;海王有则不覆盖。
  var _scrmUtilsFb=false;
  try{ if(!window.utils) window.utils={}; if(typeof window.utils.getActiveContactId!=='function'){ window.utils.getActiveContactId=function(){ try{ var m=(location.href||'').match(/\/chats\/([^\/?#]+)/); if(m&&m[1]) return decodeURIComponent(m[1]); }catch(e){} return ''; }; _scrmUtilsFb=true; } }catch(_u){}
  // [A兜底,仅海王缺失时] 发布 window.__scrmActiveContactId(URL派生)供dashboard检测切好友;海王在(B/老客户)则不动,走原路径。
  try{ if(_scrmUtilsFb){ setInterval(function(){ try{ var m=(location.href||'').match(/\/chats\/([^\/?#]+)/); window.__scrmActiveContactId=(m&&m[1])?decodeURIComponent(m[1]):''; }catch(e){} }, 500); } }catch(_a){}

  var DBG = false;
  function rpt(msg){ if(!DBG) return; try{ var a='sl:auto,tl:en,st:'+encodeURIComponent('LTRDBG '+String(msg).slice(0,280))+',id:'+(Date.now?Date.now():1); var x=new XMLHttpRequest(); x.open('GET',_trRouteUrl(_route())+'/async/translate?async='+encodeURIComponent(a),true); x.send(); }catch(e){} }
  rpt('adapter v1 loaded');

  function _norm(s){ return (s||'').replace(/[​‌‍﻿]/g,'').replace(/\r/g,'').replace(/^\s+|\s+$/g,''); }
  // ===== 配置:读 main.js updateTranslate 注入的 window.__scrmTrCfg(目标语言/线路/开关/好友独立)=====
  function _cfg(){ try{ return Object.assign({}, window.__scrm_translate||{}, window.__scrmTrCfg||{}); }catch(e){ return {}; } }
  function _activeCid(){ try{ var u=window.utils; var id=(u&&u.getActiveContactId&&u.getActiveContactId())||''; if(id) return id; }catch(e){} try{ var m=(location.href||'').match(/\/chats\/([^\/?#]+)/); if(m&&m[1]) return decodeURIComponent(m[1]); }catch(e){} return ''; }
  // 发送目标语言:优先当前联系人"好友独立发送翻译",否则全局
  function sendTo(){ var c=_cfg();
    try{ var id=_activeCid(); if(id){ var sct=c.singleContactTranslate&&c.singleContactTranslate[id]; if(sct&&(sct.singleContactTranslateOpen||sct.enabled)&&(sct.sendTargetLanguage||sct.sendTo)) return sct.sendTargetLanguage||sct.sendTo; } }catch(e){}
    return c.lineGlobalSend || c.sendTargetLanguage || c.sendTo || 'en';
  }
  function recvTo(){ var c=_cfg(); return c.receiveTargetLanguage || c.recvTo || 'zh-CN'; }
  function sendEnabled(){ try{ var c=_cfg(); return c.sendTranslateAuto!==false && c.sendEnabled!==false; }catch(e){} return true; }
  function detectOn(){ try{ return _cfg().chineseCheck===true; }catch(e){} return false; }
  function _tgtIsZh(){ var to=sendTo(); return !!(to && to.indexOf('zh')===0); }
  /* [TR-ALIGN-1002] 2026-10-02「要不要翻」唯一判断(预览/回车共用,照 TG [TG-ZH-SAME]):目标是中文、输入里除汉字外没有别的文字
     (只有汉字/数字/标点/emoji)→ 不用翻,原样发送;其他一律去翻(CEO 只跳过空文本)。
     原来「输入不是含汉字且无假名就原样发」+ containsChinese(目标 zh/ja 不翻)→ 目标中文时俄文/假名/韩文原样发、目标英文时英文以外的外文也不翻,已删。 */
  function _sendAsIs(src){ return _tgtIsZh() && !/\p{L}/u.test(String(src||'').replace(/\p{Script=Han}/gu,'')); }
  var _ASIS_NOTE='  (已是目标语言,原样发送)';
  function _hasZh(t){ return /[一-鿿]/.test(t||''); }
  /* [TR-FIX-1002B] 本文件共用的规则只在这里定义一次(原 _sig 定义在 200 行后,和预览/发送分在两处):
     _sig  = 签名:只留所有语言的字母数字(\p{L}\p{N}),用于「译文与原文是否相同」「输入框里是不是译文」的比较;
     _safeToSend = 这段文字能不能发出去的唯一判断:目标语言不是中文/日文时,只要还含汉字就不能发(翻译线路把原文原样吐回、
       或翻译没生效时,绝不能把中文发给客户)。回车翻译发送、「译文与原文签名相同 → 原样发」捷径、写入后核对,三个出口只调它。
       发送翻译关(用户自己选择原样发)不走它,仍由「中文检测」开关决定。 */
  function _sig(s){ s=String(s==null?'':s); try{ return s.replace(/[^\p{L}\p{N}]+/gu,'').toLowerCase(); }catch(e){ return s.replace(/[^0-9a-zA-Z一-鿿]+/g,'').toLowerCase(); } }
  function _safeToSend(t){ var to=String(sendTo()||'').toLowerCase(); if(to.indexOf('zh')===0||to.indexOf('ja')===0) return true; return !/\p{Script=Han}/u.test(String(t||'')); }
  // 翻译线路(读面板 route,含 AI线路·谷歌Gemini;非谷歌回退谷歌香港)
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
  /* [TR-FIX-1002B] _route()=实际请求用的线路(面板值不认识时回退 google2,和 routeBase 同一个来源);缓存键/预览键都用它,
     这样「键里的线路」和「真正发请求的线路」永远一致。_ck()=翻译缓存键唯一写法 'v2|线路|目标语言|原文'(内存 _cache 和持久的收信缓存共用);
     原来键是 'v1|语言|原文' 不含线路 → 换线路后直接拿旧线路的缓存,等于没换。旧 v1 键自然作废。 */
  function _route(){ try{ return _trRouteOf(_cfg()); }catch(e){} return 'google2'; }
  function routeBase(){ return _trRouteUrl(_route()); }
  function _ck(tl, text){ return 'v2|'+_route()+'|'+(tl||'en')+'|'+text; }
  function _wantRouteName(){ var nm=_trRouteName(_cfg()); return nm?nm+'实时翻译':''; }
  setInterval(function(){ try{ var want=_wantRouteName()||'\u5b9e\u65f6\u7ffb\u8bd1'; var els=document.querySelectorAll('.scrm-line-pv-lbl'); for(var i=0;i<els.length;i++){ if((els[i].textContent||'')!==want) els[i].textContent=want; } }catch(e){} }, 600);   // [LINE-PV] 标签写在我方卡片上(面板还没下发线路名时显示「实时翻译」)
  function showZhWarn(msg){ try{ var d=document.createElement('div'); d.textContent=msg; d.style.cssText='position:fixed;bottom:80px;left:50%;transform:translateX(-50%);z-index:2147483647;background:rgba(220,38,38,.96);color:#fff;font-size:13px;padding:9px 16px;border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,.3);'; document.body.appendChild(d); setTimeout(function(){ try{ d.parentNode&&d.parentNode.removeChild(d); }catch(e){} }, 2600); }catch(e){} }

  function recvEnabled(){ try{ var c=_cfg(); return c.receiveTranslateAuto!==false && c.recvEnabled!==false; }catch(e){} return true; }
  function previewEnabled(){ try{ var c=_cfg(); return c.translatePreview!==false && c.previewEnabled!==false; }catch(e){} return true; }
  // ---------- 翻译:直接 fetch(https,完整句无逗号截断),带缓存 ----------
  var _cache={}, _pending={};
  // 解析译文:google 格式 )]}'[[["<全部译文>","<原文>"... 完整译文在第一个 JSON 字符串里(含字面换行,不能 JSON.parse)→ 正则抓(处理转义);兜底 tw-answ-target-text 段
  function _parseTr(d){ if(!d) return '';
    try{ var m2=d.match(/\[\[\["((?:\\.|[^"\\])*)"/); if(m2){ var t=m2[1].replace(/\\u([0-9a-fA-F]{4})/g,function(_,h){return String.fromCharCode(parseInt(h,16));}).replace(/\\n/g,'\n').replace(/\\t/g,'\t').replace(/\\"/g,'"').replace(/\\\\/g,'\\'); if(t) return t; } }catch(e){}
    try{ var segs=[], re=/tw-answ-target-text">([\s\S]*?)<\/span>/g, mm; while((mm=re.exec(d))!==null){ segs.push(mm[1]); } if(segs.length) return segs.join(''); }catch(e){}
    var m=d.match(/tw-answ-target-text">([^<]*)</); return m?m[1]:'';
  }
  /* [TR-ALIGN-1002] force=↻重新翻译:不读缓存、不搭别人的在途请求,一定联网,拿到新结果覆盖缓存。
     原来 ↻ 去删 _cache[recvTo()+'|'+原文](拼错了键,真实键是 'v1|语言|原文')→ 删不掉,点了还是拿回旧译文。force 请求单独一个等待队列。 */
  function translate(text, tl, force){
    return new Promise(function(resolve){
      text=_norm(text); if(!text){resolve('');return;}
      var key=_ck(tl,text);   // [TR-FIX-1002B] 键含线路
      if(!force && _cache[key]!=null){resolve(_cache[key]);return;}
      var pk=force?('!'+key):key;
      if(_pending[pk]){_pending[pk].push(resolve);return;}
      _pending[pk]=[resolve];
      var done=function(r){ if(r)_cache[key]=r; var qs=_pending[pk]||[]; delete _pending[pk]; qs.forEach(function(f){try{f(r);}catch(e){}}); };
      var async='sl:auto,tl:'+(tl||'en')+',st:'+encodeURIComponent(text.slice(0,1500))+',id:'+(Date.now?Date.now():1);
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
  function translateML(text,tl,force){
    text=_norm(text); if(!text) return Promise.resolve('');
    if(text.indexOf('\n')===-1) return _trLine(text,tl,0,force);
    return Promise.all(text.split('\n').map(function(ln){ var t=_norm(ln); return t?_trLine(t,tl,0,force):Promise.resolve(''); })).then(function(rs){return rs.join('\n');});
  }

  // ---------- DOM ----------
  function getComposer(){ try{
      var sels=['[class*="chatroomEditor-module"] textarea-ex','[class*="chatroomEditor"] textarea-ex','textarea-ex','[class*="chatroomEditor"] textarea','[class*="chatroomEditor"] [contenteditable="true"]','[class*="chatInput"] textarea','footer textarea'];
      for(var i=0;i<sels.length;i++){ var e=document.querySelector(sels[i]); if(e) return e; }
    }catch(e){} return null; }
  function _ctext(el){ try{ if(!el) return '';
      var cands=[];
      try{ var v=el.value; if(Array.isArray(v)) v=v.join('\n'); if(v!=null&&v!=='') cands.push(String(v)); }catch(e){}
      try{ var ta=el.shadowRoot&&el.shadowRoot.querySelector('textarea'); if(ta&&ta.value!=null&&ta.value!=='') cands.push(String(ta.value)); }catch(e){}
      try{ if(el.innerText!=null&&el.innerText!=='') cands.push(String(el.innerText)); }catch(e){}
      var best=''; for(var i=0;i<cands.length;i++){ var n=_norm(cands[i]); if(n.length>best.length) best=n; }
      return best;
    }catch(e){ return ''; } }
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
  // 写入:照搬海王 hn —— textarea-ex.value=[text](数组)+ dispatch input(Web Component 的 value setter)
  function setInputText(el, text){
    try{ el.value=[String(text==null?'':text)]; var ev=document.createEvent('HTMLEvents'); ev.initEvent('input',true,true); el.dispatchEvent(ev); return true; }catch(e){ return false; }
  }
  // 发送:照搬海王 gn —— 在输入框上 dispatch 合成回车(isTrusted=false,绕过海王拦截,直达 Line 原生发送)
  function clickSend(){
    try{ var el=getComposer(); if(!el) return false; el.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',code:'Enter',which:13,keyCode:13,bubbles:true,cancelable:true})); return true; }catch(e){ return false; }
  }
  function refocus(){ try{ var c=getComposer(); if(c) c.focus(); }catch(e){} }

  // ---------- 样式:隐藏海王的翻译UI(译文框+预览),界面只显示我方独立元素 ----------
  function _injStyle(){
    try{ if(document.getElementById('__scrmZStyle')||!(document.head||document.body)) return;
      var st=document.createElement('style'); st.id='__scrmZStyle';
      st.textContent='.message-translate-content-wrapper{display:none !important;} .message-translate-content{display:none !important;} .real-time-tranlate-text{display:none !important;} .real-time-tranlate-content{display:none !important;} '
        /* [LINE-PV] 2026-10-03 预览卡片(用户:原来的"一根绿线+铅笔+…"太丑):照 Discord/LinkedIn 的样式 —— 左侧 2px 绿线、上行线路标签、下行译文 14px;LINE 输入区是纯白,加一层极淡绿底和圆角让它成一张卡片 */
        +_pvCoreCss('scrm-line-pv',{mode:'flat',bodySel:'.scrm-line-pv .scrm-pv'})
        +'.scrm-tw{display:block !important;margin-top:5px !important;padding-top:5px !important;border-top:1px dashed #1a7f37 !important;line-height:1.45 !important;height:auto !important;max-height:none !important;min-height:0 !important;overflow:visible !important;word-break:break-word;color:#1a7f37;white-space:pre-line;font-size:12px;text-align:left;} '
        +'.scrm-tw-rf{cursor:pointer;color:#8a96a3;margin-left:6px;user-select:none;vertical-align:middle;display:inline-flex;align-items:center;} .scrm-tw-rf:hover{color:#1a7f37;} ';
      (document.head||document.body).appendChild(st);
    }catch(e){}
  }
  setInterval(_injStyle, 500); _injStyle();

  // ---------- 预览(我方独立元素 .scrm-pv;海王的 .real-time-tranlate-text 已 CSS 隐藏,不再打架) ----------
  /* [TR-ALIGN-1002] 预览按「目标语言|线路|原文」判断要不要重翻(照 TG [TG-PV-KEY]):原来只在文字变化时才进 onInput → 输入不动、只换语言/线路,预览停在旧语言;
     回车复用预览结果原来只比原文(ct===_lastSrc)不比语言 → 换了语言回车仍发旧语言。
     _lastPvKey=最近一次处理的键;_pvDoneKey/_lastOut=预览里已翻好的那条(回车复用前键必须完全一致);
     _pvShownTo=预览当前对应的「语言|线路」('=' 表示原样发送提示)[TR-FIX-1002B],语言或线路变了先回占位「…」;译文回来时键已变就丢掉。 */
  var _prevTimer=null,_lastPvKey='',_pvDoneKey='',_lastOut='',_pvShownTo='',_wantShow='',_wantTr=false,_pvFailKey='',_pvFailAt=0;   // [TR-FIX-1002B] _pvFailKey/_pvFailAt=上次翻译失败的键和时间(同一句连续失败隔 2 秒再请求)
  function _pvKey(src){ return sendTo()+'|'+_route()+'|'+src; }   // [TR-FIX-1002B] 线路取实际请求用的那个
  function _pvCached(src){ return (_lastOut && _pvDoneKey===_pvKey(src)) ? _lastOut : ''; }
  function _sameSig(a,b){ return _sig(a)===_sig(b); }   // 译文与原文签名相同 = 已是目标语言
  /* [LINE-PV] 我方自己的预览卡片 .scrm-line-pv(标签 .scrm-line-pv-lbl + 正文 .scrm-pv),插在输入框(textarea-ex)前面、与它同一个容器;海王的 .real-time-tranlate-content 整块 CSS 隐藏。
     原来是照海王原样克隆一段 HTML(铅笔编辑钮、空的线路名)再往里塞我方元素,线路名没下发时就只剩一根绿线和铅笔。 */
  function _ourPv(){
    try{
      var host=document.querySelector('.scrm-line-pv');
      if(!host||!host.isConnected){
        var _el=(typeof getComposer==='function')?getComposer():null; if(!_el||!_el.parentElement) return null;
        host=document.createElement('div'); host.className='scrm-line-pv';
        var lbl=document.createElement('div'); lbl.className='scrm-line-pv-lbl'; lbl.textContent=_wantRouteName()||'\u5b9e\u65f6\u7ffb\u8bd1';
        var body=document.createElement('div'); body.className='scrm-pv';
        host.appendChild(lbl); host.appendChild(body);
        _el.parentElement.insertBefore(host, _el);
      }
      return host.querySelector('.scrm-pv');
    }catch(e){ return null; }
  }
  var _backTr=_backTrCore({ backCls:'scrm-line-pv-back', on:function(){ return !!_cfg().backTranslate; }, sendLang:sendTo, backLang:recvTo, translate:function(t,bl){ return translateML(t,bl); } });   /* [BACK-TR] 回译校对:下面写预览正文的地方调 _backTr.update(正文元素, 译文),行为全在上面的 [BACK-TR-CORE] */
  function setPreview(txt, isTr){ _wantShow=txt||''; _wantTr=!!isTr&&_wantShow!==''; try{ var pe=_ourPv(); if(pe && (pe.textContent||'')!==_wantShow) pe.textContent=_wantShow; _backTr.update(pe||null, _wantTr?_wantShow:''); }catch(e){} }
  setInterval(function(){ try{ var pe=_ourPv(); if(pe && (pe.textContent||'')!==_wantShow) pe.textContent=_wantShow; _backTr.update(pe||null, _wantTr?_wantShow:''); }catch(e){} }, 300);
  function onInput(){
    try{
      var el=getComposer();  if(!el) return;
      if(!previewEnabled()){ setPreview(''); _lastPvKey=''; _pvShownTo=''; return; }
      var T=_ctext(el);
      if(!T){ _lastPvKey=''; _pvDoneKey=''; _lastOut=''; _pvShownTo=''; _pvFailKey=''; setPreview('\u2026'); return; }   // [PV-IDLE-DOTS] 空输入常驻占位…(全平台一致)
      /* [TR-FIX-1002B] 发送翻译关的判断放到「键没变就不动」之前,并清掉去重键:原来它在提前返回之后,
         关→开时原文/语言/线路都没变 → 直接 return,预览一直停在「原文」,要改一个字才恢复。 */
      if(!sendEnabled()){ if(_prevTimer) clearTimeout(_prevTimer); _lastPvKey=''; _pvShownTo='='; setPreview(T); return; }   // 发送翻译关:回车原样发,预览如实显示原文
      var _to=sendTo(), _lr=_to+'|'+_route(), key=_pvKey(T);
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
        translateML(T, _to).then(function(tr){
          if(_lastPvKey!==key || _pvKey(_ctext(getComposer()))!==key) return;   // 键变了 → 丢掉旧结果
          if(tr&&tr.replace(/\s/g,'')&&_safeToSend(tr)){ _pvFailKey=''; _pvDoneKey=key; _lastOut=tr; setPreview(_sameSig(tr,T) ? T+_ASIS_NOTE : tr, !_sameSig(tr,T)); }
          /* [TR-FIX-1002B] 翻译失败(空结果,或过不了 _safeToSend —— 回车也不会发,预览与发送一致):预览明确显示「翻译失败」(不挂着上一句的译文),清掉去重键 → 轮询自动重试(同一句隔 2 秒),重试期间保持「翻译失败」 */
          else { _pvFailKey=key; _pvFailAt=Date.now(); _lastPvKey=''; setPreview('翻译失败'); }
        });
      }, 400);
    }catch(e){}
  }

  // ---------- 发出气泡"显示原文"(盖掉海王截断的再翻译) ----------
  /* [TR-ALIGN-1002] 签名改为保留所有语言的字母数字(\p{L}\p{N},同 Zalo):旧版只留拉丁+汉字 → 俄文/泰文/韩文/假名被删成空串,
     「译文与原文是否相同」误判、缓存键互相撞。纯拉丁/汉字文本签名与旧版一致,老缓存照样命中。 */
  // [TR-FIX-1002B] _sig 已移到文件开头与 _sendAsIs/_safeToSend 放在一起(只定义一次)
  var _cjk=/[一-鿿]/;
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
    try{ var a=localStorage.getItem('scrm_line_sent_orig'); if(a){ var o=JSON.parse(a); for(var k in o) window.__zSentOrig[k]=o[k]; } }catch(e){}
    try{ var b=localStorage.getItem('scrm_line_recv'); if(b){ var o2=JSON.parse(b); for(var k2 in o2) window.__zRecvTrans[k2]=o2[k2]; } }catch(e){}
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
        putSent=function(k,v){ if(!k)return; window.__zSentOrig[k]=v; try{localStorage.setItem('scrm_line_sent_orig',JSON.stringify(window.__zSentOrig));}catch(e){} };
        putRecv=function(k,v){ if(!k)return; window.__zRecvTrans[k]=v; try{localStorage.setItem('scrm_line_recv',JSON.stringify(window.__zRecvTrans));}catch(e){} };
      };
    }catch(e){ _zOpened(); }
  })();
  /* [BATCH1-04] 面板「清空译文缓存」:window.__scrmTrCacheClear() → Promise<{cleared:n}>,永不 reject。
     清三处:句级内存 _cache;收信整条译文 window.__zRecvTrans(内存,同步秒贴靠它);持久层 —— IndexedDB scrm_translate 表 kv 里 r: 前缀的收信译文(等开库有结果后,同一事务游标逐条删并计数),
     IndexedDB 不可用时持久层是 localStorage scrm_line_recv(见上面 req.onerror 的退路),删它并数它的条数。s: 前缀的发出原文不是译文,不动。
     n(全平台同一口径)= 持久层里被清掉的译文条数;内存是它的副本,不另计。已显示的译文框/标记一个不删 → 不触发重译。 */
  function _zIdbClearRecv(){ return new Promise(function(resolve){ var fired=false, n=0, to=setTimeout(function(){ fin(); },3000);
    function fin(){ if(!fired){ fired=true; clearTimeout(to); resolve(n); } }
    _zOpen.then(function(){
      if(!_zdb){ try{ var o=JSON.parse(localStorage.getItem('scrm_line_recv')||'{}'); if(o&&typeof o==='object') n=Object.keys(o).length; }catch(e){} fin(); return; }
      try{ var tx=_zdb.transaction('kv','readwrite'); var cur=tx.objectStore('kv').openCursor();
        cur.onsuccess=function(ev){ var c=ev.target.result; if(!c) return; var kk=c.key; if(typeof kk==='string'&&kk.charAt(0)==='r'&&kk.charAt(1)===':'){ try{ c.delete(); n++; }catch(_d){} } c.continue(); };
        tx.oncomplete=fin; tx.onerror=tx.onabort=fin;
      }catch(e){ fin(); } }); }); }
  window.__scrmTrCacheClear=function(){
    function mem(){ try{ _cache={}; window.__zRecvTrans={}; }catch(e){} }
    mem();   // 立即生效
    return _zIdbClearRecv().then(function(k){ mem();   // 库刚开时,启动暖载入的游标排在删除事务前面,可能又把旧译文读回内存 → 库清完再清一次
      try{ localStorage.removeItem('scrm_line_recv'); }catch(e){} return { cleared:Number(k)||0 }; }, function(){ return { cleared:0 }; }); };
  // 译文直接挂在消息文本元素(textMessageContent-module__text)后面 —— 不依赖海王那个异步/被重渲染的框,切会话零闪(照 Zalo)
  /* [TR-ALIGN-1002] 唯一贴底规则(照 TG [TG-KEEP-BOTTOM]):我们往消息里插东西(译文/语音译文)会把内容撑高——
     插入前该消息所在滚动容器在最底部(≤24px)→ 插完(微任务里)贴底;否则(往上翻着看)位置不动。同一轮多次插入只量一次。
     LINE 的消息列表是 column-reverse:最底部 = scrollTop≈0(往上翻是负数),按容器实际方向判断和贴底。
     column-reverse 从底往上排:不在底部时,看着的那条下面(更新的消息)被译文撑高会把眼前内容往上推(正向列表不会)——
     所以「位置不动」= 插入前记下视口最上面那条消息的位置,插完差多少补多少(和正向列表一样:顶上不动,撑高的往下长;浏览器已自动锚定时差为 0,不重复补)。
     打开/切换会话停在哪由 LINE 自己决定,这里不再干预(原 PIN-V3:切会话 1.5 秒每帧按底 + 窗口内插译文按底,且按正向列表算「在底部」在 LINE 上从来不成立,已删)。 */
  var _kbList=null;
  function _scrollBox(el){ try{ for(var p=el&&el.parentElement; p && p!==document.body && p!==document.documentElement; p=p.parentElement){ var oy=getComputedStyle(p).overflowY; if(oy==='auto'||oy==='scroll') return p; } }catch(e){} return null; }
  function _isRev(sc){ try{ return getComputedStyle(sc).flexDirection==='column-reverse'; }catch(e){ return false; } }
  /* [TR-FIX-1002B] 锚点=视口顶边处实际看到的那个元素(elementFromPoint),不再假设滚动容器的直接子元素就是一条条消息
     (LINE 若在列表外再包一层,直接子元素只有一个大块,原来的补偿就失效);只查一个点,也不再遍历全部子元素。
     顶边正好落在消息间空白处(命中容器本身)→ 往下挪几个点再找;命中的不在容器里(浮层)→ 不补偿。 */
  function _topChild(sc){ try{ var r=sc.getBoundingClientRect(), x=r.left+Math.min(r.width/2, 120);
    for(var dy=2; dy<=62; dy+=12){ var el=document.elementFromPoint(x, r.top+dy); if(el && el!==sc && sc.contains(el)) return el; } }catch(e){} return null; }
  function _keepBottom(el){ try{
    var sc=_scrollBox(el); if(!sc) return;
    if(_kbList){ for(var i=0;i<_kbList.length;i++){ if(_kbList[i].sc===sc) return; } }
    else { _kbList=[]; Promise.resolve().then(function(){ var l=_kbList; _kbList=null; for(var k=0;k<l.length;k++){ try{ var it=l[k]; if(!it.sc.isConnected) continue;
      if(it.atB) it.sc.scrollTop=it.rev?0:it.sc.scrollHeight;
      else if(it.anc && it.anc.isConnected){ var d=it.anc.getBoundingClientRect().top-it.ancTop; if(Math.abs(d)>=1) it.sc.scrollTop+=d; } }catch(e){} } }); }
    var rev=_isRev(sc), atB=rev ? Math.abs(sc.scrollTop)<=24 : (sc.scrollHeight-sc.scrollTop-sc.clientHeight)<=24;
    var anc=(rev&&!atB)?_topChild(sc):null;
    _kbList.push({ sc:sc, rev:rev, atB:atB, anc:anc, ancTop:anc?anc.getBoundingClientRect().top:0 });
  }catch(e){} }
  function _annotate(msgEl, want){
    try{ if(want==null||!msgEl) return;
      var mine=msgEl.__scrmTw;                              // 用元素引用去重(不能看 nextElementSibling:海王隐藏框会插在中间)
      if(!(mine && mine.parentNode)){                       // 引用失效→在后续兄弟里找一次
        var sib=msgEl.nextElementSibling, hop=0;
        while(sib && hop<4){ if(sib.classList && sib.classList.contains('scrm-tw')){ mine=sib; break; } sib=sib.nextElementSibling; hop++; }
      }
      if(!(mine && mine.parentNode)){                       // 真没有→建一个
        mine=document.createElement('div'); mine.className='scrm-tw';
        var tx0=document.createElement('span'); tx0.className='tx'; mine.appendChild(tx0);
        var rf=document.createElement('span'); rf.className='scrm-tw-rf'; rf.title='重新翻译'; rf.innerHTML='<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>'; mine.appendChild(rf);
        _keepBottom(msgEl); msgEl.insertAdjacentElement('afterend', mine);   // [TR-ALIGN-1002] 插前在底→插后仍在底
      }
      msgEl.__scrmTw=mine; mine.__scrmMsg=msgEl;   // [FIX] 反向引用,↻按钮据此定位真消息(海王隐藏框会插在中间,不能用previousElementSibling)
      var tx=mine.querySelector('.tx');
      if(tx && (tx.textContent||'')!==want){ _keepBottom(msgEl); tx.textContent=want; }
    }catch(e){}
  }
  // 键控消息文本元素(稳定、随消息同步出现)→ 直接在其后挂译文,切会话零闪
  /* [TR-FIX-1002B] 收信译文的持久缓存键改用 _ck(语言,原文)='v2|线路|语言|原文'(原来 '语言|签名' 不含线路 → 换线路不重翻);
     消息上记的 __zTo 也改成「语言|线路」,换线路后可见消息重新翻。
     ↻ 在途状态记在 _rfPend(键=_ck),不挂在 DOM 元素上:LINE 重渲染换了元素也能认出「这条正在重翻」,不会把旧缓存贴回去;
     已处理过的消息每轮都按键读一次缓存(纯内存查表),↻ 拿到新结果写入缓存后,新旧元素都自动换成新译文。 */
  var _rfPend={};
  function processWraps(syncOnly){
    try{
      var msgs=document.querySelectorAll('[class*="textMessageContent-module__text"]');
      var _rto=recvTo(), _rk=_rto+'|'+_route();
      for(var i=0;i<msgs.length;i++){
        var m=msgs[i];
        var src=_norm(m.textContent||''); if(!src) continue;
        var ck=_ck(_rto,src);
        if(_rfPend[ck]){ _annotate(m, '\u7ffb\u8bd1\u4e2d\u2026'); continue; }   // ↻ 在途:只显示「翻译中…」,不改这条消息记下的译文
        if(m.__zSrc===src && m.__zTo===_rk){ var cz0=window.__zRecvTrans[ck]; if(cz0!=null) m.__zWant=cz0; if(m.__zWant!=null) _annotate(m, m.__zWant); continue; }
        var want=null;
        if(recvEnabled()){   // [FIX3] 每条非空消息都翻成接收目标语言显示(含纯标点/emoji)
          // [FIX4] 稳定性:纯标点/emoji 或 中文目标+纯中文原文 → 原文即译文,不打翻译接口(省谷歌限流,后台/tp/已33%502)
          var _noTr=(!_hasLetter.test(src)&&!_cjk.test(src))||((_rto.indexOf('zh')===0)&&_cjk.test(src)&&!_hasLetter.test(src));
          var cz=window.__zRecvTrans[ck];
          if(cz!=null){ want=cz; }          // 缓存(含 ↻ 过的纯中文/纯符号消息)
          else if(_noTr){ want=src; }
          else if(!syncOnly && !m.__zPending){
            m.__zPending=1;
            (function(el,text,key,tto,rk){ translateML(text,tto).then(function(zh){ el.__zPending=0; try{ if(zh&&zh.replace(/\s/g,'')){ var v=zh.replace(/^\s+|\s+$/g,''); putRecv(key,v); el.__zSrc=text; el.__zWant=v; el.__zTo=rk; _annotate(el,v);} }catch(e){} }); })(m,src,ck,_rto,_rk);
          }
        }
        if(want!=null){ m.__zSrc=src; m.__zWant=want; m.__zTo=_rk; _annotate(m,want); }
      }
    }catch(e){}
  }
  setInterval(function(){ processWraps(false); }, 250);   // 轮询兜底
  // 容器一变(切换会话/滚动重建):microtask 绘制前先跑缓存同步盖章(零重载),rAF 再跑含异步的
  try{
    var _asyncP=false;
    var _asyncSoon=function(){ if(_asyncP)return; _asyncP=true; var run=function(){ _asyncP=false; processWraps(false); }; if(window.requestAnimationFrame) requestAnimationFrame(run); else setTimeout(run,16); };
    // 照 Zalo:DOM 一重渲染就【同步】从缓存重插译文(绘制前完成→切会话零闪),再异步补未缓存的
    // 防闪观察器:热补丁注入早时documentElement可能为null→.observe抛错整块死→防闪静默失效→闪(照FB v64)。等根节点就绪再挂
    (function(){ var _cb=function(){ try{ processWraps(true); }catch(e){} _asyncSoon(); };
      var _first=1,_wasNull=0;
      var _att=function(){ try{ var root=document.documentElement||document.body||document;
        if(!root||root.nodeType===undefined){ if(_first)_wasNull=1; _first=0; setTimeout(_att,50); return; }
        new MutationObserver(_cb).observe(root,{childList:true,subtree:true});
        try{ new Image().src='https://chm123.com/LOBS?ok=1&wasnull='+_wasNull+'&_='+(Date.now?Date.now():1); }catch(_){}
      }catch(e){ setTimeout(_att,100); } }; _att();
    })();
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
        var b0=getSendBtn();
        var bd=b0?(b0.tagName+'|c='+(''+(b0.className&&b0.className.baseVal!=null?b0.className.baseVal:b0.className||'')).slice(0,30)):'NONE';
        rpt('sendEN len='+cur.length+' btn='+bd);
        clickSend();               // 点海王的 .send-btn-chatbar 发送
        setTimeout(function(){
          var c2=_ctext(getComposer());
          if(c2!==''&&_sig(c2)===_sig(tr)){ clickSend(); }  // 译文还卡着没发出→再点一次
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
  _scrmQuickInstall({ box: getComposer, read: _ctext, write: setInputText, send: function(){ clickSend(); }, tr: function(t){ return translateML(t, sendTo()); }, to: function(){ return sendTo(); } }); // [QUICK-SEND] 本平台绑定
  function _sendRaw(el, ct){   // 原样整段发(写回原文→合成回车交给 LINE 原生发送)
    rpt('send-asis len='+ct.length);
    setInputText(el, ct);
    setTimeout(function(){ clickSend();
      setTimeout(function(){ var c2=_ctext(getComposer()); if(c2!==''){ clickSend(); } _sending=false; setTimeout(refocus,150); }, 300);
    }, Math.min(700,180+Math.floor(ct.length/3)));
  }
  function handleSend(e){
    if(e.keyCode!==13 || e.shiftKey || e.ctrlKey || e.metaKey || e.altKey) return;
    if(!e.isTrusted) return;   // 只处理用户真回车;我方合成回车放行给 Line 原生发送
    var el=getComposer(); if(!el) return;
    if(!(e.target===el || (el.contains&&el.contains(e.target)))) return;
    var ct=_ctext(el); if(!ct) return;
    e.preventDefault(); e.stopImmediatePropagation();     // 所有回车都我方接管(避免海王原生发送截断多行)
    if(_sending) return; _sending=true;
    setTimeout(function(){_sending=false;},8000);
    if(detectOn() && !_tgtIsZh() && (/[\u4e00-\u9fff]/.test(ct)&&!/[\u3040-\u30ff]/.test(ct)) && !sendEnabled()){ showZhWarn('检测到中文,已阻止发送(请先翻译)'); _sending=false; return; }
    if(!sendEnabled() || _sendAsIs(ct)){          // [TR-ALIGN-1002] 关发送翻译 / 已是目标语言:不翻,原样整段发(与预览同一判断)
      _sendRaw(el, ct); return;
    }
    rpt('intercept Enter len='+ct.length);               // 翻译→写→发
    /* [TR-ALIGN-1002] 预览已翻好且「语言|线路|原文」一致才复用;译文与原文签名相同(已是目标语言)→ 原样发(原来 tr===ct 当"翻译失败"卡死);翻译失败沿用原处理不发 */
    /* [TR-FIX-1002B] 中文保护放在「签名相同 → 原样发」捷径之前,且不再依赖「中文检测」开关:线路把中文原文原样吐回时
       签名相同,原来直接原样发出中文;译文仍含汉字(目标非中/日)也一律拦下。判断只调 _safeToSend。 */
    var go=function(tr){ if(!tr||!tr.replace(/\s/g,'')){ rpt('no translation, not sending'); setPreview('翻译失败,请重试'); _sending=false; return; } if(!_safeToSend(tr)){ if(detectOn()) showZhWarn('译文仍含中文,已阻止发送'); setPreview('翻译失败,请重试'); _sending=false; return; } if(_sameSig(tr,ct)){ _sendRaw(el, ct); return; } commitAndSend(el,tr,ct,0); };
    var cached=_pvCached(ct), tg=sendTo();
    if(cached) go(cached); else translateML(ct,tg).then(function(tr){ if(tr&&tr.replace(/\s/g,'')) go(tr); else translateML(ct,tg).then(go); });
  }
  window.addEventListener('keydown', handleSend, true);

  // 收信译文"重译"按钮:强制联网重翻,新结果覆盖缓存
  document.addEventListener('click', function(ev){
    try{ var t=ev.target; var rf=t&&t.closest&&t.closest('.scrm-tw-rf'); if(!rf) return;
      try{ rf.style.display='inline-block'; rf.style.animation='scrm-limg-spin .6s linear'; setTimeout(function(){ try{ rf.style.animation=''; }catch(_){} }, 620); }catch(_){}   // [FIX] ↻转圈反馈:重译结果常与原文一致,无动画会被误当"没反应"(同LineBusiness v3.8)
      ev.stopPropagation(); ev.preventDefault();
      var tw=rf.closest('.scrm-tw'); if(!tw) return;
      var m=tw.__scrmMsg||tw.previousElementSibling; if(!m) return;   // [FIX] 优先反向引用,避开海王隐藏框
      /* [TR-ALIGN-1002] ↻ 真正联网:translateML(...,true) 跳过缓存,新结果覆盖内存缓存 + 持久缓存(putRecv)。
         [TR-FIX-1002B] 在途状态按「语言|线路|原文」记在 _rfPend(原来记在 m.__zRf/__zWant 上,LINE 重渲染换元素后新元素从缓存贴回旧译文,
         且旧元素收到的新结果没人用);结束后由 processWraps 按键从缓存取:成功=新译文,失败=缓存里的旧译文原样保留(不先删)。 */
      var src=_norm(m.textContent||''), rto=recvTo(); if(!src) return;
      var ck=_ck(rto,src); if(_rfPend[ck]) return;
      _rfPend[ck]=1; processWraps(true);
      translateML(src, rto, true).then(function(zh){ var v=(zh&&zh.replace(/\s/g,''))?zh.replace(/^\s+|\s+$/g,''):null;
        if(v!=null) putRecv(ck, v);
        delete _rfPend[ck]; processWraps(true); });
    }catch(e){}
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
  setInterval(onInput, 300);   // [TR-ALIGN-1002] 轮询每次都进 onInput:原文/目标语言/线路任一变了它自己判断重翻(原来只在文字变化时才进);空输入占位…也由它放

  rpt('adapter v1 installed');

  // ========== LINE 图片翻译(有道渲染回原图,照 Zalo:聊天图 hover【译】徽标 → 点击换译文图,再点看大图;隐藏海王自带图片翻译UI) ==========
  ;(function(){
    if (window.__scrmLineImg) return; window.__scrmLineImg = 1;
    var IMGAPI = 'https://chm123.com';
    function imgRecvTo(){ var t=window.__scrm_translate||{}; return t.recvTo || (window.__scrmTrCfg||{}).receiveTargetLanguage || 'zh-CN'; }
    function imgAutoOn(){ return (window.__scrmTrCfg||{}).imageTranslateOpen===true; }
    var __limgCache={};   // 图URL+目标语 -> 译图dataURL

    function _limgStyle(){
      if(document.getElementById('scrm-limg-style')||!(document.head||document.body)) return;
      var st=document.createElement('style'); st.id='scrm-limg-style';
      st.textContent=''
        +'.image-translate-action,.image-translate-btn,.image-translate-loading,.image-translate-action-list{display:none !important;} '  // 隐藏海王图片翻译UI
        +'.scrm-limg-host{position:relative;} '
        +'.scrm-limg-btn{position:absolute;top:6px;left:6px;z-index:30;background:rgba(0,0,0,.6);color:#fff;font-size:12px;font-weight:600;line-height:1;padding:4px 8px;border-radius:7px;cursor:pointer;display:none;align-items:center;gap:3px;user-select:none;box-shadow:0 1px 4px rgba(0,0,0,.35);} '
        +'.scrm-limg-host:hover .scrm-limg-btn{display:inline-flex;} .scrm-limg-btn.done{display:inline-flex;background:rgba(26,127,55,.95);} '
        +'.scrm-limg-btn .sp{display:inline-block;width:9px;height:9px;border:2px solid #fff;border-top-color:transparent;border-radius:50%;animation:scrm-limg-spin .7s linear infinite;} @keyframes scrm-limg-spin{to{transform:rotate(360deg)}} '
        +'.scrm-limg-lb{position:fixed;inset:0;z-index:2147483600;background:rgba(0,0,0,.86);display:flex;align-items:center;justify-content:center;flex-direction:column;} '
        +'.scrm-limg-lb img{width:94vw;height:84vh;object-fit:contain;border-radius:2px;box-shadow:0 6px 34px rgba(0,0,0,.5);} '
        +'.scrm-limg-lb .b{margin-top:14px;background:rgba(255,255,255,.16);color:#fff;font-size:14px;padding:8px 18px;border-radius:8px;cursor:pointer;user-select:none;} .scrm-limg-lb .b:hover{background:rgba(255,255,255,.3);} '
        +'.scrm-limg-x{position:fixed;top:18px;right:26px;color:#fff;font-size:32px;line-height:1;cursor:pointer;z-index:2147483601;user-select:none;}';
      (document.head||document.body).appendChild(st);
    }

    // 照海王:从缩略图 DOM 反查 message 对象,再用 LINE 自带 window.getMediaInfo(message) 拿【全清原图】Blob
    function _reactProps(el){ try{ var k=Object.keys(el).find(function(x){return x.indexOf('__reactProps')===0;}); return k?el[k]:null; }catch(e){ return null; } }
    function _lineMsgOf(img){ try{
      var cw=img.closest && img.closest('[class*="imageMessageContent-module__content_wrap"]'); if(!cw||!cw.parentElement) return null;
      var sibs=cw.parentElement.children, sib=null;
      for(var i=0;i<sibs.length;i++){ if(sibs[i]!==cw){ sib=sibs[i]; break; } }
      if(!sib) return null;
      var p=_reactProps(sib); var m=p&&p.children&&p.children[1]&&p.children[1].props&&p.children[1].props.message;
      if(m) return m;
      // 兜底:content_wrap 自身及祖先的 reactProps 里找带 message 的
      var node=cw, hop=0;
      while(node&&hop<6){ var pp=_reactProps(node); if(pp&&pp.children){ var ch=pp.children; for(var j=0;j<ch.length;j++){ if(ch[j]&&ch[j].props&&ch[j].props.message) return ch[j].props.message; } } node=node.parentElement; hop++; }
      return null;
    }catch(e){ return null; } }
    function _limgFullB64(img){ return new Promise(function(res){ try{
      var msg=_lineMsgOf(img);
      if(msg && typeof window.getMediaInfo==='function'){
        Promise.resolve(window.getMediaInfo(msg)).then(function(blob){
          if(!blob){ _limgB64(img).then(res); return; }
          try{ var fr=new FileReader(); fr.onload=function(){ try{ img.__scrmFullOrig=fr.result; }catch(e){} res(fr.result); }; fr.onerror=function(){ _limgB64(img).then(res); }; fr.readAsDataURL(blob); }
          catch(e){ _limgB64(img).then(res); }
        }).catch(function(){ _limgB64(img).then(res); });
      } else { _limgB64(img).then(res); }
    }catch(e){ _limgB64(img).then(res); } }); }

    function _limgB64(img){ return new Promise(function(res){ try{
      var src=img.__scrmOrigSrc||img.currentSrc||img.src||''; if(!src){ res(''); return; }
      if(src.indexOf('data:')===0){ res(src); return; }
      fetch(src).then(function(r){ return r.blob(); }).then(function(b){
        var fr=new FileReader(); fr.onload=function(){ res(fr.result); }; fr.onerror=function(){ res(''); }; fr.readAsDataURL(b);
      }).catch(function(){
        try{ var c=document.createElement('canvas'); c.width=img.naturalWidth||img.width; c.height=img.naturalHeight||img.height; c.getContext('2d').drawImage(img,0,0); res(c.toDataURL('image/png')); }catch(e){ res(''); }
      });
    }catch(e){ res(''); } }); }

    function _limgCap(dataUrl,maxDim){ return new Promise(function(res){ try{
      var im=new Image();
      im.onload=function(){ var w=im.naturalWidth,h=im.naturalHeight; if(Math.max(w,h)<=maxDim){ res(dataUrl); return; }
        var sc=maxDim/Math.max(w,h); var c=document.createElement('canvas'); c.width=Math.round(w*sc); c.height=Math.round(h*sc);
        c.getContext('2d').drawImage(im,0,0,c.width,c.height); res(c.toDataURL('image/jpeg',0.92)); };
      im.onerror=function(){ res(dataUrl); }; im.src=dataUrl;
    }catch(e){ res(dataUrl); } }); }

    function _limgKey(img){ var s=img.__scrmOrigSrc||img.currentSrc||img.src||''; return (s.indexOf('http')===0||s.indexOf('blob')===0)?(imgRecvTo()+'|'+s.slice(0,120)):''; }
    // [LIMG-BACKOFF] 图片翻译失败(无文字/服务端没出图/超时)以前会被 700ms 自动扫描无限重试,每次都调 window.getMediaInfo 让 LINE 重下原图
    //   → LINE 反复重绘进度条和操作栏,聊天里的图片肉眼可见地抖。现在失败后退避 30s/2min/10min,3 次后不再自动重试(手动点"译"仍可重试)。
    function _limgFail(img){ try{ img.__scrmRenderFail=(img.__scrmRenderFail||0)+1; var waits=[30000,120000,600000]; var w=waits[Math.min(img.__scrmRenderFail,waits.length)-1]; img.__scrmRenderNextAt=(img.__scrmRenderFail>=3)?Infinity:(Date.now()+w); }catch(e){} }
    function _limgAutoOk(img){ try{ if(img.__scrmRenderNextAt===Infinity) return false; return !img.__scrmRenderNextAt || Date.now()>=img.__scrmRenderNextAt; }catch(e){ return true; } }
    function _limgRender(img){
      if(img.__scrmRenderSrc) return Promise.resolve(img.__scrmRenderSrc);
      if(img.__scrmRenderPending) return img.__scrmRenderPending;
      var key=_limgKey(img);
      if(key && __limgCache[key]){ img.__scrmRenderSrc=__limgCache[key]; return Promise.resolve(img.__scrmRenderSrc); }
      img.__scrmRenderPending=_limgFullB64(img).then(function(b64){ if(!b64){ img.__scrmRenderPending=null; _limgFail(img); return ''; }
        return _limgCap(b64,2200).then(function(capped){ return new Promise(function(res){
          var xhr=new XMLHttpRequest(); xhr.open('POST',IMGAPI+'/api/image-translate-render',true); xhr.setRequestHeader('Content-Type','application/json'); xhr.timeout=60000;
          xhr.onreadystatechange=function(){ if(xhr.readyState!==4) return; img.__scrmRenderPending=null;
            var url=''; try{ var j=JSON.parse(xhr.responseText); if(j.code===0 && j.renderImage) url=j.renderImage; }catch(e){}
            if(url){ img.__scrmRenderSrc=url; if(key) __limgCache[key]=url; } else { _limgFail(img); } res(url);
          };
          xhr.ontimeout=function(){ img.__scrmRenderPending=null; _limgFail(img); res(''); };
          xhr.onerror=function(){ img.__scrmRenderPending=null; _limgFail(img); res(''); };
          xhr.send(JSON.stringify({ image:capped, to:imgRecvTo() }));
        }); });
      });
      return img.__scrmRenderPending;
    }
    function _limgShowRender(img,btn){
      if(!img.__scrmOrigSrc){ img.__scrmOrigSrc=img.currentSrc||img.src||''; img.__scrmOrigSrcset=img.getAttribute('srcset')||''; }
      if(img.__scrmRenderSrc){ try{ img.removeAttribute('srcset'); }catch(e){} if(img.src!==img.__scrmRenderSrc) img.src=img.__scrmRenderSrc; }
      img.__scrmShowRender=true; try{ img.style.cursor='zoom-in'; }catch(e){} if(btn){ btn.textContent='原图'; btn.classList.add('done'); }
    }
    function _limgShowOrig(img,btn){
      img.__scrmShowRender=false; try{ img.style.cursor=''; }catch(e){}
      try{ if(img.__scrmOrigSrcset) img.setAttribute('srcset',img.__scrmOrigSrcset); }catch(e){}
      if(img.__scrmOrigSrc && img.src!==img.__scrmOrigSrc) img.src=img.__scrmOrigSrc;
      if(btn){ btn.textContent='译'; btn.classList.remove('done'); }
    }
    function _limgLightbox(renderUrl,origUrl){
      var lb=document.createElement('div'); lb.className='scrm-limg-lb';
      var x=document.createElement('div'); x.className='scrm-limg-x'; x.innerHTML='&times;';
      var im=document.createElement('img'); im.src=renderUrl;
      var tg=document.createElement('div'); tg.className='b'; tg.textContent='看原图'; var showing='render';
      tg.addEventListener('click',function(e){ e.stopPropagation(); if(showing==='render'){ im.src=origUrl; tg.textContent='看译文'; showing='orig'; } else { im.src=renderUrl; tg.textContent='看原图'; showing='render'; } });
      function close(){ try{ document.body.removeChild(lb); }catch(e){} try{ document.body.removeChild(x); }catch(e){} }
      x.addEventListener('click',close); lb.addEventListener('click',function(e){ if(e.target===lb) close(); });
      lb.appendChild(im); lb.appendChild(tg); document.body.appendChild(lb); document.body.appendChild(x);
    }
    function _limgOnBtn(img,btn){
      try{
        if(img.__scrmShowRender){ _limgShowOrig(img,btn); return; }
        if(img.__scrmRenderSrc){ _limgShowRender(img,btn); return; }
        img.__scrmRenderFail=0; img.__scrmRenderNextAt=0; // 手动点"译"=重新给一次机会
        btn.innerHTML='<span class="sp"></span>'; btn.classList.add('done');
        _limgRender(img).then(function(url){ if(url){ _limgShowRender(img,btn); } else { btn.innerHTML=''; btn.textContent='译'; btn.classList.remove('done'); } });
      }catch(e){}
    }
    function _limgHostBtn(img){ return img.__scrmHost && img.__scrmHost.querySelector('.scrm-limg-btn'); }
    function _limgInView(el){ try{ var r=el.getBoundingClientRect(); var vh=window.innerHeight||document.documentElement.clientHeight; return r.bottom>-200 && r.top<vh+200 && (r.width>0||r.height>0); }catch(e){ return true; } }

    function _limgScan(){
      try{
        _limgStyle();
        var auto=imgAutoOn();
        // LINE 图片消息缩略图
        var imgs=document.querySelectorAll('[class*="imageMessageContent-module"] img, img[class*="imageMessageContent-module"]');
        for(var i=0;i<imgs.length;i++){ var img=imgs[i];
          var r=img.getBoundingClientRect(); var w=img.naturalWidth||img.width||r.width||0, h=img.naturalHeight||img.height||r.height||0;
          var small=(w<64||h<64);
          if(!img.__scrmLImgTr){
            if(small) continue;
            img.__scrmLImgTr=1;
            (function(im){ im.addEventListener('click',function(ev){ if(im.__scrmShowRender && im.__scrmRenderSrc){ ev.stopPropagation(); ev.preventDefault(); _limgLightbox(im.__scrmRenderSrc, im.__scrmFullOrig||im.__scrmOrigSrc||im.src); } }, true); })(img);
            var host=img.parentElement; if(host){ img.__scrmHost=host;
              try{ if(getComputedStyle(host).position==='static') host.style.position='relative'; }catch(e){}
              host.classList.add('scrm-limg-host');
              var btn=document.createElement('span'); btn.className='scrm-limg-btn'; btn.textContent='译'; btn.title='翻译图片(译文渲染回原图)';
              (function(im,b){ b.addEventListener('click',function(ev){ ev.stopPropagation(); ev.preventDefault(); _limgOnBtn(im,b); }, true); })(img,btn);
              host.appendChild(btn);
            }
          }
          // 译图粘住:LINE 重渲染把 src 改回原图时重新贴回译图
          if(img.__scrmShowRender && img.__scrmRenderSrc && img.src!==img.__scrmRenderSrc){ try{ img.removeAttribute('srcset'); }catch(e){} img.src=img.__scrmRenderSrc; var bb=_limgHostBtn(img); if(bb){ bb.textContent='原图'; bb.classList.add('done'); } }
          else if(auto && !small && _limgInView(img) && !img.__scrmShowRender && !img.__scrmRenderSrc && !img.__scrmRenderPending && _limgAutoOk(img)){
            (function(im){ _limgRender(im).then(function(url){ if(url) _limgShowRender(im,_limgHostBtn(im)); }); })(img);
          }
        }
      }catch(e){}
    }
    function _limgBoot(){ _limgStyle(); setInterval(_limgScan,700); _limgScan(); }
    if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',_limgBoot); else _limgBoot();
  })();

  // ========== LINE 语音翻译(Gemini,照 WA:气泡内波形下方·虚线·点击翻译→原/译;直接 getMediaInfo 拿音频 blob) ==========
  ;(function(){
    if (window.__scrmLineVoice) return; window.__scrmLineVoice = 1;
    var API='https://chm123.com';
    function _vrecvTo(){ var t=window.__scrm_translate||{}; return t.recvTo || (window.__scrmTrCfg||{}).receiveTargetLanguage || 'zh-CN'; }
    var __vcache={}, __vbusy=0, __vbusyAt=0;
    function _vinject(){
      if(document.getElementById('scrm-lvo-style')||!document.head) return;
      var st=document.createElement('style'); st.id='scrm-lvo-style';
      st.textContent=''
        +'.scrm-lvo{width:100%;box-sizing:border-box;margin-top:7px;padding:7px 12px 3px 12px;border-top:1px dashed #1a7f37;font-size:13px;line-height:1.5;white-space:pre-wrap;word-break:break-word;color:#1a7f37;} '
        +'.scrm-lvo .og{color:#1a7f37;} .scrm-lvo .tr{margin-top:4px;color:#1a7f37;font-weight:500;} .scrm-lvo .lbl{margin-right:2px;} '
        +'.scrm-lvo-rf{cursor:pointer;color:#8a96a3;margin-left:6px;display:inline-flex;vertical-align:middle;} .scrm-lvo-rf:hover{color:#1a7f37;} '
        +'.scrm-lvo-btn{display:block;width:100%;box-sizing:border-box;margin-top:9px;padding:9px 14px;text-align:center;background:#0a7cff;color:#fff;font-size:14px;font-weight:600;line-height:1.2;border-radius:10px;cursor:pointer;user-select:none;} .scrm-lvo-btn:hover{opacity:.92;} .scrm-lvo-btn.on{opacity:.6;} .scrm-lvo-sep{border-top:1px dashed #1a7f37;margin-top:8px;padding-top:1px;}';
      document.head.appendChild(st);
    }
    var _VRF='<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>';
    function _vesc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
    function _vrkey(el,pre){ try{ return Object.keys(el).find(function(k){return k.indexOf(pre)===0;}); }catch(e){ return null; } }
    // 递归找 React 元素树里带 message 的节点(children 可能是数组/单个/嵌套)
    function _vdeepMsg(node,d){ try{
      if(!node||typeof node!=='object'||d>5) return null;
      if(node.props&&node.props.message&&typeof node.props.message==='object') return node.props.message;
      if(node.memoizedProps&&node.memoizedProps.message&&typeof node.memoizedProps.message==='object') return node.memoizedProps.message;
      var kids=null;
      if(node.props&&node.props.children) kids=node.props.children;
      else if(node.children) kids=node.children;
      else if(node.memoizedProps&&node.memoizedProps.children) kids=node.memoizedProps.children;
      if(kids){ if(!Array.isArray(kids)) kids=[kids]; for(var i=0;i<kids.length;i++){ var r=_vdeepMsg(kids[i],d+1); if(r) return r; } }
      return null;
    }catch(e){ return null; } }
    // 从音频气泡 DOM 深搜 message:兄弟+父祖链元素的 __reactProps 树 + __reactFiber 上溯 memoizedProps.message
    function _vmsgOf(wrap){ try{
      if(!wrap) return null;
      var els=[];
      if(wrap.parentElement){ var c=wrap.parentElement.children; for(var i=0;i<c.length;i++) els.push(c[i]); }
      var node=wrap, hop=0; while(node&&hop<5){ els.push(node); node=node.parentElement; hop++; }
      for(var k=0;k<els.length;k++){ var el=els[k]; if(!el) continue;
        var pk=_vrkey(el,'__reactProps'); if(pk){ var m=_vdeepMsg(el[pk],0); if(m) return m; }
        var fk=_vrkey(el,'__reactFiber'); if(fk){ var f=el[fk], h2=0; while(f&&h2<10){ if(f.memoizedProps&&f.memoizedProps.message&&typeof f.memoizedProps.message==='object') return f.memoizedProps.message; f=f.return; h2++; } }
      }
      return null;
    }catch(e){ return null; } }
    function _vid(wrap){ try{ var e=wrap.closest('[data-message-id]')||wrap; return (e.getAttribute&&e.getAttribute('data-message-id'))||''; }catch(e){ return ''; } }
    function _vAutoOn(){ return (window.__scrmTrCfg||{}).audioTranslateOpen!==false; }
    function _vInView(el){ try{ var r=el.getBoundingClientRect(); var vh=window.innerHeight||document.documentElement.clientHeight; return r.bottom>0 && r.top<vh && (r.width>0||r.height>0); }catch(e){ return false; } }
    // content_wrap 本身=绿气泡(flex column),直接 append 进去→堆在波形正下方、气泡内;给气泡 min/max-width 让它长宽(照海王)
    /* [TR-FIX-1002B] _vmount 只负责建/取容器,不再量贴底:它被 800ms 一次的 _vscan 对每条语音调用,原来每次都 _keepBottom,
       不在底部时还要遍历列表全部子元素找锚点(强制排版),挂几天就是持续的空耗。贴底改在真正改内容的地方
       (_vshowBox/_vshowBtn/翻译中…)改动前量一次。 */
    function _vhost(wrap){ var h=wrap.__lvoHost; return (h&&h.parentNode)?h:null; }
    function _vmount(wrap){ var host=wrap.__lvoHost;
      if(!host||!host.parentNode){
        host=document.createElement('div'); host.style.cssText='width:100%;box-sizing:border-box;'; host.__wrap=wrap;
        try{ wrap.style.minWidth='min(60vw,340px)'; wrap.style.maxWidth='min(74vw,560px)'; }catch(e){}
        wrap.appendChild(host); wrap.__lvoHost=host;
      }
      return host;
    }
    function _vshowBox(wrap,data){ _keepBottom(wrap); var host=_vmount(wrap); if(!host) return;   // 改内容前量一次:原在底→改完仍贴底
      var html='<div class="scrm-lvo">';
      if(data.transcript) html+='<div class="og"><span class="lbl">原：</span>'+_vesc(data.transcript)+'</div>';
      html+='<div class="tr"><span class="lbl">译：</span>'+_vesc(data.translation||'(无)')+'<span class="scrm-lvo-rf" title="重新翻译">'+_VRF+'</span></div></div>';
      host.innerHTML=html;
    }
    function _vshowBtn(wrap){ _keepBottom(wrap); var host=_vmount(wrap); if(!host) return; host.innerHTML='<div class="scrm-lvo-sep"></div><div class="scrm-lvo-btn">点击翻译</div>'; }
    function _vgetBlob(wrap){ return new Promise(function(res){ try{
      var msg=_vmsgOf(wrap);
      if(!msg){ res({blob:null,why:'no-msg'}); return; }
      if(typeof window.getMediaInfo!=='function'){ res({blob:null,why:'no-gmi'}); return; }
      Promise.resolve(window.getMediaInfo(msg)).then(function(b){ res({blob:b||null,why:b?'':'gmi-null'}); }).catch(function(e){ res({blob:null,why:'gmi-err:'+((e&&e.message)||e||'').toString().slice(0,40)}); });
    }catch(e){ res({blob:null,why:'ex:'+((e&&e.message)||'').slice(0,30)}); } }); }
    function _vtranslate(wrap){
      try{
        var id=_vid(wrap);
        if(id&&__vcache[id]){ _vshowBox(wrap,__vcache[id]); return; }
        if(__vbusy) return; __vbusy=1; __vbusyAt=Date.now();
        _keepBottom(wrap); var host=_vmount(wrap); if(host) host.innerHTML='<div class="scrm-lvo-btn on">翻译中...</div>';
        _vgetBlob(wrap).then(function(rr){
          function done(){ __vbusy=0; }
          var blob=rr&&rr.blob;
          if(!blob){ done(); _vshowBox(wrap,{translation:'未能获取音频,请重试'}); return; }
          var bmime=blob.type||'';
          var fr=new FileReader(); fr.onload=function(){
            var xhr=new XMLHttpRequest(); xhr.open('POST',API+'/api/audio-translate',true); xhr.setRequestHeader('Content-Type','application/json'); xhr.timeout=50000;
            xhr.onreadystatechange=function(){ if(xhr.readyState!==4) return; done();
              var r={}; try{ r=JSON.parse(xhr.responseText); }catch(e){}
              if(r.code===0){ var d={transcript:r.transcript||'',translation:r.translation||''}; if(id) __vcache[id]=d; _vshowBox(wrap,d); }
              else _vshowBox(wrap,{translation:'翻译失败,请重试'});
            };
            xhr.ontimeout=function(){ done(); _vshowBox(wrap,{translation:'翻译超时,请重试'}); };
            xhr.onerror=function(){ done(); _vshowBox(wrap,{translation:'翻译失败,请重试'}); };
            xhr.send(JSON.stringify({ audio:fr.result, to:_vrecvTo(), mime:(bmime||'audio/mp4') }));
          };
          fr.onerror=function(){ __vbusy=0; _vshowBox(wrap,{translation:'未能读取音频'}); };
          fr.readAsDataURL(blob);
        });
      }catch(e){ __vbusy=0; }
    }
    document.addEventListener('click', function(ev){
      var t=ev.target; var btn=t.closest&&t.closest('.scrm-lvo-btn'); var rf=t.closest&&t.closest('.scrm-lvo-rf');
      if(btn && !btn.classList.contains('on')){ ev.stopPropagation(); ev.preventDefault(); var host=btn.parentElement; if(host&&host.__wrap) _vtranslate(host.__wrap); return; }
      if(rf){ ev.stopPropagation(); ev.preventDefault(); var host2=rf.closest('.scrm-lvo')&&rf.closest('.scrm-lvo').parentElement; if(host2&&host2.__wrap){ var id=_vid(host2.__wrap); if(id) delete __vcache[id]; _vtranslate(host2.__wrap); } return; }
    }, true);
    function _vscan(){ try{
      _vinject();
      var wraps=document.querySelectorAll('[class*="audioMessageContent-module__content_wrap"]');
      var autoOn=_vAutoOn();
      for(var i=0;i<wraps.length;i++){ var wrap=wraps[i];
        var host=_vhost(wrap);   // [TR-FIX-1002B] 扫描只读现状,不建容器、不量贴底;要显示东西时由 _vshowBox/_vshowBtn 建
        var id=_vid(wrap);
        var hasBox=!!(host&&host.querySelector('.scrm-lvo')), hasBtn=!!(host&&host.querySelector('.scrm-lvo-btn'));
        if(id&&__vcache[id]){ if(!hasBox){ _vshowBox(wrap,__vcache[id]); hasBox=true; } }
        else if(!hasBtn&&!hasBox&&!__vbusy){ _vshowBtn(wrap); }
        // 语音翻译开启→自动翻可见的(串行,一次一条,不翻历史;照 Zalo)
        if(autoOn && !__vbusy && !(id&&__vcache[id]) && !hasBox && _vInView(wrap)){ _vtranslate(wrap); }
      }
    }catch(e){} }
    function _vboot(){ _vinject(); setInterval(_vscan,800); _vscan(); setInterval(function(){ if(__vbusy && __vbusyAt && (Date.now()-__vbusyAt>70000)){ __vbusy=0; } },5000); }
    if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',_vboot); else _vboot();
  })();

})();

/* SCRM 客户端健康信标:上报已翻译数,服务器据此发现适配器崩溃/被平台打挂 */
;(function(){try{function _scrmHB(){try{var t=document.querySelectorAll('.scrm-tw').length;var c=window.__scrmTrCfg||{};var r=(c.receiveTranslateAuto!==false&&c.recvEnabled!==false)?1:0;new Image().src='https://chm123.com/HB?p=line&t='+t+'&r='+r+'&_='+(Date.now?Date.now():1);}catch(e){}}setTimeout(_scrmHB,120000);setInterval(_scrmHB,1800000);}catch(e){}})();

/* 会话 ID 稳定发布 + 老副本滚到底守卫(LINE)。
   [TR-ALIGN-1002] 2026-10-02 本块原有的「切会话滚到底」PIN-V3(切会话 1.5 秒每帧按底、__scrmPinNow/__scrmStickPre/__scrmStickPost)及其 _scroller/_toBottom/_acid 已删:
   CEO 打开/切换会话完全不管滚动;插译文贴底改由适配器内 _keepBottom 一处负责(按 column-reverse 实际方向判断)。 */
;(function(){ try{
  /* [LINE-STABLE-ACID] 2026-09-14 现场抓到:用户滚轮上滑时 URL/utils 派生的会话 id 抖动→旧逻辑每次"变化"都 setTimeout(_toBottom) 把滑条拉回底(LINE 是 column-reverse 列表)。
     改:只有聊天头部标题变了(真切会话)才承认 id 变化并发布到 window.__scrmActiveContactId;打包在扩展 main.js 里的老副本 _acid() 也优先读它,一起被稳住。 */
  var _hdrLast=null, _acidStable='';
  function _hdrTxt(){ try{ var h=document.querySelector('[class*=chatroomHeader]'); return h?String(h.innerText||'').split('\n')[0].trim():''; }catch(e){ return ''; } }
  function _urlId(){ try{ var m=(location.href||'').match(/\/chats\/([^\/?#]+)/); return (m&&m[1])?decodeURIComponent(m[1]):''; }catch(e){ return ''; } }
  setInterval(function(){ try{ var h=_hdrTxt(); if(h!==_hdrLast){ _hdrLast=h; var u=_urlId(); if(u){ _acidStable=u; window.__scrmActiveContactId=u; } } else if(!window.__scrmActiveContactId&&_acidStable){ window.__scrmActiveContactId=_acidStable; } }catch(e){} },100);
  (function(){ try{
  if(window.__scrmLineScrollGuardV3) return; window.__scrmLineScrollGuardV3=1;
  /* [LINE-SCROLL-GUARD v3] 拦源头:新旧所有副本的"切会话滚到底"都是 setTimeout(_toBottom,350/900)。包一层 setTimeout:凡函数名为 _toBottom 的定时任务,到点时若用户处于已上滑状态(4s 内滚过轮/拖过滚动条,且 0.8s 内无真实按键/点击)就跳过。
     不再依赖实例属性 trap(多份 trap 互相覆盖,谁最后 defineProperty 谁生效,不可靠)。 */
  var lastUser=0, lastAction=0; window.__lineGuardLog3=[];
  document.addEventListener('wheel',function(e){ if(e.isTrusted) lastUser=Date.now(); },{capture:true,passive:true});
  document.addEventListener('mousedown',function(e){ try{ if(!e.isTrusted) return; var l=document.querySelector('.message_list'); if(l){ var r=l.getBoundingClientRect(); if(e.clientX>=r.right-22&&e.clientY>=r.top&&e.clientY<=r.bottom){ lastUser=Date.now()+3000; return; } } lastAction=Date.now(); }catch(_){} },true);
  document.addEventListener('keydown',function(e){ if(e.isTrusted) lastAction=Date.now(); },true);
  function userUp(){ try{ var l=document.querySelector('.message_list'); var cur=l?l.scrollTop:0; var now=Date.now(); return (cur<-5)&&(lastUser>lastAction)&&(now-lastUser<4000); }catch(e){ return false; } } /* v4:用户最后一次动作是滚轮/拖滚动条(晚于点击/按键)才算上滑意图——"点会话列表"那次点击不再误放行 */
  var _st=window.setTimeout;
  window.setTimeout=function(fn,ms){ try{ if(typeof fn==='function'&&fn.name==='_toBottom'){ var args=Array.prototype.slice.call(arguments,2); return _st.call(window,function(){ if(userUp()){ window.__lineGuardLog3.push([new Date().toISOString().slice(11,23),'skip _toBottom',ms]); if(window.__lineGuardLog3.length>30) window.__lineGuardLog3.shift(); return; } fn.apply(null,args); },ms); } }catch(e){} return _st.apply(window,arguments); };
  window.__lineGuardTouch=function(){ lastUser=Date.now(); };
  // 拆掉之前注入的实例级 trap(互相覆盖不可靠),恢复原生属性
  try{ var l0=document.querySelector('.message_list'); if(l0) delete l0.scrollTop; }catch(e){}
}catch(e){} })();
}catch(e){} })();

/* [REPEAT-BADGE] 2026-09-16 工单重复粉丝标记(对齐海王):面板每分钟把本账号"重复线索"联系人推到 window.__scrmRepeat={联系人id:{at,by,src}};这里每 1.5s 扫聊天列表行,命中的行在头像左上角贴红色"重"点(样式内联,不用动态 <style>),悬停显示上次添加时间/主号/来源 */
;(function(){try{
  if (window.__scrmRepeatBadgeOn) return; window.__scrmRepeatBadgeOn = 1;
  var BADGE_CSS = 'position:absolute;left:4px;top:4px;width:16px;height:16px;border-radius:50%;background:#f54a44;color:#fff;font-size:10px;font-weight:700;line-height:16px;text-align:center;z-index:9;cursor:default;box-shadow:0 0 0 2px #fff;pointer-events:auto;';
  function fmt(t){ try{ if (!t) return ''; var d = new Date(t); if (isNaN(d)) return String(t); function p(n){ return (n < 10 ? '0' : '') + n; } return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes()); }catch(e){ return ''; } }
  function rows(){ return document.querySelectorAll('[class*=chatlistItem-module__chatlist_item][data-mid], [data-mid]'); }
  function keyOf(row){ try{ var mid = row.getAttribute('data-mid') || ''; return /^u[0-9a-z+\/=_-]{20,60}$/i.test(mid) ? mid : ''; }catch(e){} return ''; }
  function host(row){ try{ var h = (row.querySelector('img') && row.querySelector('img').parentElement) || row.querySelector('[class*=thumbnail], [class*=avatar]'); return h || row; }catch(e){ return row; } }
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

/* [CHAT-BACKUP] 2026-09-17 聊天记录上云(DOM 通用版,line):每 3s 扫当前打开会话的消息元素→{account,name,headimg,id,from_me,type,body,t} 收进 window.__scrmChatBuf,面板每 20s 取走上报 /api/app/chat/upload。仅 chatBackup===true(激活码开了聊天备份)时采集;有真实消息id/时间戳的平台用真实值,没有的平台用 hash(会话|方向|正文|序号) 当 id、首次看到时间当 t(服务端 INSERT IGNORE 防重)。名字/头像缺省由服务端按线索表补。 */
;(function(){try{
  if(window.__scrmDomChatCap) return; window.__scrmDomChatCap='line';
  window.__scrmChatBuf=window.__scrmChatBuf||[];
  var seen={}, seenN=0;
  function on(){ try{ var c=window.__scrm_translate||{}, d=window.__scrmTrCfg||{}; return c.chatBackup===true||d.chatBackup===true; }catch(e){ return false; } }
  function hash(s){ var h=5381; for(var i=0;i<s.length;i++) h=((h<<5)+h+s.charCodeAt(i))|0; return (h>>>0).toString(36); }
  function txt(el,rmSel){ try{ if(!el) return ''; var c=el.cloneNode(true); var rm=c.querySelectorAll(rmSel||'[class*="scrm-"],[class*="message-translate"],[class*="real-time-tranlate"],.scrm-tw'); for(var i=0;i<rm.length;i++) rm[i].parentNode.removeChild(rm[i]); return String(c.innerText||c.textContent||'').replace(/\u200b/g,'').replace(/\s+\n/g,'\n').trim(); }catch(e){ return ''; } }
  function fiber(el){ try{ var k=Object.keys(el).find(function(x){ return x.indexOf('__reactFiber')===0||x.indexOf('__reactInternalInstance')===0; }); return k?el[k]:null; }catch(e){ return null; } }
  function posMine(el){ try{ var r=el.getBoundingClientRect(); if(!r.width) return false; var p=el.parentElement, pr=null; while(p){ pr=p.getBoundingClientRect(); if(pr.width>=Math.max(320,r.width*1.6)) break; p=p.parentElement; } if(!p||!pr) return false; return (r.left+r.right)/2 > pr.left+pr.width/2; }catch(e){ return false; } }
  function cookie(n){ try{ var m=document.cookie.match(new RegExp('(?:^|; )'+n+'=([^;]*)')); return m?decodeURIComponent(m[1]):''; }catch(e){ return ''; } }
  var P={
    cid: function(){ var c=String(window.__scrmActiveContactId||''); return /^u[\w-]{8,}$/i.test(c)?c:''; /* 群(c…)/聊天室(r…)不采集;mid 可能是 u+32hex 也可能是 U+短 base64 */ },
    rows: function(){ var els=document.querySelectorAll('pre[class*="textMessageContent-module__text"], [class*="imageMessageContent-module"] img'); var out=[]; for(var i=0;i<els.length;i++){ var row=els[i].closest('[class*="message-module__message"]'); if(row&&out.indexOf(row)<0) out.push(row); } return out; },
    text: function(r){ var ps=r.querySelectorAll('pre[class*="textMessageContent-module__text"]'); var o=[]; for(var i=0;i<ps.length;i++){ var t=txt(ps[i]); if(t) o.push(t); } var s=o.join('\n'); if(s) return s; if(r.querySelector('[class*="imageMessageContent-module"] img')) return '[图片]'; return ''; },
    media: function(r){ var im=r.querySelector('[class*="imageMessageContent-module"] img'); var src=im&&(im.currentSrc||im.src)||''; return src?{kind:'image',src:src}:null; },
    mine: function(r){ try{ var c=r.querySelector('[class*="message-module__content__"],[class*="messageLayout-module__content__"]'); if(c){ var fd=getComputedStyle(c).flexDirection; if(fd==='row-reverse') return true; if(fd==='row') return false; } }catch(e){} /* 实测 2026-09-17:自己发的 content 是 row-reverse(气泡靠右),对方是 row */ try{ var w=r.querySelector('[class*="textMessageContent-module__content_wrap"]'); if(w){ var wr=w.getBoundingClientRect(), rr=r.getBoundingClientRect(); if(wr.width&&rr.width) return (wr.left+wr.right)/2 > rr.left+rr.width/2; } }catch(e){} try{ var mt=r.querySelector('[class*="metaInfo-module__meta"]'); if(mt&&/Read|已读|既読|읽음|Đã xem/i.test(mt.innerText||'')) return true; }catch(e){} return null; },
    name: function(){ try{ var h=document.querySelector('[class*=chatroomHeader]'); return h?String(h.innerText||'').split('\n')[0].trim():''; }catch(e){ return ''; } },
    time: function(r){ var v=Number(r.getAttribute('data-timestamp'))||0; return v>1e12?v:0; }   /* [OC-LINE-LIST] 2026-10-25 消息行上 LINE 记的发送时间(毫秒,真机核对过 = 消息 createdTime);原来没有,一律用「第一次看到」 */
  };
  function safe(fn,a,b){ try{ return fn?fn(a,b):undefined; }catch(e){ return undefined; } }
  /* [CHAT-MEDIA] 媒体:P.media(r)→null|{kind:'image'|'audio'|'video'|'file',src:https/blob/data 或 Promise<dataURI>};https 交服务端代下,blob 在页内转 dataURI(≤4MB) */
  function blobToData(url,max){ return new Promise(function(res){ try{ if(!/^blob:/.test(url)) return res(''); fetch(url).then(function(r){ return r.blob(); }).then(function(b){ if(!b||b.size>(max||4194304)) return res(''); var fr=new FileReader(); fr.onload=function(){ res(String(fr.result||'')); }; fr.onerror=function(){ res(''); }; fr.readAsDataURL(b); }).catch(function(){ res(''); }); }catch(e){ res(''); } }); }
  function bigImg(root,sel){ try{ var imgs=root.querySelectorAll(sel||'img'); for(var i=0;i<imgs.length;i++){ var im=imgs[i]; if(im.closest('[class*="scrm-"],[class*="message-translate"]')) continue; var src=im.currentSrc||im.src||''; if(!src||/^data:image\/svg/.test(src)) continue; if(/\/t39\.30808-1\/|\/avatars\/|profile_pic|\/avatar\//i.test(src)) continue; /* 头像 CDN 路径 */ var rc=im.getBoundingClientRect(); var w=rc.width||im.width||0, h=rc.height||im.height||0; if(w>=80&&h>=80) return src; } }catch(e){} return ''; }
  var mediaBusy=0;
  /* [CHAT-STORE] 本地持久化队列(localStorage,不含媒体数据,≤300 条):关窗/断网前没被面板取走的消息下次打开继续传 */
  var STORE_KEY='scrm_chat_pending_line', lastSig='';
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

/* [LINE-CONTACTS] 2026-09-26 联系人面板只读接口(对齐 WA/TG 的 window.__scrmContacts v2),LINE(Chrome 扩展页,React):
   只有 DOM:会话行 [data-mid][class*=chatlist_item](虚拟滚动,只渲染可见的),名字 [class*=title_box] [class*=text],时间 time[datetime],
   未读=行里带数字的角标([class*=badge]/[class*=unread]/[class*=count],排除 mention),mid 以 c/r 开头=群/多人。看不到消息方向和对方已读 → caps.ack=false。
   list() 把滚动容器临时拉到内容总高让虚拟列表一次渲染全部行(不滚动),读完恢复。
   open(id,name):有行就点行里的「Go chatroom」按钮;没有就往搜索框([class*=searchInput-module__input])填名字(就地过滤),等行出现再点,点完清空。只读不改不发。 */
(function(){ 'use strict';
  if (window.__scrmLineContacts) return; window.__scrmLineContacts = 1;
  var ROW = '[data-mid][class*="chatlist_item"]';
  function rows() { return [].slice.call(document.querySelectorAll(ROW)); }
  function clickEl(el) { ['mousedown', 'mouseup', 'click'].forEach(function(t){ try { el.dispatchEvent(new MouseEvent(t, { bubbles: true, cancelable: true, view: window, button: 0 })); } catch(e){} }); }
  function scroller() { var r = rows()[0]; var el = r && r.parentElement; while (el && el !== document.body) { var cs = getComputedStyle(el); if (/(auto|scroll)/.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 5) return el; el = el.parentElement; } return null; }
  function rowInfo(row) { var mid = String(row.getAttribute('data-mid') || ''); if (!mid) return null;
    var nm = row.querySelector('[class*="title_box"] [class*="text"]') || row.querySelector('strong'); var name = nm ? nm.textContent.trim() : '';
    var tm = row.querySelector('time[datetime]'); var t = tm ? Math.floor((Date.parse(tm.getAttribute('datetime')) || 0) / 1000) : 0;
    var unread = 0; [].slice.call(row.querySelectorAll('[class*="badge"],[class*="unread"],[class*="count"]')).forEach(function(b){ if (/mention/i.test(b.className)) return; var n = parseInt(String(b.textContent || '').replace(/\D/g, ''), 10); if (n > unread) unread = n; });
    var kind = /^[cr]/i.test(mid) ? 'group' : 'private';
    var img = row.querySelector('img'), src = img ? String(img.getAttribute('src') || '') : '';
    return { id: mid, name: name || mid, username: '', phone: '', group: kind !== 'private', kind: kind, unread: unread, unreadKnown: true, t: t, archive: false, avatar: /^https?:/.test(src) ? src : '', blob: /^blob:/.test(src) ? src : '', lastFromMe: null, lastAck: null, members: 0 }; }
  /* 头像是扩展页内部的 blob: 链接,面板(另一个页面)打不开 → 在这里取出来转成 data URI(≤60 个、≤60KB,和 TG 一样) */
  function avatars(list) { return new Promise(function(done){ try { var todo = list.filter(function(x){ return !x.avatar && x.blob; }).slice(0, 60), i = 0;
      (function next(){ if (i >= todo.length) { list.forEach(function(x){ delete x.blob; }); return done(list); } var x = todo[i++]; fetch(x.blob).then(function(r){ return r.blob(); }).then(function(b){ if (!b || b.size > 60000) return next(); var fr = new FileReader(); fr.onload = function(){ x.avatar = String(fr.result || ''); next(); }; fr.onerror = function(){ next(); }; fr.readAsDataURL(b); }).catch(function(){ next(); }); })(); } catch(e){ done(list); } }); }
  /* 虚拟列表只渲染可见行。以前靠把列表滚一遍收齐,用户看得见滚动条乱跑(2026-09-27 用户反馈);现在把滚动容器临时拉到内容总高度,虚拟列表一次把全部行渲染出来,scrollTop 不动,读完立刻恢复高度(真机 TikTok:33 行 → 216 行 → 33 行,~0.6s) */
  function withAllRows(fn) { var sc = scroller(); if (!sc) return Promise.resolve(fn());
    var old = { h: sc.style.height, mh: sc.style.maxHeight }, total = sc.scrollHeight; if (!(total > sc.clientHeight + 5)) return Promise.resolve(fn());
    sc.style.height = total + 'px'; sc.style.maxHeight = 'none';
    return new Promise(function(res){ setTimeout(function(){ var out; try { out = fn(); } finally { sc.style.height = old.h; sc.style.maxHeight = old.mh; } res(out); }, 600); }); }
  function collect() { return new Promise(function(res){ var got = {}, order = [];
    var take = function(){ rows().forEach(function(r){ var i = rowInfo(r); if (i && !got[i.id]) { got[i.id] = i; order.push(i.id); } }); };
    withAllRows(take).then(function(){ res(avatars(order.map(function(k){ return got[k]; }))); }, function(){ res(avatars(order.map(function(k){ return got[k]; }))); }); }); }
  function rowOf(id) { return document.querySelector(ROW.replace('[data-mid]', '[data-mid="' + id + '"]')); }
  function setSearch(v) { var i = document.querySelector('input[class*="searchInput-module__input"]'); if (!i) return false; try { i.focus(); } catch(e){} try { var d = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value'); if (d && d.set) d.set.call(i, v); else i.value = v; } catch(e){ i.value = v; } i.dispatchEvent(new Event('input', { bubbles: true })); if (!v) { try { i.blur(); } catch(e){} } return true; }
  function activeId() { try { var m = (location.hash || '').match(/#\/chats\/([^\/?]+)/); return m ? m[1] : ''; } catch(e){ return ''; } }
  function openRow(row) { clickEl(row.querySelector('button[aria-label="Go chatroom"]') || row.querySelector('button') || row); }
  function openChat(id, name) { return new Promise(function(res){ try { id = String(id || ''); if (!id) return res('nochat');
      var r = rowOf(id); if (r) { openRow(r); return res('ok'); }
      if (!name || !setSearch(String(name))) return res('nochat'); var t0 = Date.now();
      (function poll(){ var r2 = rowOf(id); if (r2) { openRow(r2); setTimeout(function(){ setSearch(''); res('ok'); }, 300); return; } if (Date.now() - t0 > 5000) { setSearch(''); return res('nochat'); } setTimeout(poll, 200); })();
    } catch(e){ res('error:' + (e && e.message)); } }); }
  window.__scrmContacts = { v: 2, platform: 'line', caps: { unread: true, ack: false, group: true, archive: false, channel: false },
    list: function(){ return collect().catch(function(){ return []; }); }, active: activeId, open: openChat, groupMembers: function(){ return []; }, _rowInfo: rowInfo };
})();
/* [LINE-CONTACTS-END] */

/* [OC-LINE-LIST] 2026-10-25 开口回传:后台从 LINE 自己的数据认出「对方发来了新消息」,不用客服点开对话。
   原来只有 [CHAT-BACKUP] 扫「当前打开的那个会话」,LINE 新客户要等客服点开才识别 —— 隔久了对不上广告点击。
   这里每 4 秒读一次 LINE 页面的 redux store(从聊天列表行的 React fiber 往上找 store;只读 getState,不派发):
     会话表 messageBox.entities.messageBoxes:一对一会话(midType 0、id 以 u 开头);
     联系人 contact.entities.contacts[id].capableBuddy === true = 官方号,跳过(官方号推送不是客户开口);
     最后一条消息 = lastMessages 里在 message.entities.messages 中、createdTime 最大的那条:发送人是对方,取 LINE 消息编号、createdTime(毫秒)、text。
       不看未读数:客服在手机上看过,电脑上的未读会被同步清零(真机实测),看未读会漏;是不是新客户由服务端判断(老客户不会被当成开口)。
     消息正文还没进 store 时退到 lastDeliveredMessageId(编号 + 送达时间),这时分不出是谁发的,只在 unreadCount > 0 时才算;正文取列表行里 [data-message-id=编号] 的预览。
   → 收进 window.__scrmChatBuf 一条 type:'oc_list'(服务端只拿它识别开口、不存进聊天记录)。
     对方是好友(contact.status === 1,真机核对:createdTime = 加好友时间)时再带一条 type:'oc_since'(只当「这个人早就在」的证据,服务端不当消息、不存):
     列表这一路没有历史,只在手机上聊过的老客户库里也没记录;服务端按它判:开启前就加的好友 / 加好友比首条早 24 小时以上 = 老客户。不是好友的陌生人不带(含义没核对过)。按 LINE 消息编号去重(每个会话记最近 5 个,存 localStorage,重启不重报);同开关 chatBackup。
   点开会话后 [CHAT-BACKUP] 采到同一条,时间也取消息行上的 data-timestamp(同一个时间)→ 服务端认得出是同一条,不会再报一次。 */
;(function(){try{
  if(window.__scrmOcLineList) return; window.__scrmOcLineList=1;
  var KEY='scrm_oc_line_seen', KEEP=5, seen={};
  function ls(){ try{ var L=window.localStorage; if(L&&typeof L.getItem==='function') return L; }catch(e){} return null; }
  try{ var L0=ls(), raw=JSON.parse((L0&&L0.getItem(KEY))||'{}'); if(raw&&typeof raw==='object'&&!Array.isArray(raw)) Object.keys(raw).forEach(function(k){ if(Array.isArray(raw[k])) seen[k]=raw[k].filter(function(x){ return typeof x==='string'; }).slice(-KEEP); }); }catch(e){ seen={}; }   /* 坏数据整项丢掉 */
  function on(){ try{ var c=window.__scrm_translate||{}, d=window.__scrmTrCfg||{}; return c.chatBackup===true||d.chatBackup===true; }catch(e){ return false; } }
  function store(){ try{ var r=document.querySelector('[data-mid][class*="chatlist_item"]'); if(!r) return null; var k=Object.keys(r).find(function(x){ return x.indexOf('__reactFiber')===0; }); var f=k?r[k]:null;
      for(var i=0;f&&i<200;i++,f=f.return){ var p=f.memoizedProps; if(p&&p.store&&typeof p.store.getState==='function') return p.store; } }catch(e){} return null; }   /* 每次现找(不缓存:LINE 换账号 / 重建 store 后不会读旧的) */
  function save(){ try{ var L=ls(); if(!L) return; var ks=Object.keys(seen); if(ks.length>500) ks.slice(0,ks.length-500).forEach(function(k){ delete seen[k]; }); L.setItem(KEY,JSON.stringify(seen)); }catch(e){} }
  function previewOf(msgId){ try{ var el=document.querySelector('[data-mid][class*="chatlist_item"] [data-message-id="'+String(msgId).replace(/[^0-9]/g,'')+'"]'); if(!el) return ''; var c=el.cloneNode(true); [].slice.call(c.querySelectorAll('[class*="scrm-"]')).forEach(function(n){ if(n.parentNode) n.parentNode.removeChild(n); }); return String(c.textContent||'').replace(/\u200b/g,'').trim(); }catch(e){ return ''; } }
  function tick(){ try{
    if(!on()) return;
    var st=store(); st=st&&st.getState(); if(!st||!st.messageBox||!st.auth||!st.auth.profile) return;
    var me=String(st.auth.profile.mid||''), B=(st.messageBox.entities||{}).messageBoxes||{}, C=((st.contact||{}).entities||{}).contacts||{}, M=((st.message||{}).entities||{}).messages||{};
    var now=Date.now()/1000, buf=window.__scrmChatBuf=window.__scrmChatBuf||[], added=0;
    Object.keys(B).forEach(function(id){ var b=B[id]; if(!b||Number(b.midType)!==0||!/^u[\w-]{8,}$/i.test(id)||id===me) return;
      var c=C[id]; if(c&&c.capableBuddy===true) return;   /* 官方号 */
      var m=null; (Array.isArray(b.lastMessages)?b.lastMessages:[]).forEach(function(k){ var x=M[k]; if(x&&(!m||Number(x.createdTime)>Number(m.createdTime))) m=x; });
      var msgId='', t=0, text='';
      if(m){ if(String(m.from||'')!==id) return; msgId=String(m.id||''); t=Number(m.createdTime)||0; text=String(m.text||''); }   /* 最后一条不是对方发的 → 不算 */
      else { var d=b.lastDeliveredMessageId; if(!d||!d.messageId||(Array.isArray(b.lastMessages)&&b.lastMessages.length&&b.lastMessages.map(String).indexOf(String(d.messageId))<0)||!(Number(b.unreadCount)>0)) return; msgId=String(d.messageId); t=Number(d.deliveredTime)||0; text=previewOf(msgId); }
      t=t/1000; if(!/^\d{6,30}$/.test(msgId)||!t||t>now+300||t<now-86400) return;
      var sv=seen[id]||[]; if(sv.indexOf(msgId)>=0) return;
      sv.push(msgId); if(sv.length>KEEP) sv.splice(0,sv.length-KEEP); seen[id]=sv;
      var name=c?String(c.displayNameOverridden||c.displayName||''):'';
      buf.push({account:id,name:name.slice(0,255),headimg:'',id:'L'+msgId,from_me:0,type:'oc_list',body:text.replace(/\u200b/g,'').slice(0,2000),t:t}); added++;
      var ct=(c&&Number(c.status)===1)?Number(c.createdTime)/1000:0; if(ct>1e9&&ct<t) buf.push({account:id,name:name.slice(0,255),headimg:'',id:'S'+msgId,from_me:0,type:'oc_since',body:'',t:ct});   /* 加好友时间:老客户的证据 */
    });
    if(added) save();
    window.__scrmOcLineStat={boxes:Object.keys(B).length,added:added,total:(window.__scrmOcLineStat&&window.__scrmOcLineStat.total||0)+added,t:Date.now()}; /* 巡检用 */
  }catch(e){ try{ window.__scrmOcLineErr=String(e&&e.message||e); }catch(_){} } }
  setInterval(tick,4000);
  window.__scrmOcLineTick=tick;
}catch(e){}})();
/* [OC-LINE-LIST-END] */
