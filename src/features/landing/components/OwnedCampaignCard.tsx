import React, { useEffect, useRef, useState } from 'react';
import { Check, Download, Pencil, Trash2, X } from 'lucide-react';
import { CampaignConfig, CampaignMember, CampaignMemberRole, CampaignSummary } from '../../../types';
import { getCampaignRoleLabel, isCampaignManagerRole } from '../../../utils/campaignRoles';
import CampaignNameEditor from '../../../components/common/CampaignNameEditor';

interface OwnedCampaignCardProps {
  campaign: CampaignSummary;
  config?: CampaignConfig;
  saving: boolean;
  previewMembers: CampaignMember[];
  onlineMemberIds: Set<string>;
  extraCount: number;
  onVisibilityChange: (campaignId: string, visibility: CampaignConfig['visibility']) => void;
  onSaveConfig: (campaignId: string) => void;
  onUpdateJoinPassword: (campaignId: string) => void;
  onRemoveMember: (campaignId: string, memberUserId: string) => void;
  onUpdateMemberRole: (campaignId: string, memberUserId: string, role: CampaignMemberRole) => void;
  onRename: (campaignId: string, name: string) => Promise<void>;
  onUpdateDescription: (campaignId: string, description: string) => Promise<void>;
  currentUserId: string;
  onEnter: (campaign: CampaignSummary) => void;
  onOpenExport: (campaignId: string) => void;
  onDelete: (campaignId: string) => void;
}

