import React from 'react';
import { useCampaign } from '../../context/CampaignContext';
import EntityListLayout from '../../components/common/EntityListLayout';
import { dataService } from '../../services/dataService';
import { useNavigate } from 'react-router-dom';
import { Monster } from '../../types';
import { useReceivedShares } from '../../hooks/useReceivedShares';

const MonsterList: React.FC = () => {
  const { campaignData, setCampaignData } = useCampaign();
  const navigate = useNavigate();
  const sharedEntries = useReceivedShares('monsters');

  const handleAdd = () => {
    const newMonster = dataService.createEntity<Monster>({
      name: '新怪物',
      details: '',
      relatedImages: [],
      type: '',
      stats: '',
      abilities: '',
      drops: '',
      relations: []
    });

    setCampaignData({
      ...campaignData,
      monsters: [...campaignData.monsters, newMonster]
    });

    navigate(`/monsters/${newMonster.id}`);
  };

  return (
    <EntityListLayout
      title="怪物图鉴"
      entities={campaignData.monsters}
      entityType="monsters"
      onAdd={handleAdd}
      sharedEntries={sharedEntries}
    />
  );
};

export default MonsterList;
