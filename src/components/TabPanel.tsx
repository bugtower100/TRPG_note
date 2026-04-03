import React, { useEffect, useRef } from 'react';
import { useCampaign, Tab } from '../context/CampaignContext';
import { Maximize2, Minimize2, X } from 'lucide-react';
import EntityDetailView from './common/EntityDetailView';

interface TabPanelProps {
  maximized: boolean;
  onToggleMaximize: () => void;
  mobileMode?: boolean;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

const TabPanel: React.FC<TabPanelProps> = ({
  maximized,
  onToggleMaximize,
  mobileMode = false,
  mobileOpen = false,
  onCloseMobile,
}) => {
  const { tabs, activeTabId, setActiveTabId, closeTab } = useCampaign();
  const contentRef = useRef<HTMLDivElement>(null);

  const activeTab = tabs.find(t => t.id === activeTabId);

  const renderContent = (tab: Tab) => {
    return <EntityDetailView type={tab.type} entityId={tab.entityId} />;
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
      className={`border-l border-theme bg-theme-card flex flex-col h-screen shadow-xl z-20 ${
        mobileMode ? 'fixed top-0 right-0 w-full max-w-full' : `${maximized ? 'w-full' : 'w-1/2'}`
      }`}
    >
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
