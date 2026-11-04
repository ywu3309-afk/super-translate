'use strict';
/*
 * webapp/server2.js — 写好后重命名为 server.js（避开文件观察策略的缓存冲突）
 * 出海猫聚合SCRM（客户端）+ AdMingcat（广告投放面板）的网站功能复刻
 */
const http = require('http');
process.on('uncaughtException', (e) => console.error('[uncaught]', e && e.stack || e));
process.on('unhandledRejection', (e) => console.error('[unhandled]', e && e.stack || e));
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');
const { DatabaseSync } = require('node:sqlite');
const { ENTITIES } = require('./schema.js');

const argv = process.argv.slice(2);
const argOf = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 ? argv[i + 1] : d; };
const PORT = Number(argOf('port', process.env.PORT || 8801));
const PUB = path.join(__dirname, 'public');
const DATA_DIR = process.env.SCRM_DATA_DIR || __dirname;
fs.mkdirSync(DATA_DIR, { recursive: true });
const SECRET = process.env.SITE_SECRET || 'chuhaimao-clone-secret';
const db = new DatabaseSync(path.join(DATA_DIR, 'site.db'));
db.exec('PRAGMA journal_mode = WAL');

const RESERVED = new Set(['id', 'user_id', 'created_at', 'updated_at']);

