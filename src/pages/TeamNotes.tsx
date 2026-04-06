import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, FilePlus2, History, Lock, Trash2, Unlock } from 'lucide-react';
import RichTextEditor from '../components/common/RichTextEditor';
import RichTextDisplay from '../components/common/RichTextDisplay';
import ConfirmDialog from '../components/common/ConfirmDialog';
import { useCampaign } from '../context/CampaignContext';
import { CampaignConfig, TeamNoteDocument } from '../types';
import { teamNotesService } from '../services/teamNotesService';
import { useNavigate, useSearchParams } from 'react-router-dom';

const TeamNotes: React.FC = () => {
  const { currentCampaignId, user } = useCampaign();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [config, setConfig] = useState<CampaignConfig | null>(null);
  const [notes, setNotes] = useState<TeamNoteDocument[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftContent, setDraftContent] = useState('');
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [deletingNote, setDeletingNote] = useState<TeamNoteDocument | null>(null);
  const [leaseStartedAt, setLeaseStartedAt] = useState<number | null>(null);
  const saveTimerRef = useRef<number | null>(null);
  const cleanupStateRef = useRef<{
    campaignId: string | null;
    noteId: string | null;
    user: typeof user;
    editing: boolean;
    leaseStartedAt: number | null;
  }>({
    campaignId: null,
    noteId: null,
    user: null,
    editing: false,
    leaseStartedAt: null,
  });
  const selectedNote = useMemo(() => notes.find((note) => note.id === selectedId) || null, [notes, selectedId]);
  const requestedNoteId = searchParams.get('noteId');
  const memberRole = useMemo(() => {
    if (!config || !user) return 'PL';
    return config.members.find((member) => member.userId === user.id)?.role || 'PL';
  }, [config, user]);

  const loadAll = React.useCallback(async () => {
    if (!currentCampaignId || !user) return;
    const [nextConfig, nextNotes] = await Promise.all([
      teamNotesService.getConfig(currentCampaignId, user),
      teamNotesService.listTeamNotes(currentCampaignId, user),
    ]);
    setConfig(nextConfig);
    setNotes(nextNotes);
    setSelectedId((prev) => prev ?? nextNotes[0]?.id ?? null);
  }, [currentCampaignId, user]);

  useEffect(() => {
    loadAll().catch(() => setStatusText('团队笔记加载失败'));
  }, [loadAll]);

  useEffect(() => {
    if (!selectedNote || editing) return;
    setDraftTitle(selectedNote.title);
    setDraftContent(selectedNote.content);
  }, [selectedNote, editing]);

  useEffect(() => {
    if (!requestedNoteId || notes.length === 0) return;
    const exists = notes.some((note) => note.id === requestedNoteId);
    if (!exists) return;
    setSelectedId(requestedNoteId);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('noteId');
    setSearchParams(nextParams, { replace: true });
  }, [notes, requestedNoteId, searchParams, setSearchParams]);

  useEffect(() => {
    if (!currentCampaignId || !user) return;
    const timer = window.setInterval(() => {
      loadAll().catch(() => void 0);
    }, 15000);
    return () => window.clearInterval(timer);
  }, [currentCampaignId, loadAll, user]);

  useEffect(() => {
    if (!currentCampaignId || !user || !editing || !selectedNote) return;
    const timer = window.setInterval(() => {
      teamNotesService.refreshLease(currentCampaignId, selectedNote.id, user, memberRole, leaseStartedAt).then((next) => {
        setNotes((prev) => prev.map((item) => item.id === next.id ? next : item));
        setLeaseStartedAt(next.activeLease?.startedAt ?? null);
      }).catch(() => {
        setEditing(false);
        setLeaseStartedAt(null);
        setStatusText('编辑时间已失效，请重新进入编辑');
      });
    }, 60000);
    return () => window.clearInterval(timer);
  }, [currentCampaignId, editing, leaseStartedAt, memberRole, selectedNote, user]);

  useEffect(() => {
    if (!editing || !currentCampaignId || !selectedNote || !user) return;
    const changed = draftTitle !== selectedNote.title || draftContent !== selectedNote.content;
    if (!changed) return;
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      teamNotesService.saveTeamNote(currentCampaignId, selectedNote.id, user, {
        title: draftTitle,
        content: draftContent,
        expectedVersion: selectedNote.version,
        leaseStartedAt,
      }).then((saved) => {
        setNotes((prev) => prev.map((item) => item.id === saved.id ? saved : item));
        setStatusText(`已自动保存：${new Date(saved.updatedAt).toLocaleTimeString()}`);
      }).catch((error) => {
        setStatusText(error instanceof Error ? error.message : '保存失败');
      });
    }, 1200);
    return () => {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };
  }, [currentCampaignId, draftContent, draftTitle, editing, leaseStartedAt, selectedNote, user]);

  useEffect(() => {
    cleanupStateRef.current = {
      campaignId: currentCampaignId,
      noteId: selectedNote?.id ?? null,
      user,
      editing,
      leaseStartedAt,
    };
  }, [currentCampaignId, editing, leaseStartedAt, selectedNote?.id, user]);

  useEffect(() => {
    return () => {
      const { campaignId, noteId, user: currentUser, editing: isEditing, leaseStartedAt: currentLeaseStartedAt } = cleanupStateRef.current;
      if (!campaignId || !noteId || !currentUser || !isEditing) return;
      teamNotesService.endLease(campaignId, noteId, currentUser, currentLeaseStartedAt).catch(() => void 0);
    };
  }, []);

  const handleCreate = async () => {
    if (!currentCampaignId || !user) return;
    setBusy(true);
    try {
      const created = await teamNotesService.createTeamNote(currentCampaignId, user, '新的团队笔记');
      setNotes((prev) => [created, ...prev]);
      setSelectedId(created.id);
      setDraftTitle(created.title);
      setDraftContent(created.content);
      setStatusText('已创建团队笔记');
    } finally {
      setBusy(false);
    }
  };

  const handleStartEdit = async () => {
    if (!currentCampaignId || !selectedNote || !user) return;
    try {
      const locked = await teamNotesService.startLease(currentCampaignId, selectedNote.id, user, memberRole);
      setNotes((prev) => prev.map((item) => item.id === locked.id ? locked : item));
      setDraftTitle(locked.title);
      setDraftContent(locked.content);
      setLeaseStartedAt(locked.activeLease?.startedAt ?? null);
      setEditing(true);
      setStatusText('已进入编辑状态');
    } catch (error) {
      setStatusText(error instanceof Error ? error.message : '当前无法进入编辑');
    }
  };

  const persistCurrentDraft = async () => {
    if (!currentCampaignId || !selectedNote || !user) return selectedNote;
    const changed = draftTitle !== selectedNote.title || draftContent !== selectedNote.content;
    if (!changed) return selectedNote;
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    const saved = await teamNotesService.saveTeamNote(currentCampaignId, selectedNote.id, user, {
      title: draftTitle,
      content: draftContent,
      expectedVersion: selectedNote.version,
      leaseStartedAt,
    });
    setNotes((prev) => prev.map((item) => item.id === saved.id ? saved : item));
    setStatusText(`已保存：${new Date(saved.updatedAt).toLocaleTimeString()}`);
    return saved;
  };

  const handleStopEdit = async (): Promise<boolean> => {
    if (!currentCampaignId || !selectedNote || !user) return false;
    let shouldExitEdit = false;
    try {
      await persistCurrentDraft();
      await teamNotesService.endLease(currentCampaignId, selectedNote.id, user, leaseStartedAt);
      shouldExitEdit = true;
    } catch (error) {
      setStatusText(error instanceof Error ? error.message : '保存失败，未结束编辑');
      return false;
    } finally {
      if (shouldExitEdit) {
        setEditing(false);
        setLeaseStartedAt(null);
        await loadAll().catch(() => void 0);
      }
    }
    return true;
  };

  const handleToggleEdit = async () => {
    if (editing) {
      await handleStopEdit();
      return;
    }
    await handleStartEdit();
  };

  const handleSelectNote = async (noteId: string) => {
    if (noteId === selectedId) return;
    if (editing) {
      const stopped = await handleStopEdit();
      if (!stopped) return;
    }
    setLeaseStartedAt(null);
    setSelectedId(noteId);
  };

  const handleDeleteNote = async () => {
    if (!currentCampaignId || !user || !deletingNote) return;
    setBusy(true);
    try {
      await teamNotesService.deleteTeamNote(currentCampaignId, deletingNote.id, user);
      const removedId = deletingNote.id;
      setDeletingNote(null);
      setNotes((prev) => prev.filter((item) => item.id !== removedId));
      setSelectedId((prev) => {
        if (prev !== removedId) return prev;
        const next = notes.find((item) => item.id !== removedId);
        return next?.id ?? null;
      });
      if (selectedId === removedId) {
        setEditing(false);
        setLeaseStartedAt(null);
        setDraftTitle('');
        setDraftContent('');
      }
      setStatusText('团队笔记已删除');
    } finally {
      setBusy(false);
    }
  };

  const leaseLabel = selectedNote?.activeLease && selectedNote.activeLease.userId !== user?.id
    ? `${selectedNote.activeLease.username} 正在编辑...`
    : selectedNote?.activeLease?.userId === user?.id
      ? '你正在编辑'
      : '';

  return (
    <div className="space-y-6">
      <section className="bg-theme-card p-4 rounded-lg border border-theme shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-end gap-4 lg:justify-between">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold">团队笔记</h2>
            <div className="text-sm theme-text-secondary mt-1">
              当前身份：{memberRole} · 模组可见性：{config?.visibility === 'public' ? '公开' : '私密'}
            </div>
          </div>
          <div className="text-sm theme-text-secondary">模组公开/私密请在主页设置</div>
        </div>
        {statusText && <div className="mt-3 text-sm theme-text-secondary">{statusText}</div>}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)] gap-4">
        <aside data-tour="team-notes-list" className="bg-theme-card border border-theme rounded-lg shadow-sm p-3">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="font-semibold">笔记列表</div>
            <button
              type="button"
              onClick={handleCreate}
              disabled={busy}
              className="px-3 py-2 rounded border border-theme hover:bg-primary-light flex items-center gap-2 text-sm"
            >
              <FilePlus2 size={16} />
              新建
            </button>
          </div>
          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            {notes.map((note) => {
              const activeElsewhere = note.activeLease && note.activeLease.userId !== user?.id;
              return (
                <button
                  key={note.id}
                  type="button"
                  onClick={() => void handleSelectNote(note.id)}
                  className={`w-full text-left p-3 rounded border transition-colors ${
                    selectedId === note.id ? 'border-primary bg-primary-light' : 'border-theme hover:bg-primary-light/50'
                  }`}
                >
                  <div className="font-medium truncate">{note.title}</div>
                  <div className="text-xs theme-text-secondary mt-1 truncate">
                    {activeElsewhere ? `${note.activeLease?.username} 正在编辑...` : `版本 ${note.version}`}
                  </div>
                </button>
              );
            })}
            {notes.length === 0 && <div className="text-sm theme-text-secondary p-2">还没有团队笔记</div>}
          </div>
        </aside>

        <section className="bg-theme-card border border-theme rounded-lg shadow-sm p-4 min-h-[520px]">
          {selectedNote ? (
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
                <div className="flex-1 min-w-0">
                  <input
                    value={editing ? draftTitle : selectedNote.title}
                    onChange={(e) => setDraftTitle(e.target.value)}
                    disabled={!editing}
                    className="w-full text-xl font-bold bg-transparent border-b border-theme focus:outline-none focus:border-primary disabled:opacity-100"
                  />
                  <div className="text-xs theme-text-secondary mt-1 flex items-center gap-2">
                    <span>更新者：{selectedNote.updatedByName}</span>
                    <span>·</span>
                    <span>{new Date(selectedNote.updatedAt).toLocaleString()}</span>
                  </div>
                </div>
                <div data-tour="team-notes-editor-actions" className="flex items-center gap-2 flex-wrap">
                  {leaseLabel && (
                    <span className="px-2 py-1 rounded text-xs border border-theme bg-primary-light flex items-center gap-1">
                      <AlertCircle size={14} />
                      {leaseLabel}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => navigate(`/versions?documentType=team_note${selectedNote ? `&documentId=${selectedNote.id}` : ''}`)}
                    className="px-3 py-2 rounded border border-theme hover:bg-primary-light flex items-center gap-2 text-sm"
                  >
                    <History size={16} />
                    历史版本
                  </button>
                  <button
                    type="button"
                    onClick={handleToggleEdit}
                    className={`px-3 py-2 rounded flex items-center gap-2 ${
                      editing
                        ? 'border border-theme hover:bg-primary-light'
                        : 'bg-primary text-white hover:bg-primary-dark'
                    }`}
                  >
                    {editing ? <Lock size={16} /> : <Unlock size={16} />}
                    {editing ? '结束编辑' : '进入编辑'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeletingNote(selectedNote)}
                    className="px-2 py-1.5 rounded border border-red-200 text-red-600 hover:bg-red-50 flex items-center gap-1.5 text-xs ml-2 sm:ml-4"
                    disabled={busy}
                  >
                    <Trash2 size={14} />
                    删除笔记
                  </button>
                </div>
              </div>
              {editing ? (
                <div data-tour="team-notes-editor-body">
                  <RichTextEditor
                    value={draftContent}
                    onChange={setDraftContent}
                    placeholder="记录团队共用笔记..."
                    minHeight="420px"
                    mode="edit"
                  />
                </div>
              ) : (
                <div data-tour="team-notes-editor-body" className="min-h-[420px] border border-theme rounded p-4 overflow-y-auto">
                  <RichTextDisplay content={selectedNote.content} />
                </div>
              )}
            </div>
          ) : (
            <div className="h-full flex items-center justify-center theme-text-secondary">请选择或新建一条团队笔记</div>
          )}
        </section>
      </div>
      <ConfirmDialog
        open={Boolean(deletingNote)}
        title="确认删除团队笔记"
        description={`确定要删除团队笔记「${deletingNote?.title || '未命名笔记'}」吗？此操作不可恢复。`}
        confirmText="删除"
        cancelText="取消"
        onCancel={() => setDeletingNote(null)}
        onConfirm={handleDeleteNote}
      />
    </div>
  );
};

export default TeamNotes;
