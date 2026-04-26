import React, { useMemo, useState } from 'react';

interface EntityTagEditorProps {
  tags?: string[];
  onChange: (nextTags: string[]) => void;
  disabled?: boolean;
}

const normalizeTag = (raw: string): string => raw.trim().replace(/\s+/g, ' ');

const uniqTags = (input: string[]): string[] => {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of input) {
    const next = normalizeTag(value);
    if (!next) continue;
    const key = next.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(next);
  }
  return result;
};

const EntityTagEditor: React.FC<EntityTagEditorProps> = ({ tags = [], onChange, disabled = false }) => {
  const [draft, setDraft] = useState('');
  const normalizedTags = useMemo(() => uniqTags(tags), [tags]);

  const commitDraft = () => {
    if (!draft.trim()) return;
    const nextItems = draft
      .split(/[,，]/)
      .map((item) => normalizeTag(item))
      .filter(Boolean);
    if (nextItems.length === 0) {
      setDraft('');
      return;
    }
    onChange(uniqTags([...normalizedTags, ...nextItems]));
    setDraft('');
  };

  const removeTag = (target: string) => {
    onChange(normalizedTags.filter((item) => item.toLowerCase() !== target.toLowerCase()));
  };

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium theme-text-secondary">标签</label>
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              commitDraft();
            }
          }}
          placeholder="输入标签后回车，可用逗号批量添加"
          disabled={disabled}
          className="flex-1 px-3 py-2 border border-theme rounded-md bg-transparent focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
        />
        <button
          type="button"
          onClick={commitDraft}
          disabled={disabled}
          className="px-3 py-2 bg-primary text-white rounded-md hover:bg-primary-dark transition-colors whitespace-nowrap"
        >
          添加标签
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {normalizedTags.length === 0 ? (
          <span className="text-xs theme-text-secondary">暂无标签</span>
        ) : (
          normalizedTags.map((tag) => (
            <button
              key={tag}
              type="button"
              disabled={disabled}
              onClick={() => removeTag(tag)}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded border border-theme bg-theme-card hover:border-primary hover:text-primary"
              title="点击移除标签"
            >
              <span>{tag}</span>
              <span>×</span>
            </button>
          ))
        )}
      </div>
    </div>
  );
};

export default EntityTagEditor;
