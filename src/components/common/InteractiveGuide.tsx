import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { ACTIONS, EVENTS, EventData, Joyride, STATUS, Step } from 'react-joyride';
import { HelpCircle } from 'lucide-react';

export type GuideId =
  | 'landing'
  | 'dashboard'
  | 'workspace'
  | 'clues'
  | 'entity-list'
  | 'entity-detail'
  | 'settings'
  | 'relation-graphs'
  | 'team-notes'
  | 'session-tasks';

interface GuideContextValue {
  currentGuideId: GuideId | null;
  isGuideRunning: boolean;
  startGuide: (guideId: GuideId) => void;
}

const GUIDE_STEPS: Record<GuideId, Step[]> = {
  workspace: [
    {
      target: '[data-tour="play-workspace"]',
      skipBeacon: true,
      placement: 'bottom',
      content: '工作台集中显示线索、任务、笔记和场次。通过上方栏目继续处理内容，单人使用无需添加成员；玩家仅看到已授权资料。',
    },
    {
      target: '[data-tour="sidebar-nav"]',
      skipBeacon: true,
      placement: 'right',
      content: '侧边栏按用途分组。工作台负责跑团推进，资料区用于查阅，主持人的关系图、思维导图和时间线放在整理工具中。',
    },
  ],
  landing: [
    {
      target: '[data-tour="landing-create-campaign"]',
      skipBeacon: true,
      placement: 'right',
      content: '点击工具栏中的“新建模组”开始整理。已有导出包可从右上角“工具与备份”中导入。',
    },
    {
      target: '[data-tour="landing-campaign-card"]',
      skipBeacon: true,
      placement: 'left',
      content: '这里是模组卡片。卡片会显示简介、公开/私密状态，以及当前在线成员概览。',
    },
    {
      target: '[data-tour="landing-campaign-manage"]',
      skipBeacon: true,
      placement: 'bottom',
      content: '展开后查看成员和备份操作；主持人可管理公开状态、进入密码及成员权限，创建者可删除模组。',
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
      target: '[data-tour="dashboard-stat-grid"]',
      skipBeacon: true,
      placement: 'bottom',
      content: '这里是模组统计概览。可以快速看到角色、怪物、地点、组织和最后更新时间，适合作为开工前的总览入口。',
    },
    {
      target: '[data-tour="dashboard-search"]',
      skipBeacon: true,
      placement: 'bottom',
      content: '这里是全局检索入口。输入关键词后按回车会进入首个匹配；同时下方会列出所有相关结果可直接点选。',
    },
    {
      target: '[data-tour="dashboard-search-results"]',
      skipBeacon: true,
      placement: 'top',
      content: '这是匹配结果列表。会按最近更新时间排序，点击任意项可直接跳转到对应条目。',
    },
    {
      target: '[data-tour="dashboard-notes"]',
      skipBeacon: true,
      placement: 'top',
      content: '这里是模组概览笔记，适合记录总提纲、主持人备忘、待办事项。它和团队笔记不同，更偏向当前模组的总体摘要。',
    },
  ],
  clues: [
    {
      target: '[data-tour="clue-tabs"]',
      skipBeacon: true,
      placement: 'bottom',
      content: '线索模块已经合并为一个入口。你可以在“线索列表”和“线索板”之间切换，不再需要单独导航页。',
    },
    {
      target: '[data-tour="clue-board"]',
      skipBeacon: true,
      placement: 'top',
      content: '线索板支持状态推进与揭秘记录，适合主持人在跑团中快速追踪线索流转。',
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
      target: '[data-tour="settings-general-tab"]',
      skipBeacon: true,
      placement: 'bottom',
      content: '在“基本设置”中切换配色、管理自定义主题或调整编辑偏好。',
    },
    {
      target: '[data-tour="settings-resources-tab"]',
      skipBeacon: true,
      placement: 'bottom',
      content: '在“资源管理”中上传图片、整理目录和处理引用中的资源。',
    },
    {
      target: '[data-tour="settings-general-tab"]',
      skipBeacon: true,
      placement: 'top',
      content: '在“基本设置”中调整正文的编辑方式。',
    },
    {
      target: '[data-tour="settings-data-tab"]',
      skipBeacon: true,
      placement: 'top',
      content: '在“备份与导入”中导出完整模组或备团包，也可以预览并导入数据包。',
    },
    {
      target: '[data-tour="settings-recycle-tab"]',
      skipBeacon: true,
      placement: 'top',
      content: '在“回收站”中恢复误删资料。默认保留 3 天，也可以调整保留天数。',
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
  'session-tasks': [
    {
      target: '[data-tour="task-board-header"]',
      skipBeacon: true,
      placement: 'bottom',
      content: '任务看板已升级为协作模式：显示当前身份、看板版本与租约状态，方便 GM 主导团队协作。',
    },
    {
      target: '[data-tour="task-board-permissions"]',
      skipBeacon: true,
      placement: 'bottom',
      content: 'GM 可在这里配置 PL 的可查看/可编辑权限。关闭查看会同时关闭编辑，避免权限冲突。',
    },
    {
      target: '[data-tour="task-board-actions"]',
      skipBeacon: true,
      placement: 'bottom',
      content: '通过这里进入/结束编辑。编辑态下会自动续租与自动保存，冲突时会弹出对比处理。',
    },
    {
      target: '[data-tour="task-board-create"]',
      skipBeacon: true,
      placement: 'top',
      content: '任务归属已改为标签（tags）。创建任务时可直接输入逗号分隔标签，后续也可以在任务卡内继续编辑标签。',
    },
    {
      target: '[data-tour="task-board-tags"]',
      skipBeacon: true,
      placement: 'top',
      content: '这里可以按标签筛选任务，也能快速点选现有标签进行过滤。',
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
