import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCampaignData, useCampaignSession } from '../../context/CampaignContext';
import EntityDetailHeader from '../../features/entities/components/EntityDetailHeader';
import SectionedEntityContent from '../../features/entities/components/SectionedEntityContent';
import { useSectionedEntityDetail } from '../../features/entities/hooks/useSectionedEntityDetail';
import { useCampaignMemberRole } from '../../hooks/useCampaignMemberRole';

interface EventDetailProps {
  entityId?: string;
}

const EventDetail: React.FC<EventDetailProps> = ({ entityId }) => {
  const { id: paramId } = useParams<{ id: string }>();
  const id = entityId || paramId;
  const navigate = useNavigate();
  const { campaignData, updateEntity, deleteEntity } = useCampaignData();
  const { saveCampaign } = useCampaignSession();
  const { canManageCampaignContent } = useCampaignMemberRole();
  const sectionDefs = [
    { key: 'detail', title: '事件详情' },
  ];
  const {
    entity: event,
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
    items: canManageCampaignContent ? campaignData.events : [],
    navigate,
    listPath: '/events',
    initialCollapsed: { detail: true },
    sectionDefs,
    updateItem: (item) => updateEntity('events', item),
    deleteItem: (itemId) => deleteEntity('events', itemId),
  });

  if (!event) return <div>加载中...</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12 px-2 sm:px-0">
      <EntityDetailHeader
        entity={event}
        entityType="events"
        backTo="/events"
        onChange={handleChange}
        allVisibleExpanded={allVisibleExpanded}
        onToggleAll={toggleAllSections}
        onSave={saveCampaign}
        onDelete={() => {
          if (window.confirm('确定要删除这个事件吗？')) {
            handleDeleteAndNavigate();
          }
        }}
      />

      <SectionedEntityContent
        entity={event}
        entityType="events"
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

export default EventDetail;
