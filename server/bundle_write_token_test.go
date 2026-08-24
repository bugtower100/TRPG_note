package main

import "testing"

func TestBundleWriteTokenIsBoundToFullReadContext(t *testing.T) {
	signer, err := newBundleWriteTokenSigner()
	if err != nil {
		t.Fatal(err)
	}
	token := signer.issue("campaign-1", "user-1", 12)
	if !signer.valid(token, "campaign-1", "user-1", 12) {
		t.Fatal("issued token should be valid")
	}
	for _, test := range []struct {
		campaignID, userID string
		version            int
	}{
		{"campaign-2", "user-1", 12},
		{"campaign-1", "user-2", 12},
		{"campaign-1", "user-1", 13},
	} {
		if signer.valid(token, test.campaignID, test.userID, test.version) {
			t.Fatalf("token must not cross context: %#v", test)
		}
	}
	if signer.valid("", "campaign-1", "user-1", 12) {
		t.Fatal("empty token must be rejected")
	}
}

func TestRedactedBundleNeverCarriesWriteToken(t *testing.T) {
	response := V2CampaignBundleResponse{CampaignID: "campaign-1", Version: 3, Bundle: defaultV2Bundle("campaign-1"), WriteToken: "secret"}
	redacted := redactV2CampaignBundleForPL(response)
	if !redacted.Redacted {
		t.Fatal("PL response must be marked redacted")
	}
	if redacted.WriteToken != "" {
		t.Fatal("PL response must not contain a write token")
	}
}
