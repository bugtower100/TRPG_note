import React from 'react';
import { NavLink } from 'react-router-dom';
import { useCampaignData, useCampaignSession } from '../context/CampaignContext';
import { APP_VERSION } from '../constants/appVersion';
import { 
  LayoutDashboard, Users, MapPin, Building, Calendar, 
  Search, Clock, Settings, LogOut, Skull, Home, Share2, NotebookPen, Kanban, ScrollText
} from 'lucide-react';

interface SidebarProps {
  className?: string;
  onNavigate?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ className = '', onNavigate }) => {
  const { campaignData } = useCampaignData();
  const { logout, exitCampaign } = useCampaignSession();

  const navGroups = [
    {
      items: [
        { to: '/', icon: <LayoutDashboard size={20} />, label: '概览' },
        {
          to: '/characters',
          icon: <Users size={20} />,
          label: '角色',
          children: [
            { to: '/characters/sheets', icon: <ScrollText size={16} />, label: '角色卡' },
          ],
        },
        { to: '/monsters', icon: <Skull size={20} />, label: '怪物' },
        { to: '/relation-graphs', icon: <Share2 size={20} />, label: '关系图' },
        { to: '/team-notes', icon: <NotebookPen size={20} />, label: '团队笔记' },
        { to: '/locations', icon: <MapPin size={20} />, label: '地点' },
        { to: '/organizations', icon: <Building size={20} />, label: '组织' },
        { to: '/events', icon: <Calendar size={20} />, label: '事件' },
        { to: '/clues', icon: <Search size={20} />, label: '线索' },
        { to: '/session-tasks', icon: <Kanban size={20} />, label: '任务看板' },
        { to: '/timelines', icon: <Clock size={20} />, label: '时间线' },
        { to: '/settings', icon: <Settings size={20} />, label: '设置' },
      ],
    },
  ];

  return (
    <div className={`w-56 bg-theme-card border-r border-theme h-screen flex flex-col z-10 ${className}`}>
      <div className="p-4 border-b border-theme">
        <h1 className="text-lg font-bold truncate" title={campaignData.meta.projectName}>
            {campaignData.meta.projectName}
        </h1>
        <p className="text-xs theme-text-secondary mt-1">TRPG 备团工具 {APP_VERSION}</p>
      </div>
      
      <nav className="flex-1 p-3 space-y-1 overflow-hidden" data-tour="sidebar-nav">
        {navGroups.map((group, groupIndex) => (
          <div key={groupIndex} className="space-y-1">
            {group.items.map((item) => (
              <div key={item.to} className="space-y-1">
                <NavLink
                  to={item.to}
                  onClick={onNavigate}
                  data-tour={
                    item.to === '/characters'
                      ? 'sidebar-characters'
                      : item.to === '/relation-graphs'
                        ? 'sidebar-relation-graphs'
                        : item.to === '/team-notes'
                          ? 'sidebar-team-notes'
                        : item.to === '/settings'
                          ? 'sidebar-settings'
                          : undefined
                  }
                  className={({ isActive }) =>
                    `flex items-center gap-2.5 px-3 py-2 rounded-md transition-colors text-sm ${
                      isActive
                        ? 'bg-primary text-white shadow-sm'
                        : 'theme-text-secondary hover:bg-primary-light hover:text-primary'
                    }`
                  }
                >
                  {item.icon}
                  <span>{item.label}</span>
                </NavLink>
                {item.children?.map((child) => (
                  <NavLink
                    key={child.to}
                    to={child.to}
                    onClick={onNavigate}
                    className={({ isActive }) =>
                      `ml-7 flex items-center gap-2 px-3 py-1.5 rounded-md transition-colors text-sm ${
                        isActive
                          ? 'theme-card text-primary border border-theme shadow-sm'
                          : 'theme-text-secondary hover:bg-primary-light hover:text-primary'
                      }`
                    }
                  >
                    {child.icon}
                    <span>{child.label}</span>
                  </NavLink>
                ))}
              </div>
            ))}
          </div>
        ))}
      </nav>

      <div className="p-3 border-t border-theme">
        <button
          onClick={() => {
            onNavigate?.();
            exitCampaign();
          }}
          className="flex items-center gap-2.5 px-3 py-2 w-full text-left theme-text-secondary hover:bg-primary-light hover:text-primary rounded-md transition-colors text-sm"
        >
          <Home size={20} />
          <span>返回主页</span>
        </button>
        <button
          onClick={() => {
            onNavigate?.();
            logout();
          }}
          className="flex items-center gap-2.5 px-3 py-2 w-full text-left text-red-500 hover:bg-red-50 rounded-md transition-colors text-sm"
        >
          <LogOut size={20} />
          <span>退出登录</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
