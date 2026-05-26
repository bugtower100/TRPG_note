package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"gorm.io/gorm"
)

var migrationRunMu sync.Mutex

type StartMigrationResponse struct {
	Started    bool                    `json:"started"`
	BackupPath string                  `json:"backupPath,omitempty"`
	Message    string                  `json:"message"`
	Status     MigrationStatusResponse `json:"status"`
}

type legacyCampaignIndexSummary struct {
	ID string `json:"id"`
}

func createMigrationBackup(dbPath string) (string, error) {
	info, err := os.Stat(dbPath)
	if err != nil {
		return "", err
	}
	if info.IsDir() {
		return "", fmt.Errorf("database path points to a directory")
	}

	backupDir := filepath.Join(filepath.Dir(dbPath), "backups")
	if err := os.MkdirAll(backupDir, 0o755); err != nil {
		return "", err
	}

	fileName := fmt.Sprintf("%s.%s.bak", filepath.Base(dbPath), time.Now().Format("20060102-150405"))
	backupPath := filepath.Join(backupDir, fileName)

	src, err := os.Open(dbPath)
	if err != nil {
		return "", err
	}
	defer src.Close()

	dst, err := os.Create(backupPath)
	if err != nil {
		return "", err
	}
	defer dst.Close()

	if _, err := io.Copy(dst, src); err != nil {
		return "", err
	}

	return backupPath, nil
}

func persistMigrationTimestamps(db *gorm.DB, startedAt time.Time, finishedAt *time.Time) error {
	if err := setAppMeta(db, "migration_last_started_at", fmt.Sprintf("%d", startedAt.UnixMilli())); err != nil {
		return err
	}
	if finishedAt != nil {
		if err := setAppMeta(db, "migration_last_finished_at", fmt.Sprintf("%d", finishedAt.UnixMilli())); err != nil {
			return err
		}
	}
	return nil
}

func markMigrationFailed(db *gorm.DB, migration *SchemaMigration, err error, startedAt time.Time) error {
	now := time.Now()
	migration.Status = migrationStateFailed
	migration.ErrorMessage = err.Error()
	migration.FinishedAt = &now
	if saveErr := db.Save(migration).Error; saveErr != nil {
		return saveErr
	}
	if metaErr := setAppMeta(db, "migration_state", migrationStateFailed); metaErr != nil {
		return metaErr
	}
	if metaErr := setAppMeta(db, "migration_last_error", err.Error()); metaErr != nil {
		return metaErr
	}
	return persistMigrationTimestamps(db, startedAt, &now)
}

func completeMigration(db *gorm.DB, migration *SchemaMigration, targetVersion int, startedAt time.Time) error {
	now := time.Now()
	migration.Status = "completed"
	migration.ErrorMessage = ""
	migration.FinishedAt = &now
	if err := db.Save(migration).Error; err != nil {
		return err
	}
	if err := setAppMeta(db, "schema_version", fmt.Sprintf("%d", targetVersion)); err != nil {
		return err
	}
	if err := setAppMeta(db, "migration_state", migrationStateReady); err != nil {
		return err
	}
	if err := setAppMeta(db, "migration_last_error", ""); err != nil {
		return err
	}
	return persistMigrationTimestamps(db, startedAt, &now)
}

