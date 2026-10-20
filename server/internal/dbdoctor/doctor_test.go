package dbdoctor

import (
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

type testKV struct {
	Key       string `gorm:"primaryKey;size:255"`
	Value     string `gorm:"type:text"`
	Version   int
	CreatedAt time.Time
	UpdatedAt time.Time
}

func (testKV) TableName() string { return "kvs" }

type testAppMeta struct {
	Key       string `gorm:"primaryKey;size:191"`
	Value     string `gorm:"type:text;not null"`
	UpdatedAt time.Time
}

func (testAppMeta) TableName() string { return "app_meta" }

type testSchemaMigration struct {
	ID uint `gorm:"primaryKey"`
}

func (testSchemaMigration) TableName() string { return "schema_migrations" }

type testCampaign struct {
	ID          string `gorm:"primaryKey"`
	Name        string
	OwnerUserID string
	Visibility  string
	CreatedAt   time.Time
	UpdatedAt   time.Time
}

func (testCampaign) TableName() string { return "campaigns" }

type testCampaignMember struct {
	CampaignID   string `gorm:"primaryKey"`
	UserID       string `gorm:"primaryKey"`
	Role         string
	JoinedAt     *time.Time
	LastActiveAt *time.Time
	CreatedAt    time.Time
	UpdatedAt    time.Time
}

func (testCampaignMember) TableName() string { return "campaign_members" }

type testUser struct {
	ID string `gorm:"primaryKey"`
}

func (testUser) TableName() string { return "users" }

func createDatabaseDoctorTestDB(t *testing.T) string {
	t.Helper()
	path := filepath.Join(t.TempDir(), "storage.db")
	db, err := gorm.Open(sqlite.Open(path), &gorm.Config{})
	if err != nil {
		t.Fatalf("open test database: %v", err)
	}
	if err := db.AutoMigrate(
		&testKV{}, &testAppMeta{}, &testSchemaMigration{}, &testUser{}, &testCampaign{}, &testCampaignMember{},
	); err != nil {
		t.Fatalf("migrate test database: %v", err)
	}
	for _, statement := range []string{
		`CREATE TABLE campaign_documents (id TEXT PRIMARY KEY, campaign_id TEXT, content_json TEXT)`,
		`CREATE TABLE campaign_configs (campaign_id TEXT PRIMARY KEY, content_json TEXT)`,
		`CREATE TABLE team_notes (id TEXT PRIMARY KEY, campaign_id TEXT, content_json TEXT, active_lease_json TEXT)`,
		`CREATE TABLE shares (id TEXT PRIMARY KEY, campaign_id TEXT, content_json TEXT, active_lease_json TEXT)`,
		`CREATE TABLE document_versions (id TEXT PRIMARY KEY, campaign_id TEXT, snapshot_json TEXT)`,
		`CREATE TABLE resource_index (id TEXT PRIMARY KEY)`,
	} {
		if err := db.Exec(statement).Error; err != nil {
			t.Fatalf("create test table: %v", err)
		}
	}
	for key, value := range map[string]string{
		"schema_version":           "2",
		"migration_target_version": "2",
		"migration_state":          "ready",
	} {
		if err := db.Create(&testAppMeta{Key: key, Value: value}).Error; err != nil {
			t.Fatalf("create app meta: %v", err)
		}
	}
	sqlDB, err := db.DB()
	if err != nil {
		t.Fatalf("get sql database: %v", err)
	}
	if err := sqlDB.Close(); err != nil {
		t.Fatalf("close test database: %v", err)
	}
	return path
}

func TestDatabaseDoctorRepairsMissingOwnerMembership(t *testing.T) {
	path := createDatabaseDoctorTestDB(t)
	db, err := gorm.Open(sqlite.Open(path), &gorm.Config{})
	if err != nil {
		t.Fatalf("open test database: %v", err)
	}
	now := time.Now()
	if err := db.Create(&testCampaign{
		ID: "campaign-1", Name: "失踪模组", OwnerUserID: "user-1", Visibility: "private", CreatedAt: now, UpdatedAt: now,
	}).Error; err != nil {
		t.Fatalf("create campaign: %v", err)
	}
	sqlDB, _ := db.DB()
	_ = sqlDB.Close()

	report, err := Inspect(path)
	if err != nil {
		t.Fatalf("inspect database: %v", err)
	}
	if !hasDatabaseDoctorIssue(report, "missing_owner_membership") {
		t.Fatalf("expected missing owner membership issue: %#v", report.Issues)
	}

	_, _, _, err = Repair(path)
	if err != nil {
		t.Fatalf("repair database: %v", err)
	}
	report, err = Inspect(path)
	if err != nil {
		t.Fatalf("inspect repaired database: %v", err)
	}
	if len(report.Issues) != 0 {
		t.Fatal("expected database to be healthy after repair")
	}

	db, err = gorm.Open(sqlite.Open(path), &gorm.Config{})
	if err != nil {
		t.Fatalf("reopen test database: %v", err)
	}
	var member testCampaignMember
	if err := db.First(&member, "campaign_id = ? AND user_id = ?", "campaign-1", "user-1").Error; err != nil {
		t.Fatalf("load repaired membership: %v", err)
	}
	if member.Role != "owner" {
		t.Fatalf("expected owner role, got %q", member.Role)
	}
	sqlDB, err = db.DB()
	if err != nil {
		t.Fatalf("get repaired sql database: %v", err)
	}
	if err := sqlDB.Close(); err != nil {
		t.Fatalf("close repaired database: %v", err)
	}
	backups, err := filepath.Glob(filepath.Join(filepath.Dir(path), "database-doctor-backups", "*.bak"))
	if err != nil || len(backups) != 1 {
		t.Fatalf("expected one repair backup, backups=%v err=%v", backups, err)
	}
}

func TestDatabaseDoctorReportsInvalidJSONWithoutChangingIt(t *testing.T) {
	path := createDatabaseDoctorTestDB(t)
	db, err := gorm.Open(sqlite.Open(path), &gorm.Config{})
	if err != nil {
		t.Fatalf("open test database: %v", err)
	}
	if err := db.Create(&testKV{Key: "broken", Value: "{not-json", Version: 1}).Error; err != nil {
		t.Fatalf("create broken kv: %v", err)
	}
	sqlDB, _ := db.DB()
	_ = sqlDB.Close()

	report, err := Inspect(path)
	if err != nil {
		t.Fatalf("inspect database: %v", err)
	}
	if !hasDatabaseDoctorIssue(report, "invalid_json") {
		t.Fatalf("expected invalid JSON issue: %#v", report.Issues)
	}
	_, _, _, err = Repair(path)
	if err != nil {
		t.Fatalf("repair database: %v", err)
	}
	report, err = Inspect(path)
	if err != nil {
		t.Fatalf("inspect repaired database: %v", err)
	}
	if !hasDatabaseDoctorIssue(report, "invalid_json") {
		t.Fatal("invalid JSON should remain for manual recovery")
	}
	data, err := os.ReadFile(path)
	if err != nil || len(data) == 0 {
		t.Fatalf("database should remain present: bytes=%d err=%v", len(data), err)
	}
}

func hasDatabaseDoctorIssue(report Report, code string) bool {
	for _, issue := range report.Issues {
		if issue.Code == code {
			return true
		}
	}
	return false
}
