/* __scrmPatchV1__ scrm-patch-lineworks v1 2026-08-30 —— 修"您要注册新账号吗?"点击无反应。
   根因:该链接 <a target="_blank" href="https://join.worksmobile.com/...">→window.open,主进程 setWindowOpenHandler 原把非白名单外链改成当前视图 loadURL,join bridge 在当前视图会弹回登录页。
   修=main.js OAuth 弹窗白名单加 join.worksmobile.com/worksmobile.com(见 [LW-JOIN]),注册页在独立弹窗打开。本补丁留空占位(无需页面侧改)。 */
(function(){ /* no-op: 修复在主进程 */ })();
