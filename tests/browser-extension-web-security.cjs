'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const { webcrypto } = require('node:crypto');

const extensionRoot = path.resolve(__dirname, '../browser-extension');
const core = require(path.join(extensionRoot, 'core.js'));

function harness(options = {}) {
  let runtimeListener;
  let updatedListener;
  let removedListener;
  let activeTab = structuredClone(options.activeTab || { id: 41, url: 'https://fixture.test/article' });
  let translateDelay = 0;
  let failStatusCount = 0;
  const translateStarts = [];
  const injected = [];
  const contentMessages = [];
  const stores = options.stores ? {
    local: structuredClone(options.stores.local || {}),
    session: structuredClone(options.stores.session || {})
  } : {
    local: { settings: { ...core.defaults, engine: 'cloud', enabled: false } },
    session: {}
  };
  let contentState = structuredClone(options.contentState || { nonce: '', enabled: false, settings: null });
  const token = 'synthetic-web-security-token-not-real';
  const account = {
    id: 'web-security-fixture',
    username: 'web_security',
    status: 'active',
    quota: 900000,
    used: 0,
    plan: 'fixture',
    expires: '2030-12-31'
  };

  const area = name => ({
    async get(keys) {
      const data = stores[name];
      if (keys == null) return structuredClone(data);
      if (typeof keys === 'object' && !Array.isArray(keys)) {
        return structuredClone(Object.fromEntries(Object.entries(keys).map(([key, fallback]) => [key, key in data ? data[key] : fallback])));
      }
      const list = Array.isArray(keys) ? keys : [keys];
      return structuredClone(Object.fromEntries(list.filter(key => key in data).map(key => [key, data[key]])));
    },
    async set(value) { Object.assign(dataFor(name), structuredClone(value)); },
    async remove(keys) { for (const key of Array.isArray(keys) ? keys : [keys]) delete dataFor(name)[key]; },
    async setAccessLevel({ accessLevel }) { stores[`${name}Access`] = accessLevel; }
  });
  const dataFor = name => stores[name];

  const sandbox = {
    URL,
    Map,
    Set,
    TextEncoder,
    AbortSignal,
    Response,
    setTimeout,
    clearTimeout,
    structuredClone,
    crypto: webcrypto,
    navigator: { userAgent: 'Chrome/security-fixture' },
    chrome: {
      i18n: { detectLanguage(_text, callback) { callback({ isReliable: false, languages: [] }); } },
      storage: { local: area('local'), session: area('session') },
      alarms: {
        async clear() {},
        async create() {},
        onAlarm: { addListener() {} }
      },
      tabs: {
        async query() { return [structuredClone(activeTab)]; },
        async sendMessage(tabId, message, options) {
          contentMessages.push({ tabId, message: structuredClone(message), options: structuredClone(options) });
          if (message.type === 'WEB_CONFIGURE') {
            if (contentState.enabled && contentState.nonce && message.nonce !== contentState.nonce) return { ok: false, error: '网页翻译授权已变更，请重新启用。' };
            contentState = { nonce: message.nonce, enabled: true, settings: structuredClone(message.settings) };
            return { ok: true, enabled: true, translatedUnits: 0 };
          }
          if (message.type === 'WEB_REKEY') {
            contentState = { nonce: message.nonce, enabled: true, settings: structuredClone(message.settings) };
            return { ok: true, enabled: true, translatedUnits: 0 };
          }
          if (message.type === 'WEB_STATUS') {
            if (failStatusCount > 0) { failStatusCount--;throw new Error('synthetic receiver unavailable'); }
            if (!contentState.enabled || message.nonce !== contentState.nonce) return { ok: false, error: '网页翻译授权无效。' };
            return { ok: true, enabled: true, translatedUnits: 2 };
          }
          if (message.type === 'WEB_STOP') {
            if (contentState.nonce && message.nonce !== contentState.nonce) return { ok: false, error: '网页翻译授权无效。' };
            contentState = { ...contentState, enabled: false };
            return { ok: true, enabled: false };
          }
          return { ok: false, error: 'unexpected fixture message' };
        },
        onUpdated: { addListener(fn) { updatedListener = fn; } },
        onRemoved: { addListener(fn) { removedListener = fn; } }
      },
      scripting: {
        async insertCSS(details) { injected.push({ kind: 'css', details: structuredClone(details) }); },
        async executeScript(details) { injected.push({ kind: 'js', details: structuredClone(details) }); }
      },
      runtime: {
        id: 'fixtureext',
        getManifest: () => ({ version: '0.6.0' }),
        async openOptionsPage() {},
        onMessage: { addListener(fn) { runtimeListener = fn; } }
      }
    },
    fetch: async (rawUrl, options = {}) => {
      const route = new URL(rawUrl).pathname;
      const body = JSON.parse(options.body || '{}');
      const reply = (data, status = 200) => new Response(JSON.stringify(data), { status });
      if (route === '/api/customer-login') return reply({ ok: true, token, customer: account });
      if (route === '/api/customer-heartbeat') return reply({ ok: true });
      if (route === '/api/customer-usage') return reply({ ok: true, ...account });
      if (route === '/api/translate') {
        translateStarts.push(body.text);
        if (translateDelay) await new Promise(resolve => setTimeout(resolve, translateDelay));
        return reply({ ok: true, translation: `T:${body.text}`, charged: body.text.length, quota: 900000, used: 0 });
      }
      return reply({ ok: false, error: 'not_found' }, 404);
    }
  };

  const context = vm.createContext(sandbox);
  sandbox.importScripts = (...names) => names.forEach(name => vm.runInContext(fs.readFileSync(path.join(extensionRoot, name), 'utf8'), context));
  vm.runInContext(fs.readFileSync(path.join(extensionRoot, 'background.js'), 'utf8'), context);

  const ui = { id: 'fixtureext', url: 'chrome-extension://fixtureext/popup.html' };
  const webSender = (url = activeTab.url, frameId = 0, tabId = activeTab.id) => ({ id: 'fixtureext', url, tab: { id: tabId, url }, frameId });
  const wa = { id: 'fixtureext', url: 'https://web.whatsapp.com/', tab: { id: 7, url: 'https://web.whatsapp.com/' }, frameId: 0 };
  const call = (message, sender = ui) => new Promise(resolve => runtimeListener(message, sender, resolve));
  const login = () => call({ type: 'LOGIN', username: 'web_security', password: 'fixture-password', rememberUsername: false });
  const enable = (extra = {}) => call({ type: 'SAVE_SETTINGS', settings: { ...core.defaults, enabled: true, ...extra } });
  const start = async (settings = {}) => {
    assert.equal((await login()).ok, true);
    assert.equal((await enable()).ok, true);
    const response = await call({ type: 'WEB_ACTION', action: 'start', settings: { target: 'de', mode: 'bilingual', dynamic: true, subtitles: true, ...settings } });
    assert.equal(response.ok, true);
    const record = Object.values(stores.session.webSessions || {})[0];
    assert.ok(record?.nonce);
    return record;
  };

  return {
    call,
    ui,
    wa,
    webSender,
    stores,
    injected,
    contentMessages,
    translateStarts,
    start,
    get contentState() { return structuredClone(contentState); },
    failNextStatus() { failStatusCount++; },
    set activeTab(value) { activeTab = structuredClone(value); },
    get activeTab() { return structuredClone(activeTab); },
    set translateDelay(value) { translateDelay = value; },
    fireUpdated(tabId, changeInfo) { updatedListener?.(tabId, changeInfo, structuredClone(activeTab)); },
    fireRemoved(tabId) { removedListener?.(tabId, {}); }
  };
}

