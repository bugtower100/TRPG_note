import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useCampaignSession } from '../context/CampaignContext';
import { queryKeys } from '../query/queryKeys';
import { GraphEntityType, SharedEntityRecord } from '../types';
import { sharingService } from '../services/sharingService';

export const useReceivedShares = (entityType: GraphEntityType) => {
  const { currentCampaignId, user } = useCampaignSession();

  const sharesQuery = useQuery({
    queryKey: currentCampaignId
      ? queryKeys.campaigns.shares(currentCampaignId, 'received', user?.id)
      : ['campaigns', 'shares', 'received', 'disabled'] as const,
    queryFn: async () => {
      if (!currentCampaignId || !user) {
        return [] as SharedEntityRecord[];
      }
      return sharingService.listReceivedShares(currentCampaignId, user);
    },
    enabled: Boolean(currentCampaignId && user),
    refetchInterval: 15_000,
  });

  return useMemo(
    () =>
      (sharesQuery.data ?? []).filter(
        (item) => item.targetUserId === user?.id && item.entityType === entityType
      ),
    [entityType, sharesQuery.data, user?.id]
  );
};
