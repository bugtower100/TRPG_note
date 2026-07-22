import React from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

interface ReleaseNotesContentProps {
  content: string;
  className?: string;
}

const normalizeReleaseNotes = (content: string) =>
  (content || '')
    .replace(/\r/g, '')
    .replace(/\*\*Full Changelog\*\*:\s*`(https?:\/\/[^`]+)`/gi, '**Full Changelog**: [$1]($1)')
    .trim();

const ReleaseNotesContent: React.FC<ReleaseNotesContentProps> = ({ content, className = '' }) => {
  const renderedHtml = React.useMemo(() => {
    const normalized = normalizeReleaseNotes(content);
    const source = normalized || '当前版本暂未填写更新内容。';
    const rawHtml = marked.parse(source, {
      async: false,
      gfm: true,
      breaks: true,
    }) as string;

    return DOMPurify.sanitize(rawHtml, {
      ADD_ATTR: ['target', 'rel'],
    });
  }, [content]);

  return (
    <div
      className={`rich-text-content release-notes-content theme-text-primary ${className}`}
      dangerouslySetInnerHTML={{ __html: renderedHtml }}
    />
  );
};

export default ReleaseNotesContent;
