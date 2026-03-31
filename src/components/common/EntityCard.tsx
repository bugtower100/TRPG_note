import React from 'react';
import { BaseEntity } from '../../types';
import { useNavigate } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import { useCampaign } from '../../context/CampaignContext';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

interface EntityCardProps {
  entity: BaseEntity;
  type: string; // e.g., 'characters', 'locations' used for routing
  icon?: React.ReactNode;
}

const EntityCard: React.FC<EntityCardProps> = ({ entity, type }) => {
  const navigate = useNavigate();
  const { openInTab } = useCampaign();

  const previewText = React.useMemo(() => {
    const raw = marked.parse(entity.details || '', {
      async: false,
      gfm: true,
      breaks: true,
    }) as string;
    const clean = DOMPurify.sanitize(raw);
    const withLineBreaks = clean
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|li|h1|h2|h3|h4|h5|h6|blockquote|pre)>/gi, '\n')
      .replace(/<li>/gi, '• ');
    const doc = new DOMParser().parseFromString(withLineBreaks, 'text/html');
    const text = (doc.body.textContent || '')
      .replace(/\r/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    return text || '暂无描述...';
  }, [entity.details]);

  const handleOpenInTab = (e: React.MouseEvent) => {
    e.stopPropagation();
    openInTab(type, entity.id, entity.name);
  };

  return (
    <div 
      onClick={() => navigate(`/${type}/${entity.id}`)}
      className="p-4 rounded-lg shadow-sm border theme-card hover:shadow-md transition-shadow cursor-pointer relative group"
    >
      <div className="flex justify-between items-start">
        <h3 className="text-lg font-bold truncate pr-6">{entity.name}</h3>
        <button
          onClick={handleOpenInTab}
          className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-primary transition-opacity absolute top-4 right-4"
          title="在侧边栏打开"
        >
          <ExternalLink size={16} />
        </button>
      </div>
      <p className="mt-2 text-sm theme-text-secondary whitespace-pre-line max-h-16 overflow-hidden">
        {previewText}
      </p>
      
      <div className="mt-4 pt-2 border-t border-theme flex justify-between items-center text-xs theme-text-secondary">
        <span>更新于: {new Date(entity.updatedAt).toLocaleDateString()}</span>
      </div>
    </div>
  );
};

export default EntityCard;
