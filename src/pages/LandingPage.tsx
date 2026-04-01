import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useCampaign } from '../context/CampaignContext';
import { Trash2, Download, Upload, FolderOpen, Plus, ChevronDown } from 'lucide-react';
import { dataService } from '../services/dataService';
import { GuideHelpButton } from '../components/common/InteractiveGuide';

const LandingPage: React.FC = () => {
  const { 
    user, login, logout, 
    campaignList, switchCampaign, createNewCampaign, 
    importData, openFromFileSystem, deleteCampaign
  } = useCampaign();
  
  const [currentTheme, setCurrentTheme] = useState(localStorage.getItem('trpg_theme') || 'default');

  // Login State
  const [username, setUsername] = useState('');
  const [latency, setLatency] = useState<number | null>(null);
  const [onlinePreview, setOnlinePreview] = useState<boolean | null>(null);
  const users = useMemo(() => {
    const list = dataService.getUsers();
    return [...list].sort((a, b) => (b.lastActive || 0) - (a.lastActive || 0));
  }, []);
  const [historyOpen, setHistoryOpen] = useState(false);
  const historyRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    localStorage.removeItem('trpg_backend_mode');
  }, []);

  const testLatency = useCallback(async () => {
    const t0 = Date.now();
    try {
      const res = await fetch('/api/storage/health', { cache: 'no-store' });
      if (!res.ok) throw new Error('bad');
      const dt = Date.now() - t0;
      setLatency(dt);
      setOnlinePreview(true);
    } catch {
      setOnlinePreview(false);
      setLatency(null);
    }
  }, []);

  useEffect(() => {
    testLatency();
  }, [testLatency]);
  
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!historyRef.current) return;
      if (!historyRef.current.contains(e.target as Node)) {
        setHistoryOpen(false);
      }
    };
    window.addEventListener('mousedown', handler);
    return () => window.removeEventListener('mousedown', handler);
  }, []);

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
      <div className="flex justify-center items-center min-h-screen bg-stone-50">
        <div className="p-8 w-full max-w-md bg-white rounded-lg border shadow-md border-stone-200">
          <h1 className="mb-2 text-3xl font-bold text-center text-gray-800">TRPG 模组笔记</h1>
          <p className="mb-8 text-center text-gray-500">请登录以管理您的模组</p>
          
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block mb-1 text-sm font-medium text-gray-700">用户名 / 昵称</label>
              <div className="relative" ref={historyRef}>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    onFocus={() => setHistoryOpen(true)}
                    className="px-4 py-2 flex-1 rounded-md border border-gray-300 outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    placeholder="请输入您的名字"
                    required
                  />
                  <button
                    type="button"
                    className="px-3 py-2 rounded-md border border-gray-300 bg-white hover:bg-gray-50"
                    onClick={() => setHistoryOpen((v) => !v)}
                    aria-label="展开历史用户"
                  >
                    <ChevronDown size={18} />
                  </button>
                </div>
                {historyOpen && users.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full max-h-56 overflow-auto rounded-md border border-gray-200 bg-white shadow">
                    {users
                      .filter((u) => !username || u.username.toLowerCase().includes(username.toLowerCase()))
                      .map((u) => (
                        <button
                          type="button"
                          key={u.id}
                          onClick={() => {
                            setUsername(u.username);
                            setHistoryOpen(false);
                          }}
                          className="block w-full text-left px-3 py-2 hover:bg-gray-50"
                        >
                          {u.username}
                        </button>
                      ))}
                  </div>
                )}
              </div>
            </div>
            <div className="text-xs text-gray-600">
              {onlinePreview === null ? '' : (
                onlinePreview
                  ? `已连接后端${typeof latency === 'number' ? `（≈${latency}ms）` : ''}`
                  : '后端未连接：数据可能不会被保存，请注意导出 JSON'
              )}
              <button
                type="button"
                className="ml-2 px-2 py-1 border rounded border-gray-300 hover:bg-gray-50"
                onClick={testLatency}
              >
                重新检测
              </button>
            </div>
            
            <button
              type="submit"
              className="py-3 w-full font-medium text-white rounded-md shadow-sm transition-colors bg-primary hover:bg-primary-dark"
            >
              进入系统
            </button>
          </form>
          
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 min-h-screen theme-page">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-4 justify-between items-start mb-8 md:flex-row md:items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">欢迎, {user.username}</h1>
            <p className="mt-1 text-gray-500">
                准备好开启新的冒险了吗？
            </p>
          </div>
          <div className="flex flex-wrap gap-3 items-center">
             <GuideHelpButton guideId="landing" />
             {/* Open Local File */}
             <button 
                onClick={openFromFileSystem}
                className="flex gap-2 items-center px-4 py-2 text-gray-700 bg-white rounded border border-gray-300 shadow-sm hover:bg-gray-50"
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
                className="flex gap-2 items-center px-4 py-2 text-gray-700 bg-white rounded border border-gray-300 shadow-sm hover:bg-gray-50"
            >
                <Upload size={18} />
                <span>导入模组</span>
            </button>
            <button 
                onClick={logout}
                className="ml-2 font-medium text-red-500 hover:text-red-700"
            >
                退出登录
            </button>
          </div>
        </div>

        {/* Theme Selection for Landing Page */}
        <div className="flex gap-2 justify-end mb-6">
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
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3" data-tour="landing-campaign-list">
          {/* Create New Card */}
          <div
               data-tour="landing-create-campaign"
               className="rounded-lg border-2 border-dashed border-theme p-6 flex flex-col items-center justify-center text-center hover:border-primary bg-theme-card transition-colors cursor-pointer min-h-[220px]"
               onClick={() => setIsCreating(true)}
          >
            <div className="flex justify-center items-center mb-4 w-12 h-12 bg-blue-100 rounded-full text-primary">
              <Plus size={24} />
            </div>
            <h3 className="text-lg font-medium">创建新模组</h3>
            <p className="mt-2 text-sm theme-text-secondary">开始一个新的故事</p>
          </div>

          {/* Existing Campaigns */}
          {campaignList.map(campaign => (
            <div key={campaign.id} className="flex flex-col p-6 rounded-lg border shadow-sm transition-shadow theme-card border-theme hover:shadow-md">
              <div className="flex-1">
                <div className="flex justify-between items-start mb-2">
                    <h3 className="pr-2 text-xl font-bold break-words">{campaign.name}</h3>
                </div>
                <p className="theme-text-secondary text-sm line-clamp-3 mb-4 min-h-[3em]">
                  {campaign.description || '暂无描述'}
                </p>
                <div className="text-xs text-gray-400">
                  最后修改: {new Date(campaign.lastModified).toLocaleDateString()}
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-2 pt-4 mt-6 border-t border-theme">
                <button
                  onClick={() => switchCampaign(campaign.id)}
                  className="col-span-2 py-2 mb-2 text-sm font-medium text-white rounded transition-colors bg-primary hover:bg-primary-dark"
                >
                  进入模组
                </button>
                <button
                  onClick={(e) => {
                      e.stopPropagation();
                      const data = dataService.loadCampaign(campaign.id);
                      dataService.exportData(data);
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
          <div className="flex fixed inset-0 z-50 justify-center items-center p-4 bg-black/50">
            <div className="p-6 w-full max-w-md bg-white rounded-lg shadow-xl">
              <h2 className="mb-4 text-xl font-bold text-gray-800">创建新模组</h2>
              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <label className="block mb-1 text-sm font-medium text-gray-700">模组名称</label>
                  <input
                    type="text"
                    value={newCampaignName}
                    onChange={(e) => setNewCampaignName(e.target.value)}
                    className="px-3 py-2 w-full rounded border border-gray-300 outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    placeholder="例如：奈亚拉托提普的面具、龙金之劫"
                    autoFocus
                    required
                  />
                </div>
                <div>
                  <label className="block mb-1 text-sm font-medium text-gray-700">简介</label>
                  <textarea
                    value={newCampaignDesc}
                    onChange={(e) => setNewCampaignDesc(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-primary focus:border-transparent outline-none min-h-[100px]"
                    placeholder="简要描述这个模组的背景..."
                  />
                </div>
                <div className="flex gap-3 justify-end mt-6">
                  <button
                    type="button"
                    onClick={() => setIsCreating(false)}
                    className="px-4 py-2 text-gray-600 rounded hover:bg-gray-100"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-white rounded bg-primary hover:bg-primary-dark"
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
