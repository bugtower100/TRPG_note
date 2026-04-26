import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCampaign } from '../context/CampaignContext';

type SearchEntry = {
  id: string;
  entityType: string;
  entityName: string;
  route: string;
  content: string;
  updatedAt: number;
};

const SearchCenter: React.FC = () => {
  const { campaignData } = useCampaign();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [entries, setEntries] = useState<SearchEntry[]>([]);
  const [building, setBuilding] = useState(false);
  const [builtAt, setBuiltAt] = useState<number | null>(null);
  const buildVersionRef = useRef(0);

  useEffect(() => {
    const buildVersion = buildVersionRef.current + 1;
    buildVersionRef.current = buildVersion;
    setBuilding(true);
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
      if (buildVersionRef.current !== buildVersion) return;
      setEntries(nextEntries);
      setBuiltAt(Date.now());
      setBuilding(false);
    }, 20);
    return () => window.clearTimeout(timer);
  }, [campaignData]);

  const results = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return entries.slice(0, 120);
    return entries
      .filter((entry) => entry.content.includes(normalized))
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, 120);
  }, [entries, query]);

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h2 className="text-2xl font-bold">全局检索</h2>
        <p className="text-sm theme-text-secondary mt-1">索引会在数据变更后异步重建，避免编辑时卡顿。</p>
      </div>

      <section className="bg-theme-card border border-theme rounded-lg p-4 space-y-2">
        <input
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="搜索角色、怪物、线索、时间线..."
          className="w-full px-3 py-2 border border-theme rounded-md bg-transparent"
        />
        <div className="text-xs theme-text-secondary">
          索引条目：{entries.length} · 状态：{building ? '重建中' : '就绪'}
          {builtAt ? ` · 最近重建：${new Date(builtAt).toLocaleString()}` : ''}
        </div>
      </section>

      <section className="bg-theme-card border border-theme rounded-lg p-4">
        <h3 className="font-semibold mb-3">搜索结果</h3>
        {results.length === 0 ? (
          <div className="text-sm theme-text-secondary">无匹配结果。</div>
        ) : (
          <div className="space-y-2">
            {results.map((entry) => (
              <button
                key={`${entry.entityType}_${entry.id}`}
                type="button"
                onClick={() => navigate(entry.route)}
                className="w-full text-left border border-theme rounded px-3 py-2 hover:bg-primary-light"
              >
                <div className="text-sm font-medium">{entry.entityName}</div>
                <div className="text-xs theme-text-secondary mt-1">
                  {entry.entityType} · 最近更新：{new Date(entry.updatedAt).toLocaleString()}
                </div>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default SearchCenter;
