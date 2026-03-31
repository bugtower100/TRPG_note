import React from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { CampaignData } from '../../types';

export interface TooltipState {
  visible: boolean;
  x: number;
  y: number;
  kind: 'entity' | 'section' | 'subitem' | null;
  entityId: string | null;
  entityType: string | null;
  sectionTitleLower: string | null;
  subItemTitleLower: string | null;
}

export interface EntityReferenceEntry {
  id: string;
  type: string;
  details: string;
  name: string;
}

export interface SectionReferenceEntry {
  entityId: string;
  entityType: string;
  entityName: string;
  sectionKey: string;
  sectionTitle: string;
}

export interface SubItemReferenceEntry {
  entityId: string;
  entityType: string;
  entityName: string;
  sectionKey: string;
  sectionTitle: string;
  subItemId: string;
  subItemTitle: string;
}

export interface RichKeywordData {
  entityMap: Map<string, EntityReferenceEntry>;
  sectionTitleMap: Map<string, SectionReferenceEntry[]>;
  subItemTitleMap: Map<string, SubItemReferenceEntry[]>;
  allKeywords: string[];
}

const getEntityCollection = (campaignData: CampaignData, entityType: string) =>
  (campaignData as unknown as Record<string, any[]>)[entityType];

const DEFAULT_SECTION_KEYS: Record<string, Array<{ key: string; title: string }>> = {
  characters: [
    { key: 'basic', title: '基本信息' },
    { key: 'goals', title: '属性与目标' },
  ],
  monsters: [
    { key: 'basic', title: '基本信息' },
    { key: 'combat', title: '数据与掉落' },
  ],
  locations: [
    { key: 'detail', title: '地点详情' },
  ],
  organizations: [
    { key: 'detail', title: '组织详情' },
  ],
  events: [
    { key: 'detail', title: '事件详情' },
  ],
  clues: [
    { key: 'detail', title: '线索详情' },
  ],
  timelines: [
    { key: 'intro', title: '简介' },
    { key: 'events', title: '事件节点' },
  ],
};

export const normalizeHref = (href: string) => {
  const raw = href.trim();
  if (!raw) return raw;
  if (raw.startsWith('#') || raw.startsWith('/')) return raw;
  if (/^(https?:|mailto:|tel:)/i.test(raw)) return raw;
  if (/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(raw)) return raw;
  return `https://${raw}`;
};

