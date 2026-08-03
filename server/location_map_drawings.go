package main

import (
	"encoding/json"
	"errors"
	"math"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

const (
	locationMapDrawingDocumentPrefix = "location_map_drawing:"
	maxDrawingShapes                 = 1000
	maxDrawingPointsPerShape         = 5000
	maxRememberedDrawingOperations   = 500
)

type LocationMapDrawingPoint struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
}

type LocationMapDrawingShape struct {
	ID          string                    `json:"id"`
	Type        string                    `json:"type"`
	Points      []LocationMapDrawingPoint `json:"points"`
	StrokeColor string                    `json:"strokeColor"`
	StrokeWidth float64                   `json:"strokeWidth"`
	AuthorID    string                    `json:"authorId"`
	AuthorName  string                    `json:"authorName"`
	CreatedAt   int64                     `json:"createdAt"`
}

type LocationMapDrawingDocument struct {
	CampaignID          string                    `json:"campaignId"`
	MapID               string                    `json:"mapId"`
	Shapes              []LocationMapDrawingShape `json:"shapes"`
	AppliedOperationIDs []string                  `json:"appliedOperationIds,omitempty"`
	Version             int                       `json:"version"`
	UpdatedBy           string                    `json:"updatedBy"`
	UpdatedByName       string                    `json:"updatedByName"`
	UpdatedAt           int64                     `json:"updatedAt"`
}

type LocationMapDrawingShapeInput struct {
	ID          string                    `json:"id"`
	Type        string                    `json:"type"`
	Points      []LocationMapDrawingPoint `json:"points"`
	StrokeColor string                    `json:"strokeColor"`
	StrokeWidth float64                   `json:"strokeWidth"`
	CreatedAt   int64                     `json:"createdAt"`
}

type LocationMapDrawingOperation struct {
	OperationID string                        `json:"operationId"`
	Type        string                        `json:"type"`
	Shape       *LocationMapDrawingShapeInput `json:"shape,omitempty"`
	ShapeID     string                        `json:"shapeId,omitempty"`
}

func locationMapDrawingDocumentType(mapID string) string {
	return locationMapDrawingDocumentPrefix + mapID
}

func defaultLocationMapDrawingDocument(campaignID, mapID string) LocationMapDrawingDocument {
	return LocationMapDrawingDocument{
		CampaignID:          campaignID,
		MapID:               mapID,
		Shapes:              []LocationMapDrawingShape{},
		AppliedOperationIDs: []string{},
		Version:             1,
		UpdatedAt:           time.Now().UnixMilli(),
	}
}

func loadLocationMapDrawingDocument(db *gorm.DB, campaignID, mapID string) (LocationMapDrawingDocument, error) {
	doc := defaultLocationMapDrawingDocument(campaignID, mapID)
	stored, err := loadDocumentJSON(db, campaignID, locationMapDrawingDocumentType(mapID), &doc)
	if err != nil {
		return LocationMapDrawingDocument{}, err
	}
	if stored == nil {
		if err := saveV2CampaignDocument(db, campaignID, locationMapDrawingDocumentType(mapID), doc, doc.Version); err != nil {
			if !isUniqueConstraintError(err) {
				return LocationMapDrawingDocument{}, err
			}
			stored, err = loadDocumentJSON(db, campaignID, locationMapDrawingDocumentType(mapID), &doc)
			if err != nil || stored == nil {
				return LocationMapDrawingDocument{}, err
			}
		}
	}
	if doc.Shapes == nil {
		doc.Shapes = []LocationMapDrawingShape{}
	}
	if doc.AppliedOperationIDs == nil {
		doc.AppliedOperationIDs = []string{}
	}
	return doc, nil
}

func isUniqueConstraintError(err error) bool {
	return err != nil && strings.Contains(strings.ToLower(err.Error()), "unique")
}