const OwnedCampaignCard: React.FC<OwnedCampaignCardProps> = ({
  campaign,
  config,
  saving,
  previewMembers,
  onlineMemberIds,
  extraCount,
  onVisibilityChange,
  onSaveConfig,
  onUpdateJoinPassword,
  onRemoveMember,
  onUpdateMemberRole,
  onRename,
  onUpdateDescription,
  currentUserId,
  onEnter,
  onOpenExport,
  onDelete,
}) => {
  const onlineMembers = previewMembers.filter((member) => onlineMemberIds.has(member.userId));
  const currentMemberRole = config?.members.find((member) => member.userId === currentUserId)?.role || 'PL';
  const canManageCampaign = isCampaignManagerRole(currentMemberRole);
  const canManageRoles = config?.ownerUserId === currentUserId;
  const canDeleteCampaign = config?.ownerUserId === currentUserId;
  const descriptionInputRef = useRef<HTMLTextAreaElement>(null);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [descriptionDraft, setDescriptionDraft] = useState(campaign.description || '');
  const [isSavingDescription, setIsSavingDescription] = useState(false);

  useEffect(() => {
    if (!isEditingDescription) {
      setDescriptionDraft(campaign.description || '');
    }
  }, [campaign.description, isEditingDescription]);

  useEffect(() => {
    if (isEditingDescription) {
      descriptionInputRef.current?.focus();
    }
  }, [isEditingDescription]);

  const cancelDescriptionEdit = () => {
    if (isSavingDescription) return;
    setDescriptionDraft(campaign.description || '');
    setIsEditingDescription(false);
  };

  const saveDescription = async () => {
    const normalized = descriptionDraft.trim();
    if (normalized === (campaign.description || '').trim()) {
      setIsEditingDescription(false);
      return;
    }
    setIsSavingDescription(true);
    try {
      await onUpdateDescription(campaign.id, normalized);
      setIsEditingDescription(false);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : '模组简介修改失败，请稍后重试。');
    } finally {
      setIsSavingDescription(false);
    }
  };

  return (
    <div data-tour="landing-campaign-card" className="flex flex-col p-4 rounded-lg border shadow-sm transition-shadow theme-card border-theme hover:shadow-md">
      <div className="flex-1">
        <div className="flex justify-between items-start mb-1">
          <h3 className="min-w-0 pr-2 text-lg font-bold">
            <CampaignNameEditor
              name={campaign.name}
              canEdit={canManageCampaign}
              onSave={(name) => onRename(campaign.id, name)}
              nameClassName="break-words"
            />
          </h3>
        </div>
        {isEditingDescription ? (
          <div className="mb-3 space-y-2">
            <textarea
              ref={descriptionInputRef}
              value={descriptionDraft}
              maxLength={1000}
              disabled={isSavingDescription}
              onChange={(event) => setDescriptionDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  event.preventDefault();
                  cancelDescriptionEdit();
                } else if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
                  event.preventDefault();
                  void saveDescription();
                }
              }}
              className="min-h-24 w-full resize-y rounded border border-theme bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
              placeholder="简要描述这个模组的背景..."
              aria-label="模组简介"
            />
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={cancelDescriptionEdit}
                disabled={isSavingDescription}
                className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs theme-text-secondary hover:bg-primary-light disabled:opacity-50"
              >
                <X size={14} aria-hidden="true" /> 取消
              </button>
              <button
                type="button"
                onClick={() => void saveDescription()}
                disabled={isSavingDescription}
                className="inline-flex items-center gap-1 rounded bg-primary px-2 py-1 text-xs text-white hover:bg-primary-dark disabled:opacity-50"
              >
                <Check size={14} aria-hidden="true" /> {isSavingDescription ? '保存中...' : '保存简介'}
              </button>
            </div>
          </div>
        ) : (
          <div className="mb-3 flex min-h-[2.5em] items-start gap-1.5">
            <p className="min-w-0 flex-1 text-sm theme-text-secondary line-clamp-2">
              {campaign.description || '暂无描述'}
            </p>
            {canManageCampaign && (
              <button
                type="button"
                onClick={() => setIsEditingDescription(true)}
                className="shrink-0 rounded p-1 theme-text-secondary hover:bg-primary-light hover:text-primary"
                title="修改模组简介"
                aria-label={`修改模组简介：${campaign.name}`}
              >
                <Pencil size={14} aria-hidden="true" />
              </button>
            )}
          </div>
        )}
        <div className="flex items-center gap-2 flex-wrap mb-2 text-xs">
          <span className={`px-2 py-1 rounded border ${config?.visibility === 'public' ? 'border-green-300 text-green-700 bg-green-50' : 'border-theme theme-text-secondary bg-theme-card'}`}>
            {config?.visibility === 'public' ? '公开模组' : '私密模组'}
          </span>
          {config?.joinPasswordConfigured && (
            <span className="px-2 py-1 rounded border border-amber-300 text-amber-700 bg-amber-50">
              已设进入密码
            </span>
          )}
        </div>
        <div className="flex items-center justify-between gap-2 text-xs text-gray-400">
          <span>最后修改: {new Date(campaign.lastModified).toLocaleDateString()}</span>
          <span>在线 {onlineMembers.length} / {previewMembers.length || 1}</span>
        </div>
        <div data-tour="landing-campaign-members" className="mt-3 border border-theme rounded p-2.5 bg-theme-card/60">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="text-xs font-semibold theme-text-secondary">成员列表</div>
            <div className="text-[11px] theme-text-secondary">
              {canManageRoles ? '创建者可设置副GM' : canManageCampaign ? '副GM可移除 PL' : '查看成员信息'}
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {previewMembers.length > 0 ? previewMembers.map((member) => {
              const online = onlineMemberIds.has(member.userId);
              const isOwner = config?.ownerUserId === member.userId;
              return (
                <span
                  key={member.userId}
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] border ${
                    online
                      ? 'border-green-300 text-green-700 bg-green-50'
                      : 'border-theme theme-text-secondary'
                  }`}
                >
                  {member.username} · {getCampaignRoleLabel(member.role)}
                  {canManageRoles && !isOwner && member.role === 'PL' && (
                    <button
                      type="button"
                      onClick={() => onUpdateMemberRole(campaign.id, member.userId, 'ASSISTANT_GM')}
                      className="ml-1 text-blue-600 hover:text-blue-800"
                      title="设为副GM"
                    >
                      副GM
                    </button>
                  )}
                  {canManageRoles && !isOwner && member.role === 'ASSISTANT_GM' && (
                    <button
                      type="button"
                      onClick={() => onUpdateMemberRole(campaign.id, member.userId, 'PL')}
                      className="ml-1 text-amber-600 hover:text-amber-800"
                      title="改回 PL"
                    >
                      改回PL
                    </button>
                  )}
                  {canManageCampaign && member.role === 'PL' && (
                    <button
                      type="button"
                      onClick={() => onRemoveMember(campaign.id, member.userId)}
                      className="ml-1 text-red-500 hover:text-red-700"
                      title="移除该 PL"
                    >
                      ×
                    </button>
                  )}
                </span>
              );
            }) : (
              <span className="text-[11px] theme-text-secondary">暂无成员信息</span>
            )}
            {extraCount > 0 && (
              <span className="px-2 py-1 rounded-full text-[11px] border border-theme theme-text-secondary">
                +{extraCount} 人
              </span>
            )}
          </div>
        </div>
        <div data-tour="landing-campaign-access" className="mt-3 space-y-2 border border-theme rounded p-2.5 bg-theme-card/60">
          <div className="text-xs font-semibold theme-text-secondary">访问控制</div>
          <select
            value={config?.visibility || 'private'}
            onChange={(event) => onVisibilityChange(campaign.id, event.target.value as CampaignConfig['visibility'])}
            disabled={!canManageCampaign}
            className="w-full px-3 py-1.5 border border-theme rounded bg-transparent text-sm"
          >
            <option value="private">私密模组</option>
            <option value="public">公开模组</option>
          </select>
          <button
            type="button"
            onClick={() => onSaveConfig(campaign.id)}
            disabled={saving || !canManageCampaign}
            className="w-full px-3 py-1.5 rounded bg-primary text-white hover:bg-primary-dark disabled:opacity-60 text-sm"
          >
            保存公开设置
          </button>
          <button
            type="button"
            onClick={() => onUpdateJoinPassword(campaign.id)}
            disabled={!canManageCampaign}
            className="w-full px-3 py-1.5 rounded border border-theme hover:bg-primary-light text-sm"
          >
            {config?.joinPasswordConfigured ? '修改进入密码' : '设置进入密码'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 pt-3 mt-4 border-t border-theme">
        <button
          onClick={() => onEnter(campaign)}
          className="col-span-2 py-2 mb-1 text-sm font-medium text-white rounded transition-colors bg-primary hover:bg-primary-dark"
        >
          进入模组
        </button>
        <button
          onClick={() => onOpenExport(campaign.id)}
          className="flex items-center justify-center gap-1 py-1.5 border border-gray-200 text-gray-600 rounded hover:bg-gray-50 text-xs"
          title="导出备份包"
        >
          <Download size={14} /> 备份
        </button>
        <button
          onClick={() => onDelete(campaign.id)}
          disabled={!canDeleteCampaign}
          className="flex items-center justify-center gap-1 py-1.5 border border-red-200 text-red-600 rounded hover:bg-red-50 text-xs disabled:opacity-50 disabled:hover:bg-transparent"
          title={canDeleteCampaign ? '删除模组' : '仅创建者可删除模组'}
        >
          <Trash2 size={14} /> 删除
        </button>
      </div>
    </div>
  );
};

export default OwnedCampaignCard;
