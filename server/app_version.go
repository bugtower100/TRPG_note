package main

import (
	_ "embed"
	"strings"
)

//go:embed version.txt
var appVersionRaw string

var appVersion = normalizeAppVersion(appVersionRaw)

func normalizeAppVersion(value string) string {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return "v0.0.0"
	}
	if strings.HasPrefix(trimmed, "v") || strings.HasPrefix(trimmed, "V") {
		return "v" + strings.TrimPrefix(strings.TrimPrefix(trimmed, "v"), "V")
	}
	return "v" + trimmed
}
