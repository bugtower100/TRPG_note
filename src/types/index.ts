export type EntityType = 'character' | 'location' | 'organization' | 'event' | 'clue' | 'timeline';

export interface Relation {
  id: string; // Target entity ID
  targetType: EntityType;
  relation: string; // e.g., "Father", "Enemy", "Located In"
}

export interface CustomSubItem {
  id: string;
  title: string;
  content: string;
  collapsed?: boolean;
}

export interface BaseEntity {
  id: string;
  name: string;
  details: string;
  tags?: string[];
  customSubItems?: CustomSubItem[];
  sectionSubItems?: Record<string, CustomSubItem[]>;
  sectionVisibility?: Record<string, boolean>;
  sectionTitles?: Record<string, string>;
  customSections?: string[];
  relatedImages: string[];
  createdAt: number;
  updatedAt: number;
}

export interface Character extends BaseEntity {
  identity: string;
  appearance: string;
  desireOrGoal: string;
  attributes: string; // Text based attributes
  relations: Relation[];
}

export interface Location extends BaseEntity {
  environment: string;
  relations: Relation[];
}

export interface Organization extends BaseEntity {
  notes: string;
  relations: Relation[];
}

export interface Event extends BaseEntity {
  time: string;
  relations: Relation[];
}

export type ClueRevealStatus = 'untracked' | 'investigating' | 'revealed';

export interface ClueRevealLogItem {
  id: string;
  target: string;
  note?: string;
  revealedAt: number;
}

export interface Clue extends BaseEntity {
  type: string; // e.g., "Letter", "Rumor"
  relations: Relation[];
  revealStatus?: ClueRevealStatus;
  revealTarget?: string;
  revealLogs?: ClueRevealLogItem[];
}

export interface TimelineEvent {
  id: string;
  time: string;
  content: string;
  relations: Relation[];
  relatedImages: string[];
  isRevealed: boolean;
}

export interface Timeline extends BaseEntity {
  timelineEvents: TimelineEvent[];
}

export type GraphEntityType =
  | 'characters'
  | 'monsters'
  | 'locations'
  | 'organizations'
  | 'events'
  | 'clues'
  | 'timelines';

export type ShareScope = 'entity' | 'section' | 'subItem';

export interface SharedEntitySnapshot {
  entityName: string;
  entityType: GraphEntityType;
  scope: ShareScope;
  sectionKey?: string;
  sectionTitle?: string;
  subItemId?: string;
  subItemTitle?: string;
  details?: string;
  sectionItems?: CustomSubItem[];
  subItem?: CustomSubItem | null;
  timelineEvents?: TimelineEvent[];
  allSections?: Array<{
    key: string;
    title: string;
    items: CustomSubItem[];
  }>;
}

export interface SharedEntityRecord {
  id: string;
  campaignId: string;
  entityType: GraphEntityType;
  entityId: string;
  entityName: string;
  scope: ShareScope;
  scopeId?: string;
  permission: SharedPermission;
  sourceOwnerUserId: string;
  sourceOwnerUsername: string;
  targetUserId: string;
  targetUsername: string;
  sharedByUserId: string;
  sharedByUsername: string;
  createdAt: number;
  updatedAt: number;
  version: number;
  activeLease?: TeamNoteLease | null;
  snapshot: SharedEntitySnapshot;
}

export interface VersionRecord {
  id: string;
  campaignId: string;
  documentType: 'team_note' | 'shared_entity' | 'campaign_config' | 'task_board';
  documentId: string;
  action: 'create' | 'update' | 'delete' | 'restore_copy';
  summary: string;
  operatorUserId: string;
  operatorUsername: string;
  createdAt: number;
  snapshot: Record<string, unknown>;
  previousSnapshot?: Record<string, unknown> | null;
}

export interface RelationGraphNode {
  id: string;
  entityId: string;
  entityType: GraphEntityType;
  label: string;
  x: number;
  y: number;
  note?: string;
  tokenImageRef?: string;
  tokenImage?: string;
}

