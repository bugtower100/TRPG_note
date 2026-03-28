import React, { useRef } from 'react';
import { useCampaign } from '../context/CampaignContext';
import { CampaignTheme } from '../types';
import { FileJson, Upload, Monitor, Scroll, Archive } from 'lucide-react';

const Settings: React.FC = () => {
  const { 
    exportData, importData,
    theme, setTheme
  } = useCampaign();
  
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    { id: 'default', label: '默认风格', icon: <Monitor size={20} />, desc: '简洁的蓝白配色，适合现代阅读。' },
    { id: 'scroll', label: '复古羊皮纸', icon: <Scroll size={20} />, desc: '温暖的黄色调，带来经典 TRPG 氛围。' },
    { id: 'archive', label: '未来科技', icon: <Archive size={20} />, desc: '高对比度深色调，适合科幻或调查模组。' },
    { id: 'nature', label: '自然护眼', icon: <Monitor size={20} />, desc: '柔和的绿色调，保护视力。' },
  ];

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold">数据与设置</h2>

      {/* Theme Selection */}
      <section className="bg-theme-card p-6 rounded-lg shadow-sm border border-theme">
        <h3 className="text-lg font-medium mb-4">界面风格</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
      <section className="bg-theme-card p-6 rounded-lg shadow-sm border border-theme">
        <h3 className="text-lg font-medium mb-4">数据管理</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 border border-theme rounded">
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

          <div className="flex items-center justify-between p-4 border border-theme rounded">
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
    </div>
  );
};

export default Settings;
