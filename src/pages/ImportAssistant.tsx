import React, { useMemo, useRef, useState } from 'react';
import { useCampaignData, useCampaignSession } from '../context/CampaignContext';
import { CampaignData } from '../types';
import { dataService } from '../services/dataService';
import { backupService, type BackupImportMode, type BackupPreviewResult } from '../services/backupService';

type CollectionKey =
  | 'characters'
  | 'monsters'
  | 'locations'
  | 'organizations'
  | 'events'
  | 'clues'
  | 'timelines'
  | 'sessionTasks'
  | 'relationGraphs';

type MappingTarget = CollectionKey | 'skip';
type MergeMode = 'append' | 'replace';

type ImportJob = {
  id: string;
  fileName: string;
  startedAt: number;
  finishedAt?: number;
  status: 'running' | 'success' | 'failed';
  message: string;
};

const collectionOrder: CollectionKey[] = [
  'characters',
  'monsters',
  'locations',
  'organizations',
  'events',
  'clues',
  'timelines',
  'sessionTasks',
  'relationGraphs',
];

const collectionLabel: Record<CollectionKey, string> = {
  characters: '角色',
  monsters: '怪物',
  locations: '地点',
  organizations: '组织',
  events: '事件',
  clues: '线索',
  timelines: '时间线',
  sessionTasks: '任务看板',
  relationGraphs: '关系图',
};

const createDefaultMapping = (): Record<CollectionKey, MappingTarget> =>
  collectionOrder.reduce((acc, key) => {
    acc[key] = key;
    return acc;
  }, {} as Record<CollectionKey, MappingTarget>);

interface ImportAssistantProps {
  allowLegacyJsonImport?: boolean;
}

