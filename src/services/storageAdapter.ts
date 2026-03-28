type StorageMap = Record<string, string>;

export interface StorageAdapter {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
  keys: () => string[];
}

type BackendStatus =
  | { online: false; offlineSince: number; unsyncedCount: number; latencyMs?: number }
  | { online: true; syncedAt: number; conflicts: Array<{ key: string; localTime?: number; remoteTime?: number }>; unsyncedCount: number; latencyMs?: number };

const dispatchStatus = (status: BackendStatus) => {
  const ev = new CustomEvent('storage-backend-status', { detail: status });
  window.dispatchEvent(ev);
};

const tryParseJson = (s: string | null): any | null => {
  if (!s) return null;
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
};

const getLocalLastModified = (s: string | null): number | undefined => {
  const obj = tryParseJson(s);
  const t = obj?.meta?.lastModified;
  return typeof t === 'number' ? t : undefined;
};

const getCurrentUserId = (): string | undefined => {
  const cuRaw = window.localStorage.getItem('trpg_current_user');
  const cu = tryParseJson(cuRaw);
  const id = cu?.id;
  return typeof id === 'string' && id ? id : undefined;
};

const getUserPrefix = (): string => {
  const id = getCurrentUserId() ?? 'default';
  return `trpg_u_${id}_`;
};

const getForcedMode = (): 'auto' | 'online' | 'offline' => {
  const m = window.localStorage.getItem('trpg_backend_mode');
  return m === 'online' || m === 'offline' ? m : 'auto';
};

const isUserKey = (key: string): boolean => {
  const prefix = getUserPrefix();
  return key.startsWith(prefix);
};

