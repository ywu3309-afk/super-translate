(() => {
  'use strict';

  /*
   * Generic-web content module (MV3, version 1).
   *
   * This file is deliberately independent from auto-compose.js and content.js.
   * Those files own the WhatsApp DOM and its send state machine.  The generic
   * module is a no-op on WhatsApp, extension pages, file:// pages and frames.
   * A background/popup controller enables it explicitly with WEB_CONFIGURE.
   *
   * Runtime request contract (background.js must validate this again):
   *   { type: 'WEB_TRANSLATE_TEXT', version: 1, jobId, scope,
   *     text, target, priority }
   * Response: { ok: true, jobId, translation, charged?, quota? } or
   *           { ok: false, jobId, error, code? }
   * `text` is the only page data sent.  URL, cookies, storage and selection
   * ranges never leave this content script.  No request is retried here.
   */

  if (globalThis.STWebTranslator) return;

  const hostname = String(location.hostname || '').toLowerCase();
  const isWhatsApp = hostname === 'web.whatsapp.com' || hostname.endsWith('.whatsapp.com');
  const eligible = (location.protocol === 'https:' || location.protocol === 'http:') &&
    window.top === window && !isWhatsApp && !/^chrome(?:-extension)?$/.test(location.protocol.replace(':', ''));

  // Keep an inert API on excluded pages.  This makes diagnostics deterministic
  // without installing an observer or adding any DOM node to WhatsApp.
  if (!eligible) {
    const inert = Object.freeze({
      version: 1,
      eligible: false,
      status: () => ({ ok: true, eligible: false, enabled: false, reason: isWhatsApp ? 'whatsapp-specialized' : 'unsupported-page' }),
      configure: () => ({ ok: true, eligible: false, enabled: false }),
      start: () => ({ ok: true, eligible: false, enabled: false }),
      stop: () => ({ ok: true, eligible: false, enabled: false }),
      pause: () => ({ ok: true, eligible: false, enabled: false }),
      resume: () => ({ ok: true, eligible: false, enabled: false }),
      setMode: () => ({ ok: true, eligible: false, enabled: false }),
      translateSelection: async () => { throw new Error('当前页面不支持通用网页翻译。'); },
      subscribe: () => () => {}
    });
    globalThis.STWebTranslator = inert;
    return;
  }

  const DEFAULTS = Object.freeze({
    enabled: false,
    target: 'en',
    mode: 'bilingual', // bilingual | replace
    dynamic: true,
    translateHidden: false,
    maxNodesPerScan: 40,
    showToolbar: true,
    subtitles: false
  });
  const SKIP_TAGS = new Set([
    'SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'PRE', 'CODE', 'TEXTAREA',
    'INPUT', 'SELECT', 'OPTION', 'BUTTON', 'AUDIO', 'VIDEO', 'CANVAS',
    'SVG', 'MATH', 'IFRAME', 'OBJECT', 'EMBED'
  ]);
  const MAX_REQUEST_CHARS = 3000;
  const MAX_SOURCE_CHARS = 12000;
  const MAX_QUEUE = 80;
  const MAX_CACHE = 200;
  const CACHE_TTL = 10 * 60 * 1000;
  const WEB_NONCE_RE = /^[A-Za-z0-9_-]{24,128}$/;
  const listeners = new Set();

  let config = { ...DEFAULTS };
  let webNonce = '';
  let active = false;
  let paused = false;
  let generation = 0;
  let observer = null;
  let scanTimer = 0;
  let bodyWaitTimer = 0;
  let bodyReadyListening = false;
  let scanRunning = false;
  let pendingScan = false;
  let toolbar = null;
  let selectionBubble = null;
  let viewportTimer = 0;
  let selectionBusy = false;
  let sequence = 0;
  let workers = 0;
  const queue = [];
  const jobs = new Map();
  const cache = new Map();
  const units = new Set();
  const metadata = new WeakMap();

  const safeId = () => {
    try { return crypto.randomUUID(); } catch { return `web-${Date.now()}-${++sequence}`; }
  };
  const cleanText = value => String(value ?? '').replace(/\u00a0/g, ' ').replace(/[\u200b-\u200d\ufeff]/g, '');
  const isTarget = value => {
    const code = String(value || '');
    return /^[A-Za-z]{2,3}(?:-[A-Za-z]{2,4})?$/.test(code) && code.toLowerCase() !== 'auto';
  };
  const normalizeConfig = patch => {
    const next = { ...config, ...(patch && typeof patch === 'object' ? patch : {}) };
    if (!isTarget(next.target)) next.target = config.target || 'en';
    next.mode = next.mode === 'replace' ? 'replace' : 'bilingual';
    next.enabled = next.enabled === true;
    next.dynamic = next.dynamic !== false;
    next.translateHidden = next.translateHidden === true;
    next.maxNodesPerScan = Math.max(1, Math.min(120, Number(next.maxNodesPerScan) || DEFAULTS.maxNodesPerScan));
    next.showToolbar = next.showToolbar !== false;
    next.subtitles = next.subtitles === true;
    return next;
  };
  const status = (extra = {}) => ({
    ok: true,
    version: 1,
    eligible: true,
    enabled: active,
    paused,
    mode: config.mode,
    target: config.target,
    dynamic: config.dynamic,
    subtitles: config.subtitles,
    translatedUnits: [...units].filter(unit => {
      const meta = metadata.get(unit);
      return unit.isConnected && meta?.state === 'ready' && typeof meta.translationText === 'string' && meta.translationText.length > 0;
    }).length,
    queued: queue.length + workers,
    ...extra
  });
  const notify = extra => {
    const snapshot = status(extra);
    for (const fn of listeners) { try { fn(snapshot); } catch {} }
    try { window.dispatchEvent(new CustomEvent('st-web-status', { detail: snapshot })); } catch {}
    if (toolbar) updateToolbar(snapshot);
  };

  function isOwned(node) {
    return node instanceof Element && !!node.closest('.st-web-owned');
  }
  function hasSkippedAncestor(element) {
    for (let node = element; node; node = node.parentElement) {
      if (SKIP_TAGS.has(node.tagName)) return true;
      if (node.isContentEditable || node.getAttribute('contenteditable') === 'true') return true;
      if (node.getAttribute('aria-hidden') === 'true' || node.hasAttribute('data-st-web-skip')) return true;
      // Honour both the HTML translation contract and the de-facto class used
      // by documentation, banking and authentication sites.  A descendant is
      // not allowed to opt itself back in: an ancestor explicitly marked as
      // private/non-translatable owns that whole subtree.
      if (String(node.getAttribute('translate') || '').toLowerCase() === 'no' || node.classList?.contains('notranslate')) return true;
      // Captions are owned by the independent subtitle adapter.  Never wrap
      // player caption DOM as ordinary page text or it would be double billed
      // and could break the player's own live updates.
      if (node.matches?.('.ytp-caption-window-container,.captions-text,[aria-live][class*="caption" i],[class*="subtitle" i]')) return true;
      if (node.classList?.contains('st-web-owned')) return true;
      if (node === document.documentElement) break;
    }
    return false;
  }
  function visible(element) {
    if (config.translateHidden) return true;
    try {
      const style = getComputedStyle(element);
      if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse') return false;
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && rect.bottom >= 0 && rect.right >= 0 && rect.top <= innerHeight && rect.left <= innerWidth;
    } catch { return false; }
  }
  function eligibleTextNode(node) {
    if (!(node instanceof Text) || !node.parentElement || !node.nodeValue) return false;
    if (hasSkippedAncestor(node.parentElement)) return false;
    const text = cleanText(node.nodeValue);
    if (!text.trim() || text.length > MAX_SOURCE_CHARS) return false;
    // Do not spend quota on punctuation, IDs or a lone number.  Keep CJK and
    // RTL scripts through Unicode properties (supported by Chrome 114+).
    if (!/[\p{L}]/u.test(text)) return false;
    return visible(node.parentElement);
  }
  function collectTextNodes() {
    const result = [];
    if (!document.body) return result;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      if (eligibleTextNode(node)) result.push(node);
      if (result.length >= config.maxNodesPerScan) break;
    }
    return result;
  }
  function splitText(text) {
    const source = cleanText(text);
    if (source.length <= MAX_REQUEST_CHARS) return [{ text: source, separator: '' }];
    // Do not cut through a URL, e-mail address, credential-like value or
    // number.  The background protects these spans before sending them to the
    // provider; keeping each span intact avoids leaking its tail when a long
    // paragraph happens to cross the 3000-character boundary.
    const sensitive = /https?:\/\/[^\s<>]+|\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b|(?:[$€£]\s*\d+(?:[.,]\d+)*|\b\d+(?:[.,]\d+)*\s*[$€£])|\b\d+(?:[.,]\d+)*\b/gi;
    const ranges = [...source.matchAll(sensitive)].map(match => ({ start: match.index, end: match.index + match[0].length }));
    if (ranges.some(range => range.end - range.start > MAX_REQUEST_CHARS)) throw new Error('网页中的链接或数字过长，已跳过以保护原文。');
    const chunks = [];
    let rest = source;
    let offset = 0;
    while (rest.length) {
      let end = Math.min(MAX_REQUEST_CHARS, rest.length);
      if (end < rest.length) {
        // Search only inside the request budget.  Looking at index `end` and
        // then adding one would otherwise create a 3001-character request.
        const boundary = Math.max(rest.lastIndexOf(' ', end - 1), rest.lastIndexOf('\n', end - 1));
        // Keep the separator in the preceding chunk.  Joining translated
        // chunks without it would silently concatenate two words.
        if (boundary > Math.floor(MAX_REQUEST_CHARS * 0.55)) end = Math.min(MAX_REQUEST_CHARS, boundary + 1);
      }
      const crossing = ranges.find(range => range.start < offset + end && range.end > offset + end);
      if (crossing && crossing.start === offset && crossing.end > offset + end) throw new Error('网页中的链接或数字过长，已跳过以保护原文。');
      if (crossing && crossing.start > offset) end = crossing.start - offset;
      if (end <= 0) end = Math.min(MAX_REQUEST_CHARS, rest.length);
      const rawChunk = rest.slice(0, end);
      // background.js deliberately trims request text before protection and
      // provider submission.  Carry stripped boundary whitespace locally so
      // translated chunks are joined with the exact separator instead of
      // silently gluing the last word of one chunk to the first of the next.
      const leading = rawChunk.match(/^\s*/u)?.[0] || '';
      const trailing = rawChunk.slice(leading.length).match(/\s*$/u)?.[0] || '';
      const payloadEnd = trailing.length ? rawChunk.length - trailing.length : rawChunk.length;
      const payload = rawChunk.slice(leading.length, payloadEnd);
      if (!payload) {
        if (chunks.length) chunks[chunks.length - 1].separator += rawChunk;
      } else {
        if (leading && chunks.length) chunks[chunks.length - 1].separator += leading;
        chunks.push({ text: payload, separator: trailing });
      }
      rest = rest.slice(end);
      offset += end;
    }
    return chunks;
  }
  function cacheKey(text, target) {
    // The cache exists only in this isolated page world and is never persisted.
    // Use the exact source as part of the Map key: a 32-bit digest can collide
    // and must never cause one visible sentence to receive another's paid
    // translation merely because their hash and length happen to match.
    return `${target}\0${text}`;
  }
  function pruneCache() {
    const now = Date.now();
    for (const [key, value] of cache) if (value.expires <= now) cache.delete(key);
    while (cache.size > MAX_CACHE) cache.delete(cache.keys().next().value);
  }
  function runtimeRequest(request) {
    if (!globalThis.chrome?.runtime?.sendMessage) return Promise.reject(new Error('扩展后台不可用，请刷新页面。'));
    return Promise.resolve().then(() => chrome.runtime.sendMessage(request)).then(response => {
      if (!response || response.ok !== true || typeof response.translation !== 'string') {
        const error = new Error(String(response?.error || '翻译服务暂时不可用。'));
        error.code = response?.code;
        throw error;
      }
      if (response.jobId && response.jobId !== request.jobId) throw new Error('翻译响应与当前页面任务不匹配。');
      return response;
    });
  }
  function pump() {
    while (workers < 2 && queue.length) {
      const item = queue.shift();
      workers++;
      Promise.resolve().then(item.task).then(item.resolve, item.reject).finally(() => { workers--; pump(); notify(); });
    }
  }
  function enqueue(key, task) {
    if (jobs.has(key)) return jobs.get(key);
    if (queue.length >= MAX_QUEUE) return Promise.reject(new Error('网页翻译队列已满，请稍后重试。'));
    const promise = new Promise((resolve, reject) => { queue.push({ task, resolve, reject }); pump(); });
    jobs.set(key, promise);
    promise.finally(() => { if (jobs.get(key) === promise) jobs.delete(key); }).catch(() => {});
    return promise;
  }
  function rejectQueued(message) {
    const error = new Error(message);
    for (const item of queue.splice(0)) item.reject(error);
  }
  async function translateText(text, scope, token = generation, priority = 5) {
    if (!active || paused || token !== generation) throw new Error('网页翻译已暂停。');
    const source = cleanText(text).trim();
    if (!source) throw new Error('没有可翻译的文字。');
    if (source.length > MAX_SOURCE_CHARS) throw new Error('文字过长，请分段翻译。');
    // Bind every chunk of this logical unit to one target.  A configuration
    // change increments `generation`; queued work then fails locally before it
    // can reach the paid provider and a late in-flight response is discarded.
    const requestTarget = config.target;
    const output = [];
    for (const part of splitText(source)) {
      const chunk = part.text;
      if (!active || paused || token !== generation || requestTarget !== config.target) throw new Error('页面已改变，旧译文已丢弃。');
      pruneCache();
      const key = cacheKey(chunk, requestTarget);
      const cached = cache.get(key);
      if (cached && cached.expires > Date.now()) { output.push(cached.translation + part.separator); continue; }
      const jobId = safeId();
      const response = await enqueue(`${scope}:${key}`, () => {
        if (!active || paused || token !== generation || requestTarget !== config.target) throw new Error('页面已改变，旧翻译任务已取消。');
        return runtimeRequest({type:'WEB_TRANSLATE_TEXT',version:1,jobId,scope,text:chunk,target:requestTarget,webNonce,priority:Number.isFinite(priority)?priority:5});
      });
      if (!active || paused || token !== generation || requestTarget !== config.target) throw new Error('页面已改变，旧译文已丢弃。');
      const translation = cleanText(response.translation).trim();
      if (!translation) throw new Error('翻译服务返回空结果。');
      cache.set(key, { translation, expires: Date.now() + CACHE_TTL });
      output.push(translation + part.separator);
    }
    return output.join('');
  }

  function createUnit(textNode) {
    const rawSource = String(textNode.nodeValue ?? ''),source = cleanText(rawSource);
    const unit = document.createElement('span');
    unit.className = 'st-web-owned st-web-unit st-web-loading';
    unit.dataset.stWebId = `u-${++sequence}`;
    const original = document.createElement('span');
    original.className = 'st-web-original';
    original.textContent = rawSource;
    const translation = document.createElement('span');
    translation.className = 'st-web-translation';
    translation.setAttribute('aria-live', 'polite');
    translation.textContent = '翻译中…';
    unit.append(original, translation);
    metadata.set(unit, { source, rawSource, original, translation, state: 'loading', translationText: '' });
    units.add(unit);
    textNode.replaceWith(unit);
    return unit;
  }
  function applyMode() {
    for (const unit of units) {
      if (!unit.isConnected) continue;
      unit.classList.toggle('st-web-replace-mode', config.mode === 'replace');
      unit.setAttribute('data-st-web-mode', config.mode);
    }
  }
  function renderUnit(unit, translation, error = '') {
    const meta = metadata.get(unit);
    if (!meta || !unit.isConnected) return;
    meta.state = error ? 'error' : 'ready';
    meta.translationText = translation || '';
    meta.translation.textContent = error || translation || '';
    unit.classList.toggle('st-web-loading', false);
    unit.classList.toggle('st-web-error', !!error);
    unit.classList.toggle('st-web-ready', !error);
    applyMode();
  }
  async function translateUnit(unit, token) {
    const meta = metadata.get(unit);
    if (!meta || meta.state !== 'loading') return;
    try {
      const translation = await translateText(meta.source, 'page', token, 5);
      if (token !== generation || !active || !unit.isConnected) return;
      renderUnit(unit, translation);
    } catch (error) {
      if (token !== generation || !unit.isConnected) return;
      renderUnit(unit, '', error.message || '翻译失败，请重试。');
    }
  }
  async function retranslateKnownUnits(token) {
    const known = [...units].filter(unit => unit.isConnected && metadata.has(unit));
    for (const unit of known) {
      const meta = metadata.get(unit);
      meta.state = 'loading';meta.translationText = '';
      meta.translation.textContent = '翻译中…';
      unit.classList.add('st-web-loading');
      unit.classList.remove('st-web-error', 'st-web-ready');
    }
    // Previously translated units may now be outside the viewport.  They are
    // nevertheless known user-visible content and must change language
    // immediately.  Feed only two at a time so a long scrolled article cannot
    // overflow the bounded request queue.
    let cursor = 0;
    const consume = async () => {
      while (cursor < known.length && active && !paused && token === generation) {
        const unit = known[cursor++];
        await translateUnit(unit, token);
      }
    };
    await Promise.all([consume(), consume()]);
  }
  function pruneUnits() {
    for (const unit of [...units]) if (!unit.isConnected) units.delete(unit);
  }
  async function scan() {
    if (!document.body) { pendingScan = true;waitForBody();return; }
    if (!active || paused || scanRunning) { if (active && !paused) pendingScan = true; return; }
    scanRunning = true;
    try {
      pruneUnits();
      const token = generation;
      const nodes = collectTextNodes();
      for (const node of nodes) {
        if (!active || paused || token !== generation || !node.isConnected) continue;
        const unit = createUnit(node);
        translateUnit(unit, token); // queue is bounded; do not await every node
      }
      // If the page has more visible text, continue in a later task so one
      // large article cannot block input, captions or the WhatsApp module.
      if (nodes.length >= config.maxNodesPerScan) scheduleScan(220);
    } finally {
      scanRunning = false;
      if (pendingScan) { pendingScan = false; scheduleScan(80); }
      notify();
    }
  }
  function scheduleScan(delay = 120) {
    if (!active || paused) return;
    clearTimeout(scanTimer);
    scanTimer = setTimeout(() => { scanTimer = 0; scan().catch(() => {}); }, delay);
  }
  const viewportChanged = () => {
    if (!active || paused) return;
    clearTimeout(viewportTimer);viewportTimer=setTimeout(()=>scheduleScan(0),120);
  };
  addEventListener('scroll',viewportChanged,{passive:true,capture:true});
  addEventListener('resize',viewportChanged,{passive:true});

  function mutationRelevant(records) {
    return records.some(record => {
      const target = record.target instanceof Element ? record.target : record.target.parentElement;
      if (target?.closest('.st-web-owned')) return false;
      if (record.type === 'characterData') return true;
      return [...record.addedNodes].some(node => !(node instanceof Element && node.closest('.st-web-owned')) || node.nodeType === Node.TEXT_NODE);
    });
  }
  function attachMutationObserver() {
    observer?.disconnect();observer = null;
    if (!active || paused || !config.dynamic || !document.documentElement) return;
    observer = new MutationObserver(records => {
      if (!active || paused) return;
      if (!document.body) { waitForBody();return; }
      if (mutationRelevant(records)) scheduleScan(180);
    });
    // Observe the document element rather than the current body.  Some SPAs
    // replace <body>, and an early content-script activation may precede its
    // creation entirely.
    observer.observe(document.documentElement, { subtree: true, childList: true, characterData: true });
  }
  function clearBodyWait() {
    clearTimeout(bodyWaitTimer);bodyWaitTimer = 0;
    if (bodyReadyListening) {
      document.removeEventListener('DOMContentLoaded', bodyBecameReady);
      document.removeEventListener('readystatechange', bodyBecameReady);
      bodyReadyListening = false;
    }
  }
  function bodyBecameReady() {
    if (!active || paused || !document.body) return;
    clearBodyWait();attachMutationObserver();ensureToolbar();
    pendingScan = false;scheduleScan(0);
  }
  function waitForBody() {
    if (!active || paused) return;
    if (document.body) { bodyBecameReady();return; }
    if (!bodyReadyListening) {
      document.addEventListener('DOMContentLoaded', bodyBecameReady);
      document.addEventListener('readystatechange', bodyBecameReady);
      bodyReadyListening = true;
    }
    if (!bodyWaitTimer) bodyWaitTimer = setTimeout(() => { bodyWaitTimer = 0;waitForBody(); }, 50);
  }
  function armPage() {
    attachMutationObserver();
    if (document.body) bodyBecameReady(); else waitForBody();
  }

  function restoreUnits() {
    for (const unit of [...units]) {
      const meta = metadata.get(unit);
      if (!unit.isConnected || !meta) { units.delete(unit); continue; }
      // Replace only our wrapper.  The original text is restored as a text
      // node, so anchors, links, selection and form state remain untouched.
      unit.replaceWith(document.createTextNode(meta.rawSource));
      units.delete(unit);
    }
  }
  function removeSelectionBubble() {
    selectionBubble?.remove(); selectionBubble = null; selectionBusy = false;
  }
  function showSelectionBubble(rect, text = '') {
    if (!selectionBubble) {
      selectionBubble = document.createElement('div');
      selectionBubble.id = 'st-web-selection-result';
      selectionBubble.className = 'st-web-owned st-web-selection-result';
      document.documentElement.append(selectionBubble);
    }
    selectionBubble.textContent = text;
    const top = Math.max(8, (rect?.top || 8) + scrollY - selectionBubble.offsetHeight - 8);
    const left = Math.min(Math.max(8, (rect?.left || 8) + scrollX), Math.max(8, innerWidth - 320) + scrollX);
    selectionBubble.style.top = `${top}px`;
    selectionBubble.style.left = `${left}px`;
    selectionBubble.hidden = !text;
  }
  async function translateSelection() {
    if (!active || paused || selectionBusy) return null;
    const selection = getSelection();
    const text = cleanText(selection?.toString() || '').trim();
    if (!text) throw new Error('请先选择要翻译的文字。');
    if (text.length > MAX_SOURCE_CHARS) throw new Error('选中文字过长，请分段选择。');
    const rect = selection.rangeCount ? selection.getRangeAt(0).getBoundingClientRect() : null;
    const token = generation;
    selectionBusy = true;showSelectionBubble(rect, '翻译中…');
    try {
      const translation = await translateText(text, 'selection', token, 20);
      if (token !== generation || !active) return null;
      showSelectionBubble(rect, translation);return translation;
    } catch (error) {
      if (token === generation) showSelectionBubble(rect, error.message || '翻译失败，请稍后重试。');
      throw error;
    } finally { selectionBusy = false; }
  }

  function makeButton(label, action) {
    const button = document.createElement('button');
    button.type = 'button';button.textContent = label;button.addEventListener('click', action);
    return button;
  }
  function updateToolbar(snapshot = status()) {
    if (!toolbar) return;
    const state = toolbar.querySelector('[data-st-web-status]');
    const mode = toolbar.querySelector('[data-st-web-action="toggle-mode"]');
    if (state) state.textContent = snapshot.paused ? '已暂停' : snapshot.enabled ? `翻译中 · ${snapshot.translatedUnits}` : '已停止';
    if (mode) mode.textContent = snapshot.mode === 'replace' ? '显示双语' : '仅显示译文';
  }
  function ensureToolbar() {
    if (!config.showToolbar || toolbar || !active || !document.documentElement) return;
    toolbar = document.createElement('aside');
    toolbar.id = 'st-web-toolbar';toolbar.className = 'st-web-owned st-web-toolbar';
    toolbar.setAttribute('aria-label', '超级翻译网页工具');
    const title = document.createElement('strong');title.textContent = '超级翻译 · 网页';
    const state = document.createElement('span');state.dataset.stWebStatus = '1';state.setAttribute('aria-live', 'polite');
    const selection = makeButton('翻译选中文字', () => translateSelection().catch(() => {}));selection.dataset.stWebAction = 'selection';
    const mode = makeButton('仅显示译文', () => { config.mode = config.mode === 'replace' ? 'bilingual' : 'replace'; applyMode(); notify(); });mode.dataset.stWebAction = 'toggle-mode';
    const stop = makeButton('停止网页翻译', () => {
      configure({ enabled: false });
      // Revoke the background capability as well.  Otherwise a page-local
      // toolbar stop would leave a valid cloud proxy nonce alive until TTL.
      try { chrome.runtime.sendMessage({ type: 'WEB_REVOKE', version: 1, webNonce }); } catch {}
    });stop.dataset.stWebAction = 'stop';
    toolbar.append(title, state, selection, mode, stop);document.documentElement.append(toolbar);updateToolbar();
  }
  function removeToolbar() { toolbar?.remove();toolbar = null;removeSelectionBubble(); }
  function configure(next = {}) {
    if (!eligible) return status({ enabled: false });
    if (typeof next.webNonce === 'string' && WEB_NONCE_RE.test(next.webNonce)) webNonce = next.webNonce;
    const previous = { ...config };const before = JSON.stringify(config);config = normalizeConfig(next);delete config.webNonce;
    if (config.enabled && !WEB_NONCE_RE.test(webNonce)) throw new Error('网页翻译授权无效，请从扩展菜单重新启用。');
    const changed = before !== JSON.stringify(config);
    if (!config.enabled) { stop(); return status(); }
    if (!active) {
      active = true;paused = false;generation++;armPage();
    } else if (changed) {
      if (previous.target !== config.target) {
        generation++;rejectQueued('目标语言已改变，旧翻译任务已取消。');
        retranslateKnownUnits(generation).catch(() => {});
      }
      if (config.showToolbar) ensureToolbar(); else removeToolbar();
      armPage();
      applyMode();scheduleScan(0);
    }
    if (config.subtitles && globalThis.STWebSubtitles?.configure) globalThis.STWebSubtitles.configure({ enabled: true, target: config.target, mode: config.mode, webNonce });
    else if (!config.subtitles && globalThis.STWebSubtitles?.configure) globalThis.STWebSubtitles.configure({ enabled: false });
    notify();return status();
  }
  function stop() {
    active = false;paused = false;generation++;clearTimeout(scanTimer);scanTimer = 0;clearTimeout(viewportTimer);viewportTimer=0;
    clearBodyWait();
    observer?.disconnect();observer = null;
    rejectQueued('网页翻译已停止。');
    restoreUnits();cache.clear();jobs.clear();removeToolbar();
    if (globalThis.STWebSubtitles?.configure) globalThis.STWebSubtitles.configure({ enabled: false });
    notify();return status();
  }
  function pause() { if (!active) return status(); paused = true;generation++;clearTimeout(scanTimer);clearBodyWait();observer?.disconnect();observer=null;rejectQueued('网页翻译已暂停。');restoreUnits();notify();return status(); }
  function resume() { if (!active) return status(); paused = false;generation++;armPage();notify();return status(); }
  function setMode(mode) { config.mode = mode === 'replace' ? 'replace' : 'bilingual';applyMode();notify();return status(); }

  const api = {
    version: 1, eligible: true, status, configure, start: () => configure({ enabled: true }), stop,
    pause, resume, setMode, translateSelection,
    subscribe(fn) { if (typeof fn !== 'function') return () => {};listeners.add(fn);try { fn(status()); } catch {}return () => listeners.delete(fn); }
  };
  globalThis.STWebTranslator = Object.freeze(api);
  // Expose read-only diagnostics through the DOM for extension E2E and support
  // inspection.  Content-script globals live in an isolated world and are not
  // visible to page JavaScript; no source text, nonce or translation is placed
  // here.
  function publishStatus(snapshot = status()) {
    try {
      const root = document.documentElement;
      if (!root) return;
      root.dataset.stWebEnabled = snapshot.enabled ? '1' : '0';
      root.dataset.stWebPaused = snapshot.paused ? '1' : '0';
      root.dataset.stWebTranslatedUnits = String(snapshot.translatedUnits || 0);
    } catch {}
  }
  api.subscribe(publishStatus);

  // Popup/background controllers use this narrow message surface.  Unknown
  // messages are ignored so it cannot interfere with WhatsApp's own events.
  if (globalThis.chrome?.runtime?.onMessage) chrome.runtime.onMessage.addListener((message, sender, respond) => {
    if (sender?.id !== chrome.runtime.id) return false;
    if (!message || message.version !== 1) return false;
    const controls = new Set(['WEB_CONFIGURE','WEB_REKEY','WEB_STATUS','WEB_STOP','WEB_PAUSE','WEB_RESUME','WEB_TRANSLATE_SELECTION']);
    if (!controls.has(message.type)) return false;
    const suppliedNonce = typeof message.nonce === 'string' ? message.nonce : '';
    const rejectControl = () => { respond({ ok: false, error: '网页翻译授权无效。' });return false; };
    if (!['WEB_CONFIGURE', 'WEB_REKEY'].includes(message.type) && (!WEB_NONCE_RE.test(suppliedNonce) || suppliedNonce !== webNonce)) return rejectControl();
    if (message.type === 'WEB_STATUS') { respond(status());return false; }
    if (message.type === 'WEB_CONFIGURE') {
      try {
        if (!WEB_NONCE_RE.test(suppliedNonce)) throw new Error('网页翻译授权无效。');
        if (active && WEB_NONCE_RE.test(webNonce) && suppliedNonce !== webNonce) throw new Error('网页翻译授权已变更，请重新启用。');
        if (typeof message.settings?.webNonce === 'string' && message.settings.webNonce !== suppliedNonce) throw new Error('网页翻译授权不一致。');
        respond(configure({ ...(message.settings || {}), webNonce: message.nonce }));
      } catch (error) { respond({ ok: false, error: error.message }); }
      return false;
    }
    if (message.type === 'WEB_REKEY') {
      try {
        if (!WEB_NONCE_RE.test(suppliedNonce)) throw new Error('网页翻译授权无效。');
        if (typeof message.settings?.webNonce === 'string' && message.settings.webNonce !== suppliedNonce) throw new Error('网页翻译授权不一致。');
        // This control is sent only by the extension background after it has
        // created or recovered the tab-bound session.  On an orphan handover,
        // invalidate queued/in-flight work but preserve already-rendered page
        // units; restoring only visible text would otherwise blank translated
        // content above/below the current viewport.
        if (!active || suppliedNonce === webNonce) {
          respond(configure({ ...(message.settings || {}), enabled: true, webNonce: suppliedNonce }));
          return false;
        }
        const previousTarget = config.target;
        generation++;
        rejectQueued('网页翻译授权已更新，旧任务已取消。');
        jobs.clear();
        webNonce = suppliedNonce;
        config = normalizeConfig({ ...(message.settings || {}), enabled: true });
        delete config.webNonce;
        paused = false;
        const token = generation;
        if (previousTarget !== config.target) retranslateKnownUnits(token).catch(() => {});
        else for (const unit of units) {
          const meta = metadata.get(unit);
          if (unit.isConnected && meta?.state === 'loading') translateUnit(unit, token);
        }
        if (config.showToolbar) ensureToolbar(); else removeToolbar();
        armPage();applyMode();scheduleScan(0);
        if (config.subtitles && globalThis.STWebSubtitles?.configure) globalThis.STWebSubtitles.configure({ enabled: true, target: config.target, mode: config.mode, webNonce });
        else if (globalThis.STWebSubtitles?.configure) globalThis.STWebSubtitles.configure({ enabled: false });
        notify();respond(status());
      } catch (error) { respond({ ok: false, error: error.message }); }
      return false;
    }
    if (message.type === 'WEB_STOP') { respond(stop());return false; }
    if (message.type === 'WEB_PAUSE') { respond(pause());return false; }
    if (message.type === 'WEB_RESUME') { respond(resume());return false; }
    if (message.type === 'WEB_TRANSLATE_SELECTION') { translateSelection().then(translation => respond({ ok: true, translation }), error => respond({ ok: false, error: error.message }));return true; }
    return false;
  });

  // Do not listen to a page-originated CustomEvent here.  Any website script
  // can dispatch such an event, so activation must come through the extension
  // message channel after the background has checked the tab/origin capability.
})();
