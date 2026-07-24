import React, { useEffect, useRef, useState } from 'react';
import { Check, Pencil, X } from 'lucide-react';

interface CampaignNameEditorProps {
  name: string;
  canEdit: boolean;
  onSave: (name: string) => Promise<void>;
  nameClassName?: string;
}

const CampaignNameEditor: React.FC<CampaignNameEditorProps> = ({
  name,
  canEdit,
  onSave,
  nameClassName = '',
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editing) {
      setDraft(name);
    }
  }, [editing, name]);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const cancel = () => {
    if (saving) return;
    setDraft(name);
    setEditing(false);
  };

  const save = async () => {
    const normalized = draft.trim();
    if (!normalized) {
      window.alert('模组名字不能为空。');
      return;
    }
    if (normalized === name) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onSave(normalized);
      setEditing(false);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : '模组名字修改失败，请稍后重试。');
    } finally {
      setSaving(false);
    }
  };

  if (!editing) {
    return (
      <span className="flex min-w-0 items-center gap-1.5">
        <span className={nameClassName}>{name}</span>
        {canEdit && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="shrink-0 rounded p-1 theme-text-secondary hover:bg-primary-light hover:text-primary"
            title="修改模组名字"
            aria-label={`修改模组名字：${name}`}
          >
            <Pencil size={14} aria-hidden="true" />
          </button>
        )}
      </span>
    );
  }

  return (
    <span className="flex min-w-0 items-center gap-1.5">
      <input
        ref={inputRef}
        value={draft}
        maxLength={100}
        disabled={saving}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            void save();
          } else if (event.key === 'Escape') {
            event.preventDefault();
            cancel();
          }
        }}
        className="min-w-0 max-w-full rounded border border-theme bg-transparent px-2 py-1 text-base font-semibold focus:outline-none focus:ring-2 focus:ring-primary/40"
        aria-label="模组名字"
      />
      <button
        type="button"
        onClick={() => void save()}
        disabled={saving}
        className="shrink-0 rounded p-1 text-green-600 hover:bg-green-50 disabled:opacity-50"
        title="保存名字"
        aria-label="保存模组名字"
      >
        <Check size={15} aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={cancel}
        disabled={saving}
        className="shrink-0 rounded p-1 theme-text-secondary hover:bg-primary-light disabled:opacity-50"
        title="取消修改"
        aria-label="取消修改模组名字"
      >
        <X size={15} aria-hidden="true" />
      </button>
    </span>
  );
};

export default CampaignNameEditor;
