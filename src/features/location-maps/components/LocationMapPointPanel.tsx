import React, { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ExternalLink, Save, Trash2, Upload, X } from 'lucide-react';
import type { Character, Location, LocationMapPoint, Monster } from '../../../types';
import RelationGraphResourcePickerModal from '../../relation-graphs/components/RelationGraphResourcePickerModal';
import { resourceService, RESOURCE_ROOT_PATH } from '../../../services/resourceService';
import MapPointIcon, { MAP_ICON_IDS } from './MapPointIcon';
import MapPointMarker from './MapPointMarker';

interface LocationMapPointPanelProps {
  point: LocationMapPoint;
  locations: Location[];
  characters: Character[];
  monsters: Monster[];
  busy: boolean;
  onSave: (point: LocationMapPoint) => Promise<boolean>;
  onDelete: (point: LocationMapPoint) => Promise<void>;
  onOpenLocation: (locationId: string) => void;
  onOpenCharacter: (characterId: string) => void;
  onOpenMonster: (monsterId: string) => void;
  onDirtyChange: (dirty: boolean) => void;
  onClose: () => void;
}

const LocationMapPointPanel: React.FC<LocationMapPointPanelProps> = ({
  point,
  locations,
  characters,
  monsters,
  busy,
  onSave,
  onDelete,
  onOpenLocation,
  onOpenCharacter,
  onOpenMonster,
  onDirtyChange,
  onClose,
}) => {
  const queryClient = useQueryClient();
  const imageUploadRef = useRef<HTMLInputElement | null>(null);
  const [draft, setDraft] = useState<LocationMapPoint>({ ...point });
  const [dirty, setDirty] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [tokenPickerOpen, setTokenPickerOpen] = useState(false);
  const [resourceKeyword, setResourceKeyword] = useState('');
  const [resourceFolder, setResourceFolder] = useState(RESOURCE_ROOT_PATH);
  const [expandedFolders, setExpandedFolders] = useState<string[]>([RESOURCE_ROOT_PATH]);
  const resourceQuery = useQuery({
    queryKey: ['resources', 'library'],
    queryFn: () => resourceService.list(),
    enabled: tokenPickerOpen,
    staleTime: 30_000,
  });

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
    const saved = await onSave({ ...draft, name: draft.name.trim() || '未命名点位' });
    if (saved) setDirty(false);
  };

  const handleUploadImage = async (file?: File) => {
    if (!file) return;
    setUploadingImage(true);
    setUploadError('');
    try {
      const uploaded = await resourceService.upload(file, RESOURCE_ROOT_PATH);
      updateDraft({ avatarRef: uploaded.ref, ...(draft.tokenStyle === 'avatar' ? { tokenStyle: 'circle' as const } : {}) });
      await queryClient.invalidateQueries({ queryKey: ['resources', 'library'] });
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : '图片上传失败');
    } finally {
      setUploadingImage(false);
      if (imageUploadRef.current) imageUploadRef.current.value = '';
    }
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
          <p className="mt-1 text-xs theme-text-secondary">档案跳转可在这里操作。</p>
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
          {draft.kind !== 'character' && draft.kind !== 'monster' && <button
            type="button"
            onClick={() => draft.locationId && onOpenLocation(draft.locationId)}
            disabled={!locations.some((location) => location.id === draft.locationId)}
            className="inline-flex min-h-11 items-center gap-2 rounded border border-theme px-3 py-2 text-sm hover:bg-primary-light disabled:opacity-50"
          >
            <ExternalLink size={16} />
            打开地点
          </button>}
          {draft.kind === 'character' && draft.characterId && characters.some((character) => character.id === draft.characterId) && (
            <button type="button" onClick={() => onOpenCharacter(draft.characterId!)} className="inline-flex min-h-11 items-center gap-2 rounded border border-theme px-3 py-2 text-sm hover:bg-primary-light">
              <ExternalLink size={16} />打开角色
            </button>
          )}
          {draft.kind === 'monster' && draft.monsterId && monsters.some((monster) => monster.id === draft.monsterId) && (
            <button type="button" onClick={() => onOpenMonster(draft.monsterId!)} className="inline-flex min-h-11 items-center gap-2 rounded border border-theme px-3 py-2 text-sm hover:bg-primary-light">
              <ExternalLink size={16} />打开怪物
            </button>
          )}
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
          <span className="mb-1 block font-medium">{draft.kind === 'character' ? '关联角色' : draft.kind === 'monster' ? '关联怪物' : '关联地点'}</span>
          <select
            value={draft.kind === 'character' ? draft.characterId ?? '' : draft.kind === 'monster' ? draft.monsterId ?? '' : draft.locationId ?? ''}
            onChange={(event) => {
              if (draft.kind === 'character') {
                updateDraft({ characterId: event.target.value });
              } else if (draft.kind === 'monster') {
                updateDraft({ monsterId: event.target.value });
              } else updateDraft({ locationId: event.target.value });
            }}
            className="w-full rounded border border-theme bg-theme-card px-3 py-2"
          >
            <option value="">临时{draft.kind === 'character' ? '角色' : draft.kind === 'monster' ? '怪物' : '地点'}（不创建档案）</option>
            {(draft.kind === 'character' ? characters : draft.kind === 'monster' ? monsters : locations).map((entity) => (
              <option key={entity.id} value={entity.id}>{entity.name}</option>
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
        <div className="mb-2 text-sm font-medium">{draft.kind === 'character' || draft.kind === 'monster' ? '指示物样式' : '点位图标'}</div>
        {(draft.kind === 'character' || draft.kind === 'monster') && (
          <div className="mb-3 flex flex-wrap gap-2">
            {(['circle', 'square', 'token'] as const).map((style) => (
              <button key={style} type="button" onClick={() => updateDraft({ tokenStyle: style })} className={`rounded border px-3 py-1.5 text-sm ${(draft.tokenStyle === 'avatar' ? 'circle' : draft.tokenStyle ?? 'circle') === style ? 'border-primary bg-primary-light' : 'border-theme'}`}>
                {{ circle: '圆形头像', square: '方形头像', token: 'Token' }[style]}
              </button>
            ))}
            <MapPointMarker point={draft} />
          </div>
        )}
        {(draft.kind === 'character' || draft.kind === 'monster') && <p className="mb-3 text-xs theme-text-secondary">头像用图片填充形状，没有图片时显示名称首字；Token 直接显示原图。</p>}
        {draft.kind !== 'character' && draft.kind !== 'monster' && (
        <div className="flex flex-wrap gap-2">
          {MAP_ICON_IDS.map((iconId) => (
            <button
              key={iconId}
              type="button"
              onClick={() => updateDraft({ iconId, avatarRef: '' })}
              className={`rounded border p-1 ${
                !draft.avatarRef && draft.iconId === iconId
                  ? 'border-primary bg-primary-light ring-2 ring-primary/20'
                  : 'border-theme bg-theme-card'
              }`}
              aria-label={`选择点位图标 ${iconId}`}
            >
              <MapPointIcon iconId={iconId} className="h-9 w-9" />
            </button>
          ))}
        </div>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {draft.kind !== 'character' && draft.kind !== 'monster' && draft.avatarRef && <MapPointMarker point={draft} />}
          <button type="button" onClick={() => imageUploadRef.current?.click()} disabled={uploadingImage} className="inline-flex items-center gap-1 rounded border border-theme px-3 py-1.5 text-sm hover:bg-primary-light disabled:opacity-50">
            <Upload size={15} />{uploadingImage ? '上传中...' : draft.kind === 'character' || draft.kind === 'monster' ? '上传头像 / Token' : '上传点位图像'}
          </button>
          <button type="button" onClick={() => setTokenPickerOpen(true)} className="rounded border border-theme px-3 py-1.5 text-sm hover:bg-primary-light">从资源库选择</button>
          {draft.avatarRef && <button type="button" onClick={() => updateDraft({ avatarRef: '' })} className="rounded border border-theme px-3 py-1.5 text-sm">清除图片</button>}
          <input ref={imageUploadRef} type="file" accept="image/*" className="hidden" onChange={(event) => void handleUploadImage(event.target.files?.[0])} />
        </div>
        {uploadError && <p className="mt-2 text-xs text-red-600">{uploadError}</p>}
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
          disabled={busy || !dirty || !draft.name.trim()}
          className="inline-flex items-center gap-2 rounded bg-primary px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          <Save size={16} />
          保存点位
        </button>
      </div>
      <RelationGraphResourcePickerModal
        open={tokenPickerOpen}
        resources={resourceQuery.data?.items ?? []}
        resourceFolders={resourceQuery.data?.folders ?? []}
        keyword={resourceKeyword}
        selectedFolderPath={resourceFolder}
        expandedFolders={expandedFolders}
        selectedRef={draft.avatarRef}
        loading={resourceQuery.isLoading}
        errorText={resourceQuery.isError ? '资源列表加载失败，请检查后端连接。' : undefined}
        onKeywordChange={setResourceKeyword}
        onSelectFolder={setResourceFolder}
        onToggleFolder={(path) => setExpandedFolders((current) => current.includes(path) ? current.filter((item) => item !== path) : [...current, path])}
        onClose={() => setTokenPickerOpen(false)}
        onSelectResource={(ref) => { updateDraft(draft.kind === 'character' || draft.kind === 'monster' ? { avatarRef: ref, tokenStyle: draft.tokenStyle === 'avatar' ? 'circle' : draft.tokenStyle ?? 'circle' } : { avatarRef: ref }); setTokenPickerOpen(false); }}
        onRetry={() => void resourceQuery.refetch()}
      />
    </section>
  );
};

export default LocationMapPointPanel;
