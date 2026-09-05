import React, { useEffect, useRef, useState } from 'react';
import { useCampaignTabs, Tab } from '../context/CampaignContext';
import { Maximize2, Minimize2, X } from 'lucide-react';
import EntityDetailView from './common/EntityDetailView';

interface TabPanelProps {
  maximized: boolean;
  onToggleMaximize: () => void;
  mobileMode?: boolean;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

const PANEL_MIN_WIDTH = 280;
const PANEL_MAX_WIDTH = 960;
const MAIN_CONTENT_MIN_WIDTH = 280;

const TabPanel: React.FC<TabPanelProps> = ({
  maximized,
  onToggleMaximize,
  mobileMode = false,
  mobileOpen = false,
  onCloseMobile,
}) => {
  const { tabs, activeTabId, setActiveTabId, closeTab } = useCampaignTabs();
  const contentRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelWidthRef = useRef(0);
  const resizeRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const [panelWidth, setPanelWidth] = useState<number | null>(null);

  const activeTab = tabs.find(t => t.id === activeTabId);

  const renderContent = (tab: Tab) => {
    return <EntityDetailView type={tab.type} entityId={tab.entityId} />;
  };

  const applyPanelWidth = (width: number) => {
    const panel = panelRef.current;
    if (!panel) return width;
    const parentWidth = panel.parentElement?.clientWidth ?? window.innerWidth;
    const maxWidth = Math.max(
      PANEL_MIN_WIDTH,
      Math.min(PANEL_MAX_WIDTH, parentWidth - MAIN_CONTENT_MIN_WIDTH)
    );
    const nextWidth = Math.min(maxWidth, Math.max(PANEL_MIN_WIDTH, width));
    panelWidthRef.current = nextWidth;
    panel.style.width = `${nextWidth}px`;
    return nextWidth;
  };

  const handleResizeStart = (event: React.PointerEvent<HTMLDivElement>) => {
    const panel = panelRef.current;
    if (!panel) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const currentWidth = panel.getBoundingClientRect().width;
    panelWidthRef.current = currentWidth;
    resizeRef.current = { startX: event.clientX, startWidth: currentWidth };
  };

  const handleResizeMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const resize = resizeRef.current;
    if (!resize) return;
    applyPanelWidth(resize.startWidth + resize.startX - event.clientX);
  };

  const handleResizeEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!resizeRef.current) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    resizeRef.current = null;
    setPanelWidth(panelWidthRef.current);
  };

  const handleResizeKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const currentWidth = panelRef.current?.getBoundingClientRect().width ?? PANEL_MIN_WIDTH;
    const delta = event.key === 'ArrowLeft' ? 16 : -16;
    setPanelWidth(applyPanelWidth(currentWidth + delta));
  };

  useEffect(() => {
    if (!activeTab) return;
    if (!activeTab.targetSectionTitleLower && !activeTab.targetSubItemId) return;
    const root = contentRef.current;
    if (!root) return;

    const escapeAttr = (value: string) => value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

    const runJump = (attempt = 0) => {
      const sectionSelector = activeTab.targetSectionTitleLower
        ? `[data-section-title="${escapeAttr(activeTab.targetSectionTitleLower)}"]`
        : null;

      const section = sectionSelector ? root.querySelector(sectionSelector) as HTMLElement | null : null;
      if (section && section.dataset.collapsed === 'true') {
        const toggleBtn = section.querySelector('[data-role="section-toggle"]') as HTMLButtonElement | null;
        toggleBtn?.click();
      }

      const target = activeTab.targetSubItemId
        ? root.querySelector(`[data-subitem-id="${escapeAttr(activeTab.targetSubItemId)}"]`) as HTMLElement | null
        : section;

      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }

      if (attempt < 8) {
        window.setTimeout(() => runJump(attempt + 1), 70);
      }
    };

    window.setTimeout(() => runJump(0), 30);
  }, [activeTab]);

  if (tabs.length === 0) return null;
  if (mobileMode && !mobileOpen) return null;

  return (
    <div
      ref={panelRef}
      className={`relative border-l border-theme bg-theme-card flex flex-col h-screen shadow-xl z-20 ${
        mobileMode ? 'fixed top-0 right-0 w-full max-w-full' : `${maximized ? 'w-full' : 'flex-none'}`
      }`}
      style={!mobileMode && !maximized ? {
        width: panelWidth === null ? '50%' : `${panelWidth}px`,
        minWidth: `${PANEL_MIN_WIDTH}px`,
        maxWidth: `calc(100% - ${MAIN_CONTENT_MIN_WIDTH}px)`,
      } : undefined}
    >
      {!mobileMode && !maximized ? (
        <div
          role="separator"
          aria-label="调整右侧详情面板宽度"
          aria-orientation="vertical"
          aria-valuemin={PANEL_MIN_WIDTH}
          aria-valuemax={PANEL_MAX_WIDTH}
          aria-valuetext={panelWidth === null ? '页面宽度的一半' : `${Math.round(panelWidth)} 像素`}
          tabIndex={0}
          title="拖动调整右侧面板宽度"
          onPointerDown={handleResizeStart}
          onPointerMove={handleResizeMove}
          onPointerUp={handleResizeEnd}
          onPointerCancel={handleResizeEnd}
          onKeyDown={handleResizeKeyDown}
          className="group absolute inset-y-0 -left-2 z-30 flex w-4 touch-none cursor-col-resize items-center justify-center outline-none"
        >
          <span className="h-12 w-1 rounded-full bg-black/10 transition-colors group-hover:bg-primary group-focus:bg-primary" />
        </div>
      ) : null}
      {/* Tab Headers */}
      <div className="flex overflow-x-auto border-b border-theme bg-transparent">
        <div className="flex items-center px-3 border-r border-theme">
          {mobileMode && (
            <button
              onClick={onCloseMobile}
              className="flex items-center gap-1 text-xs px-2 py-1 rounded border border-theme theme-text-secondary hover:text-primary hover:border-primary mr-2"
            >
              <X size={14} />
              关闭
            </button>
          )}
          <button
            onClick={onToggleMaximize}
            className="flex items-center gap-1 text-xs px-2 py-1 rounded border border-theme theme-text-secondary hover:text-primary hover:border-primary"
          >
            {maximized ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            {maximized ? '还原' : '最大化'}
          </button>
        </div>
        {tabs.map(tab => (
          <div
            key={tab.id}
            className={`
              flex items-center gap-2 px-4 py-2 border-r border-theme cursor-pointer min-w-[120px] max-w-[200px]
              ${tab.id === activeTabId ? 'bg-theme-card text-primary font-medium border-t-2 border-t-primary' : 'theme-text-secondary hover:bg-gray-100/50'}
            `}
            onClick={() => setActiveTabId(tab.id)}
          >
            <span className="truncate text-sm flex-1">{tab.title}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                closeTab(tab.id);
              }}
              className="text-gray-400 hover:text-red-500"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>

      {/* Tab Content */}
      <div ref={contentRef} className="flex-1 overflow-y-auto p-6 bg-theme-card">
        {activeTab && renderContent(activeTab)}
      </div>
    </div>
  );
};

export default TabPanel;
