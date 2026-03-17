import React from 'react';
import { useCampaign } from '../../context/CampaignContext';
import EntityListLayout from '../../components/common/EntityListLayout';
import { dataService } from '../../services/dataService';
import { useNavigate } from 'react-router-dom';
import { Event } from '../../types';

const EventList: React.FC = () => {
  const { campaignData, setCampaignData } = useCampaign();
  const navigate = useNavigate();

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
      entities={campaignData.events}
      entityType="events"
      onAdd={handleAdd}
    />
  );
};

export default EventList;
