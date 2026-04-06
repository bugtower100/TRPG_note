import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import { useCampaign } from '../../context/CampaignContext';
import { SharedEntityRecord } from '../../types';
import { markdownToPreviewText } from './richTextReference';

const SharedEntityCard: React.FC<{ share: SharedEntityRecord }> = ({ share }) => {
  const navigate = useNavigate();
  const { openInTab } = useCampaign();

  const previewText = React.useMemo(() => {
    const rawPreview = share.scope === 'entity'
      ? share.snapshot.details || share.snapshot.allSections?.flatMap((section) => section.items || []).find((item) => item.content?.trim())?.content || ''
      : share.scope === 'section'
        ? share.snapshot.sectionItems?.find((item) => item.content?.trim())?.content || ''
        : share.snapshot.subItem?.content || '';
    const normalizedPreview = markdownToPreviewText(rawPreview);
    if (share.scope === 'entity') {
      return normalizedPreview || '暂无共享内容预览...';
    }
    if (share.scope === 'section') {
      return normalizedPreview || '暂无共享区块预览...';
    }
    return normalizedPreview || '暂无共享条目预览...';
  }, [share]);

  const metaText = `${share.sourceOwnerUsername}分享，${share.permission === 'edit' ? '可编辑' : '仅查看'}`;

  const handleOpenInTab = (event: React.MouseEvent) => {
    event.stopPropagation();
    openInTab(share.entityType, `shared:${share.id}`, `${share.entityName}（共享）`);
  };

  return (
    <div
      data-tour="entity-card"
      onClick={() => navigate(`/${share.entityType}/shared/${share.id}`)}
      className="p-4 rounded-lg shadow-sm border theme-card hover:shadow-md transition-shadow cursor-pointer relative group border-dashed"
    >
      <div className="flex justify-between items-start gap-2">
        <div className="min-w-0">
          <h3 className="text-lg font-bold truncate">{share.entityName}</h3>
          <div className="text-xs theme-text-secondary mt-1 truncate">（{metaText}）</div>
        </div>
        <button
          onClick={handleOpenInTab}
          className="text-gray-400 hover:text-primary transition-opacity opacity-0 group-hover:opacity-100"
          title="在侧边栏打开"
        >
          <ExternalLink size={16} />
        </button>
      </div>
      <p className="mt-2 text-sm theme-text-secondary whitespace-pre-line max-h-16 overflow-hidden">
        {previewText}
      </p>
      <div className="mt-4 pt-2 border-t border-theme flex justify-between items-center text-xs theme-text-secondary">
        <span>{share.scope === 'entity' ? '整卡共享' : share.scope === 'section' ? '区块共享' : '条目共享'}</span>
        <span>更新于: {new Date(share.updatedAt).toLocaleDateString()}</span>
      </div>
    </div>
  );
};

export default SharedEntityCard;
