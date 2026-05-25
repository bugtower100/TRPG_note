import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { dataService } from '../../../services/dataService';
import { relationGraphService } from '../../../services/relationGraphService';
import {
  ResourceFolder,
  ResourceItem,
  resourceService,
  RESOURCE_ROOT_PATH,
} from '../../../services/resourceService';
import { CampaignData, RelationGraph } from '../../../types';
import { computeEdgeCurveSlots } from '../utils/graphGeometry';

interface FilterEntityOption {
  id: string;
}

interface UseRelationGraphWorkspaceOptions {
  campaignData: CampaignData;
  setCampaignData: (data: CampaignData) => void;
  filteredEntities: FilterEntityOption[];
}

export const useRelationGraphWorkspace = ({
  campaignData,
  setCampaignData,
  filteredEntities,
}: UseRelationGraphWorkspaceOptions) => {
  const [activeGraphId, setActiveGraphId] = useState<string | null>(null);
  const [entityIdToAdd, setEntityIdToAdd] = useState<string>('');
  const [historyPast, setHistoryPast] = useState<RelationGraph[]>([]);
  const [historyFuture, setHistoryFuture] = useState<RelationGraph[]>([]);
  const [resources, setResources] = useState<ResourceItem[]>([]);
  const [resourceFolders, setResourceFolders] = useState<ResourceFolder[]>([]);
  const [resourcePickerOpen, setResourcePickerOpen] = useState(false);
  const [resourceKeyword, setResourceKeyword] = useState('');
  const [resourceExpandedFolders, setResourceExpandedFolders] = useState<string[]>([RESOURCE_ROOT_PATH]);
  const [resourceSelectedFolderPath, setResourceSelectedFolderPath] = useState(RESOURCE_ROOT_PATH);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSaveRef = useRef<CampaignData | null>(null);

  const scheduleSave = useCallback((nextData: CampaignData, immediate = false) => {
    pendingSaveRef.current = nextData;
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    if (immediate) {
      dataService.saveCampaign(nextData);
      pendingSaveRef.current = null;
      return;
    }
    saveTimerRef.current = setTimeout(() => {
      if (pendingSaveRef.current) {
        dataService.saveCampaign(pendingSaveRef.current);
        pendingSaveRef.current = null;
      }
      saveTimerRef.current = null;
    }, 280);
  }, []);

  const graphs = useMemo(() => relationGraphService.list(campaignData), [campaignData]);
  const activeGraph = useMemo(
    () => graphs.find((g) => g.id === activeGraphId) || null,
    [graphs, activeGraphId]
  );
  const edgeCurveSlots = useMemo(
    () => computeEdgeCurveSlots(activeGraph?.edges || []),
    [activeGraph]
  );

  const persistGraph = useCallback((graph: RelationGraph, withHistory: boolean = true) => {
    if (withHistory && activeGraph) {
      setHistoryPast((prev) => [...prev.slice(-59), activeGraph]);
      setHistoryFuture([]);
    }
    const next = relationGraphService.update(campaignData, graph);
    setCampaignData(next);
    scheduleSave(next, false);
  }, [activeGraph, campaignData, scheduleSave, setCampaignData]);

  useEffect(() => {
    if (graphs.length === 0) {
      const created = relationGraphService.create(campaignData, '主关系图');
      setCampaignData(created.data);
      scheduleSave(created.data, true);
      setActiveGraphId(created.graph.id);
      return;
    }
    if (!activeGraphId || !graphs.some((g) => g.id === activeGraphId)) {
      setActiveGraphId(graphs[0].id);
    }
  }, [graphs, activeGraphId, campaignData, setCampaignData, scheduleSave]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      if (pendingSaveRef.current) {
        dataService.saveCampaign(pendingSaveRef.current);
        pendingSaveRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!entityIdToAdd && filteredEntities.length > 0) {
      setEntityIdToAdd(filteredEntities[0].id);
    }
    if (entityIdToAdd && !filteredEntities.some((e) => e.id === entityIdToAdd)) {
      setEntityIdToAdd(filteredEntities[0]?.id || '');
    }
  }, [filteredEntities, entityIdToAdd]);

  const loadResources = useCallback(async () => {
    try {
      const result = await resourceService.list();
      setResources(result.items);
      setResourceFolders(result.folders);
    } catch {
      setResources([]);
      setResourceFolders([]);
    }
  }, []);

  useEffect(() => {
    loadResources();
  }, [loadResources]);

  const selectGraph = useCallback((graphId: string) => {
    setActiveGraphId(graphId);
    setHistoryPast([]);
    setHistoryFuture([]);
  }, []);

  const createGraph = useCallback(() => {
    const name = window.prompt('输入关系图名称', '新关系图');
    if (name === null) return;
    const created = relationGraphService.create(campaignData, name);
    setCampaignData(created.data);
    scheduleSave(created.data, true);
    setActiveGraphId(created.graph.id);
    setHistoryPast([]);
    setHistoryFuture([]);
  }, [campaignData, scheduleSave, setCampaignData]);

  const renameGraph = useCallback(() => {
    if (!activeGraph) return;
    const name = window.prompt('输入新的关系图名称', activeGraph.name);
    if (name === null) return;
    persistGraph({ ...activeGraph, name: name.trim() || '未命名关系图' });
  }, [activeGraph, persistGraph]);

  const deleteGraph = useCallback(() => {
    if (!activeGraph) return;
    if (!window.confirm('确定删除当前关系图吗？')) return;
    const next = relationGraphService.remove(campaignData, activeGraph.id);
    setCampaignData(next);
    scheduleSave(next, true);
    setActiveGraphId(next.relationGraphs?.[0]?.id || null);
    setHistoryPast([]);
    setHistoryFuture([]);
  }, [activeGraph, campaignData, scheduleSave, setCampaignData]);

  const undo = useCallback(() => {
    if (!activeGraph || historyPast.length === 0) return;
    const prev = historyPast[historyPast.length - 1];
    setHistoryPast((p) => p.slice(0, -1));
    setHistoryFuture((f) => [activeGraph, ...f].slice(0, 60));
    persistGraph(prev, false);
  }, [activeGraph, historyPast, persistGraph]);

  const redo = useCallback(() => {
    if (!activeGraph || historyFuture.length === 0) return;
    const nextGraph = historyFuture[0];
    setHistoryFuture((f) => f.slice(1));
    setHistoryPast((p) => [...p.slice(-59), activeGraph]);
    persistGraph(nextGraph, false);
  }, [activeGraph, historyFuture, persistGraph]);

  return {
    activeGraphId,
    entityIdToAdd,
    setEntityIdToAdd,
    historyPast,
    historyFuture,
    resources,
    resourceFolders,
    resourcePickerOpen,
    setResourcePickerOpen,
    resourceKeyword,
    setResourceKeyword,
    resourceExpandedFolders,
    setResourceExpandedFolders,
    resourceSelectedFolderPath,
    setResourceSelectedFolderPath,
    graphs,
    activeGraph,
    edgeCurveSlots,
    persistGraph,
    loadResources,
    selectGraph,
    createGraph,
    renameGraph,
    deleteGraph,
    undo,
    redo,
  };
};
