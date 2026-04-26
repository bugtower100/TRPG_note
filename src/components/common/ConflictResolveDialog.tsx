import React from 'react';
import { createPortal } from 'react-dom';

interface ConflictResolveDialogProps {
  open: boolean;
  title: string;
  description?: string;
  localSummary: string;
  remoteSummary: string;
  overwriteText?: string;
  useRemoteText?: string;
  onOverwrite: () => void;
  onUseRemote: () => void;
  onCancel: () => void;
}

const ConflictResolveDialog: React.FC<ConflictResolveDialogProps> = ({
  open,
  title,
  description,
  localSummary,
  remoteSummary,
  overwriteText = '覆盖为我的内容',
  useRemoteText = '使用远端版本',
  onOverwrite,
  onUseRemote,
  onCancel,
}) => {
  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[1450] bg-black/50 flex items-center justify-center p-4" onClick={onCancel}>
      <div
        className="w-full max-w-2xl bg-theme-card border border-theme rounded-lg shadow-xl p-4 space-y-3"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 className="text-base font-semibold">{title}</h3>
        {description && <p className="text-sm theme-text-secondary">{description}</p>}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <section className="border border-theme rounded p-3">
            <div className="text-xs theme-text-secondary mb-2">你的草稿</div>
            <div className="text-sm whitespace-pre-wrap break-words">{localSummary || '（空）'}</div>
          </section>
          <section className="border border-theme rounded p-3">
            <div className="text-xs theme-text-secondary mb-2">远端最新</div>
            <div className="text-sm whitespace-pre-wrap break-words">{remoteSummary || '（空）'}</div>
          </section>
        </div>
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 rounded border border-theme hover:bg-primary-light text-sm"
          >
            稍后处理
          </button>
          <button
            type="button"
            onClick={onUseRemote}
            className="px-3 py-1.5 rounded border border-theme hover:bg-primary-light text-sm"
          >
            {useRemoteText}
          </button>
          <button
            type="button"
            onClick={onOverwrite}
            className="px-3 py-1.5 rounded bg-primary text-white hover:bg-primary-dark text-sm"
          >
            {overwriteText}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ConflictResolveDialog;
