import React, { lazy, Suspense } from 'react';

const CharacterDetail = lazy(() => import('../../pages/characters/CharacterDetail'));
const MonsterDetail = lazy(() => import('../../pages/monsters/MonsterDetail'));
const LocationDetail = lazy(() => import('../../pages/locations/LocationDetail'));
const OrganizationDetail = lazy(() => import('../../pages/organizations/OrganizationDetail'));
const EventDetail = lazy(() => import('../../pages/events/EventDetail'));
const ClueDetail = lazy(() => import('../../pages/clues/ClueDetail'));
const TimelineDetail = lazy(() => import('../../pages/timelines/TimelineDetail'));
const SharedContent = lazy(() => import('../../pages/SharedContent'));

const detailFallback = (
  <div className="py-8 text-center text-sm theme-text-secondary">正在加载详情...</div>
);

interface EntityDetailViewProps {
  type: string;
  entityId: string;
}

const EntityDetailView: React.FC<EntityDetailViewProps> = ({ type, entityId }) => {
  if (entityId.startsWith('shared:')) {
    const shareId = entityId.slice('shared:'.length);
    return (
      <Suspense fallback={detailFallback}>
        <SharedContent embedded shareId={shareId} entityType={type as never} />
      </Suspense>
    );
  }
  return (
    <Suspense fallback={detailFallback}>
      {type === 'characters' ? <CharacterDetail entityId={entityId} /> : null}
      {type === 'monsters' ? <MonsterDetail entityId={entityId} /> : null}
      {type === 'locations' ? <LocationDetail entityId={entityId} /> : null}
      {type === 'organizations' ? <OrganizationDetail entityId={entityId} /> : null}
      {type === 'events' ? <EventDetail entityId={entityId} /> : null}
      {type === 'clues' ? <ClueDetail entityId={entityId} /> : null}
      {type === 'timelines' ? <TimelineDetail entityId={entityId} /> : null}
      {!['characters', 'monsters', 'locations', 'organizations', 'events', 'clues', 'timelines'].includes(type) ? (
        <div>未知类型</div>
      ) : null}
    </Suspense>
  );
};

export default EntityDetailView;
