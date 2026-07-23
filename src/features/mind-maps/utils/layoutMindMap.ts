import { Graph, layout } from '@dagrejs/dagre';
import {
  MarkerType,
  Position,
  type Edge,
  type Node,
} from '@xyflow/react';
import type { MindMapDocument, MindMapEntityReference } from '../../../types';
import type {
  MindMapEntityOption,
  MindMapKeywordSegment,
} from './mindMapReferences';
import type { TooltipTargetPayload } from '../../../components/common/richTextReference';
import { getMindMapNodeEntityRefs } from '../../../utils/mindMapCompatibility';

export const MIND_MAP_NODE_WIDTH = 220;
export const MIND_MAP_NODE_HEIGHT = 96;

export type MindMapNodeData = {
  title: string;
  titleSegments?: MindMapKeywordSegment[];
  color?: string;
  entityRefs: MindMapEntityReference[];
  entityReferences?: Array<MindMapEntityOption | undefined>;
  isRoot: boolean;
  collapsed: boolean;
  hasChildren: boolean;
  hiddenDescendantCount: number;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onAddChild?: () => void;
  onAddSibling?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onToggleCollapse?: () => void;
  onDelete?: () => void;
  onOpenTarget?: (target: TooltipTargetPayload) => void;
  onPreviewTarget?: (target: TooltipTargetPayload, anchor: HTMLElement) => void;
  onHidePreview?: () => void;
};

export type MindMapFlowNode = Node<MindMapNodeData, 'mindMap'>;

export interface MindMapLayoutResult {
  nodes: MindMapFlowNode[];
  edges: Edge[];
}

interface LayoutMindMapOptions {
  useStoredPositions?: boolean;
}

const compareNodes = (
  left: MindMapDocument['nodes'][number],
  right: MindMapDocument['nodes'][number]
) => {
  if (left.parentId === right.parentId) {
    return left.siblingOrder - right.siblingOrder;
  }
  return left.id.localeCompare(right.id);
};

const buildChildrenByParent = (mindMap: MindMapDocument) => {
  const childrenByParent = new Map<string, MindMapDocument['nodes']>();
  mindMap.nodes.forEach((node) => {
    if (!node.parentId) return;
    const children = childrenByParent.get(node.parentId) || [];
    children.push(node);
    childrenByParent.set(node.parentId, children);
  });
  childrenByParent.forEach((children) => children.sort(compareNodes));
  return childrenByParent;
};

const descendantIds = (
  nodeId: string,
  childrenByParent: Map<string, MindMapDocument['nodes']>
) => {
  const result = new Set<string>();
  const pending = [...(childrenByParent.get(nodeId) || [])];
  while (pending.length > 0) {
    const current = pending.pop();
    if (!current || result.has(current.id)) continue;
    result.add(current.id);
    pending.push(...(childrenByParent.get(current.id) || []));
  }
  return result;
};

export const visibleMindMapNodeIds = (mindMap: MindMapDocument): Set<string> => {
  const childrenByParent = buildChildrenByParent(mindMap);
  const hiddenIds = new Set<string>();
  const pending: MindMapDocument['nodes'] = [];
  mindMap.nodes.forEach((node) => {
    if (!node.collapsed) return;
    pending.push(...(childrenByParent.get(node.id) || []));
  });
  while (pending.length > 0) {
    const current = pending.pop();
    if (!current || hiddenIds.has(current.id)) continue;
    hiddenIds.add(current.id);
    pending.push(...(childrenByParent.get(current.id) || []));
  }
  return new Set(
    mindMap.nodes
      .filter((node) => !hiddenIds.has(node.id))
      .map((node) => node.id)
  );
};

