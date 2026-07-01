package main

import (
	"encoding/json"
	"fmt"
	"slices"
	"strings"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

const (
	characterSheetDocumentType   = "character_sheet"
	characterSheetSystemCoC7     = "coc7"
	characterSheetSystemDnd5e    = "dnd5e"
	characterSheetPermissionRead = "read"
	characterSheetPermissionEdit = "edit"
)

type CharacterSheetSummary struct {
	ID               string `json:"id"`
	CampaignID       string `json:"campaignId"`
	LinkedEntityID   string `json:"linkedEntityId,omitempty"`
	LinkedEntityType string `json:"linkedEntityType,omitempty"`
	Name             string `json:"name"`
	System           string `json:"system"`
	Summary          string `json:"summary"`
	Visibility       string `json:"visibility"`
	OwnerUserID      string `json:"ownerUserId"`
	OwnerUsername    string `json:"ownerUsername"`
	UpdatedAt        int64  `json:"updatedAt"`
	UpdatedBy        string `json:"updatedBy"`
}

type CharacterSheetBaseInfo struct {
	Title           string   `json:"title,omitempty"`
	Age             string   `json:"age,omitempty"`
	Gender          string   `json:"gender,omitempty"`
	Background      string   `json:"background,omitempty"`
	Notes           string   `json:"notes,omitempty"`
	AvatarAssetPath string   `json:"avatarAssetPath,omitempty"`
	Tags            []string `json:"tags,omitempty"`
}

type CharacterSheetPayload struct {
	Base  CharacterSheetBaseInfo `json:"base"`
	CoC7  map[string]any         `json:"coc7,omitempty"`
	Dnd5e map[string]any         `json:"dnd5e,omitempty"`
}

type CharacterSheetMemberPermission struct {
	UserID     string `json:"userId"`
	Permission string `json:"permission"`
}

type CharacterSheetDocument struct {
	ID                string                           `json:"id"`
	CampaignID        string                           `json:"campaignId"`
	LinkedEntityID    string                           `json:"linkedEntityId,omitempty"`
	LinkedEntityType  string                           `json:"linkedEntityType,omitempty"`
	Name              string                           `json:"name"`
	System            string                           `json:"system"`
	Summary           string                           `json:"summary,omitempty"`
	AvatarAssetPath   string                           `json:"avatarAssetPath,omitempty"`
	Visibility        string                           `json:"visibility"`
	AssignedUserIDs   []string                         `json:"assignedUserIds,omitempty"`
	MemberPermissions []CharacterSheetMemberPermission `json:"memberPermissions,omitempty"`
	OwnerUserID       string                           `json:"ownerUserId"`
	OwnerUsername     string                           `json:"ownerUsername"`
	CreatedAt         int64                            `json:"createdAt"`
	UpdatedAt         int64                            `json:"updatedAt"`
	UpdatedBy         string                           `json:"updatedBy"`
	UpdatedByName     string                           `json:"updatedByName"`
	Version           int                              `json:"version"`
	Payload           CharacterSheetPayload            `json:"payload"`
}

type CharacterSheetCreateRequest struct {
	Name     string `json:"name"`
	System   string `json:"system"`
	Summary  string `json:"summary"`
	EntityID string `json:"linkedEntityId,omitempty"`
}

type CharacterSheetUpdateRequest struct {
	ExpectedVersion *int                   `json:"expectedVersion,omitempty"`
	Sheet           CharacterSheetDocument `json:"sheet"`
}

type CharacterSheetConflictError struct {
	Current CharacterSheetDocument
}

func (e *CharacterSheetConflictError) Error() string {
	return "conflict"
}

func normalizeCharacterSheetSystem(raw string) string {
	switch strings.TrimSpace(raw) {
	case characterSheetSystemDnd5e:
		return characterSheetSystemDnd5e
	default:
		return characterSheetSystemCoC7
	}
}

func normalizeCharacterSheetVisibility(raw string) string {
	switch strings.TrimSpace(raw) {
	case "party_read":
		return "party_read"
	case "party_edit":
		return "party_edit"
	case "assigned_only":
		return "assigned_only"
	default:
		return "owner_only"
	}
}

func normalizeCharacterSheetPermission(raw string) string {
	switch strings.TrimSpace(raw) {
	case characterSheetPermissionEdit:
		return characterSheetPermissionEdit
	default:
		return characterSheetPermissionRead
	}
}

func characterSheetPermissionRank(permission string) int {
	if normalizeCharacterSheetPermission(permission) == characterSheetPermissionEdit {
		return 2
	}
	return 1
}

func mergeCharacterSheetPermission(entries map[string]string, userID, permission string) {
	normalizedUserID := strings.TrimSpace(userID)
	if normalizedUserID == "" {
		return
	}
	normalizedPermission := normalizeCharacterSheetPermission(permission)
	current, ok := entries[normalizedUserID]
	if !ok || characterSheetPermissionRank(normalizedPermission) > characterSheetPermissionRank(current) {
		entries[normalizedUserID] = normalizedPermission
	}
}

func normalizeCharacterSheetMemberPermissions(permissions []CharacterSheetMemberPermission, legacyAssigned []string) []CharacterSheetMemberPermission {
	merged := make(map[string]string, len(permissions)+len(legacyAssigned))
	for _, permission := range permissions {
		mergeCharacterSheetPermission(merged, permission.UserID, permission.Permission)
	}
	for _, userID := range legacyAssigned {
		mergeCharacterSheetPermission(merged, userID, characterSheetPermissionEdit)
	}
	result := make([]CharacterSheetMemberPermission, 0, len(merged))
	for userID, permission := range merged {
		result = append(result, CharacterSheetMemberPermission{
			UserID:     userID,
			Permission: permission,
		})
	}
	slices.SortFunc(result, func(a, b CharacterSheetMemberPermission) int {
		return strings.Compare(a.UserID, b.UserID)
	})
	return result
}

func characterSheetPermissionForUser(doc CharacterSheetDocument, userID string) string {
	for _, permission := range doc.MemberPermissions {
		if permission.UserID == userID {
			return permission.Permission
		}
	}
	return ""
}

func normalizeCharacterSheet(doc CharacterSheetDocument) CharacterSheetDocument {
	doc.System = normalizeCharacterSheetSystem(doc.System)
	doc.Visibility = normalizeCharacterSheetVisibility(doc.Visibility)
	doc.LinkedEntityType = strings.TrimSpace(doc.LinkedEntityType)
	doc.LinkedEntityID = strings.TrimSpace(doc.LinkedEntityID)
	if doc.LinkedEntityType != "characters" || doc.LinkedEntityID == "" {
		doc.LinkedEntityType = ""
		doc.LinkedEntityID = ""
	}
	doc.Name = strings.TrimSpace(doc.Name)
	if doc.Name == "" {
		if doc.System == characterSheetSystemDnd5e {
			doc.Name = "新的 DND 角色卡"
		} else {
			doc.Name = "新的 CoC 角色卡"
		}
	}
	doc.Summary = strings.TrimSpace(doc.Summary)
	doc.MemberPermissions = normalizeCharacterSheetMemberPermissions(doc.MemberPermissions, doc.AssignedUserIDs)
	doc.AssignedUserIDs = nil
	if strings.TrimSpace(doc.AvatarAssetPath) == "" {
		doc.AvatarAssetPath = strings.TrimSpace(doc.Payload.Base.AvatarAssetPath)
	}
	doc.Payload.Base.AvatarAssetPath = doc.AvatarAssetPath
	if doc.Payload.Base.Tags == nil {
		doc.Payload.Base.Tags = []string{}
	}
	if doc.System == characterSheetSystemDnd5e {
		if doc.Payload.Dnd5e == nil {
			doc.Payload.Dnd5e = defaultCharacterSheetPayload(characterSheetSystemDnd5e).Dnd5e
		}
		doc.Payload.CoC7 = nil
	} else {
		if doc.Payload.CoC7 == nil {
			doc.Payload.CoC7 = defaultCharacterSheetPayload(characterSheetSystemCoC7).CoC7
		}
		doc.Payload.Dnd5e = nil
	}
	return doc
}

func normalizeStringList(items []string) []string {
	result := make([]string, 0, len(items))
	for _, item := range items {
		trimmed := strings.TrimSpace(item)
		if trimmed == "" {
			continue
		}
		result = append(result, trimmed)
	}
	return result
}

func defaultCharacterSheetPayload(system string) CharacterSheetPayload {
	payload := CharacterSheetPayload{
		Base: CharacterSheetBaseInfo{
			Tags: []string{},
		},
	}
	if system == characterSheetSystemDnd5e {
		payload.Dnd5e = map[string]any{
			"race":             "",
			"className":        "",
			"subclass":         "",
			"level":            1,
			"alignment":        "",
			"proficiencyBonus": 2,
			"stats": map[string]any{
				"str": 10,
				"dex": 10,
				"con": 10,
				"int": 10,
				"wis": 10,
				"cha": 10,
			},
			"derived": map[string]any{
				"ac":                  10,
				"initiative":          0,
				"speed":               "30ft",
				"hp":                  map[string]any{"current": 10, "max": 10, "temporary": 0},
				"passivePerception":   10,
				"spellcastingAbility": "",
				"spellSaveDc":         10,
				"spellAttackBonus":    2,
				"hitDiceTotal":        "",
				"hitDiceUsed":         0,
			},
			"currency": map[string]any{
				"cp": 0,
				"sp": 0,
				"ep": 0,
				"gp": 0,
				"pp": 0,
			},
			"skills": map[string]any{
				"运动": 0,
				"体操": 0,
				"巧手": 0,
				"隐匿": 0,
				"调查": 0,
				"奥秘": 0,
				"历史": 0,
				"自然": 0,
				"宗教": 0,
				"察觉": 0,
				"洞悉": 0,
				"驯兽": 0,
				"医药": 0,
				"求生": 0,
				"游说": 0,
				"欺瞒": 0,
				"威吓": 0,
				"表演": 0,
			},
		}
	} else {
		payload.CoC7 = map[string]any{
			"occupation": "",
			"stats": map[string]any{
				"str": 50,
				"con": 50,
				"siz": 50,
				"dex": 50,
				"app": 50,
				"int": 50,
				"pow": 50,
				"edu": 50,
			},
			"derived": map[string]any{
				"hp":          map[string]any{"current": 10, "max": 10},
				"san":         map[string]any{"current": 50, "max": 99},
				"mp":          map[string]any{"current": 10, "max": 10},
				"luck":        50,
				"mov":         8,
				"build":       "0",
				"damageBonus": "0",
			},
			"backstory": map[string]any{
				"appearance":           "",
				"ideology":             "",
				"significantPeople":    "",
				"meaningfulLocations":  "",
				"treasuredPossessions": "",
				"traits":               "",
				"injuries":             "",
				"phobiasAndManias":     "",
			},
			"skills": []map[string]any{},
		}
	}
	return payload
}

func newCharacterSheetDocument(campaignID, userID, username string, req CharacterSheetCreateRequest) CharacterSheetDocument {
	now := time.Now().UnixMilli()
	system := normalizeCharacterSheetSystem(req.System)
	name := strings.TrimSpace(req.Name)
	if name == "" {
		if system == characterSheetSystemDnd5e {
			name = "新的 DND 角色卡"
		} else {
			name = "新的 CoC 角色卡"
		}
	}
	return CharacterSheetDocument{
		ID:                uuid.NewString(),
		CampaignID:        campaignID,
		LinkedEntityID:    strings.TrimSpace(req.EntityID),
		Name:              name,
		System:            system,
		Summary:           strings.TrimSpace(req.Summary),
		Visibility:        "owner_only",
		MemberPermissions: []CharacterSheetMemberPermission{},
		OwnerUserID:       userID,
		OwnerUsername:     username,
		CreatedAt:         now,
		UpdatedAt:         now,
		UpdatedBy:         userID,
		UpdatedByName:     username,
		Version:           1,
		Payload:           defaultCharacterSheetPayload(system),
	}
}

func canViewCharacterSheet(doc CharacterSheetDocument, userID, role string) bool {
	if isCampaignManagerRole(role) || doc.OwnerUserID == userID {
		return true
	}
	permission := characterSheetPermissionForUser(doc, userID)
	if permission == characterSheetPermissionRead || permission == characterSheetPermissionEdit {
		return true
	}
	switch normalizeCharacterSheetVisibility(doc.Visibility) {
	case "party_read", "party_edit":
		return true
	default:
		return false
	}
}

func canEditCharacterSheet(doc CharacterSheetDocument, userID, role string) bool {
	if isCampaignManagerRole(role) || doc.OwnerUserID == userID {
		return true
	}
	if characterSheetPermissionForUser(doc, userID) == characterSheetPermissionEdit {
		return true
	}
	switch normalizeCharacterSheetVisibility(doc.Visibility) {
	case "party_edit":
		return true
	default:
		return false
	}
}

func canManageCharacterSheetPermissions(doc CharacterSheetDocument, userID, role string) bool {
	return isCampaignManagerRole(role) || doc.OwnerUserID == userID
}

func canManageCharacterSheetEntityLink(role string) bool {
	return isCampaignManagerRole(role)
}

func sanitizeCharacterSheetAccessControls(current, next CharacterSheetDocument, cfg CampaignConfigDoc, userID, role string) CharacterSheetDocument {
	canManagePermissions := canManageCharacterSheetPermissions(current, userID, role)
	canManageEntityLink := canManageCharacterSheetEntityLink(role)
	if !canManagePermissions {
		next.Visibility = current.Visibility
		next.MemberPermissions = current.MemberPermissions
		next.OwnerUserID = current.OwnerUserID
		next.OwnerUsername = current.OwnerUsername
	}
	if !canManageEntityLink {
		next.LinkedEntityID = current.LinkedEntityID
		next.LinkedEntityType = current.LinkedEntityType
	}
	if !canManagePermissions {
		return next
	}

	next.Visibility = normalizeCharacterSheetVisibility(next.Visibility)
	next.MemberPermissions = normalizeCharacterSheetMemberPermissions(next.MemberPermissions, next.AssignedUserIDs)
	if !isCampaignManagerRole(role) {
		next.OwnerUserID = current.OwnerUserID
		next.OwnerUsername = current.OwnerUsername
		return next
	}

	requestedOwnerID := strings.TrimSpace(next.OwnerUserID)
	if requestedOwnerID == "" {
		next.OwnerUserID = current.OwnerUserID
		next.OwnerUsername = current.OwnerUsername
		return next
	}
	if !isCampaignMember(cfg, requestedOwnerID) {
		next.OwnerUserID = current.OwnerUserID
		next.OwnerUsername = current.OwnerUsername
		return next
	}
	next.OwnerUserID = requestedOwnerID
	next.OwnerUsername = memberUsername(cfg, requestedOwnerID)
	return next
}

func loadCharacterSheet(db *gorm.DB, campaignID, sheetID string) (CharacterSheetDocument, bool, error) {
	var docRow V2CampaignDocument
	err := db.First(&docRow, "campaign_id = ? AND document_type = ? AND id = ?", campaignID, characterSheetDocumentType, characterSheetRowID(sheetID)).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return CharacterSheetDocument{}, false, nil
		}
		return CharacterSheetDocument{}, false, err
	}
	var doc CharacterSheetDocument
	if err := json.Unmarshal([]byte(docRow.ContentJSON), &doc); err != nil {
		return CharacterSheetDocument{}, false, err
	}
	doc = normalizeCharacterSheet(doc)
	return doc, true, nil
}

