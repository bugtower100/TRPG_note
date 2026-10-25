import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  FolderOpen,
  GripVertical,
  ImagePlus,
  MapPinPlus,
  MapPlus,
  Maximize2,
  Minimize2,
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCw,
  Save,
  Trash2,
  Upload,
  ZoomIn,
  ZoomOut,
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
import MapPointMarker from '../../features/location-maps/components/MapPointMarker';
import { useCampaignData, useCampaignSession } from '../../context/CampaignContext';
import { useCampaignMemberRole } from '../../hooks/useCampaignMemberRole';
import { queryKeys } from '../../query/queryKeys';
import { VersionConflictError } from '../../services/conflictError';
import { locationMapService } from '../../services/locationMapService';
import { locationMapDrawingService } from '../../services/locationMapDrawingService';
import { dataService } from '../../services/dataService';
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
  Character,
  Location,
  Monster,
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
  const { campaignData, setCampaignData } = useCampaignData();
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
  const [pointSource, setPointSource] = useState<'location' | 'temporary-location' | 'new-location' | 'character' | 'temporary-character' | 'new-character' | 'monster' | 'temporary-monster' | 'new-monster'>('location');
  const [selectedCharacterId, setSelectedCharacterId] = useState('');
  const [selectedMonsterId, setSelectedMonsterId] = useState('');
  const [newPointName, setNewPointName] = useState('');
  const [mapZoom, setMapZoom] = useState(1);
  const [mapPan, setMapPan] = useState({ x: 0, y: 0 });
  const [mapImageSize, setMapImageSize] = useState<{ width: number; height: number } | null>(null);
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
  const [resizePreview, setResizePreview] = useState<{
    pointId: string;
    startX: number;
    startY: number;
    initialSize: number;
    xDirection: number;
    yDirection: number;
    size: number;
  } | null>(null);
  const [highlightedPointId, setHighlightedPointId] = useState<string | null>(null);
  const [selectedPointId, setSelectedPointId] = useState<string | null>(null);
  const [pointEditorDirty, setPointEditorDirty] = useState(false);
  const [nameDirty, setNameDirty] = useState(false);
  const [imageLoadError, setImageLoadError] = useState('');
  const [remoteUpdateAvailable, setRemoteUpdateAvailable] = useState(false);
  const [mapListCollapsed, setMapListCollapsed] = useState(false);
  const [toolPanel, setToolPanel] = useState<'points' | 'drawing' | null>(null);
  const [mapFocused, setMapFocused] = useState(false);
  const [toolbarPosition, setToolbarPosition] = useState({ x: 8, y: 8 });
  const [conflictDraft, setConflictDraft] = useState<{
    maps: LocationMap[];
    remote: LocationMapDocument;
  } | null>(null);
  const observedVersionRef = useRef<number | null>(null);
  const localSavedVersionRef = useRef<number | null>(null);
  const imageUploadInputRef = useRef<HTMLInputElement | null>(null);
  const mapViewportRef = useRef<HTMLDivElement | null>(null);
  const toolbarRef = useRef<HTMLDivElement | null>(null);
  const toolbarDragRef = useRef<{ pointerId: number; offsetX: number; offsetY: number } | null>(null);
  const rightPanRef = useRef<{ pointerId: number; x: number; y: number; panX: number; panY: number } | null>(null);
  const mapNaturalSizeRef = useRef<{ width: number; height: number } | null>(null);
  const lastDragAtRef = useRef(0);
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
    refetchInterval: pointEditorDirty || nameDirty || placingPoint || drawingEnabled || Boolean(dragPreview) || Boolean(resizePreview)
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
  const refreshPaused = pointEditorDirty || nameDirty || placingPoint || drawingEnabled;

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

  useEffect(() => {
    if (!selectedCharacterId || !campaignData.characters.some((character) => character.id === selectedCharacterId)) {
      setSelectedCharacterId(campaignData.characters[0]?.id ?? '');
    }
  }, [campaignData.characters, selectedCharacterId]);

  useEffect(() => {
    if (!selectedMonsterId || !campaignData.monsters.some((monster) => monster.id === selectedMonsterId)) {
      setSelectedMonsterId(campaignData.monsters[0]?.id ?? '');
    }
  }, [campaignData.monsters, selectedMonsterId]);

  useEffect(() => {
    setMapZoom(1);
    setMapPan({ x: 0, y: 0 });
    setMapImageSize(null);
    mapNaturalSizeRef.current = null;
  }, [activeMapId, activeMap?.imageRef]);

  useEffect(() => {
    const viewport = mapViewportRef.current;
    if (!viewport || !activeMap?.imageRef) return;
    const fitImage = () => {
      const natural = mapNaturalSizeRef.current;
      if (!natural) return;
      const ratio = Math.min(1, (viewport.clientWidth - 24) / natural.width, (viewport.clientHeight - 24) / natural.height);
      setMapImageSize({ width: natural.width * ratio, height: natural.height * ratio });
    };
    const observer = new ResizeObserver(fitImage);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [activeMap?.imageRef]);

  const changeMapZoom = (nextZoom: number, clientX?: number, clientY?: number) => {
    const viewport = mapViewportRef.current;
    if (!viewport || nextZoom === mapZoom) return;
    const rect = viewport.getBoundingClientRect();
    const offsetX = (clientX ?? rect.left + rect.width / 2) - (rect.left + rect.width / 2);
    const offsetY = (clientY ?? rect.top + rect.height / 2) - (rect.top + rect.height / 2);
    const ratio = nextZoom / mapZoom;
    setMapPan((current) => ({
      x: offsetX - (offsetX - current.x) * ratio,
      y: offsetY - (offsetY - current.y) * ratio,
    }));
    setMapZoom(nextZoom);
  };

  useEffect(() => {
    const viewport = mapViewportRef.current;
    if (!viewport || !activeMap?.imageRef) return;
    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      const nextZoom = Math.max(0.25, Math.min(4, +(mapZoom * (event.deltaY < 0 ? 1.12 : 1 / 1.12)).toFixed(2)));
      changeMapZoom(nextZoom, event.clientX, event.clientY);
    };
    viewport.addEventListener('wheel', handleWheel, { passive: false });
    return () => viewport.removeEventListener('wheel', handleWheel);
  }, [activeMap?.imageRef, mapZoom]);

  const saveMaps = async (
    nextMaps: LocationMap[],
    successText: string,
    expectedVersion?: number
  ) => {
    setStatusText('');
    try {
      await saveMutation.mutateAsync({ maps: nextMaps, expectedVersion });
      if (successText) setStatusText(successText);
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
    if (event.button === 0 && !placingPoint) setHighlightedPointId(null);
    if (event.button !== 0 || !placingPoint || !activeMap || saveMutation.isPending) return;
    const isCharacter = pointSource.includes('character');
    const isMonster = pointSource.includes('monster');
    const name = newPointName.trim();
    const existingLocation = campaignData.locations.find((item) => item.id === selectedLocationId);
    const existingCharacter = campaignData.characters.find((item) => item.id === selectedCharacterId);
    const existingMonster = campaignData.monsters.find((item) => item.id === selectedMonsterId);
    if ((pointSource === 'location' && !existingLocation) || (pointSource === 'character' && !existingCharacter) || (pointSource === 'monster' && !existingMonster)) return;
    if ((pointSource.startsWith('temporary-') || pointSource.startsWith('new-')) && !name) return;
    const matchedLocation = pointSource === 'new-location'
      ? campaignData.locations.find((item) => item.name.trim().toLocaleLowerCase() === name.toLocaleLowerCase())
      : null;
    const matchedCharacter = pointSource === 'new-character'
      ? campaignData.characters.find((item) => item.name.trim().toLocaleLowerCase() === name.toLocaleLowerCase())
      : null;
    const matchedMonster = pointSource === 'new-monster'
      ? campaignData.monsters.find((item) => item.name.trim().toLocaleLowerCase() === name.toLocaleLowerCase())
      : null;
    if (matchedCharacter) {
      setStatusText(`已存在同名角色“${name}”，请选择“已有角色”放置。`);
      return;
    }
    if (matchedMonster) {
      setStatusText(`已存在同名怪物“${name}”，请选择“已有怪物”放置。`);
      return;
    }
    const createdLocation = pointSource === 'new-location' && !matchedLocation
      ? dataService.createEntity<Location>({ name, details: '', relatedImages: [], environment: '', relations: [] })
      : null;
    const createdCharacter = pointSource === 'new-character' && !matchedCharacter
      ? dataService.createEntity<Character>({ name, details: '', relatedImages: [], identity: '', appearance: '', desireOrGoal: '', attributes: '', relations: [] })
      : null;
    const createdMonster = pointSource === 'new-monster' && !matchedMonster
      ? dataService.createEntity<Monster>({ name, details: '', relatedImages: [], type: '', stats: '', abilities: '', drops: '', relations: [] })
      : null;
    const location = pointSource === 'location' ? existingLocation : matchedLocation ?? createdLocation;
    const character = pointSource === 'character' ? existingCharacter : matchedCharacter ?? createdCharacter;
    const monster = pointSource === 'monster' ? existingMonster : matchedMonster ?? createdMonster;
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const point: LocationMapPoint = {
      id: uuidv4(),
      kind: isCharacter ? 'character' : isMonster ? 'monster' : 'location',
      locationId: location?.id,
      characterId: character?.id,
      monsterId: monster?.id,
      avatarRef: '',
      tokenStyle: isCharacter || isMonster ? 'circle' : undefined,
      size: 40,
      name: location?.name ?? character?.name ?? monster?.name ?? name,
      introduction: '',
      iconId: 1,
      x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)),
      visibleToPlayers: false,
      labelColor: '#ffffff',
      labelStrokeColor: '#111827',
    };
    if (await updateActiveMapPoints([...activeMap.points, point], `已放置${isCharacter ? '人物' : isMonster ? '怪物' : '地点'}“${point.name}”`)) {
      if (createdLocation || createdCharacter || createdMonster) {
        setCampaignData((previous) => ({
          ...previous,
          locations: createdLocation ? [...previous.locations, createdLocation] : previous.locations,
          characters: createdCharacter ? [...previous.characters, createdCharacter] : previous.characters,
          monsters: createdMonster ? [...previous.monsters, createdMonster] : previous.monsters,
        }));
      }
    }
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
    if (event.button !== 0 || !canManageCampaignContent || placingPoint || saveMutation.isPending) return;
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    setHighlightedPointId(point.id);
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
    lastDragAtRef.current = Date.now();
    setDragPreview(null);
    await updateActiveMapPoints(
      activeMap.points.map((item) => (
        item.id === point.id ? { ...item, x: finalPosition.x, y: finalPosition.y } : item
      )),
      ''
    );
  };

  const resizePointSize = (preview: NonNullable<typeof resizePreview>, clientX: number, clientY: number) => (
    Math.max(16, Math.min(160, Math.round(
      preview.initialSize
      + (clientX - preview.startX) * preview.xDirection / mapZoom
      + (clientY - preview.startY) * preview.yDirection / mapZoom
    )))
  );

  const handleResizePointerUp = async (event: React.PointerEvent<HTMLSpanElement>, point: LocationMapPoint) => {
    event.stopPropagation();
    if (!resizePreview || resizePreview.pointId !== point.id || !activeMap) return;
    const size = resizePointSize(resizePreview, event.clientX, event.clientY);
    setResizePreview(null);
    lastDragAtRef.current = Date.now();
    if (size === (point.size ?? 40)) return;
    await updateActiveMapPoints(activeMap.points.map((item) => item.id === point.id ? { ...item, size } : item), '');
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
    setHighlightedPointId(null);
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
    <div className={`map-page space-y-2 ${mapFocused ? 'is-focused' : ''}`}>
      <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-bold">地图地点</h1>
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
        <div className="map-status rounded border border-theme bg-theme-card px-3 py-2 text-sm">{statusText}</div>
      ) : null}
      {refreshPaused ? (
        <div className="map-feedback rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
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
          data-map-layout
          className={`grid min-h-[36rem] grid-cols-1 gap-2 ${
            mapListCollapsed
              ? 'lg:grid-cols-[3.25rem_minmax(0,1fr)]'
              : 'lg:grid-cols-[16rem_minmax(0,1fr)]'
          }`}
        >
          <aside className="relative workspace-list-pane map-list-pane">
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
            <section className="workspace-editor-pane map-editor">
              <div className="map-management flex flex-wrap items-center gap-2 border-b border-theme pb-2">
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
                      className="min-w-36 flex-1 rounded border border-theme bg-transparent px-3 py-1.5 font-semibold"
                      aria-label="地图名称"
                    />
                    <button
                      type="button"
                      onClick={() => void handleSaveName()}
                      disabled={drawingEnabled || saveMutation.isPending || nameDraft.trim() === activeMap.name}
                      className="inline-flex items-center justify-center gap-2 rounded border border-theme px-2 py-1.5 text-sm disabled:opacity-50"
                    >
                      <Save size={16} />
                      保存名称
                    </button>
                    <button
                      type="button"
                      onClick={() => imageUploadInputRef.current?.click()}
                      disabled={drawingEnabled || saveMutation.isPending || uploadingImage}
                      className="inline-flex items-center justify-center gap-2 rounded border border-theme px-2 py-1.5 text-sm hover:bg-primary-light disabled:opacity-50"
                    >
                      <Upload size={16} />
                      {uploadingImage ? '上传中...' : '上传本地图片'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setResourcePickerOpen(true)}
                      disabled={drawingEnabled || saveMutation.isPending || uploadingImage}
                      className="inline-flex items-center justify-center gap-2 rounded border border-theme px-2 py-1.5 text-sm hover:bg-primary-light disabled:opacity-50"
                    >
                      <FolderOpen size={16} />
                      从资源管理器选择
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDeleteMap()}
                      disabled={drawingEnabled || saveMutation.isPending}
                      className="inline-flex items-center justify-center gap-2 rounded border border-red-300 px-2 py-1.5 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
                    >
                      <Trash2 size={16} />
                      删除
                    </button>
                  </>
                ) : (
                  <h2 className="text-lg font-semibold">{activeMap.name}</h2>
                )}
              </div>

              {(activeMap.imageRef || mapFocused) && (
                <div ref={toolbarRef} className="map-toolstrip mt-2 flex flex-wrap items-center gap-2 text-sm" style={mapFocused ? { left: toolbarPosition.x, top: toolbarPosition.y } : undefined}>
                  {mapFocused && (
                    <button
                      type="button"
                      className="cursor-move rounded border border-theme p-1.5"
                      aria-label="拖动工具栏"
                      title="拖动工具栏"
                      onPointerDown={(event) => {
                        const rect = toolbarRef.current?.getBoundingClientRect();
                        if (!rect) return;
                        event.preventDefault();
                        event.currentTarget.setPointerCapture(event.pointerId);
                        toolbarDragRef.current = { pointerId: event.pointerId, offsetX: event.clientX - rect.left, offsetY: event.clientY - rect.top };
                      }}
                      onPointerMove={(event) => {
                        if (toolbarDragRef.current?.pointerId !== event.pointerId) return;
                        const editor = toolbarRef.current?.parentElement;
                        const toolbar = toolbarRef.current;
                        if (!editor || !toolbar) return;
                        const rect = editor.getBoundingClientRect();
                        setToolbarPosition({
                          x: Math.max(0, Math.min(editor.clientWidth - toolbar.offsetWidth, event.clientX - rect.left - toolbarDragRef.current.offsetX)),
                          y: Math.max(0, Math.min(editor.clientHeight - toolbar.offsetHeight, event.clientY - rect.top - toolbarDragRef.current.offsetY)),
                        });
                      }}
                      onPointerUp={() => { toolbarDragRef.current = null; }}
                      onPointerCancel={() => { toolbarDragRef.current = null; }}
                    >
                      <GripVertical size={17} />
                    </button>
                  )}
                  {mapFocused && (
                    <select value={activeMap.id} onChange={(event) => handleSelectMap(event.target.value)} className="max-w-44 rounded border border-theme bg-theme-card px-2 py-1.5" aria-label="切换地图">
                      {maps.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                    </select>
                  )}
                  {canManageCampaignContent && activeMap.imageRef && <button type="button" disabled={drawingEnabled} onClick={() => { setToolPanel((current) => current === 'points' ? null : 'points'); setPlacingPoint(false); }} className={`rounded border px-3 py-1.5 disabled:opacity-50 ${toolPanel === 'points' ? 'border-primary bg-primary-light' : 'border-theme'}`}>
                    添加点位{placingPoint ? ' · 放置中' : ''}
                  </button>}
                  {activeMap.imageRef && <button type="button" onClick={() => setToolPanel((current) => current === 'drawing' ? null : 'drawing')} className={`rounded border px-3 py-1.5 ${toolPanel === 'drawing' || drawingEnabled ? 'border-primary bg-primary-light' : 'border-theme'}`}>
                    画板{drawingEnabled ? ' · 绘制中' : ''}
                  </button>}
                  {activeMap.imageRef && !mapFocused && <span className="theme-text-secondary">滚轮缩放 · 右键拖动平移</span>}
                  {activeMap.imageRef && mapFocused && (
                    <>
                      <button type="button" onClick={() => changeMapZoom(Math.max(0.25, +(mapZoom / 1.25).toFixed(2)))} className="rounded border border-theme p-1.5" aria-label="缩小地图"><ZoomOut size={17} /></button>
                      <span className="min-w-10 text-center">{Math.round(mapZoom * 100)}%</span>
                      <button type="button" onClick={() => changeMapZoom(Math.min(4, +(mapZoom * 1.25).toFixed(2)))} className="rounded border border-theme p-1.5" aria-label="放大地图"><ZoomIn size={17} /></button>
                      <button type="button" onClick={() => { setMapZoom(1); setMapPan({ x: 0, y: 0 }); }} className="rounded border border-theme px-2 py-1.5">适合窗口</button>
                    </>
                  )}
                  <button type="button" onClick={() => setMapFocused((current) => !current)} className="rounded border border-theme p-1.5" aria-label={mapFocused ? '退出沉浸视图' : '最大化地图'} title={mapFocused ? '退出沉浸视图' : '最大化地图'}>
                    {mapFocused ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
                  </button>
                </div>
              )}

              {canManageCampaignContent && activeMap.imageRef && !drawingEnabled && toolPanel === 'points' ? (
                <div className="map-point-tools page-section mt-2 space-y-2" style={mapFocused ? { left: toolbarPosition.x, top: toolbarPosition.y + (toolbarRef.current?.offsetHeight ?? 48) + 8 } : undefined}>
                   <div className="grid gap-3 md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-end">
                     <label className="text-sm">
                       <span className="mb-1 block font-medium">点位来源</span>
                       <select value={pointSource} onChange={(event) => { setPointSource(event.target.value as typeof pointSource); setPlacingPoint(false); }} className="w-full rounded border border-theme bg-theme-card px-3 py-2">
                         <option value="location">已有地点</option>
                         <option value="temporary-location">临时地点</option>
                         <option value="new-location">新增地点</option>
                         <option value="character">已有角色</option>
                         <option value="temporary-character">临时角色</option>
                         <option value="new-character">新增角色</option>
                         <option value="monster">已有怪物</option>
                         <option value="temporary-monster">临时怪物</option>
                         <option value="new-monster">新增怪物</option>
                       </select>
                     </label>
                    <label className="text-sm">
                       <span className="mb-1 block font-medium">{pointSource.startsWith('temporary-') || pointSource.startsWith('new-') ? '点位名称' : pointSource === 'character' ? '关联角色' : pointSource === 'monster' ? '关联怪物' : '关联地点'}</span>
                       {pointSource.startsWith('temporary-') || pointSource.startsWith('new-') ? (
                         <input value={newPointName} onChange={(event) => setNewPointName(event.target.value)} placeholder={pointSource.includes('character') ? '输入角色名称' : pointSource.includes('monster') ? '输入怪物名称' : '输入地点名称'} className="w-full rounded border border-theme bg-theme-card px-3 py-2" />
                       ) : (
                         <select value={pointSource === 'character' ? selectedCharacterId : pointSource === 'monster' ? selectedMonsterId : selectedLocationId} onChange={(event) => pointSource === 'character' ? setSelectedCharacterId(event.target.value) : pointSource === 'monster' ? setSelectedMonsterId(event.target.value) : setSelectedLocationId(event.target.value)} className="w-full rounded border border-theme bg-theme-card px-3 py-2">
                           {(pointSource === 'character' ? campaignData.characters : pointSource === 'monster' ? campaignData.monsters : campaignData.locations).map((entity) => <option key={entity.id} value={entity.id}>{entity.name}</option>)}
                         </select>
                       )}
                    </label>
                    <button
                      type="button"
                      onClick={() => setPlacingPoint((current) => !current)}
                       disabled={saveMutation.isPending || (pointSource === 'location' && !selectedLocationId) || (pointSource === 'character' && !selectedCharacterId) || (pointSource === 'monster' && !selectedMonsterId) || ((pointSource.startsWith('temporary-') || pointSource.startsWith('new-')) && !newPointName.trim())}
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
                  <p className="text-xs theme-text-secondary">临时点位只保存在地图；新增地点同名时关联已有档案。新点位默认不向 PL 显示。</p>
                </div>
              ) : null}

              {activeMap.imageRef && (toolPanel === 'drawing' || drawingEnabled) ? (
                <div className="map-drawing-tools" style={mapFocused ? { left: toolbarPosition.x, top: toolbarPosition.y + (toolbarRef.current?.offsetHeight ?? 48) + 8 } : undefined}>
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
                </div>
              ) : null}

               {activeMap.imageRef && (
                  <div className="map-zoom-tools mt-2 flex items-center gap-2 text-sm">
                   <button type="button" onClick={() => changeMapZoom(Math.max(0.25, +(mapZoom / 1.25).toFixed(2)))} className="rounded border border-theme p-2" aria-label="缩小地图"><ZoomOut size={16} /></button>
                   <span className="min-w-12 text-center">{Math.round(mapZoom * 100)}%</span>
                   <button type="button" onClick={() => changeMapZoom(Math.min(4, +(mapZoom * 1.25).toFixed(2)))} className="rounded border border-theme p-2" aria-label="放大地图"><ZoomIn size={16} /></button>
                   <button type="button" onClick={() => { setMapZoom(1); setMapPan({ x: 0, y: 0 }); }} className="rounded border border-theme px-3 py-2">适合窗口</button>
                 </div>
               )}
               <div
                 ref={mapViewportRef}
                 className="map-viewport mt-2 flex h-[72dvh] min-h-[26rem] items-start justify-start overflow-hidden rounded-md border border-theme bg-black/5 p-3"
                 onContextMenu={(event) => event.preventDefault()}
                 onPointerDown={(event) => {
                   if (event.button !== 2) return;
                   event.preventDefault();
                   event.currentTarget.setPointerCapture(event.pointerId);
                   rightPanRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, panX: mapPan.x, panY: mapPan.y };
                 }}
                 onPointerMove={(event) => {
                   const pan = rightPanRef.current;
                   if (!pan || pan.pointerId !== event.pointerId) return;
                   setMapPan({ x: pan.panX + event.clientX - pan.x, y: pan.panY + event.clientY - pan.y });
                 }}
                 onPointerUp={(event) => { if (rightPanRef.current?.pointerId === event.pointerId) rightPanRef.current = null; }}
                 onPointerCancel={(event) => { if (rightPanRef.current?.pointerId === event.pointerId) rightPanRef.current = null; }}
               >
                {activeMap.imageRef ? (
                   <div className="relative m-auto inline-block shrink-0 leading-none" style={{ width: mapImageSize?.width, height: mapImageSize?.height, transform: `translate(${mapPan.x}px, ${mapPan.y}px) scale(${mapZoom})`, transformOrigin: 'center center' }}>
                    <img
                      src={buildResourceFileUrl(activeMap.imageRef)}
                      alt={activeMap.name}
                      draggable={false}
                       onLoad={(event) => {
                         const image = event.currentTarget;
                         const viewport = mapViewportRef.current;
                         if (!viewport) return;
                          mapNaturalSizeRef.current = { width: image.naturalWidth, height: image.naturalHeight };
                          const ratio = Math.min(1, (viewport.clientWidth - 24) / image.naturalWidth, (viewport.clientHeight - 24) / image.naturalHeight);
                         setMapImageSize({ width: image.naturalWidth * ratio, height: image.naturalHeight * ratio });
                       }}
                      onError={() => setImageLoadError(activeMap.imageRef)}
                       className={`block h-full w-full select-none rounded shadow-sm ${
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
                        const pointSize = resizePreview?.pointId === point.id ? resizePreview.size : point.size ?? 40;
                        return (
                          <React.Fragment key={point.id}>
                          <button
                            type="button"
                            title={`${point.name}（${canManageCampaignContent ? '单击选中并调整大小；拖动移动；双击查看' : '双击查看公开介绍'}）`}
                            onClick={(event) => event.stopPropagation()}
                            onDoubleClick={(event) => {
                              event.stopPropagation();
                              if (Date.now() - lastDragAtRef.current < 350) return;
                              setHighlightedPointId(point.id);
                              handleSelectPoint(point.id);
                            }}
                            onPointerDown={(event) => handlePointPointerDown(event, point)}
                            onPointerMove={(event) => handlePointPointerMove(event, point)}
                            onPointerUp={(event) => void handlePointPointerUp(event, point)}
                            onPointerCancel={() => setDragPreview(null)}
                            className={`absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center border-0 bg-transparent p-0 ${
                              highlightedPointId === point.id ? 'z-20' : ''
                            } ${
                              canManageCampaignContent && !placingPoint ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'
                            }`}
                            style={{
                              left: `${preview.x * 100}%`,
                              top: `${preview.y * 100}%`,
                              touchAction: 'none',
                            }}
                          >
                             <MapPointMarker point={point} size={pointSize} className="shrink-0" />
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
                          {canManageCampaignContent && !placingPoint && !drawingEnabled && highlightedPointId === point.id && (
                            <div
                              className="pointer-events-none absolute z-30 -translate-x-1/2 -translate-y-1/2 rounded-sm border border-primary"
                              style={{ left: `${preview.x * 100}%`, top: `calc(${preview.y * 100}% - 10px)`, width: pointSize + 4 / mapZoom, height: pointSize + 4 / mapZoom, borderWidth: 1 / mapZoom }}
                            >
                              {([
                                { corner: 'tl', x: -1, y: -1, cursor: 'cursor-nwse-resize' },
                                { corner: 'tr', x: 1, y: -1, cursor: 'cursor-nesw-resize' },
                                { corner: 'bl', x: -1, y: 1, cursor: 'cursor-nesw-resize' },
                                { corner: 'br', x: 1, y: 1, cursor: 'cursor-nwse-resize' },
                              ] as const).map((handle) => (
                                <span
                                  key={handle.corner}
                                  role="slider"
                                  aria-label={`调整${point.name}的大小`}
                                  aria-valuemin={16}
                                  aria-valuemax={160}
                                  aria-valuenow={pointSize}
                                  tabIndex={0}
                                  className={`pointer-events-auto absolute flex items-center justify-center ${handle.cursor}`}
                                  style={{
                                    width: 16 / mapZoom,
                                    height: 16 / mapZoom,
                                    top: handle.y < 0 ? -8 / mapZoom : undefined,
                                    bottom: handle.y > 0 ? -8 / mapZoom : undefined,
                                    left: handle.x < 0 ? -8 / mapZoom : undefined,
                                    right: handle.x > 0 ? -8 / mapZoom : undefined,
                                  }}
                                  onPointerDown={(event) => {
                                    if (event.button !== 0 || saveMutation.isPending) return;
                                    event.preventDefault();
                                    event.stopPropagation();
                                    event.currentTarget.setPointerCapture(event.pointerId);
                                    setResizePreview({ pointId: point.id, startX: event.clientX, startY: event.clientY, initialSize: point.size ?? 40, xDirection: handle.x, yDirection: handle.y, size: point.size ?? 40 });
                                  }}
                                  onPointerMove={(event) => {
                                    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
                                    event.stopPropagation();
                                    setResizePreview((current) => current?.pointId === point.id ? { ...current, size: resizePointSize(current, event.clientX, event.clientY) } : current);
                                  }}
                                  onPointerUp={(event) => void handleResizePointerUp(event, point)}
                                  onPointerCancel={(event) => { event.stopPropagation(); setResizePreview(null); }}
                                  onClick={(event) => event.stopPropagation()}
                                >
                                  <span className="rounded-sm border border-white bg-primary shadow-sm" style={{ width: 7 / mapZoom, height: 7 / mapZoom, borderWidth: 1 / mapZoom }} />
                                </span>
                              ))}
                            </div>
                          )}
                          </React.Fragment>
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
                <>
                  <div className="fixed inset-0 z-[49]" onClick={handleClosePointEditor} aria-hidden="true" />
                  <LocationMapPointPanel
                    key={selectedPoint.id}
                    point={selectedPoint}
                    locations={campaignData.locations}
                    characters={campaignData.characters}
                    monsters={campaignData.monsters}
                    busy={saveMutation.isPending}
                    onSave={handleSavePoint}
                    onDelete={handleDeletePoint}
                    onOpenLocation={(locationId) => navigate(`/locations/${locationId}`)}
                    onOpenCharacter={(characterId) => navigate(`/characters/${characterId}`)}
                    onOpenMonster={(monsterId) => navigate(`/monsters/${monsterId}`)}
                    onDirtyChange={handlePointEditorDirtyChange}
                    onClose={handleClosePointEditor}
                  />
                </>
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
