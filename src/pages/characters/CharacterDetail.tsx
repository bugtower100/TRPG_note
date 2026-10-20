import React, { useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useCampaignData, useCampaignSession } from '../../context/CampaignContext';
import EntityDetailHeader from '../../features/entities/components/EntityDetailHeader';
import SectionedEntityContent from '../../features/entities/components/SectionedEntityContent';
import { useSectionedEntityDetail } from '../../features/entities/hooks/useSectionedEntityDetail';
import { Character, CustomSubItem } from '../../types';
import { queryKeys } from '../../query/queryKeys';
import { characterSheetService } from '../../services/characterSheetService';
import { useCampaignMemberRole } from '../../hooks/useCampaignMemberRole';

interface CharacterDetailProps {
  entityId?: string;
}

const CharacterDetail: React.FC<CharacterDetailProps> = ({ entityId }) => {
  const { id: paramId } = useParams<{ id: string }>();
  const id = entityId || paramId;
  const navigate = useNavigate();
  const { campaignData, deleteEntity, updateEntity } = useCampaignData();
  const { saveCampaign, currentCampaignId, user } = useCampaignSession();
  const { canManageCampaignContent } = useCampaignMemberRole();
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
    isSectionLinkEnabled,
    setSectionLinkEnabled,
    addCustomSection,
    removeCustomSection,
    allVisibleExpanded,
    toggleAllSections,
  } = useSectionedEntityDetail({
    id,
    items: canManageCampaignContent ? campaignData.characters : [],
    navigate,
    listPath: '/characters',
    initialCollapsed: { basic: false, goals: true },
    sectionDefs,
    updateItem: (item) => updateEntity('characters', item),
    deleteItem: (itemId) => deleteEntity('characters', itemId),
  });

  const setSectionItemsWithDefault = useCallback((key: string, items: CustomSubItem[]) => {
    if (!character) return;
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

  const canUseCharacterSheetBridge = canManageCampaignContent;

  const linkedSheetsQuery = useQuery({
    queryKey: currentCampaignId && character ? [...queryKeys.campaigns.characterSheets(currentCampaignId, user?.id), 'linked-character', character.id] as const : ['characters', 'linked-sheets-disabled'] as const,
    queryFn: async () => {
      if (!currentCampaignId || !user || !character) return [];
      const sheets = await characterSheetService.list(currentCampaignId, user);
      return sheets.filter((sheet) => sheet.linkedEntityType === 'characters' && sheet.linkedEntityId === character.id);
    },
    enabled: Boolean(currentCampaignId && user && character && canUseCharacterSheetBridge),
  });

  if (!character) return <div>加载中...</div>;

  return (
    <div className="entity-detail-page">
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

      {canUseCharacterSheetBridge && (
        <details className="character-sheets">
          <summary className="cursor-pointer text-sm">关联角色卡 <span className="theme-text-secondary">{linkedSheetsQuery.data?.length || 0}</span></summary>
          <div className="flex flex-wrap items-center gap-2 pt-3">
            <button
              type="button"
              onClick={() => navigate('/characters/sheets')}
              className="px-3 py-2 rounded border border-theme hover:bg-primary-light text-sm"
            >
              打开角色卡管理
            </button>
          {linkedSheetsQuery.isLoading ? (
            <div className="text-sm theme-text-secondary">正在加载关联角色卡...</div>
          ) : linkedSheetsQuery.isError ? (
            <button type="button" onClick={() => void linkedSheetsQuery.refetch()} className="text-sm text-primary">读取失败，点击重试</button>
          ) : linkedSheetsQuery.data && linkedSheetsQuery.data.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {linkedSheetsQuery.data.map((sheet) => (
                <button
                  key={sheet.id}
                  type="button"
                  onClick={() => navigate(`/characters/sheets/${sheet.id}`)}
                  className="px-3 py-2 rounded-lg border border-theme hover:bg-primary-light text-sm text-left"
                >
                  {sheet.name}
                </button>
              ))}
            </div>
          ) : (
            <div className="text-xs theme-text-secondary">
              暂无关联角色卡。
            </div>
          )}
          </div>
        </details>
      )}

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
        isSectionLinkEnabled={isSectionLinkEnabled}
        setSectionLinkEnabled={setSectionLinkEnabled}
        addCustomSection={addCustomSection}
        removeCustomSection={removeCustomSection}
        setSectionTitle={setSectionTitle}
        onSectionOrderChange={(sectionOrder) => handleChange('sectionOrder', sectionOrder)}
      />
    </div>
  );
};

export default CharacterDetail;
