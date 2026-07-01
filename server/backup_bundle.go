package main

import (
	"archive/zip"
	"bytes"
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"io"
	"net/url"
	"os"
	pathpkg "path"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

const (
	backupBundleFormat        = "trpg-note-backup"
	backupBundleSchemaVersion = 1
)

var resourceURLPattern = regexp.MustCompile(`(?:https?:\/\/[^/\s)"'<>]+)?\/api\/resources\/file\/([^\s)"'<>]+)`)

type storedCampaignSummary struct {
	ID            string `json:"id"`
	Name          string `json:"name"`
	Description   string `json:"description"`
	LastModified  int64  `json:"lastModified"`
	OwnerID       string `json:"ownerId"`
	Visibility    string `json:"visibility,omitempty"`
	SchemaVersion int    `json:"schemaVersion,omitempty"`
}

type backupManifest struct {
	Format              string `json:"format"`
	BundleSchemaVersion int    `json:"bundleSchemaVersion"`
	AppVersion          string `json:"appVersion"`
	ExportType          string `json:"exportType"`
	ExportedAt          int64  `json:"exportedAt"`
	ExportedByUserID    string `json:"exportedByUserId"`
	ExportedByUsername  string `json:"exportedByUsername"`
	CampaignCount       int    `json:"campaignCount"`
	ContainsConfig      bool   `json:"containsConfig"`
	ContainsTeamNotes   bool   `json:"containsTeamNotes"`
	ContainsTaskBoard   bool   `json:"containsTaskBoard"`
	ContainsAssets      bool   `json:"containsAssets"`
}

type backupCampaignBundle struct {
	OriginalCampaignID string               `json:"originalCampaignId"`
	CampaignData       any                  `json:"campaignData"`
	Config             *CampaignConfigDoc   `json:"config,omitempty"`
	TeamNotes          []TeamNoteDoc        `json:"teamNotes,omitempty"`
	TaskBoard          *SessionTaskBoardDoc `json:"taskBoard,omitempty"`
}

type backupBundle struct {
	Campaigns []backupCampaignBundle `json:"campaigns"`
}

type backupPreviewCampaign struct {
	OriginalCampaignID  string         `json:"originalCampaignId"`
	Name                string         `json:"name"`
	Description         string         `json:"description"`
	CollectionCounts    map[string]int `json:"collectionCounts"`
	TeamNoteCount       int            `json:"teamNoteCount"`
	TaskCount           int            `json:"taskCount"`
	AssetCount          int            `json:"assetCount"`
	MatchedCampaignID   string         `json:"matchedCampaignId,omitempty"`
	MatchedCampaignName string         `json:"matchedCampaignName,omitempty"`
}

type backupPreviewResponse struct {
	Manifest  backupManifest          `json:"manifest"`
	FileName  string                  `json:"fileName"`
	Campaigns []backupPreviewCampaign `json:"campaigns"`
}

func userStoragePrefix(userID string) string {
	return "trpg_u_" + strings.TrimSpace(userID) + "_"
}

func userCampaignIndexKey(userID string) string {
	return userStoragePrefix(userID) + "campaign_index"
}

func userCampaignKey(userID, campaignID string) string {
	return userStoragePrefix(userID) + "campaign_" + strings.TrimSpace(campaignID)
}

func loadStoredCampaignSummaries(db *gorm.DB, userID string) ([]storedCampaignSummary, error) {
	var items []storedCampaignSummary
	ok, _, err := kvLoadJSON(db, userCampaignIndexKey(userID), &items)
	if err != nil {
		return nil, err
	}
	if !ok {
		return []storedCampaignSummary{}, nil
	}
	return items, nil
}

func saveStoredCampaignSummaries(db *gorm.DB, userID string, items []storedCampaignSummary) error {
	_, err := kvSaveJSON(db, userCampaignIndexKey(userID), items)
	return err
}

func loadUserCampaignPayload(db *gorm.DB, userID, campaignID string) (any, error) {
	var raw any
	ok, _, err := kvLoadJSON(db, userCampaignKey(userID, campaignID), &raw)
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, gorm.ErrRecordNotFound
	}
	return raw, nil
}

func loadCampaignConfigOptional(db *gorm.DB, campaignID string) (*CampaignConfigDoc, error) {
	var cfg CampaignConfigDoc
	ok, _, err := kvLoadJSON(db, campaignConfigKey(campaignID), &cfg)
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, nil
	}
	return &cfg, nil
}

func loadTeamNotesOptional(db *gorm.DB, campaignID string) ([]TeamNoteDoc, error) {
	var items []KV
	if err := db.Where("key LIKE ?", teamNoteKey(campaignID, "")+"%").Find(&items).Error; err != nil {
		return nil, err
	}
	notes := make([]TeamNoteDoc, 0, len(items))
	for _, item := range items {
		var note TeamNoteDoc
		if err := json.Unmarshal([]byte(item.Value), &note); err != nil {
			continue
		}
		note.ActiveLease = nil
		notes = append(notes, note)
	}
	sort.Slice(notes, func(i, j int) bool { return notes[i].UpdatedAt < notes[j].UpdatedAt })
	return notes, nil
}

