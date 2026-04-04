import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCampaign } from '../../context/CampaignContext';
import { Organization } from '../../types';
import CustomSubItemsEditor from '../../components/common/CustomSubItemsEditor';
import CollapsibleSection from '../../components/common/CollapsibleSection';
import SectionAddBar from '../../components/common/SectionAddBar';

interface OrganizationDetailProps {
  entityId?: string;
}

const OrganizationDetail: React.FC<OrganizationDetailProps> = ({ entityId }) => {
  const { id: paramId } = useParams<{ id: string }>();
  const id = entityId || paramId;
  const navigate = useNavigate();
  const { campaignData, updateEntity, deleteEntity, saveCampaign } = useCampaign();
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({
    detail: true,
  });
  const sectionDefs = [
    { key: 'detail', title: '组织详情' },
  ];

  useEffect(() => {
    const found = campaignData.organizations.find(o => o.id === id);
    if (found) {
      setOrganization(found);
    } else {
      navigate('/organizations');
    }
  }, [id, campaignData.organizations, navigate]);

  if (!organization) return <div>加载中...</div>;

  const handleChange = (field: keyof Organization, value: any) => {
    const updated = { ...organization, [field]: value };
    setOrganization(updated);
    updateEntity('organizations', updated);
  };

  const handleDelete = () => {
    if (confirm('确定要删除这个组织吗？')) {
      deleteEntity('organizations', id!);
      navigate('/organizations');
    }
  };

  const getSectionItems = (key: string) => organization.sectionSubItems?.[key] || [];

  const setSectionItems = (key: string, items: any[]) => {
    handleChange('sectionSubItems' as keyof Organization, {
      ...(organization.sectionSubItems || {}),
      [key]: items,
    });
  };

  const getSectionTitle = (key: string, fallback: string) => organization.sectionTitles?.[key] || fallback;

  const setSectionTitle = (key: string, title: string) => {
    handleChange('sectionTitles' as keyof Organization, {
      ...(organization.sectionTitles || {}),
      [key]: title,
    });
  };

  const isSectionVisible = (key: string) => organization.sectionVisibility?.[key] !== false;

  const setSectionVisible = (key: string, visible: boolean) => {
    handleChange('sectionVisibility' as keyof Organization, {
      ...(organization.sectionVisibility || {}),
      [key]: visible,
    });
  };

  const addCustomSection = () => {
    const name = window.prompt('请输入新内置区块名称', '新内置区块');
    if (!name || !name.trim()) return;
    const key = `custom_${Date.now()}`;
    const updated = {
      ...organization,
      customSections: [...(organization.customSections || []), key],
      sectionTitles: { ...(organization.sectionTitles || {}), [key]: name.trim() },
      sectionVisibility: { ...(organization.sectionVisibility || {}), [key]: true },
      sectionSubItems: { ...(organization.sectionSubItems || {}), [key]: [] },
    };
    setOrganization(updated);
    updateEntity('organizations', updated);
    setCollapsed((prev) => ({ ...prev, [key]: true }));
  };

  const removeCustomSection = (key: string) => {
    const nextCustomSections = (organization.customSections || []).filter((k) => k !== key);
    const nextTitles = { ...(organization.sectionTitles || {}) };
    const nextVisibility = { ...(organization.sectionVisibility || {}) };
    const nextSubItems = { ...(organization.sectionSubItems || {}) };
    delete nextTitles[key];
    delete nextVisibility[key];
    delete nextSubItems[key];
    const updated = {
      ...organization,
      customSections: nextCustomSections,
      sectionTitles: nextTitles,
      sectionVisibility: nextVisibility,
      sectionSubItems: nextSubItems,
    };
    setOrganization(updated);
    updateEntity('organizations', updated);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12 px-2 sm:px-0">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 border-b pb-3">
        <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
          <button onClick={() => navigate('/organizations')} className="inline-flex items-center whitespace-nowrap shrink-0 text-gray-500 hover:text-gray-700">
            &larr; 返回
          </button>
          <input
            data-tour="entity-detail-name"
            type="text"
            value={organization.name}
            onChange={(e) => handleChange('name', e.target.value)}
            className="flex-1 min-w-0 text-xl sm:text-2xl font-bold border-b border-transparent hover:border-gray-300 focus:border-primary focus:outline-none bg-transparent"
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
          title={getSectionTitle('detail', '组织详情')}
          collapsed={collapsed.detail}
          onToggle={() => setCollapsed((prev) => ({ ...prev, detail: !prev.detail }))}
          removable
          onRemove={() => setSectionVisible('detail', false)}
          editableTitle
          onRenameTitle={(title) => setSectionTitle('detail', title)}
        >
          <CustomSubItemsEditor
            title={getSectionTitle('detail', '组织详情') + ' / 子项目'}
            items={getSectionItems('detail')}
            onChange={(items) => setSectionItems('detail', items)}
            ensureOneItem
            defaultFirstItemTitle="详细情况"
          />
        </CollapsibleSection>
        )}

        {(organization.customSections || []).map((sectionKey) => (
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

export default OrganizationDetail;
