import React, { useEffect, useRef, useState } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { useCampaign } from '../../context/CampaignContext';
import { createPortal } from 'react-dom';

interface RichTextDisplayProps {
  content: string;
  className?: string;
}

interface TooltipState {
  visible: boolean;
  x: number;
  y: number;
  kind: 'entity' | 'section' | 'subitem' | null;
  entityId: string | null;
  entityType: string | null;
  sectionTitleLower: string | null;
  subItemTitleLower: string | null;
}

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

const RichTextDisplay: React.FC<RichTextDisplayProps> = ({ content, className = '' }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { campaignData, openInTab } = useCampaign();
  
  const [tooltip, setTooltip] = useState<TooltipState>({
    visible: false,
    x: 0,
    y: 0,
    kind: null,
    entityId: null,
    entityType: null,
    sectionTitleLower: null,
    subItemTitleLower: null,
  });

  const entityMap = React.useMemo(() => {
    const map = new Map<string, { id: string; type: string; details: string; name: string }>();

    const process = (list: any[], type: string) => {
      list.forEach(item => {
        if (item.name) {
          map.set(item.name.toLowerCase(), {
            id: item.id,
            type,
            details: item.details || item.description || '',
            name: item.name
          });
        }
      });
    };

    process(campaignData.characters, 'characters');
    process(campaignData.monsters, 'monsters');
    process(campaignData.locations, 'locations');
    process(campaignData.organizations, 'organizations');
    process(campaignData.events, 'events');
    process(campaignData.clues, 'clues');
    process(campaignData.timelines, 'timelines');

    return map;
  }, [campaignData]);

  const sectionTitleMap = React.useMemo(() => {
    const map = new Map<
      string,
      Array<{ entityId: string; entityType: string; entityName: string; sectionKey: string; sectionTitle: string }>
    >();

    const addEntry = (
      title: string,
      payload: { entityId: string; entityType: string; entityName: string; sectionKey: string; sectionTitle: string }
    ) => {
      const key = title.toLowerCase();
      const list = map.get(key) || [];
      list.push(payload);
      map.set(key, list);
    };

    const process = (list: any[], entityType: string) => {
      list.forEach((item) => {
        const defs = DEFAULT_SECTION_KEYS[entityType] || [];
        defs.forEach((def) => {
          if (item.sectionVisibility?.[def.key] === false) return;
          const title = item.sectionTitles?.[def.key] || def.title;
          if (!title) return;
          addEntry(title, {
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
          addEntry(title, {
            entityId: item.id,
            entityType,
            entityName: item.name || '未命名',
            sectionKey,
            sectionTitle: title,
          });
        });
      });
    };

    process(campaignData.characters, 'characters');
    process(campaignData.monsters, 'monsters');
    process(campaignData.locations, 'locations');
    process(campaignData.organizations, 'organizations');
    process(campaignData.events, 'events');
    process(campaignData.clues, 'clues');
    process(campaignData.timelines, 'timelines');

    return map;
  }, [campaignData]);

  const subItemTitleMap = React.useMemo(() => {
    const map = new Map<
      string,
      Array<{
        entityId: string;
        entityType: string;
        entityName: string;
        sectionKey: string;
        sectionTitle: string;
        subItemId: string;
        subItemTitle: string;
      }>
    >();

    const addEntry = (
      title: string,
      payload: {
        entityId: string;
        entityType: string;
        entityName: string;
        sectionKey: string;
        sectionTitle: string;
        subItemId: string;
        subItemTitle: string;
      }
    ) => {
      const key = title.toLowerCase();
      const list = map.get(key) || [];
      list.push(payload);
      map.set(key, list);
    };

    const process = (list: any[], entityType: string) => {
      list.forEach((item) => {
        const defs = DEFAULT_SECTION_KEYS[entityType] || [];
        const defaultTitleByKey = new Map(defs.map((def) => [def.key, def.title]));
        const sectionSubItems = item.sectionSubItems || {};
        Object.entries(sectionSubItems).forEach(([sectionKey, rawItems]) => {
          if (item.sectionVisibility?.[sectionKey] === false) return;
          const sectionTitle = item.sectionTitles?.[sectionKey] || defaultTitleByKey.get(sectionKey) || '未命名区块';
          const items = Array.isArray(rawItems) ? rawItems : [];
          items.forEach((subItem: any) => {
            if (!subItem?.id || !subItem?.title) return;
            addEntry(subItem.title, {
              entityId: item.id,
              entityType,
              entityName: item.name || '未命名',
              sectionKey,
              sectionTitle,
              subItemId: subItem.id,
              subItemTitle: subItem.title,
            });
          });
        });
      });
    };

    process(campaignData.characters, 'characters');
    process(campaignData.monsters, 'monsters');
    process(campaignData.locations, 'locations');
    process(campaignData.organizations, 'organizations');
    process(campaignData.events, 'events');
    process(campaignData.clues, 'clues');
    process(campaignData.timelines, 'timelines');

    return map;
  }, [campaignData]);

  const allKeywords = React.useMemo(() => {
    const set = new Set<string>([...entityMap.keys(), ...sectionTitleMap.keys(), ...subItemTitleMap.keys()]);
    return Array.from(set).sort((a, b) => b.length - a.length);
  }, [entityMap, sectionTitleMap, subItemTitleMap]);

  useEffect(() => {
    if (!containerRef.current) return;
    const rawHtml = marked.parse(content || '', { async: false }) as string;
    const cleanHtml = DOMPurify.sanitize(rawHtml);
    containerRef.current.innerHTML = cleanHtml;
    if (allKeywords.length === 0) return;

    const walker = document.createTreeWalker(
      containerRef.current,
      NodeFilter.SHOW_TEXT,
      null
    );

    const nodesToReplace: { node: Text; matches: { name: string; index: number; length: number }[] }[] = [];

    let currentNode = walker.nextNode();
    while (currentNode) {
      const text = currentNode.textContent || '';
      const matches: { name: string; index: number; length: number }[] = [];
      const escapedNames = allKeywords.map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
      if (escapedNames.length > 0) {
        const regex = new RegExp(`(${escapedNames.join('|')})`, 'gi');
        let match;
        while ((match = regex.exec(text)) !== null) {
          matches.push({
            name: match[0],
            index: match.index,
            length: match[0].length
          });
        }
      }

      if (matches.length > 0) {
        nodesToReplace.push({ node: currentNode as Text, matches });
      }
      currentNode = walker.nextNode();
    }

    // Replace nodes
    nodesToReplace.forEach(({ node, matches }) => {
      const fragment = document.createDocumentFragment();
      let lastIndex = 0;
      const originalText = node.textContent || '';

      matches.forEach(match => {
        if (match.index < lastIndex) return;

        if (match.index > lastIndex) {
          fragment.appendChild(document.createTextNode(originalText.slice(lastIndex, match.index)));
        }

        const span = document.createElement('span');
        const keywordLower = match.name.toLowerCase();
        const entityInfo = entityMap.get(keywordLower);
        const subItemInfo = subItemTitleMap.get(keywordLower);
        const sectionInfo = sectionTitleMap.get(keywordLower);

        if (entityInfo) {
          span.className = 'entity-link';
          span.dataset.kind = 'entity';
          span.dataset.id = entityInfo.id;
          span.dataset.type = entityInfo.type;
        } else if (subItemInfo && subItemInfo.length > 0) {
          span.className = 'section-link';
          span.dataset.kind = 'subitem';
          span.dataset.subitemtitle = keywordLower;
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

      node.parentNode?.replaceChild(fragment, node);
    });

  }, [content, allKeywords, entityMap, sectionTitleMap, subItemTitleMap]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.classList.contains('entity-link') || target.classList.contains('section-link')) {
        const rect = target.getBoundingClientRect();
        setTooltip({
          visible: true,
          x: rect.left + window.scrollX,
          y: rect.bottom + window.scrollY + 5,
          kind:
            target.dataset.kind === 'section'
              ? 'section'
              : target.dataset.kind === 'subitem'
                ? 'subitem'
                : 'entity',
          entityId: target.dataset.id || null,
          entityType: target.dataset.type || null,
          sectionTitleLower: target.dataset.sectiontitle || null,
          subItemTitleLower: target.dataset.subitemtitle || null,
        });
      }
    };

    const handleMouseOut = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.classList.contains('entity-link') || target.classList.contains('section-link')) {
        setTooltip(prev => ({ ...prev, visible: false }));
      }
    };

    const handleDblClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const kind = target.dataset.kind;
      if (kind === 'entity') {
        const { id, type } = target.dataset;
        if (id && type) {
          const list = (campaignData as any)[type];
          const entity = Array.isArray(list) ? list.find((item: any) => item.id === id) : null;
          openInTab(type, id, entity?.name || '未命名');
          setTooltip(prev => ({ ...prev, visible: false }));
        }
      } else if (kind === 'section') {
        const titleKey = target.dataset.sectiontitle;
        if (titleKey) {
          const candidates = sectionTitleMap.get(titleKey) || [];
          if (candidates.length > 0) {
            const first = candidates[0];
            openInTab(first.entityType, first.entityId, first.entityName, first.sectionTitle.toLowerCase());
            setTooltip(prev => ({ ...prev, visible: false }));
          }
        }
      } else if (kind === 'subitem') {
        const titleKey = target.dataset.subitemtitle;
        if (titleKey) {
          const candidates = subItemTitleMap.get(titleKey) || [];
          if (candidates.length > 0) {
            const first = candidates[0];
            openInTab(
              first.entityType,
              first.entityId,
              first.entityName,
              first.sectionTitle.toLowerCase(),
              first.subItemId
            );
            setTooltip(prev => ({ ...prev, visible: false }));
          }
        }
      }
    };

    container.addEventListener('mouseover', handleMouseOver);
    container.addEventListener('mouseout', handleMouseOut);
    container.addEventListener('dblclick', handleDblClick);

    return () => {
      container.removeEventListener('mouseover', handleMouseOver);
      container.removeEventListener('mouseout', handleMouseOut);
      container.removeEventListener('dblclick', handleDblClick);
    };
  }, [campaignData, openInTab, sectionTitleMap, subItemTitleMap]);

  const renderTooltipContent = () => {
    if (tooltip.kind === 'section' && tooltip.sectionTitleLower) {
      const matches = sectionTitleMap.get(tooltip.sectionTitleLower) || [];
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
      const matches = subItemTitleMap.get(tooltip.subItemTitleLower) || [];
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
    let entity: any = null;
    const list = (campaignData as any)[tooltip.entityType];
    if (Array.isArray(list)) {
        entity = list.find((i: any) => i.id === tooltip.entityId);
    }

    if (!entity) return <div>加载中...</div>;

    return (
      <div className="max-w-xs">
        <h4 className="font-bold text-sm mb-1 theme-text-primary">{entity.name}</h4>
        <p className="text-xs theme-text-secondary line-clamp-3">
          {entity.details || entity.description || '暂无描述'}
        </p>
        <div className="mt-1 text-xs theme-text-secondary opacity-70">
          双击在右侧打开
        </div>
      </div>
    );
  };

  return (
    <>
      <div 
        ref={containerRef} 
        className={`prose prose-sm max-w-none theme-text-primary ${className}`} // Add prose class for markdown styles
        style={{ minHeight: '1em' }}
      />
      
      {tooltip.visible && createPortal(
        <div 
          className="fixed z-50 bg-theme-card p-3 rounded shadow-lg border border-theme pointer-events-none text-left animate-in fade-in zoom-in-95 duration-100"
          style={{ 
            left: tooltip.x, 
            top: tooltip.y,
            transform: 'translateX(-10%)' // Slight offset
          }}
        >
          {renderTooltipContent()}
        </div>,
        document.body
      )}
    </>
  );
};

export default RichTextDisplay;
