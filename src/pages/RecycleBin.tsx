import { useCallback, useEffect, useState } from 'react';
import { useCampaignSession } from '../context/CampaignContext';
import { useCampaignMemberRole } from '../hooks/useCampaignMemberRole';
import { buildUserHeaders, readApiPayload } from '../services/apiClient';
import type { BaseEntity, GraphEntityType } from '../types';

const labels: Record<GraphEntityType, string> = {
  characters: '角色', monsters: '怪物', locations: '地点', organizations: '组织',
  events: '事件', clues: '线索', timelines: '时间线',
};

interface RecycleDocument {
  retentionDays: number;
  version: number;
  items: Array<{ id: string; entityType: GraphEntityType; entity: BaseEntity; deletedAt: number }>;
}

export default function RecycleBin() {
  const { currentCampaignId, user, hasUnsavedChanges, isCampaignSaving, reloadCurrentCampaign } = useCampaignSession();
  const { canManageCampaignContent } = useCampaignMemberRole();
  const [doc, setDoc] = useState<RecycleDocument | null>(null);
  const [days, setDays] = useState('3');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const request = useCallback(async (body?: object): Promise<RecycleDocument> => {
    const response = await fetch(`/api/campaigns/${encodeURIComponent(currentCampaignId!)}/recycle-bin`, {
      method: body ? 'POST' : 'GET',
      headers: buildUserHeaders(user, { campaignId: currentCampaignId!, includeJson: Boolean(body) }),
      body: body ? JSON.stringify(body) : undefined,
    });
    const { payload } = await readApiPayload<RecycleDocument & { error?: string }>(response);
    if (response.status === 404 && !payload) {
      throw new Error('当前后端未提供回收站接口，请更新并重启配套的 EXE；若使用开发前端，请检查 API 代理指向。');
    }
    if (!response.ok) throw new Error(payload?.error || `回收站操作失败（HTTP ${response.status}）`);
    if (!payload) throw new Error('回收站接口未返回有效的 JSON，请检查后端版本及 API 代理配置。');
    return payload;
  }, [currentCampaignId, user]);

  useEffect(() => {
    if (!currentCampaignId || !canManageCampaignContent) return;
    let active = true;
    setDoc(null);
    request().then((next) => {
      if (active) { setDoc(next); setDays(String(next.retentionDays)); }
    }).catch((error) => { if (active) setStatus(error.message); });
    return () => { active = false; };
  }, [currentCampaignId, canManageCampaignContent, request]);

  const refresh = async () => {
    setBusy(true);
    try { const next = await request(); setDoc(next); setDays(String(next.retentionDays)); setStatus('回收站已刷新。'); }
    catch (error) { setStatus(error instanceof Error ? error.message : '读取失败'); }
    finally { setBusy(false); }
  };

  const act = async (action: 'restore' | 'delete' | 'settings', itemId?: string) => {
    if (!doc || busy) return;
    if (hasUnsavedChanges || isCampaignSaving) { setStatus('请先保存当前模组修改，再操作回收站。'); return; }
    const retentionDays = Number(days);
    if (action === 'settings' && (!Number.isInteger(retentionDays) || retentionDays < 1 || retentionDays > 3650)) {
      setStatus('保留时间须为 1 到 3650 天的整数。'); return;
    }
    if (action === 'delete' && !window.confirm('确定彻底删除这条资料？此操作不可恢复。')) return;
    if (action === 'settings' && retentionDays < doc.retentionDays && !window.confirm('缩短保留时间会立即清理超过期限的条目，确定继续？')) return;
    setBusy(true);
    try {
      setDoc(await request({ action, itemId, retentionDays, expectedVersion: doc.version }));
      setStatus(action === 'restore' ? '资料已恢复。' : action === 'delete' ? '资料已彻底删除。' : '保留时间已保存。');
      if (action === 'restore') {
        try { await reloadCurrentCampaign(); }
        catch { setStatus('资料已在服务端恢复，但当前页面未重新加载。请先处理页面顶部提示，避免覆盖未保存修改。'); }
      }
    } catch (error) { setStatus(error instanceof Error ? error.message : '操作失败'); }
    finally { setBusy(false); }
  };

  if (!canManageCampaignContent) return <p className="text-sm theme-text-secondary">回收站仅对模组管理者开放。</p>;
  return <div className="space-y-4">
    <p className="text-sm theme-text-secondary">恢复已删除的角色、怪物、地点、组织、事件、线索和时间线，包含其区块内容。默认保留 3 天，过期后自动清理；恢复保留原 ID。</p>
    <div className="flex flex-wrap items-center gap-2">
      <label className="text-sm">保留天数 <input aria-label="回收站保留天数" type="number" min="1" max="3650" value={days} onChange={(event) => setDays(event.target.value)} className="w-24 rounded border border-theme bg-transparent px-2 py-1" /></label>
      <button disabled={busy || !doc} onClick={() => void act('settings')} className="rounded border border-theme px-3 py-1.5 text-sm disabled:opacity-50">保存设置</button>
      <button disabled={busy} onClick={() => void refresh()} className="rounded border border-theme px-3 py-1.5 text-sm disabled:opacity-50">刷新</button>
    </div>
    {status && <p role="status" className="text-sm theme-text-secondary">{status}</p>}
    {doc?.items.length === 0 && <p className="text-sm theme-text-secondary">回收站为空。</p>}
    {doc?.items.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-theme py-3">
      <div><div className="font-medium">{item.entity.name || '未命名'} · {labels[item.entityType]}</div><div className="text-xs theme-text-secondary">删除于 {new Date(item.deletedAt).toLocaleString()} · 到期 {new Date(item.deletedAt + doc.retentionDays * 86400000).toLocaleString()}</div></div>
      <div className="flex gap-2"><button disabled={busy} onClick={() => void act('restore', item.id)} className="rounded border border-theme px-3 py-1.5 text-sm disabled:opacity-50">恢复</button><button disabled={busy} onClick={() => void act('delete', item.id)} className="rounded border border-red-300 px-3 py-1.5 text-sm text-red-600 disabled:opacity-50">彻底删除</button></div>
    </div>)}
  </div>;
}
