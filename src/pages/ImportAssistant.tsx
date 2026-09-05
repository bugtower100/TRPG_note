import React, { useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useCampaignSession } from '../context/CampaignContext';
import { backupService, type BackupImportMode, type BackupPreviewResult } from '../services/backupService';

type ImportJob = { id: string; fileName: string; status: 'running' | 'success' | 'failed'; message: string };

const ImportAssistant: React.FC = () => {
  const { user, currentCampaignId, reloadCampaignList, reloadCurrentCampaign } = useCampaignSession();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<BackupPreviewResult | null>(null);
  const [mode, setMode] = useState<BackupImportMode>('add');
  const [jobs, setJobs] = useState<ImportJob[]>([]);
  const [busy, setBusy] = useState(false);

  const actionSummary = useMemo(() => {
    if (!preview || preview.packageType === 'selective') return null;
    return preview.campaigns.reduce((result, item) => {
      if (mode === 'overwrite' && item.matchedCampaignId) result.overwrite += 1;
      else if (mode === 'overwrite') result.skip += 1;
      else result.add += 1;
      return result;
    }, { add: 0, overwrite: 0, skip: 0 });
  }, [mode, preview]);

  const handlePickFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!backupService.isBundleFile(file)) {
      window.alert('仅支持新版 `.zip` / `.trpgzip` 备份包；');
      event.target.value = '';
      return;
    }
    setBusy(true);
    try {
      setPreview(await backupService.previewBundle(file, user));
      setSelectedFile(file);
    } catch (error) {
      setPreview(null);
      setSelectedFile(null);
      window.alert(error instanceof Error ? error.message : '备份包预览失败。');
    } finally { setBusy(false); }
  };

  const executeImport = async () => {
    if (!selectedFile) return;
    const jobId = crypto.randomUUID();
    setJobs((current) => [{ id: jobId, fileName: selectedFile.name, status: 'running', message: '正在导入…' }, ...current]);
    setBusy(true);
    try {
      const result = await backupService.importBundle(selectedFile, user, mode, preview?.packageType === 'selective' ? currentCampaignId || undefined : undefined);
      if (result.packageType === 'selective') {
        if (currentCampaignId) {
          await reloadCurrentCampaign();
          await queryClient.invalidateQueries({ queryKey: ['campaigns', currentCampaignId] });
        } else {
          await reloadCampaignList();
        }
      } else {
        await reloadCampaignList();
        if (currentCampaignId && result.campaigns.some((item) => item.id === currentCampaignId)) await reloadCurrentCampaign();
      }
      setJobs((current) => current.map((job) => job.id === jobId ? {
        ...job,
        status: 'success',
        message: result.packageType === 'selective'
          ? result.campaigns[0]?.mode === 'added'
            ? `已新建模组“${result.campaigns[0].name}”并导入 ${result.importedCount} 个条目和 ${result.importedAssetCount || 0} 个资源${result.missingAssetCount ? `，缺失资源 ${result.missingAssetCount}` : ''}。`
            : `已向当前模组合并 ${result.importedCount} 个条目：新增 ${result.addedCount} 个，覆盖 ${result.overwrittenCount} 个；导入资源 ${result.importedAssetCount || 0} 个${result.missingAssetCount ? `，缺失资源 ${result.missingAssetCount}` : ''}。`
          : `完成：新增 ${result.addedCount}，覆盖 ${result.overwrittenCount}，跳过 ${result.skippedCount || 0}${result.missingAssetCount ? `，缺失资源 ${result.missingAssetCount}` : ''}。`,
      } : job));
    } catch (error) {
      setJobs((current) => current.map((job) => job.id === jobId ? {
        ...job,
        status: 'failed',
        message: error instanceof Error ? error.message : '备份导入失败。',
      } : job));
    } finally { setBusy(false); }
  };

  return (
    <div className="max-w-5xl space-y-5">
      <div><h2 className="text-2xl font-bold">导入助手</h2><p className="mt-1 text-sm theme-text-secondary">统一导入完整备份或选择性模组导出包。</p></div>
      <section className="space-y-3 rounded-lg border border-theme bg-theme-card p-4">
        <input ref={fileInputRef} type="file" accept=".zip,.trpgzip,application/zip" onChange={(event) => void handlePickFile(event)} className="hidden" />
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => fileInputRef.current?.click()} disabled={busy} className="rounded border border-theme px-3 py-2 hover:bg-primary-light disabled:opacity-50">选择 `.trpgzip` 导出包</button>
          <span className="text-sm theme-text-secondary">{selectedFile?.name || '尚未选择文件'}</span>
        </div>
      </section>
      {preview && <section className="space-y-4 rounded-lg border border-theme bg-theme-card p-4">
        <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
          <div className="rounded border border-theme p-3"><div className="text-xs theme-text-secondary">导出类型</div><div className="mt-1">{preview.packageType === 'selective' ? '选择性模组导出' : preview.manifest.exportType === 'all' ? '所有模组完整备份' : '单模组完整备份'}</div></div>
          <div className="rounded border border-theme p-3"><div className="text-xs theme-text-secondary">{preview.packageType === 'selective' ? '条目数量' : '模组数量'}</div><div className="mt-1">{preview.packageType === 'selective' ? Object.values(preview.campaigns[0]?.collectionCounts || {}).reduce((total, count) => total + count, 0) : preview.manifest.campaignCount}</div></div>
          <div className="rounded border border-theme p-3"><div className="text-xs theme-text-secondary">导出时间</div><div className="mt-1">{new Date(preview.manifest.exportedAt).toLocaleString()}</div></div>
        </div>
        {preview.packageType === 'selective' ? <div className="flex flex-col gap-3 rounded border border-theme p-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-medium">{currentCampaignId ? '合并到当前模组' : '新建模组并导入'}</div>
            <div className="text-xs theme-text-secondary">{currentCampaignId
              ? '新增会为条目名称添加“（导入新增）”；覆盖按同板块同名替换，未匹配条目仍作为新增导入。'
              : '将使用导出包名称创建一个新模组，并保留包内条目的原名称。'}</div>
          </div>
          <div className="flex gap-2">
            {currentCampaignId ? <select value={mode} onChange={(event) => setMode(event.target.value as BackupImportMode)} className="rounded border border-theme bg-transparent px-3 py-2 text-sm">
              <option value="add">全部新增</option>
              <option value="overwrite">覆盖同名，其余新增</option>
            </select> : null}
            <button type="button" onClick={() => void executeImport()} disabled={busy} className="rounded bg-primary px-3 py-2 text-sm text-white hover:bg-primary-dark disabled:opacity-50">{currentCampaignId ? '执行导入' : '新建并导入'}</button>
          </div>
        </div> : <div className="flex flex-col gap-3 rounded border border-theme p-3 sm:flex-row sm:items-center sm:justify-between">
          <div><div className="text-sm font-medium">导入方式</div><div className="text-xs theme-text-secondary">添加会创建新模组；覆盖只处理能匹配到的现有模组。</div></div>
          <div className="flex gap-2">
            <select value={mode} onChange={(event) => setMode(event.target.value as BackupImportMode)} className="rounded border border-theme bg-transparent px-3 py-2 text-sm"><option value="add">添加导入</option><option value="overwrite">覆盖导入</option></select>
            <button type="button" onClick={() => void executeImport()} disabled={busy} className="rounded bg-primary px-3 py-2 text-sm text-white hover:bg-primary-dark disabled:opacity-50">执行导入</button>
          </div>
        </div>}
        {actionSummary && <div className="text-sm theme-text-secondary">预计新增 {actionSummary.add} 个，覆盖 {actionSummary.overwrite} 个，跳过 {actionSummary.skip} 个。</div>}
        <div className="space-y-2">{preview.campaigns.map((campaign) => <div key={`${campaign.originalCampaignId}-${campaign.name}`} className="rounded border border-theme px-3 py-2">
          <div className="font-medium">{campaign.name}</div><div className="mt-1 text-xs theme-text-secondary">资料条目 {Object.values(campaign.collectionCounts).reduce((total, count) => total + count, 0)} · 图片资源 {campaign.assetCount}</div>
        </div>)}</div>
      </section>}
      <section className="rounded-lg border border-theme bg-theme-card p-4">
        <h3 className="mb-3 font-semibold">作业状态</h3>
        {jobs.length === 0 ? <div className="text-sm theme-text-secondary">暂无导入作业。</div> : <div className="space-y-2">{jobs.map((job) => <div key={job.id} className="rounded border border-theme px-3 py-2 text-sm">
          <div className="flex justify-between gap-3"><span className="font-medium">{job.fileName}</span><span className={job.status === 'failed' ? 'text-red-600' : job.status === 'success' ? 'text-green-600' : 'theme-text-secondary'}>{job.status === 'running' ? '运行中' : job.status === 'success' ? '成功' : '失败'}</span></div>
          <div className="mt-1">{job.message}</div>
        </div>)}</div>}
      </section>
    </div>
  );
};

export default ImportAssistant;
