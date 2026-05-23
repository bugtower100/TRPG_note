import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useCampaign } from '../context/CampaignContext';
import { Trash2, Download, Upload, FolderOpen, Plus, ChevronDown, X } from 'lucide-react';
import { dataService } from '../services/dataService';
import { GuideHelpButton } from '../components/common/InteractiveGuide';
import ReleaseUpdateButton from '../components/common/ReleaseUpdateButton';
import { CampaignConfig, PublicCampaignSummary } from '../types';
import { teamNotesService } from '../services/teamNotesService';
import { campaignAccessService } from '../services/campaignAccessService';
import { APP_VERSION } from '../constants/appVersion';
import { backupService } from '../services/backupService';
import ImportAssistant from './ImportAssistant';
import BackupExportDialog from '../components/common/BackupExportDialog';

const LandingPage: React.FC = () => {
  const { 
    user, login, logout, 
    campaignList, switchCampaign, createNewCampaign, 
    openFromFileSystem, deleteCampaign
  } = useCampaign();
  
  const [currentTheme, setCurrentTheme] = useState(localStorage.getItem('trpg_theme') || 'default');

  // Login State
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [latency, setLatency] = useState<number | null>(null);
  const [onlinePreview, setOnlinePreview] = useState<boolean | null>(null);
  const users = useMemo(() => {
    const list = dataService.getUsers();
    return [...list].sort((a, b) => (b.lastActive || 0) - (a.lastActive || 0));
  }, []);
  const [historyOpen, setHistoryOpen] = useState(false);
  const historyRef = useRef<HTMLDivElement>(null);
  const passwordMenuRef = useRef<HTMLDivElement>(null);

  // Create Campaign State
  const [isCreating, setIsCreating] = useState(false);
  const [newCampaignName, setNewCampaignName] = useState('');
  const [newCampaignDesc, setNewCampaignDesc] = useState('');
  const [campaignConfigs, setCampaignConfigs] = useState<Record<string, CampaignConfig>>({});
  const [savingConfigId, setSavingConfigId] = useState<string | null>(null);
  const [publicCampaigns, setPublicCampaigns] = useState<PublicCampaignSummary[]>([]);
  const [loginPassword, setLoginPassword] = useState('');
  const [confirmLoginPassword, setConfirmLoginPassword] = useState('');
  const [passwordConfigured, setPasswordConfigured] = useState(false);
  const [passwordStatus, setPasswordStatus] = useState('');
  const [passwordMenuOpen, setPasswordMenuOpen] = useState(false);
  const [importAssistantOpen, setImportAssistantOpen] = useState(false);
  const [exportDialogTarget, setExportDialogTarget] = useState<{ type: 'all' } | { type: 'campaign'; campaignId: string } | null>(null);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (username.trim()) {
      const result = login(username.trim(), password);
      if (!result.success) {
        setLoginError(result.message || '登录失败');
        return;
      }
      setPassword('');
      setLoginError('');
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
    if (!user || campaignList.length === 0) {
      setCampaignConfigs({});
    } else {
      Promise.all(
        campaignList.map(async (campaign) => {
          const config = await teamNotesService.updateConfig(campaign.id, user, {
            name: campaign.name,
            description: campaign.description,
            lastModified: campaign.lastModified,
          });
          return [campaign.id, config] as const;
        })
      ).then((entries) => {
        setCampaignConfigs(Object.fromEntries(entries));
      }).catch(() => void 0);
    }
  }, [campaignList, user]);

  useEffect(() => {
    if (!user) {
      setPublicCampaigns([]);
      return;
    }
    teamNotesService.listPublicCampaigns(user)
      .then((items) => {
        setPublicCampaigns(items.filter((item) => item.ownerId !== user.id));
      })
      .catch(() => void 0);
  }, [campaignList, user]);

  useEffect(() => {
    setPasswordConfigured(Boolean(user?.passwordConfigured));
    setLoginPassword('');
    setConfirmLoginPassword('');
    setPasswordStatus('');
    setPasswordMenuOpen(false);
  }, [user]);
  
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (historyRef.current && !historyRef.current.contains(target)) {
        setHistoryOpen(false);
      }
      if (passwordMenuRef.current && !passwordMenuRef.current.contains(target)) {
        setPasswordMenuOpen(false);
      }
    };
    window.addEventListener('mousedown', handler);
    return () => window.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (!importAssistantOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [importAssistantOpen]);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (newCampaignName.trim()) {
      createNewCampaign(newCampaignName, newCampaignDesc);
    }
  };

  const handleExportAllBackups = async (includeAssets: boolean) => {
    try {
      await backupService.exportAll(user, includeAssets);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : '全量备份导出失败');
    }
  };

  const handleExportCampaignBackup = async (campaignId: string, includeAssets: boolean) => {
    try {
      await backupService.exportCampaign(campaignId, user, includeAssets);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : '单模组备份导出失败');
    }
  };

  const handleExportSelection = async (includeAssets: boolean) => {
    const target = exportDialogTarget;
    setExportDialogTarget(null);
    if (!target) return;
    if (target.type === 'all') {
      await handleExportAllBackups(includeAssets);
      return;
    }
    await handleExportCampaignBackup(target.campaignId, includeAssets);
  };

  const handleSaveCampaignConfig = async (campaignId: string) => {
    if (!user) return;
    const current = campaignConfigs[campaignId];
    if (!current) return;
    setSavingConfigId(campaignId);
    try {
      const next = await teamNotesService.updateConfig(campaignId, user, {
        name: campaignList.find((campaign) => campaign.id === campaignId)?.name,
        description: campaignList.find((campaign) => campaign.id === campaignId)?.description,
        lastModified: campaignList.find((campaign) => campaign.id === campaignId)?.lastModified,
        visibility: current.visibility,
        ...(current.joinPasswordConfigured ? {} : {}),
      });
      setCampaignConfigs((prev) => ({ ...prev, [campaignId]: next }));
    } finally {
      setSavingConfigId(null);
    }
  };

  const handleUpdateJoinPassword = async (campaignId: string) => {
    if (!user) return;
    const current = campaignConfigs[campaignId];
    const input = window.prompt(
      current?.joinPasswordConfigured
        ? '输入新的进入密码。留空并确认后可清除进入密码。'
        : '输入公开模组进入密码。留空表示不设置密码。',
      ''
    );
    if (input === null) return;
    const normalized = input.trim();
    try {
      const next = await teamNotesService.updateConfig(campaignId, user, {
        joinPassword: normalized,
        clearJoinPassword: normalized === '',
      });
      setCampaignConfigs((prev) => ({ ...prev, [campaignId]: next }));
      if (normalized === '') {
        campaignAccessService.clearPassword(campaignId);
      }
      window.alert(normalized ? '进入密码已更新。' : '进入密码已清除。');
    } catch (error) {
      window.alert(error instanceof Error ? error.message : '进入密码保存失败');
    }
  };

  const ensurePublicCampaignAccess = async (campaign: PublicCampaignSummary): Promise<boolean> => {
    if (!user) return false;
    let passwordText = campaignAccessService.getPassword(campaign.id);
    if (campaign.hasJoinPassword && !passwordText) {
      const input = window.prompt(`"${campaign.name}" 需要进入密码，请输入：`, '');
      if (input === null) return false;
      passwordText = input.trim();
      campaignAccessService.setPassword(campaign.id, passwordText);
    }
    try {
      await teamNotesService.getConfig(campaign.id, user);
      return true;
    } catch (error) {
      campaignAccessService.clearPassword(campaign.id);
      const message = error instanceof Error ? error.message : '进入模组失败';
      if (message.includes('进入密码')) {
        const retry = window.prompt(`"${campaign.name}" 的进入密码不正确，请重新输入：`, '');
        if (retry === null) return false;
        campaignAccessService.setPassword(campaign.id, retry.trim());
        try {
          await teamNotesService.getConfig(campaign.id, user);
          return true;
        } catch (retryError) {
          campaignAccessService.clearPassword(campaign.id);
          window.alert(retryError instanceof Error ? retryError.message : '进入模组失败');
          return false;
        }
      }
      window.alert(message);
      return false;
    }
  };

  const handleRemoveMember = async (campaignId: string, memberUserId: string) => {
    if (!user) return;
    if (!window.confirm('确定要将该 PL 从成员列表中移除吗？之后对方再次进入公开模组时会重新加入。')) return;
    try {
      const next = await teamNotesService.removeMember(campaignId, memberUserId, user);
      setCampaignConfigs((prev) => ({ ...prev, [campaignId]: next }));
    } catch (error) {
      window.alert(error instanceof Error ? error.message : '移除成员失败');
    }
  };

  const handleSaveLoginPassword = () => {
    if (!user) return;
    if (loginPassword !== confirmLoginPassword) {
      setPasswordStatus('两次输入的密码不一致。');
      return;
    }
    const updated = dataService.updateUserPassword(user.id, loginPassword);
    if (!updated) {
      setPasswordStatus('密码保存失败，请重新登录后再试。');
      return;
    }
    setPasswordConfigured(Boolean(updated.passwordConfigured));
    setLoginPassword('');
    setConfirmLoginPassword('');
    setPasswordStatus(updated.passwordConfigured ? '登录密码已更新。' : '已清除登录密码，后续可直接空密码登录。');
    setPasswordMenuOpen(false);
  };

  const handleEnterCampaign = async (
    campaign: { id: string; name: string; description: string; lastModified: number; ownerId: string; visibility?: CampaignConfig['visibility'] },
    options?: { requiresJoinPassword?: boolean }
  ) => {
    if (options) {
      const accessGranted = await ensurePublicCampaignAccess({
        id: campaign.id,
        name: campaign.name,
        description: campaign.description,
        lastModified: campaign.lastModified,
        ownerId: campaign.ownerId,
        ownerUsername: '',
        visibility: campaign.visibility || 'public',
        memberCount: 0,
        onlineMemberCount: 0,
        hasJoinPassword: Boolean(options.requiresJoinPassword),
      });
      if (!accessGranted) return;
    }
    dataService.ensureCampaignSummary({
      id: campaign.id,
      name: campaign.name,
      description: campaign.description,
      lastModified: campaign.lastModified,
      ownerId: campaign.ownerId,
      visibility: campaign.visibility,
      schemaVersion: 2,
    });
    switchCampaign(campaign.id);
  };

  const getMemberSummary = (config?: CampaignConfig) => {
    const members = config?.members || [];
    const now = Date.now();
    const onlineMembers = members.filter((member) => now - member.lastActiveAt < 5 * 60 * 1000);
    return {
      members,
      onlineMembers,
      previewMembers: members,
      extraCount: 0,
    };
  };

  if (!user) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-stone-50">
        <div className="p-8 w-full max-w-md bg-white rounded-lg border shadow-md border-stone-200">
          <h1 className="mb-2 text-3xl font-bold text-center text-gray-800">TRPG 模组笔记</h1>
          <p className="mb-2 text-center text-gray-500">{APP_VERSION}</p>
          <p className="mb-6 text-center text-gray-500">请登录以管理您的模组</p>
          <div className="mb-2 flex justify-center">
          </div>
          
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
            <div>
              <label className="block mb-1 text-sm font-medium text-gray-700">登录密码</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="px-4 py-2 w-full rounded-md border border-gray-300 outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="未设置密码时可留空"
              />
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
            {loginError && (
              <div className="text-sm text-red-600">{loginError}</div>
            )}
            
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
            <h1 className="text-3xl font-bold text-theme-primary">欢迎, {user.username}</h1>
            <p className="mt-1 theme-text-secondary">
                准备好开启新的冒险了吗？
            </p>
          </div>
          <div className="flex flex-wrap gap-3 items-center">
             <ReleaseUpdateButton />
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
            <button 
                onClick={() => setImportAssistantOpen(true)}
                className="flex gap-2 items-center px-4 py-2 text-gray-700 bg-white rounded border border-gray-300 shadow-sm hover:bg-gray-50"
                title="打开导入助手"
            >
                <Upload size={18} />
                <span>导入助手</span>
            </button>
            <button
                onClick={() => setExportDialogTarget({ type: 'all' })}
                className="flex gap-2 items-center px-4 py-2 text-gray-700 bg-white rounded border border-gray-300 shadow-sm hover:bg-gray-50"
                title="导出当前账号下的所有模组备份包"
            >
                <Download size={18} />
                <span>导出所有模组</span>
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
            <div className="relative" ref={passwordMenuRef}>
                <button
                    type="button"
                    onClick={() => {
                        setPasswordMenuOpen((prev) => !prev);
                        setPasswordStatus('');
                    }}
                    className="px-3 py-1 text-sm border rounded bg-white text-gray-600 border-gray-300 hover:bg-gray-50 inline-flex items-center gap-1"
                >
                    账号
                    <ChevronDown size={16} className={`transition-transform ${passwordMenuOpen ? 'rotate-180' : ''}`} />
                </button>
                {passwordMenuOpen && (
                    <div className="absolute right-0 z-20 mt-2 w-[300px] rounded-lg border border-theme theme-card shadow-lg p-3">
                        <div className="mb-2">
                            <div className="text-sm font-semibold">登录密码</div>
                            <div className="text-[11px] theme-text-secondary">
                                {passwordConfigured ? '已设置，可修改或清除' : '未设置，留空即可登录'}
                            </div>
                        </div>
                        <div className="space-y-2">
                            <input
                                type="password"
                                value={loginPassword}
                                onChange={(e) => setLoginPassword(e.target.value)}
                                className="w-full px-3 py-2 text-sm border border-theme rounded-md bg-transparent"
                                placeholder="新密码，留空表示清除"
                            />
                            <input
                                type="password"
                                value={confirmLoginPassword}
                                onChange={(e) => setConfirmLoginPassword(e.target.value)}
                                className="w-full px-3 py-2 text-sm border border-theme rounded-md bg-transparent"
                                placeholder="再次输入密码"
                            />
                            <div className="flex items-center justify-between gap-2 pt-1">
                                <div className="text-[11px] theme-text-secondary">无需创建模组也可设置</div>
                                <button
                                    type="button"
                                    onClick={handleSaveLoginPassword}
                                    className="px-3 py-1.5 text-sm bg-primary text-white rounded hover:bg-primary-dark"
                                >
                                    保存
                                </button>
                            </div>
                            {passwordStatus && <div className="text-xs theme-text-secondary">{passwordStatus}</div>}
                        </div>
                    </div>
                )}
            </div>
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
                    {t === 'default' ? '默认' : t === 'scroll' ? '羊皮纸' : t === 'archive' ? '未来' : '薄巧'}
                </button>
            ))}
        </div>

        {/* Campaign List */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3" data-tour="landing-campaign-list">
          {/* Create New Card */}
          <div
               data-tour="landing-create-campaign"
               className="rounded-lg border-2 border-dashed border-theme p-5 flex flex-col items-center justify-center text-center hover:border-primary bg-theme-card transition-colors cursor-pointer min-h-[180px]"
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
            <div key={campaign.id} data-tour="landing-campaign-card" className="flex flex-col p-4 rounded-lg border shadow-sm transition-shadow theme-card border-theme hover:shadow-md">
              {(() => {
                const config = campaignConfigs[campaign.id];
                const { members, onlineMembers, previewMembers, extraCount } = getMemberSummary(config);
                return (
                  <>
              <div className="flex-1">
                <div className="flex justify-between items-start mb-1">
                    <h3 className="pr-2 text-lg font-bold break-words">{campaign.name}</h3>
                </div>
                <p className="theme-text-secondary text-sm line-clamp-2 mb-3 min-h-[2.5em]">
                  {campaign.description || '暂无描述'}
                </p>
                <div className="flex items-center gap-2 flex-wrap mb-2 text-xs">
                  <span className={`px-2 py-1 rounded border ${config?.visibility === 'public' ? 'border-green-300 text-green-700 bg-green-50' : 'border-theme theme-text-secondary bg-theme-card'}`}>
                    {config?.visibility === 'public' ? '公开模组' : '私密模组'}
                  </span>
                  {config?.joinPasswordConfigured && (
                    <span className="px-2 py-1 rounded border border-amber-300 text-amber-700 bg-amber-50">
                      已设进入密码
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between gap-2 text-xs text-gray-400">
                  <span>最后修改: {new Date(campaign.lastModified).toLocaleDateString()}</span>
                  <span>在线 {onlineMembers.length} / {members.length || 1}</span>
                </div>
                <div data-tour="landing-campaign-members" className="mt-3 border border-theme rounded p-2.5 bg-theme-card/60">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="text-xs font-semibold theme-text-secondary">成员列表</div>
                    <div className="text-[11px] theme-text-secondary">可移除 PL</div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {previewMembers.length > 0 ? previewMembers.map((member) => {
                      const online = onlineMembers.some((item) => item.userId === member.userId);
                      return (
                        <span
                          key={member.userId}
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] border ${
                            online
                              ? 'border-green-300 text-green-700 bg-green-50'
                              : 'border-theme theme-text-secondary'
                          }`}
                        >
                          {member.username} · {member.role}
                          {member.role === 'PL' && (
                            <button
                              type="button"
                              onClick={() => void handleRemoveMember(campaign.id, member.userId)}
                              className="ml-1 text-red-500 hover:text-red-700"
                              title="移除该 PL"
                            >
                              ×
                            </button>
                          )}
                        </span>
                      );
                    }) : (
                      <span className="text-[11px] theme-text-secondary">暂无成员信息</span>
                    )}
                    {extraCount > 0 && (
                      <span className="px-2 py-1 rounded-full text-[11px] border border-theme theme-text-secondary">
                        +{extraCount} 人
                      </span>
                    )}
                  </div>
                </div>
                <div data-tour="landing-campaign-access" className="mt-3 space-y-2 border border-theme rounded p-2.5 bg-theme-card/60">
                  <div className="text-xs font-semibold theme-text-secondary">访问控制</div>
                  <select
                    value={config?.visibility || 'private'}
                    onChange={(e) => setCampaignConfigs((prev) => ({
                      ...prev,
                      [campaign.id]: {
                        ...(prev[campaign.id] || {
                          campaignId: campaign.id,
                          visibility: 'private',
                          ownerUserId: user.id,
                          schemaVersion: 2,
                          members: [],
                          createdAt: Date.now(),
                          updatedAt: Date.now(),
                        }),
                        visibility: e.target.value as CampaignConfig['visibility'],
                      },
                    }))}
                    className="w-full px-3 py-1.5 border border-theme rounded bg-transparent text-sm"
                  >
                    <option value="private">私密模组</option>
                    <option value="public">公开模组</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => handleSaveCampaignConfig(campaign.id)}
                    disabled={savingConfigId === campaign.id}
                    className="w-full px-3 py-1.5 rounded bg-primary text-white hover:bg-primary-dark disabled:opacity-60 text-sm"
                  >
                    保存公开设置
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleUpdateJoinPassword(campaign.id)}
                    className="w-full px-3 py-1.5 rounded border border-theme hover:bg-primary-light text-sm"
                  >
                    {config?.joinPasswordConfigured ? '修改进入密码' : '设置进入密码'}
                  </button>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-2 pt-3 mt-4 border-t border-theme">
                <button
                  onClick={() => handleEnterCampaign(campaign)}
                  className="col-span-2 py-2 mb-1 text-sm font-medium text-white rounded transition-colors bg-primary hover:bg-primary-dark"
                >
                  进入模组
                </button>
                <button
                  onClick={(e) => {
                      e.stopPropagation();
                      setExportDialogTarget({ type: 'campaign', campaignId: campaign.id });
                  }}
                  className="flex items-center justify-center gap-1 py-1.5 border border-gray-200 text-gray-600 rounded hover:bg-gray-50 text-xs"
                  title="导出备份包"
                >
                  <Download size={14} /> 备份
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
                  </>
                );
              })()}
            </div>
          ))}
        </div>

        {publicCampaigns.length > 0 && (
          <div className="mt-8">
            <div className="mb-3">
              <h3 className="text-lg font-semibold">公开模组</h3>
              <p className="text-sm theme-text-secondary">这里显示其他用户公开出来的模组，你可以直接进入并加入协作。</p>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {publicCampaigns.map((campaign) => (
                <div key={campaign.id} className="flex flex-col p-4 rounded-lg border shadow-sm transition-shadow theme-card border-theme hover:shadow-md">
                  <div className="flex-1">
                    <div className="flex justify-between items-start mb-1 gap-2">
                      <h3 className="pr-2 text-lg font-bold break-words">{campaign.name || '未命名公开模组'}</h3>
                      <div className="flex flex-wrap items-center justify-end gap-1">
                        <span className="px-2 py-1 rounded border border-green-300 text-green-700 bg-green-50 text-xs">公开模组</span>
                        {campaign.hasJoinPassword && (
                          <span className="px-2 py-1 rounded border border-amber-300 text-amber-700 bg-amber-50 text-xs">需要密码</span>
                        )}
                      </div>
                    </div>
                    <p className="theme-text-secondary text-sm line-clamp-2 mb-3 min-h-[2.5em]">
                      {campaign.description || '暂无描述'}
                    </p>
                    <div className="flex items-center justify-between gap-2 text-xs text-gray-400">
                      <span>最后修改: {new Date(campaign.lastModified || Date.now()).toLocaleDateString()}</span>
                      <span>在线 {campaign.onlineMemberCount} / {campaign.memberCount}</span>
                    </div>
                    <div className="mt-3 text-xs theme-text-secondary">拥有者：{campaign.ownerUsername || campaign.ownerId}</div>
                  </div>
                  <div className="pt-3 mt-4 border-t border-theme">
                    <button
                      onClick={() => handleEnterCampaign(campaign, { requiresJoinPassword: Boolean(campaign.hasJoinPassword) })}
                      className="w-full py-2 text-sm font-medium text-white rounded transition-colors bg-primary hover:bg-primary-dark"
                    >
                      进入公开模组
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

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

        {importAssistantOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={() => setImportAssistantOpen(false)}
          >
            <div
              className="w-full max-w-6xl max-h-[90vh] overflow-y-auto rounded-xl border border-theme theme-card shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-theme theme-card px-5 py-4">
                <div>
                  <h2 className="text-xl font-bold text-theme-primary">导入助手</h2>
                  <p className="mt-1 text-sm theme-text-secondary">
                    可直接从主页导入新版备份包；旧版 JSON 兼容导入仍在设置页中提供。
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setImportAssistantOpen(false)}
                  className="rounded border border-theme p-2 theme-text-secondary hover:bg-gray-50"
                  aria-label="关闭导入助手"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="p-5">
                <ImportAssistant allowLegacyJsonImport={false} />
              </div>
            </div>
          </div>
        )}

        <BackupExportDialog
          open={Boolean(exportDialogTarget)}
          title={exportDialogTarget?.type === 'all' ? '选择全量备份方式' : '选择模组备份方式'}
          description={
            exportDialogTarget?.type === 'all'
              ? '完整备份会把图片资源一起打包，轻量备份只保留文字与结构数据。'
              : '完整备份会把这个模组引用到的图片资源一起打包，轻量备份只保留文字与结构数据。'
          }
          onSelect={(includeAssets) => void handleExportSelection(includeAssets)}
          onCancel={() => setExportDialogTarget(null)}
        />
      </div>
    </div>
  );
};

export default LandingPage;
