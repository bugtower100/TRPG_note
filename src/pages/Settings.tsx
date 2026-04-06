import React, { useEffect, useRef, useState } from 'react';
import { useCampaign } from '../context/CampaignContext';
import { CampaignTheme } from '../types';
import { FileJson, Upload, Monitor, Scroll, Archive, Trash2, RefreshCw, ChevronDown, ChevronRight } from 'lucide-react';
import { resourceService, ResourceItem } from '../services/resourceService';

const Settings: React.FC = () => {
  const { 
    exportData, importData,
    theme, setTheme
  } = useCampaign();
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const resourceInputRef = useRef<HTMLInputElement>(null);
  const [resources, setResources] = useState<ResourceItem[]>([]);
  const [selectedRefs, setSelectedRefs] = useState<string[]>([]);
  const [resourceBusy, setResourceBusy] = useState(false);
  const [resourceCollapsed, setResourceCollapsed] = useState(false);

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (confirm('导入数据将覆盖当前模组。是否继续？')) {
        await importData(file);
      }
      // Reset input
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const themes: { id: CampaignTheme; label: string; icon: React.ReactNode; desc: string }[] = [
    { id: 'default', label: '默认风格', icon: <Monitor size={20} />, desc: '淡雅的紫色调，柔和且适合现代阅读。' },
    { id: 'scroll', label: '复古羊皮纸', icon: <Scroll size={20} />, desc: '温暖的黄色调，带来经典 TRPG 氛围。' },
    { id: 'archive', label: '未来科技', icon: <Archive size={20} />, desc: '高对比度深色调，适合科幻或调查模组。' },
    { id: 'nature', label: '薄巧清新', icon: <Monitor size={20} />, desc: '薄荷绿主调搭配棕色文字与边框，清新耐看。' },
  ];

  const loadResources = async () => {
    try {
      const list = await resourceService.list();
      setResources(list);
    } catch {
      setResources([]);
    }
  };

  useEffect(() => {
    loadResources();
  }, []);

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
      await Promise.all(files.map((file) => resourceService.upload(file)));
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

      {/* Data Management */}
      <section className="bg-theme-card p-4 sm:p-6 rounded-lg shadow-sm border border-theme">
        <h3 className="text-lg font-medium mb-4">数据管理</h3>
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 border border-theme rounded">
            <div>
              <h4 className="font-medium">导出 JSON 副本</h4>
              <p className="text-sm theme-text-secondary">下载当前模组的快照文件。</p>
            </div>
            <button
              onClick={exportData}
              className="px-4 py-2 bg-theme-card border border-theme rounded hover:bg-gray-50 flex items-center gap-2"
            >
              <FileJson size={16} />
              导出
            </button>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 border border-theme rounded">
            <div>
              <h4 className="font-medium">导入 JSON</h4>
              <p className="text-sm theme-text-secondary">从 JSON 文件恢复模组数据 (覆盖当前)。</p>
            </div>
            <div>
              <input
                type="file"
                accept=".json"
                ref={fileInputRef}
                onChange={handleImport}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 bg-theme-card border border-theme rounded hover:bg-gray-50 flex items-center gap-2"
              >
                <Upload size={16} />
                导入
              </button>
            </div>
          </div>
        </div>
      </section>

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
        <div className="mb-3">
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            multiple
            ref={resourceInputRef}
            className="hidden"
            onChange={handleBatchUpload}
          />
          <button
            data-tour="settings-resource-upload"
            onClick={() => resourceInputRef.current?.click()}
            className="w-full sm:w-auto px-4 py-2 bg-theme-card border border-theme rounded hover:bg-gray-50 flex items-center justify-center gap-2"
            disabled={resourceBusy}
          >
            <Upload size={16} />
            批量上传图片
          </button>
        </div>
        <div data-tour="settings-resource-list" className="border border-theme rounded max-h-[60vh] md:max-h-72 overflow-auto">
          {resources.length === 0 ? (
            <div className="p-4 text-sm theme-text-secondary">暂无资源</div>
          ) : (
            <div className="divide-y divide-theme">
              {resources.map((item) => (
                <label key={item.ref} className="flex items-center gap-3 p-3 hover:bg-gray-50/40 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedRefs.includes(item.ref)}
                    onChange={() => toggleRef(item.ref)}
                  />
                  <img
                    src={item.url}
                    alt={item.ref}
                    className="w-10 h-10 rounded object-cover border border-theme"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm truncate">{item.displayName || item.ref}</div>
                    <div className="text-[11px] theme-text-secondary truncate">{item.ref}</div>
                    <div className="text-xs theme-text-secondary">
                      {(item.size / 1024).toFixed(1)} KB · {new Date(item.updatedAt).toLocaleString()}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>
          </>
        )}
      </section>
    </div>
  );
};

export default Settings;
