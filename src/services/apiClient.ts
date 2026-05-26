import type { UserProfile } from '../types';
import { campaignAccessService } from './campaignAccessService';

export type ApiErrorPayload = Record<string, unknown> & {
  error?: string;
};

interface BuildUserHeadersOptions {
  includeJson?: boolean;
  campaignId?: string;
  extraHeaders?: Record<string, string>;
}

export const buildUserHeaders = (
  user: UserProfile | null,
  options: BuildUserHeadersOptions = {}
) => {
  const headers: Record<string, string> = {
    'X-TRPG-User-Id': user?.id || '',
    'X-TRPG-Username': encodeURIComponent(user?.username || ''),
    ...campaignAccessService.buildHeaders(options.campaignId),
    ...(options.extraHeaders || {}),
  };
  if (options.includeJson) {
    headers['Content-Type'] = 'application/json';
  }
  return headers;
};

export async function readApiPayload<T>(response: Response): Promise<{
  text: string;
  payload: T | null;
}> {
  const text = await response.text();
  if (!text) {
    return { text: '', payload: null };
  }
  try {
    return {
      text,
      payload: JSON.parse(text) as T,
    };
  } catch {
    return {
      text,
      payload: null,
    };
  }
}

export async function parseJsonResponse<T>(
  response: Response,
  fallbackMessage: string
): Promise<T> {
  const { text, payload } = await readApiPayload<T>(response);
  if (!response.ok) {
    throw new Error(text || fallbackMessage);
  }
  return payload as T;
}
