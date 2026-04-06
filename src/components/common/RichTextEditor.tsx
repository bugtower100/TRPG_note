import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image as ImageIcon, Link, Bold, Italic, List, Eye, Edit, Underline, Palette, Highlighter } from 'lucide-react';
import { Editor, defaultValueCtx, editorViewCtx, rootCtx } from '@milkdown/core';
import { commonmark, insertImageCommand, toggleEmphasisCommand, toggleLinkCommand, toggleStrongCommand, wrapInBulletListCommand } from '@milkdown/preset-commonmark';
import { gfm } from '@milkdown/preset-gfm';
import { history } from '@milkdown/plugin-history';
import { listener, listenerCtx } from '@milkdown/plugin-listener';
import { Milkdown, MilkdownProvider, useEditor, useInstance } from '@milkdown/react';
import { $prose, callCommand, getMarkdown, replaceAll } from '@milkdown/utils';
import { EditorState, Plugin, PluginKey } from '@milkdown/prose/state';
import { Decoration, DecorationSet } from '@milkdown/prose/view';
import { createPortal } from 'react-dom';
import { useCampaign } from '../../context/CampaignContext';
import { resourceService, ResourceItem } from '../../services/resourceService';
import RichTextDisplay from './RichTextDisplay';
import KeywordPreviewSheet from './KeywordPreviewSheet';
import {
  RichTextTooltipContent,
  TooltipState,
  buildImageTitleMetadata,
  buildRichKeywordData,
  normalizeImageAlignValue,
  normalizeImageWidthValue,
  parseImageTitleMetadata,
} from './richTextReference';
import '@milkdown/prose/view/style/prosemirror.css';

const getEntityCollection = (campaignData: ReturnType<typeof useCampaign>['campaignData'], entityType: string) =>
  (campaignData as unknown as Record<string, any[]>)[entityType];

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: string;
  mode?: 'toggle' | 'edit' | 'preview';
}

interface ImageContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  imageIndex: number;
  width: string | null;
  align: 'left' | 'center' | 'right' | null;
}

const entityDecorationPluginKey = new PluginKey('trpg-rich-entity-decoration');
const richStyleDecorationPluginKey = new PluginKey('trpg-rich-style-decoration');
const UNDERLINE_OPEN_TAG = '<u>';
const UNDERLINE_CLOSE_TAG = '</u>';
const SPAN_CLOSE_TAG = '</span>';
const COLOR_OPEN_TAG_REGEX = /^<span data-rte-color="(#[0-9a-fA-F]{6})">$/;
const BG_OPEN_TAG_REGEX = /^<span data-rte-bg="(#[0-9a-fA-F]{6})">$/;
const TEXT_COLOR_PALETTE = ['#b91c1c', '#ea580c', '#ca8a04', '#15803d', '#0f766e', '#1d4ed8', '#7c3aed', '#be185d'];
const TEXT_BG_PALETTE = ['#fda4af', '#fdba74', '#fde047', '#86efac', '#5eead4', '#93c5fd', '#c4b5fd', '#f9a8d4'];

const isValidTextColor = (value: string) => /^#[0-9a-fA-F]{6}$/.test(value);
const buildStyleOpenTag = (attribute: 'data-rte-color' | 'data-rte-bg', color: string) => `<span ${attribute}="${color.toLowerCase()}">`;

type RichStyleType = 'underline' | 'color' | 'bg';

interface RichStyleRange {
  type: RichStyleType;
  openValue: string;
  closeValue: string;
  openFrom: number;
  openTo: number;
  contentFrom: number;
  contentTo: number;
  closeFrom: number;
  closeTo: number;
}

const getHtmlStyleType = (value: string): RichStyleType | null => {
  if (value === UNDERLINE_OPEN_TAG) return 'underline';
  if (COLOR_OPEN_TAG_REGEX.test(value)) return 'color';
  if (BG_OPEN_TAG_REGEX.test(value)) return 'bg';
  return null;
};

const getHtmlCloseValue = (type: RichStyleType) => (type === 'underline' ? UNDERLINE_CLOSE_TAG : SPAN_CLOSE_TAG);

