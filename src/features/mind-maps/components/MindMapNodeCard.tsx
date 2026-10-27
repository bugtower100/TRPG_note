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
import { buildResourceFileUrl } from '../../../services/resourceService';
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
        <ToolbarButton label="从此节点连线" onClick={data.onStartConnection}>
          <Link2 size={16} aria-hidden="true" />
        </ToolbarButton>
        <ToolbarButton
          label="添加同级节点"
          disabled={!data.hasParent}
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
        className={`mind-map-node-card ${data.imageRef ? 'mind-map-node-card-image' : ''} ${data.connecting ? 'mind-map-node-card-connecting' : ''} ${data.isRoot ? 'mind-map-node-card-root' : ''} ${
          selected ? 'mind-map-node-card-selected' : ''
        }`}
        style={{ borderColor }}
        title={data.title}
      >
        <Handle
          type="target"
          position={targetPosition}
          isConnectable
          className="mind-map-node-handle"
        />
        <Handle id="target-upper" type="target" position={Position.Top} isConnectable={false} className="mind-map-node-route-handle" />
        <Handle id="target-lower" type="target" position={Position.Bottom} isConnectable={false} className="mind-map-node-route-handle" />
        <Handle id="target-left" type="target" position={Position.Left} isConnectable={false} className="mind-map-node-route-handle" />
        <Handle id="target-right" type="target" position={Position.Right} isConnectable={false} className="mind-map-node-route-handle" />
        {data.imageRef ? (
          <img className="mind-map-node-image" src={buildResourceFileUrl(data.imageRef)} alt={data.title} draggable={false} />
        ) : null}
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
        {data.isRoot ? <div className="mind-map-node-kind">中心主题</div> : null}
        {data.collapsed && data.hiddenDescendantCount > 0 ? (
          <div className="mind-map-node-collapsed-count">
            已隐藏 {data.hiddenDescendantCount} 个节点
          </div>
        ) : null}
        <Handle
          type="source"
          position={sourcePosition}
          isConnectable
          className="mind-map-node-handle"
        />
        <Handle id="source-upper" type="source" position={Position.Top} isConnectable={false} className="mind-map-node-route-handle" />
        <Handle id="source-lower" type="source" position={Position.Bottom} isConnectable={false} className="mind-map-node-route-handle" />
        <Handle id="source-left" type="source" position={Position.Left} isConnectable={false} className="mind-map-node-route-handle" />
        <Handle id="source-right" type="source" position={Position.Right} isConnectable={false} className="mind-map-node-route-handle" />
      </div>
    </>
  );
});

MindMapNodeCard.displayName = 'MindMapNodeCard';

export default MindMapNodeCard;
