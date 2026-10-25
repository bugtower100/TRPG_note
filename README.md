<p align="center"><img src="./public/mascot.png" width="190" alt="TRPG 模组笔记吉祥物"></p>

<h1 align="center">TRPG 模组笔记</h1>

<p align="center">为 GM 整理模组资料、准备场次，也为团队协作和玩家分享留出空间。</p>

<p align="center">
  <a href="https://github.com/bugtower100/TRPG_note/releases">下载最新版本</a> ·
  <a href="#快速开始">快速开始</a> ·
  <a href="#docker--云端部署">云端部署</a> ·
  <a href="https://github.com/bugtower100/TRPG_note/issues">问题反馈</a>
</p>

> 遇到问题可在应用的「设置 → 官方手册」查找使用说明，也欢迎提交 [Issue](https://github.com/bugtower100/TRPG_note/issues) 或加入反馈 QQ 群 **1032118621**。如果项目对你有帮助，欢迎点个 Star⭐。

## 功能

| 用途 | 可以做什么 |
| --- | --- |
| 模组资料 | 管理角色、怪物、地点、组织、事件、线索和时间线；用富文本、标签、图片和关联内容串起设定。 |
| 跑团现场 | 在工作台集中查看任务、线索、团队笔记和场次，记录准备、现场与复盘。 |
| 可视化整理 | 用关系图、思维导图和地图整理人物关系与地点；地图支持点位、角色与怪物指示物。 |
| 分享与迁移 | 按权限向玩家分享资料，导出完整备份或选择部分资料制作备团包。 |
| 本地与云端 | Windows 桌面版解压即用，也可在 Linux 服务器或 NAS 上用 Docker 部署供浏览器访问。 |

## 快速开始

1. 从 [Releases](https://github.com/bugtower100/TRPG_note/releases) 下载适合系统的版本，解压到独立文件夹。数据保存在程序同文件夹下的 `data` 目录。**请检查自己是否放在单一文件夹下！**
2. 启动程序，登录后创建模组。先建立重要角色、地点和事件，再补充线索与时间线。
3. 开团时打开跑团工作台；需要多人使用时，在「设置 → 官方手册 → 如何联机」查看局域网与远程连接步骤。

设置页的「官方手册」还提供账号与密码、各版块说明、备份与备团包、联机常见问题、手机访问、资源管理和数据库检查等解答。

## 下载与安装

### 普通用户（推荐）
1. 打开 [GitHub Releases](https://github.com/bugtower100/TRPG_note/releases)。
2. Windows 下载 `TRPG模组笔记-版本-windows-amd64.zip` 或对应的 arm64 包；Linux 下载对应架构的 `.tar.gz`；Apple Silicon macOS 下载 `TRPG模组笔记-版本-macos-arm64.zip`。
3. 解压到独立文件夹并启动程序。Windows 发布包同时附带 `数据库检查工具.exe`。

### macOS 终端启动说明
- 如果双击 `TRPG模组笔记.app` 后没有反应，可在终端中手动启动
- macOS 压缩包内已附带 `macOS终端启动说明.txt`，可直接照着操作
- 建议先确认你下载的是 Apple Silicon 对应的 `darwin arm64` 版本
- 当前 macOS 桌面包最低系统版本要求为 `macOS 11.0`
- 建议尽量整段复制命令，不要手打；很多问题都来自少空格、大小写写错或打开了错误的文件夹

给完全不熟悉电脑文件夹和命令行的用户，最简单的理解方式是：
- 先去“下载”文件夹
- 找到解压后的 `TRPG模组笔记-macOS` 文件夹
- 打开它，确认里面有 `TRPG模组笔记.app`
- 再打开终端，整段复制下面的命令

先执行下面这一整段：

```bash
cd ~/Downloads
ls -lah
cd ~/Downloads/"TRPG模组笔记-macOS"
ls -lah
ls -lah "./TRPG模组笔记.app/Contents/MacOS"
chmod +x "./TRPG模组笔记.app/Contents/MacOS/trpg-note"
chmod +x "./TRPG模组笔记.app/Contents/MacOS/trpg-note-launcher"
xattr -dr com.apple.quarantine "./TRPG模组笔记.app"
./TRPG模组笔记.app/Contents/MacOS/trpg-note-launcher
```

如果中途出现 `No such file or directory`，通常说明用户打开的不是正确的解压文件夹，而不是程序本身已经崩了。

启动成功后访问：

```text
http://localhost:8080/web
```

若仍然无法启动，可继续直接运行主程序观察终端报错：

```bash
cd "./TRPG模组笔记.app/Contents/Resources"
BTR_DB_PATH="./data/storage.db" ../MacOS/trpg-note
```

若出现 `Bad CPU type in executable`，通常说明下载了错误架构的版本；Apple Silicon 芯片请使用 `darwin arm64` 包。
若还是失败，请把 `pwd`、`ls -lah` 和终端完整报错一起发给开发者。

### 便携建议
- 建议把 EXE 与备份文件放在同一个专用目录
- 不建议放在系统保护目录（如 `C:\Program Files`）

### Docker / 云端部署
- 已支持通过 Docker 方式部署纯服务端版，不依赖托盘图标
- 推荐直接使用 `ghcr.io` 镜像，适合部署到 NAS、家庭服务器或云主机
- Docker 镜像不再在容器内重复编译，而是直接封装 CI 产出的 `headless` Linux 二进制，并基于 Alpine 运行时镜像发布
- Docker 镜像提供 `linux/amd64` 和 `linux/arm64` 多架构支持

```bash
docker run -d \
  --name trpg-note --restart unless-stopped \
  -p 8080:8080 \
  -v trpg-note-data:/app/data \
  ghcr.io/bugtower100/trpg_note:latest
```

启动后访问：

```text
http://localhost:8080/web
```

在云服务器上访问时，把 `localhost` 换成服务器地址，并检查防火墙和安全组。长期对外使用建议配置域名与 HTTPS 反向代理。`trpg-note-data` 卷保存数据库和上传资源，更新容器前请备份该卷或在应用内导出完整备份。手机端也可通过同一地址在浏览器中打开；详细步骤见「设置 → 官方手册」。

## 如何更新

Windows 用户先从托盘退出旧版并备份原文件夹中的 `data` 目录，再从 Releases 下载新版。只把新版 `TRPG模组笔记.exe` 和 `数据库检查工具.exe` 复制到原程序文件夹，保留原有 `data` 目录。**请检查自己是否放在单一文件夹下！**

Docker 用户先备份挂载到 `/app/data` 的数据卷，拉取新版镜像并重建容器时继续使用原数据卷。详细步骤可在应用的「设置 → 官方手册 → 如何更新」查看。

## 开发与维护

### 环境要求
- Node.js 22、npm（前端构建，与 CI 一致）
- Go 1.25（后端服务，以 `server/go.mod` 为准）
- Windows / Linux / macOS（当前发布目标：windows/amd64、linux/amd64、linux/arm64、darwin/arm64）

### 常用命令

```bash
npm install
npm run dev
npm run build
npm run lint
npm run check
go -C server run .
```

### 构建与发布

```bash
# 1) 构建前端并同步到 Go 内置静态目录
npm run build

# 2) 构建 Windows 桌面版
cd server && go build -o release/TRPG模组笔记.exe
```

项目以根目录 `version.txt` 作为版本号的唯一来源。`npm run build` 会同时把该版本写入 Go 的内嵌资源；发布流水线仍可通过 `-ldflags` 覆盖版本。请先执行前端构建再编译 Go，确保 WebUI 与托盘显示一致。

```bash
# 3) 构建 Linux amd64 版
cd server && GOOS=linux GOARCH=amd64 go build -o release/trpg-note
```

```bash
# 4) 构建 Linux arm64 版
cd server && GOOS=linux GOARCH=arm64 go build -o release/trpg-note
```

```bash
# 5) 构建 macOS Apple Silicon 版
cd server && GOOS=darwin GOARCH=arm64 go build -o release/trpg-note
```

```bash
# 6) 构建 Docker/headless 版
cd server && GOOS=linux GOARCH=amd64 go build -tags headless -o release/trpg-note-headless
```

若需 arm64 headless 版，可将上面的 `GOARCH=amd64` 替换为 `GOARCH=arm64`。

运行方式：
- 双击 `release/TRPG模组笔记.exe` 后，访问托盘弹出的地址或浏览器自动打开的页面
- 若需调试 API，仅运行后端：`go run ./server`，前端开发服：`npm run dev`（已配置 `/api` 代理至 `:8080`）
- 若需容器部署，请使用 `Dockerfile` 或 `ghcr.io` 镜像；容器版本使用 `headless` build tag，不包含托盘依赖

## 常见问题（FAQ）

### Q1：双击 EXE 后浏览器没打开怎么办？
- 先确认安全软件没有拦截本地启动
- 再次启动 EXE，等待几秒
- 如仍失败，尝试管理员身份运行一次

### Q2：如何退出程序？
- 通过系统托盘图标退出，或直接关闭后台进程

### Q3：数据存在哪里？
- 桌面发布包默认保存在程序旁的 `data/storage.db`（SQLite）；Docker 版保存在挂载到 `/app/data` 的数据卷。
- 建议定期导出完整备份，保留数据库和上传图片。

### 数据库检查与简单修复

Windows 普通用户不需要更新主程序。把独立的 `数据库检查工具.exe` 放到现有 `TRPG模组笔记.exe` 同一目录，先从系统托盘彻底退出应用，再双击检查工具。它会自动寻找 `data/storage.db`，显示文件位置、大小和更新时间，先执行只读检查，再引导用户决定是否修复；不需要理解命令行或自行寻找路径。

开发者也可以在项目根目录执行只读检查：

```bash
npm run db:check
```

检查会显示实际数据库绝对路径、文件大小、各表记录数，并检查 SQLite 完整性、迁移元数据、JSON 内容、孤立记录以及模组所有者关系。若要修复可安全自动处理的问题：

```bash
npm run db:repair
```

修复前会先在数据库旁的 `database-doctor-backups` 目录创建一致性备份，然后补回缺失的模组所有者成员关系、修正所有者角色、重建索引并优化数据库。无效 JSON、孤立记录和迁移失败不会被自动删除或覆盖，需把检查输出交给开发者判断。

只构建独立工具（不会改动主程序 EXE）：

```bash
npm run db:doctor:build
```

也可以让独立工具检查其他数据库：

```bash
数据库检查工具.exe --database-path "D:\path\to\storage.db"
数据库检查工具.exe --database-path "D:\path\to\storage.db" --repair --yes
```

### Q4：如何迁移到新电脑？
1. 在旧电脑导出包含资源的完整备份。
2. 在新电脑安装并启动应用，通过「设置 → 备份与导入」恢复。
3. 也可以在完全退出程序后整体迁移程序目录中的 `data` 文件夹。

### Q5：出现异常或数据损坏怎么办？
- 先备份当前数据文件
- 使用项目维护命令进行清理修复

### Q6：macOS 双击 `.app` 没反应怎么办？
- 先确认下载的是 Apple Silicon 对应的 `darwin arm64` 版本
- 先进入解压后的 `TRPG模组笔记-macOS` 目录，再执行 README 上面的 macOS 手动启动命令
- 再访问 `http://localhost:8080/web`
- 如果终端有报错，把完整输出发给开发者排查

## 反馈与支持
- 源码与 Issue：[GitHub 仓库](https://github.com/bugtower100/TRPG_note)
- 反馈 QQ 群：**1032118621**
- 如果项目对你有帮助，欢迎点个 Star 支持。
