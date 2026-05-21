import React from 'react';
import { ChevronDown, ChevronRight, Folder, FolderOpen } from 'lucide-react';
import { ResourceItem, ResourceTreeNode, RESOURCE_ROOT_PATH } from '../../services/resourceService';

interface ResourceTreeViewProps {
  tree: ResourceTreeNode;
  expandedPaths: string[];
  onToggleFolder: (path: string) => void;
  renderItem: (item: ResourceItem, depth: number) => React.ReactNode;
  selectedFolderPath?: string;
  onSelectFolder?: (path: string) => void;
  autoExpandAll?: boolean;
  hideItems?: boolean;
  compact?: boolean;
  renderFolderSuffix?: (path: string, depth: number) => React.ReactNode;
}

const ResourceTreeView: React.FC<ResourceTreeViewProps> = ({
  tree,
  expandedPaths,
  onToggleFolder,
  renderItem,
  selectedFolderPath,
  onSelectFolder,
  autoExpandAll = false,
  hideItems = false,
  compact = false,
  renderFolderSuffix,
}) => {
  const renderFolder = (node: ResourceTreeNode, depth: number): React.ReactNode => {
    const isRoot = node.path === RESOURCE_ROOT_PATH;
    const isExpanded = autoExpandAll || expandedPaths.includes(node.path);
    const isSelected = selectedFolderPath === node.path;
    const hasChildren = node.folders.length > 0 || node.items.length > 0;

    return (
      <div key={node.path}>
        {!isRoot && (
          <button
            type="button"
            onClick={() => {
              onSelectFolder?.(node.path);
              if (hasChildren) onToggleFolder(node.path);
            }}
            className={`w-full flex items-center gap-2 px-3 py-2 text-left transition ${
              isSelected ? 'bg-primary/10 text-primary' : 'hover:bg-gray-50/40'
            }`}
            style={{ paddingLeft: `${depth * 14 + 10}px` }}
          >
            {hasChildren ? (
              isExpanded ? <ChevronDown size={compact ? 14 : 16} className="shrink-0" /> : <ChevronRight size={compact ? 14 : 16} className="shrink-0" />
            ) : (
              <span className="w-4 shrink-0" />
            )}
            {isExpanded ? <FolderOpen size={compact ? 14 : 16} className="shrink-0" /> : <Folder size={compact ? 14 : 16} className="shrink-0" />}
            <span className={`${compact ? 'text-xs' : 'text-sm'} truncate flex-1`}>{node.name}</span>
            {renderFolderSuffix?.(node.path, depth)}
          </button>
        )}
        {(isRoot || isExpanded || autoExpandAll) && (
          <>
            {node.folders.map((child) => renderFolder(child, isRoot ? depth : depth + 1))}
            {!hideItems && node.items.map((item) => renderItem(item, isRoot ? depth : depth + 1))}
          </>
        )}
      </div>
    );
  };

  return <div>{renderFolder(tree, 0)}</div>;
};

export default ResourceTreeView;
