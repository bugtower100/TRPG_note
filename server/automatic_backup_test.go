package main

import (
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func TestAutomaticBackupDefaultsAndRetention(t *testing.T) {
	dir := t.TempDir()
	dbPath := filepath.Join(dir, "storage.db")
	db, err := gorm.Open(sqlite.Open(dbPath), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	sqlDB, err := db.DB()
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = sqlDB.Close() })
	if err := db.AutoMigrate(&AppMeta{}, &KV{}); err != nil {
		t.Fatal(err)
	}
	manager, err := newAutomaticBackupManager(db, Config{DBPath: dbPath})
	if err != nil {
		t.Fatal(err)
	}
	settings, err := manager.loadSettings()
	if err != nil {
		t.Fatal(err)
	}
	if !settings.Enabled || settings.IntervalMinutes != 60 || settings.RetentionDays != 3 || settings.MaxBackups != 5 {
		t.Fatalf("unexpected defaults: %#v", settings)
	}
	settings.MaxBackups = 1
	if err := manager.saveSettings(settings); err != nil {
		t.Fatal(err)
	}
	if _, err := manager.createBackup(); err != nil {
		t.Fatal(err)
	}
	if _, err := manager.createBackup(); err != nil {
		t.Fatal(err)
	}
	files, err := manager.listFiles()
	if err != nil {
		t.Fatal(err)
	}
	if len(files) != 1 {
		t.Fatalf("expected one retained backup, got %d", len(files))
	}
	backupPath := filepath.Join(manager.backupDir, files[0].Name)
	if info, err := os.Stat(backupPath); err != nil || info.Size() == 0 {
		t.Fatalf("invalid backup file: info=%v err=%v", info, err)
	}
}

func TestAutomaticBackupPrunesExpiredFiles(t *testing.T) {
	dir := t.TempDir()
	manager := &automaticBackupManager{backupDir: dir}
	oldPath := filepath.Join(dir, "storage-auto-20200101-000000.000000000.db")
	if err := os.WriteFile(oldPath, []byte("old"), 0o644); err != nil {
		t.Fatal(err)
	}
	oldTime := time.Now().Add(-48 * time.Hour)
	if err := os.Chtimes(oldPath, oldTime, oldTime); err != nil {
		t.Fatal(err)
	}
	if err := manager.prune(automaticBackupSettings{Enabled: true, IntervalMinutes: 60, RetentionDays: 1, MaxBackups: 10}); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(oldPath); !os.IsNotExist(err) {
		t.Fatalf("expired backup was not removed: %v", err)
	}
}

func TestAutomaticBackupRequiresAtLeastOneRetentionLimit(t *testing.T) {
	_, err := normalizeAutomaticBackupSettings(automaticBackupSettings{Enabled: true, IntervalMinutes: 60})
	if err == nil {
		t.Fatal("both retention limits disabled must be rejected")
	}
}
