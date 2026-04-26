import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCampaign } from '../context/CampaignContext';
import { Clue, ClueRevealStatus } from '../types';
import { dataService } from '../services/dataService';

const statusOrder: ClueRevealStatus[] = ['untracked', 'investigating', 'revealed'];
const statusLabel: Record<ClueRevealStatus, string> = {
  untracked: '待发现',
  investigating: '调查中',
  revealed: '已揭秘',
};

const normalizeStatus = (clue: Clue): ClueRevealStatus => clue.revealStatus || 'untracked';

const ClueBoard: React.FC = () => {
  const { campaignData, updateEntity } = useCampaign();
  const navigate = useNavigate();
  const [keyword, setKeyword] = useState('');
  const [targetFilter, setTargetFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | ClueRevealStatus>('all');

  const targetOptions = useMemo(() => {
    const pool = [
      ...campaignData.characters.map((item) => item.name),
      ...campaignData.monsters.map((item) => item.name),
      ...campaignData.locations.map((item) => item.name),
      ...campaignData.organizations.map((item) => item.name),
      ...campaignData.events.map((item) => item.name),
      ...campaignData.clues.map((item) => item.revealTarget || ''),
    ]
      .map((value) => value.trim())
      .filter(Boolean);
    return Array.from(new Set(pool)).sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'));
  }, [campaignData]);

  const filteredClues = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();
    const normalizedTarget = targetFilter.trim().toLowerCase();
    return campaignData.clues.filter((clue) => {
      const status = normalizeStatus(clue);
      if (statusFilter !== 'all' && statusFilter !== status) return false;
      if (normalizedTarget && !(clue.revealTarget || '').toLowerCase().includes(normalizedTarget)) return false;
      if (!normalizedKeyword) return true;
      const source = [clue.name, clue.type, clue.details, ...(clue.tags || []), clue.revealTarget || ''].join(' ').toLowerCase();
      return source.includes(normalizedKeyword);
    });
  }, [campaignData.clues, keyword, statusFilter, targetFilter]);

  const cluesByStatus = useMemo(
    () =>
      statusOrder.reduce<Record<ClueRevealStatus, Clue[]>>(
        (acc, status) => {
          acc[status] = filteredClues.filter((clue) => normalizeStatus(clue) === status);
          return acc;
        },
        { untracked: [], investigating: [], revealed: [] }
      ),
    [filteredClues]
  );

  const revealLogs = useMemo(
    () =>
      campaignData.clues
        .flatMap((clue) =>
          (clue.revealLogs || []).map((log) => ({
            ...log,
            clueId: clue.id,
            clueName: clue.name,
          }))
        )
        .sort((a, b) => b.revealedAt - a.revealedAt),
    [campaignData.clues]
  );

  const patchClue = (clue: Clue, patch: Partial<Clue>) => {
    updateEntity('clues', {
      ...clue,
      ...patch,
    });
  };

  const handleRecordReveal = (clue: Clue) => {
    const target = (clue.revealTarget || '').trim();
    if (!target) {
      window.alert('请先填写“揭秘目标”再记录日志。');
      return;
    }
    const note = window.prompt('可选：本次揭秘备注（可留空）', '') ?? '';
    const nextLogs = [
      ...(clue.revealLogs || []),
      {
        id: dataService.generateId(),
        target,
        note: note.trim(),
        revealedAt: Date.now(),
      },
    ];
    patchClue(clue, {
      revealStatus: 'revealed',
      revealLogs: nextLogs,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">线索板与揭秘流</h2>
          <p className="text-sm theme-text-secondary mt-1">按状态推进线索，并记录每次“揭秘给谁、何时揭秘”。</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <input
          type="text"
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          placeholder="搜索线索名 / 类型 / 标签"
          className="px-3 py-2 border border-theme rounded-md bg-transparent"
        />
        <input
          type="text"
          value={targetFilter}
          onChange={(event) => setTargetFilter(event.target.value)}
          placeholder="按揭秘目标筛选"
          list="clue-reveal-target-options"
          className="px-3 py-2 border border-theme rounded-md bg-transparent"
        />
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as 'all' | ClueRevealStatus)}
          className="px-3 py-2 border border-theme rounded-md bg-transparent"
        >
          <option value="all">全部状态</option>
          {statusOrder.map((status) => (
            <option key={status} value={status}>
              {statusLabel[status]}
            </option>
          ))}
        </select>
        <datalist id="clue-reveal-target-options">
          {targetOptions.map((item) => (
            <option key={item} value={item} />
          ))}
        </datalist>
      </div>

      {campaignData.clues.length === 0 ? (
        <div className="bg-theme-card border border-dashed border-theme rounded-lg p-8 text-center theme-text-secondary">
          暂无线索，先去“线索列表”创建条目。
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          {statusOrder.map((status) => (
            <section key={status} className="bg-theme-card border border-theme rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">{statusLabel[status]}</h3>
                <span className="text-xs theme-text-secondary">{cluesByStatus[status].length} 条</span>
              </div>
              {cluesByStatus[status].length === 0 ? (
                <div className="text-xs theme-text-secondary py-6 text-center border border-dashed border-theme rounded">
                  当前无条目
                </div>
              ) : (
                cluesByStatus[status].map((clue) => (
                  <article key={clue.id} className="border border-theme rounded p-3 space-y-3">
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => navigate(`/clues/${clue.id}`)}
                          className="font-medium text-left hover:text-primary"
                        >
                          {clue.name}
                        </button>
                        <span className="text-xs theme-text-secondary">{clue.type || '普通'}</span>
                      </div>
                      {(clue.tags || []).length > 0 && (
                        <div className="mt-1 text-xs theme-text-secondary">{(clue.tags || []).join(' / ')}</div>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-1">
                      {statusOrder.map((nextStatus) => (
                        <button
                          key={nextStatus}
                          type="button"
                          onClick={() => patchClue(clue, { revealStatus: nextStatus })}
                          className={`px-2 py-1 text-xs rounded border ${
                            normalizeStatus(clue) === nextStatus
                              ? 'bg-primary text-white border-primary'
                              : 'border-theme hover:bg-primary-light'
                          }`}
                        >
                          {statusLabel[nextStatus]}
                        </button>
                      ))}
                    </div>
                    <input
                      type="text"
                      value={clue.revealTarget || ''}
                      onChange={(event) => patchClue(clue, { revealTarget: event.target.value })}
                      placeholder="揭秘目标（如：玩家A / 侦探组）"
                      list="clue-reveal-target-options"
                      className="w-full px-2 py-1.5 text-sm border border-theme rounded bg-transparent"
                    />
                    <button
                      type="button"
                      onClick={() => handleRecordReveal(clue)}
                      className="w-full px-2 py-1.5 text-sm border border-primary text-primary rounded hover:bg-primary-light"
                    >
                      记录一次揭秘
                    </button>
                  </article>
                ))
              )}
            </section>
          ))}
        </div>
      )}

      <section className="bg-theme-card border border-theme rounded-lg p-4">
        <h3 className="font-semibold mb-3">揭秘日志</h3>
        {revealLogs.length === 0 ? (
          <div className="text-sm theme-text-secondary">暂无揭秘记录。</div>
        ) : (
          <div className="space-y-2">
            {revealLogs.slice(0, 30).map((log) => (
              <div key={log.id} className="border border-theme rounded px-3 py-2 text-sm">
                <button
                  type="button"
                  onClick={() => navigate(`/clues/${log.clueId}`)}
                  className="font-medium hover:text-primary"
                >
                  {log.clueName}
                </button>
                <span className="mx-2 theme-text-secondary">→</span>
                <span>{log.target}</span>
                <span className="mx-2 theme-text-secondary">·</span>
                <span className="theme-text-secondary">{new Date(log.revealedAt).toLocaleString()}</span>
                {log.note ? <span className="ml-2 theme-text-secondary">备注：{log.note}</span> : null}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default ClueBoard;
