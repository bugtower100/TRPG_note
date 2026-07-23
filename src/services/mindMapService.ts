import { v4 as uuidv4 } from 'uuid';
import { MIND_MAP_MAX_ENTITY_REFS } from '../types';
import type {
  CampaignData,
  MindMapDocument,
  MindMapEntityReference,
  MindMapLayoutDirection,
  MindMapNode,
} from '../types';
import {
  getMindMapNodeEntityRefs,
  normalizeMindMapCompatibility,
} from '../utils/mindMapCompatibility';

export type MindMapSiblingDirection = 'up' | 'down';

const now = () => Date.now();

const createRootNode = (title: string, timestamp: number): MindMapNode => ({
  id: uuidv4(),
  parentId: null,
  title,
  content: '',
  siblingOrder: 0,
  collapsed: false,
  entityRefs: [],
  createdAt: timestamp,
  updatedAt: timestamp,
});

const createNode = (
  parentId: string,
  title: string,
  siblingOrder: number,
  timestamp: number
): MindMapNode => ({
  id: uuidv4(),
  parentId,
  title: title.trim() || '新节点',
  content: '',
  siblingOrder,
  collapsed: false,
  entityRefs: [],
  createdAt: timestamp,
  updatedAt: timestamp,
});

const nextSiblingOrder = (mindMap: MindMapDocument, parentId: string) =>
  mindMap.nodes.reduce(
    (highest, node) => (
      node.parentId === parentId
        ? Math.max(highest, node.siblingOrder)
        : highest
    ),
    -1
  ) + 1;

