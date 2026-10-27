import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Archive, ArrowLeft, ArrowRight, BookOpen, BrainCircuit, CalendarDays, Cloud, Database, ExternalLink, Images, Kanban, Layers3, Map, Network, PackageOpen, RefreshCw, Search, Settings2, Smartphone, Sparkles, UserRound, Users, Wifi } from 'lucide-react';

const SOURCE_URL = 'https://github.com/bugtower100/TRPG_note';
const RELEASE_URL = `${SOURCE_URL}/releases`;
const QQ_GROUP = '1032118621';

const moduleGroups = [
  {
    title: '跑团',
    items: [
      { name: '模组概览', path: '/overview', description: '查看模组统计、资料入口、最近编辑和备忘录，先从这里了解当前备团进度。' },
      { name: '跑团工作台', path: '/play', description: '集中查看任务、线索、团队笔记与场次；进入相应栏目后可更新现场进度。' },
      { name: '线索', path: '/clues', description: '新建线索并记录发现与揭秘状态；需要时把线索分享给玩家。' },
      { name: '任务看板', path: '/session-tasks', description: '把待办分成待准备、进行中和已完成，分配成员并跟踪推进情况。' },
      { name: '团队笔记', path: '/team-notes', description: '建立协作笔记，记录现场决定、临时设定和团员需要共同编辑的内容。' },
      { name: '场次', path: '/sessions', description: '每次跑团分别整理准备、现场记录和复盘，必要时导出场次内容。' },
    ],
  },
  {
    title: '模组资料',
    items: [
      { name: '角色', path: '/characters', description: '建立 NPC 档案，记录身份、外观、目标与人物关系。' },
      { name: '怪物', path: '/monsters', description: '整理怪物的类型、数值、能力和掉落，便于遭遇时快速查阅。' },
      { name: '地点', path: '/locations', description: '记录环境、描述和关联资料；需要空间位置时再到地图添加点位。' },
      { name: '组织', path: '/organizations', description: '记录势力目标、成员与关系，把分散的人物和事件联系起来。' },
      { name: '事件', path: '/events', description: '建立剧情事件，记录经过与相关资料，后续可放入时间线。' },
      { name: '角色卡', path: '/characters/sheets', description: '建立与角色相关的角色卡，集中管理属性和跑团时需要查看的信息。' },
      { name: '地图', path: '/locations/maps', description: '上传地图，放置地点、角色和怪物点位；支持临时点位、图片指示物、缩放和平移。' },
      { name: '共享资料', path: '/shared-content', description: '玩家在这里查看主持人共享的资料；可见内容取决于模组权限与分享设置。' },
    ],
  },
  {
    title: '整理与管理',
    items: [
      { name: '关系图', path: '/relation-graphs', description: '把人物和其他资料连成关系网；临时角色只保存在关系图，不会创建角色档案。' },
      { name: '思维导图/白板', path: '/mind-maps', description: '建立分支或独立节点，自由连线并插入图片，整理剧情、势力与推理线索。' },
      { name: '时间线', path: '/timelines', description: '按时间排列事件和重要节点，用于追踪人物行动、伏笔和故事节奏。' },
      { name: '设置', path: '/settings', description: '管理主题、备份与导入、资源、回收站、版本更新，以及本手册。' },
    ],
  },
] as const;

