import type { UserProfile } from '../types';
import { buildUserHeaders, readApiPayload } from './apiClient';

export interface PrepPackageCatalogItem { id: string; name: string }
export interface PrepPackageCatalogCategory { key: string; label: string; items: PrepPackageCatalogItem[] }
const readDownloadFileName = (response: Response) => {
  const disposition = response.headers.get('Content-Disposition') || '';
  const encoded = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  if (encoded) {
    try { return decodeURIComponent(encoded); } catch { /* Use the fallback below. */ }
  }
  return `TRPG模组导出-${new Date().toISOString().slice(0, 10)}.trpgzip`;
};

const downloadResponse = async (response: Response) => {
  const url = URL.createObjectURL(await response.blob());
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = readDownloadFileName(response);
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};

const readError = async (response: Response, fallback: string) => {
  const { text, payload } = await readApiPayload<{ error?: string }>(response);
  switch (payload?.error) {
    case 'forbidden': return '只有 GM 和副 GM 可以导入或导出备团包。';
    case 'empty_selection': return '请至少选择一个要导出的条目。';
    case 'unsupported_package': return '这不是受支持的备团包，或包版本过新。';
    case 'invalid_zip':
    case 'invalid_package': return '备团包文件已损坏或格式不正确。';
    case 'empty_package': return '备团包中没有可导入的内容。';
    default: return text || fallback;
  }
};

export const prepPackageService = {
  async getCatalog(campaignId: string, user: UserProfile | null) {
    const response = await fetch(`/api/prep-packages/campaigns/${encodeURIComponent(campaignId)}/catalog`, {
      headers: buildUserHeaders(user, { campaignId }),
    });
    if (!response.ok) throw new Error(await readError(response, '读取可导出内容失败。'));
    const payload = await response.json() as { categories: PrepPackageCatalogCategory[] };
    return payload.categories;
  },

  async exportPackage(campaignId: string, user: UserProfile | null, name: string, selections: Record<string, string[]>) {
    const response = await fetch(`/api/prep-packages/campaigns/${encodeURIComponent(campaignId)}/export`, {
      method: 'POST',
      headers: buildUserHeaders(user, { campaignId, includeJson: true }),
      body: JSON.stringify({ name, selections }),
    });
    if (!response.ok) throw new Error(await readError(response, '备团包导出失败。'));
    await downloadResponse(response);
  },
};