export const layoutMindMap = (
  mindMap: MindMapDocument,
  { useStoredPositions = true }: LayoutMindMapOptions = {}
): MindMapLayoutResult => {
  const isHorizontal = mindMap.layoutDirection === 'LR';
  const graph = new Graph().setDefaultEdgeLabel(() => ({}));
  graph.setGraph({
    rankdir: mindMap.layoutDirection,
    ranksep: isHorizontal ? 90 : 72,
    nodesep: isHorizontal ? 36 : 54,
    marginx: 40,
    marginy: 40,
  });

  const childrenByParent = buildChildrenByParent(mindMap);
  const visibleNodeIds = visibleMindMapNodeIds(mindMap);
  const orderedNodes = mindMap.nodes
    .filter((node) => visibleNodeIds.has(node.id))
    .sort(compareNodes);
  const nodeIds = new Set(orderedNodes.map((node) => node.id));

  orderedNodes.forEach((node) => {
    graph.setNode(node.id, {
      width: MIND_MAP_NODE_WIDTH,
      height: MIND_MAP_NODE_HEIGHT,
    });
  });

  const edges: Edge[] = [];
  orderedNodes.forEach((node) => {
    if (!node.parentId || node.parentId === node.id || !nodeIds.has(node.parentId)) return;
    graph.setEdge(node.parentId, node.id);
    edges.push({
      id: `mind-map-edge:${node.parentId}:${node.id}`,
      source: node.parentId,
      target: node.id,
      type: 'smoothstep',
      label: node.incomingEdgeLabel,
      labelShowBg: Boolean(node.incomingEdgeLabel),
      labelBgPadding: [8, 5],
      labelBgBorderRadius: 7,
      labelStyle: {
        fill: 'var(--text-primary)',
        fontSize: 12,
        fontWeight: 600,
      },
      labelBgStyle: {
        fill: 'var(--bg-card)',
        fillOpacity: 0.94,
        stroke: 'var(--border-color)',
        strokeWidth: 1,
      },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: 'var(--primary-color)',
        width: 16,
        height: 16,
      },
      style: {
        stroke: 'var(--primary-color)',
        strokeWidth: 1.6,
      },
      className: 'mind-map-edge',
    });
  });

  layout(graph);

  const sourcePosition = isHorizontal ? Position.Right : Position.Bottom;
  const targetPosition = isHorizontal ? Position.Left : Position.Top;
  const nodes: MindMapFlowNode[] = orderedNodes.map((node) => {
    const automaticPosition = graph.node(node.id);
    const position = useStoredPositions ? node.position : undefined;
    const siblings = node.parentId ? (childrenByParent.get(node.parentId) || []) : [];
    const siblingIndex = siblings.findIndex((item) => item.id === node.id);
    const hiddenDescendantCount = node.collapsed
      ? descendantIds(node.id, childrenByParent).size
      : 0;
    return {
      id: node.id,
      type: 'mindMap',
      position: {
        x: position?.x ?? automaticPosition.x - MIND_MAP_NODE_WIDTH / 2,
        y: position?.y ?? automaticPosition.y - MIND_MAP_NODE_HEIGHT / 2,
      },
      sourcePosition,
      targetPosition,
      draggable: true,
      selectable: false,
      data: {
        title: node.title,
        entityRefs: getMindMapNodeEntityRefs(node),
        color: node.color,
        isRoot: node.id === mindMap.rootNodeId,
        collapsed: node.collapsed,
        hasChildren: (childrenByParent.get(node.id) || []).length > 0,
        hiddenDescendantCount,
        canMoveUp: siblingIndex > 0,
        canMoveDown: siblingIndex >= 0 && siblingIndex < siblings.length - 1,
      },
    };
  });

  return { nodes, edges };
};

export const calculateAutomaticMindMapPositions = (
  mindMap: MindMapDocument
): Map<string, { x: number; y: number }> => {
  const expandedMindMap = {
    ...mindMap,
    nodes: mindMap.nodes.map((node) => ({ ...node, collapsed: false })),
  };
  return new Map(
    layoutMindMap(expandedMindMap, { useStoredPositions: false }).nodes.map((node) => [
      node.id,
      node.position,
    ])
  );
};
