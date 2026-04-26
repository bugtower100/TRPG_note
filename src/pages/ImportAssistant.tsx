import React, { useMemo, useRef, useState } from 'react';
import { useCampaign } from '../context/CampaignContext';
import { CampaignData } from '../types';
import { dataService } from '../services/dataService';

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

const ImportAssistant: React.FC = () => {
  const { campaignData, setCampaignData } = useCampaign();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [sourceData, setSourceData] = useState<CampaignData | null>(null);
  const [sourceFileName, setSourceFileName] = useState('');
  const [mapping, setMapping] = useState<Record<CollectionKey, MappingTarget>>(createDefaultMapping);
  const [mergeMode, setMergeMode] = useState<MergeMode>('append');
  const [jobs, setJobs] = useState<ImportJob[]>([]);
  const [busy, setBusy] = useState(false);

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

  const handlePickFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const parsed = await dataService.importData(file);
      setSourceData(parsed);
      setSourceFileName(file.name);
      setMapping(createDefaultMapping());
    } catch {
      window.alert('读取导入文件失败，请确认 JSON 格式正确。');
      setSourceData(null);
      setSourceFileName('');
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

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h2 className="text-2xl font-bold">导入助手</h2>
        <p className="text-sm theme-text-secondary mt-1">预览导入内容，配置映射后执行导入，并记录作业状态。</p>
      </div>

      <section className="bg-theme-card border border-theme rounded-lg p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <input
            type="file"
            accept=".json"
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
            {sourceFileName ? `当前文件：${sourceFileName}` : '尚未选择文件'}
          </span>
        </div>
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
            执行导入
          </button>
        </div>
      </section>

      <section className="bg-theme-card border border-theme rounded-lg p-4">
        <h3 className="font-semibold mb-3">预览映射</h3>
        {!sourceData || !sourceCounts || !mappedIncomingCounts ? (
          <div className="text-sm theme-text-secondary">请选择导入文件后查看映射预览。</div>
        ) : (
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
        )}
      </section>

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
