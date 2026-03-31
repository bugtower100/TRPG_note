import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image as ImageIcon, Link, Bold, Italic, List, Eye, Edit } from 'lucide-react';
import { Editor, defaultValueCtx, rootCtx } from '@milkdown/core';
import { commonmark, insertImageCommand, toggleEmphasisCommand, toggleLinkCommand, toggleStrongCommand, wrapInBulletListCommand } from '@milkdown/preset-commonmark';
import { gfm } from '@milkdown/preset-gfm';
import { history } from '@milkdown/plugin-history';
import { listener, listenerCtx } from '@milkdown/plugin-listener';
import { Milkdown, MilkdownProvider, useEditor, useInstance } from '@milkdown/react';
import { $prose, callCommand, getMarkdown, replaceAll } from '@milkdown/utils';
import { Plugin, PluginKey } from '@milkdown/prose/state';
import { Decoration, DecorationSet } from '@milkdown/prose/view';
import { createPortal } from 'react-dom';
import { useCampaign } from '../../context/CampaignContext';
import { resourceService, ResourceItem } from '../../services/resourceService';
import RichTextDisplay from './RichTextDisplay';
import { RichTextTooltipContent, TooltipState, buildRichKeywordData } from './richTextReference';
import '@milkdown/prose/view/style/prosemirror.css';

const getEntityCollection = (campaignData: ReturnType<typeof useCampaign>['campaignData'], entityType: string) =>
  (campaignData as unknown as Record<string, any[]>)[entityType];

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: string;
}

const entityDecorationPluginKey = new PluginKey('trpg-rich-entity-decoration');

const createEntityDecorationPlugin = (keywordDataRef: React.MutableRefObject<ReturnType<typeof buildRichKeywordData>>) =>
  $prose(() =>
    new Plugin({
      key: entityDecorationPluginKey,
      props: {
        decorations(state) {
          const { allKeywords, entityMap, sectionTitleMap } = keywordDataRef.current;
          if (allKeywords.length === 0) return DecorationSet.empty;
          const escapedNames = allKeywords.map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
          const regex = new RegExp(`(${escapedNames.join('|')})`, 'gi');
          const decorations: Decoration[] = [];

          state.doc.descendants((node, pos, parent) => {
            if (!node.isText || !node.text) return;
            if (parent?.type.name === 'code_block') return;
            if (node.marks.some((mark) => mark.type.name.includes('link') || mark.type.name.includes('code'))) return;

            const text = node.text;
            regex.lastIndex = 0;
            let lastIndex = -1;
            let match: RegExpExecArray | null;

            while ((match = regex.exec(text)) !== null) {
              if (match.index < lastIndex) continue;
              const keywordLower = match[0].toLowerCase();
              const entityInfo = entityMap.get(keywordLower);
              const sectionInfo = sectionTitleMap.get(keywordLower);

              const attrs: Record<string, string> = {};
              if (entityInfo) {
                attrs.class = 'entity-link';
                attrs['data-kind'] = 'entity';
                attrs['data-id'] = entityInfo.id;
                attrs['data-type'] = entityInfo.type;
              } else if (sectionInfo && sectionInfo.length > 0) {
                attrs.class = 'section-link';
                attrs['data-kind'] = 'section';
                attrs['data-sectiontitle'] = keywordLower;
              } else {
                continue;
              }

              decorations.push(
                Decoration.inline(pos + match.index, pos + match.index + match[0].length, attrs)
              );
              lastIndex = match.index + match[0].length;
            }
          });

          return DecorationSet.create(state.doc, decorations);
        },
      },
    })
  );

interface MilkdownEditorInnerProps extends RichTextEditorProps {
  keywordData: ReturnType<typeof buildRichKeywordData>;
}

