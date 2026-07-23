import { memo, useEffect, useState } from 'react';
import { Save, Trash2, X } from 'lucide-react';

interface MindMapEdgeDetailsPanelProps {
  parentTitle: string;
  childTitle: string;
  label?: string;
  onClose: () => void;
  onSave: (label: string) => void;
}

const MindMapEdgeDetailsPanel = memo(({
  parentTitle,
  childTitle,
  label,
  onClose,
  onSave,
}: MindMapEdgeDetailsPanelProps) => {
  const [draft, setDraft] = useState(label || '');

  useEffect(() => {
    setDraft(label || '');
  }, [label, parentTitle, childTitle]);

  return (
    <aside
      className="mind-map-edge-details-panel absolute bottom-3 left-1/2 z-20 w-[min(92%,26rem)] -translate-x-1/2 rounded-xl border border-theme bg-theme-card p-4 shadow-xl"
      aria-label="箭头描述编辑"
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">箭头描述</h3>
          <p className="mt-1 truncate text-xs theme-text-secondary">
            {parentTitle} → {childTitle}
          </p>
        </div>
        <button
          type="button"
          className="rounded p-1 theme-text-secondary hover:bg-primary-light"
          aria-label="关闭箭头描述编辑"
          onClick={onClose}
        >
          <X size={17} aria-hidden="true" />
        </button>
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSave(draft);
        }}
      >
        <label className="block">
          <span className="mb-1 block text-xs theme-text-secondary">文字描述</span>
          <input
            autoFocus
            type="text"
            maxLength={120}
            value={draft}
            placeholder="例如：导致、支持、需要调查"
            className="w-full rounded border border-theme bg-theme px-3 py-2 text-sm outline-none focus:border-primary"
            onChange={(event) => setDraft(event.target.value)}
          />
        </label>
        <div className="mt-3 flex items-center justify-between gap-2">
          <span className="text-xs theme-text-secondary">{draft.length}/120</span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={!label}
              className="inline-flex items-center gap-1.5 rounded border border-red-300 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
              onClick={() => onSave('')}
            >
              <Trash2 size={15} aria-hidden="true" />
              清空
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded bg-primary px-3 py-1.5 text-sm text-white hover:bg-primary-dark"
            >
              <Save size={15} aria-hidden="true" />
              保存
            </button>
          </div>
        </div>
      </form>
    </aside>
  );
});

MindMapEdgeDetailsPanel.displayName = 'MindMapEdgeDetailsPanel';

export default MindMapEdgeDetailsPanel;
