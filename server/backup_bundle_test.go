package main

import (
	"testing"
	"time"
)

func TestLoadExportableCampaignSummariesFallsBackToV2Campaigns(t *testing.T) {
	db := openMigrationTestDB(t)
	now := time.Now()

	campaign := V2Campaign{
		ID:          "cmp-v2-only",
		Name:        "V2 Only Campaign",
		Description: "from v2 tables",
		OwnerUserID: "user-1",
		Visibility:  "private",
		CreatedAt:   now,
		UpdatedAt:   now,
	}
	member := V2CampaignMember{
		CampaignID: campaign.ID,
		UserID:     "user-1",
		Role:       "owner",
		CreatedAt:  now,
		UpdatedAt:  now,
	}
	joinedAt := now
	member.JoinedAt = &joinedAt
	member.LastActiveAt = &joinedAt

	if err := db.Save(&campaign).Error; err != nil {
		t.Fatalf("save campaign: %v", err)
	}
	if err := db.Save(&member).Error; err != nil {
		t.Fatalf("save member: %v", err)
	}

	summaries, err := loadExportableCampaignSummaries(db, "user-1")
	if err != nil {
		t.Fatalf("load exportable summaries: %v", err)
	}
	if len(summaries) != 1 {
		t.Fatalf("expected 1 summary, got %d", len(summaries))
	}
	if summaries[0].ID != campaign.ID || summaries[0].Name != campaign.Name {
		t.Fatalf("unexpected summary: %#v", summaries[0])
	}
}

func TestBuildBackupCampaignBundleFallsBackToV2Bundle(t *testing.T) {
	db := openMigrationTestDB(t)
	now := time.Now()

	campaign := V2Campaign{
		ID:          "cmp-v2-export",
		Name:        "Export From V2",
		Description: "bundle backed only",
		OwnerUserID: "user-1",
		Visibility:  "private",
		CreatedAt:   now,
		UpdatedAt:   now,
	}
	member := V2CampaignMember{
		CampaignID: campaign.ID,
		UserID:     "user-1",
		Role:       "owner",
		CreatedAt:  now,
		UpdatedAt:  now,
	}
	joinedAt := now
	member.JoinedAt = &joinedAt
	member.LastActiveAt = &joinedAt

	if err := db.Save(&campaign).Error; err != nil {
		t.Fatalf("save campaign: %v", err)
	}
	if err := db.Save(&member).Error; err != nil {
		t.Fatalf("save member: %v", err)
	}

	bundle := defaultV2Bundle(campaign.ID)
	bundle.Meta["projectName"] = campaign.Name
	bundle.Meta["description"] = campaign.Description
	bundle.Characters = []map[string]any{{"id": "char-1", "name": "Alice"}}
	bundle.RelationGraphs = []map[string]any{{"id": "graph-1"}}
	if _, err := saveV2CampaignBundle(db, campaign.ID, V2CampaignBundleUpdateRequest{
		ExpectedVersion: 0,
		Bundle:          bundle,
	}); err != nil {
		t.Fatalf("save v2 bundle: %v", err)
	}

	backupItem, err := buildBackupCampaignBundle(db, "user-1", campaign.ID)
	if err != nil {
		t.Fatalf("build backup bundle: %v", err)
	}

	payload, ok := backupItem.CampaignData.(map[string]any)
	if !ok {
		t.Fatalf("expected backup payload map, got %#v", backupItem.CampaignData)
	}
	if payload["id"] != campaign.ID {
		t.Fatalf("expected id %s, got %#v", campaign.ID, payload["id"])
	}
	meta, _ := payload["meta"].(map[string]any)
	if meta["projectName"] != campaign.Name {
		t.Fatalf("expected projectName %q, got %#v", campaign.Name, meta["projectName"])
	}
	characters, _ := payload["characters"].([]map[string]any)
	if len(characters) != 1 {
		t.Fatalf("expected 1 character, got %#v", payload["characters"])
	}
}
