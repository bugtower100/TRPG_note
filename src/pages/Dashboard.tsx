import React, { useState, useEffect, useRef } from 'react';
import { useCampaign } from '../context/CampaignContext';
import { useGuide } from '../components/common/InteractiveGuide';
import { useReceivedShares } from '../hooks/useReceivedShares';
import { useNavigate } from 'react-router-dom';

type SearchEntry = {
  id: string;
  entityType: string;
  entityName: string;
  route: string;
  content: string;
  updatedAt: number;
};

const Dashboard: React.FC = () => {
  const { campaignData, setCampaignData } = useCampaign();
  const navigate = useNavigate();
  const { startGuide } = useGuide();
  const [notes, setNotes] = useState(campaignData.notes || '');
  const sharedCharacters = useReceivedShares('characters');
  const sharedMonsters = useReceivedShares('monsters');
  const sharedLocations = useReceivedShares('locations');
  const sharedOrganizations = useReceivedShares('organizations');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [searchEntries, setSearchEntries] = useState<SearchEntry[]>([]);
  const searchBuildVersionRef = useRef(0);

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
        ...campaignData.characters.map((item) => ({
          id: item.id,
          entityType: '角色',
          entityName: item.name,
          route: `/characters/${item.id}`,
          content: [item.name, item.details, item.identity, item.appearance, item.desireOrGoal, item.attributes, ...(item.tags || [])].join(' ').toLowerCase(),
          updatedAt: item.updatedAt,
        })),
        ...campaignData.monsters.map((item) => ({
          id: item.id,
          entityType: '怪物',
          entityName: item.name,
          route: `/monsters/${item.id}`,
          content: [item.name, item.details, item.type, item.stats, item.abilities, item.drops, ...(item.tags || [])].join(' ').toLowerCase(),
          updatedAt: item.updatedAt,
        })),
        ...campaignData.locations.map((item) => ({
          id: item.id,
          entityType: '地点',
          entityName: item.name,
          route: `/locations/${item.id}`,
          content: [item.name, item.details, item.environment, ...(item.tags || [])].join(' ').toLowerCase(),
          updatedAt: item.updatedAt,
        })),
        ...campaignData.organizations.map((item) => ({
          id: item.id,
          entityType: '组织',
          entityName: item.name,
          route: `/organizations/${item.id}`,
          content: [item.name, item.details, item.notes, ...(item.tags || [])].join(' ').toLowerCase(),
          updatedAt: item.updatedAt,
        })),
        ...campaignData.events.map((item) => ({
          id: item.id,
          entityType: '事件',
          entityName: item.name,
          route: `/events/${item.id}`,
          content: [item.name, item.details, item.time, ...(item.tags || [])].join(' ').toLowerCase(),
          updatedAt: item.updatedAt,
        })),
        ...campaignData.clues.map((item) => ({
          id: item.id,
          entityType: '线索',
          entityName: item.name,
          route: `/clues/${item.id}`,
          content: [item.name, item.details, item.type, item.revealTarget || '', ...(item.tags || [])].join(' ').toLowerCase(),
          updatedAt: item.updatedAt,
        })),
        ...campaignData.timelines.map((item) => ({
          id: item.id,
          entityType: '时间线',
          entityName: item.name,
          route: `/timelines/${item.id}`,
          content: [item.name, item.details, ...(item.tags || []), ...(item.timelineEvents || []).map((event) => `${event.time} ${event.content}`)].join(' ').toLowerCase(),
          updatedAt: item.updatedAt,
        })),
      ];
      if (searchBuildVersionRef.current !== buildVersion) return;
      setSearchEntries(nextEntries);
    }, 20);
    return () => window.clearTimeout(timer);
  }, [campaignData]);

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
    if (!normalized) return [];
    return searchEntries
      .filter((entry) => entry.content.includes(normalized))
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, 30);
  }, [searchEntries, searchKeyword]);

  const handleNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newNotes = e.target.value;
    setNotes(newNotes);
    setCampaignData({
        ...campaignData,
        notes: newNotes,
        meta: { ...campaignData.meta, lastModified: Date.now() }
    });
  };

  return (
    <div className="space-y-6">
      <div data-tour="dashboard-header" className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">
            {campaignData.meta.projectName} <span className="text-gray-400 text-sm font-normal">概览</span>
        </h2>
      </div>

      <div data-tour="dashboard-stat-grid" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        <div className="bg-theme-card p-6 rounded-lg shadow-sm border border-theme">
          <h3 className="theme-text-secondary text-sm font-medium uppercase">角色</h3>
          <p className="text-3xl font-bold mt-2">{campaignData.characters.length + sharedCharacters.length}</p>
        </div>
        <div className="bg-theme-card p-6 rounded-lg shadow-sm border border-theme">
          <h3 className="theme-text-secondary text-sm font-medium uppercase">怪物</h3>
          <p className="text-3xl font-bold mt-2">{campaignData.monsters.length + sharedMonsters.length}</p>
        </div>
        <div className="bg-theme-card p-6 rounded-lg shadow-sm border border-theme">
          <h3 className="theme-text-secondary text-sm font-medium uppercase">地点</h3>
          <p className="text-3xl font-bold mt-2">{campaignData.locations.length + sharedLocations.length}</p>
        </div>
        <div className="bg-theme-card p-6 rounded-lg shadow-sm border border-theme">
          <h3 className="theme-text-secondary text-sm font-medium uppercase">组织</h3>
          <p className="text-3xl font-bold mt-2">{campaignData.organizations.length + sharedOrganizations.length}</p>
        </div>
        <div className="bg-theme-card p-6 rounded-lg shadow-sm border border-theme">
            <h3 className="theme-text-secondary text-sm font-medium uppercase">最后更新</h3>
            <p className="text-sm font-bold mt-4">
                {new Date(campaignData.meta.lastModified).toLocaleString()}
            </p>
        </div>
      </div>

      <div data-tour="dashboard-search" className="bg-theme-card p-6 rounded-lg shadow-sm border border-theme">
        <h3 className="text-lg font-bold mb-3">全局检索</h3>
        <input
          type="text"
          value={searchKeyword}
          onChange={(event) => setSearchKeyword(event.target.value)}
          onKeyDown={handleSearchEnter}
          placeholder="搜索角色、怪物、线索、时间线（回车进入首个匹配）"
          className="w-full px-3 py-2 border border-theme rounded-md bg-transparent"
        />
        {searchKeyword.trim() && (
          <div data-tour="dashboard-search-results" className="mt-3 border border-theme rounded-lg divide-y divide-theme max-h-72 overflow-auto">
            {matchedEntries.length > 0 ? (
              matchedEntries.map((entry) => (
                <button
                  key={`${entry.entityType}-${entry.id}`}
                  type="button"
                  onClick={() => navigate(entry.route)}
                  className="w-full text-left px-3 py-2 hover:bg-primary-light/50"
                >
                  <div className="font-medium">{entry.entityName}</div>
                  <div className="text-xs theme-text-secondary">
                    {entry.entityType} · 更新于 {new Date(entry.updatedAt).toLocaleString()}
                  </div>
                </button>
              ))
            ) : (
              <div className="px-3 py-4 text-sm theme-text-secondary">没有找到匹配项</div>
            )}
          </div>
        )}
      </div>

      {/* Campaign Notes Section */}
      <div data-tour="dashboard-notes" className="bg-theme-card p-6 rounded-lg shadow-sm border border-theme">
        <h3 className="text-lg font-bold mb-4">模组笔记 / 备忘录</h3>
        <textarea
            value={notes}
            onChange={handleNotesChange}
            className="w-full h-64 p-4 border border-theme rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 resize-y bg-transparent"
            placeholder="在这里记录模组的大纲、待办事项或灵感..."
        />
      </div>
    </div>
  );
};

export default Dashboard;
