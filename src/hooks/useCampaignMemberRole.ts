import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useCampaignSession } from '../context/CampaignContext';
import { queryKeys } from '../query/queryKeys';
import { teamNotesService } from '../services/teamNotesService';
import { getCampaignRoleLabel, isCampaignManagerRole } from '../utils/campaignRoles';

export const useCampaignMemberRole = () => {
  const { currentCampaignId, user } = useCampaignSession();

  const configQuery = useQuery({
    queryKey: currentCampaignId
      ? queryKeys.campaigns.config(currentCampaignId, user?.id)
      : ['campaign-role', 'config-disabled'] as const,
    queryFn: async () => {
      if (!currentCampaignId || !user) return null;
      return teamNotesService.getConfig(currentCampaignId, user);
    },
    enabled: Boolean(currentCampaignId && user),
  });

  const memberRole = useMemo(
    () => configQuery.data?.members.find((member) => member.userId === user?.id)?.role || 'PL',
    [configQuery.data, user?.id]
  );

  return {
    config: configQuery.data,
    configQuery,
    memberRole,
    memberRoleLabel: getCampaignRoleLabel(memberRole),
    canManageCampaignContent: isCampaignManagerRole(memberRole),
  };
};