func listCharacterSheets(db *gorm.DB, campaignID, userID, role string) ([]CharacterSheetSummary, error) {
	var rows []V2CampaignDocument
	if err := db.Where("campaign_id = ? AND document_type = ?", campaignID, characterSheetDocumentType).Order("updated_at desc").Find(&rows).Error; err != nil {
		return nil, err
	}
	result := make([]CharacterSheetSummary, 0, len(rows))
	for _, row := range rows {
		var doc CharacterSheetDocument
		if err := json.Unmarshal([]byte(row.ContentJSON), &doc); err != nil {
			continue
		}
		doc = normalizeCharacterSheet(doc)
		if !canViewCharacterSheet(doc, userID, role) {
			continue
		}
		result = append(result, CharacterSheetSummary{
			ID:               doc.ID,
			CampaignID:       doc.CampaignID,
			LinkedEntityID:   doc.LinkedEntityID,
			LinkedEntityType: doc.LinkedEntityType,
			Name:             doc.Name,
			System:           doc.System,
			Summary:          doc.Summary,
			Visibility:       doc.Visibility,
			OwnerUserID:      doc.OwnerUserID,
			OwnerUsername:    doc.OwnerUsername,
			UpdatedAt:        doc.UpdatedAt,
			UpdatedBy:        doc.UpdatedByName,
		})
	}
	return result, nil
}

