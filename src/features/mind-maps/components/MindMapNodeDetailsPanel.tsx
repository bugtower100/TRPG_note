import { memo, useEffect, useMemo, useState } from 'react';
import { Edit3, GitBranchPlus, Link2, Plus, Save, Trash2, X } from 'lucide-react';
import RichTextDisplay from '../../../components/common/RichTextDisplay';
import RichTextEditor from '../../../components/common/RichTextEditor';
import type {
  RichKeywordData,
  TooltipTargetPayload,
} from '../../../components/common/richTextReference';
import { MIND_MAP_MAX_ENTITY_REFS } from '../../../types';
import type { MindMapEntityReference, MindMapNode } from '../../../types';
import { getMindMapNodeEntityRefs } from '../../../utils/mindMapCompatibility';
import {
  MIND_MAP_ENTITY_TYPE_LABELS,
  mindMapEntityReferenceKey,
  tokenizeMindMapKeywords,
  type MindMapEntityOption,
} from '../utils/mindMapReferences';
import MindMapKeywordText from './MindMapKeywordText';

interface MindMapNodeDetailsPanelProps {
  node: MindMapNode;
  isRoot: boolean;
  directChildCount: number;
  branchNodeCount: number;
  keywordData: RichKeywordData;
  entityOptions: MindMapEntityOption[];
  entityOptionsByKey: Map<string, MindMapEntityOption>;
  onClose: () => void;
  onSave: (
    nodeId: string,
    title: string,
    content: string,
    entityRefs: MindMapEntityReference[]
  ) => void;
  onAddChild: (nodeId: string) => void;
  onAddSibling: (nodeId: string) => void;
  onRequestDelete: (nodeId: string) => void;
  onOpenTarget: (target: TooltipTargetPayload) => void;
}

