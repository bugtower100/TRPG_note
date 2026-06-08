import React, { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import TabPanel from './TabPanel';
import { useCampaignSession, useCampaignTabs } from '../context/CampaignContext';
import { GuideHelpButton, GuideId } from './common/InteractiveGuide';

const Layout: React.FC = () => {
  const { tabs } = useCampaignTabs();
  const { currentCampaignId, showSavingNotice, showUnsavedWarning, sessionError, clearSessionError, reloadCurrentCampaign } = useCampaignSession();
  const location = useLocation();
  const [isTabPanelMaximized, setIsTabPanelMaximized] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [mobileTabsOpen, setMobileTabsOpen] = useState(false);
  const [backendStatus, setBackendStatus] = useState<{ online: boolean; offlineSince?: number; syncedAt?: number; conflicts?: Array<{ key: string; localTime?: number; remoteTime?: number }>; unsyncedCount?: number; latencyMs?: number } | null>(null);
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
    if (pathname === '/') return 'dashboard';
    if (pathname === '/settings') return 'settings';
    if (pathname === '/relation-graphs') return 'relation-graphs';
    if (pathname === '/team-notes') return 'team-notes';
    if (pathname === '/session-tasks') return 'session-tasks';
    if (pathname === '/clues') return 'clues';
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
          {sessionError ? (
            <div className="bg-red-600 text-white px-4 py-2 text-sm flex items-center justify-between">
              <span>
                {sessionError}
              </span>
              <div className="flex items-center gap-2">
                {currentCampaignId && (
                  <button
                    className="px-2 py-1 bg-white text-red-700 rounded text-xs"
                    onClick={() => {
                      void reloadCurrentCampaign().catch(() => void 0);
                    }}
                  >
                    重新加载远端版本
                  </button>
                )}
                <button className="px-2 py-1 bg-white text-red-700 rounded text-xs" onClick={clearSessionError}>
                  关闭
                </button>
              </div>
            </div>
          ) : backendStatus?.online === false && currentCampaignId ? (
            <div className="bg-red-600 text-white px-4 py-2 text-sm">
              当前无法连接后端。正式数据不会静默保存到浏览器缓存，请在连接恢复后再继续保存；当前页面中的未保存修改在刷新或关闭后可能丢失。
            </div>
          ) : currentCampaignId && showSavingNotice ? (
            <div className="bg-blue-600 text-white px-4 py-2 text-sm">
              正在将当前模组写入后端，请不要立即关闭页面。
            </div>
          ) : currentCampaignId && showUnsavedWarning ? (
            <div className="bg-amber-500 text-black px-4 py-2 text-sm">
              当前模组的改动尚未稳定写入后端。请在看到保存成功前不要刷新或关闭页面；若该提示持续存在，请检查网络或重新加载远端版本。
            </div>
          ) : null}
        </div>
        <div className={`fixed z-40 ${isMobile ? 'right-3 bottom-4' : 'right-4 bottom-3'}`}>
          <span className={`px-2 py-1 rounded text-xs shadow-sm ${backendStatus?.online ? 'bg-green-600 text-white' : 'bg-gray-700 text-white'}`}>
            {backendStatus?.online ? '在线' : '离线'}{backendStatus?.online && typeof backendStatus?.latencyMs === 'number' ? ` ${backendStatus.latencyMs}ms` : ''}
          </span>
        </div>
        {currentGuideId && (
          <div className={`absolute z-50 ${isMobile ? 'right-3 top-14' : 'right-4 top-2'}`}>
            <GuideHelpButton guideId={currentGuideId} />
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
