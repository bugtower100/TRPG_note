import React from 'react';
import { MigrationStatus } from '../../services/migrationService';

interface MigrationStatusScreenProps {
  status?: MigrationStatus | null;
  loading: boolean;
  error?: string | null;
  onRetry: () => void;
  onStartMigration: () => void;
  actionLoading: boolean;
  actionMessage?: string | null;
  backupPath?: string | null;
}

const formatTime = (timestamp?: number) => {
  if (!timestamp) return '暂无';
  return new Date(timestamp).toLocaleString();
};

const MigrationStatusScreen: React.FC<MigrationStatusScreenProps> = ({
  status,
  loading,
  error,
  onRetry,
  onStartMigration,
  actionLoading,
  actionMessage,
  backupPath,
}) => {
  const canStartMigration =
    !!status &&
    !loading &&
    !actionLoading &&
    (status.state === 'required' || status.state === 'failed');

  return (
    <div className="min-h-screen theme-page flex items-center justify-center p-6">
      <div className="w-full max-w-2xl theme-card border rounded-xl shadow-lg p-6 sm:p-8">
        <div className="text-2xl font-semibold mb-2">数据库迁移检查</div>
        <div className="theme-text-secondary text-sm mb-6">
          当前版本启动前会先检查数据库是否满足要求。未通过检查时，不会进入主界面。
        </div>

        {loading ? (
          <div className="rounded-lg border border-theme px-4 py-5 text-sm theme-text-secondary">
            正在检查数据库迁移状态...
          </div>
        ) : (
          <div className="space-y-4">
            {error && (
              <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {actionMessage && (
              <div className="rounded-lg border border-blue-300 bg-blue-50 px-4 py-3 text-sm text-blue-700">
                {actionMessage}
              </div>
            )}

            {status && (
              <div className="rounded-lg border border-theme p-4 space-y-3 text-sm">
                <div className="flex justify-between gap-4">
                  <span className="theme-text-secondary">当前数据库版本</span>
                  <span>{status.currentSchemaVersion}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="theme-text-secondary">目标数据库版本</span>
                  <span>{status.targetSchemaVersion}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="theme-text-secondary">当前状态</span>
                  <span>{status.state}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="theme-text-secondary">是否允许进入应用</span>
                  <span>{status.canEnterApp ? '允许' : '不允许'}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="theme-text-secondary">最近开始迁移时间</span>
                  <span>{formatTime(status.lastStartedAt)}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="theme-text-secondary">最近完成迁移时间</span>
                  <span>{formatTime(status.lastFinishedAt)}</span>
                </div>
                <div className="pt-2 border-t border-theme">
                  <div className="theme-text-secondary mb-1">状态说明</div>
                  <div>{status.message}</div>
                </div>
                {status.lastError && (
                  <div className="rounded border border-red-300 bg-red-50 px-3 py-2 text-red-700">
                    最近错误：{status.lastError}
                  </div>
                )}
                {backupPath && (
                  <div className="rounded border border-blue-300 bg-blue-50 px-3 py-2 text-blue-700 break-all">
                    最近备份：{backupPath}
                  </div>
                )}
              </div>
            )}

            {!status && !error && (
              <div className="rounded-lg border border-theme px-4 py-5 text-sm theme-text-secondary">
                当前未获取到迁移状态，请重试检查。
              </div>
            )}
          </div>
        )}

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={onStartMigration}
            disabled={!canStartMigration}
            className="px-4 py-2 rounded bg-primary text-white hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {actionLoading ? '迁移执行中...' : '开始迁移'}
          </button>
          <button
            type="button"
            onClick={onRetry}
            className="px-4 py-2 rounded border border-theme hover:bg-primary-light transition"
          >
            重试检查
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="px-4 py-2 rounded border border-theme hover:bg-primary-light transition"
          >
            刷新页面
          </button>
        </div>
      </div>
    </div>
  );
};

export default MigrationStatusScreen;