func startMigration(cfg Config, db *gorm.DB) (StartMigrationResponse, error) {
	migrationRunMu.Lock()
	defer migrationRunMu.Unlock()

	status, err := buildMigrationStatus(db)
	if err != nil {
		return StartMigrationResponse{}, err
	}
	if !status.RequiresMigration {
		return StartMigrationResponse{
			Started: false,
			Message: "当前数据库无需迁移。",
			Status:  status,
		}, nil
	}
	if status.State == migrationStateRunning {
		return StartMigrationResponse{}, errors.New("migration_already_running")
	}

	backupPath, err := createMigrationBackup(cfg.DBPath)
	if err != nil {
		return StartMigrationResponse{}, err
	}

	startedAt := time.Now()
	migration := &SchemaMigration{
		Name:        fmt.Sprintf("schema_%d_to_%d", status.CurrentSchemaVersion, status.TargetSchemaVersion),
		FromVersion: status.CurrentSchemaVersion,
		ToVersion:   status.TargetSchemaVersion,
		Status:      migrationStateRunning,
		StartedAt:   startedAt,
		CreatedAt:   startedAt,
		UpdatedAt:   startedAt,
	}
	if err := db.Create(migration).Error; err != nil {
		return StartMigrationResponse{}, err
	}

	if err := setAppMeta(db, "migration_state", migrationStateRunning); err != nil {
		return StartMigrationResponse{}, err
	}
	if err := setAppMeta(db, "migration_last_error", ""); err != nil {
		return StartMigrationResponse{}, err
	}
	if err := persistMigrationTimestamps(db, startedAt, nil); err != nil {
		return StartMigrationResponse{}, err
	}

	if err := runSchemaMigrations(db, status.CurrentSchemaVersion, status.TargetSchemaVersion); err != nil {
		if markErr := markMigrationFailed(db, migration, err, startedAt); markErr != nil {
			return StartMigrationResponse{}, markErr
		}
		finalStatus, _ := buildMigrationStatus(db)
		return StartMigrationResponse{
			Started:    false,
			BackupPath: backupPath,
			Message:    "数据库迁移失败，请先处理错误后再重试。",
			Status:     finalStatus,
		}, nil
	}

	if err := completeMigration(db, migration, status.TargetSchemaVersion, startedAt); err != nil {
		return StartMigrationResponse{}, err
	}

	finalStatus, err := buildMigrationStatus(db)
	if err != nil {
		return StartMigrationResponse{}, err
	}
	return StartMigrationResponse{
		Started:    true,
		BackupPath: backupPath,
		Message:    "数据库迁移已完成。",
		Status:     finalStatus,
	}, nil
}

func runSchemaMigrations(db *gorm.DB, fromVersion, targetVersion int) error {
	version := fromVersion
	for version < targetVersion {
		switch version + 1 {
		case 2:
			if err := migrateSchema1To2(db); err != nil {
				return err
			}
		default:
			return fmt.Errorf("unsupported migration target: %d", version+1)
		}
		version++
	}
	return nil
}

func migrateSchema1To2(db *gorm.DB) error {
	if err := db.AutoMigrate(
		&V2User{},
		&V2Campaign{},
		&V2CampaignMember{},
		&V2CampaignDocument{},
		&V2CampaignConfig{},
		&V2TeamNote{},
		&V2Share{},
		&V2DocumentVersion{},
		&V2ResourceIndex{},
	); err != nil {
		return err
	}

	if err := migrateLegacyCampaignConfigs(db); err != nil {
		return err
	}
	if err := migrateLegacyCampaignBundles(db); err != nil {
		return err
	}
	if err := migrateLegacyTeamNotes(db); err != nil {
		return err
	}
	if err := migrateLegacyShares(db); err != nil {
		return err
	}
	if err := migrateLegacyTaskBoards(db); err != nil {
		return err
	}
	return migrateLegacyVersionRecords(db)
}

func parseLegacyCampaignKey(key string) (string, string, bool) {
	const prefix = "trpg_u_"
	const marker = "_campaign_"
	if !strings.HasPrefix(key, prefix) || strings.Contains(key, "_draft_") {
		return "", "", false
	}
	trimmed := strings.TrimPrefix(key, prefix)
	parts := strings.SplitN(trimmed, marker, 2)
	if len(parts) != 2 {
		return "", "", false
	}
	userID := strings.TrimSpace(parts[0])
	campaignID := strings.TrimSpace(parts[1])
	if userID == "" || campaignID == "" || campaignID == "index" {
		return "", "", false
	}
	return userID, campaignID, true
}

