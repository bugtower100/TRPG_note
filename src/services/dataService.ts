import { CampaignData, UserProfile, CampaignSummary, BaseEntity, Character, Location, Organization, Event, Clue, Timeline, Monster, RelationGraph } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { StorageAdapter } from './storageAdapter';

const STORAGE_KEYS = {
  CAMPAIGN_DATA: 'trpg_campaign_data', // Legacy key, keep for migration
  USERS: 'trpg_users',
  CAMPAIGN_INDEX: 'trpg_campaign_index',
  CURRENT_USER: 'trpg_current_user',
  DRAFT_PREFIX: 'trpg_draft_',
} as const;

export const DEFAULT_CAMPAIGN_DATA: CampaignData = {
  meta: {
    formatVersion: '1.0',
    projectName: '新模组',
    lastModified: Date.now(),
    description: '这是一个新的模组。',
  },
  notes: '',
  characters: [],
  locations: [],
  organizations: [],
  events: [],
  clues: [],
  timelines: [],
  monsters: [],
  relationGraphs: [],
};

class DataService {
  private storage: StorageAdapter = {
    getItem: (key) => window.localStorage.getItem(key),
    setItem: (key, value) => window.localStorage.setItem(key, value),
    removeItem: (key) => window.localStorage.removeItem(key),
    keys: () => Object.keys(window.localStorage),
  };

  setStorageAdapter(adapter: StorageAdapter): void {
    this.storage = adapter;
  }
  
  private userPrefix(): string {
    const u = this.getStoredData<UserProfile>(STORAGE_KEYS.CURRENT_USER);
    const id = typeof u?.id === 'string' && u.id ? u.id : 'default';
    return `trpg_u_${id}_`;
  }

  private indexKey(): string {
    return `${this.userPrefix()}campaign_index`;
  }

  private campaignKey(id: string): string {
    return `${this.userPrefix()}campaign_${id}`;
  }

  private draftKey(id: string): string {
    return `${this.userPrefix()}draft_${id}`;
  }

  private normalizeSubItem(item: any) {
    return {
      id: typeof item?.id === 'string' && item.id ? item.id : uuidv4(),
      title: typeof item?.title === 'string' && item.title.trim() ? item.title.trim() : '详细情况',
      content: typeof item?.content === 'string' ? item.content : '',
      collapsed: Boolean(item?.collapsed),
    };
  }

  private normalizeSubItems(items: any): any[] {
    if (!Array.isArray(items)) return [];
    return items.map((item) => this.normalizeSubItem(item));
  }

  private normalizeSectionSubItems(sectionSubItems: any): Record<string, any[]> {
    if (typeof sectionSubItems !== 'object' || !sectionSubItems) return {};
    const result: Record<string, any[]> = {};
    Object.entries(sectionSubItems).forEach(([key, value]) => {
      if (!key) return;
      result[key] = this.normalizeSubItems(value);
    });
    return result;
  }

  private normalizeRecord(record: any): Record<string, any> {
    if (typeof record !== 'object' || !record) return {};
    return { ...record };
  }

  private normalizeCustomSections(customSections: any): string[] {
    if (!Array.isArray(customSections)) return [];
    const normalized = customSections
      .filter((value) => typeof value === 'string' && value.trim())
      .map((value) => value.trim());
    return Array.from(new Set(normalized));
  }

