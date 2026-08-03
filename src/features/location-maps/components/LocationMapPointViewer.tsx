import React from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import type { LocationMapPoint } from '../../../types';
import MapPointIcon from './MapPointIcon';

interface LocationMapPointViewerProps {
  point: LocationMapPoint | null;
  onClose: () => void;
}

const LocationMapPointViewer: React.FC<LocationMapPointViewerProps> = ({ point, onClose }) => {
  if (!point) return null;

  return createPortal(
    <div className="fixed inset-0 z-[1400] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${point.name}的点位介绍`}
        className="w-full max-w-md rounded-lg border border-theme bg-theme-card p-5 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <MapPointIcon iconId={point.iconId} className="h-12 w-12 shrink-0" />
            <h3 className="truncate text-lg font-semibold">{point.name}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-theme p-1.5 hover:bg-primary-light"
            aria-label="关闭"
          >
            <X size={17} />
          </button>
        </div>
        <div className="mt-4 whitespace-pre-wrap text-sm leading-6 theme-text-secondary">
          {point.introduction.trim() || 'GM 暂未填写此地点的介绍。'}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default LocationMapPointViewer;
