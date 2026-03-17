import React from 'react';
import { useCampaign } from '../../context/CampaignContext';
import EntityListLayout from '../../components/common/EntityListLayout';
import { dataService } from '../../services/dataService';
import { useNavigate } from 'react-router-dom';
import { Location } from '../../types';

const LocationList: React.FC = () => {
  const { campaignData, setCampaignData } = useCampaign();
  const navigate = useNavigate();

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
    />
  );
};

export default LocationList;