func validateDrawingShape(shape LocationMapDrawingShape) error {
	if strings.TrimSpace(shape.ID) == "" {
		return errors.New("shape_id_required")
	}
	if shape.Type != "freehand" && shape.Type != "rectangle" && shape.Type != "ellipse" {
		return errors.New("invalid_shape_type")
	}
	if len(shape.Points) < 2 || len(shape.Points) > maxDrawingPointsPerShape {
		return errors.New("invalid_shape_points")
	}
	for _, point := range shape.Points {
		if math.IsNaN(point.X) || math.IsInf(point.X, 0) || point.X < 0 || point.X > 1 ||
			math.IsNaN(point.Y) || math.IsInf(point.Y, 0) || point.Y < 0 || point.Y > 1 {
			return errors.New("invalid_shape_points")
		}
	}
	if shape.StrokeWidth < 1 || shape.StrokeWidth > 12 {
		return errors.New("invalid_stroke_width")
	}
	if len(strings.TrimSpace(shape.StrokeColor)) == 0 || len(shape.StrokeColor) > 32 {
		return errors.New("invalid_stroke_color")
	}
	return nil
}

func applyDrawingOperation(
	doc LocationMapDrawingDocument,
	operation LocationMapDrawingOperation,
	userID, username string,
	canManage bool,
) (LocationMapDrawingDocument, bool, error) {
	operation.OperationID = strings.TrimSpace(operation.OperationID)
	if operation.OperationID == "" {
		return doc, false, errors.New("operation_id_required")
	}
	for _, appliedID := range doc.AppliedOperationIDs {
		if appliedID == operation.OperationID {
			return doc, false, nil
		}
	}

	switch operation.Type {
	case "add_shape":
		if operation.Shape == nil {
			return doc, false, errors.New("shape_required")
		}
		shape := LocationMapDrawingShape{
			ID: operation.Shape.ID, Type: operation.Shape.Type,
			Points: operation.Shape.Points, StrokeColor: operation.Shape.StrokeColor,
			StrokeWidth: operation.Shape.StrokeWidth, CreatedAt: operation.Shape.CreatedAt,
		}
		if err := validateDrawingShape(shape); err != nil {
			return doc, false, err
		}
		for _, existing := range doc.Shapes {
			if existing.ID == shape.ID {
				return doc, false, errors.New("duplicate_shape_id")
			}
		}
		if len(doc.Shapes) >= maxDrawingShapes {
			return doc, false, errors.New("too_many_shapes")
		}
		shape.AuthorID = userID
		shape.AuthorName = username
		if shape.CreatedAt <= 0 {
			shape.CreatedAt = time.Now().UnixMilli()
		}
		doc.Shapes = append(doc.Shapes, shape)
	case "delete_shape":
		shapeID := strings.TrimSpace(operation.ShapeID)
		index := -1
		for i, shape := range doc.Shapes {
			if shape.ID == shapeID {
				index = i
				if !canManage && shape.AuthorID != userID {
					return doc, false, errors.New("forbidden_shape_delete")
				}
				break
			}
		}
		if index < 0 {
			return doc, false, nil
		}
		doc.Shapes = append(doc.Shapes[:index], doc.Shapes[index+1:]...)
	case "clear_own":
		filtered := make([]LocationMapDrawingShape, 0, len(doc.Shapes))
		for _, shape := range doc.Shapes {
			if shape.AuthorID != userID {
				filtered = append(filtered, shape)
			}
		}
		doc.Shapes = filtered
	case "clear_all":
		if !canManage {
			return doc, false, errors.New("forbidden")
		}
		doc.Shapes = []LocationMapDrawingShape{}
	default:
		return doc, false, errors.New("invalid_operation_type")
	}

	doc.AppliedOperationIDs = append(doc.AppliedOperationIDs, operation.OperationID)
	if len(doc.AppliedOperationIDs) > maxRememberedDrawingOperations {
		doc.AppliedOperationIDs = doc.AppliedOperationIDs[len(doc.AppliedOperationIDs)-maxRememberedDrawingOperations:]
	}
	return doc, true, nil
}

