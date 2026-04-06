import React, { useEffect, useMemo, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { useCampaign } from '../context/CampaignContext';
import { VersionRecord } from '../types';
import { sharingService } from '../services/sharingService';
import RichTextDisplay from '../components/common/RichTextDisplay';
import { useNavigate, useSearchParams } from 'react-router-dom';

type DiffRow = {
  keyPath: string;
  path: string;
  before: string;
  after: string;
  beforeRaw: unknown;
  afterRaw: unknown;
};

const labelMap: Record<string, string> = {
  id: 'ID',
  campaignId: '模组ID',
  documentType: '文档类型',
  documentId: '文档ID',
  action: '操作',
  summary: '摘要',
  operatorUserId: '操作人ID',
  operatorUsername: '操作人',
  createdAt: '创建时间',
  updatedAt: '更新时间',
  entityName: '名称',
  entityType: '实体类型',
  scope: '共享范围',
  permission: '权限',
  details: '概览内容',
  sectionItems: '区块条目',
  subItem: '共享条目',
  allSections: '全部区块',
  title: '标题',
  content: '正文',
  sourceOwnerUsername: '分享来源',
  targetUsername: '分享目标',
  version: '版本号',
};

const formatPathLabel = (path: string) => path
  .split('.')
  .map((part) => labelMap[part] || part.replace(/([A-Z])/g, ' $1'))
  .join(' / ');

const summarizeValue = (value: unknown): string => {
  if (value === null || value === undefined) return '空';
  if (typeof value === 'string') return value.trim() || '空字符串';
  if (typeof value === 'number') {
    if (String(value).length >= 12) {
      return new Date(value).toLocaleString();
    }
    return String(value);
  }
  if (typeof value === 'boolean') return value ? '是' : '否';
  if (Array.isArray(value)) {
    if (value.length === 0) return '空列表';
    const labels = value
      .map((item) => {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object') {
          const record = item as Record<string, unknown>;
          return String(record.title || record.name || record.key || record.id || '');
        }
        return '';
      })
      .filter(Boolean)
      .slice(0, 4);
    return `${value.length} 项${labels.length > 0 ? `：${labels.join('、')}` : ''}`;
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const label = record.title || record.name || record.entityName || record.username;
    if (typeof label === 'string' && label.trim()) return label;
    return `${Object.keys(record).length} 个字段`;
  }
  return String(value);
};

const flattenReadable = (value: unknown, prefix = ''): Record<string, string> => {
  if (value === null || value === undefined) {
    return prefix ? { [prefix]: summarizeValue(value) } : {};
  }
  if (Array.isArray(value) || typeof value !== 'object') {
    return prefix ? { [prefix]: summarizeValue(value) } : {};
  }
  const record = value as Record<string, unknown>;
  const entries = Object.entries(record);
  if (entries.length === 0) {
    return prefix ? { [prefix]: '空对象' } : {};
  }
  return entries.reduce<Record<string, string>>((acc, [key, nested]) => {
    const nextPrefix = prefix ? `${prefix}.${key}` : key;
    if (nested !== null && typeof nested === 'object' && !Array.isArray(nested)) {
      Object.assign(acc, flattenReadable(nested, nextPrefix));
    } else {
      acc[nextPrefix] = summarizeValue(nested);
    }
    return acc;
  }, {});
};

const buildDiffRows = (previousSnapshot: Record<string, unknown> | null | undefined, snapshot: Record<string, unknown>) => {
  const currentMap = flattenReadable(snapshot);
  const previousMap = flattenReadable(previousSnapshot || {});
  const keys = Array.from(new Set([...Object.keys(currentMap), ...Object.keys(previousMap)])).sort();
  return keys
    .filter((key) => currentMap[key] !== previousMap[key])
    .map<DiffRow>((key) => ({
      keyPath: key,
      path: formatPathLabel(key),
      before: previousMap[key] || '空',
      after: currentMap[key] || '空',
      beforeRaw: key.split('.').reduce<unknown>((acc, part) => (acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[part] : undefined), previousSnapshot || {}),
      afterRaw: key.split('.').reduce<unknown>((acc, part) => (acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[part] : undefined), snapshot),
    }));
};

