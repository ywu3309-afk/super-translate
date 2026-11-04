/* [SESS-CARDS] 2026-10-02 会话卡片栏(对齐 CEO):单击左侧平台 → 平台面板左边出一列会话卡片,右边显示这个平台当前打开的会话(没有就显示空状态);
   双击平台 → 原来的会话表格。所有平台共用这一份(WhatsApp / Telegram / 通用平台三类数据在 model() 里统一成同一种卡片数据)。
   · 打开/启动会话:openSession() 与侧栏账号小列表点击是同一套流程(_isSessionShown → switchPanel → openWaChat/openTgChat/openGenericChat),端口额度照常生效
   · 卡片栏插在平台面板里聊天区(MainArea)左边;聊天视图位置本来就按 MainArea 实际坐标算,卡片栏出现/消失时视图自动让位
   · 备注:卡片上直接改,保存走 app-main 的 scrmSetRemark(三类平台唯一的保存入口)
   · 置顶:localStorage scrm_card_pins = {激活码:{平台:[sid…]}},只影响卡片排序,不改会话存储顺序(表格、TG 服务器顺序都不动)。键名不用 scrm_sessions_ 前缀(那是账号总表的列表键)
   · 元素 id/class 避开 ChatView/ListView/Modal 结尾、.panel、含 sidebar/right/translate 的类名(页面和主进程有按这些名字的全局选择器)
   · 未读数角标与左侧账号小列表同一取法、同一样式(绿色圆角数字,对齐 .plat-sub-item .wa-badge)
   · 新建会话沿用各平台原弹窗;弹窗打开期间收起聊天视图、关掉放回,由弹窗自己成对处理(不轮询)
   回归:/opt/scrm-api/test-sess-cards.mjs */
