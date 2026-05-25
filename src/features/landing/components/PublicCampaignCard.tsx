import React from 'react';
import { PublicCampaignSummary } from '../../../types';

interface PublicCampaignCardProps {
  campaign: PublicCampaignSummary;
  onEnter: (campaign: PublicCampaignSummary) => void;
}

const PublicCampaignCard: React.FC<PublicCampaignCardProps> = ({ campaign, onEnter }) => {
  return (
    <div className="flex flex-col p-4 rounded-lg border shadow-sm transition-shadow theme-card border-theme hover:shadow-md">
      <div className="flex-1">
        <div className="flex justify-between items-start mb-1 gap-2">
          <h3 className="pr-2 text-lg font-bold break-words">{campaign.name || '未命名公开模组'}</h3>
          <div className="flex flex-wrap items-center justify-end gap-1">
            <span className="px-2 py-1 rounded border border-green-300 text-green-700 bg-green-50 text-xs">公开模组</span>
            {campaign.hasJoinPassword && (
              <span className="px-2 py-1 rounded border border-amber-300 text-amber-700 bg-amber-50 text-xs">需要密码</span>
            )}
          </div>
        </div>
        <p className="theme-text-secondary text-sm line-clamp-2 mb-3 min-h-[2.5em]">
          {campaign.description || '暂无描述'}
        </p>
        <div className="flex items-center justify-between gap-2 text-xs text-gray-400">
          <span>最后修改: {new Date(campaign.lastModified || Date.now()).toLocaleDateString()}</span>
          <span>在线 {campaign.onlineMemberCount} / {campaign.memberCount}</span>
        </div>
        <div className="mt-3 text-xs theme-text-secondary">拥有者：{campaign.ownerUsername || campaign.ownerId}</div>
      </div>
      <div className="pt-3 mt-4 border-t border-theme">
        <button
          onClick={() => onEnter(campaign)}
          className="w-full py-2 text-sm font-medium text-white rounded transition-colors bg-primary hover:bg-primary-dark"
        >
          进入公开模组
        </button>
      </div>
    </div>
  );
};

export default PublicCampaignCard;