const buildSummaryRows = (snapshot: Record<string, unknown>) => Object.entries(flattenReadable(snapshot))
  .map(([path, value]) => ({
    keyPath: path,
    path: formatPathLabel(path),
    value,
    raw: path.split('.').reduce<unknown>((acc, part) => (acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[part] : undefined), snapshot),
  }));

const VersionHistory: React.FC = () => {
  const { currentCampaignId, user } = useCampaign();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [versions, setVersions] = useState<VersionRecord[]>([]);
  const [selected, setSelected] = useState<VersionRecord | null>(null);
  const [statusText, setStatusText] = useState('');
  const filterDocumentType = searchParams.get('documentType');
  const filterDocumentId = searchParams.get('documentId');
  const diffRows = useMemo(() => selected ? buildDiffRows(selected.previousSnapshot, selected.snapshot) : [], [selected]);
  const summaryRows = useMemo(() => selected ? buildSummaryRows(selected.snapshot) : [], [selected]);

  const loadVersions = React.useCallback(async () => {
    if (!currentCampaignId || !user) return;
    const next = await sharingService.listVersions(currentCampaignId, user);
    setVersions(next);
  }, [currentCampaignId, user]);

  useEffect(() => {
    loadVersions().catch((error) => setStatusText(error instanceof Error ? error.message : '版本记录加载失败'));
  }, [loadVersions]);

  const visibleVersions = useMemo(() => versions.filter((version) => {
    if (filterDocumentType && version.documentType !== filterDocumentType) return false;
    if (filterDocumentId && version.documentId !== filterDocumentId) return false;
    return true;
  }), [filterDocumentId, filterDocumentType, versions]);

  useEffect(() => {
    setSelected((prev) => {
      if (prev && visibleVersions.some((item) => item.id === prev.id)) return prev;
      return visibleVersions[0] ?? null;
    });
  }, [visibleVersions]);

  const handleRestoreCopy = async () => {
    if (!currentCampaignId || !user || !selected) return;
    try {
      const result = await sharingService.restoreVersionCopy(currentCampaignId, selected.id, user);
      setStatusText('已恢复为副本');
      await loadVersions();
      if (selected.documentType === 'shared_entity') {
        const entityType = String(selected.snapshot.entityType || '');
        navigate(`/${entityType}/shared/${result.createdId}`);
        return;
      }
      if (selected.documentType === 'team_note') {
        navigate(`/team-notes?noteId=${result.createdId}`);
        return;
      }
    } catch (error) {
      setStatusText(error instanceof Error ? error.message : '恢复副本失败');
    }
  };

  const renderRichTextDiff = (row: DiffRow) => {
    const beforeValue = typeof row.beforeRaw === 'string' ? row.beforeRaw : '';
    const afterValue = typeof row.afterRaw === 'string' ? row.afterRaw : '';
    return (
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        <div className="border border-red-200 rounded p-3 bg-red-50/40">
          <div className="text-xs theme-text-secondary mb-2">之前</div>
          <div className="space-y-2">
            {(beforeValue ? beforeValue.split('\n') : ['']).map((line, index) => (
              <div key={`before-${row.keyPath}-${index}`} className={`rounded px-2 py-1 text-sm ${!afterValue.split('\n').includes(line) ? 'bg-red-100 border border-red-200' : ''}`}>
                {line || ' '}
              </div>
            ))}
          </div>
        </div>
        <div className="border border-green-200 rounded p-3 bg-green-50/40">
          <div className="text-xs theme-text-secondary mb-2">现在</div>
          <div className="space-y-2">
            {(afterValue ? afterValue.split('\n') : ['']).map((line, index) => (
              <div key={`after-${row.keyPath}-${index}`} className={`rounded px-2 py-1 text-sm ${!beforeValue.split('\n').includes(line) ? 'bg-green-100 border border-green-200' : ''}`}>
                {line || ' '}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <section className="bg-theme-card border border-theme rounded-lg shadow-sm p-4">
        <h2 className="text-xl sm:text-2xl font-bold">版本记录</h2>
        <div className="text-sm theme-text-secondary mt-1">
          {filterDocumentType || filterDocumentId ? '这里显示当前内容相关的版本记录，方便直接从上下文进入。' : '当前先记录团队笔记与分享记录的版本变化，后续继续扩展更细粒度的差异比较。'}
        </div>
        {statusText && <div className="text-sm theme-text-secondary mt-2">{statusText}</div>}
      </section>
      <div className="grid grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)] gap-4">
        <aside className="bg-theme-card border border-theme rounded-lg shadow-sm p-3">
          <div className="font-semibold mb-3">历史版本</div>
          <div className="space-y-2 max-h-[68vh] overflow-y-auto">
            {visibleVersions.map((version) => (
              <button
                key={version.id}
                type="button"
                onClick={() => setSelected(version)}
                className={`w-full text-left p-3 rounded border ${
                  selected?.id === version.id ? 'border-primary bg-primary-light' : 'border-theme hover:bg-primary-light/50'
                }`}
              >
                <div className="font-medium truncate">{version.summary}</div>
                <div className="text-xs theme-text-secondary mt-1">
                  {version.documentType} · {new Date(version.createdAt).toLocaleString()}
                </div>
              </button>
            ))}
            {visibleVersions.length === 0 && <div className="text-sm theme-text-secondary p-2">当前筛选条件下还没有可用的版本记录</div>}
          </div>
        </aside>
        <section className="bg-theme-card border border-theme rounded-lg shadow-sm p-4">
          {selected ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <h3 className="text-lg font-bold">{selected.summary}</h3>
                  <div className="text-sm theme-text-secondary mt-1">
                    操作人：{selected.operatorUsername} · {new Date(selected.createdAt).toLocaleString()}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleRestoreCopy}
                  disabled={!['shared_entity', 'team_note'].includes(selected.documentType)}
                  className="px-3 py-1.5 rounded border border-theme hover:bg-primary-light disabled:opacity-50 disabled:cursor-not-allowed text-sm flex items-center gap-2"
                >
                  <RotateCcw size={16} />
                  恢复副本
                </button>
              </div>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <div className="border border-theme rounded-lg p-3">
                  <div className="font-medium mb-3">变化摘要</div>
                  <div className="space-y-3 max-h-[520px] overflow-auto">
                    {diffRows.length > 0 ? diffRows.map((row) => (
                      <div key={row.keyPath} className="border border-theme rounded p-3 text-sm">
                        <div className="font-medium mb-2">{row.path}</div>
                        {/(^|\.)(content|details)$/.test(row.keyPath) && (typeof row.beforeRaw === 'string' || typeof row.afterRaw === 'string') ? (
                          renderRichTextDiff(row)
                        ) : (
                          <>
                            <div className="theme-text-secondary text-xs mb-1">之前</div>
                            <div className="text-sm break-words">{row.before}</div>
                            <div className="theme-text-secondary text-xs mt-3 mb-1">现在</div>
                            <div className="text-sm break-words">{row.after}</div>
                          </>
                        )}
                      </div>
                    )) : (
                      <div className="text-sm theme-text-secondary">当前记录没有可对比的上一个快照</div>
                    )}
                  </div>
                </div>
                <div className="border border-theme rounded-lg p-3">
                  <div className="font-medium mb-3">当前快照摘要</div>
                  <div className="space-y-3 max-h-[520px] overflow-auto">
                    {summaryRows.map((row) => (
                      <div key={row.keyPath} className="border border-theme rounded p-3 text-sm">
                        <div className="font-medium mb-1">{row.path}</div>
                        {/(^|\.)(content|details)$/.test(row.keyPath) && typeof row.raw === 'string'
                          ? <RichTextDisplay content={row.raw} />
                          : <div className="break-words">{row.value}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full min-h-[420px] flex items-center justify-center theme-text-secondary">请选择左侧一条版本记录</div>
          )}
        </section>
      </div>
    </div>
  );
};

export default VersionHistory;
