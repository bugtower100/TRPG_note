import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Archive, ArrowLeft, ArrowRight, BookOpen, Cloud, Database, ExternalLink, Images, Layers3, PackageOpen, RefreshCw, Search, Settings2, Smartphone, Sparkles, UserRound, Users, Wifi } from 'lucide-react';

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
      { name: '思维导图', path: '/mind-maps', description: '把剧情、势力或推理线索拆成节点，适合梳理分支和备团结构。' },
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
  { id: 'prep', title: '备团包怎么使用', summary: '选择内容导出，并在其他模组中导入。', category: '使用', icon: PackageOpen },
  { id: 'backup', title: '备份与恢复', summary: '选择完整或轻量备份，并使用导入助手。', category: '使用', icon: Archive },
  { id: 'online', title: '如何联机', summary: '让主持人和玩家进入同一个模组。', category: '连接', icon: Users },
  { id: 'onlineFaq', title: '联机常见问题', summary: '排查无法连接、找不到模组和同步延迟。', category: '连接', icon: Wifi },
  { id: 'cloud', title: '如何上云', summary: '使用 Docker 部署到云服务器或 NAS。', category: '连接', icon: Cloud },
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
              <p>从 <a href={RELEASE_URL} target="_blank" rel="noopener noreferrer">GitHub Releases</a> 下载对应系统的安装包。Windows 用户解压后运行 <code>TRPG模组笔记.exe</code>。建议将程序放在独立文件夹；数据保存在程序同文件夹下的 <code>data</code> 目录。</p>
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
              <h3>换设备后为什么还要输入用户名？</h3>
              <p>用户名记录和登录密码保存在当前浏览器中，不会自动复制到另一台设备。换浏览器或清除浏览器数据后，仍需输入原用户名；使用同一服务地址和用户名才能继续找到对应的模组。不要让不同参与者共用同一个用户名。</p>
              <h3>登录密码和模组进入密码有什么区别？</h3>
              <p>登录密码用于当前浏览器中的账号登录；模组进入密码由主持人在首页“管理模组 → 访问控制”中设置，玩家进入公开模组时按提示输入。两者分开设置。远程开放服务时，还应在服务器或反向代理层限制访问，不要只依赖应用内密码。</p>
            </>}

            {topicId === 'modules' && <>
              <p>左侧导航按跑团、模组资料、整理工具和管理分组。玩家账号只会看到获授权的资料与功能。</p>
              {moduleGroups.map((group) => <section key={group.title}><h3>{group.title}</h3><div className="manual-module-list">{group.items.map((item) => <div key={item.name}>{item.path === '/settings' ? <button type="button" onClick={() => onOpenSettingsSection('general')}>{item.name} <ArrowRight size={14} /></button> : <Link to={item.path}>{item.name} <ArrowRight size={14} /></Link>}<p>{item.description}</p></div>)}</div></section>)}
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
              <p>不在同一网络时，可把程序部署到大家都能访问的服务器，或通过可信的虚拟局域网连接。长期远程使用可继续阅读 <button type="button" className="manual-text-link" onClick={() => openTopic('cloud')}>如何上云</button>。</p>
              <h3>2. 主持人开放模组</h3>
              <ol><li>主持人在首页创建模组，展开该模组的“管理模组”。</li><li>在“访问控制”中选择“公开模组”，点击“保存公开设置”。需要控制加入时，再点击“设置进入密码”。</li><li>把服务地址和进入密码发给玩家。每位参与者使用自己的用户名进入，不要共用主持人的用户名。</li></ol>
              <h3>3. 玩家进入并协作</h3>
              <p>玩家在浏览器打开同一服务地址，登录后从首页找到“公开模组”，点击“进入公开模组”；若出现密码提示，输入主持人提供的进入密码。主持人可在模组管理中查看成员、设置助理主持人，并按需向玩家共享资料。</p>
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
              <p>云服务器或 NAS 可运行无托盘的 Docker 版本，多人通过浏览器使用同一套数据。下面以 Linux 服务器为例。</p>
              <h3>1. 准备服务器</h3>
              <p>安装 Docker，确认服务器可拉取 <code>ghcr.io/bugtower100/trpg_note:latest</code>，并为数据卷保留持久存储空间。</p>
              <h3>2. 启动容器</h3>
              <pre><code>{'docker run -d --name trpg-note --restart unless-stopped \\\n  -p 8080:8080 \\\n  -v trpg-note-data:/app/data \\\n  ghcr.io/bugtower100/trpg_note:latest'}</code></pre>
              <p><code>trpg-note-data</code> 会保存数据库和上传的图片。更新容器前请备份该卷或在应用内导出完整备份。</p>
              <h3>3. 打开应用</h3>
              <p>先确认服务器防火墙和云平台安全组允许访问所用端口，再访问 <code>http://服务器公网 IP:8080/web</code>。正式对外使用时，建议用域名和 HTTPS 反向代理，并限制不必要的端口暴露。</p>
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
