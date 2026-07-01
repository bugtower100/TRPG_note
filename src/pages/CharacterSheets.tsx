import React, { useEffect, useMemo, useState } from 'react';
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import type { CharacterSheetDocument, CharacterSheetImportPreview } from '../generated/api';
import CharacterSheetComparePanel from '../features/character-sheets/components/CharacterSheetComparePanel';
import CharacterSheetEditor from '../features/character-sheets/components/CharacterSheetEditor';
import CharacterSheetImportDialog from '../features/character-sheets/components/CharacterSheetImportDialog';
import CharacterSheetListPanel from '../features/character-sheets/components/CharacterSheetListPanel';
import CharacterSheetPreview from '../features/character-sheets/components/CharacterSheetPreview';
import {
  cloneSheet,
  createDefaultDraft,
  getCharacterSheetMemberPermission,
  sanitizeCharacterSheetPayload,
  type CharacterSheetSystem,
} from '../features/character-sheets/utils';
import { useCampaignData } from '../context/CampaignContext';
import { useCampaignSession } from '../context/CampaignContext';
import { queryKeys } from '../query/queryKeys';
import { characterSheetService } from '../services/characterSheetService';
import { teamNotesService } from '../services/teamNotesService';
import { isCampaignManagerRole } from '../utils/campaignRoles';

