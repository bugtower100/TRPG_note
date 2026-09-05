package main

import (
	"archive/zip"
	"bytes"
	"testing"
)

func TestPrepPackageArchiveRoundTrip(t *testing.T) {
	content := prepPackageContent{Characters: []map[string]any{{"id": "character-a", "name": "角色 A"}}}
	manifest := prepPackageManifest{Format: prepPackageFormat, SchemaVersion: prepPackageSchemaVersion, Name: "测试包"}
	var buffer bytes.Buffer
	writer := zip.NewWriter(&buffer)
	if err := writeJSONZipEntry(writer, "manifest.json", manifest); err != nil {
		t.Fatal(err)
	}
	if err := writeJSONZipEntry(writer, "content.json", content); err != nil {
		t.Fatal(err)
	}
	if err := writer.Close(); err != nil {
		t.Fatal(err)
	}
	packageFormat, err := readTRPGPackageFormat(buffer.Bytes())
	if err != nil || packageFormat != prepPackageFormat {
		t.Fatalf("unexpected package format %q: %v", packageFormat, err)
	}

	parsedManifest, parsedContent, _, err := parsePrepPackage(buffer.Bytes())
	if err != nil {
		t.Fatal(err)
	}
	if parsedManifest.Name != "测试包" || len(parsedContent.Characters) != 1 {
		t.Fatalf("unexpected parsed package: %#v %#v", parsedManifest, parsedContent)
	}
}

func TestRemapPrepReferencesDropsUnselectedLinks(t *testing.T) {
	content := prepPackageContent{
		Characters: []map[string]any{{
			"id": "character-a",
			"relations": []any{
				map[string]any{"id": "location-a", "targetType": "location"},
				map[string]any{"id": "location-missing", "targetType": "location"},
			},
		}},
		Locations: []map[string]any{{"id": "location-a"}},
		GameSessions: []map[string]any{{
			"id": "session-a", "taskIds": []any{"task-a"}, "participantUserIds": []any{"user-old"},
			"resourceRefs": []any{
				map[string]any{"entityId": "character-a", "entityType": "characters"},
				map[string]any{"entityId": "character-missing", "entityType": "characters"},
			},
		}},
	}
	ids := remapPrepEntityCollections(&content, map[string]string{})
	remapPrepReferences(&content, ids, map[string]string{}, "user-new", "新用户")

	relations, ok := content.Characters[0]["relations"].([]any)
	if !ok || len(relations) != 1 {
		t.Fatalf("expected one retained relation, got %#v", content.Characters[0]["relations"])
	}
	refs, ok := content.GameSessions[0]["resourceRefs"].([]any)
	if !ok || len(refs) != 1 {
		t.Fatalf("expected one retained session reference, got %#v", content.GameSessions[0]["resourceRefs"])
	}
	if tasks, ok := content.GameSessions[0]["taskIds"].([]string); !ok || len(tasks) != 0 {
		t.Fatalf("task references were not cleared: %#v", content.GameSessions[0]["taskIds"])
	}
	if participants, ok := content.GameSessions[0]["participantUserIds"].([]string); !ok || len(participants) != 0 {
		t.Fatalf("participant references were not cleared: %#v", content.GameSessions[0]["participantUserIds"])
	}
}

func TestPreparePrepImportOverwritesSameNameAndMarksAdditions(t *testing.T) {
	content := prepPackageContent{
		Characters: []map[string]any{
			{"id": "incoming-alice", "name": "Alice"},
			{"id": "incoming-bob", "name": "Bob"},
		},
		CharacterSheets: []CharacterSheetDocument{{ID: "incoming-sheet", Name: "Alice 卡"}},
		LocationMaps:    []LocationMap{{ID: "incoming-map", Name: "港口"}},
	}
	current := prepPackageContent{
		Characters: []map[string]any{
			{"id": "current-alice", "name": "Alice"},
			{"id": "current-bob", "name": "Bob（导入新增）"},
		},
		CharacterSheets: []CharacterSheetDocument{{ID: "current-sheet", Name: "Alice 卡"}},
	}
	preferred := preferredPrepIDs(content, current)
	markAddedPrepNames(&content, preferred)
	ids := remapPrepEntityCollections(&content, preferred)
	remapPrepReferences(&content, ids, preferred, "user-new", "新用户")

	if content.Characters[0]["id"] != "current-alice" || content.Characters[0]["name"] != "Alice" {
		t.Fatalf("same-name character was not prepared for overwrite: %#v", content.Characters[0])
	}
	if content.Characters[1]["id"] != "current-bob" || content.Characters[1]["name"] != "Bob" {
		t.Fatalf("previously marked same-name character was not prepared for overwrite: %#v", content.Characters[1])
	}
	if content.CharacterSheets[0].ID != "current-sheet" || content.CharacterSheets[0].Name != "Alice 卡" {
		t.Fatalf("same-name character sheet was not prepared for overwrite: %#v", content.CharacterSheets[0])
	}
	if content.LocationMaps[0].ID == "incoming-map" || content.LocationMaps[0].Name != "港口（导入新增）" {
		t.Fatalf("new location map was not marked and remapped: %#v", content.LocationMaps[0])
	}
	merged := mergePrepMapItems(current.Characters, content.Characters)
	if len(merged) != 2 || merged[0]["id"] != "current-alice" || merged[1]["id"] != "current-bob" {
		t.Fatalf("unexpected merged collection: %#v", merged)
	}
}