export const mindMapService = {
  list(data: CampaignData): MindMapDocument[] {
    return Array.isArray(data.mindMaps)
      ? data.mindMaps.map(normalizeMindMapCompatibility)
      : [];
  },

  create(name: string): MindMapDocument {
    const timestamp = now();
    const normalizedName = name.trim() || '新思维导图';
    const rootNode = createRootNode(normalizedName, timestamp);
    return {
      id: uuidv4(),
      name: normalizedName,
      rootNodeId: rootNode.id,
      nodes: [rootNode],
      layoutDirection: 'LR',
      createdAt: timestamp,
      updatedAt: timestamp,
    };
  },

  update(data: CampaignData, mindMap: MindMapDocument): CampaignData {
    const maps = this.list(data);
    const nextMap = { ...mindMap, updatedAt: now() };
    const existingIndex = maps.findIndex((item) => item.id === mindMap.id);
    if (existingIndex < 0) {
      return { ...data, mindMaps: [...maps, nextMap] };
    }
    return {
      ...data,
      mindMaps: maps.map((item, index) => (index === existingIndex ? nextMap : item)),
    };
  },

  remove(data: CampaignData, mindMapId: string): CampaignData {
    return {
      ...data,
      mindMaps: this.list(data).filter((item) => item.id !== mindMapId),
    };
  },

  setLayoutDirection(
    data: CampaignData,
    mindMap: MindMapDocument,
    layoutDirection: MindMapLayoutDirection
  ): CampaignData {
    if (mindMap.layoutDirection === layoutDirection) return data;
    return this.update(data, { ...mindMap, layoutDirection });
  },

  setNodePosition(
    mindMap: MindMapDocument,
    nodeId: string,
    position: { x: number; y: number }
  ): MindMapDocument {
    if (!Number.isFinite(position.x) || !Number.isFinite(position.y)) return mindMap;
    const normalizedPosition = {
      x: Math.round(position.x * 100) / 100,
      y: Math.round(position.y * 100) / 100,
    };
    const currentNode = mindMap.nodes.find((node) => node.id === nodeId);
    if (
      !currentNode
      || (
        currentNode.position?.x === normalizedPosition.x
        && currentNode.position?.y === normalizedPosition.y
      )
    ) {
      return mindMap;
    }
    const timestamp = now();
    return {
      ...mindMap,
      nodes: mindMap.nodes.map((node) => (
        node.id === nodeId ? { ...node, position: normalizedPosition, updatedAt: timestamp } : node
      )),
      updatedAt: timestamp,
    };
  },

  setIncomingEdgeLabel(
    mindMap: MindMapDocument,
    nodeId: string,
    label: string
  ): MindMapDocument {
    const currentNode = mindMap.nodes.find((node) => node.id === nodeId);
    if (!currentNode?.parentId) return mindMap;
    const normalizedLabel = label.trim().slice(0, 120);
    const currentLabel = currentNode.incomingEdgeLabel || '';
    if (currentLabel === normalizedLabel) return mindMap;
    const timestamp = now();
    return {
      ...mindMap,
      nodes: mindMap.nodes.map((node) => (
        node.id === nodeId
          ? {
              ...node,
              incomingEdgeLabel: normalizedLabel || undefined,
              updatedAt: timestamp,
            }
          : node
      )),
      updatedAt: timestamp,
    };
  },

  createRoot(mindMap: MindMapDocument, title: string): MindMapDocument | null {
    if (mindMap.nodes.length > 0) return null;
    const timestamp = now();
    const rootNode = createRootNode(title.trim() || '中心主题', timestamp);
    return {
      ...mindMap,
      rootNodeId: rootNode.id,
      nodes: [rootNode],
      updatedAt: timestamp,
    };
  },

  addChild(
    mindMap: MindMapDocument,
    parentId: string,
    title: string
  ): { mindMap: MindMapDocument; node: MindMapNode } | null {
    if (!mindMap.nodes.some((node) => node.id === parentId)) return null;
    const timestamp = now();
    const node = createNode(
      parentId,
      title,
      nextSiblingOrder(mindMap, parentId),
      timestamp
    );
    return {
      mindMap: {
        ...mindMap,
        nodes: [
          ...mindMap.nodes.map((item) => (
            item.id === parentId && item.collapsed
              ? { ...item, collapsed: false, updatedAt: timestamp }
              : item
          )),
          node,
        ],
        updatedAt: timestamp,
      },
      node,
    };
  },

  addSibling(
    mindMap: MindMapDocument,
    siblingId: string,
    title: string
  ): { mindMap: MindMapDocument; node: MindMapNode } | null {
    const sibling = mindMap.nodes.find((node) => node.id === siblingId);
    if (!sibling?.parentId) return null;
    return this.addChild(mindMap, sibling.parentId, title);
  },

  updateNode(
    mindMap: MindMapDocument,
    nodeId: string,
    changes: Pick<MindMapNode, 'title' | 'content'> & {
      entityRefs: MindMapEntityReference[];
    }
  ): MindMapDocument {
    const normalizedTitle = changes.title.trim() || '未命名节点';
    const seenReferences = new Set<string>();
    const normalizedEntityRefs = changes.entityRefs.filter((reference) => {
      const key = `${reference.entityType}:${reference.entityId}`;
      if (!reference.entityId || seenReferences.has(key)) return false;
      seenReferences.add(key);
      return true;
    }).slice(0, MIND_MAP_MAX_ENTITY_REFS);
    const currentNode = mindMap.nodes.find((node) => node.id === nodeId);
    const currentEntityRefs = currentNode
      ? getMindMapNodeEntityRefs(currentNode)
      : [];
    const referencesUnchanged = currentEntityRefs.length === normalizedEntityRefs.length
      && currentEntityRefs.every((reference, index) => (
        reference.entityType === normalizedEntityRefs[index]?.entityType
        && reference.entityId === normalizedEntityRefs[index]?.entityId
      ));
    if (
      !currentNode
      || (
        currentNode.title === normalizedTitle
        && currentNode.content === changes.content
        && referencesUnchanged
      )
    ) {
      return mindMap;
    }
    const timestamp = now();
    const nodes = mindMap.nodes.map((node) => {
      if (node.id !== nodeId) return node;
      return {
        ...node,
        title: normalizedTitle,
        content: changes.content,
        entityRefs: normalizedEntityRefs,
        entityRef: normalizedEntityRefs[0],
        updatedAt: timestamp,
      };
    });
    return { ...mindMap, nodes, updatedAt: timestamp };
  },

  branchNodeIds(mindMap: MindMapDocument, nodeId: string): Set<string> {
    if (!mindMap.nodes.some((node) => node.id === nodeId)) return new Set();
    const childrenByParent = new Map<string, string[]>();
    mindMap.nodes.forEach((node) => {
      if (!node.parentId) return;
      const children = childrenByParent.get(node.parentId) || [];
      children.push(node.id);
      childrenByParent.set(node.parentId, children);
    });

    const result = new Set<string>();
    const pending = [nodeId];
    while (pending.length > 0) {
      const currentId = pending.pop();
      if (!currentId || result.has(currentId)) continue;
      result.add(currentId);
      pending.push(...(childrenByParent.get(currentId) || []));
    }
    return result;
  },

  removeBranch(mindMap: MindMapDocument, nodeId: string): MindMapDocument | null {
    if (nodeId === mindMap.rootNodeId) return null;
    const removedIds = this.branchNodeIds(mindMap, nodeId);
    if (removedIds.size === 0) return null;
    return {
      ...mindMap,
      nodes: mindMap.nodes.filter((node) => !removedIds.has(node.id)),
      updatedAt: now(),
    };
  },

  toggleCollapsed(mindMap: MindMapDocument, nodeId: string): MindMapDocument {
    const hasChildren = mindMap.nodes.some((node) => node.parentId === nodeId);
    if (!hasChildren) return mindMap;
    const timestamp = now();
    let changed = false;
    const nodes = mindMap.nodes.map((node) => {
      if (node.id !== nodeId) return node;
      changed = true;
      return {
        ...node,
        collapsed: !node.collapsed,
        updatedAt: timestamp,
      };
    });
    return changed ? { ...mindMap, nodes, updatedAt: timestamp } : mindMap;
  },

  moveSibling(
    mindMap: MindMapDocument,
    nodeId: string,
    direction: MindMapSiblingDirection
  ): MindMapDocument {
    const node = mindMap.nodes.find((item) => item.id === nodeId);
    if (!node?.parentId) return mindMap;

    const originalIndex = new Map(mindMap.nodes.map((item, index) => [item.id, index]));
    const siblings = mindMap.nodes
      .filter((item) => item.parentId === node.parentId)
      .sort((left, right) => (
        left.siblingOrder - right.siblingOrder
        || (originalIndex.get(left.id) || 0) - (originalIndex.get(right.id) || 0)
      ));
    const currentIndex = siblings.findIndex((item) => item.id === nodeId);
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= siblings.length) {
      return mindMap;
    }

    const reordered = [...siblings];
    [reordered[currentIndex], reordered[targetIndex]] = [
      reordered[targetIndex],
      reordered[currentIndex],
    ];
    const orderById = new Map(reordered.map((item, index) => [item.id, index]));
    const timestamp = now();
    return {
      ...mindMap,
      nodes: mindMap.nodes.map((item) => {
        const siblingOrder = orderById.get(item.id);
        if (siblingOrder === undefined || siblingOrder === item.siblingOrder) return item;
        return { ...item, siblingOrder, updatedAt: timestamp };
      }),
      updatedAt: timestamp,
    };
  },
};
