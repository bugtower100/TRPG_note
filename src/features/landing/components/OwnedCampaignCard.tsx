import React from 'react';
import { Trash2, Download } from 'lucide-react';
import { CampaignConfig, CampaignMember, CampaignSummary } from '../../../types';

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
  onEnter,
  onOpenExport,
  onDelete,
}) => {
  const onlineMembers = previewMembers.filter((member) => onlineMemberIds.has(member.userId));

  return (
    <div data-tour="landing-campaign-card" className="flex flex-col p-4 rounded-lg border shadow-sm transition-shadow theme-card border-theme hover:shadow-md">
      <div className="flex-1">
        <div className="flex justify-between items-start mb-1">
          <h3 className="pr-2 text-lg font-bold break-words">{campaign.name}</h3>
        </div>
        <p className="theme-text-secondary text-sm line-clamp-2 mb-3 min-h-[2.5em]">
          {campaign.description || '暂无描述'}
        </p>
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
            <div className="text-[11px] theme-text-secondary">可移除 PL</div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {previewMembers.length > 0 ? previewMembers.map((member) => {
              const online = onlineMemberIds.has(member.userId);
              return (
                <span
                  key={member.userId}
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] border ${
                    online
                      ? 'border-green-300 text-green-700 bg-green-50'
                      : 'border-theme theme-text-secondary'
                  }`}
                >
                  {member.username} · {member.role}
                  {member.role === 'PL' && (
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
            className="w-full px-3 py-1.5 border border-theme rounded bg-transparent text-sm"
          >
            <option value="private">私密模组</option>
            <option value="public">公开模组</option>
          </select>
          <button
            type="button"
            onClick={() => onSaveConfig(campaign.id)}
            disabled={saving}
            className="w-full px-3 py-1.5 rounded bg-primary text-white hover:bg-primary-dark disabled:opacity-60 text-sm"
          >
            保存公开设置
          </button>
          <button
            type="button"
            onClick={() => onUpdateJoinPassword(campaign.id)}
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
          className="flex items-center justify-center gap-1 py-1.5 border border-red-200 text-red-600 rounded hover:bg-red-50 text-xs"
          title="删除模组"
        >
          <Trash2 size={14} /> 删除
        </button>
      </div>
    </div>
  );
};

export default OwnedCampaignCard;
