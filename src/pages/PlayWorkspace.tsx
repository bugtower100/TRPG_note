import { Suspense, useRef, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Search, Kanban, NotebookPen, CalendarDays } from 'lucide-react';
import { useCampaignMemberRole } from '../hooks/useCampaignMemberRole';
import { WorkspaceLeaveContext } from '../hooks/useWorkspaceLeaveGuard';

export default function PlayWorkspace() {
  const { canManageCampaignContent } = useCampaignMemberRole();
  const navigate = useNavigate();
  const leaveGuard = useRef<(() => Promise<boolean>) | null>(null);
  const [switching, setSwitching] = useState(false);
  const [switchError, setSwitchError] = useState('');
  const tabs = [
    { to: '/play', label: '总览', icon: LayoutDashboard },
    { to: '/clues', label: '线索', icon: Search },
    { to: '/session-tasks', label: '任务', icon: Kanban },
    { to: '/team-notes', label: '笔记', icon: NotebookPen },
    { to: '/sessions', label: canManageCampaignContent ? '场次' : '场次回顾', icon: CalendarDays },
  ];

  return (
    <div className="play-workspace">
      <header data-tour="play-workspace" className="play-workspace__header">
        <h1 className="text-2xl font-semibold tracking-tight">跑团工作台</h1>
        <p className="mt-1 text-sm theme-text-secondary">
          {canManageCampaignContent ? '线索、任务、笔记和跑团场次。' : '查看已分享的线索、跟进任务、记录笔记和阅读场次回顾。'}
        </p>
        <nav aria-label="工作台栏目" className="play-workspace__tabs">
          {tabs.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} end={to === '/play'} onClick={async (event) => {
              if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
              if (switching) { event.preventDefault(); return; }
              if (!leaveGuard.current) { setSwitchError(''); return; }
              event.preventDefault();
              setSwitching(true);
              setSwitchError('');
              try {
                if (await leaveGuard.current()) navigate(to);
                else setSwitchError('当前内容尚未保存，已留在本栏目。请处理保存提示后再切换。');
              } catch {
                setSwitchError('保存失败，已保留当前栏目，请处理后再切换。');
              } finally { setSwitching(false); }
            }} className={({ isActive }) => `play-workspace__tab ${isActive ? 'is-active' : ''}`}>
              <Icon size={16} />{label}
            </NavLink>
          ))}
        </nav>
        {switching && <p role="status" className="mt-2 text-sm theme-text-secondary">正在保存当前内容…</p>}
        {switchError && <p role="alert" className="mt-2 text-sm text-red-600">{switchError}</p>}
      </header>
      <WorkspaceLeaveContext.Provider value={leaveGuard}>
        <Suspense fallback={<p className="py-8 text-sm theme-text-secondary">正在加载栏目…</p>}>
          <Outlet />
        </Suspense>
      </WorkspaceLeaveContext.Provider>
    </div>
  );
}
