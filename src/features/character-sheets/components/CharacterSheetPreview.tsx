import React, { useMemo } from 'react';
import type { CharacterSheetDocument } from '../../../generated/api';
import { buildResourceFileUrl } from '../../../services/resourceService';
import type { CampaignMember, Character } from '../../../types';
import {
  formatCharacterSheetSystem,
  formatCharacterSheetPermission,
  formatSignedNumber,
  formatCharacterSheetVisibility,
  getCharacterSheetMemberPermission,
  getAbilityModifier,
  getNumberValue,
  getRecord,
  getStringArrayValue,
  getStringValue,
} from '../utils';

interface CharacterSheetPreviewProps {
  sheet: CharacterSheetDocument;
  members: CampaignMember[];
  characters: Character[];
  canEditSheet: boolean;
  busy: boolean;
  onOpenLinkedCharacter: (characterId: string) => void;
  onOpenImport: () => void;
  onStartEdit: () => void;
  onDelete: () => void;
}

const CharacterSheetPreview: React.FC<CharacterSheetPreviewProps> = ({
  sheet,
  members,
  characters,
  canEditSheet,
  busy,
  onOpenLinkedCharacter,
  onOpenImport,
  onStartEdit,
  onDelete,
}) => {
  const linkedCharacter = useMemo(
    () => (sheet.linkedEntityType === 'characters' ? characters.find((item) => item.id === sheet.linkedEntityId) || null : null),
    [characters, sheet.linkedEntityId, sheet.linkedEntityType]
  );
  const assignedMembers = useMemo(() => {
    return members
      .filter((member) => member.role === 'PL' && member.userId !== sheet.ownerUserId)
      .map((member) => ({
        ...member,
        permission: getCharacterSheetMemberPermission(sheet, member.userId),
      }))
      .filter((member) => member.permission);
  }, [members, sheet]);

  const tags = getStringArrayValue(sheet.payload.base.tags);
  const avatarPath = sheet.avatarAssetPath || sheet.payload.base.avatarAssetPath || '';

  const quickCards = useMemo(() => {
    if (sheet.system === 'dnd5e') {
      const dnd = getRecord(sheet.payload.dnd5e);
      const derived = getRecord(dnd.derived);
      const hp = getRecord(derived.hp);
      return [
        { label: '种族', value: getStringValue(dnd.race, '未填写') },
        { label: '职业', value: getStringValue(dnd.className, '未填写') },
        { label: '等级', value: String(getNumberValue(dnd.level, 1)) },
        { label: 'AC', value: String(getNumberValue(derived.ac, 10)) },
        { label: 'HP', value: `${getNumberValue(hp.current, 10)} / ${getNumberValue(hp.max, 10)}` },
        { label: '速度', value: getStringValue(derived.speed, '未填写') },
      ];
    }

    const coc = getRecord(sheet.payload.coc7);
    const derived = getRecord(coc.derived);
    const hp = getRecord(derived.hp);
    const san = getRecord(derived.san);
    const mp = getRecord(derived.mp);
    return [
      { label: '职业', value: getStringValue(coc.occupation, '未填写') },
      { label: 'HP', value: `${getNumberValue(hp.current, 10)} / ${getNumberValue(hp.max, 10)}` },
      { label: 'SAN', value: `${getNumberValue(san.current, 50)} / ${getNumberValue(san.max, 99)}` },
      { label: 'MP', value: `${getNumberValue(mp.current, 10)} / ${getNumberValue(mp.max, 10)}` },
      { label: '幸运', value: String(getNumberValue(derived.luck, 50)) },
      { label: 'MOV', value: String(getNumberValue(derived.mov, 8)) },
    ];
  }, [sheet]);

  const statGrid = useMemo(() => {
    if (sheet.system === 'dnd5e') {
      const dnd = getRecord(sheet.payload.dnd5e);
      const stats = getRecord(dnd.stats);
      return [
        ['STR', getNumberValue(stats.str, 10)],
        ['DEX', getNumberValue(stats.dex, 10)],
        ['CON', getNumberValue(stats.con, 10)],
        ['INT', getNumberValue(stats.int, 10)],
        ['WIS', getNumberValue(stats.wis, 10)],
        ['CHA', getNumberValue(stats.cha, 10)],
      ] as const;
    }

    const coc = getRecord(sheet.payload.coc7);
    const stats = getRecord(coc.stats);
    return [
      ['STR', getNumberValue(stats.str, 50)],
      ['CON', getNumberValue(stats.con, 50)],
      ['SIZ', getNumberValue(stats.siz, 50)],
      ['DEX', getNumberValue(stats.dex, 50)],
      ['APP', getNumberValue(stats.app, 50)],
      ['INT', getNumberValue(stats.int, 50)],
      ['POW', getNumberValue(stats.pow, 50)],
      ['EDU', getNumberValue(stats.edu, 50)],
    ] as const;
  }, [sheet]);

  const skillCards = useMemo(() => {
    if (sheet.system === 'dnd5e') {
      const dnd = getRecord(sheet.payload.dnd5e);
      const stats = getRecord(dnd.stats);
      const skillMap = getRecord(dnd.skills);
      const proficiencyBonus = getNumberValue(dnd.proficiencyBonus, 2);
      const definitions = [
        ['运动', 'str', '力量'],
        ['体操', 'dex', '敏捷'],
        ['巧手', 'dex', '敏捷'],
        ['隐匿', 'dex', '敏捷'],
        ['调查', 'int', '智力'],
        ['奥秘', 'int', '智力'],
        ['历史', 'int', '智力'],
        ['自然', 'int', '智力'],
        ['宗教', 'int', '智力'],
        ['察觉', 'wis', '感知'],
        ['洞悉', 'wis', '感知'],
        ['驯兽', 'wis', '感知'],
        ['医药', 'wis', '感知'],
        ['求生', 'wis', '感知'],
        ['游说', 'cha', '魅力'],
        ['欺瞒', 'cha', '魅力'],
        ['威吓', 'cha', '魅力'],
        ['表演', 'cha', '魅力'],
      ] as const;
      return definitions.map(([name, abilityKey, abilityLabel]) => {
        const proficiency = getNumberValue(skillMap[name], 0);
        const abilityModifier = getAbilityModifier(getNumberValue(stats[abilityKey], 10));
        const total = abilityModifier + Math.floor(proficiencyBonus * proficiency);
        return {
          name,
          meta: `${abilityLabel} / ${proficiency === 1 ? '熟练' : proficiency === 0.5 ? '半熟练' : '未熟练'}`,
          value: `${total >= 0 ? '+' : ''}${total}`,
        };
      });
    }

    const coc = getRecord(sheet.payload.coc7);
    const rawSkills = Array.isArray(coc.skills) ? coc.skills : [];
    return rawSkills
      .map((item) => {
        const skill = getRecord(item);
        const value = getNumberValue(skill.value, 0);
        return {
          name: getStringValue(skill.name, '未命名技能'),
          meta: '技能值',
          value: `${value}%`,
          sortValue: value,
        };
      })
      .filter((item) => item.name.trim().length > 0)
      .sort((left, right) => right.sortValue - left.sortValue)
      .map(({ sortValue: _sortValue, ...item }) => item);
  }, [sheet]);

  const extraDetails = useMemo(() => {
    if (sheet.system === 'dnd5e') {
      const dnd = getRecord(sheet.payload.dnd5e);
      const derived = getRecord(dnd.derived);
      const currency = getRecord(dnd.currency);
      return [
        `命中骰：${getStringValue(derived.hitDiceTotal, '未填写')} / 已用 ${getNumberValue(derived.hitDiceUsed, 0)}`,
        `施法属性：${getStringValue(derived.spellcastingAbility, '未填写')}`,
        `货币：CP ${getNumberValue(currency.cp, 0)} · SP ${getNumberValue(currency.sp, 0)} · GP ${getNumberValue(currency.gp, 0)}`,
      ];
    }

    const backstory = getRecord(getRecord(sheet.payload.coc7).backstory);
    return [
      `信念 / 思想：${getStringValue(backstory.ideology, '未填写')}`,
      `重要之人：${getStringValue(backstory.significantPeople, '未填写')}`,
      `意义非凡之地：${getStringValue(backstory.meaningfulLocations, '未填写')}`,
      `宝贵之物：${getStringValue(backstory.treasuredPossessions, '未填写')}`,
      `伤口与旧伤：${getStringValue(backstory.injuries, '未填写')}`,
      `恐惧症 / 狂躁症：${getStringValue(backstory.phobiasAndManias, '未填写')}`,
    ];
  }, [sheet]);

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-theme bg-theme-card/80 p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4 min-w-0">
            {avatarPath ? (
              <img
                src={buildResourceFileUrl(avatarPath)}
                alt={sheet.name}
                className="h-24 w-24 rounded-2xl object-cover border border-theme shadow-sm"
              />
            ) : (
              <div className="h-24 w-24 rounded-2xl border border-dashed border-theme flex items-center justify-center text-xs theme-text-secondary">
                无头像
              </div>
            )}
            <div className="space-y-2 min-w-0">
              <div className="flex flex-wrap gap-2">
                <span className="px-2.5 py-1 rounded-full text-xs border border-theme theme-text-secondary">
                  {formatCharacterSheetSystem(sheet.system)}
                </span>
                <span className="px-2.5 py-1 rounded-full text-xs border border-theme theme-text-secondary">
                  {formatCharacterSheetVisibility(sheet.visibility)}
                </span>
                <span className="px-2.5 py-1 rounded-full text-xs border border-theme theme-text-secondary">
                  负责人：{sheet.ownerUsername || '未归属'}
                </span>
                {linkedCharacter && (
                  <button
                    type="button"
                    onClick={() => onOpenLinkedCharacter(linkedCharacter.id)}
                    className="px-2.5 py-1 rounded-full text-xs border border-theme theme-text-secondary hover:bg-primary-light"
                  >
                    关联角色：{linkedCharacter.name}
                  </button>
                )}
              </div>
              <div>
                <h1 className="text-3xl font-bold tracking-tight">{sheet.name}</h1>
                {sheet.payload.base.title && (
                  <div className="mt-1 text-base theme-text-secondary">{sheet.payload.base.title}</div>
                )}
              </div>
              <div className="text-sm theme-text-secondary">
                {sheet.summary || '这张角色卡还没有填写摘要。'}
              </div>
            </div>
          </div>
          {canEditSheet && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onOpenImport}
                className="px-3 py-1.5 rounded border border-theme hover:bg-primary-light text-sm"
              >
                文本导入覆盖
              </button>
              <button
                type="button"
                onClick={onStartEdit}
                className="px-3 py-1.5 rounded border border-theme hover:bg-primary-light text-sm"
              >
                开始编辑
              </button>
              <button
                type="button"
                onClick={onDelete}
                disabled={busy}
                className="px-3 py-1.5 rounded border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-60 text-sm"
              >
                删除角色卡
              </button>
            </div>
          )}
        </div>

        <div className="mt-4 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          {quickCards.map((item) => (
            <div key={item.label} className="rounded-xl border border-theme bg-theme-card/70 px-3 py-3">
              <div className="text-xs uppercase tracking-wide theme-text-secondary">{item.label}</div>
              <div className="mt-1 text-lg font-semibold break-words">{item.value}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.3fr)_340px] gap-5">
        <div className="space-y-5 min-w-0">
          <section className="rounded-2xl border border-theme p-4">
            <div className="text-sm font-medium mb-3">属性卡面</div>
            <div className={`grid gap-3 ${sheet.system === 'dnd5e' ? 'grid-cols-2 md:grid-cols-3 xl:grid-cols-6' : 'grid-cols-2 md:grid-cols-4'}`}>
              {statGrid.map(([label, value]) => (
                <div key={label} className="rounded-xl border border-theme px-3 py-3 bg-theme-card/60">
                  <div className="text-xs theme-text-secondary">{label}</div>
                  <div className="mt-1 text-2xl font-bold">{value}</div>
                  {sheet.system === 'dnd5e' && (
                    <div className="text-xs theme-text-secondary mt-1">
                      调整值 {formatSignedNumber(getAbilityModifier(value))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-theme p-4">
            <div className="text-sm font-medium mb-3">{sheet.system === 'dnd5e' ? '技能' : '技能列表'}</div>
            {skillCards.length > 0 ? (
              <div className={`grid gap-3 ${sheet.system === 'dnd5e' ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-2 md:grid-cols-3'}`}>
                {skillCards.map((item) => (
                  <div key={`${item.name}-${item.meta}`} className="rounded-xl border border-theme px-3 py-3 bg-theme-card/60">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-medium break-words">{item.name}</div>
                        <div className="text-xs theme-text-secondary mt-1">{item.meta}</div>
                      </div>
                      <div className="shrink-0 text-lg font-semibold">{item.value}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-theme px-3 py-6 text-sm theme-text-secondary text-center">
                {sheet.system === 'dnd5e' ? '当前还没有技能熟练度数据。' : '当前还没有技能条目。'}
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-theme p-4">
            <div className="text-sm font-medium mb-3">补充信息</div>
            <div className="grid grid-cols-1 gap-3 text-sm">
              {extraDetails.map((line) => (
                <div key={line} className="rounded-xl border border-theme px-3 py-3 bg-theme-card/60">
                  {line}
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-theme p-4">
            <div className="text-sm font-medium mb-3">人物信息</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl border border-theme px-3 py-3 bg-theme-card/60">年龄：{sheet.payload.base.age || '未填写'}</div>
              <div className="rounded-xl border border-theme px-3 py-3 bg-theme-card/60">性别：{sheet.payload.base.gender || '未填写'}</div>
              <div className="rounded-xl border border-theme px-3 py-3 bg-theme-card/60">背景：{sheet.payload.base.background || '未填写'}</div>
              <div className="rounded-xl border border-theme px-3 py-3 bg-theme-card/60">头像资源：{sheet.avatarAssetPath || '未填写'}</div>
            </div>
          </section>

          <section className="rounded-2xl border border-theme p-4">
            <div className="text-sm font-medium mb-3">备注</div>
            <div className="rounded-xl border border-theme px-3 py-3 bg-theme-card/60 whitespace-pre-wrap text-sm min-h-28">
              {sheet.payload.base.notes || '暂无备注'}
            </div>
          </section>
        </div>

        <aside className="space-y-5">
          <section className="rounded-2xl border border-theme p-4">
            <div className="text-sm font-medium mb-3">标签</div>
            <div className="flex flex-wrap gap-2">
              {tags.length > 0 ? tags.map((tag) => (
                <span key={tag} className="px-2 py-1 rounded-full text-xs border border-theme theme-text-secondary">
                  {tag}
                </span>
              )) : (
                <span className="text-sm theme-text-secondary">暂无标签</span>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-theme p-4">
            <div className="text-sm font-medium mb-3">协作信息</div>
            <div className="space-y-2 text-sm">
              <div>最后更新：{sheet.updatedByName || '未知'}</div>
              <div>更新时间：{new Date(sheet.updatedAt).toLocaleString()}</div>
              <div>版本：v{sheet.version}</div>
            </div>
          </section>

          <section className="rounded-2xl border border-theme p-4">
            <div className="text-sm font-medium mb-3">成员授权</div>
            <div className="space-y-2">
              {assignedMembers.length > 0 ? assignedMembers.map((member) => (
                <div key={member.userId} className="rounded-xl border border-theme px-3 py-2 bg-theme-card/60 text-sm">
                  <div className="font-medium">{member.username}</div>
                  <div className="text-xs theme-text-secondary mt-1">
                    {formatCharacterSheetPermission(member.permission)}
                  </div>
                </div>
              )) : (
                <div className="text-sm theme-text-secondary">当前没有额外的 PL 单独授权。</div>
              )}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
};

export default CharacterSheetPreview;
