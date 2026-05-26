import {
  getMigrationStatus as getGeneratedMigrationStatus,
  startMigration as startGeneratedMigration,
} from '../generated/api';
import { getGeneratedApiClient } from './generatedApiClient';

export interface MigrationStatus {
  currentSchemaVersion: number;
  targetSchemaVersion: number;
  state: 'ready' | 'required' | 'running' | 'failed' | 'blocked';
  requiresMigration: boolean;
  canEnterApp: boolean;
  message: string;
  lastError?: string;
  lastStartedAt?: number;
  lastFinishedAt?: number;
}

export interface StartMigrationResult {
  started: boolean;
  backupPath?: string;
  message: string;
  status: MigrationStatus;
}

const validateMigrationStatus = (input: unknown): MigrationStatus => {
  const raw = input as Record<string, unknown>;
  return {
    currentSchemaVersion: Number(raw.currentSchemaVersion ?? 0),
    targetSchemaVersion: Number(raw.targetSchemaVersion ?? 0),
    state: (raw.state as MigrationStatus['state']) || 'blocked',
    requiresMigration: Boolean(raw.requiresMigration),
    canEnterApp: Boolean(raw.canEnterApp),
    message: typeof raw.message === 'string' ? raw.message : '无法确认数据库迁移状态。',
    lastError: typeof raw.lastError === 'string' ? raw.lastError : undefined,
    lastStartedAt: typeof raw.lastStartedAt === 'number' ? raw.lastStartedAt : undefined,
    lastFinishedAt: typeof raw.lastFinishedAt === 'number' ? raw.lastFinishedAt : undefined,
  };
};

const unwrapGeneratedResponse = <T>(result: { data?: T; error?: unknown }): T => {
  if (result.error) {
    throw result.error;
  }
  return result.data as T;
};

export const migrationService = {
  async getStatus(): Promise<MigrationStatus> {
    try {
      const payload = unwrapGeneratedResponse(await getGeneratedMigrationStatus({
        client: getGeneratedApiClient(),
      }));
      return validateMigrationStatus(payload);
    } catch {
      throw new Error('无法获取数据库迁移状态，请检查后端是否正常启动。');
    }
  },

  async startMigration(): Promise<StartMigrationResult> {
    try {
      const payload = unwrapGeneratedResponse(await startGeneratedMigration({
        client: getGeneratedApiClient(),
      }));
      return {
        started: Boolean(payload?.started),
        backupPath: typeof payload?.backupPath === 'string' ? payload.backupPath : undefined,
        message: typeof payload?.message === 'string' ? payload.message : '数据库迁移已执行。',
        status: validateMigrationStatus(payload?.status ?? {}),
      };
    } catch (error) {
      const payload = error as Record<string, unknown> | null;
      const message =
        payload && typeof payload.error === 'string'
          ? payload.error
          : '数据库迁移启动失败，请稍后重试。';
      throw new Error(message);
    }
  },
};
