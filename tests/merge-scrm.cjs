'use strict';

// 合并包验证：Super Translate × SCRM
// 目标：聚合 SCRM 打开时直接用当前超级翻译账号建立会话（SSO），不再出现邀请码登录。
//
// 阶段 A（主路径）：
//   1. 隔离 profile + 本地管理员账号 + 云端拒绝桩（与现有集成测试一致，不接触真实云端）；
//   2. 启动 electron，走真实登录表单进入工作台；
//   3. 点“聚合 SCRM”，断言：无邀请码输入框、概览直接加载（/me、/contacts/stats、/proxies）；
//   4. 校验主进程建立的本地 SCRM 用户（profile/scrm/site.db，plan='sso'）；
//   5. 校验“打开完整 SCRM / 返回概览”切换（iframe fallback）。
//
// 阶段 B（会话失败路径）：
//   用桩服务占用 127.0.0.1:18801 并拒绝 /api/app/sso（403 sso_denied），
//   断言：显示错误信息 + 重试按钮，不回退到邀请码 UI。
//
// 用法：node tests/merge-scrm.cjs   （cwd = 工程根目录）

const { _electron } = require('playwright');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const net = require('node:net');
const { DatabaseSync } = require('node:sqlite');
const { prepareTestLogin, loginToWorkbench } = require('./login-helper.cjs');

const root = path.resolve(__dirname, '..');
const SCRM_PORT = 18801;
const SCRM_BASE = `http://127.0.0.1:${SCRM_PORT}`;
const checks = [];
const observations = [];
const ok = (name, value) => { assert.ok(value, name); checks.push(name); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const sha16 = (username) => crypto.createHash('sha256').update(username).digest('hex').slice(0, 16);

async function portFree(port, timeout = 15000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const free = await new Promise((resolve) => {
      const srv = net.createServer();
      srv.once('error', () => resolve(false));
      srv.listen(port, '127.0.0.1', () => srv.close(() => resolve(true)));
    });
    if (free) return;
    await wait(200);
  }
  throw new Error(`端口 ${port} 在 ${timeout}ms 内未释放`);
}

async function launchApp(profile, cloudBase) {
  const env = { ...process.env, ST_TEST_PROFILE: profile, ST_TEST_FIXTURE: '1', ST_CLOUD_BASE: cloudBase };
  delete env.ELECTRON_RUN_AS_NODE;
  const app = await _electron.launch({
    executablePath: require('electron'),
    args: [path.join(root, 'src', 'desktop.js')],
    env,
  });
  const page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  return { app, page };
}

async function closeApp(app) {
  try { await app.close(); } catch {}
}

// ---------- 静态自检：SSO secret 不得写入日志/源码 ----------
function staticChecks() {
  const files = ['src/scrm-service.js', 'src/desktop.js', 'scrm/server.js'];
  for (const f of files) {
    const text = fs.readFileSync(path.join(root, f), 'utf8');
    ok(`静态：${f} 不将 SSO secret 打印到日志`, !/console\.[a-z]+\([^)]*SSO_SECRET/.test(text));
  }
  // secret 仅存在于 scrm-service.js 的生成/env 注入与 server.js 的比对，不落盘
  const svc = fs.readFileSync(path.join(root, 'src', 'scrm-service.js'), 'utf8');
  ok('静态：SSO secret 在运行期随机生成（crypto.randomBytes(24)）', /crypto\.randomBytes\(24\)/.test(svc));
  ok('静态：SSO secret 仅经环境变量传给 SCRM 服务', /process\.env\.SCRM_SSO_SECRET\s*=\s*SSO_SECRET/.test(svc));
  ok('静态：SSO secret 不写入磁盘文件', !/(writeFile|appendFile)\w*\([^)]*SSO_SECRET/.test(svc));
}

