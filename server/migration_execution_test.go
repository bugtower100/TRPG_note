package main

import (
	"encoding/json"
	"path/filepath"
	"testing"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func openMigrationTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	dbPath := filepath.Join(t.TempDir(), "migration-test.db")
	db, err := gorm.Open(sqlite.Open(dbPath), &gorm.Config{})
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	if err := db.AutoMigrate(
		&KV{},
		&V2Campaign{},
		&V2CampaignMember{},
		&V2CampaignDocument{},
		&V2CampaignConfig{},
	); err != nil {
		t.Fatalf("auto migrate: %v", err)
	}
	return db
}

func mustSaveJSONForTest(t *testing.T, value any) string {
	t.Helper()
	raw, err := json.Marshal(value)
	if err != nil {
		t.Fatalf("marshal json: %v", err)
	}
	return string(raw)
}

func insertKVForTest(t *testing.T, db *gorm.DB, key string, value any, version int) {
	t.Helper()
	row := KV{
		Key:     key,
		Value:   mustSaveJSONForTest(t, value),
		Version: version,
	}
	if err := db.Save(&row).Error; err != nil {
		t.Fatalf("save kv %s: %v", key, err)
	}
}

func TestMigrateLegacyCampaignConfigsSkipsConfigOnlyCampaign(t *testing.T) {
	db := openMigrationTestDB(t)

	insertKVForTest(t, db, "trpg_u_user-1_campaign_index", []map[string]any{
		{"id": "valid-campaign", "name": "Valid Campaign"},
	}, 1)

	insertKVForTest(t, db, "trpg_u_user-1_campaign_valid-campaign", map[string]any{
		"meta": map[string]any{
			"projectName":  "Valid Campaign",
			"description":  "bundle-backed",
			"lastModified": float64(1710000000000),
		},
		"notes":          "",
		"characters":     []map[string]any{},
		"locations":      []map[string]any{},
		"organizations":  []map[string]any{},
		"events":         []map[string]any{},
		"clues":          []map[string]any{},
		"timelines":      []map[string]any{},
		"monsters":       []map[string]any{},
		"sessionTasks":   []map[string]any{},
		"relationGraphs": []map[string]any{},
	}, 3)

	insertKVForTest(t, db, campaignConfigKey("valid-campaign"), CampaignConfigDoc{
		CampaignID:    "valid-campaign",
		Name:          "Valid Campaign",
		OwnerUserID:   "user-1",
		Visibility:    "private",
		SchemaVersion: 2,
		Members: []CampaignMember{
			{UserID: "user-1", Username: "user-1", Role: "GM"},
		},
	}, 4)

	insertKVForTest(t, db, campaignConfigKey("orphan-config"), CampaignConfigDoc{
		CampaignID:    "orphan-config",
		Name:          "Not A Main Campaign",
		OwnerUserID:   "user-1",
		Visibility:    "private",
		SchemaVersion: 2,
		Members: []CampaignMember{
			{UserID: "user-1", Username: "user-1", Role: "GM"},
		},
	}, 2)

	if err := migrateLegacyCampaignBundles(db); err != nil {
		t.Fatalf("migrate bundle: %v", err)
	}
	if err := migrateLegacyCampaignConfigs(db); err != nil {
		t.Fatalf("migrate config: %v", err)
	}

	var campaigns []V2Campaign
	if err := db.Order("id asc").Find(&campaigns).Error; err != nil {
		t.Fatalf("query campaigns: %v", err)
	}
	if len(campaigns) != 1 {
		t.Fatalf("expected 1 migrated campaign, got %d", len(campaigns))
	}
	if campaigns[0].ID != "valid-campaign" {
		t.Fatalf("unexpected campaign id: %s", campaigns[0].ID)
	}

	var orphanConfigRows int64
	if err := db.Model(&V2CampaignConfig{}).Where("campaign_id = ?", "orphan-config").Count(&orphanConfigRows).Error; err != nil {
		t.Fatalf("count orphan config rows: %v", err)
	}
	if orphanConfigRows != 0 {
		t.Fatalf("expected orphan config row to be skipped, got %d", orphanConfigRows)
	}
}

