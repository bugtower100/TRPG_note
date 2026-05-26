import type { CampaignData, CampaignSummary, UserProfile } from '../types';
import {
  createV2Campaign as createGeneratedV2Campaign,
  deleteV2Campaign as deleteGeneratedV2Campaign,
  getV2CampaignBundle as getGeneratedV2CampaignBundle,
  listV2Campaigns as listGeneratedV2Campaigns,
  updateV2CampaignBundle as updateGeneratedV2CampaignBundle,
} from '../generated/api';
import type { V2CampaignBundle as GeneratedV2CampaignBundle } from '../generated/api';
import { VersionConflictError } from './conflictError';
import { buildUserHeaders } from './apiClient';
import { getGeneratedApiClient } from './generatedApiClient';

export interface CampaignBundleV2Response {
  campaignId: string;
  version: number;
  bundle: CampaignData;
}

export interface V2CreateCampaignResponse {
  summary: CampaignSummary;
  bundle: CampaignBundleV2Response;
}

const messageFromPayload = (
  payload: { error?: string; version?: number; bundle?: CampaignData } | null,
  fallbackText: string,
  status: number
) => {
  if (!payload?.error) {
    return fallbackText || `HTTP ${status}`;
  }
  switch (payload.error) {
    case 'missing_identity':
      return '当前用户信息缺失，请重新登录后再试。';
    case 'forbidden':
      return '你没有权限访问这个模组。';
    case 'join_password_required':
      return '进入密码错误或未提供，请重新输入。';
    case 'conflict':
      return '模组内容已被其他会话更新，请刷新后重试。';
    case 'database_error':
      return '后端数据处理失败，请稍后重试。';
    case 'not_found':
      return '模组不存在或已被删除。';
    default:
      return payload.error;
  }
};

const rethrowCampaignError = (error: unknown): never => {
  const payload = error as { error?: string; version?: number; bundle?: CampaignData } | null;
  const status =
    typeof (payload as { status?: unknown } | null)?.status === 'number'
      ? Number((payload as { status?: number }).status)
      : 500;
  const fallbackText = error instanceof Error ? error.message : '';
  const message = messageFromPayload(payload, fallbackText, status);
  if (payload?.error === 'conflict') {
    throw new VersionConflictError<CampaignData>(message, {
      version: payload.version,
      remote: payload.bundle ?? null,
    });
  }
  throw new Error(message);
};

const unwrapGeneratedResponse = <T>(result: { data?: T; error?: unknown }): T => {
  if (result.error) {
    throw result.error;
  }
  return result.data as T;
};

export const campaignV2Service = {
  async list(user: UserProfile | null): Promise<CampaignSummary[]> {
    try {
      const response = unwrapGeneratedResponse(await listGeneratedV2Campaigns({
        client: getGeneratedApiClient(),
        headers: buildUserHeaders(user),
      }));
      return (response ?? []) as CampaignSummary[];
    } catch (error) {
      rethrowCampaignError(error);
    }
  },

  async create(user: UserProfile | null, name: string, description: string): Promise<V2CreateCampaignResponse> {
    try {
      return unwrapGeneratedResponse(await createGeneratedV2Campaign({
        client: getGeneratedApiClient(),
        headers: buildUserHeaders(user, { includeJson: true }),
        body: { name, description },
      })) as unknown as V2CreateCampaignResponse;
    } catch (error) {
      rethrowCampaignError(error);
    }
  },

  async delete(campaignId: string, user: UserProfile | null): Promise<void> {
    try {
      unwrapGeneratedResponse(await deleteGeneratedV2Campaign({
        client: getGeneratedApiClient(),
        headers: buildUserHeaders(user, { campaignId }),
        path: { campaignId },
      }));
    } catch (error) {
      rethrowCampaignError(error);
    }
  },

  async loadBundle(campaignId: string, user: UserProfile | null): Promise<CampaignBundleV2Response> {
    try {
      return unwrapGeneratedResponse(await getGeneratedV2CampaignBundle({
        client: getGeneratedApiClient(),
        headers: buildUserHeaders(user, { campaignId }),
        path: { campaignId },
      })) as unknown as CampaignBundleV2Response;
    } catch (error) {
      rethrowCampaignError(error);
    }
  },

  async saveBundle(
    campaignId: string,
    bundle: CampaignData,
    user: UserProfile | null,
    expectedVersion: number
  ): Promise<CampaignBundleV2Response> {
    try {
      return unwrapGeneratedResponse(await updateGeneratedV2CampaignBundle({
        client: getGeneratedApiClient(),
        headers: buildUserHeaders(user, { includeJson: true, campaignId }),
        path: { campaignId },
        body: {
          expectedVersion,
          bundle: bundle as unknown as GeneratedV2CampaignBundle,
        },
      })) as unknown as CampaignBundleV2Response;
    } catch (error) {
      rethrowCampaignError(error);
    }
  },
};