(function () {
  'use strict';
  if (window.ScrmSessCards) return;
  var COL_W = 248, COL_W_MINI = 104;   // 卡片栏宽度:完整 / 收起(对齐 CEO:收起后只剩头像+名字)
  /* st.env:{ p, sid } 环境配置中的会话(对齐 CEO:点「代理设置」把屏幕清空、这张卡片高亮、右侧面板绑它;改好代理再点「打开窗口」扫码)
     st.loading:平台:sid → { t: 点下的时间, spin: 是否转圈 }。每一次 openSession/重启都记一条;它是高亮的唯一来源(最近点的那张),spin 只给"没打开过的"(切已开窗口不转圈)。
     打开流程结束(Promise 回来)或 30s 看门狗到期都走同一个 finishOpen 收尾 */
  var st = { on: false, p: null, q: '', sig: '', editing: false, last: {}, loading: {}, env: null, flipping: false };   // flipping: 翻页进行中(有要显示的会话时空状态先不显示,打开流程等翻完再起)
  var OPEN_WATCHDOG_MS = 30000;   // 只兜「打开流程的 Promise 永远不回」(IPC 不回),正常都由流程结束清
  function loadKey(p, sid) { return p + ':' + sid; }
  function loadingOf(p, sid) { return st.loading[loadKey(p, sid)] || null; }
  function setLoading(p, sid, spin) { st.loading[loadKey(p, sid)] = { t: Date.now(), spin: !!spin }; }
  function anyLoading(p) { var pre = p + ':'; return Object.keys(st.loading).some(function (k) { return k.indexOf(pre) === 0; }); }
  /* 打开/重启流程的唯一收尾:清这条 loading、复位"切聊天中"旗子(openWaChat 在占端口失败时早退不复位,之后 switchPanel 会跳过回列表 → WA 面板空白)、重画(空状态由 render 派生) */
  function finishOpen(p, sid) {
    delete st.loading[loadKey(p, sid)];
    if (fam(p) === 'wa') window.__switchingToWaChat = false;
    if (fam(p) === 'tg') window.__switchingToTgChat = false;
    render(true);
  }
  function sweepLoading() { var now = Date.now(); Object.keys(st.loading).forEach(function (k) { if (now - st.loading[k].t > OPEN_WATCHDOG_MS) { var i = k.indexOf(':'); finishOpen(k.slice(0, i), k.slice(i + 1)); } }); }

  /* ---------- 平台映射 ---------- */
  function fam(p) { return p === 'whatsapp' ? 'wa' : (p === 'telegram' ? 'tg' : 'gen'); }
  function cap(p) { return p.charAt(0).toUpperCase() + p.slice(1); }
  /* 两套键名只在这里换算:panelKey = 面板/_isSessionShown/openXxx 用('whatsapp'|'telegram'|p);rmKey = 备注/头像函数用('wa'|'tg'|p);元素 id 见 ids(p) */
  function keysOf(p) { var f = fam(p); return { panelKey: f === 'wa' ? 'whatsapp' : (f === 'tg' ? 'telegram' : p), rmKey: f === 'wa' ? 'wa' : (f === 'tg' ? 'tg' : p) }; }
  function ids(p) {
    var f = fam(p);
    if (f === 'wa') return { panel: 'panelWhatsapp', main: 'waMainArea', list: 'waListView', chat: 'waChatView', rt: 'waRightToolbar' };
    if (f === 'tg') return { panel: 'panelTelegram', main: 'tgMainArea', list: 'tgListView', chat: 'tgChatView', rt: 'telegramRightToolbar' };
    return { panel: 'panel' + cap(p), main: p + 'MainArea', list: p + 'ListView', chat: p + 'ChatView', rt: p + 'RightToolbar' };
  }
  function platName(p) { if (p === 'whatsapp') return 'WhatsApp'; try { return (GENERIC_PLATFORMS[p] && GENERIC_PLATFORMS[p].name) || cap(p); } catch (e) { return cap(p); } }
  /* 支持卡片的平台:WhatsApp、Telegram、有面板的通用平台;WhatsApp API(单页 iframe)和 Telegram-W(打不开会话)不支持 */
  function supports(p) {
    if (!p || p === 'waapi' || p === 'telegram_w') return false;
    if (p === 'whatsapp' || p === 'telegram') return true;
    try { return !!GENERIC_PLATFORMS[p] && !!document.getElementById(ids(p).main); } catch (e) { return false; }
  }

  /* ---------- 数据:三类平台统一成卡片数据(取值与各自表格一致) ---------- */
  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function ls(k) { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } }
  var _avCache = {};   // sid → { t, v }:scrm_avatar_<sid> 可能是几十 KB 的 data URI,每秒 tick 对 50 个号都读一遍 = 每秒几 MB 字符串拷贝 → 30s 内复用
  function avLs(sid) { var now = Date.now(), e = _avCache[sid]; if (!e || now - e.t > 30000) { e = _avCache[sid] = { t: now, v: ls('scrm_avatar_' + sid) }; } return e.v; }
  function jls(k, d) { try { var v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? d : v; } catch (e) { return d; } }
  function selfAv(id) { return (window.__selfAvatars && window.__selfAvatars[id]) || ''; }
  function proxyText(px) { if (!px) return ''; if (typeof px === 'string') return px; return px.host ? (px.host + (px.port ? ':' + px.port : '')) : ''; }
  function setHas(set, k) { try { return !!(set && set.has && set.has(k)); } catch (e) { return false; } }
  /* 未读数:与左侧账号小列表的角标同一取法(WA:__scrmWaUnread,TG:__scrmTgUnread,其余:__scrmGenericUnread[平台_账号]) */
  function unreadOf(f, p, sid) {
    var g = window.__scrmGenericUnread || {};
    if (f === 'wa') return Number((window.__scrmWaUnread && window.__scrmWaUnread[sid]) || g['wa_' + sid] || 0);
    if (f === 'tg') return Number((window.__scrmTgUnread && window.__scrmTgUnread[sid]) || g['tg_' + sid] || 0);
    return Number(g[p + '_' + sid] || 0);
  }

  function model(p) {
    var f = fam(p), out = [];
    if (f === 'wa') {
      var wl = window.__waSessionsCache && window.__waSessionsCache.length ? window.__waSessionsCache : jls('scrm_wa_sessions', []);
      (wl || []).forEach(function (s, i) {
        var sid = s.session_id; if (!sid) return;
        var open = setHas(window.__waOpenSessions, sid) || setHas(window.__waWindowOpen, sid);
        var num = s.wa_number || (s.info && s.info.wid) || '';
        out.push({ sid: sid, name: s.wa_name || (s.info && s.info.pushname) || ('WhatsApp ' + (i + 1)), sub: num ? '+' + String(num).replace(/^\+/, '') : '',
          av: selfAv(sid) || selfAv(s.wa_number) || (window.__scrmAvatarCache && window.__scrmAvatarCache[sid]) || s.avatar_url || s.avatar || s.headImg || avLs(sid),
          online: s.liveStatus === 'ready' || (setHas(window.__waOpenSessions, sid) && !s.__waLoggedOut), open: open, unread: unreadOf('wa', p, sid), remark: s.remark || '',
          region: s.proxy_ip ? ((s.region || 'Unknown') + ' (' + s.proxy_ip + ')') : (s.region || ''), wid: num, bg: 'linear-gradient(135deg,#25d366,#128c7e)' });
      });
    } else if (f === 'tg') {
      var tl = (window.__tgSessionsCache && window.__tgSessionsCache.length) ? window.__tgSessionsCache : ((typeof tgSessions !== 'undefined' && tgSessions && tgSessions.length) ? tgSessions : jls('scrm_tg_sessions', []));
      (tl || []).forEach(function (s, i) {
        var sid = s.session_id; if (!sid) return;
        out.push({ sid: sid, name: s.tg_name || ('Telegram ' + (i + 1)), sub: s.tg_phone ? '+' + String(s.tg_phone).replace(/^\+/, '') : (s.tg_username ? '@' + s.tg_username : ''),
          av: selfAv(sid) || s.avatar_url || s.avatar || avLs(sid),
          online: typeof _scrmIsSessionOnline === 'function' ? _scrmIsSessionOnline('telegram', sid) : s.liveStatus === 'ready',
          open: setHas(window.__tgOpenSessions, sid), unread: unreadOf('tg', p, sid), remark: s.remark || '', region: s.region || proxyText(s.proxy), bg: 'linear-gradient(135deg,#229ed9,#1b7db0)' });
      });
    } else {
      var gl = typeof getGenericSessions === 'function' ? getGenericSessions(p) : [];
      (gl || []).forEach(function (s, i) {
        var sid = s.id; if (!sid) return;
        out.push({ sid: sid, name: s.userName || (platName(p) + ' ' + (i + 1)),
          sub: s.cleanUserId || (s.userId && !/^U[0-9A-Za-z_-]{28,}$/.test(s.userId) ? s.userId : '') || s.loginName || '',
          av: selfAv(sid) || s.headImg || avLs(sid),
          online: (s.lineLoggedIn !== undefined) ? !!s.lineLoggedIn : (s.status === 'ready'),
          open: setHas(window.__genericOpenSessions, p + '_' + sid), unread: unreadOf('gen', p, sid), remark: s.remark || '', region: s.region || (s.proxy ? '代理: ' + proxyText(s.proxy) : ''), bg: 'linear-gradient(135deg,#7c3aed,#6d28d9)' });
      });
    }
    return out;
  }
  function activeSid(p) {
    var f = fam(p);
    try {
      if (f === 'wa') return window.waActiveSessionId || null;
      if (f === 'tg') return (typeof tgActiveSessionId !== 'undefined' && tgActiveSessionId) || null;
      return (window.genericActiveSession && window.genericActiveSession[p]) || null;
    } catch (e) { return null; }
  }

  /* ---------- 置顶(按激活码分开存) ---------- */
  function pinKey() { return ls('scrm_invite_code') || '_'; }
  function pinsOf(p) { var all = jls('scrm_card_pins', {}); return ((all[pinKey()] || {})[p] || []).slice(); }
  function setPins(p, arr) { var all = jls('scrm_card_pins', {}); var k = pinKey(); all[k] = all[k] || {}; all[k][p] = arr; try { localStorage.setItem('scrm_card_pins', JSON.stringify(all)); } catch (e) {} }
  function sorted(p, list) {
    var pins = pinsOf(p);
    return list.map(function (c, i) { var pi = pins.indexOf(c.sid); c.pinned = pi >= 0; c._k = pi >= 0 ? pi : pins.length + i; return c; }).sort(function (a, b) { return a._k - b._k; });
  }


  /* ---------- 样式(只用主题变量,深色/浅色都适用) ---------- */
  (function () {
    if (document.getElementById('scrm-sesscol-css')) return;
    var css =
      /* 卡片模式不显示顶部工具栏/公告条:按「当前面板里挂着卡片栏」由 CSS 统一管(各平台列表流程会异步把工具栏重新显示,靠脚本隐藏会先闪一下;切去首页等别的面板自动恢复) */
      'body:has(.panel.active>.scrm-sesscol) .main-content .info-bar{display:none!important}' +
      '.scrm-sesscol{width:' + COL_W + 'px;flex:none;display:flex;flex-direction:column;gap:10px;padding:12px 10px 10px;box-sizing:border-box;border-left:1px solid var(--border);border-right:1px solid var(--border);background:var(--surface);min-height:0;height:100%}' +
      '.scrm-sesscol .ssc-zoom{display:flex;align-items:center;gap:4px;padding:4px 6px;margin:0 4px 4px;border-radius:8px;background:var(--surface2,#f3f4f6);font-size:12px}.scrm-sesscol .ssc-zoom button{height:22px;min-width:22px;padding:0 6px;border:1px solid var(--border,#e5e7eb);border-radius:6px;background:var(--surface,#fff);color:var(--text);cursor:pointer;font-size:12px}.scrm-sesscol .ssc-zoom span{min-width:40px;text-align:center;font-weight:600}' +
      '.scrm-sesscol .ssc-hd{display:flex;align-items:center;gap:6px;padding:0 4px}.scrm-sesscol .ssc-title{font-size:15px;font-weight:700;color:var(--text)}' +
      '.scrm-sesscol .ssc-ico{border:none;background:transparent;color:var(--text3);cursor:pointer;width:24px;height:24px;border-radius:6px}.scrm-sesscol .ssc-ico:hover{color:var(--accent);background:rgba(124,58,237,.1)}' +
      '.scrm-sesscol .ssc-cnt{margin-left:auto;font-size:11px;color:var(--text3)}' +
      '.scrm-sesscol .ssc-search input{width:100%;box-sizing:border-box;height:30px;padding:0 10px;border:1px solid var(--border);border-radius:8px;background:var(--surface2,transparent);color:var(--text);font-size:12.5px;outline:none}.scrm-sesscol .ssc-search input:focus{border-color:var(--accent)}' +
      '.scrm-sesscol .ssc-new{height:34px;border:none;border-radius:8px;background:var(--accent);color:#fff;font-size:13px;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;flex:none}.scrm-sesscol .ssc-new:hover{filter:brightness(1.08)}' +
      '.scrm-sesscol .ssc-list{flex:1;min-height:0;overflow-y:auto;display:flex;flex-direction:column;gap:8px;padding:2px 2px 4px;scrollbar-width:thin}' +
      '.scrm-sesscol .ssc-card{position:relative;border:1px solid var(--border);border-radius:10px;padding:22px 10px 8px;cursor:pointer;background:var(--surface);transition:border-color .15s,box-shadow .15s}' +
      '.scrm-sesscol .ssc-card:hover{border-color:rgba(124,58,237,.45)}.scrm-sesscol .ssc-card.active{border-color:var(--accent);box-shadow:0 0 0 1px var(--accent) inset}' +
      '.scrm-sesscol .ssc-tag{position:absolute;top:0;left:0;font-size:11px;line-height:18px;padding:0 10px 0 7px;color:#fff;border-radius:9px 0 0 0;clip-path:polygon(0 0,100% 0,88% 50%,100% 100%,0 100%)}.scrm-sesscol .ssc-tag.on{background:var(--green,#10b981)}.scrm-sesscol .ssc-tag.off{background:#9ca3af}' +
      '.scrm-sesscol .ssc-corner{position:absolute;top:4px;right:8px;display:flex;align-items:center;gap:6px;z-index:1}.scrm-sesscol .ssc-pinned{font-size:11px;color:var(--accent)}' +
      '.scrm-sesscol .ssc-cbtn{position:relative;width:20px;height:20px;border:none;border-radius:5px;background:transparent;color:var(--text3);font-size:12px;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0}.scrm-sesscol .ssc-cbtn:hover{color:var(--accent);background:rgba(124,58,237,.12)}.scrm-sesscol .ssc-cbtn[data-act="close"]:hover{color:#dc2626;background:rgba(220,38,38,.1)}.scrm-sesscol.mini .ssc-cbtn{display:none}' +
      '.scrm-sesscol .ssc-row{display:flex;align-items:center;gap:10px;margin-bottom:6px}.scrm-sesscol .ssc-who{min-width:0;flex:1}.scrm-sesscol .ssc-unread{min-width:18px;height:18px;border-radius:9px;background:#25D366;color:#000;font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center;padding:0 5px;box-sizing:border-box}' +
      '.scrm-sesscol .ssc-name{font-size:14px;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.scrm-sesscol .ssc-sub{font-size:12.5px;color:var(--text2,var(--text3));white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
      '.scrm-sesscol .ssc-line{display:flex;align-items:center;gap:8px;font-size:12px;color:var(--text3);line-height:22px;min-width:0}.scrm-sesscol .ssc-line i{width:13px;text-align:center;flex:none}.scrm-sesscol .ssc-line span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
      '.scrm-sesscol .ssc-rm{cursor:text}.scrm-sesscol .ssc-rm:hover span{color:var(--accent)}.scrm-sesscol .ssc-rm em{font-style:normal}' +
      '.scrm-sesscol .ssc-rm-in{flex:1;min-width:0;height:22px;padding:0 6px;border:1px solid var(--accent);border-radius:5px;background:var(--surface);color:var(--text);font-size:12px;outline:none}' +
      '.scrm-sesscol .ssc-none{padding:30px 6px;text-align:center;font-size:12.5px;color:var(--text3)}' +
      '.scrm-sesscol .ssc-pin{height:32px;border:1px solid var(--border);border-radius:8px;background:var(--surface2,transparent);color:var(--text2,var(--text));font-size:12.5px;cursor:pointer}.scrm-sesscol .ssc-pin:hover:not(:disabled){border-color:var(--accent);color:var(--accent)}.scrm-sesscol .ssc-pin:disabled{opacity:.5;cursor:not-allowed}' +
      '.scrm-sesscol .ssc-av{position:relative;flex:none;display:flex}.scrm-sesscol .ssc-dot{display:none}' +
      /* [SESS-ACTS] 悬停离线卡片 → 整张卡片变暗的暗层上浮出三个圆按钮(对齐 CEO):打开窗口 / 代理设置 / 删除窗口;暗层接住整张卡片的点击,备注/地区点不到 */
      '.scrm-sesscol .ssc-card.ssc-off:hover{background:rgba(17,24,39,.14);background:color-mix(in srgb,var(--text) 14%,var(--surface));border-color:transparent}' +
      '.scrm-sesscol .ssc-card.ssc-env{border-color:var(--accent);border-style:dashed}' +   /* 环境配置中(右侧面板绑着它,但不是屏幕上的会话):虚线框 */
      '.scrm-sesscol .ssc-acts{position:absolute;inset:0;display:none;align-items:center;justify-content:center;gap:18px;z-index:2}.scrm-sesscol .ssc-card:hover .ssc-acts{display:flex}'   /* 悬停的暗层盖住整张卡片并接住所有点击:暗层上只有三个按钮能点,底下的备注/地区点不到(对齐 CEO) */ +
      '.scrm-sesscol .ssc-act{width:40px;height:40px;border-radius:50%;border:none;background:#fff;color:#2b6de9;display:flex;align-items:center;justify-content:center;font-size:15px;cursor:pointer;box-shadow:0 2px 8px rgba(15,23,42,.18)}.scrm-sesscol .ssc-act:hover{background:#2b6de9;color:#fff}' +
      '.scrm-sesscol .ssc-act.del:hover{background:#dc2626;color:#fff}' +
      /* 按钮提示即时显示(浏览器原生 title 要等 1 秒;对齐 CEO:深色小气泡在按钮上方) */
      '.scrm-sesscol [data-tip]{position:relative}.scrm-sesscol [data-tip]::after{content:attr(data-tip);position:absolute;left:50%;bottom:calc(100% + 8px);transform:translateX(-50%);background:#1f2937;color:#fff;font-size:12px;line-height:1;padding:7px 10px;border-radius:6px;white-space:nowrap;opacity:0;pointer-events:none;transition:opacity .08s}' +
      '.scrm-sesscol [data-tip]::before{content:"";position:absolute;left:50%;bottom:calc(100% + 3px);transform:translateX(-50%);border:5px solid transparent;border-top-color:#1f2937;opacity:0;pointer-events:none;transition:opacity .08s}.scrm-sesscol [data-tip]:hover::after,.scrm-sesscol [data-tip]:hover::before{opacity:1}' +
      /* 右上角小按钮贴着卡片右边和上边:气泡改成在按钮下方、右对齐(在上方/居中会被列表边缘和上一张卡片切掉) */
      '.scrm-sesscol .ssc-cbtn::after{left:auto;right:0;bottom:auto;top:calc(100% + 7px);transform:none}.scrm-sesscol .ssc-cbtn::before{left:auto;right:5px;bottom:auto;top:calc(100% + 2px);transform:none;border-top-color:transparent;border-bottom-color:#1f2937}' +
      '.scrm-sesscol.mini .ssc-acts{display:none!important}' +
      /* [SSC-FLIP] 单击平台进入卡片模式:整个平台面板(卡片栏+聊天区)以左侧平台栏那条边为书脊翻开,与右侧功能区同一套翻页手感(22°、.32s、同一条曲线);
         翻页期间原生网页视图整体 hold(屏外),翻完再显示;右侧工具栏(position:fixed;WA 的在面板外、其它 20 个在面板内,面板内的在 transform 期间会以面板为定位基准跳位)翻页期间一律先不显示,翻完一起出现 */
      '@keyframes sscFlipIn{from{transform:perspective(1600px) rotateY(22deg);opacity:.35}to{transform:none;opacity:1}}' +
      '.panel.ssc-flip{animation:sscFlipIn .32s cubic-bezier(.4,0,.2,1);transform-origin:left center;backface-visibility:hidden}' +
      /* 打开中:卡片变暗 + 中间蓝色转圈(对齐 CEO),打开流程结束(窗口出来/失败)即恢复;期间不显示三个按钮、不响应再次点击 */
      '.scrm-sesscol .ssc-card.ssc-loading{background:rgba(17,24,39,.14);background:color-mix(in srgb,var(--text) 14%,var(--surface));border-color:transparent;pointer-events:none}.scrm-sesscol .ssc-card.ssc-loading .ssc-acts{display:none!important}' +
      '.scrm-sesscol .ssc-card.ssc-loading::after{content:"";position:absolute;left:50%;top:50%;width:34px;height:34px;margin:-17px 0 0 -17px;border-radius:50%;border:3px solid transparent;border-top-color:#2b6de9;border-right-color:#2b6de9;animation:sscSpin .8s linear infinite;z-index:3}@keyframes sscSpin{to{transform:rotate(360deg)}}' +
      '.scrm-sesscol .ssc-new .ssc-txt{margin-left:0}' +
      /* [SESS-MINI] 收起:宽 104,只剩头像(左下角在线绿点/离线灰点)+名字,对齐 CEO */
      '.scrm-sesscol.mini{width:' + COL_W_MINI + 'px;padding:12px 8px 10px;gap:8px}' +
      '.scrm-sesscol.mini .ssc-hd{padding:0;gap:2px}.scrm-sesscol.mini .ssc-title{font-size:13px;min-width:0;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
      '.scrm-sesscol.mini #sscZoom,.scrm-sesscol.mini #sscZoomPop,.scrm-sesscol.mini #sscSearchBtn,.scrm-sesscol.mini .ssc-cnt,.scrm-sesscol.mini .ssc-search,.scrm-sesscol.mini .ssc-new .ssc-txt,.scrm-sesscol.mini .ssc-tag,.scrm-sesscol.mini .ssc-sub,.scrm-sesscol.mini .ssc-line,.scrm-sesscol.mini .ssc-pinned{display:none!important}' +
      '.scrm-sesscol.mini .ssc-card{padding:10px 4px 8px}.scrm-sesscol.mini .ssc-row{flex-direction:column;gap:6px;margin:0}.scrm-sesscol.mini .ssc-who{width:100%;text-align:center}' +
      '.scrm-sesscol.mini .ssc-name{font-size:12.5px;font-weight:500}.scrm-sesscol.mini .ssc-corner{top:3px;right:3px}' +
      '.scrm-sesscol.mini .ssc-dot{display:block;position:absolute;left:0;bottom:0;width:10px;height:10px;border-radius:50%;border:2px solid var(--surface);background:#9ca3af}.scrm-sesscol.mini .ssc-dot.on{background:var(--green,#10b981)}' +
      '.scrm-sesscol.mini .ssc-pin{height:auto;min-height:32px;padding:4px 2px;white-space:normal;line-height:1.35;font-size:12px}' +
      /* [MINI-NUDGE] 收起时点没打开的卡片:「展开会话栏」按钮抖两下并高亮,提示气泡在按钮下方(见 nudgeFold) */
      '@keyframes sscNudge{0%,100%{transform:none}15%{transform:translateX(-3px) rotate(-12deg)}30%{transform:translateX(3px) rotate(12deg)}45%{transform:translateX(-3px) rotate(-8deg)}60%{transform:translateX(2px) rotate(6deg)}75%{transform:translateX(-1px) rotate(-3deg)}}' +
      '.scrm-sesscol .ssc-ico.ssc-nudge{color:var(--accent);background:rgba(124,58,237,.15);box-shadow:0 0 0 2px var(--accent);animation:sscNudge .6s ease-in-out 2}' +
      '.scrm-sessempty{flex:1;display:none;flex-direction:column;align-items:center;justify-content:center;gap:8px;color:var(--text3)}.scrm-sessempty .sse-ic{font-size:44px;opacity:.45}.scrm-sessempty .sse-t{font-size:15px;color:var(--text2,var(--text))}.scrm-sessempty .sse-s{font-size:12.5px}';
    /* [CARD-MENU] 右键菜单:fixed 定位,位置始终夹在卡片栏的矩形里(聊天区是原生视图,菜单伸过去会被挡住) */
    css += '#sscMenu{position:fixed;z-index:10060;box-sizing:border-box;min-width:132px;padding:5px;border-radius:10px;background:var(--surface,#fff);border:1px solid var(--border,#e5e7eb);box-shadow:0 10px 30px rgba(0,0,0,.22);font-size:12.5px;color:var(--text,#111)}' +
      'body.light #sscMenu{background:#fff}body:not(.light) #sscMenu{background:#1f2230}' +
      '#sscMenu button{display:flex;align-items:center;gap:8px;width:100%;height:30px;padding:0 10px;border:none;border-radius:7px;background:transparent;color:inherit;font:inherit;cursor:pointer;white-space:nowrap;text-align:left}' +
      '#sscMenu button i{width:14px;text-align:center;font-size:12px;opacity:.75}#sscMenu button:hover{background:rgba(124,58,237,.12);color:var(--accent,#7c3aed)}' +
      '#sscMenu button.danger{color:var(--red,#dc2626)}#sscMenu button.danger:hover{background:rgba(220,38,38,.1);color:var(--red,#dc2626)}' +
      '#sscMenu hr{border:none;border-top:1px solid var(--border,#e5e7eb);margin:4px 6px}#sscMenu.mini{min-width:0;padding:4px}#sscMenu.mini button{padding:0 6px;gap:5px;font-size:12px}';
    /* [MINI-NUDGE] 提示气泡:fixed 定位,右边不超过卡片栏右边(再往右是聊天区原生视图,会被挡住),往左伸到侧栏上;不接点击 */
    css += '#sscNudgeTip{position:fixed;z-index:10061;box-sizing:border-box;padding:8px 11px;border-radius:8px;background:#1f2937;color:#fff;font-size:12.5px;line-height:1.5;box-shadow:0 8px 24px rgba(0,0,0,.25);pointer-events:none;animation:sscTipIn .16s ease-out}' +
      '#sscNudgeTip::before{content:"";position:absolute;top:-10px;left:var(--ax,50%);margin-left:-5px;border:5px solid transparent;border-bottom-color:#1f2937}' +
      '@keyframes sscTipIn{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}' +
      /* 浅色模式:白底深字 + 2px 紫色描边(和按钮高亮框同一个 --accent);小箭头白色盖住描边,外面再垫一个紫色大一圈的箭头当描边(两条斜边相距约 2px,和外框一样粗) */
      'body.light #sscNudgeTip{background:#fff;color:#1f2937;border:2px solid var(--accent,#7c3aed);box-shadow:0 8px 24px rgba(124,58,237,.18)}' +
      'body.light #sscNudgeTip::before{top:-9px;border-bottom-color:#fff;z-index:1}' +
      'body.light #sscNudgeTip::after{content:"";position:absolute;top:-14px;left:var(--ax,50%);margin-left:-7px;border:7px solid transparent;border-bottom-color:var(--accent,#7c3aed)}';
    var el = document.createElement('style'); el.id = 'scrm-sesscol-css'; el.textContent = css; (document.head || document.documentElement).appendChild(el);
  })();

  /* ---------- DOM ---------- */
  var col, emptyEl;
  function build() {
    if (col) return;
    col = document.createElement('div'); col.className = 'scrm-sesscol'; col.id = 'scrmSessCol'; col.style.display = 'none';
    col.innerHTML =
      '<div class="ssc-hd"><span class="ssc-title" id="sscTitle"></span><button class="ssc-ico" id="sscZoom" title="页面缩放"><i class="fas fa-search-plus"></i></button><button class="ssc-ico" id="sscSearchBtn" title="搜索"><i class="fas fa-search"></i></button><button class="ssc-ico" id="sscFold" title="收起会话栏"><i class="fas fa-outdent"></i></button><span class="ssc-cnt" id="sscCnt"></span></div>' +
      '<div class="ssc-zoom" id="sscZoomPop" style="display:none"><button type="button" data-z="-" title="缩小">−</button><span id="sscZoomV">100%</span><button type="button" data-z="+" title="放大">+</button><button type="button" data-z="1" title="恢复 100%">重置</button></div>' +
      '<div class="ssc-search" id="sscSearch" style="display:none"><input id="sscQ" placeholder="搜索名字 / 号码 / 备注"></div>' +
      '<button class="ssc-new" id="sscNew" title="新建会话"><i class="fas fa-plus"></i><span class="ssc-txt">新建会话</span></button>' +
      '<div class="ssc-list" id="sscList"></div>' +
      '<button class="ssc-pin" id="sscPin"></button>';
    emptyEl = document.createElement('div'); emptyEl.className = 'scrm-sessempty'; emptyEl.id = 'scrmSessEmpty'; emptyEl.style.display = 'none';
    emptyEl.innerHTML = '<div class="sse-ic"><i class="far fa-comments"></i></div><div class="sse-t">还没有打开的会话</div><div class="sse-s">点左边的会话卡片打开</div>';
    var hold = document.createElement('div'); hold.id = 'scrmSessHold'; hold.style.display = 'none'; hold.appendChild(col); hold.appendChild(emptyEl); document.body.appendChild(hold);

    col.addEventListener('click', function (e) {
      var t = e.target;
      if (t.closest('#sscSearchBtn')) { var s = document.getElementById('sscSearch'); var on = s.style.display === 'none'; s.style.display = on ? '' : 'none'; if (on) document.getElementById('sscQ').focus(); else { st.q = ''; document.getElementById('sscQ').value = ''; render(true); } return; }
      if (t.closest('#sscFold')) { setMini(!col.classList.contains('mini')); return; }
      if (t.closest('#sscZoom')) { zoomToggle(); return; }
      if (t.closest('#sscZoomPop button')) { zoomStep(t.closest('button').getAttribute('data-z')); return; }
      if (t.closest('#sscNew')) { newSession(); return; }
      if (t.closest('#sscPin')) { togglePin(); return; }
      if (t.closest('.ssc-rm-in')) return;   // 编辑中点输入框(移动光标)不是再次进入编辑
      var rm = t.closest('.ssc-rm'); if (rm) { editRemark(rm); return; }
      var act = t.closest('.ssc-act,.ssc-cbtn'); if (act) { cardAction(act.getAttribute('data-act'), act.closest('.ssc-card').getAttribute('data-sid')); return; }
      var card = t.closest('.ssc-card'); if (!card) return;
      if (!card.classList.contains('ssc-off')) openSession(st.p, card.getAttribute('data-sid'));   /* 离线卡片只能点「打开窗口」按钮打开(对齐 CEO),点卡片别处不动;在线/已打开的点卡片=切过去 */
      else if (col.classList.contains('mini')) nudgeFold();   /* [MINI-NUDGE] 收起时卡片上没有「打开窗口」按钮:提示先展开 */
    });
    col.addEventListener('contextmenu', function (e) {   // [CARD-MENU] 右键卡片 = 这张卡片能做的操作集中在一个菜单里
      var card = e.target.closest('.ssc-card'); if (!card || e.target.closest('.ssc-rm-in')) return;   // 备注输入框里保留系统自带的右键(粘贴等)
      e.preventDefault(); menuOpen(card.getAttribute('data-sid'), e.clientX, e.clientY);
    });
    try { if (localStorage.getItem('scrm_sesscol_mini') === '1') { col.classList.add('mini'); var fb = document.getElementById('sscFold'); fb.title = '展开会话栏'; fb.innerHTML = '<i class="fas fa-indent"></i>'; } } catch (e) {}
    document.getElementById('sscQ').addEventListener('input', function () { st.q = this.value.trim().toLowerCase(); render(true); });
  }
  function mount(p) {
    build();
    var I = ids(p), panel = document.getElementById(I.panel), main = document.getElementById(I.main);
    if (!panel || !main) return false;
    if (col.parentNode !== panel || col.nextSibling !== main) panel.insertBefore(col, main);
    if (emptyEl.parentNode !== main) { main.appendChild(emptyEl); watchChat(p); }
    col.style.display = '';
    return true;
  }
  function unmount() {
    if (!col) return;
    if (_chatObs) { _chatObs.disconnect(); _chatObs = null; }
    var hold = document.getElementById('scrmSessHold');
    col.style.display = 'none'; emptyEl.style.display = 'none';
    if (hold) { hold.appendChild(col); hold.appendChild(emptyEl); }
    resized();
  }
  /* [SESS-MINI] 收起/展开会话栏(对齐 CEO):只切 .mini 类,样式全在 CSS;记在本机 scrm_sesscol_mini;宽度变了 → 当前聊天视图跟着让位(与侧栏收起共用 _scrmSyncViews) */
  function setMini(on) {
    build(); nudgeHide(); col.classList.toggle('mini', !!on);
    var b = document.getElementById('sscFold'); if (b) { b.title = on ? '展开会话栏' : '收起会话栏'; b.innerHTML = '<i class="fas fa-' + (on ? 'indent' : 'outdent') + '"></i>'; }
    if (on && st.q) { st.q = ''; document.getElementById('sscQ').value = ''; document.getElementById('sscSearch').style.display = 'none'; render(true); }   // 收起后没有搜索框,清掉筛选免得看不到全部会话
    try { localStorage.setItem('scrm_sesscol_mini', on ? '1' : '0'); } catch (e) {}
    requestAnimationFrame(resized);
  }
  /* [MINI-NUDGE] 2026-10-20 客户反馈「点了没反应、以为坏了」:会话栏收起(只剩头像)时卡片上没有「打开窗口」按钮,点没打开的卡片原来什么都不发生。
     现在:「展开会话栏」按钮抖两下并高亮,按钮下方弹提示,3.5 秒后自动消失;展开/收起、退出卡片模式、窗口缩放时立刻收掉。再点一次重新抖。 */
  var nudgeEl = null, nudgeT = null;
  function nudgeHide() {
    clearTimeout(nudgeT); nudgeT = null;
    if (nudgeEl) { nudgeEl.remove(); nudgeEl = null; }
    var b = document.getElementById('sscFold'); if (b) b.classList.remove('ssc-nudge');
  }
  function nudgeFold() {
    var b = document.getElementById('sscFold'); if (!b || !col || !col.classList.contains('mini')) return;
    nudgeHide(); void b.offsetWidth; b.classList.add('ssc-nudge');   /* 先去类再强制重排,连点时动画从头再来 */
    var m = document.createElement('div'); m.id = 'sscNudgeTip'; m.textContent = '会话栏已收起:点这里展开,再点卡片上的「打开窗口」';
    var r = b.getBoundingClientRect(), cr = col.getBoundingClientRect(), right = cr.right - 4, w = Math.max(96, Math.min(230, right - 8));
    m.style.visibility = 'hidden'; m.style.width = w + 'px'; document.body.appendChild(m);
    var left = Math.max(8, right - m.offsetWidth);
    m.style.left = Math.round(left) + 'px'; m.style.top = Math.round(r.bottom + 9) + 'px';
    m.style.setProperty('--ax', Math.round(Math.max(10, Math.min(m.offsetWidth - 10, r.left + r.width / 2 - left))) + 'px');   /* 小箭头对准按钮 */
    m.style.visibility = ''; nudgeEl = m;
    nudgeT = setTimeout(nudgeHide, 3500);
  }
  /* 卡片栏挂上/收起/变窄 → 当前聊天视图跟着让位:与侧栏拖宽/收起共用 app-main 的 _scrmSyncViews(只动正在显示的视图) */
  function resized() { try { if (typeof window._scrmSyncViews === 'function') window._scrmSyncViews(); else window.dispatchEvent(new Event('resize')); } catch (e) {} }

  /* ---------- 空状态:由 render 派生,没有别的写入口 ----------
     卡片模式下主区只有两种样子:聊天区显示着(ChatView 不是 none)/ 空状态。表格永远不显示(双击平台走表格模式时卡片栏已退出)。
     空状态 = 聊天区没显示 && 没有打开流程在跑;文案按 st.env(给谁配环境)。右侧工具栏在"空状态且不在配环境"时藏起(配环境时由 bindRightToolbar 显示并绑定)。
     任何路径(卡片、新建会话弹窗自动打开、联系人面板刷新窗口、指纹应用重启、各平台回列表…)改了聊天区的显示,ChatView 的 style 观察器当帧触发 render,空状态当帧跟上。 */
  function syncEmpty(p) {
    var I = ids(p), cv = chatShown(p), busy = anyLoading(p), env = (st.env && st.env.p === p) ? cardOf(p, st.env.sid) : null;
    var lv = document.getElementById(I.list); if (lv && lv.style.display !== 'none') lv.style.display = 'none';
    var show = !cv && !busy && !(st.flipping && st.last[p]);   // 翻页中且翻完会打开会话:不先闪一下空状态;没有会话可开的翻页直接显示空状态
    if (show) {
      emptyEl.querySelector('.sse-t').textContent = env ? '正在配置「' + (env.remark || env.name) + '」的网络环境' : '还没有打开的会话';
      emptyEl.querySelector('.sse-s').textContent = env ? '在右侧改好代理并保存,再点卡片上的「打开窗口」登录' : '点左边的会话卡片打开';
      if (!env) { var rt = document.getElementById(I.rt); if (rt && rt.style.display !== 'none') rt.style.display = 'none'; }
    }
    if (emptyEl.style.display !== (show ? 'flex' : 'none')) emptyEl.style.display = show ? 'flex' : 'none';
  }
  /* 各平台「回会话列表」的唯一出口(showWaListView/showTgListView/showGenericListView)都会调它:卡片模式下没有表格,重画即显示空状态 */
  function listShown(p) { if (st.on && st.p === p) render(true); }
  var _chatObs = null;
  function watchChat(p) {   // 聊天区/表格的显示状态一变(各平台回列表、loadXxxSessions 重绘表格、别的入口打开聊天)当帧重画,不等 1s tick
    if (_chatObs) { _chatObs.disconnect(); _chatObs = null; }
    if (!window.MutationObserver) return;
    var I = ids(p), cv = document.getElementById(I.chat), lv = document.getElementById(I.list);
    if (!cv && !lv) return;
    _chatObs = new MutationObserver(function () { render(true); });
    if (cv) _chatObs.observe(cv, { attributes: true, attributeFilter: ['style'] });
    if (lv) _chatObs.observe(lv, { attributes: true, attributeFilter: ['style'] });
  }

  /* ---------- 渲染 ---------- */
  function render(force) {
    if (nudgeEl && (!st.on || !col || !col.closest('.panel.active'))) nudgeHide();   /* [MINI-NUDGE] 切去首页等别的面板:提示不留在别的页面上 */
    if (!st.on || !col || col.style.display === 'none' || st.editing || !col.closest('.panel.active')) return;   // 切去首页/别的平台后不再算(卡片栏所在面板不在前台)
    var p = st.p, list = sorted(p, model(p)), act = activeSid(p), q = st.q;
    var shown = q ? list.filter(function (c) { return (c.name + ' ' + c.sub + ' ' + c.remark + ' ' + c.region).toLowerCase().indexOf(q) >= 0; }) : list;
    if (st.env && (st.env.p !== p || chatShown(p))) st.env = null;   // 别的路径打开了聊天(或切了平台)→ 环境配置态结束
    syncEmpty(p);
    /* 高亮只有一条规则:最近一次点开/重启的那张(st.loading 时间戳最大)> 真实激活号 > 配环境的那张 */
    var envSid = st.env ? st.env.sid : '', hl = null, hlT = -1;
    shown.forEach(function (c) { var l = loadingOf(p, c.sid); if (l && l.t > hlT) { hlT = l.t; hl = c.sid; } });
    if (!hl) hl = act || envSid;
    var sig = JSON.stringify([p, act, q, envSid, hl, shown.map(function (c) { var l = loadingOf(p, c.sid); return [c.sid, c.name, c.sub, avSig(c.av), c.online, c.open, c.unread, c.remark, c.region, c.pinned, !!(l && l.spin)]; })]);
    if (!force && sig === st.sig) return; st.sig = sig;
    document.getElementById('sscTitle').textContent = platName(p);
    document.getElementById('sscCnt').textContent = list.length ? (list.filter(function (c) { return c.online; }).length + ' / ' + list.length + ' 在线') : '';
    var L = document.getElementById('sscList');
    if (!shown.length) { L.innerHTML = '<div class="ssc-none">' + (q ? '没有匹配的会话' : '还没有会话,点上面「新建会话」') + '</div>'; return pinState(p, act); }
    /* [SWITCH-SMOOTH] 按会话复用卡片节点(对齐 CEO 的 Vue 按 key 更新):内容没变的卡片原样保留,不重建头像图片(重建会闪);
       高亮只切类名;顺序变了才移动节点 */
    var keep = {};
    shown.forEach(function (c, i) {
      var h = cardHtml(p, c), el = L.querySelector('.ssc-card[data-sid="' + cssq(c.sid) + '"]');
      if (!el || el.__h !== h) {
        var t = document.createElement('div'); t.innerHTML = h; var nel = t.firstChild; nel.__h = h;
        if (el) L.replaceChild(nel, el); el = nel;
      }
      el.classList.toggle('active', c.sid === hl);
      el.classList.toggle('ssc-loading', !!(loadingOf(p, c.sid) || {}).spin);
      el.classList.toggle('ssc-env', c.sid === envSid);
      if (L.children[i] !== el) L.insertBefore(el, L.children[i] || null);
      keep[c.sid] = 1;
    });
    Array.prototype.slice.call(L.children).forEach(function (el) { if (!el.classList.contains('ssc-card') || !keep[el.getAttribute('data-sid')]) L.removeChild(el); });
    pinState(p, act);
  }
  function avSig(v) { v = String(v || ''); return v.length > 200 ? v.length + ':' + v.slice(-48) : v; }   // 头像可能是很长的 data URI,签名只取长度+结尾
  function cssq(v) { return (window.CSS && CSS.escape) ? CSS.escape(String(v)) : String(v).replace(/["\\]/g, '\\$&'); }
  function pinState(p, act) {
    var pinBtn = document.getElementById('sscPin'), pins = pinsOf(p);
    pinBtn.textContent = act && pins[0] === act ? '取消置顶' : '会话 置于顶部';
    pinBtn.disabled = !act;
  }
  /* 一张卡片的内容(不含高亮,高亮由 render 切类名) */
  function cardHtml(p, c) {
      var live = !!(c.open || c.online);   // 已打开或在线:没有三按钮,右上角有重启/关闭
      var av = typeof _scrmAvatarHtml === 'function' ? _scrmAvatarHtml(c.av, 40, (c.name || '?').charAt(0).toUpperCase(), c.bg, keysOf(p).rmKey, c.sid) : '';
      return '<div class="ssc-card' + (live ? '' : ' ssc-off') + '" data-sid="' + esc(c.sid) + '">' +
        '<span class="ssc-tag ' + (c.online ? 'on' : 'off') + '">' + (c.online ? '在线' : '离线') + '</span>' +
        /* 右上角:未读数 + 置顶图钉(同一个角落容器,不会互相盖住) */
        /* 右上角从左到右:重启/关闭(只有已打开/在线的账号,[SESS-CORNER] 对齐 CEO)、图钉、未读数(未读数靠最右) */
        ((c.unread > 0 || c.pinned || live) ? '<span class="ssc-corner">' +
          (live ? '<button class="ssc-cbtn" data-act="restart" data-tip="重启会话"><i class="fas fa-sync-alt"></i></button><button class="ssc-cbtn" data-act="close" data-tip="关闭会话"><i class="fas fa-times"></i></button>' : '') +
          (c.pinned ? '<span class="ssc-pinned" title="已置顶"><i class="fas fa-thumbtack"></i></span>' : '') +
          (c.unread > 0 ? '<span class="ssc-unread" title="未读消息">' + (c.unread > 99 ? '99+' : c.unread) + '</span>' : '') + '</span>' : '') +
        '<div class="ssc-row"><span class="ssc-av">' + av + '<i class="ssc-dot ' + (c.online ? 'on' : 'off') + '"></i></span><div class="ssc-who"><div class="ssc-name">' + esc(c.name) + '</div><div class="ssc-sub">' + esc(c.sub || '--') + '</div></div></div>' +
        /* 三个按钮只给离线(没打开)的账号(对齐 CEO):在线/已打开的账号不显示 */
        (live ? '' : '<div class="ssc-acts"><button class="ssc-act" data-act="open" data-tip="打开窗口"><i class="far fa-folder-open"></i></button><button class="ssc-act" data-act="proxy" data-tip="代理设置"><i class="fas fa-sliders-h"></i></button><button class="ssc-act del" data-act="del" data-tip="删除窗口"><i class="far fa-trash-alt"></i></button></div>') +
        '<div class="ssc-line ssc-rm" title="点击修改备注"><i class="far fa-edit"></i><span>' + (c.remark ? esc(c.remark) : '<em>备注</em>') + '</span></div>' +
        '<div class="ssc-line" title="' + esc(c.region) + '"><i class="fas fa-sliders-h"></i><span>' + esc(c.region || '本机网络') + '</span></div>' +
      '</div>';
  }

  /* ---------- 动作 ---------- */
  function cardOf(p, sid) { var l = model(p); for (var i = 0; i < l.length; i++) if (l[i].sid === sid) return l[i]; return null; }
  /* 打开(未启动的会启动)= 侧栏账号小列表点击同一套流程 */
  function openSession(p, sid) {
    if (!p || !sid) return;
    st.env = null; st.last[p] = sid; mount(p);
    var key = keysOf(p).panelKey;
    try { if (_isSessionShown(key, sid)) { if (typeof bindRightToolbar === 'function') bindRightToolbar(key, sid); render(true); return; } } catch (e) {}   // 已经在屏上:只把右侧工具栏绑回它(「代理设置」可能把工具栏绑去了别的会话)
    var sub = document.querySelector('.plat-sub-item[data-subkey="' + key + '_' + String(sid).replace(/"/g, '') + '"]'); if (sub && typeof _setActiveSubItem === 'function') _setActiveSubItem(sub);
    var c = cardOf(p, sid) || {};
    var pn = document.getElementById(ids(p).panel);
    if (!pn || !pn.classList.contains('active')) {   // 面板不在前台才切面板(翻页进入时 enter 已经切过,不再切第二次:切面板 = 全平台 hide IPC + 重绘表格)
      if (fam(p) === 'wa') window.__switchingToWaChat = true;
      if (fam(p) === 'tg') window.__switchingToTgChat = true;
      switchPanel(key);
      mount(p);
    }
    var lv = document.getElementById(ids(p).list); if (lv) lv.style.display = 'none';   // 卡片模式没有表格
    setLoading(p, sid, !c.open); render(true);   // 点下当场高亮(CEO:先改 activeId 再换视图);没打开过的还转圈,直到打开流程结束
    var opening = fam(p) === 'wa' ? openWaChat(sid, c.name || '', c.wid || '') : (fam(p) === 'tg' ? openTgChat(sid, c.name || '', c.remark || '') : openGenericChat(p, sid));
    /* 打开流程结束(成功/失败都算)→ finishOpen:聊天区没显示(端口已满、被拒等)时 render 派生出空状态,不留空白 */
    Promise.resolve(opening).catch(function () {}).then(function () { finishOpen(p, sid); });
  }
  function chatShown(p) { var cv = document.getElementById(ids(p).chat); return !!(cv && cv.style.display !== 'none'); }
  /* [SESS-ACTS] 卡片上的按钮全部复用各平台已有流程,不另写:open = 打开窗口(与点卡片同一流程);proxy = 环境配置(见 showEnvPanel);
     del/close = 各平台自己的删除/关闭流程;restart = 面板 restartSession(只对屏上的会话) */
  /* 调各平台自己的删除/关闭函数(WA/TG 只收 sid,通用平台收 (platform, sid)) */
  function platCall(p, waFn, tgFn, genFn, sid) { var f = fam(p) === 'wa' ? window[waFn] : (fam(p) === 'tg' ? window[tgFn] : window[genFn]); if (typeof f !== 'function') return null; return fam(p) === 'gen' ? f(p, sid) : f(sid); }
  function cardAction(act, sid) {
    var p = st.p; if (!p || !sid) return;
    if (act === 'open') { openSession(p, sid); return; }
    if (act === 'proxy') { showEnvPanel(p, sid); return; }
    if (act === 'close') {   // 各平台自己的关闭流程(带确认;正在显示的会话关掉后回列表出口 → 空状态)
      var cf = platCall(p, 'closeWaSession', 'closeTgSession', 'closeGenericSession', sid);
      Promise.resolve(cf).catch(function () {}).then(function () { setTimeout(function () { render(true); }, 80); });
      return;
    }
    if (act === 'restart') {   // 重启只对屏幕上的会话:在屏上 → 面板 restartSession(关视图→按存的代理重开,它自己守门);不在屏上 → 先切过去显示(不叠加第二条 open 流程)
      var pk = keysOf(p).panelKey;
      if (typeof restartSession !== 'function') return;
      var shownNow = false; try { shownNow = _isSessionShown(pk, sid); } catch (e) {}
      if (!shownNow) { openSession(p, sid); return; }
      setLoading(p, sid, true); render(true);
      Promise.resolve().then(function () { return restartSession(pk, sid); }).catch(function (e) { try { (window.scrmAlert || alert)('重启失败: ' + (e && e.message || e)); } catch (_) {}   /* [UI-MSG] 面板的统一提示;单独被别的页面引用时退回系统 alert */ }).then(function () { finishOpen(p, sid); });
      return;
    }
    if (act === 'del') {   // 各平台自己的删除流程(带确认框、释放端口、同步服务器);用户取消时什么都不变——配环境态只在"会话真没了"才结束
      var f = platCall(p, 'deleteWaSession', 'deleteTgSession', 'deleteGenericSession', sid);
      Promise.resolve(f).catch(function () {}).then(function () { setTimeout(function () { if (!st.on || st.p !== p) return; if (st.env && !cardOf(p, st.env.sid)) st.env = null; render(true); }, 80); });
    }
  }
  /* 「代理设置」(对齐 CEO 环境配置):不打开会话;屏幕上正显示的会话走该平台自己的「回列表」(隐藏聊天与视图、清激活号,卡片模式下 listShown 改成空状态),
     空状态文案说明在给谁配环境;右侧工具栏绑到这张卡片的会话并弹出网络/代理面板;卡片高亮+虚线。改好代理保存后点「打开窗口」,打开流程按存档代理启动。 */
  function showEnvPanel(p, sid) {
    if (typeof bindRightToolbar !== 'function') return;
    var pk = keysOf(p).panelKey;
    st.env = { p: p, sid: sid };
    var back = chatShown(p) ? platCall(p, 'showWaListView', 'showTgListView', 'showGenericListView', null) : null;
    Promise.resolve(back).catch(function () {}).then(function () {
      if (!st.on || st.p !== p || !st.env || st.env.sid !== sid) return;   // 期间用户点了别的
      var rt = bindRightToolbar(pk, sid); if (!rt) return;   // [RT-BIND] 面板唯一绑定入口(含按该会话载入代理面板);回列表流程把工具栏藏了,这里再显示并绑定
      var ic = rt.querySelector('.wa-rt-icon[data-panel$="wifi"]');
      if (ic && !(rt.__rtExpanded && rt.__rtActivePanel === ic.getAttribute('data-panel'))) ic.click();   // 已经开着代理面板就不再点(再点=收起)
      render(true);
    });
  }
  function editRemark(el) {
    var card = el.closest('.ssc-card'); if (!card) return; var sid = card.getAttribute('data-sid'), c = cardOf(st.p, sid); if (!c) return;
    if (st.editing) return;
    st.editing = true;
    el.innerHTML = '<i class="far fa-edit"></i><input class="ssc-rm-in" maxlength="255">';   // 与服务器备注上限一致
    var inp = el.querySelector('input'); inp.value = c.remark || ''; inp.focus(); inp.select();
    var done = false;
    var finish = function (save) {
      if (done) return; done = true; st.editing = false; card.__h = '';   // 编辑时改过卡片内容,让下次渲染重建这张
      var v = inp.value.trim();
      if (save && v !== (c.remark || '') && typeof scrmSetRemark === 'function') scrmSetRemark(keysOf(st.p).rmKey, sid, v);
      setTimeout(function () { render(true); }, 30);
    };
    inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') finish(true); else if (e.key === 'Escape') finish(false); });
    inp.addEventListener('blur', function () { finish(true); });
  }
  function pinToTop(sid) {   // 把 sid 置到最顶;已经在最顶就取消置顶(底部「置于顶部」按钮和右键菜单同一个动作)
    var p = st.p; if (!p || !sid) return;
    var pins = pinsOf(p).filter(function (x) { return x !== sid; });
    if (pinsOf(p)[0] !== sid) pins.unshift(sid);
    setPins(p, pins); render(true);
  }
  function unpin(sid) { var p = st.p; if (!p || !sid) return; setPins(p, pinsOf(p).filter(function (x) { return x !== sid; })); render(true); }
  function togglePin() { pinToTop(activeSid(st.p)); }

  /* ---------- [CARD-MENU] 2026-10-07 卡片右键菜单 ----------
     菜单项 = 这张卡片上本来就有的动作(cardAction / editRemark / 置顶),按状态给:已打开或在线 → 显示会话(不在屏上时才有)、重启、关闭;没打开 → 打开窗口、代理设置、删除窗口(与卡片上三个按钮同一条规则)。
     不新增任何动作的实现;关闭/删除照旧走各平台自己的流程(带确认)。
     位置夹在卡片栏矩形内:聊天区是原生视图,页面元素伸过去会被它挡住;卡片栏收起(只剩头像一列)时菜单用紧凑样式、宽度不超过卡片栏。
     关闭:点菜单外、Esc、滚动卡片栏、窗口失焦或缩放、卡片栏退出。 */
  var menuEl = null;
  function menuItems(p, c) {
    var live = !!(c.open || c.online), shown = false; try { shown = _isSessionShown(keysOf(p).panelKey, c.sid); } catch (e) {}
    var pins = pinsOf(p), top = pins[0] === c.sid, pinned = pins.indexOf(c.sid) >= 0, it = [];   // 是否置顶直接查置顶表(cardOf 给的卡片数据不带 pinned,那是排序时才加的)
    if (live) { if (!shown) it.push(['open', 'far fa-eye', '显示会话']); it.push(['restart', 'fas fa-sync-alt', '重启会话'], ['close', 'fas fa-times', '关闭会话']); }
    else it.push(['open', 'far fa-folder-open', '打开窗口'], ['proxy', 'fas fa-sliders-h', '代理设置']);
    it.push(null, ['remark', 'far fa-edit', '修改备注'], top ? ['unpin', 'fas fa-thumbtack', '取消置顶'] : ['pin', 'fas fa-thumbtack', pinned ? '移到最顶' : '置顶']);
    if (pinned && !top) it.push(['unpin', 'fas fa-thumbtack', '取消置顶']);
    if (!live) it.push(null, ['del', 'far fa-trash-alt', '删除窗口', 'danger']);
    return it;
  }
  function menuClose() { if (menuEl) { menuEl.remove(); menuEl = null; } }
  function menuOpen(sid, x, y) {
    menuClose(); nudgeHide(); var p = st.p, c = p && cardOf(p, sid); if (!c || st.editing) return;   /* [MINI-NUDGE] 提示会盖住菜单上面几项 */
    var m = document.createElement('div'); m.id = 'sscMenu'; var mini = col.classList.contains('mini'); if (mini) m.className = 'mini';
    m.innerHTML = menuItems(p, c).map(function (i) { return i ? '<button data-m="' + i[0] + '"' + (i[3] ? ' class="' + i[3] + '"' : '') + '><i class="' + i[1] + '"></i><span>' + esc(i[2]) + '</span></button>' : '<hr>'; }).join('');
    m.style.visibility = 'hidden'; document.body.appendChild(m);
    var r = col.getBoundingClientRect(), w = Math.min(m.offsetWidth, Math.max(60, r.width - 8)), h = m.offsetHeight;
    m.style.width = w + 'px';
    m.style.left = Math.round(Math.max(r.left + 4, Math.min(x, r.right - w - 4))) + 'px';
    m.style.top = Math.round(Math.max(r.top + 4, Math.min(y, Math.min(r.bottom, window.innerHeight) - h - 6))) + 'px';
    m.style.visibility = '';
    m.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-m]'); if (!b) return; var a = b.getAttribute('data-m'); menuClose();
      if (a === 'remark') { var cardEl = col.querySelector('.ssc-card[data-sid="' + cssq(sid) + '"]'), rm = cardEl && cardEl.querySelector('.ssc-rm'); if (rm) editRemark(rm); return; }
      if (a === 'pin') { pinToTop(sid); return; }
      if (a === 'unpin') { unpin(sid); return; }
      cardAction(a, sid);
    });
    m.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    menuEl = m;
  }
  document.addEventListener('mousedown', function (e) { if (menuEl && !menuEl.contains(e.target)) menuClose(); }, true);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && menuEl) menuClose(); });
  window.addEventListener('blur', menuClose); window.addEventListener('resize', function () { menuClose(); nudgeHide(); });
  document.addEventListener('scroll', function () { menuClose(); }, true);
  /* 新建会话:沿用各平台原来的新建弹窗;弹窗打开期间收起聊天视图(原生视图会挡住网页弹窗),关掉再放回 */
  function newSession() {   // 沿用各平台原来的新建弹窗;弹窗打开期间收起/关闭后放回聊天视图由弹窗自己成对处理
    var p = st.p, f = fam(p);
    if (f === 'wa') showWaCreateModal(); else if (f === 'tg') showTgCreateModal(); else showGenericCreateModal(p);
  }

  /* ---------- 进入 / 退出卡片模式 ---------- */
  /* [SSC-FLIP] 翻页:面板加动画类 → 动画结束(或 600ms 看门狗)去类,然后 done()。
     不再 hold 网页视图:切面板时 switchPanel 本来就把所有视图藏了;要显示的会话等翻完再起打开流程(见 enter),视图自然在翻完后出现。
     (10-04 曾在翻页期间 hold 视图:hold 中算出的位置是停屏外坐标,主进程把它当"静默预载"打上永久标记 → 之后 hide 不掉盖在别的平台上;
      改成"屏幕下方坐标"后又变成翻完先显示、open 回来再挪走、保活再拉回 = 闪两下。根子是翻页期间不该有打开流程在跑) */
  function flipIn(p, done) {
    var pn = document.getElementById(ids(p).panel);
    if (!pn || pn.classList.contains('ssc-flip')) { done(); return; }
    var rt = document.getElementById(ids(p).rt); if (rt) rt.style.visibility = 'hidden';
    var fin = false, end = function () { if (fin) return; fin = true; pn.classList.remove('ssc-flip'); pn.removeEventListener('animationend', onEnd); if (rt) rt.style.visibility = ''; done(); };
    var onEnd = function (e) { if (e.target === pn && e.animationName === 'sscFlipIn') end(); };
    pn.addEventListener('animationend', onEnd); pn.classList.add('ssc-flip'); setTimeout(end, 600);
  }
  /* [BATCH1-09] 页面缩放:作用于当前平台正在屏上的会话(activeSid);读写都走面板 scrmZoomGet/scrmZoomSet(唯一实现:TG webview 与主进程桥在那里分流,老客户端在那里提示升级) */
  function zoomTarget() { var p = st.p, sid = p ? activeSid(p) : ''; return sid ? { p: keysOf(p).panelKey, sid: sid } : null; }
  function zoomPop() { return document.getElementById('sscZoomPop'); }
  function zoomToggle() { var pop = zoomPop(); if (!pop) return; if (pop.style.display !== 'none') { pop.style.display = 'none'; return; }
    if (!zoomTarget()) { try { window._planToast && window._planToast('先打开一个会话窗口'); } catch (e) {} return; } pop.style.display = ''; zoomShow(); }
  function zoomShow() { var tg = zoomTarget(), v = document.getElementById('sscZoomV'); if (!tg || !v || typeof window.scrmZoomGet !== 'function') return;
    window.scrmZoomGet(tg.p, tg.sid).then(function (z) { v.textContent = z === null ? '需升级' : Math.round(z * 100) + '%'; }); }
  function zoomStep(d) { var tg = zoomTarget(); if (!tg || typeof window.scrmZoomSet !== 'function') return;
    window.scrmZoomGet(tg.p, tg.sid).then(function (z) { z = z || 1; var n = d === '1' ? 1 : (d === '+' ? z + 0.1 : z - 0.1); return window.scrmZoomSet(tg.p, tg.sid, n); }).then(zoomShow); }
  function enter(p) {
    if (!supports(p)) return false;
    nudgeHide();   /* [MINI-NUDGE] 换平台:卡片栏挪走了,旧提示一并收掉 */
    try { var _zp = zoomPop(); if (_zp) _zp.style.display = 'none'; } catch (e) {}
    var key = keysOf(p).panelKey;
    var flip = !st.on || st.p !== p;   // 换平台/从别处进来才翻;同平台重复进入不翻
    st.on = true; st.p = p; st.sig = ''; st.env = null;
    var opened = model(p).filter(function (c) { return c.open; }).map(function (c) { return c.sid; });
    var target = (st.last[p] && opened.indexOf(st.last[p]) >= 0) ? st.last[p] : (opened.indexOf(activeSid(p)) >= 0 ? activeSid(p) : opened[0]);
    if (!mount(p)) { st.on = false; return false; }
    if (target && !flip) openSession(p, target);   // 同平台重复进入:直接打开(流程自己切面板)
    else { window.__switchingToWaChat = false; window.__switchingToTgChat = false; switchPanel(key); mount(p); }   // 先把面板切出来(switchPanel 已把所有视图藏起),翻页期间不起打开流程
    if (flip && target) st.last[p] = target;   // "翻完该显示谁"的唯一来源是 st.last(翻页中用户点了别的卡,openSession 会改它)
    st.flipping = flip;
    render(true); resized();
    if (flip) flipIn(p, function () {
      st.flipping = false;
      var t = st.last[p], c = t ? cardOf(p, t) : null;   // 翻完按"此刻"重算:翻页中点过卡(已在打开中)就不补开;目标在翻页中被关掉/删掉就不开
      if (st.on && st.p === p && c && c.open && !anyLoading(p)) openSession(p, t); else render(true);
    });
    return true;
  }
  function exit() { if (!st.on) return; menuClose(); nudgeHide(); st.on = false; st.env = null; st.flipping = false; unmount(); }

  /* 标记有卡片栏的平台(plat-cards):左侧不再显示下拉箭头、不再展开账号小列表(setPlatExpanded 按这个标记拦),已展开的收起 */
  try {
    document.querySelectorAll('.plat-scroll .plat-icon').forEach(function (el) {
      if (typeof _platKeyOf !== 'function' || !supports(_platKeyOf(el))) return;
      el.classList.add('plat-cards');
      if (typeof setPlatExpanded === 'function') setPlatExpanded(el, false);
    });
  } catch (e) {}

  setInterval(function () { try { sweepLoading(); render(false); } catch (e) {} }, 1000);   // 状态/名字/头像/未读等由各平台自己的轮询更新,这里每秒比对一次签名,有变化才重画

  window.ScrmSessCards = { enter: enter, exit: exit, supports: supports, isOn: function (p) { return st.on && (!p || st.p === p); }, open: openSession, listShown: listShown, render: function () { render(true); }, _model: model, _w: COL_W, _wMini: COL_W_MINI, setMini: setMini, _nudge: function () { return nudgeEl ? nudgeEl.textContent : null; }, _menuItems: function (sid) { var c = st.p && cardOf(st.p, sid); return c ? menuItems(st.p, c).map(function (i) { return i ? i[0] + ':' + i[2] : '-'; }) : null; } };
})();
