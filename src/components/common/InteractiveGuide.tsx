import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { ACTIONS, EVENTS, EventData, Joyride, STATUS, Step } from 'react-joyride';
import { HelpCircle } from 'lucide-react';

export type GuideId =
  | 'landing'
  | 'dashboard'
  | 'entity-list'
  | 'entity-detail'
  | 'settings'
  | 'relation-graphs'
  | 'team-notes';

interface GuideContextValue {
  currentGuideId: GuideId | null;
  isGuideRunning: boolean;
  startGuide: (guideId: GuideId) => void;
}

const GUIDE_STEPS: Record<GuideId, Step[]> = {
  landing: [
    {
      target: '[data-tour="landing-create-campaign"]',
      skipBeacon: true,
      placement: 'right',
      content: '从这里创建新模组。现在创建卡片更紧凑，创建后会直接进入模组内部继续整理内容。',
    },
    {
      target: '[data-tour="landing-campaign-card"]',
      skipBeacon: true,
      placement: 'left',
      content: '这里是模组卡片。卡片会显示简介、公开/私密状态，以及当前在线成员概览。',
    },
    {
      target: '[data-tour="landing-campaign-members"]',
      skipBeacon: true,
      placement: 'bottom',
      content: '这里是成员列表占位区。现阶段会显示成员与在线人数，后续会继续扩展成完整的团队协作入口。',
    },
    {
      target: '[data-tour="landing-campaign-access"]',
      skipBeacon: true,
      placement: 'left',
      content: '模组公开/私密已经移到主页卡片上管理。以后多人协作时，会优先从这里配置访问控制。',
    },
  ],
  dashboard: [
    {
      target: '[data-tour="dashboard-header"]',
      skipBeacon: true,
      placement: 'bottom',
      content: '这里是模组概览页头部。你可以快速确认当前所在模组，并从这里重新打开概览页引导。',
    },
    {
      target: '[data-tour="sidebar-nav"]',
      skipBeacon: true,
      placement: 'right',
      content: '左侧导航依然是主工作区入口。现在除了原有栏目，还新增了团队笔记入口，后续多人协作会主要围绕这里展开。',
    },
    {
      target: '[data-tour="dashboard-stat-grid"]',
      skipBeacon: true,
      placement: 'bottom',
      content: '这里是模组统计概览。可以快速看到角色、怪物、地点、组织和最后更新时间，适合作为开工前的总览入口。',
    },
    {
      target: '[data-tour="dashboard-notes"]',
      skipBeacon: true,
      placement: 'top',
      content: '这里是模组概览笔记，适合记录总提纲、主持人备忘、待办事项。它和团队笔记不同，更偏向当前模组的总体摘要。',
    },
    {
      target: '[data-tour="sidebar-settings"]',
      skipBeacon: true,
      placement: 'right',
      content: '设置页依然负责主题风格、导入导出和资源管理；主页则负责模组卡片、访问控制和成员概览。',
    },
    {
      target: '[data-tour="sidebar-team-notes"]',
      skipBeacon: true,
      placement: 'right',
      content: '团队笔记页是多人协作入口。当前已经支持共享团队笔记、编辑状态提示、删除确认和基础编辑时间。',
    },
  ],
  'entity-list': [
    {
      target: '[data-tour="entity-list-add"]',
      skipBeacon: true,
      placement: 'bottom',
      content: '点击这里可以新建当前栏目条目，例如新建角色、新建怪物等。',
    },
    {
      target: '[data-tour="entity-card"]',
      skipBeacon: true,
      placement: 'bottom',
      content: '点击卡片主体可以进入详情页，在里面继续编辑分区内容、富文本(markdown)和其他信息。',
    },
    {
      target: '[data-tour="entity-card-split"]',
      skipBeacon: true,
      placement: 'left',
      content: '点击卡片右上角这个按钮，可以把条目分栏打开到右侧，不必离开当前列表页。',
    },
  ],
  'entity-detail': [
    {
      target: '[data-tour="entity-detail-name"]',
      skipBeacon: true,
      placement: 'bottom',
      content: '这里可以直接修改名称。',
    },
  ],
  settings: [
    {
      target: '[data-tour="settings-theme-section"]',
      skipBeacon: true,
      placement: 'bottom',
      content: '这里可以切换模组主题风格，不同主题会同时影响页面、编辑器和展示区的整体观感。',
    },
    {
      target: '[data-tour="settings-resource-upload"]',
      skipBeacon: true,
      placement: 'bottom',
      content: '这里可以批量上传图片资源。上传后的资源能在关系图和富文本图片插入中复用。',
    },
    {
      target: '[data-tour="settings-resource-list"]',
      skipBeacon: true,
      placement: 'top',
      content: '这里是资源列表，可以查看、筛选和删除当前模组已经上传的图片资源。',
    },
  ],
  'relation-graphs': [
    {
      target: '[data-tour="relation-graph-board"]',
      skipBeacon: true,
      placement: 'top',
      content: '这里是关系图主画布。你可以在当前图中添加节点、拖动位置、创建关系线，并继续编辑备注与资源图片。',
    },
  ],
  'team-notes': [
    {
      target: '[data-tour="team-notes-list"]',
      skipBeacon: true,
      placement: 'right',
      content: '左侧是团队笔记列表。你可以在这里新建、切换和查看当前模组中的共享团队笔记。',
    },
    {
      target: '[data-tour="team-notes-editor-actions"]',
      skipBeacon: true,
      placement: 'bottom',
      content: '这里是团队笔记的操作区，可以进入编辑、结束编辑，也能删除当前笔记。删除会弹出自定义确认框。',
    },
    {
      target: '[data-tour="team-notes-editor-body"]',
      skipBeacon: true,
      placement: 'top',
      content: '这里是团队笔记正文区域。当前版本支持团队共享、限定编辑时间和自动保存，后续会继续接入实时协作。',
    },
  ],
};