const CharacterSheets: React.FC = () => {
  const { campaignData } = useCampaignData();
  const { currentCampaignId, user } = useCampaignSession();
  const { id: sheetId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [createName, setCreateName] = useState('');
  const [createSystem, setCreateSystem] = useState<CharacterSheetSystem>('coc7');
  const [searchText, setSearchText] = useState('');
  const [systemFilter, setSystemFilter] = useState<'all' | CharacterSheetSystem>('all');
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<CharacterSheetDocument>(createDefaultDraft());
  const [statusText, setStatusText] = useState('');
  const [busy, setBusy] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importTarget, setImportTarget] = useState<{
    sheetId: string;
    sheetName: string;
    system: CharacterSheetSystem;
  } | null>(null);
  const [compareSheetIds, setCompareSheetIds] = useState<string[]>([]);

  const listQuery = useQuery({
    queryKey: currentCampaignId ? queryKeys.campaigns.characterSheets(currentCampaignId, user?.id) : ['character-sheets', 'disabled'] as const,
    queryFn: async () => {
      if (!currentCampaignId || !user) return [];
      return characterSheetService.list(currentCampaignId, user);
    },
    enabled: Boolean(currentCampaignId && user),
  });

  const configQuery = useQuery({
    queryKey: currentCampaignId ? queryKeys.campaigns.config(currentCampaignId, user?.id) : ['campaigns', 'character-sheets-config-disabled'] as const,
    queryFn: async () => {
      if (!currentCampaignId || !user) return null;
      return teamNotesService.getConfig(currentCampaignId, user);
    },
    enabled: Boolean(currentCampaignId && user),
  });

  const detailQuery = useQuery({
    queryKey: currentCampaignId && sheetId ? queryKeys.campaigns.characterSheetDetail(currentCampaignId, sheetId, user?.id) : ['character-sheet-detail', 'disabled'] as const,
    queryFn: async () => {
      if (!currentCampaignId || !sheetId || !user) return null;
      return characterSheetService.get(currentCampaignId, sheetId, user);
    },
    enabled: Boolean(currentCampaignId && sheetId && user),
  });

  const memberRole = useMemo(() => {
    if (!configQuery.data || !user) return 'PL';
    return configQuery.data.members.find((member) => member.userId === user.id)?.role || 'PL';
  }, [configQuery.data, user]);

  const canCreateSheet = isCampaignManagerRole(memberRole);
  const members = configQuery.data?.members ?? [];
  const characters = campaignData.characters ?? [];

  const canEditSheet = useMemo(() => {
    const sheet = detailQuery.data;
    if (!sheet || !user) return false;
    if (isCampaignManagerRole(memberRole) || sheet.ownerUserId === user.id) {
      return true;
    }
    if (getCharacterSheetMemberPermission(sheet, user.id) === 'edit') {
      return true;
    }
    if (sheet.visibility === 'party_edit') {
      return true;
    }
    return false;
  }, [detailQuery.data, memberRole, user]);

  const canManageSheetAccess = useMemo(() => {
    const sheet = detailQuery.data;
    if (!sheet || !user) return false;
    return isCampaignManagerRole(memberRole) || sheet.ownerUserId === user.id;
  }, [detailQuery.data, memberRole, user]);

  const compareQueries = useQueries({
    queries: compareSheetIds.map((compareId) => ({
      queryKey: currentCampaignId ? queryKeys.campaigns.characterSheetDetail(currentCampaignId, compareId, user?.id) : ['character-sheet-compare', compareId] as const,
      queryFn: async () => {
        if (!currentCampaignId || !user) return null;
        return characterSheetService.get(currentCampaignId, compareId, user);
      },
      enabled: Boolean(currentCampaignId && user && compareSheetIds.length >= 2),
    })),
  });

  const compareSheets = useMemo(
    () => compareQueries.map((query) => query.data).filter((item): item is CharacterSheetDocument => Boolean(item)),
    [compareQueries]
  );
  const compareLoading = compareQueries.some((query) => query.isLoading);
  const compareMode = compareSheetIds.length >= 2;

  useEffect(() => {
    if (!sheetId && listQuery.data && listQuery.data.length > 0) {
      navigate(`/characters/sheets/${listQuery.data[0].id}`, { replace: true });
    }
  }, [listQuery.data, navigate, sheetId]);

  useEffect(() => {
    if (!detailQuery.data || editing) return;
    setDraft(cloneSheet(detailQuery.data));
  }, [detailQuery.data, editing]);

  const filteredSheets = useMemo(() => {
    const rawSearch = searchText.trim().toLowerCase();
    return (listQuery.data ?? []).filter((sheet) => {
      const matchesSystem = systemFilter === 'all' || sheet.system === systemFilter;
      if (!matchesSystem) return false;
      if (!rawSearch) return true;
      return `${sheet.name} ${sheet.summary}`.toLowerCase().includes(rawSearch);
    });
  }, [listQuery.data, searchText, systemFilter]);

  const handleCreate = async () => {
    if (!currentCampaignId || !user || !canCreateSheet) return;
    setBusy(true);
    try {
      const created = await characterSheetService.create(currentCampaignId, {
        name: createName.trim() || (createSystem === 'dnd5e' ? '新的 DND 角色卡' : '新的 CoC 角色卡'),
        system: createSystem,
        summary: '',
      }, user);
      setCreateName('');
      setStatusText('角色卡已创建。');
      await queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.characterSheets(currentCampaignId, user.id) });
      navigate(`/characters/sheets/${created.id}`);
    } catch (error) {
      setStatusText(error instanceof Error ? error.message : '角色卡创建失败');
    } finally {
      setBusy(false);
    }
  };

  const handleStartEdit = () => {
    if (!detailQuery.data || !canEditSheet) return;
    setDraft(cloneSheet(detailQuery.data));
    setEditing(true);
    setStatusText('');
  };

  const handleCancelEdit = () => {
    if (detailQuery.data) {
      setDraft(cloneSheet(detailQuery.data));
    }
    setEditing(false);
    setStatusText('已放弃未保存修改。');
  };

  const handleSave = async () => {
    if (!currentCampaignId || !user || !canEditSheet) return;
    setBusy(true);
    try {
      const saved = await characterSheetService.update(currentCampaignId, sanitizeCharacterSheetPayload(draft), user);
      queryClient.setQueryData(queryKeys.campaigns.characterSheetDetail(currentCampaignId, saved.id, user.id), saved);
      await queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.characterSheets(currentCampaignId, user.id) });
      setDraft(cloneSheet(saved));
      setEditing(false);
      setStatusText(`已保存：${new Date(saved.updatedAt).toLocaleTimeString()}`);
    } catch (error) {
      setStatusText(error instanceof Error ? error.message : '角色卡保存失败');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!currentCampaignId || !user || !detailQuery.data || !canEditSheet) return;
    if (!window.confirm(`确定要删除角色卡「${detailQuery.data.name}」吗？`)) return;
    setBusy(true);
    try {
      await characterSheetService.remove(currentCampaignId, detailQuery.data.id, user);
      setEditing(false);
      setStatusText('角色卡已删除。');
      await queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.characterSheets(currentCampaignId, user.id) });
      navigate('/characters/sheets');
    } catch (error) {
      setStatusText(error instanceof Error ? error.message : '角色卡删除失败');
    } finally {
      setBusy(false);
    }
  };

  const handlePreviewImport = async (payload: { text: string; systemHint?: string }) => {
    if (!currentCampaignId || !user) {
      throw new Error('当前模组或用户信息缺失');
    }
    return characterSheetService.previewImport(currentCampaignId, payload, user);
  };

  const handleCreateFromImport = async (preview: CharacterSheetImportPreview) => {
    if (!currentCampaignId || !user) {
      throw new Error('当前模组或用户信息缺失');
    }
    setBusy(true);
    try {
      if (importTarget) {
        const currentSheet = detailQuery.data?.id === importTarget.sheetId ? detailQuery.data : null;
        if (!currentSheet) {
          throw new Error('当前角色卡详情尚未加载完成，请稍后再试。');
        }
        if (preview.system !== currentSheet.system) {
          throw new Error('覆盖现有角色卡时，导入系统必须与当前角色卡一致。');
        }
        const nextSheet: CharacterSheetDocument = sanitizeCharacterSheetPayload({
          ...cloneSheet(currentSheet),
          summary: currentSheet.summary || preview.summary || '',
          payload: {
            ...currentSheet.payload,
            base: {
              ...currentSheet.payload.base,
              avatarAssetPath: currentSheet.avatarAssetPath || currentSheet.payload.base.avatarAssetPath || '',
            },
            [currentSheet.system]: preview.payload[currentSheet.system],
          },
        });
        const saved = await characterSheetService.update(currentCampaignId, nextSheet, user);
        queryClient.setQueryData(queryKeys.campaigns.characterSheetDetail(currentCampaignId, saved.id, user.id), saved);
        await queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.characterSheets(currentCampaignId, user.id) });
        setDraft(cloneSheet(saved));
        setEditing(false);
        setStatusText('已按文本导入覆盖当前角色卡的属性与技能。');
        return;
      }

      const created = await characterSheetService.create(currentCampaignId, {
        name: preview.name,
        system: preview.system,
        summary: preview.summary || '',
      }, user);
      const nextSheet: CharacterSheetDocument = {
        ...cloneSheet(created),
        name: preview.name,
        system: preview.system,
        summary: preview.summary || '',
        payload: preview.payload,
        avatarAssetPath: preview.payload.base.avatarAssetPath || created.avatarAssetPath,
      };
      const saved = await characterSheetService.update(currentCampaignId, sanitizeCharacterSheetPayload(nextSheet), user);
      await queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.characterSheets(currentCampaignId, user.id) });
      queryClient.setQueryData(queryKeys.campaigns.characterSheetDetail(currentCampaignId, saved.id, user.id), saved);
      setStatusText('角色卡已根据文本导入创建。');
      navigate(`/characters/sheets/${saved.id}`);
    } finally {
      setBusy(false);
    }
  };

  const toggleCompareSheet = (targetId: string) => {
    setCompareSheetIds((prev) => (
      prev.includes(targetId) ? prev.filter((item) => item !== targetId) : [...prev, targetId].slice(0, 3)
    ));
  };

  const openImportForCurrentSheet = () => {
    if (!detailQuery.data) return;
    setImportTarget({
      sheetId: detailQuery.data.id,
      sheetName: detailQuery.data.name,
      system: detailQuery.data.system as CharacterSheetSystem,
    });
    setImportOpen(true);
  };

  const currentSheet = editing ? draft : detailQuery.data;

  return (
    <>
    <div className="grid grid-cols-1 xl:grid-cols-[300px_minmax(0,1fr)] gap-6">
      <CharacterSheetListPanel
        memberRole={memberRole}
        createName={createName}
        createSystem={createSystem}
        canCreateSheet={canCreateSheet}
        busy={busy}
        searchText={searchText}
        systemFilter={systemFilter}
        sheets={filteredSheets}
        compareSheetIds={compareSheetIds}
        activeSheetId={sheetId}
        isLoading={listQuery.isLoading}
        onCreateNameChange={setCreateName}
        onCreateSystemChange={setCreateSystem}
        onSearchTextChange={setSearchText}
        onSystemFilterChange={setSystemFilter}
        onCreate={() => void handleCreate()}
        onOpenImport={() => {
          setImportTarget(null);
          setImportOpen(true);
        }}
        onToggleCompare={toggleCompareSheet}
        onClearCompare={() => setCompareSheetIds([])}
        onSelectSheet={(nextSheetId) => navigate(`/characters/sheets/${nextSheetId}`)}
      />

      <section className="theme-card border border-theme rounded-xl p-5 space-y-4 min-w-0 shadow-sm">
        {compareMode ? (
          <CharacterSheetComparePanel
            sheets={compareSheets}
            loading={compareLoading}
            onExit={() => setCompareSheetIds([])}
          />
        ) : currentSheet ? (
          <>
            {statusText && (
              <div className="text-sm theme-text-secondary border border-theme rounded-lg px-3 py-2">
                {statusText}
              </div>
            )}

            {editing ? (
              <CharacterSheetEditor
                draft={draft}
                members={members}
                characters={characters}
                busy={busy}
                canManageAccess={canManageSheetAccess}
                canManageEntityLink={isCampaignManagerRole(memberRole)}
                onChange={setDraft}
                onOpenImport={openImportForCurrentSheet}
                onCancel={handleCancelEdit}
                onSave={() => void handleSave()}
              />
            ) : (
              <CharacterSheetPreview
                sheet={currentSheet}
                members={members}
                characters={characters}
                canEditSheet={canEditSheet}
                busy={busy}
                onOpenLinkedCharacter={(characterId) => navigate(`/characters/${characterId}`)}
                onOpenImport={openImportForCurrentSheet}
                onStartEdit={handleStartEdit}
                onDelete={() => void handleDelete()}
              />
            )}
          </>
        ) : (
          <div className="min-h-[360px] flex items-center justify-center text-sm theme-text-secondary">
            请选择一张角色卡，或先在左侧创建新的角色卡。
          </div>
        )}
      </section>
    </div>
    <CharacterSheetImportDialog
      open={importOpen}
      busy={busy}
      mode={importTarget ? 'overwrite' : 'create'}
      targetName={importTarget?.sheetName}
      defaultSystemHint={importTarget?.system ?? 'auto'}
      onClose={() => {
        setImportOpen(false);
        setImportTarget(null);
      }}
      onPreview={handlePreviewImport}
      onImport={handleCreateFromImport}
    />
    </>
  );
};

export default CharacterSheets;
