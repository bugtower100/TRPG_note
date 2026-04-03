import React, { useMemo, useState } from 'react';

interface GuideModalProps {
  onClose: () => void;
}

const GuideModal: React.FC<GuideModalProps> = ({ onClose }) => {
  const [step, setStep] = useState(0);

  const steps = useMemo(
    () => [
      {
        title: '第 1 步：创建或进入模组',
        highlight: '在首页创建新模组，或进入已有模组',
        detail:
          '推荐先创建一个测试模组，用于熟悉后续区块编辑、快速链接和侧栏并行查看。',
        tip: '入口位置：首页卡片区',
      },
      {
        title: '第 2 步：编辑内置大区块',
        highlight: '进入任意实体详情页，管理内置区块',
        detail:
          '内置区块支持新增、删除、改名。每个区块默认一个“详细情况”子项目，你可以继续新增并用搜索快速定位。',
        tip: '入口位置：角色/怪物/地点/组织/事件/线索/时间线详情页',
      },
      {
        title: '第 3 步：使用关键词快速链接',
        highlight: '在富文本中双击关键词，右侧打开标签页',
        detail:
          '系统会识别实体名与区块标题。命中区块标题时会显示不同样式标记；命中多项时会在提示中列出多个。',
        tip: '入口位置：富文本预览区域',
      },
      {
        title: '第 4 步：并行查看与最大化侧栏',
        highlight: '在右侧标签栏并行打开多个条目',
        detail:
          '你可以切换、关闭标签，并使用最大化按钮专注查看右侧内容，适合交叉对照线索与设定。',
        tip: '入口位置：右侧标签栏顶部',
      },
      {
        title: '第 5 步：切换主题与导出备份',
        highlight: '切换主题并定期导出 JSON',
        detail:
          '支持默认、羊皮纸、未来科技、自然护眼。建议关键编辑后导出快照，便于迁移与回滚。',
        tip: '入口位置：设置页 / 首页工具栏',
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
            按步骤完成一次体验，你会更快熟悉最近的功能更新。
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
