package main

import (
	"encoding/json"
	"errors"
	"math"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

const locationMapsDocumentType = "location_maps"

type LocationMapPoint struct {
	ID               string  `json:"id"`
	LocationID       string  `json:"locationId,omitempty"`
	Name             string  `json:"name"`
	Introduction     string  `json:"introduction"`
	IconID           int     `json:"iconId"`
	X                float64 `json:"x"`
	Y                float64 `json:"y"`
	VisibleToPlayers bool    `json:"visibleToPlayers"`
	LabelColor       string  `json:"labelColor"`
	LabelStrokeColor string  `json:"labelStrokeColor"`
}

type LocationMap struct {
	ID        string             `json:"id"`
	Name      string             `json:"name"`
	ImageRef  string             `json:"imageRef"`
	Points    []LocationMapPoint `json:"points"`
	CreatedAt int64              `json:"createdAt"`
	UpdatedAt int64              `json:"updatedAt"`
}

type LocationMapDocument struct {
	CampaignID    string        `json:"campaignId"`
	Maps          []LocationMap `json:"maps"`
	Version       int           `json:"version"`
	UpdatedBy     string        `json:"updatedBy"`
	UpdatedByName string        `json:"updatedByName"`
	UpdatedAt     int64         `json:"updatedAt"`
}

type LocationMapUpdateRequest struct {
	Maps            []LocationMap `json:"maps"`
	ExpectedVersion int           `json:"expectedVersion"`
}

type LocationMapConflictError struct {
	Current LocationMapDocument
}

func (e *LocationMapConflictError) Error() string { return "version_conflict" }

func defaultLocationMapDocument(campaignID, userID, username string) LocationMapDocument {
	return LocationMapDocument{
		CampaignID: campaignID, Maps: []LocationMap{}, Version: 1,
		UpdatedBy: userID, UpdatedByName: username, UpdatedAt: time.Now().UnixMilli(),
	}
}

func loadLocationMapDocument(db *gorm.DB, campaignID, userID, username string) (LocationMapDocument, error) {
	doc := defaultLocationMapDocument(campaignID, userID, username)
	stored, err := loadDocumentJSON(db, campaignID, locationMapsDocumentType, &doc)
	if err != nil {
		return LocationMapDocument{}, err
	}
	if stored == nil {
		if err := saveV2CampaignDocument(db, campaignID, locationMapsDocumentType, doc, doc.Version); err != nil {
			return LocationMapDocument{}, err
		}
	}
	if doc.Maps == nil {
		doc.Maps = []LocationMap{}
	}
	return doc, nil
}

func normalizeLocationMaps(maps []LocationMap, now int64) ([]LocationMap, error) {
	result := make([]LocationMap, 0, len(maps))
	mapIDs := make(map[string]struct{}, len(maps))
	pointIDs := make(map[string]struct{})
	for _, item := range maps {
		item.ID = strings.TrimSpace(item.ID)
		if item.ID == "" {
			item.ID = uuid.NewString()
		}
		if _, duplicate := mapIDs[item.ID]; duplicate {
			return nil, errors.New("duplicate_map_id")
		}
		mapIDs[item.ID] = struct{}{}
		item.Name = strings.TrimSpace(item.Name)
		if item.Name == "" {
			item.Name = "未命名地图"
		}
		item.ImageRef = strings.TrimSpace(item.ImageRef)
		if item.CreatedAt <= 0 {
			item.CreatedAt = now
		}
		item.UpdatedAt = now
		points := make([]LocationMapPoint, 0, len(item.Points))
		for _, point := range item.Points {
			point.ID = strings.TrimSpace(point.ID)
			if point.ID == "" {
				point.ID = uuid.NewString()
			}
			if _, duplicate := pointIDs[point.ID]; duplicate {
				return nil, errors.New("duplicate_point_id")
			}
			pointIDs[point.ID] = struct{}{}
			point.LocationID = strings.TrimSpace(point.LocationID)
			if point.LocationID == "" {
				return nil, errors.New("location_id_required")
			}
			point.Name = strings.TrimSpace(point.Name)
			if point.Name == "" {
				point.Name = "未命名地点"
			}
			if point.IconID < 1 || point.IconID > 14 {
				return nil, errors.New("invalid_icon_id")
			}
			if math.IsNaN(point.X) || math.IsInf(point.X, 0) || point.X < 0 || point.X > 1 ||
				math.IsNaN(point.Y) || math.IsInf(point.Y, 0) || point.Y < 0 || point.Y > 1 {
				return nil, errors.New("invalid_coordinates")
			}
			point.LabelColor = strings.TrimSpace(point.LabelColor)
			if point.LabelColor == "" {
				point.LabelColor = "#ffffff"
			}
			point.LabelStrokeColor = strings.TrimSpace(point.LabelStrokeColor)
			if point.LabelStrokeColor == "" {
				point.LabelStrokeColor = "#111827"
			}
			points = append(points, point)
		}
		item.Points = points
		result = append(result, item)
	}
	return result, nil
}

func updateLocationMapDocument(db *gorm.DB, campaignID string, request LocationMapUpdateRequest, userID, username string) (LocationMapDocument, error) {
	current, err := loadLocationMapDocument(db, campaignID, userID, username)
	if err != nil {
		return LocationMapDocument{}, err
	}
	if request.ExpectedVersion != current.Version {
		return LocationMapDocument{}, &LocationMapConflictError{Current: current}
	}
	now := time.Now().UnixMilli()
	maps, err := normalizeLocationMaps(request.Maps, now)
	if err != nil {
		return LocationMapDocument{}, err
	}
	next := LocationMapDocument{
		CampaignID: campaignID, Maps: maps, Version: current.Version + 1,
		UpdatedBy: userID, UpdatedByName: username, UpdatedAt: now,
	}
	payload, err := json.Marshal(next)
	if err != nil {
		return LocationMapDocument{}, err
	}
	result := db.Model(&V2CampaignDocument{}).
		Where("campaign_id = ? AND document_type = ? AND version = ?", campaignID, locationMapsDocumentType, current.Version).
		Updates(map[string]any{"content_json": string(payload), "version": next.Version, "updated_at": time.Now()})
	if result.Error != nil {
		return LocationMapDocument{}, result.Error
	}
	if result.RowsAffected != 1 {
		latest, loadErr := loadLocationMapDocument(db, campaignID, userID, username)
		if loadErr != nil {
			return LocationMapDocument{}, loadErr
		}
		return LocationMapDocument{}, &LocationMapConflictError{Current: latest}
	}
	return next, nil
}

func redactLocationMapDocumentForPL(doc LocationMapDocument) LocationMapDocument {
	maps := make([]LocationMap, len(doc.Maps))
	copy(maps, doc.Maps)
	doc.Maps = maps
	for mapIndex := range maps {
		visible := make([]LocationMapPoint, 0, len(maps[mapIndex].Points))
		for _, point := range maps[mapIndex].Points {
			if point.VisibleToPlayers {
				point.LocationID = ""
				visible = append(visible, point)
			}
		}
		maps[mapIndex].Points = visible
	}
	return doc
}

func registerLocationMapRoutes(campaignAPI *gin.RouterGroup, db *gorm.DB) {
	campaignAPI.GET("/:campaignId/location-maps", func(c *gin.Context) {
		campaignID := strings.TrimSpace(c.Param("campaignId"))
		userID, username := requestUser(c)
		if campaignID == "" || userID == "" || username == "" {
			c.JSON(400, gin.H{"error": "missing_identity"})
			return
		}
		cfg, ok := loadCampaignConfigForRequest(c, db, campaignID, userID, username)
		if !ok {
			return
		}
		doc, err := loadLocationMapDocument(db, campaignID, userID, username)
		if err != nil {
			c.JSON(500, gin.H{"error": "database_error"})
			return
		}
		if !isCampaignManagerRole(memberRole(cfg, userID)) {
			doc = redactLocationMapDocumentForPL(doc)
		}
		c.JSON(200, doc)
	})

	campaignAPI.PUT("/:campaignId/location-maps", func(c *gin.Context) {
		campaignID := strings.TrimSpace(c.Param("campaignId"))
		userID, username := requestUser(c)
		if campaignID == "" || userID == "" || username == "" {
			c.JSON(400, gin.H{"error": "missing_identity"})
			return
		}
		cfg, ok := loadCampaignConfigForRequest(c, db, campaignID, userID, username)
		if !ok {
			return
		}
		if !isCampaignManagerRole(memberRole(cfg, userID)) {
			c.JSON(403, gin.H{"error": "forbidden"})
			return
		}
		var request LocationMapUpdateRequest
		if err := c.ShouldBindJSON(&request); err != nil {
			c.JSON(400, gin.H{"error": "invalid_payload"})
			return
		}
		doc, err := updateLocationMapDocument(db, campaignID, request, userID, username)
		if err != nil {
			var conflict *LocationMapConflictError
			if errors.As(err, &conflict) {
				c.JSON(409, gin.H{"error": "version_conflict", "version": conflict.Current.Version, "remoteDoc": conflict.Current})
				return
			}
			switch err.Error() {
			case "duplicate_map_id", "duplicate_point_id", "location_id_required", "invalid_icon_id", "invalid_coordinates":
				c.JSON(400, gin.H{"error": err.Error()})
			default:
				c.JSON(500, gin.H{"error": "database_error"})
			}
			return
		}
		c.JSON(200, doc)
	})
}
