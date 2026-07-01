import React, { useEffect, useMemo, useState } from 'react';
import ResourceTreeView from '../../../components/common/ResourceTreeView';
import {
  buildResourceTree,
  filterResourceItems,
  ResourceFolder,
  ResourceItem,
  resourceFolderDisplayName,
  resourceService,
  RESOURCE_ROOT_PATH,
} from '../../../services/resourceService';

interface CharacterSheetAvatarPickerDialogProps {
  open: boolean;
  selectedRef?: string;
  onClose: () => void;
  onSelect: (ref: string) => void;
}

const CharacterSheetAvatarPickerDialog: React.FC<CharacterSheetAvatarPickerDialogProps> = ({
  open,
  selectedRef,
  onClose,
  onSelect,
}) => {
  const [resources, setResources] = useState<ResourceItem[]>([]);
  const [resourceFolders, setResourceFolders] = useState<ResourceFolder[]>([]);
  const [keyword, setKeyword] = useState('');
  const [selectedFolderPath, setSelectedFolderPath] = useState(RESOURCE_ROOT_PATH);
  const [expandedFolders, setExpandedFolders] = useState<string[]>([RESOURCE_ROOT_PATH]);

  useEffect(() => {
    if (!open) return;
    const load = async () => {
      try {
        const result = await resourceService.list();
        setResources(result.items);
        setResourceFolders(result.folders);
      } catch {
        setResources([]);
        setResourceFolders([]);
      }
    };
    void load();
  }, [open]);

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
    <div className="fixed inset-0 z-[1450] bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="w-full max-w-5xl max-h-[82vh] bg-theme-card border border-theme rounded-xl shadow-xl flex flex-col"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-theme flex items-center justify-between">
          <div>
            <h3 className="font-semibold">选择角色卡头像</h3>
            <div className="text-xs theme-text-secondary mt-1">这里读取资源管理中的图片，而不是手动写路径。</div>
          </div>
          <button onClick={onClose} className="px-3 py-1 rounded border border-theme hover:bg-primary-light text-sm">
            关闭
          </button>
        </div>
        <div className="p-3 border-b border-theme">
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
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
                onToggleFolder={(path) => setExpandedFolders((prev) => (
                  prev.includes(path) ? prev.filter((item) => item !== path) : [...prev, path]
                ))}
                onSelectFolder={setSelectedFolderPath}
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
                      onClick={() => onSelect(item.ref)}
                      className={`text-left border rounded-md p-2 transition hover:bg-primary-light/30 ${
                        active ? 'border-primary ring-2 ring-primary/30 bg-primary/5' : 'border-theme'
                      }`}
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

export default CharacterSheetAvatarPickerDialog;
