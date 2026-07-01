import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Upload, X } from 'lucide-react';
import type { CharacterSheetImportPreview } from '../../../generated/api';
import { formatCharacterSheetSystem, getNumberValue, getRecord, getStringValue } from '../utils';

interface CharacterSheetImportDialogProps {
  open: boolean;
  busy: boolean;
  mode?: 'create' | 'overwrite';
  targetName?: string;
  defaultSystemHint?: 'auto' | 'coc7' | 'dnd5e';
  onClose: () => void;
  onPreview: (payload: { text: string; systemHint?: string }) => Promise<CharacterSheetImportPreview>;
  onImport: (preview: CharacterSheetImportPreview) => Promise<void>;
}

const serializeDebugError = (error: unknown) => {
  if (error instanceof Error) {
    const typed = error as Error & { cause?: unknown };
    return {
      type: error.name || 'Error',
      message: error.message,
      stack: error.stack || '',
      cause: typed.cause ?? null,
    };
  }
  if (typeof error === 'object' && error !== null) {
    try {
      return JSON.parse(JSON.stringify(error));
    } catch {
      return { value: String(error) };
    }
  }
  return { value: String(error) };
};

const CharacterSheetImportDialog: React.FC<CharacterSheetImportDialogProps> = ({
  open,
  busy,
  mode = 'create',
  targetName,
  defaultSystemHint = 'auto',
  onClose,
  onPreview,
  onImport,
}) => {
  const [text, setText] = useState('');
  const [systemHint, setSystemHint] = useState<'auto' | 'coc7' | 'dnd5e'>(defaultSystemHint);
  const [preview, setPreview] = useState<CharacterSheetImportPreview | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [errorText, setErrorText] = useState('');

  useEffect(() => {
    if (!open) {
      setText('');
      setSystemHint(defaultSystemHint);
      setPreview(null);
      setPreviewing(false);
      setErrorText('');
    }
  }, [defaultSystemHint, open]);

  const summaryItems = useMemo(() => {
    if (!preview) return [];
    if (preview.system === 'dnd5e') {
      const dnd = getRecord(preview.payload.dnd5e);
      const derived = getRecord(dnd.derived);
      const hp = getRecord(derived.hp);
      return [
        { label: '种族', value: getStringValue(dnd.race, '未识别') },
        { label: '职业', value: getStringValue(dnd.className, '未识别') },
        { label: '等级', value: String(getNumberValue(dnd.level, 1)) },
        { label: 'HP', value: `${getNumberValue(hp.current, 0)} / ${getNumberValue(hp.max, 0)}` },
      ];
    }
    const coc = getRecord(preview.payload.coc7);
    const derived = getRecord(coc.derived);
    const hp = getRecord(derived.hp);
    const san = getRecord(derived.san);
    return [
      { label: '职业', value: getStringValue(coc.occupation, '未识别') },
      { label: 'HP', value: `${getNumberValue(hp.current, 0)} / ${getNumberValue(hp.max, 0)}` },
      { label: 'SAN', value: `${getNumberValue(san.current, 0)} / ${getNumberValue(san.max, 0)}` },
      { label: '幸运', value: String(getNumberValue(derived.luck, 0)) },
    ];
  }, [preview]);

  if (!open) return null;

  const handlePreview = async () => {
    setPreviewing(true);
    setErrorText('');
    // #region debug-point A:preview-request
    fetch('http://127.0.0.1:7777/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'import-preview-failure',
        runId: 'pre-fix',
        hypothesisId: 'A',
        location: 'CharacterSheetImportDialog.tsx:handlePreview:before',
        msg: '[DEBUG] import preview request start',
        data: { mode, systemHint, textLength: text.length, targetName: targetName || '', hasText: text.trim().length > 0 },
        ts: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
    try {
      const next = await onPreview({
        text,
        systemHint: systemHint === 'auto' ? undefined : systemHint,
      });
      // #region debug-point A:preview-success
      fetch('http://127.0.0.1:7777/event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: 'import-preview-failure',
          runId: 'pre-fix',
          hypothesisId: 'A',
          location: 'CharacterSheetImportDialog.tsx:handlePreview:success',
          msg: '[DEBUG] import preview request success',
          data: {
            detectedSystem: next.detectedSystem,
            system: next.system,
            confidence: next.confidence,
            warningsCount: next.warnings?.length || 0,
            missingFieldsCount: next.missingFields?.length || 0,
          },
          ts: Date.now(),
        }),
      }).catch(() => {});
      // #endregion
      setPreview(next);
    } catch (error) {
      // #region debug-point B:preview-error
      fetch('http://127.0.0.1:7777/event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: 'import-preview-failure',
          runId: 'pre-fix',
          hypothesisId: 'B',
          location: 'CharacterSheetImportDialog.tsx:handlePreview:error',
          msg: '[DEBUG] import preview request failed',
          data: {
            error: serializeDebugError(error),
            systemHint,
            textLength: text.length,
          },
          ts: Date.now(),
        }),
      }).catch(() => {});
      // #endregion
      setPreview(null);
      setErrorText(error instanceof Error ? error.message : '文本预览失败');
    } finally {
      setPreviewing(false);
    }
  };

  const handleImport = async () => {
    if (!preview) return;
    setErrorText('');
    try {
      await onImport(preview);
      onClose();
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : '导入角色卡失败');
    }
  };

  const title = mode === 'overwrite' ? '文本导入覆盖角色卡' : '文本导入角色卡';
  const confirmLabel = mode === 'overwrite' ? '覆盖当前角色卡' : '直接创建角色卡';
  const helperText = mode === 'overwrite'
    ? `粘贴数值字符串、日志文本或常见角色卡片段，系统会先识别预览，再覆盖当前角色卡的属性与技能，不会改动归属、权限和关联。${targetName ? ` 当前目标：${targetName}` : ''}`
    : '粘贴数值字符串、日志文本或常见角色卡片段，系统会先识别预览，再创建新角色卡。';

  return createPortal(
    <div className="fixed inset-0 z-[1400] bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="w-full max-w-5xl max-h-[90vh] overflow-y-auto rounded-xl border border-theme theme-card shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-theme theme-card px-5 py-4">
          <div>
            <h2 className="text-xl font-bold">{title}</h2>
            <p className="mt-1 text-sm theme-text-secondary">
              {helperText}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-theme p-2 theme-text-secondary hover:bg-primary-light"
            aria-label="关闭导入弹窗"
          >
            <X size={18} />
          </button>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.1fr)_360px] gap-6 p-5">
          <div className="space-y-4 min-w-0">
            <div className="grid grid-cols-1 md:grid-cols-[180px_minmax(0,1fr)] gap-4">
              <label className="space-y-1 text-sm">
                <span className="theme-text-secondary">系统提示</span>
                <select
                  value={systemHint}
                  onChange={(event) => setSystemHint(event.target.value as 'auto' | 'coc7' | 'dnd5e')}
                  className="w-full px-3 py-2 border border-theme rounded bg-transparent"
                >
                  <option value="auto">自动识别</option>
                  <option value="coc7">按 CoC 识别</option>
                  <option value="dnd5e">按 DND 识别</option>
                </select>
              </label>
              <div className="text-xs theme-text-secondary border border-theme rounded-lg px-3 py-3 bg-theme-card/60">
                支持示例：`STR 70 CON 55 SIZ 60 DEX 65 APP 50 INT 80 POW 60 EDU 75 SAN 60/99 HP 11/11`
                或 `力量 16 敏捷 14 体质 12 智力 10 感知 15 魅力 8 AC 16 HP 22/22 等级 3 职业 牧师`
              </div>
            </div>

            <label className="space-y-1 text-sm block">
              <span className="theme-text-secondary">原始文本</span>
              <textarea
                value={text}
                onChange={(event) => setText(event.target.value)}
                rows={16}
                placeholder="把原始角色卡文本粘贴到这里"
                className="w-full px-3 py-3 border border-theme rounded bg-transparent resize-y font-mono text-sm leading-6"
              />
            </label>

            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={handlePreview}
                disabled={previewing || busy}
                className="px-3 py-2 rounded border border-theme hover:bg-primary-light text-sm disabled:opacity-60"
              >
                {previewing ? '识别中...' : '预览识别结果'}
              </button>
              <button
                type="button"
                onClick={handleImport}
                disabled={!preview || previewing || busy}
                className="inline-flex items-center gap-2 px-3 py-2 rounded bg-primary text-white hover:bg-primary-dark disabled:opacity-60 text-sm"
              >
                <Upload size={16} />
                {confirmLabel}
              </button>
            </div>
            {errorText && (
              <div className="text-sm border border-red-200 text-red-600 rounded-lg px-3 py-2 bg-red-50/80">
                {errorText}
              </div>
            )}
          </div>

          <aside className="space-y-4">
            <div className="border border-theme rounded-xl p-4 bg-theme-card/70">
              <div className="text-sm font-medium">识别预览</div>
              {preview ? (
                <div className="mt-3 space-y-3 text-sm">
                  <div className="flex flex-wrap gap-2">
                    <span className="px-2 py-1 rounded-full text-xs border border-theme theme-text-secondary">
                      {formatCharacterSheetSystem(preview.system)}
                    </span>
                    <span className="px-2 py-1 rounded-full text-xs border border-theme theme-text-secondary">
                      置信度 {Math.round(preview.confidence * 100)}%
                    </span>
                  </div>
                  <div>
                    <div className="text-xs theme-text-secondary">名称</div>
                    <div className="font-medium mt-1">{preview.name}</div>
                  </div>
                  {preview.summary && (
                    <div>
                      <div className="text-xs theme-text-secondary">摘要</div>
                      <div className="mt-1">{preview.summary}</div>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    {summaryItems.map((item) => (
                      <div key={item.label} className="rounded-xl border border-theme px-3 py-2 bg-theme-card/60">
                        <div className="text-xs theme-text-secondary">{item.label}</div>
                        <div className="mt-1 text-sm font-medium">{item.value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="mt-3 text-sm theme-text-secondary">
                  先点击“预览识别结果”，这里会显示解析后的角色卡摘要。
                </div>
              )}
            </div>

            {preview?.warnings && preview.warnings.length > 0 && (
              <div className="border border-amber-200 rounded-xl p-4 bg-amber-50/80">
                <div className="text-sm font-medium text-amber-800">识别提醒</div>
                <div className="mt-2 space-y-1 text-sm text-amber-700">
                  {preview.warnings.map((warning) => (
                    <div key={warning}>{warning}</div>
                  ))}
                </div>
              </div>
            )}

            {preview?.missingFields && preview.missingFields.length > 0 && (
              <div className="border border-theme rounded-xl p-4 bg-theme-card/70">
                <div className="text-sm font-medium">未识别字段</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {preview.missingFields.map((field) => (
                    <span key={field} className="px-2 py-1 rounded-full text-xs border border-theme theme-text-secondary">
                      {field}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default CharacterSheetImportDialog;
