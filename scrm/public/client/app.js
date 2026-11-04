// client/app.js — 超级聚合 SCRM 客户端前台
'use strict';

const NAV = [
  { label: '首页', icon: '🏠', hash: '#/' },
  { label: '邀请码列表', icon: '🔑', hash: '#/e/codes' },
  { label: '账号列表', icon: '👤', hash: '#/e/accounts' },
  { group: '线索获客' },
  { label: '线索管理', icon: '🎯', hash: '#/e/leads' },
  { label: '底库管理', icon: '🗂️', hash: '#/e/customers' },
  { label: '分流链接', icon: '🔗', hash: '#/e/links' },
  { label: '开口回传', icon: '📤', hash: '#/e/postbacks' },
  { label: '号池共享', icon: '♻️', hash: '#/e/accounts' },
  { label: '代理IP管理', icon: '🌐', hash: '#/e/proxies' },
  { label: 'WhatsApp API', icon: '📱', hash: '#/e/wa_numbers' },
  { group: '客户运营' },
  { label: '客户管理', icon: '🧑‍💼', hash: '#/e/customers' },
  { label: '线索记录', icon: '🧾', hash: '#/e/clue_records' },
  { label: '行为控制', icon: '🎛️', hash: '#/e/behaviors' },
  { label: '会话中心', icon: '💬', hash: '#/chats' },
  { label: '标签管理', icon: '🏷️', hash: '#/e/tags' },
  { group: '内控管理' },
  { label: '敏感词监控', icon: '⚠️', hash: '#/e/sensitive' },
  { group: '运营管理' },
  { label: '素材管理', icon: '🖼️', hash: '#/e/materials' },
  { label: '快捷回复', icon: '⚡', hash: '#/e/quick' },
  { label: '关键词回复', icon: '🤖', hash: '#/e/keywords' },
  { label: '欢迎语回复', icon: '👋', hash: '#/e/welcome' },
  { label: '群发任务', icon: '📢', hash: '#/broadcasts' },
  { group: '账户与组织' },
  { label: '购买套餐', icon: '💎', hash: '#/buy' },
  { label: '账户中心', icon: '📊', hash: '#/account' },
  { label: '充值记录', icon: '💳', hash: '#/e/recharges' },
  { label: '钱包', icon: '🪙', hash: '#/wallet' },
  { label: '字符日志', icon: '📈', hash: '#/e/char_logs' },
  { label: '推广返利', icon: '🎁', hash: '#/referral' },
  { label: '子账号', icon: '👥', hash: '#/e/staff' },
  { label: '操作日志', icon: '📝', hash: '#/oplogs' },
  { label: '组织架构', icon: '🏢', hash: '#/org' },
  { label: '工单', icon: '🎫', hash: '#/e/tickets' },
];

async function screen(hash) {
  if (hash.startsWith('#/e/')) return entityView(hash.slice(4));
  if (hash === '#/buy') return buyPage();
  if (hash === '#/chats') return chatsPage();
  if (hash === '#/broadcasts') return broadcastsPage();
  if (hash === '#/wallet') return walletPage();
  if (hash === '#/oplogs') return oplogsPage();
  if (hash === '#/org') return orgPage();
  if (hash === '#/account') return accountPage();
  if (hash === '#/referral') return referralPage();
  return homePage();
}

async function chatsPage() {
  const [{ chats }, { me }] = await Promise.all([api('/chats'), api('/me')]);
  const el = document.createElement('div');
  el.innerHTML = `<div class="split" style="grid-template-columns:320px 1fr">
    <div class="panel"><h2>会话</h2>
      <div class="toolbar"><input id="newc" placeholder="+ 新建会话，输入联系人"><button class="btn" id="addc">新建</button></div>
      <div id="clist">${chats.map((c) => `<div class="row" data-id="${c.id}" style="cursor:pointer;padding:8px 0;border-bottom:1px solid #1e293b">
        <b>${esc(c.contact || '未命名')}</b><div class="s">${esc(c.last_message || '暂无消息')} · ${esc(fmtTime(c.last_at))}</div></div>`).join('') || '<div class="empty">还没有会话</div>'}</div>
    </div>
    <div class="panel"><h2>对话</h2>
      <div id="msgs" class="raw" style="min-height:240px;max-height:420px;overflow:auto">← 选一个会话</div>
      <div class="toolbar" style="margin-top:10px"><input id="msg" placeholder="输入消息" style="flex:1"><button class="btn" id="send">发送</button></div>
      <div class="s" id="chatstate"></div>
    </div></div>`;
  let cur = null;
  async function open(id) {
    cur = id;
    const { messages } = await api(`/chats/${id}/messages`);
    el.querySelector('#msgs').innerHTML = messages.map((m) => `<div style="margin:6px 0"><b>${m.direction === 'out' ? '我' : '对方'}</b> <span class="s">${esc(fmtTime(m.created_at))}</span><div>${esc(m.content)}</div></div>`).join('') || '<div class="empty">还没有消息</div>';
    await api(`/chats/${id}/read`, 'POST', {});
  }
  el.querySelectorAll('[data-id]').forEach((r) => r.onclick = () => open(Number(r.dataset.id)));
  el.querySelector('#addc').onclick = async () => {
    const contact = el.querySelector('#newc').value.trim();
    if (!contact) return toast('输入联系人');
    const r = await api('/chats', 'POST', { platform: 'WhatsApp', contact });
    location.reload();
  };
  el.querySelector('#send').onclick = async () => {
    if (!cur) return toast('先选会话');
    const content = el.querySelector('#msg').value.trim();
    if (!content) return;
    await api(`/chats/${cur}/messages`, 'POST', { content });
    el.querySelector('#msg').value = '';
    open(cur);
  };
  return el;
}

