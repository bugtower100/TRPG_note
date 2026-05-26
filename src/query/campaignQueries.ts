import type { CampaignSummary, UserProfile } from '../types';
import { campaignV2Service, type CampaignBundleV2Response } from '../services/campaignV2Service';
import { queryKeys } from './queryKeys';

export const getCampaignListQueryOptions = (user: UserProfile | null) => ({
  queryKey: queryKeys.campaigns.v2List(user?.id),
  queryFn: async (): Promise<CampaignSummary[]> => {
    if (!user) {
      return [];
    }
    return campaignV2Service.list(user);
  },
});

export const getCampaignBundleQueryOptions = (campaignId: string, user: UserProfile | null) => ({
  queryKey: queryKeys.campaigns.bundle(campaignId, user?.id),
  queryFn: async (): Promise<CampaignBundleV2Response> => {
    if (!user) {
      throw new Error('当前用户信息缺失，请重新登录后再试。');
    }
    return campaignV2Service.loadBundle(campaignId, user);
  },
});
