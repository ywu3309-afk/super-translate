'use strict';
/* [PROXY-LOCAL] 代理「测试连接」:从这台电脑自己去连,测的就是账号网页实际走的那条路。
   v2(2026-10-07 重做,独立审查后):
   · 代理怎么走只看 scrm-proxy.js 的 resolve()(和给账号网页设置代理用的是同一个结果),这里不再有第二份解析
   · **判定依据 = 经代理能不能连到这个平台的 443**(账号网页全是 https,走的就是这一步);目标主机由调用方给(main.js 按平台自己的网址取)
   · 出口 IP / 地区只是附带信息:在另一条 443 通道上问一个 https 服务,问不到就留空,**不影响"通/不通"的结论**
     (v1 先连第三方 ip-api.com 的 80 端口并把它当门槛:只放行 443 的代理、被限流、被屏蔽时会把能用的代理报成"出口不通")
   · 错误原因在出错的地方直接定性,不从英文报错里用正则猜:
     连代理这一步(TCP)自己建连接 → 拿到的是系统错误码;SOCKS 握手交给 socks 库(把已连好的连接交给它)→ 用它导出的错误常量逐条比对;
     HTTP 代理的 CONNECT 自己发 → 直接看状态码
   test(proxy, { targetHost }) → Promise,永不 reject:
     { ok:true,  ms, target, ip, country, countryCode, city }      经代理连得上目标(target = 测的主机);ip 可能是 ''(没问到)
     { ok:false, stage, code, msg, ip?, country?, … }
        stage: parse   没填全 / 写法不支持(msg 取 resolve 的 reason)
               proxy   这台电脑连不上代理(拒绝 / 超时 / 域名解析失败 / 网络不可达 / 被中断)
               proto   连上了但对方不是这种类型的代理(类型选错)
               auth    账号或密码不对;authreq = 这个代理要账号(或要白名单)而没填
               denied  代理拒绝服务(HTTP 403:多为来源 IP 不在白名单,或不允许访问这个网站);quota = 流量用完 / 超并发(402 / 429)
               target  代理本身正常,但经它连不上这个平台,或迟迟接不通(此时仍会去问出口 IP,一并返回)
   msg 是写给客户看的话。回归:tests/batch1/test-proxy-test.mjs(本机假代理,不出网) */
const scrmProxy = require('./scrm-proxy.js');

const TIMEOUT_MS = 10000, IP_TIMEOUT_MS = 6000, IP_HOST = 'ipwho.is';
const MSG = {
  refused: '这台电脑连不上代理:对方拒绝连接(端口没开,或地址/端口填错)',
  timeout: '这台电脑连不上代理:连接超时。常见原因:本地网络访问不了这个代理地址(例如国内网络直连境外 IP),或代理商只允许白名单 IP 连接',
  dns: '这台电脑连不上代理:代理域名解析失败,请检查地址',
  unreachable: '这台电脑连不上代理:网络不可达,请检查本机网络',
  reset: '这台电脑连不上代理:连接被中断(可能被本地网络/防火墙拦截、代理商限制了来源 IP,或代理类型选错)',
  proto: '已连上这个地址,但对方不是这种类型的代理:请检查代理类型(SOCKS5 / HTTP)是否选对',
  auth: '代理的用户名或密码不对(或账号已过期)',
  authreq: '这个代理需要账号密码(或需要把本机 IP 加入代理商的白名单)',
  denied: '代理拒绝了连接(多为本机 IP 不在代理商的白名单里,或该代理不允许访问这个网站)',
  quota: '代理商返回"流量用完或连接数超限",请联系代理商',
  target: '代理本身可用,但通过它连不上本平台:这条线路访问不了这个网站,请换一个代理或联系代理商',
  slow: '已连上代理,但它迟迟没有接通本平台(代理线路太慢或访问不了这个网站),请换一个代理或联系代理商',
};
const fail = (stage, code, key, extra) => Object.assign({ ok: false, stage, code, msg: MSG[key] }, extra || {});
/* 系统错误码 → 结果(连代理的 TCP 这一步) */
const SYS = { ECONNREFUSED: 'refused', ETIMEDOUT: 'timeout', ENOTFOUND: 'dns', EAI_AGAIN: 'dns', ENETUNREACH: 'unreachable', EHOSTUNREACH: 'unreachable', EADDRNOTAVAIL: 'unreachable', ECONNRESET: 'reset', EPIPE: 'reset' };
const sysFail = (code) => fail('proxy', code || 'ECONN', SYS[code] || 'reset');

