/* __scrmPatchV1__ scrm-patch-linkedin v1.0 (2026-10-03) LinkedIn 私信自研翻译(照 X/LB/Snapchat/Discord 模板),替换旧第三方 preload 的翻译(它找的是外层页面,而 LinkedIn 的消息界面渲染在同源 iframe
   https://www.linkedin.com/preload/?_bprMode=vanilla 里 → 旧翻译从来没生效过)。
   [LI-FRAME] 补丁跑在外层页面(热更加载器只在外层跑);每秒找一次"装着消息界面的文档"(外层自己有 .msg-form 就用外层,否则找同源 iframe),找到就把整套翻译绑到那个文档/窗口上
   (document/window 用参数遮蔽,所有 DOM 查找、键盘/点击监听、样式注入都落在 iframe 里);文档换了(iframe 重建)就停掉旧实例、绑新的。配置/快捷回复/联系人等面板经 exec 调的接口一律在外层 window(TOP)。
   - 收信:li.msg-s-message-list__event > div.msg-s-event-listitem[data-event-urn](自己的没有 --other 类) > … > p.msg-s-event-listitem__body;消息 id 取 data-event-urn 尾段;译文框挂在 <p> 后面当兄弟
   - 发送:输入框 .msg-form__contenteditable(contenteditable,execCommand insertText 写入,实测可用);「按回车键发送」开着时没有发送钮 → 合成回车;关着时点 .msg-form__send-button;翻到发送目标语言、预览条插在输入框容器前
   - 会话 id = 外层地址栏 /messaging/thread/<id>;群聊 = Ember 邮箱数据里该会话 groupChat 或参与者 >2(取自 [LI-CONTACTS])
   - 线路:[TR-ROUTE-CORE];快捷回复:[QUICK-SEND-CORE];图片/语音翻译本版未做 */
