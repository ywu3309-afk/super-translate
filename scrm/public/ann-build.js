/* [ANN-BUILD] 2026-10-04 公告滚动条「铺排」唯一实现:客户端 app-main.html 顶部公告条 与 超管后台 admin-panel.html「公告栏」预览 共用,预览看到的就是客户端。
   scrmAnn.msgsOf(a)        公告对象 → 条目数组(一行一条,去空行)
   scrmAnn.build(track, a, vpW)  把条目铺进滚动轨道:a = { content, link, direction(rtl|ltr|static), speed(slow|medium|fast), visible(auto|1-6) }
       · static:一份、用「　·　」连起来、不滚;返回 -1(不依赖宽度)
       · 滚动:每条一段(visible=N 时每段占视口 1/N 宽,否则各自宽度+80px 间距);基础段重复到 ≥ 视口宽,再复制一份首尾相接,轨道动画 translateX(-50%) 无缝循环;
         时长 = 一份的宽度 / 速度(px/秒),保证不同条数/宽度下视觉速度一样;返回铺排时的视口宽(调用方宽度变了再铺)
       · vpW 为 0(隐藏时量不到)清空轨道,返回 0,调用方显示出来后再调
   有链接整段可点(a 标签,target=_blank),没有就是 span;文字一律转义。 */
(function () {
  var SPEED = { slow: 40, medium: 70, fast: 110 };   // px/秒
  function esc(t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function msgsOf(a) { return (a && a.content) ? String(a.content).split('\n').map(function (m) { return m.trim(); }).filter(Boolean) : []; }
  function seg(a, html, st) { return a.link ? '<a href="' + esc(a.link) + '" target="_blank" rel="noopener" style="' + st + '">' + html + '</a>' : '<span style="' + st + '">' + html + '</span>'; }
  function build(track, a, vpW) {
    var msgs = msgsOf(a);
    if (!msgs.length) { track.innerHTML = ''; track.style.animationDuration = ''; return -1; }
    if (a.direction === 'static') { track.innerHTML = seg(a, msgs.map(esc).join('　·　'), ''); track.style.animationDuration = ''; return -1; }
    if (!vpW) { track.innerHTML = ''; track.style.animationDuration = ''; return 0; }   // 隐藏时量不到宽度:清掉旧内容(别把上一条公告留在 DOM 里),显示出来后调用方再铺
    var N = parseInt(a.visible, 10), slotW = (N >= 1 && N <= 6) ? Math.floor(vpW / N) : 0;
    var st = slotW ? 'display:inline-block;min-width:' + slotW + 'px;box-sizing:border-box;padding-right:24px;' : 'padding-right:80px;';
    var base = msgs.map(function (m) { return seg(a, esc(m), st); }).join('');
    track.innerHTML = base; var baseW = track.getBoundingClientRect().width || vpW; if (baseW < 10) baseW = vpW;
    var R = Math.max(1, Math.ceil(vpW / baseW)), unit = ''; for (var i = 0; i < R; i++) unit += base;
    track.innerHTML = unit + unit;
    track.style.animation = 'none'; void track.offsetWidth; track.style.animation = '';   // 换内容从头滚
    track.style.animationDuration = Math.max(8, Math.round(R * baseW / (SPEED[a.speed] || SPEED.medium))) + 's';
    return vpW;
  }
  window.scrmAnn = { msgsOf: msgsOf, build: build, SPEED: SPEED };
})();
