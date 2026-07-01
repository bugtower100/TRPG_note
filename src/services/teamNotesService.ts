import {
  getCampaignConfig as getGeneratedCampaignConfig,
  listPublicCampaigns as listGeneratedPublicCampaigns,
  listTeamNotes as listGeneratedTeamNotes,
} from '../generated/api';
import { CampaignConfig, CampaignMemberRole, CampaignVisibility, PublicCampaignSummary, TeamNoteDocument, UserProfile } from '../types';
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

class TeamNotesService {
  private messageFromPayload(
    payload: CollaborationErrorPayload<TeamNoteDocument> | null,
    fallbackText: string,
    status: number
  ): string {
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
      if (payload.error === 'join_password_required') {
        return '进入密码错误或未提供，请重新输入。';
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

  private async parseResponse<T>(response: Response): Promise<T> {
    return parseCollaborationResponse<T, TeamNoteDocument>(response, {
      remoteFieldNames: ['remoteNote'],
      messageFromPayload: this.messageFromPayload.bind(this),
    });
  }

  async getConfig(campaignId: string, user: UserProfile | null): Promise<CampaignConfig> {
    try {
      return unwrapGeneratedResponse(await getGeneratedCampaignConfig({
        client: getGeneratedApiClient(),
        headers: buildUserHeaders(user, { campaignId }),
        path: { campaignId },
      })) as CampaignConfig;
    } catch (error) {
      rethrowGeneratedCollaborationError<TeamNoteDocument>(error, {
        remoteFieldNames: ['remoteNote'],
        messageFromPayload: this.messageFromPayload.bind(this),
      });
    }
  }

  async updateConfig(
    campaignId: string,
    user: UserProfile | null,
    payload: {
      visibility?: CampaignVisibility;
      name?: string;
      description?: string;
      lastModified?: number;
      joinPassword?: string;
      clearJoinPassword?: boolean;
    }
  ): Promise<CampaignConfig> {
    const response = await fetch(`/api/campaigns/${campaignId}/config`, {
      method: 'PUT',
      headers: buildCollaborationHeaders(user, campaignId),
      body: JSON.stringify(payload),
    });
    return this.parseResponse<CampaignConfig>(response);
  }

  async removeMember(campaignId: string, memberUserId: string, user: UserProfile | null): Promise<CampaignConfig> {
    const response = await fetch(`/api/campaigns/${campaignId}/members/${memberUserId}`, {
      method: 'DELETE',
      headers: buildCollaborationHeaders(user, campaignId),
    });
    return this.parseResponse<CampaignConfig>(response);
  }

  async updateMemberRole(
    campaignId: string,
    memberUserId: string,
    role: CampaignMemberRole,
    user: UserProfile | null
  ): Promise<CampaignConfig> {
    const response = await fetch(`/api/campaigns/${campaignId}/members/${memberUserId}/role`, {
      method: 'PUT',
      headers: buildCollaborationHeaders(user, campaignId),
      body: JSON.stringify({ role }),
    });
    return this.parseResponse<CampaignConfig>(response);
  }

  async listTeamNotes(campaignId: string, user: UserProfile | null): Promise<TeamNoteDocument[]> {
    try {
      return (unwrapGeneratedResponse(await listGeneratedTeamNotes({
        client: getGeneratedApiClient(),
        headers: buildUserHeaders(user, { campaignId }),
        path: { campaignId },
      })) ?? []) as TeamNoteDocument[];
    } catch (error) {
      rethrowGeneratedCollaborationError<TeamNoteDocument>(error, {
        remoteFieldNames: ['remoteNote'],
        messageFromPayload: this.messageFromPayload.bind(this),
      });
    }
  }

  async createTeamNote(campaignId: string, user: UserProfile | null, title: string): Promise<TeamNoteDocument> {
    const response = await fetch(`/api/campaigns/${campaignId}/team-notes`, {
      method: 'POST',
      headers: buildCollaborationHeaders(user, campaignId),
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
      headers: buildCollaborationHeaders(user, campaignId),
      body: JSON.stringify(payload),
    });
    return this.parseResponse<TeamNoteDocument>(response);
  }

  async startLease(campaignId: string, noteId: string, user: UserProfile | null, role: CampaignMemberRole): Promise<TeamNoteDocument> {
    const response = await fetch(`/api/campaigns/${campaignId}/team-notes/${noteId}/lease/start`, {
      method: 'POST',
      headers: buildCollaborationHeaders(user, campaignId),
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
      headers: buildCollaborationHeaders(user, campaignId),
      body: JSON.stringify({ role, leaseStartedAt }),
    });
    return this.parseResponse<TeamNoteDocument>(response);
  }

  async endLease(campaignId: string, noteId: string, user: UserProfile | null, leaseStartedAt?: number | null): Promise<void> {
    const response = await fetch(`/api/campaigns/${campaignId}/team-notes/${noteId}/lease/end`, {
      method: 'POST',
      headers: buildCollaborationHeaders(user, campaignId),
      body: JSON.stringify({ leaseStartedAt }),
    });
    if (!response.ok) {
      throw new Error(await readCollaborationErrorMessage<TeamNoteDocument>(response, {
        remoteFieldNames: ['remoteNote'],
        messageFromPayload: this.messageFromPayload.bind(this),
      }));
    }
  }

  async deleteTeamNote(campaignId: string, noteId: string, user: UserProfile | null): Promise<void> {
    const response = await fetch(`/api/campaigns/${campaignId}/team-notes/${noteId}`, {
      method: 'DELETE',
      headers: buildCollaborationHeaders(user, campaignId),
    });
    if (!response.ok) {
      throw new Error(await readCollaborationErrorMessage<TeamNoteDocument>(response, {
        remoteFieldNames: ['remoteNote'],
        messageFromPayload: this.messageFromPayload.bind(this),
      }));
    }
  }

  async listPublicCampaigns(user: UserProfile | null): Promise<PublicCampaignSummary[]> {
    try {
      return (unwrapGeneratedResponse(await listGeneratedPublicCampaigns({
        client: getGeneratedApiClient(),
        headers: buildUserHeaders(user),
      })) ?? []) as PublicCampaignSummary[];
    } catch (error) {
      rethrowGeneratedCollaborationError<TeamNoteDocument>(error, {
        remoteFieldNames: ['remoteNote'],
        messageFromPayload: this.messageFromPayload.bind(this),
      });
    }
  }
}

export const teamNotesService = new TeamNotesService();
