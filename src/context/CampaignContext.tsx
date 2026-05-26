import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode, type SetStateAction } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { v4 as uuidv4 } from 'uuid';
import { CampaignData, CampaignSummary, CampaignTheme } from '../types';
import { dataService, DEFAULT_CAMPAIGN_DATA } from '../services/dataService';
import {
  applyThemeToDocument,
  loadStoredCustomThemes,
  removeCustomTheme as removeStoredCustomTheme,
  resolveSelectedCustomTheme,
  saveCustomThemes,
  type CustomThemeConfig,
  upsertCustomTheme as upsertStoredCustomTheme,
} from '../features/themes/themeService';
import {
  CampaignContextType,
  CampaignDataContextValue,
  CampaignSessionContextValue,
  CampaignTabsContextValue,
  CampaignThemeContextValue,
  Tab,
} from './campaign/types';
import { campaignV2Service } from '../services/campaignV2Service';
import { VersionConflictError } from '../services/conflictError';
import { getCampaignBundleQueryOptions, getCampaignListQueryOptions } from '../query/campaignQueries';
import { queryKeys } from '../query/queryKeys';

const CampaignDataContext = createContext<CampaignDataContextValue | undefined>(undefined);
const CampaignSessionContext = createContext<CampaignSessionContextValue | undefined>(undefined);
const CampaignThemeContext = createContext<CampaignThemeContextValue | undefined>(undefined);
const CampaignTabsContext = createContext<CampaignTabsContextValue | undefined>(undefined);

const useRequiredContext = <T,>(context: React.Context<T | undefined>, name: string) => {
  const value = useContext(context);
  if (value === undefined) {
    throw new Error(`${name} must be used within a CampaignProvider`);
  }
  return value;
};

