package main

import "time"

type V2User struct {
	ID           string `gorm:"primaryKey;size:191"`
	Username     string `gorm:"index;size:191"`
	PasswordHash string `gorm:"type:text"`
	CreatedAt    time.Time
	UpdatedAt    time.Time
}

func (V2User) TableName() string { return "users" }

type V2Campaign struct {
	ID               string `gorm:"primaryKey;size:191"`
	Name             string
	Description      string `gorm:"type:text"`
	OwnerUserID      string `gorm:"index;size:191"`
	Visibility       string `gorm:"size:32"`
	JoinPasswordHash string `gorm:"type:text"`
	ThemeID          string `gorm:"size:191"`
	CreatedAt        time.Time
	UpdatedAt        time.Time
}

func (V2Campaign) TableName() string { return "campaigns" }

type V2CampaignMember struct {
	CampaignID   string `gorm:"primaryKey;size:191"`
	UserID       string `gorm:"primaryKey;size:191"`
	Role         string `gorm:"size:32"`
	JoinedAt     *time.Time
	LastActiveAt *time.Time
	CreatedAt    time.Time
	UpdatedAt    time.Time
}

func (V2CampaignMember) TableName() string { return "campaign_members" }

type V2CampaignDocument struct {
	ID            string `gorm:"primaryKey;size:255"`
	CampaignID    string `gorm:"index;size:191"`
	DocumentType  string `gorm:"index;size:64"`
	SchemaVersion int
	Version       int
	ContentJSON   string `gorm:"type:text"`
	CreatedAt     time.Time
	UpdatedAt     time.Time
}

func (V2CampaignDocument) TableName() string { return "campaign_documents" }

type V2CampaignConfig struct {
	CampaignID  string `gorm:"primaryKey;size:191"`
	Version     int
	ContentJSON string `gorm:"type:text"`
	UpdatedAt   time.Time
}

func (V2CampaignConfig) TableName() string { return "campaign_configs" }

type V2TeamNote struct {
	ID              string `gorm:"primaryKey;size:191"`
	CampaignID      string `gorm:"index;size:191"`
	Title           string
	Version         int
	ContentJSON     string `gorm:"type:text"`
	ActiveLeaseJSON string `gorm:"type:text"`
	CreatedAt       time.Time
	UpdatedAt       time.Time
}

func (V2TeamNote) TableName() string { return "team_notes" }

type V2Share struct {
	ID              string `gorm:"primaryKey;size:191"`
	CampaignID      string `gorm:"index;size:191"`
	EntityType      string `gorm:"size:64"`
	EntityID        string `gorm:"size:191"`
	Scope           string `gorm:"size:64"`
	ScopeID         string `gorm:"size:191"`
	Permission      string `gorm:"size:64"`
	TargetUserID    string `gorm:"size:191"`
	Version         int
	ContentJSON     string `gorm:"type:text"`
	ActiveLeaseJSON string `gorm:"type:text"`
	CreatedAt       time.Time
	UpdatedAt       time.Time
}

func (V2Share) TableName() string { return "shares" }

type V2DocumentVersion struct {
	ID             string `gorm:"primaryKey;size:191"`
	CampaignID     string `gorm:"index;size:191"`
	DocumentType   string `gorm:"size:64"`
	DocumentID     string `gorm:"size:191"`
	VersionNo      int
	SnapshotJSON   string `gorm:"type:text"`
	OperatorUserID string `gorm:"size:191"`
	CreatedAt      time.Time
	UpdatedAt      time.Time
}

func (V2DocumentVersion) TableName() string { return "document_versions" }

type V2ResourceIndex struct {
	ID          string `gorm:"primaryKey;size:255"`
	Ref         string `gorm:"index;size:255"`
	FolderPath  string `gorm:"size:255"`
	FileName    string
	ContentHash string `gorm:"size:128"`
	MimeType    string `gorm:"size:128"`
	SizeBytes   int64
	CreatedAt   time.Time
	UpdatedAt   time.Time
}

func (V2ResourceIndex) TableName() string { return "resource_index" }
