import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCampaign } from '../../context/CampaignContext';
import { Character } from '../../types';
import CustomSubItemsEditor from '../../components/common/CustomSubItemsEditor';
import CollapsibleSection from '../../components/common/CollapsibleSection';
import SectionAddBar from '../../components/common/SectionAddBar';

interface CharacterDetailProps {
  entityId?: string;
}

const CharacterDetail: React.FC<CharacterDetailProps> = ({ entityId }) => {
  const { id: paramId } = useParams<{ id: string }>();
  const id = entityId || paramId;
  const navigate = useNavigate();
  const { campaignData, saveCampaign, deleteEntity, updateEntity } = useCampaign();
  const [character, setCharacter] = useState<Character | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({
    basic: true,
    goals: true,
  });
  const sectionDefs = [
    { key: 'basic', title: '基本信息' },
    { key: 'goals', title: '属性与目标' },
  ];

  useEffect(() => {
    // campaignData is the source of truth, 'data' was used in previous context but now it is 'campaignData'
    const found = campaignData.characters.find(c => c.id === id);
    if (found) {
      setCharacter(found);
    } else {
      navigate('/characters');
    }
  }, [id, campaignData.characters, navigate]);

  if (!character) return <div>加载中...</div>;

  const handleChange = (field: keyof Character, value: any) => {
    const updatedCharacter = { ...character, [field]: value };
    // Optimistic update
    setCharacter(updatedCharacter);
    updateEntity('characters', updatedCharacter);
  };

  const handleDelete = () => {
      deleteEntity('characters', id!);
      navigate('/characters');
  };

  const getSectionItems = (key: string) => character.sectionSubItems?.[key] || [];

  const setSectionItems = (key: string, items: any[]) => {
    const updatedCharacter = {
      ...character,
      sectionSubItems: {
        ...(character.sectionSubItems || {}),
        [key]: items,
      },
    };
    setCharacter(updatedCharacter);
    updateEntity('characters', updatedCharacter);
  };

  const setSectionItemsWithDefault = (key: string, items: any[]) => {
    const updatedCharacter = {
      ...character,
      sectionSubItems: {
        ...(character.sectionSubItems || {}),
        [key]: items,
      },
      details: key === 'basic' ? (items[0]?.content || '') : character.details,
      desireOrGoal: key === 'goals' ? (items[0]?.content || '') : character.desireOrGoal,
    };
    setCharacter(updatedCharacter);
    updateEntity('characters', updatedCharacter);
  };

  const getSectionTitle = (key: string, fallback: string) => character.sectionTitles?.[key] || fallback;

  const setSectionTitle = (key: string, title: string) => {
    handleChange('sectionTitles' as keyof Character, {
      ...(character.sectionTitles || {}),
      [key]: title,
    });
  };

  const isSectionVisible = (key: string) => character.sectionVisibility?.[key] !== false;

  const setSectionVisible = (key: string, visible: boolean) => {
    handleChange('sectionVisibility' as keyof Character, {
      ...(character.sectionVisibility || {}),
      [key]: visible,
    });
  };

  const addCustomSection = () => {
    const name = window.prompt('请输入新内置区块名称', '新内置区块');
    if (!name || !name.trim()) return;
    const key = `custom_${Date.now()}`;
    const nextCustomSections = [...(character.customSections || []), key];
    const nextTitles = { ...(character.sectionTitles || {}), [key]: name.trim() };
    const nextVisibility = { ...(character.sectionVisibility || {}), [key]: true };
    const nextSubItems = { ...(character.sectionSubItems || {}), [key]: [] };
    const updated = {
      ...character,
      customSections: nextCustomSections,
      sectionTitles: nextTitles,
      sectionVisibility: nextVisibility,
      sectionSubItems: nextSubItems,
    };
    setCharacter(updated);
    updateEntity('characters', updated);
    setCollapsed((prev) => ({ ...prev, [key]: true }));
  };

  const removeCustomSection = (key: string) => {
    const nextCustomSections = (character.customSections || []).filter((k) => k !== key);
    const nextTitles = { ...(character.sectionTitles || {}) };
    const nextVisibility = { ...(character.sectionVisibility || {}) };
    const nextSubItems = { ...(character.sectionSubItems || {}) };
    delete nextTitles[key];
    delete nextVisibility[key];
    delete nextSubItems[key];
    const updated = {
      ...character,
      customSections: nextCustomSections,
      sectionTitles: nextTitles,
      sectionVisibility: nextVisibility,
      sectionSubItems: nextSubItems,
    };
    setCharacter(updated);
    updateEntity('characters', updated);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12 px-2 sm:px-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 border-b pb-3">
        <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
          <button onClick={() => navigate('/characters')} className="inline-flex items-center whitespace-nowrap shrink-0 text-gray-500 hover:text-gray-700">
            &larr; 返回
          </button>
          <input
            data-tour="entity-detail-name"
            type="text"
            value={character.name}
            onChange={(e) => handleChange('name', e.target.value)}
            className="flex-1 min-w-0 text-xl sm:text-2xl font-bold text-gray-800 border-b border-transparent hover:border-gray-300 focus:border-primary focus:outline-none bg-transparent"
          />
        </div>
        
        <div className="flex items-center gap-2 sm:gap-3">
            <button
                onClick={saveCampaign}
                className="px-3 py-1.5 bg-green-600 text-white rounded hover:bg-green-700 text-sm flex items-center gap-1"
            >
                保存
            </button>
            <div className="w-px h-6 bg-gray-300 mx-1"></div>
            <button 
              onClick={handleDelete}
              className="text-red-500 hover:text-red-700 text-sm px-3 py-1.5 rounded hover:bg-red-50"
            >
              删除
            </button>
        </div>
      </div>

      <div className="space-y-6">
        <SectionAddBar
          hiddenSections={sectionDefs.filter((s) => !isSectionVisible(s.key))}
          onAddSection={(key) => setSectionVisible(key, true)}
          onAddCustomSection={addCustomSection}
        />

        {isSectionVisible('basic') && (
        <CollapsibleSection
          title={getSectionTitle('basic', '基本信息')}
          collapsed={collapsed.basic}
          onToggle={() => setCollapsed((prev) => ({ ...prev, basic: !prev.basic }))}
          removable
          onRemove={() => setSectionVisible('basic', false)}
          editableTitle
          onRenameTitle={(title) => setSectionTitle('basic', title)}
        >
          <CustomSubItemsEditor
            title={getSectionTitle('basic', '基本信息') + ' / 子项目'}
            items={getSectionItems('basic')}
            onChange={(items) => setSectionItemsWithDefault('basic', items)}
            ensureOneItem
            defaultFirstItemTitle="详细情况"
          />
        </CollapsibleSection>
        )}

        {isSectionVisible('goals') && (
        <CollapsibleSection
          title={getSectionTitle('goals', '属性与目标')}
          collapsed={collapsed.goals}
          onToggle={() => setCollapsed((prev) => ({ ...prev, goals: !prev.goals }))}
          removable
          onRemove={() => setSectionVisible('goals', false)}
          editableTitle
          onRenameTitle={(title) => setSectionTitle('goals', title)}
        >
          <CustomSubItemsEditor
            title={getSectionTitle('goals', '属性与目标') + ' / 子项目'}
            items={getSectionItems('goals')}
            onChange={(items) => setSectionItemsWithDefault('goals', items)}
            ensureOneItem
            defaultFirstItemTitle="详细情况"
          />
        </CollapsibleSection>
        )}

        {(character.customSections || []).map((sectionKey) => (
          <CollapsibleSection
            key={sectionKey}
            title={getSectionTitle(sectionKey, '自定义区块')}
            collapsed={Boolean(collapsed[sectionKey])}
            onToggle={() => setCollapsed((prev) => ({ ...prev, [sectionKey]: !prev[sectionKey] }))}
            removable
            onRemove={() => removeCustomSection(sectionKey)}
            editableTitle
            onRenameTitle={(title) => setSectionTitle(sectionKey, title)}
          >
            <CustomSubItemsEditor
              title={getSectionTitle(sectionKey, '自定义区块') + ' / 子项目'}
              items={getSectionItems(sectionKey)}
              onChange={(items) => setSectionItems(sectionKey, items)}
              ensureOneItem
              defaultFirstItemTitle="详细情况"
            />
          </CollapsibleSection>
        ))}
      </div>
    </div>
  );
};

export default CharacterDetail;
