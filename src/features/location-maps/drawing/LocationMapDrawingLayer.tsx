import React from 'react';
import type { MapDrawingPoint, MapDrawingShape, MapDrawingTool } from './types';

interface LocationMapDrawingLayerProps {
  enabled: boolean;
  tool: MapDrawingTool;
  shapes: MapDrawingShape[];
  draftShape: MapDrawingShape | null;
  onBegin: (point: MapDrawingPoint) => void;
  onUpdate: (point: MapDrawingPoint) => void;
  onFinish: () => void;
  onCancel: () => void;
  onErase: (shapeId: string) => void;
}

const toPathPoints = (shape: MapDrawingShape) =>
  shape.points.map((point) => `${point.x * 1000},${point.y * 1000}`).join(' ');

const renderShape = (
  shape: MapDrawingShape,
  tool: MapDrawingTool,
  onErase: (shapeId: string) => void
) => {
  const commonProps = {
    fill: 'none',
    stroke: shape.strokeColor,
    strokeWidth: shape.strokeWidth,
    vectorEffect: 'non-scaling-stroke' as const,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    className: tool === 'eraser' ? 'cursor-crosshair hover:opacity-50' : undefined,
    onPointerDown: (event: React.PointerEvent<SVGElement>) => {
      if (tool !== 'eraser') return;
      event.stopPropagation();
      onErase(shape.id);
    },
  };
  if (shape.type === 'freehand') {
    return <polyline key={shape.id} points={toPathPoints(shape)} {...commonProps} />;
  }
  const [start, end] = shape.points;
  if (shape.type === 'rectangle') {
    return (
      <rect
        key={shape.id}
        x={Math.min(start.x, end.x) * 1000}
        y={Math.min(start.y, end.y) * 1000}
        width={Math.abs(end.x - start.x) * 1000}
        height={Math.abs(end.y - start.y) * 1000}
        {...commonProps}
      />
    );
  }
  return (
    <ellipse
      key={shape.id}
      cx={(start.x + end.x) * 500}
      cy={(start.y + end.y) * 500}
      rx={Math.abs(end.x - start.x) * 500}
      ry={Math.abs(end.y - start.y) * 500}
      {...commonProps}
    />
  );
};

const LocationMapDrawingLayer: React.FC<LocationMapDrawingLayerProps> = ({
  enabled,
  tool,
  shapes,
  draftShape,
  onBegin,
  onUpdate,
  onFinish,
  onCancel,
  onErase,
}) => {
  const pointerPosition = (event: React.PointerEvent<SVGSVGElement>): MapDrawingPoint => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) / Math.max(1, rect.width),
      y: (event.clientY - rect.top) / Math.max(1, rect.height),
    };
  };

  return (
    <svg
      viewBox="0 0 1000 1000"
      preserveAspectRatio="none"
      className={`absolute inset-0 h-full w-full ${enabled ? 'z-30 touch-none cursor-crosshair' : 'pointer-events-none z-10'}`}
      onPointerDown={(event) => {
        if (!enabled || tool === 'eraser') return;
        event.currentTarget.setPointerCapture(event.pointerId);
        onBegin(pointerPosition(event));
      }}
      onPointerMove={(event) => {
        if (!enabled || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
        onUpdate(pointerPosition(event));
      }}
      onPointerUp={(event) => {
        if (!enabled || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
        event.currentTarget.releasePointerCapture(event.pointerId);
        onFinish();
      }}
      onPointerCancel={onCancel}
      aria-label="地图矢量画板"
    >
      {shapes.map((shape) => renderShape(shape, tool, onErase))}
      {draftShape ? renderShape(draftShape, tool, onErase) : null}
    </svg>
  );
};

export default LocationMapDrawingLayer;
