import React from 'react';
import { BaseEntity } from '../../types';
import { useNavigate } from 'react-router-dom';
import { ExternalLink, GripVertical } from 'lucide-react';
import { useCampaignTabs } from '../../context/CampaignContext';
import { getEntityPrimaryMarkdown, markdownToPreviewText } from './richTextReference';
import { useGuide } from './InteractiveGuide';

interface EntityCardProps {
  entity: BaseEntity;
  type: string; // e.g., 'characters', 'locations' used for routing
  icon?: React.ReactNode;
  draggable?: boolean;
  isDragging?: boolean;
  isDropTarget?: boolean;
  onDragStart?: (event: React.DragEvent<HTMLDivElement>) => void;
  onDragOver?: (event: React.DragEvent<HTMLDivElement>) => void;
  onDrop?: (event: React.DragEvent<HTMLDivElement>) => void;
  onDragEnd?: (event: React.DragEvent<HTMLDivElement>) => void;
}

const EntityCard: React.FC<EntityCardProps> = ({
  entity,
  type,
  draggable = false,
  isDragging = false,
  isDropTarget = false,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}) => {
  const navigate = useNavigate();
  const { openInTab } = useCampaignTabs();
  const { currentGuideId, isGuideRunning } = useGuide();

  const previewText = React.useMemo(() => {
    const markdown = getEntityPrimaryMarkdown(entity, type);
    return markdownToPreviewText(markdown) || '暂无描述...';
  }, [entity, type]);

  const handleOpenInTab = (e: React.MouseEvent) => {
    e.stopPropagation();
    openInTab(type, entity.id, entity.name);
  };

  return (
    <div
      data-tour="entity-card"
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      onClick={() => navigate(`/${type}/${entity.id}`)}
      className={`p-4 rounded-lg shadow-sm border theme-card hover:shadow-md transition-all cursor-pointer relative group ${
        isDragging ? 'opacity-45 scale-[0.98]' : ''
      } ${isDropTarget ? 'ring-2 ring-primary/35 border-primary' : ''}`}
    >
      <div className="flex justify-between items-start">
        <div className="flex items-start gap-2 min-w-0 pr-10">
          {draggable && (
            <span
              className="mt-0.5 text-gray-400 shrink-0 cursor-grab active:cursor-grabbing"
              title="拖拽排序"
              onClick={(e) => e.stopPropagation()}
            >
              <GripVertical size={16} />
            </span>
          )}
          <h3 className="text-lg font-bold truncate" style={{ color: entity.titleColor || '#111827' }}>{entity.name}</h3>
        </div>
        <button
          data-tour="entity-card-split"
          onClick={handleOpenInTab}
          className={`text-gray-400 hover:text-primary transition-opacity absolute top-4 right-4 ${
            currentGuideId === 'entity-list' && isGuideRunning ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          }`}
          title="在侧边栏打开"
        >
          <ExternalLink size={16} />
        </button>
      </div>
      <p className="mt-2 text-sm theme-text-secondary whitespace-pre-line max-h-16 overflow-hidden">
        {previewText}
      </p>
      {(entity.tags || []).length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {(entity.tags || []).slice(0, 4).map((tag) => (
            <span key={tag} className="inline-flex px-2 py-0.5 rounded text-xs border border-theme bg-theme-card">
              {tag}
            </span>
          ))}
        </div>
      )}
      
      <div className="mt-4 pt-2 border-t border-theme flex justify-between items-center text-xs theme-text-secondary">
        <span>更新于: {new Date(entity.updatedAt).toLocaleDateString()}</span>
      </div>
    </div>
  );
};

export default EntityCard;
