import React from 'react';
import { useCampaign } from '../../context/CampaignContext';
import EntityListLayout from '../../components/common/EntityListLayout';
import { dataService } from '../../services/dataService';
import { useNavigate } from 'react-router-dom';
import { Timeline } from '../../types';
import { useReceivedShares } from '../../hooks/useReceivedShares';

const TimelineList: React.FC = () => {
  const { campaignData, setCampaignData } = useCampaign();
  const navigate = useNavigate();
  const sharedEntries = useReceivedShares('timelines');

  const handleAdd = () => {
    const newTimeline = dataService.createEntity<Timeline>({
      name: '新时间线',
      details: '',
      relatedImages: [],
      timelineEvents: [],
    });

    setCampaignData({
      ...campaignData,
      timelines: [...campaignData.timelines, newTimeline]
    });

    navigate(`/timelines/${newTimeline.id}`);
  };

  return (
    <EntityListLayout
      title="时间线列表"
      entities={campaignData.timelines}
      entityType="timelines"
      onAdd={handleAdd}
      sharedEntries={sharedEntries}
    />
  );
};

export default TimelineList;
