package main

import (
	"encoding/json"
	"testing"
	"time"
)

func requireSameJSON(t *testing.T, got, want any) {
	t.Helper()
	gotJSON, err := json.Marshal(got)
	if err != nil {
		t.Fatalf("marshal actual value: %v", err)
	}
	wantJSON, err := json.Marshal(want)
	if err != nil {
		t.Fatalf("marshal expected value: %v", err)
	}
	if string(gotJSON) != string(wantJSON) {
		t.Fatalf("JSON values differ: got %s, want %s", gotJSON, wantJSON)
	}
}

func TestV2MindMapsRoundTripAndPLRedaction(t *testing.T) {
	db := openMigrationTestDB(t)
	sqlDB, err := db.DB()
	if err != nil {
		t.Fatalf("get sql database: %v", err)
	}
	defer sqlDB.Close()

	campaignID := "campaign-with-mind-map"
	bundle := defaultV2Bundle(campaignID)
	bundle.MindMaps = []map[string]any{
		{
			"id":              "mind-map-1",
			"name":            "Main Plot",
			"rootNodeId":      "node-root",
			"layoutDirection": "LR",
			"nodes": []map[string]any{
				{
					"id":           "node-root",
					"parentId":     nil,
					"title":        "Opening",
					"content":      "Meet Alice",
					"siblingOrder": 0,
					"collapsed":    false,
					"entityRef": map[string]any{
						"entityType": "characters",
						"entityId":   "character-alice",
					},
					"entityRefs": []any{
						map[string]any{"entityType": "characters", "entityId": "character-alice"},
						map[string]any{"entityType": "locations", "entityId": "location-1"},
					},
					"position":          map[string]any{"x": 120, "y": -40},
					"incomingEdgeLabel": "追查",
				},
			},
		},
	}

	saved, err := saveV2CampaignBundle(db, campaignID, V2CampaignBundleUpdateRequest{
		ExpectedVersion: 0,
		Bundle:          bundle,
	})
	if err != nil {
		t.Fatalf("save bundle: %v", err)
	}
	requireSameJSON(t, saved.Bundle.MindMaps, bundle.MindMaps)

	var document V2CampaignDocument
	if err := db.First(&document, "campaign_id = ? AND document_type = ?", campaignID, "mind_maps").Error; err != nil {
		t.Fatalf("load mind_maps document: %v", err)
	}

	redacted := redactV2CampaignBundleForPL(saved)
	if len(redacted.Bundle.MindMaps) != 0 {
		t.Fatalf("PL response should not contain mind maps: %#v", redacted.Bundle.MindMaps)
	}
	if len(saved.Bundle.MindMaps) != 1 {
		t.Fatal("redaction mutated the original response")
	}
}

func TestMindMapHistoryDocumentRoundTripAndExportIsolation(t *testing.T) {
	db := openMigrationTestDB(t)
	sqlDB, err := db.DB()
	if err != nil {
		t.Fatalf("get sql database: %v", err)
	}
	defer sqlDB.Close()

	campaignID := "campaign-with-mind-map-history"
	history := defaultMindMapHistoryDocument(campaignID)
	history.Histories["mind-map-1"] = MindMapHistoryState{
		Past:   []map[string]any{{"id": "mind-map-1", "name": "Before"}},
		Future: []map[string]any{},
	}
	if err := saveMindMapHistoryDocument(db, campaignID, history); err != nil {
		t.Fatalf("save mind map history: %v", err)
	}
	loaded, err := loadMindMapHistoryDocument(db, campaignID)
	if err != nil {
		t.Fatalf("load mind map history: %v", err)
	}
	if len(loaded.Histories["mind-map-1"].Past) != 1 {
		t.Fatalf("history did not round trip: %#v", loaded)
	}

	oversizedPast := make([]map[string]any, mindMapHistoryLimit+5)
	for index := range oversizedPast {
		oversizedPast[index] = map[string]any{"id": index}
	}
	updated, err := updateMindMapHistoryDocument(db, campaignID, MindMapHistoryUpdateRequest{
		ExpectedVersion: loaded.Version,
		Histories: map[string]MindMapHistoryState{
			"mind-map-1": {Past: oversizedPast},
		},
	})
	if err != nil {
		t.Fatalf("update mind map history: %v", err)
	}
	if len(updated.Histories["mind-map-1"].Past) != mindMapHistoryLimit {
		t.Fatalf("history limit was not enforced: %#v", updated.Histories["mind-map-1"])
	}
	if _, err := updateMindMapHistoryDocument(db, campaignID, MindMapHistoryUpdateRequest{
		ExpectedVersion: loaded.Version,
		Histories:       updated.Histories,
	}); err == nil {
		t.Fatal("stale history version should cause a conflict")
	} else if _, ok := err.(*MindMapHistoryConflictError); !ok {
		t.Fatalf("expected history conflict error, got %T: %v", err, err)
	}

	legacy := buildLegacyCampaignDataFromV2(defaultV2Bundle(campaignID))
	if _, exists := legacy["mindMapHistory"]; exists {
		t.Fatal("ordinary campaign export must not contain mind map history")
	}
}

