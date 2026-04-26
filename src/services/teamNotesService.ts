import { CampaignConfig, CampaignMemberRole, CampaignVisibility, PublicCampaignSummary, TeamNoteDocument, UserProfile } from '../types';
import { VersionConflictError } from './conflictError';

const jsonHeaders = (user: UserProfile | null) => ({
  'Content-Type': 'application/json',
  'X-TRPG-User-Id': user?.id || '',
  'X-TRPG-Username': encodeURIComponent(user?.username || ''),
});

class TeamNotesService {
  private parseErrorPayload(text: string): {
    error?: string;
    activeLease?: { username?: string; expiresAt?: number | null };
    version?: number;
    remoteNote?: TeamNoteDocument;
  } | null {
    if (!text) return null;
    try {
      return JSON.parse(text) as {
        error?: string;
        activeLease?: { username?: string; expiresAt?: number | null };
        version?: number;
        remoteNote?: TeamNoteDocument;
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
    if (payload) {
      if (payload.error === 'lease_conflict') {
        const username = payload.activeLease?.username || '其他人';
        return `${username} 正在编辑这条团队笔记，请稍后再试`;
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
      if (payload.error === 'not_found') {
        return '目标团队笔记不存在或已被删除';
      }
      if (payload.error === 'missing_identity') {
        return '当前用户信息缺失，请重新登录后再试';
      }
      if (typeof payload.error === 'string' && payload.error.trim()) {
        return payload.error;
      }
    }
    return fallbackText || `HTTP ${status}`;
  }

  private async readErrorMessage(response: Response): Promise<string> {
    const text = await response.text();
    const payload = this.parseErrorPayload(text);
    return this.messageFromPayload(payload, text, response.status);
  }

  private async parseResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      const text = await response.text();
      const payload = this.parseErrorPayload(text);
      const message = this.messageFromPayload(payload, text, response.status);
      if (payload?.error === 'version_conflict') {
        throw new VersionConflictError<TeamNoteDocument>(message, {
          version: payload.version,
          remote: payload.remoteNote ?? null,
        });
      }
      throw new Error(message);
    }
    return response.json() as Promise<T>;
  }

  async getConfig(campaignId: string, user: UserProfile | null): Promise<CampaignConfig> {
    const response = await fetch(`/api/campaigns/${campaignId}/config`, {
      headers: jsonHeaders(user),
    });
    return this.parseResponse<CampaignConfig>(response);
  }

  async updateConfig(
    campaignId: string,
    user: UserProfile | null,
    payload: { visibility?: CampaignVisibility; name?: string; description?: string; lastModified?: number }
  ): Promise<CampaignConfig> {
    const response = await fetch(`/api/campaigns/${campaignId}/config`, {
      method: 'PUT',
      headers: jsonHeaders(user),
      body: JSON.stringify(payload),
    });
    return this.parseResponse<CampaignConfig>(response);
  }

  async listTeamNotes(campaignId: string, user: UserProfile | null): Promise<TeamNoteDocument[]> {
    const response = await fetch(`/api/campaigns/${campaignId}/team-notes`, {
      headers: jsonHeaders(user),
    });
    return this.parseResponse<TeamNoteDocument[]>(response);
  }

  async createTeamNote(campaignId: string, user: UserProfile | null, title: string): Promise<TeamNoteDocument> {
    const response = await fetch(`/api/campaigns/${campaignId}/team-notes`, {
      method: 'POST',
      headers: jsonHeaders(user),
      body: JSON.stringify({ title }),
    });
    return this.parseResponse<TeamNoteDocument>(response);
  }

  async saveTeamNote(
    campaignId: string,
    noteId: string,
    user: UserProfile | null,
    payload: { title: string; content: string; expectedVersion?: number; leaseStartedAt?: number | null }
  ): Promise<TeamNoteDocument> {
    const response = await fetch(`/api/campaigns/${campaignId}/team-notes/${noteId}`, {
      method: 'PUT',
      headers: jsonHeaders(user),
      body: JSON.stringify(payload),
    });
    return this.parseResponse<TeamNoteDocument>(response);
  }

  async startLease(campaignId: string, noteId: string, user: UserProfile | null, role: CampaignMemberRole): Promise<TeamNoteDocument> {
    const response = await fetch(`/api/campaigns/${campaignId}/team-notes/${noteId}/lease/start`, {
      method: 'POST',
      headers: jsonHeaders(user),
      body: JSON.stringify({ role }),
    });
    return this.parseResponse<TeamNoteDocument>(response);
  }

  async refreshLease(
    campaignId: string,
    noteId: string,
    user: UserProfile | null,
    role: CampaignMemberRole,
    leaseStartedAt?: number | null
  ): Promise<TeamNoteDocument> {
    const response = await fetch(`/api/campaigns/${campaignId}/team-notes/${noteId}/lease/refresh`, {
      method: 'POST',
      headers: jsonHeaders(user),
      body: JSON.stringify({ role, leaseStartedAt }),
    });
    return this.parseResponse<TeamNoteDocument>(response);
  }

  async endLease(campaignId: string, noteId: string, user: UserProfile | null, leaseStartedAt?: number | null): Promise<void> {
    const response = await fetch(`/api/campaigns/${campaignId}/team-notes/${noteId}/lease/end`, {
      method: 'POST',
      headers: jsonHeaders(user),
      body: JSON.stringify({ leaseStartedAt }),
    });
    if (!response.ok) {
      throw new Error(await this.readErrorMessage(response));
    }
  }

  async deleteTeamNote(campaignId: string, noteId: string, user: UserProfile | null): Promise<void> {
    const response = await fetch(`/api/campaigns/${campaignId}/team-notes/${noteId}`, {
      method: 'DELETE',
      headers: jsonHeaders(user),
    });
    if (!response.ok) {
      throw new Error(await this.readErrorMessage(response));
    }
  }

  async listPublicCampaigns(user: UserProfile | null): Promise<PublicCampaignSummary[]> {
    const response = await fetch('/api/campaigns/public', {
      headers: jsonHeaders(user),
    });
    return this.parseResponse<PublicCampaignSummary[]>(response);
  }
}

export const teamNotesService = new TeamNotesService();
