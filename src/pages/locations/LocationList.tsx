import React from 'react';
import { useCampaignData } from '../../context/CampaignContext';
import EntityListLayout from '../../components/common/EntityListLayout';
import { dataService } from '../../services/dataService';
import { useNavigate } from 'react-router-dom';
import { Location } from '../../types';
import { useReceivedShares } from '../../hooks/useReceivedShares';

const LocationList: React.FC = () => {
  const { campaignData, setCampaignData, reorderEntities } = useCampaignData();
  const navigate = useNavigate();
  const sharedEntries = useReceivedShares('locations');

  const handleAdd = () => {
    const newLocation = dataService.createEntity<Location>({
      name: '新地点',
      details: '',
      relatedImages: [],
      environment: '',
      relations: []
    });

    setCampaignData({
      ...campaignData,
      locations: [...campaignData.locations, newLocation]
    });

    navigate(`/locations/${newLocation.id}`);
  };

  return (
    <EntityListLayout
      title="地点列表"
      entities={campaignData.locations}
      entityType="locations"
      onAdd={handleAdd}
      onReorder={(orderedIds) => reorderEntities('locations', orderedIds)}
      sharedEntries={sharedEntries}
    />
  );
};

export default LocationList;
