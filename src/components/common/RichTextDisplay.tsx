import React, { useEffect, useRef, useState } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { useCampaign } from '../../context/CampaignContext';
import { createPortal } from 'react-dom';
import {
  TooltipState,
  RichTextTooltipContent,
  buildRichKeywordData,
  decorateRichHtml,
} from './richTextReference';

const getEntityCollection = (campaignData: ReturnType<typeof useCampaign>['campaignData'], entityType: string) =>
  (campaignData as unknown as Record<string, any[]>)[entityType];

interface RichTextDisplayProps {
  content: string;
  className?: string;
}

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

  const keywordData = React.useMemo(() => buildRichKeywordData(campaignData), [campaignData]);

  const renderedHtml = React.useMemo(() => {
    const rawHtml = marked.parse(content || '', {
      async: false,
      gfm: true,
      breaks: true,
    }) as string;
    const cleanHtml = DOMPurify.sanitize(rawHtml, {
      ADD_ATTR: ['data-rte-color', 'data-rte-bg'],
    });
    return decorateRichHtml(cleanHtml, keywordData);
  }, [content, keywordData]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleMouseOver = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest('.entity-link, .section-link') as HTMLElement | null;
      if (!target) return;
      const rect = target.getBoundingClientRect();
      setTooltip({
        visible: true,
        x: rect.left + window.scrollX,
        y: rect.bottom + window.scrollY + 5,
        kind:
          target.dataset.kind === 'section'
            ? 'section'
            : 'entity',
        entityId: target.dataset.id || null,
        entityType: target.dataset.type || null,
        sectionTitleLower: target.dataset.sectiontitle || null,
        subItemTitleLower: target.dataset.subitemtitle || null,
      });
    };

    const handleMouseOut = (e: MouseEvent) => {
      const next = e.relatedTarget as HTMLElement | null;
      if (next?.closest('.entity-link, .section-link')) return;
      setTooltip((prev) => ({ ...prev, visible: false }));
    };

    const handleDblClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest('.entity-link, .section-link') as HTMLElement | null;
      if (!target) return;
      const kind = target.dataset.kind;
      if (kind === 'entity') {
        const { id, type } = target.dataset;
        if (id && type) {
          const list = getEntityCollection(campaignData, type);
          const entity = Array.isArray(list) ? list.find((item) => item.id === id) : null;
          openInTab(type, id, entity?.name || '未命名');
          setTooltip((prev) => ({ ...prev, visible: false }));
        }
      } else if (kind === 'section') {
        const titleKey = target.dataset.sectiontitle;
        if (titleKey) {
          const candidates = keywordData.sectionTitleMap.get(titleKey) || [];
          if (candidates.length > 0) {
            const first = candidates[0];
            openInTab(first.entityType, first.entityId, first.entityName, first.sectionTitle.toLowerCase());
            setTooltip((prev) => ({ ...prev, visible: false }));
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
  }, [campaignData, keywordData, openInTab]);

  return (
    <>
      <div 
        ref={containerRef} 
        className={`rich-text-content prose prose-sm max-w-none theme-text-primary prose-a:underline prose-a:decoration-dotted prose-ul:list-disc prose-ol:list-decimal prose-li:my-0 ${className}`}
        style={{ minHeight: '1em' }}
        dangerouslySetInnerHTML={{ __html: renderedHtml }}
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
          <RichTextTooltipContent tooltip={tooltip} campaignData={campaignData} keywordData={keywordData} />
        </div>,
        document.body
      )}
    </>
  );
};

export default RichTextDisplay;
