import React from 'react';
import { createPortal } from 'react-dom';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title,
  description,
  confirmText = '确认',
  cancelText = '取消',
  onConfirm,
  onCancel,
}) => {
  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[1400] bg-black/50 flex items-center justify-center p-4" onClick={onCancel}>
      <div
        className="w-full max-w-sm bg-theme-card border border-theme rounded-lg shadow-xl p-4"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 className="text-base font-semibold mb-2">{title}</h3>
        {description && <p className="text-sm theme-text-secondary mb-4">{description}</p>}
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 rounded border border-theme hover:bg-primary-light text-sm"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-3 py-1.5 rounded border border-red-300 text-red-600 hover:bg-red-50 text-sm"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ConfirmDialog;