async function broadcastsPage() {
  const { jobs } = await api('/broadcasts');
  const el = document.createElement('div');
  el.innerHTML = `<div class="panel"><h2>新建群发</h2>
      <div class="toolbar"><input id="bn" placeholder="任务名（可空）"><input id="bc" placeholder="群发内容" style="flex:1"><select id="ba"><option value="customers">客户</option><option value="leads">线索</option></select><button class="btn" id="badd">创建</button></div>
      <div class="s">创建后进入队列，发送结果逐条记录；平台未连接时保持 queued，不会伪报成功。</div>
    </div>
    <div class="panel"><h2>任务列表</h2>
      <table><thead><tr><th>ID</th><th>名称</th><th>状态</th><th>总数</th><th>统计</th><th>创建时间</th><th>操作</th></tr></thead><tbody>
      ${jobs.map((j) => `<tr><td>${j.id}</td><td>${esc(j.name)}</td><td>${pill(j.status)}</td><td>${j.total}</td>
        <td>${(j.stats || []).map((s) => s.status + ':' + s.n).join(' ') || '-'}</td><td>${esc(fmtTime(j.created_at))}</td>
        <td><button class="btn" data-act="start" data-id="${j.id}">开始</button>
        <button class="btn" data-act="pause" data-id="${j.id}">暂停</button>
        <button class="btn" data-act="cancel" data-id="${j.id}">取消</button></td></tr>`).join('') || '<tr><td colspan="7"><div class="empty">还没有任务</div></td></tr>'}
      </tbody></table></div>`;
  el.querySelector('#badd').onclick = async () => {
    const content = el.querySelector('#bc').value.trim();
    if (!content) return toast('内容不能为空');
    await api('/broadcasts', 'POST', { name: el.querySelector('#bn').value.trim(), content, audience: { type: el.querySelector('#ba').value } });
    location.reload();
  };
  el.querySelectorAll('[data-act]').forEach((b) => b.onclick = async () => {
    await api(`/broadcasts/${b.dataset.id}/${b.dataset.act}`, 'POST', {});
    location.reload();
  });
  return el;
}

