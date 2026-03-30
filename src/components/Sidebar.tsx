import React from 'react';
import { NavLink } from 'react-router-dom';
import { useCampaign } from '../context/CampaignContext';
import { 
  LayoutDashboard, Users, MapPin, Building, Calendar, 
  Search, Clock, Settings, LogOut, Skull, Home, Share2
} from 'lucide-react';

const Sidebar: React.FC = () => {
  const { campaignData, logout, exitCampaign } = useCampaign();

  const navItems = [
    { to: '/', icon: <LayoutDashboard size={20} />, label: '概览' },
    { to: '/characters', icon: <Users size={20} />, label: '角色' },
    { to: '/monsters', icon: <Skull size={20} />, label: '怪物' },
    { to: '/relation-graphs', icon: <Share2 size={20} />, label: '关系图' },
    { to: '/locations', icon: <MapPin size={20} />, label: '地点' },
    { to: '/organizations', icon: <Building size={20} />, label: '组织' },
    { to: '/events', icon: <Calendar size={20} />, label: '事件' },
    { to: '/clues', icon: <Search size={20} />, label: '线索' },
    { to: '/timelines', icon: <Clock size={20} />, label: '时间线' },
    { to: '/settings', icon: <Settings size={20} />, label: '设置' },
  ];

  return (
    <div className="w-56 bg-theme-card border-r border-theme h-screen fixed left-0 top-0 flex flex-col z-10">
      <div className="p-4 border-b border-theme">
        <h1 className="text-lg font-bold truncate" title={campaignData.meta.projectName}>
            {campaignData.meta.projectName}
        </h1>
        <p className="text-xs theme-text-secondary mt-1">TRPG 备团工具</p>
      </div>
      
      <nav className="flex-1 p-3 space-y-1 overflow-hidden">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-3 py-2 rounded-md transition-colors text-sm ${
                isActive
                  ? 'bg-primary text-white shadow-sm'
                  : 'theme-text-secondary hover:bg-gray-100/50 hover:text-primary'
              }`
            }
          >
            {item.icon}
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="p-3 border-t border-theme">
        <button
          onClick={exitCampaign}
          className="flex items-center gap-2.5 px-3 py-2 w-full text-left theme-text-secondary hover:bg-gray-100/50 hover:text-primary rounded-md transition-colors text-sm"
        >
          <Home size={20} />
          <span>返回主页</span>
        </button>
        <button
          onClick={logout}
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
