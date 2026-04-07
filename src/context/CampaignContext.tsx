import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import { CampaignData, UserProfile, CampaignSummary, CampaignTheme } from '../types';
import { dataService, DEFAULT_CAMPAIGN_DATA } from '../services/dataService';
import { initializeStorageAdapter } from '../services/storageAdapter';
import { teamNotesService } from '../services/teamNotesService';
import { v4 as uuidv4 } from 'uuid';

export interface Tab {
  id: string;
  type: string;
  entityId: string;
  title: string;
  targetSectionTitleLower?: string;
  targetSubItemId?: string;
}

interface CampaignContextType {
  // Campaign Data
  campaignData: CampaignData;
  setCampaignData: (data: CampaignData) => void;
  
  // Entity CRUD Helpers
  updateEntity: (collection: keyof CampaignData, item: any) => void;
  deleteEntity: (collection: keyof CampaignData, id: string) => void;
  addEntity: (collection: keyof CampaignData, item: any) => void;
  
  // Persistence
  saveCampaign: () => void;
  saveToFileSystem: () => Promise<void>;
  
  // User Session
  user: UserProfile | null;
  login: (username: string) => void;
  logout: () => void;
  
  // Campaign Management
  currentCampaignId: string | null;
  campaignList: CampaignSummary[];
  switchCampaign: (id: string) => void;
  createNewCampaign: (name: string, description: string) => void;
  deleteCampaign: (id: string) => void;
  exitCampaign: () => void;
  
  // Import/Export
  exportData: () => void;
  importData: (file: File) => Promise<void>;
  openFromFileSystem: () => Promise<void>;

  // UI
  theme: CampaignTheme;
  setTheme: (theme: CampaignTheme) => void;
  
  // Tabs
  tabs: Tab[];
  activeTabId: string | null;
  openInTab: (
    type: string,
    entityId: string,
    title: string,
    targetSectionTitleLower?: string,
    targetSubItemId?: string
  ) => void;
  closeTab: (tabId: string) => void;
  setActiveTabId: (tabId: string) => void;
}

const CampaignContext = createContext<CampaignContextType | undefined>(undefined);