func migrateLegacyCampaignBundles(db *gorm.DB) error {
	var indexItems []KV
	if err := db.Where("key LIKE ?", "trpg_u_%_campaign_index").Find(&indexItems).Error; err != nil {
		return err
	}

	processed := map[string]bool{}
	for _, indexItem := range indexItems {
		ownerUserID := parseLegacyCampaignIndexOwner(indexItem.Key)
		if ownerUserID == "" {
			continue
		}
		var summaries []legacyCampaignIndexSummary
		if err := json.Unmarshal([]byte(indexItem.Value), &summaries); err != nil {
			return err
		}
		for _, summary := range summaries {
			campaignID := strings.TrimSpace(summary.ID)
			if campaignID == "" {
				continue
			}
			legacyKey := fmt.Sprintf("trpg_u_%s_campaign_%s", ownerUserID, campaignID)
			if processed[legacyKey] {
				continue
			}
			processed[legacyKey] = true

			var item KV
			err := db.First(&item, "key = ?", legacyKey).Error
			if err == gorm.ErrRecordNotFound {
				continue
			}
			if err != nil {
				return err
			}

			var raw map[string]any
			if err := json.Unmarshal([]byte(item.Value), &raw); err != nil {
				return err
			}
			meta, _ := raw["meta"].(map[string]any)
			projectName, _ := meta["projectName"].(string)
			description, _ := meta["description"].(string)
			lastModified := int64(0)
			switch value := meta["lastModified"].(type) {
			case float64:
				lastModified = int64(value)
			case int64:
				lastModified = value
			}
			now := time.Now()
			updatedAt := now
			if lastModified > 0 {
				updatedAt = time.UnixMilli(lastModified)
			}

			campaign := V2Campaign{
				ID:          campaignID,
				Name:        strings.TrimSpace(projectName),
				Description: strings.TrimSpace(description),
				OwnerUserID: ownerUserID,
				Visibility:  "private",
				CreatedAt:   updatedAt,
				UpdatedAt:   updatedAt,
			}
			if campaign.Name == "" {
				campaign.Name = "未命名模组"
			}
			if err := db.Save(&campaign).Error; err != nil {
				return err
			}

			member := V2CampaignMember{
				CampaignID: campaignID,
				UserID:     ownerUserID,
				Role:       "owner",
				CreatedAt:  updatedAt,
				UpdatedAt:  updatedAt,
			}
			joinedAt := updatedAt
			member.JoinedAt = &joinedAt
			member.LastActiveAt = &joinedAt
			if err := db.Save(&member).Error; err != nil {
				return err
			}

			if err := saveCampaignConfigDoc(db, CampaignConfigDoc{
				CampaignID:    campaignID,
				Name:          campaign.Name,
				Description:   campaign.Description,
				LastModified:  updatedAt.UnixMilli(),
				Visibility:    "private",
				OwnerUserID:   ownerUserID,
				SchemaVersion: 2,
				Members: []CampaignMember{
					{
						UserID:       ownerUserID,
						Username:     ownerUserID,
						Role:         "GM",
						JoinedAt:     updatedAt.UnixMilli(),
						LastActiveAt: updatedAt.UnixMilli(),
					},
				},
				CreatedAt: updatedAt.UnixMilli(),
				UpdatedAt: updatedAt.UnixMilli(),
			}); err != nil {
				return err
			}

			if err := migrateLegacyBundleDocuments(db, campaignID, item.Version, raw, updatedAt); err != nil {
				return err
			}
		}
	}
	return nil
}

func parseLegacyCampaignIndexOwner(key string) string {
	const prefix = "trpg_u_"
	const suffix = "_campaign_index"
	if !strings.HasPrefix(key, prefix) || !strings.HasSuffix(key, suffix) {
		return ""
	}
	return strings.TrimSpace(strings.TrimSuffix(strings.TrimPrefix(key, prefix), suffix))
}

func migrateLegacyBundleDocuments(db *gorm.DB, campaignID string, version int, raw map[string]any, updatedAt time.Time) error {
	documentMap := map[string]any{
		"campaign_meta":   raw["meta"],
		"notes":           raw["notes"],
		"characters":      raw["characters"],
		"locations":       raw["locations"],
		"organizations":   raw["organizations"],
		"events":          raw["events"],
		"clues":           raw["clues"],
		"timelines":       raw["timelines"],
		"monsters":        raw["monsters"],
		"session_tasks":   raw["sessionTasks"],
		"relation_graphs": raw["relationGraphs"],
	}

	for documentType, content := range documentMap {
		contentJSON, err := saveJSON(content)
		if err != nil {
			return err
		}
		row := V2CampaignDocument{
			ID:            bundleDocumentID(campaignID, documentType),
			CampaignID:    campaignID,
			DocumentType:  documentType,
			SchemaVersion: targetSchemaVersion,
			Version:       version,
			ContentJSON:   contentJSON,
			CreatedAt:     updatedAt,
			UpdatedAt:     updatedAt,
		}
		if err := db.Save(&row).Error; err != nil {
			return err
		}
	}
	return nil
}

