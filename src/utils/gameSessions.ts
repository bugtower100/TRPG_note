import { v4 as uuidv4 } from 'uuid';
import type {
  GameSession,
  GameSessionAgendaStatus,
  GameSessionGoalStatus,
  GameSessionStatus,
  GraphEntityType,
} from '../types';

const RESOURCE_TYPES = new Set<GraphEntityType>([
  'characters',
  'monsters',
  'locations',
  'organizations',
  'events',
  'clues',
  'timelines',
]);

const normalizeStatus = (value: unknown): GameSessionStatus => {
  if (value === 'active' || value === 'completed') return value;
  return 'preparing';
};

const normalizeGoalStatus = (value: unknown): GameSessionGoalStatus => {
  if (value === 'progressed' || value === 'completed' || value === 'dropped') return value;
  return 'pending';
};

const normalizeAgendaStatus = (value: unknown): GameSessionAgendaStatus => {
  if (value === 'active' || value === 'completed' || value === 'skipped' || value === 'deferred') return value;
  return 'pending';
};

const stringValue = (value: unknown) => typeof value === 'string' ? value : '';
const timestampValue = (value: unknown, fallback: number) =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

export const createGameSession = (sessionNumber: number): GameSession => {
  const now = Date.now();
  return {
    id: uuidv4(),
    title: `第 ${sessionNumber} 次跑团`,
    sessionNumber,
    scheduledAt: '',
    inWorldDate: '',
    status: 'preparing',
    summary: '',
    goals: [],
    agenda: [],
    resourceRefs: [],
    taskIds: [],
    participantUserIds: [],
    liveNotes: '',
    unresolvedItems: '',
    gmSummary: '',
    playerRecap: '',
    createdAt: now,
    updatedAt: now,
  };
};

export const createGameSessionFromPreparation = (base: GameSession, sessionNumber: number): GameSession => ({
  ...createGameSession(sessionNumber),
  summary: base.summary,
  goals: base.goals.map((goal) => ({
    ...goal,
    id: uuidv4(),
    status: 'pending',
  })),
  agenda: base.agenda.map((item) => ({
    ...item,
    id: uuidv4(),
    status: 'pending',
  })),
  resourceRefs: base.resourceRefs.map((ref) => ({ ...ref })),
  taskIds: [...base.taskIds],
  participantUserIds: [...base.participantUserIds],
});

export const normalizeGameSessions = (value: unknown): GameSession[] => {
  if (!Array.isArray(value)) return [];
  return value.map((raw, index) => {
    const item = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
    const now = Date.now();
    const sessionNumber = typeof item.sessionNumber === 'number' && Number.isFinite(item.sessionNumber)
      ? Math.max(1, Math.trunc(item.sessionNumber))
      : index + 1;
    const resourceKeys = new Set<string>();
    const resourceRefs = Array.isArray(item.resourceRefs) ? item.resourceRefs.flatMap((rawRef) => {
      if (!rawRef || typeof rawRef !== 'object') return [];
      const ref = rawRef as Record<string, unknown>;
      const entityType = ref.entityType as GraphEntityType;
      const entityId = stringValue(ref.entityId).trim();
      const key = `${entityType}:${entityId}`;
      if (!RESOURCE_TYPES.has(entityType) || !entityId || resourceKeys.has(key)) return [];
      resourceKeys.add(key);
      return [{
        entityType,
        entityId,
        usage: stringValue(ref.usage),
        pinned: Boolean(ref.pinned),
      }];
    }) : [];
    const uniqueStrings = (input: unknown) => Array.isArray(input)
      ? Array.from(new Set(input.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)))
      : [];

    return {
      id: stringValue(item.id) || uuidv4(),
      title: stringValue(item.title).trim() || `第 ${sessionNumber} 次跑团`,
      sessionNumber,
      scheduledAt: stringValue(item.scheduledAt),
      inWorldDate: stringValue(item.inWorldDate),
      status: normalizeStatus(item.status),
      summary: stringValue(item.summary),
      goals: Array.isArray(item.goals) ? item.goals.map((rawGoal) => {
        const goal = rawGoal && typeof rawGoal === 'object' ? rawGoal as Record<string, unknown> : {};
        return {
          id: stringValue(goal.id) || uuidv4(),
          title: stringValue(goal.title),
          status: normalizeGoalStatus(goal.status),
        };
      }).filter((goal) => goal.title.trim()) : [],
      agenda: Array.isArray(item.agenda) ? item.agenda.map((rawAgenda) => {
        const agenda = rawAgenda && typeof rawAgenda === 'object' ? rawAgenda as Record<string, unknown> : {};
        return {
          id: stringValue(agenda.id) || uuidv4(),
          title: stringValue(agenda.title),
          notes: stringValue(agenda.notes),
          status: normalizeAgendaStatus(agenda.status),
          plannedMinutes: typeof agenda.plannedMinutes === 'number' && Number.isFinite(agenda.plannedMinutes) && agenda.plannedMinutes > 0
            ? Math.trunc(agenda.plannedMinutes)
            : undefined,
        };
      }).filter((agenda) => agenda.title.trim()) : [],
      resourceRefs,
      taskIds: uniqueStrings(item.taskIds),
      participantUserIds: uniqueStrings(item.participantUserIds),
      liveNotes: stringValue(item.liveNotes),
      unresolvedItems: stringValue(item.unresolvedItems),
      gmSummary: stringValue(item.gmSummary),
      playerRecap: stringValue(item.playerRecap),
      playerRecapPublishedAt: typeof item.playerRecapPublishedAt === 'number' && item.playerRecapPublishedAt > 0
        ? item.playerRecapPublishedAt
        : undefined,
      createdAt: timestampValue(item.createdAt, now),
      updatedAt: timestampValue(item.updatedAt, now),
      startedAt: typeof item.startedAt === 'number' ? item.startedAt : undefined,
      completedAt: typeof item.completedAt === 'number' ? item.completedAt : undefined,
    };
  });
};
