import type {
  MindMapHistoryDocument,
  MindMapHistoryState,
  UserProfile,
} from '../types';
import { normalizeMindMapCompatibility } from '../utils/mindMapCompatibility';
import { buildUserHeaders, readApiPayload } from './apiClient';

interface MindMapHistoryErrorPayload {
  error?: string;
  history?: MindMapHistoryDocument;
}

const normalizeHistoryDocument = (
  document: MindMapHistoryDocument
): MindMapHistoryDocument => {
  const histories = Object.fromEntries(
    Object.entries(document.histories || {}).map(([mindMapId, history]) => [
      mindMapId,
      {
        past: Array.isArray(history?.past)
          ? history.past.map(normalizeMindMapCompatibility)
          : [],
        future: Array.isArray(history?.future)
          ? history.future.map(normalizeMindMapCompatibility)
          : [],
      },
    ])
  );
  return { ...document, histories };
};

export class MindMapHistoryConflictError extends Error {
  current: MindMapHistoryDocument;

  constructor(current: MindMapHistoryDocument) {
    super('思维导图撤销历史已被其他会话更新。');
    this.name = 'MindMapHistoryConflictError';
    this.current = normalizeHistoryDocument(current);
  }
}

const parseHistoryResponse = async (response: Response): Promise<MindMapHistoryDocument> => {
  const { text, payload } = await readApiPayload<MindMapHistoryDocument & MindMapHistoryErrorPayload>(
    response
  );
  if (response.status === 409 && payload?.history) {
    throw new MindMapHistoryConflictError(payload.history);
  }
  if (!response.ok || !payload) {
    const errorCode = payload?.error;
    if (errorCode === 'forbidden') {
      throw new Error('你没有权限读取或保存思维导图撤销历史。');
    }
    throw new Error(text || `撤销历史请求失败（HTTP ${response.status}）`);
  }
  return normalizeHistoryDocument(payload);
};

export const mindMapHistoryService = {
  async load(
    campaignId: string,
    user: UserProfile | null
  ): Promise<MindMapHistoryDocument> {
    const response = await fetch(`/api/v2/campaigns/${campaignId}/mind-map-history`, {
      headers: buildUserHeaders(user, { campaignId }),
    });
    return parseHistoryResponse(response);
  },

  async save(
    campaignId: string,
    user: UserProfile | null,
    histories: Record<string, MindMapHistoryState>,
    expectedVersion: number,
    keepalive = false
  ): Promise<MindMapHistoryDocument> {
    const response = await fetch(`/api/v2/campaigns/${campaignId}/mind-map-history`, {
      method: 'PUT',
      headers: buildUserHeaders(user, { campaignId, includeJson: true }),
      body: JSON.stringify({ expectedVersion, histories }),
      keepalive,
    });
    return parseHistoryResponse(response);
  },
};
