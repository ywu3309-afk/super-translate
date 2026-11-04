(() => {
  'use strict';

  /*
   * Opt-in subtitle adapter for generic web pages.
   *
   * It reads only cues that the browser has already exposed through an HTML5
   * TextTrack or a narrowly recognised, visible caption DOM node. It never
   * downloads media, captures audio, changes playback state, or bypasses
   * DRM/CORS. Cloud requests use WEB_TRANSLATE_TEXT with scope "subtitle".
   */
  if (globalThis.STWebSubtitles) return;

  const hostname = String(location.hostname || '').toLowerCase();
  const isWhatsApp = hostname === 'web.whatsapp.com' || hostname.endsWith('.whatsapp.com');
  const eligible = (
    (location.protocol === 'https:' || location.protocol === 'http:') &&
    window.top === window &&
    !isWhatsApp
  );

  if (!eligible) {
    globalThis.STWebSubtitles = Object.freeze({
      version: 1,
      eligible: false,
      status: () => ({
        ok: true,
        eligible: false,
        enabled: false,
        reason: isWhatsApp ? 'whatsapp-specialized' : 'unsupported-page'
      }),
      configure: () => ({ ok: true, eligible: false, enabled: false }),
      start: () => ({ ok: true, eligible: false, enabled: false }),
      stop: () => ({ ok: true, eligible: false, enabled: false })
    });
    return;
  }

  const DEFAULTS = Object.freeze({ enabled: false, target: 'en', mode: 'bilingual' });
  const MAX_CUE_CHARS = 3000;
  const MAX_CACHE = 120;
  const CACHE_TTL = 10 * 60 * 1000;
  const WEB_NONCE_RE = /^[A-Za-z0-9_-]{24,128}$/;
  const CAPTION_SELECTOR = [
    '.ytp-caption-window-container',
    '.captions-text',
    '[data-testid="captions-container"]',
    '[data-testid="video-caption"]',
    '[data-testid="video-captions"]',
    '[data-purpose="captions"]',
    '[class~="caption-window"]',
    '[class~="captions-container"]',
    '.player-timedtext',
    '.jw-text-track-display',
    '.vjs-text-track-display',
    '.plyr__captions',
    '.dplayer-subtitle',
    '.art-subtitle',
    '.shaka-text-container'
  ].join(', ');

  const listeners = new Set();
  const videoStates = new Map();
  const cache = new Map();
  const inflight = new Map();
  const captionOwners = new WeakMap();

  let config = { ...DEFAULTS };
  let webNonce = '';
  let active = false;
  let generation = 0;
  let observer = null;
  let bodyReadyListener = null;
  let pollTimer = 0;
  let sequence = 0;

  const clean = value => String(value ?? '')
    .replace(/\u00a0/g, ' ')
    .replace(/[\u200b-\u200d\ufeff]/g, '')
    .replace(/\r\n?/g, '\n')
    .trim();
  const stripCueMarkup = value => clean(String(value ?? '')
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<[^>]*>/g, ''));
  const id = () => {
    try {
      return crypto.randomUUID();
    } catch {
      return `subtitle-${Date.now()}-${++sequence}`;
    }
  };
  const targetValid = value => (
    /^[A-Za-z]{2,3}(?:-[A-Za-z]{2,4})?$/.test(String(value || '')) &&
    String(value).toLowerCase() !== 'auto'
  );

  function normalize(patch) {
    const next = { ...config, ...(patch && typeof patch === 'object' ? patch : {}) };
    next.enabled = next.enabled === true;
    next.target = targetValid(next.target) ? String(next.target) : config.target;
    next.mode = next.mode === 'replace' ? 'replace' : 'bilingual';
    return next;
  }

  function status(extra = {}) {
    return {
      ok: true,
      version: 1,
      eligible: true,
      enabled: active,
      target: config.target,
      mode: config.mode,
      videos: videoStates.size,
      ...extra
    };
  }

  function notify(extra) {
    const snapshot = status(extra);
    for (const fn of listeners) {
      try { fn(snapshot); } catch {}
    }
    try {
      window.dispatchEvent(new CustomEvent('st-web-subtitle-status', { detail: snapshot }));
    } catch {}
  }

  function cacheKey(text, target) {
    // This cache exists only in the isolated page-world content script. Keep
    // the exact source in the key rather than a lossy 32-bit hash: a collision
    // must never display or charge the translation of another subtitle cue.
    return `${target}\0${text}`;
  }

  function pruneCache() {
    const now = Date.now();
    for (const [key, value] of cache) {
      if (value.expires <= now) cache.delete(key);
    }
    while (cache.size > MAX_CACHE) cache.delete(cache.keys().next().value);
  }

  async function request(text, token) {
    const source = clean(text);
    if (!source) return '';
    if (source.length > MAX_CUE_CHARS) throw new Error('字幕片段过长，已跳过。');
    if (token !== generation || !active) throw new Error('字幕翻译已停止。');

    const requestTarget = config.target;
    const requestNonce = webNonce;
    pruneCache();
    const key = cacheKey(source, requestTarget);
    const cached = cache.get(key);
    if (cached && cached.expires > Date.now()) return cached.translation;

    // Capability rotation must not share an in-flight request created with a
    // previous nonce, even when target and source text are unchanged.
    const inflightKey = `${requestNonce}\0${key}`;
    if (inflight.has(inflightKey)) return inflight.get(inflightKey);

    const jobId = id();
    const promise = Promise.resolve().then(async () => {
      if (
        token !== generation ||
        !active ||
        requestTarget !== config.target ||
        requestNonce !== webNonce
      ) throw new Error('字幕已切换，旧译文已丢弃。');
      if (!globalThis.chrome?.runtime?.sendMessage) throw new Error('扩展后台不可用，请刷新页面。');

      const response = await chrome.runtime.sendMessage({
        type: 'WEB_TRANSLATE_TEXT',
        version: 1,
        jobId,
        scope: 'subtitle',
        text: source,
        target: requestTarget,
        webNonce: requestNonce,
        priority: 10
      });
      if (!response || response.ok !== true || typeof response.translation !== 'string') {
        throw new Error(String(response?.error || '字幕翻译服务暂时不可用。'));
      }
      if (response.jobId && response.jobId !== jobId) throw new Error('字幕翻译响应与当前任务不匹配。');
      if (
        token !== generation ||
        !active ||
        requestTarget !== config.target ||
        requestNonce !== webNonce
      ) throw new Error('字幕已切换，旧译文已丢弃。');

      const translation = clean(response.translation);
      if (!translation) throw new Error('字幕翻译返回空结果。');
      cache.set(key, { translation, expires: Date.now() + CACHE_TTL });
      return translation;
    });

    inflight.set(inflightKey, promise);
    promise.finally(() => {
      if (inflight.get(inflightKey) === promise) inflight.delete(inflightKey);
    }).catch(() => {});
    return promise;
  }

  function visibleVideoRect(video) {
    if (!video?.isConnected) return null;
    const style = getComputedStyle(video);
    if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse') return null;
    const rect = video.getBoundingClientRect();
    if (
      rect.width <= 0 || rect.height <= 0 || rect.bottom <= 0 || rect.top >= window.innerHeight ||
      rect.right <= 0 || rect.left >= window.innerWidth
    ) return null;
    return rect;
  }

  function rectOverlay(overlay, video) {
    if (!overlay) return;
    const rect = visibleVideoRect(video);
    if (!rect) {
      overlay.hidden = true;
      return;
    }
    const left = Math.max(0, rect.left);
    const right = Math.min(window.innerWidth, rect.right);
    overlay.hidden = false;
    // web.css deliberately resets all host-page styles with `all: initial
    // !important`; these geometry declarations therefore also need the
    // important priority or the overlay falls back into document flow below
    // the player instead of staying over its video.
    overlay.style.setProperty('left', `${left}px`, 'important');
    overlay.style.setProperty(
      'top',
      `${Math.max(0, Math.min(window.innerHeight, rect.bottom) - Math.min(130, rect.height * .32))}px`,
      'important'
    );
    overlay.style.setProperty('width', `${Math.max(1, right - left)}px`, 'important');

    const state = videoStates.get(video);
    const overlayHeight = overlay.getBoundingClientRect().height;
    const videoTop = Math.max(0, rect.top);
    const videoBottom = Math.min(window.innerHeight, rect.bottom);
    let top = videoBottom - Math.min(130, rect.height * .32);

    if (state?.lastSourceKind === 'dom' && state.captionNode?.isConnected) {
      const captionRect = state.captionNode.getBoundingClientRect();
      if (captionRect.width > 0 && captionRect.height > 0) {
        // A visible DOM caption already supplies the original in bilingual
        // mode. Put our translation immediately above it instead of painting
        // another copy over the same subtitle band. In replace mode the
        // native node is only made visually transparent, so its rectangle is
        // still the best stable anchor for the translated line.
        top = config.mode === 'replace'
          ? captionRect.top + (captionRect.height - overlayHeight) / 2
          : captionRect.top - overlayHeight - 6;
      }
    } else if (state?.lastSourceKind === 'track' && state.lastSourceVisible && config.mode !== 'replace') {
      // A TextTrack in `showing` mode is already rendered by the browser.
      // Reserve the player's bottom subtitle band for it and place only the
      // translation above that band.
      const nativeBandTop = videoBottom - Math.min(72, rect.height * .22);
      top = nativeBandTop - overlayHeight - 6;
    }

    const maxTop = Math.max(videoTop, videoBottom - overlayHeight);
    top = Math.max(videoTop, Math.min(top, maxTop));
    overlay.style.setProperty('top', `${top}px`, 'important');
  }

  function overlayFor(video) {
    const state = videoStates.get(video);
    if (state?.overlay) return state.overlay;
    const root = document.documentElement || document.body;
    if (!root) return null;
    const overlay = document.createElement('div');
    overlay.className = 'st-web-owned st-web-subtitle-overlay';
    overlay.hidden = true;
    overlay.setAttribute('aria-live', 'polite');
    if (state) overlay.dataset.stWebSubtitleFor = state.id;
    root.append(overlay);
    return overlay;
  }

  function restoreNativeSource(state) {
    state?.captionNode?.classList.remove('st-web-subtitle-source-hidden');
    state?.video?.classList.remove('st-web-subtitle-native-cues-hidden');
  }

  function syncNativeSourcePresentation(state, sourceKind, sourceVisible) {
    if (!state) return;
    const hideNative = config.mode === 'replace' && sourceVisible;
    state.captionNode?.classList.toggle(
      'st-web-subtitle-source-hidden',
      hideNative && sourceKind === 'dom'
    );
    state.video?.classList.toggle(
      'st-web-subtitle-native-cues-hidden',
      hideNative && sourceKind === 'track'
    );
  }

  function render(video, original, translation, token, sourceKind, sourceVisible) {
    const state = videoStates.get(video);
    if (!state || token !== generation || !active) return;
    state.overlay = state.overlay || overlayFor(video);
    if (!state.overlay) return;
    state.lastOriginal = original;
    state.lastTranslation = translation;
    if (sourceKind) state.lastSourceKind = sourceKind;
    if (typeof sourceVisible === 'boolean') state.lastSourceVisible = sourceVisible;
    syncNativeSourcePresentation(state, state.lastSourceKind, state.lastSourceVisible);
    state.overlay.replaceChildren();
    // If the page/browser already renders the source cue, bilingual mode
    // reuses that native original and adds only the translation. This avoids
    // duplicated captions while preserving both languages. Hidden/disabled
    // TextTracks still need their original rendered in our overlay.
    if (config.mode !== 'replace' && !state.lastSourceVisible) {
      const source = document.createElement('div');
      source.className = 'st-web-subtitle-original';
      source.textContent = original;
      state.overlay.append(source);
    }
    const translated = document.createElement('div');
    translated.className = 'st-web-subtitle-translation';
    translated.textContent = translation;
    state.overlay.append(translated);
    rectOverlay(state.overlay, video);
  }

  function cueText(cue) {
    return stripCueMarkup(cue?.text || cue?.payload?.text || '');
  }

  function activeTrackText(video) {
    const tracks = video.textTracks;
    if (!tracks) return null;
    const chunks = [];
    for (let i = 0; i < tracks.length; i++) {
      const track = tracks[i];
      if (!track || !['subtitles', 'captions', ''].includes(String(track.kind || '').toLowerCase())) continue;
      const cues = track.activeCues;
      if (!cues?.length) continue;
      const sourceVisible = String(track.mode || '').toLowerCase() === 'showing';
      for (let j = 0; j < cues.length; j++) {
        const text = cueText(cues[j]);
        if (text) chunks.push({
          text,
          start: Number(cues[j].startTime) || 0,
          end: Number(cues[j].endTime) || 0,
          lang: String(track.language || ''),
          sourceVisible
        });
      }
      if (chunks.length) break;
    }
    if (!chunks.length) return null;
    const text = chunks.map(item => item.text).join('\n');
    const first = chunks[0];
    return {
      text,
      key: `track:${first.sourceVisible ? 'showing' : 'hidden'}:${first.lang}:${first.start}:${first.end}:${text}`,
      sourceKind: 'track',
      sourceVisible: first.sourceVisible
    };
  }

  function visibleCaptionRect(node) {
    if (!(node instanceof Element) || !node.isConnected || node.hidden || node.getAttribute('aria-hidden') === 'true') return null;
    const style = getComputedStyle(node);
    if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse') return null;
    const rect = node.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 ? rect : null;
  }

  function containerVideoForCaption(node) {
    let parent = node.parentElement;
    let depth = 0;
    while (parent && parent !== document.body && parent !== document.documentElement && depth++ < 12) {
      const videos = [...parent.querySelectorAll('video')].filter(video => video.isConnected);
      if (videos.length === 1) return videos[0];
      if (videos.length > 1) return null;
      parent = parent.parentElement;
    }
    return null;
  }

  function geometricVideoForCaption(nodeRect) {
    const matches = [];
    for (const video of videoStates.keys()) {
      const videoRect = visibleVideoRect(video);
      if (!videoRect) continue;
      const width = Math.max(0, Math.min(nodeRect.right, videoRect.right) - Math.max(nodeRect.left, videoRect.left));
      const height = Math.max(0, Math.min(nodeRect.bottom, videoRect.bottom) - Math.max(nodeRect.top, videoRect.top));
      const overlap = width * height;
      const nodeArea = Math.max(1, nodeRect.width * nodeRect.height);
      const centerX = nodeRect.left + nodeRect.width / 2;
      const centerY = nodeRect.top + nodeRect.height / 2;
      const centerInside = centerX >= videoRect.left && centerX <= videoRect.right && centerY >= videoRect.top && centerY <= videoRect.bottom;
      if (centerInside || overlap / nodeArea >= .5) matches.push(video);
    }
    return matches.length === 1 ? matches[0] : null;
  }

  function releaseCaption(state) {
    const node = state?.captionNode;
    node?.classList.remove('st-web-subtitle-source-hidden');
    if (node && captionOwners.get(node) === state.video) captionOwners.delete(node);
    if (state) state.captionNode = null;
  }

  function claimCaption(state, node) {
    if (state.captionNode !== node) releaseCaption(state);
    const owner = captionOwners.get(node);
    if (owner && owner !== state.video && owner.isConnected) return false;
    captionOwners.set(node, state.video);
    state.captionNode = node;
    return true;
  }

  function domCaptionText(state) {
    const video = state.video;
    const videoRect = visibleVideoRect(video);
    if (!videoRect) {
      releaseCaption(state);
      return null;
    }

    const candidates = [...document.querySelectorAll(CAPTION_SELECTOR)].filter(node => {
      if (node.closest('.st-web-owned')) return false;
      const rect = visibleCaptionRect(node);
      if (!rect) return false;
      const text = stripCueMarkup(node.innerText || node.textContent);
      if (!text || text.length > MAX_CUE_CHARS) return false;
      const owner = captionOwners.get(node);
      if (owner && owner !== video && owner.isConnected) return false;
      const containerVideo = containerVideoForCaption(node);
      return (containerVideo || geometricVideoForCaption(rect)) === video;
    });

    candidates.sort((a, b) => {
      const ar = a.getBoundingClientRect();
      const br = b.getBoundingClientRect();
      const vx = videoRect.left + videoRect.width / 2;
      const vy = videoRect.top + videoRect.height / 2;
      return Math.hypot(ar.left + ar.width / 2 - vx, ar.top + ar.height / 2 - vy) -
        Math.hypot(br.left + br.width / 2 - vx, br.top + br.height / 2 - vy);
    });

    const node = candidates[0];
    if (!node || !claimCaption(state, node)) {
      releaseCaption(state);
      return null;
    }
    const text = stripCueMarkup(node.innerText || node.textContent);
    if (!text || text.length > MAX_CUE_CHARS) {
      releaseCaption(state);
      return null;
    }
    return { text, key: `dom:${text}`, sourceKind: 'dom', sourceVisible: true };
  }

  async function updateVideo(video) {
    const state = videoStates.get(video);
    if (!state || !active) return;
    if (!visibleVideoRect(video)) {
      if (state.overlay) state.overlay.hidden = true;
      return;
    }

    // Prefer a visible, player-owned DOM caption over a parallel TextTrack.
    // It proves that the original is already on screen (YouTube and many
    // custom players expose both), so copying the track text would duplicate
    // the page's own subtitle.
    const domCue = domCaptionText(state);
    const trackCue = activeTrackText(video);
    const cue = domCue || trackCue;
    if (!domCue && trackCue) releaseCaption(state);
    if (!cue) {
      state.requestSeq++;
      state.pending = false;
      state.lastKey = '';
      state.lastOriginal = '';
      state.lastTranslation = '';
      state.lastSourceKind = '';
      state.lastSourceVisible = false;
      restoreNativeSource(state);
      if (state.overlay) state.overlay.hidden = true;
      return;
    }
    if (state.lastKey === cue.key) {
      state.lastSourceKind = cue.sourceKind;
      state.lastSourceVisible = cue.sourceVisible;
      // Never hide the page's working source subtitle while a translation is
      // pending or after it failed. Replace mode suppresses the native cue
      // only once a translated line is ready to take its place.
      if (state.lastTranslation) {
        syncNativeSourcePresentation(state, cue.sourceKind, cue.sourceVisible);
      } else {
        restoreNativeSource(state);
      }
      if (state.overlay) rectOverlay(state.overlay, video);
      return;
    }

    state.lastKey = cue.key;
    state.lastOriginal = '';
    state.lastTranslation = '';
    state.lastSourceKind = cue.sourceKind;
    state.lastSourceVisible = cue.sourceVisible;
    restoreNativeSource(state);
    const token = generation;
    const requestSeq = ++state.requestSeq;
    state.pending = true;
    try {
      const translation = await request(cue.text, token);
      if (token === generation && active && requestSeq === state.requestSeq && state.lastKey === cue.key) {
        render(video, cue.text, translation, token, cue.sourceKind, cue.sourceVisible);
      }
    } catch (error) {
      if (token === generation && active && requestSeq === state.requestSeq && state.lastKey === cue.key) {
        restoreNativeSource(state);
        state.overlay = state.overlay || overlayFor(video);
        if (state.overlay) {
          state.overlay.textContent = error.message || '字幕翻译失败';
          rectOverlay(state.overlay, video);
        }
      }
    } finally {
      if (requestSeq === state.requestSeq) state.pending = false;
    }
  }

  function bindTracks(state) {
    const tracks = state.video?.textTracks;
    if (!tracks) return;
    for (let i = 0; i < tracks.length; i++) {
      const track = tracks[i];
      if (!track || state.boundTracks.has(track)) continue;
      state.boundTracks.add(track);
      try {
        track.addEventListener('cuechange', () => {
          if (active) updateVideo(state.video).catch(() => {});
        }, { signal: state.controller.signal });
      } catch {}
    }
  }

  function attachVideo(video) {
    if (!(video instanceof HTMLVideoElement) || videoStates.has(video)) return;
    const state = {
      id: id(), video, overlay: null, captionNode: null, lastKey: '',
      lastOriginal: '', lastTranslation: '', lastSourceKind: '', lastSourceVisible: false,
      pending: false, requestSeq: 0,
      controller: new AbortController(), boundTracks: new WeakSet()
    };
    videoStates.set(video, state);
    // Observational only: no play(), pause(), mode, currentTime, volume, or
    // playbackRate mutation is performed.
    for (const type of ['timeupdate', 'seeking', 'loadedmetadata', 'emptied', 'durationchange']) {
      video.addEventListener(type, () => {
        if (active) updateVideo(video).catch(() => {});
      }, { passive: true, signal: state.controller.signal });
    }
    bindTracks(state);
    updateVideo(video).catch(() => {});
  }

  function detachVideo(video, state) {
    state.requestSeq++;
    state.controller?.abort();
    restoreNativeSource(state);
    state.overlay?.remove();
    releaseCaption(state);
    videoStates.delete(video);
  }

  function scanVideos() {
    for (const video of document.querySelectorAll('video')) attachVideo(video);
    for (const [video, state] of videoStates) {
      if (!video.isConnected) detachVideo(video, state);
      else {
        bindTracks(state);
        rectOverlay(state.overlay, video);
      }
    }
  }

  function clearBodyReadyListener() {
    if (!bodyReadyListener) return;
    document.removeEventListener('DOMContentLoaded', bodyReadyListener);
    bodyReadyListener = null;
  }

  function observeBodyWhenReady() {
    if (!active || observer) return;
    if (document.body) {
      clearBodyReadyListener();
      observer = new MutationObserver(() => {
        if (active) scanVideos();
      });
      observer.observe(document.body, { childList: true, subtree: true });
      scanVideos();
      return;
    }
    if (!bodyReadyListener) {
      bodyReadyListener = () => {
        bodyReadyListener = null;
        if (active) observeBodyWhenReady();
      };
      document.addEventListener('DOMContentLoaded', bodyReadyListener, { once: true });
    }
  }

  function start() {
    if (active) return status();
    active = true;
    generation++;
    scanVideos();
    observeBodyWhenReady();
    pollTimer = window.setInterval(() => {
      if (!active) return;
      observeBodyWhenReady();
      scanVideos();
      for (const video of videoStates.keys()) updateVideo(video).catch(() => {});
    }, 300);
    notify();
    return status();
  }

  function stop() {
    active = false;
    generation++;
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = 0;
    observer?.disconnect();
    observer = null;
    clearBodyReadyListener();
    for (const [video, state] of videoStates) detachVideo(video, state);
    cache.clear();
    inflight.clear();
    notify();
    return status();
  }

  function resetForTranslationChange() {
    generation++;
    for (const state of videoStates.values()) {
      state.requestSeq++;
      state.pending = false;
      state.lastKey = '';
      state.lastOriginal = '';
      state.lastTranslation = '';
      state.lastSourceKind = '';
      state.lastSourceVisible = false;
      restoreNativeSource(state);
      state.overlay?.remove();
      state.overlay = null;
    }
    scanVideos();
    for (const video of videoStates.keys()) updateVideo(video).catch(() => {});
  }

  function applyMode() {
    for (const state of videoStates.values()) {
      if (state.lastOriginal && state.lastTranslation) {
        render(state.video, state.lastOriginal, state.lastTranslation, generation);
      }
    }
  }

  function configure(patch = {}) {
    const previousTarget = config.target;
    const previousMode = config.mode;
    const previousNonce = webNonce;
    if (Object.prototype.hasOwnProperty.call(patch, 'webNonce')) {
      if (typeof patch.webNonce !== 'string' || !WEB_NONCE_RE.test(patch.webNonce)) {
        throw new Error('网页翻译授权无效，请从扩展菜单重新启用。');
      }
      webNonce = patch.webNonce;
    }
    config = normalize(patch);
    if (config.enabled && !WEB_NONCE_RE.test(webNonce)) {
      throw new Error('网页翻译授权无效，请从扩展菜单重新启用。');
    }
    if (!config.enabled) return stop();
    if (!active) return start();
    const translationChanged = previousTarget !== config.target || previousNonce !== webNonce;
    if (translationChanged) resetForTranslationChange();
    else if (previousMode !== config.mode) applyMode();
    notify();
    return status();
  }

  const api = {
    version: 1,
    eligible: true,
    status,
    configure,
    start: () => configure({ enabled: true }),
    stop,
    setMode(mode) {
      const nextMode = mode === 'replace' ? 'replace' : 'bilingual';
      if (config.mode !== nextMode) {
        config = { ...config, mode: nextMode };
        if (active) applyMode();
        notify();
      }
      return status();
    },
    subscribe(fn) {
      if (typeof fn !== 'function') return () => {};
      listeners.add(fn);
      try { fn(status()); } catch {}
      return () => listeners.delete(fn);
    }
  };
  globalThis.STWebSubtitles = Object.freeze(api);

  if (globalThis.chrome?.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener((message, sender, respond) => {
      if (sender?.id !== chrome.runtime.id) return false;
      if (!message || message.version !== 1) return false;
      if (!['WEB_SUBTITLE_STATUS', 'WEB_SUBTITLE_CONFIGURE', 'WEB_SUBTITLE_STOP'].includes(message.type)) return false;

      const authError = () => {
        respond({ ok: false, error: '网页翻译授权已失效。' });
        return false;
      };
      if (message.type === 'WEB_SUBTITLE_CONFIGURE') {
        if (typeof message.nonce !== 'string' || !WEB_NONCE_RE.test(message.nonce)) return authError();
        if (webNonce && message.nonce !== webNonce) return authError();
        if (message.settings && Object.prototype.hasOwnProperty.call(message.settings, 'webNonce') && message.settings.webNonce !== message.nonce) return authError();
        try {
          respond(configure({ ...(message.settings || {}), webNonce: message.nonce }));
        } catch (error) {
          respond({ ok: false, error: error.message });
        }
        return false;
      }
      if (!WEB_NONCE_RE.test(webNonce) || message.nonce !== webNonce) return authError();
      if (message.type === 'WEB_SUBTITLE_STATUS') {
        respond(status());
        return false;
      }
      if (message.type === 'WEB_SUBTITLE_STOP') {
        respond(stop());
        return false;
      }
      return false;
    });
  }
})();
