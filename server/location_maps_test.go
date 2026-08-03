package main

import (
	"errors"
	"fmt"
	"testing"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func openLocationMapTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	dsn := fmt.Sprintf("file:location_maps_%s?mode=memory&cache=shared", uuidSafeTestName(t.Name()))
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if err := db.AutoMigrate(&V2CampaignDocument{}); err != nil {
		t.Fatal(err)
	}
	return db
}

func uuidSafeTestName(name string) string {
	result := make([]rune, 0, len(name))
	for _, char := range name {
		if (char >= 'a' && char <= 'z') || (char >= 'A' && char <= 'Z') || (char >= '0' && char <= '9') {
			result = append(result, char)
		}
	}
	return string(result)
}

func TestRedactLocationMapDocumentForPL(t *testing.T) {
	doc := LocationMapDocument{Maps: []LocationMap{{Points: []LocationMapPoint{
		{ID: "visible", LocationID: "location-public", VisibleToPlayers: true},
		{ID: "hidden", LocationID: "location-secret", VisibleToPlayers: false},
	}}}}
	redacted := redactLocationMapDocumentForPL(doc)
	if len(redacted.Maps[0].Points) != 1 || redacted.Maps[0].Points[0].ID != "visible" {
		t.Fatalf("unexpected redacted points: %#v", redacted.Maps[0].Points)
	}
	if redacted.Maps[0].Points[0].LocationID != "" {
		t.Fatal("PL response must not contain locationId")
	}
	if doc.Maps[0].Points[0].LocationID == "" {
		t.Fatal("redaction mutated the manager document")
	}
}

func TestUpdateLocationMapDocumentAndConflict(t *testing.T) {
	db := openLocationMapTestDB(t)
	current, err := loadLocationMapDocument(db, "campaign-1", "gm-1", "GM")
	if err != nil {
		t.Fatal(err)
	}
	request := LocationMapUpdateRequest{ExpectedVersion: current.Version, Maps: []LocationMap{{
		ID: "map-1", Name: "城镇", ImageRef: "graph_assets/town.webp",
		Points: []LocationMapPoint{{
			ID: "point-1", LocationID: "location-1", Name: "旅店",
			IconID: 3, X: 0.25, Y: 0.75, VisibleToPlayers: true,
		}},
	}}}
	updated, err := updateLocationMapDocument(db, "campaign-1", request, "gm-1", "GM")
	if err != nil {
		t.Fatal(err)
	}
	if updated.Version != current.Version+1 {
		t.Fatalf("expected version %d, got %d", current.Version+1, updated.Version)
	}
	if updated.Maps[0].Points[0].LabelColor == "" || updated.Maps[0].Points[0].LabelStrokeColor == "" {
		t.Fatal("expected default label colors")
	}
	_, err = updateLocationMapDocument(db, "campaign-1", request, "gm-2", "Assistant")
	var conflict *LocationMapConflictError
	if !errors.As(err, &conflict) || conflict.Current.Version != updated.Version {
		t.Fatalf("expected conflict at version %d, got %v", updated.Version, err)
	}
}

func TestNormalizeLocationMapsRejectsInvalidPoint(t *testing.T) {
	_, err := normalizeLocationMaps([]LocationMap{{ID: "map-1", Points: []LocationMapPoint{{
		ID: "point-1", LocationID: "location-1", IconID: 15, X: 0.5, Y: 0.5,
	}}}}, 1)
	if err == nil || err.Error() != "invalid_icon_id" {
		t.Fatalf("expected invalid_icon_id, got %v", err)
	}
}

func TestLocationMapDocumentRejectsStaleSecondClient(t *testing.T) {
	db := openLocationMapTestDB(t)
	clientA, err := loadLocationMapDocument(db, "campaign-multi-client", "gm-a", "GM A")
	if err != nil {
		t.Fatal(err)
	}
	clientB, err := loadLocationMapDocument(db, "campaign-multi-client", "gm-b", "GM B")
	if err != nil {
		t.Fatal(err)
	}
	if clientA.Version != clientB.Version {
		t.Fatalf("clients did not start from the same version: %d != %d", clientA.Version, clientB.Version)
	}

	savedByA, err := updateLocationMapDocument(db, "campaign-multi-client", LocationMapUpdateRequest{
		ExpectedVersion: clientA.Version,
		Maps: []LocationMap{{
			ID: "map-a", Name: "Client A Map", Points: []LocationMapPoint{},
		}},
	}, "gm-a", "GM A")
	if err != nil {
		t.Fatal(err)
	}

	_, err = updateLocationMapDocument(db, "campaign-multi-client", LocationMapUpdateRequest{
		ExpectedVersion: clientB.Version,
		Maps: []LocationMap{{
			ID: "map-b", Name: "Client B Map", Points: []LocationMapPoint{},
		}},
	}, "gm-b", "GM B")
	var conflict *LocationMapConflictError
	if !errors.As(err, &conflict) {
		t.Fatalf("expected stale client conflict, got %v", err)
	}
	if conflict.Current.Version != savedByA.Version {
		t.Fatalf("expected remote version %d, got %d", savedByA.Version, conflict.Current.Version)
	}
	if len(conflict.Current.Maps) != 1 || conflict.Current.Maps[0].ID != "map-a" {
		t.Fatalf("conflict response did not preserve client A data: %#v", conflict.Current.Maps)
	}
}
