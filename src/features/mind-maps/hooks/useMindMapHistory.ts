import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  MindMapDocument,
  MindMapHistoryState,
  UserProfile,
} from '../../../types';
import {
  MindMapHistoryConflictError,
  mindMapHistoryService,
} from '../../../services/mindMapHistoryService';

const HISTORY_LIMIT = 60;
const HISTORY_SAVE_DELAY_MS = 350;

export type MindMapHistorySyncStatus =
  | 'loading'
  | 'ready'
  | 'saving'
  | 'error';

interface UseMindMapHistoryOptions {
  activeMindMap: MindMapDocument | null;
  campaignId: string | null;
  user: UserProfile | null;
  persistMindMap: (mindMap: MindMapDocument) => void;
}

const EMPTY_HISTORY: MindMapHistoryState = {
  past: [],
  future: [],
};

export const recordMindMapHistory = (
  history: MindMapHistoryState,
  current: MindMapDocument
): MindMapHistoryState => ({
  past: [...history.past.slice(-(HISTORY_LIMIT - 1)), current],
  future: [],
});

export const undoMindMapHistory = (
  history: MindMapHistoryState,
  current: MindMapDocument
): { history: MindMapHistoryState; target: MindMapDocument } | null => {
  if (history.past.length === 0) return null;
  return {
    target: history.past[history.past.length - 1],
    history: {
      past: history.past.slice(0, -1),
      future: [current, ...history.future].slice(0, HISTORY_LIMIT),
    },
  };
};

export const redoMindMapHistory = (
  history: MindMapHistoryState,
  current: MindMapDocument
): { history: MindMapHistoryState; target: MindMapDocument } | null => {
  if (history.future.length === 0) return null;
  return {
    target: history.future[0],
    history: {
      past: [...history.past.slice(-(HISTORY_LIMIT - 1)), current],
      future: history.future.slice(1),
    },
  };
};

const mergeLoadedHistories = (
  loaded: Record<string, MindMapHistoryState>,
  local: Record<string, MindMapHistoryState>
) => {
  const result = { ...loaded };
  Object.entries(local).forEach(([mindMapId, localHistory]) => {
    const loadedHistory = loaded[mindMapId] || EMPTY_HISTORY;
    result[mindMapId] = {
      past: [...loadedHistory.past, ...localHistory.past].slice(-HISTORY_LIMIT),
      future: localHistory.future.slice(0, HISTORY_LIMIT),
    };
  });
  return result;
};

