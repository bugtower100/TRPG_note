import type { Dispatch, SetStateAction } from 'react';
import { CampaignData, CampaignSummary, CampaignTheme, UserProfile } from '../../types';
import { CustomThemeConfig } from '../../features/themes/themeService';

export interface Tab {
  id: string;
  type: string;
  entityId: string;
  title: string;
  targetSectionTitleLower?: string;
  targetSubItemId?: string;
}

export interface CampaignDataContextValue {
  campaignData: CampaignData;
  setCampaignData: Dispatch<SetStateAction<CampaignData>>;
  updateEntity: (collection: keyof CampaignData, item: any) => void;
  deleteEntity: (collection: keyof CampaignData, id: string) => void;
  addEntity: (collection: keyof CampaignData, item: any) => void;
  reorderEntities: (collection: keyof CampaignData, orderedIds: string[]) => void;
}

export interface CampaignSessionContextValue {
  saveCampaign: () => Promise<void>;
  saveToFileSystem: () => Promise<void>;
  user: UserProfile | null;
  login: (username: string, password?: string) => { success: boolean; message?: string };
  logout: () => void;
  currentCampaignId: string | null;
  campaignList: CampaignSummary[];
  isSessionBootstrapping: boolean;
  isCampaignLoading: boolean;
  isCampaignSaving: boolean;
  showSavingNotice: boolean;
  hasUnsavedChanges: boolean;
  showUnsavedWarning: boolean;
  sessionError: string | null;
  clearSessionError: () => void;
  reloadCampaignList: () => Promise<void>;
  reloadCurrentCampaign: () => Promise<void>;
  switchCampaign: (id: string) => Promise<void>;
  createNewCampaign: (name: string, description: string) => Promise<void>;
  deleteCampaign: (id: string) => Promise<void>;
  exitCampaign: () => void;
  exportData: () => void;
  importData: (file: File) => Promise<void>;
}

export interface CampaignThemeContextValue {
  theme: CampaignTheme;
  setTheme: (theme: CampaignTheme) => void;
  customThemes: CustomThemeConfig[];
  activeCustomTheme: CustomThemeConfig | null;
  selectedCustomThemeName: string | null;
  upsertCustomTheme: (theme: CustomThemeConfig) => void;
  removeCustomTheme: (name: string) => void;
  selectCustomTheme: (name: string | null) => void;
}

export interface CampaignTabsContextValue {
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
  setActiveTabId: (tabId: string | null) => void;
}

export interface CampaignContextType
  extends CampaignDataContextValue,
    CampaignSessionContextValue,
    CampaignThemeContextValue,
    CampaignTabsContextValue {}
