# Super Translate × SCRM 分层接入

原则：不复制原项目的 `main.js` 单体，不复制 `app-main.html` 整页。按依赖顺序一层层接。

## L1 纯模块层（已接入）

位置：`super-translate-merged/src/integrations/`

| 文件 | 来源 | 作用 | 状态 |
|---|---|---|---|
| `scrm-proxy.js` | 原项目 `src/scrm-proxy.js` | 代理字符串解析，socks/http/https、账号密码 | 已复制，解析已测 |
| `scrm-proxy-test.js` | 原项目 `src/scrm-proxy-test.js` | 代理连通性测试 | 已复制，语法通过 |
| `scrm-settings.js` | 原项目 `src/scrm-settings.js` | 原子写设置文件 | 已复制，语法通过 |
| `scrm-zoom.js` | 原项目 `src/scrm-zoom.js` | 缩放范围与设置键 | 已复制，语法通过 |

这一层不依赖 Electron，可以先独立跑，再接主进程。

## L2 主进程桥接层（下一层）

原项目 `src/main.js` 里可拆出的能力：

- `ViewManager`（约 682 行起）：`open / close / hide / show / exec / setProxy / capture`
- 代理应用：`_applySessionProxy`、本地 socks 中转
- 指纹 IPC：`fp:save` / `fp:get` / `fp:setCurrent`
- 平台表：`PLATFORMS`（约 683 行）

接入目标：`super-translate-merged/src/desktop.js`

做法：保留 Super Translate 现有 `createView/destroyView`，只把原项目的 `exec / capture / proxy / fingerprint` 能力补进去，不整体替换。

## L3 平台 preload 层

原项目：`src/*-preload.js`（WhatsApp、Telegram、LINE、Zalo、TikTok、Instagram、Facebook、X、Messenger、Snapchat、Discord、LinkedIn 等）

不能直接覆盖 Super Translate 的 `wa-preload.js`，因为现有文件已经包含翻译、语音、联系人备注逻辑。做法：

1. 先选一个平台做试点（Telegram 或 Zalo）。
2. 建 `bridge shim`，把原项目 preload 依赖的 `__scrm_*`、`exec`、`setProxy`、`translate` 接口映射到 Super Translate 的 IPC。
3. 试点通过后再批量迁移其余平台。

## L4 webapp 业务层

原项目：`webapp/server.js`、`schema.js`、`public/`

已接入：`super-translate-merged/scrm/`

注意：接口分两套：

- `/api/app/*`：客户统计、AI 规则、备忘录、设备会话
- `/api/client/*`：快捷回复实体、群发任务、联系人实体

前端调用已经按两套路径修正。

## L5 UI 面板层

原项目：`webapp/public/app-main.html`（约 1.9MB 单页）

不整页嵌入。按面板逐个迁移：

- 已迁移：AI 智能回复、客户画像、联系人、风控、指纹、网络、刷新、群发、快捷回复、关键词
- 待迁移：原厂剩余平台专属面板、部分统计图表

## 验收顺序

1. L1 单元测试：代理解析、设置读写、缩放边界
2. L2 代理测试 + 指纹保存/读取
3. L3 单个平台打开、登录、收发一条消息
4. L3 其余平台
5. L4 快捷回复/群发/备忘录端到端
6. L5 逐面板视觉回归

## 当前边界

- 原项目 `main.js` 是单体，不能直接 require 到 Super Translate。
- 原项目 preload 依赖的宿主桥接不是现成的，必须先写 shim。
- 原项目 AI 线路走服务器 `/tp/*`，客户端没有 Key，不能当作免费接口。