const GuideContext = createContext<GuideContextValue | null>(null);

export const GuideProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentGuideId, setCurrentGuideId] = useState<GuideId | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  const [run, setRun] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  const stopGuide = useCallback(() => {
    setRun(false);
    setStepIndex(0);
    setCurrentGuideId(null);
    window.setTimeout(() => setSteps([]), 0);
  }, []);

  const startGuide = useCallback((guideId: GuideId) => {
    const nextSteps = GUIDE_STEPS[guideId];
    if (!nextSteps || nextSteps.length === 0) return;
    setRun(false);
    setCurrentGuideId(guideId);
    setStepIndex(0);
    setSteps(nextSteps);
    window.setTimeout(() => setRun(true), 120);
  }, []);

  const handleCallback = useCallback((data: EventData) => {
    const { action, index, status, type } = data;

    if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
      stopGuide();
      return;
    }

    if (type === EVENTS.STEP_AFTER || type === EVENTS.TARGET_NOT_FOUND) {
      const nextIndex = index + (action === ACTIONS.PREV ? -1 : 1);
      setStepIndex(nextIndex);
    }
  }, [stopGuide]);

  const value = useMemo<GuideContextValue>(() => ({
    currentGuideId,
    isGuideRunning: run,
    startGuide,
  }), [currentGuideId, run, startGuide]);

  return (
    <GuideContext.Provider value={value}>
      {children}
      <Joyride
        steps={steps}
        run={run}
        stepIndex={stepIndex}
        onEvent={handleCallback}
        continuous
        scrollToFirstStep
        options={{
          buttons: ['back', 'close', 'primary', 'skip'],
          overlayClickAction: false,
          overlayColor: 'rgba(0, 0, 0, 0.45)',
          primaryColor: 'var(--primary-color)',
          showProgress: true,
          skipBeacon: true,
          textColor: 'var(--text-primary)',
          zIndex: 1400,
        }}
        styles={{
          floater: {
            zIndex: 1400,
          },
          overlay: {
            zIndex: 1390,
          },
          tooltip: {
            backgroundColor: 'var(--bg-card)',
            borderRadius: 12,
            boxShadow: '0 12px 30px rgba(0, 0, 0, 0.18)',
            border: '1px solid var(--border-color)',
            maxWidth: 360,
          },
          tooltipContainer: {
            padding: 12,
          },
          tooltipFooter: {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            paddingTop: 12,
            marginTop: 12,
            borderTop: '1px solid var(--border-color)',
          },
          buttonPrimary: {
            backgroundColor: 'var(--primary-color)',
            color: '#ffffff',
            borderRadius: 8,
            padding: '8px 14px',
          },
          buttonBack: {
            color: 'var(--text-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: 8,
            padding: '8px 14px',
            backgroundColor: 'transparent',
            whiteSpace: 'nowrap',
          },
          buttonSkip: {
            color: 'var(--text-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: 8,
            padding: '8px 14px',
            backgroundColor: 'transparent',
            whiteSpace: 'nowrap',
          },
          buttonClose: {
            color: 'var(--text-secondary)',
          },
        }}
        locale={{
          back: '上一步',
          close: '关闭',
          last: '完成',
          next: '下一步',
          skip: '跳过',
        }}
      />
    </GuideContext.Provider>
  );
};

export const useGuide = () => {
  const context = useContext(GuideContext);
  if (!context) {
    throw new Error('useGuide must be used within GuideProvider');
  }
  return context;
};

export const GuideHelpButton: React.FC<{ guideId: GuideId; className?: string }> = ({ guideId, className = '' }) => {
  const { startGuide } = useGuide();

  return (
    <button
      type="button"
      onClick={() => startGuide(guideId)}
      className={`inline-flex items-center justify-center w-9 h-9 rounded-full border border-theme bg-theme-card shadow-sm hover:bg-primary-light transition-colors ${className}`}
      aria-label="查看页面介绍"
      title="查看页面介绍"
    >
      <HelpCircle size={18} />
    </button>
  );
};
