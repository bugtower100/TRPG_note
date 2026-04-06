# 团队笔记与多人协作设计草案

## 目标
- 支持同一模组被多名用户通过浏览器同时访问
- 以模组为单位区分 GM / PL 权限
- 在不破坏现有“个人笔记独立存储”前提下，增加团队共编与分享编辑
- 为未来回退与审计预留版本机制

## 当前现状
- 当前用户体系是本地用户名登录，`createUser` 默认角色为 GM，且数据按用户前缀分隔存储
- 当前模组数据是整包 `CampaignData` 保存，没有多用户共享视角，也没有服务端权限模型
- 当前富文本编辑器基于 Milkdown / ProseMirror

## 核心设计原则
- 个人内容默认私有：每位用户保留自己的独立模组视图与个人笔记
- 共享内容显式授权：团队笔记和分享条目只有在 GM 配置后才进入其他 PL 视图
- 协作优先局部化：先对“团队笔记”和“被分享的单条内容”做协作，不对整个模组一次性全量共编
- 版本先行：所有共享对象变更必须写入版本流，支持回退

## 一、权限模型

### 1. 模组访问级别
- `public`：所有登录用户可见，可申请进入
- `private`：仅创建者 / 被邀请者可见

### 2. 模组内角色
- `GM`
  - 模组创建者默认是 GM
  - 可设置 GM 访问密码
  - 拥有全部查看、编辑、分享、回退、权限配置能力
- `PL`
  - 进入模组者默认是 PL
  - 仅能看见：
    - 自己的个人内容
    - 团队笔记
    - GM 分享给自己的卡片/条目

### 3. 访问声明
- 首次进入模组时，系统必须明确显示：
  - 你当前身份：GM / PL
  - 你当前可见范围：个人笔记 / 团队笔记 / 分享内容
  - 你当前权限：仅查看 / 可编辑

## 二、数据分层

### 1. 模组总表
- `campaigns`
  - `id`
  - `name`
  - `visibility` (`public` / `private`)
  - `gmPasswordHash`
  - `ownerUserId`
  - `createdAt`
  - `updatedAt`
  - `schemaVersion`

### 2. 成员表
- `campaign_members`
  - `campaignId`
  - `userId`
  - `role` (`GM` / `PL`)
  - `joinedAt`
  - `lastActiveAt`

### 3. 个人内容
- `campaign_personal_snapshots`
  - 每个用户在同一模组下拥有自己的个人数据快照
  - 包含角色、地点、事件等个人副本
  - 默认不互相可见

### 4. 团队内容
- `campaign_team_notes`
  - 团队公共条目容器
  - 所有人都可见
  - 可按条目协作编辑

### 5. 分享映射
- `shared_entities`
  - `sourceOwnerUserId`
  - `campaignId`
  - `entityType`
  - `entityId`
  - `scope` (`entity` / `section` / `subItem`)
  - `scopeId`
  - `targetUserId`
  - `permission` (`read` / `edit`)
  - `sharedByUserId`
  - `createdAt`
  - `updatedAt`

### 6. 版本表
- `version_records`
  - `id`
  - `campaignId`
  - `documentType` (`team_note` / `shared_entity` / `campaign_config`)
  - `documentId`
  - `versionNo`
  - `baseVersionNo`
  - `patch`
  - `snapshot`
  - `operatorUserId`
  - `createdAt`

## 三、文档模型

### 1. 团队笔记
- 作为新的一级模块存在，独立于角色/地点/事件等实体
- 内部结构可复用现有“卡片 + 区块 + 子项目 + 富文本”
- 所有人都可见，默认：
  - GM：可编辑
  - PL：可编辑

### 2. 分享卡片 / 分享条目
- 卡片级分享：
  - 相当于将某实体整体映射到目标 PL 视图
  - 默认包含该卡片下全部区块
- 条目级分享：
  - 相当于只映射某个区块 / 子项目
  - 在对方分类下显示为“共享卡片中的局部内容”
- 页面必须显示来源标识：
  - `来自 GM 分享`
  - `仅查看`
  - `可编辑`

## 四、协作与锁

