import {
  applyLocationMapDrawingOperation as applyGeneratedLocationMapDrawingOperation,
  getLocationMapDrawing as getGeneratedLocationMapDrawing,
} from '../generated/api';
import type {
  LocationMapDrawingDocument,
  LocationMapDrawingOperation,
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
  payload: CollaborationErrorPayload<LocationMapDrawingDocument> | null,
  fallbackText: string,
  status: number
): string => {
  switch (payload?.error) {
    case 'forbidden_shape_delete':
      return '只能删除自己绘制的内容';
    case 'forbidden':
      return '你没有权限执行这项画板操作';
    case 'map_not_found':
      return '当前地图已被删除或不存在';
    case 'too_many_shapes':
      return '当前地图的画板图形数量已达到上限';
    case 'drawing_update_conflict':
      return '画板正在被其他成员更新，请稍后重试';
    case 'invalid_shape_points':
    case 'invalid_shape_type':
    case 'invalid_stroke_width':
    case 'invalid_stroke_color':
      return '画板图形数据无效';
    default:
      return payload?.error || fallbackText || `HTTP ${status}`;
  }
};

const rethrowDrawingError = (error: unknown): never => {
  rethrowGeneratedCollaborationError<LocationMapDrawingDocument>(error, {
    remoteFieldNames: [],
    messageFromPayload,
  });
};

export const locationMapDrawingService = {
  async load(
    campaignId: string,
    mapId: string,
    user: UserProfile | null
  ): Promise<LocationMapDrawingDocument> {
    try {
      return unwrapGeneratedResponse(await getGeneratedLocationMapDrawing({
        client: getGeneratedApiClient(),
        headers: buildUserHeaders(user, { campaignId }),
        path: { campaignId, mapId },
      })) as LocationMapDrawingDocument;
    } catch (error) {
      rethrowDrawingError(error);
    }
  },

  async applyOperation(
    campaignId: string,
    mapId: string,
    user: UserProfile | null,
    operation: LocationMapDrawingOperation
  ): Promise<LocationMapDrawingDocument> {
    try {
      return unwrapGeneratedResponse(await applyGeneratedLocationMapDrawingOperation({
        client: getGeneratedApiClient(),
        headers: buildUserHeaders(user, { campaignId, includeJson: true }),
        path: { campaignId, mapId },
        body: operation,
      })) as LocationMapDrawingDocument;
    } catch (error) {
      rethrowDrawingError(error);
    }
  },
};
