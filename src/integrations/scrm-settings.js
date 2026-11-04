// scrm-settings.js — [BATCH1-SETTINGS] 2026-10-04 主进程本地设置(唯一一份):<userData>/settings.json
// 用处:通知开关、GPU 开关、窗口置顶、下载提醒"不再提醒"、每账号缩放(zoom.<platform>.<sessionId>)、机器 id。
// 规则:键用点号分层;写入 = 临时文件 + rename(原子),读失败当空表;文件小、改动少,每次 set 同步落盘,不做防抖。
// 纯函数 getPath/setPath/delPath 不碰磁盘,供回归用;init(dir) 之后 get/set 才落到文件。
'use strict';
const fs = require('fs');
const path = require('path');

function _parts(key) { return String(key || '').split('.').filter(Boolean); }

// 读 obj 里的 a.b.c;没有 → def
function getPath(obj, key, def) {
  let cur = obj;
  for (const k of _parts(key)) {
    if (cur === null || typeof cur !== 'object' || !Object.prototype.hasOwnProperty.call(cur, k)) return def;
    cur = cur[k];
  }
  return cur === undefined ? def : cur;
}
// 写 obj 的 a.b.c(中间层自动建);返回 obj
function setPath(obj, key, val) {
  const ps = _parts(key);
  if (!ps.length) return obj;
  let cur = obj;
  for (let i = 0; i < ps.length - 1; i++) {
    if (cur[ps[i]] === null || typeof cur[ps[i]] !== 'object') cur[ps[i]] = {};
    cur = cur[ps[i]];
  }
  cur[ps[ps.length - 1]] = val;
  return obj;
}
function delPath(obj, key) {
  const ps = _parts(key);
  let cur = obj;
  for (let i = 0; i < ps.length - 1; i++) { if (!cur || typeof cur !== 'object') return obj; cur = cur[ps[i]]; }
  if (cur && typeof cur === 'object') delete cur[ps[ps.length - 1]];
  return obj;
}

function writeAtomic(file, content) {
  const tmp = file + '.tmp-' + process.pid + '-' + Date.now();
  try { fs.mkdirSync(path.dirname(file), { recursive: true }); } catch (e) {}
  try { fs.writeFileSync(tmp, content, 'utf8'); fs.renameSync(tmp, file); }
  catch (e) { try { fs.unlinkSync(tmp); } catch (_) {} throw e; }
}

const state = { file: '', data: null, lastErr: '' };

function _load() {
  if (state.data) return state.data;
  let d = {};
  try { if (state.file && fs.existsSync(state.file)) { const o = JSON.parse(fs.readFileSync(state.file, 'utf8')); if (o && typeof o === 'object' && !Array.isArray(o)) d = o; } }
  catch (e) { state.lastErr = 'read ' + (e && e.message || e); }
  state.data = d;
  return d;
}
function _save() {
  if (!state.file) return false;
  try { writeAtomic(state.file, JSON.stringify(state.data || {}, null, 2)); return true; }
  catch (e) { state.lastErr = 'write ' + (e && e.message || e); return false; }
}

// dir = app.getPath('userData')(app ready 前就能取);可重复调用(同一目录不重读)
function init(dir) {
  const file = path.join(dir, 'settings.json');
  if (state.file !== file) { state.file = file; state.data = null; }
  _load();
  return state.file;
}
function get(key, def) { return getPath(_load(), key, def); }
function set(key, val) { setPath(_load(), key, val); return _save(); }
function remove(key) { delPath(_load(), key); return _save(); }
function all() { return JSON.parse(JSON.stringify(_load())); }
function file() { return state.file; }

module.exports = { init, get, set, remove, all, file, getPath, setPath, delPath, writeAtomic, state };
