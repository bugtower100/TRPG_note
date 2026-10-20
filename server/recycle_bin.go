package main

import (
	"encoding/json"
	"errors"
	"log"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

const recycleBinDocumentType = "recycle_bin"

var recyclableEntityTypes = map[string]bool{
	"characters": true, "monsters": true, "locations": true, "organizations": true,
	"events": true, "clues": true, "timelines": true,
}

type RecycleBinItem struct {
	ID         string         `json:"id"`
	EntityType string         `json:"entityType"`
	Entity     map[string]any `json:"entity"`
	Position   int            `json:"position"`
	DeletedAt  int64          `json:"deletedAt"`
}

type RecycleBinDocument struct {
	RetentionDays int              `json:"retentionDays"`
	Version       int              `json:"version"`
	Items         []RecycleBinItem `json:"items"`
}

func loadRecycleBin(db *gorm.DB, campaignID string) (RecycleBinDocument, error) {
	doc := RecycleBinDocument{RetentionDays: 3, Items: []RecycleBinItem{}}
	_, err := loadDocumentJSON(db, campaignID, recycleBinDocumentType, &doc)
	return doc, err
}

func pruneRecycleBin(doc *RecycleBinDocument) {
	cutoff := time.Now().Add(-time.Duration(doc.RetentionDays) * 24 * time.Hour).UnixMilli()
	kept := make([]RecycleBinItem, 0, len(doc.Items))
	for _, item := range doc.Items {
		if item.DeletedAt > cutoff {
			kept = append(kept, item)
		}
	}
	doc.Items = kept
}

func saveRecycleBin(tx *gorm.DB, campaignID string, doc *RecycleBinDocument) error {
	doc.Version++
	return saveV2CampaignDocument(tx, campaignID, recycleBinDocumentType, doc, doc.Version)
}

func recycleRemovedEntities(tx *gorm.DB, campaignID, entityType, previousJSON string, next any) error {
	if !recyclableEntityTypes[entityType] || previousJSON == "" {
		return nil
	}
	var previous []map[string]any
	if err := json.Unmarshal([]byte(previousJSON), &previous); err != nil {
		return err
	}
	remaining := make(map[string]bool)
	for _, item := range toMapSlice(next) {
		remaining[stringField(item, "id")] = true
	}
	removed := []RecycleBinItem{}
	for position, item := range previous {
		if id := stringField(item, "id"); id != "" && !remaining[id] {
			removed = append(removed, RecycleBinItem{ID: uuid.NewString(), EntityType: entityType, Entity: item, Position: position, DeletedAt: time.Now().UnixMilli()})
		}
	}
	if len(removed) == 0 {
		return nil
	}
	doc, err := loadRecycleBin(tx, campaignID)
	if err != nil {
		return err
	}
	pruneRecycleBin(&doc)
	doc.Items = append(removed, doc.Items...)
	return saveRecycleBin(tx, campaignID, &doc)
}

func cleanupRecycleBins(db *gorm.DB) {
	var rows []V2CampaignDocument
	if err := db.Where("document_type = ?", recycleBinDocumentType).Find(&rows).Error; err != nil {
		log.Printf("recycle bin cleanup: %v", err)
		return
	}
	for _, row := range rows {
		if err := db.Transaction(func(tx *gorm.DB) error {
			doc, err := loadRecycleBin(tx, row.CampaignID)
			if err != nil {
				return err
			}
			count := len(doc.Items)
			pruneRecycleBin(&doc)
			if len(doc.Items) == count {
				return nil
			}
			return saveRecycleBin(tx, row.CampaignID, &doc)
		}); err != nil {
			log.Printf("recycle bin cleanup: %v", err)
		}
	}
}

func registerRecycleBinRoutes(group *gin.RouterGroup, db *gorm.DB) {
	manager := func(c *gin.Context) (string, bool) {
		campaignID := strings.TrimSpace(c.Param("campaignId"))
		userID, username := requestUser(c)
		if campaignID == "" || userID == "" || username == "" {
			c.JSON(400, gin.H{"error": "用户信息缺失"})
			return "", false
		}
		cfg, ok := loadCampaignConfigForRequest(c, db, campaignID, userID, username)
		if !ok {
			return "", false
		}
		if !isCampaignManagerRole(memberRole(cfg, userID)) {
			c.JSON(403, gin.H{"error": "只有模组管理者可以使用回收站"})
			return "", false
		}
		return campaignID, true
	}
	group.GET("/:campaignId/recycle-bin", func(c *gin.Context) {
		id, ok := manager(c)
		if !ok {
			return
		}
		var doc RecycleBinDocument
		err := db.Transaction(func(tx *gorm.DB) error {
			var err error
			doc, err = loadRecycleBin(tx, id)
			if err != nil {
				return err
			}
			count := len(doc.Items)
			pruneRecycleBin(&doc)
			if count != len(doc.Items) {
				return saveRecycleBin(tx, id, &doc)
			}
			return nil
		})
		if err != nil {
			c.JSON(500, gin.H{"error": "读取回收站失败"})
			return
		}
		c.JSON(200, doc)
	})
	group.POST("/:campaignId/recycle-bin", func(c *gin.Context) {
		id, ok := manager(c)
		if !ok {
			return
		}
		var request struct {
			Action          string `json:"action"`
			ItemID          string `json:"itemId"`
			RetentionDays   int    `json:"retentionDays"`
			ExpectedVersion int    `json:"expectedVersion"`
		}
		if err := c.ShouldBindJSON(&request); err != nil {
			c.JSON(400, gin.H{"error": "请求格式错误"})
			return
		}
		var doc RecycleBinDocument
		err := db.Transaction(func(tx *gorm.DB) error {
			var err error
			doc, err = loadRecycleBin(tx, id)
			if err != nil {
				return err
			}
			if doc.Version != request.ExpectedVersion {
				return errors.New("回收站已更新，请刷新后重试")
			}
			pruneRecycleBin(&doc)
			if request.Action == "settings" {
				if request.RetentionDays < 1 || request.RetentionDays > 3650 {
					return errors.New("保留时间须为 1 到 3650 天")
				}
				doc.RetentionDays = request.RetentionDays
				pruneRecycleBin(&doc)
				return saveRecycleBin(tx, id, &doc)
			}
			if request.Action != "restore" && request.Action != "delete" {
				return errors.New("不支持的回收站操作")
			}
			index := -1
			for i, item := range doc.Items {
				if item.ID == request.ItemID {
					index = i
					break
				}
			}
			if index < 0 {
				return errors.New("条目已过期或已被处理，请刷新回收站")
			}
			item := doc.Items[index]
			if request.Action == "restore" {
				if !recyclableEntityTypes[item.EntityType] {
					return errors.New("不支持恢复此资料类型")
				}
				if stringField(item.Entity, "id") == "" {
					return errors.New("资料 ID 缺失，无法恢复")
				}
				var entities []map[string]any
				if _, err := loadDocumentJSON(tx, id, item.EntityType, &entities); err != nil {
					return err
				}
				for _, entity := range entities {
					if stringField(entity, "id") == stringField(item.Entity, "id") {
						return errors.New("同 ID 资料已存在，为避免覆盖，未执行恢复")
					}
				}
				bundle, err := loadV2CampaignBundle(tx, id)
				if err != nil {
					return err
				}
				position := min(max(item.Position, 0), len(entities))
				entities = append(entities, nil)
				copy(entities[position+1:], entities[position:])
				item.Entity["updatedAt"] = time.Now().UnixMilli()
				entities[position] = item.Entity
				if err := saveV2CampaignDocument(tx, id, item.EntityType, entities, bundle.Version+1); err != nil {
					return err
				}
			}
			doc.Items = append(doc.Items[:index], doc.Items[index+1:]...)
			return saveRecycleBin(tx, id, &doc)
		})
		if err != nil {
			c.JSON(409, gin.H{"error": err.Error()})
			return
		}
		c.JSON(200, doc)
	})
}
