import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCampaign } from '../../context/CampaignContext';
import { Clue } from '../../types';
import CustomSubItemsEditor from '../../components/common/CustomSubItemsEditor';
import CollapsibleSection from '../../components/common/CollapsibleSection';
import SectionAddBar from '../../components/common/SectionAddBar';

interface ClueDetailProps {
  entityId?: string;
}

const ClueDetail: React.FC<ClueDetailProps> = ({ entityId }) => {
  const { id: paramId } = useParams<{ id: string }>();
  const id = entityId || paramId;
  const navigate = useNavigate();
  const { campaignData, updateEntity, deleteEntity, saveCampaign } = useCampaign();
  const [clue, setClue] = useState<Clue | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({
    detail: true,
  });
  const sectionDefs = [
    { key: 'detail', title: '线索详情' },
  ];

  useEffect(() => {
    const found = campaignData.clues.find(c => c.id === id);
    if (found) {
      setClue(found);
    } else {
      navigate('/clues');
    }
  }, [id, campaignData.clues, navigate]);

  if (!clue) return <div>加载中...</div>;

  const handleChange = (field: keyof Clue, value: any) => {
    const updated = { ...clue, [field]: value };
    setClue(updated);
    updateEntity('clues', updated);
  };

  const handleDelete = () => {
    if (confirm('确定要删除这条线索吗？')) {
      deleteEntity('clues', id!);
      navigate('/clues');
    }
  };

  const getSectionItems = (key: string) => clue.sectionSubItems?.[key] || [];

  const setSectionItems = (key: string, items: any[]) => {
    handleChange('sectionSubItems' as keyof Clue, {
      ...(clue.sectionSubItems || {}),
      [key]: items,
    });
  };

  const getSectionTitle = (key: string, fallback: string) => clue.sectionTitles?.[key] || fallback;

  const setSectionTitle = (key: string, title: string) => {
    handleChange('sectionTitles' as keyof Clue, {
      ...(clue.sectionTitles || {}),
      [key]: title,
    });
  };

  const isSectionVisible = (key: string) => clue.sectionVisibility?.[key] !== false;

  const setSectionVisible = (key: string, visible: boolean) => {
    handleChange('sectionVisibility' as keyof Clue, {
      ...(clue.sectionVisibility || {}),
      [key]: visible,
    });
  };

  const addCustomSection = () => {
    const name = window.prompt('请输入新内置区块名称', '新内置区块');
    if (!name || !name.trim()) return;
    const key = `custom_${Date.now()}`;
    const updated = {
      ...clue,
      customSections: [...(clue.customSections || []), key],
      sectionTitles: { ...(clue.sectionTitles || {}), [key]: name.trim() },
      sectionVisibility: { ...(clue.sectionVisibility || {}), [key]: true },
      sectionSubItems: { ...(clue.sectionSubItems || {}), [key]: [] },
    };
    setClue(updated);
    updateEntity('clues', updated);
    setCollapsed((prev) => ({ ...prev, [key]: true }));
  };

  const removeCustomSection = (key: string) => {
    const nextCustomSections = (clue.customSections || []).filter((k) => k !== key);
    const nextTitles = { ...(clue.sectionTitles || {}) };
    const nextVisibility = { ...(clue.sectionVisibility || {}) };
    const nextSubItems = { ...(clue.sectionSubItems || {}) };
    delete nextTitles[key];
    delete nextVisibility[key];
    delete nextSubItems[key];
    const updated = {
      ...clue,
      customSections: nextCustomSections,
      sectionTitles: nextTitles,
      sectionVisibility: nextVisibility,
      sectionSubItems: nextSubItems,
    };
    setClue(updated);
    updateEntity('clues', updated);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12 px-2 sm:px-0">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 border-b pb-3">
        <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
          <button onClick={() => navigate('/clues')} className="inline-flex items-center whitespace-nowrap shrink-0 text-gray-500 hover:text-gray-700">
            &larr; 返回
          </button>
          <input
            data-tour="entity-detail-name"
            type="text"
            value={clue.name}
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

        {isSectionVisible('detail') && (
        <CollapsibleSection
          title={getSectionTitle('detail', '线索详情')}
          collapsed={collapsed.detail}
          onToggle={() => setCollapsed((prev) => ({ ...prev, detail: !prev.detail }))}
          removable
          onRemove={() => setSectionVisible('detail', false)}
          editableTitle
          onRenameTitle={(title) => setSectionTitle('detail', title)}
        >
          <CustomSubItemsEditor
            title={getSectionTitle('detail', '线索详情') + ' / 子项目'}
            items={getSectionItems('detail')}
            onChange={(items) => setSectionItems('detail', items)}
            ensureOneItem
            defaultFirstItemTitle="详细情况"
          />
        </CollapsibleSection>
        )}

        {(clue.customSections || []).map((sectionKey) => (
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

export default ClueDetail;
