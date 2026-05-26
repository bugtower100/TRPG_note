package main

import (
	"strings"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type V2CreateCampaignRequest struct {
	Name        string `json:"name"`
	Description string `json:"description"`
}

type V2CampaignSummary struct {
	ID            string `json:"id"`
	Name          string `json:"name"`
	Description   string `json:"description"`
	LastModified  int64  `json:"lastModified"`
	OwnerID       string `json:"ownerId"`
	Visibility    string `json:"visibility"`
	SchemaVersion int    `json:"schemaVersion"`
}

type V2CreateCampaignResponse struct {
	Summary V2CampaignSummary        `json:"summary"`
	Bundle  V2CampaignBundleResponse `json:"bundle"`
}

func toCampaignSummary(campaign V2Campaign) V2CampaignSummary {
	return V2CampaignSummary{
		ID:            campaign.ID,
		Name:          campaign.Name,
		Description:   campaign.Description,
		LastModified:  campaign.UpdatedAt.UnixMilli(),
		OwnerID:       campaign.OwnerUserID,
		Visibility:    campaign.Visibility,
		SchemaVersion: targetSchemaVersion,
	}
}

func listV2Campaigns(db *gorm.DB, userID string) ([]V2CampaignSummary, error) {
	var campaigns []V2Campaign
	err := db.
		Joins("JOIN campaign_members ON campaign_members.campaign_id = campaigns.id").
		Where("campaign_members.user_id = ?", userID).
		Order("campaigns.updated_at desc").
		Find(&campaigns).Error
	if err != nil {
		return nil, err
	}

	result := make([]V2CampaignSummary, 0, len(campaigns))
	for _, campaign := range campaigns {
		result = append(result, toCampaignSummary(campaign))
	}
	return result, nil
}

func createV2Campaign(db *gorm.DB, userID, username, name, description string) (V2CreateCampaignResponse, error) {
	now := time.Now()
	campaignID := uuid.NewString()
	campaign := V2Campaign{
		ID:          campaignID,
		Name:        strings.TrimSpace(name),
		Description: strings.TrimSpace(description),
		OwnerUserID: userID,
		Visibility:  "private",
		CreatedAt:   now,
		UpdatedAt:   now,
	}

	member := V2CampaignMember{
		CampaignID: campaignID,
		UserID:     userID,
		Role:       "owner",
		CreatedAt:  now,
		UpdatedAt:  now,
	}
	joinedAt := now
	member.JoinedAt = &joinedAt
	member.LastActiveAt = &joinedAt

	cfg := CampaignConfigDoc{
		CampaignID:    campaignID,
		Name:          campaign.Name,
		Description:   campaign.Description,
		LastModified:  now.UnixMilli(),
		Visibility:    "private",
		OwnerUserID:   userID,
		SchemaVersion: 2,
		Members: []CampaignMember{
			{
				UserID:       userID,
				Username:     username,
				Role:         "GM",
				JoinedAt:     now.UnixMilli(),
				LastActiveAt: now.UnixMilli(),
			},
		},
		CreatedAt: now.UnixMilli(),
		UpdatedAt: now.UnixMilli(),
	}

	bundle := defaultV2Bundle(campaignID)
	bundle.Meta["projectName"] = campaign.Name
	bundle.Meta["description"] = campaign.Description
	bundle.Meta["lastModified"] = now.UnixMilli()

	if err := db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Save(&campaign).Error; err != nil {
			return err
		}
		if err := tx.Save(&member).Error; err != nil {
			return err
		}
		if err := saveCampaignConfigDoc(tx, cfg); err != nil {
			return err
		}
		_, err := saveV2CampaignBundle(tx, campaignID, V2CampaignBundleUpdateRequest{
			ExpectedVersion: 0,
			Bundle:          bundle,
		})
		return err
	}); err != nil {
		return V2CreateCampaignResponse{}, err
	}

	savedBundle, err := loadV2CampaignBundle(db, campaignID)
	if err != nil {
		return V2CreateCampaignResponse{}, err
	}

	return V2CreateCampaignResponse{
		Summary: toCampaignSummary(campaign),
		Bundle:  savedBundle,
	}, nil
}

func deleteV2Campaign(db *gorm.DB, campaignID string) error {
	return db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("campaign_id = ?", campaignID).Delete(&V2CampaignDocument{}).Error; err != nil {
			return err
		}
		if err := tx.Where("campaign_id = ?", campaignID).Delete(&V2CampaignMember{}).Error; err != nil {
			return err
		}
		if err := tx.Where("campaign_id = ?", campaignID).Delete(&V2CampaignConfig{}).Error; err != nil {
			return err
		}
		if err := tx.Where("campaign_id = ?", campaignID).Delete(&V2TeamNote{}).Error; err != nil {
			return err
		}
		if err := tx.Where("campaign_id = ?", campaignID).Delete(&V2Share{}).Error; err != nil {
			return err
		}
		if err := tx.Where("campaign_id = ?", campaignID).Delete(&V2DocumentVersion{}).Error; err != nil {
			return err
		}
		if err := tx.Delete(&V2Campaign{}, "id = ?", campaignID).Error; err != nil {
			return err
		}
		if err := tx.Delete(&KV{}, "key = ?", campaignConfigKey(campaignID)).Error; err != nil {
			return err
		}
		if err := tx.Delete(&KV{}, "key = ?", taskBoardKey(campaignID)).Error; err != nil {
			return err
		}
		if err := tx.Delete(&KV{}, "key = ?", shareIndexKey(campaignID)).Error; err != nil {
			return err
		}
		if err := tx.Delete(&KV{}, "key = ?", versionIndexKey(campaignID)).Error; err != nil {
			return err
		}
		return removePublicCampaignIndex(tx, campaignID)
	})
}
