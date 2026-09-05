import React, { useState } from 'react';
import { Archive, ChevronDown, ChevronRight, Download, X } from 'lucide-react';
import { useCampaignSession } from '../../../context/CampaignContext';
import { prepPackageService, type PrepPackageCatalogCategory } from '../../../services/prepPackageService';

type SelectionState = Record<string, string[]>;

const PrepPackageManager: React.FC = () => {
  const { currentCampaignId, user } = useCampaignSession();
  const [catalog, setCatalog] = useState<PrepPackageCatalogCategory[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [selections, setSelections] = useState<SelectionState>({});
  const [packageName, setPackageName] = useState('');
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');

  const loadCatalog = async () => {
    if (!currentCampaignId) return;
    setLoading(true);
    try {
      setCatalog(await prepPackageService.getCatalog(currentCampaignId, user));
      setSelections({});
      setStatus('');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '读取可导出内容失败。');
    } finally {
      setLoading(false);
    }
  };

  const selectedCount = Object.values(selections).reduce((total, ids) => total + ids.length, 0);
  const toggleCategory = (category: PrepPackageCatalogCategory, checked: boolean) => {
    setSelections((current) => ({ ...current, [category.key]: checked ? category.items.map((item) => item.id) : [] }));
  };
  const toggleItem = (key: string, id: string, checked: boolean) => {
    setSelections((current) => {
      const selected = new Set(current[key] || []);
      if (checked) selected.add(id); else selected.delete(id);
      return { ...current, [key]: [...selected] };
    });
  };

  const handleExport = async () => {
    if (!currentCampaignId || selectedCount === 0) return;
    setBusy(true);
    setStatus('');
    try {
      await prepPackageService.exportPackage(currentCampaignId, user, packageName.trim(), selections);
      setStatus(`已导出 ${selectedCount} 个条目；引用到的图片资源已自动随包打包。`);
      setExportDialogOpen(false);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '备团包导出失败。');
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-4 rounded border border-theme p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h4 className="flex items-center gap-2 font-medium"><Archive size={17} />备团包</h4>
          <p className="mt-1 text-sm theme-text-secondary">按需选择当前模组的资料并导出（不含联机内容）；导入统一使用导入助手。</p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <button type="button" onClick={() => { setExportDialogOpen(true); void loadCatalog(); }} disabled={!currentCampaignId || busy} className="inline-flex items-center justify-center gap-2 rounded bg-primary px-3 py-2 text-sm text-white hover:bg-primary-dark disabled:opacity-50"><Download size={16} />选择内容并导出</button>
        </div>
      </div>
      {status && <div className="rounded border border-theme px-3 py-2 text-sm theme-text-secondary">{status}</div>}
      {exportDialogOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label="选择备团包导出内容" onClick={() => { if (!busy) setExportDialogOpen(false); }}>
          <div className="theme-card flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-theme shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4 border-b border-theme px-5 py-4">
              <div><h4 className="text-lg font-semibold">选择备团包内容</h4><p className="mt-1 text-sm theme-text-secondary">直接勾选板块可全选；展开后可以只选其中部分条目。</p></div>
              <button type="button" onClick={() => setExportDialogOpen(false)} disabled={busy} className="rounded border border-theme p-2 hover:bg-primary-light disabled:opacity-50" aria-label="关闭备团包导出窗口"><X size={18} /></button>
            </div>
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
              <input value={packageName} onChange={(event) => setPackageName(event.target.value)} placeholder="备团包名称（留空则使用模组名）" className="w-full rounded border border-theme bg-transparent px-3 py-2 text-sm" />
              <p className="text-xs theme-text-secondary">团队笔记、任务看板、成员权限和版本记录不会导出。图片资源会自动随包导出；未选条目的关联关系和地图点位不会保留。</p>
              {!loading && catalog.length === 0 && status ? <div className="rounded border border-theme px-3 py-2 text-sm theme-text-secondary">{status}</div> : null}
              {loading ? <div className="py-8 text-center text-sm theme-text-secondary">正在读取可导出内容…</div> : (
                <div className="space-y-2">
                  {catalog.map((category) => {
                    const selected = selections[category.key] || [];
                    const allSelected = category.items.length > 0 && selected.length === category.items.length;
                    const isExpanded = Boolean(expanded[category.key]);
                    return (
                      <div key={category.key} className="rounded border border-theme">
                        <div className="flex items-center gap-2 px-3 py-2">
                          <button type="button" onClick={() => setExpanded((current) => ({ ...current, [category.key]: !isExpanded }))} className="rounded p-1 hover:bg-primary-light" aria-label={isExpanded ? `收起${category.label}` : `展开${category.label}`}>{isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</button>
                          <label className="flex flex-1 cursor-pointer items-center gap-2 text-sm">
                            <input type="checkbox" checked={allSelected} disabled={category.items.length === 0} onChange={(event) => toggleCategory(category, event.target.checked)} className="h-4 w-4 rounded border-theme text-primary focus:ring-primary" />
                            <span className="font-medium">{category.label}</span><span className="theme-text-secondary">{selected.length}/{category.items.length}</span>
                          </label>
                        </div>
                        {isExpanded ? <div className="grid grid-cols-1 gap-1 border-t border-theme px-4 py-3 sm:grid-cols-2">
                          {category.items.length === 0 ? <div className="text-sm theme-text-secondary">暂无条目</div> : category.items.map((item) => (
                            <label key={item.id} className="flex min-w-0 cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-primary-light/50">
                              <input type="checkbox" checked={selected.includes(item.id)} onChange={(event) => toggleItem(category.key, item.id, event.target.checked)} className="h-4 w-4 shrink-0 rounded border-theme text-primary focus:ring-primary" />
                              <span className="truncate" title={item.name}>{item.name}</span>
                            </label>
                          ))}
                        </div> : null}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-theme px-5 py-4">
              <span className="text-sm theme-text-secondary">已选择 {selectedCount} 个条目</span>
              <div className="flex gap-2">
                <button type="button" onClick={() => void loadCatalog()} disabled={busy || loading} className="rounded border border-theme px-3 py-2 text-sm hover:bg-primary-light disabled:opacity-50">刷新清单</button>
                <button type="button" onClick={() => void handleExport()} disabled={busy || loading || selectedCount === 0} className="inline-flex items-center gap-2 rounded bg-primary px-4 py-2 text-sm text-white hover:bg-primary-dark disabled:opacity-50"><Download size={16} />导出（{selectedCount}）</button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default PrepPackageManager;
