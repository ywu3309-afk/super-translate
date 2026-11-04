'use strict';

const { contextBridge } = require('electron');
// Test-only preload: expose the compatibility bridge, then load the original
// Telegram adapter. It is loaded in an isolated pilot window only when
// ST_TELEGRAM_PILOT=1; production Telegram keeps the existing preload.
require('./scrm-bridge-preload');
require('./adapters/telegram-preload.js');
try { contextBridge.exposeInMainWorld('__scrm_pilot_loaded', true); } catch {}
