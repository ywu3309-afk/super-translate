// admin/app.js — 超级聚合广告后台（本地版）
'use strict';

const NAV = [
  { label: '概览', icon: '📊', hash: '#/' },
  { label: '斗篷管理', icon: '🛡️', hash: '#/cloak' },
  { label: '绑定域名', icon: '🌍', hash: '#/e/domains' },
  { group: '落地页' },
  { label: '创建落地页', icon: '➕', hash: '#/pages-hub', child: true },
  { label: '一键仿站', icon: '🧬', hash: '#/clone', child: true },
  { label: '上传源码', icon: '⬆️', hash: '#/upload', child: true },
  { label: '落地页列表', icon: '📄', hash: '#/e/pages', child: true },
  { label: '统计访问', icon: '📈', hash: '#/stats', child: true },
  { label: '表单留咨', icon: '📨', hash: '#/e/forms', child: true },
  { label: '落地页模版库', icon: '🧩', hash: '#/e/templates' },
  { group: '广告回传' },
  { label: '事件管理', icon: '🎯', hash: '#/e/events', child: true },
  { label: 'TrafficStars S2S', icon: '🔁', hash: '#/e/s2s', child: true },
  { label: '受众同步', icon: '👥', hash: '#/e/audiences', child: true },
  { label: '数据追踪', icon: '📡', hash: '#/e/tracking', child: true },
  { label: '归因分析', icon: '🧮', hash: '#/attribution', child: true },
  { label: '身份图谱', icon: '🕸️', hash: '#/identity', child: true },
  { label: '开口广告回传', icon: '💬', hash: '#/openchat' },
  { group: '海外分流' },
  { label: '自定义链接分流', icon: '🔗', hash: '#/shunt/custom/all', child: true },
  { label: 'WhatsApp 分流', icon: '🟢', hash: '#/shunt/stable/WhatsApp', child: true },
  { label: 'LINE 分流', icon: '🟩', hash: '#/shunt/stable/LINE', child: true },
  { label: 'Telegram 分流', icon: '🔵', hash: '#/shunt/stable/Telegram', child: true },
  { label: 'Kakao 分流', icon: '🟡', hash: '#/shunt/stable/Kakao', child: true },
  { group: '极速分流' },
  { label: 'WhatsApp 极速', icon: '⚡', hash: '#/shunt/fast/WhatsApp', child: true },
  { label: '极速分流工单', icon: '🧾', hash: '#/fast', child: true },
  { label: 'LINE 极速', icon: '⚡', hash: '#/shunt/fast/LINE', child: true },
  { label: 'Telegram 极速', icon: '⚡', hash: '#/shunt/fast/Telegram', child: true },
  { label: 'Kakao 极速', icon: '⚡', hash: '#/shunt/fast/Kakao', child: true },
  { label: '员工号', icon: '👥', hash: '#/e/admin_staff' },
  { label: 'Facebook 自动化投放', icon: '📘', hash: '#/meta' },
  { label: '使用文档', icon: '📖', hash: '#/docs' },
  { group: 'AI Powered' },
  { label: 'AI 工坊', icon: '✨', hash: '#/ai' },
  { label: '素材库', icon: '🖼️', hash: '#/e/ai_assets' },
  { label: 'AI 设置', icon: '⚙️', hash: '#/ai-settings' },
  { group: '工具' },
  { label: '仿站任务台', icon: '🧪', hash: '#/tool/cloner' },
  { label: '页面编辑器', icon: '📝', hash: '#/tool/editor' },
  { label: '数据管理', icon: '🗄️', hash: '#/tool/entities' },
  { group: '账户' },
  { label: '会员', icon: '💎', hash: '#/membership' },
];

async function screen(hash) {
  if (hash === '#/fast') { location.href = '/admin/fast.html'; return document.createElement('div'); }
  if (hash === '#/identity') { location.href = '/admin/identity.html'; return document.createElement('div'); }
  if (hash === '#/e/tracking') { location.href = '/admin/tracking.html'; return document.createElement('div'); }
  if (hash === '#/e/events') { location.href = '/admin/events.html'; return document.createElement('div'); }
  if (hash === '#/cloak') { location.href = '/admin/cloak.html'; return document.createElement('div'); }
  if (hash === '#/openchat') { location.href = '/admin/openchat.html'; return document.createElement('div'); }
  if (hash.startsWith('#/tool/')) {
    const t = hash.split('/')[2];
    location.href = t === 'cloner' ? '/admin/cloner.html' : t === 'entities' ? '/admin/entities.html' : '/admin/editor.html?id=1';
    return document.createElement('div');
  }
  if (hash === '#/cloak') return cloakPage();
  if (hash === '#/pages-hub') return pagesHub();
  if (hash === '#/clone') return cloneScreen();
  if (hash === '#/upload') return uploadScreen();
  if (hash.startsWith('#/shunt/')) { const [, , mode, platform] = hash.split('/'); return shuntPage(mode, platform); }
  if (hash === '#/attribution') return attributionPage();
  if (hash === '#/identity') return identityPage();
  if (hash === '#/meta') return metaPage();
  if (hash === '#/docs') return docsPage();
  if (hash === '#/ai') return aiStudio();
  if (hash === '#/ai-settings') return aiSettings();
  if (hash === '#/membership') return membershipPage();
  if (hash === '#/stats') return statsPage();
  if (hash === '#/e/s2s') return s2sPage();
  if (hash === '#/e/audiences') return audiencesPage();
  if (hash === '#/e/tracking') return trackingPage();
  if (hash.startsWith('#/e/')) {
    const name = hash.slice(4);
    if (name === 'pages') return entityView('pages', { extraActions: (r) => `<a class="btn ghost sm" href="/p/${encodeURIComponent(r.slug)}" target="_blank">预览</a>` });
    return entityView(name);
  }
  return overviewPage();
}

