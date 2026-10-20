import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Clock3, Loader2, RefreshCw, Users, AlertCircle } from 'lucide-react';
import { useCampaignSession } from '../../context/CampaignContext';
import { useCampaignMemberRole } from '../../hooks/useCampaignMemberRole';
import { getCampaignRoleLabel } from '../../utils/campaignRoles';

export interface BackendConnectionStatus {
  online: boolean;
  latencyMs?: number;
  checkedAt: number;
}

interface ConnectionStatusPanelProps {
  connection: BackendConnectionStatus | null;
  checking: boolean;
  onRefresh: () => void;
}

export default function ConnectionStatusPanel({ connection, checking, onRefresh }: ConnectionStatusPanelProps) {
  const { currentCampaignId, user, isCampaignLoading, isCampaignSaving, hasUnsavedChanges, lastSavedAt, lastSaveError, exportData } = useCampaignSession();
  const { config, configQuery, canManageCampaignContent } = useCampaignMemberRole();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const now = Date.now();
  const membersAvailable = Boolean(connection?.online && config && !configQuery.isError && now - configQuery.dataUpdatedAt < 60_000);
  const members = membersAvailable ? config!.members.filter((member) => now - member.lastActiveAt < 5 * 60_000) : [];
  const saveFailed = hasUnsavedChanges && Boolean(lastSaveError);
  const saveLabel = isCampaignLoading ? '加载中' : isCampaignSaving ? '保存中' : saveFailed ? '保存失败'
    : hasUnsavedChanges ? '待保存' : !config ? '状态未就绪' : !canManageCampaignContent ? '只读'
      : lastSavedAt ? '已保存' : '暂无待保存修改';
  const connectionLabel = checking ? '检查连接中' : connection === null ? '连接未检查' : connection.online ? '已连接' : '连接中断';
  const dotClass = checking || connection === null ? 'bg-amber-400' : connection.online ? 'bg-green-500' : 'bg-red-500';
  const SaveIcon = isCampaignLoading || isCampaignSaving ? Loader2 : saveFailed ? AlertCircle : hasUnsavedChanges || !config ? Clock3 : CheckCircle2;

  useEffect(() => { setOpen(false); }, [currentCampaignId]);

  useEffect(() => {
    if (!open) return;
    panelRef.current?.focus();
    const closeOutside = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="connection-status">
      <button
        ref={triggerRef}
        type="button"
        aria-label={`连接与保存状态：${connectionLabel}${currentCampaignId ? `，模组${saveLabel}` : ''}`}
        aria-expanded={open}
        aria-controls="connection-status-panel"
        onClick={() => setOpen((previous) => !previous)}
        className="connection-status__trigger"
      >
        <span className="relative inline-flex items-center gap-1.5">
          <Users size={18} aria-hidden="true" />
          {currentCampaignId && <span className="text-xs font-semibold tabular-nums">{membersAvailable ? members.length : '—'}</span>}
          <span className={`absolute -bottom-1 -left-0.5 h-2.5 w-2.5 rounded-full border-2 border-theme ${dotClass}`} />
        </span>
        <span className="hidden sm:inline text-xs" role="status">{currentCampaignId ? saveLabel : connectionLabel}</span>
        {currentCampaignId && <SaveIcon size={14} aria-hidden="true" className={isCampaignLoading || isCampaignSaving ? 'animate-spin' : saveFailed ? 'text-red-500' : hasUnsavedChanges ? 'text-amber-600' : 'text-green-500'} />}
      </button>

      {open && (
        <div ref={panelRef} id="connection-status-panel" role="region" aria-label="连接与保存详情" tabIndex={-1} className="connection-status__panel ui-glass">
          <div className="flex items-center justify-between gap-2">
            <p className="flex items-center gap-2 text-sm" role="status">
              <span className={`h-2 w-2 shrink-0 rounded-full ${dotClass}`} />
              {connectionLabel}
              {!checking && connection?.online && typeof connection.latencyMs === 'number' && <span className="theme-text-secondary">· {connection.latencyMs}ms</span>}
            </p>
            <button type="button" disabled={checking || configQuery.isFetching} onClick={() => { onRefresh(); if (currentCampaignId) void configQuery.refetch(); }} className="inline-flex shrink-0 items-center gap-1 rounded border border-theme px-2 py-1 text-xs hover:bg-primary-light disabled:opacity-50">
              <RefreshCw size={12} className={checking || configQuery.isFetching ? 'animate-spin' : ''} />
              刷新状态
            </button>
          </div>
          {connection && <p className="mt-1 text-xs theme-text-secondary">本机至服务器 · 检查于 {new Date(connection.checkedAt).toLocaleTimeString()}</p>}

          {currentCampaignId && (
            <>
              <div className="mt-4 flex items-center gap-2">
                <h3 className="font-semibold">在线成员</h3>
                <span className="rounded-full bg-primary-light px-2 py-0.5 text-sm font-semibold text-primary">{membersAvailable ? members.length : '—'}</span>
              </div>
              <p className="mt-1 text-xs theme-text-secondary">按最近 5 分钟内活动统计，不代表实时连接数。</p>
              <div className="my-3 max-h-48 space-y-3 overflow-y-auto">
                {!membersAvailable ? <p className="text-sm theme-text-secondary">{configQuery.isFetching ? '正在读取成员状态…' : '成员状态暂不可用，请刷新。'}</p> : members.length === 0 ? <p className="text-sm theme-text-secondary">暂无近期活跃成员。</p> : members.map((member) => (
                  <div key={member.userId} className="flex items-center gap-3">
                    <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-light font-medium text-primary">{Array.from(member.username || '?')[0]}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm" title={member.username}>{member.username}{member.userId === user?.id ? '（我）' : ''}</p>
                      <div className="mt-0.5 flex items-center gap-2 text-xs theme-text-secondary">
                        <span>{getCampaignRoleLabel(member.role)}</span>
                        <span>{member.userId === user?.id && !checking && typeof connection?.latencyMs === 'number' ? `${connection.latencyMs}ms` : `活动于 ${new Date(member.lastActiveAt).toLocaleTimeString()}`}</span>
                      </div>
                    </div>
                    <span aria-label="近期活跃" className="h-2 w-2 shrink-0 rounded-full bg-green-500" />
                  </div>
                ))}
              </div>
              <div className="border-t border-theme pt-3 text-sm">
                <p className="flex items-center gap-2 font-medium" role="status"><SaveIcon size={16} className={isCampaignLoading || isCampaignSaving ? 'animate-spin' : ''} />模组{saveLabel}</p>
                {lastSavedAt && !isCampaignLoading ? <p className="mt-1 text-xs theme-text-secondary">最近保存：{new Date(lastSavedAt).toLocaleString()}</p> : null}
                <p className="mt-1 text-xs theme-text-secondary">{canManageCampaignContent ? '此处显示普通模组资料的保存状态；团队笔记、地图和角色卡以各自页面为准。' : '当前身份只能读取已授权的模组资料。'}</p>
                {saveFailed && <div className="mt-2 text-xs text-red-600"><p className="break-words">{lastSaveError}</p><button type="button" onClick={exportData} className="mt-2 rounded border border-theme px-2 py-1">导出当前修改（JSON）</button></div>}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
