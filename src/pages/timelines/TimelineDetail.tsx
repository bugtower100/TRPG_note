import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCampaign } from '../../context/CampaignContext';
import { Timeline, TimelineEvent } from '../../types';
import { v4 as uuidv4 } from 'uuid';
import RichTextEditor from '../../components/common/RichTextEditor';
import CustomSubItemsEditor from '../../components/common/CustomSubItemsEditor';
import CollapsibleSection from '../../components/common/CollapsibleSection';
import SectionAddBar from '../../components/common/SectionAddBar';

interface TimelineDetailProps {
  entityId?: string;
}

const TimelineDetail: React.FC<TimelineDetailProps> = ({ entityId }) => {
  const { id: paramId } = useParams<{ id: string }>();
  const id = entityId || paramId;
  const navigate = useNavigate();
  const { campaignData, updateEntity, deleteEntity, saveCampaign } = useCampaign();
  const [timeline, setTimeline] = useState<Timeline | null>(null);
  const [collapsedIds, setCollapsedIds] = useState<string[]>([]);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({
    intro: true,
    events: true,
  });
  const sectionDefs = [
    { key: 'intro', title: '简介' },
  ];

  useEffect(() => {
    const found = campaignData.timelines.find(t => t.id === id);
    if (found) {
      setTimeline(found);
    } else {
      navigate('/timelines');
    }
  }, [id, campaignData.timelines, navigate]);

  if (!timeline) return <div>加载中...</div>;

  const handleChange = (field: keyof Timeline, value: any) => {
    const updatedTimeline = { ...timeline, [field]: value };
    setTimeline(updatedTimeline);
    updateEntity('timelines', updatedTimeline);
  };

  const handleDelete = () => {
    if (confirm('确定要删除这条时间线吗？')) {
      deleteEntity('timelines', id!);
      navigate('/timelines');
    }
  };

  // Timeline Event Management
  const addEvent = () => {
    const newEvent: TimelineEvent = {
      id: uuidv4(),
      time: '',
      content: '',
      relations: [],
      relatedImages: [],
      isRevealed: false
    };
    
    const updatedTimeline = {
      ...timeline,
      timelineEvents: [...timeline.timelineEvents, newEvent]
    };
    
    setTimeline(updatedTimeline);
    updateEntity('timelines', updatedTimeline);
  };

  const updateEvent = (eventId: string, field: keyof TimelineEvent, value: any) => {
    const updatedEvents = timeline.timelineEvents.map(e => 
      e.id === eventId ? { ...e, [field]: value } : e
    );
    const updatedTimeline = { ...timeline, timelineEvents: updatedEvents };
    setTimeline(updatedTimeline);
    updateEntity('timelines', updatedTimeline);
  };

  const deleteEvent = (eventId: string) => {
    if (confirm('删除此事件节点？')) {
      const updatedEvents = timeline.timelineEvents.filter(e => e.id !== eventId);
      const updatedTimeline = { ...timeline, timelineEvents: updatedEvents };
      setTimeline(updatedTimeline);
      updateEntity('timelines', updatedTimeline);
    }
  };

  const moveEvent = (index: number, direction: 'up' | 'down') => {
    if (
      (direction === 'up' && index === 0) || 
      (direction === 'down' && index === timeline.timelineEvents.length - 1)
    ) return;

    const newEvents = [...timeline.timelineEvents];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    [newEvents[index], newEvents[targetIndex]] = [newEvents[targetIndex], newEvents[index]];
    
    const updatedTimeline = { ...timeline, timelineEvents: newEvents };
    setTimeline(updatedTimeline);
    updateEntity('timelines', updatedTimeline);
  };

  const toggleCollapse = (eventId: string) => {
    setCollapsedIds((prev) =>
      prev.includes(eventId) ? prev.filter((id) => id !== eventId) : [...prev, eventId]
    );
  };

  const isSectionVisible = (key: string) => timeline.sectionVisibility?.[key] !== false;

  const setSectionVisible = (key: string, visible: boolean) => {
    handleChange('sectionVisibility' as keyof Timeline, {
      ...(timeline.sectionVisibility || {}),
      [key]: visible,
    });
  };

  const getSectionItems = (key: string) => timeline.sectionSubItems?.[key] || [];

  const setSectionItems = (key: string, items: any[]) => {
    handleChange('sectionSubItems' as keyof Timeline, {
      ...(timeline.sectionSubItems || {}),
      [key]: items,
    });
  };

  const getSectionTitle = (key: string, fallback: string) => timeline.sectionTitles?.[key] || fallback;

  const setSectionTitle = (key: string, title: string) => {
    handleChange('sectionTitles' as keyof Timeline, {
      ...(timeline.sectionTitles || {}),
      [key]: title,
    });
  };

  const addCustomSection = () => {
    const name = window.prompt('请输入新内置区块名称', '新内置区块');
    if (!name || !name.trim()) return;
    const key = `custom_${Date.now()}`;
    const updated = {
      ...timeline,
      customSections: [...(timeline.customSections || []), key],
      sectionTitles: { ...(timeline.sectionTitles || {}), [key]: name.trim() },
      sectionVisibility: { ...(timeline.sectionVisibility || {}), [key]: true },
      sectionSubItems: { ...(timeline.sectionSubItems || {}), [key]: [] },
    };
    setTimeline(updated);
    updateEntity('timelines', updated);
    setCollapsed((prev) => ({ ...prev, [key]: true }));
  };

  const removeCustomSection = (key: string) => {
    const nextCustomSections = (timeline.customSections || []).filter((k) => k !== key);
    const nextTitles = { ...(timeline.sectionTitles || {}) };
    const nextVisibility = { ...(timeline.sectionVisibility || {}) };
    const nextSubItems = { ...(timeline.sectionSubItems || {}) };
    delete nextTitles[key];
    delete nextVisibility[key];
    delete nextSubItems[key];
    const updated = {
      ...timeline,
      customSections: nextCustomSections,
      sectionTitles: nextTitles,
      sectionVisibility: nextVisibility,
      sectionSubItems: nextSubItems,
    };
    setTimeline(updated);
    updateEntity('timelines', updated);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex justify-between items-center border-b pb-4">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/timelines')} className="text-gray-500 hover:text-gray-700">
            &larr; 返回
          </button>
          <input
            type="text"
            value={timeline.name}
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
              删除时间线
            </button>
        </div>
      </div>

      <SectionAddBar
        hiddenSections={sectionDefs.filter((s) => !isSectionVisible(s.key))}
        onAddSection={(key) => setSectionVisible(key, true)}
        onAddCustomSection={addCustomSection}
      />

      {isSectionVisible('intro') && (
      <CollapsibleSection
        title={getSectionTitle('intro', '简介')}
        collapsed={collapsed.intro}
        onToggle={() => setCollapsed((prev) => ({ ...prev, intro: !prev.intro }))}
        className="p-4"
        removable
        onRemove={() => setSectionVisible('intro', false)}
        editableTitle
        onRenameTitle={(title) => setSectionTitle('intro', title)}
      >
        <RichTextEditor
          value={timeline.details}
          onChange={(val) => handleChange('details', val)}
          placeholder="时间线简介..."
          minHeight="90px"
        />
      </CollapsibleSection>
      )}

      <CollapsibleSection
        title="事件节点"
        collapsed={collapsed.events}
        onToggle={() => setCollapsed((prev) => ({ ...prev, events: !prev.events }))}
      >
        <div className="space-y-4">
        <div className="flex justify-between items-center">
          <button
            onClick={addEvent}
            className="px-3 py-1 bg-primary text-white rounded hover:bg-primary-dark text-sm"
          >
            + 添加节点
          </button>
        </div>

        <div className="space-y-4 relative before:absolute before:left-4 before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-200">
          {timeline.timelineEvents.map((event, index) => (
            <div key={event.id} className="relative pl-10">
              {/* Timeline Dot */}
              <div className="absolute left-2.5 top-4 w-3 h-3 bg-white border-2 border-primary rounded-full transform -translate-x-1/2"></div>
              
              <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 theme-card">
                <div className="space-y-3">
                    <div className="flex justify-between items-start">
                        <input
                        type="text"
                        value={event.time}
                        onChange={(e) => updateEvent(event.id, 'time', e.target.value)}
                        className="font-mono text-sm font-bold text-primary w-1/3 border-b border-dashed border-gray-300 focus:border-primary focus:outline-none bg-transparent"
                        placeholder="时间点..."
                        />
                        <div className="flex items-center gap-2">
                        <button
                          onClick={() => toggleCollapse(event.id)}
                          className="text-gray-400 hover:text-gray-700"
                        >
                          {collapsedIds.includes(event.id) ? '展开' : '收起'}
                        </button>
                        <button onClick={() => moveEvent(index, 'up')} disabled={index === 0} className="text-gray-400 hover:text-gray-600 disabled:opacity-30">↑</button>
                        <button onClick={() => moveEvent(index, 'down')} disabled={index === timeline.timelineEvents.length - 1} className="text-gray-400 hover:text-gray-600 disabled:opacity-30">↓</button>
                        <button onClick={() => deleteEvent(event.id)} className="text-red-400 hover:text-red-600 ml-2">×</button>
                        </div>
                    </div>

                    {!collapsedIds.includes(event.id) && (
                      <>
                        <RichTextEditor
                            value={event.content}
                            onChange={(val) => updateEvent(event.id, 'content', val)}
                            placeholder="发生了什么..."
                            minHeight="100px"
                        />

                        <label className="flex items-center gap-2 text-xs text-gray-500">
                            <input
                            type="checkbox"
                            checked={event.isRevealed}
                            onChange={(e) => updateEvent(event.id, 'isRevealed', e.target.checked)}
                            className="rounded text-primary focus:ring-primary"
                            />
                            节点公开
                        </label>
                      </>
                    )}
                </div>
              </div>
            </div>
          ))}
          
          {timeline.timelineEvents.length === 0 && (
            <p className="text-center text-gray-400 py-8 pl-10">暂无事件节点</p>
          )}
        </div>
      </div>
      </CollapsibleSection>

      {(timeline.customSections || []).map((sectionKey) => (
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
  );
};

export default TimelineDetail;
