export type MapDrawingTool = 'freehand' | 'rectangle' | 'ellipse' | 'eraser';

export interface MapDrawingPoint {
  x: number;
  y: number;
}

export interface MapDrawingShape {
  id: string;
  type: Exclude<MapDrawingTool, 'eraser'>;
  points: MapDrawingPoint[];
  strokeColor: string;
  strokeWidth: number;
  createdAt: number;
}

export interface LocalMapDrawingDocument {
  schemaVersion: 1;
  shapes: MapDrawingShape[];
}
