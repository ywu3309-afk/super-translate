// shared.js — 两个前台共用的 API/布局/表格/弹窗
'use strict';
const R = document.body.dataset.realm;           // 'client' | 'admin'
const TOKEN = () => localStorage.getItem(R + '_token') || '';

async function api(path, method = 'GET', body) {
  const opt = { method, headers: { 'Content-Type': 'application/json' } };
  if (TOKEN()) opt.headers.Authorization = 'Bearer ' + TOKEN();
  if (body !== undefined) opt.body = JSON.stringify(body);
  const res = await fetch('/api/' + R + path, opt);
  let data = null;
  try { data = await res.json(); } catch (e) { data = { error: 'bad json' }; }
  if (res.status === 401) { location.hash = '#/login'; throw new Error('未登录'); }
  if (!res.ok) throw new Error(data.error || ('HTTP ' + res.status));
  return data;
}
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const short = (s, n = 30) => { s = String(s == null ? '' : s).replace(/\s+/g, ' '); return s.length > n ? s.slice(0, n) + '…' : s; };
const fmtTime = (s) => String(s || '').replace('T', ' ').slice(0, 19);

function toast(msg, isErr) {
  const el = document.createElement('div');
  el.className = 'toast' + (isErr ? ' err' : '');
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2600);
}
function pill(v) {
  const s = String(v == null ? '' : v);
  const cls = /online|active|live|ok|verified|paid|done|approved|启用|1/i.test(s) ? 'ok'
    : /banned|fail|blocked|disabled|closed|lost|0/i.test(s) ? 'bad'
    : /pending|draft|review|following|running|unknown/i.test(s) ? 'warn' : '';
  return `<span class="pill ${cls}">${esc(s || '-')}</span>`;
}

