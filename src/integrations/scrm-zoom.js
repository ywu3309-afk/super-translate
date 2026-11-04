// scrm-zoom.js — [BATCH1-ZOOM] 2026-10-04 每账号页面缩放的口径(唯一一处):范围 0.6-1.5,持久化键 zoom.<platform>.<sessionId>。
// 应用时机:面板调 setZoom 立即 setZoomFactor;视图每次页面就绪(dom-ready/did-finish-load,[TR-CFG-REPLAY] 同一钩子)和 TG webview dom-ready 时按持久化值再应用一次。
'use strict';
const MIN = 0.6, MAX = 1.5, DEFAULT = 1;

// 非法 → null;合法 → 钳到 [MIN, MAX],保留两位小数
function clamp(factor) {
  const f = Number(factor);
  if (!isFinite(f) || f <= 0) return null;
  return Math.round(Math.min(MAX, Math.max(MIN, f)) * 100) / 100;
}
// settings 的点号分层键:sessionId 里的 '.' 换成 '_'(不能被当成层级)
function key(platform, sessionId) { return 'zoom.' + String(platform || '').replace(/\./g, '_') + '.' + String(sessionId || '').replace(/\./g, '_'); }
function stored(settings, platform, sessionId) { const v = clamp(settings.get(key(platform, sessionId), DEFAULT)); return v === null ? DEFAULT : v; }

module.exports = { MIN, MAX, DEFAULT, clamp, key, stored };