const topics = [
  { id: 'start', title: '快速开始', summary: '下载安装、创建模组，完成第一份备团资料。', category: '入门', icon: Sparkles },
  { id: 'update', title: '如何更新', summary: '保留原有 data 目录，替换程序并核对版本。', category: '入门', icon: RefreshCw },
  { id: 'account', title: '账号与密码', summary: '登录、修改密码和区分模组进入密码。', category: '入门', icon: UserRound },
  { id: 'modules', title: '各版块如何使用', summary: '按跑团、资料、整理工具找到对应入口。', category: '使用', icon: Layers3 },
  { id: 'entities', title: '角色等资料卡片怎么整理', summary: '角色、怪物、地点、组织、事件和角色卡的共通用法。', category: '使用', icon: BookOpen },
  { id: 'play', title: '跑团工作台怎么使用', summary: '总览、线索、任务、团队笔记和场次回顾。', category: '使用', icon: Kanban },
  { id: 'maps', title: '地图怎么使用', summary: '上传底图、放置点位、调整视图和使用画板。', category: '使用', icon: Map },
  { id: 'relation', title: '关系图怎么使用', summary: '添加人物节点、连线、编辑关系与操作画布。', category: '使用', icon: Network },
  { id: 'timeline', title: '时间线怎么使用', summary: '整理事件顺序，并在工作版对照多条时间线。', category: '使用', icon: CalendarDays },
  { id: 'mindMap', title: '思维导图/白板怎么使用', summary: '添加独立节点、图片和连线，也可继续梳理分支。', category: '使用', icon: BrainCircuit },
  { id: 'prep', title: '备团包怎么使用', summary: '选择内容导出，并在其他模组中导入。', category: '使用', icon: PackageOpen },
  { id: 'backup', title: '备份与恢复', summary: '选择完整或轻量备份，并使用导入助手。', category: '使用', icon: Archive },
  { id: 'online', title: '如何联机与定向分享', summary: '让玩家加入模组、只向指定 PL 分享卡片，并设置副 GM。', category: '连接', icon: Users },
  { id: 'onlineFaq', title: '联机常见问题', summary: '排查无法连接、找不到模组和同步延迟。', category: '连接', icon: Wifi },
  { id: 'cloud', title: '如何上云', summary: '在 Windows 云服务器运行程序，或使用 Docker 部署到云服务器、NAS。', category: '连接', icon: Cloud },
  { id: 'mobile', title: '如何在手机上使用', summary: '局域网或云端访问同一套数据。', category: '连接', icon: Smartphone },
  { id: 'settings', title: '设置与外观', summary: '主题、编辑偏好、回收站和版本信息。', category: '维护', icon: Settings2 },
  { id: 'resources', title: '图片资源怎么管理', summary: '上传、分类、复用和删除图片资源。', category: '维护', icon: Images },
  { id: 'database', title: '如何检查数据库', summary: '使用随包提供的数据库检查工具.exe。', category: '维护', icon: Database },
] as const;

type TopicId = typeof topics[number]['id'];

