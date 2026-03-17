import React, { useState } from 'react';
import { useCampaign } from '../context/CampaignContext';
import { Trash2, Download, Upload, FolderOpen, Plus } from 'lucide-react';

const LandingPage: React.FC = () => {
  const { 
    user, login, logout, 
    campaignList, switchCampaign, createNewCampaign, 
    importData, openFromFileSystem, deleteCampaign
  } = useCampaign();
  
  const [currentTheme, setCurrentTheme] = useState(localStorage.getItem('trpg_theme') || 'default');

  // Login State
  const [username, setUsername] = useState('');

  // Create Campaign State
  const [isCreating, setIsCreating] = useState(false);
  const [newCampaignName, setNewCampaignName] = useState('');
  const [newCampaignDesc, setNewCampaignDesc] = useState('');

  // Import State
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (username.trim()) {
      login(username);
    }
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (newCampaignName.trim()) {
      createNewCampaign(newCampaignName, newCampaignDesc);
    }
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
       importData(file);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <div className="max-w-md w-full bg-white p-8 rounded-lg shadow-md border border-stone-200">
          <h1 className="text-3xl font-bold text-center text-gray-800 mb-2">TRPG 模组笔记</h1>
          <p className="text-center text-gray-500 mb-8">请登录以管理您的模组</p>
          
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">用户名 / 昵称</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                placeholder="请输入您的名字"
                required
              />
            </div>
            
            <button
              type="submit"
              className="w-full py-3 bg-primary text-white rounded-md hover:bg-primary-dark transition-colors font-medium shadow-sm"
            >
              进入系统
            </button>
          </form>
          
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen theme-page p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">欢迎, {user.username}</h1>
            <p className="text-gray-500 mt-1">
                准备好开启新的冒险了吗？
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
             {/* Open Local File */}
             <button 
                onClick={openFromFileSystem}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded hover:bg-gray-50 text-gray-700 shadow-sm"
                title="直接打开本地 JSON 文件"
            >
                <FolderOpen size={18} />
                <span>打开本地文件</span>
            </button>

             {/* Import Button */}
             <input
                type="file"
                accept=".json"
                ref={fileInputRef}
                onChange={handleImport}
                className="hidden"
              />
            <button 
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded hover:bg-gray-50 text-gray-700 shadow-sm"
            >
                <Upload size={18} />
                <span>导入模组</span>
            </button>
            <button 
                onClick={logout}
                className="text-red-500 hover:text-red-700 font-medium ml-2"
            >
                退出登录
            </button>
          </div>
        </div>

        {/* Theme Selection for Landing Page */}
        <div className="mb-6 flex justify-end gap-2">
            {['default', 'scroll', 'archive', 'nature'].map((t) => (
                <button
                    key={t}
                    onClick={() => {
                        localStorage.setItem('trpg_theme', t);
                        document.documentElement.setAttribute('data-theme', t);
                        setCurrentTheme(t);
                    }}
                    className={`px-3 py-1 text-sm border rounded ${
                        currentTheme === t 
                            ? 'bg-primary text-white border-primary' 
                            : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                    }`}
                >
                    {t === 'default' ? '默认' : t === 'scroll' ? '羊皮纸' : t === 'archive' ? '未来' : '自然'}
                </button>
            ))}
        </div>

        {/* Campaign List */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Create New Card */}
          <div className="rounded-lg border-2 border-dashed border-theme p-6 flex flex-col items-center justify-center text-center hover:border-primary bg-theme-card transition-colors cursor-pointer min-h-[220px]"
               onClick={() => setIsCreating(true)}
          >
            <div className="w-12 h-12 rounded-full bg-blue-100 text-primary flex items-center justify-center mb-4">
              <Plus size={24} />
            </div>
            <h3 className="text-lg font-medium">创建新模组</h3>
            <p className="text-sm theme-text-secondary mt-2">开始一个新的故事</p>
          </div>

          {/* Existing Campaigns */}
          {campaignList.map(campaign => (
            <div key={campaign.id} className="theme-card rounded-lg shadow-sm border border-theme p-6 flex flex-col hover:shadow-md transition-shadow">
              <div className="flex-1">
                <div className="flex justify-between items-start mb-2">
                    <h3 className="text-xl font-bold break-words pr-2">{campaign.name}</h3>
                </div>
                <p className="theme-text-secondary text-sm line-clamp-3 mb-4 min-h-[3em]">
                  {campaign.description || '暂无描述'}
                </p>
                <div className="text-xs text-gray-400">
                  最后修改: {new Date(campaign.lastModified).toLocaleDateString()}
                </div>
              </div>
              
              <div className="mt-6 pt-4 border-t border-theme grid grid-cols-2 gap-2">
                <button
                  onClick={() => switchCampaign(campaign.id)}
                  className="col-span-2 py-2 bg-primary text-white rounded hover:bg-primary-dark transition-colors text-sm font-medium mb-2"
                >
                  进入模组
                </button>
                <button
                  onClick={(e) => {
                      e.stopPropagation();
                      // We need to implement export by ID in service, or just load and export.
                      // For simplicity, switch then export is weird.
                      // Ideally dataService.exportCampaign(id).
                      // But Context only has exportData for current.
                      // Workaround: We can't easily export non-active campaign without loading it.
                      // Let's rely on loading it first? No, user wants "Quick Export".
                      // I'll add a quick export if possible, but context doesn't support it yet.
                      // Let's just disable this button or load-then-export?
                      // Actually, let's just implement a quick helper in this component or context?
                      // I will skip 'Quick Export' from list for now and only keep Delete, or
                      // I can assume switchCampaign is fast.
                      // Wait, the requirement says "One-click share (export)".
                      // I'll add a context method `exportCampaignById`?
                      // Or just allow user to enter -> export.
                      // Let's add the button but maybe make it just switch and open settings?
                      // No, let's try to export directly.
                      // I'll add a small hack: Load data synchronously from local storage and export.
                      // But I don't have access to dataService directly here? I do via context? No.
                      // I should expose `dataService` or a helper.
                      // Let's just put "Delete" here and "Export" inside for now, OR
                      // Implement a simple export logic here using localStorage key.
                      const key = `trpg_campaign_${campaign.id}`;
                      const stored = localStorage.getItem(key);
                      if (stored) {
                          const data = JSON.parse(stored);
                          const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data, null, 2));
                          const anchor = document.createElement('a');
                          anchor.href = dataStr;
                          anchor.download = `${data.meta.projectName || 'campaign'}.json`;
                          document.body.appendChild(anchor);
                          anchor.click();
                          anchor.remove();
                      }
                  }}
                  className="flex items-center justify-center gap-1 py-1.5 border border-gray-200 text-gray-600 rounded hover:bg-gray-50 text-xs"
                  title="导出 JSON"
                >
                  <Download size={14} /> 导出
                </button>
                <button
                  onClick={(e) => {
                      e.stopPropagation();
                      deleteCampaign(campaign.id);
                  }}
                  className="flex items-center justify-center gap-1 py-1.5 border border-red-200 text-red-600 rounded hover:bg-red-50 text-xs"
                  title="删除模组"
                >
                  <Trash2 size={14} /> 删除
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Create Modal */}
        {isCreating && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4">创建新模组</h2>
              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">模组名称</label>
                  <input
                    type="text"
                    value={newCampaignName}
                    onChange={(e) => setNewCampaignName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                    placeholder="例如：奈亚拉托提普的面具、龙金之劫"
                    autoFocus
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">简介</label>
                  <textarea
                    value={newCampaignDesc}
                    onChange={(e) => setNewCampaignDesc(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-primary focus:border-transparent outline-none min-h-[100px]"
                    placeholder="简要描述这个模组的背景..."
                  />
                </div>
                <div className="flex justify-end gap-3 mt-6">
                  <button
                    type="button"
                    onClick={() => setIsCreating(false)}
                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-primary text-white rounded hover:bg-primary-dark"
                  >
                    创建
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LandingPage;
