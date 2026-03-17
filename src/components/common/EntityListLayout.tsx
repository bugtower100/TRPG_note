import React, { useState } from 'react';
import EntityCard from './EntityCard';
import { BaseEntity } from '../../types';

interface EntityListLayoutProps<T extends BaseEntity> {
  title: string;
  entities: T[];
  entityType: string; // Used for routing
  onAdd?: () => void;
}

const EntityListLayout = <T extends BaseEntity>({ 
  title, 
  entities, 
  entityType, 
  onAdd 
}: EntityListLayoutProps<T>) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredEntities = entities.filter(e => 
    e.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    e.details.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold">{title}</h2>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <input
            type="text"
            placeholder="搜索..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 sm:w-64 px-4 py-2 border border-theme rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-transparent"
          />
          {onAdd && (
            <button
              onClick={onAdd}
              className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark transition-colors whitespace-nowrap"
            >
              新建
            </button>
          )}
        </div>
      </div>

      {filteredEntities.length === 0 ? (
        <div className="text-center py-12 theme-text-secondary bg-theme-card rounded-lg border border-dashed border-theme">
          {searchTerm ? '未找到匹配项' : '暂无数据，请点击新建按钮添加'}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
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
