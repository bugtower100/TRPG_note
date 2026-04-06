import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MoreHorizontal, Share2 } from 'lucide-react';
import ShareDialog from './ShareDialog';
import { useCampaign } from '../../context/CampaignContext';
import { BaseEntity, CampaignConfig, CustomSubItem, GraphEntityType, ShareScope, SharedPermission } from '../../types';
import { sharingService } from '../../services/sharingService';
import { buildSharedSnapshot } from '../../utils/shareSnapshot';

interface EntityShareActionsProps {
  entityType: GraphEntityType;
  entity: BaseEntity;
  scope: ShareScope;
  scopeId?: string;
  label: string;
  compact?: boolean;
  menu?: boolean;
}

const EntityShareActions: React.FC<EntityShareActionsProps> = ({
  entityType,
  entity,
  scope,
  scopeId,
  label,
  compact = false,
  menu = false,
}) => {
  const { currentCampaignId, user } = useCampaign();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [config, setConfig] = useState<CampaignConfig | null>(null);
  const [statusText, setStatusText] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!currentCampaignId || !user) return;
    sharingService.getCampaignConfig(currentCampaignId, user)
      .then(setConfig)
      .catch((error) => setStatusText(error instanceof Error ? error.message : '分享配置加载失败'));
  }, [currentCampaignId, user]);

  const memberRole = useMemo(() => {
    if (!config || !user) return 'PL';
    return config.members.find((member) => member.userId === user.id)?.role || 'PL';
  }, [config, user]);

  useEffect(() => {
    if (!menuOpen) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    window.addEventListener('mousedown', handlePointerDown);
    return () => window.removeEventListener('mousedown', handlePointerDown);
  }, [menuOpen]);

  if (!currentCampaignId || !user || !config || memberRole !== 'GM') return null;

  const buttonClass = compact
    ? 'text-xs px-2 py-1 border border-theme rounded hover:bg-primary-light flex items-center gap-1'
    : 'px-3 py-1.5 border border-theme rounded hover:bg-primary-light text-sm flex items-center gap-2';

  const handleSubmit = async (targetUserIds: string[], permission: SharedPermission) => {
    if (!currentCampaignId || !user) return;
    setSubmitting(true);
    try {
      await sharingService.createShare(currentCampaignId, user, {
        entityType,
        entityId: entity.id,
        entityName: entity.name,
        scope,
        scopeId,
        permission,
        targetUserIds,
        snapshot: buildSharedSnapshot(entityType, entity, scope, scopeId) as unknown as Record<string, unknown>,
      });
      setStatusText(`已分享给 ${targetUserIds.length} 位成员`);
      setOpen(false);
      setMenuOpen(false);
    } catch (error) {
      setStatusText(error instanceof Error ? error.message : '分享失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {menu ? (
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((prev) => !prev)}
            className="p-1.5 rounded border border-theme hover:bg-primary-light"
            title={label}
          >
            <MoreHorizontal size={16} />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-full mt-1 min-w-[140px] rounded border border-theme bg-theme-card shadow-lg z-20 p-1">
              <button
                type="button"
                onClick={() => {
                  setOpen(true);
                  setMenuOpen(false);
                }}
                className="w-full px-3 py-2 text-left text-sm rounded hover:bg-primary-light flex items-center gap-2"
              >
                <Share2 size={15} />
                {label}
              </button>
            </div>
          )}
        </div>
      ) : (
        <button type="button" onClick={() => setOpen(true)} className={buttonClass} title={label}>
          <Share2 size={compact ? 14 : 16} />
          {label}
        </button>
      )}
      {statusText && <span className="text-xs theme-text-secondary">{statusText}</span>}
      <ShareDialog
        open={open}
        title={label}
        members={config?.members || []}
        submitting={submitting}
        onClose={() => setOpen(false)}
        onSubmit={handleSubmit}
      />
    </>
  );
};

export const ShareSubItemAction: React.FC<{
  entityType: GraphEntityType;
  entity: BaseEntity;
  item: CustomSubItem;
}> = ({ entityType, entity, item }) => (
  <EntityShareActions
    entityType={entityType}
    entity={entity}
    scope="subItem"
    scopeId={item.id}
    label="分享条目"
    compact
    menu
  />
);

export const ShareSectionAction: React.FC<{
  entityType: GraphEntityType;
  entity: BaseEntity;
  sectionKey: string;
}> = ({ entityType, entity, sectionKey }) => (
  <EntityShareActions
    entityType={entityType}
    entity={entity}
    scope="section"
    scopeId={sectionKey}
    label="分享区块"
    compact
    menu
  />
);

export default EntityShareActions;
