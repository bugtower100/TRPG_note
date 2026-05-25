import { useEffect, useState } from 'react';
import { CampaignConfig, CampaignSummary, PublicCampaignSummary, UserProfile } from '../../../types';
import { teamNotesService } from '../../../services/teamNotesService';
import { campaignAccessService } from '../../../services/campaignAccessService';

interface UseLandingCampaignsParams {
  user: UserProfile | null;
  campaignList: CampaignSummary[];
}

const buildFallbackConfig = (campaignId: string, ownerUserId: string): CampaignConfig => ({
  campaignId,
  visibility: 'private',
  ownerUserId,
  schemaVersion: 2,
  members: [],
  createdAt: Date.now(),
  updatedAt: Date.now(),
});

export const useLandingCampaigns = ({ user, campaignList }: UseLandingCampaignsParams) => {
  const [campaignConfigs, setCampaignConfigs] = useState<Record<string, CampaignConfig>>({});
  const [savingConfigId, setSavingConfigId] = useState<string | null>(null);
  const [publicCampaigns, setPublicCampaigns] = useState<PublicCampaignSummary[]>([]);

  useEffect(() => {
    if (!user || campaignList.length === 0) {
      setCampaignConfigs({});
      return;
    }

    Promise.all(
      campaignList.map(async (campaign) => {
        const config = await teamNotesService.updateConfig(campaign.id, user, {
          name: campaign.name,
          description: campaign.description,
          lastModified: campaign.lastModified,
        });
        return [campaign.id, config] as const;
      })
    ).then((entries) => {
      setCampaignConfigs(Object.fromEntries(entries));
    }).catch(() => void 0);
  }, [campaignList, user]);

  useEffect(() => {
    if (!user) {
      setPublicCampaigns([]);
      return;
    }
    teamNotesService.listPublicCampaigns(user)
      .then((items) => {
        setPublicCampaigns(items.filter((item) => item.ownerId !== user.id));
      })
      .catch(() => void 0);
  }, [campaignList, user]);

  const setCampaignVisibility = (campaignId: string, visibility: CampaignConfig['visibility']) => {
    if (!user) return;
    setCampaignConfigs((prev) => ({
      ...prev,
      [campaignId]: {
        ...(prev[campaignId] || buildFallbackConfig(campaignId, user.id)),
        visibility,
      },
    }));
  };

  const handleSaveCampaignConfig = async (campaignId: string) => {
    if (!user) return;
    const current = campaignConfigs[campaignId];
    if (!current) return;
    setSavingConfigId(campaignId);
    try {
      const currentCampaign = campaignList.find((campaign) => campaign.id === campaignId);
      const next = await teamNotesService.updateConfig(campaignId, user, {
        name: currentCampaign?.name,
        description: currentCampaign?.description,
        lastModified: currentCampaign?.lastModified,
        visibility: current.visibility,
      });
      setCampaignConfigs((prev) => ({ ...prev, [campaignId]: next }));
    } finally {
      setSavingConfigId(null);
    }
  };

  const handleUpdateJoinPassword = async (campaignId: string) => {
    if (!user) return;
    const current = campaignConfigs[campaignId];
    const input = window.prompt(
      current?.joinPasswordConfigured
        ? '输入新的进入密码。留空并确认后可清除进入密码。'
        : '输入公开模组进入密码。留空表示不设置密码。',
      ''
    );
    if (input === null) return;
    const normalized = input.trim();
    try {
      const next = await teamNotesService.updateConfig(campaignId, user, {
        joinPassword: normalized,
        clearJoinPassword: normalized === '',
      });
      setCampaignConfigs((prev) => ({ ...prev, [campaignId]: next }));
      if (normalized === '') {
        campaignAccessService.clearPassword(campaignId);
      }
      window.alert(normalized ? '进入密码已更新。' : '进入密码已清除。');
    } catch (error) {
      window.alert(error instanceof Error ? error.message : '进入密码保存失败');
    }
  };

  const ensurePublicCampaignAccess = async (campaign: PublicCampaignSummary): Promise<boolean> => {
    if (!user) return false;
    let passwordText = campaignAccessService.getPassword(campaign.id);
    if (campaign.hasJoinPassword && !passwordText) {
      const input = window.prompt(`"${campaign.name}" 需要进入密码，请输入：`, '');
      if (input === null) return false;
      passwordText = input.trim();
      campaignAccessService.setPassword(campaign.id, passwordText);
    }
    try {
      await teamNotesService.getConfig(campaign.id, user);
      return true;
    } catch (error) {
      campaignAccessService.clearPassword(campaign.id);
      const message = error instanceof Error ? error.message : '进入模组失败';
      if (message.includes('进入密码')) {
        const retry = window.prompt(`"${campaign.name}" 的进入密码不正确，请重新输入：`, '');
        if (retry === null) return false;
        campaignAccessService.setPassword(campaign.id, retry.trim());
        try {
          await teamNotesService.getConfig(campaign.id, user);
          return true;
        } catch (retryError) {
          campaignAccessService.clearPassword(campaign.id);
          window.alert(retryError instanceof Error ? retryError.message : '进入模组失败');
          return false;
        }
      }
      window.alert(message);
      return false;
    }
  };

  const handleRemoveMember = async (campaignId: string, memberUserId: string) => {
    if (!user) return;
    if (!window.confirm('确定要将该 PL 从成员列表中移除吗？之后对方再次进入公开模组时会重新加入。')) return;
    try {
      const next = await teamNotesService.removeMember(campaignId, memberUserId, user);
      setCampaignConfigs((prev) => ({ ...prev, [campaignId]: next }));
    } catch (error) {
      window.alert(error instanceof Error ? error.message : '移除成员失败');
    }
  };

  const getMemberSummary = (config?: CampaignConfig) => {
    const members = config?.members || [];
    const now = Date.now();
    const onlineMembers = members.filter((member) => now - member.lastActiveAt < 5 * 60 * 1000);
    return {
      members,
      onlineMembers,
      previewMembers: members,
      extraCount: 0,
    };
  };

  return {
    campaignConfigs,
    savingConfigId,
    publicCampaigns,
    setCampaignVisibility,
    handleSaveCampaignConfig,
    handleUpdateJoinPassword,
    ensurePublicCampaignAccess,
    handleRemoveMember,
    getMemberSummary,
  };
};
