(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const windowElement = $('login-window');
  const form = $('login-form');
  const account = $('account');
  const password = $('password');
  const rememberLogin = $('remember-login');
  const autoLogin = $('auto-login');
  const clearSavedLogin = $('clear-saved-login');
  const savedAccountToggle = $('saved-account-toggle');
  const savedAccountMenu = $('saved-account-menu');
  const registerDialog = $('register-dialog');
  const registerForm = $('register-form');
  const registerAccount = $('register-account');
  const registerPassword = $('register-password');
  const registerConfirm = $('register-confirm');
  let maximized = false;
  let language = 'zh-CN';
  let loginBusy = false;
  let toastTimer;
  let savedAccounts = [];
  let selectedSavedId = null;

  const text = {
    'zh-CN': {
      welcome:'欢迎您！登录超级翻译', login:'登录', register:'创建免费账户', contact:'联系我们',
      account:'账号', password:'密码', agreement:'点击登录表明您接受以下', privacy:'隐私条款',
      platforms:'我们已经支持下列的软件', demo:'云端管理员/客户自动识别 · 支持跨设备登录', understood:'知道了',
      show:'显示密码', hide:'隐藏密码', remember:'记住密码', autoLogin:'自动登录', clearSaved:'删除当前保存账号',
      missingAccount:'请先输入账号。', missingPassword:'请先输入密码。', signingIn:'正在登录…',
      autoSigningIn:'正在自动登录…', autoFailed:'自动登录失败，已关闭自动登录，请点击“登录”重试。',
      secureUnavailable:'当前系统安全存储不可用，无法安全记住密码。', cleared:'已清除保存的登录信息。',
      restore:'超级翻译 · 恢复窗口', success:'表单验证通过。'
    },
    en: {
      welcome:'Welcome! Sign in to Super Translate', login:'Sign in', register:'Create an account', contact:'Contact us',
      account:'Account', password:'Password', agreement:'By signing in, you agree to our', privacy:'Privacy policy',
      platforms:'Connect with your favorite platforms', demo:'Cloud admin/customer sign-in · works across devices', understood:'Got it',
      show:'Show password', hide:'Hide password', remember:'Remember password', autoLogin:'Sign in automatically', clearSaved:'Remove selected account',
      missingAccount:'Please enter your account.', missingPassword:'Please enter your password.', signingIn:'Signing in…',
      autoSigningIn:'Signing in automatically…', autoFailed:'Automatic sign-in failed and was disabled. Click “Sign in” to retry.',
      secureUnavailable:'Secure OS storage is unavailable, so the password cannot be remembered safely.', cleared:'Saved sign-in information cleared.',
      restore:'Super Translate · Restore window', success:'Form validation passed.'
    }
  };
  const t = key => text[language][key] ?? text['zh-CN'][key] ?? key;
  const cleanIpcError = error => String(error?.message || error || '操作失败。')
    .replace(/^Error invoking remote method[^:]+:\s*(?:Error:\s*)?/, '')
    .replace(/^[^']*'\s*:\s*Error:\s*/, '')
    .slice(0, 180);

  // SVG symbols are packaged locally. No external scripts, tracking or image requests.
  for (const p of (window.PLATFORM_ICONS || [])) {
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'platform-icon ' + p.slug;
    button.setAttribute('aria-label', p.name + ' · 平台图标演示');
    const circle = document.createElement('span'); circle.className = 'platform-circle'; circle.style.setProperty('--brand', '#' + p.color);
    circle.innerHTML = p.svg; // Trusted, checked-in SVG constants only. No user HTML.
    const tooltip = document.createElement('span'); tooltip.className = 'platform-tooltip'; tooltip.textContent = p.name;
    button.append(circle, tooltip);
    button.addEventListener('click', () => showToast(language === 'en' ? `${p.name}: visual preview, no connection is made.` : `${p.name}：仅展示平台图标，未建立连接。`));
    $('platforms').append(button);
  }

  function resize() {
    const embedded = !!window.desktopControls;
    const margin = embedded ? 0 : 32;
    const scale = Math.max(.2, Math.min((innerWidth - margin) / 880, (innerHeight - margin) / 560, maximized ? 1.5 : 1));
    windowElement.style.transform = `translate(-50%, -50%) scale(${scale})`;
    document.body.classList.toggle('electron-window', embedded);
  }
  window.addEventListener('resize', resize); resize();
  function showToast(message) { $('toast').textContent = message; $('toast').hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { $('toast').hidden = true; }, 3000); }
  function dialog(title, content) { $('dialog-title').textContent = title; $('dialog-content').textContent = content; $('info-dialog').showModal(); }
  function closeDialog() { $('info-dialog').close(); }
  $('close-dialog').addEventListener('click', closeDialog); $('confirm-dialog').addEventListener('click', closeDialog);
  $('info-dialog').addEventListener('click', e => { if (e.target === $('info-dialog')) { const r = e.target.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) closeDialog(); } });

  $('toggle-password').addEventListener('click', () => {
    const visible = password.type === 'password'; password.type = visible ? 'text' : 'password';
    $('toggle-password').setAttribute('aria-pressed', String(visible)); $('toggle-password').setAttribute('aria-label', t(visible ? 'hide' : 'show')); $('eye-slash').toggleAttribute('hidden', !visible);
  });
  const resetPasswordVisibility = () => { password.type = 'password'; $('toggle-password').setAttribute('aria-pressed', 'false'); $('toggle-password').setAttribute('aria-label', t('show')); $('eye-slash').setAttribute('hidden', ''); };

  function applyPreferenceState(remember, automatic) {
    rememberLogin.checked = !!remember; autoLogin.checked = !!remember && !!automatic; autoLogin.disabled = !rememberLogin.checked;
  }
  function accountTypeLabel(value) { return value === 'customer' ? (language === 'en' ? 'Customer' : '客户') : (language === 'en' ? 'Administrator' : '管理员'); }
  function closeSavedMenu() { savedAccountMenu.hidden = true; savedAccountToggle.setAttribute('aria-expanded', 'false'); }
  function renderSavedAccounts() {
    savedAccountToggle.hidden = savedAccounts.length === 0;
    clearSavedLogin.hidden = !selectedSavedId || !savedAccounts.some(item => item.id === selectedSavedId);
    savedAccountMenu.replaceChildren();
    if (!savedAccounts.length) { const empty = document.createElement('div'); empty.className = 'saved-account-empty'; empty.textContent = language === 'en' ? 'No saved accounts' : '暂无已保存账号'; savedAccountMenu.append(empty); return; }
    for (const item of savedAccounts) {
      const row = document.createElement('button'); row.type = 'button'; row.className = 'saved-account-row'; row.dataset.savedId = item.id; row.setAttribute('role', 'option'); row.setAttribute('aria-selected', String(item.id === selectedSavedId));
      const avatar = document.createElement('span'); avatar.className = 'saved-account-avatar'; avatar.textContent = (item.username || '?').slice(0, 1).toUpperCase();
      const copy = document.createElement('span'); copy.className = 'saved-account-copy'; const name = document.createElement('b'); name.textContent = item.username; const meta = document.createElement('small'); meta.textContent = accountTypeLabel(item.accountType) + (item.autoLogin ? (language === 'en' ? ' · Auto sign-in' : ' · 自动登录') : ''); copy.append(name, meta); row.append(avatar, copy); savedAccountMenu.append(row);
    }
  }
  async function refreshSavedAccounts(preferredId = selectedSavedId) {
    if (!window.superDesktop?.listSavedLogins) return;
    const result = await window.superDesktop.listSavedLogins(); savedAccounts = Array.isArray(result?.accounts) ? result.accounts : [];
    selectedSavedId = savedAccounts.some(item => item.id === preferredId) ? preferredId : (savedAccounts.some(item => item.id === result?.selectedId) ? result.selectedId : null); renderSavedAccounts();
  }
  async function selectSavedAccount(id, { allowAutoLogin = false } = {}) {
    if (!window.superDesktop?.getSavedLogin) return null;
    const saved = await window.superDesktop.getSavedLogin(id); if (!saved?.saved) { await refreshSavedAccounts(); return null; }
    selectedSavedId = saved.id; account.value = saved.username || ''; password.value = saved.password || ''; applyPreferenceState(true, saved.autoLogin === true); resetPasswordVisibility();
    renderSavedAccounts(); closeSavedMenu();
    if (allowAutoLogin && saved.autoLogin === true && saved.password) setTimeout(() => { submitLogin({ automatic: true }); }, 0);
    return saved;
  }
  function setSavedButtonVisible(visible) { clearSavedLogin.hidden = !visible; }
  savedAccountToggle.addEventListener('click', () => { if (!savedAccounts.length) return; const open = savedAccountMenu.hidden; savedAccountMenu.hidden = !open; savedAccountToggle.setAttribute('aria-expanded', String(open)); });
  savedAccountMenu.addEventListener('click', async event => { const row = event.target.closest('[data-saved-id]'); if (!row) return; try { await selectSavedAccount(row.dataset.savedId); } catch (error) { $('form-status').textContent = cleanIpcError(error); } });
  document.addEventListener('pointerdown', event => { if (!event.target.closest('.account-field')) closeSavedMenu(); });
  rememberLogin.addEventListener('change', async () => {
    if (!rememberLogin.checked) {
      autoLogin.checked = false;
      autoLogin.disabled = true;
      // Do not erase other accounts when a new account is used without
      // remember-password. Explicit removal remains a separate action.
    } else {
      autoLogin.disabled = false;
    }
  });
  autoLogin.addEventListener('change', () => { if (autoLogin.checked) rememberLogin.checked = true; autoLogin.disabled = false; });

  $('language').addEventListener('change', e => {
    language = e.target.value; document.documentElement.lang = language;
    for (const node of document.querySelectorAll('[data-i18n]')) node.textContent = t(node.dataset.i18n);
    $('restore-window').querySelector('span').textContent = t('restore'); $('toggle-password').setAttribute('aria-label', t(password.type === 'password' ? 'show' : 'hide')); $('form-status').textContent = '';
  });
  $('privacy').addEventListener('click', () => dialog(t('privacy'), language === 'en'
    ? 'Your password is used only for sign-in. If “Remember password” is enabled, it is encrypted with Windows secure storage (DPAPI), never browser storage or logs.'
    : (window.superDesktop ? '密码仅用于登录。勾选“记住密码”后，密码会通过 Windows 安全存储（DPAPI）加密保存，不会写入浏览器存储或日志。你可以随时清除已保存账号。' : '本页面是离线界面演示。')));
  const contactDialog = $('contact-dialog');
  $('contact').addEventListener('click', () => { if (contactDialog?.showModal) contactDialog.showModal(); });

  function clearRegisterSecrets() { registerPassword.value = ''; registerConfirm.value = ''; }
  function clearRegisterValidation() { for (const input of [registerAccount, registerPassword, registerConfirm]) input.removeAttribute('aria-invalid'); $('register-status').textContent = ''; $('register-status').classList.remove('success'); }
  function closeRegister() { clearRegisterSecrets(); clearRegisterValidation(); if (registerDialog.open) registerDialog.close(); }
  $('register').addEventListener('click', () => { clearRegisterValidation(); clearRegisterSecrets(); registerAccount.value = account.value.trim(); registerDialog.showModal(); registerAccount.focus(); });
  $('close-register').addEventListener('click', closeRegister); $('cancel-register').addEventListener('click', closeRegister);
  registerDialog.addEventListener('cancel', event => { event.preventDefault(); closeRegister(); });
  registerDialog.addEventListener('click', event => { if (event.target !== registerDialog) return; const rect = registerDialog.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeRegister(); });
  [registerAccount, registerPassword, registerConfirm].forEach(input => input.addEventListener('input', () => { input.removeAttribute('aria-invalid'); $('register-status').textContent = ''; $('register-status').classList.remove('success'); }));
  registerForm.addEventListener('submit', async event => {
    event.preventDefault(); clearRegisterValidation(); const username = registerAccount.value.trim(); let invalid = null, message = '';
    if (!/^[A-Za-z0-9_]{3,40}$/.test(username)) { invalid = registerAccount; message = '用户名需为 3–40 位字母、数字或下划线。'; }
    else if (registerPassword.value.length < 8 || registerPassword.value.length > 128) { invalid = registerPassword; message = '密码长度需为 8–128 位。'; }
    else if (registerPassword.value !== registerConfirm.value) { invalid = registerConfirm; message = '两次输入的密码不一致。'; }
    if (invalid) { invalid.setAttribute('aria-invalid', 'true'); $('register-status').textContent = message; invalid.focus(); return; }
    if (!window.superDesktop?.cloudCustomerRegister) { $('register-status').textContent = '请使用超级翻译桌面版完成账号注册。'; return; }
    const submit = $('submit-register'); submit.disabled = true;
    try {
      const result = await window.superDesktop.cloudCustomerRegister({ username, password: registerPassword.value }); clearRegisterSecrets(); account.value = result.username || username; password.value = ''; resetPasswordVisibility(); closeRegister(); showToast(result.message || '注册成功，请等待管理员分配套餐。'); account.focus();
    } catch (error) { clearRegisterSecrets(); $('register-status').textContent = cleanIpcError(error) || '注册失败，请稍后重试。'; registerPassword.focus(); }
    finally { submit.disabled = false; }
  });
  $('open-register-page').addEventListener('click', async () => { try { if (!window.superDesktop?.openRegisterPage) throw new Error('请使用超级翻译桌面版打开网页注册。'); await window.superDesktop.openRegisterPage(); closeRegister(); showToast('已在默认浏览器打开注册页面。'); } catch (error) { $('register-status').textContent = cleanIpcError(error); } });

  [account, password].forEach(input => input.addEventListener('input', () => { input.closest('.pill-input').classList.remove('invalid'); input.removeAttribute('aria-invalid'); $('form-status').textContent = ''; }));
  account.addEventListener('input', () => { const match = savedAccounts.find(item => item.username.toLowerCase() === account.value.trim().toLowerCase()); if (!match || match.id !== selectedSavedId) { selectedSavedId = null; password.value = ''; applyPreferenceState(false, false); renderSavedAccounts(); } });

  async function persistSuccessfulLogin(username, secret, result) {
    if (!window.superDesktop?.saveLoginPreference) return;
    if (!rememberLogin.checked) {
      // Logging in without remembering this account must not erase previously
      // saved identities. It simply leaves the saved-account store unchanged.
      return;
    }
    const accountType = result?.accountType || 'auto';
    let saved;
    try {
      saved = await window.superDesktop.saveLoginPreference({ username, password: secret, accountType, remember: true, autoLogin: autoLogin.checked });
    } catch {
      // Authentication has already succeeded.  A profile/DPAPI write error
      // must not strand the user on the login page or affect local data.
      applyPreferenceState(false, false);
      setSavedButtonVisible(false);
      showToast(t('secureUnavailable'));
      return;
    }
    if (saved?.available === false || saved?.ok === false) { applyPreferenceState(false, false); setSavedButtonVisible(false); showToast(t('secureUnavailable')); return; }
    selectedSavedId = saved.id || selectedSavedId; await refreshSavedAccounts(selectedSavedId); setSavedButtonVisible(true);
  }

  async function submitLogin({ automatic = false } = {}) {
    if (loginBusy) return false;
    const username = account.value.trim(); const secret = password.value; const missing = !username ? account : !secret ? password : null;
    if (missing) { if (!automatic) { missing.closest('.pill-input').classList.add('invalid'); missing.setAttribute('aria-invalid', 'true'); $('form-status').textContent = t(missing === account ? 'missingAccount' : 'missingPassword'); missing.focus(); } return false; }
    if (!window.superDesktop?.login) { password.value = ''; resetPasswordVisibility(); $('form-status').textContent = t('success'); $('form-status').classList.add('success'); return true; }
    loginBusy = true; const loginButton = form.querySelector('[type="submit"]'); loginButton.disabled = true; $('form-status').classList.remove('success'); $('form-status').textContent = automatic ? t('autoSigningIn') : t('signingIn');
    try {
      let result;
      result = await window.superDesktop.login({ username, password: secret });
      await persistSuccessfulLogin(username, secret, result); password.value = ''; resetPasswordVisibility(); showToast(result?.customer?.plan ? `已登录 · ${result.customer.plan}` : '登录成功'); window.superDesktop.window('workbench'); return true;
    } catch (error) {
      // A remembered automatic attempt may fail because the service is
      // temporarily unavailable. Keep the decrypted value only in the masked
      // login field so the promised one-click manual retry remains possible.
      password.value = automatic ? secret : ''; resetPasswordVisibility(); const message = cleanIpcError(error) || '登录失败，请稍后重试。';
      if (automatic) {
        try { await window.superDesktop.disableAutoLogin?.(selectedSavedId); await refreshSavedAccounts(selectedSavedId); } catch {}
        rememberLogin.checked = true; autoLogin.checked = false; autoLogin.disabled = false; setSavedButtonVisible(true); $('form-status').textContent = `${t('autoFailed')} ${message}`.slice(0, 220);
      } else $('form-status').textContent = message;
      return false;
    } finally { loginBusy = false; loginButton.disabled = false; }
  }
  form.addEventListener('submit', event => { event.preventDefault(); submitLogin(); });

  clearSavedLogin.addEventListener('click', async () => {
    try {
      const removingId = selectedSavedId;
      let result = null;
      if (removingId && window.superDesktop?.removeSavedLogin) result = await window.superDesktop.removeSavedLogin(removingId);
      else result = await window.superDesktop?.clearSavedLogin?.();
      // Keep the form, selected id, and saved-store selection in sync.  The
      // store intentionally chooses a remaining account after a deletion;
      // loading that account here prevents a stale deleted username from
      // pointing the next "remove" click at a different identity.
      const nextId = result?.selectedId || null;
      selectedSavedId = null;
      await refreshSavedAccounts(nextId);
      if (nextId && savedAccounts.some(item => item.id === nextId)) {
        await selectSavedAccount(nextId);
      } else {
        applyPreferenceState(false, false); password.value = ''; resetPasswordVisibility();
      }
      showToast(t('cleared'));
    }
    catch (error) { $('form-status').textContent = cleanIpcError(error); }
  });

  function conceal(action) { password.value = ''; resetPasswordVisibility(); if (window.desktopControls) { window.desktopControls[action](); return; } windowElement.hidden = true; $('restore-window').hidden = false; $('restore-window').focus(); }
  $('minimize').addEventListener('click', () => conceal('minimize')); $('close').addEventListener('click', () => conceal('close'));
  $('restore-window').addEventListener('click', () => { windowElement.hidden = false; $('restore-window').hidden = true; resize(); account.focus(); });
  $('maximize').addEventListener('click', () => { if (window.desktopControls) { window.desktopControls.maximize(); return; } maximized = !maximized; resize(); $('maximize').setAttribute('aria-label', maximized ? '还原窗口' : '最大化窗口'); });

  async function initializeLogin() {
    if (!window.superDesktop?.authStatus) { applyPreferenceState(false, false); setSavedButtonVisible(false); return; }
    try {
      await window.superDesktop.authStatus(); $('account').placeholder = '超级翻译账号'; $('password').autocomplete = 'current-password'; $('demo-note').textContent = t('demo'); $('register').hidden = false;
      let list = null; if (window.superDesktop.listSavedLogins) { try { list = await window.superDesktop.listSavedLogins(); } catch { list = null; } }
      if (list?.available === false) { rememberLogin.disabled = true; autoLogin.disabled = true; $('form-status').textContent = t('secureUnavailable'); }
      savedAccounts = Array.isArray(list?.accounts) ? list.accounts : []; selectedSavedId = list?.selectedId || null; renderSavedAccounts();
      const automatic = savedAccounts.find(item => item.autoLogin === true), initial = automatic || savedAccounts.find(item => item.id === selectedSavedId) || savedAccounts[0];
      if (initial) await selectSavedAccount(initial.id, { allowAutoLogin: initial.autoLogin === true });
      else { applyPreferenceState(false, false); setSavedButtonVisible(false); }
    } catch { $('register').hidden = false; $('form-status').textContent = '管理员配置读取失败，无法登录。'; }
  }

  window.addEventListener('pagehide', () => { password.value = ''; clearRegisterSecrets(); });
  initializeLogin();
})();
