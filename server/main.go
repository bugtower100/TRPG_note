package main

import (
	"crypto/sha256"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"log"
	"mime"
	"net/url"
	"os"
	"path/filepath"
	"slices"
	"sort"
	"strings"
	"time"
	"unicode"

	"runtime"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/spf13/viper"
	"gorm.io/gorm"
)

type Config struct {
	Port   int    `mapstructure:"port"`
	DBPath string `mapstructure:"db_path"`
}

type KV struct {
	Key       string `gorm:"primaryKey;size:255"`
	Value     string `gorm:"type:text"`
	Version   int    `gorm:"not null;default:1"`
	CreatedAt time.Time
	UpdatedAt time.Time
}

type CampaignMember struct {
	UserID       string `json:"userId"`
	Username     string `json:"username"`
	Role         string `json:"role"`
	JoinedAt     int64  `json:"joinedAt"`
	LastActiveAt int64  `json:"lastActiveAt"`
}

type CampaignConfigDoc struct {
	CampaignID    string           `json:"campaignId"`
	Name          string           `json:"name"`
	Description   string           `json:"description"`
	LastModified  int64            `json:"lastModified"`
	Visibility    string           `json:"visibility"`
	OwnerUserID   string           `json:"ownerUserId"`
	SchemaVersion int              `json:"schemaVersion"`
	Members       []CampaignMember `json:"members"`
	CreatedAt     int64            `json:"createdAt"`
	UpdatedAt     int64            `json:"updatedAt"`
}

type TeamNoteLease struct {
	UserID    string `json:"userId"`
	Username  string `json:"username"`
	Role      string `json:"role"`
	StartedAt int64  `json:"startedAt"`
	ExpiresAt *int64 `json:"expiresAt,omitempty"`
}

type TeamNoteDoc struct {
	ID            string         `json:"id"`
	CampaignID    string         `json:"campaignId"`
	Title         string         `json:"title"`
	Content       string         `json:"content"`
	CreatedBy     string         `json:"createdBy"`
	CreatedByName string         `json:"createdByName"`
	UpdatedBy     string         `json:"updatedBy"`
	UpdatedByName string         `json:"updatedByName"`
	CreatedAt     int64          `json:"createdAt"`
	UpdatedAt     int64          `json:"updatedAt"`
	Version       int            `json:"version"`
	ActiveLease   *TeamNoteLease `json:"activeLease,omitempty"`
}

type PublicCampaignSummary struct {
	ID                string `json:"id"`
	Name              string `json:"name"`
	Description       string `json:"description"`
	LastModified      int64  `json:"lastModified"`
	OwnerID           string `json:"ownerId"`
	OwnerUsername     string `json:"ownerUsername"`
	Visibility        string `json:"visibility"`
	MemberCount       int    `json:"memberCount"`
	OnlineMemberCount int    `json:"onlineMemberCount"`
}

type SharedEntitySnapshot struct {
	EntityName     string           `json:"entityName"`
	EntityType     string           `json:"entityType"`
	Scope          string           `json:"scope"`
	SectionKey     string           `json:"sectionKey,omitempty"`
	SectionTitle   string           `json:"sectionTitle,omitempty"`
	SubItemID      string           `json:"subItemId,omitempty"`
	SubItemTitle   string           `json:"subItemTitle,omitempty"`
	Details        string           `json:"details,omitempty"`
	TimelineEvents []map[string]any `json:"timelineEvents,omitempty"`
	SectionItems   []map[string]any `json:"sectionItems,omitempty"`
	SubItem        map[string]any   `json:"subItem,omitempty"`
	AllSections    []map[string]any `json:"allSections,omitempty"`
}

type SharedEntityRecord struct {
	ID                  string               `json:"id"`
	CampaignID          string               `json:"campaignId"`
	EntityType          string               `json:"entityType"`
	EntityID            string               `json:"entityId"`
	EntityName          string               `json:"entityName"`
	Scope               string               `json:"scope"`
	ScopeID             string               `json:"scopeId,omitempty"`
	Permission          string               `json:"permission"`
	SourceOwnerUserID   string               `json:"sourceOwnerUserId"`
	SourceOwnerUsername string               `json:"sourceOwnerUsername"`
	TargetUserID        string               `json:"targetUserId"`
	TargetUsername      string               `json:"targetUsername"`
	SharedByUserID      string               `json:"sharedByUserId"`
	SharedByUsername    string               `json:"sharedByUsername"`
	CreatedAt           int64                `json:"createdAt"`
	UpdatedAt           int64                `json:"updatedAt"`
	Version             int                  `json:"version"`
	ActiveLease         *TeamNoteLease       `json:"activeLease,omitempty"`
	Snapshot            SharedEntitySnapshot `json:"snapshot"`
}

type VersionRecord struct {
	ID               string         `json:"id"`
	CampaignID       string         `json:"campaignId"`
	DocumentType     string         `json:"documentType"`
	DocumentID       string         `json:"documentId"`
	Action           string         `json:"action"`
	Summary          string         `json:"summary"`
	OperatorUserID   string         `json:"operatorUserId"`
	OperatorUsername string         `json:"operatorUsername"`
	CreatedAt        int64          `json:"createdAt"`
	Snapshot         map[string]any `json:"snapshot"`
	PreviousSnapshot map[string]any `json:"previousSnapshot,omitempty"`
}

func kvLoadJSON[T any](db *gorm.DB, key string, out *T) (bool, *KV, error) {
	var item KV
	if err := db.First(&item, "key = ?", key).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return false, nil, nil
		}
		return false, nil, err
	}
	if err := json.Unmarshal([]byte(item.Value), out); err != nil {
		return false, &item, err
	}
	return true, &item, nil
}

func kvSaveJSON(db *gorm.DB, key string, value any) (*KV, error) {
	data, err := json.Marshal(value)
	if err != nil {
		return nil, err
	}
	var item KV
	if err := db.First(&item, "key = ?", key).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			item = KV{Key: key, Value: string(data), Version: 1}
			if err := db.Create(&item).Error; err != nil {
				return nil, err
			}
			return &item, nil
		}
		return nil, err
	}
	item.Value = string(data)
	item.Version++
	if err := db.Save(&item).Error; err != nil {
		return nil, err
	}
	return &item, nil
}

func campaignConfigKey(campaignID string) string {
	return "campaign:" + campaignID + ":config"
}

func teamNoteKey(campaignID, noteID string) string {
	return "campaign:" + campaignID + ":team:" + noteID
}

func publicCampaignIndexKey() string {
	return "campaign:public:index"
}

func shareIndexKey(campaignID string) string {
	return "campaign:" + campaignID + ":shares"
}

func versionIndexKey(campaignID string) string {
	return "campaign:" + campaignID + ":versions"
}

func requestUser(c *gin.Context) (string, string) {
	userID := strings.TrimSpace(c.GetHeader("X-TRPG-User-Id"))
	username := strings.TrimSpace(c.GetHeader("X-TRPG-Username"))
	if username != "" {
		if decoded, err := url.PathUnescape(username); err == nil {
			username = strings.TrimSpace(decoded)
		}
	}
	return userID, username
}

func loadPublicCampaignIndex(db *gorm.DB) ([]PublicCampaignSummary, error) {
	var items []PublicCampaignSummary
	ok, _, err := kvLoadJSON(db, publicCampaignIndexKey(), &items)
	if err != nil {
		return nil, err
	}
	if !ok {
		return []PublicCampaignSummary{}, nil
	}
	return items, nil
}

func loadShareIndex(db *gorm.DB, campaignID string) ([]SharedEntityRecord, error) {
	var items []SharedEntityRecord
	ok, _, err := kvLoadJSON(db, shareIndexKey(campaignID), &items)
	if err != nil {
		return nil, err
	}
	if !ok {
		return []SharedEntityRecord{}, nil
	}
	return items, nil
}

func saveShareIndex(db *gorm.DB, campaignID string, items []SharedEntityRecord) error {
	_, err := kvSaveJSON(db, shareIndexKey(campaignID), items)
	return err
}

func loadVersionIndex(db *gorm.DB, campaignID string) ([]VersionRecord, error) {
	var items []VersionRecord
	ok, _, err := kvLoadJSON(db, versionIndexKey(campaignID), &items)
	if err != nil {
		return nil, err
	}
	if !ok {
		return []VersionRecord{}, nil
	}
	return items, nil
}

func appendVersionRecord(db *gorm.DB, campaignID string, record VersionRecord) error {
	items, err := loadVersionIndex(db, campaignID)
	if err != nil {
		return err
	}
	items = append([]VersionRecord{record}, items...)
	if len(items) > 200 {
		items = items[:200]
	}
	_, err = kvSaveJSON(db, versionIndexKey(campaignID), items)
	return err
}

