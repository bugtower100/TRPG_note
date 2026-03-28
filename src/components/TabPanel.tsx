import React from 'react';
import { useCampaign, Tab } from '../context/CampaignContext';
import { Maximize2, Minimize2, X } from 'lucide-react';
import CharacterDetail from '../pages/characters/CharacterDetail';
import MonsterDetail from '../pages/monsters/MonsterDetail';
import LocationDetail from '../pages/locations/LocationDetail';
import OrganizationDetail from '../pages/organizations/OrganizationDetail';
import EventDetail from '../pages/events/EventDetail';
import ClueDetail from '../pages/clues/ClueDetail';
import TimelineDetail from '../pages/timelines/TimelineDetail';

interface TabPanelProps {
  maximized: boolean;
  onToggleMaximize: () => void;
}

const TabPanel: React.FC<TabPanelProps> = ({ maximized, onToggleMaximize }) => {
  const { tabs, activeTabId, setActiveTabId, closeTab } = useCampaign();

  if (tabs.length === 0) return null;

  const activeTab = tabs.find(t => t.id === activeTabId);

  const renderContent = (tab: Tab) => {
    switch (tab.type) {
      case 'characters': return <CharacterDetail entityId={tab.entityId} />;
      case 'monsters': return <MonsterDetail entityId={tab.entityId} />;
      case 'locations': return <LocationDetail entityId={tab.entityId} />;
      case 'organizations': return <OrganizationDetail entityId={tab.entityId} />;
      case 'events': return <EventDetail entityId={tab.entityId} />;
      case 'clues': return <ClueDetail entityId={tab.entityId} />;
      case 'timelines': return <TimelineDetail entityId={tab.entityId} />;
      default: return <div>未知类型</div>;
    }
  };

  return (
    <div className={`${maximized ? 'w-full' : 'w-1/2'} border-l border-theme bg-theme-card flex flex-col h-screen shadow-xl z-20`}>
      {/* Tab Headers */}
      <div className="flex overflow-x-auto border-b border-theme bg-transparent">
        <div className="flex items-center px-3 border-r border-theme">
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
      <div className="flex-1 overflow-y-auto p-6 bg-theme-card">
        {activeTab && renderContent(activeTab)}
      </div>
    </div>
  );
};

export default TabPanel;
