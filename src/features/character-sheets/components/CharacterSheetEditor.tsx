import React, { useMemo, useState } from 'react';
import type { CharacterSheetDocument, CharacterSheetPayload } from '../../../generated/api';
import type { CampaignMember, Character } from '../../../types';
import { buildResourceFileUrl } from '../../../services/resourceService';
import { getCampaignRoleLabel } from '../../../utils/campaignRoles';
import CharacterSheetAvatarPickerDialog from './CharacterSheetAvatarPickerDialog';
import CoCSheetFields from './CoCSheetFields';
import DndSheetFields from './DndSheetFields';
import {
  createDefaultSystemPayload,
  getCharacterSheetMemberPermission,
  getRecord,
  parseCommaSeparated,
  sanitizeCharacterSheetPayload,
  upsertCharacterSheetMemberPermission,
} from '../utils';

interface CharacterSheetEditorProps {
  draft: CharacterSheetDocument;
  members: CampaignMember[];
  characters: Character[];
  busy: boolean;
  canManageAccess: boolean;
  canManageEntityLink: boolean;
  onChange: (sheet: CharacterSheetDocument) => void;
  onOpenImport: () => void;
  onCancel: () => void;
  onSave: () => void;
}

const CharacterSheetEditor: React.FC<CharacterSheetEditorProps> = ({
  draft,
  members,
  characters,
  busy,
  canManageAccess,
  canManageEntityLink,
  onChange,
  onOpenImport,
  onCancel,
  onSave,
}) => {
  const [avatarPickerOpen, setAvatarPickerOpen] = useState(false);
  const memberPermissions = useMemo(() => draft.memberPermissions ?? [], [draft.memberPermissions]);
  const ownerOptions = useMemo(
    () => members.filter((member) => member.role === 'PL' || member.userId === draft.ownerUserId),
    [draft.ownerUserId, members]
  );
  const permissionMembers = useMemo(
    () => members.filter((member) => member.role === 'PL' && member.userId !== draft.ownerUserId),
    [draft.ownerUserId, members]
  );

  const updateDraft = (updater: (current: CharacterSheetDocument) => CharacterSheetDocument) => {
    onChange(sanitizeCharacterSheetPayload(updater(draft)));
  };

  const updateBaseField = (key: keyof CharacterSheetPayload['base'], value: string | string[]) => {
    updateDraft((current) => ({
      ...current,
      ...(key === 'avatarAssetPath' && typeof value === 'string' ? { avatarAssetPath: value } : {}),
      payload: {
        ...current.payload,
        base: {
          ...current.payload.base,
          [key]: value,
        },
      },
    }));
  };

  const updateSystemField = (key: string, value: string | number) => {
    updateDraft((current) => {
      const systemKey = current.system === 'dnd5e' ? 'dnd5e' : 'coc7';
      const currentSystemPayload = getRecord(current.payload[systemKey]);
      return {
        ...current,
        payload: {
          ...current.payload,
          [systemKey]: {
            ...currentSystemPayload,
            [key]: value,
          },
        },
      };
    });
  };

  const updateSystemNestedField = (sectionKey: string, key: string, value: string | number) => {
    updateDraft((current) => {
      const systemKey = current.system === 'dnd5e' ? 'dnd5e' : 'coc7';
      const currentSystemPayload = getRecord(current.payload[systemKey]);
      const nested = getRecord(currentSystemPayload[sectionKey]);
      return {
        ...current,
        payload: {
          ...current.payload,
          [systemKey]: {
            ...currentSystemPayload,
            [sectionKey]: {
              ...nested,
              [key]: value,
            },
          },
        },
      };
    });
  };

  const updateSystemDoubleNestedField = (sectionKey: string, nestedKey: string, key: string, value: number) => {
    updateDraft((current) => {
      const systemKey = current.system === 'dnd5e' ? 'dnd5e' : 'coc7';
      const currentSystemPayload = getRecord(current.payload[systemKey]);
      const section = getRecord(currentSystemPayload[sectionKey]);
      const nested = getRecord(section[nestedKey]);
      return {
        ...current,
        payload: {
          ...current.payload,
          [systemKey]: {
            ...currentSystemPayload,
            [sectionKey]: {
              ...section,
              [nestedKey]: {
                ...nested,
                [key]: value,
              },
            },
          },
        },
      };
    });
  };

  const handleOwnerChange = (ownerUserId: string) => {
    const nextOwner = members.find((member) => member.userId === ownerUserId);
    if (!nextOwner) return;
    updateDraft((current) => ({
      ...current,
      ownerUserId: nextOwner.userId,
      ownerUsername: nextOwner.username,
      memberPermissions: (current.memberPermissions ?? []).filter((item) => item.userId !== nextOwner.userId),
    }));
  };

  const handleMemberPermissionChange = (userId: string, permission: '' | 'read' | 'edit') => {
    updateDraft((current) => ({
      ...current,
      memberPermissions: upsertCharacterSheetMemberPermission(current.memberPermissions, userId, permission),
    }));
  };

  return (
    <>
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          onClick={onOpenImport}
          className="px-3 py-1.5 rounded border border-theme hover:bg-primary-light text-sm"
        >
          文本导入覆盖
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 rounded border border-theme hover:bg-primary-light text-sm"
        >
          取消编辑
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={busy}
          className="px-3 py-1.5 rounded bg-primary text-white hover:bg-primary-dark disabled:opacity-60 text-sm"
        >
          保存角色卡
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label className="space-y-1 text-sm">
          <span className="theme-text-secondary">名称</span>
          <input
            value={draft.name}
            onChange={(event) => onChange({ ...draft, name: event.target.value })}
            className="w-full px-3 py-2 border border-theme rounded bg-transparent"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="theme-text-secondary">系统</span>
          <select
            value={draft.system}
            onChange={(event) => {
              const nextSystem = event.target.value as 'coc7' | 'dnd5e';
              const nextPayload = createDefaultSystemPayload(nextSystem);
              onChange(sanitizeCharacterSheetPayload({
                ...draft,
                system: nextSystem,
                payload: {
                  ...nextPayload,
                  base: {
                    ...nextPayload.base,
                    ...draft.payload.base,
                  },
                },
              }));
            }}
            className="w-full px-3 py-2 border border-theme rounded bg-transparent"
          >
            <option value="coc7">CoC 7版</option>
            <option value="dnd5e">DND 5e</option>
          </select>
        </label>
        <label className="space-y-1 text-sm md:col-span-2">
          <span className="theme-text-secondary">摘要</span>
          <input
            value={draft.summary || ''}
            onChange={(event) => onChange({ ...draft, summary: event.target.value })}
            className="w-full px-3 py-2 border border-theme rounded bg-transparent"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="theme-text-secondary">关联角色实体</span>
          <select
            value={draft.linkedEntityType === 'characters' ? draft.linkedEntityId || '' : ''}
            onChange={(event) => updateDraft((current) => ({
              ...current,
              linkedEntityType: event.target.value ? 'characters' : '',
              linkedEntityId: event.target.value,
            }))}
            disabled={!canManageEntityLink}
            className="w-full px-3 py-2 border border-theme rounded bg-transparent"
          >
            <option value="">不关联角色实体</option>
            {characters.map((character) => (
              <option key={character.id} value={character.id}>
                {character.name}
              </option>
            ))}
          </select>
          {!canManageEntityLink && (
            <div className="text-xs theme-text-secondary">角色实体关联仅 GM / 副GM 可维护，用于快速跳转查看。</div>
          )}
        </label>
        <label className="space-y-1 text-sm">
          <span className="theme-text-secondary">可见性</span>
          <select
            value={draft.visibility}
            onChange={(event) => onChange({ ...draft, visibility: event.target.value })}
            disabled={!canManageAccess}
            className="w-full px-3 py-2 border border-theme rounded bg-transparent"
          >
            <option value="owner_only">仅管理者可见</option>
            <option value="party_read">全团可查看</option>
            <option value="party_edit">全团可编辑</option>
            <option value="assigned_only">按成员单独授权</option>
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="theme-text-secondary">头像资源路径</span>
          <div className="space-y-2">
            {draft.avatarAssetPath ? (
              <div className="flex items-center gap-3 rounded-lg border border-theme p-2 bg-theme-card/60">
                <img
                  src={buildResourceFileUrl(draft.avatarAssetPath)}
                  alt="头像预览"
                  className="h-12 w-12 rounded object-cover border border-theme"
                />
                <div className="min-w-0 flex-1">
                  <div className="text-xs theme-text-secondary">当前资源</div>
                  <div className="text-sm truncate">{draft.avatarAssetPath}</div>
                </div>
              </div>
            ) : (
              <div className="text-xs theme-text-secondary rounded-lg border border-dashed border-theme px-3 py-3">
                当前未关联资源图片。
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setAvatarPickerOpen(true)}
                className="px-3 py-2 border border-theme rounded hover:bg-primary-light text-sm"
              >
                从资源管理选择图片
              </button>
              {draft.avatarAssetPath && (
                <button
                  type="button"
                  onClick={() => updateBaseField('avatarAssetPath', '')}
                  className="px-3 py-2 border border-theme rounded hover:bg-primary-light text-sm"
                >
                  清除头像
                </button>
              )}
            </div>
          </div>
        </label>
        <label className="space-y-1 text-sm">
          <span className="theme-text-secondary">称号</span>
          <input
            value={draft.payload.base.title || ''}
            onChange={(event) => updateBaseField('title', event.target.value)}
            className="w-full px-3 py-2 border border-theme rounded bg-transparent"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="theme-text-secondary">年龄</span>
          <input
            value={draft.payload.base.age || ''}
            onChange={(event) => updateBaseField('age', event.target.value)}
            className="w-full px-3 py-2 border border-theme rounded bg-transparent"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="theme-text-secondary">性别</span>
          <input
            value={draft.payload.base.gender || ''}
            onChange={(event) => updateBaseField('gender', event.target.value)}
            className="w-full px-3 py-2 border border-theme rounded bg-transparent"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="theme-text-secondary">背景</span>
          <input
            value={draft.payload.base.background || ''}
            onChange={(event) => updateBaseField('background', event.target.value)}
            className="w-full px-3 py-2 border border-theme rounded bg-transparent"
          />
        </label>
        <label className="space-y-1 text-sm md:col-span-2">
          <span className="theme-text-secondary">标签</span>
          <input
            value={(draft.payload.base.tags ?? []).join(', ')}
            onChange={(event) => updateBaseField('tags', parseCommaSeparated(event.target.value))}
            placeholder="用逗号分隔，例如：PC, 侦探, 主线"
            className="w-full px-3 py-2 border border-theme rounded bg-transparent"
          />
        </label>
      </div>

      <div className="border border-theme rounded-lg p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm font-medium">归属与成员权限</div>
          {!canManageAccess && (
            <div className="text-xs theme-text-secondary">你当前只能编辑卡面内容，不能修改归属和权限。</div>
          )}
        </div>

        <label className="space-y-1 text-sm block">
          <span className="theme-text-secondary">卡片负责人</span>
          <select
            value={draft.ownerUserId}
            onChange={(event) => handleOwnerChange(event.target.value)}
            disabled={!canManageAccess || ownerOptions.length === 0}
            className="w-full px-3 py-2 border border-theme rounded bg-transparent"
          >
            {ownerOptions.length === 0 ? (
              <option value="">当前没有可归属的 PL 成员</option>
            ) : (
              ownerOptions.map((member) => (
                <option key={member.userId} value={member.userId}>
                  {member.username}
                </option>
              ))
            )}
          </select>
        </label>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {permissionMembers.map((member) => (
            <div key={member.userId} className="flex items-center gap-3 text-sm border border-theme rounded px-3 py-2">
              <div className="min-w-0">
                <div className="font-medium truncate">{member.username}</div>
                <div className="text-xs theme-text-secondary">{getCampaignRoleLabel(member.role)}</div>
              </div>
              <select
                value={getCharacterSheetMemberPermission({ memberPermissions }, member.userId)}
                onChange={(event) => handleMemberPermissionChange(member.userId, event.target.value as '' | 'read' | 'edit')}
                disabled={!canManageAccess}
                className="ml-auto px-3 py-1.5 border border-theme rounded bg-transparent text-sm"
              >
                <option value="">无权限</option>
                <option value="read">可查看</option>
                <option value="edit">可编辑</option>
              </select>
            </div>
          ))}
          {permissionMembers.length === 0 && (
            <div className="text-sm theme-text-secondary border border-dashed border-theme rounded px-3 py-4">
              当前没有可单独授权的其他 PL 成员。
            </div>
          )}
        </div>

        <div className="text-xs theme-text-secondary">
          说明：GM / 副GM 始终拥有完整权限；负责人始终可编辑。
          {draft.visibility === 'assigned_only'
            ? ' 当前为“按成员单独授权”，只有负责人和上方被授权的成员能访问。'
            : ' 当前可见性仍会作为默认权限，上方配置用于补充指定 PL 的个人权限。'}
        </div>
      </div>

      {draft.system === 'coc7' ? (
        <CoCSheetFields
          data={getRecord(draft.payload.coc7)}
          onFieldChange={updateSystemField}
          onNestedFieldChange={updateSystemNestedField}
          onDoubleNestedFieldChange={updateSystemDoubleNestedField}
        />
      ) : (
        <DndSheetFields
          data={getRecord(draft.payload.dnd5e)}
          onFieldChange={updateSystemField}
          onNestedFieldChange={updateSystemNestedField}
          onDoubleNestedFieldChange={updateSystemDoubleNestedField}
        />
      )}

      <label className="space-y-1 text-sm block">
        <span className="theme-text-secondary">备注</span>
        <textarea
          value={draft.payload.base.notes || ''}
          onChange={(event) => updateBaseField('notes', event.target.value)}
          rows={8}
          className="w-full px-3 py-2 border border-theme rounded bg-transparent resize-y"
        />
      </label>
    </div>
      <CharacterSheetAvatarPickerDialog
        open={avatarPickerOpen}
        selectedRef={draft.avatarAssetPath || ''}
        onClose={() => setAvatarPickerOpen(false)}
        onSelect={(ref) => {
          updateBaseField('avatarAssetPath', ref);
          setAvatarPickerOpen(false);
        }}
      />
    </>
  );
};

export default CharacterSheetEditor;