function ensureTables() {
  db.exec(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    realm TEXT NOT NULL, email TEXT, invite_code TEXT, password TEXT,
    name TEXT, plan TEXT, membership TEXT, membership_expire TEXT,
    balance REAL DEFAULT 0, char_quota REAL DEFAULT 20000, chars_used REAL DEFAULT 0,
    wallet_balance REAL DEFAULT 0,
    port_limit INTEGER DEFAULT 0, created_at TEXT
  )`);
  for (const [name, def] of Object.entries(ENTITIES)) {
    const cols = def.fields.filter((f) => !RESERVED.has(f.name)).map((f) => `"${f.name}" TEXT`).join(', ');
    db.exec(`CREATE TABLE IF NOT EXISTS e_${name} (
      id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, created_at TEXT, updated_at TEXT${cols ? ', ' + cols : ''}
    )`);
    // 老库补列：CREATE TABLE IF NOT EXISTS 不会加字段
    const have = new Set(db.prepare(`PRAGMA table_info(e_${name})`).all().map((c) => c.name));
    for (const f of def.fields) {
      if (RESERVED.has(f.name) || have.has(f.name)) continue;
      try { db.exec(`ALTER TABLE e_${name} ADD COLUMN "${f.name}" TEXT`); } catch (e) {}
    }
  }
  db.exec(`CREATE TABLE IF NOT EXISTS visits (
    id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, kind TEXT, code TEXT, ip TEXT, country TEXT, ua TEXT, action TEXT, source TEXT, medium TEXT, campaign TEXT, created_at TEXT
  )`);
  for (const col of ['source', 'medium', 'campaign']) {
    try { db.exec(`ALTER TABLE visits ADD COLUMN ${col} TEXT`); } catch (e) {}
  }
  db.exec(`CREATE TABLE IF NOT EXISTS ai_settings (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, provider TEXT, api_key TEXT, model TEXT)`);
  db.exec(`CREATE TABLE IF NOT EXISTS cloak_whitelist (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, ip TEXT, note TEXT, created_at TEXT)`);
  db.exec(`CREATE TABLE IF NOT EXISTS cloak_reviews (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, ip TEXT, country TEXT, ua TEXT, reason TEXT, status TEXT, created_at TEXT)`);
  db.exec(`CREATE TABLE IF NOT EXISTS cloak_ips (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, cidr TEXT, asn TEXT, country TEXT, label TEXT, kind TEXT, created_at TEXT)`);
  db.exec(`CREATE TABLE IF NOT EXISTS cloak_alerts (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, level TEXT, message TEXT, created_at TEXT)`);
  db.exec(`CREATE TABLE IF NOT EXISTS settings (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, key TEXT, value TEXT)`);
  db.exec(`CREATE TABLE IF NOT EXISTS s2s_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, url TEXT, status INTEGER, ok INTEGER, error TEXT, created_at TEXT)`);
  db.exec(`CREATE TABLE IF NOT EXISTS cloak_alerts (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, rule_id INTEGER, rule_name TEXT, hits INTEGER, message TEXT, read INTEGER DEFAULT 0, created_at TEXT)`);
  db.exec(`CREATE TABLE IF NOT EXISTS fast_services (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, name TEXT, platform TEXT, greeting TEXT, code TEXT, created_at TEXT)`);
  db.exec(`CREATE TABLE IF NOT EXISTS fast_workorders (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, name TEXT, service_id INTEGER, platform TEXT, share_code TEXT, interval_min INTEGER DEFAULT 5, auto_disable INTEGER DEFAULT 1, auto_optimize INTEGER DEFAULT 0, daily_limit INTEGER DEFAULT 0, status TEXT DEFAULT 'active', last_fetch TEXT, last_result TEXT, created_at TEXT)`);
  db.exec(`CREATE TABLE IF NOT EXISTS fast_pool (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, workorder_id INTEGER, number TEXT, status TEXT DEFAULT 'online', added_today INTEGER DEFAULT 0, last_add TEXT, created_at TEXT)`);
  db.exec(`CREATE TABLE IF NOT EXISTS ipdb_country (start INTEGER, end INTEGER, country TEXT, country_name TEXT)`);
  db.exec(`CREATE TABLE IF NOT EXISTS ipdb_asn (start INTEGER, end INTEGER, asn TEXT, org TEXT)`);
  db.exec(`CREATE TABLE IF NOT EXISTS ipdb_meta (key TEXT PRIMARY KEY, value TEXT)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_ipdb_country_start ON ipdb_country(start)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_ipdb_asn_start ON ipdb_asn(start)`);
  db.exec(`CREATE TABLE IF NOT EXISTS openchat_config (user_id INTEGER PRIMARY KEY, enabled INTEGER DEFAULT 0, share_code TEXT, status TEXT DEFAULT 'disconnected', identify_mode TEXT DEFAULT 'click', event TEXT DEFAULT 'Lead', platforms TEXT DEFAULT 'WhatsApp,LINE,Telegram,Kakao', trial_until TEXT, updated_at TEXT)`);
  db.exec(`CREATE TABLE IF NOT EXISTS openchat_pixels (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, platform TEXT, pixel_id TEXT, token TEXT, created_at TEXT)`);
  db.exec(`CREATE TABLE IF NOT EXISTS openchat_events (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, platform TEXT, staff TEXT, identify TEXT, ad TEXT, event TEXT, status TEXT, created_at TEXT)`);
  db.exec(`CREATE TABLE IF NOT EXISTS openchat_clicks (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, platform TEXT, staff TEXT, ad TEXT, identify TEXT, created_at TEXT)`);
  try { db.exec('ALTER TABLE openchat_clicks ADD COLUMN fingerprint TEXT'); } catch (e) {}
  db.exec(`CREATE TABLE IF NOT EXISTS openchat_links (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, token TEXT UNIQUE, platform TEXT, staff TEXT, target TEXT, greeting TEXT, created_at TEXT)`);
  db.exec(`CREATE TABLE IF NOT EXISTS openchat_pairs (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, code TEXT, status TEXT DEFAULT 'pending', created_at TEXT, expires_at TEXT, decided_at TEXT)`);
  for (const [table, cols] of Object.entries({
    openchat_config: ['window_min INTEGER DEFAULT 30', 'dedupe INTEGER DEFAULT 1', 'hash_phone INTEGER DEFAULT 0', 'public_base TEXT'],
    openchat_pixels: ['test_event_code TEXT', 'status TEXT', 'last_error TEXT', 'updated_at TEXT'],
    openchat_events: ['click_id INTEGER', 'error TEXT', 'reported_at TEXT', 'attempts INTEGER DEFAULT 0'],
  })) {
    const have = new Set(db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name));
    for (const col of cols) { const name = col.split(' ')[0]; if (!have.has(name)) { try { db.exec(`ALTER TABLE ${table} ADD COLUMN ${col}`); } catch (e) {} } }
  }
  db.exec(`CREATE TABLE IF NOT EXISTS chats (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, platform TEXT, contact TEXT, contact_id TEXT, last_message TEXT, last_at TEXT, unread INTEGER DEFAULT 0, status TEXT DEFAULT 'open')`);
  db.exec(`CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, chat_id INTEGER, direction TEXT, role TEXT, content TEXT, media_url TEXT, status TEXT, created_at TEXT)`);
  db.exec(`CREATE TABLE IF NOT EXISTS broadcast_jobs (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, name TEXT, content TEXT, audience TEXT, status TEXT, total INTEGER DEFAULT 0, created_at TEXT, started_at TEXT, finished_at TEXT)`);
  db.exec(`CREATE TABLE IF NOT EXISTS broadcast_targets (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, job_id INTEGER, contact TEXT, status TEXT DEFAULT 'queued', error TEXT, sent_at TEXT)`);
  db.exec(`CREATE TABLE IF NOT EXISTS port_leases (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, device TEXT, account_id TEXT, platform TEXT, state TEXT DEFAULT 'active', created_at TEXT, updated_at TEXT)`);
  db.exec(`CREATE TABLE IF NOT EXISTS proxy_bindings (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, account_id TEXT, platform TEXT, url TEXT, status TEXT, latency INTEGER, last_ip TEXT, created_at TEXT, updated_at TEXT, checked_at TEXT)`);
  db.exec(`CREATE TABLE IF NOT EXISTS device_sessions (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, device TEXT, ip TEXT, ua TEXT, last_seen TEXT, revoked INTEGER DEFAULT 0)`);
  db.exec(`CREATE TABLE IF NOT EXISTS contact_memos (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, contact TEXT, note TEXT, created_at TEXT)`);
  db.exec(`CREATE TABLE IF NOT EXISTS ai_replies (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, name TEXT, trigger TEXT, reply TEXT, platform TEXT, enabled INTEGER DEFAULT 1, hits INTEGER DEFAULT 0, created_at TEXT)`);
  db.exec(`CREATE TABLE IF NOT EXISTS page_versions (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, page_id INTEGER, html TEXT, name TEXT, note TEXT, created_at TEXT)`);
  db.exec(`CREATE TABLE IF NOT EXISTS login_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, realm TEXT, ip TEXT, ua TEXT, device TEXT, ok INTEGER, reason TEXT, created_at TEXT)`);
  db.exec(`CREATE TABLE IF NOT EXISTS org_roles (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, name TEXT, category TEXT, perms TEXT, created_at TEXT)`);
  db.exec(`CREATE TABLE IF NOT EXISTS org_members (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, staff_id INTEGER, role_id INTEGER, status TEXT, created_at TEXT)`);
  db.exec(`CREATE TABLE IF NOT EXISTS org_nodes (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, name TEXT, parent_id INTEGER, created_at TEXT)`);
  try { db.exec('ALTER TABLE users ADD COLUMN wallet_balance REAL DEFAULT 0'); } catch (e) {}
  for (const col of ['form_fields', 'form_webhook']) { try { db.exec(`ALTER TABLE e_pages ADD COLUMN ${col} TEXT`); } catch (e) {} }
  try { db.exec('ALTER TABLE e_forms ADD COLUMN data TEXT'); } catch (e) {}
  for (const col of ['html', 'stage', 'error', 'name', 'assets']) {
    try { db.exec(`ALTER TABLE e_clone_jobs ADD COLUMN ${col} TEXT`); } catch (e) {}
  }
  db.exec(`CREATE TABLE IF NOT EXISTS billing_plans (code TEXT PRIMARY KEY, name TEXT, kind TEXT, chars REAL, days INTEGER, price_cents INTEGER, active INTEGER DEFAULT 1, sort INTEGER DEFAULT 0)`);
  db.exec(`CREATE TABLE IF NOT EXISTS billing_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, request_id TEXT UNIQUE, plan_code TEXT, qty INTEGER,
    unit_price_cents INTEGER, amount_cents INTEGER, status TEXT, quote_sig TEXT, created_at TEXT, paid_at TEXT
  )`);
  const plans = [
    ['char_100k', '10 万字符', 'char', 100000, 0, 5000, 1, 10],
    ['char_500k', '50 万字符', 'char', 500000, 0, 20000, 1, 20],
    ['char_1m', '100 万字符', 'char', 1000000, 0, 35000, 1, 30],
    ['char_5m', '500 万字符', 'char', 5000000, 0, 150000, 1, 40],
    ['port_1m', '端口版 30 天', 'port', 0, 30, 9900, 1, 50],
  ];
  for (const p of plans) {
    db.prepare('INSERT OR IGNORE INTO billing_plans (code,name,kind,chars,days,price_cents,active,sort) VALUES (?,?,?,?,?,?,?,?)').run(...p);
  }
}
ensureTables();

const now = () => new Date().toISOString();
const json = (res, code, obj) => {
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Authorization,Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify(obj));
};
const html = (res, code, body) => { res.writeHead(code, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(body); };
const b64u = (b) => Buffer.from(b).toString('base64url');
function sign(payload) {
  const h = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const p = b64u(JSON.stringify(payload));
  return h + '.' + p + '.' + crypto.createHmac('sha256', SECRET).update(h + '.' + p).digest('base64url');
}
function verify(token) {
  try {
    const [h, p, s] = String(token || '').split('.');
    if (!h || !p || !s) return null;
    if (crypto.createHmac('sha256', SECRET).update(h + '.' + p).digest('base64url') !== s) return null;
    const obj = JSON.parse(Buffer.from(p, 'base64url').toString('utf8'));
    return obj.exp && obj.exp < Date.now() ? null : obj;
  } catch (e) { return null; }
}
const hash = (pw) => { const salt = crypto.randomBytes(8).toString('hex'); return salt + ':' + crypto.scryptSync(String(pw), salt, 32).toString('hex'); };
const samePw = (pw, stored) => { const [salt, h] = String(stored || '').split(':'); if (!salt || !h) return false; return crypto.scryptSync(String(pw), salt, 32).toString('hex') === h; };
function tokenEpoch(uid) { try { return Number(settingGet(uid, 'token_epoch') || 0); } catch (e) { return 0; } }
function verifyLive(tok) {
  const t = verify(tok);
  if (!t || !t.uid) return null;
  return Number(t.epoch || 0) === tokenEpoch(t.uid) ? t : null;
}
function signUser(uid, realm, expMs) { return sign({ uid, realm, epoch: tokenEpoch(uid), exp: expMs }); }
const userId = (req) => { const t = verifyLive((req.headers.authorization || '').replace(/^Bearer\s+/i, '')); return t && t.uid ? t.uid : 0; };
function uidFromReq(req, u) {
  const t = verifyLive((req.headers.authorization || '').replace(/^Bearer\s+/i, ''));
  if (t && t.uid) return t.uid;
  const q = u.searchParams.get('token');
  const v = q ? verifyLive(q) : null;
  return v && v.uid ? v.uid : 0;
}
const CF_PROXY_RE = /^(173\.245\.|103\.21\.|103\.22\.|103\.31\.|141\.101\.|108\.162\.|190\.93\.|188\.114\.|197\.234\.|198\.41\.|162\.15[89]\.|104\.(1[6-9]|2[0-7])\.|172\.(6[4-9]|7[0-1])\.|131\.0\.72\.|2606:4700:|2803:f800:|2405:b500:|2405:8100:|2a06:98c|2400:cb00:|2c0f:f248:)/;
const isTrustedProxy = (ip) => /^(127\.|::1$|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(String(ip || '')) || CF_PROXY_RE.test(String(ip || ''));
const clientIp = (req) => {
  const sock = String((req.socket && req.socket.remoteAddress) || '');
  if (!isTrustedProxy(sock)) return sock; // 直连来源不可伪造
  const cf = req.headers['cf-connecting-ip'];
  if (cf) return String(cf).trim();
  const xff = req.headers['x-forwarded-for'];
  if (xff) return String(xff).split(',')[0].trim();
  return sock;
};
const geo = (req) => String(req.headers['x-country'] || req.headers['cf-ipcountry'] || 'US').toUpperCase();
const uQuery = (req) => Object.fromEntries(new URL(req.url, 'http://x').searchParams.entries());

function readBody(req) {
  return new Promise((resolve) => {
    const chunks = []; req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      let j = null;
      try { j = JSON.parse(raw); } catch (e) { try { j = Object.fromEntries(new URLSearchParams(raw)); } catch (e2) {} }
      resolve(j || {});
    });
  });
}
const rowToObj = (r) => (r ? Object.assign({}, r) : null);

// 抓取外部页面（一键仿站用）
function fetchText(url, { method = 'GET', redirects = 4 } = {}) {  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const lib = u.protocol === 'https:' ? require('https') : http;
    const req = lib.request({ hostname: u.hostname, port: u.port || (u.protocol === 'https:' ? 443 : 80), path: u.pathname + u.search, method, timeout: 20000, headers: { 'User-Agent': 'Mozilla/5.0 (compatible; clone-bot/1.0)' } }, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location && redirects > 0) {
        res.resume();
        return resolve(fetchText(new URL(res.headers.location, u).toString(), { method, redirects: redirects - 1 }));
      }
      const chunks = []; res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, text: Buffer.concat(chunks).toString('utf8'), headers: res.headers }));
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
    req.end();
  });
}
// 二进制抓取（图片/CSS 内联用）
function fetchBuffer(url, redirects = 3) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const lib = u.protocol === 'https:' ? require('https') : http;
    const req = lib.request({ hostname: u.hostname, port: u.port || (u.protocol === 'https:' ? 443 : 80), path: u.pathname + u.search, method: 'GET', timeout: 15000, headers: { 'User-Agent': 'Mozilla/5.0 (compatible; clone-bot/1.0)' } }, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location && redirects > 0) {
        res.resume(); return resolve(fetchBuffer(new URL(res.headers.location, u).toString(), redirects - 1));
      }
      const chunks = []; res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, buffer: Buffer.concat(chunks), headers: res.headers }));
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject); req.end();
  });
}
// 外发 JSON（webhook/S2S/AI）
function httpPostJson(url, payload, timeout = 10000, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const lib = u.protocol === 'https:' ? require('https') : http;
    const body = Buffer.from(JSON.stringify(payload));
    const headers = Object.assign({ 'Content-Type': 'application/json', 'Content-Length': body.length, 'User-Agent': 'super-aggregation/1.0' }, extraHeaders);
    const req = lib.request({ hostname: u.hostname, port: u.port || (u.protocol === 'https:' ? 443 : 80), path: u.pathname + u.search, method: 'POST', timeout, headers }, (res) => {
      const chunks = []; res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, text: Buffer.concat(chunks).toString('utf8').slice(0, 20000) }));
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject); req.write(body); req.end();
  });
}
function settingGet(uid, key) { const r = db.prepare('SELECT value FROM settings WHERE user_id=? AND key=?').get(uid, key); return r ? r.value : ''; }
function settingSet(uid, key, value) {
  const r = db.prepare('SELECT id FROM settings WHERE user_id=? AND key=?').get(uid, key);
  if (r) db.prepare('UPDATE settings SET value=? WHERE id=?').run(String(value), r.id);
  else db.prepare('INSERT INTO settings (user_id,key,value) VALUES (?,?,?)').run(uid, key, String(value));
}
const normPhone = (s) => String(s || '').replace(/[^\d+]/g, '');
function premiumOk(user) {
  if (!user) return false;
  if (user.membership && user.membership !== 'free') return true;
  const exp = user.membership_expire ? new Date(user.membership_expire) : null;
  return false; // free 一律视为无会员，和原站一致
}

function listEntity(name, uid, q = {}) {
  const def = ENTITIES[name]; if (!def) return null;
  let sql = `SELECT * FROM e_${name} WHERE user_id = ?`;
  const args = [uid];
  const fields = def.fields.filter((f) => !RESERVED.has(f.name));
  for (const f of fields) {
    if (q[f.name] != null && q[f.name] !== '' && f.type !== 'html') { sql += ` AND "${f.name}" = ?`; args.push(String(q[f.name])); }
  }
  if (q.q) {
    sql += ` AND (${fields.map((f) => `COALESCE("${f.name}",'') LIKE ?`).join(' OR ')})`;
    fields.forEach(() => args.push('%' + q.q + '%'));
  }
  const limit = Math.min(500, Math.max(1, Number(q.limit) || (q.all === '1' ? 500 : 100)));
  const offset = Math.max(0, Number(q.offset) || (Number(q.page) ? (Number(q.page) - 1) * limit : 0));
  sql += ' ORDER BY id DESC LIMIT ? OFFSET ?';
  args.push(limit, offset);
  return db.prepare(sql).all(...args).map(rowToObj);
}

function listEntityTotal(name, uid, q = {}) {
  const def = ENTITIES[name]; if (!def) return 0;
  let sql = `SELECT COUNT(*) n FROM e_${name} WHERE user_id = ?`;
  const args = [uid];
  const fields = def.fields.filter((f) => !RESERVED.has(f.name));
  for (const f of fields) {
    if (q[f.name] != null && q[f.name] !== '' && f.type !== 'html') { sql += ` AND "${f.name}" = ?`; args.push(String(q[f.name])); }
  }
  if (q.q) {
    sql += ` AND (${fields.map((f) => `COALESCE("${f.name}",'') LIKE ?`).join(' OR ')})`;
    fields.forEach(() => args.push('%' + q.q + '%'));
  }
  return Number(db.prepare(sql).get(...args).n);
}
function createEntity(name, uid, body) {
  const def = ENTITIES[name]; if (!def) return null;
  const cols = ['user_id', 'created_at', 'updated_at'], vals = [uid, now(), now()];
  for (const f of def.fields) {
    if (f.readonly || RESERVED.has(f.name)) continue;
    let v = body[f.name];
    if (v === undefined || v === null || v === '') v = f.default !== undefined ? f.default : '';
    cols.push('"' + f.name + '"'); vals.push(typeof v === 'number' ? v : String(v));
  }
  const info = db.prepare(`INSERT INTO e_${name} (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`).run(...vals);
  return rowToObj(db.prepare(`SELECT * FROM e_${name} WHERE id = ?`).get(Number(info.lastInsertRowid)));
}
function updateEntity(name, uid, id, body) {
  const def = ENTITIES[name]; if (!def) return null;
  const sets = ['updated_at = ?'], vals = [now()];
  for (const f of def.fields) {
    if (f.readonly || RESERVED.has(f.name)) continue;
    if (body[f.name] !== undefined) { sets.push('"' + f.name + '" = ?'); vals.push(String(body[f.name])); }
  }
  vals.push(Number(id), uid);
  db.prepare(`UPDATE e_${name} SET ${sets.join(', ')} WHERE id = ? AND user_id = ?`).run(...vals);
  return rowToObj(db.prepare(`SELECT * FROM e_${name} WHERE id = ? AND user_id = ?`).get(Number(id), uid));
}
function deleteEntity(name, uid, id) {
  if (!ENTITIES[name]) return false;
  db.prepare(`DELETE FROM e_${name} WHERE id = ? AND user_id = ?`).run(Number(id), uid);
  return true;
}
function count(name, uid) { const r = db.prepare(`SELECT COUNT(*) AS n FROM e_${name} WHERE user_id = ?`).get(uid); return r ? Number(r.n) : 0; }

// ---------------- 种子 ----------------
function seed() {
  if (db.prepare('SELECT COUNT(*) AS n FROM users').get().n > 0) return;
  const t = now();
  const client = db.prepare(`INSERT INTO users (realm,email,invite_code,password,name,plan,char_quota,chars_used,port_limit,created_at)
    VALUES ('client','2983889209@qq.com','CHMMVOA64ULC8W',?, '出海猫-演示', '字符版', 20000, 0, 0, ?)`).run(hash('ABC123456'), t);
  const cid = Number(client.lastInsertRowid);
  const admin = db.prepare(`INSERT INTO users (realm,email,invite_code,password,name,membership,membership_expire,created_at)
    VALUES ('admin','2983889209@qq.com',NULL,?, 'WYFNB666', 'free', ?, ?)`).run(hash('ABC123456'), new Date(Date.now() + 3 * 86400e3).toISOString().slice(0, 10), t);
  const aid = Number(admin.lastInsertRowid);
  const add = (name, uid, obj) => createEntity(name, uid, obj);

  add('codes', cid, { code: 'CHMMVOA64ULC8W', plan: '字符版', char_quota: 20000, chars_used: 0, note: '主邀请码' });
  add('codes', cid, { code: 'CHM-SUB-0001', plan: '试用版', char_quota: 2000, chars_used: 0, note: '子码' });
  [['WhatsApp', '+65 8123 4567', 'socks5://127.0.0.1:1080', 'online'],
   ['Telegram', '@chuhaimao_demo', 'http://127.0.0.1:8080', 'offline'],
   ['LINE', 'line_demo_01', '', 'online'],
   ['Zalo', 'zalo_demo_01', '', 'online']].forEach(([platform, n, proxy, status]) => {
    add('accounts', cid, { platform, name: n, proxy, status, last_seen: t });
  });
  for (const p of ['WhatsApp', 'Telegram', 'LINE']) {
    for (let i = 0; i < 3; i++) add('leads', cid, { name: `线索${p.slice(0, 2)}-${i + 1}`, contact: `+65 9${i}00 12${i}`, platform: p, source: '落地页', status: ['new', 'following', 'won'][i], note: '' });
  }
  add('links', cid, { code: 'wa01', platform: 'WhatsApp', mode: 'stable', targets: 'https://wa.me/6581234567\nhttps://wa.me/6587654321', clicks: 0 });
  add('links', cid, { code: 'tg01', platform: 'Telegram', mode: 'fast', targets: 'https://t.me/chuhaimao_demo', clicks: 0 });
  add('proxies', cid, { url: 'socks5://127.0.0.1:1080', country: 'SG', status: 'ok', latency: 42 });
  add('proxies', cid, { url: 'http://127.0.0.1:8080', country: 'US', status: 'unknown', latency: 0 });
  add('tags', cid, { name: '高意向', color: '#22c55e' });
  add('tags', cid, { name: '已成交', color: '#6366f1' });
  add('quick', cid, { title: '报价', content: '你好，这款产品的报价是……' });
  add('keywords', cid, { keyword: '价格', reply: '稍等，我发你价目表。', match: 'contains' });
  add('welcome', cid, { name: '默认欢迎语', platform: 'WhatsApp', content: '你好，欢迎咨询出海猫！', enabled: '1' });
  add('sensitive', cid, { word: '转账', level: 'high', action: 'notify' });
  add('staff', cid, { account: 'kefu01', role: 'staff', status: 'active' });

  add('pages', aid, { name: '智能手表落地页', slug: 'watch', template: 'watch', status: 'live', views: 0, conversions: 0, html: '<h1>Smart Watch X1</h1><p>限时 50% OFF</p>' });
  add('templates', aid, { name: '手表-极简', category: 'watch', html: '<h1>Smart Watch</h1>' });
  add('templates', aid, { name: '美妆-霓虹', category: 'beauty', html: '<h1>Glow Kit</h1>' });
  add('cloak_rules', aid, { name: '屏蔽审查 IP', country_mode: 'black', countries: 'CN,VN', device: 'any', action: 'block', target: '', review_days: 0, enabled: '1' });
  add('cloak_rules', aid, { name: '移动端跳转', country_mode: 'off', device: '手机', action: 'redirect', target: 'https://wa.me/6581234567', review_days: 0, enabled: '1' });
  add('domains', aid, { domain: 'go.example.com', status: 'verified' });
  add('events', aid, { name: 'Purchase', platform: 'TrafficStars', postback_url: 'https://ts.example.com/pb?click_id={click_id}', status: 'active' });
  add('audiences', aid, { name: '高意向人群', platform: 'Meta', size: 1200, synced_at: t });
  add('tracking', aid, { name: '默认追踪', source: 'facebook', medium: 'cpc', campaign: 'watch-x1', clicks: 0 });
  add('shunt', aid, { code: 'wa-fast', platform: 'WhatsApp', mode: 'fast', targets: 'https://wa.me/6581234567', clicks: 0 });
  add('shunt', aid, { code: 'line-stable', platform: 'LINE', mode: 'stable', targets: 'https://line.me/R/ti/p/~demo', clicks: 0 });
  add('admin_staff', aid, { account: 'staff01', role: 'staff', status: 'active' });

  db.prepare('INSERT INTO cloak_ips (user_id,cidr,asn,country,label,kind,created_at) VALUES (?,?,?,?,?,?,?)').run(aid, '66.249.64.0/19', 'AS15169', 'US', 'Googlebot', 'review', t);
  db.prepare('INSERT INTO cloak_ips (user_id,cidr,asn,country,label,kind,created_at) VALUES (?,?,?,?,?,?,?)').run(aid, '203.0.113.0/24', '', 'CN', '审查段', 'black', t);
  db.prepare('INSERT INTO cloak_alerts (user_id,level,message,created_at) VALUES (?,?,?,?)').run(aid, 'info', '斗篷规则已更新：新增「移动端跳转」', t);
  db.prepare('INSERT INTO cloak_alerts (user_id,level,message,created_at) VALUES (?,?,?,?)').run(aid, 'warn', '检测到 3 个高频审核 IP，建议加入 IP 库', t);

  // 面板会话（面板本身存 localStorage，这里做持久化与首次注入）
  const demoWa = [{ session_id: 'wa_demo_1', created_at: t, updated_at: t, status: 'offline', remark: 'WhatsApp 1', phone: '', region: '', wa_name: '', wa_number: '' }];
  const demoTg = [{ session_id: 'tg_demo_1', created_at: t, updated_at: t, status: 'offline', remark: 'Telegram 1', phone: '', region: '' }];
  db.prepare('INSERT INTO settings (user_id,key,value) VALUES (?,?,?)').run(cid, 'sessions_wa', JSON.stringify(demoWa));
  db.prepare('INSERT INTO settings (user_id,key,value) VALUES (?,?,?)').run(cid, 'sessions_tg', JSON.stringify(demoTg));
  console.log('[seed] client invite CHMMVOA64ULC8W / admin 2983889209@qq.com / ABC123456');
}
seed();

// ---------------- 访客识别 ----------------
function uaInfo(ua) {
  const s = String(ua || '');
  const browser = /Edg\/([\d.]+)/.test(s) ? 'Edge ' + RegExp.$1
    : /Chrome\/([\d.]+)/.test(s) ? 'Chrome ' + RegExp.$1
    : /Firefox\/([\d.]+)/.test(s) ? 'Firefox ' + RegExp.$1
    : /Safari\/([\d.]+)/.test(s) ? 'Safari ' + RegExp.$1 : 'Unknown';
  const os = /Windows NT 10/.test(s) ? 'Windows 11'
    : /Windows NT/.test(s) ? 'Windows 10'
    : /Mac OS X/.test(s) ? 'macOS'
    : /Android ([\d.]+)/.test(s) ? 'Android ' + RegExp.$1
    : /iPhone OS ([\d_]+)/.test(s) ? 'iOS ' + RegExp.$1.replace(/_/g, '.') : 'Unknown';
  const device = /Mobile|Android|iPhone|iPad/i.test(s) ? '手机' : '电脑';
  return { browser, os, device };
}
function ipInList(ip, list) {
  return String(list || '').split(/[\s,]+/).filter(Boolean).some((entry) => {
    if (entry.includes('/')) {
      const [base, bits] = entry.split('/');
      const n = Number(bits);
      if (!/^\d+\.\d+\.\d+\.\d+$/.test(base) || !(n >= 0 && n <= 32)) return false;
      const toInt = (x) => x.split('.').reduce((a, b) => (a << 8) + Number(b), 0) >>> 0;
      const mask = n === 0 ? 0 : (0xffffffff << (32 - n)) >>> 0;
      return (toInt(ip) & mask) === (toInt(base) & mask);
    }
    return ip === entry;
  });
}
const listOf = (v) => String(v || '').split(/[\n,]+/).map((x) => x.trim()).filter(Boolean);
function inSchedule(r) {
  const days = listOf(r.sched_days).map(Number).filter(Boolean);
  const toMin = (s) => { const m = String(s || '').match(/^(\d{1,2}):(\d{2})/); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };
  const a = toMin(r.sched_start), b = toMin(r.sched_end);
  if (!days.length && a == null && b == null) return true;
  let local = new Date();
  if (r.sched_tz) { try { local = new Date(local.toLocaleString('en-US', { timeZone: r.sched_tz })); } catch (e) {} }
  if (days.length) { const dow = local.getDay() === 0 ? 7 : local.getDay(); if (!days.includes(dow)) return false; }
  const hm = local.getHours() * 60 + local.getMinutes();
  if (a != null && b != null) return a <= b ? (hm >= a && hm <= b) : (hm >= a || hm <= b);
  if (a != null) return hm >= a;
  if (b != null) return hm <= b;
  return true;
}
function ruleHit(uid, r) {
  // 空规则不参与匹配，避免"新建即全拦"
  const anyCondition = ['ip_list', 'domains', 'ua_list', 'referers', 'cookies', 'countries', 'os_list', 'languages', 'vpn_flags',
    'asn_list', 'browsers', 'inapp_block', 'cn_device', 'crawler_block', 'no_click_param', 'repeat_limit', 'icloud_relay', 'residential_only', 'tz_gate']
    .some((k) => r[k] && String(r[k]) !== '0') || (r.device && r.device !== 'any') || r.sched_start || r.sched_end || r.limit_min || r.limit_hour || r.limit_day || r.limit_total;
  if (!anyCondition) return { match: false };
  return { match: true };
}
function limitExceeded(uid, r) {
  const win = [['minute', 60000, r.limit_min], ['hour', 3600000, r.limit_hour], ['day', 86400000, r.limit_day], ['total', 0, r.limit_total]];
  for (const [k, ms, lim] of win) {
    if (!Number(lim)) continue;
    const since = ms ? new Date(Date.now() - ms).toISOString() : '1970';
    const n = db.prepare(`SELECT COUNT(*) n FROM visits WHERE user_id=? AND action LIKE ? AND created_at >= ?`).get(uid, '%' + r.name + '%', since).n;
    if (Number(n) >= Number(lim)) return true;
  }
  return false;
}
// 返回 {action:'allow'|'block'|'redirect'|'review'|null, rule}
function modePass(mode, hit) {
  const m = String(mode || '').toLowerCase();
  if (!m || m === 'off') return true;
  if (m === 'black' || m === 'include') return hit;      // 命中名单才应用规则
  if (m === 'white' || m === 'exclude') return !hit;     // 不在名单才应用规则
  return true;
}
function matchRule(r, v, req, uid, ctx = {}) {
  if (!ruleHit(0, r).match) return { action: null, rule: null };
  if (r.land_type) {
    const want = listOf(r.land_value);
    const path = String(ctx.path || req.url || '');
    const slug = String(ctx.slug || (path.startsWith('/p/') ? path.slice(3).split('/')[0] : ''));
    if (r.land_type === 'landing' && !want.some((x) => x === slug || x === '/p/' + slug)) return { action: null, rule: null };
    if (r.land_type === 'external' && !want.some((x) => path.startsWith(x))) return { action: null, rule: null };
    if (r.land_type === 'postback' && !ctx.postback) return { action: null, rule: null };
  }
  if (r.ip_mode && r.ip_mode !== 'off' && r.ip_list) {
    const hit = ipInList(v.ip, r.ip_list);
    if (!modePass(r.ip_mode, hit)) return { action: null, rule: null };
    if (String(r.ip_mode).toLowerCase() === 'white' && hit) return { action: 'allow', rule: r };
  }
  if (r.domain_mode && r.domain_mode !== 'off' && r.domains) {
    const host = String((req.headers.referer || '') + ' ' + (v.ua || '')).toLowerCase();
    const hit = listOf(r.domains).some((d) => host.includes(d.toLowerCase()));
    if (!modePass(r.domain_mode, hit)) return { action: null, rule: null };
  }
  if (r.ua_mode && r.ua_mode !== 'off' && r.ua_list) {
    const hit = listOf(r.ua_list).some((x) => v.ua.toLowerCase().includes(x.toLowerCase()));
    if (!modePass(r.ua_mode, hit)) return { action: null, rule: null };
  }
  if (r.referer_mode && r.referer_mode !== 'off' && r.referers) {
    const ref = String(req.headers.referer || '').toLowerCase();
    const hit = listOf(r.referers).some((x) => ref.includes(x.toLowerCase()));
    if (!modePass(r.referer_mode, hit)) return { action: null, rule: null };
  }
  if (r.cookie_mode && r.cookie_mode !== 'off' && r.cookies) {
    const ck = String(req.headers.cookie || '').toLowerCase();
    const hit = listOf(r.cookies).some((x) => ck.includes(x.toLowerCase()));
    if (!modePass(r.cookie_mode, hit)) return { action: null, rule: null };
  }
  if (r.country_mode && r.country_mode !== 'off' && r.countries) {
    const hit = listOf(r.countries).map((x) => x.toUpperCase()).includes(v.country);
    if (!modePass(r.country_mode, hit)) return { action: null, rule: null };
  }
  if (r.device && r.device !== 'any' && r.device !== v.device) return { action: null, rule: null };
  if (r.os_list && !listOf(r.os_list).some((x) => v.os.toLowerCase().includes(x.toLowerCase()))) return { action: null, rule: null };
  if (r.languages && !listOf(r.languages).some((x) => v.language.toLowerCase().startsWith(x.toLowerCase()))) return { action: null, rule: null };
  if (r.vpn_flags) {
    const flags = listOf(r.vpn_flags);
    const isDC = asnIsDC(v.asn);
    if (flags.includes('dc') && !isDC) return { action: null, rule: null };
    if (flags.includes('vpn') && !/vpn|proxy|private/i.test(v.asn)) return { action: null, rule: null };
    if (flags.includes('tor') && !asnIsTor(v.asn)) return { action: null, rule: null };
  }
  if (r.asn_list) {
    const want = new Set(listOf(r.asn_list).map((x) => String(x).replace(/^AS/i, '').trim()));
    const m = String(v.asn || '').match(/^AS(\d+)/);
    if (!m || !want.has(m[1])) return { action: null, rule: null };
  }
  if (r.browsers) {
    const want = listOf(r.browsers).map((x) => x.toLowerCase());
    const b = browserOf(v.ua).toLowerCase();
    if (!want.includes(b)) return { action: null, rule: null };
  }
  if (String(r.inapp_block || '') === '1' && INAPP_RE.test(v.ua)) return { action: null, rule: null }; // 应用内浏览器免检
  if (String(r.cn_device || '') === '1' && !(v.country === 'CN' && String(v.language || '').toLowerCase().startsWith('zh'))) return { action: null, rule: null };
  if (String(r.crawler_block || '') === '1' && !CRAWLER_RE.test(v.ua)) return { action: null, rule: null };
  if (String(r.no_click_param || '') === '1') {
    const q = new URL(req.url, 'http://x').searchParams;
    if (q.get('fbclid') || q.get('ttclid') || q.get('gclid') || q.get('msclkid')) return { action: null, rule: null };
  }
  if (String(r.icloud_relay || '') === '1' && !/icloud|private relay/i.test(v.ua)) return { action: null, rule: null };
  if (String(r.residential_only || '') === '1' && asnIsDC(v.asn)) return { action: null, rule: null };
  if (Number(r.repeat_limit) > 0) {
    const since = new Date(Date.now() - 86400e3).toISOString();
    const n = db.prepare('SELECT COUNT(*) n FROM visits WHERE user_id=? AND ip=? AND created_at>=?').get(uid, v.ip, since).n;
    if (Number(n) < Number(r.repeat_limit)) return { action: null, rule: null };
  }
  if (!inSchedule(r)) return { action: null, rule: null };
  if (limitExceeded(uid, r)) return { action: r.action || 'block', rule: r, limited: true };
  return { action: r.action || 'block', rule: r };
}
function cloakCheck(uid, req, ctx = {}) {
  const v = visitorOf(req);
  const wl = db.prepare('SELECT * FROM cloak_whitelist WHERE user_id = ?').all(uid);
  if (wl.some((w) => String(w.ip).split(',').map((x) => x.trim()).includes(v.ip))) return { visitor: v, action: 'allow', rule: { name: '白名单', action: 'allow' }, whitelisted: true };
  const rules = db.prepare(`SELECT * FROM e_cloak_rules WHERE user_id = ? AND CAST(COALESCE(enabled,0) AS REAL) = 1 ORDER BY id DESC`).all(uid);
  // 服务端硬拦截优先；JS 时区门放最后，避免一票规则遮住其他规则
  const ordered = [...rules.filter((r) => String(r.tz_gate || '') !== '1'), ...rules.filter((r) => String(r.tz_gate || '') === '1')];
  for (const r of ordered) {
    const d = matchRule(r, v, req, uid, ctx);
    if (d.action) {
      const ck = String(req.headers.cookie || '');
      const challenge = String(r.js_challenge || '') === '1' && d.action === 'block' && !/(?:^|;\s*)_ck=/.test(ck);
      const tzGate = String(r.tz_gate || '') === '1' && d.action === 'block';
      return { visitor: v, action: d.action, rule: d.rule, whitelisted: d.action === 'allow', challenge, tzGate, tzZones: r.tz_zones || '' };
    }
  }
  return { visitor: v, action: 'allow', rule: null, whitelisted: false };
}
const CRAWLER_RE = /Googlebot|bingbot|Baiduspider|facebookexternalhit|HeadlessChrome|PhantomJS|Puppeteer|Playwright|curl\/|Wget\/|python-requests|Go-http-client|bot\b|crawler|spider/i;
const INAPP_RE = /FBAN|FBAV|Instagram|Line\/|MicroMessenger|Snapchat|TikTok|musical_ly|KAKAOTALK/i;
function browserOf(ua) {
  const s = String(ua || '');
  if (INAPP_RE.test(s)) return 'app';
  if (/Edg\//i.test(s)) return 'Edge';
  if (/OPR\/|Opera/i.test(s)) return 'Opera';
  if (/SamsungBrowser/i.test(s)) return '三星浏览器';
  if (/Firefox\//i.test(s)) return 'Firefox';
  if (/CriOS\//i.test(s)) return 'Chrome';
  if (/Chrome\//i.test(s)) return 'Chrome';
  if (/Safari\//i.test(s)) return 'Safari';
  return 'other';
}
function asnIsDC(asn) { return /Cloudflare|DigitalOcean|AWS|Amazon|Google|Azure|OVH|Hetzner|NTT|Linode|Vultr|Alibaba|Tencent/i.test(String(asn || '')); }
function asnIsTor(asn) { return /Tor\b|tor-exit|TOR-EXIT/i.test(String(asn || '')); }
function ipToInt(ip) {
  const p = String(ip || '').trim().split('.');
  if (p.length !== 4 || p.some((x) => !/^\d{1,3}$/.test(x))) return null;
  return p.reduce((a, b) => (a << 8) + Number(b), 0) >>> 0;
}
function ipdbCountry(ip) {
  const n = ipToInt(ip);
  if (n == null) return null;
  try {
    const r = db.prepare('SELECT country,country_name,end FROM ipdb_country WHERE start<=? ORDER BY start DESC LIMIT 1').get(n);
    return r && r.end >= n ? r : null;
  } catch (e) { return null; }
}
function ipdbAsn(ip) {
  const n = ipToInt(ip);
  if (n == null) return null;
  try {
    const r = db.prepare('SELECT asn,org,end FROM ipdb_asn WHERE start<=? ORDER BY start DESC LIMIT 1').get(n);
    return r && r.end >= n ? r : null;
  } catch (e) { return null; }
}
function importIpdbFromDir(dir) {
  const files = fs.existsSync(dir) ? fs.readdirSync(dir) : [];
  const out = {};
  const readText = (f) => {
    const b = fs.readFileSync(path.join(dir, f));
    return f.endsWith('.gz') ? zlib.gunzipSync(b).toString('utf8') : b.toString('utf8');
  };
  const load = (file, table) => {
    const text = readText(file);
    db.exec(`DELETE FROM ${table}`);
    const ins = db.prepare(`INSERT INTO ${table} VALUES (?,?,?,?)`);
    db.exec('BEGIN');
    let n = 0;
    for (const line of text.split(/\r?\n/)) {
      if (!line || /^ip_start|^start|^network/i.test(line)) continue;
      const c = line.split(',');
      if (c.length < 3) continue;
      const s = ipToInt(c[0]), e = ipToInt(c[1]);
      if (s == null || e == null) continue;
      ins.run(s, e, String(c[2] || '').replace(/"/g, ''), String(c[3] || '').replace(/"/g, ''));
      n++;
    }
    db.exec('COMMIT');
    db.prepare('INSERT OR REPLACE INTO ipdb_meta (key,value) VALUES (?,?)').run(table + '_count', String(n));
    db.prepare('INSERT OR REPLACE INTO ipdb_meta (key,value) VALUES (?,?)').run(table + '_updated', now());
    return n;
  };
  const cf = files.find((f) => /country.*\.csv(\.gz)?$/i.test(f));
  const af = files.find((f) => /asn.*\.csv(\.gz)?$/i.test(f));
  if (cf) out.country = load(cf, 'ipdb_country');
  if (af) out.asn = load(af, 'ipdb_asn');
  if (!cf && !af) throw new Error('data/ipdb 里没有 country/asn 的 CSV');
  return out;
}
function visitorOf(req) {
  const ua = String(req.headers['user-agent'] || '');
  const info = uaInfo(ua);
  const ip = clientIp(req) || '127.0.0.1';
  const dbc = ipdbCountry(ip);
  const dba = ipdbAsn(ip);
  let asn = dba ? ('AS' + dba.asn + ' ' + (dba.org || '')) : 'AS0 未知';
  if (/^10\./.test(ip) || /^192\.168\./.test(ip) || ip === '127.0.0.1') asn = 'AS0 本地网络';
  const headerCountry = req.headers['x-country'] || req.headers['cf-ipcountry'];
  const country = headerCountry ? geo(req) : (dbc ? String(dbc.country || 'US').toUpperCase() : geo(req));
  return { ip, asn, country, country_name: dbc ? dbc.country_name : '', source: dbc || dba ? 'ipdb' : 'fallback', language: langOf(req), browser: info.browser, os: info.os, device: info.device, ua, at: now(), explain: `判定为${info.device}设备（系统语言 ${langOf(req)}）` };
}
const langOf = (req) => String(req.headers['accept-language'] || 'en-US,en;q=0.9').split(',')[0].trim();

const DICT = { hello: '你好', world: '世界', price: '价格', order: '订单', free: '免费', 'thank you': '谢谢', 'good morning': '早上好' };
function fakeTranslate(text, lang) {
  const t = String(text).trim();
  if (lang === 'zh-CN') return DICT[t.toLowerCase()] || ('【zh-CN】' + t);
  return '【' + lang + '】' + t;
}

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://' + (req.headers.host || '127.0.0.1'));
  const p = u.pathname, m = req.method.toUpperCase();
  if (m === 'OPTIONS') return json(res, 204, {});
  const t0 = Date.now();
  res.on('finish', () => {
    if (/^\/(shared|assets|shots)/.test(p)) return;
    console.log(`${new Date().toISOString()} ${m} ${p} -> ${res.statusCode} ${Date.now() - t0}ms ref=${String(req.headers.referer || '').replace(/^https?:\/\/[^/]+/, '').slice(0, 60)}`);
  });

  if (p === '/' || p === '/client') { res.writeHead(302, { Location: '/client/' }); return res.end(); }
  if (p === '/admin') { res.writeHead(302, { Location: '/admin/' }); return res.end(); }
  if (p.endsWith('/') || /\.(css|js|svg|png|ico|html|woff2?|ttf)$/.test(p)) {
    const rel = p.replace(/^\//, '');
    const file = path.join(PUB, rel.endsWith('/') ? rel + 'index.html' : rel);
    if (file.startsWith(PUB) && fs.existsSync(file) && fs.statSync(file).isFile()) {
      const types = { html: 'text/html; charset=utf-8', css: 'text/css; charset=utf-8', js: 'text/javascript; charset=utf-8', svg: 'image/svg+xml', png: 'image/png', ico: 'image/x-icon', woff2: 'font/woff2', woff: 'font/woff', ttf: 'font/ttf' };
      res.writeHead(200, { 'Content-Type': types[path.extname(file).slice(1)] || 'application/octet-stream' });
      return res.end(fs.readFileSync(file));
    }
  }

  if (p.startsWith('/t/')) {
    const code = p.slice(3).split(/[?#]/)[0];
    const row = db.prepare('SELECT * FROM e_tracking WHERE code = ?').get(code);
    if (!row) return html(res, 404, 'tracking not found');
    const q = u.searchParams;
    const source = q.get('utm_source') || row.source || 'direct';
    const medium = q.get('utm_medium') || row.medium || '';
    const campaign = q.get('utm_campaign') || row.campaign || '';
    db.prepare('INSERT INTO visits (user_id,kind,code,ip,country,ua,action,source,medium,campaign,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
      .run(row.user_id, 'track', code, clientIp(req), geo(req), String(req.headers['user-agent'] || ''), 'click', source, medium, campaign, now());
    db.prepare(`UPDATE e_tracking SET clicks = CAST(COALESCE(clicks,0) AS INTEGER) + 1 WHERE id = ?`).run(row.id);
    res.writeHead(302, { Location: row.target || '/p/watch', 'Set-Cookie': '_src=' + encodeURIComponent(code) + '; Path=/; Max-Age=2592000; SameSite=Lax' });
    return res.end();
  }

  if (p.startsWith('/oc/l/')) {
    const token = p.slice(6).split(/[?#]/)[0];
    const row = db.prepare('SELECT * FROM openchat_links WHERE token=?').get(token);
    if (!row) return html(res, 404, 'openchat link not found');
    const suffix = ['!', '🙂', '.', '~'][Date.now() % 4];
    db.prepare('INSERT INTO openchat_clicks (user_id,platform,staff,ad,identify,fingerprint,created_at) VALUES (?,?,?,?,?,?,?)')
      .run(row.user_id, row.platform, row.staff, 'openchat-link', token, suffix, now());
    const text = String(row.greeting || 'Hi') + suffix + openchatEncodeHidden(token);
    let location = '';
    if (String(row.platform).toLowerCase() === 'telegram') {
      const user = String(row.target || '').replace(/^@/, '').replace(/^https?:\/\/t\.me\//i, '');
      location = 'https://t.me/' + encodeURIComponent(user) + '?text=' + encodeURIComponent(text);
    } else {
      const phone = String(row.target || '').replace(/[^\d]/g, '');
      location = 'https://wa.me/' + phone + '?text=' + encodeURIComponent(text);
    }
    res.writeHead(302, { Location: location, 'Cache-Control': 'no-store' });
    return res.end();
  }

  if (p.startsWith('/s/')) {
    const code = p.slice(3);
    for (const name of ['links', 'shunt']) {
      const row = db.prepare(`SELECT * FROM e_${name} WHERE code = ?`).get(code);
      if (!row) continue;
      let list = [];
      try { const parsed = JSON.parse(String(row.targets || '')); if (Array.isArray(parsed)) list = parsed; } catch (e) {}
      if (!list.length) list = String(row.targets || '').split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
      list = list.map((t) => (typeof t === 'string' ? { url: t, weight: 1 } : { url: t.url || t.target || '', weight: Number(t.weight == null ? 1 : t.weight) })).filter((t) => t.url);
      if (!list.length) return html(res, 404, 'no target');
      const total = list.reduce((a, b) => a + Math.max(0, b.weight), 0);
      let pick = list[0];
      if (total > 0) {
        let rnd = Math.random() * total;
        for (const t of list) { rnd -= Math.max(0, t.weight); if (rnd <= 0) { pick = t; break; } }
      }
      const target = pick.url;
      db.prepare(`UPDATE e_${name} SET clicks = CAST(COALESCE(clicks,0) AS INTEGER) + 1 WHERE id = ?`).run(row.id);
      db.prepare('INSERT INTO visits (user_id,kind,code,ip,country,ua,action,created_at) VALUES (?,?,?,?,?,?,?,?)')
        .run(row.user_id, 'link', code, clientIp(req), geo(req), String(req.headers['user-agent'] || ''), 'click', now());
      res.writeHead(302, { Location: target }); return res.end();
    }
    return html(res, 404, 'link not found');
  }

  if (p.startsWith('/p/')) {
    const slug = p.slice(3).split('/')[0];
    const page = db.prepare('SELECT * FROM e_pages WHERE slug = ?').get(slug);
    if (!page) return html(res, 404, '<h1>404 页面不存在</h1>');
    const d = cloakCheck(page.user_id, req, { slug, path: req.url });
    db.prepare('INSERT INTO visits (user_id,kind,code,ip,country,ua,action,created_at) VALUES (?,?,?,?,?,?,?,?)')
      .run(page.user_id, 'page', slug, d.visitor.ip, d.visitor.country, d.visitor.ua, (d.challenge ? 'challenge' : d.action) + (d.rule && d.rule.name ? ':' + d.rule.name : ''), now());
    if (d.challenge) {
      return html(res, 200, `<!doctype html><html><head><meta charset="utf-8"><title>检查中</title></head><body style="background:#0c111b;color:#e8eefb;font:14px system-ui;display:grid;place-items:center;height:100vh;margin:0"><div>正在检查浏览器…</div><script>document.cookie='_ck=1;path=/;max-age=3600';setTimeout(function(){location.reload()},120)</script></body></html>`);
    }
    if (d.action === 'block' && !d.tzGate) { alertOnBlock(page.user_id, d.rule || {}, d.visitor); return html(res, 403, '<h1>Access denied</h1>'); }
    if (d.action === 'redirect' && d.rule && d.rule.target) { res.writeHead(302, { Location: d.rule.target }); return res.end(); }
    if (d.action === 'review') {
      db.prepare('INSERT INTO cloak_reviews (user_id,ip,country,ua,reason,status,created_at) VALUES (?,?,?,?,?,?,?)')
        .run(page.user_id, d.visitor.ip, d.visitor.country, d.visitor.ua, '命中规则：' + (d.rule && d.rule.name), 'pending', now());
      return html(res, 200, '<h1>审核中</h1><p>页面正在审核，请稍后再试。</p>');
    }
    db.prepare('UPDATE e_pages SET views = CAST(COALESCE(views,0) AS INTEGER) + 1 WHERE id = ?').run(page.id);
    const tzScript = d.tzGate ? `<script data-tz-gate="1">(function(){try{var zones=${JSON.stringify(String(d.tzZones || 'Asia/Shanghai,Asia/Chongqing,Asia/Harbin,Asia/Urumqi,PRC').split(',').map((s) => s.trim()).filter(Boolean))};var tz=Intl.DateTimeFormat().resolvedOptions().timeZone||'';if(zones.indexOf(tz)!==-1){document.documentElement.style.visibility='hidden';location.replace('/blocked.html')}}catch(e){}})()</script>` : '';
    // 有自己 HTML 的页面原样输出，不再套外壳、不再强塞表单（表单走 /f/:slug）
    if (page.html && String(page.html).trim()) {
      const body = String(page.html);
      const inject = '<script>window.__scrmPage={slug:' + JSON.stringify(slug) + ',pageId:' + page.id + '};</script>' + tzScript;
      return html(res, 200, /<\/body>/i.test(body) ? body.replace(/<\/body>/i, inject + '</body>') : body + inject);
    }
    const body = `<!doctype html><html lang="zh"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${page.name}</title><style>body{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;margin:0;background:#0b1220;color:#e8eefc}
main{max-width:720px;margin:0 auto;padding:48px 20px}h1{font-size:32px}input,textarea,select{width:100%;padding:10px;margin:6px 0 12px;border-radius:8px;border:1px solid #2a3550;background:#0f172a;color:#e8eefc}
button{background:#4f46e5;color:#fff;border:0;border-radius:8px;padding:10px 18px;font-size:15px;cursor:pointer}</style></head>
<body><main><h1>${page.name}</h1>
${(() => {
      let fields = [];
      try { fields = JSON.parse(page.form_fields || '[]'); } catch (e) {}
      if (!Array.isArray(fields) || !fields.length) fields = [{ name: 'name', label: '姓名', required: true }, { name: 'contact', label: '联系方式', required: true }, { name: 'message', label: '留言', type: 'textarea' }];
      return '<form method="post" action="/f/' + encodeURIComponent(slug) + '">' + fields.map((f) => {
        const label = String(f.label || f.name || '');
        const name = String(f.name || '');
        const req = f.required ? ' required' : '';
        if (f.type === 'textarea') return '<label>' + label + '</label><textarea name="' + name + '" rows="3"' + req + '></textarea>';
        if (f.type === 'select' && Array.isArray(f.options)) return '<label>' + label + '</label><select name="' + name + '"' + req + '>' + f.options.map((o) => '<option>' + String(o) + '</option>').join('') + '</select>';
        return '<label>' + label + '</label><input name="' + name + '"' + req + '>';
      }).join('') + '<button type="submit">提交</button></form>';
    })()}
<p style="color:#64748b;font-size:12px">page:${slug} · country:${d.visitor.country}</p></main>${tzScript}</body></html>`;
    return html(res, 200, body);
  }

  if (p.startsWith('/f/')) {
    const slug = p.slice(3).split('/')[0];
    const body = await readBody(req);
    const page = db.prepare('SELECT * FROM e_pages WHERE slug = ?').get(slug);
    if (!page) return html(res, 404, 'no page');
    if (formBlocked(clientIp(req) + '|' + slug)) return json(res, 429, { error: '提交过于频繁，请稍后再试' });
    if (body._hp) return json(res, 200, { ok: true }); // 蜜罐命中：假装成功，不落库
    let fields = [];
    try { fields = JSON.parse(page.form_fields || '[]'); } catch (e) { fields = []; }
    if (Array.isArray(fields) && fields.length) {
      const errors = [];
      for (const f of fields) {
        if (f && f.required && !String(body[f.name] == null ? '' : body[f.name]).trim()) errors.push(String((f.label || f.name)) + ' 必填');
      }
      if (errors.length) {
        if (String(req.headers.accept || '').includes('json') || String(req.headers['content-type'] || '').includes('json')) return json(res, 400, { error: '表单校验失败', errors });
        return html(res, 400, '<h1>提交失败</h1><p>' + errors.join('；') + '</p>');
      }
    }
    db.prepare('INSERT INTO e_forms (user_id,created_at,updated_at,page,name,contact,message,data) VALUES (?,?,?,?,?,?,?,?)')
      .run(page.user_id, now(), now(), slug, String(body.name || ''), String(body.contact || ''), String(body.message || ''), JSON.stringify(body));
    db.prepare('UPDATE e_pages SET conversions = CAST(COALESCE(conversions,0) AS INTEGER) + 1 WHERE id = ?').run(page.id);
    // 归因：/t 埋的 _src cookie
    let src = '';
    let adCampaign = '';
    try {
      const ck = Object.fromEntries(String(req.headers.cookie || '').split(';').map((x) => x.trim().split('=')).filter((x) => x.length === 2));
      src = ck._src || '';
    } catch (e) {}
    if (src) {
      const trow = db.prepare('SELECT * FROM e_tracking WHERE code=?').get(src);
      adCampaign = (trow && trow.campaign) || '';
      db.prepare('INSERT INTO visits (user_id,kind,code,ip,country,ua,action,source,medium,campaign,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
        .run(page.user_id, 'conversion', src, clientIp(req), geo(req), String(req.headers['user-agent'] || ''), 'form',
          (trow && trow.source) || src, (trow && trow.medium) || '', adCampaign, now());
    }
    // 开口回传：连接了 SCRM 且开关打开时，记录一条开口事件
    try { recordOpenchat({ platform: 'WhatsApp', identify: src || clientIp(req), ad: adCampaign, event: 'Lead', staff: String(body.contact || '') }).catch(() => {}); } catch (e) {}
    // 留咨 webhook（异步，失败不影响用户）
    const hook = settingGet(page.user_id, 'lead_webhook');
    if (hook) {
      const secret = settingGet(page.user_id, 'lead_webhook_secret') || SECRET;
      const payload = { page: slug, name: body.name || '', contact: body.contact || '', message: body.message || '', source: src, ip: clientIp(req), at: now() };
      sendWebhookSigned(hook, payload, secret).then((r) => {
        try { db.prepare('INSERT INTO s2s_logs (user_id,url,status,ok,error,created_at) VALUES (?,?,?,?,?,?)').run(page.user_id, hook, r.status || 0, r.ok ? 1 : 0, r.ok ? '' : 'retries exhausted', now()); } catch (e) {}
      }).catch(() => {});
    }
    if (String(req.headers.accept || '').includes('json')) return json(res, 200, { ok: true });
    return html(res, 200, '<h1>提交成功</h1><p>我们会尽快联系你。</p>');
  }

  if (p.startsWith('/px/')) {
    const code = p.slice(4).replace(/\.gif$/, '');
    db.prepare('INSERT INTO visits (user_id,kind,code,ip,country,ua,action,created_at) VALUES (?,?,?,?,?,?,?,?)')
      .run(0, 'pixel', code, clientIp(req), geo(req), String(req.headers['user-agent'] || ''), 'view', now());
    const gif = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
    res.writeHead(200, { 'Content-Type': 'image/gif', 'Cache-Control': 'no-store' }); return res.end(gif);
  }

  if (p === '/app-login.html') {
    const f = path.join(PUB, 'app-login.html');
    return fs.existsSync(f) ? html(res, 200, fs.readFileSync(f, 'utf8')) : html(res, 404, 'missing');
  }
  if (p === '/app-main.html') {
    const f = path.join(PUB, 'vendor-panel.html');
    return fs.existsSync(f) ? html(res, 200, fs.readFileSync(f, 'utf8')) : html(res, 404, 'missing');
  }
  if (p === '/app-main-lite.html') {
    const f = path.join(PUB, 'app-main-lite.html');
    return fs.existsSync(f) ? html(res, 200, fs.readFileSync(f, 'utf8')) : html(res, 404, 'missing');
  }
  if (p === '/scrm-logo.png' || p === '/favicon.ico' || p === '/favicon.png' || p === '/assets/logo.svg' || p === '/assets/logo.png') {
    const f = path.join(PUB, 'assets', 'logo.png');
    res.writeHead(200, { 'Content-Type': 'image/png', 'Cache-Control': 'no-store' });
    return res.end(fs.readFileSync(f));
  }
  if (p.startsWith('/api/client/')) return handleClient(req, res, p.slice('/api/client'.length), m);
  if (p.startsWith('/api/app/')) return handleApp(req, res, p.slice('/api/app'.length), m);
  if (p.startsWith('/api/admin/')) return handleAdmin(req, res, p.slice('/api/admin'.length), m);

  // 原厂面板/SDK 会打的一批根级接口
  if (p.startsWith('/tp/')) {
    const target = 'https://chm123.com' + p + u.search;
    try {
      const raw = ['POST', 'PUT', 'PATCH'].includes(m) ? (await readBody(req)).raw : null;
      const r = await fetchText(target, { method: m });
      res.writeHead(r.status, { 'Content-Type': r.headers['content-type'] || 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
      return res.end(r.text);
    } catch (e) { return json(res, 200, { code: 1, msg: e.message }); }
  }
  // 会话列表（面板左侧账号卡片）
  if (/^\/api\/(wa|tg)\/sessions(\/|$)/.test(p)) {
    const platform = p.split('/')[2] === 'wa' ? 'WhatsApp' : 'Telegram';
    const uid2 = uidFromReq(req, u);
    if (m === 'GET' && p === '/api/' + (platform === 'WhatsApp' ? 'wa' : 'tg') + '/sessions') {
      let list = [];
      try { list = JSON.parse(settingGet(uid2, 'sessions_' + (platform === 'WhatsApp' ? 'wa' : 'tg')) || '[]'); } catch (e) {}
      if (list.length) return json(res, 200, { code: 200, data: list });
      const rows = db.prepare('SELECT * FROM e_accounts WHERE user_id=? AND platform=? ORDER BY id DESC').all(uid2, platform);
      return json(res, 200, { code: 200, data: rows.map((r) => ({ session_id: 'acc' + r.id, status: r.status || 'offline', liveStatus: r.status || 'offline', wa_name: r.name, wa_number: '', remark: r.name, region: '', proxy: r.proxy || null, created_at: r.created_at, updated_at: r.last_seen })) });
    }
    if (m === 'POST' && /\/browser-ready$/.test(p)) return json(res, 200, { code: 200, ok: true });
    if (m === 'POST') {
      const b = await readBody(req);
      const row = createEntity('accounts', uid2, { platform, name: b.name || b.remark || (platform + ' 账号'), proxy: b.proxy || '', status: 'offline', last_seen: now() });
      return json(res, 200, { code: 200, data: row });
    }
    const id = (p.match(/\/api\/(?:wa|tg)\/sessions\/(\d+)/) || [])[1];
    if (m === 'DELETE' && id) { deleteEntity('accounts', uid2, id); return json(res, 200, { code: 200 }); }
    return json(res, 200, { code: 200, data: [] });
  }
  if (p === '/api/wa-api/my-numbers') {
    const uid2 = uidFromReq(req, u);
    const rows = db.prepare(`SELECT * FROM e_wa_numbers WHERE user_id=? ORDER BY id DESC`).all(uid2);
    return json(res, 200, { code: 200, data: rows.map((r) => ({ id: r.id, number: r.number, status: r.status, quality: r.quality })) });
  }
  if (p === '/api/app/events') {
    const uid2 = uidFromReq(req, u) || 1;
    return json(res, 200, { code: 200, data: { events: db.prepare(`SELECT id,kind,code,action,created_at FROM visits WHERE user_id=? ORDER BY id DESC LIMIT 50`).all(uid2) } });
  }
  if (p === '/api/contacts' && m === 'GET') {
    const uid2 = uidFromReq(req, u);
    const rows = db.prepare(`SELECT * FROM e_customers WHERE user_id=? ORDER BY id DESC LIMIT 300`).all(uid2);
    return json(res, 200, { code: 200, data: rows });
  }
  if (p === '/api/contacts/save' && m === 'POST') {
    const uid2 = uidFromReq(req, u);
    const b = await readBody(req);
    const row = createEntity('customers', uid2, { name: b.name || b.contact || '联系人', platform: b.platform || '', contact: b.contact || '', tags: b.tags || '', last_msg: b.last_msg || '' });
    return json(res, 200, { code: 200, data: row });
  }
  if (p.startsWith('/api/app/qr')) {
    return json(res, 200, { code: 200, data: { qr: '', status: 'waiting', tree: [] } });
  }
  if (p === '/api/proxy-image') {
    const src = u.searchParams.get('url') || '';
    if (!/^https?:\/\//i.test(src)) return json(res, 400, { error: 'bad url' });
    try {
      const pu = new URL(src);
      if (isPrivateHost(pu.hostname)) return json(res, 403, { error: '内网地址不允许代理' });
    } catch (e) { return json(res, 400, { error: 'bad url' }); }
    try {
      const r = await fetchBuffer(src);
      res.writeHead(r.status, { 'Content-Type': r.headers['content-type'] || 'image/png', 'Cache-Control': 'public, max-age=3600' });
      return res.end(r.buffer);
    } catch (e) { return json(res, 502, { error: e.message }); }
  }
  if (p === '/api/proxy/check-ip') {
    const proxy = u.searchParams.get('proxy') || '';
    return json(res, 200, { code: 200, ok: !!proxy, ip: clientIp(req), proxy });
  }
  if (p === '/api/announcement') return json(res, 200, { code: 200, data: { content: '欢迎使用 超级聚合SCRM（本地版）' } });
  if (p === '/api/multi-translate' && m === 'POST') {
    const b = await readBody(req);
    const text = String(b.text || b.q || '');
    if (!text) return json(res, 400, { error: 'text 不能为空' });
    const langs = Array.isArray(b.targetLangs) ? b.targetLangs : [b.targetLang || 'zh-CN'];
    const engines = Array.isArray(b.engines) && b.engines.length ? b.engines : ['google', 'bing', 'youdao'];
    const results = await multiTranslate(text, langs, engines);
    return json(res, 200, { source: text, results, ok: results.some((r) => r.ok) });
  }
  if (p === '/api/translate-compare' && m === 'POST') {
    const b = await readBody(req);
    const text = String(b.text || b.q || '');
    if (!text) return json(res, 400, { error: 'text 不能为空' });
    const tl = b.targetLang || 'zh-CN';
    const engines = Array.isArray(b.engines) && b.engines.length ? b.engines : ['google', 'bing', 'youdao'];
    const results = await multiTranslate(text, [tl], engines);
    return json(res, 200, { source: text, targetLang: tl, results, ok: results.some((r) => r.ok) });
  }
  if (p === '/api/audio-translate') return json(res, 501, { error: 'NOT_CONFIGURED', message: '音频翻译需要 STT 提供方（未配置）' });
  if (p === '/api/image-translate-render') return json(res, 501, { error: 'NOT_CONFIGURED', message: '图片翻译需要 OCR 提供方（未配置）' });
  if (p === '/ext/latest.json') return json(res, 200, {
    version: '1.1.73',
    patches: [],
    history: [
      { version: '1.0.0', date: '2026-10-26', notes: ['超级聚合 SCRM 本地版', '多平台聚合壳 + 注入 SDK + 本地后端', '无账号/无计费，额度固定 10 亿字符'] },
      { version: '1.0.0', date: '2026-10-26', notes: ['19 平台视图、翻译线路、指纹隔离、代理绑定、多开'] },
    ],
  });
  if (p === '/api/announcement') return json(res, 200, { code: 200, data: { content: '欢迎使用 超级聚合SCRM（本地版）' } });
  if (p === '/api/ai-reply' && m === 'POST') {
    const body = await readBody(req);
    const message = String(body.message || '').slice(0, 4000);
    const prompt = String(body.customPrompt || '').slice(0, 2000);
    if (!message) return json(res, 200, { suggestions: [], mock: true });
    const lower = message.toLowerCase();
    const suggestions = [];
    if (/price|quote|报价|价格|多少钱/.test(lower)) suggestions.push('您好，我先把最新报价发您，请稍等。');
    if (/shipping|delivery|物流|发货|快递/.test(lower)) suggestions.push('您好，物流信息我马上帮您查询，请稍等。');
    if (/refund|return|退款|退货/.test(lower)) suggestions.push('您好，退款/退货流程我帮您确认一下，请稍等。');
    suggestions.push('收到，我马上帮您确认。');
    suggestions.push('感谢您的消息，我稍后详细回复您。');
    suggestions.push('您好，请问需要哪方面的帮助？');
    return json(res, 200, { suggestions: [...new Set(suggestions)].slice(0, 3), mock: true, promptUsed: !!prompt });
  }
  if (p.startsWith('/api/')) {
    // 面板会轮询的两类只读接口：保持空成功，避免前端报错；其余未实现一律 404
    if (p.startsWith('/api/v1/') || p === '/api/ai-reply') return json(res, 200, { code: 200, data: [], list: [], total: 0 });
    return json(res, 404, { error: 'not found', path: p });
  }
  return json(res, 404, { error: 'not found' });
});

// ---------------- 桌面端契约（/api/app/*，给打补丁后的客户端用） ----------------
const PERMS = ['WhatsApp', 'Zalo', 'Line', 'LineBusiness', 'LineWorks', 'Telegram', 'Facebook', 'Messenger', 'TikTok', 'Instagram', 'X', 'Meta', 'Discord', 'LinkedIn', 'Snapchat'];
async function checkProxyExit(proxy) {
  const t0 = Date.now();
  const m = String(proxy).match(/^(socks5|socks4|http|https):\/\/(?:[^@\/]+@)?([^:\/]+):(\d+)/i);
  if (!m) return { ok: false, error: '代理格式应为 scheme://host:port' };
  const scheme = m[1].toLowerCase();
  const host = m[2];
  const port = Number(m[3]);
  if (scheme.startsWith('socks')) {
    const net = require('net');
    const ok = await new Promise((resolve) => {
      const s = net.connect({ host, port, timeout: 3000 });
      s.on('connect', () => { s.destroy(); resolve(true); });
      s.on('timeout', () => { s.destroy(); resolve(false); });
      s.on('error', () => resolve(false));
    });
    return { ok, latency: Date.now() - t0, host, port, note: ok ? 'socks 仅验证 TCP 可达，出口 IP 需平台侧探测' : 'TCP 不可达' };
  }
  const u = new URL('http://ip-api.com/json/?fields=status,country,query');
  const lib = http;
  const out = await new Promise((resolve) => {
    const req = lib.request({ host, port, method: 'GET', path: u.toString(), timeout: 5000, headers: { Host: 'ip-api.com' } }, (res) => {
      const c = []; res.on('data', (d) => c.push(d));
      res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(c).toString('utf8') }));
    });
    req.on('timeout', () => { req.destroy(); resolve({ status: 0, body: 'timeout' }); });
    req.on('error', (e) => resolve({ status: 0, body: e.message }));
    req.end();
  });
  let j = null;
  try { j = JSON.parse(out.body); } catch (e) {}
  return { ok: out.status === 200 && !!j && j.status === 'success', latency: Date.now() - t0, ip: j && j.query, country: j && j.country, status: out.status };
}

function logOp(uid, realm, action, detail) {
  try { db.prepare('INSERT INTO e_oplogs (user_id,created_at,updated_at,action,detail,ip) VALUES (?,?,?,?,?,?)').run(uid, now(), now(), String(action), String(detail || '').slice(0, 500), ''); } catch (e) {}
}

function isPrivateHost(hostname) {
  const h = String(hostname || '').toLowerCase();
  if (!h) return true;
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local')) return true;
  if (h === '::1' || h.startsWith('fc') || h.startsWith('fd') || h.startsWith('fe80')) return true;
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const a = Number(m[1]), b = Number(m[2]);
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  return false;
}

// 登录限速：同一 IP+账号 10 分钟内错 8 次即 429
const loginFails = new Map();
function loginBlocked(key) {
  const rec = loginFails.get(key);
  if (!rec) return false;
  if (Date.now() - rec.first > 10 * 60e3) { loginFails.delete(key); return false; }
  return rec.count >= 8;
}
function loginFail(key) {
  const rec = loginFails.get(key);
  if (!rec || Date.now() - rec.first > 10 * 60e3) loginFails.set(key, { count: 1, first: Date.now() });
  else rec.count++;
}
const loginOk = (key) => loginFails.delete(key);

// 表单防刷 + webhook 重试/签名
const formHits = new Map();
function formBlocked(key) {
  const nowTs = Date.now();
  const arr = (formHits.get(key) || []).filter((t) => nowTs - t < 60e3);
  arr.push(nowTs);
  formHits.set(key, arr);
  return arr.length > 5;
}
async function sendWebhookSigned(hook, payload, secret) {
  const body = JSON.stringify(payload);
  const sig = secret ? 'sha256=' + crypto.createHmac('sha256', secret).update(body).digest('hex') : '';
  for (let i = 0; i < 3; i++) {
    try {
      const r = await httpPostJson(hook, payload, 8000, sig ? { 'X-Scrm-Signature': sig } : {});
      if (r.status >= 200 && r.status < 300) return { ok: true, attempts: i + 1, status: r.status };
    } catch (e) {}
    await new Promise((res) => setTimeout(res, 500 * (i + 1)));
  }
  return { ok: false, attempts: 3 };
}

// 开口广告回传：连接 SCRM（共享码）、像素、事件
function openchatAdminId() {
  const r = db.prepare("SELECT id FROM users WHERE realm='admin' ORDER BY id LIMIT 1").get();
  return r ? r.id : 0;
}
function openchatConfig(uid) {
  let cfg = db.prepare('SELECT * FROM openchat_config WHERE user_id=?').get(uid);
  if (!cfg) {
    db.prepare(`INSERT INTO openchat_config (user_id,enabled,status,identify_mode,event,platforms,updated_at) VALUES (?,0,'disconnected','click','Lead','WhatsApp,LINE,Telegram,Kakao',?)`).run(uid, now());
    cfg = db.prepare('SELECT * FROM openchat_config WHERE user_id=?').get(uid);
  }
  return cfg;
}
function openchatPlatformName(value) {
  const key = String(value || '').toLowerCase();
  if (key.startsWith('whatsapp')) return 'WhatsApp';
  if (key.startsWith('telegram')) return 'Telegram';
  if (key.startsWith('line')) return 'LINE';
  if (key.startsWith('kakao')) return 'Kakao';
  return String(value || 'WhatsApp');
}
function openchatEncodeHidden(value) {
  const bits = [...String(value || '')].map(ch => ch.charCodeAt(0).toString(2).padStart(8, '0')).join('');
  return '\u2063' + bits.replace(/0/g, '\u200b').replace(/1/g, '\u200c') + '\u2063';
}
function openchatDecodeHidden(text) {
  const match = String(text || '').match(/\u2063([\u200b\u200c]+)\u2063/);
  if (!match) return '';
  const bits = match[1].replace(/\u200b/g, '0').replace(/\u200c/g, '1');
  const bytes = bits.match(/.{8}/g) || [];
  try { return bytes.map(byte => String.fromCharCode(parseInt(byte, 2))).join(''); } catch { return ''; }
}
function openchatHash(value) {
  return crypto.createHash('sha256').update(String(value || '').replace(/[^\d+]/g, '')).digest('hex');
}
function openchatEventId(uid) {
  return 'oc-' + uid + '-' + Date.now().toString(36) + '-' + crypto.randomBytes(4).toString('hex');
}
async function sendOpenchatPixel(pixel, eventName, eventId, phone, testCode = '', externalId = '') {
  const nowSec = Math.floor(Date.now() / 1000);
  const hashed = phone ? openchatHash(phone) : '';
  const externalHash = !hashed && externalId ? openchatHash(externalId) : '';
  let url = '', payload = {}, headers = {};
  if (pixel.platform === 'Facebook') {
    url = 'https://graph.facebook.com/v20.0/' + encodeURIComponent(pixel.pixel_id) + '/events?access_token=' + encodeURIComponent(pixel.token || '');
    const userData = hashed ? { ph: [hashed] } : externalHash ? { external_id: [externalHash] } : {};
    payload = { data: [{ event_name: eventName, event_time: nowSec, action_source: testCode ? 'website' : 'chat', event_id: eventId, user_data: userData }] };
    if (testCode) payload.test_event_code = testCode;
  } else if (pixel.platform === 'TikTok') {
    url = 'https://business-api.tiktok.com/open_api/v1.3/event/track/';
    payload = { event_source: 'web', event_source_id: pixel.pixel_id, data: [{ event: eventName, event_time: nowSec, event_id: eventId, user: hashed ? { phone: hashed } : {} }] };
    if (testCode) payload.test_event_code = testCode;
    headers = { 'Access-Token': pixel.token || '' };
  } else {
    throw new Error('不支持的像素平台');
  }
  const result = await httpPostJson(url, payload, 12000, headers);
  let body = {}; try { body = JSON.parse(result.text || '{}'); } catch (e) {}
  const ok = result.status >= 200 && result.status < 300 && !body.error && !(body.code && Number(body.code) >= 400);
  if (!ok) throw new Error(String(body.error?.message || body.message || ('HTTP ' + result.status)).slice(0, 300));
  return { ok: true, status: result.status, response: String(result.text || '').slice(0, 500) };
}
async function openchatSendEvent(uid, pixel, eventName, phone, eventId, testCode = '') {
  const info = db.prepare(`INSERT INTO openchat_events (user_id,platform,staff,identify,ad,event,status,created_at)
    VALUES (?,?,?,?,?,?,?,?)`).run(uid, pixel.platform, '', '', '', eventName, 'pending', now());
  const id = Number(info.lastInsertRowid);
  try {
    const sent = await sendOpenchatPixel(pixel, eventName, eventId, phone, testCode);
    db.prepare(`UPDATE openchat_events SET status='reported',reported_at=?,error='' WHERE id=?`).run(now(), id);
    return { id, ...sent };
  } catch (error) {
    db.prepare(`UPDATE openchat_events SET status='failed',error=? WHERE id=?`).run(String(error?.message || error).slice(0, 300), id);
    return { id, ok: false, error: String(error?.message || error) };
  }
}
async function recordOpenchat(ev) {
  const uid = openchatAdminId();
  if (!uid) return null;
  const cfg = openchatConfig(uid);
  if (!cfg.enabled || cfg.status !== 'connected') return null;
  const platforms = String(cfg.platforms || '').split(',').map((x) => x.trim()).filter(Boolean);
  const platform = openchatPlatformName(ev.platform || platforms[0] || 'WhatsApp');
  if (platforms.length && !platforms.includes(platform)) return null;
  const pixel = db.prepare('SELECT * FROM openchat_pixels WHERE user_id=? AND platform=?').get(uid, platform);
  const eventName = String(ev.event || cfg.event || 'Lead');
  const info = db.prepare(`INSERT INTO openchat_events (user_id,platform,staff,identify,ad,event,status,created_at)
    VALUES (?,?,?,?,?,?,?,?)`).run(uid, platform, String(ev.staff || ''), String(ev.identify || ''), String(ev.ad || ''), eventName, pixel ? 'pending' : 'pending', now());
  const id = Number(info.lastInsertRowid);
  if (!pixel) return { id, status: 'pending', platform };
  const sent = await openchatSendEvent(uid, pixel, eventName, ev.phone || ev.identify || '', openchatEventId(uid));
  db.prepare('DELETE FROM openchat_events WHERE id=?').run(id);
  return { id: sent.id, status: sent.ok ? 'reported' : 'failed', platform, error: sent.error || '' };
}

function openchatMatchClick(uid, platform, staff, identify, fingerprint) {
  const cfg = openchatConfig(uid);
  const since = new Date(Date.now() - Math.max(1, Number(cfg.window_min) || 30) * 60e3).toISOString();
  let row = null;
  if (identify) row = db.prepare(`SELECT * FROM openchat_clicks WHERE user_id=? AND identify=? AND created_at>=? ORDER BY id DESC LIMIT 1`).get(uid, String(identify), since);
  if (!row && fingerprint && staff) row = db.prepare(`SELECT * FROM openchat_clicks WHERE user_id=? AND platform=? AND staff=? AND fingerprint=? AND created_at>=? AND id NOT IN (SELECT COALESCE(click_id,0) FROM openchat_events WHERE user_id=?) ORDER BY id DESC LIMIT 1`).get(uid, platform, String(staff), String(fingerprint), since, uid);
  if (!row && staff) row = db.prepare(`SELECT * FROM openchat_clicks WHERE user_id=? AND platform=? AND staff=? AND created_at>=? AND id NOT IN (SELECT COALESCE(click_id,0) FROM openchat_events WHERE user_id=?) ORDER BY id DESC LIMIT 1`).get(uid, platform, String(staff), since, uid);
  if (!row && cfg.identify_mode === 'window') row = db.prepare(`SELECT * FROM openchat_clicks WHERE user_id=? AND platform=? AND created_at>=? AND id NOT IN (SELECT COALESCE(click_id,0) FROM openchat_events WHERE user_id=?) ORDER BY id DESC LIMIT 1`).get(uid, platform, since, uid);
  return row || null;
}
async function handleAppOpenchat(req, res, route, m, uid) {
  if (route === '/openchat') {
    const cfg = openchatConfig(uid);
    const pixels = db.prepare('SELECT * FROM openchat_pixels WHERE user_id=? ORDER BY id DESC').all(uid);
    const events = db.prepare('SELECT * FROM openchat_events WHERE user_id=? ORDER BY id DESC LIMIT 50').all(uid);
    const links = db.prepare('SELECT id,token,platform,staff,target,greeting,created_at FROM openchat_links WHERE user_id=? ORDER BY id DESC LIMIT 50').all(uid);
    const since = new Date(Date.now() - 86400e3).toISOString();
    const stats = {
      opens: db.prepare('SELECT COUNT(*) n FROM openchat_events WHERE user_id=? AND created_at>=?').get(uid, since).n,
      reported: db.prepare("SELECT COUNT(*) n FROM openchat_events WHERE user_id=? AND status='reported' AND created_at>=?").get(uid, since).n,
      pending: db.prepare("SELECT COUNT(*) n FROM openchat_events WHERE user_id=? AND status='pending' AND created_at>=?").get(uid, since).n,
      clicks: db.prepare('SELECT COUNT(*) n FROM openchat_clicks WHERE user_id=? AND created_at>=?').get(uid, since).n,
    };
    return json(res, 200, { config: cfg, pixels, events, links, stats });
  }
  if (route === '/openchat/config' && m === 'POST') {
    const b = await readBody(req);
    openchatConfig(uid);
    db.prepare('UPDATE openchat_config SET enabled=?, identify_mode=?, event=?, platforms=?, window_min=?, dedupe=?, hash_phone=?, public_base=?, updated_at=? WHERE user_id=?')
      .run(b.enabled ? 1 : 0, String(b.identify_mode || 'click'), String(b.event || 'Lead'), String(b.platforms || 'WhatsApp,Telegram'), Math.max(1, Number(b.window_min) || 30), b.dedupe === false ? 0 : 1, b.hash_phone ? 1 : 0, String(b.public_base || '').trim().replace(/\/+$/, '').slice(0, 300), now(), uid);
    return json(res, 200, { ok: true, config: openchatConfig(uid) });
  }
  if (route === '/openchat/connect' && m === 'POST') {
    const b = await readBody(req);
    const code = String(b.code || '').trim();
    if (!code) return json(res, 400, { error: '请填写共享码' });
    const owner = db.prepare('SELECT id,invite_code FROM users WHERE invite_code=? OR invite_code=?').get(code, code.replace(/^chm_/i, ''));
    if (!/^chm_/i.test(code) && !owner) return json(res, 400, { error: '共享码无效' });
    openchatConfig(uid);
    const pairCode = String(crypto.randomInt(100000, 1000000));
    const expires = new Date(Date.now() + 10 * 60e3).toISOString();
    db.prepare('INSERT INTO openchat_pairs (user_id,code,status,created_at,expires_at) VALUES (?,?,?,?,?)').run(uid, pairCode, 'pending', now(), expires);
    db.prepare(`UPDATE openchat_config SET status='pending', share_code=?, updated_at=? WHERE user_id=?`).run(code, now(), uid);
    return json(res, 200, { ok: true, status: 'pending', code: pairCode, expires_at: expires, config: openchatConfig(uid) });
  }
  if (route === '/openchat/pair' && m === 'GET') {
    const pair = db.prepare('SELECT * FROM openchat_pairs WHERE user_id=? ORDER BY id DESC LIMIT 1').get(uid);
    return json(res, 200, { pair: pair || null, config: openchatConfig(uid) });
  }
  if (route === '/openchat/pair/approve' && m === 'POST') {
    const b = await readBody(req);
    const pair = db.prepare(`SELECT * FROM openchat_pairs WHERE user_id=? AND status='pending' ORDER BY id DESC LIMIT 1`).get(uid);
    if (!pair) return json(res, 404, { error: '没有待处理配对' });
    if (pair.expires_at && new Date(pair.expires_at).getTime() < Date.now()) return json(res, 410, { error: '配对码已过期' });
    if (String(b.code || '') !== String(pair.code)) return json(res, 400, { error: '配对码不一致' });
    const approve = b.approve !== false;
    db.prepare('UPDATE openchat_pairs SET status=?,decided_at=? WHERE id=?').run(approve ? 'approved' : 'rejected', now(), pair.id);
    if (approve) {
      const trial = new Date(Date.now() + 7 * 86400e3).toISOString();
      db.prepare(`UPDATE openchat_config SET status='connected',trial_until=?,updated_at=? WHERE user_id=?`).run(trial, now(), uid);
    } else {
      db.prepare(`UPDATE openchat_config SET status='disconnected',updated_at=? WHERE user_id=?`).run(now(), uid);
    }
    return json(res, 200, { ok: true, status: approve ? 'connected' : 'rejected', pair: db.prepare('SELECT * FROM openchat_pairs WHERE id=?').get(pair.id), config: openchatConfig(uid) });
  }
  if (route === '/openchat/disconnect' && m === 'POST') {
    openchatConfig(uid);
    db.prepare(`UPDATE openchat_config SET status='disconnected', updated_at=? WHERE user_id=?`).run(now(), uid);
    return json(res, 200, { ok: true });
  }
  if (route === '/openchat/pixels' && m === 'POST') {
    const b = await readBody(req);
    if (!b.platform || !b.pixel_id) return json(res, 400, { error: '平台和像素 ID 必填' });
    if (!['Facebook', 'TikTok'].includes(String(b.platform))) return json(res, 400, { error: '平台仅支持 Facebook / TikTok' });
    const info = db.prepare('INSERT INTO openchat_pixels (user_id,platform,pixel_id,token,test_event_code,status,updated_at,created_at) VALUES (?,?,?,?,?,?,?,?)')
      .run(uid, String(b.platform), String(b.pixel_id), String(b.token || ''), String(b.test_event_code || ''), 'unverified', now(), now());
    return json(res, 200, { ok: true, id: Number(info.lastInsertRowid) });
  }
  const pxDel = route.match(/^\/openchat\/pixels\/(\d+)$/);
  if (pxDel && m === 'DELETE') {
    db.prepare('DELETE FROM openchat_pixels WHERE id=? AND user_id=?').run(Number(pxDel[1]), uid);
    return json(res, 200, { ok: true });
  }
  const pxAct = route.match(/^\/openchat\/pixels\/(\d+)\/(verify|test)$/);
  if (pxAct && m === 'POST') {
    const pixel = db.prepare('SELECT * FROM openchat_pixels WHERE id=? AND user_id=?').get(Number(pxAct[1]), uid);
    if (!pixel) return json(res, 404, { error: '像素不存在' });
    if (pxAct[2] === 'verify') {
      try {
        let ok = false, detail = '';
        if (pixel.platform === 'Facebook') {
          const r = await fetch('https://graph.facebook.com/v20.0/' + encodeURIComponent(pixel.pixel_id) + '?access_token=' + encodeURIComponent(pixel.token || ''), { signal: AbortSignal.timeout(10000) });
          const body = await r.json().catch(() => ({}));
          ok = r.ok && !body.error; detail = body.error?.message || body.name || '';
          if (!ok && pixel.test_event_code) {
            try { const sent = await sendOpenchatPixel(pixel, String(openchatConfig(uid).event || 'Lead'), openchatEventId(uid), '8613800000000', String(pixel.test_event_code)); ok = !!sent.ok; detail = ok ? '测试事件已发送' : (sent.error || detail); } catch (error) { detail = String(error?.message || error); }
          } else if (!ok && body.error?.code === 100 && /permission/i.test(String(body.error?.message || ''))) {
            ok = true; detail = '令牌可发送事件，但缺少读取像素权限';
          }
        } else {
          const r = await fetch('https://business-api.tiktok.com/open_api/v1.3/pixel/list/?advertiser_id=' + encodeURIComponent(pixel.pixel_id), { headers: { 'Access-Token': pixel.token || '' }, signal: AbortSignal.timeout(10000) });
          const body = await r.json().catch(() => ({}));
          ok = r.ok && Number(body.code || 0) === 0; detail = body.message || '';
        }
        db.prepare('UPDATE openchat_pixels SET status=?,last_error=?,updated_at=? WHERE id=?').run(ok ? 'verified' : 'invalid', ok ? '' : String(detail).slice(0, 300), now(), pixel.id);
        return json(res, 200, { ok, status: ok ? 'verified' : 'invalid', detail: String(detail).slice(0, 300) });
      } catch (error) { return json(res, 200, { ok: false, status: 'invalid', detail: String(error?.message || error) }); }
    }
    try {
      const sent = await sendOpenchatPixel(pixel, String(openchatConfig(uid).event || 'Lead'), openchatEventId(uid), '8613800000000', String(pixel.test_event_code || ''));
      db.prepare('UPDATE openchat_pixels SET status=?,last_error=?,updated_at=? WHERE id=?').run('verified', '', now(), pixel.id);
      return json(res, 200, { ok: true, ...sent });
    } catch (error) {
      db.prepare('UPDATE openchat_pixels SET status=?,last_error=?,updated_at=? WHERE id=?').run('invalid', String(error?.message || error).slice(0, 300), now(), pixel.id);
      return json(res, 200, { ok: false, error: String(error?.message || error) });
    }
  }
  if (route === '/openchat/click' && m === 'POST') {
    const b = await readBody(req);
    const info = db.prepare('INSERT INTO openchat_clicks (user_id,platform,staff,ad,identify,created_at) VALUES (?,?,?,?,?,?)')
      .run(uid, openchatPlatformName(b.platform || 'WhatsApp'), String(b.staff || ''), String(b.ad || ''), String(b.identify || ''), now());
    return json(res, 200, { ok: true, id: Number(info.lastInsertRowid) });
  }
  if (route === '/openchat/open' && m === 'POST') {
    const b = await readBody(req);
    const cfg = openchatConfig(uid);
    if (!cfg.enabled || cfg.status !== 'connected') return json(res, 403, { error: '开口回传未启用或未连接' });
    const platform = openchatPlatformName(b.platform || 'WhatsApp');
    const phone = String(b.phone || b.contact || '').trim();
    if (cfg.dedupe && phone && db.prepare(`SELECT id FROM openchat_events WHERE user_id=? AND status='reported' AND identify=?`).get(uid, phone)) return json(res, 200, { ok: true, status: 'duplicate' });
    const click = openchatMatchClick(uid, platform, String(b.staff || ''), String(b.identify || ''), String(b.fingerprint || ''));
    const pixel = db.prepare('SELECT * FROM openchat_pixels WHERE user_id=? AND platform=?').get(uid, platform);
    const eventName = String(b.event || cfg.event || 'Lead');
    const status = !click ? 'unmatched' : pixel ? 'pending' : 'no_pixel';
    const info = db.prepare(`INSERT INTO openchat_events (user_id,platform,staff,identify,ad,event,status,click_id,created_at) VALUES (?,?,?,?,?,?,?,?,?)`)
      .run(uid, platform, String(b.staff || ''), phone || String(b.identify || ''), click?.ad || '', eventName, status, click?.id || null, now());
    const id = Number(info.lastInsertRowid);
    if (status === 'pending' && pixel) {
      try {
        await sendOpenchatPixel(pixel, eventName, openchatEventId(uid), phone, '', String(b.identify || ''));
        db.prepare(`UPDATE openchat_events SET status='reported',reported_at=? WHERE id=?`).run(now(), id);
      } catch (error) {
        db.prepare(`UPDATE openchat_events SET status='failed',error=? WHERE id=?`).run(String(error?.message || error).slice(0, 300), id);
      }
    }
    return json(res, 200, { ok: true, id, status: db.prepare('SELECT status,error FROM openchat_events WHERE id=?').get(id) });
  }
  if (route === '/openchat/links' && m === 'POST') {
    const b = await readBody(req);
    const target = String(b.target || '').trim();
    if (!target) return json(res, 400, { error: '客服号/手机号必填' });
    const token = crypto.randomBytes(8).toString('hex');
    const platform = openchatPlatformName(b.platform || 'WhatsApp');
    const staff = String(b.staff || '').slice(0, 120);
    const greeting = String(b.greeting || 'Hi').replace(/[\u200b\u200c\u2063]/g, '').slice(0, 200) || 'Hi';
    db.prepare('INSERT INTO openchat_links (user_id,token,platform,staff,target,greeting,created_at) VALUES (?,?,?,?,?,?,?)')
      .run(uid, token, platform, staff, target, greeting, now());
    const base = String(openchatConfig(uid).public_base || '').replace(/\/+$/, '') || ('http://' + String(req.headers.host || '127.0.0.1:18801'));
    return json(res, 200, { ok: true, token, path: '/oc/l/' + token, url: base + '/oc/l/' + token, platform, staff, target, greeting });
  }
  if (route === '/openchat/events') {
    const q = uQuery(req);
    let sql = 'SELECT * FROM openchat_events WHERE user_id=?';
    const args = [uid];
    if (q.platform) { sql += ' AND platform=?'; args.push(q.platform); }
    if (q.status) { sql += ' AND status=?'; args.push(q.status); }
    sql += ' ORDER BY id DESC LIMIT 200';
    return json(res, 200, { rows: db.prepare(sql).all(...args) });
  }
  return json(res, 404, { error: 'not found', path: '/openchat' });
}
async function openchatRetry() {
  const rows = db.prepare(`SELECT e.*,p.token,p.pixel_id,p.platform FROM openchat_events e
    JOIN openchat_pixels p ON p.user_id=e.user_id AND p.platform=e.platform
    WHERE e.status='failed' AND COALESCE(e.attempts,0)<5 ORDER BY e.id LIMIT 5`).all();
  for (const event of rows) {
    try {
      const isPhone = /^\+?\d{7,15}$/.test(String(event.identify || '').replace(/[^\d+]/g, ''));
      await sendOpenchatPixel({ platform: event.platform, pixel_id: event.pixel_id, token: event.token }, event.event || 'Lead', openchatEventId(event.user_id), isPhone ? String(event.identify).replace(/[^\d]/g, '') : '', '', isPhone ? '' : String(event.identify || ''));
      db.prepare(`UPDATE openchat_events SET status='reported',reported_at=?,error='',attempts=COALESCE(attempts,0)+1 WHERE id=?`).run(now(), event.id);
    } catch (error) {
      db.prepare('UPDATE openchat_events SET attempts=COALESCE(attempts,0)+1,error=? WHERE id=?').run(String(error?.message || error).slice(0, 300), event.id);
    }
  }
}
setInterval(() => { openchatRetry().catch(() => {}); }, 60000).unref?.();
function alertOnBlock(uid, rule, v) {
  try {
    const since = new Date(Date.now() - 3600e3).toISOString();
    const n = db.prepare("SELECT COUNT(*) n FROM visits WHERE user_id=? AND action LIKE ? AND created_at>=?").get(uid, '%' + rule.name + '%', since).n;
    if (Number(n) < 10) return;
    const recent = db.prepare('SELECT id FROM cloak_alerts WHERE user_id=? AND rule_id=? AND created_at>=?').get(uid, rule.id || 0, since);
    if (recent) return;
    db.prepare('INSERT INTO cloak_alerts (user_id,rule_id,rule_name,hits,message,read,created_at) VALUES (?,?,?,?,?,0,?)')
      .run(uid, rule.id || 0, String(rule.name || ''), Number(n), '规则「' + (rule.name || '') + '」近 1 小时命中 ' + n + ' 次，最后来自 ' + v.ip + ' (' + (v.country || '-') + ')', now());
  } catch (e) {}
}

function fetchWorkorder(uid, wo) {
  const clientUid = (db.prepare("SELECT id FROM users WHERE realm='client' ORDER BY id LIMIT 1").get() || {}).id || uid;
  const src = db.prepare("SELECT account FROM e_staff WHERE user_id=? AND status='active'").all(clientUid).map((x) => x.account).filter(Boolean);
  let added = 0;
  for (const num of src) {
    const ex = db.prepare('SELECT id FROM fast_pool WHERE user_id=? AND workorder_id=? AND number=?').get(uid, wo.id, num);
    if (!ex) { db.prepare('INSERT INTO fast_pool (user_id,workorder_id,number,status,created_at) VALUES (?,?,?,?,?)').run(uid, wo.id, num, 'online', now()); added++; }
  }
  if (wo.auto_disable) db.prepare("UPDATE fast_pool SET status='offline' WHERE workorder_id=? AND number NOT IN (SELECT account FROM e_staff WHERE user_id=? AND status='active' AND account IS NOT NULL AND account<>'')").run(wo.id, clientUid);
  db.prepare('UPDATE fast_workorders SET last_fetch=?, last_result=? WHERE id=?').run(now(), 'added=' + added, wo.id);
  return { added, total: db.prepare('SELECT COUNT(*) n FROM fast_pool WHERE workorder_id=?').get(wo.id).n };
}
const FAST_TICK = Math.max(500, Number(process.env.FAST_FETCH_TICK_MS || 60000));
setInterval(() => {
  try {
    const due = db.prepare("SELECT * FROM fast_workorders WHERE status='active'").all();
    for (const w of due) {
      const last = w.last_fetch ? new Date(w.last_fetch).getTime() : 0;
      if (Date.now() - last < Math.max(3, Number(w.interval_min || 5)) * 60e3) continue;
      fetchWorkorder(w.user_id, w);
    }
  } catch (e) {}
}, FAST_TICK);

async function handleApp(req, res, route, m) {
  if (route === '/events') {
    const uid2 = uidFromReq(req, new URL(req.url, 'http://x'));
    if (!uid2) return json(res, 401, { code: 401, error: '未授权' });
    return json(res, 200, { code: 200, data: { events: db.prepare('SELECT id,kind,code,action,created_at FROM visits WHERE user_id=? ORDER BY id DESC LIMIT 50').all(uid2) } });
  }
  if (route === '/perms-stream') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });
    const send = () => {
      try {
        res.write('event: perms\n');
        res.write('data: ' + JSON.stringify({ platform_perms: PERMS, enabled: 1, t: Date.now() }) + '\n\n');
      } catch (e) {}
    };
    send();
    const timer = setInterval(send, 15000);
    req.on('close', () => clearInterval(timer));
    return;
  }
  if (route === '/ms/pending') return json(res, 200, { code: 200, data: [] });
  if (route === '/sso' && m === 'POST') {
    const b = await readBody(req);
    const secret = String(b.secret || '');
    const expected = String(process.env.SCRM_SSO_SECRET || '');
    if (!expected || secret !== expected) return json(res, 403, { code: 403, error: 'sso_denied' });
    const username = String(b.username || '').trim().slice(0, 80);
    if (!/^[A-Za-z0-9_.@-]{1,80}$/.test(username)) return json(res, 400, { code: 400, error: 'invalid_username' });
    const email = 'st:' + username;
    let user = db.prepare(`SELECT * FROM users WHERE realm='client' AND email = ?`).get(email);
    if (!user) {
      const invite = 'st_' + crypto.createHash('sha256').update(username).digest('hex').slice(0, 16);
      const ins = db.prepare(`INSERT INTO users (realm,email,invite_code,password,name,plan,char_quota,chars_used,port_limit,created_at) VALUES ('client',?,?,'!sso',?,'sso',1000000000,0,999,?)`)
        .run(email, invite, username, now());
      user = db.prepare(`SELECT * FROM users WHERE id = ?`).get(Number(ins.lastInsertRowid));
    }
    if (!user) return json(res, 500, { code: 500, error: 'sso_user_failed' });
    return json(res, 200, {
      token: signUser(user.id, 'client', Date.now() + 3650 * 86400e3),
      invite_code: user.invite_code,
      remark: username,
      platform_perms: PERMS,
      sign_key: crypto.createHmac('sha256', SECRET).update('scrm-sign-v1|' + user.invite_code).digest('hex'),
      data_mask: 0,
    });
  }
  if (route === '/login' && m === 'POST') {
    const b = await readBody(req);
    const key = String(b.invite_code || b.invite || b.code || '').trim();
    const user = db.prepare(`SELECT * FROM users WHERE realm='client' AND invite_code = ?`).get(key);
    if (!user) return json(res, 400, { code: 400, msg: '邀请码无效' });
    return json(res, 200, {
      token: signUser(user.id, 'client', Date.now() + 3650 * 86400e3),
      invite_code: user.invite_code, remark: user.invite_code, platform_perms: PERMS,
      sign_key: crypto.createHmac('sha256', SECRET).update('scrm-sign-v1|' + user.invite_code).digest('hex'), data_mask: 0,
    });
  }
  const uid = userId(req);
  if (!uid) return json(res, 401, { code: 401, msg: '未登录' });
  const user = db.prepare('SELECT * FROM users WHERE id = ? AND realm = ?').get(uid, 'client');
  if (!user) return json(res, 401, { code: 401, msg: '账号不存在' });
  if (route.startsWith('/openchat')) return handleAppOpenchat(req, res, route, m, uid);
  const appTok = verifyLive((req.headers.authorization || '').replace(/^Bearer\s+/i, ''));
  const appPerms = clientPerms(appTok);

  if (route === '/me') {
    const dev = String(uQuery(req).device || req.headers['x-device'] || 'default');
    const ex = db.prepare('SELECT id FROM device_sessions WHERE user_id=? AND device=?').get(uid, dev);
    if (ex) db.prepare('UPDATE device_sessions SET ip=?, ua=?, last_seen=?, revoked=0 WHERE id=?').run(clientIp(req), String(req.headers['user-agent'] || ''), now(), ex.id);
    else db.prepare('INSERT INTO device_sessions (user_id,device,ip,ua,last_seen,revoked) VALUES (?,?,?,?,?,0)').run(uid, dev, clientIp(req), String(req.headers['user-agent'] || ''), now());
    const usedPorts = db.prepare(`SELECT COUNT(*) n FROM port_leases WHERE user_id=? AND state='active'`).get(uid).n;
    return json(res, 200, {
      remark: user.invite_code, port_limit: 999, consume_type: 'char', expire_at: null, char_quota: 1e9,
      billing: { type: 'char', expire_at: null, device_used: usedPorts, device_max: 999, code_used: user.chars_used,
        chars: { alloc: 'dynamic', limit: 1e9, spent: user.chars_used, remaining: 1e9 - user.chars_used },
        features: { translate: true, locked: [] } },
      expire_days: null, buy_url: '/membership', data_mask: 0, device: dev,
      sign_key: crypto.createHmac('sha256', SECRET).update('scrm-sign-v1|' + user.invite_code).digest('hex'),
    });
  }
  if (route === '/perms') return json(res, 200, { code: 200, data: { platform_perms: PERMS, enabled: 1 } });
  if (route === '/ports/status') {
    const device = String(uQuery(req).device || 'default');
    const leases = db.prepare(`SELECT * FROM port_leases WHERE user_id=? AND state='active' ORDER BY id DESC`).all(uid);
    const urow = db.prepare('SELECT * FROM users WHERE id=?').get(uid) || {};
    return json(res, 200, { code: 200, used: leases.length, limit: Number(urow.port_limit || 0), consume_type: 'char', per_device: true, device, leases, t: Date.now() });
  }
  if (route === '/ports/occupy' && m === 'POST') {
    if (denyPerm(res, appPerms, 'ports.write')) return;
    const b = await readBody(req);
    const device = String(b.device || 'default');
    const accountId = String(b.account_id || b.sid || b.session_id || b.key || ('dev-' + device));
    if (!accountId) return json(res, 400, { code: 400, error: 'account_id 必填' });
    const platform = String(b.platform || (String(b.key || '').split(':')[0] || ''));
    const existed = db.prepare(`SELECT * FROM port_leases WHERE user_id=? AND device=? AND account_id=? AND state='active'`).get(uid, device, accountId);
    if (existed) return json(res, 200, { code: 200, lease: existed, idempotent: true });
    const urow = db.prepare('SELECT * FROM users WHERE id=?').get(uid) || {};
    const limit = Number(urow.port_limit || 0);
    const used = db.prepare(`SELECT COUNT(*) n FROM port_leases WHERE user_id=? AND state='active'`).get(uid).n;
    if (limit > 0 && used >= limit) return json(res, 409, { code: 409, error: 'PORT_LIMIT', message: '端口额度已用完', used, limit });
    const ins = db.prepare(`INSERT INTO port_leases (user_id,device,account_id,platform,state,created_at,updated_at) VALUES (?,?,?,?,'active',?,?)`)
      .run(uid, device, accountId, platform, now(), now());
    return json(res, 200, { code: 200, lease: db.prepare('SELECT * FROM port_leases WHERE id=?').get(Number(ins.lastInsertRowid)) });
  }
  if (route === '/ports/release' && m === 'POST') {
    const b = await readBody(req);
    const device = String(b.device || 'default');
    if (b.id) db.prepare(`UPDATE port_leases SET state='released', updated_at=? WHERE id=? AND user_id=?`).run(now(), Number(b.id), uid);
    else db.prepare(`UPDATE port_leases SET state='released', updated_at=? WHERE user_id=? AND device=? AND state='active'`).run(now(), uid, device);
    const used = db.prepare(`SELECT COUNT(*) n FROM port_leases WHERE user_id=? AND state='active'`).get(uid).n;
    return json(res, 200, { code: 200, ok: true, used });
  }
  if (route === '/ports/sync' && m === 'POST') {
    const b = await readBody(req);
    const device = String(b.device || 'default');
    const list = Array.isArray(b.leases) ? b.leases : (Array.isArray(b.keys) ? b.keys.map((k) => ({ account_id: k })) : []);
    db.prepare(`UPDATE port_leases SET state='released', updated_at=? WHERE user_id=? AND device=? AND state='active'`).run(now(), uid, device);
    let inserted = 0;
    for (const it of list) {
      const accountId = String(it.account_id || it.sid || it.session_id || it.key || '');
      if (!accountId) continue;
      db.prepare(`INSERT INTO port_leases (user_id,device,account_id,platform,state,created_at,updated_at) VALUES (?,?,?,?,'active',?,?)`)
        .run(uid, device, accountId, String(it.platform || ''), now(), now());
      inserted++;
    }
    return json(res, 200, { code: 200, ok: true, synced: inserted, refreshed: inserted });
  }
  if (route === '/ports/refresh' && m === 'POST') {
    const b = await readBody(req);
    const device = String(b.device || 'default');
    db.prepare(`UPDATE port_leases SET updated_at=? WHERE user_id=? AND device=? AND state='active'`).run(now(), uid, device);
    return json(res, 200, { code: 200, ok: true });
  }
  if (route === '/device/sessions') {
    const rows = db.prepare('SELECT * FROM device_sessions WHERE user_id=? ORDER BY id DESC LIMIT 50').all(uid);
    return json(res, 200, { code: 200, data: rows });
  }
  if (route === '/device/kick' && m === 'POST') {
    const b = await readBody(req);
    const dev = String(b.device || '');
    if (!dev) return json(res, 400, { code: 400, error: 'device 必填' });
    db.prepare('UPDATE device_sessions SET revoked=1 WHERE user_id=? AND device=?').run(uid, dev);
    return json(res, 200, { code: 200, ok: true, kicked: dev });
  }
  if (route === '/contacts/repeats') {
    const phone = normPhone(uQuery(req).phone || '');
    const rows = db.prepare('SELECT id,name,contact,platform FROM e_customers WHERE user_id=?').all(uid);
    const groups = {};
    for (const r of rows) {
      const k = normPhone(r.contact);
      if (!k) continue;
      (groups[k] = groups[k] || []).push(r);
    }
    const dup = Object.entries(groups).filter(([k, v]) => v.length > 1).map(([k, v]) => ({ key: k, count: v.length, rows: v }));
    const hit = phone ? (groups[phone] || []) : [];
    return json(res, 200, { code: 200, data: { duplicates: dup, matched: hit, total: rows.length } });
  }
  if (route === '/contacts/stats') {
    const total = db.prepare('SELECT COUNT(*) n FROM e_customers WHERE user_id=?').get(uid).n;
    const platforms = db.prepare('SELECT platform, COUNT(*) n FROM e_customers WHERE user_id=? GROUP BY platform').all(uid);
    const leads = db.prepare('SELECT COUNT(*) n FROM e_leads WHERE user_id=?').get(uid).n;
    return json(res, 200, { code: 200, data: { total: Number(total), leads: Number(leads), platforms } });
  }
  if (route === '/contacts/batch' && m === 'POST') {
    if (denyPerm(res, appPerms, 'contacts.write')) return;
    const b = await readBody(req);
    const list = Array.isArray(b.contacts) ? b.contacts : [];
    let inserted = 0, skipped = 0;
    const seen = new Set(db.prepare('SELECT contact FROM e_customers WHERE user_id=?').all(uid).map((r) => normPhone(r.contact)));
    for (const it of list) {
      const contact = String(it.contact || it.phone || '');
      const key = normPhone(contact);
      if (!key || seen.has(key)) { skipped++; continue; }
      seen.add(key);
      createEntity('customers', uid, { name: String(it.name || contact), platform: String(it.platform || ''), contact, tags: String(it.tags || ''), last_msg: '' });
      inserted++;
    }
    return json(res, 200, { code: 200, ok: true, inserted, skipped, total: list.length });
  }
  if (route === '/contact-memos') {
    if (m !== 'GET' && denyPerm(res, appPerms, 'contacts.write')) return;
    if (m === 'GET') return json(res, 200, { code: 200, data: db.prepare('SELECT * FROM contact_memos WHERE user_id=? ORDER BY id DESC LIMIT 200').all(uid) });
    const b = await readBody(req);
    const ins = db.prepare('INSERT INTO contact_memos (user_id,contact,note,created_at) VALUES (?,?,?,?)').run(uid, String(b.contact || ''), String(b.note || ''), now());
    return json(res, 200, { code: 200, data: db.prepare('SELECT * FROM contact_memos WHERE id=?').get(Number(ins.lastInsertRowid)) });
  }
  if (route === '/fans/trend') {
    const rows = db.prepare(`SELECT substr(created_at,1,10) day, COUNT(*) n FROM visits WHERE user_id=? AND kind='page' GROUP BY day ORDER BY day DESC LIMIT 30`).all(uid);
    return json(res, 200, { code: 200, data: rows.reverse() });
  }
  if (route === '/fans/rank') {
    const rows = db.prepare(`SELECT code, COUNT(*) n FROM visits WHERE user_id=? AND kind='page' GROUP BY code ORDER BY n DESC LIMIT 20`).all(uid);
    return json(res, 200, { code: 200, data: rows });
  }
  if (route === '/fans/by-platform') {
    const rows = db.prepare(`SELECT platform, COUNT(*) n FROM e_accounts WHERE user_id=? GROUP BY platform`).all(uid);
    return json(res, 200, { code: 200, data: rows });
  }
  if (route === '/qr') return json(res, 200, { code: 501, error: 'NOT_CONFIGURED', message: '二维码由桌面端桥生成，服务端不伪造' });
  if (route === '/ai-replies') {
    if (m === 'GET') return json(res, 200, { code: 200, data: db.prepare('SELECT * FROM ai_replies WHERE user_id=? ORDER BY id DESC').all(uid) });
    const b = await readBody(req);
    if (!b.trigger || !b.reply) return json(res, 400, { code: 400, error: 'trigger/reply 必填' });
    const ins = db.prepare('INSERT INTO ai_replies (user_id,name,trigger,reply,platform,enabled,created_at) VALUES (?,?,?,?,?,1,?)')
      .run(uid, String(b.name || b.trigger), String(b.trigger), String(b.reply), String(b.platform || ''), now());
    return json(res, 200, { code: 200, data: db.prepare('SELECT * FROM ai_replies WHERE id=?').get(Number(ins.lastInsertRowid)) });
  }
  {
    const ar = route.match(/^\/ai-replies\/(\d+)(\/test)?$/);
    if (ar) {
      const id = Number(ar[1]);
      if (ar[2] && m === 'POST') {
        const b = await readBody(req);
        const msg = String(b.message || '');
        const rules = db.prepare('SELECT * FROM ai_replies WHERE user_id=? AND enabled=1 ORDER BY id DESC').all(uid);
        const hit = rules.find((r) => msg.includes(r.trigger));
        if (!hit) return json(res, 200, { code: 200, matched: false, message: '没有命中规则' });
        db.prepare('UPDATE ai_replies SET hits=CAST(COALESCE(hits,0) AS INTEGER)+1 WHERE id=?').run(hit.id);
        return json(res, 200, { code: 200, matched: true, rule: hit, reply: hit.reply });
      }
      if (m === 'DELETE') { db.prepare('DELETE FROM ai_replies WHERE id=? AND user_id=?').run(id, uid); return json(res, 200, { code: 200, ok: true }); }
      if (m === 'PATCH' || m === 'PUT') {
        const b = await readBody(req);
        db.prepare('UPDATE ai_replies SET trigger=COALESCE(?,trigger), reply=COALESCE(?,reply), enabled=COALESCE(?,enabled), platform=COALESCE(?,platform) WHERE id=? AND user_id=?')
          .run(b.trigger == null ? null : String(b.trigger), b.reply == null ? null : String(b.reply), b.enabled == null ? null : (b.enabled ? 1 : 0), b.platform == null ? null : String(b.platform), id, uid);
        return json(res, 200, { code: 200, data: db.prepare('SELECT * FROM ai_replies WHERE id=?').get(id) });
      }
    }
  }
  if (route === '/materials') {
    if (m === 'GET') return json(res, 200, { code: 200, data: db.prepare('SELECT * FROM e_materials WHERE user_id=? ORDER BY id DESC').all(uid) });
    const b = await readBody(req);
    if (!b.url) return json(res, 400, { code: 400, error: 'url 必填' });
    const row = createEntity('materials', uid, { name: String(b.name || '素材'), url: String(b.url), type: String(b.type || 'image'), size: String(b.size || '') });
    return json(res, 200, { code: 200, data: row });
  }
  {
    const md = route.match(/^\/materials\/(\d+)$/);
    if (md && m === 'DELETE') { deleteEntity('materials', uid, Number(md[1])); return json(res, 200, { code: 200, ok: true }); }
  }
  if (route === '/login-logs') return json(res, 200, { code: 200, data: db.prepare('SELECT * FROM login_logs WHERE user_id=? ORDER BY id DESC LIMIT 100').all(uid) });
  if (route === '/tags') return json(res, 200, { code: 200, data: db.prepare('SELECT * FROM e_tags WHERE user_id=?').all(uid) });
  if (route === '/notes') return json(res, 200, { code: 200, data: { list: db.prepare('SELECT * FROM e_tickets WHERE user_id=?').all(uid), max: 2000, limit: 500 } });
  if (route === '/contacts/batch' && m === 'POST') return json(res, 200, { code: 200, saved: 0 });
  if (route === '/proxies') {
    const platform = String(uQuery(req).platform || '');
    const list = db.prepare('SELECT * FROM e_proxies WHERE user_id=?').all(uid);
    const binds = db.prepare('SELECT * FROM proxy_bindings WHERE user_id=? ORDER BY id DESC').all(uid);
    return json(res, 200, { code: 200, data: { groups: [{ list }], bindings: binds, platform } });
  }
  if (route === '/proxy/bind' && m === 'POST') {
    if (denyPerm(res, appPerms, 'proxy.write')) return;
    const b = await readBody(req);
    const accountId = String(b.account_id || b.session_id || b.sid || '');
    let url = String(b.proxy || b.url || '');
    if (!url && b.proxy_id) {
      const proxyRow = db.prepare('SELECT * FROM e_proxies WHERE id=? AND user_id=?').get(Number(b.proxy_id), uid);
      if (proxyRow) url = String(proxyRow.url || '');
    }
    const platform = String(b.platform || '');
    if (!accountId) return json(res, 400, { code: 400, error: 'account_id 必填' });
    const existed = db.prepare('SELECT * FROM proxy_bindings WHERE user_id=? AND account_id=?').get(uid, accountId);
    if (existed) {
      db.prepare('UPDATE proxy_bindings SET url=?, platform=?, status=?, updated_at=? WHERE id=?')
        .run(url, platform || existed.platform, url ? 'bound' : 'none', now(), existed.id);
    } else {
      db.prepare('INSERT INTO proxy_bindings (user_id,account_id,platform,url,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?)')
        .run(uid, accountId, platform, url, url ? 'bound' : 'none', now(), now());
    }
    return json(res, 200, { code: 200, binding: db.prepare('SELECT * FROM proxy_bindings WHERE user_id=? AND account_id=?').get(uid, accountId) });
  }
  if (route === '/proxy/check-ip') {
    const proxy = String(uQuery(req).proxy || '');
    if (!proxy) return json(res, 400, { code: 400, error: 'proxy 必填' });
    const out = await checkProxyExit(proxy);
    const row = db.prepare('SELECT * FROM proxy_bindings WHERE user_id=? AND url=?').get(uid, proxy);
    if (row) db.prepare('UPDATE proxy_bindings SET status=?, latency=?, last_ip=?, checked_at=? WHERE id=?').run(out.ok ? 'ok' : 'fail', out.latency || 0, out.ip || '', now(), row.id);
    return json(res, 200, Object.assign({ code: 200 }, out));
  }
  if (route === '/kv/per_chat_translate') return json(res, 200, { code: 200, data: {} });
  if (route === '/sessions') {
    const plat = String(uQuery(req).platform || 'wa').toLowerCase() === 'tg' ? 'tg' : 'wa';
    const key = 'sessions_' + plat;
    if (m === 'GET') {
      let list = [];
      try { list = JSON.parse(settingGet(uid, key) || '[]'); } catch (e) {}
      if (!list.length) {
        const t = now();
        list = plat === 'wa'
          ? [{ session_id: 'wa_demo_1', created_at: t, updated_at: t, status: 'offline', remark: 'WhatsApp 1', phone: '', region: '', wa_name: '', wa_number: '' }]
          : [{ session_id: 'tg_demo_1', created_at: t, updated_at: t, status: 'offline', remark: 'Telegram 1', phone: '', region: '' }];
        settingSet(uid, key, JSON.stringify(list));
      }
      return json(res, 200, { code: 200, data: list });
    }
    const b = await readBody(req);
    settingSet(uid, key, JSON.stringify(Array.isArray(b.data) ? b.data : []));
    return json(res, 200, { code: 200, ok: true });
  }
  if (route === '/logout-all' && m === 'POST') {
    settingSet(uid, 'token_epoch', String(tokenEpoch(uid) + 1));
    return json(res, 200, { code: 200, ok: true, message: '所有设备已登出' });
  }
  return json(res, 200, { code: 200, data: [], list: [], total: 0 });
}

// 真实翻译：走本地 WorkBuddy 网关的 OpenAI 兼容接口（无外网依赖）
const GW_BASE_DEFAULT = 'http://127.0.0.1:8787/v1';
const GW_KEY_DEFAULT = '4df95a101f1d2f9dc9632c412a2225f12d47';
const GW_MODELS = { google: 'deepseek-v4.1-flash', bing: 'deepseek-v4-pro', youdao: 'kimi-k3.1-pro', deepl: 'deepseek-v4.1-flash', gemini: 'deepseek-v4-pro', chatgpt: 'kimi-k3.1-pro' };
function gwSetting(key, fallback) {
  const row = db.prepare('SELECT value FROM settings WHERE user_id=1 AND key=?').get(key);
  return (row && row.value) || fallback;
}
async function gwTranslate(text, targetLang, engine = 'google') {
  const base = gwSetting('gw_base', GW_BASE_DEFAULT);
  const key = gwSetting('gw_key', GW_KEY_DEFAULT);
  const model = GW_MODELS[engine] || GW_MODELS.google;
  const t0 = Date.now();
  const r = await httpPostJson(base + '/chat/completions', {
    model,
    messages: [
      { role: 'system', content: '你是翻译引擎。把用户文本翻译成目标语言，只输出译文本身，不要解释、不要引号。目标语言代码：' + targetLang },
      { role: 'user', content: String(text).slice(0, 4000) },
    ],
    max_tokens: 1200,
    temperature: 0,
  }, 30000, { Authorization: 'Bearer ' + key });
  if (r.status !== 200) throw new Error('gateway HTTP ' + r.status + ' ' + String(r.text).slice(0, 120));
  const j = JSON.parse(r.text);
  const out = (j.choices && j.choices[0] && j.choices[0].message && (j.choices[0].message.content || j.choices[0].message.reasoning_content)) || '';
  if (!String(out).trim()) throw new Error('empty translation');
  return { text: String(out).trim(), latency: Date.now() - t0, model };
}
async function multiTranslate(text, langs, engines) {
  const tasks = [];
  for (const lang of langs) for (const engine of engines) tasks.push({ lang, engine });
  const settled = await Promise.allSettled(tasks.map((t) => gwTranslate(text, t.lang, t.engine)));
  return tasks.map((t, i) => {
    const s = settled[i];
    return s.status === 'fulfilled'
      ? { lang: t.lang, engine: t.engine, text: s.value.text, latency: s.value.latency, model: s.value.model, ok: true }
      : { lang: t.lang, engine: t.engine, ok: false, error: String((s.reason && s.reason.message) || s.reason) };
  });
}

function quoteSign(q) {
  return crypto.createHmac('sha256', SECRET).update(['quote', q.plan, q.qty, q.price, q.exp].join('|')).digest('hex');
}
function makeQuote(plan, qty) {
  const price = Number(plan.price_cents) * qty;
  const exp = Date.now() + 5 * 60e3;
  return { plan: plan.code, qty, unit_price_cents: Number(plan.price_cents), price_cents: price, exp, sig: quoteSign({ plan: plan.code, qty, price, exp }) };
}

function clientPerms(tok) {
  if (!tok || tok.role !== 'staff') return null; // 老板/主账号不受限
  const rows = db.prepare(`SELECT r.perms FROM org_members m JOIN org_roles r ON r.id=m.role_id WHERE m.staff_id=? AND m.status='active'`).all(Number(tok.staff_id || 0));
  const set = new Set();
  for (const r of rows) { try { for (const p of JSON.parse(r.perms || '[]')) set.add(p); } catch (e) {} }
  return [...set];
}
function denyPerm(res, perms, perm) {
  if (perms && !perms.includes(perm)) { json(res, 403, { error: 'FORBIDDEN', perm, message: '当前子账号没有该权限' }); return true; }
  return false;
}

async function handleClient(req, res, route, m) {
  const tok = verifyLive((req.headers.authorization || '').replace(/^Bearer\s+/i, ''));
  if (route === '/staff-login' && m === 'POST') {
    const b = await readBody(req);
    const tkey = 'staff|' + clientIp(req) + '|' + String(b.account || '');
    if (loginBlocked(tkey)) return json(res, 429, { error: '尝试次数过多，请 10 分钟后再试' });
    const staff = db.prepare(`SELECT * FROM e_staff WHERE account=? AND COALESCE(user_id,0)=?`).get(String(b.account || ''), Number(b.owner_id || 1));
    if (!staff || !staff.password || !samePw(String(b.password || ''), staff.password)) { loginFail(tkey); return json(res, 400, { error: '账号或密码错误' }); }
    if (staff.status === 'disabled') return json(res, 403, { error: '账号已停用' });
    loginOk(tkey);
    return json(res, 200, { token: sign({ uid: Number(b.owner_id || 1), realm: 'client', epoch: tokenEpoch(Number(b.owner_id || 1)), role: 'staff', staff_id: staff.id, exp: Date.now() + 7 * 86400e3 }), staff: { id: staff.id, account: staff.account } });
  }
  if (route === '/login' && m === 'POST') {
    const b = await readBody(req);
    const key = String(b.invite_code || b.email || '').trim();
    const tkey = 'client|' + clientIp(req) + '|' + key;
    if (loginBlocked(tkey)) return json(res, 429, { error: '尝试次数过多，请 10 分钟后再试' });
    const user = db.prepare(`SELECT * FROM users WHERE realm='client' AND (invite_code = ? OR email = ?)`).get(key, key);
    if (!user) { loginFail(tkey); return json(res, 400, { error: '邀请码或账号不存在' }); }
    if (b.password && user.password && !samePw(b.password, user.password)) { loginFail(tkey); return json(res, 400, { error: '密码错误' }); }
    loginOk(tkey);
    db.prepare('INSERT INTO login_logs (user_id,realm,ip,ua,device,ok,reason,created_at) VALUES (?,?,?,?,?,?,?,?)')
      .run(user.id, 'client', clientIp(req), String(req.headers['user-agent'] || ''), String(b.device || ''), 1, '', now());
    return json(res, 200, {
      token: signUser(user.id, 'client', Date.now() + 30 * 86400e3),
      invite_code: user.invite_code, remark: user.invite_code,
      platform_perms: ['WhatsApp', 'Zalo', 'Line', 'LineBusiness', 'LineWorks', 'Telegram', 'Facebook', 'Messenger', 'TikTok', 'Instagram', 'X', 'Meta', 'Discord', 'LinkedIn', 'Snapchat'],
      sign_key: crypto.createHmac('sha256', SECRET).update('scrm-sign-v1|' + user.invite_code).digest('hex'), data_mask: 0,
    });
  }
  const uid = userId(req);
  if (!uid) return json(res, 401, { error: '未提供访问令牌' });
  const user = db.prepare('SELECT * FROM users WHERE id = ? AND realm = ?').get(uid, 'client');
  if (!user) return json(res, 401, { error: '账号不存在' });
  const perms = clientPerms(tok);
  const sp = route.match(/^\/staff\/(\d+)\/password$/);
  if (sp && m === 'POST') {
    if (perms) return json(res, 403, { error: 'FORBIDDEN', message: '只有主账号能设置子账号密码' });
    const b = await readBody(req);
    if (!b.password) return json(res, 400, { error: '密码不能为空' });
    db.prepare('UPDATE e_staff SET password=? WHERE id=? AND user_id=?').run(hash(String(b.password)), Number(sp[1]), uid);
    logOp(uid, 'client', 'staff.password', 'staff#' + sp[1]);
    return json(res, 200, { ok: true });
  }

  if (route === '/me') return json(res, 200, {
    remark: user.invite_code, port_limit: user.port_limit || 0, consume_type: 'char', expire_at: null, char_quota: user.char_quota,
    billing: { type: 'char', expire_at: null, device_used: count('accounts', uid), device_max: 100, code_used: user.chars_used,
      chars: { alloc: 'dynamic', limit: 0, spent: user.chars_used, remaining: user.char_quota - user.chars_used },
      features: { translate: true, locked: [] } },
    sign_key: crypto.createHmac('sha256', SECRET).update('scrm-sign-v1|' + user.invite_code).digest('hex'),
  });
  if (route === '/billing/catalog') {
    const plans = db.prepare('SELECT code,name,kind,chars,days,price_cents FROM billing_plans WHERE active=1 ORDER BY sort').all();
    return json(res, 200, { plans });
  }
  if (route === '/billing/quote' && m === 'POST') {
    const b = await readBody(req);
    const plan = db.prepare('SELECT * FROM billing_plans WHERE code=? AND active=1').get(String(b.plan_code || ''));
    if (!plan) return json(res, 404, { error: '套餐不存在' });
    const qty = Math.max(1, Math.min(99, Number(b.qty || 1)));
    return json(res, 200, { quote: makeQuote(plan, qty) });
  }
  if (route === '/billing/purchase' && m === 'POST') {
    if (denyPerm(res, perms, 'billing.buy')) return;
    const b = await readBody(req);
    const requestId = String(b.request_id || '').trim();
    if (!requestId) return json(res, 400, { error: 'request_id 必填' });
    const existed = db.prepare('SELECT * FROM billing_orders WHERE request_id=? AND user_id=?').get(requestId, uid);
    if (existed) return json(res, 200, { order: existed, idempotent: true, char_quota: user.char_quota });
    const plan = db.prepare('SELECT * FROM billing_plans WHERE code=? AND active=1').get(String(b.plan_code || ''));
    if (!plan) return json(res, 404, { error: '套餐不存在' });
    const qty = Math.max(1, Math.min(99, Number(b.qty || 1)));
    const q = b.quote || {};
    const expected = quoteSign({ plan: plan.code, qty, price: Number(q.price_cents), exp: Number(q.exp) });
    if (!q.sig || q.sig !== expected || Number(q.exp) < Date.now()) {
      return json(res, 409, { error: '报价已失效，请重新确认', code: 'QUOTE_EXPIRED', quote: makeQuote(plan, qty) });
    }
    const currentPrice = Number(plan.price_cents) * qty;
    if (Number(q.price_cents) !== currentPrice) {
      return json(res, 409, { error: '价格已变动，请确认新报价', code: 'PRICE_CHANGED', quote: makeQuote(plan, qty) });
    }
    db.exec('BEGIN');
    try {
      const ins = db.prepare(`INSERT INTO billing_orders (user_id,request_id,plan_code,qty,unit_price_cents,amount_cents,status,quote_sig,created_at,paid_at) VALUES (?,?,?,?,?,?,?,?,?,?)`)
        .run(uid, requestId, plan.code, qty, Number(plan.price_cents), currentPrice, 'paid', q.sig, now(), now());
      if (plan.kind === 'char') db.prepare('UPDATE users SET char_quota = CAST(COALESCE(char_quota,0) AS REAL) + ? WHERE id=?').run(Number(plan.chars) * qty, uid);
      if (plan.kind === 'port') db.prepare('UPDATE users SET port_limit = CAST(COALESCE(port_limit,0) AS INTEGER) + ? WHERE id=?').run(qty, uid);
      db.exec('COMMIT');
      const order = db.prepare('SELECT * FROM billing_orders WHERE id=?').get(Number(ins.lastInsertRowid));
      const fresh = db.prepare('SELECT char_quota, port_limit FROM users WHERE id=?').get(uid);
      logOp(uid, 'client', 'billing.purchase', plan.code + ' x' + qty + ' ¥' + (currentPrice / 100).toFixed(2));
      return json(res, 200, { order, char_quota: fresh.char_quota, port_limit: fresh.port_limit });
    } catch (e) {
      db.exec('ROLLBACK');
      if (String(e.message).includes('UNIQUE')) {
        const again = db.prepare('SELECT * FROM billing_orders WHERE request_id=?').get(requestId);
        return json(res, 200, { order: again, idempotent: true });
      }
      return json(res, 500, { error: '下单失败：' + e.message });
    }
  }
  if (route === '/billing/orders') {
    return json(res, 200, { orders: db.prepare('SELECT * FROM billing_orders WHERE user_id=? ORDER BY id DESC LIMIT 50').all(uid) });
  }
  if (route === '/org/roles') {
    if (m === 'GET') return json(res, 200, { roles: db.prepare('SELECT * FROM org_roles WHERE user_id=? ORDER BY id DESC').all(uid) });
    const b = await readBody(req);
    if (!b.name) return json(res, 400, { error: '角色名必填' });
    if (denyPerm(res, perms, 'org.manage')) return;
    const ins = db.prepare('INSERT INTO org_roles (user_id,name,category,perms,created_at) VALUES (?,?,?,?,?)')
      .run(uid, String(b.name), String(b.category || '自定义'), JSON.stringify(Array.isArray(b.perms) ? b.perms : []), now());
    logOp(uid, 'client', 'org.role.create', b.name);
    return json(res, 200, { role: db.prepare('SELECT * FROM org_roles WHERE id=?').get(Number(ins.lastInsertRowid)) });
  }
  {
    const rr = route.match(/^\/org\/roles\/(\d+)$/);
    if (rr) {
      const id = Number(rr[1]);
      if (m === 'DELETE') { db.prepare('DELETE FROM org_roles WHERE id=? AND user_id=?').run(id, uid); logOp(uid, 'client', 'org.role.delete', String(id)); return json(res, 200, { ok: true }); }
      if (m === 'PATCH' || m === 'PUT') {
        const b = await readBody(req);
        db.prepare('UPDATE org_roles SET name=COALESCE(?,name), perms=COALESCE(?,perms) WHERE id=? AND user_id=?')
          .run(b.name == null ? null : String(b.name), b.perms == null ? null : JSON.stringify(b.perms), id, uid);
        return json(res, 200, { role: db.prepare('SELECT * FROM org_roles WHERE id=?').get(id) });
      }
    }
  }
  if (route === '/org/members') {
    if (m === 'GET') {
      const rows = db.prepare(`SELECT m.*, s.account AS staff_name, r.name AS role_name FROM org_members m
        LEFT JOIN e_staff s ON s.id=m.staff_id AND s.user_id=m.user_id
        LEFT JOIN org_roles r ON r.id=m.role_id AND r.user_id=m.user_id
        WHERE m.user_id=? ORDER BY m.id DESC`).all(uid);
      return json(res, 200, { members: rows });
    }
    const b = await readBody(req);
    if (!b.staff_id) return json(res, 400, { error: 'staff_id 必填' });
    const ins = db.prepare('INSERT INTO org_members (user_id,staff_id,role_id,status,created_at) VALUES (?,?,?,?,?)')
      .run(uid, Number(b.staff_id), b.role_id ? Number(b.role_id) : null, String(b.status || 'active'), now());
    logOp(uid, 'client', 'org.member.add', String(b.staff_id));
    return json(res, 200, { member: db.prepare('SELECT * FROM org_members WHERE id=?').get(Number(ins.lastInsertRowid)) });
  }
  {
    const mm = route.match(/^\/org\/members\/(\d+)$/);
    if (mm && m === 'DELETE') { db.prepare('DELETE FROM org_members WHERE id=? AND user_id=?').run(Number(mm[1]), uid); return json(res, 200, { ok: true }); }
  }
  if (route === '/org/nodes') {
    if (m === 'GET') return json(res, 200, { nodes: db.prepare('SELECT * FROM org_nodes WHERE user_id=? ORDER BY id').all(uid) });
    const b = await readBody(req);
    const ins = db.prepare('INSERT INTO org_nodes (user_id,name,parent_id,created_at) VALUES (?,?,?,?)')
      .run(uid, String(b.name || '未命名'), b.parent_id ? Number(b.parent_id) : null, now());
    return json(res, 200, { node: db.prepare('SELECT * FROM org_nodes WHERE id=?').get(Number(ins.lastInsertRowid)) });
  }
  if (route === '/org/whoami') {
    const rows = db.prepare(`SELECT r.name, r.perms FROM org_members m JOIN org_roles r ON r.id=m.role_id WHERE m.user_id=? AND m.status='active'`).all(uid);
    const perms = [...new Set(rows.flatMap((r) => { try { return JSON.parse(r.perms || '[]'); } catch (e) { return []; } }))];
    return json(res, 200, { roles: rows.map((r) => r.name), perms });
  }
  if (route === '/oplogs') {
    const q = Object.fromEntries(new URL(req.url, 'http://x').searchParams.entries());
    const where = ['user_id=?'];
    const args = [uid];
    if (q.action) { where.push('action LIKE ?'); args.push('%' + q.action + '%'); }
    if (q.from) { where.push('created_at >= ?'); args.push(q.from); }
    if (q.to) { where.push('created_at <= ?'); args.push(q.to + 'T23:59:59'); }
    const page = Math.max(1, Number(q.page || 1));
    const limit = Math.min(200, Math.max(1, Number(q.limit || 50)));
    const total = db.prepare(`SELECT COUNT(*) n FROM e_oplogs WHERE ${where.join(' AND ')}`).get(...args).n;
    const rows = db.prepare(`SELECT * FROM e_oplogs WHERE ${where.join(' AND ')} ORDER BY id DESC LIMIT ? OFFSET ?`).all(...args, limit, (page - 1) * limit);
    return json(res, 200, { total: Number(total), page, limit, rows });
  }
  if (route === '/wallet') {
    const urow = db.prepare('SELECT wallet_balance FROM users WHERE id=?').get(uid) || {};
    return json(res, 200, { balance: Number(urow.wallet_balance || 0), logs: db.prepare('SELECT * FROM e_wallet_logs WHERE user_id=? ORDER BY id DESC LIMIT 100').all(uid) });
  }
  if (route === '/wallet/adjust' && m === 'POST') {
    if (denyPerm(res, perms, 'wallet.adjust')) return;
    const b = await readBody(req);
    const amount = Number(b.amount || 0);
    if (!amount) return json(res, 400, { error: 'amount 不能为 0' });
    const urow = db.prepare('SELECT wallet_balance FROM users WHERE id=?').get(uid) || {};
    const next = Math.max(0, Number(urow.wallet_balance || 0) + amount);
    db.prepare('UPDATE users SET wallet_balance=? WHERE id=?').run(next, uid);
    createEntity('wallet_logs', uid, { kind: amount > 0 ? 'recharge' : 'consume', amount: amount, balance_after: next, note: String(b.note || '') });
    logOp(uid, 'client', 'wallet.adjust', (amount > 0 ? '+' : '') + amount + ' -> ' + next);
    return json(res, 200, { balance: next });
  }
  if (route === '/chats' && m === 'GET') {
    const q = new URL(req.url, 'http://x').searchParams.get('q') || '';
    const rows = db.prepare(`SELECT * FROM chats WHERE user_id=? ${q ? 'AND (contact LIKE ? OR last_message LIKE ?)' : ''} ORDER BY COALESCE(last_at, '') DESC, id DESC LIMIT 200`)
      .all(...(q ? [uid, '%' + q + '%', '%' + q + '%'] : [uid]));
    return json(res, 200, { chats: rows });
  }
  if (route === '/chats' && m === 'POST') {
    if (denyPerm(res, perms, 'chat.reply')) return;
    const b = await readBody(req);
    const chat = db.prepare(`INSERT INTO chats (user_id,platform,contact,contact_id,last_message,last_at,unread,status) VALUES (?,?,?,?,?,?,0,'open')`)
      .run(uid, String(b.platform || 'WhatsApp'), String(b.contact || ''), String(b.contact_id || ''), '', now());
    return json(res, 200, { chat: db.prepare('SELECT * FROM chats WHERE id=?').get(Number(chat.lastInsertRowid)) });
  }
  {
    const mm = route.match(/^\/chats\/(\d+)\/messages$/);
    if (mm) {
      const chatId = Number(mm[1]);
      const chat = db.prepare('SELECT * FROM chats WHERE id=? AND user_id=?').get(chatId, uid);
      if (!chat) return json(res, 404, { error: '会话不存在' });
      if (m === 'GET') return json(res, 200, { messages: db.prepare('SELECT * FROM messages WHERE chat_id=? AND user_id=? ORDER BY id ASC LIMIT 500').all(chatId, uid) });
      const b = await readBody(req);
      const content = String(b.content || '');
      const media = String(b.media_url || '');
      if (!content && !media) return json(res, 400, { error: '内容不能为空' });
      const ins = db.prepare('INSERT INTO messages (user_id,chat_id,direction,role,content,media_url,status,created_at) VALUES (?,?,?,?,?,?,?,?)')
        .run(uid, chatId, String(b.direction || 'out'), String(b.role || 'agent'), content, media, 'queued', now());
      db.prepare('UPDATE chats SET last_message=?, last_at=?, unread=0 WHERE id=?').run(content || '[媒体]', now(), chatId);
      if (String(b.direction || 'out') === 'in' && content) {
        const rule = db.prepare('SELECT * FROM ai_replies WHERE user_id=? AND enabled=1 ORDER BY id DESC').all(uid).find((r) => content.includes(r.trigger));
        if (rule) {
          db.prepare('INSERT INTO messages (user_id,chat_id,direction,role,content,media_url,status,created_at) VALUES (?,?,?,?,?,?,?,?)')
            .run(uid, chatId, 'out', 'ai', rule.reply, '', 'queued', now());
          db.prepare('UPDATE ai_replies SET hits=CAST(COALESCE(hits,0) AS INTEGER)+1 WHERE id=?').run(rule.id);
          db.prepare('UPDATE chats SET last_message=?, last_at=? WHERE id=?').run(rule.reply, now(), chatId);
        }
      }
      return json(res, 200, { message: db.prepare('SELECT * FROM messages WHERE id=?').get(Number(ins.lastInsertRowid)) });
    }
    const mr = route.match(/^\/chats\/(\d+)\/read$/);
    if (mr && m === 'POST') {
      db.prepare('UPDATE chats SET unread=0 WHERE id=? AND user_id=?').run(Number(mr[1]), uid);
      return json(res, 200, { ok: true });
    }
  }
  if (route === '/chat/upload' && m === 'POST') {
    const b = await readBody(req);
    const raw = String(b.data || '').replace(/^data:[^;]+;base64,/, '');
    const buf = Buffer.from(raw, 'base64');
    if (!buf.length) return json(res, 400, { error: '空文件' });
    if (buf.length > 8 * 1024 * 1024) return json(res, 413, { error: '文件超过 8MB' });
    const ext = ({ 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif', 'application/pdf': 'pdf', 'video/mp4': 'mp4' })[String(b.mime || '')] || 'bin';
    const dir = path.join(PUB, 'uploads'); fs.mkdirSync(dir, { recursive: true });
    const name = 'chat-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7) + '.' + ext;
    fs.writeFileSync(path.join(dir, name), buf);
    return json(res, 200, { url: '/uploads/' + name, bytes: buf.length });
  }
  if (route === '/broadcasts') {
    if (m !== 'GET' && denyPerm(res, perms, 'broadcast.send')) return;
    if (m === 'GET') {
      const jobs = db.prepare('SELECT * FROM broadcast_jobs WHERE user_id=? ORDER BY id DESC LIMIT 100').all(uid);
      for (const j of jobs) j.stats = db.prepare('SELECT status, COUNT(*) n FROM broadcast_targets WHERE job_id=? GROUP BY status').all(j.id);
      return json(res, 200, { jobs });
    }
    const b = await readBody(req);
    const content = String(b.content || '');
    if (!content) return json(res, 400, { error: '内容不能为空' });
    const audience = b.audience || { type: 'customers' };
    let contacts = [];
    if (audience.type === 'customers') contacts = db.prepare(`SELECT contact FROM e_customers WHERE user_id=? AND COALESCE(contact,'')<>''`).all(uid).map((r) => r.contact);
    else if (audience.type === 'leads') contacts = db.prepare(`SELECT contact FROM e_leads WHERE user_id=? AND COALESCE(contact,'')<>''`).all(uid).map((r) => r.contact);
    else if (Array.isArray(audience.contacts)) contacts = audience.contacts.map(String);
    const uniq = [...new Set(contacts)];
    const ins = db.prepare('INSERT INTO broadcast_jobs (user_id,name,content,audience,status,total,created_at) VALUES (?,?,?,?,?,?,?)')
      .run(uid, String(b.name || ('群发 ' + new Date().toISOString().slice(0, 16))), content, JSON.stringify(audience), 'draft', uniq.length, now());
    const jobId = Number(ins.lastInsertRowid);
    for (const c of uniq) db.prepare('INSERT INTO broadcast_targets (user_id,job_id,contact,status) VALUES (?,?,?,?)').run(uid, jobId, c, 'queued');
    logOp(uid, 'client', 'broadcast.create', 'job#' + jobId + ' targets=' + uniq.length);
    return json(res, 200, { job: db.prepare('SELECT * FROM broadcast_jobs WHERE id=?').get(jobId) });
  }
  {
    const mj = route.match(/^\/broadcasts\/(\d+)\/(start|pause|cancel|targets|finish)$/);
    if (mj) {
      const job = db.prepare('SELECT * FROM broadcast_jobs WHERE id=? AND user_id=?').get(Number(mj[1]), uid);
      if (!job) return json(res, 404, { error: '任务不存在' });
      const act = mj[2];
      if (act === 'targets') return json(res, 200, { targets: db.prepare('SELECT * FROM broadcast_targets WHERE job_id=? ORDER BY id LIMIT 500').all(job.id) });
      const status = act === 'start' ? 'running' : act === 'pause' ? 'paused' : act === 'finish' ? 'done' : 'canceled';
      db.prepare('UPDATE broadcast_jobs SET status=?, started_at=COALESCE(started_at,?), finished_at=? WHERE id=?').run(status, act === 'start' ? now() : null, act === 'finish' ? now() : null, job.id);
      if (act === 'cancel') db.prepare(`UPDATE broadcast_targets SET status='canceled', error='job canceled' WHERE job_id=? AND status='queued'`).run(job.id);
      return json(res, 200, { job: db.prepare('SELECT * FROM broadcast_jobs WHERE id=?').get(job.id) });
    }
  }
  if (route === '/schema') {
    const out = {};
    for (const [k, d] of Object.entries(ENTITIES)) if (d.realm === 'client') out[k] = d;
    return json(res, 200, { entities: out });
  }
  if (route === '/stats') {
    const rows = db.prepare('SELECT kind, action, COUNT(*) n FROM visits WHERE user_id = ? GROUP BY kind, action').all(uid);
    const clicks = db.prepare('SELECT COALESCE(SUM(CAST(clicks AS INTEGER)),0) n FROM e_links WHERE user_id = ?').get(uid).n;
    return json(res, 200, {
      codes: count('codes', uid), accounts: count('accounts', uid), leads: count('leads', uid), customers: count('customers', uid),
      staff: count('staff', uid), clicks: Number(clicks), visits: rows,
      recent: db.prepare('SELECT * FROM visits WHERE user_id = ? ORDER BY id DESC LIMIT 20').all(uid),
      chars: { used: user.chars_used, quota: user.char_quota },
    });
  }
  if (route === '/translate' && m === 'POST') {
    const b = await readBody(req);
    const text = String(b.text || '').slice(0, 2000);
    const langs = Array.isArray(b.langs) && b.langs.length ? b.langs : ['zh-CN'];
    const cost = text.replace(/\s/g, '').length;
    db.prepare('UPDATE users SET chars_used = chars_used + ? WHERE id = ?').run(cost, uid);
    db.prepare('INSERT INTO e_char_logs (user_id,created_at,updated_at,kind,engine,src_chars) VALUES (?,?,?,?,?,?)').run(uid, now(), now(), 'translate', 'local', cost);
    return json(res, 200, { results: langs.map((l) => ({ lang: l, langName: l, text: fakeTranslate(text, l) })), source: text, cost });
  }
  if (route === '/recharge' && m === 'POST') {
    const b = await readBody(req);
    const amount = Number(b.amount || 0);
    db.prepare('UPDATE users SET balance = balance + ? WHERE id = ?').run(amount, uid);
    const row = createEntity('recharges', uid, { amount, method: b.method || 'USDT', status: 'paid' });
    return json(res, 200, { ok: true, row, balance: user.balance + amount });
  }
  if (route === '/broadcast' && m === 'POST') {
    const b = await readBody(req);
    db.prepare(`UPDATE e_broadcasts SET status='done', sent = CAST(COALESCE(sent,0) AS INTEGER) + ? WHERE id = ? AND user_id = ?`).run(Number(b.count || 10), Number(b.id), uid);
    return json(res, 200, { ok: true });
  }
  if (route === '/proxy-test' && m === 'POST') {
    const b = await readBody(req);
    const raw = String(b.url || '');
    const m2 = raw.match(/^(?:socks5|socks4|https?):\/\/(?:[^@\/]+@)?([^:\/]+):(\d+)/i);
    if (!m2) return json(res, 400, { ok: false, error: '代理格式应为 scheme://host:port' });
    const host = m2[1], port = Number(m2[2]);
    const t0 = Date.now();
    const net = require('net');
    const ok = await new Promise((resolve) => {
      const sock = net.connect({ host, port, timeout: 3000 });
      sock.on('connect', () => { sock.destroy(); resolve(true); });
      sock.on('timeout', () => { sock.destroy(); resolve(false); });
      sock.on('error', () => resolve(false));
    });
    const ms = Date.now() - t0;
    db.prepare(`UPDATE e_proxies SET status=?, latency=? WHERE id=? AND user_id=?`).run(ok ? 'ok' : 'fail', ms, Number(b.id), uid);
    return json(res, 200, { ok, latency: ms, host, port });
  }

  const crud = route.match(/^\/entities\/([a-z0-9_]+)(?:\/(\d+))?$/);
  if (crud) {
    const name = crud[1], id = crud[2], def = ENTITIES[name];
    if (!def || def.realm !== 'client') return json(res, 404, { error: 'no such entity' });
    if (m === 'GET' && !id) {
      const q = uQuery(req);
      return json(res, 200, { rows: listEntity(name, uid, q), total: listEntityTotal(name, uid, q), limit: Number(q.limit) || 100, offset: Number(q.offset) || 0 });
    }
    if (m === 'POST' && !id) return json(res, 200, { row: createEntity(name, uid, await readBody(req)) });
    if ((m === 'PATCH' || m === 'PUT') && id) return json(res, 200, { row: updateEntity(name, uid, id, await readBody(req)) });
    if (m === 'DELETE' && id) { deleteEntity(name, uid, id); return json(res, 200, { ok: true }); }
  }
  return json(res, 404, { error: 'not found' });
}

async function cloneFetchHtml(src, opts = {}) {
  const r = await fetchText(src);
  const base = new URL(src);
  let html = String(r.text);
  if (html.length > 5 * 1024 * 1024) throw new Error('页面超过 5MB，已中止');
  const dirName = opts.dir || null;
  const assets = { count: 0, bytes: 0, failed: 0 };
  const MAX_ASSETS = 60;
  const MAX_FILE = 5 * 1024 * 1024;
  async function localize(url) {
    if (!dirName || !/^https?:\/\//i.test(url)) return null;
    if (assets.count >= MAX_ASSETS) return null;
    try {
      const res = await fetchBuffer(url);
      if (res.status !== 200 || !res.buffer.length || res.buffer.length > MAX_FILE) { assets.failed++; return null; }
      const m = url.match(/\.(png|jpe?g|gif|webp|svg|ico|woff2?|ttf|otf|css|mp4|webm)(?:\?|#|$)/i);
      let ext = m ? m[1].toLowerCase() : String(res.headers['content-type'] || '').split('/')[1] || 'bin';
      ext = ext.split(';')[0].replace(/[^a-z0-9]/g, '') || 'bin';
      const name = crypto.createHash('sha1').update(url).digest('hex').slice(0, 16) + '.' + ext;
      const dir = path.join(PUB, 'uploads', dirName);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, name), res.buffer);
      assets.count++; assets.bytes += res.buffer.length;
      return '/uploads/' + dirName + '/' + name;
    } catch (e) { assets.failed++; return null; }
  }

  // 1) 内联样式表；CSS 里的 url(...) 一并本地化
  const links = [...html.matchAll(/<link[^>]+rel=["']?stylesheet["']?[^>]*>/gi)].slice(0, 5);
  for (const tag of links) {
    const href = (tag[0].match(/href=["']([^"']+)["']/i) || [])[1];
    if (!href) continue;
    try {
      const cssUrl = new URL(href, base).toString();
      const css = await fetchBuffer(cssUrl);
      if (css.status !== 200 || css.buffer.length > 2 * 1024 * 1024) continue;
      let text = css.buffer.toString('utf8');
      const urls = [...new Set([...text.matchAll(/url\((['"]?)([^)'"]+)\1\)/gi)].map((x) => x[2]).filter((u) => !/^data:|^#/.test(u)))];
      const map = {};
      for (const u of urls) {
        const abs = new URL(u, cssUrl).toString();
        const local = await localize(abs);
        if (local) map[u] = local;
      }
      text = text.replace(/url\((['"]?)([^)'"]+)\1\)/gi, (mm, q, u) => map[u] ? 'url("' + map[u] + '")' : mm);
      html = html.replace(tag[0], '<style>' + text + '</style>');
    } catch (e) {}
  }

  // 2) 图片/脚本/表单地址绝对化
  html = html.replace(/(src|href|action|poster|srcset)=["'](?!https?:|\/\/|#|data:|mailto:|javascript:)([^"']+)["']/gi, (mm, attr, val) => {
    if (attr.toLowerCase() === 'srcset') {
      return attr + '="' + val.split(',').map((part) => { const [u, d] = part.trim().split(/\s+/); return new URL(u, base).toString() + (d ? ' ' + d : ''); }).join(', ') + '"';
    }
    return `${attr}="${new URL(val, base).toString()}"`;
  });

  // 3) 图片/视频/图标本地化（src/poster/srcset）
  if (dirName) {
    const found = new Set();
    for (const m of html.matchAll(/(?:src|poster)=["'](https?:\/\/[^"']+)["']/gi)) found.add(m[1]);
    for (const m of html.matchAll(/srcset=["']([^"']+)["']/gi)) {
      for (const part of m[1].split(',')) { const u = part.trim().split(/\s+/)[0]; if (/^https?:\/\//.test(u)) found.add(u); }
    }
    for (const m of html.matchAll(/<link[^>]+rel=["']?(?:icon|shortcut icon|apple-touch-icon)["']?[^>]*href=["'](https?:\/\/[^"']+)["']/gi)) found.add(m[1]);
    const map = {};
    for (const u of found) {
      if (/\.(css|js)(\?|#|$)/i.test(u)) continue;
      const local = await localize(u);
      if (local) map[u] = local;
    }
    for (const [u, local] of Object.entries(map)) html = html.split(u).join(local);
  }

  // 4) 去掉脚本与内联事件
  html = html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, '');
  return { html, status: r.status, host: base.hostname, assets };
}

async function handleAdmin(req, res, route, m) {
  if (route === '/login' && m === 'POST') {
    const b = await readBody(req);
    const tkey = 'admin|' + clientIp(req) + '|' + String(b.email || '');
    if (loginBlocked(tkey)) return json(res, 429, { error: '尝试次数过多，请 10 分钟后再试' });
    const user = db.prepare(`SELECT * FROM users WHERE realm='admin' AND email = ?`).get(String(b.email || ''));
    if (!user || !samePw(b.password, user.password)) { loginFail(tkey); return json(res, 400, { error: '邮箱或密码错误' }); }
    loginOk(tkey);
    return json(res, 200, { token: signUser(user.id, 'admin', Date.now() + 30 * 86400e3), user: { id: user.id, email: user.email, username: user.name, membership: user.membership, membership_expire: user.membership_expire, role: 'owner' } });
  }
  if (route === '/register' && m === 'POST') {
    const b = await readBody(req);
    if (!b.email || !b.password) return json(res, 400, { error: '邮箱和密码必填' });
    if (db.prepare(`SELECT id FROM users WHERE realm='admin' AND email=?`).get(String(b.email))) return json(res, 400, { error: '邮箱已注册' });
    const exp = new Date(Date.now() + 3 * 86400e3).toISOString().slice(0, 10);
    const info = db.prepare(`INSERT INTO users (realm,email,password,name,membership,membership_expire,created_at) VALUES ('admin',?,?,?,?,?,?)`)
      .run(String(b.email), hash(b.password), String(b.name || b.email.split('@')[0]), 'free', exp, now());
    const uid2 = Number(info.lastInsertRowid);
    return json(res, 200, { token: signUser(uid2, 'admin', Date.now() + 30 * 86400e3), user: { id: uid2, email: b.email, username: b.name || b.email, membership: 'free', membership_expire: exp, role: 'owner' } });
  }
  const uid = userId(req);
  if (!uid) return json(res, 401, { error: '未提供访问令牌' });
  const user = db.prepare('SELECT * FROM users WHERE id = ? AND realm = ?').get(uid, 'admin');
  if (!user) return json(res, 401, { error: '账号不存在' });

  if (route === '/me') return json(res, 200, { user: { id: user.id, email: user.email, username: user.name, membership: user.membership, membership_expire: user.membership_expire, role: 'owner' } });
  if (route === '/schema') {
    const out = {};
    for (const [k, d] of Object.entries(ENTITIES)) if (d.realm === 'admin') out[k] = d;
    return json(res, 200, { entities: out });
  }
  if (route === '/stats') {
    const pages = db.prepare('SELECT id,name,slug,views,conversions,status FROM e_pages WHERE user_id=? ORDER BY id DESC').all(uid);
    const visits = db.prepare('SELECT kind, action, COUNT(*) n FROM visits WHERE user_id=? GROUP BY kind, action').all(uid);
    const byDay = db.prepare(`SELECT substr(created_at,1,10) d, COUNT(*) n FROM visits WHERE user_id=? GROUP BY d ORDER BY d DESC LIMIT 14`).all(uid);
    return json(res, 200, {
      pages: pages.length, live: pages.filter((p) => p.status === 'live').length,
      views: pages.reduce((a, p) => a + Number(p.views || 0), 0), conversions: pages.reduce((a, p) => a + Number(p.conversions || 0), 0),
      forms: count('forms', uid), visits, byDay: byDay.reverse(),
      membership: user.membership, membership_expire: user.membership_expire, list: pages,
    });
  }
  if (route === '/ai/generate' && m === 'POST') {
    const b = await readBody(req);
    const prompt = String(b.prompt || '').slice(0, 500);
    const kind = String(b.kind || 'copy');
    let content = '';
    const ai = db.prepare('SELECT * FROM ai_settings WHERE user_id=?').get(uid);
    if (!ai || !ai.api_key) return json(res, 501, { error: 'NOT_CONFIGURED', message: 'AI 未配置 provider/key，请在 AI 设置里填写' });
    if (kind !== 'copy') return json(res, 501, { error: 'NOT_CONFIGURED', message: '图片/视频生成需要对应 provider（未配置）' });
    try {
      const r = await httpPostJson('https://api.openai.com/v1/chat/completions', {
        model: ai.model || 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 500,
      }, 25000, { Authorization: 'Bearer ' + ai.api_key });
      if (r.status !== 200) throw new Error('provider HTTP ' + r.status + ' ' + String(r.text).slice(0, 120));
      const j = JSON.parse(r.text);
      content = (j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || '';
      if (!content.trim()) throw new Error('empty completion');
    } catch (e) {
      return json(res, 502, { error: 'AI 调用失败：' + e.message });
    }
    db.prepare('INSERT INTO e_ai_assets (user_id,created_at,updated_at,kind,prompt,content) VALUES (?,?,?,?,?,?)').run(uid, now(), now(), kind, prompt, content);
    return json(res, 200, { ok: true, kind, content });
  }
  if (route === '/ai/settings') {
    if (m === 'GET') return json(res, 200, { row: db.prepare('SELECT * FROM ai_settings WHERE user_id=?').get(uid) || null });
    const b = await readBody(req);
    const existed = db.prepare('SELECT id FROM ai_settings WHERE user_id=?').get(uid);
    if (existed) db.prepare('UPDATE ai_settings SET provider=?, api_key=?, model=? WHERE user_id=?').run(String(b.provider || ''), String(b.api_key || ''), String(b.model || ''), uid);
    else db.prepare('INSERT INTO ai_settings (user_id,provider,api_key,model) VALUES (?,?,?,?)').run(uid, String(b.provider || ''), String(b.api_key || ''), String(b.model || ''));
    return json(res, 200, { ok: true });
  }
  if (route === '/membership') return json(res, 200, { row: { membership: user.membership, membership_expire: user.membership_expire } });
  if (route === '/membership/buy' && m === 'POST') {
    db.prepare(`UPDATE users SET membership='pro', membership_expire=? WHERE id=?`).run(new Date(Date.now() + 365 * 86400e3).toISOString().slice(0, 10), uid);
    return json(res, 200, { ok: true });
  }

  if (route === '/cloak/whoami') {
    const d = cloakCheck(uid, req);
    return json(res, 200, { visitor: d.visitor, action: d.action, rule: d.rule, whitelisted: d.whitelisted });
  }
  if (route === '/cloak/stats') {
    const today = new Date().toISOString().slice(0, 10);
    const blocked = db.prepare(`SELECT COUNT(*) n FROM visits WHERE user_id=? AND action LIKE 'block%' AND substr(created_at,1,10)=?`).get(uid, today).n;
    return json(res, 200, {
      todayBlocked: Number(blocked),
      rules: Number(db.prepare('SELECT COUNT(*) n FROM e_cloak_rules WHERE user_id=?').get(uid).n),
      enabled: Number(db.prepare(`SELECT COUNT(*) n FROM e_cloak_rules WHERE user_id=? AND enabled='1'`).get(uid).n),
      pending: Number(db.prepare(`SELECT COUNT(*) n FROM cloak_reviews WHERE user_id=? AND status='pending'`).get(uid).n),
    });
  }
  if (route === '/cloak/selfcheck') {
    const q = uQuery(req);
    const fake = { headers: { 'user-agent': q.ua || '', 'accept-language': q.lang || 'en-US', 'x-country': q.country || 'US', 'x-forwarded-for': q.ip || '203.0.113.10' }, socket: { remoteAddress: '127.0.0.1' } };
    const d = cloakCheck(uid, fake);
    return json(res, 200, { visitor: d.visitor, action: d.action, rule: d.rule, whitelisted: d.whitelisted });
  }
  if (route === '/cloak/whitelist') {
    if (m === 'GET') return json(res, 200, { rows: db.prepare('SELECT * FROM cloak_whitelist WHERE user_id=? ORDER BY id DESC').all(uid) });
    const b = await readBody(req);
    db.prepare('INSERT INTO cloak_whitelist (user_id,ip,note,created_at) VALUES (?,?,?,?)').run(uid, String(b.ip || ''), String(b.note || ''), now());
    return json(res, 200, { ok: true });
  }
  const wlDel = route.match(/^\/cloak\/whitelist\/(\d+)$/);
  if (wlDel && m === 'DELETE') { db.prepare('DELETE FROM cloak_whitelist WHERE id=? AND user_id=?').run(Number(wlDel[1]), uid); return json(res, 200, { ok: true }); }
  if (route === '/cloak/reviews' && m === 'GET') return json(res, 200, { rows: db.prepare('SELECT * FROM cloak_reviews WHERE user_id=? ORDER BY id DESC LIMIT 200').all(uid) });
  const rv = route.match(/^\/cloak\/reviews\/(\d+)\/(approve|block)$/);
  if (rv && m === 'POST') {
    const status = rv[2] === 'approve' ? 'approved' : 'blocked';
    db.prepare('UPDATE cloak_reviews SET status=? WHERE id=? AND user_id=?').run(status, Number(rv[1]), uid);
    if (status === 'blocked') {
      const row = db.prepare('SELECT * FROM cloak_reviews WHERE id=? AND user_id=?').get(Number(rv[1]), uid);
      if (row) db.prepare('INSERT INTO cloak_whitelist (user_id,ip,note,created_at) VALUES (?,?,?,?)').run(uid, row.ip, '审核拒绝自动加黑', now());
    }
    return json(res, 200, { ok: true });
  }
  if (route === '/cloak/ips') {
    if (m === 'GET') return json(res, 200, { rows: db.prepare('SELECT * FROM cloak_ips WHERE user_id=? ORDER BY id DESC').all(uid) });
    const b = await readBody(req);
    db.prepare('INSERT INTO cloak_ips (user_id,cidr,asn,country,label,kind,created_at) VALUES (?,?,?,?,?,?,?)').run(uid, String(b.cidr || ''), String(b.asn || ''), String(b.country || ''), String(b.label || ''), String(b.kind || 'black'), now());
    return json(res, 200, { ok: true });
  }
  const ipDel = route.match(/^\/cloak\/ips\/(\d+)$/);
  if (ipDel && m === 'DELETE') { db.prepare('DELETE FROM cloak_ips WHERE id=? AND user_id=?').run(Number(ipDel[1]), uid); return json(res, 200, { ok: true }); }
  if (route === '/cloak/alerts') return json(res, 200, { rows: db.prepare('SELECT * FROM cloak_alerts WHERE user_id=? ORDER BY id DESC LIMIT 100').all(uid) });
  if (route === '/cloak/logs') return json(res, 200, { rows: db.prepare(`SELECT id,code AS page,ip,country,ua,action,created_at FROM visits WHERE user_id=? AND kind='page' ORDER BY id DESC LIMIT 200`).all(uid) });

  // ---- 一键仿站 / 上传源码 ----
  if (route === '/clone' && m === 'POST') {
    if (!premiumOk(user)) return json(res, 403, { error: '此功能仅限付费会员使用', code: 'MEMBERSHIP_REQUIRED' });
    const b = await readBody(req);
    const src = String(b.url || '').trim();
    if (!/^https?:\/\//i.test(src)) return json(res, 400, { error: '请输入 http(s) 地址' });
    try {
      const { html, host, assets } = await cloneFetchHtml(src, { dir: 'clone-sync-' + Date.now().toString(36) });
      const slug = (b.slug || ('clone-' + Date.now().toString(36))).replace(/[^a-z0-9-]/gi, '').toLowerCase() || 'clone';
      const page = createEntity('pages', uid, { name: b.name || (host + ' 仿站'), slug, template: 'blank', status: 'live', html, views: 0, conversions: 0 });
      db.prepare('INSERT INTO e_clone_jobs (user_id,created_at,updated_at,url,page,status) VALUES (?,?,?,?,?,?)').run(uid, now(), now(), src, slug, 'done');
      return json(res, 200, { ok: true, page, slug, bytes: html.length, assets });
    } catch (e) {
      db.prepare('INSERT INTO e_clone_jobs (user_id,created_at,updated_at,url,page,status) VALUES (?,?,?,?,?,?)').run(uid, now(), now(), src, '', 'failed: ' + e.message);
      return json(res, 502, { error: '仿站失败：' + e.message });
    }
  }
  // 异步仿站：建任务 → 后台抓取 → 状态轮询 → 确认入库 / 丢弃
  if (route === '/clone-async' && m === 'POST') {
    if (!premiumOk(user)) return json(res, 403, { error: '此功能仅限付费会员使用', code: 'MEMBERSHIP_REQUIRED' });
    const b = await readBody(req);
    const src = String(b.url || '').trim();
    if (!/^https?:\/\//i.test(src)) return json(res, 400, { error: '请输入 http(s) 地址' });
    const slug = (b.slug || ('clone-' + Date.now().toString(36))).replace(/[^a-z0-9-]/gi, '').toLowerCase() || 'clone';
    const ins = db.prepare('INSERT INTO e_clone_jobs (user_id,created_at,updated_at,url,page,status,stage,name) VALUES (?,?,?,?,?,?,?,?)')
      .run(uid, now(), now(), src, slug, 'queued', 'queued', String(b.name || ''));
    const id = Number(ins.lastInsertRowid);
    setImmediate(async () => {
      try {
        db.prepare(`UPDATE e_clone_jobs SET status='running', stage='fetching' WHERE id=?`).run(id);
        const { html, assets } = await cloneFetchHtml(src, { dir: 'clone-' + id });
        db.prepare(`UPDATE e_clone_jobs SET status='staged', stage='ready', html=?, page=?, assets=?, updated_at=? WHERE id=?`).run(html, slug, JSON.stringify(assets), now(), id);
      } catch (e) {
        db.prepare(`UPDATE e_clone_jobs SET status='failed', stage='error', error=?, updated_at=? WHERE id=?`).run(String(e.message).slice(0, 300), now(), id);
      }
    });
    return json(res, 200, { job: { id, status: 'queued', stage: 'queued', slug } });
  }
  if (route === '/clone-status' && m === 'GET') {
    const id = Number(new URL(req.url, 'http://x').searchParams.get('id') || 0);
    const job = db.prepare('SELECT id,status,stage,error,url,page,assets,created_at,updated_at,LENGTH(html) AS bytes FROM e_clone_jobs WHERE id=? AND user_id=?').get(id, uid);
    if (!job) return json(res, 404, { error: '任务不存在' });
    return json(res, 200, { job });
  }
  if (route === '/clone-confirm' && m === 'POST') {
    const b = await readBody(req);
    const job = db.prepare('SELECT * FROM e_clone_jobs WHERE id=? AND user_id=?').get(Number(b.id), uid);
    if (!job) return json(res, 404, { error: '任务不存在' });
    if (job.status !== 'staged' || !job.html) return json(res, 409, { error: '任务未就绪', status: job.status });
    const page = createEntity('pages', uid, { name: b.name || job.name || (job.url + ' 仿站'), slug: job.page, template: 'blank', status: 'live', html: job.html, views: 0, conversions: 0 });
    db.prepare(`UPDATE e_clone_jobs SET status='done', stage='confirmed', updated_at=? WHERE id=?`).run(now(), job.id);
    return json(res, 200, { ok: true, page });
  }
  if (route === '/clone-discard' && m === 'POST') {
    const b = await readBody(req);
    db.prepare(`UPDATE e_clone_jobs SET status='discarded', stage='discarded', html='', updated_at=? WHERE id=? AND user_id=?`).run(now(), Number(b.id), uid);
    return json(res, 200, { ok: true });
  }
  if (route === '/pages/upload' && m === 'POST') {
    const b = await readBody(req);
    if (!b.html) return json(res, 400, { error: 'HTML 不能为空' });
    const slug = (b.slug || ('upload-' + Date.now().toString(36))).replace(/[^a-z0-9-]/gi, '').toLowerCase();
    const page = createEntity('pages', uid, { name: b.name || '上传的落地页', slug, template: 'blank', status: 'live', html: String(b.html), views: 0, conversions: 0 });
    return json(res, 200, { ok: true, page });
  }
  // 文件上传（base64），落到 public/uploads 并回 URL
  if (route === '/upload' && m === 'POST') {
    const b = await readBody(req);
    const mime = String(b.mime || 'application/octet-stream');
    const ext = ({ 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif', 'image/svg+xml': 'svg', 'video/mp4': 'mp4', 'application/pdf': 'pdf' })[mime] || 'bin';
    const raw = String(b.data || '').replace(/^data:[^;]+;base64,/, '');
    const buf = Buffer.from(raw, 'base64');
    if (!buf.length) return json(res, 400, { error: '空文件' });
    if (buf.length > 8 * 1024 * 1024) return json(res, 413, { error: '文件超过 8MB' });
    const dir = path.join(PUB, 'uploads'); fs.mkdirSync(dir, { recursive: true });
    const name = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8) + '.' + ext;
    fs.writeFileSync(path.join(dir, name), buf);
    return json(res, 200, { ok: true, url: '/uploads/' + name, bytes: buf.length, mime });
  }
  // 留咨 Webhook
  if (route === '/lead-webhook') {
    if (m === 'GET') return json(res, 200, { url: settingGet(uid, 'lead_webhook') });
    const b = await readBody(req);
    settingSet(uid, 'lead_webhook', String(b.url || ''));
    return json(res, 200, { ok: true });
  }
  // 域名校验：查 TXT _scrm-verify.<domain> 是否含 token
  if (route === '/domains/verify' && m === 'POST') {
    const b = await readBody(req);
    const row = db.prepare('SELECT * FROM e_domains WHERE id=? AND user_id=?').get(Number(b.id), uid);
    if (!row) return json(res, 404, { error: '域名不存在' });
    const token = row.token || ('scrm-' + crypto.randomBytes(8).toString('hex'));
    db.prepare('UPDATE e_domains SET token=? WHERE id=? AND user_id=?').run(token, row.id, uid);
    try {
      const records = await require('dns').promises.resolveTxt('_scrm-verify.' + row.domain);
      const flat = records.map((r) => r.join('')).join(' ');
      const ok = flat.includes(token);
      if (ok) db.prepare(`UPDATE e_domains SET status='verified' WHERE id=?`).run(row.id);
      return json(res, 200, { ok, token, found: ok ? token : flat.slice(0, 200) });
    } catch (e) {
      return json(res, 200, { ok: false, token, error: e.code || e.message });
    }
  }

  // ---- S2S 回传 / 受众同步 ----
  if (route === '/s2s/test' && m === 'POST') {
    const b = await readBody(req);
    const row = db.prepare('SELECT * FROM e_s2s WHERE id=? AND user_id=?').get(Number(b.id), uid);
    if (!row) return json(res, 404, { error: '回传配置不存在' });
    const url = String(row.url || '').replace(/\{click_id\}/g, 'test_' + Date.now().toString(36)).replace(/\{event\}/g, row.event || 'test');
    let last = null;
    for (let i = 0; i < 2; i++) {
      try {
        const r = await fetchText(url, { method: 'GET' });
        last = { ok: r.status >= 200 && r.status < 400, status: r.status };
        if (last.ok) break;
      } catch (e) { last = { ok: false, error: e.message, status: 0 }; }
    }
    db.prepare('INSERT INTO s2s_logs (user_id,url,status,ok,error,created_at) VALUES (?,?,?,?,?,?)')
      .run(uid, url, last.status || 0, last.ok ? 1 : 0, last.error || '', now());
    return json(res, 200, Object.assign({ target: url }, last));
  }
  if (route === '/audiences/sync' && m === 'POST') {
    const b = await readBody(req);
    db.prepare('UPDATE e_audiences SET synced_at=? WHERE id=? AND user_id=?').run(now(), Number(b.id), uid);
    return json(res, 200, { ok: true });
  }

  // ---- 追踪短链 / 归因 / 身份图谱 ----
  if (route === '/tracking/link' && m === 'POST') {
    const b = await readBody(req);
    const row = db.prepare('SELECT * FROM e_tracking WHERE id=? AND user_id=?').get(Number(b.id), uid);
    if (!row) return json(res, 404, { error: '追踪不存在' });
    return json(res, 200, { link: '/t/' + (row.code || ('t' + row.id)) });
  }
  if (route === '/attribution') {
    const rows = db.prepare(`SELECT COALESCE(source,'direct') source, COALESCE(medium,'') medium, COALESCE(campaign,'') campaign, COUNT(*) clicks FROM visits WHERE user_id=? AND kind='track' GROUP BY source, medium, campaign ORDER BY clicks DESC`).all(uid);
    const conv = db.prepare(`SELECT source, COUNT(*) n FROM visits WHERE user_id=? AND kind='conversion' GROUP BY source`).all(uid);
    const convMap = Object.fromEntries(conv.map((c) => [c.source, Number(c.n)]));
    for (const r of rows) r.conversions = convMap[r.source] || 0;
    const forms = db.prepare('SELECT COUNT(*) n FROM e_forms WHERE user_id=?').get(uid).n;
    return json(res, 200, {
      clicks: Number(db.prepare(`SELECT COUNT(*) n FROM visits WHERE user_id=? AND kind='track'`).get(uid).n),
      conversions: Number(db.prepare(`SELECT COUNT(*) n FROM visits WHERE user_id=? AND kind='conversion'`).get(uid).n),
      forms: Number(forms), rows,
    });
  }
  if (route === '/identity') {
    const rows = db.prepare(`SELECT name, contact, created_at FROM e_forms WHERE user_id=? ORDER BY id DESC LIMIT 300`).all(uid);
    const map = {};
    for (const r of rows) {
      const key = String(r.contact || r.name || '').replace(/[^\d+]/g, '') || String(r.name || '');
      if (!map[key]) map[key] = { key, name: r.name, contact: r.contact, count: 0, first: r.created_at, platforms: new Set(['表单']) };
      map[key].count++;
    }
    const extra = db.prepare('SELECT * FROM e_identity_links WHERE user_id=?').all(uid);
    for (const e of extra) {
      const key = String(e.contact || '').replace(/[^\d+]/g, '') || String(e.contact || '');
      if (!map[key]) map[key] = { key, name: e.contact, contact: e.contact, count: 0, first: e.created_at, platforms: new Set() };
      map[key].platforms.add(e.platform || '未知');
      map[key].count++;
    }
    return json(res, 200, { rows: Object.values(map).map((x) => Object.assign({}, x, { platforms: [...x.platforms] })) });
  }

  // ---- Meta 投放 ----
  if (route === '/meta/launch' && m === 'POST') {
    const b = await readBody(req);
    const token = settingGet(uid, 'meta_token');
    if (!token) return json(res, 501, { error: 'NOT_CONFIGURED', message: 'Meta 未配置 access_token，请在设置里填写' });
    const account = String(b.account_id || '');
    if (!/^act_\d+$/.test(account)) return json(res, 400, { error: 'account_id 需形如 act_123456' });
    const name = String(b.name || ('campaign-' + Date.now().toString(36)));
    let remote = null;
    try {
      const r = await httpPostJson('https://graph.facebook.com/v20.0/' + account + '/campaigns', {
        name,
        objective: b.objective || 'OUTCOME_LEADS',
        status: 'PAUSED',
        special_ad_categories: [],
      }, 20000, { Authorization: 'Bearer ' + token });
      if (r.status >= 400) return json(res, 502, { error: 'Meta 拒绝：' + String(r.text).slice(0, 300) });
      remote = JSON.parse(r.text);
    } catch (e) {
      return json(res, 502, { error: 'Meta 请求失败：' + e.message });
    }
    const camp = createEntity('meta_campaigns', uid, { name, account_id: account, objective: b.objective || 'OUTCOME_LEADS', budget: Number(b.budget || 50), status: 'PAUSED', remote_id: remote && remote.id });
    createEntity('meta_ads', uid, { name: name + ' · ad1', campaign_name: name, creative: b.creative || '', status: 'PAUSED' });
    return json(res, 200, { ok: true, campaign: camp, remote_id: remote && remote.id });
  }
  if (route === '/meta/ad-account' && m === 'POST') {
    const b = await readBody(req);
    settingSet(uid, 'meta_ad_account', String(b.account || ''));
    return json(res, 200, { ok: true });
  }
  if (route === '/meta/token' && m === 'POST') {
    const b = await readBody(req);
    settingSet(uid, 'meta_token', String(b.token || ''));
    return json(res, 200, { ok: true, configured: !!b.token });
  }
  if (route === '/meta/summary') {
    const accounts = db.prepare('SELECT * FROM e_meta_accounts WHERE user_id=?').all(uid);
    const campaigns = db.prepare('SELECT * FROM e_meta_campaigns WHERE user_id=?').all(uid);
    const ads = db.prepare('SELECT * FROM e_meta_ads WHERE user_id=?').all(uid);
    return json(res, 200, { accounts, campaigns, ads, spend: accounts.reduce((a, x) => a + Number(x.spend || 0), 0) });
  }

  // 页面编辑器 / 版本历史
  {
    const pg = route.match(/^\/pages\/(\d+)(\/versions|\/restore|\/form)?$/);
    if (pg) {
      const id = Number(pg[1]);
      const page = db.prepare('SELECT * FROM e_pages WHERE id=? AND user_id=?').get(id, uid);
      if (!page) return json(res, 404, { error: '页面不存在' });
      if (!pg[2] && m === 'GET') return json(res, 200, { page });
      if (!pg[2] && (m === 'PUT' || m === 'PATCH')) {
        const b = await readBody(req);
        db.prepare('INSERT INTO page_versions (user_id,page_id,html,name,note,created_at) VALUES (?,?,?,?,?,?)')
          .run(uid, id, String(page.html || ''), String(page.name || ''), String(b.note || '保存前快照'), now());
        updateEntity('pages', uid, id, { name: b.name == null ? page.name : String(b.name), html: b.html == null ? page.html : String(b.html), status: b.status || page.status });
        return json(res, 200, { ok: true, page: db.prepare('SELECT id,name,status,updated_at FROM e_pages WHERE id=?').get(id) });
      }
      if (pg[2] === '/versions' && m === 'GET') {
        return json(res, 200, { versions: db.prepare('SELECT id,name,note,created_at,LENGTH(html) bytes FROM page_versions WHERE page_id=? AND user_id=? ORDER BY id DESC LIMIT 50').all(id, uid) });
      }
      if (pg[2] === '/restore' && m === 'POST') {
        const b = await readBody(req);
        const ver = db.prepare('SELECT * FROM page_versions WHERE id=? AND page_id=? AND user_id=?').get(Number(b.version_id), id, uid);
        if (!ver) return json(res, 404, { error: '版本不存在' });
        db.prepare('INSERT INTO page_versions (user_id,page_id,html,name,note,created_at) VALUES (?,?,?,?,?,?)')
          .run(uid, id, String(page.html || ''), String(page.name || ''), '恢复前快照', now());
        updateEntity('pages', uid, id, { html: ver.html, name: ver.name || page.name });
        return json(res, 200, { ok: true, restored: ver.id });
      }
      if (pg[2] === '/form') {
        if (m === 'GET') {
          let fields = [];
          try { fields = JSON.parse(page.form_fields || '[]'); } catch (e) {}
          return json(res, 200, { fields, webhook: page.form_webhook || '' });
        }
        const b = await readBody(req);
        const fields = Array.isArray(b.fields) ? b.fields : [];
        db.prepare('UPDATE e_pages SET form_fields=?, form_webhook=? WHERE id=? AND user_id=?')
          .run(JSON.stringify(fields), String(b.webhook || ''), id, uid);
        logOp(uid, 'admin', 'page.form.save', 'page#' + id + ' fields=' + fields.length);
        return json(res, 200, { ok: true, fields, webhook: b.webhook || '' });
      }
    }
  }

  // 极速分流：分流服务 / 工单 / 号池
  if (route === '/fast/services') {
    if (m === 'GET') return json(res, 200, { rows: db.prepare('SELECT * FROM fast_services WHERE user_id=? ORDER BY id DESC').all(uid) });
    if (m === 'POST') {
      const b = await readBody(req);
      if (!b.name) return json(res, 400, { error: '服务名必填' });
      const info = db.prepare('INSERT INTO fast_services (user_id,name,platform,greeting,code,created_at) VALUES (?,?,?,?,?,?)')
        .run(uid, String(b.name), String(b.platform || 'WhatsApp'), String(b.greeting || ''), 'fs_' + crypto.randomBytes(3).toString('hex'), now());
      return json(res, 200, { ok: true, id: Number(info.lastInsertRowid) });
    }
    if (m === 'DELETE') {
      const b = await readBody(req);
      db.prepare('DELETE FROM fast_services WHERE id=? AND user_id=?').run(Number(b.id || 0), uid);
      return json(res, 200, { ok: true });
    }
  }
  if (route === '/fast/workorders') {
    if (m === 'GET') return json(res, 200, { rows: db.prepare('SELECT * FROM fast_workorders WHERE user_id=? ORDER BY id DESC').all(uid) });
    if (m === 'POST') {
      const b = await readBody(req);
      if (!b.name) return json(res, 400, { error: '工单名必填' });
      const info = db.prepare(`INSERT INTO fast_workorders (user_id,name,service_id,platform,share_code,interval_min,auto_disable,auto_optimize,daily_limit,status,created_at)
        VALUES (?,?,?,?,?,?,?,?,?,'active',?)`).run(uid, String(b.name), Number(b.service_id || 0), String(b.platform || 'WhatsApp'), String(b.share_code || ''), Math.max(3, Number(b.interval_min || 5)), b.auto_disable ? 1 : 0, b.auto_optimize ? 1 : 0, Number(b.daily_limit || 0), now());
      return json(res, 200, { ok: true, id: Number(info.lastInsertRowid) });
    }
    if (m === 'DELETE') {
      const b = await readBody(req);
      db.prepare('DELETE FROM fast_workorders WHERE id=? AND user_id=?').run(Number(b.id || 0), uid);
      db.prepare('DELETE FROM fast_pool WHERE workorder_id=? AND user_id=?').run(Number(b.id || 0), uid);
      return json(res, 200, { ok: true });
    }
  }
  const fw = route.match(/^\/fast\/workorders\/(\d+)\/(test|fetch)$/);
  if (fw && m === 'POST') {
    const wo = db.prepare('SELECT * FROM fast_workorders WHERE id=? AND user_id=?').get(Number(fw[1]), uid);
    if (!wo) return json(res, 404, { error: '工单不存在' });
    if (fw[2] === 'test') {
      const code = String(wo.share_code || '');
      if (!code) return json(res, 400, { error: '先填共享码' });
      const owner = db.prepare('SELECT id,invite_code FROM users WHERE invite_code=? OR invite_code=?').get(code, code.replace(/^chm_/i, ''));
      if (!/^chm_/i.test(code) && !owner) return json(res, 400, { error: '共享码无效' });
      const online = db.prepare("SELECT COUNT(*) n FROM fast_pool WHERE workorder_id=? AND status='online'").get(wo.id).n;
      return json(res, 200, { ok: true, code, online, total: online });
    }
    // fetch：从本地号池来源抓取（这里用 client 子账号模拟号池；没有新号时返回 0）
    const r = fetchWorkorder(uid, wo);
    return json(res, 200, { ok: true, added: r.added, total: r.total });
  }
  if (route === '/fast/pool') {
    const q = uQuery(req);
    let sql = 'SELECT p.*, w.name AS workorder_name FROM fast_pool p LEFT JOIN fast_workorders w ON w.id=p.workorder_id WHERE p.user_id=?';
    const args = [uid];
    if (q.workorder_id) { sql += ' AND p.workorder_id=?'; args.push(Number(q.workorder_id)); }
    sql += ' ORDER BY p.id DESC LIMIT 300';
    return json(res, 200, { rows: db.prepare(sql).all(...args) });
  }

  // 身份图谱 / 数据追踪
  if (route === '/identity/summary') {
    const rows = db.prepare('SELECT ip, ua, COUNT(*) visits, MIN(created_at) first, MAX(created_at) last FROM visits WHERE user_id=? GROUP BY ip, ua').all(uid);
    const ids = rows.map((r) => ({ key: crypto.createHash('sha1').update(r.ip + '|' + r.ua).digest('hex').slice(0, 12), ip: r.ip, ua: r.ua, visits: r.visits, first: r.first, last: r.last }));
    const leads = db.prepare('SELECT COUNT(*) n FROM e_forms WHERE user_id=?').get(uid).n;
    return json(res, 200, { total: ids.length, multi: ids.filter((x) => x.visits > 1).length, leads, rows: ids.slice(0, 100) });
  }
  if (route === '/tracking/summary') {
    const day = new Date().toISOString().slice(0, 10);
    const visits = db.prepare("SELECT COUNT(*) n FROM visits WHERE user_id=? AND kind='page' AND created_at>=?").get(uid, day).n;
    const clicks = db.prepare("SELECT COUNT(*) n FROM visits WHERE user_id=? AND action='click' AND created_at>=?").get(uid, day).n;
    const leads = db.prepare('SELECT COUNT(*) n FROM e_forms WHERE user_id=? AND created_at>=?').get(uid, day).n;
    const conv = db.prepare("SELECT COUNT(*) n FROM visits WHERE user_id=? AND kind='conversion' AND created_at>=?").get(uid, day).n;
    return json(res, 200, { day, visits, clicks, leads, conversions: conv });
  }
  if (route === '/tracking/events') {
    const rows = db.prepare('SELECT id,kind,code,ip,country,action,source,medium,campaign,created_at FROM visits WHERE user_id=? ORDER BY id DESC LIMIT 200').all(uid);
    return json(res, 200, { rows });
  }

  // 受众同步到 Meta 自定义受众
  if (route === '/ads/audience/sync' && m === 'POST') {
    const b = await readBody(req);
    const aud = db.prepare('SELECT * FROM e_audiences WHERE id=? AND user_id=?').get(Number(b.id || 0), uid);
    if (!aud) return json(res, 404, { error: '受众不存在' });
    const token = settingGet(uid, 'meta_token');
    const account = String(b.ad_account || aud.ad_account || settingGet(uid, 'meta_ad_account') || '');
    if (!token) return json(res, 501, { error: 'NOT_CONFIGURED', message: '先填 Meta access_token（设置 → Meta）' });
    if (!/^act_\d+$/.test(account)) return json(res, 400, { error: '广告账户需形如 act_123456' });
    const clientUid = (db.prepare("SELECT id FROM users WHERE realm='client' ORDER BY id LIMIT 1").get() || {}).id || uid;
    const rows = db.prepare('SELECT contact FROM e_customers WHERE user_id=?').all(clientUid);
    const emails = [], phones = [];
    for (const r of rows) {
      const v = String(r.contact || '').trim();
      if (!v) continue;
      if (v.includes('@')) emails.push(crypto.createHash('sha256').update(v.toLowerCase()).digest('hex'));
      else {
        const digits = v.replace(/\D/g, '');
        if (digits.length >= 8) phones.push(crypto.createHash('sha256').update(digits).digest('hex'));
      }
    }
    const data = [...emails.map((h) => [h, '']), ...phones.map((h) => ['', h])].slice(0, 10000);
    if (!data.length) return json(res, 400, { error: '没有可同步的联系方式（客户表为空）' });
    try {
      let remoteId = String(aud.remote_id || '');
      if (!remoteId) {
        const c = await httpPostJson('https://graph.facebook.com/v20.0/' + account + '/customaudiences', {
          name: aud.name || ('aud-' + Date.now().toString(36)),
          subtype: 'CUSTOM',
          customer_file_source: 'USER_PROVIDED_ONLY',
          description: 'synced by 超级聚合',
        }, 20000, { Authorization: 'Bearer ' + token });
        if (c.status >= 400) return json(res, 502, { error: 'Meta 创建受众失败：' + String(c.text).slice(0, 300) });
        remoteId = String(JSON.parse(c.text).id || '');
        if (!remoteId) return json(res, 502, { error: 'Meta 未返回受众 ID' });
      }
      let uploaded = 0;
      for (let i = 0; i < data.length; i += 500) {
        const batch = data.slice(i, i + 500);
        const u = await httpPostJson('https://graph.facebook.com/v20.0/' + remoteId + '/users', {
          payload: { schema: ['EMAIL_SHA256', 'PHONE_SHA256'], data: batch },
        }, 20000, { Authorization: 'Bearer ' + token });
        if (u.status >= 400) return json(res, 502, { error: 'Meta 上传失败：' + String(u.text).slice(0, 300) });
        uploaded += batch.length;
      }
      db.prepare('UPDATE e_audiences SET remote_id=?, size=?, ad_account=?, synced_at=?, last_error=? WHERE id=? AND user_id=?')
        .run(remoteId, uploaded, account, now(), '', aud.id, uid);
      logOp(uid, 'admin', 'audience.sync', 'aud#' + aud.id + ' -> ' + remoteId + ' (' + uploaded + ')');
      return json(res, 200, { ok: true, remote_id: remoteId, uploaded });
    } catch (e) {
      db.prepare('UPDATE e_audiences SET last_error=? WHERE id=? AND user_id=?').run(String(e.message).slice(0, 300), aud.id, uid);
      return json(res, 502, { error: '同步失败：' + e.message });
    }
  }

  // 广告回传：日志、手动回传、一键诊断
  if (route === '/ads/logs') {
    const rows = db.prepare('SELECT * FROM s2s_logs WHERE user_id=? ORDER BY id DESC LIMIT 100').all(uid);
    const visits = db.prepare("SELECT id,kind,code,action,created_at FROM visits WHERE user_id=? AND kind IN ('conversion','link','track') ORDER BY id DESC LIMIT 50").all(uid);
    return json(res, 200, { rows, visits });
  }
  if (route === '/ads/manual' && m === 'POST') {
    const b = await readBody(req);
    const ev = db.prepare('SELECT * FROM e_events WHERE id=? AND user_id=?').get(Number(b.event_id || 0), uid);
    if (!ev) return json(res, 404, { error: '事件不存在' });
    if (!ev.postback_url) return json(res, 400, { error: '这个事件没配回传地址' });
    const url = String(ev.postback_url).replace(/\{click_id\}/g, encodeURIComponent(String(b.click_id || 'test-' + Date.now())));
    const r = await httpPostJson(url, { event: ev.event_type || 'Lead', pixel_id: ev.pixel_id || '', ts: Date.now() }).catch((e) => ({ status: 0, error: e.message }));
    db.prepare('INSERT INTO s2s_logs (user_id,url,status,ok,error,created_at) VALUES (?,?,?,?,?,?)')
      .run(uid, url, r.status || 0, r.status >= 200 && r.status < 300 ? 1 : 0, r.error || '', now());
    return json(res, 200, { ok: r.status >= 200 && r.status < 300, status: r.status || 0, url });
  }
  if (route === '/ads/diagnose') {
    const events = db.prepare('SELECT COUNT(*) n FROM e_events WHERE user_id=?').get(uid).n;
    const active = db.prepare("SELECT COUNT(*) n FROM e_events WHERE user_id=? AND status='active'").get(uid).n;
    const pages = db.prepare('SELECT COUNT(*) n FROM e_pages WHERE user_id=?').get(uid).n;
    const logs = db.prepare('SELECT COUNT(*) n FROM s2s_logs WHERE user_id=?').get(uid).n;
    const last = db.prepare('SELECT * FROM s2s_logs WHERE user_id=? ORDER BY id DESC LIMIT 1').get(uid);
    const checks = [
      { name: '已创建回传事件', ok: events > 0, detail: events + ' 个' },
      { name: '有启用中的事件', ok: active > 0, detail: active + ' 个' },
      { name: '有落地页可关联', ok: pages > 0, detail: pages + ' 个' },
      { name: '有回传日志', ok: logs > 0, detail: logs + ' 条' },
    ];
    return json(res, 200, { checks, last: last || null });
  }

  // 斗篷：指纹、拦截记录、统计、白名单、待审核
  if (route === '/cloak/meta') {
    const v = visitorOf(req);
    const today = new Date().toISOString().slice(0, 10);
    const rules = db.prepare('SELECT COUNT(*) n FROM e_cloak_rules WHERE user_id=?').get(uid).n;
    const active = db.prepare(`SELECT COUNT(*) n FROM e_cloak_rules WHERE user_id=? AND CAST(COALESCE(enabled,0) AS REAL)=1`).get(uid).n;
    const blocked = db.prepare("SELECT COUNT(*) n FROM visits WHERE user_id=? AND action LIKE 'block%' AND created_at>=?").get(uid, today).n;
    return json(res, 200, { visitor: v, counts: { rules, active, blocked_today: blocked } });
  }
  if (route === '/cloak/records') {
    const q = uQuery(req);
    let sql = "SELECT id,kind,code,ip,country,ua,action,created_at FROM visits WHERE user_id=? AND (action LIKE 'block%' OR action LIKE 'review%')";
    const args = [uid];
    if (q.code) { sql += ' AND code=?'; args.push(q.code); }
    sql += ' ORDER BY id DESC LIMIT 200';
    return json(res, 200, { rows: db.prepare(sql).all(...args) });
  }
  if (route === '/cloak/stats') {
    const since = new Date(Date.now() - 14 * 86400e3).toISOString();
    const rows = db.prepare("SELECT substr(created_at,1,10) d, action, COUNT(*) n FROM visits WHERE user_id=? AND created_at>=? GROUP BY d, action ORDER BY d DESC").all(uid, since);
    return json(res, 200, { rows });
  }
  if (route === '/cloak/whitelist') {
    if (m === 'GET') return json(res, 200, { rows: db.prepare('SELECT * FROM cloak_whitelist WHERE user_id=? ORDER BY id DESC').all(uid) });
    if (m === 'POST') {
      const b = await readBody(req);
      if (!b.ip) return json(res, 400, { error: 'IP 必填' });
      db.prepare('INSERT INTO cloak_whitelist (user_id,ip,note,created_at) VALUES (?,?,?,?)').run(uid, String(b.ip), String(b.note || ''), now());
      return json(res, 200, { ok: true });
    }
    if (m === 'DELETE') {
      const b = await readBody(req);
      db.prepare('DELETE FROM cloak_whitelist WHERE id=? AND user_id=?').run(Number(b.id || 0), uid);
      return json(res, 200, { ok: true });
    }
  }
  if (route === '/cloak/asn-block/import' && m === 'POST') {
    const q = uQuery(req);
    const strict = String(q.strict || '') === '1';
    const file = path.join(DATA_DIR, 'data', strict ? 'asn-blocklist-strict.txt' : 'asn-blocklist.txt');
    if (!fs.existsSync(file)) return json(res, 400, { error: 'ASN 清单文件不存在：' + path.basename(file) });
    const nums = [...new Set(fs.readFileSync(file, 'utf8').split(/\s+/).map((x) => x.trim()).filter((x) => /^\d+$/.test(x)))];
    if (!nums.length) return json(res, 400, { error: '清单为空' });
    const existing = db.prepare("SELECT * FROM e_cloak_rules WHERE user_id=? AND name='ASN 机房封锁'").get(uid);
    if (existing) {
      db.prepare('UPDATE e_cloak_rules SET asn_list=?, enabled=1, action=?, updated_at=? WHERE id=?').run(nums.join('\n'), 'block', now(), existing.id);
    } else {
      createEntity('cloak_rules', uid, { name: 'ASN 机房封锁', enabled: '1', action: 'block', asn_list: nums.join('\n') });
    }
    logOp(uid, 'admin', 'cloak.asn.import', 'asn=' + nums.length);
    return json(res, 200, { ok: true, count: nums.length });
  }
  if (route === '/cloak/ipdb/status') {
    const meta = {};
    try { for (const r of db.prepare('SELECT key,value FROM ipdb_meta').all()) meta[r.key] = r.value; } catch (e) {}
    let files = [];
    try { files = fs.readdirSync(path.join(DATA_DIR, 'data', 'ipdb')); } catch (e) {}
    return json(res, 200, { meta, files });
  }
  if (route === '/cloak/ipdb/import' && m === 'POST') {
    try {
      const out = importIpdbFromDir(path.join(DATA_DIR, 'data', 'ipdb'));
      logOp(uid, 'admin', 'ipdb.import', JSON.stringify(out));
      return json(res, 200, { ok: true, imported: out });
    } catch (e) { return json(res, 500, { error: e.message }); }
  }
  if (route === '/cloak/ip-lookup') {
    const q = uQuery(req);
    const ip = String(q.ip || '').trim();
    if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) return json(res, 400, { error: 'IP 格式不对' });
    const c = ipdbCountry(ip);
    const a = ipdbAsn(ip);
    if (c || a) {
      return json(res, 200, { ok: true, source: 'ipdb', data: {
        query: ip,
        country: c ? c.country_name : '',
        countryCode: c ? c.country : '',
        as: a ? ('AS' + a.asn + ' ' + (a.org || '')) : '',
        isp: a ? a.org : '',
      } });
    }
    try {
      const r = await fetchText('http://ip-api.com/json/' + ip + '?fields=status,country,countryCode,regionName,city,isp,org,as,query');
      const d = JSON.parse(r.text);
      return json(res, 200, { ok: d.status === 'success', source: 'ip-api', data: d });
    } catch (e) { return json(res, 502, { error: '查询失败：' + e.message }); }
  }
  if (route === '/cloak/alerts') {
    if (m === 'GET') return json(res, 200, { rows: db.prepare('SELECT * FROM cloak_alerts WHERE user_id=? ORDER BY id DESC LIMIT 100').all(uid) });
    if (m === 'POST') {
      const b = await readBody(req);
      if (b.id) db.prepare('UPDATE cloak_alerts SET read=1 WHERE id=? AND user_id=?').run(Number(b.id), uid);
      else db.prepare('UPDATE cloak_alerts SET read=1 WHERE user_id=?').run(uid);
      return json(res, 200, { ok: true });
    }
  }
  if (route === '/cloak/ip-lookup') {
    const q = uQuery(req);
    const ip = String(q.ip || '').trim();
    if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) return json(res, 400, { error: 'IP 格式不对' });
    try {
      const r = await fetchText('http://ip-api.com/json/' + ip + '?fields=status,country,countryCode,regionName,city,isp,org,as,query');
      const d = JSON.parse(r.text);
      return json(res, 200, { ok: d.status === 'success', data: d });
    } catch (e) { return json(res, 502, { error: '查询失败：' + e.message }); }
  }
  if (route === '/cloak/reviews') {
    if (m === 'GET') return json(res, 200, { rows: db.prepare("SELECT * FROM cloak_reviews WHERE user_id=? ORDER BY id DESC LIMIT 100").all(uid) });
    if (m === 'POST') {
      const b = await readBody(req);
      const action = String(b.action || '');
      if (!['approve', 'reject'].includes(action)) return json(res, 400, { error: 'action 必须是 approve/reject' });
      db.prepare('UPDATE cloak_reviews SET status=? WHERE id=? AND user_id=?').run(action === 'approve' ? 'approved' : 'rejected', Number(b.id || 0), uid);
      if (action === 'approve') {
        const rv = db.prepare('SELECT * FROM cloak_reviews WHERE id=? AND user_id=?').get(Number(b.id || 0), uid);
        if (rv && rv.ip) {
          const ex = db.prepare('SELECT id FROM cloak_whitelist WHERE user_id=? AND ip=?').get(uid, rv.ip);
          if (!ex) db.prepare('INSERT INTO cloak_whitelist (user_id,ip,note,created_at) VALUES (?,?,?,?)').run(uid, rv.ip, '审核通过自动加入', now());
        }
      }
      return json(res, 200, { ok: true });
    }
  }

  // 开口广告回传
  if (route === '/openchat') {
    const cfg = openchatConfig(uid);
    const pixels = db.prepare('SELECT * FROM openchat_pixels WHERE user_id=? ORDER BY id DESC').all(uid);
    const events = db.prepare('SELECT * FROM openchat_events WHERE user_id=? ORDER BY id DESC LIMIT 50').all(uid);
    const links = db.prepare('SELECT id,token,platform,staff,target,greeting,created_at FROM openchat_links WHERE user_id=? ORDER BY id DESC LIMIT 50').all(uid);
    const since = new Date(Date.now() - 86400e3).toISOString();
    const stats = {
      opens: db.prepare('SELECT COUNT(*) n FROM openchat_events WHERE user_id=? AND created_at>=?').get(uid, since).n,
      reported: db.prepare("SELECT COUNT(*) n FROM openchat_events WHERE user_id=? AND status='reported' AND created_at>=?").get(uid, since).n,
      pending: db.prepare("SELECT COUNT(*) n FROM openchat_events WHERE user_id=? AND status='pending' AND created_at>=?").get(uid, since).n,
      clicks: db.prepare('SELECT COUNT(*) n FROM openchat_clicks WHERE user_id=? AND created_at>=?').get(uid, since).n,
    };
    return json(res, 200, { config: cfg, pixels, events, links, stats });
  }
  if (route === '/openchat/config' && m === 'POST') {
    const b = await readBody(req);
    openchatConfig(uid);
    db.prepare('UPDATE openchat_config SET enabled=?, identify_mode=?, event=?, platforms=?, window_min=?, dedupe=?, hash_phone=?, public_base=?, updated_at=? WHERE user_id=?')
      .run(b.enabled ? 1 : 0, String(b.identify_mode || 'click'), String(b.event || 'Lead'), String(b.platforms || 'WhatsApp,LINE,Telegram,Kakao'), Math.max(1, Number(b.window_min) || 30), b.dedupe === false ? 0 : 1, b.hash_phone ? 1 : 0, String(b.public_base || '').trim().replace(/\/+$/, '').slice(0, 300), now(), uid);
    logOp(uid, 'admin', 'openchat.config', 'enabled=' + (b.enabled ? 1 : 0));
    return json(res, 200, { ok: true, config: openchatConfig(uid) });
  }
  if (route === '/openchat/connect' && m === 'POST') {
    const b = await readBody(req);
    const code = String(b.code || '').trim();
    if (!code) return json(res, 400, { error: '请填写共享码' });
    const owner = db.prepare('SELECT id,invite_code FROM users WHERE invite_code=? OR invite_code=?').get(code, code.replace(/^chm_/i, ''));
    if (!/^chm_/i.test(code) && !owner) return json(res, 400, { error: '共享码无效' });
    openchatConfig(uid);
    const trial = new Date(Date.now() + 7 * 86400e3).toISOString();
    db.prepare(`UPDATE openchat_config SET status='connected', share_code=?, trial_until=?, updated_at=? WHERE user_id=?`).run(code, trial, now(), uid);
    logOp(uid, 'admin', 'openchat.connect', code.slice(0, 12));
    return json(res, 200, { ok: true, status: 'connected', trial_until: trial, config: openchatConfig(uid) });
  }
  if (route === '/openchat/pair' && m === 'GET') {
    const pair = db.prepare('SELECT * FROM openchat_pairs WHERE user_id=? ORDER BY id DESC LIMIT 1').get(uid);
    return json(res, 200, { pair: pair || null, config: openchatConfig(uid) });
  }
  if (route === '/openchat/pair/approve' && m === 'POST') {
    const b = await readBody(req);
    const pair = db.prepare(`SELECT * FROM openchat_pairs WHERE user_id=? AND status='pending' ORDER BY id DESC LIMIT 1`).get(uid);
    if (!pair) return json(res, 404, { error: '没有待处理配对' });
    if (pair.expires_at && new Date(pair.expires_at).getTime() < Date.now()) return json(res, 410, { error: '配对码已过期' });
    if (String(b.code || '') !== String(pair.code)) return json(res, 400, { error: '配对码不一致' });
    const approve = b.approve !== false;
    db.prepare('UPDATE openchat_pairs SET status=?,decided_at=? WHERE id=?').run(approve ? 'approved' : 'rejected', now(), pair.id);
    if (approve) {
      const trial = new Date(Date.now() + 7 * 86400e3).toISOString();
      db.prepare(`UPDATE openchat_config SET status='connected',trial_until=?,updated_at=? WHERE user_id=?`).run(trial, now(), uid);
    } else {
      db.prepare(`UPDATE openchat_config SET status='disconnected',updated_at=? WHERE user_id=?`).run(now(), uid);
    }
    return json(res, 200, { ok: true, status: approve ? 'connected' : 'rejected', pair: db.prepare('SELECT * FROM openchat_pairs WHERE id=?').get(pair.id), config: openchatConfig(uid) });
  }
  if (route === '/openchat/disconnect' && m === 'POST') {
    openchatConfig(uid);
    db.prepare(`UPDATE openchat_config SET status='disconnected', updated_at=? WHERE user_id=?`).run(now(), uid);
    return json(res, 200, { ok: true });
  }
  if (route === '/openchat/pixels' && m === 'POST') {
    const b = await readBody(req);
    if (!b.platform || !b.pixel_id) return json(res, 400, { error: '平台和像素 ID 必填' });
    if (!['Facebook', 'TikTok'].includes(String(b.platform))) return json(res, 400, { error: '平台仅支持 Facebook / TikTok' });
    const info = db.prepare('INSERT INTO openchat_pixels (user_id,platform,pixel_id,token,test_event_code,status,updated_at,created_at) VALUES (?,?,?,?,?,?,?,?)')
      .run(uid, String(b.platform), String(b.pixel_id), String(b.token || ''), String(b.test_event_code || ''), 'unverified', now(), now());
    return json(res, 200, { ok: true, id: Number(info.lastInsertRowid) });
  }
  const pxDel = route.match(/^\/openchat\/pixels\/(\d+)$/);
  if (pxDel && m === 'DELETE') {
    db.prepare('DELETE FROM openchat_pixels WHERE id=? AND user_id=?').run(Number(pxDel[1]), uid);
    return json(res, 200, { ok: true });
  }
  const pxAct = route.match(/^\/openchat\/pixels\/(\d+)\/(verify|test)$/);
  if (pxAct && m === 'POST') {
    const pixel = db.prepare('SELECT * FROM openchat_pixels WHERE id=? AND user_id=?').get(Number(pxAct[1]), uid);
    if (!pixel) return json(res, 404, { error: '像素不存在' });
    if (pxAct[2] === 'verify') {
      try {
        let ok = false, detail = '';
        if (pixel.platform === 'Facebook') {
          const r = await fetch('https://graph.facebook.com/v20.0/' + encodeURIComponent(pixel.pixel_id) + '?access_token=' + encodeURIComponent(pixel.token || ''), { signal: AbortSignal.timeout(10000) });
          const body = await r.json().catch(() => ({}));
          ok = r.ok && !body.error; detail = body.error?.message || body.name || '';
          if (!ok && pixel.test_event_code) {
            try { const sent = await sendOpenchatPixel(pixel, String(openchatConfig(uid).event || 'Lead'), openchatEventId(uid), '8613800000000', String(pixel.test_event_code)); ok = !!sent.ok; detail = ok ? '测试事件已发送' : (sent.error || detail); } catch (error) { detail = String(error?.message || error); }
          } else if (!ok && body.error?.code === 100 && /permission/i.test(String(body.error?.message || ''))) {
            ok = true; detail = '令牌可发送事件，但缺少读取像素权限';
          }
        } else {
          const r = await fetch('https://business-api.tiktok.com/open_api/v1.3/pixel/list/?advertiser_id=' + encodeURIComponent(pixel.pixel_id), { headers: { 'Access-Token': pixel.token || '' }, signal: AbortSignal.timeout(10000) });
          const body = await r.json().catch(() => ({}));
          ok = r.ok && Number(body.code || 0) === 0; detail = body.message || '';
        }
        db.prepare('UPDATE openchat_pixels SET status=?,last_error=?,updated_at=? WHERE id=?').run(ok ? 'verified' : 'invalid', ok ? '' : String(detail).slice(0, 300), now(), pixel.id);
        return json(res, 200, { ok, status: ok ? 'verified' : 'invalid', detail: String(detail).slice(0, 300) });
      } catch (error) { return json(res, 200, { ok: false, status: 'invalid', detail: String(error?.message || error) }); }
    }
    try {
      const sent = await sendOpenchatPixel(pixel, String(openchatConfig(uid).event || 'Lead'), openchatEventId(uid), '8613800000000', String(pixel.test_event_code || ''));
      db.prepare('UPDATE openchat_pixels SET status=?,last_error=?,updated_at=? WHERE id=?').run('verified', '', now(), pixel.id);
      return json(res, 200, { ok: true, ...sent });
    } catch (error) {
      db.prepare('UPDATE openchat_pixels SET status=?,last_error=?,updated_at=? WHERE id=?').run('invalid', String(error?.message || error).slice(0, 300), now(), pixel.id);
      return json(res, 200, { ok: false, error: String(error?.message || error) });
    }
  }
  if (route === '/openchat/click' && m === 'POST') {
    const b = await readBody(req);
    const info = db.prepare('INSERT INTO openchat_clicks (user_id,platform,staff,ad,identify,created_at) VALUES (?,?,?,?,?,?)')
      .run(uid, String(b.platform || 'WhatsApp'), String(b.staff || ''), String(b.ad || ''), String(b.identify || ''), now());
    return json(res, 200, { ok: true, id: Number(info.lastInsertRowid) });
  }
  if (route === '/openchat/open' && m === 'POST') {
    const b = await readBody(req);
    const cfg = openchatConfig(uid);
    if (!cfg.enabled || cfg.status !== 'connected') return json(res, 403, { error: '开口回传未启用或未连接' });
    const platform = openchatPlatformName(b.platform || 'WhatsApp');
    const phone = String(b.phone || b.contact || '').trim();
    if (cfg.dedupe && phone && db.prepare(`SELECT id FROM openchat_events WHERE user_id=? AND status='reported' AND identify=?`).get(uid, phone)) return json(res, 200, { ok: true, status: 'duplicate' });
    const click = openchatMatchClick(uid, platform, String(b.staff || ''), String(b.identify || ''), String(b.fingerprint || ''));
    const pixel = db.prepare('SELECT * FROM openchat_pixels WHERE user_id=? AND platform=?').get(uid, platform);
    const eventName = String(b.event || cfg.event || 'Lead');
    const status = !click ? 'unmatched' : pixel ? 'pending' : 'no_pixel';
    const info = db.prepare(`INSERT INTO openchat_events (user_id,platform,staff,identify,ad,event,status,click_id,created_at) VALUES (?,?,?,?,?,?,?,?,?)`)
      .run(uid, platform, String(b.staff || ''), phone || String(b.identify || ''), click?.ad || '', eventName, status, click?.id || null, now());
    const id = Number(info.lastInsertRowid);
    if (status === 'pending' && pixel) {
      try {
        await sendOpenchatPixel(pixel, eventName, openchatEventId(uid), phone, '', String(b.identify || ''));
        db.prepare(`UPDATE openchat_events SET status='reported',reported_at=? WHERE id=?`).run(now(), id);
      } catch (error) {
        db.prepare(`UPDATE openchat_events SET status='failed',error=? WHERE id=?`).run(String(error?.message || error).slice(0, 300), id);
      }
    }
    return json(res, 200, { ok: true, id, status: db.prepare('SELECT status,error FROM openchat_events WHERE id=?').get(id) });
  }
  if (route === '/openchat/links' && m === 'POST') {
    const b = await readBody(req);
    const target = String(b.target || '').trim();
    if (!target) return json(res, 400, { error: '客服号/手机号必填' });
    const token = crypto.randomBytes(8).toString('hex');
    const platform = openchatPlatformName(b.platform || 'WhatsApp');
    const staff = String(b.staff || '').slice(0, 120);
    const greeting = String(b.greeting || 'Hi').replace(/[\u200b\u200c\u2063]/g, '').slice(0, 200) || 'Hi';
    db.prepare('INSERT INTO openchat_links (user_id,token,platform,staff,target,greeting,created_at) VALUES (?,?,?,?,?,?,?)')
      .run(uid, token, platform, staff, target, greeting, now());
    const base = String(openchatConfig(uid).public_base || '').replace(/\/+$/, '') || ('http://' + String(req.headers.host || '127.0.0.1:18801'));
    return json(res, 200, { ok: true, token, path: '/oc/l/' + token, url: base + '/oc/l/' + token, platform, staff, target, greeting });
  }
  if (route === '/openchat/events') {
    const q = uQuery(req);
    let sql = 'SELECT * FROM openchat_events WHERE user_id=?';
    const args = [uid];
    if (q.platform) { sql += ' AND platform=?'; args.push(q.platform); }
    if (q.status) { sql += ' AND status=?'; args.push(q.status); }
    sql += ' ORDER BY id DESC LIMIT 200';
    return json(res, 200, { rows: db.prepare(sql).all(...args) });
  }

  // 备份导出 / 落盘 / 路由覆盖报告
  if (route === '/backup') {
    const tables = {};
    for (const name of Object.keys(ENTITIES)) {
      try { tables['e_' + name] = db.prepare(`SELECT * FROM e_${name} WHERE user_id=?`).all(uid); } catch (e) {}
    }
    const userRow = db.prepare('SELECT id,realm,email,invite_code,name,membership,membership_expire,char_quota,chars_used,wallet_balance,created_at FROM users WHERE id=?').all(uid);
    const settings = db.prepare('SELECT key,value FROM settings WHERE user_id=?').all(uid);
    return json(res, 200, { generated_at: now(), user: userRow[0] || null, settings, tables });
  }
  if (route === '/backup/save' && m === 'POST') {
    const dir = path.join(DATA_DIR, 'data', 'backups');
    fs.mkdirSync(dir, { recursive: true });
    const tables = {};
    for (const name of Object.keys(ENTITIES)) {
      try { tables['e_' + name] = db.prepare(`SELECT * FROM e_${name} WHERE user_id=?`).all(uid); } catch (e) {}
    }
    const file = path.join(dir, 'backup-' + new Date().toISOString().replace(/[:.]/g, '-') + '.json');
    fs.writeFileSync(file, JSON.stringify({ generated_at: now(), user_id: uid, tables }));
    return json(res, 200, { ok: true, file: path.relative(process.cwd(), file), bytes: fs.statSync(file).size });
  }
  if (route === '/routes') {
    let src = '';
    try { src = fs.readFileSync(__filename, 'utf8'); } catch (e) {}
    const routes = new Set();
    for (const m of src.matchAll(/route === '([^']+)'/g)) routes.add(m[1]);
    for (const m of src.matchAll(/p === '([^']+)'/g)) routes.add(m[1]);
    for (const m of src.matchAll(/p\.startsWith\('([^']+)'\)/g)) routes.add(m[1] + '*');
    return json(res, 200, { count: routes.size, routes: [...routes].sort() });
  }

  const crud = route.match(/^\/entities\/([a-z0-9_]+)(?:\/(\d+))?$/);
  if (crud) {
    const name = crud[1], id = crud[2], def = ENTITIES[name];
    if (!def || def.realm !== 'admin') return json(res, 404, { error: 'no such entity' });
    if (m === 'GET' && !id) {
      const q = uQuery(req);
      return json(res, 200, { rows: listEntity(name, uid, q), total: listEntityTotal(name, uid, q), limit: Number(q.limit) || 100, offset: Number(q.offset) || 0 });
    }
    if (m === 'POST' && !id) return json(res, 200, { row: createEntity(name, uid, await readBody(req)) });
    if ((m === 'PATCH' || m === 'PUT') && id) return json(res, 200, { row: updateEntity(name, uid, id, await readBody(req)) });
    if (m === 'DELETE' && id) { deleteEntity(name, uid, id); return json(res, 200, { ok: true }); }
  }
  return json(res, 404, { error: 'not found' });
}

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[site] client  http://127.0.0.1:${PORT}/client/`);
  console.log(`[site] admin   http://127.0.0.1:${PORT}/admin/`);
  console.log(`[site] panel   http://127.0.0.1:${PORT}/app-main.html`);
  console.log(`[site] public  /s/<code>  /p/<slug>  /f/<slug>  /px/<code>.gif`);
});

// 原厂面板的 WS 长连接：必须先用登录帧换 loginOk，之后每 25s 心跳
server.on('upgrade', (req, socket) => {
  try {
    const key = req.headers['sec-websocket-key'] || '';
    const accept = crypto.createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
    socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + accept + '\r\n\r\n');
    const send = (text) => {
      const payload = Buffer.from(text);
      const len = payload.length;
      let head;
      if (len < 126) head = Buffer.from([0x81, len]);
      else if (len < 65536) { head = Buffer.alloc(4); head[0] = 0x81; head[1] = 126; head.writeUInt16BE(len, 2); }
      else { head = Buffer.alloc(10); head[0] = 0x81; head[1] = 127; head.writeBigUInt64BE(BigInt(len), 2); }
      try { socket.write(Buffer.concat([head, payload])); } catch (e) {}
    };
    const parseFrames = (buf) => {
      const out = [];
      let off = 0;
      while (off + 2 <= buf.length) {
        const b1 = buf[off + 1];
        const masked = (b1 & 0x80) !== 0;
        let len = b1 & 0x7f;
        let p = off + 2;
        if (len === 126) { if (p + 2 > buf.length) break; len = buf.readUInt16BE(p); p += 2; }
        else if (len === 127) { if (p + 8 > buf.length) break; len = Number(buf.readBigUInt64BE(p)); p += 8; }
        const mask = masked ? buf.slice(p, p + 4) : null;
        if (masked) p += 4;
        if (p + len > buf.length) break;
        const payload = Buffer.from(buf.slice(p, p + len));
        if (mask) for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i % 4];
        out.push({ opcode: buf[off] & 0x0f, text: payload.toString('utf8') });
        off = p + len;
      }
      return out;
    };
    let authed = false;
    let buffer = Buffer.alloc(0);
    let heartbeat = null;
    socket.on('data', (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);
      for (const frame of parseFrames(buffer)) {
        if (frame.opcode === 8) { try { socket.destroy(); } catch (e) {} return; }
        if (frame.opcode !== 1) continue;
        let msg = null;
        try { msg = JSON.parse(frame.text); } catch (e) {}
        if (!msg) continue;
        if (msg.type === 'login') {
          const t = verifyLive(String(msg.token || ''));
          if (!t) { send(JSON.stringify({ type: 'error', error: 'invalid token' })); try { socket.destroy(); } catch (e) {} return; }
          authed = true;
          send(JSON.stringify({ type: 'loginOk', uid: t.uid }));
          heartbeat = setInterval(() => send(JSON.stringify({ type: 'ping', t: Date.now() })), 25000);
        } else if (authed && msg.type === 'pong') {
          // 心跳应答，无需处理
        }
      }
    });
    socket.on('close', () => { if (heartbeat) clearInterval(heartbeat); });
    socket.on('error', () => { if (heartbeat) clearInterval(heartbeat); });
  } catch (e) { try { socket.destroy(); } catch (e2) {} }
});
