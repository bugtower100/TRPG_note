import { memo } from 'react';
import type { TooltipTargetPayload } from '../../../components/common/richTextReference';
import type { MindMapKeywordSegment } from '../utils/mindMapReferences';

interface MindMapKeywordTextProps {
  segments: MindMapKeywordSegment[];
  onOpenTarget: (target: TooltipTargetPayload) => void;
  onPreviewTarget?: (target: TooltipTargetPayload, anchor: HTMLElement) => void;
  onHidePreview?: () => void;
}

const MindMapKeywordText = memo(({
  segments,
  onOpenTarget,
  onPreviewTarget,
  onHidePreview,
}: MindMapKeywordTextProps) => (
  <>
    {segments.map((segment, index) => (
      segment.target ? (
        <button
          key={`${segment.text}:${index}`}
          type="button"
          className="mind-map-keyword-link nodrag nopan"
          aria-label={`打开${segment.target.targetSectionTitleLower ? '区块' : '条目'}：${segment.target.title}`}
          onMouseEnter={(event) => {
            onPreviewTarget?.(segment.target!, event.currentTarget);
          }}
          onMouseLeave={onHidePreview}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            onOpenTarget(segment.target!);
          }}
        >
          {segment.text}
        </button>
      ) : (
        <span key={`${segment.text}:${index}`}>{segment.text}</span>
      )
    ))}
  </>
));

MindMapKeywordText.displayName = 'MindMapKeywordText';

export default MindMapKeywordText;
