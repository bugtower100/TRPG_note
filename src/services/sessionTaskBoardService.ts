import { CampaignMemberRole, SessionTask, SessionTaskBoardDocument, UserProfile } from '../types';
import { VersionConflictError } from './conflictError';

const jsonHeaders = (user: UserProfile | null) => ({
  'Content-Type': 'application/json',
  'X-TRPG-User-Id': user?.id || '',
  'X-TRPG-Username': encodeURIComponent(user?.username || ''),
});

class SessionTaskBoardService {
  private parseErrorPayload(text: string): {
    error?: string;
    activeLease?: { username?: string; expiresAt?: number | null };
    version?: number;
    remoteDoc?: SessionTaskBoardDocument;
  } | null {
    if (!text) return null;
    try {
      return JSON.parse(text) as {
        error?: string;
        activeLease?: { username?: string; expiresAt?: number | null };
        version?: number;
        remoteDoc?: SessionTaskBoardDocument;
      };
    } catch {
      return null;
    }
  }

  private messageFromPayload(payload: {
    error?: string;
    activeLease?: { username?: string; expiresAt?: number | null };
    version?: number;
  } | null, fallbackText: string, status: number): string {
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
      return '仅 GM 可以删除任务';
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
    if (!response.ok) {
      const text = await response.text();
      const payload = this.parseErrorPayload(text);
      const message = this.messageFromPayload(payload, text, response.status);
      if (payload?.error === 'version_conflict') {
        throw new VersionConflictError<SessionTaskBoardDocument>(message, {
          version: payload.version,
          remote: payload.remoteDoc ?? null,
        });
      }
      throw new Error(message);
    }
    return response.json() as Promise<T>;
  }

  private async readErrorMessage(response: Response): Promise<string> {
    const text = await response.text();
    const payload = this.parseErrorPayload(text);
    return this.messageFromPayload(payload, text, response.status);
  }

  async getTaskBoard(campaignId: string, user: UserProfile | null): Promise<SessionTaskBoardDocument> {
    const response = await fetch(`/api/campaigns/${campaignId}/session-tasks`, {
      headers: jsonHeaders(user),
    });
    return this.parseResponse<SessionTaskBoardDocument>(response);
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
      headers: jsonHeaders(user),
      body: JSON.stringify(payload),
    });
    return this.parseResponse<SessionTaskBoardDocument>(response);
  }

  async startLease(campaignId: string, user: UserProfile | null, role: CampaignMemberRole): Promise<SessionTaskBoardDocument> {
    const response = await fetch(`/api/campaigns/${campaignId}/session-tasks/lease/start`, {
      method: 'POST',
      headers: jsonHeaders(user),
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
      headers: jsonHeaders(user),
      body: JSON.stringify({ role, leaseStartedAt }),
    });
    return this.parseResponse<SessionTaskBoardDocument>(response);
  }

  async endLease(campaignId: string, user: UserProfile | null, leaseStartedAt?: number | null): Promise<void> {
    const response = await fetch(`/api/campaigns/${campaignId}/session-tasks/lease/end`, {
      method: 'POST',
      headers: jsonHeaders(user),
      body: JSON.stringify({ leaseStartedAt }),
    });
    if (!response.ok) {
      throw new Error(await this.readErrorMessage(response));
    }
  }
}

export const sessionTaskBoardService = new SessionTaskBoardService();
