import { useDeferredValue, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowDown, ArrowUp, CalendarDays, ChevronLeft, Copy, Download, ExternalLink, Pin, Plus, Search, Trash2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { useCampaignData } from '../context/CampaignContext';
import { useCampaignMemberRole } from '../hooks/useCampaignMemberRole';
import type {
  CampaignData,
  GameSession,
  GameSessionAgendaStatus,
  GameSessionGoalStatus,
  GameSessionResourceRef,
  GameSessionStatus,
  GraphEntityType,
} from '../types';
import { createGameSession, createGameSessionFromPreparation } from '../utils/gameSessions';
import {
  buildGMSessionMarkdown,
  buildPlayerSessionMarkdown,
  downloadSessionMarkdown,
  gameSessionMarkdownFileName,
} from '../utils/gameSessionMarkdown';

const STATUS_LABELS: Record<GameSessionStatus, string> = {
  preparing: '准备中',
  active: '进行中',
  completed: '已结束',
};

const GOAL_STATUS_LABELS: Record<GameSessionGoalStatus, string> = {
  pending: '未推进',
  progressed: '已推进',
  completed: '已完成',
  dropped: '放弃',
};

const AGENDA_STATUS_LABELS: Record<GameSessionAgendaStatus, string> = {
  pending: '未开始',
  active: '进行中',
  completed: '已发生',
  skipped: '跳过',
  deferred: '顺延下场',
};

const TASK_STATUS_LABELS = {
  todo: '待准备',
  in_progress: '进行中',
  done: '已完成',
} as const;

const RESOURCE_TYPE_LABELS: Record<GraphEntityType, string> = {
  characters: '角色',
  monsters: '怪物',
  locations: '地点',
  organizations: '组织',
  events: '事件',
  clues: '线索',
  timelines: '时间线',
};

const RESOURCE_TYPES = Object.keys(RESOURCE_TYPE_LABELS) as GraphEntityType[];

const routeForResource = (ref: GameSessionResourceRef) => {
  if (ref.entityType === 'timelines') return `/timelines/${ref.entityId}`;
  return `/${ref.entityType}/${ref.entityId}`;
};

const formatDateTime = (value?: number) => value ? new Date(value).toLocaleString() : '未记录';

const formatDuration = (minutes: number) => {
  if (minutes < 60) return `${minutes} 分钟`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder > 0 ? `${hours} 小时 ${remainder} 分钟` : `${hours} 小时`;
};

const moveItem = <T,>(items: T[], fromIndex: number, toIndex: number) => {
  if (toIndex < 0 || toIndex >= items.length || fromIndex === toIndex) return items;
  const next = items.slice();
  const [item] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, item);
  return next;
};

const sessionMatchesQuery = (session: GameSession, query: string, playerView: boolean) => {
  if (!query) return true;
  const fields = playerView
    ? [session.title, session.scheduledAt, session.inWorldDate, session.playerRecap]
    : [
      session.title,
      session.scheduledAt,
      session.inWorldDate,
      session.summary,
      session.liveNotes,
      session.unresolvedItems,
      session.gmSummary,
      session.playerRecap,
      ...session.goals.map((goal) => goal.title),
      ...session.agenda.flatMap((item) => [item.title, item.notes]),
    ];
  return fields.some((field) => field.toLocaleLowerCase().includes(query));
};

interface SessionListProps {
  sessions: GameSession[];
  canEdit: boolean;
  playerView?: boolean;
  onCreate: () => void;
  onOpen: (id: string) => void;
}