func characterSheetRowID(sheetID string) string {
	return fmt.Sprintf("character_sheet:%s", sheetID)
}

func saveCharacterSheet(tx *gorm.DB, doc CharacterSheetDocument) error {
	doc = normalizeCharacterSheet(doc)
	payload, err := json.Marshal(doc)
	if err != nil {
		return err
	}
	now := time.Now()
	var existing V2CampaignDocument
	err = tx.First(&existing, "campaign_id = ? AND document_type = ? AND id = ?", doc.CampaignID, characterSheetDocumentType, characterSheetRowID(doc.ID)).Error
	if err != nil && err != gorm.ErrRecordNotFound {
		return err
	}
	row := V2CampaignDocument{
		ID:            characterSheetRowID(doc.ID),
		CampaignID:    doc.CampaignID,
		DocumentType:  characterSheetDocumentType,
		SchemaVersion: 2,
		Version:       doc.Version,
		ContentJSON:   string(payload),
		CreatedAt:     now,
		UpdatedAt:     now,
	}
	if err == nil {
		row.CreatedAt = existing.CreatedAt
	}
	return tx.Save(&row).Error
}

func createCharacterSheet(db *gorm.DB, campaignID, userID, username string, req CharacterSheetCreateRequest) (CharacterSheetDocument, error) {
	doc := newCharacterSheetDocument(campaignID, userID, username, req)
	if err := db.Transaction(func(tx *gorm.DB) error {
		return saveCharacterSheet(tx, doc)
	}); err != nil {
		return CharacterSheetDocument{}, err
	}
	return doc, nil
}

