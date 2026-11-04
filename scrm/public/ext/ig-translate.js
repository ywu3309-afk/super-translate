// [IG-ROOT-NAV] 2026-09-20 照海王:Instagram 起始页用首页而不是 /direct/inbox/(未登录会 302 到 /accounts/login/,该接口按 IP 限流 429 且返回空页)。
// ①落在 /accounts/login/ 且页面是 429 空页(没有登录表单)→ 立刻回首页(首页同一时刻 200、自带登录表单);②已登录且不在 /direct/ → 自动进收件箱一次。
(function(){ try {
  // [IG-ERRPAGE-ROOT] 主进程把 4xx 主文档换成自家 data: 错误页,preload 在这个 data: 页里同样会跑:一看到是 Instagram 的 429/限流错误页就立刻回首页
  // (首页同一 IP 是 200 且自带登录表单),不再等面板 2s 轮询——实测主进程的 loadURL(错误页) 会覆盖 renderer 端更早的跳转,所以只能在错误页里跳。
  if (location.protocol === 'data:') {
    var _errGo = function () { try { var t = (document.body && document.body.innerText) || ''; if (/Instagram/.test(t) && /429|限流/.test(t)) location.replace('https://www.instagram.com/'); } catch (e) {} };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', _errGo); else _errGo();
    return;
  }
  if (location.host !== 'www.instagram.com') return;
  var _go = function (u) { try { if (!window.__scrmIgNav) { window.__scrmIgNav = 1; location.replace(u); } } catch (e) {} };
  var _loggedIn = function () { try { return /(^|; )ds_user_id=/.test(document.cookie) || !!document.querySelector('a[href="/direct/inbox/"],a[href^="/direct/"]'); } catch (e) { return false; } };
  var _check = function () {
    try {
      var p = location.pathname || '/';
      if (p.indexOf('/accounts/login') === 0) {
        // 只有"真正的空页"(429 空响应,没有任何正文)才回首页;人机验证/挑战/验证码页也在登录路径下且没有账号密码框,绝不能碰(否则刚显示就被跳走,用户没机会输入 —— 2026-09-20 踩过)
        var txt = (document.body && document.body.innerText || '').replace(/\s+/g, '');
        var challenge = /challenge|captcha|human|verify|verification|checkpoint|code/i.test(txt) || /challenge|checkpoint/.test(location.pathname);
        var empty = !document.body || txt.length < 20;
        if (empty && !challenge) { setTimeout(function () { try { var t2 = (document.body && document.body.innerText || '').replace(/\s+/g, ''); if (t2.length < 20) _go('https://www.instagram.com/'); } catch (e) {} }, 1500); }
        return;
      }
      if (p.indexOf('/accounts/') === 0 || /challenge|checkpoint|captcha/i.test(p) || /Confirm you.re human|captcha|challenge/i.test((document.body && document.body.innerText || '').slice(0, 400))) return; // /accounts/*(登录/暂停/验证)与挑战页一律不动 —— 2026-09-20 暂停账号页有 ds_user_id 却不在 /direct,曾被自动送去收件箱→IG 又弹回→每 1.7s 一次死循环,还连带让面板反复重推配置、删光所有 IG 窗口的译文框
      try { var _lastNav = parseInt(sessionStorage.getItem('__scrmIgNavAt') || '0', 10); if (Date.now() - _lastNav < 60000) return; } catch (e) {} // 跨页面限频:自动导航 60s 内最多一次
      if (p.indexOf('/direct') !== 0 && _loggedIn()) { try { sessionStorage.setItem('__scrmIgNavAt', String(Date.now())); } catch (e) {} _go('https://www.instagram.com/direct/inbox/'); }
    } catch (e) {}
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(_check, 800); }); else setTimeout(_check, 800);
  window.addEventListener('load', function () { setTimeout(_check, 1500); });
} catch (e) {} })();
// ig-translate.js — Instagram 自研翻译适配器(输入框预览+发送),照 tg/wa-translate 架构。
// 翻译走 IPC(scrm-translate-req → 主进程 Node http,完整句无逗号截断,绕过页面CSP)。
// 由 ig-preload-wrapper.js 在 preload 里 eval(先于海王 instagram-preload,故回车 capture 抢先)。
// 关键铁律:发送前必校验"输入框内容 === 译文"才点发送,否则重试替换、仍失败则不发(绝不发未翻译原文)。
(function(){
  'use strict';
  if (window.__scrmIgTranslateLoaded) return;
  window.__scrmIgTranslateLoaded = true;

  /* IG 自己账号头像(照海王 instagram-preload):扫 script[type=application/json] 遍历 __bbox.define 找 PolarisViewer.data(不依赖 window.require,任何world都行)→ profile_pic_url_hd → canvas 150x150 转 base64(绕 cdninstagram 防盗链+URL过期)→ 上报。
     上报双保险:①fetch chm123 account/report(若 IG CSP connect-src 放行);②写 localStorage MY_INFO.headImg 供主进程 genericDetect 兜底上报(_reportAccount 走主进程 https,无CSP;genericDetect对ig用通用脚本读MY_INFO,IG不占此key)。setInterval 1s轮询(IG SSR数据异步注入,要等) */
  (function(){
    var __done=false,__tries=0,__iv=null;
    /* [NATIVE-TIMER-PAIR] instagram.com 覆盖 setInterval/clearInterval;set/clear 固定同一对原生函数,防原生定时器清不掉 */
    var __nSI=window.setInterval, __nCI=window.clearInterval;
    function __getViewer(){ var v=null; try{ var sc=document.querySelectorAll('script[type="application/json"]'); for(var i=0;i<sc.length;i++){ try{ var n=JSON.parse(sc[i].childNodes[0].textContent); var def=n.require[0][3][0].__bbox.define; Object.keys(def).forEach(function(k){ var d=def[k]; if(d&&d[0]==="PolarisViewer"&&d[2]&&d[2].data) v=d[2].data; }); if(v)break; }catch(_e){} } }catch(_e){} return v; }
    function __toB64(url){ return new Promise(function(res,rej){ try{ var img=new Image(); img.crossOrigin="anonymous"; img.onload=function(){ try{ var c=document.createElement("canvas"); c.width=150;c.height=150; c.getContext("2d").drawImage(img,0,0,150,150); var d=c.toDataURL("image/jpeg"); c.remove(); res(d); }catch(e){ rej(e); } }; img.onerror=function(e){ rej(e); }; img.src=url; }catch(e){ rej(e); } }); }
    function __push(v,img){
      // 加固:只在 MY_INFO 不存在或已是我方(带__scrm标记)时写,绝不覆盖 IG 自身可能用的 MY_INFO
      try{ var _ex=null; try{_ex=JSON.parse(localStorage.getItem('MY_INFO')||'null');}catch(_x){} if(!_ex || _ex.__scrm){ localStorage.setItem('MY_INFO', JSON.stringify({__scrm:1, name:v.username||'', id:v.id||'', headImg:img})); } }catch(_e){}
      try{ var tk=localStorage.getItem('scrm_app_token'); if(tk){ fetch('https://chm123.com/api/app/account/report',{method:'POST',headers:{'Authorization':'Bearer '+tk,'Content-Type':'application/json'},body:JSON.stringify({platform:'Instagram',account_name:v.username||'',phone:v.id||'',avatar_url:img,online_status:1})}).catch(function(){}); } }catch(_e){}
      __done=true; if(__iv)__nCI(__iv);
    }
    function __tick(){ if(__done)return; __tries++; if(__tries>40){ if(__iv)__nCI(__iv); return; } var v=__getViewer(); if(!v||!v.profile_pic_url_hd)return; __toB64(v.profile_pic_url_hd).then(function(b){ __push(v,b); }).catch(function(){ __push(v, v.profile_pic_url_hd); }); }
    __iv=__nSI(__tick,2000); setTimeout(__tick,3000);
  })();

  var ipcRenderer = null;
  try { ipcRenderer = require('electron').ipcRenderer; } catch(e){ return; }
  function dbg(m){ try{ ipcRenderer.send('scrm-igtr-log', String(m)); }catch(e){} }
  dbg('ig-translate loaded v2');
  // 启动探针:走正常IPC翻译通道,nginx可见 st=SCRMIGLOAD → 证明适配器活着且IPC通
  try{ ipcRenderer.send('scrm-translate-req', { text:'SCRMIGLOAD', tl:'en', ch:'scrm-igload-ping' }); }catch(e){}

  // 掐死海王的"发送方向"实时翻译(tl≠zh):我方已用IPC接管发送翻译,拦掉海王的fetch避免两套抢预览框。
  // 保留收信方向(tl=zh):海王继续负责翻译收到的消息。我方翻译走IPC不受此影响。
  try{
    if(!window.__igKillHaiwangSend){
      window.__igKillHaiwangSend=1;
      var _origFetch = globalThis.fetch;
      var _recvCache = {};
      var _mockResp = function(text){ return { ok:true, status:200,
        text:function(){return Promise.resolve(text);},
        json:function(){return Promise.resolve({});}, headers:new Map() }; };
      globalThis.fetch = function(u,o){
        try{
          var s=(typeof u==='string')?u:(u&&u.url)||'';
          if(s.indexOf('/async/translate')>-1){
            // 撤海王第2步:彻底掐掉海王的所有翻译请求(收+发)→ 海王不再建框/首译,IG 纯自研。
            // 我方翻译走 IPC(scrm-translate-req→主进程Node http),不经此 fetch,完全不受影响。
            return Promise.resolve(_mockResp('<span id="tw-answ-target-text"></span>'));
          }
        }catch(e){}
        return _origFetch.apply(this, arguments);
      };
      dbg('haiwang translate fully blocked (recv+send), IG self-owned');
    }
  }catch(e){}

  // 拦掉海王的回车捕获注册:它的翻译fetch已被我们掐死,它抢到回车会preventDefault后翻译得''→吞掉不发。
  // 我们先于海王加载,包一层document.addEventListener,按特征(13!==keyCode+shiftKey+stopPropagation)丢弃它的注册。
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

  function _norm(s){ return (s||'').replace(/[\u200b\u200c\u200d\ufeff]/g,'').trim(); } // 去零宽/BOM再trim

  // ---------- 活跃会话ID(IG DM URL: /direct/t/<线程ID>/;兜底头部用户名)→ 发布给面板轮询读(照 WA/Zalo/TikTok) ----------
  function _igActiveCid(){
    try{ var m=(location.pathname||location.href||'').match(/\/direct\/t\/([^\/?#]+)/); if(m&&m[1]) return m[1]; }catch(e){}
    return '';
  }
  setInterval(function(){ try{ window.__scrmActiveContactId = _igActiveCid()||''; }catch(e){} }, 300);

  // ---------- 面板开关读取(默认全开,对齐全平台标准) ----------
  /* 翻译配置唯一读法:老全局 __scrm_translate(面板 exec 直写)与 __scrmTrCfg(主进程 updateTranslate 注入 + 页面就绪重放)合并,后者覆盖 —— 与其它平台适配器同一写法;
     原来只读 __scrm_translate,页面刷新后主进程重放的 route/routeName 这里看不见,线路名空、线路回退谷歌 */
  function _cfg(){ try{ return Object.assign({}, window.__scrm_translate||{}, window.__scrmTrCfg||{}); }catch(e){ return {}; } }
  function _recvOn(){ try{ var c=_cfg(); return c.receiveTranslateAuto!==false && c.recvEnabled!==false; }catch(e){ return true; } }
  function _sendOn(){ try{ var c=_cfg(); return c.sendTranslateAuto!==false && c.sendEnabled!==false; }catch(e){ return true; } }
  function _pvOn(){ try{ var c=_cfg(); return c.translatePreview!==false; }catch(e){ return true; } }

  // ---------- 发送目标语言(先看好友独立开关,再回退全局) ----------
  function sendTo(){
    try{
      var c = _cfg();
      var id = _igActiveCid();
      if (id && c && c.singleContactTranslate){
        var sct = c.singleContactTranslate[id];
        if (sct && (sct.singleContactTranslateOpen || sct.enabled) && (sct.sendTargetLanguage || sct.sendTo)) return sct.sendTargetLanguage || sct.sendTo;   // per-chat 命中
      }
      if (c && c.sendTargetLanguage) return c.sendTargetLanguage;
      if (c && c.sendTo) return c.sendTo;
    }catch(e){}
    return 'en';
  }

  // ---------- IPC 翻译(完整句,带缓存去重+秒出) ----------
  var _seq = 0, _trCache = {}, _trPending = {};
  /* [TR-ALIGN-1002] 当前翻译线路(面板 route):缓存键、IPC 请求、预览去重键都读这一份 */
  function _route(){ try{ return _cfg().route||''; }catch(e){ return ''; } }
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
      var ch = 'scrm-tr-ig-' + (++_seq) + '-' + (Date.now ? Date.now() : Math.floor(performance.now()));
      var done = false;
      var finish = function(r){ done = true; if (r){ _trCache[key] = r; try{ var tk=Object.keys(_trCache); if(tk.length>600){ for(var z=0;z<tk.length-450;z++) delete _trCache[tk[z]]; } }catch(_t){} } var qs = _trPending[pk]||[]; delete _trPending[pk]; qs.forEach(function(fn){ try{ fn(r); }catch(e){} }); };
      try { ipcRenderer.once(ch, function(_e, result){ finish(result==null?'':String(result)); }); }
      catch(e){ finish(''); return; }
      try { ipcRenderer.send('scrm-translate-req', { text: text, tl: (tl||'en'), ch: ch, route: route });   /* [TR-ALIGN-1002] 与缓存键同一个线路值 */ }
      catch(e){ finish(''); return; }
      setTimeout(function(){ if (!done) finish(''); }, 6000);
    });
  }

  // 读输入框文本,保留换行(Lexical 每段是一个<p>,textContent会把多段粘一起丢换行)
  function _ctext(tb){
    try{
      if(!tb) return '';
      var ps = tb.querySelectorAll ? tb.querySelectorAll('p') : null;
      if(ps && ps.length > 1){ var arr=[]; for(var i=0;i<ps.length;i++) arr.push((ps[i].textContent||'')); return arr.join('\n').replace(/[\u200b\u200c\u200d\ufeff]/g,'').replace(/\n{3,}/g,'\n\n').replace(/^\s+|\s+$/g,''); }
      var t = (tb.innerText != null && tb.innerText !== '') ? tb.innerText : (tb.textContent||'');
      return t.replace(/[\u200b\u200c\u200d\ufeff]/g,'').replace(/\r/g,'').replace(/\n{3,}/g,'\n\n').replace(/^\s+|\s+$/g,'');
    }catch(e){ return _norm(tb && tb.textContent); }
  }
  // 单行翻译带重试:后端限流/超时偶发返回空 → 自动重翻,避免拼接后缺一行(空白/截断)
  function _trLine(t, tl, tries, force){   // [TR-ALIGN-1002] force 一路传下去:重试也不能落回旧缓存
    return translate(t, tl, force).then(function(r){
      if ((!r || !r.replace(/\s/g,'')) && (tries||0) < 3) return _trLine(t, tl, (tries||0)+1, force);
      return r;
    });
  }
  // 长消息按行攒成 ≤350字 的块(服务器单次~400字会截断),每块一次翻→块数远少于行数,降延迟又不截断,保留换行
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
        var al = ((el.getAttribute('aria-label')||'')+' '+(el.getAttribute('placeholder')||'')).toLowerCase();
        if (/搜索|search/.test(al)) continue;   // 顶部搜索框也是role=textbox:消息列表页会被误认成输入框→预览悬死左上角
        var r = el.getBoundingClientRect();
        if (r.top < window.innerHeight*0.4) continue;   // 消息输入框必在下半屏
        if (r.top > bt){ bt = r.top; best = el; }
      }
      return best;   // 别加"随便抓一个textbox"兜底:抓错比抓不到危害大
    }catch(e){ return null; }
  }
  function getSendBtn(){
    try{
      var els = document.querySelectorAll('[aria-label]');
      for (var i=0;i<els.length;i++){
        var al = (els[i].getAttribute('aria-label')||'').trim();
        if (/^(发送|send)$/i.test(al) && els[i].offsetParent !== null){
          return els[i].closest('[role="button"],button,div[tabindex]') || els[i];
        }
      }
    }catch(e){}
    return null;
  }

  // ---------- 发出消息译文=原文,持久化 ----------
  window.__igSentOrig = window.__igSentOrig || {};
  try{ var _so = localStorage.getItem('scrm_ig_sent_originals'); if (_so) window.__igSentOrig = JSON.parse(_so); }catch(e){}
  function saveOrig(){ try{
    var ks = Object.keys(window.__igSentOrig);
    if (ks.length > 400){ for (var i=0;i<ks.length-300;i++) delete window.__igSentOrig[ks[i]]; }
    localStorage.setItem('scrm_ig_sent_originals', JSON.stringify(window.__igSentOrig));
  }catch(e){} }

  // ---------- 收信译文持久缓存(按外文签名存中文译文)→ 虚拟滚动滚回来同步命中,不重翻不闪 ----------
  window.__igRecvTrans = window.__igRecvTrans || {};
  try{ var _sr = localStorage.getItem('scrm_ig_recv_trans'); if (_sr) window.__igRecvTrans = JSON.parse(_sr); }catch(e){}
  var _saveRecvT = 0;
  function saveRecv(){ try{
    var ks = Object.keys(window.__igRecvTrans);
    if (ks.length > 1500){ for (var i=0;i<ks.length-1100;i++) delete window.__igRecvTrans[ks[i]]; }
    if (_saveRecvT) return;   // 落盘去抖:多条来信合并成一次写,别每条都 stringify
    _saveRecvT = setTimeout(function(){ _saveRecvT=0; try{ localStorage.setItem('scrm_ig_recv_trans', JSON.stringify(window.__igRecvTrans)); }catch(e){} }, 800);
  }catch(e){} }
  /* [BATCH1-04] 面板「清空译文缓存」:window.__scrmTrCacheClear() → Promise<{cleared:n}>,永不 reject。
     清两处:句级内存 _trCache;收信整条译文 window.__igRecvTrans 及它在 localStorage scrm_ig_recv_trans 的镜像(连同在途的落盘)。
     n(全平台同一口径)= 持久层里被清掉的译文条数;本文件没有 IndexedDB 层,持久层就是那份 localStorage 镜像,数它的条数。
     __igSentOrig 是发出消息的原文映射不是译文,不动;已显示的译文框/标记一个不删,之后新消息 / ↻ 才重新联网(不触发重译)。
     ig-translate.js 与 scrm-patch-instagram.js 共用守卫 __scrmIgTranslateLoaded,同页只会跑先装的那份。 */
  window.__scrmTrCacheClear = function(){ var n = 0;
    try { var _m = JSON.parse(localStorage.getItem('scrm_ig_recv_trans') || '{}'); if (_m && typeof _m === 'object') n = Object.keys(_m).length; } catch(e){}
    try { _trCache = {}; window.__igRecvTrans = {}; if (_saveRecvT) { clearTimeout(_saveRecvT); _saveRecvT = 0; } localStorage.removeItem('scrm_ig_recv_trans'); } catch(e){}
    return Promise.resolve({ cleared: n });
  };

  // ---------- 预览(固定浮层挂body:数据实测IG切会话销毁输入区→in-flow框断开50ms=闪;浮层挂body永不断开=唯一真不闪。pointer-events穿透→能滑;消息区量化留白→不挡字)----------
  var _prevTimer = null, _pvKey = '', _pvFailKey = '', _pvShownLR = '', _lastOut = '', _lastOutKey = '', _wantShow = '', _wantTr = false;   /* _wantTr:_wantShow 是不是真译文 */   // [TR-ALIGN-1002] _lastSrc/_lastTl 换成按键核对;[TR-FIX-1002B] _pvShownTo 换成 _pvShownLR(只记语言|线路),加 _pvFailKey
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
  function _pvStyle(){ if(document.getElementById('scrm-igpv2-style')||!document.head) return; var st=document.createElement('style'); st.id='scrm-igpv2-style';
    st.textContent=_pvCoreCss('scrm-igpv2',{margin:'0',maxHeight:'22vh'})+'.scrm-igpv2{position:fixed;z-index:1;pointer-events:none;display:none;} .scrm-igpv2-body,.scrm-igpv2-back{pointer-events:auto;} .real-time-tranlate-content{display:none !important;}';
    document.head.appendChild(st); }
  function _pvRouteName(){ try{ var c=_cfg(); return (typeof c.routeName==='string'?c.routeName:'')+'实时翻译'; }catch(e){ return '实时翻译'; } }   // [PV-D] 显示名由面板随配置下发(routeName),不再本地存名字表;去掉铅笔图标
  // 浮层永远挂 body(会话面板销毁与它无关→永不断开→不闪)
  function _pvHost(){ var h=window.__igPv2; if(!h){ h=document.createElement('div'); h.className='scrm-igpv2'; h.innerHTML='<div class="scrm-igpv2-lbl"></div><div class="scrm-igpv2-body"></div>'; window.__igPv2=h; } if(h.parentElement!==document.body){ try{ document.body.appendChild(h); }catch(e){} } return h; }
  // 对准【完整胶囊输入栏】:IG胶囊里外多层都有圆角(内层=文字区到麦克风前就断了)→必须取【最外层】有圆角的=含表情/麦克风/图片按钮的整条
  function _pvInputBox(){ try{ var tb=getComposer(); if(!tb) return null; var el=tb, pick=null, n=0; for(var i=0;i<8&&el;i++){ var pp=el.parentElement; if(!pp) break; try{ var cs=getComputedStyle(pp); var r=pp.getBoundingClientRect(); if(r.width>240 && r.height<=140 && parseFloat(cs.borderTopLeftRadius)>=12){ pick=pp; n++; } }catch(e){} el=pp; }  // 不break,一路收集,留最外层
      if(!pick) pick=tb.parentElement||tb;
      return pick; }catch(e){ return null; } }
  // 消息滚动区(是输入框兄弟不在祖先链!→从会话面板根往下扫可滚大容器)。缓存
  function _pvScroller(){ try{ var c=window.__igScroller; if(c && c.isConnected){ try{ var oy0=getComputedStyle(c).overflowY; if((oy0==='auto'||oy0==='scroll') && c.clientHeight>180) return c; }catch(e){} }
      var tb=getComposer(); if(!tb) return null; var root=tb; for(var i=0;i<12;i++){ if(!root.parentElement) break; root=root.parentElement; try{ if(root.getBoundingClientRect().height>window.innerHeight*0.6) break; }catch(e){} }
      var cand=root.querySelectorAll('div'); var best=null,bh=0; for(var j=0;j<cand.length;j++){ var el=cand[j]; try{ var oy=getComputedStyle(el).overflowY; if((oy==='auto'||oy==='scroll') && el.clientHeight>200){ if(el.clientHeight>bh){ bh=el.clientHeight; best=el; } } }catch(e){} }
      window.__igScroller=best;
      return best;
    }catch(e){ return null; } }
  function _pvPad(px){ try{ var sc=_pvScroller(); if(!sc) return;
      if(px>0){ var cur=parseInt(sc.__scrmPad||'0',10)||0; if(px<=cur && px>cur-60) return; }   // 小幅波动(<60px)不回缩=不抖;大缩(发送后预览变小)允许收回=不留空白
      var want=px>0?(px+'px'):''; if(sc.__scrmPad===want) return; var atBottom=(sc.scrollTop+sc.clientHeight>=sc.scrollHeight-6); sc.style.paddingBottom=want; sc.__scrmPad=want; if(atBottom && px>0){ sc.scrollTop=sc.scrollHeight; } }catch(e){} }
  // 表情/GIF/贴纸面板开着?(有"搜索表情"搜索框可见)→ 让路隐藏浮层,别从面板边露出来
  function _pvEmojiOpen(){ try{ var q=document.querySelector('input[placeholder="搜索表情"],input[placeholder*="表情"],input[placeholder*="emoji" i],input[placeholder*="GIF" i]'); return !!(q && q.offsetParent!==null); }catch(e){ return false; } }
  // 基准元素缓存:胶囊不常重建,缓存有效就不重扫(省每帧walk+computedStyle,也避免候选抖动)
  function _pvPickBox(){ try{ var c=window.__pvPickEl; if(c && c.isConnected){ var rr=c.getBoundingClientRect(); if(rr.width>240 && rr.height>0) return c; } var p=_pvInputBox(); window.__pvPickEl=p; return p; }catch(e){ return null; } }
  var _PVOV=-4;   // 与胶囊的间隙:负=悬在胶囊上方4px(独立圆角卡片带轮廓线,IG风格;不重叠不改IG样式→不打架不闪)
  function _pvPos(){ try{ var h=window.__igPv2; if(!h||h.style.display==='none'){ _pvPad(0); return; } var box=_pvPickBox(); if(!box){ h.style.display='none'; _pvPad(0); return; } var r=box.getBoundingClientRect(); if(r.width<80){ h.style.display='none'; _pvPad(0); return; }   /* 无有效锚=没进聊天,必须藏 */
      var L=r.left, W=r.width, B=(window.innerHeight-r.top-_PVOV); var p=h.__geo;   // 死区:几何变化<1.5px不写style→不因亚像素波动反复重排=不抖
      if(!p || Math.abs(p.L-L)>1.5 || Math.abs(p.W-W)>1.5 || Math.abs(p.B-B)>1.5){ h.style.left=L+'px'; h.style.width=W+'px'; h.style.bottom=B+'px'; h.__geo={L:L,W:W,B:B}; }
      try{ var hh=h.getBoundingClientRect().height; if(hh>2){ hh=Math.ceil((hh+6)/20)*20; _pvPad(hh); } }catch(_e){} }catch(e){} }
  var _backTr=_backTrCore({ backCls:'scrm-igpv2-back', on:function(){ return !!_cfg().backTranslate; }, sendLang:sendTo, backLang:recvTo, translate:function(t,bl){ return translateML(t,bl); } });   /* [BACK-TR] 回译校对:下面写预览正文的地方调 _backTr.update(正文元素, 译文),行为全在上面的 [BACK-TR-CORE] */
  function _pvBack(h){ try{ _backTr.update(h.querySelector('.scrm-igpv2-body'), _wantTr?_wantShow:''); }catch(e){} }   /* 卡片显示出来之后调(此时已挂在页面上) */
  function setPreview(txt, isTr){ _wantShow=(txt==null?'':txt); _wantTr=!!isTr&&_wantShow!=='';
    try{ _pvStyle(); var h=_pvHost();
      if(_wantShow===''||!_pvOn()){ h.style.display='none'; _pvPad(0); return; }
      var lbl=h.querySelector('.scrm-igpv2-lbl'); var wl=_pvRouteName(); if(lbl&&lbl.textContent!==wl) lbl.textContent=wl;
      var body=h.querySelector('.scrm-igpv2-body'); if(body&&body.textContent!==_wantShow) body.textContent=_wantShow;
      if(_pvEmojiOpen()){ h.style.display='none'; return; }
      h.style.display='block'; _pvPos(); _pvBack(h);
    }catch(e){}
  }
  // 常驻跟随:show/hide+表情让路走300ms tick;位置走rAF逐帧贴(120ms间隔跟不上布局变化=抖,rAF每帧同步=稳)
  function _pvTick(){ try{ _pvStyle(); var h=window.__igPv2;
      if(_wantShow===''||!_pvOn()){ if(h) h.style.display='none'; _pvPad(0); return; }
      if(_pvEmojiOpen()){ if(h) h.style.display='none'; return; }   // 表情面板开→让路(padding保持不跳)
      var h2=_pvHost(); if(h2.style.display==='none') h2.style.display='block'; _pvPos(); _pvBack(h2);
    }catch(e){} }
  function _attachPvObs(){ _pvTick(); }
  setInterval(_pvTick, 300);
  (function _pvRaf(){
    try{ var h=window.__igPv2; if(_wantShow!=='' && h && h.style.display!=='none') _pvPos(); }catch(e){}
    try{ requestAnimationFrame(_pvRaf); }catch(e){ setTimeout(_pvRaf, 120); }
  })();
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

  // ---------- 接管回车发送(照 tg-translate.js 成熟机制) ----------
  // Lexical 写入:直接调编辑器实例 setEditorState(照海王 v1.9.5 的做法,最可靠——长文/多行/逗号全稳,不抖不打架)
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
    // 兜底:粘贴事件法(万一拿不到 __lexicalEditor)
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
  // 发送后把焦点还给输入框 → 支持连续打字。Lexical 光标丢失时单纯 DOM focus() 不够,
  // 必须调 Lexical 编辑器实例自己的 focus() 把选区放回编辑器(否则要鼠标再点一下才能打字)。多次重试兜住 send 后的异步清空。
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
    else { window.__igSendingEnter=1; fireEnter(tb); setTimeout(function(){ window.__igSendingEnter=0; }, 250); }
    _sending=false; setTimeout(refocus, 120);
  }
  function _sb(){ }   // 发送诊断信标(已验证通,关闭;要排查时改回上报)
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
        try{ window.__igSentOrig[_sig(cur)] = orig; saveOrig(); }catch(e){}
        window.__igSendingEnter = 1;   // 标记这个Enter是我方发送用,handleSend放行
        _sb('fired');
        fireEnter(getComposer());
        setTimeout(function(){
          var c2 = _ctext(getComposer());
          _sb('post','&sent='+(c2===''?1:0));
          if (c2 !== '' && _sig(c2) === _sig(tr) && _safeToSend(c2, to)){ var b = getSendBtn(); if (b){ try{ _myClick=true; b.click(); setTimeout(function(){_myClick=false;},150); }catch(e){} } }  // 兜底点发送键(同样只认译文)
          setTimeout(function(){ window.__igSendingEnter = 0; }, 250);
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
    if (window.__igSendingEnter) return;   // 我方发送派发的Enter → 放行原生发送
    var tb = getComposer();
    if (!tb) return;
    if (!(e.target === tb || (tb.contains && tb.contains(e.target)) || (e.target && e.target.closest && e.target.closest('[role="textbox"]')))) return;
    var ct = _ctext(tb);
    if (!ct) return;
    if (!_sendOn()){   // 发送翻译开关关=原文直发(仍走模拟点击,绕海王吞回车)
      e.preventDefault(); e.stopImmediatePropagation();
      if (_sending) return; _sending = true; setTimeout(function(){ _sending = false; }, 8000);
      _rawSendNow(tb); return;
    }
    // 统一接管所有回车,按"检测语言→目标语言"语义:先拿译文(命中预览缓存=零延迟),
    // 译文≠原文→写入译文发送;译文=原文(已是目标语言/纯emoji数字)→原样发。
    // 不再只认"含中文才翻"——老规则会把泰语原文原样发出去(目标明明是韩语)。
    e.preventDefault(); e.stopImmediatePropagation();
    if (_sending) return;
    _sending = true;
    setTimeout(function(){ _sending = false; }, 8000);   // 安全阀:任何卡死8秒后自动复位,不永久锁死
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
  // 快捷键(照WA):Ctrl+F=发送原文(不翻译);Ctrl+T=只翻译不发送(译文写入输入框)
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

  // 拦截发送按钮点击:含中文时不让原生直接发中文,转成回车走翻译流程(和Enter一致)
  var _myClick = false;
  document.addEventListener('click', function(e){
    try{
      if(_myClick) return;                        // 我方自己点的(发英文),放行
      var sb = getSendBtn(); if(!sb) return;
      var t = e.target;
      if(!(t===sb || (sb.contains && sb.contains(t)) || (t && t.closest && t.closest('[aria-label]')===sb))) return;
      var tb = getComposer(); if(!tb) return;
      var ct = _ctext(tb);
      if(!ct) return;
      e.preventDefault(); e.stopImmediatePropagation();
      tb.focus();
      tb.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',code:'Enter',keyCode:13,which:13,bubbles:true,cancelable:true}));  // 统一转回车→handleSend决定翻译或原样发
    }catch(err){}
  }, true);

  document.addEventListener('input', onInput, true);   // 打字触发
  document.addEventListener('paste', function(){ setTimeout(onInput, 30); }, true);  // 粘贴触发
  // 变化轮询兜底:粘贴/拖入/任何方式改了输入框、或只换了目标语言/线路都能重翻;输入框空了强制回占位
  // [TR-ALIGN-1002] 原来只在"文字变了"或"已有译文且语言变了"时才调 onInput(换线路不重翻、译文没回来前换语言也不重翻);
  // 现在每轮都交给 onInput,它按「语言|线路|原文」键自己判断有没有变化,没变直接返回
  setInterval(onInput, 250);

  // ---------- 收发两个方向的翻译都自研:保证每个翻译框显示"完整中文" ----------
  // 统一规则:取该消息要翻译的原文(优先 wrapper 的 origintext,兜底上一条气泡文本)——
  //   ① 我方发出(签名命中 __igSentOrig)→ 直接用存的中文原文(最精准);
  //   ② 原文已是中文 → 直接显示(我方带中文原文的发出 / 中文来信);
  //   ③ 原文是外文(客户来信)→ 我方走 IPC 现翻成完整中文(逐行,无逗号截断),异步翻完盖章。
  // 命中即把结果盖到 data-scrm-orig 并给译文格挂 MutationObserver 瞬时钉死 → 海王一覆写立刻恢复,消灭气泡里的闪。
  var _cjk=/[一-鿿]/;
  var _hasLetter=/[A-Za-zÀ-ɏͰ-ϿЀ-ӿ԰-֏؀-ۿऀ-ॿ฀-๿぀-ヿ가-힯]/;
  // 接收目标语言:读面板配置(别写死中文);改语言→缓存key变→自动重翻
  function recvTo(){ try{ var c=_cfg(); return (c&&(c.receiveTargetLanguage||c.recvTo))||'zh-CN'; }catch(e){ return 'zh-CN'; } }
  // src 是否已是目标语言→免翻(仅中文目标有可靠检测:是中文且无外文字母;其它目标无可靠检测→一律翻,Google 同语言返回原文)
  try{ window.__igTrVer='20261002y'; }catch(e){}   /* [TR-ALIGN-1002] */
  function _isTargetLang(src, tl){ if(src && !_hasLetter.test(src) && !_cjk.test(src) && /[0-9]/.test(src)) return true; /* [NUM-TR] 2026-09-15 纯数字/符号=语言无关,当作已是目标语言原样显示译文行(IG 真正加载的是本文件,不是 scrm-patch-instagram.js) */ if((tl||'').indexOf('zh')===0){ var _cn=(String(src).match(/[\u4e00-\u9fff]/g)||[]).length, _ln=(String(src).match(/[A-Za-z]/g)||[]).length; return _cn>0 && _ln<=Math.max(3,_cn*0.3); } return false; } /* [ZH-MIXED] 2026-09-20 夹少量英文(QQ/OK/iPhone)的中文按中文处理:原来一个字母就当外语去翻,翻出来和原文一样 */
  // 给某个 wrapper 的译文格挂观察器:海王一改就立刻恢复成我方 data-scrm-orig(瞬时,不等轮询=不闪)
  // 钉死观察器盯【整个 wrapper 子树】(不是内容元素):海王滚动重渲时会把 .message-translate-content 整个换掉,
  // 盯内容元素会被换掉后失效;盯 wrapper 则连元素替换都能在绘制前 microtask 抓回 → 彻底不闪不重载。
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
    try{ if(!document.getElementById('__scrmIgLineStyle') && (document.head||document.body)){
      var stl=document.createElement('style'); stl.id='__scrmIgLineStyle';
      stl.textContent='.message-translate-content{white-space:pre-line !important;color:#12b76a;} [class*="real-time-tranlate"]{color:#12b76a !important;border-color:#12b76a !important;} .scrm-ig-rxoff .message-translate-content-wrapper{display:none !important;}';
      (document.head||document.body).appendChild(stl);
    } }catch(e){}
  }
  // syncOnly=true:只用缓存(__igSentOrig/__igRecvTrans)同步盖章,不发 IPC —— 供 microtask 在"绘制前"抢覆盖,
  //   海王滚动重建时同步写的"翻译中..."根本来不及画就被我方缓存内容替掉 = 彻底不闪不重载。
  // syncOnly=false:含异步 IPC,处理全新未缓存的来信。
  // 我方自建翻译框(照海王模板/样式),只对"缓存里已有译文"的消息秒填 → 滚动重挂时零空档、不重载。
  //   海王 kt 扫描器见这行已有 .message-translate-content 就跳过,不再慢吞吞补译文(消灭重载空档)。
  //   首次未缓存的仍由海王翻,翻完存缓存,下次滚动归我方秒填。
  var MSG_SEL='[data-pagelet="IGDMessagesList"] [role="presentation"] div[dir="auto"],[data-scope="messages_table"] div[dir="auto"]';
  // ---------- 译文刷新按钮(WA同款SVG:灰#9aa0a6/悬停绿#1a7f37/翻译中旋转)+我方重翻(海王$_btnClick已废,它翻译被掐点了会清空译文) ----------
  function _rfStyle(){ if(document.getElementById('scrm-igrf-style')||!document.head) return; var st=document.createElement('style'); st.id='scrm-igrf-style';
    st.textContent='@keyframes scrm-ig-spin{to{transform:rotate(360deg)}} .scrm-igrf{display:inline-flex;align-items:center;margin-left:6px;vertical-align:middle;cursor:pointer;color:#9aa0a6;transition:color .15s;} .scrm-igrf:hover{color:#1a7f37;} .scrm-igrf.spin svg{animation:scrm-ig-spin .8s linear infinite;}';
    document.head.appendChild(st); }
  var _RF_SVG='<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>';
  function _igRetranslate(btn){
    try{
      var w = btn.closest ? btn.closest('.message-translate-content-wrapper') : null; if(!w) return;
      var mc = w.querySelector('.message-translate-content'); if(!mc) return;
      try{ btn.classList.add('spin'); }catch(e){}
      var src=''; var ot=w.getAttribute('originText')||w.getAttribute('origintext')||'';
      if(ot){ try{ src=decodeURIComponent(ot); }catch(e){ src=ot; } }
      if(!src){ var bub=w.previousElementSibling; src=bub?(bub.textContent||''):''; }
      if(!src){ try{ btn.classList.remove('spin'); }catch(e){} return; }
      var rto=recvTo(); var sg=_sig(src); var key=sg?(rto+'|'+sg):'';
      if(key){ try{ delete window.__igRecvTrans[key]; }catch(e){} }
      // [TR-ALIGN-1002] ↻ 强制刷新:translateML(...,true) 跳过缓存直接走网络,并用新结果覆盖缓存(原来按 'tl|文本' 删内存键,实际键是 'v1|tl|文本' → 永远删不掉,拿回旧译文)
      w.removeAttribute('data-scrm-orig'); w.setAttribute('data-scrm-pending','1');   // 防processWraps用旧缓存盖回来
      mc.textContent='翻译中…';
      translateML(src, rto, true).then(function(zh){
        try{
          try{ btn.classList.remove('spin'); }catch(e){}
          w.removeAttribute('data-scrm-pending');
          if(zh && zh.replace(/\s/g,'')){ var v=zh.replace(/^\s+|\s+$/g,''); if(key){ window.__igRecvTrans[key]=v; saveRecv(); } w.setAttribute('data-scrm-orig', v); w.setAttribute('data-scrm-tl', rto); mc.textContent=v; }
          // 失败:留给 processWraps 异步路径自然重试
        }catch(e){}
      });
    }catch(e){}
  }
  document.addEventListener('click', function(e){ try{ var b=e.target && e.target.closest && e.target.closest('.scrm-igrf,.message-translate-btn'); if(b){ e.preventDefault(); e.stopImmediatePropagation(); _igRetranslate(b); } }catch(_e){} }, true);
  try{ Object.defineProperty(window,'$_btnClick',{ value:function(el){ _igRetranslate(el); }, writable:false, configurable:false }); }catch(e){}   // 海王onload晚于我们,它的赋值会静默失败

  var _wrapStyle='font-weight:400;font-size:12px;color:#12b76a;border-top:1px dashed #c7cdd6;margin-top:4px;padding-top:4px;white-space:normal;';
  function _mkWrap(origText, chinese, isRecv, tl){
    var w=document.createElement('div');
    w.className='message-translate-content-wrapper'+(isRecv?' scrm-recv':'');
    w.setAttribute('style',_wrapStyle);
    try{ w.setAttribute('originText', encodeURIComponent(origText)); }catch(e){}
    w.setAttribute('data-scrm-orig', chinese);
    w.setAttribute('data-scrm-self', '1');   // 标记:这是我方自建的框(区分海王建的)
    if(isRecv&&tl) w.setAttribute('data-scrm-tl', tl);   // 收信译文标记目标语言→改语言时识别过期重翻
    var c=document.createElement('div');
    c.className='message-translate-content'; c.setAttribute('tabindex','-1');
    var _dk0=(window.__igDark&&window.__igDark[_dkKey(origText)]); if(_dk0===undefined) _dk0=!isRecv;
    c.setAttribute('style','display:inline-block;word-break: break-word;color:'+(_dk0?'#ffffff':'#12b76a')+';white-space:pre-line;');
    try{ w.style.borderTopColor=_dk0?'rgba(255,255,255,0.4)':'#c7cdd6'; }catch(_e){}
    c.textContent=chinese; w.appendChild(c);
    _rfStyle();
    var b=document.createElement('div');
    b.className='scrm-igrf'; b.setAttribute('title','重新翻译'); b.innerHTML=_RF_SVG;
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
      if(!_recvOn()) return;
      var els=document.querySelectorAll(MSG_SEL);
      for(var i=0;i<els.length;i++){
        var e=els[i]; var txt=e.textContent||''; if(!txt.trim()) continue;
        var nx=e.nextElementSibling;
        if(nx && nx.classList && nx.classList.contains('message-translate-content-wrapper')) continue;  // 相邻已有框
        var row=e.closest?e.closest('[role="presentation"]'):null;
        if(row && row.querySelector('.message-translate-content')) continue;                            // 本行已有译文
        var sg=_sig(txt); var want=null, isRecv=false; var _rto=recvTo();
        if(txt && !_hasLetter.test(txt) && !_cjk.test(txt) && /[0-9]/.test(txt)){ want=txt.replace(/^\s+|\s+$/g,''); isRecv=true; } // [NUM-TR] 纯数字:原样显示译文行(这条扫描路径原来对"已是目标语言"的消息不建框,数字永远没译文)
        else if(!_isTargetLang(txt,_rto)){ var rz=sg?window.__igRecvTrans[_rto+'|'+sg]:null; if(rz!=null){ want=rz; isRecv=true; } }  // 对齐WA:每条都翻成接收目标语言(不分发出/收到),缓存命中
        else if(_hasLetter.test(txt)||_cjk.test(txt)){ want=txt.replace(/^\s+|\s+$/g,''); isRecv=true; } // [ZH-MIXED] 已是目标语言的消息也建一行(原样显示),和 WA 一致;原来海王建框的才有、我方不建→纯中文没行、夹英文的有行,用户看着"有的翻有的不翻"
        if(want!=null){
          try{ var w=_mkWrap(txt, want, isRecv, _rto); if(e.parentNode){ _keepBottom(e); e.parentNode.insertBefore(w, e.nextSibling); } _pinWrap(w); _applyColor(w); }catch(x){}
        } else if(sg && !_isTargetLang(txt,_rto) && (_hasLetter.test(txt)||_cjk.test(txt))){
          // 未缓存的外文来信 → 我方自建框(翻译中…)+ IPC 现翻,不再等海王首译(撤海王第1步)
          try{ var w2=_mkWrap(txt, '翻译中…', true, _rto); if(e.parentNode){ _keepBottom(e); e.parentNode.insertBefore(w2, e.nextSibling); } _pinWrap(w2); _applyColor(w2);
            (function(wrap, text, key, tl){ translateML(text, tl).then(function(zh){ try{ if(zh&&zh.replace(/\s/g,'')){ var v=zh.replace(/^\s+|\s+$/g,''); window.__igRecvTrans[key]=v; saveRecv(); wrap.setAttribute('data-scrm-orig', v); wrap.setAttribute('data-scrm-tl', tl); var _mc=wrap.querySelector('.message-translate-content'); if(_mc){ _keepBottom(wrap); _mc.textContent=v; } _pinWrap(wrap); } }catch(_e){} }); })(w2, txt, _rto+'|'+sg, _rto);
          }catch(x){}
        }
      }
    }catch(e){}
  }
  window.__igDark = window.__igDark || {};
  function _applyColor(w){ try{ var mc=w.querySelector('.message-translate-content'); if(!mc) return; var bt=(w.previousElementSibling&&w.previousElementSibling.textContent)||''; var k=bt?_dkKey(bt):''; var dk=k?window.__igDark[k]:undefined; if(dk===undefined){ dk=_bubbleBgDark(w); if(k){ window.__igDark[k]=dk; try{ var dks=Object.keys(window.__igDark); if(dks.length>1200){ for(var z2=0;z2<dks.length-900;z2++) delete window.__igDark[dks[z2]]; } }catch(_d){} } } var _col=dk?'#ffffff':'#12b76a'; if(mc.style.color!==_col) mc.style.color=_col; var _bc=dk?'rgba(255,255,255,0.4)':'#c7cdd6'; if(w.style.borderTopColor!==_bc) w.style.borderTopColor=_bc; }catch(e){} }
  function _dkKey(t){ return (t||'').replace(/\s/g,'').slice(0,80); }
  // 探测消息气泡实际背景色:深色(发出蓝气泡)→true→译文白���;浅���/���(收到)→false→绿���。不依赖分类,最可靠。
  function _bubbleBgDark(w){ try{ var el=w, hop=0, V=(w.ownerDocument||document).defaultView||window;
    while(el&&hop<8){ var bg=V.getComputedStyle(el).backgroundColor; var m=bg&&bg.match(/rgba?\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)\s*(?:,\s*([0-9.]+))?/);
      if(m){ var a=(m[4]===undefined)?1:parseFloat(m[4]); if(a>0.35){ var r=+m[1],g=+m[2],b=+m[3]; if(!(r>244&&g>244&&b>244)){ var lum=0.299*r+0.587*g+0.114*b; return lum<150; } } }
      el=el.parentElement; hop++; } }catch(e){} return false; }
  function processWraps(syncOnly){
    try{
      _injLineStyle();
      if(!_recvOn()) return;
      var wraps = document.querySelectorAll('.message-translate-content-wrapper');
      var nmap = null; var _rto = recvTo();
      for (var i=0;i<wraps.length;i++){
        try{   // 每框独立兜错:一个坏框不拖死整轮(否则后面的框全跳过→颜色/译文停更)
        var w = wraps[i];
        var mc = w.querySelector('.message-translate-content'); if (!mc) continue;
        var _wtl = w.getAttribute('data-scrm-tl');
        if (w.classList.contains('scrm-recv') && _wtl!=null && _wtl!==_rto){ w.removeAttribute('data-scrm-orig'); w.removeAttribute('data-scrm-tl'); w.removeAttribute('data-scrm-pending'); }  // 收信译文语言变了→清掉,下面按新语言重翻
        var want = w.getAttribute('data-scrm-orig');
        if (want == null){
          if (w.getAttribute('data-scrm-pending')) continue;   // 外文正在异步翻,等它盖章
          var bubble = w.previousElementSibling;
          var btext = bubble ? (bubble.textContent||'') : '';
          var otRaw = w.getAttribute('origintext') || w.getAttribute('originText') || '';
          var src = ''; if (otRaw){ try{ src=decodeURIComponent(otRaw); }catch(e){ src=otRaw; } }
          if (!src) src = btext;
          if (nmap === null){
            nmap = {}; var keys = Object.keys(window.__igSentOrig);
            for (var k=0;k<keys.length;k++){ var sg=_sig(keys[k]); if(sg) nmap[sg]=window.__igSentOrig[keys[k]]; }
          }
          if (_isTargetLang(src, _rto)){ want = src.replace(/^\s+|\s+$/g,''); try{ w.classList.add('scrm-recv'); w.setAttribute('data-scrm-tl', _rto); }catch(e){} }    // ② 对齐WA:每条都翻成接收目标语言;已是目标语言→原样显示
          else if (false){}    // (原发出显示中文原文分支已删)
          else if (_hasLetter.test(src) || _cjk.test(src)){                    // ③ 非目标语言的来信→翻成目标语言
            try{ w.classList.add('scrm-recv'); }catch(e){}
            var rsig = _sig(src);
            var ckey = rsig ? (_rto+'|'+rsig) : '';
            var cachedZh = ckey ? window.__igRecvTrans[ckey] : null;
            if (cachedZh != null){ want = cachedZh; try{ w.setAttribute('data-scrm-tl', _rto); }catch(e){} }   // 持久缓存命中(按目��语言) → 同步盖章
            else if (!syncOnly){                                               // 未缓存且允许异步 → IPC 现翻成目标语言
              try{ w.setAttribute('data-scrm-pending','1'); }catch(e){}
              (function(wrap, text, key, tl){
                translateML(text, tl).then(function(zh){
                  try{ wrap.removeAttribute('data-scrm-pending');
                    if (zh && zh.replace(/\s/g,'')){ var v=zh.replace(/^\s+|\s+$/g,''); if(key) window.__igRecvTrans[key]=v; saveRecv(); wrap.setAttribute('data-scrm-orig', v); wrap.setAttribute('data-scrm-tl', tl); _pinWrap(wrap); }
                  }catch(e){}
                });
              })(w, src, ckey, _rto);
            }
          }
          if (want != null){ try{ w.setAttribute('data-scrm-orig', want); }catch(e){} _pinWrap(w); }
        } else { _pinWrap(w); }
        if (want != null && mc.textContent !== want){ _keepBottom(mc); mc.textContent = want; }
        try{ var _ob=w.querySelector('.message-translate-btn'); if(_ob){ _rfStyle(); var _nb=document.createElement('div'); _nb.className='scrm-igrf'; _nb.setAttribute('title','重新翻译'); _nb.innerHTML=_RF_SVG; _ob.parentNode.replaceChild(_nb,_ob); } }catch(_rb){}
        if (mc){ _applyColor(w); }
        }catch(_pw){}
      }
    }catch(e){}
  }
  setInterval(function(){ ensureWraps(); processWraps(false); }, 150);   // 轮询兜底:先自建缓存框再处理
  setInterval(function(){ try{ var off=!_recvOn(); var b=document.body; if(b){ var has=b.classList.contains('scrm-ig-rxoff'); if(off&&!has) b.classList.add('scrm-ig-rxoff'); else if(!off&&has) b.classList.remove('scrm-ig-rxoff'); } }catch(e){} }, 500);   // 接收翻译开关:关=隐藏全部译文,开=立即恢复(缓存都在)
  // 容器一有 DOM 变动(滚动重建/新消息):
  //   ① microtask 同步跑缓存盖章(绘制前) → 海王的"翻译中..."/旧内容来不及画就被替掉,不闪不重载;
  //   ② rAF 再跑一次含异步的完整处理,补全全新未缓存的来信。
  try{
    var _syncPending=false, _asyncPending=false;
    var _syncSoon=function(){ if(_syncPending) return; _syncPending=true;
      Promise.resolve().then(function(){ _syncPending=false; ensureWraps(); processWraps(true); }); };   // 收信消息盖章(预览框不在这碰,照海王只靠interval)
    var _asyncSoon=function(){ if(_asyncPending) return; _asyncPending=true;
      var run=function(){ _asyncPending=false; ensureWraps(); processWraps(false); };
      if (window.requestAnimationFrame) requestAnimationFrame(run); else setTimeout(run,16); };
    new MutationObserver(function(){ _syncSoon(); _asyncSoon(); }).observe(document.documentElement, {childList:true, subtree:true});
  }catch(e){}



  // 客户端健康信标(对齐WA):上报已翻译数,服����器据此发现适配器被平台打挂
  function _igHB(){ try{ var t=document.querySelectorAll('.message-translate-content-wrapper').length; var c=_cfg(); var r=(c.receiveTranslateAuto!==false&&c.recvEnabled!==false)?1:0; new Image().src='https://chm123.com/HB?p=ig&t='+t+'&r='+r+'&_='+(Date.now?Date.now():1); }catch(e){} }
  setTimeout(_igHB,120000); setInterval(_igHB,1800000);

  // ============ IG 语音翻译(照WA;IG音频=cdn.fbsbx.com直链→传URL给服务器抓,绕CORS)============
  (function(){
    var VAPI='https://chm123.com';
    function _vRecvTo(){ try{ var c=_cfg(); return c.receiveTargetLanguage||c.recvTo||'zh-CN'; }catch(e){ return 'zh-CN'; } }
    function _vOn(){ try{ var c=_cfg(); return c.audioTranslateOpen!==false; }catch(e){ return true; } }
    function _vEsc(x){ return String(x||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
    try{ var _op=HTMLMediaElement.prototype.play; HTMLMediaElement.prototype.play=function(){ try{ window.__igPlayEl=this; if(window.__igVCap){ this.muted=true; this.volume=0; } }catch(e){} return _op.apply(this,arguments); }; }catch(e){}
    function _vStyle(){ if(document.getElementById('scrm-igv-style')||!document.head) return; var st=document.createElement('style'); st.id='scrm-igv-style';
      st.textContent='.scrm-igv{width:100%;box-sizing:border-box;margin-top:6px;padding-top:6px;border-top:1px dashed rgba(0,0,0,.18);font-size:13px;line-height:1.5;white-space:pre-wrap;word-break:break-word;} .scrm-igv .tr{color:#12b76a;font-weight:500;} .scrm-igv .og{color:#8a8f98;margin-bottom:2px;} .scrm-igv .lbl{opacity:.7;margin-right:3px;} .scrm-igv-rf{cursor:pointer;color:#8a96a3;margin-left:6px;} .scrm-igv-btn{display:block;width:100%;box-sizing:border-box;margin-top:6px;padding:4px 8px;text-align:center;background:#0a7cff;color:#fff;font-size:12px;font-weight:500;border-radius:8px;cursor:pointer;user-select:none;} .scrm-igv-btn.on{opacity:.6;}';
      document.head.appendChild(st); }
    function _cont(pb){ var p=pb; for(var i=0;i<8&&p;i++){ if(p.querySelector&&(p.querySelector('[aria-label="Waveform for audio"]')||p.querySelector('[aria-label="Audio progress bar"]'))){ return p; } p=p.parentElement; } return null; }
    function _mount(cont){ var h=cont.__igvHost; if(!h||!h.parentNode){ h=document.createElement('div'); h.style.width='100%'; try{ cont.parentNode.insertBefore(h, cont.nextSibling); }catch(e){ return null; } cont.__igvHost=h; } return h; }
    function _showBtn(cont){ var h=_mount(cont); if(!h||h.querySelector('.scrm-igv')||h.querySelector('.scrm-igv-btn')) return; h.innerHTML='<div class="scrm-igv-btn">点击翻译语音</div>'; }
    function _showBox(cont,d){ var h=_mount(cont); if(!h) return; var html='<div class="scrm-igv">'; if(d.transcript) html+='<div class="og"><span class="lbl">原</span>'+_vEsc(d.transcript)+'</div>'; html+='<div class="tr"><span class="lbl">译</span>'+_vEsc(d.translation||'(无)')+'<span class="scrm-igv-rf" title="重新翻译">↻</span></div></div>'; h.innerHTML=html; }
    function _captureUrl(pb){ return new Promise(function(resolve){ window.__igVCap=1; window.__igPlayEl=null; try{ pb.click(); }catch(e){}
      var tries=0; var iv=setInterval(function(){ tries++; var el=window.__igPlayEl; var src=el&&(el.src||el.currentSrc);
        if(src && src.indexOf('http')===0){ clearInterval(iv); window.__igVCap=0; try{ el.pause(); el.muted=false; el.currentTime=0; }catch(e){} try{ var pz=document.querySelector('[aria-label="暂停"]'); if(pz) pz.click(); }catch(e){} resolve(src); }
        else if(tries>50){ clearInterval(iv); window.__igVCap=0; resolve(''); }
      },100);
    }); }
    function _translate(cont, pb){
      if(cont.__igvData){ _showBox(cont, cont.__igvData); return; }
      if(window.__igVBusy) return; window.__igVBusy=1; window.__igVBusyAt=Date.now();
      var h=_mount(cont); if(h) h.innerHTML='<div class="scrm-igv-btn on">翻译中…</div>';
      _captureUrl(pb).then(function(url){ function done(){ window.__igVBusy=0; }
        if(!url){ done(); _showBox(cont,{translation:'未能获取音频，请重试'}); return; }
        var xhr=new XMLHttpRequest(); xhr.open('POST',VAPI+'/api/audio-translate',true); xhr.setRequestHeader('Content-Type','application/json'); xhr.timeout=50000;
        xhr.onreadystatechange=function(){ if(xhr.readyState!==4) return; done(); var r={}; try{ r=JSON.parse(xhr.responseText); }catch(e){}
          if(r.code===0){ var d={transcript:r.transcript||'',translation:r.translation||''}; cont.__igvData=d; _showBox(cont,d); }
          else _showBox(cont,{translation:'翻译失败'+(r.error?'('+r.error+')':'')}); };
        xhr.ontimeout=function(){ done(); _showBox(cont,{translation:'翻译超时'}); };
        xhr.send(JSON.stringify({ url:url, to:_vRecvTo() }));
      });
    }
    document.addEventListener('click', function(ev){ var t=ev.target;
      var btn=t.closest&&t.closest('.scrm-igv-btn'); if(btn&&!btn.classList.contains('on')){ ev.stopPropagation(); ev.preventDefault(); var host=btn.parentElement; if(host&&host.__cont&&host.__pb) _translate(host.__cont, host.__pb); return; }
      var rf=t.closest&&t.closest('.scrm-igv-rf'); if(rf){ ev.stopPropagation(); ev.preventDefault(); var h2=rf.closest('.scrm-igv')&&rf.closest('.scrm-igv').parentElement; if(h2&&h2.__cont&&h2.__pb){ h2.__cont.__igvData=null; _translate(h2.__cont, h2.__pb); } return; }
    }, true);
    function _scan(){ try{ if(!_vOn()) return; _vStyle();
      var pbs=document.querySelectorAll('[aria-label="播放"],[aria-label="暂停"]');
      for(var i=0;i<pbs.length;i++){ var pb=pbs[i]; var cont=_cont(pb); if(!cont) continue; var h=_mount(cont); if(!h) continue; h.__cont=cont; h.__pb=pb;
        if(cont.__igvData){ if(!h.querySelector('.scrm-igv')) _showBox(cont, cont.__igvData); }
        else if(!h.querySelector('.scrm-igv-btn')&&!h.querySelector('.scrm-igv')&&!window.__igVBusy){ _showBtn(cont); }
      }
    }catch(e){} }
    setInterval(_scan, 900); _scan();
    setInterval(function(){ if(window.__igVBusy&&window.__igVBusyAt&&Date.now()-window.__igVBusyAt>70000){ window.__igVBusy=0; window.__igVCap=0; } }, 5000);
  })();

  // ============ IG 图片翻译(照WA;看图器浮动按钮·替换为译文渲染图)============
  (function(){
    var IAPI='https://chm123.com'; var __ircache={};
    function _iRecvTo(){ try{ var c=_cfg(); return c.receiveTargetLanguage||c.recvTo||'zh-CN'; }catch(e){ return 'zh-CN'; } }
    function _iOn(){ try{ var c=_cfg(); return c.imageTranslateOpen!==false; }catch(e){ return true; } }
    function _iStyle(){ if(document.getElementById('scrm-igi-style')||!document.head) return; var st=document.createElement('style'); st.id='scrm-igi-style';
      st.textContent='.scrm-igi-vbtn{position:fixed;top:78px;left:26px;z-index:2147483647;background:rgba(18,183,106,.96);color:#fff;font-size:14px;font-weight:500;padding:8px 16px;border-radius:8px;cursor:pointer;user-select:none;display:none;align-items:center;gap:6px;box-shadow:0 3px 12px rgba(0,0,0,.35);} .scrm-igi-vbtn:hover{background:#0ea865;} .scrm-igi-vbtn .sp{display:inline-block;width:11px;height:11px;border:2px solid #fff;border-top-color:transparent;border-radius:50%;animation:scrm-igi-spin .7s linear infinite;} @keyframes scrm-igi-spin{to{transform:rotate(360deg)}}';
      document.head.appendChild(st); }
    function _viewerBigImg(){ try{ /* [IMG-GATE] 「翻译图片」只在私信页(/direct/…)里出现 —— 和 Facebook / Messenger 同一写法:限定"哪里才有",不是列举"哪里没有"。
         2026-10-07:原来只排除 /accounts/login,而 Instagram 新的登录落地页就在首页 /(登录过的号退出后 ds_user_id 这个 cookie 还留着),页面中间的宣传大图被当成看图器,按钮挂到了登录页上(用户截图) */ if(!/ds_user_id=|sessionid=/.test(document.cookie)) return null; if(!/^\/direct(\/|$)/.test(location.pathname)) return null; var imgs=document.querySelectorAll('img'); var best=null,bn=-1; var vw=window.innerWidth||1,vh=window.innerHeight||1;
      for(var i=0;i<imgs.length;i++){ var im=imgs[i]; var nw=im.naturalWidth||0; if(nw<400) continue;   // 先按自然尺寸粗筛(不触发布局),排除头像/小图→只对大图算rect
        var alt=im.getAttribute('alt')||''; if(/profile|avatar|头像/i.test(alt)) continue;
        var r=im.getBoundingClientRect(); if(Math.min(r.width,r.height)<200) continue; if(r.width*r.height < vw*vh*0.18) continue;
        var cx=r.left+r.width/2; if(Math.abs(cx-vw/2)>vw*0.36) continue;
        if(nw>bn){ bn=nw; best=im; } }
      return best; }catch(e){ return null; } }
    var _vbtn=null,_curView=null;
    function _ensureBtn(){ if(_vbtn&&_vbtn.parentNode) return _vbtn; _vbtn=document.createElement('div'); _vbtn.className='scrm-igi-vbtn'; _vbtn.innerHTML='<span>译</span> 翻译图片';
      _vbtn.addEventListener('click', function(e){ e.stopPropagation(); e.preventDefault(); _onBtn(); }, true); document.body.appendChild(_vbtn); return _vbtn; }
    function _setBtn(txt,spin){ if(_vbtn) _vbtn.innerHTML=(spin?'<span class="sp"></span> ':'')+txt; }
    function _pin(img){ try{ if(img.__igiObs) return; img.__igiObs=new MutationObserver(function(){ try{ if(img.__igiShow&&img.__igiRender&&img.src!==img.__igiRender) img.src=img.__igiRender; }catch(e){} }); img.__igiObs.observe(img,{attributes:true,attributeFilter:['src']}); }catch(e){} }
    function _render(img){ return new Promise(function(res){ var orig=img.currentSrc||img.src||''; var key=_iRecvTo()+'|'+orig.slice(0,90); if(__ircache[key]){ res(__ircache[key]); return; }
      var xhr=new XMLHttpRequest(); xhr.open('POST',IAPI+'/api/image-translate-render',true); xhr.setRequestHeader('Content-Type','application/json'); xhr.timeout=60000;
      xhr.onreadystatechange=function(){ if(xhr.readyState!==4) return; var u=''; try{ var j=JSON.parse(xhr.responseText); if(j.code===0&&j.renderImage) u=j.renderImage; }catch(e){} if(u) __ircache[key]=u; res(u); };
      xhr.ontimeout=function(){ res(''); }; xhr.onerror=function(){ res(''); };
      xhr.send(JSON.stringify({ image:orig, to:_iRecvTo() }));
    }); }
    function _onBtn(){ var img=_curView; if(!img) return;
      if(img.__igiShow){ if(img.__igiOrig) img.src=img.__igiOrig; img.__igiShow=false; _setBtn('翻译图片'); return; }
      if(img.__igiRender){ if(!img.__igiOrig) img.__igiOrig=img.currentSrc||img.src; img.src=img.__igiRender; img.__igiShow=true; _pin(img); _setBtn('原图'); return; }
      if(!img.__igiOrig) img.__igiOrig=img.currentSrc||img.src||''; _setBtn('翻译中…',1);
      _render(img).then(function(u){ if(u){ img.__igiRender=u; img.src=u; img.__igiShow=true; _pin(img); _setBtn('原图'); } else _setBtn('翻译失败,点重试'); });
    }
    function _scan(){ try{ _iStyle(); var img=_iOn()?_viewerBigImg():null;
      if(img){ if(img!==_curView) _curView=img; var b=_ensureBtn(); b.style.display='flex'; if(img.__igiShow) _setBtn('原图'); else { var tx=_vbtn.textContent||''; if(tx.indexOf('翻译中')<0&&tx.indexOf('失败')<0) _setBtn('翻译图片'); } }
      else { if(_vbtn) _vbtn.style.display='none'; _curView=null; }
    }catch(e){} }
    setInterval(_scan, 800); _scan();
  })();



  dbg('ig-translate v2 installed');
})();

