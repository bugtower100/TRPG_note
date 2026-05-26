export const queryKeys = {
  campaigns: {
    v2List: (userId?: string) => ['campaigns', 'v2-list', userId ?? 'anonymous'] as const,
    publicList: (userId?: string) => ['campaigns', 'public', userId ?? 'anonymous'] as const,
    config: (campaignId: string, userId?: string) => ['campaigns', campaignId, 'config', userId ?? 'anonymous'] as const,
    teamNotes: (campaignId: string, userId?: string) => ['campaigns', campaignId, 'team-notes', userId ?? 'anonymous'] as const,
    shares: (campaignId: string, view: 'received' | 'managed', userId?: string) =>
      ['campaigns', campaignId, 'shares', view, userId ?? 'anonymous'] as const,
    versions: (campaignId: string, userId?: string) => ['campaigns', campaignId, 'versions', userId ?? 'anonymous'] as const,
    sessionTasks: (campaignId: string, userId?: string) =>
      ['campaigns', campaignId, 'session-tasks', userId ?? 'anonymous'] as const,
    bundle: (campaignId: string, userId?: string) => ['campaigns', campaignId, 'bundle', userId ?? 'anonymous'] as const,
  },
};
