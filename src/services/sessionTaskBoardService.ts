import { getSessionTasks as getGeneratedSessionTasks } from '../generated/api';
import { CampaignMemberRole, SessionTask, SessionTaskBoardDocument, UserProfile } from '../types';
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

class SessionTaskBoardService {
  private messageFromPayload(
    payload: CollaborationErrorPayload<SessionTaskBoardDocument> | null,
    fallbackText: string,
    status: number
  ): string {
    if (!payload) return fallbackText || `HTTP ${status}`;
    if (payload.error === 'lease_conflict') {
      const username = payload.activeLease?.username || '其他人';
      return `${username} 正在编辑任务看板，请稍后再试`;
    }
    if (payload.error === 'lease_missing') {
      return '当前编辑状态已失效，请重新进入编辑';
    }
    if (payload.error === 'version_conflict') {
      return `内容已被更新，请刷新后重试（当前版本 ${payload.version ?? '未知'}）`;
    }
    if (payload.error === 'forbidden') {
      return '你没有权限执行这个操作';
    }
    if (payload.error === 'forbidden_delete') {
      return '仅管理者可以删除任务';
    }
    if (payload.error === 'forbidden_view') {
      return 'GM 已将任务看板设置为 PL 不可查看';
    }
    if (payload.error === 'forbidden_edit') {
      return 'GM 已将任务看板设置为 PL 不可编辑';
    }
    if (payload.error === 'missing_identity') {
      return '当前用户信息缺失，请重新登录后再试';
    }
    if (typeof payload.error === 'string' && payload.error.trim()) {
      return payload.error;
    }
    return fallbackText || `HTTP ${status}`;
  }

  private async parseResponse<T>(response: Response): Promise<T> {
    return parseCollaborationResponse<T, SessionTaskBoardDocument>(response, {
      remoteFieldNames: ['remoteDoc'],
      messageFromPayload: this.messageFromPayload.bind(this),
    });
  }

  async getTaskBoard(campaignId: string, user: UserProfile | null): Promise<SessionTaskBoardDocument> {
    try {
      return unwrapGeneratedResponse(await getGeneratedSessionTasks({
        client: getGeneratedApiClient(),
        headers: buildUserHeaders(user, { campaignId }),
        path: { campaignId },
      })) as SessionTaskBoardDocument;
    } catch (error) {
      rethrowGeneratedCollaborationError<SessionTaskBoardDocument>(error, {
        remoteFieldNames: ['remoteDoc'],
        messageFromPayload: this.messageFromPayload.bind(this),
      });
    }
  }

  async saveTaskBoard(
    campaignId: string,
    user: UserProfile | null,
    payload: {
      tasks: SessionTask[];
      expectedVersion?: number;
      leaseStartedAt?: number | null;
      plCanView?: boolean;
      plCanEdit?: boolean;
    }
  ): Promise<SessionTaskBoardDocument> {
    const response = await fetch(`/api/campaigns/${campaignId}/session-tasks`, {
      method: 'PUT',
      headers: buildCollaborationHeaders(user, campaignId),
      body: JSON.stringify(payload),
    });
    return this.parseResponse<SessionTaskBoardDocument>(response);
  }

  async startLease(campaignId: string, user: UserProfile | null, role: CampaignMemberRole): Promise<SessionTaskBoardDocument> {
    const response = await fetch(`/api/campaigns/${campaignId}/session-tasks/lease/start`, {
      method: 'POST',
      headers: buildCollaborationHeaders(user, campaignId),
      body: JSON.stringify({ role }),
    });
    return this.parseResponse<SessionTaskBoardDocument>(response);
  }

  async refreshLease(
    campaignId: string,
    user: UserProfile | null,
    role: CampaignMemberRole,
    leaseStartedAt?: number | null
  ): Promise<SessionTaskBoardDocument> {
    const response = await fetch(`/api/campaigns/${campaignId}/session-tasks/lease/refresh`, {
      method: 'POST',
      headers: buildCollaborationHeaders(user, campaignId),
      body: JSON.stringify({ role, leaseStartedAt }),
    });
    return this.parseResponse<SessionTaskBoardDocument>(response);
  }

  async endLease(campaignId: string, user: UserProfile | null, leaseStartedAt?: number | null): Promise<void> {
    const response = await fetch(`/api/campaigns/${campaignId}/session-tasks/lease/end`, {
      method: 'POST',
      headers: buildCollaborationHeaders(user, campaignId),
      body: JSON.stringify({ leaseStartedAt }),
    });
    if (!response.ok) {
      throw new Error(await readCollaborationErrorMessage<SessionTaskBoardDocument>(response, {
        remoteFieldNames: ['remoteDoc'],
        messageFromPayload: this.messageFromPayload.bind(this),
      }));
    }
  }
}

export const sessionTaskBoardService = new SessionTaskBoardService();