func TestMigrateLegacyTaskBoardsStoresTaskArray(t *testing.T) {
	db := openMigrationTestDB(t)

	insertKVForTest(t, db, "trpg_u_user-1_campaign_index", []map[string]any{
		{"id": "valid-campaign", "name": "Valid Campaign"},
	}, 1)

	insertKVForTest(t, db, "trpg_u_user-1_campaign_valid-campaign", map[string]any{
		"meta": map[string]any{
			"projectName":  "Valid Campaign",
			"description":  "bundle-backed",
			"lastModified": float64(1710000000000),
		},
		"notes":          "",
		"characters":     []map[string]any{},
		"locations":      []map[string]any{},
		"organizations":  []map[string]any{},
		"events":         []map[string]any{},
		"clues":          []map[string]any{},
		"timelines":      []map[string]any{},
		"monsters":       []map[string]any{},
		"sessionTasks":   []map[string]any{},
		"relationGraphs": []map[string]any{},
	}, 1)

	insertKVForTest(t, db, taskBoardKey("valid-campaign"), SessionTaskBoardDoc{
		CampaignID: "valid-campaign",
		Tasks: []SessionTaskItem{
			{ID: "task-1", Title: "Investigate", Status: "todo"},
		},
		Version:   5,
		UpdatedAt: 1710000001000,
	}, 5)

	if err := migrateLegacyCampaignBundles(db); err != nil {
		t.Fatalf("migrate bundle: %v", err)
	}
	if err := migrateLegacyTaskBoards(db); err != nil {
		t.Fatalf("migrate task board: %v", err)
	}

	var doc V2CampaignDocument
	if err := db.First(&doc, "campaign_id = ? AND document_type = ?", "valid-campaign", "session_tasks").Error; err != nil {
		t.Fatalf("query session_tasks document: %v", err)
	}

	var tasks []map[string]any
	if err := json.Unmarshal([]byte(doc.ContentJSON), &tasks); err != nil {
		t.Fatalf("session_tasks should be stored as array, got error: %v", err)
	}
	if len(tasks) != 1 {
		t.Fatalf("expected 1 task after migration, got %d", len(tasks))
	}
	if tasks[0]["id"] != "task-1" {
		t.Fatalf("unexpected migrated task id: %v", tasks[0]["id"])
	}
}

func TestMigrateLegacyCampaignBundlesUsesCampaignIndex(t *testing.T) {
	db := openMigrationTestDB(t)

	insertKVForTest(t, db, "trpg_u_user-1_campaign_index", []map[string]any{
		{"id": "active-campaign", "name": "Active Campaign"},
	}, 1)

	insertKVForTest(t, db, "trpg_u_user-1_campaign_active-campaign", map[string]any{
		"meta": map[string]any{
			"projectName":  "Active Campaign",
			"description":  "should migrate",
			"lastModified": float64(1710000000000),
		},
		"notes":          "",
		"characters":     []map[string]any{},
		"locations":      []map[string]any{},
		"organizations":  []map[string]any{},
		"events":         []map[string]any{},
		"clues":          []map[string]any{},
		"timelines":      []map[string]any{},
		"monsters":       []map[string]any{},
		"sessionTasks":   []map[string]any{},
		"relationGraphs": []map[string]any{},
	}, 1)

	insertKVForTest(t, db, "trpg_u_user-1_campaign_deleted-campaign", map[string]any{
		"meta": map[string]any{
			"projectName":  "Deleted Campaign",
			"description":  "should not migrate",
			"lastModified": float64(1710000000001),
		},
		"notes":          "",
		"characters":     []map[string]any{},
		"locations":      []map[string]any{},
		"organizations":  []map[string]any{},
		"events":         []map[string]any{},
		"clues":          []map[string]any{},
		"timelines":      []map[string]any{},
		"monsters":       []map[string]any{},
		"sessionTasks":   []map[string]any{},
		"relationGraphs": []map[string]any{},
	}, 1)

	if err := migrateLegacyCampaignBundles(db); err != nil {
		t.Fatalf("migrate bundle: %v", err)
	}

	var campaigns []V2Campaign
	if err := db.Order("id asc").Find(&campaigns).Error; err != nil {
		t.Fatalf("query campaigns: %v", err)
	}
	if len(campaigns) != 1 {
		t.Fatalf("expected only active campaign to migrate, got %d", len(campaigns))
	}
	if campaigns[0].ID != "active-campaign" {
		t.Fatalf("unexpected migrated campaign id: %s", campaigns[0].ID)
	}
}
