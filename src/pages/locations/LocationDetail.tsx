import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCampaign } from '../../context/CampaignContext';
import { Location } from '../../types';
import CustomSubItemsEditor from '../../components/common/CustomSubItemsEditor';
import CollapsibleSection from '../../components/common/CollapsibleSection';
import SectionAddBar from '../../components/common/SectionAddBar';

interface LocationDetailProps {
  entityId?: string;
}

const LocationDetail: React.FC<LocationDetailProps> = ({ entityId }) => {
  const { id: paramId } = useParams<{ id: string }>();
  const id = entityId || paramId;
  const navigate = useNavigate();
  const { campaignData, updateEntity, deleteEntity, saveCampaign } = useCampaign();
  const [location, setLocation] = useState<Location | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({
    detail: true,
  });
  const sectionDefs = [
    { key: 'detail', title: '地点详情' },
  ];

  useEffect(() => {
    const found = campaignData.locations.find(l => l.id === id);
    if (found) {
      setLocation(found);
    } else {
      navigate('/locations');
    }
  }, [id, campaignData.locations, navigate]);

  if (!location) return <div>加载中...</div>;

  const handleChange = (field: keyof Location, value: any) => {
    const updated = { ...location, [field]: value };
    setLocation(updated);
    updateEntity('locations', updated);
  };

  const handleDelete = () => {
    if (confirm('确定要删除这个地点吗？')) {
      deleteEntity('locations', id!);
      navigate('/locations');
    }
  };

  const getSectionItems = (key: string) => location.sectionSubItems?.[key] || [];

  const setSectionItems = (key: string, items: any[]) => {
    handleChange('sectionSubItems' as keyof Location, {
      ...(location.sectionSubItems || {}),
      [key]: items,
    });
  };

  const getSectionTitle = (key: string, fallback: string) => location.sectionTitles?.[key] || fallback;

  const setSectionTitle = (key: string, title: string) => {
    handleChange('sectionTitles' as keyof Location, {
      ...(location.sectionTitles || {}),
      [key]: title,
    });
  };

  const isSectionVisible = (key: string) => location.sectionVisibility?.[key] !== false;

  const setSectionVisible = (key: string, visible: boolean) => {
    handleChange('sectionVisibility' as keyof Location, {
      ...(location.sectionVisibility || {}),
      [key]: visible,
    });
  };

  const addCustomSection = () => {
    const name = window.prompt('请输入新内置区块名称', '新内置区块');
    if (!name || !name.trim()) return;
    const key = `custom_${Date.now()}`;
    const updated = {
      ...location,
      customSections: [...(location.customSections || []), key],
      sectionTitles: { ...(location.sectionTitles || {}), [key]: name.trim() },
      sectionVisibility: { ...(location.sectionVisibility || {}), [key]: true },
      sectionSubItems: { ...(location.sectionSubItems || {}), [key]: [] },
    };
    setLocation(updated);
    updateEntity('locations', updated);
    setCollapsed((prev) => ({ ...prev, [key]: true }));
  };

  const removeCustomSection = (key: string) => {
    const nextCustomSections = (location.customSections || []).filter((k) => k !== key);
    const nextTitles = { ...(location.sectionTitles || {}) };
    const nextVisibility = { ...(location.sectionVisibility || {}) };
    const nextSubItems = { ...(location.sectionSubItems || {}) };
    delete nextTitles[key];
    delete nextVisibility[key];
    delete nextSubItems[key];
    const updated = {
      ...location,
      customSections: nextCustomSections,
      sectionTitles: nextTitles,
      sectionVisibility: nextVisibility,
      sectionSubItems: nextSubItems,
    };
    setLocation(updated);
    updateEntity('locations', updated);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex justify-between items-center border-b pb-4">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/locations')} className="text-gray-500 hover:text-gray-700">
            &larr; 返回
          </button>
          <input
            data-tour="entity-detail-name"
            type="text"
            value={location.name}
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

        {isSectionVisible('detail') && (
        <CollapsibleSection
          title={getSectionTitle('detail', '地点详情')}
          collapsed={collapsed.detail}
          onToggle={() => setCollapsed((prev) => ({ ...prev, detail: !prev.detail }))}
          removable
          onRemove={() => setSectionVisible('detail', false)}
          editableTitle
          onRenameTitle={(title) => setSectionTitle('detail', title)}
        >
          <CustomSubItemsEditor
            title={getSectionTitle('detail', '地点详情') + ' / 子项目'}
            items={getSectionItems('detail')}
            onChange={(items) => setSectionItems('detail', items)}
            ensureOneItem
            defaultFirstItemTitle="详细情况"
          />
        </CollapsibleSection>
        )}

        {(location.customSections || []).map((sectionKey) => (
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

export default LocationDetail;
