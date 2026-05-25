import React, { lazy, Suspense, useState } from 'react';
import { useCampaignSession, useCampaignTheme } from '../context/CampaignContext';
import { CampaignTheme } from '../types';
import { Monitor, Scroll, Archive, ChevronDown, ChevronRight } from 'lucide-react';
import { APP_VERSION } from '../constants/appVersion';
import { backupService } from '../services/backupService';
import BackupExportDialog from '../components/common/BackupExportDialog';
import ResourceManagementSection from '../features/resources/components/ResourceManagementSection';

const ImportAssistant = lazy(() => import('./ImportAssistant'));
const VersionHistory = lazy(() => import('./VersionHistory'));
const ReleaseUpdatePanel = lazy(() => import('../components/common/ReleaseUpdatePanel'));

const sectionFallback = (
  <div className="py-6 text-sm theme-text-secondary">正在加载内容...</div>
);

const Settings: React.FC = () => {
  const { currentCampaignId, user } = useCampaignSession();
  const { theme, setTheme } = useCampaignTheme();
  const [importCollapsed, setImportCollapsed] = useState(true);
  const [versionCollapsed, setVersionCollapsed] = useState(true);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const themes: { id: CampaignTheme; label: string; icon: React.ReactNode; desc: string }[] = [
    { id: 'default', label: '默认风格', icon: <Monitor size={20} />, desc: '淡雅的紫色调，柔和且适合现代阅读。' },
    { id: 'scroll', label: '复古羊皮纸', icon: <Scroll size={20} />, desc: '温暖的黄色调，带来经典 TRPG 氛围。' },
    { id: 'archive', label: '未来科技', icon: <Archive size={20} />, desc: '高对比度深色调，适合科幻或调查模组。' },
    { id: 'nature', label: '薄巧清新', icon: <Monitor size={20} />, desc: '薄荷绿主调搭配棕色文字与边框，清新耐看。' },
  ];

  const handleExportCurrentBackup = async (includeAssets: boolean) => {
    if (!currentCampaignId) return;
    try {
      await backupService.exportCampaign(currentCampaignId, user, includeAssets);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : '单模组备份导出失败');
    }
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto px-2 sm:px-0">
      <h2 className="text-xl sm:text-2xl font-bold">数据与设置</h2>

      {/* Theme Selection */}
      <section data-tour="settings-theme-section" className="bg-theme-card p-4 sm:p-6 rounded-lg shadow-sm border border-theme">
        <h3 className="text-lg font-medium mb-4">界面风格</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {themes.map((t) => (
                <button
                    key={t.id}
                    onClick={() => setTheme(t.id)}
                    className={`flex flex-col items-center p-4 border rounded-lg transition-all ${
                        theme === t.id 
                            ? 'border-primary bg-blue-50 text-primary' 
                            : 'border-theme hover:bg-gray-50'
                    }`}
                >
                    <div className="mb-2">{t.icon}</div>
                    <div className="font-medium">{t.label}</div>
                    <div className="text-xs text-center mt-1 theme-text-secondary">{t.desc}</div>
                </button>
            ))}
        </div>
      </section>

      <section className="bg-theme-card p-4 sm:p-6 rounded-lg shadow-sm border border-theme">
        <h3 className="text-lg font-medium mb-2">关于应用</h3>
        <div className="text-sm theme-text-secondary space-y-1">
          <div>当前版本：{APP_VERSION}</div>
        </div>
        <Suspense fallback={sectionFallback}>
          <ReleaseUpdatePanel className="mt-4" />
        </Suspense>
      </section>

      {/* Data Management */}
      <section data-tour="settings-import-assistant" className="bg-theme-card p-4 sm:p-6 rounded-lg shadow-sm border border-theme">
        <h3 className="text-lg font-medium mb-4">数据管理</h3>
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 border border-theme rounded">
            <div>
              <h4 className="font-medium">新版备份包</h4>
              <p className="text-sm theme-text-secondary">这里保留当前模组备份导出；数据包导入请使用下方导入助手，导出所有模组请到主页操作。</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setExportDialogOpen(true)}
                disabled={!currentCampaignId}
                className="px-4 py-2 bg-theme-card border border-theme rounded hover:bg-gray-50 disabled:opacity-50 flex items-center gap-2"
              >
                <Archive size={16} />
                导出当前模组
              </button>
            </div>
          </div>

          <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
            旧版 `JSON` 存档和新版备份包都请通过下方导入助手导入；其中 `JSON` 仅用于兼容历史数据，不建议再作为完整备份格式。
          </div>
        </div>
      </section>

      <section data-tour="settings-version-history" className="bg-theme-card p-4 sm:p-6 rounded-lg shadow-sm border border-theme">
        <button
          type="button"
          onClick={() => setImportCollapsed((prev) => !prev)}
          className="text-lg font-medium flex items-center gap-2 text-left"
        >
          {importCollapsed ? <ChevronRight size={18} /> : <ChevronDown size={18} />}
          导入助手
        </button>
        {!importCollapsed && (
          <Suspense fallback={sectionFallback}>
            <div className="mt-4">
              <ImportAssistant />
            </div>
          </Suspense>
        )}
      </section>

      <BackupExportDialog
        open={exportDialogOpen}
        title="选择当前模组备份方式"
        description="完整备份会把这个模组引用到的图片资源一起打包，轻量备份只保留文字与结构数据。"
        onSelect={(includeAssets) => {
          setExportDialogOpen(false);
          void handleExportCurrentBackup(includeAssets);
        }}
        onCancel={() => setExportDialogOpen(false)}
      />

      <ResourceManagementSection />

      <section className="bg-theme-card p-4 sm:p-6 rounded-lg shadow-sm border border-theme">
        <button
          type="button"
          onClick={() => setVersionCollapsed((prev) => !prev)}
          className="text-lg font-medium flex items-center gap-2 text-left"
        >
          {versionCollapsed ? <ChevronRight size={18} /> : <ChevronDown size={18} />}
          版本记录
        </button>
        {!versionCollapsed && (
          <Suspense fallback={sectionFallback}>
            <div className="mt-4">
              <VersionHistory />
            </div>
          </Suspense>
        )}
      </section>
    </div>
  );
};

export default Settings;
