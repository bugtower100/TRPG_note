import React, { useEffect, useMemo, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import RichTextEditor from './RichTextEditor';
import RichTextDisplay from './RichTextDisplay';
import ConfirmDialog from './ConfirmDialog';
import { CustomSubItem } from '../../types';

interface CustomSubItemsEditorProps {
  items: CustomSubItem[];
  onChange: (items: CustomSubItem[]) => void;
  title?: string;
  defaultFirstItemTitle?: string;
  ensureOneItem?: boolean;
  renderItemActions?: (item: CustomSubItem) => React.ReactNode;
  useNativeDeleteConfirm?: boolean;
}

const CustomSubItemsEditor: React.FC<CustomSubItemsEditorProps> = ({
  items,
  onChange,
  title = '子项目',
  defaultFirstItemTitle = '详细情况',
  ensureOneItem = false,
  renderItemActions,
  useNativeDeleteConfirm = false,
}) => {
  const [search, setSearch] = useState('');
  const [removingItem, setRemovingItem] = useState<CustomSubItem | null>(null);
  const [editingIds, setEditingIds] = useState<string[]>([]);

  useEffect(() => {
    if (ensureOneItem && items.length === 0) {
      onChange([
        {
          id: uuidv4(),
          title: defaultFirstItemTitle,
          content: '',
        },
      ]);
    }
  }, [ensureOneItem, items.length, onChange, defaultFirstItemTitle]);

  useEffect(() => {
    if (!removingItem) return;
    const stillExists = items.some((item) => item.id === removingItem.id);
    if (!stillExists) setRemovingItem(null);
  }, [items, removingItem]);

  useEffect(() => {
    setEditingIds((prev) => prev.filter((id) => items.some((item) => item.id === id)));
  }, [items]);

  const toggleCollapse = (id: string) => {
    const next = items.map((item) =>
      item.id === id ? { ...item, collapsed: !item.collapsed } : item
    );
    setEditingIds((prev) => prev.filter((editingId) => editingId !== id));
    onChange(next);
  };

  const addItem = () => {
    const newItem = {
      id: uuidv4(),
      title: '新子项目',
      content: ''
    } as CustomSubItem;
    setEditingIds((prev) => [...prev, newItem.id]);
    onChange([
      ...items,
      newItem,
    ]);
  };

  const updateItem = (id: string, patch: Partial<CustomSubItem>) => {
    onChange(items.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const removeItem = (id: string) => {
    const target = items.find((item) => item.id === id);
    if (!target) return;
    if (useNativeDeleteConfirm) {
      if (window.confirm(`确定要删除子项目「${target.title || '未命名子项目'}」吗？`)) {
        onChange(items.filter((item) => item.id !== target.id));
      }
      return;
    }
    setRemovingItem(target);
  };

  const startEditing = (id: string) => {
    setEditingIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  };

  const stopEditing = (id: string) => {
    setEditingIds((prev) => prev.filter((editingId) => editingId !== id));
  };

  const filteredItems = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return items;
    return items.filter(
      (item) =>
        item.title.toLowerCase().includes(keyword) ||
        (item.content || '').toLowerCase().includes(keyword)
    );
  }, [items, search]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-medium">{title}</h3>
          <span className="text-xs theme-text-secondary">共 {items.length} 项</span>
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索子项目..."
            className="px-2 py-1.5 text-sm border border-theme rounded bg-transparent min-w-[140px] flex-1 md:flex-none"
          />
          <button
            type="button"
            onClick={addItem}
            className="px-3 py-1.5 bg-primary text-white rounded hover:bg-primary-dark text-sm w-full md:w-auto justify-center"
          >
            + 添加子项目
          </button>
        </div>
      </div>
      {items.length === 0 && (
        <div className="text-sm theme-text-secondary p-3 border border-dashed border-theme rounded">
          暂无子项目，点击上方按钮添加。
        </div>
      )}
      {items.length > 0 && filteredItems.length === 0 && (
        <div className="text-sm theme-text-secondary p-3 border border-dashed border-theme rounded">
          未找到匹配的子项目。
        </div>
      )}
      {filteredItems.map((item) => {
        const collapsed = Boolean(item.collapsed);
        const isEditing = editingIds.includes(item.id);
        return (
          <div
            key={item.id}
            data-subitem-id={item.id}
            data-subitem-title={item.title.toLowerCase()}
            className="border border-theme rounded-lg p-3 bg-theme-card"
          >
            <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 mb-2">
              <button
                type="button"
                onClick={() => toggleCollapse(item.id)}
                className="text-xs theme-text-secondary hover:text-primary px-2 py-1 border border-theme rounded"
              >
                {collapsed ? '展开' : '收起'}
              </button>
              {isEditing ? (
                <input
                  type="text"
                  value={item.title}
                  onChange={(e) => updateItem(item.id, { title: e.target.value })}
                  className="flex-1 min-w-[180px] p-2 border border-theme rounded focus:outline-none focus:border-primary bg-transparent"
                  placeholder="子项目标题"
                />
              ) : (
                <div className="flex-1 min-w-[180px] px-1 py-2 font-medium break-words">
                  {item.title || '未命名子项目'}
                </div>
              )}
              {!collapsed && (
                <button
                  type="button"
                  onClick={() => (isEditing ? stopEditing(item.id) : startEditing(item.id))}
                  className={`text-xs px-2 py-1 rounded border ${
                    isEditing
                      ? 'border-primary/40 text-primary hover:bg-primary/10'
                      : 'border-theme theme-text-secondary hover:text-primary'
                  }`}
                >
                  {isEditing ? '结束编辑' : '开始编辑'}
                </button>
              )}
              {renderItemActions?.(item)}
              <button
                type="button"
                onClick={() => removeItem(item.id)}
                className="text-xs text-red-500 hover:text-red-700 px-2 py-1 border border-red-200 rounded hover:bg-red-50 ml-3 sm:ml-5"
              >
                删除
              </button>
            </div>
            {!collapsed && (
              isEditing ? (
                <RichTextEditor
                  value={item.content}
                  onChange={(val) => updateItem(item.id, { content: val })}
                  placeholder="子项目内容..."
                  minHeight="100px"
                />
              ) : (
                <div className="border border-theme rounded-md bg-theme-card/60 px-3 py-3 min-h-[96px]">
                  {item.content?.trim() ? (
                    <RichTextDisplay content={item.content} />
                  ) : (
                    <div className="text-sm theme-text-secondary">暂无内容，点击“开始编辑”补充。</div>
                  )}
                </div>
              )
            )}
          </div>
        );
      })}
      {!useNativeDeleteConfirm && (
        <ConfirmDialog
          open={Boolean(removingItem)}
          title="确认删除子项目"
          description={`确定要删除子项目「${removingItem?.title || '未命名子项目'}」吗？`}
          confirmText="删除"
          cancelText="取消"
          onCancel={() => setRemovingItem(null)}
          onConfirm={() => {
            if (!removingItem) return;
            onChange(items.filter((item) => item.id !== removingItem.id));
            setRemovingItem(null);
          }}
        />
      )}
    </div>
  );
};

export default CustomSubItemsEditor;