func loadTaskBoardOptional(db *gorm.DB, campaignID string) (*SessionTaskBoardDoc, error) {
	var doc SessionTaskBoardDoc
	ok, _, err := kvLoadJSON(db, taskBoardKey(campaignID), &doc)
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, nil
	}
	doc.ActiveLease = nil
	ensureTaskBoardPermissions(&doc)
	return &doc, nil
}

func buildBackupCampaignBundle(db *gorm.DB, userID, campaignID string) (backupCampaignBundle, error) {
	campaignData, err := loadUserCampaignPayload(db, userID, campaignID)
	if err != nil {
		return backupCampaignBundle{}, err
	}
	config, err := loadCampaignConfigOptional(db, campaignID)
	if err != nil {
		return backupCampaignBundle{}, err
	}
	teamNotes, err := loadTeamNotesOptional(db, campaignID)
	if err != nil {
		return backupCampaignBundle{}, err
	}
	taskBoard, err := loadTaskBoardOptional(db, campaignID)
	if err != nil {
		return backupCampaignBundle{}, err
	}
	return backupCampaignBundle{
		OriginalCampaignID: campaignID,
		CampaignData:       campaignData,
		Config:             config,
		TeamNotes:          teamNotes,
		TaskBoard:          taskBoard,
	}, nil
}

func normalizeBackupResourceRef(raw string) (string, bool) {
	value := strings.TrimSpace(strings.ReplaceAll(raw, "\\", "/"))
	value = strings.TrimPrefix(value, "/")
	if value == "" {
		return "", false
	}
	cleaned := pathpkg.Clean(value)
	if cleaned == "." || cleaned == "" {
		return "", false
	}
	if cleaned != "graph_assets" && !strings.HasPrefix(cleaned, "graph_assets/") {
		return "", false
	}
	return cleaned, true
}

func decodeResourceURLPath(raw string) (string, bool) {
	trimmed := strings.Trim(strings.TrimSpace(raw), "`\"'")
	trimmed = strings.TrimPrefix(trimmed, "/")
	if trimmed == "" {
		return "", false
	}
	parts := strings.Split(trimmed, "/")
	decodedParts := make([]string, 0, len(parts))
	for _, part := range parts {
		if part == "" {
			continue
		}
		value, err := url.PathUnescape(part)
		if err != nil {
			value = part
		}
		decodedParts = append(decodedParts, value)
	}
	return normalizeBackupResourceRef(strings.Join(decodedParts, "/"))
}

func collectResourceRefsFromString(text string, refs map[string]struct{}) {
	if ref, ok := normalizeBackupResourceRef(text); ok {
		refs[ref] = struct{}{}
	}
	matches := resourceURLPattern.FindAllStringSubmatch(text, -1)
	for _, match := range matches {
		if len(match) < 2 {
			continue
		}
		if ref, ok := decodeResourceURLPath(match[1]); ok {
			refs[ref] = struct{}{}
		}
	}
}

func collectResourceRefsFromValue(value any, refs map[string]struct{}) {
	switch typed := value.(type) {
	case map[string]any:
		for _, item := range typed {
			collectResourceRefsFromValue(item, refs)
		}
	case []any:
		for _, item := range typed {
			collectResourceRefsFromValue(item, refs)
		}
	case string:
		collectResourceRefsFromString(typed, refs)
	}
}

func collectResourceRefsFromBundle(bundle backupBundle) ([]string, error) {
	payload, err := json.Marshal(bundle)
	if err != nil {
		return nil, err
	}
	var generic any
	if err := json.Unmarshal(payload, &generic); err != nil {
		return nil, err
	}
	refs := make(map[string]struct{})
	collectResourceRefsFromValue(generic, refs)
	result := make([]string, 0, len(refs))
	for ref := range refs {
		result = append(result, ref)
	}
	sort.Strings(result)
	return result, nil
}

func collectResourceRefsFromLibrary(assetBaseDir string) ([]string, error) {
	assetDir := filepath.Join(assetBaseDir, resourceRootRef)
	_, items, err := scanResourceLibrary(assetDir)
	if err != nil {
		return nil, err
	}
	refs := make([]string, 0, len(items))
	for _, item := range items {
		ref := strings.TrimSpace(stringFromAny(item["ref"]))
		if normalized, ok := normalizeBackupResourceRef(ref); ok {
			refs = append(refs, normalized)
		}
	}
	sort.Strings(refs)
	return refs, nil
}

func mergeResourceRefs(left []string, right []string) []string {
	set := make(map[string]struct{}, len(left)+len(right))
	for _, ref := range left {
		if normalized, ok := normalizeBackupResourceRef(ref); ok {
			set[normalized] = struct{}{}
		}
	}
	for _, ref := range right {
		if normalized, ok := normalizeBackupResourceRef(ref); ok {
			set[normalized] = struct{}{}
		}
	}
	result := make([]string, 0, len(set))
	for ref := range set {
		result = append(result, ref)
	}
	sort.Strings(result)
	return result
}

func writeJSONZipEntry(zw *zip.Writer, name string, value any) error {
	writer, err := zw.Create(name)
	if err != nil {
		return err
	}
	encoder := json.NewEncoder(writer)
	encoder.SetIndent("", "  ")
	return encoder.Encode(value)
}