func TestImportPrepContentIntoNewCampaignKeepsOriginalNames(t *testing.T) {
	db := openMigrationTestDB(t)
	if sqlDB, err := db.DB(); err == nil {
		t.Cleanup(func() { _ = sqlDB.Close() })
	}
	created, err := createV2Campaign(db, "user-new", "新用户", "测试导入模组", "")
	if err != nil {
		t.Fatal(err)
	}
	content := prepPackageContent{
		Characters: []map[string]any{{"id": "character-a", "name": "角色 A"}},
	}
	result, err := importPrepContent(
		db, t.TempDir(), created.Summary.ID, "user-new", "新用户", content, map[string][]byte{}, prepImportModeNewCampaign,
	)
	if err != nil {
		t.Fatal(err)
	}
	if result.AddedCount != 1 || result.OverwrittenCount != 0 {
		t.Fatalf("unexpected import counts: %#v", result)
	}
	bundle, err := loadV2CampaignBundle(db, created.Summary.ID)
	if err != nil {
		t.Fatal(err)
	}
	if len(bundle.Bundle.Characters) != 1 || bundle.Bundle.Characters[0]["name"] != "角色 A" {
		t.Fatalf("new campaign import changed item names: %#v", bundle.Bundle.Characters)
	}
}

func TestSanitizePrepContentForExportRemovesCollaborationData(t *testing.T) {
	content := prepPackageContent{
		GameSessions: []map[string]any{{"taskIds": []any{"task-a"}, "participantUserIds": []any{"user-a"}}},
		CharacterSheets: []CharacterSheetDocument{{
			CampaignID: "campaign-a", OwnerUserID: "user-a", AssignedUserIDs: []string{"user-a"},
			MemberPermissions: []CharacterSheetMemberPermission{{UserID: "user-b", Permission: "edit"}}, Version: 8,
		}},
		MapDrawings: []LocationMapDrawingDocument{{
			CampaignID: "campaign-a", Version: 4, AppliedOperationIDs: []string{"operation-a"},
			Shapes: []LocationMapDrawingShape{{AuthorID: "user-a", AuthorName: "用户 A"}},
		}},
	}

	sanitizePrepContentForExport(&content)
	if tasks, ok := content.GameSessions[0]["taskIds"].([]string); !ok || len(tasks) != 0 {
		t.Fatalf("session task references were retained: %#v", content.GameSessions[0]["taskIds"])
	}
	if participants, ok := content.GameSessions[0]["participantUserIds"].([]string); !ok || len(participants) != 0 {
		t.Fatalf("session participants were retained: %#v", content.GameSessions[0]["participantUserIds"])
	}
	if content.CharacterSheets[0].CampaignID != "" || content.CharacterSheets[0].OwnerUserID != "" || content.CharacterSheets[0].Version != 0 {
		t.Fatalf("character sheet collaboration data was retained: %#v", content.CharacterSheets[0])
	}
	if len(content.CharacterSheets[0].AssignedUserIDs) != 0 || len(content.CharacterSheets[0].MemberPermissions) != 0 {
		t.Fatalf("character sheet permissions were retained: %#v", content.CharacterSheets[0])
	}
	if content.MapDrawings[0].CampaignID != "" || content.MapDrawings[0].Version != 0 || len(content.MapDrawings[0].AppliedOperationIDs) != 0 {
		t.Fatalf("drawing collaboration data was retained: %#v", content.MapDrawings[0])
	}
	if content.MapDrawings[0].Shapes[0].AuthorID != "" {
		t.Fatalf("drawing author was retained: %#v", content.MapDrawings[0].Shapes[0])
	}
}
