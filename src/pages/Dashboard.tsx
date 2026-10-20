import { getEntitySearchContent, getSearchExcerpt } from '../utils/entitySearch';
import React, { useState, useEffect, useRef } from 'react';
import { ArrowUpRight, Building2, FileText, MapPin, Search, Skull, Users } from 'lucide-react';
import { useCampaignData, useCampaignSession } from '../context/CampaignContext';
import { useGuide } from '../components/common/InteractiveGuide';
import { useReceivedShares } from '../hooks/useReceivedShares';
import { useNavigate } from 'react-router-dom';
import { useCampaignMemberRole } from '../hooks/useCampaignMemberRole';
import CampaignNameEditor from '../components/common/CampaignNameEditor';
import { teamNotesService } from '../services/teamNotesService';

type SearchEntry = {
  id: string;
  entityType: string;
  entityName: string;
  route: string;
  content: string;
  updatedAt: number;
};

const emptyEntities: never[] = [];

const Dashboard: React.FC = () => {
  const { campaignData, setCampaignData } = useCampaignData();
  const { currentCampaignId, user, reloadCampaignList, reloadCurrentCampaign } = useCampaignSession();
  const navigate = useNavigate();
  const { startGuide } = useGuide();
  const [notes, setNotes] = useState(campaignData.notes || '');
  const sharedCharacters = useReceivedShares('characters');
  const sharedMonsters = useReceivedShares('monsters');
  const sharedLocations = useReceivedShares('locations');
  const sharedOrganizations = useReceivedShares('organizations');
  const { canManageCampaignContent } = useCampaignMemberRole();
  const [searchKeyword, setSearchKeyword] = useState('');
  const [searchEntries, setSearchEntries] = useState<SearchEntry[]>([]);
  const searchBuildVersionRef = useRef(0);
  const visibleCharacters = canManageCampaignContent ? campaignData.characters : emptyEntities;
  const visibleMonsters = canManageCampaignContent ? campaignData.monsters : emptyEntities;
  const visibleLocations = canManageCampaignContent ? campaignData.locations : emptyEntities;
  const visibleOrganizations = canManageCampaignContent ? campaignData.organizations : emptyEntities;
  const visibleEvents = canManageCampaignContent ? campaignData.events : emptyEntities;
  const visibleClues = canManageCampaignContent ? campaignData.clues : emptyEntities;
  const visibleTimelines = canManageCampaignContent ? campaignData.timelines : emptyEntities;

  useEffect(() => {
    setNotes(campaignData.notes || '');
  }, [campaignData.notes]);

  useEffect(() => {
    const hasSeen = localStorage.getItem('trpg_has_seen_guide');
    if (hasSeen) return;
    const timer = window.setTimeout(() => {
      startGuide('dashboard');
      localStorage.setItem('trpg_has_seen_guide', 'true');
    }, 180);
    return () => window.clearTimeout(timer);
  }, [startGuide]);

  useEffect(() => {
    const buildVersion = searchBuildVersionRef.current + 1;
    searchBuildVersionRef.current = buildVersion;
    const timer = window.setTimeout(() => {
      const nextEntries: SearchEntry[] = [
        ...visibleCharacters.map((item) => ({
          id: item.id,
          entityType: '角色',
          entityName: item.name,
          route: `/characters/${item.id}`,
          content: getEntitySearchContent(item),
          updatedAt: item.updatedAt,
        })),
        ...visibleMonsters.map((item) => ({
          id: item.id,
          entityType: '怪物',
          entityName: item.name,
          route: `/monsters/${item.id}`,
          content: getEntitySearchContent(item),
          updatedAt: item.updatedAt,
        })),
        ...visibleLocations.map((item) => ({
          id: item.id,
          entityType: '地点',
          entityName: item.name,
          route: `/locations/${item.id}`,
          content: getEntitySearchContent(item),
          updatedAt: item.updatedAt,
        })),
        ...visibleOrganizations.map((item) => ({
          id: item.id,
          entityType: '组织',
          entityName: item.name,
          route: `/organizations/${item.id}`,
          content: getEntitySearchContent(item),
          updatedAt: item.updatedAt,
        })),
        ...visibleEvents.map((item) => ({
          id: item.id,
          entityType: '事件',
          entityName: item.name,
          route: `/events/${item.id}`,
          content: getEntitySearchContent(item),
          updatedAt: item.updatedAt,
        })),
        ...visibleClues.map((item) => ({
          id: item.id,
          entityType: '线索',
          entityName: item.name,
          route: `/clues/${item.id}`,
          content: getEntitySearchContent(item),
          updatedAt: item.updatedAt,
        })),
        ...visibleTimelines.map((item) => ({
          id: item.id,
          entityType: '时间线',
          entityName: item.name,
          route: `/timelines/${item.id}`,
          content: getEntitySearchContent(item),
          updatedAt: item.updatedAt,
        })),
      ];
      if (searchBuildVersionRef.current !== buildVersion) return;
      setSearchEntries(nextEntries);
    }, 20);
    return () => window.clearTimeout(timer);
  }, [visibleCharacters, visibleClues, visibleEvents, visibleLocations, visibleMonsters, visibleOrganizations, visibleTimelines]);

  const handleSearchEnter = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') return;
    const normalized = searchKeyword.trim().toLowerCase();
    if (!normalized) return;
    const target = searchEntries
      .filter((entry) => entry.content.includes(normalized))
      .sort((a, b) => b.updatedAt - a.updatedAt)[0];
    if (!target) {
      window.alert('未找到匹配结果。');
      return;
    }
    navigate(target.route);
  };

  const matchedEntries = React.useMemo(() => {
    const normalized = searchKeyword.trim().toLowerCase();
    return searchEntries
      .filter((entry) => !normalized || entry.content.includes(normalized))
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, normalized ? 30 : 6);
  }, [searchEntries, searchKeyword]);

  const handleNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (!canManageCampaignContent) return;
    const newNotes = e.target.value;
    setNotes(newNotes);
    setCampaignData({
        ...campaignData,
        notes: newNotes,
        meta: { ...campaignData.meta, lastModified: Date.now() }
    });
  };

  const handleRenameCampaign = async (name: string) => {
    if (!currentCampaignId || !user) {
      throw new Error('当前模组或用户信息缺失，请重新进入模组后再试。');
    }
    await teamNotesService.updateConfig(currentCampaignId, user, {
      name,
      lastModified: Date.now(),
    });
    await Promise.all([
      reloadCurrentCampaign(),
      reloadCampaignList(),
    ]);
  };

  return (
    <div className="dashboard-page">
      <section className="dashboard-summary">
      <div data-tour="dashboard-header" className="flex flex-wrap justify-between items-center gap-3">
        <h2 className="flex min-w-0 items-center gap-3 text-2xl font-semibold">
          <CampaignNameEditor
            name={campaignData.meta.projectName}
            canEdit={canManageCampaignContent}
            onSave={handleRenameCampaign}
            nameClassName="break-words"
          />
          <span className="shrink-0 theme-text-secondary text-xs font-normal">模组概览</span>
        </h2>
        <button type="button" onClick={() => navigate('/play')} className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm text-white hover:bg-primary-dark">进入跑团工作台 <ArrowUpRight size={16} /></button>
      </div>
      <p className="mt-2 text-xs theme-text-secondary">最后更新于 {new Date(campaignData.meta.lastModified).toLocaleString()}</p>

      <nav aria-label="资料统计与入口" data-tour="dashboard-stat-grid" className="dashboard-stats">
        {[
          { label: '角色', count: visibleCharacters.length + sharedCharacters.length, path: '/characters', Icon: Users },
          { label: '怪物', count: visibleMonsters.length + sharedMonsters.length, path: '/monsters', Icon: Skull },
          { label: '地点', count: visibleLocations.length + sharedLocations.length, path: '/locations', Icon: MapPin },
          { label: '组织', count: visibleOrganizations.length + sharedOrganizations.length, path: '/organizations', Icon: Building2 },
        ].map(({ label, count, path, Icon }) => (
          <button key={path} type="button" onClick={() => navigate(path)} className="dashboard-stat">
            <Icon size={19} className="text-primary" />
            <span className="text-sm theme-text-secondary">{label}</span>
            <span className="ml-auto text-2xl font-semibold tabular-nums">{count}</span>
          </button>
        ))}
      </nav>
      </section>

      <div className="dashboard-content">
      <section data-tour="dashboard-search" className="dashboard-search">
        <h3 className="text-base font-semibold mb-4">模组资料</h3>
        <label className="relative block">
        <Search size={17} className="absolute left-3 top-3 theme-text-secondary" aria-hidden="true" />
        <input
          type="text"
          value={searchKeyword}
          onChange={(event) => setSearchKeyword(event.target.value)}
          onKeyDown={handleSearchEnter}
          placeholder="搜索名称、标签或正文…"
          aria-label="搜索模组资料"
          className="w-full pl-9 pr-3 py-2 border border-theme rounded-md bg-transparent text-sm"
        />
        </label>
        <div className="mt-5 mb-2 text-xs theme-text-secondary">{searchKeyword.trim() ? '匹配资料' : '最近编辑'}</div>
          <div data-tour="dashboard-search-results" className="dashboard-recent">
            {matchedEntries.length > 0 ? (
              matchedEntries.map((entry) => (
                <button
                  key={`${entry.entityType}-${entry.id}`}
                  type="button"
                  onClick={() => navigate(entry.route)}
                  className="dashboard-recent__row"
                >
                  <FileText size={17} className="text-primary shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{entry.entityName}</span>
                    {searchKeyword.trim() && <span className="block mt-1 text-xs theme-text-secondary line-clamp-2">{getSearchExcerpt(entry.content, searchKeyword)}</span>}
                    <span className="block mt-1 text-xs theme-text-secondary">{entry.entityType} · {new Date(entry.updatedAt).toLocaleDateString()}</span>
                  </span>
                  <ArrowUpRight size={15} className="theme-text-secondary shrink-0" />
                </button>
              ))
            ) : (
              <div className="dashboard-empty">
                <FileText size={24} className="text-primary" />
                <p>{searchKeyword.trim() ? '没有找到匹配资料' : canManageCampaignContent ? '从一份角色或线索开始整理模组' : '在共享资料中查看主持人分享的内容'}</p>
                {!searchKeyword.trim() && <button type="button" onClick={() => navigate(canManageCampaignContent ? '/characters' : '/shared-content')} className="text-primary hover:underline">{canManageCampaignContent ? '前往角色资料' : '打开共享资料'} →</button>}
              </div>
            )}
          </div>
      </section>

      <section data-tour="dashboard-notes" className="dashboard-notes">
        <div className="flex items-center justify-between gap-2 mb-4">
          <h3 className="text-base font-semibold">模组备忘录</h3>
          <span className="text-xs theme-text-secondary">主持人私有</span>
        </div>
        {canManageCampaignContent ? (
        <textarea
            value={notes}
            onChange={handleNotesChange}
            rows={10}
            aria-label="模组备忘录"
            className="dashboard-notes__input w-full p-3 border border-theme rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 resize-y bg-transparent text-sm leading-7"
            placeholder="记下大纲、待办或灵感…"
        />
        ) : <p className="text-sm theme-text-secondary">此备忘录仅主持人可见。跑团记录请前往工作台的“笔记”。</p>}
      </section>
      </div>
    </div>
  );
};

export default Dashboard;