func writeTextZipEntry(zw *zip.Writer, name string, content string) error {
	writer, err := zw.Create(name)
	if err != nil {
		return err
	}
	_, err = writer.Write([]byte(content))
	return err
}

func writeAssetZipEntry(zw *zip.Writer, assetBaseDir string, ref string) (bool, error) {
	fullPath := resourceRefToFullPath(assetBaseDir, ref)
	content, err := os.ReadFile(fullPath)
	if err != nil {
		if os.IsNotExist(err) {
			return false, nil
		}
		return false, err
	}
	writer, err := zw.Create(pathpkg.Join("assets", ref))
	if err != nil {
		return false, err
	}
	_, err = writer.Write(content)
	if err != nil {
		return false, err
	}
	return true, nil
}

func exportBackupBundle(c *gin.Context, assetBaseDir string, exportType string, userID string, username string, bundle backupBundle, includeAssets bool) {
	refs := make([]string, 0)
	if includeAssets {
		bundleRefs, err := collectResourceRefsFromBundle(bundle)
		if err != nil {
			c.JSON(500, gin.H{"error": "bundle_collect_failed"})
			return
		}
		libraryRefs, err := collectResourceRefsFromLibrary(assetBaseDir)
		if err != nil {
			c.JSON(500, gin.H{"error": "asset_scan_failed"})
			return
		}
		refs = mergeResourceRefs(bundleRefs, libraryRefs)
	}
	manifest := backupManifest{
		Format:              backupBundleFormat,
		BundleSchemaVersion: backupBundleSchemaVersion,
		AppVersion:          appVersion,
		ExportType:          exportType,
		ExportedAt:          time.Now().UnixMilli(),
		ExportedByUserID:    userID,
		ExportedByUsername:  username,
		CampaignCount:       len(bundle.Campaigns),
		ContainsConfig:      true,
		ContainsTeamNotes:   true,
		ContainsTaskBoard:   true,
		ContainsAssets:      includeAssets && len(refs) > 0,
	}

	fileName := fmt.Sprintf("TRPG模组笔记-%s-%s.zip", exportType, time.Now().Format("20060102-150405"))
	c.Header("Content-Type", "application/zip")
	c.Header("Content-Disposition", fmt.Sprintf(`attachment; filename*=UTF-8''%s`, url.QueryEscape(fileName)))

	zw := zip.NewWriter(c.Writer)
	defer func() { _ = zw.Close() }()

	if err := writeJSONZipEntry(zw, "manifest.json", manifest); err != nil {
		c.Status(500)
		return
	}
	if err := writeJSONZipEntry(zw, "bundle.json", bundle); err != nil {
		c.Status(500)
		return
	}
	missingRefs := make([]string, 0)
	for _, ref := range refs {
		written, err := writeAssetZipEntry(zw, assetBaseDir, ref)
		if err != nil {
			c.Status(500)
			return
		}
		if !written {
			missingRefs = append(missingRefs, ref)
		}
	}
	if len(missingRefs) > 0 {
		warningPayload := map[string]any{
			"type":              "missing_assets",
			"message":           "部分资源文件在当前设备上不存在，已跳过这些资源，但备份中的模组数据仍已成功导出。",
			"missingAssetCount": len(missingRefs),
			"missingAssets":     missingRefs,
		}
		if err := writeJSONZipEntry(zw, "warnings.json", warningPayload); err != nil {
			c.Status(500)
			return
		}
		c.Header("X-TRPG-Backup-Warnings", "missing_assets")
	}
}

func requestIncludeAssets(c *gin.Context) bool {
	raw := strings.TrimSpace(strings.ToLower(c.Query("includeAssets")))
	if raw == "" {
		return true
	}
	switch raw {
	case "0", "false", "no", "off":
		return false
	default:
		return true
	}
}

func makeImportedCampaignID() string {
	return fmt.Sprintf("cmp_%d", time.Now().UnixNano())
}

func intMax(left int, right int) int {
	if left > right {
		return left
	}
	return right
}

func stringFromAny(value any) string {
	text, _ := value.(string)
	return text
}

func setImportedCampaignData(raw any, campaignID string, importedAt int64) (any, string, string, error) {
	root, ok := raw.(map[string]any)
	if !ok {
		return nil, "", "", fmt.Errorf("invalid_campaign_payload")
	}
	root["id"] = campaignID
	meta, _ := root["meta"].(map[string]any)
	if meta == nil {
		meta = map[string]any{}
		root["meta"] = meta
	}
	name := strings.TrimSpace(stringFromAny(meta["projectName"]))
	if name == "" {
		name = "导入模组"
	}
	description := strings.TrimSpace(stringFromAny(meta["description"]))
	meta["projectName"] = name
	meta["description"] = description
	meta["lastModified"] = importedAt
	if _, ok := meta["formatVersion"]; !ok {
		meta["formatVersion"] = "1.0"
	}
	if _, ok := meta["schemaVersion"]; !ok {
		meta["schemaVersion"] = 2
	}
	return root, name, description, nil
}

