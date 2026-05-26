import { VersionConflictError } from './conflictError';
import { buildUserHeaders, readApiPayload } from './apiClient';
import type { UserProfile } from '../types';

export interface LeaseInfo {
  username?: string;
  expiresAt?: number | null;
}

export interface CollaborationErrorPayload<TRemote> {
  error?: string;
  activeLease?: LeaseInfo;
  version?: number;
  remote?: TRemote | null;
}

export const buildCollaborationHeaders = (
  user: UserProfile | null,
  campaignId?: string
) => buildUserHeaders(user, { includeJson: true, campaignId });

export const unwrapGeneratedResponse = <T>(result: { data?: T; error?: unknown }): T => {
  if (result.error) {
    throw result.error;
  }
  return result.data as T;
};

export function parseCollaborationErrorPayload<TRemote>(
  raw: unknown,
  remoteFieldNames: string[]
): CollaborationErrorPayload<TRemote> | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const payload = raw as Record<string, unknown>;
  let remote: TRemote | null = null;
  for (const key of remoteFieldNames) {
    if (key in payload) {
      remote = (payload[key] as TRemote) ?? null;
      break;
    }
  }
  return {
    error: typeof payload.error === 'string' ? payload.error : undefined,
    activeLease:
      payload.activeLease && typeof payload.activeLease === 'object'
        ? (payload.activeLease as LeaseInfo)
        : undefined,
    version: typeof payload.version === 'number' ? payload.version : undefined,
    remote,
  };
}

export async function parseCollaborationResponse<TResponse, TRemote = TResponse>(
  response: Response,
  options: {
    remoteFieldNames: string[];
    messageFromPayload: (
      payload: CollaborationErrorPayload<TRemote> | null,
      fallbackText: string,
      status: number
    ) => string;
  }
): Promise<TResponse> {
  const { text, payload } = await readApiPayload<Record<string, unknown>>(response);
  if (!response.ok) {
    const parsedPayload = parseCollaborationErrorPayload<TRemote>(payload, options.remoteFieldNames);
    const message = options.messageFromPayload(parsedPayload, text, response.status);
    if (parsedPayload?.error === 'version_conflict') {
      throw new VersionConflictError<TRemote>(message, {
        version: parsedPayload.version,
        remote: parsedPayload.remote ?? null,
      });
    }
    throw new Error(message);
  }
  return payload as TResponse;
}

export async function readCollaborationErrorMessage<TRemote>(
  response: Response,
  options: {
    remoteFieldNames: string[];
    messageFromPayload: (
      payload: CollaborationErrorPayload<TRemote> | null,
      fallbackText: string,
      status: number
    ) => string;
  }
): Promise<string> {
  const { text, payload } = await readApiPayload<Record<string, unknown>>(response);
  const parsedPayload = parseCollaborationErrorPayload<TRemote>(payload, options.remoteFieldNames);
  return options.messageFromPayload(parsedPayload, text, response.status);
}

export function rethrowGeneratedCollaborationError<TRemote>(
  error: unknown,
  options: {
    remoteFieldNames: string[];
    messageFromPayload: (
      payload: CollaborationErrorPayload<TRemote> | null,
      fallbackText: string,
      status: number
    ) => string;
  }
): never {
  const parsedPayload = parseCollaborationErrorPayload<TRemote>(error, options.remoteFieldNames);
  const status =
    typeof (error as { status?: unknown } | null)?.status === 'number'
      ? Number((error as { status?: number }).status)
      : 500;
  const fallbackText = error instanceof Error ? error.message : '';
  const message = options.messageFromPayload(parsedPayload, fallbackText, status);
  if (parsedPayload?.error === 'version_conflict') {
    throw new VersionConflictError<TRemote>(message, {
      version: parsedPayload.version,
      remote: parsedPayload.remote ?? null,
    });
  }
  throw new Error(message);
}