function modal({ title, fields, values = {}, onSave, saveText = '保存' }) {
  const wrap = document.createElement('div');
  wrap.className = 'modal';
  wrap.innerHTML = `<div class="box"><h3>${esc(title)}</h3><div class="body"></div>
    <div class="foot"><button class="btn ghost" data-x>取消</button><button class="btn" data-s>${esc(saveText)}</button></div></div>`;
  const body = wrap.querySelector('.body');
  fields.forEach((f) => {
    const row = document.createElement('div');
    row.className = 'row';
    const label = `<label>${esc(f.label)}${f.required ? ' *' : ''}</label>`;
    let input;
    if (f.type === 'textarea' || f.type === 'html') input = `<textarea data-f="${f.name}" rows="${f.type === 'html' ? 12 : 3}">${esc(values[f.name] || '')}</textarea>`;
    else if (f.type === 'select') input = `<select data-f="${f.name}">${(f.options || []).map((o) => `<option ${String(values[f.name]) === String(o) ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
    else input = `<input data-f="${f.name}" type="${f.type === 'number' ? 'number' : f.type === 'color' ? 'color' : f.type === 'date' ? 'date' : 'text'}" value="${esc(values[f.name] == null ? (f.default == null ? '' : f.default) : values[f.name])}">`;
    row.innerHTML = label + input;
    body.appendChild(row);
  });
  wrap.querySelector('[data-x]').onclick = () => wrap.remove();
  wrap.querySelector('[data-s]').onclick = async () => {
    const out = {};
    wrap.querySelectorAll('[data-f]').forEach((el) => { out[el.dataset.f] = el.value; });
    try { await onSave(out); wrap.remove(); } catch (e) { toast(e.message, true); }
  };
  wrap.addEventListener('click', (e) => { if (e.target === wrap) wrap.remove(); });
  document.body.appendChild(wrap);
  return wrap;
}

// 通用实体列表页
function entityView(name, opts = {}) {
  const el = document.createElement('div');
  let schema = null, rows = [];
  const load = async () => {
    if (!schema) schema = (await api('/schema')).entities[name];
    const r = await api('/entities/' + name);
    rows = r.rows || [];
    render();
  };
  const render = () => {
    if (!schema) return;
    const cols = schema.fields.filter((f) => f.type !== 'html').slice(0, 7);
    const q = (el.querySelector('#q') || {}).value || '';
    const shown = q ? rows.filter((r) => schema.fields.some((f) => String(r[f.name] || '').toLowerCase().includes(q.toLowerCase()))) : rows;
    el.innerHTML = `<div class="panel">
      <div class="toolbar">
        <h2 style="margin:0">${esc(schema.label)}（${shown.length}）</h2>
        <div class="spacer"></div>
        <input id="q" placeholder="搜索…" value="${esc(q)}">
        <button class="btn" data-new>+ 新建</button>
      </div>
      <table><thead><tr>${cols.map((f) => `<th>${esc(f.label)}</th>`).join('')}<th style="text-align:right">操作</th></tr></thead>
      <tbody>${shown.length ? shown.map((r) => `<tr>${cols.map((f) => {
        const v = r[f.name];
        const isStatus = /状态|启用/.test(f.label);
        return `<td>${isStatus ? pill(v) : esc(short(v, f.type === 'textarea' ? 40 : 34))}</td>`;
      }).join('')}<td class="actions">
        ${opts.extraActions ? opts.extraActions(r) : ''}
        <button class="btn ghost sm" data-edit="${r.id}">编辑</button>
        <button class="btn danger sm" data-del="${r.id}">删除</button>
      </td></tr>`).join('') : `<tr><td colspan="${cols.length + 1}"><div class="empty">还没有数据，点右上「+ 新建」</div></td></tr>`}</tbody></table></div>`;
    el.querySelector('#q').oninput = (e) => { const v = e.target.value; render(); el.querySelector('#q').value = v; el.querySelector('#q').focus(); };
    el.querySelector('[data-new]').onclick = () => openForm({});
    el.querySelectorAll('[data-edit]').forEach((b) => { b.onclick = () => openForm(rows.find((r) => r.id == b.dataset.edit)); });
    el.querySelectorAll('[data-del]').forEach((b) => {
      b.onclick = async () => {
        if (!confirm('确认删除？')) return;
        await api('/entities/' + name + '/' + b.dataset.del, 'DELETE');
        toast('已删除'); load();
      };
    });
    if (opts.bindRender) opts.bindRender(el, rows, load);
  };
  const openForm = (row) => modal({
    title: (row.id ? '编辑' : '新建') + schema.label,
    fields: schema.fields.filter((f) => !f.readonly),
    values: row,
    onSave: async (v) => {
      if (row.id) await api('/entities/' + name + '/' + row.id, 'PATCH', v);
      else await api('/entities/' + name, 'POST', v);
      toast('已保存'); load();
    },
  });
  load();
  return el;
}

async function me(realmPath = '/me') { return (await api(realmPath)).user || (await api(realmPath)); }

function shell({ title, subtitle, nav, screen }) {
  const app = document.createElement('div');
  app.className = 'app';
  const initial = location.hash || '#/';
  app.innerHTML = `<aside>
      <div class="brand"><div class="logo">${R === 'admin' ? '🐱' : '📨'}</div>
        <div><b>${R === 'admin' ? '超级聚合 · 广告后台' : '超级聚合 SCRM'}</b><small>${R === 'admin' ? '广告投放 · 本地版' : '多平台聚合 · 本地版'}</small></div></div>
      <nav></nav>
      <div class="footer">本地复刻版 · v1.0</div>
    </aside>
    <main><div class="topbar"><h1 id="ptitle"></h1><div class="who" id="who"></div></div><div id="view"></div></main>`;
  const navEl = app.querySelector('nav');
  nav.forEach((item) => {
    if (item.group) { const g = document.createElement('div'); g.className = 'group'; g.textContent = item.group; navEl.appendChild(g); return; }
    const a = document.createElement('a');
    a.className = 'item'; a.href = item.hash; a.dataset.hash = item.hash;
    a.innerHTML = `<span>${item.icon || '·'}</span><span>${esc(item.label)}</span>`;
    navEl.appendChild(a);
  });
  const view = app.querySelector('#view');
  const t = app.querySelector('#ptitle');
  const who = app.querySelector('#who');
  const route = async () => {
    const h = location.hash || '#/';
    navEl.querySelectorAll('a.item').forEach((a) => a.classList.toggle('active', a.dataset.hash === h));
    const item = nav.find((n) => n.hash === h) || nav[0];
    t.textContent = item.label || title;
    view.innerHTML = '';
    try {
      const node = await screen(h, item);
      view.appendChild(node);
    } catch (e) {
      view.innerHTML = `<div class="panel">出错：${esc(e.message)}</div>`;
    }
  };
  window.addEventListener('hashchange', route);
  setTimeout(async () => {
    try { const u = await me(); who.textContent = (u.remark || u.username || u.email || '') + (u.membership ? ' · ' + u.membership : ''); } catch (e) {}
  }, 50);
  route();
  return app;
}

function loginScreen({ title, hint, fields, action, extra }) {
  const el = document.createElement('div');
  el.className = 'login';
  el.innerHTML = `<div class="box"><h1>${esc(title)}</h1><p>${esc(hint)}</p>
    <div id="rows"></div><button class="btn" id="go" style="width:100%">登 录</button>
    <div style="margin-top:12px;font-size:12px;color:#5f7196">${extra || ''}</div></div>`;
  const rows = el.querySelector('#rows');
  fields.forEach((f) => {
    const d = document.createElement('div'); d.className = 'row';
    d.innerHTML = `<input id="${f.id}" placeholder="${esc(f.label)}" value="${esc(f.value || '')}" type="${f.type || 'text'}">`;
    rows.appendChild(d);
  });
  el.querySelector('#go').onclick = async () => {
    const body = {};
    fields.forEach((f) => { body[f.name || f.id] = el.querySelector('#' + f.id).value; });
    try {
      const r = await action(body);
      localStorage.setItem(R + '_token', r.token);
      location.hash = '#/';
      location.reload();
    } catch (e) { toast(e.message, true); }
  };
  return el;
}

function statCard(k, v, s) { return `<div class="card"><div class="k">${esc(k)}</div><div class="v">${esc(v)}</div>${s ? `<div class="s">${esc(s)}</div>` : ''}</div>`; }
function bars(data) {
  const max = Math.max(1, ...data.map((d) => Number(d.n) || 0));
  return `<div class="bars">${data.map((d) => `<div class="b" style="height:${Math.round((Number(d.n) / max) * 100)}%"><span>${Number(d.n) || 0}</span><em>${esc(String(d.d || '').slice(5))}</em></div>`).join('') || '<div class="empty" style="width:100%">暂无数据</div>'}</div>`;
}