const createSmartAdapter = (
  initialRemote: StorageMap,
  initialMeta?: Record<string, { version: number; updatedAt: number }>,
  initialOnline: boolean = true
): StorageAdapter => {
  const remote = new Map<string, string>(Object.entries(initialRemote));
  let online = initialOnline;
  const pending = new Set<string>();
  let lastLatency: number | undefined = undefined;

  const persistSet = (key: string, value: string) => {
    if (!online || !isUserKey(key)) return;
    fetch(`/api/storage/${encodeURIComponent(key)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value }),
    }).catch(() => undefined);
  };

  const persistDelete = (key: string) => {
    if (!online || !isUserKey(key)) return;
    fetch(`/api/storage/${encodeURIComponent(key)}`, {
      method: 'DELETE',
    }).catch(() => undefined);
  };

  const initialSync = () => {
    const localKeys = Object.keys(window.localStorage).filter((k) => isUserKey(k));
    const conflicts: Array<{ key: string; localTime?: number; remoteTime?: number }> = [];
    for (const key of localKeys) {
      const localVal = window.localStorage.getItem(key);
      const remoteVal = remote.has(key) ? remote.get(key)! : null;
      if (remoteVal == null && localVal != null) {
        remote.set(key, localVal);
        persistSet(key, localVal);
        pending.delete(key);
        continue;
      }
      if (remoteVal != null && localVal == null) {
        window.localStorage.setItem(key, remoteVal);
        continue;
      }
      if (remoteVal != null && localVal != null) {
        const lt = getLocalLastModified(localVal);
        const rt = initialMeta?.[key]?.updatedAt ?? getLocalLastModified(remoteVal);
        if (lt !== undefined && rt !== undefined) {
          if (lt > rt) {
            remote.set(key, localVal);
            persistSet(key, localVal);
            pending.delete(key);
          } else if (rt > lt) {
            window.localStorage.setItem(key, remoteVal);
          } else {
            // equal, do nothing
          }
          if (lt !== rt) {
            conflicts.push({ key, localTime: lt, remoteTime: rt });
          }
        } else {
          if (localVal !== remoteVal) {
            window.localStorage.setItem(key, remoteVal);
            conflicts.push({ key });
          }
        }
      }
    }
    const remoteOnlyKeys = Array.from(remote.keys()).filter((k) => isUserKey(k) && !localKeys.includes(k));
    for (const key of remoteOnlyKeys) {
      const val = remote.get(key)!;
      window.localStorage.setItem(key, val);
    }
    if (online) {
      dispatchStatus({ online: true, syncedAt: Date.now(), conflicts, unsyncedCount: pending.size, latencyMs: lastLatency });
    } else {
      dispatchStatus({ online: false, offlineSince: Date.now(), unsyncedCount: pending.size, latencyMs: lastLatency });
    }
  };

  initialSync();

  const checkHealth = () => {
    const mode = getForcedMode();
    if (mode === 'offline') {
      if (online) {
        online = false;
        dispatchStatus({ online: false, offlineSince: Date.now(), unsyncedCount: pending.size, latencyMs: undefined });
      } else {
        dispatchStatus({ online: false, offlineSince: Date.now(), unsyncedCount: pending.size, latencyMs: undefined });
      }
      return;
    }
    const t0 = Date.now();
    fetch('/api/storage/health')
      .then((res) => {
        if (!res.ok) throw new Error('bad');
        lastLatency = Date.now() - t0;
        if (!online) {
          online = true;
          const prefix = getUserPrefix();
          if (prefix) {
            fetch(`/api/storage/all?prefix=${encodeURIComponent(prefix)}`)
              .then((r) => r.json())
              .then((data: StorageMap) => {
                remote.clear();
                Object.entries(data).forEach(([k, v]) => remote.set(k, v));
                fetch(`/api/storage/meta?prefix=${encodeURIComponent(prefix)}`)
                  .then((m) => m.json())
                  .then((meta) => {
                    initialMeta = meta as Record<string, { version: number; updatedAt: number }>;
                    initialSync();
                  })
                  .catch(() => initialSync());
              })
              .catch(() => undefined);
          }
        } else {
          dispatchStatus({ online: true, syncedAt: Date.now(), conflicts: [], unsyncedCount: pending.size, latencyMs: lastLatency });
        }
      })
      .catch(() => {
        if (online) {
          online = false;
          lastLatency = undefined;
          dispatchStatus({ online: false, offlineSince: Date.now(), unsyncedCount: pending.size, latencyMs: undefined });
        } else {
          dispatchStatus({ online: false, offlineSince: Date.now(), unsyncedCount: pending.size, latencyMs: undefined });
        }
      });
  };

  const timer = window.setInterval(checkHealth, 10000);
  window.addEventListener('beforeunload', () => {
    window.clearInterval(timer);
  });

  return {
    getItem: (key) => {
      if (online && remote.has(key)) return remote.get(key)!;
      return window.localStorage.getItem(key);
    },
    setItem: (key, value) => {
      window.localStorage.setItem(key, value);
      if (online) {
        remote.set(key, value);
        persistSet(key, value);
        pending.delete(key);
          dispatchStatus({ online: true, syncedAt: Date.now(), conflicts: [], unsyncedCount: pending.size, latencyMs: lastLatency });
      } else {
        if (isUserKey(key)) pending.add(key);
          dispatchStatus({ online: false, offlineSince: Date.now(), unsyncedCount: pending.size, latencyMs: lastLatency });
      }
    },
    removeItem: (key) => {
      window.localStorage.removeItem(key);
      if (online) {
        remote.delete(key);
        persistDelete(key);
        pending.delete(key);
          dispatchStatus({ online: true, syncedAt: Date.now(), conflicts: [], unsyncedCount: pending.size, latencyMs: lastLatency });
      } else {
        if (isUserKey(key)) pending.add(key);
          dispatchStatus({ online: false, offlineSince: Date.now(), unsyncedCount: pending.size, latencyMs: lastLatency });
      }
    },
    keys: () => {
      const set = new Set<string>(Object.keys(window.localStorage).filter((k) => isUserKey(k)));
      for (const k of remote.keys()) {
        if (isUserKey(k)) set.add(k);
      }
      return Array.from(set);
    },
  };
};

export const initializeStorageAdapter = async (): Promise<StorageAdapter> => {
  try {
    const mode = getForcedMode();
    let isOnline = false;
    if (mode !== 'offline') {
      const health = await fetch('/api/storage/health');
      isOnline = health.ok;
    }
    const userPrefix = getUserPrefix();
    let data: StorageMap = {};
    if (isOnline) {
      const all = await fetch(`/api/storage/all?prefix=${encodeURIComponent(userPrefix)}`);
      if (all.ok) {
        data = (await all.json()) as StorageMap;
      }
    }
    let meta: Record<string, { version: number; updatedAt: number }> | undefined;
    try {
      const metaUrl = isOnline ? `/api/storage/meta?prefix=${encodeURIComponent(userPrefix)}` : '/api/storage/meta';
      const m = await fetch(metaUrl);
      if (isOnline && m.ok) {
        const mobj = await m.json();
        meta = mobj as Record<string, { version: number; updatedAt: number }>;
      }
    } catch {
      meta = undefined;
    }
    const adapter = createSmartAdapter(data, meta, isOnline);
    return adapter;
  } catch {
    return createSmartAdapter({}, undefined, false);
  }
};