async function overviewPage() {
  const s = await api('/stats');
  const el = document.createElement('div');
  const conv = s.views ? ((s.conversions / s.views) * 100).toFixed(1) + '%' : '0%';
  el.innerHTML = `<div class="cards">
      ${statCard('落地页总数', s.pages, s.live + ' 个已上线')}
      ${statCard('累计访问', s.views, 'PV')}
      ${statCard('转化率', conv, '表单提交 / 访问')}
      ${statCard('表单留咨', s.forms, '条')}
      ${statCard('会员', s.membership, s.membership_expire || '')}
    </div>
    <div class="split">
      <div class="panel"><h2>近 14 天访问</h2>${bars(s.byDay || [])}</div>
      <div class="panel"><h2>落地页</h2>
        <table><thead><tr><th>名称</th><th>路径</th><th>访问</th><th>转化</th><th>状态</th></tr></thead><tbody>
        ${(s.list || []).map((p) => `<tr><td>${esc(p.name)}</td><td><a href="/p/${esc(p.slug)}" target="_blank">/p/${esc(p.slug)}</a></td><td>${p.views || 0}</td><td>${p.conversions || 0}</td><td>${pill(p.status)}</td></tr>`).join('') || '<tr><td colspan="5"><div class="empty">还没有落地页</div></td></tr>'}
        </tbody></table></div>
    </div>`;
  return el;
}

/* ---------------- 斗篷 ---------------- */
function ruleSummary(r) {
  const parts = [];
  if (r.country) parts.push('地区 ' + r.country);
  if (r.device && r.device !== 'any') parts.push('设备 ' + r.device);
  if (r.languages) parts.push('语言 ' + r.languages);
  if (r.browsers) parts.push('浏览器 ' + r.browsers);
  if (r.asns) parts.push('ASN ' + r.asns);
  if (r.os) parts.push('系统 ' + r.os);
  if (r.ua_contains) parts.push('UA:' + r.ua_contains);
  return parts.join(' · ') || '全部访客';
}