func savePublicCampaignIndex(db *gorm.DB, items []PublicCampaignSummary) error {
	_, err := kvSaveJSON(db, publicCampaignIndexKey(), items)
	return err
}

func upsertPublicCampaignIndex(db *gorm.DB, summary PublicCampaignSummary) error {
	items, err := loadPublicCampaignIndex(db)
	if err != nil {
		return err
	}
	index := slices.IndexFunc(items, func(item PublicCampaignSummary) bool { return item.ID == summary.ID })
	if index >= 0 {
		items[index] = summary
	} else {
		items = append(items, summary)
	}
	sort.Slice(items, func(i, j int) bool { return items[i].LastModified > items[j].LastModified })
	return savePublicCampaignIndex(db, items)
}

func removePublicCampaignIndex(db *gorm.DB, campaignID string) error {
	items, err := loadPublicCampaignIndex(db)
	if err != nil {
		return err
	}
	filtered := make([]PublicCampaignSummary, 0, len(items))
	for _, item := range items {
		if item.ID != campaignID {
			filtered = append(filtered, item)
		}
	}
	return savePublicCampaignIndex(db, filtered)
}

func toPublicCampaignSummary(cfg CampaignConfigDoc) PublicCampaignSummary {
	now := time.Now().UnixMilli()
	onlineCount := 0
	ownerUsername := cfg.OwnerUserID
	for _, member := range cfg.Members {
		if now-member.LastActiveAt < int64(5*time.Minute/time.Millisecond) {
			onlineCount++
		}
		if member.UserID == cfg.OwnerUserID && strings.TrimSpace(member.Username) != "" {
			ownerUsername = member.Username
		}
	}
	lastModified := cfg.LastModified
	if lastModified == 0 {
		lastModified = cfg.UpdatedAt
	}
	name := cfg.Name
	if strings.TrimSpace(name) == "" {
		name = "未命名公开模组"
	}
	return PublicCampaignSummary{
		ID:                cfg.CampaignID,
		Name:              name,
		Description:       cfg.Description,
		LastModified:      lastModified,
		OwnerID:           cfg.OwnerUserID,
		OwnerUsername:     ownerUsername,
		Visibility:        cfg.Visibility,
		MemberCount:       len(cfg.Members),
		OnlineMemberCount: onlineCount,
	}
}

func rebuildPublicCampaignIndex(db *gorm.DB) ([]PublicCampaignSummary, error) {
	var items []KV
	if err := db.Where("key LIKE ?", "campaign:%:config").Find(&items).Error; err != nil {
		return nil, err
	}
	result := make([]PublicCampaignSummary, 0, len(items))
	for _, item := range items {
		var cfg CampaignConfigDoc
		if err := json.Unmarshal([]byte(item.Value), &cfg); err != nil {
			continue
		}
		if cfg.Visibility != "public" {
			continue
		}
		result = append(result, toPublicCampaignSummary(cfg))
	}
	sort.Slice(result, func(i, j int) bool { return result[i].LastModified > result[j].LastModified })
	if err := savePublicCampaignIndex(db, result); err != nil {
		return nil, err
	}
	return result, nil
}

func ensureCampaignConfig(db *gorm.DB, campaignID, userID, username string) (CampaignConfigDoc, error) {
	now := time.Now().UnixMilli()
	key := campaignConfigKey(campaignID)
	var cfg CampaignConfigDoc
	ok, _, err := kvLoadJSON(db, key, &cfg)
	if err != nil {
		return CampaignConfigDoc{}, err
	}
	if !ok {
		cfg = CampaignConfigDoc{
			CampaignID:    campaignID,
			Name:          "",
			Description:   "",
			LastModified:  now,
			Visibility:    "private",
			OwnerUserID:   userID,
			SchemaVersion: 2,
			Members: []CampaignMember{
				{
					UserID:       userID,
					Username:     username,
					Role:         "GM",
					JoinedAt:     now,
					LastActiveAt: now,
				},
			},
			CreatedAt: now,
			UpdatedAt: now,
		}
		if _, err := kvSaveJSON(db, key, cfg); err != nil {
			return CampaignConfigDoc{}, err
		}
		return cfg, nil
	}
	found := false
	for index := range cfg.Members {
		member := &cfg.Members[index]
		if member.UserID != userID {
			continue
		}
		member.Username = username
		member.LastActiveAt = now
		found = true
		break
	}
	if !found && userID != "" {
		cfg.Members = append(cfg.Members, CampaignMember{
			UserID:       userID,
			Username:     username,
			Role:         "PL",
			JoinedAt:     now,
			LastActiveAt: now,
		})
	}
	cfg.UpdatedAt = now
	if _, err := kvSaveJSON(db, key, cfg); err != nil {
		return CampaignConfigDoc{}, err
	}
	if cfg.Visibility == "public" {
		if err := upsertPublicCampaignIndex(db, toPublicCampaignSummary(cfg)); err != nil {
			return CampaignConfigDoc{}, err
		}
	}
	return cfg, nil
}

func memberRole(cfg CampaignConfigDoc, userID string) string {
	for _, member := range cfg.Members {
		if member.UserID == userID {
			return member.Role
		}
	}
	return "PL"
}

func memberUsername(cfg CampaignConfigDoc, userID string) string {
	for _, member := range cfg.Members {
		if member.UserID == userID && strings.TrimSpace(member.Username) != "" {
			return member.Username
		}
	}
	return userID
}

func toGenericMap(value any) map[string]any {
	bytes, err := json.Marshal(value)
	if err != nil {
		return map[string]any{}
	}
	var result map[string]any
	if err := json.Unmarshal(bytes, &result); err != nil {
		return map[string]any{}
	}
	return result
}

func toGenericSlice[T any](value []T) []map[string]any {
	bytes, err := json.Marshal(value)
	if err != nil {
		return []map[string]any{}
	}
	var result []map[string]any
	if err := json.Unmarshal(bytes, &result); err != nil {
		return []map[string]any{}
	}
	return result
}

func leaseExpired(lease *TeamNoteLease) bool {
	if lease == nil {
		return true
	}
	if lease.ExpiresAt == nil {
		return false
	}
	return *lease.ExpiresAt <= time.Now().UnixMilli()
}

func loadConfig() Config {
	viper.SetDefault("port", 8080)
	viper.SetDefault("db_path", "data/storage.db")
	viper.SetEnvPrefix("BTR")
	viper.AutomaticEnv()
	viper.SetConfigName("config")
	viper.SetConfigType("yaml")
	viper.AddConfigPath(".")
	viper.AddConfigPath("server")
	_ = viper.ReadInConfig()

	var cfg Config
	if err := viper.Unmarshal(&cfg); err != nil {
		log.Fatalf("failed to unmarshal config: %v", err)
	}
	return cfg
}

func ensureDir(path string) {
	dir := filepath.Dir(path)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		log.Fatalf("failed to create dir %s: %v", dir, err)
	}
}

func openDB(cfg Config) *gorm.DB {
	ensureDir(cfg.DBPath)
	db, err := gorm.Open(sqlite.Open(cfg.DBPath), &gorm.Config{})
	if err != nil {
		log.Fatalf("failed to open database: %v", err)
	}
	if err := db.AutoMigrate(&KV{}); err != nil {
		log.Fatalf("failed to migrate database: %v", err)
	}
	return db
}

func normalizeResourceRef(ref string) (string, bool) {
	p := strings.TrimSpace(ref)
	p = strings.TrimPrefix(p, "/")
	if p == "" {
		return "", false
	}
	if strings.Contains(p, "..") {
		return "", false
	}
	if !strings.HasPrefix(p, "graph_assets/") {
		p = "graph_assets/" + p
	}
	if strings.Contains(p, "..") {
		return "", false
	}
	return p, true
}

func sanitizeFilenameBase(name string) string {
	base := strings.TrimSpace(name)
	base = strings.TrimSuffix(base, filepath.Ext(base))
	if base == "" {
		return "image"
	}
	var b strings.Builder
	lastUnderscore := false
	for _, r := range base {
		if r < 32 || strings.ContainsRune(`<>:"/\|?*`, r) {
			if !lastUnderscore {
				b.WriteRune('_')
				lastUnderscore = true
			}
			continue
		}
		if unicode.IsSpace(r) {
			if !lastUnderscore {
				b.WriteRune('_')
				lastUnderscore = true
			}
			continue
		}
		b.WriteRune(r)
		lastUnderscore = false
	}
	out := strings.Trim(b.String(), "._")
	if out == "" {
		return "image"
	}
	return out
}

