package main

import "testing"

func TestV2BundlePersistsAndRedactsGameSessions(t *testing.T) {
	db := openMigrationTestDB(t)
	sqlDB, err := db.DB()
	if err != nil {
		t.Fatalf("open sql db: %v", err)
	}
	defer sqlDB.Close()
	campaignID := "campaign-game-sessions"
	bundle := defaultV2Bundle(campaignID)
	bundle.GameSessions = []map[string]any{{
		"id":            "session-1",
		"title":         "第 1 次跑团",
		"sessionNumber": 1,
		"status":        "preparing",
		"liveNotes":     "GM 私有现场记录",
	}, {
		"id":                     "session-2",
		"title":                  "第 2 次跑团",
		"sessionNumber":          2,
		"scheduledAt":            "2026-09-03T19:30",
		"inWorldDate":            "霜月 12 日",
		"status":                 "completed",
		"summary":                "GM 私有简介",
		"liveNotes":              "GM 私有现场记录 2",
		"gmSummary":              "GM 私有总结",
		"futureGMField":          "未来新增的私有字段",
		"playerRecap":            "玩家可以看到的回顾",
		"playerRecapPublishedAt": int64(1788404401000),
		"createdAt":              int64(1788318000000),
		"updatedAt":              int64(1788404401000),
	}}

	saved, err := saveV2CampaignBundle(db, campaignID, V2CampaignBundleUpdateRequest{
		ExpectedVersion: 1,
		Bundle:          bundle,
	})
	if err != nil {
		t.Fatalf("save bundle: %v", err)
	}
	if len(saved.Bundle.GameSessions) != 2 {
		t.Fatalf("expected two saved game sessions, got %d", len(saved.Bundle.GameSessions))
	}
	if saved.Bundle.GameSessions[0]["id"] != "session-1" {
		t.Fatalf("unexpected saved game session: %#v", saved.Bundle.GameSessions[0])
	}

	loaded, err := loadV2CampaignBundle(db, campaignID)
	if err != nil {
		t.Fatalf("load bundle: %v", err)
	}
	if len(loaded.Bundle.GameSessions) != 2 || loaded.Bundle.GameSessions[0]["liveNotes"] != "GM 私有现场记录" {
		t.Fatalf("game session did not round trip: %#v", loaded.Bundle.GameSessions)
	}

	redacted := redactV2CampaignBundleForPL(loaded)
	if len(redacted.Bundle.GameSessions) != 1 {
		t.Fatalf("PL bundle must contain only published sessions: %#v", redacted.Bundle.GameSessions)
	}
	playerSession := redacted.Bundle.GameSessions[0]
	if playerSession["id"] != "session-2" || playerSession["playerRecap"] != "玩家可以看到的回顾" {
		t.Fatalf("unexpected published session: %#v", playerSession)
	}
	if playerSession["summary"] != "" || playerSession["liveNotes"] != "" || playerSession["gmSummary"] != "" {
		t.Fatalf("PL bundle exposed GM-only session fields: %#v", playerSession)
	}
	if _, exists := playerSession["futureGMField"]; exists {
		t.Fatalf("PL bundle exposed a non-whitelisted session field: %#v", playerSession)
	}
	if refs, ok := playerSession["resourceRefs"].([]map[string]any); !ok || len(refs) != 0 {
		t.Fatalf("PL bundle must not expose session resources: %#v", playerSession["resourceRefs"])
	}
}

func TestGameSessionsSurviveBackupConversion(t *testing.T) {
	bundle := defaultV2Bundle("campaign-backup-game-sessions")
	bundle.GameSessions = []map[string]any{{
		"id":     "session-backup-1",
		"title":  "备份场次",
		"status": "completed",
	}}

	legacy := buildLegacyCampaignDataFromV2(bundle)
	imported, err := buildImportedV2Bundle(bundle.ID, legacy)
	if err != nil {
		t.Fatalf("build imported bundle: %v", err)
	}
	if len(imported.GameSessions) != 1 || imported.GameSessions[0]["id"] != "session-backup-1" {
		t.Fatalf("game session did not survive backup conversion: %#v", imported.GameSessions)
	}
}