async function cloakPage() {
  const el = document.createElement('div');
  const schema = (await api('/schema')).entities.cloak_rules;
  el.innerHTML = `
    <div class="panel" style="background:linear-gradient(135deg,rgba(99,102,241,.14),rgba(15,23,42,.2))">
      <div class="toolbar" style="gap:10px;flex-wrap:wrap;margin:0">
        ${['⚡ 高并发实时过滤', '🧠 AI 识别', '🛡️ 审核 IP 库', '🌍 国家/省州级地区', '🗣️ 系统语言', '🧭 浏览器 / App 识别', '📶 ASN 封锁', '💻 设备 / 系统'].map((x) => `<span class="pill">${x}</span>`).join('')}
        <div class="spacer"></div>
        <button class="btn ghost" id="refresh">刷新</button>
        <button class="btn" id="addRule">+ 添加规则</button>
      </div>
    </div>
    <div class="panel" id="whoami"><div class="empty">检测中…</div></div>
    <div class="cards" id="cstats"></div>
    <div class="panel">
      <div class="toolbar" id="tabs">
        ${['过滤规则', '白名单', '待审核', '拦截记录', '斗篷自查', 'IP库', '审核IP', '访问统计', '告警'].map((t, i) => `<button class="btn ${i === 0 ? '' : 'ghost'} sm" data-tab="${t}">${t}</button>`).join('')}
      </div>
      <div id="tabbody"></div>
    </div>`;

  const tabsEl = el.querySelector('#tabs');
  const bodyEl = el.querySelector('#tabbody');
  let tab = '过滤规则';

  const whoami = async () => {
    const d = await api('/cloak/whoami');
    const v = d.visitor;
    el.querySelector('#whoami').innerHTML = `<h2>斗篷眼里的你</h2>
      <div class="kv">
        <span>设备</span><b>${esc(v.device)}</b>
        <span>系统</span><b>${esc(v.os)}</b>
        <span>应用 / 浏览器</span><b>${esc(v.browser)}</b>
        <span>系统语言</span><b>${esc(v.language)}</b>
        <span>IP</span><b>${esc(v.ip)}</b>
        <span>ASN</span><b>${esc(v.asn)}</b>
        <span>地址</span><b>${esc(v.country)}</b>
        <span>判定</span><b>${esc(d.action)}${d.rule ? '（规则：' + esc(d.rule.name) + '）' : ''}</b>
        <span>说明</span><b>${esc(v.explain)}</b>
        <span>时间</span><b>${esc(fmtTime(v.at))}</b>
      </div>
      <div style="margin-top:12px"><button class="btn ghost sm" id="recheck">重新检测</button></div>`;
    el.querySelector('#recheck').onclick = whoami;
  };
  const renderStats = async () => {
    const s = await api('/cloak/stats');
    el.querySelector('#cstats').innerHTML = [
      statCard('今日拦截', s.todayBlocked, '今日共 ' + s.todayBlocked + ' 次拦截'),
      statCard('规则总数', s.rules, '活跃中'),
      statCard('生效规则', s.enabled, '运行正常'),
      statCard('待审核', s.pending, '审核队列'),
    ].join('');
  };

  const draw = async () => {
    tabsEl.querySelectorAll('[data-tab]').forEach((b) => { b.className = 'btn sm ' + (b.dataset.tab === tab ? '' : 'ghost'); });
    if (tab === '过滤规则') {
      const rows = (await api('/entities/cloak_rules')).rows;
      bodyEl.innerHTML = `<table><thead><tr><th>规则名称</th><th>规则</th><th>过滤条件</th><th>审核期</th><th>状态</th><th style="text-align:right">操作</th></tr></thead><tbody>
        ${rows.map((r) => `<tr><td>${esc(r.name)}</td><td>${pill(r.action)}</td><td>${esc(ruleSummary(r))}</td><td>${Number(r.review_days || 0)} 天</td><td>${pill(r.enabled === '1' ? '启用' : '0')}</td>
          <td class="actions"><button class="btn ghost sm" data-edit="${r.id}">编辑</button><button class="btn danger sm" data-del="${r.id}">删除</button></td></tr>`).join('') || '<tr><td colspan="6"><div class="empty">还没有规则</div></td></tr>'}
        </tbody></table>`;
      bodyEl.querySelectorAll('[data-edit]').forEach((b) => {
        b.onclick = () => modal({ title: '编辑斗篷规则', fields: schema.fields.filter((f) => !f.readonly), values: rows.find((r) => r.id == b.dataset.edit), onSave: async (v) => { await api('/entities/cloak_rules/' + b.dataset.edit, 'PATCH', v); toast('已保存'); draw(); } });
      });
      bodyEl.querySelectorAll('[data-del]').forEach((b) => {
        b.onclick = async () => { if (!confirm('删除规则？')) return; await api('/entities/cloak_rules/' + b.dataset.del, 'DELETE'); toast('已删除'); draw(); };
      });
    } else if (tab === '白名单') {
      const rows = (await api('/cloak/whitelist')).rows;
      bodyEl.innerHTML = `<div class="toolbar"><input id="wl-ip" placeholder="IP / CIDR"><input id="wl-note" placeholder="备注"><button class="btn" id="wl-add">添加白名单</button></div>
        <table><thead><tr><th>IP</th><th>备注</th><th>时间</th><th></th></tr></thead><tbody>
        ${rows.map((r) => `<tr><td>${esc(r.ip)}</td><td>${esc(r.note)}</td><td>${esc(fmtTime(r.created_at))}</td><td class="actions"><button class="btn danger sm" data-wl="${r.id}">删除</button></td></tr>`).join('') || '<tr><td colspan="4"><div class="empty">白名单为空</div></td></tr>'}
        </tbody></table>`;
      bodyEl.querySelector('#wl-add').onclick = async () => {
        await api('/cloak/whitelist', 'POST', { ip: bodyEl.querySelector('#wl-ip').value, note: bodyEl.querySelector('#wl-note').value });
        toast('已加入白名单'); draw();
      };
      bodyEl.querySelectorAll('[data-wl]').forEach((b) => { b.onclick = async () => { await api('/cloak/whitelist/' + b.dataset.wl, 'DELETE'); draw(); }; });
    } else if (tab === '待审核') {
      const rows = (await api('/cloak/reviews')).rows.filter((r) => r.status === 'pending');
      bodyEl.innerHTML = `<table><thead><tr><th>IP</th><th>国家</th><th>原因</th><th>状态</th><th>时间</th><th style="text-align:right">操作</th></tr></thead><tbody>
        ${rows.map((r) => `<tr><td>${esc(r.ip)}</td><td>${esc(r.country)}</td><td>${esc(r.reason)}</td><td>${pill(r.status)}</td><td>${esc(fmtTime(r.created_at))}</td>
        <td class="actions"><button class="btn sm" data-ok="${r.id}">通过</button> <button class="btn danger sm" data-no="${r.id}">拒绝</button></td></tr>`).join('') || '<tr><td colspan="6"><div class="empty">没有待审核记录</div></td></tr>'}
        </tbody></table>`;
      bodyEl.querySelectorAll('[data-ok]').forEach((b) => { b.onclick = async () => { await api('/cloak/reviews/' + b.dataset.ok + '/approve', 'POST', {}); draw(); }; });
      bodyEl.querySelectorAll('[data-no]').forEach((b) => { b.onclick = async () => { await api('/cloak/reviews/' + b.dataset.no + '/block', 'POST', {}); draw(); }; });
    } else if (tab === '审核IP') {
      const rows = (await api('/cloak/ips')).rows.filter((r) => r.kind === 'review');
      bodyEl.innerHTML = `<table><thead><tr><th>CIDR</th><th>ASN</th><th>国家</th><th>标签</th><th>类型</th></tr></thead><tbody>
        ${rows.map((r) => `<tr><td>${esc(r.cidr)}</td><td>${esc(r.asn)}</td><td>${esc(r.country)}</td><td>${esc(r.label)}</td><td>${pill(r.kind)}</td></tr>`).join('') || '<tr><td colspan="5"><div class="empty">审核 IP 库为空</div></td></tr>'}
        </tbody></table>`;
    } else if (tab === '拦截记录') {
      const rows = (await api('/cloak/logs')).rows;
      bodyEl.innerHTML = `<table><thead><tr><th>页面</th><th>IP</th><th>国家</th><th>动作</th><th>时间</th></tr></thead><tbody>
        ${rows.map((r) => `<tr><td>${esc(r.page)}</td><td>${esc(r.ip)}</td><td>${esc(r.country)}</td><td>${pill(r.action)}</td><td>${esc(fmtTime(r.created_at))}</td></tr>`).join('') || '<tr><td colspan="5"><div class="empty">还没有访问记录，打开 /p/watch 试试</div></td></tr>'}
        </tbody></table>`;
    } else if (tab === '斗篷自查') {
      bodyEl.innerHTML = `<div class="split">
        <div><div class="row"><label>User-Agent</label><textarea id="sc-ua" rows="3">${esc(navigator.userAgent)}</textarea></div>
          <div class="row"><label>国家代码</label><input id="sc-country" value="US"></div>
          <div class="row"><label>系统语言</label><input id="sc-lang" value="en-US,en;q=0.9"></div>
          <div class="row"><label>IP</label><input id="sc-ip" value="203.0.113.10"></div>
          <button class="btn" id="sc-go">开始自查</button></div>
        <div><pre class="raw" id="sc-out">-</pre></div></div>`;
      bodyEl.querySelector('#sc-go').onclick = async () => {
        const qs = new URLSearchParams({ ua: bodyEl.querySelector('#sc-ua').value, country: bodyEl.querySelector('#sc-country').value, lang: bodyEl.querySelector('#sc-lang').value, ip: bodyEl.querySelector('#sc-ip').value });
        const d = await api('/cloak/selfcheck?' + qs.toString());
        bodyEl.querySelector('#sc-out').textContent = JSON.stringify(d, null, 2);
      };
    } else if (tab === 'IP库') {
      const rows = (await api('/cloak/ips')).rows;
      bodyEl.innerHTML = `<div class="toolbar"><input id="ip-cidr" placeholder="CIDR"><input id="ip-asn" placeholder="ASN"><input id="ip-country" placeholder="国家"><input id="ip-label" placeholder="标签"><button class="btn" id="ip-add">添加</button></div>
        <table><thead><tr><th>CIDR</th><th>ASN</th><th>国家</th><th>标签</th><th>类型</th><th></th></tr></thead><tbody>
        ${rows.map((r) => `<tr><td>${esc(r.cidr)}</td><td>${esc(r.asn)}</td><td>${esc(r.country)}</td><td>${esc(r.label)}</td><td>${pill(r.kind)}</td><td class="actions"><button class="btn danger sm" data-ip="${r.id}">删除</button></td></tr>`).join('') || '<tr><td colspan="6"><div class="empty">IP 库为空</div></td></tr>'}
        </tbody></table>`;
      bodyEl.querySelector('#ip-add').onclick = async () => {
        await api('/cloak/ips', 'POST', { cidr: bodyEl.querySelector('#ip-cidr').value, asn: bodyEl.querySelector('#ip-asn').value, country: bodyEl.querySelector('#ip-country').value, label: bodyEl.querySelector('#ip-label').value, kind: 'black' });
        draw();
      };
      bodyEl.querySelectorAll('[data-ip]').forEach((b) => { b.onclick = async () => { await api('/cloak/ips/' + b.dataset.ip, 'DELETE'); draw(); }; });
    } else if (tab === '访问统计') {
      const s = await api('/stats');
      bodyEl.innerHTML = `<div class="panel" style="border:0;padding:0"><h2>近 14 天访问</h2>${bars(s.byDay || [])}</div>
        <table style="margin-top:16px"><thead><tr><th>类型</th><th>动作</th><th>次数</th></tr></thead><tbody>
        ${(s.visits || []).map((v) => `<tr><td>${esc(v.kind)}</td><td>${pill(v.action)}</td><td>${v.n}</td></tr>`).join('') || '<tr><td colspan="3"><div class="empty">暂无访问</div></td></tr>'}
        </tbody></table>`;
    } else if (tab === '告警') {
      const rows = (await api('/cloak/alerts')).rows;
      bodyEl.innerHTML = `<table><thead><tr><th>级别</th><th>内容</th><th>时间</th></tr></thead><tbody>
        ${rows.map((r) => `<tr><td>${pill(r.level)}</td><td>${esc(r.message)}</td><td>${esc(fmtTime(r.created_at))}</td></tr>`).join('') || '<tr><td colspan="3"><div class="empty">没有告警</div></td></tr>'}
        </tbody></table>`;
    }
  };

  tabsEl.querySelectorAll('[data-tab]').forEach((b) => { b.onclick = () => { tab = b.dataset.tab; draw(); }; });
  el.querySelector('#refresh').onclick = () => { whoami(); renderStats(); draw(); };
  el.querySelector('#addRule').onclick = () => modal({
    title: '添加斗篷规则', fields: schema.fields.filter((f) => !f.readonly), values: { enabled: '1', action: 'block', device: 'any' },
    onSave: async (v) => { await api('/entities/cloak_rules', 'POST', v); toast('已添加'); draw(); },
  });
  whoami(); renderStats(); draw();
  return el;
}

