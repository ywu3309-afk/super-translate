# 超级翻译

Windows WhatsApp 客服双语工作台。每次发布新版本时，创建一个 `v*` Git tag，GitHub Actions 会在 Windows runner 上构建 NSIS 安装包并同步发布 `exe`、`blockmap` 和 `latest.yml`，客户端的 `electron-updater` 可以据此检查更新。

本仓库通过 GitHub Releases 分发 Windows 安装包，客户端支持检查更新并保留本地资料。

> **发布安全边界（v0.7.2 起）**：Release 工作流只上传 Windows 二进制安装包、`blockmap` 和 `latest.yml`，不再生成或上传 `SuperTranslate-Source-*.zip` 源码归档。工作流会在上传前检查产物清单，发现源码归档时直接终止发布。注意：公开 GitHub 仓库仍会为 tag 自动提供 `Source code (zip/tar.gz)` 下载，并且仓库历史可被读取；因此这不是“不可逆向”保证。正式商用前应将源码仓库设为私有，并使用独立的二进制发布仓库或受限的发布令牌。

## v0.7.26 客户设备探活与多账号登录修复

- 客户账号登录成功后，客户端在 500ms 内向云端发送一次设备心跳，随后每 60 秒发送一次；心跳只携带脱敏的设备指纹、主机/系统/CPU 摘要、客户端版本和本地模型状态，不携带密码、访问令牌或本地路径。
- 云端按客户账号和设备指纹保存多台设备，后台按最近心跳显示在线、延迟、离线及本地模型状态；客户端未安装或未登录 v0.7.26 以前的版本时不会产生设备上报。
- 心跳请求遇到网络故障不会启动重复重连循环；账号被撤销（401/403）时立即停止心跳并清除会话。模型启动、停止和异常会发送最新状态，但不会改变 WhatsApp 发送拦截或译文注入流程。
- 登录页使用 `login-preferences-v2.json` 保存最多 20 个相互独立的账号。新增账号不会覆盖其他账号；取消“记住密码”不会删除其他账号，只有明确点击“删除当前保存账号”才会删除选中的记录。

## v0.7.4 多账号未读提醒、消息 Toast 与多平台翻译

- 三个翻译语言选择器覆盖英语、西班牙语、法语、德语、葡萄牙语、意大利语、阿拉伯语、俄语、土耳其语、荷兰语、波兰语、捷克语、斯洛伐克语、希腊语、阿尔巴尼亚语、泰语、越南语、印尼语、日语、韩语以及简体/繁体中文，并保留旧配置中的印地语和乌克兰语。
- `TrafficCRM_DB/customers` 按纯数字电话号码严格去重，保存首次联系日期、国家、国旗、跟进/成交状态和首次成交时间；数据仅存当前 Windows 用户的 Electron 工作台本地存储。
- “粉丝统计”可按日期查看新增客户、该日新增客户中的成交数、进粉转化率与国家分布，并由用户主动导出带 UTF-8 BOM 的 CSV。
- WhatsApp 输入拦截、实时翻译、译文注入及发送核心实现保持 v0.6.4 的已验证代码片段不变；后续版本只在其外围增加本地联系人列表展示与状态同步能力。
- 登录页已移除免账号进入工作台的入口；正式安装包中的客户和管理员必须通过云端账号服务验证后才能进入工作台。机器本地管理员仅保留给未打包的隔离开发测试，生产版本不会将用户可写的 `local-admin-v1.json` 当作授权依据。
- 登录页提供“记住密码”和“自动登录”。密码只通过 Electron `safeStorage`（Windows DPAPI）按账号分别加密写入当前用户的 `login-preferences-v2.json`，不写入 renderer `localStorage`、日志或明文配置。最多保留 20 个已保存账号；未勾选“记住密码”不会删除其他账号，只有明确点击“删除当前保存账号”才会移除选中的记录。自动登录失败只尝试一次并自动关闭该账号的自动登录；用户主动退出时会关闭全部账号的自动登录，不会循环请求。
- 生产窗口关闭 DevTools 并移除 Chromium 远程调试入口；构建关闭 `ELECTRON_RUN_AS_NODE`、`NODE_OPTIONS` 与 Node inspector 参数，启用 ASAR 完整性校验和 `OnlyLoadAppFromAsar`。Cookie 加密是单向升级，后续版本不得再次关闭，否则现有 WhatsApp Cookie 存储将无法继续使用。
- 安装包外置的 llama.cpp `EXE/DLL` 由 ASAR 内的 SHA-256 清单逐一约束；启动本地模型前会校验文件数量、名称、大小和内容哈希，缺失、增加或替换任一二进制都会停止启动并提示重新安装。
- v0.7.2 为保留现有客户在 `file://` origin 下的 `localStorage`、IndexedDB、内部备注和投流 CRM，暂时保留 `GrantFileProtocolExtraPrivileges` 兼容 fuse；Electron 44 在关闭它后也无法加载当前 ASAR 内的登录页。后续只有在实现并验证 `file://` → 安全自定义协议的一次性数据迁移、确认客户资料与 WhatsApp 状态不丢失后，才能关闭此 fuse。

