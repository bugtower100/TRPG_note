import React, { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import TabPanel from './TabPanel';
import { useCampaign } from '../context/CampaignContext';

const Layout: React.FC = () => {
  const { tabs } = useCampaign();
  const [isTabPanelMaximized, setIsTabPanelMaximized] = useState(false);

  useEffect(() => {
    if (tabs.length === 0) {
      setIsTabPanelMaximized(false);
    }
  }, [tabs.length]);

  return (
    <div className="flex h-screen overflow-hidden theme-page">
      <Sidebar />
      <main className="flex-1 ml-64 flex overflow-hidden">
        <div className={`flex-1 overflow-y-auto p-8 ${tabs.length > 0 && !isTabPanelMaximized ? 'border-r border-theme' : ''} ${isTabPanelMaximized ? 'hidden' : ''}`}>
          <Outlet />
        </div>
        <TabPanel
          maximized={isTabPanelMaximized}
          onToggleMaximize={() => setIsTabPanelMaximized((prev) => !prev)}
        />
      </main>
    </div>
  );
};

export default Layout;
