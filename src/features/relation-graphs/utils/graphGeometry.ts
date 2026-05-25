import { buildResourceFileUrl } from '../../../services/resourceService';
import { RelationGraphEdge, RelationGraphNode } from '../../../types';

export const NODE_RADIUS = 30;
const EDGE_CURVE_STEP = 36;
const EDGE_ENDPOINT_OFFSET_STEP = 10;

export const tokenText = (name: string) => (name || '？').trim().slice(0, 1).toUpperCase();

export const edgeLabelMetrics = (edge: RelationGraphEdge) => {
  const width = Math.max(28, edge.label.length * edge.labelFontSize * 0.62 + 12);
  const height = Math.max(20, edge.labelFontSize + 10);
  return { width, height };
};

export const resolveTokenImage = (ref?: string) => {
  if (!ref) return '';
  if (ref.startsWith('http') || ref.startsWith('data:')) return ref;
  return buildResourceFileUrl(ref);
};

export const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const pairKeyForNodes = (a: string, b: string) => [a, b].sort().join('::');

export const computeEdgeCurveSlots = (edges: RelationGraphEdge[]): Record<string, number> => {
  const grouped = new Map<string, RelationGraphEdge[]>();
  edges.forEach((edge) => {
    const key = pairKeyForNodes(edge.fromNodeId, edge.toNodeId);
    const group = grouped.get(key) || [];
    group.push(edge);
    grouped.set(key, group);
  });

  const slots: Record<string, number> = {};
  const balancedSlots = (count: number, allowCenter: boolean) => {
    if (count <= 0) return [];
    if (allowCenter) {
      return Array.from({ length: count }, (_, index) => {
        if (index === 0) return 0;
        const level = Math.ceil(index / 2);
        return index % 2 === 1 ? level : -level;
      });
    }
    return Array.from({ length: count }, (_, index) => {
      const level = Math.floor(index / 2) + 0.5;
      return index % 2 === 0 ? level : -level;
    });
  };

  grouped.forEach((group) => {
    if (group.length <= 1) {
      slots[group[0].id] = 0;
      return;
    }
    const sortedPair = [group[0].fromNodeId, group[0].toNodeId].sort();
    const bidirectionalEdges = group.filter((edge) => edge.direction === 'bidirectional');
    const directionalEdges = group.filter((edge) => edge.direction !== 'bidirectional');
    const baseSlots = balancedSlots(group.length, bidirectionalEdges.length > 0 || group.length % 2 === 1);
    const availableSlots = [...baseSlots];

    const takeSpecificSlot = (value: number) => {
      const index = availableSlots.findIndex((slot) => slot === value);
      if (index >= 0) {
        const [slot] = availableSlots.splice(index, 1);
        return slot;
      }
      return null;
    };

    const takePreferredSlot = (wantPositive: boolean) => {
      const preferredIndex = availableSlots.findIndex((slot) => (wantPositive ? slot > 0 : slot < 0));
      if (preferredIndex >= 0) {
        const [slot] = availableSlots.splice(preferredIndex, 1);
        return slot;
      }
      const fallbackIndex = availableSlots.findIndex((slot) => slot === 0);
      if (fallbackIndex >= 0) {
        const [slot] = availableSlots.splice(fallbackIndex, 1);
        return slot;
      }
      const [slot] = availableSlots.splice(0, 1);
      return slot ?? 0;
    };

    bidirectionalEdges.forEach((edge) => {
      const centered = takeSpecificSlot(0);
      if (centered !== null) {
        slots[edge.id] = centered;
        return;
      }
      const [nearest] = availableSlots.splice(0, 1);
      slots[edge.id] = nearest ?? 0;
    });

    directionalEdges.forEach((edge) => {
      const alignedWithSortedPair =
        edge.fromNodeId === sortedPair[0] && edge.toNodeId === sortedPair[1];
      slots[edge.id] = takePreferredSlot(alignedWithSortedPair);
    });
  });

  return slots;
};

export const buildEdgeGeometry = (
  from: RelationGraphNode,
  to: RelationGraphNode,
  curveSlot: number
) => {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const endPadding = NODE_RADIUS + 10;
  const normalX = -uy;
  const normalY = ux;
  const endpointOffset = curveSlot * EDGE_ENDPOINT_OFFSET_STEP;
  const startX = from.x + ux * endPadding + normalX * endpointOffset;
  const startY = from.y + uy * endPadding + normalY * endpointOffset;
  const endX = to.x - ux * endPadding + normalX * endpointOffset;
  const endY = to.y - uy * endPadding + normalY * endpointOffset;
  const mx = (startX + endX) / 2;
  const my = (startY + endY) / 2;
  const curveAmount = curveSlot * EDGE_CURVE_STEP;
  if (curveAmount === 0) {
    return {
      path: `M ${startX} ${startY} L ${endX} ${endY}`,
      labelX: mx,
      labelY: my,
      startX,
      startY,
      endX,
      endY,
    };
  }
  const controlX = mx + normalX * curveAmount;
  const controlY = my + normalY * curveAmount;
  return {
    path: `M ${startX} ${startY} Q ${controlX} ${controlY} ${endX} ${endY}`,
    labelX: 0.25 * startX + 0.5 * controlX + 0.25 * endX,
    labelY: 0.25 * startY + 0.5 * controlY + 0.25 * endY,
    startX,
    startY,
    endX,
    endY,
  };
};
