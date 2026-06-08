import { UserProfile } from '../types';
import { buildUserHeaders, readApiPayload } from './apiClient';

export type BackupImportMode = 'add' | 'overwrite';

export interface BackupPreviewCampaign {
  originalCampaignId: string;
  name: string;
  description: string;
  collectionCounts: Record<string, number>;
  teamNoteCount: number;
  taskCount: number;
  assetCount: number;
  matchedCampaignId?: string;
  matchedCampaignName?: string;
}

export interface BackupPreviewResult {
  manifest: {
    exportType: string;
    exportedAt: number;
    appVersion: string;
    campaignCount: number;
    containsAssets: boolean;
  };
  fileName: string;
  campaigns: BackupPreviewCampaign[];
}

export interface BackupImportResult {
  importedCount: number;
  addedCount: number;
  overwrittenCount: number;
  skippedCount?: number;
  campaigns: Array<{ id: string; name: string; mode: 'added' | 'overwritten' }>;
  skippedCampaigns?: Array<{ originalCampaignId: string; name: string; reason: 'no_match' }>;
  missingAssetCount?: number;
  missingAssets?: string[];
}

type BackupErrorResponse = {
  error?: string;
  ref?: string;
};

const readDownloadFileName = (response: Response, fallbackName: string) => {
  const disposition = response.headers.get('Content-Disposition') || '';
  const encodedMatch = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (encodedMatch?.[1]) {
    try {
      return decodeURIComponent(encodedMatch[1]);
    } catch {
      return fallbackName;
    }
  }
  const plainMatch = disposition.match(/filename="?([^"]+)"?/i);
  if (plainMatch?.[1]) return plainMatch[1];
  return fallbackName;
};

const triggerDownload = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};

async function parseImportResponse(response: Response) {
  const { text, payload } = await readApiPayload<BackupImportResult>(response);
  if (!response.ok) {
    throw new Error(text || '备份导入失败');
  }
  return payload ?? { importedCount: 0, addedCount: 0, overwrittenCount: 0, skippedCount: 0, campaigns: [], skippedCampaigns: [] };
}

async function parsePreviewResponse(response: Response) {
  const { text, payload } = await readApiPayload<BackupPreviewResult>(response);
  if (!response.ok) {
    throw new Error(text || '备份预览失败');
  }
  return payload;
}

async function readBackupError(response: Response, fallbackMessage: string) {
  const text = await response.text();
  if (!text) return fallbackMessage;
  try {
    const payload = JSON.parse(text) as BackupErrorResponse;
    switch (payload.error) {
      case 'missing_identity':
        return '当前用户信息缺失，请重新登录后再试。';
      case 'not_found':
        return '后端未找到这个模组的存档。';
      case 'no_campaigns':
        return '后端未找到可导出的模组。';
      case 'database_error':
        return '后端读取存档失败，请稍后重试。';
      case 'bundle_collect_failed':
        return '整理备份资源失败，请检查当前模组数据。';
      case 'invalid_payload':
        return '本地备份数据整理失败。';
      default:
        return payload.error ? `${fallbackMessage}（${payload.error}）` : text;
    }
  } catch {
    return text;
  }
}

async function triggerResponseDownload(response: Response, fallbackName: string) {
  const blob = await response.blob();
  triggerDownload(blob, readDownloadFileName(response, fallbackName));
}

export const backupService = {
  isBundleFile(file: File) {
    const lower = (file.name || '').toLowerCase();
    return lower.endsWith('.zip') || lower.endsWith('.trpgzip');
  },

  async exportCampaign(campaignId: string, user: UserProfile | null, includeAssets: boolean = true) {
    const response = await fetch(`/api/backups/campaigns/${encodeURIComponent(campaignId)}/export?includeAssets=${includeAssets ? '1' : '0'}`, {
      headers: buildUserHeaders(user),
    });
    if (!response.ok) {
      throw new Error(await readBackupError(response, '单模组备份导出失败'));
    }
    await triggerResponseDownload(response, `campaign-${campaignId}.zip`);
  },

  async exportAll(user: UserProfile | null, includeAssets: boolean = true) {
    const response = await fetch(`/api/backups/export-all?includeAssets=${includeAssets ? '1' : '0'}`, {
      headers: buildUserHeaders(user),
    });
    if (!response.ok) {
      throw new Error(await readBackupError(response, '全量备份导出失败'));
    }
    await triggerResponseDownload(response, 'trpg-note-backup.zip');
  },

  async previewBundle(file: File, user: UserProfile | null) {
    const formData = new FormData();
    formData.append('file', file);
    const response = await fetch('/api/backups/preview', {
      method: 'POST',
      headers: buildUserHeaders(user),
      body: formData,
    });
    return parsePreviewResponse(response);
  },

  async importBundle(file: File, user: UserProfile | null, mode: BackupImportMode = 'add') {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('mode', mode);
    const response = await fetch('/api/backups/import', {
      method: 'POST',
      headers: buildUserHeaders(user),
      body: formData,
    });
    return parseImportResponse(response);
  },
};
