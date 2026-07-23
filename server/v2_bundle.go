package main

import (
	"encoding/json"
	"time"

	"gorm.io/gorm"
)

type V2CampaignBundle struct {
	ID             string           `json:"id"`
	Meta           map[string]any   `json:"meta"`
	Notes          string           `json:"notes"`
	Characters     []map[string]any `json:"characters"`
	Locations      []map[string]any `json:"locations"`
	Organizations  []map[string]any `json:"organizations"`
	Events         []map[string]any `json:"events"`
	Clues          []map[string]any `json:"clues"`
	Timelines      []map[string]any `json:"timelines"`
	Monsters       []map[string]any `json:"monsters"`
	SessionTasks   []map[string]any `json:"sessionTasks"`
	RelationGraphs []map[string]any `json:"relationGraphs"`
	MindMaps       []map[string]any `json:"mindMaps"`
}

type V2CampaignBundleResponse struct {
	CampaignID string           `json:"campaignId"`
	Version    int              `json:"version"`
	Bundle     V2CampaignBundle `json:"bundle"`
}

type V2CampaignBundleUpdateRequest struct {
	ExpectedVersion int              `json:"expectedVersion"`
	Bundle          V2CampaignBundle `json:"bundle"`
}

type V2BundleConflictError struct {
	Current V2CampaignBundleResponse
}

func (e *V2BundleConflictError) Error() string {
	return "conflict"
}

var v2DocumentTypeOrder = []string{
	"campaign_meta",
	"notes",
	"characters",
	"locations",
	"organizations",
	"events",
	"clues",
	"timelines",
	"monsters",
	"session_tasks",
	"relation_graphs",
	"mind_maps",
}

func defaultV2Bundle(campaignID string) V2CampaignBundle {
	now := time.Now().UnixMilli()
	return V2CampaignBundle{
		ID: campaignID,
		Meta: map[string]any{
			"formatVersion": "2.0",
			"schemaVersion": 2,
			"projectName":   "新模组",
			"lastModified":  now,
			"description":   "",
		},
		Notes:          "",
		Characters:     []map[string]any{},
		Locations:      []map[string]any{},
		Organizations:  []map[string]any{},
		Events:         []map[string]any{},
		Clues:          []map[string]any{},
		Timelines:      []map[string]any{},
		Monsters:       []map[string]any{},
		SessionTasks:   []map[string]any{},
		RelationGraphs: []map[string]any{},
		MindMaps:       []map[string]any{},
	}
}

func bundleDocumentID(campaignID, docType string) string {
	return campaignID + ":" + docType
}

func loadDocumentJSON(db *gorm.DB, campaignID, docType string, out any) (*V2CampaignDocument, error) {
	var doc V2CampaignDocument
	err := db.First(&doc, "campaign_id = ? AND document_type = ?", campaignID, docType).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, err
	}
	if err := json.Unmarshal([]byte(doc.ContentJSON), out); err != nil {
		return nil, err
	}
	return &doc, nil
}

func toMapSlice(value any) []map[string]any {
	bytes, err := json.Marshal(value)
	if err != nil {
		return []map[string]any{}
	}
	var result []map[string]any
	if err := json.Unmarshal(bytes, &result); err != nil {
		return []map[string]any{}
	}
	if result == nil {
		return []map[string]any{}
	}
	return result
}

func loadV2CampaignBundle(db *gorm.DB, campaignID string) (V2CampaignBundleResponse, error) {
	bundle := defaultV2Bundle(campaignID)
	version := 1

	if doc, err := loadDocumentJSON(db, campaignID, "campaign_meta", &bundle.Meta); err != nil {
		return V2CampaignBundleResponse{}, err
	} else if doc != nil {
		version = maxInt(version, doc.Version)
	}
	if doc, err := loadDocumentJSON(db, campaignID, "notes", &bundle.Notes); err != nil {
		return V2CampaignBundleResponse{}, err
	} else if doc != nil {
		version = maxInt(version, doc.Version)
	}
	if doc, err := loadDocumentJSON(db, campaignID, "characters", &bundle.Characters); err != nil {
		return V2CampaignBundleResponse{}, err
	} else if doc != nil {
		version = maxInt(version, doc.Version)
	}
	if doc, err := loadDocumentJSON(db, campaignID, "locations", &bundle.Locations); err != nil {
		return V2CampaignBundleResponse{}, err
	} else if doc != nil {
		version = maxInt(version, doc.Version)
	}
	if doc, err := loadDocumentJSON(db, campaignID, "organizations", &bundle.Organizations); err != nil {
		return V2CampaignBundleResponse{}, err
	} else if doc != nil {
		version = maxInt(version, doc.Version)
	}
	if doc, err := loadDocumentJSON(db, campaignID, "events", &bundle.Events); err != nil {
		return V2CampaignBundleResponse{}, err
	} else if doc != nil {
		version = maxInt(version, doc.Version)
	}
	if doc, err := loadDocumentJSON(db, campaignID, "clues", &bundle.Clues); err != nil {
		return V2CampaignBundleResponse{}, err
	} else if doc != nil {
		version = maxInt(version, doc.Version)
	}
	if doc, err := loadDocumentJSON(db, campaignID, "timelines", &bundle.Timelines); err != nil {
		return V2CampaignBundleResponse{}, err
	} else if doc != nil {
		version = maxInt(version, doc.Version)
	}
	if doc, err := loadDocumentJSON(db, campaignID, "monsters", &bundle.Monsters); err != nil {
		return V2CampaignBundleResponse{}, err
	} else if doc != nil {
		version = maxInt(version, doc.Version)
	}
	if doc, err := loadDocumentJSON(db, campaignID, "session_tasks", &bundle.SessionTasks); err != nil {
		return V2CampaignBundleResponse{}, err
	} else if doc != nil {
		version = maxInt(version, doc.Version)
	}
	if doc, err := loadDocumentJSON(db, campaignID, "relation_graphs", &bundle.RelationGraphs); err != nil {
		return V2CampaignBundleResponse{}, err
	} else if doc != nil {
		version = maxInt(version, doc.Version)
	}
	if doc, err := loadDocumentJSON(db, campaignID, "mind_maps", &bundle.MindMaps); err != nil {
		return V2CampaignBundleResponse{}, err
	} else if doc != nil {
		version = maxInt(version, doc.Version)
	}

	return V2CampaignBundleResponse{
		CampaignID: campaignID,
		Version:    version,
		Bundle:     bundle,
	}, nil
}