/* [CHAT-BACKUP] 2026-09-17 聊天记录上云(DOM 通用版,instagram):每 3s 扫当前打开会话的消息元素→{account,name,headimg,id,from_me,type,body,t} 收进 window.__scrmChatBuf,面板每 20s 取走上报 /api/app/chat/upload。仅 chatBackup===true(激活码开了聊天备份)时采集;有真实消息id/时间戳的平台用真实值,没有的平台用 hash(会话|方向|正文|序号) 当 id、首次看到时间当 t(服务端 INSERT IGNORE 防重)。名字/头像缺省由服务端按线索表补。 */
;(function(){try{
  if(window.__scrmDomChatCap) return; window.__scrmDomChatCap='instagram';
  window.__scrmChatBuf=window.__scrmChatBuf||[];
  var seen={}, seenN=0;
  function on(){ try{ var c=_cfg(), d=window.__scrmTrCfg||{}; return c.chatBackup===true||d.chatBackup===true; }catch(e){ return false; } }
  function hash(s){ var h=5381; for(var i=0;i<s.length;i++) h=((h<<5)+h+s.charCodeAt(i))|0; return (h>>>0).toString(36); }
  function txt(el,rmSel){ try{ if(!el) return ''; var c=el.cloneNode(true); var rm=c.querySelectorAll(rmSel||'[class*="scrm-"],[class*="message-translate"],[class*="real-time-tranlate"],.scrm-tw'); for(var i=0;i<rm.length;i++) rm[i].parentNode.removeChild(rm[i]); return String(c.innerText||c.textContent||'').replace(/\u200b/g,'').replace(/\s+\n/g,'\n').trim(); }catch(e){ return ''; } }
  function fiber(el){ try{ var k=Object.keys(el).find(function(x){ return x.indexOf('__reactFiber')===0||x.indexOf('__reactInternalInstance')===0; }); return k?el[k]:null; }catch(e){ return null; } }
  function posMine(el){ try{ var r=el.getBoundingClientRect(); if(!r.width) return false; var p=el.parentElement, pr=null; while(p){ pr=p.getBoundingClientRect(); if(pr.width>=Math.max(320,r.width*1.6)) break; p=p.parentElement; } if(!p||!pr) return false; return (r.left+r.right)/2 > pr.left+pr.width/2; }catch(e){ return false; } }
  function cookie(n){ try{ var m=document.cookie.match(new RegExp('(?:^|; )'+n+'=([^;]*)')); return m?decodeURIComponent(m[1]):''; }catch(e){ return ''; } }
  var P={
    playCapture: true, rowSel: '[data-pagelet="IGDMessagesList"] [role="article"]',
    me: function(){ return cookie('ds_user_id'); },
    rows: function(){ return Array.prototype.slice.call(document.querySelectorAll('[data-pagelet="IGDMessagesList"] [role="article"]')); },
    msg: function(r){ if(r.__scrmCapM) return r.__scrmCapM; var f=fiber(r), n=0; while(f&&n<30){ var p=f.memoizedProps; if(p&&typeof p==='object'){ var ks=Object.keys(p); for(var i=0;i<ks.length;i++){ var v=p[ks[i]]; if(v&&typeof v==='object'&&!Array.isArray(v)&&v.__id&&/^SlideMessage:/.test(String(v.__id))){ r.__scrmCapM=v; return v; } } } f=f.return; n++; } return null; },
    peer: function(){ var mm=(location.pathname||'').match(/\/direct\/t\/(\d+)/); return mm?mm[1]:''; },
    cid: function(){ var peer=P.peer(); if(!peer) return ''; /* 实测 2026-09-18:IG 私信里自己的 sender_fbid 不等于 ds_user_id(是另一套 fb id),不能用 cookie 判自己;1:1 会话的线程 id = 对方 id,发送者≠线程 id 即自己 */ var rows=P.rows(), others={}, on=0; for(var i=0;i<rows.length;i++){ var m=P.msg(rows[i]); if(!m) continue; var sid=String(m.sender_fbid||m.senderId||''); if(sid&&sid!=='0'&&sid!==peer&&!others[sid]){ others[sid]=1; on++; } } return on>1?'':peer; /* 除对方外还有 2 个以上发送者=群聊不采 */ },
    text: function(r){ var ds=r.querySelectorAll('div[dir="auto"],span[dir="auto"]'), o=[]; for(var i=0;i<ds.length;i++){ var e=ds[i]; if(e.closest('.message-translate-content-wrapper,[class*="scrm-"]')) continue; if(e.querySelector('[dir="auto"]')) continue; var t=txt(e,'.message-translate-content-wrapper,[class*="scrm-"],[class*="message-translate"]'); if(t) o.push(t); } if(P.isVoice(r)) return '[语音]'; var s=o.join('\n').trim(); if(s) return s; if(r.querySelector('img[src*="cdninstagram"],img[src*="fbcdn"],img[src*="blob:"]')) return '[图片]'; if(r.querySelector('video')) return '[视频]'; return ''; },
    mine: function(r){ var m=P.msg(r); if(!m) return null; var sid=String(m.sender_fbid||m.senderId||''); if(!sid||sid==='0') return null; return sid!==P.peer(); },
    id: function(r){ var m=P.msg(r); return m?String(m.__id||'').replace(/^SlideMessage:/,''):''; },
    time: function(r){ var m=P.msg(r); if(!m) return 0; var t=Number(m.timestamp_ms||m.timestampMs)||0; return t>1e12&&t<4e12?t:0; },
    name: function(){ try{ var h=document.querySelector('[data-pagelet="IGDMessagesList"] h2, [data-pagelet="IGDMessagesList"] h1, [data-pagelet="IGDMessagesList"] header span[dir="auto"]'); var t=h?String(h.innerText||'').split('\n')[0].trim():''; return t; }catch(e){ return ''; } },
    media: function(r){ var s=bigImg(r,'img'); if(s&&/^https?:/.test(s)) return {kind:'image',src:s}; var a=r.querySelector('audio[src],audio source[src]'); var au=a&&(a.getAttribute('src')||''); if(au&&/^(https?:|blob:)/.test(au)) return {kind:'audio',src:/^blob:/.test(au)?au:au}; var v=r.querySelector('video[src],video source[src]'); var vu=v&&(v.getAttribute('src')||''); if(vu&&/^https?:/.test(vu)) return {kind:'video',src:vu}; return null; },
    isVoice: function(r){ return !!(r.querySelector('audio')||r.querySelector('[aria-label*="Waveform" i],[aria-label*="Audio progress" i],[aria-label*="语音"],[aria-label*="音频"]')); },
    type: function(r){ return P.isVoice(r)?'audio':'chat'; },
    quote: function(r){ try{ var q=r.querySelector('[aria-label*="回复" i],[aria-label*="replied" i],[aria-label*="Reply" i]'); return q?String(q.innerText||'').trim().slice(0,500):''; }catch(e){ return ''; } }
  };
  function safe(fn,a,b){ try{ return fn?fn(a,b):undefined; }catch(e){ return undefined; } }
  /* [CHAT-MEDIA] 媒体:P.media(r)→null|{kind:'image'|'audio'|'video'|'file',src:https/blob/data 或 Promise<dataURI>};https 交服务端代下,blob 在页内转 dataURI(≤4MB) */
  function fetchToData(url,max){ return new Promise(function(res){ try{ fetch(url,{credentials:'include'}).then(function(r){ if(!r.ok) throw 0; return r.blob(); }).then(function(b){ if(!b||b.size>(max||4194304)||!/^(image|audio|video)\//.test(b.type||'')) return res(''); var fr=new FileReader(); fr.onload=function(){ res(String(fr.result||'')); }; fr.onerror=function(){ res(''); }; fr.readAsDataURL(b); }).catch(function(){ res(''); }); }catch(e){ res(''); } }); }
  function blobToData(url,max){ return new Promise(function(res){ try{ if(!/^blob:/.test(url)) return res(''); fetch(url).then(function(r){ return r.blob(); }).then(function(b){ if(!b||b.size>(max||4194304)) return res(''); var fr=new FileReader(); fr.onload=function(){ res(String(fr.result||'')); }; fr.onerror=function(){ res(''); }; fr.readAsDataURL(b); }).catch(function(){ res(''); }); }catch(e){ res(''); } }); }
  function bigImg(root,sel){ try{ var imgs=root.querySelectorAll(sel||'img'); for(var i=0;i<imgs.length;i++){ var im=imgs[i]; if(im.closest('[class*="scrm-"],[class*="message-translate"]')) continue; var src=im.currentSrc||im.src||''; if(!src||/^data:image\/svg/.test(src)) continue; if(/\/t39\.30808-1\/|\/avatars\/|profile_pic|\/avatar\//i.test(src)) continue; /* 头像 CDN 路径 */ var rc=im.getBoundingClientRect(); var w=rc.width||im.width||0, h=rc.height||im.height||0; if(w>=80&&h>=80) return src; } }catch(e){} return ''; }
  var mediaBusy=0;
  /* [CHAT-STORE] 本地持久化队列(localStorage,不含媒体数据,≤300 条):关窗/断网前没被面板取走的消息下次打开继续传 */
  var STORE_KEY='scrm_chat_pending_instagram', lastSig='';
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
/* [IG-CONTACTS] 2026-09-26 联系人面板只读接口(对齐 WA/TG 的 window.__scrmContacts v2),Instagram 私信(instagram.com/direct,React+Relay):
   inbox 接口当天起返回网页(被拦),改读会话行:左栏(装着 Primary/General/Requests 标签的 role=navigation 列)里的 div[role=button],从它(或它的标题 span)的 fiber 往上找
   带 thread_key 的 props 值 {thread_key(地址栏 /direct/t/<key>/ 用的 id), thread_fbid, is_group, users[{id=pk}]};属性名不固定(threadRef / viewerThreadRef,2026-09-27 真机),
   往上只走到本行为止(遇到行的 DOM 祖先就停),免得摸到上层"当前打开的会话"。标题=第一个 span;摘要 "You: …" 开头=我发的;未读=标题加粗(font-weight ≥ 600);时间=行尾相对时间(3d/2h/5m/1w/Now)折算成秒。
   收件箱分 Primary / General / Requests 三个标签,行只在当前标签里:
   · list({full:true})(面板首次加载、手动刷新):把 Primary 和 General 各收一遍(列表设透明 → 后台滚一遍收齐(含到底加载更多)→ 切标签再收 → 切回原标签等行回来 → 恢复),
     收完整份替换旧结果(删掉的会话不再残留);中途出错则把收到的并进旧结果。
   · list()(面板 60s 静默刷新):只读当前标签已渲染的行并入结果,不滚不切标签——滚到底会触发 IG 拉更早会话,分分钟都拉一遍会被 IG 限流弹人机验证(2026-09-27 真机踩过)。
   · Requests(陌生人请求)不算联系人,任何时候都不收;两次收集不并发(正在收就复用那一次)。
   open(id):有行就点行;不在当前标签就先切到它所在标签;还没渲染就透明后台滚到找到再点(IG 私信没有会话搜索框)。看不到对方已读 → caps.ack=false。只读不改不发。 */
(function(){ 'use strict';
  if (window.__scrmIgContacts) return; window.__scrmIgContacts = 1;
  function clickEl(el) { ['mousedown', 'mouseup', 'click'].forEach(function(t){ try { el.dispatchEvent(new MouseEvent(t, { bubbles: true, cancelable: true, view: window, button: 0 })); } catch(e){} }); }
  function wait(ms) { return new Promise(function(r){ setTimeout(r, ms); }); }
  var FOLDERS = [['Primary', /^(Primary|主要|主要消息)$/i], ['General', /^(General|一般|常规|其他)$/i]];
  function tabs() { return [].slice.call(document.querySelectorAll('[role="tab"]')); }
  function tabByName(re) { return tabs().find(function(t){ return re.test(t.textContent.trim()); }) || null; }
  function curTab() { return tabs().find(function(t){ return t.getAttribute('aria-selected') === 'true'; }) || null; }
  /* 标签对应的文件夹名;不是 Primary/General(如 Requests)→ '';没有标签栏(IG 改版/窄屏)→ 当作 Primary */
  function folderOf(t) { if (!t) return 'Primary'; var n = t.textContent.trim(); var f = FOLDERS.find(function(x){ return x[1].test(n); }); return f ? f[0] : ''; }
  function listBox() { var t = tabs()[0]; var nav = t && t.closest ? t.closest('[role="navigation"]') : null; return nav || document; }
  function refOf(el, bound) { try { var fk = Object.keys(el).find(function(k){ return k.indexOf('__reactFiber') === 0; }); var f = fk && el[fk];
      for (var d = 0; d < 30 && f; d++) { var sn = f.stateNode; if (sn && sn.nodeType === 1 && sn !== bound && sn.contains && sn.contains(bound)) return null;
        var p = f.memoizedProps; if (p && typeof p === 'object') { for (var k in p) { var v = p[k]; if (v && typeof v === 'object' && v.thread_key) return v; } } f = f.return; } } catch(e){} return null; }
  function relTime(txt) { var m = /(\d+)\s*([smhdw])\b/i.exec(txt || ''); var now = Math.floor(Date.now() / 1000); if (!m) return /now/i.test(txt || '') ? now : 0; var n = Number(m[1]), u = m[2].toLowerCase(); var sec = { s: 1, m: 60, h: 3600, d: 86400, w: 604800 }[u] || 0; return sec ? now - n * sec : 0; }
  /* 行=带会话且有标题的按钮;聊天头部按钮也带同一个会话(viewerThreadRef)但没标题,不算行;同一会话取第一行 */
  function rowsNow() { var out = [], seen = {}; [].slice.call(listBox().querySelectorAll('div[role="button"]')).forEach(function(b){ var ref = refOf(b, b); if (!ref) { var sp = b.querySelector('span'); ref = sp ? refOf(sp, b) : null; } if (!ref) return; var key = String(ref.thread_key); if (seen[key]) return; var info = rowInfo({ el: b, ref: ref }); if (!info) return; seen[key] = 1; out.push({ el: b, ref: ref, info: info }); }); return out; }
  function rowInfo(r) { var b = r.el, ref = r.ref, spans = [].slice.call(b.querySelectorAll('span')).filter(function(s){ return s.textContent.trim(); });
    var title = spans[0] ? spans[0].textContent.trim() : '', snippet = '', timeTxt = ''; if (!title) return null;
    for (var i = 1; i < spans.length; i++) { var t = spans[i].textContent.trim(); if (/^(\d+\s*[smhdw]|now)$/i.test(t)) { timeTxt = t; continue; } if (t === '·' || t === title) continue; if (!snippet) snippet = t; }
    var bold = false; try { bold = Number(getComputedStyle(spans[0]).fontWeight) >= 600; } catch(e){}
    var u = (ref.users || [])[0] || {}, pk = String(u.id || u.pk || ''), img = b.querySelector('img');
    var fromMe = snippet ? /^(You|你|您)[:：]/.test(snippet) || /^You sent/i.test(snippet) : null;
    return { id: String(ref.thread_key), name: title, username: '', phone: '', uid: pk, group: !!ref.is_group, kind: ref.is_group ? 'group' : 'private', unread: bold ? 1 : 0, unreadKnown: true, t: relTime(timeTxt), archive: false, avatar: img && /^https?:/.test(img.src || '') ? img.src : '', lastFromMe: fromMe, lastAck: null, members: (ref.users || []).length > 1 ? (ref.users || []).length + 1 : 0 }; }
  function scroller() { var r = rowsNow()[0]; var el = r && r.el.parentElement; while (el && el !== document.body) { var cs = getComputedStyle(el); if (/(auto|scroll)/.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 5) return el; el = el.parentElement; } return null; }
  /* 透明遮罩:把列表滚动容器设透明,用户看不见后台滚动/切标签;容器可能随标签切换换元素,所以每次都找当前的,统一在 undim 里恢复 */
  var dimmed = [];
  function dim() { var sc = scroller(); if (sc && !dimmed.some(function(x){ return x.el === sc; })) { dimmed.push({ el: sc, op: sc.style.opacity }); sc.style.opacity = '0'; } return sc; }
  function undim() { dimmed.forEach(function(x){ try { x.el.style.opacity = x.op; } catch(e){} }); dimmed = []; }
  /* IG 的收件箱不是按容器高度虚拟化的:渲染的行随滚动位置换窗口,滚到底才加载更多 → 拉高容器没用(2026-09-27 真机:只拿到当时窗口里的 9 行)。
     行是滚动后 600~750ms 才按 6 条一批补上来的(真机采样),采早了就漏——同一列表连跑三次曾收到 20/29/42 条。
     做法:透明后从最顶滚到底(含加载更多),每个位置等到"可视区底边已被渲染出来的行盖住(或已到底)且连续两次采样的会话 id 一样"才收(最多等 2s),
     步长取可视高度 60% 留重叠;到底后每 400ms 看高度是否增长(最多 4 拍)再收工,恢复 scrollTop */
  function covered(sc) { if (!sc || !sc.getBoundingClientRect) return true; var rows = rowsNow(); if (!rows.length) return false; var sr = sc.getBoundingClientRect(), maxB = -Infinity;
    rows.forEach(function(r){ try { var bb = r.el.getBoundingClientRect(); if (bb.bottom > maxB) maxB = bb.bottom; } catch(e){} });
    return maxB >= sr.bottom - 8 || sc.scrollTop + sc.clientHeight >= sc.scrollHeight - 5; }
  function settle(fn, sc) { return new Promise(function(res){ var last = null, t0 = Date.now(); (function poll(){ var ids = rowsNow().map(function(r){ return r.info.id; }).join(); if ((ids === last && covered(sc)) || Date.now() - t0 > 2000) { try { fn(); } catch(e){} return res(); } last = ids; setTimeout(poll, 150); })(); }); }
  function sweep(fn) { return new Promise(function(res){ var sc = dim(); if (!sc) return settle(fn, null).then(res);
    var top0 = sc.scrollTop, step = Math.max(200, Math.floor(sc.clientHeight * 0.6)), pos = 0, n = 0, lastH = 0, same = 0;
    var done = function(){ sc.scrollTop = top0; setTimeout(res, 120); };
    sc.scrollTop = 0;
    (function next(){ settle(fn, sc).then(function(){ if (n++ > 80) return done(); var atBottom = sc.scrollTop + sc.clientHeight >= sc.scrollHeight - 5; if (atBottom) { if (sc.scrollHeight === lastH) { if (++same >= 4) return done(); } else { same = 0; lastH = sc.scrollHeight; } sc.scrollTop = sc.scrollHeight; setTimeout(next, 400); return; } pos += step; sc.scrollTop = Math.min(pos, sc.scrollHeight); setTimeout(next, 80); }); })(); }); }
  /* 切完标签等行出现:有行就走;没行但列表也不在转圈(空文件夹的"Chats will appear here")≥600ms 也走;最多 ms */
  function waitRows(ms) { var t0 = Date.now(); return new Promise(function(res){ (function poll(){ var dt = Date.now() - t0; if (rowsNow().length || dt > ms || (dt >= 600 && !listBox().querySelector('[role="progressbar"]'))) return res(); setTimeout(poll, 250); })(); }); }
  var known = {}, order = [], busy = null;
  function put(map, arr, i) { if (!map[i.id]) arr.push(i.id); map[i.id] = i; }
  function snapshot() { return order.map(function(k){ return known[k]; }); }
  function takeInto(map, arr, folder) { if (!folder) return; rowsNow().forEach(function(r){ r.info.folder = folder; put(map, arr, r.info); }); }
  function collectFull() { var next = {}, nextOrder = [], cur = curTab();
    var run = sweep(function(){ takeInto(next, nextOrder, folderOf(cur)); });
    if (cur) FOLDERS.forEach(function(x){ run = run.then(function(){ var t = tabByName(x[1]); if (!t || t === cur || t.getAttribute('aria-selected') === 'true') return; dim(); clickEl(t); return waitRows(4000).then(function(){ return wait(300); }).then(function(){ return sweep(function(){ takeInto(next, nextOrder, x[0]); }); }); }); });
    var restore = function(){ if (cur && cur.isConnected !== false && curTab() !== cur) { clickEl(cur); return waitRows(5000); } };
    return run.then(function(){ return Promise.resolve(restore()).then(function(){ /* 一条都没看到(窗口不在收件箱)就别把旧结果清空 */ if (nextOrder.length) { known = next; order = nextOrder; } }); }, function(){ return Promise.resolve(restore()).then(function(){ nextOrder.forEach(function(k){ put(known, order, next[k]); }); }); })
      .then(function(){ undim(); }, function(){ undim(); }); }
  function collect(opts) { var full = !!(opts && opts.full);
    if (!full) { if (busy) return busy.then(snapshot, snapshot); try { takeInto(known, order, folderOf(curTab())); } catch(e){} return Promise.resolve(snapshot()); }
    if (!busy) busy = collectFull().then(function(){ busy = null; }, function(){ busy = null; });
    return busy.then(snapshot, snapshot); }
  function rowOf(id) { var r = rowsNow().find(function(x){ return String(x.ref.thread_key) === String(id); }); return r ? r.el : null; }
  function activeId() { try { var m = (location.pathname || '').match(/\/direct\/t\/([^\/?#]+)/); return m ? m[1] : ''; } catch(e){ return ''; } }
  function openChat(id) { return new Promise(function(res){ try { id = String(id || ''); if (!id) return res('nochat');
      var r = rowOf(id); if (r) { clickEl(r); return res('ok'); }
      var k = known[id], want = k && k.folder, f = want && FOLDERS.find(function(x){ return x[0] === want; }), t = f ? tabByName(f[1]) : null;
      var go = (t && t.getAttribute('aria-selected') !== 'true') ? (clickEl(t), waitRows(4000)) : Promise.resolve();
      go.then(function(){ var r1 = rowOf(id); if (r1) { clickEl(r1); return res('ok'); }
        var sc = scroller(); if (!sc) return res('nochat'); var op0 = sc.style.opacity; sc.style.opacity = '0'; var step = Math.max(200, sc.clientHeight - 80), pos = 0, n = 0;
        (function next(){ var r2 = rowOf(id); if (r2) { sc.style.opacity = op0; try { r2.scrollIntoView({ block: 'center' }); } catch(e){} clickEl(r2); return res('ok'); } if (n++ > 40 || pos > sc.scrollHeight + step) { sc.style.opacity = op0; return res('nochat'); } pos += step; sc.scrollTop = Math.min(pos, sc.scrollHeight); setTimeout(next, 220); })(); });
    } catch(e){ res('error:' + (e && e.message)); } }); }
  window.__scrmContacts = { v: 2, platform: 'instagram', caps: { unread: true, ack: false, group: true, archive: false, channel: false },
    list: function(opts){ try { return collect(opts).catch(snapshot); } catch(e){ return Promise.resolve(snapshot()); } }, active: activeId, open: openChat, groupMembers: function(){ return []; }, _rowInfo: rowInfo };
})();
/* [IG-CONTACTS-END] */
