import { v4 as uuidv4 } from 'uuid';
import type { BaseEntity, EntityTemplate, GraphEntityType, CustomSubItem } from '../types';

const copyItems = (items: CustomSubItem[] = [], structureOnly = false) => items.map((item) => ({
  ...item, id: uuidv4(), content: structureOnly ? '' : item.content,
}));

export const copyEntity = <T extends BaseEntity>(entity: T, name: string): T => {
  const copy = structuredClone(entity);
  copy.id = uuidv4();
  copy.name = name;
  copy.keywords = [];
  copy.createdAt = copy.updatedAt = Date.now();
  delete copy.sortOrder;
  copy.customSubItems = copyItems(copy.customSubItems);
  copy.sectionSubItems = Object.fromEntries(Object.entries(copy.sectionSubItems || {}).map(([key, items]) => [key, copyItems(items)]));
  if ('timelineEvents' in copy && Array.isArray(copy.timelineEvents)) {
    copy.timelineEvents = copy.timelineEvents.map((item) => ({ ...item, id: uuidv4() }));
  }
  return copy;
};

export const makeEntityTemplate = (entity: BaseEntity, entityType: GraphEntityType, name: string): EntityTemplate => ({
  id: uuidv4(), name, entityType,
  structure: structuredClone({
    sectionTitles: entity.sectionTitles, sectionOrder: entity.sectionOrder,
    sectionVisibility: entity.sectionVisibility, sectionLinkEnabled: entity.sectionLinkEnabled,
    customSections: entity.customSections,
    customSubItems: copyItems(entity.customSubItems, true),
    sectionSubItems: Object.fromEntries(Object.entries(entity.sectionSubItems || {}).map(([key, items]) => [key, copyItems(items, true)])),
  }),
});

export const createFromEntityTemplate = (template: EntityTemplate, name: string): BaseEntity => {
  const defaults: Record<GraphEntityType, object> = {
    characters: { identity: '', appearance: '', desireOrGoal: '', attributes: '', relations: [] },
    monsters: { type: '', stats: '', abilities: '', drops: '', relations: [] },
    locations: { environment: '', relations: [] }, organizations: { notes: '', relations: [] },
    events: { time: '', relations: [] }, clues: { type: '', relations: [], revealStatus: 'untracked' },
    timelines: { timelineEvents: [] },
  };
  return copyEntity({ ...template.structure, ...defaults[template.entityType], id: '', name, details: '', relatedImages: [], createdAt: 0, updatedAt: 0 }, name);
};
