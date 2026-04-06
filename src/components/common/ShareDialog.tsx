import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { CampaignMember, SharedPermission } from '../../types';

interface ShareDialogProps {
  open: boolean;
  title: string;
  members: CampaignMember[];
  submitting?: boolean;
  onClose: () => void;
  onSubmit: (targetUserIds: string[], permission: SharedPermission) => Promise<void> | void;
}

const ShareDialog: React.FC<ShareDialogProps> = ({
  open,
  title,
  members,
  submitting = false,
  onClose,
  onSubmit,
}) => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [permission, setPermission] = useState<SharedPermission>('read');

  useEffect(() => {
    if (!open) {
      setSelectedIds([]);
      setPermission('read');
    }
  }, [open]);

  if (!open) return null;

  const targets = members.filter((member) => member.role === 'PL');

  return createPortal(
    <div className="fixed inset-0 z-[1500] bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-theme-card border border-theme rounded-lg shadow-xl p-4"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 className="text-base font-semibold mb-3">{title}</h3>
        <div className="space-y-3">
          <div>
            <div className="text-sm font-medium mb-2">分享权限</div>
            <select
              value={permission}
              onChange={(e) => setPermission(e.target.value as SharedPermission)}
              className="w-full px-3 py-2 border border-theme rounded bg-transparent"
            >
              <option value="read">仅查看</option>
              <option value="edit">可编辑</option>
            </select>
            {permission === 'edit' && (
              <div className="text-xs theme-text-secondary mt-2">当前先记录“可编辑”权限，协作编辑能力将继续接入。</div>
            )}
          </div>
          <div>
            <div className="text-sm font-medium mb-2">选择目标 PL</div>
            <div className="max-h-64 overflow-y-auto border border-theme rounded p-2 space-y-2">
              {targets.length === 0 && <div className="text-sm theme-text-secondary">当前还没有可分享的 PL 成员</div>}
              {targets.map((member) => {
                const checked = selectedIds.includes(member.userId);
                return (
                  <label key={member.userId} className="flex items-center gap-2 text-sm px-2 py-1.5 rounded hover:bg-primary-light">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        setSelectedIds((prev) =>
                          e.target.checked ? [...prev, member.userId] : prev.filter((id) => id !== member.userId)
                        );
                      }}
                    />
                    <span>{member.username}</span>
                    <span className="text-xs theme-text-secondary">({member.role})</span>
                  </label>
                );
              })}
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 mt-4">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded border border-theme hover:bg-primary-light text-sm"
          >
            取消
          </button>
          <button
            type="button"
            disabled={submitting || selectedIds.length === 0}
            onClick={() => void onSubmit(selectedIds, permission)}
            className="px-3 py-1.5 rounded bg-primary text-white hover:bg-primary-dark disabled:opacity-60 text-sm"
          >
            确认分享
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ShareDialog;
