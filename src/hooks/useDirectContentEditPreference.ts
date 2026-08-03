import { useEffect, useState } from 'react';

const STORAGE_KEY = 'trpg_direct_content_edit';
const PREFERENCE_EVENT = 'trpg:direct-content-edit-change';

const readPreference = (): boolean => {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(STORAGE_KEY) === 'true';
};

export const useDirectContentEditPreference = () => {
  const [directContentEdit, setDirectContentEditState] = useState(readPreference);

  useEffect(() => {
    const syncPreference = () => setDirectContentEditState(readPreference());
    window.addEventListener('storage', syncPreference);
    window.addEventListener(PREFERENCE_EVENT, syncPreference);
    return () => {
      window.removeEventListener('storage', syncPreference);
      window.removeEventListener(PREFERENCE_EVENT, syncPreference);
    };
  }, []);

  const setDirectContentEdit = (enabled: boolean) => {
    window.localStorage.setItem(STORAGE_KEY, String(enabled));
    window.dispatchEvent(new Event(PREFERENCE_EVENT));
  };

  return { directContentEdit, setDirectContentEdit };
};
