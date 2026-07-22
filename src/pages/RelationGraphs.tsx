import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useCampaignData, useCampaignTabs } from '../context/CampaignContext';
import { dataService } from '../services/dataService';
import { relationGraphService } from '../services/relationGraphService';
import { Character, RelationGraphEdge, RelationGraphNode } from '../types';
import {
  RESOURCE_ROOT_PATH,
  resourceService,
} from '../services/resourceService';
import { useReceivedShares } from '../hooks/useReceivedShares';
import { useCampaignMemberRole } from '../hooks/useCampaignMemberRole';
import RelationGraphEdgePanel from '../features/relation-graphs/components/RelationGraphEdgePanel';
import RelationGraphNodePanel from '../features/relation-graphs/components/RelationGraphNodePanel';
import RelationGraphResourcePickerModal from '../features/relation-graphs/components/RelationGraphResourcePickerModal';
import { useRelationGraphWorkspace } from '../features/relation-graphs/hooks/useRelationGraphWorkspace';
import {
  NODE_RADIUS,
  buildEdgeGeometry,
  clamp,
  edgeLabelMetrics,
  resolveTokenImage,
  tokenText,
} from '../features/relation-graphs/utils/graphGeometry';

type GraphEntity = {
  id: string;
  openEntityId: string;
  type: 'characters' | 'monsters';
  name: string;
  isShared?: boolean;
};

