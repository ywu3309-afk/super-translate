'use strict';
/* [PROXY-CORE] 2026-10-07 代理字符串的唯一解析处:一条代理"实际会怎么走"。
   给账号网页设置代理(main.js _applySessionProxy)和「测试连接」(scrm-proxy-test.js)都只吃 resolve() 的结果 —— 两边一致是结构保证的。
   (原来 main.js 的 parseProxyUrl + 三处各抄一遍的分支 + 测试模块自己又写一份解析,9 类写法结果不同。)
   resolve(str) →
     { kind:'none' }                                   没填 = 不用代理
     { kind:'invalid', reason }                        写法不支持;reason 是写给客户看的话
     { kind:'relay',    protocol:'socks5', host, port, username, password }
         带账号的 SOCKS5:Chromium 不支持 SOCKS 认证 → 主进程起一个本机中转(127.0.0.1:随机端口),由 socks 库带账号去连
     { kind:'chromium', protocol:'socks5'|'socks4'|'http'|'https', host, port, username, password, rules }
         直接交给 Chromium 的规则串 rules(形如 socks5://host:port);http/https 的账号密码不进规则串,代理要求认证时由 login 事件回填
   支持的写法(前后空白、换行一律先去掉):
     协议://[用户[:密码]@]主机:端口      协议 = socks5 / socks5h / socks / socks4 / socks4a / http / https
     主机:端口:用户:密码                 不带协议 = SOCKS5(密码里可以有冒号和 @)
     主机:端口                           不带协议 = **HTTP 代理**:原来这种写法是把原串直接交给 Chromium,Chromium 把它当 HTTP 代理 ——
                                         现在这样写而且能用的账号用的必然是 HTTP 代理,保持不变(面板自己只生成带协议的写法)
   用户名里可以有 @(按最后一个 @ 切主机);socks5h 按 socks5(本来就是由代理解析域名)、socks4a 按 socks4;SOCKS4 不支持账号密码。
   回归:tests/batch1/test-proxy.mjs */

const R = { empty: '代理信息不完整,请填写地址和端口', port: '代理端口不对(应为 1–65535)', host: '代理地址不对', scheme: '不支持这种代理类型', socks4auth: 'SOCKS4 代理不支持账号密码,请改用 SOCKS5' };
const SCHEME = { socks5: 'socks5', socks5h: 'socks5', socks: 'socks5', socks4: 'socks4', socks4a: 'socks4', http: 'http', https: 'https' };
const bad = (reason) => ({ kind: 'invalid', reason });

function resolve(str) {
  const s = String(str == null ? '' : str).trim();
  if (!s) return { kind: 'none' };
  let protocol = 'socks5', rest = s, username = '', password = '';
  const m = s.match(/^([a-z][a-z0-9+.-]*):\/\/(.*)$/i);
  if (m) { protocol = SCHEME[m[1].toLowerCase()]; if (!protocol) return bad(R.scheme); rest = m[2].replace(/\/+$/, '');
    const at = rest.lastIndexOf('@');
    if (at >= 0) { const cred = rest.slice(0, at), c = cred.indexOf(':'); username = c < 0 ? cred : cred.slice(0, c); password = c < 0 ? '' : cred.slice(c + 1); rest = rest.slice(at + 1); }
  } else { const p = s.split(':'); if (p.length >= 4) { rest = p[0] + ':' + p[1]; username = p[2]; password = p.slice(3).join(':'); } else protocol = 'http'; }
  const hp = rest.match(/^([^:\/\s@]+):(\d{1,5})$/);
  if (!hp) return bad(/^[^:\/\s@]+$/.test(rest) || !rest ? R.empty : R.host);
  const host = hp[1].toLowerCase(), port = Number(hp[2]);   /* 主机名统一小写(Chromium 给认证回调的主机名是小写,按它比对) */
  if (!(port >= 1 && port <= 65535)) return bad(R.port);
  if (protocol === 'socks4' && username) return bad(R.socks4auth);
  if (protocol === 'socks5' && username) return { kind: 'relay', protocol, host, port, username, password };
  return { kind: 'chromium', protocol, host, port, username, password, rules: protocol + '://' + host + ':' + port };
}
/* 写日志用的描述:不带密码 */
function describe(r) { return !r ? '' : r.kind === 'none' ? 'direct' : r.kind === 'invalid' ? 'invalid(' + r.reason + ')' : r.kind + ':' + r.protocol + '://' + (r.username ? r.username + '@' : '') + r.host + ':' + r.port; }

module.exports = { resolve, describe, REASONS: R };
