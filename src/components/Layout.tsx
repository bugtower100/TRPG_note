import React, { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import TabPanel from './TabPanel';
import { useCampaign } from '../context/CampaignContext';

const Layout: React.FC = () => {
  const { tabs, exportData, importData } = useCampaign();
  const [isTabPanelMaximized, setIsTabPanelMaximized] = useState(false);
  const [backendStatus, setBackendStatus] = useState<{ online: boolean; offlineSince?: number; syncedAt?: number; conflicts?: Array<{ key: string; localTime?: number; remoteTime?: number }>; unsyncedCount?: number; latencyMs?: number } | null>(null);
  const [showConflicts, setShowConflicts] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (tabs.length === 0) {
      setIsTabPanelMaximized(false);
    }
  }, [tabs.length]);

  useEffect(() => {
    const handler = (e: Event) => {
      const any = e as any;
      setBackendStatus(any.detail);
    };
    window.addEventListener('storage-backend-status', handler as any);
    (async () => {
      try {
        const res = await fetch('/api/storage/health');
        if (res.ok) {
          const t0 = Date.now();
          setBackendStatus({ online: true, syncedAt: Date.now(), conflicts: [], unsyncedCount: 0, latencyMs: Date.now() - t0 });
        } else {
          setBackendStatus({ online: false, offlineSince: Date.now(), unsyncedCount: 0, latencyMs: undefined });
        }
      } catch {
        setBackendStatus({ online: false, offlineSince: Date.now(), unsyncedCount: 0, latencyMs: undefined });
      }
    })();
    return () => {
      window.removeEventListener('storage-backend-status', handler as any);
    };
  }, []);

  return (
    <div className="flex h-screen overflow-hidden theme-page">
      <Sidebar />
      <main className="flex-1 ml-56 flex overflow-hidden">
        <div className="absolute left-56 right-0 top-0 z-50">
          {backendStatus?.online === false ? (
            <div className="bg-red-600 text-white px-4 py-2 text-sm flex items-center justify-between">
              <span>
                当前无法连接后端，正在使用浏览器缓存。本地修改将保存在浏览器中，连接恢复后会自动同步。
                {typeof backendStatus?.unsyncedCount === 'number' ? ` 离线未同步键数：${backendStatus.unsyncedCount}` : ''}
              </span>
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".json"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) await importData(file);
                    e.currentTarget.value = '';
                  }}
                />
                <button className="px-2 py-1 bg-white text-red-700 rounded text-xs" onClick={() => exportData()}>
                  导出当前模组
                </button>
                <button className="px-2 py-1 bg-white text-red-700 rounded text-xs" onClick={() => fileInputRef.current?.click()}>
                  导入 JSON
                </button>
              </div>
            </div>
          ) : backendStatus?.online === true && backendStatus?.conflicts && backendStatus.conflicts.length > 0 ? (
            <div className="bg-yellow-500 text-black px-4 py-2 text-sm flex items-center justify-between">
              <span>检测到存档版本差异，条目数：{backendStatus.conflicts.length}。最近同步时间：{backendStatus.syncedAt ? new Date(backendStatus.syncedAt).toLocaleString() : ''}</span>
              <button className="px-2 py-1 border border-black/20 rounded bg-white text-black text-xs" onClick={() => setShowConflicts((v) => !v)}>
                {showConflicts ? '收起' : '查看详情'}
              </button>
            </div>
          ) : null}
        </div>
        <div className="absolute right-4 bottom-2 z-50">
          <span className={`px-2 py-1 rounded text-xs ${backendStatus?.online ? 'bg-green-600 text-white' : 'bg-gray-700 text-white'}`}>
            {backendStatus?.online ? '在线' : '离线'}{backendStatus?.online && typeof backendStatus?.latencyMs === 'number' ? ` ${backendStatus.latencyMs}ms` : ''}
            {backendStatus?.online ? '' : (typeof backendStatus?.unsyncedCount === 'number' ? `（未同步${backendStatus.unsyncedCount}）` : '')}
          </span>
        </div>
        {showConflicts && backendStatus?.conflicts && backendStatus.conflicts.length > 0 && (
          <div className="absolute left-56 right-0 top-10 z-40 bg-white border border-yellow-500 rounded shadow p-3 text-xs">
            {backendStatus.conflicts.map((c) => (
              <div key={c.key} className="py-1 flex items-center justify-between">
                <span className="font-medium break-all">{c.key}</span>
                <span className="ml-2">云端：{c.remoteTime ? new Date(c.remoteTime).toLocaleString() : '未知'}</span>
                <span className="ml-2">本地：{c.localTime ? new Date(c.localTime).toLocaleString() : '未知'}</span>
              </div>
            ))}
          </div>
        )}
        <div className={`flex-1 overflow-y-auto p-8 pt-16 ${tabs.length > 0 && !isTabPanelMaximized ? 'border-r border-theme' : ''} ${isTabPanelMaximized ? 'hidden' : ''}`}>
          <Outlet />
        </div>
        <TabPanel
          maximized={isTabPanelMaximized}
          onToggleMaximize={() => setIsTabPanelMaximized((prev) => !prev)}
        />
      </main>
    </div>
  );
};

export default Layout;