const MilkdownEditorInner: React.FC<MilkdownEditorInnerProps> = ({
  value,
  onChange,
  placeholder,
  minHeight,
  keywordData,
}) => {
  const editorHostRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const keywordDataRef = useRef(keywordData);
  const onChangeRef = useRef(onChange);
  const latestValueRef = useRef(value);
  const isSyncingRef = useRef(false);
  const { campaignData, openInTab } = useCampaign();
  const [isFocused, setIsFocused] = useState(false);
  const [isDraggingImage, setIsDraggingImage] = useState(false);
  const [isResourcePickerOpen, setIsResourcePickerOpen] = useState(false);
  const [resourceBusy, setResourceBusy] = useState(false);
  const [resources, setResources] = useState<ResourceItem[]>([]);
  const [resourceKeyword, setResourceKeyword] = useState('');
  const [tooltip, setTooltip] = useState<TooltipState>({
    visible: false,
    x: 0,
    y: 0,
    kind: null,
    entityId: null,
    entityType: null,
    sectionTitleLower: null,
    subItemTitleLower: null,
  });

  keywordDataRef.current = keywordData;
  onChangeRef.current = onChange;
  latestValueRef.current = value;

  useEditor(
    (root) =>
      Editor.make()
        .config((ctx) => {
          ctx.set(rootCtx, root);
          ctx.set(defaultValueCtx, value);
          ctx.get(listenerCtx).markdownUpdated((_, markdown) => {
            if (isSyncingRef.current) return;
            if (markdown === latestValueRef.current) return;
            latestValueRef.current = markdown;
            onChangeRef.current(markdown);
          });
        })
        .use(commonmark)
        .use(gfm)
        .use(history)
        .use(listener)
        .use(createEntityDecorationPlugin(keywordDataRef)),
    []
  );

  const [loading, getEditor] = useInstance();

  useEffect(() => {
    if (loading) return;
    const editor = getEditor();
    if (!editor) return;
    const current = editor.action(getMarkdown());
    if (current === value) return;
    isSyncingRef.current = true;
    editor.action(replaceAll(value, false));
    isSyncingRef.current = false;
  }, [value, loading, getEditor]);

  useEffect(() => {
    const host = editorHostRef.current;
    if (!host) return;

    const handleMouseOver = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest('.entity-link, .section-link') as HTMLElement | null;
      if (!target) return;
      const rect = target.getBoundingClientRect();
      setTooltip({
        visible: true,
        x: rect.left + window.scrollX,
        y: rect.bottom + window.scrollY + 5,
        kind:
          target.dataset.kind === 'section'
            ? 'section'
            : 'entity',
        entityId: target.dataset.id || null,
        entityType: target.dataset.type || null,
        sectionTitleLower: target.dataset.sectiontitle || null,
        subItemTitleLower: target.dataset.subitemtitle || null,
      });
    };

    const handleMouseOut = (e: MouseEvent) => {
      const next = e.relatedTarget as HTMLElement | null;
      if (next?.closest('.entity-link, .section-link')) return;
      setTooltip((prev) => ({ ...prev, visible: false }));
    };

    const handleDblClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest('.entity-link, .section-link') as HTMLElement | null;
      if (!target) return;
      const kind = target.dataset.kind;
      if (kind === 'entity') {
        const { id, type } = target.dataset;
        if (id && type) {
          const list = getEntityCollection(campaignData, type);
          const entity = Array.isArray(list) ? list.find((item) => item.id === id) : null;
          openInTab(type, id, entity?.name || '未命名');
          setTooltip((prev) => ({ ...prev, visible: false }));
        }
        return;
      }

      if (kind === 'section') {
        const titleKey = target.dataset.sectiontitle;
        if (!titleKey) return;
        const candidates = keywordDataRef.current.sectionTitleMap.get(titleKey) || [];
        if (candidates.length === 0) return;
        const first = candidates[0];
        openInTab(first.entityType, first.entityId, first.entityName, first.sectionTitle.toLowerCase());
        setTooltip((prev) => ({ ...prev, visible: false }));
        return;
      }
    };

    const handleFocusIn = () => setIsFocused(true);
    const handleFocusOut = () => {
      requestAnimationFrame(() => {
        const active = document.activeElement;
        setIsFocused(Boolean(active && host.contains(active)));
      });
    };

    host.addEventListener('mouseover', handleMouseOver);
    host.addEventListener('mouseout', handleMouseOut);
    host.addEventListener('dblclick', handleDblClick);
    host.addEventListener('focusin', handleFocusIn);
    host.addEventListener('focusout', handleFocusOut);

    return () => {
      host.removeEventListener('mouseover', handleMouseOver);
      host.removeEventListener('mouseout', handleMouseOut);
      host.removeEventListener('dblclick', handleDblClick);
      host.removeEventListener('focusin', handleFocusIn);
      host.removeEventListener('focusout', handleFocusOut);
    };
  }, [campaignData, openInTab]);

  const runCommand = useCallback(
    <T,>(command: { key: T }, payload?: unknown) => {
      if (loading) return;
      const editor = getEditor();
      if (!editor) return;
      editor.action(callCommand(command.key as never, payload));
    },
    [loading, getEditor]
  );

  const focusEditor = useCallback(() => {
    const editorElement = editorHostRef.current?.querySelector('.ProseMirror') as HTMLElement | null;
    editorElement?.focus();
  }, []);

  const loadResources = useCallback(async () => {
    setResourceBusy(true);
    try {
      const list = await resourceService.list();
      setResources(list);
    } catch {
      setResources([]);
    } finally {
      setResourceBusy(false);
    }
  }, []);

  const filteredResources = useMemo(() => {
    const keyword = resourceKeyword.trim().toLowerCase();
    if (!keyword) return resources;
    return resources.filter((item) => (
      item.displayName.toLowerCase().includes(keyword) ||
      item.ref.toLowerCase().includes(keyword)
    ));
  }, [resources, resourceKeyword]);

  const uploadAndInsertImages = useCallback(async (files: File[]) => {
    const imageFiles = files.filter((file) => file.type.startsWith('image/'));
    if (imageFiles.length === 0) return false;

    setResourceBusy(true);
    try {
      focusEditor();
      for (const file of imageFiles) {
        const data = await resourceService.upload(file);
        runCommand(insertImageCommand, {
          src: data.url,
          alt: file.name,
          title: file.name,
        });
      }
      await loadResources();
      setIsResourcePickerOpen(false);
      return true;
    } catch {
      window.alert('图片上传失败，请检查后端连接。');
      return false;
    } finally {
      setResourceBusy(false);
      setIsDraggingImage(false);
    }
  }, [focusEditor, loadResources, runCommand]);

  const handleInsertLink = () => {
    const href = window.prompt('输入链接地址');
    if (!href) return;
    runCommand(toggleLinkCommand, { href });
  };

  const openImagePicker = () => {
    setResourceKeyword('');
    setIsResourcePickerOpen(true);
    loadResources();
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (files.length === 0) return;
    void uploadAndInsertImages(files);
  };

  useEffect(() => {
    const host = editorHostRef.current;
    if (!host) return;

    const hasImageFile = (files: FileList | null) => (
      Array.from(files || []).some((file) => file.type.startsWith('image/'))
    );

    const getClipboardImageFiles = (items: DataTransferItemList | null) => (
      Array.from(items || [])
        .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
        .map((item) => item.getAsFile())
        .filter((file): file is File => Boolean(file))
    );

    const handlePaste = (event: ClipboardEvent) => {
      const files = getClipboardImageFiles(event.clipboardData?.items || null);
      if (files.length === 0) return;
      event.preventDefault();
      void uploadAndInsertImages(files);
    };

    const handleDragOver = (event: DragEvent) => {
      if (!hasImageFile(event.dataTransfer?.files || null)) return;
      event.preventDefault();
      event.dataTransfer!.dropEffect = 'copy';
      setIsDraggingImage(true);
    };

    const handleDragLeave = (event: DragEvent) => {
      const relatedTarget = event.relatedTarget as Node | null;
      if (relatedTarget && host.contains(relatedTarget)) return;
      setIsDraggingImage(false);
    };

    const handleDrop = (event: DragEvent) => {
      const files = Array.from(event.dataTransfer?.files || []).filter((file) => file.type.startsWith('image/'));
      if (files.length === 0) return;
      event.preventDefault();
      void uploadAndInsertImages(files);
    };

    host.addEventListener('paste', handlePaste);
    host.addEventListener('dragover', handleDragOver);
    host.addEventListener('dragleave', handleDragLeave);
    host.addEventListener('drop', handleDrop);

    return () => {
      host.removeEventListener('paste', handlePaste);
      host.removeEventListener('dragover', handleDragOver);
      host.removeEventListener('dragleave', handleDragLeave);
      host.removeEventListener('drop', handleDrop);
    };
  }, [uploadAndInsertImages]);

  return (
    <div className="space-y-0">
      <div className="flex items-center gap-1 p-2 border-b border-theme bg-theme-card/50">
        <button type="button" onClick={() => runCommand(toggleStrongCommand)} className="p-1.5 theme-text-secondary hover:bg-primary-light hover:text-primary rounded" title="加粗">
          <Bold size={16} />
        </button>
        <button type="button" onClick={() => runCommand(toggleEmphasisCommand)} className="p-1.5 theme-text-secondary hover:bg-primary-light hover:text-primary rounded" title="斜体">
          <Italic size={16} />
        </button>
        <button type="button" onClick={() => runCommand(wrapInBulletListCommand)} className="p-1.5 theme-text-secondary hover:bg-primary-light hover:text-primary rounded" title="列表">
          <List size={16} />
        </button>
        <div className="w-px h-4 bg-[var(--border-color)] mx-1" />
        <button type="button" onClick={handleInsertLink} className="p-1.5 theme-text-secondary hover:bg-primary-light hover:text-primary rounded" title="链接">
          <Link size={16} />
        </button>
        <button type="button" onClick={openImagePicker} className="p-1.5 theme-text-secondary hover:bg-primary-light hover:text-primary rounded" title="插入图片">
          <ImageIcon size={16} />
        </button>
      </div>

      <div className="relative milkdown-theme-bridge" ref={editorHostRef}>
        {!isFocused && !value.trim() && (
          <div className="absolute left-3 top-3 text-sm theme-text-secondary pointer-events-none z-10">
            {placeholder}
          </div>
        )}
        {isDraggingImage && (
          <div className="absolute inset-0 z-20 rounded bg-primary/10 border-2 border-dashed border-primary pointer-events-none flex items-center justify-center">
            <div className="px-3 py-2 rounded bg-theme-card border border-theme text-sm font-medium">
              松手以上传并插入图片
            </div>
          </div>
        )}
        <div className="milkdown-editor-shell" style={{ minHeight }}>
          <Milkdown />
        </div>
      </div>

      <div className="px-3 py-1 bg-theme-card/50 text-xs theme-text-secondary text-right border-t border-theme">
        支持 Markdown，自动识别实体并增强
      </div>

      {tooltip.visible && createPortal(
        <div
          className="fixed z-50 bg-theme-card p-3 rounded shadow-lg border border-theme pointer-events-none text-left animate-in fade-in zoom-in-95 duration-100"
          style={{
            left: tooltip.x,
            top: tooltip.y,
            transform: 'translateX(-10%)',
          }}
        >
          <RichTextTooltipContent tooltip={tooltip} campaignData={campaignData} keywordData={keywordData} />
        </div>,
        document.body
      )}

      {isResourcePickerOpen && createPortal(
        <div className="fixed inset-0 z-50 bg-black/35 flex items-center justify-center p-4">
          <div className="w-full max-w-3xl max-h-[80vh] bg-theme-card border border-theme rounded-lg shadow-xl flex flex-col">
            <div className="px-4 py-3 border-b border-theme flex items-center justify-between">
              <h3 className="font-semibold">插入资源图片</h3>
              <button
                type="button"
                onClick={() => setIsResourcePickerOpen(false)}
                className="px-3 py-1 rounded border border-theme hover:bg-primary-light text-sm"
              >
                关闭
              </button>
            </div>
            <div className="p-3 border-b border-theme flex flex-col gap-3 sm:flex-row sm:items-center">
              <input
                value={resourceKeyword}
                onChange={(e) => setResourceKeyword(e.target.value)}
                placeholder="按图片名或资源ID搜索..."
                className="flex-1 px-3 py-2 rounded border border-theme bg-transparent"
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={loadResources}
                  disabled={resourceBusy}
                  className="px-3 py-2 rounded border border-theme hover:bg-primary-light disabled:opacity-50 text-sm"
                >
                  刷新
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={resourceBusy}
                  className="px-3 py-2 rounded border border-theme hover:bg-primary-light disabled:opacity-50 text-sm"
                >
                  上传并插入
                </button>
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
            </div>
            <div className="p-3 overflow-auto space-y-2">
              {resourceBusy && resources.length === 0 ? (
                <div className="text-sm theme-text-secondary py-8 text-center">正在加载资源...</div>
              ) : filteredResources.length === 0 ? (
                <div className="text-sm theme-text-secondary py-8 text-center">没有匹配的资源</div>
              ) : (
                filteredResources.map((item) => (
                  <button
                    key={item.ref}
                    type="button"
                    onClick={() => {
                      runCommand(insertImageCommand, {
                        src: item.url,
                        alt: item.displayName,
                        title: item.displayName,
                      });
                      setIsResourcePickerOpen(false);
                    }}
                    className="w-full text-left border rounded p-2 transition border-theme hover:bg-primary-light/30"
                  >
                    <div className="flex items-center gap-3">
                      <img src={item.url} alt={item.displayName} className="w-10 h-10 rounded object-cover border border-theme shrink-0" />
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate" title={item.displayName}>{item.displayName}</div>
                        <div className="text-[11px] theme-text-secondary truncate" title={item.ref}>{item.ref}</div>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

const RichTextEditor: React.FC<RichTextEditorProps> = ({ 
  value, 
  onChange, 
  placeholder = '支持 Markdown 格式...', 
  className = '',
  minHeight = '150px'
}) => {
  const [isPreview, setIsPreview] = useState(true);
  const { campaignData } = useCampaign();
  const keywordData = useMemo(() => buildRichKeywordData(campaignData), [campaignData]);

  return (
    <div className={`border border-theme rounded-md overflow-hidden bg-theme-card focus-within:ring-2 focus-within:ring-primary focus-within:border-transparent ${className}`}>
      <div className="flex items-center justify-between p-2 border-b border-theme bg-theme-card/50">
        <div className="text-xs theme-text-secondary">{isPreview ? '预览模式' : '编辑模式'}</div>
        <button
          type="button"
          onClick={() => setIsPreview(!isPreview)}
          className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
            isPreview
              ? 'bg-primary text-white'
              : 'theme-text-secondary hover:bg-primary-light hover:text-primary'
          }`}
        >
          {isPreview ? (
            <>
              <Edit size={14} /> 进入编辑
            </>
          ) : (
            <>
              <Eye size={14} /> 完成编辑
            </>
          )}
        </button>
      </div>

      {isPreview ? (
        <div className="p-3 bg-theme-card overflow-y-auto" style={{ minHeight }}>
          <RichTextDisplay content={value || '（暂无内容）'} />
        </div>
      ) : (
        <MilkdownProvider>
          <MilkdownEditorInner
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            className={className}
            minHeight={minHeight}
            keywordData={keywordData}
          />
        </MilkdownProvider>
      )}
    </div>
  );
};

export default RichTextEditor;
