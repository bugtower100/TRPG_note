import React from 'react';
import RichTextEditor from '../../../components/common/RichTextEditor';
import { ResourceItem, RESOURCE_ROOT_PATH } from '../../../services/resourceService';
import { RelationGraphNode } from '../../../types';

interface RelationGraphNodePanelProps {
  node: RelationGraphNode | null;
  selectedResourceMeta: ResourceItem | null;
  onChangeNote: (nodeId: string, note: string) => void;
  onUploadImage: (nodeId: string, file?: File) => void;
  onOpenResourcePicker: () => void;
  onClearImage: (nodeId: string) => void;
}

const RelationGraphNodePanel: React.FC<RelationGraphNodePanelProps> = ({
  node,
  selectedResourceMeta,
  onChangeNote,
  onUploadImage,
  onOpenResourcePicker,
  onClearImage,
}) => {
  if (!node) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 w-full md:inset-auto md:right-6 md:bottom-6 md:w-[360px] bg-theme-card border border-theme rounded-t-xl md:rounded-lg shadow-xl p-3 z-50">
      <div className="font-semibold mb-2">节点备注</div>
      <RichTextEditor
        value={node.note || ''}
        onChange={(val) => onChangeNote(node.id, val)}
        minHeight="130px"
      />
      <div className="mt-2 flex items-center gap-2">
        <label className="text-sm px-2 py-1 rounded border border-theme cursor-pointer hover:bg-primary-light">
          上传头像
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => onUploadImage(node.id, e.target.files?.[0])}
          />
        </label>
        <button
          onClick={onOpenResourcePicker}
          className="text-sm px-2 py-1 rounded border border-theme hover:bg-primary-light"
        >
          从资源库选择
        </button>
        {selectedResourceMeta && (
          <span className="text-xs theme-text-secondary truncate max-w-[150px]" title={selectedResourceMeta.displayName}>
            已选：{selectedResourceMeta.displayName}
          </span>
        )}
        {(node.tokenImageRef || node.tokenImage) && (
          <button
            onClick={() => onClearImage(node.id)}
            className="text-sm px-2 py-1 rounded border border-red-300 text-red-600 hover:bg-red-50"
          >
            清除头像
          </button>
        )}
      </div>
    </div>
  );
};

export const defaultResourcePickerState = () => ({
  keyword: '',
  folderPath: RESOURCE_ROOT_PATH,
});

export default RelationGraphNodePanel;
