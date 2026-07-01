import { useMemo, useState } from 'react';
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { CampaignConfig, CampaignMemberRole, CampaignSummary, PublicCampaignSummary, UserProfile } from '../../../types';
import { queryKeys } from '../../../query/queryKeys';
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
  const queryClient = useQueryClient();
  const [configOverrides, setConfigOverrides] = useState<Record<string, Partial<CampaignConfig>>>({});
  const [savingConfigId, setSavingConfigId] = useState<string | null>(null);
  const campaignConfigQueries = useQueries({
    queries: campaignList.map((campaign) => ({
      queryKey: queryKeys.campaigns.config(campaign.id, user?.id),
      queryFn: async () => {
        if (!user) {
          throw new Error('当前用户信息缺失，请重新登录后再试。');
        }
        return teamNotesService.getConfig(campaign.id, user);
      },
      enabled: Boolean(user),
      staleTime: 10_000,
    })),
  });
  const publicCampaignsQuery = useQuery({
    queryKey: queryKeys.campaigns.publicList(user?.id),
    queryFn: async () => {
      if (!user) {
        return [] as PublicCampaignSummary[];
      }
      return teamNotesService.listPublicCampaigns(user);
    },
    enabled: Boolean(user),
    staleTime: 10_000,
  });

  const campaignConfigs = useMemo(() => {
    if (!user) {
      return {};
    }
    return campaignList.reduce<Record<string, CampaignConfig>>((acc, campaign, index) => {
      const fetchedConfig = campaignConfigQueries[index]?.data;
      const baseConfig = fetchedConfig || buildFallbackConfig(campaign.id, user.id);
      const override = configOverrides[campaign.id];
      acc[campaign.id] = override ? { ...baseConfig, ...override } : baseConfig;
      return acc;
    }, {});
  }, [campaignConfigQueries, campaignList, configOverrides, user]);

  const publicCampaigns = useMemo(
    () => (publicCampaignsQuery.data ?? []).filter((item) => item.ownerId !== user?.id),
    [publicCampaignsQuery.data, user?.id]
  );

  const syncConfigCache = (campaignId: string, nextConfig: CampaignConfig) => {
    if (!user) return;
    queryClient.setQueryData(queryKeys.campaigns.config(campaignId, user.id), nextConfig);
    setConfigOverrides((prev) => {
      const next = { ...prev };
      delete next[campaignId];
      return next;
    });
  };

  const refreshPublicCampaignsCache = async () => {
    if (!user) return;
    await queryClient.invalidateQueries({
      queryKey: queryKeys.campaigns.publicList(user.id),
    });
  };

  const setCampaignVisibility = (campaignId: string, visibility: CampaignConfig['visibility']) => {
    if (!user) return;
    setConfigOverrides((prev) => ({
      ...prev,
      [campaignId]: {
        ...(prev[campaignId] || {}),
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
      syncConfigCache(campaignId, next);
      await refreshPublicCampaignsCache();
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
      syncConfigCache(campaignId, next);
      await refreshPublicCampaignsCache();
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
      const config = await teamNotesService.getConfig(campaign.id, user);
      syncConfigCache(campaign.id, config);
      return true;
    } catch (error) {
      campaignAccessService.clearPassword(campaign.id);
      const message = error instanceof Error ? error.message : '进入模组失败';
      if (message.includes('进入密码')) {
        const retry = window.prompt(`"${campaign.name}" 的进入密码不正确，请重新输入：`, '');
        if (retry === null) return false;
        campaignAccessService.setPassword(campaign.id, retry.trim());
        try {
          const config = await teamNotesService.getConfig(campaign.id, user);
          syncConfigCache(campaign.id, config);
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
      syncConfigCache(campaignId, next);
      await refreshPublicCampaignsCache();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : '移除成员失败');
    }
  };

  const handleUpdateMemberRole = async (campaignId: string, memberUserId: string, role: CampaignMemberRole) => {
    if (!user) return;
    const actionText = role === 'ASSISTANT_GM' ? '设为副GM' : '改回 PL';
    if (!window.confirm(`确定要将这名成员${actionText}吗？`)) return;
    try {
      const next = await teamNotesService.updateMemberRole(campaignId, memberUserId, role, user);
      syncConfigCache(campaignId, next);
      await refreshPublicCampaignsCache();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : '成员角色更新失败');
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
    handleUpdateMemberRole,
    getMemberSummary,
  };
};
