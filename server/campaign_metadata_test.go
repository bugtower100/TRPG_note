package main

import (
	"path/filepath"
	"testing"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func TestSaveCampaignConfigUpdateSynchronizesCampaignMetadata(t *testing.T) {
	dbPath := filepath.Join(t.TempDir(), "campaign-metadata.db")
	db, err := gorm.Open(sqlite.Open(dbPath), &gorm.Config{})
	if err != nil {
		t.Fatalf("open database: %v", err)
	}
	if err := db.AutoMigrate(
		&KV{},
		&V2Campaign{},
		&V2CampaignMember{},
		&V2CampaignDocument{},
	); err != nil {
		t.Fatalf("migrate database: %v", err)
	}

	created, err := createV2Campaign(db, "user-1", "GM", "旧名字", "旧描述")
	if err != nil {
		t.Fatalf("create campaign: %v", err)
	}
	cfg, err := ensureCampaignConfig(db, created.Summary.ID, "user-1", "GM", "")
	if err != nil {
		t.Fatalf("load config: %v", err)
	}
	cfg.Name = "新名字"
	cfg.Description = "新描述"
	cfg.LastModified += 1000

	if err := saveCampaignConfigUpdate(db, cfg, true); err != nil {
		t.Fatalf("save metadata update: %v", err)
	}

	var campaign V2Campaign
	if err := db.First(&campaign, "id = ?", created.Summary.ID).Error; err != nil {
		t.Fatalf("load campaign row: %v", err)
	}
	if campaign.Name != "新名字" || campaign.Description != "新描述" {
		t.Fatalf("campaign row not synchronized: %#v", campaign)
	}

	bundle, err := loadV2CampaignBundle(db, created.Summary.ID)
	if err != nil {
		t.Fatalf("load bundle: %v", err)
	}
	if bundle.Bundle.Meta["projectName"] != "新名字" {
		t.Fatalf("bundle name not synchronized: %#v", bundle.Bundle.Meta["projectName"])
	}
	if bundle.Bundle.Meta["description"] != "新描述" {
		t.Fatalf("bundle description not synchronized: %#v", bundle.Bundle.Meta["description"])
	}

	var savedConfig CampaignConfigDoc
	ok, _, err := kvLoadJSON(db, campaignConfigKey(created.Summary.ID), &savedConfig)
	if err != nil {
		t.Fatalf("load saved config: %v", err)
	}
	if !ok || savedConfig.Name != "新名字" || savedConfig.Description != "新描述" {
		t.Fatalf("config not synchronized: %#v", savedConfig)
	}

	sqlDB, err := db.DB()
	if err == nil {
		_ = sqlDB.Close()
	}
}