func updateLocationMapDrawing(
	db *gorm.DB,
	campaignID, mapID string,
	operation LocationMapDrawingOperation,
	userID, username string,
	canManage bool,
) (LocationMapDrawingDocument, error) {
	for attempt := 0; attempt < 4; attempt++ {
		current, err := loadLocationMapDrawingDocument(db, campaignID, mapID)
		if err != nil {
			return LocationMapDrawingDocument{}, err
		}
		next, changed, err := applyDrawingOperation(current, operation, userID, username, canManage)
		if err != nil || !changed {
			return next, err
		}
		next.Version = current.Version + 1
		next.UpdatedBy = userID
		next.UpdatedByName = username
		next.UpdatedAt = time.Now().UnixMilli()
		payload, err := json.Marshal(next)
		if err != nil {
			return LocationMapDrawingDocument{}, err
		}
		result := db.Model(&V2CampaignDocument{}).
			Where("campaign_id = ? AND document_type = ? AND version = ?", campaignID, locationMapDrawingDocumentType(mapID), current.Version).
			Updates(map[string]any{"content_json": string(payload), "version": next.Version, "updated_at": time.Now()})
		if result.Error != nil {
			return LocationMapDrawingDocument{}, result.Error
		}
		if result.RowsAffected == 1 {
			return next, nil
		}
	}
	return LocationMapDrawingDocument{}, errors.New("drawing_update_conflict")
}

func locationMapExists(db *gorm.DB, campaignID, mapID, userID, username string) (bool, error) {
	doc, err := loadLocationMapDocument(db, campaignID, userID, username)
	if err != nil {
		return false, err
	}
	for _, item := range doc.Maps {
		if item.ID == mapID {
			return true, nil
		}
	}
	return false, nil
}

func registerLocationMapDrawingRoutes(campaignAPI *gin.RouterGroup, db *gorm.DB) {
	campaignAPI.GET("/:campaignId/location-maps/:mapId/drawing", func(c *gin.Context) {
		campaignID, mapID := strings.TrimSpace(c.Param("campaignId")), strings.TrimSpace(c.Param("mapId"))
		userID, username := requestUser(c)
		if campaignID == "" || mapID == "" || userID == "" || username == "" {
			c.JSON(400, gin.H{"error": "missing_identity"})
			return
		}
		if _, ok := loadCampaignConfigForRequest(c, db, campaignID, userID, username); !ok {
			return
		}
		exists, err := locationMapExists(db, campaignID, mapID, userID, username)
		if err != nil {
			c.JSON(500, gin.H{"error": "database_error"})
			return
		}
		if !exists {
			c.JSON(404, gin.H{"error": "map_not_found"})
			return
		}
		doc, err := loadLocationMapDrawingDocument(db, campaignID, mapID)
		if err != nil {
			c.JSON(500, gin.H{"error": "database_error"})
			return
		}
		c.JSON(200, doc)
	})

	campaignAPI.POST("/:campaignId/location-maps/:mapId/drawing/operations", func(c *gin.Context) {
		campaignID, mapID := strings.TrimSpace(c.Param("campaignId")), strings.TrimSpace(c.Param("mapId"))
		userID, username := requestUser(c)
		if campaignID == "" || mapID == "" || userID == "" || username == "" {
			c.JSON(400, gin.H{"error": "missing_identity"})
			return
		}
		cfg, ok := loadCampaignConfigForRequest(c, db, campaignID, userID, username)
		if !ok {
			return
		}
		exists, err := locationMapExists(db, campaignID, mapID, userID, username)
		if err != nil {
			c.JSON(500, gin.H{"error": "database_error"})
			return
		}
		if !exists {
			c.JSON(404, gin.H{"error": "map_not_found"})
			return
		}
		var operation LocationMapDrawingOperation
		if err := c.ShouldBindJSON(&operation); err != nil {
			c.JSON(400, gin.H{"error": "invalid_payload"})
			return
		}
		doc, err := updateLocationMapDrawing(
			db, campaignID, mapID, operation, userID, username,
			isCampaignManagerRole(memberRole(cfg, userID)),
		)
		if err != nil {
			switch err.Error() {
			case "forbidden", "forbidden_shape_delete":
				c.JSON(403, gin.H{"error": err.Error()})
			case "operation_id_required", "shape_required", "shape_id_required", "invalid_shape_type",
				"invalid_shape_points", "invalid_stroke_width", "invalid_stroke_color",
				"duplicate_shape_id", "too_many_shapes", "invalid_operation_type":
				c.JSON(400, gin.H{"error": err.Error()})
			case "drawing_update_conflict":
				c.JSON(409, gin.H{"error": err.Error()})
			default:
				c.JSON(500, gin.H{"error": "database_error"})
			}
			return
		}
		c.JSON(200, doc)
	})
}
