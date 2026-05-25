import React, { lazy, Suspense } from 'react';
import type { RichTextEditorProps } from './RichTextEditorImpl';

const RichTextEditorImpl = lazy(() => import('./RichTextEditorImpl'));

const RichTextEditorFallback: React.FC<Pick<RichTextEditorProps, 'minHeight'>> = ({ minHeight }) => (
  <div
    className="rounded border border-theme bg-theme-card/60 px-3 py-3 text-sm theme-text-secondary"
    style={{ minHeight: minHeight || '160px' }}
  >
    正在加载编辑器...
  </div>
);

const RichTextEditor: React.FC<RichTextEditorProps> = (props) => {
  return (
    <Suspense fallback={<RichTextEditorFallback minHeight={props.minHeight} />}>
      <RichTextEditorImpl {...props} />
    </Suspense>
  );
};

export type { RichTextEditorProps } from './RichTextEditorImpl';
export default RichTextEditor;