func parseDisplayNameFromStored(filename string) string {
	ext := filepath.Ext(filename)
	stem := strings.TrimSuffix(filename, ext)
	if idx := strings.Index(stem, "__"); idx >= 0 && idx+2 < len(stem) {
		name := strings.TrimSpace(stem[idx+2:])
		name = strings.ReplaceAll(name, "_", " ")
		if name != "" {
			return name
		}
	}
	return stem
}

func findExistingResourceRefByHash(assetDir string, hash string) (string, bool) {
	entries, err := os.ReadDir(assetDir)
	if err != nil {
		return "", false
	}
	prefix := hash + "__"
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		name := entry.Name()
		if !strings.HasPrefix(name, prefix) {
			continue
		}
		ext := strings.ToLower(filepath.Ext(name))
		switch ext {
		case ".png", ".jpg", ".jpeg", ".webp":
			return "graph_assets/" + name, true
		}
	}
	return "", false
}

func main() {
	// flags
	showConsole := flag.Bool("show-console", false, "Windows上显示控制台界面")
	hideUI := flag.Bool("hide-ui", false, "启动时不弹出UI")
	// multi-instance flag is ignored to enforce single instance
	_ = flag.Bool("multi-instance", false, "允许在Windows上运行多个实例（已禁用）")
	_ = flag.Bool("m", false, "multi-instance 的短旗（已禁用）")
	flag.Parse()

	cfg := loadConfig()
	db := openDB(cfg)
	assetDir := filepath.Join(filepath.Dir(cfg.DBPath), "graph_assets")
	if err := os.MkdirAll(assetDir, 0o755); err != nil {
		log.Fatalf("failed to create graph asset dir: %v", err)
	}

	router := gin.Default()
	webRouter := router.Group("/web")
	router.GET("/", func(c *gin.Context) {
		// 跳转到/web
		c.Redirect(302, "/web")
	})

	api := router.Group("/api/storage")
	resourceAPI := router.Group("/api/resources")
	campaignAPI := router.Group("/api/campaigns")

	campaignAPI.GET("/public", func(c *gin.Context) {
		result, err := rebuildPublicCampaignIndex(db)
		if err != nil {
			c.JSON(500, gin.H{"error": "database_error"})
			return
		}
		c.JSON(200, result)
	})

	campaignAPI.GET("/:campaignId/config", func(c *gin.Context) {
		campaignID := strings.TrimSpace(c.Param("campaignId"))
		userID, username := requestUser(c)
		if campaignID == "" || userID == "" || username == "" {
			c.JSON(400, gin.H{"error": "missing_identity"})
			return
		}
		cfg, err := ensureCampaignConfig(db, campaignID, userID, username)
		if err != nil {
			c.JSON(500, gin.H{"error": "database_error"})
			return
		}
		c.JSON(200, cfg)
	})

	campaignAPI.PUT("/:campaignId/config", func(c *gin.Context) {
		campaignID := strings.TrimSpace(c.Param("campaignId"))
		userID, username := requestUser(c)
		if campaignID == "" || userID == "" || username == "" {
			c.JSON(400, gin.H{"error": "missing_identity"})
			return
		}
		cfg, err := ensureCampaignConfig(db, campaignID, userID, username)
		if err != nil {
			c.JSON(500, gin.H{"error": "database_error"})
			return
		}
		if memberRole(cfg, userID) != "GM" {
			c.JSON(403, gin.H{"error": "forbidden"})
			return
		}
		var body struct {
			Name         *string `json:"name"`
			Description  *string `json:"description"`
			LastModified *int64  `json:"lastModified"`
			Visibility   string  `json:"visibility"`
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(400, gin.H{"error": "invalid_payload"})
			return
		}
		if body.Name != nil {
			cfg.Name = strings.TrimSpace(*body.Name)
		}
		if body.Description != nil {
			cfg.Description = strings.TrimSpace(*body.Description)
		}
		if body.LastModified != nil && *body.LastModified > 0 {
			cfg.LastModified = *body.LastModified
		}
		if body.Visibility == "public" || body.Visibility == "private" {
			cfg.Visibility = body.Visibility
		}
		cfg.UpdatedAt = time.Now().UnixMilli()
		if cfg.LastModified == 0 {
			cfg.LastModified = cfg.UpdatedAt
		}
		if _, err := kvSaveJSON(db, campaignConfigKey(campaignID), cfg); err != nil {
			c.JSON(500, gin.H{"error": "database_error"})
			return
		}
		if cfg.Visibility == "public" {
			if err := upsertPublicCampaignIndex(db, toPublicCampaignSummary(cfg)); err != nil {
				c.JSON(500, gin.H{"error": "database_error"})
				return
			}
		} else {
			if err := removePublicCampaignIndex(db, cfg.CampaignID); err != nil {
				c.JSON(500, gin.H{"error": "database_error"})
				return
			}
		}
		c.JSON(200, cfg)
	})

	campaignAPI.GET("/:campaignId/shares", func(c *gin.Context) {
		campaignID := strings.TrimSpace(c.Param("campaignId"))
		userID, username := requestUser(c)
		view := strings.TrimSpace(c.Query("view"))
		if campaignID == "" || userID == "" || username == "" {
			c.JSON(400, gin.H{"error": "missing_identity"})
			return
		}
		cfg, err := ensureCampaignConfig(db, campaignID, userID, username)
		if err != nil {
			c.JSON(500, gin.H{"error": "database_error"})
			return
		}
		role := memberRole(cfg, userID)
		items, err := loadShareIndex(db, campaignID)
		if err != nil {
			c.JSON(500, gin.H{"error": "database_error"})
			return
		}
		result := make([]SharedEntityRecord, 0, len(items))
		for _, item := range items {
			switch view {
			case "managed":
				if role == "GM" {
					result = append(result, item)
				}
			default:
				if item.TargetUserID == userID || role == "GM" {
					result = append(result, item)
				}
			}
		}
		sort.Slice(result, func(i, j int) bool { return result[i].UpdatedAt > result[j].UpdatedAt })
		c.JSON(200, result)
	})

	campaignAPI.POST("/:campaignId/shares", func(c *gin.Context) {
		campaignID := strings.TrimSpace(c.Param("campaignId"))
		userID, username := requestUser(c)
		if campaignID == "" || userID == "" || username == "" {
			c.JSON(400, gin.H{"error": "missing_identity"})
			return
		}
		cfg, err := ensureCampaignConfig(db, campaignID, userID, username)
		if err != nil {
			c.JSON(500, gin.H{"error": "database_error"})
			return
		}
		if memberRole(cfg, userID) != "GM" {
			c.JSON(403, gin.H{"error": "forbidden"})
			return
		}
		var body struct {
			EntityType    string               `json:"entityType"`
			EntityID      string               `json:"entityId"`
			EntityName    string               `json:"entityName"`
			Scope         string               `json:"scope"`
			ScopeID       string               `json:"scopeId"`
			Permission    string               `json:"permission"`
			TargetUserIDs []string             `json:"targetUserIds"`
			Snapshot      SharedEntitySnapshot `json:"snapshot"`
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(400, gin.H{"error": "invalid_payload"})
			return
		}
		if body.Permission != "read" && body.Permission != "edit" {
			body.Permission = "read"
		}
		items, err := loadShareIndex(db, campaignID)
		if err != nil {
			c.JSON(500, gin.H{"error": "database_error"})
			return
		}
		now := time.Now().UnixMilli()
		updated := make([]SharedEntityRecord, 0, len(body.TargetUserIDs))
		for _, targetUserID := range body.TargetUserIDs {
			targetUserID = strings.TrimSpace(targetUserID)
			if targetUserID == "" || targetUserID == userID {
				continue
			}
			targetUsername := memberUsername(cfg, targetUserID)
			index := slices.IndexFunc(items, func(item SharedEntityRecord) bool {
				return item.EntityType == body.EntityType && item.EntityID == body.EntityID && item.Scope == body.Scope && item.ScopeID == body.ScopeID && item.TargetUserID == targetUserID
			})
			record := SharedEntityRecord{
				ID:                  fmt.Sprintf("share_%d", time.Now().UnixNano()),
				CampaignID:          campaignID,
				EntityType:          body.EntityType,
				EntityID:            body.EntityID,
				EntityName:          body.EntityName,
				Scope:               body.Scope,
				ScopeID:             body.ScopeID,
				Permission:          body.Permission,
				SourceOwnerUserID:   cfg.OwnerUserID,
				SourceOwnerUsername: memberUsername(cfg, cfg.OwnerUserID),
				TargetUserID:        targetUserID,
				TargetUsername:      targetUsername,
				SharedByUserID:      userID,
				SharedByUsername:    username,
				CreatedAt:           now,
				UpdatedAt:           now,
				Version:             1,
				ActiveLease:         nil,
				Snapshot:            body.Snapshot,
			}
			action := "create"
			var previousSnapshot map[string]any
			if index >= 0 {
				record.ID = items[index].ID
				record.CreatedAt = items[index].CreatedAt
				record.Version = items[index].Version + 1
				record.ActiveLease = nil
				previousSnapshot = toGenericMap(items[index])
				items[index] = record
				action = "update"
			} else {
				items = append(items, record)
			}
			if err := appendVersionRecord(db, campaignID, VersionRecord{
				ID:               fmt.Sprintf("ver_%d", time.Now().UnixNano()),
				CampaignID:       campaignID,
				DocumentType:     "shared_entity",
				DocumentID:       record.ID,
				Action:           action,
				Summary:          fmt.Sprintf("分享 %s 给 %s", body.EntityName, targetUsername),
				OperatorUserID:   userID,
				OperatorUsername: username,
				CreatedAt:        now,
				Snapshot:         toGenericMap(record),
				PreviousSnapshot: previousSnapshot,
			}); err != nil {
				c.JSON(500, gin.H{"error": "database_error"})
				return
			}
			updated = append(updated, record)
		}
		if err := saveShareIndex(db, campaignID, items); err != nil {
			c.JSON(500, gin.H{"error": "database_error"})
			return
		}
		c.JSON(200, updated)
	})

	campaignAPI.DELETE("/:campaignId/shares/:shareId", func(c *gin.Context) {
		campaignID := strings.TrimSpace(c.Param("campaignId"))
		shareID := strings.TrimSpace(c.Param("shareId"))
		userID, username := requestUser(c)
		if campaignID == "" || shareID == "" || userID == "" || username == "" {
			c.JSON(400, gin.H{"error": "missing_identity"})
			return
		}
		cfg, err := ensureCampaignConfig(db, campaignID, userID, username)
		if err != nil {
			c.JSON(500, gin.H{"error": "database_error"})
			return
		}
		items, err := loadShareIndex(db, campaignID)
		if err != nil {
			c.JSON(500, gin.H{"error": "database_error"})
			return
		}
		index := slices.IndexFunc(items, func(item SharedEntityRecord) bool { return item.ID == shareID })
		if index < 0 {
			c.Status(204)
			return
		}
		removed := items[index]
		role := memberRole(cfg, userID)
		if role != "GM" && removed.TargetUserID != userID {
			c.JSON(403, gin.H{"error": "forbidden"})
			return
		}
		items = append(items[:index], items[index+1:]...)
		if err := saveShareIndex(db, campaignID, items); err != nil {
			c.JSON(500, gin.H{"error": "database_error"})
			return
		}
		if err := appendVersionRecord(db, campaignID, VersionRecord{
			ID:               fmt.Sprintf("ver_%d", time.Now().UnixNano()),
			CampaignID:       campaignID,
			DocumentType:     "shared_entity",
			DocumentID:       removed.ID,
			Action:           "delete",
			Summary:          fmt.Sprintf("%s 删除共享副本 %s", username, removed.EntityName),
			OperatorUserID:   userID,
			OperatorUsername: username,
			CreatedAt:        time.Now().UnixMilli(),
			Snapshot:         toGenericMap(removed),
		}); err != nil {
			c.JSON(500, gin.H{"error": "database_error"})
			return
		}
		c.Status(204)
	})

	campaignAPI.POST("/:campaignId/shares/:shareId/lease/start", func(c *gin.Context) {
		campaignID := strings.TrimSpace(c.Param("campaignId"))
		shareID := strings.TrimSpace(c.Param("shareId"))
		userID, username := requestUser(c)
		if campaignID == "" || shareID == "" || userID == "" || username == "" {
			c.JSON(400, gin.H{"error": "missing_identity"})
			return
		}
		cfg, err := ensureCampaignConfig(db, campaignID, userID, username)
		if err != nil {
			c.JSON(500, gin.H{"error": "database_error"})
			return
		}
		items, err := loadShareIndex(db, campaignID)
		if err != nil {
			c.JSON(500, gin.H{"error": "database_error"})
			return
		}
		index := slices.IndexFunc(items, func(item SharedEntityRecord) bool { return item.ID == shareID })
		if index < 0 {
			c.JSON(404, gin.H{"error": "not_found"})
			return
		}
		record := items[index]
		role := memberRole(cfg, userID)
		if record.Permission != "edit" || (record.TargetUserID != userID && role != "GM") {
			c.JSON(403, gin.H{"error": "forbidden"})
			return
		}
		if record.Scope != "subItem" && record.Scope != "section" && record.Scope != "entity" {
			c.JSON(409, gin.H{"error": "unsupported_scope"})
			return
		}
		if record.ActiveLease != nil && record.ActiveLease.UserID != userID && !leaseExpired(record.ActiveLease) {
			c.JSON(409, gin.H{"error": "lease_conflict", "activeLease": record.ActiveLease})
			return
		}
		now := time.Now().UnixMilli()
		expiresAt := now + int64(10*time.Minute/time.Millisecond)
		record.ActiveLease = &TeamNoteLease{
			UserID:    userID,
			Username:  username,
			Role:      role,
			StartedAt: now,
			ExpiresAt: &expiresAt,
		}
		record.UpdatedAt = now
		items[index] = record
		if err := saveShareIndex(db, campaignID, items); err != nil {
			c.JSON(500, gin.H{"error": "database_error"})
			return
		}
		c.JSON(200, record)
	})

	campaignAPI.POST("/:campaignId/shares/:shareId/lease/refresh", func(c *gin.Context) {
		campaignID := strings.TrimSpace(c.Param("campaignId"))
		shareID := strings.TrimSpace(c.Param("shareId"))
		userID, username := requestUser(c)
		if campaignID == "" || shareID == "" || userID == "" || username == "" {
			c.JSON(400, gin.H{"error": "missing_identity"})
			return
		}
		var body struct {
			LeaseStartedAt *int64 `json:"leaseStartedAt"`
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(400, gin.H{"error": "invalid_payload"})
			return
		}
		cfg, err := ensureCampaignConfig(db, campaignID, userID, username)
		if err != nil {
			c.JSON(500, gin.H{"error": "database_error"})
			return
		}
		items, err := loadShareIndex(db, campaignID)
		if err != nil {
			c.JSON(500, gin.H{"error": "database_error"})
			return
		}
		index := slices.IndexFunc(items, func(item SharedEntityRecord) bool { return item.ID == shareID })
		if index < 0 {
			c.JSON(404, gin.H{"error": "not_found"})
			return
		}
		record := items[index]
		role := memberRole(cfg, userID)
		if record.Permission != "edit" || (record.TargetUserID != userID && role != "GM") {
			c.JSON(403, gin.H{"error": "forbidden"})
			return
		}
		if record.ActiveLease == nil || record.ActiveLease.UserID != userID || leaseExpired(record.ActiveLease) {
			c.JSON(409, gin.H{"error": "lease_missing"})
			return
		}
		if body.LeaseStartedAt != nil && *body.LeaseStartedAt != record.ActiveLease.StartedAt {
			c.JSON(409, gin.H{"error": "lease_missing"})
			return
		}
		now := time.Now().UnixMilli()
		expiresAt := now + int64(10*time.Minute/time.Millisecond)
		record.ActiveLease.ExpiresAt = &expiresAt
		record.UpdatedAt = now
		items[index] = record
		if err := saveShareIndex(db, campaignID, items); err != nil {
			c.JSON(500, gin.H{"error": "database_error"})
			return
		}
		c.JSON(200, record)
	})

	campaignAPI.POST("/:campaignId/shares/:shareId/lease/end", func(c *gin.Context) {
		campaignID := strings.TrimSpace(c.Param("campaignId"))
		shareID := strings.TrimSpace(c.Param("shareId"))
		userID, username := requestUser(c)
		if campaignID == "" || shareID == "" || userID == "" || username == "" {
			c.JSON(400, gin.H{"error": "missing_identity"})
			return
		}
		var body struct {
			LeaseStartedAt *int64 `json:"leaseStartedAt"`
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(400, gin.H{"error": "invalid_payload"})
			return
		}
		cfg, err := ensureCampaignConfig(db, campaignID, userID, username)
		if err != nil {
			c.JSON(500, gin.H{"error": "database_error"})
			return
		}
		items, err := loadShareIndex(db, campaignID)
		if err != nil {
			c.JSON(500, gin.H{"error": "database_error"})
			return
		}
		index := slices.IndexFunc(items, func(item SharedEntityRecord) bool { return item.ID == shareID })
		if index < 0 {
			c.Status(204)
			return
		}
		record := items[index]
		role := memberRole(cfg, userID)
		if record.Permission != "edit" || (record.TargetUserID != userID && role != "GM") {
			c.JSON(403, gin.H{"error": "forbidden"})
			return
		}
		if record.ActiveLease == nil || record.ActiveLease.UserID != userID {
			c.JSON(409, gin.H{"error": "lease_missing"})
			return
		}
		if body.LeaseStartedAt != nil && *body.LeaseStartedAt != record.ActiveLease.StartedAt {
			c.JSON(409, gin.H{"error": "lease_missing"})
			return
		}
		record.ActiveLease = nil
		record.UpdatedAt = time.Now().UnixMilli()
		items[index] = record
		if err := saveShareIndex(db, campaignID, items); err != nil {
			c.JSON(500, gin.H{"error": "database_error"})
			return
		}
		c.Status(204)
	})

	campaignAPI.PUT("/:campaignId/shares/:shareId/content", func(c *gin.Context) {
		campaignID := strings.TrimSpace(c.Param("campaignId"))
		shareID := strings.TrimSpace(c.Param("shareId"))
		userID, username := requestUser(c)
		if campaignID == "" || shareID == "" || userID == "" || username == "" {
			c.JSON(400, gin.H{"error": "missing_identity"})
			return
		}
		var body struct {
			Content         string           `json:"content"`
			SectionItems    []map[string]any `json:"sectionItems"`
			SubItem         map[string]any   `json:"subItem"`
			Details         string           `json:"details"`
			TimelineEvents  []map[string]any `json:"timelineEvents"`
			AllSections     []map[string]any `json:"allSections"`
			ExpectedVersion *int             `json:"expectedVersion"`
			LeaseStartedAt  *int64           `json:"leaseStartedAt"`
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(400, gin.H{"error": "invalid_payload"})
			return
		}
		cfg, err := ensureCampaignConfig(db, campaignID, userID, username)
		if err != nil {
			c.JSON(500, gin.H{"error": "database_error"})
			return
		}
		items, err := loadShareIndex(db, campaignID)
		if err != nil {
			c.JSON(500, gin.H{"error": "database_error"})
			return
		}
		index := slices.IndexFunc(items, func(item SharedEntityRecord) bool { return item.ID == shareID })
		if index < 0 {
			c.JSON(404, gin.H{"error": "not_found"})
			return
		}
		record := items[index]
		role := memberRole(cfg, userID)
		if record.Permission != "edit" || (record.TargetUserID != userID && role != "GM") {
			c.JSON(403, gin.H{"error": "forbidden"})
			return
		}
		if record.Scope != "subItem" && record.Scope != "section" && record.Scope != "entity" {
			c.JSON(409, gin.H{"error": "unsupported_scope"})
			return
		}
		if record.ActiveLease == nil || record.ActiveLease.UserID != userID || leaseExpired(record.ActiveLease) {
			c.JSON(409, gin.H{"error": "lease_missing"})
			return
		}
		if body.LeaseStartedAt != nil && *body.LeaseStartedAt != record.ActiveLease.StartedAt {
			c.JSON(409, gin.H{"error": "lease_missing"})
			return
		}
		if body.ExpectedVersion != nil && *body.ExpectedVersion != record.Version {
			c.JSON(409, gin.H{"error": "version_conflict", "version": record.Version})
			return
		}
		previousSnapshot := toGenericMap(record)
		switch record.Scope {
		case "subItem":
			record.Snapshot.SubItem = body.SubItem
		case "section":
			record.Snapshot.SectionItems = body.SectionItems
		case "entity":
			record.Snapshot.Details = body.Details
			record.Snapshot.TimelineEvents = body.TimelineEvents
			record.Snapshot.AllSections = body.AllSections
		}
		record.Version++
		now := time.Now().UnixMilli()
		record.UpdatedAt = now
		items[index] = record
		if err := saveShareIndex(db, campaignID, items); err != nil {
			c.JSON(500, gin.H{"error": "database_error"})
			return
		}
		if err := appendVersionRecord(db, campaignID, VersionRecord{
			ID:               fmt.Sprintf("ver_%d", time.Now().UnixNano()),
			CampaignID:       campaignID,
			DocumentType:     "shared_entity",
			DocumentID:       record.ID,
			Action:           "update",
			Summary:          fmt.Sprintf("更新共享内容 %s", record.EntityName),
			OperatorUserID:   userID,
			OperatorUsername: username,
			CreatedAt:        now,
			Snapshot:         toGenericMap(record),
			PreviousSnapshot: previousSnapshot,
		}); err != nil {
			c.JSON(500, gin.H{"error": "database_error"})
			return
		}
		c.JSON(200, record)
	})

	campaignAPI.GET("/:campaignId/versions", func(c *gin.Context) {
		campaignID := strings.TrimSpace(c.Param("campaignId"))
		userID, username := requestUser(c)
		if campaignID == "" || userID == "" || username == "" {
			c.JSON(400, gin.H{"error": "missing_identity"})
			return
		}
		cfg, err := ensureCampaignConfig(db, campaignID, userID, username)
		if err != nil {
			c.JSON(500, gin.H{"error": "database_error"})
			return
		}
		if memberRole(cfg, userID) != "GM" {
			c.JSON(403, gin.H{"error": "forbidden"})
			return
		}
		items, err := loadVersionIndex(db, campaignID)
		if err != nil {
			c.JSON(500, gin.H{"error": "database_error"})
			return
		}
		c.JSON(200, items)
	})

	campaignAPI.POST("/:campaignId/versions/:versionId/restore-copy", func(c *gin.Context) {
		campaignID := strings.TrimSpace(c.Param("campaignId"))
		versionID := strings.TrimSpace(c.Param("versionId"))
		userID, username := requestUser(c)
		if campaignID == "" || versionID == "" || userID == "" || username == "" {
			c.JSON(400, gin.H{"error": "missing_identity"})
			return
		}
		cfg, err := ensureCampaignConfig(db, campaignID, userID, username)
		if err != nil {
			c.JSON(500, gin.H{"error": "database_error"})
			return
		}
		if memberRole(cfg, userID) != "GM" {
			c.JSON(403, gin.H{"error": "forbidden"})
			return
		}
		versions, err := loadVersionIndex(db, campaignID)
		if err != nil {
			c.JSON(500, gin.H{"error": "database_error"})
			return
		}
		index := slices.IndexFunc(versions, func(item VersionRecord) bool { return item.ID == versionID })
		if index < 0 {
			c.JSON(404, gin.H{"error": "not_found"})
			return
		}
		version := versions[index]
		now := time.Now().UnixMilli()
		switch version.DocumentType {
		case "shared_entity":
			var record SharedEntityRecord
			bytes, _ := json.Marshal(version.Snapshot)
			if err := json.Unmarshal(bytes, &record); err != nil {
				c.JSON(400, gin.H{"error": "invalid_snapshot"})
				return
			}
			record.ID = fmt.Sprintf("share_%d", time.Now().UnixNano())
			record.UpdatedAt = now
			record.CreatedAt = now
			record.Version = 1
			record.ActiveLease = nil
			items, err := loadShareIndex(db, campaignID)
			if err != nil {
				c.JSON(500, gin.H{"error": "database_error"})
				return
			}
			items = append(items, record)
			if err := saveShareIndex(db, campaignID, items); err != nil {
				c.JSON(500, gin.H{"error": "database_error"})
				return
			}
			if err := appendVersionRecord(db, campaignID, VersionRecord{
				ID:               fmt.Sprintf("ver_%d", time.Now().UnixNano()),
				CampaignID:       campaignID,
				DocumentType:     "shared_entity",
				DocumentID:       record.ID,
				Action:           "restore_copy",
				Summary:          fmt.Sprintf("恢复分享副本 %s", record.EntityName),
				OperatorUserID:   userID,
				OperatorUsername: username,
				CreatedAt:        now,
				Snapshot:         toGenericMap(record),
			}); err != nil {
				c.JSON(500, gin.H{"error": "database_error"})
				return
			}
			c.JSON(200, gin.H{"createdId": record.ID})
		case "team_note":
			var note TeamNoteDoc
			bytes, _ := json.Marshal(version.Snapshot)
			if err := json.Unmarshal(bytes, &note); err != nil {
				c.JSON(400, gin.H{"error": "invalid_snapshot"})
				return
			}
			note.ID = fmt.Sprintf("team_%d", time.Now().UnixNano())
			note.CampaignID = campaignID
			note.Title = strings.TrimSpace(note.Title) + "（恢复副本）"
			note.CreatedBy = userID
			note.CreatedByName = username
			note.UpdatedBy = userID
			note.UpdatedByName = username
			note.CreatedAt = now
			note.UpdatedAt = now
			note.Version = 1
			note.ActiveLease = nil
			if _, err := kvSaveJSON(db, teamNoteKey(campaignID, note.ID), note); err != nil {
				c.JSON(500, gin.H{"error": "database_error"})
				return
			}
			if err := appendVersionRecord(db, campaignID, VersionRecord{
				ID:               fmt.Sprintf("ver_%d", time.Now().UnixNano()),
				CampaignID:       campaignID,
				DocumentType:     "team_note",
				DocumentID:       note.ID,
				Action:           "restore_copy",
				Summary:          fmt.Sprintf("恢复团队笔记副本 %s", note.Title),
				OperatorUserID:   userID,
				OperatorUsername: username,
				CreatedAt:        now,
				Snapshot:         toGenericMap(note),
			}); err != nil {
				c.JSON(500, gin.H{"error": "database_error"})
				return
			}
			c.JSON(200, gin.H{"createdId": note.ID})
		default:
			c.JSON(400, gin.H{"error": "unsupported_restore"})
		}
	})

	campaignAPI.GET("/:campaignId/team-notes", func(c *gin.Context) {
		campaignID := strings.TrimSpace(c.Param("campaignId"))
		userID, username := requestUser(c)
		if campaignID == "" || userID == "" || username == "" {
			c.JSON(400, gin.H{"error": "missing_identity"})
			return
		}
		if _, err := ensureCampaignConfig(db, campaignID, userID, username); err != nil {
			c.JSON(500, gin.H{"error": "database_error"})
			return
		}
		var items []KV
		if err := db.Where("key LIKE ?", teamNoteKey(campaignID, "")+"%").Find(&items).Error; err != nil {
			c.JSON(500, gin.H{"error": "database_error"})
			return
		}
		notes := make([]TeamNoteDoc, 0, len(items))
		for _, item := range items {
			var note TeamNoteDoc
			if err := json.Unmarshal([]byte(item.Value), &note); err != nil {
				continue
			}
			if leaseExpired(note.ActiveLease) {
				note.ActiveLease = nil
			}
			notes = append(notes, note)
		}
		sort.Slice(notes, func(i, j int) bool { return notes[i].UpdatedAt > notes[j].UpdatedAt })
		c.JSON(200, notes)
	})

	campaignAPI.POST("/:campaignId/team-notes", func(c *gin.Context) {
		campaignID := strings.TrimSpace(c.Param("campaignId"))
		userID, username := requestUser(c)
		if campaignID == "" || userID == "" || username == "" {
			c.JSON(400, gin.H{"error": "missing_identity"})
			return
		}
		if _, err := ensureCampaignConfig(db, campaignID, userID, username); err != nil {
			c.JSON(500, gin.H{"error": "database_error"})
			return
		}
		var body struct {
			Title string `json:"title"`
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(400, gin.H{"error": "invalid_payload"})
			return
		}
		now := time.Now().UnixMilli()
		noteID := fmt.Sprintf("tn_%d", time.Now().UnixNano())
		note := TeamNoteDoc{
			ID:            noteID,
			CampaignID:    campaignID,
			Title:         strings.TrimSpace(body.Title),
			Content:       "",
			CreatedBy:     userID,
			CreatedByName: username,
			UpdatedBy:     userID,
			UpdatedByName: username,
			CreatedAt:     now,
			UpdatedAt:     now,
			Version:       1,
		}
		if note.Title == "" {
			note.Title = "新的团队笔记"
		}
		if _, err := kvSaveJSON(db, teamNoteKey(campaignID, noteID), note); err != nil {
			c.JSON(500, gin.H{"error": "database_error"})
			return
		}
		if err := appendVersionRecord(db, campaignID, VersionRecord{
			ID:               fmt.Sprintf("ver_%d", time.Now().UnixNano()),
			CampaignID:       campaignID,
			DocumentType:     "team_note",
			DocumentID:       note.ID,
			Action:           "create",
			Summary:          fmt.Sprintf("创建团队笔记 %s", note.Title),
			OperatorUserID:   userID,
			OperatorUsername: username,
			CreatedAt:        now,
			Snapshot:         toGenericMap(note),
		}); err != nil {
			c.JSON(500, gin.H{"error": "database_error"})
			return
		}
		c.JSON(200, note)
	})

	campaignAPI.PUT("/:campaignId/team-notes/:noteId", func(c *gin.Context) {
		campaignID := strings.TrimSpace(c.Param("campaignId"))
		noteID := strings.TrimSpace(c.Param("noteId"))
		userID, username := requestUser(c)
		if campaignID == "" || noteID == "" || userID == "" || username == "" {
			c.JSON(400, gin.H{"error": "missing_identity"})
			return
		}
		cfg, err := ensureCampaignConfig(db, campaignID, userID, username)
		if err != nil {
			c.JSON(500, gin.H{"error": "database_error"})
			return
		}
		role := memberRole(cfg, userID)
		var note TeamNoteDoc
		ok, _, err := kvLoadJSON(db, teamNoteKey(campaignID, noteID), &note)
		if err != nil {
			c.JSON(500, gin.H{"error": "database_error"})
			return
		}
		if !ok {
			c.JSON(404, gin.H{"error": "not_found"})
			return
		}
		if note.ActiveLease != nil && note.ActiveLease.UserID != userID && !leaseExpired(note.ActiveLease) {
			c.JSON(409, gin.H{"error": "lease_conflict", "activeLease": note.ActiveLease})
			return
		}
		var body struct {
			Title           string `json:"title"`
			Content         string `json:"content"`
			ExpectedVersion *int   `json:"expectedVersion"`
			LeaseStartedAt  *int64 `json:"leaseStartedAt"`
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(400, gin.H{"error": "invalid_payload"})
			return
		}
		if body.ExpectedVersion != nil && *body.ExpectedVersion != note.Version {
			c.JSON(409, gin.H{"error": "version_conflict", "version": note.Version})
			return
		}
		if note.ActiveLease != nil && note.ActiveLease.UserID == userID && body.LeaseStartedAt != nil && *body.LeaseStartedAt != note.ActiveLease.StartedAt {
			c.JSON(409, gin.H{"error": "lease_missing"})
			return
		}
		now := time.Now().UnixMilli()
		note.Title = strings.TrimSpace(body.Title)
		if note.Title == "" {
			note.Title = "新的团队笔记"
		}
		note.Content = body.Content
		note.UpdatedBy = userID
		note.UpdatedByName = username
		note.UpdatedAt = now
		note.Version++
		if role == "PL" {
			expiresAt := now + int64(10*time.Minute/time.Millisecond)
			note.ActiveLease = &TeamNoteLease{UserID: userID, Username: username, Role: role, StartedAt: now, ExpiresAt: &expiresAt}
		}
		if _, err := kvSaveJSON(db, teamNoteKey(campaignID, noteID), note); err != nil {
			c.JSON(500, gin.H{"error": "database_error"})
			return
		}
		if err := appendVersionRecord(db, campaignID, VersionRecord{
			ID:               fmt.Sprintf("ver_%d", time.Now().UnixNano()),
			CampaignID:       campaignID,
			DocumentType:     "team_note",
			DocumentID:       note.ID,
			Action:           "update",
			Summary:          fmt.Sprintf("更新团队笔记 %s", note.Title),
			OperatorUserID:   userID,
			OperatorUsername: username,
			CreatedAt:        now,
			Snapshot:         toGenericMap(note),
		}); err != nil {
			c.JSON(500, gin.H{"error": "database_error"})
			return
		}
		c.JSON(200, note)
	})

	campaignAPI.DELETE("/:campaignId/team-notes/:noteId", func(c *gin.Context) {
		campaignID := strings.TrimSpace(c.Param("campaignId"))
		noteID := strings.TrimSpace(c.Param("noteId"))
		userID, username := requestUser(c)
		if campaignID == "" || noteID == "" || userID == "" || username == "" {
			c.JSON(400, gin.H{"error": "missing_identity"})
			return
		}
		cfg, err := ensureCampaignConfig(db, campaignID, userID, username)
		if err != nil {
			c.JSON(500, gin.H{"error": "database_error"})
			return
		}
		role := memberRole(cfg, userID)
		var note TeamNoteDoc
		ok, _, err := kvLoadJSON(db, teamNoteKey(campaignID, noteID), &note)
		if err != nil {
			c.JSON(500, gin.H{"error": "database_error"})
			return
		}
		if !ok {
			c.Status(204)
			return
		}
		if role != "GM" && note.CreatedBy != userID {
			c.JSON(403, gin.H{"error": "forbidden"})
			return
		}
		if note.ActiveLease != nil && note.ActiveLease.UserID != userID && !leaseExpired(note.ActiveLease) {
			c.JSON(409, gin.H{"error": "lease_conflict", "activeLease": note.ActiveLease})
			return
		}
		if err := db.Delete(&KV{}, "key = ?", teamNoteKey(campaignID, noteID)).Error; err != nil {
			c.JSON(500, gin.H{"error": "database_error"})
			return
		}
		if err := appendVersionRecord(db, campaignID, VersionRecord{
			ID:               fmt.Sprintf("ver_%d", time.Now().UnixNano()),
			CampaignID:       campaignID,
			DocumentType:     "team_note",
			DocumentID:       note.ID,
			Action:           "delete",
			Summary:          fmt.Sprintf("删除团队笔记 %s", note.Title),
			OperatorUserID:   userID,
			OperatorUsername: username,
			CreatedAt:        time.Now().UnixMilli(),
			Snapshot:         toGenericMap(note),
		}); err != nil {
			c.JSON(500, gin.H{"error": "database_error"})
			return
		}
		c.Status(204)
	})

	campaignAPI.POST("/:campaignId/team-notes/:noteId/lease/start", func(c *gin.Context) {
		campaignID := strings.TrimSpace(c.Param("campaignId"))
		noteID := strings.TrimSpace(c.Param("noteId"))
		userID, username := requestUser(c)
		if campaignID == "" || noteID == "" || userID == "" || username == "" {
			c.JSON(400, gin.H{"error": "missing_identity"})
			return
		}
		cfg, err := ensureCampaignConfig(db, campaignID, userID, username)
		if err != nil {
			c.JSON(500, gin.H{"error": "database_error"})
			return
		}
		role := memberRole(cfg, userID)
		var note TeamNoteDoc
		ok, _, err := kvLoadJSON(db, teamNoteKey(campaignID, noteID), &note)
		if err != nil {
			c.JSON(500, gin.H{"error": "database_error"})
			return
		}
		if !ok {
			c.JSON(404, gin.H{"error": "not_found"})
			return
		}
		if note.ActiveLease != nil && note.ActiveLease.UserID != userID && !leaseExpired(note.ActiveLease) {
			c.JSON(409, gin.H{"error": "lease_conflict", "activeLease": note.ActiveLease})
			return
		}
		now := time.Now().UnixMilli()
		var expiresAt *int64
		if role == "PL" {
			value := now + int64(10*time.Minute/time.Millisecond)
			expiresAt = &value
		}
		note.ActiveLease = &TeamNoteLease{UserID: userID, Username: username, Role: role, StartedAt: now, ExpiresAt: expiresAt}
		if _, err := kvSaveJSON(db, teamNoteKey(campaignID, noteID), note); err != nil {
			c.JSON(500, gin.H{"error": "database_error"})
			return
		}
		c.JSON(200, note)
	})

	campaignAPI.POST("/:campaignId/team-notes/:noteId/lease/refresh", func(c *gin.Context) {
		campaignID := strings.TrimSpace(c.Param("campaignId"))
		noteID := strings.TrimSpace(c.Param("noteId"))
		userID, username := requestUser(c)
		if campaignID == "" || noteID == "" || userID == "" || username == "" {
			c.JSON(400, gin.H{"error": "missing_identity"})
			return
		}
		cfg, err := ensureCampaignConfig(db, campaignID, userID, username)
		if err != nil {
			c.JSON(500, gin.H{"error": "database_error"})
			return
		}
		role := memberRole(cfg, userID)
		var note TeamNoteDoc
		ok, _, err := kvLoadJSON(db, teamNoteKey(campaignID, noteID), &note)
		if err != nil {
			c.JSON(500, gin.H{"error": "database_error"})
			return
		}
		if !ok {
			c.JSON(404, gin.H{"error": "not_found"})
			return
		}
		var body struct {
			Role           string `json:"role"`
			LeaseStartedAt *int64 `json:"leaseStartedAt"`
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(400, gin.H{"error": "invalid_payload"})
			return
		}
		if note.ActiveLease == nil || note.ActiveLease.UserID != userID || leaseExpired(note.ActiveLease) {
			c.JSON(409, gin.H{"error": "lease_missing"})
			return
		}
		if body.LeaseStartedAt != nil && *body.LeaseStartedAt != note.ActiveLease.StartedAt {
			c.JSON(409, gin.H{"error": "lease_missing"})
			return
		}
		now := time.Now().UnixMilli()
		note.ActiveLease.Username = username
		note.ActiveLease.Role = role
		if role == "PL" {
			value := now + int64(10*time.Minute/time.Millisecond)
			note.ActiveLease.ExpiresAt = &value
		} else {
			note.ActiveLease.ExpiresAt = nil
		}
		if _, err := kvSaveJSON(db, teamNoteKey(campaignID, noteID), note); err != nil {
			c.JSON(500, gin.H{"error": "database_error"})
			return
		}
		c.JSON(200, note)
	})

	campaignAPI.POST("/:campaignId/team-notes/:noteId/lease/end", func(c *gin.Context) {
		campaignID := strings.TrimSpace(c.Param("campaignId"))
		noteID := strings.TrimSpace(c.Param("noteId"))
		userID, username := requestUser(c)
		if campaignID == "" || noteID == "" || userID == "" || username == "" {
			c.JSON(400, gin.H{"error": "missing_identity"})
			return
		}
		if _, err := ensureCampaignConfig(db, campaignID, userID, username); err != nil {
			c.JSON(500, gin.H{"error": "database_error"})
			return
		}
		var note TeamNoteDoc
		ok, _, err := kvLoadJSON(db, teamNoteKey(campaignID, noteID), &note)
		if err != nil {
			c.JSON(500, gin.H{"error": "database_error"})
			return
		}
		if !ok {
			c.Status(204)
			return
		}
		var body struct {
			LeaseStartedAt *int64 `json:"leaseStartedAt"`
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(400, gin.H{"error": "invalid_payload"})
			return
		}
		if note.ActiveLease != nil && note.ActiveLease.UserID == userID {
			if body.LeaseStartedAt != nil && *body.LeaseStartedAt != note.ActiveLease.StartedAt {
				c.JSON(409, gin.H{"error": "lease_missing"})
				return
			}
			note.ActiveLease = nil
			if _, err := kvSaveJSON(db, teamNoteKey(campaignID, noteID), note); err != nil {
				c.JSON(500, gin.H{"error": "database_error"})
				return
			}
		}
		c.Status(204)
	})

	api.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "ok"})
	})

	allowedKey := func(k string) bool {
		return strings.HasPrefix(k, "trpg_u_")
	}

	api.GET("/all", func(c *gin.Context) {
		var items []KV
		prefix := c.Query("prefix")
		if prefix == "" {
			c.JSON(400, gin.H{"error": "prefix_required"})
			return
		}
		var err error
		err = db.Where("key LIKE ?", prefix+"%").Find(&items).Error
		if err != nil {
			c.JSON(500, gin.H{"error": "database error"})
			return
		}
		result := make(map[string]string, len(items))
		for _, it := range items {
			result[it.Key] = it.Value
		}
		c.JSON(200, result)
	})

	type putBody struct {
		Value           string `json:"value" binding:"required"`
		ExpectedVersion *int   `json:"expectedVersion,omitempty"`
	}

	api.GET("/:key", func(c *gin.Context) {
		key := c.Param("key")
		if !allowedKey(key) {
			c.JSON(403, gin.H{"error": "forbidden"})
			return
		}
		var item KV
		if err := db.First(&item, "key = ?", key).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				c.JSON(404, gin.H{"error": "not found"})
				return
			}
			c.JSON(500, gin.H{"error": "database error"})
			return
		}
		c.JSON(200, gin.H{
			"key":       item.Key,
			"value":     item.Value,
			"version":   item.Version,
			"updatedAt": item.UpdatedAt.UnixMilli(),
		})
	})

	api.PUT("/:key", func(c *gin.Context) {
		key := c.Param("key")
		if !allowedKey(key) {
			c.JSON(403, gin.H{"error": "forbidden"})
			return
		}
		var body putBody
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(400, gin.H{"error": "invalid payload"})
			return
		}
	retryLoad:
		var item KV
		err := db.First(&item, "key = ?", key).Error
		if err != nil {
			if err == gorm.ErrRecordNotFound {
				item = KV{Key: key, Value: body.Value, Version: 1}
				if err := db.Create(&item).Error; err != nil {
					if strings.Contains(strings.ToLower(err.Error()), "unique constraint failed") {
						goto retryLoad
					}
					c.JSON(500, gin.H{"error": "database error"})
					return
				}
				c.JSON(200, gin.H{"key": key, "value": body.Value, "version": item.Version, "updatedAt": item.UpdatedAt.UnixMilli()})
				return
			}
			c.JSON(500, gin.H{"error": "database error"})
			return
		}
		if body.ExpectedVersion != nil && *body.ExpectedVersion != item.Version {
			c.JSON(409, gin.H{
				"error":     "version_conflict",
				"key":       item.Key,
				"version":   item.Version,
				"updatedAt": item.UpdatedAt.UnixMilli(),
			})
			return
		}
		item.Value = body.Value
		item.Version = item.Version + 1
		if err := db.Save(&item).Error; err != nil {
			c.JSON(500, gin.H{"error": "database error"})
			return
		}
		c.JSON(200, gin.H{"key": key, "value": body.Value, "version": item.Version, "updatedAt": item.UpdatedAt.UnixMilli()})
	})

	api.DELETE("/:key", func(c *gin.Context) {
		key := c.Param("key")
		if !allowedKey(key) {
			c.JSON(403, gin.H{"error": "forbidden"})
			return
		}
		if err := db.Delete(&KV{}, "key = ?", key).Error; err != nil {
			c.JSON(500, gin.H{"error": "database error"})
			return
		}
		c.Status(204)
	})

	api.GET("/meta", func(c *gin.Context) {
		var items []KV
		prefix := c.Query("prefix")
		if prefix == "" {
			c.JSON(400, gin.H{"error": "prefix_required"})
			return
		}
		err := db.Select("key", "version", "updated_at").Where("key LIKE ?", prefix+"%").Find(&items).Error
		if err != nil {
			c.JSON(500, gin.H{"error": "database error"})
			return
		}
		meta := make(map[string]gin.H, len(items))
		for _, it := range items {
			meta[it.Key] = gin.H{
				"version":   it.Version,
				"updatedAt": it.UpdatedAt.UnixMilli(),
			}
		}
		c.JSON(200, meta)
	})

	resourceAPI.POST("/upload", func(c *gin.Context) {
		file, header, err := c.Request.FormFile("file")
		if err != nil {
			c.JSON(400, gin.H{"error": "file_required"})
			return
		}
		defer file.Close()
		ext := strings.ToLower(filepath.Ext(header.Filename))
		switch ext {
		case ".png", ".jpg", ".jpeg", ".webp":
		default:
			c.JSON(400, gin.H{"error": "unsupported_file_type"})
			return
		}
		content, err := io.ReadAll(file)
		if err != nil {
			c.JSON(500, gin.H{"error": "read_file_failed"})
			return
		}
		sum := sha256.Sum256(content)
		hash := fmt.Sprintf("%x", sum[:])
		if ref, ok := findExistingResourceRefByHash(assetDir, hash); ok {
			c.JSON(200, gin.H{
				"ref": ref,
				"url": "/api/resources/file/" + ref,
			})
			return
		}
		displayBase := sanitizeFilenameBase(header.Filename)
		filename := hash + "__" + displayBase + ext
		dstPath := filepath.Join(assetDir, filename)
		dst, err := os.Create(dstPath)
		if err != nil {
			c.JSON(500, gin.H{"error": "create_file_failed"})
			return
		}
		defer dst.Close()
		if _, err := dst.Write(content); err != nil {
			c.JSON(500, gin.H{"error": "write_file_failed"})
			return
		}
		ref := "graph_assets/" + filename
		c.JSON(200, gin.H{
			"ref": ref,
			"url": "/api/resources/file/" + ref,
		})
	})

	resourceAPI.GET("/list", func(c *gin.Context) {
		entries, err := os.ReadDir(assetDir)
		if err != nil {
			c.JSON(500, gin.H{"error": "read_dir_failed"})
			return
		}
		items := make([]gin.H, 0, len(entries))
		for _, entry := range entries {
			if entry.IsDir() {
				continue
			}
			name := entry.Name()
			ext := strings.ToLower(filepath.Ext(name))
			switch ext {
			case ".png", ".jpg", ".jpeg", ".webp":
			default:
				continue
			}
			info, err := entry.Info()
			if err != nil {
				continue
			}
			ref := "graph_assets/" + name
			displayName := parseDisplayNameFromStored(name)
			items = append(items, gin.H{
				"ref":         ref,
				"url":         "/api/resources/file/" + ref,
				"displayName": displayName,
				"size":        info.Size(),
				"updatedAt":   info.ModTime().UnixMilli(),
			})
		}
		sort.Slice(items, func(i, j int) bool {
			return items[i]["updatedAt"].(int64) > items[j]["updatedAt"].(int64)
		})
		c.JSON(200, gin.H{"items": items})
	})

	resourceAPI.DELETE("/file/*filepath", func(c *gin.Context) {
		raw := strings.TrimPrefix(c.Param("filepath"), "/")
		ref, ok := normalizeResourceRef(raw)
		if !ok {
			c.JSON(400, gin.H{"error": "invalid_ref"})
			return
		}
		full := filepath.Join(filepath.Dir(cfg.DBPath), ref)
		if !strings.HasPrefix(filepath.Clean(full), filepath.Clean(filepath.Dir(cfg.DBPath))) {
			c.JSON(403, gin.H{"error": "forbidden"})
			return
		}
		if err := os.Remove(full); err != nil {
			if os.IsNotExist(err) {
				c.Status(204)
				return
			}
			c.JSON(500, gin.H{"error": "delete_failed"})
			return
		}
		c.Status(204)
	})

	resourceAPI.POST("/delete-batch", func(c *gin.Context) {
		var body struct {
			Refs []string `json:"refs"`
		}
		if err := c.ShouldBindJSON(&body); err != nil || len(body.Refs) == 0 {
			c.JSON(400, gin.H{"error": "invalid_payload"})
			return
		}
		failed := make([]string, 0)
		for _, raw := range body.Refs {
			ref, ok := normalizeResourceRef(raw)
			if !ok {
				failed = append(failed, raw)
				continue
			}
			full := filepath.Join(filepath.Dir(cfg.DBPath), ref)
			if !strings.HasPrefix(filepath.Clean(full), filepath.Clean(filepath.Dir(cfg.DBPath))) {
				failed = append(failed, raw)
				continue
			}
			if err := os.Remove(full); err != nil && !os.IsNotExist(err) {
				failed = append(failed, raw)
			}
		}
		if len(failed) > 0 {
			c.JSON(207, gin.H{"failed": failed})
			return
		}
		c.Status(204)
	})

	resourceAPI.GET("/file/*filepath", func(c *gin.Context) {
		raw := strings.TrimPrefix(c.Param("filepath"), "/")
		p, ok := normalizeResourceRef(raw)
		if !ok {
			c.Status(404)
			return
		}
		full := filepath.Join(filepath.Dir(cfg.DBPath), p)
		if !strings.HasPrefix(filepath.Clean(full), filepath.Clean(filepath.Dir(cfg.DBPath))) {
			c.Status(403)
			return
		}
		if _, err := os.Stat(full); err != nil {
			c.Status(404)
			return
		}
		c.Header("Cache-Control", "public, max-age=31536000")
		c.File(full)
	})

	serveWeb := func(c *gin.Context, p string) {
		if p == "" || p == "/" {
			p = "/index.html"
		}
		data, err := webFS.ReadFile("resource" + p)
		if err != nil {
			ext := filepath.Ext(p)
			if ext == "" || ext == ".html" {
				indexData, indexErr := webFS.ReadFile("resource/index.html")
				if indexErr != nil {
					c.Status(404)
					return
				}
				c.Data(200, "text/html; charset=utf-8", indexData)
				return
			}
			c.Status(404)
			return
		}
		ctype := mime.TypeByExtension(filepath.Ext(p))
		if ctype == "" {
			ctype = "text/plain; charset=utf-8"
		}
		c.Data(200, ctype, data)
	}

	webRouter.GET("/*filepath", func(c *gin.Context) {
		serveWeb(c, c.Param("filepath"))
	})

	router.NoRoute(func(c *gin.Context) {
		p := c.Request.URL.Path
		if strings.HasPrefix(p, "/api/") {
			c.Status(404)
			return
		}
		if strings.HasPrefix(p, "/web/") {
			serveWeb(c, strings.TrimPrefix(p, "/web"))
			return
		}
		serveWeb(c, p)
	})
	// enforce single instance and console visibility on Windows
	if runtime.GOOS == "windows" {
		if *showConsole {
			showWindow()
		} else {
			hideWindow()
		}
		if TestRunning() {
			return
		}
	}
	// 启动 HTTP 服务（后台），再在主线程启动托盘
	addr := fmt.Sprintf("0.0.0.0:%d", cfg.Port)
	go httpServe(router, addr, *hideUI)
	trayInit()
}