const ImportAssistant: React.FC<ImportAssistantProps> = ({ allowLegacyJsonImport = true }) => {
  const { campaignData, setCampaignData } = useCampaignData();
  const { user, currentCampaignId, reloadCampaignList, reloadCurrentCampaign } = useCampaignSession();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [sourceData, setSourceData] = useState<CampaignData | null>(null);
  const [sourceFileName, setSourceFileName] = useState('');
  const [selectedBundleFile, setSelectedBundleFile] = useState<File | null>(null);
  const [bundlePreview, setBundlePreview] = useState<BackupPreviewResult | null>(null);
  const [mapping, setMapping] = useState<Record<CollectionKey, MappingTarget>>(createDefaultMapping);
  const [mergeMode, setMergeMode] = useState<MergeMode>('append');
  const [bundleImportMode, setBundleImportMode] = useState<BackupImportMode>('add');
  const [jobs, setJobs] = useState<ImportJob[]>([]);
  const [busy, setBusy] = useState(false);
  const [needsReload, setNeedsReload] = useState(false);

  const sourceCounts = useMemo(() => {
    if (!sourceData) return null;
    return collectionOrder.reduce((acc, key) => {
      const value = sourceData[key];
      acc[key] = Array.isArray(value) ? value.length : 0;
      return acc;
    }, {} as Record<CollectionKey, number>);
  }, [sourceData]);

  const mappedIncomingCounts = useMemo(() => {
    if (!sourceCounts) return null;
    const counts = collectionOrder.reduce((acc, key) => {
      acc[key] = 0;
      return acc;
    }, {} as Record<CollectionKey, number>);
    collectionOrder.forEach((sourceKey) => {
      const target = mapping[sourceKey];
      if (target !== 'skip') {
        counts[target] += sourceCounts[sourceKey];
      }
    });
    return counts;
  }, [mapping, sourceCounts]);

  const bundleActionSummary = useMemo(() => {
    if (!bundlePreview) return null;
    let addCount = 0;
    let overwriteCount = 0;
    let skipCount = 0;
    bundlePreview.campaigns.forEach((item) => {
      if (bundleImportMode === 'overwrite' && item.matchedCampaignId) {
        overwriteCount += 1;
      } else if (bundleImportMode === 'overwrite') {
        skipCount += 1;
      } else {
        addCount += 1;
      }
    });
    return { addCount, overwriteCount, skipCount };
  }, [bundleImportMode, bundlePreview]);

  const handlePickFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      if (backupService.isBundleFile(file)) {
        const preview = await backupService.previewBundle(file, user);
        setSelectedBundleFile(file);
        setBundlePreview(preview);
        setSourceData(null);
        setSourceFileName('');
      } else if (!allowLegacyJsonImport) {
        window.alert('主页导入助手仅支持新版备份包。旧版 JSON 兼容导入请先进入任意模组，再到设置页使用。');
        setSourceData(null);
        setSourceFileName('');
        setSelectedBundleFile(null);
        setBundlePreview(null);
      } else {
        const parsed = await dataService.importData(file);
        setSourceData(parsed);
        setSourceFileName(file.name);
        setMapping(createDefaultMapping());
        setSelectedBundleFile(null);
        setBundlePreview(null);
      }
    } catch {
      window.alert('读取导入文件失败，请确认文件格式正确。');
      setSourceData(null);
      setSourceFileName('');
      setSelectedBundleFile(null);
      setBundlePreview(null);
    } finally {
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const buildImportedCollections = (data: CampaignData) => {
    const result = collectionOrder.reduce((acc, key) => {
      acc[key] = [] as any[];
      return acc;
    }, {} as Record<CollectionKey, any[]>);
    collectionOrder.forEach((sourceKey) => {
      const target = mapping[sourceKey];
      if (target === 'skip') return;
      const sourceList = Array.isArray(data[sourceKey]) ? data[sourceKey] : [];
      result[target] = [...result[target], ...sourceList];
    });
    return result;
  };

  const appendWithIdGuard = (currentList: any[], incomingList: any[]) => {
    const usedIds = new Set(currentList.map((item: any) => item.id));
    const now = Date.now();
    const normalizedIncoming = incomingList.map((item: any) => {
      if (!item?.id || usedIds.has(item.id)) {
        const nextId = dataService.generateId();
        usedIds.add(nextId);
        return { ...item, id: nextId, createdAt: item?.createdAt || now, updatedAt: now };
      }
      usedIds.add(item.id);
      return item;
    });
    return [...currentList, ...normalizedIncoming];
  };

  const executeImport = async () => {
    if (!sourceData) {
      window.alert('请先选择导入文件。');
      return;
    }
    const jobId = dataService.generateId();
    const startedAt = Date.now();
    setJobs((prev) => [
      {
        id: jobId,
        fileName: sourceFileName || '未命名文件',
        startedAt,
        status: 'running',
        message: '正在执行导入...',
      },
      ...prev,
    ]);
    setBusy(true);
    try {
      const importedCollections = buildImportedCollections(sourceData);
      const nextData: CampaignData = {
        ...campaignData,
        meta: {
          ...campaignData.meta,
          lastModified: Date.now(),
        },
      };
      collectionOrder.forEach((key) => {
        const incoming = importedCollections[key];
        const current = Array.isArray(campaignData[key]) ? campaignData[key] : [];
        nextData[key] = mergeMode === 'replace' ? incoming : appendWithIdGuard(current, incoming);
      });
      setCampaignData(nextData);
      setJobs((prev) =>
        prev.map((job) =>
          job.id === jobId
            ? {
                ...job,
                status: 'success',
                finishedAt: Date.now(),
                message: `导入完成（模式：${mergeMode === 'append' ? '追加' : '覆盖'}）。`,
              }
            : job
        )
      );
    } catch (error) {
      setJobs((prev) =>
        prev.map((job) =>
          job.id === jobId
            ? {
                ...job,
                status: 'failed',
                finishedAt: Date.now(),
                message: error instanceof Error ? error.message : '导入失败',
              }
            : job
        )
      );
    } finally {
      setBusy(false);
    }
  };

  const executeBundleImport = async () => {
    if (!selectedBundleFile) {
      window.alert('请先选择备份包。');
      return;
    }
    const jobId = dataService.generateId();
    const startedAt = Date.now();
    setJobs((prev) => [
      {
        id: jobId,
        fileName: selectedBundleFile.name,
        startedAt,
        status: 'running',
        message: `正在执行${bundleImportMode === 'overwrite' ? '覆盖' : '添加'}导入...`,
      },
      ...prev,
    ]);
    setBusy(true);
    try {
      const result = await backupService.importBundle(selectedBundleFile, user, bundleImportMode);
      let reloadHint = '';
      try {
        await reloadCampaignList();
        if (currentCampaignId && result.campaigns.some((item) => item.id === currentCampaignId)) {
          await reloadCurrentCampaign();
        }
        setNeedsReload(false);
      } catch {
        setNeedsReload(true);
        reloadHint = ' 模组已导入，但当前页面未能自动同步，请手动刷新查看最新内容。';
      }
      setJobs((prev) =>
        prev.map((job) =>
          job.id === jobId
            ? {
                ...job,
                status: 'success',
                finishedAt: Date.now(),
                message:
                  result.missingAssetCount && result.missingAssetCount > 0
                    ? `导入完成：新增 ${result.addedCount} 个，覆盖 ${result.overwrittenCount} 个，跳过 ${result.skippedCount || 0} 个，另有 ${result.missingAssetCount} 个缺失资源已跳过。${reloadHint}`
                    : `导入完成：新增 ${result.addedCount} 个，覆盖 ${result.overwrittenCount} 个，跳过 ${result.skippedCount || 0} 个。${reloadHint}`,
              }
            : job
        )
      );
    } catch (error) {
      setJobs((prev) =>
        prev.map((job) =>
          job.id === jobId
            ? {
                ...job,
                status: 'failed',
                finishedAt: Date.now(),
                message: error instanceof Error ? error.message : '导入失败',
              }
            : job
        )
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h2 className="text-2xl font-bold">导入助手</h2>
        <p className="text-sm theme-text-secondary mt-1">
          {allowLegacyJsonImport
            ? '这里统一处理新版备份包和旧版 JSON 存档导入，可先预览再执行，并记录作业状态。'
            : '这里可直接从主页导入新版备份包。旧版 JSON 兼容导入仍需先进入任意模组，再到设置页使用。'}
        </p>
      </div>

      <section className="bg-theme-card border border-theme rounded-lg p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <input
            type="file"
            accept={allowLegacyJsonImport ? '.zip,.trpgzip,.json' : '.zip,.trpgzip'}
            ref={fileInputRef}
            onChange={handlePickFile}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-3 py-2 border border-theme rounded hover:bg-primary-light"
            disabled={busy}
          >
            选择导入文件
          </button>
          <span className="text-sm theme-text-secondary">
            {selectedBundleFile ? `当前备份包：${selectedBundleFile.name}` : sourceFileName ? `当前 JSON：${sourceFileName}` : '尚未选择文件'}
          </span>
        </div>
        {needsReload && (
          <div className="flex flex-wrap items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded px-3 py-2">
            <span>导入已经完成，但列表尚未自动同步。请刷新页面后查看最新模组列表。</span>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-2 py-1 rounded border border-green-300 hover:bg-green-100"
            >
              立即刷新
            </button>
          </div>
        )}
      </section>

      <section className="bg-theme-card border border-theme rounded-lg p-4">
        <h3 className="font-semibold mb-3">新版备份包导入</h3>
        {!bundlePreview ? (
          <div className="text-sm theme-text-secondary">选择 `.zip` / `.trpgzip` 备份包后，这里会显示预览、模式选择和执行结果。</div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-sm">
              <div className="border border-theme rounded p-3">
                <div className="theme-text-secondary text-xs">来源文件</div>
                <div className="mt-1 break-all">{bundlePreview.fileName}</div>
              </div>
              <div className="border border-theme rounded p-3">
                <div className="theme-text-secondary text-xs">备份类型</div>
                <div className="mt-1">{bundlePreview.manifest.exportType === 'all' ? '所有模组备份' : '单模组备份'}</div>
              </div>
              <div className="border border-theme rounded p-3">
                <div className="theme-text-secondary text-xs">模组数量</div>
                <div className="mt-1">{bundlePreview.manifest.campaignCount}</div>
              </div>
              <div className="border border-theme rounded p-3">
                <div className="theme-text-secondary text-xs">导出时间</div>
                <div className="mt-1">{new Date(bundlePreview.manifest.exportedAt).toLocaleString()}</div>
              </div>
            </div>

            {!bundlePreview.manifest.containsAssets && (
              <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                这个备份包未包含图片资源。导入后文字数据会正常恢复，但图片不会随包导入；若原设备上的图片文件已经丢失，则相关图片需要用户后续重新上传。
              </div>
            )}

            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 border border-theme rounded p-3">
              <div className="space-y-1">
                <div className="text-sm font-medium">导入模式</div>
                <div className="text-xs theme-text-secondary">“添加导入”会全部作为新模组导入；“覆盖导入”只覆盖已匹配的模组，未匹配项会跳过，不会新增。</div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={bundleImportMode}
                  onChange={(event) => setBundleImportMode(event.target.value as BackupImportMode)}
                  className="px-3 py-2 border border-theme rounded bg-transparent text-sm"
                >
                  <option value="add">添加导入</option>
                  <option value="overwrite">覆盖导入</option>
                </select>
                <button
                  type="button"
                  onClick={executeBundleImport}
                  disabled={!selectedBundleFile || busy}
                  className="px-3 py-2 bg-primary text-white rounded hover:bg-primary-dark disabled:opacity-50"
                >
                  执行备份导入
                </button>
              </div>
            </div>

            {bundleActionSummary && (
              <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                本次预计新增 {bundleActionSummary.addCount} 个模组，覆盖 {bundleActionSummary.overwriteCount} 个模组，跳过 {bundleActionSummary.skipCount} 个未匹配模组。
              </div>
            )}

            <div className="space-y-3">
              {bundlePreview.campaigns.map((item) => {
                const willOverwrite = bundleImportMode === 'overwrite' && Boolean(item.matchedCampaignId);
                const willSkip = bundleImportMode === 'overwrite' && !item.matchedCampaignId;
                return (
                  <div key={`${item.originalCampaignId}-${item.name}`} className="border border-theme rounded p-4">
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                      <div>
                        <div className="font-medium">{item.name}</div>
                        <div className="text-sm theme-text-secondary mt-1">{item.description || '暂无描述'}</div>
                        <div className="text-xs theme-text-secondary mt-2 break-all">原始模组 ID：{item.originalCampaignId}</div>
                      </div>
                      <div className={`text-xs px-2 py-1 rounded border ${
                        willOverwrite
                          ? 'border-amber-300 text-amber-700 bg-amber-50'
                          : willSkip
                            ? 'border-slate-300 text-slate-700 bg-slate-50'
                            : 'border-blue-300 text-blue-700 bg-blue-50'
                      }`}>
                        {willOverwrite
                          ? `将覆盖：${item.matchedCampaignName || item.matchedCampaignId}`
                          : willSkip
                            ? '未匹配到现有模组，将跳过'
                            : '将新增为新模组'}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-2 mt-3 text-xs">
                      <div className="border border-theme rounded px-2 py-2">角色 {item.collectionCounts.characters || 0}</div>
                      <div className="border border-theme rounded px-2 py-2">怪物 {item.collectionCounts.monsters || 0}</div>
                      <div className="border border-theme rounded px-2 py-2">地点 {item.collectionCounts.locations || 0}</div>
                      <div className="border border-theme rounded px-2 py-2">组织 {item.collectionCounts.organizations || 0}</div>
                      <div className="border border-theme rounded px-2 py-2">事件 {item.collectionCounts.events || 0}</div>
                      <div className="border border-theme rounded px-2 py-2">线索 {item.collectionCounts.clues || 0}</div>
                      <div className="border border-theme rounded px-2 py-2">时间线 {item.collectionCounts.timelines || 0}</div>
                      <div className="border border-theme rounded px-2 py-2">任务 {item.taskCount || 0}</div>
                      <div className="border border-theme rounded px-2 py-2">关系图 {item.collectionCounts.relationGraphs || 0}</div>
                      <div className="border border-theme rounded px-2 py-2">团队笔记 {item.teamNoteCount}</div>
                      <div className="border border-theme rounded px-2 py-2">图片资源 {item.assetCount}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {allowLegacyJsonImport && (
        <section className="bg-theme-card border border-theme rounded-lg p-4">
          <h3 className="font-semibold mb-3">旧版 JSON 兼容导入</h3>
          {!sourceData || !sourceCounts || !mappedIncomingCounts ? (
            <div className="text-sm theme-text-secondary">选择旧版 `.json` 存档后，这里会显示映射预览。新版备份包请使用上面的导入区。</div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <label className="text-sm theme-text-secondary">执行模式</label>
                <select
                  value={mergeMode}
                  onChange={(event) => setMergeMode(event.target.value as MergeMode)}
                  className="px-3 py-2 border border-theme rounded bg-transparent text-sm"
                >
                  <option value="append">追加导入（保留现有数据）</option>
                  <option value="replace">覆盖导入（按映射覆盖目标集合）</option>
                </select>
                <button
                  type="button"
                  onClick={executeImport}
                  disabled={!sourceData || busy}
                  className="px-3 py-2 bg-primary text-white rounded hover:bg-primary-dark disabled:opacity-50"
                >
                  执行 JSON 导入
                </button>
              </div>
              <div className="overflow-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-theme">
                      <th className="text-left py-2 pr-2">来源集合</th>
                      <th className="text-left py-2 pr-2">条目数</th>
                      <th className="text-left py-2 pr-2">映射到</th>
                      <th className="text-left py-2">目标将新增</th>
                    </tr>
                  </thead>
                  <tbody>
                    {collectionOrder.map((sourceKey) => {
                      const target = mapping[sourceKey];
                      const incoming = sourceCounts[sourceKey];
                      const currentTargetCount =
                        target === 'skip' ? 0 : mappedIncomingCounts[target];
                      return (
                        <tr key={sourceKey} className="border-b border-theme/60">
                          <td className="py-2 pr-2">{collectionLabel[sourceKey]}</td>
                          <td className="py-2 pr-2">{incoming}</td>
                          <td className="py-2 pr-2">
                            <select
                              value={target}
                              onChange={(event) =>
                                setMapping((prev) => ({
                                  ...prev,
                                  [sourceKey]: event.target.value as MappingTarget,
                                }))
                              }
                              className="px-2 py-1 border border-theme rounded bg-transparent"
                            >
                              {collectionOrder.map((optionKey) => (
                                <option key={optionKey} value={optionKey}>
                                  {collectionLabel[optionKey]}
                                </option>
                              ))}
                              <option value="skip">跳过</option>
                            </select>
                          </td>
                          <td className="py-2">
                            {target === 'skip' ? '0（跳过）' : `${currentTargetCount}`}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      )}

      <section className="bg-theme-card border border-theme rounded-lg p-4">
        <h3 className="font-semibold mb-3">作业状态</h3>
        {jobs.length === 0 ? (
          <div className="text-sm theme-text-secondary">暂无导入作业。</div>
        ) : (
          <div className="space-y-2">
            {jobs.map((job) => (
              <div key={job.id} className="border border-theme rounded px-3 py-2 text-sm">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                  <div className="font-medium">{job.fileName}</div>
                  <div
                    className={`text-xs ${
                      job.status === 'success'
                        ? 'text-green-600'
                        : job.status === 'failed'
                          ? 'text-red-600'
                          : 'theme-text-secondary'
                    }`}
                  >
                    {job.status === 'running' ? '运行中' : job.status === 'success' ? '成功' : '失败'}
                  </div>
                </div>
                <div className="theme-text-secondary text-xs mt-1">
                  开始：{new Date(job.startedAt).toLocaleString()}
                  {job.finishedAt ? ` · 结束：${new Date(job.finishedAt).toLocaleString()}` : ''}
                </div>
                <div className="mt-1">{job.message}</div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default ImportAssistant;
