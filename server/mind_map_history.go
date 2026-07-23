package main

import (
	"fmt"
	"time"

	"gorm.io/gorm"
)

const mindMapHistoryDocumentType = "mind_map_history"
const mindMapHistoryLimit = 60

// MindMapHistoryState stores full map snapshots. It is deliberately separate
// from V2CampaignBundle so ordinary campaign exports do not include history.
type MindMapHistoryState struct {
	Past   []map[string]any `json:"past"`
	Future []map[string]any `json:"future"`
}

type MindMapHistoryDocument struct {
	CampaignID string                         `json:"campaignId"`
	Histories  map[string]MindMapHistoryState `json:"histories"`
	UpdatedAt  int64                          `json:"updatedAt"`
	Version    int                            `json:"version"`
}

type MindMapHistoryUpdateRequest struct {
	ExpectedVersion int                            `json:"expectedVersion"`
	Histories       map[string]MindMapHistoryState `json:"histories"`
}

type MindMapHistoryConflictError struct {
	Current MindMapHistoryDocument
}

func (err *MindMapHistoryConflictError) Error() string {
	return fmt.Sprintf("mind map history version conflict: current version %d", err.Current.Version)
}

func normalizeMindMapHistoryStates(
	histories map[string]MindMapHistoryState,
) map[string]MindMapHistoryState {
	result := make(map[string]MindMapHistoryState, len(histories))
	for mindMapID, history := range histories {
		if mindMapID == "" {
			continue
		}
		past := history.Past
		if len(past) > mindMapHistoryLimit {
			past = past[len(past)-mindMapHistoryLimit:]
		}
		future := history.Future
		if len(future) > mindMapHistoryLimit {
			future = future[:mindMapHistoryLimit]
		}
		if past == nil {
			past = []map[string]any{}
		}
		if future == nil {
			future = []map[string]any{}
		}
		result[mindMapID] = MindMapHistoryState{
			Past:   past,
			Future: future,
		}
	}
	return result
}

func defaultMindMapHistoryDocument(campaignID string) MindMapHistoryDocument {
	return MindMapHistoryDocument{
		CampaignID: campaignID,
		Histories:  map[string]MindMapHistoryState{},
		UpdatedAt:  time.Now().UnixMilli(),
		Version:    1,
	}
}

func loadMindMapHistoryDocument(db *gorm.DB, campaignID string) (MindMapHistoryDocument, error) {
	history := defaultMindMapHistoryDocument(campaignID)
	doc, err := loadDocumentJSON(db, campaignID, mindMapHistoryDocumentType, &history)
	if err != nil {
		return MindMapHistoryDocument{}, err
	}
	if doc == nil {
		return history, nil
	}
	if history.Histories == nil {
		history.Histories = map[string]MindMapHistoryState{}
	}
	history.Histories = normalizeMindMapHistoryStates(history.Histories)
	return history, nil
}

func saveMindMapHistoryDocument(db *gorm.DB, campaignID string, history MindMapHistoryDocument) error {
	history.CampaignID = campaignID
	history.UpdatedAt = time.Now().UnixMilli()
	if history.Version < 1 {
		history.Version = 1
	}
	if history.Histories == nil {
		history.Histories = map[string]MindMapHistoryState{}
	}
	history.Histories = normalizeMindMapHistoryStates(history.Histories)
	return saveV2CampaignDocument(db, campaignID, mindMapHistoryDocumentType, history, history.Version)
}

func updateMindMapHistoryDocument(
	db *gorm.DB,
	campaignID string,
	request MindMapHistoryUpdateRequest,
) (MindMapHistoryDocument, error) {
	current, err := loadMindMapHistoryDocument(db, campaignID)
	if err != nil {
		return MindMapHistoryDocument{}, err
	}
	if request.ExpectedVersion > 0 && request.ExpectedVersion != current.Version {
		return MindMapHistoryDocument{}, &MindMapHistoryConflictError{Current: current}
	}
	next := MindMapHistoryDocument{
		CampaignID: campaignID,
		Histories:  normalizeMindMapHistoryStates(request.Histories),
		Version:    current.Version + 1,
	}
	if err := saveMindMapHistoryDocument(db, campaignID, next); err != nil {
		return MindMapHistoryDocument{}, err
	}
	return loadMindMapHistoryDocument(db, campaignID)
}
