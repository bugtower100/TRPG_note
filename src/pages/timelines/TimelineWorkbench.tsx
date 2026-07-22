import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { GripVertical, X } from 'lucide-react';
import { useCampaignData } from '../../context/CampaignContext';
import { Timeline, TimelineEvent } from '../../types';
import RichTextEditor from '../../components/common/RichTextEditor';
import RichTextDisplay from '../../components/common/RichTextDisplay';
import { markdownToPreviewText } from '../../components/common/richTextReference';
import { useCampaignMemberRole } from '../../hooks/useCampaignMemberRole';
import {
  getTimelineEventPriority,
  normalizeTimelinePriority,
  TIMELINE_PRIORITY_MAX,
} from '../../utils/timelinePriority';

const BOARD_MIN_HEIGHT = 900;
const BOARD_PADDING_TOP = 120;
const BOARD_PADDING_BOTTOM = 120;
const LANE_WIDTH = 220;
const LANE_GAP = 120;
const DEFAULT_EVENT_STEP = 110;
const EVENT_MIN_Y = 90;

type SelectedNodeRef = {
  timelineId: string;
  eventId: string;
};

type DragNodeState = {
  timelineId: string;
  eventId: string;
  startClientY: number;
  startY: number;
  currentY: number;
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const getEventTitle = (event: TimelineEvent) => {
  const explicit = (event.title || '').trim();
  if (explicit) return explicit;
  const preview = markdownToPreviewText(event.content || '').trim();
  if (preview) return preview.slice(0, 14);
  return event.time?.trim() || '未命名节点';
};

const TimelineWorkbenchContent: React.FC = () => {
  const { campaignData, updateEntity } = useCampaignData();
  const navigate = useNavigate();
  const location = useLocation();
  const boardRef = useRef<HTMLDivElement>(null);
  const suppressClickRef = useRef(false);
  const focusTimelineId = (location.state as { focusTimelineId?: string } | null)?.focusTimelineId;
  const initialFocusHandledRef = useRef(false);

  const [selectedNode, setSelectedNode] = useState<SelectedNodeRef | null>(null);
  const [isEditingEvent, setIsEditingEvent] = useState(false);
  const [eventDraft, setEventDraft] = useState<TimelineEvent | null>(null);
  const [addTimelineId, setAddTimelineId] = useState('');
  const [dragNode, setDragNode] = useState<DragNodeState | null>(null);
  const [priorityRange, setPriorityRange] = useState<{ min: number; max: number } | null>(null);

  const timelines = campaignData.timelines;

  const visibleTimelines = useMemo(
    () => [...timelines]
      .filter((timeline) => timeline.workbenchVisible)
      .sort((a, b) => {
        const orderDiff = (a.workbenchLaneOrder ?? Number.MAX_SAFE_INTEGER) - (b.workbenchLaneOrder ?? Number.MAX_SAFE_INTEGER);
        if (orderDiff !== 0) return orderDiff;
        return a.name.localeCompare(b.name, 'zh-Hans-CN');
      }),
    [timelines]
  );

  const hiddenTimelines = useMemo(
    () => timelines.filter((timeline) => !timeline.workbenchVisible),
    [timelines]
  );

  useEffect(() => {
    if (initialFocusHandledRef.current) return;
    if (!focusTimelineId) {
      initialFocusHandledRef.current = true;
      return;
    }
    const target = timelines.find((timeline) => timeline.id === focusTimelineId);
    if (!target) {
      initialFocusHandledRef.current = true;
      return;
    }
    if (!target.workbenchVisible) {
      const maxOrder = timelines.reduce((max, item) => Math.max(max, item.workbenchLaneOrder ?? -1), -1);
      updateEntity('timelines', {
        ...target,
        workbenchVisible: true,
        workbenchLaneOrder: maxOrder + 1,
      });
    }
    initialFocusHandledRef.current = true;
  }, [focusTimelineId, timelines, updateEntity]);

  useEffect(() => {
    if (!addTimelineId && hiddenTimelines[0]) {
      setAddTimelineId(hiddenTimelines[0].id);
      return;
    }
    if (addTimelineId && !hiddenTimelines.some((timeline) => timeline.id === addTimelineId)) {
      setAddTimelineId(hiddenTimelines[0]?.id || '');
    }
  }, [addTimelineId, hiddenTimelines]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (target.closest('[data-timeline-workbench-node="true"]')) return;
      if (target.closest('[data-timeline-workbench-note-panel="true"]')) return;
      setSelectedNode(null);
      setIsEditingEvent(false);
    };
    window.addEventListener('mousedown', handlePointerDown);
    return () => window.removeEventListener('mousedown', handlePointerDown);
  }, []);

  useEffect(() => {
    if (!dragNode) return;

    const handleMouseMove = (event: MouseEvent) => {
      const boardRect = boardRef.current?.getBoundingClientRect();
      if (!boardRect) return;
      const nextY = clamp(
        dragNode.startY + (event.clientY - dragNode.startClientY),
        EVENT_MIN_Y,
        Math.max(EVENT_MIN_Y, boardRect.height - 80)
      );
      if (Math.abs(nextY - dragNode.startY) > 3) {
        suppressClickRef.current = true;
      }
      setDragNode((prev) => (prev ? { ...prev, currentY: nextY } : prev));
    };

    const handleMouseUp = () => {
      const latestDrag = dragNode;
      setDragNode(null);
      if (!latestDrag) return;
      const timeline = timelines.find((item) => item.id === latestDrag.timelineId);
      if (!timeline) return;
      const updatedTimeline: Timeline = {
        ...timeline,
        timelineEvents: timeline.timelineEvents.map((item) => (
          item.id === latestDrag.eventId ? { ...item, workbenchY: latestDrag.currentY } : item
        )),
      };
      updateEntity('timelines', updatedTimeline);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp, { once: true });
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragNode, timelines, updateEntity]);

  const selectedTimeline = selectedNode
    ? timelines.find((timeline) => timeline.id === selectedNode.timelineId) || null
    : null;

  const selectedEvent = selectedTimeline && selectedNode
    ? selectedTimeline.timelineEvents.find((event) => event.id === selectedNode.eventId) || null
    : null;

  useEffect(() => {
    if (!selectedTimeline || !selectedEvent) {
      setEventDraft(null);
      setIsEditingEvent(false);
      return;
    }
    if (!isEditingEvent) {
      setEventDraft({ ...selectedEvent });
    }
  }, [selectedTimeline, selectedEvent, isEditingEvent]);

  useEffect(() => {
    if (!selectedNode) return;
    const timeline = timelines.find((item) => item.id === selectedNode.timelineId);
    if (!timeline?.workbenchVisible) {
      setSelectedNode(null);
      setIsEditingEvent(false);
      return;
    }
    if (!timeline.timelineEvents.some((item) => item.id === selectedNode.eventId)) {
      setSelectedNode(null);
      setIsEditingEvent(false);
      return;
    }
    const event = timeline.timelineEvents.find((item) => item.id === selectedNode.eventId);
    if (event && priorityRange !== null) {
      const priority = getTimelineEventPriority(event);
      if (priority >= priorityRange.min && priority <= priorityRange.max) return;
      setSelectedNode(null);
      setIsEditingEvent(false);
    }
  }, [priorityRange, selectedNode, timelines]);

  const boardHeight = useMemo(() => {
    const maxY = visibleTimelines.reduce((currentMax, timeline) => {
      const timelineMax = timeline.timelineEvents.reduce((eventMax, event, index) => {
        const priority = getTimelineEventPriority(event);
        if (priorityRange !== null && (priority < priorityRange.min || priority > priorityRange.max)) return eventMax;
        const fallbackY = BOARD_PADDING_TOP + index * DEFAULT_EVENT_STEP;
        return Math.max(eventMax, event.workbenchY ?? fallbackY);
      }, 0);
      return Math.max(currentMax, timelineMax);
    }, 0);
    return Math.max(BOARD_MIN_HEIGHT, maxY + BOARD_PADDING_BOTTOM);
  }, [priorityRange, visibleTimelines]);

  const boardWidth = Math.max(960, visibleTimelines.length * (LANE_WIDTH + LANE_GAP) + 160);

  const addTimelineToWorkbench = () => {
    const target = timelines.find((timeline) => timeline.id === addTimelineId);
    if (!target) return;
    const maxOrder = timelines.reduce((max, item) => Math.max(max, item.workbenchLaneOrder ?? -1), -1);
    updateEntity('timelines', {
      ...target,
      workbenchVisible: true,
      workbenchLaneOrder: maxOrder + 1,
    });
    setAddTimelineId('');
  };

  const removeTimelineFromWorkbench = (timeline: Timeline) => {
    updateEntity('timelines', {
      ...timeline,
      workbenchVisible: false,
    });
    if (selectedNode?.timelineId === timeline.id) {
      setSelectedNode(null);
      setIsEditingEvent(false);
    }
  };

  const startEventEdit = () => {
    if (!selectedEvent) return;
    setEventDraft({ ...selectedEvent, title: getEventTitle(selectedEvent) });
    setIsEditingEvent(true);
  };

  const finishEventEdit = () => {
    if (!selectedTimeline || !selectedEvent || !eventDraft) return;
    const normalizedDraft: TimelineEvent = {
      ...selectedEvent,
      ...eventDraft,
      title: (eventDraft.title || '').trim() || getEventTitle(eventDraft),
      priority: normalizeTimelinePriority(eventDraft.priority),
      time: eventDraft.time || '',
      content: eventDraft.content || '',
    };
    updateEntity('timelines', {
      ...selectedTimeline,
      timelineEvents: selectedTimeline.timelineEvents.map((event) => (
        event.id === selectedEvent.id ? normalizedDraft : event
      )),
    });
    setIsEditingEvent(false);
  };

  const cancelEventEdit = () => {
    if (selectedEvent) {
      setEventDraft({ ...selectedEvent });
    }
    setIsEditingEvent(false);
  };

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold">时间线工作版</h2>
          <p className="text-sm theme-text-secondary">把多条时间线放到同一张画布里，对齐节点位置来比较不同线索的发展。</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-sm theme-text-secondary">
            显示优先级
            <select
              value={priorityRange?.min ?? 'all'}
              onChange={(event) => {
                if (event.target.value === 'all') {
                  setPriorityRange(null);
                  return;
                }
                const min = Number(event.target.value);
                setPriorityRange((current) => ({ min, max: Math.max(min, current?.max ?? min) }));
              }}
              className="px-3 py-2 border border-theme rounded-md bg-theme-card text-sm"
            >
              <option value="all">全部</option>
              {Array.from({ length: TIMELINE_PRIORITY_MAX + 1 }, (_, priority) => (
                <option key={priority} value={priority}>从 {priority}</option>
              ))}
            </select>
            {priorityRange && (
              <select
                value={priorityRange.max}
                onChange={(event) => {
                  const max = Number(event.target.value);
                  setPriorityRange((current) => ({ min: Math.min(current?.min ?? max, max), max }));
                }}
                className="px-3 py-2 border border-theme rounded-md bg-theme-card text-sm"
                aria-label="优先级范围结束值"
              >
                {Array.from({ length: TIMELINE_PRIORITY_MAX + 1 }, (_, priority) => (
                  <option key={priority} value={priority}>到 {priority}</option>
                ))}
              </select>
            )}
          </label>
          <button
            type="button"
            onClick={() => navigate('/timelines')}
            className="px-3 py-2 border border-theme rounded-md hover:bg-primary-light transition-colors"
          >
            返回时间线
          </button>
          <select
            value={addTimelineId}
            onChange={(event) => setAddTimelineId(event.target.value)}
            className="min-w-[220px] px-3 py-2 border border-theme rounded-md bg-transparent text-sm"
            disabled={hiddenTimelines.length === 0}
          >
            {hiddenTimelines.length === 0 ? (
              <option value="">已全部加入工作版</option>
            ) : (
              <>
                <option value="">选择时间线</option>
                {hiddenTimelines.map((timeline) => (
                  <option key={timeline.id} value={timeline.id}>
                    {timeline.name}
                  </option>
                ))}
              </>
            )}
          </select>
          <button
            type="button"
            onClick={addTimelineToWorkbench}
            disabled={!addTimelineId}
            className="px-3 py-2 bg-primary text-white rounded-md hover:bg-primary-dark disabled:opacity-50 transition-colors"
          >
            添加到工作版
          </button>
        </div>
      </div>

      {visibleTimelines.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {visibleTimelines.map((timeline) => (
            <span key={timeline.id} className="inline-flex items-center gap-2 rounded-full border border-theme px-3 py-1 text-sm bg-theme-card">
              {timeline.name}
              <button
                type="button"
                onClick={() => removeTimelineFromWorkbench(timeline)}
                className="text-gray-400 hover:text-red-500"
                title="从工作版移除"
              >
                <X size={14} />
              </button>
            </span>
          ))}
        </div>
      )}

      {timelines.length === 0 ? (
        <div className="text-center py-12 theme-text-secondary bg-theme-card rounded-lg border border-dashed border-theme">
          暂无时间线，请先在时间线页面创建一条时间线。
        </div>
      ) : visibleTimelines.length === 0 ? (
        <div className="text-center py-12 theme-text-secondary bg-theme-card rounded-lg border border-dashed border-theme">
          工作版还是空的，请先把需要对比的时间线加入画布。
        </div>
      ) : (
        <div className="rounded-2xl border border-theme theme-card overflow-hidden">
          <div className="px-4 py-3 border-b border-theme bg-theme-card/70 text-sm theme-text-secondary">
            画布支持纵向拖拽节点位置，单击节点在右下角查看或编辑备注。
          </div>
          <div className="overflow-auto">
            <div
              ref={boardRef}
              className="relative"
              style={{
                width: `${boardWidth}px`,
                height: `${boardHeight}px`,
                backgroundImage: 'linear-gradient(to right, rgba(148,163,184,0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(148,163,184,0.08) 1px, transparent 1px)',
                backgroundSize: '56px 56px',
              }}
            >
              {visibleTimelines.map((timeline, laneIndex) => {
                const laneCenter = 120 + laneIndex * (LANE_WIDTH + LANE_GAP);
                return (
                  <div
                    key={timeline.id}
                    className="absolute top-0"
                    style={{ left: `${laneCenter}px`, width: `${LANE_WIDTH}px`, transform: 'translateX(-50%)' }}
                  >
                    <div className="sticky top-0 z-10 px-2 py-3">
                      <div className="rounded-xl border border-theme bg-theme-card/90 backdrop-blur px-3 py-2 text-center shadow-sm">
                        <div className="font-semibold truncate" title={timeline.name}>{timeline.name}</div>
                        <button
                          type="button"
                          onClick={() => navigate(`/timelines/${timeline.id}`)}
                          className="mt-1 text-xs theme-text-secondary hover:text-primary"
                        >
                          双击打开时间线
                        </button>
                      </div>
                    </div>

                    <div
                      className="absolute top-20 bottom-10 left-1/2 w-0.5 bg-primary/70"
                      style={{ transform: 'translateX(-50%)' }}
                    />

                    {timeline.timelineEvents.map((event, index) => {
                      const priority = getTimelineEventPriority(event);
                      if (priorityRange !== null && (priority < priorityRange.min || priority > priorityRange.max)) return null;
                      const fallbackY = BOARD_PADDING_TOP + index * DEFAULT_EVENT_STEP;
                      const currentY = dragNode?.timelineId === timeline.id && dragNode.eventId === event.id
                        ? dragNode.currentY
                        : (event.workbenchY ?? fallbackY);
                      const isSelected = selectedNode?.timelineId === timeline.id && selectedNode.eventId === event.id;
                      return (
                        <button
                          key={event.id}
                          type="button"
                          data-timeline-workbench-node="true"
                          onMouseDown={(eventMouseDown) => {
                            suppressClickRef.current = false;
                            setDragNode({
                              timelineId: timeline.id,
                              eventId: event.id,
                              startClientY: eventMouseDown.clientY,
                              startY: currentY,
                              currentY,
                            });
                          }}
                          onClick={() => {
                            if (suppressClickRef.current) {
                              suppressClickRef.current = false;
                              return;
                            }
                            setSelectedNode({ timelineId: timeline.id, eventId: event.id });
                            setIsEditingEvent(false);
                          }}
                          className="absolute group"
                          style={{
                            top: `${currentY}px`,
                            left: `calc(50% + ${priorityRange === null ? priority * 6 : 0}px)`,
                            transform: 'translate(-50%, -50%)',
                            width: `${LANE_WIDTH}px`,
                          }}
                        >
                          <div className="flex items-center gap-3">
                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-primary bg-theme-card shadow-sm cursor-grab active:cursor-grabbing">
                              <GripVertical size={16} className="text-primary" />
                            </span>
                            <div className={`min-w-0 flex-1 rounded-xl border px-3 py-2 text-left shadow-sm transition ${
                              isSelected ? 'border-primary bg-primary/10 ring-2 ring-primary/20' : 'border-theme bg-theme-card/95 group-hover:bg-primary-light/30'
                            }`}>
                              <div className="text-[11px] font-mono text-primary truncate">
                                {event.time?.trim() || '未标注时间'}
                              </div>
                              <div className="text-[10px] theme-text-secondary">优先级 {priority}</div>
                              <div className="mt-0.5 text-sm font-semibold truncate" title={getEventTitle(event)}>
                                {getEventTitle(event)}
                              </div>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {selectedTimeline && selectedEvent && (
        <div
          data-timeline-workbench-note-panel="true"
          className="fixed inset-x-0 bottom-0 w-full md:inset-auto md:right-6 md:bottom-6 md:w-[400px] bg-theme-card border border-theme rounded-t-xl md:rounded-lg shadow-xl p-3 z-50"
        >
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="min-w-0">
              <div className="font-semibold truncate">{getEventTitle(selectedEvent)}</div>
              <div className="text-xs theme-text-secondary truncate">
                {selectedTimeline.name} · {selectedEvent.time?.trim() || '未标注时间'}
              </div>
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
              <label className="flex items-center gap-2 text-sm theme-text-secondary">
                优先级
                <select
                  value={normalizeTimelinePriority(eventDraft.priority)}
                  onChange={(event) => setEventDraft((prev) => (prev ? { ...prev, priority: Number(event.target.value) } : prev))}
                  className="px-3 py-2 rounded border border-theme bg-theme-card"
                >
                  {Array.from({ length: TIMELINE_PRIORITY_MAX + 1 }, (_, priority) => (
                    <option key={priority} value={priority}>{priority}{priority === 0 ? '（最高）' : ''}</option>
                  ))}
                </select>
              </label>
              <RichTextEditor
                value={eventDraft.content || ''}
                onChange={(value) => setEventDraft((prev) => (prev ? { ...prev, content: value } : prev))}
                placeholder="节点备注..."
                minHeight="150px"
              />
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
                  onClick={() => navigate(`/timelines/${selectedTimeline.id}`)}
                  className="px-3 py-2 rounded border border-theme hover:bg-primary-light"
                >
                  打开原时间线
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const TimelineWorkbench: React.FC = () => {
  const { canManageCampaignContent } = useCampaignMemberRole();

  if (!canManageCampaignContent) {
    return (
      <div className="text-center py-12 theme-text-secondary bg-theme-card rounded-lg border border-dashed border-theme">
        时间线工作版仅对 GM / 副GM 开放。
      </div>
    );
  }

  return <TimelineWorkbenchContent />;
};

export default TimelineWorkbench;
