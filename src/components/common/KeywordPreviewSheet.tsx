import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Maximize2, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { CampaignData } from '../../types';
import EntityDetailView from './EntityDetailView';
import { RichKeywordData, TooltipState, resolveTooltipTarget } from './richTextReference';

interface KeywordPreviewSheetProps {
  tooltip: TooltipState | null;
  campaignData: CampaignData;
  keywordData: RichKeywordData;
  onClose: () => void;
}

const KeywordPreviewSheet: React.FC<KeywordPreviewSheetProps> = ({
  tooltip,
  campaignData,
  keywordData,
  onClose,
}) => {
  const navigate = useNavigate();
  const contentRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<HTMLDivElement>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const target = useMemo(() => (
    tooltip ? resolveTooltipTarget(tooltip, campaignData, keywordData) : null
  ), [campaignData, keywordData, tooltip]);

  useEffect(() => {
    if (!target) return;
    if (!target.targetSectionTitleLower && !target.targetSubItemId) return;
    const root = contentRef.current;
    if (!root) return;

    const escapeAttr = (value: string) => value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

    const runJump = (attempt = 0) => {
      const sectionSelector = target.targetSectionTitleLower
        ? `[data-section-title="${escapeAttr(target.targetSectionTitleLower)}"]`
        : null;

      const section = sectionSelector ? root.querySelector(sectionSelector) as HTMLElement | null : null;
      if (section && section.dataset.collapsed === 'true') {
        const toggleBtn = section.querySelector('[data-role="section-toggle"]') as HTMLButtonElement | null;
        toggleBtn?.click();
      }

      const destination = target.targetSubItemId
        ? root.querySelector(`[data-subitem-id="${escapeAttr(target.targetSubItemId)}"]`) as HTMLElement | null
        : section;

      if (destination) {
        destination.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }

      if (attempt < 8) {
        window.setTimeout(() => runJump(attempt + 1), 70);
      }
    };

    window.setTimeout(() => runJump(0), 40);
  }, [target]);

  useEffect(() => {
    setIsExpanded(false);
  }, [tooltip?.entityId, tooltip?.entityType, tooltip?.sectionTitleLower, tooltip?.subItemTitleLower]);

  useEffect(() => {
    const handleElement = handleRef.current;
    if (!handleElement) return;

    let startY = 0;
    let isDragging = false;

    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 1) return;
      startY = event.touches[0].clientY;
      isDragging = true;
    };

    const onTouchEnd = (event: TouchEvent) => {
      if (!isDragging || event.changedTouches.length !== 1) return;
      const deltaY = event.changedTouches[0].clientY - startY;
      if (deltaY < -40) {
        setIsExpanded(true);
      } else if (deltaY > 40) {
        setIsExpanded(false);
      }
      isDragging = false;
    };

    handleElement.addEventListener('touchstart', onTouchStart, { passive: true });
    handleElement.addEventListener('touchend', onTouchEnd, { passive: true });

    return () => {
      handleElement.removeEventListener('touchstart', onTouchStart);
      handleElement.removeEventListener('touchend', onTouchEnd);
    };
  }, []);

  if (!tooltip?.visible || !target) return null;

  return (
    <>
      <div className="drawer-overlay" onClick={onClose} aria-hidden="true" />
      <div
        className={`mobile-keyword-sheet ${isExpanded ? 'mobile-keyword-sheet--expanded' : ''}`}
        role="dialog"
        aria-label="关键词详情预览"
        aria-modal="true"
      >
        <div ref={handleRef} className="mobile-keyword-sheet__handle" />
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-theme shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={() => {
                navigate(`/${target.entityType}/${target.entityId}`);
                onClose();
              }}
              className="p-1 rounded border border-theme hover:bg-primary-light shrink-0"
              title="放大查看"
            >
              <Maximize2 size={16} />
            </button>
            <div className="min-w-0">
              <div className="text-sm font-semibold truncate">{target.title}</div>
              <div className="text-xs theme-text-secondary">预览对应页面内容</div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded border border-theme hover:bg-primary-light shrink-0"
          >
            <X size={16} />
          </button>
        </div>
        <div ref={contentRef} className="flex-1 overflow-y-auto px-2 py-2">
          <EntityDetailView type={target.entityType} entityId={target.entityId} />
        </div>
      </div>
    </>
  );
};

export default KeywordPreviewSheet;
