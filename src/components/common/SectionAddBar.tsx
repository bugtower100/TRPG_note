import React from 'react';

interface SectionAddBarProps {
  hiddenSections: Array<{ key: string; title: string }>;
  onAddSection: (key: string) => void;
  onAddCustomSection?: () => void;
}

const SectionAddBar: React.FC<SectionAddBarProps> = ({ hiddenSections, onAddSection, onAddCustomSection }) => {
  if (hiddenSections.length === 0 && !onAddCustomSection) return null;

  return (
    <div className="bg-white p-4 rounded-lg border border-dashed border-gray-300 theme-card">
      <div className="text-sm font-medium text-gray-700 mb-2">添加内置区块</div>
      <div className="flex flex-wrap gap-2">
        {onAddCustomSection && (
          <button
            type="button"
            onClick={onAddCustomSection}
            className="px-3 py-1.5 text-sm bg-purple-50 text-purple-700 border border-purple-200 rounded hover:bg-purple-100"
          >
            + 新增自定义区块
          </button>
        )}
        {hiddenSections.map((section) => (
          <button
            key={section.key}
            type="button"
            onClick={() => onAddSection(section.key)}
            className="px-3 py-1.5 text-sm bg-blue-50 text-primary border border-blue-200 rounded hover:bg-blue-100"
          >
            + {section.title}
          </button>
        ))}
      </div>
    </div>
  );
};

export default SectionAddBar;
