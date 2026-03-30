import { v4 as uuidv4 } from 'uuid';
import { CampaignData, GraphEntityType, RelationGraph, RelationGraphEdge, RelationGraphNode } from '../types';

const now = () => Date.now();

const normalizeGraph = (graph: RelationGraph): RelationGraph => ({
  ...graph,
  name: graph.name?.trim() || '新关系图',
  nodes: Array.isArray(graph.nodes) ? graph.nodes : [],
  edges: Array.isArray(graph.edges) ? graph.edges : [],
  updatedAt: graph.updatedAt || now(),
});

export const relationGraphService = {
  list(data: CampaignData): RelationGraph[] {
    return (data.relationGraphs || []).map(normalizeGraph);
  },

  create(data: CampaignData, name: string): { data: CampaignData; graph: RelationGraph } {
    const graph: RelationGraph = {
      id: uuidv4(),
      name: name.trim() || '新关系图',
      nodes: [],
      edges: [],
      updatedAt: now(),
    };
    return {
      data: { ...data, relationGraphs: [...this.list(data), graph] },
      graph,
    };
  },

  update(data: CampaignData, graph: RelationGraph): CampaignData {
    const graphs = this.list(data);
    const idx = graphs.findIndex((g) => g.id === graph.id);
    const next = { ...normalizeGraph(graph), updatedAt: now() };
    if (idx < 0) {
      return { ...data, relationGraphs: [...graphs, next] };
    }
    const cloned = [...graphs];
    cloned[idx] = next;
    return { ...data, relationGraphs: cloned };
  },

  remove(data: CampaignData, graphId: string): CampaignData {
    return {
      ...data,
      relationGraphs: this.list(data).filter((g) => g.id !== graphId),
    };
  },

  makeNode(entityId: string, entityType: GraphEntityType, label: string, x: number, y: number): RelationGraphNode {
    return {
      id: uuidv4(),
      entityId,
      entityType,
      label,
      x,
      y,
      note: '',
      tokenImageRef: '',
    };
  },

  makeEdge(fromNodeId: string, toNodeId: string): RelationGraphEdge {
    return {
      id: uuidv4(),
      fromNodeId,
      toNodeId,
      direction: 'forward',
      lineStyle: 'solid',
      lineWidth: 2,
      label: '',
      labelFontSize: 12,
      labelColor: '#374151',
      labelBgColor: '#ffffff',
      labelBgOpacity: 0.5,
    };
  },
};
