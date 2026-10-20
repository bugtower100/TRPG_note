import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ExternalLink, Pin, Search, X } from 'lucide-react';
import { useCampaignData, useCampaignSession, useCampaignTabs } from '../../context/CampaignContext';
import { useCampaignMemberRole } from '../../hooks/useCampaignMemberRole';
import { queryKeys } from '../../query/queryKeys';
import { sharingService } from '../../services/sharingService';
import { getEntitySearchContent, getSearchExcerpt } from '../../utils/entitySearch';
import { markdownToPreviewText } from './richTextReference';
import type { GraphEntityType } from '../../types';

const labels: Record<GraphEntityType, string> = {
  characters: '角色', monsters: '怪物', locations: '地点', organizations: '组织',
  events: '事件', clues: '线索', timelines: '时间线',
};
const entityTypes = Object.keys(labels) as GraphEntityType[];

export default function QuickReferencePanel({ onClose, onOpenEntity }: { onClose: () => void; onOpenEntity: () => void }) {
  const { campaignData } = useCampaignData();
  const { currentCampaignId, user } = useCampaignSession();
  const { openInTab } = useCampaignTabs();
  const { canManageCampaignContent, configQuery } = useCampaignMemberRole();
  const [query, setQuery] = useState('');
  const [type, setType] = useState<GraphEntityType | ''>('');
  const [pinned, setPinned] = useState(false);
  const rootRef = useRef<HTMLElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const keyword = useDeferredValue(query.trim().toLowerCase());
  const campaignId = currentCampaignId || '';
  const shares = useQuery({
    queryKey: queryKeys.campaigns.shares(campaignId, 'received', user?.id),
    queryFn: () => sharingService.listReceivedShares(campaignId, user),
    enabled: Boolean(campaignId && user && configQuery.isSuccess),
    refetchInterval: 15_000,
  });

  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (!pinned && !rootRef.current?.contains(event.target as Node)
        && !(event.target instanceof Element && event.target.closest('[data-quick-search-trigger]'))) onClose();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && rootRef.current?.contains(document.activeElement)) {
        event.stopPropagation();
        onClose();
        document.querySelector<HTMLButtonElement>('[data-quick-search-trigger]')?.focus();
      }
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [onClose, pinned]);

  const entries = useMemo(() => {
    if (!configQuery.isSuccess) return [];
    const own = canManageCampaignContent ? entityTypes.flatMap((entityType) => campaignData[entityType].map((entity) => ({
      id: entity.id, entityType, name: entity.name, content: getEntitySearchContent(entity),
      updatedAt: entity.updatedAt, shared: false,
    }))) : [];
    const received = (shares.isError ? [] : shares.data || []).filter((share) => share.targetUserId === user?.id).map((share) => {
      const snapshot = share.snapshot;
      const content = markdownToPreviewText([
        share.entityName, snapshot.details, snapshot.sectionTitle, snapshot.subItemTitle,
        snapshot.subItem?.title, snapshot.subItem?.content,
        ...(snapshot.sectionItems || []).flatMap((item) => [item.title, item.content]),
        ...(snapshot.allSections || []).flatMap((section) => [section.title, ...section.items.flatMap((item) => [item.title, item.content])]),
        ...(snapshot.timelineEvents || []).flatMap((item) => [item.title, item.time, item.content]),
      ].filter(Boolean).join('\n\n')).replace(/\s+/g, ' ').toLowerCase();
      return { id: `shared:${share.id}`, entityType: share.entityType, name: share.entityName, content, updatedAt: share.updatedAt, shared: true };
    });
    return [...own, ...received].sort((a, b) => b.updatedAt - a.updatedAt);
  }, [campaignData, canManageCampaignContent, configQuery.isSuccess, shares.data, shares.isError, user?.id]);
  const matches = useMemo(() => entries.filter((entry) => (!type || entry.entityType === type) && (!keyword || entry.content.includes(keyword))), [entries, keyword, type]);

  return (
    <aside ref={rootRef} className={`quick-reference ${pinned ? 'quick-reference--pinned' : ''}`} aria-label="资料搜索浮窗">
      <header className="flex items-center justify-between gap-2">
        <h2 className="font-semibold text-sm">资料搜索</h2>
        <div className="flex gap-1">
          <button type="button" className={`shell-icon-button ${pinned ? 'text-primary bg-primary-light' : ''}`} aria-pressed={pinned} title={pinned ? '取消固定' : '固定浮窗，点击外部时保持打开'} aria-label={pinned ? '取消固定搜索浮窗' : '固定搜索浮窗'} onClick={() => setPinned((value) => !value)}><Pin size={15} /></button>
          <button type="button" className="shell-icon-button" onClick={onClose} aria-label="关闭资料搜索"><X size={16} /></button>
        </div>
      </header>
      <div className="flex gap-2 mt-3">
        <label className="relative min-w-0 flex-1">
          <Search className="absolute left-2 top-2.5 theme-text-secondary" size={15} aria-hidden="true" />
          <input ref={inputRef} value={query} onChange={(event) => setQuery(event.target.value)} aria-label="搜索资料名称、标签或正文" placeholder="名称、标签或正文…" className="w-full rounded border border-theme bg-transparent pl-8 pr-2 py-2 text-sm" />
        </label>
        <select value={type} onChange={(event) => setType(event.target.value as GraphEntityType | '')} aria-label="资料类型" className="rounded border border-theme bg-theme-card px-2 text-xs">
          <option value="">全部类型</option>
          {entityTypes.map((value) => <option key={value} value={value}>{labels[value]}</option>)}
        </select>
      </div>
      <p className="my-3 text-xs theme-text-secondary" role="status">{configQuery.isPending ? '正在读取权限…' : configQuery.isError ? '权限读取失败，请重新打开浮窗。' : `${keyword ? '匹配' : '最近更新'} ${matches.length} 项${matches.length > 40 ? '，显示前 40 项' : ''} · 点击在右侧打开`}</p>
      {shares.isError && <button type="button" className="mb-2 text-xs text-primary" onClick={() => void shares.refetch()}>共享资料读取失败，点击重试</button>}
      <div className="quick-reference__results" aria-busy={query.trim().toLowerCase() !== keyword}>
        {matches.slice(0, 40).map((entry) => (
          <button key={`${entry.entityType}:${entry.id}`} type="button" className="quick-reference__result" onClick={() => {
            openInTab(entry.entityType, entry.id, entry.name);
            onOpenEntity();
            if (!pinned) onClose();
          }}>
            <span className="flex items-center gap-2"><span className="min-w-0 flex-1 truncate font-medium">{entry.name}</span><ExternalLink size={14} /></span>
            <span className="mt-1 block text-xs theme-text-secondary">{labels[entry.entityType]}{entry.shared ? ' · 已分享' : ''}</span>
            <span className="mt-1 block line-clamp-2 text-xs theme-text-secondary">{getSearchExcerpt(entry.content, keyword)}</span>
          </button>
        ))}
        {configQuery.isSuccess && !matches.length && <p className="py-6 text-sm theme-text-secondary">{shares.isPending ? '正在读取共享资料…' : '没有匹配资料，可尝试其他正文片段。'}</p>}
      </div>
    </aside>
  );
}
