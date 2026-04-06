import React, { useMemo, useState } from 'react';

interface GuideModalProps {
  onClose: () => void;
}

const GuideModal: React.FC<GuideModalProps> = ({ onClose }) => {
  const [step, setStep] = useState(0);

  const steps = useMemo(
    () => [
      {
        title: '第 1 步：在主页创建或进入模组',
        highlight: '先从主页卡片区创建新模组，或进入已有模组',
        detail:
          '主页现在不仅能进入模组，还能直接查看模组简介、在线成员占位，以及公开/私密状态。',
        tip: '入口位置：首页卡片区',
      },
      {
        title: '第 2 步：先看概览，再进入具体栏目',
        highlight: '进入模组后，先在概览页确认整体状态',
        detail:
          '概览页会显示当前模组的条目统计、最后更新时间以及总备忘录。左侧导航则是进入角色、怪物、地点、团队笔记等模块的统一入口。',
        tip: '入口位置：概览页 / 左侧导航',
      },
      {
        title: '第 3 步：使用团队笔记记录协作内容',
        highlight: '团队笔记适合多人共用的记录、主持备注与临时整理',
        detail:
          '团队笔记支持新建、进入编辑、删除确认、编辑状态提示和基础租约机制。它与个人实体内容分开，适合作为多人协作的第一入口。',
        tip: '入口位置：团队笔记页',
      },
      {
        title: '第 4 步：继续编辑实体与分区内容',
        highlight: '角色、怪物、地点等实体仍然是模组正文的主要承载区域',
        detail:
          '在实体详情页里，你可以管理区块、子项目和富文本内容；删除区块或子项目时现在会走自定义确认框，更适合移动端和常规使用习惯。',
        tip: '入口位置：角色 / 怪物 / 地点 / 组织 / 事件 / 线索 / 时间线详情页',
      },
      {
        title: '第 5 步：使用快速链接、主题和导出备份',
        highlight: '用富文本互链梳理设定，并记得定期导出 JSON',
        detail:
          '你可以在富文本中双击关键词快速打开相关条目，也可以在设置页切换主题、管理资源与导入导出数据。关键阶段建议导出快照，便于回退和迁移。',
        tip: '入口位置：富文本预览区域 / 设置页',
      },
    ],
    []
  );

  const current = steps[step];
  const isLast = step === steps.length - 1;

  return (
    <div className="fixed inset-0 bg-black/60 z-[1400] flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full p-8 relative animate-fade-in theme-card">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
        >
          ✕
        </button>
        
        <div className="mb-6">
          <h2 className="text-2xl font-bold mb-2">快速上手引导</h2>
          <p className="theme-text-secondary text-sm">
            这份说明已经同步到当前版本，涵盖主页模组管理、团队笔记和最近的交互更新。
          </p>
        </div>

        <div className="flex items-center gap-2 mb-5">
          {steps.map((_, index) => (
            <button
              key={index}
              type="button"
              onClick={() => setStep(index)}
              className={`h-2 rounded-full transition-all ${
                index === step ? 'w-8 bg-primary' : 'w-4 bg-gray-300'
              }`}
              aria-label={`跳转到第 ${index + 1} 步`}
            />
          ))}
          <span className="ml-2 text-xs theme-text-secondary">
            {step + 1} / {steps.length}
          </span>
        </div>

        <div className="p-4 rounded-lg border border-theme bg-theme-card space-y-3 min-h-[190px]">
          <h3 className="text-lg font-semibold">{current.title}</h3>
          <p className="text-sm font-medium text-primary">{current.highlight}</p>
          <p className="text-sm theme-text-secondary leading-6">{current.detail}</p>
          <div className="text-xs theme-text-secondary">操作提示：{current.tip}</div>
        </div>

        <div className="mt-6 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
            className="px-4 py-2 rounded border border-theme disabled:opacity-40"
          >
            上一步
          </button>
          <div className="flex items-center gap-2">
            {!isLast && (
              <button
                type="button"
                onClick={() => setStep((s) => Math.min(steps.length - 1, s + 1))}
                className="px-4 py-2 rounded bg-primary text-white hover:bg-primary-dark transition-colors"
              >
                下一步
              </button>
            )}
            {isLast && (
              <button
                onClick={onClose}
                className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors shadow-md"
              >
                完成并开始使用
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GuideModal;