test('generic web translation is injected only into the explicitly active top-level tab', async () => {
  const h = harness();
  const record = await h.start();
  assert.equal(record.url, 'https://fixture.test/article');
  assert.deepEqual(h.injected.map(item => item.kind), ['css', 'js']);
  assert.deepEqual(h.injected[0].details.target, { tabId: 41, frameIds: [0] });
  assert.deepEqual(h.injected[1].details.target, { tabId: 41, frameIds: [0] });
  assert.deepEqual(h.injected[1].details.files, ['web-subtitles.js', 'web-content.js']);
  const activation = h.contentMessages.find(item => item.message.type === 'WEB_REKEY');
  assert.equal(activation.message.nonce, record.nonce);
  assert.equal(activation.message.settings.webNonce, record.nonce);
  assert.equal(h.stores.local.webSessions, undefined);
});

test('repeated start on the same exact URL reuses the active nonce after a transient status failure', async () => {
  const h = harness();
  const first = await h.start();
  const injectedBefore = h.injected.length;
  h.failNextStatus();
  const missing = await h.call({ type: 'WEB_ACTION', action: 'status' });
  assert.equal(missing.ok, true);
  assert.equal(missing.active, false);
  const restarted = await h.call({ type: 'WEB_ACTION', action: 'start', settings: { target: 'fr', mode: 'replace', dynamic: true, subtitles: false } });
  const second = Object.values(h.stores.session.webSessions || {})[0];
  assert.equal(restarted.ok, true);
  assert.equal(second.nonce, first.nonce);
  assert.equal(second.settings.target, 'fr');
  assert.equal(h.contentState.nonce, first.nonce);
  assert.equal(h.injected.length, injectedBefore);
  assert.equal(h.contentMessages.at(-1).message.type, 'WEB_CONFIGURE');
});

