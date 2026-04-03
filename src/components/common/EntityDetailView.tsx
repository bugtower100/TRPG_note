import React from 'react';
import CharacterDetail from '../../pages/characters/CharacterDetail';
import MonsterDetail from '../../pages/monsters/MonsterDetail';
import LocationDetail from '../../pages/locations/LocationDetail';
import OrganizationDetail from '../../pages/organizations/OrganizationDetail';
import EventDetail from '../../pages/events/EventDetail';
import ClueDetail from '../../pages/clues/ClueDetail';
import TimelineDetail from '../../pages/timelines/TimelineDetail';

interface EntityDetailViewProps {
  type: string;
  entityId: string;
}

const EntityDetailView: React.FC<EntityDetailViewProps> = ({ type, entityId }) => {
  switch (type) {
    case 'characters': return <CharacterDetail entityId={entityId} />;
    case 'monsters': return <MonsterDetail entityId={entityId} />;
    case 'locations': return <LocationDetail entityId={entityId} />;
    case 'organizations': return <OrganizationDetail entityId={entityId} />;
    case 'events': return <EventDetail entityId={entityId} />;
    case 'clues': return <ClueDetail entityId={entityId} />;
    case 'timelines': return <TimelineDetail entityId={entityId} />;
    default: return <div>未知类型</div>;
  }
};

export default EntityDetailView;