### 1. 团队笔记协作策略
- 团队笔记优先采用成熟协作引擎，而不是自搓 OT/CRDT
- 当前编辑器基于 Milkdown / ProseMirror，适合接入 Yjs
- Milkdown 官方说明支持基于 Yjs 的实时协作：[Milkdown](https://milkdown.dev/)
- Yjs 适合离线优先、自动合并共享数据：[Yjs](https://yjs.dev/)
- 若需要自托管 WebSocket 协作层，Hocuspocus 是现成成熟方案，且面向 Yjs/ProseMirror 生态：[Hocuspocus](https://docs.superdoc.dev/modules/collaboration/self-hosted/hocuspocus)

### 2. 共享卡片 / 共享条目协作策略
- 对“共享的富文本正文”采用 Yjs 实时协作
- 对“卡片元数据”采用服务端乐观锁 + 版本号
  - 如标题、可见性、分享对象、权限配置

### 3. 编辑状态提示
- 任意共享对象进入编辑时，记录 presence：
  - `documentId`
  - `userId`
  - `username`
  - `startedAt`
  - `expiresAt`
- 其他人查看时显示：
  - `A 正在编辑...`
- PL 编辑团队条目时：
  - 默认编辑时间 10 分钟
  - 到时自动保存并结束编辑状态
- GM：
  - 不设编辑时限

### 4. 并发规则
- 团队笔记正文：CRDT 自动合并
- 分享正文：CRDT 自动合并
- 权限配置、分享配置、删除操作：
  - 走事务接口
  - 使用版本号检查
  - 冲突时提示“内容已更新，请刷新后再试”

## 五、版本与回退

### 1. 为什么必须先做版本
- 你这个功能会引入：
  - 多人同时编辑
  - 分享与撤回
  - GM 覆盖 PL 权限
- 没有版本机制，误删/误改几乎不可恢复

### 2. 建议版本粒度
- 团队笔记：按文档版本
- 分享内容：按文档版本
- 权限配置：按实体版本

### 3. 回退能力
- GM 可查看：
  - 谁在什么时候改了什么
  - 当前版本与历史版本差异
- GM 可执行：
  - 恢复到指定版本
  - 创建“恢复副本”而非强制覆盖

## 六、界面设计

### 1. 主界面
- 模组卡片增加：
  - `公开 / 私密`
  - `GM密码已设置`
  - `在线成员数`

### 2. 模组内导航
- 新增模块：
  - `团队笔记`
  - `共享给我的内容`
  - `权限管理`（GM）
  - `版本记录`（GM）

### 3. 卡片标识
- 在卡片右上角加标签：
  - `个人`
  - `团队`
  - `共享`
  - `仅查看`
  - `可编辑`

### 4. 分享操作入口
- 卡片级：
  - 卡片菜单里加“分享整张卡片”
- 区块/子项目级：
  - 区块头 / 子项目头里加“分享此条目”
- 分享动作必须二次确认

## 七、后端建议

### 1. 服务端协议
- HTTP：
  - 登录 / 模组列表 / 权限配置 / 分享配置 / 版本查询 / 回退
- WebSocket：
  - 在线状态
  - 编辑状态
  - 协作文档同步

### 2. 存储建议
- 第一阶段继续使用现有 KV 思路，但扩展成逻辑分桶：
  - `campaign:{id}:config`
  - `campaign:{id}:member:{userId}`
  - `campaign:{id}:personal:{userId}`
  - `campaign:{id}:team:{docId}`
  - `campaign:{id}:share:{shareId}`
  - `campaign:{id}:version:{docId}:{version}`
- 如果后续查询复杂度提升，再切 SQLite / Postgres

## 八、分阶段实施建议

### Phase 0：数据与权限底座
- 加模组公开/私密
- 加 GM / PL 成员关系
- 加模组密码与加入逻辑
- 加统一版本号字段

### Phase 1：只做团队笔记
- 新增团队笔记模块
- 接入 Yjs + Hocuspocus
- 只做“团队笔记正文协作 + presence + 10分钟锁”

### Phase 2：只做共享只读
- GM 可将整张卡片 / 单个条目分享给指定 PL
- PL 看到共享内容，但不可编辑

### Phase 3：共享可编辑
- 为分享条目接入协作编辑
- 增加“谁正在编辑”提示

### Phase 4：版本与回退
- 历史版本列表
- 差异对比
- 恢复版本 / 恢复副本

## 九、关键风险
- 现有数据是“每用户一份模组快照”，要改成“个人内容 + 团队内容 + 分享映射”三层结构
- 现有富文本编辑是局部组件式保存，需要抽出文档级 id 才能接协作
- 权限一旦做到区块/子项目粒度，后端索引和前端筛选会显著复杂
- 关系图目前也属于共享候选对象，但建议不要放进第一阶段

## 十、我的建议结论
- 先不要一口气做“全模组多人协作”
- 最先落地顺序应当是：
  - 模组成员与权限
  - 团队笔记
  - 分享只读
  - 分享可编辑
  - 版本回退
- 协作底座优先选：
  - Yjs
  - Hocuspocus
  - 复用当前 Milkdown / ProseMirror 生态