export const CampaignProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // --- State ---
  const [user, setUser] = useState<UserProfile | null>(null);
  const [currentCampaignId, setCurrentCampaignId] = useState<string | null>(null);
  const [campaignData, setCampaignData] = useState<CampaignData>(DEFAULT_CAMPAIGN_DATA);
  const [campaignList, setCampaignList] = useState<CampaignSummary[]>([]);
  const [theme, setTheme] = useState<CampaignTheme>('default');
  const [fileHandle, setFileHandle] = useState<any>(null);
  
  // Tabs
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

  // --- Initialization ---
  useEffect(() => {
    // 1. Load User
    const currentUser = dataService.getCurrentUser();
    if (currentUser) setUser(currentUser);

    // 2. Load Campaign List
    refreshCampaignList(currentUser?.id);

    // 3. Load Last Active Campaign
    const lastCampaignId = localStorage.getItem('trpg_last_campaign_id');
    if (lastCampaignId && currentUser) {
        // Verify it still exists or just try to load
        setCurrentCampaignId(lastCampaignId);
        const data = dataService.loadCampaign(lastCampaignId);
        setCampaignData(data);
    }
  }, []);

  // --- Effects ---
  useEffect(() => {
    // 4. Load Theme - MUST BE FIRST to avoid flash
    const storedTheme = localStorage.getItem('trpg_theme') as CampaignTheme;
    if (storedTheme) {
        setTheme(storedTheme);
        document.documentElement.setAttribute('data-theme', storedTheme);
    }
  }, []);
  useEffect(() => {
      if (currentCampaignId) {
          localStorage.setItem('trpg_last_campaign_id', currentCampaignId);
      } else {
          localStorage.removeItem('trpg_last_campaign_id');
      }
  }, [currentCampaignId]);

  useEffect(() => {
    localStorage.setItem('trpg_theme', theme);
    // Apply theme to document body or root for global styles if needed
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    setTabs((prevTabs) =>
      prevTabs.map((tab) => {
        const list = (campaignData as any)[tab.type] as any[] | undefined;
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


  // --- Actions ---

  const refreshCampaignList = (userId?: string) => {
    const list = dataService.getCampaigns(userId);
    setCampaignList(list);
  };

  const login = (username: string) => {
    const newUser = dataService.createUser(username);
    dataService.setCurrentUser(newUser);
    setUser(newUser);
    refreshCampaignList(newUser.id);
    initializeStorageAdapter().then((adapter) => {
      dataService.setStorageAdapter(adapter);
    }).catch(() => void 0);
  };

  const logout = () => {
    dataService.setCurrentUser(null);
    setUser(null);
    setCurrentCampaignId(null);
    setCampaignData(DEFAULT_CAMPAIGN_DATA);
    localStorage.removeItem('trpg_last_campaign_id');
  };

  const switchCampaign = (id: string) => {
    // Save current if needed? Auto-save is handled on specific actions usually
    // But let's ensure we save current state before switching
    if (currentCampaignId) {
        persistCampaign(campaignData, true);
    }
    
    const data = dataService.loadCampaign(id);
    setCampaignData(data);
    setCurrentCampaignId(id);
  };

  const createNewCampaign = (name: string, description: string) => {
    if (!user) return;
    const newData = dataService.createCampaign(name, description, user.id);
    setCampaignData(newData);
    setCurrentCampaignId(newData.id || null);
    refreshCampaignList(user.id);
  };
  
  const deleteCampaign = (id: string) => {
      if (window.confirm('确定要删除这个模组吗？此操作不可恢复。')) {
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
      }
  };

  const exitCampaign = () => {
      if (currentCampaignId) {
          persistCampaign(campaignData, true);
      }
      setCurrentCampaignId(null);
      setCampaignData(DEFAULT_CAMPAIGN_DATA);
  };

  const saveCampaign = async () => {
    persistCampaign(campaignData, true);
    refreshCampaignList(user?.id);
    
    // Save to file system if handle exists
    if (fileHandle) {
        await dataService.saveToFileSystem(campaignData, fileHandle);
    }
  };

  const saveToFileSystem = async () => {
      const handle = await dataService.saveToFileSystem(campaignData, fileHandle);
      if (handle) setFileHandle(handle);
  };

  const exportData = () => {
    dataService.exportData(campaignData);
  };

  const importData = async (file: File) => {
    try {
      const data = await dataService.importData(file);
      // If we are logged in, maybe save this as a new campaign?
      // Or just load it into memory.
      // Strategy: Save it as a new campaign if it has an ID, or overwrite if same ID?
      // Safest: Import as new campaign copy if ID conflict, or just update.
      // Let's just save it.
      if (user) {
          // If the imported data doesn't have an ID, give it one
          if (!data.id) data.id = dataService.generateId();
          
          // Save to local storage
          persistCampaign(data, true);
          
          // Switch to it
          refreshCampaignList(user.id);
          switchCampaign(data.id);
      } else {
          // If no user (shouldn't happen in AppContent), just set data
          setCampaignData(data);
      }
    } catch (error) {
      console.error('Import failed:', error);
      alert('导入失败，请检查文件格式');
    }
  };
  
  const openFromFileSystem = async () => {
    const result = await dataService.loadFromFileSystem();
    if (result) {
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
    }
  };

  // --- Entity Helpers ---
  const updateEntity = (collection: keyof CampaignData, item: any) => {
    setCampaignData((prev) => {
      if (!Array.isArray(prev[collection])) return prev;

      const list = prev[collection] as any[];
      const index = list.findIndex((i: any) => i.id === item.id);

      let newList;
      if (index >= 0) {
        newList = [...list];
        newList[index] = { ...item, updatedAt: Date.now() };
      } else {
        newList = [...list, { ...item, updatedAt: Date.now() }];
      }

      const newData = { ...prev, [collection]: newList } as CampaignData;
      persistCampaign(newData, false);
      return newData;
    });
  };

  const addEntity = (collection: keyof CampaignData, item: any) => {
      updateEntity(collection, item);
  };

  const deleteEntity = (collection: keyof CampaignData, id: string) => {
    setCampaignData((prev) => {
      if (!Array.isArray(prev[collection])) return prev;
      const list = prev[collection] as any[];
      const newList = list.filter((i: any) => i.id !== id);
      const newData = { ...prev, [collection]: newList } as CampaignData;
      persistCampaign(newData, false);
      return newData;
    });
  };

  // --- Tab Management ---
  const openInTab = (
    type: string,
    entityId: string,
    title: string,
    targetSectionTitleLower?: string,
    targetSubItemId?: string
  ) => {
    const current = tabs.find(t => t.type === type && t.entityId === entityId);
    if (current) {
      if (targetSectionTitleLower || targetSubItemId) {
        setTabs((prevTabs) =>
          prevTabs.map((tab) =>
            tab.id === current.id
              ? {
                  ...tab,
                  targetSectionTitleLower: targetSectionTitleLower || tab.targetSectionTitleLower,
                  targetSubItemId: targetSubItemId || tab.targetSubItemId,
                }
              : tab
          )
        );
      }
      setActiveTabId(current.id);
      return;
    }

    const newTab = {
      id: uuidv4(),
      type,
      entityId,
      title,
      targetSectionTitleLower,
      targetSubItemId,
    };
    setTabs((prevTabs) => [...prevTabs, newTab]);
    setActiveTabId(newTab.id);
  };

  const closeTab = (tabId: string) => {
    const newTabs = tabs.filter(t => t.id !== tabId);
    setTabs(newTabs);
    if (activeTabId === tabId) {
      setActiveTabId(newTabs.length > 0 ? newTabs[newTabs.length - 1].id : null);
    }
  };

  return (
    <CampaignContext.Provider value={{
      campaignData,
      setCampaignData,
      updateEntity,
      deleteEntity,
      addEntity,
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
      theme,
      setTheme,
      tabs,
      activeTabId,
      openInTab,
      closeTab,
      setActiveTabId
    }}>
      {children}
    </CampaignContext.Provider>
  );
};

export const useCampaign = () => {
  const context = useContext(CampaignContext);
  if (context === undefined) {
    throw new Error('useCampaign must be used within a CampaignProvider');
  }
  return context;
};