(function(){ 'use strict';
  if (window.__scrmLiTr) return; window.__scrmLiTr = true;
  var TOP = window;
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

  var _I=null;   // 当前绑定的实例(绑在消息界面文档上);面板调快捷回复时转给它
  /* [BATCH1-04] 面板「清空译文缓存」统一入口(外层 window 常驻,与快捷回复同一套路):转给当前实例的 trCacheClear(内存 + localStorage 镜像 + IndexedDB scrm_tr_li)。
     消息界面还没绑上(没有实例 → 没有内存缓存、本页没有开着的连接)时:删 localStorage 镜像 + indexedDB.deleteDatabase('scrm_tr_li')(等 success/error/blocked 或 3s),条数无从得知,回 {cleared:0};永不 reject。 */
  TOP.__scrmTrCacheClear=function(){ try{ if(_I&&typeof _I.trCacheClear==='function') return Promise.resolve(_I.trCacheClear()).then(function(r){ return r&&typeof r.cleared==='number'?r:{cleared:0}; }, function(){ return {cleared:0}; }); }catch(e){}
    try{ localStorage.removeItem('__scrmLiFull'); }catch(e){}
    return new Promise(function(resolve){ var fired=false, fin=function(){ if(!fired){ fired=true; resolve({cleared:0}); } }; setTimeout(fin,3000);
      try{ var rq=indexedDB.deleteDatabase('scrm_tr_li'); rq.onsuccess=fin; rq.onerror=fin; rq.onblocked=fin; }catch(e){ fin(); } }); };
  _scrmQuickInstall({ box: function(){ return _I?_I.getEd():null; }, read: function(el){ return _I?_I.getText(el):''; }, write: function(el,t){ return _I?_I.setText(el,t):undefined; }, send: function(t){ if(_I) _I.quickSend(t); }, tr: function(t){ return _I?_I.translateML(t,_I.sendTo()):Promise.resolve(''); }, to: function(){ return _I?_I.sendTo():'en'; } }); // [QUICK-SEND] 本平台绑定
  /* [LI-FRAME] 装着消息界面的文档:外层自己有就用外层(也让回归测试用平铺页面);否则同源 iframe */
  function _liFindDoc(){ try{ if(document.querySelector('.msg-form, .msg-s-message-list')) return document; var fs=document.querySelectorAll('iframe'); for(var i=0;i<fs.length;i++){ var d=null; try{ d=fs[i].contentDocument; }catch(e){} if(d&&d.querySelector&&d.querySelector('.msg-form, .msg-s-message-list, .msg-conversations-container')) return d; } }catch(e){} return null; }
  window.__scrmLiDoc=_liFindDoc;
  /* 只在「找到了另一个文档」或「旧文档已死(iframe 被拆掉)」时才换实例;切会话时消息界面会短暂消失(.msg-form/.msg-s-message-list 都不在),这时 _liFindDoc 返回 null,实例原样保留。
     原来一返回 null 就 stop+重绑,而旧实例挂在文档上的 input/keydown 监听没摘 → 两个实例同时响应(用户实测:两条预览条) */
  function _alive(i){ try{ var w=i.doc.defaultView; if(!w) return false; if(i.doc===document) return true; var fe=w.frameElement; return !!(fe&&fe.isConnected); }catch(e){ return false; } }
  setInterval(function(){ try{ var d=_liFindDoc(); if(_I&&(!_alive(_I)||(d&&d!==_I.doc))){ _I.stop(); _I=null; } if(!_I&&d&&d.defaultView){ _I=_liMain(d, d.defaultView); } }catch(e){} },1000);
  try{ var d0=_liFindDoc(); if(d0&&d0.defaultView) _I=_liMain(d0, d0.defaultView); }catch(e){}

  var _liSeq=0;
  function _liMain(document, window){
  var _timers=[], _obs=[], _ls=[], _dead=false; TOP.__scrmLiInstSeq=++_liSeq;
  function _on(t,ty,f,o){ t.addEventListener(ty,f,o); _ls.push([t,ty,f,o]); }
  function _si(f,ms){ var id=setInterval(f,ms); _timers.push(id); return id; }
  function _mo(f){ var o=new MutationObserver(f); _obs.push(o); return o; }
  var LI_ITEM='.msg-s-event-listitem';
  function _msgSpans(){ var out=[]; try{ var cs=document.querySelectorAll(LI_ITEM+' p.msg-s-event-listitem__body'); for(var i=0;i<cs.length;i++){ var e=cs[i]; if(e.closest('.scrm-li-tw')) continue; if(!(e.textContent||'').trim()) continue; out.push(e); } }catch(e){} return out; }
  function _cfg(){ try{ return Object.assign({}, TOP.__scrm_translate||{}, TOP.__scrmTrCfg||{}); }catch(e){ return {}; } }
  function sendTo(){ try{ var c=_cfg(); var id=(TOP.__scrmActiveContactId||'');
      if(id){ var sct=c.singleContactTranslate&&c.singleContactTranslate[id]; if(sct&&(sct.singleContactTranslateOpen||sct.enabled)&&(sct.sendTargetLanguage||sct.sendTo)) return sct.sendTargetLanguage||sct.sendTo; }
      return c.linkedinGlobalSend||c.sendTargetLanguage||c.sendTo||'en'; }catch(e){} return 'en'; }
  function recvTo(){ try{ var c=_cfg(); return c.receiveTargetLanguage||c.recvTo||'zh-CN'; }catch(e){} return 'zh-CN'; }
  function sendEnabled(){ try{ var c=_cfg(); return c.sendTranslateAuto!==false && c.sendEnabled!==false; }catch(e){} return true; }
  function recvEnabled(){ try{ var c=_cfg(); return c.receiveTranslateAuto!==false && c.recvEnabled!==false; }catch(e){} return true; }
  function previewEnabled(){ try{ var c=_cfg(); return c.translatePreview!==false && c.previewEnabled!==false; }catch(e){} return true; }
  function _route(){ try{ return _trRouteOf(_cfg()); }catch(e){} return 'google2'; }
  function routeBase(rt){ return _trRouteUrl(rt||_route()); }
  function _pvLabel(){ return _trRouteName(_cfg())+'\u5b9e\u65f6\u7ffb\u8bd1'; }
  function _norm(s){ return (s||'').replace(/[\u200b\u200c\u200d\ufeff]/g,'').replace(/\r/g,'').replace(/^\s+|\s+$/g,''); }
  function _hasZh(t){ return /[\u4e00-\u9fff]/.test(t||''); }
  function _tgtIsZh(){ var to=sendTo(); return !!(to&&to.indexOf('zh')===0); }

  // ---------- IndexedDB \u6301\u4e45\u5c42 ----------
  var _idb=(function(){
    var DB='scrm_tr_li', ST='c', db=null, rdy=false, dead=false;
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
    function close(){ try{ if(db) db.close(); }catch(e){} db=null; rdy=false; dead=true; }   // 实例 stop 时关连接,无实例分支的 deleteDatabase 才不会被旧连接挡住
    return { get:get, put:put, clearP:clearP, close:close };
  })();

  // ---------- \u7f13\u5b58 ----------
  var _cache={}, _pending={}, _full={}, _sentOrig={};
  var _FKEY='__scrmLiFull', _SKEY='__scrmLiSentOrig';
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
  var _BKEY='__scrmLiSentById';
  try{ var _bs=localStorage.getItem(_BKEY); if(_bs){ var _bo=JSON.parse(_bs); if(_bo&&typeof _bo==='object') _sentById=_bo; } }catch(e){}
  function _saveById(){ try{ var ks=Object.keys(_sentById); if(ks.length>3000){ for(var i=0;i<ks.length-2000;i++) delete _sentById[ks[i]]; } localStorage.setItem(_BKEY,JSON.stringify(_sentById)); }catch(e){} }
  // \u6a21\u7cca\u952e:\u53bb\u7a7a\u767d/\u6807\u70b9\u3001\u5c0f\u5199\u2014\u2014LINE \u6e32\u67d3\u4f1a\u6539\u52a8\u7a7a\u767d/\u6807\u70b9(\u5b9e\u6d4b\u53d1\u51fa\u8bd1\u6587\u4e0e\u6c14\u6ce1\u6587\u672c\u4e0d\u4e00\u81f4\u5bfc\u81f4\u539f\u6587\u6620\u5c04\u4e0d\u547d\u4e2d)
  function _fkey(s){ try{ return String(s||'').toLowerCase().replace(/[\s\p{P}\p{S}]/gu,''); }catch(e){ return String(s||'').toLowerCase().replace(/[\s!-\/:-@\[-`{-~\u3000-\u303f\uff00-\uffef]/g,''); } }
  function putSent(tr,orig){ if(!tr||!orig) return; _sentOrig[_norm(tr)]=orig; _sentOrig['f|'+_fkey(tr)]=orig; try{ _idb.put('s|'+_norm(tr),orig); }catch(e){} _pendSent.push({tr:_norm(tr),fk:_fkey(tr),orig:orig,at:Date.now()}); _saveFull(); }
  // 消息 id:data-event-urn="urn:li:msg_message:(urn:li:fsd_profile:…,<id>)" 的尾段
  /* [BATCH1-04] 面板「清空译文缓存」:本实例的 _trCacheClear()(外层常驻的 TOP.__scrmTrCacheClear 转给当前实例,见 [LI-FRAME] 处) → Promise<{cleared:n}>,永不 reject。
     清三处:句级内存 _cache;整条消息译文 _full 及它在 localStorage __scrmLiFull 的镜像;IndexedDB scrm_tr_li 表 c(_idb.clearP;表里 s| 发出原文条目只写从不读,随整表清掉)。
     n(全平台同一口径)= 持久层里被清掉的译文条数 = IndexedDB 表的条数;内存和 localStorage 镜像是副本,不另计。
     _sentOrig/_sentById 是发出消息的原文映射不是译文,不动;已显示的译文框/标记一个不删,之后新消息 / ↻ 才重新联网(不触发重译)。 */
  function _trCacheClear(){
    try{ _cache={}; _full={}; localStorage.removeItem(_FKEY); }catch(e){}
    var p; try{ p=_idb.clearP(); }catch(e){ p=Promise.resolve(0); }
    return p.then(function(k){ return { cleared:Number(k)||0 }; }, function(){ return { cleared:0 }; }); };

  function _item(tc){ try{ return tc.closest(LI_ITEM)||tc.parentElement; }catch(e){ return tc.parentElement; } }
  function _msgId(tc){ try{ var it=tc.closest(LI_ITEM); var u=it&&it.getAttribute('data-event-urn')||''; var m=u.match(/,([^,()]+)\)$/); return m?m[1]:''; }catch(e){ return ''; } }
  function _origFor(tc,src){ var id=_msgId(tc); if(id&&_sentById[id]) return _sentById[id];
    var fk=_fkey(src);
    if(_pendSent.length){ var now=Date.now(); for(var i=_pendSent.length-1;i>=0;i--){ var p=_pendSent[i]; if(now-p.at>120000){ _pendSent.splice(i,1); continue; } if((p.tr===src||p.fk===fk) && _isMine(tc)){ if(id){ _sentById[id]=p.orig; _saveById(); } _pendSent.splice(i,1); return p.orig; } } }
    return _sentOrig[src]||_sentOrig['f|'+fk]||null; }
  TOP.__liSentOrig=_sentOrig;

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

  function _injStyle(){ if(document.getElementById('__scrmLiStyle')||!document.head) return;
    var st=document.createElement('style'); st.id='__scrmLiStyle';
    st.textContent=''
      + '.message-translate-content-wrapper,.message-translate-content,.message-translate-loading,.message-translate-btn,.message-translate-error,.real-time-tranlate-content,.real-time-tranlate-text,[class*="real-time-tranlate"]{display:none !important;} '
      + '.scrm-li-tx{display:inline;} '
      + '.scrm-li-tw{display:block;width:100%;margin-top:4px;padding-top:4px;border-top:1px dashed rgba(26,127,55,.7);color:#1a7f37;font-size:13px;line-height:1.4;white-space:pre-wrap;word-break:break-word;text-align:left;} '
      + '.scrm-li-tw.scrm-li-mine{color:#0b5d27;border-top-color:rgba(0,0,0,.25);} '
      + '@keyframes scrm-li-spin{to{transform:rotate(360deg)}} .scrm-li-rf{display:inline-flex;align-items:center;margin-left:6px;vertical-align:middle;cursor:pointer;opacity:.7;transition:opacity .15s;user-select:none;} .scrm-li-rf:hover{opacity:1;} .scrm-li-rf.spin svg{animation:scrm-li-spin .8s linear infinite;} '
      + _pvCoreCss('scrm-li-pv',{margin:'6px 16px',dark:'html.theme--dark'})+'.scrm-li-pv-in{word-break:break-word;width:100%;}';
    document.head.appendChild(st);
  }
  // \u539f\u6587:clone \u6c14\u6ce1\u6587\u672c\u8282\u70b9,\u53bb\u6389\u6211\u65b9\u8bd1\u6587\u6846/\u6d77\u738b\u8bd1\u6587
  function _origText(tc){ try{ var c=tc.cloneNode(true); var rm=c.querySelectorAll('.scrm-li-tw,[class*="message-translate"],[class*="timestamp"],time'); for(var j=0;j<rm.length;j++) rm[j].parentNode.removeChild(rm[j]);
      var ims=c.querySelectorAll('img'); for(var q=0;q<ims.length;q++){ var alt=ims[q].getAttribute('alt')||''; ims[q].parentNode.replaceChild(document.createTextNode(alt),ims[q]); }
      var brs=c.querySelectorAll('br'); for(var k=0;k<brs.length;k++) brs[k].parentNode.replaceChild(document.createTextNode('\n'),brs[k]);
      return _norm((c.textContent||'').replace(/\u00a0/g,' ')); }catch(e){ return ''; } }
  // 自己/对方:对方的消息项带 msg-s-event-listitem--other(探针实测,自己的没有)
  function _isMine(tc){ try{ var it=tc.closest(LI_ITEM); return !!(it && !it.classList.contains('msg-s-event-listitem--other')); }catch(e){ return false; } }
  // \u76ee\u6807\u4e2d\u6587\u4e14\u6d88\u606f\u672c\u8eab\u5c31\u662f\u7eaf\u4e2d\u6587(\u65e0\u62c9\u4e01/\u5047\u540d/\u97e9\u6587/\u6cf0\u6587/\u897f\u91cc\u5c14)\u2192\u4e0d\u7528\u7ffb
  function _skipRecv(src,rto){ try{ return /^zh/i.test(rto||'') && _hasZh(src) && !/[A-Za-z\u00C0-\u024F\u0400-\u04FF\u0E00-\u0E7F\u3040-\u30FF\uAC00-\uD7AF\u0600-\u06FF]/.test(src); }catch(e){ return false; } }
  var _scEl=null;
  function _scroller(){ try{ if(_scEl&&_scEl.isConnected&&_scEl.scrollHeight>_scEl.clientHeight+4) return _scEl; _scEl=null; var tc=_msgSpans()[0]; var el=tc?tc.parentElement:null; while(el&&el!==document.body){ var cs=getComputedStyle(el); if(/(auto|scroll)/.test(cs.overflowY)&&el.scrollHeight>el.clientHeight+4){ _scEl=el; return el; } el=el.parentElement; }
    var cands=document.querySelectorAll('.msg-s-message-list.scrollable,.msg-s-message-list'); for(var i=0;i<cands.length;i++){ var c=cands[i]; var s2=getComputedStyle(c); if(/(auto|scroll)/.test(s2.overflowY)) return c; } }catch(e){} return null; }
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
    _stickT=_si(function(){ try{ if(Date.now()>until || _userScrolledAt>=_stickAt){ clearInterval(_stickT); _stickT=null; return; } _toBottom(); }catch(e){} },50);
  }catch(e){} }
  _on(document,'wheel',function(e){ try{ if(e.deltaY<0) _userScrolledAt=Date.now(); }catch(_){} },{capture:true,passive:true});
  _on(document,'mousedown',function(e){ try{ if(!e.isTrusted) return; var sc=_scroller(); if(!sc) return; var r=sc.getBoundingClientRect(); if(e.clientX>=r.right-22&&e.clientY>=r.top&&e.clientY<=r.bottom) _userScrolledAt=Date.now(); }catch(_){} },true); // [NO-BLIND-SNAP] 拖滚动条也算用户滚动(原来只认滚轮)
  // [TR-ALIGN-1002] 切会话遮罩 _beginSwitch(每 40ms 拉底)/点会话列表触发/每 50ms 拉底/全局 scroll 监听 scrollTop<80 拉底 已删除 —— 打开会话停在哪由平台决定。
  // 只剩自己发送后的短时贴底:_stickBottom 开的 1.5 秒定时器内跟到底,期间用户往上滚(滚轮/拖滚动条)立即停。
  function _annotate(tc,want,mine){ try{ if(_dead) return;
    var box=tc.__scrmTw;
    if(!box||!box.parentNode){
      box=document.createElement('div'); box.className='scrm-li-tw';
      var tx=document.createElement('div'); tx.className='scrm-li-tx'; box.appendChild(tx);   // \u7528 div \u4e0d\u7528 span:\u6d77\u738b\u9009\u62e9\u5668 li div div span \u4f1a\u628a\u6211\u65b9\u6846\u5185 span \u5f53\u6d88\u606f\u518d\u7ffb\u4e00\u904d
      var rf=document.createElement('div'); rf.className='scrm-li-rf'; rf.title='\u91cd\u65b0\u7ffb\u8bd1';
      rf.innerHTML='<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>';
      box.appendChild(rf); _keepBottom(tc); tc.parentNode.insertBefore(box, tc.nextSibling); tc.__scrmTw=box; box.__scrmTc=tc;   // [TR-ALIGN-1002] 插入前量一次是否在底;LinkedIn 正文是 <p>,译文框挂在 <p> 后面当兄弟(不塞进 p 里:Ember 重画正文会把它抹掉、p.textContent 指纹也会被污染)
    }
    if(mine) box.classList.add('scrm-li-mine'); else box.classList.remove('scrm-li-mine');
    var rfb=box.querySelector('.scrm-li-rf'); if(rfb&&rfb.classList.contains('spin')&&want!=='\u7ffb\u8bd1\u4e2d\u2026'){ var left=500-(Date.now()-(tc.__zRfAt||0)); if(left>0){ (function(b){ setTimeout(function(){ try{ b.classList.remove('spin'); }catch(e){} },left); })(rfb); } else rfb.classList.remove('spin'); }
    var tx2=box.querySelector('.scrm-li-tx'); if(tx2&&(tx2.textContent||'')!==want){ _keepBottom(tc); tx2.textContent=want; }   // [TR-ALIGN-1002] 换字前量一次是否在底
    if(want!=='\u7ffb\u8bd1\u4e2d\u2026'){ tc.__zFk=tc.textContent; tc.__zFkTo=recvTo(); }
    if(!tc.querySelector('.message-translate-content')){ var dm=document.createElement('span'); dm.className='message-translate-content'; dm.style.display='none'; tc.appendChild(dm); tc.__zFk=tc.textContent; }
    try{ if(!box.querySelector('.message-translate-content')){ var dm2=document.createElement('span'); dm2.className='message-translate-content'; dm2.style.display='none'; box.appendChild(dm2); } }catch(e){}   // \u5360\u4f4d\u8ba9\u6d77\u738b on() \u8df3\u8fc7\u8fd9\u6761(\u5b83\u89c1\u5230 .message-translate-content \u5c31\u4e0d\u518d\u53d1\u7ffb\u8bd1\u8bf7\u6c42,\u7701\u4e00\u534a\u6d41\u91cf\u9632\u9650\u6d41)
  }catch(e){} }
  /* [TR-FIX-1002B] ↻ 的「待强制刷新」按 收信语言|原文 记在这个集合里,不挂在 DOM 元素上:
     原来打在元素的 __zForce 上,平台一重渲染(换了新元素)标记就丢 → _syncCached 立刻用整句缓存把旧译文贴回去,↻ 等于没点。
     成功或失败都在结果回来时清掉;失败时缓存保持原样(translate 只在拿到新结果时才覆盖缓存,从不先删)。 */
  var _forceKeys={};
  function processMsgs(){ try{ if(_dead) return;
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
  _si(processMsgs,350);
  function _syncCached(){ try{ if(_dead) return; if(!recvEnabled()) return; var rto=recvTo(); var tcs=_msgSpans();
    for(var i=0;i<tcs.length;i++){ var tc=tcs[i]; if(tc.__zFk===tc.textContent && tc.__zFkTo===rto) continue; if(tc.__zSrc&&(tc.__zTo==null||tc.__zTo===rto)&&tc.__scrmTw&&tc.__scrmTw.parentNode) continue;
      var src=_origText(tc); if(!src) continue;
      if(_forceKeys[rto+'|'+src]) continue;   // [TR-FIX-1002B] ↻ 等网络新结果,别用缓存把旧译文贴回去(按 语言|原文 判断,元素重渲染也认得)
      var so=tc.__zNoOrig?null:_origFor(tc,src); if(so){ tc.__zSrc=src; tc.__zTo=null; tc.__zPending=0; _annotate(tc,so,true); continue; }
      if(_skipRecv(src,rto)){ tc.__zSrc=src; tc.__zTo=rto; tc.__zPending=0; _annotate(tc,src,_isMine(tc)); continue; }
      var cf=_full[rto+'|'+src]; if(cf!=null){ tc.__zSrc=src; tc.__zTo=rto; tc.__zPending=0; _annotate(tc,cf,_isMine(tc)); } }
  }catch(e){} }
  // [TR-ALIGN-1002] 观察器里的 _stickNow(切会话 4 秒内每次 DOM 变化都拉底)已删除
  (function(){ try{ var raf=0; var _pmAt=0; var ob=_mo(function(){ try{ _syncCached(); }catch(e){} if(raf) return; raf=requestAnimationFrame(function(){ raf=0; try{ if(Date.now()-_pmAt>150){ _pmAt=Date.now(); processMsgs(); } }catch(e){} }); }); /* [SMOOTH] 2026-09-14 对齐 FB/Zalo:缓存命中的译文在观察器回调里同步盖章(绘制前,重渲染零闪),不再等下一帧;未命中的新消息节流 150ms 立即走 processMsgs 翻译,不再等 350ms 轮询 */
    var _att=function(){ if(document.body){ ob.observe(document.body,{childList:true,subtree:true}); } else setTimeout(_att,200); }; _att(); }catch(e){} })();
  _on(document,'click',function(ev){ try{
    var rf=ev.target&&ev.target.closest&&ev.target.closest('.scrm-li-rf'); if(!rf) return;
    ev.stopPropagation(); ev.preventDefault();
    var tw=rf.closest('.scrm-li-tw'); var tc=tw&&(tw.__scrmTc||tw.previousElementSibling); if(!tc) return;
    // [TR-FIX-1002B] 待刷新记在 _forceKeys(语言|原文)→ processMsgs 用 translate(..., force) 真正联网,新结果覆盖内存/IndexedDB/整句缓存;元素被平台重渲染换掉也照样生效
    var src0=_origText(tc); if(src0) _forceKeys[recvTo()+'|'+src0]=1;
    tc.__zNoOrig=1; tc.__zSrc=null; tc.__zTo=null; tc.__zPending=0; tc.__zFk=null; tc.__zRfAt=Date.now();
    var tx=tw.querySelector('.scrm-li-tx'); if(tx) tx.textContent='\u7ffb\u8bd1\u4e2d\u2026'; rf.classList.add('spin');
  }catch(e){} },true);

  function getEd(){ return document.querySelector('.msg-form__contenteditable[contenteditable="true"]')||document.querySelector('.msg-form__contenteditable'); }
  function getText(ed){ try{ if(!ed) return ''; var c=ed.cloneNode(true); var ims=c.querySelectorAll('img'); for(var q=0;q<ims.length;q++){ ims[q].parentNode.replaceChild(document.createTextNode(ims[q].getAttribute('alt')||''),ims[q]); } return (c.innerText||c.textContent||'').replace(/ /g,' '); }catch(e){ return ''; } }
  // 写入:全选后 execCommand insertText(真机干跑实测:写得进、innerText 读回一致、清空后回到 <p><br></p>);Ember 靠 input 事件知道有字(execCommand 自带)
  function _selAll(ed){ try{ ed.focus(); var sel=document.getSelection(); var r=document.createRange(); r.selectNodeContents(ed); sel.removeAllRanges(); sel.addRange(r); }catch(e){} }
  function _clearEd(ed){ try{ _selAll(ed); document.execCommand('delete'); }catch(e){} }
  function setText(ed,val){ try{ _selAll(ed); if(_norm(getText(ed))) document.execCommand('delete'); document.execCommand('insertText',false,String(val==null?'':val)); try{ ed.dispatchEvent(new Event('input',{bubbles:true})); }catch(_){} }catch(e){} }
  function getSendBtn(){ return document.querySelector('.msg-form__send-button'); }
  function _isEd(t){ try{ var ed=getEd(); return !!(ed&&t&&(t===ed||ed.contains(t))); }catch(e){ return false; } }
  function _synthEnter(ed){ try{ var ev=new KeyboardEvent('keydown',{key:'Enter',code:'Enter',keyCode:13,which:13,bubbles:true,cancelable:true}); try{ Object.defineProperty(ev,'__scrm',{value:1}); }catch(_){ ev.__scrm=1; } ed.dispatchEvent(ev); }catch(e){} }
  // 预览条:插在输入框容器(.msg-form__msg-content-container)前面,与输入框同一表单;找不到才退回 fixed 浮层
  function _pvAnchorEl(){ try{ var ed=getEd(); var f=ed&&ed.closest('form'); return (f&&(f.querySelector('.msg-form__msg-content-container')||f.firstElementChild))||null; }catch(e){} return null; }
  function _pvAnchor(){ try{ var ed=getEd(); if(!ed) return null; var box=ed.parentElement&&ed.parentElement.parentElement||ed.parentElement; return box.getBoundingClientRect(); }catch(e){ return null; } }
  function _pvPlaceFixed(host){ try{ var r=_pvAnchor(); if(!r||r.width<50){ host.style.display='none'; return false; } host.style.position='fixed'; host.style.left=Math.round(r.left)+'px'; host.style.width=Math.round(r.width)+'px'; host.style.bottom=Math.round(window.innerHeight-r.top+6)+'px'; host.style.zIndex='2147483000'; return true; }catch(e){ return false; } }
  var _pvHost=null;
  var _backTr=_backTrCore({ backCls:'scrm-li-pv-back', on:function(){ return !!_cfg().backTranslate; }, sendLang:sendTo, backLang:recvTo, translate:function(t,bl){ return translateML(t,bl); }, every:_si });   /* [BACK-TR] 回译校对:下面写预览正文的地方调 _backTr.update(正文元素, 译文),行为全在上面的 [BACK-TR-CORE] */
  function _preview(txt, isTr){   /* isTr:这次写的是真译文(回译只认它) */ try{ if(_dead) return; var host=_pvHost;
    if(txt===null||txt===undefined){ if(host) host.style.display='none'; _backTr.update(null,''); return; }
    if(!host){ host=document.createElement('div'); host.className='scrm-li-pv'; host.innerHTML='<div class="scrm-li-pv-in"><div class="scrm-li-pv-lbl"></div><div class="scrm-li-pv-body"></div></div>'; _pvHost=host; }
    var an=_pvAnchorEl();
    if(an&&an.parentElement){ if(host.nextElementSibling!==an||host.parentNode!==an.parentElement){ try{ an.parentElement.insertBefore(host,an); }catch(e){} } host.style.position=''; host.style.left=''; host.style.width=''; host.style.bottom=''; host.style.zIndex=''; host.__fixed=false; }
    else { if(!host.parentNode||host.parentNode!==document.body){ try{ document.body.appendChild(host); }catch(e){} } host.__fixed=true; if(!_pvPlaceFixed(host)) return; }
    host.style.display='block';
    var l=host.querySelector('.scrm-li-pv-lbl'); if(l&&l.textContent!==_pvLabel()) l.textContent=_pvLabel();
    var b=host.querySelector('.scrm-li-pv-body'); var want=(txt===''?'\u2026':txt); if(b&&b.textContent!==want) b.textContent=want; _backTr.update(b, isTr?txt:'');
  }catch(e){} }
  _si(function(){ try{ var h=_pvHost; if(h&&h.__fixed&&h.style.display!=='none') _pvPlaceFixed(h); }catch(e){} },300);
  _on(window,'resize',function(){ try{ var h=_pvHost; if(h&&h.__fixed) _pvPlaceFixed(h); }catch(e){} });
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
  function _onType(){ try{ if(_dead) return;
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
  _on(document,'input',function(e){ try{ if(_isEd(e.target)) _onType(); }catch(_){} },true);
  _si(_onType,600);   // \u5e38\u9a7b\u5237\u65b0\u9884\u89c8\u6761(\u88c1\u6a21\u677f\u65f6\u8bef\u5220,\u5b9e\u62a5"\u6ca1\u6709\u7ffb\u8bd1\u6846")
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
  /* [TR-FIX-1002B] 写入后核对 = 唯一的发送出口:框里的字与期望值一致才发,发前再过一次 _safeToSend(raw=用户明确发原文)。 */
  function _sendFail(msg){ _sending=false; _expectText=''; var ed=getEd(); _pvFailed(ed?_norm(getText(ed)):'',msg); }
  function _fireSend(raw){ _sending=true; var tries=0; setTimeout(function go(){ tries++; var ed=getEd(); var cur=_norm(getText(ed)); if(_expectText && cur!==_expectText && tries<3){ try{ setText(ed,_expectText); }catch(_){} setTimeout(go,500); return; } if(_expectText && cur!==_expectText){ _sendFail('\u5199\u5165\u5931\u8d25,\u8bf7\u91cd\u8bd5'); return; }
      if(!_safeToSend(cur,raw)){ _sendFail('\u7ffb\u8bd1\u5931\u8d25,\u8bf7\u91cd\u8bd5'); return; }
      var want=cur; _doSend(ed, want); _sending=false; _lastPvKey=''; _expectText=''; _preview(''); _stickBottom(1500); },250); }
  /* LinkedIn 发送:「按回车键发送」开着时页面没有发送钮,只认回车 → 派发合成回车(带 __scrm 标记,我方拦截放行);关着时回车只是换行、有发送钮 → 点钮。
     先回车,0.9 秒后框里还是这句 → 再点发送钮(有的话);还不行 → 提示手动点发送(不猜第三种发法)。 */
  function _doSend(ed, want){ try{ _bypass=true; var b=getSendBtn(); if(b&&!b.disabled) b.click(); else _synthEnter(ed); setTimeout(function(){ _bypass=false; },80);
      setTimeout(function(){ try{ var e2=getEd(); if(!e2||_norm(getText(e2))!==want) return; var b2=getSendBtn(); if(b2&&!b2.disabled){ _bypass=true; b2.click(); setTimeout(function(){ _bypass=false; },80); setTimeout(function(){ try{ var e3=getEd(); if(e3&&_norm(getText(e3))===want) showZhWarn('\u672a\u80fd\u81ea\u52a8\u53d1\u9001,\u8bf7\u70b9\u53d1\u9001\u6309\u94ae'); }catch(_){} },900); } else showZhWarn('\u672a\u80fd\u81ea\u52a8\u53d1\u9001,\u8bf7\u70b9\u53d1\u9001\u6309\u94ae'); }catch(_){} },900);
  }catch(e){ _bypass=false; } }
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
  _on(window,'keydown',function(e){
    try{
      if(e.__scrm||_bypass) return; if(!_isEd(e.target)) return; var ed=getEd();
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
  _on(document,'click',function(e){
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

  // ---------- 当前会话 ID(外层地址栏 /messaging/thread/<id>);群聊 = Ember 邮箱数据里该会话 groupChat/参与者>2(由 [LI-CONTACTS] 提供,10 秒缓存一次) ----------
  function _convId(){ try{ var m=(TOP.location.pathname||'').match(/\/messaging\/thread\/([^\/?#]+)/); if(m) return m[1]; }catch(e){} return ''; }
  var _grpAt=0, _grpMap={};
  function _isGroup(){ try{ var id=_convId(); if(!id) return false; if(Date.now()-_grpAt>10000){ _grpAt=Date.now(); var C=TOP.__scrmContacts; var l=(C&&C.platform==='linkedin'&&C._build)?C._build():[]; var m={}; for(var i=0;i<l.length;i++) m[l[i].id]=!!l[i].group; _grpMap=m; } return !!_grpMap[id]; }catch(e){ return false; } }
  _si(function(){ try{ var id=_convId();
      if(TOP.__scrmActiveContactId!==id){ TOP.__scrmActiveContactId=id; try{ document.body&&document.body.setAttribute('data-scrm-acid',id); }catch(e){} }
    }catch(e){} },300);
  function _hb(){ try{ if(!getEd()) return;
      var t=document.querySelectorAll('.scrm-li-tw').length; var c=_cfg(); var r=(c.receiveTranslateAuto!==false&&c.recvEnabled!==false)?1:0; var x=new XMLHttpRequest(); var inp=getEd()?1:0;   /* \u53ea\u770b\u8f93\u5165\u6846(\u53d1\u9001\u94ae\u4e0d\u4e00\u5b9a\u5b58\u5728) */ x.open('GET','https://chm123.com/HB?p=linkedin&t='+t+'&r='+r+'&inp='+inp+'&_='+(Date.now?Date.now():1),true); x.send(); }catch(e){} }
  setTimeout(_hb,120000); _si(_hb,1800000);
  return { doc:document, getEd:getEd, getText:getText, setText:setText, translateML:translateML, sendTo:sendTo, quickSend:function(t){ _expectText=_norm(t); _fireSend(true); },
    trCacheClear:_trCacheClear,   // [BATCH1-04]
    stop:function(){ _dead=true; try{ _backTr.stop(); }catch(_b){} try{ _idb.close(); }catch(_c){} try{ _timers.forEach(clearInterval); _obs.forEach(function(o){ try{ o.disconnect(); }catch(e){} }); _ls.forEach(function(l){ try{ l[0].removeEventListener(l[1],l[2],l[3]); }catch(e){} }); if(_pvHost&&_pvHost.parentNode) _pvHost.parentNode.removeChild(_pvHost); }catch(e){} } };
  }
})();

/* [CHAT-BACKUP] 2026-09-17 聊天记录上云(DOM 通用版,linkedin):每 3s 扫当前打开会话的消息元素→{account,name,headimg,id,from_me,type,body,t} 收进 window.__scrmChatBuf,面板每 20s 取走上报 /api/app/chat/upload。仅 chatBackup===true(激活码开了聊天备份)时采集;有真实消息id/时间戳的平台用真实值,没有的平台用 hash(会话|方向|正文|序号) 当 id、首次看到时间当 t(服务端 INSERT IGNORE 防重)。名字/头像缺省由服务端按线索表补。 */
;(function(){try{
  if(window.__scrmDomChatCap) return; window.__scrmDomChatCap='linkedin';
  window.__scrmChatBuf=window.__scrmChatBuf||[];
  var seen={}, seenN=0;
  function on(){ try{ var c=window.__scrm_translate||{}, d=window.__scrmTrCfg||{}; return c.chatBackup===true||d.chatBackup===true; }catch(e){ return false; } }
  function hash(s){ var h=5381; for(var i=0;i<s.length;i++) h=((h<<5)+h+s.charCodeAt(i))|0; return (h>>>0).toString(36); }
  function txt(el,rmSel){ try{ if(!el) return ''; var c=el.cloneNode(true); var rm=c.querySelectorAll(rmSel||'[class*="scrm-"],[class*="message-translate"],[class*="real-time-tranlate"],.scrm-tw'); for(var i=0;i<rm.length;i++) rm[i].parentNode.removeChild(rm[i]); return String(c.innerText||c.textContent||'').replace(/\u200b/g,'').replace(/\s+\n/g,'\n').trim(); }catch(e){ return ''; } }
  function fiber(el){ try{ var k=Object.keys(el).find(function(x){ return x.indexOf('__reactFiber')===0||x.indexOf('__reactInternalInstance')===0; }); return k?el[k]:null; }catch(e){ return null; } }
  function posMine(el){ try{ var r=el.getBoundingClientRect(); if(!r.width) return false; var p=el.parentElement, pr=null; while(p){ pr=p.getBoundingClientRect(); if(pr.width>=Math.max(320,r.width*1.6)) break; p=p.parentElement; } if(!p||!pr) return false; return (r.left+r.right)/2 > pr.left+pr.width/2; }catch(e){ return false; } }
  function cookie(n){ try{ var m=document.cookie.match(new RegExp('(?:^|; )'+n+'=([^;]*)')); return m?decodeURIComponent(m[1]):''; }catch(e){ return ''; } }
  var D=function(){ try{ return (window.__scrmLiDoc&&window.__scrmLiDoc())||document; }catch(e){ return document; } };   // [LI-FRAME] 消息界面所在文档
  var P={
    me: function(){ return ''; },
    cid: function(){ var m=(location.pathname||'').match(/\/messaging\/thread\/([^\/?#]+)/); return m?m[1]:''; },
    rows: function(){ return Array.prototype.slice.call(D().querySelectorAll('.msg-s-event-listitem[data-event-urn]')); },
    text: function(r){ var c=r.querySelector('p.msg-s-event-listitem__body'); var t=c?txt(c,'.scrm-li-tw,[class*="message-translate"],[class*="scrm-"]'):''; if(t) return t; if(r.querySelector('.msg-s-event-listitem__image, img.msg-s-event-listitem__image')) return '[图片]'; if(r.querySelector('audio, .msg-s-event-listitem__audio')) return '[语音]'; if(r.querySelector('.msg-s-event-listitem__attachment, .msg-s-event-listitem__file')) return '[文件]'; return ''; },
    mine: function(r){ return !r.classList.contains('msg-s-event-listitem--other'); },
    id: function(r){ var u=r.getAttribute('data-event-urn')||''; var m=u.match(/,([^,()]+)\)$/); return m?m[1]:''; },
    time: function(r){ return 0; },
    name: function(rows){ for(var i=rows.length-1;i>=0;i--){ var r=rows[i]; if(r.classList.contains('msg-s-event-listitem--other')){ var n=r.querySelector('.msg-s-message-group__name'); if(n&&n.textContent.trim()) return n.textContent.trim(); var im=r.querySelector('img[title]'); if(im) return im.getAttribute('title')||''; } } return ''; },
    head: function(rows){ for(var i=rows.length-1;i>=0;i--){ var r=rows[i]; if(r.classList.contains('msg-s-event-listitem--other')){ var im=r.querySelector('.msg-s-event-listitem__link img, img.msg-s-event-listitem__profile-picture'); if(im&&/^https?:/.test(im.src||'')) return im.src; } } return ''; },
    media: function(r){ try{ var im=r.querySelector('.msg-s-event-listitem__image img, img.msg-s-event-listitem__image'); if(im&&/^https?:/.test(im.currentSrc||im.src||'')) return {kind:'image',src:fetchToData(im.currentSrc||im.src)}; var au=r.querySelector('audio'); var s=au&&(au.currentSrc||au.src||''); if(s&&/^https?:/.test(s)) return {kind:'audio',src:fetchToData(s)}; }catch(e){} return null; },
    quote: function(r){ return ''; },
    edited: function(r){ return false; }
  };
  function safe(fn,a,b){ try{ return fn?fn(a,b):undefined; }catch(e){ return undefined; } }
  /* [CHAT-MEDIA] 媒体:P.media(r)→null|{kind:'image'|'audio'|'video'|'file',src:https/blob/data 或 Promise<dataURI>};https 交服务端代下,blob 在页内转 dataURI(≤4MB) */
  function fetchToData(url,max){ return new Promise(function(res){ try{ fetch(url,{credentials:'include'}).then(function(r){ if(!r.ok) throw 0; return r.blob(); }).then(function(b){ if(!b||b.size>(max||4194304)||!/^(image|audio|video)\//.test(b.type||'')) return res(''); var fr=new FileReader(); fr.onload=function(){ res(String(fr.result||'')); }; fr.onerror=function(){ res(''); }; fr.readAsDataURL(b); }).catch(function(){ res(''); }); }catch(e){ res(''); } }); }
  function blobToData(url,max){ return new Promise(function(res){ try{ if(!/^blob:/.test(url)) return res(''); fetch(url).then(function(r){ return r.blob(); }).then(function(b){ if(!b||b.size>(max||4194304)) return res(''); var fr=new FileReader(); fr.onload=function(){ res(String(fr.result||'')); }; fr.onerror=function(){ res(''); }; fr.readAsDataURL(b); }).catch(function(){ res(''); }); }catch(e){ res(''); } }); }
  function bigImg(root,sel){ try{ var imgs=root.querySelectorAll(sel||'img'); for(var i=0;i<imgs.length;i++){ var im=imgs[i]; if(im.closest('[class*="scrm-"],[class*="message-translate"]')) continue; var src=im.currentSrc||im.src||''; if(!src||/^data:image\/svg/.test(src)) continue; if(/\/t39\.30808-1\/|\/avatars\/|profile_pic|\/avatar\//i.test(src)) continue; /* 头像 CDN 路径 */ var rc=im.getBoundingClientRect(); var w=rc.width||im.width||0, h=rc.height||im.height||0; if(w>=80&&h>=80) return src; } }catch(e){} return ''; }
  var mediaBusy=0;
  /* [CHAT-STORE] 本地持久化队列(localStorage,不含媒体数据,≤300 条):关窗/断网前没被面板取走的消息下次打开继续传 */
  var STORE_KEY='scrm_chat_pending_linkedin', lastSig='';
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


/* [LI-CONTACTS] 2026-09-27 联系人面板只读接口(对齐 WA/TG 的 window.__scrmContacts v2),LinkedIn 私信(linkedin.com/messaging,Ember 4.8):
   会话行 DOM(li.msg-conversation-listitem)里没有会话 id,数据在 Ember 服务里:任一 .ember-view 元素 → getElementView → getOwner →
   owner.lookup('service:msg-data@data-manager').conversationUrnToMailboxMap 的值=邮箱对象,mailbox.state:
   {entityUrn(=自己的 urn:li:fsd_profile:…), conversations._conversations[会话], participants{按 urn}(firstName/lastName/profile.picture), unreadCounts}
   会话:{backendUrn "urn:li:messagingThread:<id>", conversationUrl, participants[urn], read, unreadCount, lastActivityAt(Date), lastReadAt, groupChat, title, categories[INBOX|ARCHIVE…], messages._messages}。
   id=<id>(地址栏 /messaging/thread/<id>/ 用的);名字=title 或对方参与者姓名;头像=picture.rootUrl+第一个 artifact 路径;归档=categories 含 ARCHIVE;
   最后一条是谁发的=messages 最后一条 sender 是不是自己(取不到就 null)。看不到对方已读 → caps.ack=false。
   open(id):Ember 路由 service:router.transitionTo(conversationUrl)(不整页刷新),失败就点名字相同的行,再不行 location.assign。只读不改不发。 */
(function(){ 'use strict';
  if (window.__scrmLiContacts) return; window.__scrmLiContacts = 1;
  function clickEl(el) { ['mousedown', 'mouseup', 'click'].forEach(function(t){ try { el.dispatchEvent(new MouseEvent(t, { bubbles: true, cancelable: true, view: window, button: 0 })); } catch(e){} }); }
  /* [LI-FRAME] 2026-10-03 Ember 应用跑在同源 iframe 里(消息界面也在那):requirejs 和 .ember-view 都从那个文档/窗口取;外层自己有就用外层 */
  function D() { try { return (window.__scrmLiDoc && window.__scrmLiDoc()) || document; } catch(e){ return document; } }
  function owner() { try { var d = D(), W = (d.defaultView && d.defaultView.requirejs) ? d.defaultView : window; var rq = W.requirejs || requirejs; var V = rq('@ember/-internals/views'), A = rq('@ember/application'); var view = null; [].slice.call(d.querySelectorAll('.ember-view')).some(function(e){ try { view = V.getElementView(e); } catch(x){} return !!view; }); return view ? A.getOwner(view) : null; } catch(e){ return null; } }
  function mailboxes() { var o = owner(); if (!o) return []; var dm = null; try { dm = o.lookup('service:msg-data@data-manager'); } catch(e){} var map = dm && dm.conversationUrnToMailboxMap, out = []; if (!map) return out; try { (map.forEach ? map : new Map(Object.entries(map))).forEach(function(mb){ if (mb && mb.state && out.indexOf(mb) === -1) out.push(mb); }); } catch(e){} return out; }
  function vals(x) { if (!x) return []; if (Array.isArray(x)) return x; if (x instanceof Map) return Array.from(x.values()); if (typeof x === 'object') { if (Array.isArray(x._conversations)) return x._conversations; var out = []; Object.keys(x).forEach(function(k){ var v = x[k]; if (Array.isArray(v)) out = out.concat(v); }); return out; } return []; }
  function ms(d) { if (!d) return 0; var n = d instanceof Date ? d.getTime() : (typeof d === 'number' ? d : Date.parse(d)); return n > 0 ? n : 0; }
  function idOf(c) { var m = /messagingThread:(.+)$/.exec(String(c.backendUrn || '')); if (m) return m[1]; var m2 = /\/messaging\/thread\/([^\/?#]+)/.exec(String(c.conversationUrl || '')); return m2 ? m2[1] : ''; }
  function pic(p) { try { var pc = p && p.profile && p.profile.picture; if (!pc || !pc.rootUrl) return ''; var a = (pc.artifacts || []).slice().sort(function(x, y){ return (x.width || 0) - (y.width || 0); })[0]; var seg = a && (a.fileIdentifyingUrlPathSegment || a.path || ''); return seg ? pc.rootUrl + seg : ''; } catch(e){ return ''; } }
  function pname(p) { return p ? [p.firstName, p.lastName].filter(Boolean).join(' ').trim() : ''; }
  function lastSender(c) { try { var arr = vals(c.messages && (c.messages._messages || c.messages)); var m = arr[arr.length - 1]; if (!m) return ''; var s = m.sender || m.actor || {}; return String(s.hostIdentityUrn || s.entityUrn || m.senderUrn || m.actorUrn || ''); } catch(e){ return ''; } }
  function build() { var out = [], seen = {}; mailboxes().forEach(function(mb){ var st = mb.state || {}, my = String(st.entityUrn || ''); var pmap = {}; vals(st.participants).concat(Object.values(st.participants && !Array.isArray(st.participants) && !(st.participants instanceof Map) ? st.participants : {})).forEach(function(p){ if (p && p.hostIdentityUrn) pmap[String(p.hostIdentityUrn)] = p; });
      vals(st.conversations).forEach(function(c){ if (!c || c.isDraft) return; var id = idOf(c); if (!id || seen[id]) return; seen[id] = 1;
        var purns = (c.participants || []).map(function(p){ return typeof p === 'string' ? p : String(p && (p.hostIdentityUrn || p.entityUrn) || ''); }).filter(Boolean), others = purns.filter(function(u){ return u !== my; });
        var op = pmap[others[0]] || null, group = !!c.groupChat || others.length > 1;
        var name = String(c.title || '').trim() || others.map(function(u){ return pname(pmap[u]); }).filter(Boolean).join(', ') || id;
        var ls = lastSender(c), fromMe = ls ? (ls === my) : null, cats = c.categories || [];
        out.push({ id: id, name: name, username: '', phone: '', uid: others[0] ? String(others[0]).replace(/^urn:li:fsd_profile:/, '') : '', group: group, kind: group ? 'group' : 'private', unread: Number(c.unreadCount) || (c.read === false ? 1 : 0), unreadKnown: true, t: Math.floor(ms(c.lastActivityAt) / 1000), archive: cats.indexOf('ARCHIVE') > -1, avatar: group ? '' : pic(op), lastFromMe: fromMe, lastAck: null, members: group ? purns.length : 0, url: String(c.conversationUrl || '') }); }); });
    return out.sort(function(a, b){ return b.t - a.t; }); }
  var last = [];
  function collect() { try { var l = build(); if (l.length) last = l; } catch(e){} return Promise.resolve(last); }
  function activeId() { try { var m = (location.pathname || '').match(/\/messaging\/thread\/([^\/?#]+)/); return m ? m[1] : ''; } catch(e){ return ''; } }
  function rowByName(name) { return [].slice.call(D().querySelectorAll('li.msg-conversation-listitem')).find(function(li){ var h = li.querySelector('.msg-conversation-listitem__participant-names'); return h && h.textContent.trim() === name; }) || null; }
  function openChat(id, name) { return new Promise(function(res){ try { id = String(id || ''); if (!id) return res('nochat'); var c = last.find(function(x){ return x.id === id; }); var url = (c && c.url) || ('/messaging/thread/' + id + '/');
      try { var o = owner(), rt = o && o.lookup('service:router'); if (rt && rt.transitionTo) { rt.transitionTo(url.replace(/^https?:\/\/[^\/]+/, '')); return res('ok'); } } catch(e){}
      var li = name ? rowByName(String(name)) : null; if (li) { clickEl(li.querySelector('.msg-conversation-listitem__link') || li); return res('ok'); }
      location.assign(url); res('ok');
    } catch(e){ res('error:' + (e && e.message)); } }); }
  window.__scrmContacts = { v: 2, platform: 'linkedin', caps: { unread: true, ack: false, group: true, archive: true, channel: false },
    list: function(){ return collect(); }, active: activeId, open: openChat, groupMembers: function(){ return []; }, _build: build };
})();
/* [LI-CONTACTS-END] */