async function homePage() {
  const s = await api('/stats');
  const el = document.createElement('div');
  el.innerHTML = `
    <div class="cards">
      ${statCard('套餐剩余（字符）', (s.chars.quota - s.chars.used).toLocaleString(), '已用 ' + s.chars.used)}
      ${statCard('账号数', s.accounts, '平台账号')}
      ${statCard('线索', s.leads, '线索池')}
      ${statCard('分流点击', s.clicks, '累计')}
      ${statCard('邀请码', s.codes, '含子码')}
      ${statCard('子账号', s.staff, '在线协作')}
    </div>
    <div class="split">
      <div class="panel"><h2>翻译（本地克隆不扣字符）</h2>
        <textarea id="src" rows="4">hello world, this is the client portal.</textarea>
        <div class="toolbar" style="margin-top:8px">
          <select id="lang"><option>zh-CN</option><option>ja</option><option>vi</option><option>en</option></select>
          <button class="btn" id="tr">翻译</button>
        </div>
        <pre class="raw" id="trout">-</pre>
      </div>
      <div class="panel"><h2>最近访问</h2>
        <table><thead><tr><th>类型</th><th>代码</th><th>动作</th><th>时间</th></tr></thead><tbody>
        ${(s.recent || []).slice(0, 10).map((v) => `<tr><td>${esc(v.kind)}</td><td>${esc(v.code)}</td><td>${pill(v.action)}</td><td>${esc(fmtTime(v.created_at))}</td></tr>`).join('') || '<tr><td colspan="4"><div class="empty">还没有访问</div></td></tr>'}
        </tbody></table>
      </div>
    </div>`;
  el.querySelector('#tr').onclick = async () => {
    const text = el.querySelector('#src').value;
    const lang = el.querySelector('#lang').value;
    const out = el.querySelector('#trout');
    out.textContent = '翻译中…';
    try {
      const r = await fetch('/api/multi-translate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, targetLangs: [lang], engines: ['google', 'bing', 'youdao'] }) }).then((x) => x.json());
      out.textContent = (r.results || []).map((x) => `[${x.engine}] ${x.ok ? x.text : '失败：' + x.error}`).join('\n') || JSON.stringify(r, null, 1);
    } catch (e) { out.textContent = '翻译失败：' + e.message; }
  };
  return el;
}

async function accountPage() {
  const [m, ds, ps] = await Promise.all([api('/me'), api('/device/sessions').catch(() => ({ data: [] })), api('/ports/status').catch(() => ({ used: 0, limit: 0 }))]);
  const el = document.createElement('div');
  el.innerHTML = `<div class="cards">
      ${statCard('邀请码', m.remark)}
      ${statCard('套餐类型', m.consume_type === 'char' ? '字符版' : '端口版')}
      ${statCard('剩余字符', Number(m.billing.chars.remaining).toLocaleString())}
      ${statCard('端口占用', ps.used + ' / ' + (ps.limit || '不限'))}
    </div>
    <div class="panel"><h2>登录设备</h2>
      <table><thead><tr><th>设备</th><th>IP</th><th>最后活跃</th><th>状态</th><th>操作</th></tr></thead><tbody>
      ${(ds.data || []).map((d) => `<tr><td>${esc(d.device)}</td><td>${esc(d.ip || '-')}</td><td>${esc(fmtTime(d.last_seen))}</td>
        <td>${d.revoked ? '已踢出' : '在线'}</td>
        <td>${d.revoked ? '-' : `<button class="btn" data-kick="${esc(d.device)}">踢下线</button>`}</td></tr>`).join('') || '<tr><td colspan="5"><div class="empty">还没有设备记录</div></td></tr>'}
      </tbody></table></div>
    <div class="panel"><h2>接口原始状态</h2><pre class="raw">${esc(JSON.stringify(m, null, 2))}</pre></div>`;
  el.querySelectorAll('[data-kick]').forEach((b) => b.onclick = async () => {
    if (!window.confirm('确定踢出设备 ' + b.dataset.kick + '？')) return;
    await api('/device/kick', 'POST', { device: b.dataset.kick });
    toast('已踢出');
    location.reload();
  });
  return el;
}

async function walletPage() {
  const w = await api('/wallet');
  const el = document.createElement('div');
  el.innerHTML = `<div class="cards">${statCard('钱包余额', '¥' + Number(w.balance).toFixed(2), '本地记账')}</div>
    <div class="panel"><h2>充值 / 扣减</h2>
      <div class="toolbar"><input id="wa" type="number" placeholder="金额，可负"><input id="wn" placeholder="备注" style="flex:1"><button class="btn" id="wadj">提交</button></div>
      <div class="s">本地版本只记账，不接支付通道。</div></div>
    <div class="panel"><h2>流水</h2><table><thead><tr><th>类型</th><th>金额</th><th>余额</th><th>备注</th><th>时间</th></tr></thead><tbody>
      ${(w.logs || []).map((l) => `<tr><td>${esc(l.kind)}</td><td>${esc(l.amount)}</td><td>${esc(l.balance_after)}</td><td>${esc(l.note || '')}</td><td>${esc(fmtTime(l.created_at))}</td></tr>`).join('') || '<tr><td colspan="5"><div class="empty">还没有流水</div></td></tr>'}
    </tbody></table></div>`;
  el.querySelector('#wadj').onclick = async () => {
    const amount = Number(el.querySelector('#wa').value);
    if (!amount) return toast('金额不能为 0');
    await api('/wallet/adjust', 'POST', { amount, note: el.querySelector('#wn').value.trim() });
    location.reload();
  };
  return el;
}

async function oplogsPage() {
  const el = document.createElement('div');
  el.innerHTML = `<div class="panel"><h2>操作日志</h2>
    <div class="toolbar"><input id="oa" placeholder="动作过滤，如 billing"><input id="of" type="date"><input id="ot" type="date"><button class="btn" id="oq">查询</button></div>
    <div id="obox"></div>
    <div class="toolbar" style="margin-top:8px"><button class="btn" id="oprev">上一页</button><span id="opage" class="s"></span><button class="btn" id="onext">下一页</button></div>
  </div>`;
  let page = 1;
  async function load() {
    const q = new URLSearchParams();
    q.set('page', String(page)); q.set('limit', '50');
    const a = el.querySelector('#oa').value.trim();
    if (a) q.set('action', a);
    const f = el.querySelector('#of').value, t = el.querySelector('#ot').value;
    if (f) q.set('from', f);
    if (t) q.set('to', t);
    const r = await api('/oplogs?' + q.toString());
    el.querySelector('#opage').textContent = `第 ${r.page} 页 / 共 ${r.total} 条`;
    el.querySelector('#obox').innerHTML = `<table><thead><tr><th>动作</th><th>详情</th><th>时间</th></tr></thead><tbody>
      ${(r.rows || []).map((x) => `<tr data-detail="${esc(x.detail || '')}" data-action="${esc(x.action)}" style="cursor:pointer"><td>${esc(x.action)}</td><td>${esc(x.detail || '')}</td><td>${esc(fmtTime(x.created_at))}</td></tr>`).join('') || '<tr><td colspan="3"><div class="empty">没有记录</div></td></tr>'}
    </tbody></table>`;
    el.querySelectorAll('#obox tr[data-detail]').forEach((tr) => tr.onclick = () => {
      alert('动作：' + tr.dataset.action + '\n\n详情：' + (tr.dataset.detail || '-'));
    });
  }
  el.querySelector('#oq').onclick = () => { page = 1; load(); };
  el.querySelector('#oprev').onclick = () => { if (page > 1) { page--; load(); } };
  el.querySelector('#onext').onclick = () => { page++; load(); };
  await load();
  return el;
}

async function orgPage() {
  const [roles, members, staff, nodes] = await Promise.all([api('/org/roles'), api('/org/members'), api('/entities/staff').catch(() => ({ rows: [] })), api('/org/nodes').catch(() => ({ nodes: [] }))]);
  const el = document.createElement('div');
  const byParent = (pid) => (nodes.nodes || []).filter((n) => (n.parent_id || null) === pid);
  const renderTree = (pid, depth) => byParent(pid).map((n) => `<div style="padding-left:${depth * 16}px">${'—'.repeat(depth)} ${esc(n.name)}</div>` + renderTree(n.id, depth + 1)).join('');
  el.innerHTML = `<div class="panel"><h2>角色</h2>
      <div class="toolbar"><input id="rn" placeholder="角色名"><input id="rc" placeholder="分类"><input id="rp" placeholder="权限，逗号分隔" style="flex:1"><button class="btn" id="radd">新建角色</button></div>
      <table><thead><tr><th>ID</th><th>名称</th><th>分类</th><th>权限</th><th>操作</th></tr></thead><tbody>
      ${(roles.roles || []).map((r) => `<tr><td>${r.id}</td><td>${esc(r.name)}</td><td>${esc(r.category || '')}</td><td>${esc(r.perms)}</td><td><button class="btn" data-del="${r.id}">删除</button></td></tr>`).join('') || '<tr><td colspan="5"><div class="empty">还没有角色</div></td></tr>'}
      </tbody></table>
    </div>
    <div class="panel"><h2>成员</h2>
      <div class="toolbar"><select id="ms">${(staff.rows || []).map((s) => `<option value="${s.id}">${esc(s.name || s.account || ('staff#' + s.id))}</option>`).join('')}</select>
      <select id="mr">${(roles.roles || []).map((r) => `<option value="${r.id}">${esc(r.name)}</option>`).join('')}</select>
      <button class="btn" id="madd">加入成员</button></div>
      <table><thead><tr><th>成员</th><th>角色</th><th>状态</th><th>操作</th></tr></thead><tbody>
      ${(members.members || []).map((m) => `<tr><td>${esc(m.staff_name || ('staff#' + m.staff_id))}</td><td>${esc(m.role_name || '-')}</td><td>${esc(m.status)}</td><td><button class="btn" data-mdel="${m.id}">移除</button></td></tr>`).join('') || '<tr><td colspan="4"><div class="empty">还没有成员</div></td></tr>'}
      </tbody></table></div>
    <div class="panel"><h2>组织树</h2>
      <div class="toolbar"><input id="nn" placeholder="节点名"><select id="np"><option value="">根节点</option>${(nodes.nodes || []).map((n) => `<option value="${n.id}">${esc(n.name)}</option>`).join('')}</select><button class="btn" id="nadd">添加节点</button></div>
      <div>${renderTree(null, 0) || '<div class="empty">还没有节点</div>'}</div>
    </div>`;
  el.querySelector('#radd').onclick = async () => {
    const name = el.querySelector('#rn').value.trim();
    if (!name) return toast('角色名必填');
    const perms = el.querySelector('#rp').value.split(',').map((x) => x.trim()).filter(Boolean);
    await api('/org/roles', 'POST', { name, category: el.querySelector('#rc').value.trim(), perms });
    location.reload();
  };
  el.querySelectorAll('[data-del]').forEach((b) => b.onclick = async () => { await api('/org/roles/' + b.dataset.del, 'DELETE', {}); location.reload(); });
  el.querySelector('#madd').onclick = async () => {
    const staffId = el.querySelector('#ms').value;
    const roleId = el.querySelector('#mr').value;
    if (!staffId || !roleId) return toast('先选成员和角色');
    await api('/org/members', 'POST', { staff_id: Number(staffId), role_id: Number(roleId) });
    location.reload();
  };
  el.querySelectorAll('[data-mdel]').forEach((b) => b.onclick = async () => { await api('/org/members/' + b.dataset.mdel, 'DELETE', {}); location.reload(); });
  el.querySelector('#nadd').onclick = async () => {
    const name = el.querySelector('#nn').value.trim();
    if (!name) return toast('节点名必填');
    const pid = el.querySelector('#np').value;
    await api('/org/nodes', 'POST', { name, parent_id: pid ? Number(pid) : null });
    location.reload();
  };
  return el;
}

async function buyPage() {
  const { plans } = await api('/billing/catalog');
  const m = await api('/me');
  const el = document.createElement('div');
  const yuan = (c) => '¥' + (Number(c) / 100).toFixed(2).replace(/\.00$/, '');
  el.innerHTML = `<div class="cards">${plans.map((p) => `<div class="card">
      <div class="k">${esc(p.name)}</div><div class="v">${yuan(p.price_cents)}</div>
      <div class="s">${p.kind === 'char' ? Number(p.chars).toLocaleString() + ' 字符' : p.days + ' 天端口'}</div>
      <button class="btn" style="margin-top:10px" data-code="${p.code}">立即购买</button></div>`).join('')}</div>
    <div class="panel"><h2>当前</h2><pre class="raw">${esc(JSON.stringify(m.billing, null, 2))}</pre></div>`;
  el.querySelectorAll('[data-code]').forEach((b) => {
    b.onclick = async () => {
      const code = b.dataset.code;
      try {
        const q = await api('/billing/quote', 'POST', { plan_code: code, qty: 1 });
        const price = (q.quote.price_cents / 100).toFixed(2);
        if (!window.confirm(`确认购买 ${code}，应付 ¥${price}？`)) return;
        const rid = 'web-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
        const r = await api('/billing/purchase', 'POST', { plan_code: code, qty: 1, request_id: rid, quote: q.quote });
        toast('购买成功，订单 #' + r.order.id + '，当前额度 ' + Number(r.char_quota).toLocaleString());
        location.reload();
      } catch (e) {
        toast('下单失败：' + e.message);
      }
    };
  });
  return el;
}

async function referralPage() {
  const m = await api('/me');
  const el = document.createElement('div');
  el.innerHTML = `<div class="panel"><h2>推广返利</h2>
    <div class="kv"><span>你的邀请码</span><b>${esc(m.remark)}</b>
    <span>邀请链接</span><b>http://127.0.0.1:8801/client/#/login?ref=${esc(m.remark)}</b>
    <span>返利比例</span><span>15%</span></div>
    <p style="color:#5f7196;margin-top:14px">复刻版：注册接口开放，新号自动 3 天试用。</p></div>`;
  return el;
}

(async function boot() {
  const token = localStorage.getItem('client_token');
  document.body.innerHTML = '';
  if (!token) {
    document.body.appendChild(loginScreen({
      title: '超级聚合SCRM',
      hint: '邀请码登录（演示：CHMMVOA64ULC8W）',
      fields: [{ id: 'code', name: 'invite_code', label: '邀请码', value: 'CHMMVOA64ULC8W' }],
      action: (b) => api('/login', 'POST', b),
      extra: '也可以用邮箱 2983889209@qq.com / ABC123456 登录',
    }));
    return;
  }
  document.body.appendChild(shell({ title: '首页', nav: NAV, screen }));
})();
