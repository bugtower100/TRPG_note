import type { UserProfile } from '../types';
import { buildUserHeaders, parseJsonResponse } from './apiClient';

export interface AutomaticBackupSettings {
  enabled: boolean;
  intervalMinutes: number;
  retentionDays: number;
  maxBackups: number;
}

export interface AutomaticBackupFile {
  name: string;
  sizeBytes: number;
  createdAt: number;
}

export interface AutomaticBackupStatus {
  settings: AutomaticBackupSettings;
  backupDir: string;
  files: AutomaticBackupFile[];
  lastBackupAt?: number;
  nextBackupAt?: number;
  lastError?: string;
}

const request = async <T>(path: string, user: UserProfile, init?: RequestInit) => {
  const response = await fetch(path, {
    ...init,
    headers: {
      ...buildUserHeaders(user, { includeJson: Boolean(init?.body) }),
      ...(init?.headers || {}),
    },
  });
  return parseJsonResponse<T>(response, '自动备份请求失败');
};

export const automaticBackupService = {
  getStatus: (user: UserProfile) => request<AutomaticBackupStatus>('/api/backups/automatic', user),
  updateSettings: (user: UserProfile, settings: AutomaticBackupSettings) =>
    request<AutomaticBackupStatus>('/api/backups/automatic/settings', user, {
      method: 'PUT',
      body: JSON.stringify(settings),
    }),
  runNow: (user: UserProfile) =>
    request<AutomaticBackupFile>('/api/backups/automatic/run', user, { method: 'POST' }),
};