test('a restarted service worker recovers and reuses the persisted same-URL nonce', async () => {
  const firstWorker = harness();
  const first = await firstWorker.start();
  const restartedWorker = harness({ stores: firstWorker.stores, contentState: firstWorker.contentState });
  const restarted = await restartedWorker.call({ type: 'WEB_ACTION', action: 'start', settings: { target: 'de', mode: 'bilingual', dynamic: true, subtitles: true } });
  const recovered = Object.values(restartedWorker.stores.session.webSessions || {})[0];
  assert.equal(restarted.ok, true);
  assert.equal(recovered.nonce, first.nonce);
  assert.equal(restartedWorker.contentState.nonce, first.nonce);
  assert.equal(restartedWorker.injected.length, 0);
  assert.equal(restartedWorker.contentMessages.at(-1).message.type, 'WEB_CONFIGURE');
});

test('missing background session rekeys an orphaned page and rejects the old nonce', async () => {
  const firstWorker = harness();
  const first = await firstWorker.start();
  const lostStores = structuredClone({ local: firstWorker.stores.local, session: firstWorker.stores.session });
  delete lostStores.session.webSessions;
  const restartedWorker = harness({ stores: lostStores, contentState: firstWorker.contentState });
  const restarted = await restartedWorker.call({ type: 'WEB_ACTION', action: 'start', settings: { target: 'de', mode: 'bilingual', dynamic: true, subtitles: true } });
  const replacement = Object.values(restartedWorker.stores.session.webSessions || {})[0];
  assert.equal(restarted.ok, true);
  assert.notEqual(replacement.nonce, first.nonce);
  assert.equal(restartedWorker.contentState.nonce, replacement.nonce);
  assert.ok(restartedWorker.contentMessages.some(item => item.message.type === 'WEB_REKEY' && item.message.nonce === replacement.nonce));
  const oldResult = await restartedWorker.call({ type: 'WEB_TRANSLATE_TEXT', version: 1, jobId: 'orphan-old-job', scope: 'page', text: 'old orphan text', target: 'de', webNonce: first.nonce }, restartedWorker.webSender());
  assert.equal(oldResult.ok, false);
  assert.equal(restartedWorker.translateStarts.length, 0);
});

test('web sender cannot use legacy translate or bypass the tab capability nonce', async () => {
  const h = harness();
  const record = await h.start();
  const sender = h.webSender();
  assert.equal((await h.call({ type: 'TRANSLATE', text: 'bypass', target: 'de' }, sender)).ok, false);
  assert.equal((await h.call({ type: 'WEB_TRANSLATE_TEXT', version: 1, jobId: 'wrong-nonce-job', scope: 'page', text: 'private fixture page', target: 'de', webNonce: 'x'.repeat(48) }, sender)).ok, false);
  assert.equal(h.translateStarts.length, 0);
  const allowed = await h.call({ type: 'WEB_TRANSLATE_TEXT', version: 1, jobId: 'allowed-job-123', scope: 'page', text: 'public fixture paragraph', target: 'de', webNonce: record.nonce }, sender);
  assert.equal(allowed.ok, true);
  assert.equal(allowed.translation, 'T:public fixture paragraph');
  assert.deepEqual(h.translateStarts, ['public fixture paragraph']);
});

