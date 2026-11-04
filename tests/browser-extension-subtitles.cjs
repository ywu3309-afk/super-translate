'use strict';

// Isolated Chromium tests for the generic-page subtitle adapter. All pages,
// cues and translation responses are synthetic and local; no production
// account, credential, media, or translation endpoint is used.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

process.env.PLAYWRIGHT_BROWSERS_PATH = process.env.PLAYWRIGHT_BROWSERS_PATH || 'D:\\SuperTranslate\\BrowserTesting';
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const outputRoot = path.join(root, 'outputs', 'browser-extension');
const subtitleScript = path.join(root, 'browser-extension', 'web-subtitles.js');
const subtitleCss = path.join(root, 'browser-extension', 'web.css');
const VALID_NONCE = 'subtitle_fixture_nonce_1234567890';
const OTHER_NONCE = 'subtitle_other_nonce_0987654321';
const checks = [];
const pageErrors = [];
fs.mkdirSync(outputRoot, { recursive: true });

function check(name, condition = true) {
  assert.ok(condition, name);
  checks.push(name);
  console.log(`PASS ${name}`);
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function pageHtml(body = '') {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    body { margin: 20px; font: 16px sans-serif; }
    .player { position: relative; width: 480px; height: 260px; margin: 0 0 35px; }
    video { display: block; width: 480px; height: 260px; background: #111; }
    .captions-text, .ytp-caption-window-container {
      position: absolute; z-index: 2; left: 40px; right: 40px; bottom: 18px;
      min-height: 28px; color: #fff; text-align: center;
    }
  </style></head><body>${body}</body></html>`;
}

async function installRuntimeFixture(page) {
  await page.evaluate(extensionId => {
    const listeners = [];
    const requests = [];
    const behavior = new Map();
    const media = {
      play: 0,
      pause: 0,
      captureStream: 0,
      getUserMedia: 0,
      audioContext: 0,
      fetch: 0,
      xhr: 0
    };

    globalThis.__subtitleFixture = {
      extensionId,
      listeners,
      requests,
      behavior,
      media,
      setBehavior(text, patch) {
        behavior.set(String(text), { ...(patch || {}) });
      },
      async invoke(message, senderId = extensionId) {
        for (const listener of listeners) {
          let responded = false;
          let response;
          listener(message, { id: senderId }, value => {
            responded = true;
            response = value;
          });
          if (responded) return { responded, response };
        }
        return { responded: false };
      }
    };

    Object.defineProperty(globalThis, 'chrome', {
      configurable: true,
      value: {
        runtime: {
          id: extensionId,
          onMessage: {
            addListener(listener) { listeners.push(listener); }
          },
          sendMessage(message) {
            requests.push(JSON.parse(JSON.stringify(message)));
            const rule = behavior.get(String(message.text || '')) || {};
            return new Promise((resolve, reject) => {
              setTimeout(() => {
                if (rule.reject) {
                  reject(new Error(String(rule.error || 'Synthetic translation failure')));
                  return;
                }
                resolve({
                  ok: rule.ok !== false,
                  jobId: rule.wrongJobId ? 'wrong-job-id' : message.jobId,
                  translation: Object.prototype.hasOwnProperty.call(rule, 'translation')
                    ? rule.translation
                    : `T:${message.text}`,
                  error: rule.error
                });
              }, Number(rule.delay || 0));
            });
          }
        }
      }
    });

    const originalFetch = globalThis.fetch;
    globalThis.fetch = (...args) => {
      media.fetch++;
      return originalFetch(...args);
    };
    const originalOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (...args) {
      media.xhr++;
      return originalOpen.apply(this, args);
    };
    if (!navigator.mediaDevices) {
      Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: {} });
    }
    navigator.mediaDevices.getUserMedia = () => {
      media.getUserMedia++;
      return Promise.reject(new Error('Synthetic getUserMedia block'));
    };
    Object.defineProperty(globalThis, 'AudioContext', {
      configurable: true,
      writable: true,
      value: function SyntheticAudioContext() {
        media.audioContext++;
        throw new Error('Subtitle adapter must not create AudioContext');
      }
    });
    Object.defineProperty(globalThis, 'webkitAudioContext', {
      configurable: true,
      writable: true,
      value: globalThis.AudioContext
    });
  }, 'fixture-extension-id');
}

async function installAdapter(page) {
  await page.addStyleTag({ path: subtitleCss });
  await page.addScriptTag({ path: subtitleScript });
}

async function makePage(context, origin, body, options = {}) {
  const page = await context.newPage();
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.goto(`${origin}/fixture`);
  if (body !== undefined) await page.setContent(pageHtml(body));
  await installRuntimeFixture(page);
  if (options.removeBody) await page.evaluate(() => document.body.remove());
  await installAdapter(page);
  return page;
}

async function installTrack(page, videoSelector, initialCue, id = 'track', mode = 'disabled') {
  await page.evaluate(({ videoSelector, initialCue, id, mode }) => {
    const video = document.querySelector(videoSelector);
    if (!(video instanceof HTMLVideoElement)) throw new Error(`Missing video: ${videoSelector}`);
    const track = new EventTarget();
    const state = { cues: initialCue ? [initialCue] : [] };
    Object.defineProperties(track, {
      kind: { value: 'subtitles' },
      language: { value: 'en' },
      mode: { value: mode, writable: true },
      activeCues: { get: () => state.cues }
    });
    Object.defineProperty(video, 'textTracks', {
      configurable: true,
      value: { 0: track, length: 1 }
    });
    globalThis.__fixtureTracks ||= {};
    globalThis.__fixtureTracks[id] = { track, state };
  }, { videoSelector, initialCue, id, mode });
}

async function setCue(page, id, cue) {
  await page.evaluate(({ id, cue }) => {
    const entry = globalThis.__fixtureTracks[id];
    entry.state.cues = cue ? [cue] : [];
    entry.track.dispatchEvent(new Event('cuechange'));
  }, { id, cue });
}

async function configureDirect(page, patch = {}) {
  return page.evaluate(({ nonce, patch }) => globalThis.STWebSubtitles.configure({
    enabled: true,
    target: 'zh-CN',
    mode: 'bilingual',
    webNonce: nonce,
    ...patch
  }), { nonce: VALID_NONCE, patch });
}

async function requestTexts(page) {
  return page.evaluate(() => globalThis.__subtitleFixture.requests.map(item => item.text));
}

(async () => {
  let browser;
  let server;
  try {
    server = http.createServer((_request, response) => {
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      response.end(pageHtml());
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const origin = `http://127.0.0.1:${server.address().port}`;
    browser = await chromium.launch({ channel: 'chromium', headless: true });
    const context = await browser.newContext({ viewport: { width: 1100, height: 900 } });

    // HTML5 TextTrack: contract, bilingual/replace, deduplication, visibility,
    // and an explicit proof that the adapter never controls or captures media.
    {
      const page = await makePage(context, origin, '<div class="player"><video id="track-video"></video></div>');
      await page.evaluate(() => {
        const video = document.querySelector('#track-video');
        const media = globalThis.__subtitleFixture.media;
        video.play = () => { media.play++; throw new Error('play must not be called'); };
        video.pause = () => { media.pause++; throw new Error('pause must not be called'); };
        video.captureStream = () => { media.captureStream++; throw new Error('captureStream must not be called'); };
        video.volume = .61;
        video.playbackRate = 1.25;
        video.muted = true;
        globalThis.__mediaBefore = {
          currentTime: video.currentTime,
          volume: video.volume,
          playbackRate: video.playbackRate,
          muted: video.muted
        };
      });
      await installTrack(page, '#track-video', { text: 'Synthetic caption', startTime: 0, endTime: 2 });
      await configureDirect(page);
      await page.waitForFunction(() => document.querySelector('.st-web-subtitle-overlay')?.textContent.includes('T:Synthetic caption'));

      const firstRequest = await page.evaluate(() => globalThis.__subtitleFixture.requests[0]);
      check('TextTrack cue uses the narrow subtitle request contract',
        firstRequest.type === 'WEB_TRANSLATE_TEXT' && firstRequest.version === 1 && firstRequest.scope === 'subtitle');
      check('TextTrack cue carries only the current target and capability nonce',
        firstRequest.target === 'zh-CN' && firstRequest.webNonce === VALID_NONCE && firstRequest.text === 'Synthetic caption');
      check('bilingual mode renders original cue and synthetic translation', await page.evaluate(() => {
        const overlay = document.querySelector('.st-web-subtitle-overlay');
        return overlay.querySelector('.st-web-subtitle-original')?.textContent === 'Synthetic caption' &&
          overlay.querySelector('.st-web-subtitle-translation')?.textContent === 'T:Synthetic caption';
      }));
      const geometry = await page.evaluate(() => {
        const video = document.querySelector('#track-video').getBoundingClientRect();
        const overlay = document.querySelector('.st-web-subtitle-overlay').getBoundingClientRect();
        return { video: { left: video.left, right: video.right, top: video.top, bottom: video.bottom, width: video.width }, overlay: { left: overlay.left, right: overlay.right, top: overlay.top, bottom: overlay.bottom, width: overlay.width }, inlineStyle: document.querySelector('.st-web-subtitle-overlay').getAttribute('style') };
      });
      check('subtitle overlay geometry stays inside and aligned to its video',
        geometry.overlay.left >= geometry.video.left - 1 && geometry.overlay.right <= geometry.video.right + 1 &&
        geometry.overlay.top >= geometry.video.top && geometry.overlay.top < geometry.video.bottom && Math.abs(geometry.overlay.width - geometry.video.width) <= 2);
      await page.screenshot({
        path: path.join(outputRoot, 'extension-web-subtitles-texttrack.png'),
        fullPage: true
      });

      await setCue(page, 'track', { text: 'Synthetic caption', startTime: 0, endTime: 2 });
      await page.evaluate(() => {
        const entry = globalThis.__fixtureTracks.track;
        entry.track.dispatchEvent(new Event('cuechange'));
        document.querySelector('#track-video').dispatchEvent(new Event('timeupdate'));
      });
      await sleep(380);
      check('duplicate cue events issue exactly one translation request',
        (await requestTexts(page)).filter(text => text === 'Synthetic caption').length === 1);

      await page.evaluate(() => {
        globalThis.__subtitleFixture.setBehavior('Collision cue AaAaAa', { translation: 'FIRST DISTINCT TRANSLATION' });
        globalThis.__subtitleFixture.setBehavior('Collision cue BBBBBB', { translation: 'SECOND DISTINCT TRANSLATION' });
      });
      await setCue(page, 'track', { text: 'Collision cue AaAaAa', startTime: 1, endTime: 2 });
      await page.waitForFunction(() => document.querySelector('.st-web-subtitle-overlay')?.textContent.includes('FIRST DISTINCT TRANSLATION'));
      await setCue(page, 'track', { text: 'Collision cue BBBBBB', startTime: 2, endTime: 3 });
      await page.waitForFunction(() => document.querySelector('.st-web-subtitle-overlay')?.textContent.includes('SECOND DISTINCT TRANSLATION'));
      check('different same-length cues cannot reuse another cue cache entry', await page.evaluate(() => {
        const requests = globalThis.__subtitleFixture.requests;
        const text = document.querySelector('.st-web-subtitle-overlay')?.textContent || '';
        return requests.filter(item => item.text === 'Collision cue AaAaAa').length === 1 &&
          requests.filter(item => item.text === 'Collision cue BBBBBB').length === 1 &&
          text.includes('SECOND DISTINCT TRANSLATION') && !text.includes('FIRST DISTINCT TRANSLATION');
      }));

      await setCue(page, 'track', { text: 'Synthetic caption', startTime: 0, endTime: 2 });
      await page.waitForFunction(() => document.querySelector('.st-web-subtitle-overlay')?.textContent.includes('T:Synthetic caption'));

      const replaceResponse = await page.evaluate(nonce => globalThis.__subtitleFixture.invoke({
        type: 'WEB_SUBTITLE_CONFIGURE', version: 1, nonce,
        settings: { enabled: true, target: 'zh-CN', mode: 'replace', webNonce: nonce }
      }), VALID_NONCE);
      check('current nonce can switch subtitle display mode', replaceResponse.response?.ok === true);
      await page.waitForFunction(() => {
        const overlay = document.querySelector('.st-web-subtitle-overlay');
        return overlay && !overlay.querySelector('.st-web-subtitle-original') && overlay.textContent === 'T:Synthetic caption';
      });
      check('replace mode reuses the cached result without another cloud request',
        (await requestTexts(page)).filter(text => text === 'Synthetic caption').length === 1);

      await setCue(page, 'track', null);
      await page.waitForFunction(() => {
        const overlay = document.querySelector('.st-web-subtitle-overlay');
        return overlay?.hidden === true && getComputedStyle(overlay).display === 'none';
      });
      check('an absent cue is hidden despite the overlay important display rule');

      await setCue(page, 'track', { text: 'Visible again', startTime: 2, endTime: 4 });
      await page.waitForFunction(() => document.querySelector('.st-web-subtitle-overlay')?.textContent.includes('T:Visible again'));
      await page.evaluate(() => { document.querySelector('#track-video').style.display = 'none'; });
      await page.waitForFunction(() => {
        const overlay = document.querySelector('.st-web-subtitle-overlay');
        return overlay?.hidden === true && getComputedStyle(overlay).display === 'none';
      });
      check('a hidden or off-screen video hides its overlay in computed style');

      const mediaResult = await page.evaluate(() => {
        const video = document.querySelector('#track-video');
        const track = globalThis.__fixtureTracks.track.track;
        return {
          probe: globalThis.__subtitleFixture.media,
          before: globalThis.__mediaBefore,
          after: {
            currentTime: video.currentTime,
            volume: video.volume,
            playbackRate: video.playbackRate,
            muted: video.muted
          },
          trackMode: track.mode
        };
      });
      check('subtitle observation never calls play, pause, captureStream, getUserMedia, AudioContext, fetch or XHR',
        ['play', 'pause', 'captureStream', 'getUserMedia', 'audioContext', 'fetch', 'xhr']
          .every(name => mediaResult.probe[name] === 0));
      check('subtitle observation does not mutate playback properties or TextTrack mode',
        JSON.stringify(mediaResult.before) === JSON.stringify(mediaResult.after) && mediaResult.trackMode === 'disabled');
      await page.close();
    }

    // A TextTrack in `showing` mode is already painted by the browser. In
    // bilingual mode the overlay must add only the translation; replace mode
    // temporarily suppresses the browser cue with a reversible CSS class.
    {
      const page = await makePage(context, origin, '<div class="player"><video id="showing-track-video"></video></div>');
      await installTrack(
        page,
        '#showing-track-video',
        { text: 'Browser visible cue', startTime: 0, endTime: 2 },
        'showing-track',
        'showing'
      );
      await configureDirect(page);
      await page.waitForFunction(() => document.querySelector('.st-web-subtitle-overlay')?.textContent === 'T:Browser visible cue');
      check('bilingual mode reuses a browser-rendered TextTrack original instead of duplicating it', await page.evaluate(() => {
        const overlay = document.querySelector('.st-web-subtitle-overlay');
        const video = document.querySelector('#showing-track-video');
        return overlay?.querySelector('.st-web-subtitle-original') === null &&
          overlay?.querySelector('.st-web-subtitle-translation')?.textContent === 'T:Browser visible cue' &&
          !video.classList.contains('st-web-subtitle-native-cues-hidden');
      }));

      await page.evaluate(() => globalThis.STWebSubtitles.setMode('replace'));
      check('replace mode shows only the translation and suppresses a visible native TextTrack cue', await page.evaluate(() => {
        const overlay = document.querySelector('.st-web-subtitle-overlay');
        return overlay?.querySelector('.st-web-subtitle-original') === null &&
          overlay?.textContent === 'T:Browser visible cue' &&
          document.querySelector('#showing-track-video').classList.contains('st-web-subtitle-native-cues-hidden');
      }));
      check('TextTrack mode changes reuse the cached translation without another request',
        (await requestTexts(page)).filter(text => text === 'Browser visible cue').length === 1);

      await page.evaluate(() => globalThis.__subtitleFixture.setBehavior('Visible failing cue', {
        reject: true,
        error: 'VISIBLE CUE ERROR'
      }));
      await setCue(page, 'showing-track', { text: 'Visible failing cue', startTime: 2, endTime: 4 });
      await page.waitForFunction(() => document.querySelector('.st-web-subtitle-overlay')?.textContent === 'VISIBLE CUE ERROR');
      await sleep(350);
      check('replace mode keeps the native cue visible when its translation fails', await page.evaluate(() => (
        !document.querySelector('#showing-track-video').classList.contains('st-web-subtitle-native-cues-hidden')
      )));

      await page.evaluate(() => globalThis.STWebSubtitles.stop());
      check('stopping subtitle translation restores native TextTrack presentation', await page.evaluate(() => (
        !document.querySelector('#showing-track-video').classList.contains('st-web-subtitle-native-cues-hidden') &&
        document.querySelectorAll('.st-web-subtitle-overlay').length === 0
      )));
      await page.close();
    }

    // Per-video request sequencing: a slow old success or failure must not
    // overwrite the newest visible cue.
    {
      const page = await makePage(context, origin, '<div class="player"><video id="race-video"></video></div>');
      await installTrack(page, '#race-video', { text: 'Old cue', startTime: 0, endTime: 1 }, 'race');
      await page.evaluate(() => {
        globalThis.__subtitleFixture.setBehavior('Old cue', { delay: 160, translation: 'OLD TRANSLATED' });
        globalThis.__subtitleFixture.setBehavior('New cue', { delay: 10, translation: 'NEW TRANSLATED' });
      });
      await configureDirect(page);
      await page.waitForFunction(() => globalThis.__subtitleFixture.requests.some(item => item.text === 'Old cue'));
      await setCue(page, 'race', { text: 'New cue', startTime: 1, endTime: 2 });
      await page.waitForFunction(() => document.querySelector('.st-web-subtitle-overlay')?.textContent.includes('NEW TRANSLATED'));
      await sleep(210);
      check('slow old cue success cannot overwrite a newer cue', await page.evaluate(() => {
        const text = document.querySelector('.st-web-subtitle-overlay')?.textContent || '';
        return text.includes('New cue') && text.includes('NEW TRANSLATED') && !text.includes('OLD TRANSLATED');
      }));

      await page.evaluate(() => {
        globalThis.__subtitleFixture.setBehavior('Old failing cue', { delay: 160, reject: true, error: 'OLD ERROR' });
        globalThis.__subtitleFixture.setBehavior('Newest cue', { delay: 10, translation: 'NEWEST TRANSLATED' });
      });
      await setCue(page, 'race', { text: 'Old failing cue', startTime: 2, endTime: 3 });
      await page.waitForFunction(() => globalThis.__subtitleFixture.requests.some(item => item.text === 'Old failing cue'));
      await setCue(page, 'race', { text: 'Newest cue', startTime: 3, endTime: 4 });
      await page.waitForFunction(() => document.querySelector('.st-web-subtitle-overlay')?.textContent.includes('NEWEST TRANSLATED'));
      await sleep(210);
      check('slow old cue failure cannot replace a newer successful subtitle with an error', await page.evaluate(() => {
        const text = document.querySelector('.st-web-subtitle-overlay')?.textContent || '';
        return text.includes('Newest cue') && text.includes('NEWEST TRANSLATED') && !text.includes('OLD ERROR');
      }));
      await page.close();
    }

    // A request that resolves after stop must never recreate an overlay.
    {
      const page = await makePage(context, origin, '<div class="player"><video id="late-video"></video></div>');
      await installTrack(page, '#late-video', { text: 'Late response cue', startTime: 0, endTime: 1 }, 'late');
      await page.evaluate(() => globalThis.__subtitleFixture.setBehavior('Late response cue', {
        delay: 170,
        translation: 'LATE TRANSLATION'
      }));
      await configureDirect(page);
      await page.waitForFunction(() => globalThis.__subtitleFixture.requests.some(item => item.text === 'Late response cue'));
      await page.evaluate(() => {
        globalThis.__lateOverlayInsertions = 0;
        globalThis.__lateAudit = new MutationObserver(records => {
          for (const record of records) {
            for (const node of record.addedNodes) {
              if (node instanceof Element && (node.matches('.st-web-subtitle-overlay') || node.querySelector('.st-web-subtitle-overlay'))) {
                globalThis.__lateOverlayInsertions++;
              }
            }
          }
        });
        globalThis.__lateAudit.observe(document, { childList: true, subtree: true });
        globalThis.STWebSubtitles.stop();
      });
      await sleep(250);
      check('stop rejects late subtitle results without recreating or writing an overlay', await page.evaluate(() => {
        globalThis.__lateAudit.disconnect();
        return globalThis.STWebSubtitles.status().enabled === false &&
          document.querySelectorAll('.st-web-subtitle-overlay').length === 0 &&
          globalThis.__lateOverlayInsertions === 0 &&
          !document.documentElement.textContent.includes('LATE TRANSLATION');
      }));
      await page.close();
    }

    // Runtime control messages are bound to the first valid capability nonce.
    {
      const page = await makePage(context, origin, '');
      const invalidResults = await page.evaluate(async ({ valid, other }) => {
        const invoke = globalThis.__subtitleFixture.invoke;
        return {
          missing: await invoke({ type: 'WEB_SUBTITLE_CONFIGURE', version: 1, settings: { enabled: true } }),
          short: await invoke({ type: 'WEB_SUBTITLE_CONFIGURE', version: 1, nonce: 'short', settings: { enabled: true } }),
          initialStatus: await invoke({ type: 'WEB_SUBTITLE_STATUS', version: 1, nonce: other }),
          valid: await invoke({
            type: 'WEB_SUBTITLE_CONFIGURE', version: 1, nonce: valid,
            settings: { enabled: true, target: 'de', mode: 'bilingual', webNonce: valid }
          })
        };
      }, { valid: VALID_NONCE, other: OTHER_NONCE });
      check('missing, malformed and pre-bind status nonces are rejected',
        invalidResults.missing.response?.ok === false && invalidResults.short.response?.ok === false && invalidResults.initialStatus.response?.ok === false);
      check('the first valid configure message binds and starts the subtitle capability',
        invalidResults.valid.response?.ok === true && invalidResults.valid.response?.enabled === true && invalidResults.valid.response?.target === 'de');

      const wrongNonce = await page.evaluate(async other => {
        const before = globalThis.STWebSubtitles.status();
        const requestsBefore = globalThis.__subtitleFixture.requests.length;
        const configure = await globalThis.__subtitleFixture.invoke({
          type: 'WEB_SUBTITLE_CONFIGURE', version: 1, nonce: other,
          settings: { enabled: false, target: 'fr', mode: 'replace', webNonce: other }
        });
        const status = await globalThis.__subtitleFixture.invoke({ type: 'WEB_SUBTITLE_STATUS', version: 1, nonce: other });
        const stop = await globalThis.__subtitleFixture.invoke({ type: 'WEB_SUBTITLE_STOP', version: 1, nonce: other });
        return { before, after: globalThis.STWebSubtitles.status(), requestsBefore, requestsAfter: globalThis.__subtitleFixture.requests.length, configure, status, stop };
      }, OTHER_NONCE);
      check('a different valid-looking or old nonce cannot reconfigure, inspect or stop the active session',
        wrongNonce.configure.response?.ok === false && wrongNonce.status.response?.ok === false && wrongNonce.stop.response?.ok === false &&
        wrongNonce.after.enabled === true && wrongNonce.after.target === wrongNonce.before.target && wrongNonce.after.mode === wrongNonce.before.mode &&
        wrongNonce.requestsAfter === wrongNonce.requestsBefore);

      const wrongSender = await page.evaluate(async nonce => {
        const before = globalThis.STWebSubtitles.status();
        const result = await globalThis.__subtitleFixture.invoke({ type: 'WEB_SUBTITLE_STOP', version: 1, nonce }, 'different-extension-id');
        return { before, after: globalThis.STWebSubtitles.status(), result };
      }, VALID_NONCE);
      check('a runtime sender with another extension id has no subtitle-control side effect',
        wrongSender.result.responded === false && wrongSender.before.enabled === wrongSender.after.enabled);

      const correct = await page.evaluate(async nonce => ({
        status: await globalThis.__subtitleFixture.invoke({ type: 'WEB_SUBTITLE_STATUS', version: 1, nonce }),
        stop: await globalThis.__subtitleFixture.invoke({ type: 'WEB_SUBTITLE_STOP', version: 1, nonce })
      }), VALID_NONCE);
      check('the current nonce can read status and stop subtitles',
        correct.status.response?.ok === true && correct.status.response?.enabled === true && correct.stop.response?.enabled === false);
      await page.close();
    }

    // Starting before body exists must be safe; stopping first must prevent a
    // late body/DOM insertion from reviving the adapter.
    {
      const page = await makePage(context, origin, undefined, { removeBody: true });
      const early = await configureDirect(page);
      check('subtitle startup succeeds while document.body is absent', early.enabled === true);
      await page.evaluate(() => {
        const body = document.createElement('body');
        body.innerHTML = '<div class="player"><video></video><div class="captions-text">Late body caption</div></div>';
        document.documentElement.append(body);
      });
      await page.waitForFunction(() => document.querySelector('.st-web-subtitle-overlay')?.textContent.includes('T:Late body caption'));
      check('a body inserted later is observed and translated once',
        (await requestTexts(page)).filter(text => text === 'Late body caption').length === 1);
      await page.close();

      const stoppedPage = await makePage(context, origin, undefined, { removeBody: true });
      await configureDirect(stoppedPage);
      await stoppedPage.evaluate(() => globalThis.STWebSubtitles.stop());
      await stoppedPage.evaluate(() => {
        const body = document.createElement('body');
        body.innerHTML = '<div class="player"><video></video><div class="captions-text">Must stay stopped</div></div>';
        document.documentElement.append(body);
      });
      await sleep(450);
      check('stop-before-body prevents later DOM insertion from reviving subtitles', await stoppedPage.evaluate(() => (
        globalThis.STWebSubtitles.status().enabled === false &&
        globalThis.__subtitleFixture.requests.length === 0 &&
        document.querySelectorAll('.st-web-subtitle-overlay').length === 0
      )));
      await stoppedPage.close();
    }

    // DOM fallback is restricted to explicit captions associated with one
    // player. Ordinary UI labels must never be uploaded.
    {
      const body = `
        <div class="subtitle">Account subtitle setting</div>
        <div aria-live="polite" class="caption-status">Image caption saved</div>
        <div class="player" id="player-a"><video id="video-a"></video><div class="captions-text">Caption A</div></div>
        <div class="player" id="player-b"><video id="video-b"></video><div class="captions-text">Caption B</div></div>`;
      const page = await makePage(context, origin, body);
      await configureDirect(page);
      await page.waitForFunction(() => document.querySelectorAll('.st-web-subtitle-overlay:not([hidden])').length === 2);
      const initial = await page.evaluate(() => ({
        overlays: [...document.querySelectorAll('.st-web-subtitle-overlay')].map(node => node.textContent),
        texts: globalThis.__subtitleFixture.requests.map(item => item.text)
      }));
      check('two players receive only their own DOM caption',
        initial.overlays.length === 2 && initial.overlays.some(text => text.includes('Caption A') && !text.includes('Caption B')) &&
        initial.overlays.some(text => text.includes('Caption B') && !text.includes('Caption A')));
      check('one DOM caption node is never copied to both videos',
        initial.overlays.filter(text => text.includes('Caption A')).length === 1 && initial.overlays.filter(text => text.includes('Caption B')).length === 1);
      check('ordinary subtitle and caption-status UI are never sent for translation',
        !initial.texts.includes('Account subtitle setting') && !initial.texts.includes('Image caption saved') &&
        initial.texts.includes('Caption A') && initial.texts.includes('Caption B'));
      check('bilingual DOM subtitles reuse each visible page caption and add only one translated line', await page.evaluate(() => (
        [...document.querySelectorAll('.player')].every(player => {
          const caption = player.querySelector('.captions-text');
          const video = player.querySelector('video');
          const overlay = [...document.querySelectorAll('.st-web-subtitle-overlay')].find(node => {
            const rect = node.getBoundingClientRect();
            const videoRect = video.getBoundingClientRect();
            return rect.left >= videoRect.left - 1 && rect.right <= videoRect.right + 1 &&
              rect.top >= videoRect.top && rect.top < videoRect.bottom;
          });
          return caption && getComputedStyle(caption).opacity !== '0' &&
            overlay?.querySelector('.st-web-subtitle-original') === null &&
            overlay?.querySelectorAll('.st-web-subtitle-translation').length === 1;
        })
      )));
      check('translated DOM subtitle lines are positioned above, not on top of, native captions', await page.evaluate(() => (
        [...document.querySelectorAll('.player')].every(player => {
          const videoRect = player.querySelector('video').getBoundingClientRect();
          const captionRect = player.querySelector('.captions-text').getBoundingClientRect();
          const overlay = [...document.querySelectorAll('.st-web-subtitle-overlay')].find(node => {
            const rect = node.getBoundingClientRect();
            return rect.left >= videoRect.left - 1 && rect.right <= videoRect.right + 1 &&
              rect.top >= videoRect.top && rect.top < videoRect.bottom;
          });
          const overlayRect = overlay?.getBoundingClientRect();
          return overlayRect && overlayRect.bottom <= captionRect.top - 4;
        })
      )));
      await page.screenshot({
        path: path.join(outputRoot, 'extension-web-subtitles-multiplayer.png'),
        fullPage: true
      });

      await page.evaluate(() => globalThis.STWebSubtitles.setMode('replace'));
      check('replace mode hides DOM originals while keeping exactly one translated subtitle line', await page.evaluate(() => (
        [...document.querySelectorAll('.player')].every(player => {
          const caption = player.querySelector('.captions-text');
          const expected = `T:${caption.textContent.trim()}`;
          const videoRect = player.querySelector('video').getBoundingClientRect();
          const overlay = [...document.querySelectorAll('.st-web-subtitle-overlay')].find(node => {
            const rect = node.getBoundingClientRect();
            return rect.left >= videoRect.left - 1 && rect.right <= videoRect.right + 1 &&
              rect.top >= videoRect.top && rect.top < videoRect.bottom;
          });
          return caption.classList.contains('st-web-subtitle-source-hidden') &&
            getComputedStyle(caption).opacity === '0' && overlay?.textContent === expected &&
            overlay.querySelector('.st-web-subtitle-original') === null;
        })
      )));
      await page.evaluate(() => globalThis.STWebSubtitles.setMode('bilingual'));
      check('returning to bilingual mode restores DOM originals without another cloud request', await page.evaluate(() => (
        [...document.querySelectorAll('.captions-text')].every(node =>
          !node.classList.contains('st-web-subtitle-source-hidden') && getComputedStyle(node).opacity !== '0'
        ) && globalThis.__subtitleFixture.requests.filter(item => /^Caption [AB]$/.test(item.text)).length === 2
      )));

      await page.evaluate(() => document.querySelector('#video-a').remove());
      await page.waitForFunction(() => globalThis.STWebSubtitles.status().videos === 1 && document.querySelectorAll('.st-web-subtitle-overlay').length === 1);
      check('removing a video removes its overlay and listener state');
      await page.evaluate(() => {
        const video = document.createElement('video');
        video.id = 'replacement-a';
        document.querySelector('#player-a').prepend(video);
      });
      await page.waitForFunction(() => globalThis.STWebSubtitles.status().videos === 2 &&
        [...document.querySelectorAll('.st-web-subtitle-overlay')].some(node => node.textContent.includes('Caption A')));
      check('a replacement video can reclaim the released caption node');
      await page.close();
    }

    // Generic subtitle code is a strict no-op on WhatsApp, which keeps the
    // dedicated WhatsApp translator isolated.
    {
      const page = await context.newPage();
      page.on('pageerror', error => pageErrors.push(error.message));
      await page.route('https://web.whatsapp.com/**', route => route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: pageHtml('<div class="player"><video></video><div class="captions-text">WhatsApp fixture caption</div></div>')
      }));
      await page.goto('https://web.whatsapp.com/');
      await installRuntimeFixture(page);
      await installAdapter(page);
      const result = await page.evaluate(nonce => {
        const beforeListeners = globalThis.__subtitleFixture.listeners.length;
        globalThis.STWebSubtitles.start();
        globalThis.STWebSubtitles.configure({ enabled: true, target: 'fr', webNonce: nonce });
        return {
          eligible: globalThis.STWebSubtitles.eligible,
          status: globalThis.STWebSubtitles.status(),
          overlays: document.querySelectorAll('.st-web-subtitle-overlay').length,
          requests: globalThis.__subtitleFixture.requests.length,
          listeners: globalThis.__subtitleFixture.listeners.length - beforeListeners
        };
      }, VALID_NONCE);
      check('WhatsApp remains isolated from the generic subtitle adapter',
        result.eligible === false && result.status.enabled === false && result.overlays === 0 && result.requests === 0 && result.listeners === 0);
      await page.close();
    }

    check('all subtitle fixtures complete without page JavaScript errors', pageErrors.length === 0);
    const report = {
      ok: true,
      at: new Date().toISOString(),
      checks,
      checkCount: checks.length,
      pageErrors,
      scope: 'Local synthetic pages, cues, media probes, and translation responses only.',
      productionRequests: 0,
      screenshots: [
        path.join(outputRoot, 'extension-web-subtitles-texttrack.png'),
        path.join(outputRoot, 'extension-web-subtitles-multiplayer.png')
      ]
    };
    fs.writeFileSync(
      path.join(outputRoot, 'subtitle-verification.json'),
      JSON.stringify(report, null, 2)
    );
    await context.close();
    console.log(JSON.stringify({ ...report, checks: report.checkCount }, null, 2));
  } finally {
    if (browser) await browser.close();
    if (server) await new Promise(resolve => server.close(resolve));
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
