/* [TZ-CN] 中国标准时间(UTC+8)统一显示 —— 全站唯一一份实现,各页面的 fmtDate/fmtDT/fmtDT2 都转调这里。

   背景:服务器系统时区 = UTC,MySQL 也是 UTC,所以库里 DATETIME 存的是 UTC 墙上时间,
   接口(mysql2 → JSON)吐出来的是带 Z 的 ISO 瞬时值,例如 2026-09-22T10:14:24.000Z。
   在此之前各页面有两种写法,都不是"中国标准时间":
     ① String(v).replace('T',' ').slice(0,19)  → 把 UTC 原样印出来,比北京时间慢 8 小时;
     ② new Date(v).toLocaleString('zh-CN')     → 跟着"看页面的人所在时区"走,人在海外就变成当地时间。
   现在一律折算成固定的 UTC+8:不管运营同事人在哪、电脑时区设成什么,看到的都跟国内一致,
   也跟页面上标注的「置零时间 (UTC+8)」口径对得上。

   约定:
   · 只折算"瞬时值"(带 Z / 带 ±时区 / 库里的 UTC 墙上时间)。
   · 纯日期 YYYY-MM-DD(会员到期日这类)不折算,原样返回 —— 它不是某个时刻,折算只会让日期跳一天。
   · 纯时间 HH:MM:SS(置零时间这类"每天几点")也不归这里管,调用方自己按原值显示。
   · ★别对已经格式化过的结果再调一次 —— 输出是不带时区的字符串,再传进来会被当成 UTC 又 +8。
   改这个文件请顺手跑:node /opt/scrm-api/test-time-cn.mjs                                   */
(function (g) {
  var OFFSET = 8 * 3600000; /* UTC+8,中国不实行夏令时,固定偏移 */
  function p2(n) { return (n < 10 ? '0' : '') + n; }

  /* 把各种形态的输入解析成"瞬时值"。返回 Date / {dateOnly:'YYYY-MM-DD'} / null */
  function parse(v) {
    if (v === null || v === undefined || v === '') return null;
    if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
    if (typeof v === 'number') { var dn = new Date(v); return isNaN(dn.getTime()) ? null : dn; }
    var s = String(v).trim();
    if (!s || s === '--' || s === 'null' || s === 'undefined' || s.indexOf('0000-00-00') === 0) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return { dateOnly: s };          /* 纯日期,不折算 */
    if (/(Z|z|[+-]\d{2}:?\d{2})$/.test(s)) {                            /* 已带时区,本身就是瞬时值 */
      var d1 = new Date(s); return isNaN(d1.getTime()) ? null : d1;
    }
    var m = s.replace('T', ' ').match(/^(\d{4})-(\d{1,2})-(\d{1,2})[ ](\d{1,2}):(\d{2})(?::(\d{2}))?/);
    if (m) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0))); /* 不带时区 = 库里的 UTC */
    var d2 = new Date(s); return isNaN(d2.getTime()) ? null : d2;
  }

  /* 折算到 UTC+8 后的各字段(用 getUTC* 读,避免再被浏览器本地时区影响一次) */
  function cnParts(v) {
    var d = parse(v);
    if (!d) return null;
    if (d.dateOnly) { var a = d.dateOnly.split('-'); return { y: +a[0], M: +a[1], d: +a[2], h: 0, m: 0, s: 0, dateOnly: true, date: d.dateOnly, time: '' }; }
    var t = new Date(d.getTime() + OFFSET);
    var o = { y: t.getUTCFullYear(), M: t.getUTCMonth() + 1, d: t.getUTCDate(), h: t.getUTCHours(), m: t.getUTCMinutes(), s: t.getUTCSeconds(), dateOnly: false };
    o.date = o.y + '-' + p2(o.M) + '-' + p2(o.d);
    o.time = p2(o.h) + ':' + p2(o.m) + ':' + p2(o.s);
    return o;
  }

  /* mode: 'datetime'(默认) | 'minute' | 'date' | 'time' | 'md' ;  empty: 空值时显示什么 */
  function fmtCN(v, mode, empty) {
    var o = cnParts(v);
    if (!o) return (empty === undefined ? '--' : empty);
    if (o.dateOnly) return o.date;                                       /* 纯日期原样 */
    switch (mode) {
      case 'date': return o.date;
      case 'minute': return o.date + ' ' + p2(o.h) + ':' + p2(o.m);
      case 'time': return o.time;
      case 'md': return p2(o.M) + '-' + p2(o.d) + ' ' + p2(o.h) + ':' + p2(o.m);
      default: return o.date + ' ' + o.time;
    }
  }

  function cnToday() { return fmtCN(new Date(), 'date'); }               /* 今天(北京) */

  /* 输入框里用户填的是北京时间,存库前换回 UTC(库里统一存 UTC)。
     传 '2026-10-23T13:47' 或 '2026-10-23 13:47[:ss]',返回 'YYYY-MM-DD HH:MM:SS';空值返回 null。*/
  function cnInputToUTC(v) {
    if (!v) return null;
    var m = String(v).trim().replace('T', ' ').match(/^(\d{4})-(\d{1,2})-(\d{1,2})[ ](\d{1,2}):(\d{2})(?::(\d{2}))?/);
    if (!m) return null;
    var t = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0)) - OFFSET);
    function p(n) { return (n < 10 ? '0' : '') + n; }
    return t.getUTCFullYear() + '-' + p(t.getUTCMonth() + 1) + '-' + p(t.getUTCDate()) + ' ' +
           p(t.getUTCHours()) + ':' + p(t.getUTCMinutes()) + ':' + p(t.getUTCSeconds());
  }

  g.fmtCN = fmtCN; g.cnParts = cnParts; g.cnToday = cnToday; g.cnInputToUTC = cnInputToUTC;
  if (typeof module !== 'undefined' && module.exports) module.exports = { fmtCN: fmtCN, cnParts: cnParts, cnToday: cnToday, cnInputToUTC: cnInputToUTC };
})(typeof window !== 'undefined' ? window : globalThis);