test('invalid web jobs, subframes and navigated URLs fail before provider access', async () => {
  const h = harness();
  const record = await h.start();
  const base = { type: 'WEB_TRANSLATE_TEXT', version: 1, jobId: 'fixture-job-123', scope: 'page', text: 'hello', target: 'de', webNonce: record.nonce };
  for (const [message, sender] of [
    [{ ...base, version: 2 }, h.webSender()],
    [{ ...base, jobId: 'bad' }, h.webSender()],
    [{ ...base, scope: 'history' }, h.webSender()],
    [{ ...base, text: 'x'.repeat(3001) }, h.webSender()],
    [{ ...base, target: '__proto__' }, h.webSender()],
    [base, h.webSender(undefined, 1)],
    [base, h.webSender('https://fixture.test/other')]
  ]) assert.equal((await h.call(message, sender)).ok, false);
  assert.equal(h.translateStarts.length, 0);
});

test('page revocation, logout and disabling cloud translation remove capabilities', async () => {
  {
    const h = harness();
    const record = await h.start();
    assert.equal((await h.call({ type: 'WEB_REVOKE', version: 1, webNonce: record.nonce }, h.webSender())).ok, true);
    assert.deepEqual(h.stores.session.webSessions, {});
  }
  {
    const h = harness();
    const record = await h.start();
    assert.equal((await h.call({ type: 'LOGOUT' })).ok, true);
    assert.equal(h.stores.session.webSessions, undefined);
    assert.ok(h.contentMessages.some(item => item.message.type === 'WEB_STOP' && item.message.nonce === record.nonce));
  }
  {
    const h = harness();
    const record = await h.start();
    assert.equal((await h.call({ type: 'SAVE_SETTINGS', settings: { ...core.defaults, enabled: false } })).ok, true);
    assert.equal(h.stores.session.webSessions, undefined);
    assert.ok(h.contentMessages.some(item => item.message.type === 'WEB_STOP' && item.message.nonce === record.nonce));
  }
});

test('a navigation event revokes the old exact-URL capability', async () => {
  const h = harness();
  const record = await h.start();
  h.activeTab = { id: 41, url: 'https://fixture.test/next' };
  h.fireUpdated(41, { url: 'https://fixture.test/next' });
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.deepEqual(h.stores.session.webSessions, {});
  const result = await h.call({ type: 'WEB_TRANSLATE_TEXT', version: 1, jobId: 'old-page-job', scope: 'page', text: 'old page text', target: 'de', webNonce: record.nonce }, h.webSender('https://fixture.test/article'));
  assert.equal(result.ok, false);
  assert.equal(h.translateStarts.length, 0);
});

test('foreground WhatsApp compose jumps ahead of queued page translation', async () => {
  const h = harness();
  const record = await h.start();
  await h.call({ type: 'SAVE_SETTINGS', settings: { ...core.defaults, enabled: true, autoSend: true } });
  h.translateDelay = 60;
  const sender = h.webSender();
  const first = h.call({ type: 'WEB_TRANSLATE_TEXT', version: 1, jobId: 'page-job-one', scope: 'page', text: 'page-one', target: 'de', webNonce: record.nonce }, sender);
  while (!h.translateStarts.length) await new Promise(resolve => setTimeout(resolve, 1));
  const second = h.call({ type: 'WEB_TRANSLATE_TEXT', version: 1, jobId: 'page-job-two', scope: 'page', text: 'page-two', target: 'de', webNonce: record.nonce }, sender);
  const compose = h.call({ type: 'TRANSLATE', purpose: 'compose', draftId: 'priority-draft-123', text: 'customer-reply', target: 'de' }, h.wa);
  const results = await Promise.all([first, second, compose]);
  assert.ok(results.every(result => result.ok));
  assert.deepEqual(h.translateStarts, ['page-one', 'customer-reply', 'page-two']);
});
