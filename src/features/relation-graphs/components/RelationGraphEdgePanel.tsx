import React from 'react';
import { RelationEdgeDirection, RelationGraphEdge } from '../../../types';

interface RelationGraphEdgePanelProps {
  edge: RelationGraphEdge | null;
  onChange: (edgeId: string, patch: Partial<RelationGraphEdge>) => void;
  onClose: () => void;
}

const RelationGraphEdgePanel: React.FC<RelationGraphEdgePanelProps> = ({
  edge,
  onChange,
  onClose,
}) => {
  if (!edge) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 md:right-6 md:top-24 md:inset-auto md:bottom-auto w-full md:w-80 bg-theme-card border border-theme rounded-t-xl md:rounded-lg shadow-xl p-3 z-50">
      <div className="font-semibold mb-2">关系线编辑</div>
      <div className="space-y-3">
        <div>
          <label className="text-sm block mb-1">方向</label>
          <select
            value={edge.direction}
            onChange={(e) => onChange(edge.id, { direction: e.target.value as RelationEdgeDirection })}
            className="w-full px-2 py-2 rounded border border-theme bg-transparent"
          >
            <option value="none">无箭头</option>
            <option value="forward">单向（起点→终点）</option>
            <option value="backward">单向（终点→起点）</option>
            <option value="bidirectional">双向</option>
          </select>
        </div>
        <div>
          <label className="text-sm block mb-1">文字</label>
          <input
            type="text"
            value={edge.label}
            onChange={(e) => onChange(edge.id, { label: e.target.value })}
            className="w-full px-2 py-2 rounded border border-theme bg-transparent"
            placeholder="如：盟友、敌对、怀疑"
          />
        </div>
        <div>
          <label className="text-sm block mb-1">线条样式</label>
          <select
            value={edge.lineStyle}
            onChange={(e) => onChange(edge.id, { lineStyle: e.target.value as 'solid' | 'dashed' })}
            className="w-full px-2 py-2 rounded border border-theme bg-transparent"
          >
            <option value="solid">实线</option>
            <option value="dashed">虚线</option>
          </select>
        </div>
        <div>
          <label className="text-sm block mb-1">线条粗细（1~6px）</label>
          <input
            type="range"
            min={1}
            max={6}
            step={1}
            value={edge.lineWidth}
            onChange={(e) =>
              onChange(edge.id, {
                lineWidth: Math.max(1, Math.min(6, Number(e.target.value) || 2)),
              })
            }
            className="w-full"
          />
          <div className="text-xs theme-text-secondary">{edge.lineWidth}px</div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-sm block mb-1">字体大小</label>
            <input
              type="number"
              min={10}
              max={30}
              value={edge.labelFontSize}
              onChange={(e) => onChange(edge.id, { labelFontSize: Number(e.target.value) || 12 })}
              className="w-full px-2 py-2 rounded border border-theme bg-transparent"
            />
          </div>
          <div>
            <label className="text-sm block mb-1">字体颜色</label>
            <input
              type="color"
              value={edge.labelColor}
              onChange={(e) => onChange(edge.id, { labelColor: e.target.value })}
              className="w-full h-10 rounded border border-theme bg-transparent"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-sm block mb-1">文字底色</label>
            <input
              type="color"
              value={edge.labelBgColor}
              onChange={(e) => onChange(edge.id, { labelBgColor: e.target.value })}
              className="w-full h-10 rounded border border-theme bg-transparent"
            />
          </div>
          <div>
            <label className="text-sm block mb-1">底色透明度</label>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(edge.labelBgOpacity * 100)}
              onChange={(e) =>
                onChange(edge.id, {
                  labelBgOpacity: Math.max(0, Math.min(1, Number(e.target.value) / 100)),
                })
              }
              className="w-full"
            />
            <div className="text-xs theme-text-secondary">{Math.round(edge.labelBgOpacity * 100)}%</div>
          </div>
        </div>
        <button onClick={onClose} className="w-full px-3 py-2 rounded border border-theme hover:bg-primary-light">
          完成编辑
        </button>
      </div>
    </div>
  );
};

export default RelationGraphEdgePanel;
