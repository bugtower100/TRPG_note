import { BaseEntity, CustomSubItem, GraphEntityType, SharedEntitySnapshot, ShareScope, Timeline } from '../types';

const cloneItems = (items: CustomSubItem[]) => items.map((item) => ({ ...item }));

export const buildSharedSnapshot = (
  entityType: GraphEntityType,
  entity: BaseEntity,
  scope: ShareScope,
  scopeId?: string
): SharedEntitySnapshot => {
  const timeline = entityType === 'timelines' ? (entity as Timeline) : null;
  const sectionTitles = entity.sectionTitles || {};
  const sectionSubItems = entity.sectionSubItems || {};
  const allSections = Object.entries(sectionSubItems).map(([key, items]) => ({
    key,
    title: sectionTitles[key] || '未命名区块',
    items: cloneItems(items || []),
  }));

  if (scope === 'entity') {
    return {
      entityName: entity.name,
      entityType,
      scope,
      details: entity.details,
      timelineEvents: timeline ? timeline.timelineEvents.map((item) => ({ ...item })) : undefined,
      allSections,
    };
  }

  if (scope === 'section' && scopeId) {
    return {
      entityName: entity.name,
      entityType,
      scope,
      sectionKey: scopeId,
      sectionTitle: sectionTitles[scopeId] || '未命名区块',
      sectionItems: cloneItems(sectionSubItems[scopeId] || []),
    };
  }

  if (scope === 'subItem' && scopeId) {
    for (const [sectionKey, items] of Object.entries(sectionSubItems)) {
      const found = (items || []).find((item) => item.id === scopeId);
      if (!found) continue;
      return {
        entityName: entity.name,
        entityType,
        scope,
        sectionKey,
        sectionTitle: sectionTitles[sectionKey] || '未命名区块',
        subItemId: found.id,
        subItemTitle: found.title,
        subItem: { ...found },
      };
    }
  }

  return {
    entityName: entity.name,
    entityType,
    scope: 'entity',
    details: entity.details,
    timelineEvents: timeline ? timeline.timelineEvents.map((item) => ({ ...item })) : undefined,
    allSections,
  };
};
