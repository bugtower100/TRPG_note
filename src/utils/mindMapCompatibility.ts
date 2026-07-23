import type {
  MindMapDocument,
  MindMapEntityReference,
  MindMapNode,
} from '../types';

type MindMapNodeReferenceFields = Pick<MindMapNode, 'entityRefs' | 'entityRef'>;

export const getMindMapNodeEntityRefs = (
  node: MindMapNodeReferenceFields
): MindMapEntityReference[] => {
  if (Array.isArray(node.entityRefs) && node.entityRefs.length > 0) {
    return node.entityRefs;
  }
  return node.entityRef ? [node.entityRef] : [];
};

export const normalizeMindMapCompatibility = (
  mindMap: MindMapDocument
): MindMapDocument => {
  if (!Array.isArray(mindMap.nodes)) {
    return { ...mindMap, nodes: [] };
  }

  let changed = false;
  const nodes = mindMap.nodes.map((node) => {
    const entityRefs = getMindMapNodeEntityRefs(node);
    if (
      Array.isArray(node.entityRefs)
      && (node.entityRefs.length > 0 || !node.entityRef)
    ) {
      return node;
    }
    changed = true;
    return {
      ...node,
      entityRefs,
      entityRef: entityRefs[0],
    };
  });

  return changed ? { ...mindMap, nodes } : mindMap;
};
