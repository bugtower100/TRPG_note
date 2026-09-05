import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  FolderOpen,
  ImagePlus,
  MapPinPlus,
  MapPlus,
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCw,
  Save,
  Trash2,
  Upload,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import RelationGraphResourcePickerModal from '../../features/relation-graphs/components/RelationGraphResourcePickerModal';
import LocationMapDrawingLayer from '../../features/location-maps/drawing/LocationMapDrawingLayer';
import LocationMapDrawingToolbar from '../../features/location-maps/drawing/LocationMapDrawingToolbar';
import {
  legacyDrawingStorageKey,
  loadLegacyDrawingShapes,
  useMapDrawingWorkspace,
} from '../../features/location-maps/drawing/useMapDrawingWorkspace';
import type { MapDrawingShape } from '../../features/location-maps/drawing/types';
import LocationMapPointPanel from '../../features/location-maps/components/LocationMapPointPanel';
import LocationMapPointViewer from '../../features/location-maps/components/LocationMapPointViewer';
import MapPointIcon from '../../features/location-maps/components/MapPointIcon';
import { useCampaignData, useCampaignSession } from '../../context/CampaignContext';
import { useCampaignMemberRole } from '../../hooks/useCampaignMemberRole';
import { queryKeys } from '../../query/queryKeys';
import { VersionConflictError } from '../../services/conflictError';
import { locationMapService } from '../../services/locationMapService';
import { locationMapDrawingService } from '../../services/locationMapDrawingService';
import {
  buildResourceFileUrl,
  resourceService,
  RESOURCE_ROOT_PATH,
} from '../../services/resourceService';
import type {
  LocationMap,
  LocationMapDocument,
  LocationMapDrawingDocument,
  LocationMapDrawingOperation,
  LocationMapPoint,
} from '../../types';

const EMPTY_MAPS: LocationMap[] = [];

const createLocationMap = (index: number): LocationMap => {
  const now = Date.now();
  return {
    id: uuidv4(),
    name: `新地图 ${index}`,
    imageRef: '',
    points: [],
    createdAt: now,
    updatedAt: now,
  };
};