function SessionList({ sessions, canEdit, playerView = false, onCreate, onOpen }: SessionListProps) {
  const [statusFilter, setStatusFilter] = useState<'all' | GameSessionStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const deferredQuery = useDeferredValue(searchQuery.trim().toLocaleLowerCase());
  const visibleSessions = useMemo(() => sessions
    .filter((session) => (statusFilter === 'all' || session.status === statusFilter)
      && sessionMatchesQuery(session, deferredQuery, playerView))
    .slice()
    .sort((a, b) => b.sessionNumber - a.sessionNumber), [deferredQuery, playerView, sessions, statusFilter]);
  const hasActiveFilter = Boolean(searchQuery.trim()) || (!playerView && statusFilter !== 'all');

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">{playerView ? '场次回顾' : '场次中心'}</h2>
          <p className="mt-1 text-sm theme-text-secondary">{playerView ? '查看 GM 已发布的往期场次回顾。' : '按一次跑团集中准备资料、记录现场进展并完成复盘。'}</p>
        </div>
        {canEdit ? (
          <button type="button" onClick={onCreate} className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-white hover:bg-primary-dark">
            <Plus size={17} />新建场次
          </button>
        ) : null}
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <label className="relative min-w-64 flex-1 md:max-w-md">
          <span className="sr-only">搜索场次</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 theme-text-secondary" size={17} />
          <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder={playerView ? '搜索标题、日期或回顾内容' : '搜索标题、日期或场次记录'} className="w-full rounded-md border border-theme bg-transparent py-2 pl-9 pr-3 text-sm" />
        </label>
        {!playerView ? (['all', 'preparing', 'active', 'completed'] as const).map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => setStatusFilter(status)}
            className={`rounded-full border px-3 py-1.5 text-sm ${statusFilter === status ? 'bg-primary text-white border-transparent' : 'border-theme hover:bg-primary-light'}`}
          >
            {status === 'all' ? '全部' : STATUS_LABELS[status]}
          </button>
        )) : null}
        {hasActiveFilter ? <button type="button" onClick={() => { setSearchQuery(''); setStatusFilter('all'); }} className="rounded-md px-3 py-2 text-sm theme-text-secondary hover:bg-primary-light">清空筛选</button> : null}
      </div>

      {hasActiveFilter ? <p className="text-sm theme-text-secondary">找到 {visibleSessions.length} 个场次</p> : null}

      {visibleSessions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-theme bg-theme-card px-6 py-14 text-center theme-text-secondary">
          <CalendarDays className="mx-auto mb-3" size={34} />
          <p>{sessions.length === 0 ? (playerView ? 'GM 还没有发布场次回顾。' : '还没有场次，先为下一次跑团建立准备页。') : '没有符合当前搜索或筛选条件的场次。'}</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visibleSessions.map((session) => {
            const completedGoals = session.goals.filter((goal) => goal.status === 'completed').length;
            return (
              <button key={session.id} type="button" onClick={() => onOpen(session.id)} className="theme-card rounded-xl border border-theme p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs theme-text-secondary">第 {session.sessionNumber} 次</div>
                    <h3 className="mt-1 truncate text-lg font-semibold">{session.title}</h3>
                  </div>
                  <span className="shrink-0 rounded-full border border-theme px-2 py-1 text-xs">{STATUS_LABELS[session.status]}</span>
                </div>
                <p className="mt-3 line-clamp-2 min-h-10 text-sm theme-text-secondary">{playerView ? session.playerRecap : (session.summary || '尚未填写场次简介。')}</p>
                <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs theme-text-secondary">
                  <span>{session.scheduledAt ? new Date(session.scheduledAt).toLocaleString() : '时间待定'}</span>
                  {playerView ? <span>发布于 {formatDateTime(session.playerRecapPublishedAt)}</span> : <><span>目标 {completedGoals}/{session.goals.length}</span><span>资料 {session.resourceRefs.length}</span></>}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PlayerSessionDetail({ session }: { session: GameSession }) {
  const navigate = useNavigate();
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={() => navigate('/sessions')} className="inline-flex items-center gap-1 rounded-md border border-theme px-3 py-2 text-sm hover:bg-primary-light">
          <ChevronLeft size={17} />场次回顾列表
        </button>
        <button type="button" onClick={() => downloadSessionMarkdown(buildPlayerSessionMarkdown(session), gameSessionMarkdownFileName(session, true))} className="inline-flex items-center gap-2 rounded-md border border-theme px-3 py-2 text-sm hover:bg-primary-light">
          <Download size={16} />导出玩家回顾
        </button>
      </div>
      <article className="theme-card rounded-xl border border-theme p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-theme pb-4">
          <div>
            <div className="text-sm theme-text-secondary">第 {session.sessionNumber} 次</div>
            <h2 className="mt-1 text-2xl font-bold">{session.title}</h2>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm theme-text-secondary">
              {session.scheduledAt ? <span>{new Date(session.scheduledAt).toLocaleString()}</span> : null}
              {session.inWorldDate ? <span>世界内日期：{session.inWorldDate}</span> : null}
            </div>
          </div>
          <span className="rounded-full border border-theme px-3 py-1 text-xs">发布于 {formatDateTime(session.playerRecapPublishedAt)}</span>
        </div>
        <div className="mt-5 whitespace-pre-wrap leading-7">{session.playerRecap}</div>
      </article>
    </div>
  );
}

interface SessionDetailProps {
  session: GameSession;
  canEdit: boolean;
  campaignData: CampaignData;
  members: Array<{ userId: string; username: string }>;
  onChange: (updater: (current: GameSession) => GameSession) => void;
  onDelete: () => void;
  onCreateNext: () => void;
  onReusePreparation: () => void;
}

function SessionDetail({ session, canEdit, campaignData, members, onChange, onDelete, onCreateNext, onReusePreparation }: SessionDetailProps) {
  const navigate = useNavigate();
  const [newGoal, setNewGoal] = useState('');
  const [newAgendaTitle, setNewAgendaTitle] = useState('');
  const [resourceType, setResourceType] = useState<GraphEntityType>('characters');
  const [resourceId, setResourceId] = useState('');

  const resourceCollections = useMemo(() => ({
    characters: campaignData.characters,
    monsters: campaignData.monsters,
    locations: campaignData.locations,
    organizations: campaignData.organizations,
    events: campaignData.events,
    clues: campaignData.clues,
    timelines: campaignData.timelines,
  }), [campaignData.characters, campaignData.clues, campaignData.events, campaignData.locations, campaignData.monsters, campaignData.organizations, campaignData.timelines]);

  const resourceNameMaps = useMemo(() => Object.fromEntries(RESOURCE_TYPES.map((type) => [
    type,
    new Map((resourceCollections[type] as Array<{ id: string; name: string }>).map((item) => [item.id, item.name] as const)),
  ])) as Record<GraphEntityType, Map<string, string>>, [resourceCollections]);

  const update = (changes: Partial<GameSession>) => onChange((current) => ({
    ...current,
    ...changes,
    updatedAt: Date.now(),
  }));

  const addGoal = () => {
    const title = newGoal.trim();
    if (!title) return;
    update({ goals: [...session.goals, { id: uuidv4(), title, status: 'pending' }] });
    setNewGoal('');
  };

  const addAgenda = () => {
    const title = newAgendaTitle.trim();
    if (!title) return;
    update({ agenda: [...session.agenda, { id: uuidv4(), title, notes: '', status: 'pending' }] });
    setNewAgendaTitle('');
  };

  const addResource = () => {
    if (!resourceId || session.resourceRefs.some((ref) => ref.entityType === resourceType && ref.entityId === resourceId)) return;
    update({ resourceRefs: [...session.resourceRefs, { entityType: resourceType, entityId: resourceId, usage: '', pinned: false }] });
    setResourceId('');
  };

  const setStatus = (status: GameSessionStatus) => {
    const now = Date.now();
    update({
      status,
      startedAt: status === 'active' ? session.startedAt || now : session.startedAt,
      completedAt: status === 'completed' ? now : undefined,
      playerRecapPublishedAt: status === 'completed' ? session.playerRecapPublishedAt : undefined,
    });
  };

  const incompleteTaskIds = session.taskIds.filter((taskId) => campaignData.sessionTasks.find((task) => task.id === taskId)?.status !== 'done');
  const unfinishedGoalCount = session.goals.filter((goal) => goal.status !== 'completed' && goal.status !== 'dropped').length;
  const unfinishedAgendaCount = session.agenda.filter((item) => item.status !== 'completed' && item.status !== 'skipped').length;
  const plannedAgendaMinutes = session.agenda.reduce((total, item) => total + (item.plannedMinutes ?? 0), 0);

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={() => navigate('/sessions')} className="inline-flex items-center gap-1 rounded-md border border-theme px-3 py-2 text-sm hover:bg-primary-light">
          <ChevronLeft size={17} />场次列表
        </button>
        {canEdit ? (
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => downloadSessionMarkdown(buildGMSessionMarkdown(session, campaignData, members), gameSessionMarkdownFileName(session, false))} className="inline-flex items-center gap-2 rounded-md border border-theme px-3 py-2 text-sm hover:bg-primary-light"><Download size={16} />导出 Markdown</button>
            <button type="button" onClick={onReusePreparation} className="inline-flex items-center gap-2 rounded-md border border-theme px-3 py-2 text-sm hover:bg-primary-light"><Copy size={16} />复用准备结构</button>
            {session.status !== 'active' ? <button type="button" onClick={() => setStatus('active')} className="rounded-md border border-theme px-3 py-2 text-sm hover:bg-primary-light">开始场次</button> : null}
            {session.status !== 'completed' ? <button type="button" onClick={() => setStatus('completed')} className="rounded-md bg-primary px-3 py-2 text-sm text-white hover:bg-primary-dark">结束场次</button> : null}
            {session.status === 'completed' ? <button type="button" onClick={onCreateNext} className="rounded-md border border-theme px-3 py-2 text-sm hover:bg-primary-light">创建下一场</button> : null}
          </div>
        ) : null}
      </header>

      <section className="theme-card space-y-4 rounded-xl border border-theme p-5 shadow-sm">
        <div className="grid gap-4 md:grid-cols-[120px_minmax(0,1fr)_180px]">
          <label className="text-sm">场次序号<input disabled={!canEdit} type="number" min={1} value={session.sessionNumber} onChange={(event) => update({ sessionNumber: Math.max(1, Number(event.target.value) || 1) })} className="mt-1 w-full rounded-md border border-theme bg-transparent px-3 py-2" /></label>
          <label className="text-sm">场次名称<input disabled={!canEdit} value={session.title} onChange={(event) => update({ title: event.target.value })} className="mt-1 w-full rounded-md border border-theme bg-transparent px-3 py-2" /></label>
          <label className="text-sm">状态<select disabled={!canEdit} value={session.status} onChange={(event) => setStatus(event.target.value as GameSessionStatus)} className="mt-1 w-full rounded-md border border-theme bg-theme-card px-3 py-2">{Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <label className="text-sm">现实时间<input disabled={!canEdit} type="datetime-local" value={session.scheduledAt} onChange={(event) => update({ scheduledAt: event.target.value })} className="mt-1 w-full rounded-md border border-theme bg-transparent px-3 py-2" /></label>
          <label className="text-sm">世界内日期<input disabled={!canEdit} value={session.inWorldDate} onChange={(event) => update({ inWorldDate: event.target.value })} placeholder="例如：霜月 12 日" className="mt-1 w-full rounded-md border border-theme bg-transparent px-3 py-2" /></label>
          <div className="text-sm theme-text-secondary"><div>开始：{formatDateTime(session.startedAt)}</div><div className="mt-2">结束：{formatDateTime(session.completedAt)}</div></div>
        </div>
        <label className="block text-sm">场次简介<textarea disabled={!canEdit} value={session.summary} onChange={(event) => update({ summary: event.target.value })} rows={3} className="mt-1 w-full resize-y rounded-md border border-theme bg-transparent px-3 py-2" /></label>
      </section>

      <div className="grid gap-5 xl:grid-cols-2">
        <section className="theme-card space-y-3 rounded-xl border border-theme p-5">
          <div className="flex items-center justify-between"><h3 className="font-semibold">本场目标</h3><span className="text-xs theme-text-secondary">未完成 {unfinishedGoalCount}</span></div>
          {session.goals.map((goal, index) => (
            <div key={goal.id} className="grid gap-2 rounded-lg border border-theme p-3 sm:grid-cols-[140px_minmax(0,1fr)_auto]">
              <select disabled={!canEdit} value={goal.status} onChange={(event) => update({ goals: session.goals.map((item) => item.id === goal.id ? { ...item, status: event.target.value as GameSessionGoalStatus } : item) })} className="rounded-md border border-theme bg-theme-card px-2 py-2 text-sm">{Object.entries(GOAL_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
              <input disabled={!canEdit} value={goal.title} onChange={(event) => update({ goals: session.goals.map((item) => item.id === goal.id ? { ...item, title: event.target.value } : item) })} className="rounded-md border border-theme bg-transparent px-3 py-2 text-sm" />
              {canEdit ? <div className="flex items-center justify-end gap-1">
                <button type="button" disabled={index === 0} onClick={() => update({ goals: moveItem(session.goals, index, index - 1) })} className="rounded p-2 theme-text-secondary hover:bg-primary-light disabled:cursor-not-allowed disabled:opacity-30" aria-label={`上移目标：${goal.title}`}><ArrowUp size={16} /></button>
                <button type="button" disabled={index === session.goals.length - 1} onClick={() => update({ goals: moveItem(session.goals, index, index + 1) })} className="rounded p-2 theme-text-secondary hover:bg-primary-light disabled:cursor-not-allowed disabled:opacity-30" aria-label={`下移目标：${goal.title}`}><ArrowDown size={16} /></button>
                <button type="button" onClick={() => update({ goals: session.goals.filter((item) => item.id !== goal.id) })} className="rounded p-2 text-red-600 hover:bg-red-50" aria-label="删除目标"><Trash2 size={16} /></button>
              </div> : null}
            </div>
          ))}
          {canEdit ? <div className="flex gap-2"><input value={newGoal} onChange={(event) => setNewGoal(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') addGoal(); }} placeholder="新增场次目标" className="min-w-0 flex-1 rounded-md border border-theme bg-transparent px-3 py-2 text-sm" /><button type="button" onClick={addGoal} className="rounded-md border border-theme px-3 hover:bg-primary-light">添加</button></div> : null}
        </section>

        <section className="theme-card space-y-3 rounded-xl border border-theme p-5">
          <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">流程提纲</h3><span className="text-xs theme-text-secondary">预计 {formatDuration(plannedAgendaMinutes)} · 待处理 {unfinishedAgendaCount}</span></div>
          {session.agenda.map((agenda, index) => (
            <div key={agenda.id} className="space-y-2 rounded-lg border border-theme p-3">
              <div className="flex gap-2">
                <select disabled={!canEdit} value={agenda.status} onChange={(event) => update({ agenda: session.agenda.map((item) => item.id === agenda.id ? { ...item, status: event.target.value as GameSessionAgendaStatus } : item) })} className="w-32 rounded-md border border-theme bg-theme-card px-2 py-2 text-sm">{Object.entries(AGENDA_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
                <input disabled={!canEdit} value={agenda.title} onChange={(event) => update({ agenda: session.agenda.map((item) => item.id === agenda.id ? { ...item, title: event.target.value } : item) })} className="min-w-0 flex-1 rounded-md border border-theme bg-transparent px-3 py-2 text-sm" />
                {canEdit ? <div className="flex items-center gap-1">
                  <button type="button" disabled={index === 0} onClick={() => update({ agenda: moveItem(session.agenda, index, index - 1) })} className="rounded p-2 theme-text-secondary hover:bg-primary-light disabled:cursor-not-allowed disabled:opacity-30" aria-label={`上移流程：${agenda.title}`}><ArrowUp size={16} /></button>
                  <button type="button" disabled={index === session.agenda.length - 1} onClick={() => update({ agenda: moveItem(session.agenda, index, index + 1) })} className="rounded p-2 theme-text-secondary hover:bg-primary-light disabled:cursor-not-allowed disabled:opacity-30" aria-label={`下移流程：${agenda.title}`}><ArrowDown size={16} /></button>
                  <button type="button" onClick={() => update({ agenda: session.agenda.filter((item) => item.id !== agenda.id) })} className="rounded p-2 text-red-600 hover:bg-red-50" aria-label="删除流程"><Trash2 size={16} /></button>
                </div> : null}
              </div>
              <div className="grid gap-2 sm:grid-cols-[120px_minmax(0,1fr)]">
                <label className="text-xs theme-text-secondary">预计分钟
                  <input disabled={!canEdit} type="number" min={1} step={5} value={agenda.plannedMinutes ?? ''} onChange={(event) => {
                    const value = Number(event.target.value);
                    update({ agenda: session.agenda.map((item) => item.id === agenda.id ? { ...item, plannedMinutes: event.target.value && Number.isFinite(value) && value > 0 ? Math.trunc(value) : undefined } : item) });
                  }} className="mt-1 w-full rounded-md border border-theme bg-transparent px-3 py-2 text-sm" />
                </label>
                <label className="text-xs theme-text-secondary">节点说明
                  <textarea disabled={!canEdit} value={agenda.notes} onChange={(event) => update({ agenda: session.agenda.map((item) => item.id === agenda.id ? { ...item, notes: event.target.value } : item) })} rows={2} placeholder="节点说明或备用方案" className="mt-1 w-full resize-y rounded-md border border-theme bg-transparent px-3 py-2 text-sm" />
                </label>
              </div>
            </div>
          ))}
          {canEdit ? <div className="flex gap-2"><input value={newAgendaTitle} onChange={(event) => setNewAgendaTitle(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') addAgenda(); }} placeholder="新增流程节点" className="min-w-0 flex-1 rounded-md border border-theme bg-transparent px-3 py-2 text-sm" /><button type="button" onClick={addAgenda} className="rounded-md border border-theme px-3 hover:bg-primary-light">添加</button></div> : null}
        </section>
      </div>

      <section className="theme-card space-y-4 rounded-xl border border-theme p-5">
        <h3 className="font-semibold">本场资料架</h3>
        {canEdit ? (
          <div className="grid gap-2 md:grid-cols-[150px_minmax(0,1fr)_auto]">
            <select value={resourceType} onChange={(event) => { setResourceType(event.target.value as GraphEntityType); setResourceId(''); }} className="rounded-md border border-theme bg-theme-card px-3 py-2">{RESOURCE_TYPES.map((type) => <option key={type} value={type}>{RESOURCE_TYPE_LABELS[type]}</option>)}</select>
            <select value={resourceId} onChange={(event) => setResourceId(event.target.value)} className="rounded-md border border-theme bg-theme-card px-3 py-2"><option value="">选择已有资料</option>{resourceCollections[resourceType].map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
            <button type="button" onClick={addResource} disabled={!resourceId} className="rounded-md border border-theme px-4 py-2 disabled:opacity-50 hover:bg-primary-light">加入</button>
          </div>
        ) : null}
        <div className="grid gap-3 md:grid-cols-2">
          {session.resourceRefs.map((ref) => (
            <div key={`${ref.entityType}:${ref.entityId}`} className="rounded-lg border border-theme p-3">
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => navigate(routeForResource(ref))} className="min-w-0 flex-1 text-left font-medium hover:text-primary"><span className="text-xs theme-text-secondary">{RESOURCE_TYPE_LABELS[ref.entityType]} · </span>{resourceNameMaps[ref.entityType].get(ref.entityId) || '资料已删除'} <ExternalLink className="inline" size={13} /></button>
                {canEdit ? <button type="button" onClick={() => update({ resourceRefs: session.resourceRefs.map((item) => item === ref ? { ...item, pinned: !item.pinned } : item) })} className={`rounded p-2 ${ref.pinned ? 'text-primary bg-primary-light' : 'theme-text-secondary hover:bg-primary-light'}`} aria-label={ref.pinned ? '取消置顶' : '置顶'}><Pin size={15} /></button> : null}
                {canEdit ? <button type="button" onClick={() => update({ resourceRefs: session.resourceRefs.filter((item) => item !== ref) })} className="rounded p-2 text-red-600 hover:bg-red-50" aria-label="移除资料"><Trash2 size={15} /></button> : null}
              </div>
              <input disabled={!canEdit} value={ref.usage} onChange={(event) => update({ resourceRefs: session.resourceRefs.map((item) => item === ref ? { ...item, usage: event.target.value } : item) })} placeholder="填写本场用途" className="mt-2 w-full rounded-md border border-theme bg-transparent px-3 py-2 text-sm" />
            </div>
          ))}
          {session.resourceRefs.length === 0 ? <p className="text-sm theme-text-secondary">尚未加入本场资料。</p> : null}
        </div>
      </section>

      <section className="theme-card space-y-4 rounded-xl border border-theme p-5">
        <h3 className="font-semibold">关联任务</h3>
        <div className="grid gap-2 md:grid-cols-2">
          {campaignData.sessionTasks.map((task) => {
            const selected = session.taskIds.includes(task.id);
            return <label key={task.id} className="flex items-start gap-2 rounded-lg border border-theme p-3 text-sm"><input disabled={!canEdit} type="checkbox" checked={selected} onChange={() => update({ taskIds: selected ? session.taskIds.filter((id) => id !== task.id) : [...session.taskIds, task.id] })} className="mt-1" /><span><span className="font-medium">{task.title}</span><span className="ml-2 text-xs theme-text-secondary">{TASK_STATUS_LABELS[task.status]}</span></span></label>;
          })}
          {campaignData.sessionTasks.length === 0 ? <p className="text-sm theme-text-secondary">任务板中还没有任务。</p> : null}
        </div>
        <div className="text-xs theme-text-secondary">已关联 {session.taskIds.length} 项，其中未完成 {incompleteTaskIds.length} 项。任务状态仍在任务看板中维护。</div>
      </section>

      <section className="theme-card space-y-4 rounded-xl border border-theme p-5">
        <h3 className="font-semibold">参与成员</h3>
        <div className="flex flex-wrap gap-3">
          {members.map((member) => {
            const selected = session.participantUserIds.includes(member.userId);
            return <label key={member.userId} className="inline-flex items-center gap-2 rounded-full border border-theme px-3 py-2 text-sm"><input disabled={!canEdit} type="checkbox" checked={selected} onChange={() => update({ participantUserIds: selected ? session.participantUserIds.filter((id) => id !== member.userId) : [...session.participantUserIds, member.userId] })} />{member.username}</label>;
          })}
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-2">
        <label className="theme-card block rounded-xl border border-theme p-5 text-sm"><span className="font-semibold">现场记录</span><textarea disabled={!canEdit} value={session.liveNotes} onChange={(event) => update({ liveNotes: event.target.value })} rows={14} placeholder="记录玩家决定、实际发生内容和临时信息……" className="mt-3 w-full resize-y rounded-md border border-theme bg-transparent px-3 py-2 leading-7" /></label>
        <label className="theme-card block rounded-xl border border-theme p-5 text-sm"><span className="font-semibold">未解决问题</span><textarea disabled={!canEdit} value={session.unresolvedItems} onChange={(event) => update({ unresolvedItems: event.target.value })} rows={14} placeholder="每行记录一个需要带到下一场或稍后处理的问题……" className="mt-3 w-full resize-y rounded-md border border-theme bg-transparent px-3 py-2 leading-7" /></label>
      </div>

      <section className="theme-card space-y-4 rounded-xl border border-theme p-5">
        <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">结束与复盘</h3><div className="text-xs theme-text-secondary">未完成目标 {unfinishedGoalCount} · 待处理流程 {unfinishedAgendaCount} · 未完成任务 {incompleteTaskIds.length}</div></div>
        <div className="grid gap-5 xl:grid-cols-2">
          <label className="block text-sm">GM 私有总结<textarea disabled={!canEdit} value={session.gmSummary} onChange={(event) => update({ gmSummary: event.target.value })} rows={8} className="mt-2 w-full resize-y rounded-md border border-theme bg-transparent px-3 py-2" /></label>
          <div className="space-y-2 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span>玩家版回顾</span>
              {canEdit ? (
                session.playerRecapPublishedAt ? (
                  <button type="button" onClick={() => update({ playerRecapPublishedAt: undefined })} className="rounded-md border border-theme px-3 py-1.5 hover:bg-primary-light">撤回发布</button>
                ) : (
                  <button type="button" onClick={() => update({ playerRecapPublishedAt: Date.now() })} disabled={session.status !== 'completed' || !session.playerRecap.trim()} className="rounded-md bg-primary px-3 py-1.5 text-white hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50">发布给玩家</button>
                )
              ) : null}
            </div>
            <textarea disabled={!canEdit} value={session.playerRecap} onChange={(event) => update({ playerRecap: event.target.value })} rows={8} className="w-full resize-y rounded-md border border-theme bg-transparent px-3 py-2" />
            <p className="text-xs theme-text-secondary">
              {session.playerRecapPublishedAt
                ? `已于 ${formatDateTime(session.playerRecapPublishedAt)} 发布；后续编辑会同步到玩家视图。`
                : session.status !== 'completed' ? '结束场次后才能发布。' : '填写回顾后即可发布。'}
            </p>
          </div>
        </div>
      </section>

      {canEdit ? (
        <div className="flex justify-end">
          <button type="button" onClick={onDelete} className="inline-flex items-center gap-2 rounded-md border border-red-300 px-3 py-2 text-sm text-red-600 hover:bg-red-50"><Trash2 size={16} />删除场次</button>
        </div>
      ) : null}
    </div>
  );
}

export default function GameSessions() {
  const { campaignData, setCampaignData } = useCampaignData();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { canManageCampaignContent, config } = useCampaignMemberRole();
  const sessions = useMemo(() => campaignData.gameSessions ?? [], [campaignData.gameSessions]);
  const accessibleSessions = useMemo(() => canManageCampaignContent
    ? sessions
    : sessions.filter((item) => item.status === 'completed' && Boolean(item.playerRecapPublishedAt) && Boolean(item.playerRecap.trim())),
  [canManageCampaignContent, sessions]);
  const session = id ? accessibleSessions.find((item) => item.id === id) : undefined;

  const updateSession = (updater: (current: GameSession) => GameSession) => {
    if (!session || !canManageCampaignContent) return;
    setCampaignData((current) => ({
      ...current,
      gameSessions: (current.gameSessions ?? []).map((item) => item.id === session.id ? updater(item) : item),
    }));
  };

  const createSession = (base?: GameSession) => {
    if (!canManageCampaignContent) return;
    const nextNumber = sessions.reduce((maximum, item) => Math.max(maximum, item.sessionNumber), 0) + 1;
    const next = createGameSession(nextNumber);
    if (base) {
      next.summary = base.unresolvedItems.trim() ? `上场遗留：\n${base.unresolvedItems.trim()}` : '';
      next.goals = base.goals.filter((goal) => goal.status !== 'completed' && goal.status !== 'dropped').map((goal) => ({ ...goal, id: uuidv4(), status: 'pending' }));
      next.agenda = base.agenda.filter((item) => item.status === 'deferred').map((item) => ({ ...item, id: uuidv4(), status: 'pending' }));
      next.taskIds = base.taskIds.filter((taskId) => campaignData.sessionTasks.find((task) => task.id === taskId)?.status !== 'done');
      next.resourceRefs = base.resourceRefs.filter((ref) => ref.pinned).map((ref) => ({ ...ref }));
    }
    setCampaignData((current) => ({ ...current, gameSessions: [...(current.gameSessions ?? []), next] }));
    navigate(`/sessions/${next.id}`);
  };

  const deleteSession = () => {
    if (!session || !canManageCampaignContent || !window.confirm(`确定删除场次“${session.title}”吗？`)) return;
    setCampaignData((current) => ({ ...current, gameSessions: (current.gameSessions ?? []).filter((item) => item.id !== session.id) }));
    navigate('/sessions');
  };

  const reusePreparation = () => {
    if (!session || !canManageCampaignContent) return;
    const nextNumber = sessions.reduce((maximum, item) => Math.max(maximum, item.sessionNumber), 0) + 1;
    const next = createGameSessionFromPreparation(session, nextNumber);
    setCampaignData((current) => ({ ...current, gameSessions: [...(current.gameSessions ?? []), next] }));
    navigate(`/sessions/${next.id}`);
  };

  if (id && !session) {
    return <div className="rounded-xl border border-dashed border-theme bg-theme-card p-10 text-center"><p>场次不存在或已被删除。</p><button type="button" onClick={() => navigate('/sessions')} className="mt-4 rounded-md border border-theme px-3 py-2 hover:bg-primary-light">返回场次列表</button></div>;
  }

  if (!session) {
    return <SessionList sessions={accessibleSessions} canEdit={canManageCampaignContent} playerView={!canManageCampaignContent} onCreate={() => createSession()} onOpen={(sessionId) => navigate(`/sessions/${sessionId}`)} />;
  }

  if (!canManageCampaignContent) return <PlayerSessionDetail session={session} />;

  return <SessionDetail session={session} canEdit={canManageCampaignContent} campaignData={campaignData} members={config?.members ?? []} onChange={updateSession} onDelete={deleteSession} onCreateNext={() => createSession(session)} onReusePreparation={reusePreparation} />;
}
