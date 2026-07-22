import type { TimelineEvent } from '../types';

export const TIMELINE_PRIORITY_MIN = 0;
export const TIMELINE_PRIORITY_MAX = 10;

export const normalizeTimelinePriority = (value: unknown): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return TIMELINE_PRIORITY_MIN;
  return Math.min(TIMELINE_PRIORITY_MAX, Math.max(TIMELINE_PRIORITY_MIN, Math.round(value)));
};

export const getTimelineEventPriority = (event: Pick<TimelineEvent, 'priority'>): number => (
  normalizeTimelinePriority(event.priority)
);
