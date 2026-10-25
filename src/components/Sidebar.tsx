import React, { useEffect, useRef } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useCampaignData, useCampaignSession } from '../context/CampaignContext';
import { APP_VERSION } from '../constants/appVersion';
import { useCampaignMemberRole } from '../hooks/useCampaignMemberRole';
import { isCampaignManagerRole } from '../utils/campaignRoles';
import { 
  LayoutDashboard, Users, MapPin, Building, Calendar,
  Clock, Settings, LogOut, Skull, Home, Share2, Kanban, ScrollText, BrainCircuit, Map
} from 'lucide-react';

interface SidebarProps {
  className?: string;
  onNavigate?: () => void;
  collapsed?: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({ className = '', onNavigate, collapsed = false }) => {
  const { campaignData } = useCampaignData();
  const { logout, exitCampaign, reloadCurrentCampaign } = useCampaignSession();
  const { canManageCampaignContent, memberRole, configQuery } = useCampaignMemberRole();
  const previousRoleRef = useRef<string | null>(null);
  const { pathname } = useLocation();
  const workspaceActive = /^\/(play|clues|clue-board|session-tasks|team-notes|sessions)(\/|$)/.test(pathname);

  useEffect(() => {
    if (!configQuery.data) return;
    const previousRole = previousRoleRef.current;
    previousRoleRef.current = memberRole;
    if (previousRole === 'PL' && isCampaignManagerRole(memberRole)) {
      void reloadCurrentCampaign().catch(() => void 0);
    }
  }, [configQuery.data, memberRole, reloadCurrentCampaign]);

  const navGroups = [
    {
      label: '跑团',
      items: [
        { to: '/overview', icon: <LayoutDashboard size={20} />, label: '模组概览' },
        { to: '/play', icon: <Kanban size={20} />, label: '跑团工作台' },
      ],
    },
    {
      label: canManageCampaignContent ? '模组资料' : '可用资料',
      items: [
        ...(canManageCampaignContent ? [
          { to: '/characters', icon: <Users size={20} />, label: '角色' },
          { to: '/monsters', icon: <Skull size={20} />, label: '怪物' },
          { to: '/locations', icon: <MapPin size={20} />, label: '地点' },
          { to: '/organizations', icon: <Building size={20} />, label: '组织' },
          { to: '/events', icon: <Calendar size={20} />, label: '事件' },
        ] : [{ to: '/shared-content', icon: <Share2 size={20} />, label: '共享资料' }]),
        { to: '/characters/sheets', icon: <ScrollText size={20} />, label: '角色卡' },
        { to: '/locations/maps', icon: <Map size={20} />, label: '地图' },
      ],
    },
    {
      label: '整理工具',
      items: canManageCampaignContent ? [
        { to: '/relation-graphs', icon: <Share2 size={20} />, label: '关系图' },
        { to: '/mind-maps', icon: <BrainCircuit size={20} />, label: '思维导图' },
        { to: '/timelines', icon: <Clock size={20} />, label: '时间线' },
      ] : [],
    },
    { label: '管理', items: [{ to: '/settings', icon: <Settings size={20} />, label: '设置' }] },
  ];

  return (
    <div className={`app-sidebar ui-glass ${collapsed ? 'is-collapsed' : ''} ${className}`}>
      <div className="app-sidebar__brand">
        <span className="app-sidebar__mark" aria-hidden="true"><ScrollText size={20} /></span>
        <div className="min-w-0">
          <p className="text-xs theme-text-secondary mb-1">当前模组</p>
          <h1 className="text-sm font-semibold truncate" title={campaignData.meta.projectName}>
            {campaignData.meta.projectName}
          </h1>
        </div>
      </div>
      
      <nav className="app-sidebar__nav" data-tour="sidebar-nav">
        {navGroups.filter((group) => group.items.length > 0).map((group) => (
          <div key={group.label} className="space-y-1">
            <p className="app-sidebar__group">{group.label}</p>
            {group.items.map((item) => (
              <div key={item.to} className="space-y-1">
                <NavLink
                  to={item.to}
                  title={collapsed ? item.label : undefined}
                  aria-label={collapsed ? item.label : undefined}
                  aria-current={item.to === '/play' && workspaceActive ? 'page' : undefined}
                  onClick={onNavigate}
                  data-tour={
                    item.to === '/characters'
                      ? 'sidebar-characters'
                      : item.to === '/relation-graphs'
                        ? 'sidebar-relation-graphs'
                        : item.to === '/play'
                          ? 'sidebar-workspace'
                        : item.to === '/settings'
                          ? 'sidebar-settings'
                          : undefined
                  }
                  className={({ isActive }) => {
                    const active = item.to === '/play' ? workspaceActive : isActive
                      && !(item.to === '/characters' && pathname.startsWith('/characters/sheets'))
                      && !(item.to === '/locations' && pathname.startsWith('/locations/maps'));
                    return `app-sidebar__link ${active ? 'is-active' : ''}`;
                  }}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </NavLink>
              </div>
              ))}
          </div>
        ))}
      </nav>

      <div className="app-sidebar__footer">
        <button
          title={collapsed ? '返回主页' : undefined}
          aria-label={collapsed ? '返回主页' : undefined}
          onClick={() => {
            onNavigate?.();
            exitCampaign();
          }}
          className="app-sidebar__link w-full"
        >
          <Home size={20} />
          <span>返回主页</span>
        </button>
        <button
          title={collapsed ? '退出登录' : undefined}
          aria-label={collapsed ? '退出登录' : undefined}
          onClick={() => {
            onNavigate?.();
            logout();
          }}
          className="app-sidebar__link w-full text-red-500"
        >
          <LogOut size={20} />
          <span>退出登录</span>
        </button>
        <p className="px-3 pt-3 text-xs theme-text-secondary">TRPG 备团工具 · {APP_VERSION}</p>
      </div>
    </div>
  );
};

export default Sidebar;