export const markdownToPreviewText = (input: string) => {
  const raw = marked.parse(input || '', {
    async: false,
    gfm: true,
    breaks: true,
  }) as string;
  const clean = DOMPurify.sanitize(raw);
  const withLineBreaks = clean
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h1|h2|h3|h4|h5|h6|blockquote|pre)>/gi, '\n')
    .replace(/<li>/gi, '• ');
  const doc = new DOMParser().parseFromString(withLineBreaks, 'text/html');
  return (doc.body.textContent || '')
    .replace(/\r/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

const PRIMARY_SECTION_KEY_BY_ENTITY_TYPE: Record<string, string> = {
  characters: 'basic',
  monsters: 'basic',
  locations: 'detail',
  organizations: 'detail',
  events: 'detail',
  clues: 'detail',
  timelines: 'intro',
};

export const getEntityPrimaryMarkdown = (
  entity: {
    details?: string;
    description?: string;
    sectionSubItems?: Record<string, Array<{ content?: string }>>;
  },
  entityType: string
) => {
  const primarySectionKey = PRIMARY_SECTION_KEY_BY_ENTITY_TYPE[entityType];
  const primarySectionItems = primarySectionKey ? entity.sectionSubItems?.[primarySectionKey] : undefined;
  const firstSectionContent = Array.isArray(primarySectionItems)
    ? primarySectionItems.find((item) => typeof item?.content === 'string' && item.content.trim())?.content
    : '';

  return firstSectionContent || entity.details || entity.description || '';
};

export const buildRichKeywordData = (campaignData: CampaignData): RichKeywordData => {
  const entityMap = new Map<string, EntityReferenceEntry>();
  const sectionTitleMap = new Map<string, SectionReferenceEntry[]>();
  const subItemTitleMap = new Map<string, SubItemReferenceEntry[]>();

  const addEntity = (
    list: Array<{
      id: string;
      name: string;
      details?: string;
      description?: string;
      sectionSubItems?: Record<string, Array<{ content?: string }>>;
    }>,
    type: string
  ) => {
    list.forEach((item) => {
      if (!item.name) return;
      entityMap.set(item.name.toLowerCase(), {
        id: item.id,
        type,
        details: getEntityPrimaryMarkdown(item, type),
        name: item.name,
      });
    });
  };

  const addSectionEntry = (title: string, payload: SectionReferenceEntry) => {
    const key = title.toLowerCase();
    const list = sectionTitleMap.get(key) || [];
    list.push(payload);
    sectionTitleMap.set(key, list);
  };

  const processSections = (list: Array<any>, entityType: string) => {
    list.forEach((item) => {
      const defs = DEFAULT_SECTION_KEYS[entityType] || [];
      defs.forEach((def) => {
        if (item.sectionVisibility?.[def.key] === false) return;
        const title = item.sectionTitles?.[def.key] || def.title;
        if (!title) return;
        addSectionEntry(title, {
          entityId: item.id,
          entityType,
          entityName: item.name || '未命名',
          sectionKey: def.key,
          sectionTitle: title,
        });
      });

      (item.customSections || []).forEach((sectionKey: string) => {
        if (item.sectionVisibility?.[sectionKey] === false) return;
        const title = item.sectionTitles?.[sectionKey];
        if (!title) return;
        addSectionEntry(title, {
          entityId: item.id,
          entityType,
          entityName: item.name || '未命名',
          sectionKey,
          sectionTitle: title,
        });
      });
    });
  };

  addEntity(campaignData.characters, 'characters');
  addEntity(campaignData.monsters, 'monsters');
  addEntity(campaignData.locations, 'locations');
  addEntity(campaignData.organizations, 'organizations');
  addEntity(campaignData.events, 'events');
  addEntity(campaignData.clues, 'clues');
  addEntity(campaignData.timelines, 'timelines');

  processSections(campaignData.characters, 'characters');
  processSections(campaignData.monsters, 'monsters');
  processSections(campaignData.locations, 'locations');
  processSections(campaignData.organizations, 'organizations');
  processSections(campaignData.events, 'events');
  processSections(campaignData.clues, 'clues');
  processSections(campaignData.timelines, 'timelines');

  const allKeywords = Array.from(
    new Set<string>([
      ...entityMap.keys(),
      ...sectionTitleMap.keys(),
    ])
  ).sort((a, b) => b.length - a.length);

  return { entityMap, sectionTitleMap, subItemTitleMap, allKeywords };
};

export const decorateRichHtml = (cleanHtml: string, keywordData: RichKeywordData) => {
  const temp = document.createElement('div');
  temp.innerHTML = cleanHtml;
  const links = temp.querySelectorAll('a[href]');
  links.forEach((a) => {
    const href = a.getAttribute('href') || '';
    const normalized = normalizeHref(href);
    a.setAttribute('href', normalized);
    if (!normalized.startsWith('#') && !normalized.startsWith('/')) {
      a.setAttribute('target', '_blank');
      a.setAttribute('rel', 'noopener noreferrer');
    }
  });

  if (keywordData.allKeywords.length === 0) return temp.innerHTML;

  const escapedNames = keywordData.allKeywords.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const regex = new RegExp(`(${escapedNames.join('|')})`, 'gi');
  const walker = document.createTreeWalker(temp, NodeFilter.SHOW_TEXT, null);
  const nodesToReplace: { node: Text; matches: { name: string; index: number; length: number }[] }[] = [];
  let currentNode = walker.nextNode();

  while (currentNode) {
    const node = currentNode as Text;
    const parentElement = node.parentElement;
    if (!parentElement || parentElement.closest('a, code, pre, script, style, textarea')) {
      currentNode = walker.nextNode();
      continue;
    }
    const text = node.textContent || '';
    const matches: { name: string; index: number; length: number }[] = [];
    regex.lastIndex = 0;
    let match;
    while ((match = regex.exec(text)) !== null) {
      matches.push({
        name: match[0],
        index: match.index,
        length: match[0].length,
      });
    }
    if (matches.length > 0) {
      nodesToReplace.push({ node, matches });
    }
    currentNode = walker.nextNode();
  }

  nodesToReplace.forEach(({ node, matches }) => {
    const fragment = document.createDocumentFragment();
    let lastIndex = 0;
    const originalText = node.textContent || '';

    matches.forEach((match) => {
      if (match.index < lastIndex) return;
      if (match.index > lastIndex) {
        fragment.appendChild(document.createTextNode(originalText.slice(lastIndex, match.index)));
      }

      const span = document.createElement('span');
      const keywordLower = match.name.toLowerCase();
      const entityInfo = keywordData.entityMap.get(keywordLower);
      const sectionInfo = keywordData.sectionTitleMap.get(keywordLower);

      if (entityInfo) {
        span.className = 'entity-link';
        span.dataset.kind = 'entity';
        span.dataset.id = entityInfo.id;
        span.dataset.type = entityInfo.type;
      } else if (sectionInfo && sectionInfo.length > 0) {
        span.className = 'section-link';
        span.dataset.kind = 'section';
        span.dataset.sectiontitle = keywordLower;
      } else {
        span.className = 'entity-link';
      }

      span.textContent = match.name;
      fragment.appendChild(span);
      lastIndex = match.index + match.length;
    });

    if (lastIndex < originalText.length) {
      fragment.appendChild(document.createTextNode(originalText.slice(lastIndex)));
    }

    const parent = node.parentNode;
    if (!parent || !parent.contains(node)) return;
    try {
      parent.replaceChild(fragment, node);
    } catch {
      return;
    }
  });

  return temp.innerHTML;
};

interface TooltipContentProps {
  tooltip: TooltipState;
  campaignData: CampaignData;
  keywordData: RichKeywordData;
}

export const RichTextTooltipContent: React.FC<TooltipContentProps> = ({
  tooltip,
  campaignData,
  keywordData,
}) => {
  if (tooltip.kind === 'section' && tooltip.sectionTitleLower) {
    const matches = keywordData.sectionTitleMap.get(tooltip.sectionTitleLower) || [];
    if (matches.length === 0) return null;
    return (
      <div className="max-w-xs">
        <h4 className="font-bold text-sm mb-1 theme-text-primary">匹配到区块标题</h4>
        <div className="space-y-1">
          {matches.slice(0, 6).map((item, idx) => (
            <div key={`${item.entityId}_${item.sectionKey}_${idx}`} className="text-sm leading-5 theme-text-secondary">
              <span className="inline-block mr-1 px-1.5 py-0.5 rounded border border-theme section-link">
                区块
              </span>
              {item.entityName} · {item.sectionTitle}
            </div>
          ))}
        </div>
        <div className="mt-1 text-xs theme-text-secondary opacity-70">双击在右侧打开并定位到该区块</div>
      </div>
    );
  }

  if (tooltip.kind === 'subitem' && tooltip.subItemTitleLower) {
    const matches = keywordData.subItemTitleMap.get(tooltip.subItemTitleLower) || [];
    if (matches.length === 0) return null;
    return (
      <div className="max-w-xs">
        <h4 className="font-bold text-sm mb-1 theme-text-primary">匹配到子项目</h4>
        <div className="space-y-1">
          {matches.slice(0, 6).map((item, idx) => (
            <div key={`${item.entityId}_${item.sectionKey}_${item.subItemId}_${idx}`} className="text-sm leading-5 theme-text-secondary">
              <span className="inline-block mr-1 px-1.5 py-0.5 rounded border border-theme section-link">
                子项目
              </span>
              {item.entityName} · {item.sectionTitle} · {item.subItemTitle}
            </div>
          ))}
        </div>
        <div className="mt-1 text-xs theme-text-secondary opacity-70">双击在右侧打开并定位到该子项目</div>
      </div>
    );
  }

  if (!tooltip.entityId || !tooltip.entityType) return null;
  const list = getEntityCollection(campaignData, tooltip.entityType);
  const entity = Array.isArray(list) ? list.find((item) => item.id === tooltip.entityId) : null;
  if (!entity) return <div>加载中...</div>;

  return (
    <div className="max-w-xs">
      <h4 className="font-bold text-sm mb-1 theme-text-primary">{entity.name}</h4>
      <p className="text-xs theme-text-secondary whitespace-pre-line max-h-16 overflow-hidden">
        {markdownToPreviewText(getEntityPrimaryMarkdown(entity, tooltip.entityType)) || '暂无描述'}
      </p>
      <div className="mt-1 text-xs theme-text-secondary opacity-70">
        双击在右侧打开
      </div>
    </div>
  );
};
