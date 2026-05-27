package main

import (
	"path/filepath"
	"testing"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func openFoundationTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	dbPath := filepath.Join(t.TempDir(), "foundation-test.db")
	db, err := gorm.Open(sqlite.Open(dbPath), &gorm.Config{})
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	if err := db.AutoMigrate(&KV{}, &AppMeta{}, &SchemaMigration{}); err != nil {
		t.Fatalf("migrate foundation tables: %v", err)
	}
	return db
}

func TestEnsureReadyV2SchemaTablesBootstrapsFreshDatabase(t *testing.T) {
	db := openFoundationTestDB(t)

	if err := ensureMigrationFoundation(db); err != nil {
		t.Fatalf("ensure migration foundation: %v", err)
	}
	if err := ensureReadyV2SchemaTables(db); err != nil {
		t.Fatalf("ensure ready v2 schema tables: %v", err)
	}

	items, err := listV2Campaigns(db, "user-new-1")
	if err != nil {
		t.Fatalf("list v2 campaigns: %v", err)
	}
	if len(items) != 0 {
		t.Fatalf("expected no campaigns for fresh database, got %d", len(items))
	}
}

func TestEnsureReadyV2SchemaTablesSkipsLegacyDatabaseAwaitingMigration(t *testing.T) {
	db := openFoundationTestDB(t)

	if err := db.Create(&KV{
		Key:   "trpg_u_legacy_user_profile",
		Value: `{"id":"legacy-user","username":"legacy"}`,
	}).Error; err != nil {
		t.Fatalf("seed legacy kv: %v", err)
	}

	if err := ensureMigrationFoundation(db); err != nil {
		t.Fatalf("ensure migration foundation: %v", err)
	}
	if err := ensureReadyV2SchemaTables(db); err != nil {
		t.Fatalf("ensure ready v2 schema tables: %v", err)
	}

	if db.Migrator().HasTable((&V2Campaign{}).TableName()) {
		t.Fatalf("v2 campaign table should not be created before explicit migration")
	}
}