const OfficialManual = ({ onOpenSettingsSection }: { onOpenSettingsSection: (section: 'general' | 'data' | 'resources' | 'recycle' | 'updates') => void }) => {
  const [topicId, setTopicId] = useState<TopicId | null>(null);
  const [query, setQuery] = useState('');
  const topic = topics.find((item) => item.id === topicId);
  const visibleTopics = topics.filter((item) => `${item.title} ${item.summary} ${item.category}`.includes(query.trim()));
  const openTopic = (id: TopicId) => { setTopicId(id); setQuery(''); };

  return (
    <div className="manual-layout">
      <nav className="manual-nav" aria-label="官方手册目录">
        <button type="button" className={!topicId ? 'is-active' : ''} onClick={() => setTopicId(null)}><BookOpen size={17} />手册首页</button>
        {(['入门', '使用', '连接', '维护'] as const).map((category) => (
          <div key={category}>
            <p className="manual-nav-label">{category}</p>
            {topics.filter((item) => item.category === category).map((item) => (
              <button key={item.id} type="button" className={topicId === item.id ? 'is-active' : ''} onClick={() => openTopic(item.id)}>{item.title}</button>
            ))}
          </div>
        ))}
      </nav>

      <div className="min-w-0">
        {!topic ? (
          <>
            <section className="manual-hero">
              <div className="manual-hero-copy">
                <span className="manual-eyebrow">TRPG 模组笔记 · 官方手册</span>
                <h2>使用方法，常见问题都可以来这里查询。</h2>
                <p>按操作查找说明，也可以从常见问题开始。手册内容随应用提供，离线使用时也能查看。</p>
                <div className="manual-hero-actions">
                  <button type="button" onClick={() => openTopic('start')}>开始阅读 <ArrowRight size={16} /></button>
                  <button type="button" onClick={() => openTopic('modules')}>查看功能版块</button>
                </div>
              </div>
              <img src="/mascot.png" alt="TRPG 模组笔记吉祥物" />
            </section>

            <div className="manual-contact-grid">
              <a href={SOURCE_URL} target="_blank" rel="noopener noreferrer" className="manual-contact-card"><span>源码与问题反馈</span><strong>GitHub 仓库</strong><ExternalLink size={17} /></a>
              <div className="manual-contact-card"><span>交流与反馈</span><strong>QQ 群 {QQ_GROUP}</strong><span className="text-xs theme-text-secondary">入群请在 QQ 中搜索群号</span></div>
            </div>

            <div className="manual-section-heading"><div><h3>常见问题</h3><p>从下面的主题进入详细操作说明。</p></div></div>
            <label className="manual-search"><Search size={18} /><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索手册主题，例如联机、备团包、数据库" aria-label="搜索手册主题" /></label>
            <div className="manual-card-grid">
              {visibleTopics.map((item) => {
                const Icon = item.icon;
                return <button key={item.id} type="button" className="manual-topic-card" onClick={() => openTopic(item.id)}><span className="manual-topic-icon"><Icon size={22} /></span><span className="min-w-0"><strong>{item.title}</strong><small>{item.summary}</small></span><ArrowRight size={17} className="manual-topic-arrow" /></button>;
              })}
            </div>
            {visibleTopics.length === 0 && <p className="py-6 text-sm theme-text-secondary">没有找到匹配的主题，可以从左侧目录浏览。</p>}
          </>
        ) : (
          <article className="manual-article">
            <button type="button" className="manual-back" onClick={() => setTopicId(null)}><ArrowLeft size={16} />返回手册首页</button>
            <span className="manual-eyebrow">{topic.category} · 官方手册</span>
            <h2>{topic.title}</h2>
            <p className="manual-lead">{topic.summary}</p>

            {topicId === 'start' && <>
              <h3>1. 下载并启动</h3>
              <p>从 <a href={RELEASE_URL} target="_blank" rel="noopener noreferrer">GitHub Releases</a> 下载对应系统的安装包。Windows 用户先完整解压到独立文件夹，再运行 <code>TRPG模组笔记.exe</code>。数据保存在程序同文件夹下的 <code>data</code> 目录。若程序直接放在桌面或下载文件夹，启动时会提示整理；已有 <code>data</code> 文件夹也要与程序一起移动。</p>
              <p>程序启动后会在默认浏览器打开页面。需要调整时，可右键系统托盘图标，勾选或取消“启动时自动打开网页”；“开机自启动”在后台运行时仍不会弹出网页。</p>
              <p className="manual-notice">请检查自己是否放在单一文件夹下！</p>
              <h3>2. 创建模组</h3>
              <p>登录后创建模组，进入 <Link to="/overview">模组概览</Link>。建议先录入重要角色、关键地点和核心事件，再补充线索与时间线。</p>
              <h3>3. 开团时使用</h3>
              <p>在 <Link to="/play">跑团工作台</Link> 查看任务、线索、团队笔记和场次。需要把资料分享给玩家时，再按模组权限设置可见范围。</p>
            </>}

            {topicId === 'update' && <>
              <h3>Windows 桌面版</h3>
              <ol><li>先从系统托盘彻底退出旧版程序，并导出完整备份，或复制原程序文件夹中的 <code>data</code> 目录留存。</li><li>从 <a href={RELEASE_URL} target="_blank" rel="noopener noreferrer">GitHub Releases</a> 下载新版压缩包，解压到临时位置。</li><li>把新版 <code>TRPG模组笔记.exe</code> 和 <code>数据库检查工具.exe</code> 复制到原来的程序文件夹，替换旧程序文件；保留原有 <code>data</code> 目录。</li><li>重新启动，在“设置 → 版本与更新”核对版本，并检查原有模组是否仍在。</li></ol>
              <p className="manual-notice">请检查自己是否放在单一文件夹下！如果更新后看不到旧模组，先确认启动的是原文件夹里的程序。</p>
              <h3>Docker 云端版</h3>
              <p>先备份 <code>/app/data</code> 对应的数据卷，再拉取新镜像、重建容器，并继续挂载原来的数据卷。不要把更新当作新部署而换用空数据卷。</p>
            </>}

            {topicId === 'account' && <>
              <h3>如何登录和设置密码？</h3>
              <p>启动后输入“用户名 / 昵称”即可登录；没有设置过登录密码时，密码框可以留空。登录后返回模组首页，展开右上角“账号”，在“登录密码”中输入并确认新密码。留空保存会清除该浏览器中的登录密码。</p>
              <p>使用完毕后，点击模组首页右上角的“退出登录”，即可回到登录页。</p>
              <h3>换设备后为什么还要输入用户名？</h3>
              <p>用户名记录和登录密码保存在当前浏览器中，不会自动复制到另一台设备。换浏览器或清除浏览器数据后，仍需输入原用户名；使用同一服务地址和用户名才能继续找到对应的模组。不要让不同参与者共用同一个用户名。</p>
              <h3>登录密码和模组进入密码有什么区别？</h3>
              <p>登录密码用于当前浏览器中的账号登录；模组进入密码由主持人在首页“管理模组 → 访问控制”中设置，玩家进入公开模组时按提示输入。两者分开设置。远程开放服务时，还应在服务器或反向代理层限制访问，不要只依赖应用内密码。</p>
            </>}

            {topicId === 'modules' && <>
              <p>左侧导航按跑团、模组资料、整理工具和管理分组。玩家账号只会看到获授权的资料与功能。</p>
              {moduleGroups.map((group) => <section key={group.title}><h3>{group.title}</h3><div className="manual-module-list">{group.items.map((item) => <div key={item.name}>{item.path === '/settings' ? <button type="button" onClick={() => onOpenSettingsSection('general')}>{item.name} <ArrowRight size={14} /></button> : <Link to={item.path}>{item.name} <ArrowRight size={14} /></Link>}<p>{item.description}</p></div>)}</div></section>)}
              <h3>按操作查看详细说明</h3>
              <p>角色、怪物、地点、组织、事件等资料卡片的基本操作相近，放在同一篇说明；画布类工具和跑团工作台各有独立步骤。</p>
              {(['entities', 'play', 'maps', 'relation', 'timeline', 'mindMap'] as const).map((id) => (
                <button key={id} type="button" className="manual-inline-action" onClick={() => openTopic(id)}>
                  {topics.find((item) => item.id === id)?.title} <ArrowRight size={16} />
                </button>
              ))}
            </>}

            {topicId === 'entities' && <>
              <h3>先建立资料，再补充内容</h3>
              <p>在角色、怪物、地点、组织或事件列表中创建条目，填写名称后进入详情页。可以先记最常用的身份、地点或事件经过，再按需要补充正文、分区、条目和图片。角色卡在“角色卡”版块单独管理，适合记录属性和跑团时需要查阅的数值。</p>
              <h3>把资料串起来</h3>
              <p>需要说明人物之间的关系时使用 <button type="button" className="manual-text-link" onClick={() => openTopic('relation')}>关系图</button>；地点需要空间位置时使用 <button type="button" className="manual-text-link" onClick={() => openTopic('maps')}>地图</button>；事件需要先后顺序时使用 <button type="button" className="manual-text-link" onClick={() => openTopic('timeline')}>时间线</button>。这些工具和资料卡片各有用途，不必在创建卡片时一次填完。</p>
              <h3>只给玩家看选定内容</h3>
              <p>GM 或副 GM 打开资料详情后，可点“分享整张卡片”；只想透露一部分时，在对应区块或条目的“…”菜单中选择“分享区块”或“分享条目”。在弹窗里只勾选目标 PL，并选择“仅查看”。详细步骤见 <button type="button" className="manual-text-link" onClick={() => openTopic('online')}>如何联机与定向分享</button>。</p>
            </>}

            {topicId === 'play' && <>
              <p>进入 <Link to="/play">跑团工作台</Link> 后，用上方的“总览、线索、任务、笔记、场次”标签切换。总览会汇总正在使用的内容，适合开团时先检查进度。</p>
              <h3>GM 的准备顺序</h3>
              <ol><li>在线索中建立待揭示的信息；需要让玩家看到时，再对指定成员分享。</li><li>在任务看板建立准备事项、安排成员并更新状态。GM 可设置 PL 是否能查看或编辑看板。</li><li>用团队笔记记录多人需要共同查看的决定；进入编辑状态后留意自动保存提示，切换栏目时若尚未保存，页面会先处理保存。</li><li>在“场次”建立一次跑团的准备页，记录目标、流程、关联任务和现场内容。场次结束后，填写玩家回顾并点击“发布给玩家”；未完成的场次或空白回顾不能发布。</li></ol>
              <h3>PL 看到什么</h3>
              <p>PL 可查看收到的线索分享、获授权的任务看板和团队笔记，以及 GM 已发布的场次回顾。主持人的未发布准备内容不会自动出现在玩家界面。</p>
              <p>场次目标和流程输入框可按 Enter 添加。其他操作以页面按钮和保存提示为准。</p>
            </>}

            {topicId === 'maps' && <>
              <p>进入 <Link to="/locations/maps">地图</Link>，点击“新建地图”，再用“上传本地图片”或“从资源管理器选择”设置底图。地图名称修改后可按 Enter 或点“保存名称”。</p>
              <h3>放置地点与人物</h3>
              <ol><li>点击“添加点位”，选择已有地点、角色、怪物，或选择临时/新增类型并输入名称。</li><li>点击“放置点位”，再在地图上点击需要的位置。临时点位只保存在地图；新增类型会建立相应资料。新点位默认不向 PL 显示。</li><li>点选已放置的点位可调整大小或资料，拖动可改位置，双击可查看。需要玩家看到时，在点位设置中调整可见内容。</li></ol>
              <h3>移动视图与画板</h3>
              <p>滚轮缩放地图，按住鼠标右键拖动可平移；“最大化地图”适合现场展示。点击“画板”可进入绘制工具，使用自由绘制、矩形、椭圆或橡皮擦标注。编辑期间留意保存和同步提示。</p>
            </>}

            {topicId === 'relation' && <>
              <p>进入 <Link to="/relation-graphs">关系图</Link>，先新建一张图。可以选择已有角色或怪物加入画布，也可在上方直接新建人物/怪物；“添加临时角色”只在这张图中保留，不会创建角色档案。</p>
              <h3>建立关系</h3>
              <ol><li>单击起点节点，点击“从选中节点开始连线”，再单击目标节点。</li><li>单击线条可选中关系，双击线条可打开关系编辑面板，填写方向、线型和文字描述；需要移除时点击“删除选中关系”。</li><li>拖动节点可调整布局，双击已有资料节点可打开对应卡片。</li></ol>
              <h3>画布操作</h3>
              <p>按住 Ctrl/Cmd 单击可多选节点，也可开启“框选模式”圈选；鼠标右键或中键拖动画布可平移。工具栏提供放大、缩小、重置视图、自动布局和撤销/重做。删除选中节点只移除图中的节点关系，操作前请核对当前选择。</p>
            </>}

            {topicId === 'timeline' && <>
              <p>进入 <Link to="/timelines">时间线</Link> 后新建时间线，在“连续时间轴”点击“+ 添加节点”，填写短标题、时间、备注和优先级。单击节点可展开备注，拖动节点可调整顺序，蓝线提示插入位置；上方可按优先级筛选。</p>
              <h3>并排对照多条时间线</h3>
              <p>点击“工作版”，选择已有时间线并“添加到工作版”。每条时间线占一列，可以纵向拖动事件节点，让同一时刻或相关情节对齐；单击节点在右下角查看或编辑备注。工作版也可按优先级筛选，需回到原时间线时点击“打开原时间线”。</p>
            </>}

            {topicId === 'mindMap' && <>
              <p>进入 <Link to="/mind-maps">思维导图/白板</Link> 后，新建一张画布会生成中心主题。单击节点打开详情，可添加子节点或同级节点，也可编辑名称和正文；节点标题中的资料关键词可直接点击跳转。</p>
              <h3>自由放置节点和图片</h3>
              <p>点击“独立节点”可创建不属于任何分支的节点；点击“上传图片”可选取本地图片，或点击“资源库图片”复用已有图片。图片加入后也是独立节点。节点和图片均可在画布上拖动，点“适应画布”可重新看到全部内容。</p>
              <h3>连接与编辑关系</h3>
              <p>选中起点节点，在节点工具栏或详情面板点击“从此节点连线”，详情会收起，再点击目标节点；也可以从节点边缘的连接点拖到目标节点。点击连线可填写箭头描述，自由连线还可单独删除。两个节点之间允许双向连线，画布会将两个方向的线分开显示。</p>
              <h3>快捷键与布局</h3>
              <p>先选中一个节点：方向键在节点间导航，Tab 添加子节点，Enter 为有父节点的普通节点添加同级，Delete 删除所选分支，Space 折叠或展开分支，Ctrl/Cmd + ↑/↓ 调整同级顺序，Esc 取消选择或连线。Ctrl/Cmd + Z 撤销；Ctrl/Cmd + Shift + Z 或 Ctrl/Cmd + Y 重做。输入文字时这些画布快捷键不会触发。</p>
              <p>工具栏可切换“从左到右”或“从上到下”自动布局；若已有手动调整的位置，页面会先要求确认，执行后仍可撤销。</p>
            </>}

            {topicId === 'prep' && <>
              <p>备团包适合只分享一个模组里选定的资料；如果要完整迁移数据，请使用“模组备份”。</p>
              <h3>导出</h3>
              <ol><li>进入 <button type="button" className="manual-text-link" onClick={() => onOpenSettingsSection('data')}>设置 → 备份与导入</button>，在“备团包”点击“选择内容并导出”。</li><li>勾选需要的版块或单独条目。若提示缺少关联资料，可补选可用关联后再导出。</li><li>下载 <code>.trpgzip</code> 包；所选内容引用的图片会自动打包。</li></ol>
              <h3>导入</h3>
              <ol><li>仍在“备份与导入”中打开“导入助手”，选择导出的文件并查看预览。</li><li>已有模组可选择全部新增或覆盖同名条目；未进入模组时可新建模组导入。</li><li>确认结果中的条目和资源数量，再到相应版块检查内容。</li></ol>
              <p>备团包不包含团队笔记、任务看板、成员权限和回收站。导出时未选中的关联内容不会随包保留。</p>
            </>}

            {topicId === 'backup' && <>
              <h3>备份一个模组还是全部模组？</h3>
              <p>当前模组的资料可从 <button type="button" className="manual-text-link" onClick={() => onOpenSettingsSection('data')}>设置 → 备份与导入</button> 点击“导出当前模组”；所有模组的备份在首页“工具与备份”中导出。导出时可选完整备份或轻量备份：完整备份包含引用的图片资源，轻量备份只保留文字和结构数据。</p>
              <h3>如何恢复？</h3>
              <p>在“设置 → 备份与导入”使用导入助手，或从首页“工具与备份”进入导入流程。先查看导入预览，再选择适合的导入方式；导入后检查模组资料和图片。备团包只用于分享选定内容，不能代替完整备份。</p>
              <h3>如何防止本机数据丢失？</h3>
              <p>首页“工具与备份 → 自动备份”可设置数据库自动备份。手动更新程序前，也建议保存一份完整备份，并保留程序旁的 <code>data</code> 目录。</p>
            </>}

            {topicId === 'online' && <>
              <h3>1. 共用一个服务地址</h3>
              <p>主持人和玩家要打开同一台正在运行的程序。连接同一 Wi-Fi 时，可在玩家设备上访问 <code>http://主持人电脑的局域网 IP:端口/web</code>，端口以主持人电脑实际打开的地址为准。玩家设备上的 <code>localhost</code> 指向玩家自己的设备，不能用于连接主持人电脑。</p>
              <p>不在同一网络时，可使用虚拟局域网，或用樱花映射等内网穿透工具把主持人电脑的应用端口映射出去。虚拟局域网向玩家提供虚拟局域网 IP 和应用端口；内网穿透则使用工具给出的外网地址访问应用的 <code>/web</code> 页面。主持人程序和映射客户端都要保持运行。也可把程序部署到云服务器，详见 <button type="button" className="manual-text-link" onClick={() => openTopic('cloud')}>如何上云</button>。</p>
              <h3>2. 主持人开放模组</h3>
              <ol><li>主持人在首页创建模组，展开该模组的“管理模组”。</li><li>在“访问控制”中选择“公开模组”，点击“保存公开设置”。需要控制加入时，再点击“设置进入密码”。</li><li>把服务地址和进入密码发给玩家。每位参与者使用自己的用户名进入，不要共用主持人的用户名。</li></ol>
              <h3>3. 玩家进入并协作</h3>
              <p>玩家在浏览器打开同一服务地址，登录后从首页找到“公开模组”，点击“进入公开模组”；若出现密码提示，输入主持人提供的进入密码。玩家加入后，主持人可在首页该模组的“管理模组 → 成员列表”中确认其用户名。</p>
              <h3>4. 悄悄分享卡片给指定 PL</h3>
              <ol><li>GM 或副 GM 打开要分享的角色、怪物、地点等资料详情，点击“分享整张卡片”。只想透露一部分时，打开相应区块或条目的“…”菜单，选择“分享区块”或“分享条目”。</li><li>在分享窗口中，把“分享权限”设为“仅查看”，在“选择目标 PL”里只勾选要收到内容的玩家，然后点击“确认分享”。</li><li>请目标玩家到模组内的“共享资料”查看。未被勾选的 PL 不会因这次定向分享获得该内容；若此前通过其他方式已共享，还需检查原有分享。</li></ol>
              <p>如果目标不在列表中，先让该玩家以自己的用户名加入模组。分享窗口也可一次勾选多个 PL；需要保密时，确认勾选名单后再提交。</p>
              <h3>5. 设置副 GM（副 KP）</h3>
              <p>模组创建者返回首页，展开该模组的“管理模组”，在“成员列表”找到已加入的 PL，点击名字旁的“副GM”即可授予助理主持人身份。要收回时，在同一位置点击“改回PL”。只有创建者能设置或收回副 GM；副 GM 可协助管理模组资料和分享，但不能任命其他副 GM。</p>
              <p>编辑后留意右上角的连接与保存状态。团队笔记、任务看板和地图等协作内容会从同一服务器读取；部分页面的刷新和保存提示也会单独显示。</p>
              <button type="button" className="manual-inline-action" onClick={() => openTopic('onlineFaq')}>继续阅读：联机常见问题 <ArrowRight size={16} /></button>
            </>}

            {topicId === 'onlineFaq' && <>
              <h3>玩家打不开地址？</h3>
              <p>先确认主持人的程序仍在运行，玩家填写的是主持人电脑的局域网 IP 或云端地址，而不是 <code>localhost</code>。局域网连接要在同一网络下，并检查电脑防火墙是否允许当前端口；跨网络连接还要检查服务器的访问规则。</p>
              <h3>首页看不到模组？</h3>
              <p>确认双方打开的是同一个服务地址。主持人需在“管理模组”中选择“公开模组”并点击“保存公开设置”，玩家随后刷新首页。“私密模组”不会出现在其他人的公开模组列表。</p>
              <h3>提示进入密码不正确？</h3>
              <p>向主持人核对最新密码。主持人可在“管理模组”中点击“修改进入密码”；玩家重新进入模组时按提示输入新密码。</p>
              <h3>看不到资料或其他人的修改？</h3>
              <p>玩家只能查看已向其共享或设为玩家可见的内容。若修改没有出现，先确认编辑者已保存，再检查右上角连接与保存状态，并刷新当前页面。地图处于本地编辑时会暂停联机自动刷新，保存或退出编辑后恢复。</p>
              <h3>“在线成员”人数不对？</h3>
              <p>右上角显示的是最近 5 分钟内有活动的成员，不是实时连接人数。成员刚打开页面或暂时没有操作时，可稍后点击“刷新状态”查看。</p>
            </>}

            {topicId === 'cloud' && <>
              <p>可以把 Windows 桌面版放在 Windows 云服务器上运行，也可以在 Linux 云服务器或 NAS 上使用 Docker。参与者都通过同一个服务器地址打开页面。</p>
              <h3>Windows 云服务器</h3>
              <ol><li>把 Windows 发布包解压到云服务器上的独立文件夹，运行 <code>TRPG模组笔记.exe</code>，先在服务器浏览器中检查 <code>http://localhost:8080/web</code> 是否能打开；若修改了应用端口，以实际端口为准。</li><li>在 Windows 防火墙中允许该 TCP 端口入站，并在云平台的安全组或网络规则中开放同一端口。程序需要持续运行，<code>data</code> 文件夹也要保留在程序目录中。</li><li>让玩家访问 <code>http://服务器公网 IP:8080/web</code>，端口以实际设置为准。若无法连接，分别检查程序、Windows 防火墙和云平台规则。</li></ol>
              <h3>Docker 云服务器或 NAS</h3>
              <p>Docker 版本不依赖系统托盘。下面以 Linux 服务器为例。</p>
              <h4>1. 准备服务器</h4>
              <p>安装 Docker，确认服务器可拉取 <code>ghcr.io/bugtower100/trpg_note:latest</code>，并为数据卷保留持久存储空间。</p>
              <h4>2. 启动容器</h4>
              <pre><code>{'docker run -d --name trpg-note --restart unless-stopped \\\n  -p 8080:8080 \\\n  -v trpg-note-data:/app/data \\\n  ghcr.io/bugtower100/trpg_note:latest'}</code></pre>
              <p><code>trpg-note-data</code> 会保存数据库和上传的图片。更新容器前请备份该卷或在应用内导出完整备份。</p>
              <h4>3. 打开应用</h4>
              <p>先确认服务器防火墙和云平台安全组允许访问所用端口，再访问 <code>http://服务器公网 IP:8080/web</code>。无论采用哪种部署方式，正式对外使用时都建议用域名和 HTTPS 反向代理，并限制不必要的端口暴露。</p>
            </>}

            {topicId === 'mobile' && <>
              <p>手机不必安装桌面 EXE，使用浏览器打开正在运行的应用即可。手机和电脑登录后访问的是同一套服务器数据。</p>
              <h3>同一 Wi-Fi 下</h3>
              <p>保持电脑上的应用运行，在手机浏览器打开 <code>http://电脑的局域网 IP:端口/web</code>。端口以电脑实际打开的地址为准；若无法连接，检查电脑防火墙和两台设备是否在同一网络。</p>
              <h3>外出访问</h3>
              <p>要从其他网络长期访问，建议部署到云服务器，再用手机打开云端地址。</p>
              <button type="button" className="manual-inline-action" onClick={() => openTopic('cloud')}>继续阅读：如何上云 <ArrowRight size={16} /></button>
            </>}

            {topicId === 'settings' && <>
              <h3>主题与编辑方式</h3>
              <p>在 <button type="button" className="manual-text-link" onClick={() => onOpenSettingsSection('general')}>设置 → 基本设置</button> 切换内置主题，或在“自定义主题库”下载模板、上传主题 JSON 并应用。自定义主题保存在当前设备上。“编辑偏好”可控制普通资料页是否双击正文进入编辑。</p>
              <h3>误删资料与版本信息</h3>
              <p>误删内容时先到 <button type="button" className="manual-text-link" onClick={() => onOpenSettingsSection('recycle')}>设置 → 回收站</button> 查找。需要核对当前版本或查看更新时，打开 <button type="button" className="manual-text-link" onClick={() => onOpenSettingsSection('updates')}>设置 → 版本与更新</button>。</p>
            </>}

            {topicId === 'resources' && <>
              <p>在 <button type="button" className="manual-text-link" onClick={() => onOpenSettingsSection('resources')}>设置 → 资源管理</button> 上传图片、建立分类、移动资源，并查看已上传内容。编辑角色、地图点位等需要图片时，也可以从资源库选择已有图片。</p>
              <h3>图片删不掉怎么办？</h3>
              <p>先保存当前编辑，再检查图片是否仍被资料或地图引用。资源管理会阻止删除仍在使用的图片；先更换或移除引用后再删除。</p>
            </>}

            {topicId === 'database' && <>
              <p>Windows 发布包附带独立的 <code>数据库检查工具.exe</code>，可以先只读检查数据库，不需要安装开发环境。</p>
              <ol><li>把检查工具和 <code>TRPG模组笔记.exe</code> 放在同一目录。</li><li>先从系统托盘彻底退出主程序，再双击检查工具。</li><li>确认工具显示的数据库路径、文件大小、记录数量和检查结果。默认数据库位于程序旁的 <code>data/storage.db</code>。</li><li>如工具提示可修复问题，再决定是否执行修复；修复前会在数据库旁创建备份。其他异常请保留检查输出并反馈。</li></ol>
              <p>如果没有找到数据库，请先确认程序和检查工具在同一目录，或在命令行用 <code>--database-path</code> 指定实际路径。</p>
            </>}

            <div className="manual-article-footer"><span>仍有疑问？</span><a href={`${SOURCE_URL}/issues`} target="_blank" rel="noopener noreferrer">提交 GitHub Issue <ExternalLink size={14} /></a><span>或加入 QQ 群 {QQ_GROUP}</span></div>
          </article>
        )}
      </div>
    </div>
  );
};

export default OfficialManual;
