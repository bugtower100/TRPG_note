import React from 'react';
import { useParams } from 'react-router-dom';
import { GraphEntityType } from '../types';
import SharedContent from './SharedContent';

interface SharedEntityDetailRouteProps {
  entityType: GraphEntityType;
}

const SharedEntityDetailRoute: React.FC<SharedEntityDetailRouteProps> = ({ entityType }) => {
  const { shareId } = useParams<{ shareId: string }>();

  if (!shareId) {
    return <div className="theme-text-secondary">未找到共享内容</div>;
  }

  return <SharedContent embedded shareId={shareId} entityType={entityType} />;
};

export default SharedEntityDetailRoute;
