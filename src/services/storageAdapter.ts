type StorageMap = Record<string, string>;

export interface StorageAdapter {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
  keys: () => string[];
}

const createBrowserStorageAdapter = (): StorageAdapter => ({
  getItem: (key) => window.localStorage.getItem(key),
  setItem: (key, value) => window.localStorage.setItem(key, value),
  removeItem: (key) => window.localStorage.removeItem(key),
  keys: () => Object.keys(window.localStorage),
});

const createServerBackedAdapter = (initial: StorageMap): StorageAdapter => {
  const map = new Map<string, string>(Object.entries(initial));

  const persistSet = (key: string, value: string) => {
    fetch(`/api/storage/${encodeURIComponent(key)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value }),
    }).catch(() => undefined);
  };

  const persistDelete = (key: string) => {
    fetch(`/api/storage/${encodeURIComponent(key)}`, {
      method: 'DELETE',
    }).catch(() => undefined);
  };

  return {
    getItem: (key) => (map.has(key) ? map.get(key)! : null),
    setItem: (key, value) => {
      map.set(key, value);
      persistSet(key, value);
    },
    removeItem: (key) => {
      map.delete(key);
      persistDelete(key);
    },
    keys: () => Array.from(map.keys()),
  };
};

export const initializeStorageAdapter = async (): Promise<StorageAdapter> => {
  try {
    const health = await fetch('/api/storage/health');
    if (!health.ok) return createBrowserStorageAdapter();
    const all = await fetch('/api/storage/all');
    if (!all.ok) return createBrowserStorageAdapter();
    const data = (await all.json()) as StorageMap;
    return createServerBackedAdapter(data);
  } catch {
    return createBrowserStorageAdapter();
  }
};

