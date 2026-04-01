import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCampaign } from '../../context/CampaignContext';
import { Monster } from '../../types';
import CustomSubItemsEditor from '../../components/common/CustomSubItemsEditor';
import CollapsibleSection from '../../components/common/CollapsibleSection';
import SectionAddBar from '../../components/common/SectionAddBar';

interface MonsterDetailProps {
  entityId?: string;
}

const MonsterDetail: React.FC<MonsterDetailProps> = ({ entityId }) => {
  const { id: paramId } = useParams<{ id: string }>();
  const id = entityId || paramId;
  const navigate = useNavigate();
  const { campaignData, updateEntity, deleteEntity, saveCampaign } = useCampaign();
  const [monster, setMonster] = useState<Monster | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({
    basic: true,
    combat: true,
  });
  const sectionDefs = [
    { key: 'basic', title: '基本信息' },
    { key: 'combat', title: '数据与掉落' },
  ];

  useEffect(() => {
    const found = campaignData.monsters.find(m => m.id === id);
    if (found) {
      setMonster(found);
    } else {
      navigate('/monsters');
    }
  }, [id, campaignData.monsters, navigate]);

  if (!monster) return <div>加载中...</div>;

  const handleChange = (field: keyof Monster, value: any) => {
    const updated = { ...monster, [field]: value };
    setMonster(updated);
    updateEntity('monsters', updated);
  };

  const handleDelete = () => {
    if (confirm('确定要删除这个怪物吗？')) {
      deleteEntity('monsters', id!);
      navigate('/monsters');
    }
  };

  const getSectionItems = (key: string) => monster.sectionSubItems?.[key] || [];

  const setSectionItems = (key: string, items: any[]) => {
    handleChange('sectionSubItems' as keyof Monster, {
      ...(monster.sectionSubItems || {}),
      [key]: items,
    });
  };

  const getSectionTitle = (key: string, fallback: string) => monster.sectionTitles?.[key] || fallback;

  const setSectionTitle = (key: string, title: string) => {
    handleChange('sectionTitles' as keyof Monster, {
      ...(monster.sectionTitles || {}),
      [key]: title,
    });
  };

  const isSectionVisible = (key: string) => monster.sectionVisibility?.[key] !== false;

  const setSectionVisible = (key: string, visible: boolean) => {
    handleChange('sectionVisibility' as keyof Monster, {
      ...(monster.sectionVisibility || {}),
      [key]: visible,
    });
  };

  const addCustomSection = () => {
    const name = window.prompt('请输入新内置区块名称', '新内置区块');
    if (!name || !name.trim()) return;
    const key = `custom_${Date.now()}`;
    const updated = {
      ...monster,
      customSections: [...(monster.customSections || []), key],
      sectionTitles: { ...(monster.sectionTitles || {}), [key]: name.trim() },
      sectionVisibility: { ...(monster.sectionVisibility || {}), [key]: true },
      sectionSubItems: { ...(monster.sectionSubItems || {}), [key]: [] },
    };
    setMonster(updated);
    updateEntity('monsters', updated);
    setCollapsed((prev) => ({ ...prev, [key]: true }));
  };

  const removeCustomSection = (key: string) => {
    const nextCustomSections = (monster.customSections || []).filter((k) => k !== key);
    const nextTitles = { ...(monster.sectionTitles || {}) };
    const nextVisibility = { ...(monster.sectionVisibility || {}) };
    const nextSubItems = { ...(monster.sectionSubItems || {}) };
    delete nextTitles[key];
    delete nextVisibility[key];
    delete nextSubItems[key];
    const updated = {
      ...monster,
      customSections: nextCustomSections,
      sectionTitles: nextTitles,
      sectionVisibility: nextVisibility,
      sectionSubItems: nextSubItems,
    };
    setMonster(updated);
    updateEntity('monsters', updated);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      <div className="flex justify-between items-center border-b pb-4">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/monsters')} className="text-gray-500 hover:text-gray-700">
            &larr; 返回
          </button>
          <input
            data-tour="entity-detail-name"
            type="text"
            value={monster.name}
            onChange={(e) => handleChange('name', e.target.value)}
            className="text-2xl font-bold text-gray-800 border-b border-transparent hover:border-gray-300 focus:border-primary focus:outline-none bg-transparent"
          />
        </div>
        
        <div className="flex items-center gap-3">
            <button
                onClick={saveCampaign}
                className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-sm flex items-center gap-1"
            >
                保存
            </button>
            <div className="w-px h-6 bg-gray-300 mx-1"></div>
            <button 
              onClick={handleDelete}
              className="text-red-500 hover:text-red-700 text-sm px-3 py-1 rounded hover:bg-red-50"
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
            onChange={(items) => setSectionItems('basic', items)}
            ensureOneItem
            defaultFirstItemTitle="详细情况"
          />
        </CollapsibleSection>
        )}

        {isSectionVisible('combat') && (
        <CollapsibleSection
          title={getSectionTitle('combat', '数据与掉落')}
          collapsed={collapsed.combat}
          onToggle={() => setCollapsed((prev) => ({ ...prev, combat: !prev.combat }))}
          removable
          onRemove={() => setSectionVisible('combat', false)}
          editableTitle
          onRenameTitle={(title) => setSectionTitle('combat', title)}
        >
          <CustomSubItemsEditor
            title={getSectionTitle('combat', '数据与掉落') + ' / 子项目'}
            items={getSectionItems('combat')}
            onChange={(items) => setSectionItems('combat', items)}
            ensureOneItem
            defaultFirstItemTitle="详细情况"
          />
        </CollapsibleSection>
        )}

        {(monster.customSections || []).map((sectionKey) => (
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

export default MonsterDetail;