export type RelationEdgeDirection = 'none' | 'forward' | 'backward' | 'bidirectional';

export interface RelationGraphEdge {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  direction: RelationEdgeDirection;
  lineStyle: 'solid' | 'dashed';
  lineWidth: number;
  label: string;
  labelFontSize: number;
  labelColor: string;
  labelBgColor: string;
  labelBgOpacity: number;
}

export interface RelationGraph {
  id: string;
  name: string;
  nodes: RelationGraphNode[];
  edges: RelationGraphEdge[];
  updatedAt: number;
}

export type SessionTaskStatus = 'todo' | 'in_progress' | 'done';

export interface SessionTask {
  id: string;
  title: string;
  description: string;
  status: SessionTaskStatus;
  tags: string[];
  assignee?: string; // legacy field, kept for compatibility when loading old data
  createdAt: number;
  updatedAt: number;
}

export interface SessionTaskBoardDocument {
  campaignId: string;
  tasks: SessionTask[];
  updatedBy: string;
  updatedByName: string;
  updatedAt: number;
  version: number;
  plCanView?: boolean;
  plCanEdit?: boolean;
  activeLease?: TeamNoteLease | null;
}

export interface CampaignData {
  id?: string; // Add optional ID for multi-campaign support
  meta: {
    formatVersion: string;
    schemaVersion?: number;
    projectName: string;
    lastModified: number;
    description?: string; // Brief description
  };
  notes?: string; // Global campaign notes/overview
  characters: Character[];
  locations: Location[];
  organizations: Organization[];
  events: Event[];
  clues: Clue[];
  timelines: Timeline[];
  monsters: Monster[];
  sessionTasks: SessionTask[];
  relationGraphs?: RelationGraph[];
}

export interface Monster extends BaseEntity {
  type: string; // e.g., "Undead", "Beast"
  stats: string; // HP, AC, Attacks, etc.
  abilities: string; // Special abilities
  drops: string; // Loot
  relations: Relation[];
}

export type Entity = Character | Location | Organization | Event | Clue | Timeline | Monster;

// New Types for Multi-User & Multi-Campaign
export interface UserProfile {
  id: string;
  username: string;
  role: 'GM'; // Simplified to only GM
  lastActive: number;
}

export type CampaignVisibility = 'public' | 'private';
export type CampaignMemberRole = 'GM' | 'PL';
export type SharedPermission = 'read' | 'edit';

export interface CampaignSummary {
  id: string;
  name: string;
  description: string;
  lastModified: number;
  ownerId: string; // GM User ID
  visibility?: CampaignVisibility;
  schemaVersion?: number;
}

export interface CampaignMember {
  userId: string;
  username: string;
  role: CampaignMemberRole;
  joinedAt: number;
  lastActiveAt: number;
}

export interface CampaignConfig {
  campaignId: string;
  name?: string;
  description?: string;
  lastModified?: number;
  visibility: CampaignVisibility;
  ownerUserId: string;
  schemaVersion: number;
  members: CampaignMember[];
  createdAt: number;
  updatedAt: number;
}

export interface PublicCampaignSummary {
  id: string;
  name: string;
  description: string;
  lastModified: number;
  ownerId: string;
  ownerUsername: string;
  visibility: CampaignVisibility;
  memberCount: number;
  onlineMemberCount: number;
}

export interface TeamNoteLease {
  userId: string;
  username: string;
  role: CampaignMemberRole;
  startedAt: number;
  expiresAt?: number | null;
}

export interface TeamNoteDocument {
  id: string;
  campaignId: string;
  title: string;
  content: string;
  createdBy: string;
  createdByName: string;
  updatedBy: string;
  updatedByName: string;
  createdAt: number;
  updatedAt: number;
  version: number;
  activeLease?: TeamNoteLease | null;
}

export type CampaignTheme = 'default' | 'scroll' | 'archive' | 'nature';
