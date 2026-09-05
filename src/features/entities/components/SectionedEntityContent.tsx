import React from 'react';
import CustomSubItemsEditor from '../../../components/common/CustomSubItemsEditor';
import CollapsibleSection from '../../../components/common/CollapsibleSection';
import SectionAddBar from '../../../components/common/SectionAddBar';
import EntityTagEditor from '../../../components/common/EntityTagEditor';
import { ShareSectionAction, ShareSubItemAction } from '../../../components/common/EntityShareActions';
import { BaseEntity, CustomSubItem, GraphEntityType } from '../../../types';
import { DetailSectionDef } from '../hooks/useSectionedEntityDetail';
import { useDirectContentEditPreference } from '../../../hooks/useDirectContentEditPreference';
import SectionLinkToggle from './SectionLinkToggle';

interface SectionedEntityContentProps<T extends BaseEntity> {
  entity: T;
  entityType: GraphEntityType;
  sectionDefs: DetailSectionDef[];
  collapsed: Record<string, boolean>;
  setCollapsed: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  onTagsChange: (tags: string[]) => void;
  getSectionTitle: (key: string, fallback: string) => string;
  getSectionItems: (key: string) => CustomSubItem[];
  onSectionItemsChange: (key: string, items: CustomSubItem[]) => void;
  isSectionVisible: (key: string) => boolean;
  setSectionVisible: (key: string, visible: boolean) => void;
  isSectionLinkEnabled: (key: string) => boolean;
  setSectionLinkEnabled: (key: string, enabled: boolean) => void;
  addCustomSection: () => void;
  removeCustomSection: (key: string) => void;
  setSectionTitle: (key: string, title: string) => void;
  onSectionOrderChange: (sectionOrder: string[]) => void;
}

const SectionedEntityContent = <T extends BaseEntity>({
  entity,
  entityType,
  sectionDefs,
  collapsed,
  setCollapsed,
  onTagsChange,
  getSectionTitle,
  getSectionItems,
  onSectionItemsChange,
  isSectionVisible,
  setSectionVisible,
  isSectionLinkEnabled,
  setSectionLinkEnabled,
  addCustomSection,
  removeCustomSection,
  setSectionTitle,
  onSectionOrderChange,
}: SectionedEntityContentProps<T>) => {
  const { directContentEdit } = useDirectContentEditPreference();
  const availableSections = [
    ...sectionDefs.map((section) => ({ ...section, custom: false })),
    ...(entity.customSections || []).map((key) => ({ key, title: '自定义区块', custom: true })),
  ];
  const sectionsByKey = new Map(availableSections.map((section) => [section.key, section]));
  const orderedKeys: string[] = [];
  const seenKeys = new Set<string>();
  for (const key of [...(entity.sectionOrder || []), ...availableSections.map((section) => section.key)]) {
    if (!sectionsByKey.has(key) || seenKeys.has(key)) continue;
    seenKeys.add(key);
    orderedKeys.push(key);
  }
  const visibleSections = orderedKeys
    .map((key) => sectionsByKey.get(key))
    .filter((section): section is NonNullable<typeof section> => (
      Boolean(section) && (section.custom || isSectionVisible(section.key))
    ));

  const swapSections = (firstKey: string, secondKey: string) => {
    const nextOrder = [...orderedKeys];
    const firstIndex = nextOrder.indexOf(firstKey);
    const secondIndex = nextOrder.indexOf(secondKey);
    if (firstIndex < 0 || secondIndex < 0) return;
    [nextOrder[firstIndex], nextOrder[secondIndex]] = [nextOrder[secondIndex], nextOrder[firstIndex]];
    onSectionOrderChange(nextOrder);
  };

  return (
    <div className="space-y-6">
      <EntityTagEditor tags={entity.tags} onChange={onTagsChange} />
      <SectionAddBar
        hiddenSections={sectionDefs.filter((section) => !isSectionVisible(section.key))}
        onAddSection={(key) => setSectionVisible(key, true)}
        onAddCustomSection={addCustomSection}
      />

      {visibleSections.map((section, index) => (
        <CollapsibleSection
          key={section.key}
          title={getSectionTitle(section.key, section.title)}
          collapsed={Boolean(collapsed[section.key])}
          onToggle={() => setCollapsed((prev) => ({ ...prev, [section.key]: !prev[section.key] }))}
          removable
          onRemove={() => (
            section.custom ? removeCustomSection(section.key) : setSectionVisible(section.key, false)
          )}
          editableTitle
          onRenameTitle={(title) => setSectionTitle(section.key, title)}
          canMoveUp={index > 0}
          canMoveDown={index < visibleSections.length - 1}
          onMoveUp={() => swapSections(section.key, visibleSections[index - 1].key)}
          onMoveDown={() => swapSections(section.key, visibleSections[index + 1].key)}
          headerActions={(
            <>
              <SectionLinkToggle
                enabled={isSectionLinkEnabled(section.key)}
                onChange={(enabled) => setSectionLinkEnabled(section.key, enabled)}
              />
              <ShareSectionAction entityType={entityType} entity={entity} sectionKey={section.key} />
            </>
          )}
        >
          <CustomSubItemsEditor
            title={getSectionTitle(section.key, section.title) + ' / 子项目'}
            items={getSectionItems(section.key)}
            onChange={(items) => onSectionItemsChange(section.key, items)}
            ensureOneItem
            defaultFirstItemTitle="详细情况"
            directEditOnContentClick={directContentEdit}
            renderItemActions={(item) => <ShareSubItemAction entityType={entityType} entity={entity} item={item} />}
          />
        </CollapsibleSection>
      ))}
    </div>
  );
};

export default SectionedEntityContent;
