# TRPG 模组笔记

TRPG 模组笔记是一款面向主持人（GM）的本地备团工具。  
它采用“**本地 Node 服务 + 浏览器界面**”模式：双击 EXE 后自动启动本地服务并打开浏览器，无需公网、无需数据库服务。

## 架构说明

### 1) 前端层（UI）

- React + TypeScript + Vite
- 负责页面交互、实体编辑、富文本渲染、侧栏并行标签、主题切换
- 开发时通过 `npm run dev` 启动

### 2) 本地服务层（Runtime）

- Node.js + Express（入口：`server/main.cjs`）
- 职责：
  - 启动本地 HTTP 服务
  - 提供存储 API（`/api/storage/*`）
  - 自动打开浏览器到本地地址
  - 在打包模式下静态托管 `dist` 前端资源

### 3) 数据层（Local File）

- 默认存储文件：`data/storage.json`
- 打包 EXE 运行时：优先写入 EXE 同级目录 `data/`
- 开发环境运行时：写入项目目录 `data/`
- 启动时自动做数据归一化与坏数据修复（异常文件会备份为 `.broken.timestamp`）

## 功能清单

- 多模组管理：创建、切换、删除模组
- 实体管理：角色、怪物、地点、组织、事件、线索、时间线
- 区块编辑：
  - 内置区块（可编辑/可收起）
  - 自定义区块（可新增/重命名/删除）
- 富文本能力：关键词识别、快速跳转、右侧标签并行查看
- 时间线特色：事件节点新增、排序、公开状态控制
- 主题系统：默认 / 羊皮纸 / 未来科技 / 自然护眼
- 数据能力：导入、导出、文件打开、坏数据清洗

## 下载与使用（普通用户）

1. 前往 GitHub Releases 下载 `TRPG模组笔记.exe`
2. 将 EXE 放到你希望保存数据的目录（例如 `D:\TRPG`）
3. 双击 EXE，程序会自动打开本地浏览器页面
4. 正常编辑后，数据会写入 EXE 同级 `data/storage.json`

### 首次使用建议

1. 先创建一个测试模组
2. 新建一两个自定义区块试写内容
3. 在富文本里测试关键词联动
4. 导出一份 JSON 作为备份快照

## 数据存储与备份

### 存储路径示例

如果 EXE 在：

`D:\TRPG\TRPG模组笔记.exe`

则默认数据文件在：

`D:\TRPG\data\storage.json`

### 备份建议

- 每次重要编辑后导出一次 JSON
- 版本升级前手动备份 `data/storage.json`
- 可同时保留“导出 JSON + storage.json”双重备份

## 开发者指南

### 环境要求

- Node.js 18+
- npm 9+
- Windows（当前发布目标为 Windows EXE）

### 本地开发

```bash
npm install
npm run dev
```

### 质量检查

```bash
npm run lint
npm run check
npm run build
```

### 本地服务直启（不走 Vite）

```bash
npm run serve:local
```

## 打包与发布

### 打包单文件 EXE

```bash
npm run pack:exe
```

产物目录：

- `release/`

### GitHub Release 自动发布

工作流文件：`.github/workflows/release.yml`

触发方式：

1. 推送标签（如 `v1.0.0`）
2. 或手动触发 `workflow_dispatch`

工作流步骤：

- 安装依赖
- 构建前端
- 打包 Node EXE
- 上传 `release/*.exe` 到 Release

## 运维与维护

### 清理坏数据

```bash
npm run clean:data
```

作用：

- 检查并修复 `data/storage.json` 结构
- 文件损坏时自动备份并重建

### 清理历史缓存

```bash
npm run clean:cache
```

作用：

- 清理历史 Electron 缓存目录（迁移后遗留）

## 常见问题

### 1) 双击 EXE 后没有打开页面

- 检查本地防火墙或安全软件是否拦截本地端口
- 重新运行 EXE，并观察终端日志（若从命令行启动）

### 2) 数据没有保存

- 确认 EXE 所在目录可写
- 避免放在系统受保护目录（如 `C:\Program Files`）

### 3) 迁移旧版本数据

- 可直接导入旧版本导出的 JSON
- 或手动复制旧数据后使用 `npm run clean:data` 做修复