  private normalizeCampaignData(input: any): CampaignData {
    const raw = input?.data && input?.handle ? input.data : input;

    const id = typeof raw?.id === 'string' && raw.id ? raw.id : uuidv4();

    const meta = {
      ...DEFAULT_CAMPAIGN_DATA.meta,
      ...(typeof raw?.meta === 'object' && raw.meta ? raw.meta : {}),
      lastModified: typeof raw?.meta?.lastModified === 'number' ? raw.meta.lastModified : Date.now(),
    };

    const safeArray = <T>(value: any, fallback: T[] = []): T[] => (Array.isArray(value) ? value : fallback);

    const normalizeBase = (e: any) => {
      let customSubItems = this.normalizeSubItems(e?.customSubItems);
      const sectionSubItems = this.normalizeSectionSubItems(e?.sectionSubItems);
      const sectionVisibility = this.normalizeRecord(e?.sectionVisibility);
      const sectionTitles = this.normalizeRecord(e?.sectionTitles);
      const customSections = this.normalizeCustomSections(e?.customSections);

      if (customSubItems.length > 0) {
        let legacyKey = 'legacy_common';
        let counter = 1;
        while (sectionSubItems[legacyKey]) {
          legacyKey = `legacy_common_${counter}`;
          counter += 1;
        }
        sectionSubItems[legacyKey] = customSubItems;
        sectionTitles[legacyKey] = sectionTitles[legacyKey] || '历史通用子项目';
        sectionVisibility[legacyKey] = sectionVisibility[legacyKey] ?? true;
        if (!customSections.includes(legacyKey)) {
          customSections.push(legacyKey);
        }
        customSubItems = [];
      }

      return {
        id: typeof e?.id === 'string' && e.id ? e.id : uuidv4(),
        name: typeof e?.name === 'string' ? e.name : '未命名',
        details: typeof e?.details === 'string' ? e.details : '',
        customSubItems,
        sectionSubItems,
        sectionVisibility,
        sectionTitles,
        customSections,
        relatedImages: safeArray<string>(e?.relatedImages, []),
        createdAt: typeof e?.createdAt === 'number' ? e.createdAt : Date.now(),
        updatedAt: typeof e?.updatedAt === 'number' ? e.updatedAt : Date.now(),
      };
    };

    const characters: Character[] = safeArray<any>(raw?.characters, []).map((c) => ({
      ...normalizeBase(c),
      identity: typeof c?.identity === 'string' ? c.identity : '',
      appearance: typeof c?.appearance === 'string' ? c.appearance : '',
      desireOrGoal: typeof c?.desireOrGoal === 'string' ? c.desireOrGoal : '',
      attributes: typeof c?.attributes === 'string' ? c.attributes : (typeof c?.characterCardAttributes === 'string' ? c.characterCardAttributes : ''),
      relations: safeArray<any>(c?.relations, []),
    }));

    const locations: Location[] = safeArray<any>(raw?.locations, []).map((l) => ({
      ...normalizeBase(l),
      environment: typeof l?.environment === 'string' ? l.environment : '',
      relations: safeArray<any>(l?.relations, []),
    }));

    const organizations: Organization[] = safeArray<any>(raw?.organizations, []).map((o) => ({
      ...normalizeBase(o),
      notes: typeof o?.notes === 'string' ? o.notes : '',
      relations: safeArray<any>(o?.relations, []),
    }));

    const events: Event[] = safeArray<any>(raw?.events, []).map((e) => ({
      ...normalizeBase(e),
      time: typeof e?.time === 'string' ? e.time : '',
      relations: safeArray<any>(e?.relations, []),
    }));

    const clues: Clue[] = safeArray<any>(raw?.clues, []).map((c) => ({
      ...normalizeBase(c),
      type: typeof c?.type === 'string' ? c.type : '普通',
      relations: safeArray<any>(c?.relations, []),
    }));

    const timelines: Timeline[] = safeArray<any>(raw?.timelines, []).map((t) => ({
      ...normalizeBase(t),
      timelineEvents: safeArray<any>(t?.timelineEvents, []),
    }));

    const monsters: Monster[] = safeArray<any>(raw?.monsters, []).map((m) => ({
      ...normalizeBase(m),
      type: typeof m?.type === 'string' ? m.type : '普通',
      stats: typeof m?.stats === 'string' ? m.stats : '',
      abilities: typeof m?.abilities === 'string' ? m.abilities : '',
      drops: typeof m?.drops === 'string' ? m.drops : '',
      relations: safeArray<any>(m?.relations, []),
    }));

    const relationGraphs: RelationGraph[] = safeArray<any>(raw?.relationGraphs, []).map((g) => ({
      id: typeof g?.id === 'string' && g.id ? g.id : uuidv4(),
      name: typeof g?.name === 'string' && g.name.trim() ? g.name.trim() : '新关系图',
      nodes: safeArray<any>(g?.nodes, []).map((n) => ({
        id: typeof n?.id === 'string' && n.id ? n.id : uuidv4(),
        entityId: typeof n?.entityId === 'string' ? n.entityId : '',
        entityType: typeof n?.entityType === 'string' ? n.entityType : 'characters',
        label: typeof n?.label === 'string' ? n.label : '未命名',
        x: typeof n?.x === 'number' ? n.x : 120,
        y: typeof n?.y === 'number' ? n.y : 120,
        note: typeof n?.note === 'string' ? n.note : '',
        tokenImageRef:
          typeof n?.tokenImageRef === 'string'
            ? n.tokenImageRef
            : (typeof n?.tokenImage === 'string' ? n.tokenImage : ''),
      })),
      edges: safeArray<any>(g?.edges, []).map((e) => ({
        id: typeof e?.id === 'string' && e.id ? e.id : uuidv4(),
        fromNodeId: typeof e?.fromNodeId === 'string' ? e.fromNodeId : '',
        toNodeId: typeof e?.toNodeId === 'string' ? e.toNodeId : '',
        direction: e?.direction === 'forward' || e?.direction === 'backward' || e?.direction === 'bidirectional' ? e.direction : 'none',
        lineStyle: e?.lineStyle === 'dashed' ? 'dashed' : 'solid',
        lineWidth:
          typeof e?.lineWidth === 'number'
            ? Math.max(1, Math.min(6, e.lineWidth))
            : 2,
        label: typeof e?.label === 'string' ? e.label : '',
        labelFontSize: typeof e?.labelFontSize === 'number' ? e.labelFontSize : 12,
        labelColor: typeof e?.labelColor === 'string' ? e.labelColor : '#374151',
        labelBgColor: typeof e?.labelBgColor === 'string' ? e.labelBgColor : '#ffffff',
        labelBgOpacity:
          typeof e?.labelBgOpacity === 'number'
            ? Math.max(0, Math.min(1, e.labelBgOpacity))
            : 0.5,
      })),
      updatedAt: typeof g?.updatedAt === 'number' ? g.updatedAt : Date.now(),
    }));

    const notes = typeof raw?.notes === 'string' ? raw.notes : (typeof raw?.memoContent === 'string' ? raw.memoContent : '');

    return {
      id,
      meta: {
        ...meta,
        projectName:
          typeof meta.projectName === 'string' && meta.projectName
            ? meta.projectName
            : (typeof raw?.sourceProjectName === 'string' ? raw.sourceProjectName : DEFAULT_CAMPAIGN_DATA.meta.projectName),
      },
      notes,
      characters,
      locations,
      organizations,
      events,
      clues,
      timelines,
      monsters,
      relationGraphs,
    };
  }

