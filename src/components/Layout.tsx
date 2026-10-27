import React, { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import TabPanel from './TabPanel';
import { useCampaignSession, useCampaignTabs } from '../context/CampaignContext';
import { GuideHelpButton, GuideId } from './common/InteractiveGuide';
import ConfirmDialog from './common/ConfirmDialog';
import ConnectionStatusPanel, { type BackendConnectionStatus } from './common/ConnectionStatusPanel';
import { Menu, PanelLeftClose, PanelLeftOpen, PanelRightOpen, Search } from 'lucide-react';
import '../styles/workspace.css';

const QuickReferencePanel = React.lazy(() => import('./common/QuickReferencePanel'));

const Layout: React.FC = () => {
  const { tabs } = useCampaignTabs();
  const { currentCampaignId, isCampaignLoading, isCampaignSaving, hasUnsavedChanges, lastSaveError, showSavingNotice, showUnsavedWarning, sessionError, clearSessionError, reloadCurrentCampaign, saveCampaign, exportData } = useCampaignSession();
  const location = useLocation();
  const [isTabPanelMaximized, setIsTabPanelMaximized] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileTabsOpen, setMobileTabsOpen] = useState(false);
  const [reloadDialogOpen, setReloadDialogOpen] = useState(false);
  const [quickSearchOpen, setQuickSearchOpen] = useState(false);
  const [backendStatus, setBackendStatus] = useState<BackendConnectionStatus | null>(null);
  const [checkingConnection, setCheckingConnection] = useState(false);
  const [connectionRefresh, setConnectionRefresh] = useState(0);
  const mobileSidebarRef = React.useRef<HTMLDivElement>(null);
  const mobileTabsRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    setReloadDialogOpen(false);
    setQuickSearchOpen(false);
  }, [currentCampaignId]);

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
    let active = true;
    let controller: AbortController | null = null;
    const checkConnection = async () => {
      if (controller) return;
      setCheckingConnection(true);
      controller = new AbortController();
      const requestController = controller;
      const timeout = window.setTimeout(() => requestController.abort(), 8000);
      const startedAt = performance.now();
      try {
        const response = await fetch('/api/storage/health', { signal: requestController.signal, cache: 'no-store' });
        const payload = await response.json();
        const online = response.ok && payload.status === 'ok';
        if (active) setBackendStatus({ online, latencyMs: online ? Math.round(performance.now() - startedAt) : undefined, checkedAt: Date.now() });
      } catch {
        if (active) setBackendStatus({ online: false, checkedAt: Date.now() });
      } finally {
        window.clearTimeout(timeout);
        controller = null;
        if (active) setCheckingConnection(false);
      }
    };
    const offline = () => { controller?.abort(); setBackendStatus({ online: false, checkedAt: Date.now() }); };
    const checkWhenVisible = () => { if (document.visibilityState === 'visible') void checkConnection(); };
    void checkConnection();
    const interval = window.setInterval(checkConnection, 30000);
    window.addEventListener('online', checkConnection);
    window.addEventListener('offline', offline);
    window.addEventListener('focus', checkConnection);
    document.addEventListener('visibilitychange', checkWhenVisible);
    return () => {
      active = false;
      controller?.abort();
      window.clearInterval(interval);
      window.removeEventListener('online', checkConnection);
      window.removeEventListener('offline', offline);
      window.removeEventListener('focus', checkConnection);
      document.removeEventListener('visibilitychange', checkWhenVisible);
    };
  }, [connectionRefresh]);

  const currentGuideId = React.useMemo<GuideId | null>(() => {
    const { pathname } = location;
    if (pathname === '/overview') return 'dashboard';
    if (pathname === '/play') return 'workspace';
    if (pathname === '/settings') return 'settings';
    if (pathname === '/relation-graphs') return 'relation-graphs';
    if (pathname === '/team-notes') return 'team-notes';
    if (pathname === '/session-tasks') return 'session-tasks';
    if (pathname === '/clues') return 'clues';
    if (pathname === '/locations/maps') return null;
    if (/^\/(characters|monsters|locations|organizations|events|clues|timelines)\/(shared\/[^/]+|[^/]+)$/.test(pathname)) {
      return 'entity-detail';
    }
    if (/^\/(characters|monsters|locations|organizations|events|clues|timelines)$/.test(pathname)) {
      return 'entity-list';
    }
    return null;
  }, [location]);

  const pageLabel = /^\/(play|clues|session-tasks|team-notes|sessions)(\/|$)/.test(location.pathname)
    ? '跑团工作台'
    : ({
        overview: '模组概览', characters: '角色资料', monsters: '怪物资料', locations: '地点与地图',
        organizations: '组织资料', events: '事件资料', timelines: '时间线', 'relation-graphs': '关系图',
        'mind-maps': '思维导图/白板', 'shared-content': '共享资料', settings: '设置',
      } as Record<string, string>)[location.pathname.split('/')[1]] || '模组资料';

  return (
    <div className="app-shell theme-page">
      {!isMobile && <Sidebar collapsed={sidebarCollapsed} />}
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
      <main className="app-main">
        <div className="app-notices">
          {sessionError ? (
            <div className="bg-red-600 text-white px-4 py-2 text-sm flex flex-wrap items-center justify-between gap-2">
              <span className="min-w-0 break-words">
                {sessionError}
              </span>
              <div className="flex flex-wrap items-center gap-2">
                {currentCampaignId && hasUnsavedChanges && lastSaveError && (
                  <button
                    type="button"
                    className="px-2 py-1 bg-white text-red-700 rounded text-xs disabled:opacity-50"
                    disabled={isCampaignLoading || isCampaignSaving}
                    onClick={() => void saveCampaign()}
                  >
                    重试保存
                  </button>
                )}
                {currentCampaignId && (
                  <button
                    className="px-2 py-1 bg-white text-red-700 rounded text-xs disabled:opacity-50"
                    disabled={isCampaignLoading || isCampaignSaving}
                    onClick={() => {
                      if (hasUnsavedChanges) {
                        setReloadDialogOpen(true);
                      } else {
                        void reloadCurrentCampaign().catch(() => void 0);
                      }
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
              当前模组仍有待保存修改，请暂时不要刷新或关闭页面；若提示持续存在，可先尝试保存，并根据保存失败的具体原因处理。
            </div>
          ) : null}
        </div>
        <header className="app-toolbar ui-glass">
          <div className="app-toolbar__location">
            {isMobile && <button type="button" className="shell-icon-button" onClick={() => setMobileSidebarOpen(true)} aria-label="打开侧边栏"><Menu size={18} /></button>}
            {!isMobile && <button type="button" className="shell-icon-button" onClick={() => setSidebarCollapsed((value) => !value)} aria-label={sidebarCollapsed ? '展开侧边栏' : '收起侧边栏'} title={sidebarCollapsed ? '展开侧边栏' : '收起侧边栏'}>{sidebarCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}</button>}
            <span className="hidden sm:inline theme-text-secondary">工作区</span>
            <span className="hidden sm:inline theme-text-secondary" aria-hidden="true">/</span>
            <span className="truncate">{pageLabel}</span>
          </div>
          <div className="app-toolbar__actions">
            <button type="button" className="shell-icon-button" data-quick-search-trigger aria-label="搜索资料" title="搜索资料名称、标签和正文" aria-expanded={quickSearchOpen} onClick={() => setQuickSearchOpen((open) => !open)}><Search size={18} /></button>
            {currentGuideId && <GuideHelpButton guideId={currentGuideId} className="shell-help" />}
            {isMobile && tabs.length > 0 && <button type="button" className="shell-icon-button" onClick={() => setMobileTabsOpen(true)} aria-label={`打开右侧面板，共 ${tabs.length} 项`}><PanelRightOpen size={18} /></button>}
            <ConnectionStatusPanel connection={backendStatus} checking={checkingConnection} onRefresh={() => setConnectionRefresh((previous) => previous + 1)} />
          </div>
        </header>
        <div className="app-panels">
          <div className={`app-content ${isTabPanelMaximized && !isMobile ? 'hidden' : ''}`}>
            <div className={`workspace-surface ${location.pathname === '/overview' ? 'workspace-surface--overview' : ''} ${['/relation-graphs', '/mind-maps', '/locations/maps'].includes(location.pathname) ? 'workspace-surface--canvas' : ''}`}>
              <Outlet />
            </div>
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
        </div>
      </main>
      {quickSearchOpen && <React.Suspense fallback={null}>
        <QuickReferencePanel key={currentCampaignId} onClose={() => setQuickSearchOpen(false)} onOpenEntity={() => {
          if (isMobile) { setMobileTabsOpen(true); setQuickSearchOpen(false); }
        }} />
      </React.Suspense>}
      <ConfirmDialog
        open={reloadDialogOpen}
        title="加载远端版本前处理当前修改"
        description={(
          <>
            当前页面有未保存的修改。加载远端版本会替换这些内容，此操作不能撤销。
            <span className="block mt-2">
              可以先导出当前模组的 JSON 副本，再决定是否放弃修改。副本包含当前文字与结构数据，不包含图片文件。导出后请确认文件已下载。
            </span>
            <button
              type="button"
              onClick={exportData}
              className="mt-3 px-3 py-2 rounded border border-theme text-primary hover:bg-primary-light"
            >
              导出当前内容（JSON）
            </button>
          </>
        )}
        cancelText="保留当前修改"
        confirmText="放弃修改并加载"
        onCancel={() => setReloadDialogOpen(false)}
        onConfirm={() => {
          setReloadDialogOpen(false);
          void reloadCurrentCampaign({ discardUnsavedChanges: true }).catch(() => void 0);
        }}
      />
    </div>
  );
};

export default Layout;
