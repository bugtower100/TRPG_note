package main

import (
	"strconv"
	"time"

	"gorm.io/gorm"
)

const (
	legacySchemaVersion = 1
	targetSchemaVersion = 2

	migrationStateReady    = "ready"
	migrationStateRequired = "required"
	migrationStateRunning  = "running"
	migrationStateFailed   = "failed"
	migrationStateBlocked  = "blocked"
)

type AppMeta struct {
	Key       string `gorm:"primaryKey;size:191"`
	Value     string `gorm:"type:text;not null"`
	UpdatedAt time.Time
}

type SchemaMigration struct {
	ID           uint `gorm:"primaryKey"`
	Name         string
	FromVersion  int
	ToVersion    int
	Status       string
	StartedAt    time.Time
	FinishedAt   *time.Time
	ErrorMessage string `gorm:"type:text"`
	CreatedAt    time.Time
	UpdatedAt    time.Time
}

type MigrationStatusResponse struct {
	CurrentSchemaVersion int    `json:"currentSchemaVersion"`
	TargetSchemaVersion  int    `json:"targetSchemaVersion"`
	State                string `json:"state"`
	RequiresMigration    bool   `json:"requiresMigration"`
	CanEnterApp          bool   `json:"canEnterApp"`
	Message              string `json:"message"`
	LastError            string `json:"lastError,omitempty"`
	LastStartedAt        *int64 `json:"lastStartedAt,omitempty"`
	LastFinishedAt       *int64 `json:"lastFinishedAt,omitempty"`
}

func getAppMeta(db *gorm.DB, key string) (string, bool, error) {
	var meta AppMeta
	err := db.First(&meta, "key = ?", key).Error
	if err == nil {
		return meta.Value, true, nil
	}
	if err == gorm.ErrRecordNotFound {
		return "", false, nil
	}
	return "", false, err
}

func setAppMeta(db *gorm.DB, key, value string) error {
	return db.Save(&AppMeta{
		Key:       key,
		Value:     value,
		UpdatedAt: time.Now(),
	}).Error
}

func ensureMigrationFoundation(db *gorm.DB) error {
	if _, exists, err := getAppMeta(db, "schema_version"); err != nil {
		return err
	} else if exists {
		if err := ensureMetaDefault(db, "migration_target_version", strconv.Itoa(targetSchemaVersion)); err != nil {
			return err
		}
		if err := ensureMetaDefault(db, "migration_state", migrationStateReady); err != nil {
			return err
		}
		return nil
	}

	var kvCount int64
	if err := db.Model(&KV{}).Count(&kvCount).Error; err != nil {
		return err
	}

	initialSchemaVersion := targetSchemaVersion
	initialState := migrationStateReady
	if kvCount > 0 {
		initialSchemaVersion = legacySchemaVersion
		initialState = migrationStateRequired
	}

	defaults := map[string]string{
		"schema_version":           strconv.Itoa(initialSchemaVersion),
		"migration_target_version": strconv.Itoa(targetSchemaVersion),
		"migration_state":          initialState,
	}

	for key, value := range defaults {
		if err := setAppMeta(db, key, value); err != nil {
			return err
		}
	}

	return nil
}

func ensureMetaDefault(db *gorm.DB, key, value string) error {
	_, exists, err := getAppMeta(db, key)
	if err != nil {
		return err
	}
	if exists {
		return nil
	}
	return setAppMeta(db, key, value)
}

func parseSchemaVersion(raw string, fallback int) int {
	if raw == "" {
		return fallback
	}
	parsed, err := strconv.Atoi(raw)
	if err != nil {
		return fallback
	}
	return parsed
}

func timeToMillisPtr(value *time.Time) *int64 {
	if value == nil || value.IsZero() {
		return nil
	}
	millis := value.UnixMilli()
	return &millis
}

func buildMigrationStatus(db *gorm.DB) (MigrationStatusResponse, error) {
	currentRaw, _, err := getAppMeta(db, "schema_version")
	if err != nil {
		return MigrationStatusResponse{}, err
	}
	targetRaw, _, err := getAppMeta(db, "migration_target_version")
	if err != nil {
		return MigrationStatusResponse{}, err
	}
	stateRaw, _, err := getAppMeta(db, "migration_state")
	if err != nil {
		return MigrationStatusResponse{}, err
	}
	lastError, _, err := getAppMeta(db, "migration_last_error")
	if err != nil {
		return MigrationStatusResponse{}, err
	}

	currentVersion := parseSchemaVersion(currentRaw, legacySchemaVersion)
	targetVersion := parseSchemaVersion(targetRaw, targetSchemaVersion)
	state := stateRaw
	if state == "" {
		state = migrationStateReady
	}

	var latest SchemaMigration
	latestErr := db.Order("started_at desc").First(&latest).Error
	if latestErr != nil && latestErr != gorm.ErrRecordNotFound {
		return MigrationStatusResponse{}, latestErr
	}

	requiresMigration := currentVersion < targetVersion ||
		state == migrationStateRequired ||
		state == migrationStateRunning ||
		state == migrationStateFailed ||
		state == migrationStateBlocked

	canEnterApp := !requiresMigration && state == migrationStateReady

	message := "数据库结构已就绪，可正常进入应用。"
	switch state {
	case migrationStateRequired:
		message = "检测到数据库需要显式迁移，迁移完成前不可进入应用。"
	case migrationStateRunning:
		message = "数据库迁移正在执行中，请等待迁移完成。"
	case migrationStateFailed:
		message = "最近一次数据库迁移失败，请先处理迁移问题。"
	case migrationStateBlocked:
		message = "数据库状态异常，当前已阻止进入应用。"
	}

	return MigrationStatusResponse{
		CurrentSchemaVersion: currentVersion,
		TargetSchemaVersion:  targetVersion,
		State:                state,
		RequiresMigration:    requiresMigration,
		CanEnterApp:          canEnterApp,
		Message:              message,
		LastError:            lastError,
		LastStartedAt:        timeToMillisPtr(&latest.StartedAt),
		LastFinishedAt:       timeToMillisPtr(latest.FinishedAt),
	}, nil
}
