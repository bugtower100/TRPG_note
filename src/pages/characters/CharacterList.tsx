import React from 'react';
import { useCampaign } from '../../context/CampaignContext';
import EntityListLayout from '../../components/common/EntityListLayout';
import { dataService } from '../../services/dataService';
import { useNavigate } from 'react-router-dom';
import { Character } from '../../types';

const CharacterList: React.FC = () => {
  const { campaignData, setCampaignData } = useCampaign();
  const navigate = useNavigate();

  const handleAdd = () => {
    const newCharacter = dataService.createEntity<Character>({
      name: '新角色',
      details: '',
      relatedImages: [],
      identity: '',
      appearance: '',
      desireOrGoal: '',
      attributes: '',
      relations: []
    });

    setCampaignData({
      ...campaignData,
      characters: [...campaignData.characters, newCharacter]
    });

    navigate(`/characters/${newCharacter.id}`);
  };

  return (
    <EntityListLayout
      title="角色列表"
      entities={campaignData.characters}
      entityType="characters"
      onAdd={handleAdd}
    />
  );
};

export default CharacterList;
