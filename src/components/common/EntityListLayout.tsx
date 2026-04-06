import React, { useState } from 'react';
import EntityCard from './EntityCard';
import SharedEntityCard from './SharedEntityCard';
import { BaseEntity, SharedEntityRecord } from '../../types';

interface EntityListLayoutProps<T extends BaseEntity> {
  title: string;
  entities: T[];
  entityType: string; // Used for routing
  onAdd?: () => void;
  sharedEntries?: SharedEntityRecord[];
}

const EntityListLayout = <T extends BaseEntity>({ 
  title, 
  entities, 
  entityType, 
  onAdd,
  sharedEntries = [],
}: EntityListLayoutProps<T>) => {
  const [searchTerm, setSearchTerm] = useState('');
  const normalizedSearchTerm = searchTerm.toLowerCase();

  const filteredEntities = entities.filter(e => 
    e.name.toLowerCase().includes(normalizedSearchTerm) || 
    e.details.toLowerCase().includes(normalizedSearchTerm)
  );

  const filteredSharedEntries = sharedEntries.filter((entry) => {
    const sourceText = `${entry.entityName} ${entry.sourceOwnerUsername} ${entry.permission === 'edit' ? '可编辑' : '仅查看'}`.toLowerCase();
    const snapshotText = [
      entry.snapshot.details || '',
      entry.snapshot.sectionTitle || '',
      entry.snapshot.subItemTitle || '',
    ].join(' ').toLowerCase();
    return sourceText.includes(normalizedSearchTerm) || snapshotText.includes(normalizedSearchTerm);
  });

  const hasResults = filteredEntities.length > 0 || filteredSharedEntries.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <h2 className="text-xl sm:text-2xl font-bold">{title}</h2>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <input
            data-tour="entity-list-search"
            type="text"
            placeholder="搜索..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 sm:w-64 px-3 py-2 border border-theme rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-transparent"
          />
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

      {!hasResults ? (
        <div className="text-center py-12 theme-text-secondary bg-theme-card rounded-lg border border-dashed border-theme">
          {searchTerm ? '未找到匹配项' : '暂无数据，请点击新建按钮添加'}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4 sm:gap-6">
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
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default EntityListLayout;
