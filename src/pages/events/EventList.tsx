import React from 'react';
import { useCampaignData } from '../../context/CampaignContext';
import EntityListLayout from '../../components/common/EntityListLayout';
import { dataService } from '../../services/dataService';
import { useNavigate } from 'react-router-dom';
import { Event } from '../../types';
import { useReceivedShares } from '../../hooks/useReceivedShares';
import { useCampaignMemberRole } from '../../hooks/useCampaignMemberRole';

const EventList: React.FC = () => {
  const { campaignData, setCampaignData, reorderEntities } = useCampaignData();
  const navigate = useNavigate();
  const sharedEntries = useReceivedShares('events');
  const { canManageCampaignContent } = useCampaignMemberRole();
  const visibleEvents = canManageCampaignContent ? campaignData.events : [];

  const handleAdd = () => {
    const newEvent = dataService.createEntity<Event>({
      name: '新事件',
      details: '',
      relatedImages: [],
      time: '',
      relations: []
    });

    setCampaignData({
      ...campaignData,
      events: [...campaignData.events, newEvent]
    });

    navigate(`/events/${newEvent.id}`);
  };

  return (
    <EntityListLayout
      title="事件列表"
      entities={visibleEvents}
      entityType="events"
      onAdd={canManageCampaignContent ? handleAdd : undefined}
      onReorder={canManageCampaignContent ? ((orderedIds) => reorderEntities('events', orderedIds)) : undefined}
      sharedEntries={sharedEntries}
    />
  );
};

export default EventList;