const LocationMaps: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { campaignData } = useCampaignData();
  const { currentCampaignId, user } = useCampaignSession();
  const { canManageCampaignContent } = useCampaignMemberRole();
  const [activeMapId, setActiveMapId] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState('');
  const [statusText, setStatusText] = useState('');
  const [resourcePickerOpen, setResourcePickerOpen] = useState(false);
  const [resourceKeyword, setResourceKeyword] = useState('');
  const [resourceSelectedFolderPath, setResourceSelectedFolderPath] = useState(RESOURCE_ROOT_PATH);
  const [resourceExpandedFolders, setResourceExpandedFolders] = useState<string[]>([RESOURCE_ROOT_PATH]);
  const [selectedLocationId, setSelectedLocationId] = useState('');
  const [placingPoint, setPlacingPoint] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [drawingEnabled, setDrawingEnabled] = useState(false);
  const [pendingDrawingShapes, setPendingDrawingShapes] = useState<Array<{
    operationId: string;
    shape: MapDrawingShape;
  }>>([]);
  const [failedDrawingOperations, setFailedDrawingOperations] = useState<LocationMapDrawingOperation[]>([]);
  const [drawingRedoShapes, setDrawingRedoShapes] = useState<MapDrawingShape[]>([]);
  const [migratingLegacyDrawing, setMigratingLegacyDrawing] = useState(false);
  const [dragPreview, setDragPreview] = useState<{
    pointId: string;
    x: number;
    y: number;
    startClientX: number;
    startClientY: number;
    moved: boolean;
  } | null>(null);
  const [selectedPointId, setSelectedPointId] = useState<string | null>(null);
  const [pointEditorDirty, setPointEditorDirty] = useState(false);
  const [nameDirty, setNameDirty] = useState(false);
  const [imageLoadError, setImageLoadError] = useState('');
  const [remoteUpdateAvailable, setRemoteUpdateAvailable] = useState(false);
  const [mapListCollapsed, setMapListCollapsed] = useState(false);
  const [conflictDraft, setConflictDraft] = useState<{
    maps: LocationMap[];
    remote: LocationMapDocument;
  } | null>(null);
  const observedVersionRef = useRef<number | null>(null);
  const localSavedVersionRef = useRef<number | null>(null);
  const imageUploadInputRef = useRef<HTMLInputElement | null>(null);
  const attemptedDrawingMigrationsRef = useRef(new Set<string>());

  const mapQueryKey = currentCampaignId
    ? queryKeys.campaigns.locationMaps(currentCampaignId, user?.id)
    : ['campaigns', 'location-maps-disabled'] as const;

  const mapQuery = useQuery({
    queryKey: mapQueryKey,
    queryFn: async () => {
      if (!currentCampaignId || !user) return null;
      return locationMapService.load(currentCampaignId, user);
    },
    enabled: Boolean(currentCampaignId && user),
    refetchInterval: pointEditorDirty || nameDirty || placingPoint || drawingEnabled || Boolean(dragPreview)
      ? false
      : 15_000,
  });

  const resourceQuery = useQuery({
    queryKey: ['resources', 'library'] as const,
    queryFn: () => resourceService.list(),
    enabled: resourcePickerOpen,
    staleTime: 30_000,
  });

  const saveMutation = useMutation({
    mutationFn: async ({ maps, expectedVersion }: { maps: LocationMap[]; expectedVersion?: number }) => {
      if (!currentCampaignId || !user || !mapQuery.data) {
        throw new Error('地图文档尚未加载');
      }
      return locationMapService.save(currentCampaignId, user, {
        maps,
        expectedVersion: expectedVersion ?? mapQuery.data.version,
      });
    },
    onSuccess: (document) => {
      localSavedVersionRef.current = document.version;
      setRemoteUpdateAvailable(false);
      setConflictDraft(null);
      queryClient.setQueryData(mapQueryKey, document);
    },
  });

  const maps = mapQuery.data?.maps ?? EMPTY_MAPS;
  const activeMap = useMemo(
    () => maps.find((item) => item.id === activeMapId) ?? null,
    [activeMapId, maps]
  );
  const selectedPoint = useMemo(
    () => activeMap?.points.find((point) => point.id === selectedPointId) ?? null,
    [activeMap, selectedPointId]
  );
  const drawingQueryKey = useMemo(() => (
    currentCampaignId && activeMapId
      ? queryKeys.campaigns.locationMapDrawing(currentCampaignId, activeMapId, user?.id)
      : ['campaigns', 'location-map-drawing-disabled'] as const
  ), [activeMapId, currentCampaignId, user?.id]);
  const drawingQuery = useQuery({
    queryKey: drawingQueryKey,
    queryFn: async () => {
      if (!currentCampaignId || !activeMap || !user) return null;
      return locationMapDrawingService.load(currentCampaignId, activeMap.id, user);
    },
    enabled: Boolean(currentCampaignId && activeMap?.imageRef && user),
    refetchInterval: 3_000,
  });

  const updateDrawingCache = useCallback((document: LocationMapDrawingDocument) => {
    queryClient.setQueryData<LocationMapDrawingDocument | null>(drawingQueryKey, (current) => (
      !current || document.version >= current.version ? document : current
    ));
  }, [drawingQueryKey, queryClient]);

  const runDrawingOperation = useCallback(async (operation: LocationMapDrawingOperation) => {
    if (!currentCampaignId || !activeMapId || !user) throw new Error('联机画板尚未加载');
    const document = await locationMapDrawingService.applyOperation(
      currentCampaignId, activeMapId, user, operation
    );
    updateDrawingCache(document);
    return document;
  }, [activeMapId, currentCampaignId, updateDrawingCache, user]);

  const submitDrawingOperation = useCallback(async (operation: LocationMapDrawingOperation) => {
    try {
      await runDrawingOperation(operation);
      setFailedDrawingOperations((current) => current.filter(
        (item) => item.operationId !== operation.operationId
      ));
      setPendingDrawingShapes((current) => current.filter(
        (item) => item.operationId !== operation.operationId
      ));
      return true;
    } catch (error) {
      setFailedDrawingOperations((current) => current.some(
        (item) => item.operationId === operation.operationId
      ) ? current : [...current, operation]);
      setStatusText(error instanceof Error ? error.message : '画板同步失败，可以稍后重试');
      return false;
    }
  }, [runDrawingOperation]);

  const handleAddDrawingShape = useCallback((shape: MapDrawingShape) => {
    const operation: LocationMapDrawingOperation = {
      operationId: uuidv4(), type: 'add_shape', shape,
    };
    setPendingDrawingShapes((current) => [...current, { operationId: operation.operationId, shape }]);
    setDrawingRedoShapes([]);
    void submitDrawingOperation(operation);
  }, [submitDrawingOperation]);

  const handleEraseDrawingShape = useCallback((shapeId: string) => {
    const shape = drawingQuery.data?.shapes.find((item) => item.id === shapeId);
    if (!shape) return;
    if (!canManageCampaignContent && shape.authorId !== user?.id) {
      setStatusText('PL 只能擦除自己绘制的图形');
      return;
    }
    void submitDrawingOperation({ operationId: uuidv4(), type: 'delete_shape', shapeId });
  }, [canManageCampaignContent, drawingQuery.data?.shapes, submitDrawingOperation, user?.id]);

  const drawing = useMapDrawingWorkspace({
    onAddShape: handleAddDrawingShape,
    onEraseShape: handleEraseDrawingShape,
  });
  const drawingShapes = useMemo(() => [
    ...(drawingQuery.data?.shapes ?? []),
    ...pendingDrawingShapes
      .filter((pending) => !drawingQuery.data?.shapes.some((shape) => shape.id === pending.shape.id))
      .map((pending) => pending.shape),
  ], [drawingQuery.data?.shapes, pendingDrawingShapes]);
  const ownDrawingShapes = useMemo(() => (
    drawingQuery.data?.shapes.filter((shape) => shape.authorId === user?.id) ?? []
  ), [drawingQuery.data?.shapes, user?.id]);
  const refreshPaused = pointEditorDirty || nameDirty || placingPoint || drawingEnabled || Boolean(dragPreview);

  useEffect(() => {
    if (maps.length === 0) {
      setActiveMapId(null);
      return;
    }
    if (!activeMapId || !maps.some((item) => item.id === activeMapId)) {
      setActiveMapId(maps[0].id);
    }
  }, [activeMapId, maps]);

  useEffect(() => {
    setNameDraft(activeMap?.name ?? '');
    setNameDirty(false);
    setPlacingPoint(false);
    setDrawingEnabled(false);
    setPendingDrawingShapes([]);
    setFailedDrawingOperations([]);
    setDrawingRedoShapes([]);
    setDragPreview(null);
    setSelectedPointId(null);
    setPointEditorDirty(false);
  }, [activeMap?.id, activeMap?.name]);

  useEffect(() => {
    if (drawingQuery.error) {
      setStatusText(drawingQuery.error instanceof Error ? drawingQuery.error.message : '联机画板加载失败');
    }
  }, [drawingQuery.error]);

  useEffect(() => {
    if (!drawingQuery.data || !currentCampaignId || !activeMap || !user) return;
    const storageKey = legacyDrawingStorageKey(currentCampaignId, activeMap.id, user.id);
    if (attemptedDrawingMigrationsRef.current.has(storageKey)) return;
    attemptedDrawingMigrationsRef.current.add(storageKey);

    let legacyShapes: MapDrawingShape[];
    try {
      legacyShapes = loadLegacyDrawingShapes(storageKey);
    } catch {
      setStatusText('检测到损坏的旧版本地画板数据，已保留原数据但无法自动迁移。');
      return;
    }
    const remoteShapeIDs = new Set(drawingQuery.data.shapes.map((shape) => shape.id));
    const shapesToMigrate = legacyShapes.filter((shape) => !remoteShapeIDs.has(shape.id));
    if (shapesToMigrate.length === 0) {
      if (legacyShapes.length > 0) localStorage.removeItem(storageKey);
      return;
    }

    const migrationOperations: LocationMapDrawingOperation[] = shapesToMigrate.map((shape) => ({
      operationId: uuidv4(), type: 'add_shape', shape,
    }));
    setMigratingLegacyDrawing(true);
    void (async () => {
      for (let index = 0; index < migrationOperations.length; index += 1) {
        const operation = migrationOperations[index];
        try {
          await runDrawingOperation(operation);
        } catch (error) {
          const remaining = migrationOperations.slice(index);
          setFailedDrawingOperations((current) => [...current, ...remaining]);
          setStatusText(error instanceof Error
            ? `旧版画板迁移中断：${error.message}`
            : '旧版画板迁移中断，可点击重试继续');
          return;
        }
      }
      localStorage.removeItem(storageKey);
      setStatusText(`已将 ${shapesToMigrate.length} 个本地图形迁移到联机画板`);
    })().finally(() => {
      setMigratingLegacyDrawing(false);
    });
  }, [activeMap, currentCampaignId, drawingQuery.data, runDrawingOperation, user]);

  useEffect(() => {
    setImageLoadError('');
  }, [activeMap?.id, activeMap?.imageRef]);

  useEffect(() => {
    const document = mapQuery.data;
    if (!document) return;
    const previousVersion = observedVersionRef.current;
    observedVersionRef.current = document.version;
    if (
      previousVersion !== null
      && document.version > previousVersion
      && document.version !== localSavedVersionRef.current
      && document.updatedBy !== user?.id
    ) {
      setRemoteUpdateAvailable(true);
    }
  }, [mapQuery.data, user?.id]);

  useEffect(() => {
    if (!selectedLocationId && campaignData.locations.length > 0) {
      setSelectedLocationId(campaignData.locations[0].id);
      return;
    }
    if (selectedLocationId && !campaignData.locations.some((location) => location.id === selectedLocationId)) {
      setSelectedLocationId(campaignData.locations[0]?.id ?? '');
    }
  }, [campaignData.locations, selectedLocationId]);

  const saveMaps = async (
    nextMaps: LocationMap[],
    successText: string,
    expectedVersion?: number
  ) => {
    setStatusText('');
    try {
      await saveMutation.mutateAsync({ maps: nextMaps, expectedVersion });
      setStatusText(successText);
      return true;
    } catch (error) {
      if (error instanceof VersionConflictError && error.remote) {
        const remote = error.remote as LocationMapDocument;
        queryClient.setQueryData(mapQueryKey, remote);
        setConflictDraft({ maps: nextMaps, remote });
        setStatusText('检测到其他客户端已经更新地图，请选择保留远端内容或用当前草稿重试。');
        return false;
      }
      setStatusText(error instanceof Error ? error.message : '地图保存失败');
      return false;
    }
  };

  const handleRetryConflict = async () => {
    if (!conflictDraft) return;
    await saveMaps(
      conflictDraft.maps,
      '冲突已处理，当前草稿已保存',
      conflictDraft.remote.version
    );
  };

  const handleUseRemote = () => {
    if (!conflictDraft) return;
    queryClient.setQueryData(mapQueryKey, conflictDraft.remote);
    setConflictDraft(null);
    setStatusText('已保留其他客户端的最新内容');
  };

  const handleCreateMap = async () => {
    if (!canManageCampaignContent || saveMutation.isPending) return;
    const created = createLocationMap(maps.length + 1);
    if (await saveMaps([...maps, created], '地图已创建')) {
      setActiveMapId(created.id);
    }
  };

  const handleDeleteMap = async () => {
    if (!activeMap || !canManageCampaignContent || saveMutation.isPending) return;
    if (!window.confirm(`确定删除地图“${activeMap.name}”吗？地图图片仍会保留在资源管理器中。`)) {
      return;
    }
    const nextMaps = maps.filter((item) => item.id !== activeMap.id);
    if (await saveMaps(nextMaps, '地图已删除')) {
      setActiveMapId(nextMaps[0]?.id ?? null);
    }
  };

  const handleSaveName = async () => {
    if (!activeMap || !canManageCampaignContent || saveMutation.isPending) return;
    const nextName = nameDraft.trim() || '未命名地图';
    if (nextName === activeMap.name) return;
    const saved = await saveMaps(
      maps.map((item) => item.id === activeMap.id ? { ...item, name: nextName } : item),
      '地图名称已保存'
    );
    if (saved) setNameDirty(false);
  };

  const handleSelectResource = async (imageRef: string) => {
    if (!activeMap || !canManageCampaignContent || saveMutation.isPending) return;
    const saved = await saveMaps(
      maps.map((item) => item.id === activeMap.id ? { ...item, imageRef } : item),
      '地图图片已更新'
    );
    if (saved) setResourcePickerOpen(false);
  };

  const handleUploadMapImage = async (file?: File) => {
    if (!file || !activeMap || !canManageCampaignContent || saveMutation.isPending || uploadingImage) return;
    setUploadingImage(true);
    setStatusText('');
    try {
      const uploaded = await resourceService.upload(file, RESOURCE_ROOT_PATH);
      await queryClient.invalidateQueries({ queryKey: ['resources', 'library'] });
      const saved = await saveMaps(
        maps.map((item) => item.id === activeMap.id ? { ...item, imageRef: uploaded.ref } : item),
        '本地图片已上传到资源管理器，并设置为地图图片'
      );
      if (!saved) {
        setStatusText('图片已上传到资源管理器，但设置为地图图片时保存失败，可稍后从资源管理器重新选择。');
      }
    } catch (error) {
      setStatusText(error instanceof Error ? error.message : '本地图片上传失败');
    } finally {
      setUploadingImage(false);
      if (imageUploadInputRef.current) imageUploadInputRef.current.value = '';
    }
  };

  const updateActiveMapPoints = async (points: LocationMapPoint[], successText: string) => {
    if (!activeMap) return false;
    return saveMaps(
      maps.map((item) => item.id === activeMap.id ? { ...item, points } : item),
      successText
    );
  };

  const handleMapClick = async (event: React.MouseEvent<HTMLDivElement>) => {
    if (!placingPoint || !activeMap || !selectedLocationId || saveMutation.isPending) return;
    const location = campaignData.locations.find((item) => item.id === selectedLocationId);
    if (!location) {
      setStatusText('请选择要关联的地点');
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const point: LocationMapPoint = {
      id: uuidv4(),
      locationId: location.id,
      name: location.name,
      introduction: '',
      iconId: 1,
      x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)),
      visibleToPlayers: false,
      labelColor: '#ffffff',
      labelStrokeColor: '#111827',
    };
    await updateActiveMapPoints([...activeMap.points, point], `已放置地点“${location.name}”`);
  };

  const pointPositionFromPointer = (
    event: React.PointerEvent<HTMLElement>
  ): { x: number; y: number } | null => {
    const overlay = event.currentTarget.parentElement;
    if (!overlay) return null;
    const rect = overlay.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    return {
      x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)),
    };
  };

  const handlePointPointerDown = (
    event: React.PointerEvent<HTMLButtonElement>,
    point: LocationMapPoint
  ) => {
    if (!canManageCampaignContent || placingPoint || saveMutation.isPending) return;
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragPreview({
      pointId: point.id,
      x: point.x,
      y: point.y,
      startClientX: event.clientX,
      startClientY: event.clientY,
      moved: false,
    });
  };

  const handlePointPointerMove = (
    event: React.PointerEvent<HTMLButtonElement>,
    point: LocationMapPoint
  ) => {
    if (dragPreview?.pointId !== point.id) return;
    event.stopPropagation();
    const position = pointPositionFromPointer(event);
    if (position) {
      const moved = dragPreview.moved
        || Math.hypot(
          event.clientX - dragPreview.startClientX,
          event.clientY - dragPreview.startClientY
        ) >= 5;
      setDragPreview({ ...dragPreview, ...position, moved });
    }
  };

  const handlePointPointerUp = async (
    event: React.PointerEvent<HTMLButtonElement>,
    point: LocationMapPoint
  ) => {
    if (dragPreview?.pointId !== point.id || !activeMap) return;
    event.stopPropagation();
    if (!dragPreview.moved) {
      setDragPreview(null);
      return;
    }
    const finalPosition = pointPositionFromPointer(event) ?? dragPreview;
    setDragPreview(null);
    await updateActiveMapPoints(
      activeMap.points.map((item) => (
        item.id === point.id ? { ...item, x: finalPosition.x, y: finalPosition.y } : item
      )),
      `已移动地点“${point.name}”`
    );
  };

  const handlePointEditorDirtyChange = useCallback((dirty: boolean) => {
    setPointEditorDirty(dirty);
  }, []);

  const confirmDiscardPointEdits = () => {
    if (!pointEditorDirty) return true;
    return window.confirm('当前点位有未保存的编辑，确定放弃这些修改吗？');
  };

  const handleSelectMap = (mapId: string) => {
    if (mapId === activeMapId) return;
    if ((pointEditorDirty || nameDirty) && !window.confirm('当前地图有未保存的编辑，确定放弃这些修改吗？')) return;
    setActiveMapId(mapId);
  };

  const handleToggleDrawing = () => {
    if (!drawingEnabled && (pointEditorDirty || nameDirty)) {
      const discard = window.confirm('进入画板会放弃当前未保存的地图或点位编辑，确定继续吗？');
      if (!discard) return;
      setNameDraft(activeMap?.name ?? '');
      setNameDirty(false);
      setSelectedPointId(null);
      setPointEditorDirty(false);
    }
    drawing.cancelShape();
    setPlacingPoint(false);
    setDragPreview(null);
    setSelectedPointId(null);
    setPointEditorDirty(false);
    setDrawingEnabled((current) => !current);
  };

  const handleUndoDrawing = async () => {
    if (pendingDrawingShapes.length > 0) return;
    const shape = ownDrawingShapes[ownDrawingShapes.length - 1];
    if (!shape) return;
    const saved = await submitDrawingOperation({
      operationId: uuidv4(), type: 'delete_shape', shapeId: shape.id,
    });
    if (saved) {
      const { authorId: _authorId, authorName: _authorName, ...redoShape } = shape;
      setDrawingRedoShapes((current) => [...current.slice(-49), redoShape]);
    }
  };

  const handleRedoDrawing = async () => {
    const shape = drawingRedoShapes[drawingRedoShapes.length - 1];
    if (!shape) return;
    const saved = await submitDrawingOperation({
      operationId: uuidv4(), type: 'add_shape', shape,
    });
    if (saved) setDrawingRedoShapes((current) => current.slice(0, -1));
  };

  const handleClearDrawing = async () => {
    const affectedCount = canManageCampaignContent ? drawingShapes.length : ownDrawingShapes.length;
    if (affectedCount === 0) return;
    const description = canManageCampaignContent
      ? '确定清空当前地图上所有成员的联机画板内容吗？此操作不能整体撤回。'
      : '确定清空你在当前地图上绘制的全部内容吗？不会影响其他成员。';
    if (!window.confirm(description)) return;
    const saved = await submitDrawingOperation({
      operationId: uuidv4(),
      type: canManageCampaignContent ? 'clear_all' : 'clear_own',
    });
    if (saved) setDrawingRedoShapes([]);
  };

  const handleRetryDrawingOperations = async () => {
    const operations = [...failedDrawingOperations];
    if (operations.length === 0) return;
    setStatusText(`正在重试 ${operations.length} 个画板操作...`);
    const results = await Promise.all(operations.map((operation) => submitDrawingOperation(operation)));
    if (results.every(Boolean) && currentCampaignId && activeMap && user) {
      localStorage.removeItem(legacyDrawingStorageKey(currentCampaignId, activeMap.id, user.id));
      setStatusText('未同步的画板操作已全部重试成功');
    }
  };

  const handleSelectPoint = (pointId: string) => {
    if (pointId === selectedPointId || !confirmDiscardPointEdits()) return;
    setSelectedPointId(pointId);
  };

  const handleClosePointEditor = () => {
    if (!confirmDiscardPointEdits()) return;
    setSelectedPointId(null);
  };

  const handleSavePoint = async (point: LocationMapPoint) => {
    if (!activeMap) return false;
    return updateActiveMapPoints(
      activeMap.points.map((item) => item.id === point.id ? point : item),
      `点位“${point.name}”已保存`
    );
  };

  const handleDeletePoint = async (point: LocationMapPoint) => {
    if (!activeMap || !window.confirm(`确定删除点位“${point.name}”吗？`)) return;
    const saved = await updateActiveMapPoints(
      activeMap.points.filter((item) => item.id !== point.id),
      `点位“${point.name}”已删除`
    );
    if (saved) setSelectedPointId(null);
  };

  const toggleResourceFolder = (path: string) => {
    setResourceExpandedFolders((current) => (
      current.includes(path)
        ? current.filter((item) => item !== path)
        : [...current, path]
    ));
  };

  if (mapQuery.isLoading) {
    return <div className="py-16 text-center text-sm theme-text-secondary">正在加载地图地点...</div>;
  }

  if (mapQuery.isError) {
    return (
      <div className="max-w-3xl mx-auto py-16 text-center">
        <p className="text-sm text-red-600">
          {mapQuery.error instanceof Error ? mapQuery.error.message : '地图地点加载失败'}
        </p>
        <button
          type="button"
          onClick={() => void mapQuery.refetch()}
          className="mt-4 inline-flex items-center gap-2 px-3 py-2 rounded border border-theme hover:bg-primary-light"
        >
          <RefreshCw size={16} />
          重试
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-4 pb-10">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">地图地点</h1>
          <p className="mt-1 text-sm theme-text-secondary">
            {canManageCampaignContent
              ? '管理地图与背景图片；点位功能将在下一阶段加入。'
              : '查看 GM 向玩家公开的地图。'}
          </p>
        </div>
        {canManageCampaignContent ? (
          <button
            type="button"
            onClick={() => void handleCreateMap()}
            disabled={saveMutation.isPending}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded bg-primary text-white disabled:opacity-50"
          >
            <MapPlus size={18} />
            新建地图
          </button>
        ) : null}
      </header>

      {statusText ? (
        <div className="rounded border border-theme bg-theme-card px-3 py-2 text-sm">{statusText}</div>
      ) : null}
      {refreshPaused ? (
        <div className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          正在本地编辑，联机自动刷新已暂停；保存或退出编辑后会恢复。
        </div>
      ) : null}
      {remoteUpdateAvailable ? (
        <div className="flex flex-col gap-2 rounded border border-blue-300 bg-blue-50 px-3 py-2 text-sm text-blue-800 sm:flex-row sm:items-center sm:justify-between">
          <span>已载入其他客户端保存的最新地图内容。</span>
          <button
            type="button"
            onClick={() => setRemoteUpdateAvailable(false)}
            className="self-start rounded border border-blue-300 px-2 py-1 sm:self-auto"
          >
            知道了
          </button>
        </div>
      ) : null}
      {mapQuery.isRefetchError ? (
        <div className="flex flex-col gap-2 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 sm:flex-row sm:items-center sm:justify-between">
          <span>联机刷新失败，当前仍显示上一次成功加载的内容。</span>
          <button
            type="button"
            onClick={() => void mapQuery.refetch()}
            className="self-start rounded border border-red-300 px-2 py-1 sm:self-auto"
          >
            立即重试
          </button>
        </div>
      ) : null}
      {conflictDraft ? (
        <div className="rounded border border-orange-300 bg-orange-50 p-3 text-sm text-orange-900">
          <div className="font-medium">地图内容存在版本冲突</div>
          <p className="mt-1">远端版本为 {conflictDraft.remote.version}。重试当前草稿会以你的整份地图文档覆盖该远端版本。</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleUseRemote}
              className="rounded border border-orange-300 bg-white px-3 py-1.5"
            >
              保留远端内容
            </button>
            <button
              type="button"
              onClick={() => void handleRetryConflict()}
              disabled={saveMutation.isPending}
              className="rounded bg-orange-600 px-3 py-1.5 text-white disabled:opacity-50"
            >
              用当前草稿重试
            </button>
          </div>
        </div>
      ) : null}

      {maps.length === 0 ? (
        <section className="rounded-lg border border-dashed border-theme bg-theme-card px-6 py-16 text-center">
          <p className="font-medium">{canManageCampaignContent ? '还没有地图' : 'GM 尚未添加地图'}</p>
          {canManageCampaignContent ? (
            <button
              type="button"
              onClick={() => void handleCreateMap()}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded bg-primary text-white"
            >
              <MapPlus size={18} />
              创建第一张地图
            </button>
          ) : null}
        </section>
      ) : (
        <div
          className={`grid min-h-[36rem] grid-cols-1 gap-4 ${
            mapListCollapsed
              ? 'lg:grid-cols-[3.25rem_minmax(0,1fr)]'
              : 'lg:grid-cols-[16rem_minmax(0,1fr)]'
          }`}
        >
          <aside className="relative min-w-0 rounded-lg border border-theme bg-theme-card p-3">
            <div className={`flex items-center ${mapListCollapsed ? 'justify-between lg:justify-center' : 'mb-3 justify-between'}`}>
              <div className={`text-sm font-semibold ${mapListCollapsed ? 'lg:hidden' : ''}`}>地图列表</div>
              <button
                type="button"
                onClick={() => setMapListCollapsed((current) => !current)}
                aria-expanded={!mapListCollapsed}
                aria-label={mapListCollapsed ? '展开地图列表' : '折叠地图列表'}
                title={mapListCollapsed ? '展开地图列表' : '折叠地图列表'}
                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded hover:bg-primary-light"
              >
                {mapListCollapsed
                  ? <PanelLeftOpen size={17} aria-hidden="true" />
                  : <PanelLeftClose size={17} aria-hidden="true" />}
              </button>
            </div>
            {!mapListCollapsed ? (
              <div className="flex gap-2 overflow-x-auto pb-1 lg:block lg:space-y-2 lg:overflow-visible lg:pb-0">
                {maps.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelectMap(item.id)}
                    className={`w-44 shrink-0 rounded-md border p-2 text-left transition lg:w-full ${
                      item.id === activeMapId
                        ? 'border-primary bg-primary-light text-primary'
                        : 'border-theme hover:bg-primary-light/50'
                    }`}
                  >
                    <div className="truncate text-sm font-medium">{item.name}</div>
                    <div className="mt-1 text-xs theme-text-secondary">
                      {item.imageRef ? '已选择地图图片' : '尚未选择图片'}
                    </div>
                  </button>
                ))}
              </div>
            ) : null}
          </aside>

          {activeMap ? (
            <section className="min-w-0 rounded-lg border border-theme bg-theme-card p-4">
              <div className="flex flex-col gap-3 border-b border-theme pb-4 md:flex-row md:items-center">
                {canManageCampaignContent ? (
                  <>
                    <input
                      value={nameDraft}
                      disabled={drawingEnabled}
                      onChange={(event) => {
                        const value = event.target.value;
                        setNameDraft(value);
                        setNameDirty(value.trim() !== activeMap.name);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') void handleSaveName();
                      }}
                      className="min-w-0 flex-1 rounded border border-theme bg-transparent px-3 py-2 font-semibold"
                      aria-label="地图名称"
                    />
                    <button
                      type="button"
                      onClick={() => void handleSaveName()}
                      disabled={drawingEnabled || saveMutation.isPending || nameDraft.trim() === activeMap.name}
                      className="inline-flex items-center justify-center gap-2 rounded border border-theme px-3 py-2 disabled:opacity-50"
                    >
                      <Save size={16} />
                      保存名称
                    </button>
                    <button
                      type="button"
                      onClick={() => imageUploadInputRef.current?.click()}
                      disabled={drawingEnabled || saveMutation.isPending || uploadingImage}
                      className="inline-flex items-center justify-center gap-2 rounded border border-theme px-3 py-2 hover:bg-primary-light disabled:opacity-50"
                    >
                      <Upload size={16} />
                      {uploadingImage ? '上传中...' : '上传本地图片'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setResourcePickerOpen(true)}
                      disabled={drawingEnabled || saveMutation.isPending || uploadingImage}
                      className="inline-flex items-center justify-center gap-2 rounded border border-theme px-3 py-2 hover:bg-primary-light disabled:opacity-50"
                    >
                      <FolderOpen size={16} />
                      从资源管理器选择
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDeleteMap()}
                      disabled={drawingEnabled || saveMutation.isPending}
                      className="inline-flex items-center justify-center gap-2 rounded border border-red-300 px-3 py-2 text-red-600 hover:bg-red-50 disabled:opacity-50"
                    >
                      <Trash2 size={16} />
                      删除
                    </button>
                  </>
                ) : (
                  <h2 className="text-lg font-semibold">{activeMap.name}</h2>
                )}
              </div>

              {canManageCampaignContent && activeMap.imageRef && !drawingEnabled ? (
                <div className="mt-4 space-y-3 rounded-md border border-theme bg-black/5 p-3">
                  <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
                    <label className="text-sm">
                      <span className="mb-1 block font-medium">关联地点</span>
                      <select
                        value={selectedLocationId}
                        onChange={(event) => setSelectedLocationId(event.target.value)}
                        className="w-full rounded border border-theme bg-theme-card px-3 py-2"
                      >
                        {campaignData.locations.length === 0 ? (
                          <option value="">请先创建地点</option>
                        ) : null}
                        {campaignData.locations.map((location) => (
                          <option key={location.id} value={location.id}>{location.name}</option>
                        ))}
                      </select>
                    </label>
                    <button
                      type="button"
                      onClick={() => setPlacingPoint((current) => !current)}
                      disabled={!selectedLocationId || saveMutation.isPending}
                      className={`inline-flex items-center justify-center gap-2 rounded px-4 py-2 text-sm disabled:opacity-50 ${
                        placingPoint
                          ? 'bg-primary text-white'
                          : 'border border-theme bg-theme-card hover:bg-primary-light'
                      }`}
                    >
                      <MapPinPlus size={17} />
                      {placingPoint ? '取消放置' : '放置点位'}
                    </button>
                  </div>
                  <p className="text-xs theme-text-secondary">
                    选择地点后开启放置模式，再点击地图。新点位使用默认图标且不向 PL 显示，点击点位可继续编辑图标和公开信息。
                  </p>
                </div>
              ) : null}

              {activeMap.imageRef ? (
                <LocationMapDrawingToolbar
                  enabled={drawingEnabled}
                  tool={drawing.tool}
                  color={drawing.strokeColor}
                  width={drawing.strokeWidth}
                  canUndo={pendingDrawingShapes.length === 0 && ownDrawingShapes.length > 0}
                  canRedo={drawingRedoShapes.length > 0}
                  hasShapes={(canManageCampaignContent ? drawingShapes : ownDrawingShapes).length > 0}
                  busy={migratingLegacyDrawing}
                  failedCount={failedDrawingOperations.length}
                  clearLabel={canManageCampaignContent ? '清空全员' : '清空我的'}
                  syncText={drawingQuery.isLoading
                    ? '正在加载联机画板...'
                    : migratingLegacyDrawing
                      ? '正在迁移旧版本地画板...'
                      : pendingDrawingShapes.length > 0
                        ? `正在同步 ${pendingDrawingShapes.length} 个图形...`
                        : `联机画板 · 版本 ${drawingQuery.data?.version ?? '-'}`}
                  onToggle={handleToggleDrawing}
                  onToolChange={drawing.setTool}
                  onColorChange={drawing.setStrokeColor}
                  onWidthChange={drawing.setStrokeWidth}
                  onUndo={() => void handleUndoDrawing()}
                  onRedo={() => void handleRedoDrawing()}
                  onClear={() => void handleClearDrawing()}
                  onRetry={() => void handleRetryDrawingOperations()}
                />
              ) : null}

              <div className="mt-4 flex min-h-[28rem] items-center justify-center overflow-auto rounded-md border border-theme bg-black/5 p-3">
                {activeMap.imageRef ? (
                  <div className="relative inline-block max-w-full leading-none">
                    <img
                      src={buildResourceFileUrl(activeMap.imageRef)}
                      alt={activeMap.name}
                      draggable={false}
                      onError={() => setImageLoadError(activeMap.imageRef)}
                      className={`block max-h-[70vh] max-w-full select-none rounded object-contain shadow-sm ${
                        imageLoadError === activeMap.imageRef ? 'opacity-20' : ''
                      }`}
                    />
                    {imageLoadError === activeMap.imageRef ? (
                      <div className="absolute inset-0 z-20 flex items-center justify-center p-4">
                        <div className="rounded border border-red-300 bg-theme-card p-4 text-center text-sm text-red-600 shadow">
                          <div>地图图片加载失败，资源可能已被移动或删除。</div>
                          {canManageCampaignContent ? (
                            <button
                              type="button"
                              onClick={() => setResourcePickerOpen(true)}
                              className="mt-3 rounded border border-theme px-3 py-1.5 text-current"
                            >
                              重新选择图片
                            </button>
                          ) : null}
                        </div>
                      </div>
                    ) : null}
                    <div
                      className={`absolute inset-0 ${placingPoint ? 'cursor-crosshair' : ''} ${
                        drawingEnabled ? 'pointer-events-none' : ''
                      }`}
                      onClick={(event) => void handleMapClick(event)}
                    >
                      {activeMap.points.map((point) => {
                        const preview = dragPreview?.pointId === point.id ? dragPreview : point;
                        return (
                          <button
                            key={point.id}
                            type="button"
                            title={canManageCampaignContent ? `${point.name}（拖动调整位置）` : point.name}
                            onClick={(event) => {
                              event.stopPropagation();
                              handleSelectPoint(point.id);
                            }}
                            onDoubleClick={(event) => {
                              event.stopPropagation();
                              if (canManageCampaignContent && point.locationId) {
                                navigate(`/locations/${point.locationId}`);
                              }
                            }}
                            onPointerDown={(event) => handlePointPointerDown(event, point)}
                            onPointerMove={(event) => handlePointPointerMove(event, point)}
                            onPointerUp={(event) => void handlePointPointerUp(event, point)}
                            onPointerCancel={() => setDragPreview(null)}
                            className={`absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center border-0 bg-transparent p-0 ${
                              selectedPointId === point.id ? 'z-10 scale-110' : ''
                            } ${
                              canManageCampaignContent && !placingPoint ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'
                            }`}
                            style={{
                              left: `${preview.x * 100}%`,
                              top: `${preview.y * 100}%`,
                              touchAction: 'none',
                            }}
                          >
                            <MapPointIcon iconId={point.iconId} className="h-9 w-9 sm:h-10 sm:w-10" />
                            <span
                              className="mt-1 max-w-32 truncate whitespace-nowrap text-xs font-bold leading-4"
                              style={{
                                color: point.labelColor,
                                WebkitTextStroke: `1px ${point.labelStrokeColor}`,
                                paintOrder: 'stroke fill',
                              }}
                            >
                              {point.name}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    <LocationMapDrawingLayer
                      enabled={drawingEnabled}
                      tool={drawing.tool}
                      shapes={drawingShapes}
                      draftShape={drawing.draftShape}
                      onBegin={drawing.beginShape}
                      onUpdate={drawing.updateShape}
                      onFinish={drawing.finishShape}
                      onCancel={drawing.cancelShape}
                      onErase={drawing.eraseShape}
                    />
                  </div>
                ) : (
                  <div className="max-w-sm text-center">
                    <ImagePlus className="mx-auto theme-text-secondary" size={36} />
                    <p className="mt-3 text-sm theme-text-secondary">
                      {canManageCampaignContent
                        ? '从资源管理器选择一张图片作为地图背景。'
                        : '这张地图尚未设置背景图片。'}
                    </p>
                    {canManageCampaignContent ? (
                      <button
                        type="button"
                        onClick={() => setResourcePickerOpen(true)}
                        className="mt-4 rounded bg-primary px-4 py-2 text-sm text-white"
                      >
                        打开资源管理器
                      </button>
                    ) : null}
                  </div>
                )}
              </div>

              {canManageCampaignContent && selectedPoint && !drawingEnabled ? (
                <LocationMapPointPanel
                  key={selectedPoint.id}
                  point={selectedPoint}
                  locations={campaignData.locations}
                  busy={saveMutation.isPending}
                  onSave={handleSavePoint}
                  onDelete={handleDeletePoint}
                  onOpenLocation={(locationId) => navigate(`/locations/${locationId}`)}
                  onDirtyChange={handlePointEditorDirtyChange}
                  onClose={handleClosePointEditor}
                />
              ) : null}
            </section>
          ) : null}
        </div>
      )}

      <RelationGraphResourcePickerModal
        open={resourcePickerOpen}
        resources={resourceQuery.data?.items ?? []}
        resourceFolders={resourceQuery.data?.folders ?? []}
        keyword={resourceKeyword}
        selectedFolderPath={resourceSelectedFolderPath}
        expandedFolders={resourceExpandedFolders}
        selectedRef={activeMap?.imageRef}
        loading={resourceQuery.isLoading}
        errorText={resourceQuery.isError ? '资源列表加载失败，请检查后端连接。' : undefined}
        onKeywordChange={setResourceKeyword}
        onSelectFolder={setResourceSelectedFolderPath}
        onToggleFolder={toggleResourceFolder}
        onClose={() => setResourcePickerOpen(false)}
        onSelectResource={(ref) => void handleSelectResource(ref)}
        onRetry={() => void resourceQuery.refetch()}
      />
      <input
        ref={imageUploadInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => void handleUploadMapImage(event.target.files?.[0])}
      />
      {!canManageCampaignContent ? (
        <LocationMapPointViewer
          point={selectedPoint}
          onClose={() => setSelectedPointId(null)}
        />
      ) : null}
    </div>
  );
};

export default LocationMaps;
