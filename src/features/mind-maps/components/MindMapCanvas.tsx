import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useNodesState,
  useReactFlow,
  type NodeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import '../mindMap.css';
import type { CampaignData, MindMapDocument } from '../../../types';
import type { MindMapSiblingDirection } from '../../../services/mindMapService';
import type {
  RichKeywordData,
  TooltipState,
  TooltipTargetPayload,
} from '../../../components/common/richTextReference';
import { RichTextTooltipContent } from '../../../components/common/richTextReference';
import MindMapNodeCard from './MindMapNodeCard';
import { layoutMindMap, type MindMapFlowNode } from '../utils/layoutMindMap';
import {
  mindMapEntityReferenceKey,
  tokenizeMindMapKeywords,
  type MindMapEntityOption,
} from '../utils/mindMapReferences';

const nodeTypes = {
  mindMap: MindMapNodeCard,
} satisfies NodeTypes;

interface MindMapCanvasInnerProps {
  mindMap: MindMapDocument;
  campaignData: CampaignData;
  fitRequest: number;
  selectedNodeId: string | null;
  selectedEdgeNodeId: string | null;
  keywordData: RichKeywordData;
  entityOptionsByKey: Map<string, MindMapEntityOption>;
  onSelectNode: (nodeId: string) => void;
  onSelectEdge: (targetNodeId: string) => void;
  onClearSelection: () => void;
  onAddChild: (nodeId: string) => void;
  onAddSibling: (nodeId: string) => void;
  onMoveSibling: (nodeId: string, direction: MindMapSiblingDirection) => void;
  onToggleCollapse: (nodeId: string) => void;
  onRequestDelete: (nodeId: string) => void;
  onOpenTarget: (target: TooltipTargetPayload) => void;
  onNodePositionChange: (nodeId: string, position: { x: number; y: number }) => void;
}