const collectRichStyleRanges = (state: EditorState) => {
  const stack: Array<{
    type: RichStyleType;
    openValue: string;
    openFrom: number;
    openTo: number;
  }> = [];
  const ranges: RichStyleRange[] = [];

  state.doc.descendants((node, pos) => {
    if (node.type.name !== 'html') return;
    const value = String(node.attrs.value || '').trim();
    const styleType = getHtmlStyleType(value);

    if (styleType) {
      stack.push({
        type: styleType,
        openValue: value,
        openFrom: pos,
        openTo: pos + node.nodeSize,
      });
      return;
    }

    if (value !== UNDERLINE_CLOSE_TAG && value !== SPAN_CLOSE_TAG) {
      return;
    }

    const entry = [...stack].reverse().find((item) => getHtmlCloseValue(item.type) === value);
    if (!entry) return;

    const stackIndex = stack.lastIndexOf(entry);
    stack.splice(stackIndex, 1);
    ranges.push({
      type: entry.type,
      openValue: entry.openValue,
      closeValue: value,
      openFrom: entry.openFrom,
      openTo: entry.openTo,
      contentFrom: entry.openTo,
      contentTo: pos,
      closeFrom: pos,
      closeTo: pos + node.nodeSize,
    });
  });

  return ranges;
};

const getEnclosingRichStyleRange = (
  state: EditorState,
  from: number,
  to: number,
  matcher: {
    open: (value: string) => boolean;
    close: (value: string) => boolean;
  }
) => {
  const ranges = collectRichStyleRanges(state).filter((range) => (
    matcher.open(range.openValue) &&
    matcher.close(range.closeValue) &&
    from >= range.openFrom &&
    to <= range.closeTo &&
    Math.max(from, range.contentFrom) < Math.min(to, range.contentTo)
  ));

  if (ranges.length === 0) return null;

  ranges.sort((a, b) => (a.contentTo - a.contentFrom) - (b.contentTo - b.contentFrom));
  return ranges[0];
};

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

const createRichStyleDecorationPlugin = () =>
  $prose(() =>
    new Plugin({
      key: richStyleDecorationPluginKey,
      props: {
        decorations(state) {
          const decorations: Decoration[] = [];
          const underlineStack: number[] = [];
          const spanStyleStack: Array<
            | { type: 'color'; from: number; color: string }
            | { type: 'bg'; from: number; color: string }
          > = [];

          state.doc.descendants((node, pos) => {
            if (node.type.name !== 'html') return;
            const value = String(node.attrs.value || '').trim();

            if (value === UNDERLINE_OPEN_TAG) {
              decorations.push(Decoration.node(pos, pos + node.nodeSize, { class: 'rte-hidden-html-marker' }));
              underlineStack.push(pos + node.nodeSize);
              return;
            }

            if (value === UNDERLINE_CLOSE_TAG) {
              decorations.push(Decoration.node(pos, pos + node.nodeSize, { class: 'rte-hidden-html-marker' }));
              const start = underlineStack.pop();
              if (typeof start === 'number' && start < pos) {
                decorations.push(Decoration.inline(start, pos, { class: 'rte-underline' }));
              }
              return;
            }

            const colorMatch = value.match(COLOR_OPEN_TAG_REGEX);
            if (colorMatch) {
              decorations.push(Decoration.node(pos, pos + node.nodeSize, { class: 'rte-hidden-html-marker' }));
              const color = colorMatch[1].toLowerCase();
              if (isValidTextColor(color)) {
                spanStyleStack.push({ type: 'color', from: pos + node.nodeSize, color });
              }
              return;
            }

            const bgMatch = value.match(BG_OPEN_TAG_REGEX);
            if (bgMatch) {
              decorations.push(Decoration.node(pos, pos + node.nodeSize, { class: 'rte-hidden-html-marker' }));
              const color = bgMatch[1].toLowerCase();
              if (isValidTextColor(color)) {
                spanStyleStack.push({ type: 'bg', from: pos + node.nodeSize, color });
              }
              return;
            }

            if (value === SPAN_CLOSE_TAG) {
              decorations.push(Decoration.node(pos, pos + node.nodeSize, { class: 'rte-hidden-html-marker' }));
              const entry = spanStyleStack.pop();
              if (entry && entry.from < pos) {
                decorations.push(Decoration.inline(entry.from, pos, {
                  style: entry.type === 'color'
                    ? `color: ${entry.color};`
                    : `background-color: ${entry.color};`,
                }));
              }
            }
          });

          return DecorationSet.create(state.doc, decorations);
        },
      },
    })
  );