func updateCharacterSheet(db *gorm.DB, campaignID, sheetID, userID, username string, req CharacterSheetUpdateRequest, cfg CampaignConfigDoc, role string) (CharacterSheetDocument, error) {
	current, ok, err := loadCharacterSheet(db, campaignID, sheetID)
	if err != nil {
		return CharacterSheetDocument{}, err
	}
	if !ok {
		return CharacterSheetDocument{}, gorm.ErrRecordNotFound
	}
	if !canEditCharacterSheet(current, userID, role) {
		return CharacterSheetDocument{}, errCampaignForbidden
	}
	if req.ExpectedVersion != nil && *req.ExpectedVersion > 0 && *req.ExpectedVersion != current.Version {
		return CharacterSheetDocument{}, &CharacterSheetConflictError{Current: current}
	}
	next := req.Sheet
	next.ID = current.ID
	next.CampaignID = current.CampaignID
	next = sanitizeCharacterSheetAccessControls(current, next, cfg, userID, role)
	next.CreatedAt = current.CreatedAt
	next.UpdatedAt = time.Now().UnixMilli()
	next.UpdatedBy = userID
	next.UpdatedByName = username
	next.Version = current.Version + 1
	next = normalizeCharacterSheet(next)
	if err := db.Transaction(func(tx *gorm.DB) error {
		return saveCharacterSheet(tx, next)
	}); err != nil {
		return CharacterSheetDocument{}, err
	}
	return next, nil
}

func deleteCharacterSheet(db *gorm.DB, campaignID, sheetID string) error {
	return db.Delete(&V2CampaignDocument{}, "campaign_id = ? AND document_type = ? AND id = ?", campaignID, characterSheetDocumentType, characterSheetRowID(sheetID)).Error
}
