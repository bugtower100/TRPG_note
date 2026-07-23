import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BrainCircuit,
  Focus,
  Keyboard,
  Network,
  Pencil,
  Plus,
  Redo2,
  Trash2,
  Undo2,
} from 'lucide-react';
import ConfirmDialog from '../components/common/ConfirmDialog';
import { buildRichKeywordData } from '../components/common/richTextReference';
import type { TooltipTargetPayload } from '../components/common/richTextReference';
import {
  useCampaignData,
  useCampaignSession,
  useCampaignTabs,
} from '../context/CampaignContext';
import MindMapCanvas from '../features/mind-maps/components/MindMapCanvas';
import MindMapEdgeDetailsPanel from '../features/mind-maps/components/MindMapEdgeDetailsPanel';
import MindMapNodeDetailsPanel from '../features/mind-maps/components/MindMapNodeDetailsPanel';
import { useMindMapHistory } from '../features/mind-maps/hooks/useMindMapHistory';
import {
  findMindMapNavigationTarget,
  type MindMapNavigationKey,
} from '../features/mind-maps/utils/mindMapKeyboardNavigation';
import {
  buildMindMapEntityOptions,
  type MindMapEntityOption,
} from '../features/mind-maps/utils/mindMapReferences';
import { calculateAutomaticMindMapPositions } from '../features/mind-maps/utils/layoutMindMap';
import { useCampaignMemberRole } from '../hooks/useCampaignMemberRole';
import { mindMapService } from '../services/mindMapService';
import type { MindMapSiblingDirection } from '../services/mindMapService';
import type {
  MindMapDocument,
  MindMapEntityReference,
  MindMapLayoutDirection,
} from '../types';

const isInteractiveKeyboardTarget = (target: EventTarget | null) => (
  target instanceof Element
  && Boolean(target.closest(
    'input, textarea, select, button, a, [contenteditable="true"], [role="textbox"], [role="dialog"]'
  ))
);

