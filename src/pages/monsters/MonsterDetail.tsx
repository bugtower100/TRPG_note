import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCampaignData, useCampaignSession } from '../../context/CampaignContext';
import EntityDetailHeader from '../../features/entities/components/EntityDetailHeader';
import SectionedEntityContent from '../../features/entities/components/SectionedEntityContent';
import { useSectionedEntityDetail } from '../../features/entities/hooks/useSectionedEntityDetail';

interface MonsterDetailProps {
  entityId?: string;
}

const MonsterDetail: React.FC<MonsterDetailProps> = ({ entityId }) => {
  const { id: paramId } = useParams<{ id: string }>();
  const id = entityId || paramId;
  const navigate = useNavigate();
  const { campaignData, updateEntity, deleteEntity } = useCampaignData();
  const { saveCampaign } = useCampaignSession();
  const sectionDefs = [
    { key: 'basic', title: '基本信息' },
    { key: 'combat', title: '数据与掉落' },
  ];
  const {
    entity: monster,
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
    items: campaignData.monsters,
    navigate,
    listPath: '/monsters',
    initialCollapsed: { basic: true, combat: true },
    sectionDefs,
    updateItem: (item) => updateEntity('monsters', item),
    deleteItem: (itemId) => deleteEntity('monsters', itemId),
  });

  if (!monster) return <div>加载中...</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12 px-2 sm:px-0">
      <EntityDetailHeader
        entity={monster}
        entityType="monsters"
        backTo="/monsters"
        onChange={handleChange}
        allVisibleExpanded={allVisibleExpanded}
        onToggleAll={toggleAllSections}
        onSave={saveCampaign}
        onDelete={() => {
          if (confirm('确定要删除这个怪物吗？')) {
            handleDeleteAndNavigate();
          }
        }}
      />

      <SectionedEntityContent
        entity={monster}
        entityType="monsters"
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

export default MonsterDetail;