/* ---------------- 落地页：创建 / 仿站 / 上传 ---------------- */
async function pagesHub() {
  const rows = (await api('/entities/pages')).rows;
  const el = document.createElement('div');
  el.innerHTML = `<div class="cards">
      ${statCard('落地页', rows.length, rows.filter((r) => r.status === 'live').length + ' 个已上线')}
      ${statCard('累计访问', rows.reduce((a, r) => a + Number(r.views || 0), 0), 'PV')}
      ${statCard('表单转化', rows.reduce((a, r) => a + Number(r.conversions || 0), 0), '条')}
    </div>
    <div class="panel"><h2>创建方式</h2>
      <div class="cards">
        <div class="card"><div class="k">空白落地页</div><div class="s">填名称/路径/HTML，三秒上线</div><button class="btn" style="margin-top:10px" id="b-new">创建</button></div>
        <div class="card"><div class="k">一键仿站</div><div class="s">输入竞品 URL，抓取并改写相对路径</div><button class="btn" style="margin-top:10px" id="b-clone">开始仿站</button></div>
        <div class="card"><div class="k">上传源码</div><div class="s">粘贴现成 HTML，直接生成页面</div><button class="btn" style="margin-top:10px" id="b-upload">上传</button></div>
      </div>
    </div>
    <div class="panel"><h2>最近创建</h2>
      <table><thead><tr><th>名称</th><th>路径</th><th>访问</th><th>状态</th><th></th></tr></thead><tbody>
      ${rows.slice(0, 8).map((p) => `<tr><td>${esc(p.name)}</td><td>/p/${esc(p.slug)}</td><td>${p.views || 0}</td><td>${pill(p.status)}</td><td class="actions"><a class="btn ghost sm" href="/p/${esc(p.slug)}" target="_blank">预览</a></td></tr>`).join('') || '<tr><td colspan="5"><div class="empty">还没有页面</div></td></tr>'}
      </tbody></table></div>`;
  const schema = (await api('/schema')).entities.pages;
  el.querySelector('#b-new').onclick = () => modal({
    title: '创建落地页', fields: schema.fields.filter((f) => !f.readonly), values: { status: 'live', template: 'blank', html: '<h1>标题</h1><p>卖点</p>' },
    onSave: async (v) => { await api('/entities/pages', 'POST', v); toast('已创建'); location.reload(); },
  });
  el.querySelector('#b-clone').onclick = () => location.hash = '#/clone';
  el.querySelector('#b-upload').onclick = () => location.hash = '#/upload';
  return el;
}

