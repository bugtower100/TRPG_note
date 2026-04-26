import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useCampaign } from '../context/CampaignContext';
import { CampaignConfig, SessionTask, SessionTaskBoardDocument, SessionTaskStatus } from '../types';
import { dataService } from '../services/dataService';
import { teamNotesService } from '../services/teamNotesService';
import { sessionTaskBoardService } from '../services/sessionTaskBoardService';
import { VersionConflictError } from '../services/conflictError';
import ConflictResolveDialog from '../components/common/ConflictResolveDialog';
import { Lock, Unlock, History, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import EntityTagEditor from '../components/common/EntityTagEditor';

const statusOrder: SessionTaskStatus[] = ['todo', 'in_progress', 'done'];
const statusLabel: Record<SessionTaskStatus, string> = {
  todo: '待准备',
  in_progress: '进行中',
  done: '已完成',
};

const parseTagText = (raw: string): string[] =>
  Array.from(
    new Set(
      raw
        .split(/[,，]/)
        .map((item) => item.trim())
        .filter(Boolean)
    )
  );

const resolvePermissions = (doc: SessionTaskBoardDocument | null) => ({
  plCanView: doc?.plCanView ?? true,
  plCanEdit: doc?.plCanEdit ?? true,
});

const SessionTaskBoard: React.FC = () => {
  const { campaignData, setCampaignData, currentCampaignId, user } = useCampaign();
  const navigate = useNavigate();
  const [config, setConfig] = useState<CampaignConfig | null>(null);
  const [boardDoc, setBoardDoc] = useState<SessionTaskBoardDocument | null>(null);
  const [statusText, setStatusText] = useState('');
  const [editing, setEditing] = useState(false);
  const [leaseStartedAt, setLeaseStartedAt] = useState<number | null>(null);
  const [conflictDoc, setConflictDoc] = useState<SessionTaskBoardDocument | null>(null);
  const [titleDraft, setTitleDraft] = useState('');
  const [tagDraft, setTagDraft] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [taskDrafts, setTaskDrafts] = useState<SessionTask[]>([]);
  const [permissionDraft, setPermissionDraft] = useState({ plCanView: true, plCanEdit: true });
  const saveTimerRef = useRef<number | null>(null);
  const cleanupStateRef = useRef<{
    campaignId: string | null;
    user: typeof user;
    editing: boolean;
    leaseStartedAt: number | null;
  }>({
    campaignId: null,
    user: null,
    editing: false,
    leaseStartedAt: null,
  });

  const memberRole = useMemo(() => {
    if (!config || !user) return 'PL';
    return config.members.find((member) => member.userId === user.id)?.role || 'PL';
  }, [config, user]);

  const loadBoard = React.useCallback(async () => {
    if (!currentCampaignId || !user) return;
    const [nextConfig, nextDoc] = await Promise.all([
      teamNotesService.getConfig(currentCampaignId, user),
      sessionTaskBoardService.getTaskBoard(currentCampaignId, user),
    ]);
    setConfig(nextConfig);
    setBoardDoc(nextDoc);
    setPermissionDraft(resolvePermissions(nextDoc));
    if (!editing) {
      setTaskDrafts(nextDoc.tasks);
    }
  }, [currentCampaignId, editing, user]);

  useEffect(() => {
    loadBoard().catch((error) => setStatusText(error instanceof Error ? error.message : '任务看板加载失败'));
  }, [loadBoard]);

  useEffect(() => {
    if (!currentCampaignId || !user) return;
    const timer = window.setInterval(() => {
      if (editing) return;
      loadBoard().catch(() => void 0);
    }, 15000);
    return () => window.clearInterval(timer);
  }, [currentCampaignId, editing, loadBoard, user]);

  useEffect(() => {
    if (!currentCampaignId || !user || !editing) return;
    const timer = window.setInterval(() => {
      sessionTaskBoardService.refreshLease(currentCampaignId, user, memberRole, leaseStartedAt)
        .then((nextDoc) => {
          setBoardDoc(nextDoc);
          setLeaseStartedAt(nextDoc.activeLease?.startedAt ?? null);
        })
        .catch(() => {
          setEditing(false);
          setLeaseStartedAt(null);
          setStatusText('编辑状态已失效，请重新进入编辑');
        });
    }, 60000);
    return () => window.clearInterval(timer);
  }, [currentCampaignId, editing, leaseStartedAt, memberRole, user]);

  useEffect(() => {
    if (!editing || !currentCampaignId || !boardDoc || !user) return;
    const tasksChanged = JSON.stringify(taskDrafts) !== JSON.stringify(boardDoc.tasks);
    const currentPermissions = resolvePermissions(boardDoc);
    const permissionsChanged =
      memberRole === 'GM' &&
      (permissionDraft.plCanView !== currentPermissions.plCanView ||
        permissionDraft.plCanEdit !== currentPermissions.plCanEdit);
    if (!tasksChanged && !permissionsChanged) return;
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      sessionTaskBoardService.saveTaskBoard(currentCampaignId, user, {
        tasks: taskDrafts,
        expectedVersion: boardDoc.version,
        leaseStartedAt,
        ...(memberRole === 'GM' ? permissionDraft : {}),
      }).then((saved) => {
        setBoardDoc(saved);
        setTaskDrafts(saved.tasks);
        setPermissionDraft(resolvePermissions(saved));
        setCampaignData({
          ...campaignData,
          sessionTasks: saved.tasks,
          meta: { ...campaignData.meta, lastModified: Date.now() },
        });
        setStatusText(`已自动保存：${new Date(saved.updatedAt).toLocaleTimeString()}`);
      }).catch((error) => {
        if (error instanceof VersionConflictError && error.remote) {
          setConflictDoc(error.remote);
        }
        setStatusText(error instanceof Error ? error.message : '保存失败');
      });
    }, 1200);
    return () => {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };
  }, [boardDoc, campaignData, currentCampaignId, editing, leaseStartedAt, memberRole, permissionDraft, setCampaignData, taskDrafts, user]);

  useEffect(() => {
    cleanupStateRef.current = {
      campaignId: currentCampaignId,
      user,
      editing,
      leaseStartedAt,
    };
  }, [currentCampaignId, editing, leaseStartedAt, user]);

  useEffect(() => {
    return () => {
      const { campaignId, user: currentUser, editing: isEditing, leaseStartedAt: currentLeaseStartedAt } = cleanupStateRef.current;
      if (!campaignId || !currentUser || !isEditing) return;
      sessionTaskBoardService.endLease(campaignId, currentUser, currentLeaseStartedAt).catch(() => void 0);
    };
  }, []);

  const tagOptions = useMemo(() => {
    const pool = taskDrafts
      .flatMap((item) => item.tags || [])
      .map((item) => item.trim())
      .filter(Boolean);
    return Array.from(new Set(pool)).sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'));
  }, [taskDrafts]);

  const filteredTasks = useMemo(() => {
    const keyword = tagFilter.trim().toLowerCase();
    return taskDrafts.filter((task) => {
      if (keyword && !(task.tags || []).some((tag) => tag.toLowerCase().includes(keyword))) return false;
      return true;
    });
  }, [tagFilter, taskDrafts]);

  const tasksByStatus = useMemo(
    () =>
      statusOrder.reduce<Record<SessionTaskStatus, SessionTask[]>>(
        (acc, status) => {
          acc[status] = filteredTasks.filter((task) => task.status === status);
          return acc;
        },
        { todo: [], in_progress: [], done: [] }
      ),
    [filteredTasks]
  );

  const updateTasks = (updater: (tasks: SessionTask[]) => SessionTask[]) => {
    if (!editing) return;
    setTaskDrafts((prev) => updater(prev));
  };

  const addTask = () => {
    const title = titleDraft.trim();
    if (!title) return;
    const now = Date.now();
    const newTask: SessionTask = {
      id: dataService.generateId(),
      title,
      description: '',
      status: 'todo',
      tags: parseTagText(tagDraft),
      createdAt: now,
      updatedAt: now,
    };
    updateTasks((tasks) => [...tasks, newTask]);
    setTitleDraft('');
    setTagDraft('');
  };

  const patchTask = (taskId: string, patch: Partial<SessionTask>) => {
    updateTasks((tasks) =>
      tasks.map((task) =>
        task.id === taskId
          ? {
              ...task,
              ...patch,
              updatedAt: Date.now(),
            }
          : task
      )
    );
  };

  const deleteTask = (taskId: string) => {
    if (!editing) return;
    if (memberRole !== 'GM') {
      setStatusText('仅 GM 可以删除任务');
      return;
    }
    if (!window.confirm('确定删除这条任务吗？')) return;
    updateTasks((tasks) => tasks.filter((task) => task.id !== taskId));
  };

  const handleStartEdit = async () => {
    if (!currentCampaignId || !user) return;
    try {
      const locked = await sessionTaskBoardService.startLease(currentCampaignId, user, memberRole);
      setBoardDoc(locked);
      setTaskDrafts(locked.tasks);
      setPermissionDraft(resolvePermissions(locked));
      setLeaseStartedAt(locked.activeLease?.startedAt ?? null);
      setEditing(true);
      setStatusText('已进入编辑状态');
    } catch (error) {
      setStatusText(error instanceof Error ? error.message : '当前无法进入编辑');
    }
  };

  const persistCurrentDraft = async () => {
    if (!currentCampaignId || !boardDoc || !user) return boardDoc;
    const tasksChanged = JSON.stringify(taskDrafts) !== JSON.stringify(boardDoc.tasks);
    const currentPermissions = resolvePermissions(boardDoc);
    const permissionsChanged =
      memberRole === 'GM' &&
      (permissionDraft.plCanView !== currentPermissions.plCanView ||
        permissionDraft.plCanEdit !== currentPermissions.plCanEdit);
    if (!tasksChanged && !permissionsChanged) return boardDoc;
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    const saved = await sessionTaskBoardService.saveTaskBoard(currentCampaignId, user, {
      tasks: taskDrafts,
      expectedVersion: boardDoc.version,
      leaseStartedAt,
      ...(memberRole === 'GM' ? permissionDraft : {}),
    });
    setBoardDoc(saved);
    setTaskDrafts(saved.tasks);
    setPermissionDraft(resolvePermissions(saved));
    setCampaignData({
      ...campaignData,
      sessionTasks: saved.tasks,
      meta: { ...campaignData.meta, lastModified: Date.now() },
    });
    setStatusText(`已保存：${new Date(saved.updatedAt).toLocaleTimeString()}`);
    return saved;
  };

  const handleStopEdit = async (): Promise<boolean> => {
    if (!currentCampaignId || !user) return false;
    try {
      await persistCurrentDraft();
      await sessionTaskBoardService.endLease(currentCampaignId, user, leaseStartedAt);
      setEditing(false);
      setLeaseStartedAt(null);
      await loadBoard().catch(() => void 0);
      return true;
    } catch (error) {
      if (error instanceof VersionConflictError && error.remote) {
        setConflictDoc(error.remote);
      }
      setStatusText(error instanceof Error ? error.message : '保存失败，未结束编辑');
      return false;
    }
  };

  const handleToggleEdit = async () => {
    if (editing) {
      await handleStopEdit();
      return;
    }
    await handleStartEdit();
  };

  const handleUseRemoteConflict = () => {
    if (!conflictDoc) return;
    setBoardDoc(conflictDoc);
    setTaskDrafts(conflictDoc.tasks);
    setPermissionDraft(resolvePermissions(conflictDoc));
    setCampaignData({
      ...campaignData,
      sessionTasks: conflictDoc.tasks,
      meta: { ...campaignData.meta, lastModified: Date.now() },
    });
    setConflictDoc(null);
    setStatusText('已加载远端最新版本');
  };

  const handleOverwriteConflict = async () => {
    if (!currentCampaignId || !user || !conflictDoc) return;
    try {
      const saved = await sessionTaskBoardService.saveTaskBoard(currentCampaignId, user, {
        tasks: taskDrafts,
        expectedVersion: conflictDoc.version,
        leaseStartedAt,
        ...(memberRole === 'GM' ? permissionDraft : {}),
      });
      setBoardDoc(saved);
      setTaskDrafts(saved.tasks);
      setPermissionDraft(resolvePermissions(saved));
      setCampaignData({
        ...campaignData,
        sessionTasks: saved.tasks,
        meta: { ...campaignData.meta, lastModified: Date.now() },
      });
      setConflictDoc(null);
      setStatusText(`已覆盖保存：${new Date(saved.updatedAt).toLocaleTimeString()}`);
    } catch (error) {
      if (error instanceof VersionConflictError && error.remote) {
        setConflictDoc(error.remote);
      }
      setStatusText(error instanceof Error ? error.message : '覆盖保存失败');
    }
  };

  const summarizeTasks = (tasks: SessionTask[]) => {
    const lines = tasks.slice(0, 6).map((item) => `- ${item.title || '（无标题）'} · ${statusLabel[item.status]} · ${(item.tags || []).join(' / ') || '无标签'}`);
    if (tasks.length > 6) lines.push(`... 另外 ${tasks.length - 6} 条`);
    return [`任务总数：${tasks.length}`, ...lines].join('\n');
  };

  const leaseLabel = boardDoc?.activeLease && boardDoc.activeLease.userId !== user?.id
    ? `${boardDoc.activeLease.username} 正在编辑...`
    : boardDoc?.activeLease?.userId === user?.id
      ? '你正在编辑'
      : '';
  const canViewBoard = memberRole === 'GM' || permissionDraft.plCanView;
  const canEditBoard = memberRole === 'GM' || permissionDraft.plCanEdit;

  return (
    <div className="space-y-6">
      <div className="bg-theme-card p-4 rounded-lg border border-theme shadow-sm">
        <h2 className="text-2xl font-bold">跑团任务看板</h2>
        <p className="text-sm theme-text-secondary mt-1">GM 主导协作：统一编辑锁、版本冲突保护、成员协作记录。</p>
        <div data-tour="task-board-header" className="text-sm theme-text-secondary mt-2">
          当前身份：{memberRole}
          {boardDoc ? ` · 版本：${boardDoc.version}` : ''}
        </div>
        {memberRole === 'GM' && (
          <div data-tour="task-board-permissions" className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={permissionDraft.plCanView}
                disabled={!editing}
                onChange={(event) => {
                  const value = event.target.checked;
                  setPermissionDraft((prev) => ({ plCanView: value, plCanEdit: value ? prev.plCanEdit : false }));
                }}
              />
              PL 可查看任务看板
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={permissionDraft.plCanEdit}
                disabled={!editing || !permissionDraft.plCanView}
                onChange={(event) => setPermissionDraft((prev) => ({ ...prev, plCanEdit: event.target.checked }))}
              />
              PL 可编辑任务看板
            </label>
          </div>
        )}
        {statusText && <div className="mt-2 text-sm theme-text-secondary">{statusText}</div>}
        <div data-tour="task-board-actions" className="flex flex-wrap items-center gap-2 mt-3">
          {leaseLabel && (
            <span className="px-2 py-1 rounded text-xs border border-theme bg-primary-light flex items-center gap-1">
              <AlertCircle size={14} />
              {leaseLabel}
            </span>
          )}
          <button
            type="button"
            onClick={() => navigate('/versions?documentType=task_board&documentId=session_tasks')}
            className="px-3 py-2 rounded border border-theme hover:bg-primary-light flex items-center gap-2 text-sm"
          >
            <History size={16} />
            历史版本
          </button>
          <button
            type="button"
            onClick={() => void handleToggleEdit()}
            disabled={!editing && !canEditBoard}
            title={!editing && !canEditBoard ? 'GM 已设置你不可编辑任务看板' : undefined}
            className={`px-3 py-2 rounded flex items-center gap-2 ${
              editing ? 'border border-theme hover:bg-primary-light' : 'bg-primary text-white hover:bg-primary-dark'
            }`}
          >
            {editing ? <Lock size={16} /> : <Unlock size={16} />}
            {editing ? '结束编辑' : '进入编辑'}
          </button>
        </div>
      </div>
      {!canViewBoard && (
        <div className="bg-theme-card border border-theme rounded-lg p-4 text-sm theme-text-secondary">
          GM 已将任务看板设置为 PL 不可查看。
        </div>
      )}
      {canViewBoard && (
        <>

      <div data-tour="task-board-create" className="bg-theme-card border border-theme rounded-lg p-4 grid grid-cols-1 md:grid-cols-3 gap-2">
        <input
          type="text"
          value={titleDraft}
          onChange={(event) => setTitleDraft(event.target.value)}
          placeholder="新任务标题"
          disabled={!editing}
          className="px-3 py-2 border border-theme rounded-md bg-transparent"
        />
        <input
          type="text"
          value={tagDraft}
          onChange={(event) => setTagDraft(event.target.value)}
          placeholder="归属标签（可选，逗号分隔）"
          disabled={!editing}
          className="px-3 py-2 border border-theme rounded-md bg-transparent"
        />
        <button
          type="button"
          onClick={addTask}
          disabled={!editing}
          className="px-3 py-2 bg-primary text-white rounded-md hover:bg-primary-dark"
        >
          新增任务
        </button>
      </div>

      <div data-tour="task-board-tags" className="grid grid-cols-1 gap-3">
        <input
          type="text"
          value={tagFilter}
          onChange={(event) => setTagFilter(event.target.value)}
          placeholder="按标签筛选"
          className="px-3 py-2 border border-theme rounded-md bg-transparent"
        />
        {tagOptions.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {tagOptions.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => setTagFilter(tag)}
                className="px-2 py-1 text-xs rounded border border-theme hover:bg-primary-light"
              >
                {tag}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {statusOrder.map((status) => (
          <section key={status} className="bg-theme-card border border-theme rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">{statusLabel[status]}</h3>
              <span className="text-xs theme-text-secondary">{tasksByStatus[status].length} 条</span>
            </div>
            {tasksByStatus[status].length === 0 ? (
              <div className="text-xs theme-text-secondary py-6 text-center border border-dashed border-theme rounded">
                当前无任务
              </div>
            ) : (
              tasksByStatus[status].map((task) => (
                <article key={task.id} className="border border-theme rounded p-3 space-y-2">
                  <input
                    type="text"
                    value={task.title}
                    onChange={(event) => patchTask(task.id, { title: event.target.value })}
                    disabled={!editing}
                    className="w-full px-2 py-1.5 border border-theme rounded bg-transparent font-medium"
                  />
                  <textarea
                    value={task.description}
                    onChange={(event) => patchTask(task.id, { description: event.target.value })}
                    placeholder="任务说明（可选）"
                    disabled={!editing}
                    className="w-full min-h-20 px-2 py-1.5 border border-theme rounded bg-transparent text-sm"
                  />
                  <div className="grid grid-cols-1 gap-2">
                    <EntityTagEditor
                      tags={task.tags || []}
                      disabled={!editing}
                      onChange={(nextTags) => patchTask(task.id, { tags: nextTags })}
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-1">
                    {statusOrder.map((nextStatus) => (
                      <button
                        key={nextStatus}
                        type="button"
                        onClick={() => patchTask(task.id, { status: nextStatus })}
                        disabled={!editing}
                        className={`px-2 py-1 text-xs rounded border ${
                          task.status === nextStatus
                            ? 'bg-primary text-white border-primary'
                            : 'border-theme hover:bg-primary-light'
                        }`}
                      >
                        {statusLabel[nextStatus]}
                      </button>
                    ))}
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => deleteTask(task.id)}
                      disabled={!editing || memberRole !== 'GM'}
                      title={memberRole === 'GM' ? '删除任务' : '仅 GM 可删除任务'}
                      className="text-xs text-red-600 hover:text-red-700"
                    >
                      删除
                    </button>
                  </div>
                </article>
              ))
            )}
          </section>
        ))}
      </div>
        </>
      )}
      <ConflictResolveDialog
        open={Boolean(conflictDoc)}
        title="检测到任务看板编辑冲突"
        description="远端内容已经更新。你可以加载远端版本，或使用当前草稿进行覆盖保存。"
        localSummary={summarizeTasks(taskDrafts)}
        remoteSummary={summarizeTasks(conflictDoc?.tasks || [])}
        onUseRemote={handleUseRemoteConflict}
        onOverwrite={() => void handleOverwriteConflict()}
        onCancel={() => setConflictDoc(null)}
      />
    </div>
  );
};

export default SessionTaskBoard;
