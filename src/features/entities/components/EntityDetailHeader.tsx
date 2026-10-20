import React from 'react';
import { useNavigate } from 'react-router-dom';
import EntityShareActions from '../../../components/common/EntityShareActions';
import { BaseEntity, GraphEntityType } from '../../../types';
import EntityKeywordEditor from './EntityKeywordEditor';
import EntityReuseActions from './EntityReuseActions';

interface EntityDetailHeaderProps<T extends BaseEntity> {
  entity: T;
  entityType: GraphEntityType;
  backTo: string;
  hideBackButton?: boolean;
  deleteLabel?: string;
  onChange: <K extends keyof T>(field: K, value: T[K]) => void;
  allVisibleExpanded: boolean;
  onToggleAll: () => void;
  onSave: () => void | Promise<void>;
  onDelete: () => void;
}

const EntityDetailHeader = <T extends BaseEntity>({
  entity,
  entityType,
  backTo,
  hideBackButton = false,
  deleteLabel = '删除',
  onChange,
  allVisibleExpanded,
  onToggleAll,
  onSave,
  onDelete,
}: EntityDetailHeaderProps<T>) => {
  const navigate = useNavigate();
  const secondaryActions = (
    <>
      <EntityKeywordEditor entityName={entity.name} keywords={entity.keywords} onChange={(keywords) => onChange('keywords' as keyof T, keywords as T[keyof T])} />
      <label className="inline-flex items-center gap-2 text-sm">
        <span>标题颜色</span>
        <input type="color" value={entity.titleColor || '#111827'} onChange={(e) => onChange('titleColor' as keyof T, e.target.value as T[keyof T])} className="w-8 h-8 rounded border border-theme bg-transparent shrink-0" title="标题颜色" />
      </label>
      <EntityReuseActions entity={entity} entityType={entityType} />
      <EntityShareActions entityType={entityType} entity={entity} scope="entity" label="分享整张卡片" />
      <button type="button" onClick={onDelete} className="text-red-500 hover:text-red-700 text-sm px-3 py-1.5 rounded hover:bg-red-50">{deleteLabel}</button>
    </>
  );

  return (
    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 border-b pb-3">
      <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
        {!hideBackButton && (
          <button
            onClick={() => navigate(backTo)}
            className="inline-flex items-center whitespace-nowrap shrink-0 text-gray-500 hover:text-gray-700"
          >
            &larr; 返回
          </button>
        )}
        <input
          data-tour="entity-detail-name"
          type="text"
          value={entity.name}
          onChange={(e) => onChange('name' as keyof T, e.target.value as T[keyof T])}
          className="flex-1 min-w-0 text-xl sm:text-2xl font-bold border-b border-transparent hover:border-gray-300 focus:border-primary focus:outline-none bg-transparent"
          style={{ color: entity.titleColor || '#111827' }}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <button
          type="button"
          onClick={onToggleAll}
          className="px-3 py-1.5 border border-theme rounded hover:bg-primary-light text-sm"
        >
          {allVisibleExpanded ? '收起全部' : '展开全部'}
        </button>
        <button
          onClick={onSave}
          className="px-3 py-1.5 bg-green-600 text-white rounded hover:bg-green-700 text-sm flex items-center gap-1"
        >
          保存
        </button>
        <details className="compact-actions"><summary>更多操作</summary><div className="compact-actions__menu">{secondaryActions}</div></details>
      </div>
    </div>
  );
};

export default EntityDetailHeader;