func saveJSON(value any) (string, error) {
	data, err := json.Marshal(value)
	if err != nil {
		return "", err
	}
	return string(data), nil
}

func migrateLegacyCampaignConfigs(db *gorm.DB) error {
	var items []KV
	if err := db.Where("key LIKE ?", "campaign:%:config").Find(&items).Error; err != nil {
		return err
	}

	for _, item := range items {
		var cfg CampaignConfigDoc
		if err := json.Unmarshal([]byte(item.Value), &cfg); err != nil {
			return err
		}
		if strings.TrimSpace(cfg.CampaignID) == "" {
			continue
		}

		var existing V2Campaign
		err := db.First(&existing, "id = ?", cfg.CampaignID).Error
		if err == gorm.ErrRecordNotFound {
			continue
		}
		if err != nil {
			return err
		}

		content, err := saveJSON(cfg)
		if err != nil {
			return err
		}

		updatedAt := time.UnixMilli(maxInt64(cfg.UpdatedAt, cfg.LastModified))
		if updatedAt.IsZero() {
			updatedAt = time.Now()
		}

		campaign := existing
		if strings.TrimSpace(cfg.Name) != "" {
			campaign.Name = cfg.Name
		}
		campaign.Description = cfg.Description
		if strings.TrimSpace(cfg.OwnerUserID) != "" {
			campaign.OwnerUserID = cfg.OwnerUserID
		}
		if strings.TrimSpace(cfg.Visibility) != "" {
			campaign.Visibility = cfg.Visibility
		}
		campaign.JoinPasswordHash = cfg.JoinPasswordHash
		campaign.UpdatedAt = updatedAt
		if campaign.CreatedAt.IsZero() {
			campaign.CreatedAt = time.UnixMilli(cfg.CreatedAt)
			if campaign.CreatedAt.IsZero() {
				campaign.CreatedAt = updatedAt
			}
		}
		if err := db.Save(&campaign).Error; err != nil {
			return err
		}

		config := V2CampaignConfig{
			CampaignID:  cfg.CampaignID,
			Version:     maxInt(item.Version, cfg.SchemaVersion),
			ContentJSON: content,
			UpdatedAt:   updatedAt,
		}
		if err := db.Save(&config).Error; err != nil {
			return err
		}

		for _, member := range cfg.Members {
			memberRow := V2CampaignMember{
				CampaignID: cfg.CampaignID,
				UserID:     member.UserID,
				Role:       strings.ToLower(member.Role),
				CreatedAt:  updatedAt,
				UpdatedAt:  updatedAt,
			}
			if member.JoinedAt > 0 {
				joinedAt := time.UnixMilli(member.JoinedAt)
				memberRow.JoinedAt = &joinedAt
			}
			if member.LastActiveAt > 0 {
				lastActiveAt := time.UnixMilli(member.LastActiveAt)
				memberRow.LastActiveAt = &lastActiveAt
			}
			if err := db.Save(&memberRow).Error; err != nil {
				return err
			}
		}
	}

	return nil
}

func migrateLegacyTeamNotes(db *gorm.DB) error {
	var items []KV
	if err := db.Where("key LIKE ?", "campaign:%:team:%").Find(&items).Error; err != nil {
		return err
	}

	for _, item := range items {
		var doc TeamNoteDoc
		if err := json.Unmarshal([]byte(item.Value), &doc); err != nil {
			return err
		}
		content, err := saveJSON(doc)
		if err != nil {
			return err
		}
		activeLease, err := saveJSON(doc.ActiveLease)
		if err != nil {
			return err
		}
		updatedAt := time.UnixMilli(doc.UpdatedAt)
		if updatedAt.IsZero() {
			updatedAt = time.Now()
		}
		createdAt := time.UnixMilli(doc.CreatedAt)
		if createdAt.IsZero() {
			createdAt = updatedAt
		}
		row := V2TeamNote{
			ID:              doc.ID,
			CampaignID:      doc.CampaignID,
			Title:           doc.Title,
			Version:         maxInt(item.Version, doc.Version),
			ContentJSON:     content,
			ActiveLeaseJSON: emptyJSONObjectIfNull(activeLease),
			CreatedAt:       createdAt,
			UpdatedAt:       updatedAt,
		}
		if err := db.Save(&row).Error; err != nil {
			return err
		}
	}
	return nil
}

