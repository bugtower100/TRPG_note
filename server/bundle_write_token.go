package main

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"fmt"
)

type bundleWriteTokenSigner struct {
	secret []byte
}

func newBundleWriteTokenSigner() (*bundleWriteTokenSigner, error) {
	secret := make([]byte, 32)
	if _, err := rand.Read(secret); err != nil {
		return nil, err
	}
	return &bundleWriteTokenSigner{secret: secret}, nil
}

func (signer *bundleWriteTokenSigner) issue(campaignID, userID string, version int) string {
	payload := fmt.Sprintf("%s\x00%s\x00%d", campaignID, userID, version)
	mac := hmac.New(sha256.New, signer.secret)
	_, _ = mac.Write([]byte(payload))
	return base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
}

func (signer *bundleWriteTokenSigner) valid(token, campaignID, userID string, version int) bool {
	if token == "" || version <= 0 {
		return false
	}
	provided, err := base64.RawURLEncoding.DecodeString(token)
	if err != nil {
		return false
	}
	expected, err := base64.RawURLEncoding.DecodeString(signer.issue(campaignID, userID, version))
	return err == nil && hmac.Equal(provided, expected)
}