async function cloneScreen() {
  const el = document.createElement('div');
  el.innerHTML = `<div class="panel"><h2>一键仿站</h2>
    <p style="color:#8b9cc0">服务端抓取目标页面 → 相对路径改写为绝对地址 → 去掉脚本 → 存成本地落地页。</p>
    <div class="row"><label>目标 URL</label><input id="url" placeholder="https://example.com/landing"></div>
    <div class="split"><div class="row"><label>名称</label><input id="name" placeholder="仿站页面"></div><div class="row"><label>路径 slug</label><input id="slug" placeholder="clone-demo"></div></div>
    <button class="btn" id="go">开始仿站</button><pre class="raw" id="out">等待…</pre></div>`;
  el.querySelector('#go').onclick = async () => {
    const out = el.querySelector('#out');
    out.textContent = '抓取中…';
    try {
      const r = await api('/clone', 'POST', { url: el.querySelector('#url').value, name: el.querySelector('#name').value, slug: el.querySelector('#slug').value });
      out.textContent = `完成：/p/${r.slug}（${r.bytes} 字节，上游 ${r.upstream}）`;
      toast('仿站完成：/p/' + r.slug);
    } catch (e) { out.textContent = '失败：' + e.message; }
  };
  return el;
}

async function uploadScreen() {
  const el = document.createElement('div');
  el.innerHTML = `<div class="panel"><h2>上传源码</h2>
    <div class="split"><div class="row"><label>名称</label><input id="name" value="上传页面"></div><div class="row"><label>路径 slug</label><input id="slug" value="upload-demo"></div></div>
    <div class="row"><label>HTML</label><textarea id="html" rows="12">&lt;h1&gt;Hello&lt;/h1&gt;
&lt;p&gt;上传的落地页&lt;/p&gt;</textarea></div>
    <button class="btn" id="go">生成页面</button><pre class="raw" id="out">-</pre></div>`;
  el.querySelector('#go').onclick = async () => {
    try {
      const r = await api('/pages/upload', 'POST', { name: el.querySelector('#name').value, slug: el.querySelector('#slug').value, html: el.querySelector('#html').value });
      el.querySelector('#out').textContent = '已生成：/p/' + r.page.slug;
    } catch (e) { toast(e.message, true); }
  };
  return el;
}