// ---------- 阶段 A：主路径 ----------
async function phaseA(cloudBase) {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'super-translate-merge-a-'));
  const login = await prepareTestLogin(profile);
  const { app, page } = await launchApp(profile, cloudBase);
  try {
    await loginToWorkbench(page, login);
    ok('A1 登录后进入工作台', page.url().includes('workbench/index.html'));

    // 主进程已把本地 SCRM 服务拉起来
    const status = await page.evaluate(() => window.superDesktop.scrmStatus());
    ok('A2 主进程已启动本地 SCRM 服务', status && status.started === true && Number(status.port) === SCRM_PORT);

    // 点聚合 SCRM
    await page.locator('[data-action="scrm"]').first().click();
    await page.waitForFunction(() => !document.getElementById('scrm-workspace').hidden);
    ok('A3 聚合 SCRM 工作区已打开', true);

    // 概览直接加载（SSO 会话 → /me → /contacts/stats → /proxies）
    await page.waitForSelector('#scrm-overview .scrm-stat', { timeout: 20000 });
    ok('A4 概览直接加载（未要求任何输入）', true);

    // 无邀请码输入框、无邀请码登录卡片
    const inviteInput = await page.evaluate(() => !!document.getElementById('scrm-invite-code'));
    ok('A5 概览中不存在邀请码输入框', inviteInput === false);
    const inviteLoginText = await page.evaluate(() => document.getElementById('scrm-overview').textContent.includes('使用邀请码登录本地 SCRM 服务'));
    ok('A6 概览中不出现邀请码登录引导文案', inviteLoginText === false);

    // 概览数据卡：客户数 / 线索数 / 代理数（全新 profile → 0/0/0）
    const statValues = await page.evaluate(() => Array.from(document.querySelectorAll('#scrm-overview .scrm-stat-value')).map((el) => el.textContent.trim()));
    ok('A7 概览渲染三张数据卡（客户/线索/代理）', statValues.length === 3 && statValues.every((v) => /^\d+$/.test(v)));
    observations.push({ statValues });

    // 授权信息：来自 SSO 建的用户
    const kv = await page.evaluate(() => document.getElementById('scrm-overview').textContent);
    const expectedInvite = 'st_' + sha16(login.username);
    ok('A8 授权信息显示 SSO 邀请码（st_ 前缀）', kv.includes(expectedInvite));
    ok('A9 授权信息显示额度类型 char', kv.includes('char'));
    ok('A10 概览头部显示数据来源（本地 SCRM 服务）', kv.includes('数据来自本地 SCRM 服务'));

    // localStorage 中存了会话 token
    const token = await page.evaluate(() => localStorage.getItem('super-translate.scrm.token') || '');
    ok('A11 渲染层缓存了 SSO 会话 token', /^[A-Za-z0-9._-]{20,}$/.test(token));

    // 用页面里的 token 直接复验 /api/app/me 契约
    const me = await page.evaluate(async (t) => {
      const res = await fetch('http://127.0.0.1:18801/api/app/me', { headers: { authorization: 'Bearer ' + t } });
      return { status: res.status, body: await res.json() };
    }, token);
    ok('A12 /api/app/me 用 SSO token 返回 200 且 remark 与邀请码一致', me.status === 200 && me.body.remark === expectedInvite && me.body.billing.type === 'char');

    // 主进程建的本地 SCRM 用户落库（email=st:<用户名>，plan=sso）
    const db = new DatabaseSync(path.join(profile, 'scrm', 'site.db'), { readOnly: true });
    try {
      const row = db.prepare(`SELECT * FROM users WHERE realm='client' AND email=?`).get('st:' + login.username);
      ok('A13 本地 SCRM 已建 SSO 用户（email=st:用户名）', !!row);
      ok('A14 SSO 用户 plan=sso 且不计邀请码额度类型', row && row.plan === 'sso' && row.realm === 'client');
      const sess = db.prepare(`SELECT COUNT(*) n FROM device_sessions WHERE user_id=?`).get(Number(row && row.id));
      ok('A15 SSO 会话在 device_sessions 落库', Number(sess.n) >= 1);
    } finally {
      db.close();
    }

    // iframe fallback：打开完整 SCRM ↔ 返回概览
    const tgl = page.locator('#scrm-full-toggle');
    ok('A16 切换按钮初始文案为“打开完整 SCRM”', (await tgl.textContent()).includes('打开完整 SCRM'));
    await tgl.click();
    await page.waitForFunction(() => {
      const f = document.getElementById('scrm-frame');
      return f && !f.hidden && f.src.startsWith('http://127.0.0.1:18801/client/');
    });
    ok('A17 iframe 打开并指向 /client/', true);
    await wait(1500);
    const child = page.frames().find((f) => f.url().includes('127.0.0.1:18801/client'));
    ok('A18 iframe 加载了完整 SCRM 客户端文档', !!child);
    let iframeText = '';
    if (child) { try { iframeText = await child.locator('body').innerText(); } catch {} }
    ok('A19 打开完整 SCRM 后按钮文案变为“返回概览”', (await tgl.textContent()).includes('返回概览'));
    await tgl.click();
    await page.waitForFunction(() => document.getElementById('scrm-frame').hidden === true && !document.getElementById('scrm-overview').hidden);
    ok('A20 再次点击回到原生概览（iframe fallback 可往返切换）', true);
    observations.push({ iframeBodySample: iframeText.slice(0, 300) });
    observations.push({ iframeShowsInviteLoginScreen: iframeText.includes('CHMMVOA64ULC8W') });

    return profile;
  } finally {
    await closeApp(app);
  }
}

