import React from 'react';
import { createPortal } from 'react-dom';
import { Image, PackageOpen } from 'lucide-react';

interface BackupExportDialogProps {
  open: boolean;
  title: string;
  description?: string;
  onSelect: (includeAssets: boolean) => void;
  onCancel: () => void;
}

const BackupExportDialog: React.FC<BackupExportDialogProps> = ({
  open,
  title,
  description,
  onSelect,
  onCancel,
}) => {
  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[1400] bg-black/45 flex items-center justify-center p-4" onClick={onCancel}>
      <div
        className="w-full max-w-lg bg-theme-card border border-theme rounded-xl shadow-2xl p-5"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 className="text-lg font-semibold">{title}</h3>
        {description && <p className="text-sm theme-text-secondary mt-2">{description}</p>}

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => onSelect(true)}
            className="text-left rounded-xl border border-primary/30 bg-primary/5 hover:bg-primary/10 transition p-4"
          >
            <div className="flex items-center gap-2 text-primary font-medium">
              <Image size={18} />
              <span>完整备份</span>
            </div>
            <div className="mt-2 text-sm theme-text-secondary">
              带图片资源，适合迁移到另一台设备或做完整归档。
            </div>
            <div className="mt-3 text-xs text-primary">包含文字、结构、资源图片</div>
          </button>

          <button
            type="button"
            onClick={() => onSelect(false)}
            className="text-left rounded-xl border border-theme hover:bg-primary-light/40 transition p-4"
          >
            <div className="flex items-center gap-2 font-medium">
              <PackageOpen size={18} />
              <span>轻量备份</span>
            </div>
            <div className="mt-2 text-sm theme-text-secondary">
              不带图片资源，体积更小，适合只保存文字与结构数据。
            </div>
            <div className="mt-3 text-xs theme-text-secondary">仅包含文字、结构，不含图片</div>
          </button>
        </div>

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 rounded border border-theme hover:bg-primary-light text-sm"
          >
            取消
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default BackupExportDialog;
