/* [CS-CONTACTS] 2026-09-29 SCRM 客服联系方式唯一来源(对齐出海猫 AdMingcat 的「联系客服」悬浮按钮)
 * · 后台外壳 app.html 右下角悬浮按钮:SCRM_CS.mountFloat()
 * · 关于产品页「联系我们」卡片:SCRM_CS.renderAbout(容器)
 * 改客服号只改下面 CONTACTS 这一处,两个地方自动一致。
 * 悬浮按钮可"收起"成贴右边缘的小标签,收起状态记在本机(localStorage scrm_cs_collapsed),下次打开后台保持。 */
(function (g) {
  var CONTACTS = [
    { key: 'telegram', title: 'Telegram', value: '@chm123_support', href: 'https://t.me/chm123_support', fa: 'fab fa-telegram', cls: 'ci-tg',
      svg: '<svg width="16" height="16" viewBox="0 0 24 24" fill="#38bdf8"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/></svg>' },
    { key: 'whatsapp', title: 'WhatsApp 客服', aboutTitle: 'WhatsApp', value: '+1(669)238-5717', href: 'https://wa.me/16692385717', fa: 'fab fa-whatsapp', cls: 'ci-wa',
      svg: '<svg width="16" height="16" viewBox="0 0 24 24" fill="#25d366"><path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.64.07-.3-.15-1.26-.46-2.39-1.47-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.61-.92-2.21-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.07c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.69.25-1.29.17-1.41-.07-.12-.27-.2-.57-.35zM12.04 21.5h-.01a9.45 9.45 0 01-4.82-1.32l-.35-.21-3.58.94.96-3.49-.23-.36a9.43 9.43 0 01-1.45-5.03c0-5.22 4.25-9.47 9.48-9.47 2.53 0 4.91.99 6.7 2.78a9.4 9.4 0 012.77 6.7c0 5.22-4.25 9.47-9.47 9.47zm8.06-17.53A11.33 11.33 0 0012.04.63C5.76.63.65 5.74.65 12.02c0 2.01.52 3.97 1.52 5.7L.55 23.63l6.05-1.59a11.35 11.35 0 005.44 1.39h.01c6.28 0 11.39-5.11 11.39-11.39 0-3.04-1.18-5.9-3.34-8.05z"/></svg>' },
    { key: 'email', title: '邮件咨询', aboutTitle: '邮箱', value: 'support@chm123.com', href: 'mailto:support@chm123.com', fa: 'fas fa-envelope', cls: 'ci-email',
      svg: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#818cf8" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 7l-10 7L2 7"/></svg>' }
  ];
  var esc = function (s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
  var target = function (c) { return c.href.indexOf('mailto:') === 0 ? '' : ' target="_blank" rel="noopener"'; };
  var CHAT = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>';

  var CSS = ''
    + '#scrm-cs{position:fixed;right:24px;bottom:24px;z-index:9000;font-family:inherit}'
    + '#scrm-cs .cs-pill{display:flex;height:48px;border-radius:14px;background:linear-gradient(135deg,#5934e6,#3264ef);box-shadow:0 4px 16px rgba(74,63,232,.38);overflow:hidden;transition:transform .2s}'
    + '#scrm-cs .cs-pill:hover{transform:scale(1.04)}'
    + '#scrm-cs .cs-open{display:flex;align-items:center;gap:8px;padding:0 14px 0 16px;border:none;background:transparent;cursor:pointer;color:#fff;font-size:13px;font-weight:600;font-family:inherit;white-space:nowrap}'
    + '#scrm-cs .cs-hide{display:flex;align-items:center;justify-content:center;width:30px;border:none;border-left:1px solid rgba(255,255,255,.22);background:transparent;cursor:pointer;padding:0}'
    + '#scrm-cs .cs-hide:hover{background:rgba(255,255,255,.12)}'
    + '#scrm-cs .cs-pop{display:none;position:absolute;right:0;bottom:60px;width:280px;background:#fff;border:1px solid #e5e9f2;border-radius:16px;padding:18px;box-shadow:0 12px 36px rgba(15,23,42,.18)}'
    + '#scrm-cs.open .cs-pop{display:block}'
    + '#scrm-cs .cs-h{font-size:15px;font-weight:700;color:#1e1b4b}#scrm-cs .cs-sub{font-size:12px;color:#7a779a;margin:3px 0 14px}'
    + '#scrm-cs .cs-item{display:flex;align-items:center;gap:12px;padding:10px 12px;margin-bottom:8px;border-radius:12px;background:#f7f9fc;border:1px solid #e5e9f2;text-decoration:none;transition:border-color .15s,background .15s}'
    + '#scrm-cs .cs-item:hover{border-color:#8b84ff;background:#f1f0fe}'
    + '#scrm-cs .cs-ic{width:34px;height:34px;border-radius:10px;background:rgba(99,102,241,.1);display:flex;align-items:center;justify-content:center;flex-shrink:0}'
    + '#scrm-cs .cs-t{display:block;font-size:13px;font-weight:600;color:#1e1b4b}#scrm-cs .cs-v{display:block;font-size:12px;color:#7a779a;margin-top:1px}'
    + '#scrm-cs .cs-fold{display:block;margin-top:6px;text-align:center;font-size:12px;color:#98a2b3;cursor:pointer;background:none;border:none;width:100%;font-family:inherit}'
    + '#scrm-cs .cs-fold:hover{color:#4a3fe8}'
    + '#scrm-cs-tab{display:none;position:fixed;right:0;bottom:30px;z-index:9000;width:30px;height:56px;border:none;border-radius:28px 0 0 28px;background:linear-gradient(135deg,#5934e6,#3264ef);cursor:pointer;align-items:center;justify-content:center;padding:0 0 0 4px;box-shadow:0 4px 16px rgba(74,63,232,.38);transition:width .2s}'
    + '#scrm-cs-tab:hover{width:38px}'
    + 'body.dark #scrm-cs .cs-pop{background:#1e1f2c;border-color:#30334a;box-shadow:0 12px 36px rgba(0,0,0,.5)}'
    + 'body.dark #scrm-cs .cs-h,body.dark #scrm-cs .cs-t{color:#ecedf5}body.dark #scrm-cs .cs-sub,body.dark #scrm-cs .cs-v{color:#8c8fa8}'
    + 'body.dark #scrm-cs .cs-item{background:#262838;border-color:#30334a}body.dark #scrm-cs .cs-item:hover{background:#2c2e44;border-color:#8b84ff}'
    + '@media (max-width:640px){#scrm-cs{right:12px;bottom:12px}#scrm-cs .cs-pop{width:calc(100vw - 24px)}}';

  /* 外壳右下角悬浮按钮 */
  function mountFloat() {
    if (document.getElementById('scrm-cs')) return;
    var st = document.createElement('style'); st.id = 'scrm-cs-style'; st.textContent = CSS; document.head.appendChild(st);
    var box = document.createElement('div'); box.id = 'scrm-cs';
    box.innerHTML = '<div class="cs-pop" role="dialog" aria-label="联系客服"><div class="cs-h">联系客服</div><div class="cs-sub">有问题随时联系我们</div>'
      + CONTACTS.map(function (c) { return '<a class="cs-item" href="' + esc(c.href) + '"' + target(c) + '><span class="cs-ic">' + c.svg + '</span><span><span class="cs-t">' + esc(c.title) + '</span><span class="cs-v">' + esc(c.value) + '</span></span></a>'; }).join('')
      + '<button class="cs-fold" type="button">收起悬浮按钮</button></div>'
      + '<div class="cs-pill"><button class="cs-open" type="button">' + CHAT + '<span>联系客服</span></button>'
      + '<button class="cs-hide" type="button" title="收起" aria-label="收起客服按钮"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.85)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg></button></div>';
    var tab = document.createElement('button'); tab.id = 'scrm-cs-tab'; tab.type = 'button'; tab.title = '联系客服'; tab.setAttribute('aria-label', '展开联系客服');
    tab.innerHTML = CHAT.replace('width="20" height="20"', 'width="17" height="17"');
    document.body.appendChild(box); document.body.appendChild(tab);
    function collapse(on) {
      box.classList.remove('open');
      box.style.display = on ? 'none' : ''; tab.style.display = on ? 'flex' : 'none';
      try { localStorage.setItem('scrm_cs_collapsed', on ? '1' : '0'); } catch (e) {}
    }
    box.querySelector('.cs-open').onclick = function (e) { e.stopPropagation(); box.classList.toggle('open'); };
    box.querySelector('.cs-hide').onclick = function () { collapse(true); };
    box.querySelector('.cs-fold').onclick = function () { collapse(true); };
    tab.onclick = function () { collapse(false); };
    // 点面板外面关闭:点外壳自己(侧栏/顶栏)走 click;点进内容区 iframe 时外壳收不到 click,但外壳窗口会失去焦点 → 走 blur;另外 Esc 也关
    var close = function () { box.classList.remove('open'); };
    document.addEventListener('click', function (e) { if (!box.contains(e.target)) close(); });
    window.addEventListener('blur', close);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
    try { if (localStorage.getItem('scrm_cs_collapsed') === '1') collapse(true); } catch (e) {}
  }

  /* 关于产品页「联系我们」:在容器最前面按原卡片样式渲染这几项(容器里原有的其它项,如官方网站,保留在后面) */
  function renderAbout(list) {
    if (!list) return;
    list.insertAdjacentHTML('afterbegin', CONTACTS.map(function (c) {
      return '<div class="contact-item"><div class="contact-icon ' + c.cls + '"><i class="' + c.fa + '"></i></div><div class="contact-info"><h4>' + esc(c.aboutTitle || c.title) + '</h4>'
        + '<p><a href="' + esc(c.href) + '"' + target(c) + ' style="color:var(--accent,#4a3fe8);text-decoration:none">' + esc(c.value) + '</a></p></div></div>';
    }).join(''));
  }

  g.SCRM_CS = { CONTACTS: CONTACTS, mountFloat: mountFloat, renderAbout: renderAbout };
})(window);
