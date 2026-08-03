import React, { useEffect, useState } from 'react';

export const MAP_ICON_IDS = Array.from({ length: 14 }, (_, index) => index + 1);

interface MapPointIconProps {
  iconId: number;
  className?: string;
}

const MapPointIcon: React.FC<MapPointIconProps> = ({ iconId, className = '' }) => {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [iconId]);

  if (failed) {
    return (
      <span className={`inline-flex items-center justify-center rounded-full border-2 border-white bg-primary font-bold text-white shadow ${className}`}>
        {iconId}
      </span>
    );
  }

  return (
    <img
      src={`/mapicon/icon${iconId}.png`}
      alt={`点位图标 ${iconId}`}
      draggable={false}
      onError={() => setFailed(true)}
      className={`object-contain drop-shadow ${className}`}
    />
  );
};

export default MapPointIcon;
