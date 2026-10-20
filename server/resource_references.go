package main

import (
	"encoding/hex"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"

	"gorm.io/gorm"
)

// Resolve old references after a resource has been moved or its folder renamed.
func resolveResourceRef(baseDir, raw string) (string, bool) {
	ref, ok := normalizeResourceRef(raw)
	if !ok {
		return "", false
	}
	if info, err := os.Stat(resourceRefToFullPath(baseDir, ref)); err == nil && !info.IsDir() {
		return ref, true
	}
	assetDir := filepath.Join(baseDir, resourceRootRef)
	name := filepath.Base(ref)
	if found, ok := findResourceRefByBaseName(assetDir, name); ok {
		return found, true
	}
	hash, _, _ := strings.Cut(name, "__")
	if decoded, err := hex.DecodeString(hash); err == nil && len(decoded) == 32 {
		return findExistingResourceRefByHash(assetDir, hash)
	}
	return "", false
}

func referencedResourcePaths(db *gorm.DB, baseDir string) (map[string]bool, error) {
	var documents []string
	if err := db.Model(&V2CampaignDocument{}).Pluck("content_json", &documents).Error; err != nil {
		return nil, err
	}
	var collaborationDocuments []string
	if err := db.Model(&KV{}).Where("key LIKE ? OR key LIKE ? OR key LIKE ?", "campaign:%:team:%", "campaign:%:shares", "campaign:%:task_board").Pluck("value", &collaborationDocuments).Error; err != nil {
		return nil, err
	}
	documents = append(documents, collaborationDocuments...)
	refs := make(map[string]struct{})
	for _, document := range documents {
		var value any
		if err := json.Unmarshal([]byte(document), &value); err != nil {
			return nil, err
		}
		collectResourceRefsFromValue(value, refs)
	}
	paths := make(map[string]bool)
	for ref := range refs {
		if resolved, ok := resolveResourceRef(baseDir, ref); ok {
			paths[resolved] = true
		}
	}
	return paths, nil
}
