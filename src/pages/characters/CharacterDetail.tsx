import React, { useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCampaignData, useCampaignSession } from '../../context/CampaignContext';
import EntityDetailHeader from '../../features/entities/components/EntityDetailHeader';
import SectionedEntityContent from '../../features/entities/components/SectionedEntityContent';
import { useSectionedEntityDetail } from '../../features/entities/hooks/useSectionedEntityDetail';
import { Character, CustomSubItem } from '../../types';

interface CharacterDetailProps {
  entityId?: string;
}

const CharacterDetail: React.FC<CharacterDetailProps> = ({ entityId }) => {
  const { id: paramId } = useParams<{ id: string }>();
  const id = entityId || paramId;
  const navigate = useNavigate();
  const { campaignData, deleteEntity, updateEntity } = useCampaignData();
  const { saveCampaign } = useCampaignSession();
  const sectionDefs = [
    { key: 'basic', title: '基本信息' },
    { key: 'goals', title: '属性与目标' },
  ];
  const {
    entity: character,
    collapsed,
    setCollapsed,
    commitEntity,
    handleChange,
    handleDeleteAndNavigate,
    getSectionItems,
    setSectionItems,
    getSectionTitle,
    setSectionTitle,
    isSectionVisible,
    setSectionVisible,
    addCustomSection,
    removeCustomSection,
    allVisibleExpanded,
    toggleAllSections,
  } = useSectionedEntityDetail({
    id,
    items: campaignData.characters,
    navigate,
    listPath: '/characters',
    initialCollapsed: { basic: true, goals: true },
    sectionDefs,
    updateItem: (item) => updateEntity('characters', item),
    deleteItem: (itemId) => deleteEntity('characters', itemId),
  });

  if (!character) return <div>加载中...</div>;

  const setSectionItemsWithDefault = useCallback((key: string, items: CustomSubItem[]) => {
    const updatedCharacter: Character = {
      ...character,
      sectionSubItems: {
        ...(character.sectionSubItems || {}),
        [key]: items,
      },
      details: key === 'basic' ? (items[0]?.content || '') : character.details,
      desireOrGoal: key === 'goals' ? (items[0]?.content || '') : character.desireOrGoal,
    };
    commitEntity(updatedCharacter);
  }, [character, commitEntity]);

  const handleSectionItemsChange = useCallback((key: string, items: CustomSubItem[]) => {
    if (key === 'basic' || key === 'goals') {
      setSectionItemsWithDefault(key, items);
      return;
    }
    setSectionItems(key, items);
  }, [setSectionItems, setSectionItemsWithDefault]);

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12 px-2 sm:px-0">
      <EntityDetailHeader
        entity={character}
        entityType="characters"
        backTo="/characters"
        onChange={handleChange}
        allVisibleExpanded={allVisibleExpanded}
        onToggleAll={toggleAllSections}
        onSave={saveCampaign}
        onDelete={() => {
          if (window.confirm('确定要删除这个角色吗？')) {
            handleDeleteAndNavigate();
          }
        }}
      />

      <SectionedEntityContent
        entity={character}
        entityType="characters"
        sectionDefs={sectionDefs}
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        onTagsChange={(tags) => handleChange('tags', tags)}
        getSectionTitle={getSectionTitle}
        getSectionItems={getSectionItems}
        onSectionItemsChange={handleSectionItemsChange}
        isSectionVisible={isSectionVisible}
        setSectionVisible={setSectionVisible}
        addCustomSection={addCustomSection}
        removeCustomSection={removeCustomSection}
        setSectionTitle={setSectionTitle}
      />
    </div>
  );
};

export default CharacterDetail;
