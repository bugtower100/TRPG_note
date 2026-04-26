# TRPG_note 改进与设计方案（保持原有架构）

> 目标：为 `TRPG_note` 项目提供可实施的产品与技术改进方案。  
> 约束：不改变原有大架构与核心功能，继续沿用当前技术主线：
> - 前端：React + TypeScript + Vite + Tailwind + Milkdown
> - 后端：Go + Gin + GORM + SQLite
> - 协作：Lease（租约） + Version（乐观锁） + 版本快照
> - 存储：KV JSON 为主

---

## 1. 项目改进原则

### 1.1 不变项（必须保持）
- 不替换前后端技术栈。
- 不推翻 KV 主存储模型。
- 不移除 Lease + expectedVersion 并发机制。
- 不改变“模组/实体/分享/版本恢复”核心能力。

### 1.2 改进方向（可增强）
- 在现有能力上新增“TRPG 场景化功能模块”。
- 在不破坏现有接口的前提下扩展 API 与数据结构。
- 采用“增量迁移 + 可回滚”的交付策略。

### 1.3 设计目标
- GM 备团效率提升（模板化、批量化、可追溯）。
- PL 参与体验提升（揭秘流、任务流、会次视图）。
- 多人协作稳定性提升（冲突可视化、审计可追踪）。
- 大模组性能可控（检索和列表效率）。

---

## 2. 现状与机会点

## 2.1 现状能力（已具备）
- Campaign 维度协作与可见性管理。
- 实体级/区块级/条目级分享（read/edit）。
- Lease + expectedVersion 并发保护。
- 版本记录与 restore-copy。
- 资源上传、去重、批量删除。

### 2.2 主要机会点
- 缺少“TRPG 工作流”原生设计（揭秘、线索推进）。
- 模组初始化成本高，重复搭建结构多。
- 版本冲突后缺少直观合并体验。
- 大体量模组下检索与筛选效率存在天花板。
- 缺少统一备份/恢复运营能力（尤其长期团）。

---

## 3. 功能改进方案（新增模块）

## 3.1 线索板与揭秘流（Clue Board + Reveal Flow）

### 目标
让“线索可见性控制”成为一等功能，避免信息泄露，提高剧情推进节奏。

### 功能范围
- 线索状态：`hidden` / `discoverable` / `revealed` / `deprecated`。
- 揭秘规则：按玩家、按队伍、按条件（例如完成某任务）揭示。
- 揭秘日志：记录“谁在何时揭示了什么”。

### 关键交互
- 实体详情页新增“线索板”Tab。
- GM 可批量切换线索状态。
- PL 仅看到可见状态线索与对应摘要。

### 实施建议
- 在现有实体/section/subItem 元数据扩展字段：
  - `revealState`
  - `revealTargets`
  - `revealAt`
  - `revealedBy`
- 新增 API：
  - `POST /api/campaigns/:id/clues/:clueId/reveal`
  - `POST /api/campaigns/:id/clues/batch-reveal`
  - `GET /api/campaigns/:id/clues?view=gm|pl`
- 复用已有权限系统，GM 拥有 reveal 写权限，PL 仅读。

---

## 3.2 跑团任务看板（GM/PL Todo Board）

### 目标
将“准备/进行/收尾”任务结构化，提升协作执行效率。

### 功能范围
- 看板列：`待准备`、`进行中`、`已完成`。
- 前置依赖：支持“必须先完成 A 才能开始 B”。
- 任务归属：GM 任务、PL 任务、共享任务。
- 会次绑定：任务可挂到具体会次。

### 关键交互
- 看板拖拽改状态（遵循状态机约束）。
- 任务详情显示依赖链和阻塞原因。
- 会后自动推荐“下次优先任务”。

### 实施建议
- 复用已有 Todo 设计思路，新增 `campaign_todos`（或映射到现有 Todo + campaign 维度字段）。
- 新增 API：
  - `GET /api/campaigns/:id/todos/board`
  - `POST /api/campaigns/:id/todos`
  - `PUT /api/campaigns/:id/todos/:todoId/status`

---

## 3.3 导入助手（规则书/模组包导入）

### 目标
支持将外部 Markdown/HTML/文本快速转为可管理实体，减少手工搬运。

### 功能范围
- 批量导入文件。
- 导入映射规则（标题->实体类型、章节->区块）。
- 导入预览（创建哪些实体、哪些标签、哪些资源链接）。

### 实施建议
- 前端增加“导入映射器”向导。
- 后端新增 `import_jobs` 跟踪任务状态。
- 新增 API：
  - `POST /api/campaigns/:id/import/preview`
  - `POST /api/campaigns/:id/import/execute`
  - `GET /api/campaigns/:id/import/jobs/:jobId`

---

## 4. 原框架优化方案（不改架构）

## 4.1 KV + 投影表混合查询（推荐）

### 问题
纯 KV 在复杂筛选（类型、标签、更新时间、可见性）下查询成本偏高。

