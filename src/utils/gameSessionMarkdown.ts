import type { CampaignData, GameSession, GraphEntityType } from '../types';

type CampaignMember = { userId: string; username: string };

const STATUS_LABELS = {
  preparing: '准备中',
  active: '进行中',
  completed: '已结束',
} as const;

const GOAL_STATUS_LABELS = {
  pending: '未推进',
  progressed: '已推进',
  completed: '已完成',
  dropped: '放弃',
} as const;

const AGENDA_STATUS_LABELS = {
  pending: '未开始',
  active: '进行中',
  completed: '已发生',
  skipped: '跳过',
  deferred: '顺延下场',
} as const;

const TASK_STATUS_LABELS = {
  todo: '待准备',
  in_progress: '进行中',
  done: '已完成',
} as const;

const RESOURCE_TYPE_LABELS: Record<GraphEntityType, string> = {
  characters: '角色',
  monsters: '怪物',
  locations: '地点',
  organizations: '组织',
  events: '事件',
  clues: '线索',
  timelines: '时间线',
};

const inlineText = (value: string) => value.replace(/\r?\n/g, ' ').trim();
const blockText = (value: string) => value.trim() || '（无）';
const formatDateTime = (value?: number) => value ? new Date(value).toLocaleString('zh-CN') : '未记录';
const formatScheduledAt = (value: string) => value ? new Date(value).toLocaleString('zh-CN') : '待定';
const listOrEmpty = (items: string[]) => items.length > 0 ? items.join('\n') : '（无）';

const indentedText = (value: string) => value.trim().replace(/\r?\n/g, '\n  ');

export const buildPlayerSessionMarkdown = (session: GameSession) => [
  `# ${inlineText(session.title)}`,
  `- 场次：第 ${session.sessionNumber} 次`,
  `- 现实时间：${formatScheduledAt(session.scheduledAt)}`,
  `- 世界内日期：${inlineText(session.inWorldDate) || '未记录'}`,
  `- 发布时间：${formatDateTime(session.playerRecapPublishedAt)}`,
  '## 玩家版回顾',
  blockText(session.playerRecap),
].join('\n\n');

export const buildGMSessionMarkdown = (
  session: GameSession,
  campaignData: CampaignData,
  members: CampaignMember[],
) => {
  const resourceNames = new Map<string, string>();
  (Object.keys(RESOURCE_TYPE_LABELS) as GraphEntityType[]).forEach((type) => {
    campaignData[type].forEach((item) => resourceNames.set(`${type}:${item.id}`, item.name));
  });
  const tasks = new Map(campaignData.sessionTasks.map((task) => [task.id, task]));
  const memberNames = new Map(members.map((member) => [member.userId, member.username]));

  const goals = session.goals.map((goal) => `- [${GOAL_STATUS_LABELS[goal.status]}] ${inlineText(goal.title)}`);
  const agenda = session.agenda.map((item) => {
    const notes = item.notes.trim() ? `\n  ${indentedText(item.notes)}` : '';
    const duration = item.plannedMinutes ? ` · 预计 ${item.plannedMinutes} 分钟` : '';
    return `- [${AGENDA_STATUS_LABELS[item.status]}] ${inlineText(item.title)}${duration}${notes}`;
  });
  const resources = session.resourceRefs.map((ref) => {
    const name = resourceNames.get(`${ref.entityType}:${ref.entityId}`) || '资料已删除';
    const usage = inlineText(ref.usage);
    return `- ${RESOURCE_TYPE_LABELS[ref.entityType]}：${name}${ref.pinned ? '（置顶）' : ''}${usage ? ` — ${usage}` : ''}`;
  });
  const relatedTasks = session.taskIds.map((taskId) => {
    const task = tasks.get(taskId);
    if (!task) return '- 任务已删除';
    const tags = task.tags.length > 0 ? ` · ${task.tags.join(' / ')}` : '';
    return `- [${TASK_STATUS_LABELS[task.status]}] ${inlineText(task.title)}${tags}`;
  });
  const participants = session.participantUserIds.map((userId) => `- ${memberNames.get(userId) || userId}`);

  return [
    `# ${inlineText(session.title)}`,
    `- 场次：第 ${session.sessionNumber} 次`,
    `- 状态：${STATUS_LABELS[session.status]}`,
    `- 现实时间：${formatScheduledAt(session.scheduledAt)}`,
    `- 世界内日期：${inlineText(session.inWorldDate) || '未记录'}`,
    `- 开始记录：${formatDateTime(session.startedAt)}`,
    `- 结束记录：${formatDateTime(session.completedAt)}`,
    '## 场次简介',
    blockText(session.summary),
    '## 本场目标',
    listOrEmpty(goals),
    '## 流程提纲',
    listOrEmpty(agenda),
    '## 本场资料',
    listOrEmpty(resources),
    '## 关联任务',
    listOrEmpty(relatedTasks),
    '## 参与成员',
    listOrEmpty(participants),
    '## 现场记录',
    blockText(session.liveNotes),
    '## 未解决问题',
    blockText(session.unresolvedItems),
    '## GM 私有总结',
    blockText(session.gmSummary),
    '## 玩家版回顾',
    blockText(session.playerRecap),
    `发布状态：${session.playerRecapPublishedAt ? `已于 ${formatDateTime(session.playerRecapPublishedAt)} 发布` : '未发布'}`,
  ].join('\n\n');
};

export const gameSessionMarkdownFileName = (session: GameSession, playerView: boolean) => {
  const baseName = `第${session.sessionNumber}次-${inlineText(session.title)}`
    .replace(/[<>:"/\\|?*]/g, '_')
    .slice(0, 80)
    .trim() || `第${session.sessionNumber}次场次`;
  return `${baseName}${playerView ? '-玩家回顾' : '-GM记录'}.md`;
};

export const downloadSessionMarkdown = (content: string, fileName: string) => {
  const blob = new Blob([`\uFEFF${content}`], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};