export const CampaignProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<CampaignSessionContextValue['user']>(null);
  const [currentCampaignId, setCurrentCampaignId] = useState<string | null>(null);
  const [campaignDataState, setCampaignDataState] = useState<CampaignData>(DEFAULT_CAMPAIGN_DATA);
  const [campaignList, setCampaignList] = useState<CampaignSessionContextValue['campaignList']>([]);
  const [theme, setTheme] = useState<CampaignTheme>('default');
  const [customThemes, setCustomThemes] = useState<CustomThemeConfig[]>([]);
  const [selectedCustomThemeName, setSelectedCustomThemeName] = useState<string | null>(null);
  const [fileHandle, setFileHandle] = useState<any>(null);
  const [isCampaignLoading, setIsCampaignLoading] = useState(false);
  const [isCampaignSaving, setIsCampaignSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSaveRef = useRef<CampaignData | null>(null);
  const bundleVersionRef = useRef(0);
  const saveRequestIdRef = useRef(0);
  const mountedRef = useRef(true);

  const clearSessionError = useCallback(() => {
    setSessionError(null);
  }, []);

  const mergeCampaignSummary = useCallback((
    items: CampaignSummary[],
    nextSummary: Pick<CampaignSummary, 'id' | 'name' | 'description' | 'lastModified'> & Partial<CampaignSummary>
  ) => (
    items.map((item) => (
      item.id === nextSummary.id
        ? {
            ...item,
            ...nextSummary,
          }
        : item
    ))
  ), []);

  const setCampaignListForUser = useCallback((
    targetUserId: string | undefined,
    updater: CampaignSummary[] | ((prev: CampaignSummary[]) => CampaignSummary[])
  ) => {
    setCampaignList((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      if (targetUserId) {
        queryClient.setQueryData(queryKeys.campaigns.v2List(targetUserId), next);
      }
      return next;
    });
  }, [queryClient]);

  const syncCampaignSummary = useCallback((data: CampaignData, campaignId: string) => {
    setCampaignList((prev) => {
      const nextSummary = {
        id: campaignId,
        name: data.meta.projectName,
        description: data.meta.description || '',
        lastModified: data.meta.lastModified || Date.now(),
      };
      const next = mergeCampaignSummary(prev, nextSummary);
      if (user?.id) {
        queryClient.setQueryData(queryKeys.campaigns.v2List(user.id), next);
      }
      return next;
    });
  }, [mergeCampaignSummary, queryClient, user?.id]);

  const refreshCampaignList = useCallback(async (nextUser: CampaignSessionContextValue['user']) => {
    if (!nextUser) {
      setCampaignList([]);
      return [];
    }
    const items = await queryClient.fetchQuery(getCampaignListQueryOptions(nextUser));
    if (mountedRef.current) {
      setCampaignList(items);
    }
    return items;
  }, [queryClient]);

  const applyLoadedCampaign = useCallback((
    campaignId: string,
    bundle: CampaignData,
    version: number,
    targetUserId?: string
  ) => {
    bundleVersionRef.current = version;
    pendingSaveRef.current = null;
    setHasUnsavedChanges(false);
    if (targetUserId) {
      queryClient.setQueryData(queryKeys.campaigns.bundle(campaignId, targetUserId), {
        campaignId,
        version,
        bundle,
      });
    }
    setCampaignDataState({
      ...bundle,
      id: campaignId,
    });
    setCurrentCampaignId(campaignId);
    syncCampaignSummary(
      {
        ...bundle,
        id: campaignId,
      },
      campaignId
    );
  }, [queryClient, syncCampaignSummary]);

  const reloadCurrentCampaign = useCallback(async () => {
    if (!currentCampaignId || !user) {
      return;
    }
    clearSessionError();
    setIsCampaignLoading(true);
    try {
      const result = await queryClient.fetchQuery(getCampaignBundleQueryOptions(currentCampaignId, user));
      if (!mountedRef.current) {
        return;
      }
      applyLoadedCampaign(currentCampaignId, result.bundle, result.version, user.id);
    } catch (error) {
      if (mountedRef.current) {
        setSessionError(error instanceof Error ? error.message : '重新加载模组失败。');
      }
      throw error;
    } finally {
      if (mountedRef.current) {
        setIsCampaignLoading(false);
      }
    }
  }, [applyLoadedCampaign, clearSessionError, currentCampaignId, queryClient, user]);

  const flushPendingSave = useCallback(async (overrideData?: CampaignData) => {
    const campaignId = currentCampaignId;
    const targetUser = user;
    const targetData = overrideData ?? pendingSaveRef.current;
    if (!campaignId || !targetUser || !targetData) {
      return true;
    }

    const nextData: CampaignData = {
      ...targetData,
      id: campaignId,
      meta: {
        ...targetData.meta,
        lastModified: Date.now(),
      },
    };

    pendingSaveRef.current = nextData;
    const requestId = ++saveRequestIdRef.current;
    if (mountedRef.current) {
      setIsCampaignSaving(true);
    }

    try {
      const result = await campaignV2Service.saveBundle(
        campaignId,
        nextData,
        targetUser,
        bundleVersionRef.current
      );
      if (!mountedRef.current || requestId !== saveRequestIdRef.current) {
        return true;
      }
      applyLoadedCampaign(campaignId, result.bundle, result.version, targetUser.id);
      setSessionError(null);
      return true;
    } catch (error) {
      if (mountedRef.current && requestId === saveRequestIdRef.current) {
        setHasUnsavedChanges(true);
        if (error instanceof VersionConflictError) {
          setSessionError('检测到模组版本冲突：远端已有更新，当前修改尚未写入后端。请显式重新加载远端版本后再继续编辑。');
        } else {
          setSessionError(
            `模组保存失败：${error instanceof Error ? error.message : '未知错误'}。当前修改尚未写入后端，请在保存成功前不要刷新页面或关闭窗口。`
          );
        }
      }
      return false;
    } finally {
      if (mountedRef.current && requestId === saveRequestIdRef.current) {
        setIsCampaignSaving(false);
      }
    }
  }, [applyLoadedCampaign, currentCampaignId, user]);

  const scheduleCampaignSave = useCallback((data: CampaignData) => {
    pendingSaveRef.current = data;
    setHasUnsavedChanges(true);
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null;
      void flushPendingSave();
    }, 320);
  }, [flushPendingSave]);

  const setCampaignData = useCallback((update: SetStateAction<CampaignData>) => {
    setCampaignDataState((prev) => {
      const next = typeof update === 'function' ? update(prev) : update;
      if (currentCampaignId) {
        scheduleCampaignSave({
          ...next,
          id: currentCampaignId,
        });
      }
      return next;
    });
  }, [currentCampaignId, scheduleCampaignSave]);

  useEffect(() => {
    mountedRef.current = true;
    const currentUser = dataService.getCurrentUser();
    if (currentUser) {
      setUser(currentUser);
    }

    void (async () => {
      if (!currentUser) {
        return;
      }
      try {
        const items = await refreshCampaignList(currentUser);
        const lastCampaignId = localStorage.getItem('trpg_last_campaign_id');
        if (!lastCampaignId || !items.some((item) => item.id === lastCampaignId)) {
          return;
        }
        setIsCampaignLoading(true);
        const result = await queryClient.fetchQuery(getCampaignBundleQueryOptions(lastCampaignId, currentUser));
        if (!mountedRef.current) {
          return;
        }
        applyLoadedCampaign(lastCampaignId, result.bundle, result.version, currentUser.id);
      } catch (error) {
        if (mountedRef.current) {
          setSessionError(error instanceof Error ? error.message : '初始化模组列表失败。');
        }
      } finally {
        if (mountedRef.current) {
          setIsCampaignLoading(false);
        }
      }
    })();

    return () => {
      mountedRef.current = false;
    };
  }, [applyLoadedCampaign, queryClient, refreshCampaignList]);

  useEffect(() => {
    const storedCustomThemes = loadStoredCustomThemes();
    setCustomThemes(storedCustomThemes.themes);
    setSelectedCustomThemeName(storedCustomThemes.selectedName);
    const storedTheme = localStorage.getItem('trpg_theme') as CampaignTheme;
    if (storedTheme) {
      setTheme(storedTheme);
    }
  }, []);

  const activeCustomTheme = useMemo(
    () => resolveSelectedCustomTheme(customThemes, selectedCustomThemeName),
    [customThemes, selectedCustomThemeName]
  );

  useEffect(() => {
    if (currentCampaignId) {
      localStorage.setItem('trpg_last_campaign_id', currentCampaignId);
    } else {
      localStorage.removeItem('trpg_last_campaign_id');
    }
  }, [currentCampaignId]);

  useEffect(() => {
    localStorage.setItem('trpg_theme', theme);
    applyThemeToDocument(theme, activeCustomTheme);
  }, [activeCustomTheme, theme]);

  useEffect(() => {
    if (theme === 'custom' && !activeCustomTheme) {
      setTheme('default');
    }
  }, [activeCustomTheme, theme]);

  const selectCustomTheme = useCallback((name: string | null) => {
    setSelectedCustomThemeName(name);
    saveCustomThemes(customThemes, name);
  }, [customThemes]);

  const upsertCustomTheme = useCallback((nextTheme: CustomThemeConfig) => {
    setCustomThemes((prev) => {
      const nextThemes = upsertStoredCustomTheme(prev, nextTheme);
      saveCustomThemes(nextThemes, nextTheme.name);
      return nextThemes;
    });
    setSelectedCustomThemeName(nextTheme.name);
  }, []);

  const removeCustomTheme = useCallback((name: string) => {
    const nextThemes = removeStoredCustomTheme(customThemes, name);
    const nextSelectedName =
      selectedCustomThemeName === name ? nextThemes[0]?.name || null : selectedCustomThemeName;
    setCustomThemes(nextThemes);
    setSelectedCustomThemeName(nextSelectedName);
    saveCustomThemes(nextThemes, nextSelectedName);
  }, [customThemes, selectedCustomThemeName]);

  useEffect(() => {
    setTabs((prevTabs) =>
      prevTabs.map((tab) => {
        const list = (campaignDataState as unknown as Record<string, any[]>)[tab.type];
        if (!Array.isArray(list)) return tab;
        const target = list.find((item) => item.id === tab.entityId);
        if (!target?.name || target.name === tab.title) return tab;
        return { ...tab, title: target.name };
      })
    );
  }, [campaignDataState]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (!hasUnsavedChanges) {
        return;
      }
      event.preventDefault();
      event.returnValue = '当前模组仍有未保存修改，关闭页面可能丢失这些变更。';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasUnsavedChanges]);

  const login = useCallback((username: string, password: string = '') => {
    const validation = dataService.verifyUserPassword(username, password);
    if (!validation.ok) {
      return { success: false, message: validation.message };
    }
    const newUser = dataService.createUser(username);
    dataService.setCurrentUser(newUser);
    setUser(newUser);
    void refreshCampaignList(newUser).catch((error) => {
      setSessionError(error instanceof Error ? error.message : '获取模组列表失败。');
    });
    return { success: true };
  }, [refreshCampaignList]);

  const logout = useCallback(() => {
    const previousUserId = user?.id;
    const previousCampaignIds = campaignList.map((item) => item.id);
    dataService.setCurrentUser(null);
    setUser(null);
    setCurrentCampaignId(null);
    setCampaignDataState(DEFAULT_CAMPAIGN_DATA);
    setCampaignList([]);
    setHasUnsavedChanges(false);
    setSessionError(null);
    bundleVersionRef.current = 0;
    pendingSaveRef.current = null;
    localStorage.removeItem('trpg_last_campaign_id');
    if (previousUserId) {
      queryClient.removeQueries({ queryKey: queryKeys.campaigns.v2List(previousUserId) });
      queryClient.removeQueries({ queryKey: queryKeys.campaigns.publicList(previousUserId) });
      previousCampaignIds.forEach((campaignId) => {
        queryClient.removeQueries({ queryKey: queryKeys.campaigns.bundle(campaignId, previousUserId) });
        queryClient.removeQueries({ queryKey: queryKeys.campaigns.config(campaignId, previousUserId) });
      });
    }
  }, [campaignList, queryClient, user?.id]);

  const switchCampaign = useCallback(async (id: string) => {
    if (!user) {
      throw new Error('当前用户信息缺失，请重新登录后再试。');
    }
    if (currentCampaignId === id && currentCampaignId) {
      return;
    }
    clearSessionError();
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    const flushed = await flushPendingSave(campaignDataState);
    if (!flushed) {
      return;
    }
    setIsCampaignLoading(true);
    try {
      const result = await queryClient.fetchQuery(getCampaignBundleQueryOptions(id, user));
      if (!mountedRef.current) {
        return;
      }
      applyLoadedCampaign(id, result.bundle, result.version, user.id);
    } catch (error) {
      if (mountedRef.current) {
        setSessionError(error instanceof Error ? error.message : '模组加载失败。');
      }
      throw error;
    } finally {
      if (mountedRef.current) {
        setIsCampaignLoading(false);
      }
    }
  }, [applyLoadedCampaign, campaignDataState, clearSessionError, currentCampaignId, flushPendingSave, queryClient, user]);

  const createNewCampaign = useCallback(async (name: string, description: string) => {
    if (!user) {
      throw new Error('当前用户信息缺失，请重新登录后再试。');
    }
    clearSessionError();
    setIsCampaignLoading(true);
    try {
      const result = await campaignV2Service.create(user, name, description);
      if (!mountedRef.current) {
        return;
      }
      setCampaignListForUser(user.id, (prev) => [result.summary, ...prev.filter((item) => item.id !== result.summary.id)]);
      applyLoadedCampaign(result.summary.id, result.bundle.bundle, result.bundle.version, user.id);
    } catch (error) {
      if (mountedRef.current) {
        setSessionError(error instanceof Error ? error.message : '创建模组失败。');
      }
      throw error;
    } finally {
      if (mountedRef.current) {
        setIsCampaignLoading(false);
      }
    }
  }, [applyLoadedCampaign, clearSessionError, setCampaignListForUser, user]);

  const exitCampaign = useCallback(() => {
    void (async () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      const flushed = await flushPendingSave(campaignDataState);
      if (!flushed) {
        return;
      }
      setCurrentCampaignId(null);
      setCampaignDataState(DEFAULT_CAMPAIGN_DATA);
      setHasUnsavedChanges(false);
      pendingSaveRef.current = null;
      bundleVersionRef.current = 0;
    })();
  }, [campaignDataState, flushPendingSave]);

  const deleteCampaign = useCallback(async (id: string) => {
    if (!user) {
      throw new Error('当前用户信息缺失，请重新登录后再试。');
    }
    clearSessionError();
    setIsCampaignLoading(true);
    try {
      await campaignV2Service.delete(id, user);
      if (!mountedRef.current) {
        return;
      }
      setCampaignListForUser(user.id, (prev) => prev.filter((item) => item.id !== id));
      queryClient.removeQueries({ queryKey: queryKeys.campaigns.bundle(id, user.id) });
      if (currentCampaignId === id) {
        setCurrentCampaignId(null);
        setCampaignDataState(DEFAULT_CAMPAIGN_DATA);
        setHasUnsavedChanges(false);
        pendingSaveRef.current = null;
        bundleVersionRef.current = 0;
      }
    } catch (error) {
      if (mountedRef.current) {
        setSessionError(error instanceof Error ? error.message : '删除模组失败。');
      }
      throw error;
    } finally {
      if (mountedRef.current) {
        setIsCampaignLoading(false);
      }
    }
  }, [clearSessionError, currentCampaignId, queryClient, setCampaignListForUser, user]);

  const saveCampaign = useCallback(async () => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    await flushPendingSave(campaignDataState);
  }, [campaignDataState, flushPendingSave]);

  const saveToFileSystem = useCallback(async () => {
    const handle = await dataService.saveToFileSystem(campaignDataState, fileHandle);
    if (handle) setFileHandle(handle);
  }, [campaignDataState, fileHandle]);

  const exportData = useCallback(() => {
    dataService.exportData(campaignDataState);
  }, [campaignDataState]);

  const importData = useCallback(async (file: File) => {
    try {
      await dataService.importData(file);
      throw new Error('正式数据导入请使用导入助手，不会再直接写入当前模组。');
    } catch (error) {
      setSessionError(error instanceof Error ? error.message : '导入失败，请检查文件格式。');
      throw error;
    }
  }, []);

  const openFromFileSystem = useCallback(async () => {
    if (user) {
      const message = '当前应用正式数据已切到后端。若要把本地 JSON 写入正式模组，请使用导入助手并显式执行导入。';
      setSessionError(message);
      throw new Error(message);
    }
    const result = await dataService.loadFromFileSystem();
    if (!result) return;
    const { data, handle } = result;
    setCampaignDataState(data);
    setFileHandle(handle);
  }, [user]);

  const updateEntity = useCallback((collection: keyof CampaignData, item: any) => {
    setCampaignData((prev) => {
      if (!Array.isArray(prev[collection])) return prev;
      const list = prev[collection] as any[];
      const index = list.findIndex((entry: any) => entry.id === item.id);
      const newList = index >= 0
        ? list.map((entry, entryIndex) => (entryIndex === index ? { ...item, updatedAt: Date.now() } : entry))
        : [...list, { ...item, updatedAt: Date.now() }];
      return { ...prev, [collection]: newList } as CampaignData;
    });
  }, [setCampaignData]);

  const addEntity = useCallback((collection: keyof CampaignData, item: any) => {
    updateEntity(collection, item);
  }, [updateEntity]);

  const deleteEntity = useCallback((collection: keyof CampaignData, id: string) => {
    setCampaignData((prev) => {
      if (!Array.isArray(prev[collection])) return prev;
      const list = prev[collection] as any[];
      const newList = list.filter((entry: any) => entry.id !== id);
      return { ...prev, [collection]: newList } as CampaignData;
    });
  }, [setCampaignData]);

  const reorderEntities = useCallback((collection: keyof CampaignData, orderedIds: string[]) => {
    setCampaignData((prev) => {
      if (!Array.isArray(prev[collection])) return prev;
      const list = prev[collection] as any[];
      const byId = new Map(list.map((item: any) => [item.id, item]));
      const idSet = new Set(orderedIds);
      const orderedItems = orderedIds
        .map((id) => byId.get(id))
        .filter(Boolean);
      const remainingItems = list.filter((item: any) => !idSet.has(item.id));
      const newList = [...orderedItems, ...remainingItems].map((item: any, index) => ({
        ...item,
        updatedAt: item.updatedAt || Date.now(),
        sortOrder: index,
      }));
      return { ...prev, [collection]: newList } as CampaignData;
    });
  }, [setCampaignData]);

  const openInTab = useCallback((
    type: string,
    entityId: string,
    title: string,
    targetSectionTitleLower?: string,
    targetSubItemId?: string
  ) => {
    setTabs((prevTabs) => {
      const current = prevTabs.find((tab) => tab.type === type && tab.entityId === entityId);
      if (current) {
        setActiveTabId(current.id);
        if (!targetSectionTitleLower && !targetSubItemId) {
          return prevTabs;
        }
        return prevTabs.map((tab) =>
          tab.id === current.id
            ? {
                ...tab,
                targetSectionTitleLower: targetSectionTitleLower || tab.targetSectionTitleLower,
                targetSubItemId: targetSubItemId || tab.targetSubItemId,
              }
            : tab
        );
      }

      const newTab: Tab = {
        id: uuidv4(),
        type,
        entityId,
        title,
        targetSectionTitleLower,
        targetSubItemId,
      };
      setActiveTabId(newTab.id);
      return [...prevTabs, newTab];
    });
  }, []);

  const closeTab = useCallback((tabId: string) => {
    setTabs((prevTabs) => {
      const newTabs = prevTabs.filter((tab) => tab.id !== tabId);
      setActiveTabId((currentActiveTabId) => (
        currentActiveTabId === tabId ? (newTabs.length > 0 ? newTabs[newTabs.length - 1].id : null) : currentActiveTabId
      ));
      return newTabs;
    });
  }, []);

  const dataValue = useMemo<CampaignDataContextValue>(() => ({
    campaignData: campaignDataState,
    setCampaignData,
    updateEntity,
    deleteEntity,
    addEntity,
    reorderEntities,
  }), [addEntity, campaignDataState, deleteEntity, reorderEntities, setCampaignData, updateEntity]);

  const sessionValue = useMemo<CampaignSessionContextValue>(() => ({
    saveCampaign,
    saveToFileSystem,
    user,
    login,
    logout,
    currentCampaignId,
    campaignList,
    isCampaignLoading,
    isCampaignSaving,
    hasUnsavedChanges,
    sessionError,
    clearSessionError,
    reloadCurrentCampaign,
    switchCampaign,
    createNewCampaign,
    deleteCampaign,
    exitCampaign,
    exportData,
    importData,
    openFromFileSystem,
  }), [
    saveCampaign,
    saveToFileSystem,
    user,
    login,
    logout,
    currentCampaignId,
    campaignList,
    isCampaignLoading,
    isCampaignSaving,
    hasUnsavedChanges,
    sessionError,
    clearSessionError,
    reloadCurrentCampaign,
    switchCampaign,
    createNewCampaign,
    deleteCampaign,
    exitCampaign,
    exportData,
    importData,
    openFromFileSystem,
  ]);

  const themeValue = useMemo<CampaignThemeContextValue>(() => ({
    theme,
    setTheme,
    customThemes,
    activeCustomTheme,
    selectedCustomThemeName,
    upsertCustomTheme,
    removeCustomTheme,
    selectCustomTheme,
  }), [activeCustomTheme, customThemes, selectCustomTheme, selectedCustomThemeName, theme, upsertCustomTheme, removeCustomTheme]);

  const tabsValue = useMemo<CampaignTabsContextValue>(() => ({
    tabs,
    activeTabId,
    openInTab,
    closeTab,
    setActiveTabId,
  }), [activeTabId, closeTab, openInTab, tabs]);

  return (
    <CampaignSessionContext.Provider value={sessionValue}>
      <CampaignThemeContext.Provider value={themeValue}>
        <CampaignDataContext.Provider value={dataValue}>
          <CampaignTabsContext.Provider value={tabsValue}>
            {children}
          </CampaignTabsContext.Provider>
        </CampaignDataContext.Provider>
      </CampaignThemeContext.Provider>
    </CampaignSessionContext.Provider>
  );
};

export const useCampaignData = () => useRequiredContext(CampaignDataContext, 'useCampaignData');
export const useCampaignSession = () => useRequiredContext(CampaignSessionContext, 'useCampaignSession');
export const useCampaignTheme = () => useRequiredContext(CampaignThemeContext, 'useCampaignTheme');
export const useCampaignTabs = () => useRequiredContext(CampaignTabsContext, 'useCampaignTabs');

export const useCampaign = (): CampaignContextType => {
  const data = useCampaignData();
  const session = useCampaignSession();
  const themeValue = useCampaignTheme();
  const tabsValue = useCampaignTabs();

  return useMemo(() => ({
    ...data,
    ...session,
    ...themeValue,
    ...tabsValue,
  }), [data, session, themeValue, tabsValue]);
};

export type { Tab, CampaignContextType } from './campaign/types';
