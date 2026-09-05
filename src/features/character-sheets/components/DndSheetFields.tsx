import React from 'react';
import {
  DND_SKILL_DEFINITIONS,
  formatSignedNumber,
  getAbilityModifier,
  getNumberValue,
  getRecord,
  getStringValue,
} from '../utils';

interface DndSheetFieldsProps {
  data: Record<string, unknown>;
  onFieldChange: (key: string, value: string | number) => void;
  onNestedFieldChange: (sectionKey: string, key: string, value: string | number) => void;
  onDoubleNestedFieldChange: (sectionKey: string, nestedKey: string, key: string, value: number) => void;
  onSkillsChange: (skills: Record<string, unknown>) => void;
}

const DndSheetFields: React.FC<DndSheetFieldsProps> = ({
  data,
  onFieldChange,
  onNestedFieldChange,
  onDoubleNestedFieldChange,
  onSkillsChange,
}) => {
  const stats = getRecord(data.stats);
  const derived = getRecord(data.derived);
  const hp = getRecord(derived.hp);
  const currency = getRecord(data.currency);
  const skills = getRecord(data.skills);

  const statKeys = [
    ['str', '力量'],
    ['dex', '敏捷'],
    ['con', '体质'],
    ['int', '智力'],
    ['wis', '感知'],
    ['cha', '魅力'],
  ] as const;

  return (
    <div className="space-y-4 border border-theme rounded-lg p-4">
      <div className="font-medium">DND 专属字段</div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <label className="space-y-1 text-sm">
          <span className="theme-text-secondary">种族</span>
          <input
            value={getStringValue(data.race)}
            onChange={(event) => onFieldChange('race', event.target.value)}
            className="w-full px-3 py-2 border border-theme rounded bg-transparent"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="theme-text-secondary">职业</span>
          <input
            value={getStringValue(data.className)}
            onChange={(event) => onFieldChange('className', event.target.value)}
            className="w-full px-3 py-2 border border-theme rounded bg-transparent"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="theme-text-secondary">子职业</span>
          <input
            value={getStringValue(data.subclass)}
            onChange={(event) => onFieldChange('subclass', event.target.value)}
            className="w-full px-3 py-2 border border-theme rounded bg-transparent"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="theme-text-secondary">等级</span>
          <input
            type="number"
            min={1}
            value={getNumberValue(data.level, 1)}
            onChange={(event) => onFieldChange('level', Number(event.target.value || 1))}
            className="w-full px-3 py-2 border border-theme rounded bg-transparent"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="theme-text-secondary">阵营</span>
          <input
            value={getStringValue(data.alignment)}
            onChange={(event) => onFieldChange('alignment', event.target.value)}
            className="w-full px-3 py-2 border border-theme rounded bg-transparent"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="theme-text-secondary">熟练加值</span>
          <input
            type="number"
            value={getNumberValue(data.proficiencyBonus, 2)}
            onChange={(event) => onFieldChange('proficiencyBonus', Number(event.target.value || 0))}
            className="w-full px-3 py-2 border border-theme rounded bg-transparent"
          />
        </label>
      </div>

      <div className="space-y-2">
        <div className="text-sm font-medium">属性</div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {statKeys.map(([key, label]) => {
            const score = getNumberValue(stats[key], 10);
            const modifier = getAbilityModifier(score);
            return (
              <label key={key} className="space-y-1 text-sm">
                <span className="theme-text-secondary">{label}</span>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={score}
                    onChange={(event) => onNestedFieldChange('stats', key, Number(event.target.value || 0))}
                    className="w-full px-3 py-2 border border-theme rounded bg-transparent"
                  />
                  <span className="min-w-10 text-xs theme-text-secondary text-right">
                    {formatSignedNumber(modifier)}
                  </span>
                </div>
              </label>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-sm font-medium">派生数值</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <label className="space-y-1 text-sm">
            <span className="theme-text-secondary">护甲等级</span>
            <input
              type="number"
              value={getNumberValue(derived.ac, 10)}
              onChange={(event) => onNestedFieldChange('derived', 'ac', Number(event.target.value || 0))}
              className="w-full px-3 py-2 border border-theme rounded bg-transparent"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="theme-text-secondary">先攻</span>
            <input
              type="number"
              value={getNumberValue(derived.initiative, 0)}
              onChange={(event) => onNestedFieldChange('derived', 'initiative', Number(event.target.value || 0))}
              className="w-full px-3 py-2 border border-theme rounded bg-transparent"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="theme-text-secondary">速度</span>
            <input
              value={getStringValue(derived.speed)}
              onChange={(event) => onNestedFieldChange('derived', 'speed', event.target.value)}
              className="w-full px-3 py-2 border border-theme rounded bg-transparent"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="theme-text-secondary">被动察觉</span>
            <input
              type="number"
              value={getNumberValue(derived.passivePerception, 10)}
              onChange={(event) => onNestedFieldChange('derived', 'passivePerception', Number(event.target.value || 0))}
              className="w-full px-3 py-2 border border-theme rounded bg-transparent"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="theme-text-secondary">HP 当前</span>
            <input
              type="number"
              value={getNumberValue(hp.current, 10)}
              onChange={(event) => onDoubleNestedFieldChange('derived', 'hp', 'current', Number(event.target.value || 0))}
              className="w-full px-3 py-2 border border-theme rounded bg-transparent"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="theme-text-secondary">HP 最大</span>
            <input
              type="number"
              value={getNumberValue(hp.max, 10)}
              onChange={(event) => onDoubleNestedFieldChange('derived', 'hp', 'max', Number(event.target.value || 0))}
              className="w-full px-3 py-2 border border-theme rounded bg-transparent"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="theme-text-secondary">临时 HP</span>
            <input
              type="number"
              value={getNumberValue(hp.temporary, 0)}
              onChange={(event) => onDoubleNestedFieldChange('derived', 'hp', 'temporary', Number(event.target.value || 0))}
              className="w-full px-3 py-2 border border-theme rounded bg-transparent"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="theme-text-secondary">施法属性</span>
            <input
              value={getStringValue(derived.spellcastingAbility)}
              onChange={(event) => onNestedFieldChange('derived', 'spellcastingAbility', event.target.value)}
              className="w-full px-3 py-2 border border-theme rounded bg-transparent"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="theme-text-secondary">法术豁免 DC</span>
            <input
              type="number"
              value={getNumberValue(derived.spellSaveDc, 10)}
              onChange={(event) => onNestedFieldChange('derived', 'spellSaveDc', Number(event.target.value || 0))}
              className="w-full px-3 py-2 border border-theme rounded bg-transparent"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="theme-text-secondary">法术攻击加值</span>
            <input
              type="number"
              value={getNumberValue(derived.spellAttackBonus, 2)}
              onChange={(event) => onNestedFieldChange('derived', 'spellAttackBonus', Number(event.target.value || 0))}
              className="w-full px-3 py-2 border border-theme rounded bg-transparent"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="theme-text-secondary">命中骰总量</span>
            <input
              value={getStringValue(derived.hitDiceTotal)}
              onChange={(event) => onNestedFieldChange('derived', 'hitDiceTotal', event.target.value)}
              className="w-full px-3 py-2 border border-theme rounded bg-transparent"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="theme-text-secondary">已用命中骰</span>
            <input
              type="number"
              value={getNumberValue(derived.hitDiceUsed, 0)}
              onChange={(event) => onNestedFieldChange('derived', 'hitDiceUsed', Number(event.target.value || 0))}
              className="w-full px-3 py-2 border border-theme rounded bg-transparent"
            />
          </label>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <div className="text-sm font-medium">技能熟练度</div>
          <div className="mt-1 text-xs theme-text-secondary">可单独调整需要使用的技能，不会重置角色卡中的其他内容。</div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {DND_SKILL_DEFINITIONS.map(([name, _abilityKey, ability]) => (
            <label key={name} className="flex items-center gap-3 rounded border border-theme px-3 py-2 text-sm">
              <span className="min-w-0 flex-1">
                <span className="font-medium">{name}</span>
                <span className="ml-1.5 text-xs theme-text-secondary">{ability}</span>
              </span>
              <select
                value={getNumberValue(skills[name], 0)}
                onChange={(event) => onSkillsChange({ ...skills, [name]: Number(event.target.value) })}
                className="px-2 py-1.5 border border-theme rounded bg-transparent"
              >
                <option value={0}>未熟练</option>
                <option value={0.5}>半熟练</option>
                <option value={1}>熟练</option>
                <option value={2}>专精</option>
              </select>
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-sm font-medium">货币</div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {(['cp', 'sp', 'ep', 'gp', 'pp'] as const).map((key) => (
            <label key={key} className="space-y-1 text-sm">
              <span className="theme-text-secondary uppercase">{key}</span>
              <input
                type="number"
                value={getNumberValue(currency[key], 0)}
                onChange={(event) => onNestedFieldChange('currency', key, Number(event.target.value || 0))}
                className="w-full px-3 py-2 border border-theme rounded bg-transparent"
              />
            </label>
          ))}
        </div>
      </div>
    </div>
  );
};

export default DndSheetFields;
