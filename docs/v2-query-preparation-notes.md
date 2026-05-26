# V2 核心 API 现状

## 当前状态
- `V2` 主模组正式链路已可用，迁移状态、模组列表、bundle、协作读取都已接到后端 API。
- 前端已接入 `OpenAPI + heyapi + TanStack Query` 的基础模型。
- 当前保留本文件，只作为“现在有哪些核心 API、哪些已经进入正式链路”的简表。

## 一、系统迁移 API
- `GET /api/system/migration/status`
  - 用途：启动期检查数据库迁移状态。
  - 当前状态：正式使用中。
- `POST /api/system/migration/start`
  - 用途：显式执行数据库迁移。
  - 当前状态：正式使用中。

## 二、V2 主模组 API
- `GET /api/v2/campaigns`
  - 用途：读取当前用户可见的模组列表。
  - 当前状态：正式使用中。
- `POST /api/v2/campaigns`
  - 用途：创建 V2 模组。
  - 当前状态：正式使用中。
- `DELETE /api/v2/campaigns/{campaignId}`
  - 用途：删除 V2 模组。
  - 当前状态：正式使用中。
- `GET /api/v2/campaigns/{campaignId}/bundle`
  - 用途：读取主模组聚合 bundle。
  - 当前状态：正式使用中。
- `PUT /api/v2/campaigns/{campaignId}/bundle`
  - 用途：保存主模组聚合 bundle。
  - 当前状态：正式使用中。

## 三、协作读取 API
- `GET /api/campaigns/public`
  - 用途：读取公开模组列表。
  - 当前状态：正式使用中。
- `GET /api/campaigns/{campaignId}/config`
  - 用途：读取模组配置与成员信息。
  - 当前状态：正式使用中。
- `GET /api/campaigns/{campaignId}/team-notes`
  - 用途：读取团队笔记列表。
  - 当前状态：正式使用中。
- `GET /api/campaigns/{campaignId}/shares`
  - 用途：读取共享内容列表。
  - 当前状态：正式使用中。
- `GET /api/campaigns/{campaignId}/versions`
  - 用途：读取版本记录。
  - 当前状态：正式使用中。
- `GET /api/campaigns/{campaignId}/session-tasks`
  - 用途：读取任务看板。
  - 当前状态：正式使用中。

## 四、协作写入 API
- `PUT /api/campaigns/{campaignId}/config`
- `POST /api/campaigns/{campaignId}/team-notes`
- `PUT /api/campaigns/{campaignId}/team-notes/{noteId}`
- `DELETE /api/campaigns/{campaignId}/team-notes/{noteId}`
- `POST /api/campaigns/{campaignId}/team-notes/{noteId}/lease/start`
- `POST /api/campaigns/{campaignId}/team-notes/{noteId}/lease/refresh`
- `POST /api/campaigns/{campaignId}/team-notes/{noteId}/lease/end`
- `PUT /api/campaigns/{campaignId}/session-tasks`
- `POST /api/campaigns/{campaignId}/session-tasks/lease/start`
- `POST /api/campaigns/{campaignId}/session-tasks/lease/refresh`
- `POST /api/campaigns/{campaignId}/session-tasks/lease/end`
- `POST /api/campaigns/{campaignId}/shares`
- `DELETE /api/campaigns/{campaignId}/shares/{shareId}`
- `POST /api/campaigns/{campaignId}/shares/{shareId}/lease/start`
- `POST /api/campaigns/{campaignId}/shares/{shareId}/lease/refresh`
- `POST /api/campaigns/{campaignId}/shares/{shareId}/lease/end`
- `PUT /api/campaigns/{campaignId}/shares/{shareId}/content`
- `POST /api/campaigns/{campaignId}/versions/{versionId}/restore-copy`

## 五、当前边界
- 正式数据以服务端 API 为准，不再依赖旧运行期兼容逻辑。
- 前端已保留 service facade，页面层不直接依赖生成客户端。
- `bundle` 仍是当前主模组的聚合契约，不代表最终会长期保持整包接口形态。
