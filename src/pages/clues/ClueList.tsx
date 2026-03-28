import React from 'react';
import { useCampaign } from '../../context/CampaignContext';
import EntityListLayout from '../../components/common/EntityListLayout';
import { dataService } from '../../services/dataService';
import { useNavigate } from 'react-router-dom';
import { Clue } from '../../types';

const ClueList: React.FC = () => {
  const { campaignData, setCampaignData } = useCampaign();
  const navigate = useNavigate();

  const handleAdd = () => {
    const newClue = dataService.createEntity<Clue>({
      name: '新线索',
      details: '',
      relatedImages: [],
      type: '普通',
      relations: []
    });

    setCampaignData({
      ...campaignData,
      clues: [...campaignData.clues, newClue]
    });

    navigate(`/clues/${newClue.id}`);
  };

  return (
    <EntityListLayout
      title="线索列表"
      entities={campaignData.clues}
      entityType="clues"
      onAdd={handleAdd}
    />
  );
};

export default ClueList;
