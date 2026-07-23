import type { MindMapDocument, MindMapNode } from '../../../types';
import { visibleMindMapNodeIds } from './layoutMindMap';

export type MindMapNavigationKey = 'arrowup' | 'arrowdown' | 'arrowleft' | 'arrowright';

const sortBySiblingOrder = (
  nodes: MindMapNode[],
  originalIndex: Map<string, number>
) => (
  [...nodes].sort((left, right) => (
    left.siblingOrder - right.siblingOrder
    || (originalIndex.get(left.id) || 0) - (originalIndex.get(right.id) || 0)
  ))
);

export const findMindMapNavigationTarget = (
  mindMap: MindMapDocument,
  nodeId: string,
  key: MindMapNavigationKey
): string | null => {
  const currentNode = mindMap.nodes.find((node) => node.id === nodeId);
  if (!currentNode) return null;

  const parentKey = mindMap.layoutDirection === 'LR' ? 'arrowleft' : 'arrowup';
  const childKey = mindMap.layoutDirection === 'LR' ? 'arrowright' : 'arrowdown';
  const previousSiblingKey = mindMap.layoutDirection === 'LR' ? 'arrowup' : 'arrowleft';
  const nextSiblingKey = mindMap.layoutDirection === 'LR' ? 'arrowdown' : 'arrowright';

  if (key === parentKey) {
    return currentNode.parentId;
  }

  const visibleNodeIds = visibleMindMapNodeIds(mindMap);
  const originalIndex = new Map(mindMap.nodes.map((node, index) => [node.id, index]));
  if (key === childKey) {
    const children = sortBySiblingOrder(
      mindMap.nodes.filter(
        (node) => node.parentId === currentNode.id && visibleNodeIds.has(node.id)
      ),
      originalIndex
    );
    return children[0]?.id || null;
  }

  if (key !== previousSiblingKey && key !== nextSiblingKey) {
    return null;
  }
  const siblings = sortBySiblingOrder(
    mindMap.nodes.filter(
      (node) => node.parentId === currentNode.parentId && visibleNodeIds.has(node.id)
    ),
    originalIndex
  );
  const currentIndex = siblings.findIndex((node) => node.id === currentNode.id);
  const targetIndex = key === previousSiblingKey ? currentIndex - 1 : currentIndex + 1;
  return siblings[targetIndex]?.id || null;
};