## 客户账号

登录窗口的 **创建免费账户** 入口可直接在软件内创建云端客户账号，也可切换到浏览器注册页。注册成功后，软件自动切换到客户登录模式并回填用户名；密码不会被回填或写入本地管理员记录。新账户需由管理员在云端后台分配套餐、翻译额度并启用后才能登录工作台。

## 客户主账号与子账号

已授权的客户主账号登录客户端后，打开右侧 **设置中心 → 账号与子账号**，即可查看自己的剩余共享翻译字符和已分配字符，创建最多 3 个子账号。创建时填写子账号用户名、密码和初始字符额度；额度从主账号的云端剩余额度中原子划拨。每个子账号可以在另一台电脑独立登录，使用本地 AI 或超级翻译智能 API 时都扣减自己的额度；额度不足、账号停用、套餐到期都会由云端拒绝翻译。主账号可以设置剩余额度、增加额度、停用/启用或删除子账号，删除时只返还子账号未使用的额度。子账号不能继续创建或管理下一级子账号。

## 本地 AI 模型

在客户端右侧 **设置中心 → 本地 AI 模型** 中任选网盘入口下载 `超级翻译-AI模型-Q4_K_M.zip`。下载完成后点击 **一键导入 / 注入模型**，选择 ZIP 或 GGUF 文件；客户端会自动解压/复制到 `%APPDATA%\\super-translate\\models`、更新模型路径并使用安装包内置的 Windows x64 CPU `llama.cpp` 运行时启动，不需要客户安装 Python、Conda 或手动填写 Python 路径。模型运行在 `127.0.0.1`，WhatsApp 消息不会上传到模型下载服务。安装包内置运行时约 40 MB，GGUF 模型仍由客户自行下载。

## 本地语音转文字与翻译

Windows 客户端支持“麦克风录音 → 本地 FunASR 识别 → 现有翻译与云端额度裁决 → 人工确认 → 填入当前聊天框”。WhatsApp 中客户发来的语音气泡也会出现“转文字并翻译”按钮：仅在客服明确点击该条语音后读取、在本机转写并翻译为中文；不会批量读取历史语音，不会自动回复或发送。

- 默认语音模型目录：`D:\\SuperTranslate\\SpeechModel\\funasr-1.4.11`
- 默认模型：`SenseVoiceSmall`
- 本地接口：`http://127.0.0.1:18080`
- 服务只绑定 `127.0.0.1`，不开放局域网或公网监听。
- 客户无需单独安装 Python；模型包内的便携 Python、CUDA PyTorch 与依赖由客户端自动启动。
- 套餐过期或额度耗尽时，语音翻译同样被云端授权拦截；翻译成功后按识别文字字符数进入现有原子扣减流程。
- 识别完成后必须点击“填入当前聊天框”，仍由客服人工检查并发送。
- 客户语音最长支持 120 秒；原始音频最大 15 MB，解码后 WAV 最大 25 MB。
- 客户语音的转写与译文按“账号实例 + 聊天 + 消息”隔离，并使用 Windows 安全存储加密缓存；重开会话不会重复识别或重复扣费。

客户可从“语音翻译”中的百度网盘或小飞机网盘下载 `超级翻译-语音转文字AI大模型.zip`，然后点击“一键导入 / 注入语音 AI 模型”并直接选择该 ZIP；软件会校验下载包及其中的两个模型分卷、自动解压、完成配置并安装到固定 D 盘目录。客户不需要手动解压、安装 Python、设置环境变量或运行脚本；从 ZIP 一键安装前需确保 D 盘至少有 26 GB 可用空间。为兼容分卷直传，客户端也接受同一目录中的 `part1.rar` 与 `part2.rar`，该路径至少需要 18 GB 可用空间。

