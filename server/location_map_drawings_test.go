package main

import (
	"testing"
)

func testDrawingShape(id string) LocationMapDrawingShape {
	return LocationMapDrawingShape{
		ID: id, Type: "freehand",
		Points:      []LocationMapDrawingPoint{{X: 0.1, Y: 0.2}, {X: 0.3, Y: 0.4}},
		StrokeColor: "#ef4444", StrokeWidth: 3,
	}
}

func TestDrawingOperationsMergeTwoClientsAndDeduplicate(t *testing.T) {
	db := openLocationMapTestDB(t)
	first, err := updateLocationMapDrawing(db, "campaign-drawing", "map-1", LocationMapDrawingOperation{
		OperationID: "client-a-op-1", Type: "add_shape", Shape: drawingShapeInputPointer(testDrawingShape("shape-a")),
	}, "user-a", "Player A", false)
	if err != nil {
		t.Fatal(err)
	}
	second, err := updateLocationMapDrawing(db, "campaign-drawing", "map-1", LocationMapDrawingOperation{
		OperationID: "client-b-op-1", Type: "add_shape", Shape: drawingShapeInputPointer(testDrawingShape("shape-b")),
	}, "user-b", "Player B", false)
	if err != nil {
		t.Fatal(err)
	}
	if len(second.Shapes) != 2 || second.Version != first.Version+1 {
		t.Fatalf("expected merged shapes and next version, got %#v", second)
	}
	repeated, err := updateLocationMapDrawing(db, "campaign-drawing", "map-1", LocationMapDrawingOperation{
		OperationID: "client-a-op-1", Type: "add_shape", Shape: drawingShapeInputPointer(testDrawingShape("shape-a")),
	}, "user-a", "Player A", false)
	if err != nil {
		t.Fatal(err)
	}
	if repeated.Version != second.Version || len(repeated.Shapes) != 2 {
		t.Fatalf("idempotent retry changed document: %#v", repeated)
	}
}

func TestDrawingDeletePermissionsAndManagerClear(t *testing.T) {
	doc := defaultLocationMapDrawingDocument("campaign-1", "map-1")
	doc.Shapes = []LocationMapDrawingShape{
		{ID: "mine", AuthorID: "player-1"},
		{ID: "theirs", AuthorID: "player-2"},
	}
	_, _, err := applyDrawingOperation(doc, LocationMapDrawingOperation{
		OperationID: "delete-other", Type: "delete_shape", ShapeID: "theirs",
	}, "player-1", "Player 1", false)
	if err == nil || err.Error() != "forbidden_shape_delete" {
		t.Fatalf("expected forbidden_shape_delete, got %v", err)
	}
	cleared, changed, err := applyDrawingOperation(doc, LocationMapDrawingOperation{
		OperationID: "clear-all", Type: "clear_all",
	}, "gm-1", "GM", true)
	if err != nil || !changed || len(cleared.Shapes) != 0 {
		t.Fatalf("manager clear failed: changed=%v err=%v shapes=%d", changed, err, len(cleared.Shapes))
	}
}

func TestDrawingShapeValidation(t *testing.T) {
	shape := testDrawingShape("shape-1")
	shape.Points[0].X = 2
	if err := validateDrawingShape(shape); err == nil || err.Error() != "invalid_shape_points" {
		t.Fatalf("expected invalid_shape_points, got %v", err)
	}
}

func drawingShapeInputPointer(shape LocationMapDrawingShape) *LocationMapDrawingShapeInput {
	return &LocationMapDrawingShapeInput{
		ID: shape.ID, Type: shape.Type, Points: shape.Points,
		StrokeColor: shape.StrokeColor, StrokeWidth: shape.StrokeWidth, CreatedAt: shape.CreatedAt,
	}
}
