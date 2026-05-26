import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useCampaignSession, useCampaignTheme } from '../context/CampaignContext';
import { Download, Upload, FolderOpen, Plus, ChevronDown } from 'lucide-react';
import { dataService } from '../services/dataService';
import { GuideHelpButton } from '../components/common/InteractiveGuide';
import ReleaseUpdateButton from '../components/common/ReleaseUpdateButton';
import { CampaignConfig } from '../types';
import { APP_VERSION } from '../constants/appVersion';
import { backupService } from '../services/backupService';
import BackupExportDialog from '../components/common/BackupExportDialog';
import LandingLoginView from '../features/landing/components/LandingLoginView';
import LandingImportAssistantModal from '../features/landing/components/LandingImportAssistantModal';
import OwnedCampaignCard from '../features/landing/components/OwnedCampaignCard';
import PublicCampaignCard from '../features/landing/components/PublicCampaignCard';
import { useLandingCampaigns } from '../features/landing/hooks/useLandingCampaigns';
import { BUILTIN_THEME_OPTIONS } from '../features/themes/themeService';

const LandingPage: React.FC = () => {
  const { 
    user, login, logout, 
    campaignList, switchCampaign, createNewCampaign, 
    openFromFileSystem, deleteCampaign,
    isCampaignLoading,
    isCampaignSaving,
    sessionError,
    clearSessionError,
  } = useCampaignSession();
  const {
    theme: currentTheme,
    setTheme,
    customThemes,
    selectedCustomThemeName,
    selectCustomTheme,
  } = useCampaignTheme();

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
  const [loginPassword, setLoginPassword] = useState('');
  const [confirmLoginPassword, setConfirmLoginPassword] = useState('');
  const [passwordConfigured, setPasswordConfigured] = useState(false);
  const [passwordStatus, setPasswordStatus] = useState('');
  const [passwordMenuOpen, setPasswordMenuOpen] = useState(false);
  const [importAssistantOpen, setImportAssistantOpen] = useState(false);
  const [exportDialogTarget, setExportDialogTarget] = useState<{ type: 'all' } | { type: 'campaign'; campaignId: string } | null>(null);
  const {
    campaignConfigs,
    savingConfigId,
    publicCampaigns,
    setCampaignVisibility,
    handleSaveCampaignConfig,
    handleUpdateJoinPassword,
    ensurePublicCampaignAccess,
    handleRemoveMember,
    getMemberSummary,
  } = useLandingCampaigns({ user, campaignList });

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
      void createNewCampaign(newCampaignName, newCampaignDesc)
        .then(() => {
          setIsCreating(false);
          setNewCampaignName('');
          setNewCampaignDesc('');
        })
        .catch(() => void 0);
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
    await switchCampaign(campaign.id);
  };

  if (!user) {
    return (
      <LandingLoginView
        appVersion={APP_VERSION}
        username={username}
        password={password}
        loginError={loginError}
        users={users}
        historyOpen={historyOpen}
        onlinePreview={onlinePreview}
        latency={latency}
        historyRef={historyRef}
        onUsernameChange={setUsername}
        onPasswordChange={setPassword}
        onToggleHistory={() => setHistoryOpen((prev) => !prev)}
        onSelectHistoryUser={(nextUsername) => {
          setUsername(nextUsername);
          setHistoryOpen(false);
        }}
        onFocusUsername={() => setHistoryOpen(true)}
        onRefreshLatency={() => void testLatency()}
        onSubmit={handleLogin}
      />
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
            {sessionError && (
              <div className="mt-3 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 max-w-xl">
                <div>{sessionError}</div>
                <button
                  type="button"
                  onClick={clearSessionError}
                  className="mt-2 text-xs underline underline-offset-2"
                >
                  关闭提示
                </button>
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-3 items-center">
             <ReleaseUpdateButton />
             <GuideHelpButton guideId="landing" />
             {/* Open Local File */}
             <button 
                onClick={() => {
                  void openFromFileSystem().catch(() => void 0);
                }}
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
            {(isCampaignLoading || isCampaignSaving) && (
              <span className="text-sm theme-text-secondary">
                {isCampaignLoading ? '正在加载模组...' : '正在保存模组...'}
              </span>
            )}
          </div>
        </div>

        {/* Theme Selection for Landing Page */}
        <div className="flex flex-wrap gap-2 justify-end mb-6">
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
            {BUILTIN_THEME_OPTIONS.filter((item) => item.id !== 'custom').map((t) => (
                <button
                    key={t.id}
                    onClick={() => {
                        setTheme(t.id);
                    }}
                    className={`px-3 py-1 text-sm border rounded ${
                        currentTheme === t.id 
                            ? 'bg-primary text-white border-primary' 
                            : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                    }`}
                >
                    {t.id === 'default' ? '默认' : t.id === 'scroll' ? '羊皮纸' : t.id === 'archive' ? '未来' : t.id === 'nature' ? '薄巧' : '自定义'}
                </button>
            ))}
            {customThemes.length > 0 && (
                <select
                    value={selectedCustomThemeName || ''}
                    onChange={(event) => {
                        const nextName = event.target.value || null;
                        selectCustomTheme(nextName);
                        if (nextName) {
                          setTheme('custom');
                        }
                    }}
                    className="px-3 py-1 text-sm border rounded bg-white text-gray-600 border-gray-300 hover:bg-gray-50 max-w-[180px]"
                    title="切换已上传的自定义主题"
                >
                    <option value="">选择自定义主题</option>
                    {customThemes.map((item) => (
                        <option key={item.name} value={item.name}>
                            {item.name}
                        </option>
                    ))}
                </select>
            )}
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
            (() => {
              const config = campaignConfigs[campaign.id];
              const { members, previewMembers, extraCount } = getMemberSummary(config);
              const onlineMemberIds = new Set(
                members
                  .filter((member) => Date.now() - member.lastActiveAt < 5 * 60 * 1000)
                  .map((member) => member.userId)
              );

              return (
                <OwnedCampaignCard
                  key={campaign.id}
                  campaign={campaign}
                  config={config}
                  saving={savingConfigId === campaign.id}
                  previewMembers={previewMembers}
                  onlineMemberIds={onlineMemberIds}
                  extraCount={extraCount}
                  onVisibilityChange={setCampaignVisibility}
                  onSaveConfig={(campaignId) => void handleSaveCampaignConfig(campaignId)}
                  onUpdateJoinPassword={(campaignId) => void handleUpdateJoinPassword(campaignId)}
                  onRemoveMember={(campaignId, memberUserId) => void handleRemoveMember(campaignId, memberUserId)}
                  onEnter={(nextCampaign) => void handleEnterCampaign(nextCampaign)}
                  onOpenExport={(campaignId) => setExportDialogTarget({ type: 'campaign', campaignId })}
                  onDelete={(campaignId) => {
                    if (!window.confirm('确定要删除这个模组吗？此操作不可恢复。')) {
                      return;
                    }
                    void deleteCampaign(campaignId).catch(() => void 0);
                  }}
                />
              );
            })()
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
                <PublicCampaignCard
                  key={campaign.id}
                  campaign={campaign}
                  onEnter={(nextCampaign) => void handleEnterCampaign(nextCampaign, { requiresJoinPassword: Boolean(nextCampaign.hasJoinPassword) })}
                />
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

        <LandingImportAssistantModal
          open={importAssistantOpen}
          onClose={() => setImportAssistantOpen(false)}
        />

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