### 方案
- 保持 KV 为事实存储（source of truth）。
- 新增轻量投影表用于列表和筛选（只存索引字段）。
- 写入流程：KV 成功后，同事务更新 projection。

### 建议投影字段
- `id`, `campaign_id`, `entity_type`, `title`, `tags`, `updated_at`, `visibility`, `owner_id`, `deleted_at`

### 收益
- 列表页、筛选器、统计页性能显著提升。
- 不改变核心数据表达，迁移风险低。

---

## 4.2 检索与索引子系统（异步化）

### 目标
提升跨实体搜索体验，支持后台重建和故障恢复。

### 方案
- 引入索引任务队列表（upsert/delete）。
- 后台 worker 轮询处理，失败指数退避重试。
- 管理接口：状态、重建、单条重建、调试查询。

### 最小可行范围
- 首期只做词法搜索（标题 + 内容 + 标签）。
- 按 Campaign 范围过滤，遵循 ACL 过滤结果。

### 收益
- 搜索性能和稳定性可控。
- 支持后续扩展语义检索（不影响现有功能）。

---

## 4.3 协作冲突体验升级（三方合并）

### 当前痛点
`409 version_conflict` 后用户需要手工对比内容。

### 方案
- 保留后端冲突机制不变。
- 前端新增“冲突解决弹窗”：
  - 基线版本（Base）
  - 远端版本（Remote）
  - 本地草稿（Local）
- 提供一键策略：
  - 采用远端
  - 采用本地
  - 按区块合并并提交新版本

### 技术建议
- 新增接口：
  - `GET /api/campaigns/:id/conflict/base?entity=...&version=...`
- 客户端缓存编辑快照，冲突时自动拉取远端并构建 diff。

---

## 4.4 权限模板化（GM/PL/观察者）

### 目标
降低权限逻辑分散带来的维护成本。

### 方案
- 提供角色模板（role template）：
  - `gm_owner`
  - `player_editor`
  - `observer_readonly`
- 支持 campaign 级覆盖（在模板基础上追加 deny/allow）。

### 收益
- 权限行为可预测。
- 新功能接入权限系统时更快。

---

## 4.5 备份与恢复能力产品化

### 目标
为长期 Campaign 提供可运营的数据安全能力。

### 方案
- 定时备份策略（cron + 保留策略）。
- 手动备份（附注释，标记关键节点）。
- 恢复预览（兼容性检查、恢复影响提示）。
- 恢复模式：整库恢复 / Campaign 粒度恢复副本。

### 收益
- 减少误操作损失。
- 降低跨设备迁移成本。

---

## 5. 数据模型设计（建议增量）

> 以下为建议结构，保持与现有表并存，不强制重构已有表。

### 5.1 新增核心表
- `campaign_templates`
  - `id`, `name`, `description`, `visibility`, `owner_id`, `created_at`, `updated_at`
- `campaign_template_items`
  - `id`, `template_id`, `item_type(entity|section|todo|timeline)`, `payload_json`, `sort_order`
- `sessions`
  - `id`, `campaign_id`, `title`, `status(planned|active|closed|archived)`, `started_at`, `ended_at`, `summary`
- `session_events`
  - `id`, `session_id`, `event_type`, `ref_type`, `ref_id`, `payload_json`, `created_by`, `created_at`
- `clues`
  - `id`, `campaign_id`, `entity_ref`, `content`, `reveal_state`, `reveal_rule_json`, `created_at`, `updated_at`
- `import_jobs`
  - `id`, `campaign_id`, `status(pending|running|failed|done)`, `mapping_json`, `result_json`, `created_by`, `created_at`

### 5.2 可选扩展字段（原表增量）
- 版本记录增加：`session_id`（可空）
- 分享记录增加：`scope_label`（用于 UI 展示）
- 实体元数据增加：`last_revealed_at`, `reveal_count`

---

## 6. API 设计草案（新增，不破坏旧接口）

### 6.1 会次模块
- `GET /api/campaigns/:id/sessions`
- `POST /api/campaigns/:id/sessions`
- `PUT /api/campaigns/:id/sessions/:sid`
- `PUT /api/campaigns/:id/sessions/:sid/status`
- `GET /api/campaigns/:id/sessions/:sid/replay`

### 6.2 线索揭秘模块
- `GET /api/campaigns/:id/clues`
- `POST /api/campaigns/:id/clues`
- `PUT /api/campaigns/:id/clues/:clueId`
- `POST /api/campaigns/:id/clues/:clueId/reveal`
- `POST /api/campaigns/:id/clues/batch-reveal`

### 6.3 导入模块
- `POST /api/campaigns/:id/import/preview`
- `POST /api/campaigns/:id/import/execute`
- `GET /api/campaigns/:id/import/jobs/:jobId`

### 6.4 搜索管理模块
- `GET /api/search?q=...&campaignId=...`
- `GET /api/search/admin/status`
- `POST /api/search/admin/rebuild`
- `POST /api/search/admin/reindex`