const RelationGraphs: React.FC = () => {
  const { campaignData, setCampaignData } = useCampaignData();
  const { openInTab } = useCampaignTabs();
  const sharedCharacters = useReceivedShares('characters');
  const sharedMonsters = useReceivedShares('monsters');
  const { canManageCampaignContent } = useCampaignMemberRole();
  const boardRef = useRef<HTMLDivElement>(null);
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [linkingFromNodeId, setLinkingFromNodeId] = useState<string | null>(null);
  const [edgeEditorId, setEdgeEditorId] = useState<string | null>(null);
  const [dragNode, setDragNode] = useState<{ id: string; dx: number; dy: number } | null>(null);
  const [entityTypeFilter, setEntityTypeFilter] = useState<'characters' | 'monsters'>('characters');
  const [newCharacterName, setNewCharacterName] = useState('');
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const [boxSelectMode, setBoxSelectMode] = useState(false);
  const [marquee, setMarquee] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);

  const entities = useMemo<GraphEntity[]>(() => {
    const res: GraphEntity[] = [];
    if (canManageCampaignContent) {
      campaignData.characters.forEach((item) => {
        res.push({ id: item.id, openEntityId: item.id, type: 'characters', name: item.name || '未命名' });
      });
      campaignData.monsters.forEach((item) => {
        res.push({ id: item.id, openEntityId: item.id, type: 'monsters', name: item.name || '未命名' });
      });
    }
    sharedCharacters.forEach((item) => {
      res.push({
        id: `shared:${item.id}`,
        openEntityId: `shared:${item.id}`,
        type: 'characters',
        name: `${item.entityName}（${item.sourceOwnerUsername}分享）`,
        isShared: true,
      });
    });
    sharedMonsters.forEach((item) => {
      res.push({
        id: `shared:${item.id}`,
        openEntityId: `shared:${item.id}`,
        type: 'monsters',
        name: `${item.entityName}（${item.sourceOwnerUsername}分享）`,
        isShared: true,
      });
    });
    return res;
  }, [campaignData.characters, campaignData.monsters, canManageCampaignContent, sharedCharacters, sharedMonsters]);

  const filteredEntities = useMemo(
    () => entities.filter((e) => e.type === entityTypeFilter),
    [entities, entityTypeFilter]
  );

  const {
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
  } = useRelationGraphWorkspace({
    campaignData,
    setCampaignData,
    filteredEntities,
  });

  const toWorldPoint = useCallback((clientX: number, clientY: number) => {
    if (!boardRef.current) return { x: 0, y: 0 };
    const rect = boardRef.current.getBoundingClientRect();
    return {
      x: (clientX - rect.left - offset.x) / scale,
      y: (clientY - rect.top - offset.y) / scale,
    };
  }, [offset.x, offset.y, scale]);

  const touchStateRef = useRef<{
    mode: 'pan' | 'pinch' | null;
    startOffset: { x: number; y: number };
    startScale: number;
    startCenter?: { x: number; y: number }; // screen coords
    startDistance?: number;
    panStart?: { x: number; y: number };
    tapCandidate?: boolean;
    moved?: boolean;
  } | null>(null);

  useEffect(() => {
    const el = boardRef.current;
    if (!el) return;

    const getDistance = (t0: Touch, t1: Touch) => {
      const dx = t1.clientX - t0.clientX;
      const dy = t1.clientY - t0.clientY;
      return Math.sqrt(dx * dx + dy * dy);
    };
    const getCenter = (t0: Touch, t1: Touch) => ({
      x: (t0.clientX + t1.clientX) / 2,
      y: (t0.clientY + t1.clientY) / 2,
    });

    const handleTouchStart = (e: TouchEvent) => {
      if (!boardRef.current) return;
      const touchTarget = e.target as HTMLElement | null;
      const touchingNode = Boolean(touchTarget?.closest('[data-graph-node="true"]'));
      if (e.touches.length === 1) {
        if (touchingNode) {
          touchStateRef.current = null;
          return;
        }
        const t = e.touches[0];
        touchStateRef.current = {
          mode: 'pan',
          startOffset: { ...offset },
          startScale: scale,
          panStart: { x: t.clientX, y: t.clientY },
          tapCandidate: true,
          moved: false,
        };
      } else if (e.touches.length >= 2) {
        const c = getCenter(e.touches[0], e.touches[1]);
        const d = getDistance(e.touches[0], e.touches[1]);
        touchStateRef.current = {
          mode: 'pinch',
          startOffset: { ...offset },
          startScale: scale,
          startCenter: c,
          startDistance: d,
          tapCandidate: false,
          moved: true,
        };
      }
      e.preventDefault();
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!touchStateRef.current || !boardRef.current) return;
      const st = touchStateRef.current;
      if (st.mode === 'pan' && e.touches.length === 1 && st.panStart) {
        const t = e.touches[0];
        const dx = t.clientX - st.panStart.x;
        const dy = t.clientY - st.panStart.y;
        if (Math.abs(dx) > 6 || Math.abs(dy) > 6) {
          st.moved = true;
          st.tapCandidate = false;
        }
        setOffset({ x: st.startOffset.x + dx, y: st.startOffset.y + dy });
        e.preventDefault();
        return;
      }
      if (st.mode === 'pinch' && e.touches.length >= 2 && st.startCenter && st.startDistance) {
        const c = getCenter(e.touches[0], e.touches[1]);
        const d = getDistance(e.touches[0], e.touches[1]);
        const nextScale = clamp(Number((st.startScale * (d / st.startDistance)).toFixed(3)), 0.3, 3);
        const rect = boardRef.current.getBoundingClientRect();
        // World point at start center before zoom
        const worldX = (st.startCenter.x - rect.left - st.startOffset.x) / st.startScale;
        const worldY = (st.startCenter.y - rect.top - st.startOffset.y) / st.startScale;
        // Keep same world point under current center
        const nextOffsetX = c.x - rect.left - worldX * nextScale;
        const nextOffsetY = c.y - rect.top - worldY * nextScale;
        setScale(nextScale);
        setOffset({ x: nextOffsetX, y: nextOffsetY });
        e.preventDefault();
        return;
      }
    };

    const handleTouchEnd = () => {
      const st = touchStateRef.current;
      if (st?.mode === 'pan' && st.tapCandidate && !st.moved) {
        setSelectedNodeIds([]);
        setSelectedEdgeId(null);
        setEdgeEditorId(null);
        setLinkingFromNodeId(null);
      }
      touchStateRef.current = null;
    };

    el.addEventListener('touchstart', handleTouchStart, { passive: false });
    el.addEventListener('touchmove', handleTouchMove, { passive: false });
    el.addEventListener('touchend', handleTouchEnd, { passive: true });
    el.addEventListener('touchcancel', handleTouchEnd, { passive: true });

    return () => {
      el.removeEventListener('touchstart', handleTouchStart as any);
      el.removeEventListener('touchmove', handleTouchMove as any);
      el.removeEventListener('touchend', handleTouchEnd as any);
      el.removeEventListener('touchcancel', handleTouchEnd as any);
    };
  }, [offset, scale]);

  useEffect(() => {
    if (!dragNode) return;
    const onMove = (e: MouseEvent) => {
      if (!activeGraph || !boardRef.current) return;
      const world = toWorldPoint(e.clientX, e.clientY);
      const widthWorld = boardRef.current.clientWidth / scale;
      const heightWorld = boardRef.current.clientHeight / scale;
      const x = clamp(world.x - dragNode.dx, NODE_RADIUS, widthWorld - NODE_RADIUS);
      const y = clamp(world.y - dragNode.dy, NODE_RADIUS, heightWorld - NODE_RADIUS);
      const nextNodes = activeGraph.nodes.map((n) =>
        n.id === dragNode.id ? { ...n, x, y } : n
      );
      persistGraph({ ...activeGraph, nodes: nextNodes }, false);
    };
    const onUp = () => {
      if (activeGraph) {
        persistGraph(activeGraph, true);
      }
      setDragNode(null);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [dragNode, activeGraph, persistGraph, scale, toWorldPoint]);

  useEffect(() => {
    if (!isPanning || !panStart) return;
    const onMove = (e: MouseEvent) => {
      setOffset({
        x: panStart.ox + (e.clientX - panStart.x),
        y: panStart.oy + (e.clientY - panStart.y),
      });
    };
    const onUp = () => {
      setIsPanning(false);
      setPanStart(null);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [isPanning, panStart]);

  useEffect(() => {
    if (!marquee || !activeGraph) return;
    const onUp = () => {
      const minX = Math.min(marquee.x0, marquee.x1);
      const maxX = Math.max(marquee.x0, marquee.x1);
      const minY = Math.min(marquee.y0, marquee.y1);
      const maxY = Math.max(marquee.y0, marquee.y1);
      const ids = activeGraph.nodes
        .filter((n) => n.x >= minX && n.x <= maxX && n.y >= minY && n.y <= maxY)
        .map((n) => n.id);
      setSelectedNodeIds(ids);
      setSelectedEdgeId(null);
      setMarquee(null);
    };
    window.addEventListener('mouseup', onUp, { once: true });
    return () => window.removeEventListener('mouseup', onUp);
  }, [marquee, activeGraph]);

  const findEntity = (node: RelationGraphNode | undefined) => {
    if (!node) return null;
    return entities.find((entity) => entity.id === node.entityId) || null;
  };

  const addNodeBySelect = () => {
    if (!activeGraph || !entityIdToAdd || !boardRef.current) return;
    const entity = filteredEntities.find((e) => e.id === entityIdToAdd);
    if (!entity) return;
    const widthWorld = boardRef.current.clientWidth / scale;
    const heightWorld = boardRef.current.clientHeight / scale;
    const node = relationGraphService.makeNode(
      entity.id,
      entity.type,
      entity.name,
      widthWorld / 2 + Math.random() * 24 - 12,
      heightWorld / 2 + Math.random() * 24 - 12
    );
    persistGraph({ ...activeGraph, nodes: [...activeGraph.nodes, node] });
  };

  const createCharacterAndAddNode = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = newCharacterName.trim();
    if (!name || !activeGraph || !boardRef.current) return;

    const character = dataService.createEntity<Character>({
      name,
      details: '',
      relatedImages: [],
      identity: '',
      appearance: '',
      desireOrGoal: '',
      attributes: '',
      relations: [],
    });
    const widthWorld = boardRef.current.clientWidth / scale;
    const heightWorld = boardRef.current.clientHeight / scale;
    const node = relationGraphService.makeNode(
      character.id,
      'characters',
      character.name,
      widthWorld / 2 + Math.random() * 24 - 12,
      heightWorld / 2 + Math.random() * 24 - 12
    );
    const nextGraph = { ...activeGraph, nodes: [...activeGraph.nodes, node] };

    setCampaignData((previous) => relationGraphService.update({
      ...previous,
      characters: [...previous.characters, character],
    }, nextGraph));
    setEntityTypeFilter('characters');
    setEntityIdToAdd(character.id);
    setSelectedNodeIds([node.id]);
    setSelectedEdgeId(null);
    setNewCharacterName('');
  };

  const removeSelectedNodes = () => {
    if (!activeGraph || selectedNodeIds.length === 0) return;
    const nextNodes = activeGraph.nodes.filter((n) => !selectedNodeIds.includes(n.id));
    const nextEdges = activeGraph.edges.filter((e) => !selectedNodeIds.includes(e.fromNodeId) && !selectedNodeIds.includes(e.toNodeId));
    persistGraph({ ...activeGraph, nodes: nextNodes, edges: nextEdges });
    setSelectedNodeIds([]);
  };

  const removeEdge = (edgeId: string) => {
    if (!activeGraph) return;
    persistGraph({ ...activeGraph, edges: activeGraph.edges.filter((e) => e.id !== edgeId) });
    if (selectedEdgeId === edgeId) setSelectedEdgeId(null);
    if (edgeEditorId === edgeId) setEdgeEditorId(null);
  };

  const handleNodeClick = (node: RelationGraphNode, evt: React.MouseEvent) => {
    if (linkingFromNodeId && linkingFromNodeId !== node.id && activeGraph) {
      const edge = relationGraphService.makeEdge(linkingFromNodeId, node.id);
      persistGraph({ ...activeGraph, edges: [...activeGraph.edges, edge] });
      setLinkingFromNodeId(null);
      return;
    }
    if (linkingFromNodeId === node.id) {
      setLinkingFromNodeId(null);
      return;
    }
    setSelectedEdgeId(null);
    if (evt.ctrlKey || evt.metaKey) {
      setSelectedNodeIds((prev) => (prev.includes(node.id) ? prev.filter((id) => id !== node.id) : [...prev, node.id]));
      return;
    }
    setSelectedNodeIds((prev) => {
      if (prev.length === 1 && prev[0] === node.id) return [];
      return [node.id];
    });
  };

  const handleNodeDoubleClick = (node: RelationGraphNode) => {
    const entity = findEntity(node);
    if (!entity) return;
    const type = node.entityType;
    openInTab(type, entity.openEntityId, entity.name || '未命名');
  };

  const selectedPrimaryNode = activeGraph?.nodes.find((n) => n.id === selectedNodeIds[0]);
  const selectedEdge = activeGraph?.edges.find((e) => e.id === edgeEditorId);
  const selectedResourceRef = selectedPrimaryNode?.tokenImageRef || '';
  const selectedResourceMeta = resources.find((r) => r.ref === selectedResourceRef) || null;

  const updateNode = (nodeId: string, patch: Partial<RelationGraphNode>) => {
    if (!activeGraph) return;
    persistGraph({
      ...activeGraph,
      nodes: activeGraph.nodes.map((n) => (n.id === nodeId ? { ...n, ...patch } : n)),
    });
  };

  const updateEdge = (edgeId: string, patch: Partial<RelationGraphEdge>) => {
    if (!activeGraph) return;
    persistGraph({
      ...activeGraph,
      edges: activeGraph.edges.map((e) => (e.id === edgeId ? { ...e, ...patch } : e)),
    });
  };

  const uploadTokenImage = async (nodeId: string, file?: File) => {
    if (!file) return;
    try {
      const data = await resourceService.upload(file);
      updateNode(nodeId, { tokenImageRef: data.ref || '' });
      await loadResources();
    } catch {
      alert('上传失败，请检查后端连接。');
    }
  };

  const autoLayout = () => {
    if (!activeGraph || !boardRef.current) return;
    const n = activeGraph.nodes.length;
    if (n === 0) return;
    const widthWorld = boardRef.current.clientWidth / scale;
    const heightWorld = boardRef.current.clientHeight / scale;
    const cx = widthWorld / 2;
    const cy = heightWorld / 2;
    const radius = Math.max(120, Math.min(widthWorld, heightWorld) * 0.32);
    const nextNodes = activeGraph.nodes.map((node, idx) => {
      const angle = (Math.PI * 2 * idx) / n;
      return {
        ...node,
        x: cx + Math.cos(angle) * radius,
        y: cy + Math.sin(angle) * radius,
      };
    });
    persistGraph({ ...activeGraph, nodes: nextNodes });
  };

  const handleDeleteGraph = () => {
    deleteGraph();
    setSelectedNodeIds([]);
    setSelectedEdgeId(null);
    setEdgeEditorId(null);
    setLinkingFromNodeId(null);
  };

  if (!canManageCampaignContent) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="max-w-xl text-center py-12 px-6 theme-text-secondary bg-theme-card rounded-lg border border-dashed border-theme">
          关系图仅对 GM / 副GM 开放，PL 请通过分享内容查看可见实体。
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[60vh] md:h-[calc(100vh-3.75rem)] md:-mt-6 flex flex-col gap-2 overflow-hidden px-2 md:px-0">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 shrink-0">
        <h2 className="text-xl md:text-2xl font-bold">关系图</h2>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={activeGraphId || ''}
            onChange={(e) => {
              selectGraph(e.target.value);
            }}
            className="px-3 py-2 rounded border border-theme bg-theme-card"
          >
            {graphs.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
          <button onClick={renameGraph} className="px-3 py-2 rounded border border-theme bg-theme-card hover:bg-primary-light">改名</button>
          <button onClick={createGraph} className="px-3 py-2 rounded border border-theme bg-theme-card hover:bg-primary-light">新建关系图</button>
          <button onClick={handleDeleteGraph} className="px-3 py-2 rounded border border-red-300 text-red-600 hover:bg-red-50">删除当前</button>
        </div>
      </div>

      <div className="p-3 rounded-lg border border-theme theme-card shrink-0">
        <div className="text-sm font-medium mb-2">节点添加（仅人物/怪物）</div>
        <form onSubmit={createCharacterAndAddNode} className="flex flex-col sm:flex-row gap-2 mb-2">
          <input
            type="text"
            value={newCharacterName}
            onChange={(event) => setNewCharacterName(event.target.value)}
            placeholder="输入新人物名字"
            aria-label="新人物名字"
            className="min-w-0 flex-1 px-3 py-2 rounded border border-theme bg-theme-card"
          />
          <button
            type="submit"
            disabled={!newCharacterName.trim() || !activeGraph}
            className="px-3 py-2 rounded bg-primary text-white hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed"
          >
            新建人物并加入
          </button>
        </form>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
          <select
            value={entityTypeFilter}
            onChange={(e) => setEntityTypeFilter(e.target.value as 'characters' | 'monsters')}
            className="px-3 py-2 rounded border border-theme bg-theme-card"
          >
            <option value="characters">人物</option>
            <option value="monsters">怪物</option>
          </select>
          <select
            value={entityIdToAdd}
            onChange={(e) => setEntityIdToAdd(e.target.value)}
            className="md:col-span-2 px-3 py-2 rounded border border-theme bg-theme-card"
          >
            {filteredEntities.map((entity) => (
              <option key={entity.id} value={entity.id}>
                {entity.name}
              </option>
            ))}
          </select>
          <button
            onClick={addNodeBySelect}
            className="px-3 py-2 rounded border border-theme bg-theme-card hover:bg-primary-light"
          >
            添加到画布
          </button>
        </div>
      </div>

      <div className="p-3 rounded-lg border border-theme theme-card flex-1 min-h-0 flex flex-col">
        <div className="flex flex-wrap items-center gap-2 mb-3 shrink-0">
          <button
            onClick={() => setLinkingFromNodeId(selectedNodeIds[0] || null)}
            disabled={selectedNodeIds.length !== 1}
            className="px-3 py-1.5 rounded border border-theme text-sm disabled:opacity-50 hover:bg-primary-light"
          >
            {linkingFromNodeId ? '取消连线' : '从选中节点开始连线'}
          </button>
          <button onClick={removeSelectedNodes} disabled={selectedNodeIds.length === 0} className="px-3 py-1.5 rounded border border-red-300 text-red-600 text-sm disabled:opacity-50 hover:bg-red-50">删除选中节点</button>
          {selectedEdgeId && (
            <button onClick={() => removeEdge(selectedEdgeId)} className="px-3 py-1.5 rounded border border-red-300 text-red-600 text-sm hover:bg-red-50">删除选中关系</button>
          )}
          <button onClick={undo} disabled={historyPast.length === 0} className="px-3 py-1.5 rounded border border-theme text-sm disabled:opacity-50 hover:bg-primary-light">撤销</button>
          <button onClick={redo} disabled={historyFuture.length === 0} className="px-3 py-1.5 rounded border border-theme text-sm disabled:opacity-50 hover:bg-primary-light">重做</button>
          <button onClick={autoLayout} className="px-3 py-1.5 rounded border border-theme text-sm hover:bg-primary-light">自动布局</button>
          <button onClick={() => setBoxSelectMode((v) => !v)} className={`px-3 py-1.5 rounded border text-sm ${boxSelectMode ? 'border-primary text-primary bg-primary/10' : 'border-theme hover:bg-primary-light'}`}>框选模式</button>
          <button onClick={() => setScale((s) => clamp(Number((s * 1.1).toFixed(2)), 0.3, 3))} className="px-3 py-1.5 rounded border border-theme text-sm hover:bg-primary-light">放大</button>
          <button onClick={() => setScale((s) => clamp(Number((s / 1.1).toFixed(2)), 0.3, 3))} className="px-3 py-1.5 rounded border border-theme text-sm hover:bg-primary-light">缩小</button>
          <button onClick={() => { setScale(1); setOffset({ x: 0, y: 0 }); }} className="px-3 py-1.5 rounded border border-theme text-sm hover:bg-primary-light">重置视图</button>
          <button onClick={loadResources} className="px-3 py-1.5 rounded border border-theme text-sm hover:bg-primary-light">刷新资源</button>
          <span className="text-xs theme-text-secondary">比例 {Math.round(scale * 100)}%</span>
        </div>

        <div
          data-tour="relation-graph-board"
          ref={boardRef}
          className="relative border border-dashed border-theme rounded bg-theme-card flex-1 min-h-[50vh] md:min-h-0 overflow-hidden"
          onWheel={(e) => {
            e.preventDefault();
            const next = clamp(Number((scale * (e.deltaY < 0 ? 1.08 : 0.92)).toFixed(2)), 0.3, 3);
            setScale(next);
          }}
          onMouseDown={(e) => {
            if (!boardRef.current) return;
            const world = toWorldPoint(e.clientX, e.clientY);
            if (boxSelectMode) {
              setMarquee({ x0: world.x, y0: world.y, x1: world.x, y1: world.y });
              return;
            }
            if (e.button === 1 || e.button === 2) {
              setIsPanning(true);
              setPanStart({ x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y });
              return;
            }
            setSelectedNodeIds([]);
            setSelectedEdgeId(null);
          }}
          style={{ touchAction: 'none' }}
          onMouseMove={(e) => {
            if (!marquee) return;
            const world = toWorldPoint(e.clientX, e.clientY);
            setMarquee((prev) => (prev ? { ...prev, x1: world.x, y1: world.y } : prev));
          }}
          onContextMenu={(e) => e.preventDefault()}
        >
          <div className="absolute inset-0" style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`, transformOrigin: '0 0' }}>
            <svg className="absolute inset-0 w-full h-full">
              <defs>
                <marker id="arrow-end" markerWidth="5" markerHeight="5" refX="4.2" refY="2.5" orient="auto">
                  <path d="M0,0 L5,2.5 L0,5 Z" fill="#64748b" />
                </marker>
                <marker id="arrow-start" markerWidth="5" markerHeight="5" refX="0.8" refY="2.5" orient="auto-start-reverse">
                  <path d="M0,0 L5,2.5 L0,5 Z" fill="#64748b" />
                </marker>
              </defs>
              {(activeGraph?.edges || []).map((edge) => {
                const from = activeGraph?.nodes.find((n) => n.id === edge.fromNodeId);
                const to = activeGraph?.nodes.find((n) => n.id === edge.toNodeId);
                if (!from || !to) return null;
                const geometry = buildEdgeGeometry(from, to, edgeCurveSlots[edge.id] || 0);
                const selected = selectedEdgeId === edge.id;
                const markerStart = edge.direction === 'backward' || edge.direction === 'bidirectional' ? 'url(#arrow-start)' : undefined;
                const markerEnd = edge.direction === 'forward' || edge.direction === 'bidirectional' ? 'url(#arrow-end)' : undefined;
                const metrics = edgeLabelMetrics(edge);
                return (
                  <g key={edge.id}>
                    <path
                      d={geometry.path}
                      stroke={selected ? '#7c3aed' : '#94a3b8'}
                      strokeWidth={selected ? edge.lineWidth + 0.8 : edge.lineWidth}
                      markerStart={markerStart}
                      markerEnd={markerEnd}
                      strokeDasharray={edge.lineStyle === 'dashed' ? '7 5' : undefined}
                      fill="none"
                    />
                    <path
                      d={geometry.path}
                      stroke="transparent"
                      strokeWidth={Math.max(14, edge.lineWidth + 10)}
                      onClick={() => {
                        setSelectedEdgeId(edge.id);
                        setSelectedNodeIds([]);
                      }}
                      onDoubleClick={() => {
                        setSelectedEdgeId(edge.id);
                        setEdgeEditorId(edge.id);
                      }}
                      style={{ cursor: 'pointer' }}
                      fill="none"
                    />
                    {edge.label && (
                      <>
                        <rect
                          x={geometry.labelX - metrics.width / 2}
                          y={geometry.labelY - metrics.height / 2}
                          width={metrics.width}
                          height={metrics.height}
                          rx={4}
                          fill={edge.labelBgColor}
                          fillOpacity={edge.labelBgOpacity}
                        />
                        <text x={geometry.labelX} y={geometry.labelY + edge.labelFontSize * 0.35} textAnchor="middle" style={{ fontSize: `${edge.labelFontSize}px`, fill: edge.labelColor, userSelect: 'none' }}>
                          {edge.label}
                        </text>
                      </>
                    )}
                  </g>
                );
              })}
            </svg>

            {(activeGraph?.nodes || []).map((node) => {
              const selected = selectedNodeIds.includes(node.id);
              const imageRef = node.tokenImageRef || node.tokenImage || '';
              const bgImage = resolveTokenImage(imageRef);
              return (
                <div
                  key={node.id}
                  data-graph-node="true"
                  className={`absolute -translate-x-1/2 -translate-y-1/2 w-[60px] h-[60px] rounded-full border-2 flex items-center justify-center cursor-move shadow ${selected ? 'border-primary ring-4 ring-primary/20' : 'border-theme'}`}
                  style={{ left: node.x, top: node.y, background: bgImage ? `url(${bgImage}) center/cover no-repeat` : 'var(--bg-card)' }}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    const world = toWorldPoint(e.clientX, e.clientY);
                    setDragNode({ id: node.id, dx: world.x - node.x, dy: world.y - node.y });
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleNodeClick(node, e);
                  }}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    handleNodeDoubleClick(node);
                  }}
                  title={node.label}
                >
                  {!bgImage && <span className="text-lg font-bold">{tokenText(node.label)}</span>}
                </div>
              );
            })}

            {(activeGraph?.nodes || []).map((node) => (
              <div key={`${node.id}_label`} className="absolute -translate-x-1/2 text-xs font-medium px-2 py-0.5 rounded bg-white/90 text-slate-900 border border-theme pointer-events-none" style={{ left: node.x, top: node.y + 40 }}>
                {node.label}
              </div>
            ))}

            {marquee && (
              <div
                className="absolute border border-primary bg-primary/10 pointer-events-none"
                style={{
                  left: Math.min(marquee.x0, marquee.x1),
                  top: Math.min(marquee.y0, marquee.y1),
                  width: Math.abs(marquee.x1 - marquee.x0),
                  height: Math.abs(marquee.y1 - marquee.y0),
                }}
              />
            )}
          </div>
        </div>
      </div>

      <RelationGraphNodePanel
        node={selectedPrimaryNode || null}
        selectedResourceMeta={selectedResourceMeta}
        onChangeNote={(nodeId, note) => updateNode(nodeId, { note })}
        onUploadImage={uploadTokenImage}
        onOpenResourcePicker={() => {
          setResourceKeyword('');
          setResourceSelectedFolderPath(RESOURCE_ROOT_PATH);
          setResourcePickerOpen(true);
        }}
        onClearImage={(nodeId) => updateNode(nodeId, { tokenImageRef: '', tokenImage: '' })}
      />

      <RelationGraphResourcePickerModal
        open={resourcePickerOpen && Boolean(selectedPrimaryNode)}
        resources={resources}
        resourceFolders={resourceFolders}
        keyword={resourceKeyword}
        selectedFolderPath={resourceSelectedFolderPath}
        expandedFolders={resourceExpandedFolders}
        selectedRef={selectedPrimaryNode?.tokenImageRef}
        onKeywordChange={setResourceKeyword}
        onSelectFolder={setResourceSelectedFolderPath}
        onToggleFolder={(path) => setResourceExpandedFolders((prev) => (
          prev.includes(path) ? prev.filter((item) => item !== path) : [...prev, path]
        ))}
        onClose={() => setResourcePickerOpen(false)}
        onSelectResource={(ref) => {
          if (!selectedPrimaryNode) return;
          updateNode(selectedPrimaryNode.id, { tokenImageRef: ref });
          setResourcePickerOpen(false);
        }}
      />

      <RelationGraphEdgePanel
        edge={selectedEdge || null}
        onChange={updateEdge}
        onClose={() => setEdgeEditorId(null)}
      />
    </div>
  );
};

export default RelationGraphs;
