'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { app } = require('electron');

const PORT = Number(process.env.SCRM_PORT || 18801);
const HOST = '127.0.0.1';
const SSO_SECRET = crypto.randomBytes(24).toString('hex');
let started = false;
let lastError = '';
let sessionToken = '';
let sessionUser = '';
let sessionPromise = null;

function scrmRoot() {
  if (app.isPackaged) return path.join(process.resourcesPath, 'scrm');
  return path.join(__dirname, '..', 'scrm');
}

function dataRoot() {
  const root = path.join(app.getPath('userData'), 'scrm');
  fs.mkdirSync(root, { recursive: true });
  return root;
}

function start() {
  if (started) return { url: `http://${HOST}:${PORT}/client/`, port: PORT };
  const server = path.join(scrmRoot(), 'server.js');
  if (!fs.existsSync(server)) throw new Error(`SCRM service not found: ${server}`);
  process.env.SCRM_DATA_DIR = dataRoot();
  process.env.PORT = String(PORT);
  process.env.SCRM_SSO_SECRET = SSO_SECRET;
  process.argv.push('--port', String(PORT));
  require(server);
  started = true;
  return { url: `http://${HOST}:${PORT}/client/`, port: PORT };
}

async function ensureSession(username) {
  const user = String(username || '').trim();
  if (!user) throw new Error('请先登录超级翻译账号。');
  if (!started) start();
  if (sessionToken && sessionUser === user) return sessionToken;
  if (sessionPromise) return sessionPromise;
  sessionPromise = (async () => {
    let response;
    try {
      response = await fetch(`http://${HOST}:${PORT}/api/app/sso`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username: user, secret: SSO_SECRET }),
        signal: AbortSignal.timeout(8000),
      });
    } catch (error) {
      throw new Error('无法连接本地 SCRM 服务，请确认服务已启动。');
    }
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data?.token) {
      throw new Error(data?.error || data?.msg || '超级翻译账号无法建立 SCRM 会话。');
    }
    sessionToken = String(data.token);
    sessionUser = user;
    return sessionToken;
  })();
  try {
    return await sessionPromise;
  } finally {
    sessionPromise = null;
  }
}

function status() {
  return { started, port: PORT, url: `http://${HOST}:${PORT}/client/`, error: lastError };
}

module.exports = { start, status, ensureSession, port: PORT };