- 百度网盘：`https://pan.baidu.com/s/1mRasLLQRXkz3lVR9uyRgfw?pwd=1013`（提取码 `1013`）
- 小飞机网盘：`https://share.feijipan.com/s/id9Xkbqs`

本地开发机可执行：

```powershell
npm run test:speech-runtime
npm run test:speech-ui
npm run test:incoming-voice
```

第一条命令验证 D 盘运行时、CUDA、本地监听和转写 API；第二条使用 Electron 假麦克风完成录音、识别、翻译和“填入但不发送”的端到端回放；第三条模拟一条 WhatsApp 客户语音，验证单条读取、本地转写、中文翻译、加密缓存恢复、单次扣费及全程零自动发送。

内置运行时来源和校验值记录在 `runtime/llama-cpp/PROVENANCE.txt`；它只提供推理服务，不包含客户的 GGUF 文件。若客户使用非 Windows x64 系统，设置页会明确提示暂不支持，而不会静默执行失败。

## 多平台服务实例

工作台的左侧“添加服务实例”入口支持 WhatsApp、WhatsApp 多功能、Telegram K/Z、Messenger、Facebook 粉丝专页、Instagram Direct、LINE、Zalo、Twitter/X、Discord、Google Voice、TikTok、Snapchat、TextNow 和 Botim。每次创建都会生成不可复用的实例 ID，并由主进程派生独立的 `persist:<instance-id>` Session Partition；Cookie、LocalStorage、IndexedDB 和登录状态不会在不同实例之间串用。原有 WhatsApp `a` / `b` 分区保持兼容，WhatsApp 发送拦截核心仍位于独立的 `src/wa-preload.js`，本次只增加了不参与发送决策的联系人列表国家标签。

### v0.7.18 联系人列表国家归属

- WhatsApp 内部左侧 `#pane-side` 会话列表会直接在联系人名称右侧显示国家归属，例如 `+351 932 046 152 (葡萄牙)`。
- 国家归属只在左侧联系人列表显示，不再重复追加到聊天窗口顶部 Header；顶部仍可保留用户配置的内部别名和备注。
- 国家标签优先使用已确认的 CRM/运行时号码；WhatsApp 切换账号或 React 模型尚未完成 hydration 时，直接从可见的国际号码推断，避免第二个账号登录后标签消失。
- 虚拟列表由独立的 100ms 防抖 `MutationObserver` 监听，重复渲染不会生成重复标签；未识别为国际号码的普通名称不会被误标。

非 WhatsApp 服务通过 `src/platform-preload.js` 使用平台注册表中的输入框、发送按钮和联系人标题选择器，统一提供 400ms 防抖翻译预览、中文发送拦截和安全文本注入。平台 URL 只从 `src/platforms.js` 的主进程白名单选择，渲染进程不能自行指定任意导航地址。删除实例时可选择清理对应 Partition；未勾选时仅移除左侧实例和本机 CRM 联系人，不影响其他账号。

## 发布

```powershell
git add .
git commit -m "release: vX.Y.Z"
git tag vX.Y.Z
git push origin main --tags
```

仅在确认构建和测试通过后创建 tag。Release 页面应只出现以下三类客户交付文件：

- `SuperTranslate-Personal-Setup-<version>.exe`
- `SuperTranslate-Personal-Setup-<version>.exe.blockmap`
- `latest.yml`

不要把源码、测试夹具、`.env`、密钥或本地模型文件加入 Release。客户端自动更新依赖 `latest.yml` 与对应的安装包；安装更新不会覆盖 `%APPDATA%\\super-translate\\`、`%LOCALAPPDATA%\\超级翻译\\` 下的客户资料、WhatsApp 登录态、IndexedDB、内部备注、模型路径或额度缓存。正式发布前应在干净 Windows 环境验证安装包签名/哈希、更新下载和本地资料保留。


### v0.7.4
- 非活动服务实例收到消息时，左侧账号卡片显示持久化未读数字（超过 99 显示 99+）并使用红色呼吸高亮；切换进入后自动清零。
- 非 WhatsApp 平台的浏览器通知通过受信任的 preload 转发为右下角 Toast；Toast 使用纯文本渲染，点击可切换实例，5 秒后自动淡出。WhatsApp 继续使用未改动的 src/wa-preload.js，并由主进程标题未读数轮询提供兜底。
- GitHub Actions 继续以 * tag 自动构建并发布 Windows 安装包、blockmap 与 latest.yml；Hostinger 云端代码和环境变量改为手动上传/配置，不会由客户端自动覆盖服务器数据。
