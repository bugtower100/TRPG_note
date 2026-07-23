import { memo } from 'react';
import {
  Handle,
  NodeToolbar,
  Position,
  type NodeProps,
} from '@xyflow/react';
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  GitBranchPlus,
  Link2,
  Plus,
  Trash2,
} from 'lucide-react';
import type { MindMapFlowNode } from '../utils/layoutMindMap';
import MindMapKeywordText from './MindMapKeywordText';

interface ToolbarButtonProps {
  label: string;
  disabled?: boolean;
  danger?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}

const ToolbarButton = ({
  label,
  disabled = false,
  danger = false,
  onClick,
  children,
}: ToolbarButtonProps) => (
  <button
    type="button"
    title={label}
    aria-label={label}
    disabled={disabled}
    onClick={(event) => {
      event.stopPropagation();
      onClick?.();
    }}
    className={`mind-map-toolbar-button nodrag nopan ${danger ? 'mind-map-toolbar-button-danger' : ''}`}
  >
    {children}
  </button>
);

const MindMapNodeCard = memo(({ data, selected, sourcePosition, targetPosition }: NodeProps<MindMapFlowNode>) => {
  const borderColor = data.color || (data.isRoot ? 'var(--primary-color)' : 'var(--border-color)');
  const primaryEntityReference = data.entityReferences?.find(
    (reference) => reference !== undefined
  );

  return (
    <>
      <NodeToolbar
        isVisible={selected}
        position={Position.Top}
        offset={12}
        className="mind-map-node-toolbar"
        onPointerDown={(event) => event.stopPropagation()}
      >
        <ToolbarButton label="添加子节点" onClick={data.onAddChild}>
          <GitBranchPlus size={16} aria-hidden="true" />
        </ToolbarButton>
        <ToolbarButton
          label="添加同级节点"
          disabled={data.isRoot}
          onClick={data.onAddSibling}
        >
          <Plus size={16} aria-hidden="true" />
        </ToolbarButton>
        <ToolbarButton
          label="同级上移"
          disabled={!data.canMoveUp}
          onClick={data.onMoveUp}
        >
          <ArrowUp size={16} aria-hidden="true" />
        </ToolbarButton>
        <ToolbarButton
          label="同级下移"
          disabled={!data.canMoveDown}
          onClick={data.onMoveDown}
        >
          <ArrowDown size={16} aria-hidden="true" />
        </ToolbarButton>
        <ToolbarButton
          label={data.collapsed ? '展开分支' : '折叠分支'}
          disabled={!data.hasChildren}
          onClick={data.onToggleCollapse}
        >
          {data.collapsed
            ? <ChevronRight size={16} aria-hidden="true" />
            : <ChevronDown size={16} aria-hidden="true" />}
        </ToolbarButton>
        <ToolbarButton
          label="删除分支"
          disabled={data.isRoot}
          danger
          onClick={data.onDelete}
        >
          <Trash2 size={16} aria-hidden="true" />
        </ToolbarButton>
      </NodeToolbar>
      <div
        className={`mind-map-node-card ${data.isRoot ? 'mind-map-node-card-root' : ''} ${
          selected ? 'mind-map-node-card-selected' : ''
        }`}
        style={{ borderColor }}
        title={data.title}
      >
        <Handle
          type="target"
          position={targetPosition}
          isConnectable={false}
          className="mind-map-node-handle"
        />
        <div className="mind-map-node-title">
          {data.titleSegments && data.onOpenTarget ? (
            <MindMapKeywordText
              segments={data.titleSegments}
              onOpenTarget={data.onOpenTarget}
              onPreviewTarget={data.onPreviewTarget}
              onHidePreview={data.onHidePreview}
            />
          ) : data.title}
        </div>
        {data.entityRefs.length > 0 ? (
          <button
            type="button"
            className="mind-map-node-reference nodrag nopan"
            disabled={!primaryEntityReference || !data.onOpenTarget}
            aria-label={
              primaryEntityReference
                ? `打开显式绑定条目：${primaryEntityReference.name}${
                    data.entityRefs.length > 1 ? `，另有 ${data.entityRefs.length - 1} 条` : ''
                  }`
                : '显式绑定的条目已不存在'
            }
            onPointerDown={(event) => event.stopPropagation()}
            onMouseEnter={(event) => {
              if (!primaryEntityReference) return;
              data.onPreviewTarget?.({
                entityType: primaryEntityReference.entityType,
                entityId: primaryEntityReference.entityId,
                title: primaryEntityReference.name,
              }, event.currentTarget);
            }}
            onMouseLeave={data.onHidePreview}
            onClick={(event) => {
              event.stopPropagation();
              if (!primaryEntityReference || !data.onOpenTarget) return;
              data.onOpenTarget({
                entityType: primaryEntityReference.entityType,
                entityId: primaryEntityReference.entityId,
                title: primaryEntityReference.name,
              });
            }}
          >
            <Link2 size={12} aria-hidden="true" />
            <span>
              {primaryEntityReference?.name || '绑定失效'}
              {data.entityRefs.length > 1 ? ` +${data.entityRefs.length - 1}` : ''}
            </span>
          </button>
        ) : null}
        {data.isRoot ? <div className="mind-map-node-kind">中心主题</div> : null}
        {data.collapsed && data.hiddenDescendantCount > 0 ? (
          <div className="mind-map-node-collapsed-count">
            已隐藏 {data.hiddenDescendantCount} 个节点
          </div>
        ) : null}
        <Handle
          type="source"
          position={sourcePosition}
          isConnectable={false}
          className="mind-map-node-handle"
        />
      </div>
    </>
  );
});

MindMapNodeCard.displayName = 'MindMapNodeCard';

export default MindMapNodeCard;
