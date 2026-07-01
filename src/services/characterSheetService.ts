import {
  createCharacterSheet as createGeneratedCharacterSheet,
  deleteCharacterSheet as deleteGeneratedCharacterSheet,
  getCharacterSheet as getGeneratedCharacterSheet,
  listCharacterSheets as listGeneratedCharacterSheets,
  previewCharacterSheetImport as previewGeneratedCharacterSheetImport,
  updateCharacterSheet as updateGeneratedCharacterSheet,
} from '../generated/api';
import type {
  CharacterSheetCreateRequest,
  CharacterSheetDocument,
  CharacterSheetImportPreview,
  CharacterSheetImportPreviewRequest,
  CharacterSheetSummary,
} from '../generated/api';
import type { UserProfile } from '../types';
import { buildUserHeaders } from './apiClient';
import { getGeneratedApiClient } from './generatedApiClient';

const mapSheetError = (payload: { error?: string; sheet?: CharacterSheetDocument } | null, status: number) => {
  switch (payload?.error) {
    case 'missing_identity':
      return '当前用户信息缺失，请重新登录后再试。';
    case 'forbidden':
      return '你没有权限访问或修改这张角色卡。';
    case 'not_found':
      return '角色卡不存在或已被删除。';
    case 'conflict':
      return '角色卡已被其他会话更新，请刷新后重试。';
    case 'database_error':
      return '后端数据处理失败，请稍后重试。';
    case 'empty_text':
      return '请先输入要识别的角色卡文本。';
    default:
      return payload?.error || `HTTP ${status}`;
  }
};

const unwrapGeneratedResponse = <T>(result: { data?: T; error?: unknown }): T => {
  if (result.error) {
    const payload = result.error as { error?: string; sheet?: CharacterSheetDocument; status?: number } | null;
    const status = typeof payload?.status === 'number' ? payload.status : 500;
    throw new Error(mapSheetError(payload, status));
  }
  return result.data as T;
};

const serializeDebugError = (error: unknown) => {
  if (error instanceof Error) {
    const typed = error as Error & { cause?: unknown };
    return {
      type: error.name || 'Error',
      message: error.message,
      stack: error.stack || '',
      cause: typed.cause ?? null,
    };
  }
  if (typeof error === 'object' && error !== null) {
    try {
      return JSON.parse(JSON.stringify(error));
    } catch {
      return { value: String(error) };
    }
  }
  return { value: String(error) };
};

export const characterSheetService = {
  async list(campaignId: string, user: UserProfile | null): Promise<CharacterSheetSummary[]> {
    return (unwrapGeneratedResponse(await listGeneratedCharacterSheets({
      client: getGeneratedApiClient(),
      headers: buildUserHeaders(user, { campaignId }),
      path: { campaignId },
    })) ?? []) as CharacterSheetSummary[];
  },

  async get(campaignId: string, sheetId: string, user: UserProfile | null): Promise<CharacterSheetDocument> {
    return unwrapGeneratedResponse(await getGeneratedCharacterSheet({
      client: getGeneratedApiClient(),
      headers: buildUserHeaders(user, { campaignId }),
      path: { campaignId, sheetId },
    })) as CharacterSheetDocument;
  },

  async create(
    campaignId: string,
    payload: CharacterSheetCreateRequest,
    user: UserProfile | null
  ): Promise<CharacterSheetDocument> {
    return unwrapGeneratedResponse(await createGeneratedCharacterSheet({
      client: getGeneratedApiClient(),
      headers: buildUserHeaders(user, { campaignId, includeJson: true }),
      path: { campaignId },
      body: payload,
    })) as CharacterSheetDocument;
  },

  async previewImport(
    campaignId: string,
    payload: CharacterSheetImportPreviewRequest,
    user: UserProfile | null
  ): Promise<CharacterSheetImportPreview> {
    // #region debug-point B:service-request
    fetch('http://127.0.0.1:7777/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'import-preview-failure',
        runId: 'pre-fix',
        hypothesisId: 'B',
        location: 'characterSheetService.ts:previewImport:before',
        msg: '[DEBUG] characterSheetService previewImport start',
        data: {
          campaignId,
          userId: user?.id || '',
          systemHint: payload.systemHint || '',
          textLength: payload.text?.length || 0,
        },
        ts: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
    try {
      const result = unwrapGeneratedResponse(await previewGeneratedCharacterSheetImport({
        client: getGeneratedApiClient(),
        headers: buildUserHeaders(user, { campaignId, includeJson: true }),
        path: { campaignId },
        body: payload,
      })) as CharacterSheetImportPreview;
      // #region debug-point B:service-success
      fetch('http://127.0.0.1:7777/event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: 'import-preview-failure',
          runId: 'pre-fix',
          hypothesisId: 'B',
          location: 'characterSheetService.ts:previewImport:success',
          msg: '[DEBUG] characterSheetService previewImport success',
          data: {
            detectedSystem: result.detectedSystem,
            system: result.system,
            confidence: result.confidence,
          },
          ts: Date.now(),
        }),
      }).catch(() => {});
      // #endregion
      return result;
    } catch (error) {
      // #region debug-point B:service-error
      fetch('http://127.0.0.1:7777/event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: 'import-preview-failure',
          runId: 'pre-fix',
          hypothesisId: 'B',
          location: 'characterSheetService.ts:previewImport:error',
          msg: '[DEBUG] characterSheetService previewImport error',
          data: {
            error: serializeDebugError(error),
          },
          ts: Date.now(),
        }),
      }).catch(() => {});
      // #endregion
      throw error;
    }
  },

  async update(
    campaignId: string,
    sheet: CharacterSheetDocument,
    user: UserProfile | null
  ): Promise<CharacterSheetDocument> {
    return unwrapGeneratedResponse(await updateGeneratedCharacterSheet({
      client: getGeneratedApiClient(),
      headers: buildUserHeaders(user, { campaignId, includeJson: true }),
      path: { campaignId, sheetId: sheet.id },
      body: {
        expectedVersion: sheet.version,
        sheet,
      },
    })) as CharacterSheetDocument;
  },

  async remove(campaignId: string, sheetId: string, user: UserProfile | null): Promise<void> {
    unwrapGeneratedResponse(await deleteGeneratedCharacterSheet({
      client: getGeneratedApiClient(),
      headers: buildUserHeaders(user, { campaignId }),
      path: { campaignId, sheetId },
    }));
  },
};
