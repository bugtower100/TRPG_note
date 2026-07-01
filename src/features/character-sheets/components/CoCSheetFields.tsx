import React from 'react';
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
}

const CoCSheetFields: React.FC<CoCSheetFieldsProps> = ({
  data,
  onFieldChange,
  onNestedFieldChange,
  onDoubleNestedFieldChange,
}) => {
  const stats = getRecord(data.stats);
  const derived = getRecord(data.derived);
  const hp = getRecord(derived.hp);
  const san = getRecord(derived.san);
  const mp = getRecord(derived.mp);
  const backstory = getRecord(data.backstory);

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
