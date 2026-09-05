import React, { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import {
  getNumberValue,
  getRecord,
  getStringValue,
} from '../utils';

interface CoCSheetFieldsProps {
  data: Record<string, unknown>;
  onFieldChange: (key: string, value: string | number) => void;
  onNestedFieldChange: (sectionKey: string, key: string, value: string | number) => void;
  onDoubleNestedFieldChange: (sectionKey: string, nestedKey: string, key: string, value: number) => void;
  onSkillsChange: (skills: Record<string, unknown>[]) => void;
}

const CoCSheetFields: React.FC<CoCSheetFieldsProps> = ({
  data,
  onFieldChange,
  onNestedFieldChange,
  onDoubleNestedFieldChange,
  onSkillsChange,
}) => {
  const [newSkillName, setNewSkillName] = useState('');
  const [newSkillValue, setNewSkillValue] = useState(0);
  const stats = getRecord(data.stats);
  const derived = getRecord(data.derived);
  const hp = getRecord(derived.hp);
  const san = getRecord(derived.san);
  const mp = getRecord(derived.mp);
  const backstory = getRecord(data.backstory);
  const skills = Array.isArray(data.skills) ? data.skills.map(getRecord) : [];
  const normalizedNewSkillName = newSkillName.trim();
  const newSkillExists = normalizedNewSkillName.length > 0 && skills.some(
    (skill) => getStringValue(skill.name).trim().toLocaleLowerCase() === normalizedNewSkillName.toLocaleLowerCase()
  );

  const updateSkill = (index: number, key: 'name' | 'value', value: string | number) => {
    onSkillsChange(skills.map((skill, skillIndex) => (
      skillIndex === index ? { ...skill, [key]: value } : skill
    )));
  };

  const addSkill = () => {
    if (!normalizedNewSkillName || newSkillExists) return;
    onSkillsChange([...skills, { name: normalizedNewSkillName, value: newSkillValue }]);
    setNewSkillName('');
    setNewSkillValue(0);
  };

  const statKeys = [
    ['str', 'STR'],
    ['con', 'CON'],
    ['siz', 'SIZ'],
    ['dex', 'DEX'],
    ['app', 'APP'],
    ['int', 'INT'],
    ['pow', 'POW'],
    ['edu', 'EDU'],
  ] as const;

  return (
    <div className="space-y-4 border border-theme rounded-lg p-4">
      <div className="font-medium">CoC 专属字段</div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label className="space-y-1 text-sm">
          <span className="theme-text-secondary">职业</span>
          <input
            value={getStringValue(data.occupation)}
            onChange={(event) => onFieldChange('occupation', event.target.value)}
            className="w-full px-3 py-2 border border-theme rounded bg-transparent"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="theme-text-secondary">幸运</span>
          <input
            type="number"
            value={getNumberValue(derived.luck, 50)}
            onChange={(event) => onNestedFieldChange('derived', 'luck', Number(event.target.value || 0))}
            className="w-full px-3 py-2 border border-theme rounded bg-transparent"
          />
        </label>
      </div>

      <div className="space-y-2">
        <div className="text-sm font-medium">属性</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {statKeys.map(([key, label]) => (
            <label key={key} className="space-y-1 text-sm">
              <span className="theme-text-secondary">{label}</span>
              <input
                type="number"
                value={getNumberValue(stats[key], 50)}
                onChange={(event) => onNestedFieldChange('stats', key, Number(event.target.value || 0))}
                className="w-full px-3 py-2 border border-theme rounded bg-transparent"
              />
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-sm font-medium">派生数值</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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
            <span className="theme-text-secondary">SAN 当前</span>
            <input
              type="number"
              value={getNumberValue(san.current, 50)}
              onChange={(event) => onDoubleNestedFieldChange('derived', 'san', 'current', Number(event.target.value || 0))}
              className="w-full px-3 py-2 border border-theme rounded bg-transparent"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="theme-text-secondary">SAN 最大</span>
            <input
              type="number"
              value={getNumberValue(san.max, 99)}
              onChange={(event) => onDoubleNestedFieldChange('derived', 'san', 'max', Number(event.target.value || 0))}
              className="w-full px-3 py-2 border border-theme rounded bg-transparent"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="theme-text-secondary">MP 当前</span>
            <input
              type="number"
              value={getNumberValue(mp.current, 10)}
              onChange={(event) => onDoubleNestedFieldChange('derived', 'mp', 'current', Number(event.target.value || 0))}
              className="w-full px-3 py-2 border border-theme rounded bg-transparent"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="theme-text-secondary">MP 最大</span>
            <input
              type="number"
              value={getNumberValue(mp.max, 10)}
              onChange={(event) => onDoubleNestedFieldChange('derived', 'mp', 'max', Number(event.target.value || 0))}
              className="w-full px-3 py-2 border border-theme rounded bg-transparent"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="theme-text-secondary">移动率</span>
            <input
              type="number"
              value={getNumberValue(derived.mov, 8)}
              onChange={(event) => onNestedFieldChange('derived', 'mov', Number(event.target.value || 0))}
              className="w-full px-3 py-2 border border-theme rounded bg-transparent"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="theme-text-secondary">体格</span>
            <input
              value={getStringValue(derived.build, '0')}
              onChange={(event) => onNestedFieldChange('derived', 'build', event.target.value)}
              className="w-full px-3 py-2 border border-theme rounded bg-transparent"
            />
          </label>
          <label className="space-y-1 text-sm md:col-span-2">
            <span className="theme-text-secondary">伤害加值</span>
            <input
              value={getStringValue(derived.damageBonus, '0')}
              onChange={(event) => onNestedFieldChange('derived', 'damageBonus', event.target.value)}
              className="w-full px-3 py-2 border border-theme rounded bg-transparent"
            />
          </label>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <div className="text-sm font-medium">技能</div>
          <div className="mt-1 text-xs theme-text-secondary">逐条修改或补充技能，不会重置角色卡中的其他内容。</div>
        </div>

        {skills.length > 0 ? (
          <div className="space-y-2">
            {skills.map((skill, index) => (
              <div key={index} className="grid grid-cols-[minmax(0,1fr)_96px_auto] items-end gap-2">
                <label className="space-y-1 text-sm min-w-0">
                  <span className="theme-text-secondary">技能名称</span>
                  <input
                    value={getStringValue(skill.name)}
                    onChange={(event) => updateSkill(index, 'name', event.target.value)}
                    className="w-full px-3 py-2 border border-theme rounded bg-transparent"
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="theme-text-secondary">技能值</span>
                  <input
                    type="number"
                    value={getNumberValue(skill.value, 0)}
                    onChange={(event) => updateSkill(index, 'value', Number(event.target.value || 0))}
                    className="w-full px-3 py-2 border border-theme rounded bg-transparent"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => onSkillsChange(skills.filter((_, skillIndex) => skillIndex !== index))}
                  aria-label={`删除技能 ${getStringValue(skill.name, String(index + 1))}`}
                  className="h-[38px] w-[38px] inline-flex items-center justify-center rounded border border-red-200 text-red-600 hover:bg-red-50"
                >
                  <Trash2 size={16} aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded border border-dashed border-theme px-3 py-4 text-sm theme-text-secondary text-center">
            还没有技能，可在下方手动添加。
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_96px_auto] items-end gap-2 rounded-lg border border-theme p-3">
          <label className="space-y-1 text-sm min-w-0">
            <span className="theme-text-secondary">新增技能名称</span>
            <input
              value={newSkillName}
              onChange={(event) => setNewSkillName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  addSkill();
                }
              }}
              placeholder="例如：图书馆使用"
              className="w-full px-3 py-2 border border-theme rounded bg-transparent"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="theme-text-secondary">技能值</span>
            <input
              type="number"
              value={newSkillValue}
              onChange={(event) => setNewSkillValue(Number(event.target.value || 0))}
              className="w-full px-3 py-2 border border-theme rounded bg-transparent"
            />
          </label>
          <button
            type="button"
            onClick={addSkill}
            disabled={!normalizedNewSkillName || newSkillExists}
            className="h-[38px] px-3 inline-flex items-center justify-center gap-1.5 rounded bg-primary text-white hover:bg-primary-dark disabled:opacity-50"
          >
            <Plus size={16} aria-hidden="true" />
            添加
          </button>
          {newSkillExists && (
            <div className="sm:col-span-3 text-xs text-red-600">已存在同名技能，请直接修改已有条目。</div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label className="space-y-1 text-sm">
          <span className="theme-text-secondary">外貌描述</span>
          <textarea
            value={getStringValue(backstory.appearance)}
            onChange={(event) => onNestedFieldChange('backstory', 'appearance', event.target.value)}
            rows={4}
            className="w-full px-3 py-2 border border-theme rounded bg-transparent resize-y"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="theme-text-secondary">性格 / 关键特征</span>
          <textarea
            value={getStringValue(backstory.traits)}
            onChange={(event) => onNestedFieldChange('backstory', 'traits', event.target.value)}
            rows={4}
            className="w-full px-3 py-2 border border-theme rounded bg-transparent resize-y"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="theme-text-secondary">信念 / 思想</span>
          <textarea
            value={getStringValue(backstory.ideology)}
            onChange={(event) => onNestedFieldChange('backstory', 'ideology', event.target.value)}
            rows={4}
            className="w-full px-3 py-2 border border-theme rounded bg-transparent resize-y"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="theme-text-secondary">重要之人</span>
          <textarea
            value={getStringValue(backstory.significantPeople)}
            onChange={(event) => onNestedFieldChange('backstory', 'significantPeople', event.target.value)}
            rows={4}
            className="w-full px-3 py-2 border border-theme rounded bg-transparent resize-y"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="theme-text-secondary">意义非凡之地</span>
          <textarea
            value={getStringValue(backstory.meaningfulLocations)}
            onChange={(event) => onNestedFieldChange('backstory', 'meaningfulLocations', event.target.value)}
            rows={4}
            className="w-full px-3 py-2 border border-theme rounded bg-transparent resize-y"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="theme-text-secondary">宝贵之物</span>
          <textarea
            value={getStringValue(backstory.treasuredPossessions)}
            onChange={(event) => onNestedFieldChange('backstory', 'treasuredPossessions', event.target.value)}
            rows={4}
            className="w-full px-3 py-2 border border-theme rounded bg-transparent resize-y"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="theme-text-secondary">伤口与旧伤</span>
          <textarea
            value={getStringValue(backstory.injuries)}
            onChange={(event) => onNestedFieldChange('backstory', 'injuries', event.target.value)}
            rows={4}
            className="w-full px-3 py-2 border border-theme rounded bg-transparent resize-y"
          />
        </label>
        <label className="space-y-1 text-sm md:col-span-2">
          <span className="theme-text-secondary">恐惧症 / 狂躁症</span>
          <textarea
            value={getStringValue(backstory.phobiasAndManias)}
            onChange={(event) => onNestedFieldChange('backstory', 'phobiasAndManias', event.target.value)}
            rows={4}
            className="w-full px-3 py-2 border border-theme rounded bg-transparent resize-y"
          />
        </label>
      </div>
    </div>
  );
};

export default CoCSheetFields;
