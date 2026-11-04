'use strict';

// L3 compatibility bridge for the original SCRM platform preloads.
// It only maps the narrow host surface used by adapters; it does not copy the
// original app shell or its page DOM.
const { contextBridge, ipcRenderer } = require('electron');

const call = (op, ...args) => ipcRenderer.invoke('scrm-bridge:' + op, ...args);

function makeBridge(prefix) {
  return Object.freeze({
    open: (sessionId, bounds, proxy) => call('open', prefix, sessionId, bounds, proxy),
    close: sessionId => call('close', prefix, sessionId),
    hide: () => call('hide', prefix),
    show: (sessionId, bounds) => call('show', prefix, sessionId, bounds),
    updateBounds: bounds => call('update-bounds', prefix, bounds),
    updateTranslate: config => call('update-translate', prefix, config),
    exec: (sessionId, script) => call('exec', prefix, sessionId, script),
    fetchAsData: (sessionId, url) => call('fetch-as-data', prefix, sessionId, url),
    setProxy: (sessionId, proxy) => call('set-proxy', prefix, sessionId, proxy),
    testProxy: (proxy, fresh) => call('test-proxy', prefix, proxy, fresh === true),
    remove: sessionId => call('remove', prefix, sessionId),
    setZoom: (sessionId, factor) => call('set-zoom', prefix, sessionId, factor),
    getZoom: sessionId => call('get-zoom', prefix, sessionId),
    capture: sessionId => call('capture', prefix, sessionId),
    captureAt: (sessionId, size) => call('capture-at', prefix, sessionId, size),
  });
}

for (const prefix of ['wa', 'tg', 'tg_w', 'line', 'zalo', 'tt', 'ig', 'fb', 'x', 'ms', 'discord', 'linkedin', 'meta', 'botim', 'gv', 'linebiz', 'lineworks', 'snap', 'skype']) {
  contextBridge.exposeInMainWorld('__scrm_' + prefix, makeBridge(prefix));
}

contextBridge.exposeInMainWorld('__scrm_ipc', {
  sendToView: (platform, eventName, data) => ipcRenderer.send('scrm-bridge:post-message', platform, eventName, data),
  on: (channel, callback) => { if (typeof callback === 'function') ipcRenderer.on(channel, (_event, ...args) => callback(...args)); },
  removeListener: (channel, callback) => ipcRenderer.removeListener(channel, callback),
});

contextBridge.exposeInMainWorld('__scrm_cache', {
  get: key => call('cache-get', key),
  set: (key, value) => call('cache-set', key, value),
  remove: key => call('cache-remove', key),
});

contextBridge.exposeInMainWorld('__scrm_httpGet', url => call('http-get', url));
contextBridge.exposeInMainWorld('__scrm_fp', {
  save: (platform, sessionId, config) => call('fp-save', platform, sessionId, config),
  get: (platform, sessionId) => call('fp-get', platform, sessionId),
  setCurrent: config => call('fp-set-current', config),
});
