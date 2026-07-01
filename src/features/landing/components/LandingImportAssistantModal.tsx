import React, { lazy, Suspense } from 'react';
import { X } from 'lucide-react';

const ImportAssistant = lazy(() => import('../../../pages/ImportAssistant'));

const modalFallback = (
  <div className="p-5 text-sm theme-text-secondary">正在加载导入助手...</div>
);

interface LandingImportAssistantModalProps {
  open: boolean;
  onClose: () => void;
}

const LandingImportAssistantModal: React.FC<LandingImportAssistantModalProps> = ({ open, onClose }) => {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-6xl max-h-[90vh] overflow-y-auto rounded-xl border border-theme theme-card shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-theme theme-card px-5 py-4">
          <div>
            <h2 className="text-xl font-bold text-theme-primary">导入助手</h2>
            <p className="mt-1 text-sm theme-text-secondary">
              可直接从主页导入新版备份包；旧版 JSON 兼容导入仍在设置页中提供。
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-theme p-2 theme-text-secondary hover:bg-primary-light"
            aria-label="关闭导入助手"
          >
            <X size={18} />
          </button>
        </div>
        <Suspense fallback={modalFallback}>
          <div className="p-5">
            <ImportAssistant allowLegacyJsonImport={false} />
          </div>
        </Suspense>
      </div>
    </div>
  );
};

export default LandingImportAssistantModal;
