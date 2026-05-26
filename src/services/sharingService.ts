import {
  getCampaignConfig as getGeneratedCampaignConfig,
  listCampaignShares as listGeneratedCampaignShares,
  listCampaignVersions as listGeneratedCampaignVersions,
} from '../generated/api';
import { CampaignConfig, GraphEntityType, SharedEntityRecord, SharedPermission, ShareScope, UserProfile, VersionRecord } from '../types';
import { buildUserHeaders } from './apiClient';
import {
  buildCollaborationHeaders,
  parseCollaborationResponse,
  readCollaborationErrorMessage,
  rethrowGeneratedCollaborationError,
  unwrapGeneratedResponse,
  type CollaborationErrorPayload,
} from './collaborationApi';
import { getGeneratedApiClient } from './generatedApiClient';

class SharingService {
  private messageFromPayload(
    payload: CollaborationErrorPayload<SharedEntityRecord> | null,
    fallbackText: string,
    status: number
  ): string {
    if (!payload) return fallbackText || `HTTP ${status}`;
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
    return fallbackText || `HTTP ${status}`;
  }

  private async parseResponse<T>(response: Response): Promise<T> {
    return parseCollaborationResponse<T, SharedEntityRecord>(response, {
      remoteFieldNames: ['remoteShare'],
      messageFromPayload: this.messageFromPayload.bind(this),
    });
  }

  async listReceivedShares(campaignId: string, user: UserProfile | null): Promise<SharedEntityRecord[]> {
    try {
      return ((unwrapGeneratedResponse(await listGeneratedCampaignShares({
        client: getGeneratedApiClient(),
        headers: buildUserHeaders(user, { campaignId }),
        path: { campaignId },
        query: { view: 'received' },
      })) ?? []) as unknown) as SharedEntityRecord[];
    } catch (error) {
      rethrowGeneratedCollaborationError<SharedEntityRecord>(error, {
        remoteFieldNames: ['remoteShare'],
        messageFromPayload: this.messageFromPayload.bind(this),
      });
    }
  }

  async listManagedShares(campaignId: string, user: UserProfile | null): Promise<SharedEntityRecord[]> {
    try {
      return ((unwrapGeneratedResponse(await listGeneratedCampaignShares({
        client: getGeneratedApiClient(),
        headers: buildUserHeaders(user, { campaignId }),
        path: { campaignId },
        query: { view: 'managed' },
      })) ?? []) as unknown) as SharedEntityRecord[];
    } catch (error) {
      rethrowGeneratedCollaborationError<SharedEntityRecord>(error, {
        remoteFieldNames: ['remoteShare'],
        messageFromPayload: this.messageFromPayload.bind(this),
      });
    }
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
      headers: buildCollaborationHeaders(user, campaignId),
      body: JSON.stringify(payload),
    });
    return this.parseResponse<SharedEntityRecord[]>(response);
  }

  async revokeShare(campaignId: string, shareId: string, user: UserProfile | null): Promise<void> {
    const response = await fetch(`/api/campaigns/${campaignId}/shares/${shareId}`, {
      method: 'DELETE',
      headers: buildCollaborationHeaders(user, campaignId),
    });
    if (!response.ok) {
      throw new Error(await readCollaborationErrorMessage<SharedEntityRecord>(response, {
        remoteFieldNames: ['remoteShare'],
        messageFromPayload: this.messageFromPayload.bind(this),
      }));
    }
  }

  async listVersions(campaignId: string, user: UserProfile | null): Promise<VersionRecord[]> {
    try {
      return (unwrapGeneratedResponse(await listGeneratedCampaignVersions({
        client: getGeneratedApiClient(),
        headers: buildUserHeaders(user, { campaignId }),
        path: { campaignId },
      })) ?? []) as VersionRecord[];
    } catch (error) {
      rethrowGeneratedCollaborationError<SharedEntityRecord>(error, {
        remoteFieldNames: ['remoteShare'],
        messageFromPayload: this.messageFromPayload.bind(this),
      });
    }
  }

  async restoreVersionCopy(campaignId: string, versionId: string, user: UserProfile | null): Promise<{ createdId: string }> {
    const response = await fetch(`/api/campaigns/${campaignId}/versions/${versionId}/restore-copy`, {
      method: 'POST',
      headers: buildCollaborationHeaders(user, campaignId),
    });
    return this.parseResponse<{ createdId: string }>(response);
  }

  async getCampaignConfig(campaignId: string, user: UserProfile | null): Promise<CampaignConfig> {
    try {
      return unwrapGeneratedResponse(await getGeneratedCampaignConfig({
        client: getGeneratedApiClient(),
        headers: buildUserHeaders(user, { campaignId }),
        path: { campaignId },
      })) as CampaignConfig;
    } catch (error) {
      rethrowGeneratedCollaborationError<SharedEntityRecord>(error, {
        remoteFieldNames: ['remoteShare'],
        messageFromPayload: this.messageFromPayload.bind(this),
      });
    }
  }

  async startShareLease(campaignId: string, shareId: string, user: UserProfile | null): Promise<SharedEntityRecord> {
    const response = await fetch(`/api/campaigns/${campaignId}/shares/${shareId}/lease/start`, {
      method: 'POST',
      headers: buildCollaborationHeaders(user, campaignId),
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
      headers: buildCollaborationHeaders(user, campaignId),
      body: JSON.stringify({ leaseStartedAt }),
    });
    return this.parseResponse<SharedEntityRecord>(response);
  }

  async endShareLease(campaignId: string, shareId: string, user: UserProfile | null, leaseStartedAt?: number | null): Promise<void> {
    const response = await fetch(`/api/campaigns/${campaignId}/shares/${shareId}/lease/end`, {
      method: 'POST',
      headers: buildCollaborationHeaders(user, campaignId),
      body: JSON.stringify({ leaseStartedAt }),
    });
    if (!response.ok) {
      throw new Error(await readCollaborationErrorMessage<SharedEntityRecord>(response, {
        remoteFieldNames: ['remoteShare'],
        messageFromPayload: this.messageFromPayload.bind(this),
      }));
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
      headers: buildCollaborationHeaders(user, campaignId),
      body: JSON.stringify(payload),
    });
    return this.parseResponse<SharedEntityRecord>(response);
  }
}

export const sharingService = new SharingService();
