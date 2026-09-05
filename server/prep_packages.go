package main

import (
	"archive/zip"
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/url"
	"os"
	pathpkg "path"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

const (
	prepPackageFormat         = "trpg-note-prep-package"
	prepPackageSchemaVersion  = 1
	prepImportModeNewCampaign = "new_campaign"
)

var prepCollectionLabels = map[string]string{
	"characters":      "角色",
	"characterSheets": "角色卡",
	"monsters":        "怪物",
	"locations":       "地点",
	"locationMaps":    "地图地点",
	"organizations":   "组织",
	"events":          "事件",
	"clues":           "线索",
	"timelines":       "时间线",
	"gameSessions":    "场次中心",
	"relationGraphs":  "关系图",
	"mindMaps":        "思维导图",
}

var prepCollectionOrder = []string{
	"characters", "characterSheets", "monsters", "locations", "locationMaps",
	"organizations", "events", "clues", "timelines", "gameSessions",
	"relationGraphs", "mindMaps",
}

type prepPackageManifest struct {
	Format           string         `json:"format"`
	SchemaVersion    int            `json:"schemaVersion"`
	AppVersion       string         `json:"appVersion"`
	Name             string         `json:"name"`
	SourceCampaignID string         `json:"sourceCampaignId"`
	SourceName       string         `json:"sourceName"`
	ExportedAt       int64          `json:"exportedAt"`
	Counts           map[string]int `json:"counts"`
	AssetCount       int            `json:"assetCount"`
}

type prepPackageContent struct {
	Characters      []map[string]any             `json:"characters"`
	CharacterSheets []CharacterSheetDocument     `json:"characterSheets"`
	Monsters        []map[string]any             `json:"monsters"`
	Locations       []map[string]any             `json:"locations"`
	LocationMaps    []LocationMap                `json:"locationMaps"`
	MapDrawings     []LocationMapDrawingDocument `json:"mapDrawings"`
	Organizations   []map[string]any             `json:"organizations"`
	Events          []map[string]any             `json:"events"`
	Clues           []map[string]any             `json:"clues"`
	Timelines       []map[string]any             `json:"timelines"`
	GameSessions    []map[string]any             `json:"gameSessions"`
	RelationGraphs  []map[string]any             `json:"relationGraphs"`
	MindMaps        []map[string]any             `json:"mindMaps"`
}

type prepCatalogItem struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

type prepCatalogCategory struct {
	Key   string            `json:"key"`
	Label string            `json:"label"`
	Items []prepCatalogItem `json:"items"`
}

type prepSelectionRequest struct {
	Name       string              `json:"name"`
	Selections map[string][]string `json:"selections"`
}

type prepImportResult struct {
	ImportedCounts     map[string]int `json:"importedCounts"`
	AddedCount         int            `json:"addedCount"`
	OverwrittenCount   int            `json:"overwrittenCount"`
	ImportedAssetCount int            `json:"importedAssetCount"`
	MissingAssetCount  int            `json:"missingAssetCount"`
}

const importedNameSuffix = "（导入新增）"

func loadAllCharacterSheets(db *gorm.DB, campaignID string) ([]CharacterSheetDocument, error) {
	var rows []V2CampaignDocument
	if err := db.Where("campaign_id = ? AND document_type = ?", campaignID, characterSheetDocumentType).Find(&rows).Error; err != nil {
		return nil, err
	}
	result := make([]CharacterSheetDocument, 0, len(rows))
	for _, row := range rows {
		var doc CharacterSheetDocument
		if err := json.Unmarshal([]byte(row.ContentJSON), &doc); err != nil {
			return nil, err
		}
		result = append(result, normalizeCharacterSheet(doc))
	}
	return result, nil
}

func prepMapItems(items []map[string]any) []prepCatalogItem {
	result := make([]prepCatalogItem, 0, len(items))
	for _, item := range items {
		id := strings.TrimSpace(stringFromAny(item["id"]))
		if id == "" {
			continue
		}
		name := strings.TrimSpace(stringFromAny(item["name"]))
		if name == "" {
			name = "未命名条目"
		}
		result = append(result, prepCatalogItem{ID: id, Name: name})
	}
	return result
}

func buildPrepCatalog(db *gorm.DB, campaignID, userID, username string) ([]prepCatalogCategory, error) {
	bundle, err := loadV2CampaignBundle(db, campaignID)
	if err != nil {
		return nil, err
	}
	sheets, err := loadAllCharacterSheets(db, campaignID)
	if err != nil {
		return nil, err
	}
	maps, err := loadLocationMapDocument(db, campaignID, userID, username)
	if err != nil {
		return nil, err
	}
	itemsByKey := map[string][]prepCatalogItem{
		"characters": prepMapItems(bundle.Bundle.Characters), "monsters": prepMapItems(bundle.Bundle.Monsters),
		"locations": prepMapItems(bundle.Bundle.Locations), "organizations": prepMapItems(bundle.Bundle.Organizations),
		"events": prepMapItems(bundle.Bundle.Events), "clues": prepMapItems(bundle.Bundle.Clues),
		"timelines": prepMapItems(bundle.Bundle.Timelines), "gameSessions": prepMapItems(bundle.Bundle.GameSessions),
		"relationGraphs": prepMapItems(bundle.Bundle.RelationGraphs), "mindMaps": prepMapItems(bundle.Bundle.MindMaps),
	}
	for _, sheet := range sheets {
		itemsByKey["characterSheets"] = append(itemsByKey["characterSheets"], prepCatalogItem{ID: sheet.ID, Name: sheet.Name})
	}
	for _, item := range maps.Maps {
		itemsByKey["locationMaps"] = append(itemsByKey["locationMaps"], prepCatalogItem{ID: item.ID, Name: item.Name})
	}
	result := make([]prepCatalogCategory, 0, len(prepCollectionOrder))
	for _, key := range prepCollectionOrder {
		items := itemsByKey[key]
		if items == nil {
			items = []prepCatalogItem{}
		}
		result = append(result, prepCatalogCategory{Key: key, Label: prepCollectionLabels[key], Items: items})
	}
	return result, nil
}

func selectionSet(selections map[string][]string, key string) map[string]struct{} {
	result := make(map[string]struct{}, len(selections[key]))
	for _, id := range selections[key] {
		if id = strings.TrimSpace(id); id != "" {
			result[id] = struct{}{}
		}
	}
	return result
}

func selectPrepMaps(items []map[string]any, ids map[string]struct{}) []map[string]any {
	result := make([]map[string]any, 0, len(ids))
	for _, item := range items {
		if _, ok := ids[stringFromAny(item["id"])]; ok {
			result = append(result, item)
		}
	}
	return result
}

func buildPrepContent(db *gorm.DB, campaignID, userID, username string, selections map[string][]string) (prepPackageContent, error) {
	bundle, err := loadV2CampaignBundle(db, campaignID)
	if err != nil {
		return prepPackageContent{}, err
	}
	sheets, err := loadAllCharacterSheets(db, campaignID)
	if err != nil {
		return prepPackageContent{}, err
	}
	mapDoc, err := loadLocationMapDocument(db, campaignID, userID, username)
	if err != nil {
		return prepPackageContent{}, err
	}
	content := prepPackageContent{
		Characters:      selectPrepMaps(bundle.Bundle.Characters, selectionSet(selections, "characters")),
		Monsters:        selectPrepMaps(bundle.Bundle.Monsters, selectionSet(selections, "monsters")),
		Locations:       selectPrepMaps(bundle.Bundle.Locations, selectionSet(selections, "locations")),
		Organizations:   selectPrepMaps(bundle.Bundle.Organizations, selectionSet(selections, "organizations")),
		Events:          selectPrepMaps(bundle.Bundle.Events, selectionSet(selections, "events")),
		Clues:           selectPrepMaps(bundle.Bundle.Clues, selectionSet(selections, "clues")),
		Timelines:       selectPrepMaps(bundle.Bundle.Timelines, selectionSet(selections, "timelines")),
		GameSessions:    selectPrepMaps(bundle.Bundle.GameSessions, selectionSet(selections, "gameSessions")),
		RelationGraphs:  selectPrepMaps(bundle.Bundle.RelationGraphs, selectionSet(selections, "relationGraphs")),
		MindMaps:        selectPrepMaps(bundle.Bundle.MindMaps, selectionSet(selections, "mindMaps")),
		CharacterSheets: []CharacterSheetDocument{}, LocationMaps: []LocationMap{}, MapDrawings: []LocationMapDrawingDocument{},
	}
	selectedSheets := selectionSet(selections, "characterSheets")
	for _, sheet := range sheets {
		if _, ok := selectedSheets[sheet.ID]; ok {
			content.CharacterSheets = append(content.CharacterSheets, sheet)
		}
	}
	selectedMaps := selectionSet(selections, "locationMaps")
	for _, item := range mapDoc.Maps {
		if _, ok := selectedMaps[item.ID]; !ok {
			continue
		}
		content.LocationMaps = append(content.LocationMaps, item)
		var drawing LocationMapDrawingDocument
		stored, err := loadDocumentJSON(db, campaignID, locationMapDrawingDocumentType(item.ID), &drawing)
		if err != nil {
			return prepPackageContent{}, err
		}
		if stored != nil {
			content.MapDrawings = append(content.MapDrawings, drawing)
		}
	}
	sanitizePrepContentForExport(&content)
	return content, nil
}

func sanitizePrepContentForExport(content *prepPackageContent) {
	for _, session := range content.GameSessions {
		session["taskIds"] = []string{}
		session["participantUserIds"] = []string{}
	}
	for index := range content.CharacterSheets {
		sheet := &content.CharacterSheets[index]
		sheet.CampaignID = ""
		sheet.Visibility = "private"
		sheet.AssignedUserIDs = []string{}
		sheet.MemberPermissions = []CharacterSheetMemberPermission{}
		sheet.OwnerUserID, sheet.OwnerUsername = "", ""
		sheet.UpdatedBy, sheet.UpdatedByName, sheet.Version = "", "", 0
	}
	for drawingIndex := range content.MapDrawings {
		drawing := &content.MapDrawings[drawingIndex]
		drawing.CampaignID = ""
		drawing.AppliedOperationIDs = []string{}
		drawing.UpdatedBy, drawing.UpdatedByName, drawing.Version = "", "", 0
		for shapeIndex := range drawing.Shapes {
			drawing.Shapes[shapeIndex].AuthorID = ""
			drawing.Shapes[shapeIndex].AuthorName = ""
		}
	}
}

func prepContentCounts(content prepPackageContent) map[string]int {
	return map[string]int{
		"characters": len(content.Characters), "characterSheets": len(content.CharacterSheets),
		"monsters": len(content.Monsters), "locations": len(content.Locations), "locationMaps": len(content.LocationMaps),
		"organizations": len(content.Organizations), "events": len(content.Events), "clues": len(content.Clues),
		"timelines": len(content.Timelines), "gameSessions": len(content.GameSessions),
		"relationGraphs": len(content.RelationGraphs), "mindMaps": len(content.MindMaps),
	}
}

func prepContentItemCount(content prepPackageContent) int {
	total := 0
	for _, count := range prepContentCounts(content) {
		total += count
	}
	return total
}

func collectPrepResourceRefs(content prepPackageContent) ([]string, error) {
	payload, err := json.Marshal(content)
	if err != nil {
		return nil, err
	}
	var generic any
	if err := json.Unmarshal(payload, &generic); err != nil {
		return nil, err
	}
	refs := map[string]struct{}{}
	collectResourceRefsFromValue(generic, refs)
	result := make([]string, 0, len(refs))
	for ref := range refs {
		result = append(result, ref)
	}
	sort.Strings(result)
	return result, nil
}

func exportPrepPackage(c *gin.Context, assetBaseDir string, manifest prepPackageManifest, content prepPackageContent, refs []string) {
	fileName := fmt.Sprintf("TRPG模组导出-%s-%s.trpgzip", manifest.Name, time.Now().Format("20060102-150405"))
	c.Header("Content-Type", "application/zip")
	c.Header("Content-Disposition", fmt.Sprintf(`attachment; filename*=UTF-8''%s`, url.QueryEscape(fileName)))
	zw := zip.NewWriter(c.Writer)
	defer func() { _ = zw.Close() }()
	if err := writeJSONZipEntry(zw, "manifest.json", manifest); err != nil {
		c.Status(500)
		return
	}
	if err := writeJSONZipEntry(zw, "content.json", content); err != nil {
		c.Status(500)
		return
	}
	missing := make([]string, 0)
	for _, ref := range refs {
		written, err := writeAssetZipEntry(zw, assetBaseDir, ref)
		if err != nil {
			c.Status(500)
			return
		}
		if !written {
			missing = append(missing, ref)
		}
	}
	if len(missing) > 0 {
		_ = writeJSONZipEntry(zw, "warnings.json", map[string]any{"missingAssets": missing})
	}
}

func parsePrepPackage(data []byte) (prepPackageManifest, prepPackageContent, map[string][]byte, error) {
	reader, err := zip.NewReader(bytes.NewReader(data), int64(len(data)))
	if err != nil {
		return prepPackageManifest{}, prepPackageContent{}, nil, fmt.Errorf("invalid_zip")
	}
	var manifest prepPackageManifest
	var content prepPackageContent
	assets := map[string][]byte{}
	for _, item := range reader.File {
		cleanName := pathpkg.Clean(strings.ReplaceAll(item.Name, "\\", "/"))
		if cleanName == "manifest.json" || cleanName == "content.json" {
			file, openErr := item.Open()
			if openErr != nil {
				return manifest, content, nil, openErr
			}
			payload, readErr := io.ReadAll(file)
			_ = file.Close()
			if readErr != nil {
				return manifest, content, nil, readErr
			}
			if cleanName == "manifest.json" {
				err = json.Unmarshal(payload, &manifest)
			} else {
				err = json.Unmarshal(payload, &content)
			}
			if err != nil {
				return manifest, content, nil, fmt.Errorf("invalid_package")
			}
			continue
		}
		if !strings.HasPrefix(cleanName, "assets/") {
			continue
		}
		ref, ok := normalizeBackupResourceRef(strings.TrimPrefix(cleanName, "assets/"))
		if !ok {
			return manifest, content, nil, fmt.Errorf("invalid_asset_path")
		}
		file, openErr := item.Open()
		if openErr != nil {
			return manifest, content, nil, openErr
		}
		payload, readErr := io.ReadAll(file)
		_ = file.Close()
		if readErr != nil {
			return manifest, content, nil, readErr
		}
		assets[ref] = payload
	}
	if manifest.Format != prepPackageFormat || manifest.SchemaVersion != prepPackageSchemaVersion {
		return manifest, content, nil, fmt.Errorf("unsupported_package")
	}
	if prepContentItemCount(content) == 0 {
		return manifest, content, nil, fmt.Errorf("empty_package")
	}
	return manifest, content, assets, nil
}

func entityMapKey(entityType, id string) string {
	return strings.TrimSpace(entityType) + ":" + strings.TrimSpace(id)
}

func prepNameKey(name string) string {
	name = strings.TrimSpace(name)
	for strings.HasSuffix(name, importedNameSuffix) {
		name = strings.TrimSpace(strings.TrimSuffix(name, importedNameSuffix))
	}
	return strings.ToLower(name)
}

func importedPrepName(name string) string {
	name = strings.TrimSpace(name)
	if name == "" {
		name = "未命名条目"
	}
	if strings.HasSuffix(name, importedNameSuffix) {
		return name
	}
	return name + importedNameSuffix
}

func preferredPrepMapIDs(incoming, current []map[string]any, collection string, result map[string]string) {
	currentByName := make(map[string]string, len(current))
	for _, item := range current {
		nameKey := prepNameKey(stringFromAny(item["name"]))
		id := strings.TrimSpace(stringFromAny(item["id"]))
		if nameKey != "" && id != "" {
			if _, exists := currentByName[nameKey]; !exists {
				currentByName[nameKey] = id
			}
		}
	}
	for _, item := range incoming {
		if id := currentByName[prepNameKey(stringFromAny(item["name"]))]; id != "" {
			result[entityMapKey(collection, stringFromAny(item["id"]))] = id
		}
	}
}

func preferredPrepIDs(content, current prepPackageContent) map[string]string {
	result := map[string]string{}
	collections := []struct {
		key      string
		incoming []map[string]any
		current  []map[string]any
	}{
		{"characters", content.Characters, current.Characters}, {"monsters", content.Monsters, current.Monsters},
		{"locations", content.Locations, current.Locations}, {"organizations", content.Organizations, current.Organizations},
		{"events", content.Events, current.Events}, {"clues", content.Clues, current.Clues},
		{"timelines", content.Timelines, current.Timelines}, {"gameSessions", content.GameSessions, current.GameSessions},
		{"relationGraphs", content.RelationGraphs, current.RelationGraphs}, {"mindMaps", content.MindMaps, current.MindMaps},
	}
	for _, collection := range collections {
		preferredPrepMapIDs(collection.incoming, collection.current, collection.key, result)
	}
	currentSheetsByName := make(map[string]string, len(current.CharacterSheets))
	for _, sheet := range current.CharacterSheets {
		if key := prepNameKey(sheet.Name); key != "" {
			if _, exists := currentSheetsByName[key]; !exists {
				currentSheetsByName[key] = sheet.ID
			}
		}
	}
	for _, sheet := range content.CharacterSheets {
		if id := currentSheetsByName[prepNameKey(sheet.Name)]; id != "" {
			result[entityMapKey("characterSheets", sheet.ID)] = id
		}
	}
	currentMapsByName := make(map[string]string, len(current.LocationMaps))
	for _, item := range current.LocationMaps {
		if key := prepNameKey(item.Name); key != "" {
			if _, exists := currentMapsByName[key]; !exists {
				currentMapsByName[key] = item.ID
			}
		}
	}
	for _, item := range content.LocationMaps {
		if id := currentMapsByName[prepNameKey(item.Name)]; id != "" {
			result[entityMapKey("locationMaps", item.ID)] = id
		}
	}
	return result
}

func markAddedPrepNames(content *prepPackageContent, preferred map[string]string) {
	collections := []struct {
		key   string
		items []map[string]any
	}{
		{"characters", content.Characters}, {"monsters", content.Monsters}, {"locations", content.Locations},
		{"organizations", content.Organizations}, {"events", content.Events}, {"clues", content.Clues},
		{"timelines", content.Timelines}, {"gameSessions", content.GameSessions},
		{"relationGraphs", content.RelationGraphs}, {"mindMaps", content.MindMaps},
	}
	for _, collection := range collections {
		for _, item := range collection.items {
			if _, overwrite := preferred[entityMapKey(collection.key, stringFromAny(item["id"]))]; !overwrite {
				item["name"] = importedPrepName(stringFromAny(item["name"]))
			}
		}
	}
	for index := range content.CharacterSheets {
		if _, overwrite := preferred[entityMapKey("characterSheets", content.CharacterSheets[index].ID)]; !overwrite {
			content.CharacterSheets[index].Name = importedPrepName(content.CharacterSheets[index].Name)
		}
	}
	for index := range content.LocationMaps {
		if _, overwrite := preferred[entityMapKey("locationMaps", content.LocationMaps[index].ID)]; !overwrite {
			content.LocationMaps[index].Name = importedPrepName(content.LocationMaps[index].Name)
		}
	}
}

func remapPrepEntityCollections(content *prepPackageContent, preferred map[string]string) map[string]string {
	result := map[string]string{}
	collections := []struct {
		key   string
		items []map[string]any
	}{
		{"characters", content.Characters}, {"monsters", content.Monsters}, {"locations", content.Locations},
		{"organizations", content.Organizations}, {"events", content.Events}, {"clues", content.Clues}, {"timelines", content.Timelines},
	}
	for _, collection := range collections {
		for _, item := range collection.items {
			oldID := stringFromAny(item["id"])
			newID := preferred[entityMapKey(collection.key, oldID)]
			if newID == "" {
				newID = uuid.NewString()
			}
			item["id"] = newID
			result[entityMapKey(collection.key, oldID)] = newID
		}
	}
	return result
}

func singularToCollection(value string) string {
	switch value {
	case "character":
		return "characters"
	case "monster":
		return "monsters"
	case "location":
		return "locations"
	case "organization":
		return "organizations"
	case "event":
		return "events"
	case "clue":
		return "clues"
	case "timeline":
		return "timelines"
	default:
		return value
	}
}

func remapRelationList(value any, ids map[string]string) []any {
	items, _ := value.([]any)
	result := make([]any, 0, len(items))
	for _, raw := range items {
		item, ok := raw.(map[string]any)
		if !ok {
			continue
		}
		newID, exists := ids[entityMapKey(singularToCollection(stringFromAny(item["targetType"])), stringFromAny(item["id"]))]
		if !exists {
			continue
		}
		item["id"] = newID
		result = append(result, item)
	}
	return result
}

func remapPrepReferences(content *prepPackageContent, ids, preferred map[string]string, userID, username string) {
	entityCollections := [][]map[string]any{content.Characters, content.Monsters, content.Locations, content.Organizations, content.Events, content.Clues}
	for _, collection := range entityCollections {
		for _, item := range collection {
			item["relations"] = remapRelationList(item["relations"], ids)
		}
	}
	for _, timeline := range content.Timelines {
		timeline["relations"] = remapRelationList(timeline["relations"], ids)
		events, _ := timeline["timelineEvents"].([]any)
		for _, raw := range events {
			if event, ok := raw.(map[string]any); ok {
				event["relations"] = remapRelationList(event["relations"], ids)
			}
		}
	}
	for _, graph := range content.RelationGraphs {
		oldID := stringFromAny(graph["id"])
		graph["id"] = preferred[entityMapKey("relationGraphs", oldID)]
		if graph["id"] == "" {
			graph["id"] = uuid.NewString()
		}
		nodes, _ := graph["nodes"].([]any)
		keptNodes := make([]any, 0, len(nodes))
		keptNodeIDs := map[string]struct{}{}
		for _, raw := range nodes {
			node, ok := raw.(map[string]any)
			if !ok {
				continue
			}
			newID, exists := ids[entityMapKey(stringFromAny(node["entityType"]), stringFromAny(node["entityId"]))]
			if !exists {
				continue
			}
			node["entityId"] = newID
			keptNodeIDs[stringFromAny(node["id"])] = struct{}{}
			keptNodes = append(keptNodes, node)
		}
		graph["nodes"] = keptNodes
		edges, _ := graph["edges"].([]any)
		keptEdges := make([]any, 0, len(edges))
		for _, raw := range edges {
			edge, ok := raw.(map[string]any)
			if !ok {
				continue
			}
			_, fromOK := keptNodeIDs[stringFromAny(edge["fromNodeId"])]
			_, toOK := keptNodeIDs[stringFromAny(edge["toNodeId"])]
			if fromOK && toOK {
				keptEdges = append(keptEdges, edge)
			}
		}
		graph["edges"] = keptEdges
	}
	for _, mindMap := range content.MindMaps {
		oldID := stringFromAny(mindMap["id"])
		mindMap["id"] = preferred[entityMapKey("mindMaps", oldID)]
		if mindMap["id"] == "" {
			mindMap["id"] = uuid.NewString()
		}
		nodes, _ := mindMap["nodes"].([]any)
		for _, raw := range nodes {
			node, ok := raw.(map[string]any)
			if !ok {
				continue
			}
			refs, _ := node["entityRefs"].([]any)
			kept := make([]any, 0, len(refs))
			for _, refRaw := range refs {
				ref, ok := refRaw.(map[string]any)
				if !ok {
					continue
				}
				if next, exists := ids[entityMapKey(stringFromAny(ref["entityType"]), stringFromAny(ref["entityId"]))]; exists {
					ref["entityId"] = next
					kept = append(kept, ref)
				}
			}
			node["entityRefs"] = kept
			delete(node, "entityRef")
		}
	}
	for _, session := range content.GameSessions {
		oldID := stringFromAny(session["id"])
		session["id"] = preferred[entityMapKey("gameSessions", oldID)]
		if session["id"] == "" {
			session["id"] = uuid.NewString()
		}
		refs, _ := session["resourceRefs"].([]any)
		kept := make([]any, 0, len(refs))
		for _, raw := range refs {
			ref, ok := raw.(map[string]any)
			if !ok {
				continue
			}
			if next, exists := ids[entityMapKey(stringFromAny(ref["entityType"]), stringFromAny(ref["entityId"]))]; exists {
				ref["entityId"] = next
				kept = append(kept, ref)
			}
		}
		session["resourceRefs"] = kept
		session["taskIds"] = []string{}
		session["participantUserIds"] = []string{}
	}
	for index := range content.CharacterSheets {
		sheet := &content.CharacterSheets[index]
		oldID := sheet.ID
		sheet.ID = preferred[entityMapKey("characterSheets", oldID)]
		if sheet.ID == "" {
			sheet.ID = uuid.NewString()
		}
		sheet.CampaignID = ""
		if next, exists := ids[entityMapKey(sheet.LinkedEntityType, sheet.LinkedEntityID)]; exists {
			sheet.LinkedEntityID = next
		} else {
			sheet.LinkedEntityID, sheet.LinkedEntityType = "", ""
		}
		sheet.OwnerUserID, sheet.OwnerUsername = userID, username
		sheet.AssignedUserIDs = []string{}
		sheet.MemberPermissions = []CharacterSheetMemberPermission{}
		sheet.Visibility = "private"
	}
	mapIDs := map[string]string{}
	for index := range content.LocationMaps {
		item := &content.LocationMaps[index]
		oldID := item.ID
		item.ID = preferred[entityMapKey("locationMaps", oldID)]
		if item.ID == "" {
			item.ID = uuid.NewString()
		}
		mapIDs[oldID] = item.ID
		points := make([]LocationMapPoint, 0, len(item.Points))
		for _, point := range item.Points {
			if next, exists := ids[entityMapKey("locations", point.LocationID)]; exists {
				point.ID = uuid.NewString()
				point.LocationID = next
				points = append(points, point)
			}
		}
		item.Points = points
	}
	keptDrawings := make([]LocationMapDrawingDocument, 0, len(content.MapDrawings))
	for _, drawing := range content.MapDrawings {
		newMapID, exists := mapIDs[drawing.MapID]
		if !exists {
			continue
		}
		drawing.MapID = newMapID
		drawing.CampaignID = ""
		drawing.AppliedOperationIDs = []string{}
		for index := range drawing.Shapes {
			drawing.Shapes[index].ID = uuid.NewString()
			drawing.Shapes[index].AuthorID = userID
			drawing.Shapes[index].AuthorName = username
		}
		keptDrawings = append(keptDrawings, drawing)
	}
	content.MapDrawings = keptDrawings
}

func mergePrepMapItems(current, incoming []map[string]any) []map[string]any {
	indexByID := make(map[string]int, len(current))
	for index, item := range current {
		if id := strings.TrimSpace(stringFromAny(item["id"])); id != "" {
			indexByID[id] = index
		}
	}
	for _, item := range incoming {
		if index, exists := indexByID[strings.TrimSpace(stringFromAny(item["id"]))]; exists {
			current[index] = item
		} else {
			current = append(current, item)
		}
	}
	return current
}

func mergeLocationMaps(current, incoming []LocationMap) []LocationMap {
	indexByID := make(map[string]int, len(current))
	for index, item := range current {
		if id := strings.TrimSpace(item.ID); id != "" {
			indexByID[id] = index
		}
	}
	for _, item := range incoming {
		if index, exists := indexByID[strings.TrimSpace(item.ID)]; exists {
			current[index] = item
		} else {
			current = append(current, item)
		}
	}
	return current
}

func appendPrepContent(tx *gorm.DB, campaignID, userID, username string, content prepPackageContent) (map[string]int, error) {
	now := time.Now().UnixMilli()
	bundle, err := loadV2CampaignBundle(tx, campaignID)
	if err != nil {
		return nil, err
	}
	counts := prepContentCounts(content)
	nextVersion := bundle.Version + 1
	type collectionSave struct {
		docType  string
		current  *[]map[string]any
		incoming []map[string]any
	}
	collections := []collectionSave{
		{"characters", &bundle.Bundle.Characters, content.Characters}, {"monsters", &bundle.Bundle.Monsters, content.Monsters},
		{"locations", &bundle.Bundle.Locations, content.Locations}, {"organizations", &bundle.Bundle.Organizations, content.Organizations},
		{"events", &bundle.Bundle.Events, content.Events}, {"clues", &bundle.Bundle.Clues, content.Clues},
		{"timelines", &bundle.Bundle.Timelines, content.Timelines}, {"game_sessions", &bundle.Bundle.GameSessions, content.GameSessions},
		{"relation_graphs", &bundle.Bundle.RelationGraphs, content.RelationGraphs}, {"mind_maps", &bundle.Bundle.MindMaps, content.MindMaps},
	}
	for _, collection := range collections {
		if len(collection.incoming) == 0 {
			continue
		}
		*collection.current = mergePrepMapItems(*collection.current, collection.incoming)
		if err := saveV2CampaignDocument(tx, campaignID, collection.docType, *collection.current, nextVersion); err != nil {
			return nil, err
		}
	}
	for index := range content.CharacterSheets {
		sheet := content.CharacterSheets[index]
		sheet.CampaignID = campaignID
		sheet.CreatedAt, sheet.UpdatedAt = now, now
		sheet.UpdatedBy, sheet.UpdatedByName, sheet.Version = userID, username, 1
		if err := saveCharacterSheet(tx, sheet); err != nil {
			return nil, err
		}
	}
	if len(content.LocationMaps) > 0 {
		mapDoc, err := loadLocationMapDocument(tx, campaignID, userID, username)
		if err != nil {
			return nil, err
		}
		for index := range content.LocationMaps {
			content.LocationMaps[index].CreatedAt = now
			content.LocationMaps[index].UpdatedAt = now
		}
		mapDoc.Maps = mergeLocationMaps(mapDoc.Maps, content.LocationMaps)
		mapDoc.Version++
		mapDoc.UpdatedBy, mapDoc.UpdatedByName, mapDoc.UpdatedAt = userID, username, now
		if err := saveV2CampaignDocument(tx, campaignID, locationMapsDocumentType, mapDoc, mapDoc.Version); err != nil {
			return nil, err
		}
		for _, item := range content.LocationMaps {
			if err := tx.Where("campaign_id = ? AND document_type = ?", campaignID, locationMapDrawingDocumentType(item.ID)).Delete(&V2CampaignDocument{}).Error; err != nil {
				return nil, err
			}
		}
	}
	for _, drawing := range content.MapDrawings {
		drawing.CampaignID = campaignID
		drawing.Version, drawing.UpdatedBy, drawing.UpdatedByName, drawing.UpdatedAt = 1, userID, username, now
		if err := saveV2CampaignDocument(tx, campaignID, locationMapDrawingDocumentType(drawing.MapID), drawing, drawing.Version); err != nil {
			return nil, err
		}
	}
	return counts, nil
}

func importPrepContent(
	db *gorm.DB,
	assetBaseDir, campaignID, userID, username string,
	content prepPackageContent,
	assets map[string][]byte,
	mode string,
) (prepImportResult, error) {
	refMap := map[string]string{}
	for oldRef, asset := range assets {
		newRef, err := ensureImportedAsset(assetBaseDir, oldRef, asset)
		if err != nil {
			return prepImportResult{}, fmt.Errorf("asset_import_failed")
		}
		refMap[oldRef] = newRef
	}
	remapped, err := remapResourceRefsForTypedValue(content, refMap)
	if err != nil {
		return prepImportResult{}, fmt.Errorf("resource_remap_failed")
	}
	content = remapped
	currentBundle, err := loadV2CampaignBundle(db, campaignID)
	if err != nil {
		return prepImportResult{}, fmt.Errorf("database_error")
	}
	currentSheets, err := loadAllCharacterSheets(db, campaignID)
	if err != nil {
		return prepImportResult{}, fmt.Errorf("database_error")
	}
	currentMaps, err := loadLocationMapDocument(db, campaignID, userID, username)
	if err != nil {
		return prepImportResult{}, fmt.Errorf("database_error")
	}
	current := prepPackageContent{
		Characters: currentBundle.Bundle.Characters, CharacterSheets: currentSheets,
		Monsters: currentBundle.Bundle.Monsters, Locations: currentBundle.Bundle.Locations, LocationMaps: currentMaps.Maps,
		Organizations: currentBundle.Bundle.Organizations, Events: currentBundle.Bundle.Events, Clues: currentBundle.Bundle.Clues,
		Timelines: currentBundle.Bundle.Timelines, GameSessions: currentBundle.Bundle.GameSessions,
		RelationGraphs: currentBundle.Bundle.RelationGraphs, MindMaps: currentBundle.Bundle.MindMaps,
	}
	preferred := map[string]string{}
	if mode == "overwrite" {
		preferred = preferredPrepIDs(content, current)
	}
	if mode != prepImportModeNewCampaign {
		markAddedPrepNames(&content, preferred)
	}
	ids := remapPrepEntityCollections(&content, preferred)
	remapPrepReferences(&content, ids, preferred, userID, username)
	itemCount := prepContentItemCount(content)
	var counts map[string]int
	if err := db.Transaction(func(tx *gorm.DB) error {
		var saveErr error
		counts, saveErr = appendPrepContent(tx, campaignID, userID, username, content)
		return saveErr
	}); err != nil {
		return prepImportResult{}, fmt.Errorf("database_error")
	}
	referenced, _ := collectPrepResourceRefs(content)
	missing := 0
	for _, ref := range referenced {
		if _, err := os.Stat(resourceRefToFullPath(assetBaseDir, ref)); err != nil {
			missing++
		}
	}
	return prepImportResult{
		ImportedCounts: counts, AddedCount: itemCount - len(preferred), OverwrittenCount: len(preferred),
		ImportedAssetCount: len(refMap), MissingAssetCount: missing,
	}, nil
}

func registerPrepPackageRoutes(group *gin.RouterGroup, db *gorm.DB, cfg Config) {
	assetBaseDir := filepath.Dir(cfg.DBPath)
	managerContext := func(c *gin.Context) (string, string, string, bool) {
		campaignID := strings.TrimSpace(c.Param("campaignId"))
		userID, username := requestUser(c)
		if campaignID == "" || userID == "" || username == "" {
			c.JSON(400, gin.H{"error": "missing_identity"})
			return "", "", "", false
		}
		campaignCfg, ok := loadCampaignConfigForRequest(c, db, campaignID, userID, username)
		if !ok {
			return "", "", "", false
		}
		if !isCampaignManagerRole(memberRole(campaignCfg, userID)) {
			c.JSON(403, gin.H{"error": "forbidden"})
			return "", "", "", false
		}
		return campaignID, userID, username, true
	}

	group.GET("/campaigns/:campaignId/catalog", func(c *gin.Context) {
		campaignID, userID, username, ok := managerContext(c)
		if !ok {
			return
		}
		categories, err := buildPrepCatalog(db, campaignID, userID, username)
		if err != nil {
			c.JSON(500, gin.H{"error": "database_error"})
			return
		}
		c.JSON(200, gin.H{"categories": categories})
	})

	group.POST("/campaigns/:campaignId/export", func(c *gin.Context) {
		campaignID, userID, username, ok := managerContext(c)
		if !ok {
			return
		}
		var request prepSelectionRequest
		if err := c.ShouldBindJSON(&request); err != nil {
			c.JSON(400, gin.H{"error": "invalid_payload"})
			return
		}
		content, err := buildPrepContent(db, campaignID, userID, username, request.Selections)
		if err != nil {
			c.JSON(500, gin.H{"error": "database_error"})
			return
		}
		if prepContentItemCount(content) == 0 {
			c.JSON(400, gin.H{"error": "empty_selection"})
			return
		}
		refs, err := collectPrepResourceRefs(content)
		if err != nil {
			c.JSON(500, gin.H{"error": "resource_collect_failed"})
			return
		}
		bundle, err := loadV2CampaignBundle(db, campaignID)
		if err != nil {
			c.JSON(500, gin.H{"error": "database_error"})
			return
		}
		name := strings.TrimSpace(request.Name)
		if name == "" {
			name = strings.TrimSpace(stringFromAny(bundle.Bundle.Meta["projectName"]))
		}
		if name == "" {
			name = "未命名备团包"
		}
		name = strings.NewReplacer("/", "-", "\\", "-").Replace(name)
		manifest := prepPackageManifest{Format: prepPackageFormat, SchemaVersion: prepPackageSchemaVersion, AppVersion: appVersion,
			Name: name, SourceCampaignID: campaignID, SourceName: stringFromAny(bundle.Bundle.Meta["projectName"]),
			ExportedAt: time.Now().UnixMilli(), Counts: prepContentCounts(content), AssetCount: len(refs)}
		exportPrepPackage(c, assetBaseDir, manifest, content, refs)
	})

}
