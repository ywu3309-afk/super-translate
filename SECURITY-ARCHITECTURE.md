# GitHub 仓库隔离说明

## 仓库职责

- `ywu3309-afk/super-translate-source`：私有源代码仓库，只存放源码、测试和构建工作流。
- `ywu3309-afk/super-translate`：公开发布仓库，只作为客户自动更新的 GitHub Releases 渠道。

客户端的 `electron-updater` 继续指向公开发布仓库，因此客户不需要 GitHub 账号即可检查和下载更新。

## 发布桥接

私有仓库的 Windows Release workflow 会构建安装包，然后将以下三个文件发布到公开仓库：

```text
latest.yml
SuperTranslate-Personal-Setup-<version>.exe
SuperTranslate-Personal-Setup-<version>.exe.blockmap
```

跨仓库发布需要在私有仓库的 Actions secrets 中配置：

```text
RELEASE_REPO_TOKEN
```

该 Secret 必须是只允许访问 `ywu3309-afk/super-translate` 的 fine-grained token，并至少拥有该公开仓库的 Contents: Read and write 权限。Token 只能在 GitHub Secret 页面录入，禁止写入源码、客户端、ZIP 或聊天消息。

在配置 Secret 之前，私有仓库可以正常保存和构建源码，但打 tag 时不会自动把 Release 上传到公开仓库。

## 数据保护

- 不上传 Hostinger `.env`、数据库密码、DeepL Key、Session Secret 或客户资料。
- `work/`、`dist/`、`node_modules/` 和本地日志均由 `.gitignore` 排除。
- 公开仓库保持现有 Release，避免已经安装的客户端更新中断。