const MindMapNodeDetailsPanel = memo(({
  node,
  isRoot,
  directChildCount,
  branchNodeCount,
  keywordData,
  entityOptions,
  entityOptionsByKey,
  onClose,
  onSave,
  onAddChild,
  onAddSibling,
  onRequestDelete,
  onOpenTarget,
}: MindMapNodeDetailsPanelProps) => {
  const [editing, setEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(node.title);
  const [draftContent, setDraftContent] = useState(node.content);
  const nodeEntityRefs = useMemo(
    () => getMindMapNodeEntityRefs(node),
    [node]
  );
  const [draftEntityRefs, setDraftEntityRefs] = useState(nodeEntityRefs);
  const [pendingEntityReferenceKey, setPendingEntityReferenceKey] = useState('');
  const titleSegments = useMemo(
    () => tokenizeMindMapKeywords(node.title, keywordData),
    [keywordData, node.title]
  );
  const entityOptionsByType = useMemo(() => {
    const grouped = new Map<string, MindMapEntityOption[]>();
    entityOptions.forEach((option) => {
      const options = grouped.get(option.entityType) || [];
      options.push(option);
      grouped.set(option.entityType, options);
    });
    return grouped;
  }, [entityOptions]);
  const draftEntityReferenceKeys = useMemo(
    () => new Set(draftEntityRefs.map(mindMapEntityReferenceKey)),
    [draftEntityRefs]
  );

  useEffect(() => {
    setEditing(false);
    setDraftTitle(node.title);
    setDraftContent(node.content);
    setDraftEntityRefs(nodeEntityRefs);
    setPendingEntityReferenceKey('');
  }, [
    node.content,
    node.id,
    node.title,
    nodeEntityRefs,
  ]);

  const cancelEditing = () => {
    setDraftTitle(node.title);
    setDraftContent(node.content);
    setDraftEntityRefs(nodeEntityRefs);
    setPendingEntityReferenceKey('');
    setEditing(false);
  };

  const saveChanges = () => {
    onSave(node.id, draftTitle, draftContent, draftEntityRefs);
    setEditing(false);
  };

  const addDraftEntityReference = () => {
    const option = entityOptionsByKey.get(pendingEntityReferenceKey);
    if (!option || draftEntityRefs.length >= MIND_MAP_MAX_ENTITY_REFS) return;
    const reference = {
      entityType: option.entityType,
      entityId: option.entityId,
    };
    const key = mindMapEntityReferenceKey(reference);
    if (draftEntityReferenceKeys.has(key)) return;
    setDraftEntityRefs((current) => [...current, reference]);
    setPendingEntityReferenceKey('');
  };

  return (
    <aside
      className="mind-map-details-panel fixed inset-x-0 bottom-0 z-50 max-h-[82vh] overflow-y-auto rounded-t-2xl border border-theme bg-theme-card p-4 shadow-2xl md:absolute md:inset-y-3 md:left-auto md:right-3 md:w-[390px] md:rounded-xl"
      aria-label="思维导图节点详情"
      data-mind-map-editor-active={editing ? 'true' : undefined}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold">节点详情</h3>
            {isRoot ? (
              <span className="rounded bg-primary-light px-2 py-0.5 text-xs text-primary">
                中心主题
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-xs theme-text-secondary">
            {directChildCount} 个直接子节点 · 当前分支共 {branchNodeCount} 个节点
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded p-1.5 hover:bg-primary-light"
          aria-label="关闭节点详情"
        >
          <X size={18} aria-hidden="true" />
        </button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 border-y border-theme py-3">
        <button
          type="button"
          onClick={() => onAddChild(node.id)}
          className="inline-flex items-center gap-1.5 rounded border border-theme px-2.5 py-1.5 text-xs hover:bg-primary-light"
        >
          <GitBranchPlus size={15} aria-hidden="true" />
          添加子节点
        </button>
        <button
          type="button"
          onClick={() => onAddSibling(node.id)}
          disabled={isRoot}
          title={isRoot ? '中心主题不能添加同级节点' : undefined}
          className="inline-flex items-center gap-1.5 rounded border border-theme px-2.5 py-1.5 text-xs hover:bg-primary-light disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus size={15} aria-hidden="true" />
          添加同级
        </button>
        <button
          type="button"
          onClick={() => onRequestDelete(node.id)}
          disabled={isRoot}
          title={isRoot ? '中心主题只能通过删除整张思维导图移除' : undefined}
          className="inline-flex items-center gap-1.5 rounded border border-red-300 px-2.5 py-1.5 text-xs text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Trash2 size={15} aria-hidden="true" />
          删除分支
        </button>
      </div>

      {editing ? (
        <div className="mt-4 space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">节点名称</span>
            <textarea
              value={draftTitle}
              onChange={(event) => setDraftTitle(event.target.value)}
              rows={3}
              className="w-full resize-y rounded border border-theme bg-theme-card px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="输入节点名称"
            />
          </label>
          <div>
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <span className="text-sm font-medium">显式绑定条目</span>
              <span className="text-xs theme-text-secondary">
                {draftEntityRefs.length}/{MIND_MAP_MAX_ENTITY_REFS}
              </span>
            </div>
            <div className="flex gap-2">
              <select
                value={pendingEntityReferenceKey}
                disabled={draftEntityRefs.length >= MIND_MAP_MAX_ENTITY_REFS}
                onChange={(event) => setPendingEntityReferenceKey(event.target.value)}
                className="min-w-0 flex-1 rounded border border-theme bg-theme-card px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
              >
                <option value="">选择要添加的条目</option>
                {Object.entries(MIND_MAP_ENTITY_TYPE_LABELS).map(([entityType, label]) => {
                  const options = entityOptionsByType.get(entityType) || [];
                  return options.length > 0 ? (
                    <optgroup key={entityType} label={label}>
                      {options.map((option) => (
                        <option
                          key={option.key}
                          value={option.key}
                          disabled={draftEntityReferenceKeys.has(option.key)}
                        >
                          {option.name}
                          {draftEntityReferenceKeys.has(option.key) ? '（已绑定）' : ''}
                        </option>
                      ))}
                    </optgroup>
                  ) : null;
                })}
              </select>
              <button
                type="button"
                disabled={
                  !pendingEntityReferenceKey
                  || draftEntityRefs.length >= MIND_MAP_MAX_ENTITY_REFS
                }
                onClick={addDraftEntityReference}
                className="shrink-0 rounded border border-theme px-3 py-2 text-sm hover:bg-primary-light disabled:cursor-not-allowed disabled:opacity-50"
              >
                添加
              </button>
            </div>
            {draftEntityRefs.length > 0 ? (
              <div className="mt-2 space-y-2">
                {draftEntityRefs.map((reference) => {
                  const key = mindMapEntityReferenceKey(reference);
                  const option = entityOptionsByKey.get(key);
                  return (
                    <div
                      key={key}
                      className={`flex items-center justify-between gap-2 rounded border px-2.5 py-2 text-sm ${
                        option ? 'border-theme' : 'border-red-300 bg-red-50 text-red-700'
                      }`}
                    >
                      <span className="min-w-0 truncate">
                        {option
                          ? `${option.typeLabel} · ${option.name}`
                          : `绑定已失效 · ${reference.entityType}:${reference.entityId}`}
                      </span>
                      <button
                        type="button"
                        className="shrink-0 rounded p-1 hover:bg-primary-light"
                        aria-label={`移除绑定 ${option?.name || reference.entityId}`}
                        onClick={() => setDraftEntityRefs((current) => (
                          current.filter((item) => mindMapEntityReferenceKey(item) !== key)
                        ))}
                      >
                        <X size={15} aria-hidden="true" />
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="mt-2 text-xs theme-text-secondary">尚未添加显式绑定。</div>
            )}
            <span className="mt-1 block text-xs theme-text-secondary">
              显式绑定不依赖节点标题，可与自动关键词链接同时存在。
            </span>
          </div>
          <div>
            <div className="mb-1.5 text-sm font-medium">详细内容</div>
            <RichTextEditor
              value={draftContent}
              onChange={setDraftContent}
              placeholder="记录节点详情，支持轻量 Markdown..."
              minHeight="240px"
              mode="edit"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={cancelEditing}
              className="rounded border border-theme px-3 py-2 text-sm hover:bg-primary-light"
            >
              取消
            </button>
            <button
              type="button"
              onClick={saveChanges}
              className="inline-flex items-center gap-1.5 rounded bg-primary px-3 py-2 text-sm text-white hover:bg-primary-dark"
            >
              <Save size={16} aria-hidden="true" />
              保存
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          <div>
            <div className="text-xs font-medium uppercase tracking-wide theme-text-secondary">
              节点名称
            </div>
            <div className="mt-1 whitespace-pre-wrap break-words text-base font-semibold">
              <MindMapKeywordText
                segments={titleSegments}
                onOpenTarget={onOpenTarget}
              />
            </div>
          </div>
          <div>
            <div className="text-xs font-medium uppercase tracking-wide theme-text-secondary">
              显式绑定
            </div>
            {nodeEntityRefs.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {nodeEntityRefs.map((reference) => {
                  const key = mindMapEntityReferenceKey(reference);
                  const option = entityOptionsByKey.get(key);
                  return option ? (
                    <button
                      key={key}
                      type="button"
                      onClick={() => onOpenTarget({
                        entityType: option.entityType,
                        entityId: option.entityId,
                        title: option.name,
                      })}
                      className="inline-flex max-w-full items-center gap-1.5 rounded border border-theme px-2.5 py-1.5 text-sm text-primary hover:bg-primary-light"
                    >
                      <Link2 size={15} aria-hidden="true" />
                      <span className="truncate">
                        {option.typeLabel} · {option.name}
                      </span>
                    </button>
                  ) : (
                    <div
                      key={key}
                      className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700"
                    >
                      绑定已失效 · {reference.entityType}:{reference.entityId}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="mt-1 text-sm theme-text-secondary">未显式绑定条目</div>
            )}
          </div>
          <div>
            <div className="text-xs font-medium uppercase tracking-wide theme-text-secondary">
              详细内容
            </div>
            <div className="mt-2 min-h-32 rounded border border-theme p-3">
              {node.content.trim() ? (
                <RichTextDisplay content={node.content} />
              ) : (
                <span className="text-sm theme-text-secondary">暂无详细内容</span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="inline-flex w-full items-center justify-center gap-2 rounded bg-primary px-3 py-2 text-sm text-white hover:bg-primary-dark"
          >
            <Edit3 size={16} aria-hidden="true" />
            编辑节点
          </button>
        </div>
      )}
    </aside>
  );
});

MindMapNodeDetailsPanel.displayName = 'MindMapNodeDetailsPanel';

export default MindMapNodeDetailsPanel;
