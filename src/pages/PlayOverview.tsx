import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ExternalLink } from 'lucide-react';
import { useCampaignData, useCampaignSession, useCampaignTabs } from '../context/CampaignContext';
import { useCampaignMemberRole } from '../hooks/useCampaignMemberRole';
import { queryKeys } from '../query/queryKeys';
import { teamNotesService } from '../services/teamNotesService';
import { sessionTaskBoardService } from '../services/sessionTaskBoardService';
import { sharingService } from '../services/sharingService';
import { markdownToPreviewText } from '../components/common/richTextReference';

const taskLabels = { todo: '待准备', in_progress: '进行中', done: '已完成' };
const clueLabels = { untracked: '待发现', investigating: '调查中', revealed: '已揭秘' };

export default function PlayOverview() {
  const { campaignData } = useCampaignData();
  const { currentCampaignId, user } = useCampaignSession();
  const { openInTab } = useCampaignTabs();
  const { canManageCampaignContent, configQuery } = useCampaignMemberRole();
  const campaignId = currentCampaignId || '';
  const enabled = Boolean(campaignId && user && configQuery.isSuccess);
  const notesQuery = useQuery({
    queryKey: queryKeys.campaigns.teamNotes(campaignId, user?.id),
    queryFn: () => teamNotesService.listTeamNotes(campaignId, user),
    enabled, refetchInterval: 15_000,
  });
  const tasksQuery = useQuery({
    queryKey: queryKeys.campaigns.sessionTasks(campaignId, user?.id),
    queryFn: () => sessionTaskBoardService.getTaskBoard(campaignId, user),
    enabled, refetchInterval: 15_000,
  });
  const sharesQuery = useQuery({
    queryKey: queryKeys.campaigns.shares(campaignId, 'received', user?.id),
    queryFn: () => sharingService.listReceivedShares(campaignId, user),
    enabled, refetchInterval: 15_000,
  });
  const notes = useMemo(() => [...(notesQuery.data || [])].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 4)
    .map((note) => ({ ...note, preview: markdownToPreviewText(note.content).slice(0, 100) })), [notesQuery.data]);
  const canViewTasks = canManageCampaignContent || tasksQuery.data?.plCanView !== false;
  const tasks = canViewTasks && !tasksQuery.isError ? (tasksQuery.data?.tasks || []).filter((task) => task.status !== 'done') : [];
  const clues = canManageCampaignContent ? [...campaignData.clues].sort((a, b) => b.updatedAt - a.updatedAt) : [];
  const sharedClues = sharesQuery.isError ? [] : (sharesQuery.data || []).filter((share) => share.targetUserId === user?.id && share.entityType === 'clues');
  const sessions = [...(campaignData.gameSessions || [])]
    .filter((session) => canManageCampaignContent || (session.status === 'completed' && session.playerRecapPublishedAt && session.playerRecap.trim()))
    .sort((a, b) => Number(b.status === 'active') - Number(a.status === 'active') || b.updatedAt - a.updatedAt);
  const refreshing = notesQuery.isFetching || tasksQuery.isFetching || sharesQuery.isFetching;

  if (configQuery.isPending) return <p className="theme-text-secondary">正在读取工作台权限…</p>;
  if (configQuery.isError) return <div role="alert" className="rounded border border-theme p-4">无法读取工作台权限。<button type="button" onClick={() => void configQuery.refetch()} className="ml-2 text-primary">重试</button></div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm theme-text-secondary">{canManageCampaignContent ? '主持人视图 · 单人使用时可直接整理，不需要添加成员。' : '玩家视图 · 仅展示当前已授权的内容。'}</p>
        <button type="button" disabled={refreshing} onClick={() => { void notesQuery.refetch(); void tasksQuery.refetch(); void sharesQuery.refetch(); }} className="rounded border border-theme px-3 py-1.5 text-sm hover:bg-primary-light disabled:opacity-50">{refreshing ? '刷新中…' : '刷新协作内容'}</button>
      </div>
      <div className="workbench-grid">
        <section className="workbench-section">
          <div className="workbench-section__header">
            <h2 className="font-semibold">待推进任务{tasksQuery.isSuccess && canViewTasks ? ` · ${tasks.length}` : ''}</h2>
            <Link to="/session-tasks">打开看板 →</Link>
          </div>
          {tasksQuery.isError ? <p role="status" className="workbench-empty">任务看板不可用或未获授权，请进入看板查看详情。</p>
            : !canViewTasks ? <p className="workbench-empty">主持人尚未开放任务看板。</p>
            : tasksQuery.isPending ? <p className="workbench-empty">正在读取任务…</p>
            : tasks.length === 0 ? <p className="workbench-empty">暂无待推进任务。</p>
            : <ul>{tasks.slice(0, 5).map((task) => (
              <li key={task.id} className="workbench-row">
                <div className="min-w-0">
                  <p className="break-words font-medium">{task.title}</p>
                  {task.description && <p className="mt-1 line-clamp-2 whitespace-pre-wrap break-words text-xs theme-text-secondary">{task.description}</p>}
                </div>
                <span className="shrink-0 text-xs theme-text-secondary">{taskLabels[task.status]}</span>
              </li>
            ))}</ul>}
        </section>
        <section className="workbench-section">
          <div className="workbench-section__header">
            <h2 className="font-semibold">{canManageCampaignContent ? '近期线索' : '收到的线索'}</h2>
            <Link to="/clues">全部线索 →</Link>
          </div>
          <div>
            {clues.slice(0, 5).map((clue) => (
              <button key={clue.id} type="button" onClick={() => openInTab('clues', clue.id, clue.name)} className="workbench-row workbench-row--link">
                <span className="min-w-0 truncate">{clue.name}</span>
                <span className="flex shrink-0 items-center gap-2 text-xs theme-text-secondary">{clueLabels[clue.revealStatus || 'untracked']}<ExternalLink size={14} /></span>
              </button>
            ))}
            {sharedClues.slice(0, 5).map((share) => (
              <button key={share.id} type="button" onClick={() => openInTab('clues', `shared:${share.id}`, share.entityName)} className="workbench-row workbench-row--link">
                <span className="min-w-0 truncate">{share.entityName}</span>
                <span className="flex shrink-0 items-center gap-2 text-xs theme-text-secondary">已分享<ExternalLink size={14} /></span>
              </button>
            ))}
            {sharesQuery.isError ? <p role="status" className="workbench-empty">共享线索读取失败，请刷新重试。</p>
              : !clues.length && !sharedClues.length && <p className="workbench-empty">{sharesQuery.isPending ? '正在读取线索…' : canManageCampaignContent ? '暂无线索，可在“线索”栏目新建。' : '尚未收到线索，请等待主持人分享。'}</p>}
          </div>
        </section>
        <section className="workbench-section">
          <div className="workbench-section__header">
            <h2 className="font-semibold">最近笔记</h2>
            <Link to="/team-notes">全部笔记 →</Link>
          </div>
          {notesQuery.isError ? <p role="status" className="workbench-empty">笔记读取失败，请刷新重试。</p>
            : notesQuery.isPending ? <p className="workbench-empty">正在读取笔记…</p>
            : notes.length === 0 ? <p className="workbench-empty">还没有笔记，进入“笔记”栏目记录第一条。</p>
            : <div>{notes.map((note) => (
              <Link key={note.id} to={`/team-notes?noteId=${encodeURIComponent(note.id)}`} className="workbench-row workbench-row--link">
                <div className="min-w-0">
                  <p className="truncate font-medium">{note.title || '未命名笔记'}</p>
                  <p className="mt-1 line-clamp-2 break-words text-xs theme-text-secondary">{note.preview || '暂无正文'}</p>
                </div>
                <ExternalLink size={14} className="shrink-0 theme-text-secondary" />
              </Link>
            ))}</div>}
        </section>
        <section className="workbench-section">
          <div className="workbench-section__header">
            <h2 className="font-semibold">{canManageCampaignContent ? '当前与最近场次' : '场次回顾'}</h2>
            <Link to="/sessions">全部场次 →</Link>
          </div>
          {sessions.length === 0 ? <p className="workbench-empty">{canManageCampaignContent ? '暂无场次，可按需要创建；不影响单人整理线索和笔记。' : '主持人尚未发布场次回顾。'}</p>
            : <div>{sessions.slice(0, 4).map((session) => (
              <Link key={session.id} to={`/sessions/${session.id}`} className="workbench-row workbench-row--link">
                <span className="min-w-0 truncate">{session.title}</span>
                <span className="shrink-0 text-xs theme-text-secondary">{session.status === 'active' ? '进行中' : session.status === 'completed' ? '已结束' : '准备中'}</span>
              </Link>
            ))}</div>}
        </section>
      </div>
    </div>
  );
}
