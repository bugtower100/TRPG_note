import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCampaignData, useCampaignSession } from '../../context/CampaignContext';
import EntityDetailHeader from '../../features/entities/components/EntityDetailHeader';
import SectionedEntityContent from '../../features/entities/components/SectionedEntityContent';
import { useSectionedEntityDetail } from '../../features/entities/hooks/useSectionedEntityDetail';

interface ClueDetailProps {
  entityId?: string;
}

const ClueDetail: React.FC<ClueDetailProps> = ({ entityId }) => {
  const { id: paramId } = useParams<{ id: string }>();
  const id = entityId || paramId;
  const navigate = useNavigate();
  const { campaignData, updateEntity, deleteEntity } = useCampaignData();
  const { saveCampaign } = useCampaignSession();
  const sectionDefs = [
    { key: 'detail', title: '线索详情' },
  ];
  const {
    entity: clue,
    collapsed,
    setCollapsed,
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
    items: campaignData.clues,
    navigate,
    listPath: '/clues',
    initialCollapsed: { detail: true },
    sectionDefs,
    updateItem: (item) => updateEntity('clues', item),
    deleteItem: (itemId) => deleteEntity('clues', itemId),
  });

  if (!clue) return <div>加载中...</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12 px-2 sm:px-0">
      <EntityDetailHeader
        entity={clue}
        entityType="clues"
        backTo="/clues"
        onChange={handleChange}
        allVisibleExpanded={allVisibleExpanded}
        onToggleAll={toggleAllSections}
        onSave={saveCampaign}
        onDelete={() => {
          if (confirm('确定要删除这条线索吗？')) {
            handleDeleteAndNavigate();
          }
        }}
      />

      <SectionedEntityContent
        entity={clue}
        entityType="clues"
        sectionDefs={sectionDefs}
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        onTagsChange={(tags) => handleChange('tags', tags)}
        getSectionTitle={getSectionTitle}
        getSectionItems={getSectionItems}
        onSectionItemsChange={setSectionItems}
        isSectionVisible={isSectionVisible}
        setSectionVisible={setSectionVisible}
        addCustomSection={addCustomSection}
        removeCustomSection={removeCustomSection}
        setSectionTitle={setSectionTitle}
      />
    </div>
  );
};

export default ClueDetail;
