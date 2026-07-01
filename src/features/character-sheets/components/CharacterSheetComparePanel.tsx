import React from 'react';
import type { CharacterSheetDocument } from '../../../generated/api';
import { buildResourceFileUrl } from '../../../services/resourceService';
import {
  formatCharacterSheetSystem,
  formatSignedNumber,
  getAbilityModifier,
  getNumberValue,
  getRecord,
  getStringValue,
} from '../utils';

interface CharacterSheetComparePanelProps {
  sheets: CharacterSheetDocument[];
  loading: boolean;
  onExit: () => void;
}

const CharacterSheetComparePanel: React.FC<CharacterSheetComparePanelProps> = ({
  sheets,
  loading,
  onExit,
}) => {
  const dndSkillDefinitions = [
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">多卡并排查看</h2>
          <div className="text-sm theme-text-secondary mt-1">当前对比 {sheets.length} 张角色卡</div>
        </div>
        <button type="button" onClick={onExit} className="px-3 py-2 rounded border border-theme hover:bg-primary-light text-sm">
          退出对比
        </button>
      </div>

      {loading && (
        <div className="text-sm theme-text-secondary border border-theme rounded-xl px-4 py-3">
          正在加载对比数据...
        </div>
      )}

      <div className={`grid gap-4 ${sheets.length >= 3 ? 'xl:grid-cols-3' : 'lg:grid-cols-2'}`}>
        {sheets.map((sheet) => {
          const systemData = sheet.system === 'dnd5e' ? getRecord(sheet.payload.dnd5e) : getRecord(sheet.payload.coc7);
          const stats = getRecord(systemData.stats);
          const derived = getRecord(systemData.derived);
          const hp = getRecord(derived.hp);
          const avatarPath = sheet.avatarAssetPath || sheet.payload.base.avatarAssetPath || '';
          const skillEntries = sheet.system === 'dnd5e'
            ? (() => {
              const skillMap = getRecord(systemData.skills);
              const proficiencyBonus = getNumberValue(systemData.proficiencyBonus, 2);
              return dndSkillDefinitions.map(([name, abilityKey, abilityLabel]) => {
                const proficiency = getNumberValue(skillMap[name], 0);
                const abilityModifier = getAbilityModifier(getNumberValue(stats[abilityKey], 10));
                return {
                  name,
                  meta: `${abilityLabel} / ${proficiency === 1 ? '熟练' : proficiency === 0.5 ? '半熟练' : '未熟练'}`,
                  value: formatSignedNumber(abilityModifier + Math.floor(proficiencyBonus * proficiency)),
                };
              });
            })()
            : (Array.isArray(systemData.skills) ? systemData.skills : [])
              .map((item) => {
                const skill = getRecord(item);
                return {
                  name: getStringValue(skill.name, '未命名技能'),
                  meta: '技能值',
                  value: `${getNumberValue(skill.value, 0)}%`,
                  sortValue: getNumberValue(skill.value, 0),
                };
              })
              .filter((item) => item.name.trim().length > 0)
              .sort((left, right) => right.sortValue - left.sortValue)
              .map(({ sortValue: _sortValue, ...item }) => item);

          const statEntries = sheet.system === 'dnd5e'
            ? [
              ['STR', getNumberValue(stats.str, 10)],
              ['DEX', getNumberValue(stats.dex, 10)],
              ['CON', getNumberValue(stats.con, 10)],
              ['INT', getNumberValue(stats.int, 10)],
              ['WIS', getNumberValue(stats.wis, 10)],
              ['CHA', getNumberValue(stats.cha, 10)],
            ]
            : [
              ['STR', getNumberValue(stats.str, 50)],
              ['CON', getNumberValue(stats.con, 50)],
              ['SIZ', getNumberValue(stats.siz, 50)],
              ['DEX', getNumberValue(stats.dex, 50)],
              ['APP', getNumberValue(stats.app, 50)],
              ['INT', getNumberValue(stats.int, 50)],
              ['POW', getNumberValue(stats.pow, 50)],
              ['EDU', getNumberValue(stats.edu, 50)],
            ];

          return (
            <section key={sheet.id} className="rounded-2xl border border-theme p-4 bg-theme-card/80 space-y-4">
              <div className="flex items-start gap-3">
                {avatarPath ? (
                  <img src={buildResourceFileUrl(avatarPath)} alt={sheet.name} className="h-16 w-16 rounded-xl object-cover border border-theme" />
                ) : (
                  <div className="h-16 w-16 rounded-xl border border-dashed border-theme flex items-center justify-center text-xs theme-text-secondary">
                    无头像
                  </div>
                )}
                <div className="min-w-0">
                  <div className="text-xs theme-text-secondary">{formatCharacterSheetSystem(sheet.system)}</div>
                  <div className="text-xl font-semibold break-words">{sheet.name}</div>
                  <div className="text-sm theme-text-secondary mt-1">{sheet.summary || '暂无摘要'}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {statEntries.map(([label, value]) => (
                  <div key={label} className="rounded-xl border border-theme px-3 py-2 bg-theme-card/60">
                    <div className="text-xs theme-text-secondary">{label}</div>
                    <div className="text-lg font-semibold">{value}</div>
                    {sheet.system === 'dnd5e' && (
                      <div className="text-[11px] theme-text-secondary">修正 {getAbilityModifier(Number(value)) >= 0 ? '+' : ''}{getAbilityModifier(Number(value))}</div>
                    )}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-2 text-sm">
                {sheet.system === 'dnd5e' ? (
                  <>
                    <div className="rounded-xl border border-theme px-3 py-2 bg-theme-card/60">种族：{getStringValue(systemData.race, '未填写')}</div>
                    <div className="rounded-xl border border-theme px-3 py-2 bg-theme-card/60">职业：{getStringValue(systemData.className, '未填写')}</div>
                    <div className="rounded-xl border border-theme px-3 py-2 bg-theme-card/60">等级：{getNumberValue(systemData.level, 1)}</div>
                    <div className="rounded-xl border border-theme px-3 py-2 bg-theme-card/60">AC：{getNumberValue(derived.ac, 10)}</div>
                    <div className="rounded-xl border border-theme px-3 py-2 bg-theme-card/60">HP：{getNumberValue(hp.current, 10)} / {getNumberValue(hp.max, 10)}</div>
                    <div className="rounded-xl border border-theme px-3 py-2 bg-theme-card/60">速度：{getStringValue(derived.speed, '未填写')}</div>
                  </>
                ) : (
                  <>
                    <div className="rounded-xl border border-theme px-3 py-2 bg-theme-card/60">职业：{getStringValue(systemData.occupation, '未填写')}</div>
                    <div className="rounded-xl border border-theme px-3 py-2 bg-theme-card/60">HP：{getNumberValue(hp.current, 10)} / {getNumberValue(hp.max, 10)}</div>
                    <div className="rounded-xl border border-theme px-3 py-2 bg-theme-card/60">SAN：{getNumberValue(getRecord(derived.san).current, 50)} / {getNumberValue(getRecord(derived.san).max, 99)}</div>
                    <div className="rounded-xl border border-theme px-3 py-2 bg-theme-card/60">MP：{getNumberValue(getRecord(derived.mp).current, 10)} / {getNumberValue(getRecord(derived.mp).max, 10)}</div>
                    <div className="rounded-xl border border-theme px-3 py-2 bg-theme-card/60">幸运：{getNumberValue(derived.luck, 50)}</div>
                    <div className="rounded-xl border border-theme px-3 py-2 bg-theme-card/60">MOV：{getNumberValue(derived.mov, 8)}</div>
                  </>
                )}
              </div>

              <div className="space-y-2">
                <div className="text-sm font-medium">{sheet.system === 'dnd5e' ? '技能' : '技能列表'}</div>
                {skillEntries.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1">
                    {skillEntries.map((skill) => (
                      <div key={`${sheet.id}-${skill.name}-${skill.meta}`} className="rounded-xl border border-theme px-3 py-2 bg-theme-card/60">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-sm font-medium break-words">{skill.name}</div>
                            <div className="text-[11px] theme-text-secondary mt-1">{skill.meta}</div>
                          </div>
                          <div className="shrink-0 text-sm font-semibold">{skill.value}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-theme px-3 py-4 text-sm theme-text-secondary text-center">
                    {sheet.system === 'dnd5e' ? '当前还没有技能熟练度数据。' : '当前还没有技能条目。'}
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
};

export default CharacterSheetComparePanel;
