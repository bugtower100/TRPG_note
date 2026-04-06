import React from 'react';
import ConfirmDialog from './ConfirmDialog';

interface CollapsibleSectionProps {
  title: string;
  collapsed: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  className?: string;
  removable?: boolean;
  onRemove?: () => void;
  editableTitle?: boolean;
  onRenameTitle?: (title: string) => void;
  sectionTitleLower?: string;
  headerActions?: React.ReactNode;
}

const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  title,
  collapsed,
  onToggle,
  children,
  className = '',
  removable = false,
  onRemove,
  editableTitle = false,
  onRenameTitle,
  sectionTitleLower,
  headerActions,
}) => {
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);

  const handleRename = () => {
    if (!onRenameTitle) return;
    const next = window.prompt('输入新的区块名称', title);
    if (next && next.trim()) {
      onRenameTitle(next.trim());
    }
  };

  const handleRemove = () => {
    if (!onRemove) return;
    setShowDeleteConfirm(true);
  };

  return (
    <section
      data-section-title={sectionTitleLower || title.toLowerCase()}
      data-collapsed={collapsed ? 'true' : 'false'}
      className={`p-3 rounded-lg shadow-sm border theme-card ${className}`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="text-base font-medium">{title}</h3>
          {editableTitle && (
            <button
              type="button"
              onClick={handleRename}
              className="text-xs font-semibold theme-text-secondary hover:text-primary px-2 py-1 border border-theme rounded"
            >
              改名
            </button>
          )}
          <button
            type="button"
            onClick={onToggle}
            data-role="section-toggle"
            className="text-xs font-semibold text-primary hover:text-primary-dark px-2 py-1 border-2 border-primary/30 rounded hover:bg-primary/10"
          >
            {collapsed ? '展开内容 ▼' : '收起内容 ▲'}
          </button>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {headerActions}
          {removable && onRemove && (
            <button
              type="button"
              onClick={handleRemove}
              className="text-xs font-semibold text-red-600 hover:text-red-700 px-2 py-1 border border-red-200 rounded hover:bg-red-50 ml-3 sm:ml-5"
            >
              删除区块
            </button>
          )}
        </div>
      </div>
      {!collapsed && children}
      <ConfirmDialog
        open={showDeleteConfirm}
        title="确认删除区块"
        description={`确定要删除区块「${title}」吗？`}
        confirmText="删除"
        cancelText="取消"
        onCancel={() => setShowDeleteConfirm(false)}
        onConfirm={() => {
          setShowDeleteConfirm(false);
          onRemove?.();
        }}
      />
    </section>
  );
};

export default CollapsibleSection;
