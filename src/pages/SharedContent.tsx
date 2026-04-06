import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, ChevronDown, ChevronRight, ChevronUp, History, Plus, Trash2 } from 'lucide-react';
import { useCampaign } from '../context/CampaignContext';
import CustomSubItemsEditor from '../components/common/CustomSubItemsEditor';
import RichTextEditor from '../components/common/RichTextEditor';
import RichTextDisplay from '../components/common/RichTextDisplay';
import { CustomSubItem, GraphEntityType, SharedEntityRecord, TimelineEvent } from '../types';
import { sharingService } from '../services/sharingService';
import { useNavigate } from 'react-router-dom';

type SharedSectionDraft = {
  key: string;
  title: string;
  items: CustomSubItem[];
};

interface SharedContentProps {
  embedded?: boolean;
  shareId?: string;
  entityType?: GraphEntityType;
}

const SharedContent: React.FC<SharedContentProps> = ({ embedded = false, shareId, entityType }) => {
  const { currentCampaignId, user } = useCampaign();
  const navigate = useNavigate();
  const [shares, setShares] = useState<SharedEntityRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [statusText, setStatusText] = useState('');
  const [editing, setEditing] = useState(false);
  const [draftContent, setDraftContent] = useState('');
  const [draftSubItemItems, setDraftSubItemItems] = useState<CustomSubItem[]>([]);
  const [draftSectionItems, setDraftSectionItems] = useState<CustomSubItem[]>([]);
  const [draftDetails, setDraftDetails] = useState('');
  const [draftTimelineEvents, setDraftTimelineEvents] = useState<TimelineEvent[]>([]);
  const [draftEntitySections, setDraftEntitySections] = useState<SharedSectionDraft[]>([]);
  const [leaseStartedAt, setLeaseStartedAt] = useState<number | null>(null);
  const [leaseConflict, setLeaseConflict] = useState(false);
  const [collapsedKeys, setCollapsedKeys] = useState<Record<string, boolean>>({});
  const saveTimerRef = useRef<number | null>(null);
  const cleanupRef = useRef<{
    campaignId: string | null;
    shareId: string | null;
    user: typeof user;
    editing: boolean;
    leaseStartedAt: number | null;
  }>({
    campaignId: null,
    shareId: null,
    user: null,
    editing: false,
    leaseStartedAt: null,
  });

  const loadShares = React.useCallback(async () => {
    if (!currentCampaignId || !user) return;
    const items = await sharingService.listReceivedShares(currentCampaignId, user);
    const next = items.filter((item) => item.targetUserId === user.id && (!entityType || item.entityType === entityType));
    setShares(next);
    setSelectedId((prev) => shareId || prev || next[0]?.id || null);
  }, [currentCampaignId, entityType, shareId, user]);

  useEffect(() => {
    loadShares().catch((error) => setStatusText(error instanceof Error ? error.message : '共享内容加载失败'));
  }, [loadShares]);

  useEffect(() => {
    if (shareId) {
      setSelectedId(shareId);
    }
  }, [shareId]);

  useEffect(() => {
    setCollapsedKeys({});
  }, [selectedId]);

  useEffect(() => {
    if (!currentCampaignId || !user) return;
    const timer = window.setInterval(() => {
      loadShares().catch(() => void 0);
    }, 15000);
    return () => window.clearInterval(timer);
  }, [currentCampaignId, loadShares, user]);

  const selected = useMemo(() => shares.find((item) => item.id === selectedId) || null, [shares, selectedId]);
  const canEditSelected = Boolean(selected && selected.permission === 'edit' && (selected.scope === 'subItem' || selected.scope === 'section' || selected.scope === 'entity'));
  const activeLeaseLabel = useMemo(() => {
    if (!selected?.activeLease) return '';
    const isSelf = selected.activeLease.userId === user?.id;
    return isSelf ? '你正在编辑' : `${selected.activeLease.username} 正在编辑`;
  }, [selected, user?.id]);

  useEffect(() => {
    if (!selected || editing) return;
    setDraftContent(selected.snapshot.subItem?.content || '');
    setDraftSubItemItems(selected.snapshot.subItem ? [{ ...selected.snapshot.subItem }] : []);
    setDraftSectionItems((selected.snapshot.sectionItems || []).map((item) => ({ ...item })));
    setDraftDetails(selected.snapshot.details || '');
    setDraftTimelineEvents((selected.snapshot.timelineEvents || []).map((event) => ({
      id: String(event.id || `timeline_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`),
      time: String(event.time || ''),
      content: String(event.content || ''),
      relations: Array.isArray(event.relations) ? event.relations : [],
      relatedImages: Array.isArray(event.relatedImages) ? event.relatedImages.map((item) => String(item)) : [],
      isRevealed: Boolean(event.isRevealed),
    })));
    setDraftEntitySections((selected.snapshot.allSections || []).map((section) => ({
      key: section.key,
      title: section.title,
      items: section.items.map((item) => ({ ...item })),
    })));
  }, [editing, selected]);

  useEffect(() => {
    cleanupRef.current = {
      campaignId: currentCampaignId,
      shareId: selected?.id ?? null,
      user,
      editing,
      leaseStartedAt,
    };
  }, [currentCampaignId, editing, leaseStartedAt, selected?.id, user]);

  useEffect(() => {
    return () => {
      const { campaignId, shareId, user: currentUser, editing: isEditing, leaseStartedAt: currentLeaseStartedAt } = cleanupRef.current;
      if (!campaignId || !shareId || !currentUser || !isEditing) return;
      sharingService.endShareLease(campaignId, shareId, currentUser, currentLeaseStartedAt).catch(() => void 0);
    };
  }, []);

  useEffect(() => {
    if (!selected || !canEditSelected || editing || !currentCampaignId || !user) return;
    if (selected.activeLease && selected.activeLease.userId !== user.id) {
      setLeaseConflict(true);
      return;
    }
    sharingService.startShareLease(currentCampaignId, selected.id, user)
      .then((next) => {
        setShares((prev) => prev.map((item) => item.id === next.id ? next : item));
        setDraftContent(next.snapshot.subItem?.content || '');
        setDraftSubItemItems(next.snapshot.subItem ? [{ ...next.snapshot.subItem }] : []);
        setDraftSectionItems((next.snapshot.sectionItems || []).map((item) => ({ ...item })));
        setDraftDetails(next.snapshot.details || '');
        setDraftTimelineEvents((next.snapshot.timelineEvents || []).map((event) => ({
          id: String(event.id || `timeline_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`),
          time: String(event.time || ''),
          content: String(event.content || ''),
          relations: Array.isArray(event.relations) ? event.relations : [],
          relatedImages: Array.isArray(event.relatedImages) ? event.relatedImages.map((item) => String(item)) : [],
          isRevealed: Boolean(event.isRevealed),
        })));
        setDraftEntitySections((next.snapshot.allSections || []).map((section) => ({
          key: section.key,
          title: section.title,
          items: section.items.map((item) => ({ ...item })),
        })));
        setLeaseStartedAt(next.activeLease?.startedAt ?? null);
        setLeaseConflict(false);
        setEditing(true);
      })
      .catch((error) => {
        setLeaseConflict(true);
        setStatusText(error instanceof Error ? error.message : '当前无法进入共享编辑');
      });
  }, [canEditSelected, currentCampaignId, editing, selected, user]);

  useEffect(() => {
    if (!editing || !currentCampaignId || !selected || !user) return;
    const timer = window.setInterval(() => {
      sharingService.refreshShareLease(currentCampaignId, selected.id, user, leaseStartedAt)
        .then((next) => {
          setShares((prev) => prev.map((item) => item.id === next.id ? next : item));
          setLeaseStartedAt(next.activeLease?.startedAt ?? null);
        })
        .catch(() => {
          setEditing(false);
          setLeaseStartedAt(null);
          setStatusText('共享编辑状态已失效，请重新进入编辑');
          loadShares().catch(() => void 0);
        });
    }, 60000);
    return () => window.clearInterval(timer);
  }, [currentCampaignId, editing, leaseStartedAt, loadShares, selected, user]);

  useEffect(() => {
    if (!editing || !currentCampaignId || !selected || !user) return;
    const currentContent = selected.scope === 'entity'
      ? JSON.stringify({ details: selected.snapshot.details || '', timelineEvents: selected.snapshot.timelineEvents || [], allSections: selected.snapshot.allSections || [] })
      : selected.scope === 'section'
        ? JSON.stringify(selected.snapshot.sectionItems || [])
        : JSON.stringify(selected.snapshot.subItem ? [selected.snapshot.subItem] : []);
    const nextContent = selected.scope === 'entity'
      ? JSON.stringify({ details: draftDetails, timelineEvents: draftTimelineEvents, allSections: draftEntitySections })
      : selected.scope === 'section'
        ? JSON.stringify(draftSectionItems)
        : JSON.stringify(draftSubItemItems);
    if (nextContent === currentContent) return;
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      sharingService.saveShareContent(currentCampaignId, selected.id, user, {
        content: selected.scope === 'subItem' ? draftContent : undefined,
        subItem: selected.scope === 'subItem' ? (draftSubItemItems[0] ? draftSubItemItems[0] as unknown as Record<string, unknown> : null) : undefined,
        sectionItems: selected.scope === 'section' ? draftSectionItems as unknown as Array<Record<string, unknown>> : undefined,
        details: selected.scope === 'entity' ? draftDetails : undefined,
        timelineEvents: selected.scope === 'entity' ? draftTimelineEvents as unknown as Array<Record<string, unknown>> : undefined,
        allSections: selected.scope === 'entity' ? draftEntitySections as unknown as Array<Record<string, unknown>> : undefined,
        expectedVersion: selected.version,
        leaseStartedAt,
      }).then((next) => {
        setShares((prev) => prev.map((item) => item.id === next.id ? next : item));
        setStatusText(`已自动保存：${new Date(next.updatedAt).toLocaleTimeString()}`);
      }).catch((error) => {
        setStatusText(error instanceof Error ? error.message : '共享内容保存失败');
      });
    }, 1200);
    return () => {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };
  }, [currentCampaignId, draftContent, draftDetails, draftEntitySections, draftSectionItems, draftSubItemItems, draftTimelineEvents, editing, leaseStartedAt, selected, user]);

  const persistDraft = async () => {
    if (!currentCampaignId || !selected || !user) return selected;
    const currentContent = selected.scope === 'entity'
      ? JSON.stringify({ details: selected.snapshot.details || '', timelineEvents: selected.snapshot.timelineEvents || [], allSections: selected.snapshot.allSections || [] })
      : selected.scope === 'section'
        ? JSON.stringify(selected.snapshot.sectionItems || [])
        : JSON.stringify(selected.snapshot.subItem ? [selected.snapshot.subItem] : []);
    const nextContent = selected.scope === 'entity'
      ? JSON.stringify({ details: draftDetails, timelineEvents: draftTimelineEvents, allSections: draftEntitySections })
      : selected.scope === 'section'
        ? JSON.stringify(draftSectionItems)
        : JSON.stringify(draftSubItemItems);
    if (nextContent === currentContent) return selected;
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    const next = await sharingService.saveShareContent(currentCampaignId, selected.id, user, {
      content: selected.scope === 'subItem' ? draftContent : undefined,
      subItem: selected.scope === 'subItem' ? (draftSubItemItems[0] ? draftSubItemItems[0] as unknown as Record<string, unknown> : null) : undefined,
      sectionItems: selected.scope === 'section' ? draftSectionItems as unknown as Array<Record<string, unknown>> : undefined,
      details: selected.scope === 'entity' ? draftDetails : undefined,
      timelineEvents: selected.scope === 'entity' ? draftTimelineEvents as unknown as Array<Record<string, unknown>> : undefined,
      allSections: selected.scope === 'entity' ? draftEntitySections as unknown as Array<Record<string, unknown>> : undefined,
      expectedVersion: selected.version,
      leaseStartedAt,
    });
    setShares((prev) => prev.map((item) => item.id === next.id ? next : item));
    setStatusText(`已保存：${new Date(next.updatedAt).toLocaleTimeString()}`);
    return next;
  };

  const handleStopEdit = async (): Promise<boolean> => {
    if (!currentCampaignId || !selected || !user) return false;
    let shouldExit = false;
    try {
      await persistDraft();
      await sharingService.endShareLease(currentCampaignId, selected.id, user, leaseStartedAt);
      shouldExit = true;
    } catch (error) {
      setStatusText(error instanceof Error ? error.message : '共享内容保存失败，未结束编辑');
      return false;
    } finally {
      if (shouldExit) {
        setEditing(false);
        setLeaseStartedAt(null);
        setLeaseConflict(false);
        await loadShares().catch(() => void 0);
      }
    }
    return true;
  };

  const handleSelectShare = async (shareId: string) => {
    if (shareId === selectedId) return;
    if (editing) {
      const stopped = await handleStopEdit();
      if (!stopped) return;
    }
    setLeaseStartedAt(null);
    setLeaseConflict(false);
    setSelectedId(shareId);
  };

  const handleDeleteShare = async () => {
    if (!currentCampaignId || !selected || !user) return;
    const ok = window.confirm('确定删除这份分享副本吗？删除后将不会再出现在你的列表中。');
    if (!ok) return;
    try {
      await sharingService.revokeShare(currentCampaignId, selected.id, user);
      setStatusText('已删除分享副本');
      if (embedded) {
        navigate(`/${entityType || selected.entityType}`);
        return;
      }
      await loadShares();
      setSelectedId((prev) => (prev === selected.id ? null : prev));
    } catch (error) {
      setStatusText(error instanceof Error ? error.message : '删除分享副本失败');
    }
  };

  const toggleCollapsed = (key: string) => {
    setCollapsedKeys((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const renderSnapshot = (share: SharedEntityRecord) => {
    const snapshot = share.snapshot;
    if (snapshot.scope === 'entity') {
      return (
        <div className="space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            {share.permission === 'edit' && activeLeaseLabel && (
              <span className="px-2 py-1 rounded text-xs border border-theme bg-primary-light flex items-center gap-1">
                <AlertCircle size={14} />
                {activeLeaseLabel}
              </span>
            )}
            {share.permission === 'edit' && leaseConflict && (
              <span className="text-xs theme-text-secondary">当前由他人占用，暂时以只读方式显示</span>
            )}
          </div>
          {(editing || (snapshot.details || '').trim()) && (
            <section className="border border-theme rounded-lg p-4">
              <div className="font-medium mb-3">概览内容</div>
              {editing ? (
                <RichTextEditor
                  value={draftDetails}
                  onChange={setDraftDetails}
                  placeholder="编辑整张共享卡片的概览内容..."
                  minHeight="220px"
                  mode="edit"
                />
              ) : (
                <RichTextDisplay content={snapshot.details || ''} />
              )}
            </section>
          )}
          {share.entityType === 'timelines' && (snapshot.timelineEvents || []).length > 0 && (
            <section className="border border-theme rounded-lg p-4">
              <div className="font-medium mb-3">事件节点</div>
              <div className="space-y-4 relative before:absolute before:left-4 before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-200">
                {(editing ? draftTimelineEvents : (snapshot.timelineEvents || [])).map((event, index) => (
                  <div key={event.id || index} className="relative pl-10">
                    <div className="absolute left-2.5 top-4 w-3 h-3 bg-white border-2 border-primary rounded-full transform -translate-x-1/2"></div>
                    <div className="border border-theme rounded-lg p-4 bg-theme-card">
                      {editing ? (
                        <div className="space-y-3">
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={event.time || ''}
                              onChange={(e) => setDraftTimelineEvents((prev) => prev.map((item, itemIndex) => itemIndex === index ? { ...item, time: e.target.value } : item))}
                              className="flex-1 px-3 py-2 rounded border border-theme bg-transparent"
                              placeholder="时间节点"
                            />
                            <button
                              type="button"
                              onClick={() => setDraftTimelineEvents((prev) => prev.filter((_, itemIndex) => itemIndex !== index))}
                              className="px-2 py-2 rounded border border-red-300 text-red-600 hover:bg-red-50"
                              title="删除节点"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              disabled={index === 0}
                              onClick={() => setDraftTimelineEvents((prev) => {
                                if (index === 0) return prev;
                                const next = [...prev];
                                [next[index - 1], next[index]] = [next[index], next[index - 1]];
                                return next;
                              })}
                              className="px-2 py-1.5 rounded border border-theme hover:bg-primary-light disabled:opacity-40"
                            >
                              <ChevronUp size={14} />
                            </button>
                            <button
                              type="button"
                              disabled={index === draftTimelineEvents.length - 1}
                              onClick={() => setDraftTimelineEvents((prev) => {
                                if (index === prev.length - 1) return prev;
                                const next = [...prev];
                                [next[index + 1], next[index]] = [next[index], next[index + 1]];
                                return next;
                              })}
                              className="px-2 py-1.5 rounded border border-theme hover:bg-primary-light disabled:opacity-40"
                            >
                              <ChevronDown size={14} />
                            </button>
                          </div>
                          <RichTextEditor
                            value={event.content || ''}
                            onChange={(value) => setDraftTimelineEvents((prev) => prev.map((item, itemIndex) => itemIndex === index ? { ...item, content: value } : item))}
                            placeholder="发生了什么..."
                            minHeight="140px"
                            mode="edit"
                          />
                        </div>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => toggleCollapsed(`timeline:${event.id || index}`)}
                            className="w-full flex items-center gap-2 text-left"
                          >
                            {collapsedKeys[`timeline:${event.id || index}`] ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                            <div className="font-medium">{event.time || `事件 ${index + 1}`}</div>
                          </button>
                          {!collapsedKeys[`timeline:${event.id || index}`] && (
                            <div className="mt-3 space-y-2">
                              {event.time && <div className="text-sm theme-text-secondary">{event.time}</div>}
                              <RichTextDisplay content={event.content || ''} />
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                ))}
                {editing && (
                  <button
                    type="button"
                    onClick={() => setDraftTimelineEvents((prev) => [
                      ...prev,
                      {
                        id: `timeline_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
                        time: '',
                        content: '',
                        relations: [],
                        relatedImages: [],
                        isRevealed: false,
                      },
                    ])}
                    className="ml-10 px-3 py-2 rounded border border-theme hover:bg-primary-light text-sm inline-flex items-center gap-2"
                  >
                    <Plus size={16} />
                    新增事件节点
                  </button>
                )}
              </div>
            </section>
          )}
          {(editing ? draftEntitySections : (snapshot.allSections || [])).map((section, sectionIndex) => (
            <section key={section.key} className="border border-theme rounded-lg p-4">
              <div className="font-medium mb-3">{section.title}</div>
              {editing ? (
                <CustomSubItemsEditor
                  title={`${section.title} / 子项目`}
                  items={draftEntitySections[sectionIndex]?.items || []}
                  onChange={(items) => {
                    setDraftEntitySections((prev) => prev.map((draftSection, draftSectionIndex) => (
                      draftSectionIndex === sectionIndex ? { ...draftSection, items } : draftSection
                    )));
                  }}
                  defaultFirstItemTitle="详细情况"
                  useNativeDeleteConfirm
                />
              ) : (
                <div className="space-y-3">
                  {(section.items || []).map((item, itemIndex) => (
                    <div key={item.id || `${section.key}-${itemIndex}`} className="border border-theme rounded p-3">
                      <button
                        type="button"
                        onClick={() => toggleCollapsed(`entity:${section.key}:${item.id || itemIndex}`)}
                        className="w-full flex items-center gap-2 text-left"
                      >
                        {collapsedKeys[`entity:${section.key}:${item.id || itemIndex}`] ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                        <div className="font-medium">{item.title}</div>
                      </button>
                      {!collapsedKeys[`entity:${section.key}:${item.id || itemIndex}`] && (
                        <div className="mt-2">
                          <RichTextDisplay content={item.content || ''} />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>
      );
    }

    if (snapshot.scope === 'section') {
      return (
        <section className="border border-theme rounded-lg p-4">
          <div className="flex items-center gap-2 flex-wrap mb-3">
            <div className="font-medium">{snapshot.sectionTitle || '共享区块'}</div>
            {share.permission === 'edit' && activeLeaseLabel && (
              <span className="px-2 py-1 rounded text-xs border border-theme bg-primary-light flex items-center gap-1">
                <AlertCircle size={14} />
                {activeLeaseLabel}
              </span>
            )}
            {share.permission === 'edit' && leaseConflict && (
              <span className="text-xs theme-text-secondary">当前由他人占用，暂时以只读方式显示</span>
            )}
          </div>
          <div className="space-y-3">
            {editing ? (
              <CustomSubItemsEditor
                title={(snapshot.sectionTitle || '共享区块') + ' / 子项目'}
                items={draftSectionItems}
                onChange={setDraftSectionItems}
                defaultFirstItemTitle="详细情况"
                useNativeDeleteConfirm
              />
            ) : (
              (snapshot.sectionItems || []).map((item, itemIndex) => (
                <div key={item.id || `${itemIndex}`} className="border border-theme rounded p-3">
                  <button
                    type="button"
                    onClick={() => toggleCollapsed(`section:${item.id || itemIndex}`)}
                    className="w-full flex items-center gap-2 text-left"
                  >
                    {collapsedKeys[`section:${item.id || itemIndex}`] ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                    <div className="font-medium">{item.title}</div>
                  </button>
                  {!collapsedKeys[`section:${item.id || itemIndex}`] && (
                    <div className="mt-2">
                      <RichTextDisplay content={item.content || ''} />
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </section>
      );
    }

    return (
      <section className="border border-theme rounded-lg p-4">
        <button
          type="button"
          onClick={() => !editing && toggleCollapsed('subitem:root')}
          className={`w-full flex items-center gap-2 text-left mb-3 ${editing ? 'cursor-default' : ''}`}
        >
          {!editing && (collapsedKeys['subitem:root'] ? <ChevronRight size={16} /> : <ChevronDown size={16} />)}
          <div className="font-medium">{snapshot.subItemTitle || '共享条目'}</div>
        </button>
        {share.permission === 'edit' ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              {activeLeaseLabel && (
                <span className="px-2 py-1 rounded text-xs border border-theme bg-primary-light flex items-center gap-1">
                  <AlertCircle size={14} />
                  {activeLeaseLabel}
                </span>
              )}
              {leaseConflict && <span className="text-xs theme-text-secondary">当前由他人占用，暂时以只读方式显示</span>}
            </div>
            {editing ? (
              <CustomSubItemsEditor
                title={(snapshot.subItemTitle || '共享条目') + ' / 子项目'}
                items={draftSubItemItems}
                onChange={(items) => {
                  setDraftSubItemItems(items);
                  setDraftContent(items[0]?.content || '');
                }}
                defaultFirstItemTitle={snapshot.subItemTitle || '详细情况'}
                useNativeDeleteConfirm
              />
            ) : (
              !collapsedKeys['subitem:root'] && <RichTextDisplay content={snapshot.subItem?.content || ''} />
            )}
          </div>
        ) : (
          !collapsedKeys['subitem:root'] && <RichTextDisplay content={snapshot.subItem?.content || ''} />
        )}
      </section>
    );
  };

  return (
    <div className="space-y-6">
      {!embedded && (
        <section className="bg-theme-card border border-theme rounded-lg shadow-sm p-4">
          <h2 className="text-xl sm:text-2xl font-bold">共享给我的内容</h2>
          <div className="text-sm theme-text-secondary mt-1">这里会显示 GM 分享给你的整张卡片、区块或单条内容。</div>
          {statusText && <div className="text-sm theme-text-secondary mt-2">{statusText}</div>}
        </section>
      )}
      {embedded ? (
        <section className="bg-theme-card border border-theme rounded-lg shadow-sm p-4">
          {selected ? (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <h3 className="text-xl font-bold">{selected.entityName}</h3>
                  <div className="text-sm theme-text-secondary mt-1">
                    {selected.sourceOwnerUsername}分享，
                    <span className={`ml-1 px-2 py-1 rounded text-xs border ${selected.permission === 'read' ? 'border-amber-300 text-amber-700 bg-amber-50' : 'border-blue-300 text-blue-700 bg-blue-50'}`}>
                      {selected.permission === 'read' ? '仅查看' : '可编辑'}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => navigate(`/versions?documentType=shared_entity&documentId=${selected.id}`)}
                  className="px-3 py-2 rounded border border-theme hover:bg-primary-light flex items-center gap-2 text-sm"
                >
                  <History size={16} />
                  历史版本
                </button>
                <button
                  type="button"
                  onClick={() => void handleDeleteShare()}
                  className="px-3 py-2 rounded border border-red-300 text-red-600 hover:bg-red-50 flex items-center gap-2 text-sm"
                >
                  <Trash2 size={16} />
                  删除分享副本
                </button>
              </div>
              {statusText && <div className="text-sm theme-text-secondary">{statusText}</div>}
              {renderSnapshot(selected)}
            </div>
          ) : (
            <div className="h-full min-h-[420px] flex items-center justify-center theme-text-secondary">未找到这项共享内容</div>
          )}
        </section>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)] gap-4">
          <aside className="bg-theme-card border border-theme rounded-lg shadow-sm p-3">
            <div className="font-semibold mb-3">共享列表</div>
            <div className="space-y-2 max-h-[68vh] overflow-y-auto">
              {shares.map((share) => (
                <button
                  key={share.id}
                  type="button"
                  onClick={() => void handleSelectShare(share.id)}
                  className={`w-full text-left p-3 rounded border ${
                    selectedId === share.id ? 'border-primary bg-primary-light' : 'border-theme hover:bg-primary-light/50'
                  }`}
                >
                  <div className="font-medium truncate">{share.entityName}</div>
                  <div className="text-xs theme-text-secondary mt-1 truncate">
                    {share.scope === 'entity' ? '整张卡片' : share.scope === 'section' ? '单个区块' : '单个条目'} · {share.permission === 'read' ? '仅查看' : '可编辑'}
                  </div>
                </button>
              ))}
              {shares.length === 0 && <div className="text-sm theme-text-secondary p-2">当前还没有共享内容</div>}
            </div>
          </aside>
          <section className="bg-theme-card border border-theme rounded-lg shadow-sm p-4">
            {selected ? (
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <h3 className="text-xl font-bold">{selected.entityName}</h3>
                    <div className="text-sm theme-text-secondary mt-1">
                      来自 {selected.sourceOwnerUsername} 分享 ·
                      <span className={`ml-2 px-2 py-1 rounded text-xs border ${selected.permission === 'read' ? 'border-amber-300 text-amber-700 bg-amber-50' : 'border-blue-300 text-blue-700 bg-blue-50'}`}>
                        {selected.permission === 'read' ? '仅查看' : '可编辑'}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => navigate(`/versions?documentType=shared_entity&documentId=${selected.id}`)}
                      className="px-3 py-2 rounded border border-theme hover:bg-primary-light flex items-center gap-2 text-sm"
                    >
                      <History size={16} />
                      历史版本
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDeleteShare()}
                      className="px-3 py-2 rounded border border-red-300 text-red-600 hover:bg-red-50 flex items-center gap-2 text-sm"
                    >
                      <Trash2 size={16} />
                      删除分享副本
                    </button>
                  </div>
                </div>
                {renderSnapshot(selected)}
              </div>
            ) : (
              <div className="h-full min-h-[420px] flex items-center justify-center theme-text-secondary">请选择左侧一项共享内容</div>
            )}
          </section>
        </div>
      )}
    </div>
  );
};

export default SharedContent;