  private getStoredData<T>(key: string): T | null {
    try {
      const stored = this.storage.getItem(key);
      return stored ? JSON.parse(stored) : null;
    } catch (e) {
      console.error(`Error loading data from ${key}`, e);
      return null;
    }
  }

  private saveDataToStorage(key: string, data: any): void {
    try {
      this.storage.setItem(key, JSON.stringify(data));
    } catch (e) {
      console.error(`Error saving data to ${key}`, e);
    }
  }

  

  // --- User Management ---
  getUsers(): UserProfile[] {
    return this.getStoredData<UserProfile[]>(STORAGE_KEYS.USERS) || [];
  }

  createUser(username: string): UserProfile {
    const users = this.getUsers();
    // Check if exists
    const existing = users.find(u => u.username === username);
    if (existing) {
      const updated = { ...existing, lastActive: Date.now() };
      const idx = users.findIndex(u => u.username === username);
      if (idx >= 0) users[idx] = updated;
      this.saveDataToStorage(STORAGE_KEYS.USERS, users);
      return updated;
    }

    const hashUsername = (name: string): string => {
      const s = (name || '').trim().toLowerCase();
      let hash = 5381;
      for (let i = 0; i < s.length; i++) {
        hash = ((hash << 5) + hash) + s.charCodeAt(i);
        hash = hash & 0xffffffff;
      }
      const hex = (hash >>> 0).toString(16).padStart(8, '0');
      return `u_${hex}`;
    };

    const newUser: UserProfile = {
      id: hashUsername(username),
      username,
      role: 'GM',
      lastActive: Date.now()
    };
    
    users.push(newUser);
    this.saveDataToStorage(STORAGE_KEYS.USERS, users);
    return newUser;
  }

  getCurrentUser(): UserProfile | null {
    return this.getStoredData<UserProfile>(STORAGE_KEYS.CURRENT_USER);
  }

  setCurrentUser(user: UserProfile | null): void {
    if (user) {
      this.saveDataToStorage(STORAGE_KEYS.CURRENT_USER, user);
    } else {
      this.storage.removeItem(STORAGE_KEYS.CURRENT_USER);
    }
  }

  // --- Campaign Index Management ---
  getCampaigns(userId?: string): CampaignSummary[] {
    const scoped = this.getStoredData<CampaignSummary[]>(this.indexKey()) || [];
    if (!userId) return scoped;
    return scoped.filter(c => c.ownerId === userId);
  }

  createCampaign(name: string, description: string, ownerId: string): CampaignData {
    const newId = uuidv4();
    const newCampaign: CampaignData = {
      ...DEFAULT_CAMPAIGN_DATA,
      id: newId,
      meta: {
        ...DEFAULT_CAMPAIGN_DATA.meta,
        projectName: name,
        description,
        lastModified: Date.now(),
      }
    };

    // Save actual data
    this.saveDataToStorage(this.campaignKey(newId), newCampaign);

    // Update Index
    const index = this.getCampaigns(ownerId);
    index.push({
      id: newId,
      name,
      description,
      lastModified: Date.now(),
      ownerId
    });
    this.saveDataToStorage(this.indexKey(), index);

    return newCampaign;
  }

