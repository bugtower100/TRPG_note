import { markdownToPreviewText } from '../components/common/richTextReference';
import type { BaseEntity } from '../types';

export const getEntitySearchContent = (entity: BaseEntity): string => {
  const fields = entity as unknown as Record<string, unknown>;
  const fixedText = ['identity', 'appearance', 'desireOrGoal', 'attributes', 'type', 'stats', 'abilities', 'drops', 'environment', 'notes', 'time', 'revealTarget']
    .map((key) => typeof fields[key] === 'string' ? fields[key] : '');
  const items = [...(entity.customSubItems || []), ...Object.values(entity.sectionSubItems || {}).flat()];
  const timelineEvents = Array.isArray(fields.timelineEvents) ? fields.timelineEvents as Array<{ title?: string; time?: string; content?: string }> : [];
  const content = [
    entity.name, entity.details, ...fixedText, ...(entity.keywords || []), ...(entity.tags || []),
    ...Object.values(entity.sectionTitles || {}),
    ...items.flatMap((item) => [item.title, item.content]),
    ...timelineEvents.flatMap((event) => [event.title, event.time, event.content]),
  ].filter(Boolean).join('\n\n');
  return markdownToPreviewText(content).replace(/\s+/g, ' ').toLowerCase();
};

export const getSearchExcerpt = (content: string, query: string): string => {
  const index = content.indexOf(query.trim().toLocaleLowerCase());
  const start = Math.max(0, index - 30);
  const end = Math.min(content.length, Math.max(0, index) + query.trim().length + 65);
  return `${start ? '…' : ''}${content.slice(start, end)}${end < content.length ? '…' : ''}`;
};