func TestMindMapCampaignManagerRoleBoundary(t *testing.T) {
	if !isCampaignManagerRole(campaignRoleGM) {
		t.Fatal("GM should be allowed to manage mind maps")
	}
	if !isCampaignManagerRole(campaignRoleAssistantGM) {
		t.Fatal("assistant GM should be allowed to manage mind maps")
	}
	if isCampaignManagerRole(campaignRolePL) {
		t.Fatal("PL should not be allowed to manage mind maps")
	}
	if isCampaignManagerRole("") {
		t.Fatal("missing role should not be allowed to manage mind maps")
	}
}

func TestMindMapsBackupConversionAndOldBackupCompatibility(t *testing.T) {
	bundle := defaultV2Bundle("campaign-1")
	bundle.MindMaps = []map[string]any{{"id": "mind-map-1", "name": "Plot"}}

	legacy := buildLegacyCampaignDataFromV2(bundle)
	counts := extractCollectionCounts(legacy)
	if counts["mindMaps"] != 1 {
		t.Fatalf("expected mind map count 1, got %d", counts["mindMaps"])
	}

	imported, err := buildImportedV2Bundle("campaign-2", legacy)
	if err != nil {
		t.Fatalf("build imported bundle: %v", err)
	}
	requireSameJSON(t, imported.MindMaps, bundle.MindMaps)

	oldBackup := map[string]any{
		"meta":       map[string]any{"projectName": "Old Campaign"},
		"characters": []any{},
	}
	importedOld, err := buildImportedV2Bundle("campaign-old", oldBackup)
	if err != nil {
		t.Fatalf("build old imported bundle: %v", err)
	}
	if importedOld.MindMaps == nil || len(importedOld.MindMaps) != 0 {
		t.Fatalf("old backup should normalize to an empty mind map collection: %#v", importedOld.MindMaps)
	}
}

func TestBackupPrefersV2MindMapsOverStaleLegacyPayload(t *testing.T) {
	db := openMigrationTestDB(t)
	sqlDB, err := db.DB()
	if err != nil {
		t.Fatalf("get sql database: %v", err)
	}
	defer sqlDB.Close()

	now := time.Now()
	campaignID := "campaign-with-stale-legacy-copy"
	userID := "user-1"
	campaign := V2Campaign{
		ID:          campaignID,
		Name:        "Current Campaign",
		OwnerUserID: userID,
		Visibility:  "private",
		CreatedAt:   now,
		UpdatedAt:   now,
	}
	member := V2CampaignMember{
		CampaignID: campaignID,
		UserID:     userID,
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
	if _, err := kvSaveJSON(db, userCampaignKey(userID, campaignID), map[string]any{
		"id":       campaignID,
		"meta":     map[string]any{"projectName": "Stale Campaign"},
		"mindMaps": []any{},
	}); err != nil {
		t.Fatalf("save stale legacy payload: %v", err)
	}

	bundle := defaultV2Bundle(campaignID)
	bundle.MindMaps = []map[string]any{{"id": "mind-map-current", "name": "Current Plot"}}
	if _, err := saveV2CampaignBundle(db, campaignID, V2CampaignBundleUpdateRequest{
		ExpectedVersion: 0,
		Bundle:          bundle,
	}); err != nil {
		t.Fatalf("save v2 bundle: %v", err)
	}

	payload, err := loadCampaignPayloadForBackup(db, userID, campaignID)
	if err != nil {
		t.Fatalf("load backup payload: %v", err)
	}
	if count := extractCollectionCounts(payload)["mindMaps"]; count != 1 {
		t.Fatalf("backup used stale legacy payload, mind map count is %d", count)
	}
}
