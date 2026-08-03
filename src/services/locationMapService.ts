import {
  getLocationMaps as getGeneratedLocationMaps,
  updateLocationMaps as updateGeneratedLocationMaps,
} from '../generated/api';
import type {
  LocationMapDocument,
  LocationMapUpdateRequest,
  UserProfile,
} from '../types';
import { buildUserHeaders } from './apiClient';
import {
  rethrowGeneratedCollaborationError,
  unwrapGeneratedResponse,
  type CollaborationErrorPayload,
} from './collaborationApi';
import { getGeneratedApiClient } from './generatedApiClient';

const messageFromPayload = (
  payload: CollaborationErrorPayload<LocationMapDocument> | null,
  fallbackText: string,
  status: number
): string => {
  switch (payload?.error) {
    case 'version_conflict':
      return `地图地点已被其他会话更新，请刷新后重试（当前版本 ${payload.version ?? '未知'}）`;
    case 'forbidden':
      return '你没有权限修改地图地点';
    case 'missing_identity':
      return '当前用户信息缺失，请重新登录后再试';
    case 'duplicate_map_id':
      return '地图数据包含重复 ID';
    case 'duplicate_point_id':
      return '点位数据包含重复 ID';
    case 'location_id_required':
      return '点位必须关联一个地点';
    case 'invalid_icon_id':
      return '点位图标编号必须在 1—14 之间';
    case 'invalid_coordinates':
      return '点位坐标超出地图范围';
    default:
      return payload?.error || fallbackText || `HTTP ${status}`;
  }
};

const rethrowLocationMapError = (error: unknown): never => {
  rethrowGeneratedCollaborationError<LocationMapDocument>(error, {
    remoteFieldNames: ['remoteDoc'],
    messageFromPayload,
  });
};

export const locationMapService = {
  async load(
    campaignId: string,
    user: UserProfile | null
  ): Promise<LocationMapDocument> {
    try {
      return unwrapGeneratedResponse(await getGeneratedLocationMaps({
        client: getGeneratedApiClient(),
        headers: buildUserHeaders(user, { campaignId }),
        path: { campaignId },
      })) as LocationMapDocument;
    } catch (error) {
      rethrowLocationMapError(error);
    }
  },

  async save(
    campaignId: string,
    user: UserProfile | null,
    request: LocationMapUpdateRequest
  ): Promise<LocationMapDocument> {
    try {
      return unwrapGeneratedResponse(await updateGeneratedLocationMaps({
        client: getGeneratedApiClient(),
        headers: buildUserHeaders(user, { campaignId, includeJson: true }),
        path: { campaignId },
        body: request,
      })) as LocationMapDocument;
    } catch (error) {
      rethrowLocationMapError(error);
    }
  },
};
