import React, { useCallback, useEffect, useState } from 'react';
import type { UserProfile } from '../../types';
import {
  automaticBackupService,
  type AutomaticBackupSettings,
  type AutomaticBackupStatus,
} from '../../services/automaticBackupService';

interface AutomaticBackupSettingsDialogProps {
  open: boolean;
  user: UserProfile;
  onClose: () => void;
}

const formatTime = (value?: number) => value ? new Date(value).toLocaleString() : '尚无';

const AutomaticBackupSettingsDialog: React.FC<AutomaticBackupSettingsDialogProps> = ({ open, user, onClose }) => {
  const [status, setStatus] = useState<AutomaticBackupStatus | null>(null);
  const [draft, setDraft] = useState<AutomaticBackupSettings | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const loadStatus = useCallback(async () => {
    setBusy(true);
    setError('');
    try {
      const next = await automaticBackupService.getStatus(user);
      setStatus(next);
      setDraft(next.settings);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '读取自动备份设置失败');
    } finally {
      setBusy(false);
    }
  }, [user]);

  useEffect(() => {
    if (open) void loadStatus();
  }, [loadStatus, open]);

  if (!open) return null;

  const updateNumber = (key: 'intervalMinutes' | 'retentionDays' | 'maxBackups', value: string) => {
    const parsed = Number.parseInt(value, 10);
    setDraft((current) => current ? { ...current, [key]: Number.isFinite(parsed) ? parsed : 0 } : current);
  };

  const save = async () => {
    if (!draft) return;
    setBusy(true);
    setError('');
    try {
      const next = await automaticBackupService.updateSettings(user, draft);
      setStatus(next);
      setDraft(next.settings);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '保存自动备份设置失败');
    } finally {
      setBusy(false);
    }
  };

  const runNow = async () => {
    setBusy(true);
    setError('');
    try {
      await automaticBackupService.runNow(user);
      const next = await automaticBackupService.getStatus(user);
      setStatus(next);
      setDraft(next.settings);
    } catch (backupError) {
      setError(backupError instanceof Error ? backupError.message : '立即备份失败');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label="自动备份设置">
      <div className="theme-card max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-lg border border-theme p-6 shadow-xl">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold">自动备份</h2>
            <p className="mt-1 text-sm theme-text-secondary">数据库级一致性快照；默认开启。保留天数和最大数量会同时生效。</p>
          </div>
          <button type="button" onClick={onClose} className="rounded px-2 py-1 theme-text-secondary hover:bg-primary-light">关闭</button>
        </div>

        {draft ? (
          <div className="space-y-4">
            <label className="flex items-center justify-between gap-3 rounded border border-theme p-3">
              <span>
                <span className="block font-medium">启用自动备份</span>
                <span className="block text-xs theme-text-secondary">关闭后仍可手动“立即备份”。</span>
              </span>
              <input type="checkbox" checked={draft.enabled} onChange={(event) => setDraft({ ...draft, enabled: event.target.checked })} />
            </label>

            <div className="grid gap-3 sm:grid-cols-3">
              <label className="text-sm">
                <span className="mb-1 block">备份周期（分钟）</span>
                <input type="number" min={1} max={43200} value={draft.intervalMinutes} onChange={(event) => updateNumber('intervalMinutes', event.target.value)} className="w-full rounded border border-theme bg-transparent px-3 py-2" />
              </label>
              <label className="text-sm">
                <span className="mb-1 block">保留天数</span>
                <input type="number" min={0} max={3650} value={draft.retentionDays} onChange={(event) => updateNumber('retentionDays', event.target.value)} className="w-full rounded border border-theme bg-transparent px-3 py-2" />
              </label>
              <label className="text-sm">
                <span className="mb-1 block">最多保留</span>
                <input type="number" min={0} max={1000} value={draft.maxBackups} onChange={(event) => updateNumber('maxBackups', event.target.value)} className="w-full rounded border border-theme bg-transparent px-3 py-2" />
              </label>
            </div>
            <p className="text-xs theme-text-secondary">天数或数量填 0 表示不使用该项限制，但两项不能同时为 0。</p>

            <div className="rounded border border-theme p-3 text-sm">
              <div>最近备份：{formatTime(status?.lastBackupAt)}</div>
              <div>下次备份：{draft.enabled ? formatTime(status?.nextBackupAt) : '已关闭'}</div>
              <div className="break-all">目录：{status?.backupDir || '读取中'}</div>
              <div>当前保留：{status?.files.length || 0} 个</div>
              {status?.lastError ? <div className="mt-2 text-red-600">最近错误：{status.lastError}</div> : null}
            </div>

            {status?.files.length ? (
              <div className="max-h-36 space-y-1 overflow-y-auto rounded border border-theme p-2 text-xs">
                {status.files.map((file) => <div key={file.name} className="flex justify-between gap-3"><span>{file.name}</span><span className="shrink-0 theme-text-secondary">{(file.sizeBytes / 1024).toFixed(1)} KB</span></div>)}
              </div>
            ) : null}
          </div>
        ) : null}

        {error ? <div className="mt-4 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
        <div className="mt-5 flex justify-end gap-3">
          <button type="button" disabled={busy} onClick={() => void runNow()} className="rounded border border-theme px-4 py-2 text-sm hover:bg-primary-light disabled:opacity-50">立即备份</button>
          <button type="button" disabled={busy || !draft} onClick={() => void save()} className="rounded bg-primary px-4 py-2 text-sm text-white hover:bg-primary-dark disabled:opacity-50">{busy ? '处理中...' : '保存设置'}</button>
        </div>
      </div>
    </div>
  );
};

export default AutomaticBackupSettingsDialog;