/* ---------------- 回传 / 追踪 / 归因 / 身份 ---------------- */
async function s2sPage() {
  const el = await entityView('s2s', {
    extraActions: (r) => `<button class="btn ghost sm" data-test="${r.id}">测试回传</button>`,
    bindRender: (root, rows) => {
      root.querySelectorAll('[data-test]').forEach((b) => {
        b.onclick = async () => {
          const r = await api('/s2s/test', 'POST', { id: Number(b.dataset.test) });
          toast(r.ok ? `回传成功 HTTP ${r.status}` : '回传失败：' + r.error, !r.ok);
        };
      });
    },
  });
  return el;
}

async function audiencesPage() {
  return entityView('audiences', {
    extraActions: (r) => `<button class="btn ghost sm" data-sync="${r.id}">同步</button>`,
    bindRender: (root) => {
      root.querySelectorAll('[data-sync]').forEach((b) => {
        b.onclick = async () => { await api('/audiences/sync', 'POST', { id: Number(b.dataset.sync) }); toast('已同步'); location.reload(); };
      });
    },
  });
}

async function trackingPage() {
  const el = await entityView('tracking', {
    extraActions: (r) => `<button class="btn ghost sm" data-link="${r.id}">生成短链</button>`,
    bindRender: (root) => {
      root.querySelectorAll('[data-link]').forEach((b) => {
        b.onclick = async () => {
          const r = await api('/tracking/link', 'POST', { id: Number(b.dataset.link) });
          prompt('追踪短链', location.origin + r.link);
        };
      });
    },
  });
  return el;
}

async function attributionPage() {
  const s = await api('/attribution');
  const el = document.createElement('div');
  el.innerHTML = `<div class="cards">
      ${statCard('追踪点击', s.clicks, '全部来源')}
      ${statCard('表单转化', s.forms, '条')}
      ${statCard('来源数', s.rows.length, 'source/medium/campaign')}
    </div>
    <div class="panel"><h2>归因明细</h2>
      <table><thead><tr><th>来源</th><th>媒介</th><th>campaign</th><th>点击</th><th>占比</th></tr></thead><tbody>
      ${s.rows.map((r) => `<tr><td>${esc(r.source)}</td><td>${esc(r.medium || '-')}</td><td>${esc(r.campaign || '-')}</td><td>${r.clicks}</td><td>${s.clicks ? ((r.clicks / s.clicks) * 100).toFixed(1) + '%' : '-'}</td></tr>`).join('') || '<tr><td colspan="5"><div class="empty">还没有追踪点击，去「数据追踪」生成短链后访问一次</div></td></tr>'}
      </tbody></table></div>`;
  return el;
}

async function identityPage() {
  const s = await api('/identity');
  const el = document.createElement('div');
  el.innerHTML = `<div class="panel"><h2>身份图谱</h2>
    <p style="color:#8b9cc0">按联系方式归一：同一号码出现在表单/多平台时合并为一条身份。</p>
    <table><thead><tr><th>身份键</th><th>姓名</th><th>联系方式</th><th>触点</th><th>平台</th><th>首次</th></tr></thead><tbody>
    ${s.rows.map((r) => `<tr><td>${esc(r.key)}</td><td>${esc(r.name || '-')}</td><td>${esc(r.contact || '-')}</td><td>${r.count}</td><td>${r.platforms.map((p) => `<span class="pill">${esc(p)}</span>`).join(' ')}</td><td>${esc(fmtTime(r.first))}</td></tr>`).join('') || '<tr><td colspan="6"><div class="empty">还没有身份数据，先提交一条落地页表单</div></td></tr>'}
    </tbody></table></div>
    <div class="panel"><h2>手动关联</h2>
      <div class="toolbar"><input id="i-contact" placeholder="联系方式"><input id="i-platform" placeholder="平台"><input id="i-ext" placeholder="外部 ID"><button class="btn" id="i-add">添加</button></div>
    </div>`;
  el.querySelector('#i-add').onclick = async () => {
    await api('/entities/identity_links', 'POST', { contact: el.querySelector('#i-contact').value, platform: el.querySelector('#i-platform').value, external_id: el.querySelector('#i-ext').value });
    toast('已关联'); location.reload();
  };
  return el;
}

