import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { ACTIONS, EVENTS, EventData, Joyride, STATUS, Step } from 'react-joyride';
import { HelpCircle } from 'lucide-react';

export type GuideId =
  | 'landing'
  | 'dashboard'
  | 'entity-list'
  | 'entity-detail'
  | 'settings'
  | 'relation-graphs';

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
      placement: 'bottom',
      content: '从这里新建模组。填好模组名称后即可开始整理角色、怪物、地点、组织与关系图等内容。',
    },
    {
      target: '[data-tour="landing-campaign-list"]',
      skipBeacon: true,
      placement: 'top',
      content: '这里会显示已有模组。创建完成后，直接点击卡片上的“进入模组”即可进入内部功能页面。',
    },
  ],
  dashboard: [
    {
      target: '[data-tour="sidebar-nav"]',
      skipBeacon: true,
      placement: 'right',
      content: '进入模组后，左侧导航就是核心功能入口，你可以在这里切换角色、怪物、地点、组织、事件、线索、时间线、关系图和设置页。',
    },
    {
      target: '[data-tour="sidebar-characters"]',
      skipBeacon: true,
      placement: 'right',
      content: '角色与怪物等信息都通过对应栏目管理。点击后可以查看卡片列表、创建条目并进入详情编辑。',
    },
    {
      target: '[data-tour="sidebar-relation-graphs"]',
      skipBeacon: true,
      placement: 'right',
      content: '关系图页用于组织角色和怪物之间的结构关系，适合快速梳理阵营、敌对与合作关系。',
    },
    {
      target: '[data-tour="sidebar-settings"]',
      skipBeacon: true,
      placement: 'right',
      content: '设置页可以调整主题风格、导入导出数据，并统一管理图片资源。',
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
            padding: 12,
            boxShadow: '0 12px 30px rgba(0, 0, 0, 0.18)',
            border: '1px solid var(--border-color)',
            maxWidth: 360,
          },
          buttonBack: {
            color: 'var(--text-secondary)',
            whiteSpace: 'nowrap',
          },
          buttonSkip: {
            color: 'var(--text-secondary)',
            whiteSpace: 'nowrap',
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
