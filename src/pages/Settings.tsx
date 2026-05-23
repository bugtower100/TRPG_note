import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useCampaign } from '../context/CampaignContext';
import { CampaignTheme } from '../types';
import { Monitor, Scroll, Archive, Trash2, RefreshCw, ChevronDown, ChevronRight, FolderPlus, MoveRight, Pencil, FolderX, Upload } from 'lucide-react';
import { APP_VERSION } from '../constants/appVersion';
import {
  buildResourceTree,
  filterResourceItems,
  flattenResourceFolders,
  ResourceFolder,
  ResourceItem,
  resourceFolderDisplayName,
  resourceService,
  RESOURCE_ROOT_PATH,
} from '../services/resourceService';
import ImportAssistant from './ImportAssistant';
import VersionHistory from './VersionHistory';
import ResourceTreeView from '../components/common/ResourceTreeView';
import ReleaseUpdatePanel from '../components/common/ReleaseUpdatePanel';
import { backupService } from '../services/backupService';
import BackupExportDialog from '../components/common/BackupExportDialog';

const Settings: React.FC = () => {
  const { 
    currentCampaignId,
    user,
    theme, setTheme
  } = useCampaign();
  
  const resourceInputRef = useRef<HTMLInputElement>(null);
  const [resources, setResources] = useState<ResourceItem[]>([]);
  const [resourceFolders, setResourceFolders] = useState<ResourceFolder[]>([]);
  const [selectedRefs, setSelectedRefs] = useState<string[]>([]);
  const [resourceBusy, setResourceBusy] = useState(false);
  const [resourceCollapsed, setResourceCollapsed] = useState(false);
  const [importCollapsed, setImportCollapsed] = useState(true);
  const [versionCollapsed, setVersionCollapsed] = useState(true);
  const [resourceKeyword, setResourceKeyword] = useState('');
  const [expandedFolderPaths, setExpandedFolderPaths] = useState<string[]>([RESOURCE_ROOT_PATH]);
  const [selectedFolderPath, setSelectedFolderPath] = useState(RESOURCE_ROOT_PATH);
  const [moveTargetFolderPath, setMoveTargetFolderPath] = useState(RESOURCE_ROOT_PATH);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const themes: { id: CampaignTheme; label: string; icon: React.ReactNode; desc: string }[] = [
    { id: 'default', label: '默认风格', icon: <Monitor size={20} />, desc: '淡雅的紫色调，柔和且适合现代阅读。' },
    { id: 'scroll', label: '复古羊皮纸', icon: <Scroll size={20} />, desc: '温暖的黄色调，带来经典 TRPG 氛围。' },
    { id: 'archive', label: '未来科技', icon: <Archive size={20} />, desc: '高对比度深色调，适合科幻或调查模组。' },
    { id: 'nature', label: '薄巧清新', icon: <Monitor size={20} />, desc: '薄荷绿主调搭配棕色文字与边框，清新耐看。' },
  ];

  const loadResources = async () => {
    try {
      const result = await resourceService.list();
      setResources(result.items);
      setResourceFolders(result.folders);
    } catch {
      setResources([]);
      setResourceFolders([]);
    }
  };

  useEffect(() => {
    loadResources();
  }, []);

  useEffect(() => {
    const allFolderPaths = [RESOURCE_ROOT_PATH, ...resourceFolders.map((folder) => folder.path)];
    if (!allFolderPaths.includes(selectedFolderPath)) {
      setSelectedFolderPath(RESOURCE_ROOT_PATH);
    }
    if (!allFolderPaths.includes(moveTargetFolderPath)) {
      setMoveTargetFolderPath(RESOURCE_ROOT_PATH);
    }
  }, [resourceFolders, selectedFolderPath, moveTargetFolderPath]);

  const folderOptions = useMemo(
    () => flattenResourceFolders(resourceFolders),
    [resourceFolders]
  );

  const resourceTree = useMemo(
    () => buildResourceTree(resourceFolders, resources, resourceKeyword),
    [resourceFolders, resources, resourceKeyword]
  );
  const visibleResourceItems = useMemo(
    () => filterResourceItems(resources, selectedFolderPath, resourceKeyword),
    [resources, selectedFolderPath, resourceKeyword]
  );

  const toggleFolder = (path: string) => {
    if (resourceKeyword.trim()) return;
    setExpandedFolderPaths((prev) => (
      prev.includes(path) ? prev.filter((item) => item !== path) : [...prev, path]
    ));
  };

  const toggleRef = (ref: string) => {
    setSelectedRefs((prev) =>
      prev.includes(ref) ? prev.filter((r) => r !== ref) : [...prev, ref]
    );
  };

  const handleBatchUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setResourceBusy(true);
    try {
      await Promise.all(files.map((file) => resourceService.upload(file, selectedFolderPath)));
      await loadResources();
      if (resourceInputRef.current) resourceInputRef.current.value = '';
    } finally {
      setResourceBusy(false);
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedRefs.length === 0) return;
    if (!confirm(`确定删除选中的 ${selectedRefs.length} 个资源吗？`)) return;
    setResourceBusy(true);
    try {
      await resourceService.deleteMany(selectedRefs);
      setSelectedRefs([]);
      await loadResources();
    } finally {
      setResourceBusy(false);
    }
  };

  const handleCreateFolder = async () => {
    const trimmed = window.prompt('输入新分类名称')?.trim() || '';
    if (!trimmed) return;
    setResourceBusy(true);
    try {
      await resourceService.createFolder(selectedFolderPath === RESOURCE_ROOT_PATH ? trimmed : `${selectedFolderPath}/${trimmed}`);
      const folderPath = selectedFolderPath === RESOURCE_ROOT_PATH ? `${RESOURCE_ROOT_PATH}/${trimmed}` : `${selectedFolderPath}/${trimmed}`;
      setExpandedFolderPaths((prev) => Array.from(new Set([...prev, selectedFolderPath, folderPath])));
      setSelectedFolderPath(folderPath);
      setMoveTargetFolderPath(folderPath);
      await loadResources();
    } finally {
      setResourceBusy(false);
    }
  };

  const handleRenameFolder = async () => {
    if (selectedFolderPath === RESOURCE_ROOT_PATH) return;
    const currentName = selectedFolderPath.split('/').pop() || '';
    const nextName = window.prompt('输入新的分类名称', currentName)?.trim() || '';
    if (!nextName || nextName === currentName) return;
    setResourceBusy(true);
    try {
      await resourceService.renameFolder(selectedFolderPath, nextName);
      const parentPath = selectedFolderPath.split('/').slice(0, -1).join('/') || RESOURCE_ROOT_PATH;
      const nextPath = `${parentPath}/${nextName}`;
      setSelectedFolderPath(nextPath);
      setMoveTargetFolderPath((prev) => (prev === selectedFolderPath ? nextPath : prev));
      setExpandedFolderPaths((prev) => prev.map((item) => (item === selectedFolderPath ? nextPath : item)));
      await loadResources();
    } finally {
      setResourceBusy(false);
    }
  };

  const handleDeleteFolder = async () => {
    if (selectedFolderPath === RESOURCE_ROOT_PATH) return;
    if (!confirm(`确定删除分类「${resourceFolderDisplayName(selectedFolderPath)}」吗？分类下的子分类和图片也会一起删除。`)) {
      return;
    }
    setResourceBusy(true);
    try {
      await resourceService.deleteFolder(selectedFolderPath);
      setSelectedFolderPath(RESOURCE_ROOT_PATH);
      setMoveTargetFolderPath(RESOURCE_ROOT_PATH);
      setExpandedFolderPaths((prev) => prev.filter((item) => item !== selectedFolderPath));
      setSelectedRefs((prev) => prev.filter((ref) => !ref.startsWith(`${selectedFolderPath}/`)));
      await loadResources();
    } finally {
      setResourceBusy(false);
    }
  };

  const handleMoveSelected = async () => {
    if (selectedRefs.length === 0) return;
    setResourceBusy(true);
    try {
      await resourceService.moveMany(selectedRefs, moveTargetFolderPath);
      setSelectedRefs([]);
      await loadResources();
    } finally {
      setResourceBusy(false);
    }
  };

  const currentFolderLabel = resourceFolderDisplayName(selectedFolderPath);

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
        <ReleaseUpdatePanel className="mt-4" />
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
          <div className="mt-4">
            <ImportAssistant />
          </div>
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

      <section className="bg-theme-card p-4 sm:p-6 rounded-lg shadow-sm border border-theme">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <button
            type="button"
            onClick={() => setResourceCollapsed((prev) => !prev)}
            className="text-lg font-medium flex items-center gap-2 text-left"
          >
            {resourceCollapsed ? <ChevronRight size={18} /> : <ChevronDown size={18} />}
            资源管理
          </button>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={loadResources}
              className="px-3 py-2 border border-theme rounded hover:bg-gray-50 flex items-center gap-2"
              disabled={resourceBusy}
            >
              <RefreshCw size={16} />
              刷新
            </button>
            <button
              onClick={handleDeleteSelected}
              disabled={resourceBusy || selectedRefs.length === 0}
              className="px-3 py-2 border border-red-300 text-red-600 rounded hover:bg-red-50 disabled:opacity-50 flex items-center gap-2"
            >
              <Trash2 size={16} />
              删除选中
            </button>
          </div>
        </div>
        {!resourceCollapsed && (
          <>
            <div className="space-y-3">
              <input
                value={resourceKeyword}
                onChange={(e) => setResourceKeyword(e.target.value)}
                placeholder="搜索分类、图片名或路径..."
                className="w-full px-3 py-2 rounded border border-theme bg-transparent"
              />
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                multiple
                ref={resourceInputRef}
                className="hidden"
                onChange={handleBatchUpload}
              />
              <div className="grid grid-cols-1 lg:grid-cols-[240px_minmax(0,1fr)] gap-3">
                <div className="border border-theme rounded overflow-hidden">
                  <div className="px-3 py-2 border-b border-theme bg-theme-card/40 flex flex-wrap items-center gap-1">
                    <button
                      data-tour="settings-resource-upload"
                      onClick={() => resourceInputRef.current?.click()}
                      className="px-2 py-1 text-xs border border-theme rounded hover:bg-gray-50 flex items-center gap-1"
                      disabled={resourceBusy}
                    >
                      <Upload size={13} />
                      上传
                    </button>
                    <button
                      onClick={handleCreateFolder}
                      className="px-2 py-1 text-xs border border-theme rounded hover:bg-gray-50 flex items-center gap-1"
                      disabled={resourceBusy}
                    >
                      <FolderPlus size={13} />
                      新建
                    </button>
                    <button
                      onClick={handleRenameFolder}
                      className="px-2 py-1 text-xs border border-theme rounded hover:bg-gray-50 flex items-center gap-1 disabled:opacity-50"
                      disabled={resourceBusy || selectedFolderPath === RESOURCE_ROOT_PATH}
                    >
                      <Pencil size={13} />
                      重命名
                    </button>
                    <button
                      onClick={handleDeleteFolder}
                      className="px-2 py-1 text-xs border border-red-300 text-red-600 rounded hover:bg-red-50 flex items-center gap-1 disabled:opacity-50"
                      disabled={resourceBusy || selectedFolderPath === RESOURCE_ROOT_PATH}
                    >
                      <FolderX size={13} />
                      删除
                    </button>
                  </div>
                  <div className="max-h-[28rem] overflow-auto">
                    {resources.length === 0 && resourceFolders.length === 0 ? (
                      <div className="p-4 text-sm theme-text-secondary">暂无资源</div>
                    ) : (
                      <ResourceTreeView
                        tree={resourceTree}
                        expandedPaths={expandedFolderPaths}
                        onToggleFolder={toggleFolder}
                        onSelectFolder={setSelectedFolderPath}
                        selectedFolderPath={selectedFolderPath}
                        autoExpandAll={Boolean(resourceKeyword.trim())}
                        hideItems
                        compact
                        renderItem={() => null}
                      />
                    )}
                  </div>
                </div>

                <div className="border border-theme rounded overflow-hidden">
                  <div className="px-3 py-2 border-b border-theme bg-theme-card/40 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-sm truncate">当前分类：{currentFolderLabel}</div>
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        value={moveTargetFolderPath}
                        onChange={(e) => setMoveTargetFolderPath(e.target.value)}
                        className="px-2 py-1.5 text-xs rounded border border-theme bg-theme-card max-w-[220px]"
                      >
                        {folderOptions.map((folder) => (
                          <option key={folder.path} value={folder.path}>
                            {resourceFolderDisplayName(folder.path)}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={handleMoveSelected}
                        disabled={resourceBusy || selectedRefs.length === 0}
                        className="px-2 py-1.5 text-xs border border-theme rounded hover:bg-gray-50 disabled:opacity-50 flex items-center gap-1"
                      >
                        <MoveRight size={13} />
                        移动
                      </button>
                      <button
                        onClick={handleDeleteSelected}
                        disabled={resourceBusy || selectedRefs.length === 0}
                        className="px-2 py-1.5 text-xs border border-red-300 text-red-600 rounded hover:bg-red-50 disabled:opacity-50 flex items-center gap-1"
                      >
                        <Trash2 size={13} />
                        删除
                      </button>
                    </div>
                  </div>
                  <div data-tour="settings-resource-list" className="max-h-[28rem] overflow-auto p-3">
                    {visibleResourceItems.length === 0 ? (
                      <div className="py-10 text-center text-sm theme-text-secondary">当前分类下暂无资源</div>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                        {visibleResourceItems.map((item) => (
                          <label
                            key={item.ref}
                            className={`group border rounded-md p-2 cursor-pointer transition hover:bg-gray-50/40 ${selectedRefs.includes(item.ref) ? 'border-primary ring-2 ring-primary/20' : 'border-theme'}`}
                          >
                            <input
                              type="checkbox"
                              checked={selectedRefs.includes(item.ref)}
                              onChange={() => toggleRef(item.ref)}
                              className="mb-2"
                            />
                            <img
                              src={item.url}
                              alt={item.ref}
                              className="w-full aspect-square rounded object-cover border border-theme"
                            />
                            <div className="mt-2 text-xs truncate" title={item.displayName || item.ref}>
                              {item.displayName || item.ref}
                            </div>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </section>

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
          <div className="mt-4">
            <VersionHistory />
          </div>
        )}
      </section>
    </div>
  );
};

export default Settings;