/* ---------------- 分流 ---------------- */
async function shuntPage(mode, platform) {
  const el = document.createElement('div');
  const schema = (await api('/schema')).entities.shunt;
  const load = async () => {
    let rows = (await api('/entities/shunt')).rows;
    if (mode && mode !== 'custom') rows = rows.filter((r) => r.mode === mode);
    if (platform && platform !== 'all') rows = rows.filter((r) => r.platform === platform);
    el.innerHTML = `<div class="panel"><h2>${platform === 'all' ? '自定义链接分流' : platform + ' ' + (mode === 'fast' ? '极速分流' : '分流稳定版')}</h2>
      <div class="toolbar"><button class="btn" id="add">+ 新建链接</button><div class="spacer"></div>
      <span style="color:#5f7196;font-size:12px">短链：http://127.0.0.1:8801/s/&lt;code&gt;（随机分流到目标列表）</span></div>
      <table><thead><tr><th>短码</th><th>平台</th><th>模式</th><th>目标</th><th>点击</th><th>短链</th><th></th></tr></thead><tbody>
      ${rows.map((r) => `<tr><td>${esc(r.code)}</td><td>${esc(r.platform)}</td><td>${pill(r.mode)}</td><td>${esc(short(r.targets, 36))}</td><td>${r.clicks || 0}</td>
        <td><a href="/s/${esc(r.code)}" target="_blank">/s/${esc(r.code)}</a></td>
        <td class="actions"><button class="btn ghost sm" data-edit="${r.id}">编辑</button><button class="btn danger sm" data-del="${r.id}">删除</button></td></tr>`).join('') || '<tr><td colspan="7"><div class="empty">还没有链接</div></td></tr>'}
      </tbody></table></div>`;
    el.querySelector('#add').onclick = () => modal({
      title: '新建分流链接', fields: schema.fields.filter((f) => !f.readonly),
      values: { mode: mode === 'fast' ? 'fast' : 'stable', platform: platform === 'all' ? 'WhatsApp' : platform },
      onSave: async (v) => { await api('/entities/shunt', 'POST', v); toast('已创建'); load(); },
    });
    el.querySelectorAll('[data-edit]').forEach((b) => { b.onclick = () => modal({ title: '编辑链接', fields: schema.fields.filter((f) => !f.readonly), values: rows.find((r) => r.id == b.dataset.edit), onSave: async (v) => { await api('/entities/shunt/' + b.dataset.edit, 'PATCH', v); load(); } }); });
    el.querySelectorAll('[data-del]').forEach((b) => { b.onclick = async () => { if (!confirm('删除？')) return; await api('/entities/shunt/' + b.dataset.del, 'DELETE'); load(); }; });
  };
  load();
  return el;
}

/* ---------------- Meta / 文档 / AI / 会员 / 统计 ---------------- */
async function metaPage() {
  const s = await api('/meta/summary');
  const el = document.createElement('div');
  el.innerHTML = `<div class="cards">
      ${statCard('广告账户', s.accounts.length, '已连接')}
      ${statCard('Campaign', s.campaigns.length, s.campaigns.filter((c) => c.status === 'ACTIVE').length + ' 个在投')}
      ${statCard('广告', s.ads.length, '素材维度')}
      ${statCard('累计花费', '$' + s.spend, '账户上报')}
    </div>
    <div class="panel"><h2>批量投放（复刻版：只落库，不真投）</h2>
      <div class="toolbar"><input id="m-name" placeholder="campaign 名称"><input id="m-budget" placeholder="预算" value="50"><input id="m-account" placeholder="广告账户"><button class="btn" id="m-go">创建</button></div>
      <p style="color:#8b9cc0;font-size:12px">真实投放需要 Meta access_token；接口形状对齐 /api/meta/accounts · campaigns · adsets · ads · bulk-launch · rules。</p>
    </div>
    <div class="panel"><h2>Campaign</h2>
      <table><thead><tr><th>名称</th><th>目标</th><th>预算</th><th>状态</th></tr></thead><tbody>
      ${s.campaigns.map((c) => `<tr><td>${esc(c.name)}</td><td>${esc(c.objective)}</td><td>$${c.budget}</td><td>${pill(c.status)}</td></tr>`).join('') || '<tr><td colspan="4"><div class="empty">还没有 campaign</div></td></tr>'}
      </tbody></table></div>`;
  el.querySelector('#m-go').onclick = async () => {
    await api('/meta/launch', 'POST', { name: el.querySelector('#m-name').value, budget: Number(el.querySelector('#m-budget').value), account_id: el.querySelector('#m-account').value });
    toast('已创建'); location.reload();
  };
  return el;
}

async function docsPage() {
  const el = document.createElement('div');
  el.innerHTML = `<div class="panel"><h2>使用文档（复刻版）</h2>
    <div class="kv">
      <span>客户端</span><b><a href="/client/" target="_blank">/client/</a> — 邀请码 CHMMVOA64ULC8W</b>
      <span>广告面板</span><b><a href="/admin/" target="_blank">/admin/</a> — 2983889209@qq.com / ABC123456</b>
      <span>落地页</span><b>/p/&lt;slug&gt;（过斗篷规则，带留咨表单）</b>
      <span>分流短链</span><b>/s/&lt;code&gt;（随机分流 + 点击计数）</b>
      <span>追踪短链</span><b>/t/&lt;code&gt;（记 source/medium/campaign）</b>
      <span>表单提交</span><b>POST /f/&lt;slug&gt;</b>
      <span>像素</span><b>/px/&lt;code&gt;.gif</b>
    </div>
    <h2 style="margin-top:18px">功能清单</h2>
    <p style="color:#8b9cc0;font-size:13px;line-height:1.9">
      斗篷管理（规则/白名单/待审核/拦截记录/自查/IP库/审核IP/访问统计/告警）·
      落地页（创建/一键仿站/上传源码/列表/统计/表单/模版库）·
      广告回传（事件/TrafficStars S2S/受众同步/数据追踪/归因分析/身份图谱/开口回传）·
      海外分流与极速分流（自定义 + WhatsApp/LINE/Telegram/Kakao）· 员工号 · Facebook 自动化投放 ·
      AI 工坊（文案/图片/视频脚本）· 素材库 · AI 设置 · 会员
    </p></div>`;
  return el;
}

