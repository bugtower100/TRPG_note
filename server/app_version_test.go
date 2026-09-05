package main

import (
	"os"
	"testing"
)

func TestEmbeddedAppVersionMatchesSource(t *testing.T) {
	content, err := os.ReadFile("../version.txt")
	if err != nil {
		t.Fatalf("read source version: %v", err)
	}

	want := normalizeAppVersion(string(content))
	if got := embeddedAppVersion(); got != want {
		t.Fatalf("embedded app version = %q, want %q", got, want)
	}
}
