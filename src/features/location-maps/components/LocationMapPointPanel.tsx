import React, { useState } from 'react';
import { ExternalLink, Save, Trash2, X } from 'lucide-react';
import type { Location, LocationMapPoint } from '../../../types';
import MapPointIcon, { MAP_ICON_IDS } from './MapPointIcon';

interface LocationMapPointPanelProps {
  point: LocationMapPoint;
  locations: Location[];
  busy: boolean;
  onSave: (point: LocationMapPoint) => Promise<boolean>;
  onDelete: (point: LocationMapPoint) => Promise<void>;
  onOpenLocation: (locationId: string) => void;
  onDirtyChange: (dirty: boolean) => void;
  onClose: () => void;
}

const LocationMapPointPanel: React.FC<LocationMapPointPanelProps> = ({
  point,
  locations,
  busy,
  onSave,
  onDelete,
  onOpenLocation,
  onDirtyChange,
  onClose,
}) => {
  const [draft, setDraft] = useState<LocationMapPoint>({ ...point });
  const [dirty, setDirty] = useState(false);

  React.useEffect(() => {
    if (!dirty) setDraft({ ...point });
  }, [dirty, point]);

  React.useEffect(() => {
    onDirtyChange(dirty);
    return () => onDirtyChange(false);
  }, [dirty, onDirtyChange]);

  const updateDraft = (patch: Partial<LocationMapPoint>) => {
    const next = { ...draft, ...patch };
    setDraft(next);
    setDirty(JSON.stringify(next) !== JSON.stringify(point));
  };

  const handleSave = async () => {
    const saved = await onSave({ ...draft, name: draft.name.trim() || '未命名地点' });
    if (saved) setDirty(false);
  };

  return (
    <section
      className="fixed inset-x-0 bottom-0 z-50 max-h-[82vh] w-full overflow-y-auto rounded-t-xl border border-theme bg-theme-card p-4 shadow-2xl md:inset-auto md:right-6 md:bottom-6 md:w-[420px] md:rounded-xl"
      role="dialog"
      aria-label="编辑地图点位"
    >
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="font-semibold">编辑点位</h3>
          <p className="mt-1 text-xs theme-text-secondary">双击地图上的点位可进入关联地点详情。</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-11 items-center gap-2 rounded border border-theme px-3 py-2 text-sm hover:bg-primary-light"
          >
            <X size={16} />
            关闭
          </button>
          <button
            type="button"
            onClick={() => draft.locationId && onOpenLocation(draft.locationId)}
            disabled={!locations.some((location) => location.id === draft.locationId)}
            className="inline-flex min-h-11 items-center gap-2 rounded border border-theme px-3 py-2 text-sm hover:bg-primary-light disabled:opacity-50"
          >
            <ExternalLink size={16} />
            打开地点
          </button>
          <button
            type="button"
            onClick={() => void onDelete(point)}
            disabled={busy}
            className="inline-flex min-h-11 items-center gap-2 rounded border border-red-300 px-3 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            <Trash2 size={16} />
            删除点位
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="text-sm">
          <span className="mb-1 block font-medium">关联地点</span>
          <select
            value={draft.locationId ?? ''}
            onChange={(event) => updateDraft({ locationId: event.target.value })}
            className="w-full rounded border border-theme bg-theme-card px-3 py-2"
          >
            {draft.locationId && !locations.some((location) => location.id === draft.locationId) ? (
              <option value={draft.locationId}>关联地点已删除，请重新选择</option>
            ) : null}
            {locations.map((location) => (
              <option key={location.id} value={location.id}>{location.name}</option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium">点位名称</span>
          <input
            value={draft.name}
            onChange={(event) => updateDraft({ name: event.target.value })}
            className="w-full rounded border border-theme bg-theme-card px-3 py-2"
          />
        </label>
      </div>

      <label className="mt-4 block text-sm">
        <span className="mb-1 block font-medium">给 PL 查看时显示的简介</span>
        <textarea
          value={draft.introduction}
          onChange={(event) => updateDraft({ introduction: event.target.value })}
          rows={4}
          className="w-full resize-y rounded border border-theme bg-theme-card px-3 py-2"
          placeholder="填写玩家点击点位时可以看到的公开介绍"
        />
      </label>

      <label className="mt-4 flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={draft.visibleToPlayers}
          onChange={(event) => updateDraft({ visibleToPlayers: event.target.checked })}
        />
        向 PL 显示此点位
      </label>

      <div className="mt-4">
        <div className="mb-2 text-sm font-medium">点位图标</div>
        <div className="flex flex-wrap gap-2">
          {MAP_ICON_IDS.map((iconId) => (
            <button
              key={iconId}
              type="button"
              onClick={() => updateDraft({ iconId })}
              className={`rounded border p-1 ${
                draft.iconId === iconId
                  ? 'border-primary bg-primary-light ring-2 ring-primary/20'
                  : 'border-theme bg-theme-card'
              }`}
              aria-label={`选择点位图标 ${iconId}`}
            >
              <MapPointIcon iconId={iconId} className="h-9 w-9" />
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="text-sm">
          <span className="mb-1 block font-medium">名称颜色</span>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={draft.labelColor}
              onChange={(event) => updateDraft({ labelColor: event.target.value })}
              className="h-10 w-14 rounded border border-theme bg-theme-card p-1"
            />
            <span className="font-mono text-xs">{draft.labelColor}</span>
          </div>
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium">描边颜色</span>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={draft.labelStrokeColor}
              onChange={(event) => updateDraft({ labelStrokeColor: event.target.value })}
              className="h-10 w-14 rounded border border-theme bg-theme-card p-1"
            />
            <span className="font-mono text-xs">{draft.labelStrokeColor}</span>
          </div>
        </label>
      </div>

      <div className="mt-5 flex justify-end">
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={busy || !dirty || !locations.some((location) => location.id === draft.locationId)}
          className="inline-flex items-center gap-2 rounded bg-primary px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          <Save size={16} />
          保存点位
        </button>
      </div>
    </section>
  );
};

export default LocationMapPointPanel;