async function aiStudio() {
  const el = document.createElement('div');
  el.innerHTML = `<div class="panel"><h2>AI 工坊 · 文案 / 图片 / 视频脚本</h2>
    <div class="split"><div>
      <div class="row"><label>类型</label><select id="kind"><option value="copy">文案</option><option value="image">图片</option><option value="video">视频脚本</option></select></div>
      <div class="row"><label>提示词</label><textarea id="prompt" rows="4">夏季智能手表促销，面向东南亚市场，WhatsApp 引流</textarea></div>
      <button class="btn" id="gen">生成</button>
    </div><div><pre class="raw" id="out">等待生成…</pre></div></div></div>
    <div class="panel"><h2>最近生成</h2><div id="recent"></div></div>`;
  el.querySelector('#gen').onclick = async () => {
    const r = await api('/ai/generate', 'POST', { kind: el.querySelector('#kind').value, prompt: el.querySelector('#prompt').value });
    el.querySelector('#out').textContent = r.content;
    loadRecent();
  };
  const loadRecent = async () => {
    const rows = (await api('/entities/ai_assets')).rows.slice(0, 8);
    el.querySelector('#recent').innerHTML = rows.length ? `<table><thead><tr><th>类型</th><th>提示词</th><th>时间</th></tr></thead><tbody>${rows.map((r) => `<tr><td>${esc(r.kind)}</td><td>${esc(short(r.prompt, 40))}</td><td>${esc(fmtTime(r.created_at))}</td></tr>`).join('')}</tbody></table>` : '<div class="empty">还没有生成记录</div>';
  };
  loadRecent();
  return el;
}

async function aiSettings() {
  const cur = (await api('/ai/settings')).row || {};
  const el = document.createElement('div');
  el.innerHTML = `<div class="panel"><h2>AI 设置</h2>
    <div class="row"><label>Provider</label><input id="provider" value="${esc(cur.provider || 'openai')}"></div>
    <div class="row"><label>API Key</label><input id="key" value="${esc(cur.api_key || '')}" placeholder="sk-..."></div>
    <div class="row"><label>模型</label><input id="model" value="${esc(cur.model || 'gpt-4o-mini')}"></div>
    <button class="btn" id="save">保存</button></div>`;
  el.querySelector('#save').onclick = async () => {
    await api('/ai/settings', 'POST', { provider: el.querySelector('#provider').value, api_key: el.querySelector('#key').value, model: el.querySelector('#model').value });
    toast('已保存');
  };
  return el;
}

async function membershipPage() {
  const m = (await api('/membership')).row;
  const el = document.createElement('div');
  el.innerHTML = `<div class="cards">
      ${statCard('当前会员', m.membership, '到期 ' + (m.membership_expire || '-'))}
      ${statCard('月 UV 上限', m.membership === 'free' ? 1000 : '无限', '免费版每月 1000')}
    </div>
    <div class="panel"><h2>升级</h2><div class="cards">
      ${[['专业版', '¥99/月', '斗篷高级规则 · 克隆页 · 去水印'], ['旗舰版', '¥299/月', 'AI 工坊 · 归因 · 子账号']].map(([n, p, d]) => `<div class="card"><div class="k">${n}</div><div class="v">${p}</div><div class="s">${d}</div><button class="btn" style="margin-top:10px" data-buy>立即开通</button></div>`).join('')}
    </div></div>`;
  el.querySelectorAll('[data-buy]').forEach((b) => { b.onclick = async () => { await api('/membership/buy', 'POST', {}); toast('已开通'); location.reload(); }; });
  return el;
}

async function statsPage() {
  const s = await api('/stats');
  const el = document.createElement('div');
  el.innerHTML = `<div class="cards">
      ${statCard('访问', s.views, 'PV')}
      ${statCard('转化', s.conversions, '表单')}
      ${statCard('留咨', s.forms, '条')}
      ${statCard('落地页', s.pages, s.live + ' 上线')}
    </div>
    <div class="panel"><h2>近 14 天</h2>${bars(s.byDay || [])}</div>
    <div class="panel"><h2>明细</h2><table><thead><tr><th>页面</th><th>访问</th><th>转化</th><th>转化率</th><th>状态</th></tr></thead><tbody>
      ${(s.list || []).map((p) => `<tr><td>${esc(p.name)}</td><td>${p.views || 0}</td><td>${p.conversions || 0}</td><td>${p.views ? ((p.conversions / p.views) * 100).toFixed(1) + '%' : '-'}</td><td>${pill(p.status)}</td></tr>`).join('') || '<tr><td colspan="5"><div class="empty">暂无</div></td></tr>'}
    </tbody></table></div>`;
  return el;
}

(async function boot() {
  document.body.innerHTML = '';
  if (!localStorage.getItem('admin_token')) {
    document.body.appendChild(loginScreen({
      title: '超级聚合 · 广告后台',
      hint: '广告投放管理系统（演示账号 2983889209@qq.com / ABC123456）',
      fields: [
        { id: 'email', name: 'email', label: '邮箱', value: '2983889209@qq.com' },
        { id: 'password', name: 'password', label: '密码', type: 'password', value: 'ABC123456' },
      ],
      action: (b) => api('/login', 'POST', b),
      extra: '复刻版：注册接口开放，新号自动 3 天试用',
    }));
    return;
  }
  document.body.appendChild(shell({ title: '概览', nav: NAV, screen }));
})();