function create(deps) {
  const d = deps || {}, net = d.net || require('net'), tls = d.tls || require('tls'), socks = d.socks || require('socks'), log = d.log || (() => {});
  const timeoutMs = d.timeoutMs || TIMEOUT_MS, ipTimeoutMs = d.ipTimeoutMs || IP_TIMEOUT_MS, ipHost = d.ipHost || IP_HOST, tlsOpts = d.tlsOptions || {};
  const SE = require('socks/build/common/constants').ERRORS;
  /* socks 库握手阶段的报错 → 结果(按它导出的常量逐条比对;被拒类常量后面带原因,所以用"以它开头") */
  function socksFail(e, answered) {
    const m = String((e && e.message) || ''), is = (k) => !!SE[k] && m.indexOf(SE[k]) === 0;
    if (is('Socks5AuthenticationFailed')) return fail('auth', 'AUTH', 'auth');
    if (is('InvalidSocks5InitialHandshakeNoAcceptedAuthType') || is('InvalidSocks5InitialHandshakeUnknownAuthType')) return fail('authreq', 'AUTHREQ', 'authreq');
    if (is('InvalidSocks5FinalHandshakeRejected') || is('Socks4ProxyRejectedConnection')) return fail('target', 'REJECTED', 'target');   /* 握手都过了,代理说连不到目标 */
    if (is('ProxyConnectionTimedOut')) return answered ? fail('target', 'SLOW', 'slow') : fail('proxy', 'ETIMEDOUT', 'timeout');   /* 对方应答过握手、之后没了下文 = 代理迟迟接不通目标;连上后一个字节都没回 = 这个端口不像在提供代理服务(或来源 IP 被静默丢弃),按连不上代理 */
    if (is('SocketClosed')) return fail('proxy', 'ECONNRESET', 'reset');
    return fail('proto', 'PROTO', 'proto');   /* 其余都是"应答不合 SOCKS 协议" */
  }
  /* 第 1 步:TCP 连到代理(https 代理再做 TLS)→ socket;失败 reject 结果对象 */
  function connect(r) {
    return new Promise((resolve, reject) => {
      const sock = r.protocol === 'https' ? tls.connect(Object.assign({ host: r.host, port: r.port, servername: r.host }, tlsOpts)) : net.connect({ host: r.host, port: r.port });
      let done = false; const fin = (err) => { if (done) return; done = true; clearTimeout(tm); sock.removeListener('error', onErr); if (err) { sock.destroy(); reject(err); } else resolve(sock); };
      const onErr = (e) => fin(sysFail(e && e.code)), tm = setTimeout(() => fin(sysFail('ETIMEDOUT')), timeoutMs);
      sock.once('error', onErr); sock.once(r.protocol === 'https' ? 'secureConnect' : 'connect', () => fin(null));
    });
  }
  /* 第 2 步:在已连好的连接上让代理接通 host:port → 同一个 socket;失败 reject 结果对象 */
  function open(r, sock, host, port) {
    if (r.protocol === 'socks5' || r.protocol === 'socks4') {
      let sysCode = '', answered = false; const onSys = (e) => { sysCode = (e && e.code) || 'ECONNRESET'; }, onAny = () => { answered = true; }; sock.once('error', onSys); sock.once('data', onAny);   /* 握手中途连接出错:记下系统错误码(socks 库只转述文字) */
      return socks.SocksClient.createConnection({ existing_socket: sock, timeout: timeoutMs, command: 'connect', destination: { host, port },
        proxy: { host: r.host, port: r.port, type: r.protocol === 'socks4' ? 4 : 5, userId: r.username || undefined, password: r.password || undefined } })
        .then((x) => { sock.removeListener('error', onSys); sock.removeListener('data', onAny); return x.socket; }, (e) => { try { sock.destroy(); } catch (_) {} throw sysCode ? sysFail(sysCode) : socksFail(e, answered); });
    }
    return new Promise((resolve, reject) => {   /* http / https 代理:CONNECT */
      let buf = '', done = false; const fin = (err) => { if (done) return; done = true; clearTimeout(tm); sock.removeListener('data', onData); sock.removeListener('error', onErr); sock.removeListener('close', onClose); if (err) { sock.destroy(); reject(err); } else resolve(sock); };
      const onErr = (e) => fin(sysFail(e && e.code)), onClose = () => fin(sysFail('ECONNRESET')), tm = setTimeout(() => fin(fail('target', 'SLOW', 'slow')), timeoutMs);   /* 同上:已连上代理,超时 = 代理没接通目标 */
      const onData = (c) => { buf += c.toString('latin1'); if (buf.length > 16384 || 'HTTP/'.indexOf(buf.slice(0, 5)) !== 0) return fin(fail('proto', 'PROTO', 'proto'));   /* 回来的不是 HTTP 应答(比如对方其实是 SOCKS 代理):立刻判类型不对,不等超时 */
        if (buf.indexOf('\r\n\r\n') < 0) return;
        const st = Number((buf.match(/^HTTP\/1\.\d (\d{3})/) || [])[1]) || 0;
        if (st >= 200 && st < 300) return fin(null);
        if (st === 407) return fin(r.username ? fail('auth', 'HTTP407', 'auth') : fail('authreq', 'HTTP407', 'authreq'));
        if (st === 403) return fin(fail('denied', 'HTTP403', 'denied'));
        if (st === 402 || st === 429) return fin(fail('quota', 'HTTP' + st, 'quota'));
        if (st >= 500) return fin(fail('target', 'HTTP' + st, 'target'));
        fin(st ? fail('denied', 'HTTP' + st, 'denied') : fail('proto', 'PROTO', 'proto')); };
      sock.on('data', onData); sock.once('error', onErr); sock.once('close', onClose);
      sock.write('CONNECT ' + host + ':' + port + ' HTTP/1.1\r\nHost: ' + host + ':' + port + '\r\n' + (r.username ? 'Proxy-Authorization: Basic ' + Buffer.from(r.username + ':' + (r.password || '')).toString('base64') + '\r\n' : '') + '\r\n');
    });
  }
  const tunnel = (r, host, port) => connect(r).then((sock) => open(r, sock, host, port));
  /* 附带信息:经代理在 443 上问出口 IP。任何失败都只是"没问到"(resolve 空对象) */
  function exitInfo(r) {
    return tunnel(r, ipHost, 443).then((raw) => new Promise((resolve) => {
      const s = tls.connect(Object.assign({ socket: raw, servername: ipHost }, tlsOpts)); let buf = Buffer.alloc(0), done = false;
      const fin = (v) => { if (done) return; done = true; clearTimeout(tm); try { s.destroy(); } catch (e) {} try { raw.destroy(); } catch (e) {} resolve(v || {}); };
      /* 响应正文:按字节处理(分块传输要先把各块拼起来;对方不关连接也行 —— 每收到一段就试一次,拼得出完整 JSON 就结束) */
      const bodyOf = () => { const i = buf.indexOf('\r\n\r\n'); if (i < 0) return null; let body = buf.slice(i + 4);
        if (/transfer-encoding:\s*chunked/i.test(buf.slice(0, i).toString('latin1'))) { const parts = []; let p = 0;
          for (;;) { const nl = body.indexOf('\r\n', p); if (nl < 0) break; const n = parseInt(body.slice(p, nl).toString('latin1'), 16); if (!(n > 0)) break; parts.push(body.slice(nl + 2, nl + 2 + n)); p = nl + 2 + n + 2; }
          body = Buffer.concat(parts); }
        return body.toString('utf8'); };
      const tryParse = () => { const body = bodyOf(); if (!body) return; const a = body.indexOf('{'), b = body.lastIndexOf('}'); if (a < 0 || b <= a) return;
        try { const j = JSON.parse(body.slice(a, b + 1)); if (j && j.ip) fin({ ip: String(j.ip), country: String(j.country || ''), countryCode: String(j.country_code || j.countryCode || ''), city: String(j.city || '') }); } catch (e) {} };
      const tm = setTimeout(() => fin(null), ipTimeoutMs);
      s.once('error', () => fin(null)); s.once('close', () => { tryParse(); fin(null); });
      s.on('data', (c) => { buf = Buffer.concat([buf, c]); if (buf.length > 65536) return fin(null); tryParse(); });
      s.once('secureConnect', () => s.write('GET / HTTP/1.1\r\nHost: ' + ipHost + '\r\nAccept: application/json\r\nUser-Agent: Mozilla/5.0\r\nConnection: close\r\n\r\n'));
    }), () => ({}));
  }
  /* 同一条代理 + 同一个平台:正在测的合并成一次;结果记一小会儿(通 60 秒、不通 10 秒)—— 一键启动几十个共用代理的账号时,自动地区检测不会各测一遍把代理的并发打满 */
  const flying = new Map(), recent = new Map();
  function test(proxy, opts) {
    const key = String(proxy == null ? '' : proxy).trim() + '\n' + String((opts && opts.targetHost) || '').trim(), hit = recent.get(key);
    if (hit && Date.now() - hit.at < (hit.r.ok ? 60000 : 10000) && !(opts && opts.fresh)) return Promise.resolve(Object.assign({}, hit.r, { cached: true }));
    if (flying.has(key)) return flying.get(key);
    const p = run(proxy, opts).then((r) => { flying.delete(key); if (r.stage !== 'parse') { recent.set(key, { at: Date.now(), r }); if (recent.size > 200) recent.delete(recent.keys().next().value); } return r; }, (e) => { flying.delete(key); throw e; });
    flying.set(key, p); return p;
  }
  async function run(proxy, opts) {
    const r = scrmProxy.resolve(proxy), t0 = Date.now(), host = String((opts && opts.targetHost) || '').trim();
    if (r.kind === 'none') return { ok: false, stage: 'parse', code: 'EMPTY', msg: scrmProxy.REASONS.empty };
    if (r.kind === 'invalid') return { ok: false, stage: 'parse', code: 'PARSE', msg: r.reason };
    let verdict;
    try { const s = await tunnel(r, host || ipHost, 443); try { s.destroy(); } catch (e) {} verdict = { ok: true }; }
    catch (e) { verdict = (e && e.stage) ? e : sysFail(''); }
    /* 连代理本身就不行(连不上 / 类型不对 / 账号问题 / 被拒)→ 到此为止;代理正常(通,或只是连不上这个平台)→ 顺带问出口 IP */
    const info = (verdict.ok || verdict.stage === 'target') ? await exitInfo(r) : {};
    const out = Object.assign({}, verdict, { ms: Date.now() - t0, target: host, ip: info.ip || '', country: info.country || '', countryCode: info.countryCode || '', city: info.city || '' });
    log('[PROXY-TEST] ' + scrmProxy.describe(r) + ' → ' + (host || ipHost) + ' ' + (out.ok ? 'ok' : out.stage + '/' + out.code) + ' ' + out.ms + 'ms' + (out.ip ? ' exit=' + out.ip : ''));
    return out;
  }
  return { test };
}

let inst = null;
function init(deps) { inst = create(deps); return inst; }
function test(proxy, opts) { return (inst || init()).test(proxy, opts).catch(() => sysFail('')); }

module.exports = { create, init, test, MSG, IP_HOST, TIMEOUT_MS };
