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

export interface Clue extends BaseEntity {
  type: string; // e.g., "Letter", "Rumor"
  relations: Relation[];
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

export interface CampaignData {
  id?: string; // Add optional ID for multi-campaign support
  meta: {
    formatVersion: string;
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

export interface CampaignSummary {
  id: string;
  name: string;
  description: string;
  lastModified: number;
  ownerId: string; // GM User ID
}

export type CampaignTheme = 'default' | 'scroll' | 'archive' | 'nature';
