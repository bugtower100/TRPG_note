const ACCESS_KEY_PREFIX = 'trpg_campaign_access_';

const accessKey = (campaignId: string) => `${ACCESS_KEY_PREFIX}${campaignId}`;

export const campaignAccessService = {
  getPassword(campaignId: string): string {
    if (!campaignId) return '';
    return window.localStorage.getItem(accessKey(campaignId)) || '';
  },

  setPassword(campaignId: string, password: string): void {
    if (!campaignId) return;
    const normalized = password.trim();
    if (!normalized) {
      this.clearPassword(campaignId);
      return;
    }
    window.localStorage.setItem(accessKey(campaignId), normalized);
  },

  clearPassword(campaignId: string): void {
    if (!campaignId) return;
    window.localStorage.removeItem(accessKey(campaignId));
  },

  buildHeaders(campaignId?: string): Record<string, string> {
    const password = campaignId ? this.getPassword(campaignId) : '';
    return password ? { 'X-TRPG-Campaign-Password': password } : {};
  },
};
