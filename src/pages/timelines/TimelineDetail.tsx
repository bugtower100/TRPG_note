import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCampaignData, useCampaignSession } from '../../context/CampaignContext';
import { TimelineEvent } from '../../types';
import { v4 as uuidv4 } from 'uuid';
import { GripVertical } from 'lucide-react';
import RichTextEditor from '../../components/common/RichTextEditor';
import RichTextDisplay from '../../components/common/RichTextDisplay';
import CustomSubItemsEditor from '../../components/common/CustomSubItemsEditor';
import CollapsibleSection from '../../components/common/CollapsibleSection';
import EntityShareActions, { ShareSectionAction, ShareSubItemAction } from '../../components/common/EntityShareActions';
import { markdownToPreviewText } from '../../components/common/richTextReference';
import EntityDetailHeader from '../../features/entities/components/EntityDetailHeader';
import { useSectionedEntityDetail } from '../../features/entities/hooks/useSectionedEntityDetail';

interface TimelineDetailProps {
  entityId?: string;
  embedded?: boolean;
  onDeleted?: () => void;
}

const TimelineDetail: React.FC<TimelineDetailProps> = ({ entityId, embedded = false, onDeleted }) => {
  const { id: paramId } = useParams<{ id: string }>();
  const id = entityId || paramId;
  const navigate = useNavigate();
  const { campaignData, updateEntity, deleteEntity } = useCampaignData();
  const { saveCampaign } = useCampaignSession();
  const sectionDefs = [{ key: 'intro', title: '简介' }];
  const {
    entity: timeline,
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
    removeCustomSection,
    allVisibleExpanded,
    toggleAllSections,
  } = useSectionedEntityDetail({
    id,
    items: campaignData.timelines,
    navigate,
    listPath: '/timelines',
    navigateOnMissing: !embedded,
    initialCollapsed: { intro: true },
    sectionDefs,
    updateItem: (item) => updateEntity('timelines', item),
    deleteItem: (itemId) => deleteEntity('timelines', itemId),
  });
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [isEditingEvent, setIsEditingEvent] = useState(false);
  const [eventDraft, setEventDraft] = useState<TimelineEvent | null>(null);
  const [isEditingIntro, setIsEditingIntro] = useState(false);
  const [draggingEventId, setDraggingEventId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ id: string; position: 'before' | 'after' } | null>(null);
  const [hasInitializedSelection, setHasInitializedSelection] = useState(false);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (target.closest('[data-timeline-node="true"]')) return;
      if (target.closest('[data-timeline-note-panel="true"]')) return;
      setSelectedEventId(null);
      setIsEditingEvent(false);
    };
    window.addEventListener('mousedown', handlePointerDown);
    return () => window.removeEventListener('mousedown', handlePointerDown);
  }, []);

  const getEventTitle = (event: TimelineEvent) => {
    const explicit = (event.title || '').trim();
    if (explicit) return explicit;
    const preview = markdownToPreviewText(event.content || '').trim();
    if (preview) return preview.slice(0, 14);
    return event.time?.trim() || '未命名节点';
  };

  const persistTimeline = commitEntity;

  const handleDelete = () => {
    if (confirm('确定要删除这条时间线吗？')) {
      handleDeleteAndNavigate();
      onDeleted?.();
    }
  };

  const createNewEvent = (): TimelineEvent => ({
    id: uuidv4(),
    title: `新节点 ${timeline.timelineEvents.length + 1}`,
    time: '',
    content: '',
    relations: [],
    relatedImages: [],
    isRevealed: false,
  });

  const insertEventAt = (insertIndex: number) => {
    const newEvent = createNewEvent();
    const nextEvents = [...timeline.timelineEvents];
    nextEvents.splice(insertIndex, 0, newEvent);
    persistTimeline({
      ...timeline,
      timelineEvents: nextEvents,
    });
    setSelectedEventId(newEvent.id);
    setEventDraft({ ...newEvent });
    setIsEditingEvent(true);
  };

  const addEvent = () => {
    insertEventAt(timeline.timelineEvents.length);
  };

  const addEventAfterSelected = () => {
    if (selectedIndex < 0) {
      addEvent();
      return;
    }
    insertEventAt(selectedIndex + 1);
  };

  const deleteEvent = (eventId: string) => {
    if (confirm('删除此事件节点？')) {
      const updatedEvents = timeline.timelineEvents.filter((event) => event.id !== eventId);
      persistTimeline({ ...timeline, timelineEvents: updatedEvents });
      if (selectedEventId === eventId) {
        setSelectedEventId(updatedEvents[0]?.id || null);
        setIsEditingEvent(false);
        setEventDraft(null);
      }
    }
  };

  const moveEvent = (index: number, direction: 'up' | 'down') => {
    if (
      (direction === 'up' && index === 0) ||
      (direction === 'down' && index === timeline.timelineEvents.length - 1)
    ) return;

    const nextEvents = [...timeline.timelineEvents];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    [nextEvents[index], nextEvents[targetIndex]] = [nextEvents[targetIndex], nextEvents[index]];
    persistTimeline({ ...timeline, timelineEvents: nextEvents });
  };

  const reorderEvent = (sourceId: string, targetId: string, position: 'before' | 'after') => {
    if (!timeline || sourceId === targetId) return;
    const nextEvents = [...timeline.timelineEvents];
    const fromIndex = nextEvents.findIndex((event) => event.id === sourceId);
    if (fromIndex < 0) return;
    const [draggedEvent] = nextEvents.splice(fromIndex, 1);
    const targetIndex = nextEvents.findIndex((event) => event.id === targetId);
    if (targetIndex < 0) return;
    const insertIndex = position === 'after' ? targetIndex + 1 : targetIndex;
    nextEvents.splice(insertIndex, 0, draggedEvent);
    persistTimeline({ ...timeline, timelineEvents: nextEvents });
  };

  const clearEventDragState = () => {
    setDraggingEventId(null);
    setDropTarget(null);
  };

  const selectedEvent = useMemo(
    () => timeline?.timelineEvents.find((event) => event.id === selectedEventId) || null,
    [timeline, selectedEventId]
  );

  useEffect(() => {
    if (!timeline) return;
    if (timeline.timelineEvents.length === 0) {
      setSelectedEventId(null);
      setEventDraft(null);
      setIsEditingEvent(false);
      setHasInitializedSelection(false);
      return;
    }
    if (!hasInitializedSelection) {
      setSelectedEventId(timeline.timelineEvents[0].id);
      setHasInitializedSelection(true);
      return;
    }
    if (selectedEventId && !timeline.timelineEvents.some((event) => event.id === selectedEventId)) {
      setSelectedEventId(null);
    }
  }, [timeline, selectedEventId, hasInitializedSelection]);

  useEffect(() => {
    if (!timeline) return;
    if (!selectedEvent) {
      setEventDraft(null);
      setIsEditingEvent(false);
      return;
    }
    if (!isEditingEvent) {
      setEventDraft({ ...selectedEvent });
    }
  }, [timeline, selectedEvent, isEditingEvent]);

  const startEventEdit = () => {
    if (!selectedEvent) return;
    setEventDraft({ ...selectedEvent, title: getEventTitle(selectedEvent) });
    setIsEditingEvent(true);
  };

  const finishEventEdit = () => {
    if (!selectedEvent || !eventDraft) return;
    const normalizedDraft: TimelineEvent = {
      ...selectedEvent,
      ...eventDraft,
      title: (eventDraft.title || '').trim() || getEventTitle(eventDraft),
      time: eventDraft.time || '',
      content: eventDraft.content || '',
    };
    const updatedEvents = timeline.timelineEvents.map((event) =>
      event.id === selectedEvent.id ? normalizedDraft : event
    );
    persistTimeline({ ...timeline, timelineEvents: updatedEvents });
    setIsEditingEvent(false);
  };

  const cancelEventEdit = () => {
    if (selectedEvent) {
      setEventDraft({ ...selectedEvent });
    }
    setIsEditingEvent(false);
  };

  const selectedIndex = selectedEvent
    ? (timeline?.timelineEvents.findIndex((event) => event.id === selectedEvent.id) ?? -1)
    : -1;

  const expandAllPreview = () => {
    toggleAllSections();
    setIsEditingIntro(false);
  };

  if (!timeline) return <div>加载中...</div>;

  return (
    <div className={`${embedded ? 'space-y-6 pb-12' : 'max-w-5xl mx-auto space-y-6 pb-12 px-2 sm:px-0'}`}>
      <EntityDetailHeader
        entity={timeline}
        entityType="timelines"
        backTo="/timelines"
        hideBackButton={embedded}
        deleteLabel="删除时间线"
        onChange={handleChange}
        allVisibleExpanded={allVisibleExpanded}
        onToggleAll={expandAllPreview}
        onSave={saveCampaign}
        onDelete={handleDelete}
      />

      {sectionDefs.some((section) => !isSectionVisible(section.key)) && (
        <div className="flex flex-wrap gap-2">
          {sectionDefs.filter((section) => !isSectionVisible(section.key)).map((section) => (
            <button
              key={section.key}
              type="button"
              onClick={() => setSectionVisible(section.key, true)}
              className="px-3 py-1.5 rounded border border-theme hover:bg-primary-light text-sm"
            >
              恢复{section.title}
            </button>
          ))}
        </div>
      )}

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
          headerActions={<ShareSectionAction entityType="timelines" entity={timeline} sectionKey="intro" />}
        >
          <div className="space-y-3">
            {isEditingIntro ? (
              <RichTextEditor
                value={timeline.details}
                onChange={(val) => handleChange('details', val)}
                placeholder="时间线简介..."
                minHeight="90px"
              />
            ) : (
              <div className="border border-theme rounded-md bg-theme-card/60 px-3 py-3 min-h-[96px]">
                {timeline.details?.trim() ? (
                  <RichTextDisplay content={timeline.details} />
                ) : (
                  <div className="text-sm theme-text-secondary">暂无简介，点击“开始编辑”补充。</div>
                )}
              </div>
            )}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsEditingIntro((prev) => !prev)}
                className="text-xs px-2 py-1 rounded border border-theme theme-text-secondary hover:text-primary"
              >
                {isEditingIntro ? '结束编辑' : '开始编辑'}
              </button>
            </div>
          </div>
        </CollapsibleSection>
      )}

      <section className="rounded-xl border border-theme theme-card p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold">连续时间轴</h3>
            <p className="text-sm theme-text-secondary">
              点击添加节点，单击节点展开备注，也可以直接拖拽节点调整顺序。蓝线会提示插入位置。
            </p>
          </div>
          <button
            onClick={addEvent}
            className="px-3 py-1 bg-primary text-white rounded hover:bg-primary-dark text-sm"
          >
            + 添加节点
          </button>
        </div>

        {timeline.timelineEvents.length === 0 ? (
          <p className="text-center text-gray-400 py-10">暂无事件节点，点击右上角开始添加节点。</p>
        ) : (
          <div className="relative pl-8 before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-theme">
            <div className="space-y-2">
              {timeline.timelineEvents.map((event) => {
                const selected = selectedEventId === event.id;
                const isDropBefore = dropTarget?.id === event.id && dropTarget.position === 'before' && draggingEventId !== event.id;
                const isDropAfter = dropTarget?.id === event.id && dropTarget.position === 'after' && draggingEventId !== event.id;
                return (
                  <div key={event.id} className="relative">
                    {isDropBefore && (
                      <div className="pointer-events-none absolute left-3 right-0 top-0 z-10 flex items-center">
                        <span className="h-3 w-3 -translate-x-1/2 rounded-full bg-primary shadow" />
                        <span className="ml-1 h-1 flex-1 rounded-full bg-primary shadow-[0_0_0_2px_rgba(59,130,246,0.18)]" />
                      </div>
                    )}
                    <div className={`absolute left-3 top-5 h-4 w-4 -translate-x-1/2 rounded-full border-2 ${
                      selected ? 'border-primary bg-primary' : 'border-primary bg-theme-card'
                    }`} />
                    <button
                      type="button"
                      data-timeline-node="true"
                      draggable
                      onDragStart={(dragEvent) => {
                        dragEvent.dataTransfer.effectAllowed = 'move';
                        dragEvent.dataTransfer.setData('text/plain', event.id);
                        setDraggingEventId(event.id);
                        setDropTarget(null);
                      }}
                      onDragOver={(dragEvent) => {
                        if (!draggingEventId || draggingEventId === event.id) return;
                        dragEvent.preventDefault();
                        dragEvent.dataTransfer.dropEffect = 'move';
                        const rect = dragEvent.currentTarget.getBoundingClientRect();
                        const nextPosition = dragEvent.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
                        setDropTarget({ id: event.id, position: nextPosition });
                      }}
                      onDrop={(dragEvent) => {
                        dragEvent.preventDefault();
                        if (draggingEventId && dropTarget?.id === event.id) {
                          reorderEvent(draggingEventId, event.id, dropTarget.position);
                        }
                        clearEventDragState();
                      }}
                      onDragEnd={() => clearEventDragState()}
                      onClick={() => {
                        setSelectedEventId(event.id);
                        setIsEditingEvent(false);
                      }}
                      className={`ml-5 w-[220px] max-w-full rounded-lg border px-3 py-2 text-left transition-colors ${
                        selected
                          ? 'border-primary bg-primary/10 ring-2 ring-primary/20'
                          : 'border-theme hover:bg-primary-light/30'
                      } ${draggingEventId === event.id ? 'opacity-45' : ''}`}
                      title={getEventTitle(event)}
                    >
                      <div className="flex items-start gap-2">
                        <span
                          className="mt-0.5 text-gray-400 shrink-0 cursor-grab active:cursor-grabbing"
                          title="拖拽排序"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <GripVertical size={14} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="text-[11px] font-mono text-primary truncate">
                            {event.time?.trim() || '未标注时间'}
                          </div>
                          <div className="mt-1 text-sm font-semibold truncate">
                            {getEventTitle(event)}
                          </div>
                        </div>
                      </div>
                    </button>
                    {isDropAfter && (
                      <div className="pointer-events-none absolute left-3 right-0 bottom-0 z-10 flex items-center">
                        <span className="h-3 w-3 -translate-x-1/2 rounded-full bg-primary shadow" />
                        <span className="ml-1 h-1 flex-1 rounded-full bg-primary shadow-[0_0_0_2px_rgba(59,130,246,0.18)]" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

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
          headerActions={<ShareSectionAction entityType="timelines" entity={timeline} sectionKey={sectionKey} />}
        >
          <CustomSubItemsEditor
            title={getSectionTitle(sectionKey, '自定义区块') + ' / 子项目'}
            items={getSectionItems(sectionKey)}
            onChange={(items) => setSectionItems(sectionKey, items)}
            ensureOneItem
            defaultFirstItemTitle="详细情况"
            renderItemActions={(item) => <ShareSubItemAction entityType="timelines" entity={timeline} item={item} />}
          />
        </CollapsibleSection>
      ))}

      {selectedEvent && (
        <div data-timeline-note-panel="true" className="fixed inset-x-0 bottom-0 w-full md:inset-auto md:right-6 md:bottom-6 md:w-[380px] bg-theme-card border border-theme rounded-t-xl md:rounded-lg shadow-xl p-3 z-50">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="min-w-0">
              <div className="font-semibold truncate">{getEventTitle(selectedEvent)}</div>
              <div className="text-xs theme-text-secondary">{selectedEvent.time?.trim() || '未标注时间'}</div>
            </div>
          </div>

          {isEditingEvent && eventDraft ? (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  type="text"
                  value={eventDraft.title || ''}
                  onChange={(e) => setEventDraft((prev) => (prev ? { ...prev, title: e.target.value } : prev))}
                  className="w-full px-3 py-2 rounded border border-theme bg-transparent"
                  placeholder="短标题"
                />
                <input
                  type="text"
                  value={eventDraft.time || ''}
                  onChange={(e) => setEventDraft((prev) => (prev ? { ...prev, time: e.target.value } : prev))}
                  className="w-full px-3 py-2 rounded border border-theme bg-transparent"
                  placeholder="时间"
                />
              </div>
              <RichTextEditor
                value={eventDraft.content || ''}
                onChange={(value) => setEventDraft((prev) => (prev ? { ...prev, content: value } : prev))}
                placeholder="节点备注..."
                minHeight="150px"
              />
              <label className="flex items-center gap-2 text-sm theme-text-secondary">
                <input
                  type="checkbox"
                  checked={Boolean(eventDraft.isRevealed)}
                  onChange={(e) => setEventDraft((prev) => (prev ? { ...prev, isRevealed: e.target.checked } : prev))}
                  className="rounded text-primary focus:ring-primary"
                />
                节点公开
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={finishEventEdit}
                  className="px-3 py-2 rounded bg-primary text-white hover:bg-primary-dark"
                >
                  完成编辑
                </button>
                <button
                  type="button"
                  onClick={cancelEventEdit}
                  className="px-3 py-2 rounded border border-theme hover:bg-primary-light"
                >
                  取消
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="min-h-[120px] rounded border border-theme p-3 bg-theme-card/60 overflow-auto">
                {selectedEvent.content?.trim() ? (
                  <RichTextDisplay content={selectedEvent.content} />
                ) : (
                  <div className="text-sm theme-text-secondary">暂无备注，点击“开始编辑”即可补充。</div>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={startEventEdit}
                  className="px-3 py-2 rounded bg-primary text-white hover:bg-primary-dark"
                >
                  开始编辑
                </button>
                <button
                  type="button"
                  onClick={addEventAfterSelected}
                  className="px-3 py-2 rounded border border-theme hover:bg-primary-light"
                >
                  在此节点后添加节点
                </button>
                <button
                  type="button"
                  onClick={() => selectedIndex > 0 && moveEvent(selectedIndex, 'up')}
                  disabled={selectedIndex <= 0}
                  className="px-3 py-2 rounded border border-theme hover:bg-primary-light disabled:opacity-40"
                >
                  上移
                </button>
                <button
                  type="button"
                  onClick={() => selectedIndex >= 0 && selectedIndex < timeline.timelineEvents.length - 1 && moveEvent(selectedIndex, 'down')}
                  disabled={selectedIndex < 0 || selectedIndex >= timeline.timelineEvents.length - 1}
                  className="px-3 py-2 rounded border border-theme hover:bg-primary-light disabled:opacity-40"
                >
                  下移
                </button>
                <button
                  type="button"
                  onClick={() => deleteEvent(selectedEvent.id)}
                  className="px-3 py-2 rounded border border-red-300 text-red-600 hover:bg-red-50"
                >
                  删除节点
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TimelineDetail;
