import { useCallback, useEffect, useMemo, useState } from 'react';
import { NavigateFunction } from 'react-router-dom';
import { BaseEntity, CustomSubItem } from '../../../types';

export interface DetailSectionDef {
  key: string;
  title: string;
}

interface UseSectionedEntityDetailOptions<T extends BaseEntity> {
  id?: string;
  items: T[];
  navigate: NavigateFunction;
  listPath: string;
  navigateOnMissing?: boolean;
  initialCollapsed: Record<string, boolean>;
  sectionDefs: DetailSectionDef[];
  updateItem: (item: T) => void;
  deleteItem: (id: string) => void;
}

export const useSectionedEntityDetail = <T extends BaseEntity>({
  id,
  items,
  navigate,
  listPath,
  navigateOnMissing = true,
  initialCollapsed,
  sectionDefs,
  updateItem,
  deleteItem,
}: UseSectionedEntityDetailOptions<T>) => {
  const [entity, setEntity] = useState<T | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(initialCollapsed);

  useEffect(() => {
    const found = items.find((item) => item.id === id);
    if (found) {
      setEntity(found);
      return;
    }
    if (navigateOnMissing) {
      navigate(listPath);
    }
  }, [id, items, listPath, navigate, navigateOnMissing]);

  const commitEntity = useCallback((next: T) => {
    setEntity(next);
    updateItem(next);
  }, [updateItem]);

  const handleChange = useCallback(<K extends keyof T>(field: K, value: T[K]) => {
    setEntity((prev) => {
      if (!prev) return prev;
      const next = { ...prev, [field]: value };
      updateItem(next);
      return next;
    });
  }, [updateItem]);

  const handleDeleteAndNavigate = useCallback(() => {
    if (!id) return;
    deleteItem(id);
    navigate(listPath);
  }, [deleteItem, id, listPath, navigate]);

  const getSectionItems = useCallback((key: string): CustomSubItem[] => (
    entity?.sectionSubItems?.[key] || []
  ), [entity]);

  const setSectionItems = useCallback((key: string, itemsForSection: CustomSubItem[]) => {
    setEntity((prev) => {
      if (!prev) return prev;
      const next = {
        ...prev,
        sectionSubItems: {
          ...(prev.sectionSubItems || {}),
          [key]: itemsForSection,
        },
      };
      updateItem(next);
      return next;
    });
  }, [updateItem]);

  const getSectionTitle = useCallback((key: string, fallback: string) => (
    entity?.sectionTitles?.[key] || fallback
  ), [entity]);

  const setSectionTitle = useCallback((key: string, title: string) => {
    setEntity((prev) => {
      if (!prev) return prev;
      const next = {
        ...prev,
        sectionTitles: {
          ...(prev.sectionTitles || {}),
          [key]: title,
        },
      };
      updateItem(next);
      return next;
    });
  }, [updateItem]);

  const isSectionVisible = useCallback((key: string) => entity?.sectionVisibility?.[key] !== false, [entity]);

  const setSectionVisible = useCallback((key: string, visible: boolean) => {
    setEntity((prev) => {
      if (!prev) return prev;
      const next = {
        ...prev,
        sectionVisibility: {
          ...(prev.sectionVisibility || {}),
          [key]: visible,
        },
      };
      updateItem(next);
      return next;
    });
  }, [updateItem]);

  const addCustomSection = useCallback(() => {
    const name = window.prompt('请输入新内置区块名称', '新内置区块');
    if (!name || !name.trim()) return;
    const key = `custom_${Date.now()}`;
    setEntity((prev) => {
      if (!prev) return prev;
      const next = {
        ...prev,
        customSections: [...(prev.customSections || []), key],
        sectionTitles: { ...(prev.sectionTitles || {}), [key]: name.trim() },
        sectionVisibility: { ...(prev.sectionVisibility || {}), [key]: true },
        sectionSubItems: { ...(prev.sectionSubItems || {}), [key]: [] },
      };
      updateItem(next);
      return next;
    });
    setCollapsed((prev) => ({ ...prev, [key]: true }));
  }, [updateItem]);

  const removeCustomSection = useCallback((key: string) => {
    setEntity((prev) => {
      if (!prev) return prev;
      const nextTitles = { ...(prev.sectionTitles || {}) };
      const nextVisibility = { ...(prev.sectionVisibility || {}) };
      const nextSubItems = { ...(prev.sectionSubItems || {}) };
      delete nextTitles[key];
      delete nextVisibility[key];
      delete nextSubItems[key];
      const next = {
        ...prev,
        customSections: (prev.customSections || []).filter((sectionKey) => sectionKey !== key),
        sectionTitles: nextTitles,
        sectionVisibility: nextVisibility,
        sectionSubItems: nextSubItems,
      };
      updateItem(next);
      return next;
    });
  }, [updateItem]);

  const visibleSectionKeys = useMemo(() => {
    if (!entity) return [];
    return [
      ...sectionDefs.filter((section) => isSectionVisible(section.key)).map((section) => section.key),
      ...(entity.customSections || []),
    ];
  }, [entity, isSectionVisible, sectionDefs]);

  const allVisibleExpanded = useMemo(() => (
    visibleSectionKeys.length > 0 && visibleSectionKeys.every((key) => collapsed[key] === false)
  ), [collapsed, visibleSectionKeys]);

  const toggleAllSections = useCallback(() => {
    const nextCollapsed = allVisibleExpanded;
    setCollapsed((prev) => {
      const next = { ...prev };
      for (const sectionKey of visibleSectionKeys) {
        next[sectionKey] = nextCollapsed;
      }
      return next;
    });
  }, [allVisibleExpanded, visibleSectionKeys]);

  return {
    entity,
    collapsed,
    setCollapsed,
    commitEntity,
    handleChange,
    handleDeleteAndNavigate,
    getSectionItems,
    setSectionItems,
    getSectionTitle,
    setSectionTitle,
    isSectionVisible,
    setSectionVisible,
    addCustomSection,
    removeCustomSection,
    visibleSectionKeys,
    allVisibleExpanded,
    toggleAllSections,
  };
};
