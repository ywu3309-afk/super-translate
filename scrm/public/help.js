/* help.js — 菜单旁小问号，点开是大白话说明 */
(function () {
  const TEXT = {
    // 客户端站
    'client:#/': '概览：像店铺总账。今天有多少会话、多少联系人、用了多少翻译字数，打开第一眼就知道。',
    'client:#/accounts': '账号管理：把 WhatsApp、LINE 这些客服号挂进来。好比把几部手机放进同一个收银台。',
    'client:#/chats': '会话中心：所有平台的消息都挤在这一个窗口回。不用来回切软件。',
    'client:#/broadcasts': '群发：写好一段话，挑一批联系人一次发出去。先在任务列表看进度，发不出去也会标出来。',
    'client:#/e/contacts': '通讯录：所有联系人都在这里，支持搜索和批量导入。',
    'client:#/e/customers': '客户管理：给每个客户记备注、打标签，方便回头跟进。',
    'client:#/e/tags': '标签：给客户贴颜色标签，比如“重点”“已付款”。',
    'client:#/e/auto_replies': '自动回复：设关键词和回复语。客户一问“价格”，机器人先答一句。',
    'client:#/e/fans': '粉丝分析：看粉丝按天涨了多少、哪个平台最多。',
    'client:#/e/devices': '设备管理：哪些电脑/手机登录过你的账号。看到陌生设备就踢下线。',
    'client:#/e/proxies': '代理管理：给不同账号配不同网络出口，避免所有号挤一个 IP。',
    'client:#/e/port_leases': '窗口占用：控制同时能开几个聊天窗口，满了就排队。',
    'client:#/translate': '翻译中心：一段文字翻成多国语言，也可以对比几种翻译引擎的结果。',
    'client:#/materials': '素材库：常用图片、话术放这里，聊天时直接取。',
    'client:#/e/char_logs': '字符日志：每次翻译花了多少字，都记在这里，方便对账。',
    'client:#/e/recharges': '充值记录：套餐和字符的购买流水。',
    'client:#/wallet': '钱包：本地记账的余额，充值、扣减都在这里。',
    'client:#/e/wallet_logs': '钱包流水：每一笔加钱扣钱的明细。',
    'client:#/billing': '套餐购买：选字符包或端口包，报价 5 分钟有效，重复点不会重复扣款。',
    'client:#/e/staff': '子账号：给员工开小号，不用把主账号密码给出去。',
    'client:#/org': '组织架构：角色、权限、成员、部门树。决定谁能看会话、谁能群发、谁能动钱包。',
    'client:#/oplogs': '操作日志：谁在什么时候干了什么，出了问题能倒查。',
    'client:#/e/tickets': '工单：把要跟进的事写成工单，分状态和备注。',
    'client:#/e/clue_records': '线索记录：把客户咨询、跟进、成交、流失按条记下来。',
    'client:#/e/behaviors': '行为控制：限速、关键词拦截、免打扰时段这些规则在这里开关。',
    'client:#/e/shared_numbers': '号池共享：把一批客服号用共享码借给别的系统用。',
    'client:#/settings': '设置：翻译网关、模型、账号相关配置都在这里改。',

    // 管理后台
    'admin:#/': '概览：后台总览，今天多少访问、多少拦截、多少转化，一眼看全。',
    'admin:#/cloak': '斗篷管理：给落地页装门卫。按国家、语言、ASN、浏览器、时区决定谁能看页面。',
    'admin:#/e/domains': '绑定域名：把落地页挂到自己的域名上。',
    'admin:#/pages-hub': '创建落地页：从零建一个新页面。',
    'admin:#/clone': '一键仿站：输入别人的网址，把页面结构和图片 CSS 抓下来，改成自己的。',
    'admin:#/upload': '上传源码：把自己写好的 HTML/图片直接传上来当落地页。',
    'admin:#/e/pages': '落地页列表：所有页面的访问、转化、编辑入口。',
    'admin:#/stats': '统计访问：按天看每个页面来了多少人。',
    'admin:#/e/forms': '表单留资：访客在页面填的姓名、电话、留言，都在这里。',
    'admin:#/e/templates': '模版库：现成页面模板，拿来改字就能用。',
    'admin:#/e/events': '事件管理：告诉广告平台“这条广告带来了一次转化”。配置像素、回传地址、手动测试。',
    'admin:#/e/s2s': 'TrafficStars S2S：服务器对服务器的回传，不经过访客浏览器。',
    'admin:#/e/audiences': '受众同步：把客户邮箱/手机号加密后同步到 Meta 自定义受众，做广告再营销。',
    'admin:#/e/tracking': '数据追踪：每个落地页访问→点击→留资→转化的漏斗和事件流。',
    'admin:#/attribution': '归因分析：看转化是从哪个广告、哪个来源来的。',
    'admin:#/identity': '身份图谱：把同一个人的多次访问认出来，按 IP+浏览器合并。',
    'admin:#/openchat': '开口广告回传：只有访客真的开口说话了才回传，不只是点了链接。',
    'admin:#/shunt/custom/all': '自定义链接分流：一条投放链接，按权重随机分给不同客服或页面。',
    'admin:#/shunt/stable/WhatsApp': 'WhatsApp 稳定分流：把 WhatsApp 客服号轮流分给访客。',
    'admin:#/shunt/stable/LINE': 'LINE 稳定分流：同上，只是换成 LINE。',
    'admin:#/shunt/stable/Telegram': 'Telegram 稳定分流：同上，换成 Telegram。',
    'admin:#/shunt/stable/Kakao': 'Kakao 稳定分流：同上，换成 KakaoTalk。',
    'admin:#/shunt/fast/WhatsApp': 'WhatsApp 极速分流：让访客以最快方式打开对应客服的聊天窗口。',
    'admin:#/fast': '极速分流工单：自动从号池抓号、定时补号、离线自动停用，不用人盯着加号。',
    'admin:#/e/admin_staff': '员工号：后台子账号和权限。',
    'admin:#/meta': 'Facebook 自动化投放：连上 Meta 令牌后，直接在这里建广告系列。',
    'admin:#/docs': '使用文档：后台功能说明。',
    'admin:#/ai': 'AI 工坊：让 AI 帮你写广告文案。没配模型密钥会明确提示未配置。',
    'admin:#/e/ai_assets': '素材库：AI 生成或上传的素材。',
    'admin:#/ai-settings': 'AI 设置：模型、密钥、生成参数。',
    'admin:#/membership': '会员：当前套餐、额度和到期时间。',
    'admin:#/tool/cloner': '仿站任务台：仿站任务排队、抓取进度、确认入库、丢弃。',
    'admin:#/tool/editor': '页面编辑器：改页面源码、预览、版本回滚、配置表单字段。',
    'admin:#/tool/entities': '数据管理：后台所有数据表的通用增删入口。',

    // 独立页面
    'cloak': '斗篷管理：给落地页装门卫。先按 IP/国家/ASN 拦一道，再按语言、浏览器、时区细分。白名单直接放行。',
    'openchat': '开口广告回传：只有访客真的给客服发了第一条消息才算转化，不是点了链接就算。',
    'events': '事件管理：配置广告回传事件、手动测试、看日志、做自检。出问题先点“一键诊断”。',
    'fast': '极速分流工单：绑定共享码后，定时从号池抓号进分流池，重复号自动跳过，离线号自动停用。',
    'identity': '身份图谱：把同一 IP+浏览器的访问合成一个身份，看谁反复来过。',
    'tracking': '数据追踪：当天访问、点击、留资、转化四个数，外加每一条事件明细。',
    'cloner': '仿站任务台：输入网址创建仿站任务，抓完确认入库，再进编辑器改。',
    'editor': '页面编辑器：改源码、看预览、回滚版本、配置留资表单。',
    'entities': '数据管理：按数据表直接增删，适合排查和补数据。',
    'ipdb': '本地 IP 库：查 IP 属于哪个国家、哪家运营商。数据在本地，不用每次都问外部接口。',
  };

  const LABEL = {
    '邀请码列表': '邀请码：进系统的门票。新建邀请码给别人，他拿码就能登录客户端。',
    '账号列表': '账号列表：把 WhatsApp、LINE 这些客服号挂进来，像把几部手机放进同一个收银台。',
    '线索管理': '线索：还没成交的潜在客户。把咨询过的人按条记下来，方便跟进。',
    '底库管理': '底库：联系人和客户的总仓库，支持搜索、导入、去重。',
    '分流链接': '分流链接：一条投放链接，按顺序或随机分给不同客服，避免所有人都挤同一个号。',
    '开口回传': '开口回传：只有访客真的开口说话了才算转化，不是点了链接就算。',
    '号池共享': '号池共享：把一批客服号用共享码借给别的系统用。',
    '代理IP管理': '代理 IP：给不同账号配不同网络出口，避免所有号挤一个 IP。',
    'WhatsApp API': 'WhatsApp API：给开发者用的接口，让别的程序也能读写会话和联系人。',
    '客户管理': '客户管理：给每个客户记备注、打标签，方便回头跟进。',
    '线索记录': '线索记录：把客户咨询、跟进、成交、流失按条记下来。',
    '行为控制': '行为控制：限速、关键词拦截、免打扰时段这些规则在这里开关。',
    '会话中心': '会话中心：所有平台的消息都挤在这一个窗口回，不用来回切软件。',
    '标签管理': '标签：给客户贴颜色标签，比如“重点”“已付款”。',
    '敏感词监控': '敏感词监控：聊天里出现指定词就提醒，方便主管发现问题。',
    '素材管理': '素材库：常用图片、话术放这里，聊天时直接取。',
    '快捷回复': '快捷回复：把常用话术存起来，一键发送，不用每次重打。',
    '自动回复': '自动回复：设关键词和回复语。客户一问“价格”，机器人先答一句。',
    '粉丝分析': '粉丝分析：看粉丝按天涨了多少、哪个平台最多。',
    '群组管理': '群组管理：把客服号按组归类，方便批量操作。',
    '权限管理': '权限管理：决定员工能看哪些功能、能不能群发、能不能动钱包。',
    '数据看板': '数据看板：今天的会话、联系人、翻译用量，一眼看全。',
    '操作日志': '操作日志：谁在什么时候干了什么，出了问题能倒查。',
    '钱包': '钱包：本地记账的余额，充值、扣减都在这里。',
    '组织架构': '组织架构：角色、权限、成员、部门树，决定每个人能干什么。',
    '购买套餐': '套餐购买：选字符包或端口包，报价 5 分钟有效，重复点不会重复扣款。',
    '工单': '工单：把要跟进的事写成工单，分状态和备注。',
    '设置': '设置：翻译网关、模型、账号相关配置都在这里改。',
  };

  function currentKey() {
    const b = document.body;
    if (b.dataset.help) return b.dataset.help;
    const realm = b.dataset.realm;
    if (realm) return realm + ':' + (location.hash || '#/');
    return null;
  }

  function show(title, text) {
    const old = document.getElementById('scrm-help-pop');
    if (old) old.remove();
    const d = document.createElement('div');
    d.id = 'scrm-help-pop';
    d.className = 'help-pop';
    d.innerHTML = `<div class="help-pop-head"><b>${title}</b><button class="help-x">×</button></div><div class="help-pop-body">${text}</div>`;
    document.body.appendChild(d);
    d.querySelector('.help-x').onclick = () => d.remove();
    setTimeout(() => {
      const close = (e) => { if (!d.contains(e.target)) { d.remove(); document.removeEventListener('click', close); } };
      document.addEventListener('click', close);
    }, 0);
  }

  function explain(key) {
    const k = currentKey();
    const text = TEXT[k] || '这里是对应功能的操作页。点菜单可以切换功能；拿不准就先点旁边的问号看说明。';
    show('这是干什么的', text);
  }

  function injectNav() {
    document.querySelectorAll('aside a.item, a').forEach((a) => {
      if (a.querySelector('.help-q')) return;
      const label = a.textContent.replace('?', '').replace(/\s+/g, ' ').trim();
      if (!a.matches('aside a.item') && !LABEL[label]) return;
      const href = a.getAttribute('href') || '';
      const realm = document.body.dataset.realm || '';
      const key = realm + ':' + href;
      const q = document.createElement('span');
      q.className = 'help-q';
      q.textContent = '?';
      q.title = '这个功能是干什么的';
      q.onclick = (e) => {
        e.preventDefault(); e.stopPropagation();
        show(label || '功能说明', LABEL[label] || TEXT[key] || '这是「' + label + '」的操作页，进去可以新增、编辑、删除或查看数据。');
      };
      a.appendChild(q);
    });
  }

  function injectStandalone() {
    const key = document.body.dataset.help;
    if (!key) return;
    const btn = document.createElement('button');
    btn.className = 'help-float';
    btn.textContent = '?';
    btn.title = '这个页面是干什么的';
    btn.onclick = () => explain(key);
    document.body.appendChild(btn);
  }

  function boot() {
    injectStandalone();
    const obs = new MutationObserver(() => injectNav());
    obs.observe(document.body, { childList: true, subtree: true });
    injectNav();
    window.addEventListener('hashchange', injectNav);
    if (new URLSearchParams(location.search).get('helpdemo') === '1') {
      setTimeout(() => {
        const q = document.querySelector('aside a.item .help-q') || document.querySelector('a .help-q') || document.querySelector('.help-float');
        if (q) q.click();
      }, 1200);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
