import React, { useMemo } from 'react';
import ResourceTreeView from '../../../components/common/ResourceTreeView';
import {
  buildResourceTree,
  filterResourceItems,
  ResourceFolder,
  ResourceItem,
  resourceFolderDisplayName,
} from '../../../services/resourceService';

interface RelationGraphResourcePickerModalProps {
  open: boolean;
  resources: ResourceItem[];
  resourceFolders: ResourceFolder[];
  keyword: string;
  selectedFolderPath: string;
  expandedFolders: string[];
  selectedRef?: string;
  onKeywordChange: (value: string) => void;
  onSelectFolder: (path: string) => void;
  onToggleFolder: (path: string) => void;
  onClose: () => void;
  onSelectResource: (ref: string) => void;
}

const RelationGraphResourcePickerModal: React.FC<RelationGraphResourcePickerModalProps> = ({
  open,
  resources,
  resourceFolders,
  keyword,
  selectedFolderPath,
  expandedFolders,
  selectedRef,
  onKeywordChange,
  onSelectFolder,
  onToggleFolder,
  onClose,
  onSelectResource,
}) => {
  const filteredResourceTree = useMemo(
    () => buildResourceTree(resourceFolders, resources, keyword),
    [resourceFolders, resources, keyword]
  );
  const filteredResourceItems = useMemo(
    () => filterResourceItems(resources, selectedFolderPath, keyword),
    [resources, selectedFolderPath, keyword]
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/35 flex items-center justify-center p-4">
      <div className="w-full max-w-5xl max-h-[82vh] bg-theme-card border border-theme rounded-lg shadow-xl flex flex-col">
        <div className="px-4 py-3 border-b border-theme flex items-center justify-between">
          <h3 className="font-semibold">选择资源图片</h3>
          <button onClick={onClose} className="px-3 py-1 rounded border border-theme hover:bg-primary-light text-sm">
            关闭
          </button>
        </div>
        <div className="p-3 border-b border-theme">
          <input
            value={keyword}
            onChange={(e) => onKeywordChange(e.target.value)}
            placeholder="按图片名或资源ID搜索..."
            className="w-full px-3 py-2 rounded border border-theme bg-transparent"
          />
        </div>
        <div className="min-h-0 flex-1 grid grid-cols-1 md:grid-cols-[220px_minmax(0,1fr)]">
          <div className="border-r border-theme overflow-auto p-2">
            {resources.length === 0 && resourceFolders.length === 0 ? (
              <div className="text-sm theme-text-secondary py-8 text-center">暂无资源</div>
            ) : (
              <ResourceTreeView
                tree={filteredResourceTree}
                expandedPaths={expandedFolders}
                onToggleFolder={onToggleFolder}
                onSelectFolder={onSelectFolder}
                selectedFolderPath={selectedFolderPath}
                autoExpandAll={Boolean(keyword.trim())}
                hideItems
                compact
                renderItem={() => null}
              />
            )}
          </div>
          <div className="overflow-auto p-3">
            <div className="text-xs theme-text-secondary mb-3">
              当前分类：{resourceFolderDisplayName(selectedFolderPath)}
            </div>
            {filteredResourceItems.length === 0 ? (
              <div className="text-sm theme-text-secondary py-8 text-center">没有匹配的资源</div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-3">
                {filteredResourceItems.map((item) => {
                  const active = selectedRef === item.ref;
                  return (
                    <button
                      key={item.ref}
                      onClick={() => onSelectResource(item.ref)}
                      className={`text-left border rounded-md p-2 transition hover:bg-primary-light/30 ${active ? 'border-primary ring-2 ring-primary/30 bg-primary/5' : 'border-theme'}`}
                    >
                      <img src={item.url} alt={item.displayName} className="w-full aspect-square rounded object-cover border border-theme" />
                      <div className="mt-2 text-[11px] leading-4 truncate" title={item.displayName}>
                        {item.displayName}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RelationGraphResourcePickerModal;