func buildImportedV2Bundle(campaignID string, raw any) (V2CampaignBundle, error) {
	root, ok := raw.(map[string]any)
	if !ok {
		return V2CampaignBundle{}, fmt.Errorf("invalid_campaign_payload")
	}
	meta, _ := root["meta"].(map[string]any)
	if meta == nil {
		meta = map[string]any{}
	}
	return V2CampaignBundle{
		ID:             campaignID,
		Meta:           meta,
		Notes:          stringFromAny(root["notes"]),
		Characters:     toMapSlice(root["characters"]),
		Locations:      toMapSlice(root["locations"]),
		Organizations:  toMapSlice(root["organizations"]),
		Events:         toMapSlice(root["events"]),
		Clues:          toMapSlice(root["clues"]),
		Timelines:      toMapSlice(root["timelines"]),
		Monsters:       toMapSlice(root["monsters"]),
		SessionTasks:   toMapSlice(root["sessionTasks"]),
		RelationGraphs: toMapSlice(root["relationGraphs"]),
	}, nil
}

func upsertImportedV2Campaign(tx *gorm.DB, campaignID, userID, projectName, description string, updatedAt time.Time) error {
	var existing V2Campaign
	err := tx.First(&existing, "id = ?", campaignID).Error
	if err != nil && err != gorm.ErrRecordNotFound {
		return err
	}

	campaign := V2Campaign{
		ID:               campaignID,
		Name:             strings.TrimSpace(projectName),
		Description:      strings.TrimSpace(description),
		OwnerUserID:      userID,
		Visibility:       "private",
		JoinPasswordHash: "",
		CreatedAt:        updatedAt,
		UpdatedAt:        updatedAt,
	}
	if campaign.Name == "" {
		campaign.Name = "导入模组"
	}
	if err == nil {
		campaign.CreatedAt = existing.CreatedAt
		campaign.ThemeID = existing.ThemeID
		if campaign.CreatedAt.IsZero() {
			campaign.CreatedAt = updatedAt
		}
	}
	if err := tx.Save(&campaign).Error; err != nil {
		return err
	}

	if err := tx.Where("campaign_id = ?", campaignID).Delete(&V2CampaignMember{}).Error; err != nil {
		return err
	}
	member := V2CampaignMember{
		CampaignID: campaignID,
		UserID:     userID,
		Role:       "owner",
		CreatedAt:  updatedAt,
		UpdatedAt:  updatedAt,
	}
	joinedAt := updatedAt
	member.JoinedAt = &joinedAt
	member.LastActiveAt = &joinedAt
	return tx.Save(&member).Error
}

func rewriteResourceRefsInString(text string, refMap map[string]string) string {
	if directRef, ok := normalizeBackupResourceRef(text); ok {
		if nextRef, exists := refMap[directRef]; exists {
			return nextRef
		}
	}
	return resourceURLPattern.ReplaceAllStringFunc(text, func(match string) string {
		sub := resourceURLPattern.FindStringSubmatch(match)
		if len(sub) < 2 {
			return match
		}
		ref, ok := decodeResourceURLPath(sub[1])
		if !ok {
			return match
		}
		nextRef, exists := refMap[ref]
		if !exists {
			return match
		}
		return buildResourceURL(nextRef)
	})
}

func applyResourceRefMapToValue(value any, refMap map[string]string) any {
	switch typed := value.(type) {
	case map[string]any:
		for key, item := range typed {
			typed[key] = applyResourceRefMapToValue(item, refMap)
		}
		return typed
	case []any:
		for index, item := range typed {
			typed[index] = applyResourceRefMapToValue(item, refMap)
		}
		return typed
	case string:
		return rewriteResourceRefsInString(typed, refMap)
	default:
		return value
	}
}

func remapResourceRefsForTypedValue[T any](input T, refMap map[string]string) (T, error) {
	if len(refMap) == 0 {
		return input, nil
	}
	var zero T
	payload, err := json.Marshal(input)
	if err != nil {
		return zero, err
	}
	var generic any
	if err := json.Unmarshal(payload, &generic); err != nil {
		return zero, err
	}
	generic = applyResourceRefMapToValue(generic, refMap)
	updated, err := json.Marshal(generic)
	if err != nil {
		return zero, err
	}
	var result T
	if err := json.Unmarshal(updated, &result); err != nil {
		return zero, err
	}
	return result, nil
}

func safeStoredAssetName(ref string, hash string) string {
	base := filepath.Base(ref)
	ext := filepath.Ext(base)
	name := strings.TrimSuffix(base, ext)
	if name == "" {
		name = "resource"
	}
	shortHash := hash
	if len(shortHash) > 10 {
		shortHash = shortHash[:10]
	}
	return fmt.Sprintf("%s-imported-%s%s", name, shortHash, ext)
}

func ensureImportedAsset(assetBaseDir string, oldRef string, content []byte) (string, error) {
	sum := sha256.Sum256(content)
	hash := fmt.Sprintf("%x", sum[:])
	if existingRef, ok := findExistingResourceRefByHash(assetBaseDir, hash); ok {
		return existingRef, nil
	}

	normalizedRef, ok := normalizeBackupResourceRef(oldRef)
	if !ok {
		return "", fmt.Errorf("invalid_resource_ref")
	}
	desiredFullPath := resourceRefToFullPath(assetBaseDir, normalizedRef)
	if err := os.MkdirAll(filepath.Dir(desiredFullPath), 0o755); err != nil {
		return "", err
	}
	if current, err := os.ReadFile(desiredFullPath); err == nil {
		currentHash := sha256.Sum256(current)
		if fmt.Sprintf("%x", currentHash[:]) == hash {
			return normalizedRef, nil
		}
		parentRef := resourceParentPath(normalizedRef)
		fileName := safeStoredAssetName(normalizedRef, hash)
		normalizedRef = pathpkg.Join(parentRef, fileName)
		desiredFullPath = resourceRefToFullPath(assetBaseDir, normalizedRef)
		if err := os.MkdirAll(filepath.Dir(desiredFullPath), 0o755); err != nil {
			return "", err
		}
	}
	if err := os.WriteFile(desiredFullPath, content, 0o644); err != nil {
		return "", err
	}
	return normalizedRef, nil
}