---

## 7. 前端交互与信息架构调整

## 7.1 导航结构（保持原主结构）
- Campaign 左侧导航新增：
  - `概览`
  - `实体`
  - `线索板`
  - `会次`
  - `任务看板`
  - `版本`
  - `资源`

### 7.2 关键页面改进
- 实体详情页：新增线索摘要卡、关联会次卡、冲突提示入口。
- 版本页：新增“按会次过滤”“仅看我参与变更”。
- 编辑器：冲突时弹出三栏对比，支持局部选取合并。

### 7.3 体验细节
- 草稿自动保存状态提示（本地/云端/冲突）。
- 批量操作支持撤销（短时 Undo）。
- 关键操作二次确认（揭秘、恢复、批量删除）。

---

## 8. 非功能性设计（NFR）

## 8.1 性能目标（建议）
- 列表页首屏：P95 < 500ms（1000+ 实体规模）。
- 检索响应：P95 < 800ms（含 ACL 过滤）。
- 会次回放加载：P95 < 1.2s。

### 8.2 一致性与并发
- 所有写接口继续要求 `expectedVersion`。
- Lease 过期默认 30s，支持刷新。
- 冲突返回统一错误结构，便于前端统一处理。

### 8.3 安全与审计
- 关键操作写审计日志：
  - share/create/delete
  - reveal
  - restore-copy
  - role change
- 审计日志可按 campaign/user/time 范围查询。

---

## 9. 实施路线图（12 周）

## 9.1 Phase 1（第 1-4 周）：稳定性与底座
- 完成投影表与异步索引基础能力。
- 完成权限模板化与审计日志基础。
- 上线冲突三方合并 UI（最小可用版本）。

### 交付验收
- 1000+ 实体检索稳定可用。
- 多人并发编辑冲突处理可视化闭环跑通。

## 9.2 Phase 2（第 5-8 周）：TRPG 核心体验
- 上线模板库（内置 + 自定义模板）。
- 上线线索板与揭秘流。
- 上线会次管理与回放基础能力。

### 交付验收
- 新建模组耗时下降 40% 以上（内部评估）。
- PL 端线索可见性无越权问题。

## 9.3 Phase 3（第 9-12 周）：运营与生态
- 上线任务看板（含依赖）。
- 上线导入助手。
- 上线备份策略与恢复预览。

### 交付验收
- 关键数据可恢复演练通过。
- 导入成功率达到目标阈值（例如 > 95%）。

---

## 10. 测试方案

## 10.1 后端测试
- 单元测试：
  - 版本冲突与租约校验
  - 揭秘权限校验
  - 会次回放聚合逻辑
  - 索引任务重试与幂等
- 集成测试：
  - Campaign 全流程（模板创建 -> 编辑 -> 分享 -> 版本恢复）
  - 多用户并发编辑冲突场景
  - 搜索 ACL 过滤正确性

### 10.2 前端测试
- 组件测试：
  - 冲突弹窗三方合并
  - 线索状态切换
  - 看板拖拽状态机
- E2E：
  - GM/PL 协作流程
  - 揭秘流与会次回放流程

### 10.3 验收测试
- 功能验收（PRD 对照）
- 性能压测（实体规模分档）
- 回归测试（旧接口兼容）

---

## 11. 风险与应对

## 11.1 主要风险
- KV 与投影表同步不一致。
- 冲突合并 UI 复杂度高，易引发误操作。
- 揭秘规则复杂导致权限边界漏洞。
- 大量导入引发写放大与锁竞争。

### 11.2 应对策略
- 所有写操作使用事务保证 KV+Projection 原子性。
- 合并提交前提供预览与二次确认。
- 权限逻辑统一走服务端判定，不依赖前端隐藏。
- 导入任务异步化并限流，提供失败重试。

---

## 12. 首批优先落地清单（建议）

- P0-1：搜索异步索引 + 管理接口
- P0-2：冲突三方合并 UI
- P0-3：模板库（内置模板）
- P0-4：线索板基础版（状态切换 + 揭秘日志）

> 理由：这 4 项能在不改主架构前提下，最大化提升“备团效率 + 协作稳定性 + TRPG 专属体验”。

---

## 13. 成功度量（KPI 建议）

- 新建模组到可开团准备完成的中位时间。
- 协作冲突处理成功率与平均处理时长。
- 会次后总结产出率（有记录会次占比）。
- 搜索命中效率（点击后继续编辑/查看的转化）。
- 数据恢复演练通过率。

---

## 14. 结论

本方案在保持现有核心架构与功能不变的前提下，采用“增量扩展”的方式，为 `TRPG_note` 增加 TRPG 场景专属能力，并同步补强性能、协作与可运营性。  
建议按 3 期推进，先打底座（稳定性），再增强玩法（模板/线索/会次），最后补运营（导入/备份/恢复）。
