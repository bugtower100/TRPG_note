import React from 'react';
import CustomSubItemsEditor from '../../../components/common/CustomSubItemsEditor';
import CollapsibleSection from '../../../components/common/CollapsibleSection';
import SectionAddBar from '../../../components/common/SectionAddBar';
import EntityTagEditor from '../../../components/common/EntityTagEditor';
import { ShareSectionAction, ShareSubItemAction } from '../../../components/common/EntityShareActions';
import { BaseEntity, CustomSubItem, GraphEntityType } from '../../../types';
import { DetailSectionDef } from '../hooks/useSectionedEntityDetail';

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
  addCustomSection: () => void;
  removeCustomSection: (key: string) => void;
  setSectionTitle: (key: string, title: string) => void;
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
  addCustomSection,
  removeCustomSection,
  setSectionTitle,
}: SectionedEntityContentProps<T>) => {
  return (
    <div className="space-y-6">
      <EntityTagEditor tags={entity.tags} onChange={onTagsChange} />
      <SectionAddBar
        hiddenSections={sectionDefs.filter((section) => !isSectionVisible(section.key))}
        onAddSection={(key) => setSectionVisible(key, true)}
        onAddCustomSection={addCustomSection}
      />

      {sectionDefs.map((section) => isSectionVisible(section.key) && (
        <CollapsibleSection
          key={section.key}
          title={getSectionTitle(section.key, section.title)}
          collapsed={Boolean(collapsed[section.key])}
          onToggle={() => setCollapsed((prev) => ({ ...prev, [section.key]: !prev[section.key] }))}
          removable
          onRemove={() => setSectionVisible(section.key, false)}
          editableTitle
          onRenameTitle={(title) => setSectionTitle(section.key, title)}
          headerActions={<ShareSectionAction entityType={entityType} entity={entity} sectionKey={section.key} />}
        >
          <CustomSubItemsEditor
            title={getSectionTitle(section.key, section.title) + ' / 子项目'}
            items={getSectionItems(section.key)}
            onChange={(items) => onSectionItemsChange(section.key, items)}
            ensureOneItem
            defaultFirstItemTitle="详细情况"
            renderItemActions={(item) => <ShareSubItemAction entityType={entityType} entity={entity} item={item} />}
          />
        </CollapsibleSection>
      ))}

      {(entity.customSections || []).map((sectionKey) => (
        <CollapsibleSection
          key={sectionKey}
          title={getSectionTitle(sectionKey, '自定义区块')}
          collapsed={Boolean(collapsed[sectionKey])}
          onToggle={() => setCollapsed((prev) => ({ ...prev, [sectionKey]: !prev[sectionKey] }))}
          removable
          onRemove={() => removeCustomSection(sectionKey)}
          editableTitle
          onRenameTitle={(title) => setSectionTitle(sectionKey, title)}
          headerActions={<ShareSectionAction entityType={entityType} entity={entity} sectionKey={sectionKey} />}
        >
          <CustomSubItemsEditor
            title={getSectionTitle(sectionKey, '自定义区块') + ' / 子项目'}
            items={getSectionItems(sectionKey)}
            onChange={(items) => onSectionItemsChange(sectionKey, items)}
            ensureOneItem
            defaultFirstItemTitle="详细情况"
            renderItemActions={(item) => <ShareSubItemAction entityType={entityType} entity={entity} item={item} />}
          />
        </CollapsibleSection>
      ))}
    </div>
  );
};

export default SectionedEntityContent;