interface MilkdownEditorInnerProps extends RichTextEditorProps {
  keywordData: ReturnType<typeof buildRichKeywordData>;
  onOpenImageContextMenu: (payload: {
    x: number;
    y: number;
    imageIndex: number;
    width: string | null;
    align: 'left' | 'center' | 'right' | null;
  }) => void;
}

const MilkdownEditorInner: React.FC<MilkdownEditorInnerProps> = ({
  value,
  onChange,
  placeholder,
  minHeight,
  keywordData,
  onOpenImageContextMenu,
}) => {
  const editorHostRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const colorPanelRef = useRef<HTMLDivElement>(null);
  const bgColorPanelRef = useRef<HTMLDivElement>(null);
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
  const [isColorPanelOpen, setIsColorPanelOpen] = useState(false);
  const [isBgColorPanelOpen, setIsBgColorPanelOpen] = useState(false);
  const [customTextColor, setCustomTextColor] = useState('#1d4ed8');
  const [customTextBgColor, setCustomTextBgColor] = useState('#fef3c7');
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
  const [isMobile, setIsMobile] = useState(false);
  const [mobileSheetTooltip, setMobileSheetTooltip] = useState<TooltipState | null>(null);

  keywordDataRef.current = keywordData;
  onChangeRef.current = onChange;
  latestValueRef.current = value;

  const applyEditorImagePresentation = useCallback(() => {
    const host = editorHostRef.current;
    if (!host) return;
    const images = Array.from(host.querySelectorAll<HTMLImageElement>('.ProseMirror img'));
    images.forEach((img) => {
      const { title, width, align } = parseImageTitleMetadata(img.getAttribute('title'));
      if (title) {
        img.setAttribute('title', title);
      } else {
        img.removeAttribute('title');
      }
      img.classList.add('rich-text-image');
      img.classList.remove('rich-text-image-left', 'rich-text-image-center', 'rich-text-image-right');
      img.style.maxWidth = '100%';
      img.style.height = 'auto';
      if (width) {
        img.style.width = width;
      } else {
        img.style.removeProperty('width');
      }
      if (align) {
        img.classList.add(`rich-text-image-${align}`);
      }
    });
  }, []);

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
        .use(createRichStyleDecorationPlugin())
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
    const timer = window.setTimeout(() => applyEditorImagePresentation(), 0);
    return () => window.clearTimeout(timer);
  }, [value, applyEditorImagePresentation]);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 767px)');
    const apply = () => setIsMobile(mediaQuery.matches);
    apply();
    mediaQuery.addEventListener('change', apply);
    return () => mediaQuery.removeEventListener('change', apply);
  }, []);

  useEffect(() => {
    const host = editorHostRef.current;
    if (!host) return;

    const handleMouseOver = (e: MouseEvent) => {
      if (isMobile) return;
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
      if (isMobile) return;
      const next = e.relatedTarget as HTMLElement | null;
      if (next?.closest('.entity-link, .section-link')) return;
      setTooltip((prev) => ({ ...prev, visible: false }));
    };

    const handleDblClick = (e: MouseEvent) => {
      if (isMobile) return;
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

    const handleClick = (e: MouseEvent) => {
      if (!isMobile) return;
      const target = (e.target as HTMLElement).closest('.entity-link, .section-link') as HTMLElement | null;
      if (!target) return;
      const rect = target.getBoundingClientRect();
      setMobileSheetTooltip({
        visible: true,
        x: rect.left + window.scrollX,
        y: rect.bottom + window.scrollY + 5,
        kind: target.dataset.kind === 'section' ? 'section' : 'entity',
        entityId: target.dataset.id || null,
        entityType: target.dataset.type || null,
        sectionTitleLower: target.dataset.sectiontitle || null,
        subItemTitleLower: target.dataset.subitemtitle || null,
      });
    };

    const handleFocusIn = () => setIsFocused(true);
    const handleFocusOut = () => {
      requestAnimationFrame(() => {
        const active = document.activeElement;
        setIsFocused(Boolean(active && host.contains(active)));
      });
    };

    const handleImageContextMenu = (e: MouseEvent) => {
      const image = (e.target as HTMLElement).closest('.ProseMirror img') as HTMLImageElement | null;
      if (!image) return;
      e.preventDefault();
      applyEditorImagePresentation();
      const images = Array.from(host.querySelectorAll<HTMLImageElement>('.ProseMirror img'));
      const imageIndex = images.indexOf(image);
      if (imageIndex < 0) return;
      const { width, align } = parseImageTitleMetadata(image.getAttribute('title'));
      onOpenImageContextMenu({
        x: e.clientX,
        y: e.clientY,
        imageIndex,
        width,
        align,
      });
    };

    host.addEventListener('mouseover', handleMouseOver);
    host.addEventListener('mouseout', handleMouseOut);
    host.addEventListener('dblclick', handleDblClick);
    host.addEventListener('click', handleClick);
    host.addEventListener('focusin', handleFocusIn);
    host.addEventListener('focusout', handleFocusOut);
    host.addEventListener('contextmenu', handleImageContextMenu);

    return () => {
      host.removeEventListener('mouseover', handleMouseOver);
      host.removeEventListener('mouseout', handleMouseOut);
      host.removeEventListener('dblclick', handleDblClick);
      host.removeEventListener('click', handleClick);
      host.removeEventListener('focusin', handleFocusIn);
      host.removeEventListener('focusout', handleFocusOut);
      host.removeEventListener('contextmenu', handleImageContextMenu);
    };
  }, [applyEditorImagePresentation, campaignData, isMobile, onOpenImageContextMenu, openInTab]);

  const runCommand = useCallback(
    <T,>(command: { key: T }, payload?: unknown) => {
      if (loading) return;
      const editor = getEditor();
      if (!editor) return;
      editor.action(callCommand(command.key as never, payload));
    },
    [loading, getEditor]
  );

  const applyHtmlWrapper = useCallback((openTag: string | null, closeTag: string | null, matcher?: {
    open: (value: string) => boolean;
    close: (value: string) => boolean;
  }) => {
    if (loading) return;
    const editor = getEditor();
    if (!editor) return;

    editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      const htmlType = view.state.schema.nodes.html;
      if (!htmlType) return;

      const { from, to, empty } = view.state.selection;
      if (empty) return;

      const tr = view.state.tr;
      const range = matcher ? getEnclosingRichStyleRange(view.state, from, to, matcher) : null;

      if (range) {
        tr.delete(range.closeFrom, range.closeTo);
        tr.delete(range.openFrom, range.openTo);

        const mappedRangeFrom = tr.mapping.map(range.contentFrom);
        const mappedRangeTo = tr.mapping.map(range.contentTo);
        const mappedSelectionFrom = tr.mapping.map(from);
        const mappedSelectionTo = tr.mapping.map(to);
        const shouldToggleOffCurrentStyle = openTag === range.openValue;

        const wrappers: Array<{ from: number; to: number; openValue: string; closeValue: string }> = [];

        if (mappedRangeFrom < mappedSelectionFrom) {
          wrappers.push({
            from: mappedRangeFrom,
            to: mappedSelectionFrom,
            openValue: range.openValue,
            closeValue: range.closeValue,
          });
        }

        if (!shouldToggleOffCurrentStyle && openTag && closeTag && mappedSelectionFrom < mappedSelectionTo) {
          wrappers.push({
            from: mappedSelectionFrom,
            to: mappedSelectionTo,
            openValue: openTag,
            closeValue: closeTag,
          });
        }

        if (mappedSelectionTo < mappedRangeTo) {
          wrappers.push({
            from: mappedSelectionTo,
            to: mappedRangeTo,
            openValue: range.openValue,
            closeValue: range.closeValue,
          });
        }

        wrappers
          .sort((a, b) => b.from - a.from)
          .forEach((wrapper) => {
            tr.insert(wrapper.to, htmlType.create({ value: wrapper.closeValue }));
            tr.insert(wrapper.from, htmlType.create({ value: wrapper.openValue }));
          });
      } else if (openTag && closeTag) {
        tr.insert(to, htmlType.create({ value: closeTag }));
        tr.insert(from, htmlType.create({ value: openTag }));
      }

      view.dispatch(tr.scrollIntoView());
      view.focus();
    });
  }, [loading, getEditor]);

  const handleToggleUnderline = () => {
    applyHtmlWrapper(UNDERLINE_OPEN_TAG, UNDERLINE_CLOSE_TAG, {
      open: (value) => value === UNDERLINE_OPEN_TAG,
      close: (value) => value === UNDERLINE_CLOSE_TAG,
    });
  };

  const handleApplyTextColor = (color: string | null) => {
    applyHtmlWrapper(
      color && isValidTextColor(color) ? buildStyleOpenTag('data-rte-color', color) : null,
      color && isValidTextColor(color) ? SPAN_CLOSE_TAG : null,
      {
        open: (value) => COLOR_OPEN_TAG_REGEX.test(value),
        close: (value) => value === SPAN_CLOSE_TAG,
      }
    );
    setIsColorPanelOpen(false);
  };

  const handleApplyTextBgColor = (color: string | null) => {
    applyHtmlWrapper(
      color && isValidTextColor(color) ? buildStyleOpenTag('data-rte-bg', color) : null,
      color && isValidTextColor(color) ? SPAN_CLOSE_TAG : null,
      {
        open: (value) => BG_OPEN_TAG_REGEX.test(value),
        close: (value) => value === SPAN_CLOSE_TAG,
      }
    );
    setIsBgColorPanelOpen(false);
  };

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

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;

      if (isColorPanelOpen && colorPanelRef.current && !colorPanelRef.current.contains(target)) {
        setIsColorPanelOpen(false);
      }

      if (isBgColorPanelOpen && bgColorPanelRef.current && !bgColorPanelRef.current.contains(target)) {
        setIsBgColorPanelOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [isColorPanelOpen, isBgColorPanelOpen]);

  return (
    <div className="space-y-0">
      <div className="flex items-center gap-1 p-2 border-b border-theme bg-theme-card/50 overflow-x-auto overflow-y-visible">
        <button type="button" onClick={() => runCommand(toggleStrongCommand)} className="p-1.5 theme-text-secondary hover:bg-primary-light hover:text-primary rounded" title="加粗">
          <Bold size={16} />
        </button>
        <button type="button" onClick={() => runCommand(toggleEmphasisCommand)} className="p-1.5 theme-text-secondary hover:bg-primary-light hover:text-primary rounded" title="斜体">
          <Italic size={16} />
        </button>
        <button type="button" onClick={handleToggleUnderline} className="p-1.5 theme-text-secondary hover:bg-primary-light hover:text-primary rounded" title="下划线">
          <Underline size={16} />
        </button>
        <button type="button" onClick={() => runCommand(wrapInBulletListCommand)} className="p-1.5 theme-text-secondary hover:bg-primary-light hover:text-primary rounded" title="列表">
          <List size={16} />
        </button>
        <div className="w-px h-4 bg-[var(--border-color)] mx-1" />
        <div className="relative shrink-0" ref={colorPanelRef}>
          <button
            type="button"
            onClick={() => {
              setIsColorPanelOpen((prev) => !prev);
              setIsBgColorPanelOpen(false);
            }}
            className="p-1.5 theme-text-secondary hover:bg-primary-light hover:text-primary rounded"
            title="文字颜色"
          >
            <Palette size={16} />
          </button>
          {isColorPanelOpen && (
            <div className="absolute left-0 top-full mt-2 z-30 bg-theme-card border border-theme rounded shadow-lg p-2 w-72">
              <div className="grid grid-cols-8 gap-2">
                {TEXT_COLOR_PALETTE.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => handleApplyTextColor(color)}
                    className="w-6 h-6 rounded border border-theme"
                    style={{ backgroundColor: color }}
                    title={color}
                  />
                ))}
              </div>
              <div className="mt-3 flex items-center gap-2">
                <input
                  type="color"
                  value={customTextColor}
                  onChange={(e) => setCustomTextColor(e.target.value)}
                  className="h-8 w-10 rounded border border-theme bg-transparent p-0"
                  title="自定义颜色"
                />
                <button
                  type="button"
                  onClick={() => handleApplyTextColor(customTextColor)}
                  className="flex-1 px-2 py-1 text-xs rounded border border-theme hover:bg-primary-light"
                >
                  使用自定义颜色
                </button>
              </div>
              <button
                type="button"
                onClick={() => handleApplyTextColor(null)}
                className="mt-2 w-full px-2 py-1 text-xs rounded border border-theme hover:bg-primary-light"
              >
                清除颜色
              </button>
            </div>
          )}
        </div>
        <div className="relative shrink-0" ref={bgColorPanelRef}>
          <button
            type="button"
            onClick={() => {
              setIsBgColorPanelOpen((prev) => !prev);
              setIsColorPanelOpen(false);
            }}
            className="p-1.5 theme-text-secondary hover:bg-primary-light hover:text-primary rounded"
            title="文字底色"
          >
            <Highlighter size={16} />
          </button>
          {isBgColorPanelOpen && (
            <div className="absolute left-0 top-full mt-2 z-30 bg-theme-card border border-theme rounded shadow-lg p-2 w-72">
              <div className="grid grid-cols-4 gap-2">
                {TEXT_BG_PALETTE.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => handleApplyTextBgColor(color)}
                    className="w-full h-8 rounded border border-theme"
                    style={{ backgroundColor: color }}
                    title={color}
                  />
                ))}
              </div>
              <div className="mt-3 flex items-center gap-2">
                <input
                  type="color"
                  value={customTextBgColor}
                  onChange={(e) => setCustomTextBgColor(e.target.value)}
                  className="h-8 w-10 rounded border border-theme bg-transparent p-0"
                  title="自定义底色"
                />
                <button
                  type="button"
                  onClick={() => handleApplyTextBgColor(customTextBgColor)}
                  className="flex-1 px-2 py-1 text-xs rounded border border-theme hover:bg-primary-light"
                >
                  使用自定义底色
                </button>
              </div>
              <button
                type="button"
                onClick={() => handleApplyTextBgColor(null)}
                className="mt-2 w-full px-2 py-1 text-xs rounded border border-theme hover:bg-primary-light"
              >
                清除底色
              </button>
            </div>
          )}
        </div>
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
          className="fixed z-[120] bg-theme-card p-3 rounded shadow-lg border border-theme pointer-events-none text-left animate-in fade-in zoom-in-95 duration-100"
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
      {isMobile && mobileSheetTooltip?.visible && createPortal(
        <KeywordPreviewSheet
          tooltip={mobileSheetTooltip}
          campaignData={campaignData}
          keywordData={keywordData}
          onClose={() => setMobileSheetTooltip(null)}
        />,
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
  minHeight = '150px',
  mode = 'toggle',
}) => {
  const [isPreview, setIsPreview] = useState(mode === 'preview');
  const [imageContextMenu, setImageContextMenu] = useState<ImageContextMenuState | null>(null);
  const [customImageWidth, setCustomImageWidth] = useState('50');
  const { campaignData } = useCampaign();
  const keywordData = useMemo(() => buildRichKeywordData(campaignData), [campaignData]);

  useEffect(() => {
    if (mode === 'toggle') return;
    setIsPreview(mode === 'preview');
  }, [mode]);

  const updateMarkdownImageMeta = useCallback((imageIndex: number, nextMeta: {
    width?: string | null;
    align?: 'left' | 'center' | 'right' | null;
  }) => {
    let currentIndex = -1;
    const nextValue = value.replace(/!\[([^\]]*)\]\((\S+?)(?:\s+"([^"]*)")?\)/g, (match, alt: string, src: string, rawTitle?: string) => {
      currentIndex += 1;
      if (currentIndex !== imageIndex) return match;
      const parsed = parseImageTitleMetadata(rawTitle || '');
      const normalizedWidth = nextMeta.width === undefined
        ? parsed.width
        : (nextMeta.width ? normalizeImageWidthValue(nextMeta.width) : null);
      const normalizedAlign = nextMeta.align === undefined
        ? parsed.align
        : normalizeImageAlignValue(nextMeta.align);
      const nextTitle = buildImageTitleMetadata(parsed.title, normalizedWidth, normalizedAlign);
      return `![${alt}](${src}${nextTitle ? ` "${nextTitle}"` : ''})`;
    });

    if (nextValue !== value) {
      onChange(nextValue);
    }
    setImageContextMenu(null);
  }, [onChange, value]);

  const openImageContextMenu = useCallback((payload: {
    x: number;
    y: number;
    imageIndex: number;
    width: string | null;
    align: 'left' | 'center' | 'right' | null;
  }) => {
    setImageContextMenu({
      visible: true,
      x: payload.x,
      y: payload.y,
      imageIndex: payload.imageIndex,
      width: payload.width,
      align: payload.align,
    });
    if (payload.width?.endsWith('%')) {
      setCustomImageWidth(payload.width.replace('%', ''));
    }
  }, []);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target?.closest('[data-image-context-menu]')) {
        setImageContextMenu(null);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, []);

  return (
    <div className={`border border-theme rounded-md overflow-hidden bg-theme-card focus-within:ring-2 focus-within:ring-primary focus-within:border-transparent ${className}`}>
      <div className="flex items-center justify-between p-2 border-b border-theme bg-theme-card/50">
        <div className="text-xs theme-text-secondary">{isPreview ? '预览模式' : '编辑模式'}</div>
        {mode === 'toggle' && (
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
        )}
      </div>

      {isPreview ? (
        <div
          className="p-3 bg-theme-card overflow-y-auto"
          style={{ minHeight }}
          onContextMenu={(event) => {
            const image = (event.target as HTMLElement).closest('.rich-text-content img') as HTMLImageElement | null;
            if (!image) return;
            event.preventDefault();
            const container = event.currentTarget;
            const images = Array.from(container.querySelectorAll<HTMLImageElement>('.rich-text-content img'));
            const imageIndex = images.indexOf(image);
            if (imageIndex < 0) return;
            const { width, align } = parseImageTitleMetadata(image.getAttribute('title'));
            openImageContextMenu({
              x: event.clientX,
              y: event.clientY,
              imageIndex,
              width,
              align,
            });
          }}
        >
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
            onOpenImageContextMenu={openImageContextMenu}
          />
        </MilkdownProvider>
      )}
      {imageContextMenu?.visible && createPortal(
        <div
          data-image-context-menu
          className="fixed z-[70] w-52 bg-theme-card border border-theme rounded-lg shadow-xl p-2"
          style={{
            left: Math.min(imageContextMenu.x, window.innerWidth - 224),
            top: Math.min(imageContextMenu.y, window.innerHeight - 220),
          }}
        >
          <div className="text-xs theme-text-secondary px-1 pb-2">图片尺寸</div>
          <div className="grid grid-cols-2 gap-2">
            {['25%', '50%', '75%', '100%'].map((size) => (
              <button
                key={size}
                type="button"
                onClick={() => updateMarkdownImageMeta(imageContextMenu.imageIndex, { width: size })}
                className="px-2 py-1.5 text-sm rounded border border-theme hover:bg-primary-light"
              >
                {size}
              </button>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-2">
            <input
              type="number"
              min={10}
              max={100}
              value={customImageWidth}
              onChange={(e) => setCustomImageWidth(e.target.value)}
              className="w-full px-2 py-1 text-sm rounded border border-theme bg-transparent"
            />
            <span className="text-sm theme-text-secondary">%</span>
          </div>
          <button
            type="button"
            onClick={() => updateMarkdownImageMeta(imageContextMenu.imageIndex, { width: `${customImageWidth || '50'}%` })}
            className="mt-2 w-full px-2 py-1.5 text-sm rounded border border-theme hover:bg-primary-light"
          >
            应用自定义尺寸
          </button>
          <div className="mt-3 text-xs theme-text-secondary px-1 pb-2">图片对齐</div>
          <div className="grid grid-cols-3 gap-2">
            {[
              ['left', '左对齐'],
              ['center', '居中'],
              ['right', '右对齐'],
            ].map(([align, label]) => (
              <button
                key={align}
                type="button"
                onClick={() => updateMarkdownImageMeta(imageContextMenu.imageIndex, { align: align as 'left' | 'center' | 'right' })}
                className={`px-2 py-1.5 text-sm rounded border ${
                  imageContextMenu.align === align ? 'border-primary bg-primary-light text-primary' : 'border-theme hover:bg-primary-light'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => updateMarkdownImageMeta(imageContextMenu.imageIndex, { width: null })}
            className="mt-2 w-full px-2 py-1.5 text-sm rounded border border-theme hover:bg-primary-light"
          >
            恢复默认宽度
          </button>
          <button
            type="button"
            onClick={() => updateMarkdownImageMeta(imageContextMenu.imageIndex, { align: null })}
            className="mt-2 w-full px-2 py-1.5 text-sm rounded border border-theme hover:bg-primary-light"
          >
            恢复默认对齐
          </button>
        </div>,
        document.body
      )}
    </div>
  );
};

export default RichTextEditor;
