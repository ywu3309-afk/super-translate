// schema.js — 两个站点的实体定义（服务端建表 + 前端自动渲染表单都用这一份）
'use strict';

const S = (name, label, type = 'text', opts = {}) => Object.assign({ name, label, type }, opts);

// 通用字段：id / user_id / created_at 由服务端维护
const ENTITIES = {
  // ---------------- chm123 客户端 ----------------
  codes: {
    realm: 'client', label: '邀请码', icon: '🔑',
    fields: [
      S('code', '邀请码', 'text', { required: true }),
      S('plan', '套餐', 'select', { options: ['字符版', '端口版', '试用版', '旗舰版'] }),
      S('char_quota', '字符额度', 'number', { default: 20000 }),
      S('chars_used', '已用字符', 'number', { readonly: true }),
      S('expire_at', '到期时间', 'date'),
      S('note', '备注'),
    ],
  },
  accounts: {
    realm: 'client', label: '平台账号', icon: '👤',
    fields: [
      S('platform', '平台', 'select', { options: ['WhatsApp', 'Telegram', 'LINE', 'LINE Business', 'LINE Works', 'Zalo', 'TikTok', 'Instagram', 'Facebook', 'Messenger', 'X', 'Meta', 'Discord', 'LinkedIn', 'Snapchat', 'BoTim', 'GoogleVoice', 'Skype'] }),
      S('name', '账号名', 'text', { required: true }),
      S('proxy', '代理'),
      S('status', '状态', 'select', { options: ['online', 'offline', 'banned'] }),
      S('last_seen', '最近在线', 'text', { readonly: true }),
    ],
  },
  leads: {
    realm: 'client', label: '线索', icon: '🎯',
    fields: [
      S('name', '姓名'), S('contact', '联系方式'),
      S('platform', '来源平台', 'select', { options: ['WhatsApp', 'Telegram', 'LINE', 'Zalo', 'TikTok', 'Facebook', 'Instagram', '其他'] }),
      S('source', '来源'), S('status', '状态', 'select', { options: ['new', 'following', 'won', 'lost'] }),
      S('note', '备注', 'textarea'),
    ],
  },
  links: {
    realm: 'client', label: '分流链接', icon: '🔗',
    fields: [
      S('code', '短码', 'text', { required: true }),
      S('platform', '平台', 'select', { options: ['WhatsApp', 'LINE', 'Telegram', 'Kakao', '自定义'] }),
      S('mode', '模式', 'select', { options: ['stable', 'fast'] }),
      S('targets', '目标（一行一个）', 'textarea'),
      S('clicks', '点击', 'number', { readonly: true }),
      S('created_at', '创建时间', 'text', { readonly: true }),
    ],
  },
  postbacks: {
    realm: 'client', label: '回传', icon: '📤',
    fields: [
      S('event', '事件'), S('platform', '平台', 'select', { options: ['WhatsApp', 'LINE', 'Telegram', 'Kakao'] }),
      S('url', '回传地址'), S('status', '状态', 'select', { options: ['pending', 'sent', 'failed'] }),
    ],
  },
  proxies: {
    realm: 'client', label: '代理', icon: '🌐',
    fields: [S('url', '代理地址'), S('country', '国家'), S('status', '状态', 'select', { options: ['unknown', 'ok', 'fail'] }), S('latency', '延迟ms', 'number')],
  },
  wa_numbers: {
    realm: 'client', label: 'WhatsApp 号码', icon: '📱',
    fields: [S('number', '号码'), S('status', '状态', 'select', { options: ['active', 'pending', 'banned'] }), S('quality', '质量', 'select', { options: ['green', 'yellow', 'red'] })],
  },
  customers: {
    realm: 'client', label: '客户', icon: '🧑‍💼',
    fields: [
      S('name', '姓名'), S('platform', '平台'), S('contact', '联系方式'), S('tags', '标签'),
      S('nickname', '昵称备注'), S('phone', '电话'), S('address', '地址'), S('birthday', '生日'),
      S('gender', '性别'), S('note', '备注', 'textarea'), S('country', '国家'),
      S('customer_value', '客户价值'), S('sales_stage', '销售阶段'), S('social_source', '社媒来源'),
      S('company_name', '公司名称'), S('job_title', '职位'), S('website', '网站'), S('company_size', '规模'),
      S('company_phone', '公司电话'), S('company_email', '公司邮箱'), S('company_address', '公司地址'),
      S('last_msg', '最近消息', 'textarea', { readonly: true }),
    ],
  },
  tags: { realm: 'client', label: '标签', icon: '🏷️', fields: [S('name', '标签名'), S('color', '颜色', 'color', { default: '#6366f1' })] },
  sensitive: { realm: 'client', label: '敏感词', icon: '⚠️', fields: [S('word', '词'), S('level', '级别', 'select', { options: ['high', 'mid', 'low'] }), S('action', '动作', 'select', { options: ['replace', 'block', 'notify'] })] },
  quick: { realm: 'client', label: '快捷回复', icon: '⚡', fields: [S('title', '标题'), S('content', '内容', 'textarea')] },
  keywords: { realm: 'client', label: '关键词回复', icon: '🤖', fields: [S('keyword', '关键词'), S('reply', '回复', 'textarea'), S('match', '匹配', 'select', { options: ['exact', 'contains'] })] },
  welcome: { realm: 'client', label: '欢迎语', icon: '👋', fields: [S('name', '名称'), S('platform', '平台'), S('content', '内容', 'textarea'), S('enabled', '启用', 'select', { options: ['1', '0'] })] },
  broadcasts: { realm: 'client', label: '群发任务', icon: '📢', fields: [S('name', '任务名'), S('content', '内容', 'textarea'), S('platform', '平台'), S('status', '状态', 'select', { options: ['draft', 'running', 'done'] }), S('sent', '已发', 'number', { readonly: true })] },
  materials: { realm: 'client', label: '素材', icon: '🖼️', fields: [S('name', '名称'), S('kind', '类型', 'select', { options: ['image', 'video', 'doc'] }), S('url', '地址')] },
  char_logs: { realm: 'client', label: '字符日志', icon: '📊', readonly: true, fields: [S('kind', '类型'), S('engine', '引擎'), S('src_chars', '字符', 'number'), S('created_at', '时间')] },
  recharges: { realm: 'client', label: '充值记录', icon: '💳', fields: [S('amount', '金额', 'number'), S('method', '方式', 'select', { options: ['USDT', '支付宝', '微信'] }), S('status', '状态', 'select', { options: ['pending', 'paid', 'failed'] })] },
  staff: { realm: 'client', label: '子账号', icon: '👥', fields: [S('account', '账号'), S('password', '密码'), S('role', '角色', 'select', { options: ['admin', 'staff'] }), S('status', '状态', 'select', { options: ['active', 'disabled'] })] },
  oplogs: { realm: 'client', label: '操作日志', icon: '📝', readonly: true, fields: [S('action', '动作'), S('detail', '详情'), S('ip', 'IP'), S('created_at', '时间')] },
  tickets: { realm: 'client', label: '工单', icon: '🎫', fields: [S('title', '标题'), S('content', '内容', 'textarea'), S('status', '状态', 'select', { options: ['open', 'processing', 'closed'] })] },
  clue_records: { realm: 'client', label: '线索记录', icon: '🧾', fields: [S('contact', '联系方式'), S('kind', '类型', 'select', { options: ['咨询', '跟进', '成交', '流失'] }), S('content', '内容', 'textarea'), S('status', '状态', 'select', { options: ['new', 'following', 'done'] })] },
  behaviors: { realm: 'client', label: '行为控制', icon: '🎛️', fields: [S('name', '规则名'), S('kind', '类型', 'select', { options: ['rate_limit', 'keyword_block', 'auto_reply', 'quiet_hours'] }), S('config', '配置 JSON', 'textarea'), S('enabled', '启用', 'select', { options: ['1', '0'] })] },
  wallet_logs: { realm: 'client', label: '钱包流水', icon: '🪙', readonly: true, fields: [S('kind', '类型'), S('amount', '金额', 'number'), S('balance_after', '余额', 'number'), S('note', '备注')] },

  // ---------------- AdMingcat 广告面板 ----------------
  pages: {
    realm: 'admin', label: '落地页', icon: '📄',
    fields: [
      S('name', '名称', 'text', { required: true }),
      S('slug', '路径', 'text', { required: true }),
      S('template', '模板', 'select', { options: ['blank', 'watch', 'beauty', 'app', 'crypto'] }),
      S('status', '状态', 'select', { options: ['draft', 'live'] }),
      S('html', '页面 HTML', 'html'),
      S('views', '访问', 'number', { readonly: true }),
      S('conversions', '转化', 'number', { readonly: true }),
    ],
  },
  templates: {
    realm: 'admin', label: '模板', icon: '🧩',
    fields: [S('name', '名称'), S('category', '分类', 'select', { options: ['watch', 'beauty', 'app', 'crypto', 'rep'] }), S('html', 'HTML', 'html')],
  },
  cloak_rules: {
    realm: 'admin', label: '斗篷规则', icon: '🕵️',
    fields: [
      S('name', '规则名', 'text', { required: true }),
      S('enabled', '启用', 'select', { options: ['1', '0'] }),
      S('action', '动作', 'select', { options: ['block', 'allow', 'redirect', 'review'] }),
      S('target', '跳转地址'),
      S('review_days', '审核期(天)', 'number', { default: 0 }),
      // IP / 域名 / UA / Referer / Cookie
      S('ip_mode', 'IP 过滤', 'select', { options: ['off', 'black', 'white'] }),
      S('ip_list', 'IP 列表', 'textarea'),
      S('domain_mode', '域名过滤', 'select', { options: ['off', 'black', 'white'] }),
      S('domains', '域名列表', 'textarea'),
      S('ua_mode', 'UA 过滤', 'select', { options: ['off', 'black', 'white'] }),
      S('ua_list', 'UA 关键词', 'textarea'),
      S('referer_mode', 'Referer 过滤', 'select', { options: ['off', 'black', 'white'] }),
      S('referers', 'Referer 列表', 'textarea'),
      S('cookie_mode', 'Cookie 过滤', 'select', { options: ['off', 'black', 'white'] }),
      S('cookies', 'Cookie 名称/值', 'textarea'),
      // 地理 / 设备 / 系统 / 语言
      S('country_mode', '地理位置', 'select', { options: ['off', 'black', 'white'] }),
      S('countries', '国家代码', 'text'),
      S('device', '设备', 'select', { options: ['any', '手机', '平板', '电脑'] }),
      S('os_list', '操作系统', 'text'),
      S('languages', '系统语言', 'text'),
      // VPN / 代理检测
      S('vpn_flags', 'VPN/代理检测', 'text', { default: '' }),
      // 进阶条件
      S('asn_list', 'ASN 列表', 'textarea'),
      S('browsers', '浏览器/App 列表', 'textarea'),
      S('inapp_block', '应用内浏览器', 'select', { options: ['0', '1'] }),
      S('cn_device', 'CN 中文设备', 'select', { options: ['0', '1'] }),
      S('crawler_block', '已知爬虫/自动化 UA', 'select', { options: ['0', '1'] }),
      S('no_click_param', '无广告点击参数', 'select', { options: ['0', '1'] }),
      S('repeat_limit', '重复访问阈值', 'number'),
      S('js_challenge', 'JS 反爬校验', 'select', { options: ['0', '1'] }),
      S('icloud_relay', 'iCloud 私人中继', 'select', { options: ['0', '1'] }),
      S('residential_only', '仅允许住宅 IP', 'select', { options: ['0', '1'] }),
      S('land_type', '落地页类型', 'select', { options: ['', 'landing', 'external', 'postback'] }),
      S('land_value', '落地页/URL', 'text'),
      S('tz_gate', '时区门', 'select', { options: ['0', '1'] }),
      S('tz_zones', '拦截时区', 'textarea', { default: 'Asia/Shanghai,Asia/Chongqing,Asia/Harbin,Asia/Urumqi,PRC' }),
      // 流量限制（空=不限）
      S('limit_min', '每分钟', 'number'),
      S('limit_hour', '每小时', 'number'),
      S('limit_day', '24小时', 'number'),
      S('limit_total', '总流量', 'number'),
      // 时段
      S('sched_start', '开始时间'),
      S('sched_end', '结束时间'),
      S('sched_tz', '时区'),
      S('sched_days', '生效日（1-7 逗号）'),
    ],
  },
  cloak_logs: { realm: 'admin', label: '拦截日志', icon: '📋', readonly: true, fields: [S('page', '页面'), S('ip', 'IP'), S('country', '国家'), S('ua', 'UA'), S('action', '动作'), S('created_at', '时间')] },
  domains: { realm: 'admin', label: '域名', icon: '🌍', fields: [S('domain', '域名'), S('status', '状态', 'select', { options: ['pending', 'verified'] }), S('token', '校验 TXT', 'text', { readonly: true })] },
  events: { realm: 'admin', label: '回传事件', icon: '🎯', fields: [S('name', '事件名'), S('platform', '平台', 'select', { options: ['TrafficStars', 'Meta', 'Google', 'TikTok'] }), S('postback_url', '回传地址'), S('pixel_id', '像素 ID'), S('token', '访问令牌'), S('event_type', '回传事件', 'select', { options: ['Lead', 'Purchase', 'Contact', 'CompleteRegistration'] }), S('landing', '关联落地页'), S('status', '状态', 'select', { options: ['active', 'paused'] })] },
  audiences: { realm: 'admin', label: '受众', icon: '👥', fields: [S('name', '受众名'), S('platform', '平台'), S('size', '规模', 'number'), S('ad_account', '广告账户'), S('remote_id', '远端受众 ID', 'text', { readonly: true }), S('synced_at', '同步时间', 'text', { readonly: true }), S('last_error', '最近错误', 'text', { readonly: true })] },
  tracking: { realm: 'admin', label: '追踪', icon: '📈', fields: [S('name', '名称'), S('code', '短码'), S('target', '落地页路径'), S('source', '来源'), S('medium', '媒介'), S('campaign', 'campaign'), S('clicks', '点击', 'number', { readonly: true })] },
  s2s: { realm: 'admin', label: 'S2S 回传', icon: '🔁', fields: [S('platform', '平台', 'select', { options: ['TrafficStars', 'Meta', 'Google', 'TikTok'] }), S('event', '事件'), S('url', '回传地址（可用 {click_id}）'), S('status', '状态', 'select', { options: ['active', 'paused'] })] },
  openchat: { realm: 'admin', label: '开口回传', icon: '💬', fields: [S('name', '名称'), S('platform', '平台', 'select', { options: ['WhatsApp', 'LINE', 'Telegram', 'Kakao'] }), S('invite_code', '邀请码'), S('event', '事件'), S('status', '状态', 'select', { options: ['active', 'paused'] })] },
  identity_links: { realm: 'admin', label: '身份关联', icon: '🕸️', fields: [S('contact', '联系方式'), S('platform', '平台'), S('external_id', '外部 ID'), S('note', '备注')] },
  meta_accounts: { realm: 'admin', label: 'Meta 账户', icon: '📘', fields: [S('account_id', '广告账户'), S('name', '名称'), S('status', '状态', 'select', { options: ['active', 'disabled'] }), S('spend', '花费', 'number')] },
  meta_campaigns: { realm: 'admin', label: 'Campaign', icon: '📣', fields: [S('name', '名称'), S('account_id', '账户'), S('objective', '目标', 'select', { options: ['OUTCOME_TRAFFIC', 'OUTCOME_LEADS', 'OUTCOME_SALES'] }), S('budget', '预算', 'number'), S('status', '状态', 'select', { options: ['PAUSED', 'ACTIVE'] })] },
  meta_ads: { realm: 'admin', label: '广告', icon: '🖼️', fields: [S('name', '名称'), S('campaign_name', 'Campaign'), S('creative', '素材'), S('status', '状态', 'select', { options: ['PAUSED', 'ACTIVE'] })] },
  clone_jobs: { realm: 'admin', label: '仿站任务', icon: '🧬', readonly: true, fields: [S('url', '源地址'), S('page', '生成页面'), S('status', '状态'), S('created_at', '时间')] },
  notifications: { realm: 'admin', label: '通知', icon: '🔔', fields: [S('title', '标题'), S('content', '内容', 'textarea'), S('level', '级别', 'select', { options: ['info', 'warn', 'error'] }), S('read', '已读', 'select', { options: ['0', '1'] })] },
  templates: { realm: 'admin', label: '模板', icon: '📄', fields: [S('name', '名称'), S('category', '分类'), S('content', '内容', 'textarea')] },
  shunt: { realm: 'admin', label: '分流链接', icon: '🔀', fields: [S('code', '短码'), S('platform', '平台', 'select', { options: ['WhatsApp', 'LINE', 'Telegram', 'Kakao'] }), S('mode', '模式', 'select', { options: ['stable', 'fast'] }), S('targets', '目标（一行一个）', 'textarea'), S('clicks', '点击', 'number', { readonly: true })] },
  ai_assets: { realm: 'admin', label: 'AI 素材', icon: '✨', readonly: true, fields: [S('kind', '类型'), S('prompt', '提示词'), S('content', '结果', 'textarea'), S('created_at', '时间')] },
  forms: { realm: 'admin', label: '表单留咨', icon: '📨', readonly: true, fields: [S('page', '页面'), S('name', '姓名'), S('contact', '联系方式'), S('message', '留言', 'textarea'), S('created_at', '时间')] },
  admin_tickets: { realm: 'admin', label: '工单', icon: '🎫', fields: [S('title', '标题'), S('content', '内容', 'textarea'), S('status', '状态', 'select', { options: ['open', 'processing', 'closed'] })] },
  admin_staff: { realm: 'admin', label: '员工号', icon: '👥', fields: [S('account', '账号'), S('role', '角色', 'select', { options: ['owner', 'admin', 'staff'] }), S('status', '状态', 'select', { options: ['active', 'disabled'] })] },
};

module.exports = { ENTITIES };
