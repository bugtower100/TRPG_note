import { CampaignConfig, GraphEntityType, SharedEntityRecord, SharedPermission, ShareScope, UserProfile, VersionRecord } from '../types';

const jsonHeaders = (user: UserProfile | null) => ({
  'Content-Type': 'application/json',
  'X-TRPG-User-Id': user?.id || '',
  'X-TRPG-Username': user?.username || '',
});

class SharingService {
  private async readErrorMessage(response: Response): Promise<string> {
    const text = await response.text();
    if (!text) return `HTTP ${response.status}`;
    try {
      const payload = JSON.parse(text) as {
        error?: string;
        activeLease?: { username?: string };
        version?: number;
      };
      if (payload.error === 'lease_conflict') {
        return `${payload.activeLease?.username || '其他人'} 正在编辑这条共享内容，请稍后再试`;
      }
      if (payload.error === 'lease_missing') {
        return '当前共享编辑状态已失效，请重新进入编辑';
      }
      if (payload.error === 'version_conflict') {
        return `共享内容已更新，请刷新后重试（当前版本 ${payload.version ?? '未知'}）`;
      }
      if (payload.error === 'unsupported_scope') {
        return '当前共享内容暂不支持协作编辑';
      }
      if (typeof payload.error === 'string' && payload.error.trim()) {
        return payload.error;
      }
    } catch {
      return text;
    }
    return text;
  }

  private async parseResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      throw new Error(await this.readErrorMessage(response));
    }
    return response.json() as Promise<T>;
  }

  async listReceivedShares(campaignId: string, user: UserProfile | null): Promise<SharedEntityRecord[]> {
    const response = await fetch(`/api/campaigns/${campaignId}/shares?view=received`, {
      headers: jsonHeaders(user),
    });
    return this.parseResponse<SharedEntityRecord[]>(response);
  }

  async listManagedShares(campaignId: string, user: UserProfile | null): Promise<SharedEntityRecord[]> {
    const response = await fetch(`/api/campaigns/${campaignId}/shares?view=managed`, {
      headers: jsonHeaders(user),
    });
    return this.parseResponse<SharedEntityRecord[]>(response);
  }

  async createShare(
    campaignId: string,
    user: UserProfile | null,
    payload: {
      entityType: GraphEntityType;
      entityId: string;
      entityName: string;
      scope: ShareScope;
      scopeId?: string;
      permission: SharedPermission;
      targetUserIds: string[];
      snapshot: Record<string, unknown>;
    }
  ): Promise<SharedEntityRecord[]> {
    const response = await fetch(`/api/campaigns/${campaignId}/shares`, {
      method: 'POST',
      headers: jsonHeaders(user),
      body: JSON.stringify(payload),
    });
    return this.parseResponse<SharedEntityRecord[]>(response);
  }

  async revokeShare(campaignId: string, shareId: string, user: UserProfile | null): Promise<void> {
    const response = await fetch(`/api/campaigns/${campaignId}/shares/${shareId}`, {
      method: 'DELETE',
      headers: jsonHeaders(user),
    });
    if (!response.ok) {
      throw new Error(await this.readErrorMessage(response));
    }
  }

  async listVersions(campaignId: string, user: UserProfile | null): Promise<VersionRecord[]> {
    const response = await fetch(`/api/campaigns/${campaignId}/versions`, {
      headers: jsonHeaders(user),
    });
    return this.parseResponse<VersionRecord[]>(response);
  }

  async restoreVersionCopy(campaignId: string, versionId: string, user: UserProfile | null): Promise<{ createdId: string }> {
    const response = await fetch(`/api/campaigns/${campaignId}/versions/${versionId}/restore-copy`, {
      method: 'POST',
      headers: jsonHeaders(user),
    });
    return this.parseResponse<{ createdId: string }>(response);
  }

  async getCampaignConfig(campaignId: string, user: UserProfile | null): Promise<CampaignConfig> {
    const response = await fetch(`/api/campaigns/${campaignId}/config`, {
      headers: jsonHeaders(user),
    });
    return this.parseResponse<CampaignConfig>(response);
  }

  async startShareLease(campaignId: string, shareId: string, user: UserProfile | null): Promise<SharedEntityRecord> {
    const response = await fetch(`/api/campaigns/${campaignId}/shares/${shareId}/lease/start`, {
      method: 'POST',
      headers: jsonHeaders(user),
    });
    return this.parseResponse<SharedEntityRecord>(response);
  }

  async refreshShareLease(
    campaignId: string,
    shareId: string,
    user: UserProfile | null,
    leaseStartedAt?: number | null
  ): Promise<SharedEntityRecord> {
    const response = await fetch(`/api/campaigns/${campaignId}/shares/${shareId}/lease/refresh`, {
      method: 'POST',
      headers: jsonHeaders(user),
      body: JSON.stringify({ leaseStartedAt }),
    });
    return this.parseResponse<SharedEntityRecord>(response);
  }

  async endShareLease(campaignId: string, shareId: string, user: UserProfile | null, leaseStartedAt?: number | null): Promise<void> {
    const response = await fetch(`/api/campaigns/${campaignId}/shares/${shareId}/lease/end`, {
      method: 'POST',
      headers: jsonHeaders(user),
      body: JSON.stringify({ leaseStartedAt }),
    });
    if (!response.ok) {
      throw new Error(await this.readErrorMessage(response));
    }
  }

  async saveShareContent(
    campaignId: string,
    shareId: string,
    user: UserProfile | null,
    payload: {
      content?: string;
      sectionItems?: Array<Record<string, unknown>>;
      subItem?: Record<string, unknown> | null;
      details?: string;
      timelineEvents?: Array<Record<string, unknown>>;
      allSections?: Array<Record<string, unknown>>;
      expectedVersion?: number;
      leaseStartedAt?: number | null;
    }
  ): Promise<SharedEntityRecord> {
    const response = await fetch(`/api/campaigns/${campaignId}/shares/${shareId}/content`, {
      method: 'PUT',
      headers: jsonHeaders(user),
      body: JSON.stringify(payload),
    });
    return this.parseResponse<SharedEntityRecord>(response);
  }
}

export const sharingService = new SharingService();
