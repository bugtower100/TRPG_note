import React from 'react';
import type { LocationMapPoint } from '../../../types';
import { buildResourceFileUrl } from '../../../services/resourceService';
import MapPointIcon from './MapPointIcon';

const MapPointMarker: React.FC<{ point: LocationMapPoint; className?: string; size?: number }> = ({ point, className = 'h-9 w-9 sm:h-10 sm:w-10', size }) => {
  const sizeStyle = size ? { width: size, height: size } : undefined;
  if (point.kind !== 'character' && point.kind !== 'monster') {
    if (point.avatarRef) {
      return <img src={buildResourceFileUrl(point.avatarRef)} alt="" draggable={false} className={`object-contain drop-shadow ${className}`} style={sizeStyle} />;
    }
    return size
      ? <span className={`inline-flex items-center justify-center ${className}`} style={sizeStyle}><MapPointIcon iconId={point.iconId} className="h-full w-full" /></span>
      : <MapPointIcon iconId={point.iconId} className={className} />;
  }
  if (point.tokenStyle === 'token' && point.avatarRef) {
    return <img src={buildResourceFileUrl(point.avatarRef)} alt="" draggable={false} className={`object-contain drop-shadow ${className}`} style={sizeStyle} />;
  }
  return (
    <span className={`inline-flex items-center justify-center overflow-hidden border-2 border-white bg-primary text-sm font-bold text-white shadow ${point.tokenStyle === 'square' ? 'rounded-md' : 'rounded-full'} ${className}`} style={sizeStyle}>
      {point.avatarRef
        ? <img src={buildResourceFileUrl(point.avatarRef)} alt="" draggable={false} className="h-full w-full object-cover" />
        : point.name.slice(0, 1)}
    </span>
  );
};

export default MapPointMarker;
