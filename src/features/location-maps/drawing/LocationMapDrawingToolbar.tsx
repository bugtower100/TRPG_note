import React from 'react';
import {
  Circle,
  Eraser,
  MousePointer2,
  Pencil,
  Redo2,
  Square,
  Trash2,
  Undo2,
} from 'lucide-react';
import type { MapDrawingTool } from './types';

interface LocationMapDrawingToolbarProps {
  enabled: boolean;
  tool: MapDrawingTool;
  color: string;
  width: number;
  canUndo: boolean;
  canRedo: boolean;
  hasShapes: boolean;
  busy: boolean;
  failedCount: number;
  clearLabel: string;
  syncText: string;
  onToggle: () => void;
  onToolChange: (tool: MapDrawingTool) => void;
  onColorChange: (color: string) => void;
  onWidthChange: (width: number) => void;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
  onRetry: () => void;
}

const tools: Array<{ id: MapDrawingTool; label: string; icon: React.ReactNode }> = [
  { id: 'freehand', label: '自由绘制', icon: <Pencil size={16} /> },
  { id: 'rectangle', label: '矩形', icon: <Square size={16} /> },
  { id: 'ellipse', label: '圆形', icon: <Circle size={16} /> },
  { id: 'eraser', label: '橡皮擦', icon: <Eraser size={16} /> },
];

const LocationMapDrawingToolbar: React.FC<LocationMapDrawingToolbarProps> = ({
  enabled,
  tool,
  color,
  width,
  canUndo,
  canRedo,
  hasShapes,
  busy,
  failedCount,
  clearLabel,
  syncText,
  onToggle,
  onToolChange,
  onColorChange,
  onWidthChange,
  onUndo,
  onRedo,
  onClear,
  onRetry,
}) => (
  <div className="mt-4 rounded-md border border-theme bg-black/5 p-3">
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={onToggle}
        disabled={busy}
        className={`inline-flex min-h-11 items-center gap-2 rounded px-3 py-2 text-sm ${
          enabled ? 'bg-primary text-white' : 'border border-theme bg-theme-card'
        }`}
      >
        <MousePointer2 size={16} />
        {enabled ? '退出画板' : '进入画板'}
      </button>
      {enabled ? tools.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onToolChange(item.id)}
          disabled={busy}
          className={`inline-flex min-h-11 items-center gap-2 rounded border px-3 py-2 text-sm ${
            tool === item.id ? 'border-primary bg-primary-light text-primary' : 'border-theme bg-theme-card'
          }`}
        >
          {item.icon}
          {item.label}
        </button>
      )) : null}
      {enabled ? (
        <>
          <input
            type="color"
            value={color}
            onChange={(event) => onColorChange(event.target.value)}
            className="h-11 w-14 rounded border border-theme bg-theme-card p-1"
            aria-label="画笔颜色"
          />
          <label className="flex min-h-11 items-center gap-2 rounded border border-theme bg-theme-card px-3 text-sm">
            粗细
            <input
              type="range"
              min={1}
              max={12}
              value={width}
              onChange={(event) => onWidthChange(Number(event.target.value))}
              className="w-24"
            />
          </label>
          <button type="button" onClick={onUndo} disabled={busy || !canUndo} className="min-h-11 rounded border border-theme p-2 disabled:opacity-40" aria-label="撤回我的最近图形">
            <Undo2 size={18} />
          </button>
          <button type="button" onClick={onRedo} disabled={busy || !canRedo} className="min-h-11 rounded border border-theme p-2 disabled:opacity-40" aria-label="重做我的最近图形">
            <Redo2 size={18} />
          </button>
          <button type="button" onClick={onClear} disabled={busy || !hasShapes} className="inline-flex min-h-11 items-center gap-2 rounded border border-red-300 px-3 py-2 text-sm text-red-600 disabled:opacity-40">
            <Trash2 size={16} />
            {clearLabel}
          </button>
          {failedCount > 0 ? (
            <button type="button" onClick={onRetry} className="min-h-11 rounded border border-amber-400 px-3 py-2 text-sm text-amber-700">
              重试失败操作（{failedCount}）
            </button>
          ) : null}
        </>
      ) : null}
    </div>
    <p className="mt-2 text-xs theme-text-secondary">
      {syncText}。完成一笔后同步；撤回只影响自己的最近图形。
    </p>
  </div>
);

export default LocationMapDrawingToolbar;
