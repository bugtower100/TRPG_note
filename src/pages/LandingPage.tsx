import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useCampaignSession, useCampaignTheme } from '../context/CampaignContext';
import { Download, Upload, Plus, ChevronDown, HardDrive, LogOut } from 'lucide-react';
import { dataService } from '../services/dataService';
import { GuideHelpButton } from '../components/common/InteractiveGuide';
import ReleaseUpdateButton from '../components/common/ReleaseUpdateButton';
import { CampaignConfig } from '../types';
import { APP_VERSION } from '../constants/appVersion';
import { backupService } from '../services/backupService';
import BackupExportDialog from '../components/common/BackupExportDialog';
import AutomaticBackupSettingsDialog from '../components/common/AutomaticBackupSettingsDialog';
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
    deleteCampaign,
    isCampaignLoading,
    isCampaignSaving,
    sessionError,
    clearSessionError,
    reloadCampaignList,
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
  const [automaticBackupOpen, setAutomaticBackupOpen] = useState(false);
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
    handleUpdateMemberRole,
    getMemberSummary,
    handleRenameCampaign,
    handleUpdateCampaignDescription,
  } = useLandingCampaigns({ user, campaignList, reloadCampaignList });

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
    <div className="landing-page p-4 sm:p-8 min-h-screen theme-page">
      <div className="mx-auto max-w-6xl">
        <div className="landing-header flex flex-col gap-4 justify-between items-start md:flex-row md:items-center">
          <div>
            <h1 className="text-2xl font-semibold text-theme-primary">TRPG备团笔记·主页</h1>
            <p className="mt-2 text-sm theme-text-secondary">
                {user.username}，选择模组以继续准备冒险。
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
             <GuideHelpButton guideId="landing" />
            <details className="compact-actions landing-tools">
              <summary>工具与备份</summary>
              <div className="compact-actions__menu">
             <ReleaseUpdateButton />
            <button 
                onClick={() => setImportAssistantOpen(true)}
                className="flex gap-2 items-center text-sm theme-text-secondary"
                title="导入模组或备份包"
            >
                <Upload size={18} />
                <span>导入模组</span>
            </button>
            <button
                onClick={() => setAutomaticBackupOpen(true)}
                className="flex gap-2 items-center text-sm theme-text-secondary"
                title="设置数据库自动备份"
            >
                <HardDrive size={18} />
                <span>自动备份</span>
            </button>
            <button
                onClick={() => setExportDialogTarget({ type: 'all' })}
                className="flex gap-2 items-center text-sm theme-text-secondary"
                title="导出当前账号下的所有模组备份包"
            >
                <Download size={18} />
                <span>导出所有模组</span>
            </button>
              </div>
            </details>
            <button
              type="button"
              onClick={logout}
              className="inline-flex items-center gap-1.5 rounded-md border border-theme px-3 py-2 text-sm font-medium theme-text-secondary hover:bg-primary-light hover:text-primary"
            >
              <LogOut size={16} aria-hidden="true" />
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
        <div className="landing-toolbar">
          <h2 className="text-base font-semibold">我的模组 <span className="ml-2 text-sm font-normal theme-text-secondary">{campaignList.length}</span></h2>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative" ref={passwordMenuRef}>
                <button
                    type="button"
                    onClick={() => {
                        setPasswordMenuOpen((prev) => !prev);
                        setPasswordStatus('');
                    }}
                    className="px-3 py-1 text-sm border rounded theme-card theme-text-secondary border-theme hover:bg-primary-light inline-flex items-center gap-1"
                >
                    账号
                    <ChevronDown size={16} className={`transition-transform ${passwordMenuOpen ? 'rotate-180' : ''}`} />
                </button>
                {passwordMenuOpen && (
                    <div className="absolute right-0 z-40 mt-2 w-[300px] max-w-[calc(100vw-32px)] rounded-lg border border-theme theme-card shadow-lg p-3">
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
            <details className="compact-actions landing-appearance">
              <summary>外观</summary>
              <div className="compact-actions__menu">
            {BUILTIN_THEME_OPTIONS.filter((item) => item.id !== 'custom').map((t) => (
                <button
                    key={t.id}
                    aria-pressed={currentTheme === t.id}
                    onClick={() => {
                        setTheme(t.id);
                    }}
                    className={`px-3 py-1 text-sm border rounded ${
                        currentTheme === t.id 
                            ? 'bg-primary-light text-primary border-primary' 
                            : 'theme-card theme-text-secondary border-theme hover:bg-primary-light'
                    }`}
                >
                    {t.id === 'default' ? '默认' : t.label}
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
                    className="px-3 py-1 text-sm border rounded theme-card theme-text-secondary border-theme hover:bg-primary-light max-w-[180px]"
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
            </details>
            <button
              type="button"
              data-tour="landing-create-campaign"
              onClick={() => setIsCreating(true)}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm text-white hover:bg-primary-dark"
            >
              <Plus size={16} /> 新建模组
            </button>
          </div>
        </div>

        {/* Campaign List */}
        {campaignList.length === 0 && <div className="landing-empty">
          <p className="font-medium">还没有模组</p>
          <p className="mt-2 text-sm theme-text-secondary">点击“新建模组”开始，或从“工具与备份”导入已有模组。</p>
        </div>}
        <div className="landing-campaign-grid" data-tour="landing-campaign-list">
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
                  onUpdateMemberRole={(campaignId, memberUserId, role) => void handleUpdateMemberRole(campaignId, memberUserId, role)}
                  onRename={handleRenameCampaign}
                  onUpdateDescription={handleUpdateCampaignDescription}
                  currentUserId={user?.id || ''}
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
            <div className="landing-campaign-grid">
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
            <div className="p-6 w-full max-w-md rounded-lg shadow-xl theme-card border border-theme">
              <h2 className="mb-4 text-xl font-bold text-theme-primary">创建新模组</h2>
              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <label className="block mb-1 text-sm font-medium text-theme-primary">模组名称</label>
                  <input
                    type="text"
                    value={newCampaignName}
                    onChange={(e) => setNewCampaignName(e.target.value)}
                    className="px-3 py-2 w-full rounded border border-theme bg-transparent outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    placeholder="例如：奈亚拉托提普的面具、龙金之劫"
                    autoFocus
                    required
                  />
                </div>
                <div>
                  <label className="block mb-1 text-sm font-medium text-theme-primary">简介</label>
                  <textarea
                    value={newCampaignDesc}
                    onChange={(e) => setNewCampaignDesc(e.target.value)}
                    className="w-full px-3 py-2 border border-theme rounded bg-transparent focus:ring-2 focus:ring-primary focus:border-transparent outline-none min-h-[100px]"
                    placeholder="简要描述这个模组的背景..."
                  />
                </div>
                <div className="flex gap-3 justify-end mt-6">
                  <button
                    type="button"
                    onClick={() => setIsCreating(false)}
                    className="px-4 py-2 rounded theme-text-secondary hover:bg-primary-light"
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

        <AutomaticBackupSettingsDialog
          open={automaticBackupOpen}
          user={user}
          onClose={() => setAutomaticBackupOpen(false)}
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
