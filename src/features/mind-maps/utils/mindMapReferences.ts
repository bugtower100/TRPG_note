import type {
  CampaignData,
  GraphEntityType,
  MindMapEntityReference,
} from '../../../types';
import type {
  RichKeywordData,
  TooltipTargetPayload,
} from '../../../components/common/richTextReference';

export const MIND_MAP_ENTITY_TYPE_LABELS: Record<GraphEntityType, string> = {
  characters: '人物',
  monsters: '怪物',
  locations: '地点',
  organizations: '组织',
  events: '事件',
  clues: '线索',
  timelines: '时间线',
};

const MIND_MAP_ENTITY_TYPES = Object.keys(
  MIND_MAP_ENTITY_TYPE_LABELS
) as GraphEntityType[];

export interface MindMapEntityOption {
  key: string;
  entityType: GraphEntityType;
  entityId: string;
  name: string;
  typeLabel: string;
}

export interface MindMapKeywordSegment {
  text: string;
  target?: TooltipTargetPayload;
}

export const mindMapEntityReferenceKey = (
  reference: MindMapEntityReference
) => `${reference.entityType}:${reference.entityId}`;

export const buildMindMapEntityOptions = (
  campaignData: Pick<
    CampaignData,
    | 'characters'
    | 'monsters'
    | 'locations'
    | 'organizations'
    | 'events'
    | 'clues'
    | 'timelines'
  >
): MindMapEntityOption[] => (
  MIND_MAP_ENTITY_TYPES.flatMap((entityType) => (
    campaignData[entityType].map((entity) => ({
      key: mindMapEntityReferenceKey({
        entityType,
        entityId: entity.id,
      }),
      entityType,
      entityId: entity.id,
      name: entity.name || '未命名',
      typeLabel: MIND_MAP_ENTITY_TYPE_LABELS[entityType],
    }))
  ))
);

const keywordRegexCache = new WeakMap<RichKeywordData, RegExp>();

const getKeywordRegex = (keywordData: RichKeywordData) => {
  const cached = keywordRegexCache.get(keywordData);
  if (cached) {
    cached.lastIndex = 0;
    return cached;
  }
  const escapedKeywords = keywordData.allKeywords.map(
    (keyword) => keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  );
  const regex = new RegExp(`(${escapedKeywords.join('|')})`, 'gi');
  keywordRegexCache.set(keywordData, regex);
  return regex;
};

export const tokenizeMindMapKeywords = (
  text: string,
  keywordData: RichKeywordData
): MindMapKeywordSegment[] => {
  if (!text || keywordData.allKeywords.length === 0) {
    return [{ text }];
  }

  const regex = getKeywordRegex(keywordData);
  const segments: MindMapKeywordSegment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ text: text.slice(lastIndex, match.index) });
    }

    const matchedText = match[0];
    const keyword = matchedText.toLowerCase();
    const entity = keywordData.entityMap.get(keyword);
    const section = keywordData.sectionTitleMap.get(keyword)?.[0];
    if (entity) {
      segments.push({
        text: matchedText,
        target: {
          entityType: entity.type,
          entityId: entity.id,
          title: entity.name,
        },
      });
    } else if (section) {
      segments.push({
        text: matchedText,
        target: {
          entityType: section.entityType,
          entityId: section.entityId,
          title: section.entityName,
          targetSectionTitleLower: section.sectionTitle.toLowerCase(),
        },
      });
    } else {
      segments.push({ text: matchedText });
    }
    lastIndex = match.index + matchedText.length;
  }

  if (lastIndex < text.length) {
    segments.push({ text: text.slice(lastIndex) });
  }
  return segments.length > 0 ? segments : [{ text }];
};