const MindMapCanvasInner = ({
  mindMap,
  campaignData,
  fitRequest,
  selectedNodeId,
  selectedEdgeNodeId,
  keywordData,
  entityOptionsByKey,
  onSelectNode,
  onSelectEdge,
  onClearSelection,
  onAddChild,
  onAddSibling,
  onMoveSibling,
  onToggleCollapse,
  onRequestDelete,
  onOpenTarget,
  onNodePositionChange,
}: MindMapCanvasInnerProps) => {
  const { fitView } = useReactFlow<MindMapFlowNode>();
  const [previewTooltip, setPreviewTooltip] = useState<TooltipState | null>(null);
  const showPreview = useCallback((
    target: TooltipTargetPayload,
    anchor: HTMLElement
  ) => {
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    const rect = anchor.getBoundingClientRect();
    const estimatedWidth = 340;
    const estimatedHeight = 230;
    const x = Math.max(12, Math.min(rect.left, window.innerWidth - estimatedWidth - 12));
    const y = rect.bottom + estimatedHeight + 12 <= window.innerHeight
      ? rect.bottom + 8
      : Math.max(12, rect.top - estimatedHeight - 8);
    setPreviewTooltip({
      visible: true,
      x,
      y,
      kind: target.targetSectionTitleLower ? 'section' : 'entity',
      entityId: target.entityId,
      entityType: target.entityType,
      sectionTitleLower: target.targetSectionTitleLower || null,
      subItemTitleLower: null,
    });
  }, []);
  const hidePreview = useCallback(() => {
    setPreviewTooltip(null);
  }, []);
  const layoutResult = useMemo(() => layoutMindMap(mindMap), [mindMap]);
  const actionableNodes = useMemo(
    () => layoutResult.nodes.map((node) => ({
      ...node,
      data: {
        ...node.data,
        titleSegments: tokenizeMindMapKeywords(node.data.title, keywordData),
        entityReferences: node.data.entityRefs.map(
          (reference) => entityOptionsByKey.get(mindMapEntityReferenceKey(reference))
        ),
        onAddChild: () => onAddChild(node.id),
        onAddSibling: () => onAddSibling(node.id),
        onMoveUp: () => onMoveSibling(node.id, 'up'),
        onMoveDown: () => onMoveSibling(node.id, 'down'),
        onToggleCollapse: () => onToggleCollapse(node.id),
        onDelete: () => onRequestDelete(node.id),
        onOpenTarget,
        onPreviewTarget: showPreview,
        onHidePreview: hidePreview,
      },
    })),
    [
      layoutResult.nodes,
      entityOptionsByKey,
      keywordData,
      onAddChild,
      onAddSibling,
      onMoveSibling,
      onRequestDelete,
      onOpenTarget,
      onToggleCollapse,
      showPreview,
      hidePreview,
    ]
  );
  const derivedNodes = useMemo(
    () => actionableNodes.map((node) => ({
      ...node,
      selected: node.id === selectedNodeId,
    })),
    [actionableNodes, selectedNodeId]
  );
  const [nodes, setNodes, onNodesChange] = useNodesState<MindMapFlowNode>(derivedNodes);
  const edges = useMemo(
    () => layoutResult.edges.map((edge) => {
      const selected = edge.target === selectedEdgeNodeId;
      return {
        ...edge,
        selected,
        style: {
          ...edge.style,
          strokeWidth: selected ? 2.8 : 1.6,
        },
      };
    }),
    [layoutResult.edges, selectedEdgeNodeId]
  );

  useEffect(() => {
    setNodes(derivedNodes);
  }, [derivedNodes, setNodes]);

  useEffect(() => {
    setPreviewTooltip(null);
  }, [mindMap.id]);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      void fitView({ padding: 0.18, duration: 280, maxZoom: 1.25 });
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [fitRequest, fitView, layoutResult.nodes.length, mindMap.id, mindMap.layoutDirection]);

  return (
    <>
    <ReactFlow<MindMapFlowNode>
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      nodesDraggable
      nodesConnectable={false}
      elementsSelectable
      onlyRenderVisibleElements
      deleteKeyCode={null}
      minZoom={0.2}
      maxZoom={2}
      fitView
      fitViewOptions={{ padding: 0.18, maxZoom: 1.25 }}
      className="mind-map-flow"
      aria-label={`${mindMap.name}思维导图画布`}
      onNodeClick={(_, node) => onSelectNode(node.id)}
      onEdgeClick={(_, edge) => onSelectEdge(edge.target)}
      onMoveStart={hidePreview}
      onNodeDragStart={hidePreview}
      onNodeDragStop={(_, node) => onNodePositionChange(node.id, node.position)}
      onNodesChange={onNodesChange}
      onPaneClick={onClearSelection}
    >
      <Background
        variant={BackgroundVariant.Dots}
        gap={22}
        size={1.2}
        color="var(--border-color)"
      />
      <Controls showInteractive={false} />
      <MiniMap<MindMapFlowNode>
        className="mind-map-minimap"
        nodeColor={(node) => (
          node.data.isRoot
            ? 'var(--primary-color)'
            : (node.data.color || 'var(--border-color)')
        )}
        maskColor="color-mix(in srgb, var(--bg-page) 72%, transparent)"
        pannable
        zoomable
      />
    </ReactFlow>
    {previewTooltip?.visible ? createPortal(
      <div
        className="fixed z-[120] max-h-[230px] w-[min(340px,calc(100vw-24px))] overflow-hidden rounded-lg border border-theme bg-theme-card p-3 text-left shadow-lg pointer-events-none"
        style={{
          left: previewTooltip.x,
          top: previewTooltip.y,
        }}
        role="tooltip"
      >
        <RichTextTooltipContent
          tooltip={previewTooltip}
          campaignData={campaignData}
          keywordData={keywordData}
          hint="点击直接打开"
        />
      </div>,
      document.body
    ) : null}
    </>
  );
};

interface MindMapCanvasProps {
  mindMap: MindMapDocument;
  campaignData: CampaignData;
  fitRequest: number;
  selectedNodeId: string | null;
  selectedEdgeNodeId: string | null;
  keywordData: RichKeywordData;
  entityOptionsByKey: Map<string, MindMapEntityOption>;
  onSelectNode: (nodeId: string) => void;
  onSelectEdge: (targetNodeId: string) => void;
  onClearSelection: () => void;
  onAddChild: (nodeId: string) => void;
  onAddSibling: (nodeId: string) => void;
  onMoveSibling: (nodeId: string, direction: MindMapSiblingDirection) => void;
  onToggleCollapse: (nodeId: string) => void;
  onRequestDelete: (nodeId: string) => void;
  onOpenTarget: (target: TooltipTargetPayload) => void;
  onNodePositionChange: (nodeId: string, position: { x: number; y: number }) => void;
}

const MindMapCanvas = (props: MindMapCanvasProps) => (
  <ReactFlowProvider>
    <MindMapCanvasInner {...props} />
  </ReactFlowProvider>
);

export default MindMapCanvas;