export const useMindMapHistory = ({
  activeMindMap,
  campaignId,
  user,
  persistMindMap,
}: UseMindMapHistoryOptions) => {
  const [histories, setHistories] = useState<Record<string, MindMapHistoryState>>({});
  const [syncStatus, setSyncStatus] = useState<MindMapHistorySyncStatus>('loading');
  const historiesRef = useRef<Record<string, MindMapHistoryState>>({});
  const versionRef = useRef(1);
  const hydratedRef = useRef(false);
  const dirtyRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestGenerationRef = useRef(0);

  const activeHistory = useMemo(
    () => (activeMindMap ? histories[activeMindMap.id] || EMPTY_HISTORY : EMPTY_HISTORY),
    [activeMindMap, histories]
  );

  const persistHistories = useCallback(async (keepalive = false) => {
    if (!campaignId || !user || !hydratedRef.current || !dirtyRef.current) return;
    const requestGeneration = ++requestGenerationRef.current;
    let payload = historiesRef.current;
    if (!keepalive) {
      setSyncStatus('saving');
    }

    try {
      let saved;
      try {
        saved = await mindMapHistoryService.save(
          campaignId,
          user,
          payload,
          versionRef.current,
          keepalive
        );
      } catch (error) {
        if (!(error instanceof MindMapHistoryConflictError)) throw error;
        versionRef.current = error.current.version;
        const localPayload = payload;
        payload = mergeLoadedHistories(error.current.histories || {}, localPayload);
        if (historiesRef.current === localPayload) {
          historiesRef.current = payload;
          setHistories(payload);
        }
        saved = await mindMapHistoryService.save(
          campaignId,
          user,
          payload,
          versionRef.current,
          keepalive
        );
      }
      if (requestGeneration !== requestGenerationRef.current) return;
      versionRef.current = saved.version;
      dirtyRef.current = historiesRef.current !== payload;
      if (!keepalive) {
        setSyncStatus(dirtyRef.current ? 'saving' : 'ready');
      }
    } catch {
      if (!keepalive && requestGeneration === requestGenerationRef.current) {
        setSyncStatus('error');
      }
    }
  }, [campaignId, user]);

  const scheduleHistorySave = useCallback(() => {
    dirtyRef.current = true;
    if (!hydratedRef.current) return;
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null;
      void persistHistories();
    }, HISTORY_SAVE_DELAY_MS);
  }, [persistHistories]);

  const updateHistories = useCallback((
    updater: (
      current: Record<string, MindMapHistoryState>
    ) => Record<string, MindMapHistoryState>
  ) => {
    const next = updater(historiesRef.current);
    historiesRef.current = next;
    setHistories(next);
    scheduleHistorySave();
  }, [scheduleHistorySave]);

  useEffect(() => {
    let active = true;
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    historiesRef.current = {};
    setHistories({});
    versionRef.current = 1;
    hydratedRef.current = false;
    dirtyRef.current = false;
    requestGenerationRef.current += 1;

    if (!campaignId || !user) {
      setSyncStatus('error');
      return () => {
        active = false;
      };
    }

    setSyncStatus('loading');
    const flushBeforePageExit = () => {
      void persistHistories(true);
    };
    const flushWhenHidden = () => {
      if (document.visibilityState === 'hidden') {
        flushBeforePageExit();
      }
    };
    window.addEventListener('pagehide', flushBeforePageExit);
    document.addEventListener('visibilitychange', flushWhenHidden);
    void mindMapHistoryService.load(campaignId, user)
      .then((document) => {
        if (!active) return;
        versionRef.current = document.version;
        const merged = mergeLoadedHistories(document.histories || {}, historiesRef.current);
        const hadLocalChanges = dirtyRef.current;
        historiesRef.current = merged;
        setHistories(merged);
        hydratedRef.current = true;
        setSyncStatus('ready');
        if (hadLocalChanges) {
          scheduleHistorySave();
        }
      })
      .catch(() => {
        if (!active) return;
        hydratedRef.current = true;
        setSyncStatus('error');
      });

    return () => {
      active = false;
      window.removeEventListener('pagehide', flushBeforePageExit);
      document.removeEventListener('visibilitychange', flushWhenHidden);
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      if (hydratedRef.current && dirtyRef.current) {
        void persistHistories(true);
      }
    };
  }, [campaignId, persistHistories, scheduleHistorySave, user]);

  const commitMindMap = useCallback((nextMindMap: MindMapDocument) => {
    if (
      !activeMindMap
      || nextMindMap.id !== activeMindMap.id
      || nextMindMap === activeMindMap
    ) {
      return;
    }
    updateHistories((current) => {
      const history = current[activeMindMap.id] || EMPTY_HISTORY;
      return {
        ...current,
        [activeMindMap.id]: recordMindMapHistory(history, activeMindMap),
      };
    });
    persistMindMap(nextMindMap);
  }, [activeMindMap, persistMindMap, updateHistories]);

  const undo = useCallback(() => {
    if (!activeMindMap) return;
    const history = historiesRef.current[activeMindMap.id] || EMPTY_HISTORY;
    const result = undoMindMapHistory(history, activeMindMap);
    if (!result) return;
    updateHistories((current) => ({
      ...current,
      [activeMindMap.id]: result.history,
    }));
    persistMindMap(result.target);
  }, [activeMindMap, persistMindMap, updateHistories]);

  const redo = useCallback(() => {
    if (!activeMindMap) return;
    const history = historiesRef.current[activeMindMap.id] || EMPTY_HISTORY;
    const result = redoMindMapHistory(history, activeMindMap);
    if (!result) return;
    updateHistories((current) => ({
      ...current,
      [activeMindMap.id]: result.history,
    }));
    persistMindMap(result.target);
  }, [activeMindMap, persistMindMap, updateHistories]);

  const discardHistory = useCallback((mindMapId: string) => {
    if (!historiesRef.current[mindMapId]) return;
    updateHistories((current) => {
      const next = { ...current };
      delete next[mindMapId];
      return next;
    });
  }, [updateHistories]);

  return {
    canUndo: activeHistory.past.length > 0,
    canRedo: activeHistory.future.length > 0,
    syncStatus,
    commitMindMap,
    undo,
    redo,
    discardHistory,
  };
};
