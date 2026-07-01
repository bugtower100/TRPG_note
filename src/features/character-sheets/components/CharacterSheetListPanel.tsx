import React from 'react';
import type { CharacterSheetSummary } from '../../../generated/api';
import { getCampaignRoleLabel } from '../../../utils/campaignRoles';
import { formatCharacterSheetSystem, type CharacterSheetSystem } from '../utils';

interface CharacterSheetListPanelProps {
  memberRole: string;
  createName: string;
  createSystem: CharacterSheetSystem;
  canCreateSheet: boolean;
  busy: boolean;
  searchText: string;
  systemFilter: 'all' | CharacterSheetSystem;
  sheets: CharacterSheetSummary[];
  compareSheetIds: string[];
  activeSheetId?: string;
  isLoading: boolean;
  onCreateNameChange: (value: string) => void;
  onCreateSystemChange: (value: CharacterSheetSystem) => void;
  onSearchTextChange: (value: string) => void;
  onSystemFilterChange: (value: 'all' | CharacterSheetSystem) => void;
  onCreate: () => void;
  onOpenImport: () => void;
  onToggleCompare: (sheetId: string) => void;
  onClearCompare: () => void;
  onSelectSheet: (sheetId: string) => void;
}

const CharacterSheetListPanel: React.FC<CharacterSheetListPanelProps> = ({
  memberRole,
  createName,
  createSystem,
  canCreateSheet,
  busy,
  searchText,
  systemFilter,
  sheets,
  compareSheetIds,
  activeSheetId,
  isLoading,
  onCreateNameChange,
  onCreateSystemChange,
  onSearchTextChange,
  onSystemFilterChange,
  onCreate,
  onOpenImport,
  onToggleCompare,
  onClearCompare,
  onSelectSheet,
}) => {
  return (
    <aside className="theme-card border border-theme rounded-xl p-4 space-y-4 shadow-sm">
      <div>
        <h2 className="text-xl font-semibold">角色卡管理器</h2>
        <div className="text-sm theme-text-secondary mt-1">
          当前身份：{getCampaignRoleLabel(memberRole)}
        </div>
      </div>

      <div className="space-y-3 border border-theme rounded-xl p-3 bg-theme-card/60">
        <div className="text-sm font-medium">新建角色卡</div>
        <input
          value={createName}
          onChange={(event) => onCreateNameChange(event.target.value)}
          placeholder="输入角色卡名称"
          className="w-full px-3 py-2 border border-theme rounded bg-transparent text-sm"
        />
        <select
          value={createSystem}
          onChange={(event) => onCreateSystemChange(event.target.value as CharacterSheetSystem)}
          className="w-full px-3 py-2 border border-theme rounded bg-transparent text-sm"
        >
          <option value="coc7">CoC 7版</option>
          <option value="dnd5e">DND 5e</option>
        </select>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onCreate}
            disabled={!canCreateSheet || busy}
            className="w-full px-3 py-2 rounded bg-primary text-white hover:bg-primary-dark disabled:opacity-60 text-sm"
          >
            创建
          </button>
          <button
            type="button"
            onClick={onOpenImport}
            disabled={!canCreateSheet || busy}
            className="w-full px-3 py-2 rounded border border-theme hover:bg-primary-light disabled:opacity-60 text-sm"
          >
            文本导入
          </button>
        </div>
        {!canCreateSheet && (
          <div className="text-xs theme-text-secondary">当前仅 GM / 副GM 可创建角色卡。</div>
        )}
      </div>

      <div className="space-y-2 border border-theme rounded-xl p-3 bg-theme-card/60">
        <div className="text-sm font-medium">筛选</div>
        <input
          value={searchText}
          onChange={(event) => onSearchTextChange(event.target.value)}
          placeholder="搜索名称或摘要"
          className="w-full px-3 py-2 border border-theme rounded bg-transparent text-sm"
        />
        <select
          value={systemFilter}
          onChange={(event) => onSystemFilterChange(event.target.value as 'all' | CharacterSheetSystem)}
          className="w-full px-3 py-2 border border-theme rounded bg-transparent text-sm"
        >
          <option value="all">全部系统</option>
          <option value="coc7">CoC 7版</option>
          <option value="dnd5e">DND 5e</option>
        </select>
      </div>

      <div className="space-y-2">
        {compareSheetIds.length > 0 && (
          <div className="flex items-center justify-between rounded-xl border border-theme px-3 py-2 text-xs theme-text-secondary bg-theme-card/60">
            <span>已加入对比 {compareSheetIds.length} 张</span>
            <button type="button" onClick={onClearCompare} className="hover:text-primary">
              清空
            </button>
          </div>
        )}
        {sheets.map((sheet) => {
          const active = sheet.id === activeSheetId;
          const checked = compareSheetIds.includes(sheet.id);
          return (
            <div
              key={sheet.id}
              className={`rounded-xl border px-3 py-3 transition-colors ${
                active ? 'border-primary bg-primary/10 shadow-sm' : 'border-theme hover:bg-primary-light'
              }`}
            >
              <div className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggleCompare(sheet.id)}
                  className="mt-1"
                  aria-label={`加入对比 ${sheet.name}`}
                />
                <button type="button" onClick={() => onSelectSheet(sheet.id)} className="flex-1 text-left min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="font-medium break-words">{sheet.name}</div>
                    <span className="shrink-0 px-2 py-1 rounded-full text-[11px] border border-theme theme-text-secondary">
                      {formatCharacterSheetSystem(sheet.system)}
                    </span>
                  </div>
                  <div className="text-xs theme-text-secondary mt-2">
                    最近更新：{sheet.updatedBy || '未知'}
                  </div>
                  {sheet.summary && (
                    <div className="text-xs theme-text-secondary mt-2 line-clamp-2">{sheet.summary}</div>
                  )}
                </button>
              </div>
            </div>
          );
        })}

        {!isLoading && sheets.length === 0 && (
          <div className="text-sm theme-text-secondary border border-dashed border-theme rounded-lg px-3 py-4 text-center">
            {searchText || systemFilter !== 'all' ? '当前筛选条件下没有角色卡。' : '当前还没有角色卡。'}
          </div>
        )}
      </div>
    </aside>
  );
};

export default CharacterSheetListPanel;