func redactV2CampaignBundleForPL(response V2CampaignBundleResponse) V2CampaignBundleResponse {
	response.Bundle.Notes = ""
	response.Bundle.Characters = []map[string]any{}
	response.Bundle.Locations = []map[string]any{}
	response.Bundle.Organizations = []map[string]any{}
	response.Bundle.Events = []map[string]any{}
	response.Bundle.Clues = []map[string]any{}
	response.Bundle.Timelines = []map[string]any{}
	response.Bundle.Monsters = []map[string]any{}
	response.Bundle.SessionTasks = []map[string]any{}
	response.Bundle.RelationGraphs = []map[string]any{}
	response.Bundle.MindMaps = []map[string]any{}
	return response
}

func saveV2CampaignDocument(tx *gorm.DB, campaignID, docType string, content any, version int) error {
	payload, err := json.Marshal(content)
	if err != nil {
		return err
	}

	now := time.Now()
	var existing V2CampaignDocument
	err = tx.First(&existing, "campaign_id = ? AND document_type = ?", campaignID, docType).Error
	if err != nil && err != gorm.ErrRecordNotFound {
		return err
	}

	doc := V2CampaignDocument{
		ID:            bundleDocumentID(campaignID, docType),
		CampaignID:    campaignID,
		DocumentType:  docType,
		SchemaVersion: 2,
		Version:       version,
		ContentJSON:   string(payload),
		CreatedAt:     now,
		UpdatedAt:     now,
	}
	if err == nil {
		doc.CreatedAt = existing.CreatedAt
	}
	return tx.Save(&doc).Error
}

func saveV2CampaignBundle(db *gorm.DB, campaignID string, request V2CampaignBundleUpdateRequest) (V2CampaignBundleResponse, error) {
	current, err := loadV2CampaignBundle(db, campaignID)
	if err != nil {
		return V2CampaignBundleResponse{}, err
	}
	if request.ExpectedVersion > 0 && request.ExpectedVersion != current.Version {
		return V2CampaignBundleResponse{}, &V2BundleConflictError{Current: current}
	}

	nextVersion := current.Version + 1
	if request.Bundle.ID == "" {
		request.Bundle.ID = campaignID
	}

	err = db.Transaction(func(tx *gorm.DB) error {
		if err := saveV2CampaignDocument(tx, campaignID, "campaign_meta", request.Bundle.Meta, nextVersion); err != nil {
			return err
		}
		if err := saveV2CampaignDocument(tx, campaignID, "notes", request.Bundle.Notes, nextVersion); err != nil {
			return err
		}
		if err := saveV2CampaignDocument(tx, campaignID, "characters", request.Bundle.Characters, nextVersion); err != nil {
			return err
		}
		if err := saveV2CampaignDocument(tx, campaignID, "locations", request.Bundle.Locations, nextVersion); err != nil {
			return err
		}
		if err := saveV2CampaignDocument(tx, campaignID, "organizations", request.Bundle.Organizations, nextVersion); err != nil {
			return err
		}
		if err := saveV2CampaignDocument(tx, campaignID, "events", request.Bundle.Events, nextVersion); err != nil {
			return err
		}
		if err := saveV2CampaignDocument(tx, campaignID, "clues", request.Bundle.Clues, nextVersion); err != nil {
			return err
		}
		if err := saveV2CampaignDocument(tx, campaignID, "timelines", request.Bundle.Timelines, nextVersion); err != nil {
			return err
		}
		if err := saveV2CampaignDocument(tx, campaignID, "monsters", request.Bundle.Monsters, nextVersion); err != nil {
			return err
		}
		if err := saveV2CampaignDocument(tx, campaignID, "session_tasks", request.Bundle.SessionTasks, nextVersion); err != nil {
			return err
		}
		if err := saveV2CampaignDocument(tx, campaignID, "relation_graphs", request.Bundle.RelationGraphs, nextVersion); err != nil {
			return err
		}
		if err := saveV2CampaignDocument(tx, campaignID, "mind_maps", request.Bundle.MindMaps, nextVersion); err != nil {
			return err
		}
		return nil
	})
	if err != nil {
		return V2CampaignBundleResponse{}, err
	}

	return loadV2CampaignBundle(db, campaignID)
}
