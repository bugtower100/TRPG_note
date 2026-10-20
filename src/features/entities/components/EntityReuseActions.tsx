import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCampaignData } from '../../../context/CampaignContext';
import { useCampaignMemberRole } from '../../../hooks/useCampaignMemberRole';
import type { BaseEntity, GraphEntityType } from '../../../types';
import { copyEntity, createFromEntityTemplate, makeEntityTemplate } from '../../../utils/entityReuse';

export default function EntityReuseActions({ entity, entityType }: { entity?: BaseEntity; entityType: GraphEntityType }) {
  const { campaignData, setCampaignData, addEntity } = useCampaignData();
  const { canManageCampaignContent } = useCampaignMemberRole();
  const navigate = useNavigate();
  const [templateId, setTemplateId] = useState('');
  const [status, setStatus] = useState('');
  const templates = (campaignData.meta.entityTemplates || []).filter((item) => item.entityType === entityType);
  const selected = templates.find((item) => item.id === templateId);
  if (!canManageCampaignContent) return null;

  const create = (fromTemplate: boolean) => {
    if (fromTemplate ? !selected : !entity) return;
    const name = window.prompt(fromTemplate ? '新资料名称' : '复制后的名称（保留正文、关系和图片引用，不复制图片文件；别名清空）', fromTemplate ? selected!.name : `${entity!.name}（副本）`)?.trim();
    if (!name) return;
    const next = fromTemplate ? createFromEntityTemplate(selected!, name) : copyEntity(entity!, name);
    addEntity(entityType, next);
    navigate(`/${entityType}/${next.id}`);
  };

  const saveTemplate = () => {
    if (!entity) return;
    const name = window.prompt('模板名称（仅保存区块结构和子项目标题，不保存正文、关系或图片）', `${entity.name}结构`)?.trim();
    if (!name) return;
    const template = makeEntityTemplate(entity, entityType, name);
    setCampaignData((previous) => ({ ...previous, meta: { ...previous.meta, entityTemplates: [...(previous.meta.entityTemplates || []), template] } }));
    setTemplateId(template.id);
    setStatus('模板已加入当前模组，将随模组保存。');
  };

  return <details className="relative text-sm">
    <summary className="cursor-pointer whitespace-nowrap rounded border border-theme px-3 py-2">{entity ? '复制 / 模板' : '从模板新建'}</summary>
    <div className="absolute right-0 z-50 mt-2 w-72 max-w-[85vw] rounded-lg border border-theme bg-theme-card p-3 shadow-lg space-y-3">
      {entity && <div className="flex gap-2"><button type="button" onClick={() => create(false)} className="rounded border border-theme p-2">复制资料</button><button type="button" onClick={saveTemplate} className="rounded border border-theme p-2">保存区块模板</button></div>}
      <label className="block">当前模组的同类模板<select aria-label="选择区块模板" value={templateId} onChange={(event) => setTemplateId(event.target.value)} className="mt-1 w-full rounded border border-theme bg-theme-card p-2"><option value="">请选择模板</option>{templates.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <div className="flex gap-2"><button type="button" disabled={!selected} onClick={() => create(true)} className="rounded border border-theme p-2 disabled:opacity-50">按模板新建</button><button type="button" disabled={!selected} onClick={() => {
        if (!selected || !window.confirm(`删除模板“${selected.name}”？不会影响已创建的资料。`)) return;
        setCampaignData((previous) => ({ ...previous, meta: { ...previous.meta, entityTemplates: (previous.meta.entityTemplates || []).filter((item) => item.id !== selected.id) } }));
        setTemplateId('');
      }} className="rounded border border-theme p-2 text-red-600 disabled:opacity-50">删除模板</button></div>
      {status && <p role="status" className="theme-text-secondary">{status}</p>}
    </div>
  </details>;
}