// ---------- 阶段 B：主进程会话失败，不得回退邀请码 UI ----------
async function phaseB(cloudBase) {
  await portFree(SCRM_PORT);
  const stub = http.createServer((req, res) => {
    if (req.method === 'POST' && req.url.startsWith('/api/app/sso')) {
      res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify({ code: 403, error: 'sso_denied' }));
    }
    res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ code: 404, error: 'not_found' }));
  });
  await new Promise((resolve, reject) => {
    stub.once('error', reject);
    stub.listen(SCRM_PORT, '127.0.0.1', resolve);
  });

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'super-translate-merge-b-'));
  const login = await prepareTestLogin(profile);
  const { app, page } = await launchApp(profile, cloudBase);
  try {
    await loginToWorkbench(page, login);
    await page.locator('[data-action="scrm"]').first().click();
    await page.waitForFunction(() => !document.getElementById('scrm-workspace').hidden);

    await page.waitForFunction(() => !!document.querySelector('#scrm-overview .scrm-login-card'), null, { timeout: 20000 });
    const errText = await page.evaluate(() => document.querySelector('#scrm-overview .scrm-login-card').textContent);
    ok('B1 会话失败时显示“加载失败”错误卡片', errText.includes('加载失败'));
    ok('B2 错误卡片展示主进程会话错误信息（sso_denied）', errText.includes('sso_denied'));
    ok('B3 提供“重试”按钮', errText.includes('重试'));
    const hasInviteInput = await page.evaluate(() => !!document.getElementById('scrm-invite-code'));
    ok('B4 失败路径不回退到邀请码输入框', hasInviteInput === false);
    const hasInviteText = await page.evaluate(() => document.getElementById('scrm-overview').textContent.includes('使用邀请码登录本地 SCRM 服务'));
    ok('B5 失败路径不出现邀请码登录文案', hasInviteText === false);
    const hasStats = await page.evaluate(() => !!document.querySelector('#scrm-overview .scrm-stat'));
    ok('B6 失败路径不渲染概览数据卡', hasStats === false);
    // 应用未因端口占用而崩溃（主进程 uncaughtException 兜底）
    const alive = await page.evaluate(() => document.title.length > 0);
    ok('B7 本地 SCRM 端口被占用时应用不崩溃', alive === true);
    observations.push({ errorCardText: errText.slice(0, 200) });
  } finally {
    await closeApp(app);
    stub.close();
  }
}

(async () => {
  staticChecks();
  const cloud = await (await import('./login-helper.cjs')).startCloudDeclineServer();
  let profileA = null;
  try {
    profileA = await phaseA(cloud.base);
    await phaseB(cloud.base);
    console.log(JSON.stringify({ ok: true, passed: checks.length, checks, observations }, null, 2));
  } finally {
    await cloud.close().catch(() => {});
    if (profileA) { try { fs.rmSync(profileA, { recursive: true, force: true }); } catch {} }
  }
})().catch((error) => {
  console.error(error && error.stack || error);
  process.exit(1);
});
