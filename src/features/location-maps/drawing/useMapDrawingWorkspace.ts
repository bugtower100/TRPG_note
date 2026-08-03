import { useCallback, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { LocalMapDrawingDocument, MapDrawingPoint, MapDrawingShape, MapDrawingTool } from './types';

const FREEHAND_SAMPLE_DISTANCE = 0.0025;

interface UseMapDrawingWorkspaceOptions {
  onAddShape: (shape: MapDrawingShape) => void;
  onEraseShape: (shapeId: string) => void;
}

export const legacyDrawingStorageKey = (campaignId: string, mapId: string, userId: string) =>
  `trpg_location_map_drawing_v1:${userId}:${campaignId}:${mapId}`;

export const loadLegacyDrawingShapes = (storageKey: string): MapDrawingShape[] => {
  const raw = localStorage.getItem(storageKey);
  if (!raw) return [];
  const document = JSON.parse(raw) as Partial<LocalMapDrawingDocument>;
  return Array.isArray(document.shapes) ? document.shapes.slice(0, 1000) : [];
};

const clampPoint = (point: MapDrawingPoint): MapDrawingPoint => ({
  x: Math.max(0, Math.min(1, point.x)),
  y: Math.max(0, Math.min(1, point.y)),
});

export const useMapDrawingWorkspace = ({
  onAddShape,
  onEraseShape,
}: UseMapDrawingWorkspaceOptions) => {
  const [tool, setTool] = useState<MapDrawingTool>('freehand');
  const [strokeColor, setStrokeColor] = useState('#ef4444');
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [draftShape, setDraftShape] = useState<MapDrawingShape | null>(null);

  const beginShape = useCallback((point: MapDrawingPoint) => {
    if (tool === 'eraser') return;
    const safePoint = clampPoint(point);
    setDraftShape({
      id: uuidv4(),
      type: tool,
      points: [safePoint, safePoint],
      strokeColor,
      strokeWidth,
      createdAt: Date.now(),
    });
  }, [strokeColor, strokeWidth, tool]);

  const updateShape = useCallback((point: MapDrawingPoint) => {
    const safePoint = clampPoint(point);
    setDraftShape((current) => {
      if (!current) return null;
      if (current.type !== 'freehand') {
        return { ...current, points: [current.points[0], safePoint] };
      }
      const previous = current.points[current.points.length - 1];
      if (Math.hypot(safePoint.x - previous.x, safePoint.y - previous.y) < FREEHAND_SAMPLE_DISTANCE) {
        return current;
      }
      return { ...current, points: [...current.points, safePoint] };
    });
  }, []);

  const finishShape = useCallback(() => {
    if (!draftShape) return;
    const [start, end] = draftShape.points;
    const visible = draftShape.type === 'freehand'
      ? draftShape.points.length > 2
      : Math.hypot(end.x - start.x, end.y - start.y) >= 0.005;
    setDraftShape(null);
    if (visible) onAddShape(draftShape);
  }, [draftShape, onAddShape]);

  const eraseShape = useCallback((shapeId: string) => {
    if (tool === 'eraser') onEraseShape(shapeId);
  }, [onEraseShape, tool]);

  const cancelShape = useCallback(() => setDraftShape(null), []);

  return {
    tool, setTool, strokeColor, setStrokeColor, strokeWidth, setStrokeWidth,
    draftShape, beginShape, updateShape, finishShape, cancelShape, eraseShape,
  };
};
