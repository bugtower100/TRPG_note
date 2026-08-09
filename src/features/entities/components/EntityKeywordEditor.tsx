import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Tags, X } from 'lucide-react';

interface EntityKeywordEditorProps {
  entityName: string;
  keywords?: string[];
  onChange: (keywords: string[]) => void;
}

const normalizeKeyword = (value: string) => value.trim().replace(/\s+/g, ' ');

const uniqueKeywords = (values: string[], entityName: string) => {
  const entityNameKey = normalizeKeyword(entityName).toLowerCase();
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const keyword = normalizeKeyword(value);
    const key = keyword.toLowerCase();
    if (!keyword || key === entityNameKey || seen.has(key)) continue;
    seen.add(key);
    result.push(keyword);
  }
  return result;
};

const EntityKeywordEditor: React.FC<EntityKeywordEditorProps> = ({
  entityName,
  keywords = [],
  onChange,
}) => {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const rootRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const normalizedKeywords = useMemo(
    () => uniqueKeywords(keywords, entityName),
    [entityName, keywords]
  );

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener('mousedown', handlePointerDown);
    return () => window.removeEventListener('mousedown', handlePointerDown);
  }, [open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const commitDraft = () => {
    const additions = draft.split(/[,，\n]/).map(normalizeKeyword).filter(Boolean);
    if (additions.length === 0) return;
    onChange(uniqueKeywords([...normalizedKeywords, ...additions], entityName));
    setDraft('');
  };

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={`inline-flex h-9 items-center gap-1.5 rounded-md border px-2.5 text-sm transition-colors ${
          open ? 'border-primary bg-primary-light text-primary' : 'border-theme hover:bg-primary-light'
        }`}
        aria-expanded={open}
        aria-label="配置条目关键词"
        title="配置条目关键词"
      >
        <Tags size={15} />
        <span className="hidden md:inline">关键词</span>
        {normalizedKeywords.length > 0 && (
          <span className="min-w-5 rounded-full bg-primary/10 px-1.5 text-center text-xs">
            {normalizedKeywords.length}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-30 mt-2 w-[min(21rem,calc(100vw-2rem))] rounded-xl border border-theme bg-theme-card p-3 shadow-xl">
          <div className="mb-2">
            <div className="text-sm font-semibold theme-text-primary">链接关键词</div>
            <div className="mt-0.5 text-xs leading-5 theme-text-secondary">
              名称“{entityName || '未命名'}”已自动生效。添加简称或别名后，正文中的这些词也会链接到本条目。
            </div>
          </div>

          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  commitDraft();
                }
                if (event.key === 'Escape') setOpen(false);
              }}
              placeholder="输入简称，回车添加"
              className="min-w-0 flex-1 rounded-md border border-theme bg-transparent px-2.5 py-1.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <button
              type="button"
              onClick={commitDraft}
              disabled={!draft.trim()}
              className="rounded-md bg-primary px-3 py-1.5 text-sm text-white hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-40"
            >
              添加
            </button>
          </div>

          <div className="mt-3 flex min-h-6 flex-wrap gap-1.5">
            {normalizedKeywords.length === 0 ? (
              <span className="text-xs theme-text-secondary">暂无额外关键词</span>
            ) : normalizedKeywords.map((keyword) => (
              <span
                key={keyword.toLowerCase()}
                className="inline-flex max-w-full items-center gap-1 rounded-full border border-theme bg-primary-light px-2 py-1 text-xs"
              >
                <span className="truncate">{keyword}</span>
                <button
                  type="button"
                  onClick={() => onChange(normalizedKeywords.filter((item) => item !== keyword))}
                  className="rounded-full p-0.5 hover:bg-black/10"
                  aria-label={`移除关键词 ${keyword}`}
                >
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default EntityKeywordEditor;