  // --- File System Storage ---
  async saveToFileSystem(data: CampaignData, existingHandle?: any): Promise<any> {
    try {
      // @ts-ignore
      if (window.showSaveFilePicker || existingHandle) {
        let handle = existingHandle;
        
        if (!handle) {
            // @ts-ignore
            handle = await window.showSaveFilePicker({
            suggestedName: `${data.meta.projectName || 'campaign'}.json`,
            types: [{
                description: 'JSON File',
                accept: { 'application/json': ['.json'] },
            }],
            });
        }
        
        const writable = await handle.createWritable();
        await writable.write(JSON.stringify(data, null, 2));
        await writable.close();
        return handle;
      } else {
        // Fallback for browsers not supporting File System Access API
        this.exportData(data);
        return null;
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error('Failed to save to file system:', err);
        throw err;
      }
      return null;
    }
  }

  async loadFromFileSystem(): Promise<{ data: CampaignData; handle: any } | null> {
    try {
      // @ts-ignore
      if (window.showOpenFilePicker) {
        // @ts-ignore
        const [handle] = await window.showOpenFilePicker({
          types: [{
            description: 'JSON File',
            accept: { 'application/json': ['.json'] },
          }],
          multiple: false
        });
        const file = await handle.getFile();
        const text = await file.text();
        const raw = JSON.parse(text);
        const data = this.normalizeCampaignData(raw);
        return { data, handle };
      } else {
        alert('您的浏览器不支持直接读取本地文件，请使用导入功能。');
        return null;
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error('Failed to load from file system:', err);
        throw err;
      }
      return null;
    }
  }

  // --- Campaign Data Operations ---
  loadCampaign(id?: string): CampaignData {
    if (!id) {
      return DEFAULT_CAMPAIGN_DATA;
    }

    const data = this.getStoredData<any>(this.campaignKey(id));
    if (data) {
      const normalized = this.normalizeCampaignData(data);
      this.saveDataToStorage(this.campaignKey(normalized.id!), normalized);
      return normalized;
    }
    const fresh = this.normalizeCampaignData({ ...DEFAULT_CAMPAIGN_DATA, id });
    this.saveDataToStorage(this.campaignKey(fresh.id!), fresh);
    return fresh;
  }

  saveCampaign(data: CampaignData): void {
    const normalized = this.normalizeCampaignData(data);
    const updatedData = {
      ...normalized,
      meta: {
        ...normalized.meta,
        lastModified: Date.now(),
      }
    };

    if (updatedData.id) {
      // Save to specific key
      this.saveDataToStorage(this.campaignKey(updatedData.id), updatedData);
      
      // Update Index
      const currentUser = this.getCurrentUser();
      const index = this.getCampaigns(currentUser?.id);
      const summaryIdx = index.findIndex(c => c.id === updatedData.id);
      if (summaryIdx >= 0) {
        index[summaryIdx] = {
          ...index[summaryIdx],
          name: updatedData.meta.projectName,
          description: updatedData.meta.description || '',
          lastModified: Date.now(),
        };
        this.saveDataToStorage(this.indexKey(), index);
      }
    }
  }

  deleteCampaign(id: string): void {
    this.storage.removeItem(this.campaignKey(id));
    const index = this.getCampaigns();
    const newIndex = index.filter(c => c.id !== id);
    this.saveDataToStorage(this.indexKey(), newIndex);
  }

  // --- Drafts ---
  hasUnsavedDraft(campaignId: string = 'default'): boolean {
    const key = this.draftKey(campaignId);
    const draft = this.getStoredData<CampaignData>(key);
    // Logic can be improved, for now just check existence
    return !!draft;
  }

  saveDraft(data: CampaignData): void {
    const id = data.id || 'default';
    const draftData = {
      ...data,
      meta: { ...data.meta, lastModified: Date.now() }
    };
    this.saveDataToStorage(this.draftKey(id), draftData);
  }

  loadDraft(campaignId: string = 'default'): CampaignData | null {
    return this.getStoredData<CampaignData>(this.draftKey(campaignId));
  }

  discardDraft(campaignId: string = 'default'): void {
    this.storage.removeItem(this.draftKey(campaignId));
  }

  // --- Export/Import ---
  exportData(data: CampaignData): void {
    const hasExternalGraphImages = (data.relationGraphs || []).some((g) =>
      (g.nodes || []).some((n: any) => typeof n?.tokenImageRef === 'string' && n.tokenImageRef.trim())
    );
    if (hasExternalGraphImages) {
      alert('检测到关系图节点图片资源。当前导出的 JSON 不包含图片文件，导入后请重新上传图片。');
    }
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `${data.meta.projectName || 'campaign'}_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  }

  async importData(file: File): Promise<CampaignData> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const result = e.target?.result as string;
          const raw = JSON.parse(result);
          const data = this.normalizeCampaignData(raw);
          resolve(data);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = reject;
      reader.readAsText(file);
    });
  }

  generateId(): string {
    return uuidv4();
  }

  createEntity<T extends BaseEntity>(data: Omit<T, 'id' | 'createdAt' | 'updatedAt'>): T {
    return {
      ...data,
      id: this.generateId(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    } as T;
  }
}

export const dataService = new DataService();
