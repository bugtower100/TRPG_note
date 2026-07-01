import React from 'react';
import { useCampaignData } from '../../context/CampaignContext';
import EntityListLayout from '../../components/common/EntityListLayout';
import { dataService } from '../../services/dataService';
import { useNavigate } from 'react-router-dom';
import { Character } from '../../types';
import { useReceivedShares } from '../../hooks/useReceivedShares';
import { useCampaignMemberRole } from '../../hooks/useCampaignMemberRole';

const CharacterList: React.FC = () => {
  const { campaignData, setCampaignData, reorderEntities } = useCampaignData();
  const navigate = useNavigate();
  const sharedEntries = useReceivedShares('characters');
  const { canManageCampaignContent } = useCampaignMemberRole();
  const visibleCharacters = canManageCampaignContent ? campaignData.characters : [];

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
      entities={visibleCharacters}
      entityType="characters"
      onAdd={canManageCampaignContent ? handleAdd : undefined}
      onReorder={canManageCampaignContent ? ((orderedIds) => reorderEntities('characters', orderedIds)) : undefined}
      sharedEntries={sharedEntries}
    />
  );
};

export default CharacterList;
