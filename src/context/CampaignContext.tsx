import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { CampaignData, CampaignTheme } from '../types';
import { dataService, DEFAULT_CAMPAIGN_DATA } from '../services/dataService';
import { initializeStorageAdapter } from '../services/storageAdapter';
import { teamNotesService } from '../services/teamNotesService';
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
  const [user, setUser] = useState<CampaignSessionContextValue['user']>(null);
  const [currentCampaignId, setCurrentCampaignId] = useState<string | null>(null);
  const [campaignData, setCampaignData] = useState<CampaignData>(DEFAULT_CAMPAIGN_DATA);
  const [campaignList, setCampaignList] = useState<CampaignSessionContextValue['campaignList']>([]);
  const [theme, setTheme] = useState<CampaignTheme>('default');
  const [customThemes, setCustomThemes] = useState<CustomThemeConfig[]>([]);
  const [selectedCustomThemeName, setSelectedCustomThemeName] = useState<string | null>(null);
  const [fileHandle, setFileHandle] = useState<any>(null);
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSaveRef = useRef<CampaignData | null>(null);

  const persistCampaign = useCallback((data: CampaignData, immediate = false) => {
    pendingSaveRef.current = data;
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    if (immediate) {
      dataService.saveCampaign(data);
      pendingSaveRef.current = null;
      return;
    }
    saveTimerRef.current = setTimeout(() => {
      if (pendingSaveRef.current) {
        dataService.saveCampaign(pendingSaveRef.current);
        pendingSaveRef.current = null;
      }
      saveTimerRef.current = null;
    }, 320);
  }, []);

  const refreshCampaignList = useCallback((userId?: string) => {
    setCampaignList(dataService.getCampaigns(userId));
  }, []);

  useEffect(() => {
    const currentUser = dataService.getCurrentUser();
    if (currentUser) setUser(currentUser);

    refreshCampaignList(currentUser?.id);

    const lastCampaignId = localStorage.getItem('trpg_last_campaign_id');
    if (lastCampaignId && currentUser) {
      setCurrentCampaignId(lastCampaignId);
      setCampaignData(dataService.loadCampaign(lastCampaignId));
    }
  }, [refreshCampaignList]);

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
        const list = (campaignData as unknown as Record<string, any[]>)[tab.type];
        if (!Array.isArray(list)) return tab;
        const target = list.find((item) => item.id === tab.entityId);
        if (!target?.name || target.name === tab.title) return tab;
        return { ...tab, title: target.name };
      })
    );
  }, [campaignData]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
      if (pendingSaveRef.current) {
        dataService.saveCampaign(pendingSaveRef.current);
        pendingSaveRef.current = null;
      }
    };
  }, []);

  const login = useCallback((username: string, password: string = '') => {
    const validation = dataService.verifyUserPassword(username, password);
    if (!validation.ok) {
      return { success: false, message: validation.message };
    }
    const newUser = dataService.createUser(username);
    dataService.setCurrentUser(newUser);
    setUser(newUser);
    refreshCampaignList(newUser.id);
    initializeStorageAdapter()
      .then((adapter) => {
        dataService.setStorageAdapter(adapter);
      })
      .catch(() => void 0);
    return { success: true };
  }, [refreshCampaignList]);

  const logout = useCallback(() => {
    dataService.setCurrentUser(null);
    setUser(null);
    setCurrentCampaignId(null);
    setCampaignData(DEFAULT_CAMPAIGN_DATA);
    localStorage.removeItem('trpg_last_campaign_id');
  }, []);

  const switchCampaign = useCallback((id: string) => {
    if (currentCampaignId) {
      persistCampaign(campaignData, true);
    }
    setCampaignData(dataService.loadCampaign(id));
    setCurrentCampaignId(id);
  }, [campaignData, currentCampaignId, persistCampaign]);

  const createNewCampaign = useCallback((name: string, description: string) => {
    if (!user) return;
    const newData = dataService.createCampaign(name, description, user.id);
    setCampaignData(newData);
    setCurrentCampaignId(newData.id || null);
    refreshCampaignList(user.id);
  }, [refreshCampaignList, user]);

  const exitCampaign = useCallback(() => {
    if (currentCampaignId) {
      persistCampaign(campaignData, true);
    }
    setCurrentCampaignId(null);
    setCampaignData(DEFAULT_CAMPAIGN_DATA);
  }, [campaignData, currentCampaignId, persistCampaign]);

  const deleteCampaign = useCallback((id: string) => {
    if (!window.confirm('确定要删除这个模组吗？此操作不可恢复。')) return;
    void (async () => {
      try {
        await teamNotesService.updateConfig(id, user, { visibility: 'private', lastModified: Date.now() });
      } catch {
        void 0;
      }
      dataService.deleteCampaign(id);
      refreshCampaignList(user?.id);
      if (currentCampaignId === id) {
        exitCampaign();
      }
    })();
  }, [currentCampaignId, exitCampaign, refreshCampaignList, user]);

  const saveCampaign = useCallback(async () => {
    persistCampaign(campaignData, true);
    refreshCampaignList(user?.id);
    if (fileHandle) {
      await dataService.saveToFileSystem(campaignData, fileHandle);
    }
  }, [campaignData, fileHandle, persistCampaign, refreshCampaignList, user]);

  const saveToFileSystem = useCallback(async () => {
    const handle = await dataService.saveToFileSystem(campaignData, fileHandle);
    if (handle) setFileHandle(handle);
  }, [campaignData, fileHandle]);

  const exportData = useCallback(() => {
    dataService.exportData(campaignData);
  }, [campaignData]);

  const importData = useCallback(async (file: File) => {
    try {
      const data = await dataService.importData(file);
      if (user) {
        if (!data.id) data.id = dataService.generateId();
        persistCampaign(data, true);
        refreshCampaignList(user.id);
        switchCampaign(data.id);
      } else {
        setCampaignData(data);
      }
    } catch (error) {
      console.error('Import failed:', error);
      alert('导入失败，请检查文件格式');
    }
  }, [persistCampaign, refreshCampaignList, switchCampaign, user]);

  const openFromFileSystem = useCallback(async () => {
    const result = await dataService.loadFromFileSystem();
    if (!result) return;
    const { data, handle } = result;
    if (user) {
      persistCampaign(data, true);
      refreshCampaignList(user.id);
      setCampaignData(data);
      setCurrentCampaignId(data.id || null);
      setFileHandle(handle);
    } else {
      setCampaignData(data);
      setFileHandle(handle);
    }
  }, [persistCampaign, refreshCampaignList, user]);

  const updateEntity = useCallback((collection: keyof CampaignData, item: any) => {
    setCampaignData((prev) => {
      if (!Array.isArray(prev[collection])) return prev;
      const list = prev[collection] as any[];
      const index = list.findIndex((entry: any) => entry.id === item.id);
      const newList = index >= 0
        ? list.map((entry, entryIndex) => (entryIndex === index ? { ...item, updatedAt: Date.now() } : entry))
        : [...list, { ...item, updatedAt: Date.now() }];
      const newData = { ...prev, [collection]: newList } as CampaignData;
      persistCampaign(newData, false);
      return newData;
    });
  }, [persistCampaign]);

  const addEntity = useCallback((collection: keyof CampaignData, item: any) => {
    updateEntity(collection, item);
  }, [updateEntity]);

  const deleteEntity = useCallback((collection: keyof CampaignData, id: string) => {
    setCampaignData((prev) => {
      if (!Array.isArray(prev[collection])) return prev;
      const list = prev[collection] as any[];
      const newList = list.filter((entry: any) => entry.id !== id);
      const newData = { ...prev, [collection]: newList } as CampaignData;
      persistCampaign(newData, false);
      return newData;
    });
  }, [persistCampaign]);

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
      const newData = { ...prev, [collection]: newList } as CampaignData;
      persistCampaign(newData, false);
      return newData;
    });
  }, [persistCampaign]);

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
    campaignData,
    setCampaignData,
    updateEntity,
    deleteEntity,
    addEntity,
    reorderEntities,
  }), [addEntity, campaignData, deleteEntity, reorderEntities, updateEntity]);

  const sessionValue = useMemo<CampaignSessionContextValue>(() => ({
    saveCampaign,
    saveToFileSystem,
    user,
    login,
    logout,
    currentCampaignId,
    campaignList,
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
