import { memo, useEffect, useMemo, useState } from 'react';
import { Edit3, GitBranchPlus, Link2, Plus, Save, Trash2, X } from 'lucide-react';
import RichTextDisplay from '../../../components/common/RichTextDisplay';
import RichTextEditor from '../../../components/common/RichTextEditor';
import type {
  RichKeywordData,
  TooltipTargetPayload,
} from '../../../components/common/richTextReference';
import type { MindMapEntityReference, MindMapNode } from '../../../types';
import { getMindMapNodeEntityRefs } from '../../../utils/mindMapCompatibility';
import {
  tokenizeMindMapKeywords,
} from '../utils/mindMapReferences';
import MindMapKeywordText from './MindMapKeywordText';

interface MindMapNodeDetailsPanelProps {
  node: MindMapNode;
  isRoot: boolean;
  directChildCount: number;
  branchNodeCount: number;
  keywordData: RichKeywordData;
  onClose: () => void;
  onSave: (
    nodeId: string,
    title: string,
    content: string,
    entityRefs: MindMapEntityReference[]
  ) => void;
  onAddChild: (nodeId: string) => void;
  onAddSibling: (nodeId: string) => void;
  onStartConnection: (nodeId: string) => void;
  onRequestDelete: (nodeId: string) => void;
  onOpenTarget: (target: TooltipTargetPayload) => void;
}

const MindMapNodeDetailsPanel = memo(({
  node,
  isRoot,
  directChildCount,
  branchNodeCount,
  keywordData,
  onClose,
  onSave,
  onAddChild,
  onAddSibling,
  onStartConnection,
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
  const titleSegments = useMemo(
    () => tokenizeMindMapKeywords(node.title, keywordData),
    [keywordData, node.title]
  );

  useEffect(() => {
    setEditing(false);
    setDraftTitle(node.title);
    setDraftContent(node.content);
  }, [
    node.content,
    node.id,
    node.title,
    nodeEntityRefs,
  ]);

  const cancelEditing = () => {
    setDraftTitle(node.title);
    setDraftContent(node.content);
    setEditing(false);
  };

  const saveChanges = () => {
    onSave(node.id, draftTitle, draftContent, nodeEntityRefs);
    setEditing(false);
  };

  return (
    <aside
      className="mind-map-details-panel rounded-xl border border-theme p-3 shadow-lg"
      aria-label="思维导图/白板节点详情"
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

      <div className="mt-3 flex flex-wrap gap-2 border-y border-theme py-2.5">
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
          disabled={!node.parentId}
          title={!node.parentId ? '独立节点不能添加同级节点' : undefined}
          className="inline-flex items-center gap-1.5 rounded border border-theme px-2.5 py-1.5 text-xs hover:bg-primary-light disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus size={15} aria-hidden="true" />
          添加同级
        </button>
        <button
          type="button"
          onClick={() => onStartConnection(node.id)}
          className="inline-flex items-center gap-1.5 rounded border border-theme px-2.5 py-1.5 text-xs hover:bg-primary-light"
        >
          <Link2 size={15} aria-hidden="true" />
          从此节点连线
        </button>
        <button
          type="button"
          onClick={() => onRequestDelete(node.id)}
          disabled={isRoot}
          title={isRoot ? '中心主题只能通过删除整张思维导图/白板移除' : undefined}
          className="inline-flex items-center gap-1.5 rounded border border-red-300 px-2.5 py-1.5 text-xs text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Trash2 size={15} aria-hidden="true" />
          删除分支
        </button>
      </div>

      {editing ? (
        <div className="mt-3 space-y-3">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">节点名称</span>
            <textarea
              value={draftTitle}
              onChange={(event) => setDraftTitle(event.target.value)}
              rows={2}
              className="w-full resize-y rounded border border-theme bg-theme-card px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="输入节点名称"
            />
          </label>
          <div>
            <div className="mb-1.5 text-sm font-medium">详细内容</div>
            <RichTextEditor
              value={draftContent}
              onChange={setDraftContent}
              placeholder="记录节点详情，支持轻量 Markdown..."
              minHeight="140px"
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
        <div className="mt-3 space-y-3">
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
              详细内容
            </div>
            <div className="mt-2 min-h-24 rounded border border-theme p-3">
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
