package main

import (
	"testing"
	"time"
)

func TestRenewPLTeamNoteLeaseAfterSavePreservesEditingSession(t *testing.T) {
	const (
		startedAt = int64(1_000)
		savedAt   = int64(5_000)
	)
	oldExpiry := int64(2_000)
	note := TeamNoteDoc{
		ActiveLease: &TeamNoteLease{
			UserID:    "pl-1",
			Username:  "旧名称",
			Role:      campaignRolePL,
			StartedAt: startedAt,
			ExpiresAt: &oldExpiry,
		},
	}

	renewPLTeamNoteLeaseAfterSave(&note, "pl-1", "玩家一", savedAt)

	if note.ActiveLease == nil {
		t.Fatal("expected active lease")
	}
	if note.ActiveLease.StartedAt != startedAt {
		t.Fatalf("expected StartedAt %d to remain stable, got %d", startedAt, note.ActiveLease.StartedAt)
	}
	if note.ActiveLease.ExpiresAt == nil {
		t.Fatal("expected PL lease expiry")
	}
	expectedExpiry := savedAt + int64(10*time.Minute/time.Millisecond)
	if *note.ActiveLease.ExpiresAt != expectedExpiry {
		t.Fatalf("expected expiry %d, got %d", expectedExpiry, *note.ActiveLease.ExpiresAt)
	}
	if note.ActiveLease.Username != "玩家一" {
		t.Fatalf("expected refreshed username, got %q", note.ActiveLease.Username)
	}
}

func TestRenewPLTeamNoteLeaseAfterSaveCreatesMissingLease(t *testing.T) {
	const savedAt = int64(5_000)
	note := TeamNoteDoc{}

	renewPLTeamNoteLeaseAfterSave(&note, "pl-1", "玩家一", savedAt)

	if note.ActiveLease == nil {
		t.Fatal("expected active lease")
	}
	if note.ActiveLease.UserID != "pl-1" || note.ActiveLease.StartedAt != savedAt {
		t.Fatalf("unexpected created lease: %+v", note.ActiveLease)
	}
}