const MindMapWorkspace = () => {
  const { campaignData, setCampaignData } = useCampaignData();
  const { currentCampaignId, user } = useCampaignSession();
  const { openInTab } = useCampaignTabs();
  const [activeMindMapId, setActiveMindMapId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeNodeId, setSelectedEdgeNodeId] = useState<string | null>(null);
  const [deletingNodeId, setDeletingNodeId] = useState<string | null>(null);
  const [pendingLayoutDirection, setPendingLayoutDirection] =
    useState<MindMapLayoutDirection | null>(null);
  const [fitRequest, setFitRequest] = useState(0);
  const keywordSource = useMemo(
    () => ({
      characters: campaignData.characters,
      clues: campaignData.clues,
      events: campaignData.events,
      locations: campaignData.locations,
      monsters: campaignData.monsters,
      organizations: campaignData.organizations,
      timelines: campaignData.timelines,
    }),
    [
      campaignData.characters,
      campaignData.clues,
      campaignData.events,
      campaignData.locations,
      campaignData.monsters,
      campaignData.organizations,
      campaignData.timelines,
    ]
  );
  const mindMaps = useMemo(
    () => mindMapService.list(campaignData),
    [campaignData]
  );
  const keywordData = useMemo(
    () => buildRichKeywordData(keywordSource),
    [keywordSource]
  );
  const entityOptions = useMemo(
    () => buildMindMapEntityOptions(keywordSource),
    [keywordSource]
  );
  const entityOptionsByKey = useMemo(
    () => new Map<string, MindMapEntityOption>(
      entityOptions.map((option) => [option.key, option])
    ),
    [entityOptions]
  );
  const activeMindMap = useMemo(
    () => mindMaps.find((mindMap) => mindMap.id === activeMindMapId) || null,
    [activeMindMapId, mindMaps]
  );
  const selectedNode = useMemo(
    () => activeMindMap?.nodes.find((node) => node.id === selectedNodeId) || null,
    [activeMindMap, selectedNodeId]
  );
  const selectedEdgeNode = useMemo(
    () => activeMindMap?.nodes.find(
      (node) => node.id === selectedEdgeNodeId && Boolean(node.parentId)
    ) || null,
    [activeMindMap, selectedEdgeNodeId]
  );
  const selectedEdgeParent = useMemo(
    () => activeMindMap?.nodes.find(
      (node) => node.id === selectedEdgeNode?.parentId
    ) || null,
    [activeMindMap, selectedEdgeNode]
  );
  const selectedBranchNodeCount = useMemo(
    () => (
      activeMindMap && selectedNode
        ? mindMapService.branchNodeIds(activeMindMap, selectedNode.id).size
        : 0
    ),
    [activeMindMap, selectedNode]
  );
  const selectedDirectChildCount = useMemo(
    () => (
      activeMindMap && selectedNode
        ? activeMindMap.nodes.filter((node) => node.parentId === selectedNode.id).length
        : 0
    ),
    [activeMindMap, selectedNode]
  );
  const deletingNode = useMemo(
    () => activeMindMap?.nodes.find((node) => node.id === deletingNodeId) || null,
    [activeMindMap, deletingNodeId]
  );
  const deletingBranchNodeCount = useMemo(
    () => (
      activeMindMap && deletingNode
        ? mindMapService.branchNodeIds(activeMindMap, deletingNode.id).size
        : 0
    ),
    [activeMindMap, deletingNode]
  );

  useEffect(() => {
    if (mindMaps.length === 0) {
      setActiveMindMapId(null);
      return;
    }
    if (!activeMindMapId || !mindMaps.some((mindMap) => mindMap.id === activeMindMapId)) {
      setActiveMindMapId(mindMaps[0].id);
    }
  }, [activeMindMapId, mindMaps]);

  useEffect(() => {
    if (selectedNodeId && !selectedNode) {
      setSelectedNodeId(null);
    }
  }, [selectedNode, selectedNodeId]);

  useEffect(() => {
    if (selectedEdgeNodeId && (!selectedEdgeNode || !selectedEdgeParent)) {
      setSelectedEdgeNodeId(null);
    }
  }, [selectedEdgeNode, selectedEdgeNodeId, selectedEdgeParent]);

  const persistMindMap = useCallback((nextMindMap: MindMapDocument) => {
    setCampaignData((current) => mindMapService.update(current, nextMindMap));
  }, [setCampaignData]);
  const {
    canUndo,
    canRedo,
    syncStatus: historySyncStatus,
    commitMindMap,
    undo,
    redo,
    discardHistory,
  } = useMindMapHistory({
    activeMindMap,
    campaignId: currentCampaignId,
    user,
    persistMindMap,
  });

  const selectMindMap = useCallback((mindMapId: string | null) => {
    setActiveMindMapId(mindMapId);
    setSelectedNodeId(null);
    setSelectedEdgeNodeId(null);
    setDeletingNodeId(null);
  }, []);

  const createMindMap = useCallback(() => {
    const name = window.prompt('请输入思维导图名称', '新思维导图');
    if (name === null) return;
    const created = mindMapService.create(name);
    setCampaignData((current) => ({
      ...current,
      mindMaps: [...mindMapService.list(current), created],
    }));
    selectMindMap(created.id);
  }, [selectMindMap, setCampaignData]);

  const renameMindMap = useCallback(() => {
    if (!activeMindMap) return;
    const name = window.prompt('请输入新的思维导图名称', activeMindMap.name);
    if (name === null) return;
    const normalizedName = name.trim() || '未命名思维导图';
    if (normalizedName === activeMindMap.name) return;
    commitMindMap({
      ...activeMindMap,
      name: normalizedName,
    });
  }, [activeMindMap, commitMindMap]);

  const deleteMindMap = useCallback(() => {
    if (!activeMindMap) return;
    if (!window.confirm(`确定删除思维导图“${activeMindMap.name}”吗？`)) return;
    const currentIndex = mindMaps.findIndex((mindMap) => mindMap.id === activeMindMap.id);
    const remaining = mindMaps.filter((mindMap) => mindMap.id !== activeMindMap.id);
    const nextActive = remaining[Math.min(currentIndex, remaining.length - 1)] || null;
    setCampaignData((current) => mindMapService.remove(current, activeMindMap.id));
    discardHistory(activeMindMap.id);
    selectMindMap(nextActive?.id || null);
  }, [activeMindMap, discardHistory, mindMaps, selectMindMap, setCampaignData]);

  const applyAutomaticLayout = useCallback((layoutDirection: MindMapLayoutDirection) => {
    if (!activeMindMap) return;
    const layoutTarget = { ...activeMindMap, layoutDirection };
    const positions = calculateAutomaticMindMapPositions(layoutTarget);
    const timestamp = Date.now();
    commitMindMap({
      ...layoutTarget,
      nodes: layoutTarget.nodes.map((node) => ({
        ...node,
        position: positions.get(node.id) || node.position,
        updatedAt: timestamp,
      })),
      updatedAt: timestamp,
    });
    setPendingLayoutDirection(null);
    setFitRequest((current) => current + 1);
  }, [activeMindMap, commitMindMap]);

  const requestAutomaticLayout = useCallback((layoutDirection: MindMapLayoutDirection) => {
    if (!activeMindMap) return;
    if (activeMindMap.nodes.some((node) => node.position)) {
      setPendingLayoutDirection(layoutDirection);
      return;
    }
    applyAutomaticLayout(layoutDirection);
  }, [activeMindMap, applyAutomaticLayout]);

  const saveNodePosition = useCallback((
    nodeId: string,
    position: { x: number; y: number }
  ) => {
    if (!activeMindMap) return;
    commitMindMap(mindMapService.setNodePosition(activeMindMap, nodeId, position));
  }, [activeMindMap, commitMindMap]);

  const selectEdge = useCallback((targetNodeId: string) => {
    setSelectedNodeId(null);
    setSelectedEdgeNodeId(targetNodeId);
  }, []);

  const saveEdgeLabel = useCallback((label: string) => {
    if (!activeMindMap || !selectedEdgeNode) return;
    commitMindMap(mindMapService.setIncomingEdgeLabel(
      activeMindMap,
      selectedEdgeNode.id,
      label
    ));
    setSelectedEdgeNodeId(null);
  }, [activeMindMap, commitMindMap, selectedEdgeNode]);

  const createRootNode = useCallback(() => {
    if (!activeMindMap) return;
    const title = window.prompt('请输入中心主题名称', activeMindMap.name || '中心主题');
    if (title === null) return;
    const nextMindMap = mindMapService.createRoot(activeMindMap, title);
    if (!nextMindMap) return;
    commitMindMap(nextMindMap);
    setSelectedNodeId(nextMindMap.rootNodeId);
  }, [activeMindMap, commitMindMap]);

  const addChildNode = useCallback((parentId: string) => {
    if (!activeMindMap) return;
    const title = window.prompt('请输入子节点名称', '新节点');
    if (title === null) return;
    const result = mindMapService.addChild(activeMindMap, parentId, title);
    if (!result) return;
    commitMindMap(result.mindMap);
    setSelectedNodeId(result.node.id);
  }, [activeMindMap, commitMindMap]);

  const addSiblingNode = useCallback((siblingId: string) => {
    if (!activeMindMap) return;
    const title = window.prompt('请输入同级节点名称', '新节点');
    if (title === null) return;
    const result = mindMapService.addSibling(activeMindMap, siblingId, title);
    if (!result) return;
    commitMindMap(result.mindMap);
    setSelectedNodeId(result.node.id);
  }, [activeMindMap, commitMindMap]);

  const saveNode = useCallback((
    nodeId: string,
    title: string,
    content: string,
    entityRefs: MindMapEntityReference[]
  ) => {
    if (!activeMindMap) return;
    commitMindMap(mindMapService.updateNode(
      activeMindMap,
      nodeId,
      { title, content, entityRefs }
    ));
  }, [activeMindMap, commitMindMap]);

  const openKeywordTarget = useCallback((target: TooltipTargetPayload) => {
    openInTab(
      target.entityType,
      target.entityId,
      target.title,
      target.targetSectionTitleLower,
      target.targetSubItemId
    );
  }, [openInTab]);

  const moveSiblingNode = useCallback((
    nodeId: string,
    direction: MindMapSiblingDirection
  ) => {
    if (!activeMindMap) return;
    commitMindMap(mindMapService.moveSibling(activeMindMap, nodeId, direction));
  }, [activeMindMap, commitMindMap]);

  const toggleNodeCollapse = useCallback((nodeId: string) => {
    if (!activeMindMap) return;
    commitMindMap(mindMapService.toggleCollapsed(activeMindMap, nodeId));
  }, [activeMindMap, commitMindMap]);

  const confirmDeleteNode = useCallback(() => {
    if (!activeMindMap || !deletingNode) return;
    const parentId = deletingNode.parentId;
    const nextMindMap = mindMapService.removeBranch(activeMindMap, deletingNode.id);
    setDeletingNodeId(null);
    if (!nextMindMap) return;
    commitMindMap(nextMindMap);
    setSelectedNodeId(parentId);
  }, [activeMindMap, commitMindMap, deletingNode]);

  const undoMindMap = useCallback(() => {
    setDeletingNodeId(null);
    undo();
  }, [undo]);

  const redoMindMap = useCallback(() => {
    setDeletingNodeId(null);
    redo();
  }, [redo]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        !activeMindMap
        || deletingNodeId
        || event.defaultPrevented
        || event.isComposing
        || isInteractiveKeyboardTarget(event.target)
        || document.querySelector('[data-mind-map-editor-active="true"]')
      ) {
        return;
      }

      const key = event.key.toLowerCase();
      const withCommand = event.ctrlKey || event.metaKey;
      if (withCommand && key === 'z') {
        event.preventDefault();
        if (event.shiftKey) {
          redoMindMap();
        } else {
          undoMindMap();
        }
        return;
      }
      if (withCommand && key === 'y') {
        event.preventDefault();
        redoMindMap();
        return;
      }
      if (key === 'escape') {
        if (!selectedNodeId) return;
        event.preventDefault();
        setSelectedNodeId(null);
        return;
      }
      if (!selectedNode) return;

      if (key === 'tab' && !withCommand && !event.altKey) {
        event.preventDefault();
        addChildNode(selectedNode.id);
        return;
      }
      if (key === 'enter' && !withCommand && !event.altKey && !event.shiftKey) {
        if (selectedNode.id === activeMindMap.rootNodeId) return;
        event.preventDefault();
        addSiblingNode(selectedNode.id);
        return;
      }
      if (key === 'delete' && selectedNode.id !== activeMindMap.rootNodeId) {
        event.preventDefault();
        setDeletingNodeId(selectedNode.id);
        return;
      }
      if (withCommand && (key === 'arrowup' || key === 'arrowdown')) {
        event.preventDefault();
        moveSiblingNode(selectedNode.id, key === 'arrowup' ? 'up' : 'down');
        return;
      }
      if (
        !withCommand
        && !event.altKey
        && ['arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)
      ) {
        const targetNodeId = findMindMapNavigationTarget(
          activeMindMap,
          selectedNode.id,
          key as MindMapNavigationKey
        );
        if (!targetNodeId) return;
        event.preventDefault();
        setSelectedNodeId(targetNodeId);
        return;
      }
      if (key === ' ' && !withCommand && !event.altKey) {
        event.preventDefault();
        toggleNodeCollapse(selectedNode.id);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    activeMindMap,
    addChildNode,
    addSiblingNode,
    deletingNodeId,
    moveSiblingNode,
    redoMindMap,
    selectedNode,
    selectedNodeId,
    toggleNodeCollapse,
    undoMindMap,
  ]);

  return (
    <div className="mind-map-workspace flex min-h-[70vh] flex-col gap-3 md:-mt-6 md:h-[calc(100vh-5rem)] md:min-h-0">
      <div className="flex shrink-0 flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold md:text-2xl">
            <BrainCircuit size={26} aria-hidden="true" />
            思维导图
          </h2>
          <p className="mt-1 text-xs theme-text-secondary">
            方向键：节点导航；Tab：子节点；Enter：同级；Delete：删除；Ctrl/Cmd + ↑/↓：排序；Space：折叠；Esc：取消选择
          </p>
        </div>

        <div className="mind-map-document-actions flex flex-wrap items-center gap-2">
          <select
            value={activeMindMapId || ''}
            onChange={(event) => selectMindMap(event.target.value || null)}
            disabled={mindMaps.length === 0}
            aria-label="选择思维导图"
            className="min-w-44 rounded border border-theme bg-theme-card px-3 py-2 text-sm disabled:opacity-50"
          >
            {mindMaps.length === 0 ? <option value="">暂无思维导图</option> : null}
            {mindMaps.map((mindMap) => (
              <option key={mindMap.id} value={mindMap.id}>
                {mindMap.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={createMindMap}
            className="inline-flex items-center gap-1.5 rounded bg-primary px-3 py-2 text-sm text-white hover:bg-primary-dark"
          >
            <Plus size={16} aria-hidden="true" />
            新建
          </button>
          <button
            type="button"
            onClick={renameMindMap}
            disabled={!activeMindMap}
            className="inline-flex items-center gap-1.5 rounded border border-theme bg-theme-card px-3 py-2 text-sm hover:bg-primary-light disabled:opacity-50"
          >
            <Pencil size={16} aria-hidden="true" />
            改名
          </button>
          <button
            type="button"
            onClick={deleteMindMap}
            disabled={!activeMindMap}
            className="inline-flex items-center gap-1.5 rounded border border-red-300 px-3 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            <Trash2 size={16} aria-hidden="true" />
            删除
          </button>
        </div>
      </div>

      {activeMindMap ? (
        <>
          <div className="mind-map-main-toolbar flex shrink-0 flex-wrap items-center gap-2 rounded-lg border border-theme bg-theme-card p-2">
            <span className="px-1 text-xs font-medium theme-text-secondary">自动布局</span>
            <button
              type="button"
              onClick={undoMindMap}
              disabled={!canUndo}
              title="撤销（Ctrl/Cmd + Z）"
              className="inline-flex items-center gap-1.5 rounded border border-theme px-3 py-1.5 text-sm hover:bg-primary-light disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Undo2 size={16} aria-hidden="true" />
              撤销
            </button>
            <button
              type="button"
              onClick={redoMindMap}
              disabled={!canRedo}
              title="重做（Ctrl/Cmd + Shift + Z 或 Ctrl/Cmd + Y）"
              className="inline-flex items-center gap-1.5 rounded border border-theme px-3 py-1.5 text-sm hover:bg-primary-light disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Redo2 size={16} aria-hidden="true" />
              重做
            </button>
            <span
              className={`px-1 text-xs ${
                historySyncStatus === 'error'
                  ? 'text-red-600'
                  : 'theme-text-secondary'
              }`}
              title={
                historySyncStatus === 'error'
                  ? '当前会话仍可撤销，但历史尚未写入后端；下次修改时会自动重试。'
                  : undefined
              }
            >
              {historySyncStatus === 'loading'
                ? '正在加载历史…'
                : historySyncStatus === 'saving'
                  ? '正在同步历史…'
                  : historySyncStatus === 'error'
                    ? '历史未同步'
                    : '历史已同步'}
            </span>
            <button
              type="button"
              onClick={() => requestAutomaticLayout('LR')}
              aria-pressed={activeMindMap.layoutDirection === 'LR'}
              className={`inline-flex items-center gap-1.5 rounded border px-3 py-1.5 text-sm ${
                activeMindMap.layoutDirection === 'LR'
                  ? 'border-primary bg-primary text-white'
                  : 'border-theme hover:bg-primary-light'
              }`}
            >
              <Network size={16} aria-hidden="true" />
              从左到右
            </button>
            <button
              type="button"
              onClick={() => requestAutomaticLayout('TB')}
              aria-pressed={activeMindMap.layoutDirection === 'TB'}
              className={`inline-flex items-center gap-1.5 rounded border px-3 py-1.5 text-sm ${
                activeMindMap.layoutDirection === 'TB'
                  ? 'border-primary bg-primary text-white'
                  : 'border-theme hover:bg-primary-light'
              }`}
            >
              <Network className="rotate-90" size={16} aria-hidden="true" />
              从上到下
            </button>
            <button
              type="button"
              onClick={() => setFitRequest((current) => current + 1)}
              className="mind-map-fit-button ml-auto inline-flex items-center gap-1.5 rounded border border-theme px-3 py-1.5 text-sm hover:bg-primary-light"
            >
              <Focus size={16} aria-hidden="true" />
              适应画布
            </button>
            <span className="px-1 text-xs theme-text-secondary">
              {activeMindMap.nodes.length} 个节点
            </span>
            <span
              className="inline-flex items-center gap-1 px-1 text-xs theme-text-secondary"
              title="方向键：节点导航；Tab：子节点；Enter：同级；Delete：删除；Ctrl/Cmd + ↑/↓：排序；Space：折叠；Esc：取消选择"
            >
              <Keyboard size={14} aria-hidden="true" />
              快捷键
            </span>
          </div>

          <div className="mind-map-canvas-shell relative min-h-[58vh] flex-1 overflow-hidden rounded-xl border border-theme bg-theme-card md:min-h-0">
            {activeMindMap.nodes.length > 0 ? (
              <MindMapCanvas
                mindMap={activeMindMap}
                campaignData={campaignData}
                fitRequest={fitRequest}
                selectedNodeId={selectedNodeId}
                selectedEdgeNodeId={selectedEdgeNodeId}
                keywordData={keywordData}
                entityOptionsByKey={entityOptionsByKey}
                onSelectNode={(nodeId) => {
                  setSelectedEdgeNodeId(null);
                  setSelectedNodeId(nodeId);
                }}
                onSelectEdge={selectEdge}
                onClearSelection={() => {
                  setSelectedNodeId(null);
                  setSelectedEdgeNodeId(null);
                }}
                onAddChild={addChildNode}
                onAddSibling={addSiblingNode}
                onMoveSibling={moveSiblingNode}
                onToggleCollapse={toggleNodeCollapse}
                onRequestDelete={setDeletingNodeId}
                onOpenTarget={openKeywordTarget}
                onNodePositionChange={saveNodePosition}
              />
            ) : (
              <div className="flex h-full min-h-[58vh] items-center justify-center px-6 text-center">
                <div>
                  <p className="text-sm theme-text-secondary">当前思维导图没有中心主题。</p>
                  <button
                    type="button"
                    onClick={createRootNode}
                    className="mt-3 inline-flex items-center gap-2 rounded bg-primary px-4 py-2 text-sm text-white hover:bg-primary-dark"
                  >
                    <Plus size={16} aria-hidden="true" />
                    创建中心节点
                  </button>
                </div>
              </div>
            )}
            {selectedNode ? (
              <MindMapNodeDetailsPanel
                node={selectedNode}
                isRoot={selectedNode.id === activeMindMap.rootNodeId}
                directChildCount={selectedDirectChildCount}
                branchNodeCount={selectedBranchNodeCount}
                keywordData={keywordData}
                entityOptions={entityOptions}
                entityOptionsByKey={entityOptionsByKey}
                onClose={() => setSelectedNodeId(null)}
                onSave={saveNode}
                onAddChild={addChildNode}
                onAddSibling={addSiblingNode}
                onRequestDelete={setDeletingNodeId}
                onOpenTarget={openKeywordTarget}
              />
            ) : null}
            {selectedEdgeNode && selectedEdgeParent ? (
              <MindMapEdgeDetailsPanel
                parentTitle={selectedEdgeParent.title}
                childTitle={selectedEdgeNode.title}
                label={selectedEdgeNode.incomingEdgeLabel}
                onClose={() => setSelectedEdgeNodeId(null)}
                onSave={saveEdgeLabel}
              />
            ) : null}
          </div>
        </>
      ) : (
        <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-theme bg-theme-card px-6">
          <div className="max-w-md text-center">
            <BrainCircuit className="mx-auto mb-3 text-primary" size={42} aria-hidden="true" />
            <h3 className="text-lg font-semibold">创建第一张思维导图</h3>
            <p className="mt-2 text-sm theme-text-secondary">
              新建时会同时生成中心主题节点，之后可在画布上继续扩展分支。
            </p>
            <button
              type="button"
              onClick={createMindMap}
              className="mt-4 inline-flex items-center gap-2 rounded bg-primary px-4 py-2 text-sm text-white hover:bg-primary-dark"
            >
              <Plus size={17} aria-hidden="true" />
              新建思维导图
            </button>
          </div>
        </div>
      )}
      <ConfirmDialog
        open={pendingLayoutDirection !== null}
        title="确认重新自动布局"
        description="自动布局会覆盖当前思维导图中已经手动调整的位置。执行后仍可使用撤销恢复。"
        confirmText="重新布局"
        cancelText="取消"
        onCancel={() => setPendingLayoutDirection(null)}
        onConfirm={() => {
          if (pendingLayoutDirection) {
            applyAutomaticLayout(pendingLayoutDirection);
          }
        }}
      />
      <ConfirmDialog
        open={Boolean(deletingNode)}
        title="确认删除节点分支"
        description={
          deletingNode
            ? `确定删除“${deletingNode.title}”吗？该节点及其后代共 ${deletingBranchNodeCount} 个节点将被删除。`
            : undefined
        }
        confirmText="删除分支"
        cancelText="取消"
        onCancel={() => setDeletingNodeId(null)}
        onConfirm={confirmDeleteNode}
      />
    </div>
  );
};

const MindMaps = () => {
  const { canManageCampaignContent, configQuery } = useCampaignMemberRole();

  if (configQuery.isPending) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-sm theme-text-secondary">
        正在确认思维导图权限...
      </div>
    );
  }

  if (configQuery.isError) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="max-w-xl rounded-lg border border-red-300 bg-theme-card px-6 py-10 text-center">
          <p className="text-sm text-red-600">
            无法确认思维导图权限，请检查网络连接后重试。
          </p>
          <button
            type="button"
            onClick={() => void configQuery.refetch()}
            className="mt-4 rounded bg-primary px-4 py-2 text-sm text-white hover:bg-primary-dark"
          >
            重新检查权限
          </button>
        </div>
      </div>
    );
  }

  if (!canManageCampaignContent) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="max-w-xl rounded-lg border border-dashed border-theme bg-theme-card px-6 py-12 text-center theme-text-secondary">
          思维导图仅对 GM / 副 GM 开放。
        </div>
      </div>
    );
  }

  return <MindMapWorkspace />;
};

export default MindMaps;