func importBundleAssetMap(campaign backupCampaignBundle) (map[string]struct{}, error) {
	payload, err := json.Marshal(campaign)
	if err != nil {
		return nil, err
	}
	var generic any
	if err := json.Unmarshal(payload, &generic); err != nil {
		return nil, err
	}
	result := make(map[string]struct{})
	collectResourceRefsFromValue(generic, result)
	return result, nil
}

func parseBackupArchive(content []byte) (backupManifest, backupBundle, map[string][]byte, error) {
	reader, err := zip.NewReader(bytes.NewReader(content), int64(len(content)))
	if err != nil {
		return backupManifest{}, backupBundle{}, nil, fmt.Errorf("invalid_zip")
	}

	var manifest backupManifest
	var bundle backupBundle
	assetContents := make(map[string][]byte)
	for _, item := range reader.File {
		switch item.Name {
		case "manifest.json":
			rc, err := item.Open()
			if err != nil {
				return backupManifest{}, backupBundle{}, nil, fmt.Errorf("invalid_manifest")
			}
			data, err := io.ReadAll(rc)
			_ = rc.Close()
			if err != nil || json.Unmarshal(data, &manifest) != nil {
				return backupManifest{}, backupBundle{}, nil, fmt.Errorf("invalid_manifest")
			}
		case "bundle.json":
			rc, err := item.Open()
			if err != nil {
				return backupManifest{}, backupBundle{}, nil, fmt.Errorf("invalid_bundle")
			}
			data, err := io.ReadAll(rc)
			_ = rc.Close()
			if err != nil || json.Unmarshal(data, &bundle) != nil {
				return backupManifest{}, backupBundle{}, nil, fmt.Errorf("invalid_bundle")
			}
		default:
			if !strings.HasPrefix(item.Name, "assets/") {
				continue
			}
			ref, ok := normalizeBackupResourceRef(strings.TrimPrefix(item.Name, "assets/"))
			if !ok {
				continue
			}
			rc, err := item.Open()
			if err != nil {
				return backupManifest{}, backupBundle{}, nil, fmt.Errorf("invalid_asset")
			}
			data, err := io.ReadAll(rc)
			_ = rc.Close()
			if err != nil {
				return backupManifest{}, backupBundle{}, nil, fmt.Errorf("invalid_asset")
			}
			assetContents[ref] = data
		}
	}

	if manifest.Format != backupBundleFormat || manifest.BundleSchemaVersion != backupBundleSchemaVersion {
		return backupManifest{}, backupBundle{}, nil, fmt.Errorf("unsupported_bundle")
	}
	if len(bundle.Campaigns) == 0 {
		return backupManifest{}, backupBundle{}, nil, fmt.Errorf("empty_bundle")
	}

	return manifest, bundle, assetContents, nil
}

func extractCampaignMeta(raw any) (string, string) {
	root, _ := raw.(map[string]any)
	meta, _ := root["meta"].(map[string]any)
	name := strings.TrimSpace(stringFromAny(meta["projectName"]))
	if name == "" {
		name = "未命名模组"
	}
	description := strings.TrimSpace(stringFromAny(meta["description"]))
	return name, description
}

func extractCollectionCounts(raw any) map[string]int {
	keys := []string{"characters", "monsters", "locations", "organizations", "events", "clues", "timelines", "sessionTasks", "relationGraphs"}
	root, _ := raw.(map[string]any)
	counts := make(map[string]int, len(keys))
	for _, key := range keys {
		list, _ := root[key].([]any)
		counts[key] = len(list)
	}
	return counts
}

func buildBackupPreview(fileName string, manifest backupManifest, bundle backupBundle, existing map[string]storedCampaignSummary) (backupPreviewResponse, error) {
	campaigns := make([]backupPreviewCampaign, 0, len(bundle.Campaigns))
	for _, item := range bundle.Campaigns {
		refSet, err := importBundleAssetMap(item)
		if err != nil {
			return backupPreviewResponse{}, err
		}
		name, description := extractCampaignMeta(item.CampaignData)
		preview := backupPreviewCampaign{
			OriginalCampaignID: item.OriginalCampaignID,
			Name:               name,
			Description:        description,
			CollectionCounts:   extractCollectionCounts(item.CampaignData),
			TeamNoteCount:      len(item.TeamNotes),
			AssetCount:         len(refSet),
		}
		if item.TaskBoard != nil {
			preview.TaskCount = len(item.TaskBoard.Tasks)
		}
		if matched, ok := existing[item.OriginalCampaignID]; ok {
			preview.MatchedCampaignID = matched.ID
			preview.MatchedCampaignName = matched.Name
		}
		campaigns = append(campaigns, preview)
	}
	return backupPreviewResponse{
		Manifest:  manifest,
		FileName:  fileName,
		Campaigns: campaigns,
	}, nil
}

