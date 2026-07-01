import type { CampaignMemberRole } from '../types';

export const getCampaignRoleLabel = (role: CampaignMemberRole | string | null | undefined) => {
  switch (role) {
    case 'GM':
      return 'GM';
    case 'ASSISTANT_GM':
      return '副GM';
    default:
      return 'PL';
  }
};

export const isCampaignManagerRole = (role: CampaignMemberRole | string | null | undefined) =>
  role === 'GM' || role === 'ASSISTANT_GM';
