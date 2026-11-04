'use strict';

// Remembered credentials are encrypted individually with Electron safeStorage
// (Windows DPAPI). Renderer-facing list results never contain passwords or
// encrypted blobs; a secret is decrypted only when one saved account is
// explicitly selected or used for the single startup auto-login attempt.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const VERSION = 2;
const LEGACY_VERSION = 1;
const MAX_ACCOUNTS = 20;
const ALLOWED_ACCOUNT_TYPES = new Set(['auto', 'admin', 'customer', 'local-admin']);

const publicAccount = record => ({
  id: record.id,
  username: record.username,
  accountType: record.accountType,
  autoLogin: record.autoLogin === true,
  savedAt: Number(record.savedAt) || 0
});

function createLoginPreferences(directory, secureStorage) {
  const file = path.join(directory, 'login-preferences-v2.json');
  const legacyFile = path.join(directory, 'login-preferences-v1.json');

  const encryptionAvailable = () => {
    try { return !!secureStorage && secureStorage.isEncryptionAvailable() === true; }
    catch { return false; }
  };

  const normalizeType = value => ALLOWED_ACCOUNT_TYPES.has(String(value || 'auto')) ? String(value || 'auto') : 'auto';
  const identity = (username, accountType) => `${normalizeType(accountType)}:${String(username || '').trim().toLowerCase()}`;
  const validRecord = value => value && typeof value.id === 'string' && value.id === identity(value.username, value.accountType) &&
    typeof value.username === 'string' && !!value.username.trim() && value.username.length <= 80 &&
    ALLOWED_ACCOUNT_TYPES.has(value.accountType) && typeof value.encryptedPassword === 'string' &&
    !!value.encryptedPassword && value.encryptedPassword.length <= 4096 &&
    (value.autoLogin === true || value.autoLogin === false);

  function emptyStore() { return { version: VERSION, selectedId: null, accounts: [] }; }

  function writeStore(store) {
    fs.mkdirSync(directory, { recursive: true });
    const temporary = `${file}.${crypto.randomUUID()}.tmp`;
    fs.writeFileSync(temporary, JSON.stringify(store, null, 2), { encoding: 'utf8', mode: 0o600 });
    try { fs.renameSync(temporary, file); }
    catch (error) { try { fs.rmSync(temporary, { force: true }); } catch {} throw error; }
  }

  function readCurrent() {
    if (!fs.existsSync(file)) return null;
    try {
      const value = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (!value || value.version !== VERSION || !Array.isArray(value.accounts)) return null;
      const accounts = value.accounts.filter(validRecord).slice(0, MAX_ACCOUNTS);
      const selectedId = accounts.some(record => record.id === value.selectedId) ? value.selectedId : (accounts[0]?.id || null);
      return { version: VERSION, selectedId, accounts };
    } catch { return null; }
  }

  function migrateLegacy() {
    if (!fs.existsSync(legacyFile) || !encryptionAvailable()) return null;
    try {
      const value = JSON.parse(fs.readFileSync(legacyFile, 'utf8'));
      if (!value || value.version !== LEGACY_VERSION || typeof value.username !== 'string' || !value.username.trim() ||
          value.username.length > 80 || !ALLOWED_ACCOUNT_TYPES.has(value.accountType) || value.remember !== true ||
          typeof value.encryptedPassword !== 'string' || !value.encryptedPassword || value.encryptedPassword.length > 4096 ||
          (value.autoLogin !== true && value.autoLogin !== false)) return null;
      // Verify that the encrypted blob is usable before preserving it.
      const password = secureStorage.decryptString(Buffer.from(value.encryptedPassword, 'base64'));
      if (typeof password !== 'string' || !password || password.length > 128) return null;
      const record = { id: identity(value.username, value.accountType), username: value.username.trim(), accountType: value.accountType,
        autoLogin: value.autoLogin === true, encryptedPassword: value.encryptedPassword, savedAt: Number(value.savedAt) || Date.now() };
      const store = { version: VERSION, selectedId: record.id, accounts: [record] };
      writeStore(store);
      try { fs.rmSync(legacyFile, { force: true }); } catch {}
      return store;
    } catch { return null; }
  }

  function readStore() {
    const current = readCurrent();
    if (current) return current;
    if (fs.existsSync(file)) { try { fs.rmSync(file, { force: true }); } catch {} }
    return migrateLegacy() || emptyStore();
  }

  function decrypt(record) {
    try {
      const password = secureStorage.decryptString(Buffer.from(record.encryptedPassword, 'base64'));
      if (typeof password !== 'string' || !password || password.length > 128) throw new Error('invalid');
      return { ...publicAccount(record), available: true, saved: true, remember: true, password };
    } catch { return null; }
  }

  function list() {
    if (!encryptionAvailable()) return { available: false, saved: false, selectedId: null, accounts: [] };
    const store = readStore();
    return { available: true, saved: store.accounts.length > 0, selectedId: store.selectedId, accounts: store.accounts.map(publicAccount) };
  }

  function get(id) {
    if (!encryptionAvailable()) return { available: false, saved: false };
    const store = readStore();
    const record = store.accounts.find(value => value.id === String(id || store.selectedId || ''));
    if (!record) return { available: true, saved: false };
    const result = decrypt(record);
    if (result) return result;
    store.accounts = store.accounts.filter(value => value.id !== record.id);
    store.selectedId = store.accounts[0]?.id || null;
    if (store.accounts.length) writeStore(store); else { try { fs.rmSync(file, { force: true }); } catch {} }
    return { available: true, saved: false };
  }

  function save(input = {}) {
    if (input.remember !== true) return { ok: true, saved: false, available: encryptionAvailable() };
    if (!encryptionAvailable()) return { ok: false, saved: false, available: false, reason: 'unavailable' };
    const username = String(input.username || '').trim();
    const password = input.password;
    if (!username || username.length > 80 || typeof password !== 'string' || !password || password.length > 128) throw new Error('登录信息格式无效，无法保存。');
    const accountType = normalizeType(input.accountType);
    let encryptedPassword;
    try { encryptedPassword = secureStorage.encryptString(password).toString('base64'); }
    catch { return { ok: false, saved: false, available: false, reason: 'unavailable' }; }
    const store = readStore(), id = identity(username, accountType), now = Date.now();
    const record = { id, username, accountType, autoLogin: input.autoLogin === true, encryptedPassword, savedAt: now };
    store.accounts = store.accounts.filter(value => value.id !== id);
    if (record.autoLogin) store.accounts.forEach(value => { value.autoLogin = false; });
    store.accounts.unshift(record);
    store.accounts = store.accounts.slice(0, MAX_ACCOUNTS);
    store.selectedId = id;
    writeStore(store);
    return { ok: true, saved: true, available: true, id, autoLogin: record.autoLogin, accounts: store.accounts.map(publicAccount) };
  }

  function remove(id) {
    if (!encryptionAvailable()) return { ok: true, saved: false, available: false, accounts: [] };
    const store = readStore(), target = String(id || store.selectedId || '');
    store.accounts = store.accounts.filter(value => value.id !== target);
    if (!store.accounts.some(value => value.id === store.selectedId)) store.selectedId = store.accounts[0]?.id || null;
    if (store.accounts.length) writeStore(store); else { try { fs.rmSync(file, { force: true }); } catch {} }
    return { ok: true, saved: store.accounts.length > 0, available: true, selectedId: store.selectedId, accounts: store.accounts.map(publicAccount) };
  }

  function clear() {
    try { fs.rmSync(file, { force: true }); } catch {}
    try { fs.rmSync(legacyFile, { force: true }); } catch {}
    return { ok: true, saved: false, available: encryptionAvailable(), accounts: [] };
  }

  function disableAutoLogin(id) {
    if (!encryptionAvailable()) return { ok: true, saved: false, available: false };
    const store = readStore(), target = id === undefined || id === null ? null : String(id);
    let changed = false;
    // An explicit account id is used after one bounded automatic attempt fails.
    // With no id (the workbench's Log out action), disable every automatic
    // record so an older remembered identity cannot immediately sign itself
    // back in when a different selected account logs out.
    store.accounts.forEach(record => { if ((target === null || record.id === target) && record.autoLogin) { record.autoLogin = false; changed = true; } });
    if (changed) writeStore(store);
    return { ok: true, saved: store.accounts.length > 0, available: true, selectedId: store.selectedId, accounts: store.accounts.map(publicAccount) };
  }

  return Object.freeze({ file, legacyFile, encryptionAvailable, list, get, save, remove, clear, disableAutoLogin });
}

module.exports = { createLoginPreferences, VERSION, MAX_ACCOUNTS };