func migrateLegacyShares(db *gorm.DB) error {
	var items []KV
	if err := db.Where("key LIKE ?", "campaign:%:shares").Find(&items).Error; err != nil {
		return err
	}

	for _, item := range items {
		var records []SharedEntityRecord
		if err := json.Unmarshal([]byte(item.Value), &records); err != nil {
			return err
		}
		for _, record := range records {
			content, err := saveJSON(record)
			if err != nil {
				return err
			}
			activeLease, err := saveJSON(record.ActiveLease)
			if err != nil {
				return err
			}
			createdAt := time.UnixMilli(record.CreatedAt)
			updatedAt := time.UnixMilli(record.UpdatedAt)
			if createdAt.IsZero() {
				createdAt = time.Now()
			}
			if updatedAt.IsZero() {
				updatedAt = createdAt
			}

			row := V2Share{
				ID:              record.ID,
				CampaignID:      record.CampaignID,
				EntityType:      record.EntityType,
				EntityID:        record.EntityID,
				Scope:           record.Scope,
				ScopeID:         record.ScopeID,
				Permission:      record.Permission,
				TargetUserID:    record.TargetUserID,
				Version:         record.Version,
				ContentJSON:     content,
				ActiveLeaseJSON: emptyJSONObjectIfNull(activeLease),
				CreatedAt:       createdAt,
				UpdatedAt:       updatedAt,
			}
			if err := db.Save(&row).Error; err != nil {
				return err
			}
		}
	}
	return nil
}

func migrateLegacyTaskBoards(db *gorm.DB) error {
	var items []KV
	if err := db.Where("key LIKE ?", "campaign:%:task_board").Find(&items).Error; err != nil {
		return err
	}

	for _, item := range items {
		var doc SessionTaskBoardDoc
		if err := json.Unmarshal([]byte(item.Value), &doc); err != nil {
			return err
		}
		if strings.TrimSpace(doc.CampaignID) == "" {
			continue
		}
		var existing V2Campaign
		err := db.First(&existing, "id = ?", doc.CampaignID).Error
		if err == gorm.ErrRecordNotFound {
			continue
		}
		if err != nil {
			return err
		}
		content, err := saveJSON(doc.Tasks)
		if err != nil {
			return err
		}
		updatedAt := time.UnixMilli(doc.UpdatedAt)
		if updatedAt.IsZero() {
			updatedAt = time.Now()
		}
		row := V2CampaignDocument{
			ID:            doc.CampaignID + ":session_tasks",
			CampaignID:    doc.CampaignID,
			DocumentType:  "session_tasks",
			SchemaVersion: targetSchemaVersion,
			Version:       maxInt(item.Version, doc.Version),
			ContentJSON:   content,
			CreatedAt:     updatedAt,
			UpdatedAt:     updatedAt,
		}
		if err := db.Save(&row).Error; err != nil {
			return err
		}
	}
	return nil
}

func migrateLegacyVersionRecords(db *gorm.DB) error {
	var items []KV
	if err := db.Where("key LIKE ?", "campaign:%:versions").Find(&items).Error; err != nil {
		return err
	}

	for _, item := range items {
		var records []VersionRecord
		if err := json.Unmarshal([]byte(item.Value), &records); err != nil {
			return err
		}
		for idx, record := range records {
			content, err := saveJSON(record)
			if err != nil {
				return err
			}
			createdAt := time.UnixMilli(record.CreatedAt)
			if createdAt.IsZero() {
				createdAt = time.Now()
			}
			row := V2DocumentVersion{
				ID:             record.ID,
				CampaignID:     record.CampaignID,
				DocumentType:   record.DocumentType,
				DocumentID:     record.DocumentID,
				VersionNo:      len(records) - idx,
				SnapshotJSON:   content,
				OperatorUserID: record.OperatorUserID,
				CreatedAt:      createdAt,
				UpdatedAt:      createdAt,
			}
			if err := db.Save(&row).Error; err != nil {
				return err
			}
		}
	}
	return nil
}

func emptyJSONObjectIfNull(value string) string {
	if value == "null" || strings.TrimSpace(value) == "" {
		return "{}"
	}
	return value
}

func maxInt(a, b int) int {
	if a > b {
		return a
	}
	return b
}

func maxInt64(a, b int64) int64 {
	if a > b {
		return a
	}
	return b
}
