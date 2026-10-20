import React, { useEffect, useMemo, useState } from 'react';
import EntityCard from './EntityCard';
import SharedEntityCard from './SharedEntityCard';
import { BaseEntity, CampaignData, GraphEntityType, SharedEntityRecord } from '../../types';
import EntityReuseActions from '../../features/entities/components/EntityReuseActions';
import { getEntitySearchContent } from '../../utils/entitySearch';
import { useCampaignSession } from '../../context/CampaignContext';

const readTagFilter = (key: string) => {
  try { return window.localStorage.getItem(key) || ''; }
  catch { return ''; }
};

interface EntityListLayoutProps<T extends BaseEntity> {
  title: string;
  entities: T[];
  entityType: string; // Used for routing
  onAdd?: () => void;
  sharedEntries?: SharedEntityRecord[];
  collectionKey?: keyof CampaignData;
  onReorder?: (orderedIds: string[]) => void;
}

const EntityListLayout = <T extends BaseEntity>({ 
  title, 
  entities, 
  entityType, 
  onAdd,
  sharedEntries = [],
  onReorder,
}: EntityListLayoutProps<T>) => {
  const { currentCampaignId, user } = useCampaignSession();
  const filterKey = `trpg_entity_tag:${JSON.stringify([user?.id, currentCampaignId, entityType])}`;
  const [searchTerm, setSearchTerm] = useState('');
  const [tagFilter, setTagFilter] = useState(() => ({ key: filterKey, value: readTagFilter(filterKey) }));
  const selectedTag = tagFilter.key === filterKey ? tagFilter.value : readTagFilter(filterKey);
  const [filterStatus, setFilterStatus] = useState('');
  const [draggingEntityId, setDraggingEntityId] = useState<string | null>(null);
  const [dropTargetEntityId, setDropTargetEntityId] = useState<string | null>(null);
  const normalizedSearchTerm = searchTerm.toLowerCase();

  useEffect(() => {
    setTagFilter({ key: filterKey, value: readTagFilter(filterKey) });
    setFilterStatus('');
  }, [filterKey]);

  const selectTag = (value: string) => {
    setTagFilter({ key: filterKey, value });
    try {
      if (value) window.localStorage.setItem(filterKey, value);
      else window.localStorage.removeItem(filterKey);
      setFilterStatus('');
    } catch {
      setFilterStatus('浏览器未能保存筛选偏好，本次选择仅在当前列表有效。');
    }
  };

  const orderedEntities = useMemo(
    () => [...entities].sort((a, b) => (a.sortOrder ?? Number.MAX_SAFE_INTEGER) - (b.sortOrder ?? Number.MAX_SAFE_INTEGER)),
    [entities]
  );

  const availableTags = useMemo(() => {
    const allTags = orderedEntities.flatMap((entity) => entity.tags || []);
    return Array.from(new Set(allTags)).sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'));
  }, [orderedEntities]);

  const searchableEntities = useMemo(
    () => orderedEntities.map((entity) => ({ entity, content: getEntitySearchContent(entity) })),
    [orderedEntities]
  );

  const filteredEntities = searchableEntities.filter(({ entity, content }) => {
    const matchesSearch = content.includes(normalizedSearchTerm);
    const matchesTag = !selectedTag || (entity.tags || []).includes(selectedTag);
    return matchesSearch && matchesTag;
  }).map(({ entity }) => entity);

  const filteredSharedEntries = sharedEntries.filter((entry) => {
    if (selectedTag) return false;
    const sourceText = `${entry.entityName} ${entry.sourceOwnerUsername} ${entry.permission === 'edit' ? '可编辑' : '仅查看'}`.toLowerCase();
    const snapshotText = [
      entry.snapshot.details || '',
      entry.snapshot.sectionTitle || '',
      entry.snapshot.subItemTitle || '',
      entry.snapshot.subItem?.content || '',
      ...(entry.snapshot.sectionItems || []).flatMap((item) => [item.title, item.content]),
      ...(entry.snapshot.allSections || []).flatMap((section) => [section.title, ...section.items.flatMap((item) => [item.title, item.content])]),
      ...(entry.snapshot.timelineEvents || []).flatMap((event) => [event.title || '', event.time, event.content]),
    ].join(' ').toLowerCase();
    return sourceText.includes(normalizedSearchTerm) || snapshotText.includes(normalizedSearchTerm);
  });

  const hasResults = filteredEntities.length > 0 || filteredSharedEntries.length > 0;
  const canReorder = Boolean(onReorder) && !searchTerm.trim() && !selectedTag;

  const commitReorder = (targetId: string) => {
    if (!onReorder || !draggingEntityId || draggingEntityId === targetId) return;
    const orderedIds = filteredEntities.map((entity) => entity.id);
    const fromIndex = orderedIds.indexOf(draggingEntityId);
    const toIndex = orderedIds.indexOf(targetId);
    if (fromIndex < 0 || toIndex < 0) return;
    const nextIds = [...orderedIds];
    const [draggedId] = nextIds.splice(fromIndex, 1);
    nextIds.splice(toIndex, 0, draggedId);
    onReorder(nextIds);
  };

  const clearDragState = () => {
    setDraggingEntityId(null);
    setDropTargetEntityId(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <h2 className="text-xl font-semibold">{title}</h2>
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {onAdd && <EntityReuseActions entityType={entityType as GraphEntityType} />}
          <input
            data-tour="entity-list-search"
            type="text"
            placeholder="搜索..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 sm:w-64 px-3 py-2 border border-theme rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-transparent"
          />
          <select
            value={selectedTag}
            onChange={(event) => selectTag(event.target.value)}
            className="px-3 py-2 border border-theme rounded-md bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            title="按标签筛选"
          >
            <option value="">全部标签</option>
            {selectedTag && !availableTags.includes(selectedTag) && <option value={selectedTag}>{selectedTag}（暂无匹配资料）</option>}
            {availableTags.map((tag) => (
              <option key={tag} value={tag}>
                {tag}
              </option>
            ))}
          </select>
          {onAdd && (
            <button
              data-tour="entity-list-add"
              onClick={onAdd}
              className="px-3 py-2 bg-primary text-white rounded-md hover:bg-primary-dark transition-colors whitespace-nowrap"
            >
              新建
            </button>
          )}
        </div>
      </div>

      {filterStatus && <p role="status" className="text-sm theme-text-secondary">{filterStatus}</p>}
      {!hasResults ? (
        <div className="text-center py-12 theme-text-secondary bg-theme-card rounded-lg border border-dashed border-theme">
          {searchTerm || selectedTag ? '未找到匹配项，请调整搜索或标签筛选。' : '暂无数据，请点击新建按钮添加'}
        </div>
      ) : (
        <div className="entity-card-grid">
          {filteredSharedEntries.map((entry) => (
            <SharedEntityCard
              key={entry.id}
              share={entry}
            />
          ))}
          {filteredEntities.map((entity) => (
            <EntityCard 
              key={entity.id} 
              entity={entity} 
              type={entityType}
              draggable={canReorder}
              isDragging={draggingEntityId === entity.id}
              isDropTarget={dropTargetEntityId === entity.id && draggingEntityId !== entity.id}
              onDragStart={(event) => {
                if (!canReorder) return;
                event.dataTransfer.effectAllowed = 'move';
                event.dataTransfer.setData('text/plain', entity.id);
                setDraggingEntityId(entity.id);
              }}
              onDragOver={(event) => {
                if (!canReorder || !draggingEntityId || draggingEntityId === entity.id) return;
                event.preventDefault();
                event.dataTransfer.dropEffect = 'move';
                setDropTargetEntityId(entity.id);
              }}
              onDrop={(event) => {
                if (!canReorder) return;
                event.preventDefault();
                commitReorder(entity.id);
                clearDragState();
              }}
              onDragEnd={() => clearDragState()}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default EntityListLayout;