func deleteCampaignDocuments(db *gorm.DB, campaignID string) error {
	if err := db.Where("key LIKE ?", teamNoteKey(campaignID, "")+"%").Delete(&KV{}).Error; err != nil {
		return err
	}
	keys := []string{
		taskBoardKey(campaignID),
		shareIndexKey(campaignID),
		versionIndexKey(campaignID),
	}
	if err := db.Where("key IN ?", keys).Delete(&KV{}).Error; err != nil {
		return err
	}
	return nil
}

func upsertStoredCampaignSummary(items []storedCampaignSummary, next storedCampaignSummary) []storedCampaignSummary {
	for index := range items {
		if items[index].ID == next.ID {
			items[index] = next
			return items
		}
	}
	return append(items, next)
}

func registerBackupRoutes(group *gin.RouterGroup, db *gorm.DB, cfg Config) {
	assetBaseDir := filepath.Dir(cfg.DBPath)

	group.GET("/campaigns/:campaignId/export", func(c *gin.Context) {
		campaignID := strings.TrimSpace(c.Param("campaignId"))
		userID, username := requestUser(c)
		includeAssets := requestIncludeAssets(c)
		if campaignID == "" || userID == "" || username == "" {
			c.JSON(400, gin.H{"error": "missing_identity"})
			return
		}
		bundleItem, err := buildBackupCampaignBundle(db, userID, campaignID)
		if err != nil {
			if err == gorm.ErrRecordNotFound {
				c.JSON(404, gin.H{"error": "not_found"})
				return
			}
			c.JSON(500, gin.H{"error": "database_error"})
			return
		}
		exportBackupBundle(c, assetBaseDir, "campaign", userID, username, backupBundle{
			Campaigns: []backupCampaignBundle{bundleItem},
		}, includeAssets)
	})

	group.GET("/export-all", func(c *gin.Context) {
		userID, username := requestUser(c)
		includeAssets := requestIncludeAssets(c)
		if userID == "" || username == "" {
			c.JSON(400, gin.H{"error": "missing_identity"})
			return
		}
		summaries, err := loadStoredCampaignSummaries(db, userID)
		if err != nil {
			c.JSON(500, gin.H{"error": "database_error"})
			return
		}
		if len(summaries) == 0 {
			c.JSON(404, gin.H{"error": "no_campaigns"})
			return
		}
		items := make([]backupCampaignBundle, 0, len(summaries))
		for _, summary := range summaries {
			item, err := buildBackupCampaignBundle(db, userID, summary.ID)
			if err != nil {
				continue
			}
			items = append(items, item)
		}
		if len(items) == 0 {
			c.JSON(404, gin.H{"error": "no_campaigns"})
			return
		}
		exportBackupBundle(c, assetBaseDir, "all", userID, username, backupBundle{Campaigns: items}, includeAssets)
	})

	group.POST("/export-client", func(c *gin.Context) {
		userID, username := requestUser(c)
		if userID == "" || username == "" {
			c.JSON(400, gin.H{"error": "missing_identity"})
			return
		}
		var payload struct {
			ExportType    string                 `json:"exportType"`
			IncludeAssets *bool                  `json:"includeAssets"`
			Campaigns     []backupCampaignBundle `json:"campaigns"`
		}
		if err := c.ShouldBindJSON(&payload); err != nil {
			c.JSON(400, gin.H{"error": "invalid_payload"})
			return
		}
		exportType := strings.TrimSpace(strings.ToLower(payload.ExportType))
		if exportType != "campaign" && exportType != "all" {
			exportType = "client"
		}
		includeAssets := true
		if payload.IncludeAssets != nil {
			includeAssets = *payload.IncludeAssets
		}
		items := make([]backupCampaignBundle, 0, len(payload.Campaigns))
		for _, item := range payload.Campaigns {
			if item.CampaignData == nil {
				continue
			}
			if strings.TrimSpace(item.OriginalCampaignID) == "" {
				root, _ := item.CampaignData.(map[string]any)
				item.OriginalCampaignID = strings.TrimSpace(stringFromAny(root["id"]))
			}
			items = append(items, item)
		}
		if len(items) == 0 {
			c.JSON(400, gin.H{"error": "empty_bundle"})
			return
		}
		exportBackupBundle(c, assetBaseDir, exportType, userID, username, backupBundle{Campaigns: items}, includeAssets)
	})

	group.POST("/preview", func(c *gin.Context) {
		userID, username := requestUser(c)
		if userID == "" || username == "" {
			c.JSON(400, gin.H{"error": "missing_identity"})
			return
		}
		file, header, err := c.Request.FormFile("file")
		if err != nil {
			c.JSON(400, gin.H{"error": "file_required"})
			return
		}
		defer file.Close()
		content, err := io.ReadAll(file)
		if err != nil {
			c.JSON(500, gin.H{"error": "read_failed"})
			return
		}
		manifest, bundle, _, err := parseBackupArchive(content)
		if err != nil {
			c.JSON(400, gin.H{"error": err.Error()})
			return
		}
		items, err := listV2Campaigns(db, userID)
		if err != nil {
			c.JSON(500, gin.H{"error": "database_error"})
			return
		}
		existing := make(map[string]storedCampaignSummary, len(items))
		for _, item := range items {
			existing[item.ID] = storedCampaignSummary{
				ID:            item.ID,
				Name:          item.Name,
				Description:   item.Description,
				LastModified:  item.LastModified,
				OwnerID:       item.OwnerID,
				Visibility:    item.Visibility,
				SchemaVersion: item.SchemaVersion,
			}
		}
		preview, err := buildBackupPreview(header.Filename, manifest, bundle, existing)
		if err != nil {
			c.JSON(400, gin.H{"error": "invalid_bundle"})
			return
		}
		c.JSON(200, preview)
	})

	group.POST("/import", func(c *gin.Context) {
		userID, username := requestUser(c)
		if userID == "" || username == "" {
			c.JSON(400, gin.H{"error": "missing_identity"})
			return
		}
		file, header, err := c.Request.FormFile("file")
		if err != nil {
			c.JSON(400, gin.H{"error": "file_required"})
			return
		}
		defer file.Close()
		content, err := io.ReadAll(file)
		if err != nil {
			c.JSON(500, gin.H{"error": "read_failed"})
			return
		}
		mode := strings.TrimSpace(strings.ToLower(c.PostForm("mode")))
		if mode == "" {
			mode = "add"
		}
		if mode != "add" && mode != "overwrite" {
			c.JSON(400, gin.H{"error": "invalid_mode"})
			return
		}
		_, bundle, assetContents, err := parseBackupArchive(content)
		if err != nil {
			c.JSON(400, gin.H{"error": err.Error()})
			return
		}

		items, err := listV2Campaigns(db, userID)
		if err != nil {
			c.JSON(500, gin.H{"error": "database_error"})
			return
		}
		existing := make(map[string]storedCampaignSummary, len(items))
		for _, item := range items {
			existing[item.ID] = storedCampaignSummary{
				ID:            item.ID,
				Name:          item.Name,
				Description:   item.Description,
				LastModified:  item.LastModified,
				OwnerID:       item.OwnerID,
				Visibility:    item.Visibility,
				SchemaVersion: item.SchemaVersion,
			}
		}

		now := time.Now().UnixMilli()
		imported := make([]gin.H, 0, len(bundle.Campaigns))
		skipped := make([]gin.H, 0)
		addedCount := 0
		overwrittenCount := 0
		skippedCount := 0
		importedAssetMap := make(map[string]string)
		missingAssetSet := make(map[string]struct{})
		for _, item := range bundle.Campaigns {
			itemName, _ := extractCampaignMeta(item.CampaignData)
			if mode == "overwrite" {
				if _, ok := existing[item.OriginalCampaignID]; !ok {
					skippedCount += 1
					skipped = append(skipped, gin.H{
						"originalCampaignId": item.OriginalCampaignID,
						"name":               itemName,
						"reason":             "no_match",
					})
					continue
				}
			}
			refSet, err := importBundleAssetMap(item)
			if err != nil {
				c.JSON(400, gin.H{"error": "invalid_bundle"})
				return
			}
			refMap := make(map[string]string, len(refSet))
			for oldRef := range refSet {
				if mapped, ok := importedAssetMap[oldRef]; ok {
					refMap[oldRef] = mapped
					continue
				}
				rawAsset, ok := assetContents[oldRef]
				if !ok {
					missingAssetSet[oldRef] = struct{}{}
					continue
				}
				nextRef, err := ensureImportedAsset(assetBaseDir, oldRef, rawAsset)
				if err != nil {
					c.JSON(500, gin.H{"error": "asset_import_failed", "ref": oldRef})
					return
				}
				importedAssetMap[oldRef] = nextRef
				refMap[oldRef] = nextRef
			}

			campaignDataValue := applyResourceRefMapToValue(item.CampaignData, refMap)
			targetCampaignID := makeImportedCampaignID()
			resultMode := "added"
			if mode == "overwrite" {
				if matched, ok := existing[item.OriginalCampaignID]; ok {
					targetCampaignID = matched.ID
					resultMode = "overwritten"
				}
			}
			campaignDataValue, projectName, description, err := setImportedCampaignData(campaignDataValue, targetCampaignID, now)
			if err != nil {
				c.JSON(400, gin.H{"error": "invalid_campaign_payload"})
				return
			}
			importedBundle, err := buildImportedV2Bundle(targetCampaignID, campaignDataValue)
			if err != nil {
				c.JSON(400, gin.H{"error": "invalid_campaign_payload"})
				return
			}

			importedConfig := CampaignConfigDoc{
				CampaignID:             targetCampaignID,
				Name:                   projectName,
				Description:            description,
				LastModified:           now,
				Visibility:             "private",
				JoinPasswordHash:       "",
				JoinPasswordConfigured: false,
				OwnerUserID:            userID,
				SchemaVersion:          2,
				Members: []CampaignMember{{
					UserID:       userID,
					Username:     username,
					Role:         "GM",
					JoinedAt:     now,
					LastActiveAt: now,
				}},
				CreatedAt: now,
				UpdatedAt: now,
			}
			if item.Config != nil {
				remappedConfig, err := remapResourceRefsForTypedValue(*item.Config, refMap)
				if err == nil {
					importedConfig = remappedConfig
				}
				importedConfig.CampaignID = targetCampaignID
				importedConfig.Name = projectName
				importedConfig.Description = description
				importedConfig.LastModified = now
				importedConfig.Visibility = "private"
				importedConfig.JoinPasswordHash = ""
				importedConfig.JoinPasswordConfigured = false
				importedConfig.OwnerUserID = userID
				importedConfig.SchemaVersion = intMax(importedConfig.SchemaVersion, 2)
				importedConfig.Members = []CampaignMember{{
					UserID:       userID,
					Username:     username,
					Role:         "GM",
					JoinedAt:     now,
					LastActiveAt: now,
				}}
				if importedConfig.CreatedAt == 0 {
					importedConfig.CreatedAt = now
				}
				importedConfig.UpdatedAt = now
			}
			updatedAt := time.UnixMilli(now)
			if err := db.Transaction(func(tx *gorm.DB) error {
				if resultMode == "overwritten" {
					if err := deleteCampaignDocuments(tx, targetCampaignID); err != nil {
						return err
					}
					if err := tx.Where("campaign_id = ?", targetCampaignID).Delete(&V2TeamNote{}).Error; err != nil {
						return err
					}
					if err := tx.Where("campaign_id = ?", targetCampaignID).Delete(&V2Share{}).Error; err != nil {
						return err
					}
					if err := tx.Where("campaign_id = ?", targetCampaignID).Delete(&V2DocumentVersion{}).Error; err != nil {
						return err
					}
				}
				if _, err := kvSaveJSON(tx, userCampaignKey(userID, targetCampaignID), campaignDataValue); err != nil {
					return err
				}
				if err := upsertImportedV2Campaign(tx, targetCampaignID, userID, projectName, description, updatedAt); err != nil {
					return err
				}
				if _, err := saveV2CampaignBundle(tx, targetCampaignID, V2CampaignBundleUpdateRequest{
					ExpectedVersion: 0,
					Bundle:          importedBundle,
				}); err != nil {
					return err
				}
				if err := saveCampaignConfigDoc(tx, importedConfig); err != nil {
					return err
				}
				for _, note := range item.TeamNotes {
					remappedNote, err := remapResourceRefsForTypedValue(note, refMap)
					if err != nil {
						return fmt.Errorf("invalid_team_note")
					}
					remappedNote.CampaignID = targetCampaignID
					remappedNote.ActiveLease = nil
					if strings.TrimSpace(remappedNote.ID) == "" {
						remappedNote.ID = fmt.Sprintf("tn_%d", time.Now().UnixNano())
					}
					if remappedNote.CreatedAt == 0 {
						remappedNote.CreatedAt = now
					}
					if remappedNote.UpdatedAt == 0 {
						remappedNote.UpdatedAt = now
					}
					if remappedNote.Version <= 0 {
						remappedNote.Version = 1
					}
					if _, err := kvSaveJSON(tx, teamNoteKey(targetCampaignID, remappedNote.ID), remappedNote); err != nil {
						return err
					}
				}
				if item.TaskBoard != nil {
					remappedBoard, err := remapResourceRefsForTypedValue(*item.TaskBoard, refMap)
					if err != nil {
						return fmt.Errorf("invalid_task_board")
					}
					remappedBoard.CampaignID = targetCampaignID
					remappedBoard.ActiveLease = nil
					remappedBoard.UpdatedAt = now
					if remappedBoard.Version <= 0 {
						remappedBoard.Version = 1
					}
					ensureTaskBoardPermissions(&remappedBoard)
					if _, err := kvSaveJSON(tx, taskBoardKey(targetCampaignID), remappedBoard); err != nil {
						return err
					}
				}
				return nil
			}); err != nil {
				switch err.Error() {
				case "invalid_team_note", "invalid_task_board":
					c.JSON(400, gin.H{"error": err.Error()})
				default:
					c.JSON(500, gin.H{"error": "database_error"})
				}
				return
			}

			existing[targetCampaignID] = storedCampaignSummary{
				ID:            targetCampaignID,
				Name:          projectName,
				Description:   description,
				LastModified:  now,
				OwnerID:       userID,
				Visibility:    "private",
				SchemaVersion: 2,
			}
			imported = append(imported, gin.H{
				"id":          targetCampaignID,
				"name":        projectName,
				"description": description,
				"sourceName":  header.Filename,
				"originalId":  item.OriginalCampaignID,
				"mode":        resultMode,
			})
			if resultMode == "overwritten" {
				overwrittenCount++
			} else {
				addedCount++
			}
		}

		missingAssets := make([]string, 0, len(missingAssetSet))
		for ref := range missingAssetSet {
			missingAssets = append(missingAssets, ref)
		}
		sort.Strings(missingAssets)

		c.JSON(200, gin.H{
			"importedCount":     len(imported),
			"addedCount":        addedCount,
			"overwrittenCount":  overwrittenCount,
			"skippedCount":      skippedCount,
			"campaigns":         imported,
			"skippedCampaigns":  skipped,
			"missingAssetCount": len(missingAssets),
			"missingAssets":     missingAssets,
		})
	})
}
