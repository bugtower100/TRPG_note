import React, { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import TabPanel from './TabPanel';
import { useCampaign } from '../context/CampaignContext';
import { GuideHelpButton, GuideId } from './common/InteractiveGuide';

const Layout: React.FC = () => {
  const { tabs, exportData, importData } = useCampaign();
  const location = useLocation();
  const [isTabPanelMaximized, setIsTabPanelMaximized] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [mobileTabsOpen, setMobileTabsOpen] = useState(false);
  const [backendStatus, setBackendStatus] = useState<{ online: boolean; offlineSince?: number; syncedAt?: number; conflicts?: Array<{ key: string; localTime?: number; remoteTime?: number }>; unsyncedCount?: number; latencyMs?: number } | null>(null);
  const [showConflicts, setShowConflicts] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const mobileSidebarRef = React.useRef<HTMLDivElement>(null);
  const mobileTabsRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 767px)');
    const apply = () => setIsMobile(mediaQuery.matches);
    apply();
    mediaQuery.addEventListener('change', apply);
    return () => mediaQuery.removeEventListener('change', apply);
  }, []);

  useEffect(() => {
    if (tabs.length === 0) {
      setIsTabPanelMaximized(false);
      setMobileTabsOpen(false);
    }
  }, [tabs.length]);

  useEffect(() => {
    if (!isMobile) return;
    setMobileSidebarOpen(false);
    setMobileTabsOpen(false);
  }, [isMobile, location.pathname]);

  useEffect(() => {
    if (!isMobile) return;
    const previousOverflow = document.body.style.overflow;
    if (mobileSidebarOpen || mobileTabsOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = previousOverflow || '';
    }
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isMobile, mobileSidebarOpen, mobileTabsOpen]);

  useEffect(() => {
    if (!isMobile) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (mobileTabsOpen) {
          setMobileTabsOpen(false);
          return;
        }
        if (mobileSidebarOpen) {
          setMobileSidebarOpen(false);
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isMobile, mobileSidebarOpen, mobileTabsOpen]);


  useEffect(() => {
    const activeDrawer = mobileTabsOpen ? mobileTabsRef.current : mobileSidebarOpen ? mobileSidebarRef.current : null;
    if (!isMobile || !activeDrawer) return;
    const focusable = activeDrawer.querySelector<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    focusable?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const focusables = Array.from(activeDrawer.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'))
        .filter((element) => !element.hasAttribute('disabled'));
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    activeDrawer.addEventListener('keydown', handleKeyDown);
    return () => activeDrawer.removeEventListener('keydown', handleKeyDown);
  }, [isMobile, mobileSidebarOpen, mobileTabsOpen]);

  useEffect(() => {
    const handler = (e: Event) => {
      const any = e as any;
      setBackendStatus(any.detail);
    };
    window.addEventListener('storage-backend-status', handler as any);
    (async () => {
      try {
        const res = await fetch('/api/storage/health');
        if (res.ok) {
          const t0 = Date.now();
          setBackendStatus({ online: true, syncedAt: Date.now(), conflicts: [], unsyncedCount: 0, latencyMs: Date.now() - t0 });
        } else {
          setBackendStatus({ online: false, offlineSince: Date.now(), unsyncedCount: 0, latencyMs: undefined });
        }
      } catch {
        setBackendStatus({ online: false, offlineSince: Date.now(), unsyncedCount: 0, latencyMs: undefined });
      }
    })();
    return () => {
      window.removeEventListener('storage-backend-status', handler as any);
    };
  }, []);

  const currentGuideId = React.useMemo<GuideId | null>(() => {
    const { pathname } = location;
    if (pathname === '/') return null;
    if (pathname === '/settings') return 'settings';
    if (pathname === '/relation-graphs') return 'relation-graphs';
    if (pathname === '/team-notes') return 'team-notes';
    if (/^\/(characters|monsters|locations|organizations|events|clues|timelines)\/(shared\/[^/]+|[^/]+)$/.test(pathname)) {
      return 'entity-detail';
    }
    if (/^\/(characters|monsters|locations|organizations|events|clues|timelines)$/.test(pathname)) {
      return 'entity-list';
    }
    return null;
  }, [location]);

  return (
    <div className="flex h-screen overflow-hidden theme-page">
      {!isMobile && <Sidebar className="fixed left-0 top-0 h-screen" />}
      {isMobile && (
        <>
          {mobileSidebarOpen && <div className="drawer-overlay" onClick={() => setMobileSidebarOpen(false)} aria-hidden="true" />}
          <div ref={mobileSidebarRef} className={`drawer ${mobileSidebarOpen ? 'drawer-open' : ''}`} role="dialog" aria-label="侧边导航" aria-modal="true">
            <Sidebar
              className="h-full"
              onNavigate={() => setMobileSidebarOpen(false)}
            />
          </div>
        </>
      )}
      <main className={`flex-1 flex overflow-hidden ${!isMobile ? 'ml-56' : ''}`}>
        <div className={`absolute ${!isMobile ? 'left-56' : 'left-0'} right-0 top-0 z-50`}>
          {backendStatus?.online === false ? (
            <div className="bg-red-600 text-white px-4 py-2 text-sm flex items-center justify-between">
              <span>
                当前无法连接后端，正在使用浏览器缓存。本地修改将保存在浏览器中，连接恢复后会自动同步。
                {typeof backendStatus?.unsyncedCount === 'number' ? ` 离线未同步键数：${backendStatus.unsyncedCount}` : ''}
              </span>
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".json"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) await importData(file);
                    e.currentTarget.value = '';
                  }}
                />
                <button className="px-2 py-1 bg-white text-red-700 rounded text-xs" onClick={() => exportData()}>
                  导出当前模组
                </button>
                <button className="px-2 py-1 bg-white text-red-700 rounded text-xs" onClick={() => fileInputRef.current?.click()}>
                  导入 JSON
                </button>
              </div>
            </div>
          ) : backendStatus?.online === true && backendStatus?.conflicts && backendStatus.conflicts.length > 0 ? (
            <div className="bg-yellow-500 text-black px-4 py-2 text-sm flex items-center justify-between">
              <span>检测到存档版本差异，条目数：{backendStatus.conflicts.length}。最近同步时间：{backendStatus.syncedAt ? new Date(backendStatus.syncedAt).toLocaleString() : ''}</span>
              <button className="px-2 py-1 border border-black/20 rounded bg-white text-black text-xs" onClick={() => setShowConflicts((v) => !v)}>
                {showConflicts ? '收起' : '查看详情'}
              </button>
            </div>
          ) : null}
        </div>
        <div className={`fixed z-40 ${isMobile ? 'right-3 bottom-4' : 'right-4 bottom-3'}`}>
          <span className={`px-2 py-1 rounded text-xs shadow-sm ${backendStatus?.online ? 'bg-green-600 text-white' : 'bg-gray-700 text-white'}`}>
            {backendStatus?.online ? '在线' : '离线'}{backendStatus?.online && typeof backendStatus?.latencyMs === 'number' ? ` ${backendStatus.latencyMs}ms` : ''}
            {backendStatus?.online ? '' : (typeof backendStatus?.unsyncedCount === 'number' ? `（未同步${backendStatus.unsyncedCount}）` : '')}
          </span>
        </div>
        {currentGuideId && (
          <div className={`absolute z-50 ${isMobile ? 'right-3 top-14' : 'right-4 top-2'}`}>
            <GuideHelpButton guideId={currentGuideId} />
          </div>
        )}
        {showConflicts && backendStatus?.conflicts && backendStatus.conflicts.length > 0 && (
          <div className={`absolute ${!isMobile ? 'left-56' : 'left-0'} right-0 top-10 z-40 bg-white border border-yellow-500 rounded shadow p-3 text-xs`}>
            {backendStatus.conflicts.map((c) => (
              <div key={c.key} className="py-1 flex items-center justify-between">
                <span className="font-medium break-all">{c.key}</span>
                <span className="ml-2">云端：{c.remoteTime ? new Date(c.remoteTime).toLocaleString() : '未知'}</span>
                <span className="ml-2">本地：{c.localTime ? new Date(c.localTime).toLocaleString() : '未知'}</span>
              </div>
            ))}
          </div>
        )}
        {isMobile && (
          <div className="topbar-mobile">
            <button className="hamburger" onClick={() => setMobileSidebarOpen(true)} aria-label="打开侧边栏">≡</button>
            <div className="flex-1 text-center text-sm font-medium">TRPG 模组</div>
            {tabs.length > 0 ? (
              <button className="hamburger" onClick={() => setMobileTabsOpen(true)} aria-label="打开右侧面板">
                {tabs.length}
              </button>
            ) : (
              <div style={{ width: 36 }} />
            )}
          </div>
        )}
        <div className={`flex-1 overflow-y-auto p-8 ${isMobile ? 'pt-14' : 'pt-16'} ${tabs.length > 0 && !isTabPanelMaximized && !isMobile ? 'border-r border-theme' : ''} ${isTabPanelMaximized && !isMobile ? 'hidden' : ''}`}>
          <Outlet />
        </div>
        {!isMobile ? (
          <TabPanel
            maximized={isTabPanelMaximized}
            onToggleMaximize={() => setIsTabPanelMaximized((prev) => !prev)}
          />
        ) : (
          <>
            {mobileTabsOpen && <div className="drawer-overlay" onClick={() => setMobileTabsOpen(false)} aria-hidden="true" />}
            <div ref={mobileTabsRef} className={`drawer drawer-right ${mobileTabsOpen ? 'drawer-open' : ''}`} role="dialog" aria-label="右侧面板" aria-modal="true">
              <TabPanel
                maximized
                onToggleMaximize={() => {}}
                mobileMode
                mobileOpen={mobileTabsOpen}
                onCloseMobile={() => setMobileTabsOpen(false)}
              />
            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default Layout;
