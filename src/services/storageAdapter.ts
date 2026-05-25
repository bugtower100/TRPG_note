type StorageMap = Record<string, string>;
type StorageMetaMap = Record<string, { version: number; updatedAt: number }>;
type PendingShadowRecord =
  | { type: 'set'; value: string; updatedAt: number }
  | { type: 'delete'; updatedAt: number };

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

const PENDING_KEY_PREFIX = '__trpg_pending__';

const getPendingShadowKey = (key: string) => `${PENDING_KEY_PREFIX}${key}`;

const isPendingShadowKey = (key: string) => key.startsWith(PENDING_KEY_PREFIX);

const getSourceKeyFromPendingShadow = (pendingKey: string) =>
  isPendingShadowKey(pendingKey) ? pendingKey.slice(PENDING_KEY_PREFIX.length) : pendingKey;

type PendingMutation =
  | { type: 'set'; value: string; opId: number }
  | { type: 'delete'; opId: number };

const getPayloadLastModified = (value: string | null): number | undefined => getLocalLastModified(value);

const createSmartAdapter = (
  initialRemote: StorageMap,
  initialMeta?: StorageMetaMap,
  initialOnline: boolean = true
): StorageAdapter => {
  const remote = new Map<string, string>(Object.entries(initialRemote));
  const remoteMeta = new Map<string, { version: number; updatedAt: number }>(
    Object.entries(initialMeta || {})
  );
  let online = initialOnline;
  const pending = new Map<string, PendingMutation>();
  let lastLatency: number | undefined = undefined;
  let opSeq = 0;

  const emitStatus = (
    conflicts: Array<{ key: string; localTime?: number; remoteTime?: number }> = []
  ) => {
    if (online) {
      dispatchStatus({
        online: true,
        syncedAt: Date.now(),
        conflicts,
        unsyncedCount: pending.size,
        latencyMs: lastLatency,
      });
      return;
    }
    dispatchStatus({
      online: false,
      offlineSince: Date.now(),
      unsyncedCount: pending.size,
      latencyMs: lastLatency,
    });
  };

  const getCurrentPending = (key: string) => pending.get(key);

  const writePendingShadow = (key: string, mutation: PendingMutation) => {
    const shadow: PendingShadowRecord =
      mutation.type === 'set'
        ? { type: 'set', value: mutation.value, updatedAt: Date.now() }
        : { type: 'delete', updatedAt: Date.now() };
    window.localStorage.setItem(getPendingShadowKey(key), JSON.stringify(shadow));
  };

  const removePendingShadow = (key: string) => {
    window.localStorage.removeItem(getPendingShadowKey(key));
  };

  const queueMutation = (key: string, mutation: PendingMutation, persistShadow = true) => {
    if (!isUserKey(key)) return;
    pending.set(key, mutation);
    if (persistShadow) {
      writePendingShadow(key, mutation);
    }
    emitStatus();
  };

  const clearMutationIfCurrent = (key: string, opId: number) => {
    const current = getCurrentPending(key);
    if (current?.opId !== opId) return false;
    pending.delete(key);
    removePendingShadow(key);
    return true;
  };

  const restorePendingFromLocalShadows = () => {
    const pendingKeys = Object.keys(window.localStorage).filter((key) => isPendingShadowKey(key));
    for (const pendingKey of pendingKeys) {
      const sourceKey = getSourceKeyFromPendingShadow(pendingKey);
      if (!isUserKey(sourceKey)) continue;
      const raw = window.localStorage.getItem(pendingKey);
      const parsed = tryParseJson(raw) as PendingShadowRecord | null;
      if (!parsed || (parsed.type !== 'set' && parsed.type !== 'delete')) {
        window.localStorage.removeItem(pendingKey);
        continue;
      }
      if (parsed.type === 'set' && typeof parsed.value === 'string') {
        queueMutation(sourceKey, { type: 'set', value: parsed.value, opId: ++opSeq }, false);
      } else if (parsed.type === 'delete') {
        queueMutation(sourceKey, { type: 'delete', opId: ++opSeq }, false);
      } else {
        window.localStorage.removeItem(pendingKey);
      }
    }
  };

  const fetchRemoteRecord = async (key: string) => {
    const response = await fetch(`/api/storage/${encodeURIComponent(key)}`);
    if (response.status === 404) return null;
    if (!response.ok) throw new Error('load_remote_failed');
    const payload = await response.json();
    return {
      value: String(payload.value ?? ''),
      version: Number(payload.version ?? 1),
      updatedAt: Number(payload.updatedAt ?? Date.now()),
    };
  };

  const persistSet = async (key: string, value: string, opId: number) => {
    if (!online || !isUserKey(key)) return;
    const expectedVersion = remoteMeta.get(key)?.version;
    try {
      const response = await fetch(`/api/storage/${encodeURIComponent(key)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          value,
          ...(expectedVersion !== undefined ? { expectedVersion } : {}),
        }),
      });
      if (response.status === 409) {
        const remoteRecord = await fetchRemoteRecord(key);
        if (remoteRecord) {
          remote.set(key, remoteRecord.value);
          remoteMeta.set(key, {
            version: remoteRecord.version,
            updatedAt: remoteRecord.updatedAt,
          });
          if (clearMutationIfCurrent(key, opId)) {
            window.localStorage.setItem(key, remoteRecord.value);
          }
          emitStatus([
            {
              key,
              localTime: getPayloadLastModified(value),
              remoteTime: remoteRecord.updatedAt,
            },
          ]);
          return;
        }
      }
      if (!response.ok) {
        throw new Error(`save_failed_${response.status}`);
      }
      const payload = await response.json();
      remote.set(key, value);
      remoteMeta.set(key, {
        version: Number(payload.version ?? (expectedVersion || 0) + 1),
        updatedAt: Number(payload.updatedAt ?? Date.now()),
      });
      window.localStorage.setItem(key, value);
      clearMutationIfCurrent(key, opId);
      emitStatus();
    } catch {
      emitStatus();
    }
  };

  const persistDelete = async (key: string, opId: number) => {
    if (!online || !isUserKey(key)) return;
    const expectedVersion = remoteMeta.get(key)?.version;
    try {
      const response = await fetch(`/api/storage/${encodeURIComponent(key)}`, {
        method: 'DELETE',
        headers: expectedVersion !== undefined ? { 'X-TRPG-Expected-Version': String(expectedVersion) } : undefined,
      });
      if (response.status === 409) {
        const remoteRecord = await fetchRemoteRecord(key);
        if (remoteRecord) {
          remote.set(key, remoteRecord.value);
          remoteMeta.set(key, {
            version: remoteRecord.version,
            updatedAt: remoteRecord.updatedAt,
          });
          if (clearMutationIfCurrent(key, opId)) {
            window.localStorage.setItem(key, remoteRecord.value);
          }
          emitStatus([{ key, remoteTime: remoteRecord.updatedAt }]);
          return;
        }
      }
      if (!response.ok && response.status !== 204 && response.status !== 404) {
        throw new Error(`delete_failed_${response.status}`);
      }
      remote.delete(key);
      remoteMeta.delete(key);
      window.localStorage.removeItem(key);
      clearMutationIfCurrent(key, opId);
      emitStatus();
    } catch {
      emitStatus();
    }
  };

  const flushPending = () => {
    if (!online || pending.size === 0) return;
    for (const [key, mutation] of pending.entries()) {
      if (mutation.type === 'set') {
        void persistSet(key, mutation.value, mutation.opId);
      } else {
        void persistDelete(key, mutation.opId);
      }
    }
  };

  const reloadRemoteState = async () => {
    const prefix = getUserPrefix();
    if (!prefix) return;
    const [allResponse, metaResponse] = await Promise.all([
      fetch(`/api/storage/all?prefix=${encodeURIComponent(prefix)}`),
      fetch(`/api/storage/meta?prefix=${encodeURIComponent(prefix)}`),
    ]);
    if (!allResponse.ok) {
      throw new Error('load_all_failed');
    }
    const nextRemote = (await allResponse.json()) as StorageMap;
    remote.clear();
    Object.entries(nextRemote).forEach(([k, v]) => remote.set(k, v));
    remoteMeta.clear();
    if (metaResponse.ok) {
      const nextMeta = (await metaResponse.json()) as StorageMetaMap;
      Object.entries(nextMeta).forEach(([k, v]) => remoteMeta.set(k, v));
    }
    initialSync();
  };

  const initialSync = () => {
    const localKeys = Object.keys(window.localStorage).filter((k) => isUserKey(k));
    const conflicts: Array<{ key: string; localTime?: number; remoteTime?: number }> = [];
    for (const key of localKeys) {
      const localVal = window.localStorage.getItem(key);
      const remoteVal = remote.has(key) ? remote.get(key)! : null;
      const pendingMutation = pending.get(key);
      if (remoteVal == null && localVal != null) {
        if (!pendingMutation) {
          queueMutation(key, { type: 'set', value: localVal, opId: ++opSeq });
        }
        continue;
      }
      if (remoteVal != null && localVal == null) {
        if (pendingMutation?.type !== 'delete') {
          window.localStorage.setItem(key, remoteVal);
        }
        continue;
      }
      if (remoteVal != null && localVal != null) {
        if (pendingMutation) {
          continue;
        }
        if (localVal !== remoteVal) {
          const lt = getLocalLastModified(localVal);
          const rt = remoteMeta.get(key)?.updatedAt ?? getLocalLastModified(remoteVal);
          window.localStorage.setItem(key, remoteVal);
          conflicts.push({ key, localTime: lt, remoteTime: rt });
        }
      }
    }
    const remoteOnlyKeys = Array.from(remote.keys()).filter((k) => isUserKey(k) && !localKeys.includes(k));
    for (const key of remoteOnlyKeys) {
      if (pending.get(key)?.type !== 'delete') {
        const val = remote.get(key)!;
        window.localStorage.setItem(key, val);
      }
    }
    emitStatus(conflicts);
    flushPending();
  };

  restorePendingFromLocalShadows();
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
          void reloadRemoteState().catch(() => undefined);
        } else {
          emitStatus();
          flushPending();
        }
      })
      .catch(() => {
        if (online) {
          online = false;
          lastLatency = undefined;
          emitStatus();
        } else {
          emitStatus();
        }
      });
  };

  let lastForegroundRefreshAt = 0;
  const triggerForegroundRefresh = () => {
    if (!online) {
      checkHealth();
      return;
    }
    const now = Date.now();
    if (now - lastForegroundRefreshAt < 1500) return;
    lastForegroundRefreshAt = now;
    void reloadRemoteState().catch(() => undefined);
  };

  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      triggerForegroundRefresh();
    }
  };

  const timer = window.setInterval(checkHealth, 10000);
  window.addEventListener('focus', triggerForegroundRefresh);
  document.addEventListener('visibilitychange', handleVisibilityChange);
  window.addEventListener('beforeunload', () => {
    window.clearInterval(timer);
    window.removeEventListener('focus', triggerForegroundRefresh);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  });

  return {
    getItem: (key) => {
      const pendingMutation = pending.get(key);
      if (pendingMutation?.type === 'delete') return null;
      if (pendingMutation?.type === 'set') return pendingMutation.value;
      if (online && remote.has(key)) return remote.get(key)!;
      return window.localStorage.getItem(key);
    },
    setItem: (key, value) => {
      if (!isUserKey(key)) {
        window.localStorage.setItem(key, value);
      }
      if (online) {
        const opId = ++opSeq;
        queueMutation(key, { type: 'set', value, opId });
        void persistSet(key, value, opId);
      } else {
        if (isUserKey(key)) {
          queueMutation(key, { type: 'set', value, opId: ++opSeq });
        } else {
          emitStatus();
        }
      }
    },
    removeItem: (key) => {
      if (!isUserKey(key)) {
        window.localStorage.removeItem(key);
      }
      if (online) {
        const opId = ++opSeq;
        queueMutation(key, { type: 'delete', opId });
        void persistDelete(key, opId);
      } else {
        if (isUserKey(key)) {
          queueMutation(key, { type: 'delete', opId: ++opSeq });
        } else {
          emitStatus();
        }
      }
    },
    keys: () => {
      const set = new Set<string>(Object.keys(window.localStorage).filter((k) => isUserKey(k)));
      for (const [key, mutation] of pending.entries()) {
        if (mutation.type === 'delete') {
          set.delete(key);
        } else {
          set.add(key);
        }
      }
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
