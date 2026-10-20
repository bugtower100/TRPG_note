import React, { lazy, Suspense, useMemo, useState } from 'react';
import { useCampaignSession, useCampaignTheme } from '../context/CampaignContext';
import { CampaignTheme } from '../types';
import { Monitor, Scroll, Archive, Upload, Download, Trash2 } from 'lucide-react';
import { backupService } from '../services/backupService';
import BackupExportDialog from '../components/common/BackupExportDialog';
import ResourceManagementSection from '../features/resources/components/ResourceManagementSection';
import {
  BUILTIN_THEME_OPTIONS,
  downloadCustomThemeTemplate,
  parseCustomThemeFile,
} from '../features/themes/themeService';
import { useDirectContentEditPreference } from '../hooks/useDirectContentEditPreference';

const ImportAssistant = lazy(() => import('./ImportAssistant'));
const PrepPackageManager = lazy(() => import('../features/prep-packages/components/PrepPackageManager'));
const RecycleBin = lazy(() => import('./RecycleBin'));
const ReleaseUpdatePanel = lazy(() => import('../components/common/ReleaseUpdatePanel'));

const sectionFallback = (
  <div className="py-6 text-sm theme-text-secondary">正在加载内容...</div>
);

const Settings: React.FC = () => {
  const { currentCampaignId, user } = useCampaignSession();
  const {
    theme,
    setTheme,
    customThemes,
    activeCustomTheme,
    selectedCustomThemeName,
    upsertCustomTheme,
    removeCustomTheme,
    selectCustomTheme,
  } = useCampaignTheme();
  const [activeSection, setActiveSection] = useState('general');
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [themeStatus, setThemeStatus] = useState('');
  const { directContentEdit, setDirectContentEdit } = useDirectContentEditPreference();
  const themes: { id: CampaignTheme; label: string; icon: React.ReactNode; desc: string }[] = useMemo(() => BUILTIN_THEME_OPTIONS.filter((item) => item.id !== 'custom').map((item) => ({
    ...item,
    icon:
      item.id === 'scroll' ? <Scroll size={20} /> :
      item.id === 'archive' ? <Archive size={20} /> :
      <Monitor size={20} />,
  })), []);

  const handleImportCustomTheme = async (file?: File) => {
    if (!file) return;
    try {
      const parsed = await parseCustomThemeFile(file);
      const exists = customThemes.some((item) => item.name === parsed.name);
      upsertCustomTheme(parsed);
      setTheme('custom');
      setThemeStatus(exists ? `已覆盖同名主题：${parsed.name}` : `已导入自定义主题：${parsed.name}`);
    } catch (error) {
      setThemeStatus(error instanceof Error ? error.message : '自定义主题导入失败');
    }
  };

  const handleExportCurrentBackup = async (includeAssets: boolean) => {
    if (!currentCampaignId) return;
    try {
      await backupService.exportCampaign(currentCampaignId, user, includeAssets);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : '单模组备份导出失败');
    }
  };

  return (
    <div className="settings-page settings-flat">
      <h2 className="settings-wide mb-1 text-xl sm:text-2xl font-semibold">数据与设置</h2>
      <nav className="content-tabs" aria-label="设置分类" data-tour="settings-navigation">
        {[
          ['general', '基本设置'], ['data', '备份与导入'],
          ['resources', '资源管理'], ['recycle', '回收站'], ['updates', '版本与更新'],
        ].map(([id, label]) => <button key={id} type="button" data-tour={`settings-${id}-tab`} aria-pressed={activeSection === id} className={activeSection === id ? 'is-active' : ''} onClick={() => setActiveSection(id)}>{label}</button>)}
      </nav>

      {/* Theme Selection */}
      <section hidden={activeSection !== 'general'} data-tour="settings-theme-section" className="settings-section settings-form-row">
        <h3 className="font-semibold">主题与样式</h3>
        <div className="min-w-0">
        <div className="settings-theme-options">
            {themes.map((t) => (
                <button
                    key={t.id}
                    onClick={() => setTheme(t.id)}
                    aria-pressed={theme === t.id}
                    className={`settings-theme-option border rounded-md transition-colors ${
                        theme === t.id 
                            ? 'border-primary bg-primary-light text-primary shadow-sm' 
                            : 'border-theme hover:bg-primary-light'
                    }`}
                >
                    <span className="shrink-0">{t.icon}</span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">{t.label}</span>
                      <span className="block text-xs mt-1 theme-text-secondary">{t.desc}</span>
                    </span>
                </button>
            ))}
        </div>
        <details className="mt-3 border-t border-theme pt-3">
          <summary className="cursor-pointer text-sm font-medium">
            自定义主题库
            <span className="ml-2 text-xs font-normal theme-text-secondary">{customThemes.length} 个已保存</span>
          </summary>
          <div className="mt-3 space-y-3">
          <p className="text-xs theme-text-secondary">主题保存在本机，可上传、切换或删除。</p>
          <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_auto] gap-3 items-start">
            <div className="space-y-2">
              <label className="text-sm theme-text-secondary">当前自定义主题</label>
              <select
                value={selectedCustomThemeName || ''}
                onChange={(event) => {
                  const nextName = event.target.value || null;
                  selectCustomTheme(nextName);
                  if (nextName) {
                    setTheme('custom');
                    setThemeStatus(`已切换到自定义主题：${nextName}`);
                  }
                }}
                disabled={customThemes.length === 0}
                className="w-full px-3 py-2 rounded border border-theme bg-transparent"
              >
                <option value="">{customThemes.length === 0 ? '暂无已上传主题' : '请选择已上传主题'}</option>
                {customThemes.map((item) => (
                  <option key={item.name} value={item.name}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={() => {
                if (!selectedCustomThemeName) {
                  setThemeStatus('请先从下拉框选择一个自定义主题。');
                  return;
                }
                setTheme('custom');
                setThemeStatus(`已应用自定义主题：${selectedCustomThemeName}`);
              }}
              disabled={!selectedCustomThemeName}
              className="px-3 py-2 rounded border border-theme hover:bg-primary-light text-sm disabled:opacity-50"
            >
              使用当前主题
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            <label className="inline-flex items-center gap-2 px-3 py-2 rounded border border-theme hover:bg-primary-light cursor-pointer text-sm">
              <Upload size={16} />
              上传主题 JSON
              <input
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(event) => void handleImportCustomTheme(event.target.files?.[0])}
              />
            </label>
            <button
              type="button"
              onClick={downloadCustomThemeTemplate}
              className="inline-flex items-center gap-2 px-3 py-2 rounded border border-theme hover:bg-primary-light text-sm"
            >
              <Download size={16} />
              下载模板
            </button>
            {selectedCustomThemeName && (
              <button
                type="button"
                onClick={() => {
                  removeCustomTheme(selectedCustomThemeName);
                  if (theme === 'custom' && selectedCustomThemeName === activeCustomTheme?.name) {
                    setTheme('default');
                  }
                  setThemeStatus(`已删除自定义主题：${selectedCustomThemeName}`);
                }}
                className="inline-flex items-center gap-2 px-3 py-2 rounded border border-red-300 text-red-600 hover:bg-red-50 text-sm"
              >
                <Trash2 size={16} />
                清除自定义主题
              </button>
            )}
          </div>
          {activeCustomTheme && (
            <div className="text-sm theme-text-secondary">
              当前选中：`{activeCustomTheme.name}`
            </div>
          )}
          {themeStatus && <div className="text-sm theme-text-secondary">{themeStatus}</div>}
          </div>
        </details>
        </div>
      </section>

      <section hidden={activeSection !== 'general'} className="settings-section settings-form-row">
        <h3 className="font-semibold">编辑偏好</h3>
        <label className="mt-3 flex items-start justify-between gap-3 cursor-pointer">
          <span>
            <span className="block text-sm font-medium">双击内容直接进入编辑</span>
            <span className="mt-1 block text-xs leading-5 theme-text-secondary">
              开启后，双击普通资料页的正文内容即可进入编辑模式，双击编辑器外部即可结束编辑；关闭后需要点击“开始编辑”。
            </span>
          </span>
          <input
            type="checkbox"
            checked={directContentEdit}
            onChange={(event) => setDirectContentEdit(event.target.checked)}
            className="mt-1 h-5 w-5 shrink-0 rounded border-theme text-primary focus:ring-primary"
          />
        </label>
      </section>

      <section hidden={activeSection !== 'updates'} className="settings-section">
        <h3 className="font-semibold mb-3">关于应用</h3>
        <Suspense fallback={sectionFallback}>
          <ReleaseUpdatePanel compact className="settings-update-panel" />
        </Suspense>
      </section>

      {/* Data Management */}
      <section hidden={activeSection !== 'data'} className="settings-section settings-wide">
        <h3 className="font-semibold mb-3">数据管理</h3>
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h4 className="text-sm font-medium">模组备份</h4>
              <p className="mt-1 text-xs theme-text-secondary">导入请使用下方助手；导出所有模组请到主页操作。</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setExportDialogOpen(true)}
                disabled={!currentCampaignId}
                className="px-3 py-1.5 border border-theme rounded hover:bg-primary-light disabled:opacity-50 flex items-center gap-2 text-sm"
              >
                <Archive size={16} />
                导出当前模组
              </button>
            </div>
          </div>

          <Suspense fallback={sectionFallback}>
            <PrepPackageManager />
          </Suspense>
        </div>
      </section>

      <section hidden={activeSection !== 'data'} data-tour="settings-import-assistant" className="settings-section settings-wide">
          <Suspense fallback={sectionFallback}>
            <div className="mt-4">
              <ImportAssistant />
            </div>
          </Suspense>
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

      <section hidden={activeSection !== 'recycle'} data-tour="settings-recycle-bin" className="settings-section settings-wide">
        <h3 className="font-semibold">回收站</h3>
          <Suspense fallback={sectionFallback}>
            <div className="mt-4">
              <RecycleBin />
            </div>
          </Suspense>
      </section>
      <div hidden={activeSection !== 'resources'} className="settings-wide settings-resources">
        <ResourceManagementSection />
      </div>
    </div>
  );
};

export default Settings;
