import type { CharacterSheetDocument, CharacterSheetMemberPermission } from '../../generated/api';

export type CharacterSheetSystem = 'coc7' | 'dnd5e';
export type CharacterSheetVisibility = 'owner_only' | 'party_read' | 'party_edit' | 'assigned_only';
export type CharacterSheetMemberPermissionValue = 'read' | 'edit';

const defaultBasePayload = {
  title: '',
  age: '',
  gender: '',
  background: '',
  notes: '',
  avatarAssetPath: '',
  tags: [] as string[],
};

export const cloneSheet = (sheet: CharacterSheetDocument): CharacterSheetDocument => JSON.parse(JSON.stringify(sheet));

export const createDefaultSystemPayload = (system: CharacterSheetSystem) => {
  if (system === 'dnd5e') {
    return {
      base: {
        ...defaultBasePayload,
      },
      dnd5e: {
        race: '',
        className: '',
        subclass: '',
        level: 1,
        alignment: '',
        proficiencyBonus: 2,
        stats: {
          str: 10,
          dex: 10,
          con: 10,
          int: 10,
          wis: 10,
          cha: 10,
        },
        derived: {
          ac: 10,
          initiative: 0,
          speed: '30ft',
          hp: { current: 10, max: 10, temporary: 0 },
          passivePerception: 10,
          spellcastingAbility: '',
          spellSaveDc: 10,
          spellAttackBonus: 2,
          hitDiceTotal: '',
          hitDiceUsed: 0,
        },
        currency: {
          cp: 0,
          sp: 0,
          ep: 0,
          gp: 0,
          pp: 0,
        },
        skills: {
          运动: 0,
          体操: 0,
          巧手: 0,
          隐匿: 0,
          调查: 0,
          奥秘: 0,
          历史: 0,
          自然: 0,
          宗教: 0,
          察觉: 0,
          洞悉: 0,
          驯兽: 0,
          医药: 0,
          求生: 0,
          游说: 0,
          欺瞒: 0,
          威吓: 0,
          表演: 0,
        },
      },
    };
  }

  return {
    base: {
      ...defaultBasePayload,
    },
    coc7: {
      occupation: '',
      stats: {
        str: 50,
        con: 50,
        siz: 50,
        dex: 50,
        app: 50,
        int: 50,
        pow: 50,
        edu: 50,
      },
      derived: {
        hp: { current: 10, max: 10 },
        san: { current: 50, max: 99 },
        mp: { current: 10, max: 10 },
        luck: 50,
        mov: 8,
        build: '0',
        damageBonus: '0',
      },
      backstory: {
        appearance: '',
        ideology: '',
        significantPeople: '',
        meaningfulLocations: '',
        treasuredPossessions: '',
        traits: '',
        injuries: '',
        phobiasAndManias: '',
      },
      skills: [] as Array<{ name: string; value: number }>,
    },
  };
};

export const sanitizeCharacterSheetPayload = (sheet: CharacterSheetDocument): CharacterSheetDocument => {
  const defaults = createDefaultSystemPayload(sheet.system === 'dnd5e' ? 'dnd5e' : 'coc7');
  const avatarAssetPath = sheet.avatarAssetPath || sheet.payload.base.avatarAssetPath || '';
  const base = {
    ...defaults.base,
    ...sheet.payload.base,
    avatarAssetPath,
  };

  if (sheet.system === 'dnd5e') {
    return {
      ...sheet,
      avatarAssetPath,
      payload: {
        base,
        dnd5e: {
          ...(defaults as { dnd5e: Record<string, unknown> }).dnd5e,
          ...(sheet.payload.dnd5e ?? {}),
        },
      },
    };
  }

  return {
    ...sheet,
    avatarAssetPath,
    payload: {
      base,
      coc7: {
        ...(defaults as { coc7: Record<string, unknown> }).coc7,
        ...(sheet.payload.coc7 ?? {}),
      },
    },
  };
};

export const createDefaultDraft = (): CharacterSheetDocument => ({
  id: '',
  campaignId: '',
  name: '',
  system: 'coc7',
  summary: '',
  visibility: 'owner_only',
  memberPermissions: [],
  ownerUserId: '',
  ownerUsername: '',
  createdAt: 0,
  updatedAt: 0,
  updatedBy: '',
  updatedByName: '',
  version: 0,
  avatarAssetPath: '',
  payload: createDefaultSystemPayload('coc7'),
});

export const formatCharacterSheetSystem = (system: string) => (system === 'dnd5e' ? 'DND 5e' : 'CoC 7版');

export const formatCharacterSheetVisibility = (visibility: string) => {
  switch (visibility) {
    case 'party_read':
      return '全团可查看';
    case 'party_edit':
      return '全团可编辑';
    case 'assigned_only':
      return '按成员单独授权';
    default:
      return '仅管理者可见';
  }
};

export const formatCharacterSheetPermission = (permission: string) => {
  switch (permission) {
    case 'edit':
      return '可编辑';
    case 'read':
      return '可查看';
    default:
      return '无权限';
  }
};

export const getCharacterSheetMemberPermission = (
  sheet: Pick<CharacterSheetDocument, 'memberPermissions'>,
  userId: string
): CharacterSheetMemberPermissionValue | '' => {
  const match = (sheet.memberPermissions ?? []).find((item) => item.userId === userId)?.permission;
  return match === 'edit' || match === 'read' ? match : '';
};

export const upsertCharacterSheetMemberPermission = (
  permissions: CharacterSheetMemberPermission[] | null | undefined,
  userId: string,
  permission: CharacterSheetMemberPermissionValue | ''
): CharacterSheetMemberPermission[] => {
  const next = (permissions ?? []).filter((item) => item.userId !== userId);
  if (!permission) {
    return next;
  }
  return [...next, { userId, permission }];
};

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const getRecord = (value: unknown): Record<string, unknown> => (isRecord(value) ? value : {});

export const getStringValue = (value: unknown, fallback = ''): string =>
  typeof value === 'string' ? value : fallback;

export const getNumberValue = (value: unknown, fallback = 0): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

export const getStringArrayValue = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0) : [];

export const parseCommaSeparated = (value: string): string[] =>
  value
    .split(/[,\n]/)
    .map((item) => item.trim())
    .filter(Boolean);

export const getAbilityModifier = (score: number) => Math.floor((score - 10) / 2);

export const formatSignedNumber = (value: number) => (value >= 0 ? `+${value}` : `${value}`);
